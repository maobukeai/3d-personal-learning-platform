<script setup lang="ts">
import { computed } from 'vue';
import { CreditCard, Crown, HardDrive, FolderOpen, Box, KeyRound, Zap } from 'lucide-vue-next';
import Input from '@/components/ui/Input.vue';
import Switch from '@/components/ui/Switch.vue';
import Button from '@/components/ui/Button.vue';

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

interface Props {
  mySubscription: BillingSubscription | null;
  storageUsage: StorageUsage | null;
  subscriptionLimits: SubscriptionLimits | null;
  storageProgress: number;
  isRedeeming: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits(['redeem', 'cancelSubscription', 'scrollToPlans', 'toggleAutoRenew']);

const activationCode = defineModel<string>('activationCode', { default: '' });

const getPlanIcon = (name?: string | null) => {
  if (name === 'VIP') return Zap;
  if (name === 'SVIP') return Crown;
  return CreditCard;
};

const formatStorageValue = (gb?: number) => {
  if (gb === undefined || gb === null) return '0 GB';
  if (gb < 0.1) {
    return `${(gb * 1024).toFixed(1)} MB`;
  }
  return `${gb.toFixed(2)} GB`;
};

const isPaidPlan = computed(() => {
  return props.mySubscription?.plan?.name !== 'FREE' && props.mySubscription?.status === 'ACTIVE';
});
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
    <!-- Card 1: Current Plan Status -->
    <div
      class="premium-billing-card p-4 rounded-3xl border border-[var(--border-base)] bg-[var(--bg-card)] shadow-sm flex flex-col justify-between relative overflow-hidden group"
    >
      <div>
        <div class="flex items-center justify-between mb-4 mobile-row">
          <div class="min-w-0">
            <h3 class="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              当前方案
            </h3>
            <div class="flex items-baseline gap-2 mt-1 mobile-row">
              <span
                class="text-2xl font-black text-[var(--text-primary)] truncate max-w-[160px] md:max-w-none"
              >
                {{ mySubscription?.plan?.displayName || mySubscription?.plan?.name || '免费版' }}
              </span>
              <span
                v-if="isPaidPlan"
                class="px-2 py-0.5 rounded-full text-[10px] font-black bg-accent/10 text-accent"
              >
                {{ mySubscription?.interval === 'YEARLY' ? '年付' : '月付' }}
              </span>
            </div>
          </div>
          <div
            class="p-3 rounded-2xl transition-all duration-300"
            :style="{
              backgroundColor: (mySubscription?.plan?.badgeColor || '#3b82f6') + '15',
              color: mySubscription?.plan?.badgeColor || '#3b82f6',
            }"
          >
            <component :is="getPlanIcon(mySubscription?.plan?.name)" class="w-6 h-6" />
          </div>
        </div>

        <div class="space-y-2 mt-4 text-xs text-[var(--text-secondary)]">
          <div class="flex justify-between items-center">
            <span>订阅状态</span>
            <span
              class="font-semibold"
              :class="isPaidPlan ? 'text-emerald-500' : 'text-[var(--text-muted)]'"
            >
              {{ isPaidPlan ? '已激活' : '未激活' }}
            </span>
          </div>
          <div v-if="mySubscription?.endDate" class="flex justify-between items-center">
            <span>有效期至</span>
            <span class="font-medium text-[var(--text-primary)]">
              {{ new Date(mySubscription.endDate).toLocaleDateString() }}
            </span>
          </div>
        </div>
      </div>

      <div v-if="isPaidPlan" class="space-y-3 mt-6 pt-4 border-t border-[var(--border-base)]">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-[var(--text-secondary)]">自动续费</span>
          <Switch
            :model-value="!!mySubscription?.autoRenew"
            @update:model-value="emit('toggleAutoRenew')"
          />
        </div>
        <button
          type="button"
          class="w-full py-2 border border-dashed border-rose-200 dark:border-rose-900/30 rounded-xl text-xs font-bold text-rose-500 hover:bg-rose-500/5 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          @click="emit('cancelSubscription')"
        >
          取消订阅
        </button>
      </div>
      <div v-else class="mt-6 pt-4 border-t border-[var(--border-base)]">
        <button
          type="button"
          class="w-full py-2.5 bg-accent text-white rounded-xl text-xs font-bold shadow-md shadow-accent/20 hover:shadow-accent/30 hover:-translate-y-0.5 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          @click="emit('scrollToPlans')"
        >
          升级订阅计划
        </button>
      </div>
    </div>

    <!-- Card 2: Storage & Resource Usage -->
    <div
      class="premium-billing-card p-4 rounded-3xl border border-[var(--border-base)] bg-[var(--bg-card)] shadow-sm flex flex-col justify-between group"
    >
      <div>
        <div class="flex items-center justify-between mb-4 mobile-row">
          <div class="min-w-0">
            <h3 class="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              存储与使用量
            </h3>
            <div class="text-2xl font-black text-[var(--text-primary)] mt-1">
              {{ storageProgress }}%
            </div>
          </div>
          <div class="p-3 bg-amber-500/10 text-amber-500 rounded-2xl">
            <HardDrive class="w-6 h-6" />
          </div>
        </div>

        <div class="space-y-3">
          <div class="space-y-1.5">
            <div class="flex items-center justify-between text-xs">
              <span class="text-[var(--text-secondary)]">存储空间</span>
              <span class="text-[var(--text-primary)] font-medium">
                {{ formatStorageValue(storageUsage?.usedGB) }} /
                {{ storageUsage?.maxStorageGB || 1 }} GB
              </span>
            </div>
            <div
              class="h-2 w-full bg-[var(--bg-app)] rounded-full overflow-hidden p-0.5 border border-[var(--border-base)]"
            >
              <div
                class="h-full rounded-full transition-all duration-1000 ease-out"
                :class="
                  storageProgress > 90
                    ? 'bg-rose-500'
                    : storageProgress > 70
                      ? 'bg-amber-500'
                      : 'bg-accent'
                "
                :style="{ width: `${storageProgress}%` }"
              ></div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2 pt-1.5">
            <div
              class="flex items-center gap-1.5 p-1.5 bg-[var(--bg-app)]/50 rounded-xl border border-[var(--border-base)]"
            >
              <FolderOpen class="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <div class="min-w-0">
                <p class="text-[9px] text-[var(--text-secondary)]">协作项目</p>
                <p class="text-xs font-bold text-[var(--text-primary)] truncate">
                  {{ subscriptionLimits?.currentProjects || 0 }} /
                  {{
                    subscriptionLimits?.maxProjects === 9999
                      ? '∞'
                      : subscriptionLimits?.maxProjects || 5
                  }}
                </p>
              </div>
            </div>
            <div
              class="flex items-center gap-1.5 p-1.5 bg-[var(--bg-app)]/50 rounded-xl border border-[var(--border-base)]"
            >
              <Box class="w-3.5 h-3.5 text-purple-500 shrink-0" />
              <div class="min-w-0">
                <p class="text-[9px] text-[var(--text-secondary)]">3D 资源数</p>
                <p class="text-xs font-bold text-[var(--text-primary)] truncate">
                  {{ subscriptionLimits?.currentAssets || 0 }} /
                  {{
                    subscriptionLimits?.maxAssets === 9999
                      ? '∞'
                      : subscriptionLimits?.maxAssets || 50
                  }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Card 3: Activation Code Redemption -->
    <div
      class="premium-billing-card p-4 rounded-3xl border border-[var(--border-base)] bg-[var(--bg-card)] shadow-sm flex flex-col justify-between group"
    >
      <div class="space-y-2">
        <div class="flex items-center justify-between mobile-row">
          <div class="min-w-0">
            <h3 class="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              激活码兑换
            </h3>
            <p class="text-xs text-[var(--text-secondary)] mt-0.5">激活或延长您的订阅计划</p>
          </div>
          <div class="p-2 bg-violet-500/10 text-violet-500 rounded-2xl">
            <KeyRound class="w-5 h-5" />
          </div>
        </div>

        <div class="space-y-2">
          <p class="text-[10px] text-[var(--text-muted)] leading-relaxed">
            如果您拥有合作渠道提供的激活码，请在下方输入以兑换相应的订阅权益。
          </p>
          <div class="flex gap-2 items-center mobile-row">
            <Input
              v-model="activationCode"
              type="text"
              class="flex-1 min-w-0"
              input-class="!py-1.5 !h-8 text-xs"
              placeholder="输入激活码..."
              @keyup.enter="emit('redeem')"
            />
            <Button
              variant="primary"
              size="sm"
              :disabled="isRedeeming"
              :loading="isRedeeming"
              class="shrink-0 rounded-xl h-8 font-bold text-xs"
              @click="emit('redeem')"
            >
              兑换
            </Button>
          </div>
        </div>
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
  border-color: var(--accent);
  box-shadow: 0 12px 30px rgba(59, 130, 246, 0.15);
}
</style>
