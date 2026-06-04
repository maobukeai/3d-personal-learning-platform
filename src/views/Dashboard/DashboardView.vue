<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Box,
  MessageSquare,
  TrendingUp,
  Calendar,
  LayoutDashboard,
  Brain,
  FileText,
} from 'lucide-vue-next';
import ProjectImportDialog from './components/ProjectImportDialog.vue';
import api from '@/utils/api';
import { useAuthStore } from '@/stores/auth';
import { useWorkspaceStore } from '@/stores/workspace';
import { socketService } from '@/utils/socket';
import StatCard from '@/components/StatCard.vue';
import ActiveLearningCard from './components/ActiveLearningCard.vue';
import RecentTasksCard from './components/RecentTasksCard.vue';
import RecentAssetsCard from './components/RecentAssetsCard.vue';
import TeamActivityCard from './components/TeamActivityCard.vue';
import CollaborationInviteCard from './components/CollaborationInviteCard.vue';
import type {
  DashboardActivity,
  DashboardAsset,
  DashboardEnrollment,
  DashboardTask,
} from './types';

const { t } = useI18n();
const authStore = useAuthStore();

const stats = ref([
  {
    label: t('dashboard.stats.learningProgress'),
    value: '0%',
    trend: '0%',
    color: 'text-accent',
    icon: TrendingUp,
  },
  {
    label: t('dashboard.stats.pendingTasks'),
    value: '0',
    trend: '0',
    color: 'text-amber-600',
    icon: Calendar,
  },
  {
    label: t('dashboard.stats.assets'),
    value: '0',
    trend: '0',
    color: 'text-emerald-600',
    icon: Box,
  },
  {
    label: t('dashboard.stats.feedback'),
    value: '0',
    trend: '0',
    color: 'text-purple-600',
    icon: MessageSquare,
  },
]);

// Re-initialize labels when language changes
watch(
  () => t('dashboard.stats.learningProgress'),
  () => {
    stats.value[0].label = t('dashboard.stats.learningProgress');
    stats.value[1].label = t('dashboard.stats.pendingTasks');
    stats.value[2].label = t('dashboard.stats.assets');
    stats.value[3].label = t('dashboard.stats.feedback');
  },
);

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
    if (!tid) {
      userTeamRole.value = null;
      return;
    }
    const response = await api.get(`/api/teams/${tid}/members`);
    const records = (response.data || []) as TeamMemberRecord[];
    
    // Find active user's role
    const activeUserId = authStore.user?.id;
    const myRecord = records.find(m => m.userId === activeUserId);
    userTeamRole.value = myRecord ? myRecord.role : null;
  } catch (_error) {
    userTeamRole.value = null;
  }
};

const canCreateProject = computed(() => {
  if (authStore.user?.role === 'ADMIN') return true;
  
  const currentWs = workspaceStore.currentWorkspace;
  if (!currentWs) return true;
  
  if (currentWs.type === 'personal') return true;
  
  if (currentWs.type === 'team') {
    return userTeamRole.value === 'OWNER' || userTeamRole.value === 'ADMIN';
  }
  
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

    const [statsRes, enrollmentsRes, activityRes, assetsRes, tasksRes] = await Promise.all([
      api.get('/api/auth/stats', { params: { date: dateParam } }),
      api.get('/api/courses/my-enrollments'),
      api.get('/api/auth/activity', { params: { date: dateParam } }),
      api.get('/api/assets/my'),
      api.get('/api/tasks', { params: { date: dateParam } }),
    ]);

    // Also fetch overall pending tasks if specifically needed for "Recent Tasks"
    const overallTasksRes = await api.get('/api/tasks');

    const data = statsRes.data;
    stats.value[0].value = data.learningProgress;
    stats.value[0].trend = data.trends?.learning || '0%';
    stats.value[1].value = data.taskCount.toString();
    stats.value[1].trend = data.trends?.tasks || '0';
    stats.value[2].value = data.assetCount.toString();
    stats.value[2].trend = data.trends?.assets || '0';
    stats.value[3].value = data.feedbackCount.toString();
    stats.value[3].trend = data.trends?.feedbacks || '0';

    if (enrollmentsRes.data.length > 0) {
      activeEnrollment.value = enrollmentsRes.data[0];
    } else {
      activeEnrollment.value = null;
    }

    activityLog.value = activityRes.data;
    recentAssets.value = (assetsRes.data || []).slice(0, 2);
    recentTasks.value = (tasksRes.data.length > 0 ? tasksRes.data : overallTasksRes.data).slice(
      0,
      3,
    );
  } catch (error) {
    console.error('Fetch dashboard data error:', error);
  }
};

watch(selectedDate, () => {
  fetchDashboardData();
});

watch(() => workspaceStore.activeWorkspaceId, () => {
  fetchDashboardData();
  fetchTeamMembers();
});



onMounted(() => {
  fetchDashboardData();
  fetchTeamMembers();

  // Listen for real-time activity updates
  socketService.on('new_activity', (activity: DashboardActivity) => {
    // Check if activity matches current date filter
    const year = selectedDate.value.getFullYear();
    const month = String(selectedDate.value.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.value.getDate()).padStart(2, '0');
    const currentFilterStr = `${year}-${month}-${day}`;

    const activityDate = new Date(activity.createdAt);
    const actYear = activityDate.getFullYear();
    const actMonth = String(activityDate.getMonth() + 1).padStart(2, '0');
    const actDay = String(activityDate.getDate()).padStart(2, '0');
    const activityDateStr = `${actYear}-${actMonth}-${actDay}`;

    if (activityDateStr === currentFilterStr) {
      activityLog.value.unshift(activity);
      if (activityLog.value.length > 10) activityLog.value.pop();
    }
  });
});

