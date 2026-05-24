import { defineStore } from 'pinia';
import { ref } from 'vue';
import api from '@/utils/api';

export interface ManualStation {
  id: string;
  name: string;
  displayName: string;
  status: string;
  totalResources: number;
  minPlanPriority: number;
  iconUrl: string | null;
  description: string | null;
  hasAccess: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ManualCategory {
  id: string;
  stationId: string;
  name: string;
  slug: string | null;
  parentId?: string | null;
  order: number;
  resourceCount: number;
}

export interface ManualResource {
  id: string;
  stationId: string;
  categoryId: string | null;
  category: { name: string } | null;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  contentUrl: string | null;
  tags: string | null;
  contentHtml: string | null;
  resourceType: string;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}

type ResourceQueryParams = {
  page: number;
  pageSize: number;
  categoryId?: string;
  search?: string;
  sort?: string;
};

export const useManualStore = defineStore('manual', () => {
  const stations = ref<ManualStation[]>([]);
  const currentStation = ref<ManualStation | null>(null);
  const categories = ref<ManualCategory[]>([]);
  const resources = ref<ManualResource[]>([]);
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
      const res = await api.get('/api/manual/stations');
      stations.value = res.data;
    } catch (e) {
      console.error('Failed to fetch manual stations:', e);
      stations.value = [];
    } finally {
      isLoadingStations.value = false;
    }
  }

  async function fetchStation(stationId: string) {
    try {
      const res = await api.get(`/api/manual/stations/${stationId}`);
      currentStation.value = res.data;
    } catch (e) {
      console.error('Failed to fetch station:', e);
      currentStation.value = null;
    }
  }

  async function fetchCategories(stationId: string) {
    isLoadingCategories.value = true;
    try {
      const res = await api.get(`/api/manual/stations/${stationId}/categories`);
      categories.value = res.data;
    } catch (e) {
      console.error('Failed to fetch categories:', e);
      categories.value = [];
    } finally {
      isLoadingCategories.value = false;
    }
  }

  async function fetchResources(
    stationId: string,
    options?: { page?: number; categoryId?: string; search?: string; sort?: string; pageSize?: number },
  ) {
    isLoadingResources.value = true;
    try {
      const params: ResourceQueryParams = {
        page: options?.page || 1,
        pageSize: options?.pageSize || 21,
      };
      if (options?.categoryId) params.categoryId = options.categoryId;
      if (options?.search) params.search = options.search;
      if (options?.sort) params.sort = options.sort;

      const res = await api.get(`/api/manual/stations/${stationId}/resources`, { params });
      resources.value = res.data.resources;
      totalResources.value = res.data.total;
      totalPages.value = res.data.totalPages;
      currentPage.value = res.data.page;
    } catch (e) {
      console.error('Failed to fetch resources:', e);
      resources.value = [];
    } finally {
      isLoadingResources.value = false;
    }
  }

  async function fetchResource(resourceId: string) {
    try {
      const res = await api.get(`/api/manual/resources/${resourceId}`);
      return res.data;
    } catch (e) {
      console.error('Failed to fetch resource:', e);
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
