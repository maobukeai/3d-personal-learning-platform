import type { FastifyRequest, FastifyReply } from 'fastify';
import { Prisma } from '@prisma/client';
import { AppError } from '../utils/error';
import prisma from '../services/prisma';
import { logger } from '../utils/logger';
import { getPaginationParams, createPaginationMeta } from '../utils/pagination';
import {
  deleteCloudOrLocalFileByUrl,
  moveTempFileToDestination,
  getZipFileNames,
  getFileSizeInMb,
  safeUnlink,
  getUploadedFileUrl,
  parseZipBuffer,
} from '../utils/file';
import { parseTags } from '../utils/tags';
import { parseBool } from '../utils/parser';
import {
  createFavoriteCategoryHandlers,
  type FavoriteModelDelegate,
} from './shared/favorites.factory';

// ── Favorites category factory (eliminates duplicate category CRUD handlers) ───
const { persistCategoryIfNew, readCategories: getCustomCategories } =
  createFavoriteCategoryHandlers({
    delegate: prisma.softwareFavorite as unknown as FavoriteModelDelegate,
    settingsKey: 'software_favorite_categories',
    resourceLabel: '软件',
  });

const SOFTWARE_FAVORITES_SETTING_KEY = 'software_favorite_categories';

const saveSoftwareFavoriteCategories = async (
  userId: string,
  categories: string[],
): Promise<void> => {
  const uniqueCats = Array.from(new Set(categories.map((c) => c.trim()).filter(Boolean)));
  await prisma.userSetting.upsert({
    where: { userId_key: { userId, key: SOFTWARE_FAVORITES_SETTING_KEY } },
    update: { value: JSON.stringify(uniqueCats) },
    create: { userId, key: SOFTWARE_FAVORITES_SETTING_KEY, value: JSON.stringify(uniqueCats) },
  });
};

const parseFavoriteSoftwareIds = (value?: string | null): string[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
  } catch (_error) {
    // ignore JSON parse errors, fall through to comma split
  }
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

// ── Public: list approved softwares ─────────────────────────────────────────────
export const listSoftwares = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const { page, limit, skip } = getPaginationParams(
    request.query as Record<string, unknown>,
    20,
    50,
  );
  const query = request.query as Record<string, string | undefined>;
  const category = query.category;
  const search = query.search;

  const userId = request.userId as string;
  const mine = query.mine === 'true';
  const favoritesOnly = query.favoritesOnly === 'true';
  const favoriteCategory = query.favoriteCategory;
  const status = query.status;

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

  reply.send({ softwares, pagination: createPaginationMeta(page, limit, total) });
};

export const getSoftwareById = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const { id } = request.params as { id: string };
  const software = await prisma.software.findFirst({
    where: {
      id,
      OR:
        request.user?.role === 'ADMIN'
          ? undefined
          : [{ status: 'APPROVED' }, { userId: request.userId as string }],
    },
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  });

  if (!software) throw new AppError('软件不存在', 404);

  reply.send(software);
};

// ── Software marketplace insights ───────────────────────────────────────────────
export const getSoftwareInsights = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const userId = request.userId as string;
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

  reply.send({
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
};

// ── My softwares ─────────────────────────────────────────────────────────────────
export const getMySoftwares = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const softwares = await prisma.software.findMany({
    where: { userId: request.userId! },
    orderBy: { createdAt: 'desc' },
  });
  reply.send(softwares);
};

// ── My favorite softwares ───────────────────────────────────────────────────────
export const getMyFavoriteSoftwares = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const userId = request.userId as string;
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

  reply.send({
    ids: favorites.map((f) => f.softwareId),
    favorites: favorites.map((f) => ({
      id: f.id,
      category: f.category,
      software: f.software,
    })),
    categories: Array.from(categoriesSet),
  });
};

