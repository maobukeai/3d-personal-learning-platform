import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as adminMirrorController from '../../mirror/controllers/admin-mirror.controller';
import { fastifyAuthenticate, fastifyRequireAdmin } from '../auth/fastify-auth';
import { fastifyUpload } from '../middlewares/fastify-upload.middleware';

/**
 * Fastify 管理端镜像源路由（原生 Fastify handler，已移除 adaptHandler 桥接）。
 *
 * 挂载前缀: /api/admin/mirror
 *  全部端点需鉴权 + ADMIN 角色（对齐 Express authenticate + isAdmin）。
 *
 * 端点（27 个）：
 *  - POST   /upload                                上传图片（mirror_image）
 *  - GET    /cloud-discover                         扫描云端镜像源
 *  - POST   /cloud-connect                          连接云端镜像源
 *  - GET    /sources                                列出镜像源
 *  - GET    /sources/:id/export                     流式导出 ZIP（hijack + raw）
 *  - POST   /sources/import                         导入 ZIP（file）
 *  - GET    /import/status/:taskId                  导入任务状态
 *  - POST   /sources                                创建镜像源
 *  - GET    /sources/:id                            镜像源详情
 *  - PUT    /sources/:id                            更新镜像源
 *  - DELETE /sources/:id                            删除镜像源
 *  - POST   /sources/:id/sync                       触发同步
 *  - POST   /sources/:id/sync/cancel                取消同步
 *  - GET    /sources/:id/sync-status                同步状态
 *  - GET    /sources/:id/sync-logs                  同步日志
 *  - POST   /sources/:id/cleanup                    清理图片
 *  - POST   /sources/:id/match-links                匹配链接（file + files）
 *  - GET    /sources/:sourceId/categories           列出分类
 *  - POST   /sources/:sourceId/categories           创建分类
 *  - GET    /categories/:id                         分类详情
 *  - PUT    /categories/:id                         更新分类
 *  - DELETE /categories/:id                         删除分类
 *  - GET    /sources/:sourceId/resources            列出资源
 *  - POST   /sources/:sourceId/resources            创建资源
 *  - GET    /resources/:id                          资源详情
 *  - PUT    /resources/:id                          更新资源
 *  - DELETE /resources/:id                          删除资源
 */

const idParamsSchema = z.object({
  id: z.string().min(1, 'Id is required'),
});

const sourceIdParamsSchema = z.object({
  sourceId: z.string().min(1, 'Source id is required'),
});

const taskIdParamsSchema = z.object({
  taskId: z.string().min(1, 'Task id is required'),
});

