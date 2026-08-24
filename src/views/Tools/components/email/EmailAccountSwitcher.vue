<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { ChevronsUpDown, Search, Plus, Copy, Check, Globe, Users } from 'lucide-vue-next';
import type { EmailAccount } from './email-types';
import Input from '@/components/ui/Input.vue';
import Tooltip from '@/components/ui/Tooltip.vue';

interface Props {
  accounts: EmailAccount[];
  selectedAccountId: string;
  isAccountsLoading: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'selectAccount', id: string): void;
  (e: 'openAdd'): void;
  (e: 'openImport'): void;
  (e: 'openManager'): void;
  (e: 'copyEmail', email: string): void;
}>();

const { locale } = useI18n();

const isOpen = ref(false);
const switcherRef = ref<HTMLElement | null>(null);
const searchQuery = ref('');

const selectedAccount = computed(() => {
  return props.accounts.find((acc) => acc.id === props.selectedAccountId);
});

const filteredAccounts = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return props.accounts;
  return props.accounts.filter(
    (acc) =>
      acc.email.toLowerCase().includes(q) || (acc.proxy && acc.proxy.toLowerCase().includes(q)),
  );
});

const getInitials = (email: string) => {
  if (!email) return 'M';
  const name = email.split('@')[0];
  return name.slice(0, 2).toUpperCase();
};

const toggleDropdown = () => {
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    searchQuery.value = '';
  }
};

const handleSelect = (id: string) => {
  emit('selectAccount', id);
  isOpen.value = false;
};

