import { defineStore } from 'pinia';
import api from '@/utils/api';

interface User {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  bio?: string;
  location?: string;
  website?: string;
  role: string;
  emailVerified?: boolean;
  twoFactorEnabled?: boolean;
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as User | null,
    token: localStorage.getItem('token') || '',
    deviceToken: localStorage.getItem('deviceToken') || '',
  }),
  getters: {
    isAuthenticated: (state) => !!state.token,
  },
  actions: {
    async login(credentials: any) {
      try {
        const response = await api.post('/api/auth/login', {
          ...credentials,
          deviceToken: this.deviceToken
        });
        if (response.data.token) {
          this.token = response.data.token;
          this.user = response.data.user;
          localStorage.setItem('token', this.token);
        }
        return response.data;
      } catch (error) {
        throw error;
      }
    },
    async register(userData: any) {
      try {
        await api.post('/api/auth/register', userData);
      } catch (error) {
        throw error;
      }
    },
    async fetchMe() {
      if (!this.token) return;
      try {
        const response = await api.get('/api/auth/me');
        this.user = response.data;
      } catch (error) {
        this.logout();
      }
    },
    async updateProfile(profileData: Partial<User>) {
      try {
        const response = await api.put('/api/auth/profile', profileData);
        this.user = response.data;
        return response.data;
      } catch (error) {
        throw error;
      }
    },
    async uploadAvatar(file: File) {
      try {
        const formData = new FormData();
        formData.append('avatar', file);
        const response = await api.post('/api/auth/upload-avatar', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
        this.user = response.data;
        return response.data;
      } catch (error) {
        throw error;
      }
    },
    async changePassword(passwordData: any) {
      try {
        const response = await api.put('/api/auth/change-password', passwordData);
        return response.data;
      } catch (error) {
        throw error;
      }
    },
    async setup2FA() {
      try {
        const response = await api.put('/api/auth/2fa/setup');
        return response.data;
      } catch (error) {
        throw error;
      }
    },
    async enable2FA(code: string) {
      try {
        const response = await api.post('/api/auth/2fa/enable', { code });
        if (this.user) this.user.twoFactorEnabled = true;
        return response.data;
      } catch (error) {
        throw error;
      }
    },
    async disable2FA() {
      try {
        const response = await api.post('/api/auth/2fa/disable');
        if (this.user) this.user.twoFactorEnabled = false;
        return response.data;
      } catch (error) {
        throw error;
      }
    },
    async login2FA(userId: string, code: string, rememberDevice: boolean = false) {
      try {
        const response = await api.post('/api/auth/login/2fa', { userId, code, rememberDevice });
        this.token = response.data.token;
        this.user = response.data.user;
        localStorage.setItem('token', this.token);
        if (response.data.deviceToken) {
          this.deviceToken = response.data.deviceToken;
          localStorage.setItem('deviceToken', this.deviceToken);
        }
        return response.data;
      } catch (error) {
        throw error;
      }
    },
    async forgotPasswordCheck(email: string) {
      try {
        const response = await api.post('/api/auth/forgot-password/check', { email });
        return response.data;
      } catch (error) {
        throw error;
      }
    },
    async resetPasswordWith2FA(resetData: any) {
      try {
        const response = await api.post('/api/auth/forgot-password/reset-2fa', resetData);
        return response.data;
      } catch (error) {
        throw error;
      }
    },
    async sendEmailVerification() {
      try {
        const response = await api.post('/api/auth/email/send-code');
        return response.data;
      } catch (error) {
        throw error;
      }
    },
    async verifyEmail(code: string) {
      try {
        const response = await api.post('/api/auth/email/verify', { code });
        if (this.user) this.user.emailVerified = true;
        return response.data;
      } catch (error) {
        throw error;
      }
    },
    async sendChangeEmailCode(newEmail: string) {
      try {
        const response = await api.post('/api/auth/email/send-code-new', { newEmail });
        return response.data;
      } catch (error) {
        throw error;
      }
    },
    async changeEmail(newEmail: string, code: string) {
      try {
        const response = await api.put('/api/auth/email/change', { newEmail, code });
        if (this.user) {
          this.user.email = response.data.user.email;
          this.user.emailVerified = response.data.user.emailVerified;
        }
        return response.data;
      } catch (error) {
        throw error;
      }
    },
    logout() {
      this.user = null;
      this.token = '';
      localStorage.removeItem('token');
    }
  }
});
