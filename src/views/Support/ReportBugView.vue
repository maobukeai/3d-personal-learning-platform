<script setup lang="ts">
import { formatDateTime as formatDate } from '@/utils/format';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  AlertCircle,
  ArrowUpRight,
  Bug,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  FileImage,
  Filter,
  History,
  Image as ImageIcon,
  Inbox,
  Loader2,
  MessageSquare,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Sparkles,
  X,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import api, { getAssetUrl } from '@/utils/api';
import Modal from '@/components/ui/Modal.vue';
import UiButton from '@/components/ui/Button.vue';
import UiInput from '@/components/ui/Input.vue';
import { getApiErrorMessage } from '@/utils/error';
import type { Feedback } from '@/types';
import PageHeader from '@/components/PageHeader.vue';
import Card from '@/components/ui/Card.vue';
import Tabs from '@/components/ui/Tabs.vue';
import Badge from '@/components/ui/Badge.vue';

type FeedbackType = Feedback['type'];
type FeedbackPriority = Feedback['priority'];
type FeedbackStatus = Feedback['status'];
type TabKey = 'submit' | 'history';
type AnyFilter<T extends string> = 'ALL' | T;

interface FeedbackStats {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
  highOpen: number;
  withReply: number;
  latest?: Pick<Feedback, 'id' | 'title' | 'status' | 'updatedAt' | 'repliedAt'> | null;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  byPriority: Record<string, number>;
}

const route = useRoute();
const router = useRouter();

const fileInput = ref<HTMLInputElement | null>(null);
const activeTab = ref<TabKey>('submit');
const feedbacks = ref<Feedback[]>([]);
const activeFeedback = ref<Feedback | null>(null);
const isLoadingHistory = ref(false);
const isLoadingDetail = ref(false);
const isSubmitting = ref(false);
const isUploading = ref(false);
const previewUrl = ref('');
const previewDialogVisible = ref(false);
const previewImageUrl = ref('');
const statusFilter = ref<AnyFilter<FeedbackStatus>>('ALL');
const typeFilter = ref<AnyFilter<FeedbackType>>('ALL');
const priorityFilter = ref<AnyFilter<FeedbackPriority>>('ALL');
const searchQuery = ref('');

const stats = ref<FeedbackStats>({
  total: 0,
  open: 0,
  inProgress: 0,
  resolved: 0,
  closed: 0,
  highOpen: 0,
  withReply: 0,
  latest: null,
  byStatus: {},
  byType: {},
  byPriority: {},
});

const bugForm = ref({
  type: 'Bug' as FeedbackType,
  title: '',
  description: '',
  expected: '',
  actual: '',
  steps: '',
  impact: '',
  pageUrl: typeof window !== 'undefined' ? window.location.href : '',
  priority: 'MEDIUM' as FeedbackPriority,
  attachmentUrl: '',
});

const typeOptions: Array<{ value: FeedbackType; label: string; hint: string }> = [
  { value: 'Bug', label: '缺陷', hint: '页面、接口或流程异常' },
  { value: 'Feature', label: '功能', hint: '希望新增或增强的能力' },
  { value: 'UI', label: '体验', hint: '布局、交互、视觉问题' },
  { value: 'Other', label: '其他', hint: '账号、数据或无法归类的问题' },
];

const priorityOptions: Array<{ value: FeedbackPriority; label: string; hint: string }> = [
  { value: 'LOW', label: '低', hint: '不影响主要流程' },
  { value: 'MEDIUM', label: '中', hint: '影响效率，需要排期' },
  { value: 'HIGH', label: '高', hint: '阻塞使用或数据风险' },
];

const statusOptions: Array<{ value: AnyFilter<FeedbackStatus>; label: string }> = [
  { value: 'ALL', label: '全部' },
  { value: 'OPEN', label: '待处理' },
  { value: 'IN_PROGRESS', label: '处理中' },
  { value: 'RESOLVED', label: '已解决' },
  { value: 'CLOSED', label: '已关闭' },
];

const activeTickets = computed(() => stats.value.open + stats.value.inProgress);
const resolutionRate = computed(() =>
  stats.value.total
    ? Math.round(((stats.value.resolved + stats.value.closed) / stats.value.total) * 100)
    : 0,
);

const filteredFeedbacks = computed(() => {
  const keyword = searchQuery.value.trim().toLowerCase();
  return feedbacks.value.filter((item) => {
    const matchesStatus = statusFilter.value === 'ALL' || item.status === statusFilter.value;
    const matchesType = typeFilter.value === 'ALL' || item.type === typeFilter.value;
    const matchesPriority =
      priorityFilter.value === 'ALL' || item.priority === priorityFilter.value;
    const matchesSearch =
      !keyword ||
      item.title.toLowerCase().includes(keyword) ||
      item.description.toLowerCase().includes(keyword);

    return matchesStatus && matchesType && matchesPriority && matchesSearch;
  });
});

