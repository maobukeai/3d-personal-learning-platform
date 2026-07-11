import { useAuthStore } from '@/stores/auth';
import { toast } from '@/utils/feedbackAdapter'; /** * 游客态操作拦截 composable * * 在需要鉴权的操作（收藏/上传/编辑/AI 生成等）前调用 requireAuth： * - 已登录 → 返回 true，业务继续 * - 未登录 → 弹出 LoginModal 并提示，业务中止 * * requireAuthAsync 包装异步操作，自动处理拦截逻辑。 */
export function useRequireAuth() {
  const authStore = useAuthStore();
  function requireAuth(): boolean {
    if (authStore.isAuthenticated) return true;
    authStore.showLoginModal = true;
    toast.info('请先登录后再执行此操作');
    return false;
  }
  async function requireAuthAsync<T>(action: () => Promise<T>): Promise<T | undefined> {
    if (!requireAuth()) return undefined;
    return await action();
  }
  /** 仅返回是否登录，不弹窗 */ function isAuthenticated(): boolean {
    return authStore.isAuthenticated;
  }
  return { requireAuth, requireAuthAsync, isAuthenticated };
}
