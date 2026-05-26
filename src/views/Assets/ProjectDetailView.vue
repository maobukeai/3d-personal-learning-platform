<script setup lang="ts">
import { ref, onMounted, computed, watch, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  Plus,
  AlignLeft,
  KanbanSquare,
  MessageSquare,
  Search,
  Map,
  CheckCircle2,
  Lock,
  Zap,
  Sparkle,
  Clock,
  Gauge,
  TrendingUp,
  ListTodo,
  GraduationCap,
  BookOpen,
  ArrowRight,
} from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import { getApiErrorMessage } from '@/utils/error';
import UserProfileDialog from '@/components/UserProfileDialog.vue';
import api, { getAssetUrl } from '@/utils/api';
import { useAuthStore } from '@/stores/auth';
import type { Project, ProjectMember, Task, User, Roadmap, RoadmapStep } from '@/types';

// Subcomponents
import ProjectSidebar from './components/ProjectSidebar.vue';
import InviteMembersDialog from './components/InviteMembersDialog.vue';
import TaskAddDrawer from './components/TaskAddDrawer.vue';
import TaskEditDrawer from './components/TaskEditDrawer.vue';
import KanbanBoard from './components/KanbanBoard.vue';
import CollaborationSpace from './components/CollaborationSpace.vue';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const projectId = computed(() => route.params.id as string);

const project = ref<Project | null>(null);
const isLoading = ref(true);
const activeTab = ref('tasks'); // 'tasks', 'discussions', 'settings'

const isProfileDialogOpen = ref(false);
const selectedUserId = ref<string | null>(null);

// Dialogue/Drawer References
const inviteDialogRef = ref<InstanceType<typeof InviteMembersDialog> | null>(null);
const taskAddDrawerRef = ref<InstanceType<typeof TaskAddDrawer> | null>(null);
const taskEditDrawerRef = ref<InstanceType<typeof TaskEditDrawer> | null>(null);

const openUserProfile = (userId: string) => {
  selectedUserId.value = userId;
  isProfileDialogOpen.value = true;
};

const handleStartChat = async (user: User) => {
  try {
    await api.post('/api/messages/conversations', {
      participantIds: [user.id],
      isGroup: false,
    });
    router.push('/messages');
  } catch (_error) {
    ElMessage.error('创建对话失败');
  }
};

const taskSearchQuery = ref('');
const taskDateFilter = ref('all'); // 'all', 'overdue', 'today', 'week'
const taskAssigneeFilter = ref('all'); // 'all', 'me'

const fetchProject = async () => {
  isLoading.value = true;
  try {
    const response = await api.get(`/api/projects/${projectId.value}`);
    project.value = response.data;
  } catch (_error) {
    ElMessage.error('获取项目详情失败');
    router.push('/team-tasks');
  } finally {
    isLoading.value = false;
  }
};

const isMember = computed(() => {
  if (!project.value || !authStore.user) return false;
  return (project.value.members || []).some((member: ProjectMember) => member.userId === authStore.user?.id);
});

const existingMemberIds = computed(() => {
  if (!project.value?.members) return [];
  return project.value.members.map((member) => member.userId);
});

const handleJoin = async () => {
  try {
    await api.post(`/api/projects/${projectId.value}/join`);
    ElMessage.success('成功加入项目');
    fetchProject();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '加入失败'));
  }
};

const openEditTaskDialog = (task: Task) => {
  taskEditDrawerRef.value?.open(task);
};

const isMobile = ref(window.innerWidth < 1024);
const updateIsMobile = () => {
  isMobile.value = window.innerWidth < 1024;
};

const projectTabs = computed(() => {
  const tabs = [
    { id: 'tasks', label: '敏捷看板', icon: KanbanSquare },
  ];

  if (project.value?.roadmap) {
    tabs.push({ id: 'roadmap', label: '学习路线', icon: Map });
  }

  tabs.push({ id: 'discussions', label: '协作空间', icon: MessageSquare });

  if (isMobile.value) {
    tabs.push({ id: 'settings', label: '项目详情', icon: AlignLeft });
  }

  return tabs;
});

// Roadmap state and logic
const myProgress = ref<{ roadmapStepId: string; completed: boolean }[]>([]);
const allCourses = ref<any[]>([]);
const activeStepId = ref<string | null>(null);

const fetchMyProgress = async () => {
  try {
    const response = await api.get('/api/roadmaps/my-progress');
    myProgress.value = response.data;
  } catch (e) {
    console.error('Failed to fetch progress:', e);
  }
};