const latestActivityText = computed(() => {
  const latest = stats.value.latest;
  if (!latest) return '暂无工单动态';
  return `${statusLabel(latest.status)} · ${formatRelativeDate(latest.updatedAt)}`;
});

const getBadgeVariant = (label: string) => {
  if (
    label === '全部' ||
    label === '正常' ||
    label === '稳定' ||
    label === '高效' ||
    label === '无'
  )
    return 'success';
  if (label === '关注' || label === '积压') return 'warning';
  if (label === '紧急') return 'danger';
  return 'primary';
};

const consolidatedCards = computed(() => {
  return [
    {
      label: '全部工单',
      value: stats.value.total,
      hint: `已解决/关闭 ${stats.value.resolved + stats.value.closed} 个工单`,
      icon: Inbox,
      color: 'text-sky-600 bg-sky-500/10 border-sky-500/20',
      health: { label: '全部', variant: 'success' as const },
    },
    {
      label: '进行中',
      value: activeTickets.value,
      hint: `待处理 ${stats.value.open} · 处理中 ${stats.value.inProgress}`,
      icon: CircleDashed,
      color: 'text-amber-600 bg-amber-500/10 border-amber-500/20',
      health:
        activeTickets.value > 5
          ? { label: '积压', variant: 'warning' as const }
          : { label: '稳定', variant: 'success' as const },
    },
    {
      label: '解决率',
      value: `${resolutionRate.value}%`,
      hint: `已解决 ${stats.value.resolved} · 已关闭 ${stats.value.closed}`,
      icon: CheckCircle2,
      color: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20',
      health:
        resolutionRate.value > 80
          ? { label: '高效', variant: 'success' as const }
          : { label: '一般', variant: 'primary' as const },
    },
    {
      label: '高优先级',
      value: stats.value.highOpen,
      hint: '当前高优先级待处理工单',
      icon: AlertCircle,
      color: 'text-red-600 bg-red-500/10 border-red-500/20',
      health:
        stats.value.highOpen > 0
          ? { label: '紧急', variant: 'danger' as const }
          : { label: '无', variant: 'success' as const },
    },
  ];
});

const tabOptions = computed(() => [
  {
    label: '提交反馈',
    value: 'submit',
    icon: Bug,
  },
  {
    label: '我的工单',
    value: 'history',
    icon: History,
    badge: activeTickets.value || undefined,
  },
]);

const statusLabel = (status: string) => {
  const map: Record<string, string> = {
    OPEN: '待处理',
    IN_PROGRESS: '处理中',
    RESOLVED: '已解决',
    CLOSED: '已关闭',
  };
  return map[status] || status;
};

const typeLabel = (type: string) => typeOptions.find((item) => item.value === type)?.label || type;
const priorityLabel = (priority: string) =>
  priorityOptions.find((item) => item.value === priority)?.label || priority;

const statusTone = (status: string) => ({
  'tone-red': status === 'OPEN',
  'tone-amber': status === 'IN_PROGRESS',
  'tone-green': status === 'RESOLVED',
  'tone-slate': status === 'CLOSED',
});

const priorityTone = (priority: string) => ({
  'tone-green': priority === 'LOW',
  'tone-amber': priority === 'MEDIUM',
  'tone-red': priority === 'HIGH',
});

const progressPercent = (status: string) => {
  const map: Record<string, number> = {
    OPEN: 25,
    IN_PROGRESS: 55,
    RESOLVED: 82,
    CLOSED: 100,
  };
  return map[status] || 20;
};

const formatRelativeDate = (value?: string | null) => {
  if (!value) return '无记录';
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.floor(diff / 60000));
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
};

const ticketNo = (id?: string) => (id ? `#${id.slice(0, 8).toUpperCase()}` : '#NEW');

const buildDescription = () => {
  const sections = [
    ['问题描述', bugForm.value.description],
    ['复现步骤', bugForm.value.steps],
    ['期望结果', bugForm.value.expected],
    ['实际结果', bugForm.value.actual],
    ['影响范围', bugForm.value.impact],
    ['页面链接', bugForm.value.pageUrl],
  ].filter(([, value]) => String(value || '').trim());

  return sections.map(([label, value]) => `【${label}】\n${String(value).trim()}`).join('\n\n');
};

const refreshStats = async () => {
  try {
    const response = await api.get<FeedbackStats>('/api/feedback/stats');
    stats.value = response.data;
  } catch (error) {
    console.error('Fetch feedback stats failed:', error);
  }
};