export const toggleSoftwareFavorite = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const { id } = request.params as { id: string };
  const body = request.body as Record<string, unknown> | undefined;
  const categoryVal = typeof body?.category === 'string' ? body.category.trim() : '默认';
  const category = categoryVal || '默认';
  const userId = request.userId as string;

  const software = await prisma.software.findFirst({
    where: { id, status: 'APPROVED' },
    select: { id: true },
  });
  if (!software) throw new AppError('软件不存在', 404);

  await migrateOldFavoritesIfNeeded(userId);

  const existing = await prisma.softwareFavorite.findUnique({
    where: { userId_softwareId: { userId, softwareId: id } },
  });

  let isFavorited: boolean;
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
    await persistCategoryIfNew(userId, category);
  }

  const favorites = await prisma.softwareFavorite.findMany({
    where: { userId },
    select: { softwareId: true },
  });

  reply.send({
    isFavorited,
    favoriteIds: favorites.map((f) => f.softwareId),
  });
};

// ── Favorite category management (native Fastify handlers) ──────────────────────
export const createFavoriteCategory = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const userId = request.userId as string;
  const { category } = request.body as { category?: string };

  if (!category?.trim()) {
    throw new AppError('分类名称不能为空', 400);
  }
  const newCat = category.trim();

  const existing = await prisma.softwareFavorite.findMany({
    where: { userId, category: newCat },
    select: { id: true },
  });
  if (existing.length > 0) {
    throw new AppError('该分类已存在', 400);
  }

  const customCats = await getCustomCategories(userId);
  if (!customCats.includes(newCat)) {
    customCats.push(newCat);
    await saveSoftwareFavoriteCategories(userId, customCats);
  }
  reply.send({ success: true, message: '分类创建成功', categories: ['默认', ...customCats] });
};

export const updateFavoriteCategory = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const userId = request.userId as string;
  const { oldCategory, newCategory } = request.body as {
    oldCategory?: string;
    newCategory?: string;
  };

  if (!oldCategory || !newCategory) {
    throw new AppError('请提供原分类名和新分类名', 400);
  }

  const oldCat = oldCategory.trim();
  const newCat = newCategory.trim();

  if (oldCat === '默认') {
    throw new AppError('不能修改默认分类', 400);
  }

  await prisma.softwareFavorite.updateMany({
    where: { userId, category: oldCat },
    data: { category: newCat },
  });

  const customCats = await getCustomCategories(userId);
  const updatedCats = customCats.map((c) => (c === oldCat ? newCat : c));
  await saveSoftwareFavoriteCategories(userId, updatedCats);
  reply.send({ success: true, message: '分类更新成功' });
};

export const deleteFavoriteCategory = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const userId = request.userId as string;
  const { categoryName } = request.params as { categoryName?: string };

  if (!categoryName) {
    throw new AppError('缺少分类名称', 400);
  }
  const cat = categoryName.trim();
  if (cat === '默认') {
    throw new AppError('不能删除默认分类', 400);
  }

  await prisma.softwareFavorite.deleteMany({ where: { userId, category: cat } });
  const customCats = await getCustomCategories(userId);
  const filteredCats = customCats.filter((c) => c !== cat);
  await saveSoftwareFavoriteCategories(userId, filteredCats);
  reply.send({ success: true, message: '分类删除成功' });
};

