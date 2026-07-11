import { test, expect } from '@playwright/test';

/**
 * §7.2 — Dropdown 键盘无障碍 E2E
 * 覆盖：aria-haspopup、Enter/Space/ArrowDown 打开、Arrow Up/Down 导航、
 * Enter 选中、Escape 关闭 + 焦点返回、aria-expanded 状态变化。
 */
const A11Y_PAGE = '/dev/a11y';

// The Dropdown wraps the trigger slot in a radix DropdownMenuTrigger (as-child)
// div that carries aria-haspopup / aria-expanded. The visible button sits inside.
const triggerWrapper = '[data-testid="dropdown-section"] [aria-haspopup]';

test.describe('Dropdown 键盘无障碍', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
    );
    await page.goto(A11Y_PAGE);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByTestId('a11y-test-page')).toBeVisible();
  });

  test('触发器有 aria-haspopup="menu"', async ({ page }) => {
    await expect(page.locator(triggerWrapper)).toHaveAttribute('aria-haspopup', 'menu');
  });

  test('初始 aria-expanded="false"', async ({ page }) => {
    await expect(page.locator(triggerWrapper)).toHaveAttribute('aria-expanded', 'false');
  });

  test('Enter 打开菜单且 aria-expanded 变为 true', async ({ page }) => {
    await page.getByTestId('dropdown-trigger').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator(triggerWrapper)).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('menuitem').first()).toBeVisible();
  });

  test('Space 打开菜单', async ({ page }) => {
    await page.getByTestId('dropdown-trigger').focus();
    await page.keyboard.press('Space');
    await expect(page.locator(triggerWrapper)).toHaveAttribute('aria-expanded', 'true');
  });

  test('ArrowDown 打开菜单', async ({ page }) => {
    await page.getByTestId('dropdown-trigger').focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.locator(triggerWrapper)).toHaveAttribute('aria-expanded', 'true');
  });

  test('Arrow Up/Down 导航菜单项', async ({ page }) => {
    await page.getByTestId('dropdown-trigger').focus();
    await page.keyboard.press('ArrowDown');
    // opening with ArrowDown focuses the first item
    await expect(page.getByRole('menuitem').nth(0)).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitem').nth(1)).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(page.getByRole('menuitem').nth(0)).toBeFocused();
  });

  test('Enter 选中菜单项并触发 command', async ({ page }) => {
    await page.getByTestId('dropdown-trigger').focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown'); // move to 2nd item (Duplicate)
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('dropdown-result')).toContainText('duplicate');
    // menu closes after select
    await expect(page.locator(triggerWrapper)).toHaveAttribute('aria-expanded', 'false');
  });

  test('Escape 关闭菜单且焦点返回触发器', async ({ page }) => {
    await page.getByTestId('dropdown-trigger').focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.locator(triggerWrapper)).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(page.locator(triggerWrapper)).toHaveAttribute('aria-expanded', 'false');
    // radix restores focus to the DropdownMenuTrigger wrapper element (the div
    // that carries aria-haspopup). The inner button does NOT receive focus —
    // this test documents that behaviour.
    await expect(page.locator(triggerWrapper)).toBeFocused();
  });
});
