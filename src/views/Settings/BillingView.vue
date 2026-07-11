<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { CreditCard } from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from '@/utils/feedbackBridge';
import { useRoute, useRouter } from 'vue-router';
import api from '@/utils/api';
import { useAuthStore } from '@/stores/auth';
import { getApiErrorMessage } from '@/utils/error';
import PageHeader from '@/components/PageHeader.vue';
import BillingOverview from './components/BillingOverview.vue';
import PricingPlans from './components/PricingPlans.vue';
import PlanComparisonTable from './components/PlanComparisonTable.vue';
import BillingHistory from './components/BillingHistory.vue';
import CancelSubscriptionDialog from './components/CancelSubscriptionDialog.vue';
import UpgradeSubscriptionDialog from './components/UpgradeSubscriptionDialog.vue';

const route = useRoute();
const router = useRouter();

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

interface BillingTransaction {
  id?: string;
  createdAt: string;
  description?: string | null;
  amount?: number | string;
  status?: string;
  paymentMethod?: string | null;
  invoiceNo?: string | null;
}

interface StorageUsage {
  usedMB?: number;
  usedGB?: number;
  maxStorageGB?: number;
  usagePercent?: number;
  assetCount?: number;
  materialCount?: number;
  showcaseCount?: number;
}

interface SubscriptionLimits {
  currentProjects?: number;
  maxProjects?: number;
  currentAssets?: number;
  maxAssets?: number;
}

const isLoading = ref(true);
const plans = ref<BillingPlan[]>([]);
const mySubscription = ref<BillingSubscription | null>(null);
const transactions = ref<BillingTransaction[]>([]);
const selectedPlanId = ref('');
const billingInterval = ref<'MONTHLY' | 'YEARLY'>('MONTHLY');
const storageUsage = ref<StorageUsage | null>(null);
const subscriptionLimits = ref<SubscriptionLimits | null>(null);
const showCancelDialog = ref(false);
const cancelType = ref<'immediate' | 'end_of_period'>('end_of_period');
const cancelRequires2FA = ref(false);
const twoFactorCode = ref('');
const isVerifying2FA = ref(false);
const cancelStep = ref<'confirm' | '2fa' | 'success'>('confirm');
const showUpgradeDialog = ref(false);
const upgradePlan = ref<BillingPlan | null>(null);

const activationCode = ref('');
const isRedeeming = ref(false);

const fetchBillingData = async () => {
  isLoading.value = true;
  try {
    const [plansRes, subRes, transRes, storageRes, limitsRes] = await Promise.all([
      api.get('/api/subscriptions/plans'),
      api.get('/api/subscriptions/me'),
      api.get('/api/subscriptions/transactions'),
      api.get('/api/subscriptions/storage-usage'),
      api.get('/api/subscriptions/limits'),
    ]);
    plans.value = plansRes.data;
    mySubscription.value = subRes.data;
    transactions.value = transRes.data;
    storageUsage.value = storageRes.data;
    subscriptionLimits.value = limitsRes.data;
    selectedPlanId.value =
      subRes.data.plan?.id || plans.value.find((p) => p.name === 'FREE')?.id || '';
    billingInterval.value = subRes.data.interval || 'MONTHLY';
  } catch {
    ElMessage.error('获取账单数据失败');
  } finally {
    isLoading.value = false;
  }
};

const checkCancel2FA = async () => {
  try {
    const res = await api.get('/api/subscriptions/cancel-requires-2fa');
    cancelRequires2FA.value = res.data.requires2FA;
  } catch {
    cancelRequires2FA.value = false;
  }
};

const handleRedeemCode = async () => {
  if (!activationCode.value.trim()) {
    ElMessage.warning('请输入激活码');
    return;
  }
  isRedeeming.value = true;
  try {
    const res = await api.post('/api/subscriptions/redeem', {
      code: activationCode.value.trim(),
    });
    ElMessage.success(res.data.message || '激活成功！');
    activationCode.value = '';
    fetchBillingData();
    const authStore = useAuthStore();
    await authStore.fetchMe();
  } catch (error: unknown) {
    ElMessage.error(getApiErrorMessage(error, '兑换失败，请检查激活码是否有效'));
  } finally {
    isRedeeming.value = false;
  }
};

