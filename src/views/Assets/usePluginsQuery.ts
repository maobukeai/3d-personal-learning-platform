/* eslint-disable @typescript-eslint/no-explicit-any */
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { Grid3X3, LayoutList } from 'lucide-vue-next';
import axios from 'axios';
import { toast, messageBox } from '@/utils/feedbackAdapter';
import { useRequireAuth } from '@/composables/useRequireAuth';
import { useI18n } from 'vue-i18n';
import { useSystemStore } from '@/stores/system';
import { useAuthStore } from '@/stores/auth';
import api, { getAssetUrl } from '@/utils/api';
import { getApiErrorMessage, logError } from '@/utils/error';
import { parseTags } from './resourceUtils';
import { useLabel } from '@/utils/i18n';
import { useAbortableFetch } from '@/composables/useAbortableFetch';
import {
  CATEGORY_ALL,
  CATEGORY_OTHER,
  type LibraryTab,
  type PluginInsights,
  type PluginItem,
  type PluginStatus,
  type SortMode,
  type StatusFilter,
  type ViewMode,
} from './pluginsSchema'; /** Plugin library data layer: list state, filtering, favorites, downloads, * deletion, review moderation and route deep-linking. Help-request forum state * lives in `usePluginHelpRequests`; edit/publish form state in `PluginsForm`. */
export function usePluginsQuery() {
  const { locale } = useI18n();
  const route = useRoute();
  const label = useLabel();
  const systemStore = useSystemStore();
  const authStore = useAuthStore();
  const { requireAuth: requireAuthPlugin } = useRequireAuth();
  const { createSignal: createPluginSignal } = useAbortableFetch();
  const pluginsList = ref<PluginItem[]>([]);
  const searchQuery = ref('');
  const activeCategory = ref(CATEGORY_ALL);
  const selectedTag = ref('all');
  const sortBy = ref<SortMode>('latest');
  const viewMode = ref<ViewMode>('grid');
  const showFavoritesOnly = ref(false);
  const favoritedIds = ref<string[]>([]);
  const insights = ref<PluginInsights | null>(null);
  const activeTab = ref<LibraryTab>('explore');
  const myStatusFilter = ref<StatusFilter>('all');
  const selectedFavoriteCategory = ref('all');
  const favoriteCategoriesList = ref<string[]>([]);
  const downloadingIds = ref<Record<string, boolean>>({});
  const isLoading = ref(false);
  const isBatchMode = ref(false);
  const selectedPluginIds = ref<Set<string>>(new Set());
  const selectedPlugin = ref<PluginItem | null>(null);
  const isDetailDialogOpen = ref(false);
  const isFilterOpen = ref(false);
  const isFilterCollapsed = ref(false);
  const isSavingReview = ref(false);
  const isUploadDialogOpen = ref(false);
  const initialPublishData = ref<any>(null);
  const currentUserId = computed(() => authStore.user?.id);
  const isAdmin = computed(() => authStore.user?.role === 'ADMIN');
  function isPluginOwner(plugin: PluginItem) {
    return Boolean(
      currentUserId.value &&
      (plugin.user?.id === currentUserId.value || (plugin as any).userId === currentUserId.value),
    );
  }
  function canEditPlugin(plugin: PluginItem) {
    return isAdmin.value || isPluginOwner(plugin);
  }
  const pluginCategories = computed(() =>
    (systemStore.settings.PLUGIN_CATEGORIES || []).filter(
      (name: string) => name !== '全部插件' && name !== '全部',
    ),
  );
  const visiblePlugins = computed(() => {
    const query = searchQuery.value.trim().toLowerCase();
    let list = [...pluginsList.value];
    if (activeCategory.value !== CATEGORY_ALL) {
      list = list.filter((plugin) => plugin.category === activeCategory.value);
    }
    if (query) {
      list = list.filter((plugin) =>
        [plugin.title, plugin.description, plugin.tags, plugin.compatibility, plugin.category]
          .join(' ')
          .toLowerCase()
          .includes(query),
      );
    }
    if (showFavoritesOnly.value) {
      list = list.filter((plugin) => favoritedIds.value.includes(plugin.id));
    }
    if (selectedTag.value !== 'all') {
      list = list.filter((plugin) => parseTags(plugin.tags).includes(selectedTag.value));
    }
    return list.sort((a, b) => {
      if (sortBy.value === 'popular') return b.downloads - a.downloads;
      if (sortBy.value === 'name')
        return a.title.localeCompare(b.title, locale.value === 'en-US' ? 'en-US' : 'zh-CN');
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  });
  const stats = computed(() => ({
    total: insights.value?.summary.total || pluginsList.value.length,
    downloads:
      insights.value?.summary.downloads ||
      pluginsList.value.reduce((sum, plugin) => sum + plugin.downloads, 0),
    favorites: favoritedIds.value.length || insights.value?.summary.favoriteCount || 0,
    categories:
      insights.value?.summary.categories ||
      new Set(pluginsList.value.map((plugin) => plugin.category)).size,
  }));
  const activeFilterChips = computed(() => {
    const chips: Array<{ key: string; label: string }> = [];
    if (activeCategory.value !== CATEGORY_ALL) {
      chips.push({
        key: 'category',
        label: label(`分类: ${activeCategory.value}`, `Category: ${activeCategory.value}`),
      });
    }
    if (selectedTag.value !== 'all') {
      chips.push({
        key: 'tag',
        label: label(`标签: ${selectedTag.value}`, `Tag: ${selectedTag.value}`),
      });
    }
    if (showFavoritesOnly.value) {
      chips.push({ key: 'favorites', label: label('只看收藏', 'Favorites Only') });
    }
    if (searchQuery.value.trim()) {
      chips.push({
        key: 'search',
        label: label(
          `搜索: "${searchQuery.value.trim()}"`,
          `Search: "${searchQuery.value.trim()}"`,
        ),
      });
    }
    return chips;
  });
  const statusTabOptions = computed(() => [
    { label: label('全部状态', 'All Statuses'), value: 'all' },
    { label: label('待审核', 'Pending'), value: 'PENDING' },
    { label: label('已发布', 'Approved'), value: 'APPROVED' },
    { label: label('未通过', 'Rejected'), value: 'REJECTED' },
  ]);
  const viewModeOptions = computed<{ value: ViewMode; label: string; icon: typeof Grid3X3 }[]>(
    () => [
      { value: 'grid', label: '', icon: Grid3X3 },
      { value: 'list', label: '', icon: LayoutList },
    ],
  );
  const normalizePlugin = (plugin: Partial<PluginItem> & Record<string, unknown>): PluginItem => ({
    id: String(plugin.id || crypto.randomUUID()),
    title: String(plugin.title || label('未命名插件', 'Untitled Plugin')),
    description: String(plugin.description || ''),
    category: String(plugin.category || CATEGORY_OTHER),
    tags: String(plugin.tags || ''),
    version: String(plugin.version || '1.0.0').replace(/^v/i, ''),
    compatibility: String(plugin.compatibility || label('未填写', 'Not specified')),
    downloads: Number(plugin.downloads || 0),
    fileUrl: typeof plugin.fileUrl === 'string' ? plugin.fileUrl : null,
    fileSize: typeof plugin.fileSize === 'number' ? plugin.fileSize : null,
    previewUrl: typeof plugin.previewUrl === 'string' ? plugin.previewUrl : null,
    installGuide: String(
      plugin.installGuide || label('作者暂未填写安装说明。', 'No installation guide yet.'),
    ),
    status: (plugin.status as PluginStatus) || 'APPROVED',
    rejectReason: typeof plugin.rejectReason === 'string' ? plugin.rejectReason : null,
    createdAt: String(plugin.createdAt || new Date().toISOString()),
    user: (plugin.user as PluginItem['user']) || null,
    bilibiliUrl: typeof plugin.bilibiliUrl === 'string' ? plugin.bilibiliUrl : null,
  });
  const fetchPlugins = async () => {
    try {
      isLoading.value = true;
      const signal = createPluginSignal();
      const { data } = await api.get('/api/plugins', {
        signal,
        params: {
          page: 1,
          pageSize: 80,
          search: searchQuery.value.trim() || undefined,
          category: activeCategory.value === CATEGORY_ALL ? undefined : activeCategory.value,
          mine: activeTab.value === 'mine' || activeTab.value === 'drafts' ? 'true' : undefined,
          favoritesOnly: activeTab.value === 'favorites' ? 'true' : undefined,
          favoriteCategory:
            activeTab.value === 'favorites' && selectedFavoriteCategory.value !== 'all'
              ? selectedFavoriteCategory.value
              : undefined,
          status:
            activeTab.value === 'drafts'
              ? 'PENDING'
              : activeTab.value === 'mine' && myStatusFilter.value !== 'all'
                ? myStatusFilter.value
                : undefined,
        },
      });
      const source = Array.isArray(data) ? data : data.plugins || [];
      pluginsList.value = source.map(normalizePlugin);
      await applyRoutePlugin();
      isLoading.value = false;
    } catch (error) {
      if (axios.isCancel(error)) return;
      toast.error(getApiErrorMessage(error, label('插件列表加载失败', 'Failed to load plugins')));
      isLoading.value = false;
    }
  };
  const fetchInsights = async () => {
    try {
      const { data } = await api.get('/api/plugins/insights');
      insights.value = data;
      favoritedIds.value = data.favoriteIds || [];
    } catch (error) {
      logError(error, { operation: 'fetchPluginInsights', view: 'PluginsView' });
    }
  };
  const fetchFavorites = async () => {
    try {
      const { data } = await api.get('/api/plugins/favorites');
      favoritedIds.value = data.ids || [];
      favoriteCategoriesList.value = data.categories || [];
    } catch (error) {
      logError(error, { operation: 'fetchPluginFavorites', view: 'PluginsView' });
    }
  };
  const isFavorited = (pluginId: string) => favoritedIds.value.includes(pluginId);
  const toggleFavorite = async (pluginId: string, event?: Event) => {
    event?.stopPropagation();
    if (!requireAuthPlugin()) return;
    try {
      const { data } = await api.post(`/api/plugins/${pluginId}/favorite`);
      favoritedIds.value = data.favoriteIds || [];
      toast.success(
        data.isFavorited
          ? label('已收藏插件', 'Plugin saved')
          : label('已取消收藏', 'Favorite removed'),
      );
      fetchInsights();
    } catch (error) {
      toast.error(getApiErrorMessage(error, label('收藏失败', 'Favorite failed')));
    }
  };
  const handleDownload = async (plugin: PluginItem, event?: Event) => {
    event?.stopPropagation();
    if (downloadingIds.value[plugin.id]) return;
    try {
      downloadingIds.value[plugin.id] = true;
      const { data } = await api.post(`/api/plugins/${plugin.id}/download`);
      const fileUrl = data.fileUrl || plugin.fileUrl;
      if (!fileUrl) {
        toast.warning(label('该插件暂未提供下载文件', 'This plugin has no download file yet'));
        return;
      }
      plugin.downloads += 1;
      window.open(getAssetUrl(fileUrl), '_blank', 'noopener,noreferrer');
      fetchInsights();
    } catch (error) {
      toast.error(getApiErrorMessage(error, label('下载失败', 'Download failed')));
    } finally {
      delete downloadingIds.value[plugin.id];
    }
  };
  const downloadSelectedPlugin = () => {
    if (selectedPlugin.value) handleDownload(selectedPlugin.value);
  };
  const deletePlugin = async (plugin: PluginItem) => {
    try {
      await messageBox.confirm(
        label(
          `确认删除插件「${plugin.title}」？此操作不可恢复。`,
          `Are you sure you want to delete plugin "${plugin.title}"? This action cannot be undone.`,
        ),
        label('删除插件', 'Delete Plugin'),
        {
          confirmButtonText: label('删除', 'Delete'),
          cancelButtonText: label('取消', 'Cancel'),
          type: 'warning',
        },
      );
      const oldPlugins = [...pluginsList.value];
      pluginsList.value = pluginsList.value.filter((x) => x.id !== plugin.id);
      toast.success(label('插件已删除', 'Plugin deleted'));
      isDetailDialogOpen.value = false;
      api
        .delete(`/api/plugins/${plugin.id}`)
        .then(() => fetchInsights())
        .catch((error) => {
          pluginsList.value = oldPlugins;
          toast.error(getApiErrorMessage(error, label('删除失败', 'Delete failed')));
        });
    } catch (error) {
      if (error !== 'cancel') {
        toast.error(getApiErrorMessage(error, label('删除失败', 'Delete failed')));
      }
    }
  };
  const togglePluginSelect = (id: string) => {
    const next = new Set(selectedPluginIds.value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selectedPluginIds.value = next;
  };
  const selectAllPlugins = () => {
    if (
      selectedPluginIds.value.size === visiblePlugins.value.length &&
      visiblePlugins.value.length > 0
    ) {
      selectedPluginIds.value = new Set();
    } else {
      selectedPluginIds.value = new Set(visiblePlugins.value.map((p) => p.id));
    }
  };
  const clearFilter = (key: string) => {
    if (key === 'category') activeCategory.value = CATEGORY_ALL;
    if (key === 'tag') selectedTag.value = 'all';
    if (key === 'favorites') showFavoritesOnly.value = false;
    if (key === 'search') searchQuery.value = '';
    fetchPlugins();
  };
  const resetFilters = () => {
    searchQuery.value = '';
    activeCategory.value = CATEGORY_ALL;
    selectedTag.value = 'all';
    showFavoritesOnly.value = false;
    fetchPlugins();
  };
  const openDetail = (plugin: PluginItem) => {
    if (isBatchMode.value) {
      togglePluginSelect(plugin.id);
      return;
    }
    selectedPlugin.value = plugin;
    isDetailDialogOpen.value = true;
  };
  const getRoutePluginId = () => {
    const plugin = route.query.plugin;
    return typeof plugin === 'string' ? plugin : '';
  };
  async function applyRoutePlugin() {
    const pluginId = getRoutePluginId();
    if (!pluginId || selectedPlugin.value?.id === pluginId) return;
    let plugin = pluginsList.value.find((item) => item.id === pluginId);
    if (!plugin) {
      try {
        const { data } = await api.get(`/api/plugins/${pluginId}`);
        const normalized = normalizePlugin(data);
        plugin = normalized;
        pluginsList.value = [
          normalized,
          ...pluginsList.value.filter((item) => item.id !== normalized.id),
        ];
      } catch (error) {
        logError(error, { operation: 'fetchPluginDetail', view: 'PluginsView' });
        return;
      }
    }
    if (!plugin) return;
    openDetail(plugin);
  }
  const handleReviewApproved = async (plugin: PluginItem) => {
    try {
      await messageBox.confirm(
        label(`确认通过插件「${plugin.title}」的发布申请？`, `Approve plugin "${plugin.title}"?`),
        label('审核插件', 'Review Plugin'),
        {
          confirmButtonText: label('通过', 'Approve'),
          cancelButtonText: label('取消', 'Cancel'),
          type: 'success',
        },
      );
      isSavingReview.value = true;
      const { data } = await api.put(`/api/admin/plugins/${plugin.id}/status`, {
        status: 'APPROVED',
      });
      toast.success(label('插件已通过审核并发布', 'Plugin approved and published'));
      if (selectedPlugin.value && selectedPlugin.value.id === plugin.id) {
        selectedPlugin.value = normalizePlugin(data);
      }
      fetchPlugins();
      fetchInsights();
    } catch (error) {
      if (error !== 'cancel') {
        toast.error(getApiErrorMessage(error, label('审核失败', 'Review failed')));
      }
    } finally {
      isSavingReview.value = false;
    }
  };
  const handleReviewRejected = async (plugin: PluginItem) => {
    try {
      const { value } = await messageBox.prompt(
        label('驳回原因', 'Rejection Reason'),
        label(`驳回「${plugin.title}」`, `Reject "${plugin.title}"`),
        {
          inputValue:
            plugin.rejectReason ||
            label(
              '安装指南、描述信息需要补充或测试不通过。',
              'Installation guide or description needs more information, or validation failed.',
            ),
          confirmButtonText: label('驳回', 'Reject'),
          cancelButtonText: label('取消', 'Cancel'),
          inputValidator: (val: string) => {
            if (!val?.trim()) return label('请输入驳回原因', 'Please enter rejection reason');
            return true;
          },
        },
      );
      isSavingReview.value = true;
      const { data } = await api.put(`/api/admin/plugins/${plugin.id}/status`, {
        status: 'REJECTED',
        rejectReason: value,
      });
      toast.warning(label('已驳回该插件的发布申请', 'Plugin request rejected'));
      if (selectedPlugin.value && selectedPlugin.value.id === plugin.id) {
        selectedPlugin.value = normalizePlugin(data);
      }
      fetchPlugins();
      fetchInsights();
    } catch (error) {
      if (error !== 'cancel') {
        toast.error(getApiErrorMessage(error, label('操作失败', 'Action failed')));
      }
    } finally {
      isSavingReview.value = false;
    }
  };
  const handlePluginUpdate = async () => {
    fetchPlugins();
    fetchInsights();
    if (selectedPlugin.value) {
      try {
        const { data } = await api.get(`/api/plugins/${selectedPlugin.value.id}`);
        selectedPlugin.value = normalizePlugin(data);
      } catch (err) {
        logError(err, { operation: 'refresh plugin detail' });
      }
    }
  };
  const handleUploadClickPlugin = () => {
    if (!requireAuthPlugin()) return;
    isUploadDialogOpen.value = true;
  };
  watch(isUploadDialogOpen, (val) => {
    if (!val) initialPublishData.value = null;
  });
  watch(activeTab, () => {
    isBatchMode.value = false;
    selectedPluginIds.value = new Set();
  });
  watch([activeTab, myStatusFilter, selectedFavoriteCategory], () => {
    if (activeTab.value !== 'requests') fetchPlugins();
  });
  watch(
    () => route.query.plugin,
    () => applyRoutePlugin(),
  );
  onMounted(() => {
    systemStore.fetchSettings();
    fetchPlugins();
    fetchInsights();
    fetchFavorites();
  });
  return {
    pluginsList,
    searchQuery,
    activeCategory,
    selectedTag,
    sortBy,
    viewMode,
    viewModeOptions,
    showFavoritesOnly,
    favoritedIds,
    insights,
    activeTab,
    myStatusFilter,
    selectedFavoriteCategory,
    favoriteCategoriesList,
    downloadingIds,
    isLoading,
    isBatchMode,
    selectedPluginIds,
    selectedPlugin,
    isDetailDialogOpen,
    isFilterOpen,
    isFilterCollapsed,
    isSavingReview,
    isUploadDialogOpen,
    initialPublishData,
    currentUserId,
    isAdmin,
    isPluginOwner,
    canEditPlugin,
    pluginCategories,
    visiblePlugins,
    stats,
    activeFilterChips,
    statusTabOptions,
    normalizePlugin,
    fetchPlugins,
    fetchInsights,
    fetchFavorites,
    isFavorited,
    toggleFavorite,
    handleDownload,
    downloadSelectedPlugin,
    deletePlugin,
    togglePluginSelect,
    selectAllPlugins,
    clearFilter,
    resetFilters,
    openDetail,
    applyRoutePlugin,
    handleUploadClickPlugin,
    handleReviewApproved,
    handleReviewRejected,
    handlePluginUpdate,
  };
}
