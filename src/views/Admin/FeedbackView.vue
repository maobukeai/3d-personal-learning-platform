<script setup lang="ts">
import { formatDateTime as formatDate } from '@/utils/format';
import { computed, onMounted, ref } from 'vue';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  Image as ImageIcon,
  Inbox,
  MessageSquare,
  MoreHorizontal,
  RefreshCw,
  Search,
  Send,
  Trash2,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '@/utils/api';
import { getApiErrorMessage } from '@/utils/error';
import UserAvatar from '@/components/UserAvatar.vue';
import type { Feedback } from '@/types';
import AdminOpsPanel from './components/AdminOpsPanel.vue';
import { fetchManagementInsights } from './adminManagementInsights';
import Modal from '@/components/ui/Modal.vue';
import UiButton from '@/components/ui/Button.vue';
import UiInput from '@/components/ui/Input.vue';

type FeedbackStatus = Feedback['status'];
type FeedbackPriority = Feedback['priority'];
type FeedbackType = Feedback['type'];
type StatusFilter = 'ALL' | FeedbackStatus;
type PriorityFilter = 'ALL' | FeedbackPriority;
type TypeFilter = 'ALL' | FeedbackType;

type AdminFeedback = Feedback & {
  attachmentUrl?: string | null;
  user: NonNullable<Feedback['user']>;
};

const feedbacks = ref<AdminFeedback[]>([]);
const isLoading = ref(false);
const searchQuery = ref('');
const statusFilter = ref<StatusFilter>('ALL');
const priorityFilter = ref<PriorityFilter>('ALL');
const typeFilter = ref<TypeFilter>('ALL');
const selectedIds = ref<string[]>([]);
const activeFeedback = ref<AdminFeedback | null>(null);
const detailDrawerVisible = ref(false);
const replyDialogVisible = ref(false);
const isSubmittingReply = ref(false);
const replyText = ref('');
const replyStatus = ref<FeedbackStatus>('IN_PROGRESS');
const previewVisible = ref(false);
const previewImageUrl = ref('');

const statusTabs: Array<{ value: StatusFilter; label: string }> = [
  { value: 'ALL', label: '全部' },
  { value: 'OPEN', label: '待处理' },
  { value: 'IN_PROGRESS', label: '处理中' },
  { value: 'RESOLVED', label: '已解决' },
  { value: 'CLOSED', label: '已关闭' },
];

const priorityOptions: Array<{ value: PriorityFilter; label: string }> = [
  { value: 'ALL', label: '全部优先级' },
  { value: 'HIGH', label: '高' },
  { value: 'MEDIUM', label: '中' },
  { value: 'LOW', label: '低' },
];

const typeOptions: Array<{ value: TypeFilter; label: string }> = [
  { value: 'ALL', label: '全部类型' },
  { value: 'Bug', label: 'Bug' },
  { value: 'Feature', label: '功能建议' },
  { value: 'UI', label: '界面体验' },
  { value: 'Other', label: '其他' },
];

const fetchFeedbacks = async () => {
  isLoading.value = true;
  try {
    const response = await api.get<AdminFeedback[]>('/api/admin/feedback');
    feedbacks.value = response.data;
    if (!activeFeedback.value && response.data.length > 0) {
      activeFeedback.value = response.data[0] || null;
    } else if (activeFeedback.value) {
      const fresh = response.data.find((item) => item.id === activeFeedback.value?.id);
      activeFeedback.value = fresh || activeFeedback.value;
    }
    selectedIds.value = selectedIds.value.filter((id) =>
      response.data.some((item) => item.id === id),
    );
    fetchManagementInsights(true);
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '无法加载反馈数据'));
  } finally {
    isLoading.value = false;
  }
};

const filteredFeedbacks = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  return feedbacks.value.filter((item) => {
    const matchesStatus = statusFilter.value === 'ALL' || item.status === statusFilter.value;
    const matchesPriority =
      priorityFilter.value === 'ALL' || item.priority === priorityFilter.value;
    const matchesType = typeFilter.value === 'ALL' || item.type === typeFilter.value;
    const matchesSearch =
      !query ||
      item.title.toLowerCase().includes(query) ||
      item.description.toLowerCase().includes(query) ||
      item.user.name?.toLowerCase().includes(query) ||
      item.user.email.toLowerCase().includes(query);
    return matchesStatus && matchesPriority && matchesType && matchesSearch;
  });
});

