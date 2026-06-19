import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { AuthRequest } from '../middlewares/auth.middleware';
import { AppError } from '../utils/error';
import prisma from '../services/prisma';
import { logger } from '../utils/logger';
import { getPaginationParams, createPaginationMeta } from '../utils/pagination';

import fs from 'fs';
import { deleteCloudOrLocalFileByUrl } from '../utils/file';
import { parseTags } from '../utils/tags';
import { UploadedFile } from '../types/upload';

const PLUGIN_FAVORITES_SETTING_KEY = 'favorite_plugins';

const parseFavoritePluginIds = (value?: string | null): string[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
  } catch (_error) {
    // Fall back to comma-separated values for older saved settings.
  }
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const getFavoritePluginIds = async (userId: string) => {
  const setting = await prisma.userSetting.findUnique({
    where: { userId_key: { userId, key: PLUGIN_FAVORITES_SETTING_KEY } },
  });
  return parseFavoritePluginIds(setting?.value);
};

const saveFavoritePluginIds = async (userId: string, pluginIds: string[]) => {
  const uniqueIds = Array.from(new Set(pluginIds.filter(Boolean)));
  await prisma.userSetting.upsert({
    where: { userId_key: { userId, key: PLUGIN_FAVORITES_SETTING_KEY } },
    update: { value: JSON.stringify(uniqueIds) },
    create: {
      userId,
      key: PLUGIN_FAVORITES_SETTING_KEY,
      value: JSON.stringify(uniqueIds),
    },
  });
  return uniqueIds;
};

// ── Public: list approved plugins ─────────────────────────────────────────────
export const listPlugins = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query as Record<string, unknown>, 20, 50);
    const category = req.query.category as string | undefined;
    const search = req.query.search as string | undefined;

    const authReq = req as AuthRequest;
    const mine = req.query.mine === 'true';
    const favoritesOnly = req.query.favoritesOnly === 'true';
    const status = req.query.status as string;
    const userId = authReq.userId as string;

    const where: Prisma.PluginWhereInput = mine
      ? {
          userId,
          ...(status && status !== 'all' ? { status } : {}),
        }
      : {
          status: 'APPROVED',
        };

    if (category && category !== 'all') where.category = category;
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
        { tags: { contains: search } },
      ];
    }

    if (favoritesOnly && userId) {
      const favoriteIds = await getFavoritePluginIds(userId);
      where.id = { in: favoriteIds };
    }

    const [plugins, total] = await Promise.all([
      prisma.plugin.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      }),
      prisma.plugin.count({ where }),
    ]);

    res.json({ plugins, pagination: createPaginationMeta(page, limit, total) });
  } catch (err) {
    next(err);
  }
};

export const getPluginById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as { id: string };
    const plugin = await prisma.plugin.findFirst({
      where: {
        id,
        OR:
          req.user?.role === 'ADMIN'
            ? undefined
            : [{ status: 'APPROVED' }, { userId: req.userId as string }],
      },
      include: { user: { select: { id: true, name: true, avatarUrl: true, email: true } } },
    });

    if (!plugin) return next(new AppError('插件不存在', 404));

    res.json(plugin);
  } catch (err) {
    next(err);
  }
};

// ── Plugin marketplace insights ───────────────────────────────────────────────
export const getPluginInsights = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId as string;
    const [approvedPlugins, pendingCount, favoriteIds, myUploadsCount] = await Promise.all([
      prisma.plugin.findMany({
        where: { status: 'APPROVED' },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          category: true,
          version: true,
          compatibility: true,
          downloads: true,
          fileSize: true,
          previewUrl: true,
          createdAt: true,
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
        take: 120,
      }),
      prisma.plugin.count({ where: { status: 'PENDING' } }),
      getFavoritePluginIds(userId),
      prisma.plugin.count({ where: { userId } }),
    ]);

    const categoryMap = new Map<string, { name: string; count: number; downloads: number }>();
    let totalDownloads = 0;
    let totalFileSize = 0;
    const tagCounts = new Map<string, number>();

    const allTags = await prisma.plugin.findMany({
      where: { status: 'APPROVED', tags: { not: null } },
      select: { tags: true },
      take: 500,
    });

    approvedPlugins.forEach((plugin) => {
      totalDownloads += plugin.downloads || 0;
      totalFileSize += plugin.fileSize || 0;
      const current = categoryMap.get(plugin.category) || {
        name: plugin.category,
        count: 0,
        downloads: 0,
      };
      current.count += 1;
      current.downloads += plugin.downloads || 0;
      categoryMap.set(plugin.category, current);
    });

    allTags.forEach((plugin) => {
      parseTags(plugin.tags).forEach((tag) => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });

    const categories = Array.from(categoryMap.values()).sort((a, b) => b.count - a.count);
    const hotTags = Array.from(tagCounts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 18);

    res.json({
      summary: {
        total: approvedPlugins.length,
        pending: pendingCount,
        downloads: totalDownloads,
        categories: categories.length,
        favoriteCount: favoriteIds.length,
        myUploads: myUploadsCount,
        averageSize:
          approvedPlugins.length > 0
            ? Number((totalFileSize / approvedPlugins.length).toFixed(2))
            : 0,
      },
      categories,
      hotTags,
      topDownloads: [...approvedPlugins].sort((a, b) => b.downloads - a.downloads).slice(0, 6),
      latest: approvedPlugins.slice(0, 6),
      favoriteIds,
    });
  } catch (err) {
    next(err);
  }
};

