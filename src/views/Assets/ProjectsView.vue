<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  Search,
  FolderPlus,
  LayoutGrid,
  List,
  MoreHorizontal,
  Clock,
  Layers,
  CheckCircle2,
  X,
  TrendingUp,
  Activity,
  Award,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '@/utils/api';
import { useWorkspaceStore } from '@/stores/workspace';
import UserAvatar from '@/components/UserAvatar.vue';

const workspaceStore = useWorkspaceStore();

const router = useRouter();
const searchQuery = ref('');
const viewMode = ref<'grid' | 'list'>('grid');
const projects = ref<any[]>([]);
const isLoading = ref(true);

// Create/Edit Project related
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

const teamMembers = ref<any[]>([]);

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

const getStatusLabel = (status: string) => {
  return statusOptions.find((o) => o.value === status)?.label || status;
};

const fetchProjects = async () => {
  isLoading.value = true;
  try {
    const response = await api.get('/api/projects');
    projects.value = response.data;
  } catch (error) {
    ElMessage.error('获取项目失败');
  } finally {
    isLoading.value = false;
  }
};

const fetchTeamMembers = async () => {
  try {
    const tid = workspaceStore.activeTeamId;
    if (!tid) return;
    const response = await api.get(`/api/teams/${tid}/members`);
    teamMembers.value = response.data?.map((m: any) => m.user) || [];
  } catch (error) {
    // silently fail
  }
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

const getTagsList = (tags: string | null) => {
  if (!tags) return [];
  return tags
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t);
};

// Dashboard stats
const stats = computed(() => {
  const total = projects.value.length;
  const active = projects.value.filter((p) => p.status === 'IN_PROGRESS').length;
  const completed = projects.value.filter((p) => p.status === 'COMPLETED').length;
  const completionRate = total ? Math.round((completed / total) * 100) : 0;
  return { total, active, completed, completionRate };
});

onMounted(fetchProjects);
</script>

