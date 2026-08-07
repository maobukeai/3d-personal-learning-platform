<script lang="ts">
export default {
  name: 'TaskBoard',
};
</script>

<script setup lang="ts">
import { computed, watch, onActivated, defineAsyncComponent, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { Flame, ArrowUp, Minus, ArrowDown } from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';
import { useWorkspaceStore } from '@/stores/workspace';
import { TaskStatus } from '@/types/task';
import type { Task, UserType } from '@/types/task';
import { ElMessage } from '@/utils/feedbackBridge';
import api from '@/utils/api';

// Composables
import { useTaskData } from './composables/useTaskData';
import { useTaskFilters } from './composables/useTaskFilters';
import { useFpsFallback } from '@/composables/useFpsFallback';

// UI components
import TaskBoardHeader from './components/TaskBoardHeader.vue';
import TaskBoardSkeleton from './components/TaskBoardSkeleton.vue';
import TaskBoardEmptyState from './components/TaskBoardEmptyState.vue';

const UserProfileDialog = defineAsyncComponent(() => import('@/components/UserProfileDialog.vue'));
const TaskAddDialog = defineAsyncComponent(() => import('@/components/TaskAddDialog.vue'));
const TaskDetailDrawer = defineAsyncComponent(() => import('@/components/TaskDetailDrawer.vue'));
const TaskFilterBar = defineAsyncComponent(() => import('@/components/TaskFilterBar.vue'));

const TaskBoardView = defineAsyncComponent(() => import('./components/TaskBoardView.vue'));
const TaskListView = defineAsyncComponent(() => import('./components/TaskListView.vue'));
const TaskCalendarView = defineAsyncComponent(() => import('./components/TaskCalendarView.vue'));

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const workspaceStore = useWorkspaceStore();

// 1. Data Composable
const {
  tasks,
  teamMembers,
  projects,
  teams,
  isLoading,
  activeTask,
  activeSubtaskId,
  newTask,
  fetchTasks,
  fetchStats,
  fetchTeamMembers,
  fetchProjects,
  fetchTeams,
  handleTaskUpdated,
  handleAddTaskWithPayload,
  deleteTask,
  autoSaveTask,
  handleUpdateSubtask,
  handleSubtaskDrag,
} = useTaskData();

// 2. Filters Composable
const userId = computed(() => authStore.user?.id);
const {
  searchQuery,
  dateFilter,
  statusFilter,
  priorityFilter,
  customDate,
  hideCompleted,
  onlyMyTasks,
  sortBy,
  sortOrder,
  assigneeFilter,
  tagFilter,
  subtaskDisplay,
  selectedProjectId,
  groupBy,
  isAnyFilterActive,
  filteredTasks,
  allTags,
  boardTasksByGroup,
  listTasksByProject,
  calendarTasks,
  completionRate,
  overdueCount,
  clearProjectFilter,
  resetAllFilters,
} = useTaskFilters({ tasks, teamMembers, projects, userId: userId.value });

// 3. Performance / FPS Composable
const { disableBlur } = useFpsFallback();

// Local Layout Configs
const loadViewMode = (): 'board' | 'list' | 'calendar' => {
  const saved = localStorage.getItem('task_view_mode');
  return saved === 'list' || saved === 'board' || saved === 'calendar' ? saved : 'list';
};
const viewMode = ref<'board' | 'list' | 'calendar'>(loadViewMode());
watch(viewMode, (newVal) => {
  localStorage.setItem('task_view_mode', newVal);
});

const visibleColumns = ref({
  status: localStorage.getItem('task_visible_col_status') !== 'false',
  project: localStorage.getItem('task_visible_col_project') !== 'false',
  assignee: localStorage.getItem('task_visible_col_assignee') !== 'false',
  dueDate: localStorage.getItem('task_visible_col_dueDate') !== 'false',
  priority: localStorage.getItem('task_visible_col_priority') !== 'false',
});

const cardSettings = ref({
  assignee: localStorage.getItem('task_card_settings_assignee') !== 'false',
  dueDate: localStorage.getItem('task_card_settings_dueDate') !== 'false',
  priority: localStorage.getItem('task_card_settings_priority') !== 'false',
  project: localStorage.getItem('task_card_settings_project') !== 'false',
  subtasks: localStorage.getItem('task_card_settings_subtasks') !== 'false',
  description: localStorage.getItem('task_card_settings_description') !== 'false',
  timeTracking: localStorage.getItem('task_card_settings_timeTracking') !== 'false',
});

const toggleCardSetting = (field: string) => {
  const key = field as keyof typeof cardSettings.value;
  cardSettings.value[key] = !cardSettings.value[key];
  localStorage.setItem(`task_card_settings_${field}`, String(cardSettings.value[key]));
};

const toggleColumnVisibility = (col: string) => {
  const key = col as keyof typeof visibleColumns.value;
  visibleColumns.value[key] = !visibleColumns.value[key];
  localStorage.setItem(`task_visible_col_${col}`, String(visibleColumns.value[key]));
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

// Drawer / Profile / Add states
const isDetailDrawerOpen = ref(false);
const hasLoadedDetailDrawer = ref(false);
watch(isDetailDrawerOpen, (val) => {
  if (val) hasLoadedDetailDrawer.value = true;
});

const isAddDialogOpen = ref(false);
const hasLoadedAddDialog = ref(false);
watch(isAddDialogOpen, (val) => {
  if (val) hasLoadedAddDialog.value = true;
});

const isProfileDialogOpen = ref(false);
const hasLoadedProfileDialog = ref(false);
watch(isProfileDialogOpen, (val) => {
  if (val) hasLoadedProfileDialog.value = true;
});

const selectedUserId = ref<string | null>(null);
const taskDetailViewMode = ref<'drawer' | 'modal'>(
  (localStorage.getItem('task_detail_view_mode') as 'drawer' | 'modal') || 'drawer',
);
watch(taskDetailViewMode, (newVal) => {
  localStorage.setItem('task_detail_view_mode', newVal);
});

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

const activeColumns = computed(() => {
  if (groupBy.value === 'status') return statusColumns.value;
  if (groupBy.value === 'priority') {
    return [
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
    ];
  }
  if (groupBy.value === 'assignee') {
    const cols = [
      {
        id: 'unassigned',
        title: '未指派',
        color: 'bg-slate-400',
        headerBg: 'from-slate-400/10 to-transparent',
      },
    ];
    teamMembers.value.forEach((m) => {
      cols.push({
        id: m.id,
        title: m.name || '团队成员',
        color: 'bg-accent',
        headerBg: 'from-accent/10 to-transparent',
      });
    });
    return cols;
  }
  return [
    {
      id: 'overdue',
      title: '已逾期',
      color: 'bg-rose-500',
      headerBg: 'from-rose-500/10 to-transparent',
    },
    {
      id: 'today',
      title: '今天截止',
      color: 'bg-orange-500',
      headerBg: 'from-orange-500/10 to-transparent',
    },
    {
      id: 'tomorrow',
      title: '明天截止',
      color: 'bg-amber-500',
      headerBg: 'from-amber-500/10 to-transparent',
    },
    {
      id: 'week',
      title: '本周截止',
      color: 'bg-blue-500',
      headerBg: 'from-blue-500/10 to-transparent',
    },
    {
      id: 'future',
      title: '以后截止',
      color: 'bg-emerald-500',
      headerBg: 'from-emerald-500/10 to-transparent',
    },
    {
      id: 'none',
      title: '无截止日期',
      color: 'bg-slate-400',
      headerBg: 'from-slate-400/10 to-transparent',
    },
  ];
});

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

const openDetailDrawer = (task: Task, subtaskId?: string) => {
  let targetTask = task;
  let targetSubtaskId = subtaskId || null;
  const isSub = (task.isSubtask && task.parentId) || !!subtaskId;
  if (task.isSubtask && task.parentId) {
    const parent = tasks.value.find((t) => t.id === task.parentId);
    if (parent) {
      targetTask = parent;
      targetSubtaskId = task.id;
    }
  }
  activeTask.value = targetTask;
  activeSubtaskId.value = targetSubtaskId;
  if (targetTask.teamId) {
    fetchTeamMembers(targetTask.teamId);
  } else {
    fetchTeamMembers(workspaceStore.activeTeamId || undefined);
  }
  isDetailDrawerOpen.value = true;
  if (route.query.id !== targetTask.id) {
    router.replace({ query: { ...route.query, id: targetTask.id } });
  }
};

const closeDetailDrawer = () => {
  isDetailDrawerOpen.value = false;
  activeTask.value = null;
  activeSubtaskId.value = null;
  if (route.query.id) {
    router.replace({ query: { ...route.query, id: undefined } });
  }
};

const handleAddTask = async (payload: any) => {
  const success = await handleAddTaskWithPayload(payload);
  if (success) {
    isAddDialogOpen.value = false;
  }
};

const handleDeleteTask = async (task: Task) => {
  const success = await deleteTask(task);
  if (success) {
    isDetailDrawerOpen.value = false;
  }
};

// Trigger Detail Drawer if query ID matches on load
watch(
  [() => route.query.id, () => tasks.value],
  ([newId, newTasks]) => {
    if (newId && newTasks && newTasks.length > 0) {
      const targetTask = newTasks.find((t) => t.id === newId);
      if (targetTask && activeTask.value?.id !== targetTask.id) {
        openDetailDrawer(targetTask);
      }
    }
  },
  { immediate: true },
);

onActivated(() => {
  fetchTasks();
  fetchStats();
  fetchTeamMembers();
  fetchProjects();
  fetchTeams();
});
</script>

<template>
  <div
    class="mobile-adaptive flex-1 flex flex-col h-full overflow-hidden transition-colors duration-300"
    :class="{ 'disable-backdrop-blur': disableBlur }"
  >
    <TaskBoardHeader
      v-model:search-query="searchQuery"
      v-model:view-mode="viewMode"
      :card-settings="cardSettings"
      :visible-columns="visibleColumns"
      :completion-rate="completionRate"
      :overdue-count="overdueCount"
      :tasks-count="tasks.length"
      @toggle-card-setting="toggleCardSetting"
      @toggle-column-visibility="toggleColumnVisibility"
      @new-task="openAddDialog('TODO')"
      @new-project="router.push({ path: '/projects', query: { openCreate: 'true' } })"
    />

    <TaskFilterBar
      v-model:date-filter="dateFilter"
      v-model:status-filter="statusFilter"
      v-model:priority-filter="priorityFilter"
      v-model:group-by="groupBy"
      v-model:sort-by="sortBy"
      v-model:sort-order="sortOrder"
      v-model:hide-completed="hideCompleted"
      v-model:only-my-tasks="onlyMyTasks"
      v-model:visible-columns="visibleColumns"
      v-model:assignee-filter="assigneeFilter"
      v-model:tag-filter="tagFilter"
      v-model:subtask-display="subtaskDisplay"
      v-model:selected-project-id="selectedProjectId"
      :total-tasks-count="tasks.length"
      :completion-rate="completionRate"
      :overdue-count="overdueCount"
      :projects="projects"
      :view-mode="viewMode"
      :is-any-filter-active="isAnyFilterActive"
      :team-members="teamMembers"
      :all-tags="allTags"
      @clear-project-filter="clearProjectFilter"
      @reset-all-filters="resetAllFilters"
    />

    <TaskBoardSkeleton v-if="isLoading" :view-mode="viewMode" />

    <!-- Board View -->
    <TaskBoardView
      v-if="!isLoading && viewMode === 'board'"
      :tasks-by-group="boardTasksByGroup"
      :active-columns="activeColumns"
      :group-by="groupBy"
      :card-settings="cardSettings"
      :team-members="teamMembers"
      @refresh="handleTaskUpdated"
      @refresh-stats="fetchStats"
      @open-add-dialog="handleOpenAddDialogFromBoard"
      @open-detail="openDetailDrawer"
      @open-profile="openUserProfile"
      @update-subtask="handleUpdateSubtask"
      @drag-subtask="(pId, sIdx, colId) => handleSubtaskDrag(pId, sIdx, colId, groupBy)"
    />

    <!-- List View -->
    <TaskListView
      v-if="!isLoading && viewMode === 'list'"
      :tasks-by-project="listTasksByProject"
      :active-columns="activeColumns"
      :visible-columns="visibleColumns"
      :projects="projects"
      :team-members="teamMembers"
      :teams="teams"
      :group-by="groupBy"
      :subtask-display="subtaskDisplay"
      @refresh="handleTaskUpdated"
      @open-add-dialog="handleOpenAddDialogFromList"
      @open-detail="openDetailDrawer"
      @update-subtask="handleUpdateSubtask"
    />

    <!-- Calendar View -->
    <TaskCalendarView
      v-if="!isLoading && viewMode === 'calendar'"
      :tasks="calendarTasks"
      :team-members="teamMembers"
      @refresh="handleTaskUpdated"
      @refresh-stats="fetchStats"
      @open-detail="openDetailDrawer"
    />

    <TaskBoardEmptyState
      v-if="!isLoading && tasks.length === 0"
      type="no-tasks"
      @add-task="openAddDialog('TODO')"
    />

    <TaskBoardEmptyState
      v-if="!isLoading && tasks.length > 0 && filteredTasks.length === 0"
      type="no-matching"
      @reset-filters="resetAllFilters"
    />

    <!-- ClickUp-Style Double-Column Detail Drawer -->
    <TaskDetailDrawer
      v-if="hasLoadedDetailDrawer"
      v-model="isDetailDrawerOpen"
      v-model:view-mode="taskDetailViewMode"
      v-model:active-subtask-id="activeSubtaskId"
      :task="activeTask"
      :team-members="teamMembers"
      :projects="projects"
      :priority-options="priorityOptions"
      :status-columns="statusColumns"
      @close="closeDetailDrawer"
      @delete="handleDeleteTask"
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
      @submit="handleAddTask"
    />

    <UserProfileDialog
      v-model="isProfileDialogOpen"
      :user-id="selectedUserId"
      @chat="handleStartChat"
    />
  </div>
</template>

<style>
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

/* FPS Fallback to disabled expensive backdrop-blurs */
.disable-backdrop-blur .glass-real-physical,
.disable-backdrop-blur .task-board-column,
.disable-backdrop-blur .group[style*='background-color'] {
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}
</style>
