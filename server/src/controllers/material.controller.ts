import { Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { Prisma } from '@prisma/client';
import prisma from '../services/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import path from 'path';
import fs from 'fs';
import { checkStorageQuota } from '../utils/quota';
import {
  deleteCloudOrLocalFileByUrl,
  getZipFileNames,
  parseZipLocal,
  getZipFileDirectory,
  getUploadedFileUrl,
  urlToPath,
  moveTempFileToDestination,
} from '../utils/file';
import { auditService, AuditAction, AuditModule } from '../services/audit.service';
import { AppError } from '../utils/error';
import { createPaginationMeta, getPaginationParams } from '../utils/pagination';
import { parseTags } from '../utils/tags';

import { parseBool } from '../utils/parser';

const ALL_FILTER_VALUES = new Set(['all', '全部', '全部材料', 'All Materials', 'All']);
const MATERIAL_STATUSES = new Set(['PENDING', 'APPROVED', 'REJECTED']);

const materialInclude = {
  user: {
    select: { id: true, name: true, email: true, avatarUrl: true },
  },
  _count: {
    select: { favorites: true },
  },
} satisfies Prisma.MaterialInclude;

const isAllFilter = (value: unknown) =>
  value === undefined || value === null || ALL_FILTER_VALUES.has(String(value));

const parseBooleanQuery = (value: unknown) => {
  if (value === true || value === 'true' || value === '1') return true;
  if (value === false || value === 'false' || value === '0') return false;
  return undefined;
};

const normalizeStatus = (value: unknown) => {
  const normalized = String(value || '').toUpperCase();
  return MATERIAL_STATUSES.has(normalized) ? normalized : undefined;
};

const normalizeTagsForStorage = (tags?: string | string[] | null) => {
  if (!tags) return null;
  const list = Array.isArray(tags)
    ? tags
    : String(tags)
        .split(/[,，\s]+/)
        .map((tag) => tag.trim());
  const clean = Array.from(
    new Set(
      list
        .map(String)
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  );
  return clean.length ? JSON.stringify(clean) : null;
};

const canManageCurrentWorkspaceMaterials = async (req: AuthRequest) => {
  if (req.user?.role === 'ADMIN') return true;
  const membership = await prisma.teamMember.findFirst({
    where: { teamId: req.workspaceId, userId: req.userId },
    select: { role: true },
  });
  return !!membership && ['OWNER', 'ADMIN'].includes(membership.role);
};

const getWorkspaceMaterial = async (
  id: string,
  req: AuthRequest,
  options: { requireApproved?: boolean } = {},
) => {
  const material = await prisma.material.findFirst({
    where: {
      id,
      OR:
        req.user?.role === 'ADMIN'
          ? undefined
          : [{ status: 'APPROVED' }, { teamId: req.workspaceId }, { userId: req.userId }],
      ...(options.requireApproved ? { status: 'APPROVED' } : {}),
    },
    include: materialInclude,
  });

  if (!material) {
    throw new AppError('Material not found', 404);
  }

  return material;
};

export const getAllMaterials = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { category, sort, search, resolution, tag, favoriteCategory } = req.query;
  try {
    const userId = req.userId as string;
    const mine = parseBooleanQuery(req.query.mine) === true;
    const favoritesOnly = parseBooleanQuery(req.query.favoritesOnly) === true;
    const procedural = parseBooleanQuery(req.query.procedural);
    const status = normalizeStatus(req.query.status);
    const usePagination = Boolean(
      req.query.page || req.query.limit || req.query.pageSize || req.query.paginated,
    );
    const { page, limit, skip } = getPaginationParams(req.query, 96, 160);

    const where: Prisma.MaterialWhereInput = mine
      ? {
          userId,
          ...(status ? { status } : {}),
        }
      : {
          status: 'APPROVED',
        };

    if (!isAllFilter(category)) {
      where.category = category as string;
    }
    if (!isAllFilter(resolution)) {
      where.resolution = resolution as string;
    }
    if (!isAllFilter(tag)) {
      where.tags = { contains: tag as string };
    }
    if (procedural !== undefined) {
      where.isProcedural = procedural;
    }
    if (favoritesOnly) {
      where.favorites = {
        some: {
          userId,
          ...(favoriteCategory && favoriteCategory !== 'all'
            ? { category: favoriteCategory as string }
            : {}),
        },
      };
    }
    if (search) {
      where.OR = [
        { title: { contains: search as string } },
        { tags: { contains: search as string } },
        { description: { contains: search as string } },
        { category: { contains: search as string } },
      ];
    }

    const orderBy: Prisma.MaterialOrderByWithRelationInput =
      sort === 'popular'
        ? { downloads: 'desc' }
        : sort === 'largest'
          ? { fileSize: 'desc' }
          : sort === 'smallest'
            ? { fileSize: 'asc' }
            : { createdAt: 'desc' };

    const [materials, total] = await Promise.all([
      prisma.material.findMany({
        where,
        include: materialInclude,
        orderBy,
        ...(usePagination ? { skip, take: limit } : {}),
      }),
      usePagination ? prisma.material.count({ where }) : Promise.resolve(0),
    ]);

    const userFavorites = await prisma.materialFavorite.findMany({
      where: { userId, materialId: { in: materials.map((material) => material.id) } },
      select: { materialId: true },
    });
    const favoriteIds = new Set(userFavorites.map((f) => f.materialId));

    let materialsWithFavorite = materials.map((m) => ({
      ...m,
      isFavorited: favoriteIds.has(m.id),
    }));

    if (sort === 'favorited') {
      materialsWithFavorite = materialsWithFavorite.sort(
        (a, b) => (b._count?.favorites || 0) - (a._count?.favorites || 0),
      );
    }

    if (usePagination) {
      res.json({
        items: materialsWithFavorite,
        meta: createPaginationMeta(page, limit, total),
      });
      return;
    }

    res.json(materialsWithFavorite);
  } catch (error) {
    next(error);
  }
};

export const getMaterialInsights = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId as string;
    const where: Prisma.MaterialWhereInput = { status: 'APPROVED' };
    const [materials, favoriteCount, myUploads, myPending, myApproved, myRejected, pendingCount] =
      await Promise.all([
        prisma.material.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          include: materialInclude,
          take: 500,
        }),
        prisma.materialFavorite.count({
          where: { userId, material: { status: 'APPROVED' } },
        }),
        prisma.material.count({ where: { userId, teamId: req.workspaceId } }),
        prisma.material.count({ where: { userId, teamId: req.workspaceId, status: 'PENDING' } }),
        prisma.material.count({ where: { userId, teamId: req.workspaceId, status: 'APPROVED' } }),
        prisma.material.count({ where: { userId, teamId: req.workspaceId, status: 'REJECTED' } }),
        prisma.material.count({ where: { status: 'PENDING', teamId: req.workspaceId } }),
      ]);

    const favoriteIds = new Set(
      (
        await prisma.materialFavorite.findMany({
          where: { userId, materialId: { in: materials.map((material) => material.id) } },
          select: { materialId: true },
        })
      ).map((favorite) => favorite.materialId),
    );

    const categories = new Map<string, { name: string; count: number; downloads: number }>();
    const resolutions = new Map<string, number>();
    const tagCounts = new Map<string, number>();
    const dailyUploads = new Map<string, number>();
    let totalDownloads = 0;
    let totalFavorites = 0;
    let totalSize = 0;
    let procedural = 0;

    materials.forEach((material) => {
      totalDownloads += material.downloads || 0;
      totalFavorites += material._count.favorites || 0;
      totalSize += material.fileSize || 0;
      if (material.isProcedural) procedural += 1;

      const category = material.category || '其他';
      const current = categories.get(category) || { name: category, count: 0, downloads: 0 };
      current.count += 1;
      current.downloads += material.downloads || 0;
      categories.set(category, current);

      const resolution = material.resolution || '未标注';
      resolutions.set(resolution, (resolutions.get(resolution) || 0) + 1);

      const day = material.createdAt.toISOString().slice(0, 10);
      dailyUploads.set(day, (dailyUploads.get(day) || 0) + 1);

      parseTags(material.tags).forEach((tag) => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });

    const attachFavorite = (material: (typeof materials)[number]) => ({
      ...material,
      isFavorited: favoriteIds.has(material.id),
    });

    res.json({
      summary: {
        total: materials.length,
        downloads: totalDownloads,
        favorites: totalFavorites,
        myFavorites: favoriteCount,
        myUploads,
        myPending,
        myApproved,
        myRejected,
        pending: pendingCount,
        procedural,
        averageSize: materials.length ? Number((totalSize / materials.length).toFixed(2)) : 0,
      },
      categories: Array.from(categories.values()).sort((a, b) => b.count - a.count),
      resolutions: Array.from(resolutions.entries())
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count),
      hotTags: Array.from(tagCounts.entries())
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 24),
      dailyUploads: Array.from(dailyUploads.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-14),
      topDownloads: [...materials]
        .sort((a, b) => b.downloads - a.downloads)
        .slice(0, 8)
        .map(attachFavorite),
      latest: materials.slice(0, 8).map(attachFavorite),
    });
  } catch (error) {
    next(error);
  }
};

