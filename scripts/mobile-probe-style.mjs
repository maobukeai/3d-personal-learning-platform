/** Probe computed styles of interactive elements matching a text substring. */
import { chromium } from '@playwright/test';

const BASE = process.env.BASE || 'http://localhost:5173';
const API = process.env.API || 'http://localhost:3001';
const route = process.argv[2];
const needle = process.argv[3] || '';

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

const out = await page.evaluate((needle) => {
  const res = [];
  for (const el of document.querySelectorAll('button, [role="button"], a')) {
    const txt = (el.textContent || '').trim();
    if (needle && !txt.includes(needle) && !el.className?.includes?.(needle)) continue;
    const r = el.getBoundingClientRect();
    if (r.height === 0 || r.width === 0) continue;
    const s = getComputedStyle(el);
    let p = el.parentElement;
    const chain = [];
    while (p && chain.length < 4) {
      const ps = getComputedStyle(p);
      chain.push({
        cls: (p.className || '').toString().slice(0, 50),
        transform: ps.transform,
        zoom: ps.zoom,
        display: ps.display,
        width: ps.width,
      });
      p = p.parentElement;
    }
    res.push({
      tag: el.tagName,
      text: txt.slice(0, 12),
      rect: { w: Math.round(r.width), h: Math.round(r.height) },
      minWidth: s.minWidth,
      minHeight: s.minHeight,
      width: s.width,
      height: s.height,
      zoom: s.zoom,
      cls: (el.className || '').toString().slice(0, 60),
      chain,
    });
    if (res.length >= 6) break;
  }
  return res;
}, needle);
console.log(JSON.stringify(out, null, 1));
await browser.close();
