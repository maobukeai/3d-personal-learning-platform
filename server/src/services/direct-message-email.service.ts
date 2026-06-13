import prisma from './prisma';
import { isUserInConversation } from './socket.service';
import { sendNotificationEmail } from '../utils/notification';
import { logger } from '../utils/logger';

const DEFAULT_MESSAGE_EMAIL_COOLDOWN_MS = 5 * 60 * 1000;
const DEFAULT_MESSAGE_EMAIL_RETRY_MS = 60 * 1000;
const DEFAULT_MESSAGE_EMAIL_SWEEP_MS = 60 * 1000;
const MAX_TIMER_DELAY_MS = 2_147_483_647;
const MAX_PREVIEW_ITEMS = 5;

const readNonNegativeInt = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const readPositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const MESSAGE_EMAIL_COOLDOWN_MS = readNonNegativeInt(
  process.env.MESSAGE_EMAIL_COOLDOWN_MS,
  DEFAULT_MESSAGE_EMAIL_COOLDOWN_MS,
);
const MESSAGE_EMAIL_RETRY_MS = readPositiveInt(
  process.env.MESSAGE_EMAIL_RETRY_MS,
  DEFAULT_MESSAGE_EMAIL_RETRY_MS,
);
const MESSAGE_EMAIL_SWEEP_MS = readPositiveInt(
  process.env.MESSAGE_EMAIL_SWEEP_MS,
  DEFAULT_MESSAGE_EMAIL_SWEEP_MS,
);
const MESSAGE_EMAIL_PROCESSING_STALE_MS = Math.max(MESSAGE_EMAIL_RETRY_MS * 5, 5 * 60 * 1000);

type PreviewItem = {
  senderName: string;
  preview: string;
  at: string;
};

type DirectMessageEmailBatchShape = {
  id: string;
  userId: string;
  conversationId: string;
  pendingCount: number;
  previewItems: string;
  lastSenderName: string | null;
  conversationName: string | null;
  isGroup: boolean;
  firstQueuedAt: Date | null;
  scheduledFor: Date | null;
  lastSentAt: Date | null;
};

export type QueueDirectMessageEmailParams = {
  recipientId: string;
  conversationId: string;
  senderName: string;
  conversationName?: string | null;
  isGroup: boolean;
  content: unknown;
  messageType: string;
};

export const directMessageEmailPreview = (content: unknown, type: string) => {
  if (type === 'TEXT' && typeof content === 'string') return content.trim();
  if (type === 'IMAGE') return '收到了一张图片。';
  if (type === 'FILE') return '收到了一份文件。';
  if (type === 'VOICE') return '收到了一条语音消息。';
  return '收到了一条新消息。';
};

const normalizeName = (value: string | null | undefined, fallback = '有人') => {
  const normalized = (value || '').replace(/\s+/g, ' ').trim();
  return normalized || fallback;
};

const parsePreviewItems = (value: string | null | undefined): PreviewItem[] => {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => ({
        senderName: normalizeName(item?.senderName),
        preview: typeof item?.preview === 'string' ? item.preview : '',
        at: typeof item?.at === 'string' ? item.at : new Date().toISOString(),
      }))
      .filter((item) => item.preview);
  } catch (_error) {
    return [];
  }
};

const stringifyPreviewItems = (items: PreviewItem[]) =>
  JSON.stringify(items.filter((item) => item.preview).slice(-MAX_PREVIEW_ITEMS));

const timers = new Map<string, NodeJS.Timeout>();
let sweepTimer: NodeJS.Timeout | null = null;

const clearBatchTimer = (batchId: string) => {
  const timer = timers.get(batchId);
  if (timer) {
    clearTimeout(timer);
    timers.delete(batchId);
  }
};

const scheduleBatch = (batchId: string, scheduledFor: Date | null) => {
  clearBatchTimer(batchId);
  if (!scheduledFor) return;

  const delay = Math.max(0, scheduledFor.getTime() - Date.now());
  const timer = setTimeout(
    () => {
      timers.delete(batchId);
      void flushDirectMessageEmailBatch(batchId);
    },
    Math.min(delay, MAX_TIMER_DELAY_MS),
  );
  timer.unref?.();
  timers.set(batchId, timer);
};

