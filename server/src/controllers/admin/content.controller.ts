import { Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import prisma from '../../services/prisma';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { emitToUser } from '../../services/socket.service';
import { createNotification, createNotificationBatch } from '../../utils/notification';
import { auditService, AuditModule, AuditAction } from '../../services/audit.service';
import { AppError } from '../../middlewares/error.middleware';

// --- Feedback Audit ---

export const getAllFeedback = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const feedbacks = await prisma.feedback.findMany({
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

  const validStatuses = ['PENDING', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
  if (status && !validStatuses.includes(status)) {
    return next(new AppError('Invalid status value', 400));
  }

  try {
    const updateData: any = {};
    if (status) updateData.status = status;
    if (adminReply !== undefined) {
      updateData.adminReply = adminReply;
      updateData.repliedAt = new Date();
      updateData.adminId = req.userId;
    }

    const updatedFeedback = await prisma.feedback.update({
      where: { id: id as any },
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
      const notification = await createNotification({
        type: 'SYSTEM',
        title: notificationTitle,
        content: notificationContent,
        userId: updatedFeedback.userId,
        link: '/report-bug?tab=history',
        category: 'SYSTEM',
      });

      // Real-time push via socket
      emitToUser(updatedFeedback.userId, 'new_notification', notification);
    }

    res.json(updatedFeedback);
  } catch (error) {
    next(error);
  }
};

export const deleteFeedback = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  try {
    // Check if feedback exists
    const feedback = await prisma.feedback.findUnique({ where: { id: id as any } });
    if (!feedback) {
      return next(new AppError('反馈不存在', 404));
    }

    await prisma.feedback.delete({ where: { id: id as any } });
    res.json({ message: 'Feedback deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// --- Material Audit ---

export const getAllMaterialsForAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { status } = req.query;
  try {
    const materials = await prisma.material.findMany({
      where: status ? { status: status as string } : {},
      include: {
        user: { select: { name: true, email: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(materials);
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
    const oldMaterial = await prisma.material.findUnique({ where: { id: id as any } });
    if (!oldMaterial) return next(new AppError('Material not found', 404));

    const updateData: any = { status };
    if (status === 'REJECTED' && rejectReason) {
      updateData.rejectReason = rejectReason;
    }
    if (status === 'APPROVED') {
      updateData.rejectReason = null;
    }

    const material = await prisma.material.update({
      where: { id: id as any },
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
    const updateData: any = { status };
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
    const oldMaterial = await prisma.material.findUnique({ where: { id: id as any } });
    if (!oldMaterial) return next(new AppError('Material not found', 404));

    const material = await prisma.material.update({
      where: { id: id as any },
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
    const material = await prisma.material.findUnique({ where: { id: id as any } });
    if (!material) return next(new AppError('Material not found', 404));

    // Delete files
    const deleteFile = (url: string) => {
      const fileName = url.split('/').pop();
      if (fileName) {
        const filePath = path.join(__dirname, '../../../uploads/materials', fileName);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
    };

    deleteFile(material.fileUrl);
    if (material.previewUrl) deleteFile(material.previewUrl);

    await prisma.material.delete({ where: { id: id as any } });

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

export const getAllShowcasesForAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { status } = req.query;
  try {
    const showcases = await prisma.showcase.findMany({
      where: status ? { status: status as string } : {},
      include: {
        user: { select: { name: true, email: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(showcases);
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
    const oldShowcase = await prisma.showcase.findUnique({ where: { id: id as any } });
    if (!oldShowcase) return next(new AppError('Showcase not found', 404));

    const showcase = await prisma.showcase.update({
      where: { id: id as any },
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

export const adminDeleteShowcase = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  try {
    const showcase = await prisma.showcase.findUnique({ where: { id: id as any } });
    if (!showcase) {
      return next(new AppError('Showcase not found', 404));
    }

    await prisma.showcase.delete({ where: { id: id as any } });

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
    console.error('Admin delete showcase error:', error);
    next(error);
  }
};
