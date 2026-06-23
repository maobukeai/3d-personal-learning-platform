<script setup lang="ts">
import { computed } from 'vue';
import { Check, Crown, Zap, CreditCard } from 'lucide-vue-next';
import Switch from '@/components/ui/Switch.vue';

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

interface BillingSubscription {
  id?: string;
  status?: string;
  interval?: 'MONTHLY' | 'YEARLY';
  autoRenew?: boolean;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: string;
  endDate?: string;
  plan?: BillingPlan | null;
}

interface Props {
  plans: BillingPlan[];
  mySubscription: BillingSubscription | null;
  billingInterval: 'MONTHLY' | 'YEARLY';
}

const props = defineProps<Props>();

const emit = defineEmits(['update:billingInterval', 'subscribe']);

const isYearly = computed({
  get: () => props.billingInterval === 'YEARLY',
  set: (value) => emit('update:billingInterval', value ? 'YEARLY' : 'MONTHLY'),
});

const getPlanIcon = (name?: string | null) => {
  if (name === 'VIP') return Zap;
  if (name === 'SVIP') return Crown;
  return CreditCard;
};

const getPlanColor = (name?: string | null) => {
  if (name === 'VIP') return 'text-violet-500';
  if (name === 'SVIP') return 'text-amber-500';
  return 'text-blue-500';
};

const getPlanBgColor = (name?: string | null) => {
  if (name === 'VIP') return 'bg-violet-500';
  if (name === 'SVIP') return 'bg-amber-500';
  return 'bg-blue-500';
};

const getDisplayPrice = (plan?: BillingPlan | null) => {
  if (!plan) return 0;
  if (props.billingInterval === 'YEARLY' && plan.yearlyPrice) {
    return plan.yearlyPrice;
  }
  return plan.price;
};

const isUpgradeAvailable = (plan?: BillingPlan | null) => {
  if (!plan) return false;
  const currentPriority = props.mySubscription?.plan?.priority || 0;
  return (
    plan.priority > currentPriority &&
    props.mySubscription?.status === 'ACTIVE' &&
    props.mySubscription?.plan?.name !== 'FREE'
  );
};

const isCurrentPlan = (plan: BillingPlan) => {
  return plan.id === props.mySubscription?.plan?.id && props.mySubscription?.status === 'ACTIVE';
};
</script>

<template>
  <div id="pricing-plans-section" class="space-y-6 scroll-mt-6">
    <div class="text-center space-y-4 px-4">
      <h2 class="text-2xl md:text-3xl font-black text-[var(--text-primary)]">选择适合您的方案</h2>
      <p class="text-sm text-[var(--text-secondary)]">解锁更多 3D 资产、高级材质和无限协作空间</p>

      <div class="flex items-center justify-center gap-3 pt-2 mobile-row">
        <span
          class="text-sm font-bold truncate"
          :class="
            billingInterval === 'MONTHLY'
              ? 'text-[var(--text-primary)]'
              : 'text-[var(--text-muted)]'
          "
          >月付</span
        >
        <Switch v-model="isYearly" />
        <span
          class="text-sm font-bold"
          :class="
            billingInterval === 'YEARLY' ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'
          "
          >年付</span
        >
        <span
          v-if="billingInterval === 'YEARLY'"
          class="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 text-[10px] font-black rounded-full"
          >省20%</span
        >
      </div>
    </div>

    <!-- Responsive grid stacked on mobile, 3 columns on desktop -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 pt-6">
      <div
        v-for="plan in plans"
        :key="plan.id"
        class="relative p-6 md:p-8 rounded-3xl border transition-all duration-500 flex flex-col h-full overflow-hidden premium-billing-card"
        :class="[
          isCurrentPlan(plan)
            ? 'border-accent bg-accent/5 ring-1 ring-accent shadow-lg md:shadow-2xl'
            : 'border-[var(--border-base)] bg-[var(--bg-card)] hover:shadow-xl',
        ]"
      >
        <div
          v-if="plan.isPopular"
          class="absolute top-4 right-4 px-3 py-1 text-white text-[10px] font-black rounded-full uppercase tracking-widest"
          :class="getPlanBgColor(plan.name)"
        >
          推荐
        </div>

        <div class="mb-6 md:mb-8">
          <div class="p-2.5 md:p-3 bg-[var(--bg-app)] w-fit rounded-2xl mb-4">
            <component
              :is="getPlanIcon(plan.name)"
              class="w-5 h-5 md:w-6 md:h-6"
              :class="getPlanColor(plan.name)"
            />
          </div>
          <h3 class="text-lg md:text-xl font-black text-[var(--text-primary)] truncate">
            {{ plan.displayName || plan.name }}
          </h3>
          <div class="mt-4 flex items-baseline gap-1">
            <span class="text-3xl md:text-4xl font-black text-[var(--text-primary)]"
              >￥{{ getDisplayPrice(plan) }}</span
            >
            <span class="text-xs md:text-sm font-medium text-[var(--text-secondary)]"
              >/{{ billingInterval === 'YEARLY' ? '年' : '月' }}</span
            >
          </div>
        </div>

        <!-- Complete benefits features listing -->
        <ul class="space-y-3.5 md:space-y-4 mb-6 md:mb-10 flex-1">
          <li
            v-for="feature in plan.features || []"
            :key="feature"
            class="flex items-start gap-2.5"
          >
            <div class="p-0.5 bg-emerald-500/10 rounded-full text-emerald-500 shrink-0 mt-0.5">
              <Check class="w-3 h-3" />
            </div>
            <span class="text-xs md:text-sm text-[var(--text-secondary)]">{{ feature }}</span>
          </li>
        </ul>

        <button
          type="button"
          class="w-full py-2.5 md:py-4 rounded-xl md:rounded-2xl font-bold text-xs md:text-sm transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer hover:-translate-y-0.5 active:scale-95"
          :class="[
            isCurrentPlan(plan)
              ? 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border border-emerald-500/20'
              : plan.isPopular
                ? 'bg-gradient-to-r from-accent to-blue-600 text-white shadow-lg shadow-accent/25 hover:shadow-accent/40'
                : 'bg-[var(--bg-app)] text-[var(--text-primary)] border border-[var(--border-base)] hover:border-accent hover:text-accent',
          ]"
          @click="emit('subscribe', plan)"
        >
          {{
            isCurrentPlan(plan)
              ? '当前方案 (续费)'
              : isUpgradeAvailable(plan)
                ? '立即升级'
                : '选择此方案'
          }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.premium-billing-card {
  background: var(--bg-card);
  border: 1px solid var(--border-base);
  box-shadow: var(--shadow-sm);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.premium-billing-card:hover {
  border-color: color-mix(in srgb, var(--accent) 35%, var(--border-base));
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05);
  transform: translateY(-2px);
}
.premium-billing-card.border-accent:hover {
  border-color: var(--accent) !important;
  box-shadow: 0 12px 30px rgba(59, 130, 246, 0.15) !important;
}
</style>
