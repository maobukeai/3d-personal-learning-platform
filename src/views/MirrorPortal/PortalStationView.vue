<script lang="ts">
export default {
  name: 'PortalStationView',
};
</script>

<script setup lang="ts">
import { watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Loader2, ChevronLeft, ChevronRight, FolderOpen } from 'lucide-vue-next';
import MirrorFilterBar from '@/views/Mirror/components/MirrorFilterBar.vue';
import MirrorResourceCard from '@/views/Mirror/components/MirrorResourceCard.vue';
import MirrorResourceDrawer from '@/views/Mirror/components/MirrorResourceDrawer.vue';
import { useMirrorSourceView } from '@/views/Mirror/composables/useMirrorSourceView';
import { useMirrorStore } from '@/stores/mirror';

const route = useRoute();
const router = useRouter();
const mirrorStore = useMirrorStore();

const {
  scrollContainerRef,
  viewMode,
  selectedPreviewResource,
  isDrawerOpen,
  jumpPageInput,
  pageSize,
  pageSizeOptions,
  hasAccess,
  goToPage,
  selectCategory,
  doSearch,
  handleSortChange,
  handlePageSizeChange,
  handleResetAll,
  handlePageJump,
  setViewMode,
  loadData,
} = useMirrorSourceView();

function handleNavigateDetail(resourceId: string) {
  router.push(`/portal/resource/${resourceId}`);
}

