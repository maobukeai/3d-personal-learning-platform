import { ref, type Ref } from 'vue';
export type AsyncStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error';
export interface UseAsyncStateOptions {
  immediate?: boolean;
  loadingDelay?: number;
} /** * Manages the lifecycle of an async request that resolves to a list. * * - `execute()` runs the provided function and transitions status: * loading -> success | empty | error * - An empty result array sets status to `'empty'`. * - `retry()` re-runs `execute`. * - `reset()` returns to idle with cleared data/error. */
export function useAsyncState<T>(fn: () => Promise<T[]>, options?: UseAsyncStateOptions) {
  const status = ref<AsyncStatus>('idle');
  const data = ref<T[]>([]) as Ref<T[]>;
  const error = ref<string | null>(null);
  const execute = async () => {
    status.value = 'loading';
    error.value = null;
    try {
      const result = await fn();
      data.value = result;
      status.value = result.length === 0 ? 'empty' : 'success';
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err);
      status.value = 'error';
    }
  };
  const retry = () => execute();
  const reset = () => {
    status.value = 'idle';
    data.value = [];
    error.value = null;
  };
  if (options?.immediate) {
    execute();
  }
  return { status, data, error, execute, retry, reset };
}