export const registerAdminMirrorRoutes = (app: FastifyInstance): void => {
  const auth = {
    preHandler: [fastifyAuthenticate, fastifyRequireAdmin],
  };

  // Image Upload —— fastify-upload
  app.post(
    '/admin/mirror/upload',
    {
      preHandler: [
        fastifyAuthenticate,
        fastifyRequireAdmin,
        fastifyUpload([{ name: 'mirror_image', maxCount: 1 }]),
      ],
    },
    async (request, reply) => {
      return adminMirrorController.uploadImage(request, reply);
    },
  );

  // GET /admin/mirror/cloud-discover —— 扫描云端镜像源
  app.get('/admin/mirror/cloud-discover', { ...auth }, async (request, reply) => {
    return adminMirrorController.scanCloudSources(request, reply);
  });

  // POST /admin/mirror/cloud-connect —— 连接云端镜像源
  app.post('/admin/mirror/cloud-connect', { ...auth }, async (request, reply) => {
    return adminMirrorController.connectCloudSource(request, reply);
  });

  // GET /admin/mirror/sources —— 列出镜像源
  app.get('/admin/mirror/sources', { ...auth }, async (request, reply) => {
    return adminMirrorController.getAllSources(request, reply);
  });

  // GET /admin/mirror/sources/:id/export —— 流式导出 ZIP（controller 内部 hijack + raw）
  app.get(
    '/admin/mirror/sources/:id/export',
    { ...auth, schema: { params: idParamsSchema } },
    async (request, reply) => {
      return adminMirrorController.exportSource(request, reply);
    },
  );

  // POST /admin/mirror/sources/import —— 导入 ZIP（fastify-upload）
  app.post(
    '/admin/mirror/sources/import',
    {
      preHandler: [
        fastifyAuthenticate,
        fastifyRequireAdmin,
        fastifyUpload([{ name: 'file', maxCount: 1 }]),
      ],
    },
    async (request, reply) => {
      return adminMirrorController.importSource(request, reply);
    },
  );

  // GET /admin/mirror/import/status/:taskId —— 导入任务状态
  app.get(
    '/admin/mirror/import/status/:taskId',
    { ...auth, schema: { params: taskIdParamsSchema } },
    async (request, reply) => {
      return adminMirrorController.getImportStatus(request, reply);
    },
  );

  // POST /admin/mirror/sources —— 创建镜像源
  app.post('/admin/mirror/sources', { ...auth }, async (request, reply) => {
    return adminMirrorController.createSource(request, reply);
  });

  // GET /admin/mirror/sources/:id —— 镜像源详情
  app.get(
    '/admin/mirror/sources/:id',
    { ...auth, schema: { params: idParamsSchema } },
    async (request, reply) => {
      return adminMirrorController.getSourceDetail(request, reply);
    },
  );

  // PUT /admin/mirror/sources/:id —— 更新镜像源
  app.put(
    '/admin/mirror/sources/:id',
    { ...auth, schema: { params: idParamsSchema } },
    async (request, reply) => {
      return adminMirrorController.updateSource(request, reply);
    },
  );

  // DELETE /admin/mirror/sources/:id —— 删除镜像源
  app.delete(
    '/admin/mirror/sources/:id',
    { ...auth, schema: { params: idParamsSchema } },
    async (request, reply) => {
      return adminMirrorController.deleteSource(request, reply);
    },
  );

  // POST /admin/mirror/sources/:id/sync —— 触发同步
  app.post(
    '/admin/mirror/sources/:id/sync',
    { ...auth, schema: { params: idParamsSchema } },
    async (request, reply) => {
      return adminMirrorController.triggerSync(request, reply);
    },
  );

  // POST /admin/mirror/sources/:id/sync/cancel —— 取消同步
  app.post(
    '/admin/mirror/sources/:id/sync/cancel',
    { ...auth, schema: { params: idParamsSchema } },
    async (request, reply) => {
      return adminMirrorController.cancelSync(request, reply);
    },
  );

  // GET /admin/mirror/sources/:id/sync-status —— 同步状态
  app.get(
    '/admin/mirror/sources/:id/sync-status',
    { ...auth, schema: { params: idParamsSchema } },
    async (request, reply) => {
      return adminMirrorController.getSyncStatus(request, reply);
    },
  );

  // GET /admin/mirror/sources/:id/sync-logs —— 同步日志
  app.get(
    '/admin/mirror/sources/:id/sync-logs',
    { ...auth, schema: { params: idParamsSchema } },
    async (request, reply) => {
      return adminMirrorController.getSyncLogs(request, reply);
    },
  );

  // POST /admin/mirror/sources/:id/cleanup —— 清理图片
  app.post(
    '/admin/mirror/sources/:id/cleanup',
    { ...auth, schema: { params: idParamsSchema } },
    async (request, reply) => {
      return adminMirrorController.cleanupSourceImages(request, reply);
    },
  );

  // POST /admin/mirror/sources/:id/match-links —— 匹配链接（fastify-upload）
  app.post(
    '/admin/mirror/sources/:id/match-links',
    {
      preHandler: [
        fastifyAuthenticate,
        fastifyRequireAdmin,
        fastifyUpload([
          { name: 'file', maxCount: 1 },
          { name: 'files', maxCount: 100 },
        ]),
      ],
    },
    async (request, reply) => {
      return adminMirrorController.matchLinks(request, reply);
    },
  );

  // Category CRUD
  app.get(
    '/admin/mirror/sources/:sourceId/categories',
    { ...auth, schema: { params: sourceIdParamsSchema } },
    async (request, reply) => {
      return adminMirrorController.getSourceCategories(request, reply);
    },
  );

  app.post(
    '/admin/mirror/sources/:sourceId/categories',
    { ...auth, schema: { params: sourceIdParamsSchema } },
    async (request, reply) => {
      return adminMirrorController.createCategory(request, reply);
    },
  );

  app.get(
    '/admin/mirror/categories/:id',
    { ...auth, schema: { params: idParamsSchema } },
    async (request, reply) => {
      return adminMirrorController.getCategoryDetail(request, reply);
    },
  );

  app.put(
    '/admin/mirror/categories/:id',
    { ...auth, schema: { params: idParamsSchema } },
    async (request, reply) => {
      return adminMirrorController.updateCategory(request, reply);
    },
  );

  app.delete(
    '/admin/mirror/categories/:id',
    { ...auth, schema: { params: idParamsSchema } },
    async (request, reply) => {
      return adminMirrorController.deleteCategory(request, reply);
    },
  );

  // Resource CRUD
  app.get(
    '/admin/mirror/sources/:sourceId/resources',
    { ...auth, schema: { params: sourceIdParamsSchema } },
    async (request, reply) => {
      return adminMirrorController.getSourceResources(request, reply);
    },
  );

  app.post(
    '/admin/mirror/sources/:sourceId/resources',
    { ...auth, schema: { params: sourceIdParamsSchema } },
    async (request, reply) => {
      return adminMirrorController.createResource(request, reply);
    },
  );

  app.get(
    '/admin/mirror/resources/:id',
    { ...auth, schema: { params: idParamsSchema } },
    async (request, reply) => {
      return adminMirrorController.getResourceDetail(request, reply);
    },
  );

  app.put(
    '/admin/mirror/resources/:id',
    { ...auth, schema: { params: idParamsSchema } },
    async (request, reply) => {
      return adminMirrorController.updateResource(request, reply);
    },
  );

  app.delete(
    '/admin/mirror/resources/:id',
    { ...auth, schema: { params: idParamsSchema } },
    async (request, reply) => {
      return adminMirrorController.deleteResource(request, reply);
    },
  );
};
