import prisma from './prisma';

export interface SystemSettings {
  PLATFORM_NAME: string;
  ALLOW_REGISTRATION: boolean;
  MAINTENANCE_MODE: boolean;
  MAX_FILE_SIZE: number; // in MB
  ALLOWED_EXTENSIONS: string[];
  AUTO_APPROVE_MATERIALS: boolean;
  AUTO_APPROVE_SHOWCASES: boolean;
  SMTP_HOST: string;
  SMTP_PORT: number;
  SMTP_USER: string;
  SMTP_PASS: string;
  SMTP_FROM: string;
  MATERIAL_CATEGORIES: string[];
}

const DEFAULT_SETTINGS: SystemSettings = {
  PLATFORM_NAME: '3D Personal Learning Platform',
  ALLOW_REGISTRATION: true,
  MAINTENANCE_MODE: false,
  MAX_FILE_SIZE: 100,
  ALLOWED_EXTENSIONS: ['.jpeg', '.jpg', '.png', '.gif', '.webp', '.svg', '.bmp', '.pdf', '.zip', '.rar', '.7z', '.glb', '.gltf', '.fbx', '.obj', '.stl', '.dae', '.3ds', '.blend', '.usdz', '.abc', '.mp4', '.webm', '.mov', '.avi', '.mkv', '.mp3', '.wav', '.ogg', '.flac'],
  AUTO_APPROVE_MATERIALS: false,
  AUTO_APPROVE_SHOWCASES: false,
  SMTP_HOST: '',
  SMTP_PORT: 587,
  SMTP_USER: '',
  SMTP_PASS: '',
  SMTP_FROM: 'noreply@3d-learning.com',
  MATERIAL_CATEGORIES: ['模型', '材质', '工程', '教程', '插件']
};

class SettingsService {
  private cache: Partial<SystemSettings> | null = null;
  private lastFetch: number = 0;
  private readonly CACHE_TTL = 60 * 1000; // 1 minute

  async getAll(): Promise<SystemSettings> {
    if (this.cache && (Date.now() - this.lastFetch < this.CACHE_TTL)) {
      return { ...DEFAULT_SETTINGS, ...this.cache } as SystemSettings;
    }

    const dbSettings = await prisma.systemSetting.findMany();
    const settings: Partial<SystemSettings> = {};

    for (const s of dbSettings) {
      try {
        if (s.key.endsWith('_MODE') || s.key.startsWith('ALLOW_') || s.key.startsWith('AUTO_')) {
          settings[s.key as keyof SystemSettings] = s.value === 'true' as any;
        } else if (s.key.endsWith('_PORT') || s.key.endsWith('_SIZE')) {
          settings[s.key as keyof SystemSettings] = parseInt(s.value, 10) as any;
        } else if (s.key.endsWith('_CATEGORIES') || s.key.endsWith('_EXTENSIONS')) {
          settings[s.key as keyof SystemSettings] = JSON.parse(s.value);
        } else {
          settings[s.key as keyof SystemSettings] = s.value as any;
        }
      } catch (e) {
        console.error(`Error parsing setting ${s.key}:`, e);
      }
    }

    this.cache = settings;
    this.lastFetch = Date.now();
    return { ...DEFAULT_SETTINGS, ...settings } as SystemSettings;
  }

  async get<K extends keyof SystemSettings>(key: K): Promise<SystemSettings[K]> {
    const all = await this.getAll();
    return all[key];
  }

  async update(key: string, value: any): Promise<void> {
    let stringValue: string;
    if (typeof value === 'object') {
      stringValue = JSON.stringify(value);
    } else {
      stringValue = String(value);
    }

    await prisma.systemSetting.upsert({
      where: { key },
      update: { value: stringValue },
      create: { key, value: stringValue }
    });

    this.cache = null; // Invalidate cache
  }

  async updateMany(settings: Partial<SystemSettings>): Promise<void> {
    for (const [key, value] of Object.entries(settings)) {
      await this.update(key, value);
    }
  }
}

export const settingsService = new SettingsService();
