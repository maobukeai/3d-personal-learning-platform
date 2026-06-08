import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { AppError } from '../middlewares/error.middleware';
import prisma from '../services/prisma';
import { logger } from '../utils/logger';
import path from 'path';
import fs from 'fs';

// ── Public: list approved plugins ─────────────────────────────────────────────
export const listPlugins = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize as string) || 20));
    const category = req.query.category as string | undefined;
    const search = req.query.search as string | undefined;

    const where: any = { status: 'APPROVED' };
    if (category) where.category = category;
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
        { tags: { contains: search } },
      ];
    }

    const [plugins, total] = await Promise.all([
      prisma.plugin.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      }),
      prisma.plugin.count({ where }),
    ]);

    res.json({ plugins, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (err) {
    next(err);
  }
};

// ── My plugins ─────────────────────────────────────────────────────────────────
export const getMyPlugins = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const plugins = await prisma.plugin.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: 'desc' },
    });
    res.json(plugins);
  } catch (err) {
    next(err);
  }
};

// ── Upload / create plugin ─────────────────────────────────────────────────────
export const uploadPlugin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
  const pluginFile = files?.['file']?.[0];
  const previewFile = files?.['preview']?.[0];

  if (!pluginFile) {
    return next(new AppError('请上传插件文件', 400));
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
    } = req.body;

    if (!title?.trim()) {
      return next(new AppError('插件名称为必填项', 400));
    }

    const fileUrl = `/uploads/plugins/${pluginFile.filename}`;
    const fileSizeMb = pluginFile.size / (1024 * 1024);
    const previewUrl = previewFile ? `/uploads/plugins/${previewFile.filename}` : null;

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
        previewUrl,
        installGuide: installGuide?.trim() || null,
        userId: req.userId!,
        status: 'PENDING',
      },
    });

    logger.info(`[Plugin] User ${req.userId} uploaded plugin: ${plugin.id}`);
    res.status(201).json(plugin);
  } catch (err) {
    // Clean up uploaded files on error
    if (pluginFile?.path && fs.existsSync(pluginFile.path)) fs.unlinkSync(pluginFile.path);
    if (previewFile?.path && fs.existsSync(previewFile.path)) fs.unlinkSync(previewFile.path);
    next(err);
  }
};

// ── Update plugin (owner only) ─────────────────────────────────────────────────
export const updatePlugin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as { id: string };
    const existing = await prisma.plugin.findUnique({ where: { id } });

    if (!existing) return next(new AppError('插件不存在', 404));
    if (existing.userId !== req.userId) return next(new AppError('无权修改此插件', 403));

    const allowed = [
      'title',
      'description',
      'category',
      'version',
      'compatibility',
      'tags',
      'installGuide',
    ];
    const updateData: Record<string, any> = {};
    for (const field of allowed) {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    }
    // Editing resets to PENDING for re-review
    updateData.status = 'PENDING';
    updateData.rejectReason = null;

    const plugin = await prisma.plugin.update({ where: { id }, data: updateData });
    res.json(plugin);
  } catch (err) {
    next(err);
  }
};

// ── Delete plugin (owner only) ─────────────────────────────────────────────────
export const deletePlugin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as { id: string };
    const existing = await prisma.plugin.findUnique({ where: { id } });

    if (!existing) return next(new AppError('插件不存在', 404));
    if (existing.userId !== req.userId) return next(new AppError('无权删除此插件', 403));

    // Remove files
    for (const urlField of [existing.fileUrl, existing.previewUrl]) {
      if (!urlField) continue;
      const filePath = path.join(process.cwd(), urlField.replace(/^\//, ''));
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (error) {
          logger.warn(`[Plugin] Failed to remove plugin file ${filePath}`, error);
        }
      }
    }

    await prisma.plugin.delete({ where: { id } });
    res.json({ message: '插件已删除' });
  } catch (err) {
    next(err);
  }
};

// ── Record download ────────────────────────────────────────────────────────────
export const downloadPlugin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as { id: string };
    const plugin = await prisma.plugin.findUnique({ where: { id } });
    if (!plugin || plugin.status !== 'APPROVED') return next(new AppError('插件不存在', 404));

    await prisma.plugin.update({ where: { id }, data: { downloads: { increment: 1 } } });
    res.json({ fileUrl: plugin.fileUrl });
  } catch (err) {
    next(err);
  }
};
