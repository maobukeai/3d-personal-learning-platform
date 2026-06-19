import { logger } from '../utils/logger';
import { decryptSecretIfNeeded } from '../utils/crypto';
import { Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../services/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { emitToAll } from '../services/socket.service';
import { createNotification } from '../utils/notification';
import fs from 'fs';
import path from 'path';
import { process3DAsset } from '../utils/asset-processor';
import { checkAssetQuota, checkStorageQuota } from '../utils/quota';
import { deleteCloudOrLocalFileByUrl } from '../utils/file';
import { auditService, AuditAction, AuditModule } from '../services/audit.service';
import { AppError } from '../utils/error';
import { clampLimit, clampPage } from '../utils/pagination';
import { redisService } from '../services/redis.service';
import { storageService } from '../services/storage.service';
import { UploadedFile } from '../types/upload';

const TAG_SEARCH_REDIS_TTL = 7 * 24 * 3600; // 7 days
const tagSearchKey = (tag: string) => `asset_tag_search:${tag}`;

const splitTagText = (value: string): string[] =>
  value
    .split(/[,，;；\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);

const normalizeAssetTags = (tags: unknown): string[] => {
  if (!tags) return [];
  if (Array.isArray(tags)) {
    return tags.map((tag) => String(tag).trim()).filter(Boolean);
  }
  if (typeof tags !== 'string') return [];

  try {
    const parsed = JSON.parse(tags);
    if (Array.isArray(parsed)) {
      return parsed.map((tag) => String(tag).trim()).filter(Boolean);
    }
  } catch (_error) {
    // Fall through to delimiter parsing.
  }

  return splitTagText(tags);
};

type PerformanceTone = 'pass' | 'notice' | 'warning' | 'danger';

type AssetPerformanceSource = {
  size?: number | null;
  vertices?: number | null;
  faces?: number | null;
  materials?: number | null;
  animations?: number | null;
  hasAnimations?: boolean | null;
  dimensions?: string | null;
  maxTextureRes?: number | null;
};

const toFiniteNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseDimensions = (dimensions?: string | null) => {
  if (!dimensions) return [];
  const matches = dimensions.match(/-?\d+(?:\.\d+)?/g) || [];
  return matches.map((item) => Number(item)).filter((item) => Number.isFinite(item));
};

const createRiskItem = (
  metric: string,
  label: string,
  value: number,
  unit: string,
  tone: PerformanceTone,
  message: string,
  recommendation: string,
) => ({
  metric,
  label,
  value,
  unit,
  tone,
  message,
  recommendation,
});

const buildAssetPerformanceReport = (asset: AssetPerformanceSource) => {
  const faces = toFiniteNumber(asset.faces);
  const vertices = toFiniteNumber(asset.vertices);
  const materials = toFiniteNumber(asset.materials);
  const size = toFiniteNumber(asset.size);
  const maxTextureRes = toFiniteNumber(asset.maxTextureRes);
  const dimensions = parseDimensions(asset.dimensions);
  const maxDimension = dimensions.length ? Math.max(...dimensions) : 0;
  const riskItems = [];

  if (!faces && !vertices && !maxTextureRes) {
    riskItems.push(
      createRiskItem(
        'metadata',
        '解析完整度',
        0,
        '',
        'notice',
        '模型关键指标尚未完整解析',
        '等待后台解析完成，或上传 GLB/GLTF 以获得更准确的检测结果。',
      ),
    );
  }

  let faceTone: PerformanceTone = 'pass';
  if (faces > 250000) faceTone = 'danger';
  else if (faces > 120000) faceTone = 'warning';
  else if (faces > 60000) faceTone = 'notice';
  riskItems.push(
    createRiskItem(
      'faces',
      '面数',
      faces,
      'faces',
      faceTone,
      faceTone === 'pass' ? '面数适合网页实时预览' : '面数偏高，移动端和低端 GPU 压力会明显增加',
      '保留主轮廓，使用 Decimate/LOD 拆分移动端版本。',
    ),
  );

  let textureTone: PerformanceTone = 'pass';
  if (maxTextureRes > 4096) textureTone = 'danger';
  else if (maxTextureRes > 2048) textureTone = 'warning';
  else if (maxTextureRes > 1024) textureTone = 'notice';
  riskItems.push(
    createRiskItem(
      'texture',
      '最大贴图',
      maxTextureRes,
      'px',
      textureTone,
      textureTone === 'pass' ? '贴图尺寸处于安全范围' : '贴图过大，首屏加载和显存占用风险较高',
      '网页展示建议压缩到 2K 以内，移动端优先 1K/2K 分档。',
    ),
  );

  let sizeTone: PerformanceTone = 'pass';
  if (size > 250) sizeTone = 'danger';
  else if (size > 120) sizeTone = 'warning';
  else if (size > 60) sizeTone = 'notice';
  riskItems.push(
    createRiskItem(
      'size',
      '文件体积',
      size,
      'MB',
      sizeTone,
      sizeTone === 'pass' ? '文件体积适合在线分发' : '文件体积偏大，下载与预览等待时间会变长',
      '压缩纹理、移除未使用材质，并开启 Draco/Meshopt 压缩。',
    ),
  );

  let materialTone: PerformanceTone = 'pass';
  if (materials > 80) materialTone = 'danger';
  else if (materials > 40) materialTone = 'warning';
  else if (materials > 20) materialTone = 'notice';
  riskItems.push(
    createRiskItem(
      'materials',
      '材质数量',
      materials,
      '',
      materialTone,
      materialTone === 'pass' ? '材质数量可控' : '材质数量偏多，Draw Call 和贴图绑定成本较高',
      '合并相近材质，使用图集或统一 PBR 材质模板。',
    ),
  );

  if (maxDimension > 1000) {
    riskItems.push(
      createRiskItem(
        'dimensions',
        '空间尺寸',
        maxDimension,
        '',
        'notice',
        '模型尺寸跨度较大，导入不同 DCC/引擎时可能需要单位校正',
        '发布前确认单位制和原点位置，必要时提供厘米/米两套说明。',
      ),
    );
  }

  const penalties: Record<PerformanceTone, number> = {
    pass: 0,
    notice: 8,
    warning: 18,
    danger: 30,
  };
  const score = Math.max(
    0,
    100 - riskItems.reduce((total, item) => total + penalties[item.tone], 0),
  );
  const worstTone = riskItems.some((item) => item.tone === 'danger')
    ? 'danger'
    : riskItems.some((item) => item.tone === 'warning')
      ? 'warning'
      : riskItems.some((item) => item.tone === 'notice')
        ? 'notice'
        : 'pass';

  return {
    score,
    level: worstTone,
    mobileRisk:
      worstTone === 'danger'
        ? 'high'
        : worstTone === 'warning'
          ? 'medium'
          : worstTone === 'notice'
            ? 'low'
            : 'safe',
    summary:
      worstTone === 'pass'
        ? '适合网页和移动端预览'
        : worstTone === 'notice'
          ? '可上线，但建议准备移动端轻量版本'
          : worstTone === 'warning'
            ? '建议优化后再进入正式发布'
            : '高风险资产，正式发布前需要减面和压缩贴图',
    metrics: {
      faces,
      vertices,
      materials,
      size,
      maxTextureRes,
      animations: toFiniteNumber(asset.animations),
      hasAnimations: !!asset.hasAnimations,
      dimensions: asset.dimensions || '',
    },
    risks: riskItems,
  };
};

const buildVersionComparison = (
  current: AssetPerformanceSource,
  previous?: AssetPerformanceSource | null,
) => {
  if (!previous) return null;
  const compareMetric = (key: keyof AssetPerformanceSource) => {
    const currentValue = toFiniteNumber(current[key]);
    const previousValue = toFiniteNumber(previous[key]);
    return {
      current: currentValue,
      previous: previousValue,
      delta: Number((currentValue - previousValue).toFixed(2)),
    };
  };

  return {
    size: compareMetric('size'),
    faces: compareMetric('faces'),
    materials: compareMetric('materials'),
    maxTextureRes: compareMetric('maxTextureRes'),
  };
};

const getAssetAccessWhere = (id: string, req: AuthRequest): Prisma.AssetWhereInput => {
  const userId = req.userId as string | undefined;
  const workspaceId = req.workspaceId;
  const or: Prisma.AssetWhereInput[] = [{ status: 'APPROVED' }];
  if (workspaceId) or.push({ teamId: workspaceId });
  if (userId) or.push({ userId });
  if (req.user?.role === 'ADMIN') or.push({});
  return { id, OR: or };
};

const getAssetCollaborationWhere = (id: string, req: AuthRequest): Prisma.AssetWhereInput => {
  const userId = req.userId as string | undefined;
  const workspaceId = req.workspaceId;
  const or: Prisma.AssetWhereInput[] = [];
  if (workspaceId) or.push({ teamId: workspaceId });
  if (userId) or.push({ userId });
  if (req.user?.role === 'ADMIN') or.push({});
  return { id, OR: or.length > 0 ? or : [{ id: '__no_access__' }] };
};

export const uploadAsset = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId as string;
    const workspaceId = req.workspaceId;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const assetFile = files?.asset?.[0];
    const externalUrl = req.body.externalUrl;

    if (!assetFile && !externalUrl) {
      return next(new AppError('No asset file or external link provided', 400));
    }

    // Check quotas with workspace context
    const assetQuota = await checkAssetQuota(userId, workspaceId);
    if (!assetQuota.allowed) {
      return next(new AppError(assetQuota.message || 'Asset quota exceeded', 403));
    }

    const fileSizeMB = assetFile ? parseFloat((assetFile.size / (1024 * 1024)).toFixed(2)) : 0;
    const storageQuota = await checkStorageQuota(userId, fileSizeMB, workspaceId);
    if (!storageQuota.allowed) {
      return next(new AppError(storageQuota.message || 'Storage quota exceeded', 403));
    }

    const { title, description, categoryId, formats, tags } = req.body;
    if (!categoryId) {
      return next(new AppError('Category is required', 400));
    }

    let url = externalUrl;
    let type = 'LINK';
    let size = fileSizeMB;

    if (assetFile) {
      const assetsDir = path.join(__dirname, '../../uploads/assets');
      if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true });
      }
      url =
        (assetFile as UploadedFile).url ||
        `${req.protocol}://${req.get('host')}/uploads/assets/${assetFile.filename}`;
      type = path.extname(assetFile.originalname).slice(1).toUpperCase();
    }

    let thumbnailUrl = null;
    if (files?.thumbnail?.[0]) {
      thumbnailUrl =
        (files.thumbnail[0] as UploadedFile).url ||
        `${req.protocol}://${req.get('host')}/uploads/assets/${files.thumbnail[0].filename}`;
    }

    let parsedFormats = formats;
    if (typeof formats === 'string') {
      try {
        parsedFormats = JSON.parse(formats);
      } catch (_e) {
        // fallback
      }
    }

    const parsedTags = normalizeAssetTags(tags);

    const asset = await prisma.asset.create({
      data: {
        title: title || (assetFile ? assetFile.originalname : 'External Link'),
        description,
        url,
        thumbnail: thumbnailUrl,
        type,
        size,
        categoryId,
        userId,
        teamId: workspaceId,
        formats: parsedFormats ? JSON.stringify(parsedFormats) : null,
        tags: parsedTags.length > 0 ? JSON.stringify(parsedTags) : null,
      },
      include: { category: true },
    });

    // Respond immediately to the user
    res.status(201).json(asset);

    // Process 3D metadata asynchronously in the background
    if (assetFile && (type === 'GLB' || type === 'GLTF')) {
      const fullPath = path.join(__dirname, '../../uploads/assets', assetFile.filename);

      // We don't await this, letting it run in the background
      process3DAsset(fullPath)
        .then(async (metadata) => {
          if (metadata) {
            await prisma.asset.update({
              where: { id: asset.id },
              data: { ...metadata },
            });
            logger.info(`[AssetProcessor] Background processing completed for asset: ${asset.id}`);
          } else {
            logger.error(
              `[AssetProcessor] Background processing returned null for asset: ${asset.id}. Keeping asset without metadata.`,
            );
          }
        })
        .catch((err) => {
          logger.error(`[AssetProcessor] Background processing error for asset: ${asset.id}:`, err);
        })
        .finally(() => {
          if ((assetFile as UploadedFile).url && fs.existsSync(fullPath)) {
            try {
              fs.unlinkSync(fullPath);
            } catch (cleanupErr) {
              logger.error('[AssetProcessor] Failed to clean up temp file:', cleanupErr);
            }
          }
        });
    }

    await auditService.log({
      userId,
      action: AuditAction.CREATE_ASSET,
      module: AuditModule.ASSET,
      description: `Uploaded asset: ${asset.title}`,
      newValue: asset,
      req,
    });

    // Broadcast activity
    emitToAll('new_activity', {
      id: `a-${asset.id}`,
      user: req.user?.name || '有人',
      action: '发布了新资产',
      target: asset.title,
      createdAt: asset.createdAt,
    });
  } catch (error) {
    next(error);
  }
};

