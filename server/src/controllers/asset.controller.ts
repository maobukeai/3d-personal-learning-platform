import { logger } from '../utils/logger';
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
import { deleteFileByUrl } from '../utils/file';
import { auditService, AuditAction, AuditModule } from '../services/audit.service';
import { AppError } from '../middlewares/error.middleware';
import { clampLimit, clampPage } from '../utils/pagination';
import { redisService } from '../services/redis.service';

const tagSearchCounts: Record<string, number> = {};

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
      url = `${req.protocol}://${req.get('host')}/uploads/assets/${assetFile.filename}`;
      type = path.extname(assetFile.originalname).slice(1).toUpperCase();
    }

    let thumbnailUrl = null;
    if (files?.thumbnail?.[0]) {
      thumbnailUrl = `${req.protocol}://${req.get('host')}/uploads/assets/${files.thumbnail[0].filename}`;
    }

    let parsedFormats = formats;
    if (typeof formats === 'string') {
      try {
        parsedFormats = JSON.parse(formats);
      } catch (_e) {
        // fallback
      }
    }

    let parsedTags: string[] = [];
    if (tags) {
      if (typeof tags === 'string') {
        try {
          const parsed = JSON.parse(tags);
          if (Array.isArray(parsed)) {
            parsedTags = parsed;
          } else {
            parsedTags = tags
              .split(/[,，\s]+/)
              .map((t) => t.trim())
              .filter(Boolean);
          }
        } catch {
          parsedTags = tags
            .split(/[,，\s]+/)
            .map((t) => t.trim())
            .filter(Boolean);
        }
      } else if (Array.isArray(tags)) {
        parsedTags = tags;
      }
    }

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
          logger.error(
            `[AssetProcessor] Background processing failed for asset: ${asset.id}. Keeping asset without metadata.`,
            err,
          );
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
      let parsedTags: string[] = [];
      if (tags) {
        if (typeof tags === 'string') {
          try {
            const parsed = JSON.parse(tags);
            if (Array.isArray(parsed)) {
              parsedTags = parsed;
            } else {
              parsedTags = tags
                .split(/[,，\s]+/)
                .map((t) => t.trim())
                .filter(Boolean);
            }
          } catch {
            parsedTags = tags
              .split(/[,，\s]+/)
              .map((t) => t.trim())
              .filter(Boolean);
          }
        } else if (Array.isArray(tags)) {
          parsedTags = tags;
        }
      }
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
  const { vertices, faces, materials, animations, hasAnimations, dimensions } = req.body;

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

    const updateData: Prisma.AssetUpdateInput = {
      hasAnimations: hasAnimations === true || hasAnimations === 'true',
      dimensions,
    };

    if (vertices !== undefined) updateData.vertices = parseInt(vertices, 10);
    if (faces !== undefined) updateData.faces = parseInt(faces, 10);
    if (materials !== undefined) updateData.materials = parseInt(materials, 10);
    if (animations !== undefined) updateData.animations = parseInt(animations, 10);

    const asset = await prisma.asset.update({
      where: { id },
      data: updateData,
    });
    res.json(asset);
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

    const thumbnailUrl = `${req.protocol}://${req.get('host')}/uploads/assets/${fileName}`;

    // Delete old thumbnail if it was a local file
    if (existingAsset.thumbnail) {
      deleteFileByUrl(existingAsset.thumbnail);
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
    const limit = clampLimit(req.query.limit, 12, 100);
    const lite = req.query.lite === 'true';
    const search = req.query.search as string;
    const categoryId = req.query.categoryId as string;
    const skip = (page - 1) * limit;

    const where: Prisma.AssetWhereInput = { status: 'APPROVED' };
    if (categoryId && categoryId !== 'all') {
      where.categoryId = categoryId;
    }
    if (search) {
      const trimmed = search.trim();
      if (trimmed) {
        tagSearchCounts[trimmed] = (tagSearchCounts[trimmed] || 0) + 1;
      }
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
        { tags: { contains: search } },
      ];
    }

    let assets: any[];
    if (lite) {
      assets = await prisma.asset.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: Math.min(limit, 50),
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
        orderBy: { createdAt: 'desc' },
        skip,
        take: Math.min(limit, 50),
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

export const getUserAssets = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const assets = await prisma.asset.findMany({
      where: { teamId: req.workspaceId },
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
      where: {
        id,
        OR: [{ teamId: req.workspaceId }, { status: 'APPROVED' }],
      },
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

    res.json(updatedAsset);
  } catch (error) {
    next(error);
  }
};

export const recordAssetDownload = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  const userId = req.userId || 'anonymous';
  const lockKey = `asset_download:${id}:${userId}`;
  try {
    const alreadyDownloaded = await redisService.get<boolean>(lockKey);
    let asset;
    if (alreadyDownloaded) {
      asset = await prisma.asset.findUnique({ where: { id } });
      if (!asset) return next(new AppError('Asset not found', 404));
    } else {
      asset = await prisma.asset.update({
        where: { id },
        data: { downloads: { increment: 1 } },
      });
      await redisService.set(lockKey, true, 86400); // Lock for 24h
    }
    res.json({ message: 'Download recorded', downloads: asset.downloads });
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
    const existingLike = await prisma.assetLike.findUnique({
      where: {
        assetId_userId: {
          assetId: id,
          userId,
        },
      },
    });

    let liked = false;
    let asset;

    if (existingLike) {
      await prisma.assetLike.delete({
        where: {
          id: existingLike.id,
        },
      });
      asset = await prisma.asset.update({
        where: { id },
        data: { likes: { decrement: 1 } },
      });
      liked = false;
    } else {
      await prisma.assetLike.create({
        data: {
          assetId: id,
          userId,
        },
      });
      asset = await prisma.asset.update({
        where: { id },
        data: { likes: { increment: 1 } },
      });
      liked = true;
    }

    res.json({
      message: liked ? 'Like recorded' : 'Like removed',
      likes: Math.max(0, asset.likes),
      liked,
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

    // Delete files from disk
    deleteFileByUrl(asset.url);
    if (asset.thumbnail) {
      deleteFileByUrl(asset.thumbnail);
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
  const { status } = req.query;
  try {
    const assets = await prisma.asset.findMany({
      where: status ? { status: status as string } : {},
      include: {
        user: {
          select: { name: true, email: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(assets);
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
  const { title, description, status, categoryId, formats } = req.body;

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

    // Delete files from disk if they exist
    deleteFileByUrl(asset.url);
    if (asset.thumbnail) {
      deleteFileByUrl(asset.thumbnail);
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

    const url = `${req.protocol}://${req.get('host')}/uploads/assets/${assetFile.filename}`;
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
    const versions = await prisma.assetVersion.findMany({
      where: { assetId: id },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true, avatarUrl: true } },
      },
    });
    res.json(versions);
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
    const existingAsset = await prisma.asset.findUnique({ where: { id } });
    if (!existingAsset) {
      return next(new AppError('Asset not found', 404));
    }

    const annotation = await prisma.assetAnnotation.create({
      data: {
        assetId: id,
        userId: req.userId as string,
        content,
        x: parseFloat(x),
        y: parseFloat(y),
        z: parseFloat(z),
        cameraPos: cameraPos ? JSON.stringify(cameraPos) : null,
        cameraTarget: cameraTarget ? JSON.stringify(cameraTarget) : null,
      },
      include: {
        user: { select: { name: true, avatarUrl: true } },
      },
    });

    res.status(201).json(annotation);
  } catch (error) {
    next(error);
  }
};

export const getAssetAnnotations = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  try {
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
    });

    if (!annotation) {
      return next(new AppError('Annotation not found', 404));
    }

    // Owner or admin check
    if (annotation.userId !== req.userId && req.user?.role !== 'ADMIN') {
      return next(new AppError('Not authorized to delete this annotation', 403));
    }

    await prisma.assetAnnotation.delete({
      where: { id: annotationId },
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

    const allTags = Array.from(
      new Set([...Object.keys(tagUsageCounts), ...Object.keys(tagSearchCounts)]),
    );
    const result = allTags.map((tag) => {
      return {
        label: tag,
        count: tagUsageCounts[tag] || 0,
        searchCount: tagSearchCounts[tag] || 0,
      };
    });

    // Sort by searchCount descending, then count descending
    result.sort((a, b) => b.searchCount - a.searchCount || b.count - a.count);

    res.json(result);
  } catch (error) {
    next(error);
  }
};
