<script setup lang="ts">
import { getApiErrorMessage } from '@/utils/error';
import { ref, onMounted, computed, watch, defineAsyncComponent } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import {
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  LayoutGrid,
  List,
  Flame,
  ArrowUp,
  Minus,
  ArrowDown,
  FolderPlus,
  TrendingUp,
  BarChart3,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import UserProfileDialog from '@/components/UserProfileDialog.vue';
import TaskAddDialog from '@/components/TaskAddDialog.vue';
import TaskDetailDrawer from '@/components/TaskDetailDrawer.vue';
import TaskFilterBar from '@/components/TaskFilterBar.vue';
import Tabs from '@/components/ui/Tabs.vue';
import Input from '@/components/ui/Input.vue';
const TaskBoardView = defineAsyncComponent(() => import('./components/TaskBoardView.vue'));
const TaskListView = defineAsyncComponent(() => import('./components/TaskListView.vue'));
import api from '@/utils/api';
import { useWorkspaceStore } from '@/stores/workspace';
import { useAuthStore } from '@/stores/auth';
import { getTaskDayIndex, getTaskTime } from '@/utils/taskSort';

import { TaskStatus } from '@/types/task';
import type { UserType, Team, Task, Project, TaskUpdatePayload } from '@/types/task';

const { t } = useI18n();
const workspaceStore = useWorkspaceStore();
const authStore = useAuthStore();
const route = useRoute();
const router = useRouter();

const tasks = ref<Task[]>([]);
const isLoading = ref(false);
const searchQuery = ref('');
const dateFilter = ref('all');
const statusFilter = ref('all');
const priorityFilter = ref('all');
const customDate = ref('');
const hideCompleted = ref(false);
const onlyMyTasks = ref(false);
const sortBy = ref<'natural' | 'createdAt_asc' | 'createdAt_desc'>(
  (localStorage.getItem('task_sort_by') as any) || 'natural',
);

watch(sortBy, (newVal) => {
  localStorage.setItem('task_sort_by', newVal);
});
const visibleColumns = ref({
  status: localStorage.getItem('task_visible_col_status') !== 'false',
  project: localStorage.getItem('task_visible_col_project') !== 'false',
  assignee: localStorage.getItem('task_visible_col_assignee') !== 'false',
  dueDate: localStorage.getItem('task_visible_col_dueDate') !== 'false',
  priority: localStorage.getItem('task_visible_col_priority') !== 'false',
});
const isAddDialogOpen = ref(false);

const selectedProjectId = ref<string | null>((route.query.projectId as string) || null);

watch(
  () => route.query.projectId,
  (newVal) => {
    selectedProjectId.value = (newVal as string) || null;
  },
);

const clearProjectFilter = () => {
  selectedProjectId.value = null;
  router.replace({ query: { ...route.query, projectId: undefined } });
};

const loadViewMode = (): 'board' | 'list' => {
  const saved = localStorage.getItem('task_view_mode');
  return saved === 'list' || saved === 'board' ? saved : 'board';
};
const viewMode = ref<'board' | 'list'>(loadViewMode());

watch(viewMode, (newVal) => {
  localStorage.setItem('task_view_mode', newVal);
});
const stats = ref<unknown>(null);

const isProfileDialogOpen = ref(false);
const selectedUserId = ref<string | null>(null);

const openUserProfile = (userId: string) => {
  selectedUserId.value = userId;
  isProfileDialogOpen.value = true;
};

const handleStartChat = async (user: UserType) => {
  try {
    await api.post('/api/messages/conversations', {
      participantIds: [user.id],
      isGroup: false,
    });
    ElMessage.success(t('tasks.chatStarted'));
  } catch {
    ElMessage.error(t('tasks.chatFailed'));
  }
};

const priorityOptions = computed(() => [
  {
    id: 'URGENT',
    label: t('tasks.urgent'),
    color: 'bg-red-500',
    textColor: 'text-red-500',
    icon: Flame,
  },
  {
    id: 'HIGH',
    label: t('tasks.high'),
    color: 'bg-orange-500',
    textColor: 'text-orange-500',
    icon: ArrowUp,
  },
  {
    id: 'MEDIUM',
    label: t('tasks.medium'),
    color: 'bg-amber-500',
    textColor: 'text-amber-500',
    icon: Minus,
  },
  {
    id: 'LOW',
    label: t('tasks.low'),
    color: 'bg-slate-400',
    textColor: 'text-slate-400',
    icon: ArrowDown,
  },
]);

const newTask = ref({
  title: '',
  description: '',
  status: TaskStatus.TODO as TaskStatus,
  priority: 'MEDIUM',
  tags: [] as string[],
  dueDate: '',
  assigneeId: '',
  projectId: '',
  teamId: '',
  participantIds: [] as string[],
});

// ClickUp style detail drawer states
const isDetailDrawerOpen = ref(false);
const activeTask = ref<Task | null>(null);
const taskDetailViewMode = ref<'drawer' | 'modal'>(
  (localStorage.getItem('task_detail_view_mode') as 'drawer' | 'modal') || 'drawer',
);

watch(taskDetailViewMode, (newVal) => {
  localStorage.setItem('task_detail_view_mode', newVal);
});

// Grouping features
const groupBy = ref<'status' | 'priority'>('status');

const teamMembers = ref<UserType[]>([]);
const projects = ref<Project[]>([]);
const teams = ref<Team[]>([]);

const statusColumns = computed(() => [
  {
    id: TaskStatus.TODO,
    title: t('tasks.todo'),
    color: 'bg-slate-500',
    headerBg: 'from-slate-500/10 to-transparent',
  },
  {
    id: TaskStatus.IN_PROGRESS,
    title: t('tasks.inProgress'),
    color: 'bg-accent',
    headerBg: 'from-accent/10 to-transparent',
  },
  {
    id: TaskStatus.DONE,
    title: t('tasks.done'),
    color: 'bg-emerald-500',
    headerBg: 'from-emerald-500/10 to-transparent',
  },
]);

const priorityColumns = computed(() => [
  {
    id: 'URGENT',
    title: t('tasks.urgent'),
    color: 'bg-rose-500',
    headerBg: 'from-rose-500/10 to-transparent',
  },
  {
    id: 'HIGH',
    title: t('tasks.high'),
    color: 'bg-orange-500',
    headerBg: 'from-orange-500/10 to-transparent',
  },
  {
    id: 'MEDIUM',
    title: t('tasks.medium'),
    color: 'bg-amber-500',
    headerBg: 'from-amber-500/10 to-transparent',
  },
  {
    id: 'LOW',
    title: t('tasks.low'),
    color: 'bg-blue-500',
    headerBg: 'from-blue-500/10 to-transparent',
  },
  {
    id: 'NONE',
    title: t('tasks.noPriority'),
    color: 'bg-slate-400',
    headerBg: 'from-slate-400/10 to-transparent',
  },
]);

const activeColumns = computed(() =>
  groupBy.value === 'status' ? statusColumns.value : priorityColumns.value,
);

const isAnyFilterActive = computed(() => {
  return (
    searchQuery.value !== '' ||
    dateFilter.value !== 'all' ||
    statusFilter.value !== 'all' ||
    priorityFilter.value !== 'all' ||
    hideCompleted.value ||
    onlyMyTasks.value
  );
});

const resetAllFilters = () => {
  searchQuery.value = '';
  dateFilter.value = 'all';
  statusFilter.value = 'all';
  priorityFilter.value = 'all';
  hideCompleted.value = false;
  onlyMyTasks.value = false;
};

const filteredTasks = computed(() => {
  let filtered = tasks.value;

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    filtered = filtered.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        (t.tags && JSON.parse(t.tags).some((tag: string) => tag.toLowerCase().includes(q))),
    );
  }

  if (dateFilter.value !== 'all') {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    if (dateFilter.value === 'overdue') {
      filtered = filtered.filter(
        (t) => t.dueDate && new Date(t.dueDate) < now && t.status !== TaskStatus.DONE,
      );
    } else if (dateFilter.value === 'today') {
      filtered = filtered.filter((t) => {
        if (!t.dueDate) return false;
        const d = new Date(t.dueDate);
        return d >= now && d <= endOfDay;
      });
    } else if (dateFilter.value === 'week') {
      const endOfWeek = new Date(now);
      endOfWeek.setDate(now.getDate() + 7);
      filtered = filtered.filter((t) => {
        if (!t.dueDate) return false;
        const d = new Date(t.dueDate);
        return d >= now && d <= endOfWeek;
      });
    } else if (dateFilter.value === 'custom' && customDate.value) {
      const selectedDate = new Date(customDate.value);
      selectedDate.setHours(0, 0, 0, 0);
      const selectedEnd = new Date(selectedDate);
      selectedEnd.setHours(23, 59, 59, 999);
      filtered = filtered.filter((t) => {
        if (!t.dueDate) return false;
        const d = new Date(t.dueDate);
        return d >= selectedDate && d <= selectedEnd;
      });
    }
  }

  if (statusFilter.value !== 'all') {
    filtered = filtered.filter((t) => t.status === statusFilter.value);
  }

  if (priorityFilter.value !== 'all') {
    filtered = filtered.filter((t) => t.priority === priorityFilter.value);
  }

  if (hideCompleted.value) {
    filtered = filtered.filter((t) => t.status !== TaskStatus.DONE);
  }

  if (onlyMyTasks.value && authStore.user?.id) {
    const myId = authStore.user.id;
    filtered = filtered.filter((t) => t.assigneeId === myId);
  }

  if (selectedProjectId.value) {
    filtered = filtered.filter((t) => t.projectId === selectedProjectId.value);
  }

  // Apply sorting
  if (sortBy.value === 'natural') {
    filtered = [...filtered].sort((a, b) => {
      const dayA = a && a.title ? getTaskDayIndex(a.title) : Infinity;
      const dayB = b && b.title ? getTaskDayIndex(b.title) : Infinity;
      if (dayA !== dayB) {
        return dayA - dayB;
      }
      return getTaskTime(a) - getTaskTime(b);
    });
  } else if (sortBy.value === 'createdAt_asc') {
    filtered = [...filtered].sort((a, b) => getTaskTime(a) - getTaskTime(b));
  } else if (sortBy.value === 'createdAt_desc') {
    filtered = [...filtered].sort((a, b) => getTaskTime(b) - getTaskTime(a));
  }

  return filtered;
});

