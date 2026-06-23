<script setup lang="ts">
import { formatDate, formatRelativeTime } from '@/utils/format';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  Clock3,
  Sparkles,
  Target,
  Users,
  Zap,
} from 'lucide-vue-next';
import UserAvatar from '@/components/UserAvatar.vue';
import Tabs from '@/components/ui/Tabs.vue';
import type { Project, Task, UserType } from '@/types/task';
import { isTaskOverdue } from '@/utils/taskDisplay';
import type {
  FocusFilter,
  InsightRecommendedAssignee,
  InsightProjectHealth,
  InsightActivityItem,
} from '../types';

defineProps<{
  projects: Project[];
  teamMembers: UserType[];
  recommendedAssignee: InsightRecommendedAssignee | null;
  recommendedAssigneeName: string;
  selectedQuickProject: Project | null;
  selectedQuickProjectStats: {
    total: number;
    done: number;
    todo: number;
    inProgress: number;
    overdue: number;
    dueSoon: number;
    unassigned: number;
    completionRate: number;
  } | null;
  selectedAssigneeWorkload:
    | {
        member: UserType;
        assigned: number;
        active: number;
        done: number;
        overdue: number;
        rate: number;
      }
    | undefined;
  isCreatingTask: boolean;
  isCreatingSeedTasks: boolean;
  insightRiskProjects: InsightProjectHealth[];
  dueSoonTasks: Task[];
  overdueTasks: Task[];
  workloadRows: Array<{
    member: UserType;
    assigned: number;
    active: number;
    done: number;
    overdue: number;
    rate: number;
  }>;
  activityItems: InsightActivityItem[];
}>();

const emit = defineEmits<{
  (e: 'select-recommended'): void;
  (e: 'create-task'): void;
  (e: 'create-seed-tasks', template: SeedTemplate): void;
  (e: 'click-project', id: string): void;
  (e: 'navigate-board', projectId: string | null | undefined): void;
  (e: 'navigate-insight', route: string): void;
}>();

const activeSidebarTab = defineModel<'dispatch' | 'risk' | 'team'>('activeSidebarTab', {
  default: 'dispatch',
});
const quickTaskTitle = defineModel<string>('quickTaskTitle', { default: '' });
const quickTaskProjectId = defineModel<string>('quickTaskProjectId', { default: '' });
const quickTaskAssigneeId = defineModel<string>('quickTaskAssigneeId', { default: '' });
const quickTaskDueDate = defineModel<string>('quickTaskDueDate', { default: '' });
const quickTaskPriority = defineModel<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('quickTaskPriority', {
  default: 'MEDIUM',
});
const focusFilter = defineModel<FocusFilter>('focusFilter', { default: 'all' });

const sidebarTabs = [
  { value: 'dispatch', label: '任务', icon: Zap },
  { value: 'risk', label: '风险', icon: Target },
  { value: 'team', label: '团队', icon: Users },
] as const;

const priorityOptions = [
  { value: 'LOW', label: '低', class: 'bg-slate-400' },
  { value: 'MEDIUM', label: '中', class: 'bg-amber-500' },
  { value: 'HIGH', label: '高', class: 'bg-orange-500' },
  { value: 'URGENT', label: '紧急', class: 'bg-rose-500' },
] as const;

interface SeedTaskTemplate {
  title: string;
  priority: string;
  days: number;
}

interface SeedTemplate {
  key: string;
  label: string;
  hint: string;
  tasks: SeedTaskTemplate[];
}

