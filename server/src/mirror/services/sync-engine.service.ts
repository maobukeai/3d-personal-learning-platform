import { logger } from '../../utils/logger';
import prisma from '../../services/prisma';
import { getAdapter } from '../adapters';
import { thumbnailLocalizer } from './thumbnail-localizer.service';
import { emitToAll } from '../../services/socket.service';
import crypto from 'crypto';
import { redisService } from '../../services/redis.service';
import { uploadSourceMetadataToR2 } from './metadata.helper';

async function runWithLimit<T>(
  limit: number,
  items: T[],
  fn: (item: T) => Promise<void>,
): Promise<void> {
  const executing = new Set<Promise<void>>();
  for (const item of items) {
    const p = Promise.resolve().then(() => fn(item));
    executing.add(p);
    const clean = () => executing.delete(p);
    p.then(clean, clean);
    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }
  await Promise.all(executing);
}

interface SyncResult {
  resourcesFound: number;
  resourcesCreated: number;
  resourcesUpdated: number;
  resourcesDeleted: number;
}

interface SyncProgress {
  sourceId: string;
  status: 'SYNCING' | 'IDLE' | 'ERROR';
  type: 'FULL' | 'INCREMENTAL';
  phase: 'CATEGORIES' | 'LISTING' | 'DETAILS';
  currentCategory: string;
  currentCategoryIndex: number;
  totalCategories: number;
  currentPage: number;
  resourcesFound: number;
  resourcesCreated: number;
  resourcesUpdated: number;
  detailsFetched: number;
  totalDetailsToFetch: number;
  startedAt: Date;
  estimatedProgress: number;
}

interface ResourceMinimal {
  id: string;
  externalId: string;
  description: string | null;
  thumbnailUrl: string | null;
}

export class SyncEngine {
  private activeSyncs: Set<string> = new Set();
  private progressMap: Map<string, SyncProgress> = new Map();
  private abortControllers: Map<string, AbortController> = new Map();
  private schedulerIntervals: Map<string, NodeJS.Timeout> = new Map();
  private schedulerStarted = false;

  getProgress(sourceId: string): SyncProgress | null {
    return this.progressMap.get(sourceId) || null;
  }