export const updateAsset = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  const { title, description, categoryId, formats, tags } = req.body;

  try {
    const existingAsset = await prisma.asset.findFirst({
      where: { id, teamId: req.workspaceId },
    });

    if (!existingAsset) {
      return next(new AppError('Asset not found or access denied', 404));
    }

    const updateData: Prisma.AssetUncheckedUpdateInput = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (categoryId !== undefined) updateData.categoryId = categoryId;
    if (formats !== undefined) {
      let parsedFormats = formats;
      if (typeof formats === 'string') {
        try {
          parsedFormats = JSON.parse(formats);
        } catch (_e) {
          // fallback
        }
      }
      updateData.formats = parsedFormats ? JSON.stringify(parsedFormats) : null;
    }
    if (tags !== undefined) {
      const parsedTags = normalizeAssetTags(tags);
      updateData.tags = parsedTags.length > 0 ? JSON.stringify(parsedTags) : null;
    }
    if (existingAsset.userId === req.userId && req.user?.role !== 'ADMIN') {
      updateData.status = 'PENDING';
      updateData.rejectReason = null;
    }

    const asset = await prisma.asset.update({
      where: { id },
      data: updateData,
      include: { category: true },
    });

    await auditService.log({
      userId: req.userId as string,
      action: AuditAction.UPDATE_ASSET,
      module: AuditModule.ASSET,
      description: `Updated asset: ${asset.title}`,
      oldValue: existingAsset,
      newValue: asset,
      req,
    });

    res.json(asset);
  } catch (error) {
    next(error);
  }
};

