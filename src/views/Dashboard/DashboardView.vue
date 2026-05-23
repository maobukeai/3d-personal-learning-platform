<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Box,
  MessageSquare,
  TrendingUp,
  Calendar,
  Plus,
  X,
} from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import api from '@/utils/api';
import { useAuthStore } from '@/stores/auth';
import { socketService } from '@/utils/socket';
import StatCard from '@/components/StatCard.vue';
import ActiveLearningCard from './components/ActiveLearningCard.vue';
import RecentTasksCard from './components/RecentTasksCard.vue';
import RecentAssetsCard from './components/RecentAssetsCard.vue';
import TeamActivityCard from './components/TeamActivityCard.vue';
import CollaborationInviteCard from './components/CollaborationInviteCard.vue';

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

const activeEnrollment = ref<any>(null);
const activityLog = ref<any[]>([]);
const recentAssets = ref<any[]>([]);
const recentTasks = ref<any[]>([]);
const selectedDate = ref(new Date());
const isAddDialogOpen = ref(false);
const newTask = ref({
  title: '',
  description: '',
  status: 'TODO',
  dueDate: '',
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

const handleAddTask = async () => {
  if (!newTask.value.title) return;
  try {
    await api.post('/api/tasks', newTask.value);
    ElMessage.success(t('dashboard.addTaskSuccess'));
    isAddDialogOpen.value = false;
    newTask.value = { title: '', description: '', status: 'TODO', dueDate: '' };
    fetchDashboardData();
  } catch (error) {
    ElMessage.error(t('dashboard.addTaskFailed'));
  }
};

onMounted(() => {
  fetchDashboardData();

  // Listen for real-time activity updates
  socketService.on('new_activity', (activity: any) => {
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
    class="flex-1 flex flex-col h-full overflow-hidden transition-colors duration-300"
    style="background-color: var(--bg-app)"
  >
    <!-- Dashboard Header -->
    <div
      class="flex flex-col sm:flex-row gap-3 py-4 sm:py-0 sm:h-16 border-b px-4 sm:px-6 md:px-8 sm:items-center justify-between shrink-0 transition-colors duration-300"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <div>
        <h1 class="text-2xl font-black tracking-tight" style="color: var(--text-primary)">
          {{ t('dashboard.title') }}
        </h1>
        <p class="text-xs font-medium mt-1" style="color: var(--text-muted)">
          {{ t('dashboard.welcome') }}
        </p>
      </div>
      <div class="flex items-center gap-3">
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
        <button
          class="p-2.5 bg-accent text-white rounded-xl shadow-lg shadow-accent/20 hover:scale-105 transition-all cursor-pointer"
          @click="isAddDialogOpen = true"
        >
          <Plus class="w-5 h-5" />
        </button>
      </div>
    </div>

    <!-- Main Content Scroll Area -->
    <div class="flex-1 overflow-y-auto p-2.5 sm:p-4 lg:p-4 scrollbar-hide">
      <div class="max-w-7xl mx-auto space-y-4 md:space-y-5 min-w-0">
        <!-- Stats Grid -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
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

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5">
          <!-- Left Column: Tasks & Assets -->
          <div class="lg:col-span-2 space-y-4 md:space-y-5">
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

    <!-- Add Task Dialog -->
    <Transition name="fade">
      <div
        v-if="isAddDialogOpen"
        class="fixed inset-0 z-[100] flex items-center justify-center p-4"
      >
        <div
          class="absolute inset-0 bg-black/40 backdrop-blur-sm"
          @click="isAddDialogOpen = false"
        ></div>
        <div
          class="relative w-full max-w-md p-8 glass-card border border-white/20 dark:border-white/5 space-y-6"
        >
          <div class="flex items-center justify-between">
            <h3 class="text-xl font-bold" style="color: var(--text-primary)">新建学习任务</h3>
            <button style="color: var(--text-secondary)" @click="isAddDialogOpen = false">
              <X class="w-5 h-5" />
            </button>
          </div>

          <div class="space-y-4">
            <div>
              <label class="block text-xs font-bold uppercase mb-2 ml-1 text-slate-400"
                >任务标题</label
              >
              <input
                v-model="newTask.title"
                type="text"
                class="w-full px-4 py-3 bg-slate-100 dark:bg-white/5 border-none rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all"
                style="color: var(--text-primary)"
                placeholder="例如：学习 Blender 几何节点"
              />
            </div>

            <div>
              <label class="block text-xs font-bold uppercase mb-2 ml-1 text-slate-400"
                >详细描述 (可选)</label
              >
              <textarea
                v-model="newTask.description"
                rows="3"
                class="w-full px-4 py-3 bg-slate-100 dark:bg-white/5 border-none rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 transition-all resize-none"
                style="color: var(--text-primary)"
                placeholder="这次任务的目标是什么？"
              ></textarea>
            </div>

            <div>
              <label class="block text-xs font-bold uppercase mb-2 ml-1 text-slate-400"
                >截止日期</label
              >
              <el-date-picker
                v-model="newTask.dueDate"
                type="date"
                placeholder="选择截止日期"
                class="!w-full !rounded-2xl custom-date-picker"
                popper-class="custom-date-popper"
              />
            </div>
          </div>

          <button
            class="w-full py-4 bg-accent text-white rounded-2xl font-bold shadow-lg shadow-accent/20 hover:shadow-accent/40 transition-all"
            @click="handleAddTask"
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
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.custom-date-picker :deep(.el-input__wrapper) {
  border-radius: 0.75rem !important;
  padding: 0.5rem 1rem !important;
  background-color: var(--bg-app) !important;
  box-shadow: none !important;
  border: 1px solid var(--border-base) !important;
}
</style>

<style>
/* Global styles for the date picker popper */
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
</style>
