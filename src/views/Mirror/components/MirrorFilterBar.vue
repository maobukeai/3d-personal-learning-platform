<script setup lang="ts">
import { computed } from 'vue';
import {
  Search,
  X,
  SlidersHorizontal,
  LayoutGrid,
  Grid2X2,
  List,
  Sparkles,
  Layers,
  Shield,
  RotateCcw,
  Tag,
} from 'lucide-vue-next';
import { getPlanName } from '@/utils/plans';
import { parseTags } from '@/utils/tags';
import type { MirrorCategory, MirrorSource, MirrorResource } from '@/stores/mirror';

export type ViewModeType = 'grid-comfortable' | 'grid-compact' | 'list';

const props = defineProps<{
  station: MirrorSource | null;
  totalResources: number;
  hasAccess: boolean | null;
  categories: MirrorCategory[];
  activeCategoryId: string | null;
  searchQuery: string;
  sortBy: string;
  viewMode: ViewModeType;
  resources?: MirrorResource[];
  hideSearch?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:searchQuery', val: string): void;
  (e: 'update:sortBy', val: string): void;
  (e: 'update:viewMode', val: ViewModeType): void;
  (e: 'select-category', categoryId: string | null): void;
  (e: 'search'): void;
  (e: 'reset-all'): void;
}>();

const sortByOptions = [
  { value: 'newest', label: '最新发布' },
  { value: 'oldest', label: '最早发布' },
  { value: 'title', label: '名称 A-Z' },
];
const viewModeOptions: { mode: ViewModeType; label: string; icon: any }[] = [
  { mode: 'grid-comfortable', label: '舒适大图', icon: Grid2X2 },
  { mode: 'grid-compact', label: '紧凑网格', icon: LayoutGrid },
  { mode: 'list', label: '详细列表', icon: List },
];

const parentMap = computed(() => {
  const map = new Map<string, MirrorCategory[]>();
  props.categories.forEach((cat) => {
    if (!cat.parentExternalId) return;
    if (!map.has(cat.parentExternalId)) map.set(cat.parentExternalId, []);
    map.get(cat.parentExternalId)!.push(cat);
  });
  return map;
});

const topCategories = computed(() => {
  return props.categories
    .filter(
      (cat) =>
        !(
          cat.parentExternalId &&
          props.categories.some((p) => p.externalId === cat.parentExternalId)
        ),
    )
    .sort((a, b) => (a.order || 0) - (b.order || 0));
});

const activeParentId = computed<string | null>(() => {
  if (!props.activeCategoryId) return null;
  const direct = props.categories.find((c) => c.id === props.activeCategoryId);
  if (!direct) return null;
  if (!direct.parentExternalId) return direct.id;
  const parent = props.categories.find((c) => c.externalId === direct.parentExternalId);
  return parent ? parent.id : direct.id;
});

const currentSubCategories = computed<MirrorCategory[]>(() => {
  if (!activeParentId.value) return [];
  const parent = props.categories.find((c) => c.id === activeParentId.value);
  if (!parent) return [];
  return (parentMap.value.get(parent.externalId) || []).sort(
    (a, b) => (a.order || 0) - (b.order || 0),
  );
});

const activeCategoryName = computed(() => {
  if (!props.activeCategoryId) return null;
  const cat = props.categories.find((c) => c.id === props.activeCategoryId);
  return cat ? cat.name : null;
});

