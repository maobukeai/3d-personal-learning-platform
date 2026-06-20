<script setup lang="ts">
import { BarChart3, ListTodo, ArrowRight } from 'lucide-vue-next';
import type { FocusFilter, InsightActionItem, InsightOperationalLane } from '../types';

defineProps<{
  healthScore: number;
  completedThisWeek: number;
  highRiskProjects: number;
  compactMetrics: Array<{
    label: string;
    value: string | number;
    caption: string;
    icon: any;
    colorClass: string;
    barClass: string;
    progress: number;
    filter: FocusFilter;
  }>;
  actionItems: InsightActionItem[];
  resolvingActionId: string;
  operationalLanes: InsightOperationalLane[];
  recommendedAssigneeName: string;
}>();

const emit = defineEmits<{
  (e: 'assign-action', item: InsightActionItem): void;
  (e: 'navigate-insight', route: string): void;
  (e: 'navigate-board'): void;
}>();

const focusFilter = defineModel<FocusFilter>('focusFilter', { default: 'all' });

const severityClass = (severity: InsightActionItem['severity']) => {
  if (severity === 'critical') return 'bg-rose-500/10 text-rose-600';
  if (severity === 'high') return 'bg-amber-500/10 text-amber-600';
  return 'bg-sky-500/10 text-sky-600';
};

const activateOperationalLane = (lane: InsightOperationalLane) => {
  if (lane.key === 'unassigned') {
    focusFilter.value = 'unassigned';
  } else if (lane.key === 'dueSoon') {
    focusFilter.value = 'dueSoon';
  } else if (lane.key === 'overdue' || lane.key === 'riskProjects') {
    focusFilter.value = 'attention';
  }
};
</script>