  async fullSync(sourceId: string, hasLock = false): Promise<SyncResult> {
    if (this.activeSyncs.has(sourceId)) {
      throw new Error('同步已在运行中');
    }

    const lockKey = `sync_engine:lock:${sourceId}`;
    let lockAcquired = false;
    if (!hasLock) {
      const acquired = await redisService.acquireLock(lockKey, 3600); // 1 hour TTL
      if (!acquired) {
        throw new Error('同步已在运行中(分布式锁已占用)');
      }
      lockAcquired = true;
    }

    let source: any;
    try {
      source = await prisma.mirrorSource.findUnique({ where: { id: sourceId } });
    } catch (e) {
      if (lockAcquired) await redisService.releaseLock(lockKey).catch(() => {});
      throw e;
    }

    if (!source) {
      if (lockAcquired) await redisService.releaseLock(lockKey).catch(() => {});
      throw new Error('镜像源不存在');
    }
    if (source.adapterType === 'MANUAL') {
      if (lockAcquired) await redisService.releaseLock(lockKey).catch(() => {});
      throw new Error('手动上传资产站不支持自动同步任务');
    }

    const progress: SyncProgress = {
      sourceId,
      status: 'SYNCING',
      type: 'FULL',
      phase: 'CATEGORIES',
      currentCategory: '',
      currentCategoryIndex: 0,
      totalCategories: 0,
      currentPage: 0,
      resourcesFound: 0,
      resourcesCreated: 0,
      resourcesUpdated: 0,
      detailsFetched: 0,
      totalDetailsToFetch: 0,
      startedAt: new Date(),
      estimatedProgress: 0,
    };
    this.progressMap.set(sourceId, progress);

    this.activeSyncs.add(sourceId);
    const controller = new AbortController();
    this.abortControllers.set(sourceId, controller);
    const signal = controller.signal;

    emitToAll('mirror_sync_started', { sourceId, sourceName: source.displayName, type: 'FULL' });

    let syncLog: any;
    try {
      syncLog = await prisma.syncLog.create({
        data: { sourceId, type: 'FULL', status: 'RUNNING' },
      });
    } catch (e) {
      this.activeSyncs.delete(sourceId);
      this.abortControllers.delete(sourceId);
      this.progressMap.delete(sourceId);
      if (lockAcquired) await redisService.releaseLock(lockKey).catch(() => {});
      throw e;
    }

    const result: SyncResult = {
      resourcesFound: 0,
      resourcesCreated: 0,
      resourcesUpdated: 0,
      resourcesDeleted: 0,
    };

    const startTime = Date.now();

    try {
      await prisma.mirrorSource.update({
        where: { id: sourceId },
        data: { syncStatus: 'SYNCING' },
      });

      const adapter = getAdapter(source.adapterType, {
        baseUrl: source.baseUrl,
        syncConfig: source.syncConfig ? JSON.parse(source.syncConfig) : undefined,
      });

      // Phase 1: Fetch categories
      if (signal.aborted) throw new Error('AbortError');
      progress.phase = 'CATEGORIES';
      const rawCategories = await adapter.fetchCategories(signal);
      progress.totalCategories = rawCategories.length;

      const categoryMap = new Map<string, string>();
      for (const rawCat of rawCategories) {
        if (signal.aborted) throw new Error('AbortError');
        const category = await prisma.mirrorCategory.upsert({
          where: { sourceId_externalId: { sourceId, externalId: rawCat.externalId } },
          create: {
            sourceId,
            externalId: rawCat.externalId,
            name: rawCat.name,
            slug: rawCat.slug,
            parentExternalId: rawCat.parentExternalId,
          },
          update: {
            name: rawCat.name,
            slug: rawCat.slug,
            parentExternalId: rawCat.parentExternalId,
          },
        });
        categoryMap.set(rawCat.externalId, category.id);
      }

      // Phase 2: Fetch resource listings
      progress.phase = 'LISTING';
      const seenExternalIds = new Set<string>();
      const newResourceIds: ResourceMinimal[] = [];

      // Fetch all existing resources to do in-memory lookups instead of database findUnique calls
      const existingResources = await prisma.mirrorResource.findMany({
        where: { sourceId },
        select: {
          id: true,
          externalId: true,
          contentHash: true,
          description: true,
          thumbnailUrl: true,
          contentHtml: true,
        },
      });
      const existingMap = new Map(
        existingResources.map((r) => [
          r.externalId,
          {
            id: r.id,
            externalId: r.externalId,
            contentHash: r.contentHash,
            description: r.description || null,
            thumbnailUrl: r.thumbnailUrl || null,
            hasHtml: !!r.contentHtml,
          },
        ]),
      );

      const pendingCreates: any[] = [];
      const pendingUpdates: any[] = [];

      const processPage = (
        resources: any[],
        categoryId: string | null,
        rawCatExternalId: string,
      ) => {
        for (const rawRes of resources) {
          if (seenExternalIds.has(rawRes.externalId)) continue;
          seenExternalIds.add(rawRes.externalId);

          const resCategoryExternalId = rawRes.categoryExternalId || rawCatExternalId;
          const resCategoryId = categoryMap.get(resCategoryExternalId) || categoryId;

          const existing = existingMap.get(rawRes.externalId);

          if (existing) {
            const needsDetails = !existing.hasHtml;
            const needsUpdate = existing.contentHash !== rawRes.contentHash;

            if (needsUpdate) {
              pendingUpdates.push({
                where: { id: existing.id },
                data: {
                  title: rawRes.title,
                  description: rawRes.description,
                  thumbnailUrl: rawRes.thumbnailUrl,
                  contentUrl: rawRes.contentUrl,
                  tags: rawRes.tags ? JSON.stringify(rawRes.tags) : null,
                  resourceType: rawRes.resourceType,
                  publishedAt: rawRes.publishedAt,
                  contentHash: rawRes.contentHash,
                  categoryId: resCategoryId,
                  syncedAt: new Date(),
                },
              });
              result.resourcesUpdated++;
              existingMap.set(rawRes.externalId, {
                id: existing.id,
                externalId: rawRes.externalId,
                contentHash: rawRes.contentHash || null,
                description: rawRes.description || existing.description,
                thumbnailUrl: rawRes.thumbnailUrl || existing.thumbnailUrl,
                hasHtml: true,
              });
            }

            if (needsUpdate || needsDetails) {
              newResourceIds.push({
                id: existing.id,
                externalId: rawRes.externalId,
                description: rawRes.description || existing.description,
                thumbnailUrl: rawRes.thumbnailUrl || existing.thumbnailUrl,
              });
            }
          } else {
            const newId = crypto.randomUUID();
            pendingCreates.push({
              id: newId,
              sourceId,
              externalId: rawRes.externalId,
              categoryId: resCategoryId,
              title: rawRes.title,
              description: rawRes.description,
              thumbnailUrl: rawRes.thumbnailUrl,
              contentUrl: rawRes.contentUrl,
              tags: rawRes.tags ? JSON.stringify(rawRes.tags) : null,
              resourceType: rawRes.resourceType,
              publishedAt: rawRes.publishedAt,
              contentHash: rawRes.contentHash,
            });
            result.resourcesCreated++;
            newResourceIds.push({
              id: newId,
              externalId: rawRes.externalId,
              description: rawRes.description || null,
              thumbnailUrl: rawRes.thumbnailUrl || null,
            });
            existingMap.set(rawRes.externalId, {
              id: newId,
              externalId: rawRes.externalId,
              contentHash: rawRes.contentHash || null,
              description: rawRes.description || null,
              thumbnailUrl: rawRes.thumbnailUrl || null,
              hasHtml: false,
            });
          }
        }

        progress.resourcesCreated = result.resourcesCreated;
        progress.resourcesUpdated = result.resourcesUpdated;
      };

      const categoryConcurrency = 4;
      let categoriesCompleted = 0;

      await runWithLimit(categoryConcurrency, rawCategories, async (rawCat) => {
        if (signal.aborted) return;
        const categoryId = categoryMap.get(rawCat.externalId) || null;

        const page1Result = await adapter.fetchResources(
          1,
          rawCat.slug || rawCat.externalId,
          signal,
        );
        if (signal.aborted) return;

        result.resourcesFound += page1Result.resources.length;
        progress.resourcesFound = result.resourcesFound;

        processPage(page1Result.resources, categoryId, rawCat.externalId);

        const totalPages = page1Result.totalPages;
        if (totalPages > 1) {
          const pagesToFetch = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
          const pageConcurrency = 5;

          await runWithLimit(pageConcurrency, pagesToFetch, async (page) => {
            if (signal.aborted) return;
            const pageResult = await adapter.fetchResources(
              page,
              rawCat.slug || rawCat.externalId,
              signal,
            );
            if (signal.aborted) return;

            result.resourcesFound += pageResult.resources.length;
            progress.resourcesFound = result.resourcesFound;

            if (page > progress.currentPage) {
              progress.currentPage = page;
            }

            processPage(pageResult.resources, categoryId, rawCat.externalId);
          });
        }

        categoriesCompleted++;
        progress.currentCategory = rawCat.name;
        progress.currentCategoryIndex = categoriesCompleted;
        progress.estimatedProgress = Math.round((categoriesCompleted / rawCategories.length) * 50);
      });

      const dbChunkSize = 100;

      for (let i = 0; i < pendingCreates.length; i += dbChunkSize) {
        if (signal.aborted) throw new Error('AbortError');
        const chunk = pendingCreates.slice(i, i + dbChunkSize);
        await prisma.mirrorResource.createMany({
          data: chunk,
        });
      }

      for (let i = 0; i < pendingUpdates.length; i += dbChunkSize) {
        if (signal.aborted) throw new Error('AbortError');
        const chunk = pendingUpdates.slice(i, i + dbChunkSize);
        await prisma.$transaction(
          chunk.map((item) =>
            prisma.mirrorResource.update({
              where: item.where,
              data: item.data,
            }),
          ),
        );
      }

      // Phase 3: Fetch details for all new/updated resources
      progress.phase = 'DETAILS';
      progress.totalDetailsToFetch = newResourceIds.length;
      progress.detailsFetched = 0;
      progress.currentCategory = '抓取详情页';
      progress.estimatedProgress = 50;

      const detailBatchSize = 15;
      const detailUpdates: { id: string; data: any }[] = [];

      await runWithLimit(detailBatchSize, newResourceIds, async (resource) => {
        if (signal.aborted) return;

        try {
          const detail = await adapter.fetchResourceDetail(resource.externalId, signal);
          if (detail) {
            const updateData: any = {};
            if (
              detail.description &&
              detail.description.length > (resource.description?.length || 0)
            ) {
              updateData.description = detail.description;
            }
            if (detail.thumbnailUrl && !resource.thumbnailUrl) {
              updateData.thumbnailUrl = detail.thumbnailUrl;
            }
            if (detail.tags && detail.tags.length > 0) {
              updateData.tags = JSON.stringify(detail.tags);
            }
            if (detail.publishedAt) {
              updateData.publishedAt = detail.publishedAt;
            }
            if (detail.contentHash) {
              updateData.contentHash = detail.contentHash;
            }
            if (detail.contentHtml) {
              try {
                const localizedHtml = await thumbnailLocalizer.localizeHtmlContent(
                  detail.contentHtml,
                  sourceId,
                );
                updateData.contentHtml = localizedHtml || detail.contentHtml;
              } catch (e) {
                logger.warn(
                  `[SyncEngine] Failed to localize detail page images for ${resource.externalId}:`,
                  e instanceof Error ? e.message : String(e),
                );
                updateData.contentHtml = detail.contentHtml;
              }
            }

            if (Object.keys(updateData).length > 0) {
              detailUpdates.push({
                id: resource.id,
                data: updateData,
              });
            }
          }
        } catch (e) {
          if (e instanceof Error && e.name === 'AbortError') throw e;
          logger.error(
            `Failed to fetch detail for ${resource.externalId}:`,
            e instanceof Error ? e.message : e,
          );
        }

        progress.detailsFetched++;
        progress.estimatedProgress =
          50 + Math.round((progress.detailsFetched / progress.totalDetailsToFetch) * 40);
      });

      // Batch update resource details in chunks of 50
      const detailChunkSize = 50;
      for (let i = 0; i < detailUpdates.length; i += detailChunkSize) {
        if (signal.aborted) throw new Error('AbortError');
        const chunk = detailUpdates.slice(i, i + detailChunkSize);
        await prisma.$transaction(
          chunk.map((item) =>
            prisma.mirrorResource.update({
              where: { id: item.id },
              data: item.data,
            }),
          ),
        );
      }

      // Phase 4: Localize thumbnails
      if (signal.aborted) throw new Error('AbortError');
      progress.phase = 'DETAILS';
      progress.currentCategory = '本地化缩略图';
      progress.estimatedProgress = 90;

      const resourcesWithThumbs = await prisma.mirrorResource.findMany({
        where: { sourceId, thumbnailUrl: { not: null, startsWith: 'http' } },
        select: { id: true, thumbnailUrl: true },
      });
      if (resourcesWithThumbs.length > 0) {
        const localized = await thumbnailLocalizer.localizeBatch(
          resourcesWithThumbs as Array<{ id: string; thumbnailUrl: string | null }>,
          sourceId,
          15,
        );
        const updates = [];
        for (const [resId, localUrl] of localized) {
          updates.push(
            prisma.mirrorResource.update({
              where: { id: resId },
              data: { thumbnailUrl: localUrl },
            }),
          );
        }
        if (updates.length > 0) {
          await prisma.$transaction(updates);
        }
      }

      // Cleanup unreferenced images after successful sync
      await thumbnailLocalizer.cleanupOrphanedImages(sourceId);
      progress.estimatedProgress = 100;

      await prisma.mirrorSource.update({
        where: { id: sourceId },
        data: {
          totalResources: result.resourcesFound,
          lastSyncAt: new Date(),
          lastSyncDuration: Math.round((Date.now() - startTime) / 1000),
        },
      });

      const duration = Math.round((Date.now() - startTime) / 1000);

      await prisma.syncLog.update({
        where: { id: syncLog.id },
        data: {
          status: 'SUCCESS',
          finishedAt: new Date(),
          duration,
          resourcesFound: result.resourcesFound,
          resourcesCreated: result.resourcesCreated,
          resourcesUpdated: result.resourcesUpdated,
          resourcesDeleted: result.resourcesDeleted,
        },
      });

      // Upload/refresh metadata.json on R2 so other deployments can discover the synchronized state
      await uploadSourceMetadataToR2(sourceId).catch((err) => {
        logger.error(`[SyncEngine] Failed to upload metadata to R2 after successful full sync:`, err);
      });

      progress.estimatedProgress = 100;
    } catch (error) {
      const isAborted =
        (error instanceof Error && error.name === 'AbortError') ||
        (error instanceof Error ? error.message : String(error)) === 'AbortError';
      const duration = Math.round((Date.now() - startTime) / 1000);

      if (typeof syncLog !== 'undefined') {
        await prisma.syncLog
          .update({
            where: { id: syncLog.id },
            data: {
              status: isAborted ? 'CANCELLED' : 'FAILED',
              finishedAt: new Date(),
              duration,
              error: isAborted
                ? '用户取消同步'
                : (error instanceof Error ? error.message : String(error)) || '未知错误',
            },
          })
          .catch(() => {});
      }

      await prisma.mirrorSource
        .update({
          where: { id: sourceId },
          data: { syncStatus: isAborted ? 'IDLE' : 'ERROR' },
        })
        .catch(() => {});

      progress.status = isAborted ? 'IDLE' : 'ERROR';

      if (!isAborted) throw error;
    } finally {
      this.activeSyncs.delete(sourceId);
      this.abortControllers.delete(sourceId);
      const prevStatus = progress.status;
      if (progress.status === 'SYNCING') {
        progress.status = 'IDLE';
      }
      setTimeout(() => this.progressMap.delete(sourceId), 300000);
      await prisma.mirrorSource
        .update({
          where: { id: sourceId },
          data: { syncStatus: 'IDLE' },
        })
        .catch(() => {});
      if (lockAcquired) {
        await redisService.releaseLock(lockKey).catch(() => {});
      }

      emitToAll('mirror_sync_finished', {
        sourceId,
        sourceName: source?.displayName || '',
        type: 'FULL',
        status: prevStatus === 'SYNCING' ? 'SUCCESS' : prevStatus,
        result: prevStatus === 'SYNCING' ? result : null,
      });
    }

    return result;
  }

