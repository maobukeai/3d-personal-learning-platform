<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Users,
  Search,
  Plus,
  RefreshCw,
  Trash2,
  CheckCircle,
  XCircle,
  Filter,
} from 'lucide-vue-next';
import Drawer from '@/components/ui/Drawer.vue';
import Input from '@/components/ui/Input.vue';
import EmailAccountCard from './EmailAccountCard.vue';
import type { EmailAccount } from './email-types';

interface Props {
  modelValue: boolean;
  accounts: EmailAccount[];
  selectedAccountId: string;
  selectedAccountIds: string[];
  isMultiSelectMode: boolean;
  isBatchTesting: boolean;
  isBatchDeleting: boolean;
  isAccountsLoading: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'selectAccount', id: string): void;
  (e: 'toggleMultiSelect'): void;
  (e: 'toggleSelectAccount', id: string): void;
  (e: 'batchTest'): void;
  (e: 'batchDelete'): void;
  (e: 'openAdd'): void;
  (e: 'openImport'): void;
  (e: 'refresh'): void;
  (e: 'testConnection', account: EmailAccount): void;
  (e: 'editAccount', account: EmailAccount): void;
  (e: 'deleteAccount', account: EmailAccount): void;
  (e: 'copyEmail', email: string): void;
}>();

const { locale } = useI18n();
const searchQuery = ref('');
const statusFilter = ref<'ALL' | 'ACTIVE' | 'ERROR'>('ALL');

const filteredAccounts = computed(() => {
  let list = props.accounts;
  if (statusFilter.value === 'ACTIVE') {
    list = list.filter((a) => a.status === 'ACTIVE');
  } else if (statusFilter.value === 'ERROR') {
    list = list.filter((a) => a.status !== 'ACTIVE');
  }

  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return list;
  return list.filter(
    (a) => a.email.toLowerCase().includes(q) || (a.proxy && a.proxy.toLowerCase().includes(q)),
  );
});

const isAllFilteredSelected = computed(() => {
  if (filteredAccounts.value.length === 0) return false;
  return filteredAccounts.value.every((acc) => props.selectedAccountIds.includes(acc.id));
});

const toggleSelectAllFiltered = () => {
  const allSelected = isAllFilteredSelected.value;
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

const activeCount = computed(() => props.accounts.filter((a) => a.status === 'ACTIVE').length);
const errorCount = computed(() => props.accounts.filter((a) => a.status !== 'ACTIVE').length);
</script>

<template>
  <Drawer
    :model-value="modelValue"
    size="lg"
    title="已绑定邮箱账号管理"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="p-5 flex flex-col gap-4 h-full">
      <!-- Top Metrics & Action Row -->
      <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <!-- Quick Filter Badges -->
        <div class="flex items-center gap-1.5 p-1 bg-slate-100/80 dark:bg-slate-900 rounded-xl">
          <button
            type="button"
            class="px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer"
            :class="[
              statusFilter === 'ALL'
                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200',
            ]"
            @click="statusFilter = 'ALL'"
          >
            全部 ({{ accounts.length }})
          </button>
          <button
            type="button"
            class="px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
            :class="[
              statusFilter === 'ACTIVE'
                ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-2xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200',
            ]"
            @click="statusFilter = 'ACTIVE'"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            正常 ({{ activeCount }})
          </button>
          <button
            type="button"
            class="px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
            :class="[
              statusFilter === 'ERROR'
                ? 'bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 shadow-2xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200',
            ]"
            @click="statusFilter = 'ERROR'"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            异常 ({{ errorCount }})
          </button>
        </div>

        <!-- Add & Import buttons -->
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="flex items-center justify-center gap-1.5 py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-xs font-semibold transition-all shadow-sm shadow-indigo-200 dark:shadow-none cursor-pointer"
            @click="emit('openAdd')"
          >
            <Plus class="w-3.5 h-3.5" /> 添加账号
          </button>
          <button
            type="button"
            class="flex items-center justify-center gap-1.5 py-1.5 px-3 border border-slate-200 dark:border-slate-800 hover:bg-slate-100/70 dark:hover:bg-slate-900 rounded-xl text-xs font-semibold transition-all cursor-pointer"
            @click="emit('openImport')"
          >
            <Plus class="w-3.5 h-3.5" /> 批量导入
          </button>
          <button
            type="button"
            class="p-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-100/70 dark:hover:bg-slate-900 text-slate-400 hover:text-indigo-600 rounded-xl transition-all cursor-pointer"
            title="刷新全部账号列表"
            @click="emit('refresh')"
          >
            <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': isAccountsLoading }" />
          </button>
        </div>
      </div>

      <!-- Search & Multi-select Toolbar -->
      <div class="flex items-center justify-between gap-3">
        <div class="flex-1">
          <Input
            v-model="searchQuery"
            :placeholder="locale === 'en-US' ? 'Search email, proxy...' : '搜索邮箱地址、代理...'"
            :icon="Search"
            icon-position="left"
            clearable
            :glass="false"
            input-class="py-1.5 pl-8 pr-8 text-xs font-medium"
          />
        </div>
        <button
          type="button"
          class="px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer shrink-0"
          :class="[
            isMultiSelectMode
              ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 border-indigo-200 dark:border-indigo-900'
              : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900',
          ]"
          @click="emit('toggleMultiSelect')"
        >
          {{ isMultiSelectMode ? '退出多选' : '多选管理' }}
        </button>
      </div>

      <!-- Batch Actions Bar -->
      <div
        v-if="isMultiSelectMode && filteredAccounts.length > 0"
        class="flex items-center justify-between p-2.5 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-xl border border-indigo-100 dark:border-indigo-900/40 gap-3"
      >
        <div class="flex items-center gap-2">
          <input
            type="checkbox"
            :checked="isAllFilteredSelected"
            class="rounded border-slate-300 dark:border-slate-800 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            @change="toggleSelectAllFiltered"
          />
          <span class="text-xs font-semibold text-slate-700 dark:text-slate-300">
            全选 (已勾选 {{ selectedAccountIds.length }}/{{ filteredAccounts.length }} 个)
          </span>
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            :disabled="selectedAccountIds.length === 0 || isBatchTesting"
            class="flex items-center gap-1 py-1 px-2.5 bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 rounded-lg text-xs font-semibold transition-all cursor-pointer"
            @click="emit('batchTest')"
          >
            <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': isBatchTesting }" />
            批量测活 ({{ selectedAccountIds.length }})
          </button>
          <button
            type="button"
            :disabled="selectedAccountIds.length === 0 || isBatchDeleting"
            class="flex items-center gap-1 py-1 px-2.5 bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-50 rounded-lg text-xs font-semibold transition-all cursor-pointer"
            @click="emit('batchDelete')"
          >
            <Trash2 class="w-3.5 h-3.5" />
            批量解绑 ({{ selectedAccountIds.length }})
          </button>
        </div>
      </div>

      <!-- Accounts Grid / List -->
      <div class="flex-1 overflow-y-auto min-h-0 pr-1">
        <div v-if="filteredAccounts.length === 0" class="py-16 text-center text-slate-400 text-xs">
          没有匹配的邮箱账号
        </div>
        <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          <div v-for="acc in filteredAccounts" :key="acc.id">
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
          </div>
        </div>
      </div>
    </div>
  </Drawer>
</template>
