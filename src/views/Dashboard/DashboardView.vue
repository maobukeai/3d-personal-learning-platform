<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Box,
  MessageSquare,
  TrendingUp,
  Calendar,
  Brain,
  FileText,
  Sparkles,
  BookOpen,
  Upload,
  FolderOpen,
  Users,
  Zap,
  Activity,
  CheckSquare,
  Clock,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  Star,
  Flame,
  Check,
  Circle,
  Play,
  Layers,
} from 'lucide-vue-next';
import ProjectImportDialog from './components/ProjectImportDialog.vue';
import api, { getAssetUrl } from '@/utils/api';
import { useAuthStore } from '@/stores/auth';
import { useWorkspaceStore } from '@/stores/workspace';
import { socketService } from '@/utils/socket';
import StatCard from '@/components/StatCard.vue';
import UserAvatar from '@/components/UserAvatar.vue';
import type {
  DashboardActivity,
  DashboardAsset,
  DashboardEnrollment,
  DashboardTask,
} from './types';

import { useRouter } from 'vue-router';

const { t } = useI18n();
const router = useRouter();
const authStore = useAuthStore();

const greeting = computed(() => {
  const hour = new Date().getHours();
  if (hour < 6) return '深夜好';
  if (hour < 12) return '早上好';
  if (hour < 14) return '中午好';
  if (hour < 18) return '下午好';
  return '晚上好';
});

const stats = ref([
  { label: t('dashboard.stats.learningProgress'), value: '0%', trend: '0%', color: 'text-accent', icon: TrendingUp },
  { label: t('dashboard.stats.pendingTasks'), value: '0', trend: '0', color: 'text-amber-600', icon: Calendar },
  { label: t('dashboard.stats.assets'), value: '0', trend: '0', color: 'text-emerald-600', icon: Box },
  { label: '社区积分', value: '1,240', trend: '+120', color: 'text-yellow-500', icon: Star },
]);

watch(
  () => t('dashboard.stats.learningProgress'),
  () => {
    stats.value[0].label = t('dashboard.stats.learningProgress');
    stats.value[1].label = t('dashboard.stats.pendingTasks');
    stats.value[2].label = t('dashboard.stats.assets');
    stats.value[3].label = '社区积分';
  },
);

interface DashboardProject {
  id: string;
  title: string;
  progress: number;
  color?: string;
}
const recentProjects = ref<DashboardProject[]>([]);

const activeEnrollment = ref<DashboardEnrollment | null>(null);
const activityLog = ref<DashboardActivity[]>([]);
const recentAssets = ref<DashboardAsset[]>([]);
const recentTasks = ref<DashboardTask[]>([]);
const selectedDate = ref(new Date());
const isAddDialogOpen = ref(false);
const importDialogMode = ref<'netdisk' | 'ai_assistant' | 'traditional'>('ai_assistant');

const workspaceStore = useWorkspaceStore();

interface TeamMemberRecord {
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
}
const userTeamRole = ref<'OWNER' | 'ADMIN' | 'MEMBER' | null>(null);

const fetchTeamMembers = async () => {
  try {
    const tid = workspaceStore.activeTeamId;
    if (!tid) { userTeamRole.value = null; return; }
    const response = await api.get(`/api/teams/${tid}/members`);
    const records = (response.data || []) as TeamMemberRecord[];
    const myRecord = records.find(m => m.userId === authStore.user?.id);
    userTeamRole.value = myRecord ? myRecord.role : null;
  } catch { userTeamRole.value = null; }
};

const canCreateProject = computed(() => {
  if (authStore.user?.role === 'ADMIN') return true;
  const currentWs = workspaceStore.currentWorkspace;
  if (!currentWs || currentWs.type === 'personal') return true;
  if (currentWs.type === 'team') return userTeamRole.value === 'OWNER' || userTeamRole.value === 'ADMIN';
  return false;
});

const disabledDate = (time: Date) => {
  if (!authStore.user?.createdAt) return time.getTime() > Date.now();
  const regDate = new Date(authStore.user.createdAt);
  regDate.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return time.getTime() < regDate.getTime() || time.getTime() > today.getTime();
};

