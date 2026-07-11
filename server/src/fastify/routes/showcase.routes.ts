import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  fastifyAuthenticate,
  fastifyOptionalAuthenticate,
  fastifyResolveWorkspace,
} from '../auth/fastify-auth';
import { fastifyUpload } from '../middlewares/fastify-upload.middleware';
import * as showcaseController from '../../controllers/showcase.controller';
import { addShowcaseCommentSchema, publishAssetToShowcaseSchema } from '../../utils/schemas-batch1';

/**
 * Fastify 展示厅路由（原生 Fastify handler，原生 handler，直接传递 controller 函数）。
 *
 * showcase.controller.ts 已重写为原生 Fastify handler，路由直接传递 controller 函数。
 *
 * 挂载前缀: /api/fastify/showcase
 *
 * 路由级限流：/showcase/:id/comment 对齐 Express commentLimiter (10/min)。
 */

const authWithWorkspace = [fastifyAuthenticate, fastifyResolveWorkspace];
const optionalAuthWithWorkspace = [fastifyOptionalAuthenticate, fastifyResolveWorkspace];

// --- Params schemas ---

const idParamsSchema = z.object({
  id: z.string().min(1),
});

const commentParamsSchema = z.object({
  id: z.string().min(1),
  commentId: z.string().min(1),
});

// commentLimiter: 10/min（对齐 Express share-rate-limit）
const COMMENT_RATE_LIMIT = { max: 10, timeWindow: '1 minute' };

export const registerShowcaseRoutes = (app: FastifyInstance): void => {
  // ── 公开读（可选鉴权，游客可浏览 APPROVED + public 展示）────────────

  app.get(
    '/showcase',
    { preHandler: optionalAuthWithWorkspace },
    showcaseController.getAllShowcases,
  );

  app.get(
    '/showcase/stats',
    { preHandler: optionalAuthWithWorkspace },
    showcaseController.getShowcaseStats,
  );

  app.get(
    '/showcase/:id/related',
    {
      preHandler: optionalAuthWithWorkspace,
      schema: { params: idParamsSchema },
    },
    showcaseController.getRelatedShowcases,
  );

  app.get(
    '/showcase/:id',
    {
      preHandler: optionalAuthWithWorkspace,
      schema: { params: idParamsSchema },
    },
    showcaseController.getShowcaseById,
  );

  app.get(
    '/showcase/:id/comments',
    {
      preHandler: optionalAuthWithWorkspace,
      schema: { params: idParamsSchema },
    },
    showcaseController.getComments,
  );

  // ── 鉴权写 ──────────────────────────────────────────────────────────

  app.get('/showcase/my', { preHandler: authWithWorkspace }, showcaseController.getMyShowcases);

  app.post(
    '/showcase/publish-asset',
    {
      preHandler: authWithWorkspace,
      schema: { body: publishAssetToShowcaseSchema },
    },
    showcaseController.publishAssetToShowcase,
  );

  app.delete(
    '/showcase/:id',
    {
      preHandler: authWithWorkspace,
      schema: { params: idParamsSchema },
    },
    showcaseController.deleteShowcase,
  );

  app.post(
    '/showcase/:id/like',
    {
      preHandler: authWithWorkspace,
      schema: { params: idParamsSchema },
    },
    showcaseController.toggleLike,
  );

  app.post(
    '/showcase/:id/comment',
    {
      preHandler: authWithWorkspace,
      schema: { params: idParamsSchema, body: addShowcaseCommentSchema },
      config: { rateLimit: COMMENT_RATE_LIMIT },
    },
    showcaseController.addComment,
  );

  app.delete(
    '/showcase/:id/comment/:commentId',
    {
      preHandler: authWithWorkspace,
      schema: { params: commentParamsSchema },
    },
    showcaseController.deleteComment,
  );

  // POST /showcase —— 创建 showcase（fastify-upload 多文件上传）
  app.post(
    '/showcase',
    {
      preHandler: [
        fastifyAuthenticate,
        fastifyResolveWorkspace,
        fastifyUpload([
          { name: 'thumbnail', maxCount: 1 },
          { name: 'images', maxCount: 10 },
        ]),
      ],
    },
    showcaseController.createShowcase,
  );

  // PUT /showcase/:id —— 更新 showcase（fastify-upload 多文件上传）
  app.put(
    '/showcase/:id',
    {
      preHandler: [
        fastifyAuthenticate,
        fastifyResolveWorkspace,
        fastifyUpload([
          { name: 'thumbnail', maxCount: 1 },
          { name: 'images', maxCount: 10 },
        ]),
      ],
      schema: { params: idParamsSchema },
    },
    showcaseController.updateShowcase,
  );
};
