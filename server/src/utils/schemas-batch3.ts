import { z } from 'zod';

// ============================================================================
// Batch 3 Zod Schemas — route-level validation for two-factor / ai-bot /
// banner / subscription / roadmap route files.
// Convention: validate REQUIRED fields strictly, leave optional fields permissive.
// ============================================================================

// --- Shared helpers ---
const optionalString = z.string().optional().nullable();
const permissiveAny = z.any().optional().nullable();

// --- Two-factor account schemas ---
export const twoFactorCreateAccountSchema = z.object({
  label: z.string().min(1, '请提供账号名称/标签'),
  secret: z.string().min(1, '请提供2FA密钥'),
  email: optionalString,
  note: optionalString,
  category: optionalString,
});

export const twoFactorImportAccountsSchema = z.object({
  accounts: z.array(z.any()).min(1, '无效的导入数据'),
});

export const twoFactorUpdateAccountSchema = z.object({
  label: z.string().min(1, '账号名称/标签不能为空'),
  email: optionalString,
  note: optionalString,
  category: optionalString,
});

// --- AI bot schemas ---
// External webhook callback — payload shape varies by platform, keep permissive.
export const aiBotCallbackSchema = z.any();

// Payload preview — whole body may be treated as payload, keep permissive.
export const aiBotPayloadPreviewSchema = z.any();

export const aiBotCreateIntegrationSchema = z.object({
  name: z.string().min(1, '请填写机器人名称'),
  platform: z.string().min(1, '请选择机器人平台'),
  webhookUrl: optionalString,
  secret: optionalString,
  triggerKeywords: permissiveAny,
  systemPrompt: optionalString,
  responseMode: z.string().optional(),
  aiModelId: optionalString,
  aiTemperature: permissiveAny,
  aiMaxTokens: permissiveAny,
  status: z.string().optional(),
});

export const aiBotUpdateIntegrationSchema = z.object({
  name: z.string().min(1, '请填写机器人名称').optional(),
  platform: z.string().min(1, '请选择机器人平台').optional(),
  webhookUrl: optionalString,
  secret: optionalString,
  clearWebhookUrl: permissiveAny,
  clearSecret: permissiveAny,
  triggerKeywords: permissiveAny,
  systemPrompt: optionalString,
  responseMode: z.string().optional(),
  aiModelId: optionalString,
  aiTemperature: permissiveAny,
  aiMaxTokens: permissiveAny,
  status: z.string().optional(),
});

export const aiBotCreateKnowledgeSourceSchema = z.object({
  title: z.string().min(1, '请填写知识源标题'),
  content: z.string().min(1, '知识源内容不能为空'),
  sourceType: z.string().optional(),
  status: z.string().optional(),
  visibility: z.string().optional(),
  url: optionalString,
  tags: permissiveAny,
  priority: permissiveAny,
});

export const aiBotUpdateKnowledgeSourceSchema = z.object({
  title: z.string().min(1, '请填写知识源标题').optional(),
  content: z.string().min(1, '知识源内容不能为空').optional(),
  sourceType: z.string().optional(),
  status: z.string().optional(),
  visibility: z.string().optional(),
  url: optionalString,
  tags: permissiveAny,
  priority: permissiveAny,
});

export const aiBotRunEvaluationSchema = z.object({
  cases: z.array(z.any()).min(1, '请至少提供一个评测用例'),
});

// All fields optional with defaults in controller — permissive.
export const aiBotOptimizePromptSchema = z.object({
  mission: z.string().optional(),
  audience: z.string().optional(),
  tone: z.string().optional(),
  outputFormat: z.string().optional(),
  constraints: z.string().optional(),
  examples: permissiveAny,
  guardrails: permissiveAny,
});

export const aiBotRunPlaygroundSchema = z.object({
  prompt: z.string().min(1, '请输入沙盒测试消息'),
  externalUserId: z.string().optional(),
  externalConversationId: z.string().optional(),
});

// prompt has a default in controller — permissive.
export const aiBotTestIntegrationSchema = z.object({
  prompt: z.string().optional(),
});

// --- Subscription schemas ---
export const redeemActivationCodeSchema = z.object({
  code: z.string().min(1, '请输入有效的激活码'),
});

// immediate / twoFactorCode / password are conditionally required — permissive.
export const cancelSubscriptionSchema = z.object({
  immediate: permissiveAny,
  twoFactorCode: optionalString,
  password: optionalString,
});

export const cancelSubscriptionWith2FASchema = z.object({
  immediate: permissiveAny,
  twoFactorCode: optionalString,
});

export const toggleAutoRenewSchema = z.object({
  autoRenew: z.boolean(),
});

// --- Roadmap schemas ---
export const roadmapStepProgressSchema = z.object({
  stepId: z.string().min(1, '步骤 ID 不能为空'),
  completed: z.boolean(),
});

export const createRoadmapSchema = z.object({
  title: z.string().min(1, '标题是必填项'),
  description: z.string().optional(),
  steps: z.array(z.any()).optional(),
});

export const updateRoadmapSchema = z.object({
  title: z.string().min(1, '标题是必填项'),
  description: z.string().optional(),
  steps: z.array(z.any()).optional(),
});
