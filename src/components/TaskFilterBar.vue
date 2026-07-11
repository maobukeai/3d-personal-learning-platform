<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  FolderOpen,
  RotateCcw,
  EyeOff,
  Eye,
  User,
  Flame,
  ArrowUp,
  Minus,
  ArrowDown,
  ChevronDown,
  ArrowUpDown,
  Calendar,
  Layers,
  SortAsc,
  CheckSquare,
} from 'lucide-vue-next';
import type { Project, UserType } from '@/types/task';

const { t } = useI18n();

defineProps<{
  totalTasksCount: number;
  completionRate: number;
  overdueCount: number;
  projects: Project[];
  viewMode: 'board' | 'list' | 'calendar';
  isAnyFilterActive: boolean;
  teamMembers: UserType[];
  allTags: string[];
}>();

const selectedProjectId = defineModel<string | null>('selectedProjectId', { required: true });

const emit = defineEmits<{
  (e: 'clearProjectFilter'): void;
  (e: 'resetAllFilters'): void;
}>();

const dateFilter = defineModel<string>('dateFilter', { required: true });
const statusFilter = defineModel<string>('statusFilter', { required: true });
const priorityFilter = defineModel<string>('priorityFilter', { required: true });
const groupBy = defineModel<'status' | 'priority' | 'assignee' | 'dueDate'>('groupBy', {
  required: true,
});
const sortBy = defineModel<'natural' | 'createdAt_asc' | 'createdAt_desc'>('sortBy', {
  required: true,
});
const sortOrder = defineModel<'asc' | 'desc'>('sortOrder', { required: true });
const hideCompleted = defineModel<boolean>('hideCompleted', { required: true });
const onlyMyTasks = defineModel<boolean>('onlyMyTasks', { required: true });
defineModel<Record<string, boolean>>('visibleColumns', { required: true });
const assigneeFilter = defineModel<string>('assigneeFilter', { required: true });
const tagFilter = defineModel<string>('tagFilter', { required: true });
const subtaskDisplay = defineModel<'collapse' | 'expand' | 'separate'>('subtaskDisplay', {
  required: true,
});

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
  { id: 'assignee', label: '按负责人分组' },
  { id: 'dueDate', label: '按截止日期分组' },
]);

const sortByOptions = computed(() => [
  { id: 'natural', label: t('tasks.sortNatural') },
  { id: 'createdAt_asc', label: t('tasks.sortCreatedAsc') },
  { id: 'createdAt_desc', label: t('tasks.sortCreatedDesc') },
]);

const toggleSortOrder = () => {
  sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
};
</script>

