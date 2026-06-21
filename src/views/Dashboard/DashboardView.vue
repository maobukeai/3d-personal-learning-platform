<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import {
  Brain,
  FileText,
  Gauge,
  RefreshCw,
  BookOpen,
  Star,
  MessageSquare,
  Image as ImageIcon,
  CheckCircle2,
  Clock,
  Circle,
} from 'lucide-vue-next';
import ProjectImportDialog from './components/ProjectImportDialog.vue';
import DashboardWorkbench from './components/DashboardWorkbench.vue';
import Button from '@/components/ui/Button.vue';
import DashboardEnrollments from './components/DashboardEnrollments.vue';
import DashboardLeaderboard from './components/DashboardLeaderboard.vue';
import DashboardActivityStream from './components/DashboardActivityStream.vue';
import api from '@/utils/api';
import { formatRelativeTime as formatTime, formatDate } from '@/utils/format';
import { useAuthStore } from '@/stores/auth';
import { useWorkspaceStore } from '@/stores/workspace';
import { socketService } from '@/utils/socket';
import { TaskStatus } from '@/types';
import type {
  DashboardActivity,
  DashboardAsset,
  DashboardEnrollment,
  DashboardStatsResponse,
  DashboardTask,
  WorkbenchData,
  ActiveBanner,
  ProjectSummary,
  LeaderboardMember,
  FeedItem,
} from './types';

interface TeamMemberRecord {
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
}

interface ProjectRecord {
  id: string;
  title: string;
  progress?: number;
  color?: string | null;
  status?: string;
  dueDate?: string | null;
  updatedAt?: string;
  members?: unknown[];
}

const router = useRouter();
const authStore = useAuthStore();
const workspaceStore = useWorkspaceStore();

const selectedDate = ref(new Date());
const isLoading = ref(false);
const workbenchError = ref('');
const lastUpdatedAt = ref<Date | null>(null);
const stats = ref<DashboardStatsResponse | null>(null);
const workbench = ref<WorkbenchData | null>(null);
const activeEnrollment = ref<DashboardEnrollment | null>(null);
const activityLog = ref<DashboardActivity[]>([]);
const recentAssets = ref<DashboardAsset[]>([]);
const recentTasks = ref<DashboardTask[]>([]);
const recentProjects = ref<ProjectSummary[]>([]);
const leaderboard = ref<LeaderboardMember[]>([]);
const activeBanners = ref<ActiveBanner[]>([]);
const isAddDialogOpen = ref(false);
const importDialogMode = ref<'netdisk' | 'ai_assistant' | 'traditional'>('ai_assistant');
const userTeamRole = ref<'OWNER' | 'ADMIN' | 'MEMBER' | null>(null);
const completingTaskIds = ref<Set<string>>(new Set());

const greeting = computed(() => {
  const hour = new Date().getHours();
  if (hour < 6) return '深夜好';
  if (hour < 12) return '早上好';
  if (hour < 14) return '中午好';
  if (hour < 18) return '下午好';
  return '晚上好';
});

const canCreateProject = computed(() => {
  if (authStore.user?.role === 'ADMIN') return true;
  const workspace = workspaceStore.currentWorkspace;
  if (!workspace || workspace.type === 'personal') return true;
  if (workspace.type === 'team')
    return userTeamRole.value === 'OWNER' || userTeamRole.value === 'ADMIN';
  return false;
});

const currentDateLabel = computed(() =>
  selectedDate.value.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
  }),
);

