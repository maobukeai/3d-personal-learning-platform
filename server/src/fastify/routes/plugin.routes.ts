import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as pluginController from '../../controllers/plugin.controller';
import { fastifyAuthenticate, fastifyOptionalAuthenticate } from '../auth/fastify-auth';
import { fastifyUpload } from '../middlewares/fastify-upload.middleware';

/**
 * Fastify 插件路由（原生 Fastify handler）。
 *
 * 挂载前缀: /api
 *  公开端点: 分享、客户端更新检查、求助帖浏览
 *  optionalAuth: 浏览已批准插件（登录后可看自己的 PENDING）
 *  auth: 收藏、上传、编辑、删除、版本管理、求助帖写入
 *
 * 路由级限流：上传 30/min，下载 60/min（对齐 Express 限流器）
 */

const idParamsSchema = z.object({
  id: z.string().min(1, 'Id is required'),
});

const shareIdParamsSchema = z.object({
  shareId: z.string().min(1, 'Share id is required'),
});

const commentIdParamsSchema = z.object({
  commentId: z.string().min(1, 'Comment id is required'),
});

const categoryNameParamsSchema = z.object({
  categoryName: z.string().min(1, 'Category name is required'),
});

const idFeedbackIdParamsSchema = z.object({
  id: z.string().min(1, 'Id is required'),
  feedbackId: z.string().min(1, 'Feedback id is required'),
});

const idVersionIdParamsSchema = z.object({
  id: z.string().min(1, 'Id is required'),
  versionId: z.string().min(1, 'Version id is required'),
});

const createCategorySchema = z.object({
  category: z.string().min(1, '分类名称不能为空'),
});

const updateCategorySchema = z.object({
  oldCategory: z.string().min(1, '缺少必要参数'),
  newCategory: z.string().min(1, '缺少必要参数'),
});

const bulkDeleteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, '请提供要删除的插件 ID 列表'),
});

const bulkFavoriteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, 'No plugins selected'),
  category: z.string().optional(),
  favorite: z.boolean().optional(),
});

const createCommentSchema = z.object({
  content: z.string().min(1, 'Comment content cannot be empty'),
});

const createShareSchema = z.object({
  expireHours: z.number().optional().nullable(),
  expiresAt: z.string().optional().nullable(),
  customText: z.string().optional().nullable(),
});

const createRequestSchema = z.object({
  title: z.string().min(1, '标题和内容为必填项'),
  description: z.string().min(1, '标题和内容为必填项'),
});

const createRequestReplySchema = z.object({
  content: z.string().min(1, '回复内容不能为空'),
  linkedPluginId: z.string().optional().nullable(),
});

const feedbackSchema = z.object({
  token: z.string().optional(),
  clientVersion: z.string().optional(),
  feedbackType: z.string().optional(),
  content: z.string().min(1, 'content is required'),
});

