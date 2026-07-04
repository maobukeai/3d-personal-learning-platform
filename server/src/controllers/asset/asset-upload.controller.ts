import { Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../../services/prisma';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { AppError } from '../../utils/error';
import { logger } from '../../utils/logger';
import { emitToAll } from '../../services/socket.service';
import fs from 'fs';
import path from 'path';
import { process3DAsset } from '../../utils/asset-processor';
import { checkAssetQuota, checkStorageQuota, gbToBytes } from '../../utils/quota';
import { deleteCloudOrLocalFileByUrl, parseZipLocal, getUploadedFileUrl, urlToPath, moveTempFileToDestination, getFileSizeInMb } from '../../utils/file';
import { auditService, AuditAction, AuditModule } from '../../services/audit.service';
import { redisService } from '../../services/redis.service';
import { storageService } from '../../services/storage.service';
import { decryptSecretIfNeeded } from '../../utils/crypto';
import { UploadedFile } from '../../types/upload';
import { parseBool, parseNum } from '../../utils/parser';
import {
  normalizeAssetTags,
  buildAssetPerformanceReport,
  syncCompressedAssetToR2,
  getAssetAccessWhere,
  checkIsUserVip,
  getAssetCollaborationWhere,
} from './helpers';
import { getCustomAssetCategories, saveCustomAssetCategories } from './asset-query.controller';

export const uploadAsset = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId as string;
    const workspaceId = req.workspaceId;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const assetFile = files?.asset?.[0];
    const packageFile = files?.package?.[0];
    const externalUrl = req.body.externalUrl;

    let tempAssetPath = req.body.tempAssetPath;
    let tempPackagePath = req.body.tempPackagePath;
    let tempThumbnailPath = req.body.tempThumbnailPath;

    if (!assetFile && !tempAssetPath && !externalUrl) {
      return next(new AppError('No asset file or external link provided', 400));
    }

    if (assetFile) {
      const ext = path.extname(assetFile.originalname).toLowerCase();
      if (ext !== '.glb') {
        if (fs.existsSync(assetFile.path)) fs.unlinkSync(assetFile.path);
        if (packageFile && fs.existsSync(packageFile.path)) fs.unlinkSync(packageFile.path);
        return next(new AppError('Main asset file must be in GLB format (.glb)', 400));
      }
    }

    if (packageFile) {
      const ext = path.extname(packageFile.originalname).toLowerCase();
      if (ext !== '.zip') {
        if (assetFile && fs.existsSync(assetFile.path)) fs.unlinkSync(assetFile.path);
        if (fs.existsSync(packageFile.path)) fs.unlinkSync(packageFile.path);
        return next(new AppError('Resource package file must be in ZIP format (.zip)', 400));
      }
    }

    // Move temp files to assets directory if present
    if (tempAssetPath) {
      tempAssetPath = moveTempFileToDestination(req, tempAssetPath, 'assets');
    }
    if (tempPackagePath) {
      tempPackagePath = moveTempFileToDestination(req, tempPackagePath, 'assets');
    }
    if (tempThumbnailPath) {
      tempThumbnailPath = moveTempFileToDestination(req, tempThumbnailPath, 'assets');
    }

    // Check quotas with workspace context
    const assetQuota = await checkAssetQuota(userId, workspaceId);
    if (!assetQuota.allowed) {
      if (assetFile && fs.existsSync(assetFile.path)) fs.unlinkSync(assetFile.path);
      if (packageFile && fs.existsSync(packageFile.path)) fs.unlinkSync(packageFile.path);
      return next(new AppError(assetQuota.message || 'Asset quota exceeded', 403));
    }

    let fileSizeMB = assetFile ? parseFloat((assetFile.size / (1024 * 1024)).toFixed(2)) : 0;
    if (!assetFile && tempAssetPath) {
      fileSizeMB = await getFileSizeInMb(tempAssetPath);
    }

    let packageSizeMB = packageFile ? parseFloat((packageFile.size / (1024 * 1024)).toFixed(2)) : 0;
    if (!packageFile && tempPackagePath) {
      packageSizeMB = await getFileSizeInMb(tempPackagePath);
    }

    const totalSizeMB = fileSizeMB + packageSizeMB;

    const storageQuota = await checkStorageQuota(userId, totalSizeMB, workspaceId);
    if (!storageQuota.allowed) {
      if (assetFile && fs.existsSync(assetFile.path)) fs.unlinkSync(assetFile.path);
      if (packageFile && fs.existsSync(packageFile.path)) fs.unlinkSync(packageFile.path);
      return next(new AppError(storageQuota.message || 'Storage quota exceeded', 403));
    }

    const {
      title,
      description,
      categoryId,
      formats,
      tags,
      isFree,
      // 版权
      originality,
      originalAuthor,
      originalLink,
      license,
      // 3D 规格
      meshType,
      uvUnwrapped,
      uvOverlapping,
      pbrChannels,
      rigged,
      gameReady,
      // 渲染视口
      defaultCameraPos,
      defaultCameraTarget,
      defaultEnvironment,
      defaultExposure,
      // 关联关系
      linkedCourseId,
      linkedLessonId,
      bilibiliUrl,
    } = req.body;

    if (!categoryId) {
      if (assetFile && fs.existsSync(assetFile.path)) fs.unlinkSync(assetFile.path);
      if (packageFile && fs.existsSync(packageFile.path)) fs.unlinkSync(packageFile.path);
      return next(new AppError('Category is required', 400));
    }

    let url = externalUrl;
    let type = 'LINK';
    let size = fileSizeMB;

    if (assetFile) {
      const assetsDir = path.join(__dirname, '../../../uploads/assets');
      await fs.promises.mkdir(assetsDir, { recursive: true });
      url = getUploadedFileUrl(req, assetFile, 'assets');
      type = 'GLB';
    } else if (tempAssetPath) {
      url = tempAssetPath;
      type = 'GLB';
    }

    let packageUrl = null;
    let packageSize = null;
    let packageFilesList: string[] = [];
    if (packageFile) {
      packageUrl = getUploadedFileUrl(req, packageFile, 'assets');
      packageSize = packageSizeMB;
      packageFilesList = await parseZipLocal(packageFile.path);
    } else if (tempPackagePath) {
      packageUrl = tempPackagePath;
      packageSize = packageSizeMB;
      const localPath = urlToPath(tempPackagePath);
      if (localPath && fs.existsSync(localPath)) {
        packageFilesList = await parseZipLocal(localPath);
      }
    }

    let thumbnailUrl = null;
    if (files?.thumbnail?.[0]) {
      thumbnailUrl = getUploadedFileUrl(req, files.thumbnail[0], 'assets');
    } else if (tempThumbnailPath) {
      thumbnailUrl = tempThumbnailPath;
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
        packageUrl,
        packageSize,
        packageFilesList: packageFilesList.length > 0 ? JSON.stringify(packageFilesList) : null,
        thumbnail: thumbnailUrl,
        type,
        size,
        categoryId,
        status: req.user?.role === 'ADMIN' ? 'APPROVED' : 'PENDING',
        userId,
        teamId: workspaceId,
        isFree: parseBool(isFree, true),
        formats: parsedFormats ? JSON.stringify(parsedFormats) : null,
        tags: parsedTags.length > 0 ? JSON.stringify(parsedTags) : null,
        bilibiliUrl: bilibiliUrl || null,
        // 版权
        originality: originality || 'ORIGINAL',
        originalAuthor,
        originalLink,
        license: license || 'CC_BY',
        // 规格
        meshType: meshType || 'LOW_POLY',
        uvUnwrapped: parseBool(uvUnwrapped, true),
        uvOverlapping: parseBool(uvOverlapping, false),
        pbrChannels: pbrChannels
          ? typeof pbrChannels === 'string'
            ? pbrChannels
            : JSON.stringify(pbrChannels)
          : null,
        rigged: parseBool(rigged, false),
        gameReady: parseBool(gameReady, false),
        // 渲染视口配置
        defaultCameraPos: defaultCameraPos
          ? typeof defaultCameraPos === 'string'
            ? defaultCameraPos
            : JSON.stringify(defaultCameraPos)
          : null,
        defaultCameraTarget: defaultCameraTarget
          ? typeof defaultCameraTarget === 'string'
            ? defaultCameraTarget
            : JSON.stringify(defaultCameraTarget)
          : null,
        defaultEnvironment: defaultEnvironment || 'studio',
        defaultExposure: parseNum(defaultExposure, 1.0),
        // 关联
        linkedCourseId: linkedCourseId || null,
        linkedLessonId: linkedLessonId || null,
      },
      include: { category: true },
    });

    // Clean up local package file after parsing
    if (packageFile && fs.existsSync(packageFile.path)) {
      try {
        fs.unlinkSync(packageFile.path);
      } catch (err) {
        logger.error('[Asset] Failed to delete local package file:', err);
      }
    }

    // Respond immediately to the user
    res.status(201).json(asset);

    // Process 3D metadata asynchronously in the background
    if (assetFile && (type === 'GLB' || type === 'GLTF')) {
      const fullPath = path.join(__dirname, '../../../uploads/assets', assetFile.filename);

      // We don't await this, letting it run in the background
      process3DAsset(fullPath)
        .then(async (metadata) => {
          if (metadata) {
            await prisma.asset.update({
              where: { id: asset.id },
              data: { ...metadata },
            });
            // Sync compressed GLB to cloud storage and update DB size/url
            await syncCompressedAssetToR2(asset.id, fullPath, assetFile as UploadedFile, false);
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
  const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
  const assetFile = files?.asset?.[0];
  const packageFile = files?.package?.[0];
  const thumbnailFile = files?.thumbnail?.[0];

  const {
    title,
    description,
    categoryId,
    formats,
    tags,
    isFree,
    originality,
    originalAuthor,
    originalLink,
    license,
    meshType,
    uvUnwrapped,
    uvOverlapping,
    pbrChannels,
    rigged,
    gameReady,
    defaultCameraPos,
    defaultCameraTarget,
    defaultEnvironment,
    defaultExposure,
    linkedCourseId,
    linkedLessonId,
    externalUrl,
    bilibiliUrl,
  } = req.body;

  try {
    let tempAssetPath = req.body.tempAssetPath;
    let tempPackagePath = req.body.tempPackagePath;
    let tempThumbnailPath = req.body.tempThumbnailPath;

    if (tempAssetPath) {
      tempAssetPath = moveTempFileToDestination(req, tempAssetPath, 'assets');
    }
    if (tempPackagePath) {
      tempPackagePath = moveTempFileToDestination(req, tempPackagePath, 'assets');
    }
    if (tempThumbnailPath) {
      tempThumbnailPath = moveTempFileToDestination(req, tempThumbnailPath, 'assets');
    }

    const existingAsset = await prisma.asset.findFirst({
      where: req.user?.role === 'ADMIN' ? { id } : { id, userId: req.userId },
    });

    if (!existingAsset) {
      if (assetFile && fs.existsSync(assetFile.path)) fs.unlinkSync(assetFile.path);
      if (packageFile && fs.existsSync(packageFile.path)) fs.unlinkSync(packageFile.path);
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

    if (originality !== undefined) updateData.originality = originality;
    if (originalAuthor !== undefined) updateData.originalAuthor = originalAuthor;
    if (originalLink !== undefined) updateData.originalLink = originalLink;
    if (license !== undefined) updateData.license = license;
    if (meshType !== undefined) updateData.meshType = meshType;
    if (uvUnwrapped !== undefined) updateData.uvUnwrapped = parseBool(uvUnwrapped, true);
    if (uvOverlapping !== undefined) updateData.uvOverlapping = parseBool(uvOverlapping, false);
    if (pbrChannels !== undefined) {
      updateData.pbrChannels = pbrChannels
        ? typeof pbrChannels === 'string'
          ? pbrChannels
          : JSON.stringify(pbrChannels)
        : null;
    }
    if (rigged !== undefined) updateData.rigged = parseBool(rigged, false);
    if (gameReady !== undefined) updateData.gameReady = parseBool(gameReady, false);
    if (defaultCameraPos !== undefined) {
      updateData.defaultCameraPos = defaultCameraPos
        ? typeof defaultCameraPos === 'string'
          ? defaultCameraPos
          : JSON.stringify(defaultCameraPos)
        : null;
    }
    if (defaultCameraTarget !== undefined) {
      updateData.defaultCameraTarget = defaultCameraTarget
        ? typeof defaultCameraTarget === 'string'
          ? defaultCameraTarget
          : JSON.stringify(defaultCameraTarget)
        : null;
    }
    if (defaultEnvironment !== undefined) updateData.defaultEnvironment = defaultEnvironment;
    if (defaultExposure !== undefined) updateData.defaultExposure = parseNum(defaultExposure, 1.0);
    if (linkedCourseId !== undefined) updateData.linkedCourseId = linkedCourseId || null;
    if (linkedLessonId !== undefined) updateData.linkedLessonId = linkedLessonId || null;
    if (isFree !== undefined) updateData.isFree = parseBool(isFree, true);
    if (bilibiliUrl !== undefined) updateData.bilibiliUrl = bilibiliUrl || null;

    // Process new file uploads if present
    if (assetFile) {
      const ext = path.extname(assetFile.originalname).toLowerCase();
      if (ext !== '.glb') {
        if (fs.existsSync(assetFile.path)) fs.unlinkSync(assetFile.path);
        if (packageFile && fs.existsSync(packageFile.path)) fs.unlinkSync(packageFile.path);
        return next(new AppError('Main asset file must be in GLB format (.glb)', 400));
      }
      const fileSizeMB = parseFloat((assetFile.size / (1024 * 1024)).toFixed(2));
      updateData.size = fileSizeMB;
      updateData.type = 'GLB';
      updateData.url = getUploadedFileUrl(req, assetFile, 'assets');
    } else if (tempAssetPath) {
      const fileSizeMB = await getFileSizeInMb(tempAssetPath);
      updateData.size = fileSizeMB;
      updateData.type = 'GLB';
      updateData.url = tempAssetPath;
    } else if (externalUrl !== undefined) {
      updateData.url = externalUrl;
      updateData.type = 'LINK';
    }

    if (packageFile) {
      const ext = path.extname(packageFile.originalname).toLowerCase();
      if (ext !== '.zip') {
        if (fs.existsSync(packageFile.path)) fs.unlinkSync(packageFile.path);
        return next(new AppError('Resource package file must be in ZIP format (.zip)', 400));
      }
      const packageSizeMB = parseFloat((packageFile.size / (1024 * 1024)).toFixed(2));
      const packageFilesList = await parseZipLocal(packageFile.path);
      updateData.packageSize = packageSizeMB;
      updateData.packageUrl = getUploadedFileUrl(req, packageFile, 'assets');
      updateData.packageFilesList =
        packageFilesList.length > 0 ? JSON.stringify(packageFilesList) : null;
    } else if (tempPackagePath) {
      const packageSizeMB = await getFileSizeInMb(tempPackagePath);
      updateData.packageSize = packageSizeMB;
      updateData.packageUrl = tempPackagePath;

      let packageFilesList: string[] = [];
      const localPath = urlToPath(tempPackagePath);
      if (localPath && fs.existsSync(localPath)) {
        packageFilesList = await parseZipLocal(localPath);
      }
      updateData.packageFilesList =
        packageFilesList.length > 0 ? JSON.stringify(packageFilesList) : null;
    }

    if (thumbnailFile) {
      updateData.thumbnail = getUploadedFileUrl(req, thumbnailFile, 'assets');
    } else if (tempThumbnailPath) {
      updateData.thumbnail = tempThumbnailPath;
    }

    if (existingAsset.userId === req.userId && req.user?.role !== 'ADMIN') {
      updateData.status = 'PENDING';
      updateData.rejectReason = null;
    }

    const asset = await prisma.asset.update({
      where: { id },
      data: updateData,
      include: {
        category: true,
        linkedCourse: { select: { id: true, title: true } },
        linkedLesson: { select: { id: true, title: true } },
      },
    });

    // Process 3D metadata asynchronously in the background
    if (assetFile) {
      const fullPath = path.join(__dirname, '../../../uploads/assets', assetFile.filename);
      process3DAsset(fullPath)
        .then(async (metadata) => {
          if (metadata) {
            await prisma.asset.update({
              where: { id: asset.id },
              data: { ...metadata },
            });
            await syncCompressedAssetToR2(asset.id, fullPath, assetFile as UploadedFile, false);
            logger.info(
              `[AssetProcessor] Background processing completed for updated asset: ${asset.id}`,
            );
          }
        })
        .catch((err) => {
          logger.error(
            `[AssetProcessor] Background processing error for updated asset: ${asset.id}:`,
            err,
          );
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

    if (packageFile && fs.existsSync(packageFile.path)) {
      try {
        fs.unlinkSync(packageFile.path);
      } catch (err) {
        logger.error('[Asset] Failed to delete local package file:', err);
      }
    }

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

    const assetsDir = path.join(__dirname, '../../../uploads/assets');
    await fs.promises.mkdir(assetsDir, { recursive: true });

    // Convert base64 to file
    const base64Data = thumbnail.replace(/^data:image\/png;base64,/, '');
    const fileName = `thumb-${id}-${Date.now()}.png`;
    const filePath = path.join(assetsDir, fileName);

    await fs.promises.writeFile(filePath, Buffer.from(base64Data, 'base64'));

    let thumbnailUrl = getUploadedFileUrl(req, req.file!, 'assets');

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
        const stats = await fs.promises.stat(filePath);
        const fileBytes = stats.size;

        for (const config of activeConfigs) {
          const limitBytes = gbToBytes(config.limitGb);
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

export const uploadAssetVersion = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  try {
    const userId = req.userId as string;
    const workspaceId = req.workspaceId;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const assetFile = files?.asset?.[0];
    const packageFile = files?.package?.[0];
    const { changeLog } = req.body;

    if (!assetFile) {
      return next(new AppError('No asset file provided for this version', 400));
    }

    const existingAsset = await prisma.asset.findFirst({
      where: { id, teamId: workspaceId },
    });

    if (!existingAsset) {
      if (fs.existsSync(assetFile.path)) fs.unlinkSync(assetFile.path);
      if (packageFile && fs.existsSync(packageFile.path)) fs.unlinkSync(packageFile.path);
      return next(new AppError('Asset not found or access denied', 404));
    }

    const ext = path.extname(assetFile.originalname).toLowerCase();
    if (ext !== '.glb') {
      if (fs.existsSync(assetFile.path)) fs.unlinkSync(assetFile.path);
      if (packageFile && fs.existsSync(packageFile.path)) fs.unlinkSync(packageFile.path);
      return next(new AppError('Main asset file must be in GLB format (.glb)', 400));
    }

    if (packageFile) {
      const pkgExt = path.extname(packageFile.originalname).toLowerCase();
      if (pkgExt !== '.zip') {
        if (fs.existsSync(assetFile.path)) fs.unlinkSync(assetFile.path);
        if (fs.existsSync(packageFile.path)) fs.unlinkSync(packageFile.path);
        return next(new AppError('Resource package file must be in ZIP format (.zip)', 400));
      }
    }

    const fileSizeMB = parseFloat((assetFile.size / (1024 * 1024)).toFixed(2));
    const packageSizeMB = packageFile
      ? parseFloat((packageFile.size / (1024 * 1024)).toFixed(2))
      : 0;
    const totalSizeMB = fileSizeMB + packageSizeMB;

    const storageQuota = await checkStorageQuota(userId, totalSizeMB, workspaceId);
    if (!storageQuota.allowed) {
      if (fs.existsSync(assetFile.path)) fs.unlinkSync(assetFile.path);
      if (packageFile && fs.existsSync(packageFile.path)) fs.unlinkSync(packageFile.path);
      return next(new AppError(storageQuota.message || 'Storage quota exceeded', 403));
    }

    const url = getUploadedFileUrl(req, assetFile, 'assets');

    let packageUrl = null;
    let packageSize = null;
    let packageFilesList: string[] = [];
    if (packageFile) {
      packageUrl = getUploadedFileUrl(req, packageFile, 'assets');
      packageSize = packageSizeMB;
      packageFilesList = await parseZipLocal(packageFile.path);
    }

    // Check if same type (allow GLB replacing older GLTF for backward compatibility)
    if (
      existingAsset.type !== 'GLB' &&
      existingAsset.type !== 'GLTF' &&
      existingAsset.type !== 'LINK'
    ) {
      if (fs.existsSync(assetFile.path)) fs.unlinkSync(assetFile.path);
      if (packageFile && fs.existsSync(packageFile.path)) fs.unlinkSync(packageFile.path);
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
        packageUrl,
        packageSize,
        packageFilesList: packageFilesList.length > 0 ? JSON.stringify(packageFilesList) : null,
        size: fileSizeMB,
        changeLog: changeLog || 'Uploaded new version',
        userId,
      },
    });

    // Update parent asset immediately
    await prisma.asset.update({
      where: { id },
      data: {
        url,
        size: fileSizeMB,
        packageUrl,
        packageSize,
        packageFilesList: packageFilesList.length > 0 ? JSON.stringify(packageFilesList) : null,
      },
    });

    // Clean up local package file after parsing
    if (packageFile && fs.existsSync(packageFile.path)) {
      try {
        fs.unlinkSync(packageFile.path);
      } catch (err) {
        logger.error('[Asset] Failed to delete local package file in version upload:', err);
      }
    }

    res.status(201).json(newVersion);

    // Process 3D metadata in background
    const fullPath = path.join(__dirname, '../../../uploads/assets', assetFile.filename);
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
              ...metadata,
            },
          });
          // Sync compressed GLB to cloud storage and update DB size/url for both Asset and Version
          await syncCompressedAssetToR2(
            id,
            fullPath,
            assetFile as UploadedFile,
            true,
            newVersion.id,
          );
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

export const createOrUpdateAssetShare = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const assetId = req.params.id as string;
  const userId = req.userId as string;
  const { expireHours, expiresAt, customText } = req.body;
  try {
    const asset = await prisma.asset.findFirst({
      where:
        req.user?.role === 'ADMIN'
          ? { id: assetId }
          : { id: assetId, OR: [{ userId: req.userId }, { teamId: req.workspaceId }] },
    });
    if (!asset) {
      return next(new AppError('Asset not found or access denied', 404));
    }

    let calculatedExpiresAt: Date | null = null;
    if (expiresAt) {
      calculatedExpiresAt = new Date(expiresAt);
    } else if (expireHours !== undefined && expireHours !== null) {
      calculatedExpiresAt = new Date(Date.now() + expireHours * 60 * 60 * 1000);
    }

    const existing = await prisma.assetShare.findUnique({
      where: { assetId },
    });

    let share;
    if (existing) {
      share = await prisma.assetShare.update({
        where: { assetId },
        data: {
          expiresAt: calculatedExpiresAt,
          customText,
        },
      });
    } else {
      share = await prisma.assetShare.create({
        data: {
          assetId,
          userId,
          expiresAt: calculatedExpiresAt,
          customText,
        },
      });
    }

    res.json(share);
  } catch (error) {
    next(error);
  }
};

export const cancelAssetShare = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const assetId = req.params.id as string;
  try {
    const asset = await prisma.asset.findFirst({
      where:
        req.user?.role === 'ADMIN'
          ? { id: assetId }
          : { id: assetId, OR: [{ userId: req.userId }, { teamId: req.workspaceId }] },
    });
    if (!asset) {
      return next(new AppError('Asset not found or access denied', 404));
    }

    await prisma.assetShare.deleteMany({
      where: { assetId },
    });

    res.json({ success: true, message: 'Share link cancelled' });
  } catch (error) {
    next(error);
  }
};

export const createAssetComment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const assetId = req.params.id as string;
  const userId = req.user?.id;
  const { content } = req.body;

  if (!userId) {
    return next(new AppError('Unauthorized', 401));
  }
  if (!content || !content.trim()) {
    return next(new AppError('Comment content cannot be empty', 400));
  }

  try {
    const asset = await prisma.asset.findFirst({
      where: getAssetAccessWhere(assetId, req),
    });
    if (!asset) {
      return next(new AppError('Asset not found or access denied', 404));
    }
    const comment = await prisma.assetComment.create({
      data: {
        content: content.trim(),
        assetId,
        userId,
      },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
    res.status(201).json(comment);
  } catch (error) {
    next(error);
  }
};

export const deleteAssetComment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const commentId = req.params.commentId as string;
  const userId = req.user?.id;
  const userRole = req.user?.role;

  if (!userId) {
    return next(new AppError('Unauthorized', 401));
  }

  try {
    const comment = await prisma.assetComment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      return next(new AppError('Comment not found', 404));
    }

    if (comment.userId !== userId && userRole !== 'ADMIN') {
      return next(new AppError('Forbidden', 403));
    }

    await prisma.assetComment.delete({
      where: { id: commentId },
    });

    res.json({ success: true, message: 'Comment deleted successfully' });
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
      select: { id: true, downloads: true, isFree: true, userId: true },
    });
    if (!accessibleAsset) {
      return next(new AppError('Asset not found', 404));
    }

    if (!accessibleAsset.isFree) {
      const isOwner = req.userId && accessibleAsset.userId === req.userId;
      const isAdmin = req.user?.role === 'ADMIN';
      if (!isOwner && !isAdmin) {
        const isVip = req.userId ? await checkIsUserVip(req.userId) : false;
        if (!isVip) {
          return next(
            new AppError(
              '该模型为会员专享，请先升级为会员后再下载。',
              403,
              'DOWNLOAD_VIP_REQUIRED',
            ),
          );
        }
      }
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
  const categoryVal = typeof req.body?.category === 'string' ? req.body.category.trim() : '默认';
  const category = categoryVal || '默认';
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
        select: { id: true, category: true },
      });

      let liked: boolean;
      if (existingLike) {
        if ((existingLike.category ?? '默认') === category) {
          await tx.assetLike.delete({
            where: {
              id: existingLike.id,
            },
          });
          liked = false;
        } else {
          await tx.assetLike.update({
            where: {
              id: existingLike.id,
            },
            data: {
              category,
            },
          });
          liked = true;
        }
      } else {
        await tx.assetLike.create({
          data: {
            assetId: id,
            userId,
            category,
          },
        });
        liked = true;
      }

      const likes = await tx.assetLike.count({ where: { assetId: id } });
      await tx.asset.update({
        where: { id },
        data: { likes },
      });

      return { liked, likes };
    });

    if (result.liked && category !== '默认') {
      const customCats = await getCustomAssetCategories(userId);
      if (!customCats.includes(category)) {
        customCats.push(category);
        await saveCustomAssetCategories(userId, customCats);
      }
    }

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
      where: { id },
    });

    if (!asset) {
      return next(new AppError('Asset not found', 404));
    }

    // Auth check: asset owner, team owner/admin, or platform admin
    if (asset.userId !== req.userId && req.user?.role !== 'ADMIN') {
      const membership = await prisma.teamMember.findFirst({
        where: { teamId: asset.teamId || '', userId: req.userId },
      });
      if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
        return next(new AppError('Not authorized to delete this asset', 403));
      }
    }

    // Delete files from disk or cloud (run in background)
    const fileSizeBytes = asset.packageSize ? Math.round(asset.packageSize * 1024 * 1024) : undefined;
    deleteCloudOrLocalFileByUrl(asset.url, fileSizeBytes).catch((err) => {
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

export const bulkDeleteAssets = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: '请提供要删除的资产 ID 列表' });
    }

    const whereCondition: any = {
      id: { in: ids },
    };
    if (req.user?.role !== 'ADMIN') {
      whereCondition.userId = req.userId;
    }

    const assetsToDelete = await prisma.asset.findMany({
      where: whereCondition,
    });

    if (assetsToDelete.length === 0) {
      return res.status(404).json({ error: '未找到可删除的资产或无权操作' });
    }

    for (const asset of assetsToDelete) {
      deleteCloudOrLocalFileByUrl(asset.url).catch((err) => {
        logger.error(`[AssetController] Bulk delete: failed to delete file ${asset.url}:`, err);
      });
      if (asset.thumbnail) {
        deleteCloudOrLocalFileByUrl(asset.thumbnail).catch((err) => {
          logger.error(`[AssetController] Bulk delete: failed to delete thumbnail ${asset.thumbnail}:`, err);
        });
      }
    }

    const deleteIds = assetsToDelete.map((a) => a.id);
    await prisma.asset.deleteMany({
      where: { id: { in: deleteIds } },
    });

    res.json({
      success: true,
      message: `成功批量删除 ${deleteIds.length} 个资产`,
      count: deleteIds.length,
      deletedIds: deleteIds,
    });
  } catch (error) {
    next(error);
  }
};

