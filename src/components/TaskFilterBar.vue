<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  X,
  FolderOpen,
  RotateCcw,
  EyeOff,
  Eye,
  User,
  SlidersHorizontal,
  Flame,
  ArrowUp,
  Minus,
  ArrowDown,
} from 'lucide-vue-next';
import type { Project } from '@/types/task';
import SegmentedControl from '@/components/ui/SegmentedControl.vue';

const { t } = useI18n();

const props = defineProps<{
  totalTasksCount: number;
  completionRate: number;
  overdueCount: number;
  selectedProjectId: string | null;
  projects: Project[];
  viewMode: 'board' | 'list';
  isAnyFilterActive: boolean;
}>();

const emit = defineEmits<{
  (e: 'clearProjectFilter'): void;
  (e: 'resetAllFilters'): void;
}>();

const dateFilter = defineModel<string>('dateFilter', { required: true });
const statusFilter = defineModel<string>('statusFilter', { required: true });
const priorityFilter = defineModel<string>('priorityFilter', { required: true });
const groupBy = defineModel<'status' | 'priority'>('groupBy', { required: true });
const sortBy = defineModel<'natural' | 'createdAt_asc' | 'createdAt_desc'>('sortBy', {
  required: true,
});
const hideCompleted = defineModel<boolean>('hideCompleted', { required: true });
const onlyMyTasks = defineModel<boolean>('onlyMyTasks', { required: true });
const visibleColumns = defineModel<Record<string, boolean>>('visibleColumns', { required: true });

const dateOptions = computed(() => [
  { id: 'all', label: t('tasks.all') },
  { id: 'overdue', label: t('tasks.overdue') },
  { id: 'today', label: t('tasks.today') },
  { id: 'week', label: t('tasks.week') },
]);

const statusOptions = computed(() => [
  { id: 'all', label: t('tasks.all') },
  { id: 'TODO', label: t('tasks.todo'), textColor: 'text-slate-500 dark:text-slate-400' },
  { id: 'IN_PROGRESS', label: t('tasks.inProgress'), textColor: 'text-blue-500' },
  { id: 'DONE', label: t('tasks.done'), textColor: 'text-emerald-500' },
]);

const priorityOptions = computed(() => [
  { id: 'all', label: t('tasks.all') },
  { id: 'URGENT', label: t('tasks.urgent'), textColor: 'text-red-500', icon: Flame },
  { id: 'HIGH', label: t('tasks.high'), textColor: 'text-orange-500', icon: ArrowUp },
  { id: 'MEDIUM', label: t('tasks.medium'), textColor: 'text-amber-500', icon: Minus },
  { id: 'LOW', label: t('tasks.low'), textColor: 'text-slate-400', icon: ArrowDown },
]);

const groupByOptions = computed(() => [
  { id: 'status', label: t('tasks.groupByStatus') },
  { id: 'priority', label: t('tasks.groupByPriority') },
]);

const sortByOptions = computed(() => [
  { id: 'natural', label: t('tasks.sortNatural') },
  { id: 'createdAt_asc', label: t('tasks.sortCreatedAsc') },
  { id: 'createdAt_desc', label: t('tasks.sortCreatedDesc') },
]);

const toggleColumnVisibility = (col: string) => {
  visibleColumns.value[col] = !visibleColumns.value[col];
  localStorage.setItem(`task_visible_col_${col}`, String(visibleColumns.value[col]));
};
</script>

