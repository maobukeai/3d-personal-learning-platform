import { Request, Response, NextFunction } from 'express';
import prisma from '../services/prisma';

export const getActiveBanners = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const banners = await prisma.banner.findMany({
      where: {
        isActive: true,
      },
      orderBy: [
        { order: 'asc' },
        { createdAt: 'desc' },
      ],
    });
    res.json(banners);
  } catch (error) {
    next(error);
  }
};