const handleClickOutside = (e: MouseEvent) => {
  if (switcherRef.value && !switcherRef.value.contains(e.target as Node)) {
    isOpen.value = false;
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<template>
  <div ref="switcherRef" class="relative w-full">
    <!-- Active Account Trigger Card -->
    <button
      type="button"
      class="w-full flex items-center justify-between p-2 rounded-xl border border-slate-200/80 dark:border-slate-800/80 hover:border-indigo-300 dark:hover:border-indigo-800 bg-slate-50/70 dark:bg-slate-900/40 hover:bg-slate-100/70 dark:hover:bg-slate-900/80 transition-all duration-200 text-left cursor-pointer group shadow-2xs"
      :class="{ 'ring-2 ring-indigo-500/20 border-indigo-400 dark:border-indigo-600': isOpen }"
      @click="toggleDropdown"
    >
      <div class="flex items-center gap-2.5 min-w-0 flex-1">
        <!-- Account Avatar -->
        <div
          class="w-8 h-8 rounded-lg bg-linear-to-br from-indigo-500 to-sky-600 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-xs tracking-wider"
        >
          {{ selectedAccount ? getInitials(selectedAccount.email) : 'M' }}
        </div>

        <!-- Account Info -->
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-1.5">
            <span
              class="font-semibold text-xs text-slate-800 dark:text-slate-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors"
            >
              {{
                selectedAccount
                  ? selectedAccount.email
                  : $t('tools.email.no_accounts') || '暂无账号'
              }}
            </span>
            <span
              v-if="selectedAccount"
              class="w-1.5 h-1.5 rounded-full shrink-0"
              :class="[
                selectedAccount.status === 'ACTIVE'
                  ? 'bg-emerald-500 ring-2 ring-emerald-500/20'
                  : selectedAccount.status === 'EXPIRED'
                    ? 'bg-amber-500 ring-2 ring-amber-500/20'
                    : 'bg-rose-500 ring-rose-500/20',
              ]"
            ></span>
          </div>
          <div class="flex items-center gap-2 text-[10px] text-slate-400">
            <span v-if="selectedAccount"
              >今日: {{ selectedAccount.sentCountToday }}/{{ selectedAccount.dailyLimit }} 封</span
            >
            <span v-else>点击添加邮箱账号</span>
            <span class="text-slate-300 dark:text-slate-700">·</span>
            <span>{{ accounts.length }} 个账号</span>
          </div>
        </div>
      </div>

      <!-- Dropdown Arrow -->
      <ChevronsUpDown
        class="w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 transition-colors shrink-0 ml-1"
      />
    </button>

    <!-- Dropdown Popover -->
    <transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="transform scale-95 opacity-0 -translate-y-1"
      enter-to-class="transform scale-100 opacity-100 translate-y-0"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="transform scale-100 opacity-100 translate-y-0"
      leave-to-class="transform scale-95 opacity-0 -translate-y-1"
    >
      <div
        v-if="isOpen"
        class="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-xl p-2 flex flex-col gap-2 min-w-[260px]"
      >
        <!-- Search Bar -->
        <div class="px-0.5">
          <Input
            v-model="searchQuery"
            :placeholder="locale === 'en-US' ? 'Search accounts...' : '搜索邮箱账号...'"
            :icon="Search"
            icon-position="left"
            clearable
            :glass="false"
            input-class="py-1 pl-7.5 pr-7 text-xs"
          />
        </div>

        <!-- Quick Actions -->
        <div class="flex items-center gap-1.5 px-0.5">
          <button
            type="button"
            class="flex-1 flex items-center justify-center gap-1 py-1 px-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100/80 text-[10px] font-semibold transition-colors cursor-pointer"
            @click="
              emit('openAdd');
              isOpen = false;
            "
          >
            <Plus class="w-3 h-3" />
            <span>添加账号</span>
          </button>
          <button
            type="button"
            class="flex-1 flex items-center justify-center gap-1 py-1 px-2 rounded-lg bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 text-[10px] font-semibold transition-colors cursor-pointer"
            @click="
              emit('openImport');
              isOpen = false;
            "
          >
            <Plus class="w-3 h-3" />
            <span>批量导入</span>
          </button>
        </div>

        <!-- Accounts Scrollable List -->
        <div class="max-h-56 overflow-y-auto flex flex-col gap-1 pr-0.5">
          <div v-if="filteredAccounts.length === 0" class="py-4 text-center text-xs text-slate-400">
            没有找到匹配的邮箱
          </div>
          <button
            v-for="acc in filteredAccounts"
            :key="acc.id"
            type="button"
            class="w-full flex items-center justify-between p-2 rounded-xl text-left transition-all duration-150 group cursor-pointer"
            :class="[
              acc.id === selectedAccountId
                ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-900 dark:text-indigo-200 font-semibold'
                : 'hover:bg-slate-100/70 dark:hover:bg-slate-900/60 text-slate-700 dark:text-slate-300',
            ]"
            @click="handleSelect(acc.id)"
          >
            <div class="flex items-center gap-2 min-w-0 flex-1">
              <div
                class="w-6 h-6 rounded-md bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-600 dark:text-slate-300 shrink-0"
              >
                {{ getInitials(acc.email) }}
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1.5">
                  <span class="text-xs truncate">{{ acc.email }}</span>
                  <span
                    class="w-1.5 h-1.5 rounded-full shrink-0"
                    :class="[
                      acc.status === 'ACTIVE'
                        ? 'bg-emerald-500'
                        : acc.status === 'EXPIRED'
                          ? 'bg-amber-500'
                          : 'bg-rose-500',
                    ]"
                  ></span>
                </div>
                <div class="flex items-center gap-1.5 text-[10px] text-slate-400 font-normal">
                  <span>{{ acc.sentCountToday }}/{{ acc.dailyLimit }} 封</span>
                  <span>·</span>
                  <span class="truncate flex items-center gap-0.5">
                    <Globe class="w-2.5 h-2.5" />
                    {{ acc.proxy ? acc.proxy.split('@').pop() : 'Direct' }}
                  </span>
                </div>
              </div>
            </div>

            <div class="flex items-center gap-1 shrink-0 ml-1">
              <Tooltip content="复制邮箱" placement="top">
                <button
                  type="button"
                  class="p-1 hover:bg-white dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-600 rounded opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                  @click.stop="emit('copyEmail', acc.email)"
                >
                  <Copy class="w-3 h-3" />
                </button>
              </Tooltip>
              <Check
                v-if="acc.id === selectedAccountId"
                class="w-4 h-4 text-indigo-600 dark:text-indigo-400 ml-1"
              />
            </div>
          </button>
        </div>

        <!-- Footer Manager Entry -->
        <div class="pt-1.5 border-t border-slate-100 dark:border-slate-900">
          <button
            type="button"
            class="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100/70 dark:hover:bg-slate-900 transition-colors cursor-pointer"
            @click="
              emit('openManager');
              isOpen = false;
            "
          >
            <Users class="w-3.5 h-3.5" />
            <span>管理全部 {{ accounts.length }} 个邮箱账号 →</span>
          </button>
        </div>
      </div>
    </transition>
  </div>
</template>
