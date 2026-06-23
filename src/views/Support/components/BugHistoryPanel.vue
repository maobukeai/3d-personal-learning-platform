<script setup lang="ts">
import { computed } from 'vue';
import { formatDateTime as formatDate } from '@/utils/format';
import {
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  ImageIcon,
  Inbox,
  Loader2,
  MessageSquare,
  Plus,
  RotateCcw,
  Search,
} from 'lucide-vue-next';
import Card from '@/components/ui/Card.vue';
import UiButton from '@/components/ui/Button.vue';
import UiInput from '@/components/ui/Input.vue';
import type { Feedback, FeedbackType, FeedbackPriority, FeedbackStatus } from '@/types';

interface Option<T extends string> {
  value: T | 'ALL';
  label: string;
}

interface Props {
  feedbacks: Feedback[];
  activeFeedback: Feedback | null;
  isLoadingHistory?: boolean;
  isLoadingDetail?: boolean;
  searchQuery: string;
  statusFilter: FeedbackStatus | 'ALL';
  typeFilter: FeedbackType | 'ALL';
  priorityFilter: FeedbackPriority | 'ALL';
  statusOptions: Option<FeedbackStatus>[];
  typeOptions: Array<{ value: FeedbackType; label: string; hint: string }>;
  priorityOptions: Array<{ value: FeedbackPriority; label: string; hint: string }>;
}

const props = withDefaults(defineProps<Props>(), {
  isLoadingHistory: false,
  isLoadingDetail: false,
});

const emit = defineEmits<{
  (e: 'update:searchQuery', value: string): void;
  (e: 'update:statusFilter', value: FeedbackStatus | 'ALL'): void;
  (e: 'update:typeFilter', value: FeedbackType | 'ALL'): void;
  (e: 'update:priorityFilter', value: FeedbackPriority | 'ALL'): void;
  (e: 'select', item: Feedback): void;
  (e: 'updateStatus', item: Feedback, status: 'OPEN' | 'CLOSED'): void;
  (e: 'preview', url: string): void;
  (e: 'continue'): void;
}>();

const search = computed({
  get: () => props.searchQuery,
  set: (value) => emit('update:searchQuery', value),
});

const status = computed({
  get: () => props.statusFilter,
  set: (value) => emit('update:statusFilter', value),
});

const type = computed({
  get: () => props.typeFilter,
  set: (value) => emit('update:typeFilter', value),
});

const priority = computed({
  get: () => props.priorityFilter,
  set: (value) => emit('update:priorityFilter', value),
});

const filteredFeedbacks = computed(() => {
  const keyword = search.value.trim().toLowerCase();
  return props.feedbacks.filter((item) => {
    const matchesStatus = status.value === 'ALL' || item.status === status.value;
    const matchesType = type.value === 'ALL' || item.type === type.value;
    const matchesPriority = priority.value === 'ALL' || item.priority === priority.value;
    const matchesSearch =
      !keyword ||
      item.title.toLowerCase().includes(keyword) ||
      item.description.toLowerCase().includes(keyword);
    return matchesStatus && matchesType && matchesPriority && matchesSearch;
  });
});

const ticketNo = (id?: string) => (id ? `#${id.slice(0, 8).toUpperCase()}` : '#NEW');

const statusLabel = (statusValue: string) =>
  props.statusOptions.find((item) => item.value === statusValue)?.label || statusValue;

const typeLabel = (typeValue: string) =>
  props.typeOptions.find((item) => item.value === typeValue)?.label || typeValue;

const priorityLabel = (priorityValue: string) =>
  props.priorityOptions.find((item) => item.value === priorityValue)?.label || priorityValue;

const statusTone = (statusValue: string) => ({
  'tone-red': statusValue === 'OPEN',
  'tone-amber': statusValue === 'IN_PROGRESS',
  'tone-green': statusValue === 'RESOLVED',
  'tone-slate': statusValue === 'CLOSED',
});

const priorityTone = (priorityValue: string) => ({
  'tone-green': priorityValue === 'LOW',
  'tone-amber': priorityValue === 'MEDIUM',
  'tone-red': priorityValue === 'HIGH',
});

const progressPercent = (statusValue: string) => {
  const map: Record<string, number> = {
    OPEN: 25,
    IN_PROGRESS: 55,
    RESOLVED: 82,
    CLOSED: 100,
  };
  return map[statusValue] || 20;
};

const _formatRelativeDate = (value?: string | null) => {
  if (!value) return '无记录';
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.floor(diff / 60000));
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
};
</script>

<template>
  <div class="history-layout">
    <Card class="ticket-list-panel !p-0">
      <div class="toolbar">
        <UiInput
          v-model="search"
          :icon="Search"
          placeholder="搜索标题或描述"
          :glass="false"
          class="min-w-[200px]"
        />
        <select v-model="status" class="custom-select toolbar-select">
          <option v-for="item in statusOptions" :key="item.value" :value="item.value">
            {{ item.label }}
          </option>
        </select>
        <select v-model="type" class="custom-select toolbar-select">
          <option value="ALL">全部类型</option>
          <option v-for="item in typeOptions" :key="item.value" :value="item.value">
            {{ item.label }}
          </option>
        </select>
        <select v-model="priority" class="custom-select toolbar-select">
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
        <UiButton variant="primary" :icon="Plus" @click="emit('continue')">新建工单</UiButton>
      </div>

      <div v-else class="ticket-list">
        <button
          v-for="item in filteredFeedbacks"
          :key="item.id"
          type="button"
          class="ticket-row"
          :class="{ selected: activeFeedback?.id === item.id }"
          @click="emit('select', item)"
        >
          <div class="row-main">
            <span class="ticket-id">{{ ticketNo(item.id) }}</span>
            <strong>{{ item.title }}</strong>
            <small>{{ typeLabel(item.type) }} · {{ formatDate(item.updatedAt) }}</small>
          </div>
          <div class="row-meta">
            <span class="status-pill" :class="statusTone(item.status)">
              {{ statusLabel(item.status) }}
            </span>
            <span class="status-pill" :class="priorityTone(item.priority)">
              P{{ priorityLabel(item.priority) }}
            </span>
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
        <div class="detail-head mobile-row">
          <div class="min-w-0">
            <p class="eyebrow">{{ ticketNo(activeFeedback.id) }}</p>
            <h2 class="truncate">{{ activeFeedback.title }}</h2>
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
          @click="emit('preview', activeFeedback.attachmentUrl)"
        >
          查看附件截图
          <ArrowUpRight />
        </UiButton>

        <div class="detail-actions mobile-row">
          <UiButton
            v-if="activeFeedback.status !== 'CLOSED'"
            variant="secondary"
            :icon="CheckCircle2"
            @click="emit('updateStatus', activeFeedback, 'CLOSED')"
          >
            我已确认，关闭
          </UiButton>
          <UiButton
            v-else
            variant="secondary"
            :icon="RotateCcw"
            @click="emit('updateStatus', activeFeedback, 'OPEN')"
          >
            重新打开
          </UiButton>
          <UiButton variant="primary" :icon="Plus" @click="emit('continue')">继续反馈</UiButton>
        </div>
      </template>
    </Card>
  </div>
</template>