const fetchDashboardData = async () => {
  try {
    const year = selectedDate.value.getFullYear();
    const month = String(selectedDate.value.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.value.getDate()).padStart(2, '0');
    const dateParam = `${year}-${month}-${day}`;

    const [statsRes, enrollmentsRes, activityRes, assetsRes, tasksRes, projectsRes] = await Promise.all([
      api.get('/api/auth/stats', { params: { date: dateParam } }).catch(() => null),
      api.get('/api/courses/my-enrollments').catch(() => null),
      api.get('/api/auth/activity', { params: { date: dateParam } }).catch(() => null),
      api.get('/api/assets/my').catch(() => null),
      api.get('/api/tasks', { params: { date: dateParam } }).catch(() => null),
      api.get('/api/projects').catch(() => null),
    ]);
    const overallTasksRes = await api.get('/api/tasks').catch(() => null);

    if (statsRes?.data) {
      const data = statsRes.data;
      stats.value[0].value = data.learningProgress;
      stats.value[0].trend = data.trends?.learning || '0%';
      stats.value[1].value = data.taskCount.toString();
      stats.value[1].trend = data.trends?.tasks || '0';
      stats.value[2].value = data.assetCount.toString();
      stats.value[2].trend = data.trends?.assets || '0';
      
      // Get real points and points trend from backend
      const userPoints = data.points !== undefined ? data.points : 50;
      stats.value[3].value = userPoints.toLocaleString();
      stats.value[3].trend = data.trends?.points || '+0';
    }

    if (enrollmentsRes?.data) {
      activeEnrollment.value = enrollmentsRes.data.length > 0 ? enrollmentsRes.data[0] : null;
    }
    if (activityRes?.data) {
      activityLog.value = activityRes.data;
    }
    if (assetsRes?.data) {
      recentAssets.value = (assetsRes.data || []).slice(0, 4);
    }
    
    const tasksData = tasksRes?.data || [];
    const overallTasksData = overallTasksRes?.data || [];
    recentTasks.value = (tasksData.length > 0 ? tasksData : overallTasksData).slice(0, 4);

    if (projectsRes?.data && Array.isArray(projectsRes.data)) {
      recentProjects.value = projectsRes.data.slice(0, 3).map((p: any) => ({
        id: p.id,
        title: p.title,
        progress: p.progress || 0,
        color: p.color || 'bg-accent',
      }));
    } else {
      recentProjects.value = [];
    }
  } catch (error) {
    console.error('Fetch dashboard data error:', error);
  }
};

watch(selectedDate, fetchDashboardData);
watch(() => workspaceStore.activeWorkspaceId, () => { fetchDashboardData(); fetchTeamMembers(); });
// Leaderboard has been moved below


