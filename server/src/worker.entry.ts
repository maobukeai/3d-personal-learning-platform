/**
 * 独立 Worker 进程入口（铁律六·2）。
 *
 * 该进程不创建 Express HTTP server，只负责：
 * - 启动 BullMQ Worker（initBullMQ）
 * - 注册并运行 DB 轮询 JobWorker（mirror-sync / image-optimization / image-downsampling / r2-storage-sync-*）
 * - 运行 mirror 同步调度器、清理任务、私信邮件调度器
 *
 * Worker 进程与 Express 主进程共享 prisma / redis 单例（各自 import）。
 * 通过 PM2 以 `npm run start:worker` 启动。
 */
import { logger } from './utils/logger';
import { config } from './config/env';
import { syncEngine } from './mirror/services/sync-engine.service';
import {
  startCleanupJob,
  stopCleanupJob,
  startMessageCleanupJob,
  stopMessageCleanupJob,
} from './services/cleanup.service';
import {
  startDirectMessageEmailScheduler,
  stopDirectMessageEmailScheduler,
} from './services/direct-message-email.service';
import { redisService } from './services/redis.service';
import prisma from './services/prisma';
import { storageService, decryptSecretIfNeeded } from './services/storage.service';
import { JobWorker } from './services/jobWorker';
import { closeBullMQ, initBullMQ } from './services/bullmq.service';
import type { AuditRequest } from './services/audit.service';

// 初始化 BullMQ Queue 和 Worker（concurrency: 5）
initBullMQ();

// 注册 DB 轮询 JobWorker handler（从 index.ts 迁移，保持内部逻辑不变）
JobWorker.registerHandler('3d-processing', async (payload) => {
  logger.info(`[JobWorker] Processing 3D asset ${payload.assetId}...`);
  return { success: true };
});

JobWorker.registerHandler('mirror-sync', async (payload, job) => {
  const { sourceId, type } = payload;
  logger.info(`[JobWorker] Starting mirror sync job ${job.id} for source ${sourceId} (${type})...`);

  // Periodically query sync progress and update Job progress in DB
  const interval = setInterval(async () => {
    try {
      const progressObj = syncEngine.getProgress(sourceId);
      if (progressObj) {
        const pct = progressObj.estimatedProgress ?? 0;
        await JobWorker.updateProgress(job.id, pct);
      }
    } catch (err) {
      logger.error(`[JobWorker] Error updating progress for job ${job.id}:`, err);
    }
  }, 2000);

  try {
    if (type === 'INCREMENTAL') {
      await syncEngine.incrementalSync(sourceId);
    } else {
      await syncEngine.fullSync(sourceId);
    }
    return { success: true };
  } finally {
    clearInterval(interval);
  }
});

JobWorker.registerHandler('image-optimization', async (payload) => {
  const { file } = payload;
  const { optimizeImage } = require('./utils/image');
  await optimizeImage(file);
  return { file };
});

JobWorker.registerHandler('image-downsampling', async (payload) => {
  // Legacy handler: upload middleware now calls downsampleImageBuffer inline.
  // Kept for backward compatibility with any in-flight jobs that carry a buffer payload.
  const { buffer, maxWidth, maxHeight } = payload;
  const { downsampleImage } = require('./services/bullmq.service');
  if (buffer) {
    await downsampleImage(Buffer.from(buffer), maxWidth, maxHeight);
  }
  return { success: true };
});

JobWorker.registerHandler('r2-storage-sync-single', async (payload) => {
  const { id, type, userId, ipAddress, userAgent } = payload;
  const raw = await prisma.storageConfig.findUnique({ where: { id } });
  if (!raw) throw new Error('配置未找到');

  const { buildDecryptedStorageConfig } = require('./utils/crypto');
  const { getSharedCloudflareApiTokens, storageService } = require('./services/storage.service');
  const { auditService, AuditModule } = require('./services/audit.service');

  const config = buildDecryptedStorageConfig(raw);
  const sharedApiTokens = await getSharedCloudflareApiTokens();
  const usage = await storageService.getBucketUsage(config, {
    sharedApiTokens,
    scan: type === 'scanned',
  });

  const bytesToSync =
    type === 'official' ? usage.dashboardBytes : (usage.scannedBytes ?? usage.dashboardBytes);

  await prisma.storageConfig.update({
    where: { id },
    data: { usedBytes: bytesToSync },
  });

  const mockReq = {
    ip: ipAddress,
    headers: {
      'user-agent': userAgent,
    },
    socket: {},
  } as AuditRequest;

  await auditService.log({
    req: mockReq,
    userId,
    module: AuditModule.SETTINGS,
    action: 'SYNC_STORAGE_SIZE',
    description: `Synchronized storage config ${raw.name} capacity to ${type === 'official' ? 'official' : 'scanned'} size: ${bytesToSync} bytes (${usage.source})`,
    newValue: { id, usedBytes: bytesToSync, source: usage.source, type },
  });

  return { success: true, usage };
});

