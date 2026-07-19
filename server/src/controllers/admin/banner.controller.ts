import type { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../../services/prisma';
import { AppError } from '../../utils/error';
import { logger } from '../../utils/logger';
import { deleteCloudOrLocalFileByUrl } from '../../utils/file';
import { invalidatePublicCache, PUBLIC_CACHE_KEYS } from '../../utils/public-cache';

type AdminRequest = FastifyRequest & {
  body: any;
  query: any;
  params: any;
  file?: any;
};

export const getAllBanners = async (req: AdminRequest, reply: FastifyReply) => {
  try {
    const banners = await prisma.banner.findMany({
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    });
    reply.send(banners);
  } catch (error) {
    throw error;
  }
};

export const createBanner = async (req: AdminRequest, reply: FastifyReply) => {
  const { title, subtitle, imageUrl, route, tag, tagColor, buttonText, order, isActive } = req.body;

  if (!title) {
    throw new AppError('Banner title is required', 400);
  }
  if (!imageUrl) {
    throw new AppError('Banner image URL is required', 400);
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
    await invalidatePublicCache(PUBLIC_CACHE_KEYS.activeBanners);
    reply.status(201).send(banner);
  } catch (error) {
    throw error;
  }
};

export const updateBanner = async (req: AdminRequest, reply: FastifyReply) => {
  const id = req.params.id as string;
  const { title, subtitle, imageUrl, route, tag, tagColor, buttonText, order, isActive } = req.body;

  try {
    const existing = await prisma.banner.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Banner not found', 404);
    }

    // If banner image is being updated, clean up the old file (local or R2)
    if (imageUrl && imageUrl !== existing.imageUrl && existing.imageUrl) {
      deleteCloudOrLocalFileByUrl(existing.imageUrl).catch((err) => {
        logger.error('Failed to remove old banner image file:', err);
      });
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

    await invalidatePublicCache(PUBLIC_CACHE_KEYS.activeBanners);
    reply.send(banner);
  } catch (error) {
    throw error;
  }
};

export const deleteBanner = async (req: AdminRequest, reply: FastifyReply) => {
  const id = req.params.id as string;

  try {
    const existing = await prisma.banner.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Banner not found', 404);
    }

    // Unlink the file from local disk or R2
    if (existing.imageUrl) {
      deleteCloudOrLocalFileByUrl(existing.imageUrl).catch((err) => {
        logger.error('Failed to delete banner image file:', err);
      });
    }

    await prisma.banner.delete({ where: { id } });
    await invalidatePublicCache(PUBLIC_CACHE_KEYS.activeBanners);
    reply.send({ message: 'Banner deleted successfully' });
  } catch (error) {
    throw error;
  }
};

export const uploadBannerImage = async (req: AdminRequest, reply: FastifyReply) => {
  try {
    if (!req.file) {
      throw new AppError('No file uploaded', 400);
    }

    const fileUrl = req.file?.url;
    if (!fileUrl) {
      throw new AppError('文件上传失败，未获取到云存储地址', 400);
    }

    reply.status(200).send({ url: fileUrl });
  } catch (error) {
    throw error;
  }
};