const fetchAllCourses = async () => {
  try {
    const response = await api.get('/api/courses');
    allCourses.value = response.data;
  } catch (e) {
    console.error('Failed to fetch courses:', e);
  }
};

watch(
  () => project.value?.roadmap,
  (newRm) => {
    if (newRm && newRm.steps && newRm.steps.length > 0 && !activeStepId.value) {
      activeStepId.value = newRm.steps[0].id;
    }
  },
  { immediate: true },
);

const activeStep = computed(() => {
  if (!project.value?.roadmap?.steps || project.value.roadmap.steps.length === 0) return null;
  return (
    project.value.roadmap.steps.find((s) => s.id === activeStepId.value) ||
    project.value.roadmap.steps[0] ||
    null
  );
});

const isStepCompleted = (stepId: string) => {
  return myProgress.value.some((p) => p.roadmapStepId === stepId && p.completed);
};

const toggleStep = async (stepId: string) => {
  const isCompleted = isStepCompleted(stepId);
  try {
    await api.post('/api/roadmaps/step-progress', {
      stepId,
      completed: !isCompleted,
    });
    const progIndex = myProgress.value.findIndex((p) => p.roadmapStepId === stepId);
    if (progIndex > -1) {
      myProgress.value[progIndex].completed = !isCompleted;
    } else {
      myProgress.value.push({ roadmapStepId: stepId, completed: !isCompleted });
    }
    ElMessage.success(!isCompleted ? '恭喜完成该阶段！' : '已重置阶段进度');
  } catch (_error) {
    ElMessage.error('更新进度失败');
  }
};

const calculateRoadmapProgress = (roadmap: Roadmap) => {
  if (!roadmap || !roadmap.steps || roadmap.steps.length === 0) return 0;
  const completedCount = roadmap.steps.filter((s: RoadmapStep) => isStepCompleted(s.id)).length;
  return Math.round((completedCount / roadmap.steps.length) * 100);
};

const isStepLocked = (_step: RoadmapStep, index: number) => {
  if (index === 0) return false;
  if (!project.value?.roadmap) return false;
  const prevStep = project.value.roadmap.steps[index - 1];
  return prevStep && !isStepCompleted(prevStep.id);
};

const getStepStatus = (step: RoadmapStep, index: number) => {
  if (isStepCompleted(step.id)) return 'completed';
  if (isStepLocked(step, index)) return 'locked';
  if (
    index === 0 ||
    (project.value?.roadmap && isStepCompleted(project.value.roadmap.steps[index - 1]?.id))
  )
    return 'current';
  return 'upcoming';
};

const checkedSubTasks = ref<Record<string, boolean>>({});

const loadCheckedSubTasks = () => {
  try {
    const saved = localStorage.getItem('learning_path_subtasks');
    if (saved) {
      checkedSubTasks.value = JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load subtask progress:', e);
  }
};

const toggleSubTask = (taskId: string) => {
  checkedSubTasks.value[taskId] = !checkedSubTasks.value[taskId];
  try {
    localStorage.setItem('learning_path_subtasks', JSON.stringify(checkedSubTasks.value));
  } catch (e) {
    console.error('Failed to save subtask progress:', e);
  }
};

const getRelatedCourses = (step: RoadmapStep) => {
  if (!step || !allCourses.value || allCourses.value.length === 0) return [];
  const title = step.title.toLowerCase();
  const desc = (step.description || '').toLowerCase();

  return allCourses.value
    .filter((course) => {
      const courseTitle = course.title.toLowerCase();
      const courseDesc = (course.description || '').toLowerCase();

      const keywords = [
        'three.js',
        'threejs',
        'blender',
        'shader',
        'webgl',
        '3d',
        'modeling',
        '渲染',
        '建模',
        '材质',
        '动画',
        '贴图',
        '灯光',
        '拓扑',
        '材质',
        '骨骼',
        '动力学',
      ];
      for (const kw of keywords) {
        if (
          (title.includes(kw) || desc.includes(kw)) &&
          (courseTitle.includes(kw) || courseDesc.includes(kw))
        ) {
          return true;
        }
      }

      const words = title.split(/[\s,.\-得的要与及和了与]/).filter((w: string) => w.length > 1);
      for (const w of words) {
        if (courseTitle.includes(w)) {
          return true;
        }
      }
      return false;
    })
    .slice(0, 2);
};

const getSubTasksForStep = (step: RoadmapStep): { id: string; text: string }[] => {
  if (!step) return [];

  if (step.subtasks) {
    try {
      const parsed = typeof step.subtasks === 'string' ? JSON.parse(step.subtasks) : step.subtasks;
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item: any, index: number) => {
          if (item && typeof item === 'object') {
            return {
              id: item.id || `${step.id}_custom_s${index}`,
              text: item.text || '',
            };
          }
          return {
            id: `${step.id}_custom_s${index}`,
            text: String(item),
          };
        });
      }
    } catch (e) {
      console.error('Failed to parse step subtasks:', e);
    }
  }
  return [];
};

