import { Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { Prisma } from '@prisma/client';
import prisma from '../services/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { createNotification } from '../utils/notification';
import { deleteCloudOrLocalFileByUrl, getUploadedFileUrl } from '../utils/file';
import { auditService, AuditAction, AuditModule } from '../services/audit.service';
import { AppError } from '../utils/error';
import { awardPoints, deductPoints, PointsAction } from '../services/points.service';
import { parseTags } from '../utils/tags';

type ShowcaseSortKey = 'popular' | 'newest' | 'trending' | 'viewed' | 'discussed' | 'featured';
type ShowcaseScope = 'all' | 'my' | 'liked';
type ShowcaseStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type ShowcaseBucket = 'all' | 'fresh' | 'downloadable' | 'discussed' | 'pending' | 'rejected';

type ShowcaseListItem = Prisma.ShowcaseGetPayload<{
  select: {
    id: true;
    title: true;
    description: true;
    tags: true;
    type: true;
    thumbnailUrl: true;
    images: true;
    videoUrl: true;
    isVideo: true;
    views: true;
    status: true;
    assetId: true;
    createdAt: true;
    user: { select: { id: true; name: true; email: true; avatarUrl: true; bio: true } };
    asset: { select: { id: true; title: true; url: true; type: true; thumbnail: true } };
    linkedAssets: {
      select: {
        id: true;
        title: true;
        url: true;
        type: true;
        thumbnail: true;
        vertices: true;
        faces: true;
        size: true;
        downloads: true;
        likes: true;
        isFree: true;
      };
    };
    linkedMaterials: {
      select: {
        id: true;
        title: true;
        previewUrl: true;
        category: true;
        resolution: true;
        fileSize: true;
        downloads: true;
      };
    };
    linkedPlugins: {
      select: {
        id: true;
        title: true;
        previewUrl: true;
        category: true;
        version: true;
        compatibility: true;
        fileSize: true;
        downloads: true;
      };
    };
    _count: { select: { likes: true; comments: true } };
    likes: { select: { userId: true } };
  };
}>;

const APPROVED_STATUS = 'APPROVED';
const PENDING_STATUS = 'PENDING';
const SHOWCASE_TYPES = new Set(['IMAGE', 'VIDEO', 'MODEL', 'TEXT', 'OTHER']);

const getQueryText = (value: unknown): string => {
  if (Array.isArray(value)) return getQueryText(value[0]);
  return typeof value === 'string' ? value.trim() : '';
};

const parsePositiveInt = (value: unknown, fallback: number, max: number) => {
  const numeric = Number.parseInt(getQueryText(value), 10);
  if (!Number.isFinite(numeric) || numeric < 1) return fallback;
  return Math.min(numeric, max);
};

const normalizeSort = (value: unknown): ShowcaseSortKey => {
  const sort = getQueryText(value).toLowerCase();
  if (['newest', 'latest', '最新'].includes(sort)) return 'newest';
  if (['trending', 'trend', '趋势'].includes(sort)) return 'trending';
  if (['viewed', 'views', '浏览'].includes(sort)) return 'viewed';
  if (['discussed', 'comments', '评论'].includes(sort)) return 'discussed';
  if (['featured', '精选'].includes(sort)) return 'featured';
  return 'popular';
};

const normalizeType = (value: unknown) => {
  const type = getQueryText(value).toUpperCase();
  return SHOWCASE_TYPES.has(type) ? type : 'all';
};

const normalizeScope = (value: unknown): ShowcaseScope => {
  const scope = getQueryText(value).toLowerCase();
  if (scope === 'my') return 'my';
  if (scope === 'liked') return 'liked';
  return 'all';
};

const normalizeBucket = (value: unknown): ShowcaseBucket => {
  const bucket = getQueryText(value).toLowerCase();
  if (['fresh', 'week', 'weekly', '本周'].includes(bucket)) return 'fresh';
  if (['downloadable', 'asset', 'download', '可下载'].includes(bucket)) return 'downloadable';
  if (['discussed', 'comments', 'commented', '有讨论'].includes(bucket)) return 'discussed';
  if (['pending', 'review', '审核中'].includes(bucket)) return 'pending';
  if (['rejected', '驳回'].includes(bucket)) return 'rejected';
  return 'all';
};

const parseImages = (images?: string | null): string[] => {
  if (!images) return [];
  try {
    const parsed = JSON.parse(images);
    return Array.isArray(parsed) ? parsed.map((url) => String(url)).filter(Boolean) : [];
  } catch {
    return [];
  }
};

const getShowcaseAccessWhere = (id: string, req: AuthRequest): Prisma.ShowcaseWhereInput => {
  const or: Prisma.ShowcaseWhereInput[] = [{ status: APPROVED_STATUS }];
  if (req.userId) or.push({ userId: req.userId });
  if (req.user?.role === 'ADMIN') or.push({});
  return { id, OR: or };
};

const getShowcaseScore = (
  item: { views: number; likesCount: number; commentsCount: number; createdAt: Date },
  sort: ShowcaseSortKey,
) => {
  const ageHours = Math.max(1, (Date.now() - item.createdAt.getTime()) / 36e5);
  const recencyBoost = Math.max(0, 168 - ageHours) / 8;
  const baseScore = item.likesCount * 5 + item.commentsCount * 7 + item.views * 0.35;
  if (sort === 'featured') return baseScore + item.likesCount * 3 + item.views * 0.2;
  return baseScore + recencyBoost;
};

const formatShowcaseListItem = (showcase: ShowcaseListItem, userId: string) => ({
  id: showcase.id,
  title: showcase.title,
  description: showcase.description,
  tags: showcase.tags,
  type: showcase.type,
  thumbnailUrl: showcase.thumbnailUrl,
  images: showcase.images,
  videoUrl: showcase.videoUrl,
  isVideo: showcase.isVideo,
  views: showcase.views,
  status: showcase.status,
  assetId: showcase.assetId,
  asset: showcase.asset,
  linkedAssets: showcase.linkedAssets || [],
  linkedMaterials: showcase.linkedMaterials || [],
  linkedPlugins: showcase.linkedPlugins || [],
  createdAt: showcase.createdAt,
  user: showcase.user,
  isLiked: showcase.likes?.some((like: { userId: string }) => like.userId === userId) ?? false,
  likesCount: showcase._count?.likes ?? 0,
  commentsCount: showcase._count?.comments ?? 0,
});

export const getAllShowcases = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId as string;
    const sort = normalizeSort(req.query.sort || req.query.filter);
    const type = normalizeType(req.query.type);
    const scope = normalizeScope(req.query.scope);
    const bucket = normalizeBucket(req.query.bucket || req.query.segment);
    const search = getQueryText(req.query.q || req.query.search || req.query.keyword);
    const page = parsePositiveInt(req.query.page, 1, 500);
    const limit = parsePositiveInt(req.query.limit, 48, 100);
    const skip = (page - 1) * limit;
    const withMeta = ['true', '1', 'yes'].includes(getQueryText(req.query.withMeta).toLowerCase());
    const sinceWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    let orderBy: Prisma.ShowcaseOrderByWithRelationInput[] = [{ createdAt: 'desc' }];
    if (sort === 'popular') {
      orderBy = [{ likes: { _count: 'desc' } }, { views: 'desc' }, { createdAt: 'desc' }];
    } else if (sort === 'viewed') {
      orderBy = [{ views: 'desc' }, { createdAt: 'desc' }];
    } else if (sort === 'discussed') {
      orderBy = [{ comments: { _count: 'desc' } }, { createdAt: 'desc' }];
    }

    const where: Prisma.ShowcaseWhereInput =
      scope === 'my' ? { userId } : { status: APPROVED_STATUS };
    if (type !== 'all') {
      where.type = type;
    }
    if (scope === 'liked') {
      where.likes = { some: { userId } };
    }
    if (bucket === 'fresh') {
      where.createdAt = { gte: sinceWeek };
    } else if (bucket === 'downloadable') {
      where.assetId = { not: null };
    } else if (bucket === 'discussed') {
      where.comments = { some: {} };
    } else if (bucket === 'pending') {
      where.userId = userId;
      where.status = PENDING_STATUS;
    } else if (bucket === 'rejected') {
      where.userId = userId;
      where.status = 'REJECTED';
    }
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
        { tags: { contains: search } },
        { user: { is: { name: { contains: search } } } },
        { user: { is: { email: { contains: search } } } },
      ];
    }

    const shouldRankInMemory = sort === 'trending' || sort === 'featured';
    const rankedTake = Math.min(Math.max(skip + limit, 120), 500);
    const [total, showcases] = await Promise.all([
      prisma.showcase.count({ where }),
      prisma.showcase.findMany({
        where,
        select: {
          id: true,
          title: true,
          description: true,
          tags: true,
          type: true,
          thumbnailUrl: true,
          images: true,
          videoUrl: true,
          isVideo: true,
          views: true,
          status: true,
          assetId: true,
          createdAt: true,
          user: {
            select: { id: true, name: true, email: true, avatarUrl: true, bio: true },
          },
          asset: {
            select: { id: true, title: true, url: true, type: true, thumbnail: true },
          },
          linkedAssets: {
            select: {
              id: true,
              title: true,
              url: true,
              type: true,
              thumbnail: true,
              vertices: true,
              faces: true,
              size: true,
              downloads: true,
              likes: true,
              isFree: true,
            },
          },
          linkedMaterials: {
            select: {
              id: true,
              title: true,
              previewUrl: true,
              category: true,
              resolution: true,
              fileSize: true,
              downloads: true,
            },
          },
          linkedPlugins: {
            select: {
              id: true,
              title: true,
              previewUrl: true,
              category: true,
              version: true,
              compatibility: true,
              fileSize: true,
              downloads: true,
            },
          },
          _count: {
            select: { likes: true, comments: true },
          },
          likes: {
            where: { userId },
            select: { userId: true },
          },
        },
        orderBy,
        skip: shouldRankInMemory ? 0 : skip,
        take: shouldRankInMemory ? rankedTake : limit,
      }),
    ]);

    let formatted = showcases.map((s) => formatShowcaseListItem(s, userId));
    if (shouldRankInMemory) {
      formatted = formatted
        .sort((a, b) => getShowcaseScore(b, sort) - getShowcaseScore(a, sort))
        .slice(skip, skip + limit);
    }

    if (withMeta) {
      res.json({
        items: formatted,
        meta: {
          page,
          limit,
          total,
          hasMore: skip + formatted.length < total,
          sort,
          type,
          scope,
          bucket,
          search,
        },
      });
      return;
    }

    res.json(formatted);
  } catch (error) {
    next(error);
  }
};

