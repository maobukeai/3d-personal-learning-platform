import { defineStore } from 'pinia';
import api, { getAssetUrl } from '@/utils/api';
import { logError } from '@/utils/error';

interface SystemSettings {
  PLATFORM_NAME: string;
  PLATFORM_SUBTITLE: string;
  BROWSER_TITLE: string;
  PLATFORM_LOGO_URL: string;
  PLATFORM_FAVICON_URL: string;
  PLATFORM_DESCRIPTION: string;
  ALLOW_REGISTRATION: boolean;
  MAINTENANCE_MODE: boolean;
  MATERIAL_CATEGORIES: string[];
  TEAM_CATEGORIES: string[];
  SHOWCASE_CATEGORIES: string[];
  PLUGIN_CATEGORIES: string[];
  SOFTWARE_CATEGORIES: string[];
  PASSWORD_MIN_LENGTH: string;
  SESSION_TIMEOUT: string;
  AUTO_APPROVE_MATERIALS: boolean;
  AUTO_APPROVE_SHOWCASES: boolean;
  MAX_UPLOAD_SIZE_MB: string;
  ALLOWED_FILE_TYPES: string[];
  DEFAULT_USER_ROLE: string;
  FOOTER_TEXT: string;
  OAUTH_GOOGLE_ENABLED: boolean;
  OAUTH_GITHUB_ENABLED: boolean;
  AI_IMPORT_ENABLED: boolean;
  AI_MODEL_OPTIONS: PublicAIModelOption[];
  TEMPORARY_NETDISK_CLEANUP_TIME: string;
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

// ── Default category lists (single source of truth) ──────────────────────────
const DEFAULT_MATERIAL_CATEGORIES = [
  '全部材料',
  '金属',
  '木纹',
  '石材',
  '织物',
  '程序化',
  '玻璃',
  '其他',
];
const DEFAULT_TEAM_CATEGORIES = ['建模', '渲染', '动画', '材质', '游戏引擎'];
const DEFAULT_SHOWCASE_CATEGORIES = ['角色', '场景', '硬表面', '动效', '渲染', '其他'];
const DEFAULT_PLUGIN_CATEGORIES = [
  '建模',
  '材质与纹理',
  '渲染与灯光',
  '动画与骨骼',
  '导入与导出',
  '物理与特效',
  '其他工具',
];
const DEFAULT_SOFTWARE_CATEGORIES = [
  '3D 建模与雕刻软件',
  '渲染引擎与渲染器',
  '后期与图像处理',
  '游戏与交互引擎',
  '其他工具',
];
const DEFAULT_ALLOWED_FILE_TYPES = ['.glb', '.gltf', '.fbx', '.obj', '.stl', '.zip'];

const DEFAULT_SETTINGS: SystemSettings = {
  PLATFORM_NAME: '3D Personal Learning Hub',
  PLATFORM_SUBTITLE: '一起学 Blender，创造无限可能',
  BROWSER_TITLE: '3D Personal Learning Hub',
  PLATFORM_LOGO_URL: '',
  PLATFORM_FAVICON_URL: '',
  PLATFORM_DESCRIPTION: '',
  ALLOW_REGISTRATION: true,
  MAINTENANCE_MODE: false,
  MATERIAL_CATEGORIES: DEFAULT_MATERIAL_CATEGORIES,
  TEAM_CATEGORIES: DEFAULT_TEAM_CATEGORIES,
  SHOWCASE_CATEGORIES: DEFAULT_SHOWCASE_CATEGORIES,
  PLUGIN_CATEGORIES: DEFAULT_PLUGIN_CATEGORIES,
  SOFTWARE_CATEGORIES: DEFAULT_SOFTWARE_CATEGORIES,
  PASSWORD_MIN_LENGTH: '6',
  SESSION_TIMEOUT: '7d',
  AUTO_APPROVE_MATERIALS: false,
  AUTO_APPROVE_SHOWCASES: false,
  MAX_UPLOAD_SIZE_MB: '100',
  ALLOWED_FILE_TYPES: DEFAULT_ALLOWED_FILE_TYPES,
  DEFAULT_USER_ROLE: 'USER',
  FOOTER_TEXT: '',
  OAUTH_GOOGLE_ENABLED: false,
  OAUTH_GITHUB_ENABLED: false,
  AI_IMPORT_ENABLED: false,
  AI_MODEL_OPTIONS: [],
  TEMPORARY_NETDISK_CLEANUP_TIME: '03:00',
};

let pendingSettingsFetch: Promise<void> | null = null;

export const useSystemStore = defineStore('system', {
  state: () => ({
    settings: { ...DEFAULT_SETTINGS } as SystemSettings,
    isInitialized: false,
  }),
  actions: {
    updateBrowserBranding() {
      if (!window.location.pathname.includes('/share/note/')) {
        if (this.settings.BROWSER_TITLE) {
          document.title = this.settings.BROWSER_TITLE;
        } else if (this.settings.PLATFORM_NAME) {
          document.title = this.settings.PLATFORM_NAME;
        }
      }

      // Update favicon dynamically
      const faviconUrl = getAssetUrl(
        this.settings.PLATFORM_FAVICON_URL || this.settings.PLATFORM_LOGO_URL,
      );
      if (faviconUrl) {
        let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
        if (!link) {
          link = document.createElement('link');
          link.rel = 'icon';
          document.getElementsByTagName('head')[0].appendChild(link);
        }
        link.href = faviconUrl;
        if (faviconUrl.indexOf('.svg') === -1) {
          link.removeAttribute('type');
        }
        try {
          localStorage.setItem('platform_favicon', faviconUrl);
        } catch {}
      } else {
        try {
          localStorage.removeItem('platform_favicon');
        } catch {}
      }

      // Update meta description
      if (this.settings.PLATFORM_DESCRIPTION) {
        let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement;
        if (!meta) {
          meta = document.createElement('meta');
          meta.name = 'description';
          document.getElementsByTagName('head')[0].appendChild(meta);
        }
        meta.content = this.settings.PLATFORM_DESCRIPTION;
      }
    },
    async fetchSettings() {
      if (pendingSettingsFetch) {
        await pendingSettingsFetch;
        return;
      }

      pendingSettingsFetch = (async () => {
        try {
          const { data } = await api.get('/api/auth/settings');

          const toBool = (val: unknown): boolean => val === true || val === 'true';

          const safeParseArray = (val: unknown, fallback: string[]) => {
            if (Array.isArray(val)) return val;
            if (typeof val !== 'string') return fallback;
            try {
              const parsed = JSON.parse(val);
              return Array.isArray(parsed) ? parsed : fallback;
            } catch {
              return fallback;
            }
          };

          const tryParseJson = (val: string): unknown => {
            try {
              return JSON.parse(val);
            } catch {
              return [];
            }
          };

          const safeParseModels = (val: unknown): PublicAIModelOption[] => {
            const raw = typeof val === 'string' ? tryParseJson(val) : val;
            if (!Array.isArray(raw)) return [];
            return raw
              .map((item): PublicAIModelOption | null => {
                if (!item || typeof item !== 'object') return null;
                const model = item as Record<string, unknown>;
                const id = String(model.id || '').trim();
                const provider = String(model.provider || '').trim();
                const modelName = String(model.modelName || '').trim();
                if (!id || !provider || !modelName) return null;
                return {
                  id,
                  name: String(model.name || `${provider} ${modelName}`).trim(),
                  provider,
                  modelName,
                  enabled: toBool(model.enabled),
                  isDefault: toBool(model.isDefault),
                  description: typeof model.description === 'string' ? model.description : '',
                  capabilities: Array.isArray(model.capabilities)
                    ? model.capabilities.map(String)
                    : ['chat'],
                  priority: typeof model.priority === 'number' ? model.priority : 999,
                };
              })
              .filter((item): item is PublicAIModelOption => Boolean(item));
          };

          this.settings = {
            PLATFORM_NAME: data.PLATFORM_NAME || DEFAULT_SETTINGS.PLATFORM_NAME,
            PLATFORM_SUBTITLE: data.PLATFORM_SUBTITLE || DEFAULT_SETTINGS.PLATFORM_SUBTITLE,
            BROWSER_TITLE:
              data.BROWSER_TITLE && data.BROWSER_TITLE !== DEFAULT_SETTINGS.PLATFORM_NAME
                ? data.BROWSER_TITLE
                : data.PLATFORM_NAME || DEFAULT_SETTINGS.PLATFORM_NAME,
            PLATFORM_LOGO_URL: data.PLATFORM_LOGO_URL || '',
            PLATFORM_FAVICON_URL: data.PLATFORM_FAVICON_URL || '',
            PLATFORM_DESCRIPTION: data.PLATFORM_DESCRIPTION || '',
            ALLOW_REGISTRATION: toBool(data.ALLOW_REGISTRATION),
            MAINTENANCE_MODE: toBool(data.MAINTENANCE_MODE),
            MATERIAL_CATEGORIES: safeParseArray(
              data.MATERIAL_CATEGORIES,
              DEFAULT_MATERIAL_CATEGORIES,
            ),
            TEAM_CATEGORIES: safeParseArray(data.TEAM_CATEGORIES, DEFAULT_TEAM_CATEGORIES),
            SHOWCASE_CATEGORIES: safeParseArray(
              data.SHOWCASE_CATEGORIES,
              DEFAULT_SHOWCASE_CATEGORIES,
            ),
            PLUGIN_CATEGORIES: safeParseArray(data.PLUGIN_CATEGORIES, DEFAULT_PLUGIN_CATEGORIES),
            SOFTWARE_CATEGORIES: safeParseArray(data.SOFTWARE_CATEGORIES, DEFAULT_SOFTWARE_CATEGORIES),
            PASSWORD_MIN_LENGTH: String(data.PASSWORD_MIN_LENGTH || '6'),
            SESSION_TIMEOUT: data.SESSION_TIMEOUT || '7d',
            AUTO_APPROVE_MATERIALS: toBool(data.AUTO_APPROVE_MATERIALS),
            AUTO_APPROVE_SHOWCASES: toBool(data.AUTO_APPROVE_SHOWCASES),
            MAX_UPLOAD_SIZE_MB: String(data.MAX_UPLOAD_SIZE_MB || '100'),
            ALLOWED_FILE_TYPES: safeParseArray(data.ALLOWED_FILE_TYPES, DEFAULT_ALLOWED_FILE_TYPES),
            DEFAULT_USER_ROLE: data.DEFAULT_USER_ROLE || 'USER',
            FOOTER_TEXT: data.FOOTER_TEXT || '',
            OAUTH_GOOGLE_ENABLED: toBool(data.OAUTH_GOOGLE_ENABLED),
            OAUTH_GITHUB_ENABLED: toBool(data.OAUTH_GITHUB_ENABLED),
            AI_IMPORT_ENABLED: toBool(data.AI_IMPORT_ENABLED),
            AI_MODEL_OPTIONS: safeParseModels(data.AI_MODEL_OPTIONS),
            TEMPORARY_NETDISK_CLEANUP_TIME: data.TEMPORARY_NETDISK_CLEANUP_TIME || '03:00',
          };
        } catch (error) {
          logError(error, { operation: 'system.fetchSettings', component: 'systemStore' });
        } finally {
          this.isInitialized = true;
          this.updateBrowserBranding();
        }
      })();

      try {
        await pendingSettingsFetch;
      } finally {
        pendingSettingsFetch = null;
      }
    },
  },
});