export const getMaterialById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  try {
    const material = await getWorkspaceMaterial(id, req);

    const isFavorited = await prisma.materialFavorite.findFirst({
      where: { userId: req.userId as string, materialId: id },
    });

    res.json({ ...material, isFavorited: !!isFavorited });
  } catch (error) {
    next(error);
  }
};

export const getMyMaterials = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const status = normalizeStatus(req.query.status);
    const materials = await prisma.material.findMany({
      where: {
        userId: req.userId as string,
        teamId: req.workspaceId,
        ...(status ? { status } : {}),
      },
      include: materialInclude,
      orderBy: { createdAt: 'desc' },
    });

    const userFavorites = await prisma.materialFavorite.findMany({
      where: {
        userId: req.userId as string,
        materialId: { in: materials.map((material) => material.id) },
      },
      select: { materialId: true },
    });
    const favoriteIds = new Set(userFavorites.map((favorite) => favorite.materialId));

    res.json(
      materials.map((material) => ({ ...material, isFavorited: favoriteIds.has(material.id) })),
    );
  } catch (error) {
    next(error);
  }
};

export const uploadMaterial = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
  const materialFile = files?.material?.[0];
  const previewFile = files?.preview?.[0];
  try {
    const userId = req.userId as string;
    const workspaceId = req.workspaceId;

    const {
      title,
      description,
      category,
      resolution,
      tags,
      isProcedural,
      externalUrl,
      originality,
      originalAuthor,
      originalLink,
      license,
      isFree,
      linkedCourseId,
      linkedLessonId,
    } = req.body;

    let tempMaterialPath = req.body.tempMaterialPath;
    let tempPreviewPath = req.body.tempPreviewPath;

    if (!materialFile && !tempMaterialPath && !externalUrl) {
      return next(new AppError('No material file or external link provided', 400));
    }

    if (tempMaterialPath) {
      tempMaterialPath = moveTempFileToDestination(req, tempMaterialPath, 'materials');
    }
    if (tempPreviewPath) {
      tempPreviewPath = moveTempFileToDestination(req, tempPreviewPath, 'materials');
    }

    let fileSizeMB = materialFile ? materialFile.size / (1024 * 1024) : 0;
    if (!materialFile && tempMaterialPath) {
      const localPath = urlToPath(tempMaterialPath);
      if (localPath && fs.existsSync(localPath)) {
        fileSizeMB = fs.statSync(localPath).size / (1024 * 1024);
      }
    }

    // Check quota
    const storageQuota = await checkStorageQuota(userId, fileSizeMB, workspaceId);
    if (!storageQuota.allowed) {
      if (materialFile && fs.existsSync(materialFile.path)) {
        try {
          fs.unlinkSync(materialFile.path);
        } catch (_e) {}
      }
      if (previewFile && fs.existsSync(previewFile.path)) {
        try {
          fs.unlinkSync(previewFile.path);
        } catch (_e) {}
      }
      return next(new AppError(storageQuota.message || 'Quota exceeded', 403));
    }

    let packageFilesList: string[] = [];
    if (materialFile) {
      const ext = path.extname(materialFile.originalname).toLowerCase();
      if (ext === '.zip') {
        packageFilesList = await parseZipLocal(materialFile.path);
      }
    } else if (tempMaterialPath) {
      const localPath = urlToPath(tempMaterialPath);
      if (localPath && fs.existsSync(localPath)) {
        const ext = path.extname(localPath).toLowerCase();
        if (ext === '.zip') {
          packageFilesList = await parseZipLocal(localPath);
        }
      }
    }

    let fileUrl = externalUrl;
    if (materialFile) {
      fileUrl = getUploadedFileUrl(req, materialFile, 'materials');
    } else if (tempMaterialPath) {
      fileUrl = tempMaterialPath;
    }

    let previewUrl = null;
    if (previewFile) {
      previewUrl = getUploadedFileUrl(req, previewFile, 'materials');
    } else if (tempPreviewPath) {
      previewUrl = tempPreviewPath;
    }

    const material = await prisma.material.create({
      data: {
        title: title || (materialFile ? materialFile.originalname : '未命名材质'),
        description: description || null,
        category: category || '其他',
        resolution,
        previewUrl,
        fileUrl,
        status: req.user?.role === 'ADMIN' ? 'APPROVED' : 'PENDING',
        fileSize: Math.round(fileSizeMB * 100) / 100,
        packageFilesList: packageFilesList.length > 0 ? JSON.stringify(packageFilesList) : null,
        tags: normalizeTagsForStorage(tags),
        isProcedural: parseBool(isProcedural),
        userId: userId,
        teamId: workspaceId,
        originality: originality || 'ORIGINAL',
        originalAuthor: originalAuthor || null,
        originalLink: originalLink || null,
        license: license || 'CC_BY',
        isFree: parseBool(isFree, true),
        linkedCourseId: linkedCourseId || null,
        linkedLessonId: linkedLessonId || null,
      },
    });

    // Clean up local material file after parsing
    if (materialFile && fs.existsSync(materialFile.path)) {
      try {
        fs.unlinkSync(materialFile.path);
      } catch (err) {
        logger.error('[Material] Failed to delete local material file:', err);
      }
    }

    await auditService.log({
      userId,
      action: AuditAction.CREATE_MATERIAL,
      module: AuditModule.MATERIAL,
      description: `Uploaded material: ${material.title}`,
      newValue: material,
      req,
    });

    res.status(201).json(material);
  } catch (error) {
    if (materialFile?.path && fs.existsSync(materialFile.path)) {
      try {
        fs.unlinkSync(materialFile.path);
      } catch (_e) {}
    }
    if (previewFile?.path && fs.existsSync(previewFile.path)) {
      try {
        fs.unlinkSync(previewFile.path);
      } catch (_e) {}
    }
    next(error);
  }
};

