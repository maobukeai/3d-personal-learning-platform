import { Response, NextFunction } from 'express';
import prisma from '../../services/prisma';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { emitToAll } from '../../services/socket.service';
import { createNotificationBatch } from '../../utils/notification';
import { AppError } from '../../middlewares/error.middleware';

export const getAdminStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [
      userCount,
      assetCount,
      courseCount,
      enrollmentCount,
      feedbackCount,
      discussionCount,
      pendingAssets,
      openFeedbacks,
      materialCount,
      showcaseCount,
      teamCount,
      pendingMaterials,
      pendingShowcases,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.asset.count(),
      prisma.course.count(),
      prisma.enrollment.count(),
      prisma.feedback.count(),
      prisma.discussion.count(),
      prisma.asset.count({ where: { status: 'PENDING' } }),
      prisma.feedback.count({ where: { status: 'OPEN' } }),
      prisma.material.count(),
      prisma.showcase.count(),
      prisma.team.count({ where: { type: 'TEAM' } }),
      prisma.material.count({ where: { status: 'PENDING' } }),
      prisma.showcase.count({ where: { status: 'PENDING' } }),
    ]);

    // Get recent activity (last 5 users, last 5 assets)
    const recentUsers = await prisma.user.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, name: true, createdAt: true, avatarUrl: true },
    });

    const recentAssets = await prisma.asset.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { name: true } } },
    });

    res.json({
      counts: {
        users: userCount,
        assets: assetCount,
        courses: courseCount,
        enrollments: enrollmentCount,
        feedbacks: feedbackCount,
        discussions: discussionCount,
        pendingAssets,
        openFeedbacks,
        materials: materialCount,
        showcases: showcaseCount,
        teams: teamCount,
        pendingMaterials,
        pendingShowcases,
      },
      recentUsers,
      recentAssets,
    });
  } catch (error) {
    next(error);
  }
};

export const getAuditLogs = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { page = 1, limit = 50, module, action } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};
    if (module) where.module = module as string;
    if (action) where.action = action as string;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: Number(limit),
        include: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({
      logs,
      total,
      pages: Math.ceil(total / Number(limit)),
      currentPage: Number(page),
    });
  } catch (error) {
    next(error);
  }
};

export const getBroadcasts = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const broadcasts = await prisma.broadcast.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json(broadcasts);
  } catch (error) {
    next(error);
  }
};

export const deleteBroadcast = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { id } = req.params;
  try {
    await prisma.broadcast.delete({
      where: { id: id as any },
    });
    res.json({ message: '广播已成功撤回' });
  } catch (error) {
    next(error);
  }
};

export const sendBroadcast = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { title, content, link } = req.body;

  if (!title || !content) {
    return next(new AppError('标题和内容不能为空', 400));
  }

  try {
    const broadcast = await prisma.broadcast.create({
      data: { title, content, link },
    });

    const users = await prisma.user.findMany({
      select: { id: true },
    });

    await createNotificationBatch(
      users.map((user) => ({
        type: 'SYSTEM',
        title,
        content,
        link,
        userId: user.id,
        broadcastId: broadcast.id,
        category: 'SYSTEM',
      })),
    );

    emitToAll('new_notification', {
      type: 'SYSTEM',
      title,
      content,
      link,
      createdAt: new Date(),
      broadcastId: broadcast.id,
    });

    res.json({ message: `广播发送成功，共发送给 ${users.length} 名用户` });
  } catch (error) {
    next(error);
  }
};
