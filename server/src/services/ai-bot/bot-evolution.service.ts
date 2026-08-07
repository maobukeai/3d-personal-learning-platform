import type { AiBotIntegration } from '@prisma/client';
import prisma from '../prisma';
import {
  type AiBotEvolutionInsights,
  type AiBotIntentCluster,
  type AiBotKnowledgeGap,
  type AiBotDiagnosticCheck,
  type AiBotEntitlement,
} from './types';
import { clampPercent } from './bot-knowledge.service';
import { buildAiBotDiagnostics } from './bot-diagnostics.service';
import { isFailedStatus } from './bot-analytics.service';

export async function buildAiBotEvolutionInsights(
  integration: AiBotIntegration,
  entitlement: AiBotEntitlement,
  daysValue: unknown,
): Promise<AiBotEvolutionInsights> {
  const days = Math.min(90, Math.max(1, Number(daysValue) || 14));
  const since = new Date();
  since.setDate(since.getDate() - days);

  const messages = await prisma.aiBotMessage.findMany({
    where: {
      userId: integration.userId,
      integrationId: integration.id,
      createdAt: { gte: since },
    },
    orderBy: { createdAt: 'desc' },
    take: 300,
  });

  const total = messages.length;
  const successCount = messages.filter((m) => m.status === 'SUCCESS').length;
  const failedCount = messages.filter((m) => isFailedStatus(m.status)).length;
  const ignoredCount = messages.filter((m) => m.status === 'IGNORED').length;

  const uniqueUsers = new Set(messages.map((m) => m.externalUserId).filter(Boolean)).size;
  const activeConversations = new Set(messages.map((m) => m.externalConversationId).filter(Boolean))
    .size;

  const totalInputChars = messages.reduce((acc, m) => acc + m.inputChars, 0);
  const totalOutputChars = messages.reduce((acc, m) => acc + m.outputChars, 0);

  const structuredCount = messages.filter((m) => {
    if (!m.outboundText) return false;
    return (
      m.outboundText.includes('1.') ||
      m.outboundText.includes('- ') ||
      m.outboundText.includes('###')
    );
  }).length;

  const intentMap: Record<
    string,
    { label: string; count: number; sample: string; lastSeen: Date | null }
  > = {
    learning: { label: '学习路线与技能拆解', count: 0, sample: '', lastSeen: null },
    asset: { label: '资产规格与贴图规范', count: 0, sample: '', lastSeen: null },
    troubleshoot: { label: '故障排查与运行报错', count: 0, sample: '', lastSeen: null },
    workflow: { label: '工作流与团队协作', count: 0, sample: '', lastSeen: null },
    general: { label: '通用与灵感咨询', count: 0, sample: '', lastSeen: null },
  };

  messages.forEach((m) => {
    const text = m.inboundText.toLowerCase();
    let key = 'general';
    if (
      text.includes('学习') ||
      text.includes('拆解') ||
      text.includes('路线') ||
      text.includes('计划')
    ) {
      key = 'learning';
    } else if (
      text.includes('模型') ||
      text.includes('贴图') ||
      text.includes('面数') ||
      text.includes('资产')
    ) {
      key = 'asset';
    } else if (
      text.includes('报错') ||
      text.includes('失败') ||
      text.includes('错误') ||
      text.includes('卡顿')
    ) {
      key = 'troubleshoot';
    } else if (
      text.includes('任务') ||
      text.includes('站会') ||
      text.includes('协作') ||
      text.includes('进度')
    ) {
      key = 'workflow';
    }

    const item = intentMap[key];
    if (item) {
      item.count++;
      if (!item.sample) item.sample = m.inboundText;
      if (!item.lastSeen || m.createdAt > item.lastSeen) {
        item.lastSeen = m.createdAt;
      }
    }
  });

  const intentClusters: AiBotIntentCluster[] = Object.entries(intentMap)
    .filter(([, data]) => data.count > 0)
    .map(([key, data]) => ({
      key,
      label: data.label,
      count: data.count,
      sharePercent: clampPercent((data.count / Math.max(1, total)) * 100),
      sampleText: data.sample,
      lastSeenAt: data.lastSeen,
    }))
    .sort((a, b) => b.count - a.count);

  const knowledgeGaps: AiBotKnowledgeGap[] = [];
  const troubleshootData = intentMap.troubleshoot;
  if (troubleshootData && troubleshootData.count > 3) {
    knowledgeGaps.push({
      key: 'troubleshoot-gap',
      label: '高频故障与排查知识沉淀不足',
      count: troubleshootData.count,
      evidence: troubleshootData.sample || '用户多次提问系统报错或故障问题',
      action: '在知识库增加标准的排查 SOP 与常见报错列表。',
    });
  }
  const assetData = intentMap.asset;
  if (assetData && assetData.count > 3) {
    knowledgeGaps.push({
      key: 'asset-specs-gap',
      label: '资产规范回答依赖通用常识',
      count: assetData.count,
      evidence: assetData.sample || '用户询问模型与贴图规格限制',
      action: '添加项目或平台专属的导出规范与贴图限制文档。',
    });
  }

  const diagnostics = await buildAiBotDiagnostics(integration, entitlement);
  const riskWarnings: AiBotDiagnosticCheck[] = diagnostics.checks.filter(
    (c) => c.status !== 'pass',
  );

  const promptRecommendations: string[] = [];
  if (structuredCount / Math.max(1, total) < 0.4) {
    promptRecommendations.push(
      '在系统提示词中增加「使用分点列表和明确步骤输出」约束，提升回答可读性。',
    );
  }
  if (failedCount > 0) {
    promptRecommendations.push(
      '建议开启外发 Webhook 失败重试逻辑，并为第三方平台响应设置超时时间。',
    );
  }
  if (!integration.systemPrompt) {
    promptRecommendations.push('当前缺少专属 System Prompt，请从预置模板库套用专职身份。');
  }

  return {
    integrationId: integration.id,
    generatedAt: new Date(),
    rangeDays: days,
    summary: {
      messageCount: total,
      successRate: clampPercent((successCount / Math.max(1, total)) * 100),
      failureRate: clampPercent((failedCount / Math.max(1, total)) * 100),
      ignoredRate: clampPercent((ignoredCount / Math.max(1, total)) * 100),
      uniqueUsers,
      activeConversations,
      avgInputChars: Math.round(totalInputChars / Math.max(1, total)),
      avgOutputChars: Math.round(totalOutputChars / Math.max(1, total)),
      responseStructureRate: clampPercent((structuredCount / Math.max(1, total)) * 100),
      promptHealthScore: diagnostics.readinessScore,
    },
    intentClusters,
    riskWarnings,
    knowledgeGaps,
    promptRecommendations,
    sampleMessages: messages.slice(0, 10).map((m) => ({
      id: m.id,
      inboundText: m.inboundText,
      outboundText: m.outboundText,
      status: m.status,
      createdAt: m.createdAt,
    })),
  };
}
