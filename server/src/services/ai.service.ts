import axios from 'axios';
import { Response, NextFunction } from 'express';
import { settingsService } from './settings.service';
import { logger } from '../utils/logger';
import prisma from './prisma';
import path from 'path';
import fs from 'fs';
import { configureAxiosProxy } from '../utils/axios-proxy';
import { touchAiChatSession } from './ai-chat-session.service';

const aiHttp = axios.create();
configureAxiosProxy(aiHttp, { preferAiProxy: true });

export type AIChatRole = 'system' | 'user' | 'assistant';
export type AIChatMessage = { role: AIChatRole; content: string };
type AIImagePayload = { mimeType: string; data: string };

export interface AIServiceConfig {
  AI_IMPORT_ENABLED: boolean;
  AI_PROVIDER: string;
  AI_API_KEY: string;
  AI_API_ENDPOINT: string;
  AI_MODEL_NAME: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  capabilities?: string[];
}

type AIProvider = 'DEEPSEEK' | 'OPENAI' | 'AZURE' | 'GEMINI' | 'OLLAMA' | 'AGNES' | string;

interface AIModelOption {
  id?: string;
  name?: string;
  enabled?: boolean;
  provider?: string;
  modelName?: string;
  endpoint?: string;
  apiKey?: string;
  apiKeys?: string[];
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  isDefault?: boolean;
  capabilities?: string[];
  priority?: number;
  failoverEnabled?: boolean;
}

interface ModelKeyEntry {
  model: AIModelOption;
  apiKey: string;
}

interface GeminiResponsePart {
  thought?: boolean;
  text?: string;
}

interface PreparedAIRequest {
  url: string;
  headers: Record<string, string>;
  body: unknown;
  provider: AIProvider;
  modelName: string;
  requestId: string;
}

const DEFAULT_PROVIDER_ENDPOINTS: Record<string, string> = {
  DEEPSEEK: 'https://api.deepseek.com/v1',
  OPENAI: 'https://api.openai.com/v1',
  QWEN: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  GEMINI:
    'https://gateway.ai.cloudflare.com/v1/15f8013c69ef90d952d7a2945a949e52/gemini-proxy/google-ai-studio',
  OLLAMA: 'http://localhost:11434/api',
  AGNES: 'https://apihub.agnes-ai.com/v1',
  CUSTOM: '',
};

const DEFAULT_PROVIDER_MODELS: Record<string, string> = {
  DEEPSEEK: 'deepseek-chat',
  OPENAI: 'gpt-4o-mini',
  QWEN: 'qwen-plus',
  GEMINI: 'gemini-1.5-flash',
  OLLAMA: 'llama3',
  AGNES: 'agnes-2.0-flash',
  CUSTOM: '',
};

/**
 * Resolves all (model × API key) combinations into a priority-ordered chain for failover.
 * Models with a lower `priority` value (closer to 0) are tried first.
 * For each model, keys are ordered: [primaryKey, ...backupKeys].
 */
function resolveModelKeyChain(models: AIModelOption[]): ModelKeyEntry[] {
  const enabled = [...models]
    .filter((m) => m.enabled && m.failoverEnabled !== false)
    .sort((a, b) => {
      const pa = a.priority ?? 999;
      const pb = b.priority ?? 999;
      return pa - pb;
    });

  const chain: ModelKeyEntry[] = [];
  for (const model of enabled) {
    const primaryKey = model.apiKey || '';
    const backupKeys = (model.apiKeys || []).filter(Boolean);
    // Deduplicate keys while preserving order
    const seen = new Set<string>();
    const allKeys: string[] = [];
    for (const k of [primaryKey, ...backupKeys]) {
      if (k && !seen.has(k)) {
        seen.add(k);
        allKeys.push(k);
      }
    }
    // OLLAMA and similar local providers don't need a key
    const effectiveKeys = allKeys.length > 0 ? allKeys : [''];
    for (const key of effectiveKeys) {
      chain.push({ model, apiKey: key });
    }
  }
  return chain;
}

const AI_REQUEST_TIMEOUT_MS = 60_000;
/** Generous timeout for streaming responses — deep research mode can take 60-90 s before the LLM starts generating. */
const AI_STREAM_TIMEOUT_MS = 180_000;
const AI_STREAM_HEARTBEAT_MS = 15_000;
const PERSISTENT_RUN_MAX_LIFETIME_MS = 30 * 60 * 1000; // 30 minutes
const activePersistentAiRuns = new Map<
  string,
  {
    controller: AbortController;
    cancelled: boolean;
    startedAt: number;
    content?: string;
    reasoning?: string;
    done?: boolean;
  }
>();

// Periodic cleanup: remove stale persistent AI runs that have been active for too long
// This prevents memory leaks if cleanupPersistentRun() is not called due to exceptions
setInterval(
  () => {
    const now = Date.now();
    for (const [key, run] of activePersistentAiRuns.entries()) {
      const age = now - run.startedAt;
      if (age > PERSISTENT_RUN_MAX_LIFETIME_MS) {
        if (!run.done) {
          try {
            run.cancelled = true;
            run.controller.abort();
          } catch {
            // Ignore abort errors during cleanup
          }
        }
        activePersistentAiRuns.delete(key);
        logger.warn(
          `[AI Service] Cleaned up stale persistent run: ${key} (age: ${Math.round(age / 1000)}s)`,
        );
      }
    }
  },
  10 * 60 * 1000,
); // Run every 10 minutes

