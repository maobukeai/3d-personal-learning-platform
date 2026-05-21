import prisma from '../../services/prisma';

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

    const where: any = { sourceId };

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
        const categoryIds = [categoryId, ...childCategories.map(c => c.id)];
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

    let orderBy: any = { publishedAt: 'desc' };
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

    // If detail contentHtml is missing, fetch it on-demand with a timeout guard
    if (!resource.contentHtml && resource.source.adapterType !== 'MANUAL') {
      try {
        const { getAdapter } = require('../adapters');
        const { thumbnailLocalizer } = require('./thumbnail-localizer.service');

        const adapter = getAdapter(resource.source.adapterType, {
          baseUrl: resource.source.baseUrl,
          syncConfig: resource.source.syncConfig
            ? JSON.parse(resource.source.syncConfig)
            : undefined,
        });

        const FETCH_TIMEOUT_MS = 8000;
        const fetchPromise = adapter.fetchResourceDetail(resource.externalId);
        const timeoutPromise = new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error('On-demand fetch timeout')), FETCH_TIMEOUT_MS),
        );

        const detail = await Promise.race([fetchPromise, timeoutPromise]);
        if (detail) {
          const localHtml = await thumbnailLocalizer.localizeHtmlContent(
            detail.contentHtml || '',
            resource.sourceId,
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
              contentHtml: localHtml,
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
      } catch (e: any) {
        console.warn(
          `[MirrorService] Failed to load detail page on-demand for ${resource.externalId}: ${e.message}`,
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
