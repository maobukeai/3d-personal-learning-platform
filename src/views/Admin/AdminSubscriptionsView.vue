<script setup lang="ts">
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
import { ref, onMounted, computed } from 'vue';
import { CreditCard, Plus, RefreshCw, Users, Key, Search } from 'lucide-vue-next';
import { ElMessage } from '@/utils/feedbackBridge';
import api from '@/utils/api';
import SubscriptionPlansTab from './components/SubscriptionPlansTab.vue';
import UserSubscriptionsTab from './components/UserSubscriptionsTab.vue';
import ActivationCodesTab from './components/ActivationCodesTab.vue';
import { fetchManagementInsights } from './adminManagementInsights';
import Button from '@/components/ui/Button.vue';
import Card from '@/components/ui/Card.vue';
import AdminHeader from './components/AdminHeader.vue';
import Badge from '@/components/ui/Badge.vue';
import Tabs from '@/components/ui/Tabs.vue';

interface SubscriptionPlan {
  id: string;
  name: string;
  displayName: string | null;
  price: number;
  badgeColor: string | null;
  interval: string;
  maxStorage: number;
  maxTeams: number;
  [key: string]: unknown;
}

interface SubscriptionRecord {
  id: string;
  userId: string;
  planId: string;
  status: string;
  interval: string;
  startDate: string;
  endDate: string | null;
  autoRenew: boolean;
  cancelAtPeriodEnd: boolean;
  paymentMethod: string | null;
  [key: string]: unknown;
}

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  [key: string]: unknown;
}

interface ActivationCodeRecord {
  id: string;
  code: string;
  status: string;
  createdAt: string;
  [key: string]: unknown;
}

const plans = ref<SubscriptionPlan[]>([]);
const subscriptions = ref<SubscriptionRecord[]>([]);
const users = ref<AdminUser[]>([]);
const activationCodes = ref<ActivationCodeRecord[]>([]);
const isLoading = ref(true);
const activeTab = ref('plans');
const searchQuery = ref('');

const plansTabRef = ref<InstanceType<typeof SubscriptionPlansTab> | null>(null);
const subsTabRef = ref<InstanceType<typeof UserSubscriptionsTab> | null>(null);
const codesTabRef = ref<InstanceType<typeof ActivationCodesTab> | null>(null);

const fetchData = async () => {
  isLoading.value = true;
  try {
    const [plansRes, subsRes, codesRes] = await Promise.all([
      api.get('/api/admin/subscription-plans'),
      api.get('/api/admin/subscriptions'),
      api
        .get('/api/admin/activation-codes', { params: { page: 1, limit: 200 } })
        .catch(() => ({ data: [] })),
    ]);
    plans.value = plansRes.data;
    subscriptions.value = subsRes.data;
    activationCodes.value = Array.isArray(codesRes.data) ? codesRes.data : codesRes.data.data;
    fetchManagementInsights(true);
  } catch {
    ElMessage.error(t('admin.failed_to_get_data'));
  } finally {
    isLoading.value = false;
  }
};

const fetchUsers = async () => {
  try {
    const res = await api.get('/api/admin/users', { params: { page: 1, limit: 200 } });
    users.value = Array.isArray(res.data) ? res.data : res.data.data;
  } catch {
    ElMessage.error(t('admin.failed_to_get_user'));
  }
};

const handleCreateAction = () => {
  if (activeTab.value === 'plans') {
    plansTabRef.value?.openCreatePlan();
  } else if (activeTab.value === 'subscriptions') {
    subsTabRef.value?.openCreateSubscription();
  } else if (activeTab.value === 'codes') {
    codesTabRef.value?.openCreateCodes();
  }
};

const monthlyIncome = computed(() => {
  return subscriptions.value
    .filter((sub) => sub.status === 'ACTIVE' || sub.status === 'active')
    .reduce((sum, sub) => {
      const plan = plans.value.find((p) => p.id === sub.planId);
      if (!plan) return sum;
      const isYearly =
        sub.interval === 'YEARLY' ||
        sub.interval === 'yearly' ||
        plan.interval === 'YEARLY' ||
        plan.interval === 'yearly';
      const monthlyPrice = isYearly ? plan.price / 12 : plan.price;
      return sum + monthlyPrice;
    }, 0);
});

const expiringSoonCount = computed(() => {
  return subscriptions.value.filter((sub) => {
    if (sub.status !== 'ACTIVE' && sub.status !== 'active') return false;
    return (
      sub.cancelAtPeriodEnd ||
      (sub.endDate && new Date(sub.endDate).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000)
    );
  }).length;
});

