import prisma from '../services/prisma';
import { emitToUser } from '../services/socket.service';
import { NotificationPreference } from '@prisma/client';
import { config } from '../config/env';
import { sendEmail } from './email';
import { logger } from './logger';
import { settingsService } from '../services/settings.service';
import { randomUUID } from 'crypto';

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
  const prefKey = categoryToPrefKey[category] as keyof NotificationPreference;
  const prefs = await prisma.notificationPreference.findUnique({
    where: { userId },
  });
  if (!prefs) return prefKey !== 'pushMarketing';
  return (prefs[prefKey] as boolean | undefined) ?? prefKey !== 'pushMarketing';
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
  const key = prefKey as keyof NotificationPreference;
  return (prefs[key] as boolean | undefined) ?? prefKey !== 'emailMarketing';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderMarkdown(text: string): string {
  if (!text) return '';
  let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // 1. Block-level: Headings
  html = html
    .replace(
      /^#### (.+)$/gm,
      '<h5 style="margin: 10px 0 5px; font-size: 1.0em; font-weight: bold; color: #334155;">$1</h5>',
    )
    .replace(
      /^### (.+)$/gm,
      '<h4 style="margin: 12px 0 6px; font-size: 1.1em; font-weight: bold; color: #1e293b;">$1</h4>',
    )
    .replace(
      /^## (.+)$/gm,
      '<h3 style="margin: 14px 0 8px; font-size: 1.25em; font-weight: bold; color: #0f172a;">$1</h3>',
    )
    .replace(
      /^# (.+)$/gm,
      '<h2 style="margin: 16px 0 10px; font-size: 1.4em; font-weight: bold; color: #020617;">$1</h2>',
    );

  // 2. Block-level: Lists
  html = html
    .replace(
      /^\s*[-*]\s+\[\s*\]\s+(.+)$/gm,
      '<li style="margin: 4px 0; list-style-type: none;">☐ $1</li>',
    )
    .replace(
      /^\s*[-*]\s+\[x\]\s+(.+)$/gm,
      '<li style="margin: 4px 0; list-style-type: none;">☑ $1</li>',
    )
    .replace(/^\s*[-*]\s+(.+)$/gm, '<li style="margin: 4px 0;">$1</li>')
    .replace(/^\s*\d+\.\s+(.+)$/gm, '<li style="margin: 4px 0;">$1</li>');

  // 3. Inline-level: Bold, Italic, Code
  html = html
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(
      /`([^`]+)`/g,
      '<code style="background: #f1f5f9; padding: 2px 4px; border-radius: 4px; font-family: monospace; font-size: 0.9em; color: #e11d48;">$1</code>',
    );

  // 4. Line breaks and cleanups
  html = html
    .replace(/\n/g, '<br/>')
    .replace(/(<br\s*\/?>){2,}/g, '<br/>')
    .replace(/(<\/h[2-5]>)\s*<br\s*\/?>/gi, '$1')
    .replace(/<br\s*\/?>\s*(<h[2-5]>)/gi, '$1')
    .replace(/(<\/li>)\s*<br\s*\/?>/gi, '$1')
    .replace(/<br\s*\/?>\s*(<li[^>]*>)/gi, '$1');

  return html;
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
    .replace(/\{\{content\}\}/g, renderMarkdown(params.content))
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
        logger.error(
          `[Notification Email] Failed to send background email for category ${category}:`,
          error,
        );
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
  const userIds = Array.from(new Set(paramsList.map((p) => p.userId)));
  const preferences = await prisma.notificationPreference.findMany({
    where: { userId: { in: userIds } },
  });
  const prefsMap = new Map(preferences.map((p) => [p.userId, p]));

  const filtered = paramsList.filter((params) => {
    const prefKey = categoryToPrefKey[params.category] as keyof NotificationPreference;
    const prefs = prefsMap.get(params.userId);
    if (!prefs) return prefKey !== 'pushMarketing';
    return (prefs[prefKey] as boolean | undefined) ?? prefKey !== 'pushMarketing';
  });

  if (filtered.length === 0) return [];

  const data = filtered.map(({ category: _category, ...rest }) => ({
    id: randomUUID(),
    type: rest.type,
    title: rest.title,
    content: rest.content,
    isRead: false,
    userId: rest.userId,
    link: rest.link || null,
    broadcastId: rest.broadcastId || null,
    createdAt: new Date(),
  }));

  await prisma.notification.createMany({ data });

  for (let i = 0; i < filtered.length; i++) {
    const item = filtered[i];
    const notification = data[i];
    if (!item || !notification) continue;

    emitToUser(item.userId, 'new_notification', notification);

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
          logger.error(
            `[Notification Email Batch] Failed to send background email for category ${item.category}:`,
            error,
          );
        }
      })();
    }
  }

  return data;
}
