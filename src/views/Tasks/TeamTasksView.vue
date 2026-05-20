<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import {
  Search,
  FolderPlus,
  LayoutGrid,
  List,
  Layers,
  CheckCircle2,
  X,
  TrendingUp,
  Activity,
  Award,
  Users,
  Plus,
  ArrowUp,
  Minus,
  ArrowDown,
  Flame,
  AlertCircle,
  BarChart3,
  Briefcase,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '@/utils/api';
import { useWorkspaceStore } from '@/stores/workspace';
import UserAvatar from '@/components/UserAvatar.vue';
import ProjectCard from '@/components/ProjectCard.vue';
import TaskCard from '@/components/TaskCard.vue';

const workspaceStore = useWorkspaceStore();

const activeTab = ref<'projects' | 'tasks'>('projects');
const searchQuery = ref('');
const viewMode = ref<'grid' | 'list'>('grid');
const projects = ref<any[]>([]);
const tasks = ref<any[]>([]);
const isLoading = ref(true);
const stats = ref<any>(null);

const windowWidth = ref(window.innerWidth);
const updateWidth = () => {
  windowWidth.value = window.innerWidth;
};

onMounted(() => {
  window.addEventListener('resize', updateWidth);
  fetchAll();
});

onUnmounted(() => {
  window.removeEventListener('resize', updateWidth);
});

const priorityOptions = [
  { id: 'URGENT', label: '紧急', color: 'bg-red-500', textColor: 'text-red-500', icon: Flame },
  { id: 'HIGH', label: '高', color: 'bg-orange-500', textColor: 'text-orange-500', icon: ArrowUp },
  { id: 'MEDIUM', label: '中', color: 'bg-amber-500', textColor: 'text-amber-500', icon: Minus },
  { id: 'LOW', label: '低', color: 'bg-slate-400', textColor: 'text-slate-400', icon: ArrowDown },
];

const isDrawerOpen = ref(false);
const isEditMode = ref(false);
const projectForm = ref({
  id: '',
  title: '',
  description: '',
  dueDate: '',
  color: 'bg-accent',
  tags: '',
  progress: 0,
  status: 'IN_PROGRESS',
  visibility: 'PRIVATE',
  maxMembers: 10,
  memberIds: [] as string[],
  inviteUserIds: [] as string[],
});

const colors = [
  { name: '电光蓝', value: 'bg-blue-500' },
  { name: '极光绿', value: 'bg-emerald-500' },
  { name: '霓虹紫', value: 'bg-purple-500' },
  { name: '日落橙', value: 'bg-orange-500' },
  { name: '蔷薇红', value: 'bg-rose-500' },
  { name: '品牌色', value: 'bg-accent' },
];

const statusOptions = [
  { value: 'PLANNED', label: '规划中' },
  { value: 'IN_PROGRESS', label: '进行中' },
  { value: 'PAUSED', label: '已暂停' },
  { value: 'COMPLETED', label: '已完成' },
];

const isTaskDialogOpen = ref(false);
const taskForm = ref({
  title: '',
  description: '',
  assigneeId: '',
  dueDate: '',
  priority: 'MEDIUM',
  projectId: '',
  teamId: '',
  participantIds: [] as string[],
});
const teamMembers = ref<any[]>([]);
const teams = ref<any[]>([]);

const dateFilter = ref('all');
const priorityFilter = ref('all');
const assigneeFilter = ref('all');

const columns = [
  {
    id: 'TODO',
    title: '待办',
    color: 'bg-slate-500',
    headerBg: 'from-slate-500/10 to-transparent',
  },
  {
    id: 'IN_PROGRESS',
    title: '进行中',
    color: 'bg-accent',
    headerBg: 'from-accent/10 to-transparent',
  },
  {
    id: 'DONE',
    title: '已完成',
    color: 'bg-emerald-500',
    headerBg: 'from-emerald-500/10 to-transparent',
  },
];

const projectStats = computed(() => {
  const total = projects.value.length;
  const active = projects.value.filter((p) => p.status === 'IN_PROGRESS').length;
  const completed = projects.value.filter((p) => p.status === 'COMPLETED').length;
  const completionRate = total ? Math.round((completed / total) * 100) : 0;
  return { total, active, completed, completionRate };
});

const taskStats = computed(() => {
  const total = tasks.value.length;
  const done = tasks.value.filter((t) => t.status === 'DONE').length;
  const overdue = tasks.value.filter(
    (t) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'DONE',
  ).length;
  const completionRate = total ? Math.round((done / total) * 100) : 0;
  return { total, done, overdue, completionRate };
});

const filteredProjects = computed(() => {
  return projects.value.filter((project) => {
    const tags = project.tags ? project.tags.toLowerCase() : '';
    return (
      project.title.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      (project.description || '').toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      tags.includes(searchQuery.value.toLowerCase())
    );
  });
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
      filtered = filtered.filter(
        (t) => t.dueDate && new Date(t.dueDate) >= now && new Date(t.dueDate) <= endOfDay,
      );
    } else if (dateFilter.value === 'week') {
      const endOfWeek = new Date(now);
      endOfWeek.setDate(now.getDate() + 7);
      filtered = filtered.filter(
        (t) => t.dueDate && new Date(t.dueDate) >= now && new Date(t.dueDate) <= endOfWeek,
      );
    }
  }

  if (priorityFilter.value !== 'all') {
    filtered = filtered.filter((t) => t.priority === priorityFilter.value);
  }

  if (assigneeFilter.value === 'me') {
    filtered = filtered.filter((t) => t.assigneeId);
  }

  return filtered;
});

