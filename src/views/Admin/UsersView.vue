<script setup lang="ts">
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
import { getApiErrorMessage } from '@/utils/error';
import { ref, onMounted, computed, watch } from 'vue';
import {
  Users,
  Search,
  MoreVertical,
  Trash2,
  UserX,
  UserCheck,
  RefreshCw,
  Key,
  Plus,
  CreditCard,
  Zap,
  Crown,
  Check,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '@/utils/api';
import UserAvatar from '@/components/UserAvatar.vue';

interface AdminSubscriptionPlan {
  id: string;
  name?: string;
  displayName?: string;
  price?: number;
  badgeColor?: string;
}

interface AdminUserSubscription {
  id: string;
  planId: string;
  interval: string;
  endDate?: string | null;
  status: string;
  plan: AdminSubscriptionPlan & { name: string };
}

interface AdminUser {
  id: string;
  name?: string | null;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  avatarUrl?: string | null;
  subscription?: AdminUserSubscription;
}

interface PaginationState {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface AdminUsersResponse {
  data: AdminUser[];
  pagination?: PaginationState;
}

const users = ref<AdminUser[]>([]);
const isLoading = ref(false);
const searchQuery = ref('');
const roleFilter = ref('ALL');
const statusFilter = ref('ALL');
const plans = ref<AdminSubscriptionPlan[]>([]);
const pagination = ref({
  page: 1,
  limit: 50,
  total: 0,
  totalPages: 1,
});

const roleMap: Record<string, string> = {
  ADMIN: t('admin.administrator'),
  INSTRUCTOR: t('admin.mentor'),
  USER: t('admin.ordinary_user'),
};

const statusMap: Record<string, string> = {
  ACTIVE: t('admin.active_1'),
  BANNED: t('admin.banned'),
};

// Create Dialog
const createDialogVisible = ref(false);
const createForm = ref({
  name: '',
  email: '',
  password: '',
  role: 'USER',
});

// Edit Dialog
const editDialogVisible = ref(false);
const isSubmitting = ref(false);
const editingUser = ref<AdminUser>({
  id: '',
  name: '',
  email: '',
  role: '',
  status: '',
  createdAt: '',
});

// Subscription Dialog
const subDialogVisible = ref(false);
const isSubLoading = ref(false);
const selectedUser = ref<AdminUser | null>(null);
const subForm = ref({
  planId: '',
  interval: 'MONTHLY',
  endDate: '',
  status: 'ACTIVE',
});

const fetchUsers = async (page: number | Event = pagination.value.page) => {
  const nextPage = typeof page === 'number' ? page : pagination.value.page;
  isLoading.value = true;
  try {
    const response = await api.get('/api/admin/users', {
      params: {
        page: nextPage,
        limit: pagination.value.limit,
        q: searchQuery.value || undefined,
        role: roleFilter.value !== 'ALL' ? roleFilter.value : undefined,
        status: statusFilter.value !== 'ALL' ? statusFilter.value : undefined,
      },
    });
    const responseData = response.data as AdminUser[] | AdminUsersResponse;
    users.value = Array.isArray(responseData) ? responseData : responseData.data;
    pagination.value = (!Array.isArray(responseData) && responseData.pagination) || {
      page: nextPage,
      limit: pagination.value.limit,
      total: users.value.length,
      totalPages: 1,
    };
  } catch {
    ElMessage.error(t('admin.unable_to_load_user'));
  } finally {
    isLoading.value = false;
  }
};

const fetchPlans = async () => {
  try {
    const response = await api.get('/api/admin/subscription-plans');
    plans.value = response.data as AdminSubscriptionPlan[];
  } catch (error) {
    console.error('Fetch plans error:', error);
  }
};

const filteredUsers = computed(() => {
  return users.value.filter((user) => {
    if (!user) return false;
    const matchesSearch =
      user.name?.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      false;

    const matchesRole = roleFilter.value === 'ALL' || user.role === roleFilter.value;
    const matchesStatus = statusFilter.value === 'ALL' || user.status === statusFilter.value;

    return matchesSearch && matchesRole && matchesStatus;
  });
});

const openCreateDialog = () => {
  createForm.value = {
    name: '',
    email: '',
    password: '',
    role: 'USER',
  };
  createDialogVisible.value = true;
};

const handleCreateUser = async () => {
  if (!createForm.value.email || !createForm.value.password) {
    return ElMessage.warning(t('admin.please_fill_in_your'));
  }
  isSubmitting.value = true;
  try {
    await api.post('/api/admin/users', createForm.value);
    ElMessage.success(t('admin.user_created_successfully'));
    createDialogVisible.value = false;
    fetchUsers();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, t('admin.creation_failed')));
  } finally {
    isSubmitting.value = false;
  }
};