const fetchMyFeedbacks = async () => {
  isLoadingHistory.value = true;
  try {
    const response = await api.get<Feedback[]>('/api/feedback/my', { params: { limit: 120 } });
    feedbacks.value = response.data;
    if (!activeFeedback.value && response.data.length) {
      activeFeedback.value = response.data[0] || null;
    } else if (activeFeedback.value) {
      activeFeedback.value =
        response.data.find((item) => item.id === activeFeedback.value?.id) ||
        response.data[0] ||
        null;
    }
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '无法加载反馈历史'));
  } finally {
    isLoadingHistory.value = false;
  }
};

const refreshAll = async () => {
  await Promise.all([refreshStats(), fetchMyFeedbacks()]);
};

const selectFeedback = async (item: Feedback) => {
  activeFeedback.value = item;
  isLoadingDetail.value = true;
  try {
    const response = await api.get<Feedback>(`/api/feedback/${item.id}`);
    activeFeedback.value = response.data;
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '无法加载工单详情'));
  } finally {
    isLoadingDetail.value = false;
  }
};

const setTab = (tab: TabKey) => {
  activeTab.value = tab;
  router.replace({ query: { ...route.query, tab } });
};

const triggerFileInput = () => fileInput.value?.click();

const handleFileUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    ElMessage.error('附件不能超过 5MB');
    return;
  }

  isUploading.value = true;
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await api.post<{ url: string }>('/api/feedback/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    bugForm.value.attachmentUrl = response.data.url;
    previewUrl.value = getAssetUrl(response.data.url);
    ElMessage.success('附件已上传');
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '上传失败'));
  } finally {
    isUploading.value = false;
    target.value = '';
  }
};

const removeAttachment = () => {
  bugForm.value.attachmentUrl = '';
  previewUrl.value = '';
};

const resetForm = () => {
  bugForm.value = {
    type: 'Bug',
    title: '',
    description: '',
    expected: '',
    actual: '',
    steps: '',
    impact: '',
    pageUrl: typeof window !== 'undefined' ? window.location.href : '',
    priority: 'MEDIUM',
    attachmentUrl: '',
  };
  previewUrl.value = '';
};

const handleSubmit = async () => {
  const title = bugForm.value.title.trim();
  const description = buildDescription();

  if (title.length < 3) {
    ElMessage.warning('请填写至少 3 个字的标题');
    return;
  }

  if (description.length < 10) {
    ElMessage.warning('请补充问题描述或复现信息');
    return;
  }

  isSubmitting.value = true;
  try {
    const response = await api.post<Feedback>('/api/feedback', {
      type: bugForm.value.type,
      title,
      description,
      priority: bugForm.value.priority,
      attachmentUrl: bugForm.value.attachmentUrl,
    });

    ElMessage.success('反馈已进入处理队列');
    resetForm();
    await refreshAll();
    activeFeedback.value = response.data;
    setTab('history');
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '提交失败'));
  } finally {
    isSubmitting.value = false;
  }
};

const updateMyStatus = async (item: Feedback, status: 'OPEN' | 'CLOSED') => {
  const verb = status === 'CLOSED' ? '关闭' : '重新打开';
  try {
    await ElMessageBox.confirm(`确认${verb}工单「${item.title}」吗？`, `${verb}工单`, {
      confirmButtonText: verb,
      cancelButtonText: '取消',
      type: status === 'CLOSED' ? 'warning' : 'info',
    });
    const response = await api.put<Feedback>(`/api/feedback/${item.id}/status`, { status });
    ElMessage.success(`工单已${verb}`);
    activeFeedback.value = response.data;
    await refreshAll();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(getApiErrorMessage(error, `${verb}失败`));
    }
  }
};

const openPreview = (url: string) => {
  previewImageUrl.value = getAssetUrl(url);
  previewDialogVisible.value = true;
};

watch(
  () => route.query.tab,
  (tab) => {
    activeTab.value = tab === 'history' ? 'history' : 'submit';
  },
  { immediate: true },
);

onMounted(refreshAll);
</script>

