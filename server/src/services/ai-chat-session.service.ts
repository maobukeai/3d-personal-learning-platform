import prisma from './prisma';

const MAX_SESSION_TITLE_LENGTH = 80;
const MAX_SESSION_TAGS = 8;
const MAX_SESSION_TAG_LENGTH = 18;

export type AiChatSessionMode = 'default' | 'search' | 'research';

export const normalizeAiChatSessionId = (value: unknown): string => {
  const sessionId = typeof value === 'string' ? value.trim() : '';
  return sessionId.slice(0, 120) || 'default';
};

export const normalizeAiChatSessionTitle = (value: unknown): string => {
  const title = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  return (title || '新对话').slice(0, MAX_SESSION_TITLE_LENGTH);
};

export const normalizeAiChatSessionMode = (value: unknown): AiChatSessionMode => {
  const mode = typeof value === 'string' ? value.trim() : '';
  if (mode === 'search' || mode === 'research') return mode;
  return 'default';
};

export const parseAiChatTags = (value: string | null | undefined): string[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      return normalizeAiChatTags(parsed);
    }
  } catch {
    // Fall through to loose parsing below.
  }

  return normalizeAiChatTags(value);
};

export const normalizeAiChatTags = (value: unknown): string[] => {
  const raw = Array.isArray(value)
    ? value.map((item) => String(item || '')).join('\n')
    : String(value || '');
  const seen = new Set<string>();
  const tags: string[] = [];

  raw
    .split(/[\n,，;；#]/)
    .map((item) => item.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .forEach((item) => {
      const tag = item.slice(0, MAX_SESSION_TAG_LENGTH);
      const key = tag.toLowerCase();
      if (!key || seen.has(key) || tags.length >= MAX_SESSION_TAGS) return;
      seen.add(key);
      tags.push(tag);
    });

  return tags;
};

export const serializeAiChatTags = (value: unknown): string | null => {
  const tags = normalizeAiChatTags(value);
  return tags.length ? JSON.stringify(tags) : null;
};

export async function touchAiChatSession(params: {
  userId: string;
  sessionId: unknown;
  sessionTitle?: unknown;
  mode?: unknown;
  at?: Date;
}) {
  const id = normalizeAiChatSessionId(params.sessionId);
  const title = normalizeAiChatSessionTitle(params.sessionTitle);
  const mode = normalizeAiChatSessionMode(params.mode);
  const lastMessageAt = params.at || new Date();

  return prisma.aiChatSession.upsert({
    where: {
      userId_id: {
        userId: params.userId,
        id,
      },
    },
    create: {
      userId: params.userId,
      id,
      title,
      mode,
      lastMessageAt,
    },
    update: {
      mode,
      lastMessageAt,
    },
  });
}
