<script lang="ts">
import { ref } from 'vue';
import type { Task } from '@/types/task';
const cachedTasksByTeam = ref<Record<string, Task[]>>({});
const cachedStatsByTeam = ref<Record<string, any>>({});
const cachedTeamMembersByTeam = ref<Record<string, any[]>>({});
const cachedProjectsByTeam = ref<Record<string, any[]>>({});
const cachedTeams = ref<any[]>([]);

export default {
  name: 'TaskBoard',
};
</script>

<script setup lang="ts">
import { getApiErrorMessage } from '@/utils/error';
import { computed, watch, onActivated } from 'vue';
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
  Calendar,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import UserProfileDialog from '@/components/UserProfileDialog.vue';
import TaskAddDialog from '@/components/TaskAddDialog.vue';
import TaskDetailDrawer from '@/components/TaskDetailDrawer.vue';
import TaskFilterBar from '@/components/TaskFilterBar.vue';
import Tabs from '@/components/ui/Tabs.vue';
import TaskBoardView from './components/TaskBoardView.vue';
import TaskListView from './components/TaskListView.vue';
import TaskCalendarView from './components/TaskCalendarView.vue';
import api from '@/utils/api';
import { useWorkspaceStore } from '@/stores/workspace';
import { useAuthStore } from '@/stores/auth';
import { getTaskDayIndex, getTaskTime } from '@/utils/taskSort';

import { TaskStatus } from '@/types/task';
import type { UserType, Team, Project, TaskUpdatePayload } from '@/types/task';

const { t } = useI18n();
const workspaceStore = useWorkspaceStore();
const authStore = useAuthStore();
const route = useRoute();
const router = useRouter();

const tasks = ref<Task[]>([]);
const parseTaskProps = (task: Task): Task => {
  if (task.tags && typeof task.tags === 'string') {
    try {
      task.parsedTags = JSON.parse(task.tags);
    } catch {
      task.parsedTags = [];
    }
  } else if (Array.isArray(task.tags)) {
    task.parsedTags = task.tags;
  } else {
    task.parsedTags = [];
  }

  if (task.subtasks && typeof task.subtasks === 'string') {
    try {
      task.parsedSubtasks = JSON.parse(task.subtasks);
    } catch {
      task.parsedSubtasks = [];
    }
  } else if (Array.isArray(task.subtasks)) {
    task.parsedSubtasks = task.subtasks;
  } else {
    task.parsedSubtasks = [];
  }
  return task;
};

const parseTasksList = (list: Task[]): Task[] => {
  return list.map(parseTaskProps);
};
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
const sortOrder = ref<'asc' | 'desc'>('asc');

const assigneeFilter = ref<string>('all');
const tagFilter = ref<string>('all');
const subtaskDisplay = ref<'collapse' | 'expand' | 'separate'>('collapse');

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

const selectedProjectId = ref<string | null>((route.query.projectId as string) || null);

watch(
  () => route.query.projectId,
  (newVal) => {
    selectedProjectId.value = (newVal as string) || null;
  },
);

watch(selectedProjectId, (newVal) => {
  const currentQuery = { ...route.query };
  if (newVal) {
    if (currentQuery.projectId !== newVal) {
      router.replace({ query: { ...currentQuery, projectId: newVal } });
    }
  } else {
    if (currentQuery.projectId !== undefined) {
      router.replace({ query: { ...currentQuery, projectId: undefined } });
    }
  }
});

const clearProjectFilter = () => {
  selectedProjectId.value = null;
};

const loadViewMode = (): 'board' | 'list' | 'calendar' => {
  const saved = localStorage.getItem('task_view_mode');
  return saved === 'list' || saved === 'board' || saved === 'calendar' ? saved : 'list';
};
const viewMode = ref<'board' | 'list' | 'calendar'>(loadViewMode());

watch(viewMode, (newVal) => {
  localStorage.setItem('task_view_mode', newVal);
});
const stats = ref<unknown>(null);

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

const activeTask = ref<Task | null>(null);
const activeSubtaskId = ref<string | null>(null);
const taskDetailViewMode = ref<'drawer' | 'modal'>(
  (localStorage.getItem('task_detail_view_mode') as 'drawer' | 'modal') || 'drawer',
);

watch(taskDetailViewMode, (newVal) => {
  localStorage.setItem('task_detail_view_mode', newVal);
});

// Auto-open task if ID in query params
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

// Grouping features
const groupBy = ref<'status' | 'priority' | 'assignee' | 'dueDate'>('status');

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

