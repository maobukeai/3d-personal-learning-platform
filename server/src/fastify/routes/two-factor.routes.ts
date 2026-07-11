import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { TwoFactorController } from '../../controllers/two-factor.controller';
import {
  twoFactorCreateAccountSchema,
  twoFactorImportAccountsSchema,
  twoFactorUpdateAccountSchema,
} from '../../utils/schemas-batch3';
import { fastifyAuthenticate } from '../auth/fastify-auth';

/**
 * Fastify 两步验证账号路由（原生 Fastify handler）。
 *
 * 挂载前缀: /api/fastify/two-factor
 *  全部端点需鉴权（对齐 Express authenticate + twoFactorLimiter）。
 *
 * 端点：
 *  - GET    /accounts             列出 2FA 账号
 *  - POST   /accounts             创建 2FA 账号
 *  - POST   /accounts/import      批量导入 2FA 账号
 *  - PUT    /accounts/:id          更新 2FA 账号
 *  - DELETE /accounts/:id          删除 2FA 账号
 *
 * 路由级限流：5/min（对齐 Express twoFactorLimiter）
 */

const idParamsSchema = z.object({
  id: z.string().min(1, 'Account id is required'),
});

export const registerTwoFactorRoutes = (app: FastifyInstance): void => {
  const auth = {
    preHandler: [fastifyAuthenticate],
    // Express twoFactorLimiter: 5 / minute
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  };

  // GET /two-factor/accounts —— 列出 2FA 账号
  app.get('/two-factor/accounts', { ...auth }, TwoFactorController.getAccounts);

  // POST /two-factor/accounts —— 创建 2FA 账号
  app.post(
    '/two-factor/accounts',
    { ...auth, schema: { body: twoFactorCreateAccountSchema } },
    TwoFactorController.createAccount,
  );

  // POST /two-factor/accounts/import —— 批量导入 2FA 账号
  app.post(
    '/two-factor/accounts/import',
    { ...auth, schema: { body: twoFactorImportAccountsSchema } },
    TwoFactorController.importAccounts,
  );

  // PUT /two-factor/accounts/:id —— 更新 2FA 账号
  app.put(
    '/two-factor/accounts/:id',
    { ...auth, schema: { params: idParamsSchema, body: twoFactorUpdateAccountSchema } },
    TwoFactorController.updateAccount,
  );

  // DELETE /two-factor/accounts/:id —— 删除 2FA 账号
  app.delete(
    '/two-factor/accounts/:id',
    { ...auth, schema: { params: idParamsSchema } },
    TwoFactorController.deleteAccount,
  );
};