  async incrementalSync(sourceId: string, hasLock = false): Promise<SyncResult> {
    if (this.activeSyncs.has(sourceId)) {
      throw new Error('同步已在运行中');
    }

    const lockKey = `sync_engine:lock:${sourceId}`;
    let lockAcquired = false;
    if (!hasLock) {
      const acquired = await redisService.acquireLock(lockKey, 3600); // 1 hour TTL
      if (!acquired) {
        throw new Error('同步已在运行中(分布式锁已占用)');
      }
      lockAcquired = true;
    }

    let source: any;
    try {
      source = await prisma.mirrorSource.findUnique({ where: { id: sourceId } });
    } catch (e) {
      if (lockAcquired) await redisService.releaseLock(lockKey).catch(() => {});
      throw e;
    }

    if (!source) {
      if (lockAcquired) await redisService.releaseLock(lockKey).catch(() => {});
      throw new Error('镜像源不存在');
    }
    if (source.adapterType === 'MANUAL') {
      if (lockAcquired) await redisService.releaseLock(lockKey).catch(() => {});
      throw new Error('手动上传资产站不支持自动同步任务');
    }

    if (!source.lastSyncAt) {
      return await this.fullSync(sourceId, hasLock || lockAcquired);
    }

    const progress: SyncProgress = {
      sourceId,
      status: 'SYNCING',
      type: 'INCREMENTAL',
      phase: 'LISTING',
      currentCategory: '',
      currentCategoryIndex: 0,
      totalCategories: 1,
      currentPage: 1,
      resourcesFound: 0,
      resourcesCreated: 0,
      resourcesUpdated: 0,
      detailsFetched: 0,
      totalDetailsToFetch: 0,
      startedAt: new Date(),
      estimatedProgress: 0,
    };
    this.progressMap.set(sourceId, progress);

    this.activeSyncs.add(sourceId);
    const controller = new AbortController();
    this.abortControllers.set(sourceId, controller);
    const signal = controller.signal;

    emitToAll('mirror_sync_started', {
      sourceId,
      sourceName: source.displayName,
      type: 'INCREMENTAL',
    });

    let syncLog: any;
    try {
      syncLog = await prisma.syncLog.create({
        data: { sourceId, type: 'INCREMENTAL', status: 'RUNNING' },
      });
    } catch (e) {
      this.activeSyncs.delete(sourceId);
      this.abortControllers.delete(sourceId);
      this.progressMap.delete(sourceId);
      if (lockAcquired) await redisService.releaseLock(lockKey).catch(() => {});
      throw e;
    }

    const result: SyncResult = {
      resourcesFound: 0,
      resourcesCreated: 0,
      resourcesUpdated: 0,
      resourcesDeleted: 0,
    };

    const startTime = Date.now();

    try {
      await prisma.mirrorSource.update({
        where: { id: sourceId },
        data: { syncStatus: 'SYNCING' },
      });

      const adapter = getAdapter(source.adapterType, {
        baseUrl: source.baseUrl,
        syncConfig: source.syncConfig ? JSON.parse(source.syncConfig) : undefined,
      });

      if (signal.aborted) throw new Error('AbortError');
      const hasUpdate = await adapter.hasUpdates(source.lastSyncAt || new Date(0), signal);
      if (!hasUpdate) {
        const duration = Math.round((Date.now() - startTime) / 1000);
        await prisma.syncLog.update({
          where: { id: syncLog.id },
          data: { status: 'SUCCESS', finishedAt: new Date(), duration, resourcesFound: 0 },
        });
        progress.estimatedProgress = 100;
        return result;
      }

      progress.estimatedProgress = 20;

      if (signal.aborted) throw new Error('AbortError');
      const updates = await adapter.fetchUpdates(source.lastSyncAt || new Date(0), signal);
      result.resourcesFound = updates.length;
      progress.resourcesFound = updates.length;
      progress.estimatedProgress = 40;

      const categories = await prisma.mirrorCategory.findMany({ where: { sourceId } });
      const categoryMap = new Map(categories.map((c) => [c.externalId, c.id]));

      const newResourceIds: ResourceMinimal[] = [];
      const batch: any[] = [];

      // Fetch all existing resources to do in-memory lookups instead of database findUnique calls
      const existingResources = await prisma.mirrorResource.findMany({
        where: { sourceId },
        select: {
          id: true,
          externalId: true,
          contentHash: true,
          description: true,
          thumbnailUrl: true,
          contentHtml: true,
        },
      });
      const existingMap = new Map(
        existingResources.map((r) => [
          r.externalId,
          {
            id: r.id,
            externalId: r.externalId,
            contentHash: r.contentHash,
            description: r.description || null,
            thumbnailUrl: r.thumbnailUrl || null,
            hasHtml: !!r.contentHtml,
          },
        ]),
      );

      for (const rawRes of updates) {
        if (signal.aborted) throw new Error('AbortError');
        const categoryId = rawRes.categoryExternalId
          ? categoryMap.get(rawRes.categoryExternalId) || null
          : null;

        const existing = existingMap.get(rawRes.externalId);

        if (existing) {
          const needsDetails = !existing.hasHtml;
          const needsUpdate = existing.contentHash !== rawRes.contentHash;

          if (needsUpdate) {
            batch.push(
              prisma.mirrorResource.update({
                where: { id: existing.id },
                data: {
                  title: rawRes.title,
                  description: rawRes.description,
                  thumbnailUrl: rawRes.thumbnailUrl,
                  contentUrl: rawRes.contentUrl,
                  tags: rawRes.tags ? JSON.stringify(rawRes.tags) : null,
                  resourceType: rawRes.resourceType,
                  publishedAt: rawRes.publishedAt,
                  contentHash: rawRes.contentHash,
                  categoryId,
                  syncedAt: new Date(),
                },
              }),
            );
            result.resourcesUpdated++;
            existingMap.set(rawRes.externalId, {
              id: existing.id,
              externalId: rawRes.externalId,
              contentHash: rawRes.contentHash || null,
              description: rawRes.description || existing.description,
              thumbnailUrl: rawRes.thumbnailUrl || existing.thumbnailUrl,
              hasHtml: true,
            });
          }

          if (needsUpdate || needsDetails) {
            newResourceIds.push({
              id: existing.id,
              externalId: rawRes.externalId,
              description: rawRes.description || existing.description,
              thumbnailUrl: rawRes.thumbnailUrl || existing.thumbnailUrl,
            });
          }
        } else {
          const newId = crypto.randomUUID();
          batch.push(
            prisma.mirrorResource.create({
              data: {
                id: newId,
                sourceId,
                externalId: rawRes.externalId,
                categoryId,
                title: rawRes.title,
                description: rawRes.description,
                thumbnailUrl: rawRes.thumbnailUrl,
                contentUrl: rawRes.contentUrl,
                tags: rawRes.tags ? JSON.stringify(rawRes.tags) : null,
                resourceType: rawRes.resourceType,
                publishedAt: rawRes.publishedAt,
                contentHash: rawRes.contentHash,
              },
            }),
          );
          result.resourcesCreated++;
          newResourceIds.push({
            id: newId,
            externalId: rawRes.externalId,
            description: rawRes.description || null,
            thumbnailUrl: rawRes.thumbnailUrl || null,
          });
          existingMap.set(rawRes.externalId, {
            id: newId,
            externalId: rawRes.externalId,
            contentHash: rawRes.contentHash || null,
            description: rawRes.description || null,
            thumbnailUrl: rawRes.thumbnailUrl || null,
            hasHtml: false,
          });
        }
      }

      if (batch.length > 0) {
        await prisma.$transaction(batch);
      }
      progress.resourcesCreated = result.resourcesCreated;
      progress.resourcesUpdated = result.resourcesUpdated;
      progress.estimatedProgress = 60;

      // Fetch details for incremental updates too
      progress.phase = 'DETAILS';
      progress.totalDetailsToFetch = newResourceIds.length;
      progress.detailsFetched = 0;

      const incDetailBatch = 15;
      const detailUpdates: { id: string; data: any }[] = [];

      await runWithLimit(incDetailBatch, newResourceIds, async (resource) => {
        if (signal.aborted) return;

        try {
          const detail = await adapter.fetchResourceDetail(resource.externalId, signal);
          if (detail) {
            const updateData: any = {};
            if (
              detail.description &&
              detail.description.length > (resource.description?.length || 0)
            ) {
              updateData.description = detail.description;
            }
            if (detail.thumbnailUrl && !resource.thumbnailUrl) {
              updateData.thumbnailUrl = detail.thumbnailUrl;
            }
            if (detail.tags && detail.tags.length > 0) {
              updateData.tags = JSON.stringify(detail.tags);
            }
            if (detail.publishedAt) {
              updateData.publishedAt = detail.publishedAt;
            }
            if (detail.contentHtml) {
              try {
                const localizedHtml = await thumbnailLocalizer.localizeHtmlContent(
                  detail.contentHtml,
                  sourceId,
                );
                updateData.contentHtml = localizedHtml || detail.contentHtml;
              } catch (e) {
                logger.warn(
                  `[SyncEngine] Failed to localize detail page images for ${resource.externalId}:`,
                  e instanceof Error ? e.message : String(e),
                );
                updateData.contentHtml = detail.contentHtml;
              }
            }

            if (Object.keys(updateData).length > 0) {
              detailUpdates.push({
                id: resource.id,
                data: updateData,
              });
            }
          }
        } catch (e) {
          if (e instanceof Error && e.name === 'AbortError') throw e;
          logger.error(
            `Failed to fetch detail for ${resource.externalId}:`,
            e instanceof Error ? e.message : e,
          );
        }

        progress.detailsFetched++;
        progress.estimatedProgress =
          60 + Math.round((progress.detailsFetched / progress.totalDetailsToFetch) * 30);
      });

      // Batch update resource details in chunks of 50
      const detailChunkSize = 50;
      for (let i = 0; i < detailUpdates.length; i += detailChunkSize) {
        if (signal.aborted) throw new Error('AbortError');
        const chunk = detailUpdates.slice(i, i + detailChunkSize);
        await prisma.$transaction(
          chunk.map((item) =>
            prisma.mirrorResource.update({
              where: { id: item.id },
              data: item.data,
            }),
          ),
        );
      }

      // Localize thumbnails for new/updated resources
      if (signal.aborted) throw new Error('AbortError');
      progress.estimatedProgress = 90;
      const newResourcesWithThumbs = await prisma.mirrorResource.findMany({
        where: {
          id: { in: newResourceIds.map((r) => r.id) },
          thumbnailUrl: { not: null, startsWith: 'http' },
        },
        select: { id: true, thumbnailUrl: true },
      });
      if (newResourcesWithThumbs.length > 0) {
        const localized = await thumbnailLocalizer.localizeBatch(
          newResourcesWithThumbs as Array<{ id: string; thumbnailUrl: string | null }>,
          sourceId,
          15,
        );
        const updates = [];
        for (const [resId, localUrl] of localized) {
          updates.push(
            prisma.mirrorResource.update({
              where: { id: resId },
              data: { thumbnailUrl: localUrl },
            }),
          );
        }
        if (updates.length > 0) {
          await prisma.$transaction(updates);
        }
      }

      // Cleanup unreferenced images after successful incremental sync
      await thumbnailLocalizer.cleanupOrphanedImages(sourceId);

      const totalResources = await prisma.mirrorResource.count({ where: { sourceId } });

      await prisma.mirrorSource.update({
        where: { id: sourceId },
        data: {
          totalResources,
          lastSyncAt: new Date(),
          lastSyncDuration: Math.round((Date.now() - startTime) / 1000),
        },
      });

      const duration = Math.round((Date.now() - startTime) / 1000);

      await prisma.syncLog.update({
        where: { id: syncLog.id },
        data: {
          status: 'SUCCESS',
          finishedAt: new Date(),
          duration,
          resourcesFound: result.resourcesFound,
          resourcesCreated: result.resourcesCreated,
          resourcesUpdated: result.resourcesUpdated,
        },
      });

      // Upload/refresh metadata.json on R2 so other deployments can discover the synchronized state
      await uploadSourceMetadataToR2(sourceId).catch((err) => {
        logger.error(`[SyncEngine] Failed to upload metadata to R2 after successful incremental sync:`, err);
      });

      progress.estimatedProgress = 100;
    } catch (error) {
      const isAborted =
        (error instanceof Error && error.name === 'AbortError') ||
        (error instanceof Error ? error.message : String(error)) === 'AbortError';
      const duration = Math.round((Date.now() - startTime) / 1000);

      if (typeof syncLog !== 'undefined') {
        await prisma.syncLog
          .update({
            where: { id: syncLog.id },
            data: {
              status: isAborted ? 'CANCELLED' : 'FAILED',
              finishedAt: new Date(),
              duration,
              error: isAborted
                ? '用户取消同步'
                : (error instanceof Error ? error.message : String(error)) || '未知错误',
            },
          })
          .catch(() => {});
      }

      await prisma.mirrorSource
        .update({
          where: { id: sourceId },
          data: { syncStatus: isAborted ? 'IDLE' : 'ERROR' },
        })
        .catch(() => {});

      progress.status = isAborted ? 'IDLE' : 'ERROR';

      if (!isAborted) throw error;
    } finally {
      this.activeSyncs.delete(sourceId);
      this.abortControllers.delete(sourceId);
      const prevStatus = progress.status;
      if (progress.status === 'SYNCING') {
        progress.status = 'IDLE';
      }
      setTimeout(() => this.progressMap.delete(sourceId), 300000);
      await prisma.mirrorSource
        .update({
          where: { id: sourceId },
          data: { syncStatus: 'IDLE' },
        })
        .catch(() => {});
      if (lockAcquired) {
        await redisService.releaseLock(lockKey).catch(() => {});
      }

      emitToAll('mirror_sync_finished', {
        sourceId,
        sourceName: source?.displayName || '',
        type: 'INCREMENTAL',
        status: prevStatus === 'SYNCING' ? 'SUCCESS' : prevStatus,
        result: prevStatus === 'SYNCING' ? result : null,
      });
    }

    return result;
  }

