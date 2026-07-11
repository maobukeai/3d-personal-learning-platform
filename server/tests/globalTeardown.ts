/**
 * Jest global teardown.
 *
 * Runs once after the entire test suite completes. Closes all long-lived
 * async resources that would otherwise keep the Node.js event loop alive —
 * exactly the leaks that `--forceExit` was previously masking.
 *
 * Resources closed (in dependency order):
 *  1. Socket.io server (shares the Fastify HTTP server — close before Fastify)
 *  2. Fastify HTTP server
 *  3. BullMQ queue + worker (uses its own Redis connections — close before Redis)
 *  4. Redis client (shared by the cache service + Redlock)
 *  5. Prisma client (the most common source of dangling handles)
 *
 * NOTE on Jest module isolation: each test file (and this teardown) gets its
 * own module registry. The Prisma client is shared across all of them via the
 * `globalThis` guard in src/services/prisma.ts, so `prisma.$disconnect()`
 * here reliably closes the real DB connection. The Redis/BullMQ/Fastify/
 * Socket.io singletons imported here may be fresh instances; closing them is
 * a defensive best-effort that also covers the case where no test touched
 * them. Individual test files remain responsible for closing instances they
 * explicitly start (e.g. `fapp.close()` in yjs.routes.test.ts).
 */
import prisma from '../src/services/prisma';
import redisService from '../src/services/redis.service';
import { closeBullMQ } from '../src/services/bullmq.service';
import { getIo } from '../src/services/socket.service';
import { fapp } from '../src/fastify/app';
import { logger } from '../src/utils/logger';

export default async function globalTeardown(): Promise<void> {
  // 1. Socket.io — getIo() throws when the server was never initialized.
  try {
    const io = getIo();
    await new Promise<void>((resolve) => {
      io.close(() => resolve());
    });
    logger.info('[globalTeardown] Socket.io server closed.');
  } catch {
    // Socket.io not initialized — nothing to close.
  }

  // 2. Fastify HTTP server.
  try {
    await fapp.close();
    logger.info('[globalTeardown] Fastify server closed.');
  } catch (err) {
    logger.warn('[globalTeardown] Fastify close error:', err);
  }

  // 3. BullMQ queue + worker (no-op if never initialized).
  try {
    await closeBullMQ();
    logger.info('[globalTeardown] BullMQ closed.');
  } catch (err) {
    logger.warn('[globalTeardown] BullMQ close error:', err);
  }

  // 4. Redis client (no-op if Redis was disabled in test mode).
  try {
    await redisService.quit();
    logger.info('[globalTeardown] Redis disconnected.');
  } catch (err) {
    logger.warn('[globalTeardown] Redis disconnect error:', err);
  }

  // 5. Prisma — shared via globalThis, so this closes the real connection.
  try {
    await prisma.$disconnect();
    logger.info('[globalTeardown] Prisma client disconnected.');
  } catch (err) {
    logger.warn('[globalTeardown] Prisma disconnect error:', err);
  }

  // 6. AI cleanup timer
  try {
    const { stopAiCleanupTimer } = require('../src/services/ai.service');
    stopAiCleanupTimer();
    logger.info('[globalTeardown] AI cleanup timer stopped.');
  } catch (err) {
    logger.warn('[globalTeardown] AI cleanup timer stop error:', err);
  }
}
