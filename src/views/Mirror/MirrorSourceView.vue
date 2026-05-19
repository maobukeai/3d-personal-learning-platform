<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  Search,
  Clock,
  Eye,
  Shield,
  Sparkles,
  ExternalLink,
  Loader2,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  SlidersHorizontal,
  X,
} from 'lucide-vue-next';
import { useMirrorStore } from '@/stores/mirror';
import { useAuthStore } from '@/stores/auth';
import { getPlanName } from '@/utils/plans';
import { getAssetUrl } from '@/utils/api';

const route = useRoute();
const router = useRouter();
const mirrorStore = useMirrorStore();
const authStore = useAuthStore();

const sourceId = computed(() => route.params.id as string);
const viewMode = ref<'grid' | 'list'>('grid');
const showFilters = ref(false);

const userPlanPriority = computed(() => {
  return authStore.user?.subscription?.plan?.priority ?? 0;
});

const hasAccess = computed(() => {
  if (!mirrorStore.currentSource) return false;
  return userPlanPriority.value >= mirrorStore.currentSource.minPlanPriority;
});

const pageTitle = computed(() => {
  if (!mirrorStore.currentSource) return '加载中...';
  if (mirrorStore.activeCategoryId) {
    const activeCat = mirrorStore.categories.find(c => c.id === mirrorStore.activeCategoryId);
    if (activeCat) {
      return activeCat.name;
    }
  }
  return mirrorStore.currentSource.displayName;
});

async function loadData() {
  await Promise.all([
    mirrorStore.fetchSource(sourceId.value),
    mirrorStore.fetchCategories(sourceId.value),
  ]);
  
  const initialCategory = route.query.categoryId as string | undefined;
  if (initialCategory !== undefined) {
    mirrorStore.setActiveCategory(initialCategory || null);
  }
  mirrorStore.fetchResources(sourceId.value, {
    page: mirrorStore.currentPage,
    categoryId: mirrorStore.activeCategoryId || undefined,
    search: mirrorStore.searchQuery || undefined,
    sort: mirrorStore.sortBy,
  });
}

function goToPage(page: number) {
  mirrorStore.currentPage = page;
  mirrorStore.fetchResources(sourceId.value, {
    page,
    categoryId: mirrorStore.activeCategoryId || undefined,
    search: mirrorStore.searchQuery || undefined,
    sort: mirrorStore.sortBy,
  });
}

function selectCategory(categoryId: string | null) {
  mirrorStore.setActiveCategory(categoryId);
  mirrorStore.fetchResources(sourceId.value, {
    page: 1,
    categoryId: categoryId || undefined,
    search: mirrorStore.searchQuery || undefined,
    sort: mirrorStore.sortBy,
  });
}

function doSearch() {
  mirrorStore.currentPage = 1;
  mirrorStore.fetchResources(sourceId.value, {
    page: 1,
    categoryId: mirrorStore.activeCategoryId || undefined,
    search: mirrorStore.searchQuery || undefined,
    sort: mirrorStore.sortBy,
  });
}

function viewResource(resourceId: string) {
  router.push(`/mirror/resource/${resourceId}`);
}

function formatDate(date: string | null) {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('zh-CN');
}

function parseTags(tags: string | null) {
  if (!tags) return [];
  try {
    return JSON.parse(tags);
  } catch {
    return [];
  }
}

onMounted(() => {
  loadData();
});

watch(() => route.params.id, () => {
  if (route.params.id) {
    mirrorStore.reset();
    loadData();
  }
});

watch(() => route.query.categoryId, (newId) => {
  const newCategoryId = (newId as string) || null;
  if (mirrorStore.activeCategoryId !== newCategoryId) {
    selectCategory(newCategoryId);
  }
});
</script>

