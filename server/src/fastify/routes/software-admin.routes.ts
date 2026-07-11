import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  adminListSoftwares,
  adminUpdateSoftware,
  adminBatchUpdateSoftwares,
  adminDeleteSoftware,
} from '../../controllers/admin/software.admin.controller';
import { fastifyAuthenticate, fastifyRequireAdmin } from '../auth/fastify-auth';

/**
 * Fastify 软件管理路由（原生 Fastify handler）。
 *
 * 挂载前缀: /api
 *  全部端点需鉴权 + ADMIN 角色（对齐 Express authenticate + isAdmin）。
 *
 * 路由级限流：30/min（对齐 Express softwareAdminLimiter）
 */

const idParamsSchema = z.object({
  id: z.string().min(1, 'Software id is required'),
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

const batchUpdateSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, '请选择要操作的软件'),
  status: z.enum(['APPROVED', 'REJECTED', 'PENDING']),
  rejectReason: z.string().optional().nullable(),
});

const updateSchema = z.object({
  title: z.string().max(100).optional(),
  description: z.string().optional().nullable(),
  category: z.string().optional(),
  version: z.string().optional(),
  compatibility: z.string().optional().nullable(),
  tags: z.string().optional().nullable(),
  installGuide: z.string().optional().nullable(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  rejectReason: z.string().optional().nullable(),
});

export const registerSoftwareAdminRoutes = (app: FastifyInstance): void => {
  const auth = {
    preHandler: [fastifyAuthenticate, fastifyRequireAdmin],
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  };

  // GET /admin/softwares —— 列出软件（管理端）
  app.get(
    '/admin/softwares',
    { ...auth, schema: { querystring: listQuerySchema } },
    adminListSoftwares,
  );

  // PUT /admin/softwares/batch-status —— 批量更新状态
  app.put(
    '/admin/softwares/batch-status',
    { ...auth, schema: { body: batchUpdateSchema } },
    adminBatchUpdateSoftwares,
  );

  // PUT /admin/softwares/:id/status —— 更新软件状态
  app.put(
    '/admin/softwares/:id/status',
    { ...auth, schema: { params: idParamsSchema, body: updateSchema } },
    adminUpdateSoftware,
  );

  // PUT /admin/softwares/:id —— 更新软件
  app.put(
    '/admin/softwares/:id',
    { ...auth, schema: { params: idParamsSchema, body: updateSchema } },
    adminUpdateSoftware,
  );

  // DELETE /admin/softwares/:id —— 删除软件
  app.delete(
    '/admin/softwares/:id',
    { ...auth, schema: { params: idParamsSchema } },
    adminDeleteSoftware,
  );
};
