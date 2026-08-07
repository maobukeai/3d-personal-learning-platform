import type { AiBotIntegration } from '@prisma/client';
import prisma from '../prisma';
import { type AiBotDiagnostics, type AiBotDiagnosticCheck, type AiBotEntitlement } from './types';
import { parseStoredKeywords } from './bot-entitlement.service';
import { clampPercent } from './bot-knowledge.service';
import { getAiBotModelSummary, isFailedStatus } from './bot-analytics.service';

export async function buildAiBotDiagnostics(
  integration: AiBotIntegration,
  entitlement: AiBotEntitlement,
): Promise<AiBotDiagnostics> {
  const since = new Date();
  since.setDate(since.getDate() - 7);

  const [recentMessages, knowledgeSources] = await Promise.all([
    prisma.aiBotMessage.findMany({
      where: {
        userId: integration.userId,
        integrationId: integration.id,
        createdAt: {
          gte: since,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.aiBotKnowledgeSource.findMany({
      where: {
        userId: integration.userId,
        integrationId: integration.id,
      },
      select: {
        status: true,
        tokenEstimate: true,
        updatedAt: true,
      },
    }),
  ]);

  const failedMessages = recentMessages.filter((message) => isFailedStatus(message.status));
  const selectedModel = await getAiBotModelSummary(integration.aiModelId);
  const modelMissing = Boolean(integration.aiModelId && !selectedModel);
  const checks: AiBotDiagnosticCheck[] = [
    {
      id: 'plan',
      label: '会员权限',
      status: entitlement.enabled ? 'pass' : 'fail',
      detail: entitlement.enabled
        ? `${entitlement.currentPlanName} 已开放 AI 机器人能力`
        : `当前需要 ${entitlement.requiredPlanName} 及以上会员`,
      action: entitlement.enabled ? '权限正常' : '升级会员后再启用机器人接入',
    },
    {
      id: 'quota',
      label: '今日配额',
      status:
        entitlement.dailyMessages <= 0 || entitlement.dailyMessageCount >= entitlement.dailyMessages
          ? 'fail'
          : entitlement.dailyMessageCount / entitlement.dailyMessages > 0.8
            ? 'warn'
            : 'pass',
      detail: `今日已使用 ${entitlement.dailyMessageCount}/${entitlement.dailyMessages} 次`,
      action: '高峰期前关注配额，测试流量建议走沙盒。',
    },
    {
      id: 'status',
      label: '接入状态',
      status: integration.status === 'ACTIVE' ? 'pass' : 'fail',
      detail: integration.status === 'ACTIVE' ? '当前接入已启用' : '当前接入处于暂停状态',
      action: integration.status === 'ACTIVE' ? '状态正常' : '在配置中切换为启用。',
    },
    {
      id: 'ai-model',
      label: 'AI 模型',
      status: modelMissing ? 'fail' : integration.aiModelId ? 'pass' : 'warn',
      detail: modelMissing
        ? '指定模型已停用或不存在'
        : selectedModel
          ? `${integration.aiModelId ? '已指定' : '跟随默认'}：${selectedModel.name} / ${selectedModel.modelName}`
          : '系统后台暂无可用 AI 模型',
      action: modelMissing
        ? '重新选择一个启用中的 AI 模型。'
        : integration.aiModelId
          ? '模型配置正常'
          : '建议为高频机器人明确指定模型，避免全局默认切换影响回复风格。',
    },
    {
      id: 'prompt',
      label: '系统提示词',
      status: integration.systemPrompt?.trim() ? 'pass' : 'warn',
      detail: integration.systemPrompt?.trim()
        ? '已配置业务身份和回复边界'
        : '未配置专属提示词，回复会使用通用默认身份',
      action: '从模板库套用身份，再补充团队自己的业务规则。',
    },
    {
      id: 'knowledge',
      label: '知识库',
      status: knowledgeSources.some((source) => source.status === 'ACTIVE')
        ? 'pass'
        : knowledgeSources.length
          ? 'warn'
          : 'warn',
      detail: knowledgeSources.some((source) => source.status === 'ACTIVE')
        ? `已启用 ${knowledgeSources.filter((source) => source.status === 'ACTIVE').length} 条知识源`
        : knowledgeSources.length
          ? '已有知识源但尚未启用，AI 回复不会参考这些资料'
          : '尚未配置知识源，AI 更容易给出通用回答',
      action: '为机器人补充 FAQ、平台规则、项目资料或客服口径，并保持启用状态。',
    },
    {
      id: 'trigger',
      label: '触发关键词',
      status: parseStoredKeywords(integration.triggerKeywords).length > 0 ? 'pass' : 'warn',
      detail:
        parseStoredKeywords(integration.triggerKeywords).length > 0
          ? `已配置 ${parseStoredKeywords(integration.triggerKeywords).length} 个触发词`
          : '未设置触发词，群聊中任何文本都可能触发回复',
      action: '建议使用 @AI、/ai 或明确业务关键词。',
    },
    {
      id: 'webhook',
      label: '外发 Webhook',
      status:
        integration.webhookUrl || integration.responseMode === 'CALLBACK_ONLY'
          ? 'pass'
          : integration.responseMode === 'BACKGROUND_WEBHOOK'
            ? 'fail'
            : 'warn',
      detail: integration.webhookUrl
        ? '已配置主动推送通道'
        : integration.responseMode === 'BACKGROUND_WEBHOOK'
          ? '后台运行模式未配置外发 Webhook，生成结果只能留在网站日志中'
          : integration.responseMode === 'CALLBACK_ONLY'
            ? '仅回调响应模式不需要外发 Webhook'
            : '未配置外发 Webhook，将只在本次回调中返回 AI 回复',
      action:
        integration.webhookUrl || integration.responseMode === 'CALLBACK_ONLY'
          ? '外发模式配置正常。'
          : '如需主动推送到群聊，请补齐平台 Webhook。',
    },
    {
      id: 'secret',
      label: '签名密钥',
      status: integration.secret ? 'pass' : 'warn',
      detail: integration.secret ? '已启用签名或密钥校验' : '未配置密钥，公网回调防护较弱',
      action: '生产环境建议配置平台签名密钥。',
    },
    {
      id: 'recent-failures',
      label: '近 7 天失败',
      status: failedMessages.length > 3 ? 'fail' : failedMessages.length > 0 ? 'warn' : 'pass',
      detail: `近 7 天发现 ${failedMessages.length} 条失败或发送失败消息`,
      action: '查看最近失败详情，优先修复重复出现的问题。',
    },
  ];

  const score = clampPercent(
    checks.reduce((total, check) => {
      if (check.status === 'pass') return total + 100;
      if (check.status === 'warn') return total + 55;
      return total;
    }, 0) / checks.length,
  );
  const integrationNames = new Map([[integration.id, integration.name]]);
  const recentFailures = failedMessages.slice(0, 6).map((message) => ({
    id: message.id,
    integrationId: message.integrationId,
    integrationName: integrationNames.get(message.integrationId) || '未知接入',
    platform: message.platform,
    status: message.status,
    error: message.error,
    inboundText: message.inboundText.slice(0, 220),
    createdAt: message.createdAt,
  }));
  const recommendedActions = checks
    .filter((check) => check.status !== 'pass')
    .slice(0, 5)
    .map((check) => check.action);

  if (!recommendedActions.length) {
    recommendedActions.push('配置健康，可以继续用沙盒模拟复杂场景。');
  }

  return {
    integrationId: integration.id,
    generatedAt: new Date(),
    readinessScore: score,
    checks,
    recentFailures,
    recommendedActions,
  };
}
