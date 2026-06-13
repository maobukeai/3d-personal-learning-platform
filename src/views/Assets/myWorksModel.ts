import { parseTags, resolvePreviewUrl } from './resourceUtils';

export type WorkKind = 'asset' | 'material' | 'plugin' | 'showcase';
export type WorkStatus = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED';
export type WorkViewMode = 'grid' | 'list';
export type WorkSortKey = 'newest' | 'oldest' | 'name' | 'status';

export interface CategoryType {
  id: string;
  name: string;
}

export interface AssetWork {
  id: string;
  title: string;
  description?: string | null;
  type: string;
  url: string;
  thumbnail?: string | null;
  size?: number | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectReason?: string | null;
  categoryId?: string | null;
  category?: { id?: string; name: string } | null;
  tags?: string | null;
  downloads?: number;
  viewCount?: number;
  createdAt: string;
}

export interface MaterialWork {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  resolution?: string | null;
  previewUrl?: string | null;
  fileUrl?: string | null;
  fileSize?: number | null;
  tags?: string | null;
  isProcedural?: boolean;
  downloads?: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectReason?: string | null;
  createdAt: string;
  _count?: { favorites?: number };
}

export interface PluginWork {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  version?: string | null;
  compatibility?: string | null;
  tags?: string | null;
  fileUrl?: string | null;
  fileSize?: number | null;
  previewUrl?: string | null;
  installGuide?: string | null;
  downloads?: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectReason?: string | null;
  createdAt: string;
}

export interface ShowcaseWork {
  id: string;
  title: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  videoUrl?: string | null;
  tags?: string | null;
  type?: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectReason?: string | null;
  assetId?: string | null;
  views?: number;
  createdAt: string;
  _count?: { likes?: number; comments?: number };
}

export type RawWork = AssetWork | MaterialWork | PluginWork | ShowcaseWork;

export interface UnifiedWork {
  uid: string;
  id: string;
  kind: WorkKind;
  title: string;
  description: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectReason?: string | null;
  surface: string;
  typeLabel: string;
  format: string;
  thumbnail: string;
  size: number;
  metric: number;
  metricLabel: string;
  tags: string[];
  createdAt: string;
  raw: RawWork;
}

export interface WorkbenchSummary {
  total: number;
  approved: number;
  pending: number;
  rejected: number;
  totalSize: number;
  totalReach: number;
  readyRate: number;
  needsAction: number;
  generatedAt?: string;
}

export interface WorkStats {
  total: number;
  approved: number;
  pending: number;
  rejected: number;
  totalSize: number;
  totalReach: number;
}

export const MATERIAL_CATEGORIES = ['金属', '木纹', '石材', '织物', '程序化', '玻璃', '其他'];

export const PLUGIN_CATEGORIES = [
  'Blender 插件',
  'Three.js 插件',
  'Substance 工具',
  '游戏引擎插件',
  'Photoshop 脚本',
  '其他工具',
];

export function getShowcaseTypeLabel(type: string) {
  if (type === 'MODEL') return '模型展示';
  if (type === 'VIDEO') return '视频作品';
  if (type === 'TEXT') return '图文作品';
  if (type === 'IMAGE') return '图片作品';
  return '创意作品';
}

export function getWorkStatusLabel(status: string) {
  if (status === 'APPROVED') return '已通过';
  if (status === 'REJECTED') return '未通过';
  return '待审核';
}

export function getWorkStatusWeight(status: string) {
  if (status === 'PENDING') return 0;
  if (status === 'REJECTED') return 1;
  return 2;
}

