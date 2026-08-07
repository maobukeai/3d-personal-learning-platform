import prisma from '../prisma';
import type { AiBotOperationsReport, AiBotOperationAction } from './types';
import { AI_BOT_MESSAGE_STATUS } from './bot-constants';
import { getAiBotAnalytics } from './bot-analytics.service';

const getActionStatus = (
  priority: AiBotOperationAction['priority'],
): AiBotOperationAction['status'] => {
  if (priority === 'critical') return 'blocked';
  if (priority === 'high') return 'attention';
  return 'ready';
};

const createOperationAction = (
  action: Omit<AiBotOperationAction, 'status'> & { status?: AiBotOperationAction['status'] },
): AiBotOperationAction => ({
  ...action,
  status: action.status || getActionStatus(action.priority),
});

export async function getAiBotOperationsReport(
  userId: string,
  daysValue: unknown,
): Promise<AiBotOperationsReport> {
  const [analytics, integrations, knowledgeSources] = await Promise.all([
    getAiBotAnalytics(userId, daysValue),
    prisma.aiBotIntegration.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.aiBotKnowledgeSource.findMany({
      where: { userId },
      select: {
        integrationId: true,
        status: true,
        tokenEstimate: true,
        updatedAt: true,
      },
    }),
  ]);

  const actions: AiBotOperationAction[] = [];
  const activeKnowledgeByIntegration = new Set(
    knowledgeSources
      .filter((source) => source.status === 'ACTIVE')
      .map((source) => source.integrationId),
  );

  if (!integrations.length) {
    actions.push(
      createOperationAction({
        id: 'create-first-integration',
        title: '创建第一个 AI 机器人接入',
        area: '接入',
        priority: 'critical',
        impact: '打开外部协作入口',
        effort: '10 分钟',
        description: '当前还没有任何机器人接入，外部平台无法调用网站 AI 能力。',
        cta: '新增接入并从模板工厂套用一个业务身份。',
      }),
    );
  }

  analytics.qualitySignals
    .filter((signal) => signal.level !== 'healthy')
    .slice(0, 5)
    .forEach((signal) => {
      actions.push(
        createOperationAction({
          id: `signal-${signal.key}`,
          title: signal.label,
          area:
            signal.key === 'security-coverage'
              ? '安全'
              : signal.key === 'quota-health'
                ? '成本'
                : signal.key === 'knowledge-coverage'
                  ? '知识库'
                  : '质量',
          priority: signal.level === 'critical' ? 'high' : 'medium',
          impact: `${signal.value}% 当前值`,
          effort: signal.level === 'critical' ? '30 分钟' : '15 分钟',
          description: signal.description,
          cta: signal.action,
        }),
      );
    });

  integrations
    .filter(
      (integration) =>
        integration.status === 'ACTIVE' && !activeKnowledgeByIntegration.has(integration.id),
    )
    .slice(0, 4)
    .forEach((integration) => {
      actions.push(
        createOperationAction({
          id: `knowledge-${integration.id}`,
          title: `为「${integration.name}」补充业务知识`,
          area: '知识库',
          priority: integration.systemPrompt?.trim() ? 'medium' : 'high',
          impact: '降低泛化回答',
          effort: '20 分钟',
          description: '该机器人已经启用，但没有启用中的知识源，回答会更依赖模型通用能力。',
          cta: '添加 FAQ、审核规范、学习路径或项目说明，并设为启用。',
          integrationId: integration.id,
          integrationName: integration.name,
        }),
      );
    });

  analytics.recentFailures.slice(0, 4).forEach((failure) => {
    actions.push(
      createOperationAction({
        id: `failure-${failure.id}`,
        title: `修复 ${failure.integrationName} 的失败消息`,
        area: '质量',
        priority: failure.status === AI_BOT_MESSAGE_STATUS.WEBHOOK_FAILED ? 'high' : 'medium',
        impact: '恢复回复投递',
        effort: '10 分钟',
        description: failure.error || failure.inboundText,
        cta: '进入接入日志重放消息，并检查 Webhook、模型或签名配置。',
        integrationId: failure.integrationId,
        integrationName: failure.integrationName,
      }),
    );
  });

  if (!actions.length) {
    actions.push(
      createOperationAction({
        id: 'keep-optimizing',
        title: '扩展更多业务场景',
        area: '增长',
        priority: 'low',
        status: 'done',
        impact: '提高站内 AI 覆盖',
        effort: '持续',
        description: '当前机器人接入状态健康，可以继续扩展学习辅导、资产审核或团队协作场景。',
        cta: '用沙盒模拟新的用户问题，并沉淀成模板或知识源。',
      }),
    );
  }

  const openActions = actions.filter((action) => action.status !== 'done').length;
  const criticalActions = actions.filter((action) => action.priority === 'critical').length;
  const healthySignals = analytics.qualitySignals.filter(
    (signal) => signal.level === 'healthy',
  ).length;

  return {
    generatedAt: new Date(),
    summary: {
      openActions,
      criticalActions,
      healthySignals,
      knowledgeSourceCount: knowledgeSources.length,
      activeKnowledgeSourceCount: knowledgeSources.filter((source) => source.status === 'ACTIVE')
        .length,
      projectedMonthlyMessages: Math.round(
        (analytics.summary.messageCount / Math.max(1, analytics.range.days)) * 30,
      ),
    },
    actions: actions.slice(0, 12),
    lanes: analytics.qualitySignals.slice(0, 7).map((signal) => ({
      key: signal.key,
      label: signal.label,
      value: signal.value,
      level: signal.level,
      description: signal.description,
    })),
  };
}
