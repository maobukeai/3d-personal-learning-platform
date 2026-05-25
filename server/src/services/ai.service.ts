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
  overrides?: Partial<AIServiceConfig>
): Promise<string> {
  const settings = await settingsService.getAll();
  
  const provider = overrides?.AI_PROVIDER ?? settings.AI_PROVIDER ?? 'DEEPSEEK';
  const apiKey = overrides?.AI_API_KEY ?? settings.AI_API_KEY;
  const endpoint = overrides?.AI_API_ENDPOINT ?? settings.AI_API_ENDPOINT;
  const modelName = overrides?.AI_MODEL_NAME ?? settings.AI_MODEL_NAME;
  const enabled = overrides?.AI_IMPORT_ENABLED ?? settings.AI_IMPORT_ENABLED;

  if (!enabled && !overrides) {
    throw new Error('AI 智能辅助功能未启用，请联系管理员在系统后台开启。');
  }

  if (!apiKey && provider !== 'OLLAMA') {
    throw new Error(`提供商 ${provider} 需要配置 API 密钥 (API Key)。`);
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: prompt }
  ];

  let url = endpoint;
  let headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  let body: any = {};

  if (provider === 'AZURE') {
    headers['api-key'] = apiKey;
    url = endpoint;
    body = {
      messages,
      temperature: 0.3,
    };
  } else if (provider === 'GEMINI' && (!endpoint || endpoint.includes('generativelanguage.googleapis.com'))) {
    const model = modelName || 'gemini-1.5-flash';
    url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    body = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: `${systemPrompt}\n\n用户输入：\n${prompt}` }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.3
      }
    };
  } else {
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
    if (url && !url.endsWith('/chat/completions')) {
      url = url.replace(/\/$/, '') + '/chat/completions';
    }
    body = {
      model: modelName,
      messages,
      temperature: 0.3,
    };
  }

  logger.info(`[AI Service] Sending request to provider: ${provider}, URL: ${url}`);

  try {
    const response = await axios.post(url, body, {
      headers,
      timeout: 60000,
    });

    if (provider === 'GEMINI' && (!endpoint || endpoint.includes('generativelanguage.googleapis.com'))) {
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
    logger.error('[AI Service Error]:', error);
    let errMsg = error.response?.data?.error?.message || error.response?.data?.message || error.message || String(error);
    if (error.code === 'ECONNABORTED') {
      errMsg = '请求超时，请检查您的 API Endpoint 能否从服务器正常连接。';
    } else if (error.response?.status === 401) {
      errMsg = '鉴权失败，请检查您的 API 密钥 (API Key) 是否正确。';
    } else if (error.response?.status === 404) {
      errMsg = 'API 终端未找到 (404)。如果您使用的是自定义 API Endpoint，请确认是否拼写正确，或是否需要补全 /chat/completions。';
    }
    throw new Error(`AI 服务调用失败: ${errMsg}`);
  }
}

/**
 * Standard multi-turn chat interaction helper.
 * 
 * @param messages Conversation message history array
 * @param systemPrompt Chat constraints and persona instructions
 * @param overrides Temporary configuration overrides
 * @returns Fully generated chat assistant reply
 */
