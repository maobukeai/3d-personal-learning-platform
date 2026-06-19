<script setup lang="ts">
import { computed } from 'vue';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpen,
  Box,
  Brain,
  CheckCircle2,
  CheckSquare,
  Circle,
  Clock,
  FolderOpen,
  Gauge,
  Image as ImageIcon,
  Inbox,
  Layers,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Star,
  Upload,
} from 'lucide-vue-next';
import { getAssetUrl } from '@/utils/api';
import { formatCompactNumber as formatNumber, formatDate } from '@/utils/format';
import Card from '@/components/ui/Card.vue';
import Badge from '@/components/ui/Badge.vue';
import Button from '@/components/ui/Button.vue';
import { TaskStatus } from '@/types';
import type {
  WorkbenchData,
  DashboardStatsResponse,
  DashboardEnrollment,
  DashboardTask,
  DashboardAsset,
  ProjectSummary,
  MetricTile,
  QuickAction,
  WorkbenchFocusProject,
} from '../types';

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

const metricTiles = computed<MetricTile[]>(() => [
  {
    id: 'learning',
    label: '学习推进',
    value: `${learningProgress.value}%`,
    detail: props.activeEnrollment
      ? props.activeEnrollment.course.title
      : `${props.workbench?.learning.enrollmentCount ?? 0} 门课程`,
    trend: props.stats?.trends?.learning,
    icon: BookOpen,
    route: props.activeEnrollment
      ? `/academy/player/${props.activeEnrollment.courseId}`
      : '/academy',
    tone: 'metric-blue',
  },
  {
    id: 'tasks',
    label: '任务负载',
    value: taskSummary.value.todo + taskSummary.value.inProgress,
    detail:
      taskSummary.value.overdue > 0
        ? `${taskSummary.value.overdue} 逾期`
        : `${taskSummary.value.completionRate}% 完成率`,
    trend: props.workbench?.command.productivityTrend ?? props.stats?.trends?.tasks,
    icon: CheckSquare,
    route: '/work',
    tone: taskSummary.value.overdue > 0 ? 'metric-red' : 'metric-amber',
  },
  {
    id: 'content',
    label: '内容资产',
    value: contentSummary.value.total,
    detail: `${contentSummary.value.approvedAssets} 通过 / ${contentSummary.value.pendingAssets} 审核`,
    trend: props.stats?.trends?.assets,
    icon: Box,
    route: '/assets',
    tone: 'metric-green',
  },
  {
    id: 'community',
    label: '社区积分',
    value: formatNumber(props.workbench?.profile?.points ?? props.stats?.points ?? 0),
    detail: props.workbench
      ? `${props.workbench.collaboration.unreadMessages} 私信未读`
      : '等待排行',
    trend: props.stats?.trends?.points,
    icon: Star,
    route: '/showcase',
    tone: 'metric-cyan',
  },
]);

const opsMetrics = computed(() => [
  {
    label: '动量分',
    value: momentumScore.value,
    detail: props.workbench?.command.productivityTrend || '0',
    icon: Gauge,
    tone: 'ops-blue',
  },
  {
    label: '任务闭环',
    value: `${taskSummary.value.completionRate}%`,
    detail: `${taskSummary.value.done}/${taskSummary.value.total}`,
    icon: CheckCircle2,
    tone: taskSummary.value.overdue > 0 ? 'ops-red' : 'ops-green',
  },
  {
    label: '内容通过',
    value: `${props.workbench?.command.contentApprovalRate ?? 100}%`,
    detail: `${contentSummary.value.pendingAssets} 审核中`,
    icon: ShieldCheck,
    tone: 'ops-amber',
  },
  {
    label: '协作负载',
    value: props.workbench?.command.collaborationLoad ?? 0,
    detail: `${props.workbench?.collaboration.unreadMessages ?? 0} 私信`,
    icon: Inbox,
    tone: 'ops-purple',
  },
]);

const trendMax = computed(() =>
  Math.max(1, ...(props.workbench?.trend.map((item) => item.total) || [])),
);

const trendBars = computed(() =>
  (props.workbench?.trend || []).map((item) => ({
    ...item,
    height: Math.max(10, Math.round((item.total / trendMax.value) * 100)),
    label: new Date(item.date).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }),
  })),
);

