<script setup lang="ts">
import { computed } from 'vue';
import { Send } from 'lucide-vue-next';
import type { ComposeForm, EmailAccount } from './email-types';

interface Props {
  modelValue: ComposeForm;
  accounts: EmailAccount[];
  isSending: boolean;
  sendingStatusText: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: ComposeForm): void;
  (e: 'send'): void;
  (e: 'cancel'): void;
}>();

const composeForm = computed({
  get: () => props.modelValue,
  set: (val: ComposeForm) => emit('update:modelValue', val),
});
</script>

<template>
  <div class="flex-1 flex flex-col h-full bg-white dark:bg-slate-950 min-h-0">
    <!-- Control Header -->
    <div
      class="mobile-row px-6 py-4 border-b border-slate-100 dark:border-slate-900 flex items-center justify-between shrink-0 select-none"
    >
      <h2 class="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 text-sm">
        <Send class="w-4 h-4 text-indigo-500" />
        <span>{{ $t('tools.email.compose_title') }}</span>
      </h2>
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="py-1.5 px-3 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg text-xs font-semibold transition-colors"
          @click="$emit('cancel')"
        >
          取消发送
        </button>
        <button
          type="button"
          :disabled="isSending"
          class="flex items-center gap-1.5 py-1.5 px-4.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-lg text-xs font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-indigo-200 dark:shadow-none"
          @click="$emit('send')"
        >
          <Send class="w-3.5 h-3.5" />
          <span>{{
            isSending ? $t('tools.email.sending_email_btn') : $t('tools.email.send_email_btn')
          }}</span>
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto p-6 flex flex-col gap-4 text-left">
      <!-- Route Selecting Box (Anti-ban Option) -->
      <div class="grid grid-cols-1 sm:grid-cols-6 gap-3 items-center">
        <label class="col-span-1 text-xs font-semibold text-slate-400">{{
          $t('tools.email.sender_account')
        }}</label>
        <div class="col-span-5 flex items-center gap-2">
          <select
            v-model="composeForm.accountId"
            class="flex-1 text-xs px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 focus:outline-none focus:border-indigo-400 focus:bg-white transition-all duration-200"
          >
            <option value="round-robin">{{ $t('tools.email.random_robin') }}</option>
            <option
              v-for="acc in accounts"
              :key="acc.id"
              :value="acc.id"
              :disabled="acc.status !== 'ACTIVE'"
            >
              {{ acc.email }}
              {{
                acc.status !== 'ACTIVE' ? `(异常:${acc.status})` : `(今日发:${acc.sentCountToday})`
              }}
            </option>
          </select>
        </div>
      </div>

      <!-- To recipient -->
      <div class="grid grid-cols-1 sm:grid-cols-6 gap-3 items-center">
        <label class="col-span-1 text-xs font-semibold text-slate-400">{{
          $t('tools.email.recipient_label')
        }}</label>
        <input
          v-model="composeForm.to"
          type="email"
          placeholder="recipient@example.com"
          class="col-span-5 text-xs px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 focus:outline-none focus:border-indigo-400 focus:bg-white transition-all duration-200"
        />
      </div>

      <!-- Subject -->
      <div class="grid grid-cols-1 sm:grid-cols-6 gap-3 items-center">
        <label class="col-span-1 text-xs font-semibold text-slate-400">{{
          $t('tools.email.subject_label')
        }}</label>
        <input
          v-model="composeForm.subject"
          type="text"
          :placeholder="$t('tools.email.subject_placeholder')"
          class="col-span-5 text-xs px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 focus:outline-none focus:border-indigo-400 focus:bg-white transition-all duration-200"
        />
      </div>

      <!-- Content Body -->
      <div class="flex-1 flex flex-col gap-2 min-h-[250px]">
        <label class="text-xs font-semibold text-slate-400">正文内容 (支持 HTML 格式)</label>
        <textarea
          v-model="composeForm.content"
          :placeholder="$t('tools.email.body_placeholder')"
          class="flex-1 text-xs px-3.5 py-3 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 focus:outline-none focus:border-indigo-400 focus:bg-white font-mono resize-none leading-relaxed transition-all duration-200 min-h-[200px]"
        ></textarea>
      </div>
    </div>

    <!-- Safe Status Sending Overlay (While sending) -->
    <div
      v-show="isSending"
      class="absolute inset-0 bg-white/95 dark:bg-slate-950/95 flex flex-col items-center justify-center z-50 p-8 select-none"
    >
      <div
        class="w-16 h-16 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin flex items-center justify-center mb-6"
      ></div>
      <h3 class="text-sm font-bold text-slate-900 dark:text-white">系统安全通道正在发送邮件</h3>
      <p class="text-xs text-slate-400 mt-2 max-w-sm text-center leading-relaxed">
        {{ sendingStatusText || $t('tools.email.safety_delay_desc') }}
      </p>
    </div>
  </div>
</template>
