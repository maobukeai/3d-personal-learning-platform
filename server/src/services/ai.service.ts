import axios from 'axios';
import { Response } from 'express';
import { settingsService } from './settings.service';
import { logger } from '../utils/logger';

export interface AIServiceConfig {
  AI_IMPORT_ENABLED: boolean;
  AI_PROVIDER: string;
  AI_API_KEY: string;
  AI_API_ENDPOINT: string;
  AI_MODEL_NAME: string;
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
 * Masks the API key (?key=...) in the URL to prevent it from leaking into logs.
 */
function maskUrlApiKey(rawUrl: string): string {
  if (!rawUrl) return '';
  return rawUrl.replace(/key=[^&]+/g, 'key=***');
}

/**
 * Unified request building helper for all AI calls.
 */
async function prepareRequestConfig(
  messages: { role: string; content: string }[],
  systemPrompt: string,
  overrides?: Partial<AIServiceConfig>,
  options: {
    stream?: boolean;
    temperature?: number;
    isSingleTurn?: boolean;
    promptText?: string;
  } = {}
): Promise<{ url: string; headers: Record<string, string>; body: any; provider: string }> {
  const settings = await settingsService.getAll();

  const provider = overrides?.AI_PROVIDER ?? settings.AI_PROVIDER ?? 'DEEPSEEK';
  const apiKey = normalizeParam(overrides?.AI_API_KEY ?? settings.AI_API_KEY);
  const endpoint = normalizeParam(overrides?.AI_API_ENDPOINT ?? settings.AI_API_ENDPOINT);
  const modelName = normalizeParam(overrides?.AI_MODEL_NAME ?? settings.AI_MODEL_NAME);
  const enabled = overrides?.AI_IMPORT_ENABLED ?? settings.AI_IMPORT_ENABLED;

  if (!enabled && !overrides) {
    throw new Error('AI 功能未启用，请联系管理员在系统后台开启。');
  }

  if (!apiKey && provider !== 'OLLAMA') {
    throw new Error(`提供商 ${provider} 需要配置 API 密钥 (API Key)。`);
  }

  const temperature = options.temperature ?? 0.3;
  const stream = options.stream ?? false;
  const isSingleTurn = options.isSingleTurn ?? false;

  let url = endpoint;
  let headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  let body: any;

  if (provider === 'AZURE') {
    headers['api-key'] = apiKey;
    url = endpoint;
    if (url && !url.includes('api-version=')) {
      const separator = url.includes('?') ? '&' : '?';
      url = `${url}${separator}api-version=2023-05-15`;
    }
    body = {
      messages: isSingleTurn
        ? [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: options.promptText || '' },
          ]
        : [
            { role: 'system', content: systemPrompt },
            ...messages,
          ],
      temperature,
      ...(stream && { stream: true }),
    };
  } else if (
    provider === 'GEMINI' &&
    (!endpoint || endpoint.includes('generativelanguage.googleapis.com'))
  ) {
    const model = modelName || 'gemini-1.5-flash';
    if (isSingleTurn) {
      url = `https://generativelanguage.googleapis.com/v1/models/${model}:${stream ? 'streamGenerateContent?alt=sse&' : 'generateContent?'}key=${apiKey}`;
      body = {
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemPrompt}\n\n用户输入：\n${options.promptText || ''}` }],
          },
        ],
        generationConfig: {
          temperature,
        },
      };
    } else {
      const geminiContents = messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));
      url = `https://generativelanguage.googleapis.com/v1/models/${model}:${stream ? 'streamGenerateContent?alt=sse&' : 'generateContent?'}key=${apiKey}`;
      body = {
        contents: geminiContents,
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        generationConfig: {
          temperature,
        },
      };
    }
  } else {
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
    url = cleanEndpointUrl(url);
    body = {
      model: modelName,
      messages: isSingleTurn
        ? [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: options.promptText || '' },
          ]
        : [
            { role: 'system', content: systemPrompt },
            ...messages,
          ],
      temperature,
      max_tokens: stream ? 8192 : 4096,
      ...(stream && { stream: true }),
    };
  }

  return { url, headers, body, provider };
}

/**
 * Private helper to execute LLM API call, parse response, and handle errors unifiedly.
 */
