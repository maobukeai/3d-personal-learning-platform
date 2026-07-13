import type { FastifyRequest, FastifyReply } from 'fastify';

import { Prisma } from '@prisma/client';
import { AppError } from '../utils/error';
import prisma from '../services/prisma';
import crypto from 'crypto';
import { logger } from '../utils/logger';
import { getPaginationParams, createPaginationMeta } from '../utils/pagination';
import path from 'path';
import {
  deleteCloudOrLocalFileByUrl,
  getZipFileNames,
  parseZipBuffer,
  moveTempFileToDestination,
  getFileSizeInMb,
  safeUnlink,
  getUploadedFileUrl,
} from '../utils/file';
import { parseTags } from '../utils/tags';

import { parseBool } from '../utils/parser';
type AccessResult = { ok: true } | { ok: false; status: 404 | 403; message: string };
import {
  createFavoriteCategoryHandlers,
  type FavoriteModelDelegate,
} from './shared/favorites.factory';

/**
 * 将 Fastify request 适配为 auditService / file utils 所需的 Express Request。
 * 这些工具函数仅读取 headers / ip / socket，Fastify request 上均可用。
 */
const asExpressReq = (request: FastifyRequest): FastifyRequest => request;

// ── Favorites category factory (eliminates duplicate category CRUD handlers) ───
// Only pull the reusable helpers from the factory; the Express-signature
// createCategory/updateCategory/deleteCategory are replaced by Fastify-native
// wrappers below so we can drop the adaptHandler bridge entirely.
const { readCategories: getCustomCategories, persistCategoryIfNew } =
  createFavoriteCategoryHandlers({
    delegate: prisma.pluginFavorite as unknown as FavoriteModelDelegate,
    settingsKey: 'plugin_favorite_categories',
    resourceLabel: '插件',
  });

const PLUGIN_FAV_CAT_SETTING_KEY = 'plugin_favorite_categories';

const savePluginFavoriteCategories = async (
  userId: string,
  categories: string[],
): Promise<void> => {
  const uniqueCats = Array.from(new Set(categories.map((c) => c.trim()).filter(Boolean)));
  await prisma.userSetting.upsert({
    where: { userId_key: { userId, key: PLUGIN_FAV_CAT_SETTING_KEY } },
    update: { value: JSON.stringify(uniqueCats) },
    create: { userId, key: PLUGIN_FAV_CAT_SETTING_KEY, value: JSON.stringify(uniqueCats) },
  });
};

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
export const listPlugins = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
  const query = request.query as Record<string, string | undefined>;
  const { page, limit, skip } = getPaginationParams(query, 20, 50);
  const category = query.category as string | undefined;
  const search = query.search as string | undefined;

  const mine = query.mine === 'true';
  const favoritesOnly = query.favoritesOnly === 'true';
  const favoriteCategory = query.favoriteCategory as string | undefined;
  const status = query.status as string;
  const userId = request.userId as string;

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

  reply.send({ plugins, pagination: createPaginationMeta(page, limit, total) });
};

export const getPluginById = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const { id } = request.params as { id: string };
  const plugin = await prisma.plugin.findFirst({
    where: {
      id,
      OR:
        request.user?.role === 'ADMIN'
          ? undefined
          : [{ status: 'APPROVED' }, { userId: request.userId as string }],
    },
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  });

  if (!plugin) throw new AppError('插件不存在', 404);

  reply.send(plugin);
};

// ── Plugin marketplace insights ───────────────────────────────────────────────
export const getPluginInsights = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const userId = request.userId as string;
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

  reply.send({
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
};

// ── My plugins ─────────────────────────────────────────────────────────────────
export const getMyPlugins = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
  const plugins = await prisma.plugin.findMany({
    where: { userId: request.userId! },
    orderBy: { createdAt: 'desc' },
  });
  reply.send(plugins);
};

// ── My favorite plugins ───────────────────────────────────────────────────────
export const getMyFavoritePlugins = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const userId = request.userId as string;
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

  reply.send({
    ids: favorites.map((f) => f.pluginId),
    favorites: favorites.map((f) => ({
      id: f.id,
      category: f.category,
      plugin: f.plugin,
    })),
    categories: Array.from(categoriesSet),
  });
};

// ── Favorites category CRUD (Fastify-native, replaces factory Express handlers) ─
export const createPluginFavoriteCategory = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const userId = request.userId as string;
  const { category } = request.body as { category?: string };

  if (!category?.trim()) {
    throw new AppError('分类名称不能为空', 400);
  }
  const newCat = category.trim();
  if (newCat === '默认') {
    throw new AppError('不能创建默认分类', 400);
  }

  const customCats = await getCustomCategories(userId);
  if (!customCats.includes(newCat)) {
    customCats.push(newCat);
    await savePluginFavoriteCategories(userId, customCats);
  }
  reply.send({ success: true, message: '分类创建成功', categories: ['默认', ...customCats] });
};

