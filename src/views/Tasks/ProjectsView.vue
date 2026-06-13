<script setup lang="ts">
import { computed, h, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Eye,
  EyeOff,
  FolderPlus,
  KanbanSquare,
  Layers,
  LayoutGrid,
  List,
  ListTodo,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '@/utils/api';
import { useWorkspaceStore } from '@/stores/workspace';
import UserAvatar from '@/components/UserAvatar.vue';
import type { Project, Task, UserType } from '@/types/task';
import ProjectDetailPanel from './components/ProjectDetailPanel.vue';
import ProjectFormPanel from './components/ProjectFormPanel.vue';

type ProjectStatusFilter = 'ALL' | 'PLANNED' | 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED';
type FocusFilter = 'all' | 'attention' | 'dueSoon' | 'unassigned';
type ViewMode = 'grid' | 'list';

interface ProjectDetailPanelExpose {
  open: (projectId: string) => Promise<void> | void;
}

interface ProjectFormPanelExpose {
  openAdd: () => void;
  openEdit: (project: Project) => void;
}

interface TeamMemberResponse {
  user: UserType;
}

interface OverviewCounts {
  members: number;
  admins: number;
  pendingInvitations: number;
  pendingApplications: number;
  projects: number;
  activeProjects: number;
  completedProjects: number;
  tasks: number;
  todoTasks: number;
  inProgressTasks: number;
  doneTasks: number;
  overdueTasks: number;
  dueSoonTasks: number;
  unassignedTasks: number;
  completedThisWeek: number;
  averageProjectProgress: number;
  assets: number;
  materials: number;
  showcases: number;
}

interface OverviewProject {
  id: string;
  title: string;
  status: string;
  progress: number;
  dueDate?: string | null;
  membersCount: number;
  tasks: {
    total: number;
    todo: number;
    inProgress: number;
    done: number;
    overdue: number;
    dueSoon: number;
    unassigned: number;
    completionRate: number;
  };
}

interface TeamOverview {
  team: {
    id: string;
    name: string;
    type: 'PERSONAL' | 'TEAM';
  };
  counts: OverviewCounts;
  projects: OverviewProject[];
  tasks: {
    dueSoon: Task[];
    overdue: Task[];
    recentlyUpdated: Task[];
  };
}

interface InsightUser {
  id: string;
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
}

interface InsightActionItem {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium';
  title: string;
  description: string;
  dueDate?: string | null;
  projectId?: string | null;
  assignee?: InsightUser | null;
  targetRoute: string;
}

interface InsightActivityItem {
  id: string;
  type: string;
  title: string;
  description: string;
  actor?: InsightUser | null;
  createdAt: string;
  targetRoute: string;
}

interface InsightProjectHealth {
  id: string;
  title: string;
  healthScore: number;
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  reasons: string[];
  overdueTasks: number;
  dueSoonTasks: number;
  unassignedTasks: number;
}

interface InsightOperationalLane {
  key: 'overdue' | 'unassigned' | 'dueSoon' | 'riskProjects';
  label: string;
  count: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  targetRoute: string;
}

interface InsightRecommendedAssignee {
  user: InsightUser;
  capacityScore: number;
  activeTasks: number;
  overdueTasks: number;
  completedThisWeek: number;
  reason: string;
}

interface TeamCollaborationInsights {
  generatedAt?: string;
  summary: {
    healthScore: number;
    completedThisWeek: number;
    overdueTasks: number;
    dueSoonTasks: number;
    unassignedTasks: number;
    highRiskProjects: number;
    averageProjectProgress: number;
  };
  projectHealth: InsightProjectHealth[];
  memberCapacity?: unknown[];
  recommendedAssignee?: InsightRecommendedAssignee | null;
  operationalLanes?: InsightOperationalLane[];
  actionItems: InsightActionItem[];
  activity: InsightActivityItem[];
}

const workspaceStore = useWorkspaceStore();
const route = useRoute();
const router = useRouter();

const searchQuery = ref('');
const isStatsExpanded = ref(false);
const viewMode = ref<ViewMode>((localStorage.getItem('team_project_view_mode') as ViewMode) || 'grid');
const statusFilter = ref<ProjectStatusFilter>('ALL');
const focusFilter = ref<FocusFilter>('all');
const projects = ref<Project[]>([]);
const tasks = ref<Task[]>([]);
const overview = ref<TeamOverview | null>(null);
const insights = ref<TeamCollaborationInsights | null>(null);
const isLoading = ref(true);
const isRefreshing = ref(false);
const isCreatingTask = ref(false);
const isCreatingSeedTasks = ref(false);
const resolvingActionId = ref('');
const lastSyncedAt = ref<Date | null>(null);

const activeSidebarTab = ref<'dispatch' | 'risk' | 'team'>('dispatch');
const sidebarTabs = [
  { value: 'dispatch', label: '任务派发', icon: Zap },
  { value: 'risk', label: '风险与交付', icon: Target },
  { value: 'team', label: '团队与动态', icon: Users },
] as const;

const quickTaskTitle = ref('');
const quickTaskProjectId = ref('');
const quickTaskAssigneeId = ref('');
const quickTaskPriority = ref<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM');
const quickTaskDueDate = ref('');

const projectDetailPanelRef = ref<ProjectDetailPanelExpose | null>(null);
const projectFormPanelRef = ref<ProjectFormPanelExpose | null>(null);

const teamMembers = ref<UserType[]>([]);
const statusOptions = [
  { value: 'ALL', label: '全部' },
  { value: 'PLANNED', label: '规划中' },
  { value: 'IN_PROGRESS', label: '推进中' },
  { value: 'PAUSED', label: '已暂停' },
  { value: 'COMPLETED', label: '已完成' },
] as const;

const focusOptions = [
  { value: 'all', label: '全部项目', icon: Layers },
  { value: 'attention', label: '需要关注', icon: AlertTriangle },
  { value: 'dueSoon', label: '即将到期', icon: CalendarClock },
  { value: 'unassigned', label: '待分配', icon: Users },
] as const;

const priorityOptions = [
  { value: 'LOW', label: '低', class: 'bg-slate-400' },
  { value: 'MEDIUM', label: '中', class: 'bg-amber-500' },
  { value: 'HIGH', label: '高', class: 'bg-orange-500' },
  { value: 'URGENT', label: '紧急', class: 'bg-rose-500' },
] as const;

const quickSeedTemplates = [
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

const projectTaskMap = computed(() => {
  const map = new Map<string, Task[]>();
  for (const task of tasks.value) {
    if (!task.projectId) continue;
    const list = map.get(task.projectId) || [];
    list.push(task);
    map.set(task.projectId, list);
  }
  return map;
});

const nowTime = () => Date.now();

const isOverdue = (task: Task) => {
  return task.status !== 'DONE' && !!task.dueDate && new Date(task.dueDate).getTime() < nowTime();
};

const isDueSoon = (task: Task) => {
  if (task.status === 'DONE' || !task.dueDate) return false;
  const dueTime = new Date(task.dueDate).getTime();
  return dueTime >= nowTime() && dueTime <= nowTime() + 7 * 24 * 60 * 60 * 1000;
};

const getProjectTaskStats = (projectId: string) => {
  const list = projectTaskMap.value.get(projectId) || [];
  const done = list.filter((task) => task.status === 'DONE').length;
  const overdue = list.filter(isOverdue).length;
  const dueSoon = list.filter(isDueSoon).length;
  const unassigned = list.filter((task) => task.status !== 'DONE' && !task.assigneeId).length;
  return {
    total: list.length,
    done,
    todo: list.filter((task) => task.status === 'TODO').length,
    inProgress: list.filter((task) => task.status === 'IN_PROGRESS').length,
    overdue,
    dueSoon,
    unassigned,
    completionRate: list.length ? Math.round((done / list.length) * 100) : 0,
  };
};

const getDaysLeft = (dueDate?: string | null) => {
  if (!dueDate) return null;
  return Math.ceil((new Date(dueDate).getTime() - nowTime()) / (24 * 60 * 60 * 1000));
};

const getProjectHealth = (project: Project) => {
  const stats = getProjectTaskStats(project.id);
  const daysLeft = getDaysLeft(project.dueDate);

  if (project.status === 'COMPLETED') {
    return { label: '已收尾', class: 'bg-emerald-500/10 text-emerald-600', level: 1 };
  }
  if (stats.overdue > 0 || (daysLeft !== null && daysLeft < 0)) {
    return { label: '逾期风险', class: 'bg-rose-500/10 text-rose-600', level: 4 };
  }
  if (stats.unassigned > 0 || (daysLeft !== null && daysLeft <= 7 && (project.progress || 0) < 70)) {
    return { label: '需要推进', class: 'bg-amber-500/10 text-amber-600', level: 3 };
  }
  if (project.status === 'PAUSED') {
    return { label: '暂停观察', class: 'bg-slate-500/10 text-slate-500', level: 2 };
  }
  return { label: '节奏稳定', class: 'bg-sky-500/10 text-sky-600', level: 1 };
};

const projectStats = computed(() => {
  const total = projects.value.length;
  const active = projects.value.filter((p) => p.status === 'IN_PROGRESS').length;
  const completed = projects.value.filter((p) => p.status === 'COMPLETED').length;
  const completionRate = total ? Math.round((completed / total) * 100) : 0;
  const averageProgress = total
    ? Math.round(projects.value.reduce((sum, project) => sum + (project.progress || 0), 0) / total)
    : 0;
  return { total, active, completed, completionRate, averageProgress };
});

const taskStats = computed(() => {
  const total = tasks.value.length;
  const done = tasks.value.filter((task) => task.status === 'DONE').length;
  const overdue = tasks.value.filter(isOverdue).length;
  const dueSoon = tasks.value.filter(isDueSoon).length;
  const unassigned = tasks.value.filter((task) => task.status !== 'DONE' && !task.assigneeId).length;
  return {
    total,
    done,
    overdue,
    dueSoon,
    unassigned,
    completionRate: total ? Math.round((done / total) * 100) : 0,
  };
});

const projectRows = computed(() => {
  return projects.value.map((project) => ({
    project,
    taskStats: getProjectTaskStats(project.id),
    health: getProjectHealth(project),
    daysLeft: getDaysLeft(project.dueDate),
  }));
});

const filteredProjectRows = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();

  return projectRows.value
    .filter(({ project, taskStats }) => {
      const tags = project.tags ? project.tags.toLowerCase() : '';
      const matchesSearch =
        !query ||
        project.title.toLowerCase().includes(query) ||
        (project.description || '').toLowerCase().includes(query) ||
        tags.includes(query);
      const matchesStatus = statusFilter.value === 'ALL' || project.status === statusFilter.value;
      const matchesFocus =
        focusFilter.value === 'all' ||
        (focusFilter.value === 'attention' && getProjectHealth(project).level >= 3) ||
        (focusFilter.value === 'dueSoon' && taskStats.dueSoon > 0) ||
        (focusFilter.value === 'unassigned' && taskStats.unassigned > 0);

      return matchesSearch && matchesStatus && matchesFocus;
    })
    .sort((a, b) => {
      if (b.health.level !== a.health.level) return b.health.level - a.health.level;
      return (b.project.updatedAt ? new Date(b.project.updatedAt).getTime() : 0) - (a.project.updatedAt ? new Date(a.project.updatedAt).getTime() : 0);
    });
});