<template>
  <div class="flex-1 flex flex-col h-full overflow-hidden" style="background-color: var(--bg-app)">
    <!-- Top Header -->
    <div
      class="h-auto md:h-20 px-4 sm:px-10 py-3 md:py-0 flex flex-col md:flex-row md:items-center justify-between shrink-0 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-b z-10 sticky top-0"
      style="border-color: var(--border-base)"
    >
      <div class="flex items-center justify-between mb-3 md:mb-0">
        <div class="flex items-center gap-4">
          <div
            class="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-accent to-purple-600 flex items-center justify-center shadow-lg shadow-accent/20"
          >
            <Layers class="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <div>
            <h1 class="text-xl sm:text-2xl font-black tracking-tight" style="color: var(--text-primary)">
              工作空间
            </h1>
            <p class="hidden sm:block text-[10px] font-bold uppercase tracking-widest text-slate-400">
              管理你的所有创意与项目
            </p>
          </div>
        </div>

        <!-- New Button (Mobile Only) -->
        <button
          class="flex md:hidden items-center gap-1.5 px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold text-xs shadow-lg"
          @click="openAddDrawer"
        >
          <FolderPlus class="w-3.5 h-3.5" />
          <span>新建</span>
        </button>
      </div>

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
            placeholder="搜索项目..."
            class="pl-9 pr-4 py-2 w-full md:w-64 lg:w-80 bg-white dark:bg-slate-800 border rounded-xl text-xs outline-none focus:ring-4 focus:ring-accent/10 transition-all shadow-sm"
            style="border-color: var(--border-base); color: var(--text-primary)"
          />
        </div>
        
        <!-- New Button (Desktop Only) -->
        <button
          class="hidden md:flex group relative px-6 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-bold overflow-hidden shadow-xl shadow-slate-900/10 dark:shadow-white/10 hover:scale-105 active:scale-95 transition-all items-center gap-2"
          @click="openAddDrawer"
        >
          <div
            class="absolute inset-0 bg-accent translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"
          ></div>
          <FolderPlus class="w-4 h-4 relative z-10 group-hover:text-white transition-colors" />
          <span class="relative z-10 group-hover:text-white transition-colors text-sm">新建项目</span>
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto p-4 sm:p-10 scrollbar-hide">
      <div class="max-w-[1600px] mx-auto space-y-6 sm:space-y-10">
        <!-- Dashboard Stats -->
        <div
          class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100"
        >
          <div
            class="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-[2rem] p-3 sm:p-6 border shadow-sm flex flex-col sm:flex-row items-center sm:items-center text-center sm:text-left gap-1.5 sm:gap-6"
            style="border-color: var(--border-base)"
          >
            <div
              class="w-8 h-8 sm:w-14 sm:h-14 rounded-lg sm:rounded-2xl bg-blue-500/10 flex items-center justify-center shrink-0"
            >
              <Layers class="w-4 h-4 sm:w-6 sm:h-6 text-blue-500" />
            </div>
            <div>
              <p class="text-[7px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5 sm:mb-1">
                总项目
              </p>
              <h3 class="text-sm sm:text-3xl font-black" style="color: var(--text-primary)">
                {{ stats.total }}
              </h3>
            </div>
          </div>
          <div
            class="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-[2rem] p-3 sm:p-6 border shadow-sm flex flex-col sm:flex-row items-center sm:items-center text-center sm:text-left gap-1.5 sm:gap-6"
            style="border-color: var(--border-base)"
          >
            <div
              class="w-8 h-8 sm:w-14 sm:h-14 rounded-lg sm:rounded-2xl bg-orange-500/10 flex items-center justify-center shrink-0"
            >
              <Activity class="w-4 h-4 sm:w-6 sm:h-6 text-orange-500" />
            </div>
            <div>
              <p class="text-[7px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5 sm:mb-1">
                进行中
              </p>
              <h3 class="text-sm sm:text-3xl font-black" style="color: var(--text-primary)">
                {{ stats.active }}
              </h3>
            </div>
          </div>
          <div
            class="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-[2rem] p-3 sm:p-6 border shadow-sm flex flex-col sm:flex-row items-center sm:items-center text-center sm:text-left gap-1.5 sm:gap-6"
            style="border-color: var(--border-base)"
          >
            <div
              class="w-8 h-8 sm:w-14 sm:h-14 rounded-lg sm:rounded-2xl bg-emerald-500/10 flex items-center justify-center shrink-0"
            >
              <Award class="w-4 h-4 sm:w-6 sm:h-6 text-emerald-500" />
            </div>
            <div>
              <p class="text-[7px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5 sm:mb-1">
                已交付
              </p>
              <h3 class="text-sm sm:text-3xl font-black" style="color: var(--text-primary)">
                {{ stats.completed }}
              </h3>
            </div>
          </div>
          <div
            class="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-[2rem] p-3 sm:p-6 border shadow-sm flex flex-col sm:flex-row items-center sm:items-center text-center sm:text-left gap-1.5 sm:gap-6"
            style="border-color: var(--border-base)"
          >
            <div
              class="w-8 h-8 sm:w-14 sm:h-14 rounded-lg sm:rounded-2xl bg-purple-500/10 flex items-center justify-center shrink-0"
            >
              <TrendingUp class="w-4 h-4 sm:w-6 sm:h-6 text-purple-500" />
            </div>
            <div>
              <p class="text-[7px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5 sm:mb-1">
                完成率
              </p>
              <div class="flex items-baseline gap-0.5 sm:gap-2 justify-center sm:justify-start">
                <h3 class="text-sm sm:text-3xl font-black" style="color: var(--text-primary)">
                  {{ stats.completionRate }}
                </h3>
                <span class="text-[7px] sm:text-sm font-bold text-slate-400">%</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Toolbar -->
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

        <!-- Loading State -->
        <div v-if="isLoading" class="flex flex-col items-center justify-center py-20 opacity-50">
          <div
            class="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin mb-4"
          ></div>
          <p class="text-sm font-bold text-slate-400">正在加载项目库...</p>
        </div>

        <!-- Empty State -->
        <div
          v-else-if="filteredProjects.length === 0"
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

        <!-- Grid View -->
        <div
          v-else-if="viewMode === 'grid'"
          class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 sm:gap-8"
        >
          <div
            v-for="(project, index) in filteredProjects"
            :key="project.id"
            class="bg-white dark:bg-slate-900 rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-8 border shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 group cursor-pointer relative overflow-hidden animate-in fade-in slide-in-from-bottom-8"
            :style="{ 'border-color': 'var(--border-base)', 'animation-delay': `${index * 50}ms` }"
            @click="router.push({ name: 'ProjectDetail', params: { id: project.id } })"
          >
            <!-- Decorator Blur -->
            <div
              class="absolute -top-10 -right-10 w-32 h-32 opacity-20 blur-3xl transition-opacity group-hover:opacity-40"
              :class="project.color"
            ></div>

            <div class="relative z-10 flex flex-col h-full">
              <div class="flex items-start justify-between mb-4 sm:mb-6">
                <div
                  class="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center text-white shadow-lg"
                  :class="project.color"
                >
                  <span class="text-lg sm:text-xl font-black uppercase">{{
                    project.title.substring(0, 2)
                  }}</span>
                </div>
                <el-dropdown trigger="click" @click.stop>
                  <button
                    class="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
                    style="color: var(--text-secondary)"
                  >
                    <MoreHorizontal class="w-5 h-5" />
                  </button>
                  <template #dropdown>
                    <el-dropdown-menu class="!rounded-xl !p-2">
                      <el-dropdown-item
                        class="!rounded-lg !mb-1 font-bold"
                        @click="router.push({ name: 'ProjectDetail', params: { id: project.id } })"
                        >查看详情</el-dropdown-item
                      >
                      <el-dropdown-item
                        class="!rounded-lg !mb-1 font-bold"
                        @click="openEditDrawer(project)"
                        >配置项目</el-dropdown-item
                      >
                      <el-divider class="!my-1" />
                      <el-dropdown-item
                        class="!rounded-lg !text-rose-500 font-bold hover:!bg-rose-50 dark:hover:!bg-rose-500/10"
                        @click="deleteProject(project.id)"
                        >删除项目</el-dropdown-item
                      >
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>

              <h3
                class="text-base sm:text-lg font-black group-hover:text-accent transition-colors mb-2 line-clamp-1"
                style="color: var(--text-primary)"
              >
                {{ project.title }}
              </h3>
              <p
                class="text-[10px] sm:text-xs leading-relaxed mb-4 sm:mb-6 line-clamp-2"
                style="color: var(--text-secondary)"
              >
                {{ project.description || '暂无项目描述。' }}
              </p>

              <!-- Tags -->
              <div class="flex flex-wrap gap-1.5 sm:gap-2 mb-6 sm:mb-8">
                <span
                  v-for="tag in getTagsList(project.tags).slice(0, 3)"
                  :key="tag"
                  class="text-[9px] sm:text-[10px] font-black px-2 sm:px-2.5 py-0.5 sm:py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500"
                >
                  #{{ tag }}
                </span>
                <span
                  v-if="getTagsList(project.tags).length > 3"
                  class="text-[9px] sm:text-[10px] font-black px-2 sm:px-2.5 py-0.5 sm:py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500"
                >
                  +{{ getTagsList(project.tags).length - 3 }}
                </span>
              </div>

              <!-- Progress -->
              <div class="mt-auto space-y-2 sm:space-y-3 mb-6 sm:mb-8">
                <div
                  class="flex items-center justify-between text-[9px] sm:text-[10px] font-black uppercase tracking-widest"
                >
                  <span style="color: var(--text-secondary)">完成度</span>
                  <span :class="project.progress === 100 ? 'text-emerald-500' : 'text-accent'"
                    >{{ project.progress }}%</span
                  >
                </div>
                <div class="h-1.5 sm:h-2 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                  <div
                    class="h-full rounded-full transition-all duration-1000"
                    :class="project.progress === 100 ? 'bg-emerald-500' : 'bg-accent'"
                    :style="{ width: project.progress + '%' }"
                  ></div>
                </div>
              </div>

              <!-- Footer info -->
              <div
                class="flex items-center justify-between pt-4 sm:pt-5 border-t"
                style="border-color: var(--border-base)"
              >
                <div class="flex items-center -space-x-1.5">
                  <div
                    v-for="(m, i) in project.members.slice(0, 4)"
                    :key="m.userId"
                    class="z-10"
                    :style="{ 'z-index': 10 - Number(i) }"
                  >
                    <UserAvatar
                      :user="m.user"
                      size="sm"
                      class="border-2"
                      style="border-color: var(--bg-card)"
                    />
                  </div>
                  <div
                    v-if="project.members.length > 4"
                    class="w-6 h-6 rounded-full border border-white dark:border-slate-800 bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[8px] sm:text-[10px] font-bold text-slate-500"
                  >
                    +{{ project.members.length - 4 }}
                  </div>
                </div>

                <div
                  class="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl text-[9px] sm:text-[10px] font-black tracking-wider"
                  :class="
                    project.status === 'COMPLETED'
                      ? 'bg-emerald-500/10 text-emerald-500'
                      : project.status === 'IN_PROGRESS'
                        ? 'bg-accent/10 text-accent'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                  "
                >
                  <CheckCircle2 v-if="project.status === 'COMPLETED'" class="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                  <Activity v-else-if="project.status === 'IN_PROGRESS'" class="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                  <Clock v-else class="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                  {{ getStatusLabel(project.status) }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- List View -->
        <div
          v-else
          class="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-[2.5rem] border shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-8"
          style="border-color: var(--border-base)"
        >
          <!-- Desktop Table -->
          <div class="hidden md:block overflow-x-auto">
            <table class="w-full text-left border-collapse">
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
                <tr
                  v-for="project in filteredProjects"
                  :key="project.id"
                  class="border-b last:border-0 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer group"
                  style="border-color: var(--border-base)"
                  @click="router.push({ name: 'ProjectDetail', params: { id: project.id } })"
                >
                  <td class="px-8 py-6">
                    <div class="flex items-center gap-4">
                      <div
                        class="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-lg font-black shadow-sm"
                        :class="project.color"
                      >
                        {{ project.title.substring(0, 1) }}
                      </div>
                      <div>
                        <p
                          class="text-sm font-black group-hover:text-accent transition-colors"
                          style="color: var(--text-primary)"
                        >
                          {{ project.title }}
                        </p>
                        <p class="text-[10px] font-bold text-slate-400 mt-1 line-clamp-1 w-48">
                          {{ project.description || '暂无描述' }}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td class="px-8 py-6">
                    <div class="w-40">
                      <div class="flex items-center justify-between text-[10px] font-black mb-2">
                        <span :class="project.progress === 100 ? 'text-emerald-500' : 'text-accent'"
                          >{{ project.progress }}%</span
                        >
                      </div>
                      <div class="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          class="h-full rounded-full transition-all"
                          :class="project.progress === 100 ? 'bg-emerald-500' : 'bg-accent'"
                          :style="{ width: project.progress + '%' }"
                        ></div>
                      </div>
                    </div>
                  </td>
                  <td class="px-8 py-6">
                    <span
                      class="px-3 py-1.5 rounded-xl text-[10px] font-black tracking-wider"
                      :class="
                        project.status === 'COMPLETED'
                          ? 'bg-emerald-500/10 text-emerald-500'
                          : project.status === 'IN_PROGRESS'
                            ? 'bg-accent/10 text-accent'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                      "
                    >
                      {{ getStatusLabel(project.status) }}
                    </span>
                  </td>
                  <td class="px-8 py-6">
                    <div class="flex items-center -space-x-2">
                      <UserAvatar
                        v-for="m in project.members.slice(0, 3)"
                        :key="m.userId"
                        :user="m.user"
                        size="sm"
                        class="border-2"
                        style="border-color: var(--bg-card)"
                      />
                      <div
                        v-if="project.members.length > 3"
                        class="w-8 h-8 rounded-full border-2 bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-500"
                        style="border-color: var(--bg-card)"
                      >
                        +{{ project.members.length - 3 }}
                      </div>
                    </div>
                  </td>
                  <td class="px-8 py-6 text-right">
                    <el-dropdown trigger="click" @click.stop>
                      <button
                        class="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
                        style="color: var(--text-secondary)"
                      >
                        <MoreHorizontal class="w-5 h-5" />
                      </button>
                      <template #dropdown>
                        <el-dropdown-menu class="!rounded-xl !p-2">
                          <el-dropdown-item
                            class="!rounded-lg !mb-1 font-bold"
                            @click="
                              router.push({ name: 'ProjectDetail', params: { id: project.id } })
                            "
                            >查看详情</el-dropdown-item
                          >
                          <el-dropdown-item
                            class="!rounded-lg !mb-1 font-bold"
                            @click="openEditDrawer(project)"
                            >配置项目</el-dropdown-item
                          >
                          <el-divider class="!my-1" />
                          <el-dropdown-item
                            class="!rounded-lg !text-rose-500 font-bold hover:!bg-rose-50 dark:hover:!bg-rose-500/10"
                            @click="deleteProject(project.id)"
                            >删除项目</el-dropdown-item
                          >
                        </el-dropdown-menu>
                      </template>
                    </el-dropdown>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Mobile Card List -->
          <div class="md:hidden divide-y" style="border-color: var(--border-base)">
            <div
              v-for="project in filteredProjects"
              :key="project.id"
              class="p-5 flex flex-col gap-4"
              @click="router.push({ name: 'ProjectDetail', params: { id: project.id } })"
            >
              <div class="flex items-start justify-between">
                <div class="flex items-center gap-3">
                  <div
                    class="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-black shadow-sm"
                    :class="project.color"
                  >
                    {{ project.title.substring(0, 1) }}
                  </div>
                  <div class="min-w-0">
                    <p class="text-sm font-black truncate" style="color: var(--text-primary)">
                      {{ project.title }}
                    </p>
                    <p class="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
                      {{ project.description || '暂无描述' }}
                    </p>
                  </div>
                </div>
                <el-dropdown trigger="click" @click.stop>
                  <button class="p-2 -mr-2">
                    <MoreHorizontal class="w-4 h-4 text-slate-400" />
                  </button>
                  <template #dropdown>
                    <el-dropdown-menu class="!rounded-xl !p-2">
                      <el-dropdown-item
                        class="!rounded-lg !mb-1 font-bold"
                        @click="router.push({ name: 'ProjectDetail', params: { id: project.id } })"
                        >查看详情</el-dropdown-item
                      >
                      <el-dropdown-item
                        class="!rounded-lg !mb-1 font-bold"
                        @click="openEditDrawer(project)"
                        >配置项目</el-dropdown-item
                      >
                      <el-divider class="!my-1" />
                      <el-dropdown-item
                        class="!rounded-lg !text-rose-500 font-bold hover:!bg-rose-50 dark:hover:!bg-rose-500/10"
                        @click="deleteProject(project.id)"
                        >删除项目</el-dropdown-item
                      >
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>

              <!-- Progress Bar -->
              <div class="space-y-1.5">
                <div class="flex justify-between text-[10px] font-black">
                  <span style="color: var(--text-secondary)">进度</span>
                  <span :class="project.progress === 100 ? 'text-emerald-500' : 'text-accent'"
                    >{{ project.progress }}%</span
                  >
                </div>
                <div class="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    class="h-full rounded-full transition-all"
                    :class="project.progress === 100 ? 'bg-emerald-500' : 'bg-accent'"
                    :style="{ width: project.progress + '%' }"
                  ></div>
                </div>
              </div>

              <!-- Status & Members -->
              <div class="flex items-center justify-between mt-1">
                <div class="flex items-center -space-x-1.5">
                  <UserAvatar
                    v-for="m in project.members.slice(0, 3)"
                    :key="m.userId"
                    :user="m.user"
                    size="xs"
                    class="ring-2 ring-white dark:ring-slate-900"
                  />
                  <div
                    v-if="project.members.length > 3"
                    class="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[8px] font-bold text-slate-500 ring-2 ring-white dark:ring-slate-900"
                  >
                    +{{ project.members.length - 3 }}
                  </div>
                </div>
                <span
                  class="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider"
                  :class="
                    project.status === 'COMPLETED'
                      ? 'bg-emerald-500/10 text-emerald-500'
                      : project.status === 'IN_PROGRESS'
                        ? 'bg-accent/10 text-accent'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                  "
                >
                  {{ getStatusLabel(project.status) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Create/Edit Project Drawer -->
    <el-drawer
      v-model="isDrawerOpen"
      :title="isEditMode ? '项目设定' : '启动新项目'"
      :size="isMobile ? '100%' : '500px'"
      :show-close="false"
      class="custom-drawer"
    >
      <template #header="{ close }">
        <div class="flex items-center justify-between">
          <h3 class="text-2xl font-black tracking-tight" style="color: var(--text-primary)">
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

      <div class="space-y-8 p-1">
        <div>
          <label
            class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 ml-1"
            >项目标识 (名称)</label
          >
          <input
            v-model="projectForm.title"
            type="text"
            class="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-accent/10 transition-all font-bold"
            style="border-color: var(--border-base); color: var(--text-primary)"
            placeholder="例如：代号 M8 重构"
          />
        </div>

        <div>
          <label
            class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 ml-1"
            >项目愿景 (描述)</label
          >
          <textarea
            v-model="projectForm.description"
            rows="4"
            class="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-accent/10 transition-all resize-none"
            style="border-color: var(--border-base); color: var(--text-primary)"
            placeholder="一句话概括这个项目的终极目标..."
          ></textarea>
        </div>

        <div class="grid grid-cols-2 gap-6">
          <div>
            <label
              class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 ml-1"
              >交付日</label
            >
            <el-date-picker
              v-model="projectForm.dueDate"
              type="date"
              placeholder="选择 Deadline"
              class="!w-full !rounded-2xl custom-date-picker"
            />
          </div>
          <div>
            <label
              class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 ml-1"
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
                  <span class="font-bold">{{ c.name }}</span>
                </div>
              </el-option>
            </el-select>
          </div>
        </div>

        <div
          v-if="isEditMode"
          class="p-6 bg-slate-50 dark:bg-slate-800/30 rounded-[2rem] border space-y-6"
          style="border-color: var(--border-base)"
        >
          <div>
            <label
              class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 ml-1"
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

        <div class="grid grid-cols-2 gap-6">
          <div>
            <label
              class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 ml-1"
              >可见性与报名</label
            >
            <el-select v-model="projectForm.visibility" class="!w-full custom-select">
              <el-option label="私有 (仅邀请)" value="PRIVATE" />
              <el-option label="公开 (成员可报名)" value="PUBLIC" />
            </el-select>
          </div>
          <div>
            <label
              class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 ml-1"
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
            class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 ml-1"
            >分类标签 (逗号分隔)</label
          >
          <input
            v-model="projectForm.tags"
            type="text"
            class="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-accent/10 transition-all font-bold"
            style="border-color: var(--border-base); color: var(--text-primary)"
            placeholder="如：3D建模, WebGL, 内部工具"
          />
        </div>

        <div v-if="!isEditMode && teamMembers.length > 0">
          <label
            class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 ml-1"
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
                <UserAvatar :user="m" size="xs" />
                <span class="font-bold">{{ m.name || m.email }}</span>
              </div>
            </el-option>
          </el-select>
        </div>

        <div v-if="!isEditMode && teamMembers.length > 0">
          <label
            class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 ml-1"
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
                <UserAvatar :user="m" size="xs" />
                <span class="font-bold">{{ m.name || m.email }}</span>
              </div>
            </el-option>
          </el-select>
          <p class="text-[10px] text-slate-400 mt-2 ml-1">
            被邀请的成员将收到通知，可自行决定是否加入
          </p>
        </div>
      </div>

      <template #footer>
        <div class="flex gap-4 p-4 border-t" style="border-color: var(--border-base)">
          <button
            class="flex-1 py-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-2xl font-black transition-all"
            style="color: var(--text-primary)"
            @click="isDrawerOpen = false"
          >
            取消操作
          </button>
          <button
            class="flex-[2] py-4 bg-accent text-white rounded-2xl font-black shadow-xl shadow-accent/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
            @click="handleSaveProject"
          >
            {{ isEditMode ? '确认并应用更改' : '正式启动项目' }}
          </button>
        </div>
      </template>
    </el-drawer>
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

.animate-in {
  animation: animate-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  opacity: 0;
}
@keyframes animate-in {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Custom Overrides for Element Plus */
:deep(.custom-drawer) {
  background-color: var(--bg-card) !important;
  border-top-left-radius: 2rem !important;
  border-bottom-left-radius: 2rem !important;
  box-shadow: -20px 0 50px rgba(0, 0, 0, 0.1) !important;
}

@media (max-width: 768px) {
  :deep(.custom-drawer) {
    border-top-left-radius: 0 !important;
    border-bottom-left-radius: 0 !important;
  }
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
