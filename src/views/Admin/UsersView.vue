<script setup lang="ts">
import { formatDateTime as formatDate } from '@/utils/format';
import { computed, onMounted, onUnmounted, ref, watch, type Component } from 'vue';
import {
  Ban,
  Clock,
  CreditCard,
  MonitorSmartphone,
  Plus,
  ShieldCheck,
  Users,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '@/utils/api';
import { getApiErrorMessage, logError } from '@/utils/error';
import { fetchManagementInsights, formatCompactNumber } from './adminManagementInsights';
import UserDetailDrawer from './components/UserDetailDrawer.vue';
import UserQuotaDialog from './components/UserQuotaDialog.vue';
import UserPageHeader from './components/UserPageHeader.vue';
import UserStatsCards from './components/UserStatsCards.vue';
import UserToolbar from './components/UserToolbar.vue';
import UserTable from './components/UserTable.vue';
import UserFormDialog from './components/UserFormDialog.vue';
import {
  getDaysSince,
  riskInfo,
  roleLabel,
  statusLabel,
  lastLoginText,
  planLabel,
} from './components/userUtils';

export type UserRole = 'USER' | 'ADMIN' | 'INSTRUCTOR';
export type UserStatus = 'ACTIVE' | 'BANNED';
export type RoleFilter = 'ALL' | UserRole;
export type StatusFilter = 'ALL' | UserStatus;
export type ActivityFilter = 'ALL' | 'RECENT' | 'DORMANT' | 'NEVER' | 'SESSIONS' | 'RISK';
export type SmartFilter = 'ALL' | 'SUBSCRIBED' | 'NEW';

export interface AdminSubscriptionPlan {
  id: string;
  name?: string;
  displayName?: string;
  price?: number;
  badgeColor?: string;
}

export interface AdminUserSubscription {
  id: string;
  planId: string;
  interval: 'MONTHLY' | 'YEARLY' | string;
  endDate?: string | null;
  status: string;
  plan: AdminSubscriptionPlan & { name: string };
}

export interface AdminUserCounts {
  assets?: number;
  materials?: number;
  showcases?: number;
  feedbacks?: number;
  teamMemberships?: number;
  projects?: number;
  tasks?: number;
  refreshTokens?: number;
  trustedDevices?: number;
  auditLogs?: number;
}

export interface AdminUserRisk {
  score: number;
  level: 'high' | 'medium' | 'low';
  reason: string;
  reasons?: string[];
}

export interface AdminUser {
  id: string;
  name?: string | null;
  email: string;
  role: UserRole;
  status: UserStatus;
  avatarUrl?: string | null;
  points?: number;
  emailVerified?: boolean;
  twoFactorEnabled?: boolean;
  createdAt: string;
  updatedAt?: string;
  subscription?: AdminUserSubscription | null;
  lastLoginAt?: string | null;
  lastLoginIp?: string | null;
  lastLoginUserAgent?: string | null;
  loginCount?: number;
  lastActivityAt?: string | null;
  lastActivityAction?: string | null;
  lastActivityModule?: string | null;
  lastActivityIp?: string | null;
  activeSessions?: number;
  trustedDevices?: number;
  _count?: AdminUserCounts;
  risk?: AdminUserRisk;
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

interface DistributionItem {
  key: string;
  label: string;
  count: number;
  color?: string | null;
}

export interface AdminUserOverview {
  generatedAt: string;
  totals: {
    total: number;
    active: number;
    banned: number;
    admins: number;
    instructors: number;
    users: number;
    newLast7d: number;
    newLast30d: number;
  };
  security: {
    emailVerified: number;
    emailUnverified: number;
    twoFactorEnabled: number;
    twoFactorDisabled: number;
    adminsWithoutMfa: number;
    activeSessions: number;
    activeSessionUsers: number;
    trustedDevices: number;
  };
  activity: {
    recentLogins: number;
    dormant: number;
    neverLoggedIn: number;
    loginEventsLast7d: number;
  };
  commerce: {
    activeSubscriptions: number;
    expiringSoon: number;
    conversionRate: number;
  };
  roleDistribution: DistributionItem[];
  statusDistribution: DistributionItem[];
  planDistribution: DistributionItem[];
  riskQueue: AdminUser[];
  recentUsers: AdminUser[];
}

interface FocusPreset {
  key: string;
  label: string;
  role?: RoleFilter;
  status?: StatusFilter;
  activity?: ActivityFilter;
  smart?: SmartFilter;
  q?: string;
}

const users = ref<AdminUser[]>([]);
const plans = ref<AdminSubscriptionPlan[]>([]);
const userOverview = ref<AdminUserOverview | null>(null);
const isLoading = ref(false);
const isOverviewLoading = ref(false);
const isSubmitting = ref(false);
const isSubLoading = ref(false);
const searchQuery = ref('');
const roleFilter = ref<RoleFilter>('ALL');
const statusFilter = ref<StatusFilter>('ALL');
const activityFilter = ref<ActivityFilter>('ALL');
const smartFilter = ref<SmartFilter>('ALL');
const selectedIds = ref<string[]>([]);
const detailUser = ref<AdminUser | null>(null);
const detailDrawerVisible = ref(false);

const pagination = ref<PaginationState>({
  page: 1,
  limit: 50,
  total: 0,
  totalPages: 1,
});

const createDialogVisible = ref(false);
const editDialogVisible = ref(false);
const editingUser = ref<AdminUser | null>(null);

const subDialogVisible = ref(false);
const selectedUser = ref<AdminUser | null>(null);
const subForm = ref({
  planId: '',
  interval: 'MONTHLY',
  endDate: '',
  status: 'ACTIVE',
});

const roleOptions: Array<{ value: RoleFilter; label: string }> = [
  { value: 'ALL', label: '全部角色' },
  { value: 'ADMIN', label: '管理员' },
  { value: 'INSTRUCTOR', label: '导师' },
  { value: 'USER', label: '普通用户' },
];

const statusOptions: Array<{ value: StatusFilter; label: string }> = [
  { value: 'ALL', label: '全部状态' },
  { value: 'ACTIVE', label: '正常' },
  { value: 'BANNED', label: '封禁' },
];

const activityOptions: Array<{ value: ActivityFilter; label: string }> = [
  { value: 'ALL', label: '全部活跃' },
  { value: 'RECENT', label: '近7日登录' },
  { value: 'DORMANT', label: '沉睡用户' },
  { value: 'NEVER', label: '从未登录' },
  { value: 'SESSIONS', label: '多会话' },
  { value: 'RISK', label: '需关注' },
];

const focusPresets: FocusPreset[] = [
  {
    key: 'all',
    label: '全部用户',
    role: 'ALL',
    status: 'ALL',
    activity: 'ALL',
    smart: 'ALL',
    q: '',
  },
  {
    key: 'risk',
    label: '风险账号',
    activity: 'RISK',
  },
  {
    key: 'admin-security',
    label: '管理员安全',
    role: 'ADMIN',
    activity: 'ALL',
  },
  {
    key: 'subscribed',
    label: '订阅用户',
    activity: 'ALL',
    smart: 'SUBSCRIBED',
  },
  {
    key: 'dormant',
    label: '沉睡唤醒',
    activity: 'DORMANT',
  },
  {
    key: 'new',
    label: '新注册',
    activity: 'ALL',
    smart: 'NEW',
  },
];

const matchesActivityFilter = (user: AdminUser) => {
  const days = getDaysSince(user.lastLoginAt);
  switch (activityFilter.value) {
    case 'RECENT':
      return days !== null && days <= 7;
    case 'DORMANT':
      return days !== null && days > 30;
    case 'NEVER':
      return !user.lastLoginAt;
    case 'SESSIONS':
      return (user.activeSessions || 0) >= 2;
    case 'RISK':
      return riskInfo(user).priority >= 2;
    default:
      return true;
  }
};

const matchesSmartFilter = (user: AdminUser) => {
  if (smartFilter.value === 'SUBSCRIBED') return user.subscription?.status === 'ACTIVE';
  if (smartFilter.value === 'NEW') {
    const days = getDaysSince(user.createdAt);
    return days !== null && days <= 7;
  }
  return true;
};

const filteredUsers = computed(() =>
  users.value.filter((user) => matchesActivityFilter(user) && matchesSmartFilter(user)),
);

const stats = computed(() => {
  const pageUsers = users.value;
  const active = pageUsers.filter((user) => user.status === 'ACTIVE').length;
  const admins = pageUsers.filter((user) => user.role === 'ADMIN').length;
  const subscribed = pageUsers.filter((user) => user.subscription?.status === 'ACTIVE').length;
  const recentLogins = pageUsers.filter((user) => {
    const days = getDaysSince(user.lastLoginAt);
    return days !== null && days <= 7;
  }).length;
  const neverLoggedIn = pageUsers.filter((user) => !user.lastLoginAt).length;
  const mfaEnabled = pageUsers.filter((user) => user.twoFactorEnabled).length;
  const activeSessions = pageUsers.reduce((sum, user) => sum + (user.activeSessions || 0), 0);
  const risky = pageUsers.filter((user) => riskInfo(user).priority >= 2).length;

  return {
    total: pagination.value.total || pageUsers.length,
    active,
    admins,
    subscribed,
    recentLogins,
    neverLoggedIn,
    mfaEnabled,
    activeSessions,
    risky,
  };
});

const consolidatedCards = computed(() => {
  const overview = userOverview.value;
  return [
    {
      label: '全站用户规模',
      value: overview?.totals.total ?? stats.value.total,
      hint: overview
        ? `7d 新增 ${overview.totals.newLast7d} · 30d 新增 ${overview.totals.newLast30d}`
        : `当前页 ${users.value.length} 个用户`,
      icon: Users,
      color: 'text-sky-600 bg-sky-500/10 border-sky-500/20',
      progress: null,
      health: { label: '正常', variant: 'success' as const },
    },
    {
      label: '系统安全覆盖',
      value: overview
        ? `${Math.round((overview.security.twoFactorEnabled / Math.max(1, overview.totals.total)) * 100)}%`
        : stats.value.mfaEnabled,
      hint: overview
        ? `${overview.security.adminsWithoutMfa} 管理员未开 2FA · 未验证 ${overview.security.emailUnverified}`
        : `${stats.value.mfaEnabled} 个已开启 2FA`,
      icon: ShieldCheck,
      color: overview?.security.adminsWithoutMfa
        ? 'text-amber-600 bg-amber-500/10 border-amber-500/20'
        : 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20',
      progress: overview
        ? Math.round(
            (overview.security.twoFactorEnabled / Math.max(1, overview.totals.total)) * 100,
          )
        : null,
      health: overview?.security.adminsWithoutMfa
        ? { label: '关注', variant: 'warning' as const }
        : { label: '稳定', variant: 'success' as const },
    },
    {
      label: '活跃会话监测',
      value: overview?.security.activeSessions ?? stats.value.activeSessions,
      hint: overview
        ? `${overview.security.activeSessionUsers} 个用户在线 · 设备 ${overview.security.trustedDevices}`
        : `${stats.value.recentLogins} 个近7日登录`,
      icon: MonitorSmartphone,
      color: 'text-green-600 bg-green-500/10 border-green-500/20',
      progress: null,
      health: { label: '稳定', variant: 'success' as const },
    },
    {
      label: '商业订阅转化',
      value: overview ? `${overview.commerce.conversionRate}%` : stats.value.subscribed,
      hint: overview
        ? `活跃订阅 ${overview.commerce.activeSubscriptions} · 即将到期 ${overview.commerce.expiringSoon}`
        : `${stats.value.subscribed} 个活跃订阅`,
      icon: CreditCard,
      color: 'text-purple-600 bg-purple-500/10 border-purple-500/20',
      progress: overview ? overview.commerce.conversionRate : null,
      health: { label: '稳定', variant: 'success' as const },
    },
  ];
});

const compact = (value?: number | null) => formatCompactNumber(value || 0);

const activePresetKey = computed({
  get() {
    const preset = focusPresets.find(
      (item) =>
        (item.role || 'ALL') === roleFilter.value &&
        (item.status || 'ALL') === statusFilter.value &&
        (item.activity || 'ALL') === activityFilter.value &&
        (item.smart || 'ALL') === smartFilter.value &&
        (item.q || '') === searchQuery.value.trim(),
    );
    return preset?.key || '';
  },
  set(newKey) {
    const preset = focusPresets.find((p) => p.key === newKey);
    if (preset) {
      applyPreset(preset);
    }
  },
});

const presetTabOptions = computed(() => {
  const iconMap: Record<string, Component> = {
    all: Users,
    risk: Ban,
    'admin-security': ShieldCheck,
    subscribed: CreditCard,
    dormant: Clock,
    new: Plus,
  };
  return focusPresets.map((preset) => ({
    label: preset.label,
    value: preset.key,
    icon: iconMap[preset.key],
  }));
});

const fetchUsers = async (page: number = pagination.value.page) => {
  isLoading.value = true;
  try {
    const response = await api.get<AdminUser[] | AdminUsersResponse>('/api/admin/users', {
      params: {
        page,
        limit: pagination.value.limit,
        q: searchQuery.value.trim() || undefined,
        role: roleFilter.value !== 'ALL' ? roleFilter.value : undefined,
        status: statusFilter.value !== 'ALL' ? statusFilter.value : undefined,
      },
    });
    const payload = response.data;
    users.value = Array.isArray(payload) ? payload : payload.data;
    pagination.value = Array.isArray(payload)
      ? { page, limit: pagination.value.limit, total: payload.length, totalPages: 1 }
      : payload.pagination || {
          page,
          limit: pagination.value.limit,
          total: payload.data.length,
          totalPages: 1,
        };
    selectedIds.value = selectedIds.value.filter((id) =>
      users.value.some((user) => user.id === id),
    );
    if (detailUser.value) {
      const fresh = users.value.find((user) => user.id === detailUser.value?.id);
      if (fresh) detailUser.value = fresh;
    }
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '无法加载用户数据'));
  } finally {
    isLoading.value = false;
  }
};

