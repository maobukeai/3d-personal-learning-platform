import { logger } from './utils/logger';
import http from 'http';
import app from './app';
import { config } from './config/env';
import { initSocket } from './services/socket.service';
import { syncEngine } from './mirror/services/sync-engine.service';
import { runManualStationMigration } from './manual/services/migration.service';
import { startCleanupJob } from './services/cleanup.service';
import {
  startDirectMessageEmailScheduler,
  stopDirectMessageEmailScheduler,
} from './services/direct-message-email.service';
import './services/redis.service';
import prisma from './services/prisma';
import { storageService } from './services/storage.service';

const port = config.PORT;

const server = http.createServer(app);

initSocket(server);

syncEngine.startScheduler();
startCleanupJob(); // Clean up expired data hourly
startDirectMessageEmailScheduler();

// Configure CORS for all active buckets on startup to prevent cross-origin issues
const initActiveBucketsCors = async () => {
  try {
    const activeConfigs = await prisma.storageConfig.findMany({
      where: { status: 'ACTIVE' },
    });
    if (activeConfigs.length > 0) {
      logger.info(`[Startup] Found ${activeConfigs.length} active storage config(s). Configuring CORS...`);
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
    stopDirectMessageEmailScheduler();

    server.close(() => {
      logger.info('[Shutdown] HTTP server closed.');
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
// Hot reload trigger: updated with stable keys and encryption fallback
