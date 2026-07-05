import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { AuthRequest } from '../middlewares/auth.middleware';
import { AppError } from '../utils/error';
import prisma from '../services/prisma';
import { logger } from '../utils/logger';
import { getPaginationParams, createPaginationMeta } from '../utils/pagination';
import path from 'path';
import fs from 'fs';
import { deleteCloudOrLocalFileByUrl, parseZipLocal, urlToPath, moveTempFileToDestination, getZipFileNames, getFileSizeInMb } from '../utils/file';
import { parseTags } from '../utils/tags';
import { UploadedFile } from '../types/upload';
import { parseBool } from '../utils/parser';
import { createCommentController, type AccessResult } from './commentController.factory';

const SOFTWARE_FAVORITES_SETTING_KEY = 'favorite_softwares';
const CUSTOM_CATEGORIES_SETTING_KEY = 'software_favorite_categories';

const parseFavoriteSoftwareIds = (value?: string | null): string[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
  } catch (_error) {}
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const migrateOldFavoritesIfNeeded = async (userId: string) => {
  const setting = await prisma.userSetting.findUnique({
    where: { userId_key: { userId, key: SOFTWARE_FAVORITES_SETTING_KEY } },
  });
  if (setting) {
    const favoriteIds = parseFavoriteSoftwareIds(setting.value);
    const existingSoftwares = await prisma.software.findMany({
      where: { id: { in: favoriteIds } },
      select: { id: true },
    });
    const existingIds = new Set(existingSoftwares.map((p) => p.id));
    await Promise.all(
      favoriteIds
        .filter((id) => existingIds.has(id))
        .map((softwareId) =>
          prisma.softwareFavorite
            .upsert({
              where: { userId_softwareId: { userId, softwareId } },
              update: {},
              create: { userId, softwareId, category: '默认' },
            })
            .catch(() => {}),
        ),
    );
    await prisma.userSetting
      .delete({
        where: { userId_key: { userId, key: SOFTWARE_FAVORITES_SETTING_KEY } },
      })
      .catch(() => {});
  }
};

const getCustomCategories = async (userId: string): Promise<string[]> => {
  try {
    const setting = await prisma.userSetting.findUnique({
      where: { userId_key: { userId, key: CUSTOM_CATEGORIES_SETTING_KEY } },
    });
    if (setting && setting.value) {
      return JSON.parse(setting.value) as string[];
    }
  } catch (err) {
    logger.warn('[Software] Failed to parse custom categories:', err);
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

// ── Public: list approved softwares ─────────────────────────────────────────────
export const listSoftwares = async (req: Request, res: Response, next: NextFunction) => {
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

    const where: Prisma.SoftwareWhereInput = mine
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
      const favFilter: Prisma.SoftwareFavoriteWhereInput = { userId };
      if (favoriteCategory && favoriteCategory !== 'all') {
        favFilter.category = favoriteCategory;
      }
      const userFavs = await prisma.softwareFavorite.findMany({
        where: favFilter,
        select: { softwareId: true },
      });
      const favoriteIds = userFavs.map((f) => f.softwareId);
      where.id = { in: favoriteIds };
    }

    const [softwares, total] = await Promise.all([
      prisma.software.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      }),
      prisma.software.count({ where }),
    ]);

    res.json({ softwares, pagination: createPaginationMeta(page, limit, total) });
  } catch (err) {
    next(err);
  }
};

export const getSoftwareById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as { id: string };
    const software = await prisma.software.findFirst({
      where: {
        id,
        OR:
          req.user?.role === 'ADMIN'
            ? undefined
            : [{ status: 'APPROVED' }, { userId: req.userId as string }],
      },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    });

    if (!software) return next(new AppError('软件不存在', 404));

    res.json(software);
  } catch (err) {
    next(err);
  }
};