<template>
  <div
    class="compact-ops-bar rounded-xl border p-2.5"
    style="background-color: var(--bg-card); border-color: var(--border-base)"
  >
    <div
      class="grid grid-cols-1 lg:grid-cols-[220px_1fr_320px] 2xl:grid-cols-[240px_1fr_360px] gap-2.5 items-stretch"
    >
      <!-- Left Health Score Card -->
      <div
        class="rounded-xl bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent p-2.5 flex flex-col justify-between border border-emerald-500/15 relative overflow-hidden group"
      >
        <div
          class="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-emerald-500/10 blur-xl group-hover:scale-125 transition-all duration-500"
        ></div>
        <div class="flex items-center justify-between gap-2 z-10">
          <div class="flex items-center gap-1 min-w-0">
            <div class="p-0.5 bg-emerald-500/20 rounded">
              <BarChart3 class="w-3 h-3 text-emerald-500 shrink-0" />
            </div>
            <span class="text-[11px] font-black truncate" style="color: var(--text-primary)"
              >运营健康</span
            >
          </div>
          <span
            class="px-1.5 py-0.5 rounded-full text-[8px] font-black shrink-0"
            :class="
              healthScore >= 80
                ? 'bg-emerald-500/10 text-emerald-600'
                : healthScore >= 60
                  ? 'bg-amber-500/10 text-amber-600'
                  : 'bg-rose-500/10 text-rose-600'
            "
          >
            {{ healthScore >= 80 ? '稳定' : healthScore >= 60 ? '压测中' : '需接管' }}
          </span>
        </div>
        <div class="my-1.5 flex items-baseline gap-1 z-10">
          <strong class="text-2xl font-black tracking-tight" style="color: var(--text-primary)">{{
            healthScore
          }}</strong>
          <span class="text-[9px] font-bold text-slate-400">/100</span>
        </div>
        <div class="space-y-1 z-10">
          <div class="flex items-center justify-between text-[9px] font-bold text-slate-400">
            <span>本周已交: {{ completedThisWeek }}</span>
            <span>风险项目: {{ highRiskProjects }}</span>
          </div>
          <div class="h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              class="h-full rounded-full transition-all duration-500"
              :class="
                healthScore >= 80
                  ? 'bg-emerald-500'
                  : healthScore >= 60
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
              "
              :style="{ width: healthScore + '%' }"
            ></div>
          </div>
        </div>
      </div>

      <!-- Center Metric Grid -->
      <div class="compact-metric-grid grid grid-cols-2 sm:grid-cols-3 gap-2">
        <button
          v-for="metric in compactMetrics"
          :key="metric.label"
          type="button"
          class="min-h-[52px] rounded-xl bg-slate-50/60 dark:bg-white/5 border border-slate-100 dark:border-white/5 p-2 text-left cursor-pointer hover:border-accent/30 hover:bg-accent/5 hover:scale-[1.01] active:scale-[0.99] transition-all flex flex-col justify-between"
          :class="
            focusFilter === metric.filter
              ? 'border-accent/50 bg-accent/5 ring-1 ring-accent/20'
              : ''
          "
          @click="focusFilter = metric.filter"
        >
          <div class="flex items-center justify-between gap-2 w-full">
            <span class="text-[9.5px] font-black text-slate-400 truncate">{{ metric.label }}</span>
            <div class="p-0.5 rounded bg-white dark:bg-slate-900 shadow-sm shrink-0">
              <component :is="metric.icon" class="w-3 h-3 shrink-0" :class="metric.colorClass" />
            </div>
          </div>
          <div class="mt-0.5 flex items-baseline justify-between gap-1 w-full">
            <strong class="text-sm leading-none font-black" style="color: var(--text-primary)">{{
              metric.value
            }}</strong>
            <span class="text-[8.5px] font-black text-slate-400 truncate">{{
              metric.caption
            }}</span>
          </div>
        </button>
      </div>

      <!-- Right Next Actions Card -->
      <div
        class="rounded-xl bg-slate-50/60 dark:bg-white/5 border border-slate-100 dark:border-white/5 p-2.5 flex flex-col justify-between"
      >
        <div class="flex items-center justify-between gap-2 mb-1.5">
          <div class="flex items-center gap-1 min-w-0">
            <div class="p-0.5 bg-amber-500/10 rounded">
              <ListTodo class="w-3 h-3 text-amber-500 shrink-0" />
            </div>
            <span class="text-[11px] font-black truncate" style="color: var(--text-primary)"
              >阻塞与预警</span
            >
          </div>
          <button
            type="button"
            class="text-[9.5px] font-black text-accent hover:text-accent-hover bg-transparent border-none cursor-pointer shrink-0 transition-colors"
            @click="emit('navigate-board')"
          >
            看板
          </button>
        </div>

        <div
          v-if="actionItems.length === 0"
          class="flex-1 flex items-center justify-center text-[9px] font-bold text-slate-400 min-h-[36px]"
        >
          暂无阻塞动作
        </div>
        <div v-else class="space-y-1 flex-1">
          <div
            v-for="item in actionItems.slice(0, 2)"
            :key="item.id"
            class="w-full h-6 flex items-center gap-1 rounded-lg bg-white dark:bg-slate-900/60 border border-slate-100 dark:border-white/5 px-1.5 text-left hover:bg-accent/5 hover:border-accent/20 transition-all"
          >
            <span
              class="px-1 py-0.5 rounded text-[7.5px] font-black shrink-0"
              :class="severityClass(item.severity)"
            >
              {{
                item.severity === 'critical' ? '特急' : item.severity === 'high' ? '高急' : '中急'
              }}
            </span>
            <span
              class="min-w-0 flex-1 text-[9.5px] font-black truncate"
              style="color: var(--text-primary)"
              >{{ item.title }}</span
            >
            <button
              v-if="item.type === 'TASK_UNASSIGNED'"
              type="button"
              class="h-4.5 px-1.5 rounded bg-accent text-[8px] font-black text-white hover:bg-accent-hover border-none cursor-pointer transition-colors disabled:opacity-50"
              :disabled="resolvingActionId === item.id"
              @click="emit('assign-action', item)"
            >
              {{ resolvingActionId === item.id ? '处理中' : '分派' }}
            </button>
            <button
              v-else
              type="button"
              class="p-0.5 rounded text-slate-400 hover:text-accent hover:bg-slate-100 dark:hover:bg-white/5 bg-transparent border-none cursor-pointer transition-all"
              @click="emit('navigate-insight', item.targetRoute)"
            >
              <ArrowRight class="w-2.5 h-2.5 shrink-0" />
            </button>
          </div>
        </div>

        <div v-if="operationalLanes.length" class="mt-1.5 grid grid-cols-2 gap-1">
          <button
            v-for="lane in operationalLanes"
            :key="lane.key"
            type="button"
            class="h-5 rounded bg-white dark:bg-slate-900/60 border border-slate-100 dark:border-white/5 px-1.5 text-[8.5px] font-black text-slate-500 cursor-pointer flex items-center justify-between gap-1 hover:text-accent hover:border-accent/20 hover:bg-accent/5 transition-all"
            @click="activateOperationalLane(lane)"
          >
            <span class="truncate">{{ lane.label }}</span>
            <b class="text-accent">{{ lane.count }}</b>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
