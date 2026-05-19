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
      where.categoryId = categoryId;
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
        source: { select: { name: true, displayName: true, baseUrl: true } },
        category: { select: { name: true } },
      },
    });

    if (resource) {
      await prisma.mirrorResource.update({
        where: { id: resourceId },
        data: { viewCount: { increment: 1 } },
      });
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
