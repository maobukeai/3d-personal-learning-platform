<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  LayoutGrid,
  List,
  FolderPlus,
  TrendingUp,
  BarChart3,
  SlidersHorizontal,
  Calendar,
} from 'lucide-vue-next';
import Tabs from '@/components/ui/Tabs.vue';

interface CardSettings {
  assignee: boolean;
  dueDate: boolean;
  priority: boolean;
  project: boolean;
  subtasks: boolean;
  description: boolean;
  timeTracking: boolean;
}

interface VisibleColumns {
  status: boolean;
  project: boolean;
  assignee: boolean;
  dueDate: boolean;
  priority: boolean;
}

interface Props {
  searchQuery: string;
  viewMode: 'board' | 'list' | 'calendar';
  cardSettings: CardSettings;
  visibleColumns: VisibleColumns;
  completionRate: number;
  overdueCount: number;
  tasksCount: number;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:searchQuery', value: string): void;
  (e: 'update:viewMode', value: 'board' | 'list' | 'calendar'): void;
  (e: 'toggle-card-setting', field: string): void;
  (e: 'toggle-column-visibility', col: string): void;
  (e: 'new-task'): void;
  (e: 'new-project'): void;
}>();

const { t } = useI18n();

const localSearchQuery = computed({
  get: () => props.searchQuery,
  set: (val) => emit('update:searchQuery', val),
});

const localViewMode = computed({
  get: () => props.viewMode,
  set: (val) => emit('update:viewMode', val),
});

const cardSettingLabel = (field: string): string => {
  switch (field) {
    case 'assignee':
      return '负责人头像';
    case 'dueDate':
      return '截止日期';
    case 'priority':
      return '优先级标签';
    case 'project':
      return '关联项目名称';
    case 'subtasks':
      return '子任务进度';
    case 'timeTracking':
      return '工时进度';
    case 'description':
    default:
      return '任务简短描述';
  }
};

const columnVisibilityLabel = (field: string): string => {
  switch (field) {
    case 'status':
      return t('tasks.statusLabel');
    case 'project':
      return t('tasks.associatedProject');
    case 'assignee':
      return t('tasks.assignee');
    case 'dueDate':
      return t('tasks.dueDate');
    case 'priority':
    default:
      return t('tasks.priority');
  }
};
</script>

