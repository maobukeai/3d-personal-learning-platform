import { Request, Response } from 'express';
import prisma from '../services/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { emitToUser, emitToAll } from '../services/socket.service';
import { createNotification } from '../utils/notification';
import fs from 'fs';
import path from 'path';
import { process3DAsset } from '../utils/asset-processor';
import { checkAssetQuota, checkStorageQuota } from '../utils/quota';
import { deleteFileByUrl } from '../utils/file';
import { auditService, AuditAction, AuditModule } from '../services/audit.service';

export const uploadAsset = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId as string;
    const workspaceId = req.workspaceId;
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const assetFile = files?.asset?.[0];

    if (!assetFile) {
      return res.status(400).json({ error: 'No asset file uploaded' });
    }

    // Check quotas with workspace context
    const assetQuota = await checkAssetQuota(userId, workspaceId);
    if (!assetQuota.allowed) {
      return res.status(403).json({ error: assetQuota.message });
    }

    const fileSizeMB = parseFloat((assetFile.size / (1024 * 1024)).toFixed(2));
    const storageQuota = await checkStorageQuota(userId, fileSizeMB, workspaceId);
    if (!storageQuota.allowed) {
      return res.status(403).json({ error: storageQuota.message });
    }

    const { title, description, categoryId } = req.body;
    if (!categoryId) {
      return res.status(400).json({ error: 'Category is required' });
    }

    const assetsDir = path.join(__dirname, '../../uploads/assets');
    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
    }

    const url = `${req.protocol}://${req.get('host')}/uploads/assets/${assetFile.filename}`;
    const type = path.extname(assetFile.originalname).slice(1).toUpperCase();
    const size = fileSizeMB;

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
        categoryId,
        userId,
        teamId: workspaceId
      },
      include: { category: true }
    });

    // Respond immediately to the user
    res.status(201).json(asset);

    // Process 3D metadata asynchronously in the background
    if (type === 'GLB' || type === 'GLTF') {
      const fullPath = path.join(__dirname, '../../uploads/assets', assetFile.filename);
      
      // We don't await this, letting it run in the background
      process3DAsset(fullPath).then(async (metadata) => {
        if (metadata) {
          await prisma.asset.update({
            where: { id: asset.id },
            data: { ...metadata }
          });
          console.log(`[AssetProcessor] Background processing completed for asset: ${asset.id}`);
        }
      }).catch(err => {
        console.error(`[AssetProcessor] Background processing failed for asset: ${asset.id}`, err);
      });
    }

    await auditService.log({
      userId,
      action: AuditAction.CREATE_ASSET,
      module: AuditModule.ASSET,
      description: `Uploaded asset: ${asset.title}`,
      newValue: asset,
      req
    });

    // Broadcast activity
    emitToAll('new_activity', {
      id: `a-${asset.id}`,
      user: req.user?.name || '有人',
      action: '发布了新资产',
      target: asset.title,
      createdAt: asset.createdAt
    });
  } catch (error) {
    console.error('Upload asset error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateAsset = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const { title, description, categoryId } = req.body;

  try {
    const existingAsset = await prisma.asset.findFirst({
      where: { id, teamId: req.workspaceId }
    });

    if (!existingAsset) {
      return res.status(404).json({ error: 'Asset not found or access denied' });
    }

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (categoryId !== undefined) updateData.categoryId = categoryId;

    const asset = await prisma.asset.update({
      where: { id },
      data: updateData,
      include: { category: true }
    });

    await auditService.log({
      userId: req.userId,
      action: AuditAction.UPDATE_ASSET, 
      module: AuditModule.ASSET,
      description: `Updated asset: ${asset.title}`,
      oldValue: existingAsset,
      newValue: asset,
      req
    });

    res.json(asset);
  } catch (error) {
    console.error('Update asset error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateAssetMetadata = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const { vertices, faces, materials, animations, hasAnimations, dimensions } = req.body;

  try {
    // Verify ownership and workspace context
    const existingAsset = await prisma.asset.findFirst({
      where: { id, userId: req.userId as string, teamId: req.workspaceId }
    });

    if (!existingAsset) {
      return res.status(404).json({ error: 'Asset not found or access denied in this workspace' });
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
    // Verify ownership and workspace context
    const existingAsset = await prisma.asset.findFirst({
      where: { id, userId: req.userId as string, teamId: req.workspaceId }
    });

    if (!existingAsset) {
      return res.status(404).json({ error: 'Asset not found or access denied in this workspace' });
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

    // Delete old thumbnail if it was a local file
    if (existingAsset.thumbnail) {
      deleteFileByUrl(existingAsset.thumbnail);
    }

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
    const categoryId = req.query.categoryId as string;
    const skip = (page - 1) * limit;

    const where: any = { status: 'APPROVED' };
    if (categoryId && categoryId !== 'all') {
      where.categoryId = categoryId;
    }
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
          category: true,
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
      where: { teamId: req.workspaceId },
      orderBy: { createdAt: 'desc' },
      include: { category: true }
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
      where: { id, teamId: req.workspaceId },
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
      where: { id, teamId: req.workspaceId },
    });

    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    // Delete files from disk
    deleteFileByUrl(asset.url);
    if (asset.thumbnail) {
      deleteFileByUrl(asset.thumbnail);
    }

    await prisma.asset.delete({
      where: { id },
    });

    await auditService.log({
      userId: req.userId,
      action: AuditAction.DELETE_ASSET,
      module: AuditModule.ASSET,
      description: `Deleted asset: ${asset.title}`,
      oldValue: asset,
      req
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
  const { status, rejectReason } = req.body;
  
  if (!['APPROVED', 'REJECTED'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const updateData: any = { status };
    if (status === 'REJECTED' && rejectReason) {
      updateData.rejectReason = rejectReason;
    }
    if (status === 'APPROVED') {
      updateData.rejectReason = null;
    }

    const oldAsset = await prisma.asset.findUnique({ where: { id } });
    if (!oldAsset) return res.status(404).json({ error: 'Asset not found' });

    const asset = await prisma.asset.update({
      where: { id },
      data: updateData
    });

    await auditService.log({
      userId: req.userId as string,
      action: status === 'APPROVED' ? AuditAction.APPROVE_ASSET : AuditAction.REJECT_ASSET,
      module: AuditModule.ASSET,
      description: `管理员${status === 'APPROVED' ? '批准' : '拒绝'}了资产: ${asset.title}`,
      oldValue: { status: oldAsset.status },
      newValue: { status, rejectReason },
      req
    });

    await createNotification({
      type: 'SYSTEM',
      title: status === 'APPROVED' ? '资产审核通过' : '资产审核未通过',
      content: status === 'REJECTED' && rejectReason
        ? `你上传的资产 "${asset.title}" 未通过审核，原因：${rejectReason}`
        : `你上传的资产 "${asset.title}" 已被管理员${status === 'APPROVED' ? '批准' : '拒绝'}。`,
      userId: asset.userId,
      link: '/assets',
      category: 'SYSTEM'
    });

    res.json(asset);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const batchUpdateAssetStatus = async (req: AuthRequest, res: Response) => {
  const { ids, status, rejectReason } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: '请选择至少一个资产' });
  }

  if (!['APPROVED', 'REJECTED'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const updateData: any = { status };
    if (status === 'REJECTED' && rejectReason) {
      updateData.rejectReason = rejectReason;
    }
    if (status === 'APPROVED') {
      updateData.rejectReason = null;
    }

    const result = await prisma.asset.updateMany({
      where: { id: { in: ids } },
      data: updateData
    });

    const assets = await prisma.asset.findMany({
      where: { id: { in: ids } },
      select: { id: true, title: true, userId: true }
    });

    for (const asset of assets) {
      await createNotification({
        type: 'SYSTEM',
        title: status === 'APPROVED' ? '资产审核通过' : '资产审核未通过',
        content: status === 'REJECTED' && rejectReason
          ? `你上传的资产 "${asset.title}" 未通过审核，原因：${rejectReason}`
          : `你上传的资产 "${asset.title}" 已被管理员${status === 'APPROVED' ? '批准' : '拒绝'}。`,
        userId: asset.userId,
        link: '/assets',
        category: 'SYSTEM'
      });
    }

    await auditService.log({
      userId: req.userId as string,
      action: status === 'APPROVED' ? AuditAction.APPROVE_ASSET : AuditAction.REJECT_ASSET,
      module: AuditModule.ASSET,
      description: `管理员批量${status === 'APPROVED' ? '批准' : '拒绝'}了 ${result.count} 个资产`,
      newValue: { ids, status, rejectReason },
      req
    });

    res.json({ message: `成功更新 ${result.count} 个资产状态`, count: result.count });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const adminUpdateAsset = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const { title, description, status, categoryId } = req.body;

  try {
    const oldAsset = await prisma.asset.findUnique({ where: { id } });
    if (!oldAsset) return res.status(404).json({ error: 'Asset not found' });

    const asset = await prisma.asset.update({
      where: { id },
      data: { title, description, status, categoryId }
    });

    await auditService.log({
      userId: req.userId as string,
      action: AuditAction.UPDATE_ASSET,
      module: AuditModule.ASSET,
      description: `管理员更新了资产: ${asset.title}`,
      oldValue: oldAsset,
      newValue: asset,
      req
    });

    res.json(asset);
  } catch (error) {
    console.error('Admin update asset error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const adminDeleteAsset = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  try {
    const asset = await prisma.asset.findUnique({ where: { id } });
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    // Delete file from disk if exists
    const fileName = asset.url.split('/').pop();
    if (fileName) {
      const filePath = path.join(__dirname, '../../uploads/assets', fileName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await prisma.asset.delete({ where: { id } });

    await auditService.log({
      userId: req.userId as string,
      action: AuditAction.DELETE_ASSET,
      module: AuditModule.ASSET,
      description: `管理员删除了资产: ${asset.title}`,
      oldValue: asset,
      req
    });

    res.json({ message: 'Asset deleted successfully by admin' });
  } catch (error) {
    console.error('Admin delete asset error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