const tasksByProject = computed(() => {
  const filtered = filteredTasks.value;
  const projectMap: Record<string, { id: string | null; name: string; tasks: Task[] }> = {};

  projectMap['unassigned'] = {
    id: null,
    name: t('projects.unassignedProject'),
    tasks: [],
  };

  projects.value.forEach((p) => {
    projectMap[p.id] = {
      id: p.id,
      name: p.title,
      tasks: [],
    };
  });

  filtered.forEach((taskItem) => {
    const pid = taskItem.projectId || 'unassigned';
    if (!projectMap[pid]) {
      projectMap[pid] = {
        id: taskItem.projectId || null,
        name: taskItem.project?.title || t('projects.unknownProject'),
        tasks: [],
      };
    }
    projectMap[pid].tasks.push(taskItem);
  });

  const result = Object.values(projectMap).filter((g) => g.tasks.length > 0);

  result.sort((a, b) => {
    if (a.id === null) return 1;
    if (b.id === null) return -1;
    return a.name.localeCompare(b.name);
  });

  return result;
});

const tasksByGroup = computed(() => {
  const filtered = filteredTasks.value;
  const map: Record<string, Task[]> = {};
  if (groupBy.value === 'status') {
    map[TaskStatus.TODO] = filtered.filter((t) => t.status === TaskStatus.TODO);
    map[TaskStatus.IN_PROGRESS] = filtered.filter((t) => t.status === TaskStatus.IN_PROGRESS);
    map[TaskStatus.DONE] = filtered.filter((t) => t.status === TaskStatus.DONE);
  } else {
    map['URGENT'] = filtered.filter((t) => t.priority === 'URGENT');
    map['HIGH'] = filtered.filter((t) => t.priority === 'HIGH');
    map['MEDIUM'] = filtered.filter((t) => t.priority === 'MEDIUM');
    map['LOW'] = filtered.filter((t) => t.priority === 'LOW');
    map['NONE'] = filtered.filter((t) => !t.priority || t.priority === 'NONE');
  }
  return map;
});