const stats = computed(() => ({
  total: feedbacks.value.length,
  open: feedbacks.value.filter((item) => item.status === 'OPEN').length,
  processing: feedbacks.value.filter((item) => item.status === 'IN_PROGRESS').length,
  resolved: feedbacks.value.filter((item) => item.status === 'RESOLVED').length,
  high: feedbacks.value.filter((item) => item.priority === 'HIGH' && item.status !== 'CLOSED')
    .length,
}));

const allPageSelected = computed(
  () =>
    filteredFeedbacks.value.length > 0 &&
    filteredFeedbacks.value.every((item) => selectedIds.value.includes(item.id)),
);

const toggleSelectAll = () => {
  if (allPageSelected.value) {
    selectedIds.value = selectedIds.value.filter(
      (id) => !filteredFeedbacks.value.some((item) => item.id === id),
    );
  } else {
    selectedIds.value = Array.from(
      new Set([...selectedIds.value, ...filteredFeedbacks.value.map((item) => item.id)]),
    );
  }
};

const toggleSelect = (id: string) => {
  selectedIds.value = selectedIds.value.includes(id)
    ? selectedIds.value.filter((selectedId) => selectedId !== id)
    : [...selectedIds.value, id];
};

const statusLabel = (status: string) => {
  const map: Record<string, string> = {
    OPEN: '待处理',
    IN_PROGRESS: '处理中',
    RESOLVED: '已解决',
    CLOSED: '已关闭',
  };
  return map[status] || status;
};

const priorityLabel = (priority: string) => {
  const map: Record<string, string> = {
    HIGH: '高优先级',
    MEDIUM: '中优先级',
    LOW: '低优先级',
  };
  return map[priority] || priority;
};

const typeLabel = (type: string) => {
  const map: Record<string, string> = {
    Bug: 'Bug',
    Feature: '功能建议',
    UI: '界面体验',
    Other: '其他',
  };
  return map[type] || type;
};

const statusClass = (status: string) => ({
  'tone-red': status === 'OPEN',
  'tone-amber': status === 'IN_PROGRESS',
  'tone-green': status === 'RESOLVED',
  'tone-slate': status === 'CLOSED',
});

const priorityClass = (priority: string) => ({
  'tone-red': priority === 'HIGH',
  'tone-amber': priority === 'MEDIUM',
  'tone-green': priority === 'LOW',
});

const openDetail = (item: AdminFeedback) => {
  activeFeedback.value = item;
  detailDrawerVisible.value = true;
};

const openReplyDialog = (item: AdminFeedback) => {
  activeFeedback.value = item;
  replyText.value = item.adminReply || '';
  replyStatus.value = item.status === 'OPEN' ? 'IN_PROGRESS' : item.status;
  replyDialogVisible.value = true;
};

const handleReply = async () => {
  if (!activeFeedback.value) return;
  if (!replyText.value.trim()) {
    ElMessage.warning('请填写回复内容');
    return;
  }
  isSubmittingReply.value = true;
  try {
    await api.put(`/api/admin/feedback/${activeFeedback.value.id}/status`, {
      status: replyStatus.value,
      adminReply: replyText.value.trim(),
    });
    ElMessage.success('回复已发送');
    replyDialogVisible.value = false;
    await fetchFeedbacks();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '回复失败'));
  } finally {
    isSubmittingReply.value = false;
  }
};

const updateStatus = async (id: string, status: FeedbackStatus) => {
  try {
    await api.put(`/api/admin/feedback/${id}/status`, { status });
    ElMessage.success('状态已更新');
    await fetchFeedbacks();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '状态更新失败'));
  }
};

const batchUpdateStatus = async (status: FeedbackStatus) => {
  if (selectedIds.value.length === 0) return;
  try {
    await ElMessageBox.confirm(
      `确认将 ${selectedIds.value.length} 条反馈标记为「${statusLabel(status)}」？`,
      '批量更新',
      {
        confirmButtonText: '确认更新',
        cancelButtonText: '取消',
        type: 'warning',
      },
    );
    await api.put('/api/admin/feedback/batch-status', { ids: selectedIds.value, status });
    ElMessage.success('批量状态已更新');
    selectedIds.value = [];
    await fetchFeedbacks();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(getApiErrorMessage(error, '批量更新失败'));
    }
  }
};