export const updateAssetMetadata = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  const { vertices, faces, materials, animations, hasAnimations, dimensions, maxTextureRes } =
    req.body;

  try {
    // Verify ownership or workspace context
    const existingAsset = await prisma.asset.findFirst({
      where: {
        id,
        OR: [{ userId: req.userId as string }, { teamId: req.workspaceId }],
      },
    });

    if (!existingAsset) {
      return next(new AppError('Asset not found or access denied in this workspace', 404));
    }

    const updateData: Prisma.AssetUpdateInput = {};

    if (vertices !== undefined) updateData.vertices = parseInt(vertices, 10);
    if (faces !== undefined) updateData.faces = parseInt(faces, 10);
    if (materials !== undefined) updateData.materials = parseInt(materials, 10);
    if (animations !== undefined) updateData.animations = parseInt(animations, 10);
    if (maxTextureRes !== undefined) updateData.maxTextureRes = parseInt(maxTextureRes, 10);
    if (hasAnimations !== undefined) {
      updateData.hasAnimations = hasAnimations === true || hasAnimations === 'true';
    }
    if (dimensions !== undefined) updateData.dimensions = dimensions;

    const asset = await prisma.asset.update({
      where: { id },
      data: updateData,
    });
    res.json({ ...asset, performanceReport: buildAssetPerformanceReport(asset) });
  } catch (error) {
    next(error);
  }
};

