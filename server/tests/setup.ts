afterAll(async () => {
  try {
    const { logger } = await import('../src/utils/logger');

    // 1. Socket.io
    try {
      const { getIo } = await import('../src/services/socket.service');
      const io = getIo();
      await new Promise<void>((resolve) => {
        io.close(() => resolve());
      });
      logger.info('[setupFilesAfterEnv] Socket.io server closed.');
    } catch {
      // Ignore if not initialized
    }

    // 2. Fastify HTTP server
    try {
      const { fapp } = await import('../src/fastify/app');
      if (fapp.server.listening) {
        await fapp.close();
        logger.info('[setupFilesAfterEnv] Fastify server closed.');
      }
    } catch (err) {
      // Ignore
    }

    // 3. BullMQ queue + worker
    try {
      const { closeBullMQ } = await import('../src/services/bullmq.service');
      await closeBullMQ();
      logger.info('[setupFilesAfterEnv] BullMQ closed.');
    } catch (err) {
      // Ignore
    }

    // 4. Redis client
    try {
      const redisService = (await import('../src/services/redis.service')).default;
      await redisService.quit();
      logger.info('[setupFilesAfterEnv] Redis client closed.');
    } catch (err) {
      // Try forcing disconnect if quit failed
      try {
        const redisService = (await import('../src/services/redis.service')).default;
        (redisService as any).disconnect();
      } catch {
        // Ignore
      }
    }

    // 5. AI cleanup timer
    try {
      const { stopAiCleanupTimer } = await import('../src/services/ai.service');
      stopAiCleanupTimer();
      logger.info('[setupFilesAfterEnv] AI cleanup timer stopped.');
    } catch (err) {
      // Ignore
    }

    // 6. Prisma Client
    try {
      const prisma = (await import('../src/services/prisma')).default;
      await prisma.$disconnect();
      logger.info('[setupFilesAfterEnv] Prisma Client disconnected.');
    } catch (err) {
      // Ignore
    }
  } catch {
    // Ignore logger import errors
  }
});
