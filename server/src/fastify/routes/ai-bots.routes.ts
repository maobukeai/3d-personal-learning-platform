import type { FastifyInstance, FastifyRequest } from 'fastify';
import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '../../services/prisma';
import { AppError } from '../../utils/error';
import { config } from '../../config/env';
import { encryptSecret } from '../../utils/secret-field';
import { normalizeWebhookUrl } from '../../utils/webhook-url';
import { fastifyAuthenticate } from '../auth/fastify-auth';
import {
  AI_BOT_BACKGROUND_RESPONSE_MODE,
  AI_BOT_MESSAGE_STATUS,
  AI_BOT_RESPONSE_MODE,
  assertCanCreateAiBot,
  assertCanUseAiBot,
  buildAiBotDiagnostics,
  buildAiBotIntegrationRunbook,
  buildPlatformCallbackResponse,
  buildAiBotEvolutionInsights,
  createAiBotKnowledgeSource,
  deleteAiBotKnowledgeSource,
  evaluateAiBotIntegration,
  extractIncomingAiBotMessage,
  getAiBotAnalytics,
  getAiBotEntitlement,
  getAiBotModelOptions,
  getAiBotModelSummary,
  getAiBotOperationsReport,
  getAiBotPlatformLabel,
  getAiBotPromptTemplates,
  getDecryptedAiBotSecret,
  handleAiBotMessage,
  listAiBotKnowledgeSources,
  maskWebhookUrl,
  normalizeAiBotPlatform,
  parseKeywords,
  parseStoredKeywords,
  queueAiBotMessage,
  optimizeAiBotPrompt,
  runAiBotPlayground,
  shouldAnswerMessage,
  updateAiBotKnowledgeSource,
} from '../../services/ai-bot.service';
import {
  aiBotCallbackSchema,
  aiBotCreateIntegrationSchema,
  aiBotCreateKnowledgeSourceSchema,
  aiBotOptimizePromptSchema,
  aiBotPayloadPreviewSchema,
  aiBotRunEvaluationSchema,
  aiBotRunPlaygroundSchema,
  aiBotTestIntegrationSchema,
  aiBotUpdateIntegrationSchema,
  aiBotUpdateKnowledgeSourceSchema,
} from '../../utils/schemas-batch3';

/**
 * Fastify AI 机器人路由（铁律六·1 渐进式迁移）。
 *
 * 挂载前缀: /api/fastify/ai-bots
 *
 * 业务逻辑（含 toPublicIntegration / buildCreateData / 回调签名校验等）从 Express
 * ai-bot.controller.ts 移植而来，仅适配 Fastify request/reply 签名；复用同款
 * ai-bot.service / prisma / encryptSecret 等共享模块。
 */

type AnyRecord = Record<string, unknown>;
type PublicModelOption = Awaited<ReturnType<typeof getAiBotModelOptions>>[number];

const MAX_NAME_LENGTH = 60;
const MAX_SYSTEM_PROMPT_LENGTH = 2000;
const MAX_TEST_PROMPT_LENGTH = 2000;
const MAX_PLAYGROUND_PROMPT_LENGTH = 4000;
const MAX_AI_MODEL_ID_LENGTH = 120;
const MAX_EVALUATION_CASES = 6;
const MAX_OPTIMIZATION_FIELD_LENGTH = 1600;
const RESPONSE_MODES = new Set<string>(Object.values(AI_BOT_RESPONSE_MODE));
const MESSAGE_STATUSES = new Set<string>(Object.values(AI_BOT_MESSAGE_STATUS));

const asRecord = (value: unknown): AnyRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as AnyRecord) : {};

const hasOwn = (record: AnyRecord, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(record, key);

const normalizeOptionalText = (value: unknown, maxLength: number): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
};

const normalizeName = (value: unknown): string => {
  const name = normalizeOptionalText(value, MAX_NAME_LENGTH);
  if (!name) {
    throw new AppError('请填写机器人名称', 400, 'AI_BOT_NAME_REQUIRED');
  }
  return name;
};

const normalizeStatus = (value: unknown): string => {
  const status = String(value || 'ACTIVE')
    .trim()
    .toUpperCase();
  return status === 'PAUSED' ? 'PAUSED' : 'ACTIVE';
};

const normalizeResponseMode = (value: unknown): string => {
  const mode = String(value || AI_BOT_RESPONSE_MODE.CALLBACK_AND_WEBHOOK)
    .trim()
    .toUpperCase();
  return RESPONSE_MODES.has(mode) ? mode : AI_BOT_RESPONSE_MODE.CALLBACK_AND_WEBHOOK;
};

const normalizeAiModelId = (value: unknown): string | null => {
  const modelId = normalizeOptionalText(value, MAX_AI_MODEL_ID_LENGTH);
  if (!modelId || modelId === 'default' || modelId === '__DEFAULT__') return null;
  return modelId;
};

const normalizeOptionalNumber = (
  value: unknown,
  options: { min: number; max: number; precision?: number },
): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const clamped = Math.min(options.max, Math.max(options.min, parsed));
  const precision = options.precision ?? 0;
  return Number(clamped.toFixed(precision));
};

