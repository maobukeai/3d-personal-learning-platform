import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { mirrorService } from '../../mirror/services/mirror.service';
import prisma from '../../services/prisma';
import { getPlanName } from '../../utils/plan-utils';
import { encryptText } from '../../utils/crypto';
import { clampLimit, clampPage } from '../../utils/pagination';
import { config } from '../../config/env';
import { logger } from '../../utils/logger';
import {
  fastifyAuthenticate,
  fastifyOptionalAuthenticate,
  type SafeUser,
} from '../auth/fastify-auth';

/**
 * Fastify 镜像源公开路由（原生 handler，无 adaptHandler 桥接）。
 *
 * 挂载前缀: /api/mirror
 *  多数端点为可选鉴权（对齐 Express optionalAuthenticate），变更类操作需鉴权。
 *
 * 端点：
 *  - GET    /sources                              列出镜像源（可选鉴权）
 *  - GET    /sources/:id                          镜像源详情（可选鉴权）
 *  - GET    /sources/:sourceId/categories         分类列表（可选鉴权）
 *  - GET    /sources/:sourceId/resources          资源列表（可选鉴权）
 *  - GET    /sources/:sourceId/stats              镜像源统计（可选鉴权）
 *  - GET    /sources/:sourceId/search             搜索资源（可选鉴权）
 *  - GET    /sources/:sourceId/plan-required      计划门槛（公开）
 *  - GET    /resources/:id                        资源详情（可选鉴权）
 *  - GET    /resources/:id/comments               资源评论（可选鉴权）
 *  - GET    /resources/:id/like-status            点赞状态（可选鉴权）
 *  - POST   /resources/:id/extract                提取下载链接（鉴权 + extractLimiter 10/min）
 *  - POST   /resources/:id/comments               发表评论（鉴权）
 *  - DELETE /resources/comments/:commentId        删除评论（鉴权）
 *  - POST   /resources/:id/like                   点赞切换（鉴权）
 *
 * 路由级限流：extract 端点 10/min（对齐 Express extractLimiter）
 */

// --- Schemas ---

const idParamsSchema = z.object({
  id: z.string().min(1, 'Id is required'),
});

const sourceIdParamsSchema = z.object({
  sourceId: z.string().min(1, 'Source id is required'),
});

const commentIdParamsSchema = z.object({
  commentId: z.string().min(1, 'Comment id is required'),
});

const getResourcesQuerySchema = z.object({
  page: z.union([z.string(), z.number()]).optional(),
  pageSize: z.union([z.string(), z.number()]).optional(),
  categoryId: z.string().optional(),
  search: z.string().optional(),
  sort: z.string().optional(),
});

const searchResourcesQuerySchema = z.object({
  q: z.string().optional(),
  page: z.union([z.string(), z.number()]).optional(),
  pageSize: z.union([z.string(), z.number()]).optional(),
});

const createCommentBodySchema = z.object({
  content: z.string().min(1, '评论内容不能为空'),
});

// --- Helpers ---

interface AuthLikeRequest extends FastifyRequest {
  user?: SafeUser;
  userId?: string;
}

const checkSourceAccess = async (sourceId: string, request: AuthLikeRequest) => {
  const source = await prisma.mirrorSource.findUnique({
    where: { id: sourceId },
    select: { minPlanPriority: true },
  });

  if (!source) {
    return { hasAccess: false, error: '镜像源不存在' };
  }

  if (source.minPlanPriority > 0) {
    let userPlanPriority = 0;
    if (request.userId) {
      userPlanPriority = await mirrorService.getUserPlanPriority(request.userId);
    }
    if (userPlanPriority < source.minPlanPriority) {
      return {
        hasAccess: false,
        error: '权限不足',
        message: `当前内容需要更高会员权限才能查看`,
        requiredPlan: source.minPlanPriority,
        currentPlan: userPlanPriority,
      };
    }
  }

  return { hasAccess: true };
};