// ── My plugins ─────────────────────────────────────────────────────────────────
export const getMyPlugins = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const plugins = await prisma.plugin.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: 'desc' },
    });
    res.json(plugins);
  } catch (err) {
    next(err);
  }
};

// ── My favorite plugins ───────────────────────────────────────────────────────
export const getMyFavoritePlugins = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const favoriteIds = await getFavoritePluginIds(req.userId as string);
    if (favoriteIds.length === 0) {
      res.json({ ids: [], plugins: [] });
      return;
    }

    const plugins = await prisma.plugin.findMany({
      where: { id: { in: favoriteIds }, status: 'APPROVED' },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    });

    res.json({
      ids: plugins.map((plugin) => plugin.id),
      plugins,
    });
  } catch (err) {
    next(err);
  }
};

export const togglePluginFavorite = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as { id: string };
    const plugin = await prisma.plugin.findFirst({
      where: { id, status: 'APPROVED' },
      select: { id: true },
    });
    if (!plugin) return next(new AppError('插件不存在', 404));

    const favoriteIds = await getFavoritePluginIds(req.userId as string);
    const isFavorited = favoriteIds.includes(id);
    const nextIds = isFavorited
      ? favoriteIds.filter((pluginId) => pluginId !== id)
      : [...favoriteIds, id];
    const savedIds = await saveFavoritePluginIds(req.userId as string, nextIds);

    res.json({
      isFavorited: !isFavorited,
      favoriteIds: savedIds,
    });
  } catch (err) {
    next(err);
  }
};

// ── Upload / create plugin ─────────────────────────────────────────────────────
export const uploadPlugin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
  const pluginFile = files?.plugin_file?.[0] || files?.file?.[0];
  const previewFile = files?.plugin_preview?.[0] || files?.preview?.[0];

  if (!pluginFile) {
    return next(new AppError('请上传插件文件', 400));
  }

  try {
    const {
      title,
      description,
      category = '其他工具',
      version = '1.0.0',
      compatibility = '',
      tags,
      installGuide,
    } = req.body;

    if (!title?.trim()) {
      return next(new AppError('插件名称为必填项', 400));
    }

    const fileUrl = (pluginFile as UploadedFile).url || `/uploads/plugins/${pluginFile.filename}`;
    const fileSizeMb = pluginFile.size / (1024 * 1024);
    const previewUrl = previewFile ? ((previewFile as UploadedFile).url || `/uploads/plugins/${previewFile.filename}`) : null;

    const plugin = await prisma.plugin.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        category,
        version,
        compatibility,
        tags: tags?.trim() || null,
        fileUrl,
        fileSize: fileSizeMb,
        previewUrl,
        installGuide: installGuide?.trim() || null,
        userId: req.userId!,
        status: 'PENDING',
      },
    });

    logger.info(`[Plugin] User ${req.userId} uploaded plugin: ${plugin.id}`);
    res.status(201).json(plugin);
  } catch (err) {
    // Clean up uploaded files on error
    if (pluginFile?.path && fs.existsSync(pluginFile.path)) fs.unlinkSync(pluginFile.path);
    if (previewFile?.path && fs.existsSync(previewFile.path)) fs.unlinkSync(previewFile.path);
    next(err);
  }
};

// ── Update plugin (owner only) ─────────────────────────────────────────────────
export const updatePlugin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as { id: string };
    const existing = await prisma.plugin.findUnique({ where: { id } });

    if (!existing) return next(new AppError('插件不存在', 404));
    if (existing.userId !== req.userId) return next(new AppError('无权修改此插件', 403));

    const allowed = [
      'title',
      'description',
      'category',
      'version',
      'compatibility',
      'tags',
      'installGuide',
    ];
    const updateData: Record<string, unknown> = {};
    for (const field of allowed) {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    }
    // Editing resets to PENDING for re-review
    updateData.status = 'PENDING';
    updateData.rejectReason = null;

    const plugin = await prisma.plugin.update({ where: { id }, data: updateData as Prisma.PluginUpdateInput });
    res.json(plugin);
  } catch (err) {
    next(err);
  }
};

// ── Delete plugin (owner only) ─────────────────────────────────────────────────
export const deletePlugin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as { id: string };
    const existing = await prisma.plugin.findUnique({ where: { id } });

    if (!existing) return next(new AppError('插件不存在', 404));
    if (existing.userId !== req.userId) return next(new AppError('无权删除此插件', 403));

    // Remove files (run in background)
    for (const urlField of [existing.fileUrl, existing.previewUrl]) {
      if (urlField) {
        deleteCloudOrLocalFileByUrl(urlField).catch((err) => {
          logger.error(`[PluginController] Failed to delete plugin file ${urlField} in background:`, err);
        });
      }
    }

    await prisma.plugin.delete({ where: { id } });
    res.json({ message: '插件已删除' });
  } catch (err) {
    next(err);
  }
};

// ── Record download ────────────────────────────────────────────────────────────
export const downloadPlugin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as { id: string };
    const plugin = await prisma.plugin.findUnique({ where: { id } });
    if (!plugin || plugin.status !== 'APPROVED') return next(new AppError('插件不存在', 404));

    await prisma.plugin.update({ where: { id }, data: { downloads: { increment: 1 } } });
    res.json({ fileUrl: plugin.fileUrl });
  } catch (err) {
    next(err);
  }
};