export const updateMaterial = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
  const materialFile = files?.material?.[0];
  const previewFile = files?.preview?.[0];
  try {
    let tempMaterialPath = req.body.tempMaterialPath;
    let tempPreviewPath = req.body.tempPreviewPath;

    if (tempMaterialPath) {
      tempMaterialPath = moveTempFileToDestination(req, tempMaterialPath, 'materials');
    }
    if (tempPreviewPath) {
      tempPreviewPath = moveTempFileToDestination(req, tempPreviewPath, 'materials');
    }

    const existing = await prisma.material.findFirst({
      where: { id, teamId: req.workspaceId },
    });

    if (!existing) {
      if (materialFile?.path && fs.existsSync(materialFile.path)) {
        try {
          fs.unlinkSync(materialFile.path);
        } catch (_e) {}
      }
      if (previewFile?.path && fs.existsSync(previewFile.path)) {
        try {
          fs.unlinkSync(previewFile.path);
        } catch (_e) {}
      }
      return next(new AppError('Material not found', 404));
    }

    if (existing.userId !== req.userId && req.user?.role !== 'ADMIN') {
      if (materialFile?.path && fs.existsSync(materialFile.path)) {
        try {
          fs.unlinkSync(materialFile.path);
        } catch (_e) {}
      }
      if (previewFile?.path && fs.existsSync(previewFile.path)) {
        try {
          fs.unlinkSync(previewFile.path);
        } catch (_e) {}
      }
      return next(new AppError('Not authorized to update this material', 403));
    }

    const {
      title,
      description,
      category,
      resolution,
      tags,
      isProcedural,
      externalUrl,
      originality,
      originalAuthor,
      originalLink,
      license,
      isFree,
      linkedCourseId,
      linkedLessonId,
    } = req.body;
    const updateData: Prisma.MaterialUncheckedUpdateInput = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description || null;
    if (category !== undefined) updateData.category = category;
    if (resolution !== undefined) updateData.resolution = resolution || null;
    if (tags !== undefined) updateData.tags = normalizeTagsForStorage(tags);
    if (isProcedural !== undefined) {
      updateData.isProcedural = isProcedural === true || isProcedural === 'true';
    }
    if (originality !== undefined) updateData.originality = originality;
    if (originalAuthor !== undefined) updateData.originalAuthor = originalAuthor || null;
    if (originalLink !== undefined) updateData.originalLink = originalLink || null;
    if (license !== undefined) updateData.license = license;
    if (isFree !== undefined) {
      updateData.isFree = isFree === true || isFree === 'true';
    }
    if (linkedCourseId !== undefined) updateData.linkedCourseId = linkedCourseId || null;
    if (linkedLessonId !== undefined) updateData.linkedLessonId = linkedLessonId || null;
    if (existing.userId === req.userId && req.user?.role !== 'ADMIN') {
      updateData.status = 'PENDING';
      updateData.rejectReason = null;
    }

    // Process new file uploads if present
    if (materialFile) {
      const fileSizeMB = materialFile.size / (1024 * 1024);
      const storageQuota = await checkStorageQuota(
        req.userId as string,
        fileSizeMB,
        req.workspaceId,
      );
      if (!storageQuota.allowed) {
        try {
          fs.unlinkSync(materialFile.path);
        } catch (_e) {}
        if (previewFile?.path && fs.existsSync(previewFile.path)) {
          try {
            fs.unlinkSync(previewFile.path);
          } catch (_e) {}
        }
        return next(new AppError(storageQuota.message || 'Quota exceeded', 403));
      }

      // Delete old file
      if (existing.fileUrl && !existing.fileUrl.startsWith('http')) {
        deleteCloudOrLocalFileByUrl(existing.fileUrl).catch(() => {});
      }

      const fileUrl = getUploadedFileUrl(req, materialFile, 'materials');
      updateData.fileUrl = fileUrl;
      updateData.fileSize = Math.round(fileSizeMB * 100) / 100;

      let packageFilesList: string[] = [];
      const ext = path.extname(materialFile.originalname).toLowerCase();
      if (ext === '.zip') {
        packageFilesList = await parseZipLocal(materialFile.path);
      }
      updateData.packageFilesList =
        packageFilesList.length > 0 ? JSON.stringify(packageFilesList) : null;

      // Clean up local temp file
      if (fs.existsSync(materialFile.path)) {
        try {
          fs.unlinkSync(materialFile.path);
        } catch (_e) {}
      }
    } else if (tempMaterialPath) {
      let fileSizeMB = 0;
      const localPath = urlToPath(tempMaterialPath);
      if (localPath && fs.existsSync(localPath)) {
        fileSizeMB = fs.statSync(localPath).size / (1024 * 1024);
      }

      const storageQuota = await checkStorageQuota(
        req.userId as string,
        fileSizeMB,
        req.workspaceId,
      );
      if (!storageQuota.allowed) {
        return next(new AppError(storageQuota.message || 'Quota exceeded', 403));
      }

      // Delete old file
      if (existing.fileUrl && !existing.fileUrl.startsWith('http')) {
        deleteCloudOrLocalFileByUrl(existing.fileUrl).catch(() => {});
      }

      updateData.fileUrl = tempMaterialPath;
      updateData.fileSize = Math.round(fileSizeMB * 100) / 100;

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
      if (externalUrl && existing.fileUrl && !existing.fileUrl.startsWith('http')) {
        deleteCloudOrLocalFileByUrl(existing.fileUrl).catch(() => {});
        updateData.fileSize = 0;
        updateData.packageFilesList = null;
      }
      if (externalUrl !== undefined) {
        updateData.fileUrl = externalUrl || null;
      }
    }

    if (previewFile) {
      if (existing.previewUrl && !existing.previewUrl.startsWith('http')) {
        deleteCloudOrLocalFileByUrl(existing.previewUrl).catch(() => {});
      }
      const previewUrl = getUploadedFileUrl(req, previewFile, 'materials');
      updateData.previewUrl = previewUrl;

      // Clean up local temp file
      if (fs.existsSync(previewFile.path)) {
        try {
          fs.unlinkSync(previewFile.path);
        } catch (_e) {}
      }
    } else if (tempPreviewPath) {
      if (existing.previewUrl && !existing.previewUrl.startsWith('http')) {
        deleteCloudOrLocalFileByUrl(existing.previewUrl).catch(() => {});
      }
      updateData.previewUrl = tempPreviewPath;
    }

    const material = await prisma.material.update({
      where: { id },
      data: updateData,
      include: materialInclude,
    });

    await auditService.log({
      userId: req.userId as string,
      action: AuditAction.UPDATE_MATERIAL,
      module: AuditModule.MATERIAL,
      description: `Updated material: ${material.title}`,
      oldValue: existing,
      newValue: material,
      req,
    });

    res.json(material);
  } catch (error) {
    if (materialFile?.path && fs.existsSync(materialFile.path)) {
      try {
        fs.unlinkSync(materialFile.path);
      } catch (_e) {}
    }
    if (previewFile?.path && fs.existsSync(previewFile.path)) {
      try {
        fs.unlinkSync(previewFile.path);
      } catch (_e) {}
    }
    next(error);
  }
};

