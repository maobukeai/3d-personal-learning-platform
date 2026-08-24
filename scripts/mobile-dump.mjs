/** Dump elements containing given text with their classes, to build selectors. */
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:5173';
const API = 'http://localhost:3001';
const route = process.argv[2];
const text = process.argv[3] || '';

const loginRes = await fetch(`${API}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'mobile-test@example.com', password: 'MobileTest123!' }),
});
const cookies = (loginRes.headers.getSetCookie?.() ?? [])
  .map((c) => {
    const [pair] = c.split(';');
    const eq = pair.indexOf('=');
    return { name: pair.slice(0, eq), value: pair.slice(eq + 1), domain: 'localhost', path: '/' };
  })
  .filter((c) => ['token', 'refreshToken', 'csrfToken'].includes(c.name));

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 375, height: 812 },
  isMobile: true,
  hasTouch: true,
});
await context.addCookies(cookies);
const page = await context.newPage();
await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(1500);

const out = await page.evaluate((text) => {
  const res = [];
  for (const el of document.querySelectorAll('*')) {
    const t = (el.innerText || '').trim();
    if (!t || t.length > 60) continue;
    if (text && !t.includes(text)) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0) continue;
    if (res.length < 200 && el.children.length <= 4) {
      res.push({
        tag: el.tagName.toLowerCase(),
        cls: (typeof el.className === 'string' ? el.className : '').slice(0, 100),
        text: t.slice(0, 40),
      });
    }
  }
  return res;
}, text);
for (const r of out) console.log(`<${r.tag}> "${r.text}" :: ${r.cls}`);
await browser.close();
