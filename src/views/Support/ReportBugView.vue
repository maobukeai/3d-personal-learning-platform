<script setup lang="ts">
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
  LifeBuoy,
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
import { getApiErrorMessage } from '@/utils/error';
import type { Feedback } from '@/types';

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
  stats.value.total ? Math.round(((stats.value.resolved + stats.value.closed) / stats.value.total) * 100) : 0,
);

const filteredFeedbacks = computed(() => {
  const keyword = searchQuery.value.trim().toLowerCase();
  return feedbacks.value.filter((item) => {
    const matchesStatus = statusFilter.value === 'ALL' || item.status === statusFilter.value;
    const matchesType = typeFilter.value === 'ALL' || item.type === typeFilter.value;
    const matchesPriority = priorityFilter.value === 'ALL' || item.priority === priorityFilter.value;
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

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
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
        response.data.find((item) => item.id === activeFeedback.value?.id) || response.data[0] || null;
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
  <div class="support-workbench">
    <header class="support-header">
      <div class="title-block">
        <div class="title-icon"><LifeBuoy /></div>
        <div>
          <p class="eyebrow">支持中心</p>
          <h1>问题反馈</h1>
        </div>
      </div>
      <div class="header-actions">
        <button type="button" class="ghost-btn" @click="refreshAll">
          <RefreshCw :class="{ spinning: isLoadingHistory }" />
          刷新
        </button>
        <button type="button" class="primary-btn" @click="setTab('submit')">
          <Plus />
          新建工单
        </button>
      </div>
    </header>

    <section class="metric-grid">
      <article class="metric-panel">
        <Inbox />
        <div>
          <span>全部工单</span>
          <strong>{{ stats.total }}</strong>
        </div>
      </article>
      <article class="metric-panel">
        <CircleDashed />
        <div>
          <span>进行中</span>
          <strong>{{ activeTickets }}</strong>
        </div>
      </article>
      <article class="metric-panel">
        <CheckCircle2 />
        <div>
          <span>解决率</span>
          <strong>{{ resolutionRate }}%</strong>
        </div>
      </article>
      <article class="metric-panel">
        <AlertCircle />
        <div>
          <span>高优先级</span>
          <strong>{{ stats.highOpen }}</strong>
        </div>
      </article>
      <article class="metric-panel wide">
        <History />
        <div>
          <span>最近动态</span>
          <strong>{{ latestActivityText }}</strong>
        </div>
      </article>
    </section>

    <nav class="tabbar">
      <button type="button" :class="{ active: activeTab === 'submit' }" @click="setTab('submit')">
        <Bug />
        提交反馈
      </button>
      <button type="button" :class="{ active: activeTab === 'history' }" @click="setTab('history')">
        <History />
        我的工单
        <span v-if="activeTickets">{{ activeTickets }}</span>
      </button>
    </nav>

    <main v-if="activeTab === 'submit'" class="submit-layout">
      <section class="form-panel">
        <div class="panel-head">
          <div>
            <p class="eyebrow">Ticket {{ ticketNo() }}</p>
            <h2>描述问题</h2>
          </div>
          <span class="status-pill tone-amber">草稿</span>
        </div>

        <div class="compact-grid">
          <label>
            反馈类型
            <select v-model="bugForm.type">
              <option v-for="item in typeOptions" :key="item.value" :value="item.value">
                {{ item.label }} · {{ item.hint }}
              </option>
            </select>
          </label>
          <label>
            优先级
            <select v-model="bugForm.priority">
              <option v-for="item in priorityOptions" :key="item.value" :value="item.value">
                {{ item.label }} · {{ item.hint }}
              </option>
            </select>
          </label>
        </div>

        <label>
          工单标题
          <input v-model="bugForm.title" maxlength="120" placeholder="例如：学习路线页面保存后步骤顺序错乱" />
        </label>

        <label>
          问题描述
          <textarea
            v-model="bugForm.description"
            rows="4"
            maxlength="1500"
            placeholder="发生了什么？在哪个页面？影响了什么流程？"
          ></textarea>
        </label>

        <div class="compact-grid">
          <label>
            复现步骤
            <textarea v-model="bugForm.steps" rows="5" placeholder="1. 进入...\A2. 点击...\A3. 观察结果..."></textarea>
          </label>
          <div class="field-stack">
            <label>
              期望结果
              <textarea v-model="bugForm.expected" rows="2" placeholder="正常情况下应该怎样"></textarea>
            </label>
            <label>
              实际结果
              <textarea v-model="bugForm.actual" rows="2" placeholder="现在出现了什么异常"></textarea>
            </label>
          </div>
        </div>

        <div class="compact-grid">
          <label>
            影响范围
            <input v-model="bugForm.impact" placeholder="例如：影响团队任务提交 / 仅自己可见" />
          </label>
          <label>
            页面链接
            <input v-model="bugForm.pageUrl" placeholder="https://..." />
          </label>
        </div>

        <div class="upload-row">
          <input ref="fileInput" type="file" class="hidden-input" accept="image/*" @change="handleFileUpload" />
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
          <button type="button" class="ghost-btn" @click="resetForm">
            <RotateCcw />
            重置
          </button>
          <button type="button" class="primary-btn" :disabled="isSubmitting" @click="handleSubmit">
            <Loader2 v-if="isSubmitting" class="spinning" />
            <Send v-else />
            {{ isSubmitting ? '提交中' : '提交工单' }}
          </button>
        </div>
      </section>

      <aside class="assist-panel">
        <section>
          <div class="side-title">
            <Sparkles />
            <h3>处理流程</h3>
          </div>
          <ol class="process-list">
            <li>
              <strong>接收</strong>
              <span>系统记录截图、链接和优先级，并通知管理员。</span>
            </li>
            <li>
              <strong>定位</strong>
              <span>管理员在后台筛选、回复、更新状态。</span>
            </li>
            <li>
              <strong>回访</strong>
              <span>你会在工单历史和通知中心看到处理结果。</span>
            </li>
          </ol>
        </section>

        <section>
          <div class="side-title">
            <Filter />
            <h3>提交质量</h3>
          </div>
          <div class="quality-grid">
            <span :class="{ done: bugForm.title.trim().length >= 3 }">标题清晰</span>
            <span :class="{ done: bugForm.description.trim().length >= 10 }">描述完整</span>
            <span :class="{ done: bugForm.steps.trim().length > 0 }">可复现</span>
            <span :class="{ done: Boolean(bugForm.attachmentUrl) }">有截图</span>
          </div>
        </section>

        <section class="mini-feed">
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
            <small>{{ statusLabel(item.status) }} · {{ formatRelativeDate(item.updatedAt) }}</small>
          </button>
          <div v-if="feedbacks.length === 0" class="empty-mini">还没有历史反馈</div>
        </section>
      </aside>
    </main>

    <main v-else class="history-layout">
      <section class="ticket-list-panel">
        <div class="toolbar">
          <label class="search-box">
            <Search />
            <input v-model="searchQuery" type="search" placeholder="搜索标题或描述" />
          </label>
          <select v-model="statusFilter">
            <option v-for="item in statusOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
          </select>
          <select v-model="typeFilter">
            <option value="ALL">全部类型</option>
            <option v-for="item in typeOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
          </select>
          <select v-model="priorityFilter">
            <option value="ALL">全部优先级</option>
            <option v-for="item in priorityOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
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
          <button type="button" class="primary-btn" @click="setTab('submit')">
            <Plus />
            新建工单
          </button>
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
              <span class="status-pill" :class="statusTone(item.status)">{{ statusLabel(item.status) }}</span>
              <span class="status-pill" :class="priorityTone(item.priority)">P{{ priorityLabel(item.priority) }}</span>
            </div>
            <ChevronRight />
          </button>
        </div>
      </section>

      <aside class="detail-panel">
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

          <button
            v-if="activeFeedback.attachmentUrl"
            type="button"
            class="attachment-link"
            @click="openPreview(activeFeedback.attachmentUrl)"
          >
            <ImageIcon />
            查看附件截图
            <ArrowUpRight />
          </button>

          <div class="detail-actions">
            <button
              v-if="activeFeedback.status !== 'CLOSED'"
              type="button"
              class="ghost-btn"
              @click="updateMyStatus(activeFeedback, 'CLOSED')"
            >
              <CheckCircle2 />
              我已确认，关闭
            </button>
            <button v-else type="button" class="ghost-btn" @click="updateMyStatus(activeFeedback, 'OPEN')">
              <RotateCcw />
              重新打开
            </button>
            <button type="button" class="primary-btn" @click="setTab('submit')">
              <Plus />
              继续反馈
            </button>
          </div>
        </template>
      </aside>
    </main>

    <el-dialog v-model="previewDialogVisible" title="附件预览" width="68%" destroy-on-close>
      <img :src="previewImageUrl" alt="" class="preview-image" />
    </el-dialog>
  </div>
</template>

<style scoped>
.support-workbench {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  overflow: hidden;
  background: var(--bg-app);
  color: var(--text-primary);
}

.support-header,
.metric-panel,
.tabbar,
.form-panel,
.assist-panel,
.ticket-list-panel,
.detail-panel {
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
  box-shadow: var(--shadow-enterprise);
}

.support-header {
  min-height: 62px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
}

.title-block,
.header-actions,
.form-actions,
.detail-actions,
.title-icon,
.side-title,
.attachment-preview,
.attachment-link,
.inline-loading {
  display: flex;
  align-items: center;
}

.title-block {
  gap: 10px;
}

.title-icon {
  width: 38px;
  height: 38px;
  justify-content: center;
  border-radius: 8px;
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  color: var(--accent);
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

.header-actions,
.form-actions,
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

.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(130px, 1fr)) minmax(220px, 1.5fr);
  gap: 10px;
}

.metric-panel {
  min-height: 72px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
}

.metric-panel svg {
  width: 20px;
  height: 20px;
  color: var(--accent);
}

.metric-panel span,
.detail-meta span,
.mini-ticket span,
.ticket-id {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 900;
}

.metric-panel strong {
  display: block;
  margin-top: 3px;
  font-size: 21px;
  line-height: 1;
}

.metric-panel.wide strong {
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  line-height: 1.2;
}

.tabbar {
  width: fit-content;
  display: inline-flex;
  gap: 3px;
  padding: 3px;
}

.tabbar button {
  min-height: 32px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 0 12px;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 900;
}

.tabbar button.active {
  background: var(--accent);
  color: white;
}

.tabbar span {
  min-width: 18px;
  height: 18px;
  display: inline-grid;
  place-items: center;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.22);
  font-size: 10px;
}

.submit-layout,
.history-layout {
  flex: 1;
  min-height: 0;
  display: grid;
  gap: 12px;
  overflow: hidden;
}

.submit-layout {
  grid-template-columns: minmax(0, 1fr) 330px;
}

.history-layout {
  grid-template-columns: minmax(420px, 0.92fr) minmax(360px, 1fr);
}

.form-panel,
.assist-panel,
.ticket-list-panel,
.detail-panel {
  min-height: 0;
  overflow: auto;
}

.form-panel {
  display: grid;
  gap: 14px;
  padding: 14px;
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
  gap: 10px;
}

label {
  display: grid;
  gap: 6px;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 900;
}

input,
select,
textarea {
  width: 100%;
  min-width: 0;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  outline: 0;
  background: var(--bg-app);
  color: var(--text-primary);
  font-size: 13px;
}

input,
select {
  height: 38px;
  padding: 0 10px;
}

textarea {
  padding: 10px;
  line-height: 1.55;
  resize: vertical;
}

input:focus,
select:focus,
textarea:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 14%, transparent);
}

