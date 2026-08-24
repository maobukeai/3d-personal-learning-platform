<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Mail, RefreshCw, Shield, Users, Plus } from 'lucide-vue-next';
import type { EmailAccount } from './email-types';
import EmailAccountSwitcher from './EmailAccountSwitcher.vue';
import EmailFolderList from './EmailFolderList.vue';
import EmailAccountDetailCard from './EmailAccountDetailCard.vue';
import EmailAccountManagerDrawer from './EmailAccountManagerDrawer.vue';
import Tooltip from '@/components/ui/Tooltip.vue';

interface Props {
  accounts: EmailAccount[];
  selectedAccountId: string;
  currentFolder: string;
  isAccountsLoading: boolean;
  isMultiSelectMode: boolean;
  selectedAccountIds: string[];
  isBatchTesting: boolean;
  isBatchDeleting: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'refresh'): void;
  (e: 'openImport'): void;
  (e: 'openAdd'): void;
  (e: 'toggleMultiSelect'): void;
  (e: 'toggleSelectAccount', id: string): void;
  (e: 'batchTest'): void;
  (e: 'batchDelete'): void;
  (e: 'selectAccount', id: string): void;
  (e: 'changeFolder', folderId: string): void;
  (e: 'testConnection', account: EmailAccount): void;
  (e: 'editAccount', account: EmailAccount): void;
  (e: 'deleteAccount', account: EmailAccount): void;
  (e: 'copyEmail', email: string): void;
}>();

const { t } = useI18n();
const isManagerOpen = ref(false);

const selectedAccount = computed(() => {
  return props.accounts.find((acc) => acc.id === props.selectedAccountId);
});
</script>

<template>
  <aside
    class="w-72 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex flex-col z-10 select-none h-full"
  >
    <!-- Top Action Hub -->
    <div
      class="p-3.5 border-b border-slate-100 dark:border-slate-900 flex flex-col gap-2.5 shrink-0"
    >
      <div class="mobile-row flex items-center justify-between">
        <div class="flex items-center gap-2">
          <div
            class="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400"
          >
            <Mail class="w-4 h-4" />
          </div>
          <span class="font-semibold text-slate-800 dark:text-slate-100">{{
            $t('tools.email.title')
          }}</span>
        </div>
        <Tooltip :content="$t('tools.email.refresh_tooltip')" placement="top">
          <button
            type="button"
            class="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-500 rounded-lg transition-colors duration-200 cursor-pointer"
            @click="$emit('refresh')"
          >
            <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': isAccountsLoading }" />
          </button>
        </Tooltip>
      </div>

      <!-- Account Switcher Trigger Card & Dropdown -->
      <EmailAccountSwitcher
        :accounts="accounts"
        :selected-account-id="selectedAccountId"
        :is-accounts-loading="isAccountsLoading"
        @select-account="emit('selectAccount', $event)"
        @open-add="emit('openAdd')"
        @open-import="emit('openImport')"
        @open-manager="isManagerOpen = true"
        @copy-email="emit('copyEmail', $event)"
      />
    </div>

    <!-- Main Sidebar Content (Folders & Quick Monitoring) -->
    <div class="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-4">
      <!-- Pinned Mail Folders -->
      <EmailFolderList
        :selected-account-id="selectedAccountId"
        :current-folder="currentFolder"
        @change-folder="emit('changeFolder', $event)"
      />

      <!-- Active Account Quick Monitor Card -->
      <div
        v-if="selectedAccount"
        class="flex flex-col gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-900"
      >
        <div class="px-1 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
          当前账号监控
        </div>
        <EmailAccountDetailCard
          :account="selectedAccount"
          :is-testing="isBatchTesting"
          @test-connection="emit('testConnection', $event)"
          @edit-account="emit('editAccount', $event)"
          @delete-account="emit('deleteAccount', $event)"
        />
      </div>

      <!-- No accounts empty tip -->
      <div
        v-if="accounts.length === 0"
        class="py-8 px-4 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 my-auto"
      >
        <Mail class="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-700" />
        <p class="text-xs">{{ $t('tools.email.no_accounts') }}</p>
        <button
          type="button"
          class="mt-3 flex items-center justify-center gap-1 mx-auto py-1 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer"
          @click="$emit('openAdd')"
        >
          <Plus class="w-3.5 h-3.5" /> {{ $t('tools.email.add_account') }}
        </button>
      </div>
    </div>

    <!-- Bottom Accounts Hub Entry -->
    <div
      class="p-3 border-t border-slate-100 dark:border-slate-900 flex flex-col gap-2 shrink-0 bg-slate-50/40 dark:bg-slate-900/20"
    >
      <button
        type="button"
        class="w-full flex items-center justify-between p-2 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 hover:border-indigo-200 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-all duration-200 cursor-pointer group shadow-2xs"
        @click="isManagerOpen = true"
      >
        <div class="flex items-center gap-2">
          <div
            class="p-1 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform"
          >
            <Users class="w-3.5 h-3.5" />
          </div>
          <span>管理全部账号</span>
        </div>
        <span
          class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-600 dark:group-hover:bg-indigo-900 dark:group-hover:text-indigo-300 transition-colors"
        >
          {{ accounts.length }} 个
        </span>
      </button>

      <!-- Quick Banner Support -->
      <div class="flex items-center gap-1.5 px-1 text-[10px] text-slate-400">
        <Shield class="w-3.5 h-3.5 text-indigo-500 shrink-0" />
        <span class="truncate">{{ $t('tools.email.outlook_support_tip') }}</span>
      </div>
    </div>

    <!-- All Accounts Management Drawer -->
    <EmailAccountManagerDrawer
      v-model="isManagerOpen"
      :accounts="accounts"
      :selected-account-id="selectedAccountId"
      :selected-account-ids="selectedAccountIds"
      :is-multi-select-mode="isMultiSelectMode"
      :is-batch-testing="isBatchTesting"
      :is-batch-deleting="isBatchDeleting"
      :is-accounts-loading="isAccountsLoading"
      @select-account="
        emit('selectAccount', $event);
        isManagerOpen = false;
      "
      @toggle-multi-select="emit('toggleMultiSelect')"
      @toggle-select-account="emit('toggleSelectAccount', $event)"
      @batch-test="emit('batchTest')"
      @batch-delete="emit('batchDelete')"
      @open-add="emit('openAdd')"
      @open-import="emit('openImport')"
      @refresh="emit('refresh')"
      @test-connection="emit('testConnection', $event)"
      @edit-account="emit('editAccount', $event)"
      @delete-account="emit('deleteAccount', $event)"
      @copy-email="emit('copyEmail', $event)"
    />
  </aside>
</template>
