import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import prisma from '../services/prisma';
import { getUploadedFileUrl, deleteCloudOrLocalFileByUrl, urlToPath } from '../utils/file';
import { AppError } from '../utils/error';
import { settingsService } from '../services/settings.service';
import { storageService } from '../services/storage.service';
import fs from 'fs';

/**
 * Upload file to temporary netdisk
 */
export const uploadFile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    let activeConfig = await prisma.storageConfig.findFirst({
      where: { status: 'ACTIVE', assetType: 'TEMPORARY_NETDISK' },
    });
    if (!activeConfig) {
      activeConfig = await prisma.storageConfig.findFirst({
        where: { status: 'ACTIVE', assetType: 'ALL' },
      });
    }
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
    let activeConfig = await prisma.storageConfig.findFirst({
      where: { status: 'ACTIVE', assetType: 'TEMPORARY_NETDISK' },
    });
    if (!activeConfig) {
      activeConfig = await prisma.storageConfig.findFirst({
        where: { status: 'ACTIVE', assetType: 'ALL' },
      });
    }

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
    await deleteCloudOrLocalFileByUrl(file.url);

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
