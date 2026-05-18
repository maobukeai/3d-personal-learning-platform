<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import draggable from 'vuedraggable';
import { useI18n } from 'vue-i18n';
import {
  Plus,
  Search,
  Clock,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Trash2,
  X,
  LayoutGrid,
  List,
  Flame,
  ArrowUp,
  Minus,
  ArrowDown,
  User,
  FolderOpen,
  TrendingUp,
  BarChart3,
  Eye,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import UserAvatar from '@/components/UserAvatar.vue';
import UserProfileDialog from '@/components/UserProfileDialog.vue';
import api from '@/utils/api';
import { useWorkspaceStore } from '@/stores/workspace';

const { t } = useI18n();
const workspaceStore = useWorkspaceStore();

const tasks = ref<any[]>([]);
const isLoading = ref(false);
const searchQuery = ref('');
const dateFilter = ref('all');
const priorityFilter = ref('all');
const customDate = ref('');
const isAddDialogOpen = ref(false);
const viewMode = ref<'board' | 'list'>('board');
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

const isEditDrawerOpen = ref(false);
const isPreviewDialogOpen = ref(false);
const previewingTask = ref<any>(null);
const editingTask = ref<any>(null);
const editForm = ref({
  title: '',
  description: '',
  status: '',
  priority: 'MEDIUM',
  tags: [] as string[],
  dueDate: '',
  assigneeId: '',
  projectId: '',
  participantIds: [] as string[],
});

const tagInput = ref('');
const editTagInput = ref('');

const teamMembers = ref<any[]>([]);
const projects = ref<any[]>([]);
const teams = ref<any[]>([]);

const columns = ref([
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

watch(
  () => t('tasks.todo'),
  () => {
    columns.value[0].title = t('tasks.todo');
    columns.value[1].title = t('tasks.inProgress');
    columns.value[2].title = t('tasks.done');
  },
);

const tasksByStatus = computed(() => {
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

  if (priorityFilter.value !== 'all') {
    filtered = filtered.filter((t) => t.priority === priorityFilter.value);
  }

  return {
    TODO: filtered.filter((t) => t.status === 'TODO'),
    IN_PROGRESS: filtered.filter((t) => t.status === 'IN_PROGRESS'),
    DONE: filtered.filter((t) => t.status === 'DONE'),
  } as Record<string, any[]>;
});

const listFilteredTasks = computed(() => {
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

  if (priorityFilter.value !== 'all') {
    filtered = filtered.filter((t) => t.priority === priorityFilter.value);
  }

  return filtered;
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

const parseTags = (tags: string | null | undefined): string[] => {
  if (!tags) return [];
  try {
    return JSON.parse(tags);
  } catch {
    return [];
  }
};

const getPriorityConfig = (priority: string) => {
  return priorityOptions.value.find((p) => p.id === priority) || priorityOptions.value[2];
};

const addTag = (target: 'new' | 'edit') => {
  const input = target === 'new' ? tagInput : editTagInput;
  const form = target === 'new' ? newTask : editForm;
  const tag = input.value.trim();
  if (tag && !form.value.tags.includes(tag)) {
    form.value.tags.push(tag);
  }
  if (target === 'new') tagInput.value = '';
  else editTagInput.value = '';
};

const removeTag = (tag: string, target: 'new' | 'edit') => {
  const form = target === 'new' ? newTask : editForm;
  form.value.tags = form.value.tags.filter((t: string) => t !== tag);
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

const handleAddTask = async () => {
  if (!newTask.value.title) return;
  try {
    const payload = {
      ...newTask.value,
      tags: newTask.value.tags.length > 0 ? JSON.stringify(newTask.value.tags) : null,
      assigneeId: newTask.value.assigneeId || null,
      projectId: newTask.value.projectId || null,
      teamId: newTask.value.teamId || null,
      participantIds:
        newTask.value.participantIds.length > 0 ? newTask.value.participantIds : undefined,
    };
    await api.post('/api/tasks', payload);
    ElMessage.success('任务已添加');
    isAddDialogOpen.value = false;
    newTask.value = {
      title: '',
      description: '',
      status: 'TODO',
      priority: 'MEDIUM',
      tags: [],
      dueDate: '',
      assigneeId: '',
      projectId: '',
      teamId: '',
      participantIds: [],
    };
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

const onDragChange = async (event: any, newStatus: string) => {
  if (event.added) {
    const task = event.added.element;
    try {
      await api.put(`/api/tasks/${task.id}`, { ...task, status: newStatus });
      ElMessage.success(
        `已移动到 ${newStatus === 'DONE' ? '已完成' : newStatus === 'IN_PROGRESS' ? '进行中' : '待办'}`,
      );
      const taskIndex = tasks.value.findIndex((t) => t.id === task.id);
      if (taskIndex !== -1) {
        tasks.value[taskIndex].status = newStatus;
      }
      fetchStats();
    } catch (error) {
      ElMessage.error('更新状态失败');
      fetchTasks();
    }
  }
};

const openAddDialog = (status: string = 'TODO') => {
  newTask.value.status = status;
  newTask.value.teamId = workspaceStore.activeTeamId || '';
  if (newTask.value.teamId) {
    fetchTeamMembers(newTask.value.teamId);
  }
  isAddDialogOpen.value = true;
};

const onAddTaskTeamChange = (teamId: string) => {
  newTask.value.participantIds = [];
  newTask.value.assigneeId = '';
  fetchTeamMembers(teamId);
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
      isEditDrawerOpen.value = false;
      isPreviewDialogOpen.value = false;
      fetchTasks();
      fetchStats();
    } catch (error) {
      ElMessage.error('删除失败');
    }
  });
};

const openPreviewDialog = (task: any) => {
  previewingTask.value = task;
  isPreviewDialogOpen.value = true;
};

const openEditDialog = (task: any) => {
  isPreviewDialogOpen.value = false;
  editingTask.value = task;
  editForm.value = {
    title: task.title,
    description: task.description || '',
    status: task.status,
    priority: task.priority || 'MEDIUM',
    tags: parseTags(task.tags),
    dueDate: task.dueDate || '',
    assigneeId: task.assigneeId || '',
    projectId: task.projectId || '',
    participantIds: task.participants ? task.participants.map((p: any) => p.userId) : [],
  };
  if (task.teamId) {
    fetchTeamMembers(task.teamId);
  }
  isEditDrawerOpen.value = true;
};

const handleUpdateTask = async () => {
  if (!editForm.value.title) return;
  try {
    const payload = {
      ...editForm.value,
      tags: editForm.value.tags.length > 0 ? JSON.stringify(editForm.value.tags) : null,
      assigneeId: editForm.value.assigneeId || null,
      projectId: editForm.value.projectId || null,
      participantIds: editForm.value.participantIds,
    };
    await api.put(`/api/tasks/${editingTask.value.id}`, payload);
    ElMessage.success('任务已更新');
    isEditDrawerOpen.value = false;
    fetchTasks();
    fetchStats();
  } catch (error: any) {
    if (error.response?.data?.error === '部分指定人员不在该团队中') {
      ElMessage.error('部分指定人员不在该团队中，请重新选择');
    } else {
      ElMessage.error('更新失败');
    }
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

const formatDueDate = (dateStr: string | null) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return `逾期 ${Math.abs(diffDays)} 天`;
  if (diffDays === 0) return '今天截止';
  if (diffDays === 1) return '明天截止';
  if (diffDays <= 7) return `${diffDays} 天后截止`;
  return d.toLocaleDateString();
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
      class="h-auto md:h-16 px-4 sm:px-8 py-4 md:py-0 flex flex-col md:flex-row md:items-center justify-between shrink-0 border-b transition-colors duration-300 gap-4"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <div class="flex items-center justify-between w-full md:w-auto">
        <div class="flex items-center gap-3">
          <div class="p-2 bg-accent/10 rounded-lg">
            <CheckCircle2 class="w-5 h-5 text-accent" />
          </div>
          <h1 class="text-lg md:text-xl font-bold" style="color: var(--text-primary)">任务看板</h1>
        </div>
        
        <button
          class="md:hidden flex items-center gap-2 px-3 py-1.5 bg-accent text-white rounded-xl text-xs font-bold shadow-lg shadow-accent/20 transition-all"
          @click="openAddDialog('TODO')"
        >
          <Plus class="w-3.5 h-3.5" />
        </button>
      </div>

      <div class="flex items-center gap-2 sm:gap-3 w-full md:w-auto">
        <div class="relative flex-1 md:flex-none">
          <Search class="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索任务..."
            class="pl-9 pr-4 py-2 bg-slate-100 dark:bg-white/5 border-none rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-accent/20 w-full md:w-48 lg:w-56 transition-all"
            style="color: var(--text-primary)"
          />
        </div>

        <div class="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl shrink-0">
          <button
            class="p-1.5 rounded-lg transition-all"
            :class="
              viewMode === 'board'
                ? 'bg-white dark:bg-slate-700 text-accent shadow-sm'
                : 'text-slate-400 hover:text-slate-600'
            "
            @click="viewMode = 'board'"
          >
            <LayoutGrid class="w-4 h-4" />
          </button>
          <button
            class="p-1.5 rounded-lg transition-all"
            :class="
              viewMode === 'list'
                ? 'bg-white dark:bg-slate-700 text-accent shadow-sm'
                : 'text-slate-400 hover:text-slate-600'
            "
            @click="viewMode = 'list'"
          >
            <List class="w-4 h-4" />
          </button>
        </div>

        <button
          class="hidden md:flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-xl text-xs font-bold hover:shadow-lg hover:shadow-accent/20 transition-all"
          @click="openAddDialog('TODO')"
        >
          <Plus class="w-4 h-4" /> 新建任务
        </button>
      </div>
    </div>

    <!-- Stats + Filter Bar -->
    <div
      class="px-4 sm:px-8 py-3 sm:py-4 border-b flex flex-wrap items-center gap-3 sm:gap-6 shrink-0"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <!-- Stats Cards -->
      <div class="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
        <div class="flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-xl bg-emerald-500/10 whitespace-nowrap">
          <TrendingUp class="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-500" />
          <span class="text-[9px] sm:text-[10px] font-bold text-emerald-600 dark:text-emerald-400"
            >{{ completionRate }}% 完成</span
          >
        </div>
        <div
          v-if="overdueCount > 0"
          class="flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-xl bg-rose-500/10 whitespace-nowrap"
        >
          <AlertCircle class="w-3 h-3 sm:w-3.5 sm:h-3.5 text-rose-500" />
          <span class="text-[9px] sm:text-[10px] font-bold text-rose-600 dark:text-rose-400"
            >{{ overdueCount }} 逾期</span
          >
        </div>
        <div class="flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 whitespace-nowrap">
          <BarChart3 class="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-400" />
          <span class="text-[9px] sm:text-[10px] font-bold text-slate-500">{{ tasks.length }} 总计</span>
        </div>
      </div>

      <div class="hidden sm:block h-6 w-px bg-slate-200 dark:bg-slate-700 shrink-0"></div>

      <!-- Date Filter -->
      <div class="flex items-center gap-2 shrink-0">
        <span
          class="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap"
          >时间:</span
        >
        <div class="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-x-auto scrollbar-hide">
          <button
            v-for="f in [
              { id: 'all', label: '全部' },
              { id: 'overdue', label: '逾期' },
              { id: 'today', label: '今日' },
              { id: 'week', label: '本周' },
            ]"
            :key="f.id"
            class="px-2 sm:px-3 py-1 rounded-lg text-[9px] sm:text-[10px] font-bold transition-all whitespace-nowrap"
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

      <div class="hidden sm:block h-6 w-px bg-slate-200 dark:bg-slate-700 shrink-0"></div>

      <!-- Priority Filter -->
      <div class="flex items-center gap-2 shrink-0">
        <span
          class="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap"
          >优先级:</span
        >
        <div class="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-x-auto scrollbar-hide">
          <button
            class="px-2 sm:px-3 py-1 rounded-lg text-[9px] sm:text-[10px] font-bold transition-all whitespace-nowrap"
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
            class="px-2 sm:px-3 py-1 rounded-lg text-[9px] sm:text-[10px] font-bold transition-all flex items-center gap-1 whitespace-nowrap"
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
    </div>

    <!-- Board View -->
    <div v-if="viewMode === 'board'" class="flex-1 overflow-hidden p-2 sm:p-8">
      <div class="flex gap-2 sm:gap-6 h-full">
        <div
          v-for="col in columns"
          :key="col.id"
          class="flex flex-col flex-1 min-w-0 h-full rounded-xl sm:rounded-2xl transition-colors duration-300 overflow-hidden"
          style="background-color: var(--bg-card)"
        >
          <!-- Column Header -->
          <div class="px-2 sm:px-5 pt-3 sm:pt-5 pb-2 sm:pb-3" :class="'bg-gradient-to-b ' + col.headerBg">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-1 sm:gap-2 min-w-0">
                <div class="w-1.5 h-1.5 sm:w-2.5 sm:h-2.5 rounded-full shrink-0" :class="col.color"></div>
                <h2
                  class="text-[10px] sm:text-sm font-black uppercase tracking-wider truncate"
                  style="color: var(--text-primary)"
                >
                  {{ col.title }}
                </h2>
                <span
                  class="hidden xs:inline-block text-[8px] sm:text-[10px] font-bold px-1.5 py-0.5 bg-slate-100 dark:bg-white/5 rounded-full text-slate-500"
                >
                  {{ tasks.filter((t) => t.status === col.id).length }}
                </span>
              </div>
              <button
                class="p-1 rounded-lg text-slate-400 hover:text-accent hover:bg-accent/10 transition-all shrink-0"
                @click="openAddDialog(col.id)"
              >
                <Plus class="w-3 h-3 sm:w-4 sm:h-4" />
              </button>
            </div>
          </div>

          <!-- Draggable Task List -->
          <draggable
            :list="(tasksByStatus as Record<string, any[]>)[col.id]"
            group="tasks"
            item-key="id"
            class="flex-1 overflow-y-auto space-y-2 sm:space-y-3 px-1.5 sm:px-4 pb-4 scrollbar-hide min-h-[100px]"
            :animation="200"
            ghost-class="opacity-50"
            @change="(e: any) => onDragChange(e, col.id)"
          >
            <template #item="{ element: task }">
              <div
                class="group p-2 sm:p-4 rounded-lg sm:rounded-xl border shadow-sm hover:shadow-md hover:border-accent/30 transition-all cursor-grab active:cursor-grabbing relative"
                style="background-color: var(--bg-app); border-color: var(--border-base)"
                @click="openPreviewDialog(task)"
              >
                <!-- Priority + Title Row -->
                <div class="flex justify-between items-start mb-1 sm:mb-2">
                  <div class="flex items-center gap-1 sm:gap-2 flex-1 min-w-0">
                    <div
                      class="shrink-0 w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full"
                      :class="getPriorityConfig(task.priority).color"
                    ></div>
                    <h3
                      class="text-[10px] sm:text-sm font-bold leading-tight group-hover:text-accent transition-colors line-clamp-2"
                      style="color: var(--text-primary)"
                    >
                      {{ task.title }}
                    </h3>
                  </div>
                </div>

                <!-- Priority Badge (Hidden on very small screens to save space) -->
                <div class="hidden xs:flex items-center gap-1 sm:gap-2 mb-1 sm:mb-2">
                  <span
                    class="inline-flex items-center gap-1 px-1 py-0.5 rounded text-[8px] font-bold"
                    :class="
                      getPriorityConfig(task.priority).color +
                      '/10 ' +
                      getPriorityConfig(task.priority).textColor
                    "
                  >
                    <component :is="getPriorityConfig(task.priority).icon" class="w-2 h-2 sm:w-2.5 sm:h-2.5" />
                    <span class="hidden sm:inline">{{ getPriorityConfig(task.priority).label }}</span>
                  </span>
                </div>

                <!-- Description (Hidden on mobile board view for compactness) -->
                <p
                  v-if="task.description"
                  class="hidden sm:block text-xs mb-3 line-clamp-2"
                  style="color: var(--text-secondary)"
                >
                  {{ task.description }}
                </p>

                <!-- Footer: Date + Assignee -->
                <div
                  class="flex items-center justify-between pt-1.5 sm:pt-3 border-t"
                  style="border-color: var(--border-base)"
                >
                  <div class="flex items-center gap-1 min-w-0">
                    <!-- Due Date Icon Only on Mobile -->
                    <div
                      v-if="task.dueDate"
                      class="flex items-center gap-0.5 text-[8px] font-medium shrink-0"
                      :class="
                        new Date(task.dueDate) < new Date() && task.status !== 'DONE'
                          ? 'text-rose-500'
                          : 'text-slate-400'
                      "
                    >
                      <Calendar class="w-2.5 h-2.5" />
                      <span class="hidden sm:inline">{{ formatDueDate(task.dueDate) }}</span>
                    </div>
                    <!-- Assignee Avatar -->
                    <div v-if="task.assignee" class="shrink-0">
                      <div
                        class="relative cursor-pointer hover:ring-1 hover:ring-accent rounded-md transition-all"
                        @click.stop="openUserProfile(task.assignee.id)"
                      >
                        <img
                          v-if="task.assignee.avatarUrl"
                          :src="task.assignee.avatarUrl"
                          class="w-4 h-4 sm:w-5 sm:h-5 rounded-md object-cover"
                          :alt="task.assignee.name"
                        />
                        <div
                          v-else
                          class="w-4 h-4 sm:w-5 sm:h-5 rounded-md bg-accent/10 flex items-center justify-center"
                        >
                          <User class="w-2.5 h-2.5 text-accent" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>

            <template #header>
              <div
                v-if="tasks.filter((t) => t.status === col.id).length === 0"
                class="h-16 sm:h-32 flex flex-col items-center justify-center border-2 border-dashed rounded-lg sm:rounded-xl opacity-20 hover:opacity-100 hover:border-accent hover:text-accent cursor-pointer transition-all m-0.5 sm:m-1"
                style="border-color: var(--border-base)"
                @click="openAddDialog(col.id)"
              >
                <Plus class="w-4 h-4 sm:w-6 sm:h-6 mb-1 sm:mb-2" />
                <p class="hidden sm:block text-[10px] font-bold">拖拽或点击新建</p>
              </div>
            </template>
          </draggable>
        </div>
      </div>
    </div>

    <!-- List View -->
    <div v-if="viewMode === 'list'" class="flex-1 overflow-y-auto p-2 sm:p-8 scrollbar-hide">
      <div class="w-full max-w-5xl mx-auto space-y-2">
        <div
          v-for="task in listFilteredTasks"
          :key="task.id"
          class="group flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border hover:border-accent/30 hover:shadow-sm transition-all cursor-pointer"
          style="background-color: var(--bg-card); border-color: var(--border-base)"
          @click="openPreviewDialog(task)"
        >
          <!-- Top Row: Priority + Status + Title -->
          <div class="flex items-center gap-2 sm:gap-4 min-w-0">
            <!-- Priority Dot -->
            <div
              class="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full shrink-0"
              :class="getPriorityConfig(task.priority).color"
            ></div>

            <!-- Status Badge -->
            <span
              class="shrink-0 px-1.5 sm:px-2 py-0.5 rounded text-[8px] sm:text-[9px] font-bold"
              :class="
                task.status === 'TODO'
                  ? 'bg-slate-500/10 text-slate-500'
                  : task.status === 'IN_PROGRESS'
                    ? 'bg-accent/10 text-accent'
                    : 'bg-emerald-500/10 text-emerald-500'
              "
            >
              {{
                task.status === 'TODO' ? '待办' : task.status === 'IN_PROGRESS' ? '进行中' : '已完成'
              }}
            </span>

            <span
              class="text-xs sm:text-sm font-bold truncate group-hover:text-accent transition-colors"
              style="color: var(--text-primary)"
              >{{ task.title }}</span
            >
          </div>

          <!-- Mid/Bottom Row: Metadata -->
          <div class="flex flex-wrap items-center gap-x-4 gap-y-2 sm:flex-1 sm:justify-end min-w-0">
            <!-- Tags (Hidden on very small screens in list view) -->
            <div v-if="parseTags(task.tags).length > 0" class="hidden md:flex flex-wrap gap-1">
              <span
                v-for="tag in parseTags(task.tags)"
                :key="tag"
                class="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold"
                :class="getTagClass(tag)"
              >
                {{ tag }}
              </span>
            </div>

            <!-- Project -->
            <div
              v-if="task.project"
              class="flex items-center gap-1 text-[9px] sm:text-[10px] font-medium text-accent max-w-[120px] truncate"
            >
              <FolderOpen class="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              {{ task.project.title }}
            </div>

            <!-- Assignee -->
            <div
              v-if="task.assignee"
              class="flex items-center gap-1.5 cursor-pointer group/as"
              @click.stop="openUserProfile(task.assignee.id)"
            >
              <img
                v-if="task.assignee.avatarUrl"
                :src="task.assignee.avatarUrl"
                class="w-4 h-4 sm:w-5 sm:h-5 rounded-lg object-cover group-hover/as:ring-2 group-hover/as:ring-accent transition-all"
              />
              <div
                v-else
                class="w-4 h-4 sm:w-5 sm:h-5 rounded-lg bg-accent/10 flex items-center justify-center group-hover/as:bg-accent group-hover/as:text-white transition-all"
              >
                <User class="w-2.5 h-2.5 sm:w-3 sm:h-3 text-accent group-hover/as:text-white" />
              </div>
              <span
                class="text-[9px] sm:text-[10px] text-slate-400 font-medium group-hover/as:text-accent transition-colors"
                >{{ task.assignee.name }}</span
              >
            </div>

            <!-- Due Date -->
            <div
              v-if="task.dueDate"
              class="flex items-center gap-1 text-[9px] sm:text-[10px] font-medium"
              :class="
                new Date(task.dueDate) < new Date() && task.status !== 'DONE'
                  ? 'text-rose-500'
                  : 'text-slate-400'
              "
            >
              <Calendar class="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              <span class="whitespace-nowrap">{{ new Date(task.dueDate).toLocaleDateString() }}</span>
            </div>
          </div>

          <!-- Quick Actions -->
          <div
            class="flex items-center gap-1 sm:opacity-0 group-hover:opacity-100 transition-opacity justify-end sm:justify-start"
          >
            <button
              class="p-1.5 rounded-md text-slate-400 hover:text-accent hover:bg-accent/10 transition-all"
              title="查看详情"
              @click.stop="openPreviewDialog(task)"
            >
              <Eye class="w-3.5 h-3.5" />
            </button>
            <button
              v-if="task.status !== 'DONE'"
              class="p-1.5 rounded-md text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/10 transition-all"
              title="标记完成"
              @click.stop="quickStatusChange(task, 'DONE')"
            >
              <CheckCircle2 class="w-3.5 h-3.5" />
            </button>
            <button
              class="p-1.5 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-all"
              title="删除"
              @click.stop="deleteTask(task)"
            >
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <!-- Empty State -->
        <div
          v-if="listFilteredTasks.length === 0"
          class="py-20 flex flex-col items-center justify-center"
        >
          <div
            class="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center mb-4"
          >
            <CheckCircle2 class="w-8 h-8 text-slate-300 dark:text-slate-600" />
          </div>
          <p class="text-sm font-bold text-slate-400 mb-1">暂无任务</p>
          <p class="text-xs text-slate-400 mb-4">点击下方按钮创建你的第一个任务</p>
          <button
            class="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-xl text-xs font-bold hover:shadow-lg hover:shadow-accent/20 transition-all"
            @click="openAddDialog('TODO')"
          >
            <Plus class="w-4 h-4" /> 新建任务
          </button>
        </div>
      </div>
    </div>

    <!-- Task Preview Dialog -->
    <Transition name="fade">
      <div
        v-if="isPreviewDialogOpen"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div
          class="absolute inset-0 bg-black/40 backdrop-blur-sm"
          @click="isPreviewDialogOpen = false"
        ></div>
        <div
          class="relative w-full max-w-xl p-8 rounded-3xl shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto"
          style="background-color: var(--bg-card)"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div
                class="w-10 h-10 rounded-2xl flex items-center justify-center"
                :class="getPriorityConfig(previewingTask.priority).color + '/10'"
              >
                <component
                  :is="getPriorityConfig(previewingTask.priority).icon"
                  class="w-5 h-5"
                  :class="getPriorityConfig(previewingTask.priority).textColor"
                />
              </div>
              <div>
                <h3 class="text-xl font-bold" style="color: var(--text-primary)">任务详情</h3>
                <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Task Details
                </p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button
                class="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-accent hover:text-white transition-all"
                @click="openEditDialog(previewingTask)"
              >
                编辑任务
              </button>
              <button
                style="color: var(--text-secondary)"
                class="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-all"
                @click="isPreviewDialogOpen = false"
              >
                <X class="w-5 h-5" />
              </button>
            </div>
          </div>

          <div class="space-y-6">
            <!-- Title -->
            <div>
              <h2 class="text-2xl font-black" style="color: var(--text-primary)">
                {{ previewingTask.title }}
              </h2>
            </div>

            <!-- Meta Information (Responsive Grid) -->
            <div
              class="grid grid-cols-2 p-3 sm:p-4 bg-slate-50 dark:bg-white/5 rounded-xl sm:rounded-2xl border border-slate-100 dark:border-white/10 gap-4"
            >
              <!-- Status -->
              <div class="flex items-center gap-2">
                <div
                  class="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm"
                >
                  <Clock class="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400" />
                </div>
                <div>
                  <p class="text-[7px] sm:text-[8px] font-bold text-slate-400 uppercase tracking-wider">状态</p>
                  <p class="text-[10px] sm:text-xs font-bold" style="color: var(--text-primary)">
                    {{
                      previewingTask.status === 'TODO'
                        ? '待办'
                        : previewingTask.status === 'IN_PROGRESS'
                          ? '进行中'
                          : '已完成'
                    }}
                  </p>
                </div>
              </div>

              <!-- Priority -->
              <div class="flex items-center gap-2">
                <div
                  class="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm"
                >
                  <Flame class="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400" />
                </div>
                <div>
                  <p class="text-[7px] sm:text-[8px] font-bold text-slate-400 uppercase tracking-wider">优先级</p>
                  <p
                    class="text-[10px] sm:text-xs font-bold"
                    :class="getPriorityConfig(previewingTask.priority).textColor"
                  >
                    {{ getPriorityConfig(previewingTask.priority).label }}
                  </p>
                </div>
              </div>

              <!-- Due Date -->
              <div class="flex items-center gap-2">
                <div
                  class="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm"
                >
                  <Calendar class="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400" />
                </div>
                <div>
                  <p class="text-[7px] sm:text-[8px] font-bold text-slate-400 uppercase tracking-wider">
                    截止日期
                  </p>
                  <p
                    class="text-[10px] sm:text-xs font-bold"
                    :class="
                      previewingTask.dueDate &&
                      new Date(previewingTask.dueDate) < new Date() &&
                      previewingTask.status !== 'DONE'
                        ? 'text-rose-500'
                        : ''
                    "
                    :style="{
                      color: !(
                        previewingTask.dueDate &&
                        new Date(previewingTask.dueDate) < new Date() &&
                        previewingTask.status !== 'DONE'
                      )
                        ? 'var(--text-primary)'
                        : '',
                    }"
                  >
                    {{
                      previewingTask.dueDate
                        ? new Date(previewingTask.dueDate).toLocaleDateString()
                        : '未设置'
                    }}
                  </p>
                </div>
              </div>

              <div v-if="previewingTask.project" class="flex items-center gap-2">
                <div
                  class="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm"
                >
                  <FolderOpen class="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400" />
                </div>
                <div class="min-w-0">
                  <p class="text-[7px] sm:text-[8px] font-bold text-slate-400 uppercase tracking-wider">项目</p>
                  <p class="text-[10px] sm:text-xs font-bold text-accent truncate">
                    {{ previewingTask.project.title }}
                  </p>
                </div>
              </div>
            </div>


            <!-- Description (Emphasized) -->
            <div v-if="previewingTask.description">
              <p
                class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 ml-1 flex items-center gap-2"
              >
                <span class="w-1.5 h-1.5 rounded-full bg-accent"></span>
                详细描述
              </p>
              <div
                class="p-6 bg-white dark:bg-white/5 rounded-3xl text-sm leading-relaxed border border-slate-100 dark:border-white/10 shadow-sm"
                style="color: var(--text-primary); font-size: 0.95rem"
              >
                {{ previewingTask.description }}
              </div>
            </div>

            <!-- Tags -->
            <div v-if="parseTags(previewingTask.tags).length > 0">
              <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 ml-1">
                标签
              </p>
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="tag in parseTags(previewingTask.tags)"
                  :key="tag"
                  class="px-3 py-1 rounded-xl text-[10px] font-bold"
                  :class="getTagClass(tag)"
                >
                  # {{ tag }}
                </span>
              </div>
            </div>

            <!-- Personnel -->
            <div class="grid grid-cols-2 gap-6">
              <div>
                <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 ml-1">
                  负责人
                </p>
                <div
                  v-if="previewingTask.assignee"
                  class="flex items-center gap-3 p-3 bg-slate-100 dark:bg-white/5 rounded-2xl"
                >
                  <UserAvatar :user="previewingTask.assignee" size="md" />
                  <div>
                    <p class="text-xs font-bold" style="color: var(--text-primary)">
                      {{ previewingTask.assignee.name }}
                    </p>
                    <p class="text-[9px] text-slate-400">{{ previewingTask.assignee.email }}</p>
                  </div>
                </div>
                <div v-else class="text-xs text-slate-400 p-3 italic">未指派</div>
              </div>
              <div v-if="previewingTask.participants && previewingTask.participants.length > 0">
                <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 ml-1">
                  参与者
                </p>
                <div class="flex items-center -space-x-2">
                  <UserAvatar
                    v-for="p in previewingTask.participants"
                    :key="p.userId"
                    :user="p.user"
                    size="md"
                    class="border-2 border-white dark:border-slate-900"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Add Task Dialog -->
    <Transition name="fade">
      <div v-if="isAddDialogOpen" class="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
        <div
          class="absolute inset-0 bg-black/40 backdrop-blur-sm"
          @click="isAddDialogOpen = false"
        ></div>
        <div
          class="relative w-full max-w-4xl p-6 sm:p-12 rounded-[1.5rem] sm:rounded-[2.5rem] shadow-2xl space-y-6 sm:space-y-8 max-h-[95vh] overflow-y-auto"
          style="background-color: var(--bg-card)"
        >
          <div class="flex items-center justify-between">
            <h3 class="text-xl sm:text-3xl font-black tracking-tight" style="color: var(--text-primary)">
              新建学习任务
            </h3>
            <button
              style="color: var(--text-secondary)"
              class="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-2xl transition-all"
              @click="isAddDialogOpen = false"
            >
              <X class="w-6 h-6 sm:w-8 sm:h-8" />
            </button>
          </div>

          <div class="space-y-4 sm:space-y-6">
            <div>
              <label
                class="block text-[10px] sm:text-sm font-bold uppercase mb-2 sm:mb-3 ml-1 text-slate-400 tracking-widest"
                >任务标题</label
              >
              <input
                v-model="newTask.title"
                type="text"
                class="w-full px-4 sm:px-6 py-3 sm:py-5 bg-slate-100 dark:bg-white/5 border-none rounded-xl sm:rounded-2xl text-base sm:text-xl focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all font-bold"
                placeholder="例如：深入学习 Blender 几何节点系统"
              />
            </div>

            <div>
              <label
                class="block text-[10px] sm:text-sm font-bold uppercase mb-2 sm:mb-3 ml-1 text-slate-400 tracking-widest"
                >详细描述 (可选)</label
              >
              <textarea
                v-model="newTask.description"
                rows="6"
                class="w-full px-4 sm:px-6 py-3 sm:py-5 bg-slate-100 dark:bg-white/5 border-none rounded-xl sm:rounded-[2rem] text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all resize-none leading-relaxed"
                placeholder="在此输入任务的详细背景、目标、步骤及参考资料..."
              ></textarea>
            </div>

            <div>
              <label class="block text-[10px] sm:text-xs font-bold uppercase mb-2 ml-1 text-slate-400"
                >所属团队</label
              >
              <el-select
                v-model="newTask.teamId"
                placeholder="选择团队"
                class="!w-full custom-select"
                @change="onAddTaskTeamChange"
              >
                <el-option v-for="t in teams" :key="t.id" :label="t.name" :value="t.id">
                  <div class="flex items-center gap-2">
                    <img
                      v-if="t.avatarUrl"
                      :src="t.avatarUrl"
                      class="w-5 h-5 rounded-lg object-cover"
                    />
                    <div
                      v-else
                      class="w-5 h-5 rounded-lg bg-accent/10 flex items-center justify-center"
                    >
                      <User class="w-3 h-3 text-accent" />
                    </div>
                    <span>{{ t.name }}</span>
                  </div>
                </el-option>
              </el-select>
            </div>

            <div class="grid grid-cols-2 gap-2 sm:gap-4">
              <div>
                <label class="block text-[8px] sm:text-xs font-bold uppercase mb-1 sm:mb-2 ml-1 text-slate-400"
                  >优先级</label
                >
                <el-select v-model="newTask.priority" class="!w-full custom-select">
                  <el-option
                    v-for="p in priorityOptions"
                    :key="p.id"
                    :label="p.label"
                    :value="p.id"
                  >
                    <div class="flex items-center gap-2">
                      <div class="w-2 h-2 rounded-full" :class="p.color"></div>
                      <span class="text-xs sm:text-sm">{{ p.label }}</span>
                    </div>
                  </el-option>
                </el-select>
              </div>
              <div>
                <label class="block text-[8px] sm:text-xs font-bold uppercase mb-1 sm:mb-2 ml-1 text-slate-400"
                  >截止日期</label
                >
                <el-date-picker
                  v-model="newTask.dueDate"
                  type="date"
                  placeholder="日期"
                  class="!w-full !rounded-2xl custom-date-picker"
                  popper-class="custom-date-popper"
                />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-2 sm:gap-4">
              <div>
                <label class="block text-[8px] sm:text-xs font-bold uppercase mb-1 sm:mb-2 ml-1 text-slate-400"
                  >负责人</label
                >
                <el-select
                  v-model="newTask.assigneeId"
                  clearable
                  placeholder="负责人"
                  class="!w-full custom-select"
                >
                  <el-option v-for="m in teamMembers" :key="m.id" :label="m.name" :value="m.id">
                    <div class="flex items-center gap-2">
                      <img
                        v-if="m.avatarUrl"
                        :src="m.avatarUrl"
                        class="w-5 h-5 rounded-lg object-cover"
                      />
                      <span class="text-xs sm:text-sm">{{ m.name }}</span>
                    </div>
                  </el-option>
                </el-select>
              </div>
              <div>
                <label class="block text-[8px] sm:text-xs font-bold uppercase mb-1 sm:mb-2 ml-1 text-slate-400"
                  >关联项目</label
                >
                <el-select
                  v-model="newTask.projectId"
                  clearable
                  placeholder="项目"
                  class="!w-full custom-select"
                >
                  <el-option v-for="p in projects" :key="p.id" :label="p.title" :value="p.id" />
                </el-select>
              </div>
            </div>

            <div>
              <label class="block text-[10px] sm:text-xs font-bold uppercase mb-2 ml-1 text-slate-400"
                >参与人员</label
              >
              <el-select
                v-model="newTask.participantIds"
                multiple
                placeholder="选择参与人员"
                class="!w-full custom-select"
              >
                <el-option v-for="m in teamMembers" :key="m.id" :label="m.name" :value="m.id">
                  <div class="flex items-center gap-2">
                    <img
                      v-if="m.avatarUrl"
                      :src="m.avatarUrl"
                      class="w-5 h-5 rounded-lg object-cover"
                    />
                    <span>{{ m.name }}</span>
                  </div>
                </el-option>
              </el-select>
            </div>

            <!-- Tags -->
            <div>
              <label class="block text-[10px] sm:text-xs font-bold uppercase mb-2 ml-1 text-slate-400">标签</label>
              <div class="flex flex-wrap gap-1.5 mb-2">
                <span
                  v-for="tag in newTask.tags"
                  :key="tag"
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold"
                  :class="getTagClass(tag)"
                >
                  {{ tag }}
                  <button
                    class="hover:opacity-70 transition-opacity"
                    @click="removeTag(tag, 'new')"
                  >
                    <X class="w-2.5 h-2.5" />
                  </button>
                </span>
              </div>
              <div class="flex gap-2">
                <input
                  v-model="tagInput"
                  type="text"
                  class="flex-1 px-4 py-2 bg-slate-100 dark:bg-white/5 border-none rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all"
                  placeholder="输入标签名"
                  @keyup.enter="addTag('new')"
                />
                <button
                  class="px-3 py-2 bg-slate-100 dark:bg-white/5 rounded-xl text-xs font-bold text-slate-500 hover:text-accent transition-colors"
                  @click="addTag('new')"
                >
                  <Plus class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          <button
            class="w-full py-3 sm:py-4 bg-accent text-white rounded-xl sm:rounded-2xl font-bold shadow-lg shadow-accent/20 hover:shadow-accent/40 transition-all text-sm sm:text-base"
            @click="handleAddTask"
          >
            创建任务
          </button>
        </div>
      </div>
    </Transition>

    <!-- Edit Task Dialog -->
    <Transition name="fade">
      <div v-if="isEditDrawerOpen" class="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
        <div
          class="absolute inset-0 bg-black/40 backdrop-blur-sm"
          @click="isEditDrawerOpen = false"
        ></div>
        <div
          class="relative w-full max-w-4xl p-6 sm:p-12 rounded-[1.5rem] sm:rounded-[2.5rem] shadow-2xl space-y-6 sm:space-y-8 max-h-[95vh] overflow-y-auto"
          style="background-color: var(--bg-card)"
        >
          <div class="flex items-center justify-between">
            <h3 class="text-xl sm:text-3xl font-black tracking-tight" style="color: var(--text-primary)">
              修改任务
            </h3>
            <button
              style="color: var(--text-secondary)"
              class="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-2xl transition-all"
              @click="isEditDrawerOpen = false"
            >
              <X class="w-6 h-6 sm:w-8 sm:h-8" />
            </button>
          </div>

          <div class="space-y-4 sm:space-y-6">
            <div>
              <label
                class="block text-[10px] sm:text-sm font-bold uppercase mb-2 sm:mb-3 ml-1 text-slate-400 tracking-widest"
                >任务标题</label
              >
              <input
                v-model="editForm.title"
                type="text"
                class="w-full px-4 sm:px-6 py-3 sm:py-5 bg-slate-100 dark:bg-white/5 border-none rounded-xl sm:rounded-2xl text-base sm:text-xl focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all font-bold"
              />
            </div>

            <div>
              <label
                class="block text-[10px] sm:text-sm font-bold uppercase mb-2 sm:mb-3 ml-1 text-slate-400 tracking-widest"
                >详细描述</label
              >
              <textarea
                v-model="editForm.description"
                rows="8"
                class="w-full px-4 sm:px-6 py-3 sm:py-5 bg-slate-100 dark:bg-white/5 border-none rounded-xl sm:rounded-[2rem] text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all resize-none leading-relaxed"
              ></textarea>
            </div>

            <div class="grid grid-cols-3 gap-2 sm:gap-4">
              <div>
                <label class="block text-[8px] sm:text-xs font-bold uppercase mb-1 sm:mb-2 ml-1 text-slate-400"
                  >状态</label
                >
                <el-select v-model="editForm.status" class="!w-full custom-select">
                  <el-option v-for="c in columns" :key="c.id" :label="c.title" :value="c.id" />
                </el-select>
              </div>
              <div>
                <label class="block text-[8px] sm:text-xs font-bold uppercase mb-1 sm:mb-2 ml-1 text-slate-400"
                  >优先级</label
                >
                <el-select v-model="editForm.priority" class="!w-full custom-select">
                  <el-option
                    v-for="p in priorityOptions"
                    :key="p.id"
                    :label="p.label"
                    :value="p.id"
                  >
                    <div class="flex items-center gap-2">
                      <div class="w-2 h-2 rounded-full" :class="p.color"></div>
                      <span class="text-xs sm:text-sm">{{ p.label }}</span>
                    </div>
                  </el-option>
                </el-select>
              </div>
              <div>
                <label class="block text-[8px] sm:text-xs font-bold uppercase mb-1 sm:mb-2 ml-1 text-slate-400"
                  >截止日期</label
                >
                <el-date-picker
                  v-model="editForm.dueDate"
                  type="date"
                  placeholder="日期"
                  class="!w-full custom-date-picker"
                />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-2 sm:gap-4">
              <div>
                <label class="block text-[8px] sm:text-xs font-bold uppercase mb-1 sm:mb-2 ml-1 text-slate-400"
                  >负责人</label
                >
                <el-select
                  v-model="editForm.assigneeId"
                  clearable
                  placeholder="负责人"
                  class="!w-full custom-select"
                >
                  <el-option v-for="m in teamMembers" :key="m.id" :label="m.name" :value="m.id">
                    <div class="flex items-center gap-2">
                      <img
                        v-if="m.avatarUrl"
                        :src="m.avatarUrl"
                        class="w-5 h-5 rounded-lg object-cover"
                      />
                      <span class="text-xs sm:text-sm">{{ m.name }}</span>
                    </div>
                  </el-option>
                </el-select>
              </div>
              <div>
                <label class="block text-[8px] sm:text-xs font-bold uppercase mb-1 sm:mb-2 ml-1 text-slate-400"
                  >关联项目</label
                >
                <el-select
                  v-model="editForm.projectId"
                  clearable
                  placeholder="项目"
                  class="!w-full custom-select"
                >
                  <el-option v-for="p in projects" :key="p.id" :label="p.title" :value="p.id" />
                </el-select>
              </div>
            </div>

            <div>
              <label class="block text-[10px] sm:text-xs font-bold uppercase mb-2 ml-1 text-slate-400"
                >参与人员</label
              >
              <el-select
                v-model="editForm.participantIds"
                multiple
                placeholder="选择参与人员"
                class="!w-full custom-select"
              >
                <el-option v-for="m in teamMembers" :key="m.id" :label="m.name" :value="m.id">
                  <div class="flex items-center gap-2">
                    <img
                      v-if="m.avatarUrl"
                      :src="m.avatarUrl"
                      class="w-5 h-5 rounded-lg object-cover"
                    />
                    <span>{{ m.name }}</span>
                  </div>
                </el-option>
              </el-select>
            </div>

            <!-- Tags -->
            <div>
              <label class="block text-[10px] sm:text-xs font-bold uppercase mb-2 ml-1 text-slate-400">标签</label>
              <div class="flex flex-wrap gap-1.5 mb-2">
                <span
                  v-for="tag in editForm.tags"
                  :key="tag"
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold"
                  :class="getTagClass(tag)"
                >
                  {{ tag }}
                  <button
                    class="hover:opacity-70 transition-opacity"
                    @click="removeTag(tag, 'edit')"
                  >
                    <X class="w-2.5 h-2.5" />
                  </button>
                </span>
              </div>
              <div class="flex gap-2">
                <input
                  v-model="editTagInput"
                  type="text"
                  class="flex-1 px-4 py-2 bg-slate-100 dark:bg-white/5 border-none rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all"
                  placeholder="输入标签名"
                  @keyup.enter="addTag('edit')"
                />
                <button
                  class="px-3 py-2 bg-slate-100 dark:bg-white/5 rounded-xl text-xs font-bold text-slate-500 hover:text-accent transition-colors"
                  @click="addTag('edit')"
                >
                  <Plus class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          <div class="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-2">
            <button
              class="w-full sm:flex-1 py-3 sm:py-4 bg-rose-50 dark:bg-rose-500/10 text-rose-600 rounded-xl sm:rounded-2xl font-bold hover:bg-rose-100 transition-all text-sm sm:text-base order-2 sm:order-1"
              @click="deleteTask(editingTask)"
            >
              删除
            </button>
            <button
              class="w-full sm:flex-[2] py-3 sm:py-4 bg-accent text-white rounded-xl sm:rounded-2xl font-bold shadow-lg shadow-accent/20 hover:shadow-accent/40 transition-all text-sm sm:text-base order-1 sm:order-2"
              @click="handleUpdateTask"
            >
              保存修改
            </button>
          </div>
        </div>
      </div>
    </Transition>

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
</style>
