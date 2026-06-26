import { Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../../services/prisma';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { AppError } from '../../utils/error';
import { logger } from '../../utils/logger';
import { clampLimit, clampPage } from '../../utils/pagination';
import { redisService } from '../../services/redis.service';
import { getZipFileNames } from '../../utils/file';
import {
  tagSearchKey,
  TAG_SEARCH_REDIS_TTL,
  getAssetAccessWhere,
  normalizeAssetTags,
  buildAssetPerformanceReport,
  buildVersionComparison,
  getAssetCollaborationWhere,
} from './helpers';

export const getPublicAssets = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = clampPage(req.query.page);
    const limit = clampLimit(req.query.limit, 12, 50);
    const lite = req.query.lite === 'true';
    const search = req.query.search as string;
    const categoryId = req.query.categoryId as string;
    const sort = req.query.sort as string;
    const skip = (page - 1) * limit;

    const mine = req.query.mine === 'true';
    const favoritesOnly = req.query.favoritesOnly === 'true';
    const status = req.query.status as string;
    const userId = req.userId as string;

    const where: Prisma.AssetWhereInput = mine
      ? {
          userId,
          ...(status && status !== 'all' ? { status } : {}),
        }
      : {
          status: 'APPROVED',
        };

    if (favoritesOnly && userId) {
      where.likesRelation = { some: { userId } };
    }

    if (categoryId && categoryId !== 'all') {
      where.categoryId = categoryId;
    }
    if (search) {
      const trimmed = search.trim();
      if (trimmed) {
        // Fire-and-forget: increment search count in Redis (shared across all instances)
        redisService.incr(tagSearchKey(trimmed), TAG_SEARCH_REDIS_TTL).catch(() => {
          /* non-critical, ignore errors */
        });
      }
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
        { tags: { contains: search } },
      ];
    }

    let orderBy: Prisma.AssetOrderByWithRelationInput = { createdAt: 'desc' };
    if (sort === 'oldest') orderBy = { createdAt: 'asc' };
    if (sort === 'popular') orderBy = { downloads: 'desc' };
    if (sort === 'views') orderBy = { viewCount: 'desc' };
    if (sort === 'size') orderBy = { size: 'desc' };

    let assets: unknown[];
    if (lite) {
      assets = await prisma.asset.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          thumbnail: true,
          type: true,
          size: true,
          createdAt: true,
          category: {
            select: { name: true },
          },
          user: {
            select: { name: true, avatarUrl: true },
          },
        },
      });
    } else {
      assets = await prisma.asset.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          category: true,
          user: {
            select: { name: true, avatarUrl: true },
          },
        },
      });
    }

    const total = await prisma.asset.count({ where });

    res.json({
      assets,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getAssetInsights = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId as string;
    const [assets, categories, likedCount, myUploads, pendingCount] = await Promise.all([
      prisma.asset.findMany({
        where: { status: 'APPROVED' },
        orderBy: { createdAt: 'desc' },
        include: {
          category: true,
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
        take: 500,
      }),
      prisma.category.findMany({
        orderBy: { order: 'asc' },
        include: { _count: { select: { assets: true } } },
      }),
      prisma.assetLike.count({
        where: { userId, asset: { status: 'APPROVED' } },
      }),
      prisma.asset.count({ where: { userId } }),
      prisma.asset.count({ where: { status: 'PENDING', teamId: req.workspaceId } }),
    ]);

    const typeCounts = new Map<string, number>();
    const tagCounts = new Map<string, number>();
    let totalDownloads = 0;
    let totalViews = 0;
    let totalLikes = 0;
    let totalSize = 0;
    let animated = 0;
    let optimized = 0;

    assets.forEach((asset) => {
      totalDownloads += asset.downloads || 0;
      totalViews += asset.viewCount || 0;
      totalLikes += asset.likes || 0;
      totalSize += asset.size || 0;
      if (asset.hasAnimations) animated += 1;
      if ((asset.faces || 0) > 0 && (asset.faces || 0) < 50000) optimized += 1;
      const type = (asset.type || 'UNKNOWN').toUpperCase();
      typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
      normalizeAssetTags(asset.tags).forEach((tag) => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });

    // Read search counts from Redis for the top tags (best-effort, non-blocking)
    const topTagEntries = Array.from(tagCounts.entries());
    const tagSearchCountValues = await Promise.all(
      topTagEntries.map(([label]) =>
        redisService.get<number>(tagSearchKey(label)).then((v) => v ?? 0),
      ),
    );
    const hotTags = topTagEntries
      .map(([label, count], i) => ({
        label,
        count,
        searchCount: tagSearchCountValues[i] ?? 0,
      }))
      .sort((a, b) => b.searchCount - a.searchCount || b.count - a.count)
      .slice(0, 18);

    res.json({
      summary: {
        total: assets.length,
        downloads: totalDownloads,
        views: totalViews,
        likes: totalLikes,
        myLikes: likedCount,
        myUploads,
        pending: pendingCount,
        animated,
        optimized,
        totalSize: Number(totalSize.toFixed(2)),
        averageSize: assets.length ? Number((totalSize / assets.length).toFixed(2)) : 0,
      },
      categories: categories.map((category) => ({
        id: category.id,
        name: category.name,
        count: category._count.assets,
      })),
      formats: Array.from(typeCounts.entries())
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count),
      hotTags,
      topDownloads: [...assets].sort((a, b) => b.downloads - a.downloads).slice(0, 6),
      latest: assets.slice(0, 6),
    });
  } catch (error) {
    next(error);
  }
};

export const getUserAssets = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const assets = await prisma.asset.findMany({
      where: { userId: req.userId as string, teamId: req.workspaceId },
      orderBy: { createdAt: 'desc' },
      include: { category: true },
    });
    res.json(assets);
  } catch (error) {
    next(error);
  }
};

