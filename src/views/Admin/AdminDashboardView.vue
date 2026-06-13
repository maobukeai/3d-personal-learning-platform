<script setup lang="ts">
import { computed, onMounted, ref, type Component } from 'vue';
import { useRouter } from 'vue-router';
import {
  Activity,
  AlertTriangle,
  BarChart3,
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
    return { label: '高压', class: 'border-rose-500/25 bg-rose-500/10 text-rose-600', icon: AlertTriangle };
  }
  if (pressure > 0) {
    return { label: '关注', class: 'border-amber-500/25 bg-amber-500/10 text-amber-600', icon: Zap };
  }
  return { label: '稳定', class: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-600', icon: CheckCircle2 };
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
      hint: `7 天新增 ${counts.value.newUsers7d || 0} · 审计动作 ${counts.value.auditLogs7d || 0}`,
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
      hint: `已发布课程 ${counts.value.publishedCourses || 0} · 可见度 ${publishedRate}%`,
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
    tone: 'text-amber-600 bg-amber-500/10',
  },
  {
    label: '用户治理',
    meta: `${counts.value.bannedUsers || 0} 个封禁`,
    route: '/admin/users',
    icon: Users,
    tone: 'text-sky-600 bg-sky-500/10',
  },
  {
    label: '团队协作',
    meta: `${counts.value.teams || 0} 个团队`,
    route: '/admin/teams',
    icon: UserPlus,
    tone: 'text-cyan-600 bg-cyan-500/10',
  },
  {
    label: '课程运营',
    meta: `${counts.value.draftCourses || 0} 个草稿`,
    route: '/admin/courses',
    icon: BookOpen,
    tone: 'text-emerald-600 bg-emerald-500/10',
  },
  {
    label: '轮播投放',
    meta: `${counts.value.activeBanners || 0} 个启用`,
    route: '/admin/banners',
    icon: ImageIcon,
    tone: 'text-orange-600 bg-orange-500/10',
  },
  {
    label: '商业订阅',
    meta: `${counts.value.activeSubscriptions || 0} 个活跃`,
    route: '/admin/subscriptions',
    icon: CreditCard,
    tone: 'text-rose-600 bg-rose-500/10',
  },
  {
    label: '镜像源',
    meta: `${counts.value.mirrorSources || 0} 个来源`,
    route: '/admin/mirror',
    icon: Database,
    tone: 'text-indigo-600 bg-indigo-500/10',
  },
  {
    label: '资源站',
    meta: `${counts.value.manualStations || 0} 个站点`,
    route: '/admin/manual',
    icon: BookOpen,
    tone: 'text-violet-600 bg-violet-500/10',
  },
  {
    label: '系统设置',
    meta: '参数与品牌',
    route: '/admin/settings',
    icon: Settings2,
    tone: 'text-slate-600 bg-slate-500/10',
  },
  {
    label: '全站广播',
    meta: `${broadcastHistory.value.length} 条记录`,
    route: 'broadcast',
    icon: Megaphone,
    tone: 'text-slate-600 bg-slate-500/10',
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

const formatDate = (date?: string) => {
  if (!date) return '-';
  return new Date(date).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getHealthMeta = (level: HealthLevel) => {
  if (level === 'HIGH') return { label: '高压', class: 'text-red-600 bg-red-500/10 border-red-500/20' };
  if (level === 'MEDIUM' || level === 'WATCH') {
    return { label: '关注', class: 'text-amber-600 bg-amber-500/10 border-amber-500/20' };
  }
  return { label: '正常', class: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20' };
};

const getStatusClass = (status?: string) => {
  if (status === 'APPROVED' || status === 'RESOLVED' || status === 'ACTIVE' || status === 'PUBLISHED') {
    return 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20';
  }
  if (status === 'REJECTED' || status === 'BANNED' || status === 'FAILED') {
    return 'text-red-600 bg-red-500/10 border-red-500/20';
  }
  return 'text-amber-600 bg-amber-500/10 border-amber-500/20';
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
  <div class="admin-dashboard flex h-full flex-col overflow-hidden" style="background-color: var(--bg-app)">
    <header class="shrink-0 border-b px-4 py-3 sm:px-6" style="background-color: var(--bg-card); border-color: var(--border-base)">
      <div class="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div class="flex items-center gap-3">
          <span class="panel-icon bg-rose-500/10 text-rose-600">
            <BarChart3 class="h-4 w-4" />
          </span>
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <h1 class="text-base font-black" style="color: var(--text-primary)">平台运营概览</h1>
              <span class="status-pill" :class="platformStatus.class">
                <component :is="platformStatus.icon" class="h-3 w-3" />
                {{ platformStatus.label }}
              </span>
            </div>
            <p class="mt-0.5 text-xs" style="color: var(--text-secondary)">把用户、内容、审核、教学和运营状态放在同一个驾驶舱里。</p>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <button type="button" class="secondary-button" @click="router.push('/admin/audit-logs')">
            <Clock class="h-4 w-4" />
            审计日志
          </button>
          <button type="button" class="secondary-button" @click="showBroadcastModal = true">
            <Megaphone class="h-4 w-4" />
            全站广播
          </button>
          <button type="button" class="primary-button" @click="fetchAdminStats">
            <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': isLoading }" />
            刷新
          </button>
        </div>
      </div>
    </header>

    <main class="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
      <div class="space-y-4">
        <!-- Top Dash Grid: Core Command & KPI metrics (horizontal layout) -->
        <!-- Top Dash Grid: Core Command & KPI metrics (consolidated premium layout) -->
        <section class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <button
            v-for="card in consolidatedCards"
            :key="card.label"
            type="button"
            class="kpi-card group flex flex-col justify-between p-4 text-left border border-[var(--border-base)] bg-[var(--bg-card)] rounded-lg shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[var(--accent)]/55 hover:shadow-md"
            @click="router.push(card.route)"
          >
            <div class="flex items-start justify-between w-full">
              <span class="panel-icon border rounded-lg p-2.5 transition-transform group-hover:scale-110" :class="card.color">
                <component :is="card.icon" class="h-4 w-4" />
              </span>
              <span class="status-pill px-2 py-0.5 text-[10px] font-bold rounded-full scale-95 border-0" :class="card.health.class">
                {{ card.health.label }}
              </span>
            </div>
            <div class="mt-4">
              <p class="text-xs font-bold text-[var(--text-secondary)]">{{ card.label }}</p>
              <p class="text-2xl font-black mt-1 text-[var(--text-primary)]">{{ card.value.toLocaleString() }}</p>
              <p class="text-[11px] text-[var(--text-secondary)] mt-1.5 opacity-80 truncate" :title="card.hint">{{ card.hint }}</p>
            </div>
            <div v-if="card.progress !== null" class="w-full h-1.5 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden mt-3">
              <div class="h-full rounded-full bg-sky-500" :style="{ width: `${card.progress}%` }"></div>
            </div>
          </button>
        </section>

        <!-- Main section layout: Left dynamic widgets / Right operational tools -->
        <section class="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(350px,0.75fr)]">
          <div class="space-y-4">
            <!-- Unified Content Audit & Pipelines Hub -->
            <section class="panel">
              <div class="panel-header border-b pb-2 mb-3" style="border-color: var(--border-base)">
                <div>
                  <h2 class="panel-title flex items-center gap-2">
                    <Workflow class="h-4 w-4 text-[var(--accent)]" />
                    内容审核与流转管线
                  </h2>
                  <p class="panel-subtitle">监控平台内容生产管线并处理待审队列。</p>
                </div>
                <button type="button" class="text-link" @click="router.push('/admin/audits')">
                  进入审核中心
                </button>
              </div>
              
              <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div 
                  v-for="(queue, index) in reviewQueues" 
                  :key="queue.key" 
                  class="flex flex-col border border-[var(--border-base)] rounded-lg p-3 bg-[var(--bg-app)]/20"
                >
                  <!-- Top Part: Pipeline Card equivalent -->
                  <div 
                    v-if="pipelineCards[index]"
                    class="pb-2 border-b border-[var(--border-base)] mb-2.5"
                  >
                    <div class="flex items-center justify-between mb-1.5">
                      <span class="inline-flex items-center gap-1.5 text-xs font-black text-[var(--text-primary)]">
                        <component :is="queue.icon" class="h-4 w-4 text-[var(--accent)]" />
                        {{ queue.label }}
                      </span>
                      <div class="flex items-center gap-1">
                        <span class="text-xs font-black text-[var(--text-primary)]">{{ pipelineCards[index].total }}</span>
                        <span class="text-[9px] text-slate-400">总数</span>
                      </div>
                    </div>
                    
                    <!-- Pipeline Visual Bar -->
                    <div class="flex h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/5 my-1.5">
                      <span class="bg-emerald-500 rounded-l" :style="{ width: getPipelineWidth(pipelineCards[index].approved, pipelineCards[index].total) }"></span>
                      <span class="bg-amber-500" :style="{ width: getPipelineWidth(pipelineCards[index].pending, pipelineCards[index].total) }"></span>
                      <span class="bg-rose-500 rounded-r" :style="{ width: getPipelineWidth(pipelineCards[index].rejected, pipelineCards[index].total) }"></span>
                    </div>
                    
                    <!-- Stats details -->
                    <div class="flex justify-between items-center text-[9px] text-[var(--text-secondary)] font-bold px-0.5">
                      <span class="text-emerald-500">已通过 {{ pipelineCards[index].approved }}</span>
                      <span class="text-amber-500">待审核 {{ pipelineCards[index].pending }}</span>
                      <span class="text-rose-500">已打回 {{ pipelineCards[index].rejected }}</span>
                    </div>
                  </div>

                  <!-- Bottom Part: Queue Item list -->
                  <div class="flex-1 flex flex-col justify-between">
                    <div>
                      <div class="flex items-center justify-between text-[10px] font-bold text-[var(--text-secondary)] mb-2">
                        <span>待审队列</span>
                        <span class="px-1.5 py-0.2 rounded-full text-[9px] font-black" :class="queue.total > 0 ? 'bg-amber-500/10 text-amber-600' : 'bg-slate-100 dark:bg-white/5 text-slate-500'">
                          {{ queue.total }} 个待处理
                        </span>
                      </div>
                      <div class="space-y-1.5">
                        <button
                          v-for="item in queue.items.slice(0, 3)"
                          :key="item.id"
                          type="button"
                          class="w-full flex items-center justify-between gap-3 p-2 border border-[var(--border-base)] rounded-lg bg-[var(--bg-card)] text-left transition-all hover:border-[var(--accent)] hover:bg-[var(--bg-app)]/30 text-xs"
                          @click="router.push(queue.route)"
                        >
                          <span class="truncate font-medium text-[var(--text-primary)]">{{ item.title || item.name || '未命名内容' }}</span>
                          <small class="text-slate-400 shrink-0">{{ formatDate(item.createdAt) }}</small>
                        </button>
                        <div v-if="queue.items.length === 0" class="empty-line py-4 text-center text-xs text-slate-400 border border-dashed border-[var(--border-base)] rounded-lg">
                          暂无待审内容
                        </div>
                      </div>
                    </div>
                    
                    <button 
                      v-if="queue.total > 3"
                      type="button" 
                      class="mt-3 text-center text-[10px] font-black text-[var(--accent)] hover:underline"
                      @click="router.push(queue.route)"
                    >
                      查看全部 {{ queue.total }} 个待审内容...
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <!-- Platform Real-time Activity & Insights Panel (Tabbed) -->
            <div class="panel">
              <div class="panel-header border-b pb-2 mb-3" style="border-color: var(--border-base)">
                <div>
                  <h2 class="panel-title flex items-center gap-2">
                    <Activity class="h-4 w-4 text-[var(--accent)]" />
                    平台动态监测
                  </h2>
                </div>
                <!-- Tabs -->
                <div class="flex items-center gap-1 bg-slate-100 dark:bg-white/5 p-1 rounded-lg">
                  <button 
                    type="button" 
                    class="px-3 py-1 rounded text-xs font-bold transition-all"
                    :class="activeActivityTab === 'assets' ? 'bg-white dark:bg-slate-800 shadow-sm text-[var(--accent)]' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'"
                    @click="activeActivityTab = 'assets'"
                  >
                    最新资产
                  </button>
                  <button 
                    type="button" 
                    class="px-3 py-1 rounded text-xs font-bold transition-all"
                    :class="activeActivityTab === 'courses' ? 'bg-white dark:bg-slate-800 shadow-sm text-[var(--accent)]' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'"
                    @click="activeActivityTab = 'courses'"
                  >
                    热门课程
                  </button>
                  <button 
                    type="button" 
                    class="px-3 py-1 rounded text-xs font-bold transition-all"
                    :class="activeActivityTab === 'feedback' ? 'bg-white dark:bg-slate-800 shadow-sm text-[var(--accent)]' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'"
                    @click="activeActivityTab = 'feedback'"
                  >
                    用户反馈
                  </button>
                </div>
              </div>

              <div class="tab-content mt-3 min-h-[190px]">
                <!-- Tab: Latest Assets -->
                <div v-show="activeActivityTab === 'assets'" class="space-y-3">
                  <div class="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                    <span>最新提交且已处理或待审的资产。</span>
                    <button type="button" class="text-link scale-90" @click="router.push('/admin/audits?tab=assets')">查看资产审核</button>
                  </div>
                  <div class="asset-grid">
                    <button
                      v-for="asset in dashboard?.recentAssets || []"
                      :key="asset.id"
                      type="button"
                      class="asset-row"
                      @click="router.push('/admin/audits?tab=assets')"
                    >
                      <span class="asset-thumb">
                        <img v-if="asset.thumbnail" :src="asset.thumbnail" :alt="asset.title" />
                        <Box v-else class="h-5 w-5 text-slate-400" />
                      </span>
                      <span class="min-w-0 flex-1 text-left">
                        <b>{{ asset.title }}</b>
                        <small>{{ asset.user?.name || asset.user?.email || '未知作者' }}</small>
                      </span>
                      <span class="status-pill" :class="getStatusClass(asset.status)">{{ asset.status }}</span>
                    </button>
                    <div v-if="!dashboard?.recentAssets?.length" class="empty-line w-full col-span-full">暂无资产提交</div>
                  </div>
                </div>

                <!-- Tab: Popular Courses -->
                <div v-show="activeActivityTab === 'courses'" class="space-y-3">
                  <div class="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                    <span>按学员报名人数排序的热门课程排行。</span>
                    <button type="button" class="text-link scale-90" @click="router.push('/admin/courses')">课程管理</button>
                  </div>
                  <div class="list-stack">
                    <button
                      v-for="course in dashboard?.topCourses || []"
                      :key="course.id"
                      type="button"
                      class="list-row"
                      @click="router.push('/admin/courses')"
                    >
                      <div class="min-w-0 flex-1 text-left">
                        <p class="truncate text-xs font-black text-[var(--text-primary)]">{{ course.title }}</p>
                        <p class="mt-1 text-[11px]" style="color: var(--text-secondary)">
                          {{ course.category?.name || '未分类' }} · {{ course._count?.lessons || 0 }} 节课
                        </p>
                      </div>
                      <span class="status-pill border-indigo-500/20 bg-indigo-500/10 text-indigo-600 font-bold">{{ course._count?.enrollments || 0 }} 人报名</span>
                    </button>
                    <div v-if="!dashboard?.topCourses?.length" class="empty-line">暂无课程数据</div>
                  </div>
                </div>

                <!-- Tab: Recent Feedback -->
                <div v-show="activeActivityTab === 'feedback'" class="space-y-3">
                  <div class="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                    <span>最新的用户工单与产品反馈信息。</span>
                    <button type="button" class="text-link scale-90" @click="router.push('/admin/feedback')">处理反馈</button>
                  </div>
                  <div class="list-stack">
                    <button
                      v-for="feedback in dashboard?.recentFeedbacks || []"
                      :key="feedback.id"
                      type="button"
                      class="list-row"
                      @click="router.push('/admin/feedback')"
                    >
                      <div class="min-w-0 flex-1 text-left">
                        <p class="truncate text-xs font-black text-[var(--text-primary)]">{{ feedback.title }}</p>
                        <p class="mt-1 text-[11px]" style="color: var(--text-secondary)">{{ feedback.user?.name || feedback.user?.email || '匿名用户' }} · {{ formatDate(feedback.updatedAt) }}</p>
                      </div>
                      <span class="status-pill" :class="getStatusClass(feedback.status)">{{ feedback.status }}</span>
                    </button>
                    <div v-if="!dashboard?.recentFeedbacks?.length" class="empty-line">暂无用户反馈</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Sidebar Operations & Timelines -->
          <aside class="space-y-4">
            <!-- Operations Tool Center -->
            <div class="panel">
              <div class="panel-header mb-3">
                <h2 class="panel-title flex items-center gap-2">
                  <FileCheck2 class="h-4 w-4 text-[var(--accent)]" />
                  常用运营工具
                </h2>
              </div>
              <div class="quick-grid">
                <button
                  v-for="action in quickActions"
                  :key="action.label"
                  type="button"
                  class="group"
                  @click="openQuickAction(action)"
                >
                  <span :class="action.tone" class="transition-transform group-hover:scale-110">
                    <component :is="action.icon" class="h-4 w-4" />
                  </span>
                  <div class="min-w-0 flex-1">
                    <b class="group-hover:text-[var(--accent)] transition-colors text-xs font-black block truncate">{{ action.label }}</b>
                    <small class="text-[10px] text-slate-400 block truncate">{{ action.meta }}</small>
                  </div>
                </button>
              </div>
            </div>

            <!-- Growth Snapshot -->
            <div class="panel">
              <div class="panel-header mb-3">
                <h2 class="panel-title flex items-center gap-2">
                  <TrendingUp class="h-4 w-4 text-[var(--accent)]" />
                  趋势与成长快照
                </h2>
              </div>
              <div class="growth-grid">
                <div 
                  v-for="item in growthBars" 
                  :key="item.label"
                  class="border border-[var(--border-base)] rounded-lg p-2.5 bg-[var(--bg-app)]/30"
                >
                  <span class="text-[10px] text-slate-500 font-bold block">{{ item.label }}</span>
                  <b class="text-lg font-black block mt-0.5 text-[var(--text-primary)]">{{ item.value }}</b>
                  <div class="w-full h-1 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden mt-2">
                    <em 
                      class="block h-full rounded-full" 
                      :class="item.tone" 
                      :style="{ width: getGrowthWidth(item.value, item.base) }"
                    ></em>
                  </div>
                </div>
              </div>
            </div>

            <!-- System Activity Feed (Tabbed) -->
            <div class="panel">
              <div class="panel-header border-b pb-2 mb-3" style="border-color: var(--border-base)">
                <h2 class="panel-title flex items-center gap-2">
                  <Activity class="h-4 w-4 text-[var(--accent)]" />
                  系统活动流
                </h2>
                <div class="flex items-center gap-1 bg-slate-100 dark:bg-white/5 p-0.5 rounded-lg">
                  <button 
                    type="button" 
                    class="px-2.5 py-0.5 rounded text-[10px] font-bold transition-all"
                    :class="activeFeedTab === 'users' ? 'bg-white dark:bg-slate-800 shadow-sm text-[var(--accent)]' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'"
                    @click="activeFeedTab = 'users'"
                  >
                    新用户
                  </button>
                  <button 
                    type="button" 
                    class="px-2.5 py-0.5 rounded text-[10px] font-bold transition-all"
                    :class="activeFeedTab === 'logs' ? 'bg-white dark:bg-slate-800 shadow-sm text-[var(--accent)]' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'"
                    @click="activeFeedTab = 'logs'"
                  >
                    审计日志
                  </button>
                </div>
              </div>

              <div class="tab-content min-h-[180px]">
                <!-- Tab: Users -->
                <div v-show="activeFeedTab === 'users'" class="space-y-2">
                  <div class="list-stack">
                    <button
                      v-for="user in dashboard?.recentUsers || []"
                      :key="user.id"
                      type="button"
                      class="user-row"
                      @click="router.push('/admin/users')"
                    >
                      <UserAvatar :user="user" size="sm" />
                      <span class="min-w-0 flex-1 text-left">
                        <b>{{ user.name || '未命名用户' }}</b>
                        <small class="truncate block">{{ user.email }}</small>
                      </span>
                      <span class="status-pill scale-90" :class="getStatusClass(user.status)">{{ user.status }}</span>
                    </button>
                    <div v-if="!dashboard?.recentUsers?.length" class="empty-line">暂无新用户</div>
                  </div>
                  <button 
                    v-if="dashboard?.recentUsers?.length"
                    type="button"
                    class="w-full text-center text-[11px] font-bold text-[var(--accent)] hover:underline mt-1"
                    @click="router.push('/admin/users')"
                  >
                    进入用户管理
                  </button>
                </div>

                <!-- Tab: Audit Logs -->
                <div v-show="activeFeedTab === 'logs'" class="space-y-2">
                  <div class="timeline">
                    <button
                      v-for="log in dashboard?.recentAuditLogs || []"
                      :key="log.id"
                      type="button"
                      class="timeline-item"
                      @click="router.push('/admin/audit-logs')"
                    >
                      <span></span>
                      <div class="text-left">
                        <p class="font-bold text-xs">{{ getActionLabel(log.action) }}</p>
                        <small class="block text-slate-500">{{ log.user?.name || log.user?.email || 'System' }} · {{ formatDate(log.createdAt) }}</small>
                      </div>
                    </button>
                    <div v-if="!dashboard?.recentAuditLogs?.length" class="empty-line">暂无审计记录</div>
                  </div>
                  <button 
                    v-if="dashboard?.recentAuditLogs?.length"
                    type="button"
                    class="w-full text-center text-[11px] font-bold text-[var(--accent)] hover:underline mt-1"
                    @click="router.push('/admin/audit-logs')"
                  >
                    查看全部审计日志
                  </button>
                </div>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>

    <!-- Broadcast Modal -->
    <div v-if="showBroadcastModal" class="modal-shell">
      <div class="modal-panel">
        <div class="panel-header">
          <div class="flex items-center gap-3">
            <span class="panel-icon bg-rose-500/10 text-rose-600"><Megaphone class="h-4 w-4" /></span>
            <div>
              <h2 class="panel-title">全站广播</h2>
              <p class="panel-subtitle">向所有用户发送系统通知，重要活动和维护公告都从这里发布。</p>
            </div>
          </div>
          <button type="button" class="secondary-button" @click="showBroadcastModal = false">关闭</button>
        </div>

        <div class="segmented">
          <button type="button" :class="{ active: broadcastTab === 'send' }" @click="switchBroadcastTab('send')">
            <Send class="h-4 w-4" />
            发布广播
          </button>
          <button type="button" :class="{ active: broadcastTab === 'history' }" @click="switchBroadcastTab('history')">
            <Clock class="h-4 w-4" />
            历史记录
          </button>
        </div>

        <div v-if="broadcastTab === 'send'" class="space-y-3">
          <label class="field-label">标题</label>
          <input v-model="broadcastForm.title" class="field-input" type="text" placeholder="例如：端午活动上线通知" />
          <label class="field-label">内容</label>
          <textarea v-model="broadcastForm.content" class="field-input resize-none" rows="5" placeholder="写清楚影响范围、操作指引和跳转入口"></textarea>
          <label class="field-label">跳转链接</label>
          <input v-model="broadcastForm.link" class="field-input" type="text" placeholder="/academy 或 https://..." />
          <button type="button" class="primary-button w-full justify-center" :disabled="isBroadcasting" @click="handleSendBroadcast">
            <RefreshCw v-if="isBroadcasting" class="h-4 w-4 animate-spin" />
            <Send v-else class="h-4 w-4" />
            {{ isBroadcasting ? '发送中' : '立即发布' }}
          </button>
        </div>

        <div v-else class="max-h-[460px] space-y-2 overflow-y-auto">
          <div v-if="isHistoryLoading" class="empty-line">正在加载广播历史...</div>
          <article v-for="broadcast in broadcastHistory" v-else :key="broadcast.id" class="broadcast-row">
            <div class="min-w-0">
              <p class="truncate text-xs font-black">{{ broadcast.title }}</p>
              <p class="mt-1 line-clamp-2 text-xs" style="color: var(--text-secondary)">{{ broadcast.content }}</p>
              <small>{{ formatDate(broadcast.createdAt) }} <span v-if="broadcast.link">· {{ broadcast.link }}</span></small>
            </div>
            <button type="button" class="danger-icon" title="撤回广播" @click="handleDeleteBroadcast(broadcast.id)">
              <Trash2 class="h-4 w-4" />
            </button>
          </article>
          <div v-if="!isHistoryLoading && broadcastHistory.length === 0" class="empty-line">暂无广播记录</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.panel,
.kpi-card,
.health-card,
.queue-card {
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
  box-shadow: var(--shadow-enterprise);
}

.command-overview {
  display: grid;
  grid-template-columns: minmax(320px, 0.9fr) minmax(0, 1.1fr);
  align-items: stretch;
  gap: 0.875rem;
}

.command-hero,
.control-card,
.pipeline-card {
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
  box-shadow: var(--shadow-enterprise);
}

.command-hero {
  display: flex;
  min-height: 280px;
  flex-direction: column;
  justify-content: space-between;
  gap: 0.75rem;
  overflow: hidden;
  border-left: 4px solid var(--accent);
  padding: 1rem;
}

.command-hero-main {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.85rem;
}

.eyebrow {
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 900;
  text-transform: uppercase;
}

.command-hero h2 {
  margin-top: 0.2rem;
  color: var(--text-primary);
  font-size: 20px;
  font-weight: 900;
  line-height: 1.15;
}

.command-hero p {
  margin-top: 0.3rem;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.55;
}

.command-hero-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.5rem;
}

.command-hero-stats div {
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-app);
  padding: 0.6rem 0.65rem;
}

:global(.dark) .command-hero-stats div {
  background: rgba(255, 255, 255, 0.035);
}

.command-hero-stats span,
.command-hero-stats strong {
  display: block;
}

.command-hero-stats span {
  color: var(--text-secondary);
  font-size: 10px;
  font-weight: 800;
}

.command-hero-stats strong {
  margin-top: 0.25rem;
  color: var(--text-primary);
  font-size: 20px;
  font-weight: 900;
}

.command-control-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.65rem;
}

.control-card {
  display: flex;
  min-height: 154px;
  flex-direction: column;
  justify-content: space-between;
  padding: 0.85rem;
  text-align: left;
  transition:
    border-color 0.2s ease,
    transform 0.2s ease,
    background-color 0.2s ease;
}

.control-card:hover {
  border-color: rgba(var(--accent-rgb), 0.35);
  background: color-mix(in srgb, var(--bg-card) 86%, var(--accent-subtle));
  transform: translateY(-1px);
}

.control-value {
  color: var(--text-primary);
  font-size: 23px;
  font-weight: 900;
  line-height: 1;
}

.control-card p {
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 900;
}

.control-card small {
  display: block;
  margin-top: 0.25rem;
  color: var(--text-secondary);
  font-size: 11px;
  line-height: 1.35;
}

.control-track {
  height: 5px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.2);
}