export const updatePluginFavoriteCategory = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const userId = request.userId as string;
  const { oldCategory, newCategory } = request.body as {
    oldCategory?: string;
    newCategory?: string;
  };

  if (!oldCategory || !newCategory) {
    throw new AppError('缺少必要参数', 400);
  }
  const oldCat = oldCategory.trim();
  const newCat = newCategory.trim();

  if (oldCat === '默认' || newCat === '默认') {
    throw new AppError('不能重命名默认分类', 400);
  }

  await prisma.pluginFavorite.updateMany({
    where: { userId, category: oldCat },
    data: { category: newCat },
  });
  const customCats = await getCustomCategories(userId);
  const updatedCats = customCats.map((c) => (c === oldCat ? newCat : c));
  await savePluginFavoriteCategories(userId, updatedCats);
  reply.send({ success: true, message: '分类更新成功' });
};

export const deletePluginFavoriteCategory = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const userId = request.userId as string;
  const { categoryName } = request.params as { categoryName: string };

  if (!categoryName) {
    throw new AppError('缺少分类名称', 400);
  }
  const cat = categoryName.trim();
  if (cat === '默认') {
    throw new AppError('不能删除默认分类', 400);
  }

  await prisma.pluginFavorite.deleteMany({ where: { userId, category: cat } });
  const customCats = await getCustomCategories(userId);
  const filteredCats = customCats.filter((c) => c !== cat);
  await savePluginFavoriteCategories(userId, filteredCats);
  reply.send({ success: true, message: '分类删除成功' });
};

export const togglePluginFavorite = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const { id } = request.params as { id: string };
  const body = request.body as { category?: string } | undefined;
  const categoryVal = typeof body?.category === 'string' ? body.category.trim() : '默认';
  const category = categoryVal || '默认';
  const userId = request.userId as string;

  const plugin = await prisma.plugin.findFirst({
    where: { id, status: 'APPROVED' },
    select: { id: true },
  });
  if (!plugin) throw new AppError('插件不存在', 404);

  await migrateOldFavoritesIfNeeded(userId);

  const existing = await prisma.pluginFavorite.findUnique({
    where: { userId_pluginId: { userId, pluginId: id } },
  });

  let isFavorited: boolean;
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
    await persistCategoryIfNew(userId, category);
  }

  const favorites = await prisma.pluginFavorite.findMany({
    where: { userId },
    select: { pluginId: true },
  });

  reply.send({
    isFavorited,
    favoriteIds: favorites.map((f) => f.pluginId),
  });
};

// ── Upload / create plugin ─────────────────────────────────────────────────────
export const uploadPlugin = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
  const files = (
    request as unknown as {
      files?: { [fieldname: string]: Express.Multer.File[] };
    }
  ).files;
  const pluginFile = files?.plugin_file?.[0] || files?.file?.[0];
  const previewFile = files?.plugin_preview?.[0] || files?.preview?.[0];

  const body = request.body as {
    title?: string;
    description?: string;
    category?: string;
    version?: string;
    compatibility?: string;
    tags?: string;
    installGuide?: string;
    originality?: string;
    originalAuthor?: string;
    originalLink?: string;
    license?: string;
    isFree?: unknown;
    linkedCourseId?: string;
    linkedLessonId?: string;
    externalUrl?: string;
    tempPluginPath?: string;
    tempPreviewPath?: string;
    packageFilesList?: string;
    fileSize?: string;
    bilibiliUrl?: string;
  };
  const externalUrl = body.externalUrl;
  let tempPluginPath = body.tempPluginPath;
  let tempPreviewPath = body.tempPreviewPath;

  if (!pluginFile && !tempPluginPath && !externalUrl) {
    throw new AppError('请上传插件文件或提供外部链接', 400);
  }

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
  } = body;

  if (!title?.trim()) {
    await safeUnlink(pluginFile?.path);
    await safeUnlink(previewFile?.path);
    throw new AppError('插件名称为必填项', 400);
  }

  if (tempPluginPath) {
    tempPluginPath = moveTempFileToDestination(asExpressReq(request), tempPluginPath, 'plugins');
  }
  if (tempPreviewPath) {
    tempPreviewPath = moveTempFileToDestination(asExpressReq(request), tempPreviewPath, 'plugins');
  }

  let packageFilesList: string[] = [];
  if (body.packageFilesList) {
    try {
      packageFilesList = JSON.parse(body.packageFilesList);
    } catch (_err) {
      // ignore
    }
  }

  if (packageFilesList.length === 0) {
    if (pluginFile) {
      const ext = path.extname(pluginFile.originalname).toLowerCase();
      if (ext === '.zip') {
        if (pluginFile.buffer) {
          try {
            packageFilesList = await parseZipBuffer(pluginFile.buffer);
          } catch (zipErr) {
            logger.error('[PluginCreate] Failed to parse package ZIP from buffer:', zipErr);
          }
        }
      }
    }
    // 铁律二·1：tempPluginPath 是云 URL（已直传 R2），本地路径已被
    // moveTempFileToDestination 硬墙拦截，无需再解析本地 ZIP
  }

  const fileUrl = pluginFile
    ? getUploadedFileUrl(asExpressReq(request), pluginFile, 'plugins')
    : tempPluginPath || externalUrl || '';

  let fileSizeMb = body.fileSize ? parseFloat(body.fileSize) / (1024 * 1024) : 0;
  if (fileSizeMb === 0) {
    fileSizeMb = pluginFile ? pluginFile.size / (1024 * 1024) : 0;
    if (!pluginFile && tempPluginPath) {
      fileSizeMb = await getFileSizeInMb(tempPluginPath);
    }
  }
  if (!Number.isFinite(fileSizeMb) || fileSizeMb < 0) {
    fileSizeMb = 0;
  }

  const previewUrl = previewFile
    ? getUploadedFileUrl(asExpressReq(request), previewFile, 'plugins')
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
      userId: request.userId!,
      status: 'PENDING',
      originality: originality || 'ORIGINAL',
      originalAuthor: originalAuthor || null,
      originalLink: originalLink || null,
      license: license || 'CC_BY',
      isFree: parseBool(isFree, true),
      linkedCourseId: linkedCourseId || null,
      linkedLessonId: linkedLessonId || null,
      bilibiliUrl: body.bilibiliUrl || null,
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
  await safeUnlink(pluginFile?.path);

  logger.info(`[Plugin] User ${request.userId} uploaded plugin: ${plugin.id}`);
  reply.status(201).send(plugin);
};

