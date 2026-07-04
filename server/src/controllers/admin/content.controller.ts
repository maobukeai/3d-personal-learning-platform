import { logger } from '../../utils/logger';
import { Prisma } from '@prisma/client';
import { Response, NextFunction } from 'express';
import { deleteCloudOrLocalFileByUrl } from '../../utils/file';
import prisma from '../../services/prisma';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { createNotification, createNotificationBatch } from '../../utils/notification';
import { auditService, AuditModule, AuditAction } from '../../services/audit.service';
import { AppError } from '../../utils/error';
import { clampLimit, clampPage } from '../../utils/pagination';

// --- Feedback Audit ---

export const getAllFeedback = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const status =
    typeof req.query.status === 'string' && req.query.status !== 'ALL'
      ? req.query.status
      : undefined;
  const priority =
    typeof req.query.priority === 'string' && req.query.priority !== 'ALL'
      ? req.query.priority
      : undefined;
  const type =
    typeof req.query.type === 'string' && req.query.type !== 'ALL' ? req.query.type : undefined;

  try {
    const feedbacks = await prisma.feedback.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(priority ? { priority } : {}),
        ...(type ? { type } : {}),
        ...(q
          ? {
              OR: [
                { title: { contains: q } },
                { description: { contains: q } },
                { user: { name: { contains: q } } },
                { user: { email: { contains: q } } },
              ],
            }
          : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(feedbacks);
  } catch (error) {
    next(error);
  }
};

export const updateFeedbackStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  const { status, adminReply } = req.body;

  const validStatuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
  if (status && !validStatuses.includes(status)) {
    return next(new AppError('Invalid status value', 400));
  }

  if (typeof adminReply === 'string' && adminReply.length > 1000) {
    return next(new AppError('Reply must be shorter than 1000 characters', 400));
  }

  try {
    const updateData: Partial<Prisma.FeedbackUpdateInput> = {};
    if (status) updateData.status = status;
    if (adminReply !== undefined) {
      updateData.adminReply = String(adminReply).trim();
      updateData.repliedAt = new Date();
      updateData.adminId = req.userId;
    }

    const updatedFeedback = await prisma.feedback.update({
      where: { id },
      data: updateData,
    });

    // Create notification for the user
    let notificationTitle = '反馈更新';
    let notificationContent = '';

    if (status && !adminReply) {
      notificationContent = `您的反馈 "${updatedFeedback.title}" 状态已更新为: ${status}`;
    } else if (adminReply) {
      notificationContent = `管理员回复了您的反馈 "${updatedFeedback.title}"`;
    }

    if (notificationContent) {
      await createNotification({
        type: 'SYSTEM',
        title: notificationTitle,
        content: notificationContent,
        userId: updatedFeedback.userId,
        link: '/report-bug?tab=history',
        category: 'SYSTEM',
      });
    }

    res.json(updatedFeedback);
  } catch (error) {
    next(error);
  }
};

export const batchUpdateFeedbackStatus = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const { ids, status } = req.body as { ids?: string[]; status?: string };
  const validStatuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

  if (!Array.isArray(ids) || ids.length === 0) {
    return next(new AppError('Please select at least one feedback item', 400));
  }

  if (!status || !validStatuses.includes(status)) {
    return next(new AppError('Invalid status value', 400));
  }

  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));

  try {
    const feedbacks = await prisma.feedback.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, title: true, userId: true, status: true },
    });

    if (feedbacks.length === 0) {
      return next(new AppError('Feedback not found', 404));
    }

    const result = await prisma.feedback.updateMany({
      where: { id: { in: feedbacks.map((feedback) => feedback.id) } },
      data: { status },
    });

    await createNotificationBatch(
      feedbacks.map((feedback) => ({
        type: 'SYSTEM',
        title: '反馈状态更新',
        content: `你的反馈 "${feedback.title}" 状态已更新为 ${status}`,
        userId: feedback.userId,
        link: '/report-bug?tab=history',
        category: 'SYSTEM',
      })),
    );

    await auditService.log({
      userId: req.userId as string,
      action: 'UPDATE_FEEDBACK',
      module: 'FEEDBACK',
      description: `Admin batch updated ${result.count} feedback items to ${status}`,
      oldValue: feedbacks,
      newValue: { ids: feedbacks.map((feedback) => feedback.id), status },
      req,
    });

    res.json({ count: result.count });
  } catch (error) {
    next(error);
  }
};

