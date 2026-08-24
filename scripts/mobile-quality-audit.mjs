/**
 * Mobile quality audit: goes beyond overflow detection.
 * Per route at 375px checks:
 *   1. tiny text    — visible text with computed font-size < 10px
 *   2. tiny targets — interactive elements < 28px tall/wide (fail),
 *                     28–43px counted as warning (44px is the ideal)
 *   3. bottom-nav occlusion — interactive elements intersecting the fixed
 *      bottom navigation's rect
 *   4. page-level horizontal scroll
 *
 * Usage: node scripts/mobile-quality-audit.mjs [--width 375]
 */
import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
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
const WIDTH = parseInt(getArg('--width', '375'), 10);
const OUT_DIR = resolve(root, getArg('--out', '.mobile-quality-audit'));

const EMAIL = process.env.MOBILE_AUDIT_EMAIL || 'mobile-test@example.com';
const PASSWORD = process.env.MOBILE_AUDIT_PASSWORD || 'MobileTest123!';

const IDS = {
  asset: 'b765c82e-d512-40d4-b038-23eaad3e7b39',
  material: '451cd948-a868-4349-941c-c041b04b1ff3',
  plugin: '4bfb6f1c-ec9e-440a-ba09-17dbe430fa24',
  software: '9528d25d-d239-4901-945f-ed10f35c0a01',
  project: '147a4365-5007-481a-9522-5962db919539',
  course: '2a09aa09-3a0b-4826-9fdd-710a612d5acc',
  lesson: '044b8bff-2007-4873-9a41-ebbc4dc83851',
  mirrorSource: '2db85eb1-6d11-487f-9274-5b055095b4cf',
  mirrorResource: '005c68a2-7988-4e2f-90b6-2d710a6e9552',
};

