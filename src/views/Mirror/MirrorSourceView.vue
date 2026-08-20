<script lang="ts">
export default {
  name: 'MirrorSourceView',
};
</script>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Loader2, ChevronLeft, ChevronRight, FolderOpen } from 'lucide-vue-next';
import { useMirrorStore, type MirrorResource } from '@/stores/mirror';
import { useAuthStore } from '@/stores/auth';

import MirrorFilterBar, { type ViewModeType } from './components/MirrorFilterBar.vue';
import MirrorResourceCard from './components/MirrorResourceCard.vue';
import MirrorResourceDrawer from './components/MirrorResourceDrawer.vue';

const route = useRoute();
const router = useRouter();
const mirrorStore = useMirrorStore();
const authStore = useAuthStore();

const sourceId = computed(() => route.params.id as string);
const viewMode = ref<ViewModeType>('grid-comfortable');
const selectedPreviewResource = ref<MirrorResource | null>(null);
const isDrawerOpen = ref(false);
const jumpPageInput = ref('1');
const pageSize = ref(20);
const pageSizeOptions = [20, 40, 60];

const hasAccess = computed(() => {
  if (!mirrorStore.currentStation) return null;
  const userPriority = authStore.user?.subscription?.plan?.priority ?? 0;
  return userPriority >= mirrorStore.currentStation.minPlanPriority;
});

async function loadData() {
  await Promise.all([
    mirrorStore.fetchStation(sourceId.value),
    mirrorStore.fetchCategories(sourceId.value),
  ]);

  if (mirrorStore.isNotFound || !mirrorStore.currentStation) {
    await mirrorStore.fetchStations();
    const validStation =
      mirrorStore.stations.find((s) => s.status === 'ACTIVE') || mirrorStore.stations[0];
    if (validStation && validStation.id !== sourceId.value) {
      router.replace(`/mirror/source/${validStation.id}`);
      return;
    }
  }

  if (!mirrorStore.currentStation) return;

  const initialCategory = route.query.categoryId as string | undefined;
  if (initialCategory !== undefined) {
    mirrorStore.setActiveCategory(initialCategory || null);
  }

  mirrorStore.fetchResources(sourceId.value, {
    page: mirrorStore.currentPage,
    pageSize: pageSize.value,
    categoryId: mirrorStore.activeCategoryId || undefined,
    search: mirrorStore.searchQuery || undefined,
    sort: mirrorStore.sortBy,
  });
}

