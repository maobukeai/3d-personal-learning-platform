import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import prisma from '../services/prisma';
import { getUploadedFileUrl, deleteCloudOrLocalFileByUrl, urlToPath } from '../utils/file';
import { AppError } from '../utils/error';
import { settingsService } from '../services/settings.service';
import { storageService } from '../services/storage.service';
import { logger } from '../utils/logger';
import { buildDecryptedStorageConfig } from '../utils/crypto';
import { gbToBytes } from '../utils/quota';
import fs from 'fs';

/**
 * Upload file to temporary netdisk
 */
export const uploadFile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const activeConfig = await getActiveStorage();
    if (!activeConfig) {
      return next(new AppError('未配置或未启用云存储配置（Cloudflare R2），禁止上传文件', 400));
    }

    if (!req.file) {
      return next(new AppError('请选择要上传的文件', 400));
    }

    const userId = req.userId!;
    const fileUrl = getUploadedFileUrl(req, req.file, 'temporary');
    const storageConfigId = (req.file as any).r2ConfigId || null;

    const temporaryFile = await prisma.temporaryFile.create({
      data: {
        name: req.file.originalname,
        url: fileUrl,
        size: req.file.size,
        mimeType: req.file.mimetype,
        userId,
        storageConfigId,
      },
    });

    res.status(201).json(temporaryFile);
  } catch (error) {
    next(error);
  }
};

/**
 * Get user's files in temporary netdisk
 */
