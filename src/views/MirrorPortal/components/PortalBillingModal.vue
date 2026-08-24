<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import {
  Crown,
  Zap,
  CreditCard,
  CheckCircle2,
  Sparkles,
  KeyRound,
  Loader2,
  ShieldCheck,
  QrCode,
  Check,
} from 'lucide-vue-next';
import Modal from '@/components/ui/Modal.vue';
import Button from '@/components/ui/Button.vue';
import { useAuthStore } from '@/stores/auth';
import { ElMessage } from '@/utils/feedbackBridge';
import { getApiErrorMessage } from '@/utils/error';
import { getPlanName } from '@/utils/plans';
import api from '@/utils/api';

const props = defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:show', val: boolean): void;
  (e: 'success'): void;
}>();

const authStore = useAuthStore();
const isLoading = ref(false);
const isRedeeming = ref(false);
const isSubscribing = ref(false);
const billingInterval = ref<'MONTHLY' | 'YEARLY'>('MONTHLY');
const selectedPlanId = ref<string>('');
const activationCode = ref('');
const plans = ref<any[]>([]);
const mySubscription = ref<any>(null);
const activeTab = ref<'plans' | 'redeem'>('plans');

async function fetchPlansAndSub() {
  if (!authStore.isAuthenticated) return;
  isLoading.value = true;
  try {
    const [plansRes, subRes] = await Promise.all([
      api.get('/api/subscriptions/plans'),
      api.get('/api/subscriptions/me'),
    ]);
    plans.value = plansRes.data.filter((p: any) => p.name !== 'FREE');
    mySubscription.value = subRes.data;
    if (plans.value.length > 0 && !selectedPlanId.value) {
      selectedPlanId.value = plans.value[0].id;
    }
  } catch (e) {
    // Graceful fallback
  } finally {
    isLoading.value = false;
  }
}

const currentPlan = computed(() => {
  return plans.value.find((p) => p.id === selectedPlanId.value) || plans.value[0];
});

const currentDisplayPrice = computed(() => {
  if (!currentPlan.value) return 0;
  if (billingInterval.value === 'YEARLY' && currentPlan.value.yearlyPrice) {
    return currentPlan.value.yearlyPrice;
  }
  return currentPlan.value.price;
});

async function handleRedeem() {
  if (!activationCode.value.trim()) {
    ElMessage.warning('请输入卡密激活码');
    return;
  }
  isRedeeming.value = true;
  try {
    await api.post('/api/subscriptions/redeem', {
      code: activationCode.value.trim(),
    });
    ElMessage.success('🎉 会员卡密兑换成功！');
    activationCode.value = '';
    await fetchPlansAndSub();
    await authStore.fetchMe();
    emit('success');
  } catch (e) {
    ElMessage.error(getApiErrorMessage(e, '卡密兑换失败，请核对卡密是否有效'));
  } finally {
    isRedeeming.value = false;
  }
}

async function handleSubscribe() {
  if (!selectedPlanId.value) return;
  isSubscribing.value = true;
  try {
    await api.post('/api/subscriptions/subscribe', {
      planId: selectedPlanId.value,
      interval: billingInterval.value,
    });
    ElMessage.success('开通成功！欢迎尊贵的高级会员');
    await fetchPlansAndSub();
    await authStore.fetchMe();
    emit('success');
    emit('update:show', false);
  } catch (e) {
    ElMessage.error(getApiErrorMessage(e, '开通失败，请重试'));
  } finally {
    isSubscribing.value = false;
  }
}

watch(
  () => props.show,
  (open) => {
    if (open) fetchPlansAndSub();
  },
  { immediate: true },
);
</script>