export const updatePlugin = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
  const files = (
    request as unknown as {
      files?: { [fieldname: string]: Express.Multer.File[] };
    }
  ).files;
  const pluginFile = files?.plugin_file?.[0] || files?.file?.[0];
  const previewFile = files?.plugin_preview?.[0] || files?.preview?.[0];

  const body = request.body as {
    title?: string;
    description?: string;
    category?: string;
    version?: string;
    compatibility?: string;
    tags?: string;
    installGuide?: string;
    originality?: string;
    originalAuthor?: string;
    originalLink?: string;
    license?: string;
    isFree?: unknown;
    linkedCourseId?: string;
    linkedLessonId?: string;
    externalUrl?: string;
    tempPluginPath?: string;
    tempPreviewPath?: string;
    packageFilesList?: string;
    fileSize?: string;
    bilibiliUrl?: string;
  };
  const externalUrl = body.externalUrl;

  const { id } = request.params as { id: string };
  let tempPluginPath = body.tempPluginPath;
  let tempPreviewPath = body.tempPreviewPath;

  if (tempPluginPath) {
    tempPluginPath = moveTempFileToDestination(asExpressReq(request), tempPluginPath, 'plugins');
  }
  if (tempPreviewPath) {
    tempPreviewPath = moveTempFileToDestination(asExpressReq(request), tempPreviewPath, 'plugins');
  }

  const existing = await prisma.plugin.findUnique({ where: { id } });

  if (!existing) {
    await safeUnlink(pluginFile?.path);
    await safeUnlink(previewFile?.path);
    throw new AppError('插件不存在', 404);
  }
  if (existing.userId !== request.userId && request.user?.role !== 'ADMIN') {
    await safeUnlink(pluginFile?.path);
    await safeUnlink(previewFile?.path);
    throw new AppError('无权修改此插件', 403);
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
  const bodyRecord = body as Record<string, unknown>;
  for (const field of allowed) {
    if (bodyRecord[field] !== undefined) updateData[field] = bodyRecord[field];
  }

  // If version is changed but no new file is uploaded, switch the active file mapping to that version's files
  if (body.version && !pluginFile && !externalUrl) {
    const targetVersionRecord = await prisma.pluginVersion.findFirst({
      where: {
        pluginId: id,
        version: body.version,
      },
    });
    if (targetVersionRecord) {
      updateData.fileUrl = targetVersionRecord.fileUrl;
      updateData.fileSize = targetVersionRecord.fileSize;
      updateData.packageFilesList = targetVersionRecord.packageFilesList;
    }
  }

  if (body.linkedCourseId !== undefined) {
    updateData.linkedCourseId = body.linkedCourseId || null;
  }
  if (body.linkedLessonId !== undefined) {
    updateData.linkedLessonId = body.linkedLessonId || null;
  }

  if (body.isFree !== undefined) {
    updateData.isFree = parseBool(body.isFree, true);
  }

  let packageFilesList: string[] = [];
  if (body.packageFilesList) {
    try {
      packageFilesList = JSON.parse(body.packageFilesList);
    } catch (_err) {
      // ignore
    }
  }

  // Check if new plugin file is uploaded
  if (pluginFile) {
    if (existing.fileUrl) {
      const targetVersion = body.version || existing.version;
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
    const fileUrl = getUploadedFileUrl(asExpressReq(request), pluginFile, 'plugins');
    const fileSizeMb = body.fileSize
      ? parseFloat(body.fileSize) / (1024 * 1024)
      : pluginFile.size / (1024 * 1024);
    updateData.fileUrl = fileUrl;
    updateData.fileSize = fileSizeMb;

    if (packageFilesList.length === 0) {
      const ext = path.extname(pluginFile.originalname).toLowerCase();
      if (ext === '.zip') {
        if (pluginFile.buffer) {
          try {
            packageFilesList = await parseZipBuffer(pluginFile.buffer);
          } catch (zipErr) {
            logger.error('[PluginUpdate] Failed to parse package ZIP from buffer:', zipErr);
          }
        }
      }
    }
    updateData.packageFilesList =
      packageFilesList.length > 0 ? JSON.stringify(packageFilesList) : null;

    // Clean up local temp file
    await safeUnlink(pluginFile.path);
  } else if (tempPluginPath) {
    if (existing.fileUrl) {
      const targetVersion = body.version || existing.version;
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

    let fileSizeMb = body.fileSize ? parseFloat(body.fileSize) / (1024 * 1024) : 0;
    if (fileSizeMb === 0) {
      fileSizeMb = await getFileSizeInMb(tempPluginPath);
    }

    updateData.fileUrl = tempPluginPath;
    updateData.fileSize = fileSizeMb;

    // 铁律二·1：tempPluginPath 是云 URL（已直传 R2），本地路径已被
    // moveTempFileToDestination 硬墙拦截，无需再解析本地 ZIP
    updateData.packageFilesList =
      packageFilesList.length > 0 ? JSON.stringify(packageFilesList) : null;
  } else if (externalUrl !== undefined) {
    if (externalUrl && existing.fileUrl) {
      const targetVersion = body.version || existing.version;
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
    const previewUrl = getUploadedFileUrl(asExpressReq(request), previewFile, 'plugins');
    updateData.previewUrl = previewUrl;

    // Clean up local temp file
    await safeUnlink(previewFile.path);
  } else if (tempPreviewPath) {
    if (existing.previewUrl) {
      deleteCloudOrLocalFileByUrl(existing.previewUrl).catch(() => {});
    }
    updateData.previewUrl = tempPreviewPath;
  }

  // Editing resets to PENDING for re-review unless editor is ADMIN
  updateData.status = request.user?.role === 'ADMIN' ? 'APPROVED' : 'PENDING';
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

  reply.send(plugin);
};

// ── Delete plugin (owner only) ─────────────────────────────────────────────────
export const deletePlugin = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
  const { id } = request.params as { id: string };
  const existing = await prisma.plugin.findUnique({ where: { id } });

  if (!existing) throw new AppError('插件不存在', 404);
  if (existing.userId !== request.userId) throw new AppError('无权删除此插件', 403);

  // Remove files (run in background)
  const fileSizeBytes = existing.fileSize ? Math.round(existing.fileSize * 1024 * 1024) : undefined;
  if (existing.fileUrl) {
    deleteCloudOrLocalFileByUrl(existing.fileUrl, fileSizeBytes).catch((err) => {
      logger.error(`[PluginController] Failed to delete plugin file in background:`, err);
    });
  }
  if (existing.previewUrl) {
    deleteCloudOrLocalFileByUrl(existing.previewUrl).catch((err) => {
      logger.error(`[PluginController] Failed to delete plugin preview in background:`, err);
    });
  }

  await prisma.plugin.delete({ where: { id } });
  reply.send({ message: '插件已删除' });
};

// ── Record download ────────────────────────────────────────────────────────────
export const downloadPlugin = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const { id } = request.params as { id: string };
  const plugin = await prisma.plugin.findUnique({ where: { id } });
  if (!plugin) throw new AppError('插件不存在', 404);

  const isOwner = plugin.userId === request.userId;
  const isAdmin = request.user?.role === 'ADMIN';
  if (plugin.status !== 'APPROVED' && !isOwner && !isAdmin) {
    throw new AppError('插件不存在', 404);
  }

  await prisma.plugin.update({ where: { id }, data: { downloads: { increment: 1 } } });
  reply.send({ fileUrl: plugin.fileUrl });
};

// GET /api/plugins/:id/package-files - non-blocking, cached ZIP file listing
export const getPluginPackageFiles = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const id = (request.params as { id: string }).id;
  const plugin = await prisma.plugin.findFirst({
    where: {
      id,
      OR:
        request.user?.role === 'ADMIN'
          ? undefined
          : [{ status: 'APPROVED' }, { userId: request.userId as string }],
    },
    select: { fileUrl: true, packageFilesList: true },
  });

  if (!plugin) {
    throw new AppError('Plugin not found or access denied', 404);
  }

  if (!plugin.fileUrl) {
    reply.send({ packageFiles: [] });
    return;
  }

  if (plugin.packageFilesList) {
    try {
      const files = JSON.parse(plugin.packageFilesList);
      if (Array.isArray(files)) {
        reply.send({ packageFiles: files });
        return;
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
        logger.error(`[Plugin] Failed to update packageFilesList fallback for plugin ${id}:`, err);
      });
  }

  reply.send({ packageFiles });
};

