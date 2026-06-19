<script setup lang="ts">
import { formatDateTime as formatDate } from '@/utils/format';
import { computed } from 'vue';
import {
  LineChart,
  Layers,
  Target,
  Bot,
  Gauge,
  ClipboardCheck,
  CheckCircle,
  AlertTriangle,
} from 'lucide-vue-next';
import type { AiBotAnalytics, SignalLevel } from '../../aiRobotAccessModel';

const props = defineProps<{
  analytics: AiBotAnalytics | null;
  analyticsRange: number;
}>();

const maxTimelineValue = computed(() => {
  const values = props.analytics?.timeline.map((item) => item.total) || [];
  return Math.max(1, ...values);
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

const getSignalClass = (level: SignalLevel) => {
  if (level === 'healthy') return 'signal-healthy';
  if (level === 'warning') return 'signal-warning';
  return 'signal-critical';
};
</script>

<template>
  <section class="grid gap-3 xl:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.55fr)]">
    <div class="space-y-3">
      <div class="tool-panel">
        <div class="panel-head">
          <div class="panel-title">
            <LineChart class="h-4 w-4 text-sky-500" />
            <span>调用趋势</span>
          </div>
          <span class="panel-caption">近 {{ analytics?.range.days || analyticsRange }} 天</span>
        </div>
        <div class="timeline-chart">
          <div
            v-for="point in analytics?.timeline || []"
            :key="point.date"
            class="timeline-bar-wrap"
          >
            <div class="timeline-bar">
              <div
                class="timeline-success"
                :style="{ height: Math.max(4, (point.success / maxTimelineValue) * 100) + '%' }"
              ></div>
              <div
                class="timeline-failed"
                :style="{ height: Math.max(0, (point.failed / maxTimelineValue) * 100) + '%' }"
              ></div>
            </div>
            <span>{{ point.label }}</span>
          </div>
        </div>
      </div>

      <div class="grid gap-3 lg:grid-cols-2">
        <div class="tool-panel">
          <div class="panel-head">
            <div class="panel-title">
              <Layers class="h-4 w-4 text-emerald-500" />
              <span>平台分布</span>
            </div>
          </div>
          <div class="divide-y divide-slate-100 dark:divide-slate-900">
            <article
              v-for="metric in analytics?.platformMetrics || []"
              :key="metric.platform"
              class="platform-row"
            >
              <div class="flex items-center gap-3">
                <span class="platform-pill" :class="getPlatformToneClass(metric.platform)">{{
                  metric.platformLabel
                }}</span>
                <div>
                  <p class="text-xs font-bold text-slate-800 dark:text-slate-100">
                    {{ metric.activeCount }}/{{ metric.integrationCount }} 启用
                  </p>
                  <p class="mt-1 text-[11px] text-slate-400">
                    最近：{{ formatDate(metric.lastUsedAt) }}
                  </p>
                </div>
              </div>
              <div class="text-right">
                <p class="text-sm font-black text-slate-900 dark:text-white">
                  {{ metric.successRate }}%
                </p>
                <p class="mt-1 text-[11px] text-slate-400">{{ metric.messageCount }} 条消息</p>
              </div>
            </article>
          </div>
        </div>

        <div class="tool-panel">
          <div class="panel-head">
            <div class="panel-title">
              <Target class="h-4 w-4 text-rose-500" />
              <span>高频接入</span>
            </div>
          </div>
          <div class="divide-y divide-slate-100 dark:divide-slate-900">
            <article
              v-for="item in analytics?.topIntegrations || []"
              :key="item.id"
              class="top-row"
            >
              <div class="min-w-0">
                <p class="truncate text-xs font-bold text-slate-800 dark:text-slate-100">
                  {{ item.name }}
                </p>
                <p class="mt-1 text-[11px] text-slate-400">
                  {{ item.platformLabel }} · {{ statusText(item.status) }}
                </p>
              </div>
              <div class="min-w-[8rem]">
                <div class="flex items-center justify-between text-[11px] text-slate-400">
                  <span>{{ item.messageCount }} 次</span>
                  <span>{{ item.successRate }}%</span>
                </div>
                <div class="progress-track mt-1.5">
                  <div
                    class="progress-fill progress-sky"
                    :style="{ width: item.successRate + '%' }"
                  ></div>
                </div>
              </div>
            </article>
            <div v-if="!(analytics?.topIntegrations || []).length" class="empty-state-sm">
              <Bot class="h-8 w-8 text-slate-300 dark:text-slate-700" />
              <p>暂无调用数据</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <aside class="space-y-3">
      <div class="tool-panel">
        <div class="panel-head">
          <div class="panel-title">
            <Gauge class="h-4 w-4 text-amber-500" />
            <span>质量信号</span>
          </div>
        </div>
        <div class="signal-list">
          <article
            v-for="signal in analytics?.qualitySignals || []"
            :key="signal.key"
            class="signal-row"
            :class="getSignalClass(signal.level)"
          >
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="text-xs font-black">{{ signal.label }}</p>
                <p class="mt-1 text-[11px] opacity-75">{{ signal.description }}</p>
              </div>
              <span>{{ signal.value }}%</span>
            </div>
            <div class="progress-track mt-3">
              <div class="progress-fill" :style="{ width: signal.value + '%' }"></div>
            </div>
          </article>
        </div>
      </div>

      <div class="tool-panel">
        <div class="panel-head">
          <div class="panel-title">
            <ClipboardCheck class="h-4 w-4 text-emerald-500" />
            <span>下一步动作</span>
          </div>
        </div>
        <div class="action-list">
          <div v-for="action in analytics?.nextBestActions || []" :key="action" class="action-row">
            <CheckCircle class="h-4 w-4 shrink-0 text-emerald-500" />
            <p>{{ action }}</p>
          </div>
        </div>
      </div>

      <div class="tool-panel">
        <div class="panel-head">
          <div class="panel-title">
            <AlertTriangle class="h-4 w-4 text-rose-500" />
            <span>最近异常</span>
          </div>
        </div>
        <div
          v-if="analytics?.recentFailures.length"
          class="divide-y divide-slate-100 dark:divide-slate-900"
        >
          <article
            v-for="failure in analytics.recentFailures"
            :key="failure.id"
            class="failure-row"
          >
            <p class="text-xs font-bold text-slate-800 dark:text-slate-100">
              {{ failure.integrationName }}
            </p>
            <p class="mt-1 line-clamp-2 text-[11px] text-slate-500 dark:text-slate-400">
              {{ failure.error || failure.inboundText }}
            </p>
          </article>
        </div>
        <div v-else class="empty-state-sm">
          <CheckCircle class="h-8 w-8 text-emerald-300" />
          <p>近期没有失败记录</p>
        </div>
      </div>
    </aside>
  </section>
</template>