// ── Upload / create software ─────────────────────────────────────────────────────
export const uploadSoftware = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const files = (
    request as unknown as {
      files?: { [fieldname: string]: Express.Multer.File[] };
    }
  ).files;
  const softwareFile = files?.software_file?.[0] || files?.file?.[0];
  const previewFile = files?.software_preview?.[0] || files?.preview?.[0];

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
    tempSoftwarePath?: string;
    tempPreviewPath?: string;
    packageFilesList?: string;
    fileSize?: string;
    bilibiliUrl?: string;
  };
  const externalUrl = body.externalUrl;
  let tempSoftwarePath = body.tempSoftwarePath;
  let tempPreviewPath = body.tempPreviewPath;

  if (!softwareFile && !tempSoftwarePath && !externalUrl) {
    throw new AppError('请上传软件文件或提供外部链接', 400);
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
    } = body;

    if (!title?.trim()) {
      throw new AppError('软件名称为必填项', 400);
    }

    if (tempSoftwarePath) {
      tempSoftwarePath = moveTempFileToDestination(request, tempSoftwarePath, 'softwares');
    }
    if (tempPreviewPath) {
      tempPreviewPath = moveTempFileToDestination(request, tempPreviewPath, 'softwares');
    }

    let packageFilesList: string[] = [];
    if (body.packageFilesList) {
      try {
        packageFilesList = JSON.parse(body.packageFilesList);
      } catch (_err) {
        // ignore malformed packageFilesList JSON
      }
    }

    if (packageFilesList.length === 0) {
      if (softwareFile) {
        // 铁律二·1：纯内存 ZIP 解析，不再读取磁盘路径
        if (softwareFile.buffer) {
          try {
            packageFilesList = await parseZipBuffer(softwareFile.buffer);
          } catch (zipErr) {
            logger.error('[SoftwareCreate] Failed to parse package ZIP from buffer:', zipErr);
          }
        }
      } else if (tempSoftwarePath) {
        // 铁律二·1：tempSoftwarePath 是云 URL（已直传 R2），本地路径已被
        // moveTempFileToDestination 硬墙拦截，无需再解析本地 ZIP
      }
    }

    const fileUrl = softwareFile
      ? getUploadedFileUrl(request, softwareFile, 'softwares')
      : tempSoftwarePath || externalUrl || '';

    let fileSizeMb = body.fileSize ? parseFloat(body.fileSize) / (1024 * 1024) : 0;
    if (fileSizeMb === 0) {
      fileSizeMb = softwareFile ? softwareFile.size / (1024 * 1024) : 0;
      if (!softwareFile && tempSoftwarePath) {
        fileSizeMb = await getFileSizeInMb(tempSoftwarePath);
      }
    }

    const previewUrl = previewFile
      ? getUploadedFileUrl(request, previewFile, 'softwares')
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
        userId: request.userId!,
        status: request.user?.role === 'ADMIN' ? 'APPROVED' : 'PENDING',
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

    await safeUnlink(softwareFile?.path);

    logger.info(`[Software] User ${request.userId} uploaded software: ${software.id}`);
    reply.status(201).send(software);
  } catch (err) {
    await safeUnlink(softwareFile?.path);
    await safeUnlink(previewFile?.path);
    throw err;
  }
};

