import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { Prisma } from '@prisma/client';
import prisma from '../../../services/prisma';
import { logger } from '../../../utils/logger';
import { redisService } from '../../../services/redis.service';
import { clampLimit, clampPage, createPaginationMeta } from '../../../utils/pagination';
import {
  tagSearchKey,
  TAG_SEARCH_REDIS_TTL,
  signAssetUrls,
  buildAssetPerformanceReport,
} from '../../../controllers/asset/helpers';
import {
  shareIdParamsSchema,
  assetListQuerySchema,
  requestsQuerySchema,
  fastifyOptionalAuthenticate,
  fastifyAuthenticate,
  fastifyResolveWorkspace,
  CATEGORIES_CACHE_KEY,
  CATEGORIES_CACHE_TTL,
  getCustomAssetCategories,
  type AuthReq,
} from './asset-helpers';

export const registerAssetQueryRoutes = (app: FastifyInstance): void => {
  // GET /share/:shareId —— 公开分享详情
  app.get(
    '/share/:shareId',
    {
      preHandler: [fastifyOptionalAuthenticate],
      schema: { params: shareIdParamsSchema },
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
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
    async (request: FastifyRequest, reply: FastifyReply) => {
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
    async (request: FastifyRequest, reply: FastifyReply) => {
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

  // GET /my —— 我的资产
  app.get(
    '/my',
    {
      preHandler: [fastifyAuthenticate, fastifyResolveWorkspace],
      schema: { querystring: assetListQuerySchema },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = (request as AuthReq).userId!;
      const query = request.query as Record<string, string | undefined>;
      const page = clampPage(query.page);
      const limit = clampLimit(query.limit, 12, 50);
      const status = query.status;

      const where: Prisma.AssetWhereInput = {
        userId,
        ...(status && status !== 'all' ? { status } : {}),
      };

      const [assets, total] = await Promise.all([
        prisma.asset.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: { category: true },
        }),
        prisma.asset.count({ where }),
      ]);

      const signedAssets = await signAssetUrls(assets);
      return reply.send({
        assets: signedAssets,
        pagination: createPaginationMeta(total, page, limit),
      });
    },
  );

  // GET /favorites —— 我的收藏列表
  app.get(
    '/favorites',
    {
      preHandler: [fastifyAuthenticate, fastifyResolveWorkspace],
      schema: { querystring: assetListQuerySchema },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = (request as AuthReq).userId!;
      const query = request.query as Record<string, string | undefined>;
      const page = clampPage(query.page);
      const limit = clampLimit(query.limit, 12, 50);
      const categoryName = query.favoriteCategory;

      const where: Prisma.AssetLikeWhereInput = {
        userId,
        ...(categoryName && categoryName !== 'all' ? { category: categoryName } : {}),
      };

      const [likes, total, customCategories] = await Promise.all([
        prisma.assetLike.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            asset: {
              include: {
                category: true,
                user: { select: { name: true, avatarUrl: true } },
              },
            },
          },
        }),
        prisma.assetLike.count({ where }),
        getCustomAssetCategories(userId),
      ]);

      const assets = likes.map((like) => like.asset);
      const signedAssets = await signAssetUrls(assets);

      return reply.send({
        assets: signedAssets,
        customCategories,
        pagination: createPaginationMeta(total, page, limit),
      });
    },
  );

  // GET /insights —— 资产洞察分析
  app.get(
    '/insights',
    {
      preHandler: [fastifyAuthenticate, fastifyResolveWorkspace],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = (request as AuthReq).userId!;
      const assets = await prisma.asset.findMany({
        where: { userId },
        include: { category: true },
      });

      const report = buildAssetPerformanceReport(assets as any);
      return reply.send(report);
    },
  );

  // GET /requests —— 求资源列表
  app.get(
    '/requests',
    {
      preHandler: [fastifyOptionalAuthenticate],
      schema: { querystring: requestsQuerySchema },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as Record<string, string | undefined>;
      const page = clampPage(query.page);
      const limit = clampLimit(query.limit, 10, 30);
      const status = query.status;

      const where: Prisma.AssetRequestWhereInput = {
        ...(status && status !== 'all' ? { status } : {}),
      };

      const [requests, total] = await Promise.all([
        prisma.assetRequest.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
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
        pagination: createPaginationMeta(total, page, limit),
      });
    },
  );
};
