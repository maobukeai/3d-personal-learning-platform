<script setup lang="ts">
import { formatDateTime as formatDate } from '@/utils/format';
import { computed, onMounted, ref, type Component } from 'vue';
import { useRouter } from 'vue-router';
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Box,
  CheckCircle2,
  Clock,
  CreditCard,
  Database,
  FileCheck2,
  Image as ImageIcon,
  Layers,
  Megaphone,
  RefreshCw,
  Send,
  Settings2,
  ShieldCheck,
  Trash2,
  TrendingUp,
  UserPlus,
  Users,
  Video,
  Workflow,
  Zap,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '@/utils/api';
import { getApiErrorMessage } from '@/utils/error';
import UserAvatar from '@/components/UserAvatar.vue';
import type { Asset, User } from '@/types';

// UI components
import PageHeader from '@/components/PageHeader.vue';
import Card from '@/components/ui/Card.vue';
import Button from '@/components/ui/Button.vue';
import Badge from '@/components/ui/Badge.vue';
import Modal from '@/components/ui/Modal.vue';
import Tabs from '@/components/ui/Tabs.vue';
import SegmentedControl from '@/components/ui/SegmentedControl.vue';
import Input from '@/components/ui/Input.vue';

type HealthLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'WATCH' | 'OK';

interface FeedbackItem {
  id: string;
  type: string;
  title: string;
  priority: string;
  status: string;
  updatedAt: string;
  user?: User | null;
}

interface AuditLogItem {
  id: string;
  module: string;
  action: string;
  description?: string | null;
  createdAt: string;
  user?: User | null;
}

interface ReviewQueueItem {
  id: string;
  title?: string;
  name?: string;
  createdAt: string;
  user?: Pick<User, 'name' | 'email'> | null;
}

interface CourseInsight {
  id: string;
  title: string;
  status: string;
  category?: { name: string } | null;
  _count?: {
    lessons: number;
    enrollments: number;
    reviews: number;
  };
}

interface BroadcastHistoryItem {
  id: string;
  title: string;
  content: string;
  link?: string | null;
  createdAt: string;
}

interface AdminStatsResponse {
  counts: Record<string, number | undefined>;
  health: {
    reviewQueueLevel: HealthLevel;
    feedbackLevel: HealthLevel;
    billingLevel: HealthLevel;
    contentLevel: HealthLevel;
  };
  growth: Record<string, number | undefined>;
  reviewQueues: {
    assets: { total: number; items: ReviewQueueItem[] };
    materials: { total: number; items: ReviewQueueItem[] };
    showcases: { total: number; items: ReviewQueueItem[] };
  };
  recentUsers: User[];
  recentAssets: Asset[];
  recentFeedbacks: FeedbackItem[];
  recentAuditLogs: AuditLogItem[];
  topCourses: CourseInsight[];
  latestBroadcasts: BroadcastHistoryItem[];
}

interface PipelineCard {
  label: string;
  total: number;
  approved: number;
  pending: number;
  rejected: number;
  route: string;
  color: string;
}

interface QuickAction {
  label: string;
  meta: string;
  route: string;
  icon: Component;
  tone: string;
}

const router = useRouter();
const isLoading = ref(true);
const dashboard = ref<AdminStatsResponse | null>(null);

const showBroadcastModal = ref(false);
const broadcastTab = ref<'send' | 'history'>('send');
const isBroadcasting = ref(false);
const isHistoryLoading = ref(false);
const broadcastHistory = ref<BroadcastHistoryItem[]>([]);
const broadcastForm = ref({
  title: '',
  content: '',
  link: '',
});

const activeActivityTab = ref<'assets' | 'courses' | 'feedback'>('assets');
const activeFeedTab = ref<'users' | 'logs'>('users');

const counts = computed(() => dashboard.value?.counts || {});

const ratio = (value: number, total: number) => {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((value / total) * 100)));
};

const platformStatus = computed(() => {
  const pressure =
    (counts.value.reviewQueueTotal || 0) +
    (counts.value.openFeedbacks || 0) +
    (counts.value.failedTransactions || 0) * 4;
  if (pressure >= 24) {
    return {
      label: '高压',
      variant: 'danger' as const,
      icon: AlertTriangle,
    };
  }
  if (pressure > 0) {
    return {
      label: '关注',
      variant: 'warning' as const,
      icon: Zap,
    };
  }
  return {
    label: '稳定',
    variant: 'success' as const,
    icon: CheckCircle2,
  };
});

const totalContentCount = computed(
  () => (counts.value.assets || 0) + (counts.value.materials || 0) + (counts.value.showcases || 0),
);