export const updateSoftware = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const files = (
    request as unknown as {
      files?: { [fieldname: string]: Express.Multer.File[] };
    }
  ).files;
  const softwareFile = files?.software_file?.[0] || files?.file?.[0];
  const previewFile = files?.software_preview?.[0] || files?.preview?.[0];
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
    tempSoftwarePath?: string;
    tempPreviewPath?: string;
    packageFilesList?: string;
    fileSize?: string;
    bilibiliUrl?: string;
    clearPreview?: string;
  };
  const externalUrl = body.externalUrl;

  try {
    const { id } = request.params as { id: string };
    let tempSoftwarePath = body.tempSoftwarePath;
    let tempPreviewPath = body.tempPreviewPath;

    if (tempSoftwarePath) {
      tempSoftwarePath = moveTempFileToDestination(request, tempSoftwarePath, 'softwares');
    }
    if (tempPreviewPath) {
      tempPreviewPath = moveTempFileToDestination(request, tempPreviewPath, 'softwares');
    }

    const existing = await prisma.software.findUnique({ where: { id } });
    if (!existing) {
      await safeUnlink(softwareFile?.path);
      await safeUnlink(previewFile?.path);
      throw new AppError('软件不存在', 404);
    }
    if (existing.userId !== request.userId && request.user?.role !== 'ADMIN') {
      await safeUnlink(softwareFile?.path);
      await safeUnlink(previewFile?.path);
      throw new AppError('无权修改此软件', 403);
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

    if (body.isFree !== undefined) {
      updateData.isFree = parseBool(body.isFree, true);
    }
    if (body.linkedCourseId !== undefined) {
      updateData.linkedCourseId = body.linkedCourseId || null;
    }
    if (body.linkedLessonId !== undefined) {
      updateData.linkedLessonId = body.linkedLessonId || null;
    }

    let packageFilesList: string[] = [];
    if (body.packageFilesList) {
      try {
        packageFilesList = JSON.parse(body.packageFilesList);
      } catch (_err) {
        // ignore malformed packageFilesList JSON
      }
    }

    if (softwareFile) {
      if (packageFilesList.length === 0) {
        // 铁律二·1：纯内存 ZIP 解析，不再读取磁盘路径
        if (softwareFile.buffer) {
          try {
            packageFilesList = await parseZipBuffer(softwareFile.buffer);
          } catch (zipErr) {
            logger.error('[SoftwareUpdate] Failed to parse package ZIP from buffer:', zipErr);
          }
        }
      }
      updateData.fileUrl = getUploadedFileUrl(request, softwareFile, 'softwares');
      updateData.fileSize = body.fileSize
        ? parseFloat(body.fileSize) / (1024 * 1024)
        : softwareFile.size / (1024 * 1024);
      updateData.packageFilesList =
        packageFilesList.length > 0 ? JSON.stringify(packageFilesList) : null;
    } else if (tempSoftwarePath) {
      let fileSizeMb = body.fileSize ? parseFloat(body.fileSize) / (1024 * 1024) : 0;
      if (fileSizeMb === 0) {
        fileSizeMb = await getFileSizeInMb(tempSoftwarePath);
      }
      updateData.fileSize = fileSizeMb;
      updateData.fileUrl = tempSoftwarePath;

      if (packageFilesList.length === 0) {
        // 铁律二·1：tempSoftwarePath 是云 URL（已直传 R2），本地路径已被
        // moveTempFileToDestination 硬墙拦截，无需再解析本地 ZIP
      }
      updateData.packageFilesList =
        packageFilesList.length > 0 ? JSON.stringify(packageFilesList) : null;
    } else if (externalUrl !== undefined) {
      updateData.fileUrl = externalUrl;
      updateData.packageFilesList = null;
      updateData.fileSize = 0;
    }

    if (previewFile) {
      updateData.previewUrl = getUploadedFileUrl(request, previewFile, 'softwares');
    } else if (tempPreviewPath) {
      updateData.previewUrl = tempPreviewPath;
    } else if (body.clearPreview === 'true') {
      updateData.previewUrl = null;
    }

    // Reset status to PENDING on modification for non-admin users
    if (request.user?.role !== 'ADMIN') {
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

    await safeUnlink(softwareFile?.path);

    logger.info(`[Software] User ${request.userId} updated software: ${id}`);
    reply.send(updated);
  } catch (err) {
    await safeUnlink(softwareFile?.path);
    await safeUnlink(previewFile?.path);
    throw err;
  }
};

export const deleteSoftware = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const { id } = request.params as { id: string };
  const software = await prisma.software.findUnique({ where: { id } });
  if (!software) throw new AppError('软件不存在', 404);

  if (software.userId !== request.userId && request.user?.role !== 'ADMIN') {
    throw new AppError('无权删除此软件', 403);
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
  reply.send({ success: true, message: '软件已成功删除' });
};

export const bulkDeleteSoftwares = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const { ids } = request.body as { ids?: unknown };

  if (!Array.isArray(ids) || ids.length === 0) {
    reply.status(400).send({ error: '请提供要删除的软件 ID 列表' });
    return;
  }

  const whereCondition: Prisma.SoftwareWhereInput = { id: { in: ids } };
  if (request.user?.role !== 'ADMIN') {
    whereCondition.userId = request.userId;
  }

  const softwaresToDelete = await prisma.software.findMany({ where: whereCondition });
  if (softwaresToDelete.length === 0) {
    reply.status(404).send({ error: '未找到可删除的软件或无权操作' });
    return;
  }

  for (const software of softwaresToDelete) {
    const fileSizeBytes = software.fileSize
      ? Math.round(software.fileSize * 1024 * 1024)
      : undefined;
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

  reply.send({
    success: true,
    message: `成功批量删除 ${deleteIds.length} 个软件`,
    count: deleteIds.length,
    deletedIds: deleteIds,
  });
};

export const bulkFavoriteSoftwares = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const userId = request.userId as string;
  const body = request.body as
    | { ids?: unknown[]; category?: string; favorite?: boolean }
    | undefined;
  const rawIds: unknown[] = Array.isArray(body?.ids) ? body!.ids : [];
  const categoryVal = typeof body?.category === 'string' ? body.category.trim() : '默认';
  const category = categoryVal || '默认';
  const ids = Array.from(
    new Set<string>(rawIds.map((id) => String(id)).filter((id) => Boolean(id))),
  ).slice(0, 100);
  const favorite = body?.favorite !== false;

  if (!ids.length) {
    throw new AppError('No softwares selected', 400);
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
      await persistCategoryIfNew(userId, category);
    }
  } else {
    await prisma.softwareFavorite.deleteMany({
      where: { userId, softwareId: { in: approvedIds } },
    });
  }

  reply.send({ success: true });
};

