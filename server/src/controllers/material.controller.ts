import { Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../services/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import path from 'path';
import fs from 'fs';
import { checkStorageQuota } from '../utils/quota';
import { deleteFileByUrl } from '../utils/file';
import { auditService, AuditAction, AuditModule } from '../services/audit.service';
import { AppError } from '../middlewares/error.middleware';

const getWorkspaceMaterial = async (
  id: string,
  req: AuthRequest,
  options: { requireApproved?: boolean } = {},
) => {
  const material = await prisma.material.findFirst({
    where: {
      id,
      teamId: req.workspaceId,
      ...(options.requireApproved ? { status: 'APPROVED' } : {}),
    },
    include: {
      user: {
        select: { name: true, email: true, avatarUrl: true },
      },
      _count: {
        select: { favorites: true },
      },
    },
  });

  if (!material) {
    throw new AppError('Material not found', 404);
  }

  return material;
};

export const getAllMaterials = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { category, sort, search } = req.query;
  try {
    const where: Prisma.MaterialWhereInput = {
      teamId: req.workspaceId,
      status: 'APPROVED',
    };
    if (category && category !== '全部材料') {
      where.category = category as string;
    }
    if (search) {
      where.OR = [
        { title: { contains: search as string } },
        { tags: { contains: search as string } },
        { description: { contains: search as string } },
      ];
    }

    const orderBy: Prisma.MaterialOrderByWithRelationInput =
      sort === 'popular' ? { downloads: 'desc' } : { createdAt: 'desc' };

    const materials = await prisma.material.findMany({
      where,
      include: {
        user: {
          select: { name: true, email: true, avatarUrl: true },
        },
        _count: {
          select: { favorites: true },
        },
      },
      orderBy,
    });

    const userId = req.userId;
    const userFavorites = await prisma.materialFavorite.findMany({
      where: { userId },
      select: { materialId: true },
    });
    const favoriteIds = new Set(userFavorites.map((f) => f.materialId));

    const materialsWithFavorite = materials.map((m) => ({
      ...m,
      isFavorited: favoriteIds.has(m.id),
    }));

    res.json(materialsWithFavorite);
  } catch (error) {
    next(error);
  }
};

export const getMaterialById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  try {
    const material = await getWorkspaceMaterial(id, req, { requireApproved: true });

    const isFavorited = await prisma.materialFavorite.findFirst({
      where: { userId: req.userId as string, materialId: id },
    });

    res.json({ ...material, isFavorited: !!isFavorited });
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

    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/materials/${materialFile.filename}`;
    let previewUrl = null;
    if (previewFile) {
      previewUrl = `${req.protocol}://${req.get('host')}/uploads/materials/${previewFile.filename}`;
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
        tags,
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

    deleteFileByUrl(material.fileUrl);
    if (material.previewUrl) {
      deleteFileByUrl(material.previewUrl);
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
            user: { select: { name: true, email: true, avatarUrl: true } },
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
