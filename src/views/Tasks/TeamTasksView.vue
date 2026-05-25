<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, h } from 'vue';
import { useRoute } from 'vue-router';
import {
  Search,
  FolderPlus,
  LayoutGrid,
  List,
  Layers,
  Activity,
  Award,
  TrendingUp,
  Briefcase,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '@/utils/api';
import { useWorkspaceStore } from '@/stores/workspace';
import ProjectCard from '@/components/ProjectCard.vue';
import StatCard from '@/components/StatCard.vue';
import type { Project, Team, UserType } from '@/types/task';

// Import child components
import ProjectDetailPanel from './components/ProjectDetailPanel.vue';
import ProjectFormPanel from './components/ProjectFormPanel.vue';

const workspaceStore = useWorkspaceStore();
const route = useRoute();

const searchQuery = ref('');
const viewMode = ref<'grid' | 'list'>('grid');
const projects = ref<Project[]>([]);
const isLoading = ref(true);

interface ProjectDetailPanelExpose {
  open: (projectId: string) => Promise<void> | void;
}

interface ProjectFormPanelExpose {
  openAdd: () => void;
  openEdit: (project: Project) => void;
}

interface TeamMemberResponse {
  user: UserType;
}

const projectDetailPanelRef = ref<ProjectDetailPanelExpose | null>(null);
const projectFormPanelRef = ref<ProjectFormPanelExpose | null>(null);

const teamMembers = ref<UserType[]>([]);
const teams = ref<Team[]>([]);

const windowWidth = ref(window.innerWidth);
const updateWidth = () => {
  windowWidth.value = window.innerWidth;
};

onMounted(() => {
  window.addEventListener('resize', updateWidth);
  fetchAll();
  if (route.query.openCreate === 'true') {
    openAddDrawer();
  }
});

onUnmounted(() => {
  window.removeEventListener('resize', updateWidth);
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
  } catch {
    ElMessage.error('获取项目失败');
  }
};

const fetchTeamMembers = async (teamId?: string) => {
  try {
    const tid = teamId || workspaceStore.activeTeamId;
    if (!tid) return;
    const response = await api.get(`/api/teams/${tid}/members`);
    teamMembers.value = ((response.data || []) as TeamMemberResponse[]).map((m) => m.user);
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

const fetchAll = async () => {
  isLoading.value = true;
  await Promise.all([fetchProjects(), fetchTeamMembers(), fetchTeams()]);
  isLoading.value = false;
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

const deleteProject = (id: string) => {
  const deleteTasks = ref(true);
  const deleteRoadmap = ref(true);

  const confirmContent = h('div', { class: 'space-y-3 py-1' }, [
    h('p', { class: 'text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium' }, '确定要永久删除该项目吗？此操作不可逆。'),
    h('div', { class: 'space-y-2 border-t pt-3 border-slate-100 dark:border-white/10' }, [
      h('label', { class: 'flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer select-none' }, [
        h('input', {
          type: 'checkbox',
          checked: deleteTasks.value,
          onChange: (e: any) => { deleteTasks.value = e.target.checked; },
          class: 'rounded border-slate-300 text-accent focus:ring-accent w-3.5 h-3.5 cursor-pointer'
        }),
        h('span', '同时删除项目名下关联的看板任务')
      ]),
      h('label', { class: 'flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer select-none' }, [
        h('input', {
          type: 'checkbox',
          checked: deleteRoadmap.value,
          onChange: (e: any) => { deleteRoadmap.value = e.target.checked; },
          class: 'rounded border-slate-300 text-accent focus:ring-accent w-3.5 h-3.5 cursor-pointer'
        }),
        h('span', '同时删除项目关联的系统学习路线')
      ])
    ])
  ]);

  ElMessageBox.confirm(confirmContent, '删除项目', {
    confirmButtonText: '确定删除',
    cancelButtonText: '取消',
    confirmButtonClass: 'el-button--danger',
  })
    .then(async () => {
      try {
        await api.delete(`/api/projects/${id}`, {
          params: {
            deleteTasks: deleteTasks.value,
            deleteRoadmap: deleteRoadmap.value
          }
        });
        ElMessage.success('项目已删除');
        fetchProjects();
      } catch {
        ElMessage.error('删除失败');
      }
    })
    .catch(() => {});
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
        <button type="button" class="bg-accent hover:bg-accent-dark text-white px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-bold flex items-center justify-center gap-1 whitespace-nowrap transition-all active:scale-95 shadow-lg shadow-accent/20 cursor-pointer border-none" @click="openAddDrawer">
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
type="button" class="p-1.5 sm:p-2 rounded-lg transition-all border-none bg-transparent cursor-pointer" :class="
                      viewMode === 'grid'
                        ? 'bg-slate-100 dark:bg-slate-800 text-accent shadow-sm'
                        : 'text-slate-400 hover:text-slate-600'
                    " @click="viewMode = 'grid'">
                    <LayoutGrid class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                  <button
type="button" class="p-1.5 sm:p-2 rounded-lg transition-all border-none bg-transparent cursor-pointer" :class="
                      viewMode === 'list'
                        ? 'bg-slate-100 dark:bg-slate-800 text-accent shadow-sm'
                        : 'text-slate-400 hover:text-slate-600'
                    " @click="viewMode = 'list'">
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
              <button type="button" class="px-5 sm:px-6 py-2 sm:py-2.5 bg-accent text-white rounded-xl font-bold hover:scale-105 transition-all shadow-lg shadow-accent/20 text-xs sm:text-sm border-none cursor-pointer" @click="openAddDrawer">
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

    <!-- Dialog components -->
    <ProjectDetailPanel
      ref="projectDetailPanelRef"
      @refresh-list="fetchProjects"
    />

    <ProjectFormPanel
      ref="projectFormPanelRef"
      :team-members="teamMembers"
      @saved="fetchProjects"
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
</style>
