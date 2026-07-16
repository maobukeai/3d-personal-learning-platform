import type { FastifyInstance, FastifyRequest } from 'fastify';

import type { AuthRequest } from '../../types/auth-request';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import crypto from 'crypto';
import path from 'path';
import axios from 'axios';
import {
  fastifyAuthenticate,
  fastifyOptionalAuthenticate,
  fastifyResolveWorkspace,
} from '../auth/fastify-auth';
import { AppError } from '../../utils/error';
import { fastifyUpload } from '../middlewares/fastify-upload.middleware';
import { logger } from '../../utils/logger';
import prisma from '../../services/prisma';
import {
  auditService,
  AuditAction,
  AuditModule,
  type AuditRequest,
} from '../../services/audit.service';
import { storageService } from '../../services/storage.service';
import { redisService } from '../../services/redis.service';
import { emitToAll } from '../../services/socket.service';
import { QueueService } from '../../services/queue.service';
import { decryptSecretIfNeeded, validateBackendSignedUrl } from '../../utils/crypto';
import { checkAssetQuota, checkStorageQuota } from '../../utils/quota';
import {
  deleteCloudOrLocalFileByUrl,
  getZipFileNames,
  parseZipBuffer,
  getUploadedFileUrl,
  moveTempFileToDestination,
  getFileSizeInMb,
} from '../../utils/file';
import {
  clampLimit,
  clampPage,
  getPaginationParams,
  createPaginationMeta,
} from '../../utils/pagination';
import { parseBool, parseNum } from '../../utils/parser';
import { withRowLock } from '../../utils/dbLock';
import { config } from '../../config/env';
import {
  tagSearchKey,
  TAG_SEARCH_REDIS_TTL,
  normalizeAssetTags,
  getAssetAccessWhere,
  checkAssetAccess,
  getAssetCollaborationWhere,
  signAssetUrls,
  signPrivateUrlIfNeeded,
  checkIsUserVip,
  buildAssetPerformanceReport,
  buildVersionComparison,
} from '../../controllers/asset/helpers';
import {
  assetCommentSchema,
  assetRequestSchema,
  assetRequestReplySchema,
  assetShareSchema,
  assetAnnotationSchema,
} from '../../utils/schemas';

/**
 * Fastify 资产库路由（铁律六·1 渐进式迁移 —— 原生 Fastify handler）。
 *
 * 挂载前缀: /api/fastify/assets
 *
 * 公开读（可选鉴权，guest 可浏览 APPROVED 资产）：
 *  - GET  /share/:shareId         公开分享详情（30/min）
 *  - GET  /categories             资产分类列表
 *  - GET  /public                 公开资产列表
 *  - GET  /:id/view-file          文件预览/流式播放（60/min，STREAM）
 *  - GET  /:id                    资产详情
 *  - GET  /:id/comments           评论列表
 *  - GET  /:id/annotations        标注列表
 *
 * Webhook（无认证，R2 → 后端直连，HMAC 签名校验）：
 *  - POST /webhook                R2 Event Notification
 *
 * 鉴权写：
 *  - GET  /my                     我的资产
 *  - GET  /favorites              我的收藏
 *  - POST /favorites/categories   创建收藏分类
 *  - PUT  /favorites/categories   更新收藏分类
 *  - DELETE /favorites/categories/:categoryName  删除收藏分类
 *  - GET  /insights               资产洞察
 *  - GET  /tags                   资产标签
 *  - GET  /requests               求资源列表
 *  - GET  /requests/:id           求资源详情
 *  - POST /requests               创建求资源
 *  - POST /requests/:id/replies   回复求资源
 *  - POST /requests/:id/resolve   解决求资源
 *  - POST /:id/download           记录下载（60/min）
 *  - POST /:id/like               切换点赞
 *  - GET  /:id/toolkit            资产工具包
 *  - GET  /:id/package-files      包内文件列表
 *  - GET  /:id/status             资产处理状态
 *  - PATCH /:id/metadata          更新资产元数据
 *  - DELETE /:id                  删除资产
 *  - POST /bulk-delete            批量删除
 *  - POST /bulk/favorite          批量收藏
 *  - GET  /:id/versions           版本列表
 *  - POST /:id/annotations        创建标注
 *  - DELETE /:id/annotations/:annotationId  删除标注
 *  - GET  /:id/share              获取分享
 *  - POST /:id/share              创建/更新分享
 *  - DELETE /:id/share            取消分享
 *  - POST /:id/comments           创建评论（10/min）
 *  - DELETE /comments/:commentId  删除评论
 *  - POST /upload                 上传资产
 *  - PUT  /:id                    更新资产
 */

// ── Types ─────────────────────────────────────────────────────────────────────

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

interface AuthReq extends FastifyRequest {
  userId?: string;
  workspaceId?: string;
}

// ── Custom asset categories setting helpers (inlined from asset-query.controller) ──

const CUSTOM_ASSET_CATEGORIES_SETTING_KEY = 'asset_favorite_categories';

const getCustomAssetCategories = async (userId: string): Promise<string[]> => {
  try {
    const setting = await prisma.userSetting.findUnique({
      where: { userId_key: { userId, key: CUSTOM_ASSET_CATEGORIES_SETTING_KEY } },
    });
    if (setting && setting.value) {
      return JSON.parse(setting.value) as string[];
    }
  } catch (err) {
    logger.warn(
      '[Asset] Failed to parse custom categories setting:',
      err instanceof Error ? err.message : err,
    );
  }
  return [];
};

const saveCustomAssetCategories = async (userId: string, categories: string[]) => {
  const uniqueCats = Array.from(new Set(categories.map((c) => c.trim()).filter(Boolean)));
  await prisma.userSetting.upsert({
    where: { userId_key: { userId, key: CUSTOM_ASSET_CATEGORIES_SETTING_KEY } },
    update: { value: JSON.stringify(uniqueCats) },
    create: {
      userId,
      key: CUSTOM_ASSET_CATEGORIES_SETTING_KEY,
      value: JSON.stringify(uniqueCats),
    },
  });
};

/** Async delete-if-exists. Swallows ENOENT so callers don't need existsSync. */
const safeUnlink = (p: string | undefined | null | undefined): Promise<void> => {
  if (!p) return Promise.resolve();
  return import('fs').then((fs) =>
    fs.promises.unlink(p).catch((err: unknown) => {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (code !== 'ENOENT') {
        logger.error(`[Asset] Failed to unlink ${p}:`, err);
      }
    }),
  );
};

// ── Params schemas ─────────────────────────────────────────────────────────────

const idParamsSchema = z.object({
  id: z.string().min(1),
});

const commentIdParamsSchema = z.object({
  commentId: z.string().min(1),
});

const shareIdParamsSchema = z.object({
  shareId: z.string().min(1),
});

const categoryNameParamsSchema = z.object({
  categoryName: z.string().min(1),
});

const idAnnotationParamsSchema = z.object({
  id: z.string().min(1),
  annotationId: z.string().min(1),
});

// --- Query schemas (permissive — handlers handle defaults) ---

const assetListQuerySchema = z
  .object({
    page: z.union([z.number(), z.string()]).optional(),
    limit: z.union([z.number(), z.string()]).optional(),
    lite: z.union([z.string(), z.boolean()]).optional(),
    search: z.string().optional(),
    categoryId: z.string().optional(),
    sort: z.string().optional(),
    mine: z.union([z.string(), z.boolean()]).optional(),
    favoritesOnly: z.union([z.string(), z.boolean()]).optional(),
    favoriteCategory: z.string().optional(),
    status: z.string().optional(),
  })
  .passthrough();

const viewFileQuerySchema = z
  .object({
    type: z.string().optional(),
  })
  .passthrough();

const requestsQuerySchema = z
  .object({
    status: z.string().optional(),
    page: z.union([z.number(), z.string()]).optional(),
    limit: z.union([z.number(), z.string()]).optional(),
  })
  .passthrough();

const optionalAuthWithWorkspace = [fastifyOptionalAuthenticate, fastifyResolveWorkspace];
const authWithWorkspace = [fastifyAuthenticate, fastifyResolveWorkspace];

// ── R2 Webhook helpers (inlined from asset-webhook.controller) ─────────────────

interface R2EventRecord {
  eventName: string;
  s3: {
    bucket: { name: string };
    object: { key: string; size?: number; eTag?: string; contentType?: string };
  };
}

function extractRecords(body: unknown): R2EventRecord[] {
  if (!body || typeof body !== 'object') return [];

  const snsMsg = (body as { Message?: string }).Message;
  if (typeof snsMsg === 'string') {
    try {
      const inner = JSON.parse(snsMsg);
      if (Array.isArray(inner.records)) return inner.records as R2EventRecord[];
      if (Array.isArray(inner.Records)) return inner.Records as R2EventRecord[];
    } catch {
      return [];
    }
  }

  const direct = body as { records?: R2EventRecord[]; Records?: R2EventRecord[] };
  if (Array.isArray(direct.records)) return direct.records;
  if (Array.isArray(direct.Records)) return direct.Records;

  return [];
}

function verifyHmacSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
  const secret = config.R2_WEBHOOK_SECRET;
  if (!secret) {
    throw new AppError(
      'R2_WEBHOOK_SECRET 未配置，webhook 端点拒绝处理（铁律：密钥不允许硬编码兜底）',
      500,
      'WEBHOOK_SECRET_MISSING',
    );
  }
  if (!signatureHeader) return false;

  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const received = signatureHeader.trim();

  if (expected.length !== received.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(received, 'hex'));
}

// ── Categories cache helpers (inlined from category.controller) ────────────────

const CATEGORIES_CACHE_KEY = 'categories:all';
const CATEGORIES_CACHE_TTL = 300;