function createRequestId(): string {
  return `ai_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

const getPersistentRunKey = (userId: string, runId: string) => `${userId}:${runId}`;

export function cancelPersistentAiRun(userId: string, runId: string): boolean {
  const key = getPersistentRunKey(userId, runId);
  const run = activePersistentAiRuns.get(key);
  if (!run) return false;

  run.cancelled = true;
  run.controller.abort();
  return true;
}

export function registerPersistentAiRun(userId: string, runId: string): AbortController {
  // Prevent unbounded growth
  if (activePersistentAiRuns.size > 100) {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    for (const [k, r] of activePersistentAiRuns.entries()) {
      if (r.startedAt < oldestTime) {
        oldestTime = r.startedAt;
        oldestKey = k;
      }
    }
    if (oldestKey) {
      const oldRun = activePersistentAiRuns.get(oldestKey);
      if (oldRun && !oldRun.done) {
        oldRun.cancelled = true;
        try {
          oldRun.controller.abort();
        } catch {
          /* ignore */
        }
      }
      activePersistentAiRuns.delete(oldestKey);
    }
  }
  const key = getPersistentRunKey(userId, runId);
  let run = activePersistentAiRuns.get(key);
  if (!run) {
    const controller = new AbortController();
    run = {
      controller,
      cancelled: false,
      startedAt: Date.now(),
    };
    activePersistentAiRuns.set(key, run);
  }
  return run.controller;
}

export function appendPersistentAiRunReasoning(userId: string, runId: string, text: string) {
  const key = getPersistentRunKey(userId, runId);
  const run = activePersistentAiRuns.get(key);
  if (run) {
    run.reasoning = (run.reasoning || '') + text;
  }
}

export function getPersistentAiRunStatus(
  userId: string,
  runId: string,
): { content: string; reasoning: string; startedAt: number; done: boolean } | null {
  const key = getPersistentRunKey(userId, runId);
  const run = activePersistentAiRuns.get(key);
  if (!run) return null;
  return {
    content: run.content || '',
    reasoning: run.reasoning || '',
    startedAt: run.startedAt,
    done: run.done === true,
  };
}

function normalizeProvider(provider: string | undefined | null): AIProvider {
  return normalizeParam(provider || 'DEEPSEEK').toUpperCase();
}

function resolveEndpoint(provider: AIProvider, endpoint: string): string {
  return endpoint || DEFAULT_PROVIDER_ENDPOINTS[provider] || endpoint;
}

function resolveModelName(provider: AIProvider, modelName: string): string {
  return modelName || DEFAULT_PROVIDER_MODELS[provider] || modelName;
}

/**
 * Normalizes input string by replacing Unicode non-breaking hyphens (\u2011) with standard hyphens (-) and trimming.
 */
function normalizeParam(val: string | undefined | null): string {
  if (!val) return '';
  return val.replace(/\u2011/g, '-').trim();
}

/**
 * Normalizes endpoint URL to robustly append /chat/completions if not already present.
 * Also replaces any non-breaking hyphens and trims trailing slashes.
 */
function cleanEndpointUrl(url: string | undefined | null): string {
  if (!url) return '';
  let cleaned = normalizeParam(url);
  // Remove all trailing slashes
  cleaned = cleaned.replace(/\/+$/, '');
  if (!cleaned.endsWith('/chat/completions')) {
    cleaned += '/chat/completions';
  }
  return cleaned;
}

function isJsonResponseMode(responseFormat: unknown): boolean {
  return (
    responseFormat === 'json' ||
    (responseFormat != null &&
      typeof responseFormat === 'object' &&
      (responseFormat as any).type === 'json_object')
  );
}

/**
 * Helper to recursively clean all API path suffixes from an endpoint URL.
 */
function cleanBaseUrl(url: string | undefined | null): string {
  if (!url) return '';
  let cleaned = normalizeParam(url).trim().replace(/\/+$/, '');
  let previous = '';
  while (cleaned !== previous) {
    previous = cleaned;
    cleaned = cleaned
      .replace(/\/chat\/completions$/i, '')
      .replace(/\/messages$/i, '')
      .replace(/\/images\/generations$/i, '')
      .replace(/\/images$/i, '')
      .replace(/\/videos\/generations$/i, '')
      .replace(/\/videos$/i, '')
      .replace(/\/video\/generations$/i, '')
      .replace(/\/video$/i, '')
      .replace(/\/+$/, '');
  }
  return cleaned;
}

/**
 * Normalizes endpoint URL to robustly append /images/generations for image models.
 */
function cleanImageEndpointUrl(url: string | undefined | null): string {
  if (!url) return '';
  const original = normalizeParam(url).trim().replace(/\/+$/, '');

  // If the original URL explicitly contained /videos/generations, we respect it
  if (original.includes('/videos/generations')) {
    const base = cleanBaseUrl(original);
    return `${base}/videos/generations`;
  }

  const base = cleanBaseUrl(original);
  return `${base}/images/generations`;
}

/**
 * Detects if a model is an image generation model based on its name, capabilities, or endpoint.
 */
function isImageGenerationModel(
  modelName: string,
  capabilities?: string[],
  endpoint?: string,
): boolean {
  // If endpoint already points to /images/generations, it's definitely an image model
  if (endpoint && endpoint.includes('/images/generations')) {
    return true;
  }
  if (capabilities && Array.isArray(capabilities)) {
    const list = capabilities.map((c) => c.toLowerCase().trim());
    if (
      list.some(
        (c) =>
          c === 'draw' ||
          c === 'image' ||
          c === 'image_generation' ||
          c === 'paint' ||
          c === 'txt2img' ||
          c === 't2i',
      )
    ) {
      return true;
    }
  }
  const name = modelName.toLowerCase();
  return (
    name.includes('flux') ||
    name.includes('stable-diffusion') ||
    name.includes('sdxl') ||
    name.includes('sd-') ||
    name.includes('dall-e') ||
    name.includes('midjourney') ||
    name.includes('playground') ||
    name.includes('cogview') ||
    name.includes('kolors') ||
    name.includes('image-gen') ||
    name.includes('generate-image') ||
    name.includes('text-to-image') ||
    name.includes('txt2img') ||
    name.includes('t2i') ||
    /image[s]?[.-]\d/.test(name) // e.g. image-2.1, images-3
  );
}

/**
 * Detects if a model is a video generation model based on its name, capabilities, or endpoint.
 */
function isVideoGenerationModel(
  modelName: string,
  capabilities?: string[],
  endpoint?: string,
): boolean {
  if (
    endpoint &&
    (endpoint.includes('/videos/generations') || endpoint.includes('/video/generations'))
  ) {
    return true;
  }
  if (capabilities && Array.isArray(capabilities)) {
    const list = capabilities.map((c) => c.toLowerCase().trim());
    if (
      list.some(
        (c) => c === 'video' || c === 'video_generation' || c === 'text-to-video' || c === 't2v',
      )
    ) {
      return true;
    }
  }
  const name = modelName.toLowerCase();
  return (
    name.includes('video') ||
    name.includes('cogvideo') ||
    name.includes('luma') ||
    name.includes('runway') ||
    name.includes('kling') ||
    name.includes('sora') ||
    name.includes('pika') ||
    name.includes('anima') ||
    name.includes('t2v') ||
    name.includes('text-to-video')
  );
}

/**
 * Normalizes endpoint URL to robustly append /videos/generations for video models.
 */
function cleanVideoEndpointUrl(url: string | undefined | null, modelName?: string): string {
  if (!url) return '';
  const original = normalizeParam(url).trim().replace(/\/+$/, '');

  // If the original URL explicitly contained /video/generations or /videos/generations, respect it
  if (original.includes('/video/generations')) {
    const base = cleanBaseUrl(original);
    return `${base}/video/generations`;
  }
  if (original.includes('/videos/generations')) {
    const base = cleanBaseUrl(original);
    return `${base}/videos/generations`;
  }

  const base = cleanBaseUrl(original);

  // If model name contains "agnes" or url contains "agnes-ai.com", default to /video/generations (singular)
  const isAgnes =
    (modelName && modelName.toLowerCase().includes('agnes')) ||
    original.toLowerCase().includes('agnes');

  if (isAgnes) {
    return `${base}/video/generations`;
  }

  return `${base}/videos/generations`;
}

/**
 * Masks the API key (?key=...) in the URL to prevent it from leaking into logs.
 */
function maskUrlApiKey(rawUrl: string): string {
  if (!rawUrl) return '';
  return rawUrl.replace(/key=[^&]+/g, 'key=***');
}

function getErrorRecord(error: unknown): Record<string, unknown> {
  return error && typeof error === 'object' ? (error as Record<string, unknown>) : {};
}

function sanitizeAIError(error: unknown): Record<string, unknown> {
  const err = getErrorRecord(error);
  const response = getErrorRecord(err.response);
  const data = getErrorRecord(response.data);

  return {
    name: err.name,
    code: err.code,
    status: response.status,
    statusText: response.statusText,
    message: err.message || String(error),
    providerMessage:
      getErrorRecord(data.error).message ||
      data.message ||
      (typeof response.data === 'string' ? response.data.slice(0, 500) : undefined),
  };
}

function toUserFacingAIError(error: unknown, provider: AIProvider): string {
  const err = getErrorRecord(error);
  const response = getErrorRecord(err.response);
  const data = getErrorRecord(response.data);
  let errMsg = getErrorRecord(data.error).message || data.message || err.message || String(error);
  if (err.code === 'ECONNABORTED') {
    errMsg = '请求超时，请检查 API Endpoint 能否从服务器正常连接。';
  } else if (err.code === 'ERR_CANCELED') {
    errMsg = '请求已取消。';
  } else if (
    err.code === 'ECONNRESET' ||
    String(err.message).toLowerCase().includes('socket hang up') ||
    String(err.message).toLowerCase().includes('econnreset')
  ) {
    // The AI API server closed the connection mid-stream, usually due to its own server-side timeout
    // or a transient network issue. Provide a clear, actionable message instead of the raw Node.js error.
    errMsg =
      'AI 服务连接被意外中断（socket hang up）。可能原因：本次请求耗时过长触发了服务商超时、或网络不稳定。请稍后重试，或考虑精简问题。';
  } else if (response.status === 401) {
    errMsg = '鉴权失败，请检查 API 密钥 (API Key) 是否正确。';
  } else if (response.status === 403) {
    errMsg = '权限不足或当前模型不可用，请检查账号额度、模型权限和服务区域。';
  } else if (response.status === 404) {
    const rawMsg = getErrorRecord(data.error).message || data.message;
    if (rawMsg) {
      errMsg = `${rawMsg} (404)`;
    } else {
      errMsg =
        provider === 'OLLAMA'
          ? 'Ollama 接口未找到，请确认本地服务已启动且 Endpoint 指向 http://localhost:11434/api。'
          : 'API 终端未找到 (404)。如果使用自定义 API Endpoint，请确认地址是否正确，或是否需要补全 /chat/completions。';
    }
  } else if (response.status === 429) {
    errMsg = 'AI 服务请求过于频繁或额度不足，请稍后再试。';
  } else if (Number(response.status) >= 500) {
    errMsg = 'AI 服务供应商暂时不可用，请稍后重试或切换模型供应商。';
  }
  return `AI 服务调用失败: ${errMsg}`;
}

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  return 'application/octet-stream';
}

const AI_UPLOAD_URL_PREFIX = '/uploads/ai/';
const MAX_AI_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_AI_IMAGES_PER_MESSAGE = 4;
const SUPPORTED_AI_IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

function resolveSafeAiImagePath(imageUrl: string): string | null {
  let pathname: string;
  try {
    pathname = new URL(imageUrl, 'http://local').pathname;
  } catch {
    return null;
  }

  let decodedPathname: string;
  try {
    decodedPathname = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  if (!decodedPathname.startsWith(AI_UPLOAD_URL_PREFIX)) {
    return null;
  }

  const fileName = decodedPathname.slice(AI_UPLOAD_URL_PREFIX.length);
  if (!fileName || fileName.includes('/') || fileName.includes('\\') || fileName.includes('..')) {
    return null;
  }

  const uploadDir = path.resolve(process.cwd(), 'uploads', 'ai');
  const diskPath = path.resolve(uploadDir, fileName);
  if (!diskPath.startsWith(uploadDir + path.sep)) {
    return null;
  }

  return diskPath;
}

async function fetchExternalImage(url: string): Promise<AIImagePayload | null> {
  try {
    const response = await aiHttp.get(url, {
      responseType: 'arraybuffer',
      timeout: 5000,
    });
    const rawContentType = response.headers['content-type'];
    const contentType = typeof rawContentType === 'string' ? rawContentType : 'image/jpeg';
    if (!SUPPORTED_AI_IMAGE_MIME_TYPES.has(contentType)) {
      logger.warn(`[AI Service] External image has unsupported content type: ${contentType}`);
      return null;
    }
    const base64 = Buffer.from(response.data as ArrayBuffer).toString('base64');
    return { mimeType: contentType, data: base64 };
  } catch (e) {
    logger.warn(`[AI Service] Failed to fetch external image from ${url}:`, e);
    return null;
  }
}

async function extractImagesAndText(
  content: string,
): Promise<{ text: string; images: AIImagePayload[] }> {
  // Support nested parentheses in URLs (e.g. url containing (3))
  const imageRegex = /!\[.*?\]\(((?:[^()]+|\([^()]*\))+)\)/g;
  let match;
  const images: AIImagePayload[] = [];

  while ((match = imageRegex.exec(content)) !== null) {
    const imgUrl = match[1];
    if (!imgUrl || images.length >= MAX_AI_IMAGES_PER_MESSAGE) continue;

    if (imgUrl.startsWith('http://') || imgUrl.startsWith('https://')) {
      const fetched = await fetchExternalImage(imgUrl);
      if (fetched) {
        images.push(fetched);
      }
      continue;
    }

    const diskPath = resolveSafeAiImagePath(imgUrl);
    if (!diskPath) continue;

    try {
      const stat = await fs.promises.stat(diskPath);
      const mimeType = getMimeType(diskPath);

      if (!stat.isFile()) continue;
      if (stat.size > MAX_AI_IMAGE_BYTES) {
        logger.warn(`[AI Content Parse] Skipped oversized image: ${path.basename(diskPath)}`);
        continue;
      }
      if (!SUPPORTED_AI_IMAGE_MIME_TYPES.has(mimeType)) {
        logger.warn(`[AI Content Parse] Skipped unsupported image type: ${mimeType}`);
        continue;
      }

      const fileBuffer = await fs.promises.readFile(diskPath);
      images.push({ mimeType, data: fileBuffer.toString('base64') });
    } catch (e) {
      logger.warn('[AI Content Parse] Failed to read local AI image:', e);
    }
  }

  // Replace all matches of image markdown with a placeholder indicator
  const cleanText = content.replace(/!\[.*?\]\(((?:[^()]+|\([^()]*\))+)\)/g, '[图片]');
  return { text: cleanText, images };
}

function mergeToolCalls(existing: any[], deltas: any[]): any[] {
  const result = [...existing];
  for (const delta of deltas) {
    const idx = delta.index ?? 0;
    if (!result[idx]) {
      result[idx] = { id: '', type: 'function', function: { name: '', arguments: '' } };
    }
    if (delta.id) result[idx].id += delta.id;
    if (delta.function?.name) result[idx].function.name += delta.function.name;
    if (delta.function?.arguments) result[idx].function.arguments += delta.function.arguments;
  }
  return result;
}

type OpenAIContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

async function formatOpenAiMessage(role: AIChatRole, content: string) {
  const { text, images } = await extractImagesAndText(content);
  if (images.length === 0) {
    return { role, content };
  }

  const contentArray: OpenAIContentPart[] = [{ type: 'text', text }];
  for (const img of images) {
    contentArray.push({
      type: 'image_url',
      image_url: {
        url: `data:${img.mimeType};base64,${img.data}`,
      },
    });
  }
  return { role, content: contentArray };
}

async function formatAnthropicMessage(role: AIChatRole, content: string) {
  const { text, images } = await extractImagesAndText(content);
  if (images.length === 0) {
    return { role, content };
  }

  const contentArray: any[] = [];
  for (const img of images) {
    contentArray.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: img.mimeType,
        data: img.data,
      },
    });
  }
  if (text.trim()) {
    contentArray.push({ type: 'text', text });
  }
  return { role, content: contentArray };
}

type GeminiPart = { text: string } | { inlineData: AIImagePayload };

async function formatGeminiParts(content: string): Promise<GeminiPart[]> {
  const { text, images } = await extractImagesAndText(content);
  const parts: GeminiPart[] = [{ text }];
  for (const img of images) {
    parts.push({
      inlineData: {
        mimeType: img.mimeType,
        data: img.data,
      },
    });
  }
  return parts;
}

async function formatOllamaMessages(
  messages: AIChatMessage[],
  systemPrompt: string,
): Promise<AIChatMessage[]> {
  const normalizedMessages: AIChatMessage[] = messages.map((message) => ({
    role: message.role === 'assistant' ? 'assistant' : 'user',
    content: message.content.replace(
      /!\[.*?\]\((.*?)\)/g,
      '[图片：本地 Ollama 文本模式暂不读取图片内容]',
    ),
  }));

  return [{ role: 'system', content: systemPrompt }, ...normalizedMessages];
}

export function sendSSE(res: Response, payload: Record<string, unknown> | '[DONE]') {
  const streamRes = res as Response & { destroyed?: boolean; closed?: boolean; flush?: () => void };
  if (res.writableEnded || streamRes.destroyed || streamRes.closed) return;
  try {
    if (payload === '[DONE]') {
      res.write('data: [DONE]\n\n');
    } else {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    }
    if (typeof streamRes.flush === 'function') {
      streamRes.flush();
    }
  } catch (error) {
    logger.warn('[AI SSE] Failed to write to client stream', error);
  }
}

/**
 * Unified request building helper for all AI calls.
 */
async function prepareRequestConfig(
  messages: AIChatMessage[],
  systemPrompt: string,
  overrides?: Partial<AIServiceConfig>,
  options: {
    stream?: boolean;
    temperature?: number;
    isSingleTurn?: boolean;
    promptText?: string;
    responseFormat?: 'json' | { type: 'json_object' } | any;
    tools?: any[];
    toolChoice?: any;
  } = {},
): Promise<PreparedAIRequest> {
  const settings = await settingsService.getAll();

  let provider = normalizeProvider(overrides?.AI_PROVIDER ?? settings.AI_PROVIDER);
  const apiKey = normalizeParam(overrides?.AI_API_KEY ?? settings.AI_API_KEY);
  const endpoint = resolveEndpoint(
    provider,
    normalizeParam(overrides?.AI_API_ENDPOINT ?? settings.AI_API_ENDPOINT),
  );
  const modelName = resolveModelName(
    provider,
    normalizeParam(overrides?.AI_MODEL_NAME ?? settings.AI_MODEL_NAME),
  );

  if (modelName.toLowerCase().includes('agnes')) {
    provider = 'AGNES';
  }

  const enabled = overrides?.AI_IMPORT_ENABLED ?? settings.AI_IMPORT_ENABLED;
  const requestId = createRequestId();

  if (!enabled && !overrides) {
    throw new Error('AI 功能未启用，请联系管理员在系统后台开启。');
  }

  if (!apiKey && provider !== 'OLLAMA') {
    throw new Error(`提供商 ${provider} 需要配置 API 密钥 (API Key)。`);
  }

  // Look up model config for custom parameters
  let matchingModel: AIModelOption | null = null;
  if (settings.AI_MODEL_OPTIONS) {
    try {
      const models = JSON.parse(settings.AI_MODEL_OPTIONS);
      if (Array.isArray(models)) {
        matchingModel = models.find(
          (m: AIModelOption) =>
            m.enabled &&
            String(m.provider).toUpperCase() === String(provider).toUpperCase() &&
            m.modelName === modelName,
        ) as AIModelOption | null;
        if (!matchingModel) {
          matchingModel = models.find(
            (m: AIModelOption) => m.enabled && m.isDefault,
          ) as AIModelOption | null;
        }
      }
    } catch (e) {
      logger.warn('[AI Service] Failed to parse AI_MODEL_OPTIONS', e);
    }
  }

  const temperature =
    overrides?.temperature ?? matchingModel?.temperature ?? options.temperature ?? 0.3;
  let maxTokens = overrides?.maxTokens ?? matchingModel?.maxTokens;
  if (maxTokens === 2000 || !maxTokens) {
    maxTokens = 8192;
  }
  const systemPromptPreset = overrides?.systemPrompt ?? matchingModel?.systemPrompt;

  let finalSystemPrompt = systemPrompt;
  if (systemPromptPreset && systemPromptPreset.trim()) {
    finalSystemPrompt = `${systemPromptPreset.trim()}\n\n${systemPrompt}`;
  }

  // Truncate message history to prevent exceeding model/TPM limits (e.g. Groq 12k TPM limit)
  let chatMessages: AIChatMessage[] = [];
  let charCount = 0;
  const maxCharBudget = 24000; // ~6k tokens budget for history context
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (!msg) continue;
    const contentStr = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
    const msgLen = contentStr.length;
    if (charCount + msgLen > maxCharBudget && chatMessages.length > 0) {
      break;
    }
    chatMessages.unshift(msg);
    charCount += msgLen;
  }
  messages = chatMessages;

  const stream = options.stream ?? false;
  const isSingleTurn = options.isSingleTurn ?? false;

  let url = endpoint;
  let headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  let body: unknown;

  if (provider === 'AZURE') {
    headers['api-key'] = apiKey;
    url = endpoint;
    if (url && !url.includes('api-version=')) {
      const separator = url.includes('?') ? '&' : '?';
      url = `${url}${separator}api-version=2023-05-15`;
    }
    const azureMessages = await Promise.all(
      messages.map((m) => formatOpenAiMessage(m.role, m.content)),
    );
    const azureUserMsg = await formatOpenAiMessage('user', options.promptText || '');
    body = {
      messages: isSingleTurn
        ? [{ role: 'system', content: finalSystemPrompt }, azureUserMsg]
        : [{ role: 'system', content: finalSystemPrompt }, ...azureMessages],
      temperature,
      ...(maxTokens && { max_tokens: maxTokens }),
      ...(stream && { stream: true }),
    };
  } else if (provider === 'OLLAMA') {
    url = endpoint.replace(/\/+$/, '');
    if (!url.endsWith('/chat')) {
      url += '/chat';
    }
    const ollamaMessages = await formatOllamaMessages(
      isSingleTurn ? [{ role: 'user', content: options.promptText || '' }] : messages,
      finalSystemPrompt,
    );
    body = {
      model: modelName,
      messages: ollamaMessages,
      stream,
      options: {
        temperature,
        ...(maxTokens && { num_predict: maxTokens }),
      },
    };
  } else if (provider === 'GEMINI') {
    // 支持原生 googleapis.com 地址和 Cloudflare AI Gateway 等代理地址
    let geminiBase = (endpoint || 'https://generativelanguage.googleapis.com')
      .trim()
      .replace(/\/+$/, '');
    geminiBase = geminiBase
      .replace(/\/chat\/completions$/i, '')
      .replace(/\/v1beta$/i, '')
      .replace(/\/v1$/i, '')
      .replace(/\/+$/, '');
    const model = modelName || 'gemini-1.5-flash';
    const isThinkingModel = model.toLowerCase().includes('thinking');
    const thinkingParams = isThinkingModel ? { thinkingConfig: { includeThoughts: true } } : {};

    const isJsonMode = isJsonResponseMode(options.responseFormat);

    let geminiTools: unknown[] | undefined;
    if (options.tools && Array.isArray(options.tools)) {
      const functionDeclarations = options.tools.map((t: any) => {
        if (t.type === 'function' && t.function) {
          return {
            name: t.function.name,
            description: t.function.description,
            parameters: t.function.parameters,
          };
        }
        return t;
      });
      geminiTools = [{ functionDeclarations }];
    }

    if (isSingleTurn) {
      url = `${geminiBase}/v1beta/models/${model}:${stream ? 'streamGenerateContent?alt=sse&' : 'generateContent?'}key=${apiKey}`;
      const parts = await formatGeminiParts(options.promptText || '');
      const textPart = parts.find(
        (part): part is { text: string } => 'text' in part && typeof part.text === 'string',
      );
      if (textPart) {
        textPart.text = `${finalSystemPrompt}\n\n用户输入：\n${textPart.text}`;
      }
      body = {
        contents: [
          {
            role: 'user',
            parts,
          },
        ],
        generationConfig: {
          temperature,
          ...(maxTokens && { maxOutputTokens: maxTokens }),
          ...thinkingParams,
          ...(isJsonMode && { responseMimeType: 'application/json' }),
        },
        ...(geminiTools && { tools: geminiTools }),
      };
    } else {
      const geminiContents = await Promise.all(
        messages.map(async (m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: await formatGeminiParts(m.content),
        })),
      );
      url = `${geminiBase}/v1beta/models/${model}:${stream ? 'streamGenerateContent?alt=sse&' : 'generateContent?'}key=${apiKey}`;
      body = {
        contents: geminiContents,
        systemInstruction: {
          parts: [{ text: finalSystemPrompt }],
        },
        generationConfig: {
          temperature,
          ...(maxTokens && { maxOutputTokens: maxTokens }),
          ...thinkingParams,
          ...(isJsonMode && { responseMimeType: 'application/json' }),
        },
        ...(geminiTools && { tools: geminiTools }),
      };
    }
  } else if (provider === 'AGNES') {
    const urlPath = url ? new URL(url, 'http://base').pathname.toLowerCase() : '';
    const isAnthropic = urlPath.endsWith('/messages') || urlPath.includes('/v1/messages');

    if (isAnthropic) {
      const anthropicMessages = await Promise.all(
        messages.map((m) => formatAnthropicMessage(m.role, m.content)),
      );
      const anthropicUserMsg = await formatAnthropicMessage('user', options.promptText || '');

      headers['x-api-key'] = apiKey;
      headers['anthropic-version'] = '2023-06-01';

      if (!url.endsWith('/v1/messages') && !url.endsWith('/messages')) {
        let base = cleanBaseUrl(url);
        if (!base.endsWith('/v1')) {
          base += '/v1';
        }
        url = base + '/messages';
      }

      let formattedTools: unknown[] | undefined;
      if (options.tools && Array.isArray(options.tools)) {
        formattedTools = options.tools.map((t: any) => {
          if (t.type === 'function' && t.function) {
            return {
              name: t.function.name,
              description: t.function.description,
              input_schema: t.function.parameters,
            };
          }
          return t;
        });
      }

      body = {
        model: modelName,
        messages: isSingleTurn ? [anthropicUserMsg] : anthropicMessages,
        system: finalSystemPrompt,
        temperature,
        max_tokens: maxTokens ?? (stream ? 8192 : 4096),
        ...(stream && { stream: true }),
        ...(formattedTools && { tools: formattedTools }),
        ...(options.toolChoice && { tool_choice: options.toolChoice }),
      };
    } else {
      const openAiMessages = await Promise.all(
        messages.map((m) => formatOpenAiMessage(m.role, m.content)),
      );
      const openAiUserMsg = await formatOpenAiMessage('user', options.promptText || '');

      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
      if (!url.endsWith('/chat/completions')) {
        url = cleanEndpointUrl(url);
      }

      const isJsonMode = isJsonResponseMode(options.responseFormat);

      body = {
        model: modelName,
        messages: isSingleTurn
          ? [{ role: 'system', content: finalSystemPrompt }, openAiUserMsg]
          : [{ role: 'system', content: finalSystemPrompt }, ...openAiMessages],
        temperature,
        max_tokens: maxTokens ?? (stream ? 8192 : 4096),
        ...(stream && { stream: true }),
        ...(isJsonMode && { response_format: { type: 'json_object' } }),
        ...(options.tools && { tools: options.tools }),
        ...(options.toolChoice && { tool_choice: options.toolChoice }),
      };
    }
  } else {
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
    url = cleanEndpointUrl(url);
    const openAiMessages = await Promise.all(
      messages.map((m) => formatOpenAiMessage(m.role, m.content)),
    );
    const openAiUserMsg = await formatOpenAiMessage('user', options.promptText || '');

    const isJsonMode = isJsonResponseMode(options.responseFormat);

    body = {
      model: modelName,
      messages: isSingleTurn
        ? [{ role: 'system', content: finalSystemPrompt }, openAiUserMsg]
        : [{ role: 'system', content: finalSystemPrompt }, ...openAiMessages],
      temperature,
      max_tokens: maxTokens ?? (stream ? 8192 : 4096),
      ...(stream && { stream: true }),
      ...(isJsonMode && { response_format: { type: 'json_object' } }),
      ...(options.tools && { tools: options.tools }),
      ...(options.toolChoice && { tool_choice: options.toolChoice }),
    };
  }

  return { url, headers, body, provider, modelName, requestId };
}

/**
 * Private helper to execute LLM API call, parse response, and handle errors unifiedly.
 */
async function executeLLMRequest(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  provider: AIProvider,
  overrides?: Partial<AIServiceConfig>,
  timeoutMs: number = AI_REQUEST_TIMEOUT_MS,
): Promise<string> {
  try {
    const response = await aiHttp.post(url, body, {
      headers,
      timeout: timeoutMs,
    });

    if (provider === 'GEMINI') {
      const parts = response.data?.candidates?.[0]?.content?.parts;
      let text = '';
      if (Array.isArray(parts)) {
        const textParts = parts
          .filter((part: GeminiResponsePart) => !part.thought)
          .map((part: GeminiResponsePart) => part.text)
          .filter(Boolean);
        text = textParts.join('');
      } else {
        text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      }
      if (!text) {
        throw new Error('Gemini API 返回内容为空，请检查模型名称和密钥是否正确。');
      }
      return text;
    } else if (provider === 'OLLAMA') {
      const text = response.data?.message?.content || response.data?.response;
      if (!text) {
        throw new Error('Ollama 返回内容为空，请检查模型名称是否已拉取。');
      }
      return text;
    } else if (provider === 'AGNES') {
      if (Array.isArray(response.data?.content)) {
        const toolUses = response.data.content.filter((part: any) => part.type === 'tool_use');
        if (toolUses.length > 0) {
          const formattedToolCalls = toolUses.map((tu: any) => ({
            id: tu.id,
            type: 'function',
            function: {
              name: tu.name,
              arguments: JSON.stringify(tu.input || {}),
            },
          }));
          return JSON.stringify({ tool_calls: formattedToolCalls });
        }

        const textParts = response.data.content
          .filter((part: any) => part.type === 'text')
          .map((part: any) => part.text)
          .join('');
        return textParts;
      } else {
        const msg = response.data?.choices?.[0]?.message;
        if (msg?.tool_calls && msg.tool_calls.length > 0) {
          return JSON.stringify({ tool_calls: msg.tool_calls });
        }
        const text = msg?.content;
        if (!text) {
          throw new Error('Agnes API 返回内容为空，请确认模型名称与接口是否兼容。');
        }
        return text;
      }
    } else {
      const msg = response.data?.choices?.[0]?.message;
      if (msg?.tool_calls && msg.tool_calls.length > 0) {
        return JSON.stringify({ tool_calls: msg.tool_calls });
      }
      const text = msg?.content;
      if (!text) {
        throw new Error('API 返回内容为空，请确认模型名称与接口是否兼容。');
      }
      return text;
    }
  } catch (error: unknown) {
    logger.error(`[AI Service Error (${provider})]:`, sanitizeAIError(error));
    throw new Error(toUserFacingAIError(error, provider));
  }
}

/**
 * Standard single-turn LLM call.
 * Useful for automated generations (e.g. project markdown outline generation).
 *
 * @param prompt User prompt text
 * @param systemPrompt Instructions defining the AI role/format
 * @param overrides Temporary config parameters (used in connection testing)
 * @returns Generated text response
 */
export async function callLLM(
  prompt: string,
  systemPrompt: string,
  overrides?: Partial<AIServiceConfig>,
  timeoutMs: number = AI_REQUEST_TIMEOUT_MS,
): Promise<string> {
  const { url, headers, body, provider, modelName, requestId } = await prepareRequestConfig(
    [],
    systemPrompt,
    overrides,
    {
      temperature: 0.3,
      isSingleTurn: true,
      promptText: prompt,
    },
  );

  if (isVideoGenerationModel(modelName, overrides?.capabilities, url)) {
    try {
      const videoUrl = cleanVideoEndpointUrl(url, modelName);
      logger.info(
        `[AI Service Video Test] requestId=${requestId} provider=${provider} model=${modelName} url=${maskUrlApiKey(videoUrl)}`,
      );

      const response = await aiHttp.post(
        videoUrl,
        {
          model: modelName,
          prompt: 'a bouncing ball',
        },
        {
          headers,
          timeout: timeoutMs,
        },
      );

      const responseData = response.data;
      const hasUrl = responseData.data?.[0]?.url || responseData.url;
      const taskId = responseData.task_id || responseData.data?.task_id || responseData.id;
      if (hasUrl || taskId) {
        return `OK [视频模型测试成功${taskId ? `，已提交任务 ${taskId}` : '，已生成测试视频'}]`;
      }
      throw new Error('未获取到生成的视频数据或任务ID，请检查视频模型接口响应格式。');
    } catch (error: unknown) {
      logger.error(`[AI Service Video Test Error (${provider})]:`, sanitizeAIError(error));
      throw new Error(toUserFacingAIError(error, provider));
    }
  }

  if (isImageGenerationModel(modelName, overrides?.capabilities, url)) {
    try {
      const imgUrl = cleanImageEndpointUrl(url);
      logger.info(
        `[AI Service Image Test] requestId=${requestId} provider=${provider} model=${modelName} url=${maskUrlApiKey(imgUrl)}`,
      );

      const response = await aiHttp.post(
        imgUrl,
        {
          model: modelName,
          prompt: 'a white dot',
          n: 1,
          size: '256x256',
        },
        {
          headers,
          timeout: timeoutMs,
        },
      );

      const responseData = response.data;
      const imgData = responseData.data?.[0];
      if (imgData && (imgData.url || imgData.b64_json)) {
        return 'OK [生图模型测试成功，已生成测试图]';
      }
      throw new Error('未获取到生成的图片数据，请检查生图接口响应格式。');
    } catch (error: unknown) {
      logger.error(`[AI Service Image Test Error (${provider})]:`, sanitizeAIError(error));
      throw new Error(toUserFacingAIError(error, provider));
    }
  }

  logger.info(
    `[AI Service] requestId=${requestId} provider=${provider} model=${modelName} url=${maskUrlApiKey(url)}`,
  );

  return executeLLMRequest(url, headers, body, provider, overrides, timeoutMs);
}

/**
 * Server-Sent Events (SSE) streaming API chat interaction.
 * Streams LLM output chunks directly back to the client HTTP response.
 *
 * @param messages Conversation message history array
 * @param systemPrompt Chat constraints and persona instructions
 * @param res Express response stream object
 * @param overrides Temporary configuration overrides
 */
export async function streamLLMChat(
  messages: AIChatMessage[],
  systemPrompt: string,
  res: Response,
  next: NextFunction,
  overrides?: Partial<AIServiceConfig>,
  userId?: string,
  streamMeta?: Record<string, unknown>,
): Promise<void> {
  const clientRunId =
    typeof streamMeta?.clientRunId === 'string' ? streamMeta.clientRunId.trim().slice(0, 120) : '';
  const shouldPersistOnDisconnect = Boolean(
    userId && clientRunId && streamMeta?.continueOnClientDisconnect === true,
  );

  let controller: AbortController;
  let persistentRunKey: string | null = null;

  if (shouldPersistOnDisconnect && userId) {
    persistentRunKey = getPersistentRunKey(userId, clientRunId);
    const existingRun = activePersistentAiRuns.get(persistentRunKey);
    if (existingRun) {
      controller = existingRun.controller;
    } else {
      controller = new AbortController();
      activePersistentAiRuns.set(persistentRunKey, {
        controller,
        cancelled: false,
        startedAt: Date.now(),
      });
    }
  } else {
    controller = new AbortController();
  }

  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let activityTimer: ReturnType<typeof setInterval> | null = null;
  let completed = false;
  let activeProvider: AIProvider = normalizeProvider(overrides?.AI_PROVIDER);

  const streamMetaForClient = { ...(streamMeta || {}) };
  delete streamMetaForClient.continueOnClientDisconnect;
  const cleanupPersistentRun = () => {
    if (persistentRunKey) {
      activePersistentAiRuns.delete(persistentRunKey);
      persistentRunKey = null;
    }
  };

  try {
    const { url, headers, body, provider, modelName, requestId } = await prepareRequestConfig(
      messages,
      systemPrompt,
      overrides,
      {
        temperature: 0.7,
        stream: true,
        isSingleTurn: false,
      },
    );
    activeProvider = provider;

    if (isVideoGenerationModel(modelName, overrides?.capabilities, url)) {
      // Establish SSE stream headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.setHeader('Content-Encoding', 'none');
      res.flushHeaders();

      sendSSE(res, {
        event: 'meta',
        requestId,
        provider,
        model: modelName,
        ...streamMetaForClient,
      });

      sendSSE(res, {
        reasoning: `正在为您使用视频生成模型 ${modelName} 生成视频，请稍候...\n(Please wait while generating video using model: ${modelName})`,
        requestId,
      });

      try {
        const lastUserMsg =
          messages[messages.length - 1]?.content || '生成一段3D模型旋转的精美视频';
        const cleanPrompt = lastUserMsg.replace(/\[(图片|视频)\]/g, '').trim();
        const videoUrl = cleanVideoEndpointUrl(url, modelName);

        logger.info(
          `[AI Video Generation] requestId=${requestId} provider=${provider} model=${modelName} url=${maskUrlApiKey(videoUrl)}`,
        );

        const response = await aiHttp.post(
          videoUrl,
          {
            model: modelName,
            prompt: cleanPrompt,
          },
          {
            headers,
            timeout: AI_STREAM_TIMEOUT_MS,
            signal: controller.signal,
          },
        );

        const responseData = response.data;
        let finalVideoUrl = responseData.data?.[0]?.url || responseData.url;
        const taskId = responseData.task_id || responseData.data?.task_id || responseData.id;

        if (!finalVideoUrl && taskId) {
          logger.info(`[AI Video Generation] Task submitted. Task ID: ${taskId}. Start polling...`);

          // Generate fallback task query URLs
          const cleanBase = cleanBaseUrl(videoUrl);
          const taskUrls = [
            `${cleanBase}/video/tasks/${taskId}`,
            `${cleanBase}/videos/tasks/${taskId}`,
            `${cleanBase}/videos/${taskId}`,
            `${cleanBase}/video/${taskId}`,
            `${cleanBase}/tasks/${taskId}`,
          ];

          let attempts = 0;
          const maxAttempts = 40;
          let pollCompleted = false;
          let urlIndex = 0;
          let taskStatusUrl = taskUrls[urlIndex];

          while (attempts < maxAttempts && !pollCompleted && !res.destroyed) {
            attempts++;
            await new Promise((resolve) => setTimeout(resolve, 3000));
            logger.info(
              `[AI Video Generation] Polling task ${taskId}, attempt ${attempts}/${maxAttempts}`,
            );

            try {
              let statusResponse: any = null;
              let gotValidUrl = false;

              // Iterate through target candidate URLs immediately on 404 without waiting
              while (urlIndex < taskUrls.length && !gotValidUrl) {
                const currentUrl = taskUrls[urlIndex];
                if (!currentUrl) {
                  urlIndex++;
                  continue;
                }
                try {
                  logger.info(`[AI Video Polling] Querying status at: ${currentUrl}`);
                  statusResponse = await aiHttp.get(currentUrl, { headers });
                  gotValidUrl = true;
                  taskStatusUrl = currentUrl;
                } catch (pollErr: any) {
                  if (pollErr.response?.status === 404 && urlIndex < taskUrls.length - 1) {
                    logger.warn(`[AI Video Polling 404] url=${currentUrl}, trying fallback URL...`);
                    urlIndex++;
                  } else {
                    throw pollErr;
                  }
                }
              }

              if (!gotValidUrl || !statusResponse) {
                throw new Error('无法获取任务状态，所有查询接口均返回 404。');
              }

              const statusData = statusResponse.data;
              const status = (statusData.status || statusData.data?.status || '').toLowerCase();

              sendSSE(res, {
                reasoning: `视频生成中... 进度: ${status === 'succeeded' ? '100' : status === 'processing' ? '进行中' : '排队中'} (尝试 ${attempts}/${maxAttempts})`,
                requestId,
              });

              if (status === 'succeeded') {
                finalVideoUrl =
                  statusData.result?.video_url ||
                  statusData.data?.result?.video_url ||
                  statusData.result?.url;
                pollCompleted = true;
              } else if (status === 'failed') {
                throw new Error(statusData.reason || statusData.message || '生成任务失败');
              }
            } catch (pollErr: any) {
              logger.warn(`[AI Video Polling Error] url=${taskStatusUrl}: ${pollErr.message}`);
            }
          }

          if (!finalVideoUrl && !pollCompleted) {
            throw new Error('视频生成超时，未能在规定时间内完成，请稍后检查。');
          }
        }

        let finalMarkdown = '';
        if (finalVideoUrl) {
          finalMarkdown = `Generated video for: **${cleanPrompt}**\n\n<video src="${finalVideoUrl}" controls style="max-width: 100%; border-radius: 12px; border: 1px solid rgba(148,163,184,0.2);"></video>`;
        }

        if (!finalMarkdown) {
          throw new Error('未获取到生成的视频数据，请检查视频接口响应格式。');
        }

        sendSSE(res, { text: finalMarkdown, requestId });

        if (userId) {
          try {
            const sId =
              typeof streamMetaForClient.sessionId === 'string'
                ? streamMetaForClient.sessionId
                : 'default';
            const sTitle =
              typeof streamMetaForClient.sessionTitle === 'string'
                ? streamMetaForClient.sessionTitle
                : '新对话';
            await prisma.aiMessage.create({
              data: {
                userId,
                role: 'assistant',
                content: finalMarkdown,
                reasoning: `使用视频模型 ${modelName} 生成视频。`,
                sessionId: sId,
                sessionTitle: sTitle,
              },
            });
            await touchAiChatSession({
              userId,
              sessionId: sId,
              sessionTitle: sTitle,
              mode: streamMetaForClient.mode,
            });
          } catch (dbErr) {
            logger.error('[AI Chat] Failed to save video message to DB:', dbErr);
          }
        }

        sendSSE(res, {
          event: 'done',
          requestId,
          usage: {
            outputChars: finalMarkdown.length,
            reasoningChars: 0,
          },
        });
        sendSSE(res, '[DONE]');
      } catch (error: unknown) {
        logger.error('[AI Video Generation Error]:', sanitizeAIError(error));
        sendSSE(res, {
          error: `视频生成失败: ${toUserFacingAIError(error, provider)}`,
          requestId,
        });
        sendSSE(res, '[DONE]');
      } finally {
        res.end();
      }
      return;
    }

    if (isImageGenerationModel(modelName, overrides?.capabilities, url)) {
      // Establish SSE stream headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.setHeader('Content-Encoding', 'none');
      res.flushHeaders();

      sendSSE(res, {
        event: 'meta',
        requestId,
        provider,
        model: modelName,
        ...streamMetaForClient,
      });

      sendSSE(res, {
        reasoning: `正在为您使用生图模型 ${modelName} 生成图片，请稍候...\n(Please wait while generating image using model: ${modelName})`,
        requestId,
      });

      try {
        const lastUserMsg = messages[messages.length - 1]?.content || '画一幅精美的3D模型渲染图';
        const cleanPrompt = lastUserMsg.replace(/\[图片\]/g, '').trim();
        const imgUrl = cleanImageEndpointUrl(url);

        // 1. Flexible size control (灵活的尺寸控制)
        let size = '1024x1024';
        const sizeMatch = cleanPrompt.match(/(\d{3,4})[xX](\d{3,4})/);
        if (sizeMatch) {
          size = `${sizeMatch[1]}x${sizeMatch[2]}`;
        }

        // 2. Base64 vs URL return format (Base64返回 / 网址返回)
        let responseFormat = 'url';
        if (cleanPrompt.toLowerCase().includes('base64')) {
          responseFormat = 'b64_json';
        }

        // 3. Image-to-Image input (URL 或数据 URI 输入 / 图生图)
        const { images: inputImages } = await extractImagesAndText(lastUserMsg);
        let inputImage: string | undefined;
        if (inputImages && inputImages.length > 0) {
          const firstImg = inputImages[0];
          if (firstImg) {
            inputImage = `data:${firstImg.mimeType};base64,${firstImg.data}`;
          }
        }

        logger.info(
          `[AI Image Generation] requestId=${requestId} provider=${provider} model=${modelName} url=${maskUrlApiKey(imgUrl)} size=${size} format=${responseFormat} isImg2Img=${!!inputImage}`,
        );

        // 4. Request payload setup including Structure Preservation (结构保持) and High Information Density (高信息密度)
        const imageBody: any = {
          model: modelName,
          prompt: cleanPrompt,
          n: 1,
          size,
          ...(responseFormat !== 'url' && { response_format: responseFormat }),
        };

        if (provider === 'AGNES') {
          // High Information Density Image Optimization (高信息密度图像优化)
          imageBody.high_density = true;
          imageBody.density = 'high';
          imageBody.quality = 'hd';
          imageBody.extra_body = {
            high_density: true,
            density: 'high',
            quality: 'hd',
          };

          if (inputImage) {
            imageBody.image = inputImage;
            imageBody.image_url = inputImage;
            // Structure Preservation (结构保持)
            imageBody.structure_preservation = true;
            imageBody.keep_structure = true;
            imageBody.structure_strength = 0.8;

            imageBody.extra_body.image = inputImage;
            imageBody.extra_body.image_url = inputImage;
            imageBody.extra_body.structure_preservation = true;
            imageBody.extra_body.keep_structure = true;
            imageBody.extra_body.structure_strength = 0.8;
          }
        } else {
          if (inputImage) {
            imageBody.image = inputImage;
            imageBody.image_url = inputImage;
          }
        }

        const response = await aiHttp.post(imgUrl, imageBody, {
          headers,
          timeout: AI_STREAM_TIMEOUT_MS,
          signal: controller.signal,
        });

        const responseData = response.data;
        const imgData = responseData.data?.[0];
        let finalMarkdown = '';

        if (imgData) {
          const urlOrBase64 =
            imgData.url || (imgData.b64_json ? `data:image/png;base64,${imgData.b64_json}` : null);
          if (urlOrBase64) {
            const displayPrompt =
              cleanPrompt.substring(0, 80) + (cleanPrompt.length > 80 ? '...' : '');
            finalMarkdown = `![${displayPrompt}](${urlOrBase64})`;
          }
        }

        if (!finalMarkdown) {
          throw new Error('未获取到生成的图片数据，请检查生图接口响应格式。');
        }

        // Stream back the markdown image
        sendSSE(res, { text: finalMarkdown, requestId });

        // Save to database
        if (userId) {
          try {
            const sId =
              typeof streamMetaForClient.sessionId === 'string'
                ? streamMetaForClient.sessionId
                : 'default';
            const sTitle =
              typeof streamMetaForClient.sessionTitle === 'string'
                ? streamMetaForClient.sessionTitle
                : '新对话';
            await prisma.aiMessage.create({
              data: {
                userId,
                role: 'assistant',
                content: finalMarkdown,
                reasoning: `使用生图模型 ${modelName} 生成图片。`,
                sessionId: sId,
                sessionTitle: sTitle,
              },
            });
            await touchAiChatSession({
              userId,
              sessionId: sId,
              sessionTitle: sTitle,
              mode: streamMetaForClient.mode,
            });
          } catch (dbErr) {
            logger.error('[AI Chat] Failed to save image message to DB:', dbErr);
          }
        }

        sendSSE(res, {
          event: 'done',
          requestId,
          usage: {
            outputChars: finalMarkdown.length,
            reasoningChars: 0,
          },
        });
        sendSSE(res, '[DONE]');
        res.end();
        cleanupPersistentRun();
        return;
      } catch (err) {
        logger.error('[AI Image Generation Error]:', sanitizeAIError(err));
        const errMsg = toUserFacingAIError(err, provider);
        sendSSE(res, { error: `图片生成失败: ${errMsg}`, requestId });
        sendSSE(res, '[DONE]');
        res.end();
        cleanupPersistentRun();
        return;
      }
    }

    // Establish SSE stream headers ONLY after config was prepared successfully if not already sent
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering in Nginx
      res.setHeader('Content-Encoding', 'none'); // Prevent compression buffering
      res.flushHeaders();
    }

    res.on('close', () => {
      if (!completed) {
        const run = persistentRunKey ? activePersistentAiRuns.get(persistentRunKey) : null;
        if (shouldPersistOnDisconnect && !run?.cancelled) {
          logger.info(
            `[AI Streaming Chat] requestId=${requestId} client connection closed. Continuing persistent run.`,
          );
          return;
        }
        logger.info(
          `[AI Streaming Chat] requestId=${requestId} client connection closed. Aborting upstream request.`,
        );
        controller.abort();
      }
    });

    sendSSE(res, {
      event: 'meta',
      requestId,
      provider,
      model: modelName,
      ...streamMetaForClient,
    });

    heartbeatTimer = setInterval(() => {
      if (!completed && !res.writableEnded) {
        sendSSE(res, { event: 'heartbeat', requestId, ts: Date.now() });
      }
    }, AI_STREAM_HEARTBEAT_MS);

    logger.info(
      `[AI Streaming Chat] requestId=${requestId} provider=${provider} model=${modelName} url=${maskUrlApiKey(url)}`,
    );

    const response = await aiHttp.post(url, body, {
      headers,
      responseType: 'stream',
      timeout: AI_STREAM_TIMEOUT_MS,
      signal: controller.signal,
    });

    const stream = response.data;
    let lastActivityTime = Date.now();
    /** Longer window so deep-research mode (which can take 60-90 s before the first LLM token) doesn't self-abort. */
    const STREAM_ACTIVITY_TIMEOUT_MS = 120_000;

    activityTimer = setInterval(() => {
      if (!completed) {
        const inactiveTime = Date.now() - lastActivityTime;
        if (inactiveTime > STREAM_ACTIVITY_TIMEOUT_MS) {
          logger.warn(
            `[AI Streaming Chat] requestId=${requestId} stream activity timeout (inactive for ${inactiveTime}ms). Aborting.`,
          );
          controller.abort();
          if (!completed) {
            completed = true;
            if (heartbeatTimer) {
              clearInterval(heartbeatTimer);
              heartbeatTimer = null;
            }
            if (activityTimer) {
              clearInterval(activityTimer);
              activityTimer = null;
            }
            cleanupPersistentRun();
            if (!res.writableEnded) {
              sendSSE(res, { error: 'AI服务响应超时，已自动断开连接。请重试。', requestId });
              res.end();
            }
          }
        }
      }
    }, 5000);

    let buffer = '';
    let assistantContent = '';
    let assistantReasoning = '';

    let assistantToolCalls: any[] = [];
    const appendAssistantChunk = (payload: {
      text?: string;
      reasoning?: string;
      tool_calls?: any[];
    }) => {
      if (payload.reasoning) {
        assistantReasoning += payload.reasoning;
        sendSSE(res, { reasoning: payload.reasoning, requestId });
      }
      if (payload.text) {
        assistantContent += payload.text;
        sendSSE(res, { text: payload.text, requestId });
      }
      if (payload.tool_calls) {
        assistantToolCalls = mergeToolCalls(assistantToolCalls, payload.tool_calls);
        sendSSE(res, { tool_calls: payload.tool_calls, requestId });
      }
      if (persistentRunKey) {
        const run = activePersistentAiRuns.get(persistentRunKey);
        if (run) {
          run.content = assistantContent;
          run.reasoning = assistantReasoning;
        }
      }
    };

    const processProviderLine = (line: string) => {
      const cleanLine = line.trim();
      if (!cleanLine || cleanLine === 'data: [DONE]') return;
      if (cleanLine.startsWith('event:') || cleanLine.startsWith(':')) return;

      const isSse = cleanLine.startsWith('data: ');
      if (!isSse && !cleanLine.startsWith('{') && !cleanLine.startsWith('[')) return;

      try {
        const jsonStr = isSse ? cleanLine.substring(6) : cleanLine;
        const parsed = JSON.parse(jsonStr);

        if (provider === 'GEMINI') {
          const parts = parsed.candidates?.[0]?.content?.parts;
          if (Array.isArray(parts)) {
            for (const part of parts) {
              if (part.text) {
                if (part.thought) {
                  appendAssistantChunk({ reasoning: part.text });
                } else {
                  appendAssistantChunk({ text: part.text });
                }
              }
            }
          }
        } else if (provider === 'OLLAMA') {
          const text = parsed.message?.content || parsed.response;
          if (text) {
            appendAssistantChunk({ text });
          }
          if (parsed.error) {
            appendAssistantChunk({ text: `\n[错误: ${parsed.error}]` });
          }
        } else if (provider === 'AGNES') {
          if (parsed.type === 'content_block_delta') {
            if (parsed.delta?.type === 'text_delta') {
              const text = parsed.delta?.text;
              if (text) appendAssistantChunk({ text });
            } else if (parsed.delta?.type === 'thinking_delta') {
              const reasoning = parsed.delta?.thinking;
              if (reasoning) appendAssistantChunk({ reasoning });
            } else if (parsed.delta?.type === 'input_json_delta') {
              const toolCallDelta = [
                {
                  index: parsed.index ?? 0,
                  function: {
                    arguments: parsed.delta.partial_json,
                  },
                },
              ];
              appendAssistantChunk({ tool_calls: toolCallDelta });
            }
          } else if (parsed.type === 'content_block_start') {
            if (parsed.content_block?.type === 'tool_use') {
              const toolCallStart = [
                {
                  index: parsed.index ?? 0,
                  id: parsed.content_block.id,
                  function: {
                    name: parsed.content_block.name,
                  },
                },
              ];
              appendAssistantChunk({ tool_calls: toolCallStart });
            }
          } else {
            const content = parsed.choices?.[0]?.delta?.content;
            const reasoning = parsed.choices?.[0]?.delta?.reasoning_content;
            const toolCalls = parsed.choices?.[0]?.delta?.tool_calls;
            appendAssistantChunk({ text: content, reasoning, tool_calls: toolCalls });
          }
        } else {
          const content = parsed.choices?.[0]?.delta?.content;
          const reasoning = parsed.choices?.[0]?.delta?.reasoning_content;
          const toolCalls = parsed.choices?.[0]?.delta?.tool_calls;
          appendAssistantChunk({ text: content, reasoning, tool_calls: toolCalls });
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn(
          `[AI Stream Parse Warning] requestId=${requestId} failed to parse provider chunk: ${message}`,
        );
      }
    };

    const finalizeStream = async () => {
      if (completed) return;
      if (buffer.trim()) {
        processProviderLine(buffer);
        buffer = '';
      }
      completed = true;
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      if (activityTimer) {
        clearInterval(activityTimer);
        activityTimer = null;
      }
      // Mark the run as done BEFORE DB write so the polling client can
      // see the final content immediately; cleanup happens AFTER DB write.
      if (persistentRunKey) {
        const run = activePersistentAiRuns.get(persistentRunKey);
        if (run) run.done = true;
      }

      if (userId && assistantContent) {
        try {
          const sId =
            typeof streamMetaForClient.sessionId === 'string'
              ? streamMetaForClient.sessionId
              : 'default';
          const sTitle =
            typeof streamMetaForClient.sessionTitle === 'string'
              ? streamMetaForClient.sessionTitle
              : '新对话';

          let finalReasoning = assistantReasoning || '';
          if (
            Array.isArray(streamMetaForClient.sources) &&
            streamMetaForClient.sources.length > 0
          ) {
            finalReasoning = `${finalReasoning}\n[sources]: ${JSON.stringify(streamMetaForClient.sources)}`;
          }

          await prisma.aiMessage.create({
            data: {
              userId,
              role: 'assistant',
              content: assistantContent,
              reasoning: finalReasoning || null,
              sessionId: sId,
              sessionTitle: sTitle,
            },
          });
          await touchAiChatSession({
            userId,
            sessionId: sId,
            sessionTitle: sTitle,
            mode: streamMetaForClient.mode,
          });
        } catch (dbErr) {
          logger.error('[AI Chat] Failed to save assistant message to DB:', dbErr);
        }
      }

      // Now safe to remove from memory — DB write is complete
      cleanupPersistentRun();

      if (!res.writableEnded) {
        sendSSE(res, {
          event: 'done',
          requestId,
          usage: {
            outputChars: assistantContent.length,
            reasoningChars: assistantReasoning.length,
          },
        });
        sendSSE(res, '[DONE]');
        res.end();
      }
    };

    stream.on('data', (chunk: Buffer) => {
      lastActivityTime = Date.now();
      buffer += chunk.toString('utf8');
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        processProviderLine(line);
      }
    });

    stream.on('end', finalizeStream);

    stream.on('error', (err: Error) => {
      if (completed) return;
      completed = true;
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      if (activityTimer) {
        clearInterval(activityTimer);
        activityTimer = null;
      }
      cleanupPersistentRun();
      logger.error(`[AI Stream Source Error] requestId=${requestId}:`, sanitizeAIError(err));
      if (!res.writableEnded) {
        // Convert raw Node.js network errors to user-friendly messages
        const friendlyMsg = toUserFacingAIError(err, activeProvider);
        sendSSE(res, { error: friendlyMsg, requestId });
        res.end();
      }
    });
  } catch (error: unknown) {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    if (activityTimer) {
      clearInterval(activityTimer);
      activityTimer = null;
    }
    cleanupPersistentRun();
    completed = true;
    logger.error('[AI Streaming Request Error]:', sanitizeAIError(error));
    let errMsg = toUserFacingAIError(error, activeProvider);
    const err = getErrorRecord(error);
    const response = getErrorRecord(err.response);
    const responseData = response.data;
    if (
      responseData &&
      typeof responseData === 'object' &&
      'read' in responseData &&
      typeof responseData.read === 'function'
    ) {
      try {
        const errorData = responseData.read()?.toString('utf8');
        if (errorData) {
          const parsed = JSON.parse(errorData);
          errMsg = parsed.error?.message || errMsg;
        }
      } catch (_err) {
        // Ignore JSON parsing errors of stream error payloads
      }
    }
    if (res.headersSent) {
      sendSSE(res, { error: errMsg });
      res.end();
    } else {
      next(error);
    }
  }
}

/**
 * Calls the LLM with automatic failover across all configured model × key combinations.
 * Tries each entry in priority order until one succeeds.
 * Falls back to global settings if no models are configured.
 */
export async function callLLMWithFailover(
  prompt: string,
  systemPrompt: string,
  timeoutMs: number = AI_REQUEST_TIMEOUT_MS,
): Promise<string> {
  const settings = await settingsService.getAll();

  let models: AIModelOption[] = [];
  if (settings.AI_MODEL_OPTIONS) {
    try {
      const parsed = JSON.parse(settings.AI_MODEL_OPTIONS);
      if (Array.isArray(parsed)) {
        models = parsed as AIModelOption[];
      }
    } catch {
      // ignore parse error, fall through to single call
    }
  }

  const chain = resolveModelKeyChain(models);

  if (chain.length === 0) {
    // No models configured — fall back to global settings
    return callLLM(prompt, systemPrompt, undefined, timeoutMs);
  }

  let lastError: Error | null = null;
  const failedLabels: string[] = [];

  for (const entry of chain) {
    const label = `${entry.model.name || entry.model.id || entry.model.modelName}(key#${failedLabels.length + 1})`;
    const overrides: Partial<AIServiceConfig> = {
      AI_IMPORT_ENABLED: true,
      AI_PROVIDER: entry.model.provider,
      AI_API_KEY: entry.apiKey || settings.AI_API_KEY,
      AI_API_ENDPOINT: entry.model.endpoint || settings.AI_API_ENDPOINT,
      AI_MODEL_NAME: entry.model.modelName,
      capabilities: entry.model.capabilities,
    };
    try {
      if (failedLabels.length > 0) {
        logger.info(
          `[AI Failover] Retrying with model: ${label} (after ${failedLabels.length} failure(s))`,
        );
      }
      const result = await callLLM(prompt, systemPrompt, overrides, timeoutMs);
      if (failedLabels.length > 0) {
        logger.info(`[AI Failover] Succeeded with model: ${label}`);
      }
      return result;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      failedLabels.push(label);
      logger.warn(`[AI Failover] Model ${label} failed: ${lastError.message}. Trying next...`);
    }
  }

  logger.error(
    `[AI Failover] All ${chain.length} model/key combination(s) failed. Tried: ${failedLabels.join(', ')}`,
  );
  throw lastError ?? new Error('所有 AI 模型均不可用，请联系管理员检查配置。');
}

