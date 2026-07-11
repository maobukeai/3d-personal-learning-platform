import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as backupController from '../../controllers/backup.controller';
import {
  backupConfigSchema,
  backupTestConfigSchema,
  backupRunSchema,
  backupRestoreSchema,
} from '../../utils/schemas-batch2';
import { fastifyAuthenticate } from '../auth/fastify-auth';

/**
 * Fastify 备份路由（原生 Fastify handler）。
 *
 * 挂载前缀: /api/fastify/backup
 *  - GET    /config          获取 WebDAV 配置（鉴权）
 *  - POST   /config          保存 WebDAV 配置（鉴权）
 *  - POST   /test            测试 WebDAV 连接（鉴权）
 *  - POST   /run             执行备份（鉴权，内存 PassThrough ZIP 生成）
 *  - GET    /list            列出备份（鉴权）
 *  - POST   /restore         恢复备份（鉴权）
 *  - DELETE /:filename       删除备份（鉴权）
 *
 * backup.controller.runBackup 使用 archiver + PassThrough 在内存中生成 ZIP，
 * 已是非阻塞的流式实现；Fastify handler 为 async，无需额外处理。
 *
 * 路由级限流：3/hour（对齐 Express backupLimiter）
 */

const filenameParamsSchema = z.object({
  filename: z.string().min(1, 'Filename is required'),
});

export const registerBackupRoutes = (app: FastifyInstance): void => {
  const auth = {
    preHandler: [fastifyAuthenticate],
    // Express backupLimiter: 3 / hour
    config: { rateLimit: { max: 3, timeWindow: '1 hour' } },
  };

  // GET /backup/config —— 获取 WebDAV 配置
  app.get('/backup/config', { ...auth }, backupController.getBackupConfig);

  // POST /backup/config —— 保存 WebDAV 配置
  app.post(
    '/backup/config',
    { ...auth, schema: { body: backupConfigSchema } },
    backupController.saveBackupConfig,
  );

  // POST /backup/test —— 测试 WebDAV 连接
  app.post(
    '/backup/test',
    { ...auth, schema: { body: backupTestConfigSchema } },
    backupController.testBackupConfig,
  );

  // POST /backup/run —— 执行备份（内存 ZIP 生成）
  app.post(
    '/backup/run',
    { ...auth, schema: { body: backupRunSchema } },
    backupController.runBackup,
  );

  // GET /backup/list —— 列出备份
  app.get('/backup/list', { ...auth }, backupController.listBackups);

  // POST /backup/restore —— 恢复备份
  app.post(
    '/backup/restore',
    { ...auth, schema: { body: backupRestoreSchema } },
    backupController.restoreBackup,
  );

  // DELETE /backup/:filename —— 删除备份
  app.delete(
    '/backup/:filename',
    { ...auth, schema: { params: filenameParamsSchema } },
    backupController.deleteBackup,
  );
};