async function executeLLMRequest(
  url: string,
  headers: Record<string, string>,
  body: any,
  provider: string,
  overrides?: Partial<AIServiceConfig>
): Promise<string> {
  try {
    const response = await axios.post(url, body, {
      headers,
      timeout: 60000,
    });

    if (
      provider === 'GEMINI' &&
      (!overrides?.AI_API_ENDPOINT && url.includes('generativelanguage.googleapis.com'))
    ) {
      const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error('Gemini API 返回内容为空，请检查模型名称和密钥是否正确。');
      }
      return text;
    } else {
      const text = response.data?.choices?.[0]?.message?.content;
      if (!text) {
        throw new Error('API 返回内容为空，请确认模型名称与接口是否兼容。');
      }
      return text;
    }
  } catch (error: any) {
    logger.error(`[AI Service Error (${provider})]:`, error);
    let errMsg =
      error.response?.data?.error?.message ||
      error.response?.data?.message ||
      error.message ||
      String(error);
    if (error.code === 'ECONNABORTED') {
      errMsg = '请求超时，请检查您的 API Endpoint 能否从服务器正常连接。';
    } else if (error.response?.status === 401) {
      errMsg = '鉴权失败，请检查您的 API 密钥 (API Key) 是否正确。';
    } else if (error.response?.status === 404) {
      errMsg =
        'API 终端未找到 (404)。如果您使用的是自定义 API Endpoint，请确认是否拼写正确，或是否需要补全 /chat/completions。';
    }
    throw new Error(`AI 服务调用失败: ${errMsg}`);
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
): Promise<string> {
  const { url, headers, body, provider } = await prepareRequestConfig([], systemPrompt, overrides, {
    temperature: 0.3,
    isSingleTurn: true,
    promptText: prompt,
  });

  logger.info(`[AI Service] Sending request to provider: ${provider}, URL: ${maskUrlApiKey(url)}`);

  return executeLLMRequest(url, headers, body, provider, overrides);
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
  messages: { role: string; content: string }[],
  systemPrompt: string,
  res: Response,
  overrides?: Partial<AIServiceConfig>,
): Promise<void> {
  const controller = new AbortController();

  try {
    const { url, headers, body, provider } = await prepareRequestConfig(messages, systemPrompt, overrides, {
      temperature: 0.7,
      stream: true,
      isSingleTurn: false,
    });

    // Establish SSE stream headers ONLY after config was prepared successfully
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering in Nginx
    res.setHeader('Content-Encoding', 'none'); // Prevent compression buffering
    res.flushHeaders();

    res.on('close', () => {
      logger.info('[AI Streaming Chat] Client connection closed. Aborting upstream LLM request.');
      controller.abort();
    });

    logger.info(`[AI Streaming Chat] Directing stream to client. Provider: ${provider}, URL: ${maskUrlApiKey(url)}`);

    const response = await axios.post(url, body, {
      headers,
      responseType: 'stream',
      timeout: 90000, // 90 seconds timeout
      signal: controller.signal,
    });

    const stream = response.data;
    let buffer = '';

    stream.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const cleanLine = line.trim();
        if (!cleanLine) continue;
        if (cleanLine === 'data: [DONE]') {
          res.write('data: [DONE]\n\n');
          if (typeof (res as any).flush === 'function') {
            (res as any).flush();
          }
          continue;
        }
        const isSse = cleanLine.startsWith('data: ');
        if (isSse || (!isSse && (cleanLine.startsWith('{') || cleanLine.startsWith('[')))) {
          try {
            const jsonStr = isSse ? cleanLine.substring(6) : cleanLine;
            const parsed = JSON.parse(jsonStr);

            if (provider === 'GEMINI') {
              const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                res.write(`data: ${JSON.stringify({ text })}\n\n`);
                if (typeof (res as any).flush === 'function') {
                  (res as any).flush();
                }
              }
            } else {
              const content = parsed.choices?.[0]?.delta?.content;
              const reasoning = parsed.choices?.[0]?.delta?.reasoning_content;

              if (reasoning) {
                res.write(`data: ${JSON.stringify({ reasoning })}\n\n`);
              }
              if (content) {
                res.write(`data: ${JSON.stringify({ text: content })}\n\n`);
              }
              if ((reasoning || content) && typeof (res as any).flush === 'function') {
                (res as any).flush();
              }
            }
          } catch (e: any) {
            logger.warn(`[AI Stream Parse Warning]: Failed to parse line: "${cleanLine}", error: ${e.message}`);
          }
        }
      }
    });

    stream.on('end', () => {
      res.write('data: [DONE]\n\n');
      if (typeof (res as any).flush === 'function') {
        (res as any).flush();
      }
      res.end();
    });

    stream.on('error', (err: Error) => {
      logger.error('[AI Stream Source Error]:', err);
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      if (typeof (res as any).flush === 'function') {
        (res as any).flush();
      }
      res.end();
    });
  } catch (error: any) {
    logger.error('[AI Streaming Request Error]:', error);
    let errMsg = error.message || String(error);
    if (error.response?.data && typeof error.response.data.read === 'function') {
      try {
        const errorData = error.response.data.read()?.toString('utf8');
        if (errorData) {
          const parsed = JSON.parse(errorData);
          errMsg = parsed.error?.message || errMsg;
        }
      } catch (e) {}
    }
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`);
      if (typeof (res as any).flush === 'function') {
        (res as any).flush();
      }
      res.end();
    } else {
      res.status(500).json({ success: false, error: errMsg });
    }
  }
}