// ── Plugin comments (inline — replaces createCommentController factory usage) ──
const verifyPluginAccess = async (
  request: FastifyRequest,
  pluginId: string,
): Promise<AccessResult> => {
  const plugin = await prisma.plugin.findFirst({
    where: {
      id: pluginId,
      OR:
        request.user?.role === 'ADMIN'
          ? undefined
          : [{ status: 'APPROVED' }, { userId: request.userId as string }],
    },
  });

  if (!plugin) {
    return { ok: false, status: 404, message: 'Plugin not found or access denied' };
  }

  return { ok: true };
};

export const getPluginComments = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const pluginId = (request.params as { id: string }).id;
  const access = await verifyPluginAccess(request, pluginId);
  if (!access.ok) {
    throw new AppError(access.message, access.status);
  }

  const comments = await prisma.pluginComment.findMany({
    where: { pluginId },
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    orderBy: { createdAt: 'asc' },
  });

  reply.send(comments);
};

export const createPluginComment = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const pluginId = (request.params as { id: string }).id;
  const { content } = request.body as { content: string };

  if (!content || !content.trim()) {
    throw new AppError('Comment content cannot be empty', 400);
  }

  const access = await verifyPluginAccess(request, pluginId);
  if (!access.ok) {
    throw new AppError(access.message, access.status);
  }

  const comment = await prisma.pluginComment.create({
    data: {
      content: content.trim(),
      pluginId,
      userId: request.userId as string,
    },
    include: {
      user: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  reply.status(201).send(comment);
};

export const deletePluginComment = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const { commentId } = request.params as { commentId: string };

  const comment = await prisma.pluginComment.findUnique({
    where: { id: commentId },
  });

  if (!comment) {
    throw new AppError('Comment not found', 404);
  }

  if (comment.userId !== request.userId && request.user?.role !== 'ADMIN') {
    throw new AppError('Forbidden', 403);
  }

  await prisma.pluginComment.delete({
    where: { id: commentId },
  });

  reply.send({ message: 'Comment deleted successfully' });
};

// GET /api/plugins/:id/share
export const getPluginShare = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const pluginId = (request.params as { id: string }).id;
  const plugin = await prisma.plugin.findFirst({
    where:
      request.user?.role === 'ADMIN'
        ? { id: pluginId }
        : { id: pluginId, userId: request.userId as string },
  });
  if (!plugin) {
    throw new AppError('Plugin not found or access denied', 404);
  }
  const share = await prisma.pluginShare.findUnique({
    where: { pluginId },
  });
  reply.send(share);
};

