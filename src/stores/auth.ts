import { defineStore } from 'pinia';
import api from '@/utils/api';
import { preferences } from '@/utils/preferences';
import { socketService } from '@/utils/socket';
import { logError } from '@/utils/error';
import type { User } from '@/types';

interface LoginCredentials {
  email: string;
  password: string;
  rememberDevice?: boolean;
  twoFactorCode?: string;
}

interface RegisterPayload {
  email: string;
  password: string;
  name?: string;
  verificationCode?: string;
}

interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

interface ResetPasswordWith2FAPayload {
  email: string;
  resetCode?: string;
  newPassword: string;
  twoFactorCode?: string;
  resetToken?: string;
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: preferences.getUser<User>(),
    deviceToken: preferences.getDeviceToken(),
    // In-memory access token. Set after login/refresh so api.ts can attach
    // it as a Bearer header without depending on the async cookie-write race.
    accessToken: null as string | null,
    // Controls the guest login modal shown by useRequireAuth.
    showLoginModal: false,
    // Plain object instead of Set: Vue 3 makes object key additions/removals
    // reactive automatically, so we no longer rebuild the whole collection on
    // every presence update (was O(n) per event with the prior Set pattern).
    onlineUserIds: {} as Record<string, true>,
    unreadMessagesCount: 0,
  }),
  getters: {
    isAuthenticated: (state) => !!state.user,
    isUserOnline: (state) => (userId: string) => state.onlineUserIds[userId] === true,
    userLevel: (state) => {
      const points = state.user?.points ?? 50;
      if (points < 100) return 1;
      if (points < 200) return 2;
      if (points < 350) return 3;
      if (points < 500) return 4;
      if (points < 700) return 5;
      if (points < 950) return 6;
      if (points < 1200) return 7;
      if (points < 1500) return 8;
      if (points < 1900) return 9;
      return 10;
    },
  },
  actions: {
    setUnreadMessagesCount(count: number) {
      this.unreadMessagesCount = count;
    },
    incrementUnreadMessagesCount() {
      this.unreadMessagesCount++;
    },
    setAccessToken(token: string | null) {
      this.accessToken = token;
    },
    setShowLoginModal(show: boolean) {
      this.showLoginModal = show;
    },
    setOnlineUsers(ids: string[]) {
      this.onlineUserIds = Object.fromEntries(ids.map((id) => [id, true as const]));
    },
    updateUserStatus(userId: string, status: 'online' | 'offline') {
      if (status === 'online') {
        this.onlineUserIds[userId] = true;
      } else {
        delete this.onlineUserIds[userId];
      }
    },
    async login(credentials: LoginCredentials) {
      const response = await api.post('/api/auth/login', {
        ...credentials,
        deviceToken: this.deviceToken,
      });
      if (response.data.user) {
        this.user = response.data.user;
        preferences.setUser(this.user);
      }
      // Store the access token returned by the server so subsequent requests
      // attach the Authorization header immediately (no 401 round-trip).
      if (response.data.accessToken) {
        this.accessToken = response.data.accessToken;
      }
      if (response.data.refreshToken) {
        preferences.setRefreshToken(response.data.refreshToken);
      }
      return response.data;
    },
    async register(userData: RegisterPayload) {
      await api.post('/api/auth/register', userData);
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
        preferences.setUser(this.user);
      } catch {
        if (this.user) {
          this.logout();
        }
      }
    },
    async updateProfile(profileData: Partial<User>) {
      const response = await api.put('/api/auth/profile', profileData);
      this.user = response.data;
      preferences.setUser(this.user);
      return response.data;
    },
    async uploadAvatar(file: File) {
      const formData = new FormData();
      formData.append('avatar', file);
      const response = await api.post('/api/auth/upload-avatar', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      this.user = response.data;
      preferences.setUser(this.user);
      return response.data;
    },
    async uploadCover(file: File) {
      const formData = new FormData();
      formData.append('cover', file);
      const response = await api.post('/api/auth/upload-cover', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      this.user = response.data;
      preferences.setUser(this.user);
      return response.data;
    },
    async changePassword(passwordData: ChangePasswordPayload) {
      const response = await api.put('/api/auth/change-password', passwordData);
      return response.data;
    },
    async setup2FA() {
      const response = await api.put('/api/auth/2fa/setup');
      return response.data;
    },
    async enable2FA(code: string, password: string) {
      const response = await api.post('/api/auth/2fa/enable', { code, password });
      if (this.user) {
        this.user.twoFactorEnabled = true;
        preferences.setUser(this.user);
      }
      return response.data;
    },
    async disable2FA(payload: { code?: string; password?: string }) {
      const response = await api.post('/api/auth/2fa/disable', payload);
      if (this.user) {
        this.user.twoFactorEnabled = false;
        preferences.setUser(this.user);
      }
      return response.data;
    },
    async login2FA(userId: string, code: string, rememberDevice: boolean = false) {
      const response = await api.post('/api/auth/login/2fa', { userId, code, rememberDevice });
      this.user = response.data.user;
      preferences.setUser(this.user);
      if (response.data.accessToken) {
        this.accessToken = response.data.accessToken;
      }
      if (response.data.refreshToken) {
        preferences.setRefreshToken(response.data.refreshToken);
      }
      if (response.data.deviceToken) {
        this.deviceToken = response.data.deviceToken;
        preferences.setDeviceToken(this.deviceToken);
      }
      return response.data;
    },
    async refreshAccessToken() {
      try {
        const refreshToken = preferences.getRefreshToken();
        const response = await api.post(
          '/api/auth/refresh',
          refreshToken ? { refreshToken } : undefined,
        );
        // The server returns the new access token in response.data.accessToken
        // (or bare response.data when the body is the token string directly).
        const token: string | null =
          typeof response.data === 'string' ? response.data : (response.data?.accessToken ?? null);
        this.accessToken = token;
        if (response.data?.refreshToken) {
          preferences.setRefreshToken(response.data.refreshToken);
        }
        // Reconnect the socket with the fresh token so the handshake succeeds.
        if (token) {
          const { socketService } = await import('@/utils/socket');
          socketService.reconnectWithToken(token);
        }
        return token;
      } catch (error) {
        this.logout();
        throw error;
      }
    },
    async forgotPasswordCheck(email: string) {
      const response = await api.post('/api/auth/forgot-password/check', { email });
      return response.data;
    },
    async resetPasswordWith2FA(resetData: ResetPasswordWith2FAPayload) {
      const response = await api.post('/api/auth/forgot-password/reset-2fa', resetData);
      return response.data;
    },
    async sendEmailVerification() {
      const response = await api.post('/api/auth/email/send-code');
      return response.data;
    },
    async verifyEmail(code: string) {
      const response = await api.post('/api/auth/email/verify', { code });
      if (this.user) {
        this.user.emailVerified = true;
        preferences.setUser(this.user);
      }
      return response.data;
    },
    async sendChangeEmailCode(newEmail: string) {
      const response = await api.post('/api/auth/email/send-code-new', { newEmail });
      return response.data;
    },
    async changeEmail(newEmail: string, code: string) {
      const response = await api.put('/api/auth/email/change', { newEmail, code });
      if (this.user) {
        this.user.email = response.data.user.email;
        this.user.emailVerified = response.data.user.emailVerified;
        preferences.setUser(this.user);
      }
      return response.data;
    },
    async logout() {
      socketService.disconnect();
      api.post('/api/auth/logout').catch((err) => {
        logError(err, { operation: 'auth.logout', component: 'authStore' });
      });

      // Reset workspace store (Pinia handles cross-store circular references)
      const { useWorkspaceStore } = await import('./workspace');
      const workspaceStore = useWorkspaceStore();
      workspaceStore.reset();

      this.user = null;
      this.accessToken = null;
      this.deviceToken = '';
      this.onlineUserIds = {};
      this.unreadMessagesCount = 0;
      this.showLoginModal = false;
      preferences.clearUser();
      preferences.clearDeviceToken();
      preferences.clearLegacyAuthTokens();
      preferences.clearActiveWorkspaceId();
    },
  },
});
