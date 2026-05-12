import { Response } from 'express';
import prisma from '../services/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import path from 'path';
import fs from 'fs';

export const getAllMaterials = async (req: AuthRequest, res: Response) => {
  const { category } = req.query;
  try {
    const where: any = { status: 'APPROVED' };
    if (category && category !== '全部材料') {
      where.category = category as string;
    }

    const materials = await prisma.material.findMany({
      where,
      include: {
        user: {
          select: { name: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(materials);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const uploadMaterial = async (req: AuthRequest, res: Response) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const materialFile = files?.material?.[0];
    const previewFile = files?.preview?.[0];

    if (!materialFile) {
      return res.status(400).json({ error: 'No material file uploaded' });
    }

    const { title, category, resolution, tags, isProcedural } = req.body;
    
    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/materials/${materialFile.filename}`;
    let previewUrl = null;
    if (previewFile) {
      previewUrl = `${req.protocol}://${req.get('host')}/uploads/materials/${previewFile.filename}`;
    }

    const material = await prisma.material.create({
      data: {
        title: title || materialFile.originalname,
        category: category || '其他',
        resolution,
        tags,
        previewUrl,
        fileUrl,
        isProcedural: isProcedural === 'true',
        userId: req.userId as string
      }
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
      where: { id, userId: req.userId as string }
    });

    if (!material) return res.status(404).json({ error: 'Material not found' });

    // Delete files
    const deleteFile = (url: string) => {
      const fileName = url.split('/').pop();
      if (fileName) {
        const filePath = path.join(__dirname, '../../uploads/materials', fileName);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
    };

    deleteFile(material.fileUrl);
    if (material.previewUrl) deleteFile(material.previewUrl);

    await prisma.material.delete({ where: { id } });
    res.json({ message: 'Material deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};
