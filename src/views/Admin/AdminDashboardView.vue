<script setup lang="ts">
import { computed, onMounted, ref, watch, type Component } from 'vue';
import { useRouter } from 'vue-router';
import {
  AlertTriangle,
  BookOpen,
  Box,
  CheckCircle2,
  Clock,
  CreditCard,
  Database,
  Image as ImageIcon,
  Layers,
  Megaphone,
  RefreshCw,
  Settings2,
  ShieldCheck,
  UserPlus,
  Users,
  Video,
  Zap,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from '@/utils/feedbackBridge';
import api from '@/utils/api';
import { getApiErrorMessage, logError } from '@/utils/error';
import { createJsonHeaders, parseSSEStream, readFetchErrorMessage } from '@/utils/aiHelpers';
import { preferences } from '@/utils/preferences';
import { useSystemStore } from '@/stores/system';
import type { Asset, User } from '@/types';

// UI components
import AdminHeader from './components/AdminHeader.vue';
import Button from '@/components/ui/Button.vue';
import Badge from '@/components/ui/Badge.vue';
import AdminDashboardStats, { type AdminStatCard } from './components/AdminDashboardStats.vue';
import AdminDashboardCharts from './components/AdminDashboardCharts.vue';
import AdminDashboardActivity from './components/AdminDashboardActivity.vue';
import AdminDashboardBroadcast from './components/AdminDashboardBroadcast.vue';

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
  isOffline?: boolean;
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
const systemStore = useSystemStore();
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
const aiPrompt = ref('');
const isAiGenerating = ref(false);

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

const consolidatedCards = computed<AdminStatCard[]>(() => {
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

watch(showBroadcastModal, (isOpen) => {
  if (isOpen) {
    broadcastTab.value = 'send';
    broadcastForm.value = { title: '', content: '', link: '' };
    aiPrompt.value = '';
    isAiGenerating.value = false;
  }
});

watch(broadcastTab, (newTab) => {
  if (newTab === 'history') {
    fetchBroadcastHistory();
  }
});

const handleAiGenerate = async () => {
  if (!aiPrompt.value.trim()) {
    ElMessage.warning('请输入生成公告的需求，例如：本周末系统升级维护');
    return;
  }

  isAiGenerating.value = true;
  broadcastForm.value.title = '';
  broadcastForm.value.content = '';

  const sId = `broadcast-session-${Date.now()}`;

  const cleanupSession = async () => {
    try {
      await api.delete(`/api/projects/ai-chat/history?sessionId=${sId}`);
      window.dispatchEvent(new CustomEvent('ai-chat-history-updated'));
    } catch (cleanupErr) {
      logError(cleanupErr, {
        operation: 'admin.aiAnnouncementCleanup',
        component: 'AdminDashboardView',
      });
    }
  };

  try {
    const siteContext = [
      '【本网站实时数据与背景】',
      `- 网站名称：${systemStore.settings.PLATFORM_NAME || '3D社区-Blender俱乐部'}`,
      `- 网站副标题：${systemStore.settings.PLATFORM_SUBTITLE || '一起学 Blender，创造无限可能'}`,
      `- 注册用户总数：${counts.value.users || '暂无'}`,
      `- 课程总数：${counts.value.courses || '暂无'}`,
      `- 3D 模型资产总数：${counts.value.assets || '暂无'}`,
    ].join('\n');

    const fullPrompt = `请根据我的需求为我撰写一封全站广播公告。
${siteContext}

公告生成需求：${aiPrompt.value.trim()}

写作与格式要求：
1. 你的第一行输出必须是公告标题，必须且只能使用以下格式：
【标题：公告标题内容】
2. 从第二行开始是公告正文内容，请与标题行空一行。
3. 公告正文内容请字数不限，可以极其详尽、长篇幅地展开叙述所有的升级细则、规则、操作指引或相关背景。
4. 正文可以使用标准的 Markdown 语法（如加粗 **text**、无序/有序列表、小标题、Emoji 等）来进行排版与强调，以确保内容结构清晰、条理分明、专业大气。`;

    const clientRunId = `run-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const response = await fetch('/api/projects/ai-chat', {
      method: 'POST',
      headers: createJsonHeaders(),
      body: JSON.stringify({
        messages: [{ role: 'user', content: fullPrompt }],
        modelId: preferences.getAiSpriteModelId() || undefined,
        context: {
          path: '/admin',
          title: systemStore.settings.PLATFORM_NAME || document.title || '管理后台',
        },
        sessionId: sId,
        sessionTitle: '全站公告生成',
        mode: 'chat',
        clientRunId,
      }),
    });

    if (!response.ok) {
      const errMsg = await readFetchErrorMessage(response);
      throw new Error(errMsg);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('流式读取不受支持');

    let fullText = '';

    await parseSSEStream(
      reader,
      (payload) => {
        if (payload.error) {
          ElMessage.error(`AI 生成错误: ${payload.error}`);
          return;
        }
        if (payload.text) {
          fullText += payload.text;

          // Robust line-based parsing for real-time streaming
          const trimmedFullText = fullText.trimStart();
          const lines = trimmedFullText.split('\n');

          if (lines.length > 0) {
            const firstLine = lines[0];
            if (firstLine.startsWith('【标题：')) {
              // Strip "【标题：" and optional trailing "】" (only if the line actually ends with "】")
              let titleVal = firstLine.slice(4);
              if (titleVal.endsWith('】')) {
                titleVal = titleVal.slice(0, -1);
              }
              broadcastForm.value.title = titleVal.trim();

              // Content is everything after the first line
              broadcastForm.value.content = lines.slice(1).join('\n').trimStart();
            } else {
              // If it doesn't start with the expected prefix, put everything in content
              broadcastForm.value.title = '';
              broadcastForm.value.content = trimmedFullText;
            }
          }
        }
      },
      async () => {
        isAiGenerating.value = false;
        ElMessage.success('公告生成成功！');
        aiPrompt.value = '';
        await cleanupSession();
      },
      async (err) => {
        logError(err, { operation: 'admin.aiAnnouncementSSE', component: 'AdminDashboardView' });
        ElMessage.error(err.message || '生成中途发生错误');
        isAiGenerating.value = false;
        await cleanupSession();
      },
    );
  } catch (error) {
    logError(error, { operation: 'admin.aiAnnouncementGenerate', component: 'AdminDashboardView' });
    ElMessage.error(error instanceof Error ? error.message : 'AI 生成失败，请稍后重试');
    isAiGenerating.value = false;
    await cleanupSession();
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
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(getApiErrorMessage(error, '撤回失败'));
    }
  }
};

const handleToggleBroadcastOffline = async (id: string) => {
  try {
    const { data } = await api.post(`/api/admin/broadcasts/${id}/toggle-offline`);
    ElMessage.success(data.message || '操作成功');
    fetchBroadcastHistory();
    fetchAdminStats();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '操作失败'));
  }
};

const getHealthMeta = (level: HealthLevel) => {
  if (level === 'HIGH') return { label: '高压' };
  if (level === 'MEDIUM' || level === 'WATCH') {
    return { label: '关注' };
  }
  return { label: '正常' };
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
  <div class="admin-dashboard mobile-adaptive flex flex-1 min-h-0 flex-col overflow-hidden">
    <main class="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
      <div class="space-y-3">
        <!-- Ultra-Compact Single Row Header -->
        <AdminHeader
          title="平台运营概览"
          subtitle="把用户、内容、审核、教学和运营状态放在同一个驾驶舱里"
          :show-search="false"
        >
          <template #title-badge>
            <Badge :variant="platformStatus.variant" dot>
              {{ platformStatus.label }}
            </Badge>
          </template>

          <Button
            variant="secondary"
            size="sm"
            :icon="Clock"
            @click="router.push('/admin/audit-logs')"
            class="!h-7.5 !text-xs !px-2.5"
          >
            审计日志
          </Button>
          <Button
            variant="secondary"
            size="sm"
            :icon="Megaphone"
            @click="showBroadcastModal = true"
            class="!h-7.5 !text-xs !px-2.5"
          >
            全站广播
          </Button>
          <Button
            variant="primary"
            size="sm"
            :icon="RefreshCw"
            :loading="isLoading"
            @click="fetchAdminStats"
            class="!h-7.5 !text-xs !px-2.5"
          >
            刷新
          </Button>
        </AdminHeader>
        <AdminDashboardStats :cards="consolidatedCards" @navigate="router.push($event)" />

        <AdminDashboardBroadcast
          :quick-actions="quickActions"
          :show-broadcast-modal="showBroadcastModal"
          :broadcast-tab="broadcastTab"
          :is-broadcasting="isBroadcasting"
          :is-history-loading="isHistoryLoading"
          :broadcast-history="broadcastHistory"
          :broadcast-form="broadcastForm"
          :ai-prompt="aiPrompt"
          :is-ai-generating="isAiGenerating"
          @update:show-broadcast-modal="showBroadcastModal = $event"
          @update:broadcast-tab="broadcastTab = $event"
          @update:broadcast-form="broadcastForm = $event"
          @update:ai-prompt="aiPrompt = $event"
          @open-quick-action="openQuickAction"
          @ai-generate="handleAiGenerate"
          @send-broadcast="handleSendBroadcast"
          @delete-broadcast="handleDeleteBroadcast"
          @toggle-broadcast-offline="handleToggleBroadcastOffline"
        />

        <!-- Main section layout: Balanced asymmetric grid -->
        <section class="grid gap-3 xl:grid-cols-[1.25fr_0.75fr] grid-cols-1">
          <AdminDashboardCharts
            :review-queues="reviewQueues"
            :pipeline-cards="pipelineCards"
            :growth-bars="growthBars"
            @navigate="router.push($event)"
          />
          <AdminDashboardActivity
            :recent-assets="dashboard?.recentAssets || []"
            :top-courses="dashboard?.topCourses || []"
            :recent-feedbacks="dashboard?.recentFeedbacks || []"
            :recent-users="dashboard?.recentUsers || []"
            :recent-audit-logs="dashboard?.recentAuditLogs || []"
            :active-activity-tab="activeActivityTab"
            :active-feed-tab="activeFeedTab"
            :get-action-label="getActionLabel"
            @update:active-activity-tab="activeActivityTab = $event"
            @update:active-feed-tab="activeFeedTab = $event"
            @navigate="router.push($event)"
          />
        </section>
      </div>
    </main>
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

@media (max-width: 767px) {
  .asset-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
  }
}

@media (max-width: 420px) {
  .asset-grid {
    grid-template-columns: repeat(1, minmax(0, 1fr));
  }
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
