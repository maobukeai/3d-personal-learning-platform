import type { FastifyInstance, FastifyRequest } from 'fastify';
import logger from '../../utils/logger';
import {
  httpRequestDuration,
  httpRequestsTotal,
  slowRequestsTotal,
} from '../../services/metrics.service';

/**
 * Fastify 版 HTTP 运行时监控 hook（对应 Express 版 slow-log.middleware.ts）。
 *
 * - 高精度计时（process.hrtime.bigint），通过 onRequest 记录起始时间
 * - onResponse 中记录 Prometheus 指标（直方图 + 计数器 + 慢请求计数器）
 * - 超过 16.7ms 的请求记录慢请求指标（100% 采样）
 * - 慢日志仅 10% 采样输出，避免日志爆炸
 *
 * 路径归一化策略：
 *  - 优先使用 Fastify 5.x 的 request.routeOptions.url（路由模板，如 /api/assets/:id）
 *  - 404 等未匹配路由时回退到 request.url 并替换 UUID / 纯数字 / 长 hex → :id
 */

const SLOW_THRESHOLD_MS = 16.7;

// UUID v4 / 纯数字 / 长 hex 字符串 → :id
const ID_PATTERNS: ReadonlyArray<[RegExp, string]> = [
  [/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id'], // UUID
  [/\b\d+\b/g, ':id'], // 纯数字
  [/[0-9a-f]{16,}/gi, ':id'], // 长 hex（如 hash/blob key）
];

/**
 * 将请求路径归一化为低基数 label 值。
 * Fastify 5.x：request.routeOptions.url 提供路由模板（如 /api/assets/:id），
 * 404 等未匹配场景下为 undefined，回退到 request.url 并替换动态段。
 */
const normalizeRoute = (request: FastifyRequest): string => {
  const routePath = request.routeOptions.url;
  if (routePath) {
    return routePath.replace(/\/+/g, '/') || '/';
  }

  // 回退：从 url 提取 path 并替换动态段
  const path = (request.url || '/').split('?')[0] ?? '/';
  let normalized: string = path;
  for (const [pattern, replacement] of ID_PATTERNS) {
    normalized = normalized.replace(pattern, replacement);
  }
  return normalized || '/';
};

/**
 * 计算耗时（毫秒，浮点）
 */
const elapsedMs = (start: bigint): number => {
  const diff = process.hrtime.bigint() - start;
  return Number(diff) / 1_000_000; // ns → ms
};

/**
 * 注册 slow-log hook：onRequest 记录起始时间，onResponse 记录指标。
 */
export const registerSlowLogHook = (fastify: FastifyInstance): void => {
  fastify.addHook('onRequest', async (request) => {
    (request as FastifyRequest & { __slowLogStart?: bigint }).__slowLogStart =
      process.hrtime.bigint();
  });

  fastify.addHook('onResponse', async (request, reply) => {
    const start = (request as FastifyRequest & { __slowLogStart?: bigint }).__slowLogStart;
    if (!start) return;

    const durationMs = elapsedMs(start);
    const method = request.method;
    const route = normalizeRoute(request);
    const status = String(reply.statusCode);

    // 记录 Prometheus 指标
    httpRequestDuration.labels({ method, route, status }).observe(durationMs / 1000);
    httpRequestsTotal.labels({ method, route, status }).inc();

    // 超过 16.7ms → 慢请求计数器（100% 记录）+ 慢日志（10% 采样）
    if (durationMs > SLOW_THRESHOLD_MS) {
      // 指标记录在采样之前，确保 Prometheus 指标仍记录 100%
      slowRequestsTotal.labels({ method, route, status }).inc();
      // 采样：仅打印 10% 的慢日志避免日志爆炸
      if (Math.random() > 0.1) return;
      const requestId = (request as FastifyRequest & { requestId?: string }).requestId ?? '-';
      logger.warn(
        `[Slow] ${method} ${route} → ${status} | ${durationMs.toFixed(1)}ms (threshold: ${SLOW_THRESHOLD_MS}ms) | reqId=${requestId}`,
      );
    }
  });
};