export const updateAssetThumbnail = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  const { thumbnail } = req.body; // Expecting base64 string

  if (!thumbnail) {
    return next(new AppError('No thumbnail provided', 400));
  }

  try {
    // Verify ownership or workspace context
    const existingAsset = await prisma.asset.findFirst({
      where: {
        id,
        OR: [{ userId: req.userId as string }, { teamId: req.workspaceId }],
      },
    });

    if (!existingAsset) {
      return next(new AppError('Asset not found or access denied in this workspace', 404));
    }

    const assetsDir = path.join(__dirname, '../../uploads/assets');
    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
    }

    // Convert base64 to file
    const base64Data = thumbnail.replace(/^data:image\/png;base64,/, '');
    const fileName = `thumb-${id}-${Date.now()}.png`;
    const filePath = path.join(assetsDir, fileName);

    fs.writeFileSync(filePath, base64Data, 'base64');

    let thumbnailUrl = `${req.protocol}://${req.get('host')}/uploads/assets/${fileName}`;

    // Upload generated thumbnail to R2 if active storage is set up: prioritize ASSET over ALL fallback
    let activeConfigs = await prisma.storageConfig.findMany({
      where: {
        status: 'ACTIVE',
        assetType: 'ASSET',
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    if (activeConfigs.length === 0) {
      activeConfigs = await prisma.storageConfig.findMany({
        where: {
          status: 'ACTIVE',
          assetType: 'ALL',
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      });
    }

    if (activeConfigs.length > 0) {
      try {
        const stats = fs.statSync(filePath);
        const fileBytes = stats.size;

        for (const config of activeConfigs) {
          const limitBytes = config.limitGb * 1024 * 1024 * 1024;
          const updateResult = await prisma.storageConfig.updateMany({
            where: {
              id: config.id,
              status: 'ACTIVE',
              usedBytes: { lte: limitBytes - fileBytes },
            },
            data: {
              usedBytes: { increment: fileBytes },
            },
          });

          if (updateResult.count > 0) {
            try {
              const key = `thumbnail/thumb-${id}-${Date.now()}.png`;
              const r2Url = await storageService.uploadFile(
                {
                  endpoint: config.endpoint,
                  accessKeyId: config.accessKeyId,
                  secretAccessKey: decryptSecretIfNeeded(config.secretAccessKey),
                  bucketName: config.bucketName,
                  publicUrl: config.publicUrl,
                },
                filePath,
                key,
                'image/png',
              );
              thumbnailUrl = r2Url;
              fs.unlinkSync(filePath);
              break;
            } catch (uploadError) {
              logger.error(
                '[AssetController] Failed to upload screenshot thumbnail to R2:',
                uploadError,
              );
              // Revert space
              await prisma.storageConfig.update({
                where: { id: config.id },
                data: { usedBytes: { decrement: fileBytes } },
              });
            }
          }
        }
      } catch (err) {
        logger.error('[AssetController] screenshot upload stats error:', err);
      }
    }

    // Delete old thumbnail if it was a local or cloud file (run in background)
    if (existingAsset.thumbnail) {
      deleteCloudOrLocalFileByUrl(existingAsset.thumbnail).catch((err) => {
        logger.error('[AssetController] Failed to delete old thumbnail in background:', err);
      });
    }

    const asset = await prisma.asset.update({
      where: { id },
      data: { thumbnail: thumbnailUrl },
    });

    res.json(asset);
  } catch (error) {
    next(error);
  }
};

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
          teamId: req.workspaceId,
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
      prisma.asset.count({ where: { userId, teamId: req.workspaceId } }),
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
      },
    });

    res.json({ ...updatedAsset, performanceReport: buildAssetPerformanceReport(updatedAsset) });
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