<template>
  <div class="support-workbench flex flex-1 min-h-0 flex-col overflow-hidden">
    <main class="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 scrollbar-hide w-full">
      <PageHeader title="问题反馈" subtitle="支持中心" variant="card">
        <template #center>
          <div class="flex flex-wrap items-center gap-1.5 ml-2">
            <Badge variant="info">{{ latestActivityText }}</Badge>
          </div>
        </template>

        <UiButton
          variant="secondary"
          :icon="RefreshCw"
          :loading="isLoadingHistory"
          size="sm"
          @click="refreshAll"
        >
          刷新
        </UiButton>
        <UiButton variant="primary" :icon="Plus" size="sm" @click="setTab('submit')"
          >新建工单</UiButton
        >
      </PageHeader>

      <!-- Top KPI metrics grid (Horizontal compact) -->
      <section class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <Card
          v-for="card in consolidatedCards"
          :key="card.label"
          hoverable
          glow
          class="group !p-2 px-2.5"
        >
          <div class="flex items-center justify-between w-full gap-3">
            <!-- Left: Icon & Info -->
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
                {{ card.value }}
              </span>
              <Badge :variant="getBadgeVariant(card.health.label)">
                {{ card.health.label }}
              </Badge>
            </div>
          </div>
        </Card>
      </section>

      <!-- Workbench Toolbar -->
      <Card padding="sm" class="workbench-toolbar-card">
        <div class="toolbar-top flex items-center justify-between">
          <div class="overflow-x-auto scrollbar-hide shrink-0 max-w-full">
            <Tabs v-model="activeTab" :options="tabOptions" size="sm" />
          </div>
        </div>
      </Card>

      <div v-if="activeTab === 'submit'" class="submit-layout">
        <Card class="form-panel">
          <div class="panel-head">
            <div>
              <p class="eyebrow">Ticket {{ ticketNo() }}</p>
              <h2>描述问题</h2>
            </div>
            <span class="status-pill tone-amber">草稿</span>
          </div>

          <div class="compact-grid">
            <div class="form-group">
              <label class="form-label">反馈类型</label>
              <div class="relative w-full">
                <select v-model="bugForm.type" class="custom-select">
                  <option v-for="item in typeOptions" :key="item.value" :value="item.value">
                    {{ item.label }} · {{ item.hint }}
                  </option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">优先级</label>
              <div class="relative w-full">
                <select v-model="bugForm.priority" class="custom-select">
                  <option v-for="item in priorityOptions" :key="item.value" :value="item.value">
                    {{ item.label }} · {{ item.hint }}
                  </option>
                </select>
              </div>
            </div>
          </div>

          <UiInput
            v-model="bugForm.title"
            label="工单标题"
            placeholder="例如：学习路线页面保存后步骤顺序错乱"
            :glass="false"
          />

          <div class="form-group">
            <label class="form-label">问题描述</label>
            <textarea
              v-model="bugForm.description"
              class="custom-textarea"
              rows="6"
              maxlength="1500"
              placeholder="请详细描述问题发生的页面、具体现象，或者在此处附带复现步骤、期望与实际结果，方便管理员快速定位。"
            ></textarea>
          </div>

          <div class="compact-grid">
            <UiInput
              v-model="bugForm.impact"
              label="影响范围"
              placeholder="例如：影响团队任务提交 / 仅自己可见"
              :glass="false"
            />
            <UiInput
              v-model="bugForm.pageUrl"
              label="页面链接"
              placeholder="https://..."
              :glass="false"
            />
          </div>

          <div class="upload-row">
            <input
              ref="fileInput"
              type="file"
              class="hidden-input"
              accept="image/*"
              @change="handleFileUpload"
            />
            <button v-if="!previewUrl" type="button" class="upload-box" @click="triggerFileInput">
              <Loader2 v-if="isUploading" class="spinning" />
              <FileImage v-else />
              <span>{{ isUploading ? '上传中...' : '上传截图' }}</span>
              <small>PNG / JPG / WebP，最大 5MB</small>
            </button>
            <div v-else class="attachment-preview">
              <img :src="previewUrl" alt="" />
              <div>
                <strong>截图已附加</strong>
                <span>管理员可直接预览定位问题</span>
              </div>
              <button type="button" class="icon-btn danger" @click="removeAttachment"><X /></button>
            </div>
          </div>

          <div class="form-actions">
            <UiButton variant="secondary" :icon="RotateCcw" @click="resetForm">重置</UiButton>
            <UiButton
              variant="primary"
              :icon="Send"
              :disabled="isSubmitting"
              :loading="isSubmitting"
              @click="handleSubmit"
            >
              {{ isSubmitting ? '提交中' : '提交工单' }}
            </UiButton>
          </div>
        </Card>

        <aside class="assist-panel">
          <Card>
            <div class="side-title">
              <Sparkles />
              <h3>处理流程</h3>
            </div>
            <div
              class="process-timeline relative pl-4 mt-2 before:content-[''] before:absolute before:left-[6px] before:top-2 before:bottom-2 before:w-[2px] before:bg-[var(--border-base)]"
            >
              <div class="timeline-item relative pb-4">
                <span
                  class="absolute left-[-16px] top-1 w-2.5 h-2.5 rounded-full border border-[var(--border-base)] bg-[var(--bg-card)] flex items-center justify-center text-[8px] font-bold text-[var(--accent)] shrink-0"
                  >1</span
                >
                <h4 class="text-xs font-bold text-[var(--text-primary)] pl-2">提交接收</h4>
                <p class="text-[11px] text-[var(--text-muted)] mt-1 pl-2">
                  系统记录问题截图、关联链接与工单优先级，并即时推送到后台管理员队列。
                </p>
              </div>
              <div class="timeline-item relative pb-4">
                <span
                  class="absolute left-[-16px] top-1 w-2.5 h-2.5 rounded-full border border-[var(--border-base)] bg-[var(--bg-card)] flex items-center justify-center text-[8px] font-bold text-[var(--accent)] shrink-0"
                  >2</span
                >
                <h4 class="text-xs font-bold text-[var(--text-primary)] pl-2">分析与处理</h4>
                <p class="text-[11px] text-[var(--text-muted)] mt-1 pl-2">
                  管理员根据您填写的重现信息与链接进行分析定位，并更新工单解决进度。
                </p>
              </div>
              <div class="timeline-item relative">
                <span
                  class="absolute left-[-16px] top-1 w-2.5 h-2.5 rounded-full border border-[var(--border-base)] bg-[var(--bg-card)] flex items-center justify-center text-[8px] font-bold text-[var(--accent)] shrink-0"
                  >3</span
                >
                <h4 class="text-xs font-bold text-[var(--text-primary)] pl-2">确认与回访</h4>
                <p class="text-[11px] text-[var(--text-muted)] mt-1 pl-2">
                  您将在“我的工单”和通知中心收到反馈，确认已解决后即可自主关闭工单。
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div class="side-title">
              <Filter />
              <h3>提交质量</h3>
            </div>
            <div class="quality-list space-y-2 mt-2">
              <div class="flex items-center justify-between text-xs py-1 border-b border-base/40">
                <span class="text-[var(--text-secondary)]">标题长度 (≥3字)</span>
                <span
                  class="font-mono text-[11px]"
                  :class="
                    bugForm.title.trim().length >= 3
                      ? 'text-emerald-500 font-bold'
                      : 'text-amber-500'
                  "
                >
                  {{ bugForm.title.trim().length }}/3
                </span>
              </div>
              <div class="flex items-center justify-between text-xs py-1 border-b border-base/40">
                <span class="text-[var(--text-secondary)]">问题描述 (≥15字)</span>
                <span
                  class="font-mono text-[11px]"
                  :class="
                    bugForm.description.trim().length >= 15
                      ? 'text-emerald-500 font-bold'
                      : 'text-amber-500'
                  "
                >
                  {{ bugForm.description.trim().length }}/15
                </span>
              </div>
              <div class="flex items-center justify-between text-xs py-1 border-b border-base/40">
                <span class="text-[var(--text-secondary)]">页面链接关联</span>
                <Badge
                  :variant="bugForm.pageUrl.trim() ? 'success' : 'warning'"
                  size="sm"
                  class="!px-1.5 !py-0.5 text-[10px]"
                >
                  {{ bugForm.pageUrl.trim() ? '已关联' : '无链接' }}
                </Badge>
              </div>
              <div class="flex items-center justify-between text-xs py-1">
                <span class="text-[var(--text-secondary)]">图片截图附件</span>
                <Badge
                  :variant="bugForm.attachmentUrl ? 'success' : 'primary'"
                  size="sm"
                  class="!px-1.5 !py-0.5 text-[10px]"
                >
                  {{ bugForm.attachmentUrl ? '已上传' : '无附件' }}
                </Badge>
              </div>
            </div>
          </Card>

          <Card class="mini-feed">
            <div class="side-title">
              <MessageSquare />
              <h3>最近工单</h3>
            </div>
            <button
              v-for="item in feedbacks.slice(0, 4)"
              :key="item.id"
              type="button"
              class="mini-ticket"
              @click="
                setTab('history');
                selectFeedback(item);
              "
            >
              <span>{{ ticketNo(item.id) }}</span>
              <strong>{{ item.title }}</strong>
              <small
                >{{ statusLabel(item.status) }} · {{ formatRelativeDate(item.updatedAt) }}</small
              >
            </button>
            <div v-if="feedbacks.length === 0" class="empty-mini">还没有历史反馈</div>
          </Card>
        </aside>
      </div>

      <div v-else class="history-layout">
        <Card class="ticket-list-panel !p-0">
          <div class="toolbar">
            <UiInput
              v-model="searchQuery"
              :icon="Search"
              placeholder="搜索标题或描述"
              :glass="false"
              class="min-w-[200px]"
            />
            <select v-model="statusFilter" class="custom-select toolbar-select">
              <option v-for="item in statusOptions" :key="item.value" :value="item.value">
                {{ item.label }}
              </option>
            </select>
            <select v-model="typeFilter" class="custom-select toolbar-select">
              <option value="ALL">全部类型</option>
              <option v-for="item in typeOptions" :key="item.value" :value="item.value">
                {{ item.label }}
              </option>
            </select>
            <select v-model="priorityFilter" class="custom-select toolbar-select">
              <option value="ALL">全部优先级</option>
              <option v-for="item in priorityOptions" :key="item.value" :value="item.value">
                {{ item.label }}
              </option>
            </select>
          </div>

          <div v-if="isLoadingHistory" class="loading-state">
            <Loader2 class="spinning" />
            正在同步工单
          </div>

          <div v-else-if="filteredFeedbacks.length === 0" class="empty-state">
            <Inbox />
            <strong>没有匹配的工单</strong>
            <span>调整筛选条件，或新建一个反馈工单。</span>
            <UiButton variant="primary" :icon="Plus" @click="setTab('submit')">新建工单</UiButton>
          </div>

          <div v-else class="ticket-list">
            <button
              v-for="item in filteredFeedbacks"
              :key="item.id"
              type="button"
              class="ticket-row"
              :class="{ selected: activeFeedback?.id === item.id }"
              @click="selectFeedback(item)"
            >
              <div class="row-main">
                <span class="ticket-id">{{ ticketNo(item.id) }}</span>
                <strong>{{ item.title }}</strong>
                <small>{{ typeLabel(item.type) }} · {{ formatDate(item.updatedAt) }}</small>
              </div>
              <div class="row-meta">
                <span class="status-pill" :class="statusTone(item.status)">{{
                  statusLabel(item.status)
                }}</span>
                <span class="status-pill" :class="priorityTone(item.priority)"
                  >P{{ priorityLabel(item.priority) }}</span
                >
              </div>
              <ChevronRight />
            </button>
          </div>
        </Card>

        <Card class="detail-panel">
          <div v-if="!activeFeedback" class="empty-state detail-empty">
            <MessageSquare />
            <strong>选择一个工单</strong>
            <span>右侧会显示状态进度、官方回复和附件。</span>
          </div>

          <template v-else>
            <div class="detail-head">
              <div>
                <p class="eyebrow">{{ ticketNo(activeFeedback.id) }}</p>
                <h2>{{ activeFeedback.title }}</h2>
              </div>
              <span class="status-pill" :class="statusTone(activeFeedback.status)">
                {{ statusLabel(activeFeedback.status) }}
              </span>
            </div>

            <div class="progress-track">
              <span :style="{ width: `${progressPercent(activeFeedback.status)}%` }"></span>
            </div>

            <div class="detail-meta">
              <div>
                <span>类型</span>
                <strong>{{ typeLabel(activeFeedback.type) }}</strong>
              </div>
              <div>
                <span>优先级</span>
                <strong>{{ priorityLabel(activeFeedback.priority) }}</strong>
              </div>
              <div>
                <span>提交</span>
                <strong>{{ formatDate(activeFeedback.createdAt) }}</strong>
              </div>
              <div>
                <span>更新</span>
                <strong>{{ formatDate(activeFeedback.updatedAt) }}</strong>
              </div>
            </div>

            <div v-if="isLoadingDetail" class="inline-loading">
              <Loader2 class="spinning" />
              正在刷新详情
            </div>

            <section class="detail-section">
              <h3>反馈内容</h3>
              <p>{{ activeFeedback.description }}</p>
            </section>

            <section v-if="activeFeedback.adminReply" class="detail-section official-reply">
              <div class="reply-head">
                <h3>官方回复</h3>
                <span>{{ formatDate(activeFeedback.repliedAt) }}</span>
              </div>
              <p>{{ activeFeedback.adminReply }}</p>
            </section>

            <UiButton
              v-if="activeFeedback.attachmentUrl"
              variant="secondary"
              :icon="ImageIcon"
              @click="openPreview(activeFeedback.attachmentUrl)"
            >
              查看附件截图
              <ArrowUpRight />
            </UiButton>

            <div class="detail-actions">
              <UiButton
                v-if="activeFeedback.status !== 'CLOSED'"
                variant="secondary"
                :icon="CheckCircle2"
                @click="updateMyStatus(activeFeedback, 'CLOSED')"
              >
                我已确认，关闭
              </UiButton>
              <UiButton
                v-else
                variant="secondary"
                :icon="RotateCcw"
                @click="updateMyStatus(activeFeedback, 'OPEN')"
              >
                重新打开
              </UiButton>
              <UiButton variant="primary" :icon="Plus" @click="setTab('submit')">继续反馈</UiButton>
            </div>
          </template>
        </Card>
      </div>
    </main>

    <Modal
      :show="previewDialogVisible"
      title="附件预览"
      size="xl"
      @close="previewDialogVisible = false"
    >
      <img :src="previewImageUrl" alt="" class="preview-image" />
    </Modal>
  </div>
