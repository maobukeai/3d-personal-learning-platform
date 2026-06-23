<script setup lang="ts">
import { computed } from 'vue';
import { AlertTriangle, Shield, KeyRound } from 'lucide-vue-next';
import Modal from '@/components/ui/Modal.vue';
import Button from '@/components/ui/Button.vue';
import Input from '@/components/ui/Input.vue';

interface BillingPlan {
  id: string;
  name: string;
  displayName?: string | null;
  features?: string[];
}

interface BillingSubscription {
  id?: string;
  plan?: BillingPlan | null;
  endDate?: string;
}

type CancelStep = 'confirm' | '2fa' | 'success';
type CancelType = 'immediate' | 'end_of_period';

interface Props {
  mySubscription: BillingSubscription | null;
  cancelRequires2FA: boolean;
  isVerifying2FA: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'cancel'): void;
  (e: 'cancelWith2FA'): void;
}>();

const show = defineModel<boolean>('show', { required: true });
const cancelType = defineModel<CancelType>('cancelType', { required: true });
const twoFactorCode = defineModel<string>('twoFactorCode', { required: true });
const cancelStep = defineModel<CancelStep>('cancelStep', { required: true });

const formattedEndDate = computed(() => {
  if (!props.mySubscription?.endDate) return '当前周期结束';
  return new Date(props.mySubscription.endDate).toLocaleDateString();
});
</script>

<template>
  <Modal :show="show" title="取消订阅" @close="show = false">
    <!-- Step 1: Confirm cancel type -->
    <template v-if="cancelStep === 'confirm'">
      <div class="space-y-6">
        <div
          class="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-200 dark:border-amber-900/20"
        >
          <div class="flex items-start gap-3 mobile-row">
            <AlertTriangle class="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p class="text-xs font-bold text-amber-800 dark:text-amber-400">
                取消后您将失去以下权益
              </p>
              <ul class="mt-2 space-y-1">
                <li
                  v-for="(feature, idx) in (mySubscription?.plan?.features || []).slice(0, 3)"
                  :key="idx"
                  class="text-[10px] text-amber-700 dark:text-amber-500"
                >
                  • {{ feature }}
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div class="space-y-3">
          <label
            class="flex items-center gap-3 p-4 rounded-2xl border cursor-pointer transition-all mobile-row"
            :class="
              cancelType === 'end_of_period'
                ? 'border-accent bg-accent/5'
                : 'border-[var(--border-base)] hover:border-accent/50'
            "
          >
            <input
              v-model="cancelType"
              type="radio"
              value="end_of_period"
              class="accent-[var(--accent)] shrink-0"
            />
            <div>
              <p class="text-sm font-bold text-[var(--text-primary)]">周期结束后取消</p>
              <p class="text-[10px] text-[var(--text-secondary)]">
                继续享受权益至
                {{ formattedEndDate }}
              </p>
            </div>
          </label>
          <label
            class="flex items-center gap-3 p-4 rounded-2xl border cursor-pointer transition-all mobile-row"
            :class="
              cancelType === 'immediate'
                ? 'border-rose-500 bg-rose-500/5'
                : 'border-[var(--border-base)] hover:border-rose-300'
            "
          >
            <input
              v-model="cancelType"
              type="radio"
              value="immediate"
              class="accent-rose-500 shrink-0"
            />
            <div>
              <p class="text-sm font-bold text-[var(--text-primary)]">立即取消</p>
              <p class="text-[10px] text-[var(--text-secondary)]">
                立即降级为免费版，剩余时间不退款
              </p>
            </div>
          </label>
        </div>

        <div
          v-if="cancelRequires2FA"
          class="p-3 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-200 dark:border-blue-900/20 flex items-center gap-2 mobile-row"
        >
          <Shield class="w-4 h-4 text-blue-500 shrink-0" />
          <p class="text-[10px] text-blue-700 dark:text-blue-400 font-bold">
            您的账号已启用两步验证，取消订阅时需要验证身份
          </p>
        </div>

        <div class="flex gap-3 mobile-row">
          <Button variant="secondary" full-width @click="show = false"> 继续使用 </Button>
          <Button variant="danger" full-width @click="emit('cancel')">
            {{ cancelRequires2FA ? '下一步' : '确认取消' }}
          </Button>
        </div>
      </div>
    </template>

    <!-- Step 2: 2FA Verification -->
    <template v-if="cancelStep === '2fa'">
      <div class="space-y-6">
        <div class="text-center space-y-4 py-4">
          <div
            class="w-16 h-16 mx-auto bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center"
          >
            <KeyRound class="w-8 h-8 text-blue-500" />
          </div>
          <p class="text-sm text-[var(--text-secondary)]">请输入您的两步验证码以确认取消订阅</p>
          <p class="text-[10px] text-[var(--text-muted)]">打开您的身份验证器应用获取6位验证码</p>
        </div>

        <Input
          v-model="twoFactorCode"
          type="text"
          maxlength="6"
          placeholder="输入6位验证码"
          input-class="text-center text-2xl font-mono font-bold tracking-[0.5em]"
          @keyup.enter="emit('cancelWith2FA')"
        />

        <div class="flex gap-3 mobile-row">
          <Button variant="secondary" full-width @click="cancelStep = 'confirm'"> 返回 </Button>
          <Button
            variant="danger"
            full-width
            :disabled="isVerifying2FA || twoFactorCode.length < 6"
            :loading="isVerifying2FA"
            @click="emit('cancelWith2FA')"
          >
            确认取消
          </Button>
        </div>
      </div>
    </template>
  </Modal>
</template>
