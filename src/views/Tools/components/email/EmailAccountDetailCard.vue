<script setup lang="ts">
import { computed } from 'vue';
import { Globe, RefreshCw, Edit, Trash2 } from 'lucide-vue-next';
import Tooltip from '@/components/ui/Tooltip.vue';
import type { EmailAccount } from './email-types';

const props = defineProps<{
  account?: EmailAccount;
  isTesting?: boolean;
}>();

const emit = defineEmits<{
  (e: 'testConnection', account: EmailAccount): void;
  (e: 'editAccount', account: EmailAccount): void;
  (e: 'deleteAccount', account: EmailAccount): void;
}>();

const percentage = computed(() => {
  if (!props.account || props.account.dailyLimit <= 0) return 0;
  return Math.min(100, Math.round((props.account.sentCountToday / props.account.dailyLimit) * 100));
});
</script>

<template>
  <div
    v-if="account"
    class="p-2.5 rounded-xl border border-slate-200/70 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30 flex flex-col gap-2 text-xs"
  >
    <!-- Header: Daily quota & Proxy info -->
    <div class="flex items-center justify-between text-[10px] text-slate-400 font-medium">
      <span
        class="flex items-center gap-1 truncate max-w-[120px]"
        :title="account.proxy || 'Direct'"
      >
        <Globe class="w-3 h-3 text-slate-400" />
        {{ account.proxy ? account.proxy.split('@').pop() : 'Direct 直连' }}
      </span>
      <span>今日已发: {{ account.sentCountToday }}/{{ account.dailyLimit }} 封</span>
    </div>

    <!-- Progress bar -->
    <div class="w-full h-1.5 bg-slate-200/70 dark:bg-slate-800 rounded-full overflow-hidden">
      <div
        class="h-full rounded-full transition-all duration-300"
        :class="
          percentage >= 100 ? 'bg-rose-500' : percentage >= 80 ? 'bg-amber-500' : 'bg-indigo-500'
        "
        :style="{ width: `${percentage}%` }"
      ></div>
    </div>

    <!-- Quick action buttons -->
    <div class="flex items-center gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-900">
      <Tooltip content="校验微软令牌有效性" placement="top">
        <button
          type="button"
          :disabled="isTesting"
          class="flex-1 flex items-center justify-center gap-1 py-1 px-1.5 rounded-lg bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-200 text-[10px] font-semibold transition-all duration-150 disabled:opacity-50 cursor-pointer shadow-2xs"
          @click="emit('testConnection', account)"
        >
          <RefreshCw class="w-3 h-3" :class="{ 'animate-spin': isTesting }" />
          <span>测活</span>
        </button>
      </Tooltip>

      <Tooltip content="修改代理 / 限额 / 凭证" placement="top">
        <button
          type="button"
          class="flex-1 flex items-center justify-center gap-1 py-1 px-1.5 rounded-lg bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-200 text-[10px] font-semibold transition-all duration-150 cursor-pointer shadow-2xs"
          @click="emit('editAccount', account)"
        >
          <Edit class="w-3 h-3" />
          <span>编辑</span>
        </button>
      </Tooltip>

      <Tooltip content="安全解绑账号" placement="top">
        <button
          type="button"
          class="flex items-center justify-center p-1 rounded-lg bg-white dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 text-slate-400 hover:text-rose-600 hover:border-rose-200 text-[10px] font-semibold transition-all duration-150 cursor-pointer shadow-2xs"
          @click="emit('deleteAccount', account)"
        >
          <Trash2 class="w-3 h-3" />
        </button>
      </Tooltip>
    </div>
  </div>
</template>