export const getAssetById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  const userId = req.user?.id;
  try {
    const asset = await prisma.asset.findFirst({
      where: getAssetAccessWhere(id, req),
    });

    if (!asset) {
      return next(new AppError('Asset not found', 404));
    }

    // Increment viewCount and retrieve with full relation data
    const updatedAsset = await prisma.asset.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
      include: {
        category: true,
        user: { select: { name: true, avatarUrl: true } },
        linkedCourse: { select: { id: true, title: true } },
        linkedLesson: { select: { id: true, title: true } },
      },
    });

    let isLiked = false;
    if (userId) {
      const existingLike = await prisma.assetLike.findUnique({
        where: {
          assetId_userId: {
            assetId: id,
            userId,
          },
        },
      });
      isLiked = !!existingLike;
    }

    res.json({
      ...updatedAsset,
      isLiked,
      packageFiles: [],
      performanceReport: buildAssetPerformanceReport(updatedAsset),
    });
  } catch (error) {
    next(error);
  }
};

export const getAssetPackageFiles = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  try {
    logger.debug(`[getAssetPackageFiles] Fetching package files for ID: ${id}`);
    const asset = await prisma.asset.findFirst({
      where: getAssetAccessWhere(id, req),
      select: { packageUrl: true, packageFilesList: true },
    });

    logger.debug(`[getAssetPackageFiles] Database query result: ${JSON.stringify(asset)}`);

    if (!asset) {
      logger.debug(`[getAssetPackageFiles] Asset not found for ID: ${id}`);
      return next(new AppError('Asset not found', 404));
    }

    if (!asset.packageUrl) {
      logger.debug('[getAssetPackageFiles] Asset has no packageUrl, returning empty array');
      return res.json({ packageFiles: [] });
    }

    if (asset.packageFilesList) {
      try {
        const files = JSON.parse(asset.packageFilesList);
        if (Array.isArray(files)) {
          logger.debug(
            `[getAssetPackageFiles] Found cached packageFilesList, returning: ${JSON.stringify(files)}`,
          );
          return res.json({ packageFiles: files });
        }
      } catch (_e) {
        logger.warn('[getAssetPackageFiles] JSON parse error on packageFilesList:', _e);
      }
    }

    const packageFiles = await getZipFileNames(asset.packageUrl);

    // Cache to DB for future requests
    if (packageFiles.length > 0) {
      await prisma.asset
        .update({
          where: { id },
          data: { packageFilesList: JSON.stringify(packageFiles) },
        })
          .catch((err) => {
            logger.error(`[Asset] Failed to update packageFilesList fallback for asset ${id}:`, err);
          });
    }

    res.json({ packageFiles });
  } catch (error) {
    next(error);
  }
};

export const getAssetToolkit = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  try {
    const asset = await prisma.asset.findFirst({
      where: getAssetAccessWhere(id, req),
      include: {
        category: true,
        user: { select: { id: true, name: true, avatarUrl: true, role: true } },
        linkedCourse: { select: { id: true, title: true } },
        linkedLesson: { select: { id: true, title: true } },
      },
    });

    if (!asset) {
      return next(new AppError('Asset not found', 404));
    }

    const [versions, annotationCount] = await Promise.all([
      prisma.assetVersion.findMany({
        where: { assetId: id },
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { name: true, avatarUrl: true } },
        },
      }),
      prisma.assetAnnotation.count({ where: { assetId: id } }),
    ]);

    const enrichedVersions = versions.map((version, index) => ({
      ...version,
      performanceReport: buildAssetPerformanceReport(version),
      comparison: buildVersionComparison(version, versions[index + 1]),
    }));

    res.json({
      asset: { ...asset, performanceReport: buildAssetPerformanceReport(asset) },
      versions: enrichedVersions,
      annotationCount,
      canAnnotate: !!(await prisma.asset.findFirst({
        where: getAssetCollaborationWhere(id, req),
        select: { id: true },
      })),
      coverCandidates: [
        asset.thumbnail,
        ...versions.map((version) => version.thumbnail).filter(Boolean),
      ].filter(Boolean),
    });
  } catch (error) {
    next(error);
  }
};

