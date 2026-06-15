import { defineStore } from 'pinia';
import { ref } from 'vue';
import api from '@/utils/api';

export interface MirrorSource {
  id: string;
  name: string;
  displayName: string;
  baseUrl: string;
  adapterType: string;
  status: string;
  syncStatus: string;
  lastSyncAt: string | null;
  lastSyncDuration: number | null;
  totalResources: number;
  iconUrl: string | null;
  description: string | null;
  hasAccess: boolean;
  minPlanPriority: number;
  createdAt: string;
}

export interface MirrorCategory {
  id: string;
  sourceId: string;
  externalId: string;
  name: string;
  slug: string | null;
  parentExternalId?: string | null;
  order: number;
  resourceCount: number;
}

export interface MirrorResource {
  id: string;
  sourceId: string;
  externalId: string;
  categoryId: string | null;
  category: { name: string } | null;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  contentUrl: string | null;
  tags: string | null;
  resourceType: string;
  viewCount: number;
  publishedAt: string | null;
  syncedAt: string;
}

type ResourceQueryParams = {
  page: number;
  pageSize: number;
  categoryId?: string;
  search?: string;
  sort?: string;
};

export const useMirrorStore = defineStore('mirror', () => {
  const sources = ref<MirrorSource[]>([]);
  const currentSource = ref<MirrorSource | null>(null);
  const categories = ref<MirrorCategory[]>([]);
  const resources = ref<MirrorResource[]>([]);
  const totalResources = ref(0);
  const totalPages = ref(0);
  const currentPage = ref(1);
  const isLoadingSources = ref(false);
  const isLoadingResources = ref(false);
  const isLoadingCategories = ref(false);
  const searchQuery = ref('');
  const activeCategoryId = ref<string | null>(null);
  const sortBy = ref('newest');

  async function fetchSources() {
    isLoadingSources.value = true;
    try {
      const res = await api.get('/api/mirror/sources');
      sources.value = res.data;
    } catch (e) {
      console.error('Failed to fetch mirror sources:', e);
      sources.value = [];
    } finally {
      isLoadingSources.value = false;
    }
  }

  async function fetchSource(sourceId: string) {
    try {
      const res = await api.get(`/api/mirror/sources/${sourceId}`);
      currentSource.value = res.data;
    } catch (e) {
      console.error('Failed to fetch source:', e);
      currentSource.value = null;
    }
  }

  async function fetchCategories(sourceId: string) {
    isLoadingCategories.value = true;
    try {
      const res = await api.get(`/api/mirror/sources/${sourceId}/categories`);
      categories.value = res.data;
    } catch (e) {
      console.error('Failed to fetch categories:', e);
      categories.value = [];
    } finally {
      isLoadingCategories.value = false;
    }
  }

  async function fetchResources(
    sourceId: string,
    options?: {
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
        page: options?.page || 1,
        pageSize: options?.pageSize || 21,
      };
      if (options?.categoryId) params.categoryId = options.categoryId;
      if (options?.search) params.search = options.search;
      if (options?.sort) params.sort = options.sort;

      const res = await api.get(`/api/mirror/sources/${sourceId}/resources`, { params });
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
      const res = await api.get(`/api/mirror/resources/${resourceId}`);
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
    sources.value = [];
    currentSource.value = null;
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
    sources,
    currentSource,
    categories,
    resources,
    totalResources,
    totalPages,
    currentPage,
    isLoadingSources,
    isLoadingResources,
    isLoadingCategories,
    searchQuery,
    activeCategoryId,
    sortBy,
    fetchSources,
    fetchSource,
    fetchCategories,
    fetchResources,
    fetchResource,
    setSearchQuery,
    setActiveCategory,
    setSortBy,
    reset,
  };
});
