import { Response } from 'express';
import prisma from '../services/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import path from 'path';
import fs from 'fs';
import { checkStorageQuota } from '../utils/quota';
import { deleteFileByUrl } from '../utils/file';
import { auditService, AuditAction, AuditModule } from '../services/audit.service';

export const getAllMaterials = async (req: AuthRequest, res: Response) => {
  const { category, sort, search } = req.query;
  try {
    const where: any = {
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

    const orderBy: any = sort === 'popular' ? { downloads: 'desc' } : { createdAt: 'desc' };

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
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getMaterialById = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  try {
    const material = await prisma.material.findUnique({
      where: { id },
      include: {
        user: {
          select: { name: true, email: true, avatarUrl: true },
        },
        _count: {
          select: { favorites: true },
        },
      },
    });
    if (!material) return res.status(404).json({ error: 'Material not found' });

    const isFavorited = await prisma.materialFavorite.findFirst({
      where: { userId: req.userId as string, materialId: id },
    });

    res.json({ ...material, isFavorited: !!isFavorited });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const uploadMaterial = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId as string;
    const workspaceId = req.workspaceId;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const materialFile = files?.material?.[0];
    const previewFile = files?.preview?.[0];

    if (!materialFile) {
      return res.status(400).json({ error: 'No material file uploaded' });
    }

    const fileSizeMB = materialFile.size / (1024 * 1024);

    // Check quota
    const storageQuota = await checkStorageQuota(userId, fileSizeMB, workspaceId);
    if (!storageQuota.allowed) {
      return res.status(403).json({ error: storageQuota.message });
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
    console.error('Upload material error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteMaterial = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  try {
    const material = await prisma.material.findFirst({
      where: { id, teamId: req.workspaceId },
    });

    if (!material) return res.status(404).json({ error: 'Material not found' });

    deleteFileByUrl(material.fileUrl);
    if (material.previewUrl) {
      deleteFileByUrl(material.previewUrl);
    }

    await prisma.material.delete({ where: { id } });

    await auditService.log({
      userId: req.userId,
      action: AuditAction.DELETE_MATERIAL,
      module: AuditModule.MATERIAL,
      description: `Deleted material: ${material.title}`,
      oldValue: material,
      req,
    });

    res.json({ message: 'Material deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const downloadMaterial = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  try {
    const material = await prisma.material.findUnique({ where: { id } });
    if (!material) return res.status(404).json({ error: 'Material not found' });

    const fileName = material.fileUrl.split('/').pop();
    if (!fileName) return res.status(400).json({ error: 'Invalid file URL' });

    const filePath = path.join(__dirname, '../../uploads/materials', fileName);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });

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
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const recordDownload = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  try {
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
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const toggleFavorite = async (req: AuthRequest, res: Response) => {
  const materialId = req.params.id as string;
  try {
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
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getMyFavorites = async (req: AuthRequest, res: Response) => {
  try {
    const favorites = await prisma.materialFavorite.findMany({
      where: { userId: req.userId as string },
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
    res.status(500).json({ error: 'Internal server error' });
  }
};
