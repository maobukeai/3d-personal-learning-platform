import type { AdminUser } from '../UsersView.vue';

interface RiskInfo {
  label: string;
  tone: 'green' | 'amber' | 'red' | 'slate' | 'blue';
  priority: number;
}

const safeDateTime = (value?: string | null) => {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
};

export const getDaysSince = (value?: string | null) => {
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

export const riskInfo = (user: AdminUser): RiskInfo => {
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

export const roleLabel = (role: string) => {
  const map: Record<string, string> = {
    ADMIN: '管理员',
    INSTRUCTOR: '导师',
    USER: '普通用户',
  };
  return map[role] || role;
};

export const statusLabel = (status: string) => {
  const map: Record<string, string> = {
    ACTIVE: '正常',
    BANNED: '封禁',
  };
  return map[status] || status;
};

export const formatDateShort = (value?: string | null) => {
  const time = safeDateTime(value);
  if (!time) return '未记录';
  return new Date(time).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

export const lastLoginText = (user: AdminUser) => relativeTime(user.lastLoginAt) || '从未登录';

export const loginClass = (user: AdminUser) => {
  const days = getDaysSince(user.lastLoginAt);
  return {
    'tone-slate': days === null,
    'tone-green': days !== null && days <= 7,
    'tone-amber': days !== null && days > 7 && days <= 30,
    'tone-red': days !== null && days > 30,
  };
};

export const activityText = (user: AdminUser) => {
  const distance = relativeTime(user.lastActivityAt);
  if (!distance) return '暂无操作';
  if (!user.lastActivityAction) return distance;
  return `${distance} / ${user.lastActivityModule || 'SYSTEM'}:${user.lastActivityAction}`;
};

export const shortUserAgent = (value?: string | null) => {
  if (!value) return '未知设备';
  if (/Edg/i.test(value)) return 'Edge';
  if (/Chrome/i.test(value)) return 'Chrome';
  if (/Firefox/i.test(value)) return 'Firefox';
  if (/Safari/i.test(value) && !/Chrome/i.test(value)) return 'Safari';
  return value.slice(0, 30);
};

export const planLabel = (user: AdminUser) =>
  user.subscription?.plan?.displayName || user.subscription?.plan?.name || '未订阅';

export const roleClass = (role: string) => ({
  'tone-purple': role === 'ADMIN',
  'tone-blue': role === 'INSTRUCTOR',
  'tone-slate': role === 'USER',
});

export const statusClass = (status: string) => ({
  'tone-green': status === 'ACTIVE',
  'tone-red': status === 'BANNED',
});

export const riskLabel = (user: AdminUser) => riskInfo(user).label;

export const riskClass = (user: AdminUser) => ({
  'tone-red': riskInfo(user).tone === 'red',
  'tone-amber': riskInfo(user).tone === 'amber',
  'tone-green': riskInfo(user).tone === 'green',
  'tone-blue': riskInfo(user).tone === 'blue',
  'tone-slate': riskInfo(user).tone === 'slate',
});
