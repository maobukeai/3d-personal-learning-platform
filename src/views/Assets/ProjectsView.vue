<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  Search,
  FolderPlus,
  LayoutGrid,
  List,
  Layers,
  X,
  TrendingUp,
  Activity,
  Award,
  Maximize2,
  Minimize2,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '@/utils/api';
import { useWorkspaceStore } from '@/stores/workspace';
import UserAvatar from '@/components/UserAvatar.vue';
import ProjectCard from '@/components/ProjectCard.vue';
import StatCard from '@/components/StatCard.vue';

const workspaceStore = useWorkspaceStore();
const searchQuery = ref('');
const viewMode = ref<'grid' | 'list'>('grid');
const projects = ref<any[]>([]);
const isLoading = ref(true);

onMounted(() => {
  fetchProjects();
});

// Create/Edit Project related
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

const fetchProjects = async () => {
  isLoading.value = true;
  try {
    const response = await api.get('/api/projects');
    projects.value = response.data;
  } catch (_error) {
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
  } catch (_error) {
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
  } catch (_error) {
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
      } catch (_error) {
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
        <button type="button" class="flex md:hidden items-center gap-1.5 px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold text-xs shadow-lg" @click="openAddDrawer">
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
        <button type="button" class="hidden md:flex group relative px-6 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-bold overflow-hidden shadow-xl shadow-slate-900/10 dark:shadow-white/10 hover:scale-105 active:scale-95 transition-all items-center gap-2" @click="openAddDrawer">
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
        <!-- Limit metric cards block width to prevent excessive horizontal stretching -->
        <div class="max-w-4xl">
          <div
            class="grid grid-cols-4 gap-2 sm:gap-3.5 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100"
          >
            <StatCard
              label="总项目"
              :value="stats.total"
              :icon="Layers"
              color="text-blue-500"
              horizontal
            />
            <StatCard
              label="进行中"
              :value="stats.active"
              :icon="Activity"
              color="text-orange-500"
              horizontal
            />
            <StatCard
              label="已交付"
              :value="stats.completed"
              :icon="Award"
              color="text-emerald-500"
              horizontal
            />
            <StatCard
              label="完成率"
              :value="stats.completionRate + '%'"
              :icon="TrendingUp"
              color="text-purple-500"
              horizontal
            />
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
type="button" class="p-1.5 sm:p-2 rounded-lg transition-all" :class="
                  viewMode === 'grid'
                    ? 'bg-slate-100 dark:bg-slate-800 text-accent shadow-sm'
                    : 'text-slate-400 hover:text-slate-600'
                " @click="viewMode = 'grid'">
                <LayoutGrid class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
              <button
type="button" class="p-1.5 sm:p-2 rounded-lg transition-all" :class="
                  viewMode === 'list'
                    ? 'bg-slate-100 dark:bg-slate-800 text-accent shadow-sm'
                    : 'text-slate-400 hover:text-slate-600'
                " @click="viewMode = 'list'">
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
          class="flex flex-col items-center justify-center py-10 sm:py-16 text-center bg-white/50 dark:bg-slate-900/50 rounded-xl sm:rounded-2xl border border-dashed"
          style="border-color: var(--border-base)"
        >
          <div
            class="w-12 h-12 sm:w-16 sm:h-16 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-4"
          >
            <Search class="w-6 h-6 sm:w-8 sm:h-8 text-slate-300" />
          </div>
          <h3 class="text-md sm:text-lg font-black mb-1.5" style="color: var(--text-primary)">未找到项目</h3>
          <p class="text-[10px] sm:text-xs text-slate-400 max-w-xs sm:max-w-md mb-6">
            没有匹配当前搜索条件的项目，或者你还没有创建任何项目。
          </p>
          <button type="button" class="px-5 sm:px-6 py-2 sm:py-2.5 bg-accent text-white rounded-xl font-bold hover:scale-105 transition-all shadow-lg shadow-accent/20 text-xs sm:text-sm cursor-pointer" @click="openAddDrawer">
            创建第一个项目
          </button>
        </div>

        <!-- Grid View -->
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

        <!-- List View -->
        <div
          v-else
          class="bg-transparent md:bg-white dark:md:bg-slate-900 md:rounded-2xl md:border md:shadow-sm md:overflow-hidden animate-in fade-in slide-in-from-bottom-8"
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

    <!-- Create/Edit Project Custom Dialog/Drawer -->
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
              {{ isEditMode ? '配置工作流' : '构思新世界' }}
            </h3>
            <div class="flex items-center gap-2">
              <!-- View Mode Toggle -->
              <button type="button" class="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-all text-slate-500 dark:text-slate-400 cursor-pointer" :title="projectFormViewMode === 'drawer' ? '切换为弹窗模式' : '切换为抽屉模式'" @click="toggleProjectFormViewMode">
                <component
                  :is="projectFormViewMode === 'drawer' ? Maximize2 : Minimize2"
                  class="w-4.5 h-4.5"
                />
              </button>
              <button type="button" class="p-2 bg-slate-100 dark:bg-slate-800 hover:scale-110 rounded-full transition-all cursor-pointer" @click="isDrawerOpen = false">
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
                placeholder="例如：代号 M8 重构"
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
                  >交付日</label
                >
                <el-date-picker
                  v-model="projectForm.dueDate"
                  type="date"
                  placeholder="选择 Deadline"
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

            <div v-if="!isEditMode && teamMembers.length > 0" class="space-y-3.5">
              <div>
                <label
                  class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1"
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
                      <UserAvatar :user="m" size="xs" />
                      <span class="font-bold text-xs">{{ m.name || m.email }}</span>
                    </div>
                  </el-option>
                </el-select>
              </div>

              <div>
                <label
                  class="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 ml-1"
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
                      <UserAvatar :user="m" size="xs" />
                      <span class="font-bold text-xs">{{ m.name || m.email }}</span>
                    </div>
                  </el-option>
                </el-select>
                <p class="text-[9px] text-slate-400 mt-1.5 ml-1">
                  被邀请的成员将收到通知，可自行决定是否加入
                </p>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="flex gap-3.5 p-3.5 border-t shrink-0 bg-slate-50/30 dark:bg-slate-900/10" style="border-color: var(--border-base)">
            <button type="button" class="flex-1 py-2 sm:py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl font-black transition-all text-xs" style="color: var(--text-primary)" @click="isDrawerOpen = false">
              取消操作
            </button>
            <button type="button" class="flex-[2] py-2 sm:py-2.5 bg-accent text-white rounded-xl font-black shadow-xl shadow-accent/20 hover:scale-[1.02] active:scale-[0.98] transition-all text-xs" @click="handleSaveProject">
              {{ isEditMode ? '确认并应用更改' : '正式启动项目' }}
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