const resolveScheduledFor = (
  existing: Pick<
    DirectMessageEmailBatchShape,
    'pendingCount' | 'scheduledFor' | 'lastSentAt'
  > | null,
  now: Date,
) => {
  if (existing?.pendingCount && existing.scheduledFor && existing.scheduledFor > now) {
    return existing.scheduledFor;
  }

  if (!existing?.lastSentAt || MESSAGE_EMAIL_COOLDOWN_MS === 0) {
    return now;
  }

  const cooldownEndsAt = existing.lastSentAt.getTime() + MESSAGE_EMAIL_COOLDOWN_MS;
  return new Date(Math.max(now.getTime(), cooldownEndsAt));
};

const buildEmailPayload = (batch: DirectMessageEmailBatchShape) => {
  const items = parsePreviewItems(batch.previewItems);
  const count = Math.max(batch.pendingCount, 1);
  const lastSenderName = normalizeName(batch.lastSenderName);
  const senderNames = Array.from(new Set(items.map((item) => item.senderName).filter(Boolean)));
  const senderSummary = senderNames.length <= 1 ? lastSenderName : `${senderNames.length} 位成员`;
  const countText = count > 1 ? `${count} 条新消息` : '一条新消息';
  const conversationLabel =
    batch.isGroup && batch.conversationName ? `「${batch.conversationName}」` : '';

  const subject =
    count > 1
      ? conversationLabel
        ? `${conversationLabel}有 ${count} 条新消息`
        : `你有 ${count} 条新私信`
      : conversationLabel
        ? `${lastSenderName} 在 ${batch.conversationName} 发来消息`
        : `${lastSenderName} 发来一条私信`;

  const title = count > 1 ? `收到 ${count} 条新私信` : '收到新私信';
  const content = batch.isGroup
    ? `${senderSummary} 在${conversationLabel || '群聊'}中发来了${countText}`
    : `${lastSenderName} 给你发来了${countText}`;
  const preview = items.map((item) => `${item.senderName}: ${item.preview}`).join('\n');

  return {
    subject,
    title,
    content,
    preview,
    link: `/messages?conversationId=${encodeURIComponent(batch.conversationId)}`,
  };
};

const resetPendingBatch = async (
  batchId: string,
  data: { lastSentAt?: Date | null; lastError?: string | null } = {},
) => {
  await prisma.directMessageEmailBatch.update({
    where: { id: batchId },
    data: {
      pendingCount: 0,
      previewItems: '[]',
      firstQueuedAt: null,
      lastQueuedAt: null,
      scheduledFor: null,
      processingAt: null,
      lastError: data.lastError ?? null,
      ...(data.lastSentAt !== undefined ? { lastSentAt: data.lastSentAt } : {}),
    },
  });
};

const formatError = (error: unknown) => (error instanceof Error ? error.message : String(error));

export async function queueDirectMessageEmail(params: QueueDirectMessageEmailParams) {
  if (isUserInConversation(params.recipientId, params.conversationId)) {
    return { queued: false, reason: 'conversation_open' };
  }

  const now = new Date();
  const senderName = normalizeName(params.senderName);
  const preview = directMessageEmailPreview(params.content, params.messageType);
  const previewItem: PreviewItem = {
    senderName,
    preview,
    at: now.toISOString(),
  };

  const existing = await prisma.directMessageEmailBatch.findUnique({
    where: {
      userId_conversationId: {
        userId: params.recipientId,
        conversationId: params.conversationId,
      },
    },
  });
  const scheduledFor = resolveScheduledFor(existing, now);
  const nextPreviewItems = stringifyPreviewItems([
    ...parsePreviewItems(existing?.previewItems),
    previewItem,
  ]);

  const batch = existing
    ? await prisma.directMessageEmailBatch.update({
        where: { id: existing.id },
        data: {
          pendingCount: { increment: 1 },
          previewItems: nextPreviewItems,
          lastSenderName: senderName,
          conversationName: params.conversationName || null,
          isGroup: params.isGroup,
          firstQueuedAt: existing.pendingCount > 0 ? existing.firstQueuedAt : now,
          lastQueuedAt: now,
          scheduledFor,
        },
      })
    : await prisma.directMessageEmailBatch.create({
        data: {
          userId: params.recipientId,
          conversationId: params.conversationId,
          pendingCount: 1,
          previewItems: nextPreviewItems,
          lastSenderName: senderName,
          conversationName: params.conversationName || null,
          isGroup: params.isGroup,
          firstQueuedAt: now,
          lastQueuedAt: now,
          scheduledFor,
        },
      });

  scheduleBatch(batch.id, batch.scheduledFor);

  return {
    queued: true,
    batchId: batch.id,
    scheduledFor: batch.scheduledFor,
  };
}