export function getWorkTimestamp(date: string) {
  const timestamp = new Date(date).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function normalizeAssetWork(item: AssetWork): UnifiedWork {
  const format = (item.type || 'GLB').toUpperCase();
  return {
    uid: `asset:${item.id}`,
    id: item.id,
    kind: 'asset',
    title: item.title,
    description: item.description || '',
    status: item.status,
    rejectReason: item.rejectReason,
    surface: '资源库',
    typeLabel: item.category?.name || '3D 资源',
    format,
    thumbnail: resolvePreviewUrl(item.thumbnail, format),
    size: Number(item.size || 0),
    metric: item.downloads || item.viewCount || 0,
    metricLabel: item.downloads ? '下载' : '浏览',
    tags: parseTags(item.tags || item.category?.name || ''),
    createdAt: item.createdAt,
    raw: item,
  };
}

export function normalizeMaterialWork(item: MaterialWork): UnifiedWork {
  return {
    uid: `material:${item.id}`,
    id: item.id,
    kind: 'material',
    title: item.title,
    description: item.description || '',
    status: item.status,
    rejectReason: item.rejectReason,
    surface: '材料库',
    typeLabel: item.isProcedural ? '程序化材质' : item.category || '材质贴图',
    format: item.resolution || '材料',
    thumbnail: resolvePreviewUrl(item.previewUrl, 'STL'),
    size: Number(item.fileSize || 0),
    metric: item._count?.favorites || item.downloads || 0,
    metricLabel: item._count?.favorites ? '收藏' : '下载',
    tags: parseTags(item.tags || item.category || ''),
    createdAt: item.createdAt,
    raw: item,
  };
}

export function normalizePluginWork(item: PluginWork): UnifiedWork {
  return {
    uid: `plugin:${item.id}`,
    id: item.id,
    kind: 'plugin',
    title: item.title,
    description: item.description || '',
    status: item.status,
    rejectReason: item.rejectReason,
    surface: '插件库',
    typeLabel: item.category || '插件',
    format: item.version ? `v${String(item.version).replace(/^v/i, '')}` : '插件',
    thumbnail: resolvePreviewUrl(item.previewUrl, 'GLB'),
    size: Number(item.fileSize || 0),
    metric: item.downloads || 0,
    metricLabel: '下载',
    tags: parseTags(item.tags || ''),
    createdAt: item.createdAt,
    raw: item,
  };
}

export function normalizeShowcaseWork(item: ShowcaseWork): UnifiedWork {
  return {
    uid: `showcase:${item.id}`,
    id: item.id,
    kind: 'showcase',
    title: item.title,
    description: item.description || '',
    status: item.status,
    rejectReason: item.rejectReason,
    surface: '作品展示',
    typeLabel: getShowcaseTypeLabel(item.type || 'OTHER'),
    format: item.type || 'SHOW',
    thumbnail: resolvePreviewUrl(item.thumbnailUrl, 'GLB'),
    size: 0,
    metric: item._count?.likes || item.views || 0,
    metricLabel: item._count?.likes ? '点赞' : '浏览',
    tags: parseTags(item.tags || ''),
    createdAt: item.createdAt,
    raw: item,
  };
}

export function normalizeWorkbenchWorks(sources: {
  assets: AssetWork[];
  materials: MaterialWork[];
  plugins: PluginWork[];
  showcases: ShowcaseWork[];
}) {
  return [
    ...sources.assets.map(normalizeAssetWork),
    ...sources.materials.map(normalizeMaterialWork),
    ...sources.plugins.map(normalizePluginWork),
    ...sources.showcases.map(normalizeShowcaseWork),
  ];
}

export function filterAndSortWorks(
  works: UnifiedWork[],
  filters: {
    searchQuery: string;
    sourceFilter: 'ALL' | WorkKind;
    statusFilter: WorkStatus;
    sortBy: WorkSortKey;
  },
) {
  const query = filters.searchQuery.trim().toLowerCase();
  const list = works.filter((work) => {
    const matchesSource = filters.sourceFilter === 'ALL' || work.kind === filters.sourceFilter;
    const matchesStatus = filters.statusFilter === 'ALL' || work.status === filters.statusFilter;
    const matchesQuery =
      !query ||
      work.title.toLowerCase().includes(query) ||
      work.description.toLowerCase().includes(query) ||
      work.tags.some((tag) => tag.toLowerCase().includes(query)) ||
      work.surface.toLowerCase().includes(query);
    return matchesSource && matchesStatus && matchesQuery;
  });

  return [...list].sort((a, b) => {
    if (filters.sortBy === 'oldest') return getWorkTimestamp(a.createdAt) - getWorkTimestamp(b.createdAt);
    if (filters.sortBy === 'name') return a.title.localeCompare(b.title, 'zh-CN');
    if (filters.sortBy === 'status') return getWorkStatusWeight(a.status) - getWorkStatusWeight(b.status);
    return getWorkTimestamp(b.createdAt) - getWorkTimestamp(a.createdAt);
  });
}

export function calculateWorkStats(works: UnifiedWork[]): WorkStats {
  const total = works.length;
  const approved = works.filter((work) => work.status === 'APPROVED').length;
  const pending = works.filter((work) => work.status === 'PENDING').length;
  const rejected = works.filter((work) => work.status === 'REJECTED').length;
  const totalSize = works.reduce((sum, work) => sum + work.size, 0);
  const totalReach = works.reduce((sum, work) => sum + work.metric, 0);
  return { total, approved, pending, rejected, totalSize, totalReach };
}

export function getReviewCompletion(stats: WorkStats) {
  return stats.total > 0 ? Math.round((stats.approved / stats.total) * 100) : 100;
}
