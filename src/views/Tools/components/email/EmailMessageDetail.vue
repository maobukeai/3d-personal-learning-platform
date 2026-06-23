<script setup lang="ts">
import { formatDateTime as formatDate } from '@/utils/format';
import { Eye, Trash2 } from 'lucide-vue-next';
import type { MailMessage } from './email-types';

interface Props {
  message: MailMessage;
}

defineProps<Props>();

const emit = defineEmits<{
  (e: 'toggleRead'): void;
  (e: 'delete'): void;
}>();
</script>

<template>
  <div class="flex-1 flex flex-col h-full bg-white dark:bg-slate-950 min-h-0">
    <!-- Control Header -->
    <div
      class="mobile-row px-6 py-4 border-b border-slate-100 dark:border-slate-900 flex items-center justify-between shrink-0"
    >
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="flex items-center gap-1.5 py-1.5 px-3 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg text-xs font-semibold transition-colors"
          @click="$emit('toggleRead')"
        >
          <Eye class="w-3.5 h-3.5" />
          <span>标记为{{ message.isRead ? '未读' : '已读' }}</span>
        </button>
        <button
          type="button"
          class="flex items-center gap-1.5 py-1.5 px-3 border border-rose-100 hover:bg-rose-50 text-rose-500 rounded-lg text-xs font-semibold transition-colors"
          @click="$emit('delete')"
        >
          <Trash2 class="w-3.5 h-3.5" />
          <span>删除邮件</span>
        </button>
      </div>

      <div class="text-xs text-slate-400 font-medium">通过微软 API 安全调取</div>
    </div>

    <!-- Message Core Payload Info -->
    <div
      class="p-6 border-b border-slate-100 dark:border-slate-900 shrink-0 text-left bg-slate-50/50 dark:bg-slate-950"
    >
      <h1 class="text-base font-bold text-slate-950 dark:text-white leading-snug">
        {{ message.subject || $t('tools.email.no_subject') }}
      </h1>

      <div class="flex items-start gap-3 mt-4">
        <div
          class="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 text-xs font-bold uppercase"
        >
          {{ message.from?.emailAddress?.name?.charAt(0) || 'U' }}
        </div>

        <div class="flex-1 min-w-0 flex flex-col gap-0.5 text-xs">
          <div class="flex items-center justify-between">
            <span class="font-bold text-slate-800 dark:text-slate-200">
              {{ message.from?.emailAddress?.name || $t('tools.email.unknown_sender') }}
            </span>
            <span class="text-[11px] text-slate-400 font-medium shrink-0">
              {{ formatDate(message.receivedDateTime) }}
            </span>
          </div>

          <div class="text-[11px] text-slate-400">
            发件人:
            <span class="text-slate-500">{{ message.from?.emailAddress?.address }}</span>
          </div>
          <div class="text-[11px] text-slate-400 truncate max-w-[500px]">
            {{ $t('tools.email.recipient_label') }}:
            <span
              v-for="rec in message.toRecipients"
              :key="rec.emailAddress.address"
              class="text-slate-500"
              >{{ rec.emailAddress.name || rec.emailAddress.address }};
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Rendered Body Frame -->
    <div class="flex-1 overflow-y-auto p-6 min-h-0">
      <div
        v-if="message.body?.contentType === 'html'"
        class="w-full h-full text-slate-800 dark:text-slate-200 text-sm leading-relaxed"
      >
        <!-- Standard safe iframe wrapper for rich HTML mails -->
        <iframe
          :srcdoc="`
            <html>
              <head>
                <style>
                  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #333; margin: 0; padding: 10px; }
                  a { color: #4f46e5; text-decoration: none; }
                  img { max-width: 100%; height: auto; }
                </style>
              </head>
              <body>
                ${message.body.content}
              </body>
            </html>
          `"
          class="w-full h-full border-none bg-white"
          sandbox="allow-popups allow-popups-to-escape-sandbox"
        ></iframe>
      </div>
      <div
        v-else
        class="whitespace-pre-wrap text-left text-xs leading-relaxed text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-900"
      >
        {{ message.body?.content || message.bodyPreview }}
      </div>
    </div>
  </div>
</template>
