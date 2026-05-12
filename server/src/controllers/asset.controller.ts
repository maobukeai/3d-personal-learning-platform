import { Request, Response } from 'express';
import prisma from '../services/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { emitToUser } from '../services/socket.service';
import fs from 'fs';
import path from 'path';

export const uploadAsset = async (req: AuthRequest, res: Response) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const assetFile = files?.asset?.[0];

    if (!assetFile) {
      return res.status(400).json({ error: 'No asset file uploaded' });
    }

    const { title, description } = req.body;
    const assetsDir = path.join(__dirname, '../../uploads/assets');
    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
    }

    const url = `${req.protocol}://${req.get('host')}/uploads/assets/${assetFile.filename}`;
    const type = path.extname(assetFile.originalname).slice(1).toUpperCase();
    const size = parseFloat((assetFile.size / (1024 * 1024)).toFixed(2)); // Size in MB

    let thumbnailUrl = null;
    if (files?.thumbnail?.[0]) {
      thumbnailUrl = `${req.protocol}://${req.get('host')}/uploads/assets/${files.thumbnail[0].filename}`;
    }

    const asset = await prisma.asset.create({
      data: {
        title: title || assetFile.originalname,
        description,
        url,
        thumbnail: thumbnailUrl,
        type,
        size,
        userId: req.userId as string,
      },
    });

    res.status(201).json(asset);
  } catch (error) {
    console.error('Upload asset error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateAssetMetadata = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const { vertices, faces, materials, animations, hasAnimations, dimensions } = req.body;

  try {
    // Verify ownership
    const existingAsset = await prisma.asset.findFirst({
      where: { id, userId: req.userId as string }
    });

    if (!existingAsset) {
      return res.status(404).json({ error: 'Asset not found or access denied' });
    }

    const updateData: any = {
      hasAnimations: hasAnimations === true || hasAnimations === 'true',
      dimensions
    };

    if (vertices !== undefined) updateData.vertices = parseInt(vertices);
    if (faces !== undefined) updateData.faces = parseInt(faces);
    if (materials !== undefined) updateData.materials = parseInt(materials);
    if (animations !== undefined) updateData.animations = parseInt(animations);

    const asset = await prisma.asset.update({
      where: { id },
      data: updateData
    });
    res.json(asset);
  } catch (error) {
    console.error('Update asset metadata error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateAssetThumbnail = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const { thumbnail } = req.body; // Expecting base64 string

  if (!thumbnail) {
    return res.status(400).json({ error: 'No thumbnail provided' });
  }

  try {
    // Verify ownership
    const existingAsset = await prisma.asset.findFirst({
      where: { id, userId: req.userId as string }
    });

    if (!existingAsset) {
      return res.status(404).json({ error: 'Asset not found or access denied' });
    }

    const assetsDir = path.join(__dirname, '../../uploads/assets');
    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
    }

    // Convert base64 to file
    const base64Data = thumbnail.replace(/^data:image\/png;base64,/, "");
    const fileName = `thumb-${id}-${Date.now()}.png`;
    const filePath = path.join(assetsDir, fileName);
    
    fs.writeFileSync(filePath, base64Data, 'base64');

    const thumbnailUrl = `${req.protocol}://${req.get('host')}/uploads/assets/${fileName}`;

    const asset = await prisma.asset.update({
      where: { id },
      data: { thumbnail: thumbnailUrl }
    });

    res.json(asset);
  } catch (error) {
    console.error('Update asset thumbnail error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getPublicAssets = async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 12;
    const search = req.query.search as string;
    const skip = (page - 1) * limit;

    const where: any = { status: 'APPROVED' };
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } }
      ];
    }

    const [assets, total] = await Promise.all([
      prisma.asset.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: {
            select: { name: true, avatarUrl: true }
          }
        }
      }),
      prisma.asset.count({ where })
    ]);

    res.json({
      assets,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getUserAssets = async (req: AuthRequest, res: Response) => {
  try {
    const assets = await prisma.asset.findMany({
      where: { userId: req.userId as string },
      orderBy: { createdAt: 'desc' },
    });
    res.json(assets);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAssetById = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  try {
    const asset = await prisma.asset.findFirst({
      where: { id, userId: req.userId as string },
    });

    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    res.json(asset);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteAsset = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  try {
    const asset = await prisma.asset.findFirst({
      where: { id, userId: req.userId as string },
    });

    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    // Delete file from disk
    const fileName = asset.url.split('/').pop();
    if (fileName) {
      const filePath = path.join(__dirname, '../../uploads/assets', fileName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await prisma.asset.delete({
      where: { id },
    });

    res.json({ message: 'Asset deleted successfully' });
  } catch (error) {
    console.error('Delete asset error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAllAssetsForAdmin = async (req: AuthRequest, res: Response) => {
  const { status } = req.query;
  try {
    const assets = await prisma.asset.findMany({
      where: status ? { status: status as string } : {},
      include: {
        user: {
          select: { name: true, email: true, avatarUrl: true }
        }
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(assets);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateAssetStatus = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const { status } = req.body; // 'APPROVED', 'REJECTED'
  
  if (!['APPROVED', 'REJECTED'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const asset = await prisma.asset.update({
      where: { id },
      data: { status }
    });

    // Notify user about audit result
    const notification = await prisma.notification.create({
      data: {
        type: 'SYSTEM',
        title: status === 'APPROVED' ? '资产审核通过' : '资产审核未通过',
        content: `你上传的资产 "${asset.title}" 已被管理员${status === 'APPROVED' ? '批准' : '拒绝'}。`,
        userId: asset.userId,
        link: '/assets'
      }
    });

    // Push real-time notification
    emitToUser(asset.userId, 'new_notification', notification);

    res.json(asset);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};
