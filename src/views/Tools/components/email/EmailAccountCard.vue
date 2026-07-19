<script setup lang="ts">
import { Globe, Copy, CheckCircle, Edit, Trash2 } from 'lucide-vue-next';
import type { EmailAccount } from './email-types';

defineProps<{
  acc: EmailAccount;
  selectedAccountId: string;
  isMultiSelectMode: boolean;
  selectedAccountIds: string[];
  copyTooltip: string;
}>();

defineEmits<{
  (e: 'toggleSelectAccount', id: string): void;
  (e: 'selectAccount', id: string): void;
  (e: 'copyEmail', email: string): void;
  (e: 'testConnection', account: EmailAccount): void;
  (e: 'editAccount', account: EmailAccount): void;
  (e: 'deleteAccount', account: EmailAccount): void;
}>();
</script>

<template>
  <div
    class="group w-full text-left p-2.5 rounded-xl border transition-all duration-200 cursor-pointer flex flex-col gap-1.5"
    :class="[
      selectedAccountId === acc.id && !isMultiSelectMode
        ? 'bg-indigo-50/70 border-indigo-200 dark:bg-indigo-950/20 dark:border-indigo-900/40'
        : selectedAccountIds.includes(acc.id) && isMultiSelectMode
          ? 'bg-indigo-50/30 border-indigo-200/60 dark:bg-indigo-950/10 dark:border-indigo-900/30'
          : 'bg-white dark:bg-slate-950 border-slate-200/60 dark:border-slate-900 hover:border-slate-300 dark:hover:border-slate-800',
    ]"
    @click="
      isMultiSelectMode ? $emit('toggleSelectAccount', acc.id) : $emit('selectAccount', acc.id)
    "
  >
    <!-- Email & Connection Indicator -->
    <div class="flex items-center justify-between gap-1.5">
      <div class="flex items-center gap-2 truncate flex-1">
        <input
          v-if="isMultiSelectMode"
          type="checkbox"
          :checked="selectedAccountIds.includes(acc.id)"
          class="rounded border-slate-300 dark:border-slate-800 text-indigo-600 focus:ring-indigo-500 shrink-0 cursor-pointer"
          @click.stop="$emit('toggleSelectAccount', acc.id)"
        />
        <span
          class="font-medium text-xs truncate"
          :class="
            selectedAccountId === acc.id && !isMultiSelectMode
              ? 'text-indigo-900 dark:text-indigo-300 font-semibold'
              : 'text-slate-800 dark:text-slate-200'
          "
        >
          {{ acc.email }}
        </span>
        <Tooltip :content="copyTooltip" placement="top">
          <button
            type="button"
            class="p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-500 rounded transition-colors shrink-0 opacity-0 group-hover:opacity-100 duration-200 ml-auto cursor-pointer"
            @click.stop="$emit('copyEmail', acc.email)"
          >
            <Copy class="w-3.5 h-3.5" />
          </button>
        </Tooltip>
      </div>

      <!-- Status Dot -->
      <Tooltip
        :content="acc.statusMessage || (acc.status === 'ACTIVE' ? '正常' : '异常')"
        placement="right"
      >
        <span class="shrink-0 flex items-center">
          <span
            class="w-2 h-2 rounded-full ring-2"
            :class="[
              acc.status === 'ACTIVE'
                ? 'bg-emerald-500 ring-emerald-500/10'
                : acc.status === 'EXPIRED'
                  ? 'bg-amber-500 ring-amber-500/10'
                  : 'bg-rose-500 ring-rose-500/10',
            ]"
          ></span>
        </span>
      </Tooltip>
    </div>

    <!-- Daily sends & Limits telemetry -->
    <div class="flex flex-col gap-1">
      <div class="flex justify-between text-[10px] text-slate-400 font-medium">
        <span>{{ $t('tools.email.sent_today', { sent: acc.sentCountToday }) }}</span>
        <span>{{ $t('tools.email.limit_cap', { limit: acc.dailyLimit }) }}</span>
      </div>
      <div class="w-full h-1 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
        <div
          class="h-full rounded-full transition-all duration-300"
          :class="acc.sentCountToday >= acc.dailyLimit ? 'bg-rose-500' : 'bg-indigo-500'"
          :style="{
            width: `${Math.min(100, (acc.sentCountToday / acc.dailyLimit) * 100)}%`,
          }"
        ></div>
      </div>
    </div>

    <!-- Proxy & Quick Operations -->
    <div
      class="flex items-center justify-between text-[10px] text-slate-400 mt-0.5 border-t border-slate-100/50 dark:border-slate-900 pt-1.5"
    >
      <span
        class="truncate flex items-center gap-1 max-w-[120px]"
        :title="acc.proxy || '未挂载代理'"
      >
        <Globe class="w-3 h-3 text-slate-400" />
        {{ acc.proxy ? acc.proxy.split('@').pop() : 'Direct' }}
      </span>

      <div
        v-if="!isMultiSelectMode"
        class="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
      >
        <button
          type="button"
          class="p-0.5 hover:bg-indigo-100/50 dark:hover:bg-indigo-950/50 text-indigo-500 rounded transition-colors"
          :title="$t('tools.email.verify_token_tooltip')"
          @click.stop="$emit('testConnection', acc)"
        >
          <CheckCircle class="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          class="p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 rounded transition-colors"
          title="编辑账号 / 更新 Token"
          @click.stop="$emit('editAccount', acc)"
        >
          <Edit class="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          class="p-0.5 hover:bg-rose-100/50 dark:hover:bg-rose-950/50 text-rose-500 rounded transition-colors"
          :title="$t('tools.email.unbind_token_tooltip')"
          @click.stop="$emit('deleteAccount', acc)"
        >
          <Trash2 class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  </div>
</template>