<template>
  <div
    class="task-filter-bar px-3 sm:px-4 py-1.5 border-b flex flex-wrap items-center gap-2 md:gap-2.5 shrink-0"
    style="background-color: var(--bg-card); border-color: var(--border-base)"
  >
    <!-- Project Filter Pill -->
    <div
      v-if="selectedProjectId"
      class="flex items-center gap-1 px-2 py-1 rounded-lg bg-accent/15 border border-accent/30 text-accent whitespace-nowrap shadow-sm text-[9px] sm:text-[10px] font-bold shrink-0"
    >
      <FolderOpen class="w-3 h-3" />
      <span
        >{{ t('sidebar.projects') }}:
        {{ projects.find((p) => p.id === selectedProjectId)?.title || t('common.loading') }}</span
      >
      <button
        type="button"
        class="hover:text-rose-500 transition-colors ml-1 cursor-pointer"
        @click="emit('clearProjectFilter')"
      >
        <X class="w-2.5 h-2.5" />
      </button>
    </div>

    <!-- Date Filter -->
    <div class="flex items-center gap-1.5 shrink-0">
      <span
        class="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap"
        >{{ t('tasks.time') }}</span
      >
      <SegmentedControl v-model="dateFilter" size="sm" :options="dateOptions" />
    </div>

    <!-- Status Filter -->
    <div class="flex items-center gap-1.5 shrink-0">
      <span
        class="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap"
        >{{ t('tasks.statusLabel') }}</span
      >
      <SegmentedControl v-model="statusFilter" size="sm" :options="statusOptions" />
    </div>

    <!-- Priority Filter -->
    <div class="flex items-center gap-1.5 shrink-0">
      <span
        class="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap"
        >{{ t('tasks.priority') }}</span
      >
      <SegmentedControl v-model="priorityFilter" size="sm" :options="priorityOptions" />
    </div>

    <!-- Group By Selector -->
    <div class="flex items-center gap-1.5 shrink-0">
      <span
        class="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap"
        >{{ t('tasks.groupBy') }}</span
      >
      <SegmentedControl v-model="groupBy" size="sm" :options="groupByOptions" />
    </div>

    <!-- Sort By Selector -->
    <div class="flex items-center gap-1.5 shrink-0">
      <span
        class="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap"
        >{{ t('tasks.sortBy') }}</span
      >
      <SegmentedControl v-model="sortBy" size="sm" :options="sortByOptions" />
    </div>

    <!-- Hide Completed Toggle -->
    <button
      type="button"
      class="px-2 py-1 rounded-lg text-[9px] sm:text-[10px] font-bold transition-all flex items-center gap-1 whitespace-nowrap border cursor-pointer shrink-0"
      :class="
        hideCompleted
          ? 'bg-accent/15 border-accent/30 text-accent shadow-sm'
          : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 dark:hover:bg-white/10'
      "
      @click="hideCompleted = !hideCompleted"
    >
      <EyeOff v-if="hideCompleted" class="w-3.5 h-3.5 text-accent" />
      <Eye v-else class="w-3.5 h-3.5 text-slate-400" />
      <span>{{ t('tasks.hideCompleted') }}</span>
    </button>

    <!-- Only My Tasks Toggle -->
    <button
      type="button"
      class="px-2 py-1 rounded-lg text-[9px] sm:text-[10px] font-bold transition-all flex items-center gap-1 whitespace-nowrap border cursor-pointer shrink-0"
      :class="
        onlyMyTasks
          ? 'bg-accent/15 border-accent/30 text-accent shadow-sm'
          : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 dark:hover:bg-white/10'
      "
      @click="onlyMyTasks = !onlyMyTasks"
    >
      <User class="w-3.5 h-3.5 text-slate-400" :class="{ 'text-accent': onlyMyTasks }" />
      <span>{{ t('tasks.onlyMy') }}</span>
    </button>

    <!-- Column Visibility Popover -->
    <el-popover
      v-if="viewMode === 'list'"
      placement="bottom-end"
      :width="150"
      trigger="click"
      popper-class="glass-popover"
    >
      <template #reference>
        <button
          type="button"
          class="px-2 py-1 rounded-lg text-[9px] sm:text-[10px] font-bold transition-all flex items-center gap-1 whitespace-nowrap border bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 dark:hover:bg-white/10 cursor-pointer shrink-0"
        >
          <SlidersHorizontal class="w-3.5 h-3.5 text-slate-400" />
          <span>{{ t('tasks.showColumns') }}</span>
        </button>
      </template>
      <div class="p-1 space-y-2.5">
        <div
          class="text-[9px] font-black text-slate-400 dark:text-slate-500 tracking-wider uppercase mb-1"
        >
          {{ t('tasks.showListColumns') }}
        </div>
        <label
          class="flex items-center gap-2 text-xs cursor-pointer text-slate-600 dark:text-slate-300 select-none hover:text-accent transition-colors"
        >
          <input
            type="checkbox"
            :checked="visibleColumns.status"
            class="rounded border-slate-300 dark:border-slate-600 text-accent focus:ring-accent w-3.5 h-3.5"
            @change="toggleColumnVisibility('status')"
          />
          <span>{{ t('tasks.statusLabel') }}</span>
        </label>
        <label
          class="flex items-center gap-2 text-xs cursor-pointer text-slate-600 dark:text-slate-300 select-none hover:text-accent transition-colors"
        >
          <input
            type="checkbox"
            :checked="visibleColumns.project"
            class="rounded border-slate-300 dark:border-slate-600 text-accent focus:ring-accent w-3.5 h-3.5"
            @change="toggleColumnVisibility('project')"
          />
          <span>{{ t('tasks.associatedProject') }}</span>
        </label>
        <label
          class="flex items-center gap-2 text-xs cursor-pointer text-slate-600 dark:text-slate-300 select-none hover:text-accent transition-colors"
        >
          <input
            type="checkbox"
            :checked="visibleColumns.assignee"
            class="rounded border-slate-300 dark:border-slate-600 text-accent focus:ring-accent w-3.5 h-3.5"
            @change="toggleColumnVisibility('assignee')"
          />
          <span>{{ t('tasks.assignee') }}</span>
        </label>
        <label
          class="flex items-center gap-2 text-xs cursor-pointer text-slate-600 dark:text-slate-300 select-none hover:text-accent transition-colors"
        >
          <input
            type="checkbox"
            :checked="visibleColumns.dueDate"
            class="rounded border-slate-300 dark:border-slate-600 text-accent focus:ring-accent w-3.5 h-3.5"
            @change="toggleColumnVisibility('dueDate')"
          />
          <span>{{ t('tasks.dueDate') }}</span>
        </label>
        <label
          class="flex items-center gap-2 text-xs cursor-pointer text-slate-600 dark:text-slate-300 select-none hover:text-accent transition-colors"
        >
          <input
            type="checkbox"
            :checked="visibleColumns.priority"
            class="rounded border-slate-300 dark:border-slate-600 text-accent focus:ring-accent w-3.5 h-3.5"
            @change="toggleColumnVisibility('priority')"
          />
          <span>{{ t('tasks.priority') }}</span>
        </label>
      </div>
    </el-popover>

    <!-- Reset Filters Button -->
    <button
      v-if="isAnyFilterActive"
      type="button"
      class="px-2 py-1 rounded-lg text-[9px] sm:text-[10px] font-bold transition-all flex items-center gap-1 whitespace-nowrap border border-dashed border-rose-300 dark:border-rose-700/60 text-rose-500 hover:bg-rose-500/10 hover:border-rose-400 cursor-pointer shrink-0"
      @click="emit('resetAllFilters')"
    >
      <RotateCcw class="w-3.5 h-3.5 text-rose-500" />
      <span>{{ t('tasks.resetFilters') }}</span>
    </button>
  </div>
</template>