const attentionProjects = computed(() => projectRows.value.filter((row) => row.health.level >= 3).slice(0, 5));

const dueSoonTasks = computed(() => {
  const source = overview.value?.tasks.dueSoon || tasks.value.filter(isDueSoon);
  return source.slice(0, 6);
});

const overdueTasks = computed(() => {
  const source = overview.value?.tasks.overdue || tasks.value.filter(isOverdue);
  return source.slice(0, 6);
});

const insightSummary = computed(() => insights.value?.summary || null);
const healthScore = computed(() => insightSummary.value?.healthScore ?? taskStats.value.completionRate);
const actionItems = computed(() => insights.value?.actionItems || []);
const activityItems = computed(() => insights.value?.activity || []);
const insightRiskProjects = computed(() => insights.value?.projectHealth.filter((project) => project.riskLevel !== 'LOW') || []);
const operationalLanes = computed(() => insights.value?.operationalLanes || []);
const recommendedAssignee = computed(() => insights.value?.recommendedAssignee || null);

const projectHealthById = computed(() => {
  const map = new Map<string, InsightProjectHealth>();
  for (const project of insights.value?.projectHealth || []) {
    map.set(project.id, project);
  }
  return map;
});

const allWorkloadRows = computed(() => {
  return teamMembers.value
    .map((member) => {
      const assigned = tasks.value.filter((task) => task.assigneeId === member.id);
      const active = assigned.filter((task) => task.status !== 'DONE').length;
      const done = assigned.filter((task) => task.status === 'DONE').length;
      return {
        member,
        assigned: assigned.length,
        active,
        done,
        overdue: assigned.filter(isOverdue).length,
        rate: assigned.length ? Math.round((done / assigned.length) * 100) : 0,
      };
    })
    .sort((a, b) => {
      if (b.active !== a.active) return b.active - a.active;
      return b.overdue - a.overdue;
    });
});

const workloadRows = computed(() => allWorkloadRows.value.slice(0, 6));

const recommendedWorkload = computed(() => {
  return allWorkloadRows.value
    .slice()
    .sort((a, b) => {
      if (a.overdue !== b.overdue) return a.overdue - b.overdue;
      if (a.active !== b.active) return a.active - b.active;
      return b.rate - a.rate;
    })[0];
});

const dataFreshnessLabel = computed(() =>
  lastSyncedAt.value
    ? lastSyncedAt.value.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    : '未同步',
);

const recommendedAssigneeName = computed(() => {
  const backendUser = recommendedAssignee.value?.user;
  if (backendUser) return backendUser.name || backendUser.email || '推荐成员';
  return recommendedWorkload.value?.member.name || recommendedWorkload.value?.member.email || '推荐成员';
});

const selectedAssigneeWorkload = computed(() => {
  if (!quickTaskAssigneeId.value) return recommendedWorkload.value;
  return allWorkloadRows.value.find((row) => row.member.id === quickTaskAssigneeId.value);
});

const selectedQuickProject = computed(() => {
  return projects.value.find((project) => project.id === quickTaskProjectId.value) || null;
});

const selectedQuickProjectStats = computed(() => {
  if (!quickTaskProjectId.value) return null;
  return getProjectTaskStats(quickTaskProjectId.value);
});

const activeWorkspaceName = computed(() => workspaceStore.currentWorkspace?.name || '团队工作区');

