<script setup lang="ts">
import { formatDate } from '@/utils/format';
import {
  BarChart3,
  LayoutGrid,
  List,
  Search,
  SlidersHorizontal,
  Layers,
  AlertTriangle,
  CalendarClock,
  Users,
} from 'lucide-vue-next';
import UserAvatar from '@/components/UserAvatar.vue';
import Tabs from '@/components/ui/Tabs.vue';
import Dropdown from '@/components/ui/Dropdown.vue';
import type { ProjectStatusFilter, FocusFilter, ViewMode, InsightProjectHealth } from '../types';
import type { Project } from '@/types/task';

defineProps<{
  filteredProjectRows: Array<{
    project: Project;
    taskStats: {
      total: number;
      done: number;
      todo: number;
      inProgress: number;
      overdue: number;
      dueSoon: number;
      unassigned: number;
      completionRate: number;
    };
    health: {
      label: string;
      class: string;
      level: number;
    };
    daysLeft: number | null;
  }>;
  projectStats: {
    total: number;
    active: number;
    completed: number;
    completionRate: number;
    averageProgress: number;
  };
  projectHealthById: Map<string, InsightProjectHealth>;
}>();

const emit = defineEmits<{
  (e: 'click-project', id: string): void;
  (e: 'navigate-board', projectId?: string): void;
  (e: 'open-edit', project: Project): void;
  (e: 'delete-project', id: string): void;
  (e: 'open-create'): void;
}>();

const viewMode = defineModel<ViewMode>('viewMode', { default: 'grid' });
const statusFilter = defineModel<ProjectStatusFilter>('statusFilter', { default: 'ALL' });
const focusFilter = defineModel<FocusFilter>('focusFilter', { default: 'all' });
const quickTaskProjectId = defineModel<string>('quickTaskProjectId', { default: '' });

const statusOptions = [
  { value: 'ALL', label: '全部' },
  { value: 'PLANNED', label: '规划中' },
  { value: 'IN_PROGRESS', label: '推进中' },
  { value: 'PAUSED', label: '已暂停' },
  { value: 'COMPLETED', label: '已完成' },
] as const;

const focusTabsOptions = [
  { value: 'all', label: '全部项目', icon: Layers },
  { value: 'attention', label: '需要关注', icon: AlertTriangle },
  { value: 'dueSoon', label: '即将到期', icon: CalendarClock },
  { value: 'unassigned', label: '待分配', icon: Users },
];
</script>

