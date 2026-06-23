import type { AdminTeamUser } from './adminTeamsTypes';

export const safeTime = (value?: string | null) => {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
};

export const relativeTime = (value?: string | null) => {
  const time = safeTime(value);
  if (!time) return '暂无活动';
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

export const compactNumber = (value?: number) => {
  const num = value || 0;
  if (num >= 10000) return `${(num / 10000).toFixed(num >= 100000 ? 0 : 1)}万`;
  if (num >= 1000) return `${(num / 1000).toFixed(num >= 10000 ? 0 : 1)}k`;
  return String(num);
};

export const ownerName = (user?: AdminTeamUser | null) => user?.name || user?.email || '未指定';

export const visibilityLabel = (visibility?: string) => (visibility === 'PUBLIC' ? '公开' : '私有');

export const riskLabel = (level?: string) => {
  if (level === 'HIGH') return '高风险';
  if (level === 'MEDIUM') return '需关注';
  return '稳定';
};

export const riskClass = (level?: string) => ({
  'tone-red': level === 'HIGH',
  'tone-amber': level === 'MEDIUM',
  'tone-green': !level || level === 'LOW',
});

export const scoreToneClass = (score?: number) => ({
  'tone-red': (score || 0) < 60,
  'tone-amber': (score || 0) >= 60 && (score || 0) < 80,
  'tone-green': (score || 0) >= 80,
});

export const scoreClass = (score?: number) => ({
  'score-red': (score || 0) < 60,
  'score-amber': (score || 0) >= 60 && (score || 0) < 80,
  'score-green': (score || 0) >= 80,
});
