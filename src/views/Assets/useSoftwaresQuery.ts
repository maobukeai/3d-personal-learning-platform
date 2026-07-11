import { computed, onMounted, ref, watch, type Ref, type ComputedRef } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useSystemStore } from '@/stores/system';
import api from '@/utils/api';
import { logError } from '@/utils/error';
import { useLabel } from '@/utils/i18n';
import { useAbortableFetch } from '@/composables/useAbortableFetch';
import { parseTags } from './resourceUtils';
import {
  type SoftwareItem,
  type SoftwareInsights,
  type HelpRequest,
  type SortMode,
  type ViewMode,
  type LibraryTab,
  type StatusFilter,
  CATEGORY_ALL,
  CATEGORY_OTHER,
  normalizeSoftware,
  categoryLabel,
  buildViewModeOptions,
} from './softwaresSchema';
import axios from 'axios';

export function useSoftwaresQuery() {
  const route = useRoute();
  const authStore = useAuthStore();
  const systemStore = useSystemStore();
  const label = useLabel();

  const currentUserId = computed(() => authStore.user?.id);
  const isAdmin = computed(() => authStore.user?.role === 'ADMIN');

  const softwaresList = ref<SoftwareItem[]>([]);
  const searchQuery = ref('');
  const activeCategory = ref(CATEGORY_ALL);
  const selectedTag = ref('all');
  const sortBy = ref<SortMode>('latest');
  const viewMode = ref<ViewMode>('grid');
  const showFavoritesOnly = ref(false);
  const favoritedIds = ref<string[]>([]);
  const insights = ref<SoftwareInsights | null>(null);

  const activeTab = ref<LibraryTab>('explore');
  const myStatusFilter = ref<StatusFilter>('all');

  const selectedFavoriteCategory = ref('all');
  const favoriteCategoriesList = ref<string[]>([]);

  const helpRequests = ref<HelpRequest[]>([]);
  const helpRequestsCount = ref(0);
  const isHelpRequestsLoading = ref(false);
  const downloadingIds = ref<Record<string, boolean>>({});
  const isLoading = ref(false);

  const { createSignal: createSoftwareSignal } = useAbortableFetch();
  const { createSignal: createHelpSignal } = useAbortableFetch();

  const libraryTabOptions = computed(() => [
    {
      label: `${label('软件广场', 'Explore')} ${insights.value?.summary.total || 0}`,
      value: 'explore',
    },
    {
      label: `${label('我的收藏', 'Favorites')} ${insights.value?.summary.favoriteCount || favoritedIds.value.length}`,
      value: 'favorites',
    },
    {
      label: `${label('我的软件', 'My Uploads')} ${insights.value?.summary.myUploads || 0}`,
      value: 'mine',
    },
    {
      label: `${label('草稿箱', 'Drafts')} ${insights.value?.summary.myPending || 0}`,
      value: 'drafts',
    },
    {
      label: `${label('软件求助', 'Help Requests')} ${helpRequestsCount.value}`,
      value: 'requests',
    },
  ]);

  const statusTabOptions = computed(() => [
    { label: label('全部状态', 'All Statuses'), value: 'all' },
    { label: label('待审核', 'Pending'), value: 'PENDING' },
    { label: label('已发布', 'Approved'), value: 'APPROVED' },
    { label: label('未通过', 'Rejected'), value: 'REJECTED' },
  ]);

  const categoryTabOptions = computed(() => {
    const configured = (systemStore.settings.SOFTWARE_CATEGORIES || []).filter(
      (name: string) => name !== CATEGORY_ALL,
    );
    const fromData = [
      ...softwaresList.value.map((software) => software.category).filter(Boolean),
      ...(insights.value?.categories || []).map((category) => category.name),
    ].filter((name) => name !== CATEGORY_ALL);
    const names = [CATEGORY_ALL, ...Array.from(new Set([...configured, ...fromData]))];
    return names.map((name) => {
      let badge: number | string = '';
      if (name === CATEGORY_ALL) {
        badge = stats.value.total;
      } else {
        const catStats = insights.value?.categories.find((c) => c.name === name);
        if (catStats) {
          badge = catStats.count;
        } else {
          badge = softwaresList.value.filter((s) => s.category === name).length || '';
        }
      }
      return {
        label: name,
        value: name,
        badge,
      };
    });
  });

  const viewModeOptions = buildViewModeOptions();

  const pluginCategories = computed(() =>
    (systemStore.settings.SOFTWARE_CATEGORIES || []).filter(
      (name: string) => name !== '全部软件' && name !== '全部',
    ),
  );

  const stats = computed(() => ({
    total: insights.value?.summary.total || softwaresList.value.length,
    downloads:
      insights.value?.summary.downloads ||
      softwaresList.value.reduce((sum, software) => sum + software.downloads, 0),
    favorites: favoritedIds.value.length || insights.value?.summary.favoriteCount || 0,
    categories:
      insights.value?.summary.categories ||
      new Set(softwaresList.value.map((software) => software.category)).size,
  }));

  const visibleSoftwares = computed(() => {
    const queryStr = searchQuery.value.trim().toLowerCase();
    let list = [...softwaresList.value];

    if (activeCategory.value !== CATEGORY_ALL) {
      list = list.filter((software) => software.category === activeCategory.value);
    }

    if (queryStr) {
      list = list.filter((software) => {
        return [
          software.title,
          software.description,
          software.tags,
          software.compatibility,
          software.category,
        ]
          .join(' ')
          .toLowerCase()
          .includes(queryStr);
      });
    }

    if (showFavoritesOnly.value) {
      list = list.filter((software) => favoritedIds.value.includes(software.id));
    }

    if (selectedTag.value !== 'all') {
      list = list.filter((software) => parseTags(software.tags).includes(selectedTag.value));
    }

    return list.sort((a, b) => {
      if (sortBy.value === 'popular') return b.downloads - a.downloads;
      if (sortBy.value === 'name') return a.title.localeCompare(b.title, 'zh-CN');
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  });

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
    return chips;
  });

  const fetchSoftwares = async () => {
    try {
      isLoading.value = true;
      const signal = createSoftwareSignal();
      const { data } = await api.get('/api/softwares', {
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
      const source = Array.isArray(data) ? data : data.softwares || [];
      softwaresList.value = source.map((s: any) => normalizeSoftware(s, label));
      await applyRouteSoftware();
    } catch (error) {
      if (axios.isCancel(error)) return;
      logError(error, { operation: 'fetchSoftwares', view: 'SoftwaresView' });
    } finally {
      isLoading.value = false;
    }
  };

  const fetchInsights = async () => {
    try {
      const { data } = await api.get('/api/softwares/insights');
      insights.value = data;
      favoritedIds.value = data.favoriteIds || [];
    } catch (error) {
      logError(error, { operation: 'fetchSoftwareInsights', view: 'SoftwaresView' });
    }
  };

  const fetchFavorites = async () => {
    try {
      const { data } = await api.get('/api/softwares/favorites');
      favoritedIds.value = data.ids || [];
      favoriteCategoriesList.value = data.categories || [];
    } catch (error) {
      logError(error, { operation: 'fetchSoftwareFavorites', view: 'SoftwaresView' });
    }
  };

  const fetchHelpRequests = async () => {
    try {
      isHelpRequestsLoading.value = true;
      const signal = createHelpSignal();
      const { data } = await api.get('/api/softwares/requests', { signal });
      helpRequests.value = data.requests || [];
      helpRequestsCount.value = data.pagination?.total || helpRequests.value.length;
    } catch (err) {
      if (axios.isCancel(err)) return;
      logError(err, { operation: 'fetchHelpRequests' });
    } finally {
      isHelpRequestsLoading.value = false;
    }
  };

  const getRouteSoftwareId = () => {
    const software = route.query.software;
    return typeof software === 'string' ? software : '';
  };

  const selectedSoftware = ref<SoftwareItem | null>(null);
  const isDetailDialogOpen = ref(false);

  const applyRouteSoftware = async () => {
    const pluginId = getRouteSoftwareId();
    if (!pluginId || selectedSoftware.value?.id === pluginId) return;

    let software = softwaresList.value.find((item) => item.id === pluginId);
    if (!software) {
      try {
        const { data } = await api.get(`/api/softwares/${pluginId}`);
        const normalized = normalizeSoftware(data, label);
        software = normalized;
        softwaresList.value = [
          normalized,
          ...softwaresList.value.filter((item) => item.id !== normalized.id),
        ];
      } catch (error) {
        logError(error, { operation: 'fetchSoftwareDetail', view: 'SoftwaresView' });
        return;
      }
    }
    if (!software) return;
    selectedSoftware.value = software;
    isDetailDialogOpen.value = true;
  };

  const isFavorited = (pluginId: string) => favoritedIds.value.includes(pluginId);

  watch([activeTab, myStatusFilter, selectedFavoriteCategory], () => {
    if (activeTab.value === 'requests') {
      fetchHelpRequests();
    } else {
      fetchSoftwares();
    }
  });

  onMounted(() => {
    fetchSoftwares();
    fetchInsights();
    fetchFavorites();
  });

  return {
    searchQuery,
    activeTab,
    sortBy,
    viewMode,
    showFavoritesOnly,
    activeCategory,
    myStatusFilter,
    selectedTag,
    selectedFavoriteCategory,
    isLoading,
    favoritedIds,
    favoriteCategoriesList,
    downloadingIds,
    insights,
    helpRequests,
    isHelpRequestsLoading,
    currentUserId,
    visibleSoftwares,
    stats,
    categoryTabOptions,
    statusTabOptions,
    activeFilterChips,
    libraryTabOptions,
    viewModeOptions,
    pluginCategories,
    fetchSoftwares,
    fetchInsights,
    fetchFavorites,
    fetchHelpRequests,
    isFavorited,
    selectedSoftware,
    isDetailDialogOpen,
  };
}

export type UseSoftwaresQueryReturn = ReturnType<typeof useSoftwaresQuery>;
