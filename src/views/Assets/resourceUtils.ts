import { getAssetUrl } from '@/utils/api';
import { getDefaultThumbnailUrl } from '@/utils/defaultThumbnail';

// Re-export unified format utilities for backward compatibility
export {
  formatDate,
  formatRelativeTime,
  formatFileSize,
  formatCompactNumber,
} from '@/utils/format';

// Re-export unified tag parser for backward compatibility
export { parseTags } from '@/utils/tags';

export function resolvePreviewUrl(url?: string | null, fallbackType = 'GLB') {
  if (url) return getAssetUrl(url);
  return getDefaultThumbnailUrl(fallbackType);
}

export function normalizeVersion(version?: string | null) {
  const clean = String(version || '1.0.0').replace(/^v/i, '');
  return clean || '1.0.0';
}