const completionRate = computed(() => {
  const total = tasks.value.length;
  if (total === 0) return 0;
  return Math.round((tasks.value.filter((t) => t.status === TaskStatus.DONE).length / total) * 100);
});

const overdueCount = computed(() => {
  const now = new Date();
  return tasks.value.filter(
    (t) => t.dueDate && new Date(t.dueDate) < now && t.status !== TaskStatus.DONE,
  ).length;
});

const fetchTasks = async () => {
  isLoading.value = true;
  try {
    const response = await api.get('/api/tasks');
    tasks.value = response.data;
  } catch {
    ElMessage.error(t('tasks.fetchFailed'));
  } finally {
    isLoading.value = false;
  }
};

const fetchStats = async () => {
  try {
    const response = await api.get('/api/tasks/stats');
    stats.value = response.data;
  } catch {
    // silently fail
  }
};

const fetchTeamMembers = async (teamId?: string) => {
  try {
    const tid = teamId || workspaceStore.activeTeamId;
    if (!tid) return;
    const response = await api.get(`/api/teams/${tid}/members`);
    teamMembers.value = response.data?.map((m: { user: UserType }) => m.user) || [];
  } catch {
    // silently fail
  }
};

const fetchTeams = async () => {
  try {
    const response = await api.get('/api/teams');
    teams.value = response.data;
  } catch {
    // silently fail
  }
};

