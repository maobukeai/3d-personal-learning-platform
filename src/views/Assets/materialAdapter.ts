/* eslint-disable @typescript-eslint/no-explicit-any */
/** * Material resource adapter — bridges the materials API to the schema-driven * `ResourceListPage`. Mirrors the asset adapter pattern; independent of it. * * The adapter is created via `createMaterialAdapter(deps)` so the fetch * closure can read live wrapper state (active scope, favorite folder, status * sub-filter) at call time without rebuilding the whole object. */
import { Download, Heart, Trash2, UploadCloud } from 'lucide-vue-next';
import api from '@/utils/api';
import { parseTags, resolvePreviewUrl } from './resourceUtils';
import type {
  ResourceAdapter,
  ResourceItem,
  ResourceFetchParams,
} from '@/components/resource/types';
export type MaterialStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type MaterialScope = 'explore' | 'favorites' | 'mine' | 'drafts';
export type MyStatusFilter = 'all' | MaterialStatus;
export interface MaterialItem extends ResourceItem {
  id: string;
  title?: string | null;
  description?: string | null;
  category?: string | null;
  tags?: string | string[] | null;
  fileUrl?: string | null;
  previewUrl?: string | null;
  downloads?: number;
  fileSize?: number | null;
  resolution?: string | null;
  isProcedural?: boolean;
  createdAt?: string;
  updatedAt?: string;
  status?: MaterialStatus;
  rejectReason?: string | null;
  userId?: string;
  isFavorited?: boolean;
  originality?: string;
  originalAuthor?: string | null;
  originalLink?: string | null;
  license?: string;
  isFree?: boolean;
  linkedCourseId?: string;
  linkedLessonId?: string;
  bilibiliUrl?: string | null;
  _count?: { favorites?: number };
  user?: {
    id?: string;
    name?: string | null;
    email?: string | null;
    avatarUrl?: string | null;
  } | null;
}
export interface NormalizedMaterial extends MaterialItem {
  title: string;
  description: string;
  category: string;
  tags: string[];
  preview: string;
  downloads: number;
  fileSize: number;
  resolution: string;
  favorites: number;
  status: MaterialStatus;
}
export interface MaterialInsights {
  summary: {
    total: number;
    downloads: number;
    favorites: number;
    myFavorites: number;
    myUploads: number;
    myPending?: number;
    myApproved?: number;
    myRejected?: number;
    pending: number;
    procedural: number;
    averageSize: number;
  };
  categories: { name: string; count: number; downloads: number }[];
  resolutions: { label: string; count: number }[];
  hotTags: { label: string; count: number }[];
}
export interface MaterialAdapterDeps {
  label: (zh: string, en: string) => string;
  getLocale: () => string;
  getScope: () => MaterialScope;
  getFavoriteCategory: () => string;
  getMyStatus: () => MyStatusFilter;
  /** Configured + DB-sourced category names (without the synthetic "all"). */ categoryNames: () => string[];
}
const RESOLUTION_OPTIONS = ['8K', '4K', '2K', '1K'];
const CATEGORY_LABEL_MAP: Record<string, string> = {
  金属: 'Metal',
  木纹: 'Wood',
  石材: 'Stone',
  织物: 'Fabric',
  程序化: 'Procedural',
  玻璃: 'Glass',
  其他: 'Other',
};
export function categoryLabel(name: string, locale: string): string {
  if (locale === 'en-US') return CATEGORY_LABEL_MAP[name] || name;
  return name;
}
export function normalizeMaterial(
  material: MaterialItem,
  labelFn: (zh: string, en: string) => string,
): NormalizedMaterial {
  return {
    ...material,
    title: material.title || labelFn('未命名材料', 'Untitled Material'),
    description: material.description || '',
    category: material.category || labelFn('其他', 'Other'),
    resolution: material.resolution || labelFn('未标注', 'Unlabeled'),
    preview: resolvePreviewUrl(material.previewUrl, 'STL'),
    tags: parseTags(material.tags),
    favorites: material._count?.favorites || 0,
    downloads: material.downloads || 0,
    fileSize: material.fileSize || 0,
    status: material.status || 'APPROVED',
  };
} /** Parse the /api/materials list response into { items, total }. */
function parseMaterialList(data: unknown): { items: MaterialItem[]; total: number } {
  if (Array.isArray(data)) return { items: data as MaterialItem[], total: data.length };
  if (data && typeof data === 'object') {
    const obj = data as any;
    const items: MaterialItem[] = Array.isArray(obj.items)
      ? obj.items
      : Array.isArray(obj.materials)
        ? obj.materials
        : [];
    const total = obj.meta?.total ?? obj.total ?? obj.pagination?.total ?? items.length;
    return { items, total };
  }
  return { items: [], total: 0 };
}
export function createMaterialAdapter(
  deps: MaterialAdapterDeps,
): ResourceAdapter<NormalizedMaterial> {
  const { label, getLocale, getScope, getFavoriteCategory, getMyStatus, categoryNames } = deps;
  const filters = [
    {
      key: 'category',
      label: label('分类', 'Category'),
      type: 'select' as const,
      defaultValue: 'all',
      options: [
        { label: label('全部', 'All'), value: 'all' },
        ...categoryNames().map((name) => ({
          label: categoryLabel(name, getLocale()),
          value: name,
        })),
      ],
    },
    {
      key: 'resolution',
      label: label('分辨率', 'Resolution'),
      type: 'select' as const,
      defaultValue: 'all',
      options: [
        { label: label('全部', 'All'), value: 'all' },
        ...RESOLUTION_OPTIONS.map((r) => ({ label: r, value: r })),
      ],
    },
    {
      key: 'procedural',
      label: label('类型', 'Type'),
      type: 'select' as const,
      defaultValue: 'all',
      options: [
        { label: label('全部', 'All'), value: 'all' },
        { label: label('程序化', 'Procedural'), value: 'true' },
        { label: label('贴图包', 'Texture Pack'), value: 'false' },
      ],
    },
    { key: 'tag', label: label('标签', 'Tag'), type: 'text' as const },
  ];
  return {
    type: 'material',
    title: label('材料', 'Materials'),
    singularTitle: label('材料', 'Material'),
    card: {
      titleKey: 'title',
      subtitleKey: 'category',
      imageKey: 'preview',
      statusKey: 'status',
      metricKey: 'downloads',
      metricLabel: label('下载', 'downloads'),
      tagsKey: 'tags',
      fields: [{ key: 'resolution', label: label('分辨率', 'Res'), type: 'badge' as const }],
    },
    filters,
    sortOptions: [
      { label: label('最新', 'Latest'), value: 'latest' },
      { label: label('最热', 'Popular'), value: 'popular' },
      { label: label('收藏最多', 'Most Favorited'), value: 'favorited' },
      { label: label('最大', 'Largest'), value: 'largest' },
      { label: label('最小', 'Smallest'), value: 'smallest' },
    ],
    defaultSort: 'latest',
    actions: [
      {
        id: 'create',
        label: label('上传材质', 'Upload Material'),
        icon: UploadCloud,
        variant: 'primary',
        permission: 'create',
        handler: () => {},
      },
    ],
    bulkActions: [
      {
        id: 'favorite',
        label: label('收藏', 'Favorite'),
        icon: Heart,
        variant: 'secondary',
        requireSelection: true,
        handler: () => {},
      },
      {
        id: 'download',
        label: label('下载', 'Download'),
        icon: Download,
        variant: 'secondary',
        requireSelection: true,
        handler: () => {},
      },
      {
        id: 'delete',
        label: label('删除', 'Delete'),
        icon: Trash2,
        variant: 'danger',
        requireSelection: true,
        permission: 'delete',
        handler: () => {},
      },
    ],
    can: () => true,
    fetch: async (params: ResourceFetchParams) => {
      const scope = getScope();
      const favCat = getFavoriteCategory();
      const myStatus = getMyStatus();
      const f = params.filters || {};
      const apiParams: Record<string, unknown> = {
        category: (f.category as string) || 'all',
        sort: params.sort || 'latest',
        search: params.search || undefined,
        resolution: (f.resolution as string) || 'all',
        tag: (f.tag as string) || undefined,
        procedural: !f.procedural || f.procedural === 'all' ? undefined : f.procedural,
        favoritesOnly: scope === 'favorites' ? 'true' : undefined,
        favoriteCategory: scope === 'favorites' && favCat && favCat !== 'all' ? favCat : undefined,
        mine: scope === 'mine' || scope === 'drafts' ? 'true' : undefined,
        status:
          scope === 'drafts'
            ? 'PENDING'
            : scope === 'mine' && myStatus !== 'all'
              ? myStatus
              : undefined,
        page: params.page,
        pageSize: params.pageSize,
        paginated: 'true',
      };
      const { data } = await api.get('/api/materials', { params: apiParams });
      const { items, total } = parseMaterialList(data);
      return { items: items.map((m) => normalizeMaterial(m, label)), total };
    },
    delete: async (ids: (string | number)[]) => {
      await api.post('/api/materials/bulk-delete', { ids });
    },
  };
}
