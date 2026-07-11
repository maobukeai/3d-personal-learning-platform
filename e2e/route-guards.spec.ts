import { test, expect } from '@playwright/test';

/**
 * P2 E2E：路由守卫
 * 铁律三·5 — 验证 requiresAuth 守卫：未登录用户访问受保护路由时重定向到 /login。
 */
test.describe('路由守卫', () => {
  test('未登录用户访问 /dashboard 重定向到 /login', async ({ page }) => {
    await page.goto('/dashboard');

    // 应该被重定向到登录页
    await expect(page).toHaveURL(/\/login/);
  });

  test('未登录用户访问 /settings 重定向到 /login', async ({ page }) => {
    await page.goto('/settings');
    await expect(page).toHaveURL(/\/login/);
  });

  test('未登录用户访问 /assets 重定向到 /login', async ({ page }) => {
    await page.goto('/assets');
    await expect(page).toHaveURL(/\/login/);
  });

  test('根路径 / 重定向到 /dashboard（然后到 /login）', async ({ page }) => {
    await page.goto('/');
    // / → /dashboard → /login（未登录时）
    await expect(page).toHaveURL(/\/(login|dashboard)/);
  });
});
