import Fastify, { type FastifyError, type FastifyRequest } from 'fastify';
import { Prisma } from '@prisma/client';
import type { IncomingMessage } from 'http';
import type { Socket } from 'net';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import websocket from '@fastify/websocket';
import { ZodTypeProvider, validatorCompiler, serializerCompiler } from 'fastify-type-provider-zod';
import { config } from '../config/env';
import { logger } from '../utils/logger';
import { AppError, formatError } from '../utils/error';
import { registerSlowLogHook } from './middlewares/slow-log.hook';
import { buildCorsOriginChecker, registerAppHooks, handlePrismaError } from './utils/app-helpers';
import { registerAllFastifyRoutes } from './routes';
import { startTaskDueReminderScheduler } from '../services/task-due-reminder.service';

/**
 * Fastify API 实例。
 */
export const fapp = Fastify({
  logger: { level: 'info' },
  trustProxy: true,
  bodyLimit: 50 * 1024 * 1024,
});

fapp.setValidatorCompiler(validatorCompiler);
fapp.setSerializerCompiler(serializerCompiler);
fapp.withTypeProvider<ZodTypeProvider>();

let initPromise: Promise<void> | null = null;

export const startFastify = (): Promise<void> => {
  if (initPromise) {
    logger.info('Fastify server already initialized or booting, returning initial Promise.');
    return initPromise;
  }
  initPromise = startFastifyInternal();
  return initPromise;
};

const startFastifyInternal = async (): Promise<void> => {
  // 1) 注册 Request Hooks
  registerAppHooks(fapp);

  // 2) 基础中间件插件注册
  await fapp.register(cors, {
    credentials: true,
    origin: buildCorsOriginChecker(),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  });
  await fapp.register(cookie, {
    secret: config.JWT_SECRET,
  });

  const RATE_LIMIT_SKIP_PATHS = new Set([
    '/api/auth/refresh',
    '/api/auth/me',
    '/api/auth/settings',
    '/api/auth/logout',
  ]);

  // 全局 rateLimit 兜底限流保护（300次/分钟）
  await fapp.register(rateLimit, {
    max: 300,
    timeWindow: '1 minute',
    allowList: (request: FastifyRequest) => {
      const path = request.url.split('?')[0] ?? '';
      return RATE_LIMIT_SKIP_PATHS.has(path);
    },
    errorResponseBuilder: () => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: '请求过于频繁，请稍后再试',
    }),
  });

  await fapp.register(multipart, {
    limits: {
      fileSize: 100 * 1024 * 1024, // 100MB
    },
  });
  await fapp.register(websocket);

  // 避免 @fastify/websocket 拦截 Socket.io 升级请求
  const upgradeListeners = fapp.server.listeners('upgrade');
  const wsListener = upgradeListeners[upgradeListeners.length - 1];
  if (wsListener && typeof wsListener === 'function') {
    fapp.server.removeListener(
      'upgrade',
      wsListener as (req: IncomingMessage, socket: Socket, head: Buffer) => void,
    );
    fapp.server.on('upgrade', (req: IncomingMessage, socket: Socket, head: Buffer) => {
      if (req.url && req.url.includes('/socket.io/')) {
        return;
      }
      (wsListener as (req: IncomingMessage, socket: Socket, head: Buffer) => void)(
        req,
        socket,
        head,
      );
    });
  }

  // 慢日志监控
  registerSlowLogHook(fapp);

  // 3) 错误处理：把 AppError / ZodError / Prisma 转化为统一规范
  fapp.setErrorHandler((error: FastifyError | AppError, request, reply) => {
    if (error.statusCode === 429) {
      return reply.status(429).send({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: '请求过于频繁，请稍后再试',
        },
      });
    }

    if ((error as any).validation) {
      const valErr = error as any;
      logger.warn(
        `[Fastify Validation Error] ${request.method} ${request.url}:`,
        valErr.validation,
      );
      return reply.status(400).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '请求参数校验失败',
          details: valErr.validation,
        },
      });
    }

    let appErr: AppError;

    if (error instanceof AppError) {
      appErr = error;
    } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
      appErr = handlePrismaError(error);
    } else {
      const statusCode = (error as FastifyError).statusCode || 500;
      appErr = new AppError(
        error.message || '服务器内部错误',
        statusCode,
        statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_SERVER_ERROR',
      );
    }

    if (appErr.statusCode >= 500) {
      logger.error(`[Fastify Error] ${request.method} ${request.url}:`, error);
    }

    return reply.status(appErr.statusCode).send(formatError(appErr));
  });

  // 4) 注册所有 Fastify 领域路由
  registerAllFastifyRoutes(fapp);

  // 5) 启动 HTTP 监听
  const PORT = Number(config.PORT) || 3001;
  const HOST = '0.0.0.0';

  try {
    await fapp.listen({ port: PORT, host: HOST });
    logger.info(`[Fastify] Server running on http://${HOST}:${PORT}`);
    // 6) 任务到期提醒定时扫描（启动 1 分钟后首轮，之后每小时一次）
    startTaskDueReminderScheduler();
  } catch (err) {
    logger.error('[Fastify] Failed to start server:', err);
    throw err;
  }
};