// POST /api/plugins/:id/share
export const createOrUpdatePluginShare = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const pluginId = (request.params as { id: string }).id;
  const userId = request.userId as string;
  const { expireHours, expiresAt, customText } = request.body as {
    expireHours?: number;
    expiresAt?: string;
    customText?: string;
  };

  const plugin = await prisma.plugin.findFirst({
    where:
      request.user?.role === 'ADMIN'
        ? { id: pluginId }
        : { id: pluginId, userId: request.userId as string },
  });
  if (!plugin) {
    throw new AppError('Plugin not found or access denied', 404);
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

  reply.send(share);
};

// DELETE /api/plugins/:id/share
export const cancelPluginShare = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const pluginId = (request.params as { id: string }).id;
  const plugin = await prisma.plugin.findFirst({
    where:
      request.user?.role === 'ADMIN'
        ? { id: pluginId }
        : { id: pluginId, userId: request.userId as string },
  });
  if (!plugin) {
    throw new AppError('Plugin not found or access denied', 404);
  }

  await prisma.pluginShare.deleteMany({
    where: { pluginId },
  });
  reply.send({ success: true, message: 'Share link cancelled' });
};

// GET /api/plugins/share/:shareId
export const getPublicSharedPlugin = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const shareId = (request.params as { shareId: string }).shareId;
  reply.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
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
    reply.status(404).send({ error: '分享链接不存在或已失效' });
    return;
  }

  if (share.expiresAt && new Date() > share.expiresAt) {
    reply.status(410).send({ error: '分享链接已过期且失效' });
    return;
  }

  reply.send(share);
};

