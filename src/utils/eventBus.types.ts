/**
 * 应用级事件总线契约 —— 铁律一·3 多维沙箱隔离
 *
 * 所有 3D 引擎 → 2D UI 的通信必须通过此契约类型化的事件总线，
 * 禁止通过 window 全局对象传递未隔离的状态。
 */
import type { Vector3 } from 'three';
import type { ModelHotspot, HotspotWithScreenPosition } from '@/utils/3d/HotspotEventBus';

/** 3D 模型统计信息 */
export interface ModelStats {
  vertices: number;
  triangles: number;
  textures: number;
  materials: number;
  animations: number;
  size: string;
}

/** VRAM 更新事件 payload */
export interface VramUpdatePayload {
  /** 已使用显存（字节） */ usedBytes: number;
  /** 红线阈值（字节） */ maxBytes: number;
  /** 已使用显存（MB） */ usedMB: number;
}

/** 截图捕获 payload */
export interface ScreenshotCapturedPayload {
  blob: Blob;
  download: boolean;
}

/** 应用级事件契约 */
export type AppEvents = {
  // ===== 3D 引擎事件 =====
  /** 3D 引擎初始化完成 */ '3d:initialized': { workerMode: boolean };
  /** 模型加载进度 */ '3d:loading-progress': { progress: number; loaded: number; total: number };
  /** 模型加载完成 */ '3d:model-loaded': { stats: ModelStats; animations: unknown[] };
  /** FPS 更新 */ '3d:fps-update': { fps: number };
  /** VRAM 使用量更新 */ '3d:vram-update': VramUpdatePayload;
  /** 热点屏幕位置更新 */ '3d:hotspots-update': HotspotWithScreenPosition[];
  /** 截图已捕获 */ '3d:screenshot-captured': ScreenshotCapturedPayload;
  /** 热点已添加 */ '3d:hotspot-added': { hotspot: ModelHotspot; worldPos: Vector3 };
  /** 3D 引擎错误 */ '3d:error': { message: string; stack?: string };
  /** 3D 引擎已释放 */ '3d:disposed': void;

  // ===== 系统级事件 =====
  /** 磨砂玻璃降级（FPS<45 持续 3 秒） */ 'system:glass-degraded': { fps: number };
  /** 磨砂玻璃恢复 */ 'system:glass-restored': { fps: number };

  // ===== 性能监控事件 =====
  /** 长任务告警（duration> 16.7ms） */ 'performance:long-task': {
    duration: number;
    startTime: number;
    name: string;
  };

  // ===== 编辑器事件 =====
  /** 笔记已保存 */ 'editor:note-saved': { noteId: string };

  // 索引签名：满足 mitt 3.x 的 Record<EventType, unknown> 约束
  [key: string]: any;
};