function goToPage(page: number) {
  if (!mirrorStore.currentStation || !sourceId.value) return;
  mirrorStore.currentPage = page;
  mirrorStore.fetchResources(sourceId.value, {
    page,
    pageSize: pageSize.value,
    categoryId: mirrorStore.activeCategoryId || undefined,
    search: mirrorStore.searchQuery || undefined,
    sort: mirrorStore.sortBy,
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function selectCategory(categoryId: string | null) {
  if (!mirrorStore.currentStation || !sourceId.value) return;
  mirrorStore.setActiveCategory(categoryId);

  const query = { ...route.query };
  if (categoryId) query.categoryId = categoryId;
  else delete query.categoryId;
  router.replace({ query });

  mirrorStore.fetchResources(sourceId.value, {
    page: 1,
    pageSize: pageSize.value,
    categoryId: categoryId || undefined,
    search: mirrorStore.searchQuery || undefined,
    sort: mirrorStore.sortBy,
  });
}

function doSearch() {
  if (!mirrorStore.currentStation || !sourceId.value) return;
  mirrorStore.currentPage = 1;
  mirrorStore.fetchResources(sourceId.value, {
    page: 1,
    pageSize: pageSize.value,
    categoryId: mirrorStore.activeCategoryId || undefined,
    search: mirrorStore.searchQuery || undefined,
    sort: mirrorStore.sortBy,
  });
}

function handlePageSizeChange(newSize: number) {
  pageSize.value = newSize;
  goToPage(1);
}

function handleResetAll() {
  mirrorStore.setSearchQuery('');
  selectCategory(null);
}

function handlePageJump() {
  const page = parseInt(jumpPageInput.value, 10);
  if (!isNaN(page) && page >= 1 && page <= mirrorStore.totalPages) {
    goToPage(page);
  } else {
    jumpPageInput.value = mirrorStore.currentPage.toString();
  }
}

onMounted(() => loadData());

watch(
  () => route.params.id,
  () => {
    if (route.name === 'MirrorSource' && route.params.id) {
      mirrorStore.reset();
      loadData();
    }
  },
);

watch(
  () => route.query.categoryId,
  (newId) => {
    if (!sourceId.value) return;
    const newCategoryId = (newId as string) || null;
    if (mirrorStore.activeCategoryId !== newCategoryId) selectCategory(newCategoryId);
  },
);

watch(
  () => mirrorStore.currentPage,
  (newPage) => {
    jumpPageInput.value = newPage.toString();
  },
);
</script>

<template>
  <div
    class="mirror-source-view h-full overflow-y-auto p-3 md:p-5 w-full max-w-[1800px] mx-auto scrollbar-hide"
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
      @update:sort-by="mirrorStore.setSortBy($event)"
      @update:view-mode="viewMode = $event"
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
          >正在极速加载高质感资源...</span
        >
      </div>

      <div
        v-else-if="mirrorStore.resources.length === 0"
        class="flex flex-col items-center justify-center py-20 bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700/60"
      >
        <FolderOpen class="w-12 h-12 text-slate-300 dark:text-slate-600 mb-3" />
        <p class="text-sm font-bold text-slate-700 dark:text-slate-300">没有找到相关资源</p>
        <p v-if="mirrorStore.searchQuery" class="text-xs text-slate-400 mt-1">
          建议尝试其他关键词或清空当前搜索条件
        </p>
        <p v-else class="text-xs text-slate-400 mt-1">等待镜像节点同步完成</p>
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
          @click="router.push(`/mirror/resource/${resource.id}`)"
          @preview="
            selectedPreviewResource = $event;
            isDrawerOpen = true;
          "
          @tag-click="
            mirrorStore.searchQuery = $event;
            doSearch();
          "
        />
      </div>

      <!-- Enhanced Bottom Pagination Bar -->
      <div
        v-if="mirrorStore.totalPages > 1 || mirrorStore.totalResources > 20"
        class="flex flex-wrap items-center justify-between gap-3 mt-10 p-3.5 bg-white/70 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/50 backdrop-blur-xs shadow-xs"
      >
        <!-- Page size selector -->
        <div class="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <span>每页显示：</span>
          <div
            class="flex items-center gap-1 bg-slate-100 dark:bg-slate-900/60 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700"
          >
            <button
              v-for="size in pageSizeOptions"
              :key="size"
              type="button"
              class="px-2 py-0.5 rounded-md font-medium transition-all"
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

        <!-- Pager -->
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-blue-600 hover:border-blue-500 disabled:opacity-30 transition-all"
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
            class="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-blue-600 hover:border-blue-500 disabled:opacity-30 transition-all"
            :disabled="mirrorStore.currentPage >= mirrorStore.totalPages"
            @click="goToPage(mirrorStore.currentPage + 1)"
          >
            <ChevronRight class="w-4 h-4" />
          </button>
        </div>

        <!-- Quick Jump -->
        <div class="flex items-center gap-1.5 border-l border-slate-200 dark:border-slate-700 pl-3">
          <span class="text-xs text-slate-400">跳至</span>
          <input
            v-model="jumpPageInput"
            type="text"
            class="w-12 px-1.5 py-1 text-center text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            @keyup.enter="handlePageJump"
            @blur="handlePageJump"
          />
          <span class="text-xs text-slate-400">页</span>
        </div>
      </div>
    </div>

    <MirrorResourceDrawer
      v-model:open="isDrawerOpen"
      :resource="selectedPreviewResource"
      @navigate="router.push(`/mirror/resource/${$event}`)"
    />
  </div>
</template>
