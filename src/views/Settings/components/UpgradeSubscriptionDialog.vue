<script setup lang="ts">
import {
  Check,
  Crown,
  Zap,
  CreditCard,
  ArrowUpRight,
  RefreshCw,
  TrendingUp,
} from 'lucide-vue-next';
import Modal from '@/components/ui/Modal.vue';
import Button from '@/components/ui/Button.vue';

interface BillingPlan {
  id: string;
  name: string;
  displayName?: string | null;
  price: number;
  yearlyPrice?: number | null;
  priority: number;
  features?: string[];
}

interface BillingSubscription {
  id?: string;
  status?: string;
  interval?: 'MONTHLY' | 'YEARLY';
  plan?: BillingPlan | null;
}

interface Props {
  upgradePlan: BillingPlan | null;
  mySubscription: BillingSubscription | null;
  billingInterval: 'MONTHLY' | 'YEARLY';
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'confirm'): void;
}>();

const show = defineModel<boolean>('show', { required: true });

const getPlanIcon = (name?: string | null) => {
  if (name === 'VIP') return Zap;
  if (name === 'SVIP') return Crown;
  return CreditCard;
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
</script>

<template>
  <Modal
    :show="show"
    :title="isUpgradeAvailable(upgradePlan) ? '升级订阅' : '续费订阅'"
    @close="show = false"
  >
    <div v-if="upgradePlan" class="space-y-6">
      <div class="flex items-center gap-4 p-4 rounded-2xl bg-[var(--bg-app)] mobile-row">
        <div class="p-3 rounded-xl" :class="getPlanBgColor(upgradePlan.name)">
          <component :is="getPlanIcon(upgradePlan.name)" class="w-5 h-5 text-white" />
        </div>
        <div>
          <p class="font-bold text-[var(--text-primary)]">
            {{ upgradePlan.displayName || upgradePlan.name }}
          </p>
          <p class="text-xs text-[var(--text-secondary)]">
            ￥{{ getDisplayPrice(upgradePlan) }}/{{ billingInterval === 'YEARLY' ? '年' : '月' }}
          </p>
        </div>
      </div>

      <div
        v-if="isUpgradeAvailable(upgradePlan)"
        class="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-200 dark:border-emerald-900/20"
      >
        <div class="flex items-start gap-3 mobile-row">
          <TrendingUp class="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
          <div>
            <p class="text-xs font-bold text-emerald-800 dark:text-emerald-400">升级优惠</p>
            <p class="text-[10px] text-emerald-700 dark:text-emerald-500 mt-1">
              从 {{ mySubscription?.plan?.displayName || mySubscription?.plan?.name }} 升级至
              {{ upgradePlan.displayName || upgradePlan.name }}
            </p>
            <p class="text-[10px] text-emerald-700 dark:text-emerald-500">
              原计划剩余价值将自动抵扣，仅需支付差价
            </p>
          </div>
        </div>
      </div>

      <div
        v-else
        class="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-200 dark:border-blue-900/20"
      >
        <div class="flex items-start gap-3 mobile-row">
          <RefreshCw class="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
          <div>
            <p class="text-xs font-bold text-blue-800 dark:text-blue-400">续费说明</p>
            <p class="text-[10px] text-blue-700 dark:text-blue-500 mt-1">
              续费将从当前日期开始新的订阅周期
            </p>
          </div>
        </div>
      </div>

      <ul class="space-y-2">
        <li
          v-for="feature in (upgradePlan.features || []).slice(0, 4)"
          :key="feature"
          class="flex items-start gap-2"
        >
          <div class="p-0.5 bg-emerald-500/10 rounded-full text-emerald-500 shrink-0 mt-0.5">
            <Check class="w-2.5 h-2.5" />
          </div>
          <span class="text-xs text-[var(--text-secondary)]">{{ feature }}</span>
        </li>
        <li
          v-if="(upgradePlan.features || []).length > 4"
          class="text-[10px] text-[var(--text-muted)] pl-5"
        >
          还有 {{ (upgradePlan.features || []).length - 4 }} 项权益...
        </li>
      </ul>

      <div class="flex gap-3 mobile-row">
        <Button variant="secondary" full-width @click="show = false"> 取消 </Button>
        <Button
          variant="primary"
          full-width
          :icon="ArrowUpRight"
          icon-position="right"
          @click="emit('confirm')"
        >
          {{ isUpgradeAvailable(upgradePlan) ? '确认升级' : '确认续费' }}
        </Button>
      </div>
    </div>
  </Modal>
</template>