  isSyncing(sourceId: string): boolean {
    return this.activeSyncs.has(sourceId);
  }

  cancelSync(sourceId: string): void {
    const controller = this.abortControllers.get(sourceId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(sourceId);
    }
    this.activeSyncs.delete(sourceId);
  }

  private async cleanupOrphanedSyncs(): Promise<void> {
    try {
      const syncingSources = await prisma.mirrorSource.findMany({
        where: { syncStatus: 'SYNCING' },
      });

      if (syncingSources.length > 0) {
        logger.info(
          `[MirrorSync] Found ${syncingSources.length} orphaned syncing source(s), resetting to IDLE...`,
        );
        await prisma.mirrorSource.updateMany({
          where: { id: { in: syncingSources.map((s) => s.id) } },
          data: { syncStatus: 'IDLE' },
        });
      }

      const runningLogs = await prisma.syncLog.findMany({
        where: { status: 'RUNNING' },
      });

      if (runningLogs.length > 0) {
        logger.info(
          `[MirrorSync] Found ${runningLogs.length} orphaned running sync log(s), marking as FAILED...`,
        );
        await prisma.syncLog.updateMany({
          where: { id: { in: runningLogs.map((l) => l.id) } },
          data: {
            status: 'FAILED',
            finishedAt: new Date(),
            error: '服务器重启，同步进程被终止',
          },
        });
      }
    } catch (e) {
      logger.error('[MirrorSync] Failed to cleanup orphaned sync states:', e);
    }
  }

