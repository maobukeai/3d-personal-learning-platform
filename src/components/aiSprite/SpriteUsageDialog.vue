<script setup lang="ts">
import { computed } from 'vue';
import { AlertTriangle, Sparkles } from 'lucide-vue-next';
import Modal from '@/components/ui/Modal.vue';

const props = defineProps<{
  modelValue: boolean;
  loading: boolean;
  error: string;
  data: {
    usedToday: number;
    dailyLimit: number;
    planName: string;
    planDisplayName: string;
  } | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'upgrade'): void;
  (e: 'retry'): void;
}>();

const usagePercent = computed(() => {
  if (!props.data) return 0;
  return Math.min(100, (props.data.usedToday / props.data.dailyLimit) * 100);
});

const close = () => {
  emit('update:modelValue', false);
};
</script>

<template>
  <Modal :show="modelValue" title="AI 助手使用额度" size="sm" @close="close">
    <div v-if="loading" class="py-5">
      <div class="flex flex-col items-center justify-center gap-2 py-4">
        <span
          class="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent"
        ></span>
        <span class="text-xs text-slate-400">正在获取额度信息...</span>
      </div>
    </div>

    <div v-else-if="error" class="py-5">
      <div class="flex flex-col items-center justify-center gap-2.5 py-4 text-center">
        <AlertTriangle class="h-8 w-8 text-rose-500" />
        <span class="text-xs text-slate-600 dark:text-slate-400 px-4 leading-relaxed">
          {{ error }}
        </span>
        <button
          type="button"
          class="mt-3 rounded-xl bg-rose-50 dark:bg-rose-950/20 px-4 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-all active:scale-95"
          @click="emit('retry')"
        >
          重新尝试
        </button>
      </div>
    </div>

    <div v-else-if="data" class="py-5 space-y-5">
      <!-- Plan Badge -->
      <div class="flex items-center justify-between">
        <span class="text-xs font-medium text-slate-400">当前版本</span>
        <span
          class="rounded-full px-3 py-1 text-[11px] font-semibold tracking-wider text-white shadow-xs"
          :class="
            data.planName === 'SVIP'
              ? 'bg-amber-500 shadow-amber-500/20'
              : data.planName === 'VIP'
                ? 'bg-violet-500 shadow-violet-500/20'
                : 'bg-slate-500 shadow-slate-500/20'
          "
        >
          {{ data.planDisplayName }}
        </span>
      </div>

      <!-- Progress Meter -->
      <div class="space-y-2">
        <div class="flex items-center justify-between text-xs">
          <span class="font-medium text-slate-700 dark:text-slate-300">今日对话额度</span>
          <span class="font-bold text-slate-900 dark:text-white">
            {{ data.usedToday }} / {{ data.dailyLimit }}
          </span>
        </div>

        <!-- Progress Bar -->
        <div class="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            class="h-full rounded-full transition-all duration-500"
            :class="[
              usagePercent >= 90
                ? 'bg-rose-500'
                : usagePercent >= 75
                  ? 'bg-amber-500'
                  : 'bg-accent',
            ]"
            :style="{ width: usagePercent + '%' }"
          ></div>
        </div>

        <div class="flex justify-between text-[10px] text-slate-400">
          <span>重置时间: 每日 00:00 (北京时间)</span>
          <span>剩余: {{ Math.max(0, data.dailyLimit - data.usedToday) }} 次</span>
        </div>
      </div>

      <!-- Notice box -->
      <div
        class="rounded-2xl border p-3.5 text-xs leading-5 border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/30 text-slate-500 dark:text-slate-400"
        :class="{
          'border-rose-500/10 bg-rose-500/5 text-rose-500': usagePercent >= 100,
        }"
      >
        <p v-if="usagePercent >= 100">
          ⚠️ 您今天的 AI 对话次数已达上限。请明天再来，或者升级到更高版本以解锁更多额度。
        </p>
        <p v-else-if="data.planName === 'FREE'">
          💡 免费版额度为 100
          次/天。如需更高频地整理学习路线、分析大项目或体验深度研究，推荐升级专业版（1000次/天）或旗舰版（10000次/天）。
        </p>
        <p v-else-if="data.planName === 'VIP'">
          🌟 专业版额度为 1000 次/天，充足的对话额度能够满足绝大多数协作和代码分析需求。
        </p>
        <p v-else>👑 您正在使用旗舰版，享有 10000 次/天的高并发极速对话，以及全方位的专属支持。</p>
      </div>
    </div>

    <template v-if="!loading" #footer>
      <div class="flex justify-end gap-2">
        <button
          v-if="data && data.planName !== 'SVIP'"
          type="button"
          class="rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white shadow-md hover:bg-accent/90 transition"
          @click="emit('upgrade')"
        >
          升级版本
        </button>
        <button
          type="button"
          class="ml-2 rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          @click="close"
        >
          关闭
        </button>
      </div>
    </template>
  </Modal>
</template>

<style scoped>
.ai-logo {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--bg-app);
  border: 1px solid var(--border-base);
}
.ai-logo--small {
  width: 24px;
  height: 24px;
}
</style>
