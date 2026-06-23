<script setup lang="ts">
import { computed } from 'vue';
import {
  ClipboardCheck,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Target,
  ShieldCheck,
} from 'lucide-vue-next';
import type { AiBotIntegration, AiBotDiagnostics } from '../../aiRobotAccessModel';

const props = defineProps<{
  selectedIntegration: AiBotIntegration | null;
  diagnostics: AiBotDiagnostics | null;
  isDiagnosticsLoading: boolean;
}>();

const emit = defineEmits<{
  (e: 'fetch-diagnostics'): void;
}>();

const activeDiagnostics = computed(
  () => props.diagnostics?.checks.filter((item) => item.status !== 'pass') || [],
);

const getDiagnosticClass = (status: string) => {
  if (status === 'pass') return 'diagnostic-pass';
  if (status === 'warn') return 'diagnostic-warn';
  return 'diagnostic-fail';
};

const statusText = (status: string) => {
  const map: Record<string, string> = {
    ACTIVE: '启用',
    PAUSED: '暂停',
    QUEUED: '排队中',
    PROCESSING: '处理中',
    SUCCESS: '成功',
    WEBHOOK_FAILED: '发送失败',
    IGNORED: '已忽略',
    ERROR: '失败',
  };
  return map[status] || status;
};
</script>

<template>
  <section class="mobile-adaptive grid gap-3 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_21rem]">
    <div class="tool-panel">
      <div class="panel-head mobile-row">
        <div class="panel-title">
          <ClipboardCheck class="h-4 w-4 text-emerald-500" />
          <span>健康诊断</span>
        </div>
        <button
          type="button"
          class="secondary-btn"
          :disabled="!selectedIntegration || isDiagnosticsLoading"
          @click="emit('fetch-diagnostics')"
        >
          <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': isDiagnosticsLoading }" />
          <span>重新诊断</span>
        </button>
      </div>

      <div v-if="diagnostics" class="p-3">
        <div class="readiness-band">
          <div>
            <p class="text-xs font-bold text-slate-500 dark:text-slate-400">生产就绪度</p>
            <p class="mt-1 text-3xl font-black text-slate-950 dark:text-white">
              {{ diagnostics.readinessScore }}%
            </p>
          </div>
          <div class="readiness-meter">
            <div :style="{ width: diagnostics.readinessScore + '%' }"></div>
          </div>
        </div>

        <div class="mt-3 grid gap-3 md:grid-cols-2">
          <article
            v-for="check in diagnostics.checks"
            :key="check.id"
            class="diagnostic-card"
            :class="getDiagnosticClass(check.status)"
          >
            <div class="flex items-start gap-3">
              <CheckCircle v-if="check.status === 'pass'" class="h-4 w-4 shrink-0" />
              <AlertTriangle v-else class="h-4 w-4 shrink-0" />
              <div>
                <p class="text-sm font-black">{{ check.label }}</p>
                <p class="mt-1 text-xs leading-relaxed opacity-80">{{ check.detail }}</p>
                <p class="mt-3 text-[11px] font-bold opacity-80">{{ check.action }}</p>
              </div>
            </div>
          </article>
        </div>
      </div>

      <div class="empty-state min-h-[20rem]">
        <ClipboardCheck class="h-12 w-12 text-slate-300 dark:text-slate-700" />
        <p class="mt-3 text-sm font-bold text-slate-700 dark:text-slate-200">
          选择接入后运行健康诊断
        </p>
      </div>
    </div>

    <aside class="space-y-3">
      <div class="tool-panel">
        <div class="panel-head mobile-row">
          <div class="panel-title">
            <Target class="h-4 w-4 text-amber-500" />
            <span>修复队列</span>
          </div>
          <span class="count-pill">{{ activeDiagnostics.length }}</span>
        </div>
        <div class="action-list">
          <div v-for="check in activeDiagnostics" :key="check.id" class="action-row">
            <AlertTriangle class="h-4 w-4 shrink-0 text-amber-500" />
            <p>{{ check.action }}</p>
          </div>
          <div v-if="!activeDiagnostics.length" class="empty-state-sm">
            <CheckCircle class="h-8 w-8 text-emerald-300" />
            <p>暂无待修复项</p>
          </div>
        </div>
      </div>

      <div class="tool-panel">
        <div class="panel-head mobile-row">
          <div class="panel-title">
            <AlertTriangle class="h-4 w-4 text-rose-500" />
            <span>诊断异常</span>
          </div>
        </div>
        <div
          v-if="diagnostics?.recentFailures.length"
          class="divide-y divide-slate-100 dark:divide-slate-900"
        >
          <article
            v-for="failure in diagnostics.recentFailures"
            :key="failure.id"
            class="failure-row"
          >
            <p class="text-xs font-bold text-slate-800 dark:text-slate-100">
              {{ statusText(failure.status) }}
            </p>
            <p class="mt-1 line-clamp-3 text-[11px] text-slate-500 dark:text-slate-400">
              {{ failure.error || failure.inboundText }}
            </p>
          </article>
        </div>
        <div v-else class="empty-state-sm">
          <ShieldCheck class="h-8 w-8 text-emerald-300" />
          <p>近 7 天没有异常</p>
        </div>
      </div>
    </aside>
  </section>
</template>