const compactMetrics = computed(() => {
  const averageProgress = insightSummary.value?.averageProjectProgress ?? projectStats.value.averageProgress;
  const overdueCount = insightSummary.value?.overdueTasks ?? taskStats.value.overdue;
  const dueSoonCount = insightSummary.value?.dueSoonTasks ?? taskStats.value.dueSoon;
  const unassignedCount = insightSummary.value?.unassignedTasks ?? taskStats.value.unassigned;

  return [
    {
      label: '总项目',
      value: projectStats.value.total,
      caption: `推进 ${projectStats.value.active}`,
      icon: Layers,
      colorClass: 'text-blue-500',
      barClass: 'bg-blue-500',
      progress: projectStats.value.total ? Math.round((projectStats.value.active / projectStats.value.total) * 100) : 0,
      filter: 'all' as FocusFilter,
    },
    {
      label: '平均进度',
      value: `${averageProgress}%`,
      caption: `完成 ${projectStats.value.completed}`,
      icon: TrendingUp,
      colorClass: 'text-emerald-500',
      barClass: 'bg-emerald-500',
      progress: averageProgress,
      filter: 'all' as FocusFilter,
    },
    {
      label: '任务完成',
      value: `${taskStats.value.completionRate}%`,
      caption: `${taskStats.value.done}/${taskStats.value.total}`,
      icon: CheckCircle2,
      colorClass: 'text-emerald-500',
      barClass: 'bg-emerald-500',
      progress: taskStats.value.completionRate,
      filter: 'all' as FocusFilter,
    },
    {
      label: '逾期',
      value: overdueCount,
      caption: `提醒 ${overdueTasks.value.length}`,
      icon: AlertTriangle,
      colorClass: 'text-rose-500',
      barClass: 'bg-rose-500',
      progress: Math.min(100, overdueCount * 14),
      filter: 'attention' as FocusFilter,
    },
    {
      label: '7天到期',
      value: dueSoonCount,
      caption: '交付节奏',
      icon: CalendarClock,
      colorClass: 'text-amber-500',
      barClass: 'bg-amber-500',
      progress: Math.min(100, dueSoonCount * 14),
      filter: 'dueSoon' as FocusFilter,
    },
    {
      label: '待分配',
      value: unassignedCount,
      caption: '明确负责人',
      icon: Users,
      colorClass: 'text-sky-500',
      barClass: 'bg-sky-500',
      progress: Math.min(100, unassignedCount * 8),
      filter: 'unassigned' as FocusFilter,
    },
  ];
});

const compactPulse = computed(() => ({
  completedThisWeek: insightSummary.value?.completedThisWeek ?? overview.value?.counts.completedThisWeek ?? 0,
  highRiskProjects: insightSummary.value?.highRiskProjects ?? attentionProjects.value.length,
}));

const fetchProjects = async () => {
  const response = await api.get('/api/projects');
  projects.value = response.data;
};

const fetchTasks = async () => {
  const response = await api.get('/api/tasks');
  tasks.value = response.data;
};

const fetchTeamOverview = async () => {
  const teamId = workspaceStore.activeTeamId;
  if (!teamId) {
    overview.value = null;
    return;
  }
  const response = await api.get(`/api/teams/${teamId}/overview`);
  overview.value = response.data;
};

const fetchCollaborationInsights = async () => {
  const teamId = workspaceStore.activeTeamId;
  if (!teamId) {
    insights.value = null;
    return;
  }
  const response = await api.get(`/api/teams/${teamId}/collaboration-insights`);
  insights.value = response.data;
};

const fetchTeamMembers = async (teamId?: string) => {
  const tid = teamId || workspaceStore.activeTeamId;
  if (!tid) {
    teamMembers.value = [];
    return;
  }
  const response = await api.get(`/api/teams/${tid}/members`);
  teamMembers.value = ((response.data || []) as TeamMemberResponse[]).map((m) => m.user);
};

const fetchAll = async (options: { silent?: boolean } = {}) => {
  if (!options.silent) isLoading.value = true;
  try {
    await Promise.all([
      fetchProjects(),
      fetchTasks(),
      fetchTeamMembers(),
      fetchTeamOverview(),
      fetchCollaborationInsights(),
    ]);
    lastSyncedAt.value = new Date();
    return true;
  } catch {
    ElMessage.error('团队项目数据加载失败');
    return false;
  } finally {
    if (!options.silent) isLoading.value = false;
  }
};

const refreshWorkstationData = async () => {
  await Promise.all([fetchTasks(), fetchProjects(), fetchTeamOverview(), fetchCollaborationInsights()]);
  lastSyncedAt.value = new Date();
};

const handleManualRefresh = async () => {
  isRefreshing.value = true;
  try {
    const ok = await fetchAll({ silent: true });
    if (ok) ElMessage.success('协作数据已同步');
  } finally {
    isRefreshing.value = false;
  }
};

const openAddDrawer = () => {
  projectFormPanelRef.value?.openAdd();
};

const openEditDrawer = (project: Project) => {
  projectFormPanelRef.value?.openEdit(project);
};

const handleProjectClick = (projectId: string) => {
  projectDetailPanelRef.value?.open(projectId);
};

const setViewMode = (mode: ViewMode) => {
  viewMode.value = mode;
  localStorage.setItem('team_project_view_mode', mode);
};

const navigateToTaskBoard = (projectId?: string | null) => {
  router.push({ name: 'TaskBoard', query: projectId ? { projectId } : {} });
};

