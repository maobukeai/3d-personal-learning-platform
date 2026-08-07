import prisma from '../prisma';
import {
  type AiBotAnalytics,
  type AiBotTimelinePoint,
  type AiBotPlatformMetric,
  type AiBotIntegrationMetric,
  type AiBotQualitySignal,
  type AiBotRecentFailure,
  AI_BOT_MESSAGE_STATUS,
  platformLabels,
} from './types';
import { clampPercent } from './bot-knowledge.service';

export const isFailedStatus = (status: string): boolean =>
  status === AI_BOT_MESSAGE_STATUS.ERROR || status === AI_BOT_MESSAGE_STATUS.WEBHOOK_FAILED;

export const hasActionableStructure = (text: string | null | undefined): boolean => {
  if (!text) return false;
  return (
    text.includes('1.') || text.includes('- ') || text.includes('###') || text.includes('清单')
  );
};

export const getAiBotModelOptions = async () => {
  return [
    { id: 'gpt-4o', name: 'GPT-4o', modelName: 'gpt-4o', provider: 'OpenAI', isDefault: true },
    {
      id: 'claude-3-5-sonnet',
      name: 'Claude 3.5 Sonnet',
      modelName: 'claude-3-5-sonnet',
      provider: 'Anthropic',
      isDefault: false,
    },
    {
      id: 'deepseek-r1',
      name: 'DeepSeek R1',
      modelName: 'deepseek-r1',
      provider: 'DeepSeek',
      isDefault: false,
    },
  ];
};

export const buildAiBotModelOverrides = (modelId?: string | null): any => {
  if (!modelId) return undefined;
  return { model: modelId };
};

export const getAiBotModelSummary = async (aiModelId: string | null | undefined) => {
  if (!aiModelId) return null;
  return {
    id: aiModelId,
    name: aiModelId,
    modelName: aiModelId,
    provider: 'AI Provider',
    isDefault: false,
  };
};

