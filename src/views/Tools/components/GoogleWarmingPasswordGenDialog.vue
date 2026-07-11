<script setup lang="ts">
import { ref, watch } from 'vue';
import { ElMessage } from '@/utils/feedbackBridge';
import { Sparkles, Copy, RefreshCw } from 'lucide-vue-next';
import Modal from '@/components/ui/Modal.vue';
import Button from '@/components/ui/Button.vue';

const props = defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
}>();

const passGenLength = ref(16);
const passGenUpper = ref(true);
const passGenLower = ref(true);
const passGenNumbers = ref(true);
const passGenSymbols = ref(false);
const passGenResult = ref('');

const generateDialogPassword = () => {
  const poolLower = 'abcdefghijklmnopqrstuvwxyz';
  const poolUpper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const poolDigit = '0123456789';
  const poolSymbol = '!@#$%^&*()_+~[]{}:;.,?';

  let allowedPool = '';
  let guaranteed: string[] = [];

  if (passGenLower.value) {
    allowedPool += poolLower;
    guaranteed.push(poolLower[Math.floor(Math.random() * poolLower.length)]);
  }
  if (passGenUpper.value) {
    allowedPool += poolUpper;
    guaranteed.push(poolUpper[Math.floor(Math.random() * poolUpper.length)]);
  }
  if (passGenNumbers.value) {
    allowedPool += poolDigit;
    guaranteed.push(poolDigit[Math.floor(Math.random() * poolDigit.length)]);
  }
  if (passGenSymbols.value) {
    allowedPool += poolSymbol;
    guaranteed.push(poolSymbol[Math.floor(Math.random() * poolSymbol.length)]);
  }

  if (allowedPool.length === 0) {
    passGenLower.value = true;
    passGenUpper.value = true;
    passGenNumbers.value = true;
    allowedPool = poolLower + poolUpper + poolDigit;
    guaranteed.push(poolLower[Math.floor(Math.random() * poolLower.length)]);
    guaranteed.push(poolUpper[Math.floor(Math.random() * poolUpper.length)]);
    guaranteed.push(poolDigit[Math.floor(Math.random() * poolDigit.length)]);
  }

  let password = guaranteed.join('');
  const remainingLength = passGenLength.value - password.length;

  for (let i = 0; i < remainingLength; i++) {
    password += allowedPool[Math.floor(Math.random() * allowedPool.length)];
  }

  passGenResult.value = password
    .split('')
    .sort(() => 0.5 - Math.random())
    .join('');
};

const open = () => {
  generateDialogPassword();
};

watch(
  () => props.show,
  (newVal) => {
    if (newVal) {
      open();
    }
  },
  { immediate: true },
);

watch([passGenLength, passGenUpper, passGenLower, passGenNumbers, passGenSymbols], () => {
  if (props.show) {
    generateDialogPassword();
  }
});

const copyText = (text: string, message: string = '已复制到剪贴板') => {
  if (!text) return;
  navigator.clipboard
    .writeText(text)
    .then(() => {
      ElMessage.success(message);
    })
    .catch(() => {
      ElMessage.error('复制失败');
    });
};

const close = () => {
  emit('update:show', false);
};
</script>

<template>
  <Modal :show="props.show" title="密码生成器" size="md" @close="close">
    <div class="space-y-4">
      <div
        class="flex items-center gap-2 p-3 rounded-xl border relative group"
        style="border-color: var(--border-base); background: var(--bg-app)"
      >
        <input
          type="text"
          readonly
          :value="passGenResult"
          class="w-full bg-transparent border-none outline-none font-mono text-base font-semibold tracking-wider text-violet-600 dark:text-violet-400 select-all pr-12"
        />
        <div class="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
          <button
            class="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-all cursor-pointer"
            title="复制密码"
            @click="copyText(passGenResult, '密码已复制')"
          >
            <Copy class="w-4 h-4" />
          </button>
          <button
            class="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-all cursor-pointer"
            title="重新生成"
            @click="generateDialogPassword"
          >
            <RefreshCw class="w-4 h-4" />
          </button>
        </div>
      </div>

      <div class="space-y-3.5">
        <div class="space-y-1.5">
          <div class="flex items-center justify-between text-xs font-semibold">
            <span class="text-slate-600 dark:text-slate-300">密码长度 ({{ passGenLength }}位)</span>
          </div>
          <div class="flex items-center gap-3">
            <input
              v-model.number="passGenLength"
              type="range"
              min="6"
              max="32"
              class="flex-1 accent-violet-600 dark:accent-violet-500 cursor-pointer h-1.5 rounded-lg bg-slate-200 dark:bg-slate-800"
            />
            <span
              class="font-mono text-xs font-bold w-6 text-right text-slate-700 dark:text-slate-300"
              >{{ passGenLength }}</span
            >
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2 text-xs font-medium">
          <label
            class="flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-slate-500/5 transition-all cursor-pointer"
            style="border-color: var(--border-base)"
          >
            <input
              v-model="passGenLower"
              type="checkbox"
              class="w-3.5 h-3.5 rounded accent-violet-500 cursor-pointer"
            />
            <span style="color: var(--text-primary)">小写字母 (a-z)</span>
          </label>

          <label
            class="flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-slate-500/5 transition-all cursor-pointer"
            style="border-color: var(--border-base)"
          >
            <input
              v-model="passGenUpper"
              type="checkbox"
              class="w-3.5 h-3.5 rounded accent-violet-500 cursor-pointer"
            />
            <span style="color: var(--text-primary)">大写字母 (A-Z)</span>
          </label>

          <label
            class="flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-slate-500/5 transition-all cursor-pointer"
            style="border-color: var(--border-base)"
          >
            <input
              v-model="passGenNumbers"
              type="checkbox"
              class="w-3.5 h-3.5 rounded accent-violet-500 cursor-pointer"
            />
            <span style="color: var(--text-primary)">数字字符 (0-9)</span>
          </label>

          <label
            class="flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-slate-500/5 transition-all cursor-pointer"
            style="border-color: var(--border-base)"
          >
            <input
              v-model="passGenSymbols"
              type="checkbox"
              class="w-3.5 h-3.5 rounded accent-violet-500 cursor-pointer"
            />
            <span style="color: var(--text-primary)">特殊符号 (!@#$)</span>
          </label>
        </div>
      </div>
    </div>
    <template #footer>
      <div class="flex justify-between items-center w-full pt-1.5">
        <span class="text-[10px] text-slate-400 dark:text-slate-500">
          安全提示：请妥善保存您的密码
        </span>
        <div class="flex gap-2">
          <Button variant="secondary" size="sm" @click="close"> 关闭 </Button>
          <Button variant="primary" size="sm" @click="generateDialogPassword">
            <Sparkles class="w-3.5 h-3.5" />
            <span>重新生成</span>
          </Button>
        </div>
      </div>
    </template>
  </Modal>
</template>
