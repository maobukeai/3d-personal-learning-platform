/**
 * P-6.3：Real User Monitoring (RUM) 收集器
 *
 * 采集指标：
 * - Web Vitals: LCP / INP / CLS
 * - 长任务 (>50ms，复用 performanceObserver 事件总线)
 * - 路由导航耗时
 * - API 请求 p50/p95/p99 (通过 axios 拦截器)
 * - 3D 首帧时间 (mark3DFirstFrame)
 * - 上传完成时间 (markUploadComplete)
 * - 错误与错误率
 *
 * 分组维度：路由 + 设备档位 (mobile/tablet/desktop)
 * 上报方式：sendBeacon 非阻塞投递，30 秒或页面隐藏时批量 flush
 * 端点配置：VITE_RUM_ENDPOINT 环境变量，默认 /api/rum
 */
import type { AxiosInstance } from 'axios';
import type { Router } from 'vue-router';
import { appEventBus } from './eventBus';

type DeviceTier = 'mobile' | 'tablet' | 'desktop';
type MetricType =
  | 'lcp'
  | 'inp'
  | 'cls'
  | 'longtask'
  | 'navigation'
  | 'api'
  | 'api-percentiles'
  | '3d-first-frame'
  | 'upload'
  | 'error';

interface RumMetric {
  type: MetricType;
  value: number;
  route: string;
  deviceTier: DeviceTier;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

const FLUSH_INTERVAL_MS = 30000;
const MAX_BUFFER_SIZE = 500;

class RumCollector {
  private buffer: RumMetric[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private endpoint: string;
  private currentRoute = '';
  private apiTimings: number[] = [];
  private sessionId = '';
  private observers: PerformanceObserver[] = [];
  private initialized = false;
  private navStartTime = 0;
  private clsValue = 0;
  private lcpValue = 0;
  private inpWorst = 0;
  private wrappedInstances = new WeakSet<AxiosInstance>();

  constructor() {
    this.endpoint = import.meta.env.VITE_RUM_ENDPOINT || '/api/rum';
  }

  /**
   * 初始化 RUM 收集器。应在 app.mount 之后调用，避免阻塞渲染。
   */
  init(router?: Router): void {
    if (this.initialized || typeof window === 'undefined') return;
    this.initialized = true;
    this.sessionId = this.getOrCreateSessionId();

    // Web Vitals 观察者
    this.observeLCP();
    this.observeINP();
    this.observeCLS();

    /* 长任务 —— 复用 performanceObserver.ts 已注册的 PerformanceObserver */
    appEventBus.on('performance:long-task', (e) => {
      const event = e as { duration: number; startTime: number; name: string };
      this.record('longtask', event.duration, { startTime: event.startTime });
    });

    // 全局错误捕获
    window.addEventListener('error', (e) => {
      this.record('error', 1, {
        message: e.message,
        filename: e.filename,
        lineno: e.lineno,
        colno: e.colno,
      });
    });

    window.addEventListener('unhandledrejection', (e) => {
      this.record('error', 1, {
        reason: e.reason instanceof Error ? e.reason.message : String(e.reason),
      });
    });

    // 路由导航耗时
    if (router) {
      router.beforeEach((to) => {
        this.navStartTime = performance.now();
        this.currentRoute = to.path;
      });
      router.afterEach(() => {
        if (this.navStartTime > 0) {
          const duration = performance.now() - this.navStartTime;
          this.record('navigation', duration);
        }
      });
    }

    // 定时 flush
    this.flushTimer = setInterval(() => this.flush(), FLUSH_INTERVAL_MS);

    // 页面隐藏 / 关闭时 flush
    window.addEventListener('pagehide', () => this.flush());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.flush();
    });
  }

  /**
   * 为 axios 实例添加请求/响应拦截器，自动采集 API 耗时。
   */
  wrapAxios(instance: AxiosInstance): void {
    if (this.wrappedInstances.has(instance)) return;
    this.wrappedInstances.add(instance);
    const timings = new WeakMap<object, number>();

    instance.interceptors.request.use((config) => {
      timings.set(config, performance.now());
      return config;
    });

    instance.interceptors.response.use(
      (response) => {
        const start = timings.get(response.config);
        if (start !== undefined) {
          const duration = performance.now() - start;
          this.apiTimings.push(duration);
          this.record('api', duration, {
            url: response.config.url,
            method: response.config.method,
            status: response.status,
          });
        }
        return response;
      },
      (error) => {
        const config = error?.config;
        const start = config ? timings.get(config) : undefined;
        if (start !== undefined) {
          const duration = performance.now() - start;
          this.apiTimings.push(duration);
          this.record('api', duration, {
            url: config?.url,
            method: config?.method,
            status: error?.response?.status || 0,
            error: true,
          });
        }
        return Promise.reject(error);
      },
    );
  }

  /**
   * 标记 3D Viewer 首帧渲染完成。在 3D 引擎渲染第一帧后调用。
   */
  mark3DFirstFrame(): void {
    if (!this.initialized) return;
    this.record('3d-first-frame', performance.now());
  }

