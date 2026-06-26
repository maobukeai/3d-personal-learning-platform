<script setup lang="ts">
import { useCommunityI18n } from '@/composables/useCommunityI18n';
import { formatDate } from '@/utils/format';
import type { DetailedTeam, OpsKpi } from './teamDetailTypes';

const props = defineProps<{
  team: DetailedTeam;
  parsedDescription: string;
  opsKpis: OpsKpi[];
}>();

const { t } = useCommunityI18n();

const getCategoryLabel = (cat?: string | null) => {
  if (!cat) return '';
  const mapping: Record<string, string> = {
    modeling: '建模',
    rendering: '渲染',
    animation: '动画',
    materials: '材质',
    gameEngine: '游戏引擎',
  };
  return mapping[cat] || cat;
};
</script>

<template>
  <div class="lg:col-span-1 space-y-6 text-left">
    <!-- Space Info Card -->
    <div
      class="glass-card p-5 rounded-2xl border border-white/20 dark:border-slate-800/50 bg-white/40 dark:bg-slate-900/30 backdrop-blur-md shadow-lg space-y-4"
    >
      <h3
        class="text-xs font-black uppercase tracking-widest text-slate-400 border-b pb-2"
        style="border-color: var(--border-base)"
      >
        空间信息
      </h3>
      <div class="space-y-3.5">
        <div>
          <span class="block text-[10px] font-black text-slate-400 uppercase tracking-wider"
            >空间介绍</span
          >
          <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium mt-1">
            {{ parsedDescription || '暂无空间描述信息。' }}
          </p>
        </div>
        <div class="grid grid-cols-2 gap-4 pt-2 border-t" style="border-color: var(--border-base)">
          <div>
            <span class="block text-[10px] font-black text-slate-400 uppercase tracking-wider"
              >空间类别</span
            >
            <span class="text-xs font-bold text-slate-700 dark:text-slate-200 mt-1 block">
              {{ getCategoryLabel(team.category) || '未分类' }}
            </span>
          </div>
          <div>
            <span class="block text-[10px] font-black text-slate-400 uppercase tracking-wider"
              >空间属性</span
            >
            <span class="text-xs font-bold text-slate-700 dark:text-slate-200 mt-1 block">
              {{ team.type === 'PERSONAL' ? '个人空间' : '协作空间' }}
            </span>
          </div>
        </div>
        <div class="pt-3 border-t" style="border-color: var(--border-base)">
          <div class="flex items-center justify-between text-[11px] font-bold text-slate-500">
            <span>创建时间</span>
            <span>{{ formatDate(team.createdAt) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Space Statistics KPIs (TEAM type only) -->
    <div
      v-if="team.type === 'TEAM'"
      class="glass-card p-5 rounded-2xl border border-white/20 dark:border-slate-800/50 bg-white/40 dark:bg-slate-900/30 backdrop-blur-md shadow-lg space-y-4"
    >
      <h3
        class="text-xs font-black uppercase tracking-widest text-slate-400 border-b pb-2"
        style="border-color: var(--border-base)"
      >
        运行指标
      </h3>
      <div class="grid grid-cols-1 gap-2.5">
        <div
          v-for="kpi in opsKpis"
          :key="kpi.key"
          class="flex items-center justify-between p-3 bg-white/20 dark:bg-slate-950/20 border border-white/10 dark:border-slate-800/50 rounded-xl hover:-translate-y-0.5 transition-all duration-200"
        >
          <div class="flex items-center gap-2.5 min-w-0">
            <div
              class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              :class="kpi.tone"
            >
              <component :is="kpi.icon" class="w-4 h-4" />
            </div>
            <div class="min-w-0">
              <span class="block text-[10px] font-black text-slate-400 leading-none">{{
                kpi.label
              }}</span>
              <span class="block text-[9px] font-bold text-slate-500 mt-1.5 leading-none">{{
                kpi.helper
              }}</span>
            </div>
          </div>
          <strong class="text-sm font-black tracking-tight text-slate-800 dark:text-slate-100">
            {{ kpi.value }}
          </strong>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tone-sky {
  background: rgb(14 165 233 / 0.1);
  color: rgb(2 132 199);
}

.tone-purple {
  background: rgb(168 85 247 / 0.1);
  color: rgb(147 51 234);
}

.tone-emerald {
  background: rgb(16 185 129 / 0.1);
  color: rgb(5 150 105);
}

.tone-rose {
  background: rgb(244 63 94 / 0.1);
  color: rgb(225 29 72);
}

.tone-amber {
  background: rgb(245 158 11 / 0.12);
  color: rgb(217 119 6);
}
</style>
