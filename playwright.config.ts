import { defineConfig, devices } from '@playwright/test';

/**
 * P2：Playwright E2E 测试配置
 * 铁律三·5 — 前端必须建立 E2E 测试基线，覆盖关键用户路径。
 *
 * 运行方式：
 *  - npx playwright test              运行所有 E2E 测试
 *  - npx playwright test --ui         交互式 UI 模式
 *  - npx playwright test --headed     有头模式
 *  - npx playwright show-report       查看最新报告
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],
  timeout: 60_000,
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    navigationTimeout: 45_000,
    actionTimeout: 15_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],
  // 自动启动 Vite dev server（如果未手动启动）
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://127.0.0.1:5173',
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});