async function ensureStationLoaded() {
  if (mirrorStore.stations.length === 0) {
    await mirrorStore.fetchStations();
  }

  const slugParam = (route.params.slug as string)?.trim().toLowerCase();
  const idParam = (route.params.id as string)?.trim().toLowerCase();
  const targetIdentifier = slugParam || idParam;
  const currentHost = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';

  let matchedStation = null;

  if (targetIdentifier) {
    matchedStation = mirrorStore.stations.find((s) => {
      if (s.id.toLowerCase() === targetIdentifier || s.name.toLowerCase() === targetIdentifier) {
        return true;
      }
      try {
        const cfg = s.syncConfig ? JSON.parse(s.syncConfig) : {};
        if (cfg.proxyConfig?.customSlug?.toLowerCase() === targetIdentifier) {
          return true;
        }
      } catch {}
      return false;
    });
  }

  if (!matchedStation && currentHost) {
    matchedStation = mirrorStore.stations.find((s) => {
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
  }

  if (!matchedStation) {
    matchedStation =
      mirrorStore.stations.find((s) => s.status === 'ACTIVE') || mirrorStore.stations[0];
  }

  if (matchedStation) {
    mirrorStore.currentStation = matchedStation;

    // 在非独立自定义域名（如主站 /portal）下进行路由规范化
    const isCustomDomain =
      currentHost &&
      currentHost !== 'localhost' &&
      currentHost !== '127.0.0.1' &&
      currentHost !== 'mao.591595.xyz';

    if (!isCustomDomain) {
      let customSlug = '';
      try {
        const cfg = matchedStation.syncConfig ? JSON.parse(matchedStation.syncConfig) : {};
        customSlug = cfg.proxyConfig?.customSlug?.trim() || '';
      } catch {}

      if (customSlug) {
        if (route.name !== 'MirrorPortalSlug' || route.params.slug !== customSlug) {
          router.replace(`/portal/${customSlug}`);
          return;
        }
      } else {
        if (route.name !== 'MirrorPortalStation' || route.params.id !== matchedStation.id) {
          router.replace(`/portal/mirror/${matchedStation.id}`);
          return;
        }
      }
    }

    await loadData(matchedStation.id);
  }
}

onMounted(() => {
  ensureStationLoaded();
});
</script>

<template>
  <div
    ref="scrollContainerRef"
    class="portal-station-view h-full overflow-y-auto p-3.5 md:p-6 w-full max-w-[1800px] mx-auto scrollbar-hide space-y-4"
  >
    <!-- 2-Row Optimized Compact Filter Bar -->
    <MirrorFilterBar
      :station="mirrorStore.currentStation"
      :total-resources="mirrorStore.totalResources"
      :has-access="hasAccess"
      :categories="mirrorStore.categories"
      :active-category-id="mirrorStore.activeCategoryId"
      :search-query="mirrorStore.searchQuery"
      :sort-by="mirrorStore.sortBy"
      :view-mode="viewMode"
      :resources="mirrorStore.resources"
      :hide-search="true"
      @update:search-query="mirrorStore.setSearchQuery($event)"
      @update:sort-by="handleSortChange"
      @update:view-mode="setViewMode"
      @select-category="selectCategory"
      @search="doSearch"
      @reset-all="handleResetAll"
    />

    <div class="min-w-0">
      <!-- Loading Skeletons -->
      <div
        v-if="mirrorStore.isLoadingResources"
        class="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-2.5 sm:gap-4 md:gap-5"
      >
        <div
          v-for="n in 10"
          :key="n"
          class="rounded-xl sm:rounded-2xl bg-white/70 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 p-2.5 sm:p-3.5 space-y-2.5 animate-pulse"
        >
          <div
            class="w-full aspect-[16/10] bg-slate-200/70 dark:bg-slate-800 rounded-lg sm:rounded-xl"
          />
          <div class="h-3.5 bg-slate-200/70 dark:bg-slate-800 rounded w-4/5" />
          <div class="h-2.5 bg-slate-200/70 dark:bg-slate-800 rounded w-1/2" />
          <div class="flex items-center justify-between pt-1">
            <div class="h-2 bg-slate-200/70 dark:bg-slate-800 rounded w-1/3" />
            <div class="h-2 bg-slate-200/70 dark:bg-slate-800 rounded w-1/4" />
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div
        v-else-if="mirrorStore.resources.length === 0"
        class="flex flex-col items-center justify-center py-20 bg-white/60 dark:bg-slate-800/40 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 p-8 text-center"
      >
        <div
          class="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-4"
        >
          <FolderTree class="w-7 h-7" />
        </div>
        <h3 class="text-base font-bold text-slate-800 dark:text-slate-200 mb-1">
          暂无匹配的资源资产
        </h3>
        <p class="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-5">
          未找到与当前检索条件匹配的数字资产，请尝试清除分类或更改搜索词。
        </p>
        <button
          type="button"
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          @click="resetFilters"
        >
          重置检索条件
        </button>
      </div>

      <!-- Resource Grid -->
      <div
        v-else
        :class="
          viewMode === 'grid-comfortable'
            ? 'grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-2.5 sm:gap-4 md:gap-5'
            : viewMode === 'grid-compact'
              ? 'grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6 gap-2 sm:gap-3 md:gap-4'
              : 'flex flex-col space-y-3'
        "
      >
        <MirrorResourceCard
          v-for="resource in mirrorStore.resources"
          :key="resource.id"
          :resource="resource"
          :view-mode="viewMode"
          @click="handleNavigateDetail(resource.id)"
          @preview="
            selectedPreviewResource = $event;
            isDrawerOpen = true;
          "
          @tag-click="
            mirrorStore.setSearchQuery($event);
            doSearch();
          "
        />
      </div>

      <!-- Pagination Bar -->
      <div
        v-if="mirrorStore.totalPages > 1 || mirrorStore.totalResources > 20"
        class="flex flex-wrap items-center justify-between gap-3 mt-8 p-3 bg-white/80 dark:bg-slate-900/80 rounded-2xl border border-slate-200/80 dark:border-slate-800 backdrop-blur-md shadow-2xs"
      >
        <div class="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <span>每页：</span>
          <div
            class="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200/60 dark:border-slate-700/60"
          >
            <button
              v-for="size in pageSizeOptions"
              :key="size"
              type="button"
              class="px-2 py-0.5 rounded-md font-medium text-xs transition-all cursor-pointer"
              :class="
                pageSize === size
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              "
              @click="handlePageSizeChange(size)"
            >
              {{ size }}
            </button>
          </div>
          <span>条</span>
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            class="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-all cursor-pointer"
            :disabled="mirrorStore.currentPage <= 1"
            @click="goToPage(mirrorStore.currentPage - 1)"
          >
            <ChevronLeft class="w-4 h-4" />
          </button>

          <span class="text-xs font-semibold text-slate-600 dark:text-slate-300 px-1.5">
            第
            <span class="text-slate-900 dark:text-white font-bold">{{
              mirrorStore.currentPage
            }}</span>
            / {{ mirrorStore.totalPages }} 页
            <span class="text-slate-400 font-normal ml-1"
              >（共 {{ mirrorStore.totalResources }} 项）</span
            >
          </span>

          <button
            type="button"
            class="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-all cursor-pointer"
            :disabled="mirrorStore.currentPage >= mirrorStore.totalPages"
            @click="goToPage(mirrorStore.currentPage + 1)"
          >
            <ChevronRight class="w-4 h-4" />
          </button>
        </div>

        <div class="flex items-center gap-1.5 border-l border-slate-200 dark:border-slate-800 pl-3">
          <span class="text-xs text-slate-400">前往</span>
          <input
            v-model="jumpPageInput"
            type="text"
            class="w-10 px-1.5 py-0.5 text-center text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-400"
            @keyup.enter="handlePageJump"
          />
          <span class="text-xs text-slate-400">页</span>
        </div>
      </div>
    </div>

    <MirrorResourceDrawer
      v-model:open="isDrawerOpen"
      :resource="selectedPreviewResource"
      @navigate="handleNavigateDetail"
    />
  </div>
</template>