const fetchUserOverview = async () => {
  isOverviewLoading.value = true;
  try {
    const response = await api.get<AdminUserOverview>('/api/admin/users/overview');
    userOverview.value = response.data;
  } catch (error) {
    logError(error, { operation: 'fetchUserOverview', view: 'UsersView' });
  } finally {
    isOverviewLoading.value = false;
  }
};

const refreshDashboard = async (page: number = pagination.value.page) => {
  await Promise.all([fetchUsers(page), fetchUserOverview(), fetchManagementInsights(true)]);
};

const fetchPlans = async () => {
  try {
    const response = await api.get<AdminSubscriptionPlan[]>('/api/admin/subscription-plans');
    plans.value = response.data;
  } catch (error) {
    logError(error, { operation: 'fetchPlans', view: 'UsersView' });
  }
};

const applyPreset = (preset: FocusPreset) => {
  roleFilter.value = preset.role || 'ALL';
  statusFilter.value = preset.status || 'ALL';
  activityFilter.value = preset.activity || 'ALL';
  smartFilter.value = preset.smart || 'ALL';
  searchQuery.value = preset.q || '';
};

const copyEmail = async (user: AdminUser) => {
  try {
    await navigator.clipboard.writeText(user.email);
    ElMessage.success('邮箱已复制');
  } catch {
    ElMessage.warning('复制失败，请手动复制');
  }
};

