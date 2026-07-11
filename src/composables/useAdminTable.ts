import { ref, computed, watch, onBeforeUnmount, type Ref, type ComputedRef } from 'vue';
import { useAbortableFetch } from './useAbortableFetch';
import type { AdminFetchParams, AdminTableAdapter } from '@/components/admin/types';

export type AdminStatus = 'idle' | 'loading' | 'empty' | 'success' | 'error';

export interface UseAdminTableOptions {
  pageSize?: number;
  immediate?: boolean;
  initial?: {
    page?: number;
    search?: string;
    sort?: string;
    order?: 'asc' | 'desc';
    filters?: Record<string, unknown>;
  };
}

export function useAdminTable<T = any>(
  adapter: AdminTableAdapter<T>,
  options?: UseAdminTableOptions,
) {
  const rowKeyField = adapter.rowKey ?? 'id';
  const pageSize = ref(options?.pageSize ?? adapter.pageSize ?? 20);
  const immediate = options?.immediate ?? true;
  const status = ref<AdminStatus>('idle');
  const items = ref<T[]>([]) as Ref<T[]>;
  const total = ref(0);
  const page = ref<number>(options?.initial?.page ?? 1);
  const search = ref<string>(options?.initial?.search ?? '');
  const sort = ref<string>(options?.initial?.sort ?? adapter.defaultSort ?? '');
  const order = ref<'asc' | 'desc'>(options?.initial?.order ?? 'desc');
  const filters = ref<Record<string, unknown>>(
    options?.initial?.filters ? { ...options.initial.filters } : {},
  );
  const selectedIds = ref<Set<string | number>>(new Set());
  const error = ref<string | null>(null);

  const loading = computed<boolean>(() => status.value === 'loading');

  const rowIdOf = (row: T): string | number => {
    const v = (row as unknown as Record<string, unknown>)[rowKeyField];
    return (v === undefined || v === null ? '' : v) as string | number;
  };

  const selectedItems = computed<T[]>(() =>
    items.value.filter((item) => selectedIds.value.has(rowIdOf(item))),
  ) as ComputedRef<T[]>;

  let requestId = 0;
  const { createSignal } = useAbortableFetch();

  const fetch = async () => {
    status.value = 'loading';
    error.value = null;
    const currentId = ++requestId;
    const signal = createSignal();

    try {
      const params: AdminFetchParams = {
        page: page.value,
        pageSize: pageSize.value,
        sort: sort.value || undefined,
        order: order.value,
        filters: { ...filters.value },
        search: search.value.trim() || undefined,
        signal,
      };
      const result = await adapter.fetch(params);
      if (currentId !== requestId) return; // a newer request superseded this one
      if (signal.aborted) return; // request was aborted (route switch / unmount)

      items.value = result.items;
      total.value = result.total;
      status.value = result.items.length === 0 ? 'empty' : 'success';
    } catch (err) {
      if (currentId !== requestId) return;
      if (signal.aborted) return; // request was aborted — don't surface as error

      error.value = err instanceof Error ? err.message : String(err);
      status.value = 'error';
    }
  };

  const retry = () => {
    fetch();
  };

  const toggleSelection = (id: string | number) => {
    const next = new Set(selectedIds.value);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    selectedIds.value = next;
  };

  const selectAll = () => {
    selectedIds.value = new Set(items.value.map((item) => rowIdOf(item)));
  };

  const clearSelection = () => {
    selectedIds.value = new Set();
  };

  const deleteSelected = async () => {
    if (!adapter.delete) return;
    const ids = Array.from(selectedIds.value);
    if (ids.length === 0) return;
    await adapter.delete(ids);
    clearSelection();
    await fetch();
  };

  const resetFilters = () => {
    filters.value = {};
    search.value = '';
    if (page.value !== 1) {
      page.value = 1;
    }
  };

  // Changing search/sort/order/filters resets to page 1 and fetches. To avoid a
  // double fetch (the page watcher would also fire when page moves 1←N), we
  // suppress the immediately-following page-watcher invocation.
  let skipNextPageFetch = false;
  const resetPageAndFetch = () => {
    if (page.value !== 1) {
      skipNextPageFetch = true;
      page.value = 1;
    }
    fetch();
  };

  watch(page, () => {
    if (skipNextPageFetch) {
      skipNextPageFetch = false;
      return;
    }
    fetch();
  });

  watch(filters, resetPageAndFetch, { deep: true });
  watch(sort, resetPageAndFetch);
  watch(order, resetPageAndFetch);

  let searchTimer: ReturnType<typeof setTimeout> | null = null;
  watch(search, () => {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      resetPageAndFetch();
    }, 250);
  });

  onBeforeUnmount(() => {
    if (searchTimer) clearTimeout(searchTimer);
  });

  if (immediate) {
    fetch();
  }

  return {
    status,
    items,
    total,
    page,
    pageSize,
    search,
    filters,
    sort,
    order,
    selectedIds,
    selectedItems,
    loading,
    error,
    fetch,
    retry,
    toggleSelection,
    selectAll,
    clearSelection,
    deleteSelected,
    resetFilters,
  };
}