export const getMyFiles = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const activeConfig = await getActiveStorage();

    if (!activeConfig) {
      const settings = await settingsService.getAll();
      const cleanupTime = settings.TEMPORARY_NETDISK_CLEANUP_TIME || '03:00';
      return res.json({
        hasConfig: false,
        files: [],
        cleanupTime,
        limitGb: 0,
        usedBytes: 0,
      });
    }

    const userId = req.userId!;
    
    // Also load share records count
    const files = await prisma.temporaryFile.findMany({
      where: { userId },
      include: {
        shares: {
          select: {
            id: true,
            password: true,
            expiresAt: true,
            downloadsCount: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Also get daily clean up time
    const settings = await settingsService.getAll();
    const cleanupTime = settings.TEMPORARY_NETDISK_CLEANUP_TIME || '03:00';

    res.json({
      hasConfig: true,
      files,
      cleanupTime,
      limitGb: activeConfig.limitGb,
      usedBytes: activeConfig.usedBytes,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete file from temporary netdisk
 */
export const deleteFile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const userId = req.userId!;

    const file = await prisma.temporaryFile.findFirst({
      where: { id, userId },
    });

    if (!file) {
      return next(new AppError('文件不存在或无权操作', 404));
    }

    // Safely delete physical file (from R2 or local disk)
    await deleteCloudOrLocalFileByUrl(file.url, file.size);

    // Decrement storage quota on the target storage config
    const targetConfigId = file.storageConfigId;
    if (targetConfigId) {
      const configToUpdate = await prisma.storageConfig.findUnique({
        where: { id: targetConfigId },
      });
      if (configToUpdate) {
        await prisma.storageConfig.update({
          where: { id: targetConfigId },
          data: { usedBytes: Math.max(0, configToUpdate.usedBytes - file.size) },
        });
      }
    } else {
      // Fallback: update active TEMPORARY_NETDISK or ALL config
      const activeConfig = await prisma.storageConfig.findFirst({
        where: { status: 'ACTIVE', assetType: { in: ['TEMPORARY_NETDISK', 'ALL'] } },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      });
      if (activeConfig) {
        await prisma.storageConfig.update({
          where: { id: activeConfig.id },
          data: { usedBytes: Math.max(0, activeConfig.usedBytes - file.size) },
        });
      }
    }

    // Delete database record
    await prisma.temporaryFile.delete({
      where: { id },
    });

    res.json({ message: '文件已成功删除' });
  } catch (error) {
    next(error);
  }
};

/**
 * Create share link for a file
 */
export const createShare = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const { fileId, password, expiresDays } = req.body;

    if (!fileId) {
      return next(new AppError('缺少 fileId 参数', 400));
    }

    const file = await prisma.temporaryFile.findFirst({
      where: { id: fileId, userId },
    });

    if (!file) {
      return next(new AppError('文件不存在或无权操作', 404));
    }

    // Expiry calculation
    let expiresAt: Date | null = null;
    if (expiresDays && parseInt(expiresDays, 10) > 0) {
      expiresAt = new Date(Date.now() + parseInt(expiresDays, 10) * 24 * 60 * 60 * 1000);
    }

    // Create share record
    const share = await prisma.temporaryShare.create({
      data: {
        fileId,
        userId,
        password: password || null,
        expiresAt,
      },
    });

    res.status(201).json(share);
  } catch (error) {
    next(error);
  }
};

/**
 * Public: Get share info (without exposing file URL directly if password exists)
 */
export const getShareInfo = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const shareId = req.params.shareId as string;

    const share = await prisma.temporaryShare.findUnique({
      where: { id: shareId },
      include: {
        file: {
          select: {
            name: true,
            size: true,
            mimeType: true,
            createdAt: true,
          },
        },
        user: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!share) {
      return next(new AppError('分享链接不存在或已被取消', 404));
    }

    // Check expiration
    if (share.expiresAt && new Date() > share.expiresAt) {
      return next(new AppError('该分享链接已过期', 410));
    }

    res.json({
      id: share.id,
      fileName: share.file.name,
      fileSize: share.file.size,
      mimeType: share.file.mimeType,
      ownerName: share.user?.name || '匿名用户',
      hasPassword: !!share.password,
      createdAt: share.createdAt,
      expiresAt: share.expiresAt,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Public: Verify password and get temporary download info
 */
export const verifySharePassword = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const shareId = req.params.shareId as string;
    const { password } = req.body;

    const share = await prisma.temporaryShare.findUnique({
      where: { id: shareId },
    });

    if (!share) {
      return next(new AppError('分享链接不存在或已被取消', 404));
    }

    if (share.expiresAt && new Date() > share.expiresAt) {
      return next(new AppError('该分享链接已过期', 410));
    }

    if (share.password && share.password !== password) {
      return next(new AppError('提取码不正确', 403));
    }

    res.json({ success: true, message: '提取码验证成功' });
  } catch (error) {
    next(error);
  }
};

/**
 * Public: Download shared file
 */
export const downloadSharedFile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const shareId = req.params.shareId as string;
    const password = req.query.password as string;

    const share = await prisma.temporaryShare.findUnique({
      where: { id: shareId },
      include: { file: true },
    });

    if (!share) {
      return next(new AppError('分享链接不存在或已被取消', 404));
    }

    if (share.expiresAt && new Date() > share.expiresAt) {
      return next(new AppError('该分享链接已过期', 410));
    }

    if (share.password && share.password !== password) {
      return next(new AppError('提取码错误，无权下载', 403));
    }

    // Increment downloads count
    await prisma.temporaryShare.update({
      where: { id: shareId },
      data: { downloadsCount: { increment: 1 } },
    });

    const file = share.file;

    // If cloud file, redirect (using presigned download URL for content-disposition override if available)
    if (file.url.startsWith('http://') || file.url.startsWith('https://')) {
      try {
        const activeConfig = await prisma.storageConfig.findFirst({
          where: { id: file.storageConfigId || undefined, status: 'ACTIVE' },
        });
        if (activeConfig) {
          const urlObj = new URL(file.url);
          const key = decodeURIComponent(urlObj.pathname.slice(1));
          const signedUrl = await storageService.getPresignedDownloadUrl(
            activeConfig,
            key,
            file.name
          );
          return res.redirect(signedUrl);
        }
      } catch (err) {
        // Fallback to standard redirect if presigned URL generation fails
      }
      return res.redirect(file.url);
    }

    // If local file, stream download
    const localPath = urlToPath(file.url);
    if (!localPath || !fs.existsSync(localPath)) {
      return next(new AppError('物理文件不存在，请联系上传者', 404));
    }

    const safeName = encodeURIComponent(file.name);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeName}"; filename*=UTF-8''${safeName}`,
    );

    const fileStream = fs.createReadStream(localPath);
    fileStream.pipe(res);
  } catch (error) {
    next(error);
  }
};

/**
 * Authenticated: Download user's own file
 */
export const downloadFile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const userId = req.userId!;

    const file = await prisma.temporaryFile.findFirst({
      where: { id, userId },
    });

    if (!file) {
      return next(new AppError('文件不存在或无权操作', 404));
    }

    // If cloud file, redirect using presigned URL with content-disposition override
    if (file.url.startsWith('http://') || file.url.startsWith('https://')) {
      try {
        const activeConfig = await prisma.storageConfig.findFirst({
          where: { id: file.storageConfigId || undefined, status: 'ACTIVE' },
        });
        if (activeConfig) {
          const urlObj = new URL(file.url);
          const key = decodeURIComponent(urlObj.pathname.slice(1));
          const signedUrl = await storageService.getPresignedDownloadUrl(
            activeConfig,
            key,
            file.name
          );
          return res.redirect(signedUrl);
        }
      } catch (err) {
        // Fallback
      }
      return res.redirect(file.url);
    }

    // If local file, stream download
    const localPath = urlToPath(file.url);
    if (!localPath || !fs.existsSync(localPath)) {
      return next(new AppError('物理文件不存在', 404));
    }

    const safeName = encodeURIComponent(file.name);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeName}"; filename*=UTF-8''${safeName}`,
    );

    const fileStream = fs.createReadStream(localPath);
    fileStream.pipe(res);
  } catch (error) {
    next(error);
  }
};

