<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import type { Component } from 'vue';
import { useRouter } from 'vue-router';
import {
  Activity,
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
  FileText,
  Flame,
  FolderOpen,
  Gauge,
  Image as ImageIcon,
  Inbox,
  Layers,
  MessageSquare,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
  Upload,
  Users,
  Zap,
} from 'lucide-vue-next';
import ProjectImportDialog from './components/ProjectImportDialog.vue';
import UserAvatar from '@/components/UserAvatar.vue';
import api, { getAssetUrl } from '@/utils/api';
import { useAuthStore } from '@/stores/auth';
import { useWorkspaceStore } from '@/stores/workspace';
import { socketService } from '@/utils/socket';
import type {
  DashboardActivity,
  DashboardAsset,
  DashboardEnrollment,
  DashboardStatsResponse,
  DashboardTask,
  WorkbenchData,
  WorkbenchFocusProject,
} from './types';

interface TeamMemberRecord {
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
}

interface ProjectRecord {
  id: string;
  title: string;
  progress?: number;
  color?: string | null;
  status?: string;
  dueDate?: string | null;
  updatedAt?: string;
  members?: unknown[];
}

interface ProjectSummary {
  id: string;
  title: string;
  progress: number;
  color: string;
  status: string;
  dueDate?: string | null;
  updatedAt?: string;
  memberCount: number;
}

interface LeaderboardMember {
  id: string;
  name: string;
  avatarUrl?: string | null;
  score?: number;
  points?: number;
  rank: number;
}

interface ActiveBanner {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  route: string;
  tag: string | null;
  tagColor: string | null;
  buttonText: string;
  order: number;
}

interface MetricTile {
  id: string;
  label: string;
  value: string | number;
  detail: string;
  trend?: string;
  icon: Component;
  route: string;
  tone: string;
}

interface QuickAction {
  id: string;
  label: string;
  hint: string;
  icon: Component;
  route?: string;
  mode?: 'ai_assistant' | 'traditional';
  tone: string;
}

interface FeedItem {
  id: string;
  icon: Component;
  title: string;
  description: string;
  time: string;
  rawTime: Date;
  route?: string;
  imageUrl?: string | null;
  user?: {
    name: string;
    avatarUrl?: string | null;
  };
  badge?: string;
}

const router = useRouter();
const authStore = useAuthStore();
const workspaceStore = useWorkspaceStore();

const selectedDate = ref(new Date());
const isLoading = ref(false);
const workbenchError = ref('');
const lastUpdatedAt = ref<Date | null>(null);
const stats = ref<DashboardStatsResponse | null>(null);
const workbench = ref<WorkbenchData | null>(null);
const activeEnrollment = ref<DashboardEnrollment | null>(null);
const activityLog = ref<DashboardActivity[]>([]);
const recentAssets = ref<DashboardAsset[]>([]);
const recentTasks = ref<DashboardTask[]>([]);
const recentProjects = ref<ProjectSummary[]>([]);
const leaderboard = ref<LeaderboardMember[]>([]);
const activeBanners = ref<ActiveBanner[]>([]);
const activeSlideIndex = ref(0);
const isAddDialogOpen = ref(false);
const importDialogMode = ref<'netdisk' | 'ai_assistant' | 'traditional'>('ai_assistant');
const userTeamRole = ref<'OWNER' | 'ADMIN' | 'MEMBER' | null>(null);
const completingTaskIds = ref<Set<string>>(new Set());
let carouselTimer: ReturnType<typeof setInterval> | null = null;

const greeting = computed(() => {
  const hour = new Date().getHours();
  if (hour < 6) return '深夜好';
  if (hour < 12) return '早上好';
  if (hour < 14) return '中午好';
  if (hour < 18) return '下午好';
  return '晚上好';
});

const canCreateProject = computed(() => {
  if (authStore.user?.role === 'ADMIN') return true;
  const workspace = workspaceStore.currentWorkspace;
  if (!workspace || workspace.type === 'personal') return true;
  if (workspace.type === 'team') return userTeamRole.value === 'OWNER' || userTeamRole.value === 'ADMIN';
  return false;
});

const currentDateLabel = computed(() =>
  selectedDate.value.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', weekday: 'short' }),
);

