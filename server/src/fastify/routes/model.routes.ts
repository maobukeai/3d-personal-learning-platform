import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import prisma from '../../services/prisma';
import { redisService } from '../../services/redis.service';
import { AppError } from '../../utils/error';
import { fastifyAuthenticate, fastifyOptionalAuthenticate } from '../auth/fastify-auth';

/**
 * Fastify 3D 模型资产路由（关键性能节点 POC）。
 * 复用 Express 同款 Prisma 单例 + 同款 JWT 鉴权逻辑。
 *
 * 挂载前缀: /api/fastify
 *  - GET /models          公开资产列表（分页/搜索/排序，高流量读端点）
 *  - GET /models/:id      查询单个资产的公开信息
 *  - GET /models/:id/status  资产处理状态轮询（前端 30s 兜底轮询）
 */

// Asset.id 在 schema.prisma 中是 @default(uuid())，所以这里用 uuid 校验
const getModelParamsSchema = z.object({
  id: z.string().uuid(),
});

// GET /models 查询参数 schema
const listModelsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
  search: z.string().trim().optional(),
  sort: z.enum(['newest', 'oldest', 'popular', 'views']).default('newest'),
  categoryId: z.string().optional(),
});

export const registerModelRoutes = (app: FastifyInstance): void => {
  app.get(
    '/models/:id',
    {
      preHandler: [fastifyAuthenticate],
      schema: {
        params: getModelParamsSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const asset = await prisma.asset.findUnique({
        where: { id },
        select: {
          id: true,
          title: true,
          url: true,
          status: true,
          type: true,
          thumbnail: true,
          description: true,
          // 3D metadata
          vertices: true,
          faces: true,
          materials: true,
          animations: true,
          hasAnimations: true,
          size: true,
          dimensions: true,
          maxTextureRes: true,
          // 版权与授权
          originality: true,
          originalAuthor: true,
          originalLink: true,
          license: true,
          // 3D 规格
          meshType: true,
          uvUnwrapped: true,
          uvOverlapping: true,
          pbrChannels: true,
          rigged: true,
          gameReady: true,
          // 视口配置
          defaultCameraPos: true,
          defaultCameraTarget: true,
          defaultEnvironment: true,
          defaultExposure: true,
          // 统计
          downloads: true,
          likes: true,
          viewCount: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!asset) {
        throw new AppError('Asset not found', 404, 'ASSET_NOT_FOUND');
      }

      // 任务要求返回 { id, name, url, status, metadata }：
      // Asset 表里没有 name 字段，title 即显示名；metadata 是组合字段，
      // 由 vertices/faces/materials/... 等 3D 规格数据组装而成。
      return reply.send({
        id: asset.id,
        name: asset.title,
        url: asset.url,
        status: asset.status,
        metadata: {
          type: asset.type,
          thumbnail: asset.thumbnail,
          description: asset.description,
          vertices: asset.vertices,
          faces: asset.faces,
          materials: asset.materials,
          animations: asset.animations,
          hasAnimations: asset.hasAnimations,
          size: asset.size,
          dimensions: asset.dimensions,
          maxTextureRes: asset.maxTextureRes,
          originality: asset.originality,
          originalAuthor: asset.originalAuthor,
          originalLink: asset.originalLink,
          license: asset.license,
          meshType: asset.meshType,
          uvUnwrapped: asset.uvUnwrapped,
          uvOverlapping: asset.uvOverlapping,
          pbrChannels: asset.pbrChannels,
          rigged: asset.rigged,
          gameReady: asset.gameReady,
          defaultCameraPos: asset.defaultCameraPos,
          defaultCameraTarget: asset.defaultCameraTarget,
          defaultEnvironment: asset.defaultEnvironment,
          defaultExposure: asset.defaultExposure,
          downloads: asset.downloads,
          likes: asset.likes,
          viewCount: asset.viewCount,
          createdAt: asset.createdAt,
          updatedAt: asset.updatedAt,
        },
      });
    },
  );

  // GET /models —— 公开资产列表（高流量读端点，Fastify Zod schema 加速入参校验 + 序列化）
  app.get(
    '/models',
    {
      preHandler: [fastifyOptionalAuthenticate],
      schema: {
        querystring: listModelsQuerySchema,
      },
    },
    async (request, reply) => {
      const { page, limit, search, sort, categoryId } = request.query as {
        page: number;
        limit: number;
        search?: string;
        sort: string;
        categoryId?: string;
      };
      const skip = (page - 1) * limit;

      const where: Record<string, unknown> = {
        status: 'APPROVED',
        teamId: null,
      };

      if (categoryId && categoryId !== 'all') {
        where.categoryId = categoryId;
      }
      if (search) {
        const trimmed = search.trim();
        if (trimmed) {
          where.OR = [
            { title: { contains: trimmed } },
            { description: { contains: trimmed } },
            { tags: { contains: trimmed } },
          ];
        }
      }

      const orderBy: Record<string, string> =
        sort === 'oldest'
          ? { createdAt: 'asc' }
          : sort === 'popular'
            ? { downloads: 'desc' }
            : sort === 'views'
              ? { viewCount: 'desc' }
              : { createdAt: 'desc' };

      const [items, total] = await Promise.all([
        prisma.asset.findMany({
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
            category: { select: { name: true } },
            user: { select: { name: true, avatarUrl: true } },
          },
        }),
        prisma.asset.count({ where }),
      ]);

      return reply.send({
        items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    },
  );

  // GET /models/:id/status —— 资产处理状态轮询（前端 30s 兜底，轻量级查询）
  app.get(
    '/models/:id/status',
    {
      preHandler: [fastifyAuthenticate],
      schema: {
        params: getModelParamsSchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

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
        throw new AppError('Asset not found', 404, 'ASSET_NOT_FOUND');
      }

      // 查询 Draco 队列任务状态（从 Redis 读取最新 job 状态）
      let processingStatus: 'idle' | 'pending' | 'running' | 'completed' | 'failed' = 'idle';
      try {
        const jobStatus = await redisService.get<string>(`draco-job-status:${id}`);
        if (jobStatus) {
          processingStatus = jobStatus as typeof processingStatus;
        } else if (asset.faces !== null || asset.vertices !== null) {
          processingStatus = 'completed';
        }
      } catch {
        // Redis 不可用时回退到 idle
      }

      return reply.send({
        id: asset.id,
        status: asset.status,
        url: asset.url,
        thumbnail: asset.thumbnail,
        faces: asset.faces,
        vertices: asset.vertices,
        hasAnimations: asset.hasAnimations,
        size: asset.size,
        processingStatus,
      });
    },
  );
};