export const deleteMaterial = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  try {
    const material = await prisma.material.findFirst({
      where: { id, teamId: req.workspaceId },
    });

    if (!material) return next(new AppError('Material not found', 404));

    // Auth check: material owner, team owner/admin, or platform admin
    if (material.userId !== req.userId && req.user?.role !== 'ADMIN') {
      const membership = await prisma.teamMember.findFirst({
        where: { teamId: req.workspaceId, userId: req.userId },
      });
      if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
        return next(new AppError('Not authorized to delete this material', 403));
      }
    }

    deleteCloudOrLocalFileByUrl(material.fileUrl).catch((err) => {
      logger.error(
        `[MaterialController] Failed to delete material file ${material.fileUrl} in background:`,
        err,
      );
    });
    if (material.previewUrl) {
      deleteCloudOrLocalFileByUrl(material.previewUrl).catch((err) => {
        logger.error(
          `[MaterialController] Failed to delete material preview ${material.previewUrl} in background:`,
          err,
        );
      });
    }

    await prisma.material.delete({ where: { id } });

    await auditService.log({
      userId: req.userId as string,
      action: AuditAction.DELETE_MATERIAL,
      module: AuditModule.MATERIAL,
      description: `Deleted material: ${material.title}`,
      oldValue: material,
      req,
    });

    res.json({ message: 'Material deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const downloadMaterial = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  try {
    const material = await getWorkspaceMaterial(id, req, { requireApproved: true });

    if (material.fileUrl.startsWith('http://') || material.fileUrl.startsWith('https://')) {
      await prisma.material.update({
        where: { id },
        data: { downloads: { increment: 1 } },
      });
      return res.redirect(material.fileUrl);
    }

    const fileName = material.fileUrl.split('/').pop();
    if (!fileName) return next(new AppError('Invalid file URL', 400));

    const filePath = path.join(__dirname, '../../uploads/materials', fileName);
    if (!fs.existsSync(filePath)) return next(new AppError('File not found', 404));

    const ext = path.extname(fileName);
    const safeTitle = material.title.replace(/[^a-zA-Z0-9\u4e00-\u9fff._-]/g, '_');
    const downloadName = encodeURIComponent(safeTitle + ext);

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${downloadName}"; filename*=UTF-8''${downloadName}`,
    );

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    next(error);
  }
};

