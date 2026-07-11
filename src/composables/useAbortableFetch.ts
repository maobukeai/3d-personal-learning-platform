import { ref, onBeforeUnmount } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';

/**
 * Manages an AbortController for route-switched requests.
 *
 * - `createSignal()` aborts any in-flight request and returns a fresh signal
 *   for the next fetch. Pass it to the adapter/API call so stale responses are
 *   cancelled at the network level.
 * - Aborts automatically on route leave and on component unmount, preventing
 *   old responses from overwriting newer state.
 */
export function useAbortableFetch() {
  const controller = ref<AbortController | null>(null);

  function createSignal(): AbortSignal {
    controller.value?.abort();
    controller.value = new AbortController();
    return controller.value.signal;
  }

  function abort() {
    controller.value?.abort();
    controller.value = null;
  }

  // Abort on route leave
  onBeforeRouteLeave(() => {
    abort();
  });

  // Abort on unmount
  onBeforeUnmount(() => {
    abort();
  });

  return { createSignal, abort };
}

/**
 * P-6.4: Debounced + abortable signal creator for high-frequency inputs
 * (search boxes, filter dropdowns, live suggestions).
 *
 * - Each call to `schedule(callback)` immediately aborts any in-flight request
 *   and resets the debounce timer. After `delay` ms of silence, a fresh
 *   AbortSignal is created and passed to `callback`.
 * - This prevents stale requests from completing and overwriting newer state,
 *   and reduces server load by only firing the last keystroke.
 * - Aborts automatically on route leave and component unmount.
 *
 * Usage:
 * ```ts
 * const { schedule, abort } = useDebouncedSignal(250);
 * watch(searchQuery, () => {
 *   schedule((signal) => fetchData(signal));
 * });
 * ```
 */
export function useDebouncedSignal(delay = 250) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const controller = ref<AbortController | null>(null);

  function abort() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    controller.value?.abort();
    controller.value = null;
  }

  function schedule(callback: (signal: AbortSignal) => void): void {
    // Abort any in-flight request immediately (don't wait for debounce)
    controller.value?.abort();
    // Clear any pending debounce timer
    if (timer) clearTimeout(timer);
    // Schedule a fresh signal + callback after the debounce window
    timer = setTimeout(() => {
      timer = null;
      controller.value = new AbortController();
      callback(controller.value.signal);
    }, delay);
  }

  onBeforeRouteLeave(() => {
    abort();
  });

  onBeforeUnmount(() => {
    abort();
  });

  return { schedule, abort };
}

/**
 * P-6.4: Request version guard — prevents stale async responses from
 * overwriting newer state.
 *
 * Each call to `next()` returns a monotonically increasing version number.
 * After an async operation completes, check `isCurrent(version)` — if false,
 * a newer request has been issued and the response should be discarded.
 *
 * This guards against race conditions where:
 * - Socket updates trigger a re-fetch while a previous fetch is still in-flight
 * - Rapid filter changes cause overlapping requests
 * - Route navigation triggers a fetch before the previous view's fetch resolves
 *
 * Usage:
 * ```ts
 * const { next, isCurrent } = useRequestGuard();
 * async function fetch() {
 *   const v = next();
 *   const result = await api.get('/data', { signal });
 *   if (!isCurrent(v)) return; // stale — a newer request superseded this one
 *   state.value = result;
 * }
 * ```
 */
export function useRequestGuard() {
  let version = 0;

  function next(): number {
    return ++version;
  }

  function isCurrent(v: number): boolean {
    return v === version;
  }

  function reset(): void {
    version = 0;
  }

  return { next, isCurrent, reset };
}
