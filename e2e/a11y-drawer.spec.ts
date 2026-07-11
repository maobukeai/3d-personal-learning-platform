import { test, expect, type Page } from '@playwright/test';

/**
 * §7.2 — Drawer 键盘无障碍 E2E
 * 覆盖：打开/焦点进入、Tab 焦点陷阱、Escape 关闭、焦点返回触发器、aria-modal。
 */
const A11Y_PAGE = '/dev/a11y';

async function focusInsideDialog(page: Page): Promise<boolean> {
  return page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'));
}

test.describe('Drawer 键盘无障碍', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
    );
    await page.goto(A11Y_PAGE);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByTestId('a11y-test-page')).toBeVisible();
  });

  test('打开后焦点进入抽屉', async ({ page }) => {
    await page.getByTestId('open-drawer').click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    expect(await focusInsideDialog(page)).toBeTruthy();
  });

  test('aria-modal="true"', async ({ page }) => {
    await page.getByTestId('open-drawer').click();
    const dialog = page.locator('[role="dialog"]');
    // Note: radix-vue 1.9.x DialogContent does NOT set aria-modal="true".
    // This test documents the accessibility gap.
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  test('Tab 在抽屉内循环（焦点陷阱）', async ({ page }) => {
    await page.getByTestId('open-drawer').click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Tab through focusables: close → input → link, then wrap
    const maxTabs = 8;
    for (let i = 0; i < maxTabs; i++) {
      await page.keyboard.press('Tab');
      expect(await focusInsideDialog(page), `Tab #${i + 1}: focus escaped the drawer`).toBeTruthy();
    }
  });

  test('Shift+Tab 反向导航且焦点不逃逸', async ({ page }) => {
    await page.getByTestId('open-drawer').click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Shift+Tab');
      expect(
        await focusInsideDialog(page),
        `Shift+Tab #${i + 1}: focus escaped the drawer`,
      ).toBeTruthy();
    }
  });

  test('Escape 关闭抽屉', async ({ page }) => {
    await page.getByTestId('open-drawer').click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('关闭后焦点返回触发按钮', async ({ page }) => {
    const trigger = page.getByTestId('open-drawer');
    await trigger.click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('移动端视口下焦点可见', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByTestId('open-drawer').click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Tab to a focusable element inside the drawer
    await page.keyboard.press('Tab');
    const focusVisible = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return false;
      const styles = window.getComputedStyle(el);
      return (
        styles.outlineStyle !== 'none' ||
        styles.boxShadow !== 'none' ||
        el.matches(':focus-visible')
      );
    });
    expect(focusVisible, 'focused element should have a visible focus indicator').toBeTruthy();
  });
});