const currentCategoryTags = computed(() => {
  const tagCountMap = new Map<string, number>();
  props.resources?.forEach((r) => {
    parseTags(r.tags).forEach((t) => {
      const clean = t.trim();
      if (clean && clean.length <= 15) tagCountMap.set(clean, (tagCountMap.get(clean) || 0) + 1);
    });
  });

  const catName = (activeCategoryName.value || '').toLowerCase();
  const presetPool: string[] = [];
  if (/(插画|绘画|原画|美术|二次元|立绘|设计|ui)/i.test(catName)) {
    presetPool.push(
      'Procreate',
      'SAI',
      '优动漫',
      'Q版立绘',
      '二次元',
      '色彩光影',
      '人体结构',
      '笔刷预设',
      '厚涂',
      '日系插画',
    );
  } else if (/(建模|渲染|3d|模型|场景|室内|建筑)/i.test(catName)) {
    presetPool.push(
      'Blender',
      'C4D',
      'Maya',
      'ZBrush',
      '角色建模',
      '材质贴图',
      'PBR',
      '场景渲染',
      '几何节点',
      '动画骨骼',
    );
  } else if (/(视频|剪辑|影视|特效|后期|包装|动画)/i.test(catName)) {
    presetPool.push(
      'AE',
      'PR',
      '剪映',
      '达芬奇',
      '特效合成',
      '动态设计',
      'MG动画',
      '调色预设',
      '音效配乐',
      '短视频包装',
    );
  } else if (/(软件|工具|插件|代码)/i.test(catName)) {
    presetPool.push('Blender插件', 'PS扩展', '汉化版', '效率工具', '安装配置');
  } else {
    presetPool.push(
      'Blender',
      'Q版立绘',
      '3D模型',
      '材质贴图',
      '二次元',
      'Procreate',
      '带课件素材',
      '动画特效',
      '角色设计',
      '全流程教程',
    );
  }

  const existingTags = Array.from(tagCountMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t);
  const combined = Array.from(new Set([...existingTags, ...presetPool]));
  return combined.slice(0, 10);
});

const hasActiveFilters = computed(() =>
  Boolean(props.activeCategoryId || props.searchQuery.trim()),
);

function handleTagFilter(tag: string) {
  const current = (props.searchQuery || '').trim();
  // 再次点击已激活的标签则取消检索
  if (current === tag) {
    emit('update:searchQuery', '');
    emit('search');
    return;
  }
  // 否则直接替换为当前点击的标签
  emit('update:searchQuery', tag);
  emit('search');
}
</script>