export const getShowcaseStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId as string;
    const now = Date.now();
    const sinceToday = new Date(new Date().setHours(0, 0, 0, 0));
    const sinceWeek = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const baseWhere: Prisma.ShowcaseWhereInput = { status: APPROVED_STATUS };

    const [
      totalWorks,
      viewAggregate,
      totalLikes,
      totalComments,
      todayWorks,
      weekWorks,
      myWorks,
      myLikes,
      myStatusGroups,
      downloadableWorks,
      discussedWorks,
      typeGroups,
      tagRows,
      creatorRows,
      activityRows,
    ] = await Promise.all([
      prisma.showcase.count({ where: baseWhere }),
      prisma.showcase.aggregate({ where: baseWhere, _sum: { views: true } }),
      prisma.showcaseLike.count({ where: { showcase: baseWhere } }),
      prisma.showcaseComment.count({ where: { showcase: baseWhere } }),
      prisma.showcase.count({ where: { ...baseWhere, createdAt: { gte: sinceToday } } }),
      prisma.showcase.count({ where: { ...baseWhere, createdAt: { gte: sinceWeek } } }),
      prisma.showcase.count({ where: { userId } }),
      prisma.showcaseLike.count({ where: { userId, showcase: baseWhere } }),
      prisma.showcase.groupBy({
        by: ['status'],
        where: { userId },
        _count: { _all: true },
      }),
      prisma.showcase.count({ where: { ...baseWhere, assetId: { not: null } } }),
      prisma.showcase.count({ where: { ...baseWhere, comments: { some: {} } } }),
      prisma.showcase.groupBy({
        by: ['type'],
        where: baseWhere,
        _count: { _all: true },
        _sum: { views: true },
      }),
      prisma.showcase.findMany({
        where: baseWhere,
        select: { tags: true },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
      prisma.showcase.findMany({
        where: baseWhere,
        select: {
          views: true,
          user: { select: { id: true, name: true, email: true, avatarUrl: true, bio: true } },
          _count: { select: { likes: true, comments: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 250,
      }),
      prisma.showcaseComment.findMany({
        where: { showcase: baseWhere },
        select: {
          id: true,
          content: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true, avatarUrl: true } },
          showcase: {
            select: { id: true, title: true, type: true, thumbnailUrl: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
    ]);

    const tagUsage = new Map<string, number>();
    tagRows.forEach((row) => {
      parseTags(row.tags).forEach((tag) => {
        tagUsage.set(tag, (tagUsage.get(tag) ?? 0) + 1);
      });
    });

    const creatorUsage = new Map<
      string,
      {
        id: string;
        name: string | null;
        email: string;
        avatarUrl: string | null;
        bio: string | null;
        works: number;
        likes: number;
        comments: number;
        views: number;
        score: number;
      }
    >();
    creatorRows.forEach((row) => {
      const existing = creatorUsage.get(row.user.id) ?? {
        id: row.user.id,
        name: row.user.name,
        email: row.user.email,
        avatarUrl: row.user.avatarUrl,
        bio: row.user.bio,
        works: 0,
        likes: 0,
        comments: 0,
        views: 0,
        score: 0,
      };
      existing.works += 1;
      existing.likes += row._count.likes;
      existing.comments += row._count.comments;
      existing.views += row.views;
      existing.score += row._count.likes * 5 + row._count.comments * 7 + row.views * 0.3;
      creatorUsage.set(row.user.id, existing);
    });

    res.json({
      totalWorks,
      totalViews: viewAggregate._sum.views ?? 0,
      totalLikes,
      totalComments,
      todayWorks,
      weekWorks,
      myWorks,
      myLikes,
      downloadableWorks,
      discussedWorks,
      myPendingWorks:
        myStatusGroups.find((group) => group.status === PENDING_STATUS)?._count._all ?? 0,
      myRejectedWorks:
        myStatusGroups.find((group) => group.status === 'REJECTED')?._count._all ?? 0,
      statusBreakdown: myStatusGroups.map((group) => ({
        status: group.status as ShowcaseStatus,
        count: group._count._all,
      })),
      typeBreakdown: typeGroups.map((group) => ({
        type: group.type,
        count: group._count._all,
        views: group._sum.views ?? 0,
      })),
      topTags: Array.from(tagUsage.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 12),
      topCreators: Array.from(creatorUsage.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, 8),
      recentActivity: activityRows.map((activity) => ({
        id: activity.id,
        content: activity.content,
        createdAt: activity.createdAt,
        user: activity.user,
        showcase: activity.showcase,
      })),
    });
  } catch (error) {
    next(error);
  }
};

export const getShowcaseById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  try {
    const showcase = await prisma.showcase.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true, bio: true },
        },
        asset: {
          select: { id: true, title: true, url: true, type: true, thumbnail: true },
        },
        linkedAssets: {
          select: {
            id: true,
            title: true,
            url: true,
            type: true,
            thumbnail: true,
            vertices: true,
            faces: true,
            size: true,
            downloads: true,
            likes: true,
            isFree: true,
          },
        },
        linkedMaterials: {
          select: {
            id: true,
            title: true,
            previewUrl: true,
            category: true,
            resolution: true,
            fileSize: true,
            downloads: true,
          },
        },
        linkedPlugins: {
          select: {
            id: true,
            title: true,
            previewUrl: true,
            category: true,
            version: true,
            compatibility: true,
            fileSize: true,
            downloads: true,
          },
        },
        _count: {
          select: { likes: true, comments: true },
        },
        likes: {
          where: { userId: req.userId as string },
        },
      },
    });

    if (!showcase) {
      return next(new AppError('Work not found', 404));
    }

    const canViewPrivate =
      showcase.status === APPROVED_STATUS ||
      showcase.userId === req.userId ||
      req.user?.role === 'ADMIN';
    if (!canViewPrivate) {
      return next(new AppError('Work not found', 404));
    }

    await prisma.showcase.update({
      where: { id },
      data: { views: { increment: 1 } },
    });

    res.json({
      ...showcase,
      isLiked: showcase.likes.length > 0,
      likesCount: showcase._count.likes,
      commentsCount: showcase._count.comments,
      views: showcase.views + 1,
    });
  } catch (error) {
    next(error);
  }
};

