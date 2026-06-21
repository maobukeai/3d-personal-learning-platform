import { Response, NextFunction } from 'express';
import prisma from '../../services/prisma';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { AppError } from '../../utils/error';
import { logger } from '../../utils/logger';
import fs from 'fs';
import path from 'path';

export const getAllBanners = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const banners = await prisma.banner.findMany({
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    });
    res.json(banners);
  } catch (error) {
    next(error);
  }
};

export const createBanner = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { title, subtitle, imageUrl, route, tag, tagColor, buttonText, order, isActive } = req.body;

  if (!title) {
    return next(new AppError('Banner title is required', 400));
  }
  if (!imageUrl) {
    return next(new AppError('Banner image URL is required', 400));
  }

  try {
    const banner = await prisma.banner.create({
      data: {
        title,
        subtitle,
        imageUrl,
        route: route || '/discussions',
        tag,
        tagColor: tagColor || 'bg-accent/15 text-accent border-accent/30',
        buttonText: buttonText || '立即参与',
        order: typeof order === 'number' ? order : 0,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
    });
    res.status(201).json(banner);
  } catch (error) {
    next(error);
  }
};

export const updateBanner = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  const { title, subtitle, imageUrl, route, tag, tagColor, buttonText, order, isActive } = req.body;

  try {
    const existing = await prisma.banner.findUnique({ where: { id } });
    if (!existing) {
      return next(new AppError('Banner not found', 404));
    }

    // If banner image is being updated, we optionally clean up the old file
    if (imageUrl && imageUrl !== existing.imageUrl && existing.imageUrl) {
      const relativePath = existing.imageUrl.startsWith('/')
        ? existing.imageUrl.substring(1)
        : existing.imageUrl;
      const oldLocalPath = path.join(process.cwd(), relativePath);
      if (existing.imageUrl.includes('/uploads/banners/') && fs.existsSync(oldLocalPath)) {
        try {
          fs.unlinkSync(oldLocalPath);
        } catch (err) {
          logger.error('Failed to remove old banner image file:', err);
        }
      }
    }

    const banner = await prisma.banner.update({
      where: { id },
      data: {
        title: title !== undefined ? title : existing.title,
        subtitle: subtitle !== undefined ? subtitle : existing.subtitle,
        imageUrl: imageUrl !== undefined ? imageUrl : existing.imageUrl,
        route: route !== undefined ? route : existing.route,
        tag: tag !== undefined ? tag : existing.tag,
        tagColor: tagColor !== undefined ? tagColor : existing.tagColor,
        buttonText: buttonText !== undefined ? buttonText : existing.buttonText,
        order: order !== undefined && typeof order === 'number' ? order : existing.order,
        isActive: isActive !== undefined ? Boolean(isActive) : existing.isActive,
      },
    });

    res.json(banner);
  } catch (error) {
    next(error);
  }
};

export const deleteBanner = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;

  try {
    const existing = await prisma.banner.findUnique({ where: { id } });
    if (!existing) {
      return next(new AppError('Banner not found', 404));
    }

    // Unlink the local file if it exists
    if (existing.imageUrl) {
      const relativePath = existing.imageUrl.startsWith('/')
        ? existing.imageUrl.substring(1)
        : existing.imageUrl;
      const localPath = path.join(process.cwd(), relativePath);
      if (existing.imageUrl.includes('/uploads/banners/') && fs.existsSync(localPath)) {
        try {
          fs.unlinkSync(localPath);
        } catch (err) {
          logger.error('Failed to delete banner image file:', err);
        }
      }
    }

    await prisma.banner.delete({ where: { id } });
    res.json({ message: 'Banner deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const uploadBannerImage = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return next(new AppError('No file uploaded', 400));
    }

    // Standard URL format: /uploads/banners/filename
    const fileUrl =
      (req.file as any).url ||
      (req.file.path.replace(/\\/g, '/').startsWith('/')
        ? req.file.path.replace(/\\/g, '/')
        : `/${req.file.path.replace(/\\/g, '/')}`);

    res.status(200).json({ url: fileUrl });
  } catch (error) {
    next(error);
  }
};