</script>

<template>
  <div
    class="enterprise-page flex-1 flex flex-col h-full overflow-hidden transition-colors duration-300"
    style="background-color: var(--bg-app)"
  >
    <!-- Dashboard Header -->
    <div
      class="dashboard-header enterprise-toolbar flex flex-col sm:flex-row gap-3 px-4 py-3 md:px-6 sm:items-center justify-between shrink-0 transition-colors duration-300"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <div class="flex items-center gap-3">
        <div
          class="w-9 h-9 rounded-lg bg-accent-subtle flex items-center justify-center border border-accent/10"
        >
          <LayoutDashboard class="w-4.5 h-4.5 text-accent" />
        </div>
        <div>
          <h1
            class="text-base sm:text-xl font-bold tracking-tight"
            style="color: var(--text-primary)"
          >
            {{ t('dashboard.title') }}
          </h1>
          <p
            class="hidden sm:block text-xs font-medium text-slate-500"
          >
            {{ t('dashboard.welcome') }}
          </p>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-2 sm:gap-3">
        <el-date-picker
          v-model="selectedDate"
          type="date"
          class="!w-40 custom-date-picker"
          :placeholder="t('dashboard.selectDate')"
          :clearable="false"
          :disabled-date="disabledDate"
          popper-class="custom-date-popper"
        >
          <template #prefix>
            <Calendar class="w-4 h-4 text-slate-400" />
          </template>
        </el-date-picker>
        <!-- 智能规划助手 -->
        <button
          v-if="canCreateProject"
          type="button"
          class="dashboard-primary-action flex items-center gap-1.5 px-3.5 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg shadow-sm transition-colors cursor-pointer font-bold text-xs"
          @click="() => { importDialogMode = 'ai_assistant'; isAddDialogOpen = true; }"
        >
          <Brain class="w-4 h-4" />
          <span>{{ t('dashboard.aiPlanner') }}</span>
        </button>
        <!-- 文本导入 -->
        <button
          v-if="canCreateProject"
          type="button"
          class="dashboard-secondary-action flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-colors cursor-pointer font-bold text-xs border shadow-sm"
          @click="() => { importDialogMode = 'traditional'; isAddDialogOpen = true; }"
        >
          <FileText class="w-4 h-4 text-slate-500 dark:text-slate-400" />
          <span>{{ t('dashboard.textImport') }}</span>
        </button>
      </div>
    </div>

    <!-- Main Content Scroll Area -->
    <div class="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6 scrollbar-hide">
      <div class="mx-auto w-full max-w-[1480px] space-y-4 md:space-y-5 min-w-0">
        <!-- Stats Grid -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          <StatCard
            v-for="stat in stats"
            :key="stat.label"
            :label="stat.label"
            :value="stat.value"
            :trend="stat.trend"
            :color="stat.color"
            :icon="stat.icon"
          />
        </div>

        <div class="grid grid-cols-1 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.85fr)] gap-4 md:gap-5">
          <!-- Left Column: Tasks & Assets -->
          <div class="space-y-4 md:space-y-5">
            <!-- Active Learning Card -->
            <ActiveLearningCard :active-enrollment="activeEnrollment" />

            <!-- Recent Tasks -->
            <RecentTasksCard :recent-tasks="recentTasks" />

            <!-- Recent Assets -->
            <RecentAssetsCard :recent-assets="recentAssets" />
          </div>

          <!-- Right Column: Community & Feed -->
          <div class="space-y-4 md:space-y-5">
            <!-- Activity Feed -->
            <TeamActivityCard :activity-log="activityLog" />

            <!-- Collaboration Invite -->
            <CollaborationInviteCard />
          </div>
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

.dashboard-header {
  min-height: 64px;
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

.custom-date-picker :deep(.el-input__wrapper) {
  border-radius: var(--radius-md) !important;
  padding: 0.45rem 0.8rem !important;
  background-color: var(--bg-subtle) !important;
  box-shadow: none !important;
  border: 1px solid var(--border-base) !important;
}

/* Slide fade transition for the help panel */
.slide-fade-enter-active {
  transition: all 0.4s ease-out;
}
.slide-fade-leave-active {
  transition: all 0.3s cubic-bezier(1, 0.5, 0.8, 1);
}
.slide-fade-enter-from,
.slide-fade-leave-to {
  transform: translateX(20px);
  opacity: 0;
}

/* Slim scrollbar for helper panel */
.scrollbar-thin::-webkit-scrollbar {
  width: 4px;
}
.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
}
.scrollbar-thin::-webkit-scrollbar-thumb {
  background: var(--border-base);
  border-radius: 10px;
}
.scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background: var(--text-secondary);
}
.scrollbar-thin {
  scrollbar-width: thin;
  scrollbar-color: var(--border-base) transparent;
}
</style>

<style>
/* Global styles for the date picker popper */
.custom-date-popper {
  border-radius: 10px !important;
  overflow: hidden !important;
  box-shadow:
    0 20px 25px -5px rgb(0 0 0 / 0.1),
    0 8px 10px -6px rgb(0 0 0 / 0.1) !important;
  border: 1px solid var(--border-base) !important;
}
.custom-date-popper .el-picker-panel {
  border-radius: 10px !important;
  border: none !important;
}
</style>