</template>

<style scoped>
.support-workbench {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: transparent !important;
  color: var(--text-primary);
}

.form-actions,
.detail-actions,
.side-title,
.attachment-preview,
.attachment-link,
.inline-loading {
  display: flex;
  align-items: center;
}

.title-icon svg,
button svg {
  width: 16px;
  height: 16px;
}

h1,
h2,
h3,
p {
  margin: 0;
}

h1 {
  font-size: 20px;
  font-weight: 900;
}

h2 {
  font-size: 17px;
  font-weight: 900;
}

.eyebrow {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0;
}

button,
input,
select,
textarea {
  font: inherit;
}

button {
  border: 0;
  cursor: pointer;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

.form-actions {
  gap: 8px;
  margin-top: 12px;
}

.detail-actions {
  gap: 8px;
}

.primary-btn,
.ghost-btn,
.icon-btn {
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 0 12px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 900;
}

.primary-btn {
  background: var(--accent);
  color: white;
}

.ghost-btn {
  border: 1px solid var(--border-base);
  background: var(--bg-elevated);
  color: var(--text-secondary);
}

.icon-btn {
  width: 32px;
  padding: 0;
  background: var(--bg-app);
  color: var(--text-muted);
}

.icon-btn.danger {
  color: #dc2626;
}

.detail-meta span,
.mini-ticket span,
.ticket-id {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 900;
}

.submit-layout,
.history-layout {
  display: grid;
  gap: 12px;
}

.submit-layout {
  grid-template-columns: minmax(0, 1fr) 330px;
}

.history-layout {
  grid-template-columns: minmax(420px, 0.92fr) minmax(360px, 1fr);
}

.form-panel {
  display: grid;
  gap: 16px;
  padding: 20px;
  padding-bottom: 28px;
}

.panel-head,
.detail-head,
.reply-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.compact-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

/* Premium standard labels and inputs */
.form-group {
  display: flex;
  flex-direction: column;
  text-align: left;
}

.form-label {
  display: block;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 8px;
  margin-left: 4px;
  color: var(--text-secondary);
  transition: color 0.2s ease;
}

.form-group:focus-within .form-label {
  color: var(--accent);
}

.custom-select,
.custom-textarea {
  width: 100%;
  min-width: 0;
  border: 1px solid var(--border-base);
  border-radius: 12px;
  outline: none;
  background: var(--bg-card);
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 500;
  transition: all 0.3s ease;
}

.custom-select {
  height: 48px;
  padding: 0 16px;
  appearance: none;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23888888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right 16px center;
  background-size: 16px;
  padding-right: 40px;
  cursor: pointer;
}

.custom-select:focus,
.custom-textarea:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 15%, transparent);
}

