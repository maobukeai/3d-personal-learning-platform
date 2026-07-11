import type { Component } from 'vue';
import { Box, Bone, Grid3X3, Import, Layers, LayoutList, Package, Sun } from 'lucide-vue-next';
/* ------------------------------------------------------------------ * * Domain types * ------------------------------------------------------------------ */ export type SoftwareStatus =
  'PENDING' | 'APPROVED' | 'REJECTED';
export type SortMode = 'latest' | 'popular' | 'name';
export type ViewMode = 'grid' | 'list';
export type LibraryTab = 'explore' | 'favorites' | 'mine' | 'drafts' | 'requests';
export type StatusFilter = 'all' | 'PENDING' | 'APPROVED' | 'REJECTED';
export interface SoftwareUser {
  id?: string;
  name?: string | null;
  avatarUrl?: string | null;
  email?: string | null;
}
export interface SoftwareItem {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string;
  version: string;
  compatibility: string;
  downloads: number;
  fileUrl?: string | null;
  fileSize?: number | null;
  previewUrl?: string | null;
  installGuide: string;
  status: SoftwareStatus;
  rejectReason?: string | null;
  createdAt: string;
  user?: SoftwareUser | null;
  bilibiliUrl?: string | null;
}
export interface SoftwareInsights {
  summary: {
    total: number;
    pending: number;
    myPending?: number;
    downloads: number;
    categories: number;
    favoriteCount: number;
    averageSize: number;
    myUploads?: number;
  };
  categories: { name: string; count: number; downloads: number }[];
  hotTags: { label: string; count: number }[];
  topDownloads: SoftwareItem[];
  latest: SoftwareItem[];
  favoriteIds: string[];
}
export interface StarterSoftwareTemplate {
  title: string;
  description: string;
  category: string;
  compatibility: string;
  tags: string[];
  packageType: string;
  Icon: Component;
  tone: string;
}
export interface MarketplaceSignal {
  title: string;
  description: string;
  Icon: Component;
}
export interface HelpRequest {
  id: string;
  title: string;
  description: string;
  status: 'OPEN' | 'RESOLVED';
  userId: string;
  createdAt: string;
  user: { id: string; name: string; avatarUrl: string | null };
  _count: { replies: number };
}
export interface HelpRequestReply {
  id: string;
  content: string;
  createdAt: string;
  user: { id: string; name: string; avatarUrl: string | null };
  linkedSoftware?: {
    id: string;
    title: string;
    version: string;
    previewUrl: string | null;
    downloads: number;
  } | null;
}
/* ------------------------------------------------------------------ * * Edit form (shared with EditWorkDialog) * ------------------------------------------------------------------ */ export interface EditFormType {
  title: string;
  description: string;
  tags: string;
  categoryId: string;
  materialCategory: string;
  resolution: string;
  isProcedural: boolean;
  pluginCategory: string;
  pluginVersion: string;
  pluginCompatibility: string;
  showcaseType: string;
  videoUrl: string;
  originality: string;
  originalAuthor: string;
  originalLink: string;
  license: string;
  isFree: boolean;
  meshType: string;
  uvUnwrapped: boolean;
  uvOverlapping: boolean;
  pbrChannels: string[];
  rigged: boolean;
  gameReady: boolean;
  linkedCourseId: string;
  linkedLessonId: string;
  installGuide: string;
  file: File | null;
  packageFile: File | null;
  thumbnail: File | null;
  downloadType: 'local' | 'external';
  externalUrl: string;
  extractionCode: string;
  tempAssetPath?: string;
  tempPackagePath?: string;
  tempThumbnailPath?: string;
  tempMaterialPath?: string;
  tempSoftwarePath?: string;
  tempPreviewPath?: string;
  packageFilesList?: string;
  fileSize?: number;
  packageSize?: number;
}
export const createDefaultEditForm = (): EditFormType => ({
  title: '',
  description: '',
  tags: '',
  categoryId: '',
  materialCategory: '',
  resolution: '4K',
  isProcedural: false,
  pluginCategory: '',
  pluginVersion: '1.0.0',
  pluginCompatibility: '',
  showcaseType: 'IMAGE',
  videoUrl: '',
  originality: 'ORIGINAL',
  originalAuthor: '',
  originalLink: '',
  license: 'CC_BY',
  isFree: true,
  meshType: 'LOW_POLY',
  uvUnwrapped: true,
  uvOverlapping: false,
  pbrChannels: [],
  rigged: false,
  gameReady: false,
  linkedCourseId: '',
  linkedLessonId: '',
  installGuide: '',
  file: null,
  packageFile: null,
  thumbnail: null,
  downloadType: 'local',
  externalUrl: '',
  extractionCode: '',
});
/* ------------------------------------------------------------------ * * Category constants + helpers * ------------------------------------------------------------------ */ export const CATEGORY_ALL =
  '全部软件';