export const downloadSoftware = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const { id } = request.params as { id: string };
  const software = await prisma.software.update({
    where: { id },
    data: { downloads: { increment: 1 } },
  });
  reply.send({ success: true, downloads: software.downloads });
};

// ── Comments (inlined from commentController.factory for native Fastify) ────────
type AccessResult = { ok: true } | { ok: false; status: 404 | 403; message: string };

const verifySoftwareAccess = async (
  request: FastifyRequest,
  softwareId: string,
  _operation: 'list' | 'create',
): Promise<AccessResult> => {
  const software = await prisma.software.findUnique({
    where: { id: softwareId },
    select: { status: true, userId: true },
  });

  if (!software) {
    return { ok: false, status: 404, message: '软件不存在' };
  }

  const isOwner = software.userId === request.userId;
  const isAdmin = request.user?.role === 'ADMIN';
  if (software.status !== 'APPROVED' && !isOwner && !isAdmin) {
    return { ok: false, status: 404, message: '软件不存在' };
  }

  return { ok: true };
};

export const getSoftwareComments = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const { id } = request.params as { id: string };
  const access = await verifySoftwareAccess(request, id, 'list');
  if (!access.ok) {
    reply.status(access.status).send({ error: access.message });
    return;
  }

  const comments = await prisma.softwareComment.findMany({
    where: { softwareId: id },
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    orderBy: { createdAt: 'asc' },
  });

  reply.send(comments);
};

export const createSoftwareComment = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const { id } = request.params as { id: string };
  const { content } = request.body as { content?: string };

  if (!content || !content.trim()) {
    reply.status(400).send({ error: '评论内容不能为空' });
    return;
  }

  const access = await verifySoftwareAccess(request, id, 'create');
  if (!access.ok) {
    reply.status(access.status).send({ error: access.message });
    return;
  }

  const comment = await prisma.softwareComment.create({
    data: {
      content: content.trim(),
      softwareId: id,
      userId: request.userId as string,
    },
    include: {
      user: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  reply.status(201).send(comment);
};

export const deleteSoftwareComment = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const { commentId } = request.params as { commentId?: string };

  const comment = await prisma.softwareComment.findUnique({
    where: { id: commentId },
  });

  if (!comment) {
    reply.status(404).send({ error: '评论不存在' });
    return;
  }

  if (comment.userId !== request.userId && request.user?.role !== 'ADMIN') {
    reply.status(403).send({ error: '无权删除此评论' });
    return;
  }

  await prisma.softwareComment.delete({
    where: { id: commentId },
  });

  reply.send({ message: '评论已成功删除' });
};

// ── Sharing ──────────────────────────────────────────────────────────────────
export const getSoftwareShare = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const { id } = request.params as { id: string };
  const share = await prisma.softwareShare.findUnique({ where: { softwareId: id } });
  reply.send(share);
};

export const createOrUpdateSoftwareShare = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const { id } = request.params as { id: string };
  const { expiresAt, customText } = request.body as {
    expiresAt?: string;
    customText?: string;
  };

  const software = await prisma.software.findUnique({ where: { id } });
  if (!software) throw new AppError('软件不存在', 404);
  if (software.userId !== request.userId && request.user?.role !== 'ADMIN') {
    throw new AppError('无权分享此软件', 403);
  }

  const expires = expiresAt ? new Date(expiresAt) : null;
  const share = await prisma.softwareShare.upsert({
    where: { softwareId: id },
    update: { expiresAt: expires, customText },
    create: { softwareId: id, userId: request.userId!, expiresAt: expires, customText },
  });

  reply.send(share);
};