<template>
  <div
    class="mobile-adaptive rounded-2xl border overflow-hidden shadow-sm"
    style="background-color: var(--bg-card); border-color: var(--border-base)"
  >
    <div
      class="mobile-row py-1.5 px-3 sm:py-2 sm:px-4 border-b flex flex-col xl:flex-row xl:items-center justify-start gap-4 xl:gap-8"
      style="border-color: var(--border-base)"
    >
      <!-- Left Area: Title + Quick Filters -->
      <div class="mobile-row flex flex-col md:flex-row md:items-center gap-3 xl:gap-5 min-w-0">
        <!-- Title -->
        <div class="flex items-center gap-2 min-w-0 shrink-0">
          <BarChart3 class="w-4 h-4 text-accent shrink-0" />
          <h2 class="text-sm sm:text-base font-black truncate" style="color: var(--text-primary)">
            项目态势
          </h2>
          <span class="text-[10px] font-black text-slate-400">
            {{ filteredProjectRows.length }}/{{ projectStats.total }}
          </span>
        </div>

        <!-- Desktop Divider -->
        <div class="hidden md:block w-px h-3.5 bg-slate-200 dark:bg-slate-700 shrink-0"></div>

        <!-- Quick Filters -->
        <div class="mobile-row flex items-center gap-2 overflow-x-auto scrollbar-hide">
          <Tabs
            v-model="focusFilter"
            :options="focusTabsOptions"
            size="sm"
            class="!bg-transparent border-none shrink-0"
          />
        </div>
      </div>

      <!-- Right Area: Status Tabs & View Toggle -->
      <div class="mobile-row flex items-center gap-2 overflow-x-auto scrollbar-hide shrink-0">
        <Tabs
          v-model="statusFilter"
          :options="statusOptions"
          size="sm"
          class="!bg-transparent border-none shrink-0"
        />

        <Tabs
          v-model="viewMode"
          :options="[
            { value: 'grid', icon: LayoutGrid },
            { value: 'list', icon: List },
          ]"
          size="sm"
          class="!bg-transparent border-none shrink-0"
        />
      </div>
    </div>

    <div
      v-if="filteredProjectRows.length === 0"
      class="flex flex-col items-center justify-center py-16 text-center"
    >
      <Search class="w-10 h-10 text-slate-300 mb-3" />
      <h3 class="text-base font-black mb-1" style="color: var(--text-primary)">没有匹配的项目</h3>
      <p class="text-xs text-slate-400 mb-5">换个筛选条件，或者创建一个新的团队项目。</p>
      <button
        type="button"
        class="px-4 py-2 bg-accent text-white rounded-xl text-xs font-black border-none cursor-pointer"
        @click="emit('open-create')"
      >
        新建项目
      </button>
    </div>

    <div v-else class="p-3 sm:p-4">
      <div
        v-if="viewMode === 'grid'"
        class="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-2.5"
      >
        <div
          v-for="row in filteredProjectRows"
          :key="row.project.id"
          class="rounded-xl border bg-slate-50/80 dark:bg-white/5 p-4.5 cursor-pointer hover:border-accent/35 hover:bg-white dark:hover:bg-white/8 hover:scale-[1.01] hover:shadow-md hover:shadow-accent/5 transition-all duration-300"
          style="border-color: var(--border-base)"
          @click="emit('click-project', row.project.id)"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-start gap-2.5 min-w-0">
              <div
                class="w-8 h-8 rounded-lg text-white text-xs font-black flex items-center justify-center shrink-0"
                :class="row.project.color || 'bg-accent'"
              >
                {{ row.project.title.slice(0, 1) }}
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-2 min-w-0">
                  <p class="text-xs font-black truncate" style="color: var(--text-primary)">
                    {{ row.project.title }}
                  </p>
                  <span
                    class="px-1.5 py-0.5 rounded text-[8px] font-black shrink-0"
                    :class="
                      projectHealthById.get(row.project.id)?.riskLevel === 'HIGH'
                        ? 'bg-rose-500/10 text-rose-600'
                        : projectHealthById.get(row.project.id)?.riskLevel === 'MEDIUM'
                          ? 'bg-amber-500/10 text-amber-600'
                          : row.health.class
                    "
                  >
                    {{
                      projectHealthById.get(row.project.id)?.healthScore
                        ? `${projectHealthById.get(row.project.id)?.healthScore}分`
                        : row.health.label
                    }}
                  </span>
                </div>
                <p class="mt-0.5 text-[10px] font-bold text-slate-400 truncate">
                  {{ row.project.description || '暂无描述' }}
                </p>
              </div>
            </div>

            <div class="flex items-center gap-1 shrink-0" @click.stop>
              <button
                type="button"
                class="h-7 px-2 rounded-lg bg-accent/10 text-accent text-[9px] font-black border-none cursor-pointer"
                @click="emit('navigate-board', row.project.id)"
              >
                看板
              </button>
              <Dropdown align="right" width-class="w-36">
                <template #trigger>
                  <button
                    type="button"
                    class="h-7 w-7 rounded-lg bg-white dark:bg-slate-900 text-slate-400 border-none cursor-pointer flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <SlidersHorizontal class="w-3.5 h-3.5" />
                  </button>
                </template>
                <template #content>
                  <button
                    type="button"
                    class="w-full text-left px-3 py-1.5 rounded-lg font-bold text-xs hover:bg-slate-100 dark:hover:bg-white/5 text-[var(--text-primary)] border-none bg-transparent cursor-pointer transition-colors"
                    @click="emit('open-edit', row.project)"
                  >
                    配置项目
                  </button>
                  <button
                    type="button"
                    class="w-full text-left px-3 py-1.5 rounded-lg font-bold text-xs hover:bg-slate-100 dark:hover:bg-white/5 text-[var(--text-primary)] border-none bg-transparent cursor-pointer transition-colors"
                    @click="quickTaskProjectId = row.project.id"
                  >
                    设为派发目标
                  </button>
                  <div class="h-[1px] my-1 bg-slate-100 dark:bg-white/10"></div>
                  <button
                    type="button"
                    class="w-full text-left px-3 py-1.5 rounded-lg font-bold text-xs text-rose-500 hover:bg-rose-500/10 border-none bg-transparent cursor-pointer transition-colors"
                    @click="emit('delete-project', row.project.id)"
                  >
                    删除项目
                  </button>
                </template>
              </Dropdown>
            </div>
          </div>

          <div class="mt-3 grid grid-cols-4 gap-1.5 text-[10px] font-black">
            <div class="rounded-md bg-white/80 dark:bg-slate-900/40 px-2 py-1.5 text-slate-500">
              任务 {{ row.taskStats.total }}
            </div>
            <div class="rounded-md bg-white/80 dark:bg-slate-900/40 px-2 py-1.5 text-slate-500">
              进行 {{ row.taskStats.inProgress }}
            </div>
            <div
              class="rounded-md px-2 py-1.5"
              :class="
                row.taskStats.overdue > 0
                  ? 'bg-rose-500/10 text-rose-600'
                  : 'bg-emerald-500/10 text-emerald-600'
              "
            >
              逾期 {{ row.taskStats.overdue }}
            </div>
            <div class="rounded-md bg-white/80 dark:bg-slate-900/40 px-2 py-1.5 text-slate-500">
              {{
                row.daysLeft === null
                  ? '无截止'
                  : row.daysLeft < 0
                    ? `超${Math.abs(row.daysLeft)}天`
                    : `${row.daysLeft}天`
              }}
            </div>
          </div>

          <div class="mt-3 flex items-center gap-3">
            <div class="min-w-0 flex-1">
              <div class="flex items-center justify-between text-[9px] font-black mb-1">
                <span class="text-slate-400"
                  >完成 {{ row.taskStats.done }}/{{ row.taskStats.total }}</span
                >
                <span class="text-accent">{{ row.taskStats.completionRate }}%</span>
              </div>
              <div class="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  class="h-full bg-accent rounded-full"
                  :style="{ width: row.taskStats.completionRate + '%' }"
                ></div>
              </div>
            </div>
            <div class="flex items-center -space-x-1.5 shrink-0">
              <UserAvatar
                v-for="member in row.project.members.slice(0, 3)"
                :key="member.userId"
                :user="member.user"
                size="xs"
                class="border"
                style="border-color: var(--bg-card)"
              />
              <span
                v-if="row.project.members.length > 3"
                class="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-[9px] font-black text-slate-500 flex items-center justify-center"
              >
                +{{ row.project.members.length - 3 }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="mobile-table overflow-x-auto scrollbar-hide">
        <table class="w-full min-w-[900px] text-left border-collapse">
          <thead>
            <tr
              class="border-b text-[10px] font-black uppercase tracking-widest text-slate-400"
              style="border-color: var(--border-base)"
            >
              <th class="px-3 py-3">项目</th>
              <th class="px-3 py-3">健康度</th>
              <th class="px-3 py-3">任务</th>
              <th class="px-3 py-3">截止</th>
              <th class="px-3 py-3">成员</th>
              <th class="px-3 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in filteredProjectRows"
              :key="row.project.id"
              class="border-b last:border-0 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer"
              style="border-color: var(--border-base)"
              @click="emit('click-project', row.project.id)"
            >
              <td class="px-3 py-3">
                <div class="flex items-center gap-3 min-w-0">
                  <div
                    class="w-9 h-9 rounded-xl text-white font-black flex items-center justify-center shrink-0"
                    :class="row.project.color || 'bg-accent'"
                  >
                    {{ row.project.title.slice(0, 1) }}
                  </div>
                  <div class="min-w-0">
                    <p class="text-xs font-black truncate" style="color: var(--text-primary)">
                      {{ row.project.title }}
                    </p>
                    <p class="text-[10px] text-slate-400 truncate max-w-sm">
                      {{ row.project.description || '暂无描述' }}
                    </p>
                  </div>
                </div>
              </td>
              <td class="px-3 py-3">
                <span
                  class="px-2.5 py-1 rounded-lg text-[10px] font-black"
                  :class="
                    projectHealthById.get(row.project.id)?.riskLevel === 'HIGH'
                      ? 'bg-rose-500/10 text-rose-600'
                      : projectHealthById.get(row.project.id)?.riskLevel === 'MEDIUM'
                        ? 'bg-amber-500/10 text-amber-600'
                        : row.health.class
                  "
                >
                  {{
                    projectHealthById.get(row.project.id)?.healthScore
                      ? `${projectHealthById.get(row.project.id)?.healthScore} 分`
                      : row.health.label
                  }}
                </span>
              </td>
              <td class="px-3 py-3">
                <div class="w-40">
                  <div class="flex justify-between text-[10px] font-black mb-1">
                    <span class="text-slate-400"
                      >{{ row.taskStats.done }}/{{ row.taskStats.total }}</span
                    >
                    <span class="text-accent">{{ row.taskStats.completionRate }}%</span>
                  </div>
                  <div class="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      class="h-full bg-accent rounded-full"
                      :style="{ width: row.taskStats.completionRate + '%' }"
                    ></div>
                  </div>
                </div>
              </td>
              <td class="px-3 py-3 text-xs font-bold text-slate-500">
                {{ formatDate(row.project.dueDate) }}
              </td>
              <td class="px-3 py-3">
                <div class="flex items-center -space-x-1.5">
                  <UserAvatar
                    v-for="member in row.project.members.slice(0, 4)"
                    :key="member.userId"
                    :user="member.user"
                    size="xs"
                    class="border"
                    style="border-color: var(--bg-card)"
                  />
                  <span
                    v-if="row.project.members.length > 4"
                    class="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-[9px] font-black text-slate-500 flex items-center justify-center"
                  >
                    +{{ row.project.members.length - 4 }}
                  </span>
                </div>
              </td>
              <td class="px-3 py-3 text-right">
                <div class="flex items-center justify-end gap-1.5" @click.stop>
                  <button
                    type="button"
                    class="h-7 px-2.5 rounded-lg bg-accent/10 text-accent text-[9px] font-black border-none cursor-pointer"
                    @click="emit('navigate-board', row.project.id)"
                  >
                    看板
                  </button>
                  <Dropdown align="right" width-class="w-36">
                    <template #trigger>
                      <button
                        type="button"
                        class="h-7 w-7 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 border-none cursor-pointer flex items-center justify-center transition-colors"
                      >
                        <SlidersHorizontal class="w-3.5 h-3.5" />
                      </button>
                    </template>
                    <template #content>
                      <button
                        type="button"
                        class="w-full text-left px-3 py-1.5 rounded-lg font-bold text-xs hover:bg-slate-100 dark:hover:bg-white/5 text-[var(--text-primary)] border-none bg-transparent cursor-pointer transition-colors"
                        @click="emit('open-edit', row.project)"
                      >
                        配置项目
                      </button>
                      <button
                        type="button"
                        class="w-full text-left px-3 py-1.5 rounded-lg font-bold text-xs hover:bg-slate-100 dark:hover:bg-white/5 text-[var(--text-primary)] border-none bg-transparent cursor-pointer transition-colors"
                        @click="quickTaskProjectId = row.project.id"
                      >
                        设为派发目标
                      </button>
                      <div class="h-[1px] my-1 bg-slate-100 dark:bg-white/10"></div>
                      <button
                        type="button"
                        class="w-full text-left px-3 py-1.5 rounded-lg font-bold text-xs text-rose-500 hover:bg-rose-500/10 border-none bg-transparent cursor-pointer transition-colors"
                        @click="emit('delete-project', row.project.id)"
                      >
                        删除项目
                      </button>
                    </template>
                  </Dropdown>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
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
