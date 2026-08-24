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

  const targetIdentifier = ((route.params.slug || route.params.id) as string)?.trim().toLowerCase();
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
        if (cfg.proxyConfig?.customDomain?.toLowerCase() === currentHost) {
          return true;
        }
      } catch {}
      return false;
    });
  }

  if (!matchedStation) {
    matchedStation =
      mirrorStore.stations.find((s) => s.status === 'ACTIVE') || mirrorStore.stations[0];
  }

  if (matchedStation && route.params.id !== matchedStation.id) {
    router.replace(`/portal/mirror/${matchedStation.id}`);
    return;
  }

  loadData();
}

onMounted(ensureStationLoaded);

watch(
  () => [route.params.id, route.params.slug],
  () => {
    ensureStationLoaded();
  },
);
</script>

<template>
  <div
    ref="scrollContainerRef"
    class="portal-station-view h-full overflow-y-auto p-3 md:p-6 w-full max-w-[1800px] mx-auto scrollbar-hide space-y-3"
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
        class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-4 md:gap-5"
      >
        <div
          v-for="n in 10"
          :key="n"
          class="rounded-3xl bg-white/60 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 p-3.5 space-y-3 animate-pulse"
        >
          <div class="w-full aspect-[16/10] bg-slate-200 dark:bg-slate-700/60 rounded-2xl" />
          <div class="h-4 bg-slate-200 dark:bg-slate-700/60 rounded-lg w-4/5" />
          <div class="h-3 bg-slate-200 dark:bg-slate-700/60 rounded-lg w-1/2" />
          <div
            class="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700/40"
          >
            <div class="h-3 bg-slate-200 dark:bg-slate-700/60 rounded w-1/3" />
            <div class="h-6 w-16 bg-slate-200 dark:bg-slate-700/60 rounded-xl" />
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div
        v-else-if="mirrorStore.resources.length === 0"
        class="flex flex-col items-center justify-center py-20 bg-white/40 dark:bg-slate-800/30 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700/60 p-6 text-center space-y-3"
      >
        <div
          class="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-500"
        >
          <FolderOpen class="w-7 h-7" />
        </div>
        <div>
          <p class="text-sm font-bold text-slate-800 dark:text-slate-200">未找到符合条件的资源</p>
          <p v-if="mirrorStore.searchQuery" class="text-xs text-slate-400 mt-1">
            当前搜索词：“{{ mirrorStore.searchQuery }}”
          </p>
        </div>
        <button
          type="button"
          class="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
          @click="handleResetAll"
        >
          清空搜索条件并重置
        </button>
      </div>

      <!-- Resource Grid -->
      <div
        v-else
        :class="
          viewMode === 'grid-comfortable'
            ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-4 md:gap-5'
            : viewMode === 'grid-compact'
              ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6 gap-3 md:gap-4'
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
        class="flex flex-wrap items-center justify-between gap-3 mt-10 p-3.5 bg-white/70 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/50 backdrop-blur-xs shadow-xs"
      >
        <div class="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <span>每页显示：</span>
          <div
            class="flex items-center gap-1 bg-slate-100 dark:bg-slate-900/60 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700"
          >
            <button
              v-for="size in pageSizeOptions"
              :key="size"
              type="button"
              class="px-2 py-0.5 rounded-md font-medium transition-all cursor-pointer"
              :class="
                pageSize === size
                  ? 'bg-blue-600 text-white shadow-xs font-bold'
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
            class="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-blue-600 hover:border-blue-500 disabled:opacity-30 transition-all cursor-pointer"
            :disabled="mirrorStore.currentPage <= 1"
            @click="goToPage(mirrorStore.currentPage - 1)"
          >
            <ChevronLeft class="w-4 h-4" />
          </button>

          <span class="text-xs md:text-sm font-semibold text-slate-600 dark:text-slate-300 px-2">
            第
            <span class="text-blue-600 dark:text-blue-400 font-black">{{
              mirrorStore.currentPage
            }}</span>
            / {{ mirrorStore.totalPages }} 页
            <span class="text-slate-400 font-normal ml-1"
              >（共 {{ mirrorStore.totalResources }} 项）</span
            >
          </span>

          <button
            type="button"
            class="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-blue-600 hover:border-blue-500 disabled:opacity-30 transition-all cursor-pointer"
            :disabled="mirrorStore.currentPage >= mirrorStore.totalPages"
            @click="goToPage(mirrorStore.currentPage + 1)"
          >
            <ChevronRight class="w-4 h-4" />
          </button>
        </div>

        <div class="flex items-center gap-1.5 border-l border-slate-200 dark:border-slate-700 pl-3">
          <span class="text-xs text-slate-400">跳至</span>
          <input
            v-model="jumpPageInput"
            type="text"
            class="w-12 px-1.5 py-1 text-center text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
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
