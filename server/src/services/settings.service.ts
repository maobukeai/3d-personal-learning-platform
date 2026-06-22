import { logger } from '../utils/logger';
import prisma from './prisma';
import { encryptSecret, decryptSecret } from '../utils/secret-field';

export interface SystemSettings {
  PLATFORM_NAME: string;
  PLATFORM_SUBTITLE: string;
  BROWSER_TITLE: string;
  PLATFORM_LOGO_URL: string;
  PLATFORM_FAVICON_URL: string;
  PLATFORM_DESCRIPTION: string;
  ALLOW_REGISTRATION: boolean;
  MAINTENANCE_MODE: boolean;
  MAX_FILE_SIZE: number; // in MB
  MAX_UPLOAD_SIZE_MB: number; // in MB
  ALLOWED_EXTENSIONS: string[];
  ALLOWED_FILE_TYPES: string[];
  AUTO_APPROVE_MATERIALS: boolean;
  AUTO_APPROVE_SHOWCASES: boolean;
  SMTP_HOST: string;
  SMTP_PORT: number;
  SMTP_USER: string;
  SMTP_PASS: string;
  SMTP_FROM: string;
  SMTP_SECURE: boolean;
  SYSTEM_EMAIL_PROVIDER: string;
  MICROSOFT_POOL_FAILBACK: boolean;
  MATERIAL_CATEGORIES: string[];
  TEAM_CATEGORIES: string[];
  SHOWCASE_CATEGORIES: string[];
  PLUGIN_CATEGORIES: string[];
  FOOTER_TEXT: string;
  OAUTH_GOOGLE_ENABLED: boolean;
  OAUTH_GOOGLE_CLIENT_ID: string;
  OAUTH_GOOGLE_CLIENT_SECRET: string;
  OAUTH_GITHUB_ENABLED: boolean;
  OAUTH_GITHUB_CLIENT_ID: string;
  OAUTH_GITHUB_CLIENT_SECRET: string;
  PASSWORD_MIN_LENGTH: number;
  SESSION_TIMEOUT: string;
  DEFAULT_USER_ROLE: string;
  EMAIL_VERIFY_SUBJECT: string;
  EMAIL_VERIFY_BODY: string;
  EMAIL_NOTIFY_SUBJECT: string;
  EMAIL_NOTIFY_BODY: string;
  SMTP_CONFIGS: string;
  SMTP_ACTIVE_CONFIG_ID: string;
  AI_IMPORT_ENABLED: boolean;
  AI_PROVIDER: string;
  AI_API_KEY: string;
  AI_API_ENDPOINT: string;
  AI_MODEL_NAME: string;
  AI_MODEL_OPTIONS: string;
  AI_MODEL_CUSTOM_CATEGORIES: string;
  FORCE_R2_STORAGE: boolean;
}

export interface AIModelOption {
  id: string;
  name: string;
  provider: string;
  modelName: string;
  endpoint: string;
  apiKey?: string;
  apiKeys?: string[];
  enabled: boolean;
  isDefault?: boolean;
  description?: string;
  capabilities?: string[];
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  customFamilyKey?: string;
  customFamilyLabel?: string;
  priority?: number;
  failoverEnabled?: boolean;
}

export interface PublicAIModelOption {
  id: string;
  name: string;
  provider: string;
  modelName: string;
  enabled: boolean;
  isDefault: boolean;
  description?: string;
  capabilities: string[];
  priority?: number;
}