const assigneeColumns = computed(() => {
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
});

const dueDateColumns = computed(() => [
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
]);

const activeColumns = computed(() => {
  if (groupBy.value === 'status') return statusColumns.value;
  if (groupBy.value === 'priority') return priorityColumns.value;
  if (groupBy.value === 'assignee') return assigneeColumns.value;
  return dueDateColumns.value;
});

const isAnyFilterActive = computed(() => {
  return (
    searchQuery.value !== '' ||
    dateFilter.value !== 'all' ||
    statusFilter.value !== 'all' ||
    priorityFilter.value !== 'all' ||
    assigneeFilter.value !== 'all' ||
    tagFilter.value !== 'all' ||
    subtaskDisplay.value !== 'collapse' ||
    hideCompleted.value ||
    onlyMyTasks.value ||
    selectedProjectId.value !== null
  );
});

const resetAllFilters = () => {
  searchQuery.value = '';
  dateFilter.value = 'all';
  statusFilter.value = 'all';
  priorityFilter.value = 'all';
  assigneeFilter.value = 'all';
  tagFilter.value = 'all';
  subtaskDisplay.value = 'collapse';
  hideCompleted.value = false;
  onlyMyTasks.value = false;
  selectedProjectId.value = null;
};

const filteredTasks = computed(() => {
  let filtered = tasks.value;

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    filtered = filtered.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        (t.parsedTags && t.parsedTags.some((tag: string) => tag.toLowerCase().includes(q))),
    );
  }

  // Assignee Filter
  if (assigneeFilter.value !== 'all') {
    if (assigneeFilter.value === 'unassigned') {
      filtered = filtered.filter((t) => !t.assigneeId);
    } else {
      filtered = filtered.filter((t) => t.assigneeId === assigneeFilter.value);
    }
  }

  // Tag Filter
  if (tagFilter.value !== 'all') {
    filtered = filtered.filter((t) => {
      return t.parsedTags && t.parsedTags.includes(tagFilter.value);
    });
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
    if (selectedProjectId.value === 'unassigned') {
      filtered = filtered.filter((t) => !t.projectId);
    } else {
      filtered = filtered.filter((t) => t.projectId === selectedProjectId.value);
    }
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

  if (sortOrder.value === 'desc') {
    filtered = [...filtered].reverse();
  }

  return filtered;
});

const allTags = computed(() => {
  const tagsSet = new Set<string>();
  tasks.value.forEach((t) => {
    if (t.parsedTags) {
      t.parsedTags.forEach((tag) => tagsSet.add(tag));
    }
  });
  return Array.from(tagsSet);
});

const processedTasks = computed(() => {
  let list = filteredTasks.value;
  if (subtaskDisplay.value === 'separate') {
    const flattened: Task[] = [];
    list.forEach((t) => {
      flattened.push(t);
      if (t.parsedSubtasks && Array.isArray(t.parsedSubtasks)) {
        t.parsedSubtasks.forEach((sub: any, index: number) => {
          flattened.push({
            id: `${t.id}_sub_${index}`,
            title: sub.text,
            description: `子任务来自: ${t.title}`,
            status: sub.done ? TaskStatus.DONE : TaskStatus.TODO,
            priority: t.priority || 'MEDIUM',
            dueDate: t.dueDate,
            assigneeId: sub.assigneeId || null,
            projectId: t.projectId,
            teamId: t.teamId,
            tags: t.tags,
            parsedTags: t.parsedTags,
            isSubtask: true,
            parentId: t.id,
            subtaskIndex: index,
            project: t.project,
            assignee: sub.assigneeId
              ? teamMembers.value.find((m) => m.id === sub.assigneeId)
              : null,
          } as unknown as Task);
        });
      }
    });
    return flattened;
  }
  return list;
});