export async function getAiBotAnalytics(
  userId: string,
  daysValue: unknown,
): Promise<AiBotAnalytics> {
  const days = Math.min(90, Math.max(1, Number(daysValue) || 14));
  const until = new Date();
  const since = new Date();
  since.setDate(until.getDate() - days + 1);
  since.setHours(0, 0, 0, 0);

  const [integrations, messages, knowledgeSources, activeKnowledgeSources] = await Promise.all([
    prisma.aiBotIntegration.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.aiBotMessage.findMany({
      where: {
        userId,
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    }),
    prisma.aiBotKnowledgeSource.count({ where: { userId } }),
    prisma.aiBotKnowledgeSource.count({ where: { userId, status: 'ACTIVE' } }),
  ]);

  const integrationCount = integrations.length;
  const activeIntegrationCount = integrations.filter((i) => i.status === 'ACTIVE').length;
  const pausedIntegrationCount = integrations.filter((i) => i.status === 'PAUSED').length;

  const totalMessages = messages.length;
  const successCount = messages.filter((m) => m.status === AI_BOT_MESSAGE_STATUS.SUCCESS).length;
  const failedCount = messages.filter((m) => isFailedStatus(m.status)).length;
  const ignoredCount = messages.filter((m) => m.status === AI_BOT_MESSAGE_STATUS.IGNORED).length;

  const successRate = clampPercent((successCount / Math.max(1, totalMessages)) * 100);

  const totalInputChars = messages.reduce((acc, m) => acc + m.inputChars, 0);
  const totalOutputChars = messages.reduce((acc, m) => acc + m.outputChars, 0);
  const avgInputChars = Math.round(totalInputChars / Math.max(1, totalMessages));
  const avgOutputChars = Math.round(totalOutputChars / Math.max(1, totalMessages));

  const mapByDate = new Map<
    string,
    {
      total: number;
      success: number;
      failed: number;
      ignored: number;
      input: number;
      output: number;
    }
  >();
  for (let i = 0; i < days; i++) {
    const cur = new Date(since);
    cur.setDate(since.getDate() + i);
    const key = cur.toISOString().split('T')[0]!;
    mapByDate.set(key, { total: 0, success: 0, failed: 0, ignored: 0, input: 0, output: 0 });
  }

  messages.forEach((m) => {
    const key = m.createdAt.toISOString().split('T')[0]!;
    const item = mapByDate.get(key);
    if (item) {
      item.total++;
      if (m.status === AI_BOT_MESSAGE_STATUS.SUCCESS) item.success++;
      if (isFailedStatus(m.status)) item.failed++;
      if (m.status === AI_BOT_MESSAGE_STATUS.IGNORED) item.ignored++;
      item.input += m.inputChars;
      item.output += m.outputChars;
    }
  });

  const timeline: AiBotTimelinePoint[] = Array.from(mapByDate.entries()).map(([dateStr, item]) => {
    const [, month, day] = dateStr.split('-');
    return {
      date: dateStr,
      label: `${month}/${day}`,
      total: item.total,
      success: item.success,
      failed: item.failed,
      ignored: item.ignored,
      inputChars: item.input,
      outputChars: item.output,
    };
  });

  const platformMap = new Map<
    string,
    { total: number; success: number; failed: number; lastUsed: Date | null }
  >();
  integrations.forEach((i) => {
    if (!platformMap.has(i.platform)) {
      platformMap.set(i.platform, { total: 0, success: 0, failed: 0, lastUsed: null });
    }
  });

  messages.forEach((m) => {
    const item = platformMap.get(m.platform) || { total: 0, success: 0, failed: 0, lastUsed: null };
    item.total++;
    if (m.status === AI_BOT_MESSAGE_STATUS.SUCCESS) item.success++;
    if (isFailedStatus(m.status)) item.failed++;
    if (!item.lastUsed || m.createdAt > item.lastUsed) item.lastUsed = m.createdAt;
    platformMap.set(m.platform, item);
  });

  const platformMetrics: AiBotPlatformMetric[] = Array.from(platformMap.entries()).map(
    ([platform, data]) => {
      const pIntegrations = integrations.filter((i) => i.platform === platform);
      return {
        platform,
        platformLabel: platformLabels[platform as keyof typeof platformLabels] || platform,
        integrationCount: pIntegrations.length,
        activeCount: pIntegrations.filter((i) => i.status === 'ACTIVE').length,
        messageCount: data.total,
        successCount: data.success,
        failedCount: data.failed,
        successRate: clampPercent((data.success / Math.max(1, data.total)) * 100),
        lastUsedAt: data.lastUsed,
      };
    },
  );

  const integrationStats = new Map<
    string,
    {
      total: number;
      success: number;
      failed: number;
      ignored: number;
      input: number;
      output: number;
      lastMsg: Date | null;
    }
  >();
  messages.forEach((m) => {
    const item = integrationStats.get(m.integrationId) || {
      total: 0,
      success: 0,
      failed: 0,
      ignored: 0,
      input: 0,
      output: 0,
      lastMsg: null,
    };
    item.total++;
    if (m.status === AI_BOT_MESSAGE_STATUS.SUCCESS) item.success++;
    if (isFailedStatus(m.status)) item.failed++;
    if (m.status === AI_BOT_MESSAGE_STATUS.IGNORED) item.ignored++;
    item.input += m.inputChars;
    item.output += m.outputChars;
    if (!item.lastMsg || m.createdAt > item.lastMsg) item.lastMsg = m.createdAt;
    integrationStats.set(m.integrationId, item);
  });

  const topIntegrations: AiBotIntegrationMetric[] = integrations
    .map((i) => {
      const stats = integrationStats.get(i.id) || {
        total: 0,
        success: 0,
        failed: 0,
        ignored: 0,
        input: 0,
        output: 0,
        lastMsg: null,
      };
      return {
        id: i.id,
        name: i.name,
        platform: i.platform,
        platformLabel: platformLabels[i.platform as keyof typeof platformLabels] || i.platform,
        status: i.status,
        messageCount: stats.total,
        successCount: stats.success,
        failedCount: stats.failed,
        ignoredCount: stats.ignored,
        successRate: clampPercent((stats.success / Math.max(1, stats.total)) * 100),
        inputChars: stats.input,
        outputChars: stats.output,
        lastMessageAt: stats.lastMsg,
        lastUsedAt: i.updatedAt,
      };
    })
    .sort((a, b) => b.messageCount - a.messageCount);

  const integrationNames = new Map(integrations.map((i) => [i.id, i.name]));
  const recentFailures: AiBotRecentFailure[] = messages
    .filter((m) => isFailedStatus(m.status))
    .slice(0, 10)
    .map((m) => ({
      id: m.id,
      integrationId: m.integrationId,
      integrationName: integrationNames.get(m.integrationId) || '未知接入',
      platform: m.platform,
      status: m.status,
      error: m.error,
      inboundText: m.inboundText.slice(0, 200),
      createdAt: m.createdAt,
    }));

  const qualitySignals: AiBotQualitySignal[] = [
    {
      key: 'success-rate',
      label: '回复成功率',
      value: successRate,
      level: successRate >= 90 ? 'healthy' : successRate >= 75 ? 'warning' : 'critical',
      description: `近 ${days} 天成功率为 ${successRate}%`,
      action: successRate < 90 ? '检查失败消息日志，确认平台 API 是否有异常。' : '运行正常。',
    },
    {
      key: 'security-coverage',
      label: '签名/密钥配置率',
      value: clampPercent(
        (integrations.filter((i) => Boolean(i.secret)).length / Math.max(1, integrationCount)) *
          100,
      ),
      level: integrations.every((i) => Boolean(i.secret)) ? 'healthy' : 'warning',
      description: '密钥能够防范非法伪造请求。',
      action: '为未配置密钥的接入补齐 Secret。',
    },
  ];

  const nextBestActions: string[] = [];
  if (!integrationCount) {
    nextBestActions.push('立即接入企微/钉钉/飞书机器人。');
  } else if (successRate < 85) {
    nextBestActions.push('检查质检失败项，修复投递失败。');
  }

  return {
    range: { days, since, until },
    summary: {
      integrationCount,
      activeIntegrationCount,
      pausedIntegrationCount,
      messageCount: totalMessages,
      successCount,
      failedCount,
      ignoredCount,
      successRate,
      avgInputChars,
      avgOutputChars,
      dailyQuotaUsedPercent: 0,
      automationScore: clampPercent((successCount / Math.max(1, totalMessages)) * 100),
      knowledgeSourceCount: knowledgeSources,
      activeKnowledgeSourceCount: activeKnowledgeSources,
      knowledgeCoverage: clampPercent(
        (activeKnowledgeSources / Math.max(1, knowledgeSources)) * 100,
      ),
    },
    timeline,
    platformMetrics,
    topIntegrations,
    qualitySignals,
    recentFailures,
    nextBestActions,
  };
}
