<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  Pencil,
  Trash2,
  Users,
  Check,
  X,
  CreditCard,
  Zap,
  Crown,
  Search,
  Save,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import { getApiErrorMessage } from '@/utils/error';
import api from '@/utils/api';

interface PlanType {
  id: string;
  name: string;
  displayName: string | null;
  price: number;
  badgeColor: string | null;
}

interface UserType {
  id: string;
  name: string | null;
  email: string;
  avatarUrl?: string | null;
}

interface SubscriptionType {
  id: string;
  userId: string;
  planId: string;
  status: string;
  interval: string;
  startDate: string;
  endDate: string | null;
  autoRenew: boolean;
  cancelAtPeriodEnd: boolean;
  paymentMethod: string | null;
  user?: UserType | null;
  plan?: PlanType | null;
}

interface Props {
  subscriptions: SubscriptionType[];
  plans: PlanType[];
  users: UserType[];
  isLoading: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'refresh'): void;
  (e: 'fetch-users'): void;
}>();

const showSubDialog = ref(false);
const editingSubscription = ref<SubscriptionType | null>(null);
const userSearchQuery = ref('');
const subSearchQuery = ref('');
const subStatusFilter = ref<'ALL' | 'ACTIVE' | 'CANCELED' | 'EXPIRED' | 'PAST_DUE'>('ALL');

const defaultSubForm = {
  userId: '',
  planId: '',
  status: 'ACTIVE',
  interval: 'MONTHLY',
  startDate: '',
  endDate: '',
  autoRenew: true,
  cancelAtPeriodEnd: false,
  paymentMethod: 'ADMIN_ASSIGN',
};

const subForm = ref({ ...defaultSubForm });

const filteredUsers = computed(() => {
  if (!userSearchQuery.value) return props.users;
  const q = userSearchQuery.value.toLowerCase();
  return props.users.filter(
    (u: UserType) =>
      (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q),
  );
});

const filteredSubscriptions = computed(() => {
  let result = props.subscriptions;
  if (subStatusFilter.value !== 'ALL') {
    result = result.filter((s: SubscriptionType) => s.status === subStatusFilter.value);
  }
  if (subSearchQuery.value) {
    const q = subSearchQuery.value.toLowerCase();
    result = result.filter(
      (s: SubscriptionType) =>
        (s.user?.name || '').toLowerCase().includes(q) ||
        (s.user?.email || '').toLowerCase().includes(q) ||
        (s.plan?.displayName || s.plan?.name || '').toLowerCase().includes(q),
    );
  }
  return result;
});

const subscribedUserIds = computed(() => new Set(props.subscriptions.map((s: SubscriptionType) => s.userId)));

const availableUsers = computed(() => {
  if (editingSubscription.value) return props.users;
  return filteredUsers.value.filter((u: UserType) => !subscribedUserIds.value.has(u.id));
});

const openCreateSubscription = async () => {
  editingSubscription.value = null;
  subForm.value = { ...defaultSubForm };
  userSearchQuery.value = '';
  emit('fetch-users');
  showSubDialog.value = true;
};

const openEditSubscription = async (sub: SubscriptionType) => {
  editingSubscription.value = sub;
  subForm.value = {
    userId: sub.userId,
    planId: sub.planId,
    status: sub.status,
    interval: sub.interval,
    startDate: sub.startDate ? new Date(sub.startDate).toISOString().slice(0, 16) : '',
    endDate: sub.endDate ? new Date(sub.endDate).toISOString().slice(0, 16) : '',
    autoRenew: sub.autoRenew,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    paymentMethod: sub.paymentMethod || 'ADMIN_ASSIGN',
  };
  userSearchQuery.value = '';
  emit('fetch-users');
  showSubDialog.value = true;
};

defineExpose({ openCreateSubscription, openEditSubscription });

const handleSaveSubscription = async () => {
  if (!subForm.value.userId) {
    ElMessage.warning('请选择用户');
    return;
  }
  if (!subForm.value.planId) {
    ElMessage.warning('请选择订阅计划');
    return;
  }
  try {
    if (editingSubscription.value) {
      const payload: Partial<SubscriptionType> = { ...subForm.value };
      if (!payload.endDate) payload.endDate = null;
      await api.put(`/api/admin/subscriptions/${editingSubscription.value.id}`, payload);
      ElMessage.success('订阅已更新');
    } else {
      await api.post('/api/admin/subscriptions', subForm.value);
      ElMessage.success('订阅已创建');
    }
    showSubDialog.value = false;
    emit('refresh');
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '保存失败'));
  }
};