// ── Software marketplace insights ───────────────────────────────────────────────
export const getSoftwareInsights = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId as string;
    await migrateOldFavoritesIfNeeded(userId);
    const userFavs = await prisma.softwareFavorite.findMany({
      where: { userId },
      select: { softwareId: true },
    });
    const favoriteIds = userFavs.map((f) => f.softwareId);

    const [approvedSoftwares, pendingCount, myUploadsCount, myDraftsCount] = await Promise.all([
      prisma.software.findMany({
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
      prisma.software.count({ where: { status: 'PENDING' } }),
      prisma.software.count({ where: { userId } }),
      prisma.software.count({ where: { userId, status: 'PENDING' } }),
    ]);

    const categoryMap = new Map<string, { name: string; count: number; downloads: number }>();
    let totalDownloads = 0;
    let totalFileSize = 0;
    const tagCounts = new Map<string, number>();

    const allTags = await prisma.software.findMany({
      where: { status: 'APPROVED', tags: { not: null } },
      select: { tags: true },
      take: 500,
    });

    approvedSoftwares.forEach((software) => {
      totalDownloads += software.downloads || 0;
      totalFileSize += software.fileSize || 0;
      const current = categoryMap.get(software.category) || {
        name: software.category,
        count: 0,
        downloads: 0,
      };
      current.count += 1;
      current.downloads += software.downloads || 0;
      categoryMap.set(software.category, current);
    });

    allTags.forEach((software) => {
      parseTags(software.tags).forEach((tag) => {
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
        total: approvedSoftwares.length,
        pending: pendingCount,
        myPending: myDraftsCount,
        downloads: totalDownloads,
        categories: categories.length,
        favoriteCount: favoriteIds.length,
        myUploads: myUploadsCount,
        averageSize:
          approvedSoftwares.length > 0
            ? Number((totalFileSize / approvedSoftwares.length).toFixed(2))
            : 0,
      },
      categories,
      hotTags,
      topDownloads: [...approvedSoftwares].sort((a, b) => b.downloads - a.downloads).slice(0, 6),
      latest: approvedSoftwares.slice(0, 6),
      favoriteIds,
    });
  } catch (err) {
    next(err);
  }
};

// ── My softwares ─────────────────────────────────────────────────────────────────
export const getMySoftwares = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const softwares = await prisma.software.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: 'desc' },
    });
    res.json(softwares);
  } catch (err) {
    next(err);
  }
};

// ── My favorite softwares ───────────────────────────────────────────────────────
export const getMyFavoriteSoftwares = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId as string;
    await migrateOldFavoritesIfNeeded(userId);

    const favorites = await prisma.softwareFavorite.findMany({
      where: { userId, software: { status: 'APPROVED' } },
      orderBy: { createdAt: 'desc' },
      include: {
        software: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
      },
    });

    const categoryList = await prisma.softwareFavorite.groupBy({
      by: ['category'],
      where: { userId },
    });

    const dbCategories = categoryList.map((c) => c.category);
    const customCategories = await getCustomCategories(userId);
    const categoriesSet = new Set(['默认', ...dbCategories, ...customCategories]);

    res.json({
      ids: favorites.map((f) => f.softwareId),
      favorites: favorites.map((f) => ({
        id: f.id,
        category: f.category,
        software: f.software,
      })),
      categories: Array.from(categoriesSet),
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/softwares/favorites/categories
export const createFavoriteCategory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.userId as string;
  const { category } = req.body;
  if (!category || !category.trim()) return next(new AppError('分类名称不能为空', 400));
  const newCat = category.trim();
  if (newCat === '默认') return next(new AppError('不能创建默认分类', 400));

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

// PUT /api/softwares/favorites/categories
export const updateFavoriteCategory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.userId as string;
  const { oldCategory, newCategory } = req.body;
  if (!oldCategory || !newCategory) return next(new AppError('缺少必要参数', 400));
  const oldCat = oldCategory.trim();
  const newCat = newCategory.trim();
  if (oldCat === '默认' || newCat === '默认') return next(new AppError('不能重命名默认分类', 400));

  try {
    await prisma.softwareFavorite.updateMany({
      where: { userId, category: oldCat },
      data: { category: newCat },
    });
    const customCats = await getCustomCategories(userId);
    const updatedCats = customCats.map((c) => (c === oldCat ? newCat : c));
    await saveCustomCategories(userId, updatedCats);
    res.json({ success: true, message: '分类更新成功' });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/softwares/favorites/categories/:categoryName
export const deleteFavoriteCategory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.userId as string;
  const categoryName = req.params.categoryName as string;
  if (!categoryName) return next(new AppError('缺少分类名称', 400));
  const cat = categoryName.trim();
  if (cat === '默认') return next(new AppError('不能删除默认分类', 400));

  try {
    await prisma.softwareFavorite.deleteMany({
      where: { userId, category: cat },
    });
    const customCats = await getCustomCategories(userId);
    const filteredCats = customCats.filter((c) => c !== cat);
    await saveCustomCategories(userId, filteredCats);
    res.json({ success: true, message: '分类删除成功' });
  } catch (error) {
    next(error);
  }
};

export const toggleSoftwareFavorite = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as { id: string };
    const categoryVal = typeof req.body?.category === 'string' ? req.body.category.trim() : '默认';
    const category = categoryVal || '默认';
    const userId = req.userId as string;

    const software = await prisma.software.findFirst({
      where: { id, status: 'APPROVED' },
      select: { id: true },
    });
    if (!software) return next(new AppError('软件不存在', 404));

    await migrateOldFavoritesIfNeeded(userId);

    const existing = await prisma.softwareFavorite.findUnique({
      where: { userId_softwareId: { userId, softwareId: id } },
    });

    let isFavorited = false;
    if (existing) {
      if (existing.category === category) {
        await prisma.softwareFavorite.delete({ where: { id: existing.id } });
        isFavorited = false;
      } else {
        await prisma.softwareFavorite.update({ where: { id: existing.id }, data: { category } });
        isFavorited = true;
      }
    } else {
      await prisma.softwareFavorite.create({ data: { userId, softwareId: id, category } });
      isFavorited = true;
    }

    if (isFavorited && category !== '默认') {
      const customCats = await getCustomCategories(userId);
      if (!customCats.includes(category)) {
        customCats.push(category);
        await saveCustomCategories(userId, customCats);
      }
    }

    const favorites = await prisma.softwareFavorite.findMany({
      where: { userId },
      select: { softwareId: true },
    });

    res.json({
      isFavorited,
      favoriteIds: favorites.map((f) => f.softwareId),
    });
  } catch (err) {
    next(err);
  }
};

