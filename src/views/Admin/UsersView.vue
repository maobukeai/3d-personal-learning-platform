<script setup lang="ts">
import { formatDateTime as formatDate } from '@/utils/format';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import {
  Ban,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  Download,
  Eye,
  EyeOff,
  Fingerprint,
  KeyRound,
  MonitorSmartphone,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  TimerReset,
  Trash2,
  UserCog,
  Users,
} from 'lucide-vue-next';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '@/utils/api';
import { getApiErrorMessage } from '@/utils/error';
import UserAvatar from '@/components/UserAvatar.vue';
import { fetchManagementInsights, formatCompactNumber } from './adminManagementInsights';
import UserDetailDrawer from './components/UserDetailDrawer.vue';
import UserQuotaDialog from './components/UserQuotaDialog.vue';
import Modal from '@/components/ui/Modal.vue';
import PageHeader from '@/components/PageHeader.vue';
import Button from '@/components/ui/Button.vue';
import Tabs from '@/components/ui/Tabs.vue';
import Badge from '@/components/ui/Badge.vue';

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
const showPassword = ref(false);
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

const getBadgeVariant = (label: string) => {
  if (label === '正常' || label === '稳定') return 'success';
  if (label === '关注') return 'warning';
  if (label === '高压') return 'danger';
  return 'primary';
};

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
  const iconMap: Record<string, any> = {
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

void consolidatedCards.value;
</script>

<template>
  <div class="admin-users-page flex flex-1 min-h-0 flex-col overflow-hidden">
    <main class="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
      <PageHeader
        title="用户管理"
        :subtitle="
          userOverview
            ? `覆盖 ${compact(userOverview.totals.total)} 个账号，${compact(userOverview.security.activeSessions)} 个活跃会话`
            : '正在同步账号、会话与订阅数据'
        "
        variant="card"
      >
        <template #title-badge>
          <div v-if="userOverview" class="flex flex-wrap items-center gap-1.5 ml-2">
            <Badge variant="info">封禁: {{ userOverview.totals.banned }}</Badge>
            <Badge variant="info">管理员: {{ userOverview.totals.admins }}</Badge>
            <Badge variant="info">活跃订阅: {{ userOverview.commerce.activeSubscriptions }}</Badge>
          </div>
        </template>

        <template #center>
          <!-- Compact Search Box (Centered) -->
          <label class="search-box !min-h-0 !h-8 w-44 sm:w-64 shrink-0">
            <Search />
            <input v-model="searchQuery" placeholder="搜索姓名、邮箱..." type="search" />
          </label>
        </template>

        <!-- Reusable Buttons -->
        <Button
          variant="secondary"
          size="sm"
          :loading="isLoading || isOverviewLoading"
          :icon="RefreshCw"
          @click="refreshDashboard()"
        >
          刷新
        </Button>
        <Button variant="primary" size="sm" :icon="Plus" @click="openCreateDialog">
          新建用户
        </Button>
      </PageHeader>
      <!-- Top KPI metrics grid (Horizontal compact) -->
      <section class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <Card
          v-for="card in consolidatedCards"
          :key="card.label"
          hoverable
          glow
          class="group !p-2 px-2.5"
        >
          <div class="flex items-center justify-between w-full gap-3">
            <!-- Left: Icon & Info -->
            <div class="flex items-center gap-2.5 min-w-0">
              <span
                class="panel-icon border border-base rounded-lg p-1.5 transition-transform group-hover:scale-105 shrink-0"
                :class="card.color"
              >
                <component :is="card.icon" class="h-3.5 w-3.5" />
              </span>
              <div class="min-w-0">
                <p
                  class="text-[11px] font-bold text-[var(--text-secondary)] truncate leading-tight"
                >
                  {{ card.label }}
                </p>
                <p
                  class="text-[9px] text-[var(--text-secondary)] opacity-80 truncate mt-0.5 leading-none"
                  :title="card.hint"
                >
                  {{ card.hint }}
                </p>
              </div>
            </div>

            <!-- Right: Metric & Health Badge -->
            <div class="flex items-center gap-2 shrink-0">
              <span class="text-base font-black text-[var(--text-primary)] leading-none">
                {{ card.value.toLocaleString() }}
              </span>
              <Badge :variant="getBadgeVariant(card.health.label)">
                {{ card.health.label }}
              </Badge>
            </div>
          </div>

          <!-- Sleek flat progress bar -->
          <div
            v-if="card.progress !== null"
            class="w-full h-[3px] bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden mt-1.5"
          >
            <div
              class="h-full rounded-full bg-accent"
              :style="{ width: `${card.progress}%` }"
            ></div>
          </div>
        </Card>
      </section>

      <!-- Workspace layout: Single Column Workspace -->
      <div class="mt-3 w-full min-w-0">
        <!-- Left: Workbench Toolbar & User Table -->
        <div class="space-y-3 min-w-0">
          <Card padding="sm" class="workbench-toolbar-card">
            <div class="toolbar-top">
              <div class="overflow-x-auto scrollbar-hide shrink-0 max-w-full">
                <Tabs v-model="activePresetKey" :options="presetTabOptions" size="sm" />
              </div>

              <div class="toolbar-actions">
                <el-select v-model="statusFilter" size="small" style="width: 100px">
                  <el-option
                    v-for="option in statusOptions"
                    :key="option.value"
                    :label="option.label"
                    :value="option.value"
                  />
                </el-select>

                <el-select v-model="roleFilter" size="small" style="width: 110px">
                  <el-option
                    v-for="option in roleOptions"
                    :key="option.value"
                    :label="option.label"
                    :value="option.value"
                  />
                </el-select>

                <el-select v-model="activityFilter" size="small" style="width: 110px">
                  <el-option
                    v-for="option in activityOptions"
                    :key="option.value"
                    :label="option.label"
                    :value="option.value"
                  />
                </el-select>

                <Button variant="secondary" size="sm" :icon="Download" @click="exportVisibleUsers">
                  导出
                </Button>
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
                <el-dropdown
                  trigger="click"
                  @command="
                    (command: unknown) => handleBatchUpdate({ role: String(command) as UserRole })
                  "
                >
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
          </Card>

          <Card padding="none" class="table-shell-card overflow-hidden">
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
                      <button
                        class="link-button user-name"
                        type="button"
                        @click.stop="openDetail(row)"
                      >
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
                      {{ row.lastLoginIp || '无 IP' }} /
                      {{ shortUserAgent(row.lastLoginUserAgent) }}
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
                  <button class="pill sub-button" type="button" @click.stop="openSubDialog(row)">
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
                      邮箱{{ row.emailVerified ? '已验' : '未验' }} / 2FA{{
                        row.twoFactorEnabled ? '开' : '关'
                      }}
                    </span>
                  </div>
                </template>
              </el-table-column>

              <el-table-column label="注册时间" width="132">
                <template #default="{ row }">
                  {{ formatDateShort(row.createdAt) }}
                </template>
              </el-table-column>

              <el-table-column label="操作" width="94">
                <template #default="{ row }">
                  <el-dropdown
                    trigger="click"
                    @command="(command: unknown) => handleRowCommand(String(command), row)"
                  >
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
          </Card>
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

    <Modal
      :show="createDialogVisible"
      title="新建用户"
      size="md"
      glass-card
      @close="createDialogVisible = false"
    >
      <div class="form-stack">
        <label>
          姓名
          <input v-model="createForm.name" placeholder="用户昵称或真实姓名" />
        </label>
        <label>
          邮箱
          <input v-model="createForm.email" placeholder="user@example.com" type="email" />
        </label>
        <label>
          初始密码
          <div class="relative flex items-center">
            <input
              v-model="createForm.password"
              placeholder="至少 6 位"
              :type="showPassword ? 'text' : 'password'"
            />
            <button
              type="button"
              class="absolute right-3 text-slate-400 hover:text-slate-200 transition-colors flex items-center justify-center"
              @click="showPassword = !showPassword"
            >
              <component :is="showPassword ? EyeOff : Eye" class="w-4.5 h-4.5" />
            </button>
          </div>
        </label>
        <label>
          角色
          <select v-model="createForm.role">
            <option value="USER">普通用户</option>
            <option value="INSTRUCTOR">导师</option>
            <option value="ADMIN">管理员</option>
          </select>
        </label>
      </div>
      <template #footer>
        <div class="flex items-center gap-3">
          <Button variant="secondary" @click="createDialogVisible = false">取消</Button>
          <Button variant="primary" :loading="isSubmitting" @click="handleCreateUser">
            创建
          </Button>
        </div>
      </template>
    </Modal>

    <Modal
      :show="editDialogVisible"
      title="编辑用户"
      size="md"
      glass-card
      @close="editDialogVisible = false"
    >
      <div v-if="editingUser" class="form-stack">
        <label>
          姓名
          <input v-model="editingUser.name" />
        </label>
        <label>
          邮箱
          <input v-model="editingUser.email" type="email" />
        </label>
        <label>
          角色
          <select v-model="editingUser.role">
            <option value="USER">普通用户</option>
            <option value="INSTRUCTOR">导师</option>
            <option value="ADMIN">管理员</option>
          </select>
        </label>
        <label>
          状态
          <select v-model="editingUser.status">
            <option value="ACTIVE">正常</option>
            <option value="BANNED">封禁</option>
          </select>
        </label>
      </div>
      <template #footer>
        <div class="flex items-center gap-3">
          <Button variant="secondary" @click="editDialogVisible = false">取消</Button>
          <Button variant="primary" :loading="isSubmitting" @click="handleUpdateUser">
            保存
          </Button>
        </div>
      </template>
    </Modal>

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

/* Layout structures managed by tailwind grids */

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

/* Card contains workbench toolbar styles */

.toolbar-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  flex: 0 0 auto;
}