JobWorker.registerHandler('r2-storage-sync-all', async (payload) => {
  const { userId, ipAddress, userAgent } = payload;
  const configs = await prisma.storageConfig.findMany({
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
  });

  const { buildDecryptedStorageConfig } = require('./utils/crypto');
  const {
    getSharedCloudflareApiTokens,
    resolveCloudflareApiToken,
    storageService,
  } = require('./services/storage.service');
  const { auditService, AuditModule } = require('./services/audit.service');

  const sharedApiTokens = await getSharedCloudflareApiTokens();
  const results: Array<Record<string, unknown>> = [];

  for (const raw of configs) {
    const config = buildDecryptedStorageConfig(raw);
    const apiToken = resolveCloudflareApiToken(config.cloudflareApiToken, sharedApiTokens);

    if (!apiToken) {
      results.push({
        id: raw.id,
        name: raw.name,
        bucketName: raw.bucketName,
        status: 'skipped',
        reason: '未配置 Cloudflare API Token',
      });
      continue;
    }

    try {
      const usage = await storageService.getOfficialBucketUsageOnly(config, { sharedApiTokens });
      if (!usage) {
        results.push({
          id: raw.id,
          name: raw.name,
          bucketName: raw.bucketName,
          status: 'skipped',
          reason: 'Cloudflare 官方 API 不可用（Token 无权限或 Account ID 不匹配）',
        });
        continue;
      }

      await prisma.storageConfig.update({
        where: { id: raw.id },
        data: { usedBytes: usage.dashboardBytes },
      });

      results.push({
        id: raw.id,
        name: raw.name,
        bucketName: raw.bucketName,
        status: 'synced',
        dashboardBytes: usage.dashboardBytes,
        source: usage.source,
      });
    } catch (error: unknown) {
      results.push({
        id: raw.id,
        name: raw.name,
        bucketName: raw.bucketName,
        status: 'failed',
        reason: error instanceof Error ? error.message : '同步失败',
      });
    }
  }

  const synced = results.filter((item) => item.status === 'synced').length;
  const skipped = results.filter((item) => item.status === 'skipped').length;
  const failed = results.filter((item) => item.status === 'failed').length;

  const mockReq = {
    ip: ipAddress,
    headers: {
      'user-agent': userAgent,
    },
    socket: {},
  } as AuditRequest;

  await auditService.log({
    req: mockReq,
    userId,
    module: AuditModule.SETTINGS,
    action: 'SYNC_ALL_STORAGE_SIZE',
    description: `Bulk synced R2 storage usage via Cloudflare API: synced=${synced}, skipped=${skipped}, failed=${failed}`,
    newValue: { synced, skipped, failed },
  });

  return { success: true, synced, skipped, failed, total: results.length, results };
});

// 启动 DB 轮询（如果 Redis 未启用，作为 DB 队列兜底）
if (!redisService.isRedisEnabled) {
  JobWorker.start(3000);
} else {
  logger.info('[Worker Entry] Redis is enabled. DB polling worker skipped (using BullMQ instead).');
}

// 启动 mirror 同步调度器、清理任务、私信邮件调度器
syncEngine.startScheduler();
startCleanupJob(); // Clean up expired data hourly
startMessageCleanupJob(); // Clean up message uploads every 3 days
startDirectMessageEmailScheduler();

logger.info(`[Worker Entry] Worker process started`);
logger.info(`Environment: ${config.NODE_ENV}`);

// 主动初始化一次存储桶 CORS（Worker 与主进程各自 import storageService 单例）
const initActiveBucketsCors = async () => {
  try {
    const activeConfigs = await prisma.storageConfig.findMany({
      where: { status: 'ACTIVE' },
    });
    if (activeConfigs.length > 0) {
      logger.info(
        `[Worker Entry] Found ${activeConfigs.length} active storage config(s). Configuring CORS...`,
      );
      for (const raw of activeConfigs) {
        const configData = {
          endpoint: raw.endpoint,
          accessKeyId: raw.accessKeyId ?? '',
          secretAccessKey: decryptSecretIfNeeded(raw.secretAccessKey),
          bucketName: raw.bucketName,
          publicUrl: raw.publicUrl,
        };
        await storageService.configureCors(configData).catch((err) => {
          logger.warn(
            `[Worker Entry] CORS configuration failed for bucket ${raw.bucketName}:`,
            err,
          );
        });
      }
    }
  } catch (err) {
    logger.error('[Worker Entry] Failed to initialize active buckets CORS:', err);
  }
};

initActiveBucketsCors().catch((err) => {
  logger.error('[Worker Entry] CORS initialization error:', err);
});

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`[Worker Entry] Received system signal: ${signal}. Initiating graceful shutdown...`);
  try {
    JobWorker.stop();
    syncEngine.stopScheduler();
    stopCleanupJob();
    stopMessageCleanupJob();
    stopDirectMessageEmailScheduler();
    await closeBullMQ();

    await prisma.$disconnect();
    logger.info('[Worker Entry] Prisma database client disconnected successfully.');
    process.exit(0);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[Worker Entry] Error occurred during graceful shutdown: ${msg}`);
    process.exit(1);
  }
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Catch unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('[Fatal] Unhandled Promise Rejection at:', promise, 'reason:', reason);
});

// Catch uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('[Fatal] Uncaught Exception:', err);
  process.exit(1);
});
