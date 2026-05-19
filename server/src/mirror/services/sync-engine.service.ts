import prisma from '../../services/prisma';
import { getAdapter } from '../adapters';
import { thumbnailLocalizer } from './thumbnail-localizer.service';
import { emitToAll } from '../../services/socket.service';

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
  private schedulerIntervals: NodeJS.Timeout[] = [];
  private schedulerStarted = false;

  getProgress(sourceId: string): SyncProgress | null {
    return this.progressMap.get(sourceId) || null;
  }

  async fullSync(sourceId: string): Promise<SyncResult> {
    if (this.activeSyncs.has(sourceId)) {
      throw new Error('同步已在运行中');
    }

    const source = await prisma.mirrorSource.findUnique({ where: { id: sourceId } });
    if (!source) throw new Error('镜像源不存在');

    this.activeSyncs.add(sourceId);
    const controller = new AbortController();
    this.abortControllers.set(sourceId, controller);
    const signal = controller.signal;

    emitToAll('mirror_sync_started', { sourceId, sourceName: source.displayName, type: 'FULL' });

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

    const syncLog = await prisma.syncLog.create({
      data: { sourceId, type: 'FULL', status: 'RUNNING' },
    });

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

      for (let catIdx = 0; catIdx < rawCategories.length; catIdx++) {
        if (signal.aborted) throw new Error('AbortError');
        const rawCat = rawCategories[catIdx]!;
        progress.currentCategory = rawCat.name;
        progress.currentCategoryIndex = catIdx + 1;
        progress.estimatedProgress = Math.round((catIdx / rawCategories.length) * 50);

        const categoryId = categoryMap.get(rawCat.externalId);
        let page = 1;
        let hasMore = true;

        while (hasMore) {
          if (signal.aborted) throw new Error('AbortError');
          progress.currentPage = page;
          const pageResult = await adapter.fetchResources(
            page,
            rawCat.slug || rawCat.externalId,
            signal,
          );
          result.resourcesFound += pageResult.resources.length;
          progress.resourcesFound = result.resourcesFound;

          const batch: any[] = [];

          for (const rawRes of pageResult.resources) {
            if (signal.aborted) throw new Error('AbortError');
            if (seenExternalIds.has(rawRes.externalId)) continue;
            seenExternalIds.add(rawRes.externalId);

            const resCategoryExternalId = rawRes.categoryExternalId || rawCat.externalId;
            const resCategoryId = categoryMap.get(resCategoryExternalId) || categoryId;

            const existing = await prisma.mirrorResource.findUnique({
              where: { sourceId_externalId: { sourceId, externalId: rawRes.externalId } },
            });

            if (existing) {
              if (existing.contentHash !== rawRes.contentHash) {
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
                      categoryId: resCategoryId,
                      syncedAt: new Date(),
                    },
                  }),
                );
                result.resourcesUpdated++;
                newResourceIds.push({
                  id: existing.id,
                  externalId: rawRes.externalId,
                  description: rawRes.description || existing.description,
                  thumbnailUrl: rawRes.thumbnailUrl || existing.thumbnailUrl,
                });
              }
            } else {
              const created = await prisma.mirrorResource.create({
                data: {
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
                },
              });
              result.resourcesCreated++;
              newResourceIds.push({
                id: created.id,
                externalId: created.externalId,
                description: created.description,
                thumbnailUrl: created.thumbnailUrl,
              });
            }
          }

          if (batch.length > 0) {
            await prisma.$transaction(batch);
          }
          progress.resourcesCreated = result.resourcesCreated;
          progress.resourcesUpdated = result.resourcesUpdated;

          hasMore = page < pageResult.totalPages && pageResult.resources.length > 0;
          page++;

          if (hasMore) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        }
      }

      // Phase 3: Fetch details for all new/updated resources
      progress.phase = 'DETAILS';
      progress.totalDetailsToFetch = newResourceIds.length;
      progress.detailsFetched = 0;
      progress.currentCategory = '抓取详情页';
      progress.estimatedProgress = 50;

      const detailBatchSize = 25;
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
              updateData.contentHtml = detail.contentHtml;
            }

            if (Object.keys(updateData).length > 0) {
              await prisma.mirrorResource.update({
                where: { id: resource.id },
                data: updateData,
              });
            }
          }
        } catch (e: any) {
          if (e.name === 'AbortError') throw e;
          console.error(`Failed to fetch detail for ${resource.externalId}:`, e.message);
        }

        progress.detailsFetched++;
        progress.estimatedProgress =
          50 + Math.round((progress.detailsFetched / progress.totalDetailsToFetch) * 50);
      });

      // Phase 4: Localize thumbnails
      if (signal.aborted) throw new Error('AbortError');
      progress.phase = 'DETAILS';
      progress.currentCategory = '本地化缩略图';
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

      progress.estimatedProgress = 100;
    } catch (error: any) {
      const isAborted = error.name === 'AbortError' || error.message === 'AbortError';
      const duration = Math.round((Date.now() - startTime) / 1000);

      await prisma.syncLog.update({
        where: { id: syncLog.id },
        data: {
          status: isAborted ? 'CANCELLED' : 'FAILED',
          finishedAt: new Date(),
          duration,
          error: isAborted ? '用户取消同步' : error.message || '未知错误',
        },
      });

      await prisma.mirrorSource.update({
        where: { id: sourceId },
        data: { syncStatus: isAborted ? 'IDLE' : 'ERROR' },
      });

      progress.status = isAborted ? 'IDLE' : 'ERROR';

      if (!isAborted) throw error;
    } finally {
      this.activeSyncs.delete(sourceId);
      this.abortControllers.delete(sourceId);
      const prevStatus = progress.status;
      if (progress.status === 'SYNCING') {
        progress.status = 'IDLE';
      }
      await prisma.mirrorSource.update({
        where: { id: sourceId },
        data: { syncStatus: 'IDLE' },
      });
      setTimeout(() => this.progressMap.delete(sourceId), 300000);

      emitToAll('mirror_sync_finished', {
        sourceId,
        sourceName: source.displayName,
        type: 'FULL',
        status: prevStatus === 'SYNCING' ? 'SUCCESS' : prevStatus,
        result: prevStatus === 'SYNCING' ? result : null,
      });
    }

    return result;
  }

  async incrementalSync(sourceId: string): Promise<SyncResult> {
    if (this.activeSyncs.has(sourceId)) {
      throw new Error('同步已在运行中');
    }

    const source = await prisma.mirrorSource.findUnique({ where: { id: sourceId } });
    if (!source) throw new Error('镜像源不存在');

    if (!source.lastSyncAt) {
      return this.fullSync(sourceId);
    }

    this.activeSyncs.add(sourceId);
    const controller = new AbortController();
    this.abortControllers.set(sourceId, controller);
    const signal = controller.signal;

    emitToAll('mirror_sync_started', {
      sourceId,
      sourceName: source.displayName,
      type: 'INCREMENTAL',
    });

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

    const syncLog = await prisma.syncLog.create({
      data: { sourceId, type: 'INCREMENTAL', status: 'RUNNING' },
    });

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
      const hasUpdate = await adapter.hasUpdates(source.lastSyncAt, signal);
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
      const updates = await adapter.fetchUpdates(source.lastSyncAt, signal);
      result.resourcesFound = updates.length;
      progress.resourcesFound = updates.length;
      progress.estimatedProgress = 40;

      const categories = await prisma.mirrorCategory.findMany({ where: { sourceId } });
      const categoryMap = new Map(categories.map((c) => [c.externalId, c.id]));

      const newResourceIds: ResourceMinimal[] = [];
      const batch: any[] = [];

      for (const rawRes of updates) {
        if (signal.aborted) throw new Error('AbortError');
        const categoryId = rawRes.categoryExternalId
          ? categoryMap.get(rawRes.categoryExternalId) || null
          : null;

        const existing = await prisma.mirrorResource.findUnique({
          where: { sourceId_externalId: { sourceId, externalId: rawRes.externalId } },
        });

        if (existing) {
          if (existing.contentHash !== rawRes.contentHash) {
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
            newResourceIds.push({
              id: existing.id,
              externalId: rawRes.externalId,
              description: rawRes.description || existing.description,
              thumbnailUrl: rawRes.thumbnailUrl || existing.thumbnailUrl,
            });
          }
        } else {
          const created = await prisma.mirrorResource.create({
            data: {
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
          });
          result.resourcesCreated++;
          newResourceIds.push({
            id: created.id,
            externalId: created.externalId,
            description: created.description,
            thumbnailUrl: created.thumbnailUrl,
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

      const incDetailBatch = 25;
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
              updateData.contentHtml = detail.contentHtml;
            }

            if (Object.keys(updateData).length > 0) {
              await prisma.mirrorResource.update({
                where: { id: resource.id },
                data: updateData,
              });
            }
          }
        } catch (e: any) {
          if (e.name === 'AbortError') throw e;
          console.error(`Failed to fetch detail for ${resource.externalId}:`, e.message);
        }

        progress.detailsFetched++;
        progress.estimatedProgress =
          60 + Math.round((progress.detailsFetched / progress.totalDetailsToFetch) * 30);
      });

      progress.estimatedProgress = 90;

      // Localize thumbnails for new/updated resources
      if (signal.aborted) throw new Error('AbortError');
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

      progress.estimatedProgress = 100;
    } catch (error: any) {
      const isAborted = error.name === 'AbortError' || error.message === 'AbortError';
      const duration = Math.round((Date.now() - startTime) / 1000);

      await prisma.syncLog.update({
        where: { id: syncLog.id },
        data: {
          status: isAborted ? 'CANCELLED' : 'FAILED',
          finishedAt: new Date(),
          duration,
          error: isAborted ? '用户取消同步' : error.message || '未知错误',
        },
      });

      await prisma.mirrorSource.update({
        where: { id: sourceId },
        data: { syncStatus: isAborted ? 'IDLE' : 'ERROR' },
      });

      progress.status = isAborted ? 'IDLE' : 'ERROR';

      if (!isAborted) throw error;
    } finally {
      this.activeSyncs.delete(sourceId);
      this.abortControllers.delete(sourceId);
      const prevStatus = progress.status;
      if (progress.status === 'SYNCING') {
        progress.status = 'IDLE';
      }
      await prisma.mirrorSource.update({
        where: { id: sourceId },
        data: { syncStatus: 'IDLE' },
      });
      setTimeout(() => this.progressMap.delete(sourceId), 300000);

      emitToAll('mirror_sync_finished', {
        sourceId,
        sourceName: source.displayName,
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
        console.log(
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
        console.log(
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
      console.error('[MirrorSync] Failed to cleanup orphaned sync states:', e);
    }
  }

  startScheduler(): void {
    if (this.schedulerStarted) return;
    this.schedulerStarted = true;
    this.cleanupOrphanedSyncs()
      .then(() => this.startAllAutoSync())
      .catch((e) => {
        console.error('Failed to start mirror sync scheduler:', e);
        this.schedulerStarted = false;
      });
  }

  stopScheduler(): void {
    for (const interval of this.schedulerIntervals) {
      clearInterval(interval);
    }
    this.schedulerIntervals = [];
    this.schedulerStarted = false;
  }

  private async startAllAutoSync(): Promise<void> {
    const sources = await prisma.mirrorSource.findMany({
      where: { status: 'ACTIVE' },
    });

    if (sources.length === 0) {
      console.log('[MirrorSync] No active mirror sources with autoSync enabled, scheduler idle');
      return;
    }

    for (const source of sources) {
      const intervalMs = source.syncInterval * 1000;
      this.scheduleSourceSync(source.id, intervalMs);
    }

    console.log(`[MirrorSync] Scheduler started for ${sources.length} source(s)`);
  }

  private scheduleSourceSync(sourceId: string, intervalMs: number): void {
    const run = async () => {
      if (this.activeSyncs.has(sourceId)) return;
      try {
        await this.incrementalSync(sourceId);
      } catch (e: any) {
        console.error(`Auto sync failed for source ${sourceId}:`, e);
      }
    };

    const interval = setInterval(run, intervalMs);
    this.schedulerIntervals.push(interval);
  }
}

export const syncEngine = new SyncEngine();