const toDueDateIso = (dateValue: string, fallbackDays?: number) => {
  const date = dateValue
    ? new Date(`${dateValue}T18:00:00`)
    : new Date(Date.now() + (fallbackDays || 0) * 24 * 60 * 60 * 1000);

  if (!dateValue) {
    date.setHours(18, 0, 0, 0);
  }

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const selectRecommendedAssignee = () => {
  const backendUserId = recommendedAssignee.value?.user.id;
  if (backendUserId && teamMembers.value.some((member) => member.id === backendUserId)) {
    quickTaskAssigneeId.value = backendUserId;
    return;
  }

  if (!recommendedWorkload.value) {
    ElMessage.warning('当前没有可分配成员');
    return;
  }
  quickTaskAssigneeId.value = recommendedWorkload.value.member.id;
};

const createQuickTask = async () => {
  if (!quickTaskTitle.value.trim()) {
    ElMessage.warning('先写一个任务标题');
    return;
  }

  isCreatingTask.value = true;
  try {
    await api.post('/api/tasks', {
      title: quickTaskTitle.value.trim(),
      status: 'TODO',
      priority: quickTaskPriority.value,
      projectId: quickTaskProjectId.value || null,
      assigneeId: quickTaskAssigneeId.value || null,
      dueDate: quickTaskDueDate.value ? toDueDateIso(quickTaskDueDate.value) : null,
    });
    quickTaskTitle.value = '';
    quickTaskDueDate.value = '';
    ElMessage.success('任务已加入看板');
    await refreshWorkstationData();
  } catch {
    ElMessage.error('任务创建失败');
  } finally {
    isCreatingTask.value = false;
  }
};

const createSeedTasks = async (template: (typeof quickSeedTemplates)[number]) => {
  if (!quickTaskProjectId.value) {
    ElMessage.warning('先选择一个项目，再生成任务包');
    return;
  }

  isCreatingSeedTasks.value = true;
  try {
    const assigneeId =
      quickTaskAssigneeId.value || recommendedAssignee.value?.user.id || recommendedWorkload.value?.member.id || null;
    const response = await api.post('/api/tasks/batch', {
      tasks: template.tasks.map((task) => ({
        title: task.title,
        description: `${template.label} · ${template.hint}`,
        status: 'TODO',
        priority: task.priority,
        projectId: quickTaskProjectId.value,
        assigneeId,
        dueDate: toDueDateIso('', task.days),
      })),
    });
    ElMessage.success(`已生成 ${response.data?.count || template.tasks.length} 个项目任务`);
    await refreshWorkstationData();
  } catch {
    ElMessage.error('任务包生成失败');
  } finally {
    isCreatingSeedTasks.value = false;
  }
};

const getActionTaskId = (item: InsightActionItem) => {
  return item.id.replace(/^task-(overdue|unassigned|due)-/, '');
};

const assignActionToRecommended = async (item: InsightActionItem) => {
  if (item.type !== 'TASK_UNASSIGNED') {
    navigateInsight(item.targetRoute);
    return;
  }

  const assigneeId = recommendedAssignee.value?.user.id || recommendedWorkload.value?.member.id;
  if (!assigneeId) {
    ElMessage.warning('当前没有可分配成员');
    return;
  }

  const task = tasks.value.find((candidate) => candidate.id === getActionTaskId(item));
  if (!task) {
    navigateInsight(item.targetRoute);
    return;
  }

  resolvingActionId.value = item.id;
  try {
    await api.put(`/api/tasks/${task.id}`, {
      assigneeId,
    });
    ElMessage.success(`已派给 ${recommendedAssigneeName.value}`);
    await refreshWorkstationData();
  } catch {
    ElMessage.error('自动派发失败');
  } finally {
    resolvingActionId.value = '';
  }
};

const deleteProject = (id: string) => {
  const deleteTasks = ref(true);
  const deleteRoadmap = ref(true);

  const confirmContent = h('div', { class: 'space-y-3 py-1' }, [
    h('p', { class: 'text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium' }, '删除项目后，相关协作数据会同步处理。'),
    h('div', { class: 'space-y-2 border-t pt-3 border-slate-100 dark:border-white/10' }, [
      h('label', { class: 'flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer select-none' }, [
        h('input', {
          type: 'checkbox',
          checked: deleteTasks.value,
          onChange: (event: Event) => {
            deleteTasks.value = (event.target as HTMLInputElement).checked;
          },
          class: 'rounded border-slate-300 text-accent focus:ring-accent w-3.5 h-3.5 cursor-pointer',
        }),
        h('span', '同时删除关联任务'),
      ]),
      h('label', { class: 'flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer select-none' }, [
        h('input', {
          type: 'checkbox',
          checked: deleteRoadmap.value,
          onChange: (event: Event) => {
            deleteRoadmap.value = (event.target as HTMLInputElement).checked;
          },
          class: 'rounded border-slate-300 text-accent focus:ring-accent w-3.5 h-3.5 cursor-pointer',
        }),
        h('span', '同时删除学习路线'),
      ]),
    ]),
  ]);

  ElMessageBox.confirm(confirmContent, '删除项目', {
    confirmButtonText: '确认删除',
    cancelButtonText: '取消',
    confirmButtonClass: 'el-button--danger',
  })
    .then(async () => {
      try {
        await api.delete(`/api/projects/${id}`, {
          params: {
            deleteTasks: deleteTasks.value,
            deleteRoadmap: deleteRoadmap.value,
          },
        });
        ElMessage.success('项目已删除');
        await refreshWorkstationData();
      } catch {
        ElMessage.error('删除失败');
      }
    })
    .catch(() => {});
};

const formatDate = (value?: string | null) => {
  if (!value) return '未设置';
  return new Date(value).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
};

const formatRelativeTime = (value?: string | null) => {
  if (!value) return '刚刚';
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.floor(diff / 60000));
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
};

const severityClass = (severity: InsightActionItem['severity']) => {
  if (severity === 'critical') return 'bg-rose-500/10 text-rose-600';
  if (severity === 'high') return 'bg-amber-500/10 text-amber-600';
  return 'bg-sky-500/10 text-sky-600';
};


const activityDotClass = (type: string) => {
  if (type === 'TASK') return 'bg-amber-500';
  if (type === 'DISCUSSION') return 'bg-sky-500';
  if (type === 'APPLICATION' || type === 'INVITATION') return 'bg-purple-500';
  return 'bg-emerald-500';
};

const navigateInsight = (targetRoute?: string) => {
  if (targetRoute) router.push(targetRoute);
};

const activateOperationalLane = (lane: InsightOperationalLane) => {
  if (lane.key === 'unassigned') {
    focusFilter.value = 'unassigned';
  } else if (lane.key === 'dueSoon') {
    focusFilter.value = 'dueSoon';
  } else if (lane.key === 'overdue' || lane.key === 'riskProjects') {
    focusFilter.value = 'attention';
  }
};

onMounted(() => {
  fetchAll();
  if (route.query.openCreate === 'true') {
    openAddDrawer();
  }
});

watch(
  () => workspaceStore.activeTeamId,
  () => {
    fetchAll();
  },
);
</script>

