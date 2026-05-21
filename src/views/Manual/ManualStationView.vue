<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  Search,
  Clock,
  Eye,
  Shield,
  Sparkles,
  Loader2,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  SlidersHorizontal,
  X,
  BookOpen,
} from 'lucide-vue-next';
import { useManualStore } from '@/stores/manual';
import { useAuthStore } from '@/stores/auth';
import { getPlanName } from '@/utils/plans';
import { getAssetUrl } from '@/utils/api';

const route = useRoute();
const router = useRouter();
const manualStore = useManualStore();
const authStore = useAuthStore();

const stationId = computed(() => route.params.id as string);
const viewMode = ref<'grid' | 'list'>('grid');
const showFilters = ref(false);

const userPlanPriority = computed(() => {
  return authStore.user?.subscription?.plan?.priority ?? 0;
});

const hasAccess = computed(() => {
  if (!manualStore.currentStation) return null;
  return userPlanPriority.value >= manualStore.currentStation.minPlanPriority;
});

const pageTitle = computed(() => {
  if (!manualStore.currentStation) return '加载中...';
  if (manualStore.activeCategoryId) {
    const activeCat = manualStore.categories.find(c => c.id === manualStore.activeCategoryId);
    if (activeCat) {
      return activeCat.name;
    }
  }
  return manualStore.currentStation.displayName;
});

async function loadData() {
  await Promise.all([
    manualStore.fetchStation(stationId.value),
    manualStore.fetchCategories(stationId.value),
  ]);
  
  const initialCategory = route.query.categoryId as string | undefined;
  if (initialCategory !== undefined) {
    manualStore.setActiveCategory(initialCategory || null);
  }
  manualStore.fetchResources(stationId.value, {
    page: manualStore.currentPage,
    categoryId: manualStore.activeCategoryId || undefined,
    search: manualStore.searchQuery || undefined,
    sort: manualStore.sortBy,
  });
}

function goToPage(page: number) {
  manualStore.currentPage = page;
  manualStore.fetchResources(stationId.value, {
    page,
    categoryId: manualStore.activeCategoryId || undefined,
    search: manualStore.searchQuery || undefined,
    sort: manualStore.sortBy,
  });
}

function selectCategory(categoryId: string | null) {
  manualStore.setActiveCategory(categoryId);
  manualStore.fetchResources(stationId.value, {
    page: 1,
    categoryId: categoryId || undefined,
    search: manualStore.searchQuery || undefined,
    sort: manualStore.sortBy,
  });
}

function doSearch() {
  manualStore.currentPage = 1;
  manualStore.fetchResources(stationId.value, {
    page: 1,
    categoryId: manualStore.activeCategoryId || undefined,
    search: manualStore.searchQuery || undefined,
    sort: manualStore.sortBy,
  });
}

function viewResource(resourceId: string) {
  router.push(`/manual/resource/${resourceId}`);
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
    if (tags.includes(',')) {
      return tags.split(',').map(t => t.trim());
    }
    return [tags];
  }
}

onMounted(() => {
  loadData();
});

watch(() => route.params.id, () => {
  if (route.params.id) {
    manualStore.reset();
    loadData();
  }
});

watch(() => route.query.categoryId, (newId) => {
  const newCategoryId = (newId as string) || null;
  if (manualStore.activeCategoryId !== newCategoryId) {
    selectCategory(newCategoryId);
  }
});

const jumpPageInput = ref(manualStore.currentPage.toString());

watch(() => manualStore.currentPage, (newPage) => {
  jumpPageInput.value = newPage.toString();
});

function handlePageJump() {
  const page = parseInt(jumpPageInput.value, 10);
  if (!isNaN(page) && page >= 1 && page <= manualStore.totalPages) {
    goToPage(page);
  } else {
    jumpPageInput.value = manualStore.currentPage.toString();
  }
}
</script>