.field-stack {
  display: grid;
  gap: 10px;
}

.hidden-input {
  display: none;
}

.upload-row {
  display: grid;
}

.upload-box,
.attachment-preview {
  min-height: 64px;
  border: 1px dashed var(--border-base);
  border-radius: 8px;
  background: var(--bg-app);
}

.upload-box {
  display: grid;
  place-items: center;
  gap: 3px;
  padding: 12px;
  color: var(--text-secondary);
}

.upload-box svg {
  width: 20px;
  height: 20px;
  color: var(--accent);
}

.upload-box span {
  font-size: 12px;
  font-weight: 900;
}

.upload-box small {
  color: var(--text-muted);
  font-size: 10px;
}

.attachment-preview {
  gap: 10px;
  padding: 8px;
}

.attachment-preview img {
  width: 54px;
  height: 48px;
  border-radius: 6px;
  object-fit: cover;
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
  padding: 12px;
}

.assist-panel section {
  padding: 12px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-elevated);
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

.process-list {
  display: grid;
  gap: 10px;
  margin: 0;
  padding-left: 18px;
}

.process-list li {
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.5;
}

.process-list strong {
  display: block;
  color: var(--text-primary);
}

.quality-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 7px;
}

.quality-grid span {
  min-height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: var(--bg-app);
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 900;
}

