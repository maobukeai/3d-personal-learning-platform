<script lang="ts">
export default {
  name: 'PortalStationView',
};
</script>

<script setup lang="ts">
import { computed, watch, onMounted } from 'vue';
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
  if (!route.params.id) {
    if (mirrorStore.stations.length === 0) {
      await mirrorStore.fetchStations();
    }
    const valid =
      mirrorStore.stations.find((s) => s.status === 'ACTIVE') || mirrorStore.stations[0];
    if (valid) {
      router.replace(`/portal/mirror/${valid.id}`);
      return;
    }
  }
  loadData();
}

onMounted(ensureStationLoaded);

watch(
  () => route.params.id,
  () => {
    if (route.params.id) {
      mirrorStore.reset();
      loadData();
    }
  },
);
</script>

<template>
  <div
    ref="scrollContainerRef"
    class="portal-station-view h-full overflow-y-auto p-3 md:p-6 w-full max-w-[1800px] mx-auto scrollbar-hide"
  >
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
      @update:search-query="mirrorStore.setSearchQuery($event)"
      @update:sort-by="handleSortChange"
      @update:view-mode="setViewMode"
      @select-category="selectCategory"
      @search="doSearch"
      @reset-all="handleResetAll"
    />

    <div class="min-w-0">
      <div
        v-if="mirrorStore.isLoadingResources"
        class="flex flex-col items-center justify-center py-24"
      >
        <Loader2 class="w-8 h-8 animate-spin text-blue-500 mb-3" />
        <span class="text-sm font-medium text-slate-500 dark:text-slate-400"
          >正在加载资源库...</span
        >
      </div>

      <div
        v-else-if="mirrorStore.resources.length === 0"
        class="flex flex-col items-center justify-center py-20 bg-white/40 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700/60"
      >
        <FolderOpen class="w-12 h-12 text-slate-300 dark:text-slate-600 mb-3" />
        <p class="text-sm font-bold text-slate-700 dark:text-slate-300">没有找到相关资源</p>
        <p v-if="mirrorStore.searchQuery" class="text-xs text-slate-400 mt-1">
          建议尝试其他关键词或清空当前搜索条件
        </p>
      </div>

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