.custom-textarea {
  padding: 14px 16px;
  line-height: 1.6;
  resize: vertical;
  min-height: 140px;
}

.toolbar-select {
  height: 38px;
  min-width: 112px;
  width: auto;
  border-radius: 8px;
  font-size: 12px;
  padding: 0 28px 0 12px;
  background-position: right 10px center;
  background-size: 12px;
}

.hidden-input {
  display: none;
}

.upload-row {
  display: grid;
}

.upload-box,
.attachment-preview {
  min-height: 80px;
  border: 1.5px dashed var(--border-base);
  border-radius: 12px;
  background: var(--bg-card);
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.upload-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 14px;
  color: var(--text-secondary);
  cursor: pointer;
}

.upload-box:hover {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 4%, var(--bg-card));
  color: var(--text-primary);
}

.upload-box svg {
  width: 22px;
  height: 22px;
  color: var(--accent);
  transition: transform 0.3s ease;
}

.upload-box:hover svg {
  transform: translateY(-2px);
}

.upload-box span {
  font-size: 12px;
  font-weight: 700;
}

.upload-box small {
  color: var(--text-muted);
  font-size: 10px;
}

.attachment-preview {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 14px;
  border-style: solid;
  border-color: var(--border-base);
}

.attachment-preview img {
  width: 56px;
  height: 56px;
  border-radius: 8px;
  object-fit: cover;
  border: 1px solid var(--border-base);
}