const handleDeleteSubscription = async (sub: SubscriptionType) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除用户 ${sub.user?.name || sub.user?.email} 的订阅吗？此操作不可恢复。`,
      '确认删除',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' },
    );
    await api.delete(`/api/admin/subscriptions/${sub.id}`);
    ElMessage.success('订阅已删除');
    emit('refresh');
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(getApiErrorMessage(error, '删除失败'));
    }
  }
};

const getPlanIcon = (name: string | undefined) => {
  if (name === 'VIP') return Zap;
  if (name === 'SVIP') return Crown;
  return CreditCard;
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'ACTIVE':
      return 'bg-emerald-500/10 text-emerald-500';
    case 'CANCELED':
      return 'bg-rose-500/10 text-rose-500';
    case 'EXPIRED':
      return 'bg-slate-500/10 text-slate-500';
    case 'PAST_DUE':
      return 'bg-amber-500/10 text-amber-500';
    default:
      return 'bg-slate-500/10 text-slate-500';
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'ACTIVE':
      return '活跃';
    case 'CANCELED':
      return '已取消';
    case 'EXPIRED':
      return '已过期';
    case 'PAST_DUE':
      return '逾期';
    default:
      return status;
  }
};
</script>

<template>
  <div class="space-y-6 animate-in fade-in duration-200">
    <!-- Filter Bar inside Tab Component for high cohesion -->
    <div
      class="py-2.5 flex flex-col md:flex-row md:flex-wrap md:items-center justify-between gap-3 relative z-10 transition-colors duration-300"
    >
      <div class="flex flex-nowrap items-center gap-1 sm:gap-3 max-w-full shrink-0">
        <div class="flex flex-nowrap items-center gap-0.5 sm:gap-1.5 shrink-0">
          <button
v-for="filter in [
              { key: 'ALL', label: '全部订阅', count: subscriptions.length },
              {
                key: 'ACTIVE',
                label: '活跃',
                count: subscriptions.filter((s: SubscriptionType) => s.status === 'ACTIVE').length,
              },
              {
                key: 'CANCELED',
                label: '已取消',
                count: subscriptions.filter((s: SubscriptionType) => s.status === 'CANCELED').length,
              },
              {
                key: 'EXPIRED',
                label: '已过期',
                count: subscriptions.filter((s: SubscriptionType) => s.status === 'EXPIRED').length,
              },
              {
                key: 'PAST_DUE',
                label: '逾期',
                count: subscriptions.filter((s: SubscriptionType) => s.status === 'PAST_DUE').length,
              },
            ]" :key="filter.key" type="button" class="px-1 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg border text-[8px] xs:text-[9px] sm:text-[11px] font-bold flex items-center gap-0.5 sm:gap-1.5 transition-all cursor-pointer shrink-0" :class="[
              subStatusFilter === filter.key
                ? filter.key === 'ACTIVE'
                  ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 ring-1 ring-emerald-500/20 font-extrabold shadow-sm'
                  : filter.key === 'CANCELED'
                    ? 'bg-rose-500/10 text-rose-500 border-rose-500/30 ring-1 ring-rose-500/20 font-extrabold shadow-sm'
                    : filter.key === 'PAST_DUE'
                      ? 'bg-amber-500/10 text-amber-500 border-amber-500/30 ring-1 ring-amber-500/20 font-extrabold shadow-sm'
                      : filter.key === 'EXPIRED'
                        ? 'bg-slate-500/10 text-slate-500 border-slate-500/30 ring-1 ring-slate-500/20 font-extrabold shadow-sm'
                        : 'bg-violet-500/10 text-violet-500 border-violet-500/30 ring-1 ring-violet-500/20 font-extrabold shadow-sm'
                : 'border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5',
            ]" @click="subStatusFilter = filter.key as any">
            <span>{{ filter.label }}</span>
            <span class="opacity-60">({{ filter.count }})</span>
          </button>
        </div>
      </div>

      <div class="w-full flex items-center justify-between md:justify-end gap-3 md:w-auto shrink-0">
        <div class="relative flex-1 md:flex-none md:w-64">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            v-model="subSearchQuery"
            type="text"
            placeholder="搜索用户名、邮箱或计划..."
            class="w-full pl-9 pr-3 py-1.5 rounded-lg border transition-all focus:ring-2 focus:ring-violet-500/20 outline-none text-[11px] shadow-sm"
            style="
              background-color: var(--bg-app);
              border-color: var(--border-base);
              color: var(--text-primary);
            "
          />
        </div>
        <div class="text-[10px] font-bold text-right shrink-0" style="color: var(--text-muted)">
          已过滤:
          <span class="text-violet-600 font-extrabold">{{ filteredSubscriptions.length }}</span>
          / 总计: {{ subscriptions.length }}
        </div>
      </div>
    </div>

    <!-- Desktop Table View -->
    <div
      class="hidden md:block rounded-3xl border border-[var(--border-base)] bg-[var(--bg-card)] overflow-hidden overflow-x-auto scrollbar-hide"
    >
      <table class="w-full text-left border-collapse min-w-[1000px]">
        <thead>
          <tr class="bg-[var(--bg-app)]/50 border-b border-[var(--border-base)]">
            <th
              class="px-4 sm:px-6 py-3.5 sm:py-4 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]"
            >
              用户
            </th>
            <th
              class="px-4 sm:px-6 py-3.5 sm:py-4 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]"
            >
              计划
            </th>
            <th
              class="px-4 sm:px-6 py-3.5 sm:py-4 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]"
            >
              状态
            </th>
            <th
              class="px-4 sm:px-6 py-3.5 sm:py-4 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]"
            >
              周期
            </th>
            <th
              class="px-4 sm:px-6 py-3.5 sm:py-4 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]"
            >
              开始日期
            </th>
            <th
              class="px-4 sm:px-6 py-3.5 sm:py-4 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]"
            >
              到期日期
            </th>
            <th
              class="px-4 sm:px-6 py-3.5 sm:py-4 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]"
            >
              自动续费
            </th>
            <th
              class="px-4 sm:px-6 py-3.5 sm:py-4 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]"
            >
              操作
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[var(--border-base)]">
          <tr
            v-for="sub in filteredSubscriptions"
            :key="sub.id"
            class="hover:bg-[var(--bg-app)]/30 transition-colors"
          >
            <td class="px-4 sm:px-6 py-3.5 sm:py-4">
              <div class="flex items-center gap-3">
                <div
                  class="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-500"
                >
                  {{ (sub.user?.name || sub.user?.email || '?').charAt(0).toUpperCase() }}
                </div>
                <div>
                  <p class="text-sm font-bold text-[var(--text-primary)]">
                    {{ sub.user?.name || '未命名' }}
                  </p>
                  <p class="text-[10px] text-[var(--text-muted)]">{{ sub.user?.email }}</p>
                </div>
              </div>
            </td>
            <td class="px-4 sm:px-6 py-3.5 sm:py-4">
              <span
                class="px-2 py-0.5 rounded-full text-[10px] font-bold"
                :style="{
                  backgroundColor: (sub.plan?.badgeColor || '#8b5cf6') + '15',
                  color: sub.plan?.badgeColor || '#8b5cf6',
                }"
              >
                {{ sub.plan?.displayName || sub.plan?.name }}
              </span>
            </td>
            <td class="px-4 sm:px-6 py-3.5 sm:py-4">
              <span
                class="px-2 py-0.5 rounded-full text-[10px] font-bold"
                :class="getStatusColor(sub.status)"
              >
                {{ getStatusLabel(sub.status) }}
              </span>
            </td>
            <td class="px-4 sm:px-6 py-3.5 sm:py-4 text-sm text-[var(--text-secondary)]">
              {{ sub.interval === 'YEARLY' ? '年付' : '月付' }}
            </td>
            <td class="px-4 sm:px-6 py-3.5 sm:py-4 text-xs text-[var(--text-secondary)]">
              {{ new Date(sub.startDate).toLocaleDateString() }}
            </td>
            <td class="px-4 sm:px-6 py-3.5 sm:py-4 text-xs text-[var(--text-secondary)]">
              {{ sub.endDate ? new Date(sub.endDate).toLocaleDateString() : '-' }}
            </td>
            <td class="px-4 sm:px-6 py-3.5 sm:py-4">
              <component
                :is="sub.autoRenew ? Check : X"
                class="w-4 h-4"
                :class="sub.autoRenew ? 'text-emerald-500' : 'text-slate-400'"
              />
            </td>
            <td class="px-4 sm:px-6 py-3.5 sm:py-4">
              <div class="flex items-center gap-1">
                <button type="button" class="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-slate-400 hover:text-accent transition-all" title="编辑" @click="openEditSubscription(sub)">
                  <Pencil class="w-4 h-4" />
                </button>
                <button type="button" class="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-slate-400 hover:text-rose-500 transition-all" title="删除" @click="handleDeleteSubscription(sub)">
                  <Trash2 class="w-4 h-4" />
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="filteredSubscriptions.length === 0">
            <td colspan="8" class="px-6 py-16 text-center">
              <div class="flex flex-col items-center gap-3 opacity-20">
                <Users class="w-10 h-10" />
                <p class="text-sm font-medium">暂无订阅数据</p>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Mobile Card View -->
    <div class="md:hidden space-y-4">
      <div
        v-for="sub in filteredSubscriptions"
        :key="sub.id"
        class="p-5 rounded-3xl border border-[var(--border-base)] bg-[var(--bg-card)] space-y-4"
      >
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0">
            <div
              class="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0"
            >
              {{ (sub.user?.name || sub.user?.email || '?').charAt(0).toUpperCase() }}
            </div>
            <div class="min-w-0">
              <h4 class="text-sm font-black text-[var(--text-primary)] truncate">
                {{ sub.user?.name || '未命名' }}
              </h4>
              <p class="text-[10px] text-[var(--text-muted)] truncate">
                {{ sub.user?.email }}
              </p>
            </div>
          </div>
          <div class="flex flex-row items-center gap-1.5 shrink-0">
            <span
              class="px-2 py-0.5 rounded-full text-[10px] font-bold"
              :style="{
                backgroundColor: (sub.plan?.badgeColor || '#8b5cf6') + '15',
                color: sub.plan?.badgeColor || '#8b5cf6',
              }"
            >
              {{ sub.plan?.displayName || sub.plan?.name }}
            </span>
            <span
              class="px-2 py-0.5 rounded-full text-[10px] font-bold"
              :class="getStatusColor(sub.status)"
            >
              {{ getStatusLabel(sub.status) }}
            </span>
          </div>
        </div>

        <div
          class="grid grid-cols-3 gap-2 text-[10px] xs:text-xs border-t border-b border-[var(--border-base)] py-3"
        >
          <div>
            <span class="text-[var(--text-muted)] block mb-0.5 truncate">周期 / 续费</span>
            <span
              class="font-bold text-[var(--text-secondary)] flex flex-wrap items-center gap-0.5"
            >
              <span>{{ sub.interval === 'YEARLY' ? '年付' : '月付' }}</span>
              <span class="text-[var(--text-muted)] hidden xs:inline">|</span>
              <span :class="sub.autoRenew ? 'text-emerald-500' : 'text-slate-400'">
                {{ sub.autoRenew ? '自动续期' : '手动' }}
              </span>
            </span>
          </div>
          <div>
            <span class="text-[var(--text-muted)] block mb-0.5 truncate">开始日期</span>
            <span class="font-bold text-[var(--text-secondary)]">
              {{ new Date(sub.startDate).toLocaleDateString() }}
            </span>
          </div>
          <div>
            <span class="text-[var(--text-muted)] block mb-0.5 truncate">到期日期</span>
            <span class="font-bold text-[var(--text-secondary)]">
              {{ sub.endDate ? new Date(sub.endDate).toLocaleDateString() : '永久' }}
            </span>
          </div>
        </div>

        <div class="flex items-center justify-end gap-2">
          <button type="button" class="flex items-center gap-1 px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl border border-[var(--border-base)] text-xs text-[var(--text-secondary)] font-bold transition-all" @click="openEditSubscription(sub)">
            <Pencil class="w-3.5 h-3.5" />
            编辑
          </button>
          <button type="button" class="flex items-center gap-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-900/20 rounded-xl text-xs text-rose-600 dark:text-rose-400 font-bold transition-all" @click="handleDeleteSubscription(sub)">
            <Trash2 class="w-3.5 h-3.5" />
            删除
          </button>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="filteredSubscriptions.length === 0" class="py-16 text-center">
        <div class="flex flex-col items-center gap-3 opacity-20">
          <Users class="w-10 h-10" />
          <p class="text-sm font-medium">暂无订阅数据</p>
        </div>
      </div>
    </div>

    <!-- Subscription Edit/Create Dialog -->
    <Transition name="fade">
      <div v-if="showSubDialog" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div
          class="absolute inset-0 bg-black/40 backdrop-blur-sm"
          @click="showSubDialog = false"
        ></div>
        <div
          class="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5 sm:p-8 rounded-3xl shadow-2xl space-y-6 bg-[var(--bg-card)]"
        >
          <div class="flex items-center justify-between">
            <h3 class="text-xl font-bold text-[var(--text-primary)]">
              {{ editingSubscription ? '编辑订阅' : '新增订阅' }}
            </h3>
            <button type="button" class="text-[var(--text-secondary)]" @click="showSubDialog = false">
              <X class="w-5 h-5" />
            </button>
          </div>

          <!-- User Selection -->
          <div class="space-y-2">
            <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
              >用户</label
            >
            <div
              v-if="editingSubscription"
              class="px-4 py-3 rounded-2xl border bg-[var(--bg-app)] border-[var(--border-base)]"
            >
              <div class="flex items-center gap-3">
                <div
                  class="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-500"
                >
                  {{
                    (editingSubscription.user?.name || editingSubscription.user?.email || '?')
                      .charAt(0)
                      .toUpperCase()
                  }}
                </div>
                <div>
                  <p class="text-sm font-bold text-[var(--text-primary)]">
                    {{ editingSubscription.user?.name || '未命名' }}
                  </p>
                  <p class="text-[10px] text-[var(--text-muted)]">
                    {{ editingSubscription.user?.email }}
                  </p>
                </div>
              </div>
            </div>
            <div v-else class="space-y-2">
              <div class="relative">
                <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  v-model="userSearchQuery"
                  type="text"
                  class="w-full pl-10 pr-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20"
                  style="
                    background-color: var(--bg-app);
                    border-color: var(--border-base);
                    color: var(--text-primary);
                  "
                  placeholder="搜索用户名或邮箱..."
                />
              </div>
              <div
                class="max-h-48 overflow-y-auto rounded-2xl border border-[var(--border-base)] bg-[var(--bg-app)] scrollbar-hide"
              >
                <button v-for="user in availableUsers" :key="user.id" type="button" class="w-full px-4 py-3 flex items-center gap-3 hover:bg-[var(--bg-card)] transition-all text-left" :class="subForm.userId === user.id ? 'bg-accent/5 ring-1 ring-accent/20' : ''" @click="subForm.userId = user.id">
                  <div
                    class="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0"
                  >
                    {{ (user.name || user.email || '?').charAt(0).toUpperCase() }}
                  </div>
                  <div class="min-w-0">
                    <p class="text-sm font-bold text-[var(--text-primary)] truncate">
                      {{ user.name || '未命名' }}
                    </p>
                    <p class="text-[10px] text-[var(--text-muted)] truncate">{{ user.email }}</p>
                  </div>
                  <Check
                    v-if="subForm.userId === user.id"
                    class="w-4 h-4 text-accent ml-auto shrink-0"
                  />
                </button>
                <div
                  v-if="availableUsers.length === 0"
                  class="px-4 py-8 text-center text-xs text-[var(--text-muted)]"
                >
                  {{ userSearchQuery ? '未找到匹配用户' : '所有用户已有订阅' }}
                </div>
              </div>
            </div>
          </div>

          <!-- Plan Selection -->
          <div class="space-y-2">
            <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
              >订阅计划</label
            >
            <div class="grid grid-cols-3 gap-3">
              <button
v-for="plan in plans" :key="plan.id" type="button" class="p-4 rounded-2xl border-2 transition-all text-left" :class="
                  subForm.planId === plan.id
                    ? 'border-accent bg-accent/5'
                    : 'border-[var(--border-base)] hover:border-accent/30'
                " @click="subForm.planId = plan.id">
                <div class="flex items-center gap-2 mb-1">
                  <component
                    :is="getPlanIcon(plan.name)"
                    class="w-4 h-4"
                    :style="{ color: plan.badgeColor || '#8b5cf6' }"
                  />
                  <span class="text-xs font-black text-[var(--text-primary)]">{{
                    plan.displayName || plan.name
                  }}</span>
                </div>
                <p class="text-[10px] text-[var(--text-muted)]">￥{{ plan.price }}/月</p>
              </button>
            </div>
          </div>

          <!-- Status & Interval -->
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
                >订阅状态</label
              >
              <select
                v-model="subForm.status"
                class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20"
                style="
                  background-color: var(--bg-app);
                  border-color: var(--border-base);
                  color: var(--text-primary);
                "
              >
                <option value="ACTIVE">活跃</option>
                <option value="CANCELED">已取消</option>
                <option value="EXPIRED">已过期</option>
                <option value="PAST_DUE">逾期</option>
              </select>
            </div>
            <div class="space-y-2">
              <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
                >计费周期</label
              >
              <select
                v-model="subForm.interval"
                class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20"
                style="
                  background-color: var(--bg-app);
                  border-color: var(--border-base);
                  color: var(--text-primary);
                "
              >
                <option value="MONTHLY">月付</option>
                <option value="YEARLY">年付</option>
              </select>
            </div>
          </div>

          <!-- Dates -->
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
                >开始日期</label
              >
              <input
                v-model="subForm.startDate"
                type="datetime-local"
                class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20"
                style="
                  background-color: var(--bg-app);
                  border-color: var(--border-base);
                  color: var(--text-primary);
                "
              />
            </div>
            <div class="space-y-2">
              <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
                >到期日期</label
              >
              <input
                v-model="subForm.endDate"
                type="datetime-local"
                class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20"
                style="
                  background-color: var(--bg-app);
                  border-color: var(--border-base);
                  color: var(--text-primary);
                "
              />
            </div>
          </div>

          <!-- Payment Method -->
          <div class="space-y-2">
            <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
              >支付方式</label
            >
            <select
              v-model="subForm.paymentMethod"
              class="w-full px-4 py-3 rounded-2xl border transition-all focus:outline-none focus:ring-2 focus:ring-accent/20"
              style="
                background-color: var(--bg-app);
                border-color: var(--border-base);
                color: var(--text-primary);
              "
            >
              <option value="ADMIN_ASSIGN">管理员分配</option>
              <option value="ALIPAY">支付宝</option>
              <option value="WECHAT">微信支付</option>
              <option value="CARD">银行卡</option>
              <option value="MOCK_PAYMENT">模拟支付</option>
            </select>
          </div>

          <!-- Toggles -->
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
                >自动续费</label
              >
              <button
type="button" class="w-full h-12 rounded-2xl border flex items-center justify-center gap-2 transition-all" :class="
                  subForm.autoRenew
                    ? 'border-emerald-500 bg-emerald-500/5 text-emerald-500'
                    : 'border-[var(--border-base)] text-[var(--text-muted)]'
                " style="border-color: subForm.autoRenew ? undefined : 'var(--border-base)'" @click="subForm.autoRenew = !subForm.autoRenew">
                <component :is="subForm.autoRenew ? Check : X" class="w-4 h-4" />
                <span class="text-xs font-bold">{{ subForm.autoRenew ? '已开启' : '已关闭' }}</span>
              </button>
            </div>
            <div class="space-y-2">
              <label class="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1"
                >周期结束取消</label
              >
              <button
type="button" class="w-full h-12 rounded-2xl border flex items-center justify-center gap-2 transition-all" :class="
                  subForm.cancelAtPeriodEnd
                    ? 'border-amber-500 bg-amber-500/5 text-amber-500'
                    : 'border-[var(--border-base)] text-[var(--text-muted)]'
                " style="border-color: subForm.cancelAtPeriodEnd ? undefined : 'var(--border-base)'" @click="subForm.cancelAtPeriodEnd = !subForm.cancelAtPeriodEnd">
                <component :is="subForm.cancelAtPeriodEnd ? Check : X" class="w-4 h-4" />
                <span class="text-xs font-bold">{{
                  subForm.cancelAtPeriodEnd ? '将取消' : '不取消'
                }}</span>
              </button>
            </div>
          </div>

          <div class="flex gap-3 pt-4">
            <button type="button" class="flex-1 py-3 rounded-2xl font-bold text-sm border border-[var(--border-base)] text-[var(--text-secondary)] hover:bg-[var(--bg-app)] transition-all" @click="showSubDialog = false">
              取消
            </button>
            <button type="button" class="flex-1 py-3 rounded-2xl font-bold text-sm bg-accent text-white hover:bg-accent-hover shadow-lg shadow-accent/20 transition-all flex items-center justify-center gap-2" @click="handleSaveSubscription">
              <Save class="w-4 h-4" /> {{ editingSubscription ? '保存更改' : '创建订阅' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
