<script setup lang="ts">
import { computed } from 'vue';
import { Crown, Zap, CreditCard } from 'lucide-vue-next';

interface BillingPlan {
  id: string;
  name: string;
  displayName?: string | null;
  price: number;
  yearlyPrice?: number | null;
  priority: number;
  maxStorage: number;
  maxTeams: number;
  maxProjects: number;
  maxAssets: number;
  features?: string[];
  isPopular?: boolean;
  badgeColor?: string | null;
}

interface Props {
  plans: BillingPlan[];
}

const props = defineProps<Props>();

const _getPlanIcon = (name?: string | null) => {
  if (name === 'VIP') return Zap;
  if (name === 'SVIP') return Crown;
  return CreditCard;
};

const getPlanColor = (name?: string | null) => {
  if (name === 'VIP') return 'text-violet-500';
  if (name === 'SVIP') return 'text-amber-500';
  return 'text-blue-500';
};

const comparisonRows = computed(() => [
  {
    label: '存储空间',
    values: props.plans.map((p: BillingPlan) => (p.maxStorage >= 9999 ? '∞' : `${p.maxStorage}G`)),
  },
  {
    label: '协作团队',
    values: props.plans.map((p: BillingPlan) => (p.maxTeams >= 999 ? '∞' : `${p.maxTeams}个`)),
  },
  {
    label: '项目/资产',
    values: props.plans.map(
      (p: BillingPlan) =>
        `${p.maxProjects >= 9999 ? '∞' : p.maxProjects}/${p.maxAssets >= 9999 ? '∞' : p.maxAssets}`,
    ),
  },
  { label: '支持/渲染', values: ['社区/标', '1对1/优', '专属/独'] },
]);
</script>

<template>
  <div class="space-y-4">
    <h2 class="text-lg md:text-xl font-bold text-[var(--text-primary)]">方案对比</h2>
    <div
      class="mobile-table rounded-3xl border border-[var(--border-base)] bg-[var(--bg-card)] overflow-x-hidden shadow-sm"
    >
      <table class="w-full min-w-full text-left border-collapse">
        <thead>
          <tr class="bg-[var(--bg-app)]/50 border-b border-[var(--border-base)]">
            <th
              class="w-[28%] md:w-auto px-4 md:px-6 py-2.5 md:py-3 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]"
            >
              功能
            </th>
            <th
              v-for="plan in plans"
              :key="plan.id"
              class="px-4 md:px-6 py-2.5 md:py-3 text-[10px] font-black uppercase tracking-widest text-center"
              :class="getPlanColor(plan.name)"
            >
              {{ plan.displayName || plan.name }}
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[var(--border-base)]">
          <tr
            v-for="row in comparisonRows"
            :key="row.label"
            class="hover:bg-[var(--bg-app)]/30 transition-colors"
          >
            <td
              class="px-4 md:px-6 py-2.5 md:py-3 text-xs md:text-sm font-bold text-[var(--text-primary)] truncate"
            >
              {{ row.label }}
            </td>
            <td
              v-for="(val, idx) in row.values"
              :key="idx"
              class="px-4 md:px-6 py-2.5 md:py-3 text-xs md:text-sm text-center text-[var(--text-secondary)]"
            >
              {{ val }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
@media (max-width: 767px) {
  .mobile-table table {
    font-size: 10px;
  }

  .mobile-table th,
  .mobile-table td {
    padding: 3px 6px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}
</style>
