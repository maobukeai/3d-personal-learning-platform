import { defineStore } from 'pinia';
import api, { getAssetUrl } from '@/utils/api';

interface SystemSettings {
  PLATFORM_NAME: string;
  BROWSER_TITLE: string;
  PLATFORM_LOGO_URL: string;
  PLATFORM_FAVICON_URL: string;
  PLATFORM_DESCRIPTION: string;
  ALLOW_REGISTRATION: boolean;
  MAINTENANCE_MODE: boolean;
  MATERIAL_CATEGORIES: string[];
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
}

export const useSystemStore = defineStore('system', {
  state: () => ({
    settings: {
      PLATFORM_NAME: '3D Personal Learning Hub',
      BROWSER_TITLE: '3D Personal Learning Hub',
      PLATFORM_LOGO_URL: '',
      PLATFORM_FAVICON_URL: '',
      PLATFORM_DESCRIPTION: '',
      ALLOW_REGISTRATION: true,
      MAINTENANCE_MODE: false,
      MATERIAL_CATEGORIES: ['全部材料', '金属', '木纹', '石材', '织物', '程序化', '玻璃', '其他'],
      PASSWORD_MIN_LENGTH: '6',
      SESSION_TIMEOUT: '7d',
      AUTO_APPROVE_MATERIALS: false,
      AUTO_APPROVE_SHOWCASES: false,
      MAX_UPLOAD_SIZE_MB: '100',
      ALLOWED_FILE_TYPES: ['.glb', '.gltf', '.fbx', '.obj', '.stl', '.zip'],
      DEFAULT_USER_ROLE: 'USER',
      FOOTER_TEXT: '',
      OAUTH_GOOGLE_ENABLED: false,
      OAUTH_GITHUB_ENABLED: false,
      AI_IMPORT_ENABLED: false,
    } as SystemSettings,
    isInitialized: false,
  }),
  actions: {
    updateBrowserBranding() {
      if (this.settings.BROWSER_TITLE) {
        document.title = this.settings.BROWSER_TITLE;
      } else if (this.settings.PLATFORM_NAME) {
        document.title = this.settings.PLATFORM_NAME;
      }

      // Update favicon dynamically
      const faviconUrl = getAssetUrl(this.settings.PLATFORM_FAVICON_URL || this.settings.PLATFORM_LOGO_URL);
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
        } catch (_e) {}
      } else {
        try {
          localStorage.removeItem('platform_favicon');
        } catch (_e) {}
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
      try {
        const { data } = await api.get('/api/auth/settings');
        
        // Helper for safe JSON parsing
        const safeParseArray = (val: unknown, fallback: string[]) => {
          if (Array.isArray(val)) return val;
          if (typeof val !== 'string') return fallback;
          try {
            const parsed = JSON.parse(val);
            return Array.isArray(parsed) ? parsed : fallback;
          } catch (_e) {
            return fallback;
          }
        };

        this.settings = {
          PLATFORM_NAME: data.PLATFORM_NAME || '3D Personal Learning Hub',
          BROWSER_TITLE: data.BROWSER_TITLE || data.PLATFORM_NAME || '3D Personal Learning Hub',
          PLATFORM_LOGO_URL: data.PLATFORM_LOGO_URL || '',
          PLATFORM_FAVICON_URL: data.PLATFORM_FAVICON_URL || '',
          PLATFORM_DESCRIPTION: data.PLATFORM_DESCRIPTION || '',
          ALLOW_REGISTRATION:
            data.ALLOW_REGISTRATION === true || data.ALLOW_REGISTRATION === 'true',
          MAINTENANCE_MODE: data.MAINTENANCE_MODE === true || data.MAINTENANCE_MODE === 'true',
          MATERIAL_CATEGORIES: safeParseArray(data.MATERIAL_CATEGORIES, ['全部材料', '金属', '木纹', '石材', '织物', '程序化', '玻璃', '其他']),
          PASSWORD_MIN_LENGTH: String(data.PASSWORD_MIN_LENGTH || '6'),
          SESSION_TIMEOUT: data.SESSION_TIMEOUT || '7d',
          AUTO_APPROVE_MATERIALS:
            data.AUTO_APPROVE_MATERIALS === true || data.AUTO_APPROVE_MATERIALS === 'true',
          AUTO_APPROVE_SHOWCASES:
            data.AUTO_APPROVE_SHOWCASES === true || data.AUTO_APPROVE_SHOWCASES === 'true',
          MAX_UPLOAD_SIZE_MB: String(data.MAX_UPLOAD_SIZE_MB || '100'),
          ALLOWED_FILE_TYPES: safeParseArray(data.ALLOWED_FILE_TYPES, ['.glb', '.gltf', '.fbx', '.obj', '.stl', '.zip']),
          DEFAULT_USER_ROLE: data.DEFAULT_USER_ROLE || 'USER',
          FOOTER_TEXT: data.FOOTER_TEXT || '',
          OAUTH_GOOGLE_ENABLED: data.OAUTH_GOOGLE_ENABLED === true || data.OAUTH_GOOGLE_ENABLED === 'true',
          OAUTH_GITHUB_ENABLED: data.OAUTH_GITHUB_ENABLED === true || data.OAUTH_GITHUB_ENABLED === 'true',
          AI_IMPORT_ENABLED: data.AI_IMPORT_ENABLED === true || data.AI_IMPORT_ENABLED === 'true',
        };
      } catch (error) {
        console.error('Failed to fetch system settings:', error);
      } finally {
        this.isInitialized = true;
        this.updateBrowserBranding();
      }
    },
  },
});
