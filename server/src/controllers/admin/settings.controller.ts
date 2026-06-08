import { logger } from '../../utils/logger';
import { Response, NextFunction } from 'express';
import axios from 'axios';
import dns from 'dns';
import nodemailer from 'nodemailer';
import { AuthRequest } from '../../middlewares/auth.middleware';
import { settingsService } from '../../services/settings.service';
import { auditService, AuditModule, AuditAction } from '../../services/audit.service';
import { AppError } from '../../middlewares/error.middleware';
import { callLLM } from '../../services/ai.service';
import { configureAxiosProxy } from '../../utils/axios-proxy';

import { config as envConfig } from '../../config/env';

const modelListHttp = axios.create();
configureAxiosProxy(modelListHttp, { preferAiProxy: true });

/**
 * 自定义 DNS 查找：支持动态配置 DNS 服务器绕过 TUN Fake-IP 劫持
 * 默认使用系统 DNS lookup，若提供 DNS_SERVERS 环境变量则使用其指定的 DNS 查询
 */
function resolveSmtpRealIp(hostname: string): Promise<string> {
  return new Promise((resolve) => {
    const dnsServers = process.env.DNS_SERVERS;
    if (dnsServers) {
      try {
        const servers = dnsServers
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        if (servers.length > 0) {
          const resolver = new dns.Resolver();
          resolver.setServers(servers);
          resolver.resolve4(hostname, (err, addresses) => {
            if (!err && addresses && addresses.length > 0) {
              resolve(addresses[0] || hostname);
            } else {
              resolve(hostname);
            }
          });
          return;
        }
      } catch (err) {
        logger.error(
          '[SMTP DNS Resolve Warning]: Failed to use DNS_SERVERS env, falling back to dns.lookup',
          err,
        );
      }
    }

    dns.lookup(hostname, (err, address) => {
      if (!err && address) {
        resolve(address);
      } else {
        resolve(hostname);
      }
    });
  });
}

const validateSettings = (
  settingsObj: Record<string, unknown>,
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  const numericFields = [
    { key: 'MAX_FILE_SIZE', min: 1, max: 1024, label: '最大文件大小' },
    { key: 'MAX_UPLOAD_SIZE_MB', min: 1, max: 1024, label: '最大上传大小' },
    { key: 'SMTP_PORT', min: 1, max: 65535, label: 'SMTP端口' },
    { key: 'PASSWORD_MIN_LENGTH', min: 4, max: 128, label: '密码最小长度' },
  ];

  for (const { key, min, max, label } of numericFields) {
    if (settingsObj[key] !== undefined) {
      const value = parseInt(String(settingsObj[key]), 10);
      if (isNaN(value)) {
        errors.push(`${label}必须是数字`);
      } else if (value < min || value > max) {
        errors.push(`${label}必须在 ${min}-${max} 范围内`);
      }
    }
  }

  const booleanFields = [
    'ALLOW_REGISTRATION',
    'MAINTENANCE_MODE',
    'AUTO_APPROVE_MATERIALS',
    'AUTO_APPROVE_SHOWCASES',
    'OAUTH_GOOGLE_ENABLED',
    'OAUTH_GITHUB_ENABLED',
    'MICROSOFT_POOL_FAILBACK',
    'AI_IMPORT_ENABLED',
  ];

  for (const field of booleanFields) {
    if (settingsObj[field] !== undefined) {
      const val = settingsObj[field];
      if (val !== true && val !== false && val !== 'true' && val !== 'false') {
        errors.push(`${field}必须是布尔值`);
      }
    }
  }

  if (settingsObj.SYSTEM_EMAIL_PROVIDER !== undefined) {
    const validProviders = ['SMTP', 'MICROSOFT_POOL'];
    if (!validProviders.includes(settingsObj.SYSTEM_EMAIL_PROVIDER as string)) {
      errors.push('SYSTEM_EMAIL_PROVIDER必须是 SMTP 或 MICROSOFT_POOL');
    }
  }

  if (settingsObj.SESSION_TIMEOUT !== undefined) {
    const timeout = settingsObj.SESSION_TIMEOUT as string;
    if (!/^\d+[hdwm]$/.test(timeout)) {
      errors.push('SESSION_TIMEOUT格式不正确，应为数字加单位(如: 7d, 1h)');
    }
  }

  if (settingsObj.DEFAULT_USER_ROLE !== undefined) {
    const validRoles = ['USER', 'ADMIN', 'INSTRUCTOR'];
    if (!validRoles.includes(settingsObj.DEFAULT_USER_ROLE as string)) {
      errors.push('DEFAULT_USER_ROLE必须是 USER、ADMIN 或 INSTRUCTOR');
    }
  }

  if (settingsObj.AI_MODEL_OPTIONS !== undefined) {
    try {
      const raw =
        typeof settingsObj.AI_MODEL_OPTIONS === 'string'
          ? JSON.parse(settingsObj.AI_MODEL_OPTIONS)
          : settingsObj.AI_MODEL_OPTIONS;
      if (!Array.isArray(raw)) {
        errors.push('AI_MODEL_OPTIONS必须是模型配置数组');
      } else {
        const enabledModels = raw.filter(
          (item) => item?.enabled === true || item?.enabled === 'true',
        );
        if (
          (settingsObj.AI_IMPORT_ENABLED === true || settingsObj.AI_IMPORT_ENABLED === 'true') &&
          enabledModels.length === 0
        ) {
          errors.push('启用 AI 时至少需要启用一个模型');
        }
        raw.forEach((item, index) => {
          if (!item?.provider || !item?.modelName) {
            errors.push(`第 ${index + 1} 个 AI 模型缺少 provider 或 modelName`);
          }
        });
      }
    } catch {
      errors.push('AI_MODEL_OPTIONS不是有效的 JSON');
    }
  }

  return { valid: errors.length === 0, errors };
};