const handleSubscribe = async (plan: BillingPlan) => {
  if (plan.id === mySubscription.value?.plan?.id && mySubscription.value?.status === 'ACTIVE') {
    ElMessage.info('您已订阅此计划');
    return;
  }

  const currentPriority = mySubscription.value?.plan?.priority || 0;
  const newPriority = plan.priority || 0;
  const isUpgrade = newPriority > currentPriority && mySubscription.value?.plan?.name !== 'FREE';
  const isRenewal = newPriority === currentPriority && mySubscription.value?.status === 'ACTIVE';

  if (isUpgrade || isRenewal) {
    upgradePlan.value = plan;
    showUpgradeDialog.value = true;
    return;
  }

  ElMessageBox.prompt(
    `请输入用于激活 ${plan.displayName || plan.name} 的激活码：`,
    '激活订阅计划',
    {
      confirmButtonText: '确认激活',
      cancelButtonText: '取消',
      inputPlaceholder: '请输入激活码...',
      inputPattern: /\S+/,
      inputErrorMessage: '激活码不能为空',
    },
  )
    .then(async ({ value }) => {
      if (!value || !value.trim()) return;
      try {
        const res = await api.post('/api/subscriptions/redeem', { code: value.trim() });
        ElMessage.success(res.data.message || '激活成功！');
        fetchBillingData();
        const authStore = useAuthStore();
        await authStore.fetchMe();
      } catch (error: unknown) {
        ElMessage.error(getApiErrorMessage(error, '激活失败，请检查激活码是否有效'));
      }
    })
    .catch(() => {});
};

const handleConfirmUpgrade = async () => {
  if (!upgradePlan.value) return;
  showUpgradeDialog.value = false;

  ElMessageBox.prompt(
    `请输入用于激活 ${upgradePlan.value.displayName || upgradePlan.value.name} 的激活码：`,
    '升级/续费订阅',
    {
      confirmButtonText: '确认激活',
      cancelButtonText: '取消',
      inputPlaceholder: '请输入激活码...',
      inputPattern: /\S+/,
      inputErrorMessage: '激活码不能为空',
    },
  )
    .then(async ({ value }) => {
      if (!value || !value.trim()) return;
      try {
        const res = await api.post('/api/subscriptions/redeem', { code: value.trim() });
        ElMessage.success(res.data.message || '激活成功！');
        fetchBillingData();
        const authStore = useAuthStore();
        await authStore.fetchMe();
      } catch (error: unknown) {
        ElMessage.error(getApiErrorMessage(error, '激活失败，请检查激活码是否有效'));
      }
    })
    .catch(() => {});
};

const openCancelDialog = async () => {
  cancelStep.value = 'confirm';
  twoFactorCode.value = '';
  cancelType.value = 'end_of_period';
  showCancelDialog.value = true;
  await checkCancel2FA();
};

const handleCancelSubscription = async () => {
  if (cancelRequires2FA.value) {
    cancelStep.value = '2fa';
    return;
  }

  try {
    const res = await api.post('/api/subscriptions/cancel', {
      immediate: cancelType.value === 'immediate',
    });
    ElMessage.success(res.data.message);
    showCancelDialog.value = false;
    cancelStep.value = 'success';
    const authStore = useAuthStore();
    await authStore.fetchMe();
    fetchBillingData();
  } catch (error: unknown) {
    ElMessage.error(getApiErrorMessage(error, '取消订阅失败'));
  }
};

const handleCancelWith2FA = async () => {
  if (!twoFactorCode.value || twoFactorCode.value.length < 6) {
    ElMessage.warning('请输入6位验证码');
    return;
  }

  isVerifying2FA.value = true;
  try {
    const res = await api.post('/api/subscriptions/cancel-with-2fa', {
      immediate: cancelType.value === 'immediate',
      twoFactorCode: twoFactorCode.value,
    });
    ElMessage.success(res.data.message);
    showCancelDialog.value = false;
    cancelStep.value = 'success';
    const authStore = useAuthStore();
    await authStore.fetchMe();
    fetchBillingData();
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'response' in error) {
      const response = (error as { response?: { data?: { requires2FA?: boolean } } }).response;
      if (response?.data?.requires2FA) {
        ElMessage.error('需要两步验证');
        return;
      }
    }
    ElMessage.error(getApiErrorMessage(error, '验证失败，请重试'));
  } finally {
    isVerifying2FA.value = false;
  }
};

const handleToggleAutoRenew = async () => {
  if (!mySubscription.value) return;
  const newValue = !mySubscription.value.autoRenew;
  try {
    const res = await api.post('/api/subscriptions/auto-renew', { autoRenew: newValue });
    ElMessage.success(res.data.message);
    mySubscription.value.autoRenew = newValue;
    mySubscription.value.cancelAtPeriodEnd = !newValue;
  } catch (error: unknown) {
    ElMessage.error(getApiErrorMessage(error, '操作失败'));
  }
};

