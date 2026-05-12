import axios from 'axios';
import router from '@/router';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
});

// 请求拦截器：自动注入 Token 与 Workspace ID
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const activeWorkspaceId = localStorage.getItem('activeWorkspaceId');
  if (activeWorkspaceId) {
    config.headers['X-Workspace-Id'] = activeWorkspaceId;
  }
  
  return config;
});

// 响应拦截器：处理 Token 过期与系统维护
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Dynamic import to avoid circular dependency
      const { useAuthStore } = await import('@/stores/auth');
      const authStore = useAuthStore();
      authStore.logout();
      if (router.currentRoute.value.meta.requiresAuth) {
        router.push('/login');
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
  }
);

export default api;