const lastUpdatedText = computed(() => {
  if (!lastUpdatedAt.value) return '等待同步';
  return `更新于 ${lastUpdatedAt.value.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
});

function getTaskStatusLabel(status: string) {
  if (status === TaskStatus.DONE) return '已完成';
  if (status === TaskStatus.IN_PROGRESS) return '进行中';
  return '待办';
}

const unifiedFeed = computed<FeedItem[]>(() => {
  const activityItems = activityLog.value.map<FeedItem>((activity) => ({
    id: activity.id,
    icon: activity.action.includes('课程')
      ? BookOpen
      : activity.action.includes('作品')
        ? Star
        : MessageSquare,
    title: activity.user?.name || authStore.user?.name || '成员',
    description: `${activity.action}${activity.target ? `：${activity.target}` : ''}`,
    time: formatTime(activity.createdAt),
    rawTime: new Date(activity.createdAt),
    route: activity.action.includes('作品') ? '/showcase' : '/discussions',
    user: { name: activity.user?.name || '成员', avatarUrl: activity.user?.avatarUrl },
  }));

  const assetItems = recentAssets.value.map<FeedItem>((asset, index) => ({
    id: `asset-${asset.id}`,
    icon: ImageIcon,
    title: asset.title,
    description: asset.type ? `${asset.type} 作品已更新` : '作品已更新',
    time: asset.createdAt ? formatTime(asset.createdAt) : '最近上传',
    rawTime: asset.createdAt ? new Date(asset.createdAt) : new Date(Date.now() - index * 1000),
    route: `/assets/${asset.id}`,
    imageUrl: asset.thumbnail,
    badge: asset.type || '作品',
  }));

  const taskItems = recentTasks.value.map<FeedItem>((task) => ({
    id: `task-${task.id}`,
    icon: task.status === 'DONE' ? CheckCircle2 : task.status === 'IN_PROGRESS' ? Clock : Circle,
    title: task.title,
    description: task.project?.title
      ? `项目：${task.project.title}`
      : getTaskStatusLabel(task.status),
    time: task.dueDate ? `截止 ${formatDate(task.dueDate)}` : '无截止',
    rawTime: task.dueDate ? new Date(task.dueDate) : new Date(0),
    route: '/work',
    badge: getTaskStatusLabel(task.status),
  }));

  return [...activityItems, ...assetItems, ...taskItems]
    .sort((a, b) => b.rawTime.getTime() - a.rawTime.getTime())
    .slice(0, 8);
});

function navigateTo(route?: string) {
  if (!route) return;
  if (/^https?:\/\//i.test(route)) {
    window.open(route, '_blank', 'noopener,noreferrer');
    return;
  }
  router.push(route);
}

function openImportDialog(mode: 'ai_assistant' | 'traditional') {
  importDialogMode.value = mode;
  isAddDialogOpen.value = true;
}

function disabledDate(time: Date) {
  if (!authStore.user?.createdAt) return time.getTime() > Date.now();
  const registeredAt = new Date(authStore.user.createdAt);
  registeredAt.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return time.getTime() < registeredAt.getTime() || time.getTime() > today.getTime();
}

function getDateParam() {
  const year = selectedDate.value.getFullYear();
  const month = String(selectedDate.value.getMonth() + 1).padStart(2, '0');
  const day = String(selectedDate.value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function completeTask(task: DashboardTask) {
  if (task.status === TaskStatus.DONE || completingTaskIds.value.has(task.id)) return;
  const next = new Set(completingTaskIds.value);
  next.add(task.id);
  completingTaskIds.value = next;
  try {
    await api.put(`/api/tasks/${task.id}`, { status: TaskStatus.DONE });
    recentTasks.value = recentTasks.value.map((item) =>
      item.id === task.id ? { ...item, status: TaskStatus.DONE } : item,
    );
    await fetchDashboardData();
  } catch (error) {
    console.error('Complete task failed:', error);
  } finally {
    const finalNext = new Set(completingTaskIds.value);
    finalNext.delete(task.id);
    completingTaskIds.value = finalNext;
  }
}

async function fetchTeamMembers() {
  try {
    const teamId = workspaceStore.activeTeamId;
    if (!teamId) {
      userTeamRole.value = null;
      return;
    }
    const response = await api.get<TeamMemberRecord[]>(`/api/teams/${teamId}/members`);
    const record = response.data.find((member) => member.userId === authStore.user?.id);
    userTeamRole.value = record?.role ?? null;
  } catch {
    userTeamRole.value = null;
  }
}

async function fetchDashboardData() {
  isLoading.value = true;
  workbenchError.value = '';
  const date = getDateParam();
  try {
    const [
      statsRes,
      workbenchRes,
      enrollmentsRes,
      activityRes,
      assetsRes,
      tasksRes,
      allTasksRes,
      projectsRes,
    ] = await Promise.all([
      api.get<DashboardStatsResponse>('/api/auth/stats', { params: { date } }).catch(() => null),
      api.get<WorkbenchData>('/api/auth/workbench').catch((error) => {
        console.error('Fetch workbench data error:', error);
        workbenchError.value = '工作台数据暂时不可用';
        return null;
      }),
      api.get<DashboardEnrollment[]>('/api/courses/my-enrollments').catch(() => null),
      api.get<DashboardActivity[]>('/api/auth/activity', { params: { date } }).catch(() => null),
      api.get<DashboardAsset[]>('/api/assets/my').catch(() => null),
      api.get<DashboardTask[]>('/api/tasks', { params: { date } }).catch(() => null),
      api.get<DashboardTask[]>('/api/tasks').catch(() => null),
      api.get<ProjectRecord[]>('/api/projects').catch(() => null),
    ]);

    stats.value = statsRes?.data ?? null;
    workbench.value = workbenchRes?.data ?? null;
    activeEnrollment.value =
      enrollmentsRes?.data?.[0] ?? workbench.value?.learning.activeCourse ?? null;
    activityLog.value = activityRes?.data ?? [];
    recentAssets.value = (assetsRes?.data ?? []).slice(0, 6);

    const selectedTasks = tasksRes?.data ?? [];
    const allTasks = allTasksRes?.data ?? [];
    recentTasks.value = (selectedTasks.length > 0 ? selectedTasks : allTasks).slice(0, 6);

    recentProjects.value = (projectsRes?.data ?? []).slice(0, 6).map((project) => ({
      id: project.id,
      title: project.title,
      progress: project.progress ?? 0,
      color: project.color || 'bg-accent',
      status: project.status || 'IN_PROGRESS',
      dueDate: project.dueDate,
      updatedAt: project.updatedAt,
      memberCount: project.members?.length ?? 1,
    }));

    lastUpdatedAt.value = new Date();
  } catch (error) {
    console.error('Fetch dashboard data error:', error);
  } finally {
    isLoading.value = false;
  }
}

async function fetchLeaderboard() {
  const response = await api.get<LeaderboardMember[]>('/api/auth/leaderboard').catch(() => null);
  leaderboard.value = response?.data?.slice(0, 5) ?? [];
}

async function fetchActiveBanners() {
  try {
    const { data } = await api.get<ActiveBanner[]>('/api/banners');
    activeBanners.value = data;
  } catch (error) {
    console.error('Failed to fetch active banners:', error);
  }
}

async function refreshAll() {
  await Promise.all([
    fetchDashboardData(),
    fetchTeamMembers(),
    fetchLeaderboard(),
    fetchActiveBanners(),
  ]);
}

function handleNewActivity(activity: DashboardActivity) {
  const activityDate = new Date(activity.createdAt);
  const selected = selectedDate.value;
  if (
    activityDate.getFullYear() !== selected.getFullYear() ||
    activityDate.getMonth() !== selected.getMonth() ||
    activityDate.getDate() !== selected.getDate()
  ) {
    return;
  }
  activityLog.value = [activity, ...activityLog.value].slice(0, 10);
}

watch(selectedDate, fetchDashboardData);
watch(() => workspaceStore.activeWorkspaceId, refreshAll);

onMounted(() => {
  refreshAll();
  socketService.connect();
  socketService.on('new_activity', handleNewActivity);
});

onUnmounted(() => {
  socketService.off('new_activity', handleNewActivity);
});
</script>

<template>
  <div class="dashboard-page">
    <header class="dashboard-topbar">
      <div class="topbar-title">
        <span class="topbar-icon"><Gauge class="h-4 w-4" /></span>
        <div class="min-w-0">
          <p class="topbar-greeting">{{ greeting }}，{{ authStore.user?.name || '创作者' }}</p>
          <p class="topbar-subtitle">{{ currentDateLabel }} · {{ lastUpdatedText }}</p>
        </div>
      </div>

      <div class="topbar-actions">
        <el-date-picker
          v-model="selectedDate"
          type="date"
          class="dashboard-date-picker"
          placeholder="选择日期"
          :clearable="false"
          :disabled-date="disabledDate"
          popper-class="custom-date-popper"
        />
        <Button
          :loading="isLoading"
          aria-label="刷新"
          variant="secondary"
          size="md"
          class="w-9.5 p-0"
          :icon="RefreshCw"
          @click="refreshAll"
        />
        <Button
          v-if="canCreateProject"
          variant="primary"
          size="md"
          :icon="Brain"
          class="flex-1 min-w-[140px] md:flex-initial"
          @click="openImportDialog('ai_assistant')"
        >
          AI 规划
        </Button>
        <Button
          v-if="canCreateProject"
          variant="secondary"
          size="md"
          :icon="FileText"
          class="flex-1 min-w-[140px] md:flex-initial"
          @click="openImportDialog('traditional')"
        >
          文本导入
        </Button>
      </div>
    </header>

    <main class="dashboard-scroll">
      <DashboardWorkbench
        :workbench="workbench"
        :stats="stats"
        :active-enrollment="activeEnrollment"
        :recent-tasks="recentTasks"
        :recent-assets="recentAssets"
        :recent-projects="recentProjects"
        :is-loading="isLoading"
        :workbench-error="workbenchError"
        :completing-task-ids="completingTaskIds"
        @navigate="navigateTo"
        @complete-task="completeTask"
        @open-import-dialog="openImportDialog"
      >
        <template #main-top>
          <DashboardEnrollments
            :active-banners="activeBanners"
            :active-enrollment="activeEnrollment"
            @navigate="navigateTo"
          />
        </template>

        <template #sidebar-middle>
          <DashboardLeaderboard :leaderboard-top="leaderboard" />
          <DashboardActivityStream :unified-feed="unifiedFeed" @navigate="navigateTo" />
        </template>
      </DashboardWorkbench>
    </main>

    <ProjectImportDialog
      v-model:visible="isAddDialogOpen"
      :can-create-project="canCreateProject"
      :initial-mode="importDialogMode"
      @imported="fetchDashboardData"
    />
  </div>
</template>

<style scoped>
.dashboard-page {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--bg-app) 75%, white) 0, var(--bg-app) 180px),
    var(--bg-app);
  color: var(--text-primary);
  position: relative;
}

.dark .dashboard-page {
  background: var(--bg-app);
}

.dashboard-topbar {
  display: flex;
  min-height: 56px;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-bottom: 1px solid var(--border-base);
  background: color-mix(in srgb, var(--bg-card) 95%, transparent);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  padding: 10px 20px;
  z-index: 20;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
}

.topbar-title,
.topbar-actions {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 12px;
}

.topbar-icon {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  width: 36px;
  height: 36px;
  background: var(--accent-subtle);
  color: var(--accent);
  border: 1px solid rgba(var(--accent-rgb), 0.1);
}

.topbar-greeting {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  font-weight: 800;
  margin: 0;
  color: var(--text-primary);
}

.topbar-subtitle {
  overflow: hidden;
  color: var(--text-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  font-weight: 500;
  margin: 2px 0 0;
}

.dashboard-date-picker {
  width: 142px;
}

.dashboard-scroll {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 16px;
  min-height: 0;
  overflow-y: auto;
  padding: 16px 20px 24px;
  position: relative;
  z-index: 10;
}

.dashboard-date-picker :deep(.el-input__wrapper) {
  border: 1px solid var(--border-base) !important;
  border-radius: 8px !important;
  background: var(--bg-subtle) !important;
  box-shadow: none !important;
  transition: border-color 0.2s ease;
}

.dashboard-date-picker :deep(.el-input__wrapper):hover {
  border-color: var(--border-strong) !important;
}

@media (max-width: 720px) {
  .dashboard-topbar {
    align-items: stretch;
    flex-direction: column;
    padding: 12px 14px;
    gap: 12px;
  }

  .topbar-actions {
    width: 100%;
    flex-wrap: wrap;
    gap: 8px;
  }

  .dashboard-date-picker {
    flex: 1;
    min-width: 130px;
  }

  .dashboard-scroll {
    padding: 12px 12px 20px;
  }
}
</style>

<style>
.custom-date-popper {
  overflow: hidden !important;
  border: 1px solid var(--border-base) !important;
  border-radius: 8px !important;
  box-shadow: var(--card-shadow-hover) !important;
}

.custom-date-popper .el-picker-panel {
  border: none !important;
}
</style>
