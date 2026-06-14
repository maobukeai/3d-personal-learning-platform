<script setup lang="ts">
import { computed } from 'vue';
import {
  ClipboardList,
  RefreshCw,
  Target,
  ClipboardCheck,
  CheckCircle,
  Gauge,
  Database,
  BookOpen,
} from 'lucide-vue-next';
import type { AiBotOperationsReport, SignalLevel } from '../../aiRobotAccessModel';

const props = defineProps<{
  operationsReport: AiBotOperationsReport | null;
  isOperationsLoading: boolean;
}>();

const emit = defineEmits<{
  (e: 'fetch-operations'): void;
  (e: 'focus-action', action: { integrationId?: string; area?: string }): void;
  (e: 'open-diagnostics', integrationId: string): void;
  (e: 'change-tab', tab: string): void;
}>();

const sortedOperationActions = computed(() => {
  const weight: Record<string, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };
  return [...(props.operationsReport?.actions || [])].sort(
    (a, b) => (weight[b.priority] || 0) - (weight[a.priority] || 0),
  );
});

const getOperationPriorityClass = (priority: string) => {
  if (priority === 'critical' || priority === 'high') return 'status-danger';
  if (priority === 'medium') return 'status-processing';
  return 'status-muted';
};

const getOperationStatusText = (status: string) => {
  if (status === 'blocked') return '阻塞';
  if (status === 'attention') return '关注';
  if (status === 'ready') return '可执行';
  return '已完成';
};

const getSignalClass = (level: SignalLevel) => {
  if (level === 'healthy') return 'signal-healthy';
  if (level === 'warning') return 'signal-warning';
  return 'signal-critical';
};
</script>

<template>
  <section class="grid gap-3 xl:grid-cols-[minmax(0,1fr)_22rem]">
    <div class="space-y-3">
      <div class="tool-panel p-3">
        <div class="grid gap-3 md:grid-cols-4">
          <div class="mini-metric">
            <span>待处理动作</span>
            <strong>{{ operationsReport?.summary.openActions || 0 }}</strong>
          </div>
          <div class="mini-metric">
            <span>关键阻塞</span>
            <strong>{{ operationsReport?.summary.criticalActions || 0 }}</strong>
          </div>
          <div class="mini-metric">
            <span>健康信号</span>
            <strong>{{ operationsReport?.summary.healthySignals || 0 }}</strong>
          </div>
          <div class="mini-metric">
            <span>月度预测</span>
            <strong>{{ operationsReport?.summary.projectedMonthlyMessages || 0 }}</strong>
          </div>
        </div>
      </div>

      <div class="tool-panel">
        <div class="panel-head">
          <div class="panel-title">
            <ClipboardList class="h-4 w-4 text-sky-500" />
            <span>运营动作队列</span>
          </div>
          <button
            type="button"
            class="secondary-btn"
            :disabled="isOperationsLoading"
            @click="emit('fetch-operations')"
          >
            <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': isOperationsLoading }" />
            <span>刷新</span>
          </button>
        </div>
        <div v-if="sortedOperationActions.length" class="operation-list">
          <article v-for="action in sortedOperationActions" :key="action.id" class="operation-card">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="status-pill" :class="getOperationPriorityClass(action.priority)">{{
                    action.priority
                  }}</span>
                  <span class="status-pill status-muted">{{ action.area }}</span>
                  <span class="status-pill status-processing">{{
                    getOperationStatusText(action.status)
                  }}</span>
                </div>
                <h2 class="mt-2 text-sm font-black text-slate-950 dark:text-white">
                  {{ action.title }}
                </h2>
                <p class="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {{ action.description }}
                </p>
                <p class="mt-2 text-[11px] font-bold text-slate-500 dark:text-slate-300">
                  {{ action.cta }}
                </p>
              </div>
              <div class="action-meta">
                <span>{{ action.impact }}</span>
                <strong>{{ action.effort }}</strong>
              </div>
            </div>
            <div class="mt-3 flex flex-wrap items-center gap-2">
              <button type="button" class="secondary-btn" @click="emit('focus-action', action)">
                <Target class="h-4 w-4" />
                <span>处理</span>
              </button>
              <button
                v-if="action.integrationId"
                type="button"
                class="secondary-btn"
                @click="emit('open-diagnostics', action.integrationId)"
              >
                <ClipboardCheck class="h-4 w-4" />
                <span>诊断</span>
              </button>
            </div>
          </article>
        </div>
        <div v-else class="empty-state-sm">
          <CheckCircle class="h-8 w-8 text-emerald-300" />
          <p>暂无运营动作</p>
        </div>
      </div>
    </div>

    <aside class="space-y-3">
      <div class="tool-panel">
        <div class="panel-head">
          <div class="panel-title">
            <Gauge class="h-4 w-4 text-amber-500" />
            <span>质量泳道</span>
          </div>
        </div>
        <div class="signal-list">
          <article
            v-for="lane in operationsReport?.lanes || []"
            :key="lane.key"
            class="signal-row"
            :class="getSignalClass(lane.level)"
          >
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="text-xs font-black">{{ lane.label }}</p>
                <p class="mt-1 text-[11px] opacity-75">{{ lane.description }}</p>
              </div>
              <span>{{ lane.value }}%</span>
            </div>
            <div class="progress-track mt-3">
              <div class="progress-fill" :style="{ width: lane.value + '%' }"></div>
            </div>
          </article>
        </div>
      </div>

      <div class="tool-panel">
        <div class="panel-head">
          <div class="panel-title">
            <Database class="h-4 w-4 text-emerald-500" />
            <span>知识沉淀</span>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3 p-3">
          <div class="mini-metric">
            <span>全部知识</span>
            <strong>{{ operationsReport?.summary.knowledgeSourceCount || 0 }}</strong>
          </div>
          <div class="mini-metric">
            <span>启用知识</span>
            <strong>{{ operationsReport?.summary.activeKnowledgeSourceCount || 0 }}</strong>
          </div>
        </div>
        <div class="border-t border-slate-100 p-3 dark:border-slate-900">
          <button
            type="button"
            class="primary-btn w-full justify-center"
            @click="emit('change-tab', 'knowledge')"
          >
            <BookOpen class="h-4 w-4" />
            <span>管理知识库</span>
          </button>
        </div>
      </div>
    </aside>
  </section>
</template>
