<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import draggable from 'vuedraggable';
import { useI18n } from 'vue-i18n';
import {
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
  LayoutGrid,
  List,
  Flame,
  ArrowUp,
  Minus,
  ArrowDown,
  User,
  FolderOpen,
  FolderPlus,
  TrendingUp,
  BarChart3,
  CheckSquare,
  ChevronRight,
  Eye,
  EyeOff,
  SlidersHorizontal,
  RotateCcw,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import UserProfileDialog from '@/components/UserProfileDialog.vue';
import TaskCard from '@/components/TaskCard.vue';
import TaskAddDialog from '@/components/TaskAddDialog.vue';
import TaskDetailDrawer from '@/components/TaskDetailDrawer.vue';
import api from '@/utils/api';
import { useWorkspaceStore } from '@/stores/workspace';
import { useAuthStore } from '@/stores/auth';

const { t } = useI18n();
const workspaceStore = useWorkspaceStore();
const authStore = useAuthStore();
const route = useRoute();
const router = useRouter();

const tasks = ref<any[]>([]);
const isLoading = ref(false);
const searchQuery = ref('');
const dateFilter = ref('all');
const statusFilter = ref('all');
const priorityFilter = ref('all');
const customDate = ref('');
const hideCompleted = ref(false);
const onlyMyTasks = ref(false);
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
const stats = ref<any>(null);

const isProfileDialogOpen = ref(false);
const selectedUserId = ref<string | null>(null);

const openUserProfile = (userId: string) => {
  selectedUserId.value = userId;
  isProfileDialogOpen.value = true;
};

const handleStartChat = async (user: any) => {
  try {
    await api.post('/api/messages/conversations', {
      participantIds: [user.id],
      isGroup: false,
    });
    // Navigate to messages or just close dialog
    ElMessage.success('已发起对话');
  } catch (error) {
    ElMessage.error('创建对话失败');
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

const tagColorMap: Record<string, string> = {
  设计: 'bg-pink-500/10 text-pink-500',
  开发: 'bg-blue-500/10 text-blue-500',
  学习: 'bg-emerald-500/10 text-emerald-500',
  '3D': 'bg-violet-500/10 text-violet-500',
  建模: 'bg-cyan-500/10 text-cyan-500',
  渲染: 'bg-amber-500/10 text-amber-500',
  动画: 'bg-rose-500/10 text-rose-500',
  研究: 'bg-indigo-500/10 text-indigo-500',
  文档: 'bg-teal-500/10 text-teal-500',
  优化: 'bg-lime-500/10 text-lime-500',
};

const defaultTagClass = 'bg-slate-500/10 text-slate-500';

const getTagClass = (tag: string) => tagColorMap[tag] || defaultTagClass;

const newTask = ref({
  title: '',
  description: '',
  status: 'TODO',
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
const activeTask = ref<any>(null);
// Task details view mode (drawer vs modal)
const taskDetailViewMode = ref<'drawer' | 'modal'>(
  (localStorage.getItem('task_detail_view_mode') as 'drawer' | 'modal') || 'drawer',
);

watch(taskDetailViewMode, (newVal) => {
  localStorage.setItem('task_detail_view_mode', newVal);
});

// Grouping features
const groupBy = ref<'status' | 'priority'>('status');
const inlineTitles = ref<Record<string, string>>({});

const loadCollapsedGroups = () => {
  try {
    return JSON.parse(localStorage.getItem('task_collapsed_groups') || '{}');
  } catch (e) {
    return {};
  }
};

const loadCollapsedProjects = () => {
  try {
    return JSON.parse(localStorage.getItem('task_collapsed_projects') || '{}');
  } catch (e) {
    return {};
  }
};

const collapsedGroups = ref<Record<string, boolean>>(loadCollapsedGroups());
const collapsedProjects = ref<Record<string, boolean>>(loadCollapsedProjects());

watch(
  collapsedGroups,
  (newVal) => {
    localStorage.setItem('task_collapsed_groups', JSON.stringify(newVal));
  },
  { deep: true },
);

watch(
  collapsedProjects,
  (newVal) => {
    localStorage.setItem('task_collapsed_projects', JSON.stringify(newVal));
  },
  { deep: true },
);

const expandedTasks = ref<Record<string, boolean>>({});
const newSubtaskTexts = ref<Record<string, string>>({});

const toggleTaskExpand = (taskId: string) => {
  expandedTasks.value[taskId] = !expandedTasks.value[taskId];
};

const teamMembers = ref<any[]>([]);
const projects = ref<any[]>([]);
const teams = ref<any[]>([]);

const statusColumns = computed(() => [
  {
    id: 'TODO',
    title: t('tasks.todo'),
    color: 'bg-slate-500',
    headerBg: 'from-slate-500/10 to-transparent',
  },
  {
    id: 'IN_PROGRESS',
    title: t('tasks.inProgress'),
    color: 'bg-accent',
    headerBg: 'from-accent/10 to-transparent',
  },
  {
    id: 'DONE',
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
    title: '无优先级',
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

const toggleColumnVisibility = (col: keyof typeof visibleColumns.value) => {
  visibleColumns.value[col] = !visibleColumns.value[col];
  localStorage.setItem(`task_visible_col_${col}`, String(visibleColumns.value[col]));
};

const nameColSpanClass = computed(() => {
  let span = 12;
  if (visibleColumns.value.status) span -= 1;
  if (visibleColumns.value.project) span -= 2;
  if (visibleColumns.value.assignee) span -= 2;
  if (visibleColumns.value.dueDate) span -= 1;
  if (visibleColumns.value.priority) span -= 1;

  const map: Record<number, string> = {
    3: 'col-span-3',
    4: 'col-span-4',
    5: 'col-span-5',
    6: 'col-span-6',
    7: 'col-span-7',
    8: 'col-span-8',
    9: 'col-span-9',
    10: 'col-span-10',
    11: 'col-span-11',
    12: 'col-span-12',
  };
  return map[span] || 'col-span-3';
});

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
        (t) => t.dueDate && new Date(t.dueDate) < now && t.status !== 'DONE',
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
    filtered = filtered.filter((t) => t.status !== 'DONE');
  }

  if (onlyMyTasks.value && authStore.user?.id) {
    const myId = authStore.user.id;
    filtered = filtered.filter((t) => t.assigneeId === myId);
  }

  if (selectedProjectId.value) {
    filtered = filtered.filter((t) => t.projectId === selectedProjectId.value);
  }

  return filtered;
});

const tasksByProject = computed(() => {
  const filtered = filteredTasks.value;
  const projectMap: Record<string, any> = {};

  projectMap['unassigned'] = {
    id: null,
    name: '未指定项目',
    tasks: [],
  };

  projects.value.forEach((p) => {
    projectMap[p.id] = {
      id: p.id,
      name: p.title,
      tasks: [],
    };
  });

  filtered.forEach((t) => {
    const pid = t.projectId || 'unassigned';
    if (!projectMap[pid]) {
      projectMap[pid] = {
        id: t.projectId,
        name: t.project?.title || '未知项目',
        tasks: [],
      };
    }
    projectMap[pid].tasks.push(t);
  });

  const result = Object.values(projectMap).filter((g: any) => g.tasks.length > 0);

  result.sort((a: any, b: any) => {
    if (a.id === null) return 1;
    if (b.id === null) return -1;
    return a.name.localeCompare(b.name);
  });

  return result;
});

const getTasksByGroupInProject = (projectTasks: any[], colId: string) => {
  if (groupBy.value === 'status') {
    return projectTasks.filter((t) => t.status === colId);
  } else {
    if (colId === 'NONE') {
      return projectTasks.filter((t) => !t.priority || t.priority === 'NONE');
    }
    return projectTasks.filter((t) => t.priority === colId);
  }
};

const getGroupCollapseKey = (projectId: string | null, colId: string) => {
  return `${projectId || 'unassigned'}_${colId}`;
};

const isGroupCollapsed = (projectId: string | null, colId: string) => {
  return !!collapsedGroups.value[getGroupCollapseKey(projectId, colId)];
};

const toggleGroupCollapseKey = (projectId: string | null, colId: string) => {
  const key = getGroupCollapseKey(projectId, colId);
  collapsedGroups.value[key] = !collapsedGroups.value[key];
};

const isProjectCollapsed = (projectId: string | null) => {
  return !!collapsedProjects.value[projectId || 'unassigned'];
};

const toggleProjectCollapse = (projectId: string | null) => {
  const key = projectId || 'unassigned';
  collapsedProjects.value[key] = !collapsedProjects.value[key];
};

const tasksByGroup = computed(() => {
  const filtered = filteredTasks.value;
  const map: Record<string, any[]> = {};
  if (groupBy.value === 'status') {
    map['TODO'] = filtered.filter((t) => t.status === 'TODO');
    map['IN_PROGRESS'] = filtered.filter((t) => t.status === 'IN_PROGRESS');
    map['DONE'] = filtered.filter((t) => t.status === 'DONE');
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
  return Math.round((tasks.value.filter((t) => t.status === 'DONE').length / total) * 100);
});

const overdueCount = computed(() => {
  const now = new Date();
  return tasks.value.filter((t) => t.dueDate && new Date(t.dueDate) < now && t.status !== 'DONE')
    .length;
});

const parseSubtasks = (subtasksStr: string | null | undefined): any[] => {
  if (!subtasksStr) return [];
  try {
    return JSON.parse(subtasksStr);
  } catch (e) {
    return [];
  }
};

const fetchTasks = async () => {
  isLoading.value = true;
  try {
    const response = await api.get('/api/tasks');
    tasks.value = response.data;
  } catch (error) {
    ElMessage.error('获取任务失败');
  } finally {
    isLoading.value = false;
  }
};

const fetchStats = async () => {
  try {
    const response = await api.get('/api/tasks/stats');
    stats.value = response.data;
  } catch (error) {
    // silently fail
  }
};

const fetchTeamMembers = async (teamId?: string) => {
  try {
    const tid = teamId || workspaceStore.activeTeamId;
    if (!tid) return;
    const response = await api.get(`/api/teams/${tid}/members`);
    teamMembers.value = response.data?.map((m: any) => m.user) || [];
  } catch (error) {
    // silently fail
  }
};

const fetchTeams = async () => {
  try {
    const response = await api.get('/api/teams');
    teams.value = response.data;
  } catch (error) {
    // silently fail
  }
};

const fetchProjects = async () => {
  try {
    const response = await api.get('/api/projects');
    projects.value = response.data;
  } catch (error) {
    // silently fail
  }
};

const handleAddTaskWithPayload = async (payload: any) => {
  try {
    const formattedPayload = {
      ...payload,
      tags: payload.tags.length > 0 ? JSON.stringify(payload.tags) : null,
      assigneeId: payload.assigneeId || null,
      projectId: payload.projectId || null,
      teamId: payload.teamId || null,
      participantIds: payload.participantIds.length > 0 ? payload.participantIds : undefined,
    };
    await api.post('/api/tasks', formattedPayload);
    ElMessage.success('任务已添加');
    isAddDialogOpen.value = false;
    fetchTasks();
    fetchStats();
  } catch (error: any) {
    if (error.response?.data?.error === '部分指定人员不在该团队中') {
      ElMessage.error('部分指定人员不在该团队中，请重新选择');
    } else {
      ElMessage.error('添加任务失败');
    }
  }
};

const onDragChange = async (event: any, columnId: string) => {
  if (event.added) {
    const task = event.added.element;
    try {
      const updatePayload: any = { ...task };
      if (groupBy.value === 'status') {
        updatePayload.status = columnId;
      } else {
        updatePayload.priority = columnId;
      }

      const cleanPayload = {
        title: updatePayload.title,
        description: updatePayload.description,
        status: updatePayload.status,
        priority: updatePayload.priority,
        tags: updatePayload.tags,
        dueDate: updatePayload.dueDate,
        assigneeId: updatePayload.assigneeId,
        projectId: updatePayload.projectId,
        subtasks: updatePayload.subtasks,
        participantIds: updatePayload.participants
          ? updatePayload.participants.map((p: any) => p.userId)
          : [],
      };

      await api.put(`/api/tasks/${task.id}`, cleanPayload);

      if (groupBy.value === 'status') {
        const labels: Record<string, string> = {
          TODO: '待办',
          IN_PROGRESS: '进行中',
          DONE: '已完成',
        };
        ElMessage.success(`已移动到 ${labels[columnId] || columnId}`);
        const taskIndex = tasks.value.findIndex((t) => t.id === task.id);
        if (taskIndex !== -1) {
          tasks.value[taskIndex].status = columnId;
        }
      } else {
        const labels: Record<string, string> = {
          URGENT: '紧急',
          HIGH: '高',
          MEDIUM: '中',
          LOW: '低',
          NONE: '无',
        };
        ElMessage.success(`优先级已更新为 ${labels[columnId] || columnId}`);
        const taskIndex = tasks.value.findIndex((t) => t.id === task.id);
        if (taskIndex !== -1) {
          tasks.value[taskIndex].priority = columnId;
        }
      }
      fetchStats();
    } catch (error) {
      ElMessage.error('更新失败');
      fetchTasks();
    }
  }
};

const openAddDialogByCol = (colId: string, projectId: string | null = null) => {
  if (groupBy.value === 'status') {
    newTask.value.status = colId;
    newTask.value.priority = 'MEDIUM';
  } else {
    newTask.value.priority = colId === 'NONE' ? 'MEDIUM' : colId;
    newTask.value.status = 'TODO';
  }
  newTask.value.projectId = projectId || '';
  newTask.value.teamId = workspaceStore.activeTeamId || '';
  if (newTask.value.teamId) {
    fetchTeamMembers(newTask.value.teamId);
  }
  isAddDialogOpen.value = true;
};

const openAddDialog = (status: string = 'TODO') => {
  openAddDialogByCol(status);
};

// Removed onAddTaskTeamChange

const handleInlineAdd = async (columnId: string) => {
  const title = inlineTitles.value[columnId]?.trim();
  if (!title) return;

  try {
    const payload = {
      title,
      status: groupBy.value === 'status' ? columnId : 'TODO',
      priority: groupBy.value === 'priority' ? columnId : 'MEDIUM',
      teamId: workspaceStore.activeTeamId || null,
      subtasks: '[]',
      tags: null,
      dueDate: null,
      assigneeId: null,
      projectId: null,
      participantIds: [],
    };

    await api.post('/api/tasks', payload);
    ElMessage.success('任务已快速创建');
    inlineTitles.value[columnId] = '';
    fetchTasks();
    fetchStats();
  } catch (error) {
    ElMessage.error('快速创建任务失败');
  }
};

const handleInlineAddInProject = async (columnId: string, projectId: string | null) => {
  const key = `${columnId}_${projectId || 'unassigned'}`;
  const title = inlineTitles.value[key]?.trim();
  if (!title) return;

  try {
    const payload = {
      title,
      status: groupBy.value === 'status' ? columnId : 'TODO',
      priority: groupBy.value === 'priority' ? columnId : 'MEDIUM',
      teamId: workspaceStore.activeTeamId || null,
      subtasks: '[]',
      tags: null,
      dueDate: null,
      assigneeId: null,
      projectId: projectId || null,
      participantIds: [],
    };

    await api.post('/api/tasks', payload);
    ElMessage.success('任务已快速创建');
    inlineTitles.value[key] = '';
    fetchTasks();
    fetchStats();
  } catch (error) {
    ElMessage.error('快速创建任务失败');
  }
};

const deleteTask = (task: any) => {
  ElMessageBox.confirm('确定删除该任务吗？', '提示', {
    type: 'warning',
    confirmButtonText: '确定删除',
    cancelButtonText: '取消',
  }).then(async () => {
    try {
      await api.delete(`/api/tasks/${task.id}`);
      ElMessage.success('已删除');
      isDetailDrawerOpen.value = false;
      fetchTasks();
      fetchStats();
    } catch (error) {
      ElMessage.error('删除失败');
    }
  });
};

const openDetailDrawer = (task: any) => {
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

const autoSaveTask = async (payload: any) => {
  if (!activeTask.value) return;
  try {
    await api.put(`/api/tasks/${activeTask.value.id}`, payload);

    // Update the local task object attributes immediately
    const idx = tasks.value.findIndex((t) => t.id === activeTask.value.id);
    if (idx !== -1) {
      tasks.value[idx].title = payload.title;
      tasks.value[idx].description = payload.description;
      tasks.value[idx].status = payload.status;
      tasks.value[idx].priority = payload.priority;
      tasks.value[idx].dueDate = payload.dueDate;
      tasks.value[idx].assigneeId = payload.assigneeId;
      tasks.value[idx].projectId = payload.projectId;
      tasks.value[idx].teamId = payload.teamId;
      tasks.value[idx].tags = payload.tags;
      tasks.value[idx].subtasks = payload.subtasks;

      // Re-resolve team and project relationships dynamically after save
      const assignedTeam = teams.value.find((t) => t.id === payload.teamId);
      const assignedProj = projects.value.find((p) => p.id === payload.projectId);
      tasks.value[idx].team = assignedTeam
        ? { id: assignedTeam.id, name: assignedTeam.name, avatarUrl: assignedTeam.avatarUrl }
        : null;
      tasks.value[idx].project = assignedProj
        ? { id: assignedProj.id, title: assignedProj.title, color: assignedProj.color }
        : null;
    }
    fetchStats();
  } catch (error) {
    console.error('自动保存失败', error);
  }
};

const quickStatusChange = async (task: any, newStatus: string) => {
  try {
    await api.put(`/api/tasks/${task.id}`, { status: newStatus });
    ElMessage.success(
      `已移动到 ${newStatus === 'DONE' ? '已完成' : newStatus === 'IN_PROGRESS' ? '进行中' : '待办'}`,
    );
    fetchTasks();
    fetchStats();
  } catch (error) {
    ElMessage.error('更新状态失败');
  }
};

const toggleTaskCompletion = async (task: any) => {
  const nextStatus = task.status === 'DONE' ? 'TODO' : 'DONE';
  await quickStatusChange(task, nextStatus);
};

// Removed handleTeamChange

const handleProjectChange = async (task: any, projectId: string | null) => {
  try {
    await api.put(`/api/tasks/${task.id}`, { projectId });
    ElMessage.success(projectId ? '已关联项目' : '已取消关联项目');
    fetchTasks();
  } catch (error) {
    ElMessage.error('更新关联项目失败');
  }
};

const handleAssigneeChange = async (task: any, assigneeId: string | null) => {
  try {
    await api.put(`/api/tasks/${task.id}`, { assigneeId });
    ElMessage.success(assigneeId ? '已成功指派负责人' : '已清除负责人');
    fetchTasks();
  } catch (error) {
    ElMessage.error('更新负责人失败');
  }
};

const getUserById = (userId: string | null, task: any) => {
  if (!userId) return null;
  for (const team of teams.value) {
    if (team.members) {
      const member = team.members.find((m: any) => m.user?.id === userId);
      if (member) return member.user;
    }
  }
  const m = teamMembers.value.find((u) => u.id === userId);
  if (m) return m;
  if (task && task.assignee && task.assignee.id === userId) {
    return task.assignee;
  }
  return null;
};

const getMembersForSubtask = (task: any) => {
  if (task.teamId) {
    const team = teams.value.find((t) => t.id === task.teamId);
    if (team && team.members) {
      return team.members.map((m: any) => m.user);
    }
  }
  return teamMembers.value;
};

const toggleSubtaskInline = async (task: any, subIdx: number) => {
  const list = parseSubtasks(task.subtasks);
  if (list[subIdx]) {
    list[subIdx].done = !list[subIdx].done;
    try {
      const subtasksStr = JSON.stringify(list);
      await api.put(`/api/tasks/${task.id}`, { subtasks: subtasksStr });
      task.subtasks = subtasksStr;
      fetchStats();
    } catch (error) {
      ElMessage.error('更新子任务失败');
    }
  }
};

const removeSubtaskInline = async (task: any, subIdx: number) => {
  const list = parseSubtasks(task.subtasks);
  list.splice(subIdx, 1);
  try {
    const subtasksStr = JSON.stringify(list);
    await api.put(`/api/tasks/${task.id}`, { subtasks: subtasksStr });
    task.subtasks = subtasksStr;
    fetchStats();
    ElMessage.success('子任务已删除');
  } catch (error) {
    ElMessage.error('删除子任务失败');
  }
};

const handleSubtaskAssigneeChange = async (
  task: any,
  subIdx: number,
  assigneeId: string | null,
) => {
  const list = parseSubtasks(task.subtasks);
  if (list[subIdx]) {
    list[subIdx].assigneeId = assigneeId;
    try {
      const subtasksStr = JSON.stringify(list);
      await api.put(`/api/tasks/${task.id}`, { subtasks: subtasksStr });
      task.subtasks = subtasksStr;
    } catch (error) {
      ElMessage.error('指派子任务负责人失败');
    }
  }
};

const addSubtaskInline = async (task: any) => {
  const text = newSubtaskTexts.value[task.id]?.trim();
  if (!text) return;
  const list = parseSubtasks(task.subtasks);
  list.push({
    id: Math.random().toString(36).substr(2, 9),
    text,
    done: false,
    teamId: task.teamId || null,
    assigneeId: null,
  });
  try {
    const subtasksStr = JSON.stringify(list);
    await api.put(`/api/tasks/${task.id}`, { subtasks: subtasksStr });
    task.subtasks = subtasksStr;
    newSubtaskTexts.value[task.id] = '';
    fetchStats();
    ElMessage.success('子任务已添加');
  } catch (error) {
    ElMessage.error('添加子任务失败');
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
      class="h-auto md:h-13 px-4 sm:px-6 py-3 md:py-0 flex flex-col md:flex-row md:items-center justify-between shrink-0 border-b transition-colors duration-300 gap-3"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <div class="flex items-center justify-between w-full md:w-auto">
        <div class="flex items-center gap-2">
          <div class="p-1.5 bg-accent/10 rounded-lg">
            <CheckCircle2 class="w-4.5 h-4.5 text-accent" />
          </div>
          <h1 class="text-base md:text-lg font-bold" style="color: var(--text-primary)">任务看板</h1>
        </div>

        <button
          class="md:hidden p-2 bg-accent text-white rounded-lg shadow-lg shadow-accent/20 hover:shadow-none transition-all flex items-center justify-center shrink-0"
          @click="openAddDialog('TODO')"
        >
          <Plus class="w-4 h-4" />
        </button>
      </div>

      <div class="flex items-center gap-2 sm:gap-2.5 w-full md:w-auto">
        <div class="relative flex-1 md:flex-none">
          <Search class="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索任务..."
            class="pl-8 pr-3 py-1.5 bg-slate-100 dark:bg-white/5 border-none rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-accent/20 w-full md:w-40 lg:w-48 transition-all"
            style="color: var(--text-primary)"
          />
        </div>

        <div class="flex p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg shrink-0">
          <button
            class="p-1 rounded-md transition-all"
            :class="
              viewMode === 'board'
                ? 'bg-white dark:bg-slate-700 text-accent shadow-sm'
                : 'text-slate-400 hover:text-slate-600'
            "
            @click="viewMode = 'board'"
          >
            <LayoutGrid class="w-3.5 h-3.5" />
          </button>
          <button
            class="p-1 rounded-md transition-all"
            :class="
              viewMode === 'list'
                ? 'bg-white dark:bg-slate-700 text-accent shadow-sm'
                : 'text-slate-400 hover:text-slate-600'
            "
            @click="viewMode = 'list'"
          >
            <List class="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          class="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold hover:bg-slate-200/50 dark:hover:bg-white/10 transition-all"
          @click="router.push({ path: '/team-tasks', query: { openCreate: 'true' } })"
        >
          <FolderPlus class="w-3.5 h-3.5 text-slate-500" /> 新建项目
        </button>

        <button
          class="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-accent text-white rounded-lg text-xs font-bold hover:shadow-lg hover:shadow-accent/20 transition-all"
          @click="openAddDialog('TODO')"
        >
          <Plus class="w-3.5 h-3.5" /> 新建任务
        </button>
      </div>
    </div>

    <!-- Stats + Filter Bar -->
    <div
      class="task-filter-bar px-4 sm:px-6 py-2 border-b flex flex-nowrap md:flex-wrap items-center gap-3 sm:gap-4 shrink-0 overflow-x-auto md:overflow-x-visible scrollbar-hide"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <!-- Stats Cards -->
      <div class="flex flex-wrap items-center gap-1.5 sm:gap-2 shrink-0">
        <div
          class="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-500/10 whitespace-nowrap"
        >
          <TrendingUp class="w-3 h-3 text-emerald-500" />
          <span class="text-[9px] sm:text-[10px] font-bold text-emerald-600 dark:text-emerald-400"
            >{{ completionRate }}% 完成</span
          >
        </div>
        <div
          v-if="overdueCount > 0"
          class="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-rose-500/10 whitespace-nowrap"
        >
          <AlertCircle class="w-3 h-3 text-rose-500" />
          <span class="text-[9px] sm:text-[10px] font-bold text-rose-600 dark:text-rose-400"
            >{{ overdueCount }} 逾期</span
          >
        </div>
        <div
          class="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 dark:bg-white/5 whitespace-nowrap"
        >
          <BarChart3 class="w-3 h-3 text-slate-400" />
          <span class="text-[9px] sm:text-[10px] font-bold text-slate-500"
            >{{ tasks.length }} 总计</span
          >
        </div>
      </div>

      <!-- Project Filter Pill -->
      <div
        v-if="selectedProjectId"
        class="flex items-center gap-1 px-2 py-1 rounded-lg bg-accent/15 border border-accent/30 text-accent whitespace-nowrap shadow-sm text-[9px] sm:text-[10px] font-bold"
      >
        <FolderOpen class="w-3 h-3" />
        <span
          >项目: {{ projects.find((p) => p.id === selectedProjectId)?.title || '加载中...' }}</span
        >
        <button class="hover:text-rose-500 transition-colors ml-1" @click="clearProjectFilter">
          <X class="w-2.5 h-2.5" />
        </button>
      </div>

      <div class="hidden sm:block h-5 w-px bg-slate-200 dark:bg-slate-700 shrink-0"></div>

      <!-- Date Filter -->
      <div class="flex items-center gap-2 shrink-0">
        <span
          class="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap"
          >时间:</span
        >
        <div
          class="flex p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-x-auto scrollbar-hide"
        >
          <button
            v-for="f in [
              { id: 'all', label: '全部' },
              { id: 'overdue', label: '逾期' },
              { id: 'today', label: '今日' },
              { id: 'week', label: '本周' },
            ]"
            :key="f.id"
            class="px-1.5 sm:px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-bold transition-all whitespace-nowrap"
            :class="
              dateFilter === f.id
                ? 'bg-white dark:bg-slate-700 text-accent shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            "
            @click="dateFilter = f.id"
          >
            {{ f.label }}
          </button>
        </div>
      </div>

      <div class="hidden sm:block h-5 w-px bg-slate-200 dark:bg-slate-700 shrink-0"></div>

      <!-- Status Filter -->
      <div class="flex items-center gap-2 shrink-0">
        <span
          class="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap"
          >状态:</span
        >
        <div
          class="flex p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-x-auto scrollbar-hide"
        >
          <button
            v-for="s in [
              { id: 'all', label: '全部' },
              { id: 'TODO', label: '待办', textColor: 'text-slate-500 dark:text-slate-400' },
              { id: 'IN_PROGRESS', label: '进行中', textColor: 'text-blue-500' },
              { id: 'DONE', label: '已完成', textColor: 'text-emerald-500' },
            ]"
            :key="s.id"
            class="px-1.5 sm:px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-bold transition-all whitespace-nowrap"
            :class="
              statusFilter === s.id
                ? 'bg-white dark:bg-slate-700 shadow-sm ' + (s.textColor || 'text-accent')
                : 'text-slate-500 hover:text-slate-700'
            "
            @click="statusFilter = s.id"
          >
            {{ s.label }}
          </button>
        </div>
      </div>

      <div class="hidden sm:block h-5 w-px bg-slate-200 dark:bg-slate-700 shrink-0"></div>

      <!-- Priority Filter -->
      <div class="flex items-center gap-2 shrink-0">
        <span
          class="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap"
          >优先级:</span
        >
        <div
          class="flex p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-x-auto scrollbar-hide"
        >
          <button
            class="px-1.5 sm:px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-bold transition-all whitespace-nowrap"
            :class="
              priorityFilter === 'all'
                ? 'bg-white dark:bg-slate-700 text-accent shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            "
            @click="priorityFilter = 'all'"
          >
            全部
          </button>
          <button
            v-for="p in priorityOptions"
            :key="p.id"
            class="px-1.5 sm:px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-bold transition-all flex items-center gap-1 whitespace-nowrap"
            :class="
              priorityFilter === p.id
                ? 'bg-white dark:bg-slate-700 shadow-sm ' + p.textColor
                : 'text-slate-500 hover:text-slate-700'
            "
            @click="priorityFilter = p.id"
          >
            <component :is="p.icon" class="w-2.5 h-2.5" />
            {{ p.label }}
          </button>
        </div>
      </div>

      <div class="hidden sm:block h-5 w-px bg-slate-200 dark:bg-slate-700 shrink-0"></div>

      <!-- Group By Selector -->
      <div class="flex items-center gap-2 shrink-0">
        <span
          class="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap"
          >分组方式:</span
        >
        <div
          class="flex p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-x-auto scrollbar-hide"
        >
          <button
            class="px-1.5 sm:px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-bold transition-all whitespace-nowrap"
            :class="
              groupBy === 'status'
                ? 'bg-white dark:bg-slate-700 text-accent shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            "
            @click="groupBy = 'status'"
          >
            按状态
          </button>
          <button
            class="px-1.5 sm:px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-bold transition-all whitespace-nowrap"
            :class="
              groupBy === 'priority'
                ? 'bg-white dark:bg-slate-700 text-accent shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            "
            @click="groupBy = 'priority'"
          >
            按优先级
          </button>
        </div>
      </div>

      <div class="hidden sm:block h-5 w-px bg-slate-200 dark:bg-slate-700 shrink-0"></div>

      <!-- Advanced Filter Options (ClickUp Style) -->
      <div class="flex items-center gap-2 shrink-0">
        <!-- Hide Completed Toggle -->
        <button
          class="px-2 py-1 rounded-lg text-[9px] sm:text-[10px] font-bold transition-all flex items-center gap-1 whitespace-nowrap border"
          :class="
            hideCompleted
              ? 'bg-accent/15 border-accent/30 text-accent shadow-sm'
              : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 dark:hover:bg-white/10'
          "
          @click="hideCompleted = !hideCompleted"
        >
          <EyeOff v-if="hideCompleted" class="w-3.5 h-3.5 text-accent" />
          <Eye v-else class="w-3.5 h-3.5 text-slate-400" />
          <span>隐藏已完成</span>
        </button>

        <!-- Only My Tasks Toggle -->
        <button
          class="px-2 py-1 rounded-lg text-[9px] sm:text-[10px] font-bold transition-all flex items-center gap-1 whitespace-nowrap border"
          :class="
            onlyMyTasks
              ? 'bg-accent/15 border-accent/30 text-accent shadow-sm'
              : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 dark:hover:bg-white/10'
          "
          @click="onlyMyTasks = !onlyMyTasks"
        >
          <User class="w-3.5 h-3.5 text-slate-400" :class="{ 'text-accent': onlyMyTasks }" />
          <span>仅看我的</span>
        </button>

        <!-- Column Visibility Popover -->
        <el-popover
          v-if="viewMode === 'list'"
          placement="bottom-end"
          :width="150"
          trigger="click"
          popper-class="glass-popover"
        >
          <template #reference>
            <button
              class="px-2 py-1 rounded-lg text-[9px] sm:text-[10px] font-bold transition-all flex items-center gap-1 whitespace-nowrap border bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 dark:hover:bg-white/10"
            >
              <SlidersHorizontal class="w-3.5 h-3.5 text-slate-400" />
              <span>展示列</span>
            </button>
          </template>
          <div class="p-1 space-y-2.5">
            <div
              class="text-[9px] font-black text-slate-400 dark:text-slate-500 tracking-wider uppercase mb-1"
            >
              显示列表列
            </div>
            <label
              class="flex items-center gap-2 text-xs cursor-pointer text-slate-600 dark:text-slate-300 select-none hover:text-accent transition-colors"
            >
              <input
                type="checkbox"
                :checked="visibleColumns.status"
                class="rounded border-slate-300 dark:border-slate-600 text-accent focus:ring-accent w-3.5 h-3.5"
                @change="toggleColumnVisibility('status')"
              />
              <span>状态</span>
            </label>
            <!-- Removed team column visibility option -->
            <label
              class="flex items-center gap-2 text-xs cursor-pointer text-slate-600 dark:text-slate-300 select-none hover:text-accent transition-colors"
            >
              <input
                type="checkbox"
                :checked="visibleColumns.project"
                class="rounded border-slate-300 dark:border-slate-600 text-accent focus:ring-accent w-3.5 h-3.5"
                @change="toggleColumnVisibility('project')"
              />
              <span>关联项目</span>
            </label>
            <label
              class="flex items-center gap-2 text-xs cursor-pointer text-slate-600 dark:text-slate-300 select-none hover:text-accent transition-colors"
            >
              <input
                type="checkbox"
                :checked="visibleColumns.assignee"
                class="rounded border-slate-300 dark:border-slate-600 text-accent focus:ring-accent w-3.5 h-3.5"
                @change="toggleColumnVisibility('assignee')"
              />
              <span>负责人</span>
            </label>
            <label
              class="flex items-center gap-2 text-xs cursor-pointer text-slate-600 dark:text-slate-300 select-none hover:text-accent transition-colors"
            >
              <input
                type="checkbox"
                :checked="visibleColumns.dueDate"
                class="rounded border-slate-300 dark:border-slate-600 text-accent focus:ring-accent w-3.5 h-3.5"
                @change="toggleColumnVisibility('dueDate')"
              />
              <span>截止日期</span>
            </label>
            <label
              class="flex items-center gap-2 text-xs cursor-pointer text-slate-600 dark:text-slate-300 select-none hover:text-accent transition-colors"
            >
              <input
                type="checkbox"
                :checked="visibleColumns.priority"
                class="rounded border-slate-300 dark:border-slate-600 text-accent focus:ring-accent w-3.5 h-3.5"
                @change="toggleColumnVisibility('priority')"
              />
              <span>优先级</span>
            </label>
          </div>
        </el-popover>

        <!-- Reset Filters Button -->
        <button
          v-if="isAnyFilterActive"
          class="px-2 py-1 rounded-lg text-[9px] sm:text-[10px] font-bold transition-all flex items-center gap-1 whitespace-nowrap border border-dashed border-rose-300 dark:border-rose-700/60 text-rose-500 hover:bg-rose-500/10 hover:border-rose-400"
          @click="resetAllFilters"
        >
          <RotateCcw class="w-3.5 h-3.5 text-rose-500" />
          <span>重置筛选</span>
        </button>
      </div>
    </div>

    <!-- Board View -->
    <div v-if="viewMode === 'board'" class="flex-1 overflow-hidden p-1 sm:p-4">
      <div class="md:gap-4 gap-1 sm:gap-2.5 h-full flex w-full">
        <div
          v-for="col in activeColumns"
          :key="col.id"
          class="flex flex-col min-w-0 sm:min-w-[260px] h-full rounded-lg sm:rounded-xl transition-colors duration-300 overflow-hidden flex-1 relative border"
          style="background-color: var(--bg-card); border-color: var(--border-base)"
        >
          <!-- Column Header -->
          <div
            class="px-1.5 sm:px-4 pt-1.5 sm:pt-3 pb-1 sm:pb-2.5"
            :class="'bg-gradient-to-b ' + col.headerBg"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-1 sm:gap-1.5 min-w-0">
                <div
                  class="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full shrink-0"
                  :class="col.color"
                ></div>
                <h2
                  class="text-[9px] sm:text-xs font-black uppercase tracking-wider truncate"
                  style="color: var(--text-primary)"
                >
                  {{ col.title }}
                </h2>
                <span
                  class="hidden sm:inline-block text-[8px] sm:text-[9px] font-bold px-1.5 py-0.5 bg-slate-100 dark:bg-white/5 rounded-full text-slate-500"
                >
                  {{ tasksByGroup[col.id]?.length || 0 }}
                </span>
              </div>
              <button
                class="hidden sm:inline-flex p-1 rounded-lg text-slate-400 hover:text-accent hover:bg-accent/10 transition-all shrink-0"
                @click="openAddDialogByCol(col.id)"
              >
                <Plus class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <!-- Draggable Task List -->
          <draggable
            :list="tasksByGroup[col.id] || []"
            group="tasks"
            item-key="id"
            class="flex-1 overflow-y-auto space-y-1 sm:space-y-2 px-1 sm:px-3 pb-3 scrollbar-hide min-h-[100px]"
            :animation="200"
            ghost-class="opacity-50"
            :delay="100"
            :delay-on-touch-only="true"
            :touch-start-threshold="5"
            @change="(e: any) => onDragChange(e, col.id)"
          >
            <template #item="{ element: task }">
              <div>
                <TaskCard
                  :task="task"
                  layout="board"
                  @click="openDetailDrawer"
                  @user-click="openUserProfile"
                />
              </div>
            </template>
          </draggable>

          <!-- Inline Column Quick Add -->
          <div
            class="px-1 pb-1.5 pt-1 border-t shrink-0 bg-slate-50/30 dark:bg-white/2"
            style="border-color: var(--border-base)"
          >
            <div class="relative flex items-center">
              <input
                v-model="inlineTitles[col.id]"
                type="text"
                placeholder="+ 快速添加..."
                class="w-full px-1.5 sm:px-2.5 py-1 sm:py-1.5 bg-slate-100 dark:bg-slate-800/40 hover:bg-slate-200 dark:hover:bg-slate-800/70 focus:bg-white dark:focus:bg-slate-800 border border-dashed border-slate-200 dark:border-slate-700 focus:border-accent/40 rounded-lg text-[9px] sm:text-[10px] focus:outline-none transition-all pr-8"
                style="color: var(--text-primary)"
                @keyup.enter="handleInlineAdd(col.id)"
              />
              <button
                v-show="inlineTitles[col.id]?.trim()"
                class="absolute right-1 p-0.5 sm:p-1 bg-accent/10 hover:bg-accent hover:text-white text-accent rounded-md transition-all"
                @click="handleInlineAdd(col.id)"
              >
                <Plus class="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              </button>
            </div>
          </div>

          <!-- Empty State (rendered outside draggable to avoid SortableJS indexing errors) -->
          <div
            v-if="!tasksByGroup[col.id] || tasksByGroup[col.id].length === 0"
            class="absolute inset-x-3 top-16 bottom-14 flex flex-col items-center justify-center border-2 border-dashed rounded-lg sm:rounded-xl opacity-20 hover:opacity-100 hover:border-accent hover:text-accent cursor-pointer transition-all pointer-events-none"
            style="border-color: var(--border-base)"
          >
            <Plus class="w-4 h-4 sm:w-6 sm:h-6 mb-1 sm:mb-2" />
            <p class="hidden sm:block text-[10px] font-bold">拖拽或点击新建</p>
          </div>
        </div>
      </div>
    </div>

    <!-- List View -->
    <div v-if="viewMode === 'list'" class="flex-1 overflow-y-auto p-1 sm:p-8 scrollbar-hide">
      <div class="w-full max-w-6xl mx-auto space-y-8">
        <!-- Project Group Card (大类) -->
        <div
          v-for="proj in tasksByProject"
          :key="proj.id || 'unassigned'"
          class="rounded-xl sm:rounded-2xl border bg-slate-50/15 dark:bg-white/1 transition-all duration-300"
          :class="
            isProjectCollapsed(proj.id)
              ? 'p-2 sm:p-3.5 space-y-0 shadow-sm'
              : 'p-2 sm:p-5 space-y-3 sm:space-y-4'
          "
          style="border-color: var(--border-base)"
        >
          <!-- Project Card Header -->
          <div
            class="flex items-center justify-between px-1 sm:px-2 py-0.5 select-none cursor-pointer group/proj"
            @click="toggleProjectCollapse(proj.id)"
          >
            <div class="flex items-center gap-2.5 min-w-0">
              <!-- Chevron for Project Collapse -->
              <span
                class="transition-transform duration-200 text-slate-400 group-hover/proj:text-accent"
                :class="isProjectCollapsed(proj.id) ? '-rotate-90' : ''"
              >
                <ChevronRight class="w-4 h-4 shrink-0" />
              </span>
              <FolderOpen class="w-4 h-4 text-accent shrink-0" />
              <h2
                class="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 truncate"
                style="color: var(--text-primary)"
              >
                {{ proj.name }}
              </h2>
              <span
                class="text-[9px] sm:text-[10px] font-bold px-2 py-0.5 bg-slate-100 dark:bg-white/5 rounded-full text-slate-400 shrink-0"
              >
                {{ proj.tasks.length }} 个任务
              </span>
            </div>

            <span
              v-if="isProjectCollapsed(proj.id)"
              class="text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-500 font-medium font-mono select-none"
            >
              点击展开项目
            </span>
          </div>

          <!-- Status Groups inside Project -->
          <div v-show="!isProjectCollapsed(proj.id)" class="space-y-4">
            <div
              v-for="col in activeColumns"
              :key="col.id"
              class="rounded-xl border shadow-sm overflow-hidden bg-card"
              style="background-color: var(--bg-card); border-color: var(--border-base)"
            >
              <!-- Section Group Header -->
              <div
                class="px-2 sm:px-4 py-2 sm:py-3 flex items-center justify-between cursor-pointer select-none border-b transition-colors bg-slate-50/50 dark:bg-white/2 hover:bg-slate-100/50 dark:hover:bg-white/5"
                style="border-color: var(--border-base)"
                @click="toggleGroupCollapseKey(proj.id, col.id)"
              >
                <div class="flex items-center gap-3 min-w-0">
                  <!-- Collapse Chevron -->
                  <span
                    class="transition-transform duration-200"
                    :class="isGroupCollapsed(proj.id, col.id) ? '-rotate-90' : ''"
                  >
                    <Plus
                      v-if="isGroupCollapsed(proj.id, col.id)"
                      class="w-3.5 h-3.5 text-slate-400"
                    />
                    <Minus v-else class="w-3.5 h-3.5 text-slate-400" />
                  </span>

                  <!-- Column Tag (ClickUp Style colored pill) -->
                  <span
                    class="px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white shadow-sm shrink-0"
                    :class="col.color"
                  >
                    {{ col.title }}
                  </span>

                  <!-- Tasks count -->
                  <span class="text-xs font-bold text-slate-400 shrink-0">
                    {{ getTasksByGroupInProject(proj.tasks, col.id).length }}
                  </span>
                </div>

                <!-- Header Quick Add -->
                <button
                  class="p-1 hover:bg-accent/10 rounded-lg text-slate-400 hover:text-accent transition-all shrink-0"
                  @click.stop="openAddDialogByCol(col.id, proj.id)"
                >
                  <Plus class="w-3.5 h-3.5" />
                </button>
              </div>

              <!-- Section Tasks List (Table Layout) -->
              <div v-show="!isGroupCollapsed(proj.id, col.id)" class="overflow-x-auto">
                <!-- Table Header Row -->
                <div
                  v-if="getTasksByGroupInProject(proj.tasks, col.id).length > 0"
                  class="grid grid-cols-12 px-1.5 sm:px-4 py-1.5 sm:py-2 border-b text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 select-none bg-slate-100/30 dark:bg-white/1"
                  style="border-color: var(--border-base)"
                >
                  <div :class="nameColSpanClass" class="flex items-center gap-1">任务名称</div>
                  <div v-if="visibleColumns.status" class="col-span-1 text-center">状态</div>
                  <div v-if="visibleColumns.project" class="col-span-2 text-center">关联项目</div>
                  <div v-if="visibleColumns.assignee" class="col-span-2 text-center">负责人</div>
                  <div v-if="visibleColumns.dueDate" class="col-span-1 text-center">截止日期</div>
                  <div v-if="visibleColumns.priority" class="col-span-1 text-center">优先级</div>
                </div>

                <!-- Task Rows -->
                <div
                  class="divide-y divide-slate-100 dark:divide-white/5"
                  style="border-color: var(--border-base)"
                >
                  <template
                    v-for="task in getTasksByGroupInProject(proj.tasks, col.id)"
                    :key="task.id"
                  >
                    <div
                      class="grid grid-cols-12 px-1.5 sm:px-4 py-1.5 sm:py-2.5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors items-center text-[10.5px] sm:text-xs group cursor-pointer"
                      @click="openDetailDrawer(task)"
                    >
                      <!-- Task Name & Subtasks Indicator -->
                      <div :class="nameColSpanClass" class="flex items-center gap-2 min-w-0">
                        <!-- Expand Chevron -->
                        <button
                          class="p-0.5 hover:bg-slate-200 dark:hover:bg-white/10 rounded transition-transform duration-200 shrink-0"
                          :class="expandedTasks[task.id] ? 'rotate-90' : ''"
                          @click.stop="toggleTaskExpand(task.id)"
                        >
                          <ChevronRight class="w-3.5 h-3.5 text-slate-400" />
                        </button>

                        <!-- Checkbox Circle to complete -->
                        <button
                          class="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5 rounded-full border flex items-center justify-center transition-colors shrink-0"
                          :class="
                            task.status === 'DONE'
                              ? 'border-emerald-500 bg-emerald-500/10'
                              : 'border-slate-300 dark:border-slate-650 hover:border-emerald-500 hover:bg-emerald-500/10'
                          "
                          @click.stop="toggleTaskCompletion(task)"
                        >
                          <CheckCircle2
                            class="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 transition-colors"
                            :class="
                              task.status === 'DONE'
                                ? 'text-emerald-500'
                                : 'text-slate-350 dark:text-slate-600 group-hover:text-emerald-500'
                            "
                          />
                        </button>

                        <span
                          class="truncate font-semibold transition-colors group-hover:text-accent"
                          :class="
                            task.status === 'DONE'
                              ? 'line-through text-slate-400 dark:text-slate-500'
                              : ''
                          "
                          style="color: var(--text-primary)"
                        >
                          {{ task.title }}
                        </span>

                        <!-- Subtasks Checklist Badge inside list row -->
                        <span
                          v-if="task.subtasks && JSON.parse(task.subtasks).length > 0"
                          class="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-slate-100 dark:bg-white/10 rounded-md text-[9px] font-bold text-slate-400 shrink-0"
                          title="子任务进度"
                        >
                          <CheckSquare class="w-2.5 h-2.5" />
                          {{ JSON.parse(task.subtasks).filter((s: any) => s.done).length }}/{{
                            JSON.parse(task.subtasks).length
                          }}
                        </span>

                        <!-- Tags (small) -->
                        <div
                          v-if="task.tags && JSON.parse(task.tags).length > 0"
                          class="hidden sm:flex flex-wrap gap-1 ml-2 min-w-0"
                        >
                          <span
                            v-for="tag in JSON.parse(task.tags)"
                            :key="tag"
                            class="px-1.5 py-0.5 rounded text-[8px] font-bold tracking-tight shrink-0 scale-95"
                            :class="getTagClass(tag)"
                          >
                            {{ tag }}
                          </span>
                        </div>
                      </div>

                       <!-- Status (状态) -->
                      <div
                        v-if="visibleColumns.status"
                        class="col-span-1 text-center text-slate-450 dark:text-slate-400 font-medium truncate px-0.5"
                        @click.stop
                      >
                        <el-dropdown
                          trigger="click"
                          @command="(cmd: any) => quickStatusChange(task, cmd)"
                        >
                          <span
                            class="inline-flex items-center gap-1 max-w-full cursor-pointer hover:text-accent py-0.5 px-0.5 sm:px-1.5 rounded hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                          >
                            <span
                              class="text-[8px] sm:text-[9px] px-1 sm:px-1.5 py-0.5 rounded font-bold"
                              :class="
                                task.status === 'TODO'
                                  ? 'bg-slate-500/10 text-slate-500'
                                  : task.status === 'IN_PROGRESS'
                                    ? 'bg-blue-500/10 text-blue-500'
                                    : 'bg-emerald-500/10 text-emerald-500'
                              "
                            >
                              {{
                                task.status === 'TODO'
                                  ? '待办'
                                  : task.status === 'IN_PROGRESS'
                                    ? '进行中'
                                    : '已完成'
                              }}
                            </span>
                          </span>
                          <template #dropdown>
                            <el-dropdown-menu>
                              <el-dropdown-item command="TODO">待办</el-dropdown-item>
                              <el-dropdown-item command="IN_PROGRESS">进行中</el-dropdown-item>
                              <el-dropdown-item command="DONE">已完成</el-dropdown-item>
                            </el-dropdown-menu>
                          </template>
                        </el-dropdown>
                      </div>

                      <!-- Removed Team column cell -->

                      <!-- Project (关联项目) -->
                      <div
                        v-if="visibleColumns.project"
                        class="col-span-2 text-center text-slate-450 dark:text-slate-400 font-medium truncate px-0.5"
                        @click.stop
                      >
                        <el-dropdown
                          trigger="click"
                          @command="(cmd: any) => handleProjectChange(task, cmd)"
                        >
                          <span
                            class="inline-flex items-center gap-0.5 sm:gap-1 max-w-full cursor-pointer hover:text-accent py-0.5 px-0.5 sm:px-1.5 rounded hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                          >
                            <FolderOpen class="w-3 h-3 text-accent shrink-0" />
                            <span v-if="task.project" class="truncate max-w-[40px] sm:max-w-[85px] text-[8px] sm:text-xs">{{
                              task.project.title
                            }}</span>
                            <span
                              v-else
                              class="text-slate-450 dark:text-slate-400 text-[8px] sm:text-[10px] font-bold"
                              >+ 项目</span
                            >
                          </span>
                          <template #dropdown>
                            <el-dropdown-menu>
                              <el-dropdown-item :command="null">清除项目</el-dropdown-item>
                              <el-dropdown-item v-for="p in projects" :key="p.id" :command="p.id">
                                {{ p.title }}
                              </el-dropdown-item>
                            </el-dropdown-menu>
                          </template>
                        </el-dropdown>
                      </div>

                      <!-- Assignee (负责人) -->
                      <div
                        v-if="visibleColumns.assignee"
                        class="col-span-2 flex items-center justify-center gap-0.5 sm:gap-1.5 px-0.5 min-w-0"
                        @click.stop
                      >
                        <el-dropdown
                          trigger="click"
                          @command="(cmd: any) => handleAssigneeChange(task, cmd)"
                        >
                          <span
                            class="inline-flex items-center gap-0.5 sm:gap-1 max-w-full cursor-pointer hover:text-accent py-0.5 px-0.5 sm:px-1.5 rounded hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                          >
                            <template v-if="task.assignee">
                              <img
                                v-if="task.assignee.avatarUrl"
                                :src="task.assignee.avatarUrl"
                                class="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full object-cover shrink-0"
                              />
                              <div
                                v-else
                                class="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-accent/10 flex items-center justify-center shrink-0"
                              >
                                <User class="w-2 h-2 text-accent" />
                              </div>
                              <span class="hidden sm:inline text-[10px] text-slate-400 truncate max-w-[60px]">{{
                                task.assignee.name
                              }}</span>
                            </template>
                            <span
                              v-else
                              class="text-slate-450 dark:text-slate-400 text-[8px] sm:text-[10px] font-bold"
                              >+ 负责人</span
                            >
                          </span>
                          <template #dropdown>
                            <el-dropdown-menu>
                              <el-dropdown-item :command="null">清除负责人</el-dropdown-item>
                              <el-dropdown-item
                                v-for="m in teamMembers"
                                :key="m.id"
                                :command="m.id"
                              >
                                <div class="flex items-center gap-2">
                                  <img
                                    v-if="m.avatarUrl"
                                    :src="m.avatarUrl"
                                    class="w-5 h-5 rounded-lg object-cover"
                                  />
                                  <span>{{ m.name }}</span>
                                </div>
                              </el-dropdown-item>
                            </el-dropdown-menu>
                          </template>
                        </el-dropdown>
                      </div>

                      <!-- Due Date -->
                      <div
                        v-if="visibleColumns.dueDate"
                        class="col-span-1 text-center text-[8px] sm:text-[10px] px-0.5 font-semibold"
                      >
                        <span
                          v-if="task.dueDate"
                          :class="
                            new Date(task.dueDate) < new Date() && task.status !== 'DONE'
                              ? 'text-rose-500'
                              : 'text-slate-400'
                          "
                        >
                          <span class="hidden sm:inline">{{ new Date(task.dueDate).toLocaleDateString() }}</span>
                          <span class="sm:hidden">{{ new Date(task.dueDate).getMonth() + 1 }}/{{ new Date(task.dueDate).getDate() }}</span>
                        </span>
                        <span v-else class="text-slate-350 dark:text-slate-650">-</span>
                      </div>

                      <!-- Priority -->
                      <div
                        v-if="visibleColumns.priority"
                        class="col-span-1 text-center font-bold px-0.5"
                      >
                        <span
                          v-if="task.priority"
                          class="text-[7.5px] sm:text-[9px] px-1 sm:px-1.5 py-0.5 rounded"
                          :class="
                            task.priority === 'URGENT'
                              ? 'bg-rose-500/10 text-rose-500'
                              : task.priority === 'HIGH'
                                ? 'bg-orange-500/10 text-orange-500'
                                : task.priority === 'MEDIUM'
                                  ? 'bg-amber-500/10 text-amber-500'
                                  : task.priority === 'LOW'
                                    ? 'bg-blue-500/10 text-blue-500'
                                    : 'bg-slate-500/10 text-slate-500'
                          "
                        >
                          {{
                            task.priority === 'URGENT'
                              ? '急'
                              : task.priority === 'HIGH'
                                ? '高'
                                : task.priority === 'MEDIUM'
                                  ? '中'
                                  : task.priority === 'LOW'
                                    ? '低'
                                    : '无'
                          }}
                        </span>
                        <span v-else class="text-slate-350 dark:text-slate-600">-</span>
                      </div>
                    </div>

                    <!-- Collapsible Subtasks Checklist Container -->
                    <div
                      v-if="expandedTasks[task.id]"
                      class="col-span-12 pl-12 pr-4 py-3 bg-slate-50/30 dark:bg-white/1 space-y-2 border-t border-b border-slate-100/50 dark:border-white/5"
                      @click.stop
                    >
                      <div
                        class="text-[10px] font-bold text-slate-400 tracking-wider uppercase mb-2"
                      >
                        子任务清单
                      </div>

                      <!-- Subtask Checklist Rows -->
                      <div class="space-y-1.5">
                        <div
                          v-for="(sub, index) in parseSubtasks(task.subtasks)"
                          :key="sub.id"
                          class="flex items-center justify-between py-1.5 px-2 bg-slate-100/50 dark:bg-white/2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors text-xs text-slate-650 dark:text-slate-300"
                        >
                          <div class="flex items-center gap-2.5 min-w-0 flex-1">
                            <!-- Subtask Checklist checkbox -->
                            <button
                              class="w-4 h-4 rounded-full border flex items-center justify-center transition-colors shrink-0"
                              :class="
                                sub.done
                                  ? 'border-emerald-500 bg-emerald-500/10'
                                  : 'border-slate-350 dark:border-slate-600 hover:border-emerald-500 hover:bg-emerald-500/10'
                              "
                              @click.stop="toggleSubtaskInline(task, index as number)"
                            >
                              <CheckCircle2
                                class="w-3 h-3 transition-colors"
                                :class="
                                  sub.done
                                    ? 'text-emerald-500'
                                    : 'text-transparent hover:text-emerald-500'
                                "
                              />
                            </button>

                            <!-- Subtask title text -->
                            <span
                              class="truncate font-medium text-xs"
                              :class="
                                sub.done ? 'line-through text-slate-400 dark:text-slate-500' : ''
                              "
                            >
                              {{ sub.text }}
                            </span>
                          </div>

                          <!-- Subtask Actions: Team & Member drop downs & delete -->
                          <div class="flex items-center gap-3 shrink-0 ml-4">
                            <!-- Removed Subtask Team selector -->

                            <!-- Subtask Assignee -->
                            <el-dropdown
                              trigger="click"
                              @command="
                                (cmd: any) =>
                                  handleSubtaskAssigneeChange(task, index as number, cmd)
                              "
                            >
                              <span
                                class="inline-flex items-center gap-1 cursor-pointer hover:text-accent text-[10px] text-slate-400"
                              >
                                <template v-if="sub.assigneeId">
                                  <img
                                    v-if="getUserById(sub.assigneeId, task)?.avatarUrl"
                                    :src="getUserById(sub.assigneeId, task).avatarUrl"
                                    class="w-3.5 h-3.5 rounded-full object-cover shrink-0"
                                  />
                                  <span class="max-w-[70px] truncate">{{
                                    getUserById(sub.assigneeId, task)?.name || '未知成员'
                                  }}</span>
                                </template>
                                <span
                                  v-else
                                  class="text-slate-400 text-[10px] hover:text-accent font-semibold"
                                  >+ 指派成员</span
                                >
                              </span>
                              <template #dropdown>
                                <el-dropdown-menu>
                                  <el-dropdown-item :command="null">清除成员</el-dropdown-item>
                                  <el-dropdown-item
                                    v-for="m in getMembersForSubtask(task)"
                                    :key="m.id"
                                    :command="m.id"
                                  >
                                    <div class="flex items-center gap-2">
                                      <img
                                        v-if="m.avatarUrl"
                                        :src="m.avatarUrl"
                                        class="w-5 h-5 rounded-lg object-cover"
                                      />
                                      <span>{{ m.name }}</span>
                                    </div>
                                  </el-dropdown-item>
                                </el-dropdown-menu>
                              </template>
                            </el-dropdown>

                            <!-- Delete button -->
                            <button
                              class="p-1 hover:bg-rose-500/10 hover:text-rose-500 text-slate-400 rounded-md transition-all shrink-0"
                              @click.stop="removeSubtaskInline(task, index as number)"
                            >
                              <X class="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>

                      <!-- Inline Quick Add Subtask -->
                      <div class="relative flex items-center max-w-md pt-2 mt-1">
                        <input
                          v-model="newSubtaskTexts[task.id]"
                          type="text"
                          placeholder="+ 快速添加子任务..."
                          class="w-full px-2.5 py-1.5 bg-transparent border border-dashed border-slate-200 dark:border-slate-700 hover:border-slate-350 dark:hover:border-slate-600 focus:border-accent/40 focus:border-solid rounded-lg text-xs focus:outline-none transition-all pr-8"
                          style="color: var(--text-primary)"
                          @keyup.enter="addSubtaskInline(task)"
                        />
                        <button
                          v-show="newSubtaskTexts[task.id]?.trim()"
                          class="absolute right-1.5 p-1 bg-accent/10 hover:bg-accent hover:text-white text-accent rounded-md transition-all"
                          @click="addSubtaskInline(task)"
                        >
                          <Plus class="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </template>

                  <!-- Inline Quick Add row inside List Group -->
                  <div class="px-2 py-1.5 bg-slate-50/20 dark:bg-white/1">
                    <div class="relative flex items-center max-w-xl">
                      <input
                        v-model="inlineTitles[col.id + '_' + (proj.id || 'unassigned')]"
                        type="text"
                        placeholder="+ 快速添加..."
                        class="w-full px-1.5 sm:px-3 py-1 sm:py-1.5 bg-transparent border border-dashed border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 focus:border-accent/40 focus:border-solid rounded-lg text-[9px] sm:text-xs focus:outline-none transition-all pr-8"
                        style="color: var(--text-primary)"
                        @keyup.enter="handleInlineAddInProject(col.id, proj.id)"
                      />
                      <button
                        v-show="inlineTitles[col.id + '_' + (proj.id || 'unassigned')]?.trim()"
                        class="absolute right-1 p-0.5 sm:p-1 bg-accent/10 hover:bg-accent hover:text-white text-accent rounded-md transition-all"
                        @click="handleInlineAddInProject(col.id, proj.id)"
                      >
                        <Plus class="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Empty State for Group -->
                <div
                  v-if="getTasksByGroupInProject(proj.tasks, col.id).length === 0"
                  class="py-8 text-center text-slate-400 text-xs select-none"
                >
                  此列表中暂无任务，可在上方输入框中快速添加。
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Global Empty State -->
        <div
          v-if="tasks.length === 0"
          class="py-20 flex flex-col items-center justify-center bg-card rounded-2xl border"
          style="background-color: var(--bg-card); border-color: var(--border-base)"
        >
          <div
            class="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center mb-4"
          >
            <CheckCircle2 class="w-8 h-8 text-slate-300 dark:text-slate-600" />
          </div>
          <p class="text-sm font-bold text-slate-400 mb-1">暂无任务</p>
          <p class="text-xs text-slate-400 mb-4">点击新建任务按钮开始第一步吧</p>
          <button
            class="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-xl text-xs font-bold hover:shadow-lg hover:shadow-accent/20 transition-all"
            @click="openAddDialog('TODO')"
          >
            <Plus class="w-4 h-4" /> 新建任务
          </button>
        </div>

        <!-- Filtered Empty State -->
        <div
          v-if="tasks.length > 0 && filteredTasks.length === 0"
          class="py-20 flex flex-col items-center justify-center bg-card rounded-2xl border text-center"
          style="background-color: var(--bg-card); border-color: var(--border-base)"
        >
          <div
            class="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center mb-4"
          >
            <SlidersHorizontal class="w-8 h-8 text-slate-300 dark:text-slate-600" />
          </div>
          <p class="text-sm font-bold text-slate-400 mb-1">未找到匹配的任务</p>
          <p class="text-xs text-slate-400 mb-4">
            没有任务符合当前的过滤/搜索条件，请重置或修改筛选条件。
          </p>
          <button
            class="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-200 dark:hover:bg-white/10 transition-all cursor-pointer mx-auto"
            @click="resetAllFilters"
          >
            <RotateCcw class="w-3.5 h-3.5" /> 重置所有筛选
          </button>
        </div>
      </div>
    </div>

    <!-- ClickUp-Style Double-Column Detail Drawer -->
    <TaskDetailDrawer
      v-model="isDetailDrawerOpen"
      v-model:viewMode="taskDetailViewMode"
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
    align-items: stretch;
    gap: 0.75rem;
    padding-top: 0.625rem;
    padding-bottom: 0.625rem;
  }

  .task-filter-bar button {
    min-height: 2.25rem;
    padding: 0.375rem 0.625rem;
    font-size: 0.6875rem;
    line-height: 1rem;
  }

  .task-filter-bar input,
  .task-filter-bar :deep(.el-input__wrapper),
  .task-filter-bar :deep(.el-select__wrapper) {
    min-height: 2.5rem;
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
