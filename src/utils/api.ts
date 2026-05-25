import axios from 'axios';
import router from '@/router';
import { preferences } from '@/utils/preferences';
import { useAuthStore } from '@/stores/auth';
import { useSystemStore } from '@/stores/system';
import { getApiErrorStatus } from '@/utils/error';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const NORMALIZED_API_BASE_URL = API_BASE_URL.replace(/\/$/, '');

const isLocalUploadUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return (
      ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname) &&
      parsed.pathname.startsWith('/uploads/')
    );
  } catch {
    return false;
  }
};

const normalizeLocalUploadUrl = (value: string): string => {
  if (!isLocalUploadUrl(value)) return value;
  const parsed = new URL(value);
  return `${NORMALIZED_API_BASE_URL}${parsed.pathname}${parsed.search}${parsed.hash}`;
};

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

export const getAssetUrl = (url: string | null | undefined): string => {
  if (!url) return '';
  // Fix corrupted 'undefined/' urls from previous bugs
  if (url.startsWith('undefined/')) {
    const clean = url.replace('undefined/', '/');
    return `${NORMALIZED_API_BASE_URL}${clean}`;
  }
  // Return absolute urls as is
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return normalizeLocalUploadUrl(url);
  }
  // Prepend base url for relative paths
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return `${NORMALIZED_API_BASE_URL}${cleanPath}`;
};

const getCookie = (name: string): string | undefined => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return undefined;
};

// 请求拦截器：自动注入 Workspace ID 和 CSRF Token
api.interceptors.request.use((config) => {
  const activeWorkspaceId = preferences.getActiveWorkspaceId();
  if (activeWorkspaceId) {
    config.headers['X-Workspace-Id'] = activeWorkspaceId;
  }

  // Inject CSRF token for non-idempotent requests (POST, PUT, DELETE, PATCH)
  const method = config.method?.toUpperCase();
  if (method && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    const csrfToken = getCookie('csrfToken');
    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }
  }

  return config;
});

let isRefreshing = false;
type FailedRequest = {
  resolve: (token: string | null) => void;
  reject: (error: unknown) => void;
};

let failedQueue: FailedRequest[] = [];

const processQueue = (error: unknown, token: string | null = null) => {
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

    if (
      getApiErrorStatus(error) === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/api/auth/settings')
    ) {
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
    } else if (getApiErrorStatus(error) === 503) {
      // System Maintenance
      if (
        !originalRequest.url?.includes('/api/auth/settings') &&
        !originalRequest.url?.includes('/api/auth/refresh') &&
        !isRefreshing
      ) {
        const systemStore = useSystemStore();
        await systemStore.fetchSettings();
        if (systemStore.settings.MAINTENANCE_MODE) {
          router.push('/maintenance');
        }
      }
    }
    return Promise.reject(error);
  },
);

export default api;