/**
 * Streams LLM chat with automatic failover on initial connection.
 * Only attempts failover BEFORE streaming starts — if the connection drops mid-stream,
 * the error is forwarded to the client to avoid delivering duplicate content.
 */
export async function streamLLMChatWithFailover(
  messages: AIChatMessage[],
  systemPrompt: string,
  res: Response,
  next: NextFunction,
  userId?: string,
  streamMeta?: Record<string, unknown>,
): Promise<void> {
  const settings = await settingsService.getAll();

  let models: AIModelOption[] = [];
  if (settings.AI_MODEL_OPTIONS) {
    try {
      const parsed = JSON.parse(settings.AI_MODEL_OPTIONS);
      if (Array.isArray(parsed)) {
        models = parsed as AIModelOption[];
      }
    } catch {
      // ignore
    }
  }

  const chain = resolveModelKeyChain(models);

  if (chain.length === 0) {
    // No models configured — use global settings directly
    return streamLLMChat(messages, systemPrompt, res, next, undefined, userId, streamMeta);
  }

  let lastError: Error | null = null;

  for (let i = 0; i < chain.length; i++) {
    const entry = chain[i];
    if (!entry) continue;
    const isLast = i === chain.length - 1;

    // Once headers are sent, we cannot attempt another model
    if (res.headersSent && !isLast) {
      logger.warn(
        `[AI Stream Failover] Headers already sent after model ${entry.model.name}; stopping failover.`,
      );
      break;
    }

    const overrides: Partial<AIServiceConfig> = {
      AI_IMPORT_ENABLED: true,
      AI_PROVIDER: entry.model.provider,
      AI_API_KEY: entry.apiKey || settings.AI_API_KEY,
      AI_API_ENDPOINT: entry.model.endpoint || settings.AI_API_ENDPOINT,
      AI_MODEL_NAME: entry.model.modelName,
      capabilities: entry.model.capabilities,
    };

    try {
      if (i > 0) {
        logger.info(
          `[AI Stream Failover] Retrying with model: ${entry.model.name || entry.model.id}`,
        );
      }
      await streamLLMChat(messages, systemPrompt, res, next, overrides, userId, streamMeta);
      return; // success — done
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      logger.warn(
        `[AI Stream Failover] Model ${entry.model.name || entry.model.id} failed: ${lastError.message}`,
      );
      if (!isLast && !res.headersSent) {
        continue;
      }
      break;
    }
  }

  // If we get here, all entries failed
  if (!res.headersSent) {
    next(lastError ?? new Error('所有 AI 模型均不可用'));
  } else if (!res.writableEnded) {
    res.end();
  }
}