const formatTime = (date: string) => {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return t('dashboard.time.minutesAgo', { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('dashboard.time.hoursAgo', { n: hours });
  return new Date(date).toLocaleDateString();
};


const isOverdue = (task: DashboardTask) => {
  if (!task.dueDate || task.status === 'DONE') return false;
  const due = new Date(task.dueDate); due.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return due.getTime() < today.getTime();
};

const statusConfig: Record<string, { label: string; cls: string }> = {
  TODO: { label: '待办', cls: 'status-todo' },
  IN_PROGRESS: { label: '进行中', cls: 'status-progress' },
  DONE: { label: '已完成', cls: 'status-done' },
};

const quickActions = [
  { icon: BookOpen, label: '继续课程', color: 'qa-blue', route: '/academy' },
  { icon: Upload, label: '上传作品', color: 'qa-purple', route: '/my-works' },
  { icon: FolderOpen, label: '浏览项目', color: 'qa-green', route: '/projects' },
  { icon: Users, label: '探索团队', color: 'qa-orange', route: '/explore-teams' },
  { icon: MessageSquare, label: '社区讨论', color: 'qa-pink', route: '/discussions' },
  { icon: Zap, label: '我的任务', color: 'qa-yellow', route: '/work' },
];


interface FeedItem {
  id: string;
  type: 'task' | 'activity' | 'system';
  icon: any;
  title: string;
  description: string;
  time: string;
  rawTime: Date;
  statusClass?: string;
  statusText?: string;
  user?: {
    name: string;
    avatarUrl?: string | null;
  };
}

const unifiedFeed = computed<FeedItem[]>(() => {
  const items: FeedItem[] = [];

  // 1. Process activity log (Community activity)
  activityLog.value.forEach(log => {
    let icon = MessageSquare;
    let type: 'task' | 'activity' | 'system' = 'activity';
    if (log.action.includes('上传') || log.action.includes('作品')) {
      icon = Star;
    } else if (log.action.includes('课程') || log.action.includes('学习')) {
      icon = Flame;
    }
    
    items.push({
      id: log.id,
      type,
      icon,
      title: log.user.name,
      description: `${log.action} #${log.target}`,
      time: formatTime(log.createdAt),
      rawTime: new Date(log.createdAt),
      user: {
        name: log.user.name,
        avatarUrl: log.user.avatarUrl
      }
    });
  });

  // 2. Process tasks
  recentTasks.value.forEach(task => {
    const isCompleted = task.status === 'DONE';
    const isProg = task.status === 'IN_PROGRESS';
    
    items.push({
      id: `task-${task.id}`,
      type: 'task',
      icon: isCompleted ? Check : isProg ? Clock : Circle,
      title: task.title,
      description: isCompleted ? '完成了工作区任务' : isProg ? '正在推进工作区任务' : '工作区待办任务',
      time: task.dueDate ? `截止: ${new Date(task.dueDate).toLocaleDateString()}` : '无截止日期',
      rawTime: task.dueDate ? new Date(task.dueDate) : new Date(0),
      statusClass: isCompleted ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : isProg ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-slate-500/10 text-slate-400 border border-slate-500/20',
      statusText: isCompleted ? '已完成' : isProg ? '进行中' : '待办'
    });
  });

  return items.sort((a, b) => b.rawTime.getTime() - a.rawTime.getTime());
});

const leaderboard = ref<{ id: string; name: string; avatarUrl?: string | null; score: number; rank: number; }[]>([]);

const fetchLeaderboard = async () => {
  const res = await api.get('/api/auth/leaderboard').catch(() => null);
  if (res?.data && Array.isArray(res.data)) {
    leaderboard.value = res.data.slice(0, 5);
  } else {
    leaderboard.value = [];
  }
};


interface ActiveBanner {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  route: string;
  tag: string | null;
  tagColor: string | null;
  buttonText: string;
  order: number;
}
const activeBanners = ref<ActiveBanner[]>([]);
const activeSlideIndex = ref(0);
let carouselTimer: ReturnType<typeof setInterval> | null = null;

const startCarousel = () => {
  stopCarousel();
  if (activeBanners.value.length > 1) {
    carouselTimer = setInterval(() => {
      activeSlideIndex.value = (activeSlideIndex.value + 1) % activeBanners.value.length;
    }, 5000);
  }
};

const stopCarousel = () => {
  if (carouselTimer) {
    clearInterval(carouselTimer);
    carouselTimer = null;
  }
};

const fetchActiveBanners = async () => {
  try {
    const { data } = await api.get('/api/banners');
    activeBanners.value = data;
    activeSlideIndex.value = 0;
    startCarousel();
  } catch (error) {
    console.error('Failed to fetch active banners:', error);
  }
};

onMounted(() => {
  fetchDashboardData();
  fetchTeamMembers();
  fetchLeaderboard();
  fetchActiveBanners();

  socketService.on('new_activity', (activity: DashboardActivity) => {
    const [y, m, d] = [selectedDate.value.getFullYear(), selectedDate.value.getMonth() + 1, selectedDate.value.getDate()];
    const filter = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const ad = new Date(activity.createdAt);
    const aStr = `${ad.getFullYear()}-${String(ad.getMonth()+1).padStart(2,'0')}-${String(ad.getDate()).padStart(2,'0')}`;
    if (aStr === filter) {
      activityLog.value.unshift(activity);
      if (activityLog.value.length > 10) activityLog.value.pop();
    }
  });
});

onUnmounted(() => {
  stopCarousel();
});
</script>

<template>
  <div
    class="enterprise-page flex flex-col h-full overflow-hidden transition-colors duration-300"
    style="background-color: var(--bg-app)"
  >
    <!-- ── Toolbar ── -->
    <div
      class="dashboard-toolbar flex flex-row gap-3 px-4 py-2.5 md:px-6 items-center justify-between shrink-0 border-b transition-colors duration-300"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <!-- Greeting / title left side -->
      <div class="flex items-center gap-3 min-w-0">
        <div class="greeting-badge flex items-center gap-1.5 px-3 py-1.5 rounded-lg shrink-0">
          <Sparkles class="w-3.5 h-3.5 text-yellow-400" />
          <span class="text-xs font-bold" style="color: var(--text-primary)">
            {{ greeting }}，{{ authStore.user?.name || '创作者' }} 👋
          </span>
        </div>
        <span class="hidden sm:block text-xs" style="color: var(--text-muted)">今天也是充满灵感的一天！</span>
      </div>

      <!-- Right controls -->
      <div class="flex items-center gap-2 shrink-0">
        <el-date-picker
          v-model="selectedDate"
          type="date"
          class="!w-36 custom-date-picker"
          :placeholder="t('dashboard.selectDate')"
          :clearable="false"
          :disabled-date="disabledDate"
          popper-class="custom-date-popper"
        >
          <template #prefix>
            <Calendar class="w-3.5 h-3.5 text-slate-400" />
          </template>
        </el-date-picker>

        <button
          v-if="canCreateProject"
          type="button"
          class="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white rounded-lg transition-colors cursor-pointer font-bold text-xs"
          @click="() => { importDialogMode = 'ai_assistant'; isAddDialogOpen = true; }"
        >
          <Brain class="w-3.5 h-3.5" />
          <span class="hidden sm:inline">{{ t('dashboard.aiPlanner') }}</span>
        </button>

        <button
          v-if="canCreateProject"
          type="button"
          class="dashboard-secondary-action flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer font-bold text-xs border"
          @click="() => { importDialogMode = 'traditional'; isAddDialogOpen = true; }"
        >
          <FileText class="w-3.5 h-3.5" style="color: var(--text-muted)" />
          <span class="hidden sm:inline">{{ t('dashboard.textImport') }}</span>
        </button>
      </div>
    </div>

    <!-- ── Main canvas — natural scrolling, space-y-6 ── -->
    <div class="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scrollbar-hide">

      <!-- ── SECTION 1: Dynamic Hero Banner/Carousel ── -->
      <!-- Single active banner display -->
      <div v-if="activeBanners.length === 1" class="relative w-full h-[280px] md:h-[320px] rounded-2xl overflow-hidden border border-white/10 dark:border-white/5 shadow-2xl shrink-0 flex items-center p-6 md:p-10">
        <!-- Background Image -->
        <div
          class="absolute inset-0 bg-cover bg-center transition-transform duration-[10000ms] scale-105"
          :style="{ backgroundImage: `url(${getAssetUrl(activeBanners[0].imageUrl)})` }"
        ></div>
        <!-- Dark glass shadow overlays -->
        <div class="absolute inset-0 bg-gradient-to-r from-[#0d1117]/95 via-[#0d1117]/80 to-transparent"></div>
        <div class="absolute inset-0 bg-gradient-to-t from-[#0d1117]/40 via-transparent to-transparent"></div>

        <!-- Content Panel -->
        <div class="relative z-20 max-w-md space-y-3.5 md:space-y-4">
          <span
            v-if="activeBanners[0].tag"
            class="inline-block text-[10px] md:text-xs font-black uppercase px-2.5 py-0.5 rounded-full border"
            :class="activeBanners[0].tagColor || 'bg-accent/15 text-accent border-accent/30'"
          >
            {{ activeBanners[0].tag }}
          </span>
          <h1 class="text-xl md:text-3xl font-black tracking-tight text-white drop-shadow-sm leading-tight">
            {{ activeBanners[0].title }}
          </h1>
          <p v-if="activeBanners[0].subtitle" class="text-xs md:text-sm text-slate-300 font-medium leading-relaxed drop-shadow-sm max-w-md">
            {{ activeBanners[0].subtitle }}
          </p>
          <div class="pt-1 flex gap-3">
            <button
              type="button"
              class="flex items-center gap-1.5 px-4.5 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg transition-all font-bold text-xs shadow-[0_0_15px_rgba(245,121,42,0.35)] cursor-pointer hover:-translate-y-0.5"
              @click="router.push(activeBanners[0].route)"
            >
              <Play class="w-3.5 h-3.5 fill-white" />
              {{ activeBanners[0].buttonText }}
            </button>
          </div>
        </div>
      </div>

      <!-- Multiple active banners slider carousel -->
      <div v-else-if="activeBanners.length > 1" class="relative w-full h-[280px] md:h-[320px] rounded-2xl overflow-hidden border border-white/10 dark:border-white/5 shadow-2xl shrink-0">
        <div
          v-for="(slide, idx) in activeBanners"
          :key="slide.id"
          class="absolute inset-0 transition-opacity duration-1000 flex items-center p-6 md:p-10"
          :class="activeSlideIndex === idx ? 'opacity-100 z-10' : 'opacity-0 z-0'"
        >
          <!-- Background Image with smooth zoom -->
          <div
            class="absolute inset-0 bg-cover bg-center transition-transform duration-[10000ms]"
            :style="{ backgroundImage: `url(${getAssetUrl(slide.imageUrl)})` }"
            :class="activeSlideIndex === idx ? 'scale-105' : 'scale-100'"
          ></div>
          <!-- Dark glass shadow overlays -->
          <div class="absolute inset-0 bg-gradient-to-r from-[#0d1117]/95 via-[#0d1117]/80 to-transparent"></div>
          <div class="absolute inset-0 bg-gradient-to-t from-[#0d1117]/40 via-transparent to-transparent"></div>

          <!-- Content Panel -->
          <div class="relative z-20 max-w-md space-y-3.5 md:space-y-4">
            <span
              v-if="slide.tag"
              class="inline-block text-[10px] md:text-xs font-black uppercase px-2.5 py-0.5 rounded-full border"
              :class="slide.tagColor || 'bg-accent/15 text-accent border-accent/30'"
            >
              {{ slide.tag }}
            </span>
            <h1 class="text-xl md:text-3xl font-black tracking-tight text-white drop-shadow-sm leading-tight">
              {{ slide.title }}
            </h1>
            <p v-if="slide.subtitle" class="text-xs md:text-sm text-slate-300 font-medium leading-relaxed drop-shadow-sm max-w-md">
              {{ slide.subtitle }}
            </p>
            <div class="pt-1 flex gap-3">
              <button
                type="button"
                class="flex items-center gap-1.5 px-4.5 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg transition-all font-bold text-xs shadow-[0_0_15px_rgba(245,121,42,0.35)] cursor-pointer hover:-translate-y-0.5"
                @click="router.push(slide.route)"
              >
                <Play class="w-3.5 h-3.5 fill-white" />
                {{ slide.buttonText }}
              </button>
            </div>
          </div>
        </div>

        <!-- Navigation arrows -->
        <button
          type="button"
          class="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/40 hover:bg-black/65 border border-white/10 flex items-center justify-center text-white cursor-pointer transition-all hover:scale-105"
          @click="activeSlideIndex = (activeSlideIndex - 1 + activeBanners.length) % activeBanners.length"
        >
          <ChevronLeft class="w-4 h-4" />
        </button>
        <button
          type="button"
          class="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/40 hover:bg-black/65 border border-white/10 flex items-center justify-center text-white cursor-pointer transition-all hover:scale-105"
          @click="activeSlideIndex = (activeSlideIndex + 1) % activeBanners.length"
        >
          <ChevronRight class="w-4 h-4" />
        </button>

        <!-- Indicator Dots -->
        <div class="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-2">
          <button
            v-for="(slide, idx) in activeBanners"
            :key="'dot-' + slide.id"
            type="button"
            class="h-1.5 rounded-full transition-all duration-300 cursor-pointer"
            :class="activeSlideIndex === idx ? 'w-6 bg-accent' : 'w-1.5 bg-white/40'"
            @click="activeSlideIndex = idx"
          ></button>
        </div>
      </div>

      <!-- ── SECTION 2: Stats Row ── -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
        <StatCard
          v-for="stat in stats"
          :key="stat.label"
          :label="stat.label"
          :value="stat.value"
          :trend="stat.trend"
          :color="stat.color"
          :icon="stat.icon"
          :horizontal="true"
          class="h-[76px]"
        />
      </div>

      <!-- ── SECTION 3: Middle Row (Three-column layout) ── -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 shrink-0 items-stretch">
        <!-- Left: Quick Actions (col-span-3) -->
        <div class="col-span-12 lg:col-span-3 flex flex-col">
          <div class="blender-card p-3.5 flex-1 flex flex-col justify-between h-full min-h-[220px]">
            <div>
              <div class="flex items-center justify-between mb-3 px-1">
                <span class="text-xs font-bold" style="color: var(--text-secondary)">快捷入口</span>
                <Zap class="w-3.5 h-3.5 text-accent" />
              </div>
              <div class="grid grid-cols-3 gap-1.5">
                <button
                  v-for="qa in quickActions"
                  :key="qa.label"
                  type="button"
                  class="qa-btn flex flex-col items-center gap-1 p-2 rounded-xl cursor-pointer transition-all group"
                  @click="router.push(qa.route)"
                >
                  <div class="qa-icon p-2 rounded-lg transition-transform group-hover:scale-110" :class="qa.color">
                    <component :is="qa.icon" class="w-3.5 h-3.5" />
                  </div>
                  <span class="text-[9px] font-bold leading-tight text-center transition-colors qa-btn-label">{{ qa.label }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Center: Current Course Card (col-span-6) -->
        <div class="col-span-12 lg:col-span-6 flex flex-col">
          <!-- Active learning course card -->
          <div v-if="activeEnrollment" class="blender-card flex flex-col md:flex-row h-full min-h-[220px]">
            <div class="relative w-full md:w-2/5 h-36 md:h-auto overflow-hidden shrink-0">
              <img
                :src="getAssetUrl(activeEnrollment.course.thumbnail) || 'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=800&auto=format&fit=crop&q=60'"
                class="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                alt="Course Thumbnail"
              />
              <div class="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-black/85 to-transparent"></div>
              <div class="absolute top-2.5 left-2.5 bg-accent/90 text-white text-[8px] font-extrabold px-1.5 py-0.5 rounded shadow">
                正在学习
              </div>
            </div>
            <div class="p-3.5 flex flex-col justify-between flex-1 min-w-0">
              <div class="space-y-1.5">
                <div class="flex items-center gap-1.5">
                  <BookOpen class="w-3.5 h-3.5 text-blue-400" />
                  <span class="text-[10px] font-bold text-blue-400 uppercase tracking-wider">最近进度</span>
                </div>
                <h2 class="text-xs md:text-sm font-black truncate leading-snug" style="color: var(--text-primary)">
                  {{ activeEnrollment.course.title }}
                </h2>
                <p class="text-[10px] leading-relaxed font-medium line-clamp-2" style="color: var(--text-secondary)">
                  新手必学的 3D 创作课程，开启您的 3D 梦幻设计之旅，掌握业界顶尖材质节点及建模流程。
                </p>
              </div>

              <div class="space-y-2 pt-2">
                <div class="flex justify-between items-center text-[9px] font-bold" style="color: var(--text-muted)">
                  <span class="text-accent">{{ activeEnrollment.progress }}% 完成</span>
                  <span>剩余 {{ activeEnrollment.course._count.lessons }} 节</span>
                </div>
                <div class="progress-track h-1.5 rounded-full overflow-hidden w-full">
                  <div
                    class="h-full rounded-full progress-fill transition-all"
                    :style="{ width: `${activeEnrollment.progress}%` }"
                  ></div>
                </div>
                <button
                  type="button"
                  class="w-full flex items-center justify-center gap-1 py-1.5 bg-accent hover:bg-accent-hover text-white text-[11px] font-bold rounded-lg transition-all shadow-[0_0_10px_rgba(245,121,42,0.2)] cursor-pointer"
                  @click="router.push(`/academy/player/${activeEnrollment.courseId}`)"
                >
                  <span>继续学习</span>
                  <ArrowRight class="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          <!-- Empty state for course progress -->
          <div v-else class="blender-card flex flex-col items-center justify-center p-6 h-full min-h-[220px] text-center">
            <BookOpen class="w-8 h-8 mb-2 opacity-25" style="color: var(--text-muted)" />
            <p class="text-xs font-bold mb-3.5" style="color: var(--text-secondary)">暂无正在学习的课程</p>
            <button
              type="button"
              class="flex items-center gap-1.5 px-4.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold rounded-lg transition-all cursor-pointer shadow-[0_0_10px_rgba(37,99,235,0.2)]"
              @click="router.push('/academy')"
            >
              <span>探索课程库</span>
              <ChevronRight class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <!-- Right: Discord style Unified Live Feed (col-span-3) -->
        <div class="col-span-12 lg:col-span-3 flex flex-col">
          <div class="blender-card flex flex-col h-full min-h-[220px]">
            <div class="flex items-center justify-between px-3 pt-3.5 pb-2 border-b shrink-0" style="border-color: var(--border-base)">
              <div class="flex items-center gap-1.5">
                <Activity class="w-3.5 h-3.5 text-accent" />
                <span class="text-xs font-bold" style="color: var(--text-primary)">最近动态</span>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="live-dot"></span>
                <span class="text-[9px] font-bold text-emerald-400">LIVE</span>
              </div>
            </div>

            <div class="flex-1 min-h-0 overflow-y-auto scrollbar-hide divide-y">
              <div
                v-for="feed in unifiedFeed.slice(0, 5)"
                :key="feed.id"
                class="p-2.5 hover:bg-white/5 transition-colors flex gap-2 items-start"
              >
                <div class="relative shrink-0 mt-0.5">
                  <UserAvatar v-if="feed.user" :user="feed.user" size="xs" />
                  <div v-else class="w-6 h-6 rounded-lg flex items-center justify-center bg-white/5 border text-slate-400" style="border-color: var(--border-base)">
                    <component :is="feed.icon" class="w-3.5 h-3.5 text-slate-300" />
                  </div>
                </div>

                <div class="flex-1 min-w-0">
                  <div class="flex justify-between items-baseline gap-1">
                    <span class="text-[10px] font-bold truncate" style="color: var(--text-primary)">
                      {{ feed.user ? feed.user.name : feed.title }}
                    </span>
                    <span class="text-[8px] shrink-0 font-medium" style="color: var(--text-muted)">{{ feed.time }}</span>
                  </div>
                  <p class="text-[10px] leading-snug font-medium break-all mt-0.5" style="color: var(--text-secondary)">
                    {{ feed.user ? feed.description : feed.title }}
                  </p>
                  <div v-if="feed.statusText" class="mt-1">
                    <span class="text-[8px] font-bold px-1.5 py-0.5 rounded-full border border-white/5" :class="feed.statusClass">
                      {{ feed.statusText }}
                    </span>
                  </div>
                </div>
              </div>

              <div v-if="unifiedFeed.length === 0" class="flex flex-col items-center justify-center py-8">
                <Activity class="w-6 h-6 mb-1 opacity-20 text-slate-400" />
                <p class="text-[10px] font-bold" style="color: var(--text-muted)">暂无实时动态</p>
              </div>
            </div>

            <button
              type="button"
              class="flex items-center justify-center gap-1 py-2 text-[10px] font-bold border-t transition-colors cursor-pointer shrink-0 enter-community-btn"
              @click="router.push('/discussions')"
            >
              进入社区交流 <ChevronRight class="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      <!-- ── SECTION 4: Bottom Split Row (Tasks & Projects) ── -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 shrink-0">
        <!-- 待办任务 Card -->
        <div class="blender-card flex flex-col min-h-[250px]">
          <div class="flex items-center justify-between px-3.5 pt-3.5 pb-2.5 border-b shrink-0" style="border-color: var(--border-base)">
            <div class="flex items-center gap-1.5">
              <CheckSquare class="w-3.5 h-3.5 text-amber-500" />
              <span class="text-xs font-bold" style="color: var(--text-primary)">待办任务</span>
            </div>
            <button
              type="button"
              class="text-[10px] font-bold text-accent hover:underline cursor-pointer"
              @click="router.push('/work')"
            >
              查看全部
            </button>
          </div>
          
          <div class="flex-1 min-h-0 overflow-y-auto scrollbar-hide divide-y">
            <div
              v-for="task in recentTasks"
              :key="task.id"
              class="flex items-center gap-2.5 px-3.5 py-3 hover:bg-white/5 transition-colors"
            >
              <div
                class="w-1.5 h-1.5 rounded-full shrink-0"
                :class="task.status === 'DONE' ? 'bg-emerald-500' : task.status === 'IN_PROGRESS' ? 'bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,0.6)]' : 'bg-slate-500'"
              ></div>
              <div class="flex-1 min-w-0">
                <p class="text-xs font-semibold truncate" style="color: var(--text-primary)">{{ task.title }}</p>
                <div class="flex items-center gap-1 mt-0.5">
                  <Clock class="w-2.5 h-2.5 shrink-0 text-slate-500" />
                  <span class="text-[9px]" style="color: var(--text-muted)">
                    {{ task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '无截止' }}
                    <span v-if="isOverdue(task)" class="ml-1 font-bold text-rose-500">逾期</span>
                  </span>
                </div>
              </div>
              <span class="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 border border-white/5" :class="statusConfig[task.status]?.cls || 'status-todo'">
                {{ statusConfig[task.status]?.label || task.status }}
              </span>
            </div>
            <div v-if="recentTasks.length === 0" class="flex flex-col items-center justify-center py-8">
              <CheckSquare class="w-6 h-6 mb-1 opacity-20 text-slate-400" />
              <p class="text-[10px] font-bold" style="color: var(--text-muted)">暂无待办任务</p>
            </div>
          </div>
        </div>

        <!-- 最近项目 Card -->
        <div class="blender-card flex flex-col min-h-[250px]">
          <div class="flex items-center justify-between px-3.5 pt-3.5 pb-2.5 border-b shrink-0" style="border-color: var(--border-base)">
            <div class="flex items-center gap-1.5">
              <Layers class="w-3.5 h-3.5 text-blue-500" />
              <span class="text-xs font-bold" style="color: var(--text-primary)">最近项目</span>
            </div>
            <button
              type="button"
              class="text-[10px] font-bold text-accent hover:underline cursor-pointer"
              @click="router.push('/projects')"
            >
              查看全部
            </button>
          </div>

          <div class="flex-1 min-h-0 overflow-y-auto scrollbar-hide flex flex-col justify-between">
            <div v-if="recentProjects.length > 0" class="divide-y">
              <div
                v-for="project in recentProjects"
                :key="project.id"
                class="flex items-center gap-3 px-3.5 py-3 hover:bg-white/5 transition-colors cursor-pointer"
                @click="router.push(`/project/${project.id}`)"
              >
                <!-- Thumbnail -->
                <div class="w-9 h-9 rounded-lg overflow-hidden border flex items-center justify-center shrink-0" style="border-color: var(--border-base)" :class="project.color">
                  <span class="text-xs font-black text-white">{{ project.title.charAt(0) }}</span>
                </div>
                <!-- Title & Progress -->
                <div class="flex-1 min-w-0 space-y-1">
                  <p class="text-xs font-semibold truncate" style="color: var(--text-primary)">{{ project.title }}</p>
                  <div class="flex items-center gap-2">
                    <div class="progress-track h-1 rounded-full overflow-hidden flex-1">
                      <div class="h-full rounded-full progress-fill" :style="{ width: `${project.progress}%` }"></div>
                    </div>
                    <span class="text-[9px] font-black shrink-0" style="color: var(--text-muted)">进度 {{ project.progress }}%</span>
                  </div>
                </div>
              </div>
            </div>
            <div v-else class="flex flex-col items-center justify-center py-10 flex-1">
              <Layers class="w-8 h-8 mb-2 opacity-25" style="color: var(--text-muted)" />
              <p class="text-xs font-bold text-center" style="color: var(--text-secondary)">暂无最近项目</p>
            </div>

            <!-- Create Project Shortcut -->
            <div
              v-if="canCreateProject"
              class="p-2 border-t shrink-0"
              style="border-color: var(--border-base)"
            >
              <button
                type="button"
                class="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed text-xs font-bold transition-all cursor-pointer create-project-btn"
                @click="() => { importDialogMode = 'traditional'; isAddDialogOpen = true; }"
              >
                <span>新建项目 +</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- ── SECTION 5: Quote Footer ── -->
      <div class="pt-2 pb-1 shrink-0">
        <div class="blender-card p-3 flex flex-col items-center justify-center space-y-0.5 border" style="background-color: var(--bg-card); border-color: var(--border-base)">
          <p class="text-xs font-bold italic text-center" style="color: var(--text-primary)">
            “创意没有边界，热爱永不止步。”
          </p>
          <p class="text-[9px] font-bold uppercase tracking-widest text-center" style="color: var(--text-muted)">
            — Blender 社区
          </p>
        </div>
      </div>

    </div>

    <!-- Smart Import Dialog -->
    <ProjectImportDialog
      v-model:visible="isAddDialogOpen"
      :can-create-project="canCreateProject"
      :initial-mode="importDialogMode"
      @imported="fetchDashboardData"
    />
  </div>
</template>

<style scoped>
/* scrollbar helpers */
.scrollbar-hide::-webkit-scrollbar { display: none; }
.scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }

/* Toolbar */
.dashboard-toolbar { min-height: 52px; }

.greeting-badge {
  background: linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.08));
  border: 1px solid rgba(99,102,241,0.15);
}

