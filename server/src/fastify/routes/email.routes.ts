import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { EmailController } from '../../controllers/email.controller';
import {
  emailImportAccountsSchema,
  emailUpdateAccountSchema,
  emailMarkMessageReadSchema,
  emailSendSchema,
} from '../../utils/schemas-batch2';
import { fastifyAuthenticate } from '../auth/fastify-auth';

/**
 * Fastify 邮箱路由（原生 Fastify handler）。
 *
 * 挂载前缀: /api/fastify/email
 *  全部端点需鉴权（对齐 Express authenticate + emailLimiter）。
 *
 * 端点：
 *  - POST   /accounts/import                批量导入邮箱账号
 *  - GET    /accounts                       列出邮箱账号
 *  - DELETE /accounts/:id                  删除邮箱账号
 *  - PUT    /accounts/:id                   更新邮箱账号
 *  - POST   /accounts/:id/test              测试邮箱账号连接
 *  - GET    /accounts/:id/folders           获取文件夹
 *  - GET    /accounts/:id/messages          获取邮件列表
 *  - PATCH  /accounts/:id/messages/:messageId  标记邮件已读
 *  - DELETE /accounts/:id/messages/:messageId  删除邮件
 *  - POST   /send                           安全发送邮件
 *
 * 路由级限流：5/min（对齐 Express emailLimiter）
 */

const idParamsSchema = z.object({
  id: z.string().min(1, 'Account id is required'),
});

const accountMessageParamsSchema = z.object({
  id: z.string().min(1, 'Account id is required'),
  messageId: z.string().min(1, 'Message id is required'),
});

export const registerEmailRoutes = (app: FastifyInstance): void => {
  const auth = {
    preHandler: [fastifyAuthenticate],
    // Express emailLimiter: 5 / minute
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  };

  // POST /email/accounts/import —— 批量导入邮箱账号
  app.post(
    '/email/accounts/import',
    { ...auth, schema: { body: emailImportAccountsSchema } },
    EmailController.importAccounts,
  );

  // GET /email/accounts —— 列出邮箱账号
  app.get('/email/accounts', { ...auth }, EmailController.getAccounts);

  // DELETE /email/accounts/:id —— 删除邮箱账号
  app.delete(
    '/email/accounts/:id',
    { ...auth, schema: { params: idParamsSchema } },
    EmailController.deleteAccount,
  );

  // PUT /email/accounts/:id —— 更新邮箱账号
  app.put(
    '/email/accounts/:id',
    { ...auth, schema: { params: idParamsSchema, body: emailUpdateAccountSchema } },
    EmailController.updateAccount,
  );

  // POST /email/accounts/:id/test —— 测试邮箱账号连接
  app.post(
    '/email/accounts/:id/test',
    { ...auth, schema: { params: idParamsSchema } },
    EmailController.testAccount,
  );

  // GET /email/accounts/:id/folders —— 获取文件夹
  app.get(
    '/email/accounts/:id/folders',
    { ...auth, schema: { params: idParamsSchema } },
    EmailController.getFolders,
  );

  // GET /email/accounts/:id/messages —— 获取邮件列表
  app.get(
    '/email/accounts/:id/messages',
    { ...auth, schema: { params: idParamsSchema } },
    EmailController.getMessages,
  );

  // PATCH /email/accounts/:id/messages/:messageId —— 标记邮件已读
  app.patch(
    '/email/accounts/:id/messages/:messageId',
    {
      ...auth,
      schema: { params: accountMessageParamsSchema, body: emailMarkMessageReadSchema },
    },
    EmailController.markMessageRead,
  );

  // DELETE /email/accounts/:id/messages/:messageId —— 删除邮件
  app.delete(
    '/email/accounts/:id/messages/:messageId',
    { ...auth, schema: { params: accountMessageParamsSchema } },
    EmailController.deleteMessage,
  );

  // POST /email/send —— 安全发送邮件
  app.post(
    '/email/send',
    { ...auth, schema: { body: emailSendSchema } },
    EmailController.sendEmail,
  );
};
