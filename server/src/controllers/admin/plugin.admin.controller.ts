import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { AppError } from '../../middlewares/error.middleware';
import prisma from '../../services/prisma';
import { logger } from '../../utils/logger';
import path from 'path';
import fs from 'fs';
import { auditService } from '../../services/audit.service';

// ── List all plugins (admin) ───────────────────────────────────────────────────
export const adminListPlugins = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt((req.query.limit || req.query.pageSize) as string) || 36),
    );
    const usePaginatedResponse =
      req.query.response === 'paginated' ||
      Boolean(req.query.page || req.query.limit || req.query.pageSize || search);

    const baseWhere: any = {};
    if (search) {
      baseWhere.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
        { category: { contains: search } },
        { compatibility: { contains: search } },
        { tags: { contains: search } },
        { user: { name: { contains: search } } },
        { user: { email: { contains: search } } },
      ];
    }
    const where = { ...baseWhere };
    if (status && status !== 'ALL') where.status = status;

    const plugins = await prisma.plugin.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      ...(usePaginatedResponse ? { skip: (page - 1) * pageSize, take: pageSize } : {}),
      include: { user: { select: { id: true, name: true, avatarUrl: true, email: true } } },
    });

    if (!usePaginatedResponse) {
      res.json(plugins);
      return;
    }

    const [total, statusSummary] = await Promise.all([
      prisma.plugin.count({ where }),
      prisma.plugin.groupBy({ by: ['status'], where: baseWhere, _count: { _all: true } }),
    ]);
    const statusCounts = Object.fromEntries(
      statusSummary.map((item) => [item.status, item._count._all]),
    );

    res.json({
      items: plugins,
      total,
      page,
      pageSize,
      pages: Math.max(1, Math.ceil(total / pageSize)),
      stats: {
        total: statusSummary.reduce((sum, item) => sum + item._count._all, 0),
        pending: statusCounts.PENDING || 0,
        approved: statusCounts.APPROVED || 0,
        rejected: statusCounts.REJECTED || 0,
      },
    });
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
    await auditService.log({
      userId: req.userId as string,
      action:
        plugin.status === 'APPROVED'
          ? 'APPROVE_PLUGIN'
          : plugin.status === 'REJECTED'
            ? 'REJECT_PLUGIN'
            : 'UPDATE_PLUGIN',
      module: 'PLUGIN',
      description: `管理员更新了插件: ${plugin.title}`,
      oldValue: existing,
      newValue: plugin,
      req,
    });
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

    const plugins = await prisma.plugin.findMany({
      where: { id: { in: ids } },
      select: { id: true, title: true, status: true },
    });
    const result = await prisma.plugin.updateMany({
      where: { id: { in: ids } },
      data: {
        status,
        rejectReason: status === 'REJECTED' ? rejectReason! : null,
      },
    });

    await auditService.log({
      userId: req.userId as string,
      action: status === 'APPROVED' ? 'APPROVE_PLUGIN' : 'REJECT_PLUGIN',
      module: 'PLUGIN',
      description: `管理员批量${status === 'APPROVED' ? '批准' : '拒绝'}了 ${result.count} 个插件`,
      oldValue: plugins,
      newValue: { ids, status, rejectReason },
      req,
    });
    logger.info(`[AdminPlugin] Admin ${req.userId} batch-${status} ${ids.length} plugins`);
    res.json({ message: `已批量更新 ${result.count} 个插件的状态`, count: result.count });
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
    await auditService.log({
      userId: req.userId as string,
      action: 'DELETE_PLUGIN',
      module: 'PLUGIN',
      description: `管理员删除了插件: ${existing.title}`,
      oldValue: existing,
      req,
    });
    logger.info(`[AdminPlugin] Admin ${req.userId} deleted plugin ${id}`);
    res.json({ message: '插件已删除' });
  } catch (err) {
    next(err);
  }
};