// ── Upload / create software ─────────────────────────────────────────────────────
export const uploadSoftware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
  const softwareFile = files?.software_file?.[0] || files?.file?.[0];
  const previewFile = files?.software_preview?.[0] || files?.preview?.[0];

  const externalUrl = req.body.externalUrl;
  let tempSoftwarePath = req.body.tempSoftwarePath;
  let tempPreviewPath = req.body.tempPreviewPath;

  if (!softwareFile && !tempSoftwarePath && !externalUrl) {
    return next(new AppError('请上传软件文件或提供外部链接', 400));
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
      return next(new AppError('软件名称为必填项', 400));
    }

    if (tempSoftwarePath) {
      tempSoftwarePath = moveTempFileToDestination(req, tempSoftwarePath, 'softwares');
    }
    if (tempPreviewPath) {
      tempPreviewPath = moveTempFileToDestination(req, tempPreviewPath, 'softwares');
    }

    let packageFilesList: string[] = [];
    if (req.body.packageFilesList) {
      try {
        packageFilesList = JSON.parse(req.body.packageFilesList);
      } catch (err) {
        // ignore
      }
    }

    if (packageFilesList.length === 0) {
      if (softwareFile) {
        const ext = path.extname(softwareFile.originalname).toLowerCase();
        if (ext === '.zip') {
          packageFilesList = await parseZipLocal(softwareFile.path);
        }
      } else if (tempSoftwarePath) {
        const localPath = urlToPath(tempSoftwarePath);
        if (localPath && fs.existsSync(localPath)) {
          const ext = path.extname(localPath).toLowerCase();
          if (ext === '.zip') {
            packageFilesList = await parseZipLocal(localPath);
          }
        }
      }
    }

    const fileUrl = softwareFile
      ? (softwareFile as UploadedFile).url || `/uploads/softwares/${softwareFile.filename}`
      : tempSoftwarePath || externalUrl;

    let fileSizeMb = req.body.fileSize ? parseFloat(req.body.fileSize) / (1024 * 1024) : 0;
    if (fileSizeMb === 0) {
      fileSizeMb = softwareFile ? softwareFile.size / (1024 * 1024) : 0;
      if (!softwareFile && tempSoftwarePath) {
        fileSizeMb = await getFileSizeInMb(tempSoftwarePath);
      }
    }

    const previewUrl = previewFile
      ? (previewFile as UploadedFile).url || `/uploads/softwares/${previewFile.filename}`
      : tempPreviewPath || null;

    const software = await prisma.software.create({
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
    await prisma.softwareVersion
      .create({
        data: {
          softwareId: software.id,
          version: software.version,
          changelog: '初始发布版本',
          fileUrl: software.fileUrl,
          fileSize: software.fileSize,
          packageFilesList: software.packageFilesList,
        },
      })
      .catch((err) => {
        logger.error('[Software] Failed to create initial version record:', err);
      });

    if (softwareFile && fs.existsSync(softwareFile.path)) {
      try {
        fs.unlinkSync(softwareFile.path);
      } catch (err) {
        logger.error('[Software] Failed to delete local file:', err);
      }
    }

    logger.info(`[Software] User ${req.userId} uploaded software: ${software.id}`);
    res.status(201).json(software);
  } catch (err) {
    if (softwareFile?.path && fs.existsSync(softwareFile.path)) fs.unlinkSync(softwareFile.path);
    if (previewFile?.path && fs.existsSync(previewFile.path)) fs.unlinkSync(previewFile.path);
    next(err);
  }
};

