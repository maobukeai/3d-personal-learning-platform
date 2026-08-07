import type { AiBotKnowledgeSource, Prisma } from '@prisma/client';
import prisma from '../prisma';
import { AppError } from '../../utils/error';
import {
  MAX_KNOWLEDGE_CONTENT_LENGTH,
  MAX_KNOWLEDGE_URL_LENGTH,
  type PublicAiBotKnowledgeSource,
  type AiBotKnowledgeSummary,
  type AnyRecord,
  type AiBotPromptTemplate,
  promptTemplates,
} from './types';
import {
  parseKeywords,
  parseStoredKeywords,
  normalizeKnowledgeSourceType,
  normalizeKnowledgeStatus,
  normalizeKnowledgeVisibility,
  normalizeKnowledgeTitle,
  hasOwnField,
} from './bot-entitlement.service';

const normalizeKnowledgeContent = (value: unknown): string => {
  const content = String(value || '')
    .trim()
    .slice(0, MAX_KNOWLEDGE_CONTENT_LENGTH);
  if (content.length < 12) {
    throw new AppError(
      '知识源内容过短，请至少填写 12 个字符',
      400,
      'AI_BOT_KNOWLEDGE_CONTENT_TOO_SHORT',
    );
  }
  return content;
};

const normalizeKnowledgeUrl = (value: unknown): string | null => {
  const url = String(value || '').trim();
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) {
    throw new AppError(
      '知识源链接必须以 http:// 或 https:// 开头',
      400,
      'AI_BOT_KNOWLEDGE_URL_INVALID',
    );
  }
  return url.slice(0, MAX_KNOWLEDGE_URL_LENGTH);
};

const normalizePriority = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 50;
  return Math.min(100, Math.max(0, Math.round(parsed)));
};

export function clampPercent(value: number): number {
  if (isNaN(value) || !isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value * 10) / 10));
}

export async function summarizeKnowledgeSources(
  userId: string,
  integrationId?: string,
): Promise<AiBotKnowledgeSummary> {
  const where = { userId, ...(integrationId ? { integrationId } : {}) };
  const sources = await prisma.aiBotKnowledgeSource.findMany({
    where,
    select: { status: true, tokenEstimate: true, updatedAt: true },
  });

  const total = sources.length;
  const activeCount = sources.filter((s) => s.status === 'ACTIVE').length;
  const draftCount = sources.filter((s) => s.status === 'DRAFT').length;
  const pausedCount = sources.filter((s) => s.status === 'PAUSED').length;
  const totalTokens = sources.reduce((sum, s) => sum + s.tokenEstimate, 0);

  let lastUpdatedAt: Date | null = null;
  sources.forEach((s) => {
    if (!lastUpdatedAt || s.updatedAt > lastUpdatedAt) {
      lastUpdatedAt = s.updatedAt;
    }
  });

  return {
    sourceCount: total,
    activeCount,
    draftCount,
    pausedCount,
    totalTokenEstimate: totalTokens,
    coverageScore: clampPercent((activeCount / Math.max(1, total)) * 100),
    lastUpdatedAt,
  };
}

const estimateKnowledgeTokens = (content: string): number =>
  Math.max(1, Math.ceil(content.replace(/\s+/g, '').length / 1.8));

export const toPublicKnowledgeSource = (
  source: AiBotKnowledgeSource,
): PublicAiBotKnowledgeSource => ({
  id: source.id,
  integrationId: source.integrationId,
  title: source.title,
  sourceType: normalizeKnowledgeSourceType(source.sourceType),
  status: normalizeKnowledgeStatus(source.status),
  visibility: normalizeKnowledgeVisibility(source.visibility),
  content: source.content,
  url: source.url,
  tags: parseStoredKeywords(source.tags),
  priority: source.priority,
  tokenEstimate: source.tokenEstimate,
  lastIndexedAt: source.lastIndexedAt,
  createdAt: source.createdAt,
  updatedAt: source.updatedAt,
});

export const buildKnowledgeSummary = (
  sources: Array<Pick<AiBotKnowledgeSource, 'status' | 'tokenEstimate' | 'updatedAt'>>,
): AiBotKnowledgeSummary => {
  const activeCount = sources.filter((source) => source.status === 'ACTIVE').length;
  const draftCount = sources.filter((source) => source.status === 'DRAFT').length;
  const pausedCount = sources.filter((source) => source.status === 'PAUSED').length;
  const lastUpdatedAt =
    sources
      .map((source) => source.updatedAt)
      .filter((date): date is Date => Boolean(date))
      .sort((a, b) => b.getTime() - a.getTime())[0] || null;

  return {
    sourceCount: sources.length,
    activeCount,
    draftCount,
    pausedCount,
    totalTokenEstimate: sources.reduce((total, source) => total + source.tokenEstimate, 0),
    coverageScore: sources.length
      ? clampPercent((activeCount / Math.max(3, sources.length)) * 100)
      : 0,
    lastUpdatedAt,
  };
};

