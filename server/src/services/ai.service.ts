import axios from 'axios';
import { Response } from 'express';
import { settingsService } from './settings.service';
import { logger } from '../utils/logger';
import prisma from './prisma';
import path from 'path';
import fs from 'fs';

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

type AIProvider = 'DEEPSEEK' | 'OPENAI' | 'AZURE' | 'GEMINI' | 'OLLAMA' | string;

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
  GEMINI: 'https://generativelanguage.googleapis.com',
  OLLAMA: 'http://localhost:11434/api',
  CUSTOM: '',
};

const DEFAULT_PROVIDER_MODELS: Record<string, string> = {
  DEEPSEEK: 'deepseek-chat',
  OPENAI: 'gpt-4o-mini',
  QWEN: 'qwen-plus',
  GEMINI: 'gemini-1.5-flash',
  OLLAMA: 'llama3',
  CUSTOM: '',
};

const AI_REQUEST_TIMEOUT_MS = 60_000;
/** Generous timeout for streaming responses — deep research mode can take 60-90 s before the LLM starts generating. */
const AI_STREAM_TIMEOUT_MS = 180_000;
const AI_STREAM_HEARTBEAT_MS = 15_000;

function createRequestId(): string {
  return `ai_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
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

/**
 * Normalizes endpoint URL to robustly append /images/generations for image models.
 */
function cleanImageEndpointUrl(url: string | undefined | null): string {
  if (!url) return '';
  let cleaned = normalizeParam(url);
  cleaned = cleaned.replace(/\/+$/, '');
  if (cleaned.endsWith('/chat/completions')) {
    cleaned = cleaned.substring(0, cleaned.length - '/chat/completions'.length);
  }
  cleaned = cleaned.replace(/\/+$/, '');
  if (!cleaned.endsWith('/images/generations')) {
    cleaned += '/images/generations';
  }
  return cleaned;
}

/**
 * Detects if a model is an image generation model based on its name or capabilities.
 */
function isImageGenerationModel(modelName: string, capabilities?: string[]): boolean {
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
    name.includes('image') ||
    name.includes('draw') ||
    name.includes('paint') ||
    name.includes('generate')
  );
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
    errMsg =
      provider === 'OLLAMA'
        ? 'Ollama 接口未找到，请确认本地服务已启动且 Endpoint 指向 http://localhost:11434/api。'
        : 'API 终端未找到 (404)。如果使用自定义 API Endpoint，请确认地址是否正确，或是否需要补全 /chat/completions。';
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

async function extractImagesAndText(
  content: string,
): Promise<{ text: string; images: AIImagePayload[] }> {
  const imageRegex = /!\[.*?\]\((.*?)\)/g;
  let match;
  const images: AIImagePayload[] = [];

  while ((match = imageRegex.exec(content)) !== null) {
    const imgUrl = match[1];
    if (!imgUrl || images.length >= MAX_AI_IMAGES_PER_MESSAGE) continue;

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
  const cleanText = content.replace(/!\[.*?\]\((.*?)\)/g, '[图片]');
  return { text: cleanText, images };
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
  if (res.writableEnded) return;
  if (payload === '[DONE]') {
    res.write('data: [DONE]\n\n');
  } else {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  }
  const flushableRes = res as Response & { flush?: () => void };
  if (typeof flushableRes.flush === 'function') {
    flushableRes.flush();
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
  } = {},
): Promise<PreparedAIRequest> {
  const settings = await settingsService.getAll();

  const provider = normalizeProvider(overrides?.AI_PROVIDER ?? settings.AI_PROVIDER);
  const apiKey = normalizeParam(overrides?.AI_API_KEY ?? settings.AI_API_KEY);
  const endpoint = resolveEndpoint(
    provider,
    normalizeParam(overrides?.AI_API_ENDPOINT ?? settings.AI_API_ENDPOINT),
  );
  const modelName = resolveModelName(
    provider,
    normalizeParam(overrides?.AI_MODEL_NAME ?? settings.AI_MODEL_NAME),
  );
  const enabled = overrides?.AI_IMPORT_ENABLED ?? settings.AI_IMPORT_ENABLED;
  const requestId = createRequestId();

  if (!enabled && !overrides) {
    throw new Error('AI 功能未启用，请联系管理员在系统后台开启。');
  }

  if (!apiKey && provider !== 'OLLAMA') {
    throw new Error(`提供商 ${provider} 需要配置 API 密钥 (API Key)。`);
  }

  // Look up model config for custom parameters
  let matchingModel: any = null;
  if (settings.AI_MODEL_OPTIONS) {
    try {
      const models = JSON.parse(settings.AI_MODEL_OPTIONS);
      if (Array.isArray(models)) {
        matchingModel = models.find(
          (m: any) =>
            m.enabled &&
            String(m.provider).toUpperCase() === String(provider).toUpperCase() &&
            m.modelName === modelName,
        );
        if (!matchingModel) {
          matchingModel = models.find((m: any) => m.enabled && m.isDefault);
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
  } else if (
    provider === 'GEMINI' &&
    (!endpoint || endpoint.includes('generativelanguage.googleapis.com'))
  ) {
    const model = modelName || 'gemini-1.5-flash';
    if (isSingleTurn) {
      url = `https://generativelanguage.googleapis.com/v1/models/${model}:${stream ? 'streamGenerateContent?alt=sse&' : 'generateContent?'}key=${apiKey}`;
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
        },
      };
    } else {
      const geminiContents = await Promise.all(
        messages.map(async (m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: await formatGeminiParts(m.content),
        })),
      );
      url = `https://generativelanguage.googleapis.com/v1/models/${model}:${stream ? 'streamGenerateContent?alt=sse&' : 'generateContent?'}key=${apiKey}`;
      body = {
        contents: geminiContents,
        systemInstruction: {
          parts: [{ text: finalSystemPrompt }],
        },
        generationConfig: {
          temperature,
          ...(maxTokens && { maxOutputTokens: maxTokens }),
        },
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
    body = {
      model: modelName,
      messages: isSingleTurn
        ? [{ role: 'system', content: finalSystemPrompt }, openAiUserMsg]
        : [{ role: 'system', content: finalSystemPrompt }, ...openAiMessages],
      temperature,
      max_tokens: maxTokens ?? (stream ? 8192 : 4096),
      ...(stream && { stream: true }),
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
    const response = await axios.post(url, body, {
      headers,
      timeout: timeoutMs,
    });

    if (
      provider === 'GEMINI' &&
      !overrides?.AI_API_ENDPOINT &&
      url.includes('generativelanguage.googleapis.com')
    ) {
      const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
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
    } else {
      const text = response.data?.choices?.[0]?.message?.content;
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

  if (isImageGenerationModel(modelName, overrides?.capabilities)) {
    try {
      const imgUrl = cleanImageEndpointUrl(url);
      logger.info(
        `[AI Service Image Test] requestId=${requestId} provider=${provider} model=${modelName} url=${maskUrlApiKey(imgUrl)}`,
      );

      const response = await axios.post(
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
  overrides?: Partial<AIServiceConfig>,
  userId?: string,
  streamMeta?: Record<string, unknown>,
): Promise<void> {
  const controller = new AbortController();
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let activityTimer: ReturnType<typeof setInterval> | null = null;
  let completed = false;
  let activeProvider: AIProvider = normalizeProvider(overrides?.AI_PROVIDER);

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

    if (isImageGenerationModel(modelName, overrides?.capabilities)) {
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
        ...streamMeta,
      });

      sendSSE(res, {
        reasoning: `正在为您使用生图模型 ${modelName} 生成图片，请稍候...\n(Please wait while generating image using model: ${modelName})`,
        requestId,
      });

      try {
        const lastUserMsg = messages[messages.length - 1]?.content || '画一幅精美的3D模型渲染图';
        const cleanPrompt = lastUserMsg.replace(/\[图片\]/g, '').trim();
        const imgUrl = cleanImageEndpointUrl(url);

        logger.info(
          `[AI Image Generation] requestId=${requestId} provider=${provider} model=${modelName} url=${maskUrlApiKey(imgUrl)}`,
        );

        const response = await axios.post(
          imgUrl,
          {
            model: modelName,
            prompt: cleanPrompt,
            n: 1,
            size: '1024x1024',
          },
          {
            headers,
            timeout: AI_STREAM_TIMEOUT_MS,
          },
        );

        const responseData = response.data;
        const imgData = responseData.data?.[0];
        let finalMarkdown = '';

        if (imgData) {
          const urlOrBase64 =
            imgData.url || (imgData.b64_json ? `data:image/png;base64,${imgData.b64_json}` : null);
          if (urlOrBase64) {
            finalMarkdown = `![${cleanPrompt}](${urlOrBase64})`;
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
              streamMeta && typeof streamMeta.sessionId === 'string'
                ? streamMeta.sessionId
                : 'default';
            const sTitle =
              streamMeta && typeof streamMeta.sessionTitle === 'string'
                ? streamMeta.sessionTitle
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
        return;
      } catch (err) {
        logger.error('[AI Image Generation Error]:', sanitizeAIError(err));
        const errMsg = toUserFacingAIError(err, provider);
        sendSSE(res, { error: `图片生成失败: ${errMsg}`, requestId });
        res.end();
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
      ...streamMeta,
    });

    heartbeatTimer = setInterval(() => {
      if (!completed && !res.writableEnded) {
        sendSSE(res, { event: 'heartbeat', requestId, ts: Date.now() });
      }
    }, AI_STREAM_HEARTBEAT_MS);

    logger.info(
      `[AI Streaming Chat] requestId=${requestId} provider=${provider} model=${modelName} url=${maskUrlApiKey(url)}`,
    );

    const response = await axios.post(url, body, {
      headers,
      responseType: 'stream',
      timeout: AI_STREAM_TIMEOUT_MS,
      signal: controller.signal,
    });

    const stream = response.data;
    let lastActivityTime = Date.now();
    /** Longer window so deep-research mode (which can take 60-90 s before the first LLM token) doesn't self-abort. */
    const STREAM_ACTIVITY_TIMEOUT_MS = 40_000;

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

    const appendAssistantChunk = (payload: { text?: string; reasoning?: string }) => {
      if (payload.reasoning) {
        assistantReasoning += payload.reasoning;
        sendSSE(res, { reasoning: payload.reasoning, requestId });
      }
      if (payload.text) {
        assistantContent += payload.text;
        sendSSE(res, { text: payload.text, requestId });
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
          const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            appendAssistantChunk({ text });
          }
        } else if (provider === 'OLLAMA') {
          const text = parsed.message?.content || parsed.response;
          if (text) {
            appendAssistantChunk({ text });
          }
          if (parsed.error) {
            appendAssistantChunk({ text: `\n[错误: ${parsed.error}]` });
          }
        } else {
          const content = parsed.choices?.[0]?.delta?.content;
          const reasoning = parsed.choices?.[0]?.delta?.reasoning_content;
          appendAssistantChunk({ text: content, reasoning });
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

      if (userId && assistantContent) {
        try {
          const sId =
            streamMeta && typeof streamMeta.sessionId === 'string'
              ? streamMeta.sessionId
              : 'default';
          const sTitle =
            streamMeta && typeof streamMeta.sessionTitle === 'string'
              ? streamMeta.sessionTitle
              : '新对话';

          let finalReasoning = assistantReasoning || '';
          if (streamMeta && Array.isArray(streamMeta.sources) && streamMeta.sources.length > 0) {
            finalReasoning = `${finalReasoning}\n[sources]: ${JSON.stringify(streamMeta.sources)}`;
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
        } catch (dbErr) {
          logger.error('[AI Chat] Failed to save assistant message to DB:', dbErr);
        }
      }

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
      res.status(500).json({ success: false, error: errMsg });
    }
  }
}
