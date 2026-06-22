import { logger } from '../utils/logger';
import { Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../services/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { clampLimit } from '../utils/pagination';
export const getMyNotifications = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { type, cursor } = req.query;
  const limit = clampLimit(req.query.limit, 20, 50);
  try {
    const where: Prisma.NotificationWhereInput = { userId: req.userId as string };

    if (type && type !== 'all') {
      if (type === 'TEAM') {
        where.type = { in: ['TEAM', 'PROJECT_INVITE', 'TEAM_ACTIVITY'] };
      } else if (type === 'MESSAGE') {
        where.type = { in: ['MESSAGE', 'REPLY', 'MENTION'] };
      } else {
        where.type = type as string;
      }
    }

    const queryOptions: Prisma.NotificationFindManyArgs = {
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    };

    if (cursor) {
      queryOptions.cursor = { id: cursor as string };
      queryOptions.skip = 1;
    }

    const notifications = await prisma.notification.findMany(queryOptions);

    const nextCursor =
      notifications.length === limit ? notifications[notifications.length - 1]?.id : null;

    res.json({
      notifications,
      nextCursor,
    });
  } catch (error) {
    logger.error('[Notification] Get notifications error:', error);
    next(error);
  }
};

export const markAsRead = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  try {
    await prisma.notification.update({
      where: { id, userId: req.userId as string },
      data: { isRead: true },
    });
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    next(error);
  }
};

export const markAllAsRead = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.userId as string, isRead: false },
      data: { isRead: true },
    });
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    next(error);
  }
};

export const deleteNotification = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = req.params.id as string;
  try {
    await prisma.notification.delete({
      where: { id, userId: req.userId as string },
    });
    res.json({ message: 'Notification deleted' });
  } catch (error) {
    next(error);
  }
};

export const getNotificationPreferences = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    let prefs = await prisma.notificationPreference.findUnique({
      where: { userId: req.userId as string },
    });
    if (!prefs) {
      prefs = await prisma.notificationPreference.create({
        data: { userId: req.userId as string },
      });
    }
    res.json(prefs);
  } catch (error) {
    next(error);
  }
};

export const updateNotificationPreferences = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const {
    pushSystemUpdates,
    pushTeamActivity,
    pushMentions,
    pushDirectMessages,
    pushMarketing,
    emailSystemUpdates,
    emailTeamActivity,
    emailDirectMessages,
    emailMentions,
    emailMarketing,
  } = req.body;
  try {
    const prefs = await prisma.notificationPreference.upsert({
      where: { userId: req.userId as string },
      update: {
        ...(pushSystemUpdates !== undefined && { pushSystemUpdates }),
        ...(pushTeamActivity !== undefined && { pushTeamActivity }),
        ...(pushMentions !== undefined && { pushMentions }),
        ...(pushDirectMessages !== undefined && { pushDirectMessages }),
        ...(pushMarketing !== undefined && { pushMarketing }),
        ...(emailSystemUpdates !== undefined && { emailSystemUpdates }),
        ...(emailTeamActivity !== undefined && { emailTeamActivity }),
        ...(emailDirectMessages !== undefined && { emailDirectMessages }),
        ...(emailMentions !== undefined && { emailMentions }),
        ...(emailMarketing !== undefined && { emailMarketing }),
      },
      create: {
        userId: req.userId as string,
        pushSystemUpdates: pushSystemUpdates ?? true,
        pushTeamActivity: pushTeamActivity ?? true,
        pushMentions: pushMentions ?? true,
        pushDirectMessages: pushDirectMessages ?? true,
        pushMarketing: pushMarketing ?? false,
        emailSystemUpdates: emailSystemUpdates ?? true,
        emailTeamActivity: emailTeamActivity ?? true,
        emailDirectMessages: emailDirectMessages ?? true,
        emailMentions: emailMentions ?? true,
        emailMarketing: emailMarketing ?? false,
      },
    });
    res.json(prefs);
  } catch (error) {
    next(error);
  }
};

export const deleteAllNotifications = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    await prisma.notification.deleteMany({
      where: { userId: req.userId as string },
    });
    res.json({ message: 'All notifications deleted' });
  } catch (error) {
    logger.error('[Notification] Delete all notifications error:', error);
    next(error);
  }
};

export const getLatestBroadcast = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const broadcast = await prisma.broadcast.findFirst({
      where: {
        NOT: {
          title: {
            startsWith: '[OFFLINE]',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    res.json(broadcast);
  } catch (error) {
    logger.error('[Notification] Get latest broadcast error:', error);
    next(error);
  }
};