const fetchProjects = async () => {
  try {
    const response = await api.get('/api/projects');
    projects.value = response.data;
  } catch {
    // silently fail
  }
};

const handleAddTaskWithPayload = async (payload: {
  title: string;
  description?: string;
  status: string;
  priority: string;
  tags: string[];
  dueDate: string;
  assigneeId?: string | null;
  projectId?: string | null;
  teamId?: string | null;
  participantIds?: string[];
}) => {
  try {
    const formattedPayload = {
      ...payload,
      tags: payload.tags.length > 0 ? JSON.stringify(payload.tags) : null,
      assigneeId: payload.assigneeId || null,
      projectId: payload.projectId || null,
      teamId: payload.teamId || null,
      participantIds:
        payload.participantIds && payload.participantIds.length > 0
          ? payload.participantIds
          : undefined,
    };
    await api.post('/api/tasks', formattedPayload);
    ElMessage.success(t('tasks.addSuccess'));
    isAddDialogOpen.value = false;
    fetchTasks();
    fetchStats();
  } catch (error) {
    const errMsg = getApiErrorMessage(error, t('tasks.addFailed'));
    if (errMsg === '部分指定人员不在该团队中') {
      ElMessage.error(t('tasks.memberNotInTeam'));
    } else {
      ElMessage.error(errMsg);
    }
  }
};

const openAddDialogByCol = (payload: { colId: string; projectId?: string | null }) => {
  if (groupBy.value === 'status') {
    newTask.value.status = payload.colId as TaskStatus;
    newTask.value.priority = 'MEDIUM';
  } else {
    newTask.value.priority = payload.colId === 'NONE' ? 'MEDIUM' : payload.colId;
    newTask.value.status = TaskStatus.TODO;
  }
  newTask.value.projectId = payload.projectId || '';
  newTask.value.teamId = workspaceStore.activeTeamId || '';
  if (newTask.value.teamId) {
    fetchTeamMembers(newTask.value.teamId);
  }
  isAddDialogOpen.value = true;
};

const openAddDialog = (status: string = TaskStatus.TODO) => {
  openAddDialogByCol({ colId: status });
};

const handleOpenAddDialogFromBoard = (colId: string) => {
  openAddDialogByCol({ colId });
};

const handleOpenAddDialogFromList = (payload: { colId: string; projectId: string | null }) => {
  openAddDialogByCol(payload);
};

const handleListViewRefresh = () => {
  fetchTasks();
  fetchStats();
};

const deleteTask = (task: Task) => {
  ElMessageBox.confirm(t('tasks.deleteConfirm'), t('tasks.tip'), {
    type: 'warning',
    confirmButtonText: t('tasks.confirmDelete'),
    cancelButtonText: t('common.cancel'),
  }).then(async () => {
    try {
      await api.delete(`/api/tasks/${task.id}`);
      ElMessage.success(t('tasks.deleteSuccess'));
      isDetailDrawerOpen.value = false;
      fetchTasks();
      fetchStats();
    } catch {
      ElMessage.error(t('tasks.deleteFailed'));
    }
  });
};

const openDetailDrawer = (task: Task) => {
  activeTask.value = task;
  if (task.teamId) {
    fetchTeamMembers(task.teamId);
  } else {
    fetchTeamMembers(workspaceStore.activeTeamId || undefined);
  }
  isDetailDrawerOpen.value = true;
};

const closeDetailDrawer = () => {
  isDetailDrawerOpen.value = false;
  activeTask.value = null;
  fetchTasks();
};

