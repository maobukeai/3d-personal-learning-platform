<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { formatDateTime as formatDate } from '@/utils/format';
import { Mail, RefreshCw, Send, Search, FolderOpen } from 'lucide-vue-next';
import type { MailMessage } from './email-types';

interface Props {
  messages: MailMessage[];
  selectedMessage: MailMessage | null;
  selectedAccountId: string;
  currentFolder: string;
  searchQuery: string;
  isMessagesLoading: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:searchQuery', value: string): void;
  (e: 'refresh'): void;
  (e: 'compose'): void;
  (e: 'viewMessage', msg: MailMessage): void;
}>();

const { t } = useI18n();

const foldersList = [
  { id: 'inbox', name: t('tools.email.folders.inbox') },
  { id: 'sentitems', name: t('tools.email.folders.sentitems') },
  { id: 'drafts', name: t('tools.email.folders.drafts') },
  { id: 'junkemail', name: t('tools.email.folders.junkemail') },
  { id: 'deleteditems', name: t('tools.email.folders.deleteditems') },
];

const localSearch = computed({
  get: () => props.searchQuery,
  set: (val: string) => emit('update:searchQuery', val),
});

const filteredMessages = computed(() => {
  if (!props.searchQuery) return props.messages;
  const q = props.searchQuery.toLowerCase();
  return props.messages.filter(
    (msg) =>
      msg.subject?.toLowerCase().includes(q) ||
      msg.from?.emailAddress?.name?.toLowerCase().includes(q) ||
      msg.from?.emailAddress?.address?.toLowerCase().includes(q) ||
      msg.bodyPreview?.toLowerCase().includes(q),
  );
});

const currentFolderName = computed(() => {
  return foldersList.find((f) => f.id === props.currentFolder)?.name || '邮件列表';
});
</script>

<template>
  <section
    class="w-80 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex flex-col z-0"
  >
    <!-- Search and Header Controls -->
    <div class="p-4 border-b border-slate-100 dark:border-slate-900 flex flex-col gap-3">
      <div class="mobile-row flex items-center justify-between">
        <h2 class="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
          <span>{{ currentFolderName }}</span>
          <span
            v-show="messages.length > 0"
            class="text-xs py-0.5 px-1.5 bg-slate-100 dark:bg-slate-900 text-slate-500 rounded-full font-semibold"
          >
            {{ filteredMessages.length }}
          </span>
        </h2>

        <div class="flex items-center gap-2">
          <button
            type="button"
            class="p-1.5 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all duration-200 select-none"
            @click="$emit('compose')"
          >
            <Send class="w-3.5 h-3.5" /> {{ $t('tools.email.compose_btn') }}
          </button>
          <button
            type="button"
            :disabled="!selectedAccountId"
            class="p-1.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            :title="$t('tools.email.sync_btn_tooltip')"
            @click="$emit('refresh')"
          >
            <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': isMessagesLoading }" />
          </button>
        </div>
      </div>

      <!-- Search Bar -->
      <div class="flex justify-center w-full">
        <label class="search-box !min-h-0 !h-8 w-full shrink-0">
          <Search />
          <input
            v-model="localSearch"
            type="text"
            :placeholder="$t('tools.email.search_placeholder')"
          />
        </label>
      </div>
    </div>

    <!-- Messages Header Feed -->
    <div class="flex-1 overflow-y-auto min-h-0 bg-white dark:bg-slate-950">
      <!-- Not loaded / Loading states -->
      <div v-if="!selectedAccountId" class="py-16 px-4 text-center text-slate-400 select-none">
        <FolderOpen class="w-10 h-10 mx-auto mb-3 text-slate-300 dark:text-slate-700" />
        <p class="text-xs">{{ $t('tools.email.select_account_tip') }}</p>
      </div>

      <div v-else-if="isMessagesLoading && messages.length === 0" class="py-16 px-4 text-center">
        <RefreshCw class="w-8 h-8 mx-auto mb-3 text-indigo-500 animate-spin" />
        <p class="text-xs text-slate-400">{{ $t('tools.email.syncing_messages') }}</p>
      </div>

      <div
        v-else-if="filteredMessages.length === 0"
        class="py-16 px-4 text-center text-slate-400 select-none"
      >
        <Mail class="w-10 h-10 mx-auto mb-3 text-slate-300 dark:text-slate-700" />
        <p class="text-xs">{{ $t('tools.email.no_messages') }}</p>
      </div>

      <!-- Mail Items -->
      <ul v-else class="flex flex-col border-b border-slate-100 dark:border-slate-900">
        <li
          v-for="msg in filteredMessages"
          :key="msg.id"
          class="p-3.5 border-b border-slate-100/60 dark:border-slate-900 hover:bg-slate-50/70 dark:hover:bg-slate-900/30 transition-all duration-200 cursor-pointer text-left flex flex-col gap-1.5 relative"
          :class="[
            selectedMessage?.id === msg.id
              ? 'bg-indigo-50/30 dark:bg-indigo-950/10 border-l-2 border-l-indigo-500'
              : '',
          ]"
          @click="$emit('viewMessage', msg)"
        >
          <!-- Unread Dot Badge -->
          <span
            v-show="!msg.isRead"
            class="absolute top-4 right-4 w-2 h-2 rounded-full bg-indigo-500"
          ></span>

          <!-- Sender & Date -->
          <div class="flex items-center justify-between text-[11px] text-slate-400 font-medium">
            <span class="truncate font-semibold text-slate-600 dark:text-slate-300 max-w-[150px]">
              {{ msg.from?.emailAddress?.name || msg.from?.emailAddress?.address }}
            </span>
            <span class="shrink-0">{{ formatDate(msg.receivedDateTime) }}</span>
          </div>

          <!-- Subject -->
          <h3
            class="text-xs font-semibold line-clamp-1 truncate max-w-[240px]"
            :class="
              msg.isRead
                ? 'text-slate-700 dark:text-slate-300 font-medium'
                : 'text-slate-950 dark:text-white font-bold'
            "
          >
            {{ msg.subject || $t('tools.email.no_subject') }}
          </h3>

          <!-- Snippet Body Preview -->
          <p class="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
            {{ msg.bodyPreview || $t('tools.email.no_preview') }}
          </p>
        </li>
      </ul>
    </div>
  </section>
</template>
