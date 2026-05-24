<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
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
  Briefcase,
  FolderOpen,
  Trash2,
  Maximize2,
  Minimize2,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '@/utils/api';
import { useWorkspaceStore } from '@/stores/workspace';
import { useAuthStore } from '@/stores/auth';
import UserAvatar from '@/components/UserAvatar.vue';
import ProjectCard from '@/components/ProjectCard.vue';
import StatCard from '@/components/StatCard.vue';

const workspaceStore = useWorkspaceStore();
const authStore = useAuthStore();
const route = useRoute();
const router = useRouter();

const searchQuery = ref('');
const viewMode = ref<'grid' | 'list'>('grid');
const projects = ref<any[]>([]);
const isLoading = ref(true);

const windowWidth = ref(window.innerWidth);
const updateWidth = () => {
  windowWidth.value = window.innerWidth;
};

// Details Drawer state
const activeProjectId = ref<string | null>(null);
const isDetailDrawerOpen = ref(false);
const projectDetail = ref<any>(null);
const isDetailLoading = ref(false);

// Details View Mode: drawer or modal
const projectDetailViewMode = ref(localStorage.getItem('project_detail_view_mode') || 'drawer');

const toggleDetailViewMode = () => {
  projectDetailViewMode.value = projectDetailViewMode.value === 'drawer' ? 'modal' : 'drawer';
  localStorage.setItem('project_detail_view_mode', projectDetailViewMode.value);
};

// Batch Allocator state
const isBatchDialogOpen = ref(false);
const batchTaskText = ref('');
const batchAssigneeId = ref('');
const batchPriority = ref('MEDIUM');
const batchDueDate = ref('');
const quickTaskTitle = ref('');

onMounted(() => {
  window.addEventListener('resize', updateWidth);
  fetchAll();
  if (route.query.openCreate === 'true') {
    openAddDrawer();
  }
});

const priorityOptions = [
  { id: 'URGENT', label: '紧急', color: 'bg-red-500', textColor: 'text-red-500', icon: Flame },
  { id: 'HIGH', label: '高', color: 'bg-orange-500', textColor: 'text-orange-500', icon: ArrowUp },
  { id: 'MEDIUM', label: '中', color: 'bg-amber-500', textColor: 'text-amber-500', icon: Minus },
  { id: 'LOW', label: '低', color: 'bg-slate-400', textColor: 'text-slate-400', icon: ArrowDown },
];

const isDrawerOpen = ref(false);
const projectFormViewMode = ref(localStorage.getItem('project_form_view_mode') || 'drawer');
const toggleProjectFormViewMode = () => {
  projectFormViewMode.value = projectFormViewMode.value === 'drawer' ? 'modal' : 'drawer';
  localStorage.setItem('project_form_view_mode', projectFormViewMode.value);
};
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

const teamMembers = ref<any[]>([]);
const teams = ref<any[]>([]);
const projectMembers = ref<any[]>([]);

const availableTeamMembers = computed(() => {
  const currentMemberIds = new Set(projectMembers.value.map((m) => m.userId));
  return teamMembers.value.filter((m) => !currentMemberIds.has(m.id));
});

const isDetailInviteDialogOpen = ref(false);
const detailInviteUserIds = ref<string[]>([]);

const isDetailMember = computed(() => {
  if (!projectDetail.value || !authStore.user) return false;
  return projectDetail.value.members.some((m: any) => m.userId === authStore.user?.id);
});

const isDetailOwner = computed(() => {
  if (!projectDetail.value || !authStore.user) return false;
  return projectDetail.value.members.some(
    (m: any) => m.userId === authStore.user?.id && m.role === 'OWNER',
  );
});

const availableMembersForDetailInvite = computed(() => {
  if (!projectDetail.value) return [];
  const existingUserIds = new Set(projectDetail.value.members.map((m: any) => m.userId));
  return teamMembers.value.filter((m: any) => !existingUserIds.has(m.id));
});

const parsedBatchTasks = computed(() => {
  if (!batchTaskText.value.trim()) return [];
  return batchTaskText.value
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
});