export const registerAssetRoutes = (app: FastifyInstance): void => {
  // ── 公开读（可选鉴权）──────────────────────────────────────────────

  // GET /share/:shareId —— 公开分享详情
  app.get(
    '/share/:shareId',
    {
      preHandler: [fastifyOptionalAuthenticate],
      schema: { params: shareIdParamsSchema },
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const shareId = (request.params as { shareId: string }).shareId;
      try {
        reply.header('Cache-Control', 'public, max-age=30');
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
          return reply.status(404).send({ error: '分享链接不存在或已失效' });
        }

        if (share.expiresAt && new Date() > share.expiresAt) {
          return reply.status(410).send({ error: '分享链接已过期且失效' });
        }

        await prisma.asset.update({
          where: { id: share.assetId },
          data: { viewCount: { increment: 1 } },
        });

        const signedAsset = await signAssetUrls(share.asset);
        return reply.send({
          shareId: share.id,
          expiresAt: share.expiresAt,
          createdAt: share.createdAt,
          customText: share.customText,
          asset: signedAsset,
        });
      } catch (error) {
        logger.error('Get public shared asset error:', error);
        throw error;
      }
    },
  );

  // GET /categories —— 资产分类列表
  app.get(
    '/categories',
    {
      preHandler: [fastifyOptionalAuthenticate],
    },
    async (request, reply) => {
      try {
        const cached = await redisService.get<unknown>(CATEGORIES_CACHE_KEY);
        if (cached) {
          return reply.send(cached);
        }

        const categories = await prisma.category.findMany({
          orderBy: { order: 'asc' },
          include: {
            _count: {
              select: { assets: { where: { status: 'APPROVED' } } },
            },
          },
        });

        await redisService.set(CATEGORIES_CACHE_KEY, categories, CATEGORIES_CACHE_TTL);
        return reply.send(categories);
      } catch (error) {
        logger.error('[Fastify asset] getCategories error:', error);
        throw error;
      }
    },
  );

  // GET /public —— 公开资产列表
  app.get(
    '/public',
    {
      preHandler: [fastifyOptionalAuthenticate],
      schema: { querystring: assetListQuerySchema },
    },
    async (request, reply) => {
      try {
        const query = request.query as Record<string, string | undefined>;
        const page = clampPage(query.page);
        const limit = clampLimit(query.limit, 12, 50);
        const lite = query.lite === 'true';
        const search = query.search as string;
        const categoryId = query.categoryId as string;
        const sort = query.sort as string;
        const skip = (page - 1) * limit;

        const mine = query.mine === 'true';
        const favoritesOnly = query.favoritesOnly === 'true';
        const favoriteCategory = query.favoriteCategory as string;
        const status = query.status as string;
        const userId = (request as AuthReq).userId as string;

        const where: Prisma.AssetWhereInput = mine
          ? {
              userId,
              ...(status && status !== 'all' ? { status } : {}),
            }
          : {
              status: 'APPROVED',
              teamId: null,
            };

        if (favoritesOnly && userId) {
          where.likesRelation = {
            some: {
              userId,
              ...(favoriteCategory && favoriteCategory !== 'all'
                ? { category: favoriteCategory }
                : {}),
            },
          };
        }

        if (categoryId && categoryId !== 'all') {
          where.categoryId = categoryId;
        }
        if (search) {
          const trimmed = search.trim();
          if (trimmed) {
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
        const signedAssets = await signAssetUrls(assets);

        return reply.send({
          assets: signedAssets,
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
          },
        });
      } catch (error) {
        logger.error('[Fastify asset] getPublicAssets error:', error);
        throw error;
      }
    },
  );

  // GET /:id/view-file —— 文件预览/流式播放（STREAM，需 hijack 原始 response）
  app.get(
    '/:id/view-file',
    {
      preHandler: [fastifyOptionalAuthenticate],
      schema: { params: idParamsSchema, querystring: viewFileQuerySchema },
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const id = (request.params as { id: string }).id;
      const type = (request.query as { type?: string }).type as string;

      if (!['model', 'package', 'thumbnail'].includes(type)) {
        throw new AppError('Invalid file type requested', 400);
      }

      try {
        const asset = await prisma.asset.findUnique({
          where: { id },
        });

        if (!asset) {
          throw new AppError('Asset not found', 404);
        }

        let hasAccess = false;
        try {
          if (
            validateBackendSignedUrl(
              `/api/assets/${id}/view-file`,
              request.query as Record<string, unknown>,
            )
          ) {
            hasAccess = true;
          }
        } catch (e) {
          logger.error('Error validating signed URL:', e);
        }

        if (!hasAccess) {
          checkAssetAccess(asset, request as unknown as AuthRequest);
        }

        let urlToUse: string | null = null;

        if (type === 'model') {
          urlToUse = asset.url;
        } else if (type === 'package') {
          urlToUse = asset.packageUrl;
        } else if (type === 'thumbnail') {
          urlToUse = asset.thumbnail;
        }

        if (!urlToUse) {
          throw new AppError('Requested file not found on this asset', 404);
        }

        const urlLower = urlToUse.toLowerCase().trim();
        if (urlLower.startsWith('http://') || urlLower.startsWith('https://')) {
          try {
            const parsedUrl = new URL(urlToUse);
            const urlHost = parsedUrl.host.toLowerCase();

            let configs = await prisma.storageConfig.findMany({
              where: {
                status: 'ACTIVE',
                publicUrl: { contains: urlHost },
              },
            });

            if (configs.length === 0) {
              configs = await prisma.storageConfig.findMany({
                where: { status: 'ACTIVE' },
              });
            }

            for (const config of configs) {
              let baseUrl = config.publicUrl.endsWith('/')
                ? config.publicUrl.slice(0, -1)
                : config.publicUrl;
              if (!/^https?:\/\//i.test(baseUrl) && !baseUrl.startsWith('/')) {
                baseUrl = `https://${baseUrl}`;
              }

              const baseUrlLower = baseUrl.toLowerCase();
              if (urlLower.startsWith(baseUrlLower) || configs.length === 1) {
                const pathname = parsedUrl.pathname;
                const key = pathname.startsWith('/') ? pathname.slice(1) : pathname;
                if (key) {
                  const decryptedConfig = {
                    endpoint: config.endpoint,
                    accessKeyId: config.accessKeyId ?? '',
                    secretAccessKey: decryptSecretIfNeeded(config.secretAccessKey),
                    bucketName: config.bucketName,
                    publicUrl: config.publicUrl,
                  };

                  try {
                    const { stream, contentLength, contentType, contentRange, eTag, status } =
                      await storageService.getObjectStream(
                        decryptedConfig,
                        key,
                        request.headers.range as string | undefined,
                      );

                    reply.hijack();
                    const raw = reply.raw;

                    if (eTag) {
                      raw.setHeader('ETag', eTag);
                      const cleanETag = (t: string) =>
                        t.trim().replace(/^W\//i, '').replace(/"/g, '');
                      const clientETag = request.headers['if-none-match'];
                      if (clientETag && cleanETag(String(clientETag)) === cleanETag(eTag)) {
                        raw.statusCode = 304;
                        raw.end();
                        return;
                      }
                    }

                    raw.statusCode = status;
                    raw.setHeader('Cache-Control', 'private, no-cache, must-revalidate');
                    if (contentType) raw.setHeader('Content-Type', contentType);
                    if (contentLength !== undefined) raw.setHeader('Content-Length', contentLength);
                    if (contentRange) raw.setHeader('Content-Range', contentRange);
                    raw.setHeader('Accept-Ranges', 'bytes');
                    stream.pipe(raw);
                    return;
                  } catch (err: unknown) {
                    const awsErr = err as {
                      $metadata?: { httpStatusCode?: number };
                      name?: string;
                      code?: string;
                    };
                    if (
                      awsErr.$metadata?.httpStatusCode === 416 ||
                      awsErr.name === 'RangeNotSatisfiable' ||
                      awsErr.code === 'InvalidRange'
                    ) {
                      reply.hijack();
                      reply.raw.statusCode = 416;
                      reply.raw.setHeader('Content-Range', 'bytes */*');
                      reply.raw.end();
                      return;
                    }
                    if (
                      awsErr.$metadata?.httpStatusCode === 404 ||
                      awsErr.name === 'NoSuchKey' ||
                      awsErr.code === 'NoSuchKey'
                    ) {
                      throw new AppError('Requested file not found in storage', 404);
                    }
                    logger.error(`[viewAssetFile] Error streaming key ${key} from R2:`, err);
                    throw new AppError('Failed to fetch file from storage', 502);
                  }
                }
              }
            }
          } catch (urlErr) {
            if (urlErr instanceof AppError) throw urlErr;
            logger.error('[viewAssetFile] URL parse or process error:', urlErr);
          }
        }

        throw new AppError('文件 URL 非法：仅支持云存储地址', 400);
      } catch (error) {
        if (error instanceof AppError) throw error;
        logger.error('[Fastify asset] viewAssetFile error:', error);
        throw error;
      }
    },
  );

  // GET /:id —— 资产详情
  app.get(
    '/:id',
    {
      preHandler: optionalAuthWithWorkspace,
      schema: { params: idParamsSchema },
    },
    async (request, reply) => {
      const id = (request.params as { id: string }).id;
      const userId = (request as AuthReq).user?.id;
      try {
        const asset = await prisma.asset.findUnique({
          where: { id },
        });

        if (!asset) {
          throw new AppError('Asset not found', 404);
        }

        checkAssetAccess(asset, request as unknown as AuthRequest);

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

        const signedAsset = await signAssetUrls(updatedAsset);
        return reply.send({
          ...signedAsset,
          isLiked,
          packageFiles: [],
          performanceReport: buildAssetPerformanceReport(updatedAsset),
        });
      } catch (error) {
        logger.error('[Fastify asset] getAssetById error:', error);
        throw error;
      }
    },
  );

  // GET /:id/comments —— 评论列表
  app.get(
    '/:id/comments',
    {
      preHandler: [fastifyOptionalAuthenticate],
      schema: { params: idParamsSchema },
    },
    async (request, reply) => {
      const assetId = (request.params as { id: string }).id;
      try {
        const asset = await prisma.asset.findFirst({
          where: getAssetAccessWhere(assetId, request as unknown as AuthRequest),
        });
        if (!asset) {
          throw new AppError('Asset not found or access denied', 404);
        }
        const comments = await prisma.assetComment.findMany({
          where: { assetId },
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
        });
        return reply.send(comments);
      } catch (error) {
        logger.error('[Fastify asset] getAssetComments error:', error);
        throw error;
      }
    },
  );

  // GET /:id/annotations —— 标注列表
  app.get(
    '/:id/annotations',
    {
      preHandler: [fastifyOptionalAuthenticate],
      schema: { params: idParamsSchema },
    },
    async (request, reply) => {
      const id = (request.params as { id: string }).id;
      try {
        const asset = await prisma.asset.findUnique({
          where: { id },
          select: { id: true, status: true, teamId: true, userId: true },
        });

        if (!asset) {
          throw new AppError('Asset not found', 404);
        }

        checkAssetAccess(asset, request as unknown as AuthRequest);

        const annotations = await prisma.assetAnnotation.findMany({
          where: { assetId: id },
          orderBy: { createdAt: 'asc' },
          include: {
            user: { select: { name: true, avatarUrl: true } },
          },
        });
        return reply.send(annotations);
      } catch (error) {
        logger.error('[Fastify asset] getAssetAnnotations error:', error);
        throw error;
      }
    },
  );

  // ── Webhook（无认证）───────────────────────────────────────────────

  // POST /webhook —— R2 Event Notification（HMAC 签名校验）
  app.post('/webhook', async (request, reply) => {
    try {
      const rawBody = (request as FastifyRequest & { rawBody?: Buffer }).rawBody;
      if (!rawBody) {
        logger.warn('[R2 Webhook] rawBody 缺失，跳过处理（body parser verify 未捕获）');
        return reply.status(200).send({ received: false, reason: 'raw_body_missing' });
      }

      const signature = request.headers['x-webhook-signature'] as string | undefined;
      if (!verifyHmacSignature(rawBody, signature)) {
        logger.warn('[R2 Webhook] HMAC 签名验证失败');
        return reply.status(401).send({ error: 'Invalid signature' });
      }

      const records = extractRecords(request.body);
      if (records.length === 0) {
        logger.debug('[R2 Webhook] 无可处理的 records');
        return reply.status(200).send({ received: true, processed: 0 });
      }

      let processed = 0;
      for (const record of records) {
        const eventName = record.eventName || '';
        const objectKey = record.s3?.object?.key;
        const objectSize = record.s3?.object?.size;

        if (!objectKey) continue;

        logger.info(`[R2 Webhook] Event: ${eventName}, Key: ${objectKey}, Size: ${objectSize}`);

        if (!eventName.startsWith('s3:ObjectCreated:')) continue;

        const matchingAsset = await prisma.asset.findFirst({
          where: { url: { contains: objectKey } },
          select: { id: true, status: true, userId: true, url: true },
        });

        if (matchingAsset) {
          const dedupKey = `r2-webhook:processed:${objectKey}`;
          const existing = await redisService.get<string>(dedupKey).catch(() => null);
          if (existing !== null) {
            logger.debug(`[R2 Webhook] 已处理过此 key，跳过: ${objectKey}`);
            continue;
          }
          await redisService.set(dedupKey, '1', 300).catch(() => {
            logger.warn(`[R2 Webhook] Redis 不可用，跳过去重标记: ${objectKey}`);
          });

          try {
            const downloadRes = await axios.get(matchingAsset.url, {
              responseType: 'arraybuffer',
              timeout: 60_000,
              maxContentLength: 100 * 1024 * 1024,
            });
            const fileBuffer = Buffer.from(downloadRes.data as ArrayBuffer);
            const ext = objectKey.toLowerCase().endsWith('.gltf') ? '.gltf' : '.glb';

            await QueueService.enqueue(
              'draco-compression',
              {
                assetId: matchingAsset.id,
                buffer: fileBuffer.toString('base64'),
                ext,
                file: null,
              },
              {
                idempotencyKey: `r2-webhook-draco:${matchingAsset.id}`,
                type: 'draco-compression',
                userId: matchingAsset.userId,
              },
            );
            logger.info(`[R2 Webhook] 已为 Asset ${matchingAsset.id} 入队 Draco 压缩`);
          } catch (enqueueErr) {
            logger.error(`[R2 Webhook] Asset ${matchingAsset.id} Draco 入队失败:`, enqueueErr);
          }
          processed++;
        } else {
          logger.debug(
            `[R2 Webhook] 未找到匹配 Asset（key=${objectKey}），可能是文件已上传但资产记录尚未创建`,
          );
        }
      }

      return reply.status(200).send({ received: true, processed });
    } catch (error) {
      logger.error('[R2 Webhook] 处理异常:', error);
      return reply.status(200).send({ received: false, error: 'internal_error' });
    }
  });

  // ── 鉴权写 ──────────────────────────────────────────────────────────

  // GET /my —— 我的资产
  app.get(
    '/my',
    {
      preHandler: authWithWorkspace,
    },
    async (request, reply) => {
      try {
        const assets = await prisma.asset.findMany({
          where: {
            userId: (request as AuthReq).userId as string,
            teamId: (request as AuthReq).workspaceId,
          },
          orderBy: { createdAt: 'desc' },
          include: { category: true },
        });
        const signedAssets = await signAssetUrls(assets);
        return reply.send(signedAssets);
      } catch (error) {
        logger.error('[Fastify asset] getUserAssets error:', error);
        throw error;
      }
    },
  );

  // GET /favorites —— 我的收藏
  app.get(
    '/favorites',
    {
      preHandler: authWithWorkspace,
    },
    async (request, reply) => {
      try {
        const userId = (request as AuthReq).userId as string;
        const favorites = await prisma.assetLike.findMany({
          where: {
            userId,
            asset: {
              status: 'APPROVED',
            },
          },
          include: {
            asset: {
              include: {
                user: { select: { name: true, avatarUrl: true } },
                category: { select: { name: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        });

        const categoryList = await prisma.assetLike.groupBy({
          by: ['category'],
          where: { userId },
        });

        const dbCategories = categoryList.map((c) => c.category);
        const customCategories = await getCustomAssetCategories(userId);
        const categoriesSet = new Set(['默认', ...dbCategories, ...customCategories]);

        return reply.send({
          ids: favorites.map((f) => f.assetId),
          favorites: favorites.map((f) => ({
            id: f.id,
            category: f.category,
            asset: {
              ...f.asset,
              isLiked: true,
            },
          })),
          categories: Array.from(categoriesSet),
        });
      } catch (error) {
        logger.error('[Fastify asset] getMyFavoriteAssets error:', error);
        throw error;
      }
    },
  );

  // POST /favorites/categories —— 创建收藏分类
  app.post(
    '/favorites/categories',
    {
      preHandler: authWithWorkspace,
    },
    async (request, reply) => {
      const userId = (request as AuthReq).userId as string;
      const { category } = request.body as { category?: string };

      if (!category || !category.trim()) {
        throw new AppError('分类名称不能为空', 400);
      }

      const newCat = category.trim();
      if (newCat === '默认') {
        throw new AppError('不能创建默认分类', 400);
      }

      try {
        const customCats = await getCustomAssetCategories(userId);
        if (!customCats.includes(newCat)) {
          customCats.push(newCat);
          await saveCustomAssetCategories(userId, customCats);
        }

        return reply.send({
          success: true,
          message: '分类创建成功',
          categories: ['默认', ...customCats],
        });
      } catch (error) {
        logger.error('[Fastify asset] createAssetFavoriteCategory error:', error);
        throw error;
      }
    },
  );

  // PUT /favorites/categories —— 更新收藏分类
  app.put(
    '/favorites/categories',
    {
      preHandler: authWithWorkspace,
    },
    async (request, reply) => {
      const userId = (request as AuthReq).userId as string;
      const { oldCategory, newCategory } = request.body as {
        oldCategory?: string;
        newCategory?: string;
      };

      if (!oldCategory || !newCategory) {
        throw new AppError('缺少必要参数', 400);
      }

      const oldCat = oldCategory.trim();
      const newCat = newCategory.trim();

      if (oldCat === '默认' || newCat === '默认') {
        throw new AppError('不能重命名默认分类', 400);
      }

      try {
        await prisma.assetLike.updateMany({
          where: {
            userId,
            category: oldCat,
          },
          data: {
            category: newCat,
          },
        });

        const customCats = await getCustomAssetCategories(userId);
        const updatedCats = customCats.map((c) => (c === oldCat ? newCat : c));
        await saveCustomAssetCategories(userId, updatedCats);

        return reply.send({ success: true, message: '分类更新成功' });
      } catch (error) {
        logger.error('[Fastify asset] updateAssetFavoriteCategory error:', error);
        throw error;
      }
    },
  );

  // DELETE /favorites/categories/:categoryName —— 删除收藏分类
  app.delete(
    '/favorites/categories/:categoryName',
    {
      preHandler: authWithWorkspace,
      schema: { params: categoryNameParamsSchema },
    },
    async (request, reply) => {
      const userId = (request as AuthReq).userId as string;
      const categoryName = (request.params as { categoryName: string }).categoryName;

      if (!categoryName) {
        throw new AppError('缺少分类名称', 400);
      }

      const cat = categoryName.trim();

      if (cat === '默认') {
        throw new AppError('不能删除默认分类', 400);
      }

      try {
        await prisma.assetLike.deleteMany({
          where: {
            userId,
            category: cat,
          },
        });

        const customCats = await getCustomAssetCategories(userId);
        const filteredCats = customCats.filter((c) => c !== cat);
        await saveCustomAssetCategories(userId, filteredCats);

        return reply.send({ success: true, message: '分类删除成功' });
      } catch (error) {
        logger.error('[Fastify asset] deleteAssetFavoriteCategory error:', error);
        throw error;
      }
    },
  );

  // GET /insights —— 资产洞察
  app.get(
    '/insights',
    {
      preHandler: authWithWorkspace,
    },
    async (request, reply) => {
      try {
        const userId = (request as AuthReq).userId as string;
        const [assets, categories, likedCount, myUploads, pendingCount, myDrafts] =
          await Promise.all([
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
            prisma.asset.count({
              where: { status: 'PENDING', teamId: (request as AuthReq).workspaceId },
            }),
            prisma.asset.count({ where: { userId, status: 'PENDING' } }),
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

        return reply.send({
          summary: {
            total: assets.length,
            downloads: totalDownloads,
            views: totalViews,
            likes: totalLikes,
            myLikes: likedCount,
            myUploads,
            myDrafts,
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
        logger.error('[Fastify asset] getAssetInsights error:', error);
        throw error;
      }
    },
  );

  // GET /tags —— 资产标签
  app.get(
    '/tags',
    {
      preHandler: authWithWorkspace,
    },
    async (request, reply) => {
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
        const searchCounts = await Promise.all(
          allTags.map((tag) => redisService.get<number>(tagSearchKey(tag)).then((v) => v ?? 0)),
        );
        const result = allTags.map((tag, i) => ({
          label: tag,
          count: tagUsageCounts[tag] || 0,
          searchCount: searchCounts[i] ?? 0,
        }));

        result.sort((a, b) => b.searchCount - a.searchCount || b.count - a.count);

        return reply.send(result);
      } catch (error) {
        logger.error('[Fastify asset] getAssetTags error:', error);
        throw error;
      }
    },
  );

  // GET /requests —— 求资源列表
  app.get(
    '/requests',
    {
      preHandler: authWithWorkspace,
      schema: { querystring: requestsQuerySchema },
    },
    async (request, reply) => {
      try {
        const { page, limit, skip } = getPaginationParams(
          request.query as Record<string, unknown>,
          20,
          50,
        );
        const status = (request.query as Record<string, string | undefined>).status as
          | string
          | undefined;

        const where: Prisma.AssetRequestWhereInput = {};
        if (status && status !== 'ALL') {
          where.status = status;
        }

        const [requests, total] = await Promise.all([
          prisma.assetRequest.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
            include: {
              user: { select: { id: true, name: true, avatarUrl: true } },
              _count: { select: { replies: true } },
            },
          }),
          prisma.assetRequest.count({ where }),
        ]);

        return reply.send({
          requests,
          pagination: createPaginationMeta(page, limit, total),
        });
      } catch (error) {
        logger.error('[Fastify asset] listAssetRequests error:', error);
        throw error;
      }
    },
  );

  // GET /requests/:id —— 求资源详情
  app.get(
    '/requests/:id',
    {
      preHandler: authWithWorkspace,
      schema: { params: idParamsSchema },
    },
    async (request, reply) => {
      const id = (request.params as { id: string }).id;
      try {
        const requestRecord = await prisma.assetRequest.findUnique({
          where: { id },
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
            replies: {
              orderBy: { createdAt: 'asc' },
              include: {
                user: { select: { id: true, name: true, avatarUrl: true } },
                linkedAsset: {
                  select: {
                    id: true,
                    title: true,
                    type: true,
                    thumbnail: true,
                    downloads: true,
                  },
                },
              },
            },
          },
        });

        if (!requestRecord) {
          throw new AppError('求助帖不存在', 404);
        }

        return reply.send(requestRecord);
      } catch (error) {
        logger.error('[Fastify asset] getAssetRequestById error:', error);
        throw error;
      }
    },
  );

  // POST /requests —— 创建求资源
  app.post(
    '/requests',
    {
      preHandler: [fastifyAuthenticate],
      schema: { body: assetRequestSchema },
    },
    async (request, reply) => {
      const { title, description } = request.body as { title: string; description: string };

      try {
        const newRequest = await prisma.assetRequest.create({
          data: {
            title: title.trim(),
            description: description.trim(),
            userId: (request as AuthReq).userId!,
            status: 'OPEN',
          },
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
            _count: { select: { replies: true } },
          },
        });

        return reply.status(201).send(newRequest);
      } catch (error) {
        logger.error('[Fastify asset] createAssetRequest error:', error);
        throw error;
      }
    },
  );

  // POST /requests/:id/replies —— 回复求资源
  app.post(
    '/requests/:id/replies',
    {
      preHandler: [fastifyAuthenticate],
      schema: { params: idParamsSchema, body: assetRequestReplySchema },
    },
    async (request, reply) => {
      const requestId = (request.params as { id: string }).id;
      const { content, linkedAssetId } = request.body as {
        content: string;
        linkedAssetId?: string | null;
      };

      try {
        const existingRequest = await prisma.assetRequest.findUnique({
          where: { id: requestId },
        });
        if (!existingRequest) throw new AppError('求助帖不存在', 404);

        if (linkedAssetId) {
          const asset = await prisma.asset.findFirst({
            where: { id: linkedAssetId, status: 'APPROVED' },
          });
          if (!asset) throw new AppError('关联的模型不存在或未被批准发布', 400);
        }

        const replyRecord = await prisma.assetRequestReply.create({
          data: {
            requestId,
            userId: (request as AuthReq).userId!,
            content: content.trim(),
            linkedAssetId: linkedAssetId || null,
          },
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
            linkedAsset: {
              select: {
                id: true,
                title: true,
                type: true,
                thumbnail: true,
                downloads: true,
              },
            },
          },
        });

        return reply.status(201).send(replyRecord);
      } catch (error) {
        logger.error('[Fastify asset] createAssetRequestReply error:', error);
        throw error;
      }
    },
  );

  // POST /requests/:id/resolve —— 解决求资源
  app.post(
    '/requests/:id/resolve',
    {
      preHandler: [fastifyAuthenticate],
      schema: { params: idParamsSchema },
    },
    async (request, reply) => {
      const requestId = (request.params as { id: string }).id;
      try {
        const existingRequest = await prisma.assetRequest.findUnique({
          where: { id: requestId },
        });
        if (!existingRequest) throw new AppError('求助帖不存在', 404);

        if (
          existingRequest.userId !== (request as AuthReq).userId &&
          (request as AuthReq).user?.role !== 'ADMIN'
        ) {
          throw new AppError('无权关闭此求助贴', 403);
        }

        const updated = await prisma.assetRequest.update({
          where: { id: requestId },
          data: { status: 'RESOLVED' },
        });

        return reply.send(updated);
      } catch (error) {
        logger.error('[Fastify asset] resolveAssetRequest error:', error);
        throw error;
      }
    },
  );

  // POST /:id/download —— 记录下载
  app.post(
    '/:id/download',
    {
      preHandler: authWithWorkspace,
      schema: { params: idParamsSchema },
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const id = (request.params as { id: string }).id;
      const userId = (request as AuthReq).userId || 'anonymous';
      const lockKey = `asset_download:${id}:${userId}`;
      try {
        const accessibleAsset = await prisma.asset.findFirst({
          where: getAssetAccessWhere(id, request as unknown as AuthRequest),
          select: { id: true, downloads: true, isFree: true, userId: true },
        });
        if (!accessibleAsset) {
          throw new AppError('Asset not found', 404);
        }

        if (!accessibleAsset.isFree) {
          const currentUserId = (request as AuthReq).userId;
          const isOwner = currentUserId && accessibleAsset.userId === currentUserId;
          const isAdmin = (request as AuthReq).user?.role === 'ADMIN';
          if (!isOwner && !isAdmin) {
            const isVip = currentUserId ? await checkIsUserVip(currentUserId) : false;
            if (!isVip) {
              throw new AppError(
                '该模型为会员专享，请先升级为会员后再下载。',
                403,
                'DOWNLOAD_VIP_REQUIRED',
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
          await redisService.set(lockKey, true, 86400);
        }
        return reply.send({ message: 'Download recorded', downloads });
      } catch (error) {
        logger.error('[Fastify asset] recordAssetDownload error:', error);
        throw error;
      }
    },
  );

  // POST /:id/like —— 切换点赞
  app.post(
    '/:id/like',
    {
      preHandler: authWithWorkspace,
      schema: { params: idParamsSchema },
    },
    async (request, reply) => {
      const id = (request.params as { id: string }).id;
      const userId = (request as AuthReq).userId;
      if (!userId) {
        throw new AppError('Unauthorized', 401);
      }
      const body = (request.body ?? {}) as Record<string, unknown>;
      const categoryVal = typeof body.category === 'string' ? body.category.trim() : '默认';
      const category = categoryVal || '默认';
      try {
        const asset = await prisma.asset.findFirst({
          where: { id, status: 'APPROVED' },
          select: { id: true },
        });

        if (!asset) {
          throw new AppError('Asset not found', 404);
        }

        const result = await prisma.$transaction(async (tx) => {
          return await withRowLock(tx, 'Asset', id, async (lockedTx) => {
            const existingLike = await lockedTx.assetLike.findUnique({
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
                await lockedTx.assetLike.delete({
                  where: {
                    id: existingLike.id,
                  },
                });
                liked = false;
              } else {
                await lockedTx.assetLike.update({
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
              await lockedTx.assetLike.create({
                data: {
                  assetId: id,
                  userId,
                  category,
                },
              });
              liked = true;
            }

            const likes = await lockedTx.assetLike.count({ where: { assetId: id } });
            await lockedTx.asset.update({
              where: { id },
              data: { likes },
            });

            return { liked, likes };
          });
        });

        if (result.liked && category !== '默认') {
          const customCats = await getCustomAssetCategories(userId);
          if (!customCats.includes(category)) {
            customCats.push(category);
            await saveCustomAssetCategories(userId, customCats);
          }
        }

        return reply.send({
          message: result.liked ? 'Like recorded' : 'Like removed',
          likes: result.likes,
          liked: result.liked,
        });
      } catch (error) {
        logger.error('[Fastify asset] toggleAssetLike error:', error);
        throw error;
      }
    },
  );

  // GET /:id/toolkit —— 资产工具包
  app.get(
    '/:id/toolkit',
    {
      preHandler: authWithWorkspace,
      schema: { params: idParamsSchema },
    },
    async (request, reply) => {
      const id = (request.params as { id: string }).id;
      try {
        const asset = await prisma.asset.findUnique({
          where: { id },
          include: {
            category: true,
            user: { select: { id: true, name: true, avatarUrl: true, role: true } },
            linkedCourse: { select: { id: true, title: true } },
            linkedLesson: { select: { id: true, title: true } },
          },
        });

        if (!asset) {
          throw new AppError('Asset not found', 404);
        }

        checkAssetAccess(asset, request as unknown as AuthRequest);

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

        const canAnnotate = !!(await prisma.asset.findFirst({
          where: getAssetCollaborationWhere(id, request as unknown as AuthRequest),
          select: { id: true },
        }));

        return reply.send({
          asset: { ...asset, performanceReport: buildAssetPerformanceReport(asset) },
          versions: enrichedVersions,
          annotationCount,
          canAnnotate,
          coverCandidates: [
            asset.thumbnail,
            ...versions.map((version) => version.thumbnail).filter(Boolean),
          ].filter(Boolean),
        });
      } catch (error) {
        logger.error('[Fastify asset] getAssetToolkit error:', error);
        throw error;
      }
    },
  );

  // GET /:id/package-files —— 包内文件列表
  app.get(
    '/:id/package-files',
    {
      preHandler: authWithWorkspace,
      schema: { params: idParamsSchema },
    },
    async (request, reply) => {
      const id = (request.params as { id: string }).id;
      try {
        logger.debug(`[getAssetPackageFiles] Fetching package files for ID: ${id}`);
        const asset = await prisma.asset.findUnique({
          where: { id },
          select: {
            id: true,
            status: true,
            teamId: true,
            userId: true,
            packageUrl: true,
            packageFilesList: true,
          },
        });

        if (!asset) {
          throw new AppError('Asset not found', 404);
        }

        checkAssetAccess(asset, request as unknown as AuthRequest);

        if (!asset.packageUrl) {
          return reply.send({ packageFiles: [] });
        }

        if (asset.packageFilesList) {
          try {
            const files = JSON.parse(asset.packageFilesList);
            if (Array.isArray(files)) {
              return reply.send({ packageFiles: files });
            }
          } catch (e) {
            logger.warn('[getAssetPackageFiles] JSON parse error on packageFilesList:', e);
          }
        }

        const packageFiles = await getZipFileNames(asset.packageUrl);

        if (packageFiles.length > 0) {
          await prisma.asset
            .update({
              where: { id },
              data: { packageFilesList: JSON.stringify(packageFiles) },
            })
            .catch((err) => {
              logger.error(
                `[Asset] Failed to update packageFilesList fallback for asset ${id}:`,
                err,
              );
            });
        }

        return reply.send({ packageFiles });
      } catch (error) {
        logger.error('[Fastify asset] getAssetPackageFiles error:', error);
        throw error;
      }
    },
  );

  // GET /:id/status —— 资产处理状态
  app.get(
    '/:id/status',
    {
      preHandler: authWithWorkspace,
      schema: { params: idParamsSchema },
    },
    async (request, reply) => {
      const id = (request.params as { id: string }).id;
      try {
        const asset = await prisma.asset.findUnique({
          where: { id },
          select: {
            id: true,
            status: true,
            url: true,
            thumbnail: true,
            faces: true,
            vertices: true,
            hasAnimations: true,
            size: true,
          },
        });

        if (!asset) {
          throw new AppError('Asset not found', 404);
        }

        let processingStatus: 'idle' | 'pending' | 'running' | 'completed' | 'failed' = 'idle';
        try {
          const jobStatus = await redisService.get<string>(`draco-job-status:${id}`);
          if (jobStatus) {
            processingStatus = jobStatus as typeof processingStatus;
          } else if (asset.faces !== null || asset.vertices !== null) {
            processingStatus = 'completed';
          }
        } catch {
          /* Redis 不可用时不影响状态查询 */
        }

        return reply.send({
          id: asset.id,
          status: asset.status,
          processingStatus,
          hasMetadata: asset.faces !== null || asset.vertices !== null,
        });
      } catch (error) {
        logger.error('[Fastify asset] getAssetStatus error:', error);
        throw error;
      }
    },
  );

  // PATCH /:id/metadata —— 更新资产元数据
  app.patch(
    '/:id/metadata',
    {
      preHandler: authWithWorkspace,
      schema: { params: idParamsSchema },
    },
    async (request, reply) => {
      const id = (request.params as { id: string }).id;
      const { vertices, faces, materials, animations, hasAnimations, dimensions, maxTextureRes } =
        request.body as Record<string, unknown>;

      try {
        const existingAsset = await prisma.asset.findFirst({
          where: {
            id,
            OR: [
              { userId: (request as AuthReq).userId as string },
              { teamId: (request as AuthReq).workspaceId },
            ],
          },
        });

        if (!existingAsset) {
          throw new AppError('Asset not found or access denied in this workspace', 404);
        }

        const updateData: Prisma.AssetUpdateInput = {};

        if (vertices !== undefined) updateData.vertices = parseInt(String(vertices), 10);
        if (faces !== undefined) updateData.faces = parseInt(String(faces), 10);
        if (materials !== undefined) updateData.materials = parseInt(String(materials), 10);
        if (animations !== undefined) updateData.animations = parseInt(String(animations), 10);
        if (maxTextureRes !== undefined)
          updateData.maxTextureRes = parseInt(String(maxTextureRes), 10);
        if (hasAnimations !== undefined) {
          updateData.hasAnimations = hasAnimations === true || hasAnimations === 'true';
        }
        if (dimensions !== undefined) updateData.dimensions = String(dimensions);

        const asset = await prisma.asset.update({
          where: { id },
          data: updateData,
        });
        const signedAsset = await signAssetUrls(asset);
        return reply.send({
          ...signedAsset,
          performanceReport: buildAssetPerformanceReport(asset),
        });
      } catch (error) {
        logger.error('[Fastify asset] updateAssetMetadata error:', error);
        throw error;
      }
    },
  );

  // DELETE /:id —— 删除资产
  app.delete(
    '/:id',
    {
      preHandler: authWithWorkspace,
      schema: { params: idParamsSchema },
    },
    async (request, reply) => {
      const id = (request.params as { id: string }).id;
      try {
        const asset = await prisma.asset.findFirst({
          where: { id },
        });

        if (!asset) {
          throw new AppError('Asset not found', 404);
        }

        if (
          asset.userId !== (request as AuthReq).userId &&
          (request as AuthReq).user?.role !== 'ADMIN'
        ) {
          const membership = await prisma.teamMember.findFirst({
            where: { teamId: asset.teamId || '', userId: (request as AuthReq).userId },
          });
          if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
            throw new AppError('Not authorized to delete this asset', 403);
          }
        }

        const fileSizeBytes = asset.packageSize
          ? Math.round(asset.packageSize * 1024 * 1024)
          : undefined;
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
          userId: (request as AuthReq).userId as string,
          action: AuditAction.DELETE_ASSET,
          module: AuditModule.ASSET,
          description: `Deleted asset: ${asset.title}`,
          oldValue: asset,
          req: request as unknown as AuditRequest,
        });

        return reply.send({ message: 'Asset deleted successfully' });
      } catch (error) {
        logger.error('[Fastify asset] deleteAsset error:', error);
        throw error;
      }
    },
  );

  // POST /bulk-delete —— 批量删除
  app.post(
    '/bulk-delete',
    {
      preHandler: authWithWorkspace,
    },
    async (request, reply) => {
      try {
        const { ids } = request.body as { ids?: string[] };
        if (!Array.isArray(ids) || ids.length === 0) {
          return reply.status(400).send({ error: '请提供要删除的资产 ID 列表' });
        }

        const whereCondition: Prisma.AssetWhereInput = {
          id: { in: ids },
        };
        if ((request as AuthReq).user?.role !== 'ADMIN') {
          whereCondition.userId = (request as AuthReq).userId;
        }

        const assetsToDelete = await prisma.asset.findMany({
          where: whereCondition,
        });

        if (assetsToDelete.length === 0) {
          return reply.status(404).send({ error: '未找到可删除的资产或无权操作' });
        }

        for (const asset of assetsToDelete) {
          deleteCloudOrLocalFileByUrl(asset.url).catch((err) => {
            logger.error(`[AssetController] Bulk delete: failed to delete file ${asset.url}:`, err);
          });
          if (asset.thumbnail) {
            deleteCloudOrLocalFileByUrl(asset.thumbnail).catch((err) => {
              logger.error(
                `[AssetController] Bulk delete: failed to delete thumbnail ${asset.thumbnail}:`,
                err,
              );
            });
          }
        }

        const deleteIds = assetsToDelete.map((a) => a.id);
        await prisma.asset.deleteMany({
          where: { id: { in: deleteIds } },
        });

        return reply.send({
          success: true,
          message: `成功批量删除 ${deleteIds.length} 个资产`,
          count: deleteIds.length,
          deletedIds: deleteIds,
        });
      } catch (error) {
        logger.error('[Fastify asset] bulkDeleteAssets error:', error);
        throw error;
      }
    },
  );

  // POST /bulk/favorite —— 批量收藏
  app.post(
    '/bulk/favorite',
    {
      preHandler: authWithWorkspace,
    },
    async (request, reply) => {
      try {
        const userId = (request as AuthReq).userId as string;
        const body = (request.body ?? {}) as Record<string, unknown>;
        const rawIds: unknown[] = Array.isArray(body.ids) ? body.ids : [];
        const categoryVal = typeof body.category === 'string' ? body.category.trim() : '默认';
        const category = categoryVal || '默认';
        const ids = Array.from(
          new Set<string>(rawIds.map((id) => String(id)).filter((id) => Boolean(id))),
        ).slice(0, 100);
        const favorite = body.favorite !== false;

        if (!ids.length) {
          throw new AppError('No assets selected', 400);
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

        for (const assetId of approvedIds) {
          const likes = await prisma.assetLike.count({ where: { assetId } });
          await prisma.asset.update({
            where: { id: assetId },
            data: { likes },
          });
        }

        return reply.send({ success: true });
      } catch (error) {
        logger.error('[Fastify asset] bulkFavoriteAssets error:', error);
        throw error;
      }
    },
  );

  // GET /:id/versions —— 版本列表
  app.get(
    '/:id/versions',
    {
      preHandler: authWithWorkspace,
      schema: { params: idParamsSchema },
    },
    async (request, reply) => {
      const id = (request.params as { id: string }).id;
      try {
        const asset = await prisma.asset.findUnique({
          where: { id },
          select: { id: true, status: true, teamId: true, userId: true },
        });

        if (!asset) {
          throw new AppError('Asset not found', 404);
        }

        checkAssetAccess(asset, request as unknown as AuthRequest);

        const versions = await prisma.assetVersion.findMany({
          where: { assetId: id },
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { name: true, avatarUrl: true } },
          },
        });

        const signedVersions = await Promise.all(
          versions.map(async (version, index) => {
            const vSigned = { ...version };
            if (vSigned.url) {
              vSigned.url =
                (await signPrivateUrlIfNeeded(vSigned.url, asset, 'url')) ?? vSigned.url;
            }
            if (vSigned.packageUrl) {
              vSigned.packageUrl =
                (await signPrivateUrlIfNeeded(vSigned.packageUrl, asset, 'packageUrl')) ??
                vSigned.packageUrl;
            }
            return {
              ...vSigned,
              performanceReport: buildAssetPerformanceReport(vSigned),
              comparison: buildVersionComparison(vSigned, versions[index + 1]),
            };
          }),
        );

        return reply.send(signedVersions);
      } catch (error) {
        logger.error('[Fastify asset] getAssetVersions error:', error);
        throw error;
      }
    },
  );

  // POST /:id/annotations —— 创建标注
  app.post(
    '/:id/annotations',
    {
      preHandler: authWithWorkspace,
      schema: { params: idParamsSchema, body: assetAnnotationSchema },
    },
    async (request, reply) => {
      const id = (request.params as { id: string }).id;
      const { content, x, y, z, cameraPos, cameraTarget } = request.body as {
        content: string;
        x: number;
        y: number;
        z: number;
        cameraPos?: unknown;
        cameraTarget?: unknown;
      };

      if (!content) {
        throw new AppError('Comment content is required', 400);
      }

      try {
        const existingAsset = await prisma.asset.findFirst({
          where: getAssetCollaborationWhere(id, request as unknown as AuthRequest),
        });
        if (!existingAsset) {
          throw new AppError('Asset not found or collaboration access denied', 403);
        }

        const coords = [x, y, z].map((value) => parseFloat(String(value)));
        if (coords.some((value) => !Number.isFinite(value))) {
          throw new AppError('Invalid annotation coordinates', 400);
        }

        const annotation = await prisma.assetAnnotation.create({
          data: {
            assetId: id,
            userId: (request as AuthReq).userId as string,
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
          userId: (request as AuthReq).userId as string,
          action: 'CREATE_ASSET_ANNOTATION',
          module: AuditModule.ASSET,
          description: `Added annotation to asset: ${existingAsset.title}`,
          newValue: annotation,
          req: request as unknown as AuditRequest,
        });

        return reply.status(201).send(annotation);
      } catch (error) {
        logger.error('[Fastify asset] createAssetAnnotation error:', error);
        throw error;
      }
    },
  );

  // DELETE /:id/annotations/:annotationId —— 删除标注
  app.delete(
    '/:id/annotations/:annotationId',
    {
      preHandler: authWithWorkspace,
      schema: { params: idAnnotationParamsSchema },
    },
    async (request, reply) => {
      const annotationId = (request.params as { annotationId: string }).annotationId;
      try {
        const annotation = await prisma.assetAnnotation.findUnique({
          where: { id: annotationId },
          include: {
            asset: { select: { id: true, title: true, userId: true, teamId: true } },
          },
        });

        if (!annotation) {
          throw new AppError('Annotation not found', 404);
        }

        const isAnnotationOwner = annotation.userId === (request as AuthReq).userId;
        const isAssetOwner = annotation.asset.userId === (request as AuthReq).userId;
        const canDelete =
          isAnnotationOwner || isAssetOwner || (request as AuthReq).user?.role === 'ADMIN';

        if (!canDelete) {
          throw new AppError('Not authorized to delete this annotation', 403);
        }

        await prisma.assetAnnotation.delete({
          where: { id: annotationId },
        });

        await auditService.log({
          userId: (request as AuthReq).userId as string,
          action: 'DELETE_ASSET_ANNOTATION',
          module: AuditModule.ASSET,
          description: `Deleted annotation from asset: ${annotation.asset.title}`,
          oldValue: annotation,
          req: request as unknown as AuditRequest,
        });

        return reply.send({ message: 'Annotation deleted successfully' });
      } catch (error) {
        logger.error('[Fastify asset] deleteAssetAnnotation error:', error);
        throw error;
      }
    },
  );

  // GET /:id/share —— 获取分享
  app.get(
    '/:id/share',
    {
      preHandler: [fastifyAuthenticate],
      schema: { params: idParamsSchema },
    },
    async (request, reply) => {
      const assetId = (request.params as { id: string }).id;
      try {
        const asset = await prisma.asset.findFirst({
          where:
            (request as AuthReq).user?.role === 'ADMIN'
              ? { id: assetId }
              : {
                  id: assetId,
                  OR: [
                    { userId: (request as AuthReq).userId },
                    { teamId: (request as AuthReq).workspaceId },
                  ],
                },
        });
        if (!asset) {
          throw new AppError('Asset not found or access denied', 404);
        }
        const share = await prisma.assetShare.findUnique({
          where: { assetId },
        });
        return reply.send(share);
      } catch (error) {
        logger.error('[Fastify asset] getAssetShare error:', error);
        throw error;
      }
    },
  );

  // POST /:id/share —— 创建/更新分享
  app.post(
    '/:id/share',
    {
      preHandler: [fastifyAuthenticate],
      schema: { params: idParamsSchema, body: assetShareSchema },
    },
    async (request, reply) => {
      const assetId = (request.params as { id: string }).id;
      const userId = (request as AuthReq).userId as string;
      const { expireHours, expiresAt, customText } = request.body as {
        expireHours?: number | null;
        expiresAt?: string | null;
        customText?: string | null;
      };
      try {
        const asset = await prisma.asset.findFirst({
          where:
            (request as AuthReq).user?.role === 'ADMIN'
              ? { id: assetId }
              : {
                  id: assetId,
                  OR: [
                    { userId: (request as AuthReq).userId },
                    { teamId: (request as AuthReq).workspaceId },
                  ],
                },
        });
        if (!asset) {
          throw new AppError('Asset not found or access denied', 404);
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

        return reply.send(share);
      } catch (error) {
        logger.error('[Fastify asset] createOrUpdateAssetShare error:', error);
        throw error;
      }
    },
  );

  // DELETE /:id/share —— 取消分享
  app.delete(
    '/:id/share',
    {
      preHandler: [fastifyAuthenticate],
      schema: { params: idParamsSchema },
    },
    async (request, reply) => {
      const assetId = (request.params as { id: string }).id;
      try {
        const asset = await prisma.asset.findFirst({
          where:
            (request as AuthReq).user?.role === 'ADMIN'
              ? { id: assetId }
              : {
                  id: assetId,
                  OR: [
                    { userId: (request as AuthReq).userId },
                    { teamId: (request as AuthReq).workspaceId },
                  ],
                },
        });
        if (!asset) {
          throw new AppError('Asset not found or access denied', 404);
        }

        await prisma.assetShare.deleteMany({
          where: { assetId },
        });

        return reply.send({ success: true, message: 'Share link cancelled' });
      } catch (error) {
        logger.error('[Fastify asset] cancelAssetShare error:', error);
        throw error;
      }
    },
  );

  // POST /:id/comments —— 创建评论
  app.post(
    '/:id/comments',
    {
      preHandler: authWithWorkspace,
      schema: { params: idParamsSchema, body: assetCommentSchema },
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const assetId = (request.params as { id: string }).id;
      const userId = (request as AuthReq).user?.id;
      const { content } = request.body as { content: string };

      if (!userId) {
        throw new AppError('Unauthorized', 401);
      }
      if (!content || !content.trim()) {
        throw new AppError('Comment content cannot be empty', 400);
      }

      try {
        const asset = await prisma.asset.findFirst({
          where: getAssetAccessWhere(assetId, request as unknown as AuthRequest),
        });
        if (!asset) {
          throw new AppError('Asset not found or access denied', 404);
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
        return reply.status(201).send(comment);
      } catch (error) {
        logger.error('[Fastify asset] createAssetComment error:', error);
        throw error;
      }
    },
  );

  // DELETE /comments/:commentId —— 删除评论
  app.delete(
    '/comments/:commentId',
    {
      preHandler: [fastifyAuthenticate],
      schema: { params: commentIdParamsSchema },
    },
    async (request, reply) => {
      const commentId = (request.params as { commentId: string }).commentId;
      const userId = (request as AuthReq).user?.id;
      const userRole = (request as AuthReq).user?.role;

      if (!userId) {
        throw new AppError('Unauthorized', 401);
      }

      try {
        const comment = await prisma.assetComment.findUnique({
          where: { id: commentId },
        });

        if (!comment) {
          throw new AppError('Comment not found', 404);
        }

        if (comment.userId !== userId && userRole !== 'ADMIN') {
          throw new AppError('Forbidden', 403);
        }

        await prisma.assetComment.delete({
          where: { id: commentId },
        });

        return reply.send({ success: true, message: 'Comment deleted successfully' });
      } catch (error) {
        logger.error('[Fastify asset] deleteAssetComment error:', error);
        throw error;
      }
    },
  );

  // POST /upload —— 上传资产
  app.post(
    '/upload',
    {
      preHandler: [
        fastifyAuthenticate,
        fastifyResolveWorkspace,
        fastifyUpload([
          { name: 'asset', maxCount: 1 },
          { name: 'thumbnail', maxCount: 1 },
          { name: 'package', maxCount: 1 },
        ]),
      ],
    },
    async (request, reply) => {
      try {
        const { title, categoryId } = z
          .object({
            title: z.string().min(1, 'Title is required'),
            categoryId: z.string().min(1, 'Category is required'),
          })
          .parse(request.body);

        const body = request.body as Record<string, unknown>;
        const userId = (request as AuthReq).userId as string;
        const workspaceId = (request as AuthReq).workspaceId;
        const files = (request as unknown as { files?: Record<string, UploadedFile[]> }).files;
        const assetFile = files?.asset?.[0];
        const packageFile = files?.package?.[0];
        const externalUrl = body.externalUrl as string | undefined;

        let tempAssetPath = body.tempAssetPath as string | undefined;
        let tempPackagePath = body.tempPackagePath as string | undefined;
        let tempThumbnailPath = body.tempThumbnailPath as string | undefined;

        if (!assetFile && !tempAssetPath && !externalUrl) {
          throw new AppError('No asset file or external link provided', 400);
        }

        const idempotencyKey = (body.idempotencyKey ||
          request.headers['idempotency-key'] ||
          `upload:${userId}:${title}`) as string;
        const lockKey = `lock:upload:${idempotencyKey}`;

        const lockAcquired = await redisService.acquireLock(lockKey, 30);
        if (!lockAcquired) {
          const activeJob = await prisma.job.findFirst({
            where: {
              idempotencyKey,
              status: { in: ['PENDING', 'RUNNING'] },
            },
          });
          if (activeJob) {
            return reply.status(202).send({
              jobId: activeJob.id,
              status: activeJob.status,
            });
          }
          await safeUnlink(assetFile?.url);
          await safeUnlink(packageFile?.url);
          return reply.status(409).send({ error: 'Concurrent upload in progress' });
        }

        try {
          const activeJob = await prisma.job.findFirst({
            where: {
              idempotencyKey,
              status: { in: ['PENDING', 'RUNNING'] },
            },
          });
          if (activeJob) {
            await safeUnlink(assetFile?.url);
            await safeUnlink(packageFile?.url);
            return reply.status(202).send({
              jobId: activeJob.id,
              status: activeJob.status,
            });
          }

          if (assetFile) {
            const ext = path.extname(assetFile.originalname).toLowerCase();
            if (ext !== '.glb') {
              await safeUnlink(assetFile?.url);
              await safeUnlink(packageFile?.url);
              throw new AppError('Main asset file must be in GLB format (.glb)', 400);
            }
          }

          if (packageFile) {
            const ext = path.extname(packageFile.originalname).toLowerCase();
            if (ext !== '.zip') {
              await safeUnlink(assetFile?.url);
              await safeUnlink(packageFile?.url);
              throw new AppError('Resource package file must be in ZIP format (.zip)', 400);
            }
          }

          if (tempAssetPath) {
            tempAssetPath = moveTempFileToDestination(request, tempAssetPath, 'assets');
          }
          if (tempPackagePath) {
            tempPackagePath = moveTempFileToDestination(request, tempPackagePath, 'assets');
          }
          if (tempThumbnailPath) {
            tempThumbnailPath = moveTempFileToDestination(request, tempThumbnailPath, 'assets');
          }

          const assetQuota = await checkAssetQuota(userId, workspaceId);
          if (!assetQuota.allowed) {
            await safeUnlink(assetFile?.url);
            await safeUnlink(packageFile?.url);
            throw new AppError(assetQuota.message || 'Asset quota exceeded', 403);
          }

          let fileSizeMB = body.fileSize ? parseFloat(String(body.fileSize)) / (1024 * 1024) : 0;
          if (fileSizeMB === 0) {
            fileSizeMB = assetFile ? parseFloat((assetFile.size / (1024 * 1024)).toFixed(2)) : 0;
            if (!assetFile && tempAssetPath) {
              fileSizeMB = await getFileSizeInMb(tempAssetPath);
            }
          }

          let packageSizeMB = body.packageSize
            ? parseFloat(String(body.packageSize)) / (1024 * 1024)
            : 0;
          if (packageSizeMB === 0) {
            packageSizeMB = packageFile
              ? parseFloat((packageFile.size / (1024 * 1024)).toFixed(2))
              : 0;
            if (!packageFile && tempPackagePath) {
              packageSizeMB = await getFileSizeInMb(tempPackagePath);
            }
          }

          const totalSizeMB = fileSizeMB + packageSizeMB;

          const storageQuota = await checkStorageQuota(userId, totalSizeMB, workspaceId);
          if (!storageQuota.allowed) {
            await safeUnlink(assetFile?.url);
            await safeUnlink(packageFile?.url);
            throw new AppError(storageQuota.message || 'Storage quota exceeded', 403);
          }

          const {
            description,
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
            bilibiliUrl,
          } = body;

          let url = externalUrl;
          let type = 'LINK';
          let size = fileSizeMB;

          let assetBufferForJob: Buffer | null = null;
          let assetExtForJob = '.glb';

          if (assetFile) {
            url = getUploadedFileUrl(
              request,
              assetFile as unknown as Express.Multer.File,
              'assets',
            );
            type = 'GLB';
            if (assetFile.buffer) {
              assetBufferForJob = assetFile.buffer;
              assetExtForJob = path.extname(assetFile.originalname).toLowerCase() || '.glb';
            }
          } else if (tempAssetPath) {
            url = tempAssetPath;
            type = 'GLB';
          }

          let packageUrl = null;
          let packageSize = null;
          let packageFilesList: string[] = [];
          if (body.packageFilesList) {
            try {
              packageFilesList = JSON.parse(String(body.packageFilesList));
            } catch {
              /* ignore */
            }
          }

          if (packageFile) {
            packageUrl = getUploadedFileUrl(
              request,
              packageFile as unknown as Express.Multer.File,
              'assets',
            );
            packageSize = packageSizeMB;
            if (packageFilesList.length === 0 && packageFile.buffer) {
              try {
                packageFilesList = await parseZipBuffer(packageFile.buffer);
              } catch (zipErr) {
                logger.error('[AssetUpload] Failed to parse package ZIP from buffer:', zipErr);
              }
            }
          } else if (tempPackagePath) {
            packageUrl = tempPackagePath;
            packageSize = packageSizeMB;
          }

          let thumbnailUrl = null;
          if (files?.thumbnail?.[0]) {
            thumbnailUrl = getUploadedFileUrl(
              request,
              files.thumbnail[0] as unknown as Express.Multer.File,
              'assets',
            );
          } else if (tempThumbnailPath) {
            thumbnailUrl = tempThumbnailPath;
          }

          let parsedFormats = formats;
          if (typeof formats === 'string') {
            try {
              parsedFormats = JSON.parse(formats);
            } catch {
              /* fallback */
            }
          }

          const parsedTags = normalizeAssetTags(tags);

          const asset = await prisma.asset.create({
            data: {
              title: title || (assetFile ? assetFile.originalname : 'External Link'),
              description: description as string | undefined,
              url: url as string,
              packageUrl,
              packageSize,
              packageFilesList:
                packageFilesList.length > 0 ? JSON.stringify(packageFilesList) : null,
              thumbnail: thumbnailUrl,
              type,
              size,
              categoryId,
              status: 'PENDING',
              userId,
              teamId: workspaceId,
              isFree: parseBool(isFree, true),
              formats: parsedFormats ? JSON.stringify(parsedFormats) : null,
              tags: parsedTags.length > 0 ? JSON.stringify(parsedTags) : null,
              bilibiliUrl: (bilibiliUrl as string) || null,
              originality: (originality as string) || 'ORIGINAL',
              originalAuthor: originalAuthor as string | undefined,
              originalLink: originalLink as string | undefined,
              license: (license as string) || 'CC_BY',
              meshType: (meshType as string) || 'LOW_POLY',
              uvUnwrapped: parseBool(uvUnwrapped, true),
              uvOverlapping: parseBool(uvOverlapping, false),
              pbrChannels: pbrChannels
                ? typeof pbrChannels === 'string'
                  ? pbrChannels
                  : JSON.stringify(pbrChannels)
                : null,
              rigged: parseBool(rigged, false),
              gameReady: parseBool(gameReady, false),
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
              defaultEnvironment: (defaultEnvironment as string) || 'studio',
              defaultExposure: parseNum(defaultExposure, 1.0) ?? 1.0,
              linkedCourseId: (linkedCourseId as string) || null,
              linkedLessonId: (linkedLessonId as string) || null,
            },
            include: { category: true },
          });

          const job = await QueueService.enqueue(
            'draco-compression',
            {
              assetId: asset.id,
              buffer: assetBufferForJob ? assetBufferForJob.toString('base64') : null,
              ext: assetExtForJob,
              file: assetFile ? (assetFile as unknown as UploadedFile) : null,
            },
            {
              idempotencyKey,
              type: 'draco-compression',
              userId,
            },
          );

          await auditService.log({
            userId,
            action: AuditAction.CREATE_ASSET,
            module: AuditModule.ASSET,
            description: `Uploaded asset: ${asset.title}`,
            newValue: asset,
            req: request as unknown as AuditRequest,
          });

          emitToAll('new_activity', {
            id: `a-${asset.id}`,
            user: (request as AuthReq).user?.name || '有人',
            action: '发布了新资产',
            target: asset.title,
            createdAt: asset.createdAt,
          });

          return reply.status(202).send({
            jobId: job?.id,
            status: 'PENDING',
          });
        } finally {
          await redisService.releaseLock(lockKey);
        }
      } catch (error) {
        logger.error('[Fastify asset] uploadAsset error:', error);
        throw error;
      }
    },
  );

  // PUT /:id —— 更新资产
  app.put(
    '/:id',
    {
      preHandler: [
        fastifyAuthenticate,
        fastifyResolveWorkspace,
        fastifyUpload([
          { name: 'asset', maxCount: 1 },
          { name: 'thumbnail', maxCount: 1 },
          { name: 'package', maxCount: 1 },
        ]),
      ],
      schema: { params: idParamsSchema },
    },
    async (request, reply) => {
      const id = (request.params as { id: string }).id;
      const files = (request as unknown as { files?: Record<string, UploadedFile[]> }).files;
      const assetFile = files?.asset?.[0];
      const packageFile = files?.package?.[0];
      const thumbnailFile = files?.thumbnail?.[0];

      const body = request.body as Record<string, unknown>;
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
      } = body;

      try {
        let tempAssetPath = body.tempAssetPath as string | undefined;
        let tempPackagePath = body.tempPackagePath as string | undefined;
        let tempThumbnailPath = body.tempThumbnailPath as string | undefined;

        if (tempAssetPath) {
          tempAssetPath = moveTempFileToDestination(request, tempAssetPath, 'assets');
        }
        if (tempPackagePath) {
          tempPackagePath = moveTempFileToDestination(request, tempPackagePath, 'assets');
        }
        if (tempThumbnailPath) {
          tempThumbnailPath = moveTempFileToDestination(request, tempThumbnailPath, 'assets');
        }

        const existingAsset = await prisma.asset.findFirst({
          where:
            (request as AuthReq).user?.role === 'ADMIN'
              ? { id }
              : { id, userId: (request as AuthReq).userId },
        });

        if (!existingAsset) {
          await safeUnlink(assetFile?.url);
          await safeUnlink(packageFile?.url);
          throw new AppError('Asset not found or access denied', 404);
        }

        const updateData: Prisma.AssetUncheckedUpdateInput = {};
        if (title !== undefined) updateData.title = title as string;
        if (description !== undefined) updateData.description = description as string;
        if (categoryId !== undefined) updateData.categoryId = categoryId as string;
        if (formats !== undefined) {
          let parsedFormats = formats;
          if (typeof formats === 'string') {
            try {
              parsedFormats = JSON.parse(formats);
            } catch {
              /* fallback */
            }
          }
          updateData.formats = parsedFormats ? JSON.stringify(parsedFormats) : null;
        }
        if (tags !== undefined) {
          const parsedTags = normalizeAssetTags(tags);
          updateData.tags = parsedTags.length > 0 ? JSON.stringify(parsedTags) : null;
        }

        if (originality !== undefined) updateData.originality = originality as string;
        if (originalAuthor !== undefined) updateData.originalAuthor = originalAuthor as string;
        if (originalLink !== undefined) updateData.originalLink = originalLink as string;
        if (license !== undefined) updateData.license = license as string;
        if (meshType !== undefined) updateData.meshType = meshType as string;
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
        if (defaultEnvironment !== undefined)
          updateData.defaultEnvironment = defaultEnvironment as string;
        if (defaultExposure !== undefined)
          updateData.defaultExposure = parseNum(defaultExposure, 1.0) ?? 1.0;
        if (linkedCourseId !== undefined)
          updateData.linkedCourseId = (linkedCourseId as string) || null;
        if (linkedLessonId !== undefined)
          updateData.linkedLessonId = (linkedLessonId as string) || null;
        if (isFree !== undefined) updateData.isFree = parseBool(isFree, true);
        if (bilibiliUrl !== undefined) updateData.bilibiliUrl = (bilibiliUrl as string) || null;

        let packageFilesList: string[] = [];
        if (body.packageFilesList) {
          try {
            packageFilesList = JSON.parse(String(body.packageFilesList));
          } catch {
            /* ignore */
          }
        }

        if (assetFile) {
          const ext = path.extname(assetFile.originalname).toLowerCase();
          if (ext !== '.glb') {
            await safeUnlink(assetFile.url);
            await safeUnlink(packageFile?.url);
            throw new AppError('Main asset file must be in GLB format (.glb)', 400);
          }
          const fileSizeMB = body.fileSize
            ? parseFloat(String(body.fileSize)) / (1024 * 1024)
            : parseFloat((assetFile.size / (1024 * 1024)).toFixed(2));
          updateData.size = fileSizeMB;
          updateData.type = 'GLB';
          updateData.url = getUploadedFileUrl(
            request,
            assetFile as unknown as Express.Multer.File,
            'assets',
          );
        } else if (tempAssetPath) {
          let fileSizeMB = body.fileSize ? parseFloat(String(body.fileSize)) / (1024 * 1024) : 0;
          if (fileSizeMB === 0) {
            fileSizeMB = await getFileSizeInMb(tempAssetPath);
          }
          updateData.size = fileSizeMB;
          updateData.type = 'GLB';
          updateData.url = tempAssetPath;
        } else if (externalUrl !== undefined) {
          updateData.url = externalUrl as string;
          updateData.type = 'LINK';
        }

        if (packageFile) {
          const ext = path.extname(packageFile.originalname).toLowerCase();
          if (ext !== '.zip') {
            await safeUnlink(packageFile.url);
            throw new AppError('Resource package file must be in ZIP format (.zip)', 400);
          }
          const packageSizeMB = body.packageSize
            ? parseFloat(String(body.packageSize)) / (1024 * 1024)
            : parseFloat((packageFile.size / (1024 * 1024)).toFixed(2));
          if (packageFilesList.length === 0 && packageFile?.buffer) {
            try {
              packageFilesList = await parseZipBuffer(packageFile.buffer);
            } catch (zipErr) {
              logger.error('[AssetUpdate] Failed to parse package ZIP from buffer:', zipErr);
            }
          }
          updateData.packageSize = packageSizeMB;
          updateData.packageUrl = getUploadedFileUrl(
            request,
            packageFile as unknown as Express.Multer.File,
            'assets',
          );
          updateData.packageFilesList =
            packageFilesList.length > 0 ? JSON.stringify(packageFilesList) : null;
        } else if (tempPackagePath) {
          let packageSizeMB = body.packageSize
            ? parseFloat(String(body.packageSize)) / (1024 * 1024)
            : 0;
          if (packageSizeMB === 0) {
            packageSizeMB = await getFileSizeInMb(tempPackagePath);
          }
          updateData.packageSize = packageSizeMB;
          updateData.packageUrl = tempPackagePath;
          updateData.packageFilesList =
            packageFilesList.length > 0 ? JSON.stringify(packageFilesList) : null;
        }

        if (thumbnailFile) {
          updateData.thumbnail = getUploadedFileUrl(
            request,
            thumbnailFile as unknown as Express.Multer.File,
            'assets',
          );
        } else if (tempThumbnailPath) {
          updateData.thumbnail = tempThumbnailPath;
        }

        if (
          existingAsset.userId === (request as AuthReq).userId &&
          (request as AuthReq).user?.role !== 'ADMIN'
        ) {
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

        if (assetFile && assetFile.buffer) {
          try {
            const ext = path.extname(assetFile.originalname).toLowerCase() || '.glb';
            await QueueService.enqueue(
              'draco-compression',
              {
                assetId: asset.id,
                buffer: assetFile.buffer.toString('base64'),
                ext,
                file: assetFile as unknown as UploadedFile,
              },
              {
                idempotencyKey: `meta-${asset.id}`,
                type: 'draco-compression',
                userId: (request as AuthReq).userId,
              },
            );
          } catch (err) {
            logger.error(
              `[AssetUpload] Failed to enqueue draco-compression for asset ${asset.id}:`,
              err,
            );
          }
        }

        await auditService.log({
          userId: (request as AuthReq).userId as string,
          action: AuditAction.UPDATE_ASSET,
          module: AuditModule.ASSET,
          description: `Updated asset: ${asset.title}`,
          oldValue: existingAsset,
          newValue: asset,
          req: request as unknown as AuditRequest,
        });

        const signedAsset = await signAssetUrls(asset);
        return reply.send(signedAsset);
      } catch (error) {
        logger.error('[Fastify asset] updateAsset error:', error);
        throw error;
      }
    },
  );
};
