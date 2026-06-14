<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import {
  Activity,
  Ban,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  CreditCard,
  Download,
  Eye,
  Fingerprint,
  KeyRound,
  Mail,
  MonitorSmartphone,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TimerReset,
  Trash2,
  UserCog,
  Users,
  X,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '@/utils/api';
import { getApiErrorMessage } from '@/utils/error';
import UserAvatar from '@/components/UserAvatar.vue';
import AdminOpsPanel from './components/AdminOpsPanel.vue';
import { fetchManagementInsights, formatCompactNumber } from './adminManagementInsights';
import UserDetailDrawer from './components/UserDetailDrawer.vue';
import UserQuotaDialog from './components/UserQuotaDialog.vue';

export type UserRole = 'USER' | 'ADMIN' | 'INSTRUCTOR';
export type UserStatus = 'ACTIVE' | 'BANNED';
type RoleFilter = 'ALL' | UserRole;
type StatusFilter = 'ALL' | UserStatus;
type ActivityFilter = 'ALL' | 'RECENT' | 'DORMANT' | 'NEVER' | 'SESSIONS' | 'RISK';
type SmartFilter = 'ALL' | 'SUBSCRIBED' | 'NEW';

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

interface RiskInfo {
  label: string;
  tone: 'green' | 'amber' | 'red' | 'slate' | 'blue';
  priority: number;
}

interface DistributionItem {
  key: string;
  label: string;
  count: number;
  color?: string | null;
}

interface AdminUserOverview {
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
  hint: string;
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
const showAdvancedFilters = ref(false);
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
const createForm = ref({
  name: '',
  email: '',
  password: '',
  role: 'USER' as UserRole,
});

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
    key: 'risk',
    label: '风险账号',
    hint: '封禁、未验证、会话异常',
    activity: 'RISK',
  },
  {
    key: 'admin-security',
    label: '管理员安全',
    hint: '管理员与 2FA 检查',
    role: 'ADMIN',
    activity: 'ALL',
  },
  {
    key: 'subscribed',
    label: '订阅用户',
    hint: '商业用户留存跟进',
    activity: 'ALL',
    smart: 'SUBSCRIBED',
  },
  {
    key: 'dormant',
    label: '沉睡唤醒',
    hint: '超过 30 天未登录',
    activity: 'DORMANT',
  },
  {
    key: 'new',
    label: '新注册',
    hint: '近 7 日新增画像',
    activity: 'ALL',
    smart: 'NEW',
  },
];

const roleLabel = (role: string) => {
  const map: Record<string, string> = {
    ADMIN: '管理员',
    INSTRUCTOR: '导师',
    USER: '普通用户',
  };
  return map[role] || role;
};

const statusLabel = (status: string) => {
  const map: Record<string, string> = {
    ACTIVE: '正常',
    BANNED: '封禁',
  };
  return map[status] || status;
};

const safeDateTime = (value?: string | null) => {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
};