export const CATEGORY_OTHER = '其他工具';
const ENGLISH_CATEGORY_LABELS: Record<string, string> = {
  [CATEGORY_ALL]: 'All Softwares',
  [CATEGORY_OTHER]: 'Other Tools',
  '3D 建模与雕刻软件': '3D Modeling & Sculpting',
  渲染引擎与渲染器: 'Rendering Engines',
  后期与图像处理: 'Post & Image Processing',
  游戏与交互引擎: 'Game & Interactive Engines',
};
export const categoryLabel = (category: string | null | undefined, locale: string): string => {
  const normalized = category || CATEGORY_OTHER;
  if (locale === 'en-US') {
    return ENGLISH_CATEGORY_LABELS[normalized] || normalized;
  }
  return normalized;
}; /** Maps a category name to a representative lucide icon. */
export const getCategoryIcon = (category: string): Component => {
  if (category.includes('建模')) return Box;
  if (category.includes('材质')) return Layers;
  if (category.includes('渲染')) return Sun;
  if (category.includes('骨骼')) return Bone;
  if (category.includes('导入')) return Import;
  return Package;
}; /** Maps a category name to a tone token used by category tiles/cards. */
export const getCategoryTone = (category: string): string => {
  if (category === '建模') return 'tone-orange';
  if (category === '材质与纹理') return 'tone-rose';
  if (category === '渲染与灯光') return 'tone-blue';
  if (category === '动画与骨骼') return 'tone-cyan';
  if (category === '导入与导出') return 'tone-emerald';
  if (category === '物理与特效') return 'tone-violet';
  return 'tone-slate';
}; /** View-mode toggle options shared by the toolbar. */
export const buildViewModeOptions = (): { value: ViewMode; label: string; icon: Component }[] => [
  { value: 'grid', label: '', icon: Grid3X3 },
  { value: 'list', label: '', icon: LayoutList },
]; /** Returns a normalized SoftwareItem from a raw API payload. */
export const normalizeSoftware = (
  software: Partial<SoftwareItem> & Record<string, unknown>,
  t: (zh: string, en: string) => string,
): SoftwareItem => ({
  id: String(software.id || crypto.randomUUID()),
  title: String(software.title || t('未命名软件', 'Untitled Software')),
  description: String(software.description || ''),
  category: String(software.category || CATEGORY_OTHER),
  tags: String(software.tags || ''),
  version: String(software.version || '1.0.0').replace(/^v/i, ''),
  compatibility: String(software.compatibility || t('未填写', 'Not specified')),
  downloads: Number(software.downloads || 0),
  fileUrl: typeof software.fileUrl === 'string' ? software.fileUrl : null,
  fileSize: typeof software.fileSize === 'number' ? software.fileSize : null,
  previewUrl: typeof software.previewUrl === 'string' ? software.previewUrl : null,
  installGuide: String(
    software.installGuide || t('作者暂未填写安装说明。', 'No installation guide yet.'),
  ),
  status: (software.status as SoftwareStatus) || 'APPROVED',
  rejectReason: typeof software.rejectReason === 'string' ? software.rejectReason : null,
  createdAt: String(software.createdAt || new Date().toISOString()),
  user: (software.user as SoftwareUser | null | undefined) || null,
  bilibiliUrl: typeof software.bilibiliUrl === 'string' ? software.bilibiliUrl : null,
});
