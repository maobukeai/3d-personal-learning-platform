<script setup lang="ts">
import { computed, h, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Layers,
  TrendingUp,
  Users,
  Search,
  RefreshCw,
  Eye,
  EyeOff,
  KanbanSquare,
  FolderPlus,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from '@/utils/feedbackBridge';
import api from '@/utils/api';
import { useWorkspaceStore } from '@/stores/workspace';
import { TaskStatus } from '@/types/task';
import type { Project, Task, UserType } from '@/types/task';
import { isTaskOverdue } from '@/utils/taskDisplay';
import ProjectDetailPanel from './components/ProjectDetailPanel.vue';
import ProjectFormPanel from './components/ProjectFormPanel.vue';
import Button from '@/components/ui/Button.vue';
import PageHeader from '@/components/PageHeader.vue';

// Subcomponents
import ProjectsOverview from './components/ProjectsOverview.vue';
import ProjectsList from './components/ProjectsList.vue';
import ProjectsSidebar from './components/ProjectsSidebar.vue';

// Shared types
import type {
  ProjectStatusFilter,
  FocusFilter,
  ViewMode,
  TeamOverview,
  TeamCollaborationInsights,
  InsightActionItem,
  ProjectDetailPanelExpose,
  ProjectFormPanelExpose,
  TeamMemberResponse,
  InsightProjectHealth,
} from './types';

const workspaceStore = useWorkspaceStore();
const route = useRoute();
const router = useRouter();

const searchQuery = ref('');
const isStatsExpanded = ref(false);
const viewMode = ref<ViewMode>(
  (localStorage.getItem('team_project_view_mode') as ViewMode) || 'grid',
);
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

const quickTaskTitle = ref('');
const quickTaskProjectId = ref('');
const quickTaskAssigneeId = ref('');
const quickTaskPriority = ref<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM');
const quickTaskDueDate = ref('');

const projectDetailPanelRef = ref<ProjectDetailPanelExpose | null>(null);
const projectFormPanelRef = ref<ProjectFormPanelExpose | null>(null);

const teamMembers = ref<UserType[]>([]);

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

const isDueSoon = (task: Task) => {
  if (task.status === TaskStatus.DONE || !task.dueDate) return false;
  const dueTime = new Date(task.dueDate).getTime();
  return dueTime >= nowTime() && dueTime <= nowTime() + 7 * 24 * 60 * 60 * 1000;
};

const getProjectTaskStats = (projectId: string) => {
  const list = projectTaskMap.value.get(projectId) || [];
  const done = list.filter((task) => task.status === TaskStatus.DONE).length;
  const overdue = list.filter((task) => isTaskOverdue(task)).length;
  const dueSoon = list.filter(isDueSoon).length;
  const unassigned = list.filter(
    (task) => task.status !== TaskStatus.DONE && !task.assigneeId,
  ).length;
  return {
    total: list.length,
    done,
    todo: list.filter((task) => task.status === TaskStatus.TODO).length,
    inProgress: list.filter((task) => task.status === TaskStatus.IN_PROGRESS).length,
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
  if (
    stats.unassigned > 0 ||
    (daysLeft !== null && daysLeft <= 7 && (project.progress || 0) < 70)
  ) {
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
  const overdue = tasks.value.filter((task) => isTaskOverdue(task)).length;
  const dueSoon = tasks.value.filter(isDueSoon).length;
  const unassigned = tasks.value.filter(
    (task) => task.status !== 'DONE' && !task.assigneeId,
  ).length;
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
      return (
        (b.project.updatedAt ? new Date(b.project.updatedAt).getTime() : 0) -
        (a.project.updatedAt ? new Date(a.project.updatedAt).getTime() : 0)
      );
    });
});

const attentionProjects = computed(() =>
  projectRows.value.filter((row) => row.health.level >= 3).slice(0, 5),
);

const dueSoonTasks = computed(() => {
  const source = overview.value?.tasks.dueSoon || tasks.value.filter(isDueSoon);
  return source.slice(0, 6);
});

const overdueTasks = computed(() => {
  const source = overview.value?.tasks.overdue || tasks.value.filter((task) => isTaskOverdue(task));
  return source.slice(0, 6);
});

