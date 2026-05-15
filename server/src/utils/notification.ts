import prisma from '../services/prisma';
import { emitToUser } from '../services/socket.service';

type NotificationCategory =
  | 'SYSTEM'
  | 'TEAM_ACTIVITY'
  | 'MARKETING'
  | 'MENTION'
  | 'DIRECT_MESSAGE'
  | 'TASK_UPDATE';

const categoryToPrefKey: Record<NotificationCategory, string> = {
  SYSTEM: 'emailSystemUpdates',
  TEAM_ACTIVITY: 'emailTeamActivity',
  MARKETING: 'emailMarketing',
  MENTION: 'pushMentions',
  DIRECT_MESSAGE: 'pushDirectMessages',
  TASK_UPDATE: 'emailTeamActivity', // Map to team activity for now if no specific preference exists
};

async function getUserPreference(userId: string, category: NotificationCategory): Promise<boolean> {
  const prefs = await prisma.notificationPreference.findUnique({
    where: { userId },
  });
  if (!prefs) return true;
  return (prefs as any)[categoryToPrefKey[category]] ?? true;
}

export async function createNotification(params: {
  type: string;
  title: string;
  content: string;
  userId: string;
  link?: string;
  broadcastId?: string;
  category: NotificationCategory;
}) {
  const { category, ...notificationData } = params;

  const enabled = await getUserPreference(params.userId, category);
  if (!enabled) return null;

  const notification = await prisma.notification.create({
    data: notificationData,
  });
  emitToUser(params.userId, 'new_notification', notification);
  return notification;
}

export async function createNotificationBatch(
  paramsList: Array<{
    type: string;
    title: string;
    content: string;
    userId: string;
    link?: string;
    broadcastId?: string;
    category: NotificationCategory;
  }>,
) {
  const filtered: Array<(typeof paramsList)[0] & { enabled: boolean }> = [];

  for (const params of paramsList) {
    const enabled = await getUserPreference(params.userId, params.category);
    if (enabled) {
      filtered.push({ ...params, enabled: true });
    }
  }

  if (filtered.length === 0) return [];

  const data = filtered.map(({ category, enabled, ...rest }) => rest);
  await prisma.notification.createMany({ data });

  for (const item of filtered) {
    const { category, enabled, ...notificationData } = item;
    emitToUser(notificationData.userId, 'new_notification', notificationData);
  }

  return filtered;
}
