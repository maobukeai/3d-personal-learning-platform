<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Mail, Plus, RefreshCw, Trash2, Shield, Search } from 'lucide-vue-next';
import type { EmailAccount } from './email-types';
import EmailAccountCard from './EmailAccountCard.vue';
import EmailFolderList from './EmailFolderList.vue';
import Input from '@/components/ui/Input.vue';

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

const { locale } = useI18n();

// Search Query for Email Accounts
const searchQuery = ref('');

const filteredAccounts = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) return props.accounts;
  return props.accounts.filter((acc) => acc.email.toLowerCase().includes(query));
});

// Check if all filtered accounts are selected
const isAllSelected = computed(() => {
  if (filteredAccounts.value.length === 0) return false;
  return filteredAccounts.value.every((acc) => props.selectedAccountIds.includes(acc.id));
});

// Toggle select all only for filtered accounts
const toggleSelectAllFiltered = () => {
  const allSelected = isAllSelected.value;
  filteredAccounts.value.forEach((acc) => {
    const isSelected = props.selectedAccountIds.includes(acc.id);
    if (allSelected && isSelected) {
      emit('toggleSelectAccount', acc.id);
    } else if (!allSelected && !isSelected) {
      emit('toggleSelectAccount', acc.id);
    }
  });
};

const copyTooltip = computed(() => {
  return locale.value === 'en-US' ? 'Copy Email' : '复制邮箱';
});
</script>

<template>
  <aside
    class="w-72 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 flex flex-col z-10 select-none"
  >
    <!-- Top Action Hub -->
    <div class="p-4 border-b border-slate-100 dark:border-slate-900 flex flex-col gap-2.5">
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
            class="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-500 rounded-lg transition-colors duration-200"
            @click="$emit('refresh')"
          >
            <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': isAccountsLoading }" />
          </button>
        </Tooltip>
      </div>

      <div class="grid grid-cols-2 gap-2 mt-1">
        <button
          type="button"
          class="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-lg text-xs font-medium transition-all duration-200 shadow-sm shadow-indigo-200 dark:shadow-none"
          @click="$emit('openImport')"
        >
          <Plus class="w-3.5 h-3.5" /> {{ $t('tools.email.batch_import') }}
        </button>
        <button
          type="button"
          class="flex items-center justify-center gap-1.5 py-1.5 px-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-lg text-xs font-medium transition-all duration-200"
          @click="$emit('openAdd')"
        >
          <Plus class="w-3.5 h-3.5" /> {{ $t('tools.email.add_account') }}
        </button>
      </div>

      <!-- Search Input -->
      <div v-if="accounts.length > 0" class="mt-1">
        <Input
          v-model="searchQuery"
          :placeholder="locale === 'en-US' ? 'Search email...' : '搜索邮箱...'"
          :icon="Search"
          icon-position="left"
          clearable
          :glass="false"
          input-class="!py-1.5 !pl-8.5 !pr-9 text-xs font-semibold"
        />
      </div>
    </div>

    <!-- Scrollable Accounts List -->
    <div class="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-4">
      <div>
        <div
          class="flex items-center justify-between px-2 mb-2 text-xs font-semibold tracking-wider text-slate-400 uppercase"
        >
          <div v-if="isMultiSelectMode" class="flex items-center gap-1.5">
            <input
              type="checkbox"
              :checked="isAllSelected"
              class="rounded border-slate-300 dark:border-slate-800 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              @change="toggleSelectAllFiltered"
            />
            <span
              >{{ $t('tools.email.all_selected') }} ({{ selectedAccountIds.length }}/{{
                filteredAccounts.length
              }})</span
            >
          </div>
          <span v-else>{{ $t('tools.email.bound_accounts', { n: filteredAccounts.length }) }}</span>

          <button
            v-if="filteredAccounts.length > 0"
            type="button"
            class="text-[10px] font-bold text-indigo-500 hover:text-indigo-600 cursor-pointer transition-colors"
            @click="$emit('toggleMultiSelect')"
          >
            {{
              isMultiSelectMode ? $t('tools.email.cancel_btn') : $t('tools.email.batch_management')
            }}
          </button>
        </div>

        <!-- Batch Action Buttons -->
        <div v-if="isMultiSelectMode && filteredAccounts.length > 0" class="flex gap-2 mb-3 px-1">
          <button
            type="button"
            :disabled="selectedAccountIds.length === 0 || isBatchTesting"
            class="flex-1 flex items-center justify-center gap-1 py-1 px-1.5 bg-indigo-50 dark:bg-indigo-950/30 hover:bg-indigo-100/80 text-indigo-600 dark:text-indigo-400 disabled:opacity-50 disabled:pointer-events-none rounded-lg text-[10px] font-bold border border-indigo-200/50 dark:border-indigo-900/40 transition-all cursor-pointer"
            @click="$emit('batchTest')"
          >
            <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': isBatchTesting }" />
            {{ $t('tools.email.verify_batch') }}
          </button>
          <button
            type="button"
            :disabled="selectedAccountIds.length === 0 || isBatchDeleting"
            class="flex-1 flex items-center justify-center gap-1 py-1 px-1.5 bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100/80 text-rose-600 dark:text-rose-400 disabled:opacity-50 disabled:pointer-events-none rounded-lg text-[10px] font-bold border border-rose-200/50 dark:border-rose-900/40 transition-all cursor-pointer"
            @click="$emit('batchDelete')"
          >
            <Trash2 class="w-3.5 h-3.5" />
            {{ $t('tools.email.unbind_batch') }}
          </button>
        </div>

        <div
          v-if="accounts.length === 0"
          class="py-8 px-4 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400"
        >
          <Mail class="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-700" />
          <p class="text-xs">{{ $t('tools.email.no_accounts') }}</p>
          <p class="text-[10px] mt-1">{{ $t('tools.email.add_first_tip') }}</p>
        </div>

        <div
          v-else-if="filteredAccounts.length === 0"
          class="py-8 px-4 text-center text-xs text-slate-400"
        >
          {{ locale === 'en-US' ? 'No emails matched your search' : '没有找到匹配的邮箱' }}
        </div>

        <ul v-else class="flex flex-col gap-1.5">
          <li v-for="acc in filteredAccounts" :key="acc.id">
            <EmailAccountCard
              :acc="acc"
              :selected-account-id="selectedAccountId"
              :is-multi-select-mode="isMultiSelectMode"
              :selected-account-ids="selectedAccountIds"
              :copy-tooltip="copyTooltip"
              @toggle-select-account="emit('toggleSelectAccount', $event)"
              @select-account="emit('selectAccount', $event)"
              @copy-email="emit('copyEmail', $event)"
              @test-connection="emit('testConnection', $event)"
              @edit-account="emit('editAccount', $event)"
              @delete-account="emit('deleteAccount', $event)"
            />
          </li>
        </ul>
      </div>

      <!-- Folder Lists -->
      <EmailFolderList
        :selected-account-id="selectedAccountId"
        :current-folder="currentFolder"
        @change-folder="emit('changeFolder', $event)"
      />
    </div>

    <!-- Quick Banner Support -->
    <div
      class="p-3 bg-indigo-50/30 dark:bg-indigo-950/10 border-t border-slate-100 dark:border-slate-900 flex items-center gap-2"
    >
      <Shield class="w-4 h-4 text-indigo-500" />
      <div class="text-[10px] text-slate-400">
        {{ $t('tools.email.outlook_support_tip') }}
      </div>
    </div>
  </aside>
</template>