/**
 * Shared storage configuration helper
 */
const getActiveStorage = async () => {
  let activeConfig = await prisma.storageConfig.findFirst({
    where: { status: 'ACTIVE', assetType: 'TEMPORARY_NETDISK' },
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
  });
  if (!activeConfig) {
    activeConfig = await prisma.storageConfig.findFirst({
      where: { status: 'ACTIVE', assetType: 'ALL' },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
  }
  if (activeConfig) {
    activeConfig.usedBytes = Math.max(0, activeConfig.usedBytes);
  }
  return activeConfig;
};

const getDecryptedActiveStorage = async () => {
  const raw = await getActiveStorage();
  if (!raw) return null;
  return {
    raw,
    config: buildDecryptedStorageConfig(raw),
  };
};

/**
 * Get simple presigned PUT upload URL
 */
export const getUploadPresignedUrl = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { filename, mimetype, size } = req.body;
  if (!filename || !mimetype) {
    return res.status(400).json({ error: 'filename and mimetype are required' });
  }

  try {
    const active = await getDecryptedActiveStorage();
    if (!active) {
      return res.json({ isDirect: false });
    }
    const { raw, config } = active;

    const limitBytes = gbToBytes(raw.limitGb);
    if (size && raw.usedBytes + size > limitBytes) {
      return res.status(400).json({ error: '云端存储容量已满，无法上传' });
    }

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const sanitized = filename
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x1f\x7f-\x9f\\/:*?"'<>|%#]/g, '_')
      .replace(/\s+/g, '_');
    const key = `temporary/${uniqueSuffix}/${sanitized}`;

    const uploadUrl = await storageService.getPresignedUploadUrl(config, key, mimetype);
    const publicUrlBase = config.publicUrl.replace(/\/$/, '');
    const publicUrl = `${publicUrlBase}/${key}`;

    res.json({
      isDirect: true,
      uploadUrl,
      publicUrl,
      key,
    });
  } catch (error) {
    logger.error('Get netdisk presigned url error:', error);
    next(error);
  }
};

/**
 * Complete single PUT upload (create record & allocate quota)
 */
export const completeSingleUpload = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { filename, key, size, mimetype } = req.body;
  if (!filename || !key || !size || !mimetype) {
    return res.status(400).json({ error: 'filename, key, size, and mimetype are required' });
  }

  try {
    const active = await getDecryptedActiveStorage();
    if (!active) {
      return res.status(400).json({ error: '未启用云存储配置' });
    }
    const { raw } = active;

    // Check capacity quota again
    const limitBytes = gbToBytes(raw.limitGb);
    if (raw.usedBytes + size > limitBytes) {
      return res.status(400).json({ error: '云端存储容量已满，无法上传' });
    }

    // Atomically increment storage used bytes
    await prisma.storageConfig.update({
      where: { id: raw.id },
      data: { usedBytes: { increment: size } },
    });

    const publicUrlBase = raw.publicUrl.replace(/\/$/, '');
    const fileUrl = `${publicUrlBase}/${key}`;

    const userId = req.userId!;
    const temporaryFile = await prisma.temporaryFile.create({
      data: {
        name: filename,
        url: fileUrl,
        size: size,
        mimeType: mimetype,
        userId,
        storageConfigId: raw.id,
      },
    });

    res.status(201).json(temporaryFile);
  } catch (error) {
    logger.error('Complete single upload error:', error);
    next(error);
  }
};

