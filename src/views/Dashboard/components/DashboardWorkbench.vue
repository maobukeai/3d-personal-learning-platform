<script setup lang="ts">
import { computed } from 'vue';
import { TaskStatus } from '@/types';
import type {
  WorkbenchData,
  DashboardStatsResponse,
  DashboardEnrollment,
  DashboardTask,
  DashboardAsset,
  ProjectSummary,
  WorkbenchFocusProject,
} from '../types';

import DashboardMetricStrip from './DashboardMetricStrip.vue';
import DashboardTasksPanel from './DashboardTasksPanel.vue';
import DashboardProjectsPanel from './DashboardProjectsPanel.vue';
import DashboardOpsWorkbench from './DashboardOpsWorkbench.vue';
import DashboardFocusCenter from './DashboardFocusCenter.vue';
import DashboardAssetsPanel from './DashboardAssetsPanel.vue';

const props = defineProps<{
  workbench: WorkbenchData | null;
  stats: DashboardStatsResponse | null;
  activeEnrollment: DashboardEnrollment | null;
  recentTasks: DashboardTask[];
  recentAssets: DashboardAsset[];
  recentProjects: ProjectSummary[];
  isLoading: boolean;
  workbenchError: string;
  completingTaskIds: Set<string>;
}>();

const emit = defineEmits<{
  (e: 'navigate', route: string | undefined): void;
  (e: 'complete-task', task: DashboardTask): void;
  (e: 'open-import-dialog', mode: 'ai_assistant' | 'traditional'): void;
}>();

const taskSummary = computed(() => {
  if (props.workbench) return props.workbench.work;
  const total = props.recentTasks.length;
  const done = props.recentTasks.filter((task) => task.status === TaskStatus.DONE).length;
  return {
    total,
    todo: props.recentTasks.filter((task) => task.status === TaskStatus.TODO).length,
    inProgress: props.recentTasks.filter((task) => task.status === TaskStatus.IN_PROGRESS).length,
    done,
    overdue: props.recentTasks.filter(isOverdue).length,
    dueToday: props.recentTasks.filter(isDueToday).length,
    urgent: props.recentTasks.filter((task) => ['HIGH', 'URGENT'].includes(task.priority || ''))
      .length,
    assignedToMe: props.recentTasks.filter((task) => task.status !== TaskStatus.DONE).length,
    completionRate: total ? Math.round((done / total) * 100) : 0,
    recentDone: done,
  };
});

const contentSummary = computed(() => {
  if (props.workbench) return props.workbench.content;
  return {
    total: props.recentAssets.length,
    assets: props.recentAssets.length,
    approvedAssets: props.recentAssets.length,
    pendingAssets: 0,
    rejectedAssets: 0,
    missingThumbAssets: props.recentAssets.filter((asset) => !asset.thumbnail).length,
    materials: 0,
    showcases: 0,
    plugins: 0,
    notes: 0,
    publicNotes: 0,
    typeDistribution: [],
    recentAssets: [],
  };
});

const learningProgress = computed(() => {
  if (props.workbench) return props.workbench.command.learningProgress;
  const parsed = Number.parseInt(props.stats?.learningProgress || '0', 10);
  return Number.isFinite(parsed) ? parsed : 0;
});

const momentumScore = computed(
  () => props.workbench?.command.momentumScore ?? calculateFallbackMomentum(),
);

const commandHeadline = computed(() => {
  if (props.workbenchError) return props.workbenchError;
  if (!props.workbench) return '正在汇总学习、项目、内容与协作信号';
  if (taskSummary.value.overdue > 0) return '先处理逾期任务，恢复项目节奏';
  if (momentumScore.value >= 80) return '整体节奏很稳，可以加速产出作品';
  if (momentumScore.value >= 55) return '节奏正常，适合推进关键任务';
  return '建议先建立一个清晰的今日推进目标';
});