const getMetricsForStep = (step: RoadmapStep, index: number) => {
  if (!step) return { difficulty: 50, practical: 50, duration: 20 };
  const title = step.title.toLowerCase();

  let difficulty = 35 + index * 12;
  let practical = 55 + index * 5;
  let duration = 6 + index * 6;

  if (
    title.includes('shader') ||
    title.includes('着色器') ||
    title.includes('glsl') ||
    title.includes('渲染引擎') ||
    title.includes('webgl') ||
    title.includes('图形学') ||
    title.includes('渲染')
  ) {
    difficulty += 25;
    practical += 15;
    duration += 12;
  }
  else if (
    title.includes('blender') ||
    title.includes('建模') ||
    title.includes('雕刻') ||
    title.includes('拓扑') ||
    title.includes('材质') ||
    title.includes('贴图') ||
    title.includes('pbr') ||
    title.includes('灯光')
  ) {
    difficulty += 10;
    practical += 28;
    duration += 8;
  }
  else if (
    title.includes('three.js') ||
    title.includes('threejs') ||
    title.includes('交互') ||
    title.includes('动画') ||
    title.includes('控制') ||
    title.includes('代码')
  ) {
    difficulty += 8;
    practical += 18;
    duration += 6;
  }

  if (
    title.includes('入门') ||
    title.includes('基础') ||
    title.includes('概念') ||
    title.includes('起步') ||
    title.includes('介绍') ||
    title.includes('理论')
  ) {
    difficulty = Math.max(difficulty - 22, 15);
    practical = Math.max(practical - 15, 20);
    duration = Math.max(duration - 5, 3);
  }
  if (
    title.includes('高级') ||
    title.includes('精通') ||
    title.includes('进阶') ||
    title.includes('核心') ||
    title.includes('深入') ||
    title.includes('深度')
  ) {
    difficulty += 15;
    practical += 10;
    duration += 8;
  }

  const subTasks = getSubTasksForStep(step);
  duration += subTasks.length * 1.5;
  practical += subTasks.length * 3;

  const relatedCourses = getRelatedCourses(step);
  if (relatedCourses.length > 0) {
    practical = Math.min(practical + relatedCourses.length * 8, 98);
    duration = Math.min(duration + relatedCourses.length * 6, 120);

    const hasAdvanced = relatedCourses.some((c) => c.difficulty === 'ADVANCED');
    if (hasAdvanced) {
      difficulty = Math.min(difficulty + 15, 98);
    }
  }

  return {
    difficulty: Math.min(Math.max(Math.round(difficulty), 15), 98),
    practical: Math.min(Math.max(Math.round(practical), 20), 98),
    duration: Math.min(Math.max(Math.round(duration), 2), 160),
  };
};

watch(
  () => route.params.id,
  (newId) => {
    if (newId) fetchProject();
  },
);

onMounted(() => {
  window.addEventListener('resize', updateIsMobile);
  fetchProject();
  fetchMyProgress();
  fetchAllCourses();
  loadCheckedSubTasks();
});

onUnmounted(() => {
  window.removeEventListener('resize', updateIsMobile);
});
</script>