// POST /api/plugins/:id/token
export const generateDeveloperToken = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const pluginId = (request.params as { id: string }).id;
  const plugin = await prisma.plugin.findUnique({ where: { id: pluginId } });
  if (!plugin) throw new AppError('插件不存在', 404);
  if (plugin.userId !== request.userId && request.user?.role !== 'ADMIN') {
    throw new AppError('无权操作此插件', 403);
  }

  const token = 'plg_' + crypto.randomUUID().replace(/-/g, '');
  const updated = await prisma.plugin.update({
    where: { id: pluginId },
    data: { developerToken: token },
  });

  reply.send({ developerToken: updated.developerToken });
};

// GET /api/plugins/:id/feedbacks
export const listPluginFeedbacks = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const pluginId = (request.params as { id: string }).id;
  const plugin = await prisma.plugin.findUnique({ where: { id: pluginId } });
  if (!plugin) throw new AppError('插件不存在', 404);
  if (plugin.userId !== request.userId && request.user?.role !== 'ADMIN') {
    throw new AppError('无权操作此插件', 403);
  }

  const feedbacks = await prisma.pluginFeedback.findMany({
    where: { pluginId },
    orderBy: { createdAt: 'desc' },
  });

  reply.send(feedbacks);
};

// DELETE /api/plugins/:id/feedbacks/:feedbackId
export const deletePluginFeedback = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const { id: pluginId, feedbackId } = request.params as { id: string; feedbackId: string };
  const plugin = await prisma.plugin.findUnique({ where: { id: pluginId } });
  if (!plugin) throw new AppError('插件不存在', 404);
  if (plugin.userId !== request.userId && request.user?.role !== 'ADMIN') {
    throw new AppError('无权操作此反馈', 403);
  }

  const feedback = await prisma.pluginFeedback.findFirst({
    where: { id: feedbackId, pluginId },
  });
  if (!feedback) throw new AppError('反馈记录不存在', 404);

  await prisma.pluginFeedback.delete({ where: { id: feedbackId } });
  reply.send({ success: true, message: '反馈已成功删除' });
};

// DELETE /api/plugins/:id/feedbacks
export const clearPluginFeedbacks = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const pluginId = (request.params as { id: string }).id;
  const plugin = await prisma.plugin.findUnique({ where: { id: pluginId } });
  if (!plugin) throw new AppError('插件不存在', 404);
  if (plugin.userId !== request.userId && request.user?.role !== 'ADMIN') {
    throw new AppError('无权清除此反馈列表', 403);
  }

  await prisma.pluginFeedback.deleteMany({
    where: { pluginId },
  });
  reply.send({ success: true, message: '反馈列表已清空' });
};

// POST /api/plugins/:id/versions
export const uploadPluginVersion = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const pluginId = (request.params as { id: string }).id;
  const files = (
    request as unknown as {
      files?: { [fieldname: string]: Express.Multer.File[] };
    }
  ).files;
  const pluginFile = files?.plugin_file?.[0] || files?.file?.[0];

  if (!pluginFile) {
    throw new AppError('请上传插件包文件', 400);
  }

  const body = request.body as { version?: string; changelog?: string };
  const { version, changelog } = body;
  if (!version) {
    await safeUnlink(pluginFile.path);
    throw new AppError('版本号为必填项', 400);
  }

  const fileUrl = getUploadedFileUrl(asExpressReq(request), pluginFile, 'plugins');
  const fileSizeMb = pluginFile.size / (1024 * 1024);

  let packageFilesList: string[] = [];
  const ext = path.extname(pluginFile.originalname).toLowerCase();
  if (ext === '.zip') {
    if (pluginFile.buffer) {
      try {
        packageFilesList = await parseZipBuffer(pluginFile.buffer);
      } catch (zipErr) {
        logger.error('[PluginVersionCreate] Failed to parse package ZIP from buffer:', zipErr);
      }
    }
  }

  const newVersion = await prisma.$transaction(async (tx) => {
    const plugin = await tx.plugin.findUnique({ where: { id: pluginId } });
    if (!plugin) {
      throw new AppError('插件不存在', 404);
    }
    if (plugin.userId !== request.userId && request.user?.role !== 'ADMIN') {
      throw new AppError('无权操作此插件', 403);
    }

    const nv = await tx.pluginVersion.create({
      data: {
        pluginId,
        version,
        changelog: changelog || null,
        fileUrl,
        fileSize: fileSizeMb,
        packageFilesList: packageFilesList.length > 0 ? JSON.stringify(packageFilesList) : null,
      },
    });

    await tx.plugin.update({
      where: { id: pluginId },
      data: {
        version,
        fileUrl,
        fileSize: fileSizeMb,
        packageFilesList: packageFilesList.length > 0 ? JSON.stringify(packageFilesList) : null,
        status: 'PENDING',
        rejectReason: null,
      },
    });

    return nv;
  });

  await safeUnlink(pluginFile.path);

  reply.status(201).send(newVersion);
};