export const cancelSoftwareShare = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const { id } = request.params as { id: string };
  const share = await prisma.softwareShare.findUnique({ where: { softwareId: id } });
  if (!share) throw new AppError('未找到该分享', 404);

  if (share.userId !== request.userId && request.user?.role !== 'ADMIN') {
    throw new AppError('无权取消此分享', 403);
  }

  await prisma.softwareShare.delete({ where: { softwareId: id } });
  reply.send({ success: true, message: '分享已取消' });
};

export const getPublicSharedSoftware = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const { shareId } = request.params as { shareId: string };
  reply.header('Cache-Control', 'public, max-age=30');
  const share = await prisma.softwareShare.findUnique({
    where: { id: shareId },
    select: {
      expiresAt: true,
      customText: true,
      software: {
        select: {
          id: true,
          title: true,
          description: true,
          category: true,
          tags: true,
          version: true,
          compatibility: true,
          fileUrl: true,
          fileSize: true,
          previewUrl: true,
          installGuide: true,
          downloads: true,
          originality: true,
          originalLink: true,
          license: true,
          isFree: true,
          bilibiliUrl: true,
          createdAt: true,
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
      },
    },
  });

  if (!share) throw new AppError('分享链接无效或已过期', 404);
  if (share.expiresAt && new Date() > share.expiresAt) {
    throw new AppError('该分享链接已过期', 400);
  }

  reply.send({
    software: share.software,
    customText: share.customText,
    expiresAt: share.expiresAt,
  });
};

// GET /api/softwares/:id/versions
export const listSoftwareVersions = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const softwareId = (request.params as { id: string }).id;
  const versions = await prisma.softwareVersion.findMany({
    where: { softwareId },
    orderBy: { createdAt: 'desc' },
  });
  reply.send(versions);
};

