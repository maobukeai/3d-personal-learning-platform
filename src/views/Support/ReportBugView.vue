<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  AlertCircle,
  Bug,
  CheckCircle2,
  CircleDashed,
  History,
  Inbox,
  Plus,
  RefreshCw,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import api, { getAssetUrl } from '@/utils/api';
import Modal from '@/components/ui/Modal.vue';
import UiButton from '@/components/ui/Button.vue';
import { getApiErrorMessage, logError } from '@/utils/error';
import type { Feedback, FeedbackType, FeedbackPriority, FeedbackStatus } from '@/types';
import PageHeader from '@/components/PageHeader.vue';
import Badge from '@/components/ui/Badge.vue';
import BugReportForm, { type BugFormData } from './components/BugReportForm.vue';
import BugHistoryPanel from './components/BugHistoryPanel.vue';
import BugStatsCards, { type BugStatCard } from './components/BugStatsCards.vue';
import BugWorkbenchToolbar from './components/BugWorkbenchToolbar.vue';
import BugAssistPanel from './components/BugAssistPanel.vue';
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

const bugForm = ref<BugFormData>({
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

const latestActivityText = computed(() => {
  const latest = stats.value.latest;
  if (!latest) return '暂无工单动态';
  return `${statusLabel(latest.status)} · ${formatRelativeDate(latest.updatedAt)}`;
});

const consolidatedCards = computed<BugStatCard[]>(() => {
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

const formatRelativeDate = (value?: string | null) => {
  if (!value) return '无记录';
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.floor(diff / 60000));
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
};

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
    logError(error, { operation: 'feedback.fetchStats', component: 'ReportBugView' });
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
  <div class="support-workbench mobile-adaptive flex flex-1 min-h-0 flex-col overflow-hidden">
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

      <BugStatsCards :cards="consolidatedCards" />

      <BugWorkbenchToolbar
        :active-tab="activeTab"
        :tab-options="tabOptions"
        @update:active-tab="setTab"
      />

      <div v-if="activeTab === 'submit'" class="submit-layout">
        <BugReportForm
          v-model="bugForm"
          :preview-url="previewUrl"
          :is-uploading="isUploading"
          :is-submitting="isSubmitting"
          :type-options="typeOptions"
          :priority-options="priorityOptions"
          @submit="handleSubmit"
          @reset="resetForm"
          @file-change="handleFileUpload"
          @remove-attachment="removeAttachment"
        />

        <BugAssistPanel
          :feedbacks="feedbacks"
          :title="bugForm.title"
          :description="bugForm.description"
          :page-url="bugForm.pageUrl"
          :attachment-url="bugForm.attachmentUrl"
          @select="
            setTab('history');
            selectFeedback($event);
          "
        />
      </div>

      <BugHistoryPanel
        v-else
        v-model:search-query="searchQuery"
        v-model:status-filter="statusFilter"
        v-model:type-filter="typeFilter"
        v-model:priority-filter="priorityFilter"
        :feedbacks="feedbacks"
        :active-feedback="activeFeedback"
        :is-loading-history="isLoadingHistory"
        :is-loading-detail="isLoadingDetail"
        :status-options="statusOptions"
        :type-options="typeOptions"
        :priority-options="priorityOptions"
        @select="selectFeedback"
        @update-status="updateMyStatus"
        @preview="openPreview"
        @continue="setTab('submit')"
      />
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
:deep(.support-workbench) {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: transparent !important;
  color: var(--text-primary);
}

:deep(.form-actions),
:deep(.detail-actions),
:deep(.side-title),
:deep(.attachment-preview),
:deep(.attachment-link),
:deep(.inline-loading) {
  display: flex;
  align-items: center;
}

:deep(.title-icon svg),
:deep(button svg) {
  width: 16px;
  height: 16px;
}

:deep(h1),
:deep(h2),
:deep(h3),
:deep(p) {
  margin: 0;
}

:deep(h1) {
  font-size: 20px;
  font-weight: 900;
}

:deep(h2) {
  font-size: 17px;
  font-weight: 900;
}

:deep(.eyebrow) {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0;
}

:deep(button),
:deep(input),
:deep(select),
:deep(textarea) {
  font: inherit;
}

:deep(button) {
  border: 0;
  cursor: pointer;
}

:deep(button:disabled) {
  cursor: not-allowed;
  opacity: 0.58;
}

:deep(.form-actions) {
  gap: 8px;
  margin-top: 12px;
}

:deep(.detail-actions) {
  gap: 8px;
}

:deep(.primary-btn),
:deep(.ghost-btn),
:deep(.icon-btn) {
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

:deep(.primary-btn) {
  background: var(--accent);
  color: white;
}

:deep(.ghost-btn) {
  border: 1px solid var(--border-base);
  background: var(--bg-elevated);
  color: var(--text-secondary);
}

:deep(.icon-btn) {
  width: 32px;
  padding: 0;
  background: var(--bg-app);
  color: var(--text-muted);
}

:deep(.icon-btn.danger) {
  color: #dc2626;
}

:deep(.detail-meta span),
:deep(.mini-ticket span),
:deep(.ticket-id) {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 900;
}

:deep(.submit-layout),
:deep(.history-layout) {
  display: grid;
  gap: 12px;
}

:deep(.submit-layout) {
  grid-template-columns: minmax(0, 1fr) 330px;
}

:deep(.history-layout) {
  grid-template-columns: minmax(420px, 0.92fr) minmax(360px, 1fr);
}

:deep(.form-panel) {
  display: grid;
  gap: 16px;
  padding: 20px;
  padding-bottom: 28px;
}

:deep(.panel-head),
:deep(.detail-head),
:deep(.reply-head) {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

:deep(.compact-grid) {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

/* Premium standard labels and inputs */
:deep(.form-group) {
  display: flex;
  flex-direction: column;
  text-align: left;
}

:deep(.form-label) {
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

:deep(.form-group:focus-within .form-label) {
  color: var(--accent);
}

:deep(.custom-select .el-select__wrapper) {
  width: 100%;
  height: 48px;
  min-height: 48px;
  border: 1px solid var(--border-base);
  border-radius: 12px;
  background: var(--bg-card);
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 500;
  box-shadow: none !important;
  transition: all 0.3s ease;
}

:deep(.custom-select .el-select__wrapper.is-focused) {
  border-color: var(--accent) !important;
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 15%, transparent) !important;
}

:deep(.custom-textarea) {
  width: 100%;
  min-width: 0;
  border: 1px solid var(--border-base);
  border-radius: 12px;
  outline: none;
  background: var(--bg-card);
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 500;
  padding: 14px 16px;
  line-height: 1.6;
  resize: vertical;
  min-height: 140px;
  transition: all 0.3s ease;
}

:deep(.custom-textarea:focus) {
  border-color: var(--accent);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 15%, transparent);
}

:deep(.toolbar-select) {
  height: 38px;
  min-width: 112px;
  width: auto;
  border-radius: 8px;
  font-size: 12px;
  padding: 0 28px 0 12px;
  background-position: right 10px center;
  background-size: 12px;
}

:deep(.hidden-input) {
  display: none;
}

:deep(.upload-row) {
  display: grid;
}

:deep(.upload-box),
:deep(.attachment-preview) {
  min-height: 80px;
  border: 1.5px dashed var(--border-base);
  border-radius: 12px;
  background: var(--bg-card);
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

:deep(.upload-box) {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 14px;
  color: var(--text-secondary);
  cursor: pointer;
}

:deep(.upload-box:hover) {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 4%, var(--bg-card));
  color: var(--text-primary);
}

:deep(.upload-box svg) {
  width: 22px;
  height: 22px;
  color: var(--accent);
  transition: transform 0.3s ease;
}

:deep(.upload-box:hover svg) {
  transform: translateY(-2px);
}

:deep(.upload-box span) {
  font-size: 12px;
  font-weight: 700;
}

:deep(.upload-box small) {
  color: var(--text-muted);
  font-size: 10px;
}

:deep(.attachment-preview) {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 14px;
  border-style: solid;
  border-color: var(--border-base);
}

:deep(.attachment-preview img) {
  width: 56px;
  height: 56px;
  border-radius: 8px;
  object-fit: cover;
  border: 1px solid var(--border-base);
}

:deep(.attachment-preview div) {
  min-width: 0;
  flex: 1;
}

:deep(.attachment-preview strong),
:deep(.attachment-preview span) {
  display: block;
}

:deep(.attachment-preview strong) {
  font-size: 13px;
}

:deep(.attachment-preview span) {
  color: var(--text-muted);
  font-size: 11px;
}

:deep(.assist-panel) {
  display: grid;
  align-content: start;
  gap: 12px;
  padding: 0;
}

:deep(.side-title) {
  gap: 7px;
  margin-bottom: 10px;
}

:deep(.side-title svg) {
  width: 15px;
  height: 15px;
  color: var(--accent);
}

:deep(.side-title h3) {
  font-size: 13px;
  font-weight: 900;
}

/* Process Timeline styling */
:deep(.process-timeline) {
  margin-top: 8px;
}

:deep(.timeline-item) {
  position: relative;
  text-align: left;
}

:deep(.timeline-item h4) {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-primary);
}

:deep(.timeline-item p) {
  margin: 0;
  font-size: 11px;
  line-height: 1.5;
  color: var(--text-secondary);
}

/* Quality Checklist styling */
:deep(.quality-list) {
  display: flex;
  flex-direction: column;
}

:deep(.quality-list div) {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

:deep(.mini-feed) {
  display: grid;
  gap: 7px;
}

:deep(.mini-ticket) {
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

:deep(.mini-ticket:hover) {
  transform: translateY(-2px);
  border-color: var(--accent);
  box-shadow: var(--shadow-card-hover);
  background: color-mix(in srgb, var(--accent) 3%, var(--bg-card));
}

:deep(.mini-ticket strong) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}

:deep(.mini-ticket small),
:deep(.empty-mini) {
  color: var(--text-muted);
  font-size: 11px;
}

:deep(.ticket-list-panel) {
  display: flex;
  flex-direction: column;
}

:deep(.toolbar) {
  display: flex;
  gap: 8px;
  padding: 10px;
  border-bottom: 1px solid var(--border-base);
  flex-wrap: wrap;
}

:deep(.search-box) {
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

:deep(.search-box svg) {
  width: 15px;
  height: 15px;
  color: var(--text-muted);
}

:deep(.search-box input) {
  height: auto;
  padding: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
}

:deep(.ticket-list) {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

:deep(.ticket-row) {
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

:deep(.ticket-row:hover),
:deep(.ticket-row.selected) {
  background: color-mix(in srgb, var(--accent) 7%, transparent);
}

:deep(.ticket-row > svg) {
  width: 15px;
  height: 15px;
  color: var(--text-muted);
}

:deep(.row-main) {
  min-width: 0;
  display: grid;
  gap: 3px;
}

:deep(.row-main strong) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}

:deep(.row-main small) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-muted);
  font-size: 11px;
}

:deep(.row-meta) {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

:deep(.status-pill) {
  min-height: 24px;
  display: inline-flex;
  align-items: center;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 900;
  white-space: nowrap;
}

:deep(.tone-green) {
  color: #047857;
  background: rgba(16, 185, 129, 0.12);
}

:deep(.tone-red) {
  color: #dc2626;
  background: rgba(239, 68, 68, 0.12);
}

:deep(.tone-amber) {
  color: #b45309;
  background: rgba(245, 158, 11, 0.14);
}

:deep(.tone-slate) {
  color: var(--text-secondary);
  background: var(--bg-app);
}

:deep(.detail-panel) {
  padding: 14px;
}

:deep(.detail-head h2) {
  margin-top: 3px;
}

/* Premium progress bar */
:deep(.progress-track) {
  height: 6px;
  margin: 16px 0;
  border-radius: 999px;
  background: var(--border-base);
}

:deep(.progress-track span) {
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

:deep(.detail-meta) {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 12px;
}

:deep(.detail-meta div) {
  min-width: 0;
  padding: 9px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-elevated);
}

:deep(.detail-meta strong) {
  display: block;
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}

:deep(.inline-loading) {
  gap: 7px;
  margin-bottom: 10px;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 900;
}

:deep(.detail-section) {
  margin-top: 10px;
  padding: 12px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-elevated);
}

:deep(.detail-section h3) {
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 900;
}

:deep(.detail-section p) {
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.7;
  white-space: pre-wrap;
}

:deep(.official-reply) {
  border-color: color-mix(in srgb, var(--accent) 28%, var(--border-base));
}

:deep(.reply-head span) {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 900;
}

:deep(.attachment-link) {
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

:deep(.detail-actions) {
  margin-top: 12px;
  justify-content: flex-end;
  flex-wrap: wrap;
}

:deep(.loading-state),
:deep(.empty-state) {
  min-height: 240px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--text-muted);
  text-align: center;
}

:deep(.loading-state svg),
:deep(.empty-state svg) {
  width: 28px;
  height: 28px;
  color: var(--accent);
}

:deep(.empty-state strong) {
  color: var(--text-primary);
  font-size: 14px;
}

:deep(.empty-state span) {
  max-width: 280px;
  font-size: 12px;
}

:deep(.detail-empty) {
  height: 100%;
}

:deep(.spinning) {
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  :deep(to) {
    transform: rotate(360deg);
  }
}

:deep(.preview-image) {
  display: block;
  width: 100%;
  max-height: 72vh;
  object-fit: contain;
  border-radius: 8px;
}

@media (max-width: 1180px) {
  :deep(.submit-layout),
  :deep(.history-layout) {
    grid-template-columns: 1fr;
    overflow: auto;
  }

  :deep(.assist-panel),
  :deep(.detail-panel) {
    min-height: 360px;
  }
}

@media (max-width: 720px) {
  :deep(.panel-head:not(.mobile-row)),
  :deep(.detail-head:not(.mobile-row)) {
    flex-direction: column;
    align-items: stretch;
  }

  :deep(.form-actions button),
  :deep(.detail-actions button) {
    flex: 1;
  }

  :deep(.compact-grid),
  :deep(.detail-meta) {
    grid-template-columns: 1fr;
  }

  :deep(.ticket-row) {
    grid-template-columns: 1fr;
  }

  :deep(.row-meta) {
    justify-content: flex-start;
  }
}
</style>