<template>
  <div class="flex-1 flex flex-col lg:flex-row overflow-hidden bg-slate-50 dark:bg-slate-955 font-sans relative">
    <!-- Global Loading -->
    <div
      v-if="isLoading"
      class="absolute inset-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm flex items-center justify-center"
    >
      <div
        class="w-16 h-16 border-4 border-accent border-t-transparent rounded-full animate-spin"
      ></div>
    </div>

    <template v-else-if="project">
      <!-- Left Sidebar (Project Meta) -->
      <ProjectSidebar
        :project="project"
        :is-member="isMember"
        :is-mobile="isMobile && activeTab !== 'settings'"
        @join="handleJoin"
        @invite="inviteDialogRef?.open()"
        @open-profile="openUserProfile"
      />

      <!-- Main Content Area -->
      <main
        v-if="!isMobile || activeTab !== 'settings'"
        class="flex-1 flex flex-col min-w-0 bg-transparent"
      >
        <!-- Top Navigation -->
        <header
          class="h-auto md:h-20 px-3 md:px-10 py-2.5 md:py-0 flex flex-col md:flex-row md:items-center justify-between border-b bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl shrink-0 gap-2 md:gap-0"
          style="border-color: var(--border-base)"
        >
          <!-- Segmented Control + Mobile New Button -->
          <div class="flex items-center justify-between gap-2">
            <div class="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-x-auto scrollbar-hide">
              <button
                v-for="tab in projectTabs" :key="tab.id" type="button" class="flex items-center gap-1.5 md:gap-2 px-2.5 md:px-6 py-1.5 md:py-2.5 rounded-lg text-[11px] md:text-sm font-black transition-all whitespace-nowrap shrink-0 cursor-pointer" :class="
                  activeTab === tab.id
                    ? 'bg-white dark:bg-slate-700 text-accent shadow-sm'
                    : 'text-slate-555 hover:text-slate-700 dark:hover:text-slate-300'
                " @click="activeTab = tab.id">
                <component :is="tab.icon" class="w-3.5 h-3.5 md:w-4 md:h-4" />
                <span>{{ tab.label }}</span>
              </button>
            </div>

            <!-- Mobile New Task Button -->
            <button v-if="isMember && activeTab === 'tasks'" type="button" class="flex md:hidden items-center gap-1 px-3 py-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold text-[11px] shadow-lg shrink-0 cursor-pointer" @click="taskAddDrawerRef?.open()">
              <Plus class="w-3.5 h-3.5" /> 新建
            </button>
          </div>

          <div class="flex items-center gap-2 md:gap-4">
            <div v-if="activeTab === 'tasks'" class="relative flex-1 md:flex-none">
              <Search class="w-3.5 h-3.5 md:w-4 md:h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                v-model="taskSearchQuery"
                type="text"
                placeholder="搜索任务..."
                class="pl-9 pr-3 py-2 md:py-2.5 bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-xs focus:ring-2 focus:ring-accent/20 w-full md:w-48 transition-all"
                style="color: var(--text-primary)"
              />
            </div>
            <button v-if="isMember && activeTab === 'tasks'" type="button" class="hidden md:flex px-6 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold text-sm shadow-xl hover:scale-105 active:scale-95 transition-all items-center gap-2 cursor-pointer" @click="taskAddDrawerRef?.open()">
              <Plus class="w-4 h-4" /> 分配新任务
            </button>
          </div>
        </header>

        <!-- Project Kanban Filter Bar -->
        <div
          v-if="activeTab === 'tasks'"
          class="px-3 md:px-10 py-2.5 md:py-3 border-b flex items-center gap-3 md:gap-6 overflow-x-auto scrollbar-hide shrink-0"
          style="border-color: var(--border-base)"
        >
          <div class="flex items-center gap-1.5 md:gap-2 shrink-0">
            <span
              class="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap"
              >截止:</span
            >
            <div class="flex p-0.5 md:p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <button
v-for="f in [
                  { id: 'all', label: '全部' },
                  { id: 'overdue', label: '已逾期' },
                  { id: 'today', label: '今日' },
                  { id: 'week', label: '本周' },
                ]" :key="f.id" type="button" class="px-2 md:px-3 py-1 rounded-md text-[9px] md:text-[10px] font-bold transition-all whitespace-nowrap cursor-pointer" :class="
                  taskDateFilter === f.id
                    ? 'bg-white dark:bg-slate-700 text-accent shadow-sm'
                    : 'text-slate-500'
                " @click="taskDateFilter = f.id">
                {{ f.label }}
              </button>
            </div>
          </div>

          <div class="h-4 w-px bg-slate-200 dark:bg-slate-700 shrink-0"></div>

          <div class="flex items-center gap-1.5 md:gap-2 shrink-0">
            <span
              class="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap"
              >执行人:</span
            >
            <div class="flex p-0.5 md:p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <button
type="button" class="px-2 md:px-3 py-1 rounded-md text-[9px] md:text-[10px] font-bold transition-all whitespace-nowrap cursor-pointer" :class="
                  taskAssigneeFilter === 'all'
                    ? 'bg-white dark:bg-slate-700 text-accent shadow-sm'
                    : 'text-slate-500'
                " @click="taskAssigneeFilter = 'all'">
                全部
              </button>
              <button
