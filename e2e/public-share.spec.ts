import { test, expect } from '@playwright/test';

/**
 * P2 E2E：公开分享页面
 * 铁律三·5 — 验证公开分享路由不需要登录即可访问。
 */
test.describe('公开分享页面', () => {
  test('访问无效分享链接显示提示而非崩溃', async ({ page }) => {
    // 访问一个不存在的分享 ID —— 应该显示"分享不存在"或类似提示，不应白屏
    await page.goto('/share/note/nonexistent-share-id-12345');

    // 页面应该正常加载（不白屏），显示某种提示信息
    await expect(page.locator('body')).not.toBeEmpty();
    // 不应重定向到登录页（公开分享不需要认证）
    await expect(page).toHaveURL(/\/share\//);
  });
});