const normalizeMessageStatusFilter = (value: unknown): string => {
  if (typeof value !== 'string' || value === 'ALL') return '';
  const status = value.trim().toUpperCase();
  if (!status) return '';
  if (!MESSAGE_STATUSES.has(status)) {
    throw new AppError('不支持的消息状态筛选', 400, 'AI_BOT_MESSAGE_STATUS_UNSUPPORTED');
  }
  return status;
};

const normalizeTextArray = (
  value: unknown,
  options: { maxItems?: number; maxLength?: number } = {},
): string[] => {
  const maxItems = options.maxItems ?? 8;
  const maxLength = options.maxLength ?? 80;
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .slice(0, maxItems)
      .map((item) => item.slice(0, maxLength));
  }
  return parseKeywords(value)
    .slice(0, maxItems)
    .map((item) => item.slice(0, maxLength));
};

const normalizeEvaluationCases = (value: unknown) => {
  const rawCases = Array.isArray(value) ? value : [];
  return rawCases
    .map((item, index) => {
      const record = asRecord(item);
      const prompt = normalizeOptionalText(record.prompt, MAX_PLAYGROUND_PROMPT_LENGTH);
      if (!prompt) return null;
      return {
        id: normalizeOptionalText(record.id, 80) || `case-${index + 1}`,
        name: normalizeOptionalText(record.name, 80) || `评测用例 ${index + 1}`,
        prompt,
        expectedKeywords: normalizeTextArray(record.expectedKeywords, {
          maxItems: 8,
          maxLength: 40,
        }),
        mustAvoid: normalizeTextArray(record.mustAvoid, { maxItems: 8, maxLength: 40 }),
        externalUserId: normalizeOptionalText(record.externalUserId, 120) || 'evaluation-user',
        externalConversationId:
          normalizeOptionalText(record.externalConversationId, 120) || 'evaluation-lab',
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .slice(0, MAX_EVALUATION_CASES);
};

const normalizePromptOptimizationInput = (body: AnyRecord) => ({
  mission:
    normalizeOptionalText(body.mission, MAX_OPTIMIZATION_FIELD_LENGTH) ||
    '把网站 AI 能力接入外部协作平台，稳定回答学习、资产、团队协作和支持问题。',
  audience:
    normalizeOptionalText(body.audience, 300) || '3D 学习平台用户、创作者、团队成员和管理员',
  tone: normalizeOptionalText(body.tone, 160) || '专业、清晰、克制、可执行',
  outputFormat: normalizeOptionalText(body.outputFormat, 300) || '结论 / 步骤 / 风险 / 下一步',
  constraints:
    normalizeOptionalText(body.constraints, MAX_OPTIMIZATION_FIELD_LENGTH) ||
    '不编造平台数据；无法确认时先追问；账号、支付、隐私和安全问题升级人工。',
  examples: normalizeTextArray(body.examples, { maxItems: 8, maxLength: 280 }),
  guardrails: normalizeTextArray(body.guardrails, { maxItems: 8, maxLength: 280 }),
});

const createPublicToken = () => crypto.randomBytes(24).toString('base64url');

const getBackendBaseUrl = (): string => config.BACKEND_URL.replace(/\/+$/, '');

const toPublicIntegration = (
  integration: {
    id: string;
    name: string;
    platform: string;
    status: string;
    webhookUrl: string | null;
    secret: string | null;
    publicToken: string;
    triggerKeywords: string | null;
    systemPrompt: string | null;
    responseMode: string;
    aiModelId: string | null;
    aiTemperature: number | null;
    aiMaxTokens: number | null;
    lastUsedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  },
  modelOptions: PublicModelOption[] = [],
) => {
  const selectedModel = integration.aiModelId
    ? modelOptions.find((model) => model.id === integration.aiModelId) || null
    : modelOptions.find((model) => model.isDefault) || modelOptions[0] || null;

  return {
    id: integration.id,
    name: integration.name,
    platform: integration.platform,
    platformLabel: getAiBotPlatformLabel(integration.platform),
    status: integration.status,
    hasWebhookUrl: Boolean(integration.webhookUrl),
    webhookUrlMasked: maskWebhookUrl(integration.webhookUrl),
    hasSecret: Boolean(integration.secret),
    publicToken: integration.publicToken,
    callbackPath: `/api/ai-bots/callback/${integration.publicToken}`,
    callbackUrl: `${getBackendBaseUrl()}/api/ai-bots/callback/${integration.publicToken}`,
    triggerKeywords: parseStoredKeywords(integration.triggerKeywords),
    systemPrompt: integration.systemPrompt,
    responseMode: integration.responseMode,
    aiModelId: integration.aiModelId,
    aiModelLabel: selectedModel
      ? integration.aiModelId
        ? selectedModel.name
        : `跟随系统默认 · ${selectedModel.name}`
      : integration.aiModelId
        ? '指定模型不可用'
        : '跟随系统默认',
    aiModelProvider: selectedModel?.provider || null,
    aiModelName: selectedModel?.modelName || null,
    aiTemperature: integration.aiTemperature,
    aiMaxTokens: integration.aiMaxTokens,
    lastUsedAt: integration.lastUsedAt,
    createdAt: integration.createdAt,
    updatedAt: integration.updatedAt,
  };
};

const buildCreateData = async (
  userId: string,
  body: AnyRecord,
): Promise<Prisma.AiBotIntegrationUncheckedCreateInput> => {
  const platform = normalizeAiBotPlatform(body.platform);
  const name = normalizeName(body.name);
  const webhookUrl = await normalizeWebhookUrl(body.webhookUrl);
  const secret = normalizeOptionalText(body.secret, 500);
  const keywords = parseKeywords(body.triggerKeywords);
  const systemPrompt = normalizeOptionalText(body.systemPrompt, MAX_SYSTEM_PROMPT_LENGTH);
  const aiTemperature = normalizeOptionalNumber(body.aiTemperature, {
    min: 0,
    max: 2,
    precision: 2,
  });
  const aiMaxTokens = normalizeOptionalNumber(body.aiMaxTokens, { min: 256, max: 32768 });

  return {
    userId,
    name,
    platform,
    status: normalizeStatus(body.status),
    webhookUrl: webhookUrl ? encryptSecret(webhookUrl) : null,
    secret: secret ? encryptSecret(secret) : null,
    publicToken: createPublicToken(),
    triggerKeywords: keywords.length ? JSON.stringify(keywords) : null,
    systemPrompt,
    responseMode: normalizeResponseMode(body.responseMode),
    aiModelId: normalizeAiModelId(body.aiModelId),
    aiTemperature,
    aiMaxTokens,
  };
};

const buildUpdateData = async (
  body: AnyRecord,
): Promise<Prisma.AiBotIntegrationUncheckedUpdateInput> => {
  const data: Prisma.AiBotIntegrationUncheckedUpdateInput = {};

  if (hasOwn(body, 'name')) {
    data.name = normalizeName(body.name);
  }
  if (hasOwn(body, 'platform')) {
    data.platform = normalizeAiBotPlatform(body.platform);
  }
  if (hasOwn(body, 'status')) {
    data.status = normalizeStatus(body.status);
  }
  if (hasOwn(body, 'triggerKeywords')) {
    const keywords = parseKeywords(body.triggerKeywords);
    data.triggerKeywords = keywords.length ? JSON.stringify(keywords) : null;
  }
  if (hasOwn(body, 'systemPrompt')) {
    data.systemPrompt = normalizeOptionalText(body.systemPrompt, MAX_SYSTEM_PROMPT_LENGTH);
  }
  if (hasOwn(body, 'responseMode')) {
    data.responseMode = normalizeResponseMode(body.responseMode);
  }
  if (hasOwn(body, 'aiModelId')) {
    data.aiModelId = normalizeAiModelId(body.aiModelId);
  }
  if (hasOwn(body, 'aiTemperature')) {
    data.aiTemperature = normalizeOptionalNumber(body.aiTemperature, {
      min: 0,
      max: 2,
      precision: 2,
    });
  }
  if (hasOwn(body, 'aiMaxTokens')) {
    data.aiMaxTokens = normalizeOptionalNumber(body.aiMaxTokens, { min: 256, max: 32768 });
  }
  if (hasOwn(body, 'clearWebhookUrl') && body.clearWebhookUrl === true) {
    data.webhookUrl = null;
  } else if (hasOwn(body, 'webhookUrl')) {
    const webhookUrl = await normalizeWebhookUrl(body.webhookUrl);
    if (webhookUrl) {
      data.webhookUrl = encryptSecret(webhookUrl);
    }
  }
  if (hasOwn(body, 'clearSecret') && body.clearSecret === true) {
    data.secret = null;
  } else if (hasOwn(body, 'secret')) {
    const secret = normalizeOptionalText(body.secret, 500);
    if (secret) {
      data.secret = encryptSecret(secret);
    }
  }

  return data;
};

const getOwnedIntegration = async (id: string, userId: string) => {
  const integration = await prisma.aiBotIntegration.findFirst({
    where: { id, userId },
  });
  if (!integration) {
    throw new AppError('未找到指定机器人接入，或无权访问', 404, 'AI_BOT_NOT_FOUND');
  }
  return integration;
};

const assertAiModelAvailable = async (modelId: string | null) => {
  if (!modelId) return;
  const model = await getAiBotModelSummary(modelId);
  if (!model) {
    throw new AppError(
      '指定的 AI 模型不存在、未启用或不支持文本对话',
      400,
      'AI_BOT_MODEL_UNAVAILABLE',
    );
  }
};

const requireUserId = (request: FastifyRequest): string => {
  if (!request.userId) {
    throw new AppError('登录会话已过期，请重新登录', 401, 'UNAUTHORIZED');
  }
  return request.userId;
};

// ---------------------------------------------------------------------------
// Callback verification helpers（从 ai-bot.controller.ts 移植，适配 Fastify request）
// ---------------------------------------------------------------------------

const getHeader = (request: FastifyRequest, name: string): string => {
  const value = request.headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0] || '';
  return typeof value === 'string' ? value : '';
};

const getStringFromRequest = (request: FastifyRequest, name: string): string => {
  const header = getHeader(request, name);
  if (header) return header.trim();
  const queryValue = (request.query as Record<string, unknown>)[name];
  if (typeof queryValue === 'string') return queryValue.trim();
  const body = asRecord(request.body);
  const bodyValue = body[name];
  return typeof bodyValue === 'string' ? bodyValue.trim() : '';
};

const getCallbackChallenge = (request: FastifyRequest): string => {
  const body = asRecord(request.body);
  const query = request.query as Record<string, unknown>;
  const candidates = [body.challenge, body.echostr, query.challenge, query.echostr];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim().slice(0, 2000);
    }
  }
  return '';
};