.quality-grid span.done {
  background: rgba(16, 185, 129, 0.12);
  color: #047857;
}

.mini-feed {
  display: grid;
  gap: 7px;
}

.mini-ticket {
  display: grid;
  gap: 3px;
  padding: 9px;
  border-radius: 8px;
  background: var(--bg-app);
  color: var(--text-primary);
  text-align: left;
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

.toolbar select {
  width: auto;
  min-width: 112px;
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

.progress-track {
  height: 8px;
  margin: 14px 0;
  overflow: hidden;
  border-radius: 999px;
  background: var(--bg-app);
}

.progress-track span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--accent);
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
  .metric-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .metric-panel.wide {
    grid-column: span 2;
  }

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
  .support-workbench {
    padding: 10px;
    overflow: auto;
  }

  .support-header,
  .panel-head,
  .detail-head {
    flex-direction: column;
    align-items: stretch;
  }

  .header-actions {
    justify-content: stretch;
  }

  .header-actions button,
  .form-actions button,
  .detail-actions button {
    flex: 1;
  }

  .metric-grid,
  .compact-grid,
  .detail-meta {
    grid-template-columns: 1fr;
  }

  .tabbar {
    width: 100%;
  }

  .tabbar button {
    flex: 1;
    justify-content: center;
  }

  .ticket-row {
    grid-template-columns: 1fr;
  }

  .row-meta {
    justify-content: flex-start;
  }
}
</style>