export const deleteFeedback = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  try {
    // Check if feedback exists
    const feedback = await prisma.feedback.findUnique({ where: { id } });
    if (!feedback) {
      return next(new AppError('反馈不存在', 404));
    }

    if (feedback.attachmentUrl) {
      deleteCloudOrLocalFileByUrl(feedback.attachmentUrl).catch((err) => {
        logger.error('[ContentController] Failed to delete feedback attachment file:', err);
      });
    }

    await prisma.feedback.delete({ where: { id } });
    res.json({ message: 'Feedback deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const batchDeleteFeedback = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { ids } = req.body as { ids?: string[] };

  if (!Array.isArray(ids) || ids.length === 0) {
    return next(new AppError('Please select at least one feedback item', 400));
  }

  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));

  try {
    const feedbacks = await prisma.feedback.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, title: true, userId: true, status: true, attachmentUrl: true },
    });

    if (feedbacks.length === 0) {
      return next(new AppError('Feedback not found', 404));
    }

    for (const item of feedbacks) {
      if (item.attachmentUrl) {
        deleteCloudOrLocalFileByUrl(item.attachmentUrl).catch((err) => {
          logger.error('[ContentController] Failed to delete feedback attachment file:', err);
        });
      }
    }

    const result = await prisma.feedback.deleteMany({
      where: { id: { in: feedbacks.map((feedback) => feedback.id) } },
    });

    await auditService.log({
      userId: req.userId as string,
      action: 'DELETE_FEEDBACK',
      module: 'FEEDBACK',
      description: `Admin deleted ${result.count} feedback items`,
      oldValue: feedbacks,
      req,
    });

    res.json({ count: result.count });
  } catch (error) {
    next(error);
  }
};

// --- Material Audit ---