const safeEqual = (a: string, b: string): boolean => {
  try {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    return left.length === right.length && crypto.timingSafeEqual(left, right);
  } catch (_error) {
    return false;
  }
};

const normalizeSign = (value: string): string => {
  try {
    return decodeURIComponent(value).replace(/ /g, '+');
  } catch (_error) {
    return value.replace(/ /g, '+');
  }
};

const isFreshTimestamp = (timestamp: string): boolean => {
  const raw = Number(timestamp);
  if (!Number.isFinite(raw)) return false;
  const millis = raw > 10_000_000_000 ? raw : raw * 1000;
  return Math.abs(Date.now() - millis) <= 5 * 60 * 1000;
};

const getRawCallbackBody = (request: FastifyRequest): Buffer => {
  // Fastify 不保留 raw body（与 Express verify 钩子不同），退化为 JSON.stringify
  // 重建——与 Express getRawCallbackBody 在 rawBody 缺失时的兜底分支一致。
  return Buffer.from(JSON.stringify(request.body ?? {}));
};

const getSignatureHeader = (request: FastifyRequest): string =>
  getHeader(request, 'x-ai-bot-signature') ||
  getHeader(request, 'x-hub-signature-256') ||
  getHeader(request, 'x-signature') ||
  getHeader(request, 'x-bot-signature');