const quickSeedTemplates: SeedTemplate[] = [
  {
    key: 'launch',
    label: '项目启动包',
    hint: '目标、分工、首个里程碑',
    tasks: [
      { title: '确认项目目标与验收标准', priority: 'HIGH', days: 1 },
      { title: '拆分首周任务并明确负责人', priority: 'MEDIUM', days: 2 },
      { title: '同步首个交付里程碑', priority: 'MEDIUM', days: 5 },
    ],
  },
  {
    key: 'review',
    label: '复盘推进包',
    hint: '问题、行动、下次检查',
    tasks: [
      { title: '整理当前阻塞与风险清单', priority: 'HIGH', days: 1 },
      { title: '更新项目进度与下一步动作', priority: 'MEDIUM', days: 2 },
      { title: '安排下一次项目复盘', priority: 'LOW', days: 7 },
    ],
  },
  {
    key: 'delivery',
    label: '交付收口包',
    hint: '验收、文档、发布准备',
    tasks: [
      { title: '核对交付清单与遗漏项', priority: 'URGENT', days: 1 },
      { title: '补齐说明文档与演示材料', priority: 'HIGH', days: 2 },
      { title: '发起最终验收与反馈收集', priority: 'MEDIUM', days: 3 },
    ],
  },
] as const;

const activityDotClass = (type: string) => {
  if (type === 'TASK') return 'bg-amber-500';
  if (type === 'DISCUSSION') return 'bg-sky-500';
  if (type === 'APPLICATION' || type === 'INVITATION') return 'bg-purple-500';
  return 'bg-emerald-500';
};
</script>

