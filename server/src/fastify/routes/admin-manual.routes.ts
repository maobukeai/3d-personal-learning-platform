import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as manualController from '../../manual/controllers/manual-station.controller';
import { fastifyAuthenticate, fastifyRequireAdmin } from '../auth/fastify-auth';
import { fastifyUpload } from '../middlewares/fastify-upload.middleware';

/**
 * Fastify 管理端手册站点路由（原生 Fastify handler，已移除 adaptHandler 桥接）。
 *
 * 挂载前缀: /api/admin/manual
 *  全部端点需鉴权 + ADMIN 角色（对齐 Express authenticate + isAdmin）。
 *
 * 端点：
 *  - POST   /stations                              创建站点
 *  - PUT    /stations/:id                          更新站点
 *  - DELETE /stations/:id                          删除站点
 *  - POST   /stations/:stationId/categories        创建分类
 *  - PUT    /categories/:catId                     更新分类
 *  - DELETE /categories/:catId                     删除分类
 *  - POST   /stations/:stationId/resources         创建资源
 *  - PUT    /resources/:resId                      更新资源
 *  - DELETE /resources/:resId                      删除资源
 *  - POST   /upload                                上传图片（fastify-upload，manual_image）
 */

const stationIdParamsSchema = z.object({
  stationId: z.string().min(1, 'Station id is required'),
});

const idParamsSchema = z.object({
  id: z.string().min(1, 'Id is required'),
});

const catIdParamsSchema = z.object({
  catId: z.string().min(1, 'Category id is required'),
});

const resIdParamsSchema = z.object({
  resId: z.string().min(1, 'Resource id is required'),
});

export const registerAdminManualRoutes = (app: FastifyInstance): void => {
  const auth = {
    preHandler: [fastifyAuthenticate, fastifyRequireAdmin],
  };

  // Stations
  app.post('/admin/manual/stations', { ...auth }, async (request, reply) => {
    return manualController.createStation(request, reply);
  });

  app.put(
    '/admin/manual/stations/:id',
    { ...auth, schema: { params: idParamsSchema } },
    async (request, reply) => {
      return manualController.updateStation(request, reply);
    },
  );

  app.delete(
    '/admin/manual/stations/:id',
    { ...auth, schema: { params: idParamsSchema } },
    async (request, reply) => {
      return manualController.deleteStation(request, reply);
    },
  );

  // Categories
  app.post(
    '/admin/manual/stations/:stationId/categories',
    { ...auth, schema: { params: stationIdParamsSchema } },
    async (request, reply) => {
      return manualController.createCategory(request, reply);
    },
  );

  app.put(
    '/admin/manual/categories/:catId',
    { ...auth, schema: { params: catIdParamsSchema } },
    async (request, reply) => {
      return manualController.updateCategory(request, reply);
    },
  );

  app.delete(
    '/admin/manual/categories/:catId',
    { ...auth, schema: { params: catIdParamsSchema } },
    async (request, reply) => {
      return manualController.deleteCategory(request, reply);
    },
  );

  // Resources
  app.post(
    '/admin/manual/stations/:stationId/resources',
    { ...auth, schema: { params: stationIdParamsSchema } },
    async (request, reply) => {
      return manualController.createResource(request, reply);
    },
  );

  app.put(
    '/admin/manual/resources/:resId',
    { ...auth, schema: { params: resIdParamsSchema } },
    async (request, reply) => {
      return manualController.updateResource(request, reply);
    },
  );

  app.delete(
    '/admin/manual/resources/:resId',
    { ...auth, schema: { params: resIdParamsSchema } },
    async (request, reply) => {
      return manualController.deleteResource(request, reply);
    },
  );

  // Upload —— 原 multer 端点已迁移到 fastify-upload
  app.post(
    '/admin/manual/upload',
    {
      preHandler: [
        fastifyAuthenticate,
        fastifyRequireAdmin,
        fastifyUpload([{ name: 'manual_image', maxCount: 1 }]),
      ],
    },
    async (request, reply) => {
      return manualController.uploadImage(request, reply);
    },
  );
};
