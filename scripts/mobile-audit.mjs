/**
 * Mobile viewport audit (375×812, touch, DPR 3).
 *
 * Logs in via the API, sets the auth cookies, then visits every route and
 * reports elements that poke outside the viewport without being inside an
 * intentional horizontal-scroll container. Also captures screenshots.
 *
 * Usage:
 *   node scripts/mobile-audit.mjs [--base http://localhost:5173] [--out .mobile-audit]
 *   Credentials via MOBILE_AUDIT_EMAIL / MOBILE_AUDIT_PASSWORD (defaults below).
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const args = process.argv.slice(2);
const getArg = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};

const BASE = getArg('--base', 'http://localhost:5173');
const API = getArg('--api', 'http://localhost:3001');
const OUT_DIR = resolve(root, getArg('--out', '.mobile-audit'));
const WIDTH = parseInt(getArg('--width', '375'), 10);
const EMAIL = process.env.MOBILE_AUDIT_EMAIL || 'mobile-test@example.com';
const PASSWORD = process.env.MOBILE_AUDIT_PASSWORD || 'MobileTest123!';

const IDS = {
  asset: 'b765c82e-d512-40d4-b038-23eaad3e7b39',
  material: '451cd948-a868-4349-941d-c041b04b1ff3',
  plugin: '4bfb6f1c-ec9e-440a-ba09-17dbe430fa24',
  software: '9528d25d-d239-4901-945f-ed10f35c0a01',
  project: '147a4365-5007-481a-9522-5962db919539',
  team: '035bbde1-a190-48e7-b742-b5812657b447',
  course: '2a09aa09-3a0b-4826-9fdd-710a612d5acc',
  lesson: '044b8bff-2007-4873-9a41-ebbc4dc83851',
  mirrorSource: '2db85eb1-6d11-487f-9274-5b055095b4cf',
  mirrorResource: '005c68a2-7988-4e2f-90b6-2d710a6e9552',
};

const ROUTES = [
  // public
  '/login',
  '/register',
  '/forgot-password',
  '/404',
  '/academy',
  // public share pages
  '/share/note/26d8a2e1-594e-4368-8816-77274e3aa8c0',
  '/share/asset/36645b96-b475-46e7-86a3-894900354d98',
  '/share/material/e3cf3cb7-c5b6-4a3a-aa60-3bce4ba8348c',
  '/share/plugin/b6b7109d-57f0-453b-84b0-33948efc7bfe',
  '/share/software/86de68ca-088f-4568-a420-6ab170aebadb',
  // onboarding
  '/onboarding',
  // main app
  '/dashboard',
  '/resources',
  '/assets',
  `/assets/${IDS.asset}`,
  '/materials',
  `/materials/${IDS.material}`,
  '/plugins',
  `/plugins/${IDS.plugin}`,
  '/softwares',
  `/softwares/${IDS.software}`,
  '/my-works',
  '/work',
  '/discussions',
  '/roadmaps',
  '/projects',
  `/project/${IDS.project}`,
  `/team/${IDS.team}`,
  '/messages',
  '/explore-teams',
  '/showcase',
  '/settings',
  '/billing',
  '/report-bug',
  '/notes',
  '/learning/sheet',
  '/notifications',
  '/temporary-netdisk',
  '/tools/email',
  '/tools/ai-robots',
  '/tools/google-warming',
  '/tools/two-factor',
  `/academy/course/${IDS.course}`,
  `/academy/player/${IDS.lesson}`,
  `/mirror/source/${IDS.mirrorSource}`,
  `/mirror/resource/${IDS.mirrorResource}`,
  // admin
  '/admin/dashboard',
  '/admin/command-center',
  '/admin/users',
  '/admin/feedback',
  '/admin/roadmaps',
  '/admin/courses',
  '/admin/categories',
  '/admin/teams',
  '/admin/subscriptions',
  '/admin/audits',
  '/admin/contents',
  '/admin/audit-logs',
  '/admin/cloudflare-domains',
  '/admin/settings',
  '/admin/banners',
  '/admin/website',
  '/admin/mirror',
  '/admin/manual',
];

if (existsSync(OUT_DIR)) rmSync(OUT_DIR, { recursive: true });
mkdirSync(OUT_DIR, { recursive: true });

// ---------------------------------------------------------------- login ----
const loginRes = await fetch(`${API}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
if (!loginRes.ok) {
  console.error('Login failed:', loginRes.status, await loginRes.text());
  process.exit(1);
}
const setCookies = loginRes.headers.getSetCookie?.() ?? [];
const cookies = setCookies
  .map((c) => {
    const [pair] = c.split(';');
    const eq = pair.indexOf('=');
    return { name: pair.slice(0, eq), value: pair.slice(eq + 1), domain: 'localhost', path: '/' };
  })
  .filter((c) => c.name === 'token' || c.name === 'refreshToken' || c.name === 'csrfToken');
if (!cookies.some((c) => c.name === 'token')) {
  console.error('No token cookie in login response');
  process.exit(1);
}

// -------------------------------------------------------------- browser ----
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: WIDTH, height: 812 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
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

    // Content-bearing = has visible text or interactive/media descendants;
    // empty stylised divs (gradient blobs, shimmer) are decoration → skip.
    const decorative =
      !(el.innerText || '').trim() &&
      !el.querySelector('button, a, input, select, textarea, img, video, canvas, svg');
    if (decorative) continue;

    // A scrollable ancestor (overflow-x auto/scroll — note: overflow-y scroll
    // containers report overflow-x auto per CSS spec) makes the content
    // reachable by scrolling → acceptable mobile pattern.
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

    // Either clipped by an overflow-hidden ancestor (content cut off,
    // unreachable) or hanging past the page-level overflow-x guard —
    // both mean the element is visually truncated on mobile.
    const cls = (typeof el.className === 'string' ? el.className : '').trim().replace(/\s+/g, ' ');
    const key = el.tagName + '|' + cls;
    if (seen.has(key)) continue;
    seen.add(key);
    offenders.push({
      tag: el.tagName.toLowerCase(),
      cls: cls.slice(0, 140),
      left: Math.round(r.left),
      right: Math.round(r.right),
      width: Math.round(r.width),
      text: (el.textContent || '').trim().slice(0, 40),
    });
    if (offenders.length >= 25) break;
  }
  return {
    vw,
    scrollWidth: document.documentElement.scrollWidth,
    offenders,
  };
};

const results = [];
const errors = [];

for (const route of ROUTES) {
  const name = route === '/' ? 'root' : route.replaceAll('/', '_').replace(/_/g, '-').slice(1);
  const entry = { route };
  try {
    await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 45000 });
    // let vite compile + api data settle
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1200);
    const data = await page.evaluate(auditFn);
    entry.vw = data.vw;
    entry.scrollWidth = data.scrollWidth;
    entry.offenders = data.offenders;
    await page.screenshot({ path: resolve(OUT_DIR, `${name}.png`) });
    const flag = data.offenders.length > 0 || data.scrollWidth > data.vw + 1 ? 'FAIL' : 'PASS';
    entry.status = flag;
    console.log(
      `${flag === 'PASS' ? '✓' : '✗'} ${route}  (scrollW=${data.scrollWidth}/${data.vw}, offenders=${data.offenders.length})`,
    );
  } catch (e) {
    entry.status = 'ERROR';
    entry.error = String(e).slice(0, 200);
    errors.push(entry);
    console.log(`! ${route}  ERROR ${entry.error}`);
  }
  results.push(entry);
}

writeFileSync(resolve(OUT_DIR, 'report.json'), JSON.stringify(results, null, 2));
await browser.close();

const failCount = results.filter((r) => r.status === 'FAIL').length;
const errCount = results.filter((r) => r.status === 'ERROR').length;
console.log(
  `\nDone. ${results.length} routes: ${results.length - failCount - errCount} pass, ${failCount} fail, ${errCount} error`,
);
console.log(`Report: ${resolve(OUT_DIR, 'report.json')}`);
