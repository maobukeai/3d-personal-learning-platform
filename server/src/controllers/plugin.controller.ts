import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { AuthRequest } from '../middlewares/auth.middleware';
import { AppError } from '../utils/error';
import prisma from '../services/prisma';
import crypto from 'crypto';
import { logger } from '../utils/logger';
import { getPaginationParams, createPaginationMeta } from '../utils/pagination';
import path from 'path';
import fs from 'fs';
import { deleteCloudOrLocalFileByUrl, getZipFileNames, parseZipLocal, urlToPath, moveTempFileToDestination } from '../utils/file';
import { parseTags } from '../utils/tags';
import { UploadedFile } from '../types/upload';

import { parseBool } from '../utils/parser';

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

const migrateOldFavoritesIfNeeded = async (userId: string) => {
  const setting = await prisma.userSetting.findUnique({
    where: { userId_key: { userId, key: PLUGIN_FAVORITES_SETTING_KEY } },
  });
  if (setting) {
    const favoriteIds = parseFavoritePluginIds(setting.value);
    // Single round-trip to find which referenced plugins actually exist,
    // instead of one findUnique per favorite (avoids N+1).
    const existingPlugins = await prisma.plugin.findMany({
      where: { id: { in: favoriteIds } },
      select: { id: true },
    });
    const existingIds = new Set(existingPlugins.map((p) => p.id));
    await Promise.all(
      favoriteIds
        .filter((id) => existingIds.has(id))
        .map((pluginId) =>
          prisma.pluginFavorite
            .upsert({
              where: { userId_pluginId: { userId, pluginId } },
              update: {},
              create: { userId, pluginId, category: '默认' },
            })
            .catch(() => {}),
        ),
    );
    await prisma.userSetting
      .delete({
        where: { userId_key: { userId, key: PLUGIN_FAVORITES_SETTING_KEY } },
      })
      .catch(() => {});
  }
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
    const favoriteCategory = req.query.favoriteCategory as string | undefined;
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
      await migrateOldFavoritesIfNeeded(userId);
      const favFilter: Prisma.PluginFavoriteWhereInput = { userId };
      if (favoriteCategory && favoriteCategory !== 'all') {
        favFilter.category = favoriteCategory;
      }
      const userFavs = await prisma.pluginFavorite.findMany({
        where: favFilter,
        select: { pluginId: true },
      });
      const favoriteIds = userFavs.map((f) => f.pluginId);
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
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
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
    await migrateOldFavoritesIfNeeded(userId);
    const userFavs = await prisma.pluginFavorite.findMany({
      where: { userId },
      select: { pluginId: true },
    });
    const favoriteIds = userFavs.map((f) => f.pluginId);

    const [approvedPlugins, pendingCount, myUploadsCount, myDraftsCount] = await Promise.all([
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
          bilibiliUrl: true,
        },
        take: 120,
      }),
      prisma.plugin.count({ where: { status: 'PENDING' } }),
      prisma.plugin.count({ where: { userId } }),
      prisma.plugin.count({ where: { userId, status: 'PENDING' } }),
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
        myPending: myDraftsCount,
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

// ── Custom categories setting helper functions ───────────────────────────────
const CUSTOM_CATEGORIES_SETTING_KEY = 'plugin_favorite_categories';

const getCustomCategories = async (userId: string): Promise<string[]> => {
  try {
    const setting = await prisma.userSetting.findUnique({
      where: { userId_key: { userId, key: CUSTOM_CATEGORIES_SETTING_KEY } },
    });
    if (setting && setting.value) {
      return JSON.parse(setting.value) as string[];
    }
  } catch (err) {
    logger.warn(
      '[Plugin] Failed to parse custom categories setting:',
      err instanceof Error ? err.message : err,
    );
  }
  return [];
};

const saveCustomCategories = async (userId: string, categories: string[]) => {
  const uniqueCats = Array.from(new Set(categories.map((c) => c.trim()).filter(Boolean)));
  await prisma.userSetting.upsert({
    where: { userId_key: { userId, key: CUSTOM_CATEGORIES_SETTING_KEY } },
    update: { value: JSON.stringify(uniqueCats) },
    create: { userId, key: CUSTOM_CATEGORIES_SETTING_KEY, value: JSON.stringify(uniqueCats) },
  });
};

