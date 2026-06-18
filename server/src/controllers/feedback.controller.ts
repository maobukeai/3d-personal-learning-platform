import { Response, NextFunction } from 'express';
import prisma from '../services/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { AppError } from '../utils/error';
import { createNotificationBatch } from '../utils/notification';

const FEEDBACK_TYPES = ['Bug', 'Feature', 'UI', 'Other'] as const;
const FEEDBACK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'] as const;
const FEEDBACK_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;

type FeedbackType = (typeof FEEDBACK_TYPES)[number];
type FeedbackPriority = (typeof FEEDBACK_PRIORITIES)[number];
type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

const isFeedbackType = (value: unknown): value is FeedbackType =>
  typeof value === 'string' && FEEDBACK_TYPES.includes(value as FeedbackType);

const isFeedbackPriority = (value: unknown): value is FeedbackPriority =>
  typeof value === 'string' && FEEDBACK_PRIORITIES.includes(value as FeedbackPriority);

const isFeedbackStatus = (value: unknown): value is FeedbackStatus =>
  typeof value === 'string' && FEEDBACK_STATUSES.includes(value as FeedbackStatus);

const notifyAdmins = async (params: { title: string; content: string; link?: string }) => {
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', status: 'ACTIVE' },
    select: { id: true },
  });

  if (!admins.length) return;

  await createNotificationBatch(
    admins.map((admin) => ({
      type: 'SYSTEM',
      title: params.title,
      content: params.content,
      userId: admin.id,
      link: params.link || '/admin/feedback',
      category: 'SYSTEM',
    })),
  );
};

const buildMyFeedbackWhere = (req: AuthRequest) => {
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

  return {
    userId: req.userId as string,
    ...(status && isFeedbackStatus(status) ? { status } : {}),
    ...(priority && isFeedbackPriority(priority) ? { priority } : {}),
    ...(type && isFeedbackType(type) ? { type } : {}),
    ...(q
      ? {
          OR: [{ title: { contains: q } }, { description: { contains: q } }],
        }
      : {}),
  };
};

export const uploadAttachment = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return next(new AppError('No file uploaded', 400));
    }
    const attachmentUrl = (req.file as any).url || `${req.protocol}://${req.get('host')}/uploads/feedback/${req.file.filename}`;
    res.json({ url: attachmentUrl });
  } catch (error) {
    next(error);
  }
};

export const submitFeedback = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { type, title, description, priority, attachmentUrl } = req.body;
    const normalizedTitle = typeof title === 'string' ? title.trim() : '';
    const normalizedDescription = typeof description === 'string' ? description.trim() : '';
    const normalizedPriority = isFeedbackPriority(priority) ? priority : 'MEDIUM';

    if (!isFeedbackType(type)) {
      return next(new AppError('Invalid feedback type', 400));
    }

    if (!normalizedTitle || !normalizedDescription) {
      return next(new AppError('Type, title, and description are required', 400));
    }

    if (normalizedTitle.length < 3 || normalizedTitle.length > 120) {
      return next(new AppError('Title must be between 3 and 120 characters', 400));
    }

    if (normalizedDescription.length < 10 || normalizedDescription.length > 5000) {
      return next(new AppError('Description must be between 10 and 5000 characters', 400));
    }

    const feedback = await prisma.feedback.create({
      data: {
        type,
        title: normalizedTitle,
        description: normalizedDescription,
        priority: normalizedPriority,
        attachmentUrl:
          typeof attachmentUrl === 'string' && attachmentUrl.trim() ? attachmentUrl.trim() : null,
        userId: req.userId!,
      },
    });

    await notifyAdmins({
      title: '新的用户反馈',
      content: `${req.user?.name || req.user?.email || '用户'} 提交了 ${feedback.priority} 优先级反馈：${feedback.title}`,
      link: '/admin/feedback',
    });

    res.status(201).json(feedback);
  } catch (error) {
    next(error);
  }
};

export const getMyFeedback = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 80, 200);
    const feedbacks = await prisma.feedback.findMany({
      where: buildMyFeedbackWhere(req),
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    res.json(feedbacks);
  } catch (error) {
    next(error);
  }
};

export const getMyFeedbackStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId as string;
    const [
      total,
      open,
      inProgress,
      resolved,
      closed,
      highOpen,
      withReply,
      latest,
      statusGroups,
      typeGroups,
      priorityGroups,
    ] = await Promise.all([
      prisma.feedback.count({ where: { userId } }),
      prisma.feedback.count({ where: { userId, status: 'OPEN' } }),
      prisma.feedback.count({ where: { userId, status: 'IN_PROGRESS' } }),
      prisma.feedback.count({ where: { userId, status: 'RESOLVED' } }),
      prisma.feedback.count({ where: { userId, status: 'CLOSED' } }),
      prisma.feedback.count({ where: { userId, priority: 'HIGH', status: { not: 'CLOSED' } } }),
      prisma.feedback.count({ where: { userId, adminReply: { not: null } } }),
      prisma.feedback.findFirst({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        select: { id: true, title: true, status: true, updatedAt: true, repliedAt: true },
      }),
      prisma.feedback.groupBy({
        by: ['status'],
        where: { userId },
        _count: { _all: true },
      }),
      prisma.feedback.groupBy({
        by: ['type'],
        where: { userId },
        _count: { _all: true },
      }),
      prisma.feedback.groupBy({
        by: ['priority'],
        where: { userId },
        _count: { _all: true },
      }),
    ]);

    res.json({
      total,
      open,
      inProgress,
      resolved,
      closed,
      highOpen,
      withReply,
      latest,
      byStatus: statusGroups.reduce<Record<string, number>>((acc, item) => {
        acc[item.status] = item._count._all;
        return acc;
      }, {}),
      byType: typeGroups.reduce<Record<string, number>>((acc, item) => {
        acc[item.type] = item._count._all;
        return acc;
      }, {}),
      byPriority: priorityGroups.reduce<Record<string, number>>((acc, item) => {
        acc[item.priority] = item._count._all;
        return acc;
      }, {}),
    });
  } catch (error) {
    next(error);
  }
};

export const getMyFeedbackDetail = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const feedbackId = req.params.id as string;
    const feedback = await prisma.feedback.findFirst({
      where: { id: feedbackId, userId: req.userId as string },
    });

    if (!feedback) {
      return next(new AppError('Feedback not found', 404));
    }

    res.json(feedback);
  } catch (error) {
    next(error);
  }
};

export const updateMyFeedbackStatus = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const feedbackId = req.params.id as string;
    const requestedStatus = req.body.status;
    if (requestedStatus !== 'OPEN' && requestedStatus !== 'CLOSED') {
      return next(new AppError('Users can only reopen or close feedback', 400));
    }

    const current = await prisma.feedback.findFirst({
      where: { id: feedbackId, userId: req.userId as string },
      select: { id: true, title: true, status: true },
    });

    if (!current) {
      return next(new AppError('Feedback not found', 404));
    }

    const nextStatus = requestedStatus as 'OPEN' | 'CLOSED';
    const updated = await prisma.feedback.update({
      where: { id: current.id },
      data: { status: nextStatus },
    });

    await notifyAdmins({
      title: nextStatus === 'CLOSED' ? '用户关闭了反馈' : '用户重新打开了反馈',
      content: `${req.user?.name || req.user?.email || '用户'} 将反馈 "${updated.title}" 标记为 ${nextStatus}`,
      link: '/admin/feedback',
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
};