.toolbar-actions :deep(.el-button) {
  display: inline-flex;
  align-items: center;
  gap: 5px;
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

/* Card contains table shell styles */

.table-shell-card {
  min-height: 480px;
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
  height: 48px;
}

.user-table :deep(.el-table__cell) {
  padding: 4px 0;
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

.sub-button {
  border: 0;
  color: #7c3aed;
  background: #f3e8ff;
  cursor: pointer;
}

.sub-button:hover {
  background: #ede9fe;
}

.icon-pill {
  width: fit-content;
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

  .toolbar-top {
    align-items: stretch;
    flex-direction: column;
  }

  .search-box {
    width: 100%;
  }
}

@media (max-width: 720px) {
  .page-header,
  .toolbar-top,
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

  .toolbar-actions :deep(.el-button),
  .toolbar-actions :deep(.el-select) {
    flex: 1 1 calc(50% - 4px);
    min-width: 100px;
  }
}

.form-stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-stack label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-secondary);
}

.form-stack input,
.form-stack select,
.form-stack textarea {
  width: 100%;
  min-height: 38px;
  padding: 0 12px;
  border: 1px solid var(--border-base);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-primary);
  outline: none;
  font-size: 13px;
  transition: all 0.2s ease;
}

/* Specific background adjustment for theme compatibility */
html:not(.dark) .form-stack input,
html:not(.dark) .form-stack select,
html:not(.dark) .form-stack textarea {
  background: rgba(0, 0, 0, 0.02);
  border-color: rgba(0, 0, 0, 0.08);
}

.form-stack input:hover,
.form-stack select:hover,
.form-stack textarea:hover {
  border-color: var(--accent);
  background: rgba(255, 255, 255, 0.08);
}

html:not(.dark) .form-stack input:hover,
html:not(.dark) .form-stack select:hover,
html:not(.dark) .form-stack textarea:hover {
  background: rgba(0, 0, 0, 0.04);
}

.form-stack input:focus,
.form-stack select:focus,
.form-stack textarea:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(var(--accent-rgb, 59, 130, 246), 0.2);
  background: rgba(255, 255, 255, 0.08);
}

html:not(.dark) .form-stack input:focus,
html:not(.dark) .form-stack select:focus,
html:not(.dark) .form-stack textarea:focus {
  background: rgba(0, 0, 0, 0.04);
}

.form-stack textarea {
  padding: 8px 12px;
  resize: vertical;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
</style>
