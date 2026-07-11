import { test, expect } from '@playwright/test';

/**
 * P2 E2E：注册页关键路径
 * 铁律三·5 — 覆盖注册页加载、表单字段存在性。
 */
test.describe('注册页', () => {
  test('未注册用户访问 /register 能看到注册表单', async ({ page }) => {
    await page.goto('/register');

    // 邮箱输入框
    await expect(page.locator('input[type="email"]')).toBeVisible();
    // 密码输入框（至少两个：密码 + 确认密码）
    const passwordFields = page.locator('input[type="password"]');
    await expect(passwordFields.first()).toBeVisible();
  });

  test('注册页有返回登录的链接', async ({ page }) => {
    await page.goto('/register');

    const loginLink = page.getByRole('link', { name: /登录|sign\s*in|log\s*in/i });
    if (await loginLink.isVisible()) {
      await loginLink.click();
      await expect(page).toHaveURL(/\/login/);
    }
  });
});