.attachment-preview div {
  min-width: 0;
  flex: 1;
}

.attachment-preview strong,
.attachment-preview span {
  display: block;
}

.attachment-preview strong {
  font-size: 13px;
}

.attachment-preview span {
  color: var(--text-muted);
  font-size: 11px;
}

.assist-panel {
  display: grid;
  align-content: start;
  gap: 12px;
  padding: 0;
}

.side-title {
  gap: 7px;
  margin-bottom: 10px;
}

.side-title svg {
  width: 15px;
  height: 15px;
  color: var(--accent);
}

.side-title h3 {
  font-size: 13px;
  font-weight: 900;
}

/* Process Timeline styling */
.process-timeline {
  margin-top: 8px;
}

.timeline-item {
  position: relative;
  text-align: left;
}

.timeline-item h4 {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-primary);
}

.timeline-item p {
  margin: 0;
  font-size: 11px;
  line-height: 1.5;
  color: var(--text-secondary);
}

/* Quality Checklist styling */
.quality-list {
  display: flex;
  flex-direction: column;
}

.quality-list div {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.mini-feed {
  display: grid;
  gap: 7px;
}

.mini-ticket {
  display: grid;
  gap: 4px;
  padding: 12px;
  border: 1px solid var(--border-base);
  border-radius: 12px;
  background: var(--bg-card);
  color: var(--text-primary);
  text-align: left;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.mini-ticket:hover {
  transform: translateY(-2px);
  border-color: var(--accent);
  box-shadow: var(--shadow-card-hover);
  background: color-mix(in srgb, var(--accent) 3%, var(--bg-card));
}

.mini-ticket strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}

.mini-ticket small,
.empty-mini {
  color: var(--text-muted);
  font-size: 11px;
}

.ticket-list-panel {
  display: flex;
  flex-direction: column;
}

.toolbar {
  display: flex;
  gap: 8px;
  padding: 10px;
  border-bottom: 1px solid var(--border-base);
  flex-wrap: wrap;
}

.search-box {
  min-width: 250px;
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 38px;
  padding: 0 10px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-app);
}

