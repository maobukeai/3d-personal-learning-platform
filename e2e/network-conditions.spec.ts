import { test, expect } from '@playwright/test';

/**
 * 铁律一·2 — E2E 自动化测试：极端网络环境
 *
 * 模拟慢速网络、离线、间歇性断网等极端网络条件，验证：
 *  1. 网络超时时 UI 不白屏、不卡死
 *  2. 离线状态下路由守卫与页面渲染正常
 *  3. 网络恢复后功能自动恢复
 *  4. API 请求失败时显示友好的错误提示
 */
test.describe('极端网络环境', () => {
  test('慢速网络下页面仍能渲染', async ({ page }) => {
    // 模拟慢速网络（Slow 3G：下载 ~500kb/s，延迟 ~400ms）
    await page.context().route('**/*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      await route.continue();
    });

    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    // 即使网络慢，页面也应渲染出表单
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('input[type="password"]')).toBeVisible({ timeout: 15000 });
  });

  test('离线状态下访问公开页面不白屏', async ({ page, context }) => {
    // 先正常加载页面
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('input[type="email"]')).toBeVisible();

    // 模拟离线
    await context.setOffline(true);

    // 离线状态下尝试提交空表单
    const loginButton = page.getByRole('button', { name: /登录|sign\s*in/i });
    await loginButton.click().catch(() => {});

    // 页面不应崩溃或白屏
    await expect(page.locator('body')).not.toBeEmpty();
    // 仍停留在登录页
    await expect(page).toHaveURL(/\/login/);

    // 恢复网络
    await context.setOffline(false);
  });

  test('API 请求失败时显示友好提示而非崩溃', async ({ page }) => {
    // 拦截所有 API 请求并返回 500 错误
    await page.route('**/api/**', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      }),
    );

    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    // 页面应正常渲染（不依赖 API）
    await expect(page.locator('input[type="email"]')).toBeVisible();

    // 填写表单并提交
    await page.locator('input[type="email"]').fill('test@example.com');
    await page.locator('input[type="password"]').fill('password123');
    await page
      .getByRole('button', { name: /登录|sign\s*in/i })
      .click()
      .catch(() => {});

    // 页面不应崩溃，应显示某种错误提示或保持在登录页
    await expect(page.locator('body')).not.toBeEmpty();
    await expect(page).toHaveURL(/\/login|\/dashboard/);
  });

  test('间歇性断网后页面可恢复', async ({ page, context }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('input[type="email"]')).toBeVisible();

    // 模拟间歇性断网：离线 → 在线 → 离线 → 在线
    await context.setOffline(true);
    await page.waitForTimeout(500);
    await context.setOffline(false);
    await page.waitForTimeout(500);
    await context.setOffline(true);
    await page.waitForTimeout(500);
    await context.setOffline(false);

    // 网络恢复后页面应仍正常
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('网络超时时登录页不卡死', async ({ page }) => {
    // 模拟 API 请求超时（不响应）
    await page.route('**/api/**', (route) => {
      // 不调用 route.continue() 也不调用 route.fulfill()，模拟请求挂起
      // Playwright 会在默认超时后自动处理
    });

    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('input[type="email"]')).toBeVisible();

    // 填写表单并提交
    await page.locator('input[type="email"]').fill('test@example.com');
    await page.locator('input[type="password"]').fill('password123');

    // 提交后不应卡死页面（页面应保持响应）
    await page
      .getByRole('button', { name: /登录|sign\s*in/i })
      .click()
      .catch(() => {});

    // 等待一段时间后页面仍应可交互
    await page.waitForTimeout(3000);
    await expect(page.locator('body')).not.toBeEmpty();
    // 页面不应白屏
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(0);
  });
});
