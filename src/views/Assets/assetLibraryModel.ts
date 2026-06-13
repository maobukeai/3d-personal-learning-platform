import type { Asset, Category } from '@/types';
import { parseTags, resolvePreviewUrl } from './resourceUtils';

export type AssetViewMode = 'grid' | 'list';
export type AssetSortKey = 'latest' | 'oldest' | 'popular' | 'views' | 'size';
export type AssetFilterKey = 'category' | 'format' | 'tag' | 'search';

export type AssetListItem = Asset & {
  tags?: string | string[] | null;
  category?: Category | null;
  user?: {
    id?: string;
    name?: string | null;
    avatarUrl?: string | null;
  } | null;
};

export interface AssetInsightCategory {
  id: string;
  name: string;
  count: number;
}

export interface AssetInsights {
  summary: {
    total: number;
    downloads: number;
    views: number;
    likes: number;
    myLikes: number;
    myUploads: number;
    pending: number;
    animated: number;
    optimized: number;
    totalSize: number;
    averageSize: number;
  };
  categories: AssetInsightCategory[];
  formats: { label: string; count: number }[];
  hotTags: { label: string; count: number; searchCount?: number }[];
  topDownloads: AssetListItem[];
  latest: AssetListItem[];
}

export interface AssetPagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AssetUploadForm {
  uploadType: 'file' | 'link';
  title: string;
  description: string;
  categoryId: string;
  file: File | null;
  externalUrl: string;
  thumbnail: File | null;
  tags: string;
  formats: string[];
}

export interface NormalizedAsset extends AssetListItem {
  format: string;
  sizeMb: number;
  tags: string[];
  author: string;
  categoryName: string;
  preview: string;
  downloads: number;
  likes: number;
  views: number;
}

export interface AssetFilterChip {
  key: AssetFilterKey;
  label: string;
}

export const ASSET_UPLOAD_FORMAT_OPTIONS = [
  'FBX',
  'OBJ',
  'BLEND',
  'MAX',
  'C4D',
  'MAYA',
  'ZTL',
  'SPP',
  'Textures',
];

export const createAssetUploadForm = (): AssetUploadForm => ({
  uploadType: 'file',
  title: '',
  description: '',
  categoryId: '',
  file: null,
  externalUrl: '',
  thumbnail: null,
  tags: '',
  formats: [],
});

export const buildAssetCategoryOptions = (
  categories: AssetInsightCategory[],
  insights: AssetInsights | null,
  paginationTotal: number,
  allLabel: string,
) => [
  { id: 'all', name: allLabel, count: insights?.summary.total || paginationTotal },
  ...categories,
];

export const buildAssetFormatOptions = (insights: AssetInsights | null) => [
  { label: 'all', count: insights?.summary.total || 0 },
  ...(insights?.formats || []),
];

export const normalizeAsset = (
  asset: AssetListItem,
  labels: { creatorLabel: string; uncategorizedLabel: string },
): NormalizedAsset => {
  const format = (asset.type || asset.format || 'GLB').toUpperCase();
  return {
    ...asset,
    format,
    sizeMb: Number(asset.size || asset.fileSize || 0),
    tags: parseTags(asset.tags),
    author: asset.user?.name || labels.creatorLabel,
    categoryName: asset.category?.name || labels.uncategorizedLabel,
    preview: resolvePreviewUrl(asset.thumbnail, format),
    downloads: asset.downloads || 0,
    likes: asset.likes || 0,
    views: asset.viewCount || 0,
  };
};

export const filterVisibleAssets = (
  assets: AssetListItem[],
  filters: { selectedFormat: string; selectedTag: string },
  labels: { creatorLabel: string; uncategorizedLabel: string },
) => {
  let list = assets.map((asset) => normalizeAsset(asset, labels));
  if (filters.selectedFormat !== 'all') {
    list = list.filter((asset) => asset.format === filters.selectedFormat);
  }
  if (filters.selectedTag !== 'all') {
    list = list.filter((asset) => asset.tags.includes(filters.selectedTag));
  }
  return list;
};

export const buildActiveAssetFilterChips = (options: {
  activeCategoryId: string;
  categoryOptions: AssetInsightCategory[];
  currentCategoryLabel: string;
  selectedFormat: string;
  selectedTag: string;
  searchQuery: string;
}): AssetFilterChip[] => {
  const chips: AssetFilterChip[] = [];
  if (options.activeCategoryId !== 'all') {
    const category = options.categoryOptions.find((item) => item.id === options.activeCategoryId);
    chips.push({ key: 'category', label: category?.name || options.currentCategoryLabel });
  }
  if (options.selectedFormat !== 'all') {
    chips.push({ key: 'format', label: options.selectedFormat });
  }
  if (options.selectedTag !== 'all') {
    chips.push({ key: 'tag', label: `#${options.selectedTag}` });
  }
  const query = options.searchQuery.trim();
  if (query) {
    chips.push({ key: 'search', label: query });
  }
  return chips;
};

export const isAssetUploadReady = (form: AssetUploadForm) => {
  const hasSource =
    form.uploadType === 'file' ? Boolean(form.file) : Boolean(form.externalUrl.trim());
  return hasSource && Boolean(form.title.trim()) && Boolean(form.categoryId);
};

export const buildAssetUploadFormData = (form: AssetUploadForm) => {
  const formData = new FormData();
  if (form.uploadType === 'file') {
    formData.append('asset', form.file as File);
  } else {
    formData.append('externalUrl', form.externalUrl.trim());
  }
  if (form.thumbnail) {
    formData.append('thumbnail', form.thumbnail);
  }
  formData.append('title', form.title.trim());
  formData.append('description', form.description);
  formData.append('categoryId', form.categoryId);
  formData.append('tags', form.tags);
  if (form.formats.length) {
    formData.append('formats', JSON.stringify(form.formats));
  }
  return formData;
};