const lastUpdatedText = computed(() => {
  if (!lastUpdatedAt.value) return '等待同步';
  return `更新于 ${lastUpdatedAt.value.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
});

const activeSlide = computed(() => activeBanners.value[activeSlideIndex.value] || null);

const taskSummary = computed(() => {
  if (workbench.value) return workbench.value.work;
  const total = recentTasks.value.length;
  const done = recentTasks.value.filter((task) => task.status === 'DONE').length;
  return {
    total,
    todo: recentTasks.value.filter((task) => task.status === 'TODO').length,
    inProgress: recentTasks.value.filter((task) => task.status === 'IN_PROGRESS').length,
    done,
    overdue: recentTasks.value.filter(isOverdue).length,
    dueToday: recentTasks.value.filter(isDueToday).length,
    urgent: recentTasks.value.filter((task) => ['HIGH', 'URGENT'].includes(task.priority || '')).length,
    assignedToMe: recentTasks.value.filter((task) => task.status !== 'DONE').length,
    completionRate: total ? Math.round((done / total) * 100) : 0,
    recentDone: done,
  };
});

const contentSummary = computed(() => {
  if (workbench.value) return workbench.value.content;
  return {
    total: recentAssets.value.length,
    assets: recentAssets.value.length,
    approvedAssets: recentAssets.value.length,
    pendingAssets: 0,
    rejectedAssets: 0,
    missingThumbAssets: recentAssets.value.filter((asset) => !asset.thumbnail).length,
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
  if (workbench.value) return workbench.value.command.learningProgress;
  const parsed = Number.parseInt(stats.value?.learningProgress || '0', 10);
  return Number.isFinite(parsed) ? parsed : 0;
});

const momentumScore = computed(() => workbench.value?.command.momentumScore ?? calculateFallbackMomentum());

const commandHeadline = computed(() => {
  if (workbenchError.value) return workbenchError.value;
  if (!workbench.value) return '正在汇总学习、项目、内容与协作信号';
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
    detail: activeEnrollment.value ? activeEnrollment.value.course.title : `${workbench.value?.learning.enrollmentCount ?? 0} 门课程`,
    trend: stats.value?.trends?.learning,
    icon: BookOpen,
    route: activeEnrollment.value ? `/academy/player/${activeEnrollment.value.courseId}` : '/academy',
    tone: 'metric-blue',
  },
  {
    id: 'tasks',
    label: '任务负载',
    value: taskSummary.value.todo + taskSummary.value.inProgress,
    detail: taskSummary.value.overdue > 0 ? `${taskSummary.value.overdue} 逾期` : `${taskSummary.value.completionRate}% 完成率`,
    trend: workbench.value?.command.productivityTrend ?? stats.value?.trends?.tasks,
    icon: CheckSquare,
    route: '/work',
    tone: taskSummary.value.overdue > 0 ? 'metric-red' : 'metric-amber',
  },
  {
    id: 'content',
    label: '内容资产',
    value: contentSummary.value.total,
    detail: `${contentSummary.value.approvedAssets} 通过 / ${contentSummary.value.pendingAssets} 审核`,
    trend: stats.value?.trends?.assets,
    icon: Box,
    route: '/assets',
    tone: 'metric-green',
  },
  {
    id: 'community',
    label: '社区积分',
    value: formatNumber(workbench.value?.profile?.points ?? stats.value?.points ?? 0),
    detail: workbench.value ? `${workbench.value.collaboration.unreadMessages} 私信未读` : '等待排行',
    trend: stats.value?.trends?.points,
    icon: Star,
    route: '/showcase',
    tone: 'metric-cyan',
  },
]);

const opsMetrics = computed(() => [
  {
    label: '动量分',
    value: momentumScore.value,
    detail: workbench.value?.command.productivityTrend || '0',
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
    value: `${workbench.value?.command.contentApprovalRate ?? 100}%`,
    detail: `${contentSummary.value.pendingAssets} 审核中`,
    icon: ShieldCheck,
    tone: 'ops-amber',
  },
  {
    label: '协作负载',
    value: workbench.value?.command.collaborationLoad ?? 0,
    detail: `${workbench.value?.collaboration.unreadMessages ?? 0} 私信`,
    icon: Inbox,
    tone: 'ops-purple',
  },
]);

const trendMax = computed(() => Math.max(1, ...(workbench.value?.trend.map((item) => item.total) || [])));

const trendBars = computed(() =>
  (workbench.value?.trend || []).map((item) => ({
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

const focusQueue = computed(() => workbench.value?.focusQueue.slice(0, 4) || []);
const smartActions = computed(() => workbench.value?.smartActions.slice(0, 4) || []);
const projectHealth = computed<WorkbenchFocusProject[]>(() => {
  if (workbench.value?.projects.focus.length) return workbench.value.projects.focus.slice(0, 4);
  return recentProjects.value.slice(0, 4).map((project) => ({
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
    label: activeEnrollment.value ? '继续学习' : '探索课程',
    hint: activeEnrollment.value ? `${activeEnrollment.value.progress}%` : '学院',
    icon: BookOpen,
    route: activeEnrollment.value ? `/academy/player/${activeEnrollment.value.courseId}` : '/academy',
    tone: 'qa-blue',
  },
  { id: 'work', label: '任务看板', hint: `${taskSummary.value.todo + taskSummary.value.inProgress} 个`, icon: CheckSquare, route: '/work', tone: 'qa-amber' },
  { id: 'assets', label: '上传作品', hint: `${contentSummary.value.assets} 件`, icon: Upload, route: '/my-works', tone: 'qa-green' },
  { id: 'projects', label: '项目空间', hint: `${projectHealth.value.length} 个`, icon: FolderOpen, route: '/projects', tone: 'qa-indigo' },
  { id: 'community', label: '社区讨论', hint: '交流', icon: MessageSquare, route: '/discussions', tone: 'qa-pink' },
  { id: 'ai-plan', label: 'AI 规划', hint: '生成', icon: Brain, mode: 'ai_assistant', tone: 'qa-orange' },
]);

const visibleTasks = computed(() => recentTasks.value.slice(0, 6));
const visibleAssets = computed(() => recentAssets.value.slice(0, 6));
const leaderboardTop = computed(() => leaderboard.value.slice(0, 5));

const remainingLessons = computed(() => {
  if (!activeEnrollment.value) return 0;
  const lessons = activeEnrollment.value.course._count.lessons;
  return Math.max(0, Math.ceil(lessons * (1 - activeEnrollment.value.progress / 100)));
});

const unifiedFeed = computed<FeedItem[]>(() => {
  const activityItems = activityLog.value.map<FeedItem>((activity) => ({
    id: activity.id,
    icon: activity.action.includes('课程') ? BookOpen : activity.action.includes('作品') ? Star : MessageSquare,
    title: activity.user?.name || authStore.user?.name || '成员',
    description: `${activity.action}${activity.target ? `：${activity.target}` : ''}`,
    time: formatTime(activity.createdAt),
    rawTime: new Date(activity.createdAt),
    route: activity.action.includes('作品') ? '/showcase' : '/discussions',
    user: { name: activity.user?.name || '成员', avatarUrl: activity.user?.avatarUrl },
  }));

  const assetItems = recentAssets.value.map<FeedItem>((asset, index) => ({
    id: `asset-${asset.id}`,
    icon: ImageIcon,
    title: asset.title,
    description: asset.type ? `${asset.type} 作品已更新` : '作品已更新',
    time: asset.createdAt ? formatTime(asset.createdAt) : '最近上传',
    rawTime: asset.createdAt ? new Date(asset.createdAt) : new Date(Date.now() - index * 1000),
    route: `/assets/${asset.id}`,
    imageUrl: asset.thumbnail,
    badge: asset.type || '作品',
  }));

  const taskItems = recentTasks.value.map<FeedItem>((task) => ({
    id: `task-${task.id}`,
    icon: task.status === 'DONE' ? CheckCircle2 : task.status === 'IN_PROGRESS' ? Clock : Circle,
    title: task.title,
    description: task.project?.title ? `项目：${task.project.title}` : getTaskStatusLabel(task.status),
    time: task.dueDate ? `截止 ${formatDate(task.dueDate)}` : '无截止',
    rawTime: task.dueDate ? new Date(task.dueDate) : new Date(0),
    route: '/work',
    badge: getTaskStatusLabel(task.status),
  }));

  return [...activityItems, ...assetItems, ...taskItems]
    .sort((a, b) => b.rawTime.getTime() - a.rawTime.getTime())
    .slice(0, 8);
});

function parseNumericStat(value: string | number | undefined) {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const parsed = Number.parseFloat(value.replace(/,/g, '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function calculateFallbackMomentum() {
  const assetWeight = Math.min(contentSummary.value.assets * 8, 24);
  return Math.max(0, Math.min(100, Math.round(learningProgress.value * 0.35 + taskSummary.value.completionRate * 0.45 + assetWeight - taskSummary.value.overdue * 10)));
}

function formatNumber(value: number | string) {
  const numericValue = typeof value === 'number' ? value : parseNumericStat(value);
  return numericValue.toLocaleString('zh-CN');
}

function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
}

function formatTime(date: string) {
  const timestamp = new Date(date).getTime();
  if (!Number.isFinite(timestamp)) return '刚刚';
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return formatDate(date);
}

function isOverdue(task: DashboardTask) {
  if (!task.dueDate || task.status === 'DONE') return false;
  const due = new Date(task.dueDate);
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due.getTime() < today.getTime();
}

function isDueToday(task: DashboardTask) {
  if (!task.dueDate || task.status === 'DONE') return false;
  const due = new Date(task.dueDate);
  const today = new Date();
  return due.getFullYear() === today.getFullYear() && due.getMonth() === today.getMonth() && due.getDate() === today.getDate();
}

function isProjectAtRisk(project: ProjectSummary) {
  if (!project.dueDate || project.status === 'COMPLETED') return false;
  return new Date(project.dueDate).getTime() < Date.now() && project.progress < 100;
}

function getTaskStatusLabel(status: string) {
  if (status === 'DONE') return '已完成';
  if (status === 'IN_PROGRESS') return '进行中';
  return '待办';
}

function getTaskStatusClass(status: string) {
  if (status === 'DONE') return 'status-green';
  if (status === 'IN_PROGRESS') return 'status-blue';
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
  return completingTaskIds.value.has(taskId);
}

function setTaskCompleting(taskId: string, value: boolean) {
  const next = new Set(completingTaskIds.value);
  if (value) next.add(taskId);
  else next.delete(taskId);
  completingTaskIds.value = next;
}

function navigateTo(route?: string) {
  if (!route) return;
  if (/^https?:\/\//i.test(route)) {
    window.open(route, '_blank', 'noopener,noreferrer');
    return;
  }
  router.push(route);
}

function openImportDialog(mode: 'ai_assistant' | 'traditional') {
  importDialogMode.value = mode;
  isAddDialogOpen.value = true;
}

function openQuickAction(action: QuickAction) {
  if (action.mode) {
    openImportDialog(action.mode);
    return;
  }
  navigateTo(action.route);
}

function disabledDate(time: Date) {
  if (!authStore.user?.createdAt) return time.getTime() > Date.now();
  const registeredAt = new Date(authStore.user.createdAt);
  registeredAt.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return time.getTime() < registeredAt.getTime() || time.getTime() > today.getTime();
}

function getDateParam() {
  const year = selectedDate.value.getFullYear();
  const month = String(selectedDate.value.getMonth() + 1).padStart(2, '0');
  const day = String(selectedDate.value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function completeTask(task: DashboardTask) {
  if (task.status === 'DONE' || isCompletingTask(task.id)) return;
  setTaskCompleting(task.id, true);
  try {
    await api.put(`/api/tasks/${task.id}`, { status: 'DONE' });
    recentTasks.value = recentTasks.value.map((item) => (item.id === task.id ? { ...item, status: 'DONE' } : item));
    await fetchDashboardData();
  } catch (error) {
    console.error('Complete task failed:', error);
  } finally {
    setTaskCompleting(task.id, false);
  }
}

async function fetchTeamMembers() {
  try {
    const teamId = workspaceStore.activeTeamId;
    if (!teamId) {
      userTeamRole.value = null;
      return;
    }
    const response = await api.get<TeamMemberRecord[]>(`/api/teams/${teamId}/members`);
    const record = response.data.find((member) => member.userId === authStore.user?.id);
    userTeamRole.value = record?.role ?? null;
  } catch {
    userTeamRole.value = null;
  }
}

async function fetchDashboardData() {
  isLoading.value = true;
  workbenchError.value = '';
  const date = getDateParam();
  try {
    const [statsRes, workbenchRes, enrollmentsRes, activityRes, assetsRes, tasksRes, allTasksRes, projectsRes] =
      await Promise.all([
        api.get<DashboardStatsResponse>('/api/auth/stats', { params: { date } }).catch(() => null),
        api.get<WorkbenchData>('/api/auth/workbench').catch((error) => {
          console.error('Fetch workbench data error:', error);
          workbenchError.value = '工作台数据暂时不可用';
          return null;
        }),
        api.get<DashboardEnrollment[]>('/api/courses/my-enrollments').catch(() => null),
        api.get<DashboardActivity[]>('/api/auth/activity', { params: { date } }).catch(() => null),
        api.get<DashboardAsset[]>('/api/assets/my').catch(() => null),
        api.get<DashboardTask[]>('/api/tasks', { params: { date } }).catch(() => null),
        api.get<DashboardTask[]>('/api/tasks').catch(() => null),
        api.get<ProjectRecord[]>('/api/projects').catch(() => null),
      ]);

    stats.value = statsRes?.data ?? null;
    workbench.value = workbenchRes?.data ?? null;
    activeEnrollment.value = enrollmentsRes?.data?.[0] ?? workbench.value?.learning.activeCourse ?? null;
    activityLog.value = activityRes?.data ?? [];
    recentAssets.value = (assetsRes?.data ?? []).slice(0, 6);

    const selectedTasks = tasksRes?.data ?? [];
    const allTasks = allTasksRes?.data ?? [];
    recentTasks.value = (selectedTasks.length > 0 ? selectedTasks : allTasks).slice(0, 6);

    recentProjects.value = (projectsRes?.data ?? []).slice(0, 6).map((project) => ({
      id: project.id,
      title: project.title,
      progress: project.progress ?? 0,
      color: project.color || 'bg-accent',
      status: project.status || 'IN_PROGRESS',
      dueDate: project.dueDate,
      updatedAt: project.updatedAt,
      memberCount: project.members?.length ?? 1,
    }));

    lastUpdatedAt.value = new Date();
  } catch (error) {
    console.error('Fetch dashboard data error:', error);
  } finally {
    isLoading.value = false;
  }
}

async function fetchLeaderboard() {
  const response = await api.get<LeaderboardMember[]>('/api/auth/leaderboard').catch(() => null);
  leaderboard.value = response?.data?.slice(0, 5) ?? [];
}

function startCarousel() {
  stopCarousel();
  if (activeBanners.value.length > 1) {
    carouselTimer = setInterval(() => {
      activeSlideIndex.value = (activeSlideIndex.value + 1) % activeBanners.value.length;
    }, 5000);
  }
}

function stopCarousel() {
  if (!carouselTimer) return;
  clearInterval(carouselTimer);
  carouselTimer = null;
}

async function fetchActiveBanners() {
  try {
    const { data } = await api.get<ActiveBanner[]>('/api/banners');
    activeBanners.value = data;
    activeSlideIndex.value = 0;
    startCarousel();
  } catch (error) {
    console.error('Failed to fetch active banners:', error);
  }
}

async function refreshAll() {
  await Promise.all([fetchDashboardData(), fetchTeamMembers(), fetchLeaderboard(), fetchActiveBanners()]);
}

function handleNewActivity(activity: DashboardActivity) {
  const activityDate = new Date(activity.createdAt);
  const selected = selectedDate.value;
  if (
    activityDate.getFullYear() !== selected.getFullYear() ||
    activityDate.getMonth() !== selected.getMonth() ||
    activityDate.getDate() !== selected.getDate()
  ) {
    return;
  }
  activityLog.value = [activity, ...activityLog.value].slice(0, 10);
}

watch(selectedDate, fetchDashboardData);
watch(() => workspaceStore.activeWorkspaceId, refreshAll);

onMounted(() => {
  refreshAll();
  socketService.connect();
  socketService.on('new_activity', handleNewActivity);
});

onUnmounted(() => {
  stopCarousel();
  socketService.off('new_activity', handleNewActivity);
});
</script>

<template>
  <div class="dashboard-page">
    <header class="dashboard-topbar">
      <div class="topbar-title">
        <span class="topbar-icon"><Gauge class="h-4 w-4" /></span>
        <div class="min-w-0">
          <p class="topbar-greeting">{{ greeting }}，{{ authStore.user?.name || '创作者' }}</p>
          <p class="topbar-subtitle">{{ currentDateLabel }} · {{ lastUpdatedText }}</p>
        </div>
      </div>

      <div class="topbar-actions">
        <el-date-picker
          v-model="selectedDate"
          type="date"
          class="dashboard-date-picker"
          placeholder="选择日期"
          :clearable="false"
          :disabled-date="disabledDate"
          popper-class="custom-date-popper"
        />
        <button type="button" class="icon-command" :disabled="isLoading" aria-label="刷新" @click="refreshAll">
          <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': isLoading }" />
        </button>
        <button v-if="canCreateProject" type="button" class="primary-command" @click="openImportDialog('ai_assistant')">
          <Brain class="h-4 w-4" />
          <span>AI 规划</span>
        </button>
        <button v-if="canCreateProject" type="button" class="secondary-command" @click="openImportDialog('traditional')">
          <FileText class="h-4 w-4" />
          <span>文本导入</span>
        </button>
      </div>
    </header>

    <main class="dashboard-scroll">
      <div class="dashboard-grid-layout">
        <!-- Main Column (Left Workspace) -->
        <div class="layout-main-col">
          <!-- Spotlight Banner -->
          <div class="spotlight blender-card dashboard-card">
            <template v-if="activeSlide">
              <img :src="getAssetUrl(activeSlide.imageUrl)" :alt="activeSlide.title" class="spotlight-image" />
              <div class="spotlight-overlay"></div>
              <div class="spotlight-content">
                <span v-if="activeSlide.tag" class="spotlight-tag">{{ activeSlide.tag }}</span>
                <h1>{{ activeSlide.title }}</h1>
                <p v-if="activeSlide.subtitle">{{ activeSlide.subtitle }}</p>
                <button type="button" class="spotlight-button" @click="navigateTo(activeSlide.route)">
                  <Play class="h-4 w-4" />
                  <span>{{ activeSlide.buttonText }}</span>
                </button>
              </div>
            </template>
            <template v-else-if="activeEnrollment">
              <img
                :src="getAssetUrl(activeEnrollment.course.thumbnail) || 'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=900&auto=format&fit=crop&q=70'"
                :alt="activeEnrollment.course.title"
                class="spotlight-image"
              />
              <div class="spotlight-overlay"></div>
              <div class="spotlight-content">
                <span class="spotlight-tag">正在学习</span>
                <h1>{{ activeEnrollment.course.title }}</h1>
                <p>当前完成 {{ activeEnrollment.progress }}%，剩余 {{ remainingLessons }} 节。</p>
                <button type="button" class="spotlight-button" @click="navigateTo(`/academy/player/${activeEnrollment.courseId}`)">
                  <Play class="h-4 w-4" />
                  <span>继续学习</span>
                </button>
              </div>
            </template>
            <template v-else>
              <div class="spotlight-empty">
                <BookOpen class="h-9 w-9" />
                <span>
                  <h1>选择一门主线课程</h1>
                  <p>把学习、作品和项目串起来。</p>
                </span>
                <button type="button" class="spotlight-button" @click="navigateTo('/academy')">
                  <ArrowRight class="h-4 w-4" />
                  <span>进入学院</span>
                </button>
              </div>
            </template>
          </div>

          <!-- Core Metric Strip -->
          <section class="metric-strip" aria-label="核心指标">
            <button
              v-for="metric in metricTiles"
              :key="metric.id"
              type="button"
              class="metric-tile dashboard-card"
              :class="metric.tone"
              @click="navigateTo(metric.route)"
            >
              <span class="metric-icon"><component :is="metric.icon" class="h-4 w-4" /></span>
              <span class="metric-copy">
                <span class="metric-label">{{ metric.label }}</span>
                <span class="metric-value">{{ metric.value }}</span>
                <span class="metric-detail">{{ metric.detail }}</span>
              </span>
              <span v-if="metric.trend" class="metric-trend" :class="getTrendClass(metric.trend)">{{ metric.trend }}</span>
            </button>
          </section>

          <!-- Core Work Grid (Tasks & Projects) -->
          <div class="work-grid">
            <div class="tasks-panel blender-card dashboard-card">
              <div class="panel-header">
                <div>
                  <h3>任务推进</h3>
                  <p>{{ taskSummary.inProgress }} 进行中 · {{ taskSummary.overdue }} 逾期 · {{ taskSummary.completionRate }}% 完成率</p>
                </div>
                <button type="button" class="link-command" @click="navigateTo('/work')">全部 <ArrowRight class="h-3.5 w-3.5" /></button>
              </div>
              <div v-if="visibleTasks.length" class="task-list">
                <div
                  v-for="task in visibleTasks"
                  :key="task.id"
                  class="task-row"
                  role="button"
                  tabindex="0"
                  @click="navigateTo('/work')"
                  @keydown.enter="navigateTo('/work')"
                  @keydown.space.prevent="navigateTo('/work')"
                >
                  <span class="task-state" :class="getTaskStatusClass(task.status)">
                    <component :is="task.status === 'DONE' ? CheckCircle2 : task.status === 'IN_PROGRESS' ? Clock : Circle" class="h-4 w-4" />
                  </span>
                  <span class="task-main">
                    <strong>{{ task.title }}</strong>
                    <small>{{ task.project?.title || '工作区任务' }} · {{ task.dueDate ? formatDate(task.dueDate) : '无截止' }} <b v-if="isOverdue(task)">逾期</b></small>
                  </span>
                  <span class="priority-pill" :class="`priority-${task.priority || 'MEDIUM'}`">{{ getPriorityLabel(task.priority) }}</span>
                  <button type="button" class="complete-command" :disabled="task.status === 'DONE' || isCompletingTask(task.id)" @click.stop="completeTask(task)">
                    <CheckCircle2 class="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div v-else class="empty-panel"><CheckSquare class="h-7 w-7" /><strong>暂无待办任务</strong></div>
            </div>

            <div class="projects-panel blender-card dashboard-card">
              <div class="panel-header">
                <div>
                  <h3>项目健康雷达</h3>
                  <p>{{ projectHealth.length }} 个重点项目</p>
                </div>
                <button type="button" class="link-command" @click="navigateTo('/projects')">全部 <ArrowRight class="h-3.5 w-3.5" /></button>
              </div>
              <div v-if="projectHealth.length" class="project-list">
                <button
                  v-for="project in projectHealth"
                  :key="project.id"
                  type="button"
                  class="project-row"
                  :class="getHealthClass(project.healthScore)"
                  @click="navigateTo(`/project/${project.id}`)"
                >
                  <span class="project-avatar" :class="project.color || 'bg-accent'">{{ project.title.charAt(0) }}</span>
                  <span class="project-body">
                    <span class="project-title"><strong>{{ project.title }}</strong><small>{{ project.memberCount }} 人</small></span>
                    <span class="progress-line"><i :style="{ width: `${project.healthScore}%` }"></i></span>
                  </span>
                  <span class="project-progress">{{ project.healthScore }}</span>
                </button>
              </div>
              <div v-else class="empty-panel"><Layers class="h-7 w-7" /><strong>暂无项目</strong></div>
            </div>
          </div>

          <!-- Operations Workbench -->
          <section class="ops-workbench dashboard-card blender-card" aria-label="全局运营工作台">
            <div class="ops-summary">
              <div class="section-title tight">
                <span class="section-icon"><Gauge class="h-4 w-4" /></span>
                <span class="min-w-0">
                  <strong>全局运营工作台</strong>
                  <small>{{ commandHeadline }}</small>
                </span>
              </div>
              <div class="ops-metrics">
                <div v-for="metric in opsMetrics" :key="metric.label" class="ops-metric" :class="metric.tone">
                  <component :is="metric.icon" class="h-3.5 w-3.5" />
                  <span>
                    <strong>{{ metric.value }}</strong>
                    <small>{{ metric.label }} · {{ metric.detail }}</small>
                  </span>
                </div>
              </div>
            </div>

            <div class="ops-chart">
              <div class="panel-line">
                <span><BarChart3 class="h-3.5 w-3.5" />14 天活跃曲线</span>
                <small>学习 / 任务 / 内容 / 社区</small>
              </div>
              <div v-if="trendBars.length" class="ops-bars">
                <span v-for="bar in trendBars" :key="bar.date" class="ops-bar" :title="`${bar.label}: ${bar.total}`">
                  <i :style="{ height: `${bar.height}%` }">
                    <b class="bar-learning" :style="{ flex: bar.learning || 0.15 }"></b>
                    <b class="bar-tasks" :style="{ flex: bar.tasks || 0.15 }"></b>
                    <b class="bar-content" :style="{ flex: bar.content || 0.15 }"></b>
                    <b class="bar-community" :style="{ flex: bar.community || 0.15 }"></b>
                  </i>
                  <em>{{ bar.label }}</em>
                </span>
              </div>
              <div v-else class="empty-line">{{ isLoading ? '正在生成趋势...' : workbenchError || '暂无趋势数据' }}</div>
            </div>

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
                  class="pipe-chip"
                  :class="pipe.tone"
                  @click="navigateTo(pipe.route)"
                >
                  <strong>{{ pipe.value }}</strong>
                  <small>{{ pipe.label }}</small>
                </button>
              </div>
            </div>

            <div class="ops-risks">
              <div class="panel-line">
                <span><AlertTriangle class="h-3.5 w-3.5" />风险与建议</span>
                <small>{{ focusQueue.length }} 风险</small>
              </div>
              <button
                v-for="item in focusQueue"
                :key="item.id"
                type="button"
                class="risk-row"
                :class="getSeverityClass(item.severity)"
                @click="navigateTo(item.route)"
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
                class="smart-row"
                @click="navigateTo(action.route)"
              >
                <Sparkles class="h-3.5 w-3.5" />
                <span>
                  <b>{{ action.title }}</b>
                  <small>{{ action.impact }}</small>
                </span>
                <ArrowRight class="h-3.5 w-3.5" />
              </button>
              <div v-if="!focusQueue.length && !smartActions.length" class="safe-line">
                <ShieldCheck class="h-4 w-4" />
                <span>暂无高风险信号</span>
              </div>
            </div>
          </section>
        </div>

        <!-- Sidebar Column (Right Workspace Panels) -->
        <aside class="layout-sidebar-col">
          <!-- Focus Center Widget -->
          <div class="command-card blender-card dashboard-card">
            <div class="section-heading">
              <div>
                <p class="eyebrow">Today</p>
                <h2>推进中心</h2>
              </div>
              <div class="focus-score" :class="{ warning: taskSummary.overdue > 0 }">
                <strong>{{ momentumScore }}</strong>
                <small>Focus</small>
              </div>
            </div>

            <div class="quick-grid">
              <button
                v-for="action in quickActions"
                :key="action.id"
                type="button"
                class="quick-action"
                :class="action.tone"
                @click="openQuickAction(action)"
              >
                <span class="quick-icon"><component :is="action.icon" class="h-4 w-4" /></span>
                <span>
                  <strong>{{ action.label }}</strong>
                  <small>{{ action.hint }}</small>
                </span>
              </button>
            </div>

            <div class="task-kpis">
              <span><strong>{{ taskSummary.dueToday }}</strong><small>今日到期</small></span>
              <span><strong>{{ taskSummary.urgent }}</strong><small>高优先级</small></span>
              <span><strong>{{ taskSummary.assignedToMe }}</strong><small>我的负载</small></span>
            </div>
          </div>

          <!-- Leaderboard Widget -->
          <div class="leader-card blender-card dashboard-card">
            <div class="panel-header compact">
              <div>
                <h3>社区积分榜</h3>
                <p>TOP {{ leaderboardTop.length }}</p>
              </div>
              <Trophy class="h-4 w-4 text-amber-500" />
            </div>
            <div v-if="leaderboardTop.length" class="leader-list">
              <div v-for="member in leaderboardTop" :key="member.id" class="leader-row">
                <span class="rank-pill" :class="{ hot: member.rank <= 3 }">{{ member.rank }}</span>
                <UserAvatar :user="{ name: member.name, avatarUrl: member.avatarUrl }" size="xs" />
                <span class="leader-name">{{ member.name }}</span>
                <strong>{{ formatNumber(member.score ?? member.points ?? 0) }}</strong>
              </div>
            </div>
            <div v-else class="empty-panel compact"><Trophy class="h-5 w-5" /><span>暂无排行</span></div>
          </div>

          <!-- Works Assets Showcase -->
          <div class="assets-panel blender-card dashboard-card">
            <div class="panel-header">
              <div>
                <h3>作品资产</h3>
                <p>{{ contentSummary.approvedAssets }} 已通过 · {{ contentSummary.pendingAssets }} 审核中</p>
              </div>
              <button type="button" class="link-command" @click="navigateTo('/my-works')">管理 <ArrowRight class="h-3.5 w-3.5" /></button>
            </div>
            <div v-if="visibleAssets.length" class="asset-grid">
              <button v-for="asset in visibleAssets" :key="asset.id" type="button" class="asset-item" @click="navigateTo(`/assets/${asset.id}`)">
                <span class="asset-thumb">
                  <img v-if="asset.thumbnail" :src="getAssetUrl(asset.thumbnail)" :alt="asset.title" />
                  <ImageIcon v-else class="h-5 w-5" />
                </span>
                <span class="asset-meta"><strong>{{ asset.title }}</strong><small>{{ asset.type || '3D 作品' }}</small></span>
              </button>
            </div>
            <div v-else class="empty-panel compact"><Upload class="h-7 w-7" /><strong>还没有作品</strong></div>
          </div>

          <!-- Live Activity Feed -->
          <div class="activity-panel blender-card dashboard-card">
            <div class="panel-header compact">
              <div>
                <h3>实时动态</h3>
                <p>{{ unifiedFeed.length }} 条更新</p>
              </div>
              <span class="live-label"><i></i> LIVE</span>
            </div>
            <div v-if="unifiedFeed.length" class="feed-list">
              <button v-for="feed in unifiedFeed" :key="feed.id" type="button" class="feed-row" @click="navigateTo(feed.route)">
                <span class="feed-visual">
                  <img v-if="feed.imageUrl" :src="getAssetUrl(feed.imageUrl)" :alt="feed.title" />
                  <UserAvatar v-else-if="feed.user" :user="feed.user" size="xs" />
                  <component :is="feed.icon" v-else class="h-4 w-4" />
                </span>
                <span class="feed-body"><span><strong>{{ feed.title }}</strong><small>{{ feed.time }}</small></span><em>{{ feed.description }}</em></span>
                <span v-if="feed.badge" class="feed-badge">{{ feed.badge }}</span>
              </button>
            </div>
            <div v-else class="empty-panel compact"><Activity class="h-5 w-5" /><span>暂无实时动态</span></div>
          </div>

          <!-- Momentum Panel -->
          <div class="momentum-panel blender-card dashboard-card">
            <div class="momentum-item"><Flame class="h-4 w-4 text-orange-500" /><span><strong>{{ taskSummary.recentDone }}</strong><small>近 7 天完成</small></span></div>
            <div class="momentum-item"><Users class="h-4 w-4 text-emerald-500" /><span><strong>{{ workbench?.workspace.memberCount ?? 1 }}</strong><small>空间成员</small></span></div>
            <div class="momentum-item"><Zap class="h-4 w-4 text-sky-500" /><span><strong>{{ workbench?.collaboration.activeAiBots ?? 0 }}</strong><small>AI 机器人</small></span></div>
          </div>
        </aside>
      </div>
    </main>

    <ProjectImportDialog
      v-model:visible="isAddDialogOpen"
      :can-create-project="canCreateProject"
      :initial-mode="importDialogMode"
      @imported="fetchDashboardData"
    />
  </div>
</template>

<style scoped>
.dashboard-page {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--bg-app) 78%, #ffffff 22%) 0, var(--bg-app) 260px),
    var(--bg-app);
  color: var(--text-primary);
}

.dashboard-topbar {
  display: flex;
  min-height: 54px;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid var(--border-base);
  background: color-mix(in srgb, var(--bg-card) 94%, #ffffff 6%);
  padding: 8px 18px;
  box-shadow: 0 1px 0 rgb(15 23 42 / 0.03);
}

.topbar-title,
.topbar-actions,
.section-title,
.panel-line,
.metric-tile,
.quick-action,
.task-row,
.project-row,
.feed-row,
.momentum-item,
.leader-row,
.risk-row,
.smart-row,
.safe-line {
  display: flex;
  align-items: center;
  min-width: 0;
}

.topbar-title,
.topbar-actions {
  gap: 10px;
}

.topbar-icon,
.section-icon,
.metric-icon,
.quick-icon {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
}

.topbar-icon {
  width: 34px;
  height: 34px;
  background: var(--accent-subtle);
  color: var(--accent);
}

.topbar-greeting {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 900;
}

.topbar-subtitle,
.panel-line small,
.section-title small {
  overflow: hidden;
  color: var(--text-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 10px;
  font-weight: 750;
}

.dashboard-date-picker {
  width: 142px;
}

.icon-command,
.primary-command,
.secondary-command,
.link-command,
.spotlight-button,
.complete-command {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  font-size: 12px;
  font-weight: 850;
  transition: background-color 160ms ease, border-color 160ms ease, transform 160ms ease;
}

.icon-command {
  width: 34px;
  height: 34px;
  background: var(--bg-subtle);
  color: var(--text-secondary);
}

.primary-command,
.secondary-command {
  height: 34px;
  padding: 0 12px;
}

.primary-command,
.spotlight-button {
  border-color: var(--accent);
  background: var(--accent);
  color: #fff;
}

.secondary-command {
  background: var(--bg-subtle);
  color: var(--text-secondary);
}

.icon-command:hover,
.secondary-command:hover,
.link-command:hover,
.complete-command:hover {
  border-color: var(--border-strong);
  background: var(--bg-hover);
}

.dashboard-scroll {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  overflow-y: auto;
  padding: 12px 16px 18px;
}

.dashboard-card {
  border-radius: 8px;
  box-shadow: 0 1px 2px rgb(15 23 42 / 0.04);
}

.dashboard-card.blender-card:hover {
  transform: none;
  border-color: color-mix(in srgb, var(--accent) 18%, var(--border-base));
  box-shadow: 0 10px 24px rgb(15 23 42 / 0.08);
}

.metric-strip {
  order: 2;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.metric-tile {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 10px;
  min-height: 72px;
  border: 1px solid color-mix(in srgb, var(--border-base) 86%, transparent);
  background: color-mix(in srgb, var(--bg-card) 96%, var(--bg-subtle) 4%);
  padding: 10px 12px;
  text-align: left;
}

.metric-icon {
  width: 34px;
  height: 34px;
}

.metric-blue .metric-icon { background: rgba(37, 99, 235, 0.1); color: #2563eb; }
.metric-amber .metric-icon { background: rgba(217, 119, 6, 0.12); color: #d97706; }
.metric-red .metric-icon { background: rgba(220, 38, 38, 0.12); color: #dc2626; }
.metric-green .metric-icon { background: rgba(5, 150, 105, 0.12); color: #059669; }
.metric-cyan .metric-icon { background: rgba(8, 145, 178, 0.12); color: #0891b2; }

.metric-copy {
  display: grid;
  min-width: 0;
  gap: 1px;
}

.metric-label,
.metric-detail,
.metric-trend {
  overflow: hidden;
  color: var(--text-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 10px;
  font-weight: 800;
}

.metric-value {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 20px;
  font-weight: 950;
}

.metric-trend {
  align-self: start;
  border-radius: 999px;
  padding: 3px 6px;
}

.trend-up { background: rgba(5, 150, 105, 0.1); color: #059669; }
.trend-down { background: rgba(220, 38, 38, 0.1); color: #dc2626; }
.trend-neutral { background: var(--bg-subtle); color: var(--text-muted); }

.ops-workbench {
  order: 3;
  display: grid;
  grid-template-columns: minmax(260px, 1fr) minmax(320px, 1.1fr) minmax(220px, 0.8fr) minmax(270px, 1fr);
  gap: 10px;
  border: 1px solid color-mix(in srgb, var(--border-base) 88%, transparent);
  background: linear-gradient(135deg, color-mix(in srgb, var(--bg-card) 95%, #2563eb 5%), var(--bg-card));
  padding: 10px;
}

.ops-summary,
.ops-chart,
.ops-pipeline,
.ops-risks {
  min-width: 0;
  border: 1px solid color-mix(in srgb, var(--border-base) 72%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--bg-subtle) 64%, var(--bg-card) 36%);
  padding: 10px;
}

.section-title {
  gap: 8px;
}

.section-title strong,
.panel-line span {
  overflow: hidden;
  color: var(--text-primary);
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 950;
}

.section-title span:last-child {
  display: grid;
  gap: 1px;
}

.section-icon {
  width: 30px;
  height: 30px;
  background: rgba(37, 99, 235, 0.12);
  color: #2563eb;
}

.ops-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  margin-top: 9px;
}

.ops-metric {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  min-height: 48px;
  border-radius: 8px;
  padding: 7px;
}

.ops-metric span {
  display: grid;
  min-width: 0;
}

.ops-metric strong {
  overflow: hidden;
  color: var(--text-primary);
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 15px;
  font-weight: 950;
}

.ops-metric small {
  overflow: hidden;
  color: var(--text-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 9px;
  font-weight: 800;
}

.ops-blue { background: rgba(37, 99, 235, 0.1); color: #2563eb; }
.ops-green { background: rgba(5, 150, 105, 0.1); color: #059669; }
.ops-red { background: rgba(220, 38, 38, 0.1); color: #dc2626; }
.ops-amber { background: rgba(217, 119, 6, 0.12); color: #d97706; }
.ops-purple { background: rgba(124, 58, 237, 0.1); color: #7c3aed; }

.panel-line {
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.panel-line span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.ops-bars {
  display: grid;
  grid-template-columns: repeat(14, minmax(8px, 1fr));
  align-items: end;
  gap: 4px;
  min-height: 112px;
}

.ops-bar {
  display: grid;
  align-items: end;
  gap: 4px;
}

.ops-bar i {
  display: flex;
  min-height: 8px;
  flex-direction: column-reverse;
  overflow: hidden;
  border-radius: 999px 999px 4px 4px;
  background: var(--bg-card);
}

.ops-bar b {
  display: block;
  min-height: 2px;
}

.bar-learning { background: #2563eb; }
.bar-tasks { background: #d97706; }
.bar-content { background: #059669; }
.bar-community { background: #db2777; }

.ops-bar em {
  overflow: hidden;
  color: var(--text-muted);
  text-align: center;
  white-space: nowrap;
  font-size: 8px;
  font-style: normal;
  font-weight: 800;
}

.pipe-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 5px;
}

.pipe-chip {
  display: grid;
  min-height: 50px;
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 7px 4px;
  text-align: center;
}

.pipe-chip strong {
  font-size: 15px;
  font-weight: 950;
}

.pipe-chip small {
  color: var(--text-muted);
  font-size: 9px;
  font-weight: 850;
}

.pipe-blue { background: rgba(37, 99, 235, 0.09); }
.pipe-green { background: rgba(5, 150, 105, 0.1); }
.pipe-amber { background: rgba(217, 119, 6, 0.11); }
.pipe-purple { background: rgba(124, 58, 237, 0.1); }
.pipe-slate { background: rgba(100, 116, 139, 0.1); }

.ops-risks {
  display: grid;
  align-content: start;
  gap: 6px;
}

.risk-row,
.smart-row {
  width: 100%;
  gap: 8px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: color-mix(in srgb, var(--bg-card) 72%, transparent);
  padding: 7px;
  text-align: left;
}

.risk-row strong {
  display: inline-flex;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 950;
}

.risk-row span,
.smart-row span {
  display: grid;
  min-width: 0;
}

.risk-row b,
.smart-row b {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  font-weight: 950;
}

.risk-row small,
.smart-row small {
  overflow: hidden;
  color: var(--text-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 9px;
  font-weight: 750;
}

.risk-danger strong { background: rgba(220, 38, 38, 0.12); color: #dc2626; }
.risk-warning strong { background: rgba(217, 119, 6, 0.12); color: #d97706; }
.risk-notice strong { background: rgba(8, 145, 178, 0.12); color: #0891b2; }
.risk-info strong { background: rgba(100, 116, 139, 0.12); color: var(--text-secondary); }

.smart-row {
  color: #d97706;
}

.safe-line,
.empty-line {
  justify-content: center;
  min-height: 38px;
  border-radius: 8px;
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 850;
}

.empty-line {
  display: flex;
  align-items: center;
  background: var(--bg-subtle);
}

.dashboard-grid-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 14px;
  align-items: start;
}

.layout-main-col,
.layout-sidebar-col {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

.command-card,
.leader-card,
.tasks-panel,
.projects-panel,
.assets-panel,
.activity-panel {
  display: flex;
  min-height: 0;
  flex-direction: column;
}

.command-card {
  border-color: color-mix(in srgb, var(--accent) 12%, var(--border-base));
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--bg-card) 94%, #2563eb 6%), var(--bg-card) 85%),
    var(--bg-card);
  padding: 12px;
}

.section-heading,
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.panel-header {
  border-bottom: 1px solid var(--border-base);
  padding: 10px 12px 8px;
}

.panel-header h3,
.section-heading h2 {
  margin: 0;
  font-size: 13px;
  font-weight: 950;
}

.panel-header p,
.eyebrow {
  margin: 1px 0 0;
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 800;
}

.focus-score {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(37, 99, 235, 0.14) 0%, rgba(37, 99, 235, 0.04) 100%);
  border: 1px solid rgba(37, 99, 235, 0.35);
  color: #2563eb;
  box-shadow: 0 0 12px rgba(37, 99, 235, 0.15);
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.focus-score:hover {
  transform: scale(1.06);
  box-shadow: 0 0 16px rgba(37, 99, 235, 0.35);
  border-color: rgba(37, 99, 235, 0.6);
}

.focus-score.warning {
  background: radial-gradient(circle, rgba(220, 38, 38, 0.16) 0%, rgba(220, 38, 38, 0.05) 100%);
  border-color: rgba(220, 38, 38, 0.35);
  color: #dc2626;
  box-shadow: 0 0 12px rgba(220, 38, 38, 0.15);
}

.focus-score.warning:hover {
  box-shadow: 0 0 16px rgba(220, 38, 38, 0.35);
  border-color: rgba(220, 38, 38, 0.6);
}

.focus-score strong {
  font-size: 17px;
  font-weight: 950;
  line-height: 1;
}

.focus-score small {
  font-size: 8px;
  font-weight: 900;
  margin-top: 1px;
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  margin-top: 10px;
}

.quick-action {
  gap: 8px;
  min-height: 52px;
  border: 1px solid color-mix(in srgb, var(--border-base) 80%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--bg-card) 68%, var(--bg-subtle) 32%);
  padding: 6px 8px;
  text-align: left;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.quick-action:hover {
  transform: translateY(-2px);
  background: color-mix(in srgb, var(--bg-card) 90%, var(--accent-subtle) 10%);
  border-color: color-mix(in srgb, var(--accent) 30%, var(--border-base));
  box-shadow: var(--shadow-card);
}

.quick-icon {
  width: 28px;
  height: 28px;
  transition: transform 0.2s ease;
}

.quick-action:hover .quick-icon {
  transform: scale(1.05);
}

.quick-action span:last-child {
  display: grid;
  min-width: 0;
}

.quick-action strong,
.task-main strong,
.project-title strong,
.asset-meta strong,
.feed-body strong,
.leader-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  font-weight: 950;
}

.quick-action small,
.task-main small,
.project-title small,
.asset-meta small,
.feed-body small,
.feed-body em {
  overflow: hidden;
  color: var(--text-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 9px;
  font-weight: 750;
  font-style: normal;
}

.qa-blue .quick-icon { background: rgba(37, 99, 235, 0.1); color: #2563eb; }
.qa-amber .quick-icon { background: rgba(217, 119, 6, 0.12); color: #d97706; }
.qa-green .quick-icon { background: rgba(5, 150, 105, 0.12); color: #059669; }
.qa-indigo .quick-icon { background: rgba(79, 70, 229, 0.12); color: #4f46e5; }
.qa-pink .quick-icon { background: rgba(219, 39, 119, 0.12); color: #db2777; }
.qa-orange .quick-icon { background: rgba(234, 88, 12, 0.12); color: #ea580c; }

.task-kpis,
.momentum-panel {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-top: 12px;
}

.task-kpis span,
.momentum-item {
  display: grid;
  min-width: 0;
  border: 1px solid color-mix(in srgb, var(--border-base) 80%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--bg-card) 68%, var(--bg-subtle) 32%);
  padding: 8px;
}

.task-kpis strong,
.momentum-item strong {
  font-size: 15px;
  font-weight: 950;
}

.task-kpis small,
.momentum-item small {
  color: var(--text-muted);
  font-size: 9px;
  font-weight: 800;
}

.leader-list,
.task-list,
.project-list,
.feed-list {
  display: grid;
  gap: 7px;
  overflow-y: auto;
  padding: 10px;
}

.leader-row {
  gap: 8px;
  min-width: 0;
}

.rank-pill {
  display: inline-flex;
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: var(--bg-subtle);
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 950;
}

.rank-pill.hot {
  background: rgba(217, 119, 6, 0.12);
  color: #d97706;
}

.leader-row strong {
  margin-left: auto;
  font-size: 11px;
}

.spotlight {
  position: relative;
  min-height: 210px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--border-base) 84%, transparent);
  background: #0f172a;
  border-radius: var(--radius-lg);
  box-shadow: var(--card-shadow);
  transition: border-color 0.25s ease, box-shadow 0.25s ease;
}

.spotlight:hover {
  border-color: color-mix(in srgb, var(--accent) 20%, var(--border-base));
  box-shadow: var(--card-shadow-hover);
}

.spotlight-image,
.spotlight-overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.spotlight-image {
  object-fit: cover;
  transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}

.spotlight:hover .spotlight-image {
  transform: scale(1.03);
}

.spotlight-overlay {
  background:
    linear-gradient(90deg, rgba(8, 13, 24, 0.85) 0%, rgba(8, 13, 24, 0.45) 50%, rgba(8, 13, 24, 0.1) 100%),
    linear-gradient(0deg, rgba(8, 13, 24, 0.4) 0%, transparent 60%);
}

.spotlight-content,
.spotlight-empty {
  position: relative;
  z-index: 1;
  display: flex;
  height: 100%;
  max-width: 600px;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
  padding: 24px;
  color: #fff;
}

.spotlight-tag {
  width: fit-content;
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.15);
  padding: 2px 8px;
  font-size: 9px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.spotlight h1 {
  margin: 0;
  max-width: 90%;
  font-size: 21px;
  font-weight: 850;
  line-height: 1.2;
  letter-spacing: -0.2px;
}

.spotlight p {
  margin: 0;
  max-width: 85%;
  color: rgba(255, 255, 255, 0.75);
  font-size: 11px;
  font-weight: 600;
  line-height: 1.4;
}

.spotlight-button {
  width: fit-content;
  min-height: 30px;
  padding: 0 10px;
  font-size: 11px;
}

.work-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 0.92fr);
  gap: 12px;
}

.task-row,
.project-row {
  width: 100%;
  min-width: 0;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
  padding: 8px 10px;
  cursor: pointer;
  text-align: left;
  display: flex;
  align-items: center;
  gap: 10px;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.task-row:hover {
  transform: translateX(3px);
  border-color: color-mix(in srgb, var(--accent) 30%, var(--border-base));
  box-shadow: var(--shadow-card);
}

.project-row:hover {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--accent) 30%, var(--border-base));
  box-shadow: var(--shadow-card);
}

.task-row:has(.priority-URGENT),
.task-row:has(.priority-HIGH) {
  border-left: 3px solid #dc2626;
}
.task-row:has(.priority-MEDIUM) {
  border-left: 3px solid #2563eb;
}
.task-row:has(.priority-LOW) {
  border-left: 3px solid var(--text-muted);
}

.task-row:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--accent) 42%, transparent);
  outline-offset: 2px;
}

.task-state,
.feed-visual,
.project-avatar {
  display: inline-flex;
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 8px;
  background: var(--bg-card);
  color: var(--text-muted);
}

.task-main,
.project-body,
.asset-meta,
.feed-body {
  display: grid;
  min-width: 0;
  flex: 1;
}

.task-main b {
  color: #dc2626;
}

.status-green { color: #059669; }
.status-blue { color: #2563eb; }
.status-muted { color: var(--text-muted); }

.priority-pill,
.feed-badge,
.project-progress {
  flex-shrink: 0;
  border-radius: 999px;
  background: var(--bg-card);
  padding: 3px 6px;
  color: var(--text-muted);
  font-size: 9px;
  font-weight: 900;
}

.priority-URGENT,
.priority-HIGH {
  background: rgba(220, 38, 38, 0.1);
  color: #dc2626;
}

.complete-command {
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  color: #059669;
}

.project-avatar {
  color: #fff;
  font-weight: 950;
  text-transform: uppercase;
  background: linear-gradient(135deg, var(--accent) 0%, #059669 100%);
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.project-title {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: baseline;
}

.progress-line {
  height: 5px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--bg-subtle);
  margin-top: 5px;
}

.progress-line i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #2563eb, #059669);
}

.asset-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  padding: 10px;
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
}

.asset-item:hover {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--accent) 30%, var(--border-base));
  box-shadow: var(--shadow-card-hover);
}

.asset-thumb {
  width: 100%;
  height: 100%;
  border-radius: 0;
  background: linear-gradient(135deg, rgba(37, 99, 235, 0.1) 0%, rgba(245, 121, 42, 0.1) 100%);
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
  background: rgba(15, 23, 42, 0.75);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  padding: 6px 8px;
  color: #fff;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  display: grid;
  gap: 1px;
  min-width: 0;
  pointer-events: none;
}

.asset-meta strong {
  color: #fff !important;
  font-size: 10px !important;
  line-height: 1.2;
  font-weight: 800;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.asset-meta small {
  color: rgba(255, 255, 255, 0.7) !important;
  font-size: 8px !important;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.feed-list {
  position: relative;
  display: grid;
  gap: 8px;
  padding: 10px;
}

.feed-list::before {
  content: "";
  position: absolute;
  top: 14px;
  bottom: 14px;
  left: 27px;
  width: 1px;
  border-left: 1px dashed var(--border-base);
  pointer-events: none;
  z-index: 0;
}

.dark .feed-list::before {
  border-left-color: rgba(255, 255, 255, 0.12);
}

.feed-row {
  z-index: 1;
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px;
  border: 1px solid transparent;
  border-radius: 8px;
  transition: all 0.2s ease;
  cursor: pointer;
}

.feed-row:hover {
  background: var(--bg-hover);
  border-color: var(--border-base);
  transform: translateX(2px);
}

.feed-visual img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.feed-body span {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: baseline;
}

.live-label {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #059669;
  font-size: 9px;
  font-weight: 950;
}

.live-label i {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: #059669;
  box-shadow: 0 0 0 4px rgba(5, 150, 105, 0.12);
}

.momentum-panel {
  margin-top: 0;
  padding: 10px;
}

.momentum-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.empty-panel {
  display: flex;
  flex: 1;
  min-height: 150px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 850;
}

.empty-panel.compact {
  min-height: 96px;
}

.dashboard-date-picker :deep(.el-input__wrapper) {
  border: 1px solid var(--border-base) !important;
  border-radius: 8px !important;
  background: var(--bg-subtle) !important;
  box-shadow: none !important;
}

@media (max-width: 1200px) {
  .dashboard-grid-layout {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .ops-workbench {
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
  .dashboard-topbar {
    align-items: stretch;
    flex-direction: column;
    padding: 8px 10px;
  }

  .topbar-actions {
    width: 100%;
    flex-wrap: wrap;
  }

  .dashboard-date-picker,
  .primary-command,
  .secondary-command {
    flex: 1;
    min-width: 140px;
  }

  .dashboard-scroll {
    padding: 8px;
  }

  .metric-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .metric-tile {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .metric-trend {
    display: none;
  }

  .ops-workbench {
    grid-template-columns: 1fr;
  }

  .ops-metrics,
  .pipe-grid,
  .asset-grid,
  .quick-grid,
  .momentum-panel {
    grid-template-columns: 1fr;
  }

  .spotlight h1 {
    font-size: 18px;
  }
}
</style>

<style>
.custom-date-popper {
  overflow: hidden !important;
  border: 1px solid var(--border-base) !important;
  border-radius: 8px !important;
  box-shadow: var(--card-shadow-hover) !important;
}

.custom-date-popper .el-picker-panel {
  border: none !important;
}
</style>
