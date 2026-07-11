/**
 * Fastify API 主进程入口。
 *
 * 注意（铁律六·2）：BullMQ Worker、DB 轮询 JobWorker handler、mirror 同步调度器、
 * 清理任务、私信邮件调度器等后台逻辑已全部移至 `worker.entry.ts` 独立进程运行。
 * 本文件只负责 Fastify HTTP server + Socket.io。
 */
import { logger } from './utils/logger';
import { runManualStationMigration } from './manual/services/migration.service';
import { settingsService } from './services/settings.service';
import { stopAiCleanupTimer } from './services/ai.service';
import './services/redis.service';
import prisma from './services/prisma';
import { storageService, decryptSecretIfNeeded } from './services/storage.service';
import { startFastify, fapp } from './fastify/app';
import { initSocket } from './services/socket.service';

const server = fapp.server;

initSocket(server);

// Configure CORS for all active buckets on startup to prevent cross-origin issues
const initActiveBucketsCors = async () => {
  try {
    const activeConfigs = await prisma.storageConfig.findMany({
      where: { status: 'ACTIVE' },
    });
    if (activeConfigs.length > 0) {
      logger.info(
        `[Startup] Found ${activeConfigs.length} active storage config(s). Configuring CORS...`,
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
          logger.warn(`[Startup] CORS configuration failed for bucket ${raw.bucketName}:`, err);
        });
      }
    }
  } catch (err) {
    logger.error('[Startup] Failed to initialize active buckets CORS:', err);
  }
};

initActiveBucketsCors().catch((err) => {
  logger.error('[Startup] CORS initialization error:', err);
});

// Run one-time settings data migrations (e.g. PLUGIN_CATEGORIES rename)
settingsService.runStartupMigrations().catch((err) => {
  logger.error('[Startup] Settings migration error:', err);
});

// Run legacy manual station migration asynchronously on startup
runManualStationMigration().catch((err) => {
  logger.error('[Startup] Migration error:', err);
});

// Start Fastify server (Fastify will listen on PORT, default 3001)
startFastify()
  .then(() => {
    logger.info('[Startup] Fastify server started successfully.');
    if (typeof process.send === 'function') {
      process.send('ready');
      logger.info('[Startup] Sent ready signal to PM2.');
    }
  })
  .catch((err) => {
    logger.error('[Startup] Failed to start Fastify server:', err);
    process.exit(1);
  });

const gracefulShutdown = async (signal: string) => {
  logger.info(`[Shutdown] Received system signal: ${signal}. Initiating graceful shutdown...`);
  try {
    stopAiCleanupTimer();

    // 关闭 Fastify 并停止接收新连接
    try {
      await fapp.close();
      logger.info('[Shutdown] Fastify server closed.');
    } catch (err) {
      logger.warn('[Shutdown] Fastify server close error:', err);
    }

    await prisma.$disconnect();
    logger.info('[Shutdown] Prisma database client disconnected successfully.');
    process.exit(0);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[Shutdown] Error occurred during graceful shutdown: ${msg}`);
    process.exit(1);
  }
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Catch unhandled promise rejections — without this, Node logs a warning and
// future versions will terminate the process. Log and keep running so transient
// failures don't take down the server.
process.on('unhandledRejection', (reason, promise) => {
  logger.error('[Fatal] Unhandled Promise Rejection at:', promise, 'reason:', reason);
});

// Catch uncaught exceptions — the process is in an unknown state after this,
// so log the error with stack and exit to let the process manager restart it.
process.on('uncaughtException', (err) => {
  logger.error('[Fatal] Uncaught Exception:', err);
  process.exit(1);
});
