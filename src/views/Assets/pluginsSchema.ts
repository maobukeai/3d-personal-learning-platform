import type { Component } from 'vue';
import { Box, Bone, Import, Layers, Package, Puzzle, Sun } from 'lucide-vue-next';
export type PluginStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type SortMode = 'latest' | 'popular' | 'name';
export type ViewMode = 'grid' | 'list';
export type LibraryTab = 'explore' | 'favorites' | 'mine' | 'drafts' | 'requests';
export type StatusFilter = 'all' | 'PENDING' | 'APPROVED' | 'REJECTED';
export const CATEGORY_ALL = '全部插件';
export const CATEGORY_OTHER =
  '其他工具'; /** English labels keyed by the canonical (Chinese) category name. */
export const ENGLISH_CATEGORY_LABELS: Record<string, string> = {
  [CATEGORY_ALL]: 'All Add-ons',
  [CATEGORY_OTHER]: 'Other Utilities',
  建模: 'Modeling',
  材质与纹理: 'Materials & Texturing',
  渲染与灯光: 'Rendering & Lighting',
  动画与骨骼: 'Animation & Rigging',
  导入与导出: 'Import & Export',
  物理与特效: 'Physics & FX',
};
export interface PluginUser {
  id?: string;
  name?: string | null;
  avatarUrl?: string | null;
  email?: string | null;
}
export interface PluginItem {
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
  status: PluginStatus;
  rejectReason?: string | null;
  createdAt: string;
  user?: PluginUser | null;
  bilibiliUrl?: string | null;
}
export interface PluginInsights {
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
  topDownloads: PluginItem[];
  latest: PluginItem[];
  favoriteIds: string[];
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
  linkedPlugin?: {
    id: string;
    title: string;
    version: string;
    previewUrl: string | null;
    downloads: number;
  } | null;
}
export interface EditFormType {
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
  tempPluginPath?: string;
  tempPreviewPath?: string;
  packageFilesList?: string;
  fileSize?: number;
  packageSize?: number;
}
export function createDefaultEditForm(): EditFormType {
  return {
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
  };
}
const CATEGORY_ICONS: Array<{ key: string; Icon: Component }> = [
  { key: '建模', Icon: Box },
  { key: '材质', Icon: Layers },
  { key: '渲染', Icon: Sun },
  { key: '骨骼', Icon: Bone },
  { key: '导入', Icon: Import },
];
const CATEGORY_TONES: Record<string, string> = {
  建模: 'tone-orange',
  材质与纹理: 'tone-rose',
  渲染与灯光: 'tone-blue',
  动画与骨骼: 'tone-cyan',
  导入与导出: 'tone-emerald',
  物理与特效: 'tone-violet',
};
export const ALL_CATEGORY_ICON = Puzzle; /** Match the original substring-based icon resolution. */
export function getCategoryIcon(category: string): Component {
  const hit = CATEGORY_ICONS.find((entry) => category.includes(entry.key));
  return hit ? hit.Icon : Package;
}
export function getCategoryTone(category: string): string {
  return CATEGORY_TONES[category] || 'tone-slate';
}
