import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { AppError } from '../../middlewares/error.middleware';
import prisma from '../../services/prisma';
import { logger } from '../../utils/logger';
import path from 'path';
import fs from 'fs';

// ── List all plugins (admin) ───────────────────────────────────────────────────
export const adminListPlugins = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 200));

    const where: any = {};
    if (status && status !== 'ALL') where.status = status;
    if (search) {
      where.OR = [{ title: { contains: search } }, { description: { contains: search } }];
    }

    const plugins = await prisma.plugin.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { user: { select: { id: true, name: true, avatarUrl: true, email: true } } },
    });

    // Return flat array to match existing admin material/showcase API pattern
    res.json(plugins);
  } catch (err) {
    next(err);
  }
};

// ── Update plugin status / info (admin) ───────────────────────────────────────
export const adminUpdatePlugin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as { id: string };
    const existing = await prisma.plugin.findUnique({ where: { id } });
    if (!existing) return next(new AppError('插件不存在', 404));

    const allowed = [
      'title',
      'description',
      'category',
      'version',
      'compatibility',
      'tags',
      'installGuide',
      'status',
      'rejectReason',
    ];
    const updateData: Record<string, any> = {};
    for (const field of allowed) {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    }
    if (updateData.status !== 'REJECTED') updateData.rejectReason = null;

    const plugin = await prisma.plugin.update({ where: { id }, data: updateData });
    logger.info(
      `[AdminPlugin] Admin ${req.userId} updated plugin ${id} → status: ${plugin.status}`,
    );
    res.json(plugin);
  } catch (err) {
    next(err);
  }
};

// ── Batch update status (admin) ───────────────────────────────────────────────
export const adminBatchUpdatePlugins = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { ids, status, rejectReason } = req.body as {
      ids: string[];
      status: string;
      rejectReason?: string;
    };

    if (!Array.isArray(ids) || ids.length === 0)
      return next(new AppError('请选择要操作的插件', 400));
    if (!['APPROVED', 'REJECTED', 'PENDING'].includes(status))
      return next(new AppError('状态值无效', 400));
    if (status === 'REJECTED' && !rejectReason?.trim())
      return next(new AppError('拒绝时请填写原因', 400));

    await prisma.plugin.updateMany({
      where: { id: { in: ids } },
      data: {
        status,
        rejectReason: status === 'REJECTED' ? rejectReason! : null,
      },
    });

    logger.info(`[AdminPlugin] Admin ${req.userId} batch-${status} ${ids.length} plugins`);
    res.json({ message: `已批量更新 ${ids.length} 个插件的状态` });
  } catch (err) {
    next(err);
  }
};

// ── Delete plugin (admin) ─────────────────────────────────────────────────────
export const adminDeletePlugin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as { id: string };
    const existing = await prisma.plugin.findUnique({ where: { id } });
    if (!existing) return next(new AppError('插件不存在', 404));

    for (const urlField of [existing.fileUrl, existing.previewUrl]) {
      if (!urlField) continue;
      const filePath = path.join(process.cwd(), urlField.replace(/^\//, ''));
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (error) {
          logger.warn(`[AdminPlugin] Failed to remove plugin file ${filePath}`, error);
        }
      }
    }

    await prisma.plugin.delete({ where: { id } });
    logger.info(`[AdminPlugin] Admin ${req.userId} deleted plugin ${id}`);
    res.json({ message: '插件已删除' });
  } catch (err) {
    next(err);
  }
};