const escapeCsv = (value: unknown) => {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
};

const exportVisibleUsers = () => {
  const rows = filteredUsers.value.map((user) => [
    user.name || '未命名用户',
    user.email,
    roleLabel(user.role),
    statusLabel(user.status),
    planLabel(user),
    user.emailVerified ? '已验证' : '未验证',
    user.twoFactorEnabled ? '已开启' : '未开启',
    lastLoginText(user),
    user.lastLoginIp || '',
    user.activeSessions || 0,
    user.trustedDevices || 0,
    user._count?.assets || 0,
    user._count?.showcases || 0,
    user._count?.projects || 0,
    formatDate(user.createdAt),
  ]);
  const header = [
    '姓名',
    '邮箱',
    '角色',
    '状态',
    '订阅',
    '邮箱验证',
    '2FA',
    '最后登录',
    '登录IP',
    '活跃会话',
    '可信设备',
    '资产',
    '作品',
    '项目',
    '注册时间',
  ];
  const csv = [header, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  ElMessage.success(`已导出 ${rows.length} 个用户`);
};

const openCreateDialog = () => {
  createDialogVisible.value = true;
};

const handleCreateUser = async (form: {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}) => {
  if (!form.email.trim() || !form.password.trim()) {
    ElMessage.warning('请填写邮箱和初始密码');
    return;
  }
  isSubmitting.value = true;
  try {
    await api.post('/api/admin/users', form);
    ElMessage.success('用户已创建');
    createDialogVisible.value = false;
    await refreshDashboard(1);
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '创建失败'));
  } finally {
    isSubmitting.value = false;
  }
};