const DEFAULT_SETTINGS: SystemSettings = {
  PLATFORM_NAME: '3D Personal Learning Platform',
  PLATFORM_SUBTITLE: '一起学 Blender，创造无限可能',
  BROWSER_TITLE: '3D Personal Learning Hub',
  PLATFORM_LOGO_URL: '',
  PLATFORM_FAVICON_URL: '',
  PLATFORM_DESCRIPTION: '',
  ALLOW_REGISTRATION: true,
  MAINTENANCE_MODE: false,
  FORCE_R2_STORAGE: true,

  MAX_FILE_SIZE: 100,
  MAX_UPLOAD_SIZE_MB: 100,
  ALLOWED_EXTENSIONS: [
    '.jpeg',
    '.jpg',
    '.png',
    '.gif',
    '.webp',
    '.svg',
    '.bmp',
    '.pdf',
    '.zip',
    '.rar',
    '.7z',
    '.glb',
    '.gltf',
    '.fbx',
    '.obj',
    '.stl',
    '.dae',
    '.3ds',
    '.blend',
    '.usdz',
    '.abc',
    '.mp4',
    '.webm',
    '.mov',
    '.avi',
    '.mkv',
    '.mp3',
    '.wav',
    '.ogg',
    '.flac',
  ],
  ALLOWED_FILE_TYPES: [
    '.jpeg',
    '.jpg',
    '.png',
    '.gif',
    '.webp',
    '.svg',
    '.bmp',
    '.pdf',
    '.zip',
    '.rar',
    '.7z',
    '.glb',
    '.gltf',
    '.fbx',
    '.obj',
    '.stl',
    '.dae',
    '.3ds',
    '.blend',
    '.usdz',
    '.abc',
    '.mp4',
    '.webm',
    '.mov',
    '.avi',
    '.mkv',
    '.mp3',
    '.wav',
    '.ogg',
    '.flac',
  ],
  AUTO_APPROVE_MATERIALS: false,
  AUTO_APPROVE_SHOWCASES: false,
  SMTP_HOST: '',
  SMTP_PORT: 587,
  SMTP_USER: '',
  SMTP_PASS: '',
  SMTP_FROM: 'noreply@3d-learning.com',
  SMTP_SECURE: false,
  SYSTEM_EMAIL_PROVIDER: 'SMTP',
  MICROSOFT_POOL_FAILBACK: true,
  MATERIAL_CATEGORIES: ['金属', '木纹', '石材', '织物', '程序化', '玻璃', '其他'],
  TEAM_CATEGORIES: ['建模', '渲染', '动画', '材质', '游戏引擎'],
  SHOWCASE_CATEGORIES: ['角色', '场景', '硬表面', '动效', '渲染', '其他'],
  PLUGIN_CATEGORIES: [
    '建模',
    '材质与纹理',
    '渲染与灯光',
    '动画与骨骼',
    '导入与导出',
    '物理与特效',
    '其他工具',
  ],
  FOOTER_TEXT: '',
  OAUTH_GOOGLE_ENABLED: false,
  OAUTH_GOOGLE_CLIENT_ID: '',
  OAUTH_GOOGLE_CLIENT_SECRET: '',
  OAUTH_GITHUB_ENABLED: false,
  OAUTH_GITHUB_CLIENT_ID: '',
  OAUTH_GITHUB_CLIENT_SECRET: '',
  PASSWORD_MIN_LENGTH: 6,
  SESSION_TIMEOUT: '7d',
  DEFAULT_USER_ROLE: 'USER',
  EMAIL_VERIFY_SUBJECT: '您的邮箱验证码',
  EMAIL_VERIFY_BODY: `<div style="padding: 20px; font-family: sans-serif;">
  <h2>验证您的邮箱</h2>
  <p>您好，您正在进行邮箱验证，验证码如下：</p>
  <div style="background: #f4f4f4; padding: 15px; font-size: 24px; font-weight: bold; letter-spacing: 5px; text-align: center;">{{code}}</div>
  <p>有效期 10 分钟。如果不是您本人操作，请忽略此邮件。</p>
</div>`,
  EMAIL_NOTIFY_SUBJECT: '[3D学习平台] 你有新的通知提醒',
  EMAIL_NOTIFY_BODY: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #111827; padding: 24px;">
  <h2 style="margin: 0 0 12px; font-size: 20px; color: #4f46e5;">{{title}}</h2>
  <p style="margin: 0 0 16px; font-size: 14px; color: #374151;">{{content}}</p>
  {{preview}}
  <div style="margin: 24px 0 16px;">
    <a href="{{link}}" style="display: inline-block; padding: 10px 18px; border-radius: 8px; background: #4f46e5; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 14px;">立即前往查看</a>
  </div>
  <p style="margin-top: 24px; color: #9ca3af; font-size: 11px; border-top: 1px solid #e5e7eb; padding-top: 12px;">如果不想继续收到此类邮件，可以在个人设置的“通知策略”中调整偏好配置。</p>
</div>`,
  SMTP_CONFIGS: '[]',
  SMTP_ACTIVE_CONFIG_ID: 'default',
  AI_IMPORT_ENABLED: false,
  AI_PROVIDER: 'DEEPSEEK',
  AI_API_KEY: '',
  AI_API_ENDPOINT: 'https://api.deepseek.com/v1',
  AI_MODEL_NAME: 'deepseek-chat',
  AI_MODEL_OPTIONS: JSON.stringify([
    {
      id: 'deepseek-chat',
      name: 'DeepSeek V3',
      provider: 'DEEPSEEK',
      modelName: 'deepseek-chat',
      endpoint: 'https://api.deepseek.com/v1',
      enabled: true,
      isDefault: true,
      description: 'DeepSeek 官方对话模型，极速响应，高性价比',
      capabilities: ['chat'],
      temperature: 0.3,
      maxTokens: 8192,
    },
    {
      id: 'deepseek-reasoner',
      name: 'DeepSeek R1 (推理/思考)',
      provider: 'DEEPSEEK',
      modelName: 'deepseek-reasoner',
      endpoint: 'https://api.deepseek.com/v1',
      enabled: true,
      description: 'DeepSeek 官方推理模型，适合复杂编程和深度逻辑推理',
      capabilities: ['chat', 'reasoning'],
      temperature: 0.5,
      maxTokens: 8192,
    },
    {
      id: 'gemini-2.5-flash',
      name: 'Gemini 2.5 Flash',
      provider: 'GEMINI',
      modelName: 'gemini-2.5-flash',
      endpoint:
        'https://gateway.ai.cloudflare.com/v1/15f8013c69ef90d952d7a2945a949e52/gemini-proxy/google-ai-studio',
      enabled: true,
      description: 'Google 最新主力大模型，支持多模态，超大上下文',
      capabilities: ['chat', 'multimodal'],
      temperature: 0.3,
      maxTokens: 8192,
    },
    {
      id: 'agnes-2.0-flash',
      name: 'Agnes 2.0 Flash',
      provider: 'AGNES',
      modelName: 'agnes-2.0-flash',
      endpoint: 'https://apihub.agnes-ai.com/v1',
      enabled: true,
      description: 'Agnes 全模态轻量大模型，支持聊天、图像输入、推理与工具调用',
      capabilities: ['chat', 'multimodal', 'reasoning', 'tools'],
      temperature: 0.3,
      maxTokens: 8192,
    },
    {
      id: 'gpt-4o-mini',
      name: 'GPT-4o Mini',
      provider: 'OPENAI',
      modelName: 'gpt-4o-mini',
      endpoint: 'https://api.openai.com/v1',
      enabled: true,
      description: 'OpenAI 高性价比轻量级模型，响应迅速',
      capabilities: ['chat'],
      temperature: 0.3,
      maxTokens: 4096,
    },
  ]),
  AI_MODEL_CUSTOM_CATEGORIES: '[]',
};

const normalizeAIModelOptions = (value: unknown): AIModelOption[] => {
  let raw = value;
  if (typeof raw === 'string') {
    if (!raw.trim()) return [];
    try {
      raw = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];

  const normalized: AIModelOption[] = [];
  raw.forEach((item, index) => {
    if (!item || typeof item !== 'object') return;
    const model = item as Record<string, unknown>;
    const provider = String(model.provider || '')
      .trim()
      .toUpperCase();
    const modelName = String(model.modelName || model.model || '').trim();
    const endpoint = String(model.endpoint || model.apiEndpoint || '').trim();
    const id = String(model.id || `${provider || 'MODEL'}_${index + 1}`).trim();

    if (!id || !provider || !modelName) return;

    const capabilities = Array.isArray(model.capabilities)
      ? model.capabilities.map((v) => String(v).trim()).filter(Boolean)
      : typeof model.capabilities === 'string'
        ? model.capabilities
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean)
        : [];

    const apiKeys = Array.isArray(model.apiKeys)
      ? model.apiKeys.map((k) => String(k).trim()).filter(Boolean)
      : [];

    normalized.push({
      id,
      name: String(model.name || `${provider} ${modelName}`).trim(),
      provider,
      modelName,
      endpoint,
      apiKey: typeof model.apiKey === 'string' ? model.apiKey : '',
      apiKeys,
      enabled: model.enabled === true || model.enabled === 'true',
      isDefault: model.isDefault === true || model.isDefault === 'true',
      description: typeof model.description === 'string' ? model.description.trim() : '',
      capabilities,
      temperature: typeof model.temperature === 'number' ? model.temperature : undefined,
      maxTokens: typeof model.maxTokens === 'number' ? model.maxTokens : undefined,
      systemPrompt: typeof model.systemPrompt === 'string' ? model.systemPrompt.trim() : undefined,
      customFamilyKey:
        typeof model.customFamilyKey === 'string' ? model.customFamilyKey.trim() : undefined,
      customFamilyLabel:
        typeof model.customFamilyLabel === 'string' ? model.customFamilyLabel.trim() : undefined,
      priority: typeof model.priority === 'number' ? model.priority : undefined,
      failoverEnabled: typeof model.failoverEnabled === 'boolean' ? model.failoverEnabled : true,
    });
  });
  return normalized;
};

const decryptAIModelOptions = (value: string): string => {
  const models = normalizeAIModelOptions(value).map((model) => ({
    ...model,
    apiKey: model.apiKey ? decryptSecret(model.apiKey) || model.apiKey : '',
    apiKeys: (model.apiKeys || []).map((k) => (k ? decryptSecret(k) || k : '')).filter(Boolean),
  }));
  return JSON.stringify(models);
};

const encryptAIModelOptions = (value: unknown): string => {
  const models = normalizeAIModelOptions(value).map((model, index, arr) => ({
    ...model,
    isDefault: model.isDefault || (!arr.some((item) => item.isDefault) && index === 0),
    apiKey: model.apiKey ? encryptSecret(model.apiKey) || '' : '',
    apiKeys: (model.apiKeys || []).map((k) => (k ? encryptSecret(k) || '' : '')).filter(Boolean),
  }));
  return JSON.stringify(models);
};

export const getPublicAIModels = (settings: SystemSettings): PublicAIModelOption[] => {
  const configuredModels = normalizeAIModelOptions(settings.AI_MODEL_OPTIONS);
  const fallbackModel: AIModelOption = {
    id: 'default',
    name: `${settings.AI_PROVIDER || 'AI'} ${settings.AI_MODEL_NAME || 'Default'}`.trim(),
    provider: settings.AI_PROVIDER,
    modelName: settings.AI_MODEL_NAME,
    endpoint: settings.AI_API_ENDPOINT,
    enabled: settings.AI_IMPORT_ENABLED,
    isDefault: true,
    description: '系统默认模型',
    capabilities: ['chat'],
  };

  const enabledModels = configuredModels.length > 0 ? configuredModels : [fallbackModel];
  const hasDefault = enabledModels.some((model) => model.enabled && model.isDefault);

  return enabledModels
    .filter((model) => model.enabled)
    .map((model, index) => ({
      id: model.id,
      name: model.name,
      provider: model.provider,
      modelName: model.modelName,
      enabled: model.enabled,
      isDefault: model.isDefault || (!hasDefault && index === 0),
      description: model.description || '',
      capabilities: model.capabilities?.length ? model.capabilities : ['chat'],
      priority: typeof model.priority === 'number' ? model.priority : 999,
    }));
};

export const getAIModelById = (
  settings: SystemSettings,
  modelId?: string,
): AIModelOption | null => {
  const configuredModels = normalizeAIModelOptions(settings.AI_MODEL_OPTIONS);
  if (configuredModels.length === 0) {
    return {
      id: 'default',
      name: `${settings.AI_PROVIDER || 'AI'} ${settings.AI_MODEL_NAME || 'Default'}`.trim(),
      provider: settings.AI_PROVIDER,
      modelName: settings.AI_MODEL_NAME,
      endpoint: settings.AI_API_ENDPOINT,
      apiKey: settings.AI_API_KEY,
      enabled: settings.AI_IMPORT_ENABLED,
      isDefault: true,
      description: '系统默认模型',
      capabilities: ['chat'],
    };
  }

  const enabledModels = configuredModels.filter((model) => model.enabled);
  if (enabledModels.length === 0) return null;

  if (modelId && !enabledModels.some((model) => model.id === modelId)) {
    return null;
  }

  const selected =
    enabledModels.find((model) => model.id === modelId) ||
    enabledModels.find((model) => model.isDefault) ||
    enabledModels[0];
  return selected || null;
};

class SettingsService {
  private cache: Partial<SystemSettings> | null = null;
  private lastFetch: number = 0;
  private readonly CACHE_TTL = 60 * 1000; // 1 minute
  /** In-flight fetch promise to prevent thundering herd on cache miss. */
  private fetchPromise: Promise<SystemSettings> | null = null;

  async getAll(): Promise<SystemSettings> {
    if (this.cache && Date.now() - this.lastFetch < this.CACHE_TTL) {
      return { ...DEFAULT_SETTINGS, ...this.cache } as SystemSettings;
    }

    // Return the existing in-flight fetch if one is already running,
    // so concurrent requests don't fan out into multiple DB queries.
    if (this.fetchPromise) return this.fetchPromise;

    this.fetchPromise = this._fetchFromDb().finally(() => {
      this.fetchPromise = null;
    });
    return this.fetchPromise;
  }

  private async _fetchFromDb(): Promise<SystemSettings> {
    const dbSettings = await prisma.systemSetting.findMany();
    const settings = {} as Record<string, unknown>;

    for (const s of dbSettings) {
      try {
        const key = s.key as keyof SystemSettings;
        if (
          s.key.endsWith('_MODE') ||
          s.key.startsWith('ALLOW_') ||
          s.key.startsWith('AUTO_') ||
          s.key.endsWith('_ENABLED') ||
          s.key.endsWith('_FAILBACK') ||
          s.key === 'SMTP_SECURE'
        ) {
          settings[key] = s.value === 'true';
        } else if (
          s.key.endsWith('_PORT') ||
          s.key.endsWith('_SIZE') ||
          s.key.endsWith('_LENGTH') ||
          s.key === 'MAX_UPLOAD_SIZE_MB'
        ) {
          settings[key] = parseInt(s.value, 10);
        } else if (
          s.key.endsWith('_CATEGORIES') ||
          s.key.endsWith('_EXTENSIONS') ||
          s.key === 'ALLOWED_FILE_TYPES'
        ) {
          try {
            // Safe JSON parse to extract actual array
            let parsed = JSON.parse(s.value);
            // If the database has a double stringified JSON (due to legacy bugs), try to parse again
            while (typeof parsed === 'string' && parsed.trim().startsWith('[')) {
              try {
                const next = JSON.parse(parsed);
                if (typeof next === 'string' && next === parsed) break; // Prevent infinite loop
                parsed = next;
              } catch (_e) {
                break;
              }
            }
            if (Array.isArray(parsed)) {
              settings[key] = parsed;
            } else if (typeof parsed === 'string') {
              settings[key] = parsed
                .split(',')
                .map((v) => v.trim())
                .filter(Boolean);
            }
          } catch (_e) {
            logger.warn(`Recovering malformed setting ${s.key}`);
            const arr = s.value
              .split(',')
              .map((v) => v.trim())
              .filter(Boolean);
            settings[key] = arr;
          }
        } else {
          if (s.key === 'AI_MODEL_OPTIONS') {
            settings[key] = decryptAIModelOptions(s.value);
          } else if (s.key === 'AI_API_KEY' || s.key === 'SMTP_PASS') {
            settings[key] = decryptSecret(s.value) || '';
          } else {
            settings[key] = s.value;
          }
        }
      } catch (e) {
        logger.error(`Error parsing setting ${s.key}:`, e);
      }
    }

    // Keep ALLOWED_FILE_TYPES and ALLOWED_EXTENSIONS synchronized
    if (settings['ALLOWED_FILE_TYPES'] && !settings['ALLOWED_EXTENSIONS']) {
      settings['ALLOWED_EXTENSIONS'] = settings['ALLOWED_FILE_TYPES'];
    } else if (settings['ALLOWED_EXTENSIONS'] && !settings['ALLOWED_FILE_TYPES']) {
      settings['ALLOWED_FILE_TYPES'] = settings['ALLOWED_EXTENSIONS'];
    }

    // Keep MAX_UPLOAD_SIZE_MB and MAX_FILE_SIZE synchronized
    if (settings['MAX_UPLOAD_SIZE_MB'] !== undefined && settings['MAX_FILE_SIZE'] === undefined) {
      settings['MAX_FILE_SIZE'] = settings['MAX_UPLOAD_SIZE_MB'];
    } else if (
      settings['MAX_FILE_SIZE'] !== undefined &&
      settings['MAX_UPLOAD_SIZE_MB'] === undefined
    ) {
      settings['MAX_UPLOAD_SIZE_MB'] = settings['MAX_FILE_SIZE'];
    }

    this.cache = settings as unknown as Partial<SystemSettings>;
    this.lastFetch = Date.now();
    return { ...DEFAULT_SETTINGS, ...settings } as unknown as SystemSettings;
  }

  /**
   * Run one-time data migrations that should execute at application startup.
   * Call this once from the server entry point (e.g. src/index.ts) after
   * the DB connection is established. Never call inside getAll().
   */
  async runStartupMigrations(): Promise<void> {
    try {
      const pluginCatsObj = (await this.getAll()).PLUGIN_CATEGORIES;
      if (Array.isArray(pluginCatsObj) && pluginCatsObj.includes('Blender 插件')) {
        const newDefaults = DEFAULT_SETTINGS.PLUGIN_CATEGORIES;
        await this.update('PLUGIN_CATEGORIES', newDefaults);
        logger.info(
          '[Settings Migration] Migrated PLUGIN_CATEGORIES to Blender-specific categories',
        );
      }
    } catch (e) {
      logger.error('[Settings Migration] Failed to run startup migrations:', e);
    }
  }

  async get<K extends keyof SystemSettings>(key: K): Promise<SystemSettings[K]> {
    const all = await this.getAll();
    return all[key];
  }

  private serializeValue(key: string, value: unknown): string {
    if (key === 'AI_MODEL_OPTIONS') {
      return encryptAIModelOptions(value);
    } else if (key === 'AI_API_KEY' || key === 'SMTP_PASS') {
      return encryptSecret(value as string) || '';
    } else if (Array.isArray(value)) {
      return JSON.stringify(value);
    } else if (typeof value === 'string') {
      // If it's already a JSON array string, don't stringify it again
      const trimmed = value.trim();
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          JSON.parse(trimmed);
          return trimmed;
        } catch (_e) {
          return value;
        }
      } else {
        return value;
      }
    } else if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value);
    } else {
      return String(value);
    }
  }

  async update(key: string, value: unknown): Promise<void> {
    const stringValue = this.serializeValue(key, value);

    // Determine if we need to update synced keys
    const syncedKey = this.getSyncedKey(key);

    if (syncedKey) {
      // Use transaction to ensure atomic updates
      await prisma.$transaction([
        prisma.systemSetting.upsert({
          where: { key },
          update: { value: stringValue },
          create: { key, value: stringValue },
        }),
        prisma.systemSetting.upsert({
          where: { key: syncedKey },
          update: { value: stringValue },
          create: { key: syncedKey, value: stringValue },
        }),
      ]);
    } else {
      await prisma.systemSetting.upsert({
        where: { key },
        update: { value: stringValue },
        create: { key, value: stringValue },
      });
    }

    this.cache = null; // Invalidate cache
  }

  private getSyncedKey(key: string): string | null {
    const syncMap: Record<string, string> = {
      ALLOWED_FILE_TYPES: 'ALLOWED_EXTENSIONS',
      ALLOWED_EXTENSIONS: 'ALLOWED_FILE_TYPES',
      MAX_UPLOAD_SIZE_MB: 'MAX_FILE_SIZE',
      MAX_FILE_SIZE: 'MAX_UPLOAD_SIZE_MB',
    };
    return syncMap[key] || null;
  }

  async updateMany(settings: Partial<SystemSettings>): Promise<void> {
    // Synchronize keys before executing database updates to prevent overwrite race conditions
    if (settings.ALLOWED_FILE_TYPES !== undefined) {
      settings.ALLOWED_EXTENSIONS = settings.ALLOWED_FILE_TYPES;
    } else if (settings.ALLOWED_EXTENSIONS !== undefined) {
      settings.ALLOWED_FILE_TYPES = settings.ALLOWED_EXTENSIONS;
    }

    if (settings.MAX_UPLOAD_SIZE_MB !== undefined) {
      settings.MAX_FILE_SIZE = settings.MAX_UPLOAD_SIZE_MB;
    } else if (settings.MAX_FILE_SIZE !== undefined) {
      settings.MAX_UPLOAD_SIZE_MB = settings.MAX_FILE_SIZE;
    }

    // Delete redundant keys so update is only called once per synchronized pair
    if (settings.ALLOWED_FILE_TYPES !== undefined) {
      delete settings.ALLOWED_EXTENSIONS;
    }
    if (settings.MAX_UPLOAD_SIZE_MB !== undefined) {
      delete settings.MAX_FILE_SIZE;
    }

    // Batch upsert all settings in a single transaction to avoid N+1 queries
    const entries = Object.entries(settings);
    if (entries.length === 0) return;

    await prisma.$transaction(
      entries.map(([key, value]) => {
        const stringValue = this.serializeValue(key, value);
        return prisma.systemSetting.upsert({
          where: { key },
          update: { value: stringValue },
          create: { key, value: stringValue },
        });
      }),
    );

    this.cache = null; // Invalidate cache
  }
}

export const settingsService = new SettingsService();
