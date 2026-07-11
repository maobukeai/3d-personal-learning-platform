import { appEventBus } from './eventBus';

/* P-7.1：主线程长任务监控
   监控超过 50ms 的长任务，当长任务持续时间超过 16.7ms（60FPS帧预算）时记录 */
export function initLongTaskObserver(): void {
  if (typeof PerformanceObserver === 'undefined') return;
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        /* LongTask 阈值 50ms，但我们对 > 16.7ms 的情况都关注 */
        if (entry.duration > 16.7) {
          appEventBus.emit('performance:long-task', {
            duration: entry.duration,
            startTime: entry.startTime,
            name: entry.name,
          });
        }
      }
    });
    observer.observe({ entryTypes: ['longtask'] });
  } catch (e) {
    /* PerformanceObserver 不支持 longtask 时静默降级 */
    console.warn('[PerformanceObserver] longtask 监控不可用:', e);
  }
}
