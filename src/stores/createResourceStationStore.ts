import { defineStore } from 'pinia';
import { ref } from 'vue';
import api from '@/utils/api';
import { logError } from '@/utils/error';

/**
 * Shared query params used by both manual stations and mirror sources.
 */
type ResourceQueryParams = {
  page: number;
  pageSize: number;
  categoryId?: string;
  search?: string;
  sort?: string;
};

/**
 * Options for creating a resource-station-style Pinia store.
 * Both `manual` and `mirror` stores share the exact same state shape,
 * actions and API call patterns — only the API base path and entity
 * naming differ. This factory eliminates ~200 lines of duplication.
 */
export interface CreateResourceStationStoreOptions {
  /** Unique Pinia store id, e.g. 'manual' or 'mirror'. */
  storeId: string;
  /** API base path, e.g. '/api/manual' or '/api/mirror'. */
  apiBaseUrl: string;
  /** Entity name used in API paths, e.g. 'stations' or 'sources'. */
  entitiesPath: string;
  /** Human-readable label used in error logs, e.g. 'manual stations'. */
  label: string;
  /** Default page size for resource listing. */
  defaultPageSize?: number;
}

/**
 * Creates a resource-station-style store that manages a list of stations/sources,
 * a current entity, categories, paginated resources, and search/filter/sort state.
 *
 * The returned store is untyped with respect to the concrete entity shape;
 * callers should wrap it with their own typed interface (manual.ts / mirror.ts
 * re-export typed aliases for their specific entity types).
 */
export function createResourceStationStore<TStation, TCategory, TResource>(
  options: CreateResourceStationStoreOptions,
) {
  const { apiBaseUrl, entitiesPath, label, defaultPageSize = 21 } = options;

  return defineStore(options.storeId, () => {
    const stations = ref<TStation[]>([]);
    const currentStation = ref<TStation | null>(null);
    const categories = ref<TCategory[]>([]);
    const resources = ref<TResource[]>([]);
    const totalResources = ref(0);
    const totalPages = ref(0);
    const currentPage = ref(1);
    const isLoadingStations = ref(false);
    const isLoadingResources = ref(false);
    const isLoadingCategories = ref(false);
    const searchQuery = ref('');
    const activeCategoryId = ref<string | null>(null);
    const sortBy = ref('newest');

    async function fetchStations() {
      isLoadingStations.value = true;
      try {
        const res = await api.get(`${apiBaseUrl}/${entitiesPath}`);
        stations.value = res.data;
      } catch (e) {
        logError(e, {
          operation: 'resourceStation.fetchStations',
          stationType: label,
          component: 'createResourceStationStore',
        });
        stations.value = [];
      } finally {
        isLoadingStations.value = false;
      }
    }

    async function fetchStation(stationId: string) {
      try {
        const res = await api.get(`${apiBaseUrl}/${entitiesPath}/${stationId}`);
        currentStation.value = res.data;
      } catch (e) {
        logError(e, {
          operation: 'resourceStation.fetchStation',
          stationType: label,
          component: 'createResourceStationStore',
        });
        currentStation.value = null;
      }
    }

    async function fetchCategories(stationId: string) {
      isLoadingCategories.value = true;
      try {
        const res = await api.get(`${apiBaseUrl}/${entitiesPath}/${stationId}/categories`);
        categories.value = res.data;
      } catch (e) {
        logError(e, {
          operation: 'resourceStation.fetchCategories',
          stationType: label,
          component: 'createResourceStationStore',
        });
        categories.value = [];
      } finally {
        isLoadingCategories.value = false;
      }
    }

    async function fetchResources(
      stationId: string,
      opts?: {
        page?: number;
        categoryId?: string;
        search?: string;
        sort?: string;
        pageSize?: number;
      },
    ) {
      isLoadingResources.value = true;
      try {
        const params: ResourceQueryParams = {
          page: opts?.page || 1,
          pageSize: opts?.pageSize || defaultPageSize,
        };
        if (opts?.categoryId) params.categoryId = opts.categoryId;
        if (opts?.search) params.search = opts.search;
        if (opts?.sort) params.sort = opts.sort;

        const res = await api.get(`${apiBaseUrl}/${entitiesPath}/${stationId}/resources`, {
          params,
        });
        resources.value = res.data.resources;
        totalResources.value = res.data.total;
        totalPages.value = res.data.totalPages;
        currentPage.value = res.data.page;
      } catch (e) {
        logError(e, {
          operation: 'resourceStation.fetchResources',
          stationType: label,
          component: 'createResourceStationStore',
        });
        resources.value = [];
      } finally {
        isLoadingResources.value = false;
      }
    }

    async function fetchResource(resourceId: string) {
      try {
        const res = await api.get(`${apiBaseUrl}/resources/${resourceId}`);
        return res.data;
      } catch (e) {
        logError(e, {
          operation: 'resourceStation.fetchResource',
          stationType: label,
          component: 'createResourceStationStore',
        });
        return null;
      }
    }

    function setSearchQuery(query: string) {
      searchQuery.value = query;
    }

    function setActiveCategory(categoryId: string | null) {
      activeCategoryId.value = categoryId;
    }

    function setSortBy(sort: string) {
      sortBy.value = sort;
    }

    function reset() {
      stations.value = [];
      currentStation.value = null;
      categories.value = [];
      resources.value = [];
      totalResources.value = 0;
      totalPages.value = 0;
      currentPage.value = 1;
      searchQuery.value = '';
      activeCategoryId.value = null;
      sortBy.value = 'newest';
    }

    return {
      stations,
      currentStation,
      categories,
      resources,
      totalResources,
      totalPages,
      currentPage,
      isLoadingStations,
      isLoadingResources,
      isLoadingCategories,
      searchQuery,
      activeCategoryId,
      sortBy,
      fetchStations,
      fetchStation,
      fetchCategories,
      fetchResources,
      fetchResource,
      setSearchQuery,
      setActiveCategory,
      setSortBy,
      reset,
    };
  });
}