const openEditDialog = (user: AdminUser) => {
  editingUser.value = { ...user };
  editDialogVisible.value = true;
};

const handleUpdateUser = async () => {
  isSubmitting.value = true;
  try {
    const { id, name, email, role, status } = editingUser.value;
    await api.put(`/api/admin/users/${id}`, { name, email, role, status });

    // Update local state
    const index = users.value.findIndex((u) => u.id === id);
    if (index !== -1) {
      users.value[index] = { ...users.value[index], name, email, role, status };
    }

    ElMessage.success(t('admin.user_information_has_been'));
    editDialogVisible.value = false;
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, t('admin.update_failed')));
  } finally {
    isSubmitting.value = false;
  }
};

const openSubDialog = (user: AdminUser) => {
  selectedUser.value = user;
  if (user.subscription) {
    subForm.value = {
      planId: user.subscription.planId,
      interval: user.subscription.interval,
      endDate: user.subscription.endDate
        ? new Date(user.subscription.endDate).toISOString().split('T')[0]
        : '',
      status: user.subscription.status,
    };
  } else {
    subForm.value = {
      planId: plans.value.length > 0 ? plans.value[0].id : '',
      interval: 'MONTHLY',
      endDate: '',
      status: 'ACTIVE',
    };
  }
  subDialogVisible.value = true;
};

const handleManageSub = async () => {
  if (!selectedUser.value) return;
  isSubLoading.value = true;
  try {
    if (selectedUser.value.subscription) {
      // Update
      await api.put(
        `/api/admin/subscriptions/${selectedUser.value.subscription.id}`,
        subForm.value,
      );
      ElMessage.success(t('admin.subscription_updated_successfully'));
    } else {
      // Create
      await api.post('/api/admin/subscriptions', {
        ...subForm.value,
        userId: selectedUser.value.id,
      });
      ElMessage.success(t('admin.subscription_created_successfully'));
    }
    subDialogVisible.value = false;
    fetchUsers();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, t('admin.operation_failed')));
  } finally {
    isSubLoading.value = false;
  }
};

const handleCancelSub = async () => {
  if (!selectedUser.value?.subscription) return;

  try {
    await ElMessageBox.confirm(t('admin.are_you_sure_you_19'), t('admin.confirm_action'), {
      confirmButtonText: t('admin.confirm_cancellation'),
      cancelButtonText: t('admin.reserve'),
      type: 'warning',
    });

    await api.delete(`/api/admin/subscriptions/${selectedUser.value.subscription.id}`);
    ElMessage.success(t('admin.subscription_canceled'));
    subDialogVisible.value = false;
    fetchUsers();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(t('admin.cancellation_failed'));
    }
  }
};

const handleToggleStatus = async (user: AdminUser) => {
  const newStatus = user.status === 'BANNED' ? 'ACTIVE' : 'BANNED';
  const actionText = newStatus === 'BANNED' ? t('admin.ban') : t('admin.unblock');

  try {
    await api.put(`/api/admin/users/${user.id}`, {
      status: newStatus,
    });
    user.status = newStatus;
    ElMessage.success(t('admin.user_user_name_user', { usernameuseremail: user.name || user.email, actionText: actionText }));
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, t('admin.actiontext_failed', { actionText: actionText })));
  }
};

const handleResetPassword = (user: AdminUser) => {
  ElMessageBox.prompt(t('admin.please_enter_the_user'), t('admin.reset_user_password'), {
    confirmButtonText: t('admin.confirm_reset'),
    cancelButtonText: t('admin.cancel'),
    inputType: 'password',
    inputPattern: /^.{6,}$/,
    inputErrorMessage: t('admin.password_must_be_at'),
  }).then(async ({ value }) => {
    try {
      await api.post(`/api/admin/users/${user.id}/reset-password`, { password: value });
      ElMessage.success(t('admin.password_reset_for_user', { usernameuseremail: user.name || user.email }));
    } catch (error) {
      ElMessage.error(getApiErrorMessage(error, t('admin.password_reset_failed')));
    }
  });
};

const handleDeleteUser = (user: AdminUser) => {
  ElMessageBox.confirm(
    t('admin.are_you_sure_you_8', { usernameuseremail: user.name || user.email }),
    t('admin.extremely_dangerous_operation'),
    {
      confirmButtonText: t('admin.confirm_permanent_deletion'),
      cancelButtonText: t('admin.cancel'),
      type: 'error',
      confirmButtonClass: 'el-button--danger',
    },
  ).then(async () => {
    try {
      await api.delete(`/api/admin/users/${user.id}`);
      users.value = users.value.filter((u) => u.id !== user.id);
      ElMessage.success(t('admin.the_user_and_their'));
    } catch {
      ElMessage.error(t('admin.delete_failed'));
    }
  });
};