// GET /api/plugins/:id/versions
export const listPluginVersions = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const pluginId = (request.params as { id: string }).id;
  const versions = await prisma.pluginVersion.findMany({
    where: { pluginId },
    orderBy: { createdAt: 'desc' },
  });
  reply.send(versions);
};

// POST /api/plugins/:id/versions/:versionId/set-active
export const setActivePluginVersion = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const { id: pluginId, versionId } = request.params as { id: string; versionId: string };
  const plugin = await prisma.plugin.findUnique({ where: { id: pluginId } });
  if (!plugin) throw new AppError('插件不存在', 404);
  if (plugin.userId !== request.userId && request.user?.role !== 'ADMIN') {
    throw new AppError('无权操作此插件', 403);
  }

  const version = await prisma.pluginVersion.findFirst({
    where: { id: versionId, pluginId },
  });
  if (!version) throw new AppError('版本记录不存在', 404);

  // Promote this version record to be the plugin's active published version
  const updated = await prisma.plugin.update({
    where: { id: pluginId },
    data: {
      version: version.version,
      fileUrl: version.fileUrl,
    },
  });

  logger.info(
    `[Plugin] ${pluginId} active version set to ${version.version} by user ${request.userId}`,
  );

  reply.send({
    success: true,
    message: `已将 v${version.version} 设为当前推送版本`,
    plugin: { id: updated.id, version: updated.version },
  });
};

// PUT /api/plugins/:id/versions/:versionId
export const updatePluginVersion = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const { id: pluginId, versionId } = request.params as { id: string; versionId: string };
  const { version: newVersionString, changelog } = request.body as {
    version?: string;
    changelog?: string;
  };

  const plugin = await prisma.plugin.findUnique({ where: { id: pluginId } });
  if (!plugin) throw new AppError('插件不存在', 404);
  if (plugin.userId !== request.userId && request.user?.role !== 'ADMIN') {
    throw new AppError('无权操作此插件', 403);
  }

  const versionItem = await prisma.pluginVersion.findFirst({
    where: { id: versionId, pluginId },
  });
  if (!versionItem) throw new AppError('版本记录不存在', 404);

  // If version string is changing, check for duplicates
  if (newVersionString && newVersionString !== versionItem.version) {
    const duplicate = await prisma.pluginVersion.findFirst({
      where: { pluginId, version: newVersionString },
    });
    if (duplicate) throw new AppError('版本号已存在', 400);
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

  reply.send(updatedVersion);
};

// DELETE /api/plugins/:id/versions/:versionId
export const deletePluginVersion = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const { id: pluginId, versionId } = request.params as { id: string; versionId: string };

  const plugin = await prisma.plugin.findUnique({ where: { id: pluginId } });
  if (!plugin) throw new AppError('插件不存在', 404);
  if (plugin.userId !== request.userId && request.user?.role !== 'ADMIN') {
    throw new AppError('无权操作此插件', 403);
  }

  const versionItem = await prisma.pluginVersion.findFirst({
    where: { id: versionId, pluginId },
  });
  if (!versionItem) throw new AppError('版本记录不存在', 404);

  // Ensure we don't delete the last version package
  const versionCount = await prisma.pluginVersion.count({ where: { pluginId } });
  if (versionCount <= 1) {
    throw new AppError('无法删除：插件必须保留至少一个历史版本包', 400);
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

  reply.send({ success: true, message: '版本已成功删除' });
};

// GET /api/plugins/client/check-update
export const checkPluginUpdate = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const query = request.query as Record<string, string | undefined>;
  const body = (request.body as Record<string, string> | undefined) ?? {};
  const token = (request.headers['x-developer-token'] as string) || query.token || body.token;
  const currentVersion = query.version;

  if (!token) {
    throw new AppError('developer token is required', 400);
  }

  const plugin = await prisma.plugin.findUnique({
    where: { developerToken: token },
  });

  if (!plugin) {
    throw new AppError('Invalid token or plugin not found', 404);
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
    const host = request.headers.host || '';
    return `${request.protocol}://${host}${cleanPath}`;
  };

  reply.send({
    updateAvailable,
    latestVersion,
    downloadUrl: buildDownloadUrl(plugin.fileUrl),
    compatibility: plugin.compatibility,
    changelog: latestVersionRecord?.changelog || '暂无更新日志',
  });
};

// POST /api/plugins/client/feedback
export const createPluginFeedback = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const query = request.query as Record<string, string | undefined>;
  const body =
    (request.body as {
      token?: string;
      clientVersion?: string;
      feedbackType?: string;
      content?: string;
    }) ?? {};
  const token = (request.headers['x-developer-token'] as string) || query.token || body.token;
  const { clientVersion, feedbackType = 'BUG', content } = body;

  if (!token) {
    throw new AppError('developer token is required', 400);
  }
  if (!content) {
    throw new AppError('content is required', 400);
  }

  const plugin = await prisma.plugin.findUnique({
    where: { developerToken: token },
  });

  if (!plugin) {
    throw new AppError('Invalid token or plugin not found', 404);
  }

  const feedback = await prisma.pluginFeedback.create({
    data: {
      pluginId: plugin.id,
      clientVersion: clientVersion || plugin.version,
      feedbackType,
      content,
    },
  });

  reply.status(201).send({ success: true, feedback });
};