export const recordAssetDownload = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  const userId = req.userId || 'anonymous';
  const lockKey = `asset_download:${id}:${userId}`;
  try {
    const accessibleAsset = await prisma.asset.findFirst({
      where: getAssetAccessWhere(id, req),
      select: { id: true, downloads: true },
    });
    if (!accessibleAsset) {
      return next(new AppError('Asset not found', 404));
    }

    const alreadyDownloaded = await redisService.get<boolean>(lockKey);
    let downloads = accessibleAsset.downloads;
    if (alreadyDownloaded) {
      downloads = accessibleAsset.downloads;
    } else {
      const asset = await prisma.asset.update({
        where: { id },
        data: { downloads: { increment: 1 } },
        select: { downloads: true },
      });
      downloads = asset.downloads;
      await redisService.set(lockKey, true, 86400); // Lock for 24h
    }
    res.json({ message: 'Download recorded', downloads });
  } catch (error) {
    next(error);
  }
};

export const toggleAssetLike = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  const userId = req.userId;
  if (!userId) {
    return next(new AppError('Unauthorized', 401));
  }
  try {
    const asset = await prisma.asset.findFirst({
      where: { id, status: 'APPROVED' },
      select: { id: true },
    });

    if (!asset) {
      return next(new AppError('Asset not found', 404));
    }

    const result = await prisma.$transaction(async (tx) => {
      const existingLike = await tx.assetLike.findUnique({
        where: {
          assetId_userId: {
            assetId: id,
            userId,
          },
        },
      });

      const liked = !existingLike;
      if (existingLike) {
        await tx.assetLike.delete({
          where: {
            id: existingLike.id,
          },
        });
      } else {
        await tx.assetLike.create({
          data: {
            assetId: id,
            userId,
          },
        });
      }

      const likes = await tx.assetLike.count({ where: { assetId: id } });
      await tx.asset.update({
        where: { id },
        data: { likes },
      });

      return { liked, likes };
    });

    res.json({
      message: result.liked ? 'Like recorded' : 'Like removed',
      likes: result.likes,
      liked: result.liked,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteAsset = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  try {
    const asset = await prisma.asset.findFirst({
      where: { id, teamId: req.workspaceId },
    });

    if (!asset) {
      return next(new AppError('Asset not found', 404));
    }

    // Auth check: asset owner, team owner/admin, or platform admin
    if (asset.userId !== req.userId && req.user?.role !== 'ADMIN') {
      const membership = await prisma.teamMember.findFirst({
        where: { teamId: req.workspaceId, userId: req.userId },
      });
      if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
        return next(new AppError('Not authorized to delete this asset', 403));
      }
    }

    // Delete files from disk or cloud (run in background)
    deleteCloudOrLocalFileByUrl(asset.url).catch((err) => {
      logger.error(
        `[AssetController] Failed to delete asset file ${asset.url} in background:`,
        err,
      );
    });
    if (asset.thumbnail) {
      deleteCloudOrLocalFileByUrl(asset.thumbnail).catch((err) => {
        logger.error(
          `[AssetController] Failed to delete asset thumbnail ${asset.thumbnail} in background:`,
          err,
        );
      });
    }

    await prisma.asset.delete({
      where: { id },
    });

    await auditService.log({
      userId: req.userId as string,
      action: AuditAction.DELETE_ASSET,
      module: AuditModule.ASSET,
      description: `Deleted asset: ${asset.title}`,
      oldValue: asset,
      req,
    });

    res.json({ message: 'Asset deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const getAllAssetsForAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { status, search, page: pageQuery, limit: limitQuery, response } = req.query;
  try {
    const q = typeof search === 'string' ? search.trim() : '';
    const normalizedStatus = typeof status === 'string' && status !== 'ALL' ? status : undefined;
    const page = clampPage(pageQuery);
    const limit = clampLimit(limitQuery, 36, 100);
    const usePaginatedResponse = response === 'paginated' || Boolean(pageQuery || limitQuery || q);
    const baseWhere: Prisma.AssetWhereInput = q
      ? {
          OR: [
            { title: { contains: q } },
            { description: { contains: q } },
            { tags: { contains: q } },
            { type: { contains: q } },
            { user: { name: { contains: q } } },
            { user: { email: { contains: q } } },
            { category: { name: { contains: q } } },
          ],
        }
      : {};
    const where: Prisma.AssetWhereInput = normalizedStatus
      ? { ...baseWhere, status: normalizedStatus }
      : baseWhere;
    const assets = await prisma.asset.findMany({
      where,
      include: {
        user: {
          select: { name: true, email: true, avatarUrl: true },
        },
        category: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      ...(usePaginatedResponse ? { skip: (page - 1) * limit, take: limit } : {}),
    });

    const normalizedAssets = assets.map(({ category, ...asset }) => ({
      ...asset,
      category: category?.name || null,
    }));

    if (!usePaginatedResponse) {
      res.json(normalizedAssets);
      return;
    }

    const [total, statusSummary] = await Promise.all([
      prisma.asset.count({ where }),
      prisma.asset.groupBy({ by: ['status'], where: baseWhere, _count: { _all: true } }),
    ]);

    const statusCounts = Object.fromEntries(
      statusSummary.map((item) => [item.status, item._count._all]),
    );

    res.json({
      items: normalizedAssets,
      total,
      page,
      pageSize: limit,
      pages: Math.max(1, Math.ceil(total / limit)),
      stats: {
        total: statusSummary.reduce((sum, item) => sum + item._count._all, 0),
        pending: statusCounts.PENDING || 0,
        approved: statusCounts.APPROVED || 0,
        rejected: statusCounts.REJECTED || 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateAssetStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  const { status, rejectReason } = req.body;

  if (!['APPROVED', 'REJECTED'].includes(status)) {
    return next(new AppError('Invalid status', 400));
  }

  try {
    const updateData: Prisma.AssetUpdateInput = { status };
    if (status === 'REJECTED' && rejectReason) {
      updateData.rejectReason = rejectReason;
    }
    if (status === 'APPROVED') {
      updateData.rejectReason = null;
    }

    const oldAsset = await prisma.asset.findUnique({ where: { id } });
    if (!oldAsset) return next(new AppError('Asset not found', 404));

    const asset = await prisma.asset.update({
      where: { id },
      data: updateData,
    });

    await auditService.log({
      userId: req.userId as string,
      action: status === 'APPROVED' ? AuditAction.APPROVE_ASSET : AuditAction.REJECT_ASSET,
      module: AuditModule.ASSET,
      description: `管理员${status === 'APPROVED' ? '批准' : '拒绝'}了资产: ${asset.title}`,
      oldValue: { status: oldAsset.status },
      newValue: { status, rejectReason },
      req,
    });

    await createNotification({
      type: 'SYSTEM',
      title: status === 'APPROVED' ? '资产审核通过' : '资产审核未通过',
      content:
        status === 'REJECTED' && rejectReason
          ? `你上传的资产 "${asset.title}" 未通过审核，原因：${rejectReason}`
          : `你上传的资产 "${asset.title}" 已被管理员${status === 'APPROVED' ? '批准' : '拒绝'}。`,
      userId: asset.userId,
      link: '/assets',
      category: 'SYSTEM',
    });

    res.json(asset);
  } catch (error) {
    next(error);
  }
};

export const batchUpdateAssetStatus = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const { ids, status, rejectReason } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return next(new AppError('请选择至少一个资产', 400));
  }

  if (!['APPROVED', 'REJECTED'].includes(status)) {
    return next(new AppError('Invalid status', 400));
  }

  try {
    const updateData: Prisma.AssetUpdateManyMutationInput = { status };
    if (status === 'REJECTED' && rejectReason) {
      updateData.rejectReason = rejectReason;
    }
    if (status === 'APPROVED') {
      updateData.rejectReason = null;
    }

    const result = await prisma.asset.updateMany({
      where: { id: { in: ids } },
      data: updateData,
    });

    const assets = await prisma.asset.findMany({
      where: { id: { in: ids } },
      select: { id: true, title: true, userId: true },
    });

    for (const asset of assets) {
      await createNotification({
        type: 'SYSTEM',
        title: status === 'APPROVED' ? '资产审核通过' : '资产审核未通过',
        content:
          status === 'REJECTED' && rejectReason
            ? `你上传的资产 "${asset.title}" 未通过审核，原因：${rejectReason}`
            : `你上传的资产 "${asset.title}" 已被管理员${status === 'APPROVED' ? '批准' : '拒绝'}。`,
        userId: asset.userId,
        link: '/assets',
        category: 'SYSTEM',
      });
    }

    await auditService.log({
      userId: req.userId as string,
      action: status === 'APPROVED' ? AuditAction.APPROVE_ASSET : AuditAction.REJECT_ASSET,
      module: AuditModule.ASSET,
      description: `管理员批量${status === 'APPROVED' ? '批准' : '拒绝'}了 ${result.count} 个资产`,
      newValue: { ids, status, rejectReason },
      req,
    });

    res.json({ message: `成功更新 ${result.count} 个资产状态`, count: result.count });
  } catch (error) {
    next(error);
  }
};

export const adminUpdateAsset = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  const { title, description, status, categoryId, formats, tags } = req.body;

  try {
    const oldAsset = await prisma.asset.findUnique({ where: { id } });
    if (!oldAsset) return next(new AppError('Asset not found', 404));

    const updateData: Prisma.AssetUncheckedUpdateInput = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) updateData.status = status;
    if (categoryId !== undefined) updateData.categoryId = categoryId;
    if (formats !== undefined) {
      updateData.formats = formats ? JSON.stringify(formats) : null;
    }
    if (tags !== undefined) {
      updateData.tags = typeof tags === 'string' ? tags : JSON.stringify(tags);
    }

    const asset = await prisma.asset.update({
      where: { id },
      data: updateData,
    });

    await auditService.log({
      userId: req.userId as string,
      action: AuditAction.UPDATE_ASSET,
      module: AuditModule.ASSET,
      description: `管理员更新了资产: ${asset.title}`,
      oldValue: oldAsset,
      newValue: asset,
      req,
    });

    res.json(asset);
  } catch (error) {
    next(error);
  }
};

export const adminDeleteAsset = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  try {
    const asset = await prisma.asset.findUnique({ where: { id } });
    if (!asset) {
      return next(new AppError('Asset not found', 404));
    }

    // Delete files from disk or cloud if they exist (run in background)
    deleteCloudOrLocalFileByUrl(asset.url).catch((err) => {
      logger.error(
        `[AssetController] Failed to delete asset file ${asset.url} in background:`,
        err,
      );
    });
    if (asset.thumbnail) {
      deleteCloudOrLocalFileByUrl(asset.thumbnail).catch((err) => {
        logger.error(
          `[AssetController] Failed to delete asset thumbnail ${asset.thumbnail} in background:`,
          err,
        );
      });
    }

    await prisma.asset.delete({ where: { id } });

    await auditService.log({
      userId: req.userId as string,
      action: AuditAction.DELETE_ASSET,
      module: AuditModule.ASSET,
      description: `管理员删除了资产: ${asset.title}`,
      oldValue: asset,
      req,
    });

    res.json({ message: 'Asset deleted successfully by admin' });
  } catch (error) {
    next(error);
  }
};

export const uploadAssetVersion = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  try {
    const userId = req.userId as string;
    const workspaceId = req.workspaceId;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const assetFile = files?.asset?.[0];
    const { changeLog } = req.body;

    if (!assetFile) {
      return next(new AppError('No asset file provided for this version', 400));
    }

    const existingAsset = await prisma.asset.findFirst({
      where: { id, teamId: workspaceId },
    });

    if (!existingAsset) {
      if (fs.existsSync(assetFile.path)) fs.unlinkSync(assetFile.path);
      return next(new AppError('Asset not found or access denied', 404));
    }

    const fileSizeMB = parseFloat((assetFile.size / (1024 * 1024)).toFixed(2));
    const storageQuota = await checkStorageQuota(userId, fileSizeMB, workspaceId);
    if (!storageQuota.allowed) {
      if (fs.existsSync(assetFile.path)) fs.unlinkSync(assetFile.path);
      return next(new AppError(storageQuota.message || 'Storage quota exceeded', 403));
    }

    const url =
      (assetFile as UploadedFile).url ||
      `${req.protocol}://${req.get('host')}/uploads/assets/${assetFile.filename}`;
    const type = path.extname(assetFile.originalname).slice(1).toUpperCase();

    // Check if same type
    if (type !== existingAsset.type) {
      if (fs.existsSync(assetFile.path)) fs.unlinkSync(assetFile.path);
      return next(
        new AppError(`File type must match the original asset type (${existingAsset.type})`, 400),
      );
    }

    // Count versions to set version tag
    const versionCount = await prisma.assetVersion.count({ where: { assetId: id } });
    const versionTag = `v${versionCount + 1}`;

    const newVersion = await prisma.assetVersion.create({
      data: {
        assetId: id,
        version: versionTag,
        url,
        size: fileSizeMB,
        changeLog: changeLog || 'Uploaded new version',
        userId,
      },
    });

    res.status(201).json(newVersion);

    // Process 3D metadata in background
    if (type === 'GLB' || type === 'GLTF') {
      const fullPath = path.join(__dirname, '../../uploads/assets', assetFile.filename);
      process3DAsset(fullPath)
        .then(async (metadata) => {
          if (metadata) {
            // Update version metadata
            await prisma.assetVersion.update({
              where: { id: newVersion.id },
              data: { ...metadata },
            });
            // Update parent asset to latest version info
            await prisma.asset.update({
              where: { id },
              data: {
                url, // Update active url
                size: fileSizeMB,
                ...metadata,
              },
            });
            logger.info(
              `[AssetProcessor] Background processing completed for asset version: ${newVersion.id}`,
            );
          }
        })
        .catch((err) => {
          logger.error(
            `[AssetProcessor] Background processing failed for asset version: ${newVersion.id}`,
            err,
          );
        })
        .finally(() => {
          if ((assetFile as UploadedFile).url && fs.existsSync(fullPath)) {
            try {
              fs.unlinkSync(fullPath);
            } catch (cleanupErr) {
              logger.error('[AssetProcessor] Failed to clean up version temp file:', cleanupErr);
            }
          }
        });
    } else {
      // Non-3D asset, just update active url and size
      await prisma.asset.update({
        where: { id },
        data: { url, size: fileSizeMB },
      });
    }

    await auditService.log({
      userId,
      action: AuditAction.UPDATE_ASSET,
      module: AuditModule.ASSET,
      description: `Uploaded version ${versionTag} for asset: ${existingAsset.title}`,
      newValue: newVersion,
      req,
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

export const createAssetAnnotation = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const id = req.params.id as string;
  const { content, x, y, z, cameraPos, cameraTarget } = req.body;

  if (!content) {
    return next(new AppError('Comment content is required', 400));
  }

  try {
    const existingAsset = await prisma.asset.findFirst({
      where: getAssetCollaborationWhere(id, req),
    });
    if (!existingAsset) {
      return next(new AppError('Asset not found or collaboration access denied', 403));
    }

    const coords = [x, y, z].map((value) => parseFloat(value));
    if (coords.some((value) => !Number.isFinite(value))) {
      return next(new AppError('Invalid annotation coordinates', 400));
    }

    const annotation = await prisma.assetAnnotation.create({
      data: {
        assetId: id,
        userId: req.userId as string,
        content,
        x: coords[0]!,
        y: coords[1]!,
        z: coords[2]!,
        cameraPos: cameraPos ? JSON.stringify(cameraPos) : null,
        cameraTarget: cameraTarget ? JSON.stringify(cameraTarget) : null,
      },
      include: {
        user: { select: { name: true, avatarUrl: true } },
      },
    });

    await auditService.log({
      userId: req.userId as string,
      action: 'CREATE_ASSET_ANNOTATION',
      module: AuditModule.ASSET,
      description: `Added annotation to asset: ${existingAsset.title}`,
      newValue: annotation,
      req,
    });

    res.status(201).json(annotation);
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

export const deleteAssetAnnotation = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const annotationId = req.params.annotationId as string;
  try {
    const annotation = await prisma.assetAnnotation.findUnique({
      where: { id: annotationId },
      include: {
        asset: { select: { id: true, title: true, userId: true, teamId: true } },
      },
    });

    if (!annotation) {
      return next(new AppError('Annotation not found', 404));
    }

    const isAnnotationOwner = annotation.userId === req.userId;
    const isAssetOwner = annotation.asset.userId === req.userId;
    const canDelete = isAnnotationOwner || isAssetOwner || req.user?.role === 'ADMIN';

    if (!canDelete) {
      return next(new AppError('Not authorized to delete this annotation', 403));
    }

    await prisma.assetAnnotation.delete({
      where: { id: annotationId },
    });

    await auditService.log({
      userId: req.userId as string,
      action: 'DELETE_ASSET_ANNOTATION',
      module: AuditModule.ASSET,
      description: `Deleted annotation from asset: ${annotation.asset.title}`,
      oldValue: annotation,
      req,
    });

    res.json({ message: 'Annotation deleted successfully' });
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