const hmacSignatureMatches = (signature: string, secret: string, payload: Buffer): boolean => {
  const normalized = normalizeSign(signature).trim();
  const withoutPrefix = normalized.replace(/^sha256=/i, '');
  const hexDigest = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const base64Digest = crypto.createHmac('sha256', secret).update(payload).digest('base64');

  return (
    safeEqual(withoutPrefix.toLowerCase(), hexDigest) ||
    safeEqual(normalized.toLowerCase(), `sha256=${hexDigest}`) ||
    safeEqual(normalized, base64Digest)
  );
};

const verifyBodyHmacSignature = (request: FastifyRequest, secret: string): boolean => {
  const signature = getSignatureHeader(request);
  if (!signature) return false;

  const timestamp =
    getHeader(request, 'x-ai-bot-timestamp') ||
    getHeader(request, 'x-timestamp') ||
    getStringFromRequest(request, 'timestamp') ||
    '';
  if (timestamp && !isFreshTimestamp(timestamp)) return false;

  const body = getRawCallbackBody(request);
  const payloads = timestamp
    ? [
        Buffer.concat([Buffer.from(`${timestamp}.`), body]),
        Buffer.concat([Buffer.from(`${timestamp}\n`), body]),
        body,
      ]
    : [body];

  return payloads.some((payload) => hmacSignatureMatches(signature, secret, payload));
};