const openEditDialog = (user: AdminUser) => {
  editingUser.value = user;
  editDialogVisible.value = true;
};

const handleUpdateUser = async (user: AdminUser) => {
  isSubmitting.value = true;
  try {
    const { id, name, email, role, status } = user;
    await api.put(`/api/admin/users/${id}`, { name, email, role, status });
    ElMessage.success('用户信息已更新');
    editDialogVisible.value = false;
    await refreshDashboard();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '更新失败'));
  } finally {
    isSubmitting.value = false;
  }
};

const openDetail = (user: AdminUser) => {
  detailUser.value = user;
  detailDrawerVisible.value = true;
};

const handleToggleStatus = async (user: AdminUser) => {
  const nextStatus: UserStatus = user.status === 'BANNED' ? 'ACTIVE' : 'BANNED';
  try {
    await ElMessageBox.confirm(
      `确认将 ${user.name || user.email} ${nextStatus === 'BANNED' ? '封禁' : '恢复'}？`,
      '状态变更确认',
      {
        confirmButtonText: '确认执行',
        cancelButtonText: '取消',
        type: 'warning',
      },
    );
    await api.put(`/api/admin/users/${user.id}`, { status: nextStatus });
    ElMessage.success(`${user.name || user.email} 已${nextStatus === 'BANNED' ? '封禁' : '恢复'}`);
    await refreshDashboard();
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(getApiErrorMessage(error, '状态更新失败'));
    }
  }
};