const deleteFeedback = async (item: AdminFeedback) => {
  try {
    await ElMessageBox.confirm(`确认删除「${item.title}」？`, '删除反馈', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
      confirmButtonClass: 'el-button--danger',
    });
    await api.delete(`/api/admin/feedback/${item.id}`);
    ElMessage.success('反馈已删除');
    if (activeFeedback.value?.id === item.id) activeFeedback.value = null;
    await fetchFeedbacks();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(getApiErrorMessage(error, '删除失败'));
    }
  }
};

const batchDelete = async () => {
  if (selectedIds.value.length === 0) return;
  try {
    await ElMessageBox.confirm(`确认删除 ${selectedIds.value.length} 条反馈？`, '批量删除', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'error',
      confirmButtonClass: 'el-button--danger',
    });
    await api.delete('/api/admin/feedback/batch', { data: { ids: selectedIds.value } });
    ElMessage.success('反馈已删除');
    selectedIds.value = [];
    await fetchFeedbacks();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(getApiErrorMessage(error, '批量删除失败'));
    }
  }
};

const showImage = (url: string) => {
  previewImageUrl.value = url;
  previewVisible.value = true;
};

onMounted(fetchFeedbacks);
</script>

<template>
  <div class="admin-workbench">
    <header class="workbench-header">
      <div>
        <p class="eyebrow">用户与团队</p>
        <h1>用户反馈</h1>
      </div>
      <UiButton variant="secondary" :icon="RefreshCw" :loading="isLoading" @click="fetchFeedbacks">
        刷新
      </UiButton>
    </header>

    <AdminOpsPanel scope="feedback" />

    <section class="metric-grid">
      <article class="metric-card">
        <Inbox />
        <div>
          <span>反馈总量</span><strong>{{ stats.total }}</strong>
        </div>
      </article>
      <article class="metric-card">
        <AlertTriangle />
        <div>
          <span>待处理</span><strong>{{ stats.open }}</strong>
        </div>
      </article>
      <article class="metric-card">
        <Clock />
        <div>
          <span>处理中</span><strong>{{ stats.processing }}</strong>
        </div>
      </article>
      <article class="metric-card">
        <CheckCircle2 />
        <div>
          <span>已解决</span><strong>{{ stats.resolved }}</strong>
        </div>
      </article>
    </section>

    <section class="toolbar-panel">
      <div class="segmented">
        <button
          v-for="tab in statusTabs"
          :key="tab.value"
          type="button"
          :class="{ active: statusFilter === tab.value }"
          @click="statusFilter = tab.value"
        >
          {{ tab.label }}
        </button>
      </div>
      <select v-model="priorityFilter" class="filter-select">
        <option v-for="item in priorityOptions" :key="item.value" :value="item.value">
          {{ item.label }}
        </option>
      </select>
      <select v-model="typeFilter" class="filter-select">
        <option v-for="item in typeOptions" :key="item.value" :value="item.value">
          {{ item.label }}
        </option>
      </select>
      <UiInput
        v-model="searchQuery"
        :icon="Search"
        placeholder="搜索标题、内容、用户"
        :glass="false"
        class="ml-auto min-w-[260px]"
      />
    </section>

    <section v-if="selectedIds.length" class="batch-bar">
      <span>已选择 {{ selectedIds.length }} 条反馈</span>
      <div>
        <UiButton variant="secondary" size="sm" @click="batchUpdateStatus('IN_PROGRESS')">标记处理中</UiButton>
        <UiButton variant="primary" size="sm" @click="batchUpdateStatus('RESOLVED')">标记已解决</UiButton>
        <UiButton variant="secondary" size="sm" @click="batchUpdateStatus('CLOSED')">关闭</UiButton>
        <UiButton variant="danger" size="sm" @click="batchDelete">删除</UiButton>
        <UiButton variant="secondary" size="sm" @click="selectedIds = []">清空</UiButton>
      </div>
    </section>

    <main class="data-panel">
      <div v-if="isLoading" class="loading-state">
        <RefreshCw class="spinning" />
        <span>正在同步反馈工单</span>
      </div>

      <div v-else class="table-wrap">
        <table>
          <thead>
            <tr>
              <th class="check-cell">
                <input type="checkbox" :checked="allPageSelected" @change="toggleSelectAll" />
              </th>
              <th>反馈</th>
              <th>用户</th>
              <th>优先级</th>
              <th>状态</th>
              <th>附件</th>
              <th>更新时间</th>
              <th class="right-cell">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in filteredFeedbacks" :key="item.id" @click="openDetail(item)">
              <td class="check-cell" @click.stop>
                <input
                  type="checkbox"
                  :checked="selectedIds.includes(item.id)"
                  @change="toggleSelect(item.id)"
                />
              </td>
              <td>
                <div class="feedback-cell">
                  <strong>{{ item.title }}</strong>
                  <small>{{ typeLabel(item.type) }} · {{ item.description }}</small>
                </div>
              </td>
              <td>
                <div class="user-cell">
                  <UserAvatar :user="item.user" size="xs" />
                  <span>{{ item.user.name || item.user.email }}</span>
                </div>
              </td>
              <td>
                <span class="pill" :class="priorityClass(item.priority)">{{
                  priorityLabel(item.priority)
                }}</span>
              </td>
              <td>
                <span class="pill" :class="statusClass(item.status)">{{
                  statusLabel(item.status)
                }}</span>
              </td>
              <td>
                <UiButton
                  v-if="item.attachmentUrl"
                  variant="link"
                  size="sm"
                  @click.stop="showImage(item.attachmentUrl)"
                >
                  查看附件
                </UiButton>
                <span v-else class="muted">无</span>
              </td>
              <td>{{ formatDate(item.updatedAt || item.createdAt) }}</td>
              <td class="right-cell" @click.stop>
                <el-dropdown trigger="click">
                  <button type="button" class="icon-btn"><MoreHorizontal /></button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item @click="openDetail(item)">
                        <ChevronRight class="dropdown-icon" /> 查看详情
                      </el-dropdown-item>
                      <el-dropdown-item @click="openReplyDialog(item)">
                        <MessageSquare class="dropdown-icon" />
                        {{ item.adminReply ? '编辑回复' : '回复用户' }}
                      </el-dropdown-item>
                      <el-dropdown-item @click="updateStatus(item.id, 'IN_PROGRESS')"
                        >标记处理中</el-dropdown-item
                      >
                      <el-dropdown-item @click="updateStatus(item.id, 'RESOLVED')"
                        >标记已解决</el-dropdown-item
                      >
                      <el-dropdown-item @click="updateStatus(item.id, 'CLOSED')"
                        >关闭反馈</el-dropdown-item
                      >
                      <el-dropdown-item divided @click="deleteFeedback(item)">
                        <Trash2 class="dropdown-icon danger" /> 删除
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </td>
            </tr>
          </tbody>
        </table>

        <div v-if="filteredFeedbacks.length === 0" class="empty-state">
          <CheckCircle2 />
          <strong>没有匹配的反馈</strong>
          <span>当前筛选条件下暂无待处理事项。</span>
        </div>
      </div>
    </main>

    <el-drawer v-model="detailDrawerVisible" size="500px" :with-header="false">
      <aside v-if="activeFeedback" class="detail-drawer">
        <div class="drawer-head">
          <div>
            <span class="pill" :class="statusClass(activeFeedback.status)">
              {{ statusLabel(activeFeedback.status) }}
            </span>
            <h2>{{ activeFeedback.title }}</h2>
            <p>{{ typeLabel(activeFeedback.type) }} · {{ formatDate(activeFeedback.createdAt) }}</p>
          </div>
          <button type="button" class="icon-btn" @click="detailDrawerVisible = false">×</button>
        </div>

        <section class="detail-section">
          <h3>提交用户</h3>
          <div class="submitter-row">
            <UserAvatar :user="activeFeedback.user" size="sm" />
            <div>
              <strong>{{ activeFeedback.user.name || activeFeedback.user.email }}</strong>
              <span>{{ activeFeedback.user.email }}</span>
            </div>
          </div>
        </section>

        <section class="detail-section">
          <h3>反馈内容</h3>
          <p class="body-text">{{ activeFeedback.description }}</p>
          <UiButton
            v-if="activeFeedback.attachmentUrl"
            variant="secondary"
            :icon="ImageIcon"
            @click="showImage(activeFeedback.attachmentUrl)"
          >
            查看附件
          </UiButton>
        </section>

        <section v-if="activeFeedback.adminReply" class="detail-section">
          <h3>官方回复</h3>
          <p class="body-text">{{ activeFeedback.adminReply }}</p>
          <small>{{ formatDate(activeFeedback.repliedAt) }}</small>
        </section>

        <div class="drawer-actions">
          <UiButton variant="secondary" :icon="MessageSquare" @click="openReplyDialog(activeFeedback)">
            回复
          </UiButton>
          <UiButton variant="primary" :icon="CheckCircle2" @click="updateStatus(activeFeedback.id, 'RESOLVED')">
            解决
          </UiButton>
          <UiButton variant="danger" :icon="Trash2" @click="deleteFeedback(activeFeedback)">
            删除
          </UiButton>
        </div>
      </aside>
    </el-drawer>

    <Modal
      :show="replyDialogVisible"
      title="回复用户反馈"
      size="md"
      @close="replyDialogVisible = false"
    >
      <div v-if="activeFeedback" class="form-stack">
        <div class="feedback-preview">
          <strong>{{ activeFeedback.title }}</strong>
          <p>{{ activeFeedback.description }}</p>
        </div>
        <label>
          回复内容
          <textarea
            v-model="replyText"
            rows="6"
            maxlength="1000"
            placeholder="输入给用户的正式回复"
          />
        </label>
        <label>
          同步状态
          <select v-model="replyStatus">
            <option value="IN_PROGRESS">处理中</option>
            <option value="RESOLVED">已解决</option>
            <option value="CLOSED">已关闭</option>
            <option value="OPEN">待处理</option>
          </select>
        </label>
      </div>
      <template #footer>
        <UiButton variant="secondary" @click="replyDialogVisible = false">取消</UiButton>
        <UiButton
          variant="primary"
          :icon="Send"
          :disabled="isSubmittingReply || !replyText.trim()"
          @click="handleReply"
        >
          发送回复
        </UiButton>
      </template>
    </Modal>

    <Modal :show="previewVisible" title="附件预览" size="xl" @close="previewVisible = false">
      <img :src="previewImageUrl" alt="" class="preview-image" />
    </Modal>
  </div>
