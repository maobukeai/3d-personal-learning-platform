<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from '@/utils/feedbackBridge';
import { RefreshCw, Search, Copy, FileText } from 'lucide-vue-next';

interface GoogleAccount {
  id: string;
  email: string;
  password?: string;
  recoveryEmail?: string;
  twoFASecret?: string;
  country?: string;
  note?: string;
  backupCodes?: string;
  category?: string;
  status: 'warming' | 'completed' | 'paused';
  currentDay: number;
  lastWarmedAt?: string;
  createdAt: string;
}

const props = defineProps<{
  accounts: GoogleAccount[];
  filteredAccounts: GoogleAccount[];
  selectedAccountId: string;
  selectedAccountIds: string[];
  isLoading: boolean;
  searchQuery: string;
  statusFilter: 'all' | 'warming' | 'completed' | 'paused';
  listTotpCodes: Record<string, { code: string; timeLeft: number }>;
}>();

const emit = defineEmits<{
  (e: 'update:selectedAccountIds', value: string[]): void;
  (e: 'update:searchQuery', value: string): void;
  (e: 'update:statusFilter', value: 'all' | 'warming' | 'completed' | 'paused'): void;
  (e: 'select', id: string): void;
  (e: 'refresh'): void;
  (e: 'batch-command', cmd: string): void;
}>();

const { t } = useI18n();

const localSearchQuery = computed({
  get: () => props.searchQuery,
  set: (val) => emit('update:searchQuery', val),
});

const localStatusFilter = computed({
  get: () => props.statusFilter,
  set: (val) => emit('update:statusFilter', val),
});

const localSelectedAccountIds = computed({
  get: () => props.selectedAccountIds,
  set: (val) => emit('update:selectedAccountIds', val),
});

const isAllSelected = computed(() => {
  const ids = props.filteredAccounts.map((a) => a.id);
  return ids.length > 0 && ids.every((id) => props.selectedAccountIds.includes(id));
});

const toggleSelectAll = () => {
  const ids = props.filteredAccounts.map((a) => a.id);
  if (isAllSelected.value) {
    emit(
      'update:selectedAccountIds',
      props.selectedAccountIds.filter((id) => !ids.includes(id)),
    );
  } else {
    const next = [...props.selectedAccountIds];
    ids.forEach((id) => {
      if (!next.includes(id)) {
        next.push(id);
      }
    });
    emit('update:selectedAccountIds', next);
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'completed':
      return t('tools.googleWarming.statusCompleted');
    case 'paused':
      return t('tools.googleWarming.statusPaused');
    default:
      return t('tools.googleWarming.statusWarming');
  }
};

const getStatusBadgeClass = (status: string) => {
  switch (status) {
    case 'completed':
      return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    case 'paused':
      return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
    default:
      return 'bg-sky-500/10 text-sky-400 border border-sky-500/20';
  }
};

const copyText = (text: string, message: string = '已复制到剪贴板') => {
  if (!text) return;
  navigator.clipboard
    .writeText(text)
    .then(() => {
      ElMessage.success(message);
    })
    .catch(() => {
      ElMessage.error('复制失败');
    });
};
</script>