  startScheduler(): void {
    if (this.schedulerStarted) return;
    this.schedulerStarted = true;
    this.cleanupOrphanedSyncs()
      .then(() => this.startAllAutoSync())
      .catch((e) => {
        logger.error('Failed to start mirror sync scheduler:', e);
        this.schedulerStarted = false;
      });
  }

  stopScheduler(): void {
    for (const interval of this.schedulerIntervals.values()) {
      clearInterval(interval);
    }
    this.schedulerIntervals.clear();
    this.schedulerStarted = false;
  }

  private async startAllAutoSync(): Promise<void> {
    const sources = await prisma.mirrorSource.findMany({
      where: {
        status: 'ACTIVE',
        adapterType: { not: 'MANUAL' },
      },
    });

    if (sources.length === 0) {
      logger.info('[MirrorSync] No active mirror sources with autoSync enabled, scheduler idle');
      return;
    }

    for (const source of sources) {
      const intervalMs = source.syncInterval * 1000;
      this.scheduleSourceSync(source.id, intervalMs);
    }

    logger.info(`[MirrorSync] Scheduler started for ${sources.length} source(s)`);
  }

  reloadSourceScheduler(sourceId: string, status: string, syncInterval: number): void {
    const existing = this.schedulerIntervals.get(sourceId);
    if (existing) {
      clearInterval(existing);
      this.schedulerIntervals.delete(sourceId);
    }

    if (status !== 'ACTIVE') {
      logger.info(`[MirrorSync] Scheduler removed/skipped for inactive source ${sourceId}`);
      return;
    }

    prisma.mirrorSource
      .findUnique({
        where: { id: sourceId },
        select: { adapterType: true },
      })
      .then((source) => {
        if (!source || source.adapterType === 'MANUAL') {
          logger.info(
            `[MirrorSync] Scheduler removed/skipped for manual or non-existent source ${sourceId}`,
          );
          return;
        }
        const intervalMs = syncInterval * 1000;
        this.scheduleSourceSync(sourceId, intervalMs);
        logger.info(
          `[MirrorSync] Scheduler scheduled/reloaded for source ${sourceId} with interval ${syncInterval}s`,
        );
      })
      .catch((e) => {
        logger.error(`[MirrorSync] Failed to reload scheduler for source ${sourceId}:`, e);
      });
  }

  removeSourceScheduler(sourceId: string): void {
    const existing = this.schedulerIntervals.get(sourceId);
    if (existing) {
      clearInterval(existing);
      this.schedulerIntervals.delete(sourceId);
      logger.info(`[MirrorSync] Scheduler removed for source ${sourceId}`);
    }
  }

  private scheduleSourceSync(sourceId: string, intervalMs: number): void {
    const run = async () => {
      if (this.activeSyncs.has(sourceId)) return;
      try {
        await this.incrementalSync(sourceId);
      } catch (e) {
        logger.error(`Auto sync failed for source ${sourceId}:`, e);
      }
    };

    const interval = setInterval(run, intervalMs);
    this.schedulerIntervals.set(sourceId, interval);
  }
}

export const syncEngine = new SyncEngine();