export const getRelatedShowcases = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  const userId = req.userId as string;

  try {
    const source = await prisma.showcase.findUnique({
      where: { id },
      select: { id: true, type: true, tags: true, status: true, userId: true },
    });

    if (!source) {
      return next(new AppError('Work not found', 404));
    }

    const canViewPrivate =
      source.status === APPROVED_STATUS || source.userId === userId || req.user?.role === 'ADMIN';
    if (!canViewPrivate) {
      return next(new AppError('Work not found', 404));
    }

    const tags = parseTags(source.tags).slice(0, 8);
    const tagConditions = tags.map((tag) => ({ tags: { contains: tag } }));

    const rows = await prisma.showcase.findMany({
      where: {
        id: { not: id },
        status: APPROVED_STATUS,
        OR: [{ type: source.type }, ...tagConditions],
      },
      select: {
        id: true,
        title: true,
        description: true,
        tags: true,
        type: true,
        thumbnailUrl: true,
        images: true,
        videoUrl: true,
        isVideo: true,
        views: true,
        status: true,
        assetId: true,
        createdAt: true,
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true, bio: true },
        },
        asset: {
          select: { id: true, title: true, url: true, type: true, thumbnail: true },
        },
        linkedAssets: {
          select: {
            id: true,
            title: true,
            url: true,
            type: true,
            thumbnail: true,
            vertices: true,
            faces: true,
            size: true,
            downloads: true,
            likes: true,
            isFree: true,
          },
        },
        linkedMaterials: {
          select: {
            id: true,
            title: true,
            previewUrl: true,
            category: true,
            resolution: true,
            fileSize: true,
            downloads: true,
          },
        },
        linkedPlugins: {
          select: {
            id: true,
            title: true,
            previewUrl: true,
            category: true,
            version: true,
            compatibility: true,
            fileSize: true,
            downloads: true,
          },
        },
        _count: {
          select: { likes: true, comments: true },
        },
        likes: {
          where: { userId },
          select: { userId: true },
        },
      },
      orderBy: [{ views: 'desc' }, { createdAt: 'desc' }],
      take: 18,
    });

    const formatted = rows
      .map((item) => {
        const itemTags = new Set(parseTags(item.tags));
        const tagScore = tags.filter((tag) => itemTags.has(tag)).length;
        const typeScore = item.type === source.type ? 2 : 0;
        return {
          item: formatShowcaseListItem(item, userId),
          score: tagScore * 3 + typeScore + item._count.likes + item._count.comments,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((entry) => entry.item);

    res.json(formatted);
  } catch (error) {
    next(error);
  }
};

export const getMyShowcases = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const showcases = await prisma.showcase.findMany({
      where: { userId: req.userId as string },
      include: {
        _count: {
          select: { likes: true, comments: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(showcases);
  } catch (error) {
    next(error);
  }
};

export const createShowcase = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const thumbnailFile = files?.thumbnail?.[0];
    const imageFiles = files?.images || [];

    const {
      title,
      description,
      tags,
      videoUrl,
      isVideo,
      type,
      assetId,
      linkedAssetIds,
      linkedMaterialIds,
      linkedPluginIds,
    } = req.body;

    if (!title || !title.trim()) {
      return next(new AppError('标题不能为空', 400));
    }

    let assetIdsArr: string[] = [];
    if (linkedAssetIds) {
      try {
        const parsed = JSON.parse(linkedAssetIds);
        if (Array.isArray(parsed)) {
          assetIdsArr = parsed.map(String).filter(Boolean);
        }
      } catch {
        if (typeof linkedAssetIds === 'string') {
          assetIdsArr = linkedAssetIds
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        }
      }
    }

    let materialIdsArr: string[] = [];
    if (linkedMaterialIds) {
      try {
        const parsed = JSON.parse(linkedMaterialIds);
        if (Array.isArray(parsed)) {
          materialIdsArr = parsed.map(String).filter(Boolean);
        }
      } catch {
        if (typeof linkedMaterialIds === 'string') {
          materialIdsArr = linkedMaterialIds
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        }
      }
    }

    let pluginIdsArr: string[] = [];
    if (linkedPluginIds) {
      try {
        const parsed = JSON.parse(linkedPluginIds);
        if (Array.isArray(parsed)) {
          pluginIdsArr = parsed.map(String).filter(Boolean);
        }
      } catch {
        if (typeof linkedPluginIds === 'string') {
          pluginIdsArr = linkedPluginIds
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        }
      }
    }

    let finalAssetId = assetId || null;
    if (!finalAssetId && assetIdsArr.length > 0) {
      finalAssetId = assetIdsArr[0];
    }
    if (finalAssetId && !assetIdsArr.includes(finalAssetId)) {
      assetIdsArr.unshift(finalAssetId);
    }

    let showcaseType = type || 'IMAGE';
    if (finalAssetId && !type) {
      showcaseType = 'MODEL';
    }
    if (isVideo === 'true' && !type) {
      showcaseType = 'VIDEO';
    }

    let thumbnailUrl = '';
    if (thumbnailFile) {
      thumbnailUrl = getUploadedFileUrl(req, thumbnailFile, 'showcase');
    } else if (finalAssetId) {
      const asset = await prisma.asset.findUnique({
        where: { id: finalAssetId as string },
      });
      if (asset?.thumbnail) {
        thumbnailUrl = asset.thumbnail;
      }
    }

    if (!thumbnailUrl && showcaseType !== 'TEXT') {
      return next(new AppError('Thumbnail is required', 400));
    }

    const imageUrls = imageFiles.map((f) => getUploadedFileUrl(req, f, 'showcase'));

    const showcase = await prisma.showcase.create({
      data: {
        title,
        description: description || null,
        tags: tags || null,
        type: showcaseType,
        thumbnailUrl: thumbnailUrl || '',
        images: imageUrls.length > 0 ? JSON.stringify(imageUrls) : null,
        videoUrl: videoUrl || null,
        isVideo: isVideo === 'true',
        assetId: finalAssetId,
        userId: req.userId as string,
        teamId: req.workspaceId,
        status: req.user?.role === 'ADMIN' ? APPROVED_STATUS : PENDING_STATUS,
        linkedAssets:
          assetIdsArr.length > 0
            ? {
                connect: assetIdsArr.map((id) => ({ id })),
              }
            : undefined,
        linkedMaterials:
          materialIdsArr.length > 0
            ? {
                connect: materialIdsArr.map((id) => ({ id })),
              }
            : undefined,
        linkedPlugins:
          pluginIdsArr.length > 0
            ? {
                connect: pluginIdsArr.map((id) => ({ id })),
              }
            : undefined,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        asset: {
          select: { id: true, title: true, url: true, type: true, thumbnail: true },
        },
        linkedAssets: {
          select: {
            id: true,
            title: true,
            url: true,
            type: true,
            thumbnail: true,
            vertices: true,
            faces: true,
            size: true,
            downloads: true,
            likes: true,
            isFree: true,
          },
        },
        linkedMaterials: {
          select: {
            id: true,
            title: true,
            previewUrl: true,
            category: true,
            resolution: true,
            fileSize: true,
            downloads: true,
          },
        },
        linkedPlugins: {
          select: {
            id: true,
            title: true,
            previewUrl: true,
            category: true,
            version: true,
            compatibility: true,
            fileSize: true,
            downloads: true,
          },
        },
      },
    });

    await auditService.log({
      userId: req.userId as string,
      action: AuditAction.CREATE_SHOWCASE,
      module: AuditModule.SHOWCASE,
      description: `Created showcase: ${showcase.title}`,
      newValue: showcase,
      req,
    });

    await awardPoints(req.userId as string, PointsAction.PUBLISH_SHOWCASE);

    res.status(201).json(showcase);
  } catch (error) {
    next(error);
  }
};

export const publishAssetToShowcase = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const { assetId } = req.body;
  const { title, description, tags } = req.body;

  if (!assetId) {
    return next(new AppError('Asset ID is required', 400));
  }

  try {
    const asset = await prisma.asset.findFirst({
      where: {
        id: assetId,
        userId: req.userId as string,
      },
    });

    if (!asset) {
      return next(new AppError('Asset not found or access denied', 404));
    }

    const existingShowcase = await prisma.showcase.findFirst({
      where: { assetId },
    });
    if (existingShowcase) {
      return next(new AppError('该作品已发布到展示墙', 400));
    }

    const showcase = await prisma.showcase.create({
      data: {
        title: title || asset.title,
        description: description || asset.description || null,
        tags: tags || null,
        type: 'MODEL',
        thumbnailUrl:
          asset.thumbnail || `${req.protocol}://${req.get('host')}/uploads/assets/placeholder.png`,
        assetId: asset.id,
        isVideo: false,
        userId: req.userId as string,
        teamId: req.workspaceId || asset.teamId,
        status: req.user?.role === 'ADMIN' ? APPROVED_STATUS : PENDING_STATUS,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        asset: {
          select: { id: true, title: true, url: true, type: true, thumbnail: true },
        },
      },
    });

    await auditService.log({
      userId: req.userId as string,
      action: AuditAction.CREATE_SHOWCASE,
      module: AuditModule.SHOWCASE,
      description: `Published asset to showcase: ${showcase.title}`,
      newValue: showcase,
      req,
    });

    await awardPoints(req.userId as string, PointsAction.PUBLISH_SHOWCASE);

    res.status(201).json(showcase);
  } catch (error) {
    next(error);
  }
};

export const updateShowcase = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  try {
    const showcase = await prisma.showcase.findUnique({
      where: { id },
    });

    if (!showcase) {
      return next(new AppError('Work not found', 404));
    }

    if (showcase.userId !== req.userId && req.user?.role !== 'ADMIN') {
      return next(new AppError('Forbidden', 403));
    }

    const {
      title,
      description,
      tags,
      videoUrl,
      isVideo,
      type,
      linkedAssetIds,
      linkedMaterialIds,
      linkedPluginIds,
    } = req.body;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const thumbnailFile = files?.thumbnail?.[0];
    const imageFiles = files?.images || [];

    const updateData: Prisma.ShowcaseUpdateInput = {};
    if (title !== undefined) {
      if (!String(title).trim()) {
        return next(new AppError('标题不能为空', 400));
      }
      updateData.title = String(title).trim();
    }
    if (description !== undefined) updateData.description = description;
    if (tags !== undefined) updateData.tags = tags;
    if (videoUrl !== undefined) updateData.videoUrl = videoUrl;
    if (isVideo !== undefined) updateData.isVideo = isVideo === 'true';
    if (type !== undefined) {
      const nextType = String(type).toUpperCase();
      if (!SHOWCASE_TYPES.has(nextType)) {
        return next(new AppError('不支持的作品类型', 400));
      }
      updateData.type = nextType;
    }
    if (showcase.userId === req.userId && req.user?.role !== 'ADMIN') {
      updateData.status = PENDING_STATUS;
    }
    if (thumbnailFile) {
      // Delete old thumbnail (run in background)
      if (showcase.thumbnailUrl) {
        deleteCloudOrLocalFileByUrl(showcase.thumbnailUrl).catch((err) => {
          logger.error('[ShowcaseController] Failed to delete old thumbnail in background:', err);
        });
      }
      updateData.thumbnailUrl = getUploadedFileUrl(req, thumbnailFile, 'showcase');
    }
    if (imageFiles.length > 0) {
      const imageUrls = imageFiles.map((f) => getUploadedFileUrl(req, f, 'showcase'));
      const existingImages = parseImages(showcase.images);
      updateData.images = JSON.stringify([...existingImages, ...imageUrls]);
    }

    if (linkedAssetIds !== undefined) {
      let assetIdsArr: string[] = [];
      if (linkedAssetIds) {
        try {
          const parsed = JSON.parse(linkedAssetIds);
          if (Array.isArray(parsed)) {
            assetIdsArr = parsed.map(String).filter(Boolean);
          }
        } catch {
          if (typeof linkedAssetIds === 'string') {
            assetIdsArr = linkedAssetIds
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);
          }
        }
      }
      updateData.linkedAssets = {
        set: assetIdsArr.map((id) => ({ id })),
      };
      if (assetIdsArr.length > 0) {
        updateData.asset = { connect: { id: assetIdsArr[0] } };
      } else {
        updateData.asset = { disconnect: true };
      }
    }

    if (linkedMaterialIds !== undefined) {
      let materialIdsArr: string[] = [];
      if (linkedMaterialIds) {
        try {
          const parsed = JSON.parse(linkedMaterialIds);
          if (Array.isArray(parsed)) {
            materialIdsArr = parsed.map(String).filter(Boolean);
          }
        } catch {
          if (typeof linkedMaterialIds === 'string') {
            materialIdsArr = linkedMaterialIds
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);
          }
        }
      }
      updateData.linkedMaterials = {
        set: materialIdsArr.map((id) => ({ id })),
      };
    }

    if (linkedPluginIds !== undefined) {
      let pluginIdsArr: string[] = [];
      if (linkedPluginIds) {
        try {
          const parsed = JSON.parse(linkedPluginIds);
          if (Array.isArray(parsed)) {
            pluginIdsArr = parsed.map(String).filter(Boolean);
          }
        } catch {
          if (typeof linkedPluginIds === 'string') {
            pluginIdsArr = linkedPluginIds
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);
          }
        }
      }
      updateData.linkedPlugins = {
        set: pluginIdsArr.map((id) => ({ id })),
      };
    }

    const updated = await prisma.showcase.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true, bio: true },
        },
        asset: {
          select: { id: true, title: true, url: true, type: true, thumbnail: true },
        },
        linkedAssets: {
          select: {
            id: true,
            title: true,
            url: true,
            type: true,
            thumbnail: true,
            vertices: true,
            faces: true,
            size: true,
            downloads: true,
            likes: true,
            isFree: true,
          },
        },
        linkedMaterials: {
          select: {
            id: true,
            title: true,
            previewUrl: true,
            category: true,
            resolution: true,
            fileSize: true,
            downloads: true,
          },
        },
        linkedPlugins: {
          select: {
            id: true,
            title: true,
            previewUrl: true,
            category: true,
            version: true,
            compatibility: true,
            fileSize: true,
            downloads: true,
          },
        },
        _count: {
          select: { likes: true, comments: true },
        },
        likes: {
          where: { userId: req.userId as string },
          select: { userId: true },
        },
      },
    });

    await auditService.log({
      userId: req.userId as string,
      action: AuditAction.UPDATE_SHOWCASE, // Updated to standard action name matching audit system if needed, or keeping REJECT_SHOWCASE/generic
      module: AuditModule.SHOWCASE,
      description: `Updated showcase: ${updated.title}`,
      oldValue: showcase,
      newValue: updated,
      req,
    });

    res.json(formatShowcaseListItem(updated, req.userId as string));
  } catch (error) {
    next(error);
  }
};