export const updateSoftware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
  const softwareFile = files?.software_file?.[0] || files?.file?.[0];
  const previewFile = files?.software_preview?.[0] || files?.preview?.[0];
  const externalUrl = req.body.externalUrl;

  try {
    const { id } = req.params as { id: string };
    let tempSoftwarePath = req.body.tempSoftwarePath;
    let tempPreviewPath = req.body.tempPreviewPath;

    if (tempSoftwarePath) {
      tempSoftwarePath = moveTempFileToDestination(req, tempSoftwarePath, 'softwares');
    }
    if (tempPreviewPath) {
      tempPreviewPath = moveTempFileToDestination(req, tempPreviewPath, 'softwares');
    }

    const existing = await prisma.software.findUnique({ where: { id } });
    if (!existing) {
      if (softwareFile?.path && fs.existsSync(softwareFile.path)) fs.unlinkSync(softwareFile.path);
      if (previewFile?.path && fs.existsSync(previewFile.path)) fs.unlinkSync(previewFile.path);
      return next(new AppError('软件不存在', 404));
    }
    if (existing.userId !== req.userId && req.user?.role !== 'ADMIN') {
      if (softwareFile?.path && fs.existsSync(softwareFile.path)) fs.unlinkSync(softwareFile.path);
      if (previewFile?.path && fs.existsSync(previewFile.path)) fs.unlinkSync(previewFile.path);
      return next(new AppError('无权修改此软件', 403));
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

    if (req.body.isFree !== undefined) {
      updateData.isFree = parseBool(req.body.isFree, true);
    }
    if (req.body.linkedCourseId !== undefined) {
      updateData.linkedCourseId = req.body.linkedCourseId || null;
    }
    if (req.body.linkedLessonId !== undefined) {
      updateData.linkedLessonId = req.body.linkedLessonId || null;
    }

    let packageFilesList: string[] = [];
    if (req.body.packageFilesList) {
      try {
        packageFilesList = JSON.parse(req.body.packageFilesList);
      } catch (err) {
        // ignore
      }
    }

    if (softwareFile) {
      if (packageFilesList.length === 0) {
        const ext = path.extname(softwareFile.originalname).toLowerCase();
        if (ext === '.zip') {
          packageFilesList = await parseZipLocal(softwareFile.path);
        }
      }
      updateData.fileUrl = (softwareFile as UploadedFile).url || `/uploads/softwares/${softwareFile.filename}`;
      updateData.fileSize = req.body.fileSize ? parseFloat(req.body.fileSize) / (1024 * 1024) : softwareFile.size / (1024 * 1024);
      updateData.packageFilesList = packageFilesList.length > 0 ? JSON.stringify(packageFilesList) : null;
    } else if (tempSoftwarePath) {
      let fileSizeMb = req.body.fileSize ? parseFloat(req.body.fileSize) / (1024 * 1024) : 0;
      if (fileSizeMb === 0) {
        fileSizeMb = await getFileSizeInMb(tempSoftwarePath);
      }
      updateData.fileSize = fileSizeMb;
      updateData.fileUrl = tempSoftwarePath;

      if (packageFilesList.length === 0) {
        const localPath = urlToPath(tempSoftwarePath);
        if (localPath && fs.existsSync(localPath)) {
          const ext = path.extname(localPath).toLowerCase();
          if (ext === '.zip') {
            packageFilesList = await parseZipLocal(localPath);
          }
        }
      }
      updateData.packageFilesList = packageFilesList.length > 0 ? JSON.stringify(packageFilesList) : null;
    } else if (externalUrl !== undefined) {
      updateData.fileUrl = externalUrl;
      updateData.packageFilesList = null;
      updateData.fileSize = 0;
    }

    if (previewFile) {
      updateData.previewUrl = (previewFile as UploadedFile).url || `/uploads/softwares/${previewFile.filename}`;
    } else if (tempPreviewPath) {
      updateData.previewUrl = tempPreviewPath;
    } else if (req.body.clearPreview === 'true') {
      updateData.previewUrl = null;
    }

    // Reset status to PENDING on modification for non-admin users
    if (req.user?.role !== 'ADMIN') {
      updateData.status = 'PENDING';
      updateData.rejectReason = null;
    }

    const updated = await prisma.software.update({
      where: { id },
      data: updateData,
    });

    // Sync to SoftwareVersion table
    const existingVersionRecord = await prisma.softwareVersion.findFirst({
      where: {
        softwareId: id,
        version: updated.version,
      },
    });

    if (existingVersionRecord) {
      if (existingVersionRecord.fileUrl && existingVersionRecord.fileUrl !== updated.fileUrl) {
        const isFileReferenced = await prisma.softwareVersion.findFirst({
          where: {
            softwareId: id,
            fileUrl: existingVersionRecord.fileUrl,
            version: { not: existingVersionRecord.version },
          },
        });
        if (!isFileReferenced) {
          deleteCloudOrLocalFileByUrl(existingVersionRecord.fileUrl).catch(() => {});
        }
      }

      await prisma.softwareVersion.update({
        where: { id: existingVersionRecord.id },
        data: {
          fileUrl: updated.fileUrl,
          fileSize: updated.fileSize,
          packageFilesList: updated.packageFilesList,
        },
      });
    } else {
      await prisma.softwareVersion.create({
        data: {
          softwareId: id,
          version: updated.version,
          fileUrl: updated.fileUrl,
          fileSize: updated.fileSize,
          packageFilesList: updated.packageFilesList,
          changelog: '通过编辑软件上传',
        },
      });
    }

    // Cleanup old files if they changed
    if (softwareFile && existing.fileUrl) {
      deleteCloudOrLocalFileByUrl(existing.fileUrl).catch((err) => {
        logger.error('[SoftwareController] Failed to delete old file:', err);
      });
    }
    if (previewFile && existing.previewUrl) {
      deleteCloudOrLocalFileByUrl(existing.previewUrl).catch((err) => {
        logger.error('[SoftwareController] Failed to delete old preview:', err);
      });
    }

    if (softwareFile && fs.existsSync(softwareFile.path)) {
      try {
        fs.unlinkSync(softwareFile.path);
      } catch (err) {
        logger.error('[Software] Failed to clean uploaded file:', err);
      }
    }

    logger.info(`[Software] User ${req.userId} updated software: ${id}`);
    res.json(updated);
  } catch (err) {
    if (softwareFile?.path && fs.existsSync(softwareFile.path)) fs.unlinkSync(softwareFile.path);
    if (previewFile?.path && fs.existsSync(previewFile.path)) fs.unlinkSync(previewFile.path);
    next(err);
  }
};