// ── My favorite plugins ───────────────────────────────────────────────────────
export const getMyFavoritePlugins = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId as string;
    await migrateOldFavoritesIfNeeded(userId);

    const favorites = await prisma.pluginFavorite.findMany({
      where: { userId, plugin: { status: 'APPROVED' } },
      orderBy: { createdAt: 'desc' },
      include: {
        plugin: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
      },
    });

    const categoryList = await prisma.pluginFavorite.groupBy({
      by: ['category'],
      where: { userId },
    });

    const dbCategories = categoryList.map((c) => c.category);
    const customCategories = await getCustomCategories(userId);

    // Merge database categories and custom categories
    const categoriesSet = new Set(['默认', ...dbCategories, ...customCategories]);

    res.json({
      ids: favorites.map((f) => f.pluginId),
      favorites: favorites.map((f) => ({
        id: f.id,
        category: f.category,
        plugin: f.plugin,
      })),
      categories: Array.from(categoriesSet),
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/plugins/favorites/categories
export const createFavoriteCategory = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const userId = req.userId as string;
  const { category } = req.body;

  if (!category || !category.trim()) {
    return next(new AppError('分类名称不能为空', 400));
  }

  const newCat = category.trim();
  if (newCat === '默认') {
    return next(new AppError('不能创建默认分类', 400));
  }

  try {
    const customCats = await getCustomCategories(userId);
    if (!customCats.includes(newCat)) {
      customCats.push(newCat);
      await saveCustomCategories(userId, customCats);
    }

    res.json({ success: true, message: '分类创建成功', categories: ['默认', ...customCats] });
  } catch (error) {
    next(error);
  }
};

// PUT /api/plugins/favorites/categories
export const updateFavoriteCategory = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const userId = req.userId as string;
  const { oldCategory, newCategory } = req.body;

  if (!oldCategory || !newCategory) {
    return next(new AppError('缺少必要参数', 400));
  }

  const oldCat = oldCategory.trim();
  const newCat = newCategory.trim();

  if (oldCat === '默认' || newCat === '默认') {
    return next(new AppError('不能重命名默认分类', 400));
  }

  try {
    await prisma.pluginFavorite.updateMany({
      where: {
        userId,
        category: oldCat,
      },
      data: {
        category: newCat,
      },
    });

    const customCats = await getCustomCategories(userId);
    const updatedCats = customCats.map((c) => (c === oldCat ? newCat : c));
    await saveCustomCategories(userId, updatedCats);

    res.json({ success: true, message: '分类更新成功' });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/plugins/favorites/categories/:categoryName
export const deleteFavoriteCategory = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const userId = req.userId as string;
  const categoryName = req.params.categoryName as string;

  if (!categoryName) {
    return next(new AppError('缺少分类名称', 400));
  }

  const cat = categoryName.trim();

  if (cat === '默认') {
    return next(new AppError('不能删除默认分类', 400));
  }

  try {
    // Delete all favorites belonging to this category
    await prisma.pluginFavorite.deleteMany({
      where: {
        userId,
        category: cat,
      },
    });

    const customCats = await getCustomCategories(userId);
    const filteredCats = customCats.filter((c) => c !== cat);
    await saveCustomCategories(userId, filteredCats);

    res.json({ success: true, message: '分类删除成功' });
  } catch (error) {
    next(error);
  }
};

export const togglePluginFavorite = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as { id: string };
    const categoryVal = typeof req.body?.category === 'string' ? req.body.category.trim() : '默认';
    const category = categoryVal || '默认';
    const userId = req.userId as string;

    const plugin = await prisma.plugin.findFirst({
      where: { id, status: 'APPROVED' },
      select: { id: true },
    });
    if (!plugin) return next(new AppError('插件不存在', 404));

    await migrateOldFavoritesIfNeeded(userId);

    const existing = await prisma.pluginFavorite.findUnique({
      where: { userId_pluginId: { userId, pluginId: id } },
    });

    let isFavorited = false;
    if (existing) {
      if (existing.category === category) {
        await prisma.pluginFavorite.delete({
          where: { id: existing.id },
        });
        isFavorited = false;
      } else {
        await prisma.pluginFavorite.update({
          where: { id: existing.id },
          data: { category },
        });
        isFavorited = true;
      }
    } else {
      await prisma.pluginFavorite.create({
        data: {
          userId,
          pluginId: id,
          category,
        },
      });
      isFavorited = true;
    }

    if (isFavorited && category !== '默认') {
      const customCats = await getCustomCategories(userId);
      if (!customCats.includes(category)) {
        customCats.push(category);
        await saveCustomCategories(userId, customCats);
      }
    }

    const favorites = await prisma.pluginFavorite.findMany({
      where: { userId },
      select: { pluginId: true },
    });

    res.json({
      isFavorited,
      favoriteIds: favorites.map((f) => f.pluginId),
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

  const externalUrl = req.body.externalUrl;
  let tempPluginPath = req.body.tempPluginPath;
  let tempPreviewPath = req.body.tempPreviewPath;

  if (!pluginFile && !tempPluginPath && !externalUrl) {
    return next(new AppError('请上传插件文件或提供外部链接', 400));
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
      originality,
      originalAuthor,
      originalLink,
      license,
      isFree,
      linkedCourseId,
      linkedLessonId,
    } = req.body;

    if (!title?.trim()) {
      return next(new AppError('插件名称为必填项', 400));
    }

    if (tempPluginPath) {
      tempPluginPath = moveTempFileToDestination(req, tempPluginPath, 'plugins');
    }
    if (tempPreviewPath) {
      tempPreviewPath = moveTempFileToDestination(req, tempPreviewPath, 'plugins');
    }

    let packageFilesList: string[] = [];
    if (pluginFile) {
      const ext = path.extname(pluginFile.originalname).toLowerCase();
      if (ext === '.zip') {
        packageFilesList = await parseZipLocal(pluginFile.path);
      }
    } else if (tempPluginPath) {
      const localPath = urlToPath(tempPluginPath);
      if (localPath && fs.existsSync(localPath)) {
        const ext = path.extname(localPath).toLowerCase();
        if (ext === '.zip') {
          packageFilesList = await parseZipLocal(localPath);
        }
      }
    }

    const fileUrl = pluginFile
      ? (pluginFile as UploadedFile).url || `/uploads/plugins/${pluginFile.filename}`
      : tempPluginPath || externalUrl;

    let fileSizeMb = pluginFile ? pluginFile.size / (1024 * 1024) : 0;
    if (!pluginFile && tempPluginPath) {
      const localPath = urlToPath(tempPluginPath);
      if (localPath && fs.existsSync(localPath)) {
        fileSizeMb = fs.statSync(localPath).size / (1024 * 1024);
      }
    }

    const previewUrl = previewFile
      ? (previewFile as UploadedFile).url || `/uploads/plugins/${previewFile.filename}`
      : tempPreviewPath || null;

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
        packageFilesList: packageFilesList.length > 0 ? JSON.stringify(packageFilesList) : null,
        previewUrl,
        installGuide: installGuide?.trim() || null,
        userId: req.userId!,
        status: req.user?.role === 'ADMIN' ? 'APPROVED' : 'PENDING',
        originality: originality || 'ORIGINAL',
        originalAuthor: originalAuthor || null,
        originalLink: originalLink || null,
        license: license || 'CC_BY',
        isFree: parseBool(isFree, true),
        linkedCourseId: linkedCourseId || null,
        linkedLessonId: linkedLessonId || null,
        bilibiliUrl: req.body.bilibiliUrl || null,
      },
    });

    // Create initial version record
    await prisma.pluginVersion
      .create({
        data: {
          pluginId: plugin.id,
          version: plugin.version,
          changelog: '初始发布版本',
          fileUrl: plugin.fileUrl,
          fileSize: plugin.fileSize,
          packageFilesList: plugin.packageFilesList,
        },
      })
      .catch((err) => {
        logger.error('[Plugin] Failed to create initial version record:', err);
      });

    // Clean up local plugin file after parsing
    if (pluginFile && fs.existsSync(pluginFile.path)) {
      try {
        fs.unlinkSync(pluginFile.path);
      } catch (err) {
        logger.error('[Plugin] Failed to delete local plugin file:', err);
      }
    }

    logger.info(`[Plugin] User ${req.userId} uploaded plugin: ${plugin.id}`);
    res.status(201).json(plugin);
  } catch (err) {
    // Clean up uploaded files on error
    if (pluginFile?.path && fs.existsSync(pluginFile.path)) fs.unlinkSync(pluginFile.path);
    if (previewFile?.path && fs.existsSync(previewFile.path)) fs.unlinkSync(previewFile.path);
    next(err);
  }
};