export const bulkFavoriteAssets = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.userId as string;
    const rawIds: unknown[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const categoryVal = typeof req.body?.category === 'string' ? req.body.category.trim() : '默认';
    const category = categoryVal || '默认';
    const ids = Array.from(
      new Set<string>(rawIds.map((id) => String(id)).filter((id) => Boolean(id))),
    ).slice(0, 100);
    const favorite = req.body?.favorite !== false;

    if (!ids.length) {
      return next(new AppError('No assets selected', 400));
    }

    const approvedAssets = await prisma.asset.findMany({
      where: {
        id: { in: ids },
        status: 'APPROVED',
      },
      select: { id: true },
    });
    const approvedIds = approvedAssets.map((asset) => asset.id);

    if (favorite) {
      await prisma.assetLike.createMany({
        data: approvedIds.map((assetId) => ({ userId, assetId, category })),
        skipDuplicates: true,
      });

      if (category !== '默认') {
        const customCats = await getCustomAssetCategories(userId);
        if (!customCats.includes(category)) {
          customCats.push(category);
          await saveCustomAssetCategories(userId, customCats);
        }
      }
    } else {
      await prisma.assetLike.deleteMany({
        where: { userId, assetId: { in: approvedIds } },
      });
    }

    // Update likes count on assets
    for (const assetId of approvedIds) {
      const likes = await prisma.assetLike.count({ where: { assetId } });
      await prisma.asset.update({
        where: { id: assetId },
        data: { likes },
      });
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};
