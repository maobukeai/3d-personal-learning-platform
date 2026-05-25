import { logger } from '../utils/logger';
import prisma from './prisma';

export interface SystemSettings {
  PLATFORM_NAME: string;
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
  SYSTEM_EMAIL_PROVIDER: string;
  MICROSOFT_POOL_FAILBACK: boolean;
  MATERIAL_CATEGORIES: string[];
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
  SMTP_CONFIGS: string;
  SMTP_ACTIVE_CONFIG_ID: string;
}

const DEFAULT_SETTINGS: SystemSettings = {
  PLATFORM_NAME: '3D Personal Learning Platform',
  BROWSER_TITLE: '3D Personal Learning Hub',
  PLATFORM_LOGO_URL: '',
  PLATFORM_FAVICON_URL: '',
  PLATFORM_DESCRIPTION: '',
  ALLOW_REGISTRATION: true,
  MAINTENANCE_MODE: false,
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
  SYSTEM_EMAIL_PROVIDER: 'SMTP',
  MICROSOFT_POOL_FAILBACK: true,
  MATERIAL_CATEGORIES: ['模型', '材质', '工程', '教程', '插件'],
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
  SMTP_CONFIGS: '[]',
  SMTP_ACTIVE_CONFIG_ID: 'default',
};

class SettingsService {
  private cache: Partial<SystemSettings> | null = null;
  private lastFetch: number = 0;
  private readonly CACHE_TTL = 60 * 1000; // 1 minute

  async getAll(): Promise<SystemSettings> {
    if (this.cache && Date.now() - this.lastFetch < this.CACHE_TTL) {
      return { ...DEFAULT_SETTINGS, ...this.cache } as SystemSettings;
    }

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
          s.key.endsWith('_FAILBACK')
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
              } catch (e) {
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
          } catch (e) {
            logger.warn(`Recovering malformed setting ${s.key}`);
            const arr = s.value
              .split(',')
              .map((v) => v.trim())
              .filter(Boolean);
            settings[key] = arr;
          }
        } else {
          settings[key] = s.value;
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
    } else if (settings['MAX_FILE_SIZE'] !== undefined && settings['MAX_UPLOAD_SIZE_MB'] === undefined) {
      settings['MAX_UPLOAD_SIZE_MB'] = settings['MAX_FILE_SIZE'];
    }

    this.cache = settings as unknown as Partial<SystemSettings>;
    this.lastFetch = Date.now();
    return { ...DEFAULT_SETTINGS, ...settings } as unknown as SystemSettings;
  }

  async get<K extends keyof SystemSettings>(key: K): Promise<SystemSettings[K]> {
    const all = await this.getAll();
    return all[key];
  }

  async update(key: string, value: unknown): Promise<void> {
    let stringValue: string;

    if (Array.isArray(value)) {
      stringValue = JSON.stringify(value);
    } else if (typeof value === 'string') {
      // If it's already a JSON array string, don't stringify it again
      const trimmed = value.trim();
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          JSON.parse(trimmed);
          stringValue = trimmed;
        } catch (e) {
          stringValue = value;
        }
      } else {
        stringValue = value;
      }
    } else if (typeof value === 'object' && value !== null) {
      stringValue = JSON.stringify(value);
    } else {
      stringValue = String(value);
    }

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

    for (const [key, value] of Object.entries(settings)) {
      await this.update(key, value);
    }
  }
}

export const settingsService = new SettingsService();