</template>

<style scoped>
.admin-workbench {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  overflow: hidden;
  background: var(--bg-app);
  color: var(--text-primary);
}

.workbench-header,
.toolbar-panel,
.data-panel,
.batch-bar {
  border: 1px solid var(--border-base);
  background: var(--bg-card);
  border-radius: 8px;
  box-shadow: var(--shadow-enterprise);
}

.workbench-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
}

h1,
h2,
h3,
p {
  margin: 0;
}

.eyebrow {
  margin-bottom: 4px;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 800;
}

h1 {
  font-size: 20px;
  font-weight: 900;
}

button {
  border: 0;
  cursor: pointer;
  font: inherit;
}

.primary-btn,
.ghost-btn,
.batch-bar button,
.drawer-actions button {
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 0 12px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 900;
}

.primary-btn {
  background: var(--accent);
  color: white;
}

.ghost-btn,
.drawer-actions button {
  border: 1px solid var(--border-base);
  background: var(--bg-elevated);
  color: var(--text-secondary);
}

button svg {
  width: 16px;
  height: 16px;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.metric-card {
  min-height: 82px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-card);
}

.metric-card svg {
  width: 24px;
  height: 24px;
  color: var(--accent);
}

.metric-card span {
  display: block;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 800;
}

.metric-card strong {
  display: block;
  margin-top: 4px;
  font-size: 24px;
}