const insightSummary = computed(() => insights.value?.summary || null);
const healthScore = computed(
  () => insightSummary.value?.healthScore ?? taskStats.value.completionRate,
);
const actionItems = computed(() => insights.value?.actionItems || []);
const activityItems = computed(() => insights.value?.activity || []);
const insightRiskProjects = computed(
  () => insights.value?.projectHealth.filter((project) => project.riskLevel !== 'LOW') || [],
);
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
        overdue: assigned.filter((task) => isTaskOverdue(task)).length,
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
  return allWorkloadRows.value.slice().sort((a, b) => {
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
  return (
    recommendedWorkload.value?.member.name || recommendedWorkload.value?.member.email || '推荐成员'
  );
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
  const averageProgress =
    insightSummary.value?.averageProjectProgress ?? projectStats.value.averageProgress;
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
      progress: projectStats.value.total
        ? Math.round((projectStats.value.active / projectStats.value.total) * 100)
        : 0,
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
  completedThisWeek:
    insightSummary.value?.completedThisWeek ?? overview.value?.counts.completedThisWeek ?? 0,
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
  await Promise.all([
    fetchTasks(),
    fetchProjects(),
    fetchTeamOverview(),
    fetchCollaborationInsights(),
  ]);
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
      status: TaskStatus.TODO,
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

interface SeedTaskTemplate {
  title: string;
  priority: string;
  days: number;
}

interface SeedTemplate {
  label: string;
  hint: string;
  tasks: SeedTaskTemplate[];
}

const createSeedTasks = async (template: SeedTemplate) => {
  if (!quickTaskProjectId.value) {
    ElMessage.warning('先选择一个项目，再生成任务包');
    return;
  }

  isCreatingSeedTasks.value = true;
  try {
    const assigneeId =
      quickTaskAssigneeId.value ||
      recommendedAssignee.value?.user.id ||
      recommendedWorkload.value?.member.id ||
      null;
    const response = await api.post('/api/tasks/batch', {
      tasks: template.tasks.map((task) => ({
        title: task.title,
        description: `${template.label} · ${template.hint}`,
        status: TaskStatus.TODO,
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
    h(
      'p',
      { class: 'text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium' },
      '删除项目后，相关协作数据会同步处理。',
    ),
    h('div', { class: 'space-y-2 border-t pt-3 border-slate-100 dark:border-white/10' }, [
      h(
        'label',
        {
          class:
            'flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer select-none',
        },
        [
          h('input', {
            type: 'checkbox',
            checked: deleteTasks.value,
            onChange: (event: Event) => {
              deleteTasks.value = (event.target as HTMLInputElement).checked;
            },
            class:
              'rounded border-slate-300 text-accent focus:ring-accent w-3.5 h-3.5 cursor-pointer',
          }),
          h('span', '同时删除关联任务'),
        ],
      ),
      h(
        'label',
        {
          class:
            'flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer select-none',
        },
        [
          h('input', {
            type: 'checkbox',
            checked: deleteRoadmap.value,
            onChange: (event: Event) => {
              deleteRoadmap.value = (event.target as HTMLInputElement).checked;
            },
            class:
              'rounded border-slate-300 text-accent focus:ring-accent w-3.5 h-3.5 cursor-pointer',
          }),
          h('span', '同时删除学习路线'),
        ],
      ),
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

const navigateInsight = (targetRoute?: string) => {
  if (targetRoute) router.push(targetRoute);
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

watch(viewMode, (newMode) => {
  localStorage.setItem('team_project_view_mode', newMode);
});
</script>

<template>
  <div
    class="mobile-adaptive team-projects flex-1 flex flex-col h-full overflow-hidden"
    style="background-color: var(--bg-app)"
  >
    <PageHeader
      title="项目空间"
      :subtitle="`${activeWorkspaceName} · ${projectStats.total} 个项目 · ${taskStats.total} 个任务 · 同步 ${dataFreshnessLabel}`"
      :icon="Layers"
    >
      <template #center>
        <label class="search-box !min-h-0 !h-8 w-full sm:w-72 xl:w-80 shrink-0">
          <Search />
          <input v-model="searchQuery" type="text" placeholder="搜索项目、描述、标签" />
        </label>
      </template>

      <div class="mobile-row flex items-center gap-2 shrink-0">
        <Button
          variant="secondary"
          size="sm"
          class="!h-8 shrink-0"
          :icon="isRefreshing ? undefined : RefreshCw"
          :loading="isRefreshing"
          @click="handleManualRefresh"
        >
          同步
        </Button>
        <Button
          variant="secondary"
          size="sm"
          class="!h-8 shrink-0"
          :icon="isStatsExpanded ? EyeOff : Eye"
          @click="isStatsExpanded = !isStatsExpanded"
        >
          {{ isStatsExpanded ? '收起指标' : '数据指标' }}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          class="!h-8 shrink-0"
          :icon="KanbanSquare"
          @click="navigateToTaskBoard()"
        >
          看板
        </Button>
        <Button
          variant="primary"
          size="sm"
          class="!h-8 shrink-0"
          :icon="FolderPlus"
          @click="openAddDrawer"
        >
          新项目
        </Button>
      </div>
    </PageHeader>

    <div class="flex-1 overflow-y-auto scrollbar-hide">
      <div v-if="isLoading" class="h-full flex flex-col items-center justify-center opacity-60">
        <div
          class="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin mb-3"
        ></div>
        <p class="text-xs font-bold text-slate-400">正在整理团队项目数据</p>
      </div>

      <template v-else>
        <div class="p-2.5 sm:p-3 lg:p-4 space-y-3">
          <ProjectsOverview
            v-show="isStatsExpanded"
            v-model:focus-filter="focusFilter"
            :health-score="healthScore"
            :completed-this-week="compactPulse.completedThisWeek"
            :high-risk-projects="compactPulse.highRiskProjects"
            :compact-metrics="compactMetrics"
            :action-items="actionItems"
            :resolving-action-id="resolvingActionId"
            :operational-lanes="operationalLanes"
            :recommended-assignee-name="recommendedAssigneeName"
            @assign-action="assignActionToRecommended"
            @navigate-insight="navigateInsight"
            @navigate-board="navigateToTaskBoard"
          />

          <div class="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_304px] gap-2.5">
            <div class="space-y-3 min-w-0">
              <ProjectsList
                v-model:view-mode="viewMode"
                v-model:status-filter="statusFilter"
                v-model:focus-filter="focusFilter"
                v-model:quick-task-project-id="quickTaskProjectId"
                :filtered-project-rows="filteredProjectRows"
                :project-stats="projectStats"
                :project-health-by-id="projectHealthById"
                @click-project="handleProjectClick"
                @navigate-board="navigateToTaskBoard"
                @open-edit="openEditDrawer"
                @delete-project="deleteProject"
                @open-create="openAddDrawer"
              />
            </div>
            <aside class="space-y-3 min-w-0">
              <ProjectsSidebar
                v-model:active-sidebar-tab="activeSidebarTab"
                v-model:quick-task-title="quickTaskTitle"
                v-model:quick-task-project-id="quickTaskProjectId"
                v-model:quick-task-assignee-id="quickTaskAssigneeId"
                v-model:quick-task-due-date="quickTaskDueDate"
                v-model:quick-task-priority="quickTaskPriority"
                v-model:focus-filter="focusFilter"
                :projects="projects"
                :team-members="teamMembers"
                :recommended-assignee="recommendedAssignee"
                :recommended-assignee-name="recommendedAssigneeName"
                :selected-quick-project="selectedQuickProject"
                :selected-quick-project-stats="selectedQuickProjectStats"
                :selected-assignee-workload="selectedAssigneeWorkload"
                :is-creating-task="isCreatingTask"
                :is-creating-seed-tasks="isCreatingSeedTasks"
                :insight-risk-projects="insightRiskProjects"
                :due-soon-tasks="dueSoonTasks"
                :overdue-tasks="overdueTasks"
                :workload-rows="workloadRows"
                :activity-items="activityItems"
                @select-recommended="selectRecommendedAssignee"
                @create-task="createQuickTask"
                @create-seed-tasks="createSeedTasks"
                @click-project="handleProjectClick"
                @navigate-board="navigateToTaskBoard"
                @navigate-insight="navigateInsight"
              />
            </aside>
          </div>
        </div>
      </template>
    </div>

    <ProjectDetailPanel ref="projectDetailPanelRef" @refresh-list="fetchAll" />

    <ProjectFormPanel ref="projectFormPanelRef" :team-members="teamMembers" @saved="fetchAll" />
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

.compact-ops-bar {
  position: sticky;
  top: 0;
  z-index: 8;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.05);
}
@media (max-width: 1440px) {
  .compact-metric-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