<template>
  <div
    class="task-filter-bar px-4 py-2 border-b flex items-center justify-between gap-3 shrink-0 overflow-x-auto scrollbar-hide select-none"
    style="background-color: var(--bg-card); border-color: var(--border-base)"
  >
    <!-- Left Section: Search filters & Toggle views -->
    <div class="flex items-center gap-2 sm:gap-2.5 min-w-0">
      <!-- Project Filter Dropdown -->
      <Dropdown
        trigger="click"
        popper-class="glass-popover"
        @command="
          (val: any) => {
            selectedProjectId = val === 'all' ? null : val;
          }
        "
      >
        <button
          type="button"
          class="px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0 border"
          :class="
            selectedProjectId
              ? 'bg-accent/15 border-accent/25 text-accent shadow-sm'
              : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-white/10'
          "
        >
          <FolderOpen
            class="w-3.5 h-3.5 shrink-0"
            :class="selectedProjectId ? 'text-accent' : 'text-slate-400'"
          />
          <span
            >项目:
            {{
              selectedProjectId === 'unassigned'
                ? '未指定'
                : selectedProjectId
                  ? projects.find((p) => p.id === selectedProjectId)?.title || '未知项目'
                  : '全部'
            }}</span
          >
          <ChevronDown class="w-3 h-3 opacity-60" />
        </button>
        <template #dropdown>
          <DropdownMenu>
            <DropdownItem
              command="all"
              :class="{ 'is-active text-accent font-bold': !selectedProjectId }"
            >
              全部项目
            </DropdownItem>
            <DropdownItem
              command="unassigned"
              :class="{ 'is-active text-accent font-bold': selectedProjectId === 'unassigned' }"
            >
              未指定项目
            </DropdownItem>
            <DropdownItem
              v-for="p in projects"
              :key="p.id"
              :command="p.id"
              :class="{ 'is-active text-accent font-bold': selectedProjectId === p.id }"
            >
              {{ p.title }}
            </DropdownItem>
          </DropdownMenu>
        </template>
      </Dropdown>

      <!-- Me Mode Toggle -->
      <button
        type="button"
        class="px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-bold transition-all flex items-center gap-1 whitespace-nowrap border cursor-pointer shrink-0"
        :class="
          onlyMyTasks
            ? 'bg-accent/15 border-accent/25 text-accent shadow-sm'
            : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-white/10'
        "
        @click="onlyMyTasks = !onlyMyTasks"
      >
        <User class="w-3.5 h-3.5" :class="{ 'text-accent': onlyMyTasks }" />
        <span>仅看我的</span>
      </button>

      <!-- Hide Completed Toggle -->
      <button
        type="button"
        class="px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-bold transition-all flex items-center gap-1 whitespace-nowrap border cursor-pointer shrink-0"
        :class="
          hideCompleted
            ? 'bg-accent/15 border-accent/25 text-accent shadow-sm'
            : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-white/10'
        "
        @click="hideCompleted = !hideCompleted"
      >
        <EyeOff v-if="hideCompleted" class="w-3.5 h-3.5 text-accent" />
        <Eye v-else class="w-3.5 h-3.5 text-slate-400" />
        <span>隐藏已完成</span>
      </button>

      <div class="h-4 w-[1px] bg-slate-200 dark:bg-slate-700 shrink-0"></div>

      <!-- Time Dropdown -->
      <Dropdown
        trigger="click"
        popper-class="glass-popover"
        @command="(val: any) => (dateFilter = val)"
      >
        <button
          type="button"
          class="px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0 border"
          :class="
            dateFilter !== 'all'
              ? 'bg-accent/15 border-accent/25 text-accent shadow-sm'
              : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-white/10'
          "
        >
          <Calendar
            class="w-3.5 h-3.5 shrink-0"
            :class="dateFilter !== 'all' ? 'text-accent' : 'text-slate-400'"
          />
          <span>时间: {{ dateOptions.find((o) => o.id === dateFilter)?.label }}</span>
          <ChevronDown class="w-3 h-3 opacity-60" />
        </button>
        <template #dropdown>
          <DropdownMenu>
            <DropdownItem
              v-for="opt in dateOptions"
              :key="opt.id"
              :command="opt.id"
              :class="{ 'is-active text-accent font-bold': dateFilter === opt.id }"
            >
              {{ opt.label }}
            </DropdownItem>
          </DropdownMenu>
        </template>
      </Dropdown>

      <!-- Status Dropdown -->
      <Dropdown
        trigger="click"
        popper-class="glass-popover"
        @command="(val: any) => (statusFilter = val)"
      >
        <button
          type="button"
          class="px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0 border"
          :class="
            statusFilter !== 'all'
              ? 'bg-accent/15 border-accent/25 text-accent shadow-sm'
              : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-white/10'
          "
        >
          <div
            class="w-1.5 h-1.5 rounded-full shrink-0"
            :class="statusFilter !== 'all' ? 'bg-accent' : 'bg-slate-400'"
          ></div>
          <span>状态: {{ statusOptions.find((o) => o.id === statusFilter)?.label }}</span>
          <ChevronDown class="w-3 h-3 opacity-60" />
        </button>
        <template #dropdown>
          <DropdownMenu>
            <DropdownItem
              v-for="opt in statusOptions"
              :key="opt.id"
              :command="opt.id"
              :class="{ 'is-active text-accent font-bold': statusFilter === opt.id }"
            >
              <span :class="opt.textColor">{{ opt.label }}</span>
            </DropdownItem>
          </DropdownMenu>
        </template>
      </Dropdown>

      <!-- Priority Dropdown -->
      <Dropdown
        trigger="click"
        popper-class="glass-popover"
        @command="(val: any) => (priorityFilter = val)"
      >
        <button
          type="button"
          class="px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0 border"
          :class="
            priorityFilter !== 'all'
              ? 'bg-accent/15 border-accent/25 text-accent shadow-sm'
              : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-white/10'
          "
        >
          <Flame
            class="w-3.5 h-3.5 shrink-0"
            :class="priorityFilter !== 'all' ? 'text-accent' : 'text-slate-400'"
          />
          <span>优先级: {{ priorityOptions.find((o) => o.id === priorityFilter)?.label }}</span>
          <ChevronDown class="w-3 h-3 opacity-60" />
        </button>
        <template #dropdown>
          <DropdownMenu>
            <DropdownItem
              v-for="opt in priorityOptions"
              :key="opt.id"
              :command="opt.id"
              :class="{ 'is-active text-accent font-bold': priorityFilter === opt.id }"
            >
              <div class="flex items-center gap-1.5">
                <component
                  :is="opt.icon"
                  v-if="opt.icon"
                  class="w-3.5 h-3.5"
                  :class="opt.textColor"
                />
                <span :class="opt.textColor">{{ opt.label }}</span>
              </div>
            </DropdownItem>
          </DropdownMenu>
        </template>
      </Dropdown>

      <!-- Assignee Dropdown -->
      <Dropdown
        trigger="click"
        popper-class="glass-popover"
        @command="(val: any) => (assigneeFilter = val)"
      >
        <button
          type="button"
          class="px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0 border"
          :class="
            assigneeFilter !== 'all'
              ? 'bg-accent/15 border-accent/25 text-accent shadow-sm'
              : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-white/10'
          "
        >
          <User
            class="w-3.5 h-3.5 shrink-0"
            :class="assigneeFilter !== 'all' ? 'text-accent' : 'text-slate-400'"
          />
          <span
            >成员:
            {{
              assigneeFilter === 'all'
                ? '全部'
                : assigneeFilter === 'unassigned'
                  ? '未指派'
                  : teamMembers.find((m) => m.id === assigneeFilter)?.name || '成员'
            }}</span
          >
          <ChevronDown class="w-3 h-3 opacity-60" />
        </button>
        <template #dropdown>
          <DropdownMenu>
            <DropdownItem
              command="all"
              :class="{ 'is-active text-accent font-bold': assigneeFilter === 'all' }"
            >
              全部成员
            </DropdownItem>
            <DropdownItem
              command="unassigned"
              :class="{ 'is-active text-accent font-bold': assigneeFilter === 'unassigned' }"
            >
              未指派
            </DropdownItem>
            <DropdownItem
              v-for="m in teamMembers"
              :key="m.id"
              :command="m.id"
              :class="{ 'is-active text-accent font-bold': assigneeFilter === m.id }"
            >
              <div class="flex items-center gap-2">
                <img
                  v-if="m.avatarUrl"
                  :src="m.avatarUrl"
                  class="w-4 h-4 rounded-full object-cover"
                />
                <span>{{ m.name }}</span>
              </div>
            </DropdownItem>
          </DropdownMenu>
        </template>
      </Dropdown>

      <!-- Tag Dropdown -->
      <Dropdown
        trigger="click"
        popper-class="glass-popover"
        @command="(val: any) => (tagFilter = val)"
      >
        <button
          type="button"
          class="px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0 border"
          :class="
            tagFilter !== 'all'
              ? 'bg-accent/15 border-accent/25 text-accent shadow-sm'
              : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-white/10'
          "
        >
          <Layers
            class="w-3.5 h-3.5 shrink-0"
            :class="tagFilter !== 'all' ? 'text-accent' : 'text-slate-400'"
          />
          <span>标签: {{ tagFilter === 'all' ? '全部' : tagFilter }}</span>
          <ChevronDown class="w-3 h-3 opacity-60" />
        </button>
        <template #dropdown>
          <DropdownMenu>
            <DropdownItem
              command="all"
              :class="{ 'is-active text-accent font-bold': tagFilter === 'all' }"
            >
              全部标签
            </DropdownItem>
            <DropdownItem
              v-for="tag in allTags"
              :key="tag"
              :command="tag"
              :class="{ 'is-active text-accent font-bold': tagFilter === tag }"
            >
              {{ tag }}
            </DropdownItem>
            <DropdownItem v-if="allTags.length === 0" disabled> 暂无标签 </DropdownItem>
          </DropdownMenu>
        </template>
      </Dropdown>

      <!-- Subtasks Display Dropdown -->
      <Dropdown
        trigger="click"
        popper-class="glass-popover"
        @command="(val: any) => (subtaskDisplay = val)"
      >
        <button
          type="button"
          class="px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0 border"
          :class="
            subtaskDisplay !== 'collapse'
              ? 'bg-accent/15 border-accent/25 text-accent shadow-sm'
              : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-white/10'
          "
        >
          <CheckSquare
            class="w-3.5 h-3.5 shrink-0"
            :class="subtaskDisplay !== 'collapse' ? 'text-accent' : 'text-slate-400'"
          />
          <span
            >子任务:
            {{
              subtaskDisplay === 'collapse'
                ? '折叠'
                : subtaskDisplay === 'expand'
                  ? '展开'
                  : '独立任务'
            }}</span
          >
          <ChevronDown class="w-3 h-3 opacity-60" />
        </button>
        <template #dropdown>
          <DropdownMenu>
            <DropdownItem
              command="collapse"
              :class="{ 'is-active text-accent font-bold': subtaskDisplay === 'collapse' }"
            >
              折叠所有子任务
            </DropdownItem>
            <DropdownItem
              command="expand"
              :class="{ 'is-active text-accent font-bold': subtaskDisplay === 'expand' }"
            >
              展开所有子任务
            </DropdownItem>
            <DropdownItem
              command="separate"
              :class="{ 'is-active text-accent font-bold': subtaskDisplay === 'separate' }"
            >
              作为独立任务显示
            </DropdownItem>
          </DropdownMenu>
        </template>
      </Dropdown>
    </div>

    <!-- Right Section: Grouping & Sorting in one line -->
    <div class="flex items-center gap-2 sm:gap-2.5 shrink-0 ml-auto">
      <!-- Group By Dropdown -->
      <Dropdown
        trigger="click"
        popper-class="glass-popover"
        @command="(val: any) => (groupBy = val)"
      >
        <button
          type="button"
          class="px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-bold transition-all flex items-center gap-1 cursor-pointer border"
          :class="
            groupBy !== 'status'
              ? 'bg-accent/15 border-accent/25 text-accent shadow-sm'
              : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-white/10'
          "
        >
          <Layers
            class="w-3.5 h-3.5 shrink-0"
            :class="groupBy !== 'status' ? 'text-accent' : 'text-slate-400'"
          />
          <span>分组: {{ groupByOptions.find((o) => o.id === groupBy)?.label }}</span>
          <ChevronDown class="w-3 h-3 opacity-60" />
        </button>
        <template #dropdown>
          <DropdownMenu>
            <DropdownItem
              v-for="opt in groupByOptions"
              :key="opt.id"
              :command="opt.id"
              :class="{ 'is-active text-accent font-bold': groupBy === opt.id }"
            >
              {{ opt.label }}
            </DropdownItem>
          </DropdownMenu>
        </template>
      </Dropdown>

      <!-- Sort By Dropdown -->
      <Dropdown
        trigger="click"
        popper-class="glass-popover"
        @command="(val: any) => (sortBy = val)"
      >
        <button
          type="button"
          class="px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-bold transition-all flex items-center gap-1 cursor-pointer border"
          :class="
            sortBy !== 'natural'
              ? 'bg-accent/15 border-accent/25 text-accent shadow-sm'
              : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-white/10'
          "
        >
          <SortAsc
            class="w-3.5 h-3.5 shrink-0"
            :class="sortBy !== 'natural' ? 'text-accent' : 'text-slate-400'"
          />
          <span>排序: {{ sortByOptions.find((o) => o.id === sortBy)?.label }}</span>
          <ChevronDown class="w-3 h-3 opacity-60" />
        </button>
        <template #dropdown>
          <DropdownMenu>
            <DropdownItem
              v-for="opt in sortByOptions"
              :key="opt.id"
              :command="opt.id"
              :class="{ 'is-active text-accent font-bold': sortBy === opt.id }"
            >
              {{ opt.label }}
            </DropdownItem>
          </DropdownMenu>
        </template>
      </Dropdown>

      <!-- Sort Direction Toggle Button -->
      <button
        type="button"
        class="p-1 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200/50 dark:hover:bg-white/10 transition-all cursor-pointer flex items-center justify-center shrink-0"
        :title="sortOrder === 'asc' ? '升序' : '降序'"
        @click="toggleSortOrder"
      >
        <ArrowUpDown
          class="w-3.5 h-3.5 text-slate-400"
          :class="{ 'transform rotate-180 text-accent': sortOrder === 'desc' }"
        />
      </button>

      <!-- Reset Filters Button -->
      <button
        v-if="isAnyFilterActive"
        type="button"
        class="px-2 py-1 rounded-lg text-[10px] sm:text-xs font-bold transition-all flex items-center gap-1 border border-dashed border-rose-300 dark:border-rose-700/60 text-rose-500 hover:bg-rose-500/10 hover:border-rose-400 cursor-pointer shrink-0"
        @click="emit('resetAllFilters')"
      >
        <RotateCcw class="w-3.5 h-3.5 text-rose-500 animate-spin-hover" />
        <span class="hidden sm:inline">重置</span>
      </button>
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