export const deleteSoftware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as { id: string };
    const software = await prisma.software.findUnique({ where: { id } });
    if (!software) return next(new AppError('软件不存在', 404));

    if (software.userId !== req.userId && req.user?.role !== 'ADMIN') {
      return next(new AppError('无权删除此软件', 403));
    }

    const fileSizeBytes = software.fileSize ? Math.round(software.fileSize * 1024 * 1024) : undefined;
    if (software.fileUrl) {
      deleteCloudOrLocalFileByUrl(software.fileUrl, fileSizeBytes).catch((err) => {
        logger.error('[SoftwareController] Failed to delete file:', err);
      });
    }
    if (software.previewUrl) {
      deleteCloudOrLocalFileByUrl(software.previewUrl).catch((err) => {
        logger.error('[SoftwareController] Failed to delete preview:', err);
      });
    }

    await prisma.software.delete({ where: { id } });
    res.json({ success: true, message: '软件已成功删除' });
  } catch (err) {
    next(err);
  }
};

export const bulkDeleteSoftwares = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: '请提供要删除的软件 ID 列表' });
    }

    const whereCondition: any = { id: { in: ids } };
    if (req.user?.role !== 'ADMIN') {
      whereCondition.userId = req.userId;
    }

    const softwaresToDelete = await prisma.software.findMany({ where: whereCondition });
    if (softwaresToDelete.length === 0) {
      return res.status(404).json({ error: '未找到可删除的软件或无权操作' });
    }

    for (const software of softwaresToDelete) {
      const fileSizeBytes = software.fileSize ? Math.round(software.fileSize * 1024 * 1024) : undefined;
      if (software.fileUrl) {
        deleteCloudOrLocalFileByUrl(software.fileUrl, fileSizeBytes).catch((err) => {
          logger.error('[SoftwareController] Bulk delete: failed to delete file:', err);
        });
      }
      if (software.previewUrl) {
        deleteCloudOrLocalFileByUrl(software.previewUrl).catch((err) => {
          logger.error('[SoftwareController] Bulk delete: failed to delete preview:', err);
        });
      }
    }

    const deleteIds = softwaresToDelete.map((p) => p.id);
    await prisma.software.deleteMany({ where: { id: { in: deleteIds } } });

    res.json({
      success: true,
      message: `成功批量删除 ${deleteIds.length} 个软件`,
      count: deleteIds.length,
      deletedIds: deleteIds,
    });
  } catch (error) {
    next(error);
  }
};