export const getSettings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const settings = await settingsService.getAll();
    res.json(settings);
  } catch (error) {
    next(error);
  }
};

export const updateSettings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { settings } = req.body; // Expecting { key: value, ... } or [{key, value}, ...]

    if (!settings || (Array.isArray(settings) && settings.length === 0)) {
      return next(new AppError('设置数据不能为空', 400));
    }

    const oldSettings = await settingsService.getAll();
    let settingsObj: Record<string, unknown> = {};

    if (Array.isArray(settings)) {
      settings.forEach((s: { key: string; value: unknown }) => {
        if (s.key && s.value !== undefined) {
          settingsObj[s.key] = s.value;
        }
      });
    } else {
      settingsObj = settings;
    }

    const { valid, errors } = validateSettings(settingsObj);
    if (!valid) {
      return next(new AppError(`设置验证失败: ${errors.join(', ')}`, 400));
    }

    // Ensure array fields are actually arrays before saving
    const arrayFields = ['ALLOWED_EXTENSIONS', 'ALLOWED_FILE_TYPES', 'MATERIAL_CATEGORIES'];
    arrayFields.forEach((field) => {
      if (settingsObj[field] !== undefined) {
        if (typeof settingsObj[field] === 'string') {
          const valStr = settingsObj[field].trim();
          if (valStr.startsWith('[')) {
            try {
              let parsed = JSON.parse(valStr);
              while (typeof parsed === 'string' && parsed.trim().startsWith('[')) {
                parsed = JSON.parse(parsed);
              }
              if (Array.isArray(parsed)) {
                settingsObj[field] = parsed;
              } else {
                settingsObj[field] = valStr
                  .split(',')
                  .map((s: string) => s.trim())
                  .filter(Boolean);
              }
            } catch (_e) {
              settingsObj[field] = valStr
                .split(',')
                .map((s: string) => s.trim())
                .filter(Boolean);
            }
          } else {
            settingsObj[field] = valStr
              .split(',')
              .map((s: string) => s.trim())
              .filter(Boolean);
          }
        }
      }
    });

    await settingsService.updateMany(settingsObj);

    await auditService.log({
      userId: req.userId as string,
      action: AuditAction.UPDATE_SETTINGS,
      module: AuditModule.SETTINGS,
      description: '管理员更新了全局系统设置',
      oldValue: oldSettings,
      newValue: settingsObj,
      req,
    });

    res.json({ message: '设置已成功保存' });
  } catch (error) {
    next(error);
  }
};

