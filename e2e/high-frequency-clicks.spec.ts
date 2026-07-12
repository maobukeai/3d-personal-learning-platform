import { test, expect } from '@playwright/test';

/**
 * 铁律一·2 — E2E 自动化测试：高频点击场景
 *
 * 模拟用户高频点击与快速导航，验证：
 *  1. 快速路由切换不导致白屏或崩溃
 *  2. 按钮防抖/防重复提交正常工作
 *  3. 高频交互下 UI 状态保持一致
 */
test.describe('高频点击场景', () => {
  test('快速在登录/注册页间切换不崩溃', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('/login');

    // 快速点击注册链接与登录链接各 3 次，模拟用户高频切换
    for (let i = 0; i < 3; i++) {
      const registerLink = page.getByRole('link', { name: /注册|register/i });
      if (await registerLink.isVisible({ timeout: 1000 }).catch(() => false)) {
        await registerLink.click().catch(() => {});
      }
      const loginLink = page.getByRole('link', { name: /进入平台|点此登录|登录|sign\s*in/i });
      if (await loginLink.isVisible({ timeout: 1000 }).catch(() => false)) {
        await loginLink.click().catch(() => {});
      }
    }

    // 最终应停留在 login 或 register 页面，且页面正常渲染
    await expect(page).toHaveURL(/\/(login|register)/);
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('快速连续点击登录按钮不产生重复请求或崩溃', async ({ page }) => {
    await page.goto('/login');

    // 拦截 API 请求计数
    let loginRequestCount = 0;
    page.on('request', (request) => {
      if (request.url().includes('/api/auth/login')) {
        loginRequestCount++;
      }
    });

    const loginButton = page.getByRole('button', { name: /进入平台|登录|sign\s*in/i });

    // 快速连续点击 10 次（模拟高频点击）
    for (let i = 0; i < 10; i++) {
      await loginButton.click({ timeout: 500 }).catch(() => {});
    }

    // 等待可能的异步请求完成
    await page.waitForTimeout(1000);

    // 页面不应崩溃
    await expect(page.locator('body')).not.toBeEmpty();
    // 空表单提交不应发送登录请求（前端校验应拦截）
    // 即使发送了请求，也不应因高频点击导致超过 1 次（防抖机制）
    expect(loginRequestCount).toBeLessThanOrEqual(1);
  });

  test('快速导航到多个受保护路由不崩溃', async ({ page }) => {
    // 未登录状态下快速访问多个受保护路由，验证路由守卫稳定工作
    const protectedRoutes = ['/dashboard', '/assets', '/settings', '/community', '/tasks'];

    for (const route of protectedRoutes) {
      await page.goto(route).catch(() => {});
    }

    // 最终应被重定向到登录页
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('body')).not.toBeEmpty();
  });
});