const tasksByProject = computed(() => {
  const filtered = processedTasks.value;
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

const getDueDateGroup = (dateStr: string | null | undefined, status: string): string => {
  if (!dateStr) return 'none';
  const d = new Date(dateStr);
  const now = new Date();

  const dDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffTime = dDate.getTime() - nowDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return status === 'DONE' ? 'none' : 'overdue';
  }
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'tomorrow';
  if (diffDays <= 7) return 'week';
  return 'future';
};

const tasksByGroup = computed(() => {
  const filtered = processedTasks.value;
  const map: Record<string, Task[]> = {};

  if (groupBy.value === 'status') {
    map[TaskStatus.TODO] = [];
    map[TaskStatus.IN_PROGRESS] = [];
    map[TaskStatus.DONE] = [];
    filtered.forEach((t) => {
      const status = t.status || TaskStatus.TODO;
      if (map[status]) map[status].push(t);
    });
  } else if (groupBy.value === 'priority') {
    map['URGENT'] = [];
    map['HIGH'] = [];
    map['MEDIUM'] = [];
    map['LOW'] = [];
    map['NONE'] = [];
    filtered.forEach((t) => {
      const p = t.priority || 'NONE';
      if (map[p]) {
        map[p].push(t);
      } else {
        map['NONE'].push(t);
      }
    });
  } else if (groupBy.value === 'assignee') {
    map['unassigned'] = [];
    teamMembers.value.forEach((m) => {
      map[m.id] = [];
    });
    filtered.forEach((t) => {
      if (!t.assigneeId || !map[t.assigneeId]) {
        map['unassigned'].push(t);
      } else {
        map[t.assigneeId].push(t);
      }
    });
  } else if (groupBy.value === 'dueDate') {
    map['overdue'] = [];
    map['today'] = [];
    map['tomorrow'] = [];
    map['week'] = [];
    map['future'] = [];
    map['none'] = [];
    filtered.forEach((t) => {
      const group = getDueDateGroup(t.dueDate, t.status);
      if (map[group]) map[group].push(t);
    });
  }
  return map;
});

const boardTasksByGroup = computed(() => {
  return viewMode.value === 'board' ? tasksByGroup.value : {};
});

const listTasksByProject = computed(() => {
  return viewMode.value === 'list' ? tasksByProject.value : [];
});

const calendarTasks = computed(() => {
  return viewMode.value === 'calendar' ? processedTasks.value : [];
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
  const tid = workspaceStore.activeTeamId || 'personal';
  if (tasks.value.length === 0) {
    isLoading.value = true;
  }
  try {
    const response = await api.get('/api/tasks');
    const parsed = parseTasksList(response.data);
    tasks.value = parsed;
    cachedTasksByTeam.value[tid] = parsed;
  } catch {
    ElMessage.error(t('tasks.fetchFailed'));
  } finally {
    isLoading.value = false;
  }
};

const handleTaskUpdated = (updatedTask?: Task) => {
  const tid = workspaceStore.activeTeamId || 'personal';
  if (updatedTask && updatedTask.id) {
    const parsedTask = parseTaskProps(updatedTask);
    const idx = tasks.value.findIndex((t) => t.id === parsedTask.id);
    if (idx !== -1) {
      tasks.value[idx] = parsedTask;
    } else {
      tasks.value.push(parsedTask);
    }
    if (activeTask.value && activeTask.value.id === parsedTask.id) {
      activeTask.value = parsedTask;
    }
    cachedTasksByTeam.value[tid] = [...tasks.value];
    fetchStats();
  } else {
    fetchTasks();
    fetchStats();
  }
};

const fetchStats = async () => {
  const tid = workspaceStore.activeTeamId || 'personal';
  try {
    const response = await api.get('/api/tasks/stats');
    stats.value = response.data;
    cachedStatsByTeam.value[tid] = response.data;
  } catch {
    // silently fail
  }
};

const fetchTeamMembers = async (teamId?: string) => {
  try {
    const tid = teamId || workspaceStore.activeTeamId;
    if (!tid) return;
    const response = await api.get(`/api/teams/${tid}/members`);
    const list = response.data?.map((m: { user: UserType }) => m.user) || [];
    teamMembers.value = list;
    cachedTeamMembersByTeam.value[tid] = list;
  } catch {
    // silently fail
  }
};

const fetchTeams = async () => {
  try {
    const response = await api.get('/api/teams');
    teams.value = response.data;
    cachedTeams.value = response.data;
  } catch {
    // silently fail
  }
};

const fetchProjects = async () => {
  try {
    const response = await api.get('/api/projects');
    projects.value = response.data;
    const tid = workspaceStore.activeTeamId || 'personal';
    cachedProjectsByTeam.value[tid] = response.data;
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
  const tid = workspaceStore.activeTeamId || 'personal';
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
    const response = await api.post('/api/tasks', formattedPayload);
    ElMessage.success(t('tasks.addSuccess'));
    isAddDialogOpen.value = false;
    tasks.value.push(parseTaskProps(response.data));
    cachedTasksByTeam.value[tid] = [...tasks.value];
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

const handleListViewRefresh = (updatedTask?: Task) => {
  handleTaskUpdated(updatedTask);
};

const deleteTask = (task: Task) => {
  ElMessageBox.confirm(t('tasks.deleteConfirm'), t('tasks.tip'), {
    type: 'warning',
    confirmButtonText: t('tasks.confirmDelete'),
    cancelButtonText: t('common.cancel'),
  }).then(async () => {
    const tid = workspaceStore.activeTeamId || 'personal';
    try {
      await api.delete(`/api/tasks/${task.id}`);
      ElMessage.success(t('tasks.deleteSuccess'));
      isDetailDrawerOpen.value = false;
      tasks.value = tasks.value.filter((t) => t.id !== task.id);
      cachedTasksByTeam.value[tid] = [...tasks.value];
      fetchStats();
    } catch {
      ElMessage.error(t('tasks.deleteFailed'));
    }
  });
};

const openDetailDrawer = (task: Task, subtaskId?: string) => {
  let targetTask = task;
  let targetSubtaskId = subtaskId || null;
  const isSub = ((task as any).isSubtask && (task as any).parentId) || !!subtaskId;
  if ((task as any).isSubtask && (task as any).parentId) {
    const parent = tasks.value.find((t) => t.id === (task as any).parentId);
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
  if (!isSub) {
    isDetailDrawerOpen.value = true;
    if (route.query.id !== targetTask.id) {
      router.replace({ query: { ...route.query, id: targetTask.id } });
    }
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

const autoSaveTask = async (payload: TaskUpdatePayload | Task) => {
  if (!activeTask.value) return;
  const tid = workspaceStore.activeTeamId || 'personal';
  try {
    if ('id' in payload) {
      // Direct task object update from drawer API (like dependencies)
      const parsedPayload = parseTaskProps(payload as Task);
      activeTask.value = parsedPayload;
      const idx = tasks.value.findIndex((t) => t.id === parsedPayload.id);
      if (idx !== -1) {
        tasks.value[idx] = parsedPayload;
      }
      cachedTasksByTeam.value[tid] = [...tasks.value];
      fetchStats();
      return;
    }

    const response = await api.put(`/api/tasks/${activeTask.value.id}`, payload);
    const updated = parseTaskProps(response.data);
    activeTask.value = updated;
    const idx = tasks.value.findIndex((t) => t.id === updated.id);
    if (idx !== -1) {
      tasks.value[idx] = updated;
    }
    cachedTasksByTeam.value[tid] = [...tasks.value];
    fetchStats();
  } catch (error: any) {
    const errorMsg = error.response?.data?.error || '保存任务失败';
    ElMessage.error(errorMsg);
    fetchTasks();
  }
};

const handleUpdateSubtask = async (
  parentId: string,
  subtaskIndex: number,
  fields: Record<string, any>,
) => {
  const parent = tasks.value.find((t) => t.id === parentId);
  if (!parent) return;
  const tid = workspaceStore.activeTeamId || 'personal';
  try {
    let subtasksList: any[] = [];
    if (parent.subtasks) {
      subtasksList = JSON.parse(parent.subtasks);
    }
    if (subtasksList[subtaskIndex]) {
      subtasksList[subtaskIndex] = {
        ...subtasksList[subtaskIndex],
        ...fields,
      };
    }
    const response = await api.put(`/api/tasks/${parentId}`, {
      subtasks: JSON.stringify(subtasksList),
    });
    ElMessage.success('子任务已更新');
    const parsed = parseTaskProps(response.data);
    const idx = tasks.value.findIndex((t) => t.id === parentId);
    if (idx !== -1) {
      tasks.value[idx] = parsed;
    }
    if (activeTask.value && activeTask.value.id === parentId) {
      activeTask.value = parsed;
    }
    cachedTasksByTeam.value[tid] = [...tasks.value];
    fetchStats();
  } catch {
    ElMessage.error('更新子任务失败');
  }
};

const handleSubtaskDrag = async (parentId: string, subtaskIndex: number, columnId: string) => {
  const parent = tasks.value.find((t) => t.id === parentId);
  if (!parent) return;
  const tid = workspaceStore.activeTeamId || 'personal';
  try {
    let subtasksList: any[] = [];
    if (parent.subtasks) {
      subtasksList = JSON.parse(parent.subtasks);
    }
    if (subtasksList[subtaskIndex]) {
      if (groupBy.value === 'status') {
        subtasksList[subtaskIndex].done = columnId === TaskStatus.DONE;
      } else if (groupBy.value === 'assignee') {
        subtasksList[subtaskIndex].assigneeId = columnId === 'unassigned' ? null : columnId;
      }
    }
    const response = await api.put(`/api/tasks/${parentId}`, {
      subtasks: JSON.stringify(subtasksList),
    });
    ElMessage.success('子任务已更新');
    const parsed = parseTaskProps(response.data);
    const idx = tasks.value.findIndex((t) => t.id === parentId);
    if (idx !== -1) {
      tasks.value[idx] = parsed;
    }
    if (activeTask.value && activeTask.value.id === parentId) {
      activeTask.value = parsed;
    }
    cachedTasksByTeam.value[tid] = [...tasks.value];
    fetchStats();
  } catch {
    ElMessage.error('更新子任务失败');
  }
};

watch(activeSubtaskId, (newVal) => {
  if (!newVal && !isDetailDrawerOpen.value) {
    activeTask.value = null;
  }
});

watch(
  () => workspaceStore.activeTeamId,
  (newTeamId) => {
    const tid = newTeamId || 'personal';
    if (cachedTasksByTeam.value[tid]) {
      tasks.value = cachedTasksByTeam.value[tid];
    } else {
      tasks.value = [];
    }
    if (cachedStatsByTeam.value[tid]) {
      stats.value = cachedStatsByTeam.value[tid];
    } else {
      stats.value = {
        totalTasks: 0,
        completedTasks: 0,
        completionRate: 0,
        overdueTasks: 0,
        byPriority: { HIGH: 0, MEDIUM: 0, LOW: 0, NONE: 0 },
        byStatus: { TODO: 0, IN_PROGRESS: 0, REVIEW: 0, DONE: 0 },
      };
    }
    if (cachedTeamMembersByTeam.value[tid]) {
      teamMembers.value = cachedTeamMembersByTeam.value[tid];
    } else {
      teamMembers.value = [];
    }
    if (cachedProjectsByTeam.value[tid]) {
      projects.value = cachedProjectsByTeam.value[tid];
    } else {
      projects.value = [];
    }
    if (cachedTeams.value && cachedTeams.value.length > 0) {
      teams.value = cachedTeams.value;
    } else {
      teams.value = [];
    }
    fetchTasks();
    fetchStats();
    fetchTeamMembers();
    fetchProjects();
    fetchTeams();
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
  <div class="flex-1 flex flex-col h-full overflow-hidden transition-colors duration-300">
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
        <label class="search-box !min-h-0 !h-8 w-44 sm:w-64 shrink-0">
          <Search />
          <input v-model="searchQuery" type="text" :placeholder="t('tasks.searchPlaceholder')" />
        </label>
      </div>

      <!-- Right: Action Controls -->
      <div class="flex items-center justify-end gap-2 sm:gap-2.5 w-full md:w-auto">
        <Tabs
          v-model="viewMode"
          :options="[
            { value: 'board', icon: LayoutGrid },
            { value: 'list', icon: List },
            { value: 'calendar', icon: Calendar },
          ]"
          size="sm"
          class="!bg-transparent border-none shrink-0"
        />

        <el-popover
          v-if="viewMode === 'board'"
          placement="bottom-end"
          :width="180"
          trigger="click"
          popper-class="glass-popover"
        >
          <template #reference>
            <button
              type="button"
              class="px-3 py-1.5 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold hover:bg-slate-200/50 dark:hover:bg-white/10 transition-all flex items-center gap-1 cursor-pointer shrink-0 animate-spin-hover"
            >
              <SlidersHorizontal class="w-3.5 h-3.5 text-slate-500" />
              <span>卡片设置</span>
            </button>
          </template>
          <div class="p-1 space-y-2.5">
            <div
              class="text-[9px] font-black text-slate-400 dark:text-slate-500 tracking-wider uppercase mb-1"
            >
              看板卡片显示属性
            </div>
            <label
              v-for="(val, field) in cardSettings"
              :key="field"
              class="flex items-center gap-2 text-xs cursor-pointer text-slate-600 dark:text-slate-300 select-none hover:text-accent transition-colors"
            >
              <input
                type="checkbox"
                :checked="val"
                class="rounded border-slate-300 dark:border-slate-600 text-accent focus:ring-accent w-3.5 h-3.5"
                @change="toggleCardSetting(String(field))"
              />
              <span>{{
                field === 'assignee'
                  ? '负责人头像'
                  : field === 'dueDate'
                    ? '截止日期'
                    : field === 'priority'
                      ? '优先级标签'
                      : field === 'project'
                        ? '关联项目名称'
                        : field === 'subtasks'
                          ? '子任务进度'
                          : field === 'timeTracking'
                            ? '工时进度'
                            : '任务简短描述'
              }}</span>
            </label>
          </div>
        </el-popover>

        <el-popover
          v-if="viewMode === 'list'"
          placement="bottom-end"
          :width="180"
          trigger="click"
          popper-class="glass-popover"
        >
          <template #reference>
            <button
              type="button"
              class="px-3 py-1.5 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold hover:bg-slate-200/50 dark:hover:bg-white/10 transition-all flex items-center gap-1 cursor-pointer shrink-0 animate-spin-hover"
            >
              <SlidersHorizontal class="w-3.5 h-3.5 text-slate-500" />
              <span>卡片设置</span>
            </button>
          </template>
          <div class="p-1 space-y-2.5">
            <div
              class="text-[9px] font-black text-slate-400 dark:text-slate-500 tracking-wider uppercase mb-1"
            >
              列表卡片显示属性
            </div>
            <label
              v-for="(val, field) in visibleColumns"
              :key="field"
              class="flex items-center gap-2 text-xs cursor-pointer text-slate-600 dark:text-slate-300 select-none hover:text-accent transition-colors"
            >
              <input
                type="checkbox"
                :checked="val"
                class="rounded border-slate-300 dark:border-slate-600 text-accent focus:ring-accent w-3.5 h-3.5"
                @change="toggleColumnVisibility(String(field))"
              />
              <span>{{
                field === 'status'
                  ? t('tasks.statusLabel')
                  : field === 'project'
                    ? t('tasks.associatedProject')
                    : field === 'assignee'
                      ? t('tasks.assignee')
                      : field === 'dueDate'
                        ? t('tasks.dueDate')
                        : t('tasks.priority')
              }}</span>
            </label>
          </div>
        </el-popover>

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
      v-model:sort-order="sortOrder"
      v-model:hide-completed="hideCompleted"
      v-model:only-my-tasks="onlyMyTasks"
      v-model:visible-columns="visibleColumns"
      v-model:assignee-filter="assigneeFilter"
      v-model:tag-filter="tagFilter"
      v-model:subtask-display="subtaskDisplay"
      :total-tasks-count="tasks.length"
      :completion-rate="completionRate"
      :overdue-count="overdueCount"
      v-model:selected-project-id="selectedProjectId"
      :projects="projects"
      :view-mode="viewMode"
      :is-any-filter-active="isAnyFilterActive"
      :team-members="teamMembers"
      :all-tags="allTags"
      @clear-project-filter="clearProjectFilter"
      @reset-all-filters="resetAllFilters"
    />

    <!-- Loading Skeleton -->
    <div v-if="isLoading" class="flex-1 p-1 sm:p-4 space-y-4 overflow-hidden">
      <!-- Board Skeleton -->
      <div v-if="viewMode === 'board'" class="flex gap-4 h-full">
        <div
          v-for="i in 3"
          :key="i"
          class="flex-1 bg-card rounded-2xl border p-4 space-y-3 animate-pulse h-full"
          style="background-color: var(--bg-card); border-color: var(--border-base)"
        >
          <div class="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mb-4"></div>
          <div
            v-for="j in 3"
            :key="j"
            class="h-24 bg-slate-100 dark:bg-slate-800/40 rounded-xl border p-3 space-y-2"
            style="border-color: var(--border-base)"
          >
            <div class="h-3 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
            <div class="h-2 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
            <div class="flex justify-between items-center pt-2">
              <div class="h-4 bg-slate-200 dark:bg-slate-700 rounded-full w-8"></div>
              <div class="h-4 bg-slate-200 dark:bg-slate-700 rounded-full w-4"></div>
            </div>
          </div>
        </div>
      </div>
      <!-- List/Calendar Skeleton -->
      <div v-else class="space-y-3 animate-pulse">
        <div
          v-for="i in 6"
          :key="i"
          class="h-12 bg-slate-100 dark:bg-slate-800 rounded-xl border"
          style="background-color: var(--bg-card); border-color: var(--border-base)"
        ></div>
      </div>
    </div>

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
      @drag-subtask="(pId, sIdx, colId) => handleSubtaskDrag(pId, sIdx, colId)"
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
      @refresh="handleListViewRefresh"
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

    <!-- Global Empty State -->
    <div
      v-if="!isLoading && tasks.length === 0"
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
      v-if="!isLoading && tasks.length > 0 && filteredTasks.length === 0"
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
