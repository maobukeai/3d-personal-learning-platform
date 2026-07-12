import { test, expect, type Page } from '@playwright/test';

/**
 * §7.2 — Modal 键盘无障碍 E2E
 * 覆盖：打开/初始焦点、Tab 焦点陷阱、Shift+Tab 反向、Escape 关闭、
 * 关闭后焦点回到触发器、role/aria-modal、aria-labelledby 屏幕阅读器名称、
 * 背景 inert/aria-hidden、standard + fullscreen 尺寸、移动端焦点可见。
 * 额外覆盖：嵌套弹窗、Dropdown/Select 嵌套、过渡动画与主题切换。
 */
const A11Y_PAGE = '/dev/a11y';

async function activeTestId(page: Page): Promise<string | null> {
  return page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? null);
}

async function focusInsideDialog(page: Page): Promise<boolean> {
  return page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'));
}

async function waitTransition(page: Page) {
  // Wait for opening animations to complete and focus trap to activate
  // Use a longer timeout on CI (like 600ms) since virtual machines can be slower
  await page.waitForTimeout(process.env.CI ? 600 : 300);
}

test.describe('Modal 键盘无障碍', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure window has focus
    await page.bringToFront();
    // Mock API to prevent router-guard delays (no backend in dev/test)
    await page.route('**/api/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
    );
    await page.goto(A11Y_PAGE);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByTestId('a11y-test-page')).toBeVisible();
  });

  // ── 打开 + 初始焦点 ──────────────────────────────────────────────
  test('打开后焦点进入模态框（首个可聚焦 body 元素）', async ({ page }) => {
    await page.getByTestId('open-modal-standard').click();
    await waitTransition(page);
    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible();
    // initialFocus='first' → first focusable in body = modal-input
    await expect(page.getByTestId('modal-input')).toBeFocused();
  });

  test('title 焦点策略：initialFocus="title" 焦点落在标题', async ({ page }) => {
    await page.getByTestId('open-modal-title-focus').click();
    await waitTransition(page);
    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible();
    const labelledBy = await dialog.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    await expect(page.locator(`#${labelledBy}`)).toBeFocused();
  });

  // ── role / aria ─────────────────────────────────────────────────
  test('role="dialog" 且 aria-modal="true"', async ({ page }) => {
    await page.getByTestId('open-modal-standard').click();
    await waitTransition(page);
    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toHaveAttribute('role', 'dialog');
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  test('标题有 id 且 aria-labelledby 指向它（屏幕阅读器名称）', async ({ page }) => {
    await page.getByTestId('open-modal-standard').click();
    await waitTransition(page);
    const dialog = page.locator('[role="dialog"]').first();
    const labelledBy = await dialog.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    const titleEl = page.locator(`#${labelledBy}`);
    await expect(titleEl).toBeVisible();
    await expect(titleEl).toHaveText('Standard Modal');
  });

  test('背景被 aria-hidden / inert', async ({ page }) => {
    await page.getByTestId('open-modal-standard').click();
    await waitTransition(page);
    await expect(page.locator('[role="dialog"]').first()).toBeVisible();
    const appState = await page.locator('#app').evaluate((el) => ({
      inert: el.hasAttribute('inert'),
      ariaHidden: el.getAttribute('aria-hidden'),
    }));
    expect(appState.inert || appState.ariaHidden === 'true').toBeTruthy();
  });

  // ── Tab 焦点陷阱 ─────────────────────────────────────────────────
  test('Tab 在模态框内循环（焦点陷阱）', async ({ page }) => {
    await page.getByTestId('open-modal-standard').click();
    await waitTransition(page);
    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId('modal-input')).toBeFocused();

    // DOM tab order: close (1) → input (2) → link (3) → open-nested-modal-btn (4) → select (5) → dropdown (6) → cancel (7) → confirm (8)
    // Initial focus = input (2), Tab forward:
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('modal-link')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.getByTestId('open-nested-modal-btn')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(
      page.getByTestId('modal-select-container').locator('.select-trigger'),
    ).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(
      page.getByTestId('modal-dropdown-container').locator('.dropdown-trigger-btn'),
    ).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.getByTestId('modal-cancel')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.getByTestId('modal-confirm')).toBeFocused();

    // Tab past last (confirm) → wrap to first focusable (close button)
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();

    // Tab past close → back to input
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('modal-input')).toBeFocused();

    // focus never escaped the dialog
    expect(await focusInsideDialog(page)).toBeTruthy();
  });

  test('Shift+Tab 反向循环', async ({ page }) => {
    await page.getByTestId('open-modal-standard').click();
    await waitTransition(page);
    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId('modal-input')).toBeFocused();

    // Shift+Tab from input (2) → close (1)
    await page.keyboard.press('Shift+Tab');
    await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();

    // Shift+Tab from close (1) → wrap to last (confirm, 8)
    await page.keyboard.press('Shift+Tab');
    await expect(page.getByTestId('modal-confirm')).toBeFocused();

    expect(await focusInsideDialog(page)).toBeTruthy();
  });

  // ── Escape + 焦点返回 ───────────────────────────────────────────
  test('Escape 关闭模态框', async ({ page }) => {
    await page.getByTestId('open-modal-standard').click();
    await waitTransition(page);
    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('关闭后焦点返回触发按钮', async ({ page }) => {
    const trigger = page.getByTestId('open-modal-standard');
    await trigger.click();
    await waitTransition(page);
    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  // ── fullscreen 尺寸 ─────────────────────────────────────────────
  test('fullscreen 尺寸：打开 + 焦点进入 + Escape 关闭 + 焦点返回', async ({ page }) => {
    const trigger = page.getByTestId('open-modal-fullscreen');
    await trigger.click();
    await waitTransition(page);
    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible();
    // focus enters modal (first focusable in body)
    expect(await activeTestId(page)).toBe('modal-fullscreen-input');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  // ── 移动端视口下焦点可见 ───────────────────────────────────────────────
  test('移动端视口下焦点可见', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    // Navigate again after changing viewport to ensure page is correctly loaded and stable in Firefox
    await page.goto(A11Y_PAGE);
    await page.waitForLoadState('domcontentloaded');

    await page.getByTestId('open-modal-standard').click();
    await waitTransition(page);
    await expect(page.locator('[role="dialog"]').first()).toBeVisible();
    await expect(page.getByTestId('modal-input')).toBeFocused();

    const focusVisible = await page.getByTestId('modal-input').evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return (
        styles.outlineStyle !== 'none' ||
        styles.boxShadow !== 'none' ||
        el.matches(':focus-visible')
      );
    });
    expect(focusVisible, 'focused element should have a visible focus indicator').toBeTruthy();
  });

  // ── 嵌套 Overlays (Nested Dialogs, Dropdown, Select) ─────────────────
  test('嵌套模态框：焦点转移与焦点返回', async ({ page }) => {
    // 1. 打开 Standard Modal
    await page.getByTestId('open-modal-standard').click();
    await waitTransition(page);
    const standardModal = page.locator('[role="dialog"]').first();
    await expect(standardModal).toBeVisible();
    await expect(page.getByTestId('modal-input')).toBeFocused();

    // 2. 点击打开 Nested Modal
    const nestedTrigger = page.getByTestId('open-nested-modal-btn');
    await nestedTrigger.click();
    await waitTransition(page);

    // 3. 验证 Nested Modal 出现且焦点在其输入框
    const nestedModal = page.locator('[role="dialog"]').nth(1);
    await expect(nestedModal).toBeVisible();
    await expect(page.getByTestId('modal-nested-input')).toBeFocused();

    // 4. 验证 Tab 键在 Nested Modal 中循环
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('modal-nested-close')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(nestedModal.getByRole('button', { name: 'Close', exact: true })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('modal-nested-input')).toBeFocused();

    // 5. 关闭 Nested Modal (Escape)
    await page.keyboard.press('Escape');
    await expect(nestedModal).toBeHidden();

    // 6. 焦点应回到 Standard Modal 内的触发按钮上
    await expect(nestedTrigger).toBeFocused();
  });

  test('模态框内 Dropdown/Select 嵌套与交互', async ({ page }) => {
    await page.getByTestId('open-modal-standard').click();
    await waitTransition(page);
    await expect(page.getByTestId('modal-input')).toBeFocused();

    // 测试 Select 嵌套
    const selectTrigger = page.getByTestId('modal-select-container').locator('.select-trigger');
    await selectTrigger.focus();
    await page.keyboard.press('ArrowDown'); // open, focus Apple
    await expect(page.getByRole('option').nth(0)).toBeFocused();
    await page.keyboard.press('ArrowDown'); // move to Banana
    await page.keyboard.press('Enter'); // select
    const selectContent = page.locator('[role="listbox"]').first();
    await expect(selectContent).toBeHidden();

    // 测试 Dropdown 嵌套
    const ddTrigger = page.getByTestId('modal-dropdown-container').locator('.dropdown-trigger-btn');
    await ddTrigger.click();
    await page.waitForTimeout(100);

    const ddContent = page.locator('[role="menu"]').first();
    await expect(ddContent).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(ddContent).toBeHidden();
  });

  // ── 主题切换与过渡动画验证 ─────────────────────────────────────────
  test('主题切换：在亮/暗主题下模态框仍可交互且样式正确', async ({ page }) => {
    // 切换为亮色主题
    const toggleBtn = page.getByTestId('theme-toggle-btn');
    await toggleBtn.click();
    await expect(toggleBtn).toContainText('Theme: glass-light');

    // 打开 Modal 并验证
    await page.getByTestId('open-modal-standard').click();
    await waitTransition(page);
    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId('modal-input')).toBeFocused();

    // 关闭 Modal
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    // 切换回暗色主题
    await toggleBtn.click();
    await expect(toggleBtn).toContainText('Theme: glass-dark');
  });

  test('过渡动画：模态框打开与关闭动画未阻碍交互', async ({ page }) => {
    const trigger = page.getByTestId('open-modal-standard');
    await trigger.click();
    await waitTransition(page);
    const dialog = page.locator('[role="dialog"]').first();

    // 动画期间或刚结束时，应立即可见且可聚焦
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId('modal-input')).toBeFocused();

    // 关闭时动画流畅，快速关闭后 DOM 状态正常
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });
});