export const bulkFavoriteSoftwares = async (req: AuthRequest, res: Response, next: NextFunction) => {
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
      return next(new AppError('No softwares selected', 400));
    }

    const approvedSoftwares = await prisma.software.findMany({
      where: { id: { in: ids }, status: 'APPROVED' },
      select: { id: true },
    });
    const approvedIds = approvedSoftwares.map((s) => s.id);

    if (favorite) {
      await prisma.softwareFavorite.createMany({
        data: approvedIds.map((softwareId) => ({ userId, softwareId, category })),
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
      await prisma.softwareFavorite.deleteMany({
        where: { userId, softwareId: { in: approvedIds } },
      });
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

export const downloadSoftware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as { id: string };
    const software = await prisma.software.update({
      where: { id },
      data: { downloads: { increment: 1 } },
    });
    res.json({ success: true, downloads: software.downloads });
  } catch (err) {
    next(err);
  }
};

// ── Comments ─────────────────────────────────────────────────────────────────
const verifySoftwareAccess = async (
  req: AuthRequest,
  softwareId: string,
  operation: 'list' | 'create',
): Promise<AccessResult> => {
  const software = await prisma.software.findUnique({
    where: { id: softwareId },
    select: { status: true, userId: true },
  });

  if (!software) {
    return { ok: false, status: 404, message: '软件不存在' };
  }

  const isOwner = software.userId === req.userId;
  const isAdmin = req.user?.role === 'ADMIN';
  if (software.status !== 'APPROVED' && !isOwner && !isAdmin) {
    return { ok: false, status: 404, message: '软件不存在' };
  }

  return { ok: true };
};

const softwareCommentController = createCommentController({
  verifyAccess: verifySoftwareAccess,
  commentModel: prisma.softwareComment,
  parentField: 'softwareId',
  resourceIdParam: 'id',
  messages: {
    commentEmpty: '评论内容不能为空',
    commentNotFound: '评论不存在',
    commentDeleteForbidden: '无权删除此评论',
    commentDeleted: '评论已成功删除',
    internalError: '服务器内部错误',
  },
  logPrefix: 'Software comment',
});

export const getSoftwareComments = softwareCommentController.list;
export const createSoftwareComment = softwareCommentController.create;
export const deleteSoftwareComment = softwareCommentController.remove;

// ── Sharing ──────────────────────────────────────────────────────────────────
export const getSoftwareShare = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as { id: string };
    const share = await prisma.softwareShare.findUnique({ where: { softwareId: id } });
    res.json(share);
  } catch (err) {
    next(err);
  }
};

export const createOrUpdateSoftwareShare = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as { id: string };
    const { expiresAt, customText } = req.body;

    const software = await prisma.software.findUnique({ where: { id } });
    if (!software) return next(new AppError('软件不存在', 404));
    if (software.userId !== req.userId && req.user?.role !== 'ADMIN') {
      return next(new AppError('无权分享此软件', 403));
    }

    const expires = expiresAt ? new Date(expiresAt) : null;
    const share = await prisma.softwareShare.upsert({
      where: { softwareId: id },
      update: { expiresAt: expires, customText },
      create: { softwareId: id, userId: req.userId!, expiresAt: expires, customText },
    });

    res.json(share);
  } catch (err) {
    next(err);
  }
};

export const cancelSoftwareShare = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as { id: string };
    const share = await prisma.softwareShare.findUnique({ where: { softwareId: id } });
    if (!share) return next(new AppError('未找到该分享', 404));

    if (share.userId !== req.userId && req.user?.role !== 'ADMIN') {
      return next(new AppError('无权取消此分享', 403));
    }

    await prisma.softwareShare.delete({ where: { softwareId: id } });
    res.json({ success: true, message: '分享已取消' });
  } catch (err) {
    next(err);
  }
};