<template>
  <div class="mirror-filter-bar flex flex-col gap-2.5 mb-4">
    <!-- Mode A: Standalone Portal 2-Row Optimized Layout -->
    <template v-if="hideSearch">
      <!-- Row 1: Top Categories (Left) + Sort & View Controls (Right) -->
      <div
        class="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white/70 dark:bg-slate-800/60 p-1.5 md:p-2 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 backdrop-blur-md shadow-xs"
      >
        <!-- Categories Tabs -->
        <div class="flex items-center gap-1.5 overflow-x-auto scrollbar-hide flex-1 min-w-0 px-1">
          <button
            type="button"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs md:text-sm font-bold transition-all shrink-0 cursor-pointer"
            :class="
              !activeCategoryId
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50'
            "
            @click="emit('select-category', null)"
          >
            <Layers class="w-3.5 h-3.5" /><span>全部资源</span>
          </button>
          <button
            v-for="cat in topCategories"
            :key="cat.id"
            type="button"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs md:text-sm font-bold transition-all shrink-0 cursor-pointer"
            :class="
              activeParentId === cat.id
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50'
            "
            @click="emit('select-category', cat.id)"
          >
            <span>{{ cat.name }}</span>
            <span
              v-if="cat.resourceCount"
              class="text-[10px] px-1.5 py-0.2 rounded-full opacity-80"
              :class="
                activeParentId === cat.id
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
              "
              >{{ cat.resourceCount }}</span
            >
          </button>
        </div>

        <!-- Controls: Sort & View -->
        <div class="flex items-center gap-2 shrink-0 justify-end px-1">
          <div
            class="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-900/60 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700"
          >
            <SlidersHorizontal class="w-3.5 h-3.5 text-slate-400 ml-2 mr-0.5" />
            <button
              v-for="opt in sortByOptions"
              :key="opt.value"
              type="button"
              class="px-2 py-1 text-xs font-medium rounded-lg transition-all cursor-pointer"
              :class="
                sortBy === opt.value
                  ? 'bg-blue-500 text-white font-bold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              "
              @click="
                emit('update:sortBy', opt.value);
                emit('search');
              "
            >
              {{ opt.label }}
            </button>
          </div>
          <div
            class="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-900/60 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700"
          >
            <button
              v-for="v in viewModeOptions"
              :key="v.mode"
              type="button"
              class="p-1.5 rounded-lg transition-all cursor-pointer"
              :class="
                viewMode === v.mode
                  ? 'bg-blue-500 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              "
              :title="v.label"
              @click="emit('update:viewMode', v.mode)"
            >
              <component :is="v.icon" class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </template>

    <!-- Mode B: Standard Main Layout 3-Row Layout -->
    <template v-else>
      <!-- Row 1: Compact Title + Integrated Search + Controls -->
      <div
        class="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white/70 dark:bg-slate-800/60 p-2.5 md:p-3 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 backdrop-blur-md shadow-xs"
      >
        <div class="flex items-center gap-2.5 shrink-0 px-1">
          <span class="p-1.5 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400"
            ><Sparkles class="w-4 h-4"
          /></span>
          <div class="flex items-baseline gap-2">
            <h1
              class="text-base md:text-lg font-black text-slate-900 dark:text-white tracking-tight"
            >
              {{ station?.displayName || '镜像资源站' }}
            </h1>
            <span
              class="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-500/20"
              >{{ totalResources }} 个资源</span
            >
          </div>
          <div
            v-if="hasAccess === false"
            class="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-[11px] font-bold shrink-0 ml-1"
          >
            <Shield class="w-3 h-3" /><span
              >需 {{ getPlanName(station?.minPlanPriority ?? 0) }} 会员</span
            >
          </div>
        </div>

        <div
          class="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5"
        >
          <div class="relative flex-1 max-w-xl group">
            <Search
              class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors"
            />
            <input
              :value="searchQuery"
              type="text"
              placeholder="搜索资源、课件、材质或模型 (按 Enter 搜索)..."
              class="w-full h-9 pl-9 pr-8 text-xs md:text-sm rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
              @input="emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
              @keyup.enter="emit('search')"
            />
            <button
              v-if="searchQuery"
              type="button"
              class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              @click="
                emit('update:searchQuery', '');
                emit('search');
              "
            >
              <X class="w-3.5 h-3.5" />
            </button>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <button
              type="button"
              class="h-9 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-98 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
              @click="emit('search')"
            >
              <Search class="w-3.5 h-3.5" /><span>搜索</span>
            </button>
            <div
              class="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-900/60 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700"
            >
              <SlidersHorizontal class="w-3.5 h-3.5 text-slate-400 ml-2 mr-0.5" />
              <button
                v-for="opt in sortByOptions"
                :key="opt.value"
                type="button"
                class="px-2 py-1 text-xs font-medium rounded-lg transition-all cursor-pointer"
                :class="
                  sortBy === opt.value
                    ? 'bg-blue-500 text-white font-bold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                "
                @click="
                  emit('update:sortBy', opt.value);
                  emit('search');
                "
              >
                {{ opt.label }}
              </button>
            </div>
            <div
              class="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-900/60 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700"
            >
              <button
                v-for="v in viewModeOptions"
                :key="v.mode"
                type="button"
                class="p-1.5 rounded-lg transition-all cursor-pointer"
                :class="
                  viewMode === v.mode
                    ? 'bg-blue-500 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                "
                :title="v.label"
                @click="emit('update:viewMode', v.mode)"
              >
                <component :is="v.icon" class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Row 2: Top Categories Tabs -->
      <div
        class="flex items-center gap-1.5 p-1 bg-white/70 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 overflow-x-auto scrollbar-hide shadow-xs"
      >
        <button
          type="button"
          class="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs md:text-sm font-bold transition-all shrink-0 cursor-pointer"
          :class="
            !activeCategoryId
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50'
          "
          @click="emit('select-category', null)"
        >
          <Layers class="w-3.5 h-3.5" /><span>全部资源</span>
        </button>
        <button
          v-for="cat in topCategories"
          :key="cat.id"
          type="button"
          class="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs md:text-sm font-bold transition-all shrink-0 cursor-pointer"
          :class="
            activeParentId === cat.id
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50'
          "
          @click="emit('select-category', cat.id)"
        >
          <span>{{ cat.name }}</span>
          <span
            v-if="cat.resourceCount"
            class="text-[10px] px-1.5 py-0.2 rounded-full opacity-80"
            :class="
              activeParentId === cat.id
                ? 'bg-white/20 text-white'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
            "
            >{{ cat.resourceCount }}</span
          >
        </button>
      </div>
    </template>

    <!-- Shared Second Row (Subcategories & Tags) -->
    <div
      v-if="currentSubCategories.length > 0"
      class="flex items-center gap-2 p-2 bg-blue-50/60 dark:bg-slate-800/40 rounded-xl border border-blue-100/80 dark:border-slate-700/50 overflow-x-auto scrollbar-hide"
    >
      <span class="text-xs text-blue-600 dark:text-blue-400 font-bold shrink-0 mr-1">子分类：</span>
      <button
        type="button"
        class="px-2.5 py-1 rounded-lg text-xs font-semibold transition-all shrink-0"
        :class="
          activeCategoryId === activeParentId
            ? 'bg-blue-600 text-white shadow-xs'
            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-blue-100/50 dark:hover:bg-slate-700'
        "
        @click="emit('select-category', activeParentId)"
      >
        全部
      </button>
      <button
        v-for="sub in currentSubCategories"
        :key="sub.id"
        type="button"
        class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all shrink-0"
        :class="
          activeCategoryId === sub.id
            ? 'bg-blue-600 text-white shadow-xs'
            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-blue-100/50 dark:hover:bg-slate-700'
        "
        @click="emit('select-category', sub.id)"
      >
        <span>{{ sub.name }}</span
        ><span v-if="sub.resourceCount" class="text-[10px] opacity-75"
          >({{ sub.resourceCount }})</span
        >
      </button>
    </div>

    <!-- Row 4: Category-Linked Dynamic Tags Ribbon -->
    <div class="flex items-center justify-between gap-3 text-xs">
      <div class="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide flex-1">
        <span class="flex items-center gap-1 text-slate-400 font-bold shrink-0">
          <Tag class="w-3.5 h-3.5 text-blue-500" />
          {{ activeCategoryName ? `${activeCategoryName}标签：` : '热门标签：' }}
        </span>
        <button
          v-for="tag in currentCategoryTags"
          :key="tag"
          type="button"
          class="px-2.5 py-0.5 rounded-lg font-medium transition-all shrink-0"
          :class="
            searchQuery.trim() === tag
              ? 'bg-blue-600 text-white shadow-xs font-bold'
              : 'text-slate-600 dark:text-slate-400 bg-slate-100/90 dark:bg-slate-800/80 hover:bg-blue-50 dark:hover:bg-blue-500/15 hover:text-blue-600 dark:hover:text-blue-400'
          "
          @click="handleTagFilter(tag)"
        >
          {{ tag }}
        </button>
      </div>

      <div v-if="hasActiveFilters" class="flex items-center gap-2 shrink-0">
        <span
          v-if="activeCategoryName"
          class="px-2 py-0.5 rounded-md bg-blue-100/80 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[11px] font-semibold flex items-center gap-1"
        >
          分类: {{ activeCategoryName
          }}<button type="button" @click="emit('select-category', null)">
            <X class="w-3 h-3" />
          </button>
        </span>
        <span
          v-if="searchQuery.trim()"
          class="px-2 py-0.5 rounded-md bg-blue-100/80 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[11px] font-semibold flex items-center gap-1"
        >
          标签: "{{ searchQuery.trim() }}"<button
            type="button"
            @click="
              emit('update:searchQuery', '');
              emit('search');
            "
          >
            <X class="w-3 h-3" />
          </button>
        </span>
        <button
          type="button"
          class="text-[11px] text-slate-400 hover:text-red-500 flex items-center gap-1 transition-colors font-medium ml-1"
          @click="emit('reset-all')"
        >
          <RotateCcw class="w-3 h-3" />重置
        </button>
      </div>
    </div>
  </div>
</template>