const contentPipeline = computed(() => [
  { label: '资产', value: contentSummary.value.assets, route: '/assets', tone: 'pipe-blue' },
  { label: '材质', value: contentSummary.value.materials, route: '/materials', tone: 'pipe-green' },
  { label: '作品', value: contentSummary.value.showcases, route: '/showcase', tone: 'pipe-amber' },
  { label: '插件', value: contentSummary.value.plugins, route: '/plugins', tone: 'pipe-purple' },
  { label: '笔记', value: contentSummary.value.notes, route: '/notes', tone: 'pipe-slate' },
]);

const focusQueue = computed(() => props.workbench?.focusQueue.slice(0, 4) || []);
const smartActions = computed(() => props.workbench?.smartActions.slice(0, 4) || []);

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

const quickActions = computed<QuickAction[]>(() => [
  {
    id: 'course',
    label: props.activeEnrollment ? '继续学习' : '探索课程',
    hint: props.activeEnrollment ? `${props.activeEnrollment.progress}%` : '学院',
    icon: BookOpen,
    route: props.activeEnrollment
      ? `/academy/player/${props.activeEnrollment.courseId}`
      : '/academy',
    tone: 'qa-blue',
  },
  {
    id: 'work',
    label: '任务看板',
    hint: `${taskSummary.value.todo + taskSummary.value.inProgress} 个`,
    icon: CheckSquare,
    route: '/work',
    tone: 'qa-amber',
  },
  {
    id: 'assets',
    label: '上传作品',
    hint: `${contentSummary.value.assets} 件`,
    icon: Upload,
    route: '/my-works',
    tone: 'qa-green',
  },
  {
    id: 'projects',
    label: '项目空间',
    hint: `${projectHealth.value.length} 个`,
    icon: FolderOpen,
    route: '/projects',
    tone: 'qa-indigo',
  },
  {
    id: 'community',
    label: '社区讨论',
    hint: '交流',
    icon: MessageSquare,
    route: '/discussions',
    tone: 'qa-pink',
  },
  {
    id: 'ai-plan',
    label: 'AI 规划',
    hint: '生成',
    icon: Brain,
    mode: 'ai_assistant',
    tone: 'qa-orange',
  },
]);

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

function getTaskStatusClass(status: string) {
  if (status === TaskStatus.DONE) return 'status-green';
  if (status === TaskStatus.IN_PROGRESS) return 'status-blue';
  return 'status-muted';
}

function getPriorityLabel(priority?: string) {
  if (priority === 'URGENT') return '紧急';
  if (priority === 'HIGH') return '高';
  if (priority === 'LOW') return '低';
  return '中';
}

function getTrendClass(trend?: string) {
  if (!trend || trend === '0' || trend === '0%') return 'trend-neutral';
  return trend.startsWith('-') ? 'trend-down' : 'trend-up';
}

function getSeverityClass(severity: string) {
  if (severity === 'danger') return 'risk-danger';
  if (severity === 'warning') return 'risk-warning';
  if (severity === 'notice') return 'risk-notice';
  return 'risk-info';
}

function getHealthClass(score: number) {
  if (score >= 78) return 'health-good';
  if (score >= 48) return 'health-watch';
  return 'health-risk';
}

function isCompletingTask(taskId: string) {
  return props.completingTaskIds.has(taskId);
}

function openQuickAction(action: QuickAction) {
  if (action.mode) {
    emit('open-import-dialog', action.mode);
    return;
  }
  emit('navigate', action.route);
}
</script>

