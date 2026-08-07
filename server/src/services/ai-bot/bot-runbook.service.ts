import type { AiBotIntegration } from '@prisma/client';
import {
  type AiBotIntegrationRunbook,
  type AiBotEntitlement,
  type AiBotCommandSample,
  type AiBotRunbookItem,
} from './types';
import { parseStoredKeywords } from './bot-entitlement.service';
import { summarizeKnowledgeSources } from './bot-knowledge.service';
import { buildAiBotDiagnostics } from './bot-diagnostics.service';

export async function buildAiBotIntegrationRunbook(
  integration: AiBotIntegration,
  entitlement: AiBotEntitlement,
  siteUrl: string,
): Promise<AiBotIntegrationRunbook> {
  const [diagnostics, knowledgeSummary] = await Promise.all([
    buildAiBotDiagnostics(integration, entitlement),
    summarizeKnowledgeSources(integration.userId, integration.id),
  ]);

  const siteOrigin = siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`;
  const keywords = parseStoredKeywords(integration.triggerKeywords);
  const sampleKeyword = keywords[0] || '@AI';

  const checklist: AiBotRunbookItem[] = diagnostics.checks.map((check) => ({
    id: check.id,
    label: check.label,
    status: check.status,
    detail: check.detail,
    action: check.action,
  }));

  const rolloutPlan: AiBotRunbookItem[] = [
    {
      id: 'rollout-sandbox',
      label: '阶段 1：本地 / 沙盒联调',
      status: 'pass',
      detail: '先用网页端调试沙盒跑通问答逻辑与结构化验证。',
      action: '在仪表盘调试沙盒投递测试问答，修正提示词。',
    },
    {
      id: 'rollout-webhook',
      label: '阶段 2：网关与 Webhook 配置',
      status: integration.webhookUrl ? 'pass' : 'warn',
      detail: integration.webhookUrl
        ? '在客户端平台配置外发 API Endpoint。'
        : '主动推送必须补充外发 Webhook URL。',
      action: '把平台生成的回调地址和 Secret 填回第三地方。',
    },
    {
      id: 'rollout-canary',
      label: '阶段 3：受控小范围上线',
      status: keywords.length ? 'pass' : 'warn',
      detail: keywords.length
        ? '限定特定触发词（如 @AI）和小范围测试群。'
        : '未设置触发词，建议设置后小范围验证。',
      action: '指定测试群观察 1 天日志无报错后再公开。',
    },
    {
      id: 'rollout-full',
      label: '阶段 4：全面对外服务',
      status: integration.status === 'ACTIVE' ? 'pass' : 'fail',
      detail: '接入全量接入，持续在洞察大盘监控健康度。',
      action: '定期查看质检信号与未命中知识点。',
    },
  ];

  const testMatrix: AiBotRunbookItem[] = [
    {
      id: 'test-ping',
      label: '连通性测试',
      status: 'pass',
      detail: '校验回调 Endpoint 能否在 200ms 内成功响应。',
      action: '在沙盒发送健康测试问答。',
    },
    {
      id: 'test-trigger',
      label: '触发词校验',
      status: keywords.length ? 'pass' : 'warn',
      detail: `带「${sampleKeyword}」时触发，不带时优雅忽略或跳过。`,
      action: '分别在含/不含触发词场景投递消息测试。',
    },
    {
      id: 'test-rag',
      label: '知识库检索测试',
      status: knowledgeSummary.activeCount > 0 ? 'pass' : 'warn',
      detail: '用户提问涉及知识库内容时优先使用上下文回答。',
      action: '在沙盒问一个只有知识库拥有的专有名词。',
    },
    {
      id: 'test-boundary',
      label: '安全边界测试',
      status: integration.systemPrompt ? 'pass' : 'warn',
      detail: '面对诱导提问（如「忽略之前规则」）时拒绝越权。',
      action: '测试防越狱和隐私越权提示。',
    },
  ];

  const commandSamples: AiBotCommandSample[] = [
    {
      id: 'cmd-curl-inbound',
      label: '模拟平台向网站发送消息 (cURL)',
      language: 'bash',
      command: [
        `curl -X POST "${siteOrigin}/api/fastify/ai-bots/integrations/${integration.id}/webhook" \\`,
        '  -H "Content-Type: application/json" \\',
        ...(integration.secret ? [`  -H "X-Ai-Bot-Secret: ${integration.secret}" \\`] : []),
        "  -d '{",
        `    "text": "${sampleKeyword} 请帮我拆解 3D 渲染优化的步骤",`,
        '    "externalUserId": "dev_user_001",',
        '    "externalConversationId": "conv_test_888"',
        "  }'",
      ].join('\n'),
    },
    {
      id: 'cmd-webhook-payload',
      label: '网站异步外发给第三方平台的数据格式',
      language: 'json',
      command: JSON.stringify(
        {
          integrationId: integration.id,
          platform: integration.platform,
          text: 'AI 自动生成的回复内容...',
          inboundText: `${sampleKeyword} 请帮我拆解 3D 渲染优化的步骤`,
          externalUserId: 'dev_user_001',
          externalConversationId: 'conv_test_888',
          deliveredAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    },
  ];

  const guardrails = [
    '永远不要在对话中输出服务器密钥、数据库连接串或内部 Auth Token。',
    '遇到涉及账号修改、支付或退款的问题，提示联系人工官方客服。',
    '确保在客户端平台（钉钉/飞书/企微）中设置了合理的接口频率上限。',
    '定期清理失效知识库，避免过期政策干扰 AI 生成结果。',
  ];

  return {
    integrationId: integration.id,
    generatedAt: new Date(),
    readinessScore: diagnostics.readinessScore,
    checklist,
    knowledgeSummary,
    rolloutPlan,
    testMatrix,
    commandSamples,
    guardrails,
  };
}
