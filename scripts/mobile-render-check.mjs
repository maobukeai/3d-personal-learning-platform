/**
 * Render-content check: visits every route at mobile width and verifies the
 * page actually rendered meaningful content (not a blank shell, error page, or
 * unexpected redirect). Complements mobile-audit.mjs (overflow detection).
 *
 * Usage: node scripts/mobile-render-check.mjs [--base http://localhost:5173]
 */
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { resolve as resolvePath, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolvePath(__dirname, '..');

const args = process.argv.slice(2);
const getArg = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};
const BASE = getArg('--base', 'http://localhost:5173');
const API = getArg('--api', 'http://localhost:3001');
const WIDTH = parseInt(getArg('--width', '375'), 10);

const EMAIL = process.env.MOBILE_AUDIT_EMAIL || 'mobile-test@example.com';
const PASSWORD = process.env.MOBILE_AUDIT_PASSWORD || 'MobileTest123!';

const IDS = {
  asset: 'b765c82e-d512-40d4-b038-23eaad3e7b39',
  material: '451cd948-a868-4349-941c-c041b04b1ff3',
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
  ['/login', 'public'],
  ['/register', 'public'],
  ['/forgot-password', 'public'],
  ['/404', 'public'],
  ['/academy', 'public'],
  ['/share/note/26d8a2e1-594e-4368-8816-77274e3aa8c0', 'public'],
  ['/share/asset/36645b96-b475-46e7-86a3-894900354d98', 'public'],
  ['/share/material/e3cf3cb7-c5b6-4a3a-aa60-3bce4ba8348c', 'public'],
  ['/share/plugin/b6b7109d-57f0-453b-84b0-33948efc7bfe', 'public'],
  ['/share/software/86de68ca-088f-4568-a420-6ab170aebadb', 'public'],
  ['/onboarding', 'auth'],
  ['/dashboard', 'auth'],
  ['/resources', 'auth'],
  ['/assets', 'auth'],
  [`/assets/${IDS.asset}`, 'auth'],
  ['/materials', 'auth'],
  [`/materials/${IDS.material}`, 'auth'],
  ['/plugins', 'auth'],
  [`/plugins/${IDS.plugin}`, 'auth'],
  ['/softwares', 'auth'],
  [`/softwares/${IDS.software}`, 'auth'],
  ['/my-works', 'auth'],
  ['/work', 'auth'],
  ['/discussions', 'auth'],
  ['/roadmaps', 'auth'],
  ['/projects', 'auth'],
  [`/project/${IDS.project}`, 'auth'],
  [`/team/${IDS.team}`, 'auth'],
  ['/messages', 'auth'],
  ['/explore-teams', 'auth'],
  ['/showcase', 'auth'],
  ['/settings', 'auth'],
  ['/billing', 'auth'],
  ['/report-bug', 'auth'],
  ['/notes', 'auth'],
  ['/learning/sheet', 'auth'],
  ['/notifications', 'auth'],
  ['/temporary-netdisk', 'auth'],
  ['/tools/email', 'auth'],
  ['/tools/ai-robots', 'auth'],
  ['/tools/google-warming', 'auth'],
  ['/tools/two-factor', 'auth'],
  [`/academy/course/${IDS.course}`, 'auth'],
  [`/academy/player/${IDS.lesson}`, 'auth'],
  [`/mirror/source/${IDS.mirrorSource}`, 'public'],
  [`/mirror/resource/${IDS.mirrorResource}`, 'public'],
  ['/admin/dashboard', 'admin'],
  ['/admin/command-center', 'admin'],
  ['/admin/users', 'admin'],
  ['/admin/feedback', 'admin'],
  ['/admin/roadmaps', 'admin'],
  ['/admin/courses', 'admin'],
  ['/admin/categories', 'admin'],
  ['/admin/teams', 'admin'],
  ['/admin/subscriptions', 'admin'],
  ['/admin/audits', 'admin'],
  ['/admin/contents', 'admin'],
  ['/admin/audit-logs', 'admin'],
  ['/admin/cloudflare-domains', 'admin'],
  ['/admin/settings', 'admin'],
  ['/admin/banners', 'admin'],
  ['/admin/website', 'admin'],
  ['/admin/mirror', 'admin'],
  ['/admin/manual', 'admin'],
];

const loginRes = await fetch(`${API}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
if (!loginRes.ok) {
  console.error('Login failed:', loginRes.status);
  process.exit(1);
}
const cookies = (loginRes.headers.getSetCookie?.() ?? [])
  .map((c) => {
    const [pair] = c.split(';');
    const eq = pair.indexOf('=');
    return { name: pair.slice(0, eq), value: pair.slice(eq + 1), domain: 'localhost', path: '/' };
  })
  .filter((c) => ['token', 'refreshToken', 'csrfToken'].includes(c.name));

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: WIDTH, height: 812 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
await context.addCookies(cookies);
const page = await context.newPage();

const results = [];
for (const [route, kind] of ROUTES) {
  const entry = { route, kind };
  const consoleErrors = [];
  const onErr = (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 120));
  };
  page.on('console', onErr);
  try {
    await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1000);
    entry.finalUrl = page.url().replace(BASE, '') || '/';
    entry.textLen = await page.evaluate(() => (document.body.innerText || '').trim().length);
    entry.elCount = await page.evaluate(() => document.querySelectorAll('*').length);
    entry.hasMain = await page.evaluate(
      () =>
        !!document.querySelector(
          'main, [class*="content-surface"], [class*="enterprise-page"], #app > * > *',
        ),
    );
    // redirected somewhere unexpected?
    const redirected =
      entry.finalUrl !== route &&
      entry.finalUrl !== route + '/' &&
      !entry.finalUrl.startsWith(route);
    entry.redirected = redirected;
    // suspiciously little content
    entry.suspect = entry.textLen < 50;
    entry.consoleErrors = consoleErrors.slice(0, 3);
    const bad =
      (redirected && !(kind === 'auth' && entry.finalUrl === '/login')) ||
      entry.suspect ||
      !entry.hasMain;
    entry.status = bad ? 'CHECK' : 'OK';
    console.log(
      `${bad ? '?' : '✓'} ${route}  text=${entry.textLen} els=${entry.elCount} url=${entry.finalUrl}${redirected ? ' [redirected]' : ''}${entry.suspect ? ' [thin-content]' : ''}`,
    );
  } catch (e) {
    entry.status = 'ERROR';
    entry.error = String(e).slice(0, 150);
    console.log(`! ${route}  ERROR ${entry.error}`);
  }
  page.off('console', onErr);
  results.push(entry);
}

writeFileSync(resolvePath(root, '.mobile-render-check.json'), JSON.stringify(results, null, 2));
await browser.close();
const bad = results.filter((r) => r.status !== 'OK');
console.log(`\n${results.length} routes, ${bad.length} need checking`);