const autoSaveTask = async (payload: TaskUpdatePayload) => {
  if (!activeTask.value) return;
  try {
    await api.put(`/api/tasks/${activeTask.value.id}`, payload);

    // Update the local task object attributes immediately
    const idx = tasks.value.findIndex((t) => t.id === (activeTask.value as Task).id);
    if (idx !== -1) {
      tasks.value[idx].title = payload.title;
      tasks.value[idx].description = payload.description;
      tasks.value[idx].status = payload.status;
      tasks.value[idx].priority = payload.priority;
      tasks.value[idx].dueDate = payload.dueDate;
      tasks.value[idx].assigneeId = payload.assigneeId;
      tasks.value[idx].projectId = payload.projectId;
      tasks.value[idx].teamId = payload.teamId;
      tasks.value[idx].tags = payload.tags || undefined;
      tasks.value[idx].subtasks = payload.subtasks || undefined;

      // Re-resolve team and project relationships dynamically after save
      const assignedTeam = teams.value.find((t) => t.id === payload.teamId);
      const assignedProj = projects.value.find((p) => p.id === payload.projectId);
      tasks.value[idx].team = assignedTeam
        ? { id: assignedTeam.id, name: assignedTeam.name, members: assignedTeam.members }
        : null;
      tasks.value[idx].project = assignedProj
        ? { id: assignedProj.id, title: assignedProj.title, color: assignedProj.color }
        : null;
    }
    fetchStats();
  } catch {
    // silently fail
  }
};

watch(
  () => workspaceStore.activeTeamId,
  () => {
    fetchTasks();
    fetchStats();
    fetchTeamMembers();
    fetchProjects();
    fetchTeams();
  },
);

onMounted(() => {
  fetchTasks();
  fetchStats();
  fetchTeamMembers();
  fetchProjects();
  fetchTeams();
});
</script>