const formatDate = (value?: string | null) => {
  const time = safeDateTime(value);
  if (!time) return '未记录';
  return new Date(time).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDateShort = (value?: string | null) => {
  const time = safeDateTime(value);
  if (!time) return '未记录';
  return new Date(time).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

const getDaysSince = (value?: string | null) => {
  const time = safeDateTime(value);
  if (!time) return null;
  return Math.max(0, Math.floor((Date.now() - time) / (24 * 60 * 60 * 1000)));
};

const relativeTime = (value?: string | null) => {
  const time = safeDateTime(value);
  if (!time) return null;
  const diff = Math.max(0, Date.now() - time);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days < 30) return `${days} 天前`;
  if (days < 365) return `${Math.floor(days / 30)} 个月前`;
  return `${Math.floor(days / 365)} 年前`;
};

const lastLoginText = (user: AdminUser) => relativeTime(user.lastLoginAt) || '从未登录';

const loginClass = (user: AdminUser) => {
  const days = getDaysSince(user.lastLoginAt);
  return {
    'tone-slate': days === null,
    'tone-green': days !== null && days <= 7,
    'tone-amber': days !== null && days > 7 && days <= 30,
    'tone-red': days !== null && days > 30,
  };
};

const activityText = (user: AdminUser) => {
  const distance = relativeTime(user.lastActivityAt);
  if (!distance) return '暂无操作';
  if (!user.lastActivityAction) return distance;
  return `${distance} / ${user.lastActivityModule || 'SYSTEM'}:${user.lastActivityAction}`;
};

const shortUserAgent = (value?: string | null) => {
  if (!value) return '未知设备';
  if (/Edg/i.test(value)) return 'Edge';
  if (/Chrome/i.test(value)) return 'Chrome';
  if (/Firefox/i.test(value)) return 'Firefox';
  if (/Safari/i.test(value) && !/Chrome/i.test(value)) return 'Safari';
  return value.slice(0, 30);
};

const planLabel = (user: AdminUser) =>
  user.subscription?.plan?.displayName || user.subscription?.plan?.name || '未订阅';

const roleClass = (role: string) => ({
  'tone-purple': role === 'ADMIN',
  'tone-blue': role === 'INSTRUCTOR',
  'tone-slate': role === 'USER',
});

const statusClass = (status: string) => ({
  'tone-green': status === 'ACTIVE',
  'tone-red': status === 'BANNED',
});

const riskInfo = (user: AdminUser): RiskInfo => {
  const days = getDaysSince(user.lastLoginAt);
  if (user.status === 'BANNED') return { label: '高风险', tone: 'red', priority: 5 };
  if (!user.lastLoginAt) return { label: '未登录', tone: 'amber', priority: 3 };
  if (days !== null && days > 30) return { label: '沉睡', tone: 'amber', priority: 3 };
  if ((user.activeSessions || 0) >= 5) return { label: '会话偏多', tone: 'amber', priority: 3 };
  if (!user.emailVerified) return { label: '邮箱未验', tone: 'amber', priority: 2 };
  if ((user._count?.feedbacks || 0) >= 5) return { label: '反馈偏多', tone: 'amber', priority: 2 };
  if (user.twoFactorEnabled) return { label: '稳健', tone: 'green', priority: 0 };
  return { label: '正常', tone: 'slate', priority: 0 };
};

const riskLabel = (user: AdminUser) => riskInfo(user).label;

const riskClass = (user: AdminUser) => ({
  'tone-red': riskInfo(user).tone === 'red',
  'tone-amber': riskInfo(user).tone === 'amber',
  'tone-green': riskInfo(user).tone === 'green',
  'tone-blue': riskInfo(user).tone === 'blue',
  'tone-slate': riskInfo(user).tone === 'slate',
});

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

const overviewMetrics = computed(() => {
  const overview = userOverview.value;
  return [
    {
      key: 'users',
      label: '全站用户',
      value: overview?.totals.total ?? stats.value.total,
      sub: overview ? `7日新增 ${overview.totals.newLast7d}` : `当前页 ${users.value.length}`,
      icon: Users,
      tone: 'blue',
    },
    {
      key: 'security',
      label: '安全覆盖',
      value: overview
        ? `${Math.round((overview.security.twoFactorEnabled / Math.max(1, overview.totals.total)) * 100)}%`
        : stats.value.mfaEnabled,
      sub: overview
        ? `${overview.security.adminsWithoutMfa} 个管理员未开 2FA`
        : `${stats.value.mfaEnabled} 个已开 2FA`,
      icon: ShieldCheck,
      tone: overview?.security.adminsWithoutMfa ? 'amber' : 'green',
    },
    {
      key: 'activity',
      label: '活跃会话',
      value: overview?.security.activeSessions ?? stats.value.activeSessions,
      sub: overview
        ? `${overview.security.activeSessionUsers} 个用户在线`
        : `${stats.value.recentLogins} 个近7日登录`,
      icon: MonitorSmartphone,
      tone: 'green',
    },
    {
      key: 'commerce',
      label: '订阅转化',
      value: overview ? `${overview.commerce.conversionRate}%` : stats.value.subscribed,
      sub: overview
        ? `${overview.commerce.activeSubscriptions} 活跃订阅 / ${overview.commerce.expiringSoon} 即将到期`
        : `${stats.value.subscribed} 个活跃订阅`,
      icon: CreditCard,
      tone: 'purple',
    },
  ];
});

const compact = (value?: number | null) => formatCompactNumber(value || 0);

const roleDistribution = computed<DistributionItem[]>(() => {
  if (userOverview.value?.roleDistribution.length) {
    return userOverview.value.roleDistribution.map((item) => ({
      ...item,
      label: roleLabel(item.key),
    }));
  }
  const groups = users.value.reduce<Record<string, number>>((acc, user) => {
    acc[user.role] = (acc[user.role] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(groups).map(([key, count]) => ({ key, label: roleLabel(key), count }));
});

const planDistribution = computed<DistributionItem[]>(() => {
  if (userOverview.value?.planDistribution.length) return userOverview.value.planDistribution;
  const groups = users.value.reduce<Record<string, number>>((acc, user) => {
    const label = planLabel(user);
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(groups)
    .map(([label, count]) => ({ key: label, label, count }))
    .filter((item) => item.label !== '未订阅');
});

const riskQueue = computed(() => {
  if (userOverview.value?.riskQueue?.length) return userOverview.value.riskQueue;
  return [...users.value]
    .filter((user) => riskInfo(user).priority >= 2)
    .sort((a, b) => riskInfo(b).priority - riskInfo(a).priority)
    .slice(0, 6);
});

const maxRoleCount = computed(() =>
  Math.max(1, ...roleDistribution.value.map((item) => item.count)),
);

const maxPlanCount = computed(() =>
  Math.max(1, ...planDistribution.value.map((item) => item.count)),
);

const activePresetKey = computed(() => {
  const preset = focusPresets.find(
    (item) =>
      (item.role || 'ALL') === roleFilter.value &&
      (item.status || 'ALL') === statusFilter.value &&
      (item.activity || 'ALL') === activityFilter.value &&
      (item.smart || 'ALL') === smartFilter.value &&
      (item.q || '') === searchQuery.value.trim(),
  );
  return preset?.key || '';
});

const allPageSelected = computed(
  () =>
    filteredUsers.value.length > 0 &&
    filteredUsers.value.every((user) => selectedIds.value.includes(user.id)),
);

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
    console.error('Fetch user overview error:', error);
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
    console.error('Fetch plans error:', error);
  }
};

const toggleSelectAll = () => {
  const visibleIds = filteredUsers.value.map((user) => user.id);
  if (allPageSelected.value) {
    selectedIds.value = selectedIds.value.filter((id) => !visibleIds.includes(id));
  } else {
    selectedIds.value = Array.from(new Set([...selectedIds.value, ...visibleIds]));
  }
};

const toggleSelect = (id: string) => {
  selectedIds.value = selectedIds.value.includes(id)
    ? selectedIds.value.filter((selectedId) => selectedId !== id)
    : [...selectedIds.value, id];
};

const applyPreset = (preset: FocusPreset) => {
  roleFilter.value = preset.role || 'ALL';
  statusFilter.value = preset.status || 'ALL';
  activityFilter.value = preset.activity || 'ALL';
  smartFilter.value = preset.smart || 'ALL';
  searchQuery.value = preset.q || '';
};

const clearFilters = () => {
  roleFilter.value = 'ALL';
  statusFilter.value = 'ALL';
  activityFilter.value = 'ALL';
  smartFilter.value = 'ALL';
  searchQuery.value = '';
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
  createForm.value = { name: '', email: '', password: '', role: 'USER' };
  createDialogVisible.value = true;
};

const handleCreateUser = async () => {
  if (!createForm.value.email.trim() || !createForm.value.password.trim()) {
    ElMessage.warning('请填写邮箱和初始密码');
    return;
  }
  isSubmitting.value = true;
  try {
    await api.post('/api/admin/users', createForm.value);
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
  editingUser.value = { ...user };
  editDialogVisible.value = true;
};

const handleUpdateUser = async () => {
  if (!editingUser.value) return;
  isSubmitting.value = true;
  try {
    const { id, name, email, role, status } = editingUser.value;
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
      await api.put(`/api/admin/subscriptions/${selectedUser.value.subscription.id}`, subForm.value);
      ElMessage.success('订阅已更新');
    } else {
      await api.post('/api/admin/subscriptions', { ...subForm.value, userId: selectedUser.value.id });
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

const handleRowCommand = (command: string, user: AdminUser) => {
  if (command === 'detail') openDetail(user);
  if (command === 'copy-email') copyEmail(user);
  if (command === 'edit') openEditDialog(user);
  if (command === 'subscription') openSubDialog(user);
  if (command === 'reset') handleResetPassword(user);
  if (command === 'revoke') handleRevokeSessions(user);
  if (command === 'revoke-device') handleRevokeSessions(user, true);
  if (command === 'status') handleToggleStatus(user);
  if (command === 'delete') handleDeleteUser(user);
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

void overviewMetrics.value;
</script>

<template>
  <div class="admin-users-page">
    <header class="page-header">
      <div>
        <div class="eyebrow">
          <UserCog :size="14" />
          用户与团队
        </div>
        <h1>用户管理</h1>
        <p class="page-subtitle">
          {{ userOverview ? `覆盖 ${compact(userOverview.totals.total)} 个账号，${compact(userOverview.security.activeSessions)} 个活跃会话` : '正在同步账号、会话与订阅数据' }}
        </p>
      </div>
      <div class="header-actions">
        <el-button :loading="isLoading || isOverviewLoading" @click="refreshDashboard()">
          <RefreshCw :size="16" />
          刷新
        </el-button>
        <el-button type="primary" @click="openCreateDialog">
          <Plus :size="16" />
          新建用户
        </el-button>
      </div>
    </header>

    <section class="command-center">
      <div class="command-main">
        <AdminOpsPanel scope="users" />
      </div>

      <aside class="command-side">
        <section class="signal-card">
          <div class="signal-head">
            <div>
              <span>风险处理队列</span>
              <strong>{{ riskQueue.length }} 个信号</strong>
            </div>
            <ShieldAlert :size="17" />
          </div>
          <button
            v-for="user in riskQueue.slice(0, 4)"
            :key="user.id"
            class="risk-row"
            type="button"
            @click="openDetail(user)"
          >
            <UserAvatar :user="user" size="sm" />
            <span>
              <strong>{{ user.name || user.email }}</strong>
              <em>{{ user.risk?.reason || riskLabel(user) }}</em>
            </span>
            <ChevronRight :size="15" />
          </button>
          <div v-if="riskQueue.length === 0" class="quiet-empty">
            当前没有高优先级账号风险。
          </div>
        </section>

        <section class="signal-card">
          <div class="signal-head">
            <div>
              <span>角色与订阅分布</span>
              <strong>真实全站聚合</strong>
            </div>
            <BarChart3 :size="17" />
          </div>
          <div class="distribution-list">
            <div v-for="item in roleDistribution" :key="`role-${item.key}`" class="distribution-row">
              <span>{{ item.label }}</span>
              <div><i :style="{ width: `${(item.count / maxRoleCount) * 100}%` }" /></div>
              <strong>{{ item.count }}</strong>
            </div>
            <div
              v-for="item in planDistribution.slice(0, 3)"
              :key="`plan-${item.key}`"
              class="distribution-row plan"
            >
              <span>{{ item.label }}</span>
              <div><i :style="{ width: `${(item.count / maxPlanCount) * 100}%` }" /></div>
              <strong>{{ item.count }}</strong>
            </div>
          </div>
        </section>
      </aside>
    </section>

    <section class="workbench-toolbar">
      <div class="toolbar-top">
        <div class="preset-strip">
          <button
            v-for="preset in focusPresets"
            :key="preset.key"
            :class="{ active: activePresetKey === preset.key }"
            type="button"
            @click="applyPreset(preset)"
          >
            <Sparkles :size="14" />
            <span>{{ preset.label }}</span>
            <em>{{ preset.hint }}</em>
          </button>
        </div>

        <label class="search-box">
          <Search :size="17" />
          <input v-model="searchQuery" placeholder="搜索姓名、邮箱" type="search" />
        </label>

        <div class="toolbar-actions">
          <el-button :type="showAdvancedFilters ? 'primary' : ''" plain @click="showAdvancedFilters = !showAdvancedFilters">
            <SlidersHorizontal :size="15" />
            高级筛选
          </el-button>
          <el-button plain @click="exportVisibleUsers">
            <Download :size="15" />
            导出
          </el-button>
          <el-button plain @click="clearFilters">
            <X :size="15" />
            清空
          </el-button>
        </div>
      </div>

      <div v-show="showAdvancedFilters" class="filter-row">
        <div class="filter-title">
          <SlidersHorizontal :size="15" />
          精准筛选
        </div>
        <div class="filter-wrap">
          <div class="segmented">
            <button
              v-for="option in statusOptions"
              :key="option.value"
              :class="{ active: statusFilter === option.value }"
              type="button"
              @click="statusFilter = option.value"
            >
              {{ option.label }}
            </button>
          </div>
          <div class="segmented">
            <button
              v-for="option in roleOptions"
              :key="option.value"
              :class="{ active: roleFilter === option.value }"
              type="button"
              @click="roleFilter = option.value"
            >
              {{ option.label }}
            </button>
          </div>
          <div class="segmented">
            <button
              v-for="option in activityOptions"
              :key="option.value"
              :class="{ active: activityFilter === option.value }"
              type="button"
              @click="activityFilter = option.value"
            >
              {{ option.label }}
            </button>
          </div>
        </div>
      </div>

      <div v-if="selectedIds.length" class="batch-bar">
        <div>
          已选 <strong>{{ selectedIds.length }}</strong> 个用户
        </div>
        <div class="batch-actions">
          <el-button size="small" @click="handleBatchUpdate({ status: 'ACTIVE' })">
            <CheckCircle2 :size="14" />
            恢复
          </el-button>
          <el-button size="small" @click="handleBatchUpdate({ status: 'BANNED' })">
            <Ban :size="14" />
            封禁
          </el-button>
          <el-dropdown trigger="click" @command="(command: unknown) => handleBatchUpdate({ role: String(command) as UserRole })">
            <el-button size="small">
              <UserCog :size="14" />
              改角色
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="USER">普通用户</el-dropdown-item>
                <el-dropdown-item command="INSTRUCTOR">导师</el-dropdown-item>
                <el-dropdown-item command="ADMIN">管理员</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <el-button size="small" @click="handleBatchRevokeSessions">
            <TimerReset :size="14" />
            清退会话
          </el-button>
          <el-button size="small" text @click="selectedIds = []">取消选择</el-button>
        </div>
      </div>
    </section>

    <section class="table-shell">
      <el-table
        v-loading="isLoading"
        :data="filteredUsers"
        class="user-table"
        row-key="id"
        @row-dblclick="openDetail"
      >
        <el-table-column width="48">
          <template #header>
            <input
              :checked="allPageSelected"
              class="select-checkbox"
              type="checkbox"
              @change="toggleSelectAll"
            />
          </template>
          <template #default="{ row }">
            <input
              :checked="selectedIds.includes(row.id)"
              class="select-checkbox"
              type="checkbox"
              @change.stop="toggleSelect(row.id)"
            />
          </template>
        </el-table-column>

        <el-table-column label="用户" min-width="260">
          <template #default="{ row }">
            <div class="user-cell">
              <UserAvatar :user="row" size="md" />
              <div class="user-main">
                <button class="link-button user-name" type="button" @click.stop="openDetail(row)">
                  {{ row.name || '未命名用户' }}
                </button>
                <span class="email-line">
                  {{ row.email }}
                  <button title="复制邮箱" type="button" @click.stop="copyEmail(row)">
                    <Copy :size="12" />
                  </button>
                </span>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="角色" width="118">
          <template #default="{ row }">
            <span class="pill" :class="roleClass(row.role)">
              {{ roleLabel(row.role) }}
            </span>
          </template>
        </el-table-column>

        <el-table-column label="状态" width="104">
          <template #default="{ row }">
            <span class="pill" :class="statusClass(row.status)">
              {{ statusLabel(row.status) }}
            </span>
          </template>
        </el-table-column>

        <el-table-column label="最后登录" min-width="220">
          <template #default="{ row }">
            <div class="stack-cell">
              <span class="pill icon-pill" :class="loginClass(row)">
                <Clock :size="13" />
                {{ lastLoginText(row) }}
              </span>
              <span class="muted-line">
                {{ row.lastLoginIp || '无 IP' }} / {{ shortUserAgent(row.lastLoginUserAgent) }}
              </span>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="活跃 / 会话" min-width="220">
          <template #default="{ row }">
            <div class="activity-cell">
              <span>{{ activityText(row) }}</span>
              <div class="inline-metrics">
                <span>
                  <MonitorSmartphone :size="13" />
                  {{ row.activeSessions || 0 }} 会话
                </span>
                <span>
                  <Fingerprint :size="13" />
                  {{ row.trustedDevices || 0 }} 设备
                </span>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="内容贡献" min-width="190">
          <template #default="{ row }">
            <div class="contrib-grid">
              <span>{{ row._count?.assets || 0 }} 资产</span>
              <span>{{ row._count?.showcases || 0 }} 作品</span>
              <span>{{ row._count?.feedbacks || 0 }} 反馈</span>
              <span>{{ row._count?.projects || 0 }} 项目</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="订阅" width="132">
          <template #default="{ row }">
            <button class="sub-button" type="button" @click.stop="openSubDialog(row)">
              {{ planLabel(row) }}
            </button>
          </template>
        </el-table-column>

        <el-table-column label="安全" min-width="170">
          <template #default="{ row }">
            <div class="stack-cell">
              <span class="pill icon-pill" :class="riskClass(row)">
                <ShieldCheck :size="13" />
                {{ riskLabel(row) }}
              </span>
              <span class="muted-line">
                邮箱{{ row.emailVerified ? '已验' : '未验' }} / 2FA{{ row.twoFactorEnabled ? '开' : '关' }}
              </span>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="注册时间" width="132">
          <template #default="{ row }">
            {{ formatDateShort(row.createdAt) }}
          </template>
        </el-table-column>

        <el-table-column fixed="right" label="操作" width="94">
          <template #default="{ row }">
            <el-dropdown trigger="click" @command="(command: unknown) => handleRowCommand(String(command), row)">
              <el-button class="icon-button" text>
                <MoreHorizontal :size="18" />
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="detail">
                    <Eye :size="14" />
                    查看画像
                  </el-dropdown-item>
                  <el-dropdown-item command="copy-email">
                    <Copy :size="14" />
                    复制邮箱
                  </el-dropdown-item>
                  <el-dropdown-item command="edit">
                    <UserCog :size="14" />
                    编辑资料
                  </el-dropdown-item>
                  <el-dropdown-item command="subscription">
                    <CreditCard :size="14" />
                    订阅管理
                  </el-dropdown-item>
                  <el-dropdown-item command="reset">
                    <KeyRound :size="14" />
                    重置密码
                  </el-dropdown-item>
                  <el-dropdown-item command="revoke">
                    <TimerReset :size="14" />
                    清退登录态
                  </el-dropdown-item>
                  <el-dropdown-item command="revoke-device">
                    <Fingerprint :size="14" />
                    移除可信设备
                  </el-dropdown-item>
                  <el-dropdown-item command="status">
                    <Ban :size="14" />
                    {{ row.status === 'BANNED' ? '恢复账号' : '封禁账号' }}
                  </el-dropdown-item>
                  <el-dropdown-item command="delete" divided>
                    <Trash2 :size="14" />
                    永久删除
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
        </el-table-column>

        <template #empty>
          <div class="empty-state">
            <Users :size="30" />
            <span>暂无匹配用户</span>
          </div>
        </template>
      </el-table>

      <div class="pagination-wrap">
        <span>当前筛选显示 {{ filteredUsers.length }} 条</span>
        <el-pagination
          background
          :current-page="pagination.page"
          :page-size="pagination.limit"
          :page-sizes="[20, 50, 100, 200]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="fetchUsers"
          @size-change="handleSizeChange"
        />
      </div>
    </section>

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

    <el-dialog v-model="createDialogVisible" title="新建用户" width="520px">
      <el-form label-position="top">
        <el-form-item label="姓名">
          <el-input v-model="createForm.name" placeholder="用户昵称或真实姓名" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="createForm.email" placeholder="user@example.com" />
        </el-form-item>
        <el-form-item label="初始密码">
          <el-input v-model="createForm.password" placeholder="至少 6 位" show-password />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="createForm.role" class="full-width">
            <el-option label="普通用户" value="USER" />
            <el-option label="导师" value="INSTRUCTOR" />
            <el-option label="管理员" value="ADMIN" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="isSubmitting" @click="handleCreateUser">
          创建
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="editDialogVisible" title="编辑用户" width="520px">
      <el-form v-if="editingUser" label-position="top">
        <el-form-item label="姓名">
          <el-input v-model="editingUser.name" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="editingUser.email" />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="editingUser.role" class="full-width">
            <el-option label="普通用户" value="USER" />
            <el-option label="导师" value="INSTRUCTOR" />
            <el-option label="管理员" value="ADMIN" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="editingUser.status" class="full-width">
            <el-option label="正常" value="ACTIVE" />
            <el-option label="封禁" value="BANNED" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="isSubmitting" @click="handleUpdateUser">
          保存
        </el-button>
      </template>
    </el-dialog>

    <UserQuotaDialog
      v-model="subDialogVisible"
      :user="selectedUser"
      :plans="plans"
      :is-sub-loading="isSubLoading"
      @submit="async (formData) => {
        subForm = formData;
        await handleManageSub();
      }"
      @cancel-sub="handleCancelSub"
    />
  </div>
</template>

<style scoped>
.admin-users-page {
  min-height: 100%;
  background: #f5f7fb;
  color: #0f172a;
  padding: 0 0 20px;
}

.page-header {
  min-height: 64px;
  padding: 10px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  background: #ffffff;
  border-bottom: 1px solid #e5eaf3;
}

.eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #64748b;
  font-size: 13px;
  font-weight: 700;
}

.page-header h1 {
  margin: 4px 0 0;
  font-size: 22px;
  line-height: 1.2;
  font-weight: 800;
  letter-spacing: 0;
}

.page-subtitle {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
}

.header-actions,
.batch-actions,
.drawer-actions,
.drawer-danger {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.header-actions :deep(.el-button),
.batch-actions :deep(.el-button),
.drawer-actions :deep(.el-button),
.drawer-danger :deep(.el-button) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.command-center {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(420px, 520px);
  gap: 10px;
  padding: 10px 14px;
}

.command-main {
  min-width: 0;
}

.command-main :deep(section) {
  margin-bottom: 0;
  box-shadow: none;
}

.metric-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
  margin-top: 6px;
}

.metric-card {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 52px;
  padding: 7px 10px;
  background: #ffffff;
  border: 1px solid #edf1f7;
  border-radius: 8px;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.035);
}

.metric-card span {
  display: block;
  color: #64748b;
  font-size: 10px;
  font-weight: 700;
}

.metric-card strong {
  display: block;
  margin-top: 2px;
  font-size: 18px;
  line-height: 1;
  color: #0f172a;
}

.metric-card em {
  display: block;
  margin-top: 3px;
  color: #64748b;
  font-size: 10px;
  font-style: normal;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.metric-icon {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
}

.metric-copy {
  min-width: 0;
}

.command-side {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-content: start;
  gap: 8px;
  min-width: 0;
}

.signal-card {
  min-width: 0;
  padding: 10px;
  background: #ffffff;
  border: 1px solid #e8edf5;
  border-radius: 8px;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.035);
}

.signal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
  color: #64748b;
}

.signal-head span {
  display: block;
  font-size: 11px;
  font-weight: 800;
}

.signal-head strong {
  display: block;
  margin-top: 2px;
  color: #0f172a;
  font-size: 13px;
  font-weight: 850;
}

.risk-row {
  width: 100%;
  min-height: 34px;
  padding: 5px 4px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: #334155;
  text-align: left;
  cursor: pointer;
}

.risk-row:hover {
  background: #f8fafc;
}

.risk-row span {
  min-width: 0;
}

.risk-row strong,
.risk-row em {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.risk-row strong {
  color: #0f172a;
  font-size: 12px;
  font-weight: 850;
}

.risk-row em {
  margin-top: 1px;
  color: #64748b;
  font-size: 11px;
  font-style: normal;
  font-weight: 700;
}

.quiet-empty {
  padding: 12px;
  color: #94a3b8;
  font-size: 12px;
  font-weight: 700;
  text-align: center;
}

.distribution-list {
  display: grid;
  gap: 7px;
}

.distribution-row {
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr) 28px;
  align-items: center;
  gap: 8px;
  color: #475569;
  font-size: 11px;
  font-weight: 800;
}

.distribution-row div {
  height: 7px;
  overflow: hidden;
  border-radius: 999px;
  background: #edf2f7;
}

.distribution-row i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: #0ea5e9;
}

.distribution-row.plan i {
  background: #10b981;
}

.distribution-row strong {
  color: #0f172a;
  text-align: right;
}

.workbench-toolbar {
  margin: 0 14px 10px;
  padding: 8px;
  background: #ffffff;
  border: 1px solid #e9eef6;
  border-radius: 8px;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.035);
}

.toolbar-top,
.filter-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.filter-row {
  margin-top: 7px;
  padding-top: 7px;
  border-top: 1px solid #eef2f7;
}

.filter-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #64748b;
  font-size: 12px;
  font-weight: 850;
  white-space: nowrap;
}

.preset-strip {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
}

.preset-strip button {
  min-width: 118px;
  min-height: 34px;
  padding: 5px 8px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0 6px;
  align-items: center;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fafc;
  color: #334155;
  text-align: left;
  cursor: pointer;
}

.preset-strip button:hover,
.preset-strip button.active {
  border-color: #93c5fd;
  background: #eff6ff;
  color: #0369a1;
}

.preset-strip span,
.preset-strip em {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preset-strip span {
  font-size: 12px;
  font-weight: 850;
}

.preset-strip em {
  grid-column: 2;
  color: #64748b;
  font-size: 10px;
  font-style: normal;
  font-weight: 700;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
}

.toolbar-actions :deep(.el-button) {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.filter-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.segmented {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 3px;
  background: #eef3f9;
  border-radius: 8px;
}

.segmented button {
  min-height: 28px;
  border: 0;
  border-radius: 6px;
  padding: 0 12px;
  background: transparent;
  color: #334155;
  font-size: 13px;
  font-weight: 800;
  white-space: nowrap;
  cursor: pointer;
}

.segmented button.active {
  color: #7c3aed;
  background: #ffffff;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.09);
}

.search-box {
  width: min(320px, 28vw);
  height: 34px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #64748b;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.search-box input {
  width: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  color: #0f172a;
  font-size: 14px;
}

.batch-bar {
  margin: 10px 0 0;
  padding: 9px 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: #334155;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 8px;
}

.table-shell {
  margin: 0 14px;
  background: #ffffff;
  border: 1px solid #e8edf5;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 10px 22px rgba(15, 23, 42, 0.045);
}

.user-table {
  width: 100%;
}

.user-table :deep(.el-table__header th) {
  height: 40px;
  background: #f8fafc;
  color: #64748b;
  font-size: 12px;
  font-weight: 800;
}

.user-table :deep(.el-table__row) {
  height: 62px;
}

.user-table :deep(.el-table__cell) {
  padding: 6px 0;
}

.select-checkbox {
  width: 15px;
  height: 15px;
  accent-color: #7c3aed;
  cursor: pointer;
}

.user-cell {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.user-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.user-main span,
.muted-line {
  color: #64748b;
  font-size: 12px;
  line-height: 1.35;
}

.email-line {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  max-width: 230px;
}

.email-line button {
  width: 19px;
  height: 19px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 5px;
  color: #94a3b8;
  background: transparent;
  cursor: pointer;
  flex: 0 0 auto;
}

.email-line button:hover {
  color: #0369a1;
  background: #e0f2fe;
}

.link-button {
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.user-name {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #0f172a;
  font-size: 14px;
  font-weight: 800;
}

.stack-cell,
.activity-cell {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.activity-cell > span {
  color: #1e293b;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.35;
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.inline-metrics {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.inline-metrics span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
}

.contrib-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px 10px;
  color: #334155;
  font-size: 12px;
  font-weight: 700;
}

.pill,
.sub-button {
  min-height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 0 9px;
  border-radius: 999px;
  border: 1px solid transparent;
  font-size: 12px;
  line-height: 1;
  font-weight: 800;
  white-space: nowrap;
}

.icon-pill {
  width: fit-content;
}

.sub-button {
  border: 0;
  color: #7c3aed;
  background: #f3e8ff;
  cursor: pointer;
}

.sub-button:hover {
  background: #ede9fe;
}

.tone-blue {
  color: #0369a1;
  background: #e0f2fe;
  border-color: #bae6fd;
}

.tone-green {
  color: #047857;
  background: #d1fae5;
  border-color: #a7f3d0;
}

.tone-purple {
  color: #7c3aed;
  background: #f3e8ff;
  border-color: #e9d5ff;
}

.tone-amber {
  color: #b45309;
  background: #fef3c7;
  border-color: #fde68a;
}

.tone-red {
  color: #be123c;
  background: #ffe4e6;
  border-color: #fecdd3;
}

.tone-slate {
  color: #475569;
  background: #f1f5f9;
  border-color: #e2e8f0;
}

.icon-button {
  width: 32px;
  height: 32px;
  padding: 0;
}

.empty-state {
  min-height: 180px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #94a3b8;
  font-weight: 700;
}

.pagination-wrap {
  min-height: 48px;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: #64748b;
  font-size: 13px;
  border-top: 1px solid #edf2f7;
}

.drawer-body {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.drawer-hero {
  display: flex;
  align-items: center;
  gap: 18px;
}

.drawer-hero h2 {
  margin: 0;
  color: #0f172a;
  font-size: 24px;
  line-height: 1.2;
  font-weight: 850;
  letter-spacing: 0;
}

.drawer-hero p {
  margin: 6px 0 10px;
  color: #64748b;
  font-size: 14px;
}

.drawer-pills {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
}

.detail-section {
  padding-top: 18px;
  border-top: 1px solid #e8eef5;
}

.detail-section h3 {
  margin: 0 0 12px;
  color: #0f172a;
  font-size: 15px;
  font-weight: 850;
  letter-spacing: 0;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.detail-grid.three {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.detail-grid > div {
  min-height: 68px;
  padding: 12px;
  border: 1px solid #e8eef5;
  border-radius: 8px;
  background: #fbfdff;
}

.detail-grid span,
.timeline-list span,
.detail-list span {
  display: block;
  color: #64748b;
  font-size: 12px;
  font-weight: 800;
}

.detail-grid strong {
  display: block;
  margin-top: 7px;
  color: #0f172a;
  font-size: 18px;
  line-height: 1.1;
  font-weight: 850;
  word-break: break-word;
}

.detail-list {
  display: grid;
  gap: 8px;
}

.detail-list > div {
  display: grid;
  grid-template-columns: 20px 92px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  min-height: 36px;
  color: #475569;
}

.detail-list strong,
.timeline-list strong {
  color: #0f172a;
  font-size: 13px;
  font-weight: 800;
  word-break: break-word;
}

.timeline-list {
  display: grid;
  gap: 10px;
}

.timeline-list > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px dashed #e2e8f0;
}

.drawer-danger {
  padding-top: 16px;
  border-top: 1px solid #fee2e2;
}

.full-width {
  width: 100%;
}

:deep(.el-dropdown-menu__item) {
  display: flex;
  align-items: center;
  gap: 8px;
}

@media (max-width: 1100px) {
  .command-center {
    grid-template-columns: 1fr;
  }

  .command-side {
    grid-template-columns: 1fr 1fr;
    grid-template-rows: auto;
  }

  .metric-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .toolbar-top,
  .filter-row {
    align-items: stretch;
    flex-direction: column;
  }

  .preset-strip,
  .filter-wrap {
    width: 100%;
  }

  .search-box {
    width: 100%;
  }
}

@media (max-width: 720px) {
  .page-header,
  .toolbar-top,
  .filter-row,
  .batch-bar,
  .pagination-wrap {
    align-items: stretch;
    flex-direction: column;
  }

  .command-center {
    padding: 8px 10px;
  }

  .command-side,
  .metric-strip {
    grid-template-columns: 1fr;
  }

  .filter-wrap {
    align-items: stretch;
    flex-direction: column;
  }

  .segmented {
    overflow-x: auto;
    justify-content: flex-start;
  }

  .table-shell {
    margin: 0 10px;
  }

  .workbench-toolbar {
    margin-left: 10px;
    margin-right: 10px;
  }

  .toolbar-actions {
    width: 100%;
  }

  .toolbar-actions :deep(.el-button) {
    flex: 1;
  }

  .detail-grid,
  .detail-grid.three {
    grid-template-columns: 1fr;
  }
}
</style>
