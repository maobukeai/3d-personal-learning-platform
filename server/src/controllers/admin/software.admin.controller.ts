import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { AppError } from '../../utils/error';
import prisma from '../../services/prisma';
import { logger } from '../../utils/logger';
import { auditService } from '../../services/audit.service';

// ── List all softwares (admin) ───────────────────────────────────────────────────
export const adminListSoftwares = async (req: AuthRequest, res: Response, next: NextFunction) => {
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

    const softwares = await prisma.software.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      ...(usePaginatedResponse ? { skip: (page - 1) * pageSize, take: pageSize } : {}),
      include: { user: { select: { id: true, name: true, avatarUrl: true, email: true } } },
    });

    if (!usePaginatedResponse) {
      res.json(softwares);
      return;
    }

    const [total, statusSummary] = await Promise.all([
      prisma.software.count({ where }),
      prisma.software.groupBy({ by: ['status'], where: baseWhere, _count: { _all: true } }),
    ]);
    const statusCounts = Object.fromEntries(
      statusSummary.map((item) => [item.status, item._count._all]),
    );

    res.json({
      items: softwares,
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

// ── Update software status / info (admin) ───────────────────────────────────────
export const adminUpdateSoftware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as { id: string };
    const existing = await prisma.software.findUnique({ where: { id } });
    if (!existing) return next(new AppError('软件不存在', 404));

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

    const software = await prisma.software.update({ where: { id }, data: updateData });
    await auditService.log({
      userId: req.userId as string,
      action:
        software.status === 'APPROVED'
          ? 'APPROVE_SOFTWARE'
          : software.status === 'REJECTED'
            ? 'REJECT_SOFTWARE'
            : 'UPDATE_SOFTWARE',
      module: 'SOFTWARE',
      description: `管理员更新了软件: ${software.title}`,
      oldValue: existing,
      newValue: software,
      req,
    });
    logger.info(
      `[AdminSoftware] Admin ${req.userId} updated software ${id} → status: ${software.status}`,
    );
    res.json(software);
  } catch (err) {
    next(err);
  }
};

// ── Batch update status (admin) ───────────────────────────────────────────────
export const adminBatchUpdateSoftwares = async (
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
      return next(new AppError('请选择要操作的软件', 400));
    if (!['APPROVED', 'REJECTED', 'PENDING'].includes(status))
      return next(new AppError('状态值无效', 400));
    if (status === 'REJECTED' && !rejectReason?.trim())
      return next(new AppError('拒绝时请填写原因', 400));

    const softwares = await prisma.software.findMany({
      where: { id: { in: ids } },
      select: { id: true, title: true, status: true },
    });
    const result = await prisma.software.updateMany({
      where: { id: { in: ids } },
      data: {
        status,
        rejectReason: status === 'REJECTED' ? rejectReason! : null,
      },
    });

    await auditService.log({
      userId: req.userId as string,
      action: status === 'APPROVED' ? 'APPROVE_SOFTWARE' : 'REJECT_SOFTWARE',
      module: 'SOFTWARE',
      description: `管理员批量${status === 'APPROVED' ? '批准' : '拒绝'}了 ${result.count} 个软件`,
      oldValue: softwares,
      newValue: { ids, status, rejectReason },
      req,
    });
    logger.info(`[AdminSoftware] Admin ${req.userId} batch-${status} ${ids.length} softwares`);
    res.json({ message: `已批量更新 ${result.count} 个软件的状态`, count: result.count });
  } catch (err) {
    next(err);
  }
};

import { deleteCloudOrLocalFileByUrl } from '../../utils/file';

// ── Delete software (admin) ─────────────────────────────────────────────────────
export const adminDeleteSoftware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params as { id: string };
    const existing = await prisma.software.findUnique({ where: { id } });
    if (!existing) return next(new AppError('软件不存在', 404));

    const fileSizeBytes = existing.fileSize ? Math.round(existing.fileSize * 1024 * 1024) : undefined;
    if (existing.fileUrl) {
      deleteCloudOrLocalFileByUrl(existing.fileUrl, fileSizeBytes).catch((error) => {
        logger.warn(`[AdminSoftware] Failed to remove software file ${existing.fileUrl}`, error);
      });
    }
    if (existing.previewUrl) {
      deleteCloudOrLocalFileByUrl(existing.previewUrl).catch((error) => {
        logger.warn(`[AdminSoftware] Failed to remove software preview ${existing.previewUrl}`, error);
      });
    }

    await prisma.software.delete({ where: { id } });
    await auditService.log({
      userId: req.userId as string,
      action: 'DELETE_SOFTWARE',
      module: 'SOFTWARE',
      description: `管理员删除了软件: ${existing.title}`,
      oldValue: existing,
      req,
    });
    logger.info(`[AdminSoftware] Admin ${req.userId} deleted software ${id}`);
    res.json({ message: '软件已删除' });
  } catch (err) {
    next(err);
  }
};
