import type { AiBotIntegration } from '@prisma/client';
import prisma from '../prisma';
import { decryptSecret } from '../../utils/secret-field';
import { getPlanName } from '../../utils/plan-utils';
import { AppError } from '../../utils/error';
import {
  AI_BOT_MIN_PLAN_PRIORITY,
  AI_BOT_REQUIRED_PLAN_NAME,
  AI_BOT_MESSAGE_STATUS,
  MAX_INBOUND_CHARS,
  MAX_EXTERNAL_REF_CHARS,
  SUPPORTED_KNOWLEDGE_TYPES,
  SUPPORTED_KNOWLEDGE_STATUSES,
  SUPPORTED_KNOWLEDGE_VISIBILITY,
  MAX_KNOWLEDGE_TITLE_LENGTH,
  type AiBotEntitlement,
  type IncomingAiBotMessage,
  type AnyRecord,
  type AiBotKnowledgeSourceType,
  type AiBotKnowledgeStatus,
  type AiBotKnowledgeVisibility,
  getTodayStart,
} from './types';

const getLimitsForPriority = (priority: number) => {
  if (priority >= 2) {
    return { maxIntegrations: 10, dailyMessages: 1000 };
  }
  if (priority >= AI_BOT_MIN_PLAN_PRIORITY) {
    return { maxIntegrations: 2, dailyMessages: 100 };
  }
  return { maxIntegrations: 0, dailyMessages: 0 };
};

async function getEffectivePlanPriority(userId: string): Promise<number> {
  const [user, subscription] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { role: true } }),
    prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true },
    }),
  ]);

  const hasActivePlan =
    subscription?.status === 'ACTIVE' &&
    (!subscription.endDate || new Date(subscription.endDate) >= new Date());
  const planPriority = hasActivePlan ? subscription.plan.priority : 0;

  return user?.role === 'ADMIN' ? Math.max(planPriority, 2) : planPriority;
}

export async function getAiBotEntitlement(userId: string): Promise<AiBotEntitlement> {
  const currentPlanPriority = await getEffectivePlanPriority(userId);
  const limits = getLimitsForPriority(currentPlanPriority);
  const [integrationCount, dailyMessageCount] = await Promise.all([
    prisma.aiBotIntegration.count({ where: { userId } }),
    prisma.aiBotMessage.count({
      where: {
        userId,
        createdAt: {
          gte: getTodayStart(),
        },
        status: {
          not: AI_BOT_MESSAGE_STATUS.IGNORED,
        },
      },
    }),
  ]);

  return {
    enabled: currentPlanPriority >= AI_BOT_MIN_PLAN_PRIORITY,
    requiredPlanPriority: AI_BOT_MIN_PLAN_PRIORITY,
    requiredPlanName: AI_BOT_REQUIRED_PLAN_NAME,
    currentPlanPriority,
    currentPlanName: getPlanName(currentPlanPriority),
    maxIntegrations: limits.maxIntegrations,
    dailyMessages: limits.dailyMessages,
    integrationCount,
    dailyMessageCount,
  };
}

export async function assertCanCreateAiBot(userId: string): Promise<AiBotEntitlement> {
  const entitlement = await getAiBotEntitlement(userId);
  if (!entitlement.enabled) {
    throw new AppError(
      `AI 机器人接入需要 ${entitlement.requiredPlanName} 及以上会员`,
      403,
      'AI_BOT_PLAN_REQUIRED',
      entitlement,
    );
  }
  if (entitlement.integrationCount >= entitlement.maxIntegrations) {
    throw new AppError(
      `当前会员最多可创建 ${entitlement.maxIntegrations} 个 AI 机器人接入`,
      403,
      'AI_BOT_INTEGRATION_LIMIT',
      entitlement,
    );
  }
  return entitlement;
}

export async function assertCanUseAiBot(userId: string): Promise<AiBotEntitlement> {
  const entitlement = await getAiBotEntitlement(userId);
  if (!entitlement.enabled) {
    throw new AppError(
      `AI 机器人接入需要 ${entitlement.requiredPlanName} 及以上会员`,
      403,
      'AI_BOT_PLAN_REQUIRED',
      entitlement,
    );
  }
  if (entitlement.dailyMessageCount >= entitlement.dailyMessages) {
    throw new AppError(
      `今日 AI 机器人调用次数已达上限 ${entitlement.dailyMessages} 次`,
      429,
      'AI_BOT_DAILY_LIMIT',
      entitlement,
    );
  }
  return entitlement;
}

export const asRecord = (value: unknown): AnyRecord | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as AnyRecord) : null;

export const asString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

export const hasOwnField = (record: AnyRecord, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(record, key);

export const normalizeExternalRef = (value: string): string | null => {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized ? normalized.slice(0, MAX_EXTERNAL_REF_CHARS) : null;
};

export const getNestedString = (record: AnyRecord | null, path: string[]): string => {
  let current: unknown = record;
  for (const key of path) {
    const currentRecord = asRecord(current);
    if (!currentRecord) return '';
    current = currentRecord[key];
  }
  return asString(current);
};

export const parseTextLikeValue = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';

  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      const parsedRecord = asRecord(parsed);
      return (
        getNestedString(parsedRecord, ['text']) ||
        getNestedString(parsedRecord, ['content']) ||
        getNestedString(parsedRecord, ['body']) ||
        trimmed
      );
    } catch (_error) {
      return trimmed;
    }
  }

  return trimmed;
};