const handleBatchUpdate = async (payload: { role?: UserRole; status?: UserStatus }) => {
  if (selectedIds.value.length === 0) return;
  try {
    const actionText = payload.status
      ? payload.status === 'BANNED'
        ? '批量封禁'
        : '批量恢复'
      : `批量设为${roleLabel(payload.role || '')}`;
    await ElMessageBox.confirm(
      `确认对 ${selectedIds.value.length} 个用户执行「${actionText}」？`,
      '批量操作确认',
      {
        confirmButtonText: '确认执行',
        cancelButtonText: '取消',
        type: 'warning',
      },
    );
    await api.put('/api/admin/users/batch', { ids: selectedIds.value, ...payload });
    ElMessage.success('批量操作已完成');
    selectedIds.value = [];
    await refreshDashboard();
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(getApiErrorMessage(error, '批量操作失败'));
    }
  }
};

const handleResetPassword = (user: AdminUser) => {
  ElMessageBox.prompt(`为 ${user.name || user.email} 设置新密码`, '重置密码', {
    confirmButtonText: '确认重置',
    cancelButtonText: '取消',
    inputType: 'password',
    inputPattern: /^.{6,}$/,
    inputErrorMessage: '密码至少 6 位',
  }).then(async ({ value }) => {
    try {
      await api.post(`/api/admin/users/${user.id}/reset-password`, { password: value });
      ElMessage.success('密码已重置');
    } catch (error) {
      ElMessage.error(getApiErrorMessage(error, '密码重置失败'));
    }
  });
};