const ROUTES = [
  '/login',
  '/register',
  '/forgot-password',
  '/404',
  '/academy',
  '/share/note/26d8a2e1-594e-4368-8816-77274e3aa8c0',
  '/share/asset/36645b96-b475-46e7-86a3-894900354d98',
  '/onboarding',
  '/dashboard',
  '/resources',
  '/assets',
  '/materials',
  `/materials/${IDS.material}`,
  '/plugins',
  `/plugins/${IDS.plugin}`,
  '/softwares',
  '/my-works',
  '/work',
  '/discussions',
  '/roadmaps',
  '/projects',
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
  `/mirror/source/${IDS.mirrorSource}`,
  `/mirror/resource/${IDS.mirrorResource}`,
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

if (existsSync(OUT_DIR)) rmSync(OUT_DIR, { recursive: true });
mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: WIDTH, height: 812 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
await context.addCookies(cookies);
const page = await context.newPage();

const auditFn = () => {
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  const out = {
    vw,
    vh,
    tinyText: [],
    tinyTargets: [],
    smallTargets: 0,
    occluded: [],
    hscroll: document.documentElement.scrollWidth > vw + 1,
  };

  const isVisible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    const s = getComputedStyle(el);
    if (s.visibility === 'hidden' || s.display === 'none' || +s.opacity === 0) return false;
    return true;
  };

  // 1. tiny text: elements with direct text content
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  let node;
  while ((node = walker.nextNode())) {
    const txt = (node.textContent || '').trim();
    if (!txt) continue;
    const el = node.parentElement;
    if (!el || seen.has(el)) continue;
    seen.add(el);
    if (!isVisible(el)) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < 10) {
      const cls = (typeof el.className === 'string' ? el.className : '')
        .trim()
        .replace(/\s+/g, ' ');
      out.tinyText.push({
        fs: Math.round(fs * 10) / 10,
        cls: cls.slice(0, 100),
        text: txt.slice(0, 30),
      });
      if (out.tinyText.length >= 15) break;
    }
  }

  // 2. tap targets
  const inter = document.querySelectorAll(
    'button, a[href], a[role="button"], input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), select, textarea, [role="button"], [role="tab"], [role="switch"], [role="checkbox"]',
  );
  const targetSeen = new Set();
  for (const el of inter) {
    if (targetSeen.has(el)) continue;
    targetSeen.add(el);
    if (!isVisible(el)) continue;
    const r = el.getBoundingClientRect();
    // sr-only/clip 隐藏（如 radix 原生回退 select）：按 1px 盒测量，跳过
    if (r.height < 8 || r.width < 8) continue;
    // checkbox/switch 视觉块：触达由相邻 label / 轨道整体提供
    if (el.getAttribute('role') === 'checkbox' || el.getAttribute('role') === 'switch') continue;
    // markdown 正文内联链接：行内文本链接为标准形态
    if (el.closest(".markdown-body, [class*='markdown'], [class*='prose']")) continue;
    // 密集数据表格（SmartSheet 等）内单元格编辑器：紧凑度为既定设计
    if (el.closest('.mobile-table') && el.tagName !== 'BUTTON') continue;
    // ignore elements effectively hidden via clipping (e.g. inside collapsed drawers)
    const s = getComputedStyle(el);
    if (s.pointerEvents === 'none') continue;
    const h = Math.round(r.height);
    const w = Math.round(r.width);
    if (h < 28 || w < 28) {
      const cls = (typeof el.className === 'string' ? el.className : '')
        .trim()
        .replace(/\s+/g, ' ');
      out.tinyTargets.push({
        h,
        w,
        tag: el.tagName.toLowerCase(),
        cls: cls.slice(0, 100),
        text: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 25),
      });
      if (out.tinyTargets.length >= 15) break;
    } else if (h < 44 || w < 44) {
      out.smallTargets++;
    }
  }

  // 3. bottom nav occlusion: find fixed bottom bar, check interactive overlap
  const navs = [];
  for (const el of document.querySelectorAll(
    'nav, [class*="bottom-nav"], [class*="bottomnav"], [class*="tabbar"], [class*="mobile-nav"]',
  )) {
    const s = getComputedStyle(el);
    if (s.position !== 'fixed') continue;
    const r = el.getBoundingClientRect();
    if (r.height > 10 && r.bottom > vh - 5 && r.top < vh) navs.push({ el, r });
  }
  if (navs.length) {
    for (const el of inter) {
      if (!isVisible(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      // 在可滚动祖先内的元素可滚动到导航上方（主内容区已预留导航高度），
      // 只有真正 fixed 定位的元素才可能被导航持续遮挡
      let p = el.parentElement;
      let scrollReachable = false;
      while (p && p !== document.body && p !== document.documentElement) {
        if (/(auto|scroll)/.test(getComputedStyle(p).overflowY)) {
          scrollReachable = true;
          break;
        }
        p = p.parentElement;
      }
      if (scrollReachable && getComputedStyle(el).position !== 'fixed') continue;
      for (const nav of navs) {
        const overlap = !(
          r.right < nav.r.left ||
          r.left > nav.r.right ||
          r.bottom < nav.r.top ||
          r.top > nav.r.bottom
        );
        if (overlap && !nav.el.contains(el)) {
          const cls = (typeof el.className === 'string' ? el.className : '')
            .trim()
            .replace(/\s+/g, ' ');
          out.occluded.push({
            tag: el.tagName.toLowerCase(),
            cls: cls.slice(0, 100),
            text: (el.textContent || '').trim().slice(0, 25),
          });
          break;
        }
      }
      if (out.occluded.length >= 10) break;
    }
  }
  return out;
};

const results = [];
for (const route of ROUTES) {
  const entry = { route };
  try {
    await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1000);
    const data = await page.evaluate(auditFn);
    Object.assign(entry, data);
    const fail =
      data.tinyText.length > 0 ||
      data.tinyTargets.length > 0 ||
      data.occluded.length > 0 ||
      data.hscroll;
    entry.status = fail ? 'FAIL' : 'PASS';
    console.log(
      `${fail ? '✗' : '✓'} ${route}  tinyText=${data.tinyText.length} tinyTargets=${data.tinyTargets.length} small=${data.smallTargets} occl=${data.occluded.length}${data.hscroll ? ' HSCROLL' : ''}`,
    );
  } catch (e) {
    entry.status = 'ERROR';
    entry.error = String(e).slice(0, 150);
    console.log(`! ${route} ERROR ${entry.error}`);
  }
  results.push(entry);
}

writeFileSync(resolve(OUT_DIR, 'report.json'), JSON.stringify(results, null, 2));
await browser.close();
const fails = results.filter((r) => r.status === 'FAIL');
const errs = results.filter((r) => r.status === 'ERROR');
console.log(
  `\n${results.length} routes: ${results.length - fails.length - errs.length} pass, ${fails.length} fail, ${errs.length} error`,
);
console.log(`Report: ${resolve(OUT_DIR, 'report.json')}`);
