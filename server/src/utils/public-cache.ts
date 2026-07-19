import type { FastifyReply } from 'fastify';
import redisService from '../services/redis.service';

export const SHORT_PUBLIC_CACHE_TTL_SECONDS = 30;

export const PUBLIC_CACHE_KEYS = {
  activeBanners: 'public:banners:active',
  courseCategories: 'public:courses:categories',
} as const;

const SHORT_PUBLIC_CACHE_CONTROL = 'public, max-age=30, s-maxage=30, stale-while-revalidate=30';

export const applyShortPublicCacheHeaders = (reply: FastifyReply): void => {
  reply.header('Cache-Control', SHORT_PUBLIC_CACHE_CONTROL);
};

export const getOrSetPublicCache = async <T>(
  key: string,
  loader: () => Promise<T>,
  ttlSeconds = SHORT_PUBLIC_CACHE_TTL_SECONDS,
): Promise<T> => {
  const cached = await redisService.get<T>(key);
  if (cached !== null) {
    return cached;
  }

  const value = await loader();
  await redisService.set(key, value, ttlSeconds);
  return value;
};

export const invalidatePublicCache = async (key: string): Promise<void> => {
  await redisService.del(key);
};