<template>
  <div class="manual-station-view h-full overflow-y-auto p-4 md:p-6 w-full max-w-[1800px] mx-auto scrollbar-hide">
    <!-- Header banner -->
    <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 bg-gradient-to-r from-cyan-500/10 via-emerald-500/5 to-transparent p-4 md:p-5 rounded-2xl border border-cyan-500/10 backdrop-blur-sm shadow-sm">
      <div class="flex flex-col md:flex-row md:items-center gap-3 md:gap-4 flex-1 min-w-0">
        <!-- Title and Icon Badge -->
        <div class="flex items-center gap-2.5 shrink-0">
          <span class="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-600 dark:text-cyan-400">
            <BookOpen class="w-4.5 h-4.5" />
          </span>
          <h1 class="text-xl font-black text-slate-900 dark:text-white tracking-tight">
            {{ pageTitle }}
          </h1>
          <span class="px-2 py-0.5 text-[10px] font-black rounded bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">
            手动资产站
          </span>
        </div>

        <!-- Vertical divider for desktop -->
        <span class="hidden md:inline text-slate-200 dark:text-slate-800">|</span>

        <!-- Description -->
        <p class="text-xs md:text-sm text-slate-500 dark:text-slate-400 font-medium truncate flex-1">
          {{ manualStore.currentStation?.description || '尊享海量精品人工整理资产，快捷高效极速获取' }}
        </p>

        <!-- Vertical divider for desktop -->
        <span class="hidden md:inline text-slate-200 dark:text-slate-800">|</span>

        <!-- Resource Stats -->
        <p class="text-xs text-slate-400 shrink-0 font-medium">
          当前包含共计 <span class="text-cyan-500 font-black">{{ manualStore.totalResources }}</span> 个精心挑选的资源
        </p>
      </div>

      <!-- Right Access Badge -->
      <div v-if="hasAccess === false" class="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-semibold shrink-0">
        <Shield class="w-4 h-4 shrink-0 animate-pulse" />
        <div class="flex items-center gap-1.5">
          <span class="text-[10px] text-slate-400">获取权限：</span>
          <span class="text-[11px] font-bold">需要 {{ getPlanName(manualStore.currentStation?.minPlanPriority ?? 0) }} 会员</span>
        </div>
      </div>
    </div>


    <!-- Search and filter tools -->
    <div class="flex flex-col sm:flex-row gap-3 mb-6">
      <div class="flex-1 relative">
        <Search class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 focus-within:text-cyan-500 transition-colors" />
        <input
          v-model="manualStore.searchQuery"
          type="text"
          placeholder="搜索你想要的资源..."
          class="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all shadow-sm"
          @keyup.enter="doSearch"
        />
        <button
          v-if="manualStore.searchQuery"
          class="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          @click="manualStore.searchQuery = ''; doSearch()"
        >
          <X class="w-4 h-4" />
        </button>
      </div>
      <div class="flex items-center gap-2">
        <button
          class="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 text-sm text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900/50 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all font-medium shadow-sm"
          :class="showFilters ? 'border-cyan-500/30 text-cyan-600 dark:text-cyan-400' : ''"
          @click="showFilters = !showFilters"
        >
          <SlidersHorizontal class="w-4 h-4" />
          排序过滤
        </button>
        <button
          class="p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-400 bg-white dark:bg-slate-900/50 hover:text-slate-600 dark:hover:text-slate-200 transition-all shadow-sm"
          :class="viewMode === 'grid' ? 'bg-cyan-50 dark:bg-cyan-500/10 border-cyan-200 dark:border-cyan-500/20 text-cyan-600 dark:text-cyan-400' : ''"
          @click="viewMode = 'grid'"
        >
          <LayoutGrid class="w-4.5 h-4.5" />
        </button>
        <button
          class="p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-400 bg-white dark:bg-slate-900/50 hover:text-slate-600 dark:hover:text-slate-200 transition-all shadow-sm"
          :class="viewMode === 'list' ? 'bg-cyan-50 dark:bg-cyan-500/10 border-cyan-200 dark:border-cyan-500/20 text-cyan-600 dark:text-cyan-400' : ''"
          @click="viewMode = 'list'"
        >
          <List class="w-4.5 h-4.5" />
        </button>
      </div>
    </div>

    <!-- Active sorting indicators -->
    <div v-if="showFilters" class="flex items-center gap-2 mb-6 p-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-slate-800/50">
      <span class="text-xs text-slate-400 font-bold">排序选项：</span>
      <button
        v-for="opt in [{ label: '最新发布', value: 'newest' }, { label: '最早发布', value: 'oldest' }, { label: '资源浏览量', value: 'views' }, { label: '拼音标题', value: 'title' }]"
        :key="opt.value"
        class="px-3.5 py-1.5 text-xs rounded-lg font-semibold transition-all"
        :class="manualStore.sortBy === opt.value ? 'bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 shadow-sm border border-cyan-500/20' : 'bg-white dark:bg-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 border border-transparent'"
        @click="manualStore.setSortBy(opt.value); doSearch()"
      >
        {{ opt.label }}
      </button>
      <button class="ml-auto p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" @click="showFilters = false">
        <X class="w-4.5 h-4.5" />
      </button>
    </div>

    <!-- Main List/Grid Layout -->
    <div class="flex flex-col md:flex-row gap-6">
      <div class="flex-1 min-w-0">
        <div v-if="manualStore.isLoadingResources" class="flex flex-col items-center justify-center py-24 bg-white dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800/50 rounded-2xl">
          <Loader2 class="w-8 h-8 animate-spin text-cyan-500 mb-3" />
          <span class="text-sm font-semibold text-slate-400">正在为您加载资源列表...</span>
        </div>

        <div v-else-if="manualStore.resources.length === 0" class="text-center py-24 bg-white dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800/50 rounded-2xl shadow-sm">
          <Sparkles class="w-12 h-12 text-slate-300 mx-auto mb-4 animate-pulse text-cyan-500/40" />
          <h3 class="text-base font-bold text-slate-700 dark:text-slate-300 mb-1">未搜索到相关资源</h3>
          <p v-if="manualStore.searchQuery" class="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            未找到包含 "{{ manualStore.searchQuery }}" 的资产。请尝试精简关键词或清除筛选分类再次搜索。
          </p>
          <p v-else class="text-xs text-slate-400 mt-1">该站点管理员暂未添加任何资源内容，敬请期待。</p>
        </div>

        <div v-else :class="viewMode === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4' : 'space-y-3.5'">
          <div
            v-for="resource in manualStore.resources"
            :key="resource.id"
            class="bg-white dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-800/50 p-2.5 md:p-4 hover:border-cyan-500/30 dark:hover:border-cyan-500/20 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 cursor-pointer group"
            :class="viewMode === 'list' ? 'flex gap-4 items-start' : 'flex flex-col h-full'"
            @click="viewResource(resource.id)"
          >
            <!-- Thumbnail view -->
            <div class="relative overflow-hidden mb-3.5 shrink-0" :class="viewMode === 'list' ? 'w-32 sm:w-40 aspect-[16/10] rounded-xl' : 'w-full aspect-[16/10] rounded-lg'">
              <div
                v-if="resource.thumbnailUrl"
                class="w-full h-full bg-slate-50 dark:bg-slate-800"
              >
                <img
                  :src="getAssetUrl(resource.thumbnailUrl)"
                  :alt="resource.title"
                  class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                  @error="($event.target as HTMLImageElement).src = ''"
                />
              </div>
              <div
                v-else
                class="w-full h-full bg-gradient-to-br from-cyan-500/5 to-emerald-500/5 dark:from-cyan-950/20 dark:to-emerald-950/20 flex flex-col items-center justify-center text-cyan-500/50 dark:text-cyan-400/40"
              >
                <Sparkles class="w-7 h-7 mb-1 group-hover:animate-bounce" />
                <span class="text-[9px] uppercase tracking-wider font-black">精品资产</span>
              </div>
            </div>

            <!-- Resource detail text -->
            <div class="flex-1 min-w-0 flex flex-col justify-between" :class="viewMode === 'list' ? '' : 'h-[calc(100%-120px)]'">
              <div>
                <div class="flex items-center gap-1.5 mb-1.5">
                  <span v-if="resource.category" class="inline-block px-2 py-0.5 text-[10px] rounded bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-bold">
                    {{ resource.category.name }}
                  </span>
                  <span class="inline-block px-2 py-0.5 text-[10px] rounded bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase">
                    {{ resource.resourceType === 'MODEL' ? '3D模型' : resource.resourceType === 'COURSE' ? '课程教程' : '技术文件' }}
                  </span>
                </div>
                <h3 class="font-bold text-sm text-slate-800 dark:text-slate-100 group-hover:text-cyan-500 transition-colors line-clamp-2 leading-snug">
                  {{ resource.title }}
                </h3>

                <p v-if="resource.description" class="text-xs text-slate-400 dark:text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                  {{ resource.description }}
                </p>
              </div>

              <div>
                <div class="flex items-center justify-between gap-3 mt-4 text-[10px] text-slate-400 dark:text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                  <span class="flex items-center gap-1">
                    <Clock class="w-3.5 h-3.5 text-slate-300" />
                    {{ formatDate(resource.createdAt) }}
                  </span>
                  <span class="flex items-center gap-1">
                    <Eye class="w-3.5 h-3.5 text-slate-300" />
                    {{ resource.viewCount }} 次浏览
                  </span>
                </div>

                <div v-if="parseTags(resource.tags).length > 0" class="hidden md:flex flex-wrap gap-1 mt-2.5">
                  <span
                    v-for="tag in parseTags(resource.tags).slice(0, 3)"
                    :key="tag"
                    class="px-2 py-0.5 text-[9px] font-medium rounded bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500"
                  >
                    #{{ tag }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Pagination -->
        <div v-if="manualStore.totalPages > 1" class="flex flex-wrap items-center justify-center gap-3 mt-10 p-4 bg-white dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800/50 rounded-2xl shadow-sm">
          <button
            class="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 disabled:opacity-30 transition-all cursor-pointer"
            :disabled="manualStore.currentPage <= 1"
            @click="goToPage(manualStore.currentPage - 1)"
          >
            <ChevronLeft class="w-4 h-4" />
          </button>
          <span class="text-xs font-bold text-slate-500 px-2 dark:text-slate-400">
            第 {{ manualStore.currentPage }} 页 / 共 {{ manualStore.totalPages }} 页
          </span>
          <button
            class="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 disabled:opacity-30 transition-all cursor-pointer mr-2"
            :disabled="manualStore.currentPage >= manualStore.totalPages"
            @click="goToPage(manualStore.currentPage + 1)"
          >
            <ChevronRight class="w-4 h-4" />
          </button>

          <!-- Quick Jump -->
          <div class="flex items-center gap-1.5 ml-2 border-l border-slate-200 dark:border-slate-800 pl-4">
            <span class="text-xs text-slate-400">跳转至</span>
            <input
              v-model="jumpPageInput"
              type="text"
              class="w-12 px-2 py-1 text-center text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
              @keyup.enter="handlePageJump"
              @blur="handlePageJump"
            />
            <span class="text-xs text-slate-400">页</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
