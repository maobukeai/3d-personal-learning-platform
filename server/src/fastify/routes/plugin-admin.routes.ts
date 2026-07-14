import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as adminPluginController from '../../controllers/admin/plugin.admin.controller';
import { adminPluginUpdateSchema, adminPluginBatchUpdateSchema } from '../../utils/schemas';
import { fastifyAuthenticate, fastifyRequireAdmin } from '../auth/fastify-auth';
import { fastifyUpload } from '../middlewares/fastify-upload.middleware';
import prisma from '../../services/prisma';
import { logger } from '../../utils/logger';
import type { UploadedFile } from '../../types/upload';

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

  // POST /admin/plugins —— 创建插件 (Admin context)
  app.post(
    '/admin/plugins',
    {
      preHandler: [
        fastifyAuthenticate,
        fastifyRequireAdmin,
        fastifyUpload([
          { name: 'plugin_file', maxCount: 1 },
          { name: 'plugin_preview', maxCount: 1 },
        ]),
      ],
    },
    async (request, reply) => {
      try {
        const body = request.body as Record<string, unknown>;
        const adminUserId = (request as any).userId as string;

        let authorUserId = adminUserId;
        if (body.userId && typeof body.userId === 'string' && body.userId.trim()) {
          const userExists = await prisma.user.findUnique({ where: { id: body.userId } });
          if (userExists) authorUserId = body.userId;
        }

        const title = (body.title as string | undefined)?.trim() || 'Untitled Plugin';
        const category = (body.category as string | undefined)?.trim() || 'Other';
        const version = (body.version as string | undefined)?.trim() || '1.0.0';
        const compatibility = (body.compatibility as string | undefined)?.trim() || '';

        const files = (request as unknown as { files?: Record<string, UploadedFile[]> }).files;
        const pluginFile = files?.plugin_file?.[0];
        const previewFile = files?.plugin_preview?.[0];
        const externalUrl = body.externalUrl as string | undefined;

        let fileUrl = externalUrl || '';
        let fileSize = 0;

        if (pluginFile) {
          fileUrl = pluginFile.url || '';
          fileSize = parseFloat((pluginFile.size / (1024 * 1024)).toFixed(2));
        }

        let previewUrl = null;
        if (previewFile) {
          previewUrl = previewFile.url || '';
        } else if (body.externalThumbnailUrl && typeof body.externalThumbnailUrl === 'string') {
          previewUrl = body.externalThumbnailUrl;
        }

        let parsedTags = null;
        if (body.tags && typeof body.tags === 'string') {
          const tagsArr = body.tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean);
          parsedTags = tagsArr.length > 0 ? JSON.stringify(tagsArr) : null;
        }

        const status = (body.status as string) === 'PENDING' ? 'PENDING' : 'APPROVED';

        const plugin = await prisma.plugin.create({
          data: {
            title,
            description: body.description as string | undefined,
            category,
            version,
            compatibility,
            tags: parsedTags,
            fileUrl,
            fileSize,
            previewUrl,
            installGuide: body.installGuide as string | undefined,
            userId: authorUserId,
            status,
            originality: (body.originality as string) || 'ORIGINAL',
            originalAuthor: body.originalAuthor as string | undefined,
            originalLink: body.originalLink as string | undefined,
            license: (body.license as string) || 'CC_BY',
            isFree: body.isFree !== undefined ? String(body.isFree) === 'true' : true,
          },
        });

        // Create initial version record
        await prisma.pluginVersion.create({
          data: {
            pluginId: plugin.id,
            version: plugin.version,
            changelog: '初始发布版本',
            fileUrl: plugin.fileUrl,
            fileSize: plugin.fileSize,
          },
        });

        // Add audit logs
        const { auditService } = await import('../../services/audit.service');
        await auditService.log({
          userId: adminUserId,
          action: 'CREATE_PLUGIN',
          module: 'PLUGIN',
          description: `Admin created plugin on behalf of ${authorUserId}: ${plugin.title}`,
          newValue: plugin,
          req: request as any,
        });

        reply.send(plugin);
      } catch (error) {
        logger.error('[Fastify admin] createPlugin error:', error);
        throw error;
      }
    },
  );
};