export async function flushDirectMessageEmailBatch(batchId: string) {
  clearBatchTimer(batchId);

  const batch = await prisma.directMessageEmailBatch.findUnique({ where: { id: batchId } });
  if (!batch || batch.pendingCount <= 0 || !batch.scheduledFor) return;

  if (batch.scheduledFor.getTime() > Date.now()) {
    scheduleBatch(batch.id, batch.scheduledFor);
    return;
  }

  if (isUserInConversation(batch.userId, batch.conversationId)) {
    await resetPendingBatch(batch.id);
    return;
  }

  const now = new Date();
  const staleProcessingBefore = new Date(now.getTime() - MESSAGE_EMAIL_PROCESSING_STALE_MS);
  const claim = await prisma.directMessageEmailBatch.updateMany({
    where: {
      id: batch.id,
      pendingCount: { gt: 0 },
      scheduledFor: { lte: now },
      OR: [{ processingAt: null }, { processingAt: { lt: staleProcessingBefore } }],
    },
    data: {
      processingAt: now,
      lastError: null,
    },
  });

  if (claim.count === 0) return;

  const claimedBatch = await prisma.directMessageEmailBatch.findUnique({ where: { id: batch.id } });
  if (!claimedBatch || claimedBatch.pendingCount <= 0) return;

  try {
    const email = buildEmailPayload(claimedBatch);
    const sent = await sendNotificationEmail({
      userId: claimedBatch.userId,
      category: 'DIRECT_MESSAGE',
      subject: email.subject,
      title: email.title,
      content: email.content,
      link: email.link,
      preview: email.preview,
      throwOnFailure: true,
    });

    await resetPendingBatch(claimedBatch.id, {
      lastSentAt: sent ? new Date() : undefined,
    });
  } catch (error) {
    const retryAt = new Date(Date.now() + MESSAGE_EMAIL_RETRY_MS);
    const message = formatError(error);
    logger.error('[Direct Message Email] Failed to send queued reminder:', message);

    await prisma.directMessageEmailBatch.update({
      where: { id: claimedBatch.id },
      data: {
        scheduledFor: retryAt,
        processingAt: null,
        lastError: message,
      },
    });
    scheduleBatch(claimedBatch.id, retryAt);
  }
}

export async function schedulePendingDirectMessageEmails() {
  // Guard: if the model doesn't exist in this deployment's schema, skip silently
  if (!(prisma as any).directMessageEmailBatch) {
    return 0;
  }

  const pendingBatches = await prisma.directMessageEmailBatch.findMany({
    where: {
      pendingCount: { gt: 0 },
      scheduledFor: { not: null },
    },
    select: {
      id: true,
      scheduledFor: true,
    },
  });

  for (const batch of pendingBatches) {
    scheduleBatch(batch.id, batch.scheduledFor);
  }

  return pendingBatches.length;
}

export function startDirectMessageEmailScheduler() {
  void schedulePendingDirectMessageEmails().catch((error) => {
    logger.error('[Direct Message Email] Failed to schedule pending reminders:', error);
  });

  if (sweepTimer) return;

  sweepTimer = setInterval(() => {
    void schedulePendingDirectMessageEmails().catch((error) => {
      logger.error('[Direct Message Email] Failed to sweep pending reminders:', error);
    });
  }, MESSAGE_EMAIL_SWEEP_MS);
  sweepTimer.unref?.();
}

export function stopDirectMessageEmailScheduler() {
  if (sweepTimer) {
    clearInterval(sweepTimer);
    sweepTimer = null;
  }

  for (const timer of timers.values()) {
    clearTimeout(timer);
  }
  timers.clear();
}
