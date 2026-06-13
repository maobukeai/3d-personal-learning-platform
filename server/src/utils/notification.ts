import prisma from '../services/prisma';
import { emitToUser } from '../services/socket.service';
import { config } from '../config/env';
import { sendEmail } from './email';
import { logger } from './logger';

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

const categoryToEmailPrefKey: Partial<Record<NotificationCategory, string>> = {
  SYSTEM: 'emailSystemUpdates',
  TEAM_ACTIVITY: 'emailTeamActivity',
  MARKETING: 'emailMarketing',
  DIRECT_MESSAGE: 'emailDirectMessages',
  TASK_UPDATE: 'emailTeamActivity',
};

async function getUserPreference(userId: string, category: NotificationCategory): Promise<boolean> {
  const prefs = await prisma.notificationPreference.findUnique({
    where: { userId },
  });
  if (!prefs) return true;
  return (prefs as any)[categoryToPrefKey[category]] ?? true;
}

async function getUserEmailPreference(
  userId: string,
  category: NotificationCategory,
): Promise<boolean> {
  const prefKey = categoryToEmailPrefKey[category];
  if (!prefKey) return false;

  const prefs = await prisma.notificationPreference.findUnique({
    where: { userId },
  });
  if (!prefs) return prefKey !== 'emailMarketing';
  return (prefs as any)[prefKey] ?? prefKey !== 'emailMarketing';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildAbsoluteLink(link?: string): string {
  const baseUrl = config.FRONTEND_URL.replace(/\/+$/, '');
  if (!link) return baseUrl;
  if (/^https?:\/\//i.test(link)) return link;
  return `${baseUrl}${link.startsWith('/') ? link : `/${link}`}`;
}

function normalizePreview(value?: string): string {
  const normalized = (value || '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= 240) return normalized;
  return `${normalized.slice(0, 237)}...`;
}

export async function sendNotificationEmail(params: {
  userId: string;
  category: NotificationCategory;
  subject: string;
  title: string;
  content: string;
  link?: string;
  preview?: string;
  throwOnFailure?: boolean;
}) {
  const enabled = await getUserEmailPreference(params.userId, params.category);
  if (!enabled) return false;

  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { email: true, name: true },
  });

  if (!user?.email) return false;

  const actionUrl = buildAbsoluteLink(params.link);
  const preview = normalizePreview(params.preview);
  const text = [
    params.title,
    params.content,
    preview ? `消息内容：${preview}` : '',
    `查看详情：${actionUrl}`,
    '如果不想继续收到这类邮件，可以在个人设置的通知偏好中关闭。',
  ]
    .filter(Boolean)
    .join('\n\n');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #111827; padding: 24px;">
      <h2 style="margin: 0 0 12px; font-size: 20px;">${escapeHtml(params.title)}</h2>
      <p style="margin: 0 0 16px;">${escapeHtml(params.content)}</p>
      ${
        preview
          ? `<div style="margin: 0 0 18px; padding: 12px 14px; border-left: 3px solid #2563eb; background: #f8fafc;">${escapeHtml(
              preview,
            )}</div>`
          : ''
      }
      <a href="${escapeHtml(actionUrl)}" style="display: inline-block; padding: 10px 14px; border-radius: 8px; background: #2563eb; color: #ffffff; text-decoration: none; font-weight: 700;">查看消息</a>
      <p style="margin-top: 18px; color: #6b7280; font-size: 12px;">如果不想继续收到这类邮件，可以在个人设置的通知偏好中关闭。</p>
    </div>
  `;

  try {
    await sendEmail(user.email, params.subject, text, html);
    return true;
  } catch (error) {
    logger.error('[Notification Email] Failed to send notification email:', error);
    if (params.throwOnFailure) {
      throw error;
    }
    return false;
  }
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

  const data = filtered.map(({ category: _category, enabled: _enabled, ...rest }) => rest);
  await prisma.notification.createMany({ data });

  for (const item of filtered) {
    const { category: _category, enabled: _enabled, ...notificationData } = item;
    emitToUser(notificationData.userId, 'new_notification', notificationData);
  }

  return filtered;
}