.control-track span {
  display: block;
  height: 100%;
  border: 0;
  border-radius: inherit;
}

.kpi-card,
.health-card {
  padding: 0.9rem;
  text-align: left;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease,
    transform 0.2s ease;
}

.kpi-card:hover,
.health-card:hover {
  border-color: rgba(var(--accent-rgb), 0.35);
  background: color-mix(in srgb, var(--bg-card) 90%, var(--accent-subtle));
  transform: translateY(-1px);
}

.kpi-card {
  min-height: 116px;
}

.health-card {
  min-height: 70px;
}

.panel {
  padding: 1rem;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.panel-title {
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 900;
}

.panel-subtitle {
  margin-top: 0.2rem;
  color: var(--text-secondary);
  font-size: 12px;
}

.panel-icon {
  display: inline-flex;
  height: 34px;
  width: 34px;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
}

.primary-button,
.secondary-button,
.text-link {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 800;
  transition: all 0.2s ease;
}

.primary-button {
  min-height: 34px;
  padding: 0 0.85rem;
  color: white;
  background: var(--accent);
}

.primary-button:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.secondary-button {
  min-height: 34px;
  border: 1px solid var(--border-base);
  padding: 0 0.85rem;
  color: var(--text-secondary);
  background: var(--bg-app);
}

.secondary-button:hover,
.text-link:hover {
  color: var(--accent);
  border-color: rgba(var(--accent-rgb), 0.35);
}

.text-link {
  color: var(--accent);
  font-size: 12px;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  white-space: nowrap;
  border: 1px solid;
  border-radius: 999px;
  padding: 0.16rem 0.5rem;
  font-size: 10px;
  font-weight: 900;
}

.queue-card {
  padding: 0.8rem;
}

.pipeline-panel {
  overflow: hidden;
  padding: 1rem 1.05rem;
}

.pipeline-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
}