export const testSmtp = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { host, port, user, pass, from, secure, to } = req.body;

    if (!host || !user || !pass) {
      return next(new AppError('SMTP 配置不完整', 400));
    }

    const isSecure = secure === true || secure === 'true';
    const portNum = parseInt(port) || 465;

    const realIp = await resolveSmtpRealIp(host);
    logger.info(
      `[SMTP Test] Attempting connection: ${host}(${realIp}):${portNum}, secure: ${isSecure}`,
    );

    const transporter = nodemailer.createTransport({
      host: realIp,
      port: portNum,
      secure: isSecure,
      auth: {
        user,
        pass,
      },
      tls: {
        rejectUnauthorized: envConfig.NODE_ENV === 'production',
        minVersion: 'TLSv1.2',
        servername: host,
      },
      connectionTimeout: 30000,
      greetingTimeout: 30000,
      socketTimeout: 30000,
    });

    // Detailed verification
    await transporter.verify().catch((err) => {
      logger.error('[SMTP Verify Error]:', err);
      throw err;
    });

    const admin = req.user;

    await transporter.sendMail({
      from: from || user,
      to: to || from || user || admin?.email,
      subject: 'SMTP 测试邮件',
      text: '如果您收到这封邮件，说明您的 SMTP 配置已成功！',
      html: `<h3>SMTP 配置测试成功</h3><p>如果您收到这封邮件，说明您的 SMTP 配置已成功！</p><p>测试时间: ${new Date().toLocaleString()}</p>`,
    });

    res.json({ message: 'SMTP 连接测试成功，已向您的邮箱发送测试邮件' });
  } catch (error) {
    logger.error('SMTP Test Error Detail:', error);
    let errorMsg = (error instanceof Error ? error.message : String(error)) || '未知错误';

    // Detailed error mapping
    if ((error as { code?: string }).code === 'ECONNRESET')
      errorMsg = '连接被重置。通常是因为网络防火墙拦截或 SSL/TLS 协议不匹配。';
    else if ((error as { code?: string }).code === 'ETIMEDOUT')
      errorMsg = '连接超时。请检查 465/587 端口是否在云服务器安全组中开放。';
    else if ((error as { code?: string }).code === 'ECONNREFUSED')
      errorMsg = '连接被拒绝。目标服务器可能不可达，或端口被本地 ISP 封锁。';
    else if ((error as { code?: string }).code === 'EAUTH')
      errorMsg = '验证失败。请确保您使用的是 Gmail 的 16 位“应用专用密码”而非主密码。';
    else if (
      (error instanceof Error ? error.message : String(error)).includes('secure TLS connection')
    )
      errorMsg = 'TLS 握手失败。请尝试切换 465 (勾选 SSL) 或 587 (取消勾选 SSL)。';

    next(new AppError(`SMTP 连接失败: ${errorMsg}`, 500));
  }
};

interface ProviderModelOption {
  id: string;
  name?: string;
  ownedBy?: string;
}

const normalizeProvider = (provider: unknown) =>
  String(provider || '')
    .trim()
    .toUpperCase();

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const buildOllamaModelsUrl = (endpoint: string) => {
  const base = trimTrailingSlash(endpoint || 'http://localhost:11434/api');
  if (base.endsWith('/api')) return `${base}/tags`;
  if (base.endsWith('/api/chat') || base.endsWith('/api/generate')) {
    return `${base.replace(/\/api\/(?:chat|generate)$/, '/api')}/tags`;
  }
  return `${base}/api/tags`;
};

const buildGeminiModelsUrl = (endpoint: string, apiKey: string) => {
  const base = trimTrailingSlash(endpoint || 'https://generativelanguage.googleapis.com');
  const normalizedBase = base.includes('/v1') ? base : `${base}/v1beta`;
  const separator = normalizedBase.includes('?') ? '&' : '?';
  return `${normalizedBase}/models${separator}key=${encodeURIComponent(apiKey)}`;
};

const buildOpenAICompatibleModelsUrl = (endpoint: string) => {
  if (!endpoint) throw new AppError('API Endpoint 不能为空', 400);
  const url = new URL(endpoint);

  // GitHub Models support listing models at /catalog/models
  if (url.hostname === 'models.github.ai' || url.hostname === 'models.inference.ai.azure.com') {
    url.pathname = '/catalog/models';
    url.search = '';
    return url.toString();
  }

  let pathname = url.pathname.replace(/\/+$/, '');

  pathname = pathname
    .replace(/\/chat\/completions$/i, '')
    .replace(/\/responses$/i, '')
    .replace(/\/completions$/i, '')
    .replace(/\/messages$/i, '');

  if (!pathname || pathname === '/') {
    pathname = '/v1';
  }
  url.pathname = `${pathname.replace(/\/+$/, '')}/models`;
  url.search = '';
  return url.toString();
};