export const deleteShowcase = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  try {
    const showcase = await prisma.showcase.findUnique({
      where: { id },
    });

    if (!showcase) {
      return next(new AppError('Work not found', 404));
    }

    if (showcase.userId !== req.userId && req.user?.role !== 'ADMIN') {
      return next(new AppError('Forbidden', 403));
    }

    // Delete files (run in background)
    if (showcase.thumbnailUrl) {
      deleteCloudOrLocalFileByUrl(showcase.thumbnailUrl).catch((err) => {
        logger.error(
          '[ShowcaseController] Failed to delete showcase thumbnail in background:',
          err,
        );
      });
    }
    if (showcase.images) {
      const images = parseImages(showcase.images);
      for (const url of images) {
        deleteCloudOrLocalFileByUrl(url).catch((err) => {
          logger.error(
            `[ShowcaseController] Failed to delete showcase image ${url} in background:`,
            err,
          );
        });
      }
    }

    await prisma.showcase.delete({
      where: { id },
    });

    await deductPoints(showcase.userId, PointsAction.PUBLISH_SHOWCASE);

    await auditService.log({
      userId: req.userId as string,
      action: AuditAction.DELETE_SHOWCASE,
      module: AuditModule.SHOWCASE,
      description: `Deleted showcase: ${showcase.title}`,
      oldValue: showcase,
      req,
    });

    res.json({ message: 'Deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const toggleLike = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  const userId = req.userId as string;
  try {
    const showcase = await prisma.showcase.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!showcase || showcase.status !== APPROVED_STATUS) {
      return next(new AppError('Work not found', 404));
    }

    const existing = await prisma.showcaseLike.findUnique({
      where: { showcaseId_userId: { showcaseId: id, userId } },
    });

    if (existing) {
      await prisma.showcaseLike.delete({
        where: { id: existing.id },
      });
      await deductPoints(userId, PointsAction.LIKE_CONTENT);
      const likesCount = await prisma.showcaseLike.count({ where: { showcaseId: id } });
      res.json({ liked: false, likesCount });
    } else {
      const like = await prisma.showcaseLike.create({
        data: { showcaseId: id, userId },
        include: {
          showcase: { select: { userId: true, title: true } },
        },
      });

      if (like.showcase.userId !== userId) {
        await createNotification({
          type: 'SYSTEM',
          title: '收到新的点赞',
          content: `${req.user?.name || '有人'} 点赞了你的作品: ${like.showcase.title}`,
          userId: like.showcase.userId,
          link: '/showcase',
          category: 'MENTION',
        });
      }

      await awardPoints(userId, PointsAction.LIKE_CONTENT);

      const likesCount = await prisma.showcaseLike.count({ where: { showcaseId: id } });
      res.json({ liked: true, likesCount });
    }
  } catch (error) {
    next(error);
  }
};

export const getComments = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  try {
    const showcase = await prisma.showcase.findFirst({
      where: getShowcaseAccessWhere(id, req),
      select: { id: true },
    });
    if (!showcase) {
      return next(new AppError('Work not found', 404));
    }

    const comments = await prisma.showcaseComment.findMany({
      where: { showcaseId: id },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true, bio: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(comments);
  } catch (error) {
    next(error);
  }
};

export const addComment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  const { content } = req.body;
  if (!content || !content.trim()) {
    return next(new AppError('Comment content is required', 400));
  }
  try {
    const showcase = await prisma.showcase.findFirst({
      where: getShowcaseAccessWhere(id, req),
      select: { id: true, userId: true, title: true },
    });
    if (!showcase) {
      return next(new AppError('Work not found', 404));
    }

    const comment = await prisma.showcaseComment.create({
      data: {
        content: content.trim(),
        showcaseId: id,
        userId: req.userId as string,
      },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true, bio: true } },
      },
    });

    if (showcase.userId !== req.userId) {
      await createNotification({
        type: 'REPLY',
        title: '作品收到新评论',
        content: `${req.user?.name || '有人'} 评论了你的作品: ${showcase.title}`,
        userId: showcase.userId,
        link: '/showcase',
        category: 'MENTION',
      });
    }

    await awardPoints(req.userId as string, PointsAction.CREATE_COMMENT);
    res.status(201).json(comment);
  } catch (error) {
    next(error);
  }
};

export const deleteComment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const commentId = req.params.commentId as string;
  try {
    const comment = await prisma.showcaseComment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      return next(new AppError('Comment not found', 404));
    }

    if (comment.userId !== req.userId && req.user?.role !== 'ADMIN') {
      return next(new AppError('Forbidden', 403));
    }

    await prisma.showcaseComment.delete({
      where: { id: commentId },
    });

    await deductPoints(comment.userId, PointsAction.CREATE_COMMENT);

    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    next(error);
  }
};