<template>
  <div
    class="h-auto md:h-13 px-4 sm:px-6 py-3 md:py-0 flex flex-col md:grid md:grid-cols-3 md:items-center shrink-0 border-b transition-colors duration-300 gap-3"
    style="background-color: var(--bg-card); border-color: var(--border-base)"
  >
    <!-- Left: Title & Stats -->
    <div
      class="mobile-row flex items-center justify-between w-full md:w-auto md:justify-start gap-3"
    >
      <div class="flex items-center gap-2">
        <div class="p-1.5 bg-accent/10 rounded-lg">
          <CheckCircle2 class="w-4.5 h-4.5 text-accent" />
        </div>
        <h1
          class="text-base md:text-lg font-bold whitespace-nowrap truncate"
          style="color: var(--text-primary)"
        >
          {{ t('tasks.board') }}
        </h1>
      </div>

      <!-- Inline stats badges -->
      <div class="hidden lg:flex items-center gap-1.5 shrink-0">
        <div
          class="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/10 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap"
        >
          <TrendingUp class="w-2.5 h-2.5" />
          <span>{{ completionRate }}% {{ t('tasks.done') }}</span>
        </div>
        <div
          v-if="overdueCount > 0"
          class="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-500/10 text-[9px] font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap"
        >
          <AlertCircle class="w-2.5 h-2.5" />
          <span>{{ overdueCount }} {{ t('tasks.overdue') }}</span>
        </div>
        <div
          class="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-white/5 text-[9px] font-bold text-slate-500 whitespace-nowrap"
        >
          <BarChart3 class="w-2.5 h-2.5" />
          <span>{{ tasksCount }} {{ t('tasks.total') }}</span>
        </div>
      </div>

      <button
        type="button"
        class="md:hidden p-2 bg-accent text-white rounded-lg shadow-lg shadow-accent/20 hover:shadow-none transition-all flex items-center justify-center shrink-0"
        @click="emit('new-task')"
      >
        <Plus class="w-4 h-4" />
      </button>
    </div>

    <!-- Center: Search Input -->
    <div class="flex justify-center w-full md:w-auto">
      <label class="search-box !min-h-0 !h-8 w-44 sm:w-64 shrink-0">
        <Search />
        <input v-model="localSearchQuery" type="text" :placeholder="t('tasks.searchPlaceholder')" />
      </label>
    </div>

    <!-- Right: Action Controls -->
    <div class="mobile-row flex items-center justify-end gap-2 sm:gap-2.5 w-full md:w-auto">
      <Tabs
        v-model="localViewMode"
        :options="[
          { value: 'board', icon: LayoutGrid },
          { value: 'list', icon: List },
          { value: 'calendar', icon: Calendar },
        ]"
        size="sm"
        class="!bg-transparent border-none shrink-0"
      />

      <el-popover
        v-if="viewMode === 'board'"
        placement="bottom-end"
        :width="180"
        trigger="click"
        popper-class="glass-popover"
      >
        <template #reference>
          <button
            type="button"
            class="px-3 py-1.5 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold hover:bg-slate-200/50 dark:hover:bg-white/10 transition-all flex items-center gap-1 cursor-pointer shrink-0 animate-spin-hover"
          >
            <SlidersHorizontal class="w-3.5 h-3.5 text-slate-500" />
            <span>卡片设置</span>
          </button>
        </template>
        <div class="p-1 space-y-2.5">
          <div
            class="text-[9px] font-black text-slate-400 dark:text-slate-500 tracking-wider uppercase mb-1"
          >
            看板卡片显示属性
          </div>
          <label
            v-for="(val, field) in cardSettings"
            :key="field"
            class="flex items-center gap-2 text-xs cursor-pointer text-slate-600 dark:text-slate-300 select-none hover:text-accent transition-colors"
          >
            <input
              type="checkbox"
              :checked="val"
              class="rounded border-slate-300 dark:border-slate-600 text-accent focus:ring-accent w-3.5 h-3.5"
              @change="emit('toggle-card-setting', String(field))"
            />
            <span>{{ cardSettingLabel(String(field)) }}</span>
          </label>
        </div>
      </el-popover>

      <el-popover
        v-if="viewMode === 'list'"
        placement="bottom-end"
        :width="180"
        trigger="click"
        popper-class="glass-popover"
      >
        <template #reference>
          <button
            type="button"
            class="px-3 py-1.5 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold hover:bg-slate-200/50 dark:hover:bg-white/10 transition-all flex items-center gap-1 cursor-pointer shrink-0 animate-spin-hover"
          >
            <SlidersHorizontal class="w-3.5 h-3.5 text-slate-500" />
            <span>卡片设置</span>
          </button>
        </template>
        <div class="p-1 space-y-2.5">
          <div
            class="text-[9px] font-black text-slate-400 dark:text-slate-500 tracking-wider uppercase mb-1"
          >
            列表卡片显示属性
          </div>
          <label
            v-for="(val, field) in visibleColumns"
            :key="field"
            class="flex items-center gap-2 text-xs cursor-pointer text-slate-600 dark:text-slate-300 select-none hover:text-accent transition-colors"
          >
            <input
              type="checkbox"
              :checked="val"
              class="rounded border-slate-300 dark:border-slate-600 text-accent focus:ring-accent w-3.5 h-3.5"
              @change="emit('toggle-column-visibility', String(field))"
            />
            <span>{{ columnVisibilityLabel(String(field)) }}</span>
          </label>
        </div>
      </el-popover>

      <button
        type="button"
        class="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold hover:bg-slate-200/50 dark:hover:bg-white/10 transition-all"
        @click="emit('new-project')"
      >
        <FolderPlus class="w-3.5 h-3.5 text-slate-500" /> {{ t('tasks.newProject') }}
      </button>

      <button
        type="button"
        class="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-accent text-white rounded-lg text-xs font-bold hover:shadow-lg hover:shadow-accent/20 transition-all"
        @click="emit('new-task')"
      >
        <Plus class="w-3.5 h-3.5" /> {{ t('tasks.newTask') }}
      </button>
    </div>
  </div>
</template>
