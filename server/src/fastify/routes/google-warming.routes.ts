import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { GoogleWarmingController } from '../../controllers/google-warming.controller';
import {
  googleWarmingImportSchema,
  googleWarmingAiParseSchema,
  googleWarmingBatchIdsSchema,
  googleWarmingBatchStatusSchema,
  googleWarmingBatchCategorySchema,
  googleWarmingRenameCategorySchema,
  googleWarmingDeleteCategorySchema,
  googleWarmingAddCategorySchema,
  googleWarmingUpdateAccountSchema,
} from '../../utils/schemas-batch2';
import { fastifyAuthenticate } from '../auth/fastify-auth';

/**
 * Fastify Google 养号路由（原生 Fastify handler）。
 *
 * 挂载前缀: /api/fastify/google-warming
 *  全部端点需鉴权 + 用户私有数据（已通过 controller 内 where: { userId } 隔离）。
 *
 * 路由级限流：30/min（对齐 Express googleWarmingLimiter）
 */

const idParamsSchema = z.object({
  id: z.string().min(1, 'Account id is required'),
});

export const registerGoogleWarmingRoutes = (app: FastifyInstance): void => {
  const auth = {
    preHandler: [fastifyAuthenticate],
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  };

  // GET /google-warming/accounts —— 获取账号列表
  app.get('/google-warming/accounts', { ...auth }, GoogleWarmingController.getAccounts);

  // POST /google-warming/accounts/import —— 批量导入
  app.post(
    '/google-warming/accounts/import',
    { ...auth, schema: { body: googleWarmingImportSchema } },
    GoogleWarmingController.importAccounts,
  );

  // POST /google-warming/accounts/ai-parse —— AI 解析文本
  app.post(
    '/google-warming/accounts/ai-parse',
    { ...auth, schema: { body: googleWarmingAiParseSchema } },
    GoogleWarmingController.aiParse,
  );

  // POST /google-warming/accounts/batch-warm —— 批量养号
  app.post(
    '/google-warming/accounts/batch-warm',
    { ...auth, schema: { body: googleWarmingBatchIdsSchema } },
    GoogleWarmingController.batchWarmAccounts,
  );

  // POST /google-warming/accounts/batch-delete —— 批量删除
  app.post(
    '/google-warming/accounts/batch-delete',
    { ...auth, schema: { body: googleWarmingBatchIdsSchema } },
    GoogleWarmingController.batchDeleteAccounts,
  );

  // POST /google-warming/accounts/batch-status —— 批量更新状态
  app.post(
    '/google-warming/accounts/batch-status',
    { ...auth, schema: { body: googleWarmingBatchStatusSchema } },
    GoogleWarmingController.batchStatusAccounts,
  );

  // POST /google-warming/accounts/batch-category —— 批量更新分类
  app.post(
    '/google-warming/accounts/batch-category',
    { ...auth, schema: { body: googleWarmingBatchCategorySchema } },
    GoogleWarmingController.batchCategoryAccounts,
  );

  // POST /google-warming/accounts/category/rename —— 重命名分类
  app.post(
    '/google-warming/accounts/category/rename',
    { ...auth, schema: { body: googleWarmingRenameCategorySchema } },
    GoogleWarmingController.renameCategory,
  );

  // POST /google-warming/accounts/category/delete —— 删除分类
  app.post(
    '/google-warming/accounts/category/delete',
    { ...auth, schema: { body: googleWarmingDeleteCategorySchema } },
    GoogleWarmingController.deleteCategory,
  );

  // GET /google-warming/accounts/categories —— 获取分类列表
  app.get(
    '/google-warming/accounts/categories',
    { ...auth },
    GoogleWarmingController.getCategories,
  );

  // POST /google-warming/accounts/categories/add —— 新增分类
  app.post(
    '/google-warming/accounts/categories/add',
    { ...auth, schema: { body: googleWarmingAddCategorySchema } },
    GoogleWarmingController.addCategory,
  );

  // PUT /google-warming/accounts/:id —— 更新账号
  app.put(
    '/google-warming/accounts/:id',
    { ...auth, schema: { params: idParamsSchema, body: googleWarmingUpdateAccountSchema } },
    GoogleWarmingController.updateAccount,
  );

  // POST /google-warming/accounts/:id/warm —— 单个养号打卡
  app.post(
    '/google-warming/accounts/:id/warm',
    { ...auth, schema: { params: idParamsSchema } },
    GoogleWarmingController.warmAccount,
  );

  // DELETE /google-warming/accounts/:id —— 删除账号
  app.delete(
    '/google-warming/accounts/:id',
    { ...auth, schema: { params: idParamsSchema } },
    GoogleWarmingController.deleteAccount,
  );
};