const consolidatedCards = computed(() => {
  const approvedContent =
    (counts.value.approvedAssets || 0) +
    (counts.value.approvedMaterials || 0) +
    (counts.value.approvedShowcases || 0);
  const contentTotal = totalContentCount.value;
  const contentRate = ratio(approvedContent, contentTotal);
  const learningTotal = (counts.value.courses || 0) + (counts.value.roadmaps || 0);
  const publishedRate = ratio(counts.value.publishedCourses || 0, counts.value.courses || 0);

  return [
    {
      label: '用户与安全规模',
      value: counts.value.users || 0,
      hint: `7d 新增 ${counts.value.newUsers7d || 0} · 审计数 ${counts.value.auditLogs7d || 0}`,
      icon: Users,
      route: '/admin/users',
      color: 'text-sky-600 bg-sky-500/10 border-sky-500/20',
      progress: null,
      health: getHealthMeta('OK'),
    },
    {
      label: '内容资产审核',
      value: contentTotal,
      hint: `待审核 ${counts.value.reviewQueueTotal || 0} · 通过率 ${contentRate}%`,
      icon: Box,
      route: '/admin/audits',
      color: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20',
      progress: contentRate,
      health: getHealthMeta(dashboard.value?.health.reviewQueueLevel || 'OK'),
    },
    {
      label: '教学运营可见度',
      value: learningTotal,
      hint: `已发布课程 ${counts.value.publishedCourses || 0} · 占比 ${publishedRate}%`,
      icon: BookOpen,
      route: '/admin/courses',
      color: 'text-indigo-600 bg-indigo-500/10 border-indigo-500/20',
      progress: publishedRate,
      health: getHealthMeta(dashboard.value?.health.feedbackLevel || 'OK'),
    },
    {
      label: '流水与商业订阅',
      value: counts.value.activeSubscriptions || 0,
      hint: `失败交易 ${counts.value.failedTransactions || 0} · 激活码 ${counts.value.activeCodes || 0}`,
      icon: CreditCard,
      route: '/admin/subscriptions',
      color: 'text-rose-600 bg-rose-500/10 border-rose-500/20',
      progress: null,
      health: getHealthMeta(dashboard.value?.health.billingLevel || 'OK'),
    },
  ];
});

const reviewQueues = computed(() => [
  {
    key: 'assets',
    label: '3D 资产',
    icon: Box,
    route: '/admin/audits?tab=assets',
    total: dashboard.value?.reviewQueues.assets.total || 0,
    items: dashboard.value?.reviewQueues.assets.items || [],
  },
  {
    key: 'materials',
    label: '材质资源',
    icon: Layers,
    route: '/admin/audits?tab=materials',
    total: dashboard.value?.reviewQueues.materials.total || 0,
    items: dashboard.value?.reviewQueues.materials.items || [],
  },
  {
    key: 'showcases',
    label: '作品展示',
    icon: Video,
    route: '/admin/audits?tab=showcases',
    total: dashboard.value?.reviewQueues.showcases.total || 0,
    items: dashboard.value?.reviewQueues.showcases.items || [],
  },
]);

const pipelineCards = computed<PipelineCard[]>(() => [
  {
    label: '3D 资产',
    total: counts.value.assets || 0,
    approved: counts.value.approvedAssets || 0,
    pending: counts.value.pendingAssets || 0,
    rejected: counts.value.rejectedAssets || 0,
    route: '/admin/audits?tab=assets',
    color: 'bg-sky-500',
  },
  {
    label: '材质资源',
    total: counts.value.materials || 0,
    approved: counts.value.approvedMaterials || 0,
    pending: counts.value.pendingMaterials || 0,
    rejected: counts.value.rejectedMaterials || 0,
    route: '/admin/audits?tab=materials',
    color: 'bg-emerald-500',
  },
  {
    label: '作品展示',
    total: counts.value.showcases || 0,
    approved: counts.value.approvedShowcases || 0,
    pending: counts.value.pendingShowcases || 0,
    rejected: counts.value.rejectedShowcases || 0,
    route: '/admin/audits?tab=showcases',
    color: 'bg-violet-500',
  },
]);

const growthBars = computed(() => [
  {
    label: '用户 7 天',
    value: counts.value.newUsers7d || 0,
    base: Math.max(counts.value.newUsers30d || 1, 1),
    tone: 'bg-sky-500',
  },
  {
    label: '用户 30 天',
    value: counts.value.newUsers30d || 0,
    base: Math.max(counts.value.users || 1, 1),
    tone: 'bg-emerald-500',
  },
  {
    label: '资产 7 天',
    value: counts.value.newAssets7d || 0,
    base: Math.max(counts.value.assets || 1, 1),
    tone: 'bg-amber-500',
  },
  {
    label: '课程 30 天',
    value: counts.value.newCourses30d || 0,
    base: Math.max(counts.value.courses || 1, 1),
    tone: 'bg-rose-500',
  },
]);

