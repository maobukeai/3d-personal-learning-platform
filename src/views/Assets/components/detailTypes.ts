/** * Shared DTO / schema types for the UnifiedDetailModal family of section * components. Extracted from UnifiedDetailModal.vue so that the container and * each Detail* section can reference the same shapes without re-declaring them. */ export interface PluginUser {
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
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectReason?: string | null;
  createdAt: string;
  user?: PluginUser | null;
  originality?: string;
  originalAuthor?: string | null;
  originalLink?: string | null;
  license?: string;
  isFree?: boolean;
  linkedCourseId?: string | null;
  linkedLessonId?: string | null;
  linkedCourse?: { id: string; title: string } | null;
  linkedLesson?: { id: string; title: string } | null;
  bilibiliUrl?: string | null;
  developerToken?: string | null;
  kind?: 'plugin' | 'software';
  packageFilesList?: string | string[] | null;
} /** Shape of a single discussion comment returned by useResourceComments. */
export interface CommentItem {
  id: string;
  content: string;
  createdAt: string;
  user?: { id?: string; name?: string | null; avatarUrl?: string | null } | null;
} /** Reactive form model shared between the container and version edit UI. */
export interface VersionForm {
  version: string;
  changelog: string;
}
