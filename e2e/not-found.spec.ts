import { test, expect } from '@playwright/test';

/**
 * P2 E2E：404 页面
 * 铁律三·5 — 验证不存在的路由显示 404 页面。
 */
test.describe('404 页面', () => {
  test('访问不存在的路由显示 404', async ({ page }) => {
    await page.goto('/this-route-does-not-exist-12345');

    // 页面应该包含 404 相关文字
    await expect(page.locator('body')).toContainText(/404|not\s*found|找不到|页面不存在/i);
  });
});