const quickActions = computed<QuickAction[]>(() => [
  {
    label: '审核中心',
    meta: `${counts.value.reviewQueueTotal || 0} 个待审`,
    route: '/admin/audits',
    icon: ShieldCheck,
    tone: 'text-amber-600 bg-amber-500/10 dark:bg-amber-500/20',
  },
  {
    label: '用户治理',
    meta: `${counts.value.bannedUsers || 0} 个封禁`,
    route: '/admin/users',
    icon: Users,
    tone: 'text-sky-600 bg-sky-500/10 dark:bg-sky-500/20',
  },
  {
    label: '团队协作',
    meta: `${counts.value.teams || 0} 个团队`,
    route: '/admin/teams',
    icon: UserPlus,
    tone: 'text-cyan-600 bg-cyan-500/10 dark:bg-cyan-500/20',
  },
  {
    label: '课程运营',
    meta: `${counts.value.draftCourses || 0} 个草稿`,
    route: '/admin/courses',
    icon: BookOpen,
    tone: 'text-emerald-600 bg-emerald-500/10 dark:bg-emerald-500/20',
  },
  {
    label: '轮播投放',
    meta: `${counts.value.activeBanners || 0} 个启用`,
    route: '/admin/banners',
    icon: ImageIcon,
    tone: 'text-orange-600 bg-orange-500/10 dark:bg-orange-500/20',
  },
  {
    label: '商业订阅',
    meta: `${counts.value.activeSubscriptions || 0} 个活跃`,
    route: '/admin/subscriptions',
    icon: CreditCard,
    tone: 'text-rose-600 bg-rose-500/10 dark:bg-rose-500/20',
  },
  {
    label: '镜像源',
    meta: `${counts.value.mirrorSources || 0} 个来源`,
    route: '/admin/mirror',
    icon: Database,
    tone: 'text-indigo-600 bg-indigo-500/10 dark:bg-indigo-500/20',
  },
  {
    label: '资源站',
    meta: `${counts.value.manualStations || 0} 个站点`,
    route: '/admin/manual',
    icon: BookOpen,
    tone: 'text-violet-600 bg-violet-500/10 dark:bg-violet-500/20',
  },
  {
    label: '系统设置',
    meta: '参数与品牌',
    route: '/admin/settings',
    icon: Settings2,
    tone: 'text-slate-600 bg-slate-500/10 dark:bg-slate-500/20',
  },
  {
    label: '全站广播',
    meta: `${broadcastHistory.value.length} 条记录`,
    route: 'broadcast',
    icon: Megaphone,
    tone: 'text-slate-600 bg-slate-500/10 dark:bg-slate-500/20',
  },
]);

const fetchAdminStats = async () => {
  try {
    isLoading.value = true;
    const { data } = await api.get<AdminStatsResponse>('/api/admin/stats');
    dashboard.value = data;
    broadcastHistory.value = data.latestBroadcasts || [];
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '平台概览加载失败'));
  } finally {
    isLoading.value = false;
  }
};

const fetchBroadcastHistory = async () => {
  try {
    isHistoryLoading.value = true;
    const { data } = await api.get('/api/admin/broadcasts');
    broadcastHistory.value = data;
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '广播历史加载失败'));
  } finally {
    isHistoryLoading.value = false;
  }
};

const switchBroadcastTab = (tab: 'send' | 'history') => {
  broadcastTab.value = tab;
  if (tab === 'history') {
    fetchBroadcastHistory();
  }
};

const handleSendBroadcast = async () => {
  if (!broadcastForm.value.title.trim() || !broadcastForm.value.content.trim()) {
    ElMessage.warning('请填写广播标题和内容');
    return;
  }

  try {
    isBroadcasting.value = true;
    const { data } = await api.post('/api/admin/broadcast', broadcastForm.value);
    ElMessage.success(data.message || '广播已发送');
    broadcastForm.value = { title: '', content: '', link: '' };
    showBroadcastModal.value = false;
    fetchAdminStats();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '广播发送失败'));
  } finally {
    isBroadcasting.value = false;
  }
};

const handleDeleteBroadcast = async (id: string) => {
  try {
    await ElMessageBox.confirm('撤回后不会删除已下发通知，但广播记录会从后台移除。', '撤回广播', {
      confirmButtonText: '撤回',
      cancelButtonText: '取消',
      type: 'warning',
    });
    await api.delete(`/api/admin/broadcasts/${id}`);
    ElMessage.success('广播已撤回');
    fetchBroadcastHistory();
    fetchAdminStats();
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(getApiErrorMessage(error, '撤回失败'));
    }
  }
};

