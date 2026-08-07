import { computed, ref, watch, type Component } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Box, Layers, Puzzle, Sparkles } from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from '@/utils/feedbackBridge';
import api from '@/utils/api';
import { getApiErrorMessage, logError } from '@/utils/error';

export type ContentTab = 'assets' | 'materials' | 'showcases' | 'plugins';
export type ContentStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type StatusFilter = ContentStatus | 'ALL';

export interface ContentUser {
  id?: string;
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
}

export interface ContentItem {
  id: string;
  title: string;
  description?: string | null;
  status: ContentStatus;
  createdAt: string;
  updatedAt?: string;
  type?: string;
  category?: string;
  categoryId?: string;
  tags?: string | null;
  thumbnail?: string | null;
  thumbnailUrl?: string | null;
  previewUrl?: string | null;
  fileUrl?: string | null;
  videoUrl?: string | null;
  url?: string | null;
  fileSize?: number | null;
  size?: number | null;
  resolution?: string | null;
  downloads?: number;
  likes?: number;
  views?: number;
  comments?: number;
  version?: string;
  compatibility?: string;
  rejectReason?: string | null;
  user?: ContentUser;
  isProcedural?: boolean;
}

export interface PageConfig {
  label: string;
  title: string;
  apiPath: string;
  icon: Component;
  emptyLabel: string;
}

export interface ContentStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

export interface UserListItem {
  id: string;
  name?: string | null;
  email?: string | null;
}

