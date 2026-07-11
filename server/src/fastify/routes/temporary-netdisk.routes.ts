import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import fs from 'fs';
import prisma from '../../services/prisma';
import { settingsService } from '../../services/settings.service';
import { storageService } from '../../services/storage.service';
import { AppError } from '../../utils/error';
import { logger } from '../../utils/logger';
import { deleteCloudOrLocalFileByUrl, urlToPath } from '../../utils/file';
import {
  getActiveStorageConfig,
  getDecryptedActiveStorageConfig,
  generateS3Key,
  checkQuota,
  incrementConfigUsedBytes,
} from '../../utils/s3-upload-helper';
import {
  createNetdiskShareSchema,
  netdiskAbortMultipartSchema,
  netdiskCompleteMultipartSchema,
  netdiskCompleteSingleUploadSchema,
  netdiskInitiateMultipartSchema,
  netdiskPresignPartsSchema,
  netdiskPresignedUrlSchema,
  verifySharePasswordSchema,
} from '../../utils/schemas-batch1';
import { fastifyAuthenticate } from '../auth/fastify-auth';
import { fastifyUpload } from '../middlewares/fastify-upload.middleware';

/**
 * Fastify 临时网盘路由（铁律六·1 渐进式迁移 —— 原生 Fastify handler）。
 *
 * 挂载前缀: /api/fastify/netdisk
 *  公开端点（分享访问）无需鉴权；其余端点需鉴权。
 *
 * 端点：
 *  公开（带 rateLimit）：
 *   - GET    /netdisk/share/:shareId              获取分享信息（30/min）
 *   - POST   /netdisk/share/:shareId/verify       校验分享密码（30/min）
 *   - GET    /netdisk/share/:shareId/download     下载分享文件（10/min）
 *  鉴权：
 *   - GET    /netdisk/files                       列出我的文件
 *   - POST   /netdisk/presigned-url               获取预签名上传 URL
 *   - POST   /netdisk/complete-single             完成单段上传
 *   - POST   /netdisk/multipart/initiate          初始化分片上传
 *   - POST   /netdisk/multipart/presign-parts     获取分片上传 URL
 *   - POST   /netdisk/multipart/complete          完成分片上传
 *   - POST   /netdisk/multipart/abort             取消分片上传
 *   - DELETE /netdisk/files/:id                   删除文件
 *   - GET    /netdisk/files/:id/download          下载文件
 *   - POST   /netdisk/shares                      创建分享
 *   - POST   /netdisk/upload                      上传临时网盘文件
 */

const shareIdParamsSchema = z.object({
  shareId: z.string().min(1, 'Share id is required'),
});

const fileIdParamsSchema = z.object({
  id: z.string().min(1, 'File id is required'),
});

const downloadShareQuerySchema = z
  .object({
    password: z.string().optional(),
  })
  .passthrough();

const getActiveStorage = () => getActiveStorageConfig('TEMPORARY_NETDISK');
const getDecryptedActiveStorage = () => getDecryptedActiveStorageConfig('TEMPORARY_NETDISK');

interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
  url?: string;
  r2Key?: string;
  r2ConfigId?: string;
}

