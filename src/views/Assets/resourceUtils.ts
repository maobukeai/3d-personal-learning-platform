import { getAssetUrl } from '@/utils/api';
import { getDefaultThumbnailUrl } from '@/utils/defaultThumbnail';

// Re-export unified format utilities for backward compatibility
export {
  formatDate,
  formatRelativeTime,
  formatFileSize,
  formatCompactNumber,
} from '@/utils/format';

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

export function resolvePreviewUrl(url?: string | null, fallbackType = 'GLB') {
  if (url) return getAssetUrl(url);
  return getDefaultThumbnailUrl(fallbackType);
}

export function normalizeVersion(version?: string | null) {
  const clean = String(version || '1.0.0').replace(/^v/i, '');
  return clean || '1.0.0';
}
