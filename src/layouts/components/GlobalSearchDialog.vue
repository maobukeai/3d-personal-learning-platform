<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  Search,
  Box,
  Image as ImageIcon,
  ArrowRight,
  GraduationCap,
  Users,
} from 'lucide-vue-next';
import { preferences } from '@/utils/preferences';
import {
  emptyGlobalSearchResults,
  searchGlobal,
  type GlobalSearchItem,
  type GlobalSearchResults,
} from '@/services/search.service';
import { useSystemStore } from '@/stores/system';

const props = defineProps<{
  modelValue: boolean;
  isMobile: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

const router = useRouter();
const systemStore = useSystemStore();

const isSearchVisible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
});

const searchInput = ref<HTMLInputElement | null>(null);
const searchQuery = ref('');
const searchResults = ref<GlobalSearchResults>(emptyGlobalSearchResults());
const isSearching = ref(false);
const selectedResultIndex = ref(-1);
const searchHistory = ref<string[]>(preferences.getSearchHistory());

const addToHistory = (query: string) => {
  if (!query.trim()) return;
  const history = searchHistory.value.filter((h) => h !== query);
  history.unshift(query);
  searchHistory.value = history.slice(0, 5);
  preferences.setSearchHistory(searchHistory.value);
};

const clearHistory = () => {
  searchHistory.value = [];
  preferences.clearSearchHistory();
};

const flattenedResults = computed(() => {
  const items: GlobalSearchItem[] = [];
  searchResults.value.assets.forEach((item) => items.push({ ...item, searchType: 'asset' }));
  searchResults.value.courses.forEach((item) => items.push({ ...item, searchType: 'course' }));
  searchResults.value.teams.forEach((item) => items.push({ ...item, searchType: 'team' }));
  return items;
});

const getCategoryLabel = (category: GlobalSearchItem['category']) => {
  if (!category) return '未分类';
  return typeof category === 'string' ? category : category.name || '未分类';
};

let searchTimeout: ReturnType<typeof setTimeout> | null = null;
const performSearch = async (query: string) => {
  if (!query.trim()) {
    searchResults.value = emptyGlobalSearchResults();
    selectedResultIndex.value = -1;
    return;
  }

  isSearching.value = true;
  try {
    searchResults.value = await searchGlobal(query);
    selectedResultIndex.value = -1;
  } catch (error) {
    console.error('Search error:', error);
  } finally {
    isSearching.value = false;
  }
};

watch(searchQuery, (newQuery) => {
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    performSearch(newQuery);
  }, 300);
});

const navigateToResult = (type: string, id: string) => {
  addToHistory(searchQuery.value);
  isSearchVisible.value = false;
  searchQuery.value = '';
  searchResults.value = emptyGlobalSearchResults();

  if (type === 'asset') {
    router.push(`/assets?id=${id}`);
  } else if (type === 'course') {
    router.push(`/academy/course/${id}`);
  } else if (type === 'team') {
    router.push(`/team/${id}`);
  }
};

const handleKeyDown = (e: KeyboardEvent) => {
  if (!isSearchVisible.value) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    selectedResultIndex.value = (selectedResultIndex.value + 1) % flattenedResults.value.length;
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    selectedResultIndex.value =
      (selectedResultIndex.value - 1 + flattenedResults.value.length) %
      flattenedResults.value.length;
  } else if (e.key === 'Enter') {
    if (selectedResultIndex.value >= 0 && flattenedResults.value[selectedResultIndex.value]) {
      const item = flattenedResults.value[selectedResultIndex.value];
      if (item.searchType) {
        navigateToResult(item.searchType, item.id);
      }
    }
  } else if (e.key === 'Escape') {
    isSearchVisible.value = false;
  }
};

watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      window.addEventListener('keydown', handleKeyDown);
    } else {
      window.removeEventListener('keydown', handleKeyDown);
    }
  }
);

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});
</script>

