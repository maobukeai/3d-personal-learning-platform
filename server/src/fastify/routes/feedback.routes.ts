import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as feedbackController from '../../controllers/feedback.controller';
import { submitFeedbackSchema, updateFeedbackStatusSchema } from '../../utils/schemas';
import { fastifyAuthenticate } from '../auth/fastify-auth';
import { fastifyUpload } from '../middlewares/fastify-upload.middleware';

/**
 * Fastify 反馈路由（原生 Fastify handler）。
 *
 * 挂载前缀: /api/fastify/feedback
 *  - POST /              提交反馈（鉴权）
 *  - GET  /stats         我的反馈统计（鉴权）
 *  - GET  /my            我的反馈列表（鉴权）
 *  - GET  /:id           反馈详情（鉴权）
 *  - PUT  /:id/status   更新反馈状态（鉴权）
 *
 * 路由级限流：10/min（对齐 Express feedbackLimiter）
 */

const idParamsSchema = z.object({
  id: z.string().min(1, 'Feedback id is required'),
});

const feedbackQuerySchema = z
  .object({
    q: z.string().optional(),
    status: z.string().optional(),
    priority: z.string().optional(),
    type: z.string().optional(),
    limit: z.union([z.number(), z.string()]).optional(),
  })
  .partial();

export const registerFeedbackRoutes = (app: FastifyInstance): void => {
  const auth = {
    preHandler: [fastifyAuthenticate],
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  };

  // POST /feedback —— 提交反馈
  app.post(
    '/feedback',
    {
      ...auth,
      schema: { body: submitFeedbackSchema },
    },
    feedbackController.submitFeedback,
  );

  // GET /feedback/stats —— 我的反馈统计
  app.get('/feedback/stats', { ...auth }, feedbackController.getMyFeedbackStats);

  // GET /feedback/my —— 我的反馈列表
  app.get(
    '/feedback/my',
    {
      ...auth,
      schema: { querystring: feedbackQuerySchema },
    },
    feedbackController.getMyFeedback,
  );

  // GET /feedback/:id —— 反馈详情
  app.get(
    '/feedback/:id',
    {
      ...auth,
      schema: { params: idParamsSchema },
    },
    feedbackController.getMyFeedbackDetail,
  );

  // PUT /feedback/:id/status —— 更新反馈状态
  app.put(
    '/feedback/:id/status',
    {
      ...auth,
      schema: { params: idParamsSchema, body: updateFeedbackStatusSchema },
    },
    feedbackController.updateMyFeedbackStatus,
  );

  // POST /feedback/upload —— 上传反馈附件
  app.post(
    '/feedback/upload',
    {
      preHandler: [fastifyAuthenticate, fastifyUpload([{ name: 'file', maxCount: 1 }])],
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    feedbackController.uploadAttachment,
  );
};