export const recordDownload = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  try {
    await getWorkspaceMaterial(id, req, { requireApproved: true });

    const material = await prisma.material.update({
      where: { id },
      data: {
        downloads: {
          increment: 1,
        },
      },
    });
    res.json({ message: 'Download recorded', downloads: material.downloads });
  } catch (error) {
    next(error);
  }
};

// ── Custom material categories setting helper functions ───────────────────────────────
const CUSTOM_MATERIAL_CATEGORIES_SETTING_KEY = 'material_favorite_categories';

const getCustomMaterialCategories = async (userId: string): Promise<string[]> => {
  try {
    const setting = await prisma.userSetting.findUnique({
      where: { userId_key: { userId, key: CUSTOM_MATERIAL_CATEGORIES_SETTING_KEY } },
    });
    if (setting && setting.value) {
      return JSON.parse(setting.value) as string[];
    }
  } catch (err) {
    logger.warn(
      '[Material] Failed to parse custom categories setting:',
      err instanceof Error ? err.message : err,
    );
  }
  return [];
};

const saveCustomMaterialCategories = async (userId: string, categories: string[]) => {
  const uniqueCats = Array.from(new Set(categories.map((c) => c.trim()).filter(Boolean)));
  await prisma.userSetting.upsert({
    where: { userId_key: { userId, key: CUSTOM_MATERIAL_CATEGORIES_SETTING_KEY } },
    update: { value: JSON.stringify(uniqueCats) },
    create: {
      userId,
      key: CUSTOM_MATERIAL_CATEGORIES_SETTING_KEY,
      value: JSON.stringify(uniqueCats),
    },
  });
};