const stats = computed(() => {
  const total = pagination.value.total || users.value.length;
  const active = users.value.filter((u) => u.status === 'ACTIVE').length;
  const banned = users.value.filter((u) => u.status === 'BANNED').length;

  const admin = users.value.filter((u) => u.role === 'ADMIN').length;
  const instructor = users.value.filter((u) => u.role === 'INSTRUCTOR').length;
  const normal = users.value.filter((u) => u.role === 'USER').length;

  return { total, active, banned, admin, instructor, normal };
});

let fetchUsersTimer: ReturnType<typeof setTimeout> | null = null;
watch([searchQuery, roleFilter, statusFilter], () => {
  if (fetchUsersTimer) clearTimeout(fetchUsersTimer);
  fetchUsersTimer = setTimeout(() => {
    pagination.value.page = 1;
    fetchUsers(1);
  }, 250);
});

const handlePageChange = (page: number) => {
  pagination.value.page = page;
  fetchUsers(page);
};

onMounted(() => {
  fetchUsers();
  fetchPlans();
});
</script>

<template>
  <div
    class="admin-users-page flex-1 flex flex-col h-full overflow-hidden transition-colors duration-300"
    style="background-color: var(--bg-app)"
  >
    <!-- 奢华顶栏 (超紧凑高阶版) -->
    <div
      class="relative shrink-0 border-b overflow-hidden"
      style="background-color: var(--bg-card); border-color: var(--border-base)"
    >
      <!-- 极光背景装饰 -->
      <div
        class="absolute top-0 right-0 w-96 h-full bg-gradient-to-l from-indigo-500/10 via-purple-500/5 to-transparent pointer-events-none"
      ></div>

      <!-- Row 1: 标题 & 主要动作 -->
      <div
        class="px-4 sm:px-8 py-2.5 sm:py-3 flex flex-row items-center justify-between gap-3 relative z-10 border-b"
        style="border-color: var(--border-base)"
      >
        <div class="flex items-center gap-2">
          <span
            class="p-1 rounded-xl bg-indigo-500/10 text-indigo-500 shadow-sm border border-indigo-500/20"
          >
            <Users class="w-4 h-4" />
          </span>
          <h1 class="text-sm font-black tracking-tight" style="color: var(--text-primary)">
            全平台用户管理
          </h1>
        </div>

        <div class="flex items-center gap-1.5 sm:gap-2.5">
          <button type="button" class="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-[11px] transition-all shadow-sm shrink-0 whitespace-nowrap cursor-pointer" @click="openCreateDialog">
            <Plus class="w-3.5 h-3.5" />
            <span class="hidden sm:inline">{{ $t('admin.create_new_user') }}</span>
          </button>
          <button type="button" class="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl border hover:bg-slate-50 dark:hover:bg-white/5 transition-all text-[11px] font-bold shadow-sm cursor-pointer" style="border-color: var(--border-base); color: var(--text-secondary)" @click="fetchUsers">
            <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': isLoading }" />
            <span class="hidden sm:inline">{{ $t('admin.refresh') }}</span>
          </button>
        </div>
      </div>

      <!-- Row 2: 状态与角色筛选 Pills & 检索 -->
      <div
        class="user-filter-bar px-4 sm:px-8 py-2 flex flex-col lg:flex-row lg:flex-wrap lg:items-center justify-between gap-3 relative z-10 transition-colors duration-300"
      >
        <!-- 状态/角色筛选 -->
        <div class="flex flex-nowrap items-center gap-1 sm:gap-3 max-w-full shrink-0">
          <!-- 状态 Pills -->
          <div class="flex flex-nowrap items-center gap-0.5 sm:gap-1.5 shrink-0">
            <button
v-for="filter in [
                { key: 'ALL', label: $t('admin.all_status'), count: stats.total, color: 'indigo', icon: Users },
                {
                  key: 'ACTIVE',
                  label: $t('admin.active_1'),
                  count: stats.active,
                  color: 'emerald',
                  icon: UserCheck,
                },
                { key: 'BANNED', label: $t('admin.banned'), count: stats.banned, color: 'rose', icon: UserX },
              ]" :key="filter.key" type="button" class="px-1 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg border text-[8px] xs:text-[9px] sm:text-[11px] font-bold flex items-center gap-0.5 sm:gap-1.5 transition-all cursor-pointer shrink-0" :class="[
                statusFilter === filter.key
                  ? filter.key === 'ACTIVE'
                    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 ring-1 ring-emerald-500/20 font-extrabold shadow-sm'
                    : filter.key === 'BANNED'
                      ? 'bg-rose-500/10 text-rose-500 border-rose-500/30 ring-1 ring-rose-500/20 font-extrabold shadow-sm'
                      : 'bg-indigo-500/10 text-indigo-500 border-indigo-500/30 ring-1 ring-indigo-500/20 font-extrabold shadow-sm'
                  : 'border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5',
              ]" @click="statusFilter = filter.key">
              <component :is="filter.icon" class="w-2 h-2 sm:w-3 sm:h-3" />
              <span>{{ filter.label }}</span>
              <span class="opacity-60">({{ filter.count }})</span>
            </button>
          </div>

          <div class="w-[1px] h-3 bg-slate-200 dark:bg-slate-800 shrink-0 mx-1 sm:mx-3"></div>

          <!-- 角色 Pills -->
          <div class="flex flex-nowrap items-center gap-0.5 sm:gap-1.5 shrink-0">
            <button