/**
 * Standard single-turn image generation call.
 * Uses OpenAI-compatible /images/generations endpoint format.
 */
export async function generateImage(
  prompt: string,
  overrides?: Partial<AIServiceConfig>,
  timeoutMs: number = AI_REQUEST_TIMEOUT_MS,
  size?: string,
): Promise<{ url?: string; b64_json?: string }> {
  const settings = await settingsService.getAll();
  let provider = normalizeProvider(overrides?.AI_PROVIDER ?? settings.AI_PROVIDER);
  const apiKey = normalizeParam(overrides?.AI_API_KEY ?? settings.AI_API_KEY);
  const endpoint = normalizeParam(overrides?.AI_API_ENDPOINT ?? settings.AI_API_ENDPOINT);
  const modelName = resolveModelName(
    provider,
    normalizeParam(overrides?.AI_MODEL_NAME ?? settings.AI_MODEL_NAME),
  );

  let finalSize = size || '1024x1024';
  const modelLower = modelName.toLowerCase();
  const isDalle3 = modelLower.includes('dall-e-3') || modelLower.includes('dalle3');
  const isDalle2 = modelLower.includes('dall-e-2') || modelLower.includes('dalle2') || modelLower === 'dall-e';
  
  if (isDalle3) {
    if (finalSize === '1792x768') {
      finalSize = '1792x1024'; // DALL-E 3 only supports 1792x1024 for landscape
    } else if (finalSize !== '1024x1024' && finalSize !== '1024x1792') {
      finalSize = '1024x1024';
    }
  } else if (isDalle2) {
    finalSize = '1024x1024';
  }

  const enabled = overrides?.AI_IMPORT_ENABLED ?? settings.AI_IMPORT_ENABLED;
  // When overrides is provided (e.g., called internally from generateImageWithFailover),
  // the caller is responsible for ensuring AI is enabled (overrides.AI_IMPORT_ENABLED = true).
  // Only enforce the global enabled check for direct external calls (overrides === undefined).
  if (!enabled && overrides === undefined) {
    throw new Error('AI 功能未启用，请联系管理员在系统后台开启。');
  }

  if (!apiKey && provider !== 'OLLAMA') {
    throw new Error(`提供商 ${provider} 需要配置 API 密钥 (API Key)。`);
  }

  const baseEndpoint = endpoint || DEFAULT_PROVIDER_ENDPOINTS[provider] || endpoint;
  const imgUrl = cleanImageEndpointUrl(baseEndpoint);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (apiKey) {
    if (provider === 'AZURE') {
      headers['api-key'] = apiKey;
    } else if (provider === 'GEMINI') {
      // Key is appended to query string
    } else {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
  }

  let finalUrl = imgUrl;
  if (provider === 'GEMINI' && apiKey) {
    finalUrl = `${imgUrl}?key=${apiKey}`;
  }

  const imageBody: any = {
    model: modelName,
    prompt: prompt,
    n: 1,
    size: finalSize,
  };

  if (provider === 'AGNES') {
    imageBody.high_density = true;
    imageBody.density = 'high';
    imageBody.quality = 'hd';
    imageBody.extra_body = {
      high_density: true,
      density: 'high',
      quality: 'hd',
    };
  }

  logger.info(
    `[AI Image Service] Calling image generation: provider=${provider} model=${modelName} url=${maskUrlApiKey(finalUrl)}`
  );

  try {
    const response = await aiHttp.post(finalUrl, imageBody, {
      headers,
      timeout: timeoutMs,
    });

    const responseData = response.data;
    const imgData = responseData.data?.[0];
    if (!imgData) {
      throw new Error('未获取到生成的图片数据，请检查生图接口响应格式。');
    }

    let b64 = imgData.b64_json || null;
    if (!b64 && imgData.url) {
      try {
        const fetched = await fetchExternalImage(imgData.url);
        if (fetched) {
          b64 = fetched.data;
        }
      } catch (fetchErr) {
        logger.warn(`[AI Image Service] Failed to fetch generated image to base64:`, fetchErr);
      }
    }

    return {
      url: imgData.url,
      b64_json: b64,
    };
  } catch (error: unknown) {
    logger.error(`[AI Image Service Error (${provider})]:`, sanitizeAIError(error));
    throw new Error(toUserFacingAIError(error, provider));
  }
}

/**
 * Generates an image using configured image models with automatic failover support.
 */
export async function generateImageWithFailover(
  prompt: string,
  modelId?: string,
  timeoutMs: number = AI_REQUEST_TIMEOUT_MS,
  size?: string,
): Promise<{ url?: string; b64_json?: string }> {
  const settings = await settingsService.getAll();

  let models: AIModelOption[] = [];
  if (settings.AI_MODEL_OPTIONS) {
    try {
      const parsed = JSON.parse(settings.AI_MODEL_OPTIONS);
      if (Array.isArray(parsed)) {
        models = parsed as AIModelOption[];
      }
    } catch {
      // ignore
    }
  }

  const isImgGen = (m: AIModelOption) =>
    m.enabled && isImageGenerationModel(m.modelName || '', m.capabilities, m.endpoint);

  let imageModels = models.filter(isImgGen);

  // If a specific modelId is selected, prioritize it
  if (modelId) {
    const selected = models.find((m) => m.id === modelId && m.enabled);
    if (selected) {
      imageModels = [selected, ...imageModels.filter((m) => m.id !== modelId)];
    }
  }

  const chain = resolveModelKeyChain(imageModels);

  if (chain.length === 0) {
    // If the global settings is not an image generation model, throw a clear error to instruct configuration.
    const isGlobalImgGen = isImageGenerationModel(
      settings.AI_MODEL_NAME || '',
      undefined,
      settings.AI_API_ENDPOINT
    );
    if (!isGlobalImgGen) {
      throw new Error('系统尚未配置任何“图像生成”模型（如 DALL-E 3、Flux、Stable Diffusion 等）。请联系管理员在后台 AI 设置中添加具备 draw 或 image 能力的图像生成模型。');
    }
    // Fallback to global setting directly
    return generateImage(prompt, undefined, timeoutMs, size);
  }

  let lastError: Error | null = null;
  const failedLabels: string[] = [];

  for (const entry of chain) {
    const label = `${entry.model.name || entry.model.id || entry.model.modelName}(key#${failedLabels.length + 1})`;
    const overrides: Partial<AIServiceConfig> = {
      AI_IMPORT_ENABLED: true,
      AI_PROVIDER: entry.model.provider,
      AI_API_KEY: entry.apiKey || settings.AI_API_KEY,
      AI_API_ENDPOINT: entry.model.endpoint || settings.AI_API_ENDPOINT,
      AI_MODEL_NAME: entry.model.modelName,
      capabilities: entry.model.capabilities,
    };
    try {
      if (failedLabels.length > 0) {
        logger.info(
          `[AI Image Failover] Retrying image generation with model: ${label} (after ${failedLabels.length} failure(s))`
        );
      }
      const result = await generateImage(prompt, overrides, timeoutMs, size);
      if (failedLabels.length > 0) {
        logger.info(`[AI Image Failover] Succeeded with model: ${label}`);
      }
      return result;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      failedLabels.push(label);
      logger.warn(`[AI Image Failover] Model ${label} failed: ${lastError.message}. Trying next...`);
    }
  }

  logger.error(
    `[AI Image Failover] All ${chain.length} model/key combination(s) failed. Tried: ${failedLabels.join(', ')}`
  );
  throw lastError ?? new Error('所有生图 AI 模型均不可用，请联系管理员检查配置。');
}

