import { Registry, collectDefaultMetrics, Histogram, Counter } from 'prom-client';

/**
 * P12：Prometheus 运行时监控 —— HTTP 50ms 阈值监控 + Node.js 进程指标
 *
 * 自定义指标：
 * - http_request_duration_seconds：请求耗时直方图（含 50ms 阈值 bucket）
 * - http_requests_total：请求总数计数器
 *
 * 默认指标：Node.js GC、event loop、内存、CPU 等
 */

export const registry = new Registry();

// 采集 Node.js 默认指标（GC、event loop lag、内存、CPU 等）
collectDefaultMetrics({ register: registry });

/**
 * HTTP 请求耗时直方图
 * bucket 设计围绕 50ms 阈值：5/10/25/50/75/100ms + 更大区间
 */
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

/**
 * HTTP 请求总数计数器
 */
export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'] as const,
  registers: [registry],
});

/**
 * 50ms 慢请求计数器（快速查看 P12 铁律达标率）
 */
export const slowRequestsTotal = new Counter({
  name: 'http_slow_requests_total',
  help: 'Number of HTTP requests exceeding 50ms (P12 threshold)',
  labelNames: ['method', 'route', 'status'] as const,
  registers: [registry],
});

/**
 * 输出 Prometheus 格式的指标文本
 */
export const getMetrics = (): Promise<string> => registry.metrics();

/**
 * 获取 Content-Type（Prometheus exposition format）
 */
export const getMetricsContentType = (): string => registry.contentType;