v-for="filter in [
                { key: 'ALL', label: $t('admin.all_roles'), count: stats.total, icon: Users },
                { key: 'ADMIN', label: $t('admin.administrator'), count: stats.admin, icon: Crown },
                { key: 'INSTRUCTOR', label: $t('admin.mentor'), count: stats.instructor, icon: Zap },
                { key: 'USER', label: $t('admin.ordinary_user'), count: stats.normal, icon: Users },
              ]" :key="filter.key" type="button" class="px-1 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg border text-[8px] xs:text-[9px] sm:text-[11px] font-bold flex items-center gap-0.5 sm:gap-1.5 transition-all cursor-pointer shrink-0" :class="[
                roleFilter === filter.key
                  ? 'bg-indigo-500/10 text-indigo-500 border-indigo-500/30 ring-1 ring-indigo-500/20 font-extrabold shadow-sm'
                  : 'border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5',
              ]" @click="roleFilter = filter.key">
              <component :is="filter.icon" class="w-2 h-2 sm:w-3 sm:h-3" />
              <span>{{ filter.label }}</span>
              <span class="opacity-60">({{ filter.count }})</span>
            </button>
          </div>
        </div>

        <!-- 检索与统计 -->
        <div
          class="flex items-center justify-between lg:justify-end gap-3 w-full lg:w-auto shrink-0"
        >
          <div class="relative flex-1 lg:flex-none lg:w-64">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              v-model="searchQuery"
              type="text"
              :placeholder="$t('admin.search_for_users_by')"
              class="w-full pl-9 pr-3 py-1.5 rounded-lg border transition-all focus:ring-2 focus:ring-indigo-500/20 outline-none text-[11px] shadow-sm"
              style="
                background-color: var(--bg-app);
                border-color: var(--border-base);
                color: var(--text-primary);
              "
            />
          </div>
          <div class="text-[10px] font-bold text-right shrink-0" style="color: var(--text-muted)">
            已过滤: <span class="text-indigo-600 font-extrabold">{{ filteredUsers.length }}</span> /
            总计: {{ pagination.total }}
          </div>
        </div>
      </div>
    </div>

    <!-- Users List -->
    <div class="flex-1 overflow-y-auto p-4 sm:p-8 scrollbar-hide">
      <div class="max-w-none">
        <div v-if="isLoading" class="flex flex-col items-center justify-center py-24 gap-4">
          <div
            class="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"
          ></div>
          <p class="text-sm font-bold text-slate-400">{{ $t('admin.synchronizing_user_data') }}</p>
        </div>

        <template v-else>
          <!-- Desktop Table View -->
          <div
            class="hidden md:block rounded-3xl border border-[var(--border-base)] bg-[var(--bg-card)] overflow-hidden overflow-x-auto scrollbar-hide"
          >
            <table class="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr
                  class="border-b bg-slate-50/50 dark:bg-slate-800/50"
                  style="border-color: var(--border-base)"
                >
                  <th
                    class="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400"
                  >
                    用户信息
                  </th>
                  <th
                    class="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400"
                  >
                    角色
                  </th>
                  <th
                    class="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400"
                  >
                    状态
                  </th>
                  <th
                    class="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400"
                  >
                    订阅情况
                  </th>
                  <th
                    class="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400"
                  >
                    注册日期
                  </th>
                  <th
                    class="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right"
                  >
                    操作管理
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="user in filteredUsers"
                  :key="user.id"
                  class="border-b last:border-0 hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors"
                  :class="{ 'opacity-60 grayscale-[0.5]': user.status === 'BANNED' }"
                  style="border-color: var(--border-base)"
                >
                  <td class="px-6 py-4">
                    <div class="flex items-center gap-3">
                      <UserAvatar :user="user" size="md" shadow />
                      <div class="min-w-0">
                        <p class="font-bold text-sm truncate" style="color: var(--text-primary)">
                          {{ user.name || $t('admin.unnamed_user') }}
                        </p>
                        <p class="text-xs text-slate-400 truncate">{{ user.email }}</p>
                      </div>
                    </div>
                  </td>
                  <td class="px-6 py-4">
                    <span
                      class="px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm"
                      :class="{
                        'bg-rose-100 text-rose-600': user.role === 'ADMIN',
                        'bg-blue-100 text-blue-600': user.role === 'INSTRUCTOR',
                        'bg-slate-100 text-slate-500': user.role === 'USER',
                      }"
                    >
                      {{ roleMap[user.role] || user.role }}
                    </span>
                  </td>
                  <td class="px-6 py-4">
                    <span
                      class="px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm"
                      :class="
                        user.status === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-600'
                          : 'bg-rose-100 text-rose-600'
                      "
                    >
                      {{ statusMap[user.status] || user.status }}
                    </span>
                  </td>
                  <td class="px-6 py-4">
                    <div v-if="user.subscription" class="flex flex-col gap-0.5">
                      <span
                        v-if="user.subscription.plan.name === 'SVIP'"
                        class="inline-flex items-center gap-1 w-fit px-2 py-0.5 rounded-md bg-amber-100 text-amber-600 text-[9px] font-black"
                      >
                        <Crown class="w-2.5 h-2.5" /> SVIP
                      </span>
                      <span
                        v-else-if="user.subscription.plan.name === 'VIP'"
                        class="inline-flex items-center gap-1 w-fit px-2 py-0.5 rounded-md bg-purple-100 text-purple-600 text-[9px] font-black"
                      >
                        <Zap class="w-2.5 h-2.5" /> VIP
                      </span>
                      <span
                        v-else
                        class="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[9px] font-black uppercase"
                      >
                        {{ user.subscription.plan.name }}
                      </span>
                      <span class="text-[9px] text-slate-400 mt-0.5">
                        到期:
                        {{
                          user.subscription.endDate
                            ? new Date(user.subscription.endDate).toLocaleDateString()
                            : $t('admin.permanent')
                        }}
                      </span>
                    </div>
                    <span v-else class="text-xs text-slate-400">-</span>
                  </td>
                  <td class="px-6 py-4 text-xs text-slate-400">
                    {{ new Date(user.createdAt).toLocaleDateString() }}
                  </td>
                  <td class="px-6 py-4 text-right">
                    <div class="flex items-center justify-end gap-2">
                      <el-dropdown trigger="click">
                        <button type="button" class="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-white/5 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-slate-600 dark:text-slate-400 hover:text-indigo-600 font-bold text-xs transition-all flex items-center gap-1.5">
                          <MoreVertical class="w-3.5 h-3.5" />
                          管理
                        </button>
                        <template #dropdown>
                          <el-dropdown-menu>
                            <el-dropdown-item @click="openEditDialog(user)">
                              <div class="flex items-center gap-2 font-bold">
                                <Users class="w-3.5 h-3.5" /> 编辑资料
                              </div>
                            </el-dropdown-item>
                            <el-dropdown-item @click="openSubDialog(user)">
                              <div class="flex items-center gap-2 font-bold text-indigo-600">
                                <CreditCard class="w-3.5 h-3.5" /> 订阅管理
                              </div>
                            </el-dropdown-item>
                            <el-dropdown-item @click="handleResetPassword(user)">
                              <div class="flex items-center gap-2 font-bold text-amber-600">
                                <Key class="w-3.5 h-3.5" /> 重置密码
                              </div>
                            </el-dropdown-item>
                          </el-dropdown-menu>
                        </template>
                      </el-dropdown>

                      <button
