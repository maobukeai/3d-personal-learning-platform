import prisma from '../services/prisma';
import { emitToUser } from '../services/socket.service';
import { config } from '../config/env';
import { sendEmail } from './email';
import { logger } from './logger';
import { settingsService } from '../services/settings.service';

type NotificationCategory =
  | 'SYSTEM'
  | 'TEAM_ACTIVITY'
  | 'MARKETING'
  | 'MENTION'
  | 'DIRECT_MESSAGE'
  | 'TASK_UPDATE';

const categoryToPrefKey: Record<NotificationCategory, string> = {
  SYSTEM: 'pushSystemUpdates',
  TEAM_ACTIVITY: 'pushTeamActivity',
  MARKETING: 'pushMarketing',
  MENTION: 'pushMentions',
  DIRECT_MESSAGE: 'pushDirectMessages',
  TASK_UPDATE: 'pushTeamActivity',
};

const categoryToEmailPrefKey: Partial<Record<NotificationCategory, string>> = {
  SYSTEM: 'emailSystemUpdates',
  TEAM_ACTIVITY: 'emailTeamActivity',
  MARKETING: 'emailMarketing',
  DIRECT_MESSAGE: 'emailDirectMessages',
  MENTION: 'emailMentions',
  TASK_UPDATE: 'emailTeamActivity',
};

async function getUserPreference(userId: string, category: NotificationCategory): Promise<boolean> {
  const prefKey = categoryToPrefKey[category];
  const prefs = await prisma.notificationPreference.findUnique({
    where: { userId },
  });
  if (!prefs) return prefKey !== 'pushMarketing';
  return (prefs as any)[prefKey] ?? prefKey !== 'pushMarketing';
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

  const settings = await settingsService.getAll();
  const templateSubject = settings.EMAIL_NOTIFY_SUBJECT || '{{subject}}';
  const templateBody = settings.EMAIL_NOTIFY_BODY || '';

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

  const subject = templateSubject
    .replace(/\{\{subject\}\}/g, params.subject)
    .replace(/\{\{title\}\}/g, params.title)
    .replace(/\{\{content\}\}/g, params.content);

  const previewHtml = preview
    ? `<div style="margin: 0 0 18px; padding: 12px 14px; border-left: 3px solid #4f46e5; background: #f8fafc; color: #4b5563; font-size: 13px;">${escapeHtml(
        preview,
      )}</div>`
    : '';

  const html = templateBody
    .replace(/\{\{title\}\}/g, escapeHtml(params.title))
    .replace(/\{\{content\}\}/g, escapeHtml(params.content))
    .replace(/\{\{preview\}\}/g, previewHtml)
    .replace(/\{\{link\}\}/g, escapeHtml(actionUrl));

  try {
    await sendEmail(user.email, subject, text, html);
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

  if (category !== 'DIRECT_MESSAGE') {
    void (async () => {
      try {
        await sendNotificationEmail({
          userId: params.userId,
          category,
          subject: params.title,
          title: params.title,
          content: params.content,
          link: params.link || undefined,
        });
      } catch (error) {
        logger.error(`[Notification Email] Failed to send background email for category ${category}:`, error);
      }
    })();
  }

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

    if (item.category !== 'DIRECT_MESSAGE') {
      void (async () => {
        try {
          await sendNotificationEmail({
            userId: item.userId,
            category: item.category,
            subject: item.title,
            title: item.title,
            content: item.content,
            link: item.link || undefined,
          });
        } catch (error) {
          logger.error(`[Notification Email Batch] Failed to send background email for category ${item.category}:`, error);
        }
      })();
    }
  }

  return filtered;
}