export const registerPluginRoutes = (app: FastifyInstance): void => {
  const optionalAuth = { preHandler: [fastifyOptionalAuthenticate] };
  const auth = { preHandler: [fastifyAuthenticate] };

  const uploadFields = [
    { name: 'plugin_file', maxCount: 1 },
    { name: 'plugin_preview', maxCount: 1 },
  ];
  const uploadSingleField = [{ name: 'plugin_file', maxCount: 1 }];

  const uploadAuth = {
    preHandler: [fastifyAuthenticate, fastifyUpload(uploadFields)],
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  };
  const uploadVersionAuth = {
    preHandler: [fastifyAuthenticate, fastifyUpload(uploadSingleField)],
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  };
  const downloadAuth = {
    preHandler: [fastifyAuthenticate],
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
  };

  // Public / Share routes
  app.get(
    '/plugins/share/:shareId',
    { schema: { params: shareIdParamsSchema } },
    pluginController.getPublicSharedPlugin,
  );
  app.get('/plugins/client/check-update', pluginController.checkPluginUpdate);
  app.post(
    '/plugins/client/feedback',
    { schema: { body: feedbackSchema } },
    pluginController.createPluginFeedback,
  );
  app.get('/plugins/requests', pluginController.listPluginRequests);
  app.get(
    '/plugins/requests/:id',
    { schema: { params: idParamsSchema } },
    pluginController.getPluginRequestById,
  );

  // Public browse
  app.get('/plugins', { ...optionalAuth }, pluginController.listPlugins);
  app.get('/plugins/insights', { ...optionalAuth }, pluginController.getPluginInsights);
  app.get(
    '/plugins/:id',
    { ...optionalAuth, schema: { params: idParamsSchema } },
    pluginController.getPluginById,
  );
  app.get(
    '/plugins/:id/package-files',
    { ...optionalAuth, schema: { params: idParamsSchema } },
    pluginController.getPluginPackageFiles,
  );
  app.get(
    '/plugins/:id/comments',
    { ...optionalAuth, schema: { params: idParamsSchema } },
    pluginController.getPluginComments,
  );

  // Authenticated favorites & lists
  app.get('/plugins/favorites', { ...auth }, pluginController.getMyFavoritePlugins);
  app.post(
    '/plugins/favorites/categories',
    { ...auth, schema: { body: createCategorySchema } },
    pluginController.createPluginFavoriteCategory,
  );
  app.put(
    '/plugins/favorites/categories',
    { ...auth, schema: { body: updateCategorySchema } },
    pluginController.updatePluginFavoriteCategory,
  );
  app.delete(
    '/plugins/favorites/categories/:categoryName',
    { ...auth, schema: { params: categoryNameParamsSchema } },
    pluginController.deletePluginFavoriteCategory,
  );
  app.get('/plugins/my', { ...auth }, pluginController.getMyPlugins);

  // Authenticated write/uploads
  app.post('/plugins/upload', { ...uploadAuth }, pluginController.uploadPlugin);
  app.put(
    '/plugins/:id',
    { ...uploadAuth, schema: { params: idParamsSchema } },
    pluginController.updatePlugin,
  );
  app.delete(
    '/plugins/:id',
    { ...auth, schema: { params: idParamsSchema } },
    pluginController.deletePlugin,
  );
  app.post(
    '/plugins/bulk-delete',
    { ...auth, schema: { body: bulkDeleteSchema } },
    pluginController.bulkDeletePlugins,
  );
  app.post(
    '/plugins/bulk/favorite',
    { ...auth, schema: { body: bulkFavoriteSchema } },
    pluginController.bulkFavoritePlugins,
  );
  app.post(
    '/plugins/:id/download',
    { ...downloadAuth, schema: { params: idParamsSchema } },
    pluginController.downloadPlugin,
  );
  app.post(
    '/plugins/:id/favorite',
    { ...auth, schema: { params: idParamsSchema } },
    pluginController.togglePluginFavorite,
  );

  // Comments (Authenticated write)
  app.post(
    '/plugins/:id/comments',
    { ...auth, schema: { params: idParamsSchema, body: createCommentSchema } },
    pluginController.createPluginComment,
  );
  app.delete(
    '/plugins/comments/:commentId',
    { ...auth, schema: { params: commentIdParamsSchema } },
    pluginController.deletePluginComment,
  );

  // Share Management
  app.get(
    '/plugins/:id/share',
    { ...auth, schema: { params: idParamsSchema } },
    pluginController.getPluginShare,
  );
  app.post(
    '/plugins/:id/share',
    { ...auth, schema: { params: idParamsSchema, body: createShareSchema } },
    pluginController.createOrUpdatePluginShare,
  );
  app.delete(
    '/plugins/:id/share',
    { ...auth, schema: { params: idParamsSchema } },
    pluginController.cancelPluginShare,
  );

  // Developer token & feedback clear
  app.post(
    '/plugins/:id/token',
    { ...auth, schema: { params: idParamsSchema } },
    pluginController.generateDeveloperToken,
  );
  app.get(
    '/plugins/:id/feedbacks',
    { ...auth, schema: { params: idParamsSchema } },
    pluginController.listPluginFeedbacks,
  );
  app.delete(
    '/plugins/:id/feedbacks',
    { ...auth, schema: { params: idParamsSchema } },
    pluginController.clearPluginFeedbacks,
  );
  app.delete(
    '/plugins/:id/feedbacks/:feedbackId',
    { ...auth, schema: { params: idFeedbackIdParamsSchema } },
    pluginController.deletePluginFeedback,
  );

  // Version Control
  app.post(
    '/plugins/:id/versions',
    { ...uploadVersionAuth, schema: { params: idParamsSchema } },
    pluginController.uploadPluginVersion,
  );
  app.get(
    '/plugins/:id/versions',
    { ...auth, schema: { params: idParamsSchema } },
    pluginController.listPluginVersions,
  );
  app.put(
    '/plugins/:id/versions/:versionId',
    { ...auth, schema: { params: idVersionIdParamsSchema } },
    pluginController.updatePluginVersion,
  );
  app.delete(
    '/plugins/:id/versions/:versionId',
    { ...auth, schema: { params: idVersionIdParamsSchema } },
    pluginController.deletePluginVersion,
  );
  app.post(
    '/plugins/:id/versions/:versionId/set-active',
    { ...auth, schema: { params: idVersionIdParamsSchema } },
    pluginController.setActivePluginVersion,
  );

  // Help Requests (Authenticated write)
  app.post(
    '/plugins/requests',
    { ...auth, schema: { body: createRequestSchema } },
    pluginController.createPluginRequest,
  );
  app.post(
    '/plugins/requests/:id/replies',
    { ...auth, schema: { params: idParamsSchema, body: createRequestReplySchema } },
    pluginController.createPluginRequestReply,
  );
  app.post(
    '/plugins/requests/:id/resolve',
    { ...auth, schema: { params: idParamsSchema } },
    pluginController.resolvePluginRequest,
  );
};
