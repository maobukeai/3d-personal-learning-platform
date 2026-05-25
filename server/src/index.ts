import { logger } from './utils/logger';
import http from 'http';
import app from './app';
import { config } from './config/env';
import { initSocket } from './services/socket.service';
import { syncEngine } from './mirror/services/sync-engine.service';
import { runManualStationMigration } from './manual/services/migration.service';
import { startCleanupJob } from './services/cleanup.service';

const port = config.PORT;

const server = http.createServer(app);

initSocket(server);

syncEngine.startScheduler();
startCleanupJob(); // Clean up expired data hourly

// Run legacy manual station migration asynchronously on startup
runManualStationMigration().catch((err) => {
  logger.error('[Startup] Migration error:', err);
});

server.listen(port, () => {
  logger.info(`Server is running at http://localhost:${port}`);
  logger.info(`Environment: ${config.NODE_ENV}`);
});
