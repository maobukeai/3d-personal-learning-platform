/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Component } from 'vue';
import { HeartOff, Trash2 } from 'lucide-vue-next';
import type {
  ResourceAction,
  ResourceAdapter,
  ResourceFilterConfig,
  ResourceItem,
  ResourceFetchParams,
} from '@/components/resource/types';
import api from '@/utils/api';
import { parseTags } from '@/utils/tags';
import { resolvePreviewUrl } from './resourceUtils';
import type { AssetInsightCategory, AssetInsights } from './assetLibraryModel';

export type AssetLibraryTab = 'explore' | 'favorites' | 'mine' | 'drafts';

export interface AssetAdapterDeps {
  label: (zh: string, en: string) => string;
  getCategories: () => AssetInsightCategory[];
  getFormats: () => AssetInsights['formats'];
  getFavoriteCategories: () => string[];
}

function mapAssetItem(raw: any): ResourceItem {
  const format = String(raw?.type || raw?.format || 'GLB').toUpperCase();
  const id = raw?.id ?? raw?._id ?? `asset-${format}-${raw?.title ?? ''}`;
  return {
    ...(raw as Record<string, unknown>),
    id,
    authorName: raw?.user?.name ?? '',
    thumbnailUrl: resolvePreviewUrl(raw?.thumbnail ?? null, format),
    tagsList: parseTags(raw?.tags),
    formatLabel: format,
  };
}

export function createAssetAdapter(tab: AssetLibraryTab, deps: AssetAdapterDeps): ResourceAdapter {
  const { label, getCategories, getFormats, getFavoriteCategories } = deps;
  const filters: ResourceFilterConfig[] = [];

  if (tab === 'explore') {
    filters.push({
      key: 'categoryId',
      label: label('分类', 'Category'),
      type: 'select',
      defaultValue: 'all',
      options: [
        { label: label('全部模型', 'All Models'), value: 'all' },
        ...getCategories().map((c) => ({ label: c.name, value: c.id })),
      ],
    });
    filters.push({
      key: 'format',
      label: label('格式', 'Format'),
      type: 'select',
      defaultValue: 'all',
      options: [
        { label: label('全部格式', 'All Formats'), value: 'all' },
        ...getFormats().map((f) => ({ label: f.label.toUpperCase(), value: f.label })),
      ],
    });
  }

  if (tab === 'favorites') {
    filters.push({
      key: 'favoriteCategory',
      label: label('收藏分类', 'Folder'),
      type: 'select',
      defaultValue: 'all',
      options: [
        { label: label('全部收藏', 'All Favorites'), value: 'all' },
        ...getFavoriteCategories().map((c) => ({ label: c, value: c })),
      ],
    });
  }

  if (tab === 'mine') {
    filters.push({
      key: 'status',
      label: label('状态', 'Status'),
      type: 'select',
      defaultValue: 'all',
      options: [
        { label: label('全部状态', 'All Statuses'), value: 'all' },
        { label: label('待审核', 'Pending'), value: 'PENDING' },
        { label: label('已发布', 'Approved'), value: 'APPROVED' },
        { label: label('未通过', 'Rejected'), value: 'REJECTED' },
      ],
    });
  }

  const sortOptions = [
    { label: label('最新发布', 'Newest'), value: 'latest' },
    { label: label('下载最多', 'Most Downloaded'), value: 'popular' },
    { label: label('浏览最多', 'Most Viewed'), value: 'views' },
    { label: label('体积最大', 'Largest'), value: 'size' },
    { label: label('最早发布', 'Oldest'), value: 'oldest' },
  ];

  const actions: ResourceAction[] = [];
  const bulkActions: ResourceAction[] = [];

  if (tab === 'favorites') {
    bulkActions.push({
      id: 'unfavorite',
      label: label('取消收藏', 'Unfavorite'),
      icon: HeartOff as unknown as Component,
      variant: 'danger',
      handler: () => {},
    });
  }

  if (tab === 'mine' || tab === 'drafts') {
    bulkActions.push({
      id: 'delete',
      label: label('删除', 'Delete'),
      icon: Trash2 as unknown as Component,
      variant: 'danger',
      handler: () => {},
    });
  }

  const titleMap: Record<AssetLibraryTab, { title: string; singular: string }> = {
    explore: { title: label('模型库', 'Assets'), singular: label('资源', 'Asset') },
    favorites: { title: label('我的收藏', 'Favorites'), singular: label('资源', 'Asset') },
    mine: { title: label('我的模型', 'My Uploads'), singular: label('资源', 'Asset') },
    drafts: { title: label('草稿箱', 'Drafts'), singular: label('资源', 'Asset') },
  };

  return {
    type: 'asset',
    title: titleMap[tab].title,
    singularTitle: titleMap[tab].singular,
    card: {
      titleKey: 'title',
      subtitleKey: 'authorName',
      imageKey: 'thumbnailUrl',
      statusKey: 'status',
      metricKey: 'downloads',
      metricLabel: label('下载', 'downloads'),
      tagsKey: 'tagsList',
      fields: [{ key: 'formatLabel', label: label('格式', 'Format'), type: 'badge' }],
    },
    filters,
    sortOptions,
    defaultSort: 'latest',
    actions,
    bulkActions,
    fetch: async (params: ResourceFetchParams) => {
      const apiParams: Record<string, unknown> = {
        page: params.page,
        limit: params.pageSize,
      };
      if (params.search) apiParams.search = params.search;
      if (params.sort) apiParams.sort = params.sort;

      if (tab === 'mine' || tab === 'drafts') apiParams.mine = 'true';
      if (tab === 'favorites') apiParams.favoritesOnly = 'true';
      if (tab === 'drafts') apiParams.status = 'PENDING';

      const f = params.filters ?? {};
      if (f.categoryId && f.categoryId !== 'all') apiParams.categoryId = f.categoryId;
      if (f.format && f.format !== 'all') apiParams.format = f.format;
      if (f.favoriteCategory && f.favoriteCategory !== 'all') {
        apiParams.favoriteCategory = f.favoriteCategory;
      }
      if (tab === 'mine' && f.status && f.status !== 'all') {
        apiParams.status = f.status;
      }

      const { data } = await api.get('/api/assets/public', { params: apiParams });
      const items: ResourceItem[] = (data?.assets ?? []).map(mapAssetItem);
      return { items, total: data?.pagination?.total ?? 0 };
    },
    delete: async (ids: (string | number)[]) => {
      await api.post('/api/assets/bulk-delete', { ids });
    },
  };
}
