import { getAssetUrl } from '@/utils/api';
import { getDefaultThumbnailUrl } from '@/utils/defaultThumbnail';

export function parseTags(tags?: string | string[] | null) {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags.map(String).filter(Boolean);
  try {
    const parsed = JSON.parse(tags);
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
  } catch (_error) {
    // Fall through to delimiter parsing.
  }
  return tags
    .split(/[,，\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function formatFileSize(sizeMb?: number | null, fallback = '未知大小') {
  const size = Number(sizeMb || 0);
  if (!size) return fallback;
  if (size < 1) return `${Math.max(1, Math.round(size * 1024))} KB`;
  if (size >= 1024) return `${(size / 1024).toFixed(1)} GB`;
  return `${size.toFixed(1)} MB`;
}

export function formatCompactNumber(value?: number | null) {
  const number = Number(value || 0);
  if (number >= 10000) return `${(number / 10000).toFixed(1)}万`;
  if (number >= 1000) return `${(number / 1000).toFixed(1)}k`;
  return String(number);
}

export function formatDate(value?: string | Date | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function formatRelativeTime(value?: string | Date | null) {
  if (!value) return '-';
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.floor(diff / 60000));
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} 天前`;
  return formatDate(value);
}

export function resolvePreviewUrl(url?: string | null, fallbackType = 'GLB') {
  if (url) return getAssetUrl(url);
  return getDefaultThumbnailUrl(fallbackType);
}

export function normalizeVersion(version?: string | null) {
  const clean = String(version || '1.0.0').replace(/^v/i, '');
  return clean || '1.0.0';
}