.pipeline-card {
  min-height: 104px;
  padding: 0.85rem;
  text-align: left;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease,
    transform 0.2s ease;
}

.pipeline-card:hover {
  border-color: rgba(var(--accent-rgb), 0.35);
  background: color-mix(in srgb, var(--bg-card) 88%, var(--accent-subtle));
  transform: translateY(-1px);
}

.pipeline-card strong {
  color: var(--text-primary);
  font-size: 18px;
  font-weight: 900;
}

.pipeline-stack {
  display: flex;
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.18);
  margin-top: 0.8rem;
}

.pipeline-stack span {
  min-width: 2px;
}

.pipeline-meta {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.4rem;
  margin-top: 0.7rem;
  color: var(--text-secondary);
  font-size: 10px;
  font-weight: 800;
}

.queue-item,
.list-row,
.asset-row,
.user-row,
.timeline-item,
.broadcast-row {
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-app);
}

.queue-item,
.list-row,
.asset-row,
.user-row,
.timeline-item {
  width: 100%;
  text-align: left;
  transition: border-color 0.2s ease, background-color 0.2s ease;
}

.queue-item:hover,
.list-row:hover,
.asset-row:hover,
.user-row:hover,
.timeline-item:hover {
  border-color: rgba(var(--accent-rgb), 0.35);
  background: rgba(var(--accent-rgb), 0.06);
}