<template>
  <div class="team-projects flex-1 flex flex-col h-full overflow-hidden" style="background-color: var(--bg-app)">
    <div
      class="shrink-0 border-b px-3 sm:px-5 lg:px-6 py-2"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <div class="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="p-1.5 bg-accent/10 rounded-lg border border-accent/15 shrink-0">
            <Layers class="w-4 h-4 text-accent" />
          </div>
          <div class="min-w-0">
            <h1 class="text-base sm:text-lg font-black truncate" style="color: var(--text-primary)">
              项目空间
            </h1>
            <p class="text-[10px] sm:text-xs font-medium truncate" style="color: var(--text-muted)">
              {{ activeWorkspaceName }} · {{ projectStats.total }} 个项目 · {{ taskStats.total }} 个任务 · 同步 {{ dataFreshnessLabel }}
            </p>
          </div>
        </div>

        <div class="flex flex-col sm:flex-row sm:items-center gap-2 xl:justify-end">
          <div class="relative min-w-0">
            <Search class="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="搜索项目、描述、标签"
              class="w-full sm:w-72 pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800/50 border rounded-lg text-xs outline-none focus:ring-2 focus:ring-accent/15 focus:border-accent transition-all"
              style="border-color: var(--border-base); color: var(--text-primary)"
            />
          </div>

          <div class="flex items-center gap-2">
            <button
              type="button"
              class="h-8 px-2.5 rounded-lg bg-slate-100 dark:bg-white/5 text-xs font-black border-none cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
              style="color: var(--text-primary)"
              :disabled="isRefreshing"
              @click="handleManualRefresh"
            >
              <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': isRefreshing }" />
              同步
            </button>
            <button
              type="button"
              class="h-8 px-2.5 rounded-lg bg-slate-100 dark:bg-white/5 text-xs font-black border-none cursor-pointer flex items-center gap-1.5"
              style="color: var(--text-primary)"
              @click="isStatsExpanded = !isStatsExpanded"
            >
              <component :is="isStatsExpanded ? EyeOff : Eye" class="w-3.5 h-3.5" />
              {{ isStatsExpanded ? '收起指标' : '数据指标' }}
            </button>
            <button
              type="button"
              class="h-8 px-2.5 rounded-lg bg-slate-100 dark:bg-white/5 text-xs font-black border-none cursor-pointer flex items-center gap-1.5"
              style="color: var(--text-primary)"
              @click="navigateToTaskBoard()"
            >
              <KanbanSquare class="w-3.5 h-3.5" />
              看板
            </button>
            <button
              type="button"
              class="h-8 px-2.5 rounded-lg bg-accent text-white text-xs font-black border-none cursor-pointer flex items-center gap-1.5 shadow-lg shadow-accent/20"
              @click="openAddDrawer"
            >
              <FolderPlus class="w-3.5 h-3.5" />
              新项目
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto scrollbar-hide">
      <div v-if="isLoading" class="h-full flex flex-col items-center justify-center opacity-60">
        <div class="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin mb-3"></div>
        <p class="text-xs font-bold text-slate-400">正在整理团队项目数据</p>
      </div>

      <template v-else>
        <div class="p-2.5 sm:p-3 lg:p-4 space-y-3">
          <div
            v-show="isStatsExpanded"
            class="compact-ops-bar rounded-xl border p-2.5"
            style="background-color: var(--bg-card); border-color: var(--border-base)"
          >
            <div class="grid grid-cols-1 lg:grid-cols-[220px_1fr_320px] 2xl:grid-cols-[240px_1fr_360px] gap-2.5 items-stretch">
              <!-- Left Health Score Card -->
              <div class="rounded-xl bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent p-2.5 flex flex-col justify-between border border-emerald-500/15 relative overflow-hidden group">
                <div class="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-emerald-500/10 blur-xl group-hover:scale-125 transition-all duration-500"></div>
                <div class="flex items-center justify-between gap-2 z-10">
                  <div class="flex items-center gap-1 min-w-0">
                    <div class="p-0.5 bg-emerald-500/20 rounded">
                      <BarChart3 class="w-3 h-3 text-emerald-500 shrink-0" />
                    </div>
                    <span class="text-[11px] font-black truncate" style="color: var(--text-primary)">运营健康</span>
                  </div>
                  <span class="px-1.5 py-0.5 rounded-full text-[8px] font-black shrink-0" :class="healthScore >= 80 ? 'bg-emerald-500/10 text-emerald-600' : healthScore >= 60 ? 'bg-amber-500/10 text-amber-600' : 'bg-rose-500/10 text-rose-600'">
                    {{ healthScore >= 80 ? '稳定' : healthScore >= 60 ? '压测中' : '需接管' }}
                  </span>
                </div>
                <div class="my-1.5 flex items-baseline gap-1 z-10">
                  <strong class="text-2xl font-black tracking-tight" style="color: var(--text-primary)">{{ healthScore }}</strong>
                  <span class="text-[9px] font-bold text-slate-400">/100</span>
                </div>
                <div class="space-y-1 z-10">
                  <div class="flex items-center justify-between text-[9px] font-bold text-slate-400">
                    <span>本周已交: {{ compactPulse.completedThisWeek }}</span>
                    <span>风险项目: {{ compactPulse.highRiskProjects }}</span>
                  </div>
                  <div class="h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      class="h-full rounded-full transition-all duration-500"
                      :class="healthScore >= 80 ? 'bg-emerald-500' : healthScore >= 60 ? 'bg-amber-500' : 'bg-rose-500'"
                      :style="{ width: healthScore + '%' }"
                    ></div>
                  </div>
                </div>
              </div>

              <!-- Center Metric Grid -->
              <div class="compact-metric-grid grid grid-cols-2 sm:grid-cols-3 gap-2">
                <button
                  v-for="metric in compactMetrics"
                  :key="metric.label"
                  type="button"
                  class="min-h-[52px] rounded-xl bg-slate-50/60 dark:bg-white/5 border border-slate-100 dark:border-white/5 p-2 text-left cursor-pointer hover:border-accent/30 hover:bg-accent/5 hover:scale-[1.01] active:scale-[0.99] transition-all flex flex-col justify-between"
                  :class="focusFilter === metric.filter ? 'border-accent/50 bg-accent/5 ring-1 ring-accent/20' : ''"
                  @click="focusFilter = metric.filter"
                >
                  <div class="flex items-center justify-between gap-2 w-full">
                    <span class="text-[9.5px] font-black text-slate-400 truncate">{{ metric.label }}</span>
                    <div class="p-0.5 rounded bg-white dark:bg-slate-900 shadow-sm shrink-0">
                      <component :is="metric.icon" class="w-3 h-3 shrink-0" :class="metric.colorClass" />
                    </div>
                  </div>
                  <div class="mt-0.5 flex items-baseline justify-between gap-1 w-full">
                    <strong class="text-sm leading-none font-black" style="color: var(--text-primary)">{{ metric.value }}</strong>
                    <span class="text-[8.5px] font-black text-slate-400 truncate">{{ metric.caption }}</span>
                  </div>
                </button>
              </div>

              <!-- Right Next Actions Card -->
              <div class="rounded-xl bg-slate-50/60 dark:bg-white/5 border border-slate-100 dark:border-white/5 p-2.5 flex flex-col justify-between">
                <div class="flex items-center justify-between gap-2 mb-1.5">
                  <div class="flex items-center gap-1 min-w-0">
                    <div class="p-0.5 bg-amber-500/10 rounded">
                      <ListTodo class="w-3 h-3 text-amber-500 shrink-0" />
                    </div>
                    <span class="text-[11px] font-black truncate" style="color: var(--text-primary)">阻塞与预警</span>
                  </div>
                  <button
                    type="button"
                    class="text-[9.5px] font-black text-accent hover:text-accent-hover bg-transparent border-none cursor-pointer shrink-0 transition-colors"
                    @click="navigateToTaskBoard()"
                  >
                    看板
                  </button>
                </div>
                
                <div v-if="actionItems.length === 0" class="flex-1 flex items-center justify-center text-[9px] font-bold text-slate-400 min-h-[36px]">
                  暂无阻塞动作
                </div>
                <div v-else class="space-y-1 flex-1">
                  <div
                    v-for="item in actionItems.slice(0, 2)"
                    :key="item.id"
                    class="w-full h-6 flex items-center gap-1 rounded-lg bg-white dark:bg-slate-900/60 border border-slate-100 dark:border-white/5 px-1.5 text-left hover:bg-accent/5 hover:border-accent/20 transition-all"
                  >
                    <span class="px-1 py-0.5 rounded text-[7.5px] font-black shrink-0" :class="severityClass(item.severity)">
                      {{ item.severity === 'critical' ? '特急' : item.severity === 'high' ? '高急' : '中急' }}
                    </span>
                    <span class="min-w-0 flex-1 text-[9.5px] font-black truncate" style="color: var(--text-primary)">{{ item.title }}</span>
                    <button
                      v-if="item.type === 'TASK_UNASSIGNED'"
                      type="button"
                      class="h-4.5 px-1.5 rounded bg-accent text-[8px] font-black text-white hover:bg-accent-hover border-none cursor-pointer transition-colors disabled:opacity-50"
                      :disabled="resolvingActionId === item.id"
                      @click="assignActionToRecommended(item)"
                    >
                      {{ resolvingActionId === item.id ? '处理中' : '分派' }}
                    </button>
                    <button
                      v-else
                      type="button"
                      class="p-0.5 rounded text-slate-400 hover:text-accent hover:bg-slate-100 dark:hover:bg-white/5 bg-transparent border-none cursor-pointer transition-all"
                      @click="navigateInsight(item.targetRoute)"
                    >
                      <ArrowRight class="w-2.5 h-2.5 shrink-0" />
                    </button>
                  </div>
                </div>
                
                <div v-if="operationalLanes.length" class="mt-1.5 grid grid-cols-2 gap-1">
                  <button
                    v-for="lane in operationalLanes"
                    :key="lane.key"
                    type="button"
                    class="h-5 rounded bg-white dark:bg-slate-900/60 border border-slate-100 dark:border-white/5 px-1.5 text-[8.5px] font-black text-slate-500 cursor-pointer flex items-center justify-between gap-1 hover:text-accent hover:border-accent/20 hover:bg-accent/5 transition-all"
                    @click="activateOperationalLane(lane)"
                  >
                    <span class="truncate">{{ lane.label }}</span>
                    <b class="text-accent">{{ lane.count }}</b>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_304px] gap-2.5">
            <div class="space-y-3 min-w-0">
              <div
                class="rounded-2xl border overflow-hidden shadow-sm"
                style="background-color: var(--bg-card); border-color: var(--border-base)"
              >
                <div class="p-2.5 sm:p-3 border-b space-y-2" style="border-color: var(--border-base)">
                  <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
                    <div class="flex items-center gap-2 min-w-0">
                      <BarChart3 class="w-4 h-4 text-accent shrink-0" />
                      <h2 class="text-sm sm:text-base font-black truncate" style="color: var(--text-primary)">
                        项目态势
                      </h2>
                      <span class="text-[10px] font-black text-slate-400">
                        {{ filteredProjectRows.length }}/{{ projectStats.total }}
                      </span>
                    </div>

                    <div class="flex items-center gap-2 overflow-x-auto scrollbar-hide">
                        <div class="flex items-center bg-slate-100 dark:bg-white/5 rounded-lg p-1 shrink-0">
                        <button
                          v-for="option in statusOptions"
                          :key="option.value"
                          type="button"
                          class="px-2.5 py-1 rounded-md text-[10px] font-black border-none cursor-pointer transition-all whitespace-nowrap"
                          :class="statusFilter === option.value ? 'bg-white dark:bg-slate-900 text-accent shadow-sm' : 'bg-transparent text-slate-500'"
                          @click="statusFilter = option.value"
                        >
                          {{ option.label }}
                        </button>
                      </div>

                      <div
                        class="flex items-center bg-slate-100 dark:bg-white/5 rounded-lg border p-1 shadow-sm shrink-0"
                        style="border-color: var(--border-base)"
                      >
                        <button
                          type="button"
                          class="p-1.5 rounded-lg transition-all border-none bg-transparent cursor-pointer"
                          :class="viewMode === 'grid' ? 'bg-white dark:bg-slate-900 text-accent shadow-sm' : 'text-slate-400'"
                          title="网格"
                          @click="setViewMode('grid')"
                        >
                          <LayoutGrid class="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          class="p-1.5 rounded-lg transition-all border-none bg-transparent cursor-pointer"
                          :class="viewMode === 'list' ? 'bg-white dark:bg-slate-900 text-accent shadow-sm' : 'text-slate-400'"
                          title="列表"
                          @click="setViewMode('list')"
                        >
                          <List class="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div class="flex items-center gap-2 overflow-x-auto scrollbar-hide">
                    <button
                      v-for="option in focusOptions"
                      :key="option.value"
                      type="button"
                      class="h-7 px-2.5 rounded-lg text-[10px] font-black border cursor-pointer transition-all flex items-center gap-1.5 whitespace-nowrap"
                      :class="focusFilter === option.value ? 'bg-accent text-white border-accent shadow-md shadow-accent/20' : 'bg-slate-50 dark:bg-white/5 text-slate-500 border-transparent hover:border-accent/30'"
                      @click="focusFilter = option.value"
                    >
                      <component :is="option.icon" class="w-3 h-3" />
                      {{ option.label }}
                    </button>
                  </div>
                </div>

                <div v-if="filteredProjectRows.length === 0" class="flex flex-col items-center justify-center py-16 text-center">
                  <Search class="w-10 h-10 text-slate-300 mb-3" />
                  <h3 class="text-base font-black mb-1" style="color: var(--text-primary)">没有匹配的项目</h3>
                  <p class="text-xs text-slate-400 mb-5">换个筛选条件，或者创建一个新的团队项目。</p>
                  <button
                    type="button"
                    class="px-4 py-2 bg-accent text-white rounded-xl text-xs font-black border-none cursor-pointer"
                    @click="openAddDrawer"
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
                      @click="handleProjectClick(row.project.id)"
                    >
                      <div class="flex items-start justify-between gap-3">
                        <div class="flex items-start gap-2.5 min-w-0">
                          <div class="w-8 h-8 rounded-lg text-white text-xs font-black flex items-center justify-center shrink-0" :class="row.project.color || 'bg-accent'">
                            {{ row.project.title.slice(0, 1) }}
                          </div>
                          <div class="min-w-0">
                            <div class="flex items-center gap-2 min-w-0">
                              <p class="text-xs font-black truncate" style="color: var(--text-primary)">{{ row.project.title }}</p>
                              <span
                                class="px-1.5 py-0.5 rounded text-[8px] font-black shrink-0"
                                :class="projectHealthById.get(row.project.id)?.riskLevel === 'HIGH' ? 'bg-rose-500/10 text-rose-600' : projectHealthById.get(row.project.id)?.riskLevel === 'MEDIUM' ? 'bg-amber-500/10 text-amber-600' : row.health.class"
                              >
                                {{ projectHealthById.get(row.project.id)?.healthScore ? `${projectHealthById.get(row.project.id)?.healthScore}分` : row.health.label }}
                              </span>
                            </div>
                            <p class="mt-0.5 text-[10px] font-bold text-slate-400 truncate">{{ row.project.description || '暂无描述' }}</p>
                          </div>
                        </div>

                        <div class="flex items-center gap-1 shrink-0" @click.stop>
                          <button
                            type="button"
                            class="h-7 px-2 rounded-lg bg-accent/10 text-accent text-[9px] font-black border-none cursor-pointer"
                            @click="navigateToTaskBoard(row.project.id)"
                          >
                            看板
                          </button>
                          <el-dropdown trigger="click">
                            <button type="button" class="h-7 w-7 rounded-lg bg-white dark:bg-slate-900 text-slate-400 border-none cursor-pointer flex items-center justify-center">
                              <SlidersHorizontal class="w-3.5 h-3.5" />
                            </button>
                            <template #dropdown>
                              <el-dropdown-menu class="!rounded-xl !p-2">
                                <el-dropdown-item class="!rounded-lg !mb-1 font-bold" @click="openEditDrawer(row.project)">
                                  配置项目
                                </el-dropdown-item>
                                <el-dropdown-item class="!rounded-lg !mb-1 font-bold" @click="quickTaskProjectId = row.project.id">
                                  设为派发目标
                                </el-dropdown-item>
                                <el-divider class="!my-1" />
                                <el-dropdown-item class="!rounded-lg !text-rose-500 font-bold" @click="deleteProject(row.project.id)">
                                  删除项目
                                </el-dropdown-item>
                              </el-dropdown-menu>
                            </template>
                          </el-dropdown>
                        </div>
                      </div>

                      <div class="mt-3 grid grid-cols-4 gap-1.5 text-[10px] font-black">
                        <div class="rounded-md bg-white/80 dark:bg-slate-900/40 px-2 py-1.5 text-slate-500">
                          任务 {{ row.taskStats.total }}
                        </div>
                        <div class="rounded-md bg-white/80 dark:bg-slate-900/40 px-2 py-1.5 text-slate-500">
                          进行 {{ row.taskStats.inProgress }}
                        </div>
                        <div class="rounded-md px-2 py-1.5" :class="row.taskStats.overdue > 0 ? 'bg-rose-500/10 text-rose-600' : 'bg-emerald-500/10 text-emerald-600'">
                          逾期 {{ row.taskStats.overdue }}
                        </div>
                        <div class="rounded-md bg-white/80 dark:bg-slate-900/40 px-2 py-1.5 text-slate-500">
                          {{ row.daysLeft === null ? '无截止' : row.daysLeft < 0 ? `超${Math.abs(row.daysLeft)}天` : `${row.daysLeft}天` }}
                        </div>
                      </div>

                      <div class="mt-3 flex items-center gap-3">
                        <div class="min-w-0 flex-1">
                          <div class="flex items-center justify-between text-[9px] font-black mb-1">
                            <span class="text-slate-400">完成 {{ row.taskStats.done }}/{{ row.taskStats.total }}</span>
                            <span class="text-accent">{{ row.taskStats.completionRate }}%</span>
                          </div>
                          <div class="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div class="h-full bg-accent rounded-full" :style="{ width: row.taskStats.completionRate + '%' }"></div>
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
                          <span v-if="row.project.members.length > 3" class="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-[9px] font-black text-slate-500 flex items-center justify-center">
                            +{{ row.project.members.length - 3 }}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div v-else class="overflow-x-auto scrollbar-hide">
                    <table class="w-full min-w-[900px] text-left border-collapse">
                      <thead>
                        <tr class="border-b text-[10px] font-black uppercase tracking-widest text-slate-400" style="border-color: var(--border-base)">
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
                          @click="handleProjectClick(row.project.id)"
                        >
                          <td class="px-3 py-3">
                            <div class="flex items-center gap-3 min-w-0">
                              <div class="w-9 h-9 rounded-xl text-white font-black flex items-center justify-center shrink-0" :class="row.project.color || 'bg-accent'">
                                {{ row.project.title.slice(0, 1) }}
                              </div>
                              <div class="min-w-0">
                                <p class="text-xs font-black truncate" style="color: var(--text-primary)">{{ row.project.title }}</p>
                                <p class="text-[10px] text-slate-400 truncate max-w-sm">{{ row.project.description || '暂无描述' }}</p>
                              </div>
                            </div>
                          </td>
                          <td class="px-3 py-3">
                            <span
                              class="px-2.5 py-1 rounded-lg text-[10px] font-black"
                              :class="projectHealthById.get(row.project.id)?.riskLevel === 'HIGH' ? 'bg-rose-500/10 text-rose-600' : projectHealthById.get(row.project.id)?.riskLevel === 'MEDIUM' ? 'bg-amber-500/10 text-amber-600' : row.health.class"
                            >
                              {{ projectHealthById.get(row.project.id)?.healthScore ? `${projectHealthById.get(row.project.id)?.healthScore} 分` : row.health.label }}
                            </span>
                          </td>
                          <td class="px-3 py-3">
                            <div class="w-40">
                              <div class="flex justify-between text-[10px] font-black mb-1">
                                <span class="text-slate-400">{{ row.taskStats.done }}/{{ row.taskStats.total }}</span>
                                <span class="text-accent">{{ row.taskStats.completionRate }}%</span>
                              </div>
                              <div class="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div class="h-full bg-accent rounded-full" :style="{ width: row.taskStats.completionRate + '%' }"></div>
                              </div>
                            </div>
                          </td>
                          <td class="px-3 py-3 text-xs font-bold text-slate-500">{{ formatDate(row.project.dueDate) }}</td>
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
                              <span v-if="row.project.members.length > 4" class="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-[9px] font-black text-slate-500 flex items-center justify-center">
                                +{{ row.project.members.length - 4 }}
                              </span>
                            </div>
                          </td>
                          <td class="px-3 py-3 text-right">
                            <div class="flex items-center justify-end gap-1.5" @click.stop>
                              <button
                                type="button"
                                class="h-7 px-2.5 rounded-lg bg-accent/10 text-accent text-[9px] font-black border-none cursor-pointer"
                                @click="navigateToTaskBoard(row.project.id)"
                              >
                                看板
                              </button>
                              <el-dropdown trigger="click">
                                <button type="button" class="h-7 w-7 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-450 border-none cursor-pointer flex items-center justify-center">
                                  <SlidersHorizontal class="w-3.5 h-3.5" />
                                </button>
                                <template #dropdown>
                                  <el-dropdown-menu class="!rounded-xl !p-2">
                                    <el-dropdown-item class="!rounded-lg !mb-1 font-bold" @click="openEditDrawer(row.project)">
                                      配置项目
                                    </el-dropdown-item>
                                    <el-dropdown-item class="!rounded-lg !mb-1 font-bold" @click="quickTaskProjectId = row.project.id">
                                      设为派发目标
                                    </el-dropdown-item>
                                    <el-divider class="!my-1" />
                                    <el-dropdown-item class="!rounded-lg !text-rose-500 font-bold" @click="deleteProject(row.project.id)">
                                      删除项目
                                    </el-dropdown-item>
                                  </el-dropdown-menu>
                                </template>
                              </el-dropdown>
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
            <aside class="space-y-3 min-w-0">
              <div
                class="rounded-xl border p-4 bg-card shadow-sm space-y-4"
                style="background-color: var(--bg-card); border-color: var(--border-base)"
              >
                <!-- Tab Navigation Header -->
                <div class="flex border-b pb-2 gap-1 overflow-x-auto scrollbar-hide" style="border-color: var(--border-base)">
                  <button
                    v-for="tab in sidebarTabs"
                    :key="tab.value"
                    type="button"
                    class="h-8 px-2.5 rounded-lg text-[10px] font-black transition-all border-none cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
                    :class="activeSidebarTab === tab.value ? 'bg-accent/10 text-accent font-black' : 'bg-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'"
                    @click="activeSidebarTab = tab.value"
                  >
                    <component :is="tab.icon" class="w-3.5 h-3.5" />
                    {{ tab.label }}
                  </button>
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
                          :disabled="!recommendedAssignee && !recommendedWorkload"
                          @click="selectRecommendedAssignee"
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
                          @keydown.enter="createQuickTask"
                        />
                        <div class="grid grid-cols-2 gap-2">
                          <el-select v-model="quickTaskProjectId" clearable placeholder="关联项目" class="!w-full">
                            <el-option v-for="project in projects" :key="project.id" :label="project.title" :value="project.id" />
                          </el-select>
                          <el-select v-model="quickTaskAssigneeId" clearable placeholder="指派负责人" class="!w-full">
                            <el-option v-for="member in teamMembers" :key="member.id" :label="member.name || member.email" :value="member.id">
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
                            class="min-w-0 px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-accent/15 transition-all"
                            style="border-color: var(--border-base); color: var(--text-primary)"
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
                            :class="quickTaskPriority === option.value ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'bg-slate-100 dark:bg-white/5 text-slate-500'"
                            @click="quickTaskPriority = option.value"
                          >
                            <span class="w-1.5 h-1.5 rounded-full" :class="option.class"></span>
                            {{ option.label }}
                          </button>
                        </div>
                        <div class="grid grid-cols-2 gap-2 text-[9px] font-black">
                          <div class="rounded-lg bg-slate-50 dark:bg-white/5 px-2 py-1.5 text-slate-500 truncate">
                            {{ selectedQuickProject ? selectedQuickProject.title : '独立任务' }}
                          </div>
                          <div class="rounded-lg bg-slate-50 dark:bg-white/5 px-2 py-1.5 text-slate-500 truncate">
                            {{ selectedQuickProjectStats ? `项目已发: ${selectedQuickProjectStats.total}` : `成员总数: ${teamMembers.length}` }}
                          </div>
                          <div class="col-span-2 rounded-lg bg-slate-50 dark:bg-white/5 px-2 py-1.5 text-slate-500 truncate">
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
                          @click="createQuickTask"
                        >
                          {{ isCreatingTask ? '创建中...' : '加入团队看板' }}
                        </button>
                      </div>
                    </div>

                    <!-- 一键任务包 Section -->
                    <div class="pt-3 border-t space-y-2" style="border-color: var(--border-base)">
                      <div class="flex items-center justify-between">
                        <span class="text-[10px] font-black" style="color: var(--text-primary)">一键任务模板包</span>
                        <span class="text-[9px] font-bold text-slate-400">一键发布至关联项目</span>
                      </div>
                      <div class="space-y-1.5">
                        <button
                          v-for="template in quickSeedTemplates"
                          :key="template.key"
                          type="button"
                          class="w-full p-2.5 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 hover:border-accent/30 hover:bg-accent/5 text-left cursor-pointer transition-all disabled:opacity-50"
                          :disabled="isCreatingSeedTasks"
                          @click="createSeedTasks(template)"
                        >
                          <div class="flex items-center justify-between gap-2">
                            <span class="text-xs font-black" style="color: var(--text-primary)">{{ template.label }}</span>
                            <span class="px-1.5 py-0.5 rounded bg-accent/10 text-[9px] font-black text-accent">{{ template.tasks.length }} 项任务</span>
                          </div>
                          <p class="mt-1 text-[9px] font-bold text-slate-400 truncate">{{ template.hint }}</p>
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
                          <SlidersHorizontal class="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div v-if="insightRiskProjects.length === 0" class="py-6 text-center text-[10px] font-bold text-slate-400 bg-slate-50/50 dark:bg-white/3 rounded-xl">
                        当前项目运营平稳，无预警风险
                      </div>
                      <div v-else class="space-y-2">
                        <button
                          v-for="project in insightRiskProjects.slice(0, 4)"
                          :key="project.id"
                          type="button"
                          class="w-full text-left p-2.5 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 hover:border-accent/30 hover:bg-accent/5 transition-all cursor-pointer"
                          @click="handleProjectClick(project.id)"
                        >
                          <div class="flex items-center justify-between gap-3">
                            <p class="text-xs font-black truncate" style="color: var(--text-primary)">{{ project.title }}</p>
                            <span
                              class="px-2 py-0.5 rounded-md text-[9px] font-black shrink-0"
                              :class="project.riskLevel === 'HIGH' ? 'bg-rose-500/10 text-rose-600' : 'bg-amber-500/10 text-amber-600'"
                            >
                              {{ project.healthScore }} 分
                            </span>
                          </div>
                          <div class="mt-2 grid grid-cols-3 gap-1 text-[9px] font-black text-slate-400">
                            <span>逾期: {{ project.overdueTasks }}</span>
                            <span>未分派: {{ project.unassignedTasks }}</span>
                            <span>临期: {{ project.dueSoonTasks }}</span>
                          </div>
                          <p class="mt-1.5 text-[9px] font-bold text-slate-400 truncate">{{ project.reasons[0] }}</p>
                        </button>
                      </div>
                    </div>

                    <!-- 近期交付 Section -->
                    <div class="pt-3 border-t space-y-3" style="border-color: var(--border-base)">
                      <div class="flex items-center gap-1.5">
                        <CalendarClock class="w-4 h-4 text-amber-500" />
                        <h4 class="text-xs font-black" style="color: var(--text-primary)">近期交付任务</h4>
                      </div>

                      <div v-if="dueSoonTasks.length === 0 && overdueTasks.length === 0" class="py-6 text-center text-[10px] font-bold text-slate-400 bg-slate-50/50 dark:bg-white/3 rounded-xl">
                        近期无紧急截止的任务
                      </div>
                      <div v-else class="space-y-2">
                        <button
                          v-for="task in [...overdueTasks, ...dueSoonTasks].slice(0, 5)"
                          :key="task.id"
                          type="button"
                          class="w-full flex items-center gap-2.5 p-2 rounded-lg bg-slate-50 dark:bg-white/5 hover:bg-accent/5 hover:scale-[1.01] transition-all text-left cursor-pointer border border-transparent hover:border-accent/10"
                          @click="navigateToTaskBoard(task.projectId)"
                        >
                          <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" :class="isOverdue(task) ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-500'">
                            <AlertTriangle v-if="isOverdue(task)" class="w-3.5 h-3.5" />
                            <Clock3 v-else class="w-3.5 h-3.5" />
                          </div>
                          <div class="min-w-0 flex-1">
                            <p class="text-[11px] font-black truncate" style="color: var(--text-primary)">{{ task.title }}</p>
                            <p class="text-[9px] text-slate-400 font-bold truncate">
                              {{ task.project?.title || '独立任务' }} · {{ formatDate(task.dueDate) }}
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

                      <div v-if="workloadRows.length === 0" class="py-6 text-center text-[10px] font-bold text-slate-400 bg-slate-50/50 dark:bg-white/3 rounded-xl">
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
                              :class="row.overdue > 0 ? 'bg-rose-500' : row.active > 5 ? 'bg-amber-500' : 'bg-accent'"
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
                        <span class="text-[9px] font-black text-slate-450 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/5">
                          {{ activityItems.length }} 条更新
                        </span>
                      </div>

                      <div v-if="activityItems.length === 0" class="py-6 text-center text-[10px] font-bold text-slate-400 bg-slate-50/50 dark:bg-white/3 rounded-xl">
                        暂无新的项目协作动态
                      </div>
                      <div v-else class="space-y-2.5">
                        <button
                          v-for="item in activityItems.slice(0, 6)"
                          :key="item.id"
                          type="button"
                          class="w-full grid grid-cols-[8px_minmax(0,1fr)_auto] items-center gap-2.5 bg-transparent border-none p-1 text-left cursor-pointer hover:bg-slate-100/50 dark:hover:bg-white/3 rounded transition-colors"
                          @click="navigateInsight(item.targetRoute)"
                        >
                          <span class="w-2 h-2 rounded-full shrink-0" :class="activityDotClass(item.type)"></span>
                          <span class="min-w-0">
                            <span class="block text-[11px] font-black truncate" style="color: var(--text-primary)">{{ item.title }}</span>
                            <span class="block text-[9px] font-bold text-slate-450 truncate mt-0.5">{{ item.description }}</span>
                          </span>
                          <span class="text-[9px] font-black text-slate-400 shrink-0">{{ formatRelativeTime(item.createdAt) }}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </template>
    </div>

    <ProjectDetailPanel ref="projectDetailPanelRef" @refresh-list="fetchAll" />

    <ProjectFormPanel
      ref="projectFormPanelRef"
      :team-members="teamMembers"
      @saved="fetchAll"
    />
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

.team-projects :deep(.el-select__wrapper),
.team-projects :deep(.el-input__wrapper) {
  border-radius: 8px;
  min-height: 30px;
  box-shadow: 0 0 0 1px var(--border-base) inset;
  background: var(--bg-app);
}

.compact-ops-bar {
  position: sticky;
  top: 0;
  z-index: 8;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.05);
}

.team-projects :deep(.el-select__placeholder),
.team-projects :deep(.el-select__selected-item) {
  font-size: 11px;
  font-weight: 800;
}

@media (max-width: 1440px) {
  .compact-metric-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
