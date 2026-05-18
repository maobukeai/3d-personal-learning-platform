import { defineStore } from 'pinia';
import api from '@/utils/api';
import { socketService } from '@/utils/socket';

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
  createdAt: string;
  subscription?: {
    plan: {
      name: string;
      displayName?: string;
      badgeColor?: string;
    };
    status?: string;
    interval?: string;
  };
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: JSON.parse(localStorage.getItem('user') || 'null') as User | null,
    deviceToken: localStorage.getItem('deviceToken') || '',
    onlineUserIds: new Set<string>(),
    unreadMessagesCount: 0,
  }),
  getters: {
    isAuthenticated: (state) => !!state.user,
    isUserOnline: (state) => (userId: string) => state.onlineUserIds.has(userId),
  },
  actions: {
    setUnreadMessagesCount(count: number) {
      this.unreadMessagesCount = count;
    },
    incrementUnreadMessagesCount() {
      this.unreadMessagesCount++;
    },
    setOnlineUsers(ids: string[]) {
      this.onlineUserIds = new Set(ids);
    },
    updateUserStatus(userId: string, status: 'online' | 'offline') {
      if (status === 'online') {
        this.onlineUserIds.add(userId);
      } else {
        this.onlineUserIds.delete(userId);
      }
      // Force reactivity by re-assigning (Set reactivity can be tricky in some Vue versions)
      this.onlineUserIds = new Set(this.onlineUserIds);
    },
    async login(credentials: any) {
      try {
        const response = await api.post('/api/auth/login', {
          ...credentials,
          deviceToken: this.deviceToken,
        });
        if (response.data.user) {
          this.user = response.data.user;
          localStorage.setItem('user', JSON.stringify(this.user));
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
    async sendPublicVerificationCode(email: string) {
      await api.post('/api/auth/email/send-code-public', { email });
    },
    async verifyPublicEmail(email: string, code: string) {
      await api.post('/api/auth/email/verify-public', { email, code });
    },
    async fetchMe() {
      try {
        const response = await api.get('/api/auth/me');
        this.user = response.data;
        localStorage.setItem('user', JSON.stringify(this.user));
      } catch (error) {
        this.logout();
      }
    },
    async updateProfile(profileData: Partial<User>) {
      try {
        const response = await api.put('/api/auth/profile', profileData);
        this.user = response.data;
        localStorage.setItem('user', JSON.stringify(this.user));
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
            'Content-Type': 'multipart/form-data',
          },
        });
        this.user = response.data;
        localStorage.setItem('user', JSON.stringify(this.user));
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
        if (this.user) {
          this.user.twoFactorEnabled = true;
          localStorage.setItem('user', JSON.stringify(this.user));
        }
        return response.data;
      } catch (error) {
        throw error;
      }
    },
    async disable2FA() {
      try {
        const response = await api.post('/api/auth/2fa/disable');
        if (this.user) {
          this.user.twoFactorEnabled = false;
          localStorage.setItem('user', JSON.stringify(this.user));
        }
        return response.data;
      } catch (error) {
        throw error;
      }
    },
    async login2FA(userId: string, code: string, rememberDevice: boolean = false) {
      try {
        const response = await api.post('/api/auth/login/2fa', { userId, code, rememberDevice });
        this.user = response.data.user;
        localStorage.setItem('user', JSON.stringify(this.user));
        if (response.data.deviceToken) {
          this.deviceToken = response.data.deviceToken;
          localStorage.setItem('deviceToken', this.deviceToken);
        }
        return response.data;
      } catch (error) {
        throw error;
      }
    },
    async refreshAccessToken() {
      try {
        const response = await api.post('/api/auth/refresh');
        return response.data;
      } catch (error) {
        this.logout();
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
        if (this.user) {
          this.user.emailVerified = true;
          localStorage.setItem('user', JSON.stringify(this.user));
        }
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
          localStorage.setItem('user', JSON.stringify(this.user));
        }
        return response.data;
      } catch (error) {
        throw error;
      }
    },
    async logout() {
      socketService.disconnect();
      api.post('/api/auth/logout').catch(() => {});
      
      // Reset workspace store
      const { useWorkspaceStore } = await import('./workspace');
      const workspaceStore = useWorkspaceStore();
      workspaceStore.reset();

      this.user = null;
      this.deviceToken = '';
      this.onlineUserIds = new Set<string>();
      this.unreadMessagesCount = 0;
      localStorage.removeItem('user');
      localStorage.removeItem('deviceToken');
      localStorage.removeItem('activeWorkspaceId');
    },
  },
});