export async function callLLMChat(
  messages: { role: string; content: string }[],
  systemPrompt: string,
  overrides?: Partial<AIServiceConfig>
): Promise<string> {
  const settings = await settingsService.getAll();
  
  const provider = overrides?.AI_PROVIDER ?? settings.AI_PROVIDER ?? 'DEEPSEEK';
  const apiKey = overrides?.AI_API_KEY ?? settings.AI_API_KEY;
  const endpoint = overrides?.AI_API_ENDPOINT ?? settings.AI_API_ENDPOINT;
  const modelName = overrides?.AI_MODEL_NAME ?? settings.AI_MODEL_NAME;
  const enabled = overrides?.AI_IMPORT_ENABLED ?? settings.AI_IMPORT_ENABLED;

  if (!enabled && !overrides) {
    throw new Error('AI 智能对话功能未启用，请联系管理员在系统后台开启。');
  }

  if (!apiKey && provider !== 'OLLAMA') {
    throw new Error(`提供商 ${provider} 需要配置 API 密钥 (API Key)。`);
  }

  const fullMessages = [
    { role: 'system', content: systemPrompt },
    ...messages
  ];

  let url = endpoint;
  let headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  let body: any = {};

  if (provider === 'AZURE') {
    headers['api-key'] = apiKey;
    url = endpoint;
    body = {
      messages: fullMessages,
      temperature: 0.7,
    };
  } else if (provider === 'GEMINI' && (!endpoint || endpoint.includes('generativelanguage.googleapis.com'))) {
    const geminiContents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const model = modelName || 'gemini-1.5-flash';
    url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    body = {
      contents: geminiContents,
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      generationConfig: {
        temperature: 0.7
      }
    };
  } else {
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
    if (url && !url.endsWith('/chat/completions')) {
      url = url.replace(/\/$/, '') + '/chat/completions';
    }
    body = {
      model: modelName,
      messages: fullMessages,
      temperature: 0.7,
    };
  }

  logger.info(`[AI Chat Service] Sending chat history to provider: ${provider}, URL: ${url}`);

  try {
    const response = await axios.post(url, body, {
      headers,
      timeout: 60000,
    });

    if (provider === 'GEMINI' && (!endpoint || endpoint.includes('generativelanguage.googleapis.com'))) {
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
    logger.error('[AI Chat Service Error]:', error);
    let errMsg = error.response?.data?.error?.message || error.response?.data?.message || error.message || String(error);
    if (error.code === 'ECONNABORTED') {
      errMsg = '请求超时，请检查您的 API Endpoint 能否从服务器正常连接。';
    } else if (error.response?.status === 401) {
      errMsg = '鉴权失败，请检查您的 API 密钥 (API Key) 是否正确。';
    } else if (error.response?.status === 404) {
      errMsg = 'API 终端未找到 (404)。如果您使用的是自定义 API Endpoint，请确认是否拼写正确，或是否需要补全 /chat/completions。';
    }
    throw new Error(`AI 智能对话调用失败: ${errMsg}`);
  }
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
  overrides?: Partial<AIServiceConfig>
): Promise<void> {
  const settings = await settingsService.getAll();
  
  const provider = overrides?.AI_PROVIDER ?? settings.AI_PROVIDER ?? 'DEEPSEEK';
  const apiKey = overrides?.AI_API_KEY ?? settings.AI_API_KEY;
  const endpoint = overrides?.AI_API_ENDPOINT ?? settings.AI_API_ENDPOINT;
  const modelName = overrides?.AI_MODEL_NAME ?? settings.AI_MODEL_NAME;
  const enabled = overrides?.AI_IMPORT_ENABLED ?? settings.AI_IMPORT_ENABLED;

  if (!enabled && !overrides) {
    throw new Error('AI 智能对话功能未启用，请联系管理员开启。');
  }

  if (!apiKey && provider !== 'OLLAMA') {
    throw new Error(`提供商 ${provider} 需要配置 API 密钥。`);
  }

  const fullMessages = [
    { role: 'system', content: systemPrompt },
    ...messages
  ];

  let url = endpoint;
  let headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  let body: any = {};

  if (provider === 'AZURE') {
    headers['api-key'] = apiKey;
    url = endpoint;
    body = {
      messages: fullMessages,
      temperature: 0.7,
      stream: true,
    };
  } else if (provider === 'GEMINI' && (!endpoint || endpoint.includes('generativelanguage.googleapis.com'))) {
    // Gemini streaming generateContent endpoint
    const model = modelName || 'gemini-1.5-flash';
    url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}`;
    const geminiContents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));
    body = {
      contents: geminiContents,
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      generationConfig: {
        temperature: 0.7
      }
    };
  } else {
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
    if (url && !url.endsWith('/chat/completions')) {
      url = url.replace(/\/$/, '') + '/chat/completions';
    }
    body = {
      model: modelName,
      messages: fullMessages,
      temperature: 0.7,
      stream: true,
    };
  }

  logger.info(`[AI Streaming Chat] Directing stream to client. Provider: ${provider}, URL: ${url}`);

  // Establish SSE stream headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering in Nginx
  res.setHeader('Content-Encoding', 'none'); // Prevent compression buffering
  res.flushHeaders();

  const controller = new AbortController();
  res.on('close', () => {
    logger.info('[AI Streaming Chat] Client connection closed. Aborting upstream LLM request.');
    controller.abort();
  });

  try {
    const response = await axios.post(url, body, {
      headers,
      responseType: 'stream',
      timeout: 60000,
      signal: controller.signal,
    });

    const stream = response.data;

    if (provider === 'GEMINI' && (!endpoint || endpoint.includes('generativelanguage.googleapis.com'))) {
      let streamBuffer = '';
      stream.on('data', (chunk: Buffer) => {
        streamBuffer += chunk.toString('utf8');
        let match;
        const regex = /"text"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
        let lastIndex = 0;
        
        while ((match = regex.exec(streamBuffer)) !== null) {
          if (match[1] !== undefined) {
            try {
              const text = JSON.parse(`"${match[1]}"`);
              if (text) {
                res.write(`data: ${JSON.stringify({ text })}\n\n`);
                if (typeof (res as any).flush === 'function') {
                  (res as any).flush();
                }
              }
            } catch (e) {
              // Ignore partial JSON escapes on bounds
            }
          }
          lastIndex = regex.lastIndex;
        }
        
        if (lastIndex > 0) {
          streamBuffer = streamBuffer.substring(lastIndex);
        }
      });
    } else {
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
          if (cleanLine.startsWith('data: ')) {
            try {
              const jsonStr = cleanLine.substring(6);
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                res.write(`data: ${JSON.stringify({ text: content })}\n\n`);
                if (typeof (res as any).flush === 'function') {
                  (res as any).flush();
                }
              }
            } catch (e) {
              // Suppress parsing errors on incomplete chunks
            }
          }
        }
      });
    }

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
    if (error.response?.data) {
      try {
        const errorData = error.response.data.read()?.toString('utf8');
        if (errorData) {
          const parsed = JSON.parse(errorData);
          errMsg = parsed.error?.message || errMsg;
        }
      } catch (e) {}
    }
    res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`);
    if (typeof (res as any).flush === 'function') {
      (res as any).flush();
    }
    res.end();
  }
}
