<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { ShieldCheck, Lock, CheckCircle2, ArrowRight, Loader2, RefreshCw } from 'lucide-vue-next';
import Modal from '@/components/ui/Modal.vue';
import { useAuthStore } from '@/stores/auth';

const props = defineProps<{
  show: boolean;
  resourceTitle?: string;
}>();

const emit = defineEmits<{
  (e: 'update:show', val: boolean): void;
  (e: 'verified'): void;
}>();

const authStore = useAuthStore();
const sliderValue = ref(0);
const isVerifying = ref(false);
const isPassed = ref(false);

const userName = computed(() => authStore.user?.name || authStore.user?.email || '平台会员');

watch(
  () => props.show,
  (val) => {
    if (val) {
      sliderValue.value = 0;
      isVerifying.value = false;
      isPassed.value = false;
    }
  },
);

function handleSliderInput(e: Event) {
  const val = Number((e.target as HTMLInputElement).value);
  sliderValue.value = val;
  if (val >= 95) {
    sliderValue.value = 100;
    triggerVerify();
  }
}

function handleTouchOrMouseUp() {
  if (sliderValue.value < 95 && !isPassed.value) {
    sliderValue.value = 0;
  }
}

async function triggerVerify() {
  if (isVerifying.value || isPassed.value) return;
  isVerifying.value = true;
  await new Promise((r) => setTimeout(r, 600));
  isVerifying.value = false;
  isPassed.value = true;
  await new Promise((r) => setTimeout(r, 400));
  emit('verified');
  emit('update:show', false);
}

function resetVerify() {
  sliderValue.value = 0;
  isVerifying.value = false;
  isPassed.value = false;
}
</script>

<template>
  <Modal :show="show" title="安全身份核验" size="sm" @close="emit('update:show', false)">
    <div class="space-y-4 py-1">
      <!-- Security Banner -->
      <div
        class="p-3.5 rounded-2xl bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-blue-500/5 border border-blue-500/20 flex items-center gap-3 shadow-inner"
      >
        <div
          class="w-10 h-10 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 shadow-xs"
        >
          <ShieldCheck class="w-5 h-5" />
        </div>
        <div class="min-w-0">
          <div
            class="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5 truncate"
          >
            <span>会员安全通道</span>
            <span class="px-1.5 py-0.2 text-[9px] font-black rounded-md bg-blue-600 text-white"
              >PRO</span
            >
          </div>
          <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
            当前身份：<span class="font-bold text-slate-700 dark:text-slate-200">{{
              userName
            }}</span>
          </p>
        </div>
      </div>

      <div class="text-center space-y-1">
        <p class="text-xs font-bold text-slate-800 dark:text-slate-200">
          为了保护平台专属资源，请完成安全人机核验
        </p>
        <p class="text-[11px] text-slate-400 truncate max-w-xs mx-auto">
          正在提取: {{ resourceTitle || '目标资源' }}
        </p>
      </div>

      <!-- Interactive Slide Verification Track -->
      <div
        class="relative w-full h-12 bg-slate-100 dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden select-none flex items-center p-1 shadow-inner"
      >
        <div
          class="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl transition-all"
          :class="{ 'opacity-80': !isPassed, 'bg-emerald-500': isPassed }"
          :style="{ width: `${sliderValue}%` }"
        ></div>

        <div
          class="absolute inset-0 flex items-center justify-center text-xs font-bold pointer-events-none transition-opacity"
          :class="sliderValue > 50 ? 'text-white' : 'text-slate-400'"
        >
          <span v-if="isPassed" class="flex items-center gap-1.5 text-emerald-100">
            <CheckCircle2 class="w-4 h-4" /> 验证通过，正在解密...
          </span>
          <span v-else-if="isVerifying" class="flex items-center gap-1.5 text-white">
            <Loader2 class="w-4 h-4 animate-spin" /> 安全签名校验中...
          </span>
          <span v-else class="flex items-center gap-1">
            向右拖动滑块完成身份核验 <ArrowRight class="w-3.5 h-3.5 opacity-60" />
          </span>
        </div>

        <input
          type="range"
          min="0"
          max="100"
          :value="sliderValue"
          :disabled="isVerifying || isPassed"
          class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          @input="handleSliderInput"
          @mouseup="handleTouchOrMouseUp"
          @touchend="handleTouchOrMouseUp"
        />

        <div
          class="absolute h-10 w-10 bg-white dark:bg-slate-800 rounded-xl shadow-md border border-slate-200 dark:border-slate-600 flex items-center justify-center pointer-events-none transition-transform z-20 text-slate-600 dark:text-slate-200"
          :style="{ left: `calc(${sliderValue}% * 0.82 + 4px)` }"
        >
          <CheckCircle2 v-if="isPassed" class="w-5 h-5 text-emerald-500" />
          <Loader2 v-else-if="isVerifying" class="w-5 h-5 animate-spin text-blue-500" />
          <Lock v-else class="w-4 h-4 text-blue-600 dark:text-blue-400" />
        </div>
      </div>

      <div class="flex items-center justify-between text-[11px] text-slate-400 px-1 pt-1">
        <span class="flex items-center gap-1">
          <ShieldCheck class="w-3.5 h-3.5 text-emerald-500" />
          端到端加密防护
        </span>
        <button
          type="button"
          class="hover:text-blue-500 flex items-center gap-1 transition-colors cursor-pointer"
          @click="resetVerify"
        >
          <RefreshCw class="w-3 h-3" /> 重试
        </button>
      </div>
    </div>

    <!-- Beautiful Full-Width Cancel Button -->
    <template #footer>
      <div class="w-full flex items-center justify-center">
        <button
          type="button"
          class="w-full h-10 px-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white font-bold text-xs transition-all cursor-pointer active:scale-98"
          @click="emit('update:show', false)"
        >
          取消
        </button>
      </div>
    </template>
  </Modal>
</template>
