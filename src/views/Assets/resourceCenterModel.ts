export type ResourceKind = 'asset' | 'material' | 'plugin' | 'showcase' | 'software';
export type KindFilter = ResourceKind | 'all';
export type StatusFilter = 'all' | 'APPROVED' | 'PENDING' | 'REJECTED';
export type SortMode = 'updated' | 'created' | 'metric' | 'title' | 'review';

export interface ResourceLibrary {
  key: string;
  label: string;
  path: string;
  total: number;
  mine: number;
  pending: number;
  rejected: number;
  weekAdded: number;
  metric: number;
  metricLabel: string;
  storageMb: number;
}

export interface ResourceItem {
  id: string;
  kind: ResourceKind;
  title: string;
  subtitle: string;
  metric: number;
  metricLabel: string;
  status: string;
  previewUrl?: string | null;
  createdAt: string;
  updatedAt?: string;
  path: string;
  reviewPath?: string;
  author: string;
  tags: string[];
  rejectReason?: string | null;
  reviewAgeHours?: number;
  category?: string | null;
  resolution?: string | null;
  fileSize?: number | null;
  isProcedural?: boolean;
  downloads?: number;
  favorites?: number;
}

export interface ResourceOverview {
  scope?: 'admin' | 'workspace';
  summary: {
    totalPublic: number;
    myItems: number;
    pendingReview: number;
    rejectedReview: number;
    reviewPressure: number;
    readyRate: number;
    libraryCount: number;
    weekAdded: number;
    interactions: number;
    storageMb: number;
  };
  reviewPressure?: {
    scope: 'admin' | 'workspace';
    pending: number;
    rejected: number;
    stale: number;
    staleThresholdHours: number;
    oldestHours: number;
    level: 'none' | 'watch' | 'high';
    message: string;
    ctaPath: string;
  };
  libraries: ResourceLibrary[];
  hotTags: { label: string; count: number }[];
  recentItems: ResourceItem[];
  topItems: ResourceItem[];
  reviewQueue: ResourceItem[];
  generatedAt: string;
}

export interface ResourceFeedMeta {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
  kind: KindFilter;
  status: StatusFilter;
  sort: SortMode;
  query: string;
  scope: 'admin' | 'workspace';
  kindCounts: Record<KindFilter, number>;
  statusCounts: Record<StatusFilter, number>;
}

export interface ResourceFeedResponse {
  items: ResourceItem[];
  meta: ResourceFeedMeta;
}

export const formatResourceNumber = (value: number) =>
  new Intl.NumberFormat('zh-CN', {
    notation: value >= 10000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(value || 0);

export const formatResourceStorage = (value: number) => {
  if (value >= 1024) return `${(value / 1024).toFixed(1)} GB`;
  return `${Math.max(0, value).toFixed(value >= 10 ? 0 : 1)} MB`;
};

export const getResourceTimestamp = (date: string) => {
  const timestamp = new Date(date).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

export const formatResourceTime = (date: string) => {
  const timestamp = getResourceTimestamp(date);
  if (!timestamp) return '-';

  const diff = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days < 30) return `${days} 天前`;
  return new Date(date).toLocaleDateString('zh-CN');
};

export const getResourceStatusLabel = (status: string) => {
  if (status === 'APPROVED') return '已发布';
  if (status === 'REJECTED') return '需修改';
  if (status === 'PENDING') return '审核中';
  return status || '未知';
};

export const getLibraryProgress = (library: ResourceLibrary) => {
  if (!library.mine) return 0;
  const approvedMine = Math.max(0, library.mine - library.pending - library.rejected);
  return Math.min(100, Math.round((approvedMine / library.mine) * 100));
};

export const resourceMatchesQuery = (item: ResourceItem, query: string) => {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  const tags = item.tags || [];
  return (
    item.title.toLowerCase().includes(normalizedQuery) ||
    item.subtitle.toLowerCase().includes(normalizedQuery) ||
    item.author.toLowerCase().includes(normalizedQuery) ||
    tags.some((tag) => tag.toLowerCase().includes(normalizedQuery))
  );
};

export const sortResourceItems = (items: ResourceItem[], sortMode: SortMode) =>
  [...items].sort((a, b) => {
    if (sortMode === 'metric') return b.metric - a.metric;
    if (sortMode === 'title') return a.title.localeCompare(b.title, 'zh-CN');
    if (sortMode === 'created')
      return getResourceTimestamp(b.createdAt) - getResourceTimestamp(a.createdAt);
    if (sortMode === 'review') {
      const priority = (status: string) => {
        if (status === 'REJECTED') return 0;
        if (status === 'PENDING') return 1;
        return 2;
      };
      return (
        priority(a.status) - priority(b.status) ||
        getResourceTimestamp(a.createdAt) - getResourceTimestamp(b.createdAt)
      );
    }
    return (
      getResourceTimestamp(b.updatedAt || b.createdAt) -
      getResourceTimestamp(a.updatedAt || a.createdAt)
    );
  });