export const updatePlugin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
  const pluginFile = files?.plugin_file?.[0] || files?.file?.[0];
  const previewFile = files?.plugin_preview?.[0] || files?.preview?.[0];
  const externalUrl = req.body.externalUrl;

  try {
    const { id } = req.params as { id: string };
    let tempPluginPath = req.body.tempPluginPath;
    let tempPreviewPath = req.body.tempPreviewPath;

    if (tempPluginPath) {
      tempPluginPath = moveTempFileToDestination(req, tempPluginPath, 'plugins');
    }
    if (tempPreviewPath) {
      tempPreviewPath = moveTempFileToDestination(req, tempPreviewPath, 'plugins');
    }

    const existing = await prisma.plugin.findUnique({ where: { id } });

    if (!existing) {
      if (pluginFile?.path && fs.existsSync(pluginFile.path)) fs.unlinkSync(pluginFile.path);
      if (previewFile?.path && fs.existsSync(previewFile.path)) fs.unlinkSync(previewFile.path);
      return next(new AppError('插件不存在', 404));
    }
    if (existing.userId !== req.userId && req.user?.role !== 'ADMIN') {
      if (pluginFile?.path && fs.existsSync(pluginFile.path)) fs.unlinkSync(pluginFile.path);
      if (previewFile?.path && fs.existsSync(previewFile.path)) fs.unlinkSync(previewFile.path);
      return next(new AppError('无权修改此插件', 403));
    }

    const allowed = [
      'title',
      'description',
      'category',
      'version',
      'compatibility',
      'tags',
      'installGuide',
      'originality',
      'originalAuthor',
      'originalLink',
      'license',
      'bilibiliUrl',
    ];
    const updateData: Record<string, unknown> = {};
    for (const field of allowed) {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    }

    // If version is changed but no new file is uploaded, switch the active file mapping to that version's files
    if (req.body.version && !pluginFile && !externalUrl) {
      const targetVersionRecord = await prisma.pluginVersion.findFirst({
        where: {
          pluginId: id,
          version: req.body.version,
        },
      });
      if (targetVersionRecord) {
        updateData.fileUrl = targetVersionRecord.fileUrl;
        updateData.fileSize = targetVersionRecord.fileSize;
        updateData.packageFilesList = targetVersionRecord.packageFilesList;
      }
    }

    if (req.body.linkedCourseId !== undefined) {
      updateData.linkedCourseId = req.body.linkedCourseId || null;
    }
    if (req.body.linkedLessonId !== undefined) {
      updateData.linkedLessonId = req.body.linkedLessonId || null;
    }

    if (req.body.isFree !== undefined) {
      updateData.isFree = parseBool(req.body.isFree, true);
    }

    // Check if new plugin file is uploaded
    if (pluginFile) {
      if (existing.fileUrl) {
        const targetVersion = req.body.version || existing.version;
        const isFileReferenced = await prisma.pluginVersion.findFirst({
          where: {
            pluginId: id,
            fileUrl: existing.fileUrl,
            version: { not: targetVersion },
          },
        });
        if (!isFileReferenced) {
          deleteCloudOrLocalFileByUrl(existing.fileUrl).catch(() => {});
        }
      }
      const fileUrl = (pluginFile as UploadedFile).url || `/uploads/plugins/${pluginFile.filename}`;
      const fileSizeMb = pluginFile.size / (1024 * 1024);
      updateData.fileUrl = fileUrl;
      updateData.fileSize = fileSizeMb;

      let packageFilesList: string[] = [];
      const ext = path.extname(pluginFile.originalname).toLowerCase();
      if (ext === '.zip') {
        packageFilesList = await parseZipLocal(pluginFile.path);
      }
      updateData.packageFilesList =
        packageFilesList.length > 0 ? JSON.stringify(packageFilesList) : null;

      // Clean up local temp file
      if (fs.existsSync(pluginFile.path)) {
        try {
          fs.unlinkSync(pluginFile.path);
        } catch (_e) {}
      }
    } else if (tempPluginPath) {
      if (existing.fileUrl) {
        const targetVersion = req.body.version || existing.version;
        const isFileReferenced = await prisma.pluginVersion.findFirst({
          where: {
            pluginId: id,
            fileUrl: existing.fileUrl,
            version: { not: targetVersion },
          },
        });
        if (!isFileReferenced) {
          deleteCloudOrLocalFileByUrl(existing.fileUrl).catch(() => {});
        }
      }

      let fileSizeMb = 0;
      const localPath = urlToPath(tempPluginPath);
      if (localPath && fs.existsSync(localPath)) {
        fileSizeMb = fs.statSync(localPath).size / (1024 * 1024);
      }

      updateData.fileUrl = tempPluginPath;
      updateData.fileSize = fileSizeMb;

      let packageFilesList: string[] = [];
      if (localPath && fs.existsSync(localPath)) {
        const ext = path.extname(localPath).toLowerCase();
        if (ext === '.zip') {
          packageFilesList = await parseZipLocal(localPath);
        }
      }
      updateData.packageFilesList =
        packageFilesList.length > 0 ? JSON.stringify(packageFilesList) : null;
    } else if (externalUrl !== undefined) {
      if (externalUrl && existing.fileUrl) {
        const targetVersion = req.body.version || existing.version;
        const isFileReferenced = await prisma.pluginVersion.findFirst({
          where: {
            pluginId: id,
            fileUrl: existing.fileUrl,
            version: { not: targetVersion },
          },
        });
        if (!isFileReferenced) {
          deleteCloudOrLocalFileByUrl(existing.fileUrl).catch(() => {});
        }
        updateData.fileSize = 0;
        updateData.packageFilesList = null;
      }
      if (externalUrl !== undefined) {
        updateData.fileUrl = externalUrl || null;
      }
    }

    if (previewFile) {
      if (existing.previewUrl) {
        deleteCloudOrLocalFileByUrl(existing.previewUrl).catch(() => {});
      }
      const previewUrl =
        (previewFile as UploadedFile).url || `/uploads/plugins/${previewFile.filename}`;
      updateData.previewUrl = previewUrl;

      // Clean up local temp file
      if (fs.existsSync(previewFile.path)) {
        try {
          fs.unlinkSync(previewFile.path);
        } catch (_e) {}
      }
    } else if (tempPreviewPath) {
      if (existing.previewUrl) {
        deleteCloudOrLocalFileByUrl(existing.previewUrl).catch(() => {});
      }
      updateData.previewUrl = tempPreviewPath;
    }

    // Editing resets to PENDING for re-review unless editor is ADMIN
    updateData.status = req.user?.role === 'ADMIN' ? 'APPROVED' : 'PENDING';
    updateData.rejectReason = null;

    const plugin = await prisma.plugin.update({
      where: { id },
      data: updateData as Prisma.PluginUpdateInput,
    });

    // Sync to PluginVersion table
    const existingVersionRecord = await prisma.pluginVersion.findFirst({
      where: {
        pluginId: id,
        version: plugin.version,
      },
    });

    if (existingVersionRecord) {
      if (existingVersionRecord.fileUrl && existingVersionRecord.fileUrl !== plugin.fileUrl) {
        const isFileReferenced = await prisma.pluginVersion.findFirst({
          where: {
            pluginId: id,
            fileUrl: existingVersionRecord.fileUrl,
            version: { not: existingVersionRecord.version },
          },
        });
        if (!isFileReferenced) {
          deleteCloudOrLocalFileByUrl(existingVersionRecord.fileUrl).catch(() => {});
        }
      }

      await prisma.pluginVersion.update({
        where: { id: existingVersionRecord.id },
        data: {
          fileUrl: plugin.fileUrl,
          fileSize: plugin.fileSize,
          packageFilesList: plugin.packageFilesList,
        },
      });
    } else {
      await prisma.pluginVersion.create({
        data: {
          pluginId: id,
          version: plugin.version,
          fileUrl: plugin.fileUrl,
          fileSize: plugin.fileSize,
          packageFilesList: plugin.packageFilesList,
          changelog: '通过编辑插件上传',
        },
      });
    }

    res.json(plugin);
  } catch (err) {
    if (pluginFile?.path && fs.existsSync(pluginFile.path)) {
      try {
        fs.unlinkSync(pluginFile.path);
      } catch (_e) {}
    }
    if (previewFile?.path && fs.existsSync(previewFile.path)) {
      try {
        fs.unlinkSync(previewFile.path);
      } catch (_e) {}
    }
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
          logger.error(
            `[PluginController] Failed to delete plugin file ${urlField} in background:`,
            err,
          );
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
    if (!plugin) return next(new AppError('插件不存在', 404));

    const isOwner = plugin.userId === req.userId;
    const isAdmin = req.user?.role === 'ADMIN';
    if (plugin.status !== 'APPROVED' && !isOwner && !isAdmin) {
      return next(new AppError('插件不存在', 404));
    }

    await prisma.plugin.update({ where: { id }, data: { downloads: { increment: 1 } } });
    res.json({ fileUrl: plugin.fileUrl });
  } catch (err) {
    next(err);
  }
};