<template>
  <div
    class="mobile-adaptive rounded-xl border p-3 sm:p-3.5 bg-card shadow-sm space-y-3.5"
    style="background-color: var(--bg-card); border-color: var(--border-base)"
  >
    <!-- Tab Navigation Header -->
    <div class="mobile-row border-b pb-1.5 flex" style="border-color: var(--border-base)">
      <Tabs
        v-model="activeSidebarTab"
        :options="sidebarTabs"
        size="sm"
        class="!bg-transparent border-none shrink-0"
      />
    </div>

    <!-- Tab Panels -->
    <div class="space-y-4 min-h-[300px]">
      <!-- Tab 1: Dispatch (快速派发 + 一键任务包) -->
      <div v-if="activeSidebarTab === 'dispatch'" class="space-y-4">
        <!-- 快速派发 Section -->
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-1.5">
              <Zap class="w-4 h-4 text-accent" />
              <h4 class="text-xs font-black" style="color: var(--text-primary)">快速派发</h4>
            </div>
            <button
              type="button"
              class="px-2 py-0.5 rounded bg-accent/10 text-[9px] font-black text-accent border-none cursor-pointer hover:bg-accent/20 transition-colors disabled:opacity-50"
              :disabled="!recommendedAssignee && !workloadRows.length"
              @click="emit('select-recommended')"
            >
              推荐负责人
            </button>
          </div>
          <p v-if="recommendedAssignee" class="text-[9px] font-bold text-slate-400 truncate">
            推荐 {{ recommendedAssigneeName }} · {{ recommendedAssignee.reason }}
          </p>

          <div class="space-y-2">
            <input
              v-model="quickTaskTitle"
              type="text"
              placeholder="新增任务标题 (回车快速创建)"
              class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-accent/15 transition-all"
              style="border-color: var(--border-base); color: var(--text-primary)"
              @keydown.enter="emit('create-task')"
            />
            <div class="grid grid-cols-2 gap-2">
              <el-select
                v-model="quickTaskProjectId"
                clearable
                placeholder="关联项目"
                class="!w-full"
              >
                <el-option
                  v-for="project in projects"
                  :key="project.id"
                  :label="project.title"
                  :value="project.id"
                />
              </el-select>
              <el-select
                v-model="quickTaskAssigneeId"
                clearable
                placeholder="指派负责人"
                class="!w-full"
              >
                <el-option
                  v-for="member in teamMembers"
                  :key="member.id"
                  :label="member.name || member.email"
                  :value="member.id"
                >
                  <div class="flex items-center gap-2">
                    <UserAvatar :user="member" size="xs" />
                    <span class="text-xs font-bold">{{ member.name || member.email }}</span>
                  </div>
                </el-option>
              </el-select>
            </div>
            <div class="grid grid-cols-[minmax(0,1fr)_84px] gap-2">
              <input
                v-model="quickTaskDueDate"
                type="date"
                class="min-w-0 px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-accent/15 transition-all cursor-pointer"
                style="border-color: var(--border-base); color: var(--text-primary)"
                @click="
                  (e) => {
                    const target = e.target as HTMLInputElement & { showPicker?: () => void };
                    target.showPicker?.();
                  }
                "
              />
              <button
                type="button"
                class="rounded-lg bg-slate-100 dark:bg-white/5 text-[9px] font-black text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10 border-none cursor-pointer transition-all"
                @click="quickTaskDueDate = ''"
              >
                清除截止
              </button>
            </div>
            <div class="flex items-center gap-1.5">
              <button
                v-for="option in priorityOptions"
                :key="option.value"
                type="button"
                class="flex-1 h-8 rounded-lg border-none cursor-pointer text-[10px] font-black flex items-center justify-center gap-1.5 hover:opacity-95 transition-all"
                :class="
                  quickTaskPriority === option.value
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                    : 'bg-slate-100 dark:bg-white/5 text-slate-500'
                "
                @click="quickTaskPriority = option.value"
              >
                <span class="w-1.5 h-1.5 rounded-full" :class="option.class"></span>
                {{ option.label }}
              </button>
            </div>
            <div class="grid grid-cols-2 gap-2 text-[9px] font-black">
              <div
                class="rounded-lg bg-slate-50 dark:bg-white/5 px-2 py-1.5 text-slate-500 truncate"
              >
                {{ selectedQuickProject ? selectedQuickProject.title : '独立任务' }}
              </div>
              <div
                class="rounded-lg bg-slate-50 dark:bg-white/5 px-2 py-1.5 text-slate-500 truncate"
              >
                {{
                  selectedQuickProjectStats
                    ? `项目已发: ${selectedQuickProjectStats.total}`
                    : `成员总数: ${teamMembers.length}`
                }}
              </div>
              <div
                class="col-span-2 rounded-lg bg-slate-50 dark:bg-white/5 px-2 py-1.5 text-slate-500 truncate"
              >
                {{
                  selectedAssigneeWorkload
                    ? `${selectedAssigneeWorkload.member.name || selectedAssigneeWorkload.member.email} · 进行中 ${selectedAssigneeWorkload.active} · 逾期 ${selectedAssigneeWorkload.overdue}`
                    : '选择负责人以评估负载'
                }}
              </div>
            </div>
            <button
              type="button"
              :disabled="isCreatingTask"
              class="w-full h-9 bg-accent text-white rounded-lg text-xs font-black border-none cursor-pointer hover:bg-accent-hover transition-colors disabled:opacity-60"
              @click="emit('create-task')"
            >
              {{ isCreatingTask ? '创建中...' : '加入团队看板' }}
            </button>
          </div>
        </div>

        <!-- 一键任务包 Section -->
        <div class="pt-3 border-t space-y-2" style="border-color: var(--border-base)">
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-black" style="color: var(--text-primary)"
              >一键任务模板包</span
            >
            <span class="text-[9px] font-bold text-slate-400">一键发布至关联项目</span>
          </div>
          <div class="space-y-1.5">
            <button
              v-for="template in quickSeedTemplates"
              :key="template.key"
              type="button"
              class="w-full p-2.5 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 hover:border-accent/30 hover:bg-accent/5 text-left cursor-pointer transition-all disabled:opacity-50"
              :disabled="isCreatingSeedTasks"
              @click="emit('create-seed-tasks', template)"
            >
              <div class="flex items-center justify-between gap-2">
                <span class="text-xs font-black" style="color: var(--text-primary)">{{
                  template.label
                }}</span>
                <span class="px-1.5 py-0.5 rounded bg-accent/10 text-[9px] font-black text-accent"
                  >{{ template.tasks.length }} 项任务</span
                >
              </div>
              <p class="mt-1 text-[9px] font-bold text-slate-400 truncate">
                {{ template.hint }}
              </p>
            </button>
          </div>
        </div>
      </div>

      <!-- Tab 2: Risk & Due (风险雷达 + 近期交付) -->
      <div v-if="activeSidebarTab === 'risk'" class="space-y-4">
        <!-- 风险雷达 Section -->
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-1.5">
              <Target class="w-4 h-4 text-rose-500" />
              <h4 class="text-xs font-black" style="color: var(--text-primary)">风险雷达</h4>
            </div>
            <button
              type="button"
              class="p-1 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 border-none cursor-pointer transition-colors"
              title="筛选需要关注的项目"
              @click="focusFilter = 'attention'"
            >
              <Zap class="w-3.5 h-3.5" />
            </button>
          </div>

          <div
            v-if="insightRiskProjects.length === 0"
            class="py-6 text-center text-[10px] font-bold text-slate-400 bg-slate-50/50 dark:bg-white/3 rounded-xl"
          >
            当前项目运营平稳，无预警风险
          </div>
          <div v-else class="space-y-2">
            <button
              v-for="project in insightRiskProjects.slice(0, 4)"
              :key="project.id"
              type="button"
              class="w-full text-left p-2.5 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 hover:border-accent/30 hover:bg-accent/5 transition-all cursor-pointer"
              @click="emit('click-project', project.id)"
            >
              <div class="flex items-center justify-between gap-3">
                <p class="text-xs font-black truncate" style="color: var(--text-primary)">
                  {{ project.title }}
                </p>
                <span
                  class="px-2 py-0.5 rounded-md text-[9px] font-black shrink-0"
                  :class="
                    project.riskLevel === 'HIGH'
                      ? 'bg-rose-500/10 text-rose-600'
                      : 'bg-amber-500/10 text-amber-600'
                  "
                >
                  {{ project.healthScore }} 分
                </span>
              </div>
              <div class="mt-2 grid grid-cols-3 gap-1 text-[9px] font-black text-slate-400">
                <span>逾期: {{ project.overdueTasks }}</span>
                <span>未分派: {{ project.unassignedTasks }}</span>
                <span>临期: {{ project.dueSoonTasks }}</span>
              </div>
              <p class="mt-1.5 text-[9px] font-bold text-slate-400 truncate">
                {{ project.reasons[0] }}
              </p>
            </button>
          </div>
        </div>

        <!-- 近期交付 Section -->
        <div class="pt-3 border-t space-y-3" style="border-color: var(--border-base)">
          <div class="flex items-center gap-1.5">
            <CalendarClock class="w-4 h-4 text-amber-500" />
            <h4 class="text-xs font-black" style="color: var(--text-primary)">近期交付任务</h4>
          </div>

          <div
            v-if="dueSoonTasks.length === 0 && overdueTasks.length === 0"
            class="py-6 text-center text-[10px] font-bold text-slate-400 bg-slate-50/50 dark:bg-white/3 rounded-xl"
          >
            近期无紧急截止的任务
          </div>
          <div v-else class="space-y-2">
            <button
              v-for="task in [...overdueTasks, ...dueSoonTasks].slice(0, 5)"
              :key="task.id"
              type="button"
              class="w-full flex items-center gap-2.5 p-2 rounded-lg bg-slate-50 dark:bg-white/5 hover:bg-accent/5 hover:scale-[1.01] transition-all text-left cursor-pointer border border-transparent hover:border-accent/10"
              @click="emit('navigate-board', task.projectId)"
            >
              <div
                class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                :class="
                  isTaskOverdue(task)
                    ? 'bg-rose-500/10 text-rose-500'
                    : 'bg-amber-500/10 text-amber-500'
                "
              >
                <AlertTriangle v-if="isTaskOverdue(task)" class="w-3.5 h-3.5" />
                <Clock3 v-else class="w-3.5 h-3.5" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-[11px] font-black truncate" style="color: var(--text-primary)">
                  {{ task.title }}
                </p>
                <p class="text-[9px] text-slate-400 font-bold truncate">
                  {{ task.project?.title || '独立任务' }} ·
                  {{ formatDate(task.dueDate) }}
                </p>
              </div>
              <ArrowRight class="w-3.5 h-3.5 text-slate-300 shrink-0" />
            </button>
          </div>
        </div>
      </div>

      <!-- Tab 3: Team & Logs (成员负载 + 协作动态) -->
      <div v-if="activeSidebarTab === 'team'" class="space-y-4">
        <!-- 成员负载 Section -->
        <div class="space-y-3">
          <div class="flex items-center gap-1.5">
            <Sparkles class="w-4 h-4 text-sky-500" />
            <h4 class="text-xs font-black" style="color: var(--text-primary)">团队成员负载评估</h4>
          </div>

          <div
            v-if="workloadRows.length === 0"
            class="py-6 text-center text-[10px] font-bold text-slate-400 bg-slate-50/50 dark:bg-white/3 rounded-xl"
          >
            暂无分配的团队成员
          </div>
          <div v-else class="space-y-3">
            <div v-for="row in workloadRows" :key="row.member.id" class="space-y-1">
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2 min-w-0">
                  <UserAvatar :user="row.member" size="xs" />
                  <span class="text-[11px] font-black truncate" style="color: var(--text-primary)">
                    {{ row.member.name || row.member.email }}
                  </span>
                </div>
                <span class="text-[9px] font-black text-slate-400 shrink-0">
                  进行中 {{ row.active }} · 逾期 {{ row.overdue }}
                </span>
              </div>
              <div class="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  class="h-full rounded-full transition-all duration-500"
                  :class="
                    row.overdue > 0 ? 'bg-rose-500' : row.active > 5 ? 'bg-amber-500' : 'bg-accent'
                  "
                  :style="{ width: Math.min(100, row.active * 16) + '%' }"
                ></div>
              </div>
            </div>
          </div>
        </div>

        <!-- 协作动态 Section -->
        <div class="pt-3 border-t space-y-3" style="border-color: var(--border-base)">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-1.5">
              <Activity class="w-4 h-4 text-sky-500" />
              <h4 class="text-xs font-black" style="color: var(--text-primary)">协作动态流</h4>
            </div>
            <span
              class="text-[9px] font-black text-slate-400 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/5"
            >
              {{ activityItems.length }} 条更新
            </span>
          </div>

          <div
            v-if="activityItems.length === 0"
            class="py-6 text-center text-[10px] font-bold text-slate-400 bg-slate-50/50 dark:bg-white/3 rounded-xl"
          >
            暂无新的项目协作动态
          </div>
          <div v-else class="space-y-2.5">
            <button
              v-for="item in activityItems.slice(0, 6)"
              :key="item.id"
              type="button"
              class="activity-grid w-full grid grid-cols-[8px_minmax(0,1fr)_auto] items-center gap-2.5 bg-transparent border-none p-1 text-left cursor-pointer hover:bg-slate-100/50 dark:hover:bg-white/3 rounded transition-colors"
              @click="emit('navigate-insight', item.targetRoute)"
            >
              <span
                class="w-2 h-2 rounded-full shrink-0"
                :class="activityDotClass(item.type)"
              ></span>
              <span class="min-w-0">
                <span
                  class="block text-[11px] font-black truncate"
                  style="color: var(--text-primary)"
                  >{{ item.title }}</span
                >
                <span class="block text-[9px] font-bold text-slate-400 truncate mt-0.5">{{
                  item.description
                }}</span>
              </span>
              <span class="text-[9px] font-black text-slate-400 shrink-0">{{
                formatRelativeTime(item.createdAt)
              }}</span>
            </button>
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

@media (max-width: 767px) {
  .activity-grid {
    grid-template-columns: 8px minmax(0, 1fr) auto !important;
  }
}
</style>
