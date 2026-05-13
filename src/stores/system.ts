import { defineStore } from 'pinia';
import api from '@/utils/api';

interface SystemSettings {
  PLATFORM_NAME: string;
  PLATFORM_LOGO_URL: string;
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
}

export const useSystemStore = defineStore('system', {
  state: () => ({
    settings: {
      PLATFORM_NAME: '3D Personal Learning Hub',
      PLATFORM_LOGO_URL: '',
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
      FOOTER_TEXT: ''
    } as SystemSettings,
    isInitialized: false
  }),
  actions: {
    async fetchSettings() {
      try {
        const { data } = await api.get('/api/auth/settings');
        this.settings = {
          PLATFORM_NAME: data.PLATFORM_NAME || '3D Personal Learning Hub',
          PLATFORM_LOGO_URL: data.PLATFORM_LOGO_URL || '',
          PLATFORM_DESCRIPTION: data.PLATFORM_DESCRIPTION || '',
          ALLOW_REGISTRATION: data.ALLOW_REGISTRATION === true || data.ALLOW_REGISTRATION === 'true',
          MAINTENANCE_MODE: data.MAINTENANCE_MODE === true || data.MAINTENANCE_MODE === 'true',
          MATERIAL_CATEGORIES: Array.isArray(data.MATERIAL_CATEGORIES) ? data.MATERIAL_CATEGORIES : (typeof data.MATERIAL_CATEGORIES === 'string' ? JSON.parse(data.MATERIAL_CATEGORIES) : ['全部材料', '金属', '木纹', '石材', '织物', '程序化', '玻璃', '其他']),
          PASSWORD_MIN_LENGTH: String(data.PASSWORD_MIN_LENGTH || '6'),
          SESSION_TIMEOUT: data.SESSION_TIMEOUT || '7d',
          AUTO_APPROVE_MATERIALS: data.AUTO_APPROVE_MATERIALS === true || data.AUTO_APPROVE_MATERIALS === 'true',
          AUTO_APPROVE_SHOWCASES: data.AUTO_APPROVE_SHOWCASES === true || data.AUTO_APPROVE_SHOWCASES === 'true',
          MAX_UPLOAD_SIZE_MB: String(data.MAX_UPLOAD_SIZE_MB || '100'),
          ALLOWED_FILE_TYPES: Array.isArray(data.ALLOWED_FILE_TYPES) ? data.ALLOWED_FILE_TYPES : (typeof data.ALLOWED_FILE_TYPES === 'string' ? JSON.parse(data.ALLOWED_FILE_TYPES) : ['.glb', '.gltf', '.fbx', '.obj', '.stl', '.zip']),
          DEFAULT_USER_ROLE: data.DEFAULT_USER_ROLE || 'USER',
          FOOTER_TEXT: data.FOOTER_TEXT || ''
        };
        this.isInitialized = true;

        if (this.settings.PLATFORM_NAME) {
          document.title = this.settings.PLATFORM_NAME;
        }
      } catch (error) {
        console.error('Failed to fetch system settings:', error);
      }
    }
  }
});