// GET /api/plugins/:id/package-files - non-blocking, cached ZIP file listing
export const getPluginPackageFiles = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const id = req.params.id as string;
  try {
    const plugin = await prisma.plugin.findFirst({
      where: {
        id,
        OR:
          req.user?.role === 'ADMIN'
            ? undefined
            : [{ status: 'APPROVED' }, { userId: req.userId as string }],
      },
      select: { fileUrl: true, packageFilesList: true },
    });

    if (!plugin) {
      return next(new AppError('Plugin not found or access denied', 404));
    }

    if (!plugin.fileUrl) {
      return res.json({ packageFiles: [] });
    }

    if (plugin.packageFilesList) {
      try {
        const files = JSON.parse(plugin.packageFilesList);
        if (Array.isArray(files)) {
          return res.json({ packageFiles: files });
        }
      } catch (_e) {
        // ignore and fallback
      }
    }

    const packageFiles = await getZipFileNames(plugin.fileUrl);

    // Cache to DB for future requests
    if (packageFiles.length > 0) {
      await prisma.plugin
        .update({
          where: { id },
          data: { packageFilesList: JSON.stringify(packageFiles) },
        })
        .catch((err) => {
          logger.error(
            `[Plugin] Failed to update packageFilesList fallback for plugin ${id}:`,
            err,
          );
        });
    }

    res.json({ packageFiles });
  } catch (error) {
    next(error);
  }
};

