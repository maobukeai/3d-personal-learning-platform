import type { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../services/prisma';
import {
  applyShortPublicCacheHeaders,
  getOrSetPublicCache,
  PUBLIC_CACHE_KEYS,
} from '../utils/public-cache';

export const getActiveBanners = async (
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  applyShortPublicCacheHeaders(reply);
  const banners = await getOrSetPublicCache(PUBLIC_CACHE_KEYS.activeBanners, () =>
    prisma.banner.findMany({
      where: {
        isActive: true,
      },
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    }),
  );
  reply.send(banners);
};
