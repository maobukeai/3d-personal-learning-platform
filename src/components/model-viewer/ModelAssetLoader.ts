import { ref, shallowRef } from 'vue';
import { useSystemStore } from '@/stores/system';
import { appEventBus } from '@/utils/eventBus';

export interface ModelStats {
  vertices: number;
  faces: number;
  materials: number;
  animations: number;
  dimensions: string;
  maxTextureRes: number;
  drawCalls: number;
}

export type ViewMode = 'solid' | 'wireframe' | 'solid+wireframe';

export const DEFAULT_STATS: ModelStats = {
  vertices: 0,
  faces: 0,
  materials: 0,
  animations: 0,
  dimensions: '',
  maxTextureRes: 0,
  drawCalls: 0,
};

/**
 * Shared reactive state for model loading, stats, FPS monitoring, and load-abort
 * coordination. Used by both worker-mode and fallback-mode renderers so that
 * ModelViewer.vue can present a single unified reactive surface regardless of
 * which backend is active.
 */
export function useModelAssetLoader() {
  const isLoading = ref(false);
  const loadingProgress = ref(0);
  const error = ref<string | null>(null);
  const modelFormat = ref('');

  // shallowRef: replaced wholesale (not mutated field-by-field) — avoids deep
  // reactivity overhead on the stats object.
  const stats = shallowRef<ModelStats>({ ...DEFAULT_STATS });
  const animations = shallowRef<string[]>([]);
  const currentAnimation = ref(-1);
  const isPaused = ref(false);
  const isClayMode = ref(false);

  // --- Load-abort coordination ---
  // Mirrors the activeLoadId pattern from ModelLoader.ts. Incremented to cancel
  // any in-flight load; stale callbacks compare their captured loadId against
  // the current value.
  let activeLoadId = 0;
  const nextLoadId = () => ++activeLoadId;
  const isStaleLoad = (loadId: number) => loadId !== activeLoadId;
  const abortLoads = () => {
    activeLoadId++;
  };

  // --- FPS / glass-degradation monitoring ---
  const systemStore = useSystemStore();
  let lastFpsTime = performance.now();
  let frames = 0;
  let lowFpsSeconds = 0;
  let highFpsSeconds = 0;

  const handleFpsUpdate = (fps: number) => {
    if (isLoading.value || document.hidden) {
      lowFpsSeconds = 0;
      highFpsSeconds = 0;
      return;
    }
    if (fps < 45) {
      lowFpsSeconds++;
      highFpsSeconds = 0;
      if (lowFpsSeconds >= 3 && !systemStore.isGlassDegraded) {
        systemStore.isGlassDegraded = true;
        appEventBus.emit('system:glass-degraded', { fps });
      }
    } else if (fps >= 55) {
      highFpsSeconds++;
      lowFpsSeconds = 0;
      if (highFpsSeconds >= 3 && systemStore.isGlassDegraded) {
        systemStore.isGlassDegraded = false;
        appEventBus.emit('system:glass-restored', { fps });
      }
    } else {
      // 45-55 is a buffer zone — no state change
      lowFpsSeconds = Math.max(0, lowFpsSeconds - 1);
      highFpsSeconds = Math.max(0, highFpsSeconds - 1);
    }
  };

  /**
   * Called from the render-loop tick. Returns the computed FPS when a 1-second
   * sampling window elapses, or null otherwise. Discards samples on large
   * delays (>2s) to avoid false low-FPS readings after tab switches.
   */
  const tickFps = (time: number): number | null => {
    frames++;
    if (time - lastFpsTime > 2000) {
      // Large delay — discard and reset window
      frames = 0;
      lastFpsTime = time;
      return null;
    }
    if (time - lastFpsTime >= 1000) {
      const fps = (frames * 1000) / (time - lastFpsTime);
      frames = 0;
      lastFpsTime = time;
      return fps;
    }
    return null;
  };

  const resetFpsTimers = () => {
    lastFpsTime = performance.now();
    frames = 0;
    lowFpsSeconds = 0;
    highFpsSeconds = 0;
  };

  const getModelExtension = (url: string): string => {
    const urlWithoutQuery = url.split('?')[0];
    return urlWithoutQuery.substring(urlWithoutQuery.lastIndexOf('.')).toLowerCase();
  };

  const resetState = () => {
    isLoading.value = false;
    loadingProgress.value = 0;
    error.value = null;
    modelFormat.value = '';
    stats.value = { ...DEFAULT_STATS };
    animations.value = [];
    currentAnimation.value = -1;
    isPaused.value = false;
    isClayMode.value = false;
  };

  return {
    // Reactive state
    isLoading,
    loadingProgress,
    error,
    modelFormat,
    stats,
    animations,
    currentAnimation,
    isPaused,
    isClayMode,
    // Load-abort coordination
    nextLoadId,
    isStaleLoad,
    abortLoads,
    // FPS monitoring
    handleFpsUpdate,
    tickFps,
    resetFpsTimers,
    // Utilities
    getModelExtension,
    resetState,
  };
}

export type ModelAssetLoader = ReturnType<typeof useModelAssetLoader>;