export const getAllMaterialsForAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const { status, search, page: pageQuery, limit: limitQuery, response } = req.query;
  try {
    const q = typeof search === 'string' ? search.trim() : '';
    const normalizedStatus = typeof status === 'string' && status !== 'ALL' ? status : undefined;
    const page = clampPage(pageQuery);
    const limit = clampLimit(limitQuery, 36, 100);
    const usePaginatedResponse = response === 'paginated' || Boolean(pageQuery || limitQuery || q);
    const baseWhere: Prisma.MaterialWhereInput = q
      ? {
          OR: [
            { title: { contains: q } },
            { description: { contains: q } },
            { category: { contains: q } },
            { resolution: { contains: q } },
            { tags: { contains: q } },
            { user: { name: { contains: q } } },
            { user: { email: { contains: q } } },
          ],
        }
      : {};
    const where: Prisma.MaterialWhereInput = normalizedStatus
      ? { ...baseWhere, status: normalizedStatus }
      : baseWhere;
    const materials = await prisma.material.findMany({
      where,
      include: {
        user: { select: { name: true, email: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
      ...(usePaginatedResponse ? { skip: (page - 1) * limit, take: limit } : {}),
    });

    if (!usePaginatedResponse) {
      res.json(materials);
      return;
    }

    const [total, statusSummary] = await Promise.all([
      prisma.material.count({ where }),
      prisma.material.groupBy({ by: ['status'], where: baseWhere, _count: { _all: true } }),
    ]);
    const statusCounts = Object.fromEntries(
      statusSummary.map((item) => [item.status, item._count._all]),
    );

    res.json({
      items: materials,
      total,
      page,
      pageSize: limit,
      pages: Math.max(1, Math.ceil(total / limit)),
      stats: {
        total: statusSummary.reduce((sum, item) => sum + item._count._all, 0),
        pending: statusCounts.PENDING || 0,
        approved: statusCounts.APPROVED || 0,
        rejected: statusCounts.REJECTED || 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateMaterialStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  const { status, rejectReason } = req.body;

  if (!['APPROVED', 'REJECTED'].includes(status)) {
    return next(new AppError('Invalid status', 400));
  }

  try {
    const oldMaterial = await prisma.material.findUnique({ where: { id } });
    if (!oldMaterial) return next(new AppError('Material not found', 404));

    const updateData: Partial<Prisma.MaterialUpdateInput> = { status };
    if (status === 'REJECTED' && rejectReason) {
      updateData.rejectReason = rejectReason;
    }
    if (status === 'APPROVED') {
      updateData.rejectReason = null;
    }

    const material = await prisma.material.update({
      where: { id },
      data: updateData,
    });

    await auditService.log({
      userId: req.userId as string,
      action: status === 'APPROVED' ? AuditAction.APPROVE_MATERIAL : AuditAction.REJECT_MATERIAL,
      module: AuditModule.MATERIAL,
      description: `管理员${status === 'APPROVED' ? '批准' : '拒绝'}了材料: ${material.title}`,
      oldValue: { status: oldMaterial.status },
      newValue: { status, rejectReason },
      req,
    });

    await createNotification({
      type: 'SYSTEM',
      title: status === 'APPROVED' ? '材料审核通过' : '材料审核未通过',
      content:
        status === 'REJECTED' && rejectReason
          ? `你上传的材料 "${material.title}" 未通过审核，原因：${rejectReason}`
          : `你上传的材料 "${material.title}" 已被管理员${status === 'APPROVED' ? '批准' : '拒绝'}。`,
      userId: material.userId,
      link: '/materials',
      category: 'SYSTEM',
    });

    res.json(material);
  } catch (error) {
    next(error);
  }
};

export const batchUpdateMaterialStatus = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const { ids, status, rejectReason } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return next(new AppError('请选择至少一个材料', 400));
  }

  if (!['APPROVED', 'REJECTED'].includes(status)) {
    return next(new AppError('Invalid status', 400));
  }

  try {
    const updateData: Partial<Prisma.MaterialUpdateInput> = { status };
    if (status === 'REJECTED' && rejectReason) {
      updateData.rejectReason = rejectReason;
    }
    if (status === 'APPROVED') {
      updateData.rejectReason = null;
    }

    const result = await prisma.material.updateMany({
      where: { id: { in: ids } },
      data: updateData,
    });

    const materials = await prisma.material.findMany({
      where: { id: { in: ids } },
      select: { id: true, title: true, userId: true },
    });

    await createNotificationBatch(
      materials.map((material) => ({
        type: 'SYSTEM',
        title: status === 'APPROVED' ? '材料审核通过' : '材料审核未通过',
        content:
          status === 'REJECTED' && rejectReason
            ? `你上传的材料 "${material.title}" 未通过审核，原因：${rejectReason}`
            : `你上传的材料 "${material.title}" 已被管理员${status === 'APPROVED' ? '批准' : '拒绝'}。`,
        userId: material.userId,
        link: '/materials',
        category: 'SYSTEM',
      })),
    );

    await auditService.log({
      userId: req.userId as string,
      action: status === 'APPROVED' ? AuditAction.APPROVE_MATERIAL : AuditAction.REJECT_MATERIAL,
      module: AuditModule.MATERIAL,
      description: `管理员批量${status === 'APPROVED' ? '批准' : '拒绝'}了 ${result.count} 个材料`,
      newValue: { ids, status, rejectReason },
      req,
    });

    res.json({ message: `成功更新 ${result.count} 个材料状态`, count: result.count });
  } catch (error) {
    next(error);
  }
};

export const adminUpdateMaterial = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  const { title, description, category, tags, status } = req.body;
  try {
    const oldMaterial = await prisma.material.findUnique({ where: { id } });
    if (!oldMaterial) return next(new AppError('Material not found', 404));

    const material = await prisma.material.update({
      where: { id },
      data: { title, description, category, tags, status },
    });

    await auditService.log({
      userId: req.userId as string,
      action: AuditAction.UPDATE_MATERIAL,
      module: AuditModule.MATERIAL,
      description: `管理员更新了材料: ${material.title}`,
      oldValue: oldMaterial,
      newValue: material,
      req,
    });

    res.json(material);
  } catch (error) {
    next(error);
  }
};

export const adminDeleteMaterial = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  try {
    const material = await prisma.material.findUnique({ where: { id } });
    if (!material) return next(new AppError('Material not found', 404));

    // Delete files from disk or cloud in background
    deleteCloudOrLocalFileByUrl(material.fileUrl).catch((err) => {
      logger.error(
        `[AdminContentController] Failed to delete material file ${material.fileUrl} in background:`,
        err,
      );
    });
    if (material.previewUrl) {
      deleteCloudOrLocalFileByUrl(material.previewUrl).catch((err) => {
        logger.error(
          `[AdminContentController] Failed to delete material preview ${material.previewUrl} in background:`,
          err,
        );
      });
    }

    await prisma.material.delete({ where: { id } });

    await auditService.log({
      userId: req.userId as string,
      action: AuditAction.DELETE_MATERIAL,
      module: AuditModule.MATERIAL,
      description: `管理员删除了材料: ${material.title}`,
      oldValue: material,
      req,
    });

    res.json({ message: 'Material deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// --- Showcase Audit ---

export const getAllShowcasesForAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const { status, search, page: pageQuery, limit: limitQuery, response } = req.query;
  try {
    const q = typeof search === 'string' ? search.trim() : '';
    const normalizedStatus = typeof status === 'string' && status !== 'ALL' ? status : undefined;
    const page = clampPage(pageQuery);
    const limit = clampLimit(limitQuery, 36, 100);
    const usePaginatedResponse = response === 'paginated' || Boolean(pageQuery || limitQuery || q);
    const baseWhere: Prisma.ShowcaseWhereInput = q
      ? {
          OR: [
            { title: { contains: q } },
            { description: { contains: q } },
            { type: { contains: q } },
            { tags: { contains: q } },
            { user: { name: { contains: q } } },
            { user: { email: { contains: q } } },
          ],
        }
      : {};
    const where: Prisma.ShowcaseWhereInput = normalizedStatus
      ? { ...baseWhere, status: normalizedStatus }
      : baseWhere;
    const showcases = await prisma.showcase.findMany({
      where,
      include: {
        user: { select: { name: true, email: true, avatarUrl: true } },
        _count: { select: { likes: true, comments: true } },
      },
      orderBy: { createdAt: 'desc' },
      ...(usePaginatedResponse ? { skip: (page - 1) * limit, take: limit } : {}),
    });

    const normalizedShowcases = showcases.map(({ _count, ...showcase }) => ({
      ...showcase,
      likes: _count.likes,
      comments: _count.comments,
    }));

    if (!usePaginatedResponse) {
      res.json(normalizedShowcases);
      return;
    }

    const [total, statusSummary] = await Promise.all([
      prisma.showcase.count({ where }),
      prisma.showcase.groupBy({ by: ['status'], where: baseWhere, _count: { _all: true } }),
    ]);
    const statusCounts = Object.fromEntries(
      statusSummary.map((item) => [item.status, item._count._all]),
    );

    res.json({
      items: normalizedShowcases,
      total,
      page,
      pageSize: limit,
      pages: Math.max(1, Math.ceil(total / limit)),
      stats: {
        total: statusSummary.reduce((sum, item) => sum + item._count._all, 0),
        pending: statusCounts.PENDING || 0,
        approved: statusCounts.APPROVED || 0,
        rejected: statusCounts.REJECTED || 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateShowcaseStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  const { status, rejectReason } = req.body;

  if (!['APPROVED', 'REJECTED'].includes(status)) {
    return next(new AppError('Invalid status', 400));
  }

  try {
    const oldShowcase = await prisma.showcase.findUnique({ where: { id } });
    if (!oldShowcase) return next(new AppError('Showcase not found', 404));

    const showcase = await prisma.showcase.update({
      where: { id },
      data: { status },
    });

    await auditService.log({
      userId: req.userId as string,
      action: status === 'APPROVED' ? AuditAction.APPROVE_SHOWCASE : AuditAction.REJECT_SHOWCASE,
      module: AuditModule.SHOWCASE,
      description: `管理员${status === 'APPROVED' ? '批准' : '拒绝'}了作品: ${showcase.title}`,
      oldValue: { status: oldShowcase.status },
      newValue: { status, rejectReason },
      req,
    });

    await createNotification({
      type: 'SYSTEM',
      title: status === 'APPROVED' ? '作品审核通过' : '作品审核未通过',
      content:
        status === 'REJECTED' && rejectReason
          ? `你发布的作品 "${showcase.title}" 未通过审核，原因：${rejectReason}`
          : `你发布的作品 "${showcase.title}" 已被管理员${status === 'APPROVED' ? '批准' : '拒绝'}。`,
      userId: showcase.userId,
      link: '/showcase',
      category: 'SYSTEM',
    });

    res.json(showcase);
  } catch (error) {
    next(error);
  }
};

export const batchUpdateShowcaseStatus = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const { ids, status, rejectReason } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return next(new AppError('请选择至少一个作品', 400));
  }

  if (!['APPROVED', 'REJECTED'].includes(status)) {
    return next(new AppError('Invalid status', 400));
  }

  try {
    const result = await prisma.showcase.updateMany({
      where: { id: { in: ids } },
      data: { status },
    });

    const showcases = await prisma.showcase.findMany({
      where: { id: { in: ids } },
      select: { id: true, title: true, userId: true },
    });

    await createNotificationBatch(
      showcases.map((showcase) => ({
        type: 'SYSTEM',
        title: status === 'APPROVED' ? '作品审核通过' : '作品审核未通过',
        content:
          status === 'REJECTED' && rejectReason
            ? `你发布的作品 "${showcase.title}" 未通过审核，原因：${rejectReason}`
            : `你发布的作品 "${showcase.title}" 已被管理员${status === 'APPROVED' ? '批准' : '拒绝'}。`,
        userId: showcase.userId,
        link: '/showcase',
        category: 'SYSTEM',
      })),
    );

    await auditService.log({
      userId: req.userId as string,
      action: status === 'APPROVED' ? AuditAction.APPROVE_SHOWCASE : AuditAction.REJECT_SHOWCASE,
      module: AuditModule.SHOWCASE,
      description: `管理员批量${status === 'APPROVED' ? '批准' : '拒绝'}了 ${result.count} 个作品`,
      newValue: { ids, status, rejectReason },
      req,
    });

    res.json({ message: `成功更新 ${result.count} 个作品状态`, count: result.count });
  } catch (error) {
    next(error);
  }
};

export const adminUpdateShowcase = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  const { title, description, tags, type, status } = req.body;

  try {
    const oldShowcase = await prisma.showcase.findUnique({ where: { id } });
    if (!oldShowcase) return next(new AppError('Showcase not found', 404));

    const updateData: Prisma.ShowcaseUpdateInput = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (tags !== undefined) updateData.tags = tags;
    if (type !== undefined) updateData.type = type;
    if (status !== undefined) updateData.status = status;

    const showcase = await prisma.showcase.update({
      where: { id },
      data: updateData,
    });

    await auditService.log({
      userId: req.userId as string,
      action: AuditAction.UPDATE_SHOWCASE,
      module: AuditModule.SHOWCASE,
      description: `Admin updated showcase: ${showcase.title}`,
      oldValue: oldShowcase,
      newValue: showcase,
      req,
    });

    res.json(showcase);
  } catch (error) {
    next(error);
  }
};

export const adminDeleteShowcase = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  try {
    const showcase = await prisma.showcase.findUnique({ where: { id } });
    if (!showcase) {
      return next(new AppError('Showcase not found', 404));
    }

    // Delete files in background
    if (showcase.thumbnailUrl) {
      deleteCloudOrLocalFileByUrl(showcase.thumbnailUrl).catch((err) => {
        logger.error(
          '[AdminContentController] Failed to delete showcase thumbnail in background:',
          err,
        );
      });
    }
    if (showcase.images) {
      try {
        const parsed = JSON.parse(showcase.images);
        const images = Array.isArray(parsed) ? parsed : [showcase.images];
        for (const url of images) {
          if (url) {
            deleteCloudOrLocalFileByUrl(url).catch((err) => {
              logger.error(
                `[AdminContentController] Failed to delete showcase image ${url} in background:`,
                err,
              );
            });
          }
        }
      } catch {
        deleteCloudOrLocalFileByUrl(showcase.images).catch((err) => {
          logger.error(
            `[AdminContentController] Failed to delete showcase image ${showcase.images} in background:`,
            err,
          );
        });
      }
    }

    await prisma.showcase.delete({ where: { id } });

    await auditService.log({
      userId: req.userId as string,
      action: AuditAction.DELETE_SHOWCASE,
      module: AuditModule.SHOWCASE,
      description: `管理员删除了作品: ${showcase.title}`,
      oldValue: showcase,
      req,
    });

    res.json({ message: 'Showcase deleted successfully' });
  } catch (error) {
    logger.error('Admin delete showcase error:', error);
    next(error);
  }
};