<template>
  <div class="dashboard-grid-layout">
    <!-- Main Column -->
    <div class="layout-main-col">
      <slot name="main-top"></slot>

      <!-- Core Metric Strip -->
      <section class="metric-strip" aria-label="核心指标">
        <Card
          v-for="metric in metricTiles"
          :key="metric.id"
          clickable
          hoverable
          glow
          glass
          class="metric-tile flex-row items-center !p-3 sm:!p-4"
          :class="metric.tone"
          padding="none"
          @click="emit('navigate', metric.route)"
        >
          <div class="flex items-center justify-between w-full h-full min-w-0 gap-3">
            <div class="flex items-center gap-3 min-w-0">
              <span class="metric-icon flex items-center justify-center rounded-lg w-9 h-9"
                ><component :is="metric.icon" class="h-4.5 w-4.5"
              /></span>
              <span class="metric-copy flex flex-col">
                <span class="metric-label text-[10px] font-bold uppercase tracking-wider">{{
                  metric.label
                }}</span>
                <span class="metric-value text-xl font-extrabold leading-none my-0.5">{{
                  metric.value
                }}</span>
                <span class="metric-detail text-[10px] truncate opacity-80">{{
                  metric.detail
                }}</span>
              </span>
            </div>
            <Badge
              v-if="metric.trend"
              :variant="
                getTrendClass(metric.trend) === 'trend-up'
                  ? 'success'
                  : getTrendClass(metric.trend) === 'trend-down'
                    ? 'danger'
                    : 'primary'
              "
              outline
              class="shrink-0 scale-90"
            >
              {{ metric.trend }}
            </Badge>
          </div>
        </Card>
      </section>

      <!-- Core Work Grid (Tasks & Projects) -->
      <div class="work-grid">
        <Card hoverable glow glass class="tasks-panel" padding="none">
          <div class="dashboard-panel-header">
            <div>
              <h3>任务推进</h3>
              <p>
                {{ taskSummary.inProgress }} 进行中 · {{ taskSummary.overdue }} 逾期 ·
                {{ taskSummary.completionRate }}% 完成率
              </p>
            </div>
            <Button
              variant="link"
              size="sm"
              :icon="ArrowRight"
              icon-position="right"
              @click="emit('navigate', '/work')"
            >
              全部
            </Button>
          </div>
          <div class="flex flex-col min-h-0 flex-1">
            <div v-if="visibleTasks.length" class="dashboard-panel-list flex-1">
              <div
                v-for="task in visibleTasks"
                :key="task.id"
                class="task-row"
                :class="[
                  task.priority === 'URGENT' || task.priority === 'HIGH'
                    ? 'border-l-[3px] border-l-red-500'
                    : task.priority === 'LOW'
                      ? 'border-l-[3px] border-l-slate-400'
                      : 'border-l-[3px] border-l-accent',
                ]"
                role="button"
                tabindex="0"
                @click="emit('navigate', '/work')"
                @keydown.enter="emit('navigate', '/work')"
                @keydown.space.prevent="emit('navigate', '/work')"
              >
                <span class="task-state" :class="getTaskStatusClass(task.status)">
                  <component
                    :is="
                      task.status === 'DONE'
                        ? CheckCircle2
                        : task.status === 'IN_PROGRESS'
                          ? Clock
                          : Circle
                    "
                    class="h-4.5 w-4.5"
                  />
                </span>
                <span class="task-main">
                  <strong class="text-sm font-bold text-slate-800 dark:text-slate-100">{{
                    task.title
                  }}</strong>
                  <small class="text-xs text-slate-400 font-medium">
                    {{ task.project?.title || '工作区任务' }} ·
                    {{ task.dueDate ? formatDate(task.dueDate) : '无截止' }}
                    <b v-if="isOverdue(task)" class="text-red-500 font-bold ml-1">逾期</b>
                  </small>
                </span>
                <Badge
                  :variant="
                    task.priority === 'URGENT' || task.priority === 'HIGH'
                      ? 'danger'
                      : task.priority === 'LOW'
                        ? 'info'
                        : 'warning'
                  "
                  outline
                  class="scale-90 shrink-0"
                >
                  {{ getPriorityLabel(task.priority) }}
                </Badge>
                <Button
                  variant="secondary"
                  size="sm"
                  class="complete-command !w-7 !h-7 !p-0 shrink-0 ml-1 hover:bg-emerald-500/10 hover:text-emerald-500 hover:border-emerald-500/20"
                  :disabled="task.status === 'DONE'"
                  :loading="isCompletingTask(task.id)"
                  @click.stop="emit('complete-task', task)"
                >
                  <CheckCircle2 class="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div v-else class="dashboard-panel-empty">
              <CheckSquare class="h-8 w-8 opacity-40 mb-1" />
              <strong>暂无待办任务</strong>
            </div>
          </div>
        </Card>

        <Card hoverable glow glass class="projects-panel" padding="none">
          <div class="dashboard-panel-header">
            <div>
              <h3>项目健康雷达</h3>
              <p>{{ projectHealth.length }} 个重点项目</p>
            </div>
            <Button
              variant="link"
              size="sm"
              :icon="ArrowRight"
              icon-position="right"
              @click="emit('navigate', '/projects')"
            >
              全部
            </Button>
          </div>
          <div class="flex flex-col min-h-0 flex-1">
            <div v-if="projectHealth.length" class="dashboard-panel-list flex-1">
              <button
                v-for="project in projectHealth"
                :key="project.id"
                type="button"
                class="project-row"
                :class="getHealthClass(project.healthScore)"
                @click="emit('navigate', `/project/${project.id}`)"
              >
                <span
                  class="project-avatar shrink-0 font-bold text-xs uppercase"
                  :class="project.color || 'bg-accent'"
                  >{{ project.title.charAt(0) }}</span
                >
                <span class="project-body">
                  <span class="project-title">
                    <strong class="text-sm font-bold text-slate-800 dark:text-slate-100">{{
                      project.title
                    }}</strong>
                    <small class="text-xs text-slate-400 font-medium"
                      >{{ project.memberCount }} 人</small
                    >
                  </span>
                  <span class="progress-line">
                    <i :style="{ width: `${project.healthScore}%` }"></i>
                  </span>
                </span>
                <span class="project-progress text-xs font-bold">{{ project.healthScore }}</span>
              </button>
            </div>
            <div v-else class="dashboard-panel-empty">
              <Layers class="h-8 w-8 opacity-40 mb-1" />
              <strong>暂无活跃项目</strong>
            </div>
          </div>
        </Card>
      </div>

      <!-- Operations Workbench -->
      <Card hoverable glow glass class="ops-workbench shadow-md" padding="none">
        <div class="dashboard-panel-header">
          <div>
            <h3>全局运营工作台</h3>
            <p>{{ commandHeadline }}</p>
          </div>
          <Gauge class="h-4.5 w-4.5 text-accent opacity-70" />
        </div>

        <div class="ops-workbench-grid">
          <!-- Column 1: Summary -->
          <div class="ops-summary">
            <div class="ops-metrics">
              <div
                v-for="metric in opsMetrics"
                :key="metric.label"
                class="ops-metric border border-base"
                :class="metric.tone"
              >
                <component :is="metric.icon" class="h-4 w-4" />
                <span>
                  <strong>{{ metric.value }}</strong>
                  <small>{{ metric.label }} · {{ metric.detail }}</small>
                </span>
              </div>
            </div>
          </div>

          <!-- Column 2: 14 Day Chart -->
          <div class="ops-chart">
            <div class="panel-line">
              <span><BarChart3 class="h-3.5 w-3.5" />14 天活跃曲线</span>
              <small>学习 / 任务 / 内容 / 社区</small>
            </div>
            <div v-if="trendBars.length" class="ops-bars">
              <span
                v-for="bar in trendBars"
                :key="bar.date"
                class="ops-bar"
                :title="`${bar.label}: ${bar.total}`"
              >
                <i :style="{ height: `${bar.height}%` }">
                  <b class="bar-learning" :style="{ flex: bar.learning || 0.15 }"></b>
                  <b class="bar-tasks" :style="{ flex: bar.tasks || 0.15 }"></b>
                  <b class="bar-content" :style="{ flex: bar.content || 0.15 }"></b>
                  <b class="bar-community" :style="{ flex: bar.community || 0.15 }"></b>
                </i>
                <em>{{ bar.label }}</em>
              </span>
            </div>
            <div v-else class="empty-line text-xs font-semibold text-slate-400">
              {{ isLoading ? '正在生成趋势...' : workbenchError || '暂无趋势数据' }}
            </div>
          </div>

          <!-- Column 3: Pipeline -->
          <div class="ops-pipeline">
            <div class="panel-line">
              <span><Box class="h-3.5 w-3.5" />内容生产线</span>
              <small>{{ workbench?.signals.tagCoverage ?? 0 }} 标签覆盖</small>
            </div>
            <div class="pipe-grid">
              <button
                v-for="pipe in contentPipeline"
                :key="pipe.label"
                type="button"
                class="pipe-chip border border-base bg-card hover:border-accent/30 rounded-lg transition-all duration-200"
                :class="pipe.tone"
                @click="emit('navigate', pipe.route)"
              >
                <strong>{{ pipe.value }}</strong>
                <small>{{ pipe.label }}</small>
              </button>
            </div>
          </div>

          <!-- Column 4: Risks -->
          <div class="ops-risks">
            <div class="panel-line">
              <span><AlertTriangle class="h-3.5 w-3.5" />风险与建议</span>
              <small>{{ focusQueue.length }} 风险</small>
            </div>
            <button
              v-for="item in focusQueue"
              :key="item.id"
              type="button"
              class="risk-row hover:border-red-500/30 hover:bg-red-500/5 transition-all duration-200"
              :class="getSeverityClass(item.severity)"
              @click="emit('navigate', item.route)"
            >
              <strong>{{ item.metric }}</strong>
              <span>
                <b>{{ item.title }}</b>
                <small>{{ item.detail }}</small>
              </span>
            </button>
            <button
              v-for="action in smartActions"
              :key="action.id"
              type="button"
              class="smart-row hover:border-amber-500/30 hover:bg-amber-500/5 transition-all duration-200"
              @click="emit('navigate', action.route)"
            >
              <Sparkles class="h-3.5 w-3.5" />
              <span>
                <b>{{ action.title }}</b>
                <small>{{ action.impact }}</small>
              </span>
              <ArrowRight class="h-3.5 w-3.5 ml-auto text-amber-500/60" />
            </button>
            <div
              v-if="!focusQueue.length && !smartActions.length"
              class="safe-line border border-dashed border-base"
            >
              <ShieldCheck class="h-4 w-4 text-emerald-500 mr-1" />
              <span class="text-xs font-semibold text-slate-400">系统运行良好，暂无风险</span>
            </div>
          </div>
        </div>
      </Card>
    </div>

    <!-- Sidebar Column -->
    <aside class="layout-sidebar-col">
      <!-- Focus Center Widget -->
      <Card hoverable glow glass class="command-card shadow-md border-base/80" padding="md">
        <div class="section-heading">
          <div>
            <p class="eyebrow text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Today
            </p>
            <h2 class="text-base font-extrabold text-slate-800 dark:text-slate-100">推进中心</h2>
          </div>
          <div class="focus-score shrink-0" :class="{ warning: taskSummary.overdue > 0 }">
            <strong>{{ momentumScore }}</strong>
            <small>Focus</small>
          </div>
        </div>

        <div class="quick-grid">
          <button
            v-for="action in quickActions"
            :key="action.id"
            type="button"
            class="quick-action group hover:border-accent/30 transition-all duration-300"
            :class="action.tone"
            @click="openQuickAction(action)"
          >
            <span class="quick-icon"><component :is="action.icon" class="h-4.5 w-4.5" /></span>
            <span>
              <strong class="group-hover:text-accent transition-colors">{{ action.label }}</strong>
              <small>{{ action.hint }}</small>
            </span>
          </button>
        </div>

        <div class="task-kpis border-t border-base pt-3 mt-3">
          <span class="border border-base bg-card flex flex-col items-center p-2 rounded-xl">
            <strong
              class="text-lg font-black text-slate-800 dark:text-slate-100 leading-none mb-1"
              >{{ taskSummary.dueToday }}</strong
            >
            <small class="text-[10px] font-bold text-slate-400">今日到期</small>
          </span>
          <span class="border border-base bg-card flex flex-col items-center p-2 rounded-xl">
            <strong class="text-lg font-black text-red-500 leading-none mb-1">{{
              taskSummary.urgent
            }}</strong>
            <small class="text-[10px] font-bold text-slate-400">高优先级</small>
          </span>
          <span class="border border-base bg-card flex flex-col items-center p-2 rounded-xl">
            <strong
              class="text-lg font-black text-slate-800 dark:text-slate-100 leading-none mb-1"
              >{{ taskSummary.assignedToMe }}</strong
            >
            <small class="text-[10px] font-bold text-slate-400">我的负载</small>
          </span>
        </div>
      </Card>

      <slot name="sidebar-middle"></slot>

      <!-- Works Assets Showcase -->
      <Card hoverable glow glass class="assets-panel" padding="none">
        <div class="dashboard-panel-header">
          <div>
            <h3>作品资产</h3>
            <p>
              {{ contentSummary.approvedAssets }} 已通过 · {{ contentSummary.pendingAssets }} 审核中
            </p>
          </div>
          <Button
            variant="link"
            size="sm"
            :icon="ArrowRight"
            icon-position="right"
            @click="emit('navigate', '/my-works')"
          >
            管理
          </Button>
        </div>
        <div v-if="visibleAssets.length" class="asset-grid">
          <button
            v-for="asset in visibleAssets"
            :key="asset.id"
            type="button"
            class="asset-item group relative overflow-hidden rounded-xl border border-base bg-card transition-all duration-300"
            @click="emit('navigate', `/assets/${asset.id}`)"
          >
            <span class="asset-thumb">
              <img
                v-if="asset.thumbnail"
                :src="getAssetUrl(asset.thumbnail)"
                :alt="asset.title"
                class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <ImageIcon v-else class="h-6 w-6 text-slate-400" />
            </span>
            <span
              class="asset-meta bg-slate-950/80 backdrop-blur-md border-t border-white/10 p-2 flex flex-col justify-end"
            >
              <strong class="text-[10px] text-white font-bold truncate">{{ asset.title }}</strong>
              <small class="text-[8px] text-white/75 font-semibold truncate">{{
                asset.type || '3D 作品'
              }}</small>
            </span>
          </button>
        </div>
        <div v-else class="dashboard-panel-empty">
          <Upload class="h-8 w-8 opacity-40 mb-1" />
          <strong>还没有上传作品</strong>
        </div>
      </Card>

      <slot name="sidebar-bottom"></slot>
    </aside>
  </div>