.toolbar-panel {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 10px;
}

.segmented {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-app);
}

.segmented button {
  min-height: 30px;
  padding: 0 10px;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 900;
}

.segmented button.active {
  background: var(--bg-card);
  color: var(--accent);
  box-shadow: var(--shadow-enterprise);
}

.filter-select,
.search-box {
  height: 38px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-elevated);
  color: var(--text-primary);
}

.filter-select {
  padding: 0 10px;
  font-size: 12px;
  font-weight: 800;
}

.search-box {
  margin-left: auto;
  min-width: 280px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
}

.search-box svg {
  color: var(--text-muted);
}

.search-box input,
.form-stack textarea,
.form-stack select {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text-primary);
}

.batch-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 900;
}

.batch-bar > div {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.batch-bar button {
  border: 1px solid var(--border-base);
  background: var(--bg-elevated);
  color: var(--text-primary);
}

.data-panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.table-wrap {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

table {
  width: 100%;
  min-width: 1050px;
  border-collapse: collapse;
}

th,
td {
  padding: 13px 14px;
  border-bottom: 1px solid var(--border-base);
  text-align: left;
  vertical-align: middle;
  white-space: nowrap;
}

th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--bg-card);
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 900;
}

tbody tr {
  cursor: pointer;
}

tr:hover td {
  background: color-mix(in srgb, var(--accent) 5%, transparent);
}

