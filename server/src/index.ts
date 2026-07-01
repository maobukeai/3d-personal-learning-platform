import { logger } from './utils/logger';
import http from 'http';
import app from './app';
import { config } from './config/env';
import { initSocket } from './services/socket.service';
import { syncEngine } from './mirror/services/sync-engine.service';
import { runManualStationMigration } from './manual/services/migration.service';
import {
  startCleanupJob,
  stopCleanupJob,
  startMessageCleanupJob,
  stopMessageCleanupJob,
} from './services/cleanup.service';
import { settingsService } from './services/settings.service';
import {
  startDirectMessageEmailScheduler,
  stopDirectMessageEmailScheduler,
} from './services/direct-message-email.service';
import { stopAiCleanupTimer } from './services/ai.service';
import './services/redis.service';
import prisma from './services/prisma';
import { storageService } from './services/storage.service';

const port = config.PORT;

const server = http.createServer(app);

initSocket(server);

syncEngine.startScheduler();
startCleanupJob(); // Clean up expired data hourly
startMessageCleanupJob(); // Clean up message uploads every 3 days
startDirectMessageEmailScheduler();

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
          secretAccessKey: raw.secretAccessKey,
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

server.listen(port, () => {
  logger.info(`Server is running at http://localhost:${port}`);
  logger.info(`Environment: ${config.NODE_ENV}`);
});

const gracefulShutdown = async (signal: string) => {
  logger.info(`[Shutdown] Received system signal: ${signal}. Initiating graceful shutdown...`);
  try {
    syncEngine.stopScheduler();
    stopCleanupJob();
    stopDirectMessageEmailScheduler();
    stopMessageCleanupJob();
    stopAiCleanupTimer();

    // Wait for the HTTP server to stop accepting new connections before
    // disconnecting the database — avoids forceful mid-request disconnections.
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) {
          logger.warn('[Shutdown] HTTP server close error:', err);
          reject(err);
        } else {
          logger.info('[Shutdown] HTTP server closed.');
          resolve();
        }
      });
    });

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