</template>

<style scoped>
.dashboard-grid-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 16px;
  align-items: start;
}

.layout-main-col,
.layout-sidebar-col {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.metric-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.metric-tile {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 72px;
  border: 1px solid var(--border-base);
  background: var(--bg-card);
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.metric-icon {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
}

.metric-blue .metric-icon {
  background: rgba(37, 99, 235, 0.08);
  color: #2563eb;
}
.metric-amber .metric-icon {
  background: rgba(217, 119, 6, 0.1);
  color: #d97706;
}
.metric-red .metric-icon {
  background: rgba(220, 38, 38, 0.1);
  color: #dc2626;
}
.metric-green .metric-icon {
  background: rgba(5, 150, 105, 0.1);
  color: #059669;
}
.metric-cyan .metric-icon {
  background: rgba(8, 145, 178, 0.1);
  color: #0891b2;
}

.metric-copy {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.metric-label {
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.metric-detail {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 500;
}

.work-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
  gap: 16px;
}

.tasks-panel,
.projects-panel,
.assets-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.task-row,
.project-row {
  display: flex;
  align-items: center;
  gap: 12px;
  border: 1px solid var(--border-base);
  background: var(--bg-card);
  padding: 10px 12px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  text-align: left;
  width: 100%;
}

.task-row:hover {
  transform: translateX(4px);
  border-color: color-mix(in srgb, var(--accent) 30%, var(--border-base));
  box-shadow: var(--shadow-card);
}

.project-row:hover {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--accent) 30%, var(--border-base));
  box-shadow: var(--shadow-card);
}

.task-state,
.project-avatar {
  display: inline-flex;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: var(--bg-subtle);
  border: 1px solid var(--border-base);
}

.status-green {
  color: #059669;
}
.status-blue {
  color: #2563eb;
}
.status-muted {
  color: var(--text-muted);
}

.task-main,
.project-body {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
  gap: 2px;
}

.project-avatar {
  color: #fff;
  background: linear-gradient(135deg, var(--accent) 0%, #059669 100%);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.project-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.progress-line {
  height: 5px;
  overflow: hidden;
  border-radius: 99px;
  background: var(--bg-subtle);
  width: 100%;
  margin-top: 4px;
}

.progress-line i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #2563eb, #059669);
}

.project-progress {
  color: var(--text-primary);
  font-weight: 700;
  min-width: 24px;
  text-align: right;
}

.ops-workbench-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  padding: 16px;
}

