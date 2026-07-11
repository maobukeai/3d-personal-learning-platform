import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as adminPluginController from '../../controllers/admin/plugin.admin.controller';
import { adminPluginUpdateSchema, adminPluginBatchUpdateSchema } from '../../utils/schemas';
import { fastifyAuthenticate, fastifyRequireAdmin } from '../auth/fastify-auth';

/**
 * Fastify 插件管理路由（原生 Fastify handler，原生 handler，直接传递 controller 函数）。
 *
 * 挂载前缀: /api/fastify/admin/plugins
 *  全部端点需鉴权 + ADMIN 角色（对齐 Express authenticate + isAdmin）。
 *
 * 路由级限流：30/min（对齐 Express pluginAdminLimiter）
 */

const idParamsSchema = z.object({
  id: z.string().min(1, 'Plugin id is required'),
});

const listQuerySchema = z
  .object({
    status: z.string().optional(),
    search: z.string().optional(),
    page: z.union([z.number(), z.string()]).optional(),
    limit: z.union([z.number(), z.string()]).optional(),
    pageSize: z.union([z.number(), z.string()]).optional(),
    response: z.string().optional(),
  })
  .partial();

export const registerPluginAdminRoutes = (app: FastifyInstance): void => {
  const auth = {
    preHandler: [fastifyAuthenticate, fastifyRequireAdmin],
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  };

  // GET /admin/plugins —— 列出插件（管理端）
  app.get(
    '/admin/plugins',
    { ...auth, schema: { querystring: listQuerySchema } },
    adminPluginController.adminListPlugins,
  );

  // PUT /admin/plugins/batch-status —— 批量更新状态
  app.put(
    '/admin/plugins/batch-status',
    { ...auth, schema: { body: adminPluginBatchUpdateSchema } },
    adminPluginController.adminBatchUpdatePlugins,
  );

  // PUT /admin/plugins/:id/status —— 更新插件状态
  app.put(
    '/admin/plugins/:id/status',
    {
      ...auth,
      schema: { params: idParamsSchema, body: adminPluginUpdateSchema },
    },
    adminPluginController.adminUpdatePlugin,
  );

  // PUT /admin/plugins/:id —— 更新插件
  app.put(
    '/admin/plugins/:id',
    { ...auth, schema: { params: idParamsSchema, body: adminPluginUpdateSchema } },
    adminPluginController.adminUpdatePlugin,
  );

  // DELETE /admin/plugins/:id —— 删除插件
  app.delete(
    '/admin/plugins/:id',
    { ...auth, schema: { params: idParamsSchema } },
    adminPluginController.adminDeletePlugin,
  );
};