const projectStats = computed(() => {
  const total = projects.value.length;
  const active = projects.value.filter((p) => p.status === 'IN_PROGRESS').length;
  const completed = projects.value.filter((p) => p.status === 'COMPLETED').length;
  const completionRate = total ? Math.round((completed / total) * 100) : 0;
  return { total, active, completed, completionRate };
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

const fetchProjects = async () => {
  try {
    const response = await api.get('/api/projects');
    projects.value = response.data;
  } catch (error) {
    ElMessage.error('获取项目失败');
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
  await Promise.all([fetchProjects(), fetchTeamMembers(), fetchTeams()]);
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
  projectMembers.value = project.members || [];
  fetchTeamMembers(project.teamId);
  isDrawerOpen.value = true;
};

const handleSaveProject = async () => {
  if (!projectForm.value.title) return;
  try {
    if (isEditMode.value) {
      await api.put(`/api/projects/${projectForm.value.id}`, projectForm.value);
      if (projectForm.value.inviteUserIds && projectForm.value.inviteUserIds.length > 0) {
        await api.post(`/api/projects/${projectForm.value.id}/invite`, {
          userIds: projectForm.value.inviteUserIds,
        });
      }
      ElMessage.success('项目已更新');
      // If we are currently viewing this project's details, refresh it
      if (activeProjectId.value === projectForm.value.id) {
        fetchProjectDetail(activeProjectId.value);
      }
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

const handleRemoveMember = async (userId: string) => {
  try {
    await api.post(`/api/projects/${projectForm.value.id}/members/remove`, { userId });
    ElMessage.success('已移出项目成员');
    projectMembers.value = projectMembers.value.filter((m) => m.userId !== userId);
    fetchProjects();
    if (activeProjectId.value === projectForm.value.id) {
      await fetchProjectDetail(activeProjectId.value);
    }
  } catch (error) {
    ElMessage.error('移除成员失败');
  }
};

const deleteProject = (id: string) => {
  ElMessageBox.confirm('确定要永久删除该项目吗？此操作不可逆。', '删除警告', {
    type: 'warning',
    confirmButtonText: '确定删除',
    cancelButtonText: '取消',
  })
    .then(async () => {
      try {
        await api.delete(`/api/projects/${id}`);
        ElMessage.success('项目已删除');
        if (activeProjectId.value === id) {
          isDetailDrawerOpen.value = false;
        }
        fetchProjects();
      } catch (error) {
        ElMessage.error('删除失败');
      }
    })
    .catch(() => {});
};

// Details Drawer Methods
const fetchProjectDetail = async (id: string) => {
  isDetailLoading.value = true;
  try {
    const response = await api.get(`/api/projects/${id}`);
    projectDetail.value = response.data;
    if (projectDetail.value && projectDetail.value.teamId) {
      await fetchTeamMembers(projectDetail.value.teamId);
    }
  } catch (error) {
    ElMessage.error('获取项目详情失败');
  } finally {
    isDetailLoading.value = false;
  }
};

const handleProjectClick = async (projectId: string) => {
  activeProjectId.value = projectId;
  await fetchProjectDetail(projectId);
  isDetailDrawerOpen.value = true;
};

const handleUpdateTaskStatus = async (task: any, newStatus: string) => {
  try {
    await api.put(`/api/tasks/${task.id}`, { status: newStatus });
    ElMessage.success('任务状态已更新');
    if (activeProjectId.value) {
      await fetchProjectDetail(activeProjectId.value);
    }
    fetchProjects();
  } catch (error) {
    ElMessage.error('更新任务状态失败');
  }
};

const handleDeleteTask = (taskId: string) => {
  ElMessageBox.confirm('确定要删除这个任务吗？', '确认删除', {
    type: 'warning',
    confirmButtonText: '确定',
    cancelButtonText: '取消',
  })
    .then(async () => {
      try {
        await api.delete(`/api/tasks/${taskId}`);
        ElMessage.success('任务已删除');
        if (activeProjectId.value) {
          await fetchProjectDetail(activeProjectId.value);
        }
        fetchProjects();
      } catch (error) {
        ElMessage.error('删除任务失败');
      }
    })
    .catch(() => {});
};

const openInviteDetailDialog = () => {
  detailInviteUserIds.value = [];
  if (projectDetail.value) {
    fetchTeamMembers(projectDetail.value.teamId);
  }
  isDetailInviteDialogOpen.value = true;
};

const handleSendDetailInvite = async () => {
  if (!projectDetail.value || detailInviteUserIds.value.length === 0) return;
  try {
    await api.post(`/api/projects/${projectDetail.value.id}/invite`, {
      userIds: detailInviteUserIds.value,
    });
    ElMessage.success(`已发送 ${detailInviteUserIds.value.length} 份邀请`);
    isDetailInviteDialogOpen.value = false;
    fetchProjectDetail(projectDetail.value.id);
  } catch (error) {
    ElMessage.error('发送邀请失败');
  }
};

const handleJoinProjectDetail = async () => {
  if (!projectDetail.value) return;
  try {
    await api.post(`/api/projects/${projectDetail.value.id}/join`);
    ElMessage.success('成功加入项目');
    fetchProjectDetail(projectDetail.value.id);
    fetchProjects();
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '加入失败');
  }
};

const handleQuickAddTask = async () => {
  if (!quickTaskTitle.value.trim() || !activeProjectId.value) return;
  try {
    await api.post(`/api/projects/${activeProjectId.value}/tasks`, {
      title: quickTaskTitle.value.trim(),
      teamId: workspaceStore.activeTeamId,
    });
    quickTaskTitle.value = '';
    ElMessage.success('任务已添加');
    await fetchProjectDetail(activeProjectId.value);
    fetchProjects();
  } catch (error) {
    ElMessage.error('添加任务失败');
  }
};

const handleBatchCreateTasks = async () => {
  if (!batchTaskText.value.trim() || !activeProjectId.value) return;
  const lines = batchTaskText.value
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return;

  const payloadTasks = lines.map((title) => ({
    title,
    priority: batchPriority.value,
    dueDate: batchDueDate.value || null,
    assigneeId: batchAssigneeId.value || null,
  }));

  try {
    await api.post(`/api/projects/${activeProjectId.value}/tasks/batch`, { tasks: payloadTasks });
    ElMessage.success(`成功批量创建 ${lines.length} 个任务`);
    isBatchDialogOpen.value = false;
    batchTaskText.value = '';
    batchAssigneeId.value = '';
    batchDueDate.value = '';
    batchPriority.value = 'MEDIUM';
    await fetchProjectDetail(activeProjectId.value);
    fetchProjects();
  } catch (error) {
    ElMessage.error('批量创建任务失败');
  }
};

const navigateToTaskBoard = (projectId: string) => {
  router.push({ name: 'TaskBoard', query: { projectId } });
};

watch(
  () => workspaceStore.activeTeamId,
  () => {
    fetchAll();
  },
);
</script>

<template>
  <div class="flex-1 flex flex-col h-full overflow-hidden" style="background-color: var(--bg-app)">
    <div
      class="flex flex-row items-center justify-between gap-2 py-2 sm:py-2.5 px-3 sm:px-6 lg:px-8 shrink-0 border-b transition-colors duration-300 z-10 sticky top-0"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <div class="flex items-center gap-2 sm:gap-3 min-w-0">
        <div class="p-1.5 bg-accent/10 rounded-xl shrink-0 border border-accent/10">
          <Briefcase class="w-3.5 h-3.5 sm:w-4 sm:h-4 text-accent" />
        </div>
        <div class="min-w-0">
          <h1
            class="text-xs sm:text-md font-bold leading-tight truncate"
            style="color: var(--text-primary)"
          >
            项目管理
          </h1>
          <p
            class="hidden sm:block text-[9px] sm:text-[10px] font-medium mt-0.5"
            style="color: var(--text-muted)"
          >
            管理团队项目与协作任务
          </p>
        </div>
      </div>

      <!-- Actions slot -->
      <div class="flex items-center gap-2 sm:gap-3">
        <!-- Search bar inside header -->
        <div class="relative group min-w-0">
          <div class="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
            <Search class="w-3 h-3 text-[var(--text-muted)] group-focus-within:text-accent transition-colors" />
          </div>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索项目..."
            class="pl-7.5 pr-3 py-1 bg-slate-50 dark:bg-slate-800/40 border rounded-full text-[10px] sm:text-xs outline-none focus:ring-2 focus:ring-accent/10 focus:border-accent transition-all shadow-sm w-28 sm:w-40 md:w-56"
            style="border-color: var(--border-base); color: var(--text-primary)"
          />
        </div>

        <!-- Add project button -->
        <button
          class="bg-accent hover:bg-accent-dark text-white px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-bold flex items-center justify-center gap-1 whitespace-nowrap transition-all active:scale-95 shadow-lg shadow-accent/20 cursor-pointer"
          @click="openAddDrawer"
        >
          <FolderPlus class="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          <span class="hidden sm:inline">新建项目</span>
          <span class="sm:hidden">新建</span>
        </button>
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
        <div class="p-2 sm:p-4">
          <div class="max-w-[1600px] mx-auto space-y-3 sm:space-y-4">
            <!-- Limit metric cards block width to prevent excessive horizontal stretching -->
            <div class="max-w-4xl">
              <div class="grid grid-cols-4 gap-2 sm:gap-3.5">
                <StatCard
                  label="总项目"
                  :value="projectStats.total"
                  :icon="Layers"
                  color="text-blue-500"
                  horizontal
                />
                <StatCard
                  label="进行中"
                  :value="projectStats.active"
                  :icon="Activity"
                  color="text-orange-500"
                  horizontal
                />
                <StatCard
                  label="已交付"
                  :value="projectStats.completed"
                  :icon="Award"
                  color="text-emerald-500"
                  horizontal
                />
                <StatCard
                  label="完成率"
                  :value="projectStats.completionRate + '%'"
                  :icon="TrendingUp"
                  color="text-purple-500"
                  horizontal
                />
              </div>
            </div>

            <div class="flex items-center justify-between">
              <h2
                class="text-md sm:text-lg font-black tracking-tight"
                style="color: var(--text-primary)"
              >
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
              class="flex flex-col items-center justify-center py-10 sm:py-16 text-center bg-white/50 dark:bg-slate-900/50 rounded-xl sm:rounded-2xl border border-dashed"
              style="border-color: var(--border-base)"
            >
              <div
                class="w-12 h-12 sm:w-16 sm:h-16 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-4"
              >
                <Search class="w-6 h-6 sm:w-8 sm:h-8 text-slate-300" />
              </div>
              <h3 class="text-md sm:text-lg font-black mb-1.5" style="color: var(--text-primary)">
                未找到项目
              </h3>
              <p class="text-[10px] sm:text-xs text-slate-400 max-w-xs sm:max-w-md mb-6">
                没有匹配当前搜索条件的项目，或者你还没有创建任何项目。
              </p>
              <button
                class="px-5 sm:px-6 py-2 sm:py-2.5 bg-accent text-white rounded-xl font-bold hover:scale-105 transition-all shadow-lg shadow-accent/20 text-xs sm:text-sm cursor-pointer"
                @click="openAddDrawer"
              >
                创建第一个项目
              </button>
            </div>

            <div
              v-else-if="viewMode === 'grid'"
              class="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-4"
            >
              <ProjectCard
                v-for="(project, index) in filteredProjects"
                :key="project.id"
                :project="project"
                layout="grid"
                prevent-navigation
                :style="{ 'animation-delay': `${index * 50}ms` }"
                @edit="openEditDrawer"
                @delete="deleteProject"
                @click="handleProjectClick"
              />
            </div>

            <div
              v-else
              class="bg-transparent md:bg-white dark:md:bg-slate-900 md:rounded-2xl md:border md:shadow-sm md:overflow-hidden"
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
                    prevent-navigation
                    @edit="openEditDrawer"
                    @delete="deleteProject"
                    @click="handleProjectClick"
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
                        class="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400"
                      >
                        项目信息
                      </th>
                      <th
                        class="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 w-44"
                      >
                        项目进度
                      </th>
                      <th
                        class="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 w-32"
                      >
                        当前状态
                      </th>
                      <th
                        class="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 w-44"
                      >
                        参与成员
                      </th>
                      <th
                        class="px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right w-24"
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
                      prevent-navigation
                      @edit="openEditDrawer"
                      @delete="deleteProject"
                      @click="handleProjectClick"
                    />
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- ClickUp-Style Double-Column Project Detail Panel -->
    <Transition :name="projectDetailViewMode === 'drawer' ? 'drawer-slide' : 'modal-fade'">
      <div
        v-if="isDetailDrawerOpen && projectDetail"
        class="fixed inset-0 z-50 flex transition-all duration-300"
        :class="
          projectDetailViewMode === 'drawer'
            ? 'justify-end'
            : 'items-center justify-center p-3 sm:p-6 bg-black/40 backdrop-blur-sm'
        "
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 cursor-pointer"
          :class="projectDetailViewMode === 'drawer' ? 'bg-black/40 backdrop-blur-sm' : ''"
          @click="isDetailDrawerOpen = false"
        ></div>

        <!-- Project Detail Panel Content Container -->
        <div
          class="project-detail-content relative shadow-2xl flex flex-col overflow-hidden transition-all duration-300"
          :class="[
            projectDetailViewMode === 'drawer'
              ? 'w-full sm:w-[85%] md:w-[75%] lg:w-[65%] xl:w-[55%] h-full'
              : 'w-full max-w-4xl h-[90vh] md:h-[85vh] rounded-2xl border',
          ]"
          :style="{
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--border-base)',
            borderLeftWidth: projectDetailViewMode === 'drawer' ? '1px' : '0px',
          }"
        >
          <!-- Header -->
          <div
            class="px-6 py-4 border-b flex items-center justify-between shrink-0"
            style="border-color: var(--border-base)"
          >
            <div class="flex items-center gap-3">
              <div
                class="w-10 h-10 rounded-xl flex items-center justify-center text-white text-base font-black shadow-md shrink-0"
                :class="projectDetail.color"
              >
                {{ projectDetail.title.substring(0, 1) }}
              </div>
              <div>
                <h3 class="text-lg font-black tracking-tight" style="color: var(--text-primary)">
                  {{ projectDetail.title }}
                </h3>
                <p class="text-[10px] font-bold text-slate-400">项目详情与任务协作</p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <!-- Join Project Button for non-members on PUBLIC projects -->
              <button
                v-if="!isDetailMember && projectDetail.visibility === 'PUBLIC'"
                class="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/10"
                @click="handleJoinProjectDetail"
              >
                <Plus class="w-3.5 h-3.5" />
                <span>报名加入项目</span>
              </button>

              <button
                class="px-3 py-1.5 bg-accent/10 hover:bg-accent/20 text-accent rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                @click="navigateToTaskBoard(projectDetail.id)"
              >
                <FolderOpen class="w-3.5 h-3.5" />
                <span>在看板中查看</span>
              </button>

              <!-- View Mode Toggle (Drawer vs Modal) -->
              <button
                class="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-all text-slate-500 dark:text-slate-400 cursor-pointer"
                :title="projectDetailViewMode === 'drawer' ? '切换为弹窗模式' : '切换为抽屉模式'"
                @click="toggleDetailViewMode"
              >
                <component
                  :is="projectDetailViewMode === 'drawer' ? Maximize2 : Minimize2"
                  class="w-4.5 h-4.5"
                />
              </button>

              <button
                class="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-all cursor-pointer"
                style="color: var(--text-secondary)"
                @click="isDetailDrawerOpen = false"
              >
                <X class="w-5 h-5" />
              </button>
            </div>
          </div>

          <!-- Content Body -->
          <div class="flex-1 overflow-y-auto p-4 md:p-5 scrollbar-hide">
            <div
              v-if="isDetailLoading"
              class="flex flex-col items-center justify-center py-20 opacity-50"
            >
              <div
                class="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin mb-4"
              ></div>
              <p class="text-xs font-bold text-slate-400">正在加载项目详情...</p>
            </div>

            <div
              v-else-if="projectDetail"
              class="space-y-6 md:space-y-0 md:grid md:grid-cols-3 md:gap-6 p-1"
            >
              <!-- Left Column: Tasks (col-span-2) -->
              <div class="md:col-span-2 space-y-4">
                <div class="flex items-center justify-between">
                  <h4
                    class="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2"
                  >
                    <Layers class="w-4 h-4" /> 项目任务 ({{ projectDetail.tasks.length }})
                  </h4>
                  <div class="flex gap-2">
                    <button
                      class="px-2.5 py-1 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg text-[10px] font-bold flex items-center gap-1 hover:opacity-95 transition-all cursor-pointer"
                      @click="isBatchDialogOpen = true"
                    >
                      <Plus class="w-3 h-3" />
                      <span>批量添加</span>
                    </button>
                  </div>
                </div>

                <!-- Quick task title input -->
                <div class="relative flex items-center">
                  <input
                    v-model="quickTaskTitle"
                    type="text"
                    placeholder="在此输入新任务标题，按回车快速添加..."
                    class="w-full pl-4 pr-12 py-2 bg-slate-50 dark:bg-slate-800/30 border rounded-xl text-xs focus:outline-none focus:ring-4 focus:ring-accent/10 transition-all font-bold"
                    style="border-color: var(--border-base); color: var(--text-primary)"
                    @keydown.enter="handleQuickAddTask"
                  />
                  <button
                    class="absolute right-1.5 p-1.5 bg-accent text-white rounded-lg hover:scale-105 transition-all"
                    @click="handleQuickAddTask"
                  >
                    <Plus class="w-3 h-3 text-white" />
                  </button>
                </div>

                <!-- Tasks Table -->
                <div
                  v-if="projectDetail.tasks.length === 0"
                  class="py-12 flex flex-col items-center justify-center border-2 border-dashed rounded-2xl opacity-40"
                  style="border-color: var(--border-base)"
                >
                  <CheckCircle2 class="w-8 h-8 text-slate-300 mb-2" />
                  <p class="text-xs font-bold text-slate-400">目前暂无关联任务</p>
                </div>
                <div
                  v-else
                  class="border rounded-xl overflow-hidden"
                  style="border-color: var(--border-base)"
                >
                  <table class="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr
                        class="bg-slate-50/50 dark:bg-slate-800/50 border-b"
                        style="border-color: var(--border-base)"
                      >
                        <th
                          class="px-3.5 py-2.5 font-bold text-slate-400 uppercase tracking-widest text-[9px]"
                        >
                          任务名称
                        </th>
                        <th
                          class="px-3.5 py-2.5 font-bold text-slate-400 uppercase tracking-widest text-[9px] w-36"
                        >
                          执行人
                        </th>
                        <th
                          class="px-3.5 py-2.5 font-bold text-slate-400 uppercase tracking-widest text-[9px] w-24"
                        >
                          优先级
                        </th>
                        <th
                          class="px-3.5 py-2.5 font-bold text-slate-400 uppercase tracking-widest text-[9px] w-32"
                        >
                          状态
                        </th>
                        <th
                          class="px-3.5 py-2.5 font-bold text-slate-400 uppercase tracking-widest text-[9px] text-right w-16"
                        >
                          操作
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="task in projectDetail.tasks"
                        :key="task.id"
                        class="border-b last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/20"
                        style="border-color: var(--border-base)"
                      >
                        <td
                          class="px-3.5 py-2 font-bold truncate max-w-[200px]"
                          :title="task.title"
                          style="color: var(--text-primary)"
                        >
                          {{ task.title }}
                        </td>
                        <td class="px-3.5 py-2">
                          <div v-if="task.assignee" class="flex items-center gap-1.5">
                            <UserAvatar :user="task.assignee" size="xs" />
                            <span class="font-bold text-slate-500 truncate max-w-[80px]">{{
                              task.assignee.name || task.assignee.email
                            }}</span>
                          </div>
                          <span class="text-slate-400" v-else>未指派</span>
                        </td>
                        <td class="px-3.5 py-2">
                          <span
                            class="px-1.5 py-0.2 rounded text-[8px] font-bold uppercase tracking-wider"
                            :class="
                              task.priority === 'URGENT'
                                ? 'bg-red-500/10 text-red-500'
                                : task.priority === 'HIGH'
                                  ? 'bg-orange-500/10 text-orange-500'
                                  : task.priority === 'MEDIUM'
                                    ? 'bg-amber-500/10 text-amber-500'
                                    : 'bg-slate-400/10 text-slate-500'
                            "
                          >
                            {{
                              task.priority === 'URGENT'
                                ? '紧急'
                                : task.priority === 'HIGH'
                                  ? '高'
                                  : task.priority === 'MEDIUM'
                                    ? '中'
                                    : '低'
                            }}
                          </span>
                        </td>
                        <td class="px-3.5 py-2">
                          <el-select
                            v-model="task.status"
                            size="small"
                            class="!w-24 custom-select-small"
                            @change="(val: string) => handleUpdateTaskStatus(task, val)"
                          >
                            <el-option label="待办" value="TODO" />
                            <el-option label="进行中" value="IN_PROGRESS" />
                            <el-option label="已完成" value="DONE" />
                          </el-select>
                        </td>
                        <td class="px-3.5 py-2 text-right">
                          <button
                            class="p-1 hover:text-rose-500 text-slate-400 rounded-lg hover:bg-rose-500/10 transition-all cursor-pointer"
                            @click="handleDeleteTask(task.id)"
                          >
                            <Trash2 class="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- Right Column: Sidebar (col-span-1) -->
              <div class="space-y-4 md:space-y-5">
                <!-- Project Vision (Description) -->
                <div>
                  <h4
                    class="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1"
                  >
                    项目愿景
                  </h4>
                  <p
                    class="text-xs text-slate-500 leading-relaxed bg-slate-50 dark:bg-slate-800/20 p-3 rounded-xl border"
                    style="border-color: var(--border-base)"
                  >
                    {{ projectDetail.description || '暂无项目描述。' }}
                  </p>
                </div>

                <!-- Project Meta (Deadline & Progress) -->
                <div class="grid grid-cols-2 gap-3">
                  <div
                    class="p-3 bg-slate-50 dark:bg-slate-800/30 rounded-xl border"
                    style="border-color: var(--border-base)"
                  >
                    <div
                      class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1"
                    >
                      截止日期
                    </div>
                    <span class="text-xs font-bold" style="color: var(--text-primary)">
                      {{
                        projectDetail.dueDate
                          ? new Date(projectDetail.dueDate).toLocaleDateString()
                          : '未设定'
                      }}
                    </span>
                  </div>
                  <div
                    class="p-3 bg-slate-50 dark:bg-slate-800/30 rounded-xl border"
                    style="border-color: var(--border-base)"
                  >
                    <div
                      class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1"
                    >
                      项目进度
                    </div>
                    <div class="flex items-center gap-2">
                      <div
                        class="flex-1 h-1.5 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700"
                      >
                        <div
                          class="h-full rounded-full bg-accent transition-all duration-500"
                          :style="{ width: projectDetail.progress + '%' }"
                        ></div>
                      </div>
                      <span class="text-[10px] font-black text-accent"
                        >{{ projectDetail.progress }}%</span
                      >
                    </div>
                  </div>
                </div>

                <!-- Members Section -->
                <div class="space-y-2.5">
                  <div class="flex items-center justify-between">
                    <h4
                      class="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5"
                    >
                      <Users class="w-3.5 h-3.5" /> 参与成员 ({{ projectDetail.members.length }})
                    </h4>
                    <button
                      v-if="isDetailOwner"
                      class="px-2 py-0.5 bg-accent/10 hover:bg-accent/20 text-accent rounded-lg text-[10px] font-bold transition-all flex items-center gap-0.5 cursor-pointer"
                      @click="openInviteDetailDialog"
                    >
                      <Plus class="w-2.5 h-2.5" />
                      <span>邀请</span>
                    </button>
                  </div>
                  <div class="flex flex-wrap gap-1.5">
                    <div
                      v-for="m in projectDetail.members"
                      :key="m.userId"
                      class="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg"
                    >
                      <UserAvatar :user="m.user" size="xs" />
                      <span class="text-[11px] font-bold" style="color: var(--text-primary)">{{
                        m.user.name || m.user.email
                      }}</span>
                      <span
                        class="text-[7px] px-1 py-0.1 bg-slate-200 dark:bg-slate-700 text-slate-400 rounded uppercase font-black tracking-wider"
                        >{{ m.role }}</span
                      >
                    </div>
                  </div>

                  <!-- Pending Invitations -->
                  <div
                    v-if="projectDetail.invitations && projectDetail.invitations.length > 0"
                    class="pt-1.5 space-y-1.5"
                  >
                    <div class="text-[9px] font-black uppercase tracking-widest text-slate-400">
                      已发邀请 (等待接受)
                    </div>
                    <div class="flex flex-wrap gap-1.5">
                      <div
                        v-for="inv in projectDetail.invitations"
                        :key="inv.id"
                        class="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 dark:bg-slate-800/40 border border-dashed rounded-lg"
                        style="border-color: var(--border-base)"
                      >
                        <UserAvatar :user="inv.invitee" size="xs" />
                        <span class="text-[11px] font-bold text-slate-400">{{
                          inv.invitee.name || inv.invitee.email
                        }}</span>
                        <span
                          class="text-[7px] px-1 py-0.1 bg-amber-500/10 text-amber-500 rounded uppercase font-black tracking-wider"
                          >PENDING</span
                        >
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Project Settings/Create Custom Dialog/Drawer -->
    <Transition :name="projectFormViewMode === 'drawer' ? 'project-form-slide' : 'project-form-fade'">
      <div
        v-if="isDrawerOpen"
        class="fixed inset-0 z-50 flex transition-all duration-300"
        :class="
          projectFormViewMode === 'drawer'
            ? 'justify-end'
            : 'items-center justify-center p-3 sm:p-6 bg-black/40 backdrop-blur-sm'
        "
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 cursor-pointer"
          :class="projectFormViewMode === 'drawer' ? 'bg-black/40 backdrop-blur-sm' : ''"
          @click="isDrawerOpen = false"
        ></div>

        <!-- Content Container -->
        <div
          class="project-form-content relative shadow-2xl flex flex-col overflow-hidden transition-all duration-300"
          :class="[
            projectFormViewMode === 'drawer'
              ? 'w-full sm:w-[500px] h-full sm:rounded-l-2xl border-l'
              : 'w-full max-w-lg h-[90vh] md:h-[85vh] rounded-2xl border',
          ]"
          :style="{
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--border-base)',
          }"
        >
          <!-- Header -->
          <div
            class="px-6 py-4 border-b flex items-center justify-between shrink-0"
            style="border-color: var(--border-base)"
          >
            <h3
              class="text-lg sm:text-xl font-black tracking-tight"
              style="color: var(--text-primary)"
            >
              {{ isEditMode ? '配置项目' : '启动新项目' }}
            </h3>
            <div class="flex items-center gap-2">
              <!-- View Mode Toggle -->
              <button
                class="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-all text-slate-500 dark:text-slate-400 cursor-pointer"
                :title="projectFormViewMode === 'drawer' ? '切换为弹窗模式' : '切换为抽屉模式'"
                @click="toggleProjectFormViewMode"
              >
                <component
                  :is="projectFormViewMode === 'drawer' ? Maximize2 : Minimize2"
                  class="w-4.5 h-4.5"
                />
              </button>
              <button
                class="p-2 bg-slate-100 dark:bg-slate-800 hover:scale-110 rounded-full transition-all cursor-pointer"
                @click="isDrawerOpen = false"
              >
                <X class="w-4 h-4 text-slate-500" />
              </button>
            </div>
          </div>

          <!-- Body -->
          <div class="flex-1 overflow-y-auto p-5 scrollbar-hide space-y-3.5">
            <div>
              <label
                class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1"
                >项目标识 (名称)</label
              >
              <input
                v-model="projectForm.title"
                type="text"
                class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border rounded-xl text-xs focus:outline-none focus:ring-4 focus:ring-accent/10 transition-all font-bold"
                style="border-color: var(--border-base); color: var(--text-primary)"
                placeholder="例如：代码 M8 重构"
              />
            </div>
            <div>
              <label
                class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1"
                >项目愿景 (描述)</label
              >
              <textarea
                v-model="projectForm.description"
                rows="2"
                class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border rounded-xl text-xs focus:outline-none focus:ring-4 focus:ring-accent/10 transition-all resize-none"
                style="border-color: var(--border-base); color: var(--text-primary)"
                placeholder="一句话概括这个项目的终极目标..."
              ></textarea>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label
                  class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1"
                  >交付物 (截止日期)</label
                >
                <el-date-picker
                  v-model="projectForm.dueDate"
                  type="date"
                  placeholder="Deadline"
                  class="!w-full !rounded-xl custom-date-picker-compact"
                />
              </div>
              <div>
                <label
                  class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1"
                  >视觉色彩</label
                >
                <el-select
                  v-model="projectForm.color"
                  class="!w-full custom-select-compact"
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
              class="p-3 bg-slate-50 dark:bg-slate-800/30 rounded-xl border space-y-3"
              style="border-color: var(--border-base)"
            >
              <div>
                <label
                  class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1"
                  >当前状态</label
                >
                <el-select v-model="projectForm.status" class="!w-full custom-select-compact">
                  <el-option
                    v-for="s in statusOptions"
                    :key="s.value"
                    :label="s.label"
                    :value="s.value"
                  />
                </el-select>
              </div>
              <div>
                <div class="flex items-center justify-between mb-1">
                  <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
                    >项目完成进度 (基于关联任务自动计算)</label
                  >
                  <span class="text-xs font-black text-accent">{{ projectForm.progress }}%</span>
                </div>
                <div class="px-1.5 py-0.5">
                  <div class="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      class="h-full rounded-full transition-all duration-500"
                      :class="projectForm.progress === 100 ? 'bg-emerald-500' : 'bg-accent'"
                      :style="{ width: (projectForm.progress || 0) + '%' }"
                    ></div>
                  </div>
                </div>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label
                  class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1"
                  >可见性与报名</label
                >
                <el-select v-model="projectForm.visibility" class="!w-full custom-select-compact">
                  <el-option label="私有 (仅邀请)" value="PRIVATE" />
                  <el-option label="公开 (成员可报名)" value="PUBLIC" />
                </el-select>
              </div>
              <div>
                <label
                  class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1"
                  >人员满载限制</label
                >
                <el-input-number
                  v-model="projectForm.maxMembers"
                  :min="1"
                  :max="50"
                  class="!w-full custom-number-compact"
                />
              </div>
            </div>
            <div>
              <label
                class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1"
                >分类标签 (逗号分隔)</label
              >
              <input
                v-model="projectForm.tags"
                type="text"
                class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border rounded-xl text-xs focus:outline-none focus:ring-4 focus:ring-accent/10 transition-all font-bold"
                style="border-color: var(--border-base); color: var(--text-primary)"
                placeholder="如：3D建模, WebGL, 内部工具"
              />
            </div>

            <!-- Member Management in Edit Mode -->
            <div v-if="isEditMode" class="space-y-3">
              <!-- Current Members list -->
              <div v-if="projectMembers.length > 0">
                <label
                  class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1"
                  >当前项目成员 ({{ projectMembers.length }})</label
                >
                <div
                  class="border rounded-xl p-2.5 space-y-1.5 bg-slate-50 dark:bg-slate-800/10 max-h-32 overflow-y-auto"
                  style="border-color: var(--border-base)"
                >
                  <div
                    v-for="m in projectMembers"
                    :key="m.userId"
                    class="flex items-center justify-between py-1 border-b last:border-0"
                    style="border-color: var(--border-base)"
                  >
                    <div class="flex items-center gap-2">
                      <UserAvatar :user="m.user" size="xs" />
                      <span class="text-xs font-bold" style="color: var(--text-primary)">{{
                        m.user.name || m.user.email
                      }}</span>
                      <span
                        class="text-[8px] px-1 py-0.2 bg-slate-200 dark:bg-slate-700 text-slate-400 rounded uppercase font-black tracking-wider"
                        >{{ m.role }}</span
                      >
                    </div>
                    <!-- Prevent removing oneself or project owner if we can identify role -->
                    <button
                      v-if="m.role !== 'OWNER' && m.userId !== authStore.user?.id"
                      class="p-1 hover:text-rose-500 text-slate-400 rounded transition-all hover:bg-rose-50 dark:hover:bg-rose-500/10"
                      title="移出项目"
                      @click="handleRemoveMember(m.userId)"
                    >
                      <Trash2 class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              <!-- Invite Select for Edit Mode -->
              <div v-if="availableTeamMembers.length > 0">
                <label
                  class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1"
                  >邀请新项目成员</label
                >
                <el-select
                  v-model="projectForm.inviteUserIds"
                  multiple
                  placeholder="选择要邀请的成员"
                  class="!w-full custom-select-compact"
                >
                  <el-option
                    v-for="m in availableTeamMembers"
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
            </div>

            <!-- Member Management in Create Mode -->
            <template v-else-if="teamMembers.length > 0">
              <div>
                <label
                  class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1"
                  >直接加入的成员</label
                >
                <el-select
                  v-model="projectForm.memberIds"
                  multiple
                  placeholder="选择直接加入的成员"
                  class="!w-full custom-select-compact"
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

              <div>
                <label
                  class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 ml-1"
                  >发送邀请的成员</label
                >
                <el-select
                  v-model="projectForm.inviteUserIds"
                  multiple
                  placeholder="选择要邀请的成员"
                  class="!w-full custom-select-compact"
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
                <p class="text-[9px] sm:text-[10px] text-slate-400 mt-1.5 ml-1">
                  被邀请的成员将收到通知，可自行决定是否加入
                </p>
              </div>
            </template>
          </div>

          <!-- Footer -->
          <div class="flex gap-3.5 p-3.5 border-t shrink-0 bg-slate-50/30 dark:bg-slate-900/10" style="border-color: var(--border-base)">
            <button
              class="flex-1 py-2 sm:py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl font-black transition-all text-xs"
              style="color: var(--text-primary)"
              @click="isDrawerOpen = false"
            >
              取消
            </button>
            <button
              class="flex-[2] py-2 sm:py-2.5 bg-accent text-white rounded-xl font-black shadow-xl shadow-accent/20 hover:scale-[1.02] active:scale-[0.98] transition-all text-xs"
              @click="handleSaveProject"
            >
              {{ isEditMode ? '确认并应用更改' : '正式启动项目' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Batch Create Tasks Dialog -->
    <Transition name="fade">
      <div
        v-if="isBatchDialogOpen"
        class="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4"
      >
        <div
          class="absolute inset-0 bg-black/40 backdrop-blur-sm"
          @click="isBatchDialogOpen = false"
        ></div>
        <div
          class="relative w-full max-w-lg p-5 sm:p-8 rounded-2xl sm:rounded-3xl shadow-2xl space-y-4 sm:space-y-5 max-h-[90vh] overflow-y-auto"
          style="background-color: var(--bg-card)"
        >
          <div class="flex items-center justify-between">
            <h3 class="text-lg sm:text-xl font-bold" style="color: var(--text-primary)">
              批量添加项目任务
            </h3>
            <button style="color: var(--text-secondary)" @click="isBatchDialogOpen = false">
              <X class="w-5 h-5" />
            </button>
          </div>
          <div class="space-y-4">
            <div>
              <label
                class="block text-[10px] sm:text-xs font-bold uppercase mb-1.5 sm:mb-2 ml-1 text-slate-400"
                >任务标题列表 (一行一个任务标题)</label
              >
              <textarea
                v-model="batchTaskText"
                rows="6"
                class="w-full px-4 py-2.5 sm:py-3 bg-slate-100 dark:bg-white/5 border-none rounded-xl sm:rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all resize-none leading-relaxed"
                placeholder="例如：&#10;核心功能代码编写&#10;接口文档编写&#10;前端样式还原校验"
              ></textarea>
            </div>

            <!-- Tasks Preview -->
            <div v-if="parsedBatchTasks.length > 0" class="space-y-1.5 sm:space-y-2">
              <label class="block text-[10px] sm:text-xs font-bold uppercase text-slate-400 ml-1"
                >即将创建的任务预览 (共 {{ parsedBatchTasks.length }} 个)</label
              >
              <div
                class="max-h-24 overflow-y-auto border rounded-xl p-2.5 space-y-1 bg-slate-50 dark:bg-slate-800/10 scrollbar-hide"
                style="border-color: var(--border-base)"
              >
                <div
                  v-for="(t, index) in parsedBatchTasks"
                  :key="index"
                  class="flex items-center justify-between text-[11px] font-bold py-0.5 border-b last:border-0"
                  style="border-color: var(--border-base)"
                >
                  <span class="truncate flex-1 pr-4" style="color: var(--text-primary)">
                    {{ index + 1 }}. {{ t }}
                  </span>
                  <span
                    class="px-1 py-0.2 bg-accent/10 text-accent rounded text-[7px] uppercase font-black tracking-wider shrink-0"
                    >待创建</span
                  >
                </div>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label
                  class="block text-[8px] sm:text-xs font-bold uppercase mb-1 sm:mb-2 ml-1 text-slate-400"
                  >统一负责人</label
                >
                <el-select
                  v-model="batchAssigneeId"
                  clearable
                  placeholder="选择负责人"
                  class="!w-full custom-select"
                >
                  <el-option
                    v-for="m in teamMembers"
                    :key="m.id"
                    :label="m.name || m.email"
                    :value="m.id"
                  >
                    <div class="flex items-center gap-2">
                      <UserAvatar :user="m" size="sm" />
                      <span class="text-xs sm:text-sm">{{ m.name || m.email }}</span>
                    </div>
                  </el-option>
                </el-select>
              </div>
              <div>
                <label
                  class="block text-[8px] sm:text-xs font-bold uppercase mb-1 sm:mb-2 ml-1 text-slate-400"
                  >统一优先级</label
                >
                <el-select v-model="batchPriority" class="!w-full custom-select">
                  <el-option
                    v-for="p in priorityOptions"
                    :key="p.id"
                    :label="p.label"
                    :value="p.id"
                  >
                    <div class="flex items-center gap-2">
                      <div class="w-2 h-2 rounded-full" :class="p.color"></div>
                      <span class="text-xs sm:text-sm font-bold">{{ p.label }}</span>
                    </div>
                  </el-option>
                </el-select>
              </div>
            </div>

            <div>
              <label
                class="block text-[8px] sm:text-xs font-bold uppercase mb-1 sm:mb-2 ml-1 text-slate-400"
                >统一截止日期</label
              >
              <el-date-picker
                v-model="batchDueDate"
                type="date"
                placeholder="Deadline"
                class="!w-full !rounded-2xl custom-date-picker"
                popper-class="custom-date-popper"
              />
            </div>
          </div>
          <button
            class="w-full py-3.5 bg-accent text-white rounded-xl sm:rounded-2xl font-bold shadow-lg shadow-accent/20 hover:scale-[1.02] active:scale-[0.98] transition-all text-sm"
            @click="handleBatchCreateTasks"
          >
            批量创建任务
          </button>
        </div>
      </div>
    </Transition>

    <!-- Invite Project Members Dialog -->
    <Transition name="fade">
      <div
        v-if="isDetailInviteDialogOpen"
        class="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4"
      >
        <div
          class="absolute inset-0 bg-black/40 backdrop-blur-sm"
          @click="isDetailInviteDialogOpen = false"
        ></div>
        <div
          class="relative w-full max-w-md p-5 sm:p-8 rounded-2xl sm:rounded-3xl shadow-2xl space-y-4 sm:space-y-5"
          style="background-color: var(--bg-card)"
        >
          <div class="flex items-center justify-between">
            <h3 class="text-lg sm:text-xl font-bold" style="color: var(--text-primary)">
              邀请新成员加入项目
            </h3>
            <button style="color: var(--text-secondary)" @click="isDetailInviteDialogOpen = false">
              <X class="w-5 h-5" />
            </button>
          </div>

          <div class="space-y-4">
            <div v-if="availableMembersForDetailInvite.length > 0">
              <label
                class="block text-[10px] sm:text-xs font-bold uppercase mb-1.5 sm:mb-2 ml-1 text-slate-400"
                >选择要邀请的团队成员</label
              >
              <el-select
                v-model="detailInviteUserIds"
                multiple
                placeholder="选择成员"
                class="!w-full custom-select"
              >
                <el-option
                  v-for="m in availableMembersForDetailInvite"
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
            <div v-else class="text-center py-6 text-slate-400 text-xs font-bold">
              团队中没有可邀请的其他成员（所有成员均已加入该项目）
            </div>
          </div>

          <div class="flex justify-end gap-2.5 sm:gap-3 pt-2">
            <button
              class="px-4 py-2 sm:px-5 sm:py-2.5 bg-slate-100 dark:bg-white/5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold hover:scale-105 transition-all cursor-pointer"
              style="color: var(--text-primary)"
              @click="isDetailInviteDialogOpen = false"
            >
              取消
            </button>
            <button
              class="px-4 py-2 sm:px-5 sm:py-2.5 bg-accent text-white rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold hover:scale-105 transition-all shadow-md shadow-accent/20 cursor-pointer disabled:opacity-50 disabled:hover:scale-100"
              :disabled="detailInviteUserIds.length === 0"
              @click="handleSendDetailInvite"
            >
              发送邀请
            </button>
          </div>
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

.drawer-slide-enter-active,
.drawer-slide-leave-active {
  transition: opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}
.drawer-slide-enter-from,
.drawer-slide-leave-to {
  opacity: 0;
}
.drawer-slide-enter-active .project-detail-content {
  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}
.drawer-slide-leave-active .project-detail-content {
  transition: transform 0.25s ease-in;
}
.drawer-slide-enter-from .project-detail-content {
  transform: translateX(100%);
}
.drawer-slide-leave-to .project-detail-content {
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
.modal-fade-enter-active .project-detail-content {
  transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.modal-fade-leave-active .project-detail-content {
  transition: transform 0.2s ease-in;
}
.modal-fade-enter-from .project-detail-content {
  transform: scale(0.95) translateY(12px);
}
.modal-fade-leave-to .project-detail-content {
  transform: scale(0.97) translateY(8px);
}

:deep(.custom-drawer) {
  background-color: var(--bg-card) !important;
  border-top-left-radius: 1.25rem !important;
  border-bottom-left-radius: 1.25rem !important;
  box-shadow: -20px 0 50px rgba(0, 0, 0, 0.1) !important;
}
:deep(.el-drawer__header) {
  margin-bottom: 0 !important;
  padding: 1.25rem 1.5rem !important;
  border-bottom: 1px solid var(--border-base);
}
:deep(.el-drawer__body) {
  padding: 1.5rem !important;
}
:deep(.el-drawer__footer) {
  padding: 0 !important;
}

.custom-date-picker :deep(.el-input__wrapper) {
  border-radius: 0.75rem !important;
  padding: 0.5rem 0.75rem !important;
  background-color: var(--bg-app) !important;
  box-shadow: none !important;
  border: 1px solid var(--border-base);
  height: 40px !important;
}
.custom-select :deep(.el-input__wrapper) {
  border-radius: 0.75rem !important;
  background-color: var(--bg-app) !important;
  box-shadow: none !important;
  border: 1px solid var(--border-base);
  height: 40px;
}
.custom-number :deep(.el-input__wrapper) {
  border-radius: 0.75rem !important;
  background-color: var(--bg-app) !important;
  box-shadow: none !important;
  border: 1px solid var(--border-base);
  height: 40px;
}
.custom-slider :deep(.el-slider__bar) {
  background-color: var(--el-color-primary);
}
.custom-slider :deep(.el-slider__button) {
  border-color: var(--el-color-primary);
  width: 20px;
  height: 20px;
}

/* Custom Transition for Project Form */
.project-form-slide-enter-active,
.project-form-slide-leave-active {
  transition: opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}
.project-form-slide-enter-from,
.project-form-slide-leave-to {
  opacity: 0;
}
.project-form-slide-enter-active .project-form-content {
  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}
.project-form-slide-leave-active .project-form-content {
  transition: transform 0.25s ease-in;
}
.project-form-slide-enter-from .project-form-content {
  transform: translateX(100%);
}
.project-form-slide-leave-to .project-form-content {
  transform: translateX(100%);
}

.project-form-fade-enter-active,
.project-form-fade-leave-active {
  transition: opacity 0.3s ease;
}
.project-form-fade-enter-from,
.project-form-fade-leave-to {
  opacity: 0;
}
.project-form-fade-enter-active .project-form-content {
  transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.project-form-fade-leave-active .project-form-content {
  transition: transform 0.2s ease-in;
}
.project-form-fade-enter-from .project-form-content {
  transform: scale(0.95) translateY(12px);
}
.project-form-fade-leave-to .project-form-content {
  transform: scale(0.97) translateY(8px);
}

.custom-date-picker-compact :deep(.el-input__wrapper) {
  border-radius: 0.75rem !important;
  padding: 0.25rem 0.5rem !important;
  background-color: var(--bg-app) !important;
  box-shadow: none !important;
  border: 1px solid var(--border-base);
  height: 32px !important;
}
.custom-select-compact :deep(.el-input__wrapper) {
  border-radius: 0.75rem !important;
  background-color: var(--bg-app) !important;
  box-shadow: none !important;
  border: 1px solid var(--border-base);
  height: 32px !important;
}
.custom-number-compact :deep(.el-input__wrapper) {
  border-radius: 0.75rem !important;
  background-color: var(--bg-app) !important;
  box-shadow: none !important;
  border: 1px solid var(--border-base);
  height: 32px !important;
}
.custom-number-compact :deep(.el-input-number__decrease),
.custom-number-compact :deep(.el-input-number__increase) {
  line-height: 30px !important;
  width: 32px !important;
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