export function extractIncomingAiBotMessage(body: unknown): IncomingAiBotMessage {
  if (typeof body === 'string') {
    return {
      text: parseTextLikeValue(body).slice(0, MAX_INBOUND_CHARS),
      externalUserId: null,
      externalConversationId: null,
    };
  }

  const record = asRecord(body);
  if (!record) {
    return { text: '' };
  }

  const feishuEvent = asRecord(record.event);
  const feishuMessage = asRecord(feishuEvent?.message);

  const text =
    getNestedString(record, ['text', 'content']) ||
    getNestedString(record, ['text', 'plainText']) ||
    getNestedString(record, ['markdown', 'content']) ||
    getNestedString(record, ['content', 'text']) ||
    getNestedString(record, ['message', 'text', 'content']) ||
    getNestedString(record, ['message', 'text']) ||
    getNestedString(record, ['event', 'text']) ||
    parseTextLikeValue(record.content) ||
    parseTextLikeValue(record.text) ||
    parseTextLikeValue(getNestedString(record, ['message', 'content'])) ||
    parseTextLikeValue(getNestedString(record, ['event', 'message', 'content'])) ||
    parseTextLikeValue(getNestedString(feishuMessage, ['content'])) ||
    getNestedString(record, ['msg']) ||
    getNestedString(record, ['query']);

  const externalUserId = normalizeExternalRef(
    getNestedString(record, ['senderStaffId']) ||
      getNestedString(record, ['senderId']) ||
      getNestedString(record, ['senderNick']) ||
      getNestedString(record, ['userId']) ||
      getNestedString(record, ['fromUserName']) ||
      getNestedString(record, ['from', 'id']) ||
      getNestedString(record, ['sender', 'id']) ||
      getNestedString(record, ['sender', 'sender_id', 'user_id']) ||
      getNestedString(record, ['sender', 'sender_id', 'open_id']) ||
      getNestedString(record, ['message', 'sender', 'id']) ||
      getNestedString(feishuEvent, ['sender', 'sender_id', 'user_id']) ||
      getNestedString(feishuEvent, ['sender', 'sender_id', 'open_id']) ||
      getNestedString(feishuMessage, ['sender_id', 'user_id']) ||
      getNestedString(feishuMessage, ['sender_id', 'open_id']),
  );

  const externalConversationId = normalizeExternalRef(
    getNestedString(record, ['conversationId']) ||
      getNestedString(record, ['conversationTitle']) ||
      getNestedString(record, ['openConversationId']) ||
      getNestedString(record, ['chatId']) ||
      getNestedString(record, ['chat_id']) ||
      getNestedString(record, ['conversation', 'id']) ||
      getNestedString(record, ['message', 'chat_id']) ||
      getNestedString(feishuMessage, ['chat_id']),
  );

  return {
    text: text.slice(0, MAX_INBOUND_CHARS),
    externalUserId,
    externalConversationId,
  };
}

export const parseKeywords = (value: unknown): string[] => {
  const raw = Array.isArray(value)
    ? value.map((item: unknown) => String(item || '')).join('\n')
    : String(value || '');

  return raw
    .split(/[\n,，;；]/)
    .map((item: string) => item.trim())
    .filter(Boolean)
    .slice(0, 20)
    .map((item: string) => item.slice(0, 40));
};

export const parseStoredKeywords = (value: string | null): string[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return parseKeywords(parsed);
  } catch (_error) {
    return parseKeywords(value);
  }
};

export const normalizeOneOf = <T extends string>(
  value: unknown,
  supported: readonly T[],
  fallback: T,
): T => {
  const normalized = String(value || fallback)
    .trim()
    .toUpperCase();
  return supported.includes(normalized as T) ? (normalized as T) : fallback;
};

export const normalizeKnowledgeSourceType = (value: unknown): AiBotKnowledgeSourceType =>
  normalizeOneOf(value, SUPPORTED_KNOWLEDGE_TYPES, 'FAQ');

export const normalizeKnowledgeStatus = (value: unknown): AiBotKnowledgeStatus =>
  normalizeOneOf(value, SUPPORTED_KNOWLEDGE_STATUSES, 'ACTIVE');

export const normalizeKnowledgeVisibility = (value: unknown): AiBotKnowledgeVisibility =>
  normalizeOneOf(value, SUPPORTED_KNOWLEDGE_VISIBILITY, 'PRIVATE');

export const normalizeKnowledgeTitle = (value: unknown): string => {
  const title = String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_KNOWLEDGE_TITLE_LENGTH);
  if (!title) {
    throw new AppError('请填写知识源标题', 400, 'AI_BOT_KNOWLEDGE_TITLE_REQUIRED');
  }
  return title;
};

export const readSecret = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const decrypted = decryptSecret(value);
  return decrypted ? decrypted.trim() : null;
};

export const maskWebhookUrl = (value: string | null): string | null => {
  const webhookUrl = readSecret(value);
  if (!webhookUrl) return null;

  try {
    const url = new URL(webhookUrl);
    for (const key of Array.from(url.searchParams.keys())) {
      if (/key|token|secret|sign/i.test(key)) {
        url.searchParams.set(key, '***');
      }
    }
    const parts = url.pathname.split('/');
    const last = parts[parts.length - 1];
    if (last && last.length > 12) {
      parts[parts.length - 1] = `${last.slice(0, 4)}...${last.slice(-4)}`;
      url.pathname = parts.join('/');
    }
    return url.toString();
  } catch (_error) {
    return '***';
  }
};

export const getDecryptedAiBotSecret = (integration: Pick<AiBotIntegration, 'secret'>) =>
  readSecret(integration.secret);

export const getDecryptedAiBotWebhook = (integration: Pick<AiBotIntegration, 'webhookUrl'>) =>
  readSecret(integration.webhookUrl);
