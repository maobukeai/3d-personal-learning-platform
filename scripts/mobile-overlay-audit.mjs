/**
 * Mobile overlay audit: opens key overlays (drawers, dropdowns, dialogs) at a
 * mobile viewport and re-runs the same overflow detection used by
 * mobile-audit.mjs. Overlays are the layer the page-level audit can't see.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const BASE = 'http://localhost:5173';
const API = 'http://localhost:3001';
const OUT_DIR = resolve(root, '.mobile-audit-overlays');
const WIDTH = parseInt(process.env.WIDTH || '375', 10);

const loginRes = await fetch(`${API}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: process.env.MOBILE_AUDIT_EMAIL || 'mobile-test@example.com',
    password: process.env.MOBILE_AUDIT_PASSWORD || 'MobileTest123!',
  }),
});
const cookies = (loginRes.headers.getSetCookie?.() ?? [])
  .map((c) => {
    const [pair] = c.split(';');
    const eq = pair.indexOf('=');
    return { name: pair.slice(0, eq), value: pair.slice(eq + 1), domain: 'localhost', path: '/' };
  })
  .filter((c) => ['token', 'refreshToken', 'csrfToken'].includes(c.name));

if (existsSync(OUT_DIR)) rmSync(OUT_DIR, { recursive: true });
mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: WIDTH, height: 812 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});
await context.addCookies(cookies);
const page = await context.newPage();

const auditFn = () => {
  const vw = document.documentElement.clientWidth;
  const offenders = [];
  const seen = new Set();
  for (const el of document.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right <= vw + 1 && r.left >= -1) continue;
    const decorative =
      !(el.innerText || '').trim() &&
      !el.querySelector('button, a, input, select, textarea, img, video, canvas, svg');
    if (decorative) continue;
    let p = el.parentElement;
    let scrollReachable = false;
    while (p && p !== document.body && p !== document.documentElement) {
      if (/(auto|scroll)/.test(getComputedStyle(p).overflowX)) {
        scrollReachable = true;
        break;
      }
      p = p.parentElement;
    }
    if (scrollReachable) continue;
    const cls = (typeof el.className === 'string' ? el.className : '').trim().replace(/\s+/g, ' ');
    const key = el.tagName + '|' + cls;
    if (seen.has(key)) continue;
    seen.add(key);
    offenders.push({
      tag: el.tagName.toLowerCase(),
      cls: cls.slice(0, 120),
      left: Math.round(r.left),
      right: Math.round(r.right),
      text: (el.textContent || '').trim().slice(0, 30),
    });
    if (offenders.length >= 15) break;
  }
  return { vw, offenders };
};

const results = [];

async function auditState(name) {
  await page.waitForTimeout(700);
  const data = await page.evaluate(auditFn);
  await page.screenshot({ path: resolve(OUT_DIR, `${name.replace(/[^\w-]/g, '_')}.png`) });
  const status = data.offenders.length ? 'FAIL' : 'PASS';
  results.push({ name, status, ...data });
  console.log(`${status === 'PASS' ? '✓' : '✗'} ${name} (offenders=${data.offenders.length})`);
  for (const o of data.offenders.slice(0, 5)) {
    console.log(
      `    ${o.tag} L${o.left} R${o.right} | ${o.cls.slice(0, 80)} | ${(o.text || '').slice(0, 18)}`,
    );
  }
}

async function tryStep(label, fn) {
  try {
    await fn();
  } catch (e) {
    results.push({ name: label, status: 'ERROR', error: String(e).slice(0, 150) });
    console.log(`! ${label} ERROR ${String(e).slice(0, 120)}`);
  }
}

const goto = async (route) => {
  await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1000);
};

// 1. Mobile sidebar drawer
await tryStep('mobile-sidebar', async () => {
  await goto('/dashboard');
  await page
    .locator('header.topbar button', { has: page.locator('svg') })
    .first()
    .click();
  await auditState('mobile-sidebar open');
  await page.keyboard.press('Escape');
});

// 2. User dropdown menu
await tryStep('user-dropdown', async () => {
  await goto('/dashboard');
  await page.locator('.dropdown-trigger-btn').first().click();
  await auditState('user-dropdown open');
  await page.keyboard.press('Escape');
});

// 3. Notification center popover
await tryStep('notification-center', async () => {
  await goto('/dashboard');
  await page.locator('header.topbar button[title], header.topbar .topbar-icon-btn').nth(1).click();
  await auditState('notification-center open');
  await page.keyboard.press('Escape');
});

// 4. Global search dialog
await tryStep('global-search', async () => {
  await goto('/dashboard');
  await page.locator('header.topbar .topbar-icon-btn').nth(2).click();
  await auditState('global-search open');
  await page.keyboard.press('Escape');
});

// 5. Admin category create modal (CrudDialog-based, representative of admin forms)
await tryStep('admin-category-modal', async () => {
  await goto('/admin/categories');
  const createBtn = page.getByRole('button', { name: /新增|创建|新建|添加/i }).first();
  await createBtn.waitFor({ state: 'visible', timeout: 8000 });
  await createBtn.click();
  await auditState('admin-category modal open');
  await page.keyboard.press('Escape');
});

// 6. Task detail drawer on /work
await tryStep('task-detail-drawer', async () => {
  await goto('/work');
  const card = page.getByText('mobile-audit-test-task').first();
  await card.waitFor({ state: 'visible', timeout: 8000 });
  await card.click();
  await auditState('task-detail drawer open');
  await page.keyboard.press('Escape');
});

// 7. Messages: with conversations, mobile lands directly in the chat window
//    (sidebar auto-hidden). Audit the chat state, then the list via back.
await tryStep('messages-conversation', async () => {
  await goto('/messages');
  const chat = page.locator('[class*="flex-1"][class*="flex-col"]').first();
  await chat.waitFor({ state: 'visible', timeout: 8000 });
  await auditState('messages conversation open');
  const back = page.getByRole('button', { name: /返回|back/i }).first();
  if (await back.isVisible().catch(() => false)) {
    await back.click();
    await auditState('messages list after back');
  }
});

// 8. Showcase detail
await tryStep('showcase-detail', async () => {
  await goto('/showcase');
  const card = page.locator('.showcase-grid > *, section .group').first();
  await card.waitFor({ state: 'visible', timeout: 8000 });
  await card.click();
  await auditState('showcase detail open');
  await page.keyboard.press('Escape');
});

writeFileSync(resolve(OUT_DIR, 'report.json'), JSON.stringify(results, null, 2));
await browser.close();
const fails = results.filter((r) => r.status !== 'PASS').length;
console.log(
  `\nOverlays: ${results.length} tested, ${results.length - fails} pass, ${fails} fail/error`,
);