const buildKnowledgeCreateData = (
  userId: string,
  integrationId: string,
  body: AnyRecord,
): Prisma.AiBotKnowledgeSourceUncheckedCreateInput => {
  const content = normalizeKnowledgeContent(body.content);
  const tags = parseKeywords(body.tags);

  return {
    userId,
    integrationId,
    title: normalizeKnowledgeTitle(body.title),
    sourceType: normalizeKnowledgeSourceType(body.sourceType),
    status: normalizeKnowledgeStatus(body.status),
    visibility: normalizeKnowledgeVisibility(body.visibility),
    content,
    url: normalizeKnowledgeUrl(body.url),
    tags: tags.length ? JSON.stringify(tags) : null,
    priority: normalizePriority(body.priority),
    tokenEstimate: estimateKnowledgeTokens(content),
    lastIndexedAt: new Date(),
  };
};

const buildKnowledgeUpdateData = (
  body: AnyRecord,
): Prisma.AiBotKnowledgeSourceUncheckedUpdateInput => {
  const data: Prisma.AiBotKnowledgeSourceUncheckedUpdateInput = {};

  if (hasOwnField(body, 'title')) {
    data.title = normalizeKnowledgeTitle(body.title);
  }
  if (hasOwnField(body, 'sourceType')) {
    data.sourceType = normalizeKnowledgeSourceType(body.sourceType);
  }
  if (hasOwnField(body, 'status')) {
    data.status = normalizeKnowledgeStatus(body.status);
  }
  if (hasOwnField(body, 'visibility')) {
    data.visibility = normalizeKnowledgeVisibility(body.visibility);
  }
  if (hasOwnField(body, 'content')) {
    const content = normalizeKnowledgeContent(body.content);
    data.content = content;
    data.tokenEstimate = estimateKnowledgeTokens(content);
    data.lastIndexedAt = new Date();
  }
  if (hasOwnField(body, 'url')) {
    data.url = normalizeKnowledgeUrl(body.url);
  }
  if (hasOwnField(body, 'tags')) {
    const tags = parseKeywords(body.tags);
    data.tags = tags.length ? JSON.stringify(tags) : null;
  }
  if (hasOwnField(body, 'priority')) {
    data.priority = normalizePriority(body.priority);
  }

  return data;
};

export async function listAiBotKnowledgeSources(
  userId: string,
  integrationId: string,
): Promise<{ sources: PublicAiBotKnowledgeSource[]; summary: AiBotKnowledgeSummary }> {
  const sources = await prisma.aiBotKnowledgeSource.findMany({
    where: { userId, integrationId },
    orderBy: [{ status: 'asc' }, { priority: 'desc' }, { updatedAt: 'desc' }],
  });

  return {
    sources: sources.map(toPublicKnowledgeSource),
    summary: buildKnowledgeSummary(sources),
  };
}

export async function createAiBotKnowledgeSource(
  userId: string,
  integrationId: string,
  body: AnyRecord,
): Promise<{ source: PublicAiBotKnowledgeSource; summary: AiBotKnowledgeSummary }> {
  const source = await prisma.aiBotKnowledgeSource.create({
    data: buildKnowledgeCreateData(userId, integrationId, body),
  });
  const summary = await listAiBotKnowledgeSources(userId, integrationId);
  return {
    source: toPublicKnowledgeSource(source),
    summary: summary.summary,
  };
}

export async function updateAiBotKnowledgeSource(
  userId: string,
  integrationId: string,
  sourceId: string,
  body: AnyRecord,
): Promise<{ source: PublicAiBotKnowledgeSource; summary: AiBotKnowledgeSummary }> {
  const existing = await prisma.aiBotKnowledgeSource.findFirst({
    where: { id: sourceId, userId, integrationId },
  });
  if (!existing) {
    throw new AppError('未找到指定知识源，或无权访问', 404, 'AI_BOT_KNOWLEDGE_NOT_FOUND');
  }

  const source = await prisma.aiBotKnowledgeSource.update({
    where: { id: sourceId },
    data: buildKnowledgeUpdateData(body),
  });
  const summary = await listAiBotKnowledgeSources(userId, integrationId);
  return {
    source: toPublicKnowledgeSource(source),
    summary: summary.summary,
  };
}

export async function deleteAiBotKnowledgeSource(
  userId: string,
  integrationId: string,
  sourceId: string,
): Promise<{ success: true; summary: AiBotKnowledgeSummary }> {
  const existing = await prisma.aiBotKnowledgeSource.findFirst({
    where: { id: sourceId, userId, integrationId },
  });
  if (!existing) {
    throw new AppError('未找到指定知识源，或无权访问', 404, 'AI_BOT_KNOWLEDGE_NOT_FOUND');
  }

  await prisma.aiBotKnowledgeSource.delete({ where: { id: sourceId } });
  const summary = await listAiBotKnowledgeSources(userId, integrationId);
  return {
    success: true,
    summary: summary.summary,
  };
}

export const getAiBotPromptTemplates = (): AiBotPromptTemplate[] =>
  promptTemplates.map((template) => ({
    ...template,
    triggerKeywords: [...template.triggerKeywords],
    qualityChecks: [...template.qualityChecks],
  }));
