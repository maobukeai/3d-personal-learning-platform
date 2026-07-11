import { logger } from '../../utils/logger';
import prisma from '../../services/prisma';
import { QueueService } from '../../services/queue.service';
import type { Prisma } from '@prisma/client';

export class MirrorService {
  async getUserPlanPriority(userId: string): Promise<number> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: { include: { plan: true } } },
    });
    return user?.subscription?.plan?.priority ?? 0;
  }

  async getAccessibleSources(userId: string) {
    const planPriority = await this.getUserPlanPriority(userId);

    const sources = await prisma.mirrorSource.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });

    return sources.map((s) => ({
      ...s,
      hasAccess: planPriority >= s.minPlanPriority,
      minPlanPriority: s.minPlanPriority,
    }));
  }

  async getSource(sourceId: string, userId?: string) {
    const source = await prisma.mirrorSource.findUnique({
      where: { id: sourceId },
      include: {
        _count: { select: { resources: true, categories: true } },
      },
    });

    if (!source) return null;

    let planPriority = 0;
    if (userId) {
      planPriority = await this.getUserPlanPriority(userId);
    }

    return {
      ...source,
      hasAccess: planPriority >= source.minPlanPriority,
      minPlanPriority: source.minPlanPriority,
    };
  }

  async getCategories(sourceId: string) {
    return prisma.mirrorCategory.findMany({
      where: { sourceId },
      orderBy: { order: 'asc' },
    });
  }

  async getResources(
    sourceId: string,
    options: {
      page?: number;
      pageSize?: number;
      categoryId?: string;
      search?: string;
      sort?: string;
    },
  ) {
    const { page = 1, pageSize = 20, categoryId, search, sort = 'newest' } = options;

    const where: Prisma.MirrorResourceWhereInput = { sourceId };

    if (categoryId) {
      const targetCategory = await prisma.mirrorCategory.findUnique({
        where: { id: categoryId },
        select: { externalId: true, sourceId: true },
      });
      if (targetCategory) {
        const childCategories = await prisma.mirrorCategory.findMany({
          where: {
            sourceId: targetCategory.sourceId,
            parentExternalId: targetCategory.externalId,
          },
          select: { id: true },
        });
        const categoryIds = [categoryId, ...childCategories.map((c) => c.id)];
        where.categoryId = { in: categoryIds };
      } else {
        where.categoryId = categoryId;
      }
    }

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
        { tags: { contains: search } },
      ];
    }

    let orderBy: Prisma.MirrorResourceOrderByWithRelationInput = { publishedAt: 'desc' };
    if (sort === 'oldest') orderBy = { publishedAt: 'asc' };
    if (sort === 'title') orderBy = { title: 'asc' };

    const [resources, total] = await Promise.all([
      prisma.mirrorResource.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { category: { select: { name: true } } },
      }),
      prisma.mirrorResource.count({ where }),
    ]);

    return {
      resources,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getResource(resourceId: string) {
    const resource = await prisma.mirrorResource.findUnique({
      where: { id: resourceId },
      include: {
        source: {
          select: {
            id: true,
            name: true,
            displayName: true,
            baseUrl: true,
            adapterType: true,
            syncConfig: true,
          },
        },
        category: { select: { name: true } },
      },
    });

    if (!resource) return null;

    // Increment viewCount — fire-and-forget, do NOT block the response
    prisma.mirrorResource
      .update({ where: { id: resourceId }, data: { viewCount: { increment: 1 } } })
      .catch(() => {});

    // If detail contentHtml is missing, fetch it on-demand.
    // Thumbnail localization is delegated to a background BullMQ job to avoid
    // blocking the HTTP response.
    if (!resource.contentHtml && resource.source.adapterType !== 'MANUAL') {
      try {
        const { getAdapter } = require('../adapters');

        const adapter = getAdapter(resource.source.adapterType, {
          baseUrl: resource.source.baseUrl,
          syncConfig: resource.source.syncConfig
            ? JSON.parse(resource.source.syncConfig)
            : undefined,
        });

        const detail = await adapter.fetchResourceDetail(resource.externalId);
        if (detail) {
          const contentHtml = detail.contentHtml || '';

          // Fire-and-forget: localize thumbnails in the background queue
          await QueueService.enqueue(
            'thumbnail-localize',
            { htmlContent: contentHtml, sourceId: resource.sourceId, mirrorId: resourceId },
            { type: 'thumbnail-localize', idempotencyKey: `thumb-${resource.sourceId}` },
          );

          let tags = resource.tags;
          if (detail.tags && detail.tags.length > 0) {
            tags = JSON.stringify(detail.tags);
          }

          const updated = await prisma.mirrorResource.update({
            where: { id: resourceId },
            data: {
              description: detail.description || resource.description,
              thumbnailUrl: detail.thumbnailUrl || resource.thumbnailUrl,
              tags: tags,
              publishedAt: detail.publishedAt || resource.publishedAt,
              contentHtml: contentHtml,
            },
            include: {
              source: {
                select: {
                  id: true,
                  name: true,
                  displayName: true,
                  baseUrl: true,
                  adapterType: true,
                  syncConfig: true,
                },
              },
              category: { select: { name: true } },
            },
          });
          return updated;
        }
      } catch (e) {
        logger.warn(
          `[MirrorService] Failed to load detail page on-demand for ${resource.externalId}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }

    return resource;
  }

  async getSyncLogs(sourceId: string, limit = 20) {
    return prisma.syncLog.findMany({
      where: { sourceId },
      orderBy: { startedAt: 'desc' },
      take: limit,
    });
  }

  async getSourceStats(sourceId: string) {
    const [source, categoryCount, latestSync] = await Promise.all([
      prisma.mirrorSource.findUnique({ where: { id: sourceId } }),
      prisma.mirrorCategory.count({ where: { sourceId } }),
      prisma.syncLog.findFirst({
        where: { sourceId },
        orderBy: { startedAt: 'desc' },
      }),
    ]);

    return {
      source,
      categoryCount,
      resourceCount: source?.totalResources || 0,
      latestSync,
    };
  }
}

export const mirrorService = new MirrorService();