.queue-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.55rem;
  font-size: 12px;
}

.queue-item small,
.asset-row small,
.user-row small,
.broadcast-row small,
.timeline-item small {
  color: var(--text-secondary);
  font-size: 10px;
}

.list-stack {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.list-row,
.asset-row,
.user-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem;
}

.asset-grid {
  display: grid;
  gap: 0.6rem;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
}

.asset-thumb {
  display: inline-flex;
  height: 40px;
  width: 48px;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 8px;
  background: rgba(148, 163, 184, 0.12);
}

.asset-thumb img {
  height: 100%;
  width: 100%;
  object-fit: cover;
}

.asset-row b,
.user-row b {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-primary);
  font-size: 12px;
}

.growth-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.6rem;
}

.growth-grid div {
  border: 1px solid var(--border-base);
  border-radius: 8px;
  padding: 0.7rem;
  background: var(--bg-app);
}

.growth-grid span {
  display: block;
  color: var(--text-secondary);
  font-size: 11px;
}

.growth-grid b {
  display: block;
  margin-top: 0.25rem;
  color: var(--text-primary);
  font-size: 20px;
}

.growth-grid i {
  display: block;
  height: 5px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.18);
  margin-top: 0.6rem;
}

.growth-grid em {
  display: block;
  height: 100%;
  border-radius: inherit;
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
}

