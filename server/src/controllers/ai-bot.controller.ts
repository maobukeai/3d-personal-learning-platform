import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../services/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { AppError } from '../middlewares/error.middleware';
import { config } from '../config/env';
import { encryptSecret } from '../utils/secret-field';
import { normalizeWebhookUrl } from '../utils/webhook-url';
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
} from '../services/ai-bot.service';

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

const getStringFromRequest = (req: Request, name: string): string => {
  const header = req.get(name);
  if (header) return header.trim();
  const queryValue = req.query[name];
  if (typeof queryValue === 'string') return queryValue.trim();
  const body = asRecord(req.body);
  const bodyValue = body[name];
  return typeof bodyValue === 'string' ? bodyValue.trim() : '';
};

const getCallbackChallenge = (req: Request): string => {
  const body = asRecord(req.body);
  const candidates = [body.challenge, body.echostr, req.query.challenge, req.query.echostr];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim().slice(0, 2000);
    }
  }
  return '';
};

const sendCallbackChallenge = (req: Request, res: Response, challenge: string) => {
  const body = asRecord(req.body);
  if (typeof req.query.echostr === 'string' || typeof body.echostr === 'string') {
    res.type('text/plain').send(challenge);
    return;
  }
  res.json({ challenge });
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
  return Math.abs(Date.now() - millis) <= 60 * 60 * 1000;
};

const getRawCallbackBody = (req: Request): Buffer => {
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  if (rawBody) return rawBody;
  return Buffer.from(JSON.stringify(req.body ?? {}));
};

const getSignatureHeader = (req: Request): string =>
  req.get('x-ai-bot-signature') ||
  req.get('x-hub-signature-256') ||
  req.get('x-signature') ||
  req.get('x-bot-signature') ||
  '';

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

const verifyBodyHmacSignature = (req: Request, secret: string): boolean => {
  const signature = getSignatureHeader(req);
  if (!signature) return false;

  const timestamp =
    req.get('x-ai-bot-timestamp') ||
    req.get('x-timestamp') ||
    getStringFromRequest(req, 'timestamp') ||
    '';
  if (timestamp && !isFreshTimestamp(timestamp)) return false;

  const body = getRawCallbackBody(req);
  const payloads = timestamp
    ? [
        Buffer.concat([Buffer.from(`${timestamp}.`), body]),
        Buffer.concat([Buffer.from(`${timestamp}\n`), body]),
        body,
      ]
    : [body];

  return payloads.some((payload) => hmacSignatureMatches(signature, secret, payload));
};

const verifyCallbackSecret = (req: Request, secret: string): boolean => {
  const directCandidates = [
    req.get('x-ai-bot-secret'),
    req.get('x-bot-secret'),
    typeof req.query.secret === 'string' ? req.query.secret : '',
    typeof asRecord(req.body).secret === 'string' ? (asRecord(req.body).secret as string) : '',
  ].filter(Boolean) as string[];

  if (directCandidates.some((candidate) => safeEqual(candidate.trim(), secret))) {
    return true;
  }

  if (verifyBodyHmacSignature(req, secret)) {
    return true;
  }

  const timestamp =
    getStringFromRequest(req, 'timestamp') ||
    req.get('x-dingtalk-timestamp') ||
    req.get('x-feishu-timestamp') ||
    '';
  const sign =
    getStringFromRequest(req, 'sign') ||
    req.get('x-dingtalk-sign') ||
    req.get('x-feishu-signature') ||
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

export const getEntitlement = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId as string;
    const entitlement = await getAiBotEntitlement(userId);
    res.json(entitlement);
  } catch (error) {
    next(error);
  }
};

export const listIntegrations = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId as string;
    const [entitlement, integrations, modelOptions] = await Promise.all([
      getAiBotEntitlement(userId),
      prisma.aiBotIntegration.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
      getAiBotModelOptions(),
    ]);

    res.json({
      entitlement,
      integrations: integrations.map((integration) =>
        toPublicIntegration(integration, modelOptions),
      ),
    });
  } catch (error) {
    next(error);
  }
};

export const getAnalytics = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId as string;
    const analytics = await getAiBotAnalytics(userId, req.query.days);
    res.json(analytics);
  } catch (error) {
    next(error);
  }
};

export const getOperationsReport = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId as string;
    const report = await getAiBotOperationsReport(userId, req.query.days);
    res.json({ report });
  } catch (error) {
    next(error);
  }
};

export const listTemplates = async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    res.json({
      templates: getAiBotPromptTemplates(),
    });
  } catch (error) {
    next(error);
  }
};

export const listModels = async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const models = await getAiBotModelOptions();
    res.json({ models });
  } catch (error) {
    next(error);
  }
};

export const createIntegration = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId as string;
    await assertCanCreateAiBot(userId);
    const body = asRecord(req.body);
    await assertAiModelAvailable(normalizeAiModelId(body.aiModelId));

    const integration = await prisma.aiBotIntegration.create({
      data: await buildCreateData(userId, body),
    });
    const [entitlement, modelOptions] = await Promise.all([
      getAiBotEntitlement(userId),
      getAiBotModelOptions(),
    ]);

    res.status(201).json({
      integration: toPublicIntegration(integration, modelOptions),
      entitlement,
    });
  } catch (error) {
    next(error);
  }
};