<template>
  <div class="lg:col-span-4 xl:col-span-3 gw-card !p-3 flex flex-col gap-2 max-h-[800px] w-full">
    <div class="flex items-center justify-between">
      <span class="text-xs font-bold" style="color: var(--text-primary)"
        >{{ t('tools.googleWarming.accountsList') }}
        <span class="text-slate-500 font-normal">({{ accounts.length }})</span></span
      >
      <button class="gw-icon-btn cursor-pointer !p-1" @click="emit('refresh')">
        <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': isLoading }" />
      </button>
    </div>

    <div class="flex justify-center w-full">
      <label class="search-box !min-h-0 !h-8 w-full shrink-0">
        <Search />
        <input
          v-model="localSearchQuery"
          type="text"
          :placeholder="t('tools.googleWarming.searchPlaceholder')"
        />
      </label>
    </div>

    <div class="flex gap-0.5 p-0.5 rounded-lg text-[11px]" style="background: var(--bg-app)">
      <button
        v-for="status in ['all', 'warming', 'paused', 'completed']"
        :key="status"
        :class="[
          'flex-1 py-1 rounded-md font-medium transition-all text-center cursor-pointer',
          localStatusFilter === status
            ? 'bg-violet-600 text-white shadow-sm'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200',
        ]"
        @click="localStatusFilter = status as 'all' | 'warming' | 'completed' | 'paused'"
      >
        {{ status === 'all' ? t('tools.googleWarming.statusAll') : getStatusLabel(status) }}
      </button>
    </div>

    <div v-if="filteredAccounts.length > 0" class="flex items-center justify-between text-[11px]">
      <label
        class="flex items-center gap-1.5 cursor-pointer text-slate-500 dark:text-slate-400 select-none"
      >
        <input
          type="checkbox"
          :checked="isAllSelected"
          class="w-3 h-3 rounded accent-violet-500"
          @change="toggleSelectAll"
        />
        <span>全选 ({{ selectedAccountIds.length }})</span>
      </label>
      <Dropdown
        trigger="click"
        :disabled="selectedAccountIds.length === 0"
        @command="(cmd) => emit('batch-command', String(cmd))"
      >
        <button
          :disabled="selectedAccountIds.length === 0"
          :class="[
            'px-2 py-1 rounded border font-medium transition-all flex items-center gap-1 text-[10px] cursor-pointer',
            selectedAccountIds.length > 0
              ? 'bg-violet-600/10 border-violet-500/30 text-violet-700 dark:text-violet-400 hover:bg-violet-600/20'
              : 'border-slate-200 dark:border-slate-800 text-slate-500 cursor-not-allowed',
          ]"
        >
          {{ t('tools.googleWarming.batchActions') }}
        </button>
        <template #dropdown>
          <DropdownMenu class="dark:bg-slate-900 border-none">
            <DropdownItem
              command="warm"
              class="text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >一键打卡</DropdownItem
            >
            <DropdownItem
              command="status-warming"
              class="text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >设为 养号中</DropdownItem
            >
            <DropdownItem
              command="status-paused"
              class="text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >设为 已暂停</DropdownItem
            >
            <DropdownItem
              command="status-completed"
              class="text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >设为 已毕业</DropdownItem
            >
            <DropdownItem
              command="delete"
              divided
              class="text-red-600 dark:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >批量删除</DropdownItem
            >
          </DropdownMenu>
        </template>
      </Dropdown>
    </div>

    <div
      v-if="filteredAccounts.length === 0"
      class="py-6 text-center flex flex-col items-center justify-center gap-2"
    >
      <FileText class="w-8 h-8 gw-icon-muted" />
      <p class="gw-muted-text text-xs max-w-[180px]">
        {{
          searchQuery || statusFilter !== 'all'
            ? '未找到符合条件的账号'
            : t('tools.googleWarming.noAccounts')
        }}
      </p>
    </div>

    <div v-else class="flex flex-col gap-1.5 overflow-y-auto pr-1">
      <div
        v-for="acc in filteredAccounts"
        :key="acc.id"
        :class="[
          'gw-account-item group/item',
          selectedAccountId === acc.id ? 'gw-account-item--active' : '',
        ]"
        @click="emit('select', acc.id)"
      >
        <div class="flex items-center gap-2">
          <input
            v-model="localSelectedAccountIds"
            type="checkbox"
            :value="acc.id"
            class="w-3.5 h-3.5 rounded accent-violet-500 cursor-pointer shrink-0"
            @click.stop
          />
          <span
            class="text-[12px] font-semibold flex-1 truncate"
            style="color: var(--text-primary)"
            :title="acc.email"
            >{{ acc.email }}</span
          >
          <span
            :class="[
              'text-[9px] px-1.5 py-0.5 rounded-full font-bold shrink-0',
              getStatusBadgeClass(acc.status),
            ]"
          >
            {{ getStatusLabel(acc.status) }}
          </span>
        </div>

        <div class="flex items-center gap-2 pl-5">
          <span
            v-if="acc.note"
            class="text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0"
            style="
              background: var(--bg-app);
              color: var(--text-muted);
              border: 1px solid var(--border-base);
            "
            >{{ acc.note }}</span
          >
          <span class="text-[10px] shrink-0" style="color: var(--text-muted)"
            >第 {{ acc.currentDay }} 天</span
          >
          <div class="flex-1"></div>
          <span
            v-if="acc.twoFASecret && listTotpCodes[acc.id]"
            class="flex items-center gap-1 shrink-0"
          >
            <span
              class="font-mono text-[11px] text-violet-600 dark:text-violet-400 font-bold tracking-widest"
              >{{ listTotpCodes[acc.id].code.slice(0, 3) }}
              {{ listTotpCodes[acc.id].code.slice(3) }}</span
            >
            <span class="text-[9px] font-mono" style="color: var(--text-muted)"
              >{{ listTotpCodes[acc.id].timeLeft }}s</span
            >
            <button
              class="opacity-0 group-hover/item:opacity-100 hover:text-violet-600 dark:hover:text-violet-400 p-0.5 transition-all text-slate-500 dark:text-slate-400 cursor-pointer"
              title="复制验证码"
              @click.stop="copyText(listTotpCodes[acc.id].code, '验证码已复制')"
            >
              <Copy class="w-2.5 h-2.5" />
            </button>
          </span>
        </div>

        <div class="flex items-center gap-2 pl-5">
          <div
            class="flex-1 h-1 rounded-full overflow-hidden"
            style="background: var(--border-base)"
          >
            <div
              class="bg-gradient-to-r from-violet-500 to-indigo-500 h-full rounded-full transition-all duration-500"
              :style="{ width: `${(acc.currentDay / 14) * 100}%` }"
            ></div>
          </div>
          <span
            class="text-[9px] font-mono shrink-0 w-6 text-right"
            style="color: var(--text-muted)"
            >{{ Math.round((acc.currentDay / 14) * 100) }}%</span
          >
        </div>
      </div>
    </div>
  </div>
</template>
