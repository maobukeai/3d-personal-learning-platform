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
import { ElMessage, ElMessageBox } from '@/utils/feedbackBridge';
import api from '@/utils/api';
import { getApiErrorMessage } from '@/utils/error';
import UserAvatar from '@/components/UserAvatar.vue';
import type { Feedback } from '@/types';
import Modal from '@/components/ui/Modal.vue';
import UiButton from '@/components/ui/Button.vue';
import Card from '@/components/ui/Card.vue';
import Badge from '@/components/ui/Badge.vue';
import Tabs from '@/components/ui/Tabs.vue';
import AdminHeader from './components/AdminHeader.vue';

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

const resolvedRate = computed(() => {
  if (feedbacks.value.length === 0) return 100;
  const resolvedCount = feedbacks.value.filter(
    (item) => item.status === 'RESOLVED' || item.status === 'CLOSED',
  ).length;
  return Math.round((resolvedCount / feedbacks.value.length) * 100);
});

const consolidatedCards = computed(() => {
  const total = feedbacks.value.length;
  const openCount = feedbacks.value.filter((item) => item.status === 'OPEN').length;
  const progressCount = feedbacks.value.filter((item) => item.status === 'IN_PROGRESS').length;
  const closedCount = feedbacks.value.filter(
    (item) => item.status === 'RESOLVED' || item.status === 'CLOSED',
  ).length;
  const highCount = feedbacks.value.filter(
    (item) => item.priority === 'HIGH' && item.status !== 'CLOSED',
  ).length;

  return [
    {
      label: '反馈工单总量',
      value: total,
      hint: `处理中 ${progressCount} · 已闭环 ${closedCount}`,
      icon: Inbox,
      color: 'text-sky-600 bg-sky-500/10 border-sky-500/20',
      health: { label: '正常', variant: 'success' as const },
    },
    {
      label: '待处理反馈',
      value: openCount,
      hint: `高优先级待办 ${highCount}`,
      icon: AlertTriangle,
      color:
        openCount > 0
          ? 'text-rose-600 bg-rose-500/10 border-rose-500/20'
          : 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20',
      health:
        openCount > 5
          ? { label: '积压', variant: 'danger' as const }
          : openCount > 0
            ? { label: '待办', variant: 'warning' as const }
            : { label: '已清空', variant: 'success' as const },
    },
    {
      label: '处理中工单',
      value: progressCount,
      hint: '正在推进中',
      icon: Clock,
      color: 'text-amber-600 bg-amber-500/10 border-amber-500/20',
      health: { label: '跟进中', variant: 'primary' as const },
    },
    {
      label: '工单闭环率',
      value: `${resolvedRate.value}%`,
      hint: `已解决/关闭 ${closedCount} 个反馈`,
      icon: CheckCircle2,
      color: 'text-purple-600 bg-purple-500/10 border-purple-500/20',
      health:
        resolvedRate.value >= 90
          ? { label: '高效', variant: 'success' as const }
          : { label: '关注', variant: 'warning' as const },
    },
  ];
});

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
  <div
    class="admin-feedback-page mobile-adaptive flex flex-1 min-h-0 flex-col overflow-hidden text-[var(--text-primary)]"
  >
    <main class="min-h-0 flex-1 overflow-y-auto p-2 sm:p-2.5 space-y-2">
      <!-- Ultra-Compact Single Row Header -->
      <AdminHeader
        title="用户反馈"
        subtitle="用户与团队"
        :cards="consolidatedCards"
        v-model="searchQuery"
        placeholder="搜索当前反馈..."
      >
        <UiButton
          variant="secondary"
          size="sm"
          :icon="RefreshCw"
          :loading="isLoading"
          @click="fetchFeedbacks"
          class="!h-7.5 !text-xs !px-2.5"
        >
          刷新
        </UiButton>
      </AdminHeader>

      <!-- Filters & Search Toolbar -->
      <Card padding="sm">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div class="flex items-center gap-3 overflow-x-auto scrollbar-hide shrink-0 mobile-row">
            <Tabs v-model="statusFilter" :options="statusTabs" variant="solid" />
          </div>
          <div class="flex items-center gap-2 mobile-row">
            <Select v-model="priorityFilter" size="small" style="width: 120px">
              <SelectOption
                v-for="item in priorityOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </Select>
            <Select v-model="typeFilter" size="small" style="width: 120px">
              <SelectOption
                v-for="item in typeOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </Select>
          </div>
        </div>
      </Card>

      <!-- Batch operations bar -->
      <div
        v-if="selectedIds.length"
        class="batch-bar flex items-center justify-between gap-3 p-2 px-3 border border-slate-100 dark:border-white/5 bg-white/40 dark:bg-white/5 backdrop-blur-sm rounded-lg mobile-row"
      >
        <span class="text-xs font-semibold text-[var(--text-secondary)]"
          >已选择 {{ selectedIds.length }} 条反馈</span
        >
        <div class="flex items-center gap-2 mobile-row">
          <UiButton variant="secondary" size="sm" @click="batchUpdateStatus('IN_PROGRESS')"
            >标记处理中</UiButton
          >
          <UiButton variant="primary" size="sm" @click="batchUpdateStatus('RESOLVED')"
            >标记已解决</UiButton
          >
          <UiButton variant="secondary" size="sm" @click="batchUpdateStatus('CLOSED')"
            >关闭</UiButton
          >
          <UiButton variant="danger" size="sm" @click="batchDelete">删除</UiButton>
          <UiButton variant="secondary" size="sm" @click="selectedIds = []">清空</UiButton>
        </div>
      </div>

      <!-- Data Panel -->
      <Card
        padding="none"
        class="table-shell-card overflow-hidden flex-1 flex flex-col min-h-[360px]"
      >
        <Table
          v-loading="isLoading"
          :data="filteredFeedbacks"
          class="user-table w-full flex-1 mobile-table"
          row-class-name="table-row"
          @row-click="openDetail"
        >
          <TableColumn width="48">
            <template #header>
              <input
                type="checkbox"
                :checked="allPageSelected"
                @change="toggleSelectAll"
                @click.stop
              />
            </template>
            <template #default="{ row }">
              <input
                type="checkbox"
                :checked="selectedIds.includes(row.id)"
                @change="toggleSelect(row.id)"
                @click.stop
              />
            </template>
          </TableColumn>

          <TableColumn label="反馈" min-width="260">
            <template #default="{ row }">
              <div class="feedback-cell min-w-0">
                <strong class="text-sm font-bold truncate text-[var(--text-primary)] block">{{
                  row.title
                }}</strong>
                <small class="text-[11px] text-[var(--text-secondary)] truncate block mt-0.5"
                  >{{ typeLabel(row.type) }} · {{ row.description }}</small
                >
              </div>
            </template>
          </TableColumn>

          <TableColumn label="用户" width="180">
            <template #default="{ row }">
              <div class="user-cell flex items-center gap-2">
                <UserAvatar :user="row.user" size="xs" />
                <span class="text-sm font-semibold text-[var(--text-primary)] truncate">{{
                  row.user.name || row.user.email
                }}</span>
              </div>
            </template>
          </TableColumn>

          <TableColumn label="优先级" width="120">
            <template #default="{ row }">
              <span
                class="pill text-xs px-1.5 py-0.5 font-bold"
                :class="priorityClass(row.priority)"
              >
                {{ priorityLabel(row.priority) }}
              </span>
            </template>
          </TableColumn>

          <TableColumn label="状态" width="120">
            <template #default="{ row }">
              <span class="pill text-xs px-1.5 py-0.5 font-bold" :class="statusClass(row.status)">
                {{ statusLabel(row.status) }}
              </span>
            </template>
          </TableColumn>

          <TableColumn label="附件" width="120">
            <template #default="{ row }">
              <UiButton
                v-if="row.attachmentUrl"
                variant="link"
                size="sm"
                @click.stop="showImage(row.attachmentUrl)"
              >
                查看附件
              </UiButton>
              <span v-else class="text-xs text-[var(--text-secondary)]">无</span>
            </template>
          </TableColumn>

          <TableColumn label="更新时间" width="180">
            <template #default="{ row }">
              <span class="text-xs text-[var(--text-secondary)]">{{
                formatDate(row.updatedAt || row.createdAt)
              }}</span>
            </template>
          </TableColumn>

          <TableColumn label="操作" width="80" align="right">
            <template #default="{ row }">
              <div @click.stop>
                <Dropdown trigger="click">
                  <button
                    type="button"
                    class="icon-btn p-1 rounded hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                  >
                    <MoreHorizontal class="w-4 h-4 text-slate-500" />
                  </button>
                  <template #dropdown>
                    <DropdownMenu>
                      <DropdownItem @click="openDetail(row)">
                        <ChevronRight class="dropdown-icon" /> 查看详情
                      </DropdownItem>
                      <DropdownItem @click="openReplyDialog(row)">
                        <MessageSquare class="dropdown-icon" />
                        {{ row.adminReply ? '编辑回复' : '回复用户' }}
                      </DropdownItem>
                      <DropdownItem @click="updateStatus(row.id, 'IN_PROGRESS')">
                        标记处理中
                      </DropdownItem>
                      <DropdownItem @click="updateStatus(row.id, 'RESOLVED')">
                        标记已解决
                      </DropdownItem>
                      <DropdownItem @click="updateStatus(row.id, 'CLOSED')">
                        关闭反馈
                      </DropdownItem>
                      <DropdownItem divided @click="deleteFeedback(row)">
                        <Trash2 class="dropdown-icon danger" /> 删除
                      </DropdownItem>
                    </DropdownMenu>
                  </template>
                </Dropdown>
              </div>
            </template>
          </TableColumn>
        </Table>

        <div
          v-if="filteredFeedbacks.length === 0"
          class="empty-state py-12 flex flex-col items-center justify-center text-center"
        >
          <CheckCircle2 class="w-12 h-12 text-slate-300 dark:text-white/10 mb-4" />
          <strong class="text-base font-bold text-[var(--text-primary)]">没有匹配的反馈</strong>
          <span class="text-sm text-[var(--text-secondary)] mt-1"
            >当前筛选条件下暂无待处理事项。</span
          >
        </div>
      </Card>
    </main>

    <Drawer v-model="detailDrawerVisible" size="500px" :with-header="false">
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

        <div class="drawer-actions mobile-row">
          <UiButton
            variant="secondary"
            :icon="MessageSquare"
            @click="openReplyDialog(activeFeedback)"
          >
            回复
          </UiButton>
          <UiButton
            variant="primary"
            :icon="CheckCircle2"
            @click="updateStatus(activeFeedback.id, 'RESOLVED')"
          >
            解决
          </UiButton>
          <UiButton variant="danger" :icon="Trash2" @click="deleteFeedback(activeFeedback)">
            删除
          </UiButton>
        </div>
      </aside>
    </Drawer>

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
          <Select v-model="replyStatus" class="w-full custom-select">
            <SelectOption value="IN_PROGRESS" label="处理中" />
            <SelectOption value="RESOLVED" label="已解决" />
            <SelectOption value="CLOSED" label="已关闭" />
            <SelectOption value="OPEN" label="待处理" />
          </Select>
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
.admin-feedback-page {
  min-height: 0;
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

/* Media queries removed as layout elements are now handled responsively by Tailwind CSS */
</style>