export const updateIntegration = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId as string;
    const id = req.params.id as string;
    await getOwnedIntegration(id, userId);
    const body = asRecord(req.body);
    if (hasOwn(body, 'aiModelId')) {
      await assertAiModelAvailable(normalizeAiModelId(body.aiModelId));
    }

    const integration = await prisma.aiBotIntegration.update({
      where: { id },
      data: await buildUpdateData(body),
    });
    const modelOptions = await getAiBotModelOptions();

    res.json({
      integration: toPublicIntegration(integration, modelOptions),
    });
  } catch (error) {
    next(error);
  }
};

export const deleteIntegration = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId as string;
    const id = req.params.id as string;
    await getOwnedIntegration(id, userId);

    await prisma.aiBotIntegration.delete({ where: { id } });
    const entitlement = await getAiBotEntitlement(userId);

    res.json({
      success: true,
      entitlement,
    });
  } catch (error) {
    next(error);
  }
};

export const rotatePublicToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId as string;
    const id = req.params.id as string;
    await getOwnedIntegration(id, userId);

    const integration = await prisma.aiBotIntegration.update({
      where: { id },
      data: { publicToken: createPublicToken() },
    });
    const modelOptions = await getAiBotModelOptions();

    res.json({
      integration: toPublicIntegration(integration, modelOptions),
    });
  } catch (error) {
    next(error);
  }
};

export const testIntegration = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId as string;
    const id = req.params.id as string;
    const integration = await getOwnedIntegration(id, userId);
    await assertCanUseAiBot(userId);

    const body = asRecord(req.body);
    const prompt =
      normalizeOptionalText(body.prompt, MAX_TEST_PROMPT_LENGTH) ||
      '请用一句话确认当前 AI 机器人接入已经连通，并给出一个友好的测试回复。';

    const result = await handleAiBotMessage(integration, {
      text: prompt,
      externalUserId: 'dashboard-test',
      externalConversationId: 'dashboard-test',
    });
    const entitlement = await getAiBotEntitlement(userId);

    res.json({
      success: true,
      reply: result.reply,
      sendResult: result.sendResult,
      logId: result.logId,
      entitlement,
    });
  } catch (error) {
    next(error);
  }
};

export const diagnoseIntegration = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId as string;
    const id = req.params.id as string;
    const integration = await getOwnedIntegration(id, userId);
    const entitlement = await getAiBotEntitlement(userId);
    const diagnostics = await buildAiBotDiagnostics(integration, entitlement);

    res.json({
      diagnostics,
      entitlement,
    });
  } catch (error) {
    next(error);
  }
};

export const getIntegrationRunbook = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.userId as string;
    const id = req.params.id as string;
    const integration = await getOwnedIntegration(id, userId);
    const entitlement = await getAiBotEntitlement(userId);
    const runbook = await buildAiBotIntegrationRunbook(integration, entitlement);

    res.json({ runbook, entitlement });
  } catch (error) {
    next(error);
  }
};

export const runPlayground = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId as string;
    const id = req.params.id as string;
    const integration = await getOwnedIntegration(id, userId);
    await assertCanUseAiBot(userId);

    const body = asRecord(req.body);
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

    res.json({
      success: true,
      ...result,
      entitlement,
    });
  } catch (error) {
    next(error);
  }
};

export const getEvolutionInsights = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId as string;
    const id = req.params.id as string;
    const integration = await getOwnedIntegration(id, userId);
    const insights = await buildAiBotEvolutionInsights(integration, req.query.days);

    res.json({
      insights,
    });
  } catch (error) {
    next(error);
  }
};

export const runEvaluation = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId as string;
    const id = req.params.id as string;
    const integration = await getOwnedIntegration(id, userId);
    await assertCanUseAiBot(userId);

    const body = asRecord(req.body);
    const cases = normalizeEvaluationCases(body.cases);
    if (!cases.length) {
      throw new AppError('请至少提供一个评测用例', 400, 'AI_BOT_EVALUATION_CASE_REQUIRED');
    }
    const report = await evaluateAiBotIntegration(integration, cases);
    const entitlement = await getAiBotEntitlement(userId);

    res.json({
      success: true,
      report,
      entitlement,
    });
  } catch (error) {
    next(error);
  }
};

export const optimizePrompt = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId as string;
    const id = req.params.id as string;
    const integration = await getOwnedIntegration(id, userId);
    await assertCanUseAiBot(userId);

    const input = normalizePromptOptimizationInput(asRecord(req.body));
    const optimization = await optimizeAiBotPrompt(integration, input);
    const entitlement = await getAiBotEntitlement(userId);

    res.json({
      success: true,
      optimization,
      entitlement,
    });
  } catch (error) {
    next(error);
  }
};