export interface PaginatedContentResponse {
  items: ContentItem[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
  stats?: ContentStats;
}

export const pageConfigs: Record<ContentTab, PageConfig> = {
  assets: {
    label: '3D 资产',
    title: '3D 资产管理',
    apiPath: '/api/admin/assets',
    icon: Box,
    emptyLabel: '暂无 3D 资产记录',
  },
  materials: {
    label: '材质贴图',
    title: '材质贴图管理',
    apiPath: '/api/admin/materials',
    icon: Layers,
    emptyLabel: '暂无材质贴图记录',
  },
  showcases: {
    label: '作品展示',
    title: '作品展示管理',
    apiPath: '/api/admin/showcases',
    icon: Sparkles,
    emptyLabel: '暂无作品展示记录',
  },
  plugins: {
    label: '插件扩展',
    title: '插件与软件资源管理',
    apiPath: '/api/admin/plugins',
    icon: Puzzle,
    emptyLabel: '暂无插件与软件资源记录',
  },
};

export function useAdminContents() {
  const route = useRoute();
  const router = useRouter();

  const getValidTab = (value: unknown): ContentTab => {
    if (
      value === 'assets' ||
      value === 'materials' ||
      value === 'showcases' ||
      value === 'plugins'
    ) {
      return value;
    }
    return 'assets';
  };

  const activeTab = ref<ContentTab>(getValidTab(route.query.tab || route.meta.contentType));
  const statusFilter = ref<StatusFilter>('ALL');
  const searchQuery = ref('');
  const items = ref<ContentItem[]>([]);
  const assetCategories = ref<{ id: string; name: string }[]>([]);
  const isLoading = ref(false);
  const currentPage = ref(1);
  const pageSize = ref(12);
  const totalItems = ref(0);
  const totalPages = ref(1);
  const queueStats = ref<ContentStats | null>(null);

  const activeItem = ref<ContentItem | null>(null);
  const isDetailSplitOpen = ref(false);
  const detailDrawerVisible = ref(false);
  const isDesktop = ref(window.innerWidth >= 1024);

  const selectedItemIds = ref<string[]>([]);
  const viewMode = ref<'list' | 'grid'>('list');
  const failedImages = ref<Record<string, boolean>>({});

  const handleResize = () => {
    isDesktop.value = window.innerWidth >= 1024;
    if (!isDesktop.value) {
      isDetailSplitOpen.value = false;
    }
  };

  const openDetail = (item: ContentItem) => {
    activeItem.value = item;
    if (isDesktop.value) {
      isDetailSplitOpen.value = true;
      detailDrawerVisible.value = false;
    } else {
      detailDrawerVisible.value = true;
      isDetailSplitOpen.value = false;
    }
  };

  const closeDetail = () => {
    isDetailSplitOpen.value = false;
    detailDrawerVisible.value = false;
  };

  const pageConfig = computed(() => pageConfigs[activeTab.value]);

  const clearSelection = () => {
    selectedItemIds.value = [];
  };

  const fetchItems = async (silent = false) => {
    if (!silent) isLoading.value = true;
    failedImages.value = {};
    try {
      const params = {
        response: 'paginated',
        page: currentPage.value,
        limit: pageSize.value,
        search: searchQuery.value.trim() || undefined,
        status: statusFilter.value !== 'ALL' ? statusFilter.value : undefined,
      };
      const response = await api.get<PaginatedContentResponse | ContentItem[]>(
        pageConfig.value.apiPath,
        { params },
      );
      if (Array.isArray(response.data)) {
        items.value = response.data;
        totalItems.value = response.data.length;
        totalPages.value = 1;
        queueStats.value = null;
      } else {
        items.value = response.data.items || [];
        totalItems.value = response.data.total || 0;
        currentPage.value = response.data.page || currentPage.value;
        pageSize.value = response.data.pageSize || pageSize.value;
        totalPages.value = Math.max(response.data.pages || 1, 1);
        queueStats.value = (response.data.stats as unknown as ContentStats | null) || null;
      }
    } catch (error) {
      ElMessage.error(getApiErrorMessage(error, `无法加载${pageConfig.value.label}数据`));
    } finally {
      if (!silent) isLoading.value = false;
    }
  };

  const fetchAssetCategories = async () => {
    try {
      const response = await api.get<{ id: string; name: string }[]>('/api/admin/asset-categories');
      assetCategories.value = response.data;
    } catch (error) {
      logError(error, { operation: 'admin.fetchCategories', component: 'AdminContentsView' });
    }
  };

  const handleTabChange = (tabId: ContentTab) => {
    activeTab.value = tabId;
    currentPage.value = 1;
    router.push({ query: { ...route.query, tab: tabId } });
    clearSelection();
    closeDetail();
    fetchItems();
  };

  const handleSearch = () => {
    currentPage.value = 1;
    fetchItems();
  };

  const handleStatusFilterChange = (status: StatusFilter) => {
    statusFilter.value = status;
    currentPage.value = 1;
    clearSelection();
    closeDetail();
    fetchItems();
  };

  const setPage = (page: number) => {
    if (page < 1 || page > totalPages.value) return;
    currentPage.value = page;
    clearSelection();
    closeDetail();
    fetchItems();
  };

  const toggleSelectItem = (id: string) => {
    const idx = selectedItemIds.value.indexOf(id);
    if (idx > -1) {
      selectedItemIds.value.splice(idx, 1);
    } else {
      selectedItemIds.value.push(id);
    }
  };

  const toggleSelectAll = () => {
    if (selectedItemIds.value.length === items.value.length) {
      selectedItemIds.value = [];
    } else {
      selectedItemIds.value = items.value.map((i) => i.id);
    }
  };

  return {
    activeTab,
    statusFilter,
    searchQuery,
    items,
    assetCategories,
    isLoading,
    currentPage,
    pageSize,
    totalItems,
    totalPages,
    queueStats,
    activeItem,
    isDetailSplitOpen,
    detailDrawerVisible,
    isDesktop,
    selectedItemIds,
    viewMode,
    failedImages,
    pageConfig,
    handleResize,
    openDetail,
    closeDetail,
    clearSelection,
    fetchItems,
    fetchAssetCategories,
    handleTabChange,
    handleSearch,
    handleStatusFilterChange,
    setPage,
    toggleSelectItem,
    toggleSelectAll,
  };
}