// GET /api/plugins/:id/comments
export const getPluginComments = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const pluginId = req.params.id as string;
  try {
    const plugin = await prisma.plugin.findFirst({
      where: {
        id: pluginId,
        OR:
          req.user?.role === 'ADMIN'
            ? undefined
            : [{ status: 'APPROVED' }, { userId: req.userId as string }],
      },
    });
    if (!plugin) {
      return next(new AppError('Plugin not found or access denied', 404));
    }
    const comments = await prisma.pluginComment.findMany({
      where: { pluginId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
    res.json(comments);
  } catch (error) {
    next(error);
  }
};

// POST /api/plugins/:id/comments
export const createPluginComment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const pluginId = req.params.id as string;
  const userId = req.user?.id;
  const { content } = req.body;

  if (!userId) {
    return next(new AppError('Unauthorized', 401));
  }
  if (!content || !content.trim()) {
    return next(new AppError('Comment content cannot be empty', 400));
  }

  try {
    const plugin = await prisma.plugin.findFirst({
      where: {
        id: pluginId,
        OR:
          req.user?.role === 'ADMIN'
            ? undefined
            : [{ status: 'APPROVED' }, { userId: req.userId as string }],
      },
    });
    if (!plugin) {
      return next(new AppError('Plugin not found or access denied', 404));
    }
    const comment = await prisma.pluginComment.create({
      data: {
        content: content.trim(),
        pluginId,
        userId,
      },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
    res.status(201).json(comment);
  } catch (error) {
    next(error);
  }
};

// DELETE /api/plugins/comments/:commentId
export const deletePluginComment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const commentId = req.params.commentId as string;
  const userId = req.user?.id;
  const userRole = req.user?.role;

  if (!userId) {
    return next(new AppError('Unauthorized', 401));
  }

  try {
    const comment = await prisma.pluginComment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      return next(new AppError('Comment not found', 404));
    }

    if (comment.userId !== userId && userRole !== 'ADMIN') {
      return next(new AppError('Forbidden', 403));
    }

    await prisma.pluginComment.delete({
      where: { id: commentId },
    });

    res.json({ success: true, message: 'Comment deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// GET /api/plugins/:id/share
export const getPluginShare = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const pluginId = req.params.id as string;
  try {
    const plugin = await prisma.plugin.findFirst({
      where:
        req.user?.role === 'ADMIN'
          ? { id: pluginId }
          : { id: pluginId, userId: req.userId as string },
    });
    if (!plugin) {
      return next(new AppError('Plugin not found or access denied', 404));
    }
    const share = await prisma.pluginShare.findUnique({
      where: { pluginId },
    });
    res.json(share);
  } catch (error) {
    next(error);
  }
};

// POST /api/plugins/:id/share
export const createOrUpdatePluginShare = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const pluginId = req.params.id as string;
  const userId = req.userId as string;
  const { expireHours, expiresAt, customText } = req.body;
  try {
    const plugin = await prisma.plugin.findFirst({
      where:
        req.user?.role === 'ADMIN'
          ? { id: pluginId }
          : { id: pluginId, userId: req.userId as string },
    });
    if (!plugin) {
      return next(new AppError('Plugin not found or access denied', 404));
    }

    let calculatedExpiresAt: Date | null = null;
    if (expiresAt) {
      calculatedExpiresAt = new Date(expiresAt);
    } else if (expireHours !== undefined && expireHours !== null) {
      calculatedExpiresAt = new Date(Date.now() + expireHours * 60 * 60 * 1000);
    }

    const existing = await prisma.pluginShare.findUnique({
      where: { pluginId },
    });

    let share;
    if (existing) {
      share = await prisma.pluginShare.update({
        where: { pluginId },
        data: {
          expiresAt: calculatedExpiresAt,
          customText,
        },
      });
    } else {
      share = await prisma.pluginShare.create({
        data: {
          pluginId,
          userId,
          expiresAt: calculatedExpiresAt,
          customText,
        },
      });
    }

    res.json(share);
  } catch (error) {
    next(error);
  }
};

// DELETE /api/plugins/:id/share
export const cancelPluginShare = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const pluginId = req.params.id as string;
  try {
    const plugin = await prisma.plugin.findFirst({
      where:
        req.user?.role === 'ADMIN'
          ? { id: pluginId }
          : { id: pluginId, userId: req.userId as string },
    });
    if (!plugin) {
      return next(new AppError('Plugin not found or access denied', 404));
    }

    await prisma.pluginShare.deleteMany({
      where: { pluginId },
    });
    res.json({ success: true, message: 'Share link cancelled' });
  } catch (error) {
    next(error);
  }
};

// GET /api/plugins/share/:shareId
export const getPublicSharedPlugin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const shareId = req.params.shareId as string;
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const share = await prisma.pluginShare.findUnique({
      where: { id: shareId },
      include: {
        plugin: {
          include: {
            user: {
              select: { id: true, name: true, avatarUrl: true },
            },
          },
        },
      },
    });

    if (!share) {
      return res.status(404).json({ error: '分享链接不存在或已失效' });
    }

    if (share.expiresAt && new Date() > share.expiresAt) {
      return res.status(410).json({ error: '分享链接已过期且失效' });
    }

    res.json(share);
  } catch (error) {
    next(error);
  }
};

// POST /api/plugins/:id/token
export const generateDeveloperToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const pluginId = req.params.id as string;
  try {
    const plugin = await prisma.plugin.findUnique({ where: { id: pluginId } });
    if (!plugin) return next(new AppError('插件不存在', 404));
    if (plugin.userId !== req.userId && req.user?.role !== 'ADMIN') {
      return next(new AppError('无权操作此插件', 403));
    }

    const token = 'plg_' + crypto.randomUUID().replace(/-/g, '');
    const updated = await prisma.plugin.update({
      where: { id: pluginId },
      data: { developerToken: token },
    });

    res.json({ developerToken: updated.developerToken });
  } catch (error) {
    next(error);
  }
};

