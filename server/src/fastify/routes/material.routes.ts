import type { FastifyInstance, FastifyRequest } from 'fastify';

import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import path from 'path';
import {
  fastifyAuthenticate,
  fastifyOptionalAuthenticate,
  fastifyResolveWorkspace,
  type SafeUser,
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
import { decryptSecretIfNeeded } from '../../utils/crypto';
import { checkStorageQuota } from '../../utils/quota';
import {
  deleteCloudOrLocalFileByUrl,
  getZipFileNames,
  parseZipBuffer,
  getZipFileDirectory,
  getUploadedFileUrl,
  moveTempFileToDestination,
  getFileSizeInMb,
} from '../../utils/file';
import { createPaginationMeta, getPaginationParams } from '../../utils/pagination';
import { parseTags } from '../../utils/tags';
import { parseBool } from '../../utils/parser';
import {
  createFavoriteCategoryHandlers,
  type FavoriteModelDelegate,
} from '../../controllers/shared/favorites.factory';
import {
  materialCommentSchema,
  materialRequestSchema,
  materialRequestReplySchema,
  materialShareSchema,
  materialReviewSchema,
} from '../../utils/schemas';

/**
 * Fastify 材质库路由（铁律六·1 渐进式迁移 —— 原生 Fastify handler）。
 *
 * 挂载前缀: /api/fastify/materials
 *
 * 公开读（可选鉴权，guest 可浏览 APPROVED 材质）：
 *  - GET  /share/:shareId         公开分享详情（30/min）
 *  - GET  /                        材质列表
 *  - GET  /insights                材质洞察
 *  - GET  /requests                求资源列表
 *  - GET  /requests/:id           求资源详情
 *  - GET  /:id                     材质详情
 *  - GET  /:id/package-files       包内文件列表
 *  - GET  /:id/view-file           文件预览/流式播放（60/min，STREAM）
 *  - GET  /:id/comments            评论列表
 *
 * 鉴权写：
 *  - GET  /favorites                我的收藏
 *  - POST /favorites/categories     创建收藏分类
 *  - PUT  /favorites/categories     更新收藏分类
 *  - DELETE /favorites/categories/:categoryName  删除收藏分类
 *  - GET  /my                       我的材质
 *  - POST /bulk/favorite            批量收藏
 *  - POST /requests                 创建求资源
 *  - POST /requests/:id/replies     回复求资源
 *  - POST /requests/:id/resolve     解决求资源
 *  - GET  /:id/file                 下载文件（60/min，redirect）
 *  - GET  /:id/zip-entry            ZIP 内文件流（60/min，STREAM）
 *  - PATCH /:id/status              审核材质
 *  - DELETE /:id                    删除材质
 *  - POST /bulk-delete              批量删除
 *  - POST /:id/download             记录下载（60/min）
 *  - POST /:id/favorite             切换收藏
 *  - POST /:id/comments             创建评论（10/min）
 *  - DELETE /comments/:commentId     删除评论
 *  - GET  /:id/share                获取分享
 *  - POST /:id/share                创建/更新分享（30/min）
 *  - DELETE /:id/share              取消分享
 *  - POST /upload                   上传材质
 *  - PUT  /:id                      更新材质
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
  user?: SafeUser;
}

// ── Favorites category factory (eliminates duplicate category CRUD handlers) ───

const {
  readCategories: getCustomMaterialCategories,
  persistCategoryIfNew: persistMaterialCategoryIfNew,
} = createFavoriteCategoryHandlers({
  delegate: prisma.materialFavorite as unknown as FavoriteModelDelegate,
  settingsKey: 'material_favorite_categories',
  resourceLabel: '素材',
});

// ── Constants & helpers (inlined from material.controller.ts) ──────────────────

const ALL_FILTER_VALUES = new Set(['all', '全部', '全部材料', 'All Materials', 'All']);
const MATERIAL_STATUSES = new Set(['PENDING', 'APPROVED', 'REJECTED']);

const materialInclude = {
  user: {
    select: { id: true, name: true, email: true, avatarUrl: true },
  },
  _count: {
    select: { favorites: true },
  },
} satisfies Prisma.MaterialInclude;

const isAllFilter = (value: unknown) =>
  value === undefined || value === null || ALL_FILTER_VALUES.has(String(value));

const parseBooleanQuery = (value: unknown) => {
  if (value === true || value === 'true' || value === '1') return true;
  if (value === false || value === 'false' || value === '0') return false;
  return undefined;
};

const normalizeStatus = (value: unknown) => {
  const normalized = String(value || '').toUpperCase();
  return MATERIAL_STATUSES.has(normalized) ? normalized : undefined;
};

const normalizeTagsForStorage = (tags?: string | string[] | null) => {
  if (!tags) return null;
  const list = Array.isArray(tags)
    ? tags
    : String(tags)
        .split(/[,，\s]+/)
        .map((tag) => tag.trim());
  const clean = Array.from(
    new Set(
      list
        .map(String)
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  );
  return clean.length ? JSON.stringify(clean) : null;
};

const canManageCurrentWorkspaceMaterials = async (req: AuthReq) => {
  if (req.user?.role === 'ADMIN') return true;
  const membership = await prisma.teamMember.findFirst({
    where: { teamId: req.workspaceId, userId: req.userId },
    select: { role: true },
  });
  return !!membership && ['OWNER', 'ADMIN'].includes(membership.role);
};

const getWorkspaceMaterial = async (
  id: string,
  req: AuthReq,
  options: { requireApproved?: boolean } = {},
) => {
  const material = await prisma.material.findFirst({
    where: {
      id,
      OR:
        req.user?.role === 'ADMIN'
          ? undefined
          : [{ status: 'APPROVED' }, { teamId: req.workspaceId }, { userId: req.userId }],
      ...(options.requireApproved ? { status: 'APPROVED' } : {}),
    },
    include: materialInclude,
  });

  if (!material) {
    throw new AppError('Material not found', 404);
  }

  return material;
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

// --- Query schemas (permissive — handlers handle defaults) ---

const materialListQuerySchema = z
  .object({
    category: z.string().optional(),
    sort: z.string().optional(),
    search: z.string().optional(),
    resolution: z.string().optional(),
    tag: z.string().optional(),
    favoriteCategory: z.string().optional(),
    mine: z.union([z.string(), z.boolean()]).optional(),
    page: z.union([z.number(), z.string()]).optional(),
    limit: z.union([z.number(), z.string()]).optional(),
    status: z.string().optional(),
  })
  .passthrough();

const viewFileQuerySchema = z
  .object({
    type: z.string().optional(),
  })
  .passthrough();

const zipEntryQuerySchema = z
  .object({
    path: z.string().min(1, 'path is required'),
  })
  .passthrough();

const favoritesQuerySchema = z
  .object({
    category: z.string().optional(),
    page: z.union([z.number(), z.string()]).optional(),
    limit: z.union([z.number(), z.string()]).optional(),
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

export const registerMaterialRoutes = (app: FastifyInstance): void => {
  // ── 公开读（可选鉴权）──────────────────────────────────────────────

  // GET /share/:shareId —— 公开分享详情
  app.get(
    '/share/:shareId',
    {
      preHandler: [fastifyOptionalAuthenticate],
      schema: { params: shareIdParamsSchema },
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    },
    async (_request, reply) => {
      const request = _request as AuthReq;
      const shareId = (request.params as { shareId: string }).shareId;
      try {
        reply.header('Cache-Control', 'public, max-age=30');
        const share = await prisma.materialShare.findUnique({
          where: { id: shareId },
          include: {
            material: {
              include: {
                user: {
                  select: { id: true, name: true, avatarUrl: true },
                },
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

        return reply.send(share);
      } catch (error) {
        logger.error('[Fastify material] getPublicSharedMaterial error:', error);
        throw error;
      }
    },
  );

  // GET / —— 材质列表
  app.get(
    '/',
    {
      preHandler: optionalAuthWithWorkspace,
      schema: { querystring: materialListQuerySchema },
    },
    async (_request, reply) => {
      const request = _request as AuthReq;
      const query = request.query as Record<string, string | undefined>;
      const { category, sort, search, resolution, tag, favoriteCategory } = query;
      try {
        const userId = request.userId as string;
        const mine = parseBooleanQuery(query.mine) === true;
        const favoritesOnly = parseBooleanQuery(query.favoritesOnly) === true;
        const procedural = parseBooleanQuery(query.procedural);
        const status = normalizeStatus(query.status);
        const usePagination = Boolean(
          query.page || query.limit || query.pageSize || query.paginated,
        );
        const { page, limit, skip } = getPaginationParams(query, 96, 160);

        const where: Prisma.MaterialWhereInput = mine
          ? {
              userId,
              ...(status ? { status } : {}),
            }
          : {
              status: 'APPROVED',
            };

        if (!isAllFilter(category)) {
          where.category = category as string;
        }
        if (!isAllFilter(resolution)) {
          where.resolution = resolution as string;
        }
        if (!isAllFilter(tag)) {
          where.tags = { contains: tag as string };
        }
        if (procedural !== undefined) {
          where.isProcedural = procedural;
        }
        if (favoritesOnly) {
          where.favorites = {
            some: {
              userId,
              ...(favoriteCategory && favoriteCategory !== 'all'
                ? { category: favoriteCategory as string }
                : {}),
            },
          };
        }
        if (search) {
          where.OR = [
            { title: { contains: search as string } },
            { tags: { contains: search as string } },
            { description: { contains: search as string } },
            { category: { contains: search as string } },
          ];
        }

        const orderBy: Prisma.MaterialOrderByWithRelationInput =
          sort === 'popular'
            ? { downloads: 'desc' }
            : sort === 'largest'
              ? { fileSize: 'desc' }
              : sort === 'smallest'
                ? { fileSize: 'asc' }
                : { createdAt: 'desc' };

        const [materials, total] = await Promise.all([
          prisma.material.findMany({
            where,
            include: materialInclude,
            orderBy,
            ...(usePagination ? { skip, take: limit } : {}),
          }),
          usePagination ? prisma.material.count({ where }) : Promise.resolve(0),
        ]);

        const userFavorites = await prisma.materialFavorite.findMany({
          where: { userId, materialId: { in: materials.map((material) => material.id) } },
          select: { materialId: true },
        });
        const favoriteIds = new Set(userFavorites.map((f) => f.materialId));

        let materialsWithFavorite = materials.map((m) => ({
          ...m,
          isFavorited: favoriteIds.has(m.id),
        }));

        if (sort === 'favorited') {
          materialsWithFavorite = materialsWithFavorite.sort(
            (a, b) => (b._count?.favorites || 0) - (a._count?.favorites || 0),
          );
        }

        if (usePagination) {
          return reply.send({
            items: materialsWithFavorite,
            meta: createPaginationMeta(page, limit, total),
          });
        }

        return reply.send(materialsWithFavorite);
      } catch (error) {
        logger.error('[Fastify material] getAllMaterials error:', error);
        throw error;
      }
    },
  );

  // GET /insights —— 材质洞察
  app.get(
    '/insights',
    {
      preHandler: optionalAuthWithWorkspace,
    },
    async (_request, reply) => {
      const request = _request as AuthReq;
      try {
        const userId = request.userId as string;
        const where: Prisma.MaterialWhereInput = { status: 'APPROVED' };
        const [
          materials,
          favoriteCount,
          myUploads,
          myPending,
          myApproved,
          myRejected,
          pendingCount,
        ] = await Promise.all([
          prisma.material.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: materialInclude,
            take: 500,
          }),
          prisma.materialFavorite.count({
            where: { userId, material: { status: 'APPROVED' } },
          }),
          prisma.material.count({ where: { userId, teamId: request.workspaceId } }),
          prisma.material.count({
            where: { userId, teamId: request.workspaceId, status: 'PENDING' },
          }),
          prisma.material.count({
            where: { userId, teamId: request.workspaceId, status: 'APPROVED' },
          }),
          prisma.material.count({
            where: { userId, teamId: request.workspaceId, status: 'REJECTED' },
          }),
          prisma.material.count({ where: { status: 'PENDING', teamId: request.workspaceId } }),
        ]);

        const favoriteIds = new Set(
          (
            await prisma.materialFavorite.findMany({
              where: { userId, materialId: { in: materials.map((material) => material.id) } },
              select: { materialId: true },
            })
          ).map((favorite) => favorite.materialId),
        );

        const categories = new Map<string, { name: string; count: number; downloads: number }>();
        const resolutions = new Map<string, number>();
        const tagCounts = new Map<string, number>();
        const dailyUploads = new Map<string, number>();
        let totalDownloads = 0;
        let totalFavorites = 0;
        let totalSize = 0;
        let procedural = 0;

        materials.forEach((material) => {
          totalDownloads += material.downloads || 0;
          totalFavorites += material._count.favorites || 0;
          totalSize += material.fileSize || 0;
          if (material.isProcedural) procedural += 1;

          const cat = material.category || '其他';
          const current = categories.get(cat) || { name: cat, count: 0, downloads: 0 };
          current.count += 1;
          current.downloads += material.downloads || 0;
          categories.set(cat, current);

          const res = material.resolution || '未标注';
          resolutions.set(res, (resolutions.get(res) || 0) + 1);

          const day = material.createdAt.toISOString().slice(0, 10);
          dailyUploads.set(day, (dailyUploads.get(day) || 0) + 1);

          parseTags(material.tags).forEach((t) => {
            tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
          });
        });

        const attachFavorite = (material: (typeof materials)[number]) => ({
          ...material,
          isFavorited: favoriteIds.has(material.id),
        });

        return reply.send({
          summary: {
            total: materials.length,
            downloads: totalDownloads,
            favorites: totalFavorites,
            myFavorites: favoriteCount,
            myUploads,
            myPending,
            myApproved,
            myRejected,
            pending: pendingCount,
            procedural,
            averageSize: materials.length ? Number((totalSize / materials.length).toFixed(2)) : 0,
          },
          categories: Array.from(categories.values()).sort((a, b) => b.count - a.count),
          resolutions: Array.from(resolutions.entries())
            .map(([label, count]) => ({ label, count }))
            .sort((a, b) => b.count - a.count),
          hotTags: Array.from(tagCounts.entries())
            .map(([label, count]) => ({ label, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 24),
          dailyUploads: Array.from(dailyUploads.entries())
            .map(([date, count]) => ({ date, count }))
            .sort((a, b) => a.date.localeCompare(b.date))
            .slice(-14),
          topDownloads: [...materials]
            .sort((a, b) => b.downloads - a.downloads)
            .slice(0, 8)
            .map(attachFavorite),
          latest: materials.slice(0, 8).map(attachFavorite),
        });
      } catch (error) {
        logger.error('[Fastify material] getMaterialInsights error:', error);
        throw error;
      }
    },
  );

  // GET /requests —— 求资源列表
  app.get(
    '/requests',
    {
      preHandler: [fastifyOptionalAuthenticate],
      schema: { querystring: requestsQuerySchema },
    },
    async (_request, reply) => {
      const request = _request as AuthReq;
      const query = request.query as Record<string, string | undefined>;
      try {
        const { page, limit, skip } = getPaginationParams(query, 20, 50);
        const status = query.status as string | undefined;

        const where: Prisma.MaterialRequestWhereInput = {};
        if (status && status !== 'ALL') {
          where.status = status;
        }

        const [requests, total] = await Promise.all([
          prisma.materialRequest.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
            include: {
              user: { select: { id: true, name: true, avatarUrl: true } },
              _count: { select: { replies: true } },
            },
          }),
          prisma.materialRequest.count({ where }),
        ]);

        return reply.send({ requests, pagination: createPaginationMeta(page, limit, total) });
      } catch (error) {
        logger.error('[Fastify material] listMaterialRequests error:', error);
        throw error;
      }
    },
  );

  // GET /requests/:id —— 求资源详情
  app.get(
    '/requests/:id',
    {
      preHandler: [fastifyOptionalAuthenticate],
      schema: { params: idParamsSchema },
    },
    async (_request, reply) => {
      const request = _request as AuthReq;
      const id = (request.params as { id: string }).id;
      try {
        const req = await prisma.materialRequest.findUnique({
          where: { id },
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
            replies: {
              orderBy: { createdAt: 'asc' },
              include: {
                user: { select: { id: true, name: true, avatarUrl: true } },
                linkedMaterial: {
                  select: {
                    id: true,
                    title: true,
                    resolution: true,
                    previewUrl: true,
                    downloads: true,
                  },
                },
              },
            },
          },
        });

        if (!req) {
          throw new AppError('求助帖不存在', 404);
        }

        return reply.send(req);
      } catch (error) {
        logger.error('[Fastify material] getMaterialRequestById error:', error);
        throw error;
      }
    },
  );

  // GET /:id —— 材质详情
  app.get(
    '/:id',
    {
      preHandler: optionalAuthWithWorkspace,
      schema: { params: idParamsSchema },
    },
    async (_request, reply) => {
      const request = _request as AuthReq;
      const id = (request.params as { id: string }).id;
      try {
        const material = await getWorkspaceMaterial(id, request);

        const isFavorited = await prisma.materialFavorite.findFirst({
          where: { userId: request.userId as string, materialId: id },
        });

        return reply.send({ ...material, isFavorited: !!isFavorited });
      } catch (error) {
        logger.error('[Fastify material] getMaterialById error:', error);
        throw error;
      }
    },
  );

  // GET /:id/package-files —— 包内文件列表
  app.get(
    '/:id/package-files',
    {
      preHandler: optionalAuthWithWorkspace,
      schema: { params: idParamsSchema },
    },
    async (_request, reply) => {
      const request = _request as AuthReq;
      const id = (request.params as { id: string }).id;
      try {
        const material = await prisma.material.findFirst({
          where: {
            id,
            OR:
              request.user?.role === 'ADMIN'
                ? undefined
                : [
                    { status: 'APPROVED' },
                    { teamId: request.workspaceId },
                    { userId: request.userId },
                  ],
          },
          select: { fileUrl: true, packageFilesList: true },
        });

        if (!material) {
          throw new AppError('Material not found or access denied', 404);
        }

        if (!material.fileUrl) {
          return reply.send({ packageFiles: [] });
        }

        if (material.packageFilesList) {
          try {
            const files = JSON.parse(material.packageFilesList);
            if (Array.isArray(files)) {
              return reply.send({ packageFiles: files });
            }
          } catch {
            /* ignore and fallback */
          }
        }

        const packageFiles = await getZipFileNames(material.fileUrl);

        if (packageFiles.length > 0) {
          await prisma.material
            .update({
              where: { id },
              data: { packageFilesList: JSON.stringify(packageFiles) },
            })
            .catch((err: unknown) => {
              logger.error(
                `[Material] Failed to update packageFilesList fallback for material ${id}:`,
                err,
              );
            });
        }

        return reply.send({ packageFiles });
      } catch (error) {
        logger.error('[Fastify material] getMaterialPackageFiles error:', error);
        throw error;
      }
    },
  );

  // GET /:id/view-file —— 文件预览/流式播放（STREAM，需 hijack 原始 response）
  app.get(
    '/:id/view-file',
    {
      preHandler: optionalAuthWithWorkspace,
      schema: { params: idParamsSchema, querystring: viewFileQuerySchema },
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    },
    async (_request, reply) => {
      const request = _request as AuthReq;
      const id = (request.params as { id: string }).id;
      const type = ((request.query as Record<string, string | undefined>).type as string) || 'file';

      if (!['file', 'preview'].includes(type)) {
        throw new AppError('Invalid file type requested', 400);
      }

      try {
        const material = await prisma.material.findUnique({ where: { id } });

        if (!material) {
          throw new AppError('Material not found', 404);
        }

        const isPublic = material.status === 'APPROVED';
        if (!isPublic) {
          if (!request.userId) {
            throw new AppError('Authentication required', 401);
          }
          const isOwner = material.userId === request.userId;
          const isAdmin = request.user?.role === 'ADMIN';
          const isTeamMember = material.teamId && request.workspaceId === material.teamId;
          if (!isOwner && !isAdmin && !isTeamMember) {
            throw new AppError('Access denied', 403);
          }
        }

        let urlToUse: string | null = null;

        if (type === 'file') {
          urlToUse = material.fileUrl;
        } else if (type === 'preview') {
          urlToUse = material.previewUrl;
        }

        if (!urlToUse) {
          throw new AppError('Requested file not found on this material', 404);
        }

        const urlLower = urlToUse.toLowerCase().trim();
        if (urlLower.startsWith('http://') || urlLower.startsWith('https://')) {
          try {
            const parsedUrl = new URL(urlToUse);
            const urlHost = parsedUrl.host.toLowerCase();

            let configs = await prisma.storageConfig.findMany({
              where: { status: 'ACTIVE', publicUrl: { contains: urlHost } },
            });
            if (configs.length === 0) {
              configs = await prisma.storageConfig.findMany({ where: { status: 'ACTIVE' } });
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
                    logger.error(`[viewMaterialFile] Error streaming key ${key} from R2:`, err);
                    throw new AppError('Failed to fetch file from storage', 502);
                  }
                }
              }
            }
          } catch (urlErr) {
            if (urlErr instanceof AppError) throw urlErr;
            logger.error('[viewMaterialFile] URL parse or process error:', urlErr);
          }
        }

        throw new AppError('文件 URL 非法：仅支持云存储地址', 400);
      } catch (error) {
        if (error instanceof AppError) throw error;
        logger.error('[Fastify material] viewMaterialFile error:', error);
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
    async (_request, reply) => {
      const request = _request as AuthReq;
      const materialId = (request.params as { id: string }).id;
      try {
        const material = await prisma.material.findFirst({
          where: {
            id: materialId,
            OR:
              request.user?.role === 'ADMIN'
                ? undefined
                : [
                    { status: 'APPROVED' },
                    { teamId: request.workspaceId },
                    { userId: request.userId },
                  ],
          },
        });
        if (!material) {
          throw new AppError('Material not found or access denied', 404);
        }
        const comments = await prisma.materialComment.findMany({
          where: { materialId },
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
        });
        return reply.send(comments);
      } catch (error) {
        logger.error('[Fastify material] getMaterialComments error:', error);
        throw error;
      }
    },
  );

  // ── 鉴权写 ──────────────────────────────────────────────────────────

  // GET /favorites —— 我的收藏
  app.get(
    '/favorites',
    {
      preHandler: authWithWorkspace,
      schema: { querystring: favoritesQuerySchema },
    },
    async (_request, reply) => {
      const request = _request as AuthReq;
      try {
        const userId = request.userId as string;
        const favorites = await prisma.materialFavorite.findMany({
          where: {
            userId,
            material: {
              teamId: request.workspaceId,
              status: 'APPROVED',
            },
          },
          include: {
            material: {
              include: {
                user: { select: { id: true, name: true, email: true, avatarUrl: true } },
                _count: { select: { favorites: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        });

        const categoryList = await prisma.materialFavorite.groupBy({
          by: ['category'],
          where: { userId },
        });

        const dbCategories = categoryList.map((c) => c.category);
        const customCategories = await getCustomMaterialCategories(userId);
        const categoriesSet = new Set(['默认', ...dbCategories, ...customCategories]);

        return reply.send({
          ids: favorites.map((f) => f.materialId),
          favorites: favorites.map((f) => ({
            id: f.id,
            category: f.category,
            material: {
              ...f.material,
              isFavorited: true,
            },
          })),
          categories: Array.from(categoriesSet),
        });
      } catch (error) {
        logger.error('[Fastify material] getMyFavorites error:', error);
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
    async (_request, reply) => {
      const request = _request as AuthReq;
      const userId = request.userId as string;
      const { category } = request.body as { category?: string };

      if (!category?.trim()) {
        throw new AppError('分类名称不能为空', 400);
      }
      const newCat = category.trim();
      if (newCat === '默认') {
        throw new AppError('不能创建默认分类', 400);
      }

      try {
        const customCats = await getCustomMaterialCategories(userId);
        if (!customCats.includes(newCat)) {
          customCats.push(newCat);
          await prisma.userSetting.upsert({
            where: { userId_key: { userId, key: 'material_favorite_categories' } },
            update: { value: JSON.stringify(customCats) },
            create: {
              userId,
              key: 'material_favorite_categories',
              value: JSON.stringify(customCats),
            },
          });
        }
        return reply.send({
          success: true,
          message: '分类创建成功',
          categories: ['默认', ...customCats],
        });
      } catch (error) {
        logger.error('[Fastify material] createMaterialFavoriteCategory error:', error);
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
    async (_request, reply) => {
      const request = _request as AuthReq;
      const userId = request.userId as string;
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
        await prisma.materialFavorite.updateMany({
          where: { userId, category: oldCat },
          data: { category: newCat },
        });
        const customCats = await getCustomMaterialCategories(userId);
        const updatedCats = customCats.map((c) => (c === oldCat ? newCat : c));
        await prisma.userSetting.upsert({
          where: { userId_key: { userId, key: 'material_favorite_categories' } },
          update: { value: JSON.stringify(updatedCats) },
          create: {
            userId,
            key: 'material_favorite_categories',
            value: JSON.stringify(updatedCats),
          },
        });
        return reply.send({ success: true, message: '分类更新成功' });
      } catch (error) {
        logger.error('[Fastify material] updateMaterialFavoriteCategory error:', error);
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
    async (_request, reply) => {
      const request = _request as AuthReq;
      const userId = request.userId as string;
      const categoryName = (request.params as { categoryName: string }).categoryName;

      if (!categoryName) {
        throw new AppError('缺少分类名称', 400);
      }
      const cat = categoryName.trim();
      if (cat === '默认') {
        throw new AppError('不能删除默认分类', 400);
      }

      try {
        await prisma.materialFavorite.deleteMany({ where: { userId, category: cat } });
        const customCats = await getCustomMaterialCategories(userId);
        const filteredCats = customCats.filter((c) => c !== cat);
        await prisma.userSetting.upsert({
          where: { userId_key: { userId, key: 'material_favorite_categories' } },
          update: { value: JSON.stringify(filteredCats) },
          create: {
            userId,
            key: 'material_favorite_categories',
            value: JSON.stringify(filteredCats),
          },
        });
        return reply.send({ success: true, message: '分类删除成功' });
      } catch (error) {
        logger.error('[Fastify material] deleteMaterialFavoriteCategory error:', error);
        throw error;
      }
    },
  );

  // GET /my —— 我的材质
  app.get(
    '/my',
    {
      preHandler: authWithWorkspace,
    },
    async (_request, reply) => {
      const request = _request as AuthReq;
      try {
        const status = normalizeStatus(
          (request.query as Record<string, string | undefined>).status,
        );
        const materials = await prisma.material.findMany({
          where: {
            userId: request.userId as string,
            teamId: request.workspaceId,
            ...(status ? { status } : {}),
          },
          include: materialInclude,
          orderBy: { createdAt: 'desc' },
        });

        const userFavorites = await prisma.materialFavorite.findMany({
          where: {
            userId: request.userId as string,
            materialId: { in: materials.map((material) => material.id) },
          },
          select: { materialId: true },
        });
        const favoriteIds = new Set(userFavorites.map((favorite) => favorite.materialId));

        return reply.send(
          materials.map((material) => ({ ...material, isFavorited: favoriteIds.has(material.id) })),
        );
      } catch (error) {
        logger.error('[Fastify material] getMyMaterials error:', error);
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
    async (_request, reply) => {
      const request = _request as AuthReq;
      try {
        const userId = request.userId as string;
        const body = request.body as Record<string, unknown> | undefined;
        const rawIds: unknown[] = Array.isArray(body?.ids) ? body.ids : [];
        const categoryVal = typeof body?.category === 'string' ? body.category.trim() : '默认';
        const category = categoryVal || '默认';
        const ids = Array.from(
          new Set<string>(rawIds.map((id) => String(id)).filter((id) => Boolean(id))),
        ).slice(0, 100);
        const favorite = body?.favorite !== false;

        if (!ids.length) {
          throw new AppError('No materials selected', 400);
        }

        const approvedMaterials = await prisma.material.findMany({
          where: {
            id: { in: ids },
            status: 'APPROVED',
          },
          select: { id: true },
        });
        const approvedIds = approvedMaterials.map((material) => material.id);

        if (favorite) {
          await prisma.materialFavorite.createMany({
            data: approvedIds.map((materialId) => ({ userId, materialId, category })),
            skipDuplicates: true,
          });

          if (category !== '默认') {
            await persistMaterialCategoryIfNew(userId, category);
          }
        } else {
          await prisma.materialFavorite.deleteMany({
            where: { userId, materialId: { in: approvedIds } },
          });
        }

        return reply.send({ ids: approvedIds, isFavorited: favorite });
      } catch (error) {
        logger.error('[Fastify material] bulkFavoriteMaterials error:', error);
        throw error;
      }
    },
  );

  // POST /requests —— 创建求资源
  app.post(
    '/requests',
    {
      preHandler: [fastifyAuthenticate],
      schema: { body: materialRequestSchema },
    },
    async (_request, reply) => {
      const request = _request as AuthReq;
      const { title, description } = request.body as { title: string; description: string };
      if (!title?.trim() || !description?.trim()) {
        throw new AppError('标题和内容为必填项', 400);
      }

      try {
        const req = await prisma.materialRequest.create({
          data: {
            title: title.trim(),
            description: description.trim(),
            userId: request.userId!,
            status: 'OPEN',
          },
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
            _count: { select: { replies: true } },
          },
        });

        return reply.status(201).send(req);
      } catch (error) {
        logger.error('[Fastify material] createMaterialRequest error:', error);
        throw error;
      }
    },
  );

  // POST /requests/:id/replies —— 回复求资源
  app.post(
    '/requests/:id/replies',
    {
      preHandler: [fastifyAuthenticate],
      schema: { params: idParamsSchema, body: materialRequestReplySchema },
    },
    async (_request, reply) => {
      const request = _request as AuthReq;
      const requestId = (request.params as { id: string }).id;
      const { content, linkedMaterialId } = request.body as {
        content: string;
        linkedMaterialId?: string;
      };

      if (!content?.trim()) {
        throw new AppError('回复内容不能为空', 400);
      }

      try {
        const req = await prisma.materialRequest.findUnique({ where: { id: requestId } });
        if (!req) throw new AppError('求助帖不存在', 404);

        if (linkedMaterialId) {
          const material = await prisma.material.findFirst({
            where: { id: linkedMaterialId, status: 'APPROVED' },
          });
          if (!material) throw new AppError('关联的材质不存在或未被批准发布', 400);
        }

        const replyData = await prisma.materialRequestReply.create({
          data: {
            requestId,
            userId: request.userId!,
            content: content.trim(),
            linkedMaterialId: linkedMaterialId || null,
          },
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
            linkedMaterial: {
              select: {
                id: true,
                title: true,
                resolution: true,
                previewUrl: true,
                downloads: true,
              },
            },
          },
        });

        return reply.status(201).send(replyData);
      } catch (error) {
        logger.error('[Fastify material] createMaterialRequestReply error:', error);
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
    async (_request, reply) => {
      const request = _request as AuthReq;
      const requestId = (request.params as { id: string }).id;
      try {
        const req = await prisma.materialRequest.findUnique({ where: { id: requestId } });
        if (!req) throw new AppError('求助帖不存在', 404);

        if (req.userId !== request.userId && request.user?.role !== 'ADMIN') {
          throw new AppError('无权关闭此求助贴', 403);
        }

        const updated = await prisma.materialRequest.update({
          where: { id: requestId },
          data: { status: 'RESOLVED' },
        });

        return reply.send(updated);
      } catch (error) {
        logger.error('[Fastify material] resolveMaterialRequest error:', error);
        throw error;
      }
    },
  );

  // GET /:id/file —— 下载文件（redirect 到云存储 URL）
  app.get(
    '/:id/file',
    {
      preHandler: authWithWorkspace,
      schema: { params: idParamsSchema },
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    },
    async (_request, reply) => {
      const request = _request as AuthReq;
      const id = (request.params as { id: string }).id;
      try {
        const material = await getWorkspaceMaterial(id, request, { requireApproved: true });

        if (material.fileUrl.startsWith('http://') || material.fileUrl.startsWith('https://')) {
          await prisma.material.update({
            where: { id },
            data: { downloads: { increment: 1 } },
          });
          return reply.redirect(material.fileUrl);
        }

        throw new AppError('文件 URL 非法：仅支持云存储地址', 400);
      } catch (error) {
        logger.error('[Fastify material] downloadMaterial error:', error);
        throw error;
      }
    },
  );

  // GET /:id/zip-entry —— ZIP 内文件流（STREAM，需 hijack 原始 response）
  app.get(
    '/:id/zip-entry',
    {
      preHandler: authWithWorkspace,
      schema: { params: idParamsSchema, querystring: zipEntryQuerySchema },
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    },
    async (_request, reply) => {
      const request = _request as AuthReq;
      const id = (request.params as { id: string }).id;
      const filePathInsideZip = (request.query as { path: string }).path;

      if (!filePathInsideZip) {
        throw new AppError('Query parameter "path" is required', 400);
      }

      try {
        const material = await prisma.material.findFirst({
          where: {
            id,
            OR:
              request.user?.role === 'ADMIN'
                ? undefined
                : [
                    { status: 'APPROVED' },
                    { teamId: request.workspaceId },
                    { userId: request.userId },
                  ],
          },
          select: { fileUrl: true },
        });

        if (!material) {
          throw new AppError('Material not found or access denied', 404);
        }

        if (!material.fileUrl) {
          throw new AppError('Material has no file package', 404);
        }

        const packageUrl = material.fileUrl;
        const directory = await getZipFileDirectory(packageUrl);

        if (!directory) {
          throw new AppError('Failed to open material package file', 400);
        }

        const file = directory.files.find((f: { path: string }) => f.path === filePathInsideZip);

        if (!file) {
          throw new AppError(`File "${filePathInsideZip}" not found in package`, 404);
        }

        const ext = path.extname(filePathInsideZip).toLowerCase();
        let contentType = 'application/octet-stream';
        if (['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif'].includes(ext)) {
          contentType = `image/${ext.replace('.', '') === 'jpg' ? 'jpeg' : ext.replace('.', '')}`;
        } else if (ext === '.tga') {
          contentType = 'image/x-tga';
        } else if (ext === '.hdr') {
          contentType = 'image/vnd.radiance';
        } else if (ext === '.exr') {
          contentType = 'image/x-exr';
        }

        reply.hijack();
        const raw = reply.raw;
        raw.setHeader('Content-Type', contentType);
        raw.setHeader('Cache-Control', 'public, max-age=86400');
        file.stream().pipe(raw);
      } catch (error) {
        if (error instanceof AppError) throw error;
        logger.error('[Fastify material] getMaterialZipEntry error:', error);
        throw error;
      }
    },
  );

  // PATCH /:id/status —— 审核材质
  app.patch(
    '/:id/status',
    {
      preHandler: authWithWorkspace,
      schema: { params: idParamsSchema, body: materialReviewSchema },
    },
    async (_request, reply) => {
      const request = _request as AuthReq;
      const id = (request.params as { id: string }).id;
      try {
        const body = request.body as Record<string, unknown> | undefined;
        const status = normalizeStatus(body?.status);
        if (!status) {
          throw new AppError('Invalid material status', 400);
        }

        const existing = await prisma.material.findFirst({
          where: request.user?.role === 'ADMIN' ? { id } : { id, teamId: request.workspaceId },
        });
        if (!existing) throw new AppError('Material not found', 404);

        if (!(await canManageCurrentWorkspaceMaterials(request))) {
          throw new AppError('Not authorized to review this material', 403);
        }

        const rejectReason =
          status === 'REJECTED'
            ? String(body?.rejectReason || '材料暂未通过审核，请完善预览图、说明或授权信息。')
            : null;

        const material = await prisma.material.update({
          where: { id },
          data: {
            status,
            rejectReason,
          },
          include: materialInclude,
        });

        await auditService.log({
          userId: request.userId as string,
          action: AuditAction.UPDATE_MATERIAL,
          module: AuditModule.MATERIAL,
          description: `Reviewed material: ${material.title} -> ${status}`,
          oldValue: existing,
          newValue: material,
          req: request as unknown as AuditRequest,
        });

        return reply.send(material);
      } catch (error) {
        logger.error('[Fastify material] reviewMaterial error:', error);
        throw error;
      }
    },
  );

  // DELETE /:id —— 删除材质
  app.delete(
    '/:id',
    {
      preHandler: authWithWorkspace,
      schema: { params: idParamsSchema },
    },
    async (_request, reply) => {
      const request = _request as AuthReq;
      const id = (request.params as { id: string }).id;
      try {
        const material = await prisma.material.findFirst({
          where: { id, teamId: request.workspaceId },
        });

        if (!material) throw new AppError('Material not found', 404);

        if (material.userId !== request.userId && request.user?.role !== 'ADMIN') {
          const membership = await prisma.teamMember.findFirst({
            where: { teamId: request.workspaceId, userId: request.userId },
          });
          if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
            throw new AppError('Not authorized to delete this material', 403);
          }
        }

        const fileSizeBytes = material.fileSize
          ? Math.round(material.fileSize * 1024 * 1024)
          : undefined;
        deleteCloudOrLocalFileByUrl(material.fileUrl, fileSizeBytes).catch((err: unknown) => {
          logger.error(
            `[MaterialController] Failed to delete material file ${material.fileUrl} in background:`,
            err,
          );
        });
        if (material.previewUrl) {
          deleteCloudOrLocalFileByUrl(material.previewUrl).catch((err: unknown) => {
            logger.error(
              `[MaterialController] Failed to delete material preview ${material.previewUrl} in background:`,
              err,
            );
          });
        }

        await prisma.material.delete({ where: { id } });

        await auditService.log({
          userId: request.userId as string,
          action: AuditAction.DELETE_MATERIAL,
          module: AuditModule.MATERIAL,
          description: `Deleted material: ${material.title}`,
          oldValue: material,
          req: request as unknown as AuditRequest,
        });

        return reply.send({ message: 'Material deleted successfully' });
      } catch (error) {
        logger.error('[Fastify material] deleteMaterial error:', error);
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
    async (_request, reply) => {
      const request = _request as AuthReq;
      try {
        const { ids } = request.body as { ids: string[] };
        if (!Array.isArray(ids) || ids.length === 0) {
          return reply.status(400).send({ error: '请提供要删除的材质 ID 列表' });
        }

        const whereCondition: Prisma.MaterialWhereInput = {
          id: { in: ids },
        };
        if (request.user?.role !== 'ADMIN') {
          whereCondition.userId = request.userId;
        }

        const materialsToDelete = await prisma.material.findMany({
          where: whereCondition,
        });

        if (materialsToDelete.length === 0) {
          return reply.status(404).send({ error: '未找到可删除的材质或无权操作' });
        }

        for (const material of materialsToDelete) {
          deleteCloudOrLocalFileByUrl(material.fileUrl).catch((err: unknown) => {
            logger.error(
              `[MaterialController] Bulk delete: failed to delete file ${material.fileUrl}:`,
              err,
            );
          });
          if (material.previewUrl) {
            deleteCloudOrLocalFileByUrl(material.previewUrl).catch((err: unknown) => {
              logger.error(
                `[MaterialController] Bulk delete: failed to delete preview ${material.previewUrl}:`,
                err,
              );
            });
          }
        }

        const deleteIds = materialsToDelete.map((m) => m.id);
        await prisma.material.deleteMany({
          where: { id: { in: deleteIds } },
        });

        return reply.send({
          success: true,
          message: `成功批量删除 ${deleteIds.length} 个材质`,
          count: deleteIds.length,
          deletedIds: deleteIds,
        });
      } catch (error) {
        logger.error('[Fastify material] bulkDeleteMaterials error:', error);
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
    async (_request, reply) => {
      const request = _request as AuthReq;
      const id = (request.params as { id: string }).id;
      try {
        await getWorkspaceMaterial(id, request, { requireApproved: true });

        const material = await prisma.material.update({
          where: { id },
          data: {
            downloads: {
              increment: 1,
            },
          },
        });
        return reply.send({ message: 'Download recorded', downloads: material.downloads });
      } catch (error) {
        logger.error('[Fastify material] recordDownload error:', error);
        throw error;
      }
    },
  );

  // POST /:id/favorite —— 切换收藏
  app.post(
    '/:id/favorite',
    {
      preHandler: authWithWorkspace,
      schema: { params: idParamsSchema },
    },
    async (_request, reply) => {
      const request = _request as AuthReq;
      const materialId = (request.params as { id: string }).id;
      const body = request.body as Record<string, unknown> | undefined;
      const categoryVal = typeof body?.category === 'string' ? body.category.trim() : '默认';
      const category = categoryVal || '默认';
      const userId = request.userId as string;
      try {
        await getWorkspaceMaterial(materialId, request, { requireApproved: true });

        const existing = await prisma.materialFavorite.findUnique({
          where: { userId_materialId: { userId, materialId } },
        });

        let isFavorited = false;
        if (existing) {
          if (existing.category === category) {
            await prisma.materialFavorite.delete({ where: { id: existing.id } });
            isFavorited = false;
          } else {
            await prisma.materialFavorite.update({
              where: { id: existing.id },
              data: { category },
            });
            isFavorited = true;
          }
        } else {
          await prisma.materialFavorite.create({
            data: { userId, materialId, category },
          });
          isFavorited = true;
        }

        if (isFavorited && category !== '默认') {
          await persistMaterialCategoryIfNew(userId, category);
        }

        return reply.send({ isFavorited });
      } catch (error) {
        logger.error('[Fastify material] toggleFavorite error:', error);
        throw error;
      }
    },
  );

  // POST /:id/comments —— 创建评论
  app.post(
    '/:id/comments',
    {
      preHandler: authWithWorkspace,
      schema: { params: idParamsSchema, body: materialCommentSchema },
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (_request, reply) => {
      const request = _request as AuthReq;
      const materialId = (request.params as { id: string }).id;
      const userId = request.user?.id;
      const { content } = request.body as { content: string };

      if (!userId) {
        throw new AppError('Unauthorized', 401);
      }
      if (!content || !content.trim()) {
        throw new AppError('Comment content cannot be empty', 400);
      }

      try {
        const material = await prisma.material.findFirst({
          where: {
            id: materialId,
            OR:
              request.user?.role === 'ADMIN'
                ? undefined
                : [
                    { status: 'APPROVED' },
                    { teamId: request.workspaceId },
                    { userId: request.userId },
                  ],
          },
        });
        if (!material) {
          throw new AppError('Material not found or access denied', 404);
        }
        const comment = await prisma.materialComment.create({
          data: {
            content: content.trim(),
            materialId,
            userId,
          },
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
        });
        return reply.status(201).send(comment);
      } catch (error) {
        logger.error('[Fastify material] createMaterialComment error:', error);
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
    async (_request, reply) => {
      const request = _request as AuthReq;
      const commentId = (request.params as { commentId: string }).commentId;
      const userId = request.user?.id;
      const userRole = request.user?.role;

      if (!userId) {
        throw new AppError('Unauthorized', 401);
      }

      try {
        const comment = await prisma.materialComment.findUnique({
          where: { id: commentId },
        });

        if (!comment) {
          throw new AppError('Comment not found', 404);
        }

        if (comment.userId !== userId && userRole !== 'ADMIN') {
          throw new AppError('Forbidden', 403);
        }

        await prisma.materialComment.delete({
          where: { id: commentId },
        });

        return reply.send({ success: true, message: 'Comment deleted successfully' });
      } catch (error) {
        logger.error('[Fastify material] deleteMaterialComment error:', error);
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
    async (_request, reply) => {
      const request = _request as AuthReq;
      const materialId = (request.params as { id: string }).id;
      try {
        const material = await prisma.material.findFirst({
          where:
            request.user?.role === 'ADMIN'
              ? { id: materialId }
              : {
                  id: materialId,
                  OR: [{ userId: request.userId }, { teamId: request.workspaceId }],
                },
        });
        if (!material) {
          throw new AppError('Material not found or access denied', 404);
        }
        const share = await prisma.materialShare.findUnique({
          where: { materialId },
        });
        return reply.send(share);
      } catch (error) {
        logger.error('[Fastify material] getMaterialShare error:', error);
        throw error;
      }
    },
  );

  // POST /:id/share —— 创建/更新分享
  app.post(
    '/:id/share',
    {
      preHandler: [fastifyAuthenticate],
      schema: { params: idParamsSchema, body: materialShareSchema },
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    },
    async (_request, reply) => {
      const request = _request as AuthReq;
      const materialId = (request.params as { id: string }).id;
      const userId = request.userId as string;
      const { expireHours, expiresAt, customText } = request.body as {
        expireHours?: number;
        expiresAt?: string;
        customText?: string;
      };
      try {
        const material = await prisma.material.findFirst({
          where:
            request.user?.role === 'ADMIN'
              ? { id: materialId }
              : {
                  id: materialId,
                  OR: [{ userId: request.userId }, { teamId: request.workspaceId }],
                },
        });
        if (!material) {
          throw new AppError('Material not found or access denied', 404);
        }

        let calculatedExpiresAt: Date | null = null;
        if (expiresAt) {
          calculatedExpiresAt = new Date(expiresAt);
        } else if (expireHours !== undefined && expireHours !== null) {
          calculatedExpiresAt = new Date(Date.now() + expireHours * 60 * 60 * 1000);
        }

        const existing = await prisma.materialShare.findUnique({
          where: { materialId },
        });

        let share;
        if (existing) {
          share = await prisma.materialShare.update({
            where: { materialId },
            data: {
              expiresAt: calculatedExpiresAt,
              customText,
            },
          });
        } else {
          share = await prisma.materialShare.create({
            data: {
              materialId,
              userId,
              expiresAt: calculatedExpiresAt,
              customText,
            },
          });
        }

        return reply.send(share);
      } catch (error) {
        logger.error('[Fastify material] createOrUpdateMaterialShare error:', error);
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
    async (_request, reply) => {
      const request = _request as AuthReq;
      const materialId = (request.params as { id: string }).id;
      try {
        const material = await prisma.material.findFirst({
          where:
            request.user?.role === 'ADMIN'
              ? { id: materialId }
              : {
                  id: materialId,
                  OR: [{ userId: request.userId }, { teamId: request.workspaceId }],
                },
        });
        if (!material) {
          throw new AppError('Material not found or access denied', 404);
        }

        await prisma.materialShare.deleteMany({
          where: { materialId },
        });
        return reply.send({ success: true, message: 'Share link cancelled' });
      } catch (error) {
        logger.error('[Fastify material] cancelMaterialShare error:', error);
        throw error;
      }
    },
  );

  // POST /upload —— 上传材质
  app.post(
    '/upload',
    {
      preHandler: [
        fastifyAuthenticate,
        fastifyUpload([
          { name: 'material_file', maxCount: 1 },
          { name: 'preview', maxCount: 1 },
        ]),
      ],
    },
    async (_request, reply) => {
      const request = _request as AuthReq;
      const files = (request as unknown as { files?: Record<string, UploadedFile[]> }).files;
      const materialFile = files?.material_file?.[0];
      const previewFile = files?.preview?.[0];
      try {
        const userId = request.userId as string;
        const workspaceId = request.workspaceId;

        const body = request.body as Record<string, string>;
        const {
          title,
          description,
          category,
          resolution,
          tags,
          isProcedural,
          externalUrl,
          originality,
          originalAuthor,
          originalLink,
          license,
          isFree,
          linkedCourseId,
          linkedLessonId,
          bilibiliUrl,
        } = body;

        let tempMaterialPath = body.tempMaterialPath;
        let tempPreviewPath = body.tempPreviewPath;

        if (!materialFile && !tempMaterialPath && !externalUrl) {
          throw new AppError('No material file or external link provided', 400);
        }

        if (tempMaterialPath) {
          tempMaterialPath = moveTempFileToDestination(request, tempMaterialPath, 'materials');
        }
        if (tempPreviewPath) {
          tempPreviewPath = moveTempFileToDestination(request, tempPreviewPath, 'materials');
        }

        let fileSizeMB = body.fileSize ? parseFloat(body.fileSize) / (1024 * 1024) : 0;
        if (fileSizeMB === 0) {
          fileSizeMB = materialFile ? materialFile.size / (1024 * 1024) : 0;
          if (!materialFile && tempMaterialPath) {
            fileSizeMB = await getFileSizeInMb(tempMaterialPath);
          }
        }

        const storageQuota = await checkStorageQuota(userId, fileSizeMB, workspaceId);
        if (!storageQuota.allowed) {
          throw new AppError(storageQuota.message || 'Quota exceeded', 403);
        }

        let packageFilesList: string[] = [];
        if (body.packageFilesList) {
          try {
            packageFilesList = JSON.parse(body.packageFilesList);
          } catch {
            /* ignore */
          }
        }

        if (packageFilesList.length === 0) {
          if (materialFile) {
            const ext = path.extname(materialFile.originalname).toLowerCase();
            if (ext === '.zip' && materialFile.buffer) {
              try {
                packageFilesList = await parseZipBuffer(materialFile.buffer);
              } catch (zipErr) {
                logger.error('[MaterialCreate] Failed to parse package ZIP from buffer:', zipErr);
              }
            }
          }
        }

        let fileUrl = externalUrl;
        if (materialFile) {
          fileUrl = getUploadedFileUrl(
            request,
            materialFile as unknown as Express.Multer.File,
            'materials',
          );
        } else if (tempMaterialPath) {
          fileUrl = tempMaterialPath;
        }

        let previewUrl = null;
        if (previewFile) {
          previewUrl = getUploadedFileUrl(
            request,
            previewFile as unknown as Express.Multer.File,
            'materials',
          );
        } else if (tempPreviewPath) {
          previewUrl = tempPreviewPath;
        }

        const material = await prisma.material.create({
          data: {
            title: title || (materialFile ? materialFile.originalname : '未命名材质'),
            description: description || null,
            category: category || '其他',
            resolution,
            previewUrl,
            fileUrl: fileUrl!,
            status: 'PENDING',
            fileSize: Math.round(fileSizeMB * 100) / 100,
            packageFilesList: packageFilesList.length > 0 ? JSON.stringify(packageFilesList) : null,
            tags: normalizeTagsForStorage(tags),
            isProcedural: parseBool(isProcedural),
            userId: userId,
            teamId: workspaceId,
            originality: originality || 'ORIGINAL',
            originalAuthor: originalAuthor || null,
            originalLink: originalLink || null,
            license: license || 'CC_BY',
            isFree: parseBool(isFree, true),
            linkedCourseId: linkedCourseId || null,
            linkedLessonId: linkedLessonId || null,
            bilibiliUrl: bilibiliUrl || null,
          },
        });

        await auditService.log({
          userId,
          action: AuditAction.CREATE_MATERIAL,
          module: AuditModule.MATERIAL,
          description: `Uploaded material: ${material.title}`,
          newValue: material,
          req: request as unknown as AuditRequest,
        });

        return reply.status(201).send(material);
      } catch (error) {
        logger.error('[Fastify material] uploadMaterial error:', error);
        throw error;
      }
    },
  );

  // PUT /:id —— 更新材质
  app.put(
    '/:id',
    {
      preHandler: [
        fastifyAuthenticate,
        fastifyUpload([
          { name: 'material_file', maxCount: 1 },
          { name: 'preview', maxCount: 1 },
        ]),
      ],
      schema: { params: idParamsSchema },
    },
    async (_request, reply) => {
      const request = _request as AuthReq;
      const id = (request.params as { id: string }).id;
      const files = (request as unknown as { files?: Record<string, UploadedFile[]> }).files;
      const materialFile = files?.material_file?.[0];
      const previewFile = files?.preview?.[0];
      try {
        const body = request.body as Record<string, string>;
        let tempMaterialPath = body.tempMaterialPath;
        let tempPreviewPath = body.tempPreviewPath;

        if (tempMaterialPath) {
          tempMaterialPath = moveTempFileToDestination(request, tempMaterialPath, 'materials');
        }
        if (tempPreviewPath) {
          tempPreviewPath = moveTempFileToDestination(request, tempPreviewPath, 'materials');
        }

        const existing = await prisma.material.findFirst({
          where: { id, teamId: request.workspaceId },
        });

        if (!existing) {
          throw new AppError('Material not found', 404);
        }

        if (existing.userId !== request.userId && request.user?.role !== 'ADMIN') {
          throw new AppError('Not authorized to update this material', 403);
        }

        const {
          title,
          description,
          category: cat,
          resolution,
          tags,
          isProcedural,
          externalUrl,
          originality,
          originalAuthor,
          originalLink,
          license,
          isFree,
          linkedCourseId,
          linkedLessonId,
          bilibiliUrl,
        } = body;
        const updateData: Prisma.MaterialUncheckedUpdateInput = {};
        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description || null;
        if (cat !== undefined) updateData.category = cat;
        if (resolution !== undefined) updateData.resolution = resolution || null;
        if (tags !== undefined) updateData.tags = normalizeTagsForStorage(tags);
        if (isProcedural !== undefined) {
          updateData.isProcedural =
            (isProcedural as unknown as boolean) === true || isProcedural === 'true';
        }
        if (originality !== undefined) updateData.originality = originality;
        if (originalAuthor !== undefined) updateData.originalAuthor = originalAuthor || null;
        if (originalLink !== undefined) updateData.originalLink = originalLink || null;
        if (license !== undefined) updateData.license = license;
        if (isFree !== undefined) {
          updateData.isFree = (isFree as unknown as boolean) === true || isFree === 'true';
        }
        if (linkedCourseId !== undefined) updateData.linkedCourseId = linkedCourseId || null;
        if (linkedLessonId !== undefined) updateData.linkedLessonId = linkedLessonId || null;
        if (bilibiliUrl !== undefined) updateData.bilibiliUrl = bilibiliUrl || null;
        if (existing.userId === request.userId && request.user?.role !== 'ADMIN') {
          updateData.status = 'PENDING';
          updateData.rejectReason = null;
        }

        let packageFilesList: string[] = [];
        if (body.packageFilesList) {
          try {
            packageFilesList = JSON.parse(body.packageFilesList);
          } catch {
            /* ignore */
          }
        }

        if (materialFile) {
          const fileSizeMB = body.fileSize
            ? parseFloat(body.fileSize) / (1024 * 1024)
            : materialFile.size / (1024 * 1024);
          const storageQuota = await checkStorageQuota(
            request.userId as string,
            fileSizeMB,
            request.workspaceId,
          );
          if (!storageQuota.allowed) {
            throw new AppError(storageQuota.message || 'Quota exceeded', 403);
          }

          if (existing.fileUrl) {
            deleteCloudOrLocalFileByUrl(existing.fileUrl).catch(() => {
              /* ignore */
            });
          }

          const fileUrl = getUploadedFileUrl(
            request,
            materialFile as unknown as Express.Multer.File,
            'materials',
          );
          updateData.fileUrl = fileUrl;
          updateData.fileSize = Math.round(fileSizeMB * 100) / 100;

          if (packageFilesList.length === 0) {
            const ext = path.extname(materialFile.originalname).toLowerCase();
            if (ext === '.zip' && materialFile.buffer) {
              try {
                packageFilesList = await parseZipBuffer(materialFile.buffer);
              } catch (zipErr) {
                logger.error('[MaterialCreate] Failed to parse package ZIP from buffer:', zipErr);
              }
            }
          }
          updateData.packageFilesList =
            packageFilesList.length > 0 ? JSON.stringify(packageFilesList) : null;
        } else if (tempMaterialPath) {
          let fileSizeMB = body.fileSize ? parseFloat(body.fileSize) / (1024 * 1024) : 0;
          if (fileSizeMB === 0) {
            fileSizeMB = await getFileSizeInMb(tempMaterialPath);
          }

          const storageQuota = await checkStorageQuota(
            request.userId as string,
            fileSizeMB,
            request.workspaceId,
          );
          if (!storageQuota.allowed) {
            throw new AppError(storageQuota.message || 'Quota exceeded', 403);
          }

          if (existing.fileUrl) {
            deleteCloudOrLocalFileByUrl(existing.fileUrl).catch(() => {
              /* ignore */
            });
          }

          updateData.fileUrl = tempMaterialPath;
          updateData.fileSize = Math.round(fileSizeMB * 100) / 100;
          updateData.packageFilesList =
            packageFilesList.length > 0 ? JSON.stringify(packageFilesList) : null;
        } else if (externalUrl !== undefined) {
          if (externalUrl && existing.fileUrl) {
            deleteCloudOrLocalFileByUrl(existing.fileUrl).catch(() => {
              /* ignore */
            });
            updateData.fileSize = 0;
            updateData.packageFilesList = null;
          }
          if (externalUrl !== undefined) {
            updateData.fileUrl = (externalUrl || null) as string;
          }
        }

        if (previewFile) {
          if (existing.previewUrl) {
            deleteCloudOrLocalFileByUrl(existing.previewUrl).catch(() => {
              /* ignore */
            });
          }
          const previewUrl = getUploadedFileUrl(
            request,
            previewFile as unknown as Express.Multer.File,
            'materials',
          );
          updateData.previewUrl = previewUrl;
        } else if (tempPreviewPath) {
          if (existing.previewUrl) {
            deleteCloudOrLocalFileByUrl(existing.previewUrl).catch(() => {
              /* ignore */
            });
          }
          updateData.previewUrl = tempPreviewPath;
        }

        const material = await prisma.material.update({
          where: { id },
          data: updateData,
          include: materialInclude,
        });

        await auditService.log({
          userId: request.userId as string,
          action: AuditAction.UPDATE_MATERIAL,
          module: AuditModule.MATERIAL,
          description: `Updated material: ${material.title}`,
          oldValue: existing,
          newValue: material,
          req: request as unknown as AuditRequest,
        });

        return reply.send(material);
      } catch (error) {
        logger.error('[Fastify material] updateMaterial error:', error);
        throw error;
      }
    },
  );
};
