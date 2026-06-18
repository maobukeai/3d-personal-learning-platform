import { Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { Prisma } from '@prisma/client';
import prisma from '../services/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import path from 'path';
import fs from 'fs';
import { checkStorageQuota } from '../utils/quota';
import { deleteCloudOrLocalFileByUrl } from '../utils/file';
import { auditService, AuditAction, AuditModule } from '../services/audit.service';
import { AppError } from '../utils/error';
import { createPaginationMeta, getPaginationParams } from '../utils/pagination';
import { parseTags } from '../utils/tags';

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
  const { category, sort, search, resolution, tag } = req.query;
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
          teamId: req.workspaceId,
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
      where.favorites = { some: { userId } };
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
  try {
    const userId = req.userId as string;
    const workspaceId = req.workspaceId;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const materialFile = files?.material?.[0];
    const previewFile = files?.preview?.[0];

    if (!materialFile) {
      return next(new AppError('No material file uploaded', 400));
    }

    const fileSizeMB = materialFile.size / (1024 * 1024);

    // Check quota
    const storageQuota = await checkStorageQuota(userId, fileSizeMB, workspaceId);
    if (!storageQuota.allowed) {
      return next(new AppError(storageQuota.message || 'Quota exceeded', 403));
    }

    const { title, description, category, resolution, tags, isProcedural } = req.body;

    const fileUrl = (materialFile as any).url || `${req.protocol}://${req.get('host')}/uploads/materials/${materialFile.filename}`;
    let previewUrl = null;
    if (previewFile) {
      previewUrl = (previewFile as any).url || `${req.protocol}://${req.get('host')}/uploads/materials/${previewFile.filename}`;
    }

    const material = await prisma.material.create({
      data: {
        title: title || materialFile.originalname,
        description: description || null,
        category: category || '其他',
        resolution,
        previewUrl,
        fileUrl,
        fileSize: Math.round(fileSizeMB * 100) / 100,
        tags: normalizeTagsForStorage(tags),
        isProcedural: isProcedural === 'true',
        userId: userId,
        teamId: workspaceId,
      },
    });

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
    next(error);
  }
};

export const updateMaterial = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  try {
    const existing = await prisma.material.findFirst({
      where: { id, teamId: req.workspaceId },
    });

    if (!existing) return next(new AppError('Material not found', 404));

    if (existing.userId !== req.userId && req.user?.role !== 'ADMIN') {
      return next(new AppError('Not authorized to update this material', 403));
    }

    const { title, description, category, resolution, tags, isProcedural } = req.body;
    const updateData: Prisma.MaterialUpdateInput = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description || null;
    if (category !== undefined) updateData.category = category;
    if (resolution !== undefined) updateData.resolution = resolution || null;
    if (tags !== undefined) updateData.tags = normalizeTagsForStorage(tags);
    if (isProcedural !== undefined) {
      updateData.isProcedural = isProcedural === true || isProcedural === 'true';
    }
    if (existing.userId === req.userId && req.user?.role !== 'ADMIN') {
      updateData.status = 'PENDING';
      updateData.rejectReason = null;
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
      logger.error(`[MaterialController] Failed to delete material file ${material.fileUrl} in background:`, err);
    });
    if (material.previewUrl) {
      deleteCloudOrLocalFileByUrl(material.previewUrl).catch((err) => {
        logger.error(`[MaterialController] Failed to delete material preview ${material.previewUrl} in background:`, err);
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

export const toggleFavorite = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const materialId = req.params.id as string;
  try {
    await getWorkspaceMaterial(materialId, req, { requireApproved: true });

    const existing = await prisma.materialFavorite.findFirst({
      where: { userId: req.userId as string, materialId },
    });

    if (existing) {
      await prisma.materialFavorite.delete({ where: { id: existing.id } });
      res.json({ isFavorited: false });
    } else {
      await prisma.materialFavorite.create({
        data: { userId: req.userId as string, materialId },
      });
      res.json({ isFavorited: true });
    }
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
        data: approvedIds.map((materialId) => ({ userId, materialId })),
        skipDuplicates: true,
      });
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
    const favorites = await prisma.materialFavorite.findMany({
      where: {
        userId: req.userId as string,
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

    const materials = favorites.map((f) => ({
      ...f.material,
      isFavorited: true,
    }));

    res.json(materials);
  } catch (error) {
    next(error);
  }
};