// GET /api/plugins/:id/feedbacks
export const listPluginFeedbacks = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const pluginId = req.params.id as string;
  try {
    const plugin = await prisma.plugin.findUnique({ where: { id: pluginId } });
    if (!plugin) return next(new AppError('插件不存在', 404));
    if (plugin.userId !== req.userId && req.user?.role !== 'ADMIN') {
      return next(new AppError('无权操作此插件', 403));
    }

    const feedbacks = await prisma.pluginFeedback.findMany({
      where: { pluginId },
      orderBy: { createdAt: 'desc' },
    });

    res.json(feedbacks);
  } catch (error) {
    next(error);
  }
};

// DELETE /api/plugins/:id/feedbacks/:feedbackId
export const deletePluginFeedback = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { id: pluginId, feedbackId } = req.params as { id: string; feedbackId: string };
  try {
    const plugin = await prisma.plugin.findUnique({ where: { id: pluginId } });
    if (!plugin) return next(new AppError('插件不存在', 404));
    if (plugin.userId !== req.userId && req.user?.role !== 'ADMIN') {
      return next(new AppError('无权操作此反馈', 403));
    }

    const feedback = await prisma.pluginFeedback.findFirst({
      where: { id: feedbackId, pluginId },
    });
    if (!feedback) return next(new AppError('反馈记录不存在', 404));

    await prisma.pluginFeedback.delete({ where: { id: feedbackId } });
    res.json({ success: true, message: '反馈已成功删除' });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/plugins/:id/feedbacks
export const clearPluginFeedbacks = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const pluginId = req.params.id as string;
  try {
    const plugin = await prisma.plugin.findUnique({ where: { id: pluginId } });
    if (!plugin) return next(new AppError('插件不存在', 404));
    if (plugin.userId !== req.userId && req.user?.role !== 'ADMIN') {
      return next(new AppError('无权清除此反馈列表', 403));
    }

    await prisma.pluginFeedback.deleteMany({
      where: { pluginId },
    });
    res.json({ success: true, message: '反馈列表已清空' });
  } catch (error) {
    next(error);
  }
};

// POST /api/plugins/:id/versions
export const uploadPluginVersion = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const pluginId = req.params.id as string;
  const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
  const pluginFile = files?.plugin_file?.[0] || files?.file?.[0];

  if (!pluginFile) {
    return next(new AppError('请上传插件包文件', 400));
  }

  try {
    const plugin = await prisma.plugin.findUnique({ where: { id: pluginId } });
    if (!plugin) {
      if (fs.existsSync(pluginFile.path)) fs.unlinkSync(pluginFile.path);
      return next(new AppError('插件不存在', 404));
    }
    if (plugin.userId !== req.userId && req.user?.role !== 'ADMIN') {
      if (fs.existsSync(pluginFile.path)) fs.unlinkSync(pluginFile.path);
      return next(new AppError('无权操作此插件', 403));
    }

    const { version, changelog } = req.body;
    if (!version) {
      if (fs.existsSync(pluginFile.path)) fs.unlinkSync(pluginFile.path);
      return next(new AppError('版本号为必填项', 400));
    }

    const fileUrl = (pluginFile as UploadedFile).url || `/uploads/plugins/${pluginFile.filename}`;
    const fileSizeMb = pluginFile.size / (1024 * 1024);

    let packageFilesList: string[] = [];
    const ext = path.extname(pluginFile.originalname).toLowerCase();
    if (ext === '.zip') {
      packageFilesList = await parseZipLocal(pluginFile.path);
    }

    const newVersion = await prisma.pluginVersion.create({
      data: {
        pluginId,
        version,
        changelog: changelog || null,
        fileUrl,
        fileSize: fileSizeMb,
        packageFilesList: packageFilesList.length > 0 ? JSON.stringify(packageFilesList) : null,
      },
    });

    await prisma.plugin.update({
      where: { id: pluginId },
      data: {
        version,
        fileUrl,
        fileSize: fileSizeMb,
        packageFilesList: packageFilesList.length > 0 ? JSON.stringify(packageFilesList) : null,
        status: req.user?.role === 'ADMIN' ? 'APPROVED' : 'PENDING',
        rejectReason: null,
      },
    });

    if (fs.existsSync(pluginFile.path)) {
      try {
        fs.unlinkSync(pluginFile.path);
      } catch (_e) {}
    }

    res.status(201).json(newVersion);
  } catch (err) {
    if (pluginFile?.path && fs.existsSync(pluginFile.path)) {
      try {
        fs.unlinkSync(pluginFile.path);
      } catch (_e) {}
    }
    next(err);
  }
};