const usedCodesCount = computed(() => {
  return activationCodes.value.filter((c) => c.status === 'USED' || c.status === 'used').length;
});

const consolidatedCards = computed(() => {
  const activeSubs = subscriptions.value.filter(
    (sub) => sub.status === 'ACTIVE' || sub.status === 'active',
  ).length;
  const income = monthlyIncome.value;
  const expiring = expiringSoonCount.value;
  const usedCodes = usedCodesCount.value;
  const totalPlans = plans.value.length;
  const totalCodes = activationCodes.value.length;

  return [
    {
      label: '活跃订阅',
      value: activeSubs,
      hint: `${totalPlans} 个套餐计划`,
      icon: CreditCard,
      color: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20',
      health: { label: '运行中' },
    },
    {
      label: '月收入估算',
      value: `¥${Math.round(income)}`,
      hint: '按当前活跃订阅估算',
      icon: CreditCard,
      color: 'text-indigo-600 bg-indigo-500/10 border-indigo-500/20',
      health: { label: '正常' },
    },
    {
      label: '即将到期',
      value: expiring,
      hint: '当前预约取消数',
      icon: CreditCard,
      color: 'text-amber-600 bg-amber-500/10 border-amber-500/20',
      health: { label: expiring > 0 ? '关注' : '正常' },
    },
    {
      label: '激活码',
      value: usedCodes,
      hint: `${totalCodes} 个激活码总量`,
      icon: Key,
      color: 'text-purple-600 bg-purple-500/10 border-purple-500/20',
      health: { label: `${totalCodes - usedCodes} 个待使用` },
    },
  ];
});

const getBadgeVariant = (label: string) => {
  if (label === '运行中' || label === '正常') return 'success';
  if (label === '关注') return 'warning';
  return 'primary';
};

const tabOptions = computed(() => [
  { label: '订阅计划', value: 'plans', icon: CreditCard },
  { label: '用户订阅', value: 'subscriptions', icon: Users },
  { label: '激活码管理', value: 'codes', icon: Key },
]);

onMounted(() => {
  fetchData();
});
</script>

<template>
  <div
    class="admin-subscriptions-page flex flex-1 min-h-0 flex-col overflow-hidden text-[var(--text-primary)] mobile-adaptive"
  >
    <main class="min-h-0 flex-1 overflow-y-auto p-2 sm:p-2.5 space-y-2 scrollbar-hide">
      <!-- Page Header -->
      <!-- Ultra-Compact Single Row Header -->
      <AdminHeader
        title="订阅管理"
        :cards="consolidatedCards"
        v-model="searchQuery"
        placeholder="搜索当前列表..."
      >
        <Button
          variant="primary"
          size="sm"
          :icon="Plus"
          @click="handleCreateAction"
          class="!h-7.5 !text-xs !px-2.5"
        >
          {{
            activeTab === 'plans'
              ? t('admin.new_plan')
              : activeTab === 'subscriptions'
                ? t('admin.add_new_subscription')
                : $t('admin.generate_activation_code')
          }}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          :icon="RefreshCw"
          :loading="isLoading"
          @click="fetchData"
          class="!h-7.5 !text-xs !px-2.5"
        >
          刷新
        </Button>
      </AdminHeader>

      <!-- Tabs Switcher Card in Main Body -->
      <Card padding="sm" class="mt-3">
        <div class="flex items-center justify-between">
          <Tabs v-slot="{}" v-model="activeTab" :options="tabOptions" variant="solid" />
        </div>
      </Card>

      <!-- Workspace layout: Single Column Workspace -->
      <div class="mt-3 w-full min-w-0">
        <div class="space-y-3 min-w-0">
          <!-- Plans Tab -->
          <SubscriptionPlansTab
            v-if="activeTab === 'plans'"
            ref="plansTabRef"
            :plans="plans"
            :is-loading="isLoading"
            :search-query="searchQuery"
            @refresh="fetchData"
          />

          <!-- Subscriptions Tab -->
          <UserSubscriptionsTab
            v-if="activeTab === 'subscriptions'"
            ref="subsTabRef"
            :subscriptions="subscriptions"
            :plans="plans"
            :users="users"
            :is-loading="isLoading"
            :search-query="searchQuery"
            @refresh="fetchData"
            @fetch-users="fetchUsers"
          />

          <!-- Codes Tab -->
          <ActivationCodesTab
            v-if="activeTab === 'codes'"
            ref="codesTabRef"
            :activation-codes="activationCodes"
            :plans="plans"
            :is-loading="isLoading"
            :search-query="searchQuery"
            @refresh="fetchData"
          />
        </div>
      </div>
    </main>
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

.admin-subscriptions-page {
  background: transparent;
}
</style>
