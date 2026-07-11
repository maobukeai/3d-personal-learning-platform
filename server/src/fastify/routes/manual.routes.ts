import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as manualController from '../../manual/controllers/manual-station.controller';
import { fastifyAuthenticate, fastifyOptionalAuthenticate } from '../auth/fastify-auth';

/**
 * Fastify 手册站公开路由（原生 Fastify handler，已移除 adaptHandler 桥接）。
 *
 * 挂载前缀: /api/manual
 *  多数端点为可选鉴权（对齐 Express optionalAuthenticate），变更类操作需鉴权。
 *
 * 端点：
 *  - GET    /stations                          列出手册站（可选鉴权）
 *  - GET    /stations/:id                     手册站详情（可选鉴权）
 *  - GET    /stations/:stationId/categories   分类列表（可选鉴权）
 *  - GET    /stations/:stationId/resources    资源列表（可选鉴权）
 *  - GET    /resources/:id                    资源详情（可选鉴权）
 *  - POST   /resources/:id/extract            提取下载链接（鉴权 + extractLimiter 15/min）
 *  - POST   /resources/:id/comments           发表评论（鉴权）
 *  - POST   /resources/:id/like               点赞切换（鉴权）
 */

const idParamsSchema = z.object({
  id: z.string().min(1, 'Id is required'),
});

const stationIdParamsSchema = z.object({
  stationId: z.string().min(1, 'Station id is required'),
});

export const registerManualRoutes = (app: FastifyInstance): void => {
  const optionalAuth = {
    preHandler: [fastifyOptionalAuthenticate],
  };
  const auth = {
    preHandler: [fastifyAuthenticate],
  };

  // GET /manual/stations —— 列出手册站
  app.get('/manual/stations', { ...optionalAuth }, async (request, reply) => {
    return manualController.getStations(request, reply);
  });

  // GET /manual/stations/:id —— 手册站详情
  app.get(
    '/manual/stations/:id',
    { ...optionalAuth, schema: { params: idParamsSchema } },
    async (request, reply) => {
      return manualController.getStation(request, reply);
    },
  );

  // GET /manual/stations/:stationId/categories —— 分类列表
  app.get(
    '/manual/stations/:stationId/categories',
    { ...optionalAuth, schema: { params: stationIdParamsSchema } },
    async (request, reply) => {
      return manualController.getCategories(request, reply);
    },
  );

  // GET /manual/stations/:stationId/resources —— 资源列表
  app.get(
    '/manual/stations/:stationId/resources',
    { ...optionalAuth, schema: { params: stationIdParamsSchema } },
    async (request, reply) => {
      return manualController.getResources(request, reply);
    },
  );

  // GET /manual/resources/:id —— 资源详情
  app.get(
    '/manual/resources/:id',
    { ...optionalAuth, schema: { params: idParamsSchema } },
    async (request, reply) => {
      return manualController.getResource(request, reply);
    },
  );

  // POST /manual/resources/:id/extract —— 提取下载链接（鉴权 + extractLimiter 15/min）
  app.post(
    '/manual/resources/:id/extract',
    {
      ...auth,
      schema: { params: idParamsSchema },
      // Express extractLimiter: 15 / minute
      config: { rateLimit: { max: 15, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      return manualController.extractDownloadLink(request, reply);
    },
  );

  // POST /manual/resources/:id/comments —— 发表评论
  app.post(
    '/manual/resources/:id/comments',
    { ...auth, schema: { params: idParamsSchema } },
    async (request, reply) => {
      return manualController.createComment(request, reply);
    },
  );

  // POST /manual/resources/:id/like —— 点赞切换
  app.post(
    '/manual/resources/:id/like',
    { ...auth, schema: { params: idParamsSchema } },
    async (request, reply) => {
      return manualController.toggleLike(request, reply);
    },
  );
};