const parseProviderModels = (data: unknown, provider: string): ProviderModelOption[] => {
  const raw = data as Record<string, unknown>;
  const items =
    provider === 'OLLAMA' && Array.isArray(raw.models)
      ? raw.models
      : Array.isArray(raw.data)
        ? raw.data
        : Array.isArray(raw.models)
          ? raw.models
          : Array.isArray(data)
            ? data
            : [];

  const seen = new Set<string>();
  return items
    .map((item): ProviderModelOption | null => {
      if (typeof item === 'string') return { id: item };
      if (!item || typeof item !== 'object') return null;
      const model = item as Record<string, unknown>;
      const rawId = String(model.id || model.name || model.model || '').trim();
      const id =
        provider === 'GEMINI' && rawId.startsWith('models/')
          ? rawId.replace(/^models\//, '')
          : rawId;
      if (!id || seen.has(id)) return null;
      seen.add(id);
      return {
        id,
        name: typeof model.displayName === 'string' ? model.displayName : undefined,
        ownedBy:
          typeof model.owned_by === 'string'
            ? model.owned_by
            : typeof model.provider === 'string'
              ? model.provider
              : undefined,
      };
    })
    .filter((item): item is ProviderModelOption => Boolean(item))
    .sort((a, b) => a.id.localeCompare(b.id));
};

export const listAiModels = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const provider = normalizeProvider(req.body.provider);
    const endpoint = String(req.body.endpoint || '').trim();
    const apiKey = String(req.body.apiKey || '').trim();

    if (!provider) {
      return next(new AppError('提供商不能为空', 400));
    }
    if (!apiKey && provider !== 'OLLAMA') {
      return next(new AppError('API 密钥不能为空', 400));
    }
    if (provider === 'AZURE') {
      return next(
        new AppError('Azure OpenAI 需要在 Azure 门户管理部署，暂不支持自动获取模型列表', 400),
      );
    }

    let url = '';
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (provider === 'OLLAMA') {
      url = buildOllamaModelsUrl(endpoint);
    } else if (provider === 'GEMINI') {
      url = buildGeminiModelsUrl(endpoint, apiKey);
    } else {
      url = buildOpenAICompatibleModelsUrl(endpoint);
      headers.Authorization = `Bearer ${apiKey}`;
      try {
        const parsedUrl = new URL(url);
        if (
          parsedUrl.hostname === 'models.github.ai' ||
          parsedUrl.hostname === 'models.inference.ai.azure.com'
        ) {
          headers['X-GitHub-Api-Version'] = '2022-11-28';
          headers['User-Agent'] = '3d-personal-learning-platform';
        }
      } catch (_e) {
        // Ignored
      }
    }

    logger.info(`[Admin AI Models] Fetching models provider=${provider} url=${url}`);
    const { data } = await modelListHttp.get(url, {
      headers,
      timeout: 20_000,
    });
    const models = parseProviderModels(data, provider);
    res.json({ success: true, provider, models });
  } catch (error: unknown) {
    logger.error('[Admin AI Models Error]:', error);
    if (error instanceof AppError) return next(error);
    const message = axios.isAxiosError(error)
      ? error.response?.data?.error?.message ||
        error.response?.data?.message ||
        error.message ||
        '获取模型列表失败'
      : error instanceof Error
        ? error.message
        : String(error);
    next(new AppError(`获取模型列表失败: ${message}`, 500));
  }
};

export const uploadBrandingLogo = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return next(new AppError('No file uploaded', 400));
    }

    const fileUrl = `/uploads/branding/${req.file.filename}`;
    res.json({ url: fileUrl });
  } catch (error) {
    next(error);
  }
};

export const uploadBrandingFavicon = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.file) {
      return next(new AppError('No file uploaded', 400));
    }

    const fileUrl = `/uploads/branding/${req.file.filename}`;
    res.json({ url: fileUrl });
  } catch (error) {
    next(error);
  }
};

export const cleanupStorage = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { cleanupOrphanedFiles } = await import('../../scripts/cleanup-storage');
    const stats = await cleanupOrphanedFiles();
    res.json({
      message: '存储空间清理完成',
      stats,
    });
  } catch (error) {
    next(
      new AppError(
        '清理存储空间失败: ' + (error instanceof Error ? error.message : String(error)),
        500,
      ),
    );
  }
};

export const testAi = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { provider, endpoint, apiKey, modelName, capabilities } = req.body;
    logger.info(
      `[Admin Test AI] Request Body: ${JSON.stringify({ provider, endpoint, modelName, capabilities })} (apiKey masked)`,
    );

    if (!provider) {
      return next(new AppError('提供商不能为空', 400));
    }
    if (!apiKey && provider !== 'OLLAMA') {
      return next(new AppError('API 密钥不能为空', 400));
    }

    const testPrompt = '请简短回复OK，这是一次接口连接测试。';
    const testSystemPrompt = '你是一个连接性测试助手。请只回复OK，不要有任何其他多余字符或标点。';

    const responseText = await callLLM(testPrompt, testSystemPrompt, {
      AI_IMPORT_ENABLED: true,
      AI_PROVIDER: provider,
      AI_API_KEY: apiKey,
      AI_API_ENDPOINT: endpoint,
      AI_MODEL_NAME: modelName,
      capabilities: Array.isArray(capabilities)
        ? capabilities
        : typeof capabilities === 'string'
          ? capabilities
              .split(',')
              .map((c: string) => c.trim())
              .filter(Boolean)
          : undefined,
    });

    res.json({
      success: true,
      message: `AI 接口测试成功！模型响应: "${responseText.trim()}"`,
    });
  } catch (error: unknown) {
    logger.error('[AI Test Error]:', error);
    next(new AppError(error instanceof Error ? error.message : String(error), 500));
  }
};
