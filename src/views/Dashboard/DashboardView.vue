<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import {
  BookOpen,
  Users,
  Box,
  MessageSquare,
  TrendingUp,
  Calendar,
  Layout,
  Plus,
  X,
} from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import api from '@/utils/api';
import { useAuthStore } from '@/stores/auth';
import { socketService } from '@/utils/socket';
import UserAvatar from '@/components/UserAvatar.vue';

const { t } = useI18n();
const router = useRouter();
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

const formatTime = (date: string) => {
  const now = new Date();
  const then = new Date(date);
  const diff = now.getTime() - then.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return t('dashboard.time.minutesAgo', { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('dashboard.time.hoursAgo', { n: hours });
  return then.toLocaleDateString();
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

const handleActivityClick = (log: any) => {
  const [prefix] = log.id.split('-');
  if (prefix === 'a') router.push('/assets');
  else if (prefix === 'd') router.push('/discussions');
  else if (prefix === 'e') router.push('/academy');
};
</script>

<template>
  <div
    class="flex-1 flex flex-col h-full overflow-hidden transition-colors duration-300"
    style="background-color: var(--bg-app)"
  >
    <!-- Dashboard Header -->
    <div
      class="flex flex-col sm:flex-row gap-3 py-4 sm:py-0 sm:h-20 border-b px-4 sm:px-6 md:px-8 sm:items-center justify-between shrink-0 transition-colors duration-300"
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
          class="p-2.5 bg-accent text-white rounded-xl shadow-lg shadow-accent/20 hover:scale-105 transition-all"
          @click="isAddDialogOpen = true"
        >
          <Plus class="w-5 h-5" />
        </button>
      </div>
    </div>

    <!-- Main Content Scroll Area -->
    <div class="flex-1 overflow-y-auto p-4 md:p-8 scrollbar-hide">
      <div class="max-w-7xl mx-auto space-y-6 md:space-y-8">
        <!-- Stats Grid -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          <div
            v-for="stat in stats"
            :key="stat.label"
            class="p-4 sm:p-6 rounded-2xl sm:rounded-3xl border shadow-sm transition-all hover:shadow-md"
            style="background-color: var(--bg-card); border-color: var(--border-base)"
          >
            <div class="flex items-start justify-between mb-2 sm:mb-4">
              <div
                v-if="stat.trend && stat.trend !== '0' && stat.trend !== '0%'"
                class="p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-slate-50 dark:bg-white/5"
                :class="stat.color"
              >
                <component :is="stat.icon" class="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div v-else class="p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-slate-50 dark:bg-white/5" :class="stat.color">
                <component :is="stat.icon" class="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <span
                v-if="stat.trend && stat.trend !== '0' && stat.trend !== '0%'"
                class="text-[9px] sm:text-[10px] font-black px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full"
                :class="
                  stat.trend.startsWith('-')
                    ? 'bg-rose-50 text-rose-600'
                    : 'bg-emerald-50 text-emerald-600'
                "
                >{{ stat.trend }}</span
              >
            </div>
            <p
              class="text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-0.5 sm:mb-1 truncate"
              style="color: var(--text-muted)"
            >
              {{ stat.label }}
            </p>
            <h2 class="text-xl sm:text-3xl font-black" style="color: var(--text-primary)">{{ stat.value }}</h2>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          <!-- Left Column: Tasks & Assets -->
          <div class="lg:col-span-2 space-y-6 md:space-y-8">
            <!-- Active Learning Card -->
            <div
              v-if="activeEnrollment"
              class="relative overflow-hidden rounded-2xl sm:rounded-3xl p-6 sm:p-8 text-white shadow-2xl group cursor-pointer"
              style="background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%)"
            >
              <div class="relative z-10">
                <div class="flex items-center gap-2 mb-3 sm:mb-4">
                  <div
                    class="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/20 backdrop-blur flex items-center justify-center"
                  >
                    <BookOpen class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </div>
                  <span class="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest opacity-80"
                    >继续学习</span
                  >
                </div>
                <h2 class="text-xl sm:text-2xl font-black mb-1 sm:mb-2">{{ activeEnrollment.course.title }}</h2>
                <p class="text-xs sm:text-sm opacity-80 mb-6 sm:mb-8 max-w-md">
                  进度: {{ activeEnrollment.progress }}% | 还剩下
                  {{ activeEnrollment.course._count.lessons }} 个章节
                </p>
                <button
                  class="px-5 py-2 sm:px-6 sm:py-2.5 bg-white text-indigo-600 rounded-xl font-bold text-[10px] sm:text-xs shadow-xl hover:scale-105 transition-all"
                  @click="router.push(`/academy/player/${activeEnrollment.courseId}`)"
                >
                  开始学习
                </button>
              </div>
              <div
                class="absolute right-0 bottom-0 opacity-10 group-hover:scale-110 transition-transform duration-700"
              >
                <Layout class="w-48 h-48 sm:w-64 sm:h-64 -mb-8 -mr-8 sm:-mb-10 sm:-mr-10" />
              </div>
            </div>

            <!-- Empty Enrollment State -->
            <div
              v-else
              class="relative overflow-hidden rounded-2xl sm:rounded-3xl p-6 sm:p-8 border-2 border-dashed border-slate-200 dark:border-white/10 flex flex-col items-center justify-center text-center group cursor-pointer hover:border-accent/50 transition-all"
              @click="router.push('/academy')"
            >
              <div
                class="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl sm:rounded-3xl bg-slate-50 dark:bg-white/5 flex items-center justify-center mb-3 sm:mb-4 group-hover:scale-110 transition-transform"
              >
                <BookOpen class="w-6 h-6 sm:w-8 sm:h-8 text-slate-300 group-hover:text-accent" />
              </div>
              <h2 class="text-base sm:text-lg font-bold mb-1" style="color: var(--text-primary)">
                开启你的学习之旅
              </h2>
              <p class="text-[10px] sm:text-xs text-slate-400 mb-5 sm:mb-6 max-w-[240px]">
                您还没有加入任何课程。前往学院探索海量 3D 创作课程，提升您的技能。
              </p>
              <button
                class="px-5 py-1.5 sm:px-6 sm:py-2 border-2 border-accent text-accent rounded-xl font-bold text-[10px] sm:text-xs hover:bg-accent hover:text-white transition-all"
              >
                浏览课程
              </button>
            </div>

            <!-- Recent Tasks -->
            <div
              class="p-6 sm:p-8 rounded-2xl sm:rounded-3xl border transition-colors duration-300"
              style="background-color: var(--bg-card); border-color: var(--border-base)"
            >
              <div class="flex items-center justify-between mb-6 sm:mb-8">
                <h3 class="font-bold text-base sm:text-lg" style="color: var(--text-primary)">待办学习任务</h3>
                <button
                  class="text-[10px] sm:text-xs font-bold text-accent hover:underline"
                  @click="router.push('/work')"
                >
                  查看全部任务
                </button>
              </div>
              <div class="space-y-3 sm:space-y-4">
                <div
                  v-for="task in recentTasks"
                  :key="task.id"
                  class="flex items-center justify-between p-3 sm:p-4 rounded-xl sm:rounded-2xl border transition-all hover:bg-slate-50 dark:hover:bg-white/5"
                  style="border-color: var(--border-base)"
                >
                  <div class="flex items-center gap-3 sm:gap-4">
                    <div
                      class="w-2 h-2 rounded-full shrink-0"
                      :class="
                        task.status === 'IN_PROGRESS'
                          ? 'bg-accent'
                          : task.status === 'DONE'
                            ? 'bg-emerald-500'
                            : 'bg-slate-300'
                      "
                    ></div>
                    <div class="min-w-0">
                      <p class="text-xs sm:text-sm font-bold truncate" style="color: var(--text-primary)">
                        {{ task.title }}
                      </p>
                      <p class="text-[9px] sm:text-[10px] mt-0.5" style="color: var(--text-muted)">
                        截止于:
                        {{ task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '无' }}
                      </p>
                    </div>
                  </div>
                  <span
                    class="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-lg shrink-0 ml-2"
                    style="background-color: var(--bg-app); color: var(--text-secondary)"
                    >{{ task.status }}</span
                  >
                </div>
                <div v-if="recentTasks.length === 0" class="py-8 sm:py-12 text-center text-slate-400">
                  <p class="text-xs sm:text-sm font-bold">暂无近期任务</p>
                </div>
              </div>
            </div>

            <!-- Recent Assets -->
            <div class="space-y-3 sm:space-y-4">
              <div class="flex items-center justify-between px-1">
                <h3 class="font-bold text-base sm:text-lg" style="color: var(--text-primary)">最新创作资产</h3>
                <button
                  class="text-[10px] sm:text-xs font-bold text-accent hover:underline"
                  @click="router.push('/my-works')"
                >
                  管理作品集
                </button>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div
                  v-for="asset in recentAssets"
                  :key="asset.id"
                  class="group p-3 sm:p-4 rounded-2xl sm:rounded-3xl border shadow-sm hover:shadow-md transition-all flex items-center gap-3 sm:gap-4 cursor-pointer"
                  style="background-color: var(--bg-card); border-color: var(--border-base)"
                  @click="router.push('/assets')"
                >
                  <div
                    class="w-16 h-16 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl overflow-hidden flex items-center justify-center p-0.5 shrink-0 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10"
                  >
                    <img
                      v-if="asset.thumbnail"
                      :src="asset.thumbnail"
                      class="w-full h-full object-cover rounded-lg sm:rounded-xl group-hover:scale-110 transition-transform"
                    />
                    <div
                      v-else
                      class="w-full h-full flex flex-col items-center justify-center text-slate-300 dark:text-slate-600 bg-slate-50 dark:bg-white/5 rounded-lg sm:rounded-xl"
                    >
                      <Box class="w-5 h-5 sm:w-6 sm:h-6 mb-0.5 sm:mb-1" />
                      <span class="text-[7px] sm:text-[8px] font-bold uppercase">NO THUMB</span>
                    </div>
                  </div>
                  <div class="min-w-0">
                    <p class="text-xs sm:text-sm font-bold truncate" style="color: var(--text-primary)">
                      {{ asset.title }}
                    </p>
                    <span
                      class="text-[9px] sm:text-[10px] font-bold text-accent bg-accent/10 px-1.5 py-0.5 rounded mt-1 inline-block"
                      >{{ asset.type }}</span
                    >
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Right Column: Community & Feed -->
          <div class="space-y-6 md:space-y-8">
            <!-- Activity Feed -->
            <div
              class="rounded-2xl sm:rounded-3xl border shadow-sm overflow-hidden"
              style="background-color: var(--bg-card); border-color: var(--border-base)"
            >
              <div
                class="p-4 sm:p-6 border-b flex items-center justify-between"
                style="border-color: var(--border-base)"
              >
                <h3 class="font-bold text-sm sm:text-base" style="color: var(--text-primary)">团队动态</h3>
                <span class="text-[8px] sm:text-[9px] font-black uppercase text-emerald-500 animate-pulse"
                  >实时</span
                >
              </div>
              <div class="p-4 sm:p-6 space-y-5 sm:space-y-6">
                <div
                  v-for="log in activityLog"
                  :key="log.id"
                  class="flex gap-3 sm:gap-4 group cursor-pointer"
                  @click="handleActivityClick(log)"
                >
                  <UserAvatar :user="log.user" size="sm" class="shrink-0" />
                  <div class="flex-1 min-w-0">
                    <p class="text-[11px] sm:text-xs leading-relaxed" style="color: var(--text-secondary)">
                      <span
                        class="font-bold group-hover:text-accent transition-colors"
                        style="color: var(--text-primary)"
                        >{{ log.user.name }}</span
                      >
                      {{ log.action }}
                      <span class="text-accent font-bold">#{{ log.target }}</span>
                    </p>
                    <p class="text-[9px] sm:text-[10px] mt-1" style="color: var(--text-muted)">
                      {{ formatTime(log.createdAt) }}
                    </p>
                  </div>
                </div>
                <div v-if="activityLog.length === 0" class="py-10 sm:py-12 text-center text-slate-400">
                  <p class="text-xs sm:text-sm font-bold">暂无动态</p>
                </div>
              </div>
              <button
                class="w-full py-3 sm:py-4 text-[11px] sm:text-xs font-bold border-t transition-colors hover:bg-slate-50 dark:hover:bg-white/5"
                style="color: var(--text-secondary); border-color: var(--border-base)"
                @click="router.push('/discussions')"
              >
                进入社区交流
              </button>
            </div>

            <!-- Collaboration Invite -->
            <div
              class="p-6 sm:p-8 rounded-2xl sm:rounded-3xl border shadow-sm bg-gradient-to-br from-indigo-500/5 to-purple-500/5"
              style="background-color: var(--bg-card); border-color: var(--border-base)"
            >
              <div class="flex items-center gap-3 mb-4">
                <div class="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                  <Users class="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600" />
                </div>
                <h3 class="font-bold text-sm sm:text-base" style="color: var(--text-primary)">团队协作</h3>
              </div>
              <p class="text-[11px] sm:text-xs leading-relaxed mb-5 sm:mb-6" style="color: var(--text-secondary)">
                加入一个兴趣小组，与志同道合的伙伴一起完成大型渲染项目。
              </p>
              <div class="flex -space-x-2 mb-6 sm:mb-8">
                <div
                  v-for="(letter, idx) in ['K', 'J', 'Y', 'H']"
                  :key="idx"
                  class="w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center text-[9px] sm:text-[10px] font-black text-white shadow-md select-none"
                  style="border-color: var(--bg-card)"
                  :class="[
                    idx === 0 ? 'bg-gradient-to-tr from-pink-500 to-rose-400' : '',
                    idx === 1 ? 'bg-gradient-to-tr from-amber-500 to-orange-400' : '',
                    idx === 2 ? 'bg-gradient-to-tr from-emerald-500 to-teal-400' : '',
                    idx === 3 ? 'bg-gradient-to-tr from-blue-500 to-indigo-400' : '',
                  ]"
                >
                  {{ letter }}
                </div>
                <div
                  class="w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center text-[9px] sm:text-[10px] font-bold"
                  style="
                    background-color: var(--bg-app);
                    border-color: var(--border-base);
                    color: var(--text-secondary);
                  "
                >
                  +5
                </div>
              </div>
              <button
                class="w-full py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-[11px] sm:text-xs font-bold transition-transform hover:scale-[1.02]"
                @click="router.push('/explore-teams')"
              >
                寻找团队伙伴
              </button>
            </div>
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
          class="relative w-full max-w-md p-8 rounded-3xl shadow-2xl space-y-6"
          style="background-color: var(--bg-card)"
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