type="button" class="p-2 rounded-xl transition-all shadow-sm" ::title="$t('admin.user_status_banned_unblock')" :class="
                          user.status === 'BANNED'
                            ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white'
                            : 'bg-slate-50 text-slate-600 hover:bg-slate-900 hover:text-white'
                        " @click="handleToggleStatus(user)">
                        <UserCheck v-if="user.status === 'BANNED'" class="w-3.5 h-3.5" />
                        <UserX v-else class="w-3.5 h-3.5" />
                      </button>

                      <button type="button" :title="$t('admin.delete_permanently')" class="p-2 rounded-xl bg-rose-50 dark:bg-rose-900/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all shadow-sm" @click="handleDeleteUser(user)">
                        <Trash2 class="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Mobile Card View -->
          <div class="md:hidden space-y-4">
            <div
              v-for="user in filteredUsers"
              :key="user.id"
              class="p-4 rounded-2xl border transition-all relative overflow-hidden"
              :class="{
                'opacity-60 grayscale-[0.5]': user.status === 'BANNED',
                'bg-white dark:bg-slate-900': true,
              }"
              style="border-color: var(--border-base)"
            >
              <div class="flex items-start justify-between mb-4">
                <div class="flex items-center gap-3">
                  <UserAvatar :user="user" size="md" shadow />
                  <div class="min-w-0">
                    <p class="font-bold text-sm truncate" style="color: var(--text-primary)">
                      {{ user.name || $t('admin.unnamed_user') }}
                    </p>
                    <p class="text-[10px] text-slate-400 truncate">{{ user.email }}</p>
                  </div>
                </div>
                <div class="flex flex-col items-end gap-1.5">
                  <span
                    class="px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider"
                    :class="{
                      'bg-rose-100 text-rose-600': user.role === 'ADMIN',
                      'bg-blue-100 text-blue-600': user.role === 'INSTRUCTOR',
                      'bg-slate-100 text-slate-500': user.role === 'USER',
                    }"
                  >
                    {{ roleMap[user.role] || user.role }}
                  </span>
                  <span
                    class="px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider"
                    :class="
                      user.status === 'ACTIVE'
                        ? 'bg-emerald-100 text-emerald-600'
                        : 'bg-rose-100 text-rose-600'
                    "
                  >
                    {{ statusMap[user.status] || user.status }}
                  </span>
                </div>
              </div>

              <div
                class="grid grid-cols-2 gap-4 py-3 border-y border-dashed mb-4"
                style="border-color: var(--border-base)"
              >
                <div>
                  <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                    注册日期
                  </p>
                  <p class="text-[10px] font-bold" style="color: var(--text-secondary)">
                    {{ new Date(user.createdAt).toLocaleDateString() }}
                  </p>
                </div>
                <div>
                  <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                    当前订阅
                  </p>
                  <div v-if="user.subscription" class="flex items-center gap-1.5">
                    <Crown
                      v-if="user.subscription.plan.name === 'SVIP'"
                      class="w-2.5 h-2.5 text-amber-500"
                    />
                    <Zap
                      v-else-if="user.subscription.plan.name === 'VIP'"
                      class="w-2.5 h-2.5 text-purple-500"
                    />
                    <span class="text-[10px] font-black" style="color: var(--text-primary)">{{
                      user.subscription.plan.name
                    }}</span>
                  </div>
                  <p v-else class="text-[10px] font-bold text-slate-400">{{ $t('admin.no_active_subscriptions') }}</p>
                </div>
              </div>

              <div class="flex items-center gap-2">
                <button type="button" class="flex-1 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-slate-600 dark:text-slate-400 hover:text-indigo-600 font-bold text-[10px] transition-all flex items-center justify-center gap-1.5" style="border-color: var(--border-base)" @click="openEditDialog(user)">
                  <Users class="w-3.5 h-3.5" />
                  编辑资料
                </button>
                <button type="button" class="flex-1 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-slate-600 dark:text-slate-400 hover:text-indigo-600 font-bold text-[10px] transition-all flex items-center justify-center gap-1.5" style="border-color: var(--border-base)" @click="openSubDialog(user)">
                  <CreditCard class="w-3.5 h-3.5" />
                  订阅管理
                </button>
                <div class="flex gap-2">
                  <button