  /**
   * 标记上传完成。传入上传耗时 (毫秒)。
   */
  markUploadComplete(durationMs: number, metadata?: Record<string, unknown>): void {
    this.record('upload', durationMs, metadata);
  }

  /**
   * 手动触发 flush（主要用于测试）。
   */
  flushNow(): void {
    this.flush();
  }

  /**
   * 销毁收集器，清理资源。
   */
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.observers.forEach((o) => {
      try {
        o.disconnect();
      } catch {
        // already disconnected
      }
    });
    this.observers = [];
    this.initialized = false;
  }

  // ===== 内部方法 =====
  private record(type: MetricType, value: number, metadata?: Record<string, unknown>): void {
    if (!this.initialized) return;
    this.buffer.push({
      type,
      value,
      route: this.currentRoute,
      deviceTier: this.getDeviceTier(),
      timestamp: Date.now(),
      metadata,
    });

    if (this.buffer.length > MAX_BUFFER_SIZE) {
      this.buffer.splice(0, this.buffer.length - MAX_BUFFER_SIZE);
    }
  }

  private observeLCP(): void {
    if (typeof PerformanceObserver === 'undefined') return;
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        if (entries.length > 0) {
          this.lcpValue = entries[entries.length - 1].startTime;
        }
      });
      observer.observe({ type: 'largest-contentful-paint', buffered: true });
      this.observers.push(observer);
    } catch {
      // 浏览器不支持 largest-contentful-paint
    }
  }

  private observeINP(): void {
    if (typeof PerformanceObserver === 'undefined') return;
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > this.inpWorst) {
            this.inpWorst = entry.duration;
          }
        }
      });
      observer.observe({ type: 'event', buffered: true });
      this.observers.push(observer);
    } catch {
      // 浏览器不支持 event
    }
  }

  private observeCLS(): void {
    if (typeof PerformanceObserver === 'undefined') return;
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const lsEntry = entry as PerformanceEntry & { value?: number; hadRecentInput?: boolean };
          if (typeof lsEntry.value === 'number' && !lsEntry.hadRecentInput) {
            this.clsValue += lsEntry.value;
          }
        }
      });
      observer.observe({ type: 'layout-shift', buffered: true });
      this.observers.push(observer);
    } catch {
      // 浏览器不支持 layout-shift
    }
  }

  private getDeviceTier(): DeviceTier {
    const ua = navigator.userAgent;
    if (/iPad|Tablet/i.test(ua)) return 'tablet';
    if (/Mobile|Android|iPhone|iPod/i.test(ua)) return 'mobile';
    return 'desktop';
  }

  private getOrCreateSessionId(): string {
    try {
      const key = 'rum-session';
      let id = sessionStorage.getItem(key);
      if (!id) {
        id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        sessionStorage.setItem(key, id);
      }
      return id;
    } catch {
      return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }
  }

  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const idx = Math.min(Math.floor(sorted.length * p), sorted.length - 1);
    return Math.round(sorted[idx]);
  }

  private flush(): void {
    if (!this.initialized || this.buffer.length === 0) return;

    if (this.lcpValue > 0) {
      this.record('lcp', Math.round(this.lcpValue));
      this.lcpValue = 0;
    }
    if (this.inpWorst > 0) {
      this.record('inp', Math.round(this.inpWorst));
      this.inpWorst = 0;
    }
    if (this.clsValue > 0) {
      this.record('cls', Number(this.clsValue.toFixed(4)));
      this.clsValue = 0;
    }

    if (this.apiTimings.length > 0) {
      const sorted = [...this.apiTimings].sort((a, b) => a - b);
      this.record('api-percentiles', 0, {
        p50: this.percentile(sorted, 0.5),
        p95: this.percentile(sorted, 0.95),
        p99: this.percentile(sorted, 0.99),
        count: sorted.length,
      });
      this.apiTimings = [];
    }

    const metrics = this.buffer.splice(0);
    const payload = {
      sessionId: this.sessionId,
      url: typeof location !== 'undefined' ? location.href : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      timestamp: Date.now(),
      metrics,
    };

    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });

    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      try {
        if (navigator.sendBeacon(this.endpoint, blob)) return;
      } catch {
        // ignore
      }
    }

    try {
      fetch(this.endpoint, {
        method: 'POST',
        body: blob,
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
      }).catch(() => {
        // ignore
      });
    } catch {
      // ignore
    }
  }
}

export const rum = new RumCollector();
export function initRum(router?: Router): void {
  rum.init(router);
}
export function wrapAxiosWithRum(instance: AxiosInstance): void {
  rum.wrapAxios(instance);
}
export function mark3DFirstFrame(): void {
  rum.mark3DFirstFrame();
}
export function markUploadComplete(durationMs: number, metadata?: Record<string, unknown>): void {
  rum.markUploadComplete(durationMs, metadata);
}