const getHealthMeta = (level: HealthLevel) => {
  if (level === 'HIGH')
    return { label: '高压', class: 'text-red-600 bg-red-500/10 border-red-500/20' };
  if (level === 'MEDIUM' || level === 'WATCH') {
    return { label: '关注', class: 'text-amber-600 bg-amber-500/10 border-amber-500/20' };
  }
  return { label: '正常', class: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20' };
};

const getBadgeVariant = (label: string) => {
  if (label === '正常' || label === '稳定') return 'success';
  if (label === '关注') return 'warning';
  if (label === '高压') return 'danger';
  return 'primary';
};

const getStatusBadgeVariant = (status?: string) => {
  if (
    status === 'APPROVED' ||
    status === 'RESOLVED' ||
    status === 'ACTIVE' ||
    status === 'PUBLISHED'
  ) {
    return 'success';
  }
  if (status === 'REJECTED' || status === 'BANNED' || status === 'FAILED') {
    return 'danger';
  }
  return 'warning';
};

const getActionLabel = (action: string) => {
  const labels: Record<string, string> = {
    LOGIN: '登录',
    UPDATE_SETTINGS: '更新设置',
    CREATE_USER: '创建用户',
    UPDATE_USER: '更新用户',
    DELETE_USER: '删除用户',
    RESET_PASSWORD: '重置密码',
    APPROVE_ASSET: '通过资产',
    REJECT_ASSET: '驳回资产',
    APPROVE_MATERIAL: '通过材质',
    REJECT_MATERIAL: '驳回材质',
    APPROVE_SHOWCASE: '通过作品',
    REJECT_SHOWCASE: '驳回作品',
  };
  return labels[action] || action;
};

const getPipelineWidth = (value: number, total: number) => `${ratio(value, total)}%`;

const getGrowthWidth = (value: number, base: number) => `${Math.max(4, ratio(value, base))}%`;

const openQuickAction = (action: QuickAction) => {
  if (action.route === 'broadcast') {
    showBroadcastModal.value = true;
    return;
  }
  router.push(action.route);
};

onMounted(fetchAdminStats);
</script>

<template>
  <div class="admin-dashboard flex flex-1 min-h-0 flex-col overflow-hidden">
    <main class="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
      <div class="space-y-3">
        <!-- Reusable PageHeader component -->
        <PageHeader
          title="平台运营概览"
          subtitle="把用户、内容、审核、教学和运营状态放在同一个驾驶舱里。"
          variant="card"
        >
          <template #center>
            <Badge :variant="platformStatus.variant" dot>
              {{ platformStatus.label }}
            </Badge>
          </template>

          <!-- Standard buttons reusing project button components -->
          <Button
            variant="secondary"
            size="sm"
            :icon="Clock"
            @click="router.push('/admin/audit-logs')"
          >
            审计日志
          </Button>
          <Button
            variant="secondary"
            size="sm"
            :icon="Megaphone"
            @click="showBroadcastModal = true"
          >
            全站广播
          </Button>
          <Button
            variant="primary"
            size="sm"
            :icon="RefreshCw"
            :loading="isLoading"
            @click="fetchAdminStats"
          >
            刷新
          </Button>
        </PageHeader>
        <!-- Top KPI metrics grid (Extreme Horizontal Compact Layout) -->
        <section class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <Card
            v-for="card in consolidatedCards"
            :key="card.label"
            hoverable
            clickable
            glow
            class="group cursor-pointer !p-2 px-2.5"
            @click="router.push(card.route)"
          >
            <div class="flex items-center justify-between w-full gap-3">
              <!-- Left: Icon & Info (stacked horizontally) -->
              <div class="flex items-center gap-2.5 min-w-0">
                <span
                  class="panel-icon border border-base rounded-lg p-1.5 transition-transform group-hover:scale-105 shrink-0"
                  :class="card.color"
                >
                  <component :is="card.icon" class="h-3.5 w-3.5" />
                </span>
                <div class="min-w-0">
                  <p
                    class="text-[11px] font-bold text-[var(--text-secondary)] truncate leading-tight"
                  >
                    {{ card.label }}
                  </p>
                  <p
                    class="text-[9px] text-[var(--text-secondary)] opacity-80 truncate mt-0.5 leading-none"
                    :title="card.hint"
                  >
                    {{ card.hint }}
                  </p>
                </div>
              </div>

              <!-- Right: Metric & Health Badge -->
              <div class="flex items-center gap-2 shrink-0">
                <span class="text-base font-black text-[var(--text-primary)] leading-none">
                  {{ card.value.toLocaleString() }}
                </span>
                <Badge :variant="getBadgeVariant(card.health.label)">
                  {{ card.health.label }}
                </Badge>
              </div>
            </div>

            <!-- Sleek flat progress bar (very compact) -->
            <div
              v-if="card.progress !== null"
              class="w-full h-[3px] bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden mt-1.5"
            >
              <div
                class="h-full rounded-full bg-accent"
                :style="{ width: `${card.progress}%` }"
              ></div>
            </div>
          </Card>
        </section>

        <!-- Horizontal Operations Quick Launch Panel -->
        <Card padding="sm">
          <template #header>
            <div class="flex items-center gap-2">
              <FileCheck2 class="h-4 w-4 text-[var(--accent)]" />
              <h2 class="panel-title text-xs font-bold text-[var(--text-primary)]">常用运营工具</h2>
            </div>
          </template>
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            <button
              v-for="action in quickActions"
              :key="action.label"
              type="button"
              class="group border border-base rounded-lg p-2 flex items-center gap-2.5 bg-subtle text-left transition-all hover:border-[var(--accent)] hover:bg-hover cursor-pointer"
              @click="openQuickAction(action)"
            >
              <span
                :class="action.tone"
                class="h-7 w-7 shrink-0 flex items-center justify-center rounded-lg transition-transform group-hover:scale-105"
              >
                <component :is="action.icon" class="h-3.5 w-3.5" />
              </span>
              <div class="min-w-0 flex-1">
                <span
                  class="group-hover:text-[var(--accent)] transition-colors text-[11px] font-black block truncate text-[var(--text-primary)]"
                >
                  {{ action.label }}
                </span>
                <span class="text-[9px] text-slate-400 block truncate mt-0.5">{{
                  action.meta
                }}</span>
              </div>
            </button>
          </div>
        </Card>

        <!-- Main section layout: Balanced asymmetric grid -->
        <section class="grid gap-3 xl:grid-cols-[1.25fr_0.75fr] grid-cols-1">
          <!-- Left Column: Content Audits & Platform activity -->
          <div class="space-y-3">
            <!-- Unified Content Audit & Pipelines Hub -->
            <Card padding="sm">
              <template #header>
                <div class="flex items-center justify-between w-full">
                  <div>
                    <h2
                      class="panel-title flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]"
                    >
                      <Workflow class="h-4 w-4 text-[var(--accent)]" />
                      内容审核与流转管线
                    </h2>
                    <p class="text-[10px] text-[var(--text-secondary)] mt-0.5">
                      监控平台内容生产管线并处理待审队列。
                    </p>
                  </div>
                  <Button variant="link" size="sm" @click="router.push('/admin/audits')">
                    进入审核中心
                  </Button>
                </div>
              </template>

              <div class="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                <Card
                  v-for="(queue, index) in reviewQueues"
                  :key="queue.key"
                  padding="sm"
                  class="bg-subtle/40 border-base"
                >
                  <!-- Top Part: Pipeline Card equivalent -->
                  <div v-if="pipelineCards[index]" class="pb-1.5 border-b border-base/40 mb-2">
                    <div class="flex items-center justify-between mb-1">
                      <span
                        class="inline-flex items-center gap-1 text-[11px] font-black text-[var(--text-primary)]"
                      >
                        <component :is="queue.icon" class="h-3.5 w-3.5 text-[var(--accent)]" />
                        {{ queue.label }}
                      </span>
                      <div class="flex items-center gap-1">
                        <span class="text-xs font-black text-[var(--text-primary)]">{{
                          pipelineCards[index].total
                        }}</span>
                        <span class="text-[9px] text-slate-400">总数</span>
                      </div>
                    </div>

                    <!-- Pipeline Visual Bar -->
                    <div
                      class="flex h-1 overflow-hidden rounded-full bg-slate-100 dark:bg-white/5 my-1"
                    >
                      <span
                        class="bg-emerald-500 rounded-l"
                        :style="{
                          width: getPipelineWidth(
                            pipelineCards[index].approved,
                            pipelineCards[index].total,
                          ),
                        }"
                      ></span>
                      <span
                        class="bg-amber-500"
                        :style="{
                          width: getPipelineWidth(
                            pipelineCards[index].pending,
                            pipelineCards[index].total,
                          ),
                        }"
                      ></span>
                      <span
                        class="bg-rose-500 rounded-r"
                        :style="{
                          width: getPipelineWidth(
                            pipelineCards[index].rejected,
                            pipelineCards[index].total,
                          ),
                        }"
                      ></span>
                    </div>

                    <!-- Stats details -->
                    <div
                      class="flex justify-between items-center text-[9px] text-[var(--text-secondary)] font-bold px-0.5"
                    >
                      <span class="text-emerald-500">通过 {{ pipelineCards[index].approved }}</span>
                      <span class="text-amber-500">待审 {{ pipelineCards[index].pending }}</span>
                      <span class="text-rose-500">打回 {{ pipelineCards[index].rejected }}</span>
                    </div>
                  </div>

                  <!-- Bottom Part: Queue Item list (Sliced to 2 items for extreme compactness) -->
                  <div class="flex-1 flex flex-col justify-between">
                    <div>
                      <div
                        class="flex items-center justify-between text-[9px] font-bold text-[var(--text-secondary)] mb-1.5"
                      >
                        <span>待审队列</span>
                        <Badge :variant="queue.total > 0 ? 'warning' : 'info'">
                          {{ queue.total }} 个待处理
                        </Badge>
                      </div>
                      <div class="space-y-1">
                        <button
                          v-for="item in queue.items.slice(0, 2)"
                          :key="item.id"
                          type="button"
                          class="w-full flex items-center justify-between gap-2 p-1.5 border border-base rounded bg-card text-left transition-all hover:border-[var(--accent)] hover:bg-[var(--bg-app)]/30 text-[11px] cursor-pointer"
                          @click="router.push(queue.route)"
                        >
                          <span class="truncate font-medium text-[var(--text-primary)]">{{
                            item.title || item.name || '未命名内容'
                          }}</span>
                          <small class="text-slate-400 shrink-0 text-[9px]">{{
                            formatDate(item.createdAt)
                          }}</small>
                        </button>
                        <div
                          v-if="queue.items.length === 0"
                          class="empty-line py-3 text-center text-[10px] text-slate-400 border border-dashed border-base rounded-lg"
                        >
                          暂无待审内容
                        </div>
                      </div>
                    </div>

                    <button
                      v-if="queue.total > 2"
                      type="button"
                      class="mt-2 text-center text-[9px] font-black text-[var(--accent)] hover:underline cursor-pointer"
                      @click="router.push(queue.route)"
                    >
                      全部 {{ queue.total }} 个待审...
                    </button>
                  </div>
                </Card>
              </div>
            </Card>

            <!-- Platform Real-time Activity & Insights Panel -->
            <Card padding="sm">
              <template #header>
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 w-full">
                  <h2
                    class="panel-title flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]"
                  >
                    <Activity class="h-4 w-4 text-[var(--accent)]" />
                    平台动态监测
                  </h2>
                  <Tabs
                    v-model="activeActivityTab"
                    :options="[
                      { label: '最新资产', value: 'assets' },
                      { label: '热门课程', value: 'courses' },
                      { label: '用户反馈', value: 'feedback' },
                    ]"
                    size="sm"
                    variant="solid"
                  />
                </div>
              </template>

              <div class="tab-content min-h-[170px]">
                <!-- Tab: Latest Assets -->
                <div v-show="activeActivityTab === 'assets'" class="space-y-2">
                  <div
                    class="flex items-center justify-between text-[11px] text-[var(--text-secondary)]"
                  >
                    <span>最新提交且已处理或待审的资产。</span>
                    <Button
                      variant="link"
                      size="sm"
                      @click="router.push('/admin/audits?tab=assets')"
                    >
                      查看资产审核
                    </Button>
                  </div>
                  <div class="asset-grid">
                    <button
                      v-for="asset in dashboard?.recentAssets || []"
                      :key="asset.id"
                      type="button"
                      class="asset-row flex items-center gap-2.5 p-2 border border-base rounded-lg bg-card text-left transition-all hover:border-[var(--accent)] hover:bg-[var(--bg-app)]/30 text-xs cursor-pointer w-full"
                      @click="router.push('/admin/audits?tab=assets')"
                    >
                      <span
                        class="asset-thumb border border-base flex items-center justify-center shrink-0"
                      >
                        <img v-if="asset.thumbnail" :src="asset.thumbnail" :alt="asset.title" />
                        <Box v-else class="h-4 w-4 text-slate-400" />
                      </span>
                      <span class="min-w-0 flex-1 text-left">
                        <b class="text-xs font-bold block truncate text-[var(--text-primary)]">{{
                          asset.title
                        }}</b>
                        <small
                          class="text-[9px] text-[var(--text-secondary)] mt-0.5 block truncate"
                          >{{ asset.user?.name || asset.user?.email || '未知作者' }}</small
                        >
                      </span>
                      <Badge :variant="getStatusBadgeVariant(asset.status)">{{
                        asset.status
                      }}</Badge>
                    </button>
                    <div
                      v-if="!dashboard?.recentAssets?.length"
                      class="empty-line w-full col-span-full py-5 text-center text-xs border border-dashed border-base rounded-lg text-slate-400"
                    >
                      暂无资产提交
                    </div>
                  </div>
                </div>

                <!-- Tab: Popular Courses -->
                <div v-show="activeActivityTab === 'courses'" class="space-y-2">
                  <div
                    class="flex items-center justify-between text-[11px] text-[var(--text-secondary)]"
                  >
                    <span>按学员报名人数排序的热门课程排行。</span>
                    <Button variant="link" size="sm" @click="router.push('/admin/courses')">
                      课程管理
                    </Button>
                  </div>
                  <div class="list-stack">
                    <button
                      v-for="course in dashboard?.topCourses || []"
                      :key="course.id"
                      type="button"
                      class="list-row flex items-center justify-between gap-2.5 p-2 border border-base rounded-lg bg-card text-left transition-all hover:border-[var(--accent)] hover:bg-[var(--bg-app)]/30 text-xs cursor-pointer w-full"
                      @click="router.push('/admin/courses')"
                    >
                      <div class="min-w-0 flex-1 text-left">
                        <p class="truncate text-xs font-black text-[var(--text-primary)]">
                          {{ course.title }}
                        </p>
                        <p class="mt-0.5 text-[10px]" style="color: var(--text-secondary)">
                          {{ course.category?.name || '未分类' }} ·
                          {{ course._count?.lessons || 0 }} 节课
                        </p>
                      </div>
                      <Badge variant="primary" outline>
                        {{ course._count?.enrollments || 0 }} 人报名
                      </Badge>
                    </button>
                    <div
                      v-if="!dashboard?.topCourses?.length"
                      class="empty-line py-5 text-center text-xs border border-dashed border-base rounded-lg text-slate-400"
                    >
                      暂无课程数据
                    </div>
                  </div>
                </div>

                <!-- Tab: Recent Feedback -->
                <div v-show="activeActivityTab === 'feedback'" class="space-y-2">
                  <div
                    class="flex items-center justify-between text-[11px] text-[var(--text-secondary)]"
                  >
                    <span>最新的用户工单与产品反馈信息。</span>
                    <Button variant="link" size="sm" @click="router.push('/admin/feedback')">
                      处理反馈
                    </Button>
                  </div>
                  <div class="list-stack">
                    <button
                      v-for="feedback in dashboard?.recentFeedbacks || []"
                      :key="feedback.id"
                      type="button"
                      class="list-row flex items-center justify-between gap-2.5 p-2 border border-base rounded-lg bg-card text-left transition-all hover:border-[var(--accent)] hover:bg-[var(--bg-app)]/30 text-xs cursor-pointer w-full"
                      @click="router.push('/admin/feedback')"
                    >
                      <div class="min-w-0 flex-1 text-left">
                        <p class="truncate text-xs font-black text-[var(--text-primary)]">
                          {{ feedback.title }}
                        </p>
                        <p class="mt-0.5 text-[10px]" style="color: var(--text-secondary)">
                          {{ feedback.user?.name || feedback.user?.email || '匿名用户' }} ·
                          {{ formatDate(feedback.updatedAt) }}
                        </p>
                      </div>
                      <Badge :variant="getStatusBadgeVariant(feedback.status)">{{
                        feedback.status
                      }}</Badge>
                    </button>
                    <div
                      v-if="!dashboard?.recentFeedbacks?.length"
                      class="empty-line py-5 text-center text-xs border border-dashed border-base rounded-lg text-slate-400"
                    >
                      暂无用户反馈
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <!-- Right Column: Growth Snapshot & System Feed -->
          <div class="space-y-3">
            <!-- Growth Snapshot Card -->
            <Card padding="sm">
              <template #header>
                <h2
                  class="panel-title flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]"
                >
                  <TrendingUp class="h-4 w-4 text-[var(--accent)]" />
                  趋势与成长快照
                </h2>
              </template>
              <div class="grid grid-cols-2 gap-2">
                <div
                  v-for="item in growthBars"
                  :key="item.label"
                  class="border border-base rounded-lg p-2 bg-subtle"
                >
                  <span class="text-[9px] text-slate-500 font-bold block">{{ item.label }}</span>
                  <b class="text-base font-black block mt-0.5 text-[var(--text-primary)]">{{
                    item.value
                  }}</b>
                  <div
                    class="w-full h-1 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden mt-1.5"
                  >
                    <em
                      class="block h-full rounded-full"
                      :class="item.tone"
                      :style="{ width: getGrowthWidth(item.value, item.base) }"
                    ></em>
                  </div>
                </div>
              </div>
            </Card>

            <!-- System Activity Feed Card (Tabbed) -->
            <Card padding="sm">
              <template #header>
                <div class="flex items-center justify-between w-full">
                  <h2
                    class="panel-title flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]"
                  >
                    <Activity class="h-4 w-4 text-[var(--accent)]" />
                    系统活动流
                  </h2>
                  <Tabs
                    v-model="activeFeedTab"
                    :options="[
                      { label: '新用户', value: 'users' },
                      { label: '审计日志', value: 'logs' },
                    ]"
                    size="sm"
                    variant="solid"
                  />
                </div>
              </template>

              <div class="tab-content min-h-[170px]">
                <!-- Tab: Users -->
                <div v-show="activeFeedTab === 'users'" class="space-y-2">
                  <div class="list-stack">
                    <button
                      v-for="user in dashboard?.recentUsers || []"
                      :key="user.id"
                      type="button"
                      class="user-row flex items-center gap-2.5 p-2 border border-base rounded-lg bg-card text-left transition-all hover:border-[var(--accent)] hover:bg-[var(--bg-app)]/30 text-xs cursor-pointer w-full"
                      @click="router.push('/admin/users')"
                    >
                      <UserAvatar :user="user" size="sm" />
                      <span class="min-w-0 flex-1 text-left">
                        <b class="text-xs font-bold block truncate text-[var(--text-primary)]">{{
                          user.name || '未命名用户'
                        }}</b>
                        <small class="truncate block text-[9px] text-slate-400 mt-0.5">{{
                          user.email
                        }}</small>
                      </span>
                      <Badge :variant="getStatusBadgeVariant(user.status)">{{ user.status }}</Badge>
                    </button>
                    <div
                      v-if="!dashboard?.recentUsers?.length"
                      class="empty-line py-5 text-center text-xs border border-dashed border-base rounded-lg text-slate-400"
                    >
                      暂无新用户
                    </div>
                  </div>
                  <Button
                    v-if="dashboard?.recentUsers?.length"
                    variant="link"
                    size="sm"
                    full-width
                    class="mt-1"
                    @click="router.push('/admin/users')"
                  >
                    进入用户管理
                  </Button>
                </div>

                <!-- Tab: Audit Logs -->
                <div v-show="activeFeedTab === 'logs'" class="space-y-2">
                  <div class="timeline flex flex-col gap-1.5">
                    <button
                      v-for="log in dashboard?.recentAuditLogs || []"
                      :key="log.id"
                      type="button"
                      class="timeline-item flex items-start gap-2.5 p-2 border border-base rounded-lg bg-card text-left transition-all hover:border-[var(--accent)] hover:bg-[var(--bg-app)]/30 text-xs cursor-pointer w-full"
                      @click="router.push('/admin/audit-logs')"
                    >
                      <span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent"></span>
                      <div class="text-left flex-1 min-w-0">
                        <p class="font-bold text-xs text-[var(--text-primary)]">
                          {{ getActionLabel(log.action) }}
                        </p>
                        <small class="block text-slate-500 mt-0.5"
                          >{{ log.user?.name || log.user?.email || 'System' }} ·
                          {{ formatDate(log.createdAt) }}</small
                        >
                      </div>
                    </button>
                    <div
                      v-if="!dashboard?.recentAuditLogs?.length"
                      class="empty-line py-5 text-center text-xs border border-dashed border-base rounded-lg text-slate-400"
                    >
                      暂无审计记录
                    </div>
                  </div>
                  <Button
                    v-if="dashboard?.recentAuditLogs?.length"
                    variant="link"
                    size="sm"
                    full-width
                    class="mt-1"
                    @click="router.push('/admin/audit-logs')"
                  >
                    查看全部审计日志
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </section>
      </div>
    </main>

    <!-- Refactored Broadcast Modal using Modal, SegmentedControl and Input components -->
    <Modal
      :show="showBroadcastModal"
      title="全站广播"
      size="md"
      @close="showBroadcastModal = false"
    >
      <div class="space-y-4">
        <p class="text-xs text-[var(--text-secondary)] -mt-2">
          向所有用户发送系统通知，重要活动和维护公告都从这里发布。
        </p>

        <SegmentedControl
          v-model="broadcastTab"
          :options="[
            { value: 'send', label: '发布广播', icon: Send },
            { value: 'history', label: '历史记录', icon: Clock },
          ]"
          full-width
        />

        <div v-if="broadcastTab === 'send'" class="space-y-3.5">
          <Input
            v-model="broadcastForm.title"
            label="标题"
            placeholder="例如：端午活动上线通知"
            required
          />

          <div class="space-y-1.5">
            <label class="field-label text-xs font-bold text-[var(--text-secondary)] ml-1 uppercase"
              >内容 <span class="text-red-500">*</span></label
            >
            <textarea
              v-model="broadcastForm.content"
              class="w-full text-sm font-medium rounded-xl border border-base bg-card text-[var(--text-primary)] focus:border-accent focus:ring-2 focus:ring-accent/20 p-3 outline-none resize-none transition-all duration-300"
              rows="5"
              placeholder="写清楚影响范围、操作指引 and 跳转入口"
            ></textarea>
          </div>

          <Input
            v-model="broadcastForm.link"
            label="跳转链接"
            placeholder="/academy 或 https://..."
          />

          <Button
            variant="primary"
            full-width
            class="justify-center"
            :loading="isBroadcasting"
            :icon="Send"
            @click="handleSendBroadcast"
          >
            {{ isBroadcasting ? '发送中' : '立即发布' }}
          </Button>
        </div>

        <div v-else class="max-h-[460px] space-y-2 overflow-y-auto pr-1">
          <div
            v-if="isHistoryLoading"
            class="empty-line py-6 text-center text-xs border border-dashed border-base rounded-lg text-slate-400"
          >
            正在加载广播历史...
          </div>
          <article
            v-for="broadcast in broadcastHistory"
            v-else
            :key="broadcast.id"
            class="broadcast-row flex items-start justify-between gap-3 p-3 border border-base bg-subtle/30 rounded-xl"
          >
            <div class="min-w-0 flex-1">
              <p class="truncate text-xs font-black text-[var(--text-primary)]">
                {{ broadcast.title }}
              </p>
              <p class="mt-1 line-clamp-2 text-xs text-[var(--text-secondary)]">
                {{ broadcast.content }}
              </p>
              <small class="block text-[10px] text-slate-400 mt-1.5"
                >{{ formatDate(broadcast.createdAt) }}
                <span v-if="broadcast.link">· {{ broadcast.link }}</span></small
              >
            </div>
            <Button
              variant="danger"
              size="sm"
              class="shrink-0 h-8 w-8 !p-0"
              title="撤回广播"
              :icon="Trash2"
              @click="handleDeleteBroadcast(broadcast.id)"
            />
          </article>
          <div
            v-if="!isHistoryLoading && broadcastHistory.length === 0"
            class="empty-line py-6 text-center text-xs border border-dashed border-base rounded-lg text-slate-400"
          >
            暂无广播记录
          </div>
        </div>
      </div>
    </Modal>
  </div>
</template>

<style scoped>
.admin-dashboard {
  background: transparent;
}

.panel-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
}

.asset-grid {
  display: grid;
  gap: 0.5rem;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.asset-thumb {
  display: inline-flex;
  height: 32px;
  width: 40px;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 6px;
  background: rgba(148, 163, 184, 0.12);
}

.asset-thumb img {
  height: 100%;
  width: 100%;
  object-fit: cover;
}

.list-stack {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.empty-line {
  border: 1px dashed var(--border-base);
  border-radius: 8px;
  padding: 1rem;
  color: var(--text-secondary);
  text-align: center;
  font-size: 11px;
}
</style>