.dashboard-secondary-action {
  background-color: var(--bg-card);
  border-color: var(--border-base);
  color: var(--text-secondary);
}
.dashboard-secondary-action:hover {
  background-color: var(--bg-subtle);
  color: var(--text-primary);
}

/* Quick actions */
.qa-btn { background: transparent; border: 1px solid transparent; }
.qa-btn:hover { background: var(--bg-subtle); border-color: var(--border-base); }
.qa-btn-label { color: var(--text-muted); }
.qa-btn:hover .qa-btn-label { color: var(--text-primary); }

.qa-icon { display: flex; align-items: center; justify-content: center; }
.qa-blue   { background: rgba(59,130,246,0.12); color: #3b82f6; }
.qa-purple { background: rgba(139,92,246,0.12);  color: #8b5cf6; }
.qa-green  { background: rgba(16,185,129,0.12);  color: #10b981; }
.qa-orange { background: rgba(249,115,22,0.12);  color: #f97316; }
.qa-pink   { background: rgba(236,72,153,0.12);  color: #ec4899; }
.qa-yellow { background: rgba(245,158,11,0.12);  color: #f59e0b; }

/* Learning card */
.progress-track { background: var(--bg-subtle); }
.progress-fill  { background: linear-gradient(90deg, #3b82f6, #8b5cf6); }

/* Live dot */
.live-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #10b981;
  animation: pulse-dot 2s infinite;
}
@keyframes pulse-dot {
  0%   { box-shadow: 0 0 0 0   rgba(16,185,129,0.4); }
  70%  { box-shadow: 0 0 0 6px rgba(16,185,129,0);   }
  100% { box-shadow: 0 0 0 0   rgba(16,185,129,0);   }
}

/* Custom zooms and details for new layout */
.duration-10000 {
  transition-duration: 10000ms;
}

/* Date picker */
.custom-date-picker :deep(.el-input__wrapper) {
  border-radius: var(--radius-md) !important;
  padding: 0.35rem 0.7rem !important;
  background-color: var(--bg-subtle) !important;
  box-shadow: none !important;
  border: 1px solid var(--border-base) !important;
}

/* Custom theme compatibility overrides */
.divide-y > * + * {
  border-color: var(--border-base) !important;
}

.enter-community-btn {
  border-color: var(--border-base) !important;
  color: var(--text-secondary);
}
.enter-community-btn:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.create-project-btn {
  border-color: var(--border-base) !important;
  color: var(--text-muted);
}
.create-project-btn:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--border-strong) !important;
}
</style>

<style>
.custom-date-popper {
  border-radius: 10px !important;
  overflow: hidden !important;
  box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1) !important;
  border: 1px solid var(--border-base) !important;
}
.custom-date-popper .el-picker-panel {
  border-radius: 10px !important;
  border: none !important;
}
</style>
