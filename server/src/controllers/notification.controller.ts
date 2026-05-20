import { Response } from 'express';
import prisma from '../services/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
export const getMyNotifications = async (req: AuthRequest, res: Response) => {
  const { type, cursor } = req.query;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
  try {
    const where: any = { userId: req.userId as string };

    if (type && type !== 'all') {
      if (type === 'TEAM') {
        where.type = { in: ['TEAM', 'PROJECT_INVITE', 'TEAM_ACTIVITY'] };
      } else if (type === 'MESSAGE') {
        where.type = { in: ['MESSAGE', 'REPLY', 'MENTION'] };
      } else {
        where.type = type as string;
      }
    }

    const queryOptions: any = {
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    };

    if (cursor) {
      queryOptions.cursor = { id: cursor as string };
      queryOptions.skip = 1;
    }

    const notifications = await prisma.notification.findMany(queryOptions);

    const nextCursor = notifications.length === limit ? notifications[notifications.length - 1].id : null;

    res.json({
      notifications,
      nextCursor,
    });
  } catch (error) {
    console.error('[Notification] Get notifications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const markAsRead = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  try {
    await prisma.notification.update({
      where: { id, userId: req.userId as string },
      data: { isRead: true },
    });
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const markAllAsRead = async (req: AuthRequest, res: Response) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.userId as string, isRead: false },
      data: { isRead: true },
    });
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteNotification = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  try {
    await prisma.notification.delete({
      where: { id, userId: req.userId as string },
    });
    res.json({ message: 'Notification deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getNotificationPreferences = async (req: AuthRequest, res: Response) => {
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
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateNotificationPreferences = async (req: AuthRequest, res: Response) => {
  const {
    emailSystemUpdates,
    emailTeamActivity,
    emailMarketing,
    pushMentions,
    pushDirectMessages,
  } = req.body;
  try {
    const prefs = await prisma.notificationPreference.upsert({
      where: { userId: req.userId as string },
      update: {
        ...(emailSystemUpdates !== undefined && { emailSystemUpdates }),
        ...(emailTeamActivity !== undefined && { emailTeamActivity }),
        ...(emailMarketing !== undefined && { emailMarketing }),
        ...(pushMentions !== undefined && { pushMentions }),
        ...(pushDirectMessages !== undefined && { pushDirectMessages }),
      },
      create: {
        userId: req.userId as string,
        emailSystemUpdates: emailSystemUpdates ?? true,
        emailTeamActivity: emailTeamActivity ?? true,
        emailMarketing: emailMarketing ?? false,
        pushMentions: pushMentions ?? true,
        pushDirectMessages: pushDirectMessages ?? true,
      },
    });
    res.json(prefs);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};