export const listKnowledgeSources = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId as string;
    const id = req.params.id as string;
    await getOwnedIntegration(id, userId);
    const result = await listAiBotKnowledgeSources(userId, id);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const createKnowledgeSource = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.userId as string;
    const id = req.params.id as string;
    await getOwnedIntegration(id, userId);
    const result = await createAiBotKnowledgeSource(userId, id, asRecord(req.body));
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const updateKnowledgeSource = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.userId as string;
    const id = req.params.id as string;
    const sourceId = req.params.sourceId as string;
    await getOwnedIntegration(id, userId);
    const result = await updateAiBotKnowledgeSource(userId, id, sourceId, asRecord(req.body));
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const deleteKnowledgeSource = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.userId as string;
    const id = req.params.id as string;
    const sourceId = req.params.sourceId as string;
    await getOwnedIntegration(id, userId);
    const result = await deleteAiBotKnowledgeSource(userId, id, sourceId);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const previewPayload = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = asRecord(req.body);
    const payload = hasOwn(body, 'payload') ? body.payload : body;
    const incoming = extractIncomingAiBotMessage(payload);
    const keywords = parseKeywords(body.triggerKeywords);
    const shouldAnswer =
      keywords.length === 0 ||
      keywords.some((keyword) => incoming.text.toLowerCase().includes(keyword.toLowerCase()));

    res.json({
      incoming,
      shouldAnswer,
      matchedKeywords: keywords.filter((keyword) =>
        incoming.text.toLowerCase().includes(keyword.toLowerCase()),
      ),
      inputChars: incoming.text.length,
    });
  } catch (error) {
    next(error);
  }
};

export const listMessages = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId as string;
    const id = req.params.id as string;
    await getOwnedIntegration(id, userId);

    const parsedLimit = Number(req.query.limit || 20);
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 80) : 20;
    const status = normalizeMessageStatusFilter(req.query.status);
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
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

    res.json({
      data: messages,
      total,
      limit,
      summary: statusGroups.reduce<Record<string, number>>((map, group) => {
        map[group.status] = group._count._all;
        return map;
      }, {}),
    });
  } catch (error) {
    next(error);
  }
};

export const replayMessage = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId as string;
    const id = req.params.id as string;
    const messageId = req.params.messageId as string;
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

    res.json({
      success: true,
      replayedFromId: sourceMessage.id,
      reply: result.reply,
      sendResult: result.sendResult,
      logId: result.logId,
      entitlement,
    });
  } catch (error) {
    next(error);
  }
};

export const handleCallbackChallenge = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.params.token as string;
    const integration = await prisma.aiBotIntegration.findUnique({
      where: { publicToken: token },
    });

    if (!integration || integration.status !== 'ACTIVE') {
      throw new AppError('机器人接入不存在或已暂停', 404, 'AI_BOT_CALLBACK_DISABLED');
    }

    const challenge = getCallbackChallenge(req);
    if (challenge) {
      sendCallbackChallenge(req, res, challenge);
      return;
    }

    res.json({
      success: true,
      status: integration.status,
      message: 'AI 机器人回调地址可访问',
    });
  } catch (error) {
    next(error);
  }
};

export const handleCallback = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.params.token as string;
    const integration = await prisma.aiBotIntegration.findUnique({
      where: { publicToken: token },
    });

    if (!integration || integration.status !== 'ACTIVE') {
      throw new AppError('机器人接入不存在或已暂停', 404, 'AI_BOT_CALLBACK_DISABLED');
    }

    const challenge = getCallbackChallenge(req);
    if (challenge) {
      sendCallbackChallenge(req, res, challenge);
      return;
    }

    const secret = getDecryptedAiBotSecret(integration);
    if (secret && !verifyCallbackSecret(req, secret)) {
      throw new AppError('机器人回调签名校验失败', 401, 'AI_BOT_CALLBACK_SIGNATURE_INVALID');
    }

    const incoming = extractIncomingAiBotMessage(req.body);
    if (!incoming.text) {
      throw new AppError('未识别到可回复的文本消息', 400, 'AI_BOT_MESSAGE_EMPTY');
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
      res.json({
        success: true,
        ignored: true,
        message: '未命中触发关键词，已忽略',
      });
      return;
    }

    await assertCanUseAiBot(integration.userId);

    if (integration.responseMode === AI_BOT_BACKGROUND_RESPONSE_MODE) {
      const queued = await queueAiBotMessage(integration, incoming);
      res.status(202).json({
        success: true,
        queued: true,
        logId: queued.logId,
        message: '消息已进入网站后台处理队列',
      });
      return;
    }

    const result = await handleAiBotMessage(integration, incoming);
    if (req.query.response === 'platform') {
      res.json(buildPlatformCallbackResponse(integration.platform, result.reply));
      return;
    }

    res.json({
      success: true,
      reply: result.reply,
      sendResult: result.sendResult,
      logId: result.logId,
      platformResponse: buildPlatformCallbackResponse(integration.platform, result.reply),
    });
  } catch (error) {
    next(error);
  }
};