const handleExportBilling = () => {
  if (transactions.value.length === 0) {
    ElMessage.info('暂无交易记录可导出');
    return;
  }
  const headers = ['日期', '项目描述', '金额', '状态', '支付方式', '发票号'];
  const rows = transactions.value.map((tx) => [
    new Date(tx.createdAt).toLocaleDateString(),
    tx.description || '',
    `￥${tx.amount}`,
    tx.status === 'COMPLETED' ? '已支付' : tx.status === 'PENDING' ? '处理中' : '失败',
    tx.paymentMethod || '-',
    tx.invoiceNo || '-',
  ]);
  const csvContent = [headers, ...rows].map((row) => row.join(',')).join('\n');
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `billing_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  ElMessage.success('账单已导出');
};

const storageProgress = computed(() => {
  if (!storageUsage.value) return 0;
  return storageUsage.value.usagePercent || 0;
});

const scrollToPlans = () => {
  const el = document.getElementById('pricing-plans-section');
  if (el) {
    el.scrollIntoView({ behavior: 'smooth' });
  }
};

onMounted(() => {
  fetchBillingData();

  if (route.query.success === 'true') {
    ElMessage.success('支付成功！您的订阅权限已生效。');
    router.replace({ name: 'Billing' });
  }
});
</script>

<template>
  <div class="mobile-adaptive flex-1 flex flex-col h-full overflow-hidden bg-transparent">
    <PageHeader title="订阅与账单" :icon="CreditCard" />

    <div class="flex-1 overflow-y-auto p-3 md:py-4 md:px-5 scrollbar-hide">
      <div class="max-w-none space-y-4 md:space-y-5">
        <BillingOverview
          v-model:activation-code="activationCode"
          :my-subscription="mySubscription"
          :storage-usage="storageUsage"
          :subscription-limits="subscriptionLimits"
          :storage-progress="storageProgress"
          :is-redeeming="isRedeeming"
          @redeem="handleRedeemCode"
          @cancel-subscription="openCancelDialog"
          @scroll-to-plans="scrollToPlans"
          @toggle-auto-renew="handleToggleAutoRenew"
        />

        <PricingPlans
          v-model:billing-interval="billingInterval"
          :plans="plans"
          :my-subscription="mySubscription"
          @subscribe="handleSubscribe"
        />

        <PlanComparisonTable :plans="plans" />

        <BillingHistory :transactions="transactions" @export="handleExportBilling" />

        <div
          class="p-4 md:py-4 md:px-6 rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-accent text-white flex flex-col md:flex-row items-center justify-between gap-4 md:gap-6 shadow-lg shadow-indigo-500/25"
        >
          <div class="space-y-1 text-center md:text-left">
            <h3 class="text-lg font-bold">对订阅有疑问？</h3>
            <p class="text-xs text-blue-100 opacity-90">
              如果您对计划选择或账单有任何疑问，我们的支持团队随时为您提供帮助。
            </p>
          </div>
          <button
            type="button"
            class="w-full md:w-auto px-6 py-2.5 bg-white text-indigo-600 font-bold rounded-2xl hover:scale-105 active:scale-95 duration-200 transition-all shadow-lg cursor-pointer"
            @click="$router.push('/report-bug')"
          >
            联系客户支持
          </button>
        </div>
      </div>
    </div>

    <CancelSubscriptionDialog
      v-model:show="showCancelDialog"
      v-model:cancel-type="cancelType"
      v-model:two-factor-code="twoFactorCode"
      v-model:cancel-step="cancelStep"
      :my-subscription="mySubscription"
      :cancel-requires2-f-a="cancelRequires2FA"
      :is-verifying2-f-a="isVerifying2FA"
      @cancel="handleCancelSubscription"
      @cancel-with2-f-a="handleCancelWith2FA"
    />

    <UpgradeSubscriptionDialog
      v-model:show="showUpgradeDialog"
      :upgrade-plan="upgradePlan"
      :my-subscription="mySubscription"
      :billing-interval="billingInterval"
      @confirm="handleConfirmUpgrade"
    />
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Premium Card hover states and glow adjustments */
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
  border-color: var(--accent);
  box-shadow: 0 12px 30px rgba(59, 130, 246, 0.15);
}

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