const getPublicBaseUrl = (request: FastifyRequest): string => {
  const configured = config.BACKEND_URL?.replace(/\/$/, '');
  const isLocalConfigured = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(
    configured || '',
  );

  if (configured && !isLocalConfigured) {
    return configured;
  }

  const forwardedProtoHeader = request.headers['x-forwarded-proto'];
  const forwardedProto = Array.isArray(forwardedProtoHeader)
    ? forwardedProtoHeader[0]?.trim()
    : forwardedProtoHeader?.trim();
  const protocol = forwardedProto || request.protocol;
  const forwardedHostHeader = request.headers['x-forwarded-host'];
  const forwardedHost = Array.isArray(forwardedHostHeader)
    ? forwardedHostHeader[0]?.trim()
    : forwardedHostHeader?.trim();
  const hostHeader = request.headers['host'];
  const host = forwardedHost || (Array.isArray(hostHeader) ? hostHeader[0] : hostHeader);

  return `${protocol}://${host}`.replace(/\/$/, '');
};

const normalizeUploadUrl = (value: string | null | undefined, baseUrl: string): string | null => {
  if (!value) return null;

  if (value.startsWith('/uploads/')) {
    return `${baseUrl}${value}`;
  }

  return value.replace(
    /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(\/uploads\/.*)$/i,
    `${baseUrl}$1`,
  );
};

const normalizeUploadUrlsInHtml = (html: string, baseUrl: string) =>
  html
    .replace(
      /(src|href)=["'](\/uploads\/[^"']+)["']/gi,
      (_match, attr, uploadPath) => `${attr}="${baseUrl}${uploadPath}"`,
    )
    .replace(
      /(src|href)=["']https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(\/uploads\/[^"']+)["']/gi,
      (_match, attr, uploadPath) => `${attr}="${baseUrl}${uploadPath}"`,
    );

