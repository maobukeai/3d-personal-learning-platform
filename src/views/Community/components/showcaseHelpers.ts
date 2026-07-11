import type { Component } from 'vue';
import { Image, Video, Box, Type, Layers3 } from 'lucide-vue-next';
import { toast } from '@/utils/feedbackAdapter';
import api, { getAssetUrl } from '@/utils/api';
import axios from 'axios';
import { downloadFileMultiThreaded } from '@/utils/downloadHelper';
import type { ShowcaseType } from './showcaseTypes';
export const typeOptions: Array<{ value: ShowcaseType; label: string; icon: Component }> = [
  { value: 'IMAGE', label: '图片', icon: Image },
  { value: 'VIDEO', label: '视频', icon: Video },
  { value: 'MODEL', label: '3D模型', icon: Box },
  { value: 'TEXT', label: '文本', icon: Type },
  { value: 'OTHER', label: '其他', icon: Layers3 },
];
export const getTypeLabel = (type: ShowcaseType) =>
  typeOptions.find((option) => option.value === type)?.label ?? '作品';
export const getTypeClass = (type: ShowcaseType) => {
  if (type === 'MODEL') return 'tone-blue';
  if (type === 'VIDEO') return 'tone-rose';
  if (type === 'IMAGE') return 'tone-green';
  if (type === 'TEXT') return 'tone-amber';
  return 'tone-slate';
};
export const isVideoUrl = (url: string) => {
  if (!url) return false;
  const cleanUrl = url.split('?')[0].split('#')[0].toLowerCase();
  return (
    cleanUrl.endsWith('.mp4') ||
    cleanUrl.endsWith('.webm') ||
    cleanUrl.endsWith('.mov') ||
    cleanUrl.endsWith('.ogg') ||
    cleanUrl.endsWith('.quicktime')
  );
};
export interface LinkedMaterialLike {
  id: string;
  title?: string;
  fileUrl?: string;
}
export interface LinkedPluginLike {
  id: string;
  title?: string;
  fileUrl?: string;
}
export const downloadMaterialFile = async (material: LinkedMaterialLike) => {
  try {
    await api.post(`/api/materials/${material.id}/download`);
    const response = await api.get(`/api/materials/${material.id}/file`, { responseType: 'blob' });
    const ext = material.fileUrl?.split('.').pop() || 'zip';
    const safeTitle = (material.title || 'material').replace(/[^a-zA-Z0-9\u4e00-\u9fff._-]/g, '_');
    const blob = new Blob([response.data]);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeTitle}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch {
    toast.error('下载材质失败，请稍后重试');
  }
};
export const downloadPluginFile = async (plugin: LinkedPluginLike) => {
  if (!plugin.fileUrl) {
    toast.error('此插件没有有效的下载地址');
    return;
  }
  try {
    const resolvedUrl = getAssetUrl(plugin.fileUrl);
    const ext = plugin.fileUrl.split('.').pop()?.split('?')[0] || 'zip';
    const safeTitle = (plugin.title || 'plugin').replace(/[^a-zA-Z0-9\u4e00-\u9fff._-]/g, '_');
    await downloadFileMultiThreaded(resolvedUrl, `${safeTitle}.${ext}`);
    await api.post(`/api/plugins/${plugin.id}/download`);
  } catch (error: unknown) {
    const err = error as { name?: string; message?: string; response?: { status?: number } };
    if (
      axios.isCancel(error) ||
      err?.name === 'CanceledError' ||
      err?.name === 'AbortError' ||
      err?.message === 'canceled'
    ) {
      return;
    }
    const status = err?.response?.status;
    const msg = status === 404 ? '文件不存在或已被删除，请联系管理员' : '下载插件失败，请稍后重试';
    toast.error(msg);
  }
};