<template>
  <el-dialog
    v-model="isSearchVisible"
    :title="isMobile ? '' : '全局搜索'"
    :width="isMobile ? '90%' : '600px'"
    :top="isMobile ? '8vh' : '15vh'"
    :class="['search-dialog', 'custom-rounded-dialog', isMobile ? 'mobile-search-dialog' : '']"
    :show-close="isMobile"
    :fullscreen="false"
    @opened="() => searchInput?.focus()"
  >
    <div class="relative">
      <el-input
        ref="searchInput"
        v-model="searchQuery"
        placeholder="搜索作品、素材、课程或团队..."
        :size="isMobile ? 'default' : 'large'"
        clearable
        @keyup.enter="
          () => {
            if (selectedResultIndex === -1 && flattenedResults.length > 0)
              selectedResultIndex = 0;
          }
        "
      >
        <template #prefix>
          <Search :class="[isMobile ? 'w-4 h-4' : 'w-5 h-5', 'text-slate-400']" />
        </template>
        <template #suffix>
          <div
            v-if="isSearching"
            class="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin"
          ></div>
        </template>
      </el-input>
    </div>

    <div
      :class="[
        isMobile ? 'mt-4 max-h-[50vh]' : 'mt-6 max-h-[60vh]',
        'overflow-y-auto pr-2 custom-scrollbar',
      ]"
    >
      <!-- Result Sections -->
      <template v-if="searchQuery.trim()">
        <!-- Assets -->
        <div v-if="searchResults.assets.length > 0" :class="isMobile ? 'mb-4' : 'mb-6'">
          <h3
            class="px-2 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"
          >
            <Box :class="isMobile ? 'w-2.5 h-2.5' : 'w-3 h-3'" /> 3D 资产 ({{
              searchResults.assets.length
            }})
          </h3>
          <div class="space-y-1">
            <div
              v-for="(asset, index) in searchResults.assets"
              :key="asset.id"
              class="flex items-center hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors group relative"
              :class="[
                isMobile ? 'gap-2 px-2.5 py-1.5 rounded-lg' : 'gap-3 px-3 py-2 rounded-xl',
                {
                  'bg-slate-100 dark:bg-slate-800 ring-2 ring-accent/20':
                    selectedResultIndex === index,
                },
              ]"
              @click="navigateToResult('asset', asset.id)"
              @mouseenter="selectedResultIndex = index"
            >
              <div
                :class="isMobile ? 'w-8 h-8 rounded-md' : 'w-10 h-10 rounded-lg'"
                class="bg-slate-100 dark:bg-slate-700 overflow-hidden shrink-0"
              >
                <img v-if="asset.thumbnail" alt="" :src="asset.thumbnail" class="w-full h-full object-cover" />
                <ImageIcon
                  v-else
                  :class="[isMobile ? 'p-1.5' : 'p-2', 'w-full h-full text-slate-400']"
                />
              </div>
              <div class="flex-1 min-w-0">
                <p
                  :class="isMobile ? 'text-xs' : 'text-sm'"
                  class="font-medium truncate"
                  style="color: var(--text-primary)"
                >
                  {{ asset.title }}
                </p>
                <p
                  :class="isMobile ? 'text-[9px]' : 'text-[10px]'"
                  class="text-slate-400 truncate"
                >
                  {{ getCategoryLabel(asset.category) }} · {{ asset.type }}
                </p>
              </div>
              <ArrowRight
                :class="isMobile ? 'w-3 h-3' : 'w-4 h-4'"
                class="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"
              />
            </div>
          </div>
        </div>

        <!-- Courses -->
        <div v-if="searchResults.courses.length > 0" :class="isMobile ? 'mb-4' : 'mb-6'">
          <h3
            class="px-2 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"
          >
            <GraduationCap :class="isMobile ? 'w-2.5 h-2.5' : 'w-3 h-3'" /> 学习课程 ({{
              searchResults.courses.length
            }})
          </h3>
          <div class="space-y-1">
            <div
              v-for="(course, index) in searchResults.courses"
              :key="course.id"
              class="flex items-center hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors group relative"
              :class="[
                isMobile ? 'gap-2 px-2.5 py-1.5 rounded-lg' : 'gap-3 px-3 py-2 rounded-xl',
                {
                  'bg-slate-100 dark:bg-slate-800 ring-2 ring-accent/20':
                    selectedResultIndex === index + searchResults.assets.length,
                },
              ]"
              @click="navigateToResult('course', course.id)"
              @mouseenter="selectedResultIndex = index + searchResults.assets.length"
            >
              <div
                :class="isMobile ? 'w-8 h-8 rounded-md' : 'w-10 h-10 rounded-lg'"
                class="bg-accent/10 flex items-center justify-center shrink-0"
              >
                <GraduationCap :class="isMobile ? 'w-4 h-4' : 'w-5 h-5'" class="text-accent" />
              </div>
              <div class="flex-1 min-w-0">
                <p
                  :class="isMobile ? 'text-xs' : 'text-sm'"
                  class="font-medium truncate"
                  style="color: var(--text-primary)"
                >
                  {{ course.title }}
                </p>
                <p :class="isMobile ? 'text-[9px]' : 'text-[10px]'" class="text-slate-400">
                  {{ course.difficulty }} · {{ course._count?.lessons || 0 }} 课时
                </p>
              </div>
              <ArrowRight
                :class="isMobile ? 'w-3 h-3' : 'w-4 h-4'"
                class="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"
              />
            </div>
          </div>
        </div>

        <!-- Teams -->
        <div v-if="searchResults.teams.length > 0" :class="isMobile ? 'mb-4' : 'mb-6'">
          <h3
            class="px-2 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"
          >
            <Users :class="isMobile ? 'w-2.5 h-2.5' : 'w-3 h-3'" /> 活跃团队 ({{
              searchResults.teams.length
            }})
          </h3>
          <div class="space-y-1">
            <div
              v-for="(team, index) in searchResults.teams"
              :key="team.id"
              class="flex items-center hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors group relative"
              :class="[
                isMobile ? 'gap-2 px-2.5 py-1.5 rounded-lg' : 'gap-3 px-3 py-2 rounded-xl',
                {
                  'bg-slate-100 dark:bg-slate-800 ring-2 ring-accent/20':
                    selectedResultIndex ===
                    index + searchResults.assets.length + searchResults.courses.length,
                },
              ]"
              @click="navigateToResult('team', team.id)"
              @mouseenter="
                selectedResultIndex =
                  index + searchResults.assets.length + searchResults.courses.length
              "
            >
              <div
                :class="isMobile ? 'w-8 h-8 rounded-md' : 'w-10 h-10 rounded-lg'"
                class="bg-orange-500/10 flex items-center justify-center shrink-0"
              >
                <Users :class="isMobile ? 'w-4 h-4' : 'w-5 h-5'" class="text-orange-500" />
              </div>
              <div class="flex-1 min-w-0">
                <p
                  :class="isMobile ? 'text-xs' : 'text-sm'"
                  class="font-medium truncate"
                  style="color: var(--text-primary)"
                >
                  {{ team.name }}
                </p>
                <p :class="isMobile ? 'text-[9px]' : 'text-[10px]'" class="text-slate-400">
                  {{ getCategoryLabel(team.category) }} · {{ team._count?.members || 0 }} 成员
                </p>
              </div>
              <ArrowRight
                :class="isMobile ? 'w-3 h-3' : 'w-4 h-4'"
                class="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"
              />
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div
          v-if="!isSearching && flattenedResults.length === 0"
          :class="isMobile ? 'py-8' : 'py-12'"
          class="text-center"
        >
          <Search
            :class="isMobile ? 'w-8 h-8 mb-2' : 'w-12 h-12 mb-4'"
            class="mx-auto text-slate-200"
          />
          <p :class="isMobile ? 'text-xs' : 'text-sm'" class="text-slate-400">
            未找到与 "{{ searchQuery }}" 相关的结果
          </p>
        </div>
      </template>

      <!-- Initial State / Recent Search -->
      <template v-else>
        <div v-if="searchHistory.length > 0" :class="isMobile ? 'mb-5' : 'mb-8'">
          <div class="flex items-center justify-between px-2 mb-2">
            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest"
              >搜索历史</span
            >
            <el-button link size="small" class="text-[10px]" @click="clearHistory"
              >清空历史</el-button
            >
          </div>
          <div class="flex flex-wrap gap-2 px-1">
            <button
