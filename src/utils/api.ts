import axios from 'axios';
import router from '@/router';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

export const getAssetUrl = (url: string | null | undefined): string => {
  if (!url) return '';
  // Fix corrupted 'undefined/' urls from previous bugs
  if (url.startsWith('undefined/')) {
    const clean = url.replace('undefined/', '/');
    return `${API_BASE_URL.replace(/\/$/, '')}${clean}`;
  }
  // Return absolute urls as is
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  // Prepend base url for relative paths
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return `${API_BASE_URL.replace(/\/$/, '')}${cleanPath}`;
};

// 请求拦截器：自动注入 Workspace ID
api.interceptors.request.use((config) => {
  const activeWorkspaceId = localStorage.getItem('activeWorkspaceId');
  if (activeWorkspaceId) {
    config.headers['X-Workspace-Id'] = activeWorkspaceId;
  }

  return config;
});

let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// 响应拦截器：处理 Token 过期与系统维护
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Avoid infinite loop and deadlock for refresh token request
    if (originalRequest.url?.includes('/api/auth/refresh')) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => {
            return api(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const { useAuthStore } = await import('@/stores/auth');
      const authStore = useAuthStore();

      try {
        await authStore.refreshAccessToken();
        processQueue(null);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError);

        // Only redirect to login if we are on a route that requires authentication
        if (router.currentRoute.value.meta.requiresAuth) {
          authStore.logout();
          router.push('/login');
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    } else if (error.response?.status === 503) {
      // System Maintenance
      const { useSystemStore } = await import('@/stores/system');
      const systemStore = useSystemStore();
      await systemStore.fetchSettings();
      if (systemStore.settings.MAINTENANCE_MODE) {
        router.push('/maintenance');
      }
    }
    return Promise.reject(error);
  },
);

export default api;