const verifyCallbackSecret = (request: FastifyRequest, secret: string): boolean => {
  const body = asRecord(request.body);
  const query = request.query as Record<string, unknown>;
  const directCandidates = [
    getHeader(request, 'x-ai-bot-secret'),
    getHeader(request, 'x-bot-secret'),
    typeof query.secret === 'string' ? query.secret : '',
    typeof body.secret === 'string' ? (body.secret as string) : '',
  ].filter(Boolean) as string[];

  if (directCandidates.some((candidate) => safeEqual(candidate.trim(), secret))) {
    return true;
  }

  if (verifyBodyHmacSignature(request, secret)) {
    return true;
  }

  const timestamp =
    getStringFromRequest(request, 'timestamp') ||
    getHeader(request, 'x-dingtalk-timestamp') ||
    getHeader(request, 'x-feishu-timestamp') ||
    '';
  const sign =
    getStringFromRequest(request, 'sign') ||
    getHeader(request, 'x-dingtalk-sign') ||
    getHeader(request, 'x-feishu-signature') ||
    '';

  if (!timestamp || !sign || !isFreshTimestamp(timestamp)) {
    return false;
  }

  const normalizedSign = normalizeSign(sign);
  const dingTalkSign = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}\n${secret}`)
    .digest('base64');
  const feishuSign = crypto
    .createHmac('sha256', `${timestamp}\n${secret}`)
    .update('')
    .digest('base64');

  return safeEqual(normalizedSign, dingTalkSign) || safeEqual(normalizedSign, feishuSign);
};

// --- Zod schemas ---

const tokenParamsSchema = z.object({ token: z.string().min(1) });
const idParamsSchema = z.object({ id: z.string().min(1) });
const knowledgeSourceParamsSchema = z.object({
  id: z.string().min(1),
  sourceId: z.string().min(1),
});
const messageParamsSchema = z.object({ id: z.string().min(1), messageId: z.string().min(1) });

const listMessagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(80).default(20),
  status: z.string().optional(),
  q: z.string().optional(),
});

const daysQuerySchema = z.object({
  days: z.union([z.coerce.number().int().min(1).max(365), z.string()]).optional(),
});

const CALLBACK_RATE_LIMIT = { max: 30, timeWindow: '1 minute' };

export const registerAiBotRoutes = (app: FastifyInstance): void => {
  // ---------- Public callback endpoints（无鉴权） ----------

  // GET /callback/:token —— 平台回调地址校验（challenge/echostr 回显）
  app.get(
    '/callback/:token',
    {
      config: { rateLimit: CALLBACK_RATE_LIMIT },
      schema: { params: tokenParamsSchema },
    },
    async (request, reply) => {
      const { token } = request.params as { token: string };
      const integration = await prisma.aiBotIntegration.findUnique({
        where: { publicToken: token },
      });

      if (!integration || integration.status !== 'ACTIVE') {
        throw new AppError('机器人接入不存在或已暂停', 404, 'AI_BOT_CALLBACK_DISABLED');
      }

      const challenge = getCallbackChallenge(request);
      if (challenge) {
        const body = asRecord(request.body);
        const query = request.query as Record<string, unknown>;
        if (typeof query.echostr === 'string' || typeof body.echostr === 'string') {
          return reply.type('text/plain').send(challenge);
        }
        return reply.send({ challenge });
      }

      return reply.send({
        success: true,
        status: integration.status,
        message: 'AI 机器人回调地址可访问',
      });
    },
  );

  // POST /callback/:token —— 平台消息回调（HMAC 签名校验 + 消息分发）
  app.post(
    '/callback/:token',
    {
      config: { rateLimit: CALLBACK_RATE_LIMIT },
      schema: { params: tokenParamsSchema, body: aiBotCallbackSchema },
    },
    async (request, reply) => {
      const { token } = request.params as { token: string };
      const integration = await prisma.aiBotIntegration.findUnique({
        where: { publicToken: token },
      });

      if (!integration || integration.status !== 'ACTIVE') {
        throw new AppError('机器人接入不存在或已暂停', 404, 'AI_BOT_CALLBACK_DISABLED');
      }

      const challenge = getCallbackChallenge(request);
      if (challenge) {
        const body = asRecord(request.body);
        const query = request.query as Record<string, unknown>;
        if (typeof query.echostr === 'string' || typeof body.echostr === 'string') {
          return reply.type('text/plain').send(challenge);
        }
        return reply.send({ challenge });
      }

      const secret = getDecryptedAiBotSecret(integration);
      if (secret && !verifyCallbackSecret(request, secret)) {
        throw new AppError('机器人回调签名校验失败', 401, 'AI_BOT_CALLBACK_SIGNATURE_INVALID');
      }

      const incoming = extractIncomingAiBotMessage(request.body);
      if (!incoming.text) {
        throw new AppError('未识别到可回复的文本消息', 400, 'AI_BOT_MESSAGE_EMPTY');
      }

      const MAX_CALLBACK_TEXT_LENGTH = 4000;
      if (incoming.text.length > MAX_CALLBACK_TEXT_LENGTH) {
        incoming.text = incoming.text.slice(0, MAX_CALLBACK_TEXT_LENGTH);
      }

      if (!shouldAnswerMessage(integration, incoming.text)) {
        await prisma.aiBotMessage.create({
          data: {
            userId: integration.userId,
            integrationId: integration.id,
            platform: integration.platform,
            externalUserId: incoming.externalUserId || null,
            externalConversationId: incoming.externalConversationId || null,
            inboundText: incoming.text,
            status: AI_BOT_MESSAGE_STATUS.IGNORED,
            inputChars: incoming.text.length,
          },
        });
        return reply.send({
          success: true,
          ignored: true,
          message: '未命中触发关键词，已忽略',
        });
      }

      await assertCanUseAiBot(integration.userId);

      if (integration.responseMode === AI_BOT_BACKGROUND_RESPONSE_MODE) {
        const queued = await queueAiBotMessage(integration, incoming);
        return reply.status(202).send({
          success: true,
          queued: true,
          logId: queued.logId,
          message: '消息已进入网站后台处理队列',
        });
      }

      const result = await handleAiBotMessage(integration, incoming);
      const query = request.query as Record<string, unknown>;
      if (query.response === 'platform') {
        return reply.send(buildPlatformCallbackResponse(integration.platform, result.reply));
      }

      return reply.send({
        success: true,
        reply: result.reply,
        sendResult: result.sendResult,
        logId: result.logId,
        platformResponse: buildPlatformCallbackResponse(integration.platform, result.reply),
      });
    },
  );

  // ---------- Authenticated endpoints ----------

  app.get('/entitlement', { preHandler: [fastifyAuthenticate] }, async (request, reply) => {
    const userId = requireUserId(request);
    const entitlement = await getAiBotEntitlement(userId);
    return reply.send(entitlement);
  });

  app.get('/analytics', { preHandler: [fastifyAuthenticate] }, async (request, reply) => {
    const userId = requireUserId(request);
    const query = request.query as { days?: string | number };
    const analytics = await getAiBotAnalytics(userId, query.days);
    return reply.send(analytics);
  });

  app.get('/operations', { preHandler: [fastifyAuthenticate] }, async (request, reply) => {
    const userId = requireUserId(request);
    const query = request.query as { days?: string | number };
    const report = await getAiBotOperationsReport(userId, query.days);
    return reply.send({ report });
  });

  app.get('/models', { preHandler: [fastifyAuthenticate] }, async (_request, reply) => {
    const models = await getAiBotModelOptions();
    return reply.send({ models });
  });

  app.get('/templates', { preHandler: [fastifyAuthenticate] }, async (_request, reply) => {
    return reply.send({ templates: getAiBotPromptTemplates() });
  });

  app.post(
    '/payload-preview',
    {
      preHandler: [fastifyAuthenticate],
      schema: { body: aiBotPayloadPreviewSchema },
    },
    async (request, reply) => {
      const body = asRecord(request.body);
      const payload = hasOwn(body, 'payload') ? body.payload : body;
      const incoming = extractIncomingAiBotMessage(payload);
      const keywords = parseKeywords(body.triggerKeywords);
      const shouldAnswer =
        keywords.length === 0 ||
        keywords.some((keyword) => incoming.text.toLowerCase().includes(keyword.toLowerCase()));

      return reply.send({
        incoming,
        shouldAnswer,
        matchedKeywords: keywords.filter((keyword) =>
          incoming.text.toLowerCase().includes(keyword.toLowerCase()),
        ),
        inputChars: incoming.text.length,
      });
    },
  );

  app.get('/integrations', { preHandler: [fastifyAuthenticate] }, async (request, reply) => {
    const userId = requireUserId(request);
    const [entitlement, integrations, modelOptions] = await Promise.all([
      getAiBotEntitlement(userId),
      prisma.aiBotIntegration.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
      getAiBotModelOptions(),
    ]);

    return reply.send({
      entitlement,
      integrations: integrations.map((integration) =>
        toPublicIntegration(integration, modelOptions),
      ),
    });
  });

  app.post(
    '/integrations',
    {
      preHandler: [fastifyAuthenticate],
      schema: { body: aiBotCreateIntegrationSchema },
    },
    async (request, reply) => {
      const userId = requireUserId(request);
      await assertCanCreateAiBot(userId);
      const body = asRecord(request.body);
      await assertAiModelAvailable(normalizeAiModelId(body.aiModelId));

      const integration = await prisma.aiBotIntegration.create({
        data: await buildCreateData(userId, body),
      });
      const [entitlement, modelOptions] = await Promise.all([
        getAiBotEntitlement(userId),
        getAiBotModelOptions(),
      ]);

      return reply.status(201).send({
        integration: toPublicIntegration(integration, modelOptions),
        entitlement,
      });
    },
  );

  app.put(
    '/integrations/:id',
    {
      preHandler: [fastifyAuthenticate],
      schema: { params: idParamsSchema, body: aiBotUpdateIntegrationSchema },
    },
    async (request, reply) => {
      const userId = requireUserId(request);
      const { id } = request.params as { id: string };
      await getOwnedIntegration(id, userId);
      const body = asRecord(request.body);
      if (hasOwn(body, 'aiModelId')) {
        await assertAiModelAvailable(normalizeAiModelId(body.aiModelId));
      }

      const integration = await prisma.aiBotIntegration.update({
        where: { id },
        data: await buildUpdateData(body),
      });
      const modelOptions = await getAiBotModelOptions();

      return reply.send({
        integration: toPublicIntegration(integration, modelOptions),
      });
    },
  );

  app.delete(
    '/integrations/:id',
    {
      preHandler: [fastifyAuthenticate],
      schema: { params: idParamsSchema },
    },
    async (request, reply) => {
      const userId = requireUserId(request);
      const { id } = request.params as { id: string };
      await getOwnedIntegration(id, userId);

      await prisma.aiBotIntegration.delete({ where: { id } });
      const entitlement = await getAiBotEntitlement(userId);

      return reply.send({
        success: true,
        entitlement,
      });
    },
  );

  app.post(
    '/integrations/:id/rotate-token',
    {
      preHandler: [fastifyAuthenticate],
      schema: { params: idParamsSchema },
    },
    async (request, reply) => {
      const userId = requireUserId(request);
      const { id } = request.params as { id: string };
      await getOwnedIntegration(id, userId);

      const integration = await prisma.aiBotIntegration.update({
        where: { id },
        data: { publicToken: createPublicToken() },
      });
      const modelOptions = await getAiBotModelOptions();

      return reply.send({
        integration: toPublicIntegration(integration, modelOptions),
      });
    },
  );

  app.get(
    '/integrations/:id/diagnostics',
    {
      preHandler: [fastifyAuthenticate],
      schema: { params: idParamsSchema },
    },
    async (request, reply) => {
      const userId = requireUserId(request);
      const { id } = request.params as { id: string };
      const integration = await getOwnedIntegration(id, userId);
      const entitlement = await getAiBotEntitlement(userId);
      const diagnostics = await buildAiBotDiagnostics(integration, entitlement);

      return reply.send({
        diagnostics,
        entitlement,
      });
    },
  );

  app.get(
    '/integrations/:id/runbook',
    {
      preHandler: [fastifyAuthenticate],
      schema: { params: idParamsSchema },
    },
    async (request, reply) => {
      const userId = requireUserId(request);
      const { id } = request.params as { id: string };
      const integration = await getOwnedIntegration(id, userId);
      const entitlement = await getAiBotEntitlement(userId);
      const runbook = await buildAiBotIntegrationRunbook(integration, entitlement);

      return reply.send({ runbook, entitlement });
    },
  );

  app.get(
    '/integrations/:id/knowledge',
    {
      preHandler: [fastifyAuthenticate],
      schema: { params: idParamsSchema },
    },
    async (request, reply) => {
      const userId = requireUserId(request);
      const { id } = request.params as { id: string };
      await getOwnedIntegration(id, userId);
      const result = await listAiBotKnowledgeSources(userId, id);
      return reply.send(result);
    },
  );

  app.post(
    '/integrations/:id/knowledge',
    {
      preHandler: [fastifyAuthenticate],
      schema: { params: idParamsSchema, body: aiBotCreateKnowledgeSourceSchema },
    },
    async (request, reply) => {
      const userId = requireUserId(request);
      const { id } = request.params as { id: string };
      await getOwnedIntegration(id, userId);
      const result = await createAiBotKnowledgeSource(userId, id, asRecord(request.body));
      return reply.status(201).send(result);
    },
  );

  app.put(
    '/integrations/:id/knowledge/:sourceId',
    {
      preHandler: [fastifyAuthenticate],
      schema: { params: knowledgeSourceParamsSchema, body: aiBotUpdateKnowledgeSourceSchema },
    },
    async (request, reply) => {
      const userId = requireUserId(request);
      const { id, sourceId } = request.params as { id: string; sourceId: string };
      await getOwnedIntegration(id, userId);
      const result = await updateAiBotKnowledgeSource(userId, id, sourceId, asRecord(request.body));
      return reply.send(result);
    },
  );

  app.delete(
    '/integrations/:id/knowledge/:sourceId',
    {
      preHandler: [fastifyAuthenticate],
      schema: { params: knowledgeSourceParamsSchema },
    },
    async (request, reply) => {
      const userId = requireUserId(request);
      const { id, sourceId } = request.params as { id: string; sourceId: string };
      await getOwnedIntegration(id, userId);
      const result = await deleteAiBotKnowledgeSource(userId, id, sourceId);
      return reply.send(result);
    },
  );

  app.get(
    '/integrations/:id/insights',
    {
      preHandler: [fastifyAuthenticate],
      schema: { params: idParamsSchema, querystring: daysQuerySchema },
    },
    async (request, reply) => {
      const userId = requireUserId(request);
      const { id } = request.params as { id: string };
      const integration = await getOwnedIntegration(id, userId);
      const { days } = request.query as { days?: string | number };
      const insights = await buildAiBotEvolutionInsights(integration, days);

      return reply.send({ insights });
    },
  );

  app.post(
    '/integrations/:id/evaluations',
    {
      preHandler: [fastifyAuthenticate],
      schema: { params: idParamsSchema, body: aiBotRunEvaluationSchema },
    },
    async (request, reply) => {
      const userId = requireUserId(request);
      const { id } = request.params as { id: string };
      const integration = await getOwnedIntegration(id, userId);
      await assertCanUseAiBot(userId);

      const body = asRecord(request.body);
      const cases = normalizeEvaluationCases(body.cases);
      if (!cases.length) {
        throw new AppError('请至少提供一个评测用例', 400, 'AI_BOT_EVALUATION_CASE_REQUIRED');
      }
      const report = await evaluateAiBotIntegration(integration, cases);
      const entitlement = await getAiBotEntitlement(userId);

      return reply.send({
        success: true,
        report,
        entitlement,
      });
    },
  );

  app.post(
    '/integrations/:id/prompt-optimization',
    {
      preHandler: [fastifyAuthenticate],
      schema: { params: idParamsSchema, body: aiBotOptimizePromptSchema },
    },
    async (request, reply) => {
      const userId = requireUserId(request);
      const { id } = request.params as { id: string };
      const integration = await getOwnedIntegration(id, userId);
      await assertCanUseAiBot(userId);

      const input = normalizePromptOptimizationInput(asRecord(request.body));
      const optimization = await optimizeAiBotPrompt(integration, input);
      const entitlement = await getAiBotEntitlement(userId);

      return reply.send({
        success: true,
        optimization,
        entitlement,
      });
    },
  );

  app.post(
    '/integrations/:id/playground',
    {
      preHandler: [fastifyAuthenticate],
      schema: { params: idParamsSchema, body: aiBotRunPlaygroundSchema },
    },
    async (request, reply) => {
      const userId = requireUserId(request);
      const { id } = request.params as { id: string };
      const integration = await getOwnedIntegration(id, userId);
      await assertCanUseAiBot(userId);

      const body = asRecord(request.body);
      const prompt = normalizeOptionalText(body.prompt, MAX_PLAYGROUND_PROMPT_LENGTH);
      if (!prompt) {
        throw new AppError('请输入沙盒测试消息', 400, 'AI_BOT_PLAYGROUND_PROMPT_REQUIRED');
      }

      const externalUserId = normalizeOptionalText(body.externalUserId, 120) || 'playground-user';
      const externalConversationId =
        normalizeOptionalText(body.externalConversationId, 120) || 'playground-room';
      const result = await runAiBotPlayground(integration, {
        text: prompt,
        externalUserId,
        externalConversationId,
      });
      const entitlement = await getAiBotEntitlement(userId);

      return reply.send({
        success: true,
        ...result,
        entitlement,
      });
    },
  );

  app.post(
    '/integrations/:id/test',
    {
      preHandler: [fastifyAuthenticate],
      schema: { params: idParamsSchema, body: aiBotTestIntegrationSchema },
    },
    async (request, reply) => {
      const userId = requireUserId(request);
      const { id } = request.params as { id: string };
      const integration = await getOwnedIntegration(id, userId);
      await assertCanUseAiBot(userId);

      const body = asRecord(request.body);
      const prompt =
        normalizeOptionalText(body.prompt, MAX_TEST_PROMPT_LENGTH) ||
        '请用一句话确认当前 AI 机器人接入已经连通，并给出一个友好的测试回复。';

      const result = await handleAiBotMessage(integration, {
        text: prompt,
        externalUserId: 'dashboard-test',
        externalConversationId: 'dashboard-test',
      });
      const entitlement = await getAiBotEntitlement(userId);

      return reply.send({
        success: true,
        reply: result.reply,
        sendResult: result.sendResult,
        logId: result.logId,
        entitlement,
      });
    },
  );

  app.get(
    '/integrations/:id/messages',
    {
      preHandler: [fastifyAuthenticate],
      schema: { params: idParamsSchema, querystring: listMessagesQuerySchema },
    },
    async (request, reply) => {
      const userId = requireUserId(request);
      const { id } = request.params as { id: string };
      await getOwnedIntegration(id, userId);

      const {
        limit,
        status: rawStatus,
        q: rawQ,
      } = request.query as {
        limit: number;
        status?: string;
        q?: string;
      };
      const status = normalizeMessageStatusFilter(rawStatus);
      const q = typeof rawQ === 'string' ? rawQ.trim().slice(0, 100) : '';
      const where: Prisma.AiBotMessageWhereInput = {
        integrationId: id,
        userId,
        ...(status ? { status } : {}),
        ...(q
          ? {
              OR: [
                { inboundText: { contains: q } },
                { outboundText: { contains: q } },
                { error: { contains: q } },
                { externalUserId: { contains: q } },
                { externalConversationId: { contains: q } },
              ],
            }
          : {}),
      };

      const [messages, statusGroups, total] = await Promise.all([
        prisma.aiBotMessage.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: limit,
        }),
        prisma.aiBotMessage.groupBy({
          by: ['status'],
          where: { integrationId: id, userId },
          _count: { _all: true },
        }),
        prisma.aiBotMessage.count({ where }),
      ]);

      return reply.send({
        data: messages,
        total,
        limit,
        summary: statusGroups.reduce<Record<string, number>>((map, group) => {
          map[group.status] = group._count._all;
          return map;
        }, {}),
      });
    },
  );

  app.post(
    '/integrations/:id/messages/:messageId/replay',
    {
      preHandler: [fastifyAuthenticate],
      schema: { params: messageParamsSchema },
    },
    async (request, reply) => {
      const userId = requireUserId(request);
      const { id, messageId } = request.params as { id: string; messageId: string };
      const integration = await getOwnedIntegration(id, userId);
      await assertCanUseAiBot(userId);

      const sourceMessage = await prisma.aiBotMessage.findFirst({
        where: { id: messageId, integrationId: id, userId },
      });
      if (!sourceMessage) {
        throw new AppError('未找到可重放的消息记录', 404, 'AI_BOT_MESSAGE_NOT_FOUND');
      }

      const result = await handleAiBotMessage(integration, {
        text: sourceMessage.inboundText,
        externalUserId: sourceMessage.externalUserId || 'dashboard-replay',
        externalConversationId: sourceMessage.externalConversationId || 'dashboard-replay',
      });
      const entitlement = await getAiBotEntitlement(userId);

      return reply.send({
        success: true,
        replayedFromId: sourceMessage.id,
        reply: result.reply,
        sendResult: result.sendResult,
        logId: result.logId,
        entitlement,
      });
    },
  );
};
