/** Probe specific elements: dump details for tiny inputs/buttons on a route. */
import { chromium } from '@playwright/test';

const BASE = process.env.BASE || 'http://localhost:5173';
const API = process.env.API || 'http://localhost:3001';
const route = process.argv[2];
const maxH = parseInt(process.argv[3] || '20', 10);

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
await page.waitForTimeout(1200);

const out = await page.evaluate((maxH) => {
  const res = [];
  for (const el of document.querySelectorAll('input, select, textarea')) {
    const r = el.getBoundingClientRect();
    if (r.height > 0 && r.height < maxH) {
      res.push({
        tag: el.tagName,
        type: el.type,
        h: Math.round(r.height),
        w: Math.round(r.width),
        placeholder: el.placeholder || '',
        cls: (el.getAttribute('class') || '').slice(0, 120),
        parentCls: (el.parentElement?.getAttribute('class') || '').slice(0, 100),
      });
    }
  }
  return res;
}, maxH);
console.log(JSON.stringify(out, null, 1));
await browser.close();