type="button" class="p-2 rounded-xl border transition-all" style="border-color: var(--border-base)" :class="
                      user.status === 'BANNED'
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'bg-slate-50 text-slate-600'
                    " @click="handleToggleStatus(user)">
                    <UserCheck v-if="user.status === 'BANNED'" class="w-3.5 h-3.5" />
                    <UserX v-else class="w-3.5 h-3.5" />
                  </button>
                  <button type="button" class="p-2 rounded-xl bg-rose-50 dark:bg-rose-900/10 text-rose-500 border border-transparent hover:border-rose-200 transition-all" @click="handleDeleteUser(user)">
                    <Trash2 class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </template>

        <div
          v-if="filteredUsers.length === 0 && !isLoading"
          class="flex flex-col items-center justify-center py-24 text-center"
        >
          <div
            class="w-20 h-20 rounded-full bg-slate-50 dark:bg-white/5 flex items-center justify-center mb-6"
          >
            <Search class="w-10 h-10 text-slate-300" />
          </div>
          <h3 class="text-xl font-bold mb-2" style="color: var(--text-primary)">{{ $t('admin.no_matching_user_found') }}</h3>
          <p class="text-sm text-slate-400 max-w-sm">{{ $t('admin.try_changing_keywords_or') }}</p>
        </div>

        <div
          v-if="pagination.totalPages > 1 && !isLoading"
          class="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs font-bold"
          style="color: var(--text-secondary)"
        >
          <button type="button" class="px-3 py-1.5 rounded-xl border disabled:opacity-40 disabled:cursor-not-allowed" style="border-color: var(--border-base)" :disabled="pagination.page <= 1" @click="handlePageChange(pagination.page - 1)">
            上一页
          </button>
          <span>{{ $t('admin.page_pagination_page_pagination') }}</span>
          <button type="button" class="px-3 py-1.5 rounded-xl border disabled:opacity-40 disabled:cursor-not-allowed" style="border-color: var(--border-base)" :disabled="pagination.page >= pagination.totalPages" @click="handlePageChange(pagination.page + 1)">
            下一页
          </button>
        </div>
      </div>
    </div>

    <!-- Create User Dialog -->
    <el-dialog
      v-model="createDialogVisible"
      :title="$t('admin.create_new_user')"
      width="400px"
      class="rounded-3xl overflow-hidden"
      destroy-on-close
    >
      <div class="space-y-4 p-2">
        <div>
          <label
            class="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1.5 block"
            >{{ $t('admin.username_optional') }}</label
          >
          <input
            v-model="createForm.name"
            type="text"
            :placeholder="$t('admin.for_example_zhang_san')"
            class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
        <div>
          <label
            class="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1.5 block"
            >{{ $t('admin.email_1') }}</label
          >
          <input
            v-model="createForm.email"
            type="email"
            placeholder="user@example.com"
            class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
        <div>
          <label
            class="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1.5 block"
            >{{ $t('admin.initial_password') }}</label
          >
          <input
            v-model="createForm.password"
            type="password"
            :placeholder="$t('admin.at_least_6_people')"
            class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
        <div>
          <label
            class="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1.5 block"
            >{{ $t('admin.user_role') }}</label
          >
          <select
            v-model="createForm.role"
            class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 outline-none"
          >
            <option value="USER">{{ $t('admin.ordinary_user') }}</option>
            <option value="INSTRUCTOR">{{ $t('admin.mentor') }}</option>
            <option value="ADMIN">{{ $t('admin.administrator') }}</option>
          </select>
        </div>
      </div>
      <template #footer>
        <div class="flex gap-2 p-2">
          <button type="button" class="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 font-bold text-sm hover:bg-slate-200 transition-all" @click="createDialogVisible = false">
            取消
          </button>
          <button type="button" :disabled="isSubmitting" class="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none flex items-center justify-center gap-2" @click="handleCreateUser">
            <Plus v-if="!isSubmitting" class="w-4 h-4" />
            <RefreshCw v-else class="w-4 h-4 animate-spin" />
            立即创建
          </button>
        </div>
      </template>
    </el-dialog>

    <!-- Edit User Dialog -->
    <el-dialog
      v-model="editDialogVisible"
      :title="$t('admin.edit_user_information')"
      width="400px"
      class="rounded-3xl overflow-hidden"
      destroy-on-close
    >
      <div class="space-y-4 p-2">
        <div>
          <label
            class="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1.5 block"
            >{{ $t('admin.user_name') }}</label
          >
          <input
            v-model="editingUser.name"
            type="text"
            class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
        <div>
          <label
            class="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1.5 block"
            >{{ $t('admin.email') }}</label
          >
          <input
            v-model="editingUser.email"
            type="email"
            class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label
              class="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1.5 block"
              >{{ $t('admin.user_role') }}</label
            >
            <select
              v-model="editingUser.role"
              class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 outline-none"
            >
              <option value="USER">{{ $t('admin.ordinary_user') }}</option>
              <option value="INSTRUCTOR">{{ $t('admin.mentor') }}</option>
              <option value="ADMIN">{{ $t('admin.administrator') }}</option>
            </select>
          </div>
          <div>
            <label
              class="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1.5 block"
              >{{ $t('admin.account_status') }}</label
            >
            <select
              v-model="editingUser.status"
              class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 outline-none"
            >
              <option value="ACTIVE">{{ $t('admin.active_1') }}</option>
              <option value="BANNED">{{ $t('admin.ban') }}</option>
            </select>
          </div>
        </div>
      </div>
      <template #footer>
        <div class="flex gap-2 p-2">
          <button type="button" class="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 font-bold text-sm hover:bg-slate-200 transition-all" @click="editDialogVisible = false">
            取消
          </button>
          <button type="button" :disabled="isSubmitting" class="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none flex items-center justify-center gap-2" @click="handleUpdateUser">
            <RefreshCw v-if="isSubmitting" class="w-4 h-4 animate-spin" />
            保存修改
          </button>
        </div>
      </template>
    </el-dialog>

    <!-- Subscription Management Dialog -->
    <el-dialog
      v-model="subDialogVisible"
      ::title="$t('admin.subscription_management_selecteduser_name')"
      width="450px"
      class="rounded-3xl overflow-hidden"
      destroy-on-close
    >
      <div class="space-y-5 p-2">
        <div
          v-if="selectedUser?.subscription"
          class="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/40"
        >
          <div class="flex items-center justify-between mb-3">
            <span class="text-xs font-bold text-indigo-600">{{ $t('admin.current_plan') }}</span>
            <span
              class="px-2 py-0.5 rounded bg-indigo-600 text-white text-[10px] font-black uppercase"
              >{{ selectedUser.subscription.plan.name }}</span
            >
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                支付周期
              </p>
              <p class="text-xs font-bold">
                {{ selectedUser.subscription.interval === 'MONTHLY' ? t('admin.by_month') : $t('admin.by_year') }}
              </p>
            </div>
            <div>
              <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                到期时间
              </p>
              <p class="text-xs font-bold text-rose-500">
                {{
                  selectedUser.subscription.endDate
                    ? new Date(selectedUser.subscription.endDate).toLocaleDateString()
                    : $t('admin.permanent')
                }}
              </p>
            </div>
          </div>
        </div>

        <div>
          <label
            class="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1.5 block"
            >{{ $t('admin.choose_a_subscription_plan') }}</label
          >
          <div class="grid grid-cols-1 gap-2">
            <div
              v-for="plan in plans"
              :key="plan.id"
              class="flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all"
              :class="
                subForm.planId === plan.id
                  ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
                  : 'border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/5 hover:border-slate-200'
              "
              @click="subForm.planId = plan.id"
            >
              <div class="flex items-center gap-3">
                <div
                  class="w-8 h-8 rounded-lg flex items-center justify-center"
                  :class="
                    plan.name === 'SVIP'
                      ? 'bg-amber-100 text-amber-600'
                      : plan.name === 'VIP'
                        ? 'bg-purple-100 text-purple-600'
                        : 'bg-slate-200 text-slate-500'
                  "
                >
                  <Crown v-if="plan.name === 'SVIP'" class="w-4 h-4" />
                  <Zap v-else-if="plan.name === 'VIP'" class="w-4 h-4" />
                  <CreditCard v-else class="w-4 h-4" />
                </div>
                <div>
                  <p class="text-xs font-black">{{ plan.displayName || plan.name }}</p>
                  <p class="text-[10px] text-slate-400">{{ $t('admin.plan_price_month') }}</p>
                </div>
              </div>
              <div
                v-if="subForm.planId === plan.id"
                class="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center"
              >
                <Check class="w-3 h-3 text-white" />
              </div>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label
              class="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1.5 block"
              >{{ $t('admin.payment_cycle') }}</label
            >
            <select
              v-model="subForm.interval"
              class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 outline-none"
            >
              <option value="MONTHLY">{{ $t('admin.renew_monthly') }}</option>
              <option value="YEARLY">{{ $t('admin.renew_annually') }}</option>
            </select>
          </div>
          <div>
            <label
              class="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1.5 block"
              >{{ $t('admin.subscription_status') }}</label
            >
            <select
              v-model="subForm.status"
              class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 outline-none"
            >
              <option value="ACTIVE">{{ $t('admin.active') }}</option>
              <option value="EXPIRED">{{ $t('admin.expired_2') }}</option>
              <option value="CANCELLED">{{ $t('admin.cancelled') }}</option>
            </select>
          </div>
        </div>

        <div>
          <label
            class="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1.5 block"
            >{{ $t('admin.manually_set_expiration_time') }}</label
          >
          <input
            v-model="subForm.endDate"
            type="date"
            class="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
          <p class="text-[9px] text-slate-400 mt-1.5 px-1">
            若留空，系统将根据支付周期自动计算（暂未实现全自动，建议手动设置）
          </p>
        </div>
      </div>
      <template #footer>
        <div class="flex flex-col gap-2 p-2">
          <div class="flex gap-2">
            <button type="button" class="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 font-bold text-sm hover:bg-slate-200 transition-all" @click="subDialogVisible = false">
              取消
            </button>
            <button type="button" :disabled="isSubLoading" class="flex-[2] py-3 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 dark:shadow-none flex items-center justify-center gap-2" @click="handleManageSub">
              <RefreshCw v-if="isSubLoading" class="w-4 h-4 animate-spin" />
              {{ selectedUser?.subscription ? t('admin.update_and_save_subscription') : $t('admin.confirm_subscription_activation') }}
            </button>
          </div>
          <button v-if="selectedUser?.subscription" type="button" class="w-full py-2.5 text-[11px] font-black text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/10 rounded-xl transition-all" @click="handleCancelSub">
            取消并移除当前订阅
          </button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

@media (max-width: 767px) {
  .admin-users-page button,
  .admin-users-page a {
    min-width: 2.25rem;
    min-height: 2.25rem;
  }

  .user-filter-bar > div:first-child {
    width: 100%;
    overflow-x: auto;
    padding-bottom: 0.25rem;
  }

  .user-filter-bar button {
    min-width: auto;
    min-height: 2.25rem;
    padding: 0.375rem 0.625rem;
    font-size: 0.6875rem;
    line-height: 1rem;
  }

  .user-filter-bar input {
    min-height: 2.5rem;
  }
}
</style>
