import { Response } from 'express';
import prisma from '../services/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';

export const getMyNotifications = async (req: AuthRequest, res: Response) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.userId as string },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    res.json(notifications);
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