export const getAssetVersions = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  try {
    const asset = await prisma.asset.findFirst({
      where: getAssetAccessWhere(id, req),
      select: { id: true },
    });

    if (!asset) {
      return next(new AppError('Asset not found', 404));
    }

    const versions = await prisma.assetVersion.findMany({
      where: { assetId: id },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true, avatarUrl: true } },
      },
    });
    res.json(
      versions.map((version, index) => ({
        ...version,
        performanceReport: buildAssetPerformanceReport(version),
        comparison: buildVersionComparison(version, versions[index + 1]),
      })),
    );
  } catch (error) {
    next(error);
  }
};

export const getAssetAnnotations = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  try {
    const asset = await prisma.asset.findFirst({
      where: getAssetAccessWhere(id, req),
      select: { id: true },
    });

    if (!asset) {
      return next(new AppError('Asset not found', 404));
    }

    const annotations = await prisma.assetAnnotation.findMany({
      where: { assetId: id },
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { name: true, avatarUrl: true } },
      },
    });
    res.json(annotations);
  } catch (error) {
    next(error);
  }
};

export const getAssetTags = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const assets = await prisma.asset.findMany({
      where: { status: 'APPROVED' },
      select: { tags: true },
    });
    const tagUsageCounts: Record<string, number> = {};
    assets.forEach((asset) => {
      if (asset.tags) {
        try {
          const tags = JSON.parse(asset.tags);
          if (Array.isArray(tags)) {
            tags.forEach((tag) => {
              const trimmed = tag.trim();
              if (trimmed) {
                tagUsageCounts[trimmed] = (tagUsageCounts[trimmed] || 0) + 1;
              }
            });
          }
        } catch (error) {
          logger.warn('[Asset] Failed to parse asset tags for usage statistics', error);
        }
      }
    });

    const allTags = Array.from(new Set([...Object.keys(tagUsageCounts)]));
    // Batch-read search counts from Redis
    const searchCounts = await Promise.all(
      allTags.map((tag) => redisService.get<number>(tagSearchKey(tag)).then((v) => v ?? 0)),
    );
    const result = allTags.map((tag, i) => ({
      label: tag,
      count: tagUsageCounts[tag] || 0,
      searchCount: searchCounts[i] ?? 0,
    }));

    // Sort by searchCount descending, then count descending
    result.sort((a, b) => b.searchCount - a.searchCount || b.count - a.count);

    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getAssetShare = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const assetId = req.params.id as string;
  try {
    const asset = await prisma.asset.findFirst({
      where: req.user?.role === 'ADMIN' ? { id: assetId } : { id: assetId, OR: [{ userId: req.userId }, { teamId: req.workspaceId }] }
    });
    if (!asset) {
      return next(new AppError('Asset not found or access denied', 404));
    }
    const share = await prisma.assetShare.findUnique({
      where: { assetId },
    });
    res.json(share);
  } catch (error) {
    next(error);
  }
};

export const getPublicSharedAsset = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const shareId = req.params.shareId as string;
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const share = await prisma.assetShare.findUnique({
      where: { id: shareId },
      include: {
        asset: {
          include: {
            user: {
              select: { id: true, name: true, avatarUrl: true, bio: true },
            },
            category: true,
          },
        },
      },
    });

    if (!share) {
      return res.status(404).json({ error: '分享链接不存在或已失效' });
    }

    if (share.expiresAt && new Date() > share.expiresAt) {
      return res.status(410).json({ error: '分享链接已过期且失效' });
    }

    // Increment views
    await prisma.asset.update({
      where: { id: share.assetId },
      data: { viewCount: { increment: 1 } },
    });

    // Also get annotations for the model
    const annotations = await prisma.assetAnnotation.findMany({
      where: { assetId: share.assetId },
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { name: true, avatarUrl: true } },
      },
    });

    let packageFiles: string[] = [];
    if (share.asset.packageFilesList) {
      try {
        const files = JSON.parse(share.asset.packageFilesList);
        if (Array.isArray(files)) {
          packageFiles = files;
        }
      } catch (_e) {
        // ignore
      }
    }

    if (packageFiles.length === 0 && share.asset.packageUrl) {
      packageFiles = await getZipFileNames(share.asset.packageUrl);
      if (packageFiles.length > 0) {
        await prisma.asset
          .update({
            where: { id: share.assetId },
            data: { packageFilesList: JSON.stringify(packageFiles) },
          })
          .catch((err) => {
            logger.error(
              '[Asset] Failed to update packageFilesList fallback for shared asset:',
              err,
            );
          });
      }
    }

    res.json({
      shareId: share.id,
      expiresAt: share.expiresAt,
      createdAt: share.createdAt,
      customText: share.customText,
      asset: {
        ...share.asset,
        packageFiles,
      },
      annotations,
    });
  } catch (error) {
    logger.error('Get public shared asset error:', error);
    next(error);
  }
};

export const getAssetComments = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const assetId = req.params.id as string;
  try {
    const asset = await prisma.asset.findFirst({
      where: getAssetAccessWhere(assetId, req),
    });
    if (!asset) {
      return next(new AppError('Asset not found or access denied', 404));
    }
    const comments = await prisma.assetComment.findMany({
      where: { assetId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
    res.json(comments);
  } catch (error) {
    next(error);
  }
};
