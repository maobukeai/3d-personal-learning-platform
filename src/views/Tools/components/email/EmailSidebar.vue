<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Mail,
  Plus,
  RefreshCw,
  Trash2,
  Inbox,
  Send,
  AlertTriangle,
  FileText,
  ChevronRight,
  Globe,
  CheckCircle,
  Edit,
  Copy,
  Shield,
} from 'lucide-vue-next';
import type { EmailAccount } from './email-types';

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

defineEmits<{
  (e: 'refresh'): void;
  (e: 'openImport'): void;
  (e: 'openAdd'): void;
  (e: 'toggleMultiSelect'): void;
  (e: 'toggleSelectAll'): void;
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

const { t, locale } = useI18n();

const foldersList = [
  { id: 'inbox', name: t('tools.email.folders.inbox'), icon: Inbox },
  { id: 'sentitems', name: t('tools.email.folders.sentitems'), icon: Send },
  { id: 'drafts', name: t('tools.email.folders.drafts'), icon: FileText },
  { id: 'junkemail', name: t('tools.email.folders.junkemail'), icon: AlertTriangle },
  { id: 'deleteditems', name: t('tools.email.folders.deleteditems'), icon: Trash2 },
];

const isAllSelected = computed(() => {
  return props.accounts.length > 0 && props.selectedAccountIds.length === props.accounts.length;
});

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
              @change="$emit('toggleSelectAll')"
            />
            <span
              >{{ $t('tools.email.all_selected') }} ({{ selectedAccountIds.length }}/{{
                accounts.length
              }})</span
            >
          </div>
          <span v-else>{{ $t('tools.email.bound_accounts', { n: accounts.length }) }}</span>

          <button
            v-if="accounts.length > 0"
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
        <div v-if="isMultiSelectMode && accounts.length > 0" class="flex gap-2 mb-3 px-1">
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

        <ul v-else class="flex flex-col gap-1.5">
          <li v-for="acc in accounts" :key="acc.id">
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
                isMultiSelectMode
                  ? $emit('toggleSelectAccount', acc.id)
                  : $emit('selectAccount', acc.id)
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
          </li>
        </ul>
      </div>

      <!-- Folder Lists -->
      <div v-show="selectedAccountId" class="border-t border-slate-100 dark:border-slate-900 pt-4">
        <div class="px-2 mb-2 text-xs font-semibold tracking-wider text-slate-400 uppercase">
          {{ $t('tools.email.email_folders_label') }}
        </div>
        <ul class="flex flex-col gap-0.5">
          <li v-for="folder in foldersList" :key="folder.id">
            <button
              type="button"
              class="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium transition-all duration-200 text-left"
              :class="[
                currentFolder === folder.id
                  ? 'bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-semibold'
                  : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900/50 hover:text-slate-800 dark:hover:text-slate-200',
              ]"
              @click="$emit('changeFolder', folder.id)"
            >
              <div class="flex items-center gap-2">
                <component :is="folder.icon" class="w-4 h-4 text-slate-400" />
                <span>{{ folder.name }}</span>
              </div>
              <ChevronRight v-show="currentFolder === folder.id" class="w-3 h-3 text-slate-300" />
            </button>
          </li>
        </ul>
      </div>
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