.ops-summary,
.ops-chart,
.ops-pipeline,
.ops-risks {
  min-width: 0;
  border: 1px solid var(--border-base);
  border-radius: 12px;
  background: color-mix(in srgb, var(--bg-subtle) 40%, var(--bg-card) 60%);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ops-metrics {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

.ops-metric {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 52px;
  border-radius: 10px;
  padding: 10px;
}

.ops-metric span {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 2px;
}

.ops-metric strong {
  font-size: 16px;
  font-weight: 800;
  color: var(--text-primary);
  line-height: 1.1;
}

.ops-metric small {
  font-size: 10px;
  font-weight: 500;
  color: var(--text-muted);
}

.ops-blue {
  background: rgba(37, 99, 235, 0.05);
  color: #2563eb;
}
.ops-green {
  background: rgba(5, 150, 105, 0.05);
  color: #059669;
}
.ops-red {
  background: rgba(220, 38, 38, 0.05);
  color: #dc2626;
}
.ops-amber {
  background: rgba(217, 119, 6, 0.06);
  color: #d97706;
}
.ops-purple {
  background: rgba(124, 58, 237, 0.05);
  color: #7c3aed;
}

.panel-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.panel-line span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 800;
  color: var(--text-primary);
}

.panel-line small {
  font-size: 10px;
  font-weight: 500;
  color: var(--text-muted);
}

.ops-bars {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 4px;
  height: 120px;
  padding-top: 8px;
}

.ops-bar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.ops-bar i {
  width: 8px;
  height: 100%;
  display: flex;
  flex-direction: column-reverse;
  border-radius: 4px;
  background: var(--bg-hover);
  overflow: hidden;
}

.ops-bar b {
  display: block;
  min-height: 2px;
}

.bar-learning {
  background: #2563eb;
}
.bar-tasks {
  background: #d97706;
}
.bar-content {
  background: #059669;
}
.bar-community {
  background: #db2777;
}

.ops-bar em {
  font-size: 8px;
  font-style: normal;
  font-weight: 600;
  color: var(--text-muted);
  text-align: center;
}

.pipe-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.pipe-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 52px;
  padding: 8px 4px;
  text-align: center;
}