// GET /api/plugins/:id/versions
export const listPluginVersions = async (req: Request, res: Response, next: NextFunction) => {
  const pluginId = req.params.id as string;
  try {
    const versions = await prisma.pluginVersion.findMany({
      where: { pluginId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(versions);
  } catch (error) {
    next(error);
  }
};

// POST /api/plugins/:id/versions/:versionId/set-active
export const setActivePluginVersion = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const { id: pluginId, versionId } = req.params as { id: string; versionId: string };
  try {
    const plugin = await prisma.plugin.findUnique({ where: { id: pluginId } });
    if (!plugin) return next(new AppError('插件不存在', 404));
    if (plugin.userId !== req.userId && req.user?.role !== 'ADMIN') {
      return next(new AppError('无权操作此插件', 403));
    }

    const version = await prisma.pluginVersion.findFirst({
      where: { id: versionId, pluginId },
    });
    if (!version) return next(new AppError('版本记录不存在', 404));

    // Promote this version record to be the plugin's active published version
    const updated = await prisma.plugin.update({
      where: { id: pluginId },
      data: {
        version: version.version,
        fileUrl: version.fileUrl,
      },
    });

    logger.info(
      `[Plugin] ${pluginId} active version set to ${version.version} by user ${req.userId}`,
    );

    res.json({
      success: true,
      message: `已将 v${version.version} 设为当前推送版本`,
      plugin: { id: updated.id, version: updated.version },
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/plugins/:id/versions/:versionId
export const updatePluginVersion = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { id: pluginId, versionId } = req.params as { id: string; versionId: string };
  const { version: newVersionString, changelog } = req.body as {
    version?: string;
    changelog?: string;
  };

  try {
    const plugin = await prisma.plugin.findUnique({ where: { id: pluginId } });
    if (!plugin) return next(new AppError('插件不存在', 404));
    if (plugin.userId !== req.userId && req.user?.role !== 'ADMIN') {
      return next(new AppError('无权操作此插件', 403));
    }

    const versionItem = await prisma.pluginVersion.findFirst({
      where: { id: versionId, pluginId },
    });
    if (!versionItem) return next(new AppError('版本记录不存在', 404));

    // If version string is changing, check for duplicates
    if (newVersionString && newVersionString !== versionItem.version) {
      const duplicate = await prisma.pluginVersion.findFirst({
        where: { pluginId, version: newVersionString },
      });
      if (duplicate) return next(new AppError('版本号已存在', 400));
    }

    const updatedVersion = await prisma.pluginVersion.update({
      where: { id: versionId },
      data: {
        version: newVersionString || undefined,
        changelog: changelog !== undefined ? changelog : undefined,
      },
    });

    // If this edited version is currently the active version of the plugin, keep them in sync
    if (
      plugin.version === versionItem.version &&
      newVersionString &&
      newVersionString !== versionItem.version
    ) {
      await prisma.plugin.update({
        where: { id: pluginId },
        data: { version: newVersionString },
      });
    }

    res.json(updatedVersion);
  } catch (error) {
    next(error);
  }
};

// DELETE /api/plugins/:id/versions/:versionId
export const deletePluginVersion = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { id: pluginId, versionId } = req.params as { id: string; versionId: string };

  try {
    const plugin = await prisma.plugin.findUnique({ where: { id: pluginId } });
    if (!plugin) return next(new AppError('插件不存在', 404));
    if (plugin.userId !== req.userId && req.user?.role !== 'ADMIN') {
      return next(new AppError('无权操作此插件', 403));
    }

    const versionItem = await prisma.pluginVersion.findFirst({
      where: { id: versionId, pluginId },
    });
    if (!versionItem) return next(new AppError('版本记录不存在', 404));

    // Ensure we don't delete the last version package
    const versionCount = await prisma.pluginVersion.count({ where: { pluginId } });
    if (versionCount <= 1) {
      return next(new AppError('无法删除：插件必须保留至少一个历史版本包', 400));
    }

    // If we are deleting the active version, promote the next latest version to active
    if (plugin.version === versionItem.version) {
      const nextActive = await prisma.pluginVersion.findFirst({
        where: { pluginId, id: { not: versionId } },
        orderBy: { createdAt: 'desc' },
      });
      if (nextActive) {
        await prisma.plugin.update({
          where: { id: pluginId },
          data: {
            version: nextActive.version,
            fileUrl: nextActive.fileUrl,
            fileSize: nextActive.fileSize,
            packageFilesList: nextActive.packageFilesList,
          },
        });
      }
    }

    // Delete the database record
    await prisma.pluginVersion.delete({ where: { id: versionId } });

    // Clean up physical file in background
    if (versionItem.fileUrl) {
      deleteCloudOrLocalFileByUrl(versionItem.fileUrl).catch((err) => {
        logger.error(
          `[PluginController] Failed to delete plugin version file ${versionItem.fileUrl}:`,
          err,
        );
      });
    }

    res.json({ success: true, message: '版本已成功删除' });
  } catch (error) {
    next(error);
  }
};

// GET /api/plugins/client/check-update

export const checkPluginUpdate = async (req: Request, res: Response, next: NextFunction) => {
  const token =
    (req.headers['x-developer-token'] as string) ||
    (req.query.token as string) ||
    (req.body?.token as string);
  const currentVersion = req.query.version as string;

  if (!token) {
    return next(new AppError('developer token is required', 400));
  }

  try {
    const plugin = await prisma.plugin.findUnique({
      where: { developerToken: token },
    });

    if (!plugin) {
      return next(new AppError('Invalid token or plugin not found', 404));
    }

    const latestVersion = plugin.version;
    const updateAvailable = latestVersion !== currentVersion;

    const latestVersionRecord = await prisma.pluginVersion.findFirst({
      where: { pluginId: plugin.id, version: latestVersion },
      orderBy: { createdAt: 'desc' },
    });

    // Build a fully-qualified download URL.
    // fileUrl may be an absolute R2/CDN URL (starts with http) or a relative local path.
    const buildDownloadUrl = (fileUrl: string | null | undefined): string | null => {
      if (!fileUrl) return null;
      if (/^https?:\/\//i.test(fileUrl)) return fileUrl; // already absolute
      const cleanPath = fileUrl.startsWith('/') ? fileUrl : `/${fileUrl}`;
      return `${req.protocol}://${req.get('host')}${cleanPath}`;
    };

    res.json({
      updateAvailable,
      latestVersion,
      downloadUrl: buildDownloadUrl(plugin.fileUrl),
      compatibility: plugin.compatibility,
      changelog: latestVersionRecord?.changelog || '暂无更新日志',
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/plugins/client/feedback
export const createPluginFeedback = async (req: Request, res: Response, next: NextFunction) => {
  const token =
    (req.headers['x-developer-token'] as string) ||
    (req.query.token as string) ||
    (req.body?.token as string);
  const { clientVersion, feedbackType = 'BUG', content } = req.body;

  if (!token) {
    return next(new AppError('developer token is required', 400));
  }
  if (!content) {
    return next(new AppError('content is required', 400));
  }

  try {
    const plugin = await prisma.plugin.findUnique({
      where: { developerToken: token },
    });

    if (!plugin) {
      return next(new AppError('Invalid token or plugin not found', 404));
    }

    const feedback = await prisma.pluginFeedback.create({
      data: {
        pluginId: plugin.id,
        clientVersion: clientVersion || plugin.version,
        feedbackType,
        content,
      },
    });

    res.status(201).json({ success: true, feedback });
  } catch (error) {
    next(error);
  }
};

// GET /api/plugins/requests
export const listPluginRequests = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query as Record<string, unknown>, 20, 50);
    const status = req.query.status as string | undefined;

    const where: Prisma.PluginRequestWhereInput = {};
    if (status && status !== 'ALL') {
      where.status = status;
    }

    const [requests, total] = await Promise.all([
      prisma.pluginRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
          _count: { select: { replies: true } },
        },
      }),
      prisma.pluginRequest.count({ where }),
    ]);

    res.json({ requests, pagination: createPaginationMeta(page, limit, total) });
  } catch (error) {
    next(error);
  }
};

// GET /api/plugins/requests/:id
export const getPluginRequestById = async (req: Request, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  try {
    const request = await prisma.pluginRequest.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
        replies: {
          orderBy: { createdAt: 'asc' },
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
            linkedPlugin: {
              select: { id: true, title: true, version: true, previewUrl: true, downloads: true },
            },
          },
        },
      },
    });

    if (!request) {
      return next(new AppError('求助帖不存在', 404));
    }

    res.json(request);
  } catch (error) {
    next(error);
  }
};

