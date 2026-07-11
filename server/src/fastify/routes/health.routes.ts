import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../../services/prisma';

/**
 * Fastify 健康检查路由 —— 用于验证 Fastify 实例及数据库是否正常运行。
 * 不挂前缀，直接暴露在根路径下：GET /health
 */
export const registerHealthRoutes = (app: FastifyInstance): void => {
  app.get('/health', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      // 执行轻量级查询验证数据库连接状况
      await prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        service: 'fastify',
        database: 'healthy',
        timestamp: Date.now(),
      };
    } catch (err: unknown) {
      app.log.error(err as Error, '[HealthCheck] Database connection failed');
      return reply.status(500).send({
        status: 'error',
        service: 'fastify',
        database: 'unhealthy',
        error: err instanceof Error ? err.message : String(err),
        timestamp: Date.now(),
      });
    }
  });
};