v-for="h in searchHistory" :key="h" type="button" :class="
                isMobile ? 'px-2.5 py-1 text-[11px] rounded-md' : 'px-3 py-1.5 text-xs rounded-lg'
              " class="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 hover:bg-accent/10 hover:text-accent transition-all border border-transparent hover:border-accent/20" @click="searchQuery = h">
              {{ h }}
            </button>
          </div>
        </div>

        <div class="flex items-center justify-between px-2 mb-4">
          <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest"
            >常用功能</span
          >
        </div>
        <div :class="[isMobile ? 'gap-1.5' : 'gap-2', 'grid grid-cols-1 md:grid-cols-2 px-1']">
          <div
            class="flex items-center border border-slate-100 dark:border-slate-800 hover:border-accent/50 hover:bg-accent/[0.02] cursor-pointer transition-all group"
            :class="isMobile ? 'gap-2.5 px-3 py-2.5 rounded-xl' : 'gap-3 px-4 py-3 rounded-2xl'"
            @click="
              router.push('/assets');
              isSearchVisible = false;
            "
          >
            <div
              :class="isMobile ? 'w-8 h-8 rounded-lg' : 'w-10 h-10 rounded-xl'"
              class="bg-blue-500/10 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform"
            >
              <ImageIcon :class="isMobile ? 'w-4 h-4' : 'w-5 h-5'" />
            </div>
            <div>
              <p :class="isMobile ? 'text-xs' : 'text-sm'" class="font-bold">浏览资产库</p>
              <p :class="isMobile ? 'text-[9px]' : 'text-[10px]'" class="text-slate-400">
                发现高质量 3D 模型
              </p>
            </div>
          </div>
          <div
            class="flex items-center border border-slate-100 dark:border-slate-800 hover:border-accent/50 hover:bg-accent/[0.02] cursor-pointer transition-all group"
            :class="isMobile ? 'gap-2.5 px-3 py-2.5 rounded-xl' : 'gap-3 px-4 py-3 rounded-2xl'"
            @click="
              router.push('/academy');
              isSearchVisible = false;
            "
          >
            <div
              :class="isMobile ? 'w-8 h-8 rounded-lg' : 'w-10 h-10 rounded-xl'"
              class="bg-emerald-500/10 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform"
            >
              <GraduationCap :class="isMobile ? 'w-4 h-4' : 'w-5 h-5'" />
            </div>
            <div>
              <p :class="isMobile ? 'text-xs' : 'text-sm'" class="font-bold">开始学习</p>
              <p :class="isMobile ? 'text-[9px]' : 'text-[10px]'" class="text-slate-400">
                从基础到进阶的课程
              </p>
            </div>
          </div>
        </div>
      </template>
    </div>

    <template v-if="!isMobile" #footer>
      <div
        class="flex items-center justify-between text-[10px] text-slate-400 border-t pt-4 mt-2"
        style="border-color: var(--border-base)"
      >
        <div class="flex gap-4">
          <span class="flex items-center gap-1.5"
            ><kbd class="px-1.5 py-0.5 rounded border bg-slate-50 dark:bg-slate-900 shadow-sm"
              >↑↓</kbd
            >
            选择</span
          >
          <span class="flex items-center gap-1.5"
            ><kbd class="px-1.5 py-0.5 rounded border bg-slate-50 dark:bg-slate-900 shadow-sm"
              >Enter</kbd
            >
            确认</span
          >
          <span class="flex items-center gap-1.5"
            ><kbd class="px-1.5 py-0.5 rounded border bg-slate-50 dark:bg-slate-900 shadow-sm"
              >esc</kbd
            >
            关闭</span
          >
        </div>
        <div class="flex items-center gap-1">
          <span class="opacity-50">Powered by</span>
          <span class="font-bold text-accent"
            >{{ systemStore.settings.PLATFORM_NAME }} Search</span
          >
        </div>
      </div>
    </template>
  </el-dialog>
</template>
