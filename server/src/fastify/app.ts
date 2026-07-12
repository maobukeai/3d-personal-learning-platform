import Fastify, { type FastifyError, type FastifyRequest } from 'fastify';
import { Prisma } from '@prisma/client';
import crypto, { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
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
import { registerHealthRoutes } from './routes/health.routes';
import { registerModelRoutes } from './routes/model.routes';
import { registerYjsRoutes } from './routes/yjs.routes';
import { registerAiRoutes } from './routes/ai.routes';
import { registerAiBotRoutes } from './routes/ai-bots.routes';
import { registerTaskRoutes } from './routes/task.routes';
import { registerDiscussionRoutes } from './routes/discussion.routes';
import { registerNoteRoutes } from './routes/note.routes';
import { registerResourceRoutes } from './routes/resource.routes';
import { registerMaterialRoutes } from './routes/material.routes';
import { registerAssetRoutes } from './routes/asset.routes';
import { registerLessonRoutes } from './routes/lesson.routes';
import { registerAuthRoutes } from './routes/auth.routes';
import { registerCourseRoutes } from './routes/course.routes';
import { registerTeamRoutes } from './routes/team.routes';
import { registerProjectRoutes } from './routes/project.routes';
import { registerMessageRoutes } from './routes/message.routes';
import { registerShowcaseRoutes } from './routes/showcase.routes';
import { registerSubscriptionRoutes } from './routes/subscription.routes';
import { registerAdminRoutes } from './routes/admin.routes';
import { registerPluginAdminRoutes } from './routes/plugin-admin.routes';
import { registerSoftwareAdminRoutes } from './routes/software-admin.routes';
import { registerAdminMirrorRoutes } from './routes/admin-mirror.routes';
import { registerAdminManualRoutes } from './routes/admin-manual.routes';
import { registerBackupRoutes } from './routes/backup.routes';
import { registerBannerRoutes } from './routes/banner.routes';
import { registerFeedbackRoutes } from './routes/feedback.routes';
import { registerGoogleWarmingRoutes } from './routes/google-warming.routes';
import { registerNotificationRoutes } from './routes/notification.routes';
import { registerRoadmapRoutes } from './routes/roadmap.routes';
import { registerEmailRoutes } from './routes/email.routes';
import { registerTwoFactorRoutes } from './routes/two-factor.routes';
import { registerMirrorRoutes } from './routes/mirror.routes';
import { registerManualRoutes } from './routes/manual.routes';
import { registerTemporaryNetdiskRoutes } from './routes/temporary-netdisk.routes';
import { registerPluginRoutes } from './routes/plugin.routes';
import { registerSoftwareRoutes } from './routes/software.routes';
import { registerWebsiteRoutes } from './routes/website.routes';
import { registerSlowLogHook } from './middlewares/slow-log.hook';
import { fastifyMaintenance } from './middlewares/maintenance.hook';

/**
 * Fastify API 实例。
 *
 * 设计要点：
 *  - 监听 PORT（默认 3001）
 *  - 共享 prisma / redis 单例（在路由层导入）
 *  - 鉴权逻辑沿用 auth.middleware.ts 的约定（见 fastify/auth/fastify-auth.ts）
 *  - REST 路由统一挂载到 /api，协同编辑 WebSocket 挂载到 /ws
 */
export const fapp = Fastify({
  logger: { level: 'info' },
  trustProxy: true,
});

fapp.setValidatorCompiler(validatorCompiler);
fapp.setSerializerCompiler(serializerCompiler);

// ZodTypeProvider 设为默认 —— 路由 schema 选项可直接传 Zod schema
fapp.withTypeProvider<ZodTypeProvider>();

/**
 * CORS origin 解析逻辑：
 *  - FRONTEND_URL + CORS_EXTRA_ORIGINS（逗号分隔）作为白名单
 *  - development 模式允许任意 localhost / 127.0.0.1 端口
 *  - 无 origin（curl/移动端）放行
 *
 * 使用 @fastify/cors v11 的 async origin function 形式：
 *  - 返回 true 表示放行（会回显请求 origin）
 *  - 返回 false 表示不放行（不设置 ACAO header，浏览器侧拦截）
 */
const buildCorsOriginChecker = () => {
  const allowedOrigins = [
    process.env.FRONTEND_URL,
    ...(process.env.CORS_EXTRA_ORIGINS?.split(',').map((o) => o.trim()) ?? []),
  ].filter(Boolean) as string[];

  return async (origin: string | undefined): Promise<boolean> => {
    // 无 Origin header（curl / 服务端调用）—— 放行
    if (!origin) return true;
    if (
      allowedOrigins.indexOf(origin) !== -1 ||
      (process.env.NODE_ENV === 'development' &&
        (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')))
    ) {
      return true;
    }
    return false;
  };
};

/**
 * 注册所有 Fastify 插件 + 路由，并启动监听。
 *
 * 可由主入口启动，也可独立运行（npm run start:fastify）。
 */
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
  // 1) 插件注册
  const REQUEST_ID_PATTERN = /^[a-zA-Z0-9._:-]{8,128}$/;
  fapp.addHook('onRequest', async (request, reply) => {
    const header = request.headers['x-request-id'];
    const value = Array.isArray(header) ? header[0] : header;
    const requestId = value && REQUEST_ID_PATTERN.test(value) ? value : randomUUID();
    (request as FastifyRequest & { requestId?: string }).requestId = requestId;
    (request.raw as IncomingMessage & { requestId?: string }).requestId = requestId;
    reply.header('X-Request-Id', requestId);
  });

  fapp.addHook('preParsing', async (request, reply, payload) => {
    const requestPath = request.url.split('?')[0] || request.url;
    if (requestPath === '/api/assets/webhook') {
      const chunks: Buffer[] = [];
      for await (const chunk of payload) {
        chunks.push(chunk as Buffer);
      }
      const rawBody = Buffer.concat(chunks);
      (request as FastifyRequest & { rawBody?: Buffer }).rawBody = rawBody;
      const { Readable } = await import('stream');
      return Readable.from([rawBody]);
    }
    return payload;
  });

  await fapp.register(cors, {
    credentials: true,
    origin: buildCorsOriginChecker(),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  });
  await fapp.register(cookie, {
    secret: config.JWT_SECRET,
  });
  // Auth infrastructure endpoints that must NEVER be blocked by the rate limiter:
  // they are called automatically during page load and token-refresh cycles.
  const RATE_LIMIT_SKIP_PATHS = new Set([
    '/api/auth/refresh',
    '/api/auth/me',
    '/api/auth/settings',
    '/api/auth/logout',
  ]);

  await fapp.register(rateLimit, {
    // 300 req/min global — generous for a single-user dev environment while
    // still protecting against scrapers/bursts in production.
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

  // Intercept the 'upgrade' listeners on the server to prevent @fastify/websocket
  // from hijacking and closing Socket.io upgrade requests.
  const upgradeListeners = fapp.server.listeners('upgrade');
  const wsListener = upgradeListeners[upgradeListeners.length - 1];
  if (wsListener && typeof wsListener === 'function') {
    fapp.server.removeListener(
      'upgrade',
      wsListener as (req: IncomingMessage, socket: Socket, head: Buffer) => void,
    );
    fapp.server.on('upgrade', (req: IncomingMessage, socket: Socket, head: Buffer) => {
      if (req.url && req.url.includes('/socket.io/')) {
        return; // Skip for Socket.io
      }
      (wsListener as (req: IncomingMessage, socket: Socket, head: Buffer) => void)(
        req,
        socket,
        head,
      );
    });
  }

  // Slow-log 监控 hook：onRequest 记录起始时间，onResponse 记录 Prometheus 指标
  registerSlowLogHook(fapp);

  // 2) 错误处理：把 AppError 转成统一响应格式（与 Express errorHandler 对齐）
  const handlePrismaError = (err: Prisma.PrismaClientKnownRequestError): AppError => {
    switch (err.code) {
      case 'P2002': {
        const target = (err.meta?.target as string[])?.join(', ') || 'field';
        return new AppError(`数据冲突：${target} 已存在`, 409, 'DATABASE_CONFLICT', { target });
      }
      case 'P2025':
        return new AppError('请求的资源不存在', 404, 'RESOURCE_NOT_FOUND');
      case 'P2003':
        return new AppError('关联数据不存在', 400, 'FOREIGN_KEY_CONSTRAINT');
      case 'P2011':
        return new AppError('缺少必填字段', 400, 'DATABASE_REQUIRED_FIELD');
      case 'P2012':
        return new AppError('缺少必填值', 400, 'DATABASE_REQUIRED_VALUE');
      case 'P2014':
        return new AppError('操作被拒绝，因为关联数据仍然存在', 400, 'RELATION_CONSTRAINT');
      case 'P2015':
        return new AppError('关联记录不存在', 404, 'RELATED_RECORD_NOT_FOUND');
      case 'P2016':
        return new AppError('查询解释错误', 400, 'DATABASE_QUERY_ERROR');
      case 'P2021':
        return new AppError('请求的表不存在', 500, 'DATABASE_TABLE_NOT_FOUND');
      default:
        return new AppError(`数据库错误 (${err.code})`, 500, 'DATABASE_ERROR');
    }
  };

  const handleJWTError = (err: Error): AppError => {
    if (err.name === 'JsonWebTokenError') {
      return new AppError('无效的认证令牌', 401, 'INVALID_TOKEN');
    }
    if (err.name === 'TokenExpiredError') {
      return new AppError('认证令牌已过期', 401, 'TOKEN_EXPIRED');
    }
    return new AppError('认证失败', 401, 'AUTHENTICATION_FAILED');
  };

  interface MulterError extends Error {
    code?: string;
  }
  const handleMulterError = (err: MulterError): AppError => {
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        return new AppError('文件大小超出限制', 400, 'FILE_TOO_LARGE');
      case 'LIMIT_FILE_COUNT':
        return new AppError('文件数量超出限制', 400, 'TOO_MANY_FILES');
      case 'LIMIT_UNEXPECTED_FILE':
        return new AppError('意外的文件字段', 400, 'UNEXPECTED_FILE_FIELD');
      default:
        return new AppError('文件上传失败', 400, 'UPLOAD_FAILED');
    }
  };

  fapp.setErrorHandler((error: FastifyError, request, reply) => {
    let err: FastifyError | AppError = error;

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      err = handlePrismaError(error);
    } else if (error instanceof Prisma.PrismaClientValidationError) {
      err = new AppError('数据验证失败', 400, 'DATABASE_VALIDATION_ERROR');
    } else if (error instanceof Prisma.PrismaClientUnknownRequestError) {
      err = new AppError('未知的数据库请求错误', 500, 'DATABASE_UNKNOWN_ERROR');
    } else if (
      error.name === 'JsonWebTokenError' ||
      error.name === 'TokenExpiredError' ||
      error.name === 'NotBeforeError'
    ) {
      err = handleJWTError(error);
    } else if (error.name === 'MulterError') {
      err = handleMulterError(error as MulterError);
    } else if (
      error.name === 'SyntaxError' &&
      (error as { status?: number }).status === 400 &&
      'body' in error
    ) {
      err = new AppError('请求体格式错误：无效的 JSON', 400, 'INVALID_JSON');
    } else if (error.message === 'Not allowed by CORS') {
      err = new AppError('当前来源不允许访问 API', 403, 'CORS_NOT_ALLOWED');
    }

    const appError = err instanceof AppError ? err : undefined;
    const statusCode =
      appError &&
      Number.isInteger(appError.statusCode) &&
      appError.statusCode >= 400 &&
      appError.statusCode < 600
        ? appError.statusCode
        : error.statusCode || 500;

    const message = err.message || 'Internal Server Error';
    const code = appError?.code || (statusCode === 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR');
    const requestId = (request as FastifyRequest & { requestId?: string }).requestId;

    if (error.validation) {
      return reply.status(400).send({
        status: 'error',
        success: false,
        error: error.message,
        message: error.message,
        code: 'VALIDATION_ERROR',
        ...(requestId && { requestId }),
        details: error.validation,
      });
    }

    if (statusCode === 403) {
      logger.warn(`[Fastify] 403 Forbidden on ${request.method} ${request.url}:`, error);
      const logPath = path.join(__dirname, '../../error-debug.log');
      const logLine = `\n\n[${new Date().toISOString()}] 403 on ${request.method} ${request.url}\nError: ${error.message}\nStack: ${error.stack}\n`;
      // Async write per project rule: never use fs.*Sync in request handlers
      fs.promises.appendFile(logPath, logLine).catch((logErr) => {
        logger.warn(`[Fastify] Failed to append 403 debug log:`, logErr);
      });
    }

    if (statusCode === 429) {
      return reply.status(429).send({
        status: 'error',
        success: false,
        error: '请求过于频繁，请稍后再试',
        message: '请求过于频繁，请稍后再试',
        code: 'RATE_LIMIT_EXCEEDED',
        ...(requestId && { requestId }),
      });
    }

    if (statusCode === 500) {
      logger.error('[Fastify] Unhandled error:', error);
    }

    return reply.status(statusCode).send({
      status: 'error',
      success: false,
      error: message,
      message,
      code,
      ...(requestId && { requestId }),
      ...(appError?.details !== undefined && { details: appError.details }),
    });
  });

  fapp.setNotFoundHandler((request, reply) => {
    const error = new AppError(
      `接口不存在: ${request.method} ${request.url}`,
      404,
      'ROUTE_NOT_FOUND',
    );
    const body = formatError(error) as ReturnType<typeof formatError> & { requestId?: string };
    body.requestId = (request as FastifyRequest & { requestId?: string }).requestId;
    return reply.status(404).send(body);
  });

  // CSRF protection hook
  const fastifyCsrf = async (request: FastifyRequest) => {
    if (process.env.NODE_ENV === 'test') {
      return;
    }
    const method = request.method;
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (safeMethods.includes(method)) {
      return;
    }

    // Bearer credentials are attached explicitly by the SPA and are not sent
    // automatically by browsers on cross-site requests. CSRF protection is
    // therefore only required for cookie-authenticated mutations. Route-level
    // authentication still validates the token after this hook.
    const authorization = request.headers.authorization;
    if (typeof authorization === 'string' && /^Bearer\s+\S+$/i.test(authorization)) {
      return;
    }

    const bypassUrls = [
      '/api/auth/login',
      '/api/auth/login/2fa',
      '/api/auth/register',
      '/api/auth/register-admin',
      '/api/auth/forgot-password',
      '/api/auth/forgot-password/check',
      '/api/auth/forgot-password/reset-2fa',
      '/api/auth/reset-password',
      '/api/auth/oauth/google',
      '/api/auth/oauth/google/callback',
      '/api/auth/oauth/github',
      '/api/auth/oauth/github/callback',
      '/api/auth/email/send-code-public',
      '/api/auth/email/verify-public',
      '/api/auth/refresh',
      '/api/auth/logout',
      '/api/projects/ai-chat',
      '/api/projects/ai-chat/upload',
      '/api/plugins/client/feedback',
      // AI 接口均由 JWT Bearer token 鉴权，无需额外 CSRF cookie 校验
      '/api/ai/optimize-prompt',
      '/api/ai/generate-image',
      '/api/ai/write-assist',
    ];
    const requestPath = request.url.split('?')[0] || request.url;
    const isSharedNoteAiSummarize = /^\/api\/notes\/share\/[^/]+\/ai-summarize$/.test(requestPath);
    const isRegularNoteAiSummarize = /^\/api\/notes\/[^/]+\/ai-summarize$/.test(requestPath);
    const isAiBotCallback = /^\/api\/ai-bots\/callback\/[^/]+$/.test(requestPath);
    const isR2Webhook = requestPath === '/api/assets/webhook';
    const isNetdiskShareVerify = /^\/api\/temporary-netdisk\/share\/[^/]+\/verify$/.test(
      requestPath,
    );
    const isWebsiteNetdisk = requestPath.startsWith('/api/website/netdisk/');

    if (
      bypassUrls.includes(requestPath) ||
      isSharedNoteAiSummarize ||
      isRegularNoteAiSummarize ||
      isAiBotCallback ||
      isR2Webhook ||
      isNetdiskShareVerify ||
      isWebsiteNetdisk
    ) {
      return;
    }

    const csrfCookie = (request.cookies as Record<string, string | undefined> | undefined)
      ?.csrfToken;
    const csrfHeader = request.headers['x-csrf-token'];
    const csrfBody = (request.body as { _csrf?: string } | undefined)?._csrf;
    const csrfTokenFromRequest = csrfHeader || csrfBody;

    const safeCompare = (a: string, b: string): boolean => {
      try {
        const bufA = Buffer.from(a);
        const bufB = Buffer.from(b);
        if (bufA.length !== bufB.length) return false;
        return crypto.timingSafeEqual(bufA, bufB);
      } catch {
        return false;
      }
    };

    if (
      !csrfCookie ||
      !csrfTokenFromRequest ||
      typeof csrfCookie !== 'string' ||
      typeof csrfTokenFromRequest !== 'string' ||
      !safeCompare(csrfCookie, csrfTokenFromRequest)
    ) {
      // Cookie values can include authentication or refresh tokens; never put
      // them into logs, where retention and access are broader than the app.
      logger.warn(
        `[CSRF] Validation failed: csrfCookie=${csrfCookie ? 'present' : 'missing'}, requestToken=${csrfTokenFromRequest ? 'present' : 'missing'}`,
      );
      throw new AppError(
        `CSRF 校验失败 (Cookie: ${csrfCookie ? '已存' : '缺失'}, Header/Body: ${csrfTokenFromRequest ? '已存' : '缺失'}${csrfCookie && csrfTokenFromRequest && csrfCookie !== csrfTokenFromRequest ? ', 不匹配' : ''})`,
        403,
        'CSRF_VALIDATION_FAILED',
      );
    }
  };

  // 维护模式 preHandler：在 CSRF 校验之前检查，维护中直接 503
  fapp.addHook('preHandler', fastifyMaintenance);

  fapp.addHook('preHandler', fastifyCsrf);

  // 3) 路由注册
  // health 不挂前缀，直接 GET /health
  registerHealthRoutes(fapp);

  // ── 资源级别路由 ──────────────
  const fp = '/api'; // 公共根前缀

  // Validate proxy image URL to prevent SSRF attacks
  const isAllowedProxyUrl = (rawUrl: string): boolean => {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
      const host = parsed.hostname.toLowerCase();
      if (
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host === '::1' ||
        host === '0.0.0.0' ||
        /^10\./.test(host) ||
        /^192\.168\./.test(host) ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
        /^169\.254\./.test(host) ||
        host.endsWith('.local') ||
        host.endsWith('.internal')
      ) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  };

  fapp.get('/api/proxy/image', async (request, reply) => {
    const url = (request.query as { url?: string }).url as string | undefined;
    if (!url) {
      return reply.status(400).send('Missing url parameter');
    }
    if (!isAllowedProxyUrl(url)) {
      return reply.status(403).send('URL not allowed');
    }
    try {
      const axios = (await import('axios')).default;
      const response = await axios.get(url, {
        responseType: 'stream',
        timeout: 10000,
        maxRedirects: 3,
      });
      const contentType = String(response.headers['content-type'] || 'image/jpeg');
      if (!contentType.startsWith('image/')) {
        return reply.status(400).send('URL does not point to an image');
      }
      reply.header('Content-Type', contentType);
      reply.header('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
      return reply.send(response.data);
    } catch (_error) {
      return reply.status(500).send('Failed to proxy image');
    }
  });

  fapp.get('/metrics', async (_req, reply) => {
    const { getMetrics, getMetricsContentType } = await import('../services/metrics.service');
    try {
      reply.header('Content-Type', getMetricsContentType());
      return reply.send(await getMetrics());
    } catch (_err) {
      return reply.status(500).send('Metrics collection failed');
    }
  });

  fapp.get('/', async (_req, reply) => {
    return reply.send('3D Personal Learning Platform API');
  });

  // Serve uploads directory static files as a fallback in development/local mode
  fapp.get('/uploads/*', async (request, reply) => {
    const wildcard = (request.params as { '*': string })['*'];
    const safePath = path.normalize(wildcard).replace(/^(\.\.[\/\\])+/, '');
    const filePath = path.join(process.cwd(), 'uploads', safePath);
    if (!fs.existsSync(filePath)) {
      return reply.status(404).send('File not found');
    }
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) {
      return reply.status(404).send('Not a file');
    }
    const ext = path.extname(filePath).toLowerCase();
    let contentType = 'application/octet-stream';
    if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.gif') contentType = 'image/gif';
    else if (ext === '.svg') contentType = 'image/svg+xml';
    else if (ext === '.ico') contentType = 'image/x-icon';
    else if (ext === '.webp') contentType = 'image/webp';

    reply.header('Content-Type', contentType);
    return reply.send(fs.createReadStream(filePath));
  });

  // ── A 组：路由内部已有完整路径，直接挂裸前缀 ─────────────────────────────
  fapp.register(
    (scope, _opts, done) => {
      // 全路径路由模块（内部已包含 /auth/*、/notes/* 等资源名）
      registerNoteRoutes(scope); // /notes/*
      registerAuthRoutes(scope); // /auth/*
      registerCourseRoutes(scope); // /courses/*
      registerTeamRoutes(scope); // /teams/*
      registerProjectRoutes(scope); // /projects/*
      registerMessageRoutes(scope); // /messages/*
      registerShowcaseRoutes(scope); // /showcase/*
      registerSubscriptionRoutes(scope); // /subscriptions/*
      registerNotificationRoutes(scope); // /notifications/*
      registerRoadmapRoutes(scope); // /roadmaps/*
      registerEmailRoutes(scope); // /email/*
      registerTwoFactorRoutes(scope); // /two-factor/*
      registerMirrorRoutes(scope); // /mirror/*
      registerManualRoutes(scope); // /manual/*
      registerWebsiteRoutes(scope); // /website/* and /admin/website/*
      registerTemporaryNetdiskRoutes(scope); // /netdisk/*
      registerLessonRoutes(scope); // /lessons/*
      registerResourceRoutes(scope); // /resources/*
      registerModelRoutes(scope); // /models/*
      registerPluginRoutes(scope); // /plugins/*
      registerSoftwareRoutes(scope); // /softwares/*
      // 管理类路由（内部含 /admin/*、/backup/*、/banners/* 等完整路径）
      registerAdminRoutes(scope);
      registerPluginAdminRoutes(scope);
      registerSoftwareAdminRoutes(scope);
      registerAdminMirrorRoutes(scope);
      registerAdminManualRoutes(scope);
      registerBackupRoutes(scope);
      registerBannerRoutes(scope);
      registerFeedbackRoutes(scope);
      registerGoogleWarmingRoutes(scope);
      done();
    },
    { prefix: fp },
  );

  // ── B 组：相对路径路由模块，需要独立资源前缀防止碰撞 ───────────────────────
  fapp.register(
    (s, _, done) => {
      registerAssetRoutes(s);
      done();
    },
    { prefix: `${fp}/assets` },
  );
  fapp.register(
    (s, _, done) => {
      registerMaterialRoutes(s);
      done();
    },
    { prefix: `${fp}/materials` },
  );
  fapp.register(
    (s, _, done) => {
      registerTaskRoutes(s);
      done();
    },
    { prefix: `${fp}/tasks` },
  );
  fapp.register(
    (s, _, done) => {
      registerDiscussionRoutes(s);
      done();
    },
    { prefix: `${fp}/discussions` },
  );
  fapp.register(
    (s, _, done) => {
      registerAiRoutes(s);
      done();
    },
    { prefix: `${fp}/ai` },
  );
  fapp.register(
    (s, _, done) => {
      registerAiBotRoutes(s);
      done();
    },
    { prefix: `${fp}/ai-bots` },
  );

  // P10 阶段2：Yjs 协同 WebSocket 路由（挂 /ws 前缀，与 REST API 隔离）
  fapp.register(
    (scope, _opts, done) => {
      registerYjsRoutes(scope);
      done();
    },
    { prefix: '/ws' },
  );

  // 4) 启动监听 —— Fastify 监听 PORT（默认 3001）
  if (process.env.JEST_WORKER_ID !== undefined || process.env.NODE_ENV === 'test') {
    await fapp.ready();
    logger.info('Fastify server ready for testing');
  } else {
    const port = config.PORT;
    await fapp.listen({ port, host: '0.0.0.0' });
    logger.info(`Fastify server started on port ${port}`);
  }
};

// 独立启动模式入口（npm run start:fastify）
if (require.main === module) {
  startFastify().catch((err: unknown) => {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error('[Fastify] Failed to start standalone:', errMsg);
    process.exit(1);
  });
}