/**
 * Initiate S3 multipart upload
 */
export const initiateNetdiskMultipartUpload = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const { filename, mimetype, size } = req.body;
  if (!filename || !mimetype) {
    return res.status(400).json({ error: 'filename and mimetype are required' });
  }

  try {
    const active = await getDecryptedActiveStorage();
    if (!active) {
      return res.json({ isDirect: false });
    }
    const { raw, config } = active;

    const limitBytes = gbToBytes(raw.limitGb);
    if (size && raw.usedBytes + size > limitBytes) {
      return res.status(400).json({ error: '云端存储容量已满，无法上传' });
    }

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const sanitized = filename
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x1f\x7f-\x9f\\/:*?"'<>|%#]/g, '_')
      .replace(/\s+/g, '_');
    const key = `temporary/${uniqueSuffix}/${sanitized}`;

    const uploadId = await storageService.initiateMultipartUpload(config, key, mimetype);
    res.json({
      isDirect: true,
      uploadId,
      key,
    });
  } catch (error) {
    logger.error('Initiate netdisk multipart upload error:', error);
    next(error);
  }
};

/**
 * Get S3 presigned part upload URLs
 */
export const getNetdiskMultipartUploadPartUrls = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const { key, uploadId, partNumbers } = req.body;
  if (!key || !uploadId || !Array.isArray(partNumbers)) {
    return res.status(400).json({ error: 'key, uploadId, and partNumbers are required' });
  }

  try {
    const active = await getDecryptedActiveStorage();
    if (!active) {
      return res.status(400).json({ error: 'Storage configuration not active' });
    }
    const { config } = active;

    const urls: Record<number, string> = {};
    for (const partNum of partNumbers) {
      const url = await storageService.getPresignedUploadPartUrl(config, key, uploadId, partNum);
      urls[partNum] = url;
    }
    res.json({ urls });
  } catch (error) {
    logger.error('Get netdisk presigned upload part urls error:', error);
    next(error);
  }
};

/**
 * Complete S3 multipart upload (finalize upload & create record & allocate quota)
 */
export const completeNetdiskMultipartUpload = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const { key, uploadId, parts, filename, mimetype, size } = req.body;
  if (!key || !uploadId || !Array.isArray(parts) || !filename || !mimetype || !size) {
    return res.status(400).json({ error: 'key, uploadId, parts, filename, mimetype, and size are required' });
  }

  try {
    const active = await getDecryptedActiveStorage();
    if (!active) {
      return res.status(400).json({ error: 'Storage configuration not active' });
    }
    const { raw, config } = active;

    // Check capacity quota again
    const limitBytes = gbToBytes(raw.limitGb);
    if (raw.usedBytes + size > limitBytes) {
      return res.status(400).json({ error: '云端存储容量已满，无法上传' });
    }

    const finalUrl = await storageService.completeMultipartUpload(config, key, uploadId, parts);

    // Atomically increment storage used bytes
    await prisma.storageConfig.update({
      where: { id: raw.id },
      data: { usedBytes: { increment: size } },
    });

    const userId = req.userId!;
    const temporaryFile = await prisma.temporaryFile.create({
      data: {
        name: filename,
        url: finalUrl,
        size: size,
        mimeType: mimetype,
        userId,
        storageConfigId: raw.id,
      },
    });

    res.status(201).json(temporaryFile);
  } catch (error) {
    logger.error('Complete netdisk multipart upload error:', error);
    next(error);
  }
};

/**
 * Abort S3 multipart upload
 */
export const abortNetdiskMultipartUpload = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const { key, uploadId } = req.body;
  if (!key || !uploadId) {
    return res.status(400).json({ error: 'key and uploadId are required' });
  }

  try {
    const active = await getDecryptedActiveStorage();
    if (!active) {
      return res.status(400).json({ error: 'Storage configuration not active' });
    }
    const { config } = active;

    await storageService.abortMultipartUpload(config, key, uploadId);
    res.json({ success: true });
  } catch (error) {
    logger.error('Abort netdisk multipart upload error:', error);
    next(error);
  }
};
