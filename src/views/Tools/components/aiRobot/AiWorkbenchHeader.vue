<script setup lang="ts">
import { computed } from 'vue';
import {
  Activity,
  BarChart3,
  BookOpen,
  Bot,
  Brain,
  ClipboardCheck,
  ClipboardList,
  Database,
  ExternalLink,
  Gauge,
  Lock,
  PlayCircle,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Wand2,
  Zap,
} from 'lucide-vue-next';
import type { AiBotAnalytics, AiBotEntitlement, TabKey } from '../../aiRobotAccessModel';

interface Props {
  analytics: AiBotAnalytics | null;
  entitlement: AiBotEntitlement | null;
  messageSummary: Record<string, number>;
  activeTab: TabKey;
  analyticsRange: number;
  autoRefresh: boolean;
  isLoading: boolean;
  isAnalyticsLoading: boolean;
  isLocked: boolean;
  canCreateMore: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  refresh: [];
  'toggle-auto-refresh': [];
  'change-range': [value: number];
  'create-click': [];
  'change-tab': [tab: TabKey];
  'go-billing': [];
}>();

const AI_BOT_MESSAGE_STATUS = {
  ERROR: 'ERROR',
  WEBHOOK_FAILED: 'WEBHOOK_FAILED',
} as const;

const rangeOptions = [
  { label: '7 天', value: 7 },
  { label: '14 天', value: 14 },
  { label: '30 天', value: 30 },
];

const tabs: Array<{ key: TabKey; label: string; icon: typeof Bot }> = [
  { key: 'overview', label: '运营总览', icon: BarChart3 },
  { key: 'operations', label: '运营动作', icon: ClipboardList },
  { key: 'integrations', label: '接入编排', icon: Bot },
  { key: 'knowledge', label: '知识库', icon: BookOpen },
  { key: 'evolution', label: '智能体进化', icon: Brain },
  { key: 'playground', label: '沙盒模拟', icon: PlayCircle },
  { key: 'templates', label: '模板工厂', icon: Wand2 },
  { key: 'diagnostics', label: '健康诊断', icon: ClipboardCheck },
];

const dailyUsagePercent = computed(() => {
  if (!props.entitlement || props.entitlement.dailyMessages <= 0) return 0;
  return Math.min(
    100,
    Math.round((props.entitlement.dailyMessageCount / props.entitlement.dailyMessages) * 100),
  );
});

const failedMessageCount = computed(
  () =>
    (props.messageSummary[AI_BOT_MESSAGE_STATUS.ERROR] || 0) +
    (props.messageSummary[AI_BOT_MESSAGE_STATUS.WEBHOOK_FAILED] || 0),
);

const workbenchPulse = computed(() => {
  if (props.isLocked) return { label: '权限锁定', className: 'pulse-warn' };
  if (failedMessageCount.value > 0)
    return { label: `${failedMessageCount.value} 个异常`, className: 'pulse-danger' };
  if ((props.analytics?.summary.activeIntegrationCount || 0) > 0)
    return { label: '运行中', className: 'pulse-good' };
  return { label: '待接入', className: 'pulse-muted' };
});
</script>