<template>
  <div
    class="flex-1 flex flex-col h-full overflow-hidden transition-colors duration-300"
    style="background-color: var(--bg-app)"
  >
    <!-- Header -->
    <div
      class="h-auto md:h-13 px-4 sm:px-6 py-3 md:py-0 flex flex-col md:grid md:grid-cols-3 md:items-center shrink-0 border-b transition-colors duration-300 gap-3"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <!-- Left: Title & Stats -->
      <div class="flex items-center justify-between w-full md:w-auto md:justify-start gap-3">
        <div class="flex items-center gap-2">
          <div class="p-1.5 bg-accent/10 rounded-lg">
            <CheckCircle2 class="w-4.5 h-4.5 text-accent" />
          </div>
          <h1
            class="text-base md:text-lg font-bold whitespace-nowrap"
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
            <span>{{ tasks.length }} {{ t('tasks.total') }}</span>
          </div>
        </div>

        <button
          type="button"
          class="md:hidden p-2 bg-accent text-white rounded-lg shadow-lg shadow-accent/20 hover:shadow-none transition-all flex items-center justify-center shrink-0"
          @click="openAddDialog('TODO')"
        >
          <Plus class="w-4 h-4" />
        </button>
      </div>

      <!-- Center: Search Input -->
      <div class="flex justify-center w-full md:w-auto">
        <Input
          v-model="searchQuery"
          type="text"
          :placeholder="t('tasks.searchPlaceholder')"
          :icon="Search"
          clearable
          glass
          class="w-full md:w-64 lg:w-72"
          input-class="!py-1.5 !h-8.5 text-xs w-full transition-all"
        />
      </div>

      <!-- Right: Action Controls -->
      <div class="flex items-center justify-end gap-2 sm:gap-2.5 w-full md:w-auto">
        <Tabs
          v-model="viewMode"
          :options="[
            { value: 'board', icon: LayoutGrid },
            { value: 'list', icon: List },
          ]"
          size="sm"
          class="!bg-transparent border-none shrink-0"
        />

        <button
          type="button"
          class="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold hover:bg-slate-200/50 dark:hover:bg-white/10 transition-all"
          @click="router.push({ path: '/projects', query: { openCreate: 'true' } })"
        >
          <FolderPlus class="w-3.5 h-3.5 text-slate-500" /> {{ t('tasks.newProject') }}
        </button>

        <button
          type="button"
          class="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-accent text-white rounded-lg text-xs font-bold hover:shadow-lg hover:shadow-accent/20 transition-all"
          @click="openAddDialog('TODO')"
        >
          <Plus class="w-3.5 h-3.5" /> {{ t('tasks.newTask') }}
        </button>
      </div>
    </div>

    <TaskFilterBar
      v-model:date-filter="dateFilter"
      v-model:status-filter="statusFilter"
      v-model:priority-filter="priorityFilter"
      v-model:group-by="groupBy"
      v-model:sort-by="sortBy"
      v-model:hide-completed="hideCompleted"
      v-model:only-my-tasks="onlyMyTasks"
      v-model:visible-columns="visibleColumns"
      :total-tasks-count="tasks.length"
      :completion-rate="completionRate"
      :overdue-count="overdueCount"
      :selected-project-id="selectedProjectId"
      :projects="projects"
      :view-mode="viewMode"
      :is-any-filter-active="isAnyFilterActive"
      @clear-project-filter="clearProjectFilter"
      @reset-all-filters="resetAllFilters"
    />

    <!-- Board View -->
    <TaskBoardView
      v-if="viewMode === 'board'"
      :tasks-by-group="tasksByGroup"
      :active-columns="activeColumns"
      :group-by="groupBy"
      @refresh="fetchTasks"
      @refresh-stats="fetchStats"
      @open-add-dialog="handleOpenAddDialogFromBoard"
      @open-detail="openDetailDrawer"
      @open-profile="openUserProfile"
    />

    <!-- List View -->
    <TaskListView
      v-if="viewMode === 'list'"
      :tasks-by-project="tasksByProject"
      :active-columns="activeColumns"
      :visible-columns="visibleColumns"
      :projects="projects"
      :team-members="teamMembers"
      :teams="teams"
      :group-by="groupBy"
      @refresh="handleListViewRefresh"
      @open-add-dialog="handleOpenAddDialogFromList"
      @open-detail="openDetailDrawer"
    />

    <!-- Global Empty State -->
    <div
      v-if="tasks.length === 0"
      class="task-empty-state py-20 flex flex-col items-center justify-center bg-card rounded-2xl border"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <div
        class="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center mb-4"
      >
        <CheckCircle2 class="w-8 h-8 text-slate-300 dark:text-slate-600" />
      </div>
      <p class="text-sm font-bold text-slate-400 mb-1">{{ t('tasks.noTasks') }}</p>
      <p class="text-xs text-slate-400 mb-4">{{ t('tasks.clickNewTaskTip') }}</p>
      <button
        type="button"
        class="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-xl text-xs font-bold hover:shadow-lg hover:shadow-accent/20 transition-all"
        @click="openAddDialog('TODO')"
      >
        <Plus class="w-4 h-4" /> {{ t('tasks.newTask') }}
      </button>
    </div>

    <!-- Filtered Empty State -->
    <div
      v-if="tasks.length > 0 && filteredTasks.length === 0"
      class="task-empty-state py-20 flex flex-col items-center justify-center bg-card rounded-2xl border text-center"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <div
        class="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center mb-4"
      >
        <SlidersHorizontal class="w-8 h-8 text-slate-300 dark:text-slate-600" />
      </div>
      <p class="text-sm font-bold text-slate-400 mb-1">{{ t('tasks.noMatchingTasks') }}</p>
      <p class="text-xs text-slate-400 mb-4">
        {{ t('tasks.noMatchingTasksTip') }}
      </p>
      <button
        type="button"
        class="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-200 dark:hover:bg-white/10 transition-all cursor-pointer mx-auto"
        @click="resetAllFilters"
      >
        <RotateCcw class="w-3.5 h-3.5" /> {{ t('tasks.resetAllFilters') }}
      </button>
    </div>

    <!-- ClickUp-Style Double-Column Detail Drawer -->
    <TaskDetailDrawer
      v-model="isDetailDrawerOpen"
      v-model:view-mode="taskDetailViewMode"
      :task="activeTask"
      :team-members="teamMembers"
      :projects="projects"
      :priority-options="priorityOptions"
      :status-columns="statusColumns"
      @close="closeDetailDrawer"
      @delete="deleteTask"
      @save="autoSaveTask"
      @user-click="openUserProfile"
    />

    <!-- Add Task Dialog -->
    <TaskAddDialog
      v-model="isAddDialogOpen"
      :team-members="teamMembers"
      :projects="projects"
      :priority-options="priorityOptions"
      :default-status="newTask.status"
      :default-priority="newTask.priority"
      :default-project-id="newTask.projectId"
      :default-team-id="newTask.teamId"
      @submit="handleAddTaskWithPayload"
    />

    <UserProfileDialog
      v-model="isProfileDialogOpen"
      :user-id="selectedUserId"
      @chat="handleStartChat"
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
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
.drawer-slide-enter-active,
.drawer-slide-leave-active {
  transition: opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}
