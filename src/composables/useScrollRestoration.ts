import {
  ref,
  watch,
  onMounted,
  onActivated,
  onDeactivated,
  onBeforeUnmount,
  getCurrentInstance,
  nextTick,
  type Ref,
} from 'vue';
import { onBeforeRouteLeave } from 'vue-router';

// In-memory cache for fast tab-switching restoration
const scrollMemoryCache = new Map<string, number>();
const STORAGE_PREFIX = 'app_scroll_pos_';

export interface UseScrollRestorationOptions {
  /** Optional custom storage key prefix or dynamic getter */
  key?: string | (() => string);
  /** Debounce wait in ms for recording scroll */
  debounceMs?: number;
  /** Whether to persist in sessionStorage (default: true) */
  persistSession?: boolean;
}

/**
 * Composable to record and restore scroll positions of custom scroll containers
 * (e.g. overflow-y-auto elements within the application).
 */
export function useScrollRestoration(
  containerRef: Ref<HTMLElement | null | undefined>,
  options: UseScrollRestorationOptions = {},
) {
  const { debounceMs = 50, persistSession = true } = options;

  const currentScrollTop = ref(0);
  let scrollTimeout: any = null;

  function resolveKey(): string {
    if (typeof options.key === 'function') {
      return options.key();
    }
    if (typeof options.key === 'string') {
      return options.key;
    }
    return typeof window !== 'undefined' ? window.location.pathname : 'default_view';
  }

  function getSavedScroll(): number {
    const key = resolveKey();
    if (scrollMemoryCache.has(key)) {
      return scrollMemoryCache.get(key) || 0;
    }
    if (persistSession && typeof sessionStorage !== 'undefined') {
      try {
        const val = sessionStorage.getItem(STORAGE_PREFIX + key);
        if (val) return parseInt(val, 10) || 0;
      } catch {
        // Ignore storage errors
      }
    }
    return 0;
  }

  function saveScroll(top?: number) {
    const el = containerRef.value;
    const scrollVal = typeof top === 'number' ? top : (el?.scrollTop ?? 0);
    currentScrollTop.value = scrollVal;

    const key = resolveKey();
    scrollMemoryCache.set(key, scrollVal);

    if (persistSession && typeof sessionStorage !== 'undefined') {
      try {
        sessionStorage.setItem(STORAGE_PREFIX + key, scrollVal.toString());
      } catch {
        // Ignore storage quota errors
      }
    }
  }

  function onScroll() {
    if (scrollTimeout) clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      if (containerRef.value) {
        saveScroll(containerRef.value.scrollTop);
      }
    }, debounceMs);
  }

  /**
   * Restores the container scroll position.
   * Call this after data has finished rendering in the DOM.
   */
  async function restoreScroll(behavior: ScrollBehavior = 'instant') {
    await nextTick();
    const targetY = getSavedScroll();
    if (targetY <= 0) return;

    const el = containerRef.value;
    if (el) {
      el.scrollTo({ top: targetY, behavior });
    }

    // Secondary pass in case cards rendered slightly asynchronously
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => {
        if (containerRef.value && Math.abs(containerRef.value.scrollTop - targetY) > 5) {
          containerRef.value.scrollTo({ top: targetY, behavior });
        }
      });
    }
  }

  function clearSavedScroll(targetKey?: string) {
    const key = targetKey || resolveKey();
    scrollMemoryCache.delete(key);
    if (persistSession && typeof sessionStorage !== 'undefined') {
      try {
        sessionStorage.removeItem(STORAGE_PREFIX + key);
      } catch {
        // Ignore
      }
    }
  }

  function attachScrollListener() {
    const el = containerRef.value;
    if (el) {
      el.removeEventListener('scroll', onScroll);
      el.addEventListener('scroll', onScroll, { passive: true });
    }
  }

  function detachScrollListener() {
    const el = containerRef.value;
    if (el) {
      el.removeEventListener('scroll', onScroll);
    }
    if (scrollTimeout) clearTimeout(scrollTimeout);
  }

  watch(
    () => containerRef.value,
    (newEl, oldEl) => {
      if (oldEl) oldEl.removeEventListener('scroll', onScroll);
      if (newEl) attachScrollListener();
    },
  );

  const instance = getCurrentInstance();
  if (instance) {
    onMounted(() => {
      attachScrollListener();
    });

    onActivated(() => {
      attachScrollListener();
      restoreScroll();
    });

    onDeactivated(() => {
      saveScroll();
      detachScrollListener();
    });

    onBeforeUnmount(() => {
      saveScroll();
      detachScrollListener();
    });

    try {
      onBeforeRouteLeave(() => {
        saveScroll();
      });
    } catch {
      // Ignore if outside vue-router scope
    }
  }

  return {
    currentScrollTop,
    saveScroll,
    restoreScroll,
    getSavedScroll,
    clearSavedScroll,
  };
}