// POST /api/softwares/:id/versions
export const createSoftwareVersion = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const softwareId = (request.params as { id: string }).id;
  const files = (
    request as unknown as {
      files?: { [fieldname: string]: Express.Multer.File[] };
    }
  ).files;
  const softwareFile = files?.['software_file']?.[0];

  try {
    const { version, changelog, externalUrl } = request.body as {
      version?: string;
      changelog?: string;
      externalUrl?: string;
    };
    if (!version) {
      await safeUnlink(softwareFile?.path);
      throw new AppError('版本号为必填项', 400);
    }

    let fileUrl = '';
    let fileSizeMb: number | null = null;
    let packageFilesList: string[] = [];

    if (softwareFile) {
      fileUrl = getUploadedFileUrl(request, softwareFile, 'softwares');
      fileSizeMb = softwareFile.size / (1024 * 1024);
      // 铁律二·1：纯内存 ZIP 解析，不再读取磁盘路径
      if (softwareFile.buffer) {
        try {
          packageFilesList = await parseZipBuffer(softwareFile.buffer);
        } catch (zipErr) {
          logger.error('[SoftwareVersion] Failed to parse package ZIP from buffer:', zipErr);
        }
      }
    } else if (externalUrl) {
      fileUrl = externalUrl;
    } else {
      throw new AppError('请提供软件文件或外部下载链接', 400);
    }

    const newVersion = await prisma.$transaction(async (tx) => {
      const software = await tx.software.findUnique({ where: { id: softwareId } });
      if (!software) {
        throw new AppError('软件不存在', 404);
      }
      if (software.userId !== request.userId && request.user?.role !== 'ADMIN') {
        throw new AppError('无权操作此软件', 403);
      }

      const nv = await tx.softwareVersion.create({
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
      await tx.software.update({
        where: { id: softwareId },
        data: {
          version,
          fileUrl,
          fileSize: fileSizeMb,
          packageFilesList: packageFilesList.length > 0 ? JSON.stringify(packageFilesList) : null,
          status: request.user?.role === 'ADMIN' ? 'APPROVED' : 'PENDING',
          rejectReason: null,
        },
      });

      return nv;
    });

    await safeUnlink(softwareFile?.path);

    reply.status(201).send(newVersion);
  } catch (err) {
    await safeUnlink(softwareFile?.path);
    throw err;
  }
};

// PUT /api/softwares/:id/versions/:versionId
export const updateSoftwareVersion = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const { id: softwareId, versionId } = request.params as { id: string; versionId: string };
  const { version: newVersionString, changelog } = request.body as {
    version?: string;
    changelog?: string;
  };

  const software = await prisma.software.findUnique({ where: { id: softwareId } });
  if (!software) throw new AppError('软件不存在', 404);
  if (software.userId !== request.userId && request.user?.role !== 'ADMIN') {
    throw new AppError('无权操作此软件', 403);
  }

  const versionItem = await prisma.softwareVersion.findFirst({
    where: { id: versionId, softwareId },
  });
  if (!versionItem) throw new AppError('版本记录不存在', 404);

  if (newVersionString && newVersionString !== versionItem.version) {
    const duplicate = await prisma.softwareVersion.findFirst({
      where: { softwareId, version: newVersionString },
    });
    if (duplicate) throw new AppError('该版本号已存在', 400);
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

  reply.send(updatedVersion);
};

// DELETE /api/softwares/:id/versions/:versionId
export const deleteSoftwareVersion = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const { id: softwareId, versionId } = request.params as { id: string; versionId: string };

  const software = await prisma.software.findUnique({ where: { id: softwareId } });
  if (!software) throw new AppError('软件不存在', 404);
  if (software.userId !== request.userId && request.user?.role !== 'ADMIN') {
    throw new AppError('无权操作此软件', 403);
  }

  const versionItem = await prisma.softwareVersion.findFirst({
    where: { id: versionId, softwareId },
  });
  if (!versionItem) throw new AppError('版本记录不存在', 404);

  const versionCount = await prisma.softwareVersion.count({ where: { softwareId } });
  if (versionCount <= 1) {
    throw new AppError('无法删除最后一个版本文件', 400);
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

  if (versionItem.fileUrl) {
    deleteCloudOrLocalFileByUrl(versionItem.fileUrl).catch((err) => {
      logger.error(
        `[SoftwareController] Failed to delete software version file ${versionItem.fileUrl}:`,
        err,
      );
    });
  }

  reply.send({ success: true, message: '版本记录已删除' });
};

// POST /api/softwares/:id/versions/:versionId/set-active
export const setActiveSoftwareVersion = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const { id: softwareId, versionId } = request.params as { id: string; versionId: string };
  const software = await prisma.software.findUnique({ where: { id: softwareId } });
  if (!software) throw new AppError('软件不存在', 404);
  if (software.userId !== request.userId && request.user?.role !== 'ADMIN') {
    throw new AppError('无权操作此软件', 403);
  }

  const version = await prisma.softwareVersion.findFirst({
    where: { id: versionId, softwareId },
  });
  if (!version) throw new AppError('版本记录不存在', 404);

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
    `[Software] ${softwareId} active version set to ${version.version} by user ${request.userId}`,
  );

  reply.send({
    success: true,
    message: `已将 v${version.version} 设为当前推送版本`,
    software: { id: updated.id, version: updated.version },
  });
};

// GET /api/softwares/:id/package-files - non-blocking, cached ZIP file listing
export const getSoftwarePackageFiles = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const id = (request.params as { id: string }).id;
  const software = await prisma.software.findFirst({
    where: {
      id,
      OR:
        request.user?.role === 'ADMIN'
          ? undefined
          : [{ status: 'APPROVED' }, { userId: request.userId as string }],
    },
    select: { fileUrl: true, packageFilesList: true },
  });

  if (!software) {
    throw new AppError('Software not found or access denied', 404);
  }

  if (!software.fileUrl) {
    reply.send({ packageFiles: [] });
    return;
  }

  if (software.packageFilesList) {
    try {
      const files = JSON.parse(software.packageFilesList);
      if (Array.isArray(files)) {
        reply.send({ packageFiles: files });
        return;
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

  reply.send({ packageFiles });
};
