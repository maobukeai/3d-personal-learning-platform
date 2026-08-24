/**
 * One-off probe: navigate to a route at mobile width, then for every element
 * poking beyond the viewport print its ancestor overflow chain, to verify the
 * audit's containment rule against ground truth.
 */
import { chromium } from '@playwright/test';

const BASE = process.env.BASE || 'http://localhost:5173';
const API = process.env.API || 'http://localhost:3001';
const EMAIL = process.env.MOBILE_AUDIT_EMAIL || 'mobile-test@example.com';
const PASSWORD = process.env.MOBILE_AUDIT_PASSWORD || 'MobileTest123!';
const route = process.argv[2] || '/learning/sheet';
const needle = process.argv[3] || '';

const loginRes = await fetch(`${API}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
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
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});
await context.addCookies(cookies);
const page = await context.newPage();
await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(1500);

const out = await page.evaluate((needle) => {
  const vw = document.documentElement.clientWidth;
  const lines = [];
  const walk = (el, depth) => {
    if (depth > 60) return;
    for (const child of el.children) walk(child, depth + 1);
  };
  for (const el of document.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right <= vw + 1 && r.left >= -1) continue;
    if (needle) {
      const txt = (el.textContent || '').trim();
      if (
        !txt.includes(needle) &&
        !(typeof el.className === 'string' ? el.className : '').includes(needle)
      )
        continue;
    }
    const chain = [];
    let p = el.parentElement;
    while (p && p !== document.body && chain.length < 8) {
      const ps = getComputedStyle(p);
      chain.push(
        `${p.tagName.toLowerCase()}.${(typeof p.className === 'string' ? p.className : '').split(' ')[0] || ''}[ox=${ps.overflowX},r=${Math.round(p.getBoundingClientRect().right)}]`,
      );
      p = p.parentElement;
    }
    lines.push({
      tag: el.tagName.toLowerCase(),
      cls: (typeof el.className === 'string' ? el.className : '').slice(0, 90),
      left: Math.round(r.left),
      right: Math.round(r.right),
      text: (el.textContent || '').trim().slice(0, 25),
      chain,
    });
    if (lines.length > 12) break;
  }
  return { vw, lines };
}, needle);

console.log(`vw=${out.vw} route=${route}`);
for (const l of out.lines) {
  console.log(`\n<${l.tag}> L${l.left} R${l.right} "${l.text}"`);
  console.log('  cls:', l.cls);
  console.log('  chain:', l.chain.join(' < '));
}
await browser.close();