<template>
  <div class="mirror-source-view h-full overflow-y-auto p-3 md:p-6 w-full max-w-[1800px] mx-auto scrollbar-hide">
    <div class="flex items-center gap-3 mb-6">
      <div class="flex-1">
        <h1 class="text-xl font-bold text-slate-900 dark:text-white">
          {{ pageTitle }}
        </h1>
        <p class="text-xs text-slate-400">
          {{ mirrorStore.totalResources }} 个资源
        </p>
      </div>
      <div v-if="!hasAccess" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-600 text-sm">
        <Shield class="w-4 h-4" />
        需要{{ getPlanName(mirrorStore.currentSource?.minPlanPriority) }}及以上
      </div>
    </div>

    <div class="flex flex-col sm:flex-row gap-3 mb-6">
      <div class="flex-1 relative">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          v-model="mirrorStore.searchQuery"
          type="text"
          placeholder="搜索资源..."
          class="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
          @keyup.enter="doSearch"
        />
      </div>
      <div class="flex items-center gap-2">
        <button
          class="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          @click="showFilters = !showFilters"
        >
          <SlidersHorizontal class="w-4 h-4" />
          排序
        </button>
        <button
          class="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          :class="viewMode === 'grid' ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20' : ''"
          @click="viewMode = 'grid'"
        >
          <LayoutGrid class="w-4 h-4" />
        </button>
        <button
          class="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          :class="viewMode === 'list' ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20' : ''"
          @click="viewMode = 'list'"
        >
          <List class="w-4 h-4" />
        </button>
      </div>
    </div>

    <div v-if="showFilters" class="flex items-center gap-2 mb-4 p-3 bg-slate-50 dark:bg-slate-800/30 rounded-lg">
      <span class="text-xs text-slate-500">排序：</span>
      <button
        v-for="opt in [{ label: '最新', value: 'newest' }, { label: '最旧', value: 'oldest' }, { label: '标题', value: 'title' }]"
        :key="opt.value"
        class="px-2.5 py-1 text-xs rounded-md transition-colors"
        :class="mirrorStore.sortBy === opt.value ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600' : 'bg-white dark:bg-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'"
        @click="mirrorStore.setSortBy(opt.value); doSearch()"
      >
        {{ opt.label }}
      </button>
      <button class="ml-auto p-1 text-slate-400 hover:text-slate-600" @click="showFilters = false">
        <X class="w-4 h-4" />
      </button>
    </div>

    <div class="flex flex-col md:flex-row gap-6">
      <div class="flex-1 min-w-0">
        <div v-if="mirrorStore.isLoadingResources" class="flex items-center justify-center py-20">
          <Loader2 class="w-6 h-6 animate-spin text-blue-500" />
          <span class="ml-2 text-slate-500">加载资源中...</span>
        </div>

        <div v-else-if="mirrorStore.resources.length === 0" class="text-center py-20">
          <Sparkles class="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p class="text-slate-500">暂无资源</p>
          <p v-if="mirrorStore.searchQuery" class="text-xs text-slate-400 mt-1">尝试其他关键词</p>
          <p v-else class="text-xs text-slate-400 mt-1">等待数据同步完成</p>
        </div>

        <div v-else :class="viewMode === 'grid' ? 'grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-2 md:gap-4' : 'space-y-3'">
          <div
            v-for="resource in mirrorStore.resources"
            :key="resource.id"
            class="bg-white dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700/50 p-2 md:p-4 hover:border-blue-200 dark:hover:border-blue-500/20 hover:shadow-sm transition-all cursor-pointer"
            :class="viewMode === 'list' ? 'flex gap-3 md:gap-4' : ''"
            @click="viewResource(resource.id)"
          >
            <div class="mb-2 md:mb-3" :class="viewMode === 'list' ? 'w-24 md:w-28 flex-shrink-0 mb-0' : ''">
              <div
                v-if="resource.thumbnailUrl"
                class="w-full rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-700"
                :class="viewMode === 'list' ? 'w-24 h-16 md:w-28 md:h-20' : 'aspect-[16/10]'"
              >
                <img
                  :src="getAssetUrl(resource.thumbnailUrl)"
                  :alt="resource.title"
                  class="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                  loading="lazy"
                  @error="($event.target as HTMLImageElement).style.display = 'none'"
                />
              </div>
              <div
                v-else
                class="w-full rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-300 dark:text-slate-600"
                :class="viewMode === 'list' ? 'w-24 h-16 md:w-28 md:h-20' : 'aspect-[16/10]'"
              >
                <ExternalLink class="w-5 h-5 md:w-6 md:h-6" />
              </div>
            </div>

            <div class="flex-1 min-w-0">
              <h3 class="font-medium text-xs md:text-sm text-slate-900 dark:text-white line-clamp-2 hover:text-blue-600 transition-colors">
                {{ resource.title }}
              </h3>

              <div v-if="resource.category" class="mt-1">
                <span class="inline-block px-1.5 py-0.5 text-[9px] md:text-xs rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-500">
                  {{ resource.category.name }}
                </span>
              </div>

              <p v-if="resource.description" class="hidden md:line-clamp-2 text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                {{ resource.description }}
              </p>

              <div class="flex items-center gap-2 md:gap-3 mt-1.5 text-[10px] md:text-xs text-slate-400">
                <span v-if="resource.publishedAt" class="hidden md:flex items-center gap-1">
                  <Clock class="w-3 h-3" />
                  {{ formatDate(resource.publishedAt) }}
                </span>
                <span class="flex items-center gap-1">
                  <Eye class="w-3 h-3" />
                  {{ resource.viewCount }}
                </span>
              </div>

              <div v-if="parseTags(resource.tags).length > 0" class="hidden md:flex flex-wrap gap-1 mt-2">
                <span
                  v-for="tag in parseTags(resource.tags).slice(0, 3)"
                  :key="tag"
                  class="px-1.5 py-0.5 text-xs rounded bg-slate-100 dark:bg-slate-700 text-slate-500"
                >
                  {{ tag }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div v-if="mirrorStore.totalPages > 1" class="flex items-center justify-center gap-2 mt-8">
          <button
            class="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600 disabled:opacity-30 transition-colors"
            :disabled="mirrorStore.currentPage <= 1"
            @click="goToPage(mirrorStore.currentPage - 1)"
          >
            <ChevronLeft class="w-4 h-4" />
          </button>
          <span class="text-sm text-slate-500 px-3">
            {{ mirrorStore.currentPage }} / {{ mirrorStore.totalPages }}
          </span>
          <button
            class="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600 disabled:opacity-30 transition-colors"
            :disabled="mirrorStore.currentPage >= mirrorStore.totalPages"
            @click="goToPage(mirrorStore.currentPage + 1)"
          >
            <ChevronRight class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>