.quick-grid button {
  display: grid;
  min-height: 68px;
  grid-template-columns: 34px minmax(0, 1fr);
  grid-template-rows: auto auto;
  align-items: center;
  gap: 0.15rem 0.55rem;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  color: var(--text-secondary);
  background: var(--bg-app);
  padding: 0.65rem;
  text-align: left;
}

.quick-grid button:hover {
  color: var(--accent);
  border-color: rgba(var(--accent-rgb), 0.35);
  background: color-mix(in srgb, var(--bg-app) 90%, var(--accent-subtle));
}

.quick-grid button > span {
  display: inline-flex;
  grid-row: span 2;
  height: 34px;
  width: 34px;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
}

.quick-grid b {
  overflow: hidden;
  color: var(--text-primary);
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 900;
}

.quick-grid small {
  overflow: hidden;
  color: var(--text-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 10px;
  font-weight: 700;
}

.timeline {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.timeline-item {
  display: grid;
  grid-template-columns: 12px minmax(0, 1fr);
  gap: 0.6rem;
  padding: 0.65rem;
}

.timeline-item > span {
  margin-top: 0.2rem;
  height: 8px;
  width: 8px;
  border-radius: 999px;
  background: var(--accent);
}

.timeline-item p {
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 900;
}

.empty-line {
  border: 1px dashed var(--border-base);
  border-radius: 8px;
  padding: 1rem;
  color: var(--text-secondary);
  text-align: center;
  font-size: 12px;
}

.modal-shell {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(15, 23, 42, 0.55);
  backdrop-filter: blur(8px);
}

.modal-panel {
  width: min(680px, 100%);
  max-height: 92vh;
  overflow: hidden auto;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
  padding: 1rem;
  box-shadow: 0 24px 70px rgba(15, 23, 42, 0.28);
}

.segmented {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.4rem;
  margin-bottom: 1rem;
  border-radius: 8px;
  background: var(--bg-app);
  padding: 0.35rem;
}

.segmented button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  border-radius: 8px;
  padding: 0.55rem;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 900;
}

.segmented button.active {
  color: var(--accent);
  background: var(--bg-card);
  box-shadow: 0 1px 8px rgba(15, 23, 42, 0.08);
}

.field-label {
  display: block;
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 900;
}

.field-input {
  width: 100%;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-app);
  padding: 0.7rem 0.8rem;
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
}

.field-input:focus {
  border-color: rgba(var(--accent-rgb), 0.55);
  box-shadow: 0 0 0 3px rgba(var(--accent-rgb), 0.12);
}

.broadcast-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem;
}

.danger-icon {
  display: inline-flex;
  height: 32px;
  width: 32px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  color: #ef4444;
}

.danger-icon:hover {
  background: rgba(239, 68, 68, 0.1);
}

@media (max-width: 1280px) {
  .command-overview {
    grid-template-columns: 1fr;
  }

  .command-control-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .command-control-grid,
  .pipeline-grid {
    grid-template-columns: 1fr;
  }

  .command-hero-stats {
    grid-template-columns: 1fr;
  }

  .quick-grid {
    grid-template-columns: 1fr;
  }
}
</style>