.pipe-chip strong {
  font-size: 16px;
  font-weight: 800;
  color: var(--text-primary);
}

.pipe-chip small {
  font-size: 10px;
  font-weight: 500;
  color: var(--text-muted);
}

.pipe-blue {
  background: rgba(37, 99, 235, 0.05);
}
.pipe-green {
  background: rgba(5, 150, 105, 0.05);
}
.pipe-amber {
  background: rgba(217, 119, 6, 0.06);
}
.pipe-purple {
  background: rgba(124, 58, 237, 0.05);
}
.pipe-slate {
  background: rgba(100, 116, 139, 0.05);
}

.ops-risks {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.risk-row,
.smart-row {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid var(--border-base);
  border-radius: 10px;
  background: var(--bg-card);
  padding: 8px 10px;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s ease;
  width: 100%;
}

.risk-row:hover,
.smart-row:hover {
  border-color: var(--border-strong);
  background: var(--bg-hover);
}

.risk-row strong {
  display: inline-flex;
  width: 26px;
  height: 26px;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 800;
  flex-shrink: 0;
}

.risk-row span,
.smart-row span {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 1px;
}

.risk-row b,
.smart-row b {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.risk-row small,
.smart-row small {
  font-size: 9px;
  font-weight: 500;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.risk-danger strong {
  background: rgba(220, 38, 38, 0.08);
  color: #dc2626;
}
.risk-warning strong {
  background: rgba(217, 119, 6, 0.1);
  color: #d97706;
}
.risk-notice strong {
  background: rgba(8, 145, 178, 0.08);
  color: #0891b2;
}
.risk-info strong {
  background: rgba(100, 116, 139, 0.08);
  color: var(--text-secondary);
}

.smart-row {
  color: #d97706;
}

.safe-line,
.empty-line {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  border-radius: 8px;
  color: var(--text-muted);
  background: var(--bg-subtle);
}

.command-card {
  border-color: color-mix(in srgb, var(--accent) 15%, var(--border-base));
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--bg-card) 95%, var(--accent) 5%),
    var(--bg-card) 90%
  );
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.eyebrow {
  margin-bottom: 2px;
}

.focus-score {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(37, 99, 235, 0.12) 0%, rgba(37, 99, 235, 0.02) 100%);
  border: 1px solid rgba(37, 99, 235, 0.25);
  color: #2563eb;
  box-shadow: 0 0 12px rgba(37, 99, 235, 0.1);
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.focus-score:hover {
  transform: scale(1.06);
  box-shadow: 0 0 16px rgba(37, 99, 235, 0.25);
  border-color: rgba(37, 99, 235, 0.5);
}

.focus-score.warning {
  background: radial-gradient(circle, rgba(220, 38, 38, 0.12) 0%, rgba(220, 38, 38, 0.02) 100%);
  border-color: rgba(220, 38, 38, 0.25);
  color: #dc2626;
  box-shadow: 0 0 12px rgba(220, 38, 38, 0.1);
}

.focus-score.warning:hover {
  box-shadow: 0 0 16px rgba(220, 38, 38, 0.25);
  border-color: rgba(220, 38, 38, 0.5);
}

.focus-score strong {
  font-size: 18px;
  font-weight: 800;
  line-height: 1;
}

.focus-score small {
  font-size: 8px;
  font-weight: 700;
  margin-top: 1px;
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 12px;
}

.quick-action {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 54px;
  border: 1px solid var(--border-base);
  border-radius: 10px;
  background: var(--bg-card);
  padding: 8px 10px;
  text-align: left;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  cursor: pointer;
}

.quick-action:hover {
  transform: translateY(-2px);
  background: var(--bg-hover);
  border-color: color-mix(in srgb, var(--accent) 30%, var(--border-base));
  box-shadow: var(--shadow-card);
}

.quick-icon {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  transition: transform 0.2s ease;
  flex-shrink: 0;
}

.quick-action:hover .quick-icon {
  transform: scale(1.05);
}

.quick-action span:last-child {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 1px;
}

.quick-action strong,
.asset-meta strong {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quick-action small,
.asset-meta small {
  font-size: 10px;
  font-weight: 500;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.qa-blue .quick-icon {
  background: rgba(37, 99, 235, 0.08);
  color: #2563eb;
}
.qa-amber .quick-icon {
  background: rgba(217, 119, 6, 0.1);
  color: #d97706;
}
.qa-green .quick-icon {
  background: rgba(5, 150, 105, 0.1);
  color: #059669;
}
.qa-indigo .quick-icon {
  background: rgba(79, 70, 229, 0.1);
  color: #4f46e5;
}
.qa-pink .quick-icon {
  background: rgba(219, 39, 119, 0.1);
  color: #db2777;
}
.qa-orange .quick-icon {
  background: rgba(234, 88, 12, 0.1);
  color: #ea580c;
}

.task-kpis,
.momentum-panel {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-top: 12px;
}

.momentum-item {
  padding: 0;
}

.asset-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  padding: 12px;
}

.asset-item {
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-md);
  aspect-ratio: 4 / 3;
  display: flex;
  flex-direction: column;
  padding: 0;
  border: 1px solid var(--border-base);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  background: var(--bg-card);
  cursor: pointer;
  width: 100%;
}

.asset-item:hover {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--accent) 30%, var(--border-base));
  box-shadow: var(--shadow-card-hover);
}

.asset-thumb {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, rgba(37, 99, 235, 0.05) 0%, rgba(245, 121, 42, 0.05) 100%);
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.asset-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.asset-item:hover .asset-thumb img {
  transform: scale(1.05);
}

.asset-meta {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(15, 23, 42, 0.82);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  padding: 8px;
  color: #fff;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  pointer-events: none;
}

.asset-meta strong {
  color: #fff !important;
  font-size: 11px !important;
  line-height: 1.2;
}

.asset-meta small {
  color: rgba(255, 255, 255, 0.7) !important;
  font-size: 9px !important;
}

@media (max-width: 1200px) {
  .dashboard-grid-layout {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .ops-workbench-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 980px) {
  .metric-strip,
  .work-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .metric-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .metric-tile {
    grid-content: auto minmax(0, 1fr);
  }

  .metric-trend {
    display: none;
  }

  .ops-workbench-grid {
    grid-template-columns: 1fr;
  }
}
</style>