.drawer-slide-enter-from,
.drawer-slide-leave-to {
  opacity: 0;
}
.drawer-slide-enter-active .task-detail-content {
  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}
.drawer-slide-leave-active .task-detail-content {
  transition: transform 0.25s ease-in;
}
.drawer-slide-enter-from .task-detail-content {
  transform: translateX(100%);
}
.drawer-slide-leave-to .task-detail-content {
  transform: translateX(100%);
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.3s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
.modal-fade-enter-active .task-detail-content {
  transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.modal-fade-leave-active .task-detail-content {
  transition: transform 0.2s ease-in;
}
.modal-fade-enter-from .task-detail-content {
  transform: scale(0.95) translateY(12px);
}
.modal-fade-leave-to .task-detail-content {
  transform: scale(0.97) translateY(8px);
}
.custom-date-picker :deep(.el-input__wrapper) {
  border-radius: 1.25rem !important;
  padding: 0.75rem 1rem !important;
  background-color: var(--bg-app) !important;
  box-shadow: none !important;
  border: 1px solid var(--border-base) !important;
}
.custom-select :deep(.el-input__wrapper) {
  border-radius: 1.25rem !important;
  padding: 0.5rem 1rem !important;
  background-color: var(--bg-app) !important;
  box-shadow: none !important;
  border: 1px solid var(--border-base) !important;
}
.custom-date-picker-small :deep(.el-input__wrapper) {
  border-radius: 0.75rem !important;
  padding: 0 0.5rem !important;
  background-color: var(--bg-app) !important;
  box-shadow: none !important;
  border: 1px solid var(--border-base) !important;
  height: 32px !important;
}
.custom-date-picker-small :deep(.el-input__inner) {
  font-size: 11px !important;
  font-weight: 600 !important;
}
.custom-select-small :deep(.el-input__wrapper),
.custom-select-small :deep(.el-select__wrapper) {
  border-radius: 0.75rem !important;
  padding: 0 0.5rem !important;
  background-color: var(--bg-app) !important;
  box-shadow: none !important;
  border: 1px solid var(--border-base) !important;
  height: 32px !important;
}
.custom-select-small :deep(.el-input__inner),
.custom-select-small :deep(.el-select__placeholder) {
  font-size: 11px !important;
  font-weight: 600 !important;
}

@media (max-width: 767px) {
  .task-filter-bar {
    align-items: center;
    gap: 0.5rem;
    padding: 0.45rem 0.75rem;
  }

  .task-filter-bar button {
    min-height: 1.75rem;
    padding: 0.25rem 0.5rem;
    font-size: 0.625rem;
    line-height: 0.875rem;
  }

  .task-filter-bar input,
  .task-filter-bar :deep(.el-input__wrapper),
  .task-filter-bar :deep(.el-select__wrapper) {
    min-height: 2rem;
  }

  .task-empty-state {
    margin: 0 0.75rem 0.75rem;
    padding: 1.5rem 0.75rem !important;
    border-radius: 12px;
  }

  .task-empty-state > div:first-child {
    width: 2.75rem;
    height: 2.75rem;
    margin-bottom: 0.75rem;
  }
}
</style>

<style>
.custom-date-popper {
  border-radius: 1.5rem !important;
  overflow: hidden !important;
  box-shadow:
    0 20px 25px -5px rgb(0 0 0 / 0.1),
    0 8px 10px -6px rgb(0 0 0 / 0.1) !important;
  border: 1px solid var(--border-base) !important;
}
.custom-date-popper .el-picker-panel {
  border-radius: 1.5rem !important;
  border: none !important;
}
.custom-date-popper .el-popper__arrow::before {
  border: 1px solid var(--border-base) !important;
}
@keyframes spin-once {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(-360deg);
  }
}
.animate-spin-hover {
  transition: transform 0.2s ease-in-out;
}
.animate-spin-hover:hover {
  animation: spin-once 0.6s ease-in-out;
}
</style>