export const toggleFavorite = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const materialId = req.params.id as string;
  const categoryVal = typeof req.body?.category === 'string' ? req.body.category.trim() : '默认';
  const category = categoryVal || '默认';
  const userId = req.userId as string;
  try {
    await getWorkspaceMaterial(materialId, req, { requireApproved: true });

    const existing = await prisma.materialFavorite.findUnique({
      where: { userId_materialId: { userId, materialId } },
    });

    let isFavorited = false;
    if (existing) {
      if (existing.category === category) {
        await prisma.materialFavorite.delete({ where: { id: existing.id } });
        isFavorited = false;
      } else {
        await prisma.materialFavorite.update({
          where: { id: existing.id },
          data: { category },
        });
        isFavorited = true;
      }
    } else {
      await prisma.materialFavorite.create({
        data: { userId, materialId, category },
      });
      isFavorited = true;
    }

    if (isFavorited && category !== '默认') {
      const customCats = await getCustomMaterialCategories(userId);
      if (!customCats.includes(category)) {
        customCats.push(category);
        await saveCustomMaterialCategories(userId, customCats);
      }
    }

    res.json({ isFavorited });
  } catch (error) {
    next(error);
  }
};

export const bulkFavoriteMaterials = async (
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
      return next(new AppError('No materials selected', 400));
    }

    const approvedMaterials = await prisma.material.findMany({
      where: {
        id: { in: ids },
        status: 'APPROVED',
      },
      select: { id: true },
    });
    const approvedIds = approvedMaterials.map((material) => material.id);

    if (favorite) {
      await prisma.materialFavorite.createMany({
        data: approvedIds.map((materialId) => ({ userId, materialId, category })),
        skipDuplicates: true,
      });

      if (category !== '默认') {
        const customCats = await getCustomMaterialCategories(userId);
        if (!customCats.includes(category)) {
          customCats.push(category);
          await saveCustomMaterialCategories(userId, customCats);
        }
      }
    } else {
      await prisma.materialFavorite.deleteMany({
        where: { userId, materialId: { in: approvedIds } },
      });
    }

    res.json({ ids: approvedIds, isFavorited: favorite });
  } catch (error) {
    next(error);
  }
};

export const reviewMaterial = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  try {
    const status = normalizeStatus(req.body?.status);
    if (!status) {
      return next(new AppError('Invalid material status', 400));
    }

    const existing = await prisma.material.findFirst({
      where: req.user?.role === 'ADMIN' ? { id } : { id, teamId: req.workspaceId },
    });
    if (!existing) return next(new AppError('Material not found', 404));

    if (!(await canManageCurrentWorkspaceMaterials(req))) {
      return next(new AppError('Not authorized to review this material', 403));
    }

    const rejectReason =
      status === 'REJECTED'
        ? String(req.body?.rejectReason || '材料暂未通过审核，请完善预览图、说明或授权信息。')
        : null;

    const material = await prisma.material.update({
      where: { id },
      data: {
        status,
        rejectReason,
      },
      include: materialInclude,
    });

    await auditService.log({
      userId: req.userId as string,
      action: AuditAction.UPDATE_MATERIAL,
      module: AuditModule.MATERIAL,
      description: `Reviewed material: ${material.title} -> ${status}`,
      oldValue: existing,
      newValue: material,
      req,
    });

    res.json(material);
  } catch (error) {
    next(error);
  }
};

