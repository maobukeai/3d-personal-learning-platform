import {
  getR2ObjectCacheControl,
  R2_IMMUTABLE_CACHE_CONTROL,
  R2_PRIVATE_CACHE_CONTROL,
  R2_SHORT_CACHE_CONTROL,
  resolveR2ContentType,
} from '../src/utils/r2-cache-control';

describe('R2 object cache control', () => {
  it('caches versioned public models and thumbnails as immutable', () => {
    expect(getR2ObjectCacheControl('asset/123/model.glb', 'model/gltf-binary')).toBe(
      R2_IMMUTABLE_CACHE_CONTROL,
    );
    expect(getR2ObjectCacheControl('thumbnail/123/preview.webp', 'image/webp')).toBe(
      R2_IMMUTABLE_CACHE_CONTROL,
    );
    expect(
      getR2ObjectCacheControl('courses/course-123/tutorials/lesson-456/step.webp', 'image/webp'),
    ).toBe(R2_IMMUTABLE_CACHE_CONTROL);
  });

  it('uses a short cache for mutable mirror metadata', () => {
    expect(getR2ObjectCacheControl('mirror/source/metadata.json', 'application/json')).toBe(
      R2_SHORT_CACHE_CONTROL,
    );
  });

  it('does not make temporary or message uploads publicly cacheable', () => {
    expect(getR2ObjectCacheControl('temporary/123/private.zip', 'application/zip')).toBe(
      R2_PRIVATE_CACHE_CONTROL,
    );
    expect(getR2ObjectCacheControl('messages/123/image.png', 'image/png')).toBe(
      R2_PRIVATE_CACHE_CONTROL,
    );
  });

  it('infers browser-safe model MIME types from file extensions', () => {
    expect(resolveR2ContentType('asset/123/model.glb', 'application/octet-stream')).toBe(
      'model/gltf-binary',
    );
    expect(resolveR2ContentType('asset/123/scene.gltf')).toBe('model/gltf+json');
  });
});