export const registerMirrorRoutes = (app: FastifyInstance): void => {
  const optionalAuth = {
    preHandler: [fastifyOptionalAuthenticate],
  };
  const auth = {
    preHandler: [fastifyAuthenticate],
  };

  // GET /mirror/sources —— 列出镜像源
  app.get('/mirror/sources', { ...optionalAuth }, async (request, reply) => {
    const userId = request.userId || 'guest';
    const sources = await mirrorService.getAccessibleSources(userId);

    const result = sources.map((s) => ({
      id: s.id,
      name: s.name,
      displayName: s.displayName,
      baseUrl: s.baseUrl,
      adapterType: s.adapterType,
      status: s.status,
      syncStatus: s.syncStatus,
      lastSyncAt: s.lastSyncAt,
      lastSyncDuration: s.lastSyncDuration,
      totalResources: s.totalResources,
      iconUrl: s.iconUrl,
      description: s.description,
      hasAccess: s.hasAccess,
      minPlanPriority: s.minPlanPriority,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));

    return reply.send(result);
  });

  // GET /mirror/sources/:id —— 镜像源详情
  app.get(
    '/mirror/sources/:id',
    { ...optionalAuth, schema: { params: idParamsSchema } },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const source = await mirrorService.getSource(id, request.userId);

      if (!source) {
        return reply.status(404).send({ error: '镜像源不存在' });
      }

      return reply.send(source);
    },
  );

  // GET /mirror/sources/:sourceId/categories —— 分类列表
  app.get(
    '/mirror/sources/:sourceId/categories',
    { ...optionalAuth, schema: { params: sourceIdParamsSchema } },
    async (request, reply) => {
      const { sourceId } = request.params as { sourceId: string };
      const sourceExists = await prisma.mirrorSource.findUnique({ where: { id: sourceId } });
      if (!sourceExists) {
        return reply.status(404).send({ error: '镜像源不存在' });
      }

      const categories = await mirrorService.getCategories(sourceId);
      return reply.send(categories);
    },
  );

  // GET /mirror/sources/:sourceId/resources —— 资源列表
  app.get(
    '/mirror/sources/:sourceId/resources',
    {
      ...optionalAuth,
      schema: { params: sourceIdParamsSchema, querystring: getResourcesQuerySchema },
    },
    async (request, reply) => {
      const { sourceId } = request.params as { sourceId: string };
      const sourceExists = await prisma.mirrorSource.findUnique({ where: { id: sourceId } });
      if (!sourceExists) {
        return reply.status(404).send({ error: '镜像源不存在' });
      }

      const query = request.query as {
        page?: string | number;
        pageSize?: string | number;
        categoryId?: string;
        search?: string;
        sort?: string;
      };
      const page = clampPage(query.page);
      const pageSize = clampLimit(query.pageSize, 21, 100);
      const categoryId = query.categoryId || undefined;
      const search = query.search || undefined;
      const sort = query.sort || undefined;

      const result = await mirrorService.getResources(sourceId, {
        page,
        pageSize,
        categoryId,
        search,
        sort,
      });

      return reply.send(result);
    },
  );

  // GET /mirror/sources/:sourceId/stats —— 镜像源统计
  app.get(
    '/mirror/sources/:sourceId/stats',
    { ...optionalAuth, schema: { params: sourceIdParamsSchema } },
    async (request, reply) => {
      const { sourceId } = request.params as { sourceId: string };
      const sourceExists = await prisma.mirrorSource.findUnique({ where: { id: sourceId } });
      if (!sourceExists) {
        return reply.status(404).send({ error: '镜像源不存在' });
      }

      const stats = await mirrorService.getSourceStats(sourceId);
      return reply.send(stats);
    },
  );

  // GET /mirror/sources/:sourceId/search —— 搜索资源
  app.get(
    '/mirror/sources/:sourceId/search',
    {
      ...optionalAuth,
      schema: { params: sourceIdParamsSchema, querystring: searchResourcesQuerySchema },
    },
    async (request, reply) => {
      const { sourceId } = request.params as { sourceId: string };
      const sourceExists = await prisma.mirrorSource.findUnique({ where: { id: sourceId } });
      if (!sourceExists) {
        return reply.status(404).send({ error: '镜像源不存在' });
      }

      const query = request.query as {
        q?: string;
        page?: string | number;
        pageSize?: string | number;
      };
      const q = query.q || '';
      const page = clampPage(query.page);
      const pageSize = clampLimit(query.pageSize, 21, 100);

      const result = await mirrorService.getResources(sourceId, {
        page,
        pageSize,
        search: q,
      });

      return reply.send(result);
    },
  );

  // GET /mirror/sources/:sourceId/plan-required —— 计划门槛（公开）
  app.get(
    '/mirror/sources/:sourceId/plan-required',
    { schema: { params: sourceIdParamsSchema } },
    async (request, reply) => {
      const { sourceId } = request.params as { sourceId: string };
      const source = await prisma.mirrorSource.findUnique({
        where: { id: sourceId },
        select: { minPlanPriority: true, displayName: true },
      });

      if (!source) {
        return reply.status(404).send({ error: '镜像源不存在' });
      }

      return reply.send({
        sourceId,
        displayName: source.displayName,
        minPlanPriority: source.minPlanPriority,
        minPlanName: getPlanName(source.minPlanPriority),
      });
    },
  );

  // GET /mirror/resources/:id —— 资源详情
  app.get(
    '/mirror/resources/:id',
    { ...optionalAuth, schema: { params: idParamsSchema } },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const resource = await mirrorService.getResource(id);

      if (!resource) {
        return reply.status(404).send({ error: '资源不存在' });
      }

      const access = await checkSourceAccess(resource.sourceId, request as AuthLikeRequest);
      if (!access.hasAccess && access.error === '镜像源不存在') {
        return reply.status(404).send({ error: '镜像源不存在' });
      }

      const hostUrl = getPublicBaseUrl(request);
      let cleanHtml = resource.contentHtml || '';
      if (cleanHtml) {
        cleanHtml = normalizeUploadUrlsInHtml(cleanHtml, hostUrl);
      }

      const manualLinkRegex =
        /<!-- MANUAL_DOWNLOAD_LINK_START -->([\s\S]*?)<!-- MANUAL_DOWNLOAD_LINK_END -->/;
      const manualMatch = cleanHtml.match(manualLinkRegex);
      const hasManualLink = !!manualMatch;

      const linksMeta: Array<{ name: string; type: string }> = [];
      if (manualMatch && manualMatch[1]) {
        const block = manualMatch[1];
        const hrefMatch = block.match(/href="([^"]+)"/);
        if (hrefMatch && hrefMatch[1]) {
          const href = hrefMatch[1];
          const type = href.includes('quark.cn')
            ? 'quark'
            : href.includes('baidu.com')
              ? 'baidu'
              : href.includes('alipan.com') || href.includes('aliyundrive.com')
                ? 'aliyun'
                : href.includes('123pan.com')
                  ? '123pan'
                  : 'generic';
          const name = href.includes('quark.cn')
            ? '夸克网盘'
            : href.includes('baidu.com')
              ? '百度网盘'
              : href.includes('alipan.com') || href.includes('aliyundrive.com')
                ? '阿里云盘'
                : href.includes('123pan.com')
                  ? '123云盘'
                  : '资源网盘';
          linksMeta.push({ name, type });
        }
      }

      const strippedHtml = cleanHtml.replace(
        /<!-- MANUAL_DOWNLOAD_LINK_START -->[\s\S]*?<!-- MANUAL_DOWNLOAD_LINK_END -->/g,
        '',
      );

      const finalThumbnail = normalizeUploadUrl(resource.thumbnailUrl, hostUrl);

      return reply.send({
        ...resource,
        contentHtml: access.hasAccess ? strippedHtml : null,
        thumbnailUrl: finalThumbnail,
        hasAccess: access.hasAccess,
        hasLinks: hasManualLink,
        links: access.hasAccess ? linksMeta : [],
        requiredPlan: access.requiredPlan,
        currentPlan: access.currentPlan,
      });
    },
  );

  // GET /mirror/resources/:id/comments —— 资源评论
  app.get(
    '/mirror/resources/:id/comments',
    { ...optionalAuth, schema: { params: idParamsSchema } },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const resource = await prisma.mirrorResource.findUnique({
        where: { id },
        select: { sourceId: true },
      });

      if (!resource) {
        return reply.status(404).send({ error: '资源不存在' });
      }

      const comments = await prisma.mirrorResourceComment.findMany({
        where: { resourceId: id },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      return reply.send(comments);
    },
  );

  // GET /mirror/resources/:id/like-status —— 点赞状态
  app.get(
    '/mirror/resources/:id/like-status',
    { ...optionalAuth, schema: { params: idParamsSchema } },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const userId = request.userId;

      const resource = await prisma.mirrorResource.findUnique({
        where: { id },
        select: { sourceId: true },
      });

      if (!resource) {
        return reply.status(404).send({ error: '资源不存在' });
      }

      const count = await prisma.mirrorResourceLike.count({
        where: { resourceId: id },
      });

      let liked = false;
      if (userId) {
        const existingLike = await prisma.mirrorResourceLike.findUnique({
          where: {
            resourceId_userId: {
              resourceId: id,
              userId,
            },
          },
        });
        liked = !!existingLike;
      }

      return reply.send({ liked, count });
    },
  );

  // POST /mirror/resources/:id/extract —— 提取下载链接（鉴权 + extractLimiter 10/min）
  app.post(
    '/mirror/resources/:id/extract',
    {
      ...auth,
      schema: { params: idParamsSchema },
      // Express extractLimiter: 10 / minute
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const resource = await mirrorService.getResource(id);

      if (!resource) {
        return reply.status(404).send({ error: '资源不存在' });
      }

      const access = await checkSourceAccess(resource.sourceId, request as AuthLikeRequest);
      if (!access.hasAccess) {
        return reply.status(access.error === '镜像源不存在' ? 404 : 403).send(access);
      }

      let link = '';
      let password = '';

      const contentHtml = resource.contentHtml || '';
      const manualLinkRegex =
        /<!-- MANUAL_DOWNLOAD_LINK_START -->([\s\S]*?)<!-- MANUAL_DOWNLOAD_LINK_END -->/;
      const manualMatch = contentHtml.match(manualLinkRegex);

      if (manualMatch && manualMatch[1]) {
        const block = manualMatch[1];
        const hrefMatch = block.match(/href="([^"]+)"/);
        if (hrefMatch && hrefMatch[1]) {
          link = hrefMatch[1];
        }

        const passMatch =
          block.match(/提取密码\/访问码：<\/strong><span[^>]*>([^<]+)<\/span>/) ||
          block.match(/提取密码：([^<]+)/);
        if (passMatch && passMatch[1]) {
          password = passMatch[1].trim();
        }
      }

      if (!link) {
        return reply.status(404).send({ error: '该资源暂未配置下载提取链接' });
      }

      const envKey = process.env.EXTRACT_ENCRYPTION_KEY;
      if (!envKey && process.env.NODE_ENV === 'production') {
        logger.warn(
          '[Mirror] EXTRACT_ENCRYPTION_KEY is not set in production. Falling back to default key.',
        );
      }
      const key = envKey || '3d_learning_platform_secure_extract_key_2026';
      const encryptedLink = encryptText(link, key);
      const encryptedPassword = password ? encryptText(password, key) : '';

      return reply.send({
        encryptedLink,
        encryptedPassword,
        driveName: link.includes('quark.cn')
          ? '夸克网盘'
          : link.includes('baidu.com')
            ? '百度网盘'
            : link.includes('alipan.com') || link.includes('aliyundrive.com')
              ? '阿里云盘'
              : link.includes('123pan.com')
                ? '123云盘'
                : '资源网盘',
      });
    },
  );

  // POST /mirror/resources/:id/comments —— 发表评论
  app.post(
    '/mirror/resources/:id/comments',
    {
      ...auth,
      schema: { params: idParamsSchema, body: createCommentBodySchema },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { content } = request.body as { content: string };
      const userId = request.userId!;

      const resource = await prisma.mirrorResource.findUnique({
        where: { id },
        select: { sourceId: true },
      });

      if (!resource) {
        return reply.status(404).send({ error: '资源不存在' });
      }

      const access = await checkSourceAccess(resource.sourceId, request as AuthLikeRequest);
      if (!access.hasAccess) {
        return reply.status(access.error === '镜像源不存在' ? 404 : 403).send(access);
      }

      const comment = await prisma.mirrorResourceComment.create({
        data: {
          content: content.trim(),
          resourceId: id,
          userId,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
        },
      });

      return reply.status(201).send(comment);
    },
  );

  // DELETE /mirror/resources/comments/:commentId —— 删除评论
  app.delete(
    '/mirror/resources/comments/:commentId',
    { ...auth, schema: { params: commentIdParamsSchema } },
    async (request, reply) => {
      const { commentId } = request.params as { commentId: string };
      const userId = request.userId!;

      const comment = await prisma.mirrorResourceComment.findUnique({
        where: { id: commentId },
        include: { resource: { select: { sourceId: true } } },
      });

      if (!comment) {
        return reply.status(404).send({ error: '评论不存在' });
      }

      const access = await checkSourceAccess(comment.resource.sourceId, request as AuthLikeRequest);
      if (!access.hasAccess) {
        return reply.status(access.error === '镜像源不存在' ? 404 : 403).send(access);
      }

      if (comment.userId !== userId && request.user?.role !== 'ADMIN') {
        return reply.status(403).send({ error: '无权删除此评论' });
      }

      await prisma.mirrorResourceComment.delete({
        where: { id: commentId },
      });

      return reply.send({ message: '评论删除成功' });
    },
  );

  // POST /mirror/resources/:id/like —— 点赞切换
  app.post(
    '/mirror/resources/:id/like',
    { ...auth, schema: { params: idParamsSchema } },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const userId = request.userId!;

      const resource = await prisma.mirrorResource.findUnique({
        where: { id },
        select: { sourceId: true },
      });

      if (!resource) {
        return reply.status(404).send({ error: '资源不存在' });
      }

      const access = await checkSourceAccess(resource.sourceId, request as AuthLikeRequest);
      if (!access.hasAccess) {
        return reply.status(access.error === '镜像源不存在' ? 404 : 403).send(access);
      }

      const existingLike = await prisma.mirrorResourceLike.findUnique({
        where: {
          resourceId_userId: {
            resourceId: id,
            userId,
          },
        },
      });

      let liked: boolean;
      if (existingLike) {
        await prisma.mirrorResourceLike.delete({
          where: { id: existingLike.id },
        });
        liked = false;
      } else {
        await prisma.mirrorResourceLike.create({
          data: {
            resourceId: id,
            userId,
          },
        });
        liked = true;
      }

      const count = await prisma.mirrorResourceLike.count({
        where: { resourceId: id },
      });

      return reply.send({ liked, count });
    },
  );
};