export const getMyFavorites = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId as string;
    const favorites = await prisma.materialFavorite.findMany({
      where: {
        userId,
        material: {
          teamId: req.workspaceId,
          status: 'APPROVED',
        },
      },
      include: {
        material: {
          include: {
            user: { select: { id: true, name: true, email: true, avatarUrl: true } },
            _count: { select: { favorites: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const categoryList = await prisma.materialFavorite.groupBy({
      by: ['category'],
      where: { userId },
    });

    const dbCategories = categoryList.map((c) => c.category);
    const customCategories = await getCustomMaterialCategories(userId);
    const categoriesSet = new Set(['默认', ...dbCategories, ...customCategories]);

    res.json({
      ids: favorites.map((f) => f.materialId),
      favorites: favorites.map((f) => ({
        id: f.id,
        category: f.category,
        material: {
          ...f.material,
          isFavorited: true,
        },
      })),
      categories: Array.from(categoriesSet),
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/materials/favorites/categories
export const createMaterialFavoriteCategory = async (
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
    const customCats = await getCustomMaterialCategories(userId);
    if (!customCats.includes(newCat)) {
      customCats.push(newCat);
      await saveCustomMaterialCategories(userId, customCats);
    }

    res.json({ success: true, message: '分类创建成功', categories: ['默认', ...customCats] });
  } catch (error) {
    next(error);
  }
};

// PUT /api/materials/favorites/categories
export const updateMaterialFavoriteCategory = async (
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
    await prisma.materialFavorite.updateMany({
      where: {
        userId,
        category: oldCat,
      },
      data: {
        category: newCat,
      },
    });

    const customCats = await getCustomMaterialCategories(userId);
    const updatedCats = customCats.map((c) => (c === oldCat ? newCat : c));
    await saveCustomMaterialCategories(userId, updatedCats);

    res.json({ success: true, message: '分类更新成功' });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/materials/favorites/categories/:categoryName
export const deleteMaterialFavoriteCategory = async (
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
    await prisma.materialFavorite.deleteMany({
      where: {
        userId,
        category: cat,
      },
    });

    const customCats = await getCustomMaterialCategories(userId);
    const filteredCats = customCats.filter((c) => c !== cat);
    await saveCustomMaterialCategories(userId, filteredCats);

    res.json({ success: true, message: '分类删除成功' });
  } catch (error) {
    next(error);
  }
};

// GET /api/materials/:id/package-files - non-blocking, cached ZIP file listing
export const getMaterialPackageFiles = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const id = req.params.id as string;
  try {
    const material = await prisma.material.findFirst({
      where: {
        id,
        OR:
          req.user?.role === 'ADMIN'
            ? undefined
            : [{ status: 'APPROVED' }, { teamId: req.workspaceId }, { userId: req.userId }],
      },
      select: { fileUrl: true, packageFilesList: true },
    });

    if (!material) {
      return next(new AppError('Material not found or access denied', 404));
    }

    if (!material.fileUrl) {
      return res.json({ packageFiles: [] });
    }

    if (material.packageFilesList) {
      try {
        const files = JSON.parse(material.packageFilesList);
        if (Array.isArray(files)) {
          return res.json({ packageFiles: files });
        }
      } catch (_e) {
        // ignore and fallback
      }
    }

    const packageFiles = await getZipFileNames(material.fileUrl);

    // Cache to DB for future requests
    if (packageFiles.length > 0) {
      await prisma.material
        .update({
          where: { id },
          data: { packageFilesList: JSON.stringify(packageFiles) },
        })
        .catch((err) => {
          logger.error(
            `[Material] Failed to update packageFilesList fallback for material ${id}:`,
            err,
          );
        });
    }

    res.json({ packageFiles });
  } catch (error) {
    next(error);
  }
};

// GET /api/materials/:id/zip-entry - stream a specific texture image inside the ZIP archive
export const getMaterialZipEntry = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  const filePathInsideZip = req.query.path as string;

  if (!filePathInsideZip) {
    return next(new AppError('Query parameter "path" is required', 400));
  }

  try {
    const material = await prisma.material.findFirst({
      where: {
        id,
        OR:
          req.user?.role === 'ADMIN'
            ? undefined
            : [{ status: 'APPROVED' }, { teamId: req.workspaceId }, { userId: req.userId }],
      },
      select: { fileUrl: true },
    });

    if (!material) {
      return next(new AppError('Material not found or access denied', 404));
    }

    if (!material.fileUrl) {
      return next(new AppError('Material has no file package', 404));
    }

    const packageUrl = material.fileUrl;
    const directory = await getZipFileDirectory(packageUrl);

    if (!directory) {
      return next(new AppError('Failed to open material package file', 400));
    }

    const file = directory.files.find((f: any) => f.path === filePathInsideZip);

    if (!file) {
      return next(new AppError(`File "${filePathInsideZip}" not found in package`, 404));
    }

    const ext = path.extname(filePathInsideZip).toLowerCase();
    let contentType = 'application/octet-stream';
    if (['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif'].includes(ext)) {
      contentType = `image/${ext.replace('.', '') === 'jpg' ? 'jpeg' : ext.replace('.', '')}`;
    } else if (ext === '.tga') {
      contentType = 'image/x-tga';
    } else if (ext === '.hdr') {
      contentType = 'image/vnd.radiance';
    } else if (ext === '.exr') {
      contentType = 'image/x-exr';
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');

    file.stream().pipe(res);
  } catch (error) {
    next(error);
  }
};

// GET /api/materials/:id/comments
export const getMaterialComments = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const materialId = req.params.id as string;
  try {
    const material = await prisma.material.findFirst({
      where: {
        id: materialId,
        OR:
          req.user?.role === 'ADMIN'
            ? undefined
            : [{ status: 'APPROVED' }, { teamId: req.workspaceId }, { userId: req.userId }],
      },
    });
    if (!material) {
      return next(new AppError('Material not found or access denied', 404));
    }
    const comments = await prisma.materialComment.findMany({
      where: { materialId },
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

// POST /api/materials/:id/comments
export const createMaterialComment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const materialId = req.params.id as string;
  const userId = req.user?.id;
  const { content } = req.body;

  if (!userId) {
    return next(new AppError('Unauthorized', 401));
  }
  if (!content || !content.trim()) {
    return next(new AppError('Comment content cannot be empty', 400));
  }

  try {
    const material = await prisma.material.findFirst({
      where: {
        id: materialId,
        OR:
          req.user?.role === 'ADMIN'
            ? undefined
            : [{ status: 'APPROVED' }, { teamId: req.workspaceId }, { userId: req.userId }],
      },
    });
    if (!material) {
      return next(new AppError('Material not found or access denied', 404));
    }
    const comment = await prisma.materialComment.create({
      data: {
        content: content.trim(),
        materialId,
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

// DELETE /api/materials/comments/:commentId
export const deleteMaterialComment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const commentId = req.params.commentId as string;
  const userId = req.user?.id;
  const userRole = req.user?.role;

  if (!userId) {
    return next(new AppError('Unauthorized', 401));
  }

  try {
    const comment = await prisma.materialComment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      return next(new AppError('Comment not found', 404));
    }

    if (comment.userId !== userId && userRole !== 'ADMIN') {
      return next(new AppError('Forbidden', 403));
    }

    await prisma.materialComment.delete({
      where: { id: commentId },
    });

    res.json({ success: true, message: 'Comment deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// GET /api/materials/:id/share
export const getMaterialShare = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const materialId = req.params.id as string;
  try {
    const material = await prisma.material.findFirst({
      where:
        req.user?.role === 'ADMIN'
          ? { id: materialId }
          : { id: materialId, OR: [{ userId: req.userId }, { teamId: req.workspaceId }] },
    });
    if (!material) {
      return next(new AppError('Material not found or access denied', 404));
    }
    const share = await prisma.materialShare.findUnique({
      where: { materialId },
    });
    res.json(share);
  } catch (error) {
    next(error);
  }
};

// POST /api/materials/:id/share
export const createOrUpdateMaterialShare = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const materialId = req.params.id as string;
  const userId = req.userId as string;
  const { expireHours, expiresAt, customText } = req.body;
  try {
    const material = await prisma.material.findFirst({
      where:
        req.user?.role === 'ADMIN'
          ? { id: materialId }
          : { id: materialId, OR: [{ userId: req.userId }, { teamId: req.workspaceId }] },
    });
    if (!material) {
      return next(new AppError('Material not found or access denied', 404));
    }

    let calculatedExpiresAt: Date | null = null;
    if (expiresAt) {
      calculatedExpiresAt = new Date(expiresAt);
    } else if (expireHours !== undefined && expireHours !== null) {
      calculatedExpiresAt = new Date(Date.now() + expireHours * 60 * 60 * 1000);
    }

    const existing = await prisma.materialShare.findUnique({
      where: { materialId },
    });

    let share;
    if (existing) {
      share = await prisma.materialShare.update({
        where: { materialId },
        data: {
          expiresAt: calculatedExpiresAt,
          customText,
        },
      });
    } else {
      share = await prisma.materialShare.create({
        data: {
          materialId,
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

// DELETE /api/materials/:id/share
export const cancelMaterialShare = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const materialId = req.params.id as string;
  try {
    const material = await prisma.material.findFirst({
      where:
        req.user?.role === 'ADMIN'
          ? { id: materialId }
          : { id: materialId, OR: [{ userId: req.userId }, { teamId: req.workspaceId }] },
    });
    if (!material) {
      return next(new AppError('Material not found or access denied', 404));
    }

    await prisma.materialShare.deleteMany({
      where: { materialId },
    });
    res.json({ success: true, message: 'Share link cancelled' });
  } catch (error) {
    next(error);
  }
};

// GET /api/materials/share/:shareId
export const getPublicSharedMaterial = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const shareId = req.params.shareId as string;
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const share = await prisma.materialShare.findUnique({
      where: { id: shareId },
      include: {
        material: {
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

export const bulkDeleteMaterials = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: '请提供要删除的材质 ID 列表' });
    }

    const whereCondition: any = {
      id: { in: ids },
    };
    if (req.user?.role !== 'ADMIN') {
      whereCondition.userId = req.userId;
    }

    const materialsToDelete = await prisma.material.findMany({
      where: whereCondition,
    });

    if (materialsToDelete.length === 0) {
      return res.status(404).json({ error: '未找到可删除的材质或无权操作' });
    }

    for (const material of materialsToDelete) {
      deleteCloudOrLocalFileByUrl(material.fileUrl).catch((err) => {
        logger.error(`[MaterialController] Bulk delete: failed to delete file ${material.fileUrl}:`, err);
      });
      if (material.previewUrl) {
        deleteCloudOrLocalFileByUrl(material.previewUrl).catch((err) => {
          logger.error(`[MaterialController] Bulk delete: failed to delete preview ${material.previewUrl}:`, err);
        });
      }
    }

    const deleteIds = materialsToDelete.map((m) => m.id);
    await prisma.material.deleteMany({
      where: { id: { in: deleteIds } },
    });

    res.json({
      success: true,
      message: `成功批量删除 ${deleteIds.length} 个材质`,
      count: deleteIds.length,
      deletedIds: deleteIds,
    });
  } catch (error) {
    next(error);
  }
};
