<script setup lang="ts">
import { formatDateTime as formatDate } from '@/utils/format';
import { computed } from 'vue';
import {
  Bot,
  Plus,
  MessageSquare,
  CheckCircle,
  PauseCircle,
  PlayCircle,
  ClipboardCheck,
  Settings,
  RotateCcw,
  Trash2,
  Copy,
  Send,
  RefreshCw,
  Activity,
  AlertTriangle,
} from 'lucide-vue-next';
import { ElMessage } from '@/utils/feedbackBridge';
import api from '@/utils/api';
import type { AiBotIntegration, AiBotEntitlement, AiBotMessage } from '../../aiRobotAccessModel';

const props = defineProps<{
  integrations: AiBotIntegration[];
  selectedId: string;
  selectedIntegration: AiBotIntegration | null;
  entitlement: AiBotEntitlement | null;
  messages: AiBotMessage[];
  messageTotal: number;
  messageSummary: Record<string, number>;
  messageStatusFilter: string;
  messageSearch: string;
  latestReply: string;
  testPrompt: string;
  isMessagesLoading: boolean;
  isTesting: boolean;
  isReplayingMessageId: string;
}>();

const emit = defineEmits<{
  (e: 'update:testPrompt', val: string): void;
  (e: 'update:messageStatusFilter', val: string): void;
  (e: 'update:messageSearch', val: string): void;
  (e: 'create-click'): void;
  (e: 'select-integration', id: string): void;
  (e: 'toggle-status', integration: AiBotIntegration): void;
  (e: 'diagnostics-click'): void;
  (e: 'edit-click', integration: AiBotIntegration): void;
  (e: 'rotate-token'): void;
  (e: 'delete-click', integration: AiBotIntegration): void;
  (e: 'replay-message', message: AiBotMessage): void;
  (e: 'test-integration'): void;
  (e: 'fetch-messages'): void;
  (e: 'clear-message-filters'): void;
}>();

const apiBaseUrl = computed(() => {
  const fallback = typeof window !== 'undefined' ? window.location.origin : '';
  const baseUrl = String(api.defaults.baseURL || fallback).replace(/\/+$/, '');
  return baseUrl.endsWith('/api') ? baseUrl.slice(0, -4) : baseUrl;
});

const selectedCallbackUrl = computed(() => {
  if (!props.selectedIntegration) return '';
  return (
    props.selectedIntegration.callbackUrl ||
    `${apiBaseUrl.value}${props.selectedIntegration.callbackPath}`
  );
});

const selectedModelLabel = computed(() => {
  if (!props.selectedIntegration) return '跟随系统默认';
  return props.selectedIntegration.aiModelLabel || '跟随系统默认';
});

const canCreateMore = computed(() => {
  if (!props.entitlement) return false;
  return (
    props.entitlement.enabled &&
    props.entitlement.integrationCount < props.entitlement.maxIntegrations
  );
});

const getPlatformToneClass = (platform: string) => {
  const toneMap: Record<string, string> = {
    WEWORK: 'tone-emerald',
    DINGTALK: 'tone-sky',
    FEISHU: 'tone-rose',
    CUSTOM: 'tone-amber',
  };
  return toneMap[platform] || 'tone-amber';
};

const statusText = (status: string) => {
  const map: Record<string, string> = {
    ACTIVE: '启用',
    PAUSED: '暂停',
  };
  return map[status] || status;
};

const responseModeOptions = [
  { value: 'BACKGROUND_WEBHOOK', label: '后台运行' },
  { value: 'CALLBACK_AND_WEBHOOK', label: '同步响应' },
  { value: 'CALLBACK_ONLY', label: '仅回调' },
];

const responseModeText = (mode?: string | null) =>
  responseModeOptions.find((option) => option.value === mode)?.label || '同步响应';

const compactModelName = (integration: AiBotIntegration) => {
  if (integration.aiModelProvider && integration.aiModelName) {
    return `${integration.aiModelProvider} · ${integration.aiModelName}`;
  }
  return integration.aiModelName || integration.aiModelProvider || '系统默认';
};

const FAILED_MESSAGE_STATUSES = new Set<string>(['ERROR', 'WEBHOOK_FAILED']);
const isMessageReplayable = (message: AiBotMessage) => FAILED_MESSAGE_STATUSES.has(message.status);