type="button" class="px-2 md:px-3 py-1 rounded-md text-[9px] md:text-[10px] font-bold transition-all whitespace-nowrap cursor-pointer" :class="
                  taskAssigneeFilter === 'me'
                    ? 'bg-white dark:bg-slate-700 text-accent shadow-sm'
                    : 'text-slate-500'
                " @click="taskAssigneeFilter = 'me'">
                我的
              </button>
            </div>
          </div>
        </div>

        <!-- Dynamic Content -->
        <div class="flex-1 overflow-hidden relative">
          <!-- Kanban View -->
          <KanbanBoard
            v-show="activeTab === 'tasks'"
            :project="project"
            :is-member="isMember"
            :search-query="taskSearchQuery"
            :date-filter="taskDateFilter"
            :assignee-filter="taskAssigneeFilter"
            @edit-task="openEditTaskDialog"
            @open-profile="openUserProfile"
            @refresh="fetchProject"
          />

          <!-- Discussions View -->
          <CollaborationSpace
            v-show="activeTab === 'discussions'"
            :project="project"
            :project-id="projectId"
            :is-member="isMember"
            @open-profile="openUserProfile"
            @join="handleJoin"
            @refresh="fetchProject"
          />

          <!-- Roadmap View -->
          <div
            v-if="activeTab === 'roadmap' && project.roadmap"
            class="h-full overflow-y-auto p-4 md:p-6 scrollbar-hide space-y-6"
          >
            <!-- Roadmap Header card -->
            <div
              class="p-4 rounded-2xl border border-slate-200/50 dark:border-white/5 bg-white/50 dark:bg-slate-900/40 backdrop-blur-md relative overflow-hidden"
            >
              <div class="absolute -right-10 -top-10 w-36 h-36 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full blur-3xl"></div>
              <div class="absolute -left-10 -bottom-10 w-36 h-36 bg-accent/5 dark:bg-accent/10 rounded-full blur-3xl"></div>
              
              <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                <div class="space-y-1.5 min-w-0">
                  <div class="flex items-center gap-2">
                    <h2 class="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100 truncate">
                      {{ project.roadmap.title }}
                    </h2>
                    <span class="inline-flex items-center gap-0.5 px-2 py-0.5 bg-accent/10 text-accent text-[10px] font-black rounded-full">
                      项目专属学习路线
                    </span>
                  </div>
                  <p class="text-xs text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
                    {{ project.roadmap.description || '项目专属的学习路径规划，指引团队成员循序渐进地完成目标。' }}
                  </p>
                </div>
                
                <!-- Progress Indicator -->
                <div class="flex items-center gap-3 shrink-0 self-start md:self-center bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 p-2 px-3 rounded-xl">
                  <div class="flex flex-col items-end">
                    <span class="text-[9px] font-black uppercase text-slate-400 tracking-wider">路线进度</span>
                    <span class="text-xs font-black text-emerald-500">{{ calculateRoadmapProgress(project.roadmap) }}%</span>
                  </div>
                  <div class="w-24 sm:w-32 h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      class="h-full bg-gradient-to-r from-accent to-emerald-500 rounded-full transition-all duration-700"
                      :style="{ width: calculateRoadmapProgress(project.roadmap) + '%' }"
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Main Split Layout -->
            <div class="grid grid-cols-12 gap-4 sm:gap-6 items-start">
              <!-- Left Column: Sequential Timeline -->
              <div class="col-span-12 lg:col-span-7 xl:col-span-8 space-y-4">
                <div class="relative pl-[25px] sm:pl-12 space-y-4 py-2">
                  <!-- Connective vertical line -->
                  <div class="absolute left-[11px] sm:left-[21px] top-6 bottom-6 w-0.5 rounded-full bg-slate-200 dark:bg-slate-800"></div>

                  <div
                    v-for="(step, index) in project.roadmap.steps"
                    :key="step.id"
                    class="relative cursor-pointer transition-all duration-300"
                    @click="activeStepId = step.id"
                  >
                    <!-- Glowing track representing progress -->
                    <div
                      v-if="index < project.roadmap.steps.length - 1 && isStepCompleted(step.id)"
                      class="absolute left-[-13px] sm:left-[-30px] top-6 bottom-[-22px] w-0.5 bg-emerald-500 z-0 opacity-80"
                    ></div>

                    <!-- Step Node Indicator -->
                    <div
                      class="absolute -left-[25px] sm:-left-[49px] top-1 w-6 h-6 sm:w-9 sm:h-9 rounded-lg sm:rounded-2xl flex items-center justify-center z-10 border-2 border-white dark:border-slate-900 transition-all duration-300"
                      :class="{
                        'bg-emerald-500 text-white shadow-md shadow-emerald-500/20 scale-105 ring-4 ring-emerald-500/10':
                          getStepStatus(step, index) === 'completed',
                        'bg-accent text-white shadow-md shadow-accent/20 animate-pulse ring-4 ring-accent/10':
                          getStepStatus(step, index) === 'current',
                        'bg-slate-100 dark:bg-slate-800 text-slate-350 dark:text-slate-650':
                          getStepStatus(step, index) === 'locked',
                        'bg-white dark:bg-slate-900 text-slate-450 border-slate-200 dark:border-slate-700':
                          getStepStatus(step, index) === 'upcoming',
                      }"
                    >
                      <CheckCircle2 v-if="getStepStatus(step, index) === 'completed'" class="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5" />
                      <Lock v-else-if="getStepStatus(step, index) === 'locked'" class="w-3 h-3 sm:w-4 sm:h-4" />
                      <Zap v-else-if="getStepStatus(step, index) === 'current'" class="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5" />
                      <span v-else class="text-xs font-black">{{ index + 1 }}</span>
                    </div>

                    <!-- Card Body -->
                    <div
                      class="p-4 sm:p-5 rounded-2xl border transition-all duration-300 relative group overflow-hidden"
                      :class="{
                        'bg-emerald-500/[0.01] dark:bg-emerald-500/[0.02] border-emerald-500/20':
                          getStepStatus(step, index) === 'completed' && activeStepId !== step.id,
                        'bg-accent/[0.02] border-accent/25 shadow-md shadow-accent/5 ring-1 ring-accent/5':
                          getStepStatus(step, index) === 'current' && activeStepId !== step.id,
                        'bg-slate-50/20 dark:bg-white/[0.005] border-slate-200/40 dark:border-white/5 opacity-55':
                          getStepStatus(step, index) === 'locked' && activeStepId !== step.id,
                        'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800':
                          getStepStatus(step, index) === 'upcoming' && activeStepId !== step.id,
                        'border-accent ring-2 ring-accent/20 bg-accent/[0.04] dark:bg-accent/[0.03] shadow-lg -translate-y-0.5':
                          activeStepId === step.id,
                      }"
                    >
                      <div class="flex items-start justify-between gap-4">
                        <div class="space-y-1 flex-1 min-w-0">
                          <div class="flex flex-wrap items-center gap-1.5">
                            <span
                              class="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded"
                              :class="{
                                'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400':
                                  getStepStatus(step, index) === 'completed',
                                'bg-accent/10 text-accent': getStepStatus(step, index) === 'current',
                                'bg-slate-100 dark:bg-white/5 text-slate-400':
                                  getStepStatus(step, index) === 'locked',
                                'bg-slate-100 dark:bg-white/5 text-slate-500':
                                  getStepStatus(step, index) === 'upcoming',
                              }"
                            >
                              阶段 {{ index + 1 }}
                            </span>
                            <span v-if="activeStepId === step.id" class="text-[9px] font-black text-accent bg-accent/10 px-2 py-0.5 rounded flex items-center gap-0.5">
                              <Sparkle class="w-2.5 h-2.5" /> 探索中
                            </span>
                          </div>
                          <h3
                            class="text-sm sm:text-base font-bold truncate transition-colors"
                            :class="{
                              'text-emerald-600 dark:text-emerald-400': getStepStatus(step, index) === 'completed',
                              'text-accent': getStepStatus(step, index) === 'current',
                              'text-slate-400 dark:text-slate-550': getStepStatus(step, index) === 'locked',
                              'text-slate-800 dark:text-slate-100': getStepStatus(step, index) === 'upcoming',
                            }"
                          >
                            {{ step.title }}
                          </h3>
                          <p class="text-xs text-slate-400 dark:text-slate-500 line-clamp-2 leading-relaxed">
                            {{ step.description || '当前阶段暂无详细指引。点击卡片在右侧面板查看突围任务及关联课程。' }}
                          </p>
                        </div>
                        
                        <div class="flex items-center gap-2 shrink-0 self-center">
                          <div v-if="isStepCompleted(step.id)" class="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                            <CheckCircle2 class="w-3.5 h-3.5" />
                          </div>
                          <ArrowRight class="w-4 h-4 text-slate-350 dark:text-slate-600 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Right Column: Interactive Detail Companion -->
              <div class="col-span-12 lg:col-span-5 xl:col-span-4 lg:sticky lg:top-4 space-y-4">
                <div
                  v-if="activeStep"
                  class="p-5 rounded-2xl border border-slate-200/50 dark:border-white/5 bg-white/70 dark:bg-slate-900/50 backdrop-blur-md space-y-5 shadow-xl relative overflow-hidden text-left"
                >
                  <div class="absolute -right-12 -top-12 w-24 h-24 bg-accent/5 rounded-full blur-2xl"></div>

                  <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 relative z-10">
                    <div class="flex items-center gap-2">
                      <div class="w-8 h-8 rounded-lg bg-accent text-white flex items-center justify-center shrink-0">
                        <Gauge class="w-4.5 h-4.5" />
                      </div>
                      <div class="space-y-0.5">
                        <h4 class="text-[9px] font-black text-slate-400 uppercase tracking-widest">智能探索分析仪</h4>
                        <p class="text-xs font-bold text-slate-700 dark:text-slate-200">阶段详情聚焦</p>
                      </div>
                    </div>
                    <span class="text-xs font-bold text-accent bg-accent/10 px-2 py-0.5 rounded-full shrink-0">
                      阶段 {{ project.roadmap.steps.indexOf(activeStep) + 1 }}
                    </span>
                  </div>

                  <!-- Title & Desc -->
                  <div class="space-y-2 relative z-10">
                    <h3 class="text-base font-black text-slate-800 dark:text-slate-100 leading-tight">
                      {{ activeStep.title }}
                    </h3>
                    <p class="text-xs text-slate-555 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-white/[0.01] p-3 rounded-xl border border-slate-100 dark:border-slate-850">
                      {{ activeStep.description || '当前阶段为您的自定义攻坚节点。配合下方的技能突破清单，探索该领域并攻克技术难题。' }}
                    </p>
                  </div>

                  <!-- Actions -->
                  <div class="pt-1 relative z-10">
                    <button
                      type="button"
                      class="w-full py-2.5 px-4 rounded-xl text-xs font-black text-white transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md border-none"
                      :class="isStepCompleted(activeStep.id) ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/10' : 'bg-accent hover:bg-accent-dark shadow-accent/10'"
                      @click="toggleStep(activeStep.id)"
                    >
                      <CheckCircle2 class="w-4 h-4" />
                      <span>{{ isStepCompleted(activeStep.id) ? '已攻克阶段 (重置)' : '攻克阶段大纲目标' }}</span>
                    </button>
                  </div>

                  <!-- Attributes -->
                  <div class="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800 relative z-10">
                    <div class="flex items-center gap-1 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      <TrendingUp class="w-3.5 h-3.5 text-accent" />
                      <span>技能属性评估</span>
                    </div>

                    <div class="space-y-2">
                      <div>
                        <div class="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                          <span>技能挑战难度</span>
                          <span class="font-bold text-slate-700 dark:text-slate-350">
                            {{ getMetricsForStep(activeStep, project.roadmap.steps.indexOf(activeStep)).difficulty }}%
                          </span>
                        </div>
                        <div class="h-1.5 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                          <div
                            class="h-full bg-rose-500 rounded-full transition-all duration-500"
                            :style="{ width: getMetricsForStep(activeStep, project.roadmap.steps.indexOf(activeStep)).difficulty + '%' }"
                          ></div>
                        </div>
                      </div>

                      <div>
                        <div class="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                          <span>工程实战权重</span>
                          <span class="font-bold text-slate-700 dark:text-slate-350">
                            {{ getMetricsForStep(activeStep, project.roadmap.steps.indexOf(activeStep)).practical }}%
                          </span>
                        </div>
                        <div class="h-1.5 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                          <div
                            class="h-full bg-purple-500 rounded-full transition-all duration-500"
                            :style="{ width: getMetricsForStep(activeStep, project.roadmap.steps.indexOf(activeStep)).practical + '%' }"
                          ></div>
                        </div>
                      </div>

                      <div class="flex items-center justify-between text-xs pt-1">
                        <span class="text-slate-500 flex items-center gap-1">
                          <Clock class="w-3.5 h-3.5 text-slate-400" />
                          预估学习时间
                        </span>
                        <span class="font-black text-slate-700 dark:text-slate-200">
                          {{ getMetricsForStep(activeStep, project.roadmap.steps.indexOf(activeStep)).duration }}
                          <span class="text-[10px] font-normal text-slate-400">小时</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <!-- Checklist -->
                  <div
                    v-if="getSubTasksForStep(activeStep).length > 0"
                    class="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800 relative z-10"
                  >
                    <div class="flex items-center gap-1 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <ListTodo class="w-3.5 h-3.5 text-accent" />
                      <span>技能突破细分任务</span>
                    </div>

                    <div class="space-y-2 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                      <div
                        v-for="task in getSubTasksForStep(activeStep)"
                        :key="task.id"
                        class="flex items-start gap-2 group/item cursor-pointer"
                        @click="toggleSubTask(task.id)"
                      >
                        <div
                          class="w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors mt-0.5"
                          :class="checkedSubTasks[task.id] ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm shadow-emerald-500/10' : 'border-slate-300 dark:border-slate-650 group-hover/item:border-accent bg-white dark:bg-slate-850'"
                        >
                          <CheckCircle2 v-if="checkedSubTasks[task.id]" class="w-3 h-3 text-white" />
                        </div>
                        <span
                          class="text-xs transition-all duration-300"
                          :class="checkedSubTasks[task.id] ? 'text-slate-400 dark:text-slate-550 line-through' : 'text-slate-600 dark:text-slate-300 group-hover/item:text-slate-800 dark:group-hover/item:text-slate-100'"
                        >
                          {{ task.text }}
                        </span>
                      </div>
                    </div>
                  </div>

                  <!-- Course Recommendations -->
                  <div
                    v-if="getRelatedCourses(activeStep).length > 0"
                    class="space-y-2.5 pt-3 border-t border-slate-100 dark:border-slate-800 relative z-10"
                  >
                    <div class="flex items-center gap-1 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <GraduationCap class="w-3.5 h-3.5 text-accent" />
                      <span>智能推荐关联课程</span>
                    </div>

                    <div class="space-y-2.5">
                      <div
                        v-for="course in getRelatedCourses(activeStep)"
                        :key="course.id"
                        class="flex gap-2.5 p-2 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-500/[0.01] hover:border-accent/40 dark:hover:border-accent/40 hover:bg-white dark:hover:bg-slate-900/50 transition-all cursor-pointer group/card"
                        @click="router.push({ name: 'CourseDetail', params: { id: course.id } })"
                      >
                        <div class="w-16 h-10 rounded bg-slate-100 dark:bg-slate-850 shrink-0 border border-slate-200/50 dark:border-slate-700/50 overflow-hidden">
                          <img
                            v-if="course.thumbnail"
                            alt=""
                            :src="getAssetUrl(course.thumbnail)"
                            class="w-full h-full object-cover group-hover/card:scale-105 transition-transform"
                          />
                          <BookOpen v-else class="w-3 h-3 text-slate-400 mx-auto my-3" />
                        </div>
                        <div class="min-w-0 flex-1 flex flex-col justify-between">
                          <h4 class="text-xs font-bold text-slate-700 dark:text-slate-200 truncate group-hover/card:text-accent transition-colors leading-snug">
                            {{ course.title }}
                          </h4>
                          <div class="flex items-center justify-between text-[10px] text-slate-450">
                            <span class="px-1 py-0.2 bg-slate-100 dark:bg-slate-800 rounded text-[9px]">
                              {{ course.difficulty === 'BEGINNER' ? '入门' : course.difficulty === 'INTERMEDIATE' ? '进阶' : '高级' }}
                            </span>
                            <span class="text-accent flex items-center gap-0.5 font-bold group-hover/card:translate-x-0.5 transition-transform text-[9px]">
                              去掌握 <ArrowRight class="w-2 h-2" />
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </template>

    <!-- Drawer/Dialog Components -->
    <InviteMembersDialog
      ref="inviteDialogRef"
      :project-id="projectId"
      :team-id="project?.teamId || ''"
      :existing-member-ids="existingMemberIds"
      @invited="fetchProject"
    />

    <TaskAddDrawer
      ref="taskAddDrawerRef"
      :project-id="projectId"
      :members="project?.members || []"
      @saved="fetchProject"
    />

    <TaskEditDrawer
      ref="taskEditDrawerRef"
      :members="project?.members || []"
      @saved="fetchProject"
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
</style>
