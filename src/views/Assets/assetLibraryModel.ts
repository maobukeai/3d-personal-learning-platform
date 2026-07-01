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
  packageFile: File | null;
  externalUrl: string;
  thumbnail: File | null;
  tags: string;
  formats: string[];
  // Copyright
  originality: 'ORIGINAL' | 'AUTHORIZED' | 'REMIX';
  originalAuthor: string;
  originalLink: string;
  license: string;
  // Specs
  meshType: 'LOW_POLY' | 'HIGH_POLY' | 'CAD';
  uvUnwrapped: boolean;
  uvOverlapping: boolean;
  pbrChannels: string[];
  rigged: boolean;
  gameReady: boolean;
  // Relations
  linkedCourseId: string;
  linkedLessonId: string;
  isFree: boolean;
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
  packageFile: null,
  externalUrl: '',
  thumbnail: null,
  tags: '',
  formats: [],
  // Copyright
  originality: 'ORIGINAL',
  originalAuthor: '',
  originalLink: '',
  license: 'CC_BY',
  // Specs
  meshType: 'LOW_POLY',
  uvUnwrapped: true,
  uvOverlapping: false,
  pbrChannels: [],
  rigged: false,
  gameReady: false,
  // Relations
  linkedCourseId: '',
  linkedLessonId: '',
  isFree: true,
});

export const ASSET_ORIGINALITY_OPTIONS = [
  { value: 'ORIGINAL', label_zh: '原创作品', label_en: 'Original' },
  { value: 'AUTHORIZED', label_zh: '授权分享', label_en: 'Authorized Share' },
  { value: 'REMIX', label_zh: '二次创作/改编', label_en: 'Remix/Adaptation' },
] as const;

export const ASSET_LICENSE_OPTIONS = [
  { value: 'CC_BY', label_zh: 'CC BY (署名)', label_en: 'CC BY (Attribution)' },
  {
    value: 'CC_BY_NC',
    label_zh: 'CC BY-NC (署名-非商业性使用)',
    label_en: 'CC BY-NC (Non-Commercial)',
  },
  {
    value: 'CC_BY_ND',
    label_zh: 'CC BY-ND (署名-禁止演绎)',
    label_en: 'CC BY-ND (No Derivatives)',
  },
  {
    value: 'CC_BY_NC_ND',
    label_zh: 'CC BY-NC-ND (署名-非商业使用-禁止演绎)',
    label_en: 'CC BY-NC-ND (NC-ND)',
  },
  { value: 'PROPRIETARY', label_zh: '专有商业授权/保护', label_en: 'Proprietary Commercial' },
  {
    value: 'PUBLIC_DOMAIN',
    label_zh: '公有领域 (CC0 / 放弃版权)',
    label_en: 'Public Domain (CC0)',
  },
] as const;

export const ASSET_MESHTYPE_OPTIONS = [
  { value: 'LOW_POLY', label_zh: 'Low-Poly (低模/游戏优化)', label_en: 'Low-Poly' },
  { value: 'HIGH_POLY', label_zh: 'High-Poly (高模/影视渲染)', label_en: 'High-Poly' },
  { value: 'CAD', label_zh: 'CAD (工业模型/结构)', label_en: 'CAD/Industrial' },
] as const;

export const ASSET_PBR_MAPS_OPTIONS = [
  'BaseColor',
  'Normal',
  'Roughness',
  'Metallic',
  'AO',
  'Specular',
  'Glossiness',
  'Emissive',
  'Opacity',
] as const;

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

export const isAssetUploadReady = (form: AssetUploadForm, isEditing = false) => {
  if (!isEditing) {
    if (form.uploadType === 'file') {
      if (!form.file) return false;
      const name = form.file.name.toLowerCase();
      if (!name.endsWith('.glb')) return false;
    } else {
      if (!form.externalUrl.trim()) return false;
    }
  } else {
    if (form.uploadType === 'file' && form.file) {
      const name = form.file.name.toLowerCase();
      if (!name.endsWith('.glb')) return false;
    } else if (form.uploadType === 'link') {
      if (!form.externalUrl.trim()) return false;
    }
  }
  if (form.packageFile) {
    const pkgName = form.packageFile.name.toLowerCase();
    if (!pkgName.endsWith('.zip')) return false;
  }
  return Boolean(form.title.trim()) && Boolean(form.categoryId);
};

export const buildAssetUploadFormData = (form: AssetUploadForm) => {
  const formData = new FormData();
  if (form.uploadType === 'file') {
    formData.append('asset', form.file as File);
    if (form.packageFile) {
      formData.append('package', form.packageFile);
    }
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
  // Copyright
  formData.append('originality', form.originality);
  formData.append('originalAuthor', form.originalAuthor.trim());
  formData.append('originalLink', form.originalLink.trim());
  formData.append('license', form.license);
  // Specs
  formData.append('meshType', form.meshType);
  formData.append('uvUnwrapped', String(form.uvUnwrapped));
  formData.append('uvOverlapping', String(form.uvOverlapping));
  if (form.pbrChannels.length) {
    formData.append('pbrChannels', JSON.stringify(form.pbrChannels));
  }
  formData.append('rigged', String(form.rigged));
  formData.append('gameReady', String(form.gameReady));
  if (form.linkedCourseId) {
    formData.append('linkedCourseId', form.linkedCourseId);
  }
  if (form.linkedLessonId) {
    formData.append('linkedLessonId', form.linkedLessonId);
  }
  formData.append('isFree', String(form.isFree));
  return formData;
};
