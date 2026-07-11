import { test, expect, type Page } from '@playwright/test';

/**
 * §7.2 — Select 键盘无障碍 E2E
 * 覆盖：aria-haspopup="listbox"、Enter/Space/ArrowDown 打开、Arrow Up/Down 导航、
 * Enter 选中、Escape 关闭、选中值反映到触发器。
 *
 * Note: radix-vue SelectTrigger renders role="combobox" but does NOT set
 * aria-haspopup="listbox". The aria-haspopup test below documents this gap;
 * all behavioural tests use getByRole('combobox') to locate the trigger.
 */
const A11Y_PAGE = '/dev/a11y';

function selectTrigger(page: Page) {
  return page.getByRole('combobox');
}

test.describe('Select 键盘无障碍', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
    );
    await page.goto(A11Y_PAGE);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByTestId('a11y-test-page')).toBeVisible();
  });

  test('触发器有 aria-haspopup="listbox"（无障碍期望 — 当前缺失）', async ({ page }) => {
    // radix-vue SelectTrigger uses role="combobox" but does not set
    // aria-haspopup="listbox". This test documents the accessibility gap.
    const trigger = selectTrigger(page);
    await expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
  });

  test('Enter 打开下拉', async ({ page }) => {
    const trigger = selectTrigger(page);
    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('option').first()).toBeVisible();
  });

  test('Space 打开下拉', async ({ page }) => {
    const trigger = selectTrigger(page);
    await trigger.focus();
    await page.keyboard.press('Space');
    await expect(page.getByRole('option').first()).toBeVisible();
  });

  test('ArrowDown 打开下拉', async ({ page }) => {
    const trigger = selectTrigger(page);
    await trigger.focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('option').first()).toBeVisible();
  });

  test('Arrow Up/Down 导航选项', async ({ page }) => {
    const trigger = selectTrigger(page);
    await trigger.focus();
    await page.keyboard.press('ArrowDown');
    // opening with ArrowDown focuses the first option
    await expect(page.getByRole('option').nth(0)).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('option').nth(1)).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(page.getByRole('option').nth(0)).toBeFocused();
  });

  test('Enter 选中选项且触发器反映选中值', async ({ page }) => {
    const trigger = selectTrigger(page);
    await trigger.focus();
    await page.keyboard.press('ArrowDown'); // open, focus Apple
    await expect(page.getByRole('option').nth(0)).toBeFocused();
    await page.keyboard.press('ArrowDown'); // move to Banana
    await expect(page.getByRole('option').nth(1)).toBeFocused();
    await page.keyboard.press('Enter'); // select Banana
    // trigger text reflects selected label
    await expect(trigger).toContainText('Banana');
    await expect(page.getByTestId('select-result')).toContainText('banana');
  });

  test('Escape 关闭下拉且焦点返回触发器', async ({ page }) => {
    const trigger = selectTrigger(page);
    await trigger.focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('option').first()).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('option')).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
});
