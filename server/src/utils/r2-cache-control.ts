export const R2_IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';
export const R2_SHORT_CACHE_CONTROL = 'public, max-age=300, stale-while-revalidate=3600';
export const R2_PRIVATE_CACHE_CONTROL = 'private, max-age=3600';

const PUBLIC_RESOURCE_PREFIX =
  /^(?:(?:asset|assets|thumbnail|thumbnails|crawled|material|materials|plugin|plugins|showcase|mirror)\/|courses\/[^/]+\/tutorials\/)/i;

const MUTABLE_DOCUMENT_PATTERN = /(?:^|\/)(?:metadata|manifest)\.json$/i;

const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  '.avif': 'image/avif',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

export const resolveR2ContentType = (key: string, contentType?: string): string => {
  const normalizedType = contentType?.toLowerCase().split(';', 1)[0]?.trim();
  if (normalizedType && normalizedType !== 'application/octet-stream') {
    return normalizedType;
  }

  const normalizedKey = key.toLowerCase().split(/[?#]/, 1)[0] || '';
  const extension = Object.keys(CONTENT_TYPE_BY_EXTENSION).find((candidate) =>
    normalizedKey.endsWith(candidate),
  );
  return extension
    ? CONTENT_TYPE_BY_EXTENSION[extension] || 'application/octet-stream'
    : 'application/octet-stream';
};

export const getR2ObjectCacheControl = (key: string, contentType: string): string => {
  const normalizedKey = key.replace(/^\/+/, '');
  const normalizedType = resolveR2ContentType(normalizedKey, contentType);

  if (!PUBLIC_RESOURCE_PREFIX.test(normalizedKey)) {
    return R2_PRIVATE_CACHE_CONTROL;
  }

  if (
    MUTABLE_DOCUMENT_PATTERN.test(normalizedKey) ||
    (normalizedType === 'application/json' && !normalizedType.startsWith('model/'))
  ) {
    return R2_SHORT_CACHE_CONTROL;
  }

  return R2_IMMUTABLE_CACHE_CONTROL;
};
