import type { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../services/prisma';

export const getActiveBanners = async (
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const banners = await prisma.banner.findMany({
    where: {
      isActive: true,
    },
    orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
  });
  reply.send(banners);
};
