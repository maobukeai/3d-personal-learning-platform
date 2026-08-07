<script setup lang="ts">
import GlassCard from '@/components/ui/GlassCard.vue';
import { Database, Calculator, CheckSquare, Hash } from 'lucide-vue-next';
import type { SheetSummaryMetrics } from '../types/sheet';

defineProps<{
  metrics: SheetSummaryMetrics;
}>();
</script>

<template>
  <GlassCard class="p-3.5 mb-5 glass-real-physical glass-panel-extreme border border-white/10">
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div class="flex items-center gap-3 p-2 rounded-xl bg-white/5 border border-white/5">
        <div class="p-2 rounded-lg bg-blue-500/10 text-blue-400">
          <Database class="w-4 h-4" />
        </div>
        <div>
          <div class="text-[11px] text-neutral-400">表格数据行</div>
          <div class="text-lg font-semibold text-neutral-100">{{ metrics.totalRows }} 条</div>
        </div>
      </div>

      <!-- 数值统计 -->
      <div class="flex items-center gap-3 p-2 rounded-xl bg-white/5 border border-white/5">
        <div class="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
          <Calculator class="w-4 h-4" />
        </div>
        <div>
          <div class="text-[11px] text-neutral-400">
            {{ metrics.numberColSums[0]?.colName || '数值累加' }}
          </div>
          <div class="text-lg font-semibold text-neutral-100">
            {{ metrics.numberColSums[0] ? metrics.numberColSums[0].sum : '0' }}
          </div>
        </div>
      </div>

      <!-- 勾选完成度 -->
      <div class="flex items-center gap-3 p-2 rounded-xl bg-white/5 border border-white/5">
        <div class="p-2 rounded-lg bg-amber-500/10 text-amber-400">
          <CheckSquare class="w-4 h-4" />
        </div>
        <div>
          <div class="text-[11px] text-neutral-400">勾选打卡进度</div>
          <div class="text-lg font-semibold text-neutral-100">
            {{ metrics.completedCheckboxCount }} / {{ metrics.totalCheckboxCount }}
          </div>
        </div>
      </div>

      <!-- 均值统计 -->
      <div class="flex items-center gap-3 p-2 rounded-xl bg-white/5 border border-white/5">
        <div class="p-2 rounded-lg bg-purple-500/10 text-purple-400">
          <Hash class="w-4 h-4" />
        </div>
        <div>
          <div class="text-[11px] text-neutral-400">平均数值/分值</div>
          <div class="text-lg font-semibold text-neutral-100">
            {{ metrics.numberColSums[0] ? metrics.numberColSums[0].avg : '0' }}
          </div>
        </div>
      </div>
    </div>
  </GlassCard>
</template>