.search-box svg {
  width: 15px;
  height: 15px;
  color: var(--text-muted);
}

.search-box input {
  height: auto;
  padding: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
}

.ticket-list {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.ticket-row {
  width: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto 18px;
  align-items: center;
  gap: 10px;
  padding: 11px 12px;
  border-bottom: 1px solid var(--border-base);
  background: transparent;
  color: var(--text-primary);
  text-align: left;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.ticket-row:hover,
.ticket-row.selected {
  background: color-mix(in srgb, var(--accent) 7%, transparent);
}

.ticket-row > svg {
  width: 15px;
  height: 15px;
  color: var(--text-muted);
}

.row-main {
  min-width: 0;
  display: grid;
  gap: 3px;
}

.row-main strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}

.row-main small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-muted);
  font-size: 11px;
}

.row-meta {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.status-pill {
  min-height: 24px;
  display: inline-flex;
  align-items: center;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 900;
  white-space: nowrap;
}

.tone-green {
  color: #047857;
  background: rgba(16, 185, 129, 0.12);
}

.tone-red {
  color: #dc2626;
  background: rgba(239, 68, 68, 0.12);
}

.tone-amber {
  color: #b45309;
  background: rgba(245, 158, 11, 0.14);
}

.tone-slate {
  color: var(--text-secondary);
  background: var(--bg-app);
}

.detail-panel {
  padding: 14px;
}

.detail-head h2 {
  margin-top: 3px;
}

/* Premium progress bar */
.progress-track {
  height: 6px;
  margin: 16px 0;
  border-radius: 999px;
  background: var(--border-base);
}

.progress-track span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(
    90deg,
    var(--accent) 0%,
    color-mix(in srgb, var(--accent) 70%, white) 100%
  );
  box-shadow: 0 0 8px color-mix(in srgb, var(--accent) 40%, transparent);
}

.detail-meta {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 12px;
}

.detail-meta div {
  min-width: 0;
  padding: 9px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-elevated);
}

.detail-meta strong {
  display: block;
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}

.inline-loading {
  gap: 7px;
  margin-bottom: 10px;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 900;
}

.detail-section {
  margin-top: 10px;
  padding: 12px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-elevated);
}

.detail-section h3 {
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 900;
}

.detail-section p {
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.7;
  white-space: pre-wrap;
}

.official-reply {
  border-color: color-mix(in srgb, var(--accent) 28%, var(--border-base));
}

.reply-head span {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 900;
}

.attachment-link {
  width: 100%;
  min-height: 38px;
  justify-content: center;
  gap: 8px;
  margin-top: 10px;
  border-radius: 8px;
  background: var(--bg-app);
  color: var(--accent);
  font-size: 12px;
  font-weight: 900;
}

.detail-actions {
  margin-top: 12px;
  justify-content: flex-end;
  flex-wrap: wrap;
}

.loading-state,
.empty-state {
  min-height: 240px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--text-muted);
  text-align: center;
}

.loading-state svg,
.empty-state svg {
  width: 28px;
  height: 28px;
  color: var(--accent);
}

.empty-state strong {
  color: var(--text-primary);
  font-size: 14px;
}

.empty-state span {
  max-width: 280px;
  font-size: 12px;
}

.detail-empty {
  height: 100%;
}

.spinning {
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.preview-image {
  display: block;
  width: 100%;
  max-height: 72vh;
  object-fit: contain;
  border-radius: 8px;
}

@media (max-width: 1180px) {
  .submit-layout,
  .history-layout {
    grid-template-columns: 1fr;
    overflow: auto;
  }

  .assist-panel,
  .detail-panel {
    min-height: 360px;
  }
}

@media (max-width: 720px) {
  .panel-head,
  .detail-head {
    flex-direction: column;
    align-items: stretch;
  }

  .form-actions button,
  .detail-actions button {
    flex: 1;
  }

  .compact-grid,
  .detail-meta {
    grid-template-columns: 1fr;
  }

  .ticket-row {
    grid-template-columns: 1fr;
  }

  .row-meta {
    justify-content: flex-start;
  }
}
</style>
