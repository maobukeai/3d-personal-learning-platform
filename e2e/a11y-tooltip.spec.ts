import { test, expect } from '@playwright/test';

/**
 * §7.2 — Tooltip 键盘无障碍 E2E
 * 覆盖：aria-describedby、聚焦触发器后 tooltip 出现、失焦消失、Escape 关闭。
 */
const A11Y_PAGE = '/dev/a11y';

const tooltipText = 'Helpful tooltip text';

test.describe('Tooltip 键盘无障碍', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
    );
    await page.goto(A11Y_PAGE);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByTestId('a11y-test-page')).toBeVisible();
  });

  test('触发器有 aria-describedby 指向 tooltip 内容', async ({ page }) => {
    // radix sets aria-describedby on the TooltipTrigger wrapper (a span) when
    // the tooltip is open.
    await page.getByTestId('tooltip-trigger').focus();
    await expect(page.getByText(tooltipText)).toBeVisible();

    const trigger = page.locator('[data-testid="tooltip-section"] [aria-describedby]');
    await expect(trigger).toBeVisible();
    const descId = await trigger.getAttribute('aria-describedby');
    expect(descId).toBeTruthy();
    // the referenced element contains the tooltip text
    await expect(page.locator(`#${descId}`)).toContainText(tooltipText);
  });

  test('聚焦触发器后 tooltip 出现', async ({ page }) => {
    await page.getByTestId('tooltip-trigger').focus();
    await expect(page.getByText(tooltipText)).toBeVisible();
  });

  test('失焦后 tooltip 消失', async ({ page }) => {
    await page.getByTestId('tooltip-trigger').focus();
    await expect(page.getByText(tooltipText)).toBeVisible();
    // Tab away to blur the trigger
    await page.keyboard.press('Tab');
    await expect(page.getByText(tooltipText)).toBeHidden();
  });

  test('Escape 关闭 tooltip', async ({ page }) => {
    await page.getByTestId('tooltip-trigger').focus();
    await expect(page.getByText(tooltipText)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByText(tooltipText)).toBeHidden();
  });

  test('移动端视口下 tooltip 触发器焦点可见', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByTestId('tooltip-trigger').focus();
    const focusVisible = await page.getByTestId('tooltip-trigger').evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return (
        styles.outlineStyle !== 'none' ||
        styles.boxShadow !== 'none' ||
        el.matches(':focus-visible')
      );
    });
    expect(focusVisible, 'tooltip trigger should have a visible focus indicator').toBeTruthy();
  });
});