.check-cell {
  width: 44px;
}

.right-cell {
  text-align: right;
}

.feedback-cell {
  max-width: 420px;
}

.feedback-cell strong,
.feedback-cell small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
}

.feedback-cell small {
  margin-top: 4px;
  color: var(--text-muted);
}

.user-cell,
.submitter-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.pill {
  min-height: 24px;
  display: inline-flex;
  align-items: center;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 900;
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

.muted {
  color: var(--text-muted);
}

.link-btn,
.icon-btn {
  background: transparent;
  color: var(--accent);
  font-weight: 900;
}

.icon-btn {
  width: 32px;
  height: 32px;
  display: inline-grid;
  place-items: center;
  border-radius: 8px;
  color: var(--text-muted);
}

.icon-btn:hover {
  background: var(--bg-app);
  color: var(--text-primary);
}

.dropdown-icon {
  width: 14px;
  height: 14px;
  margin-right: 6px;
}

.dropdown-icon.danger {
  color: var(--danger);
}

.loading-state,
.empty-state {
  min-height: 260px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--text-muted);
}

.spinning {
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

:deep(.el-drawer__body) {
  padding: 0;
}

.detail-drawer {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  overflow: auto;
  background: var(--bg-card);
  color: var(--text-primary);
}

.drawer-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.drawer-head h2 {
  margin-top: 12px;
  font-size: 20px;
  font-weight: 900;
}

.drawer-head p {
  margin-top: 5px;
  color: var(--text-muted);
  font-size: 13px;
}

.detail-section {
  padding: 14px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
}

.detail-section h3 {
  margin-bottom: 12px;
  font-size: 13px;
  font-weight: 900;
}

.submitter-row strong,
.submitter-row span {
  display: block;
}

.submitter-row span,
.detail-section small {
  color: var(--text-muted);
  font-size: 12px;
}

.body-text {
  color: var(--text-secondary);
  line-height: 1.7;
  white-space: pre-wrap;
}

.attachment-btn {
  margin-top: 12px;
  min-height: 36px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 0 12px;
  border-radius: 8px;
  background: var(--bg-app);
  color: var(--accent);
  font-weight: 900;
}

.drawer-actions {
  margin-top: auto;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.form-stack {
  display: grid;
  gap: 14px;
}

.feedback-preview {
  padding: 12px;
  border-radius: 8px;
  background: var(--bg-app);
}

.feedback-preview p {
  margin-top: 6px;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.6;
}

.form-stack label {
  display: grid;
  gap: 7px;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 900;
}

.form-stack textarea,
.form-stack select {
  min-height: 40px;
  padding: 10px 11px;
  border: 1px solid var(--border-base);
  border-radius: 8px;
  background: var(--bg-app);
  resize: vertical;
}

.dialog-btn {
  margin-left: 8px;
}

.preview-image {
  display: block;
  width: 100%;
  max-height: 72vh;
  object-fit: contain;
  border-radius: 8px;
}

@media (max-width: 980px) {
  .metric-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .search-box {
    width: 100%;
    min-width: 0;
    margin-left: 0;
  }
}

@media (max-width: 640px) {
  .admin-workbench {
    padding: 10px;
    gap: 8px;
  }

  .workbench-header,
  .batch-bar {
    align-items: flex-start;
    flex-direction: column;
  }

  .metric-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .metric-card {
    min-height: 66px;
    gap: 8px;
    padding: 10px;
  }

  .metric-card svg {
    width: 18px;
    height: 18px;
  }

  .metric-card strong {
    font-size: 20px;
  }

  .toolbar-panel {
    gap: 8px;
    padding: 8px;
  }

  .segmented {
    max-width: 100%;
    overflow-x: auto;
  }

  .filter-select {
    flex: 1 1 8rem;
    min-width: 0;
  }

  table {
    min-width: 780px;
  }

  th,
  td {
    padding: 9px 10px;
    font-size: 11px;
  }

  .feedback-cell {
    max-width: 260px;
  }
}
</style>
