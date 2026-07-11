import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as roadmapController from '../../controllers/roadmap.controller';
import {
  createRoadmapSchema,
  roadmapStepProgressSchema,
  updateRoadmapSchema,
} from '../../utils/schemas-batch3';
import { fastifyAuthenticate } from '../auth/fastify-auth';

/**
 * Fastify 学习路线图路由（原生 Fastify handler）。
 *
 * 挂载前缀: /api/fastify/roadmaps
 *  全部端点需鉴权（对齐 Express authenticate + roadmapLimiter）。
 *
 * 端点：
 *  - GET    /                 获取全部路线图
 *  - GET    /my-progress      获取我的路线图进度
 *  - POST   /step-progress    更新步骤进度
 *  - POST   /                 创建路线图
 *  - PUT    /:id               更新路线图
 *  - DELETE /:id               删除路线图
 *
 * 路由级限流：60/min（对齐 Express roadmapLimiter）
 */

const idParamsSchema = z.object({
  id: z.string().min(1, 'Roadmap id is required'),
});

export const registerRoadmapRoutes = (app: FastifyInstance): void => {
  const auth = {
    preHandler: [fastifyAuthenticate],
    // Express roadmapLimiter: 60 / minute
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
  };

  // GET /roadmaps —— 获取全部路线图
  app.get('/roadmaps', { ...auth }, roadmapController.getAllRoadmaps);

  // GET /roadmaps/my-progress —— 获取我的路线图进度
  app.get('/roadmaps/my-progress', { ...auth }, roadmapController.getMyRoadmapProgress);

  // POST /roadmaps/step-progress —— 更新步骤进度
  app.post(
    '/roadmaps/step-progress',
    { ...auth, schema: { body: roadmapStepProgressSchema } },
    roadmapController.updateStepProgress,
  );

  // POST /roadmaps —— 创建路线图
  app.post(
    '/roadmaps',
    { ...auth, schema: { body: createRoadmapSchema } },
    roadmapController.createRoadmap,
  );

  // PUT /roadmaps/:id —— 更新路线图
  app.put(
    '/roadmaps/:id',
    { ...auth, schema: { params: idParamsSchema, body: updateRoadmapSchema } },
    roadmapController.updateRoadmap,
  );

  // DELETE /roadmaps/:id —— 删除路线图
  app.delete(
    '/roadmaps/:id',
    { ...auth, schema: { params: idParamsSchema } },
    roadmapController.deleteRoadmap,
  );
};