// GET /api/plugins/requests
export const listPluginRequests = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const query = request.query as Record<string, string | undefined>;
  const { page, limit, skip } = getPaginationParams(query, 20, 50);
  const status = query.status as string | undefined;

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

  reply.send({ requests, pagination: createPaginationMeta(page, limit, total) });
};

// GET /api/plugins/requests/:id
export const getPluginRequestById = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const id = (request.params as { id: string }).id;
  const reqRecord = await prisma.pluginRequest.findUnique({
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

  if (!reqRecord) {
    throw new AppError('求助帖不存在', 404);
  }

  reply.send(reqRecord);
};

// POST /api/plugins/requests
export const createPluginRequest = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const { title, description } = request.body as { title: string; description: string };
  if (!title?.trim() || !description?.trim()) {
    throw new AppError('标题和内容为必填项', 400);
  }

  const reqRecord = await prisma.pluginRequest.create({
    data: {
      title: title.trim(),
      description: description.trim(),
      userId: request.userId!,
      status: 'OPEN',
    },
    include: {
      user: { select: { id: true, name: true, avatarUrl: true } },
      _count: { select: { replies: true } },
    },
  });

  reply.status(201).send(reqRecord);
};

// POST /api/plugins/requests/:id/replies
export const createPluginRequestReply = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const requestId = (request.params as { id: string }).id;
  const { content, linkedPluginId } = request.body as {
    content: string;
    linkedPluginId?: string;
  };

  if (!content?.trim()) {
    throw new AppError('回复内容不能为空', 400);
  }

  const reqRecord = await prisma.pluginRequest.findUnique({ where: { id: requestId } });
  if (!reqRecord) throw new AppError('求助帖不存在', 404);

  if (linkedPluginId) {
    const plugin = await prisma.plugin.findFirst({
      where: { id: linkedPluginId, status: 'APPROVED' },
    });
    if (!plugin) throw new AppError('关联的插件不存在或未被批准发布', 400);
  }

  const replyRecord = await prisma.pluginRequestReply.create({
    data: {
      requestId,
      userId: request.userId!,
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

  reply.status(201).send(replyRecord);
};

// POST /api/plugins/requests/:id/resolve
export const resolvePluginRequest = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const requestId = (request.params as { id: string }).id;
  const reqRecord = await prisma.pluginRequest.findUnique({ where: { id: requestId } });
  if (!reqRecord) throw new AppError('求助帖不存在', 404);

  if (reqRecord.userId !== request.userId && request.user?.role !== 'ADMIN') {
    throw new AppError('无权关闭此求助贴', 403);
  }

  const updated = await prisma.pluginRequest.update({
    where: { id: requestId },
    data: { status: 'RESOLVED' },
  });

  reply.send(updated);
};

export const bulkDeletePlugins = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const { ids } = request.body as { ids: string[] };
  if (!Array.isArray(ids) || ids.length === 0) {
    reply.status(400).send({ error: '请提供要删除的插件 ID 列表' });
    return;
  }

  const whereCondition: Prisma.PluginWhereInput = {
    id: { in: ids },
  };
  if (request.user?.role !== 'ADMIN') {
    whereCondition.userId = request.userId;
  }

  const pluginsToDelete = await prisma.plugin.findMany({
    where: whereCondition,
  });

  if (pluginsToDelete.length === 0) {
    reply.status(404).send({ error: '未找到可删除的插件或无权操作' });
    return;
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

  reply.send({
    success: true,
    message: `成功批量删除 ${deleteIds.length} 个插件`,
    count: deleteIds.length,
    deletedIds: deleteIds,
  });
};

export const bulkFavoritePlugins = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const userId = request.userId as string;
  const body = (request.body as { ids?: unknown[]; category?: string; favorite?: boolean }) ?? {};
  const rawIds: unknown[] = Array.isArray(body.ids) ? body.ids : [];
  const categoryVal = typeof body.category === 'string' ? body.category.trim() : '默认';
  const category = categoryVal || '默认';
  const ids = Array.from(
    new Set<string>(rawIds.map((id) => String(id)).filter((id) => Boolean(id))),
  ).slice(0, 100);
  const favorite = body.favorite !== false;

  if (!ids.length) {
    throw new AppError('No plugins selected', 400);
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
      await persistCategoryIfNew(userId, category);
    }
  } else {
    await prisma.pluginFavorite.deleteMany({
      where: { userId, pluginId: { in: approvedIds } },
    });
  }

  reply.send({ success: true });
};