const tasksByStatus = computed(() => {
  const filtered = filteredTasks.value;
  return {
    TODO: filtered.filter((t) => t.status === 'TODO'),
    IN_PROGRESS: filtered.filter((t) => t.status === 'IN_PROGRESS'),
    DONE: filtered.filter((t) => t.status === 'DONE'),
  } as Record<string, any[]>;
});

const fetchProjects = async () => {
  try {
    const response = await api.get('/api/projects');
    projects.value = response.data;
  } catch (error) {
    ElMessage.error('获取项目失败');
  }
};

const fetchTasks = async () => {
  try {
    const response = await api.get('/api/tasks');
    tasks.value = response.data;
  } catch (error) {
    ElMessage.error('获取任务失败');
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

const fetchAll = async () => {
  isLoading.value = true;
  await Promise.all([
    fetchProjects(),
    fetchTasks(),
    fetchStats(),
    fetchTeamMembers(),
    fetchTeams(),
  ]);
  isLoading.value = false;
};

const openAddDrawer = () => {
  isEditMode.value = false;
  projectForm.value = {
    id: '',
    title: '',
    description: '',
    dueDate: '',
    color: 'bg-accent',
    tags: '',
    progress: 0,
    status: 'PLANNED',
    visibility: 'PRIVATE',
    maxMembers: 10,
    memberIds: [],
    inviteUserIds: [],
  };
  fetchTeamMembers();
  isDrawerOpen.value = true;
};

const openEditDrawer = (project: any) => {
  isEditMode.value = true;
  projectForm.value = {
    id: project.id,
    title: project.title,
    description: project.description || '',
    dueDate: project.dueDate || '',
    color: project.color || 'bg-accent',
    tags: project.tags || '',
    progress: project.progress || 0,
    status: project.status || 'IN_PROGRESS',
    visibility: project.visibility || 'PRIVATE',
    maxMembers: project.maxMembers || 10,
    memberIds: [],
    inviteUserIds: [],
  };
  fetchTeamMembers();
  isDrawerOpen.value = true;
};

const handleSaveProject = async () => {
  if (!projectForm.value.title) return;
  try {
    if (isEditMode.value) {
      await api.put(`/api/projects/${projectForm.value.id}`, projectForm.value);
      ElMessage.success('项目已更新');
    } else {
      await api.post('/api/projects', projectForm.value);
      ElMessage.success('项目已创建');
    }
    isDrawerOpen.value = false;
    fetchProjects();
  } catch (error) {
    ElMessage.error(isEditMode.value ? '更新项目失败' : '创建项目失败');
  }
};

const deleteProject = (id: string) => {
  ElMessageBox.confirm('确定要永久删除该项目吗？此操作不可逆。', '删除警告', {
    type: 'warning',
    confirmButtonText: '确定删除',
    cancelButtonText: '取消',
    confirmButtonClass: 'el-button--danger',
  })
    .then(async () => {
      try {
        await api.delete(`/api/projects/${id}`);
        ElMessage.success('项目已删除');
        fetchProjects();
      } catch (error) {
        ElMessage.error('删除失败');
      }
    })
    .catch(() => {});
};

const openTaskDialog = () => {
  taskForm.value = {
    title: '',
    description: '',
    assigneeId: '',
    dueDate: '',
    priority: 'MEDIUM',
    projectId: '',
    teamId: workspaceStore.activeTeamId || '',
    participantIds: [],
  };
  if (taskForm.value.teamId) {
    fetchTeamMembers(taskForm.value.teamId);
  }
  isTaskDialogOpen.value = true;
};

const onTaskTeamChange = (teamId: string) => {
  taskForm.value.participantIds = [];
  taskForm.value.assigneeId = '';
  fetchTeamMembers(teamId);
};

const handleCreateTask = async () => {
  if (!taskForm.value.title) return;
  try {
    const payload = {
      ...taskForm.value,
      tags: null,
      status: 'TODO',
      assigneeId: taskForm.value.assigneeId || null,
      projectId: taskForm.value.projectId || null,
      teamId: taskForm.value.teamId || null,
      participantIds:
        taskForm.value.participantIds.length > 0 ? taskForm.value.participantIds : undefined,
    };
    await api.post('/api/tasks', payload);
    ElMessage.success('任务已创建');
    isTaskDialogOpen.value = false;
    fetchTasks();
    fetchStats();
  } catch (error: any) {
    if (error.response?.data?.error === '部分指定人员不在该团队中') {
      ElMessage.error('部分指定人员不在该团队中，请重新选择');
    } else {
      ElMessage.error('创建任务失败');
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



watch(
  () => workspaceStore.activeTeamId,
  () => {
    fetchAll();
  },
);

onMounted(fetchAll);
</script>

<template>
  <div class="flex-1 flex flex-col h-full overflow-hidden" style="background-color: var(--bg-app)">
    <div
      class="h-auto md:h-20 px-4 sm:px-10 py-3 md:py-0 flex flex-col md:flex-row md:items-center justify-between shrink-0 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-b z-10 sticky top-0"
      style="border-color: var(--border-base)"
    >
      <!-- Row 1: Title & New Button (Mobile) / Title (Desktop) -->
      <div class="flex items-center justify-between mb-3 md:mb-0">
        <div class="flex items-center gap-3">
          <div
            class="w-8 h-8 sm:w-12 sm:h-12 rounded-lg sm:rounded-2xl bg-gradient-to-br from-accent to-purple-600 flex items-center justify-center shadow-lg shadow-accent/20"
          >
            <Briefcase class="w-4 h-4 sm:w-6 sm:h-6 text-white" />
          </div>
          <div>
            <h1 class="text-lg sm:text-2xl font-black tracking-tight" style="color: var(--text-primary)">
              团队任务
            </h1>
            <p class="hidden sm:block text-[10px] font-bold uppercase tracking-widest text-slate-400">
              管理团队项目与协作任务
            </p>
          </div>
        </div>

        <!-- New Button (Mobile Only) -->
        <div class="flex md:hidden">
          <button
            v-if="activeTab === 'projects'"
            class="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold flex items-center gap-1.5 text-xs shadow-lg"
            @click="openAddDrawer"
          >
            <FolderPlus class="w-3.5 h-3.5" />
            <span>新建</span>
          </button>
          <button
            v-else
            class="px-4 py-2 bg-accent text-white rounded-xl font-bold flex items-center gap-1.5 text-xs shadow-lg"
            @click="openTaskDialog"
          >
            <Plus class="w-3.5 h-3.5" />
            <span>新建</span>
          </button>
        </div>
      </div>

      <!-- Row 2: Search & Tab Switcher (Mobile) / Desktop Actions -->
      <div class="flex items-center gap-3">
        <div class="relative flex-1 group">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search
              class="w-3.5 h-3.5 text-slate-400 group-focus-within:text-accent transition-colors"
            />
          </div>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索..."
            class="pl-9 pr-4 py-2 w-full md:w-64 lg:w-80 bg-white dark:bg-slate-800 border rounded-xl text-xs outline-none focus:ring-4 focus:ring-accent/10 transition-all shadow-sm"
            style="border-color: var(--border-base); color: var(--text-primary)"
          />
        </div>

        <div class="flex items-center gap-3">
          <div class="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl shrink-0">
            <button
              class="px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all"
              :class="
                activeTab === 'projects'
                  ? 'bg-white dark:bg-slate-700 text-accent shadow-sm'
                  : 'text-slate-400 hover:text-slate-600'
              "
              @click="activeTab = 'projects'"
            >
              项目
            </button>
            <button
              class="px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all"
              :class="
                activeTab === 'tasks'
                  ? 'bg-white dark:bg-slate-700 text-accent shadow-sm'
                  : 'text-slate-400 hover:text-slate-600'
              "
              @click="activeTab = 'tasks'"
            >
              看板
            </button>
          </div>

          <!-- New Button (Desktop Only) -->
          <button
            v-if="activeTab === 'projects'"
            class="hidden md:flex group relative px-6 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-bold overflow-hidden shadow-xl shadow-slate-900/10 dark:shadow-white/10 hover:scale-105 active:scale-95 transition-all items-center gap-2 text-sm"
            @click="openAddDrawer"
          >
            <div
              class="absolute inset-0 bg-accent translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"
            ></div>
            <FolderPlus class="w-4 h-4 relative z-10 group-hover:text-white transition-colors" />
            <span class="relative z-10 group-hover:text-white transition-colors">新建</span>
          </button>
          <button
            v-else
            class="hidden md:flex items-center gap-2 px-6 py-3 bg-accent text-white rounded-2xl text-xs font-bold hover:shadow-lg hover:shadow-accent/20 transition-all whitespace-nowrap"
            @click="openTaskDialog"
          >
            <Plus class="w-4 h-4" /> 新建任务
          </button>
        </div>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto scrollbar-hide">
      <div v-if="isLoading" class="flex flex-col items-center justify-center py-20 opacity-50">
        <div
          class="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin mb-4"
        ></div>
        <p class="text-sm font-bold text-slate-400">正在加载...</p>
      </div>

      <template v-else>
        <div v-show="activeTab === 'projects'" class="p-4 sm:p-10">
          <div class="max-w-[1600px] mx-auto space-y-6 sm:space-y-10">
            <div class="grid grid-cols-4 gap-2 sm:gap-6">
              <div
                class="bg-white dark:bg-slate-900 rounded-xl sm:rounded-[2rem] p-2 sm:p-6 border shadow-sm flex flex-col sm:flex-row items-center sm:items-center text-center sm:text-left gap-1.5 sm:gap-6"
                style="border-color: var(--border-base)"
              >
                <div
                  class="w-7 h-7 sm:w-14 sm:h-14 rounded-lg sm:rounded-2xl bg-blue-500/10 flex items-center justify-center shrink-0"
                >
                  <Layers class="w-4 h-4 sm:w-6 sm:h-6 text-blue-500" />
                </div>
                <div>
                  <p class="text-[7px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0 sm:mb-1">
                    总项目
                  </p>
                  <h3 class="text-sm sm:text-3xl font-black" style="color: var(--text-primary)">
                    {{ projectStats.total }}
                  </h3>
                </div>
              </div>
              <div
                class="bg-white dark:bg-slate-900 rounded-xl sm:rounded-[2rem] p-3 sm:p-6 border shadow-sm flex flex-col sm:flex-row items-center sm:items-center text-center sm:text-left gap-1.5 sm:gap-6"
                style="border-color: var(--border-base)"
              >
                <div
                  class="w-7 h-7 sm:w-14 sm:h-14 rounded-lg sm:rounded-2xl bg-orange-500/10 flex items-center justify-center shrink-0"
                >
                  <Activity class="w-4 h-4 sm:w-6 sm:h-6 text-orange-500" />
                </div>
                <div>
                  <p class="text-[7px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0 sm:mb-1">
                    进行中
                  </p>
                  <h3 class="text-sm sm:text-3xl font-black" style="color: var(--text-primary)">
                    {{ projectStats.active }}
                  </h3>
                </div>
              </div>
              <div
                class="bg-white dark:bg-slate-900 rounded-xl sm:rounded-[2rem] p-3 sm:p-6 border shadow-sm flex flex-col sm:flex-row items-center sm:items-center text-center sm:text-left gap-1.5 sm:gap-6"
                style="border-color: var(--border-base)"
              >
                <div
                  class="w-7 h-7 sm:w-14 sm:h-14 rounded-lg sm:rounded-2xl bg-emerald-500/10 flex items-center justify-center shrink-0"
                >
                  <Award class="w-4 h-4 sm:w-6 sm:h-6 text-emerald-500" />
                </div>
                <div>
                  <p class="text-[7px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0 sm:mb-1">
                    已交付
                  </p>
                  <h3 class="text-sm sm:text-3xl font-black" style="color: var(--text-primary)">
                    {{ projectStats.completed }}
                  </h3>
                </div>
              </div>
              <div
                class="bg-white dark:bg-slate-900 rounded-xl sm:rounded-[2rem] p-3 sm:p-6 border shadow-sm flex flex-col sm:flex-row items-center sm:items-center text-center sm:text-left gap-1.5 sm:gap-6"
                style="border-color: var(--border-base)"
              >
                <div
                  class="w-7 h-7 sm:w-14 sm:h-14 rounded-lg sm:rounded-2xl bg-purple-500/10 flex items-center justify-center shrink-0"
                >
                  <TrendingUp class="w-4 h-4 sm:w-6 sm:h-6 text-purple-500" />
                </div>
                <div>
                  <p class="text-[7px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0 sm:mb-1">
                    完成率
                  </p>
                  <div class="flex items-baseline gap-0.5 sm:gap-2 justify-center sm:justify-start">
                    <h3 class="text-sm sm:text-3xl font-black" style="color: var(--text-primary)">
                      {{ projectStats.completionRate }}
                    </h3>
                    <span class="text-[7px] sm:text-sm font-bold text-slate-400">%</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="flex items-center justify-between">
              <h2 class="text-lg sm:text-xl font-black tracking-tight" style="color: var(--text-primary)">
                全部项目
              </h2>
              <div class="flex items-center gap-4">
                <div
                  class="flex items-center bg-white dark:bg-slate-900 rounded-xl border p-1 shadow-sm"
                  style="border-color: var(--border-base)"
                >
                  <button
                    class="p-1.5 sm:p-2 rounded-lg transition-all"
                    :class="
                      viewMode === 'grid'
                        ? 'bg-slate-100 dark:bg-slate-800 text-accent shadow-sm'
                        : 'text-slate-400 hover:text-slate-600'
                    "
                    @click="viewMode = 'grid'"
                  >
                    <LayoutGrid class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                  <button
                    class="p-1.5 sm:p-2 rounded-lg transition-all"
                    :class="
                      viewMode === 'list'
                        ? 'bg-slate-100 dark:bg-slate-800 text-accent shadow-sm'
                        : 'text-slate-400 hover:text-slate-600'
                    "
                    @click="viewMode = 'list'"
                  >
                    <List class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div
              v-if="filteredProjects.length === 0"
              class="flex flex-col items-center justify-center py-20 sm:py-32 text-center bg-white/50 dark:bg-slate-900/50 rounded-2xl sm:rounded-[3rem] border border-dashed"
              style="border-color: var(--border-base)"
            >
              <div
                class="w-16 h-16 sm:w-24 sm:h-24 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-6"
              >
                <Search class="w-8 h-8 sm:w-10 sm:h-10 text-slate-300" />
              </div>
              <h3 class="text-lg sm:text-xl font-black mb-2" style="color: var(--text-primary)">未找到项目</h3>
              <p class="text-xs sm:text-sm text-slate-400 max-w-xs sm:max-w-md mb-8">
                没有匹配当前搜索条件的项目，或者你还没有创建任何项目。
              </p>
              <button
                class="px-6 sm:px-8 py-2.5 sm:py-3 bg-accent text-white rounded-2xl font-bold hover:scale-105 transition-all shadow-lg shadow-accent/20 text-xs sm:text-base"
                @click="openAddDrawer"
              >
                创建第一个项目
              </button>
            </div>

            <div
              v-else-if="viewMode === 'grid'"
              class="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-8"
            >
              <ProjectCard
                v-for="(project, index) in filteredProjects"
                :key="project.id"
                :project="project"
                layout="grid"
                :style="{ 'animation-delay': `${index * 50}ms` }"
                @edit="openEditDrawer"
                @delete="deleteProject"
              />
            </div>

            <div
              v-else
              class="bg-transparent md:bg-white dark:md:bg-slate-900 md:rounded-2xl sm:md:rounded-[2.5rem] md:border md:shadow-sm md:overflow-hidden"
              style="border-color: var(--border-base)"
            >
              <!-- Mobile List View (Card Simple Mode) -->
              <div class="block md:hidden space-y-3">
                <div
                  v-for="project in filteredProjects"
                  :key="project.id"
                  class="bg-white dark:bg-slate-900 rounded-2xl border shadow-sm"
                  style="border-color: var(--border-base)"
                >
                  <ProjectCard
                    :project="project"
                    layout="card-simple"
                    @edit="openEditDrawer"
                    @delete="deleteProject"
                  />
                </div>
              </div>

              <!-- Desktop Table View -->
              <div class="hidden md:block w-full overflow-x-auto scrollbar-hide">
                <table class="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr
                      class="border-b bg-slate-50/50 dark:bg-slate-800/50"
                      style="border-color: var(--border-base)"
                    >
                      <th
                        class="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400"
                      >
                        项目信息
                      </th>
                      <th
                        class="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400"
                      >
                        项目进度
                      </th>
                      <th
                        class="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400"
                      >
                        当前状态
                      </th>
                      <th
                        class="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400"
                      >
                        参与成员
                      </th>
                      <th
                        class="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right"
                      >
                        管理
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <ProjectCard
                      v-for="project in filteredProjects"
                      :key="project.id"
                      :project="project"
                      layout="row"
                      @edit="openEditDrawer"
                      @delete="deleteProject"
                    />
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div v-show="activeTab === 'tasks'" class="p-4 sm:p-10">
          <div class="max-w-[1600px] mx-auto space-y-6 sm:space-y-8">
            <div class="grid grid-cols-4 gap-2 sm:gap-6">
              <div
                class="bg-white dark:bg-slate-900 rounded-xl sm:rounded-[2rem] p-2 sm:p-6 border shadow-sm flex flex-col sm:flex-row items-center sm:items-center text-center sm:text-left gap-1.5 sm:gap-6"
                style="border-color: var(--border-base)"
              >
                <div
                  class="w-7 h-7 sm:w-14 sm:h-14 rounded-lg sm:rounded-2xl bg-accent/10 flex items-center justify-center shrink-0"
                >
                  <BarChart3 class="w-4 h-4 sm:w-6 sm:h-6 text-accent" />
                </div>
                <div>
                  <p class="text-[7px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5 sm:mb-1">
                    总任务
                  </p>
                  <h3 class="text-sm sm:text-3xl font-black" style="color: var(--text-primary)">
                    {{ taskStats.total }}
                  </h3>
                </div>
              </div>
              <div
                class="bg-white dark:bg-slate-900 rounded-xl sm:rounded-[2rem] p-3 sm:p-6 border shadow-sm flex flex-col sm:flex-row items-center sm:items-center text-center sm:text-left gap-1.5 sm:gap-6"
                style="border-color: var(--border-base)"
              >
                <div
                  class="w-7 h-7 sm:w-14 sm:h-14 rounded-lg sm:rounded-2xl bg-emerald-500/10 flex items-center justify-center shrink-0"
                >
                  <CheckCircle2 class="w-4 h-4 sm:w-6 sm:h-6 text-emerald-500" />
                </div>
                <div>
                  <p class="text-[7px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5 sm:mb-1">
                    已完成
                  </p>
                  <h3 class="text-sm sm:text-3xl font-black" style="color: var(--text-primary)">
                    {{ taskStats.done }}
                  </h3>
                </div>
              </div>
              <div
                class="bg-white dark:bg-slate-900 rounded-xl sm:rounded-[2rem] p-3 sm:p-6 border shadow-sm flex flex-col sm:flex-row items-center sm:items-center text-center sm:text-left gap-1.5 sm:gap-6"
                style="border-color: var(--border-base)"
              >
                <div
                  class="w-7 h-7 sm:w-14 sm:h-14 rounded-lg sm:rounded-2xl bg-rose-500/10 flex items-center justify-center shrink-0"
                >
                  <AlertCircle class="w-4 h-4 sm:w-6 sm:h-6 text-rose-500" />
                </div>
                <div>
                  <p class="text-[7px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5 sm:mb-1">
                    逾期
                  </p>
                  <h3 class="text-sm sm:text-3xl font-black text-rose-500">{{ taskStats.overdue }}</h3>
                </div>
              </div>
              <div
                class="bg-white dark:bg-slate-900 rounded-xl sm:rounded-[2rem] p-3 sm:p-6 border shadow-sm flex flex-col sm:flex-row items-center sm:items-center text-center sm:text-left gap-1.5 sm:gap-6"
                style="border-color: var(--border-base)"
              >
                <div
                  class="w-7 h-7 sm:w-14 sm:h-14 rounded-lg sm:rounded-2xl bg-purple-500/10 flex items-center justify-center shrink-0"
                >
                  <TrendingUp class="w-4 h-4 sm:w-6 sm:h-6 text-purple-500" />
                </div>
                <div>
                  <p class="text-[7px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5 sm:mb-1">
                    完成率
                  </p>
                  <div class="flex items-baseline gap-0.5 sm:gap-2 justify-center sm:justify-start">
                    <h3 class="text-sm sm:text-3xl font-black" style="color: var(--text-primary)">
                      {{ taskStats.completionRate }}
                    </h3>
                    <span class="text-[7px] sm:text-sm font-bold text-slate-400">%</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
              <div class="flex items-center gap-2 overflow-x-auto scrollbar-hide w-full sm:w-auto pb-1 sm:pb-0">
                <span
                  class="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap"
                  >时间:</span
                >
                <div class="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl shrink-0">
                  <button
                    v-for="f in [
                      { id: 'all', label: '全部' },
                      { id: 'overdue', label: '逾期' },
                      { id: 'today', label: '今日' },
                      { id: 'week', label: '本周' },
                    ]"
                    :key="f.id"
                    class="px-2.5 sm:px-3 py-1 rounded-lg text-[9px] sm:text-[10px] font-bold transition-all whitespace-nowrap"
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
              <div class="hidden sm:block h-5 sm:h-6 w-px bg-slate-200 dark:bg-slate-700"></div>
              <div class="flex items-center gap-2 overflow-x-auto scrollbar-hide w-full sm:w-auto">
                <span
                  class="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap"
                  >优先级:</span
                >
                <div class="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl shrink-0">
                  <button
                    class="px-2.5 sm:px-3 py-1 rounded-lg text-[9px] sm:text-[10px] font-bold transition-all whitespace-nowrap"
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
                    class="px-2.5 sm:px-3 py-1 rounded-lg text-[9px] sm:text-[10px] font-bold transition-all flex items-center gap-1 whitespace-nowrap"
                    :class="
                      priorityFilter === p.id
                        ? 'bg-white dark:bg-slate-700 shadow-sm ' + p.textColor
                        : 'text-slate-500 hover:text-slate-700'
                    "
                    @click="priorityFilter = p.id"
                  >
                    <component :is="p.icon" class="w-2.5 h-2.5" /> {{ p.label }}
                  </button>
                </div>
              </div>
            </div>

            <div class="flex gap-3 md:gap-6 min-h-[500px] overflow-x-auto md:overflow-x-visible pb-4 scrollbar-hide snap-x">
              <div
                v-for="col in columns"
                :key="col.id"
                class="w-[280px] xs:w-[320px] md:w-auto md:flex-1 flex flex-col shrink-0 md:shrink rounded-xl sm:rounded-2xl transition-colors duration-300 overflow-hidden snap-center"
                style="background-color: var(--bg-card)"
              >
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
                        class="hidden xs:inline-block text-[8px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 bg-slate-100 dark:bg-white/5 rounded-full text-slate-500"
                      >
                        {{ tasks.filter((t) => t.status === col.id).length }}
                      </span>
                    </div>
                  </div>
                </div>
                <div
                  class="flex-1 overflow-y-auto space-y-2 sm:space-y-3 px-1.5 sm:px-4 pb-4 scrollbar-hide min-h-[100px]"
                >
                  <TaskCard
                    v-for="task in (tasksByStatus as Record<string, any[]>)[col.id]"
                    :key="task.id"
                    :task="task"
                    layout="board"
                    @status-change="quickStatusChange"
                  />

                  <div
                    v-if="(tasksByStatus as Record<string, any[]>)[col.id].length === 0"
                    class="h-24 sm:h-32 flex flex-col items-center justify-center border-2 border-dashed rounded-xl opacity-20 hover:opacity-100 hover:border-accent hover:text-accent cursor-pointer transition-all m-1"
                    style="border-color: var(--border-base)"
                  >
                    <Plus class="w-5 h-5 sm:w-6 sm:h-6 mb-1.5 sm:mb-2" />
                    <p class="text-[9px] sm:text-[10px] font-bold">暂无任务</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <el-drawer
      v-model="isDrawerOpen"
      :title="isEditMode ? '项目设定' : '启动新项目'"
      :size="windowWidth < 640 ? '100%' : '500px'"
      :show-close="false"
      class="custom-drawer"
    >
      <template #header="{ close }">
        <div class="flex items-center justify-between">
          <h3 class="text-xl sm:text-2xl font-black tracking-tight" style="color: var(--text-primary)">
            {{ isEditMode ? '配置工作流' : '构思新世界' }}
          </h3>
          <button
            class="p-2 bg-slate-100 dark:bg-slate-800 hover:scale-110 rounded-full transition-all"
            @click="close"
          >
            <X class="w-4 h-4 text-slate-500" />
          </button>
        </div>
      </template>
      <div class="space-y-6 sm:space-y-8 p-1">
        <div>
          <label
            class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 sm:mb-3 ml-1"
            >项目标识 (名称)</label
          >
          <input
            v-model="projectForm.title"
            type="text"
            class="w-full px-4 sm:px-5 py-3 sm:py-4 bg-slate-50 dark:bg-slate-800/50 border rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-accent/10 transition-all font-bold"
            style="border-color: var(--border-base); color: var(--text-primary)"
            placeholder="例如：代号 M8 重构"
          />
        </div>
        <div>
          <label
            class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 sm:mb-3 ml-1"
            >项目愿景 (描述)</label
          >
          <textarea
            v-model="projectForm.description"
            rows="4"
            class="w-full px-4 sm:px-5 py-3 sm:py-4 bg-slate-50 dark:bg-slate-800/50 border rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-accent/10 transition-all resize-none"
            style="border-color: var(--border-base); color: var(--text-primary)"
            placeholder="一句话概括这个项目的终极目标..."
          ></textarea>
        </div>
        <div class="grid grid-cols-2 gap-3 sm:gap-6">
          <div>
            <label
              class="block text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 sm:mb-3 ml-1"
              >交付日</label
            >
            <el-date-picker
              v-model="projectForm.dueDate"
              type="date"
              placeholder="Deadline"
              class="!w-full !rounded-2xl custom-date-picker"
            />
          </div>
          <div>
            <label
              class="block text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 sm:mb-3 ml-1"
              >视觉色彩</label
            >
            <el-select
              v-model="projectForm.color"
              class="!w-full custom-select"
              popper-class="custom-select-dropdown"
            >
              <el-option v-for="c in colors" :key="c.value" :label="c.name" :value="c.value">
                <div class="flex items-center gap-3">
                  <div class="w-4 h-4 rounded-full shadow-inner" :class="c.value"></div>
                  <span class="font-bold text-xs sm:text-sm">{{ c.name }}</span>
                </div>
              </el-option>
            </el-select>
          </div>
        </div>
        <div
          v-if="isEditMode"
          class="p-4 sm:p-6 bg-slate-50 dark:bg-slate-800/30 rounded-2xl sm:rounded-[2rem] border space-y-4 sm:space-y-6"
          style="border-color: var(--border-base)"
        >
          <div>
            <label
              class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 sm:mb-3 ml-1"
              >当前状态</label
            >
            <el-select v-model="projectForm.status" class="!w-full custom-select">
              <el-option
                v-for="s in statusOptions"
                :key="s.value"
                :label="s.label"
                :value="s.value"
              />
            </el-select>
          </div>
          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
                >完成进度控制</label
              >
              <span class="text-xs font-black text-accent">{{ projectForm.progress }}%</span>
            </div>
            <div class="px-2">
              <el-slider
                v-model="projectForm.progress"
                :step="5"
                show-stops
                class="custom-slider"
              />
            </div>
          </div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <div>
            <label
              class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 sm:mb-3 ml-1"
              >可见性与报名</label
            >
            <el-select v-model="projectForm.visibility" class="!w-full custom-select">
              <el-option label="私有 (仅邀请)" value="PRIVATE" />
              <el-option label="公开 (成员可报名)" value="PUBLIC" />
            </el-select>
          </div>
          <div>
            <label
              class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 sm:mb-3 ml-1"
              >人员满载限制</label
            >
            <el-input-number
              v-model="projectForm.maxMembers"
              :min="1"
              :max="50"
              class="!w-full custom-number"
            />
          </div>
        </div>
        <div>
          <label
            class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 sm:mb-3 ml-1"
            >分类标签 (逗号分隔)</label
          >
          <input
            v-model="projectForm.tags"
            type="text"
            class="w-full px-4 sm:px-5 py-3 sm:py-4 bg-slate-50 dark:bg-slate-800/50 border rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-accent/10 transition-all font-bold"
            style="border-color: var(--border-base); color: var(--text-primary)"
            placeholder="如：3D建模, WebGL, 内部工具"
          />
        </div>

        <div v-if="!isEditMode && teamMembers.length > 0">
          <label
            class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 sm:mb-3 ml-1"
            >直接加入的成员</label
          >
          <el-select
            v-model="projectForm.memberIds"
            multiple
            placeholder="选择直接加入的成员"
            class="!w-full custom-select"
          >
            <el-option
              v-for="m in teamMembers"
              :key="m.id"
              :label="m.name || m.email"
              :value="m.id"
            >
              <div class="flex items-center gap-3">
                <UserAvatar :user="m" size="sm" />
                <span class="font-bold text-xs sm:text-sm">{{ m.name || m.email }}</span>
              </div>
            </el-option>
          </el-select>
        </div>

        <div v-if="!isEditMode && teamMembers.length > 0">
          <label
            class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 sm:mb-3 ml-1"
            >发送邀请的成员</label
          >
          <el-select
            v-model="projectForm.inviteUserIds"
            multiple
            placeholder="选择要邀请的成员"
            class="!w-full custom-select"
          >
            <el-option
              v-for="m in teamMembers"
              :key="m.id"
              :label="m.name || m.email"
              :value="m.id"
            >
              <div class="flex items-center gap-3">
                <UserAvatar :user="m" size="sm" />
                <span class="font-bold text-xs sm:text-sm">{{ m.name || m.email }}</span>
              </div>
            </el-option>
          </el-select>
          <p class="text-[9px] sm:text-[10px] text-slate-400 mt-2 ml-1">
            被邀请的成员将收到通知，可自行决定是否加入
          </p>
        </div>
      </div>
      <template #footer>
        <div class="flex gap-4 p-4 border-t" style="border-color: var(--border-base)">
          <button
            class="flex-1 py-3 sm:py-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-2xl font-black transition-all text-xs sm:text-sm"
            style="color: var(--text-primary)"
            @click="isDrawerOpen = false"
          >
            取消
          </button>
          <button
            class="flex-[2] py-3 sm:py-4 bg-accent text-white rounded-2xl font-black shadow-xl shadow-accent/20 hover:scale-[1.02] active:scale-[0.98] transition-all text-xs sm:text-sm"
            @click="handleSaveProject"
          >
            {{ isEditMode ? '确认并应用更改' : '正式启动项目' }}
          </button>
        </div>
      </template>
    </el-drawer>

    <Transition name="fade">
      <div v-if="isTaskDialogOpen" class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
        <div
          class="absolute inset-0 bg-black/40 backdrop-blur-sm"
          @click="isTaskDialogOpen = false"
        ></div>
        <div
          class="relative w-full max-w-lg p-5 sm:p-8 rounded-2xl sm:rounded-3xl shadow-2xl space-y-4 sm:space-y-5 max-h-[90vh] overflow-y-auto"
          style="background-color: var(--bg-card)"
        >
          <div class="flex items-center justify-between">
            <h3 class="text-lg sm:text-xl font-bold" style="color: var(--text-primary)">新建团队任务</h3>
            <button style="color: var(--text-secondary)" @click="isTaskDialogOpen = false">
              <X class="w-5 h-5" />
            </button>
          </div>
          <div class="space-y-3 sm:space-y-4">
            <div>
              <label class="block text-[10px] sm:text-xs font-bold uppercase mb-1.5 sm:mb-2 ml-1 text-slate-400"
                >任务标题</label
              >
              <input
                v-model="taskForm.title"
                type="text"
                class="w-full px-4 py-2.5 sm:py-3 bg-slate-100 dark:bg-white/5 border-none rounded-xl sm:rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all font-bold"
                placeholder="例如：完成角色建模"
              />
            </div>
            <div>
              <label class="block text-[10px] sm:text-xs font-bold uppercase mb-1.5 sm:mb-2 ml-1 text-slate-400"
                >详细描述 (可选)</label
              >
              <textarea
                v-model="taskForm.description"
                rows="3"
                class="w-full px-4 py-2.5 sm:py-3 bg-slate-100 dark:bg-white/5 border-none rounded-xl sm:rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all resize-none"
                placeholder="任务目标和交付物..."
              ></textarea>
            </div>
            <div>
              <label class="block text-[10px] sm:text-xs font-bold uppercase mb-1.5 sm:mb-2 ml-1 text-slate-400"
                >所属团队</label
              >
              <el-select
                v-model="taskForm.teamId"
                placeholder="选择团队"
                class="!w-full custom-select"
                @change="onTaskTeamChange"
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
                      <Users class="w-3 h-3 text-accent" />
                    </div>
                    <span class="text-xs sm:text-sm">{{ t.name }}</span>
                  </div>
                </el-option>
              </el-select>
            </div>
            <div class="grid grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label class="block text-[8px] sm:text-xs font-bold uppercase mb-1 sm:mb-2 ml-1 text-slate-400"
                  >优先级</label
                >
                <el-select v-model="taskForm.priority" class="!w-full custom-select">
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
                  v-model="taskForm.dueDate"
                  type="date"
                  placeholder="Deadline"
                  class="!w-full !rounded-2xl custom-date-picker"
                  popper-class="custom-date-popper"
                />
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label class="block text-[8px] sm:text-xs font-bold uppercase mb-1 sm:mb-2 ml-1 text-slate-400"
                  >负责人</label
                >
                <el-select
                  v-model="taskForm.assigneeId"
                  clearable
                  placeholder="负责人"
                  class="!w-full custom-select"
                >
                  <el-option v-for="m in teamMembers" :key="m.id" :label="m.name" :value="m.id">
                    <div class="flex items-center gap-2">
                      <UserAvatar :user="m" size="sm" />
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
                  v-model="taskForm.projectId"
                  clearable
                  placeholder="关联项目"
                  class="!w-full custom-select"
                >
                  <el-option v-for="p in projects" :key="p.id" :label="p.title" :value="p.id" />
                </el-select>
              </div>
            </div>
            <div>
              <label class="block text-[10px] sm:text-xs font-bold uppercase mb-1.5 sm:mb-2 ml-1 text-slate-400"
                >参与人员</label
              >
              <el-select
                v-model="taskForm.participantIds"
                multiple
                placeholder="选择参与人员（必须为团队成员）"
                class="!w-full custom-select"
              >
                <el-option v-for="m in teamMembers" :key="m.id" :label="m.name" :value="m.id">
                  <div class="flex items-center gap-2">
                    <UserAvatar :user="m" size="sm" />
                    <span class="text-xs sm:text-sm">{{ m.name }}</span>
                  </div>
                </el-option>
              </el-select>
            </div>
          </div>
          <button
            class="w-full py-3.5 sm:py-4 bg-accent text-white rounded-xl sm:rounded-2xl font-bold shadow-lg shadow-accent/20 hover:shadow-accent/40 transition-all text-sm sm:text-base"
            @click="handleCreateTask"
          >
            创建任务
          </button>
        </div>
      </div>
    </Transition>
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
.line-clamp-1 {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

:deep(.custom-drawer) {
  background-color: var(--bg-card) !important;
  border-top-left-radius: 2rem !important;
  border-bottom-left-radius: 2rem !important;
  box-shadow: -20px 0 50px rgba(0, 0, 0, 0.1) !important;
}
:deep(.el-drawer__header) {
  margin-bottom: 0 !important;
  padding: 2rem !important;
  border-bottom: 1px solid var(--border-base);
}
:deep(.el-drawer__body) {
  padding: 2rem !important;
}
:deep(.el-drawer__footer) {
  padding: 0 !important;
}

.custom-date-picker :deep(.el-input__wrapper) {
  border-radius: 1rem !important;
  padding: 1rem !important;
  background-color: var(--bg-app) !important;
  box-shadow: none !important;
  border: 1px solid var(--border-base);
}
.custom-select :deep(.el-input__wrapper) {
  border-radius: 1rem !important;
  background-color: var(--bg-app) !important;
  box-shadow: none !important;
  border: 1px solid var(--border-base);
  height: 52px;
}
.custom-number :deep(.el-input__wrapper) {
  border-radius: 1rem !important;
  background-color: var(--bg-app) !important;
  box-shadow: none !important;
  border: 1px solid var(--border-base);
  height: 52px;
}
.custom-slider :deep(.el-slider__bar) {
  background-color: var(--el-color-primary);
}
.custom-slider :deep(.el-slider__button) {
  border-color: var(--el-color-primary);
  width: 20px;
  height: 20px;
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