export const getPublicSharedSoftware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { shareId } = req.params as { shareId: string };
    const share = await prisma.softwareShare.findUnique({
      where: { id: shareId },
      include: {
        software: {
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        },
      },
    });

    if (!share) return next(new AppError('分享链接无效或已过期', 404));
    if (share.expiresAt && new Date() > share.expiresAt) {
      return next(new AppError('该分享链接已过期', 400));
    }

    res.json({
      software: share.software,
      customText: share.customText,
      expiresAt: share.expiresAt,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/softwares/:id/versions
export const listSoftwareVersions = async (req: Request, res: Response, next: NextFunction) => {
  const softwareId = req.params.id as string;
  try {
    const versions = await prisma.softwareVersion.findMany({
      where: { softwareId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(versions);
  } catch (error) {
    next(error);
  }
};

// POST /api/softwares/:id/versions
export const createSoftwareVersion = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const softwareId = req.params.id as string;
  const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
  const softwareFile = files?.['software_file']?.[0];

  try {
    const software = await prisma.software.findUnique({ where: { id: softwareId } });
    if (!software) {
      if (softwareFile?.path && fs.existsSync(softwareFile.path)) fs.unlinkSync(softwareFile.path);
      return next(new AppError('软件不存在', 404));
    }
    if (software.userId !== req.userId && req.user?.role !== 'ADMIN') {
      if (softwareFile?.path && fs.existsSync(softwareFile.path)) fs.unlinkSync(softwareFile.path);
      return next(new AppError('无权操作此软件', 403));
    }

    const { version, changelog, externalUrl } = req.body;
    if (!version) {
      if (softwareFile?.path && fs.existsSync(softwareFile.path)) fs.unlinkSync(softwareFile.path);
      return next(new AppError('版本号为必填项', 400));
    }

    let fileUrl = '';
    let fileSizeMb: number | null = null;
    let packageFilesList: string[] = [];

    if (softwareFile) {
      fileUrl = (softwareFile as UploadedFile).url || `/uploads/softwares/${softwareFile.filename}`;
      fileSizeMb = softwareFile.size / (1024 * 1024);
      const ext = path.extname(softwareFile.originalname).toLowerCase();
      if (ext === '.zip') {
        try {
          packageFilesList = await parseZipLocal(softwareFile.path);
        } catch (_err) {}
      }
    } else if (externalUrl) {
      fileUrl = externalUrl;
    } else {
      return next(new AppError('请提供软件文件或外部下载链接', 400));
    }

    const newVersion = await prisma.softwareVersion.create({
      data: {
        softwareId,
        version,
        changelog: changelog || null,
        fileUrl,
        fileSize: fileSizeMb,
        packageFilesList: packageFilesList.length > 0 ? JSON.stringify(packageFilesList) : null,
      },
    });

    // Update main Software model with latest version details
    await prisma.software.update({
      where: { id: softwareId },
      data: {
        version,
        fileUrl,
        fileSize: fileSizeMb,
        packageFilesList: packageFilesList.length > 0 ? JSON.stringify(packageFilesList) : null,
        status: req.user?.role === 'ADMIN' ? 'APPROVED' : 'PENDING',
        rejectReason: null,
      },
    });

    if (softwareFile?.path && fs.existsSync(softwareFile.path)) {
      try {
        fs.unlinkSync(softwareFile.path);
      } catch (_e) {}
    }

    res.status(201).json(newVersion);
  } catch (err) {
    if (softwareFile?.path && fs.existsSync(softwareFile.path)) {
      try {
        fs.unlinkSync(softwareFile.path);
      } catch (_e) {}
    }
    next(err);
  }
};

// PUT /api/softwares/:id/versions/:versionId
export const updateSoftwareVersion = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { id: softwareId, versionId } = req.params as { id: string; versionId: string };
  const { version: newVersionString, changelog } = req.body as {
    version?: string;
    changelog?: string;
  };

  try {
    const software = await prisma.software.findUnique({ where: { id: softwareId } });
    if (!software) return next(new AppError('软件不存在', 404));
    if (software.userId !== req.userId && req.user?.role !== 'ADMIN') {
      return next(new AppError('无权操作此软件', 403));
    }

    const versionItem = await prisma.softwareVersion.findFirst({
      where: { id: versionId, softwareId },
    });
    if (!versionItem) return next(new AppError('版本记录不存在', 404));

    if (newVersionString && newVersionString !== versionItem.version) {
      const duplicate = await prisma.softwareVersion.findFirst({
        where: { softwareId, version: newVersionString },
      });
      if (duplicate) return next(new AppError('该版本号已存在', 400));
    }

    const updatedVersion = await prisma.softwareVersion.update({
      where: { id: versionId },
      data: {
        version: newVersionString || undefined,
        changelog: changelog !== undefined ? changelog : undefined,
      },
    });

    if (
      software.version === versionItem.version &&
      newVersionString &&
      newVersionString !== versionItem.version
    ) {
      await prisma.software.update({
        where: { id: softwareId },
        data: { version: newVersionString },
      });
    }

    res.json(updatedVersion);
  } catch (error) {
    next(error);
  }
};

// DELETE /api/softwares/:id/versions/:versionId
export const deleteSoftwareVersion = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { id: softwareId, versionId } = req.params as { id: string; versionId: string };

  try {
    const software = await prisma.software.findUnique({ where: { id: softwareId } });
    if (!software) return next(new AppError('软件不存在', 404));
    if (software.userId !== req.userId && req.user?.role !== 'ADMIN') {
      return next(new AppError('无权操作此软件', 403));
    }

    const versionItem = await prisma.softwareVersion.findFirst({
      where: { id: versionId, softwareId },
    });
    if (!versionItem) return next(new AppError('版本记录不存在', 404));

    const versionCount = await prisma.softwareVersion.count({ where: { softwareId } });
    if (versionCount <= 1) {
      return next(new AppError('无法删除最后一个版本文件', 400));
    }

    if (software.version === versionItem.version) {
      const nextActive = await prisma.softwareVersion.findFirst({
        where: { softwareId, id: { not: versionId } },
        orderBy: { createdAt: 'desc' },
      });
      if (nextActive) {
        await prisma.software.update({
          where: { id: softwareId },
          data: {
            version: nextActive.version,
            fileUrl: nextActive.fileUrl,
            fileSize: nextActive.fileSize,
            packageFilesList: nextActive.packageFilesList,
          },
        });
      }
    }

    await prisma.softwareVersion.delete({ where: { id: versionId } });

    if (versionItem.fileUrl && versionItem.fileUrl.startsWith('/uploads/')) {
      deleteCloudOrLocalFileByUrl(versionItem.fileUrl).catch((err) => {
        logger.error(
          `[SoftwareController] Failed to delete software version file ${versionItem.fileUrl}:`,
          err,
        );
      });
    }

    res.json({ success: true, message: '版本记录已删除' });
  } catch (error) {
    next(error);
  }
};

// POST /api/softwares/:id/versions/:versionId/set-active
export const setActiveSoftwareVersion = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const { id: softwareId, versionId } = req.params as { id: string; versionId: string };
  try {
    const software = await prisma.software.findUnique({ where: { id: softwareId } });
    if (!software) return next(new AppError('软件不存在', 404));
    if (software.userId !== req.userId && req.user?.role !== 'ADMIN') {
      return next(new AppError('无权操作此软件', 403));
    }

    const version = await prisma.softwareVersion.findFirst({
      where: { id: versionId, softwareId },
    });
    if (!version) return next(new AppError('版本记录不存在', 404));

    const updated = await prisma.software.update({
      where: { id: softwareId },
      data: {
        version: version.version,
        fileUrl: version.fileUrl,
        fileSize: version.fileSize,
        packageFilesList: version.packageFilesList,
      },
    });

    logger.info(
      `[Software] ${softwareId} active version set to ${version.version} by user ${req.userId}`,
    );

    res.json({
      success: true,
      message: `已将 v${version.version} 设为当前推送版本`,
      software: { id: updated.id, version: updated.version },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/softwares/:id/package-files - non-blocking, cached ZIP file listing
export const getSoftwarePackageFiles = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const id = req.params.id as string;
  try {
    const software = await prisma.software.findFirst({
      where: {
        id,
        OR:
          req.user?.role === 'ADMIN'
            ? undefined
            : [{ status: 'APPROVED' }, { userId: req.userId as string }],
      },
      select: { fileUrl: true, packageFilesList: true },
    });

    if (!software) {
      return next(new AppError('Software not found or access denied', 404));
    }

    if (!software.fileUrl) {
      return res.json({ packageFiles: [] });
    }

    if (software.packageFilesList) {
      try {
        const files = JSON.parse(software.packageFilesList);
        if (Array.isArray(files)) {
          return res.json({ packageFiles: files });
        }
      } catch (_e) {
        // ignore and fallback
      }
    }

    const packageFiles = await getZipFileNames(software.fileUrl);

    // Cache to DB for future requests
    if (packageFiles.length > 0) {
      await prisma.software
        .update({
          where: { id },
          data: { packageFilesList: JSON.stringify(packageFiles) },
        })
        .catch((err) => {
          logger.error(
            `[Software] Failed to update packageFilesList fallback for software ${id}:`,
            err,
          );
        });
    }

    res.json({ packageFiles });
  } catch (error) {
    next(error);
  }
};
