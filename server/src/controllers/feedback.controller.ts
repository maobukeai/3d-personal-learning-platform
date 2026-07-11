import type { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../services/prisma';
import { AppError } from '../utils/error';
import { createNotificationBatch } from '../utils/notification';
import { getUploadedFileUrl } from '../utils/file';
import type { UploadedFile } from '../types/upload';

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

const buildMyFeedbackWhere = (request: FastifyRequest) => {
  const query = request.query as Record<string, string | undefined>;
  const q = typeof query.q === 'string' ? query.q.trim() : '';
  const status =
    typeof query.status === 'string' && query.status !== 'ALL' ? query.status : undefined;
  const priority =
    typeof query.priority === 'string' && query.priority !== 'ALL' ? query.priority : undefined;
  const type = typeof query.type === 'string' && query.type !== 'ALL' ? query.type : undefined;

  return {
    userId: request.userId as string,
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

export const uploadAttachment = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const file = (request as unknown as { file?: UploadedFile }).file;
  if (!file) {
    throw new AppError('No file uploaded', 400);
  }
  const attachmentUrl = getUploadedFileUrl(request, file, 'feedback');
  reply.send({ url: attachmentUrl });
};

export const submitFeedback = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const { type, title, description, priority, attachmentUrl } = request.body as {
    type: unknown;
    title: unknown;
    description: unknown;
    priority: unknown;
    attachmentUrl: unknown;
  };
  const normalizedTitle = typeof title === 'string' ? title.trim() : '';
  const normalizedDescription = typeof description === 'string' ? description.trim() : '';
  const normalizedPriority = isFeedbackPriority(priority) ? priority : 'MEDIUM';

  if (!isFeedbackType(type)) {
    throw new AppError('Invalid feedback type', 400);
  }

  if (!normalizedTitle || !normalizedDescription) {
    throw new AppError('Type, title, and description are required', 400);
  }

  if (normalizedTitle.length < 3 || normalizedTitle.length > 120) {
    throw new AppError('Title must be between 3 and 120 characters', 400);
  }

  if (normalizedDescription.length < 10 || normalizedDescription.length > 5000) {
    throw new AppError('Description must be between 10 and 5000 characters', 400);
  }

  const feedback = await prisma.$transaction(async (tx) => {
    const fb = await tx.feedback.create({
      data: {
        type,
        title: normalizedTitle,
        description: normalizedDescription,
        priority: normalizedPriority,
        attachmentUrl:
          typeof attachmentUrl === 'string' && attachmentUrl.trim() ? attachmentUrl.trim() : null,
        userId: request.userId!,
      },
    });

    const admins = await tx.user.findMany({
      where: { role: 'ADMIN', status: 'ACTIVE' },
      select: { id: true },
    });

    if (admins.length > 0) {
      const preferences = await tx.notificationPreference.findMany({
        where: { userId: { in: admins.map((a) => a.id) } },
      });
      const prefsMap = new Map(preferences.map((p) => [p.userId, p]));

      const filteredAdmins = admins.filter((admin) => {
        const prefs = prefsMap.get(admin.id);
        if (!prefs) return true;
        return prefs.pushSystemUpdates ?? true;
      });

      if (filteredAdmins.length > 0) {
        const notificationData = filteredAdmins.map((admin) => ({
          id: require('crypto').randomUUID(),
          type: 'SYSTEM',
          title: '新的用户反馈',
          content: `${request.user?.name || request.user?.email || '用户'} 提交了 ${fb.priority} 优先级反馈：${fb.title}`,
          userId: admin.id,
          link: '/admin/feedback',
          isRead: false,
          createdAt: new Date(),
        }));

        await tx.notification.createMany({
          data: notificationData,
        });
      }
    }

    return fb;
  });

  reply.status(201).send(feedback);
};

export const getMyFeedback = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const query = request.query as Record<string, string | undefined>;
  const limit = Math.min(Number(query.limit) || 80, 200);
  const feedbacks = await prisma.feedback.findMany({
    where: buildMyFeedbackWhere(request),
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  reply.send(feedbacks);
};

export const getMyFeedbackStats = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const userId = request.userId as string;
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

  reply.send({
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
};

export const getMyFeedbackDetail = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const { id: feedbackId } = request.params as { id: string };
  const feedback = await prisma.feedback.findFirst({
    where: { id: feedbackId, userId: request.userId as string },
  });

  if (!feedback) {
    throw new AppError('Feedback not found', 404);
  }

  reply.send(feedback);
};

export const updateMyFeedbackStatus = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const { id: feedbackId } = request.params as { id: string };
  const { status: requestedStatus } = request.body as { status: unknown };
  if (requestedStatus !== 'OPEN' && requestedStatus !== 'CLOSED') {
    throw new AppError('Users can only reopen or close feedback', 400);
  }

  const current = await prisma.feedback.findFirst({
    where: { id: feedbackId, userId: request.userId as string },
    select: { id: true, title: true, status: true },
  });

  if (!current) {
    throw new AppError('Feedback not found', 404);
  }

  const nextStatus = requestedStatus as 'OPEN' | 'CLOSED';
  const updated = await prisma.feedback.update({
    where: { id: current.id },
    data: { status: nextStatus },
  });

  await notifyAdmins({
    title: nextStatus === 'CLOSED' ? '用户关闭了反馈' : '用户重新打开了反馈',
    content: `${request.user?.name || request.user?.email || '用户'} 将反馈 "${updated.title}" 标记为 ${nextStatus}`,
    link: '/admin/feedback',
  });

  reply.send(updated);
};
