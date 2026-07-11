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

  /* Fix corrupted 'undefined/' urls from previous bugs */
  if (url.startsWith('undefined/')) {
    const clean = url.replace('undefined/', '/');
    return `${NORMALIZED_API_BASE_URL}${clean}`;
  }

  /* Return absolute urls as is */
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    let normalized = normalizeLocalUploadUrl(url);
    if (normalized.startsWith('http://')) {
      try {
        const parsed = new URL(normalized);
        const host = parsed.hostname.toLowerCase();

        /* Do not upgrade local/dev addresses */
        const isLocal =
          ['localhost', '127.0.0.1', '::1'].includes(host) ||
          /^192\.168\./.test(host) ||
          /^10\./.test(host) ||
          /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
          host.endsWith('.local');

        if (!isLocal) {
          normalized = `https://${parsed.host}${parsed.pathname}${parsed.search}${parsed.hash}`;
        }
      } catch {
        normalized = normalized.replace(/^http:\/\//i, 'https://');
      }
    }
    return normalized;
  }

  /* Prepend base url for relative paths */
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return `${NORMALIZED_API_BASE_URL}${cleanPath}`;
};

const getCookie = (name: string): string | undefined => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return undefined;
};

/* 请求拦截器：自动注入 Workspace ID 和 CSRF Token */
api.interceptors.request.use((config) => {
  /* Inject in-memory access token as Bearer header on every request.
     This is set after login/refresh and avoids the async browser cookie-write
     race condition that causes 401s on requests fired immediately after refresh.
     The auth refresh endpoint itself is excluded to avoid circular dependency. */
  const isAuthRefresh = config.url?.includes('/auth/refresh');
  if (!isAuthRefresh) {
    const authStore = useAuthStore();
    if (authStore.accessToken) {
      config.headers['Authorization'] = `Bearer ${authStore.accessToken}`;
    }
  }

  const activeWorkspaceId = preferences.getActiveWorkspaceId();
  if (activeWorkspaceId) {
    config.headers['X-Workspace-Id'] = activeWorkspaceId;
  }

  /* Inject CSRF token for non-idempotent requests (POST, PUT, DELETE, PATCH) */
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
  const queue = failedQueue;
  failedQueue = [];
  if (error) {
    queue.forEach((prom) => prom.reject(error));
  } else {
    /* Stagger queued retries by 50ms per request to avoid a thundering-herd
       burst that would immediately exhaust the rate limit after token refresh. */
    queue.forEach((prom, i) => {
      setTimeout(() => prom.resolve(token), i * 50);
    });
  }
};

const shouldBypassRefresh = (url: string | undefined): boolean => {
  if (!url) return false;
  return (
    url.includes('/auth/login') ||
    url.includes('/auth/refresh') ||
    url.includes('/auth/logout') ||
    url.includes('/auth/register') ||
    url.includes('/auth/forgot-password') ||
    url.includes('/auth/email/send-code-public') ||
    url.includes('/auth/email/verify-public') ||
    url.includes('/auth/settings') ||
    url.includes('/auth/google') ||
    url.includes('/auth/github')
  );
};

/* 响应拦截器：处理 Token 过期与系统维护 */
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    /* Avoid infinite loop and deadlock for refresh token request or other public auth actions */
    if (shouldBypassRefresh(originalRequest?.url)) {
      return Promise.reject(error);
    }

    if (getApiErrorStatus(error) === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise<string | null>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((accessToken) => {
            originalRequest._retry = true;
            if (accessToken) {
              originalRequest.headers['Authorization'] = `Bearer ${accessToken}`;
            }
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
        const accessToken = await authStore.refreshAccessToken();
        /* Inject the new access token as a Bearer header so the retry does
           not depend on the browser's async HTTP-only cookie write completing. */
        if (accessToken) {
          originalRequest.headers['Authorization'] = `Bearer ${accessToken}`;
        }
        processQueue(null, accessToken);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError);
        /* Always logout to clear credentials on refresh token failure */
        authStore.logout();
        /* Redirect to login if on a route that requires authentication */
        const requiresAuth =
          router.currentRoute.value.meta.requiresAuth ||
          router.currentRoute.value.matched.some((record) => record.meta.requiresAuth);
        if (requiresAuth) {
          router.push('/login');
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    } else if (getApiErrorStatus(error) === 503) {
      /* System Maintenance */
      if (!shouldBypassRefresh(originalRequest?.url) && !isRefreshing) {
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