const getMessageStatusClass = (status: string) => {
  if (status === 'SUCCESS') return 'status-success';
  if (status === 'PROCESSING' || status === 'QUEUED') return 'status-processing';
  if (status === 'IGNORED') return 'status-muted';
  return 'status-danger';
};

const copyText = async (value: string, label = '内容') => {
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
    ElMessage.success(`${label}已复制`);
  } catch {
    ElMessage.warning('当前浏览器不支持自动复制');
  }
};

const messageStatusOptions = [
  { label: '全部', value: 'ALL' },
  { label: '排队', value: 'QUEUED' },
  { label: '处理中', value: 'PROCESSING' },
  { label: '成功', value: 'SUCCESS' },
  { label: '失败', value: 'ERROR' },
  { label: '发送失败', value: 'WEBHOOK_FAILED' },
  { label: '忽略', value: 'IGNORED' },
];

const totalMessageCount = computed(() =>
  Object.values(props.messageSummary).reduce((sum, count) => sum + count, 0),
);

const messageStatusCount = (status: string) =>
  status === 'ALL' ? totalMessageCount.value : props.messageSummary[status] || 0;
</script>

<template>
  <section class="mobile-adaptive grid gap-3 grid-cols-1 xl:grid-cols-[18rem_minmax(0,1fr)]">
    <aside class="tool-panel min-h-[26rem]">
      <div class="panel-head mobile-row">
        <div class="panel-title">
          <MessageSquare class="h-4 w-4 text-slate-500" />
          <span>接入列表</span>
        </div>
        <span class="count-pill">{{ integrations.length }}</span>
      </div>

      <div v-if="integrations.length" class="max-h-[calc(100vh-15rem)] overflow-y-auto p-2">
        <button
          v-for="integration in integrations"
          :key="integration.id"
          type="button"
          class="integration-row"
          :class="{ 'integration-row-active': selectedId === integration.id }"
          @click="emit('select-integration', integration.id)"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <span class="truncate text-sm font-black">{{ integration.name }}</span>
                <span class="platform-pill" :class="getPlatformToneClass(integration.platform)">{{
                  integration.platformLabel
                }}</span>
              </div>
              <p class="mt-1 truncate text-[11px] text-slate-500 dark:text-slate-300">
                {{ compactModelName(integration) }}
              </p>
              <p class="mt-0.5 truncate text-[11px] text-slate-400">
                {{ responseModeText(integration.responseMode) }} ·
                {{ integration.webhookUrlMasked || '回调响应模式' }}
              </p>
            </div>
            <CheckCircle
              v-if="integration.status === 'ACTIVE'"
              class="h-4 w-4 shrink-0 text-emerald-500"
            />
            <PauseCircle v-else class="h-4 w-4 shrink-0 text-amber-500" />
          </div>
          <div class="mt-3 flex items-center justify-between text-[11px] text-slate-400">
            <span>{{ formatDate(integration.lastUsedAt) }}</span>
            <span>{{ statusText(integration.status) }}</span>
          </div>
        </button>
      </div>

      <div v-else class="empty-state">
        <Bot class="h-10 w-10 text-slate-300 dark:text-slate-700" />
        <p class="mt-3 text-sm font-bold text-slate-700 dark:text-slate-200">暂无机器人接入</p>
        <button
          type="button"
          class="mt-4 primary-btn"
          :disabled="!canCreateMore"
          @click="emit('create-click')"
        >
          <Plus class="h-4 w-4" />
          <span>新增接入</span>
        </button>
      </div>
    </aside>

    <section v-if="selectedIntegration" class="flex min-w-0 flex-col gap-3">
      <div class="tool-panel">
        <div
          class="flex flex-col gap-3 border-b border-slate-200 px-3 py-3 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between"
        >
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="truncate text-base font-black text-slate-950 dark:text-white">
                {{ selectedIntegration.name }}
              </h2>
              <span
                class="platform-pill"
                :class="getPlatformToneClass(selectedIntegration.platform)"
                >{{ selectedIntegration.platformLabel }}</span
              >
              <span
                class="status-pill"
                :class="
                  selectedIntegration.status === 'ACTIVE' ? 'status-success' : 'status-processing'
                "
              >
                {{ statusText(selectedIntegration.status) }}
              </span>
              <span class="status-pill status-muted">{{
                responseModeText(selectedIntegration.responseMode)
              }}</span>
            </div>
            <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {{ selectedModelLabel }} · 最近使用：{{ formatDate(selectedIntegration.lastUsedAt) }}
            </p>
          </div>
          <div class="mobile-row flex flex-wrap items-center gap-2">
            <button
              type="button"
              class="secondary-btn"
              @click="emit('toggle-status', selectedIntegration)"
            >
              <PauseCircle v-if="selectedIntegration.status === 'ACTIVE'" class="h-4 w-4" />
              <PlayCircle v-else class="h-4 w-4" />
              <span>{{ selectedIntegration.status === 'ACTIVE' ? '暂停' : '启用' }}</span>
            </button>
            <button type="button" class="secondary-btn" @click="emit('diagnostics-click')">
              <ClipboardCheck class="h-4 w-4" />
              <span>诊断</span>
            </button>
            <button
              type="button"
              class="secondary-btn"
              @click="emit('edit-click', selectedIntegration)"
            >
              <Settings class="h-4 w-4" />
              <span>配置</span>
            </button>
            <Tooltip content="轮换回调 Token" placement="top">
              <button type="button" class="icon-btn" @click="emit('rotate-token')">
                <RotateCcw class="h-4 w-4" />
              </button>
            </Tooltip>
            <Tooltip content="删除" placement="top">
              <button
                type="button"
                class="danger-icon-btn"
                @click="emit('delete-click', selectedIntegration)"
              >
                <Trash2 class="h-4 w-4" />
              </button>
            </Tooltip>
          </div>
        </div>

        <div class="grid gap-3 grid-cols-1 p-3 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div class="space-y-3">
            <div>
              <label class="field-label">回调地址</label>
              <div class="copy-field mt-2">
                <input :value="selectedCallbackUrl" readonly />
                <button type="button" @click="copyText(selectedCallbackUrl, '回调地址')">
                  <Copy class="h-4 w-4" />
                </button>
              </div>
            </div>

            <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <div class="info-line">
                <span class="info-label">AI 模型</span>
                <span class="info-value truncate text-right">{{ selectedModelLabel }}</span>
              </div>
              <div class="info-line">
                <span class="info-label">处理模式</span>
                <span class="info-value">{{
                  responseModeText(selectedIntegration.responseMode)
                }}</span>
              </div>
              <div class="info-line">
                <span class="info-label">外发 Webhook</span>
                <span class="info-value">{{
                  selectedIntegration.hasWebhookUrl ? '已配置' : '未配置'
                }}</span>
              </div>
              <div class="info-line">
                <span class="info-label">签名密钥</span>
                <span class="info-value">{{
                  selectedIntegration.hasSecret ? '已配置' : '未配置'
                }}</span>
              </div>
              <div class="info-line">
                <span class="info-label">触发词</span>
                <span class="info-value"
                  >{{ selectedIntegration.triggerKeywords.length || 0 }} 个</span
                >
              </div>
            </div>

            <div class="prompt-preview">
              <div class="flex items-center justify-between gap-3">
                <label class="field-label">系统提示词</label>
                <button
                  v-if="selectedIntegration.systemPrompt"
                  type="button"
                  class="mini-link"
                  @click="copyText(selectedIntegration.systemPrompt || '', '系统提示词')"
                >
                  <Copy class="h-3.5 w-3.5" />
                  <span>复制</span>
                </button>
              </div>
              <p
                class="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-slate-600 dark:text-slate-300"
              >
                {{
                  selectedIntegration.systemPrompt ||
                  '尚未配置专属系统提示词，可从模板工厂套用后再微调。'
                }}
              </p>
            </div>

            <div v-if="selectedIntegration.triggerKeywords.length" class="flex flex-wrap gap-2">
              <span
                v-for="keyword in selectedIntegration.triggerKeywords"
                :key="keyword"
                class="keyword-pill"
                >{{ keyword }}</span
              >
            </div>
          </div>

          <div class="test-box">
            <div class="panel-title">
              <Send class="h-4 w-4 text-sky-500" />
              <span>真实测试</span>
            </div>
            <textarea
              :value="testPrompt"
              class="form-textarea mt-3 min-h-[6rem]"
              @input="emit('update:testPrompt', ($event.target as HTMLTextAreaElement).value)"
            ></textarea>
            <button
              type="button"
              class="mt-3 w-full primary-btn justify-center"
              :disabled="isTesting || selectedIntegration.status !== 'ACTIVE'"
              @click="emit('test-integration')"
            >
              <RefreshCw v-if="isTesting" class="h-4 w-4 animate-spin" />
              <Send v-else class="h-4 w-4" />
              <span>{{ isTesting ? '测试中' : '发送到真实通道' }}</span>
            </button>
          </div>
        </div>
      </div>

      <div v-if="latestReply" class="reply-band">
        <CheckCircle class="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
        <p class="whitespace-pre-wrap text-xs leading-relaxed text-slate-700 dark:text-slate-200">
          {{ latestReply }}
        </p>
      </div>

      <div class="tool-panel">
        <div class="panel-head message-head">
          <div class="panel-title">
            <Activity class="h-4 w-4 text-slate-500" />
            <span>最近消息</span>
            <span class="count-pill">{{ messageTotal }}</span>
          </div>
          <div class="message-tools">
            <div class="category-switch message-status-switch">
              <button
                v-for="option in messageStatusOptions"
                :key="option.value"
                type="button"
                :class="{ active: messageStatusFilter === option.value }"
                @click="
                  emit('update:messageStatusFilter', option.value);
                  emit('fetch-messages');
                "
              >
                <span>{{ option.label }}</span>
                <span v-if="messageStatusCount(option.value)" class="status-count">{{
                  messageStatusCount(option.value)
                }}</span>
              </button>
            </div>
            <div class="log-search">
              <input
                :value="messageSearch"
                placeholder="搜消息/用户/错误"
                @input="emit('update:messageSearch', ($event.target as HTMLInputElement).value)"
                @keydown.enter="emit('fetch-messages')"
              />
              <button type="button" @click="emit('fetch-messages')">
                <RefreshCw class="h-3.5 w-3.5" :class="{ 'animate-spin': isMessagesLoading }" />
              </button>
            </div>
            <button type="button" class="icon-btn-small" @click="emit('clear-message-filters')">
              <RotateCcw class="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div v-if="messages.length" class="divide-y divide-slate-100 dark:divide-slate-900">
          <article v-for="message in messages" :key="message.id" class="message-row">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex min-w-0 flex-wrap items-center gap-2">
                <span class="status-pill" :class="getMessageStatusClass(message.status)">{{
                  statusText(message.status)
                }}</span>
                <span class="text-[11px] text-slate-400">{{ formatDate(message.createdAt) }}</span>
                <span v-if="message.externalUserId" class="truncate text-[11px] text-slate-400">{{
                  message.externalUserId
                }}</span>
              </div>
              <button
                v-if="isMessageReplayable(message)"
                type="button"
                class="mini-link"
                :disabled="isReplayingMessageId === message.id"
                @click="emit('replay-message', message)"
              >
                <RefreshCw
                  class="h-3.5 w-3.5"
                  :class="{ 'animate-spin': isReplayingMessageId === message.id }"
                />
                <span>重放</span>
              </button>
            </div>
            <p class="mt-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
              {{ message.inboundText }}
            </p>
            <p
              v-if="message.outboundText"
              class="mt-2 line-clamp-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400"
            >
              {{ message.outboundText }}
            </p>
            <p v-if="message.error" class="mt-2 flex items-center gap-1.5 text-xs text-rose-500">
              <AlertTriangle class="h-3.5 w-3.5" />
              <span>{{ message.error }}</span>
            </p>
          </article>
        </div>

        <div v-else class="empty-state-sm">
          <MessageSquare class="h-9 w-9 text-slate-300 dark:text-slate-700" />
          <p>暂无消息记录</p>
        </div>
      </div>
    </section>

    <section v-else class="tool-panel empty-state min-h-[24rem]">
      <Bot class="h-12 w-12 text-slate-300 dark:text-slate-700" />
      <h2 class="mt-4 text-base font-bold text-slate-900 dark:text-white">
        选择或新增一个机器人接入
      </h2>
      <button
        type="button"
        class="mt-5 primary-btn"
        :disabled="!canCreateMore"
        @click="emit('create-click')"
      >
        <Plus class="h-4 w-4" />
        <span>新增接入</span>
      </button>
    </section>
  </section>
</template>
