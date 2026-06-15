<script setup lang="ts">
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
import { ref, onMounted } from 'vue';
import { CreditCard, Plus, RefreshCw } from 'lucide-vue-next';
import { ElMessage } from 'element-plus';
import api from '@/utils/api';
import SubscriptionPlansTab from './components/SubscriptionPlansTab.vue';
import UserSubscriptionsTab from './components/UserSubscriptionsTab.vue';
import ActivationCodesTab from './components/ActivationCodesTab.vue';
import AdminOpsPanel from './components/AdminOpsPanel.vue';
import { fetchManagementInsights } from './adminManagementInsights';

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
  } catch (_error) {
    ElMessage.error(t('admin.failed_to_get_data'));
  } finally {
    isLoading.value = false;
  }
};

const fetchUsers = async () => {
  try {
    const res = await api.get('/api/admin/users', { params: { page: 1, limit: 200 } });
    users.value = Array.isArray(res.data) ? res.data : res.data.data;
  } catch (_error) {
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

onMounted(() => {
  fetchData();
});
</script>

<template>
  <div class="flex-1 flex flex-col h-full overflow-hidden bg-[var(--bg-app)]">
    <!-- 奢华顶栏 (超紧凑高阶版) -->
    <div
      class="relative shrink-0 border-b overflow-hidden animate-in fade-in duration-300"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <!-- 极光背景装饰 -->
      <div
        class="absolute top-0 right-0 w-96 h-full bg-gradient-to-l from-violet-500/10 via-fuchsia-500/5 to-transparent pointer-events-none"
      ></div>

      <!-- Row 1: 标题 & 选项卡 & 主要动作 -->
      <div
        class="px-4 sm:px-8 py-2.5 sm:py-3 flex flex-row items-center justify-between gap-3 relative z-10 border-b"
        style="border-color: var(--border-base)"
      >
        <div class="flex items-center gap-1.5 sm:gap-4 shrink-0 max-w-full min-w-0 overflow-hidden">
          <div class="flex items-center gap-1.5 shrink-0">
            <span
              class="p-1 rounded-xl bg-violet-500/10 text-violet-500 shadow-sm border border-violet-500/20 shrink-0"
            >
              <CreditCard class="w-4 h-4" />
            </span>
            <h1
              class="text-xs sm:text-sm font-black tracking-tight"
              style="color: var(--text-primary)"
            >
              订阅管理
            </h1>
          </div>

          <!-- 横向分段选项卡 -->
          <div
            class="flex bg-[var(--bg-app)] rounded-xl p-0.5 border border-[var(--border-base)] shadow-inner shrink-0"
          >
            <button
              type="button"
              class="px-1.5 py-0.5 sm:px-3 sm:py-1 rounded-lg text-[9px] sm:text-xs font-bold transition-all shrink-0 cursor-pointer"
              :class="
                activeTab === 'plans'
                  ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              "
              @click="activeTab = 'plans'"
            >
              订阅计划
            </button>
            <button
              type="button"
              class="px-1.5 py-0.5 sm:px-3 sm:py-1 rounded-lg text-[9px] sm:text-xs font-bold transition-all shrink-0 cursor-pointer"
              :class="
                activeTab === 'subscriptions'
                  ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              "
              @click="activeTab = 'subscriptions'"
            >
              用户订阅
            </button>
            <button
              type="button"
              class="px-1.5 py-0.5 sm:px-3 sm:py-1 rounded-lg text-[9px] sm:text-xs font-bold transition-all shrink-0 cursor-pointer"
              :class="
                activeTab === 'codes'
                  ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              "
              @click="activeTab = 'codes'"
            >
              激活码管理
            </button>
          </div>
        </div>

        <div class="flex items-center gap-1.5 sm:gap-2.5">
          <button
            type="button"
            class="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold text-[11px] transition-all shadow-sm shrink-0 whitespace-nowrap cursor-pointer"
            @click="handleCreateAction"
          >
            <Plus class="w-3.5 h-3.5" />
            <span>
              {{
                activeTab === 'plans'
                  ? t('admin.new_plan')
                  : activeTab === 'subscriptions'
                    ? t('admin.add_new_subscription')
                    : $t('admin.generate_activation_code')
              }}
            </span>
          </button>

          <button
            type="button"
            class="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl border hover:bg-slate-50 dark:hover:bg-white/5 transition-all text-[11px] font-bold shadow-sm cursor-pointer whitespace-nowrap"
            style="border-color: var(--border-base); color: var(--text-secondary)"
            @click="fetchData"
          >
            <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': isLoading }" />
            刷新
          </button>
        </div>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto p-4 sm:p-8 scrollbar-hide">
      <div class="max-w-none">
        <AdminOpsPanel scope="subscriptions" />

        <!-- Plans Tab -->
        <SubscriptionPlansTab
          v-if="activeTab === 'plans'"
          ref="plansTabRef"
          :plans="plans"
          :is-loading="isLoading"
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
          @refresh="fetchData"
        />
      </div>
    </div>
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
</style>