const handleRevokeSessions = async (user: AdminUser, includeTrustedDevices = false) => {
  const sessionCount = user.activeSessions || 0;
  const deviceCount = user.trustedDevices || 0;
  try {
    await ElMessageBox.confirm(
      `确认清退 ${user.name || user.email} 的 ${sessionCount} 个活跃会话${
        includeTrustedDevices ? `，并移除 ${deviceCount} 台可信设备` : ''
      }？`,
      '清退登录态',
      {
        confirmButtonText: '确认清退',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'el-button--danger',
      },
    );
    const response = await api.post<{ sessions: number; trustedDevices: number }>(
      `/api/admin/users/${user.id}/revoke-sessions`,
      { includeTrustedDevices },
    );
    ElMessage.success(
      `已清退 ${response.data.sessions || 0} 个会话${
        response.data.trustedDevices ? `，移除 ${response.data.trustedDevices} 台可信设备` : ''
      }`,
    );
    await refreshDashboard();
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(getApiErrorMessage(error, '清退登录态失败'));
    }
  }
};

const handleBatchRevokeSessions = async () => {
  if (selectedIds.value.length === 0) return;
  try {
    await ElMessageBox.confirm(
      `确认清退 ${selectedIds.value.length} 个用户的所有活跃会话？`,
      '批量清退登录态',
      {
        confirmButtonText: '确认清退',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'el-button--danger',
      },
    );
    const response = await api.post<{ users: number; sessions: number; trustedDevices: number }>(
      '/api/admin/users/batch/revoke-sessions',
      { ids: selectedIds.value, includeTrustedDevices: false },
    );
    ElMessage.success(`已清退 ${response.data.users} 个用户、${response.data.sessions} 个会话`);
    selectedIds.value = [];
    await refreshDashboard();
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(getApiErrorMessage(error, '批量清退失败'));
    }
  }
};

const handleDeleteUser = async (user: AdminUser) => {
  try {
    await ElMessageBox.confirm(
      `删除 ${user.name || user.email} 会移除其账号及关联个人数据，此操作不可恢复。`,
      '永久删除用户',
      {
        confirmButtonText: '永久删除',
        cancelButtonText: '取消',
        type: 'error',
        confirmButtonClass: 'el-button--danger',
      },
    );
    await api.delete(`/api/admin/users/${user.id}`);
    ElMessage.success('用户已删除');
    if (detailUser.value?.id === user.id) detailDrawerVisible.value = false;
    await refreshDashboard();
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(getApiErrorMessage(error, '删除失败'));
    }
  }
};

const openSubDialog = (user: AdminUser) => {
  selectedUser.value = user;
  subForm.value = user.subscription
    ? {
        planId: user.subscription.planId,
        interval: user.subscription.interval || 'MONTHLY',
        endDate: user.subscription.endDate
          ? new Date(user.subscription.endDate).toISOString().split('T')[0] || ''
          : '',
        status: user.subscription.status || 'ACTIVE',
      }
    : {
        planId: plans.value[0]?.id || '',
        interval: 'MONTHLY',
        endDate: '',
        status: 'ACTIVE',
      };
  subDialogVisible.value = true;
};

const handleManageSub = async () => {
  if (!selectedUser.value) return;
  isSubLoading.value = true;
  try {
    if (selectedUser.value.subscription) {
      await api.put(
        `/api/admin/subscriptions/${selectedUser.value.subscription.id}`,
        subForm.value,
      );
      ElMessage.success('订阅已更新');
    } else {
      await api.post('/api/admin/subscriptions', {
        ...subForm.value,
        userId: selectedUser.value.id,
      });
      ElMessage.success('订阅已开通');
    }
    subDialogVisible.value = false;
    await refreshDashboard();
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error, '订阅操作失败'));
  } finally {
    isSubLoading.value = false;
  }
};

const handleCancelSub = async () => {
  if (!selectedUser.value?.subscription) return;
  try {
    await ElMessageBox.confirm('确认取消该用户的订阅？', '取消订阅', {
      confirmButtonText: '确认取消',
      cancelButtonText: '保留',
      type: 'warning',
    });
    await api.delete(`/api/admin/subscriptions/${selectedUser.value.subscription.id}`);
    ElMessage.success('订阅已取消');
    subDialogVisible.value = false;
    await refreshDashboard();
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(getApiErrorMessage(error, '取消失败'));
    }
  }
};