// POST /api/plugins/requests
export const createPluginRequest = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { title, description } = req.body;
  if (!title?.trim() || !description?.trim()) {
    return next(new AppError('标题和内容为必填项', 400));
  }

  try {
    const request = await prisma.pluginRequest.create({
      data: {
        title: title.trim(),
        description: description.trim(),
        userId: req.userId!,
        status: 'OPEN',
      },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
        _count: { select: { replies: true } },
      },
    });

    res.status(201).json(request);
  } catch (error) {
    next(error);
  }
};

// POST /api/plugins/requests/:id/replies
export const createPluginRequestReply = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const requestId = req.params.id as string;
  const { content, linkedPluginId } = req.body;

  if (!content?.trim()) {
    return next(new AppError('回复内容不能为空', 400));
  }

  try {
    const request = await prisma.pluginRequest.findUnique({ where: { id: requestId } });
    if (!request) return next(new AppError('求助帖不存在', 404));

    if (linkedPluginId) {
      const plugin = await prisma.plugin.findFirst({
        where: { id: linkedPluginId, status: 'APPROVED' },
      });
      if (!plugin) return next(new AppError('关联的插件不存在或未被批准发布', 400));
    }

    const reply = await prisma.pluginRequestReply.create({
      data: {
        requestId,
        userId: req.userId!,
        content: content.trim(),
        linkedPluginId: linkedPluginId || null,
      },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
        linkedPlugin: {
          select: { id: true, title: true, version: true, previewUrl: true, downloads: true },
        },
      },
    });

    res.status(201).json(reply);
  } catch (error) {
    next(error);
  }
};

// POST /api/plugins/requests/:id/resolve
export const resolvePluginRequest = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const requestId = req.params.id as string;
  try {
    const request = await prisma.pluginRequest.findUnique({ where: { id: requestId } });
    if (!request) return next(new AppError('求助帖不存在', 404));

    if (request.userId !== req.userId && req.user?.role !== 'ADMIN') {
      return next(new AppError('无权关闭此求助贴', 403));
    }

    const updated = await prisma.pluginRequest.update({
      where: { id: requestId },
      data: { status: 'RESOLVED' },
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
};

export const bulkDeletePlugins = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: '请提供要删除的插件 ID 列表' });
    }

    const whereCondition: any = {
      id: { in: ids },
    };
    if (req.user?.role !== 'ADMIN') {
      whereCondition.userId = req.userId;
    }

    const pluginsToDelete = await prisma.plugin.findMany({
      where: whereCondition,
    });

    if (pluginsToDelete.length === 0) {
      return res.status(404).json({ error: '未找到可删除的插件或无权操作' });
    }

    for (const plugin of pluginsToDelete) {
      for (const urlField of [plugin.fileUrl, plugin.previewUrl]) {
        if (urlField) {
          deleteCloudOrLocalFileByUrl(urlField).catch((err) => {
            logger.error(`[PluginController] Bulk delete: failed to delete file ${urlField}:`, err);
          });
        }
      }
    }

    const deleteIds = pluginsToDelete.map((p) => p.id);
    await prisma.plugin.deleteMany({
      where: { id: { in: deleteIds } },
    });

    res.json({
      success: true,
      message: `成功批量删除 ${deleteIds.length} 个插件`,
      count: deleteIds.length,
      deletedIds: deleteIds,
    });
  } catch (error) {
    next(error);
  }
};

export const bulkFavoritePlugins = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.userId as string;
    const rawIds: unknown[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const categoryVal = typeof req.body?.category === 'string' ? req.body.category.trim() : '默认';
    const category = categoryVal || '默认';
    const ids = Array.from(
      new Set<string>(rawIds.map((id) => String(id)).filter((id) => Boolean(id))),
    ).slice(0, 100);
    const favorite = req.body?.favorite !== false;

    if (!ids.length) {
      return next(new AppError('No plugins selected', 400));
    }

    const approvedPlugins = await prisma.plugin.findMany({
      where: {
        id: { in: ids },
        status: 'APPROVED',
      },
      select: { id: true },
    });
    const approvedIds = approvedPlugins.map((plugin) => plugin.id);

    if (favorite) {
      await prisma.pluginFavorite.createMany({
        data: approvedIds.map((pluginId) => ({ userId, pluginId, category })),
        skipDuplicates: true,
      });

      if (category !== '默认') {
        const customCats = await getCustomCategories(userId);
        if (!customCats.includes(category)) {
          customCats.push(category);
          await saveCustomCategories(userId, customCats);
        }
      }
    } else {
      await prisma.pluginFavorite.deleteMany({
        where: { userId, pluginId: { in: approvedIds } },
      });
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};