const projectHealth = computed<WorkbenchFocusProject[]>(() => {
  if (props.workbench?.projects.focus.length) return props.workbench.projects.focus.slice(0, 4);
  return props.recentProjects.slice(0, 4).map((project) => ({
    id: project.id,
    title: project.title,
    progress: project.progress,
    status: project.status,
    color: project.color,
    dueDate: project.dueDate,
    updatedAt: project.updatedAt,
    memberCount: project.memberCount,
    taskCount: 0,
    doneTaskCount: 0,
    overdueTaskCount: isProjectAtRisk(project) ? 1 : 0,
    urgentTaskCount: 0,
    dueSoon: false,
    roadmapStepCount: 0,
    healthScore: project.status === 'COMPLETED' ? 100 : Math.max(25, project.progress),
  }));
});

const visibleTasks = computed(() => props.recentTasks.slice(0, 6));
const visibleAssets = computed(() => props.recentAssets.slice(0, 6));

function calculateFallbackMomentum() {
  const assetWeight = Math.min(contentSummary.value.assets * 8, 24);
  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        learningProgress.value * 0.35 +
          taskSummary.value.completionRate * 0.45 +
          assetWeight -
          taskSummary.value.overdue * 10,
      ),
    ),
  );
}

function isOverdue(task: DashboardTask) {
  if (!task.dueDate || task.status === TaskStatus.DONE) return false;
  const due = new Date(task.dueDate);
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due.getTime() < today.getTime();
}

function isDueToday(task: DashboardTask) {
  if (!task.dueDate || task.status === TaskStatus.DONE) return false;
  const due = new Date(task.dueDate);
  const today = new Date();
  return (
    due.getFullYear() === today.getFullYear() &&
    due.getMonth() === today.getMonth() &&
    due.getDate() === today.getDate()
  );
}

function isProjectAtRisk(project: ProjectSummary) {
  if (!project.dueDate || project.status === 'COMPLETED') return false;
  return new Date(project.dueDate).getTime() < Date.now() && project.progress < 100;
}
</script>

<template>
  <div class="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-4 items-start">
    <!-- Main Column -->
    <div class="flex flex-col gap-4 min-w-0">
      <slot name="main-top"></slot>

      <!-- Core Metric Strip -->
      <DashboardMetricStrip
        :workbench="workbench"
        :stats="stats"
        :active-enrollment="activeEnrollment"
        :learning-progress="learningProgress"
        :task-summary="taskSummary"
        :content-summary="contentSummary"
        @navigate="emit('navigate', $event)"
      />

      <!-- Core Work Grid (Tasks & Projects) -->
      <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] gap-4">
        <DashboardTasksPanel
          :visible-tasks="visibleTasks"
          :task-summary="taskSummary"
          :completing-task-ids="completingTaskIds"
          @navigate="emit('navigate', $event)"
          @complete-task="emit('complete-task', $event)"
        />

        <DashboardProjectsPanel
          :project-health="projectHealth"
          @navigate="emit('navigate', $event)"
        />
      </div>

      <!-- Operations Workbench -->
      <DashboardOpsWorkbench
        :workbench="workbench"
        :is-loading="isLoading"
        :workbench-error="workbenchError"
        :command-headline="commandHeadline"
        :momentum-score="momentumScore"
        :task-summary="taskSummary"
        :content-summary="contentSummary"
        @navigate="emit('navigate', $event)"
      />
    </div>

    <!-- Sidebar Column -->
    <aside class="flex flex-col gap-4 min-w-0">
      <!-- Focus Center Widget -->
      <DashboardFocusCenter
        :active-enrollment="activeEnrollment"
        :momentum-score="momentumScore"
        :task-summary="taskSummary"
        :content-summary="contentSummary"
        :project-count="projectHealth.length"
        @navigate="emit('navigate', $event)"
        @open-import-dialog="emit('open-import-dialog', $event)"
      />

      <slot name="sidebar-middle"></slot>

      <!-- Works Assets Showcase -->
      <DashboardAssetsPanel
        :visible-assets="visibleAssets"
        :content-summary="contentSummary"
        @navigate="emit('navigate', $event)"
      />

      <slot name="sidebar-bottom"></slot>
    </aside>
  </div>
</template>