<template>
  <Modal :show="show" title="会员权益与开通中心" size="lg" @close="emit('update:show', false)">
    <div class="space-y-5">
      <!-- Top banner for current user status -->
      <div
        class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-blue-500/10 to-transparent border border-amber-500/20"
      >
        <div class="flex items-center gap-3">
          <div class="p-2.5 rounded-xl bg-amber-500 text-white shadow-md shadow-amber-500/20">
            <Crown class="w-5 h-5" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="text-sm font-bold text-slate-900 dark:text-white">{{
                authStore.user?.name || authStore.user?.email
              }}</span>
              <span
                class="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400"
              >
                {{ getPlanName(authStore.user?.subscription?.plan?.priority ?? 0) }} 会员
              </span>
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {{
                (authStore.user?.subscription as any)?.endDate
                  ? `有效期至 ${String((authStore.user?.subscription as any).endDate).slice(0, 10)}`
                  : '开通会员，即刻畅享镜像站所有网盘资源高速解密提取'
              }}
            </p>
          </div>
        </div>

        <div class="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button
            type="button"
            class="px-3 py-1 text-xs font-bold rounded-lg transition-all"
            :class="
              activeTab === 'plans'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            "
            @click="activeTab = 'plans'"
          >
            在线开通
          </button>
          <button
            type="button"
            class="px-3 py-1 text-xs font-bold rounded-lg transition-all"
            :class="
              activeTab === 'redeem'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            "
            @click="activeTab = 'redeem'"
          >
            卡密兑换
          </button>
        </div>
      </div>

      <!-- Tab 1: Pricing Plans Selection -->
      <div v-if="activeTab === 'plans'" class="space-y-4">
        <!-- Interval Toggle -->
        <div class="flex items-center justify-center gap-2">
          <button
            type="button"
            class="px-3.5 py-1 text-xs font-bold rounded-xl transition-all"
            :class="
              billingInterval === 'MONTHLY'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
            "
            @click="billingInterval = 'MONTHLY'"
          >
            按月订阅
          </button>
          <button
            type="button"
            class="px-3.5 py-1 text-xs font-bold rounded-xl transition-all relative"
            :class="
              billingInterval === 'YEARLY'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
            "
            @click="billingInterval = 'YEARLY'"
          >
            按年订阅 (超值优惠)
            <span
              class="absolute -top-1.5 -right-2 px-1 text-[9px] font-black bg-rose-500 text-white rounded-full"
              >省</span
            >
          </button>
        </div>

        <!-- Plans Cards Grid -->
        <div v-if="isLoading" class="py-12 flex items-center justify-center">
          <Loader2 class="w-6 h-6 animate-spin text-blue-500" />
        </div>

        <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div
            v-for="plan in plans"
            :key="plan.id"
            class="relative p-4 rounded-2xl border-2 transition-all cursor-pointer bg-white/70 dark:bg-slate-800/60"
            :class="
              selectedPlanId === plan.id
                ? 'border-blue-500 shadow-md shadow-blue-500/10'
                : 'border-slate-200/80 dark:border-slate-700/60 hover:border-slate-300'
            "
            @click="selectedPlanId = plan.id"
          >
            <div class="flex items-start justify-between">
              <div>
                <h4 class="text-base font-black text-slate-900 dark:text-white">
                  {{ plan.displayName || plan.name }}
                </h4>
                <div class="mt-2 flex items-baseline gap-1">
                  <span class="text-2xl font-black text-blue-600 dark:text-blue-400"
                    >￥{{ billingInterval === 'YEARLY' ? plan.yearlyPrice : plan.price }}</span
                  >
                  <span class="text-xs text-slate-400"
                    >/ {{ billingInterval === 'YEARLY' ? '年' : '月' }}</span
                  >
                </div>
              </div>
              <div
                class="w-5 h-5 rounded-full border flex items-center justify-center"
                :class="
                  selectedPlanId === plan.id
                    ? 'border-blue-500 bg-blue-500 text-white'
                    : 'border-slate-300'
                "
              >
                <Check v-if="selectedPlanId === plan.id" class="w-3 h-3 stroke-[3]" />
              </div>
            </div>

            <ul class="mt-3 space-y-1.5 border-t border-slate-100 dark:border-slate-700/50 pt-3">
              <li class="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <CheckCircle2 class="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>全站镜像资源一键解密提取</span>
              </li>
              <li class="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <CheckCircle2 class="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>百度网盘 / 夸克网盘无限制高速下载</span>
              </li>
              <li class="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <CheckCircle2 class="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>尊贵 VIP 身份专属徽章与高速通道</span>
              </li>
            </ul>
          </div>
        </div>

        <div class="pt-2">
          <Button
            variant="primary"
            class="w-full h-11 text-sm font-bold shadow-md shadow-blue-500/20"
            :loading="isSubscribing"
            @click="handleSubscribe"
          >
            立即开通 {{ currentPlan?.displayName || '会员' }} (￥{{ currentDisplayPrice }})
          </Button>
        </div>
      </div>

      <!-- Tab 2: Redeem Code Activation -->
      <div v-else class="space-y-4 py-2">
        <div
          class="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-3"
        >
          <div class="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm">
            <KeyRound class="w-4 h-4 text-amber-500" />
            <span>输入会员卡密激活码</span>
          </div>
          <p class="text-xs text-slate-400">
            如果您在发卡网、代理分销渠道或活动中获得了卡密，请在下方输入以兑换对应会员时长。
          </p>

          <div class="flex items-center gap-2">
            <input
              v-model="activationCode"
              type="text"
              placeholder="请输入 16 或 32 位卡密激活码..."
              class="flex-1 h-10 px-3.5 text-xs md:text-sm rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 font-mono uppercase"
              @keyup.enter="handleRedeem"
            />
            <Button
              variant="primary"
              class="h-10 px-5 text-xs font-bold shrink-0"
              :loading="isRedeeming"
              @click="handleRedeem"
            >
              立即兑换
            </Button>
          </div>
        </div>
      </div>
    </div>
  </Modal>
</template>