const handleSizeChange = (size: number) => {
  pagination.value.limit = size;
  fetchUsers(1);
};

let searchTimer: ReturnType<typeof setTimeout> | null = null;
watch([searchQuery, roleFilter, statusFilter], () => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    pagination.value.page = 1;
    fetchUsers(1);
  }, 250);
});

watch([activityFilter, smartFilter], () => {
  selectedIds.value = selectedIds.value.filter((id) =>
    filteredUsers.value.some((user) => user.id === id),
  );
});

onMounted(() => {
  refreshDashboard();
  fetchPlans();
});

onUnmounted(() => {
  if (searchTimer) clearTimeout(searchTimer);
});

void consolidatedCards.value;
</script>

<template>
  <div class="admin-users-page flex flex-1 min-h-0 flex-col overflow-hidden mobile-adaptive">
    <main class="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
      <UserPageHeader
        v-model:search-query="searchQuery"
        :user-overview="userOverview"
        :is-loading="isLoading"
        :is-overview-loading="isOverviewLoading"
        :subtitle="
          userOverview
            ? `覆盖 ${compact(userOverview.totals.total)} 个账号，${compact(userOverview.security.activeSessions)} 个活跃会话`
            : '正在同步账号、会话与订阅数据'
        "
        @refresh="refreshDashboard()"
        @create="openCreateDialog"
      />

      <UserStatsCards :cards="consolidatedCards" />

      <!-- Workspace layout: Single Column Workspace -->
      <div class="mt-3 w-full min-w-0">
        <!-- Left: Workbench Toolbar & User Table -->
        <div class="space-y-3 min-w-0">
          <UserToolbar
            v-model:role-filter="roleFilter"
            v-model:status-filter="statusFilter"
            v-model:activity-filter="activityFilter"
            v-model:active-preset-key="activePresetKey"
            :role-options="roleOptions"
            :status-options="statusOptions"
            :activity-options="activityOptions"
            :preset-tab-options="presetTabOptions"
            :selected-count="selectedIds.length"
            @export="exportVisibleUsers"
            @batch-update="handleBatchUpdate"
            @batch-revoke-sessions="handleBatchRevokeSessions"
            @clear-selection="selectedIds = []"
          />

          <UserTable
            v-model:selected-ids="selectedIds"
            :users="filteredUsers"
            :is-loading="isLoading"
            :pagination="pagination"
            @row-detail="openDetail"
            @row-copy-email="copyEmail"
            @row-edit="openEditDialog"
            @row-subscription="openSubDialog"
            @row-reset-password="handleResetPassword"
            @row-revoke-sessions="handleRevokeSessions"
            @row-revoke-devices="(user) => handleRevokeSessions(user, true)"
            @row-toggle-status="handleToggleStatus"
            @row-delete="handleDeleteUser"
            @page-change="fetchUsers"
            @size-change="handleSizeChange"
          />
        </div>
      </div>
    </main>

    <UserDetailDrawer
      v-model="detailDrawerVisible"
      :user="detailUser"
      @edit="openEditDialog"
      @subscription="openSubDialog"
      @reset-password="handleResetPassword"
      @revoke-sessions="handleRevokeSessions"
      @toggle-status="handleToggleStatus"
      @delete="handleDeleteUser"
    />

    <UserFormDialog
      v-model="createDialogVisible"
      :user="null"
      :is-submitting="isSubmitting"
      @submit="handleCreateUser"
    />

    <UserFormDialog
      v-model="editDialogVisible"
      :user="editingUser"
      :is-submitting="isSubmitting"
      @submit="handleUpdateUser"
    />

    <UserQuotaDialog
      v-model="subDialogVisible"
      :user="selectedUser"
      :plans="plans"
      :is-sub-loading="isSubLoading"
      @submit="
        async (formData) => {
          subForm = formData;
          await handleManageSub();
        }
      "
      @cancel-sub="handleCancelSub"
    />
  </div>
</template>

<style scoped>
.admin-users-page {
  min-height: 0;
  background: transparent;
  color: #0f172a;
}

@media (max-width: 720px) {
  .page-header {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
