import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useMirrorStore, type MirrorResource } from '@/stores/mirror';
import { useAuthStore } from '@/stores/auth';
import { useScrollRestoration } from '@/composables/useScrollRestoration';
import type { ViewModeType } from '../components/MirrorFilterBar.vue';

export function useMirrorSourceView() {
  const route = useRoute();
  const router = useRouter();
  const mirrorStore = useMirrorStore();
  const authStore = useAuthStore();

  const scrollContainerRef = ref<HTMLElement | null>(null);
  let isFetchingData = false;

  const sourceId = computed(() => {
    if (route.params.id) return route.params.id as string;
    const slug = (route.params.slug as string)?.trim().toLowerCase();
    if (slug) {
      const found = mirrorStore.stations.find((s) => {
        if (s.id.toLowerCase() === slug || s.name.toLowerCase() === slug) return true;
        try {
          const cfg = s.syncConfig ? JSON.parse(s.syncConfig) : {};
          if (cfg.proxyConfig?.customSlug?.trim().toLowerCase() === slug) return true;
        } catch {}
        return false;
      });
      if (found) return found.id;
      return slug;
    }

    // 智能感知：如果通过自定义独立域名访问（如 xuexi.591595.xyz），通过 hostname 匹配站点 ID
    if (typeof window !== 'undefined') {
      const currentHost = window.location.hostname.toLowerCase();
      if (currentHost && currentHost !== 'localhost' && currentHost !== '127.0.0.1') {
        const foundByDomain = mirrorStore.stations.find((s) => {
          try {
            const cfg = s.syncConfig ? JSON.parse(s.syncConfig) : {};
            const domainStr = cfg.proxyConfig?.customDomain?.toLowerCase() || '';
            const domains = domainStr.split(/[,，\s]+/).filter(Boolean);
            return domains.some(
              (d: string) =>
                d === currentHost || currentHost.endsWith('.' + d) || d.endsWith('.' + currentHost),
            );
          } catch {}
          return false;
        });
        if (foundByDomain) return foundByDomain.id;
      }
    }

    // 兜底：如果已有 currentStation 或列表有激活站点，取第一个有效站点
    if (mirrorStore.currentStation?.id) {
      return mirrorStore.currentStation.id;
    }
    if (mirrorStore.stations.length > 0) {
      const active =
        mirrorStore.stations.find((s) => s.status === 'ACTIVE') || mirrorStore.stations[0];
      if (active) return active.id;
    }

    return '';
  });

  const viewMode = ref<ViewModeType>(
    (localStorage.getItem('mirror_view_mode') as ViewModeType) || 'grid-comfortable',
  );
  const selectedPreviewResource = ref<MirrorResource | null>(null);
  const isDrawerOpen = ref(false);
  const jumpPageInput = ref('1');
  const pageSize = ref(20);
  const pageSizeOptions = [20, 40, 60];

  const { saveScroll, restoreScroll } = useScrollRestoration(scrollContainerRef, {
    key: () => `mirror_source_${sourceId.value}`,
  });

  const hasAccess = computed(() => {
    if (!mirrorStore.currentStation) return null;
    const userPriority = authStore.user?.subscription?.plan?.priority ?? 0;
    return userPriority >= mirrorStore.currentStation.minPlanPriority;
  });

  function syncRouteQuery() {
    const query: Record<string, string> = {};
    if (mirrorStore.activeCategoryId) {
      query.categoryId = mirrorStore.activeCategoryId;
    }
    if (mirrorStore.searchQuery && mirrorStore.searchQuery.trim()) {
      query.search = mirrorStore.searchQuery.trim();
    }
    if (mirrorStore.currentPage > 1) {
      query.page = mirrorStore.currentPage.toString();
    }
    if (mirrorStore.sortBy && mirrorStore.sortBy !== 'newest') {
      query.sort = mirrorStore.sortBy;
    }
    if (pageSize.value !== 20) {
      query.pageSize = pageSize.value.toString();
    }

    // Replace query without triggering duplicate re-renders
    router.replace({ query }).catch(() => {});
  }

  async function loadData(explicitSourceId?: string) {
    if (mirrorStore.stations.length === 0) {
      await mirrorStore.fetchStations();
    }

    const targetSourceId = explicitSourceId || sourceId.value;
    if (!targetSourceId) return;
    if (isFetchingData) return;
    isFetchingData = true;

    try {
      await Promise.all([
        mirrorStore.fetchStation(targetSourceId),
        mirrorStore.fetchCategories(targetSourceId),
      ]);

      if (mirrorStore.isNotFound || !mirrorStore.currentStation) {
        await mirrorStore.fetchStations();
        const validStation =
          mirrorStore.stations.find((s) => s.status === 'ACTIVE') || mirrorStore.stations[0];
        if (validStation && validStation.id !== targetSourceId) {
          if (!route.path.startsWith('/portal')) {
            router.replace(`/mirror/source/${validStation.id}`);
            return;
          }
        }
      }

      if (!mirrorStore.currentStation) return;

      // Restore filters and pagination from route query if available
      const qCategory = route.query.categoryId as string | undefined;
      if (qCategory !== undefined) {
        mirrorStore.setActiveCategory(qCategory || null);
      }

      const qSearch = route.query.search as string | undefined;
      if (qSearch !== undefined) {
        mirrorStore.setSearchQuery(qSearch);
      }

      const qPage = route.query.page ? parseInt(route.query.page as string, 10) : 1;
      mirrorStore.currentPage = !isNaN(qPage) && qPage >= 1 ? qPage : 1;
      jumpPageInput.value = mirrorStore.currentPage.toString();

      const qSort = route.query.sort as string | undefined;
      if (qSort) {
        mirrorStore.setSortBy(qSort);
      }

      const qPageSize = route.query.pageSize ? parseInt(route.query.pageSize as string, 10) : 20;
      if (!isNaN(qPageSize) && pageSizeOptions.includes(qPageSize)) {
        pageSize.value = qPageSize;
      }

      await mirrorStore.fetchResources(targetSourceId, {
        page: mirrorStore.currentPage,
        pageSize: pageSize.value,
        categoryId: mirrorStore.activeCategoryId || undefined,
        search: mirrorStore.searchQuery || undefined,
        sort: mirrorStore.sortBy,
      });

      // Restore scroll position after DOM render
      await nextTick();
      restoreScroll();
    } finally {
      isFetchingData = false;
    }
  }

  function goToPage(page: number, shouldScrollTop = true) {
    if (!mirrorStore.currentStation || !sourceId.value) return;
    mirrorStore.currentPage = page;
    syncRouteQuery();

    mirrorStore.fetchResources(sourceId.value, {
      page,
      pageSize: pageSize.value,
      categoryId: mirrorStore.activeCategoryId || undefined,
      search: mirrorStore.searchQuery || undefined,
      sort: mirrorStore.sortBy,
    });

    if (shouldScrollTop && scrollContainerRef.value) {
      scrollContainerRef.value.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function selectCategory(categoryId: string | null) {
    if (!mirrorStore.currentStation || !sourceId.value) return;
    mirrorStore.setActiveCategory(categoryId);
    mirrorStore.currentPage = 1;
    syncRouteQuery();

    mirrorStore.fetchResources(sourceId.value, {
      page: 1,
      pageSize: pageSize.value,
      categoryId: categoryId || undefined,
      search: mirrorStore.searchQuery || undefined,
      sort: mirrorStore.sortBy,
    });

    if (scrollContainerRef.value) {
      scrollContainerRef.value.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function doSearch() {
    if (!mirrorStore.currentStation || !sourceId.value) return;
    mirrorStore.currentPage = 1;
    syncRouteQuery();

    mirrorStore.fetchResources(sourceId.value, {
      page: 1,
      pageSize: pageSize.value,
      categoryId: mirrorStore.activeCategoryId || undefined,
      search: mirrorStore.searchQuery || undefined,
      sort: mirrorStore.sortBy,
    });

    if (scrollContainerRef.value) {
      scrollContainerRef.value.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function handleSortChange(newSort: string) {
    mirrorStore.setSortBy(newSort);
    doSearch();
  }

  function handlePageSizeChange(newSize: number) {
    pageSize.value = newSize;
    goToPage(1);
  }

  function handleResetAll() {
    mirrorStore.setSearchQuery('');
    mirrorStore.setActiveCategory(null);
    mirrorStore.currentPage = 1;
    mirrorStore.setSortBy('newest');
    syncRouteQuery();

    if (sourceId.value) {
      mirrorStore.fetchResources(sourceId.value, {
        page: 1,
        pageSize: pageSize.value,
        sort: 'newest',
      });
    }

    if (scrollContainerRef.value) {
      scrollContainerRef.value.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function handlePageJump() {
    const page = parseInt(jumpPageInput.value, 10);
    if (!isNaN(page) && page >= 1 && page <= mirrorStore.totalPages) {
      goToPage(page);
    } else {
      jumpPageInput.value = mirrorStore.currentPage.toString();
    }
  }

  function setViewMode(mode: ViewModeType) {
    viewMode.value = mode;
    try {
      localStorage.setItem('mirror_view_mode', mode);
    } catch {
      // Ignore
    }
  }

  function handleNavigateDetail(resourceId: string) {
    saveScroll();
    router.push(`/mirror/resource/${resourceId}`);
  }

  onMounted(() => {
    loadData();
  });

  watch(
    () => [route.params.id, route.params.slug],
    ([newId, newSlug], [oldId, oldSlug]) => {
      if (newId !== oldId || newSlug !== oldSlug) {
        mirrorStore.reset();
        loadData();
      }
    },
  );

  watch(
    () => mirrorStore.currentPage,
    (newPage) => {
      jumpPageInput.value = newPage.toString();
    },
  );

  return {
    scrollContainerRef,
    sourceId,
    viewMode,
    selectedPreviewResource,
    isDrawerOpen,
    jumpPageInput,
    pageSize,
    pageSizeOptions,
    hasAccess,
    mirrorStore,
    loadData,
    goToPage,
    selectCategory,
    doSearch,
    handleSortChange,
    handlePageSizeChange,
    handleResetAll,
    handlePageJump,
    setViewMode,
    handleNavigateDetail,
  };
}
