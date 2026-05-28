import { logger } from './utils/logger';
import http from 'http';
import app from './app';
import { config } from './config/env';
import { initSocket } from './services/socket.service';
import { syncEngine } from './mirror/services/sync-engine.service';
import { runManualStationMigration } from './manual/services/migration.service';
import { startCleanupJob } from './services/cleanup.service';
import './services/redis.service';

const port = config.PORT;

const server = http.createServer(app);

initSocket(server);

syncEngine.startScheduler();
startCleanupJob(); // Clean up expired data hourly

// Run legacy manual station migration asynchronously on startup
runManualStationMigration().catch((err) => {
  logger.error('[Startup] Migration error:', err);
});
import prisma from './services/prisma';

server.listen(port, () => {
  logger.info(`Server is running at http://localhost:${port}`);
  logger.info(`Environment: ${config.NODE_ENV}`);
});

const gracefulShutdown = async (signal: string) => {
  logger.info(`[Shutdown] Received system signal: ${signal}. Initiating graceful shutdown...`);
  try {
    syncEngine.stopScheduler();

    server.close(() => {
      logger.info('[Shutdown] HTTP server closed.');
    });

    await prisma.$disconnect();
    logger.info('[Shutdown] Prisma database client disconnected successfully.');
    process.exit(0);
  } catch (err: any) {
    logger.error(`[Shutdown] Error occurred during graceful shutdown: ${err.message}`);
    process.exit(1);
  }
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