<template>
  <header
    class="top-shell sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95"
  >
    <div class="flex w-full flex-col gap-3 px-4 py-3 md:px-5">
      <div class="flex flex-row gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div class="min-w-0">
          <div class="mobile-row flex items-center gap-3">
            <div class="brand-mark">
              <Sparkles class="h-5 w-5" />
            </div>
            <div class="min-w-0">
              <h1 class="truncate text-lg font-black text-slate-950 dark:text-white">
                AI 运营与机器人中枢
              </h1>
              <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                多平台接入、知识库、发布手册、沙盒模拟、提示词编排和调用分析
              </p>
            </div>
          </div>
        </div>

        <div class="mobile-row flex flex-wrap items-center gap-2">
          <span class="pulse-pill" :class="workbenchPulse.className">
            <Activity class="h-3.5 w-3.5" />
            <span>{{ workbenchPulse.label }}</span>
          </span>
          <div class="range-switch">
            <button
              v-for="option in rangeOptions"
              :key="option.value"
              type="button"
              :class="{ active: analyticsRange === option.value }"
              @click="emit('change-range', option.value)"
            >
              {{ option.label }}
            </button>
          </div>
          <button
            type="button"
            class="secondary-btn compact-btn"
            :class="{ active: autoRefresh }"
            @click="emit('toggle-auto-refresh')"
          >
            <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': autoRefresh }" />
            <span>{{ autoRefresh ? '自动刷新' : '自动' }}</span>
          </button>
          <el-tooltip content="刷新工作台" placement="top">
            <button type="button" class="icon-btn" @click="emit('refresh')">
              <RefreshCw
                class="h-4 w-4"
                :class="{ 'animate-spin': isLoading || isAnalyticsLoading }"
              />
            </button>
          </el-tooltip>
          <button
            type="button"
            class="primary-btn"
            :disabled="!canCreateMore"
            @click="emit('create-click')"
          >
            <Plus class="h-4 w-4" />
            <span>新增接入</span>
          </button>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2 lg:grid-cols-6">
        <div class="metric-block">
          <div class="metric-icon metric-slate"><Gauge class="h-4 w-4" /></div>
          <div>
            <p class="metric-label">自动化评分</p>
            <p class="metric-value">{{ analytics?.summary.automationScore ?? 0 }}%</p>
          </div>
        </div>
        <div class="metric-block">
          <div class="metric-icon metric-emerald"><ShieldCheck class="h-4 w-4" /></div>
          <div>
            <p class="metric-label">当前会员</p>
            <p class="metric-value">{{ entitlement?.currentPlanName || '加载中' }}</p>
          </div>
        </div>
        <div class="metric-block">
          <div class="metric-icon metric-sky"><Bot class="h-4 w-4" /></div>
          <div>
            <p class="metric-label">接入数量</p>
            <p class="metric-value">
              {{ entitlement?.integrationCount || 0 }}/{{ entitlement?.maxIntegrations || 0 }}
            </p>
          </div>
        </div>
        <div class="metric-block">
          <div class="metric-icon metric-amber"><Activity class="h-4 w-4" /></div>
          <div class="min-w-0 flex-1">
            <p class="metric-label">今日调用</p>
            <p class="metric-value">
              {{ entitlement?.dailyMessageCount || 0 }}/{{ entitlement?.dailyMessages || 0 }}
            </p>
            <div class="progress-track mt-2">
              <div
                class="progress-fill progress-amber"
                :style="{ width: dailyUsagePercent + '%' }"
              ></div>
            </div>
          </div>
        </div>
        <div class="metric-block">
          <div class="metric-icon metric-rose"><Zap class="h-4 w-4" /></div>
          <div>
            <p class="metric-label">成功率</p>
            <p class="metric-value">{{ analytics?.summary.successRate ?? 100 }}%</p>
          </div>
        </div>
        <div class="metric-block">
          <div class="metric-icon metric-slate"><Database class="h-4 w-4" /></div>
          <div>
            <p class="metric-label">知识源</p>
            <p class="metric-value">
              {{ analytics?.summary.activeKnowledgeSourceCount ?? 0 }}/{{
                analytics?.summary.knowledgeSourceCount ?? 0
              }}
            </p>
          </div>
        </div>
      </div>

      <div v-if="isLocked" class="lock-band">
        <div class="flex items-center gap-3">
          <Lock class="h-5 w-5 text-amber-600 dark:text-amber-300" />
          <div>
            <p class="text-sm font-bold text-slate-900 dark:text-white">会员权限不足</p>
            <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
              AI 机器人接入从 {{ entitlement?.requiredPlanName || 'VIP' }} 会员开始开放。
            </p>
          </div>
        </div>
        <button type="button" class="secondary-btn" @click="emit('go-billing')">
          <ExternalLink class="h-4 w-4" />
          <span>查看会员</span>
        </button>
      </div>

      <nav class="tab-rail flex-wrap md:flex-nowrap">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          type="button"
          :class="{ active: activeTab === tab.key }"
          @click="emit('change-tab', tab.key)"
        >
          <component :is="tab.icon" class="h-4 w-4" />
          <span>{{ tab.label }}</span>
        </button>
      </nav>
    </div>
  </header>
</template>