export const registerTemporaryNetdiskRoutes = (app: FastifyInstance): void => {
  // GET /temporary-netdisk/share/:shareId —— 获取分享信息（公开，shareLimiter 30/min）
  app.get(
    '/temporary-netdisk/share/:shareId',
    {
      schema: { params: shareIdParamsSchema },
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const { shareId } = request.params as { shareId: string };

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
        throw new AppError('分享链接不存在或已被取消', 404);
      }

      if (share.expiresAt && new Date() > share.expiresAt) {
        throw new AppError('该分享链接已过期', 410);
      }

      return reply.send({
        id: share.id,
        fileName: share.file.name,
        fileSize: share.file.size,
        mimeType: share.file.mimeType,
        ownerName: share.user?.name || '匿名用户',
        hasPassword: !!share.password,
        createdAt: share.createdAt,
        expiresAt: share.expiresAt,
      });
    },
  );

  // POST /temporary-netdisk/share/:shareId/verify —— 校验分享密码（公开，shareLimiter 30/min）
  app.post(
    '/temporary-netdisk/share/:shareId/verify',
    {
      schema: { params: shareIdParamsSchema, body: verifySharePasswordSchema },
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const { shareId } = request.params as { shareId: string };
      const { password } = request.body as { password?: string };

      const share = await prisma.temporaryShare.findUnique({
        where: { id: shareId },
      });

      if (!share) {
        throw new AppError('分享链接不存在或已被取消', 404);
      }

      if (share.expiresAt && new Date() > share.expiresAt) {
        throw new AppError('该分享链接已过期', 410);
      }

      if (share.password && share.password !== password) {
        throw new AppError('提取码不正确', 403);
      }

      return reply.send({ success: true, message: '提取码验证成功' });
    },
  );

  // GET /temporary-netdisk/share/:shareId/download —— 下载分享文件（公开，downloadShareLimiter 10/min）
  app.get(
    '/temporary-netdisk/share/:shareId/download',
    {
      schema: { params: shareIdParamsSchema, querystring: downloadShareQuerySchema },
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const { shareId } = request.params as { shareId: string };
      const { password } = request.query as { password?: string };

      const share = await prisma.temporaryShare.findUnique({
        where: { id: shareId },
        include: { file: true },
      });

      if (!share) {
        throw new AppError('分享链接不存在或已被取消', 404);
      }

      if (share.expiresAt && new Date() > share.expiresAt) {
        throw new AppError('该分享链接已过期', 410);
      }

      if (share.password && share.password !== password) {
        throw new AppError('提取码错误，无权下载', 403);
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
              file.name,
            );
            return reply.redirect(signedUrl);
          }
        } catch {
          // Fallback to standard redirect if presigned URL generation fails
        }
        return reply.redirect(file.url);
      }

      // If local file, stream download
      const localPath = urlToPath(file.url);
      if (!localPath) {
        throw new AppError('物理文件不存在，请联系上传者', 404);
      }
      try {
        await fs.promises.access(localPath, fs.constants.R_OK);
      } catch {
        throw new AppError('物理文件不存在，请联系上传者', 404);
      }

      const safeName = encodeURIComponent(file.name);
      reply.header('Content-Type', 'application/octet-stream');
      reply.header(
        'Content-Disposition',
        `attachment; filename="${safeName}"; filename*=UTF-8''${safeName}`,
      );

      const fileStream = fs.createReadStream(localPath);
      return reply.send(fileStream);
    },
  );

  // GET /temporary-netdisk/files —— 列出我的文件
  app.get(
    '/temporary-netdisk/files',
    {
      preHandler: [fastifyAuthenticate],
    },
    async (request, reply) => {
      const activeConfig = await getActiveStorage();

      if (!activeConfig) {
        const settings = await settingsService.getAll();
        const cleanupTime = settings.TEMPORARY_NETDISK_CLEANUP_TIME || '03:00';
        return reply.send({
          hasConfig: false,
          files: [],
          cleanupTime,
          limitGb: 0,
          usedBytes: 0,
        });
      }

      const userId = request.userId!;

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

      const settings = await settingsService.getAll();
      const cleanupTime = settings.TEMPORARY_NETDISK_CLEANUP_TIME || '03:00';

      return reply.send({
        hasConfig: true,
        files,
        cleanupTime,
        limitGb: activeConfig.limitGb,
        usedBytes: activeConfig.usedBytes,
      });
    },
  );

  // POST /temporary-netdisk/presigned-url —— 获取预签名上传 URL
  app.post(
    '/temporary-netdisk/presigned-url',
    {
      preHandler: [fastifyAuthenticate],
      schema: { body: netdiskPresignedUrlSchema },
    },
    async (request, reply) => {
      const { filename, mimetype, size } = request.body as {
        filename: string;
        mimetype: string;
        size?: number;
      };

      try {
        const active = await getDecryptedActiveStorage();
        if (!active) {
          return reply.send({ isDirect: false });
        }
        const { raw, config } = active;

        const allowed = await checkQuota(raw, size);
        if (!allowed) {
          return reply.status(400).send({ error: '云端存储容量已满，无法上传' });
        }

        const key = generateS3Key(filename, 'temporary');

        const uploadUrl = await storageService.getPresignedUploadUrl(config, key, mimetype);
        const publicUrlBase = config.publicUrl.replace(/\/$/, '');
        const publicUrl = `${publicUrlBase}/${key}`;

        return reply.send({
          isDirect: true,
          uploadUrl,
          publicUrl,
          key,
        });
      } catch (error) {
        logger.error('Get netdisk presigned url error:', error);
        throw error;
      }
    },
  );

  // POST /temporary-netdisk/complete-single —— 完成单段上传
  app.post(
    '/temporary-netdisk/complete-single',
    {
      preHandler: [fastifyAuthenticate],
      schema: { body: netdiskCompleteSingleUploadSchema },
    },
    async (request, reply) => {
      const { filename, key, size, mimetype } = request.body as {
        filename: string;
        key: string;
        size: number | string;
        mimetype: string;
      };
      const numericSize = typeof size === 'string' ? Number(size) : size;

      try {
        const active = await getDecryptedActiveStorage();
        if (!active) {
          return reply.status(400).send({ error: '未启用云存储配置' });
        }
        const { raw } = active;

        const allowed = await checkQuota(raw, numericSize);
        if (!allowed) {
          return reply.status(400).send({ error: '云端存储容量已满，无法上传' });
        }

        await incrementConfigUsedBytes(raw.id, numericSize);

        const publicUrlBase = raw.publicUrl.replace(/\/$/, '');
        const fileUrl = `${publicUrlBase}/${key}`;

        const userId = request.userId!;
        const temporaryFile = await prisma.temporaryFile.create({
          data: {
            name: filename,
            url: fileUrl,
            size: numericSize,
            mimeType: mimetype,
            userId,
            storageConfigId: raw.id,
          },
        });

        return reply.status(201).send(temporaryFile);
      } catch (error) {
        logger.error('Complete single upload error:', error);
        throw error;
      }
    },
  );

  // POST /temporary-netdisk/multipart/initiate —— 初始化分片上传
  app.post(
    '/temporary-netdisk/multipart/initiate',
    {
      preHandler: [fastifyAuthenticate],
      schema: { body: netdiskInitiateMultipartSchema },
    },
    async (request, reply) => {
      const { filename, mimetype, size } = request.body as {
        filename: string;
        mimetype: string;
        size?: number;
      };

      try {
        const active = await getDecryptedActiveStorage();
        if (!active) {
          return reply.send({ isDirect: false });
        }
        const { raw, config } = active;

        const allowed = await checkQuota(raw, size);
        if (!allowed) {
          return reply.status(400).send({ error: '云端存储容量已满，无法上传' });
        }

        const key = generateS3Key(filename, 'temporary');

        const uploadId = await storageService.initiateMultipartUpload(config, key, mimetype);
        return reply.send({
          isDirect: true,
          uploadId,
          key,
        });
      } catch (error) {
        logger.error('Initiate netdisk multipart upload error:', error);
        throw error;
      }
    },
  );

  // POST /temporary-netdisk/multipart/presign-parts —— 获取分片上传 URL
  app.post(
    '/temporary-netdisk/multipart/presign-parts',
    {
      preHandler: [fastifyAuthenticate],
      schema: { body: netdiskPresignPartsSchema },
    },
    async (request, reply) => {
      const { key, uploadId, partNumbers } = request.body as {
        key: string;
        uploadId: string;
        partNumbers: Array<number | string>;
      };

      try {
        const active = await getDecryptedActiveStorage();
        if (!active) {
          return reply.status(400).send({ error: 'Storage configuration not active' });
        }
        const { config } = active;

        const urls: Record<number, string> = {};
        for (const partNum of partNumbers) {
          const url = await storageService.getPresignedUploadPartUrl(
            config,
            key,
            uploadId,
            Number(partNum),
          );
          urls[Number(partNum)] = url;
        }
        return reply.send({ urls });
      } catch (error) {
        logger.error('Get netdisk presigned upload part urls error:', error);
        throw error;
      }
    },
  );

  // POST /temporary-netdisk/multipart/complete —— 完成分片上传
  app.post(
    '/temporary-netdisk/multipart/complete',
    {
      preHandler: [fastifyAuthenticate],
      schema: { body: netdiskCompleteMultipartSchema },
    },
    async (request, reply) => {
      const { key, uploadId, parts, filename, mimetype, size } = request.body as {
        key: string;
        uploadId: string;
        parts: unknown[];
        filename: string;
        mimetype: string;
        size: number | string;
      };
      const numericSize = typeof size === 'string' ? Number(size) : size;

      try {
        const active = await getDecryptedActiveStorage();
        if (!active) {
          return reply.status(400).send({ error: 'Storage configuration not active' });
        }
        const { raw, config } = active;

        const allowed = await checkQuota(raw, numericSize);
        if (!allowed) {
          return reply.status(400).send({ error: '云端存储容量已满，无法上传' });
        }

        const finalUrl = await storageService.completeMultipartUpload(
          config,
          key,
          uploadId,
          parts as { ETag: string; PartNumber: number }[],
        );

        await incrementConfigUsedBytes(raw.id, numericSize);

        const userId = request.userId!;
        const temporaryFile = await prisma.temporaryFile.create({
          data: {
            name: filename,
            url: finalUrl,
            size: numericSize,
            mimeType: mimetype,
            userId,
            storageConfigId: raw.id,
          },
        });

        return reply.status(201).send(temporaryFile);
      } catch (error) {
        logger.error('Complete netdisk multipart upload error:', error);
        throw error;
      }
    },
  );

  // POST /temporary-netdisk/multipart/abort —— 取消分片上传
  app.post(
    '/temporary-netdisk/multipart/abort',
    {
      preHandler: [fastifyAuthenticate],
      schema: { body: netdiskAbortMultipartSchema },
    },
    async (request, reply) => {
      const { key, uploadId } = request.body as { key: string; uploadId: string };

      try {
        const active = await getDecryptedActiveStorage();
        if (!active) {
          return reply.status(400).send({ error: 'Storage configuration not active' });
        }
        const { config } = active;

        await storageService.abortMultipartUpload(config, key, uploadId);
        return reply.send({ success: true });
      } catch (error) {
        logger.error('Abort netdisk multipart upload error:', error);
        throw error;
      }
    },
  );

  // DELETE /temporary-netdisk/files/:id —— 删除文件
  app.delete(
    '/temporary-netdisk/files/:id',
    {
      preHandler: [fastifyAuthenticate],
      schema: { params: fileIdParamsSchema },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const userId = request.userId!;

      const file = await prisma.temporaryFile.findFirst({
        where: { id, userId },
      });

      if (!file) {
        throw new AppError('文件不存在或无权操作', 404);
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

      return reply.send({ message: '文件已成功删除' });
    },
  );

  // GET /temporary-netdisk/files/:id/download —— 下载文件
  app.get(
    '/temporary-netdisk/files/:id/download',
    {
      preHandler: [fastifyAuthenticate],
      schema: { params: fileIdParamsSchema },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const userId = request.userId!;

      const file = await prisma.temporaryFile.findFirst({
        where: { id, userId },
      });

      if (!file) {
        throw new AppError('文件不存在或无权操作', 404);
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
              file.name,
            );
            return reply.redirect(signedUrl);
          }
        } catch {
          // Fallback
        }
        return reply.redirect(file.url);
      }

      // If local file, stream download
      const localPath = urlToPath(file.url);
      if (!localPath) {
        throw new AppError('物理文件不存在', 404);
      }
      try {
        await fs.promises.access(localPath, fs.constants.R_OK);
      } catch {
        throw new AppError('物理文件不存在', 404);
      }

      const safeName = encodeURIComponent(file.name);
      reply.header('Content-Type', 'application/octet-stream');
      reply.header(
        'Content-Disposition',
        `attachment; filename="${safeName}"; filename*=UTF-8''${safeName}`,
      );

      const fileStream = fs.createReadStream(localPath);
      return reply.send(fileStream);
    },
  );

  // POST /temporary-netdisk/shares —— 创建分享
  app.post(
    '/temporary-netdisk/shares',
    {
      preHandler: [fastifyAuthenticate],
      schema: { body: createNetdiskShareSchema },
    },
    async (request, reply) => {
      const userId = request.userId!;
      const { fileId, password, expiresDays } = request.body as {
        fileId: string;
        password?: string;
        expiresDays?: string | number;
      };

      const file = await prisma.temporaryFile.findFirst({
        where: { id: fileId, userId },
      });

      if (!file) {
        throw new AppError('文件不存在或无权操作', 404);
      }

      // Expiry calculation
      let expiresAt: Date | null = null;
      const numericExpiresDays =
        typeof expiresDays === 'string' ? parseInt(expiresDays, 10) : expiresDays;
      if (numericExpiresDays && numericExpiresDays > 0) {
        expiresAt = new Date(Date.now() + numericExpiresDays * 24 * 60 * 60 * 1000);
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

      return reply.status(201).send(share);
    },
  );

  // POST /temporary-netdisk/upload —— 上传临时网盘文件
  app.post(
    '/temporary-netdisk/upload',
    {
      preHandler: [fastifyAuthenticate, fastifyUpload([{ name: 'temporary_file', maxCount: 1 }])],
    },
    async (request, reply) => {
      const activeConfig = await getActiveStorage();
      if (!activeConfig) {
        throw new AppError('未配置或未启用云存储配置（Cloudflare R2），禁止上传文件', 400);
      }

      const file = (request as FastifyRequest & { file?: UploadedFile }).file;
      if (!file) {
        throw new AppError('请选择要上传的文件', 400);
      }

      const userId = request.userId!;
      const fileUrl = file.url;
      if (!fileUrl) {
        throw new AppError(
          `文件上传失败：未获取到云存储地址 (field=${file.fieldname}, subfolder=temporary)`,
        );
      }
      const storageConfigId = file.r2ConfigId || null;

      const temporaryFile = await prisma.temporaryFile.create({
        data: {
          name: file.originalname,
          url: fileUrl,
          size: file.size,
          mimeType: file.mimetype,
          userId,
          storageConfigId,
        },
      });

      return reply.status(201).send(temporaryFile);
    },
  );
};
