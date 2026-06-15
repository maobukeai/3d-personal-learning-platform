import { ref, isRef, type Ref } from 'vue';
import api from '@/utils/api';

export interface UsePagedListOptions<T, R> {
  initialPageSize?: number;
  listExtractor?: (res: R) => T[];
  totalExtractor?: (res: R) => number;
  hasMoreExtractor?: (res: R) => boolean;
  onBeforeFetch?: () => void;
  onAfterFetch?: (res: R) => void;
  onError?: (err: any) => void;
}

export function usePagedList<T = any, R = any>(
  endpoint: string | Ref<string> | (() => string),
  paramsRef?: Ref<Record<string, any>> | (() => Record<string, any>) | Record<string, any>,
  options: UsePagedListOptions<T, R> = {},
) {
  const {
    initialPageSize = 10,
    listExtractor = (res: any) => (Array.isArray(res) ? res : res.items || []),
    totalExtractor = (res: any) => {
      if (Array.isArray(res)) return res.length;
      return res.total ?? res.pagination?.total ?? 0;
    },
    hasMoreExtractor = (res: any) => {
      if (res && typeof res === 'object') {
        return res.hasMore ?? res.pagination?.hasMore ?? false;
      }
      return false;
    },
    onBeforeFetch,
    onAfterFetch,
    onError,
  } = options;

  const data = ref<T[]>([]) as Ref<T[]>;
  const loading = ref(false);
  const loadingMore = ref(false);
  const error = ref<any>(null);

  const page = ref(1);
  const pageSize = ref(initialPageSize);
  const total = ref(0);
  const hasMore = ref(false);

  const getEndpoint = () => {
    if (typeof endpoint === 'function') return endpoint();
    if (isRef(endpoint)) return endpoint.value;
    return endpoint;
  };

  const getParams = () => {
    if (typeof paramsRef === 'function') return paramsRef();
    if (isRef(paramsRef)) return paramsRef.value;
    return paramsRef || {};
  };

  const fetchData = async (append = false) => {
    if (append) {
      loadingMore.value = true;
    } else {
      loading.value = true;
    }
    error.value = null;

    const nextPage = append ? page.value + 1 : 1;
    if (onBeforeFetch) onBeforeFetch();

    try {
      const requestParams = {
        page: nextPage,
        limit: pageSize.value,
        ...getParams(),
      };

      const currentEndpoint = getEndpoint();
      const response = await api.get(currentEndpoint, { params: requestParams });
      const responseData = response.data;

      const items = listExtractor(responseData);
      data.value = append ? [...data.value, ...items] : items;

      page.value = responseData.meta?.page ?? responseData.pagination?.page ?? nextPage;
      total.value = totalExtractor(responseData);
      hasMore.value = hasMoreExtractor(responseData) || data.value.length < total.value;

      if (onAfterFetch) onAfterFetch(responseData);
    } catch (err) {
      error.value = err;
      if (onError) onError(err);
    } finally {
      loading.value = false;
      loadingMore.value = false;
    }
  };

  const refresh = async () => {
    page.value = 1;
    await fetchData(false);
  };

  return {
    data,
    loading,
    loadingMore,
    error,
    page,
    pageSize,
    total,
    hasMore,
    fetchData,
    refresh,
  };
}
