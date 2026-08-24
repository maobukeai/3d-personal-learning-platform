<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import {
  User as UserIcon,
  Crown,
  Calendar,
  LogOut,
  Moon,
  Sun,
  CreditCard,
  ExternalLink,
  Loader2,
  Sparkles,
} from 'lucide-vue-next';
import Modal from '@/components/ui/Modal.vue';
import Button from '@/components/ui/Button.vue';
import { useAuthStore } from '@/stores/auth';
import { preferences } from '@/utils/preferences';
import { getPlanName } from '@/utils/plans';
import { formatDate } from '@/utils/format';
import { ElMessage } from '@/utils/feedbackBridge';
import api from '@/utils/api';

const props = defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:show', val: boolean): void;
  (e: 'open-billing'): void;
}>();

const authStore = useAuthStore();

const activeTab = ref<'profile' | 'billing'>('profile');
const transactions = ref<any[]>([]);
const isLoadingHistory = ref(false);

const isDark = ref(
  typeof document !== 'undefined'
    ? document.documentElement.classList.contains('dark') || preferences.getTheme() === 'glass-dark'
    : false,
);

function toggleTheme() {
  isDark.value = !isDark.value;
  if (typeof document !== 'undefined') {
    if (isDark.value) {
      document.documentElement.classList.add('dark');
      preferences.setTheme('glass-dark');
    } else {
      document.documentElement.classList.remove('dark');
      preferences.setTheme('glass-light');
    }
  }
}

async function fetchUserTransactions() {
  if (!authStore.isAuthenticated) return;
  isLoadingHistory.value = true;
  try {
    const res = await api.get('/api/subscriptions/transactions');
    transactions.value = res.data || [];
  } catch {
    transactions.value = [];
  } finally {
    isLoadingHistory.value = false;
  }
}

function handleLogout() {
  authStore.logout();
  emit('update:show', false);
  ElMessage.success('已安全退出登录');
}

watch(
  () => [props.show, activeTab.value],
  ([show, tab]) => {
    if (show && tab === 'billing') {
      fetchUserTransactions();
    }
  },
);
</script>

<template>
  <Modal :show="show" title="个人中心与账号管理" size="md" @close="emit('update:show', false)">
    <div class="space-y-4">
      <!-- User Summary Card -->
      <div
        class="flex items-center gap-3.5 p-4 rounded-2xl bg-gradient-to-r from-blue-500/10 via-purple-500/5 to-transparent border border-blue-200/60 dark:border-blue-500/20"
      >
        <div
          class="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-lg font-black shrink-0 shadow-md shadow-blue-500/20"
        >
          {{ (authStore.user?.name || authStore.user?.email || 'U').slice(0, 1).toUpperCase() }}
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <h3 class="font-bold text-slate-900 dark:text-white truncate text-base">
              {{ authStore.user?.name || '平台用户' }}
            </h3>
            <span
              class="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-600 dark:text-amber-400"
            >
              {{ getPlanName(authStore.user?.subscription?.plan?.priority ?? 0) }} 会员
            </span>
          </div>
          <p class="text-xs text-slate-400 truncate mt-0.5">{{ authStore.user?.email }}</p>
        </div>

        <button
          type="button"
          class="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
          :title="isDark ? '切换浅色模式' : '切换深色模式'"
          @click="toggleTheme"
        >
          <Sun v-if="isDark" class="w-4 h-4 text-amber-400" />
          <Moon v-else class="w-4 h-4 text-slate-600" />
        </button>
      </div>

      <!-- Navigation Tabs -->
      <div
        class="flex items-center gap-2 border-b border-slate-200/80 dark:border-slate-700/60 pb-2"
      >
        <button
          type="button"
          class="px-3 py-1 text-xs font-bold rounded-lg transition-all"
          :class="
            activeTab === 'profile'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400'
          "
          @click="activeTab = 'profile'"
        >
          账号权益
        </button>
        <button
          type="button"
          class="px-3 py-1 text-xs font-bold rounded-lg transition-all"
          :class="
            activeTab === 'billing'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400'
          "
          @click="activeTab = 'billing'"
        >
          充值账单明细
        </button>
      </div>

      <!-- Tab Content: Profile & Privileges -->
      <div v-if="activeTab === 'profile'" class="space-y-3 py-1">
        <div
          class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 space-y-2.5"
        >
          <div class="flex items-center justify-between text-xs">
            <span class="text-slate-500 dark:text-slate-400">会员有效期：</span>
            <span class="font-bold text-slate-800 dark:text-slate-200">
              {{
                (authStore.user?.subscription as any)?.endDate
                  ? formatDate((authStore.user?.subscription as any).endDate)
                  : '永久 / 免费期'
              }}
            </span>
          </div>
          <div class="flex items-center justify-between text-xs">
            <span class="text-slate-500 dark:text-slate-400">积分余额：</span>
            <span class="font-bold text-blue-600 dark:text-blue-400"
              >{{ authStore.user?.points ?? 0 }} 积分</span
            >
          </div>
          <div class="flex items-center justify-between text-xs">
            <span class="text-slate-500 dark:text-slate-400">账号角色：</span>
            <span class="font-semibold text-slate-700 dark:text-slate-300">{{
              authStore.user?.role === 'ADMIN' ? '系统管理员' : '正式学员'
            }}</span>
          </div>
        </div>

        <div class="flex items-center gap-2 pt-2">
          <Button
            variant="primary"
            class="flex-1 h-9 text-xs font-bold"
            @click="
              emit('open-billing');
              emit('update:show', false);
            "
          >
            <Crown class="w-3.5 h-3.5 mr-1" />充值 / 升级会员
          </Button>

          <Button
            variant="danger"
            class="h-9 px-4 text-xs font-bold shrink-0"
            @click="handleLogout"
          >
            <LogOut class="w-3.5 h-3.5 mr-1" />退出
          </Button>
        </div>
      </div>

      <!-- Tab Content: Billing Transactions -->
      <div v-else class="space-y-3 py-1">
        <div v-if="isLoadingHistory" class="py-8 flex items-center justify-center">
          <Loader2 class="w-5 h-5 animate-spin text-blue-500" />
        </div>

        <div
          v-else-if="transactions.length === 0"
          class="py-8 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-xl"
        >
          暂无历史充值或消费账单
        </div>

        <div v-else class="max-h-60 overflow-y-auto space-y-2 pr-1 scrollbar-hide">
          <div
            v-for="item in transactions"
            :key="item.id"
            class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between text-xs"
          >
            <div>
              <p class="font-bold text-slate-800 dark:text-slate-200">
                {{ item.description || '会员订阅' }}
              </p>
              <p class="text-[10px] text-slate-400">{{ formatDate(item.createdAt) }}</p>
            </div>
            <span class="font-black text-emerald-600 dark:text-emerald-400"
              >￥{{ item.amount }}</span
            >
          </div>
        </div>
      </div>
    </div>
  </Modal>
</template>
