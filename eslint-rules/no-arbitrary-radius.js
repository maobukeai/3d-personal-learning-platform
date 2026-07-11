/**
 * ESLint custom rule: no-arbitrary-radius
 * 计划 §3.3 —— 禁止使用不在白名单 [0, 6, 8, 12] 内的圆角值。
 *
 * 扫描目标：
 *   1. .vue 文件中 <template>/<script> 里的 Tailwind 圆角 class：
 *        rounded-2xl / rounded-3xl / rounded-full / rounded-[Npx]
 *   2. .vue <style> 块与 .css 文件中的 border-radius: <value>
 *
 * 允许：
 *   - Tailwind: rounded-sm(6) / rounded-md(8) / rounded-lg(8) / rounded-xl(12)
 *   - var(--radius-*)、var(--radius-control/field/section)
 *   - border-radius: 50%（圆形元素）、0、0px
 *   - rounded-[0px] / rounded-[6px] / rounded-[8px] / rounded-[12px]
 *
 * 禁止：
 *   - rounded-2xl / rounded-3xl / rounded-full
 *   - rounded-[13px] / rounded-[4px] 等不在白名单的任意值
 *   - border-radius: 10px / border-radius: 4px 等不在白名单的像素值
 */

import { collectStyleRegions, isTokenFile } from './style-utils.js';

const ALLOWED_PX = new Set([0, 6, 8, 12]);

/** Convert a CSS length string (e.g. "12px", "0.75rem") to pixel number. Returns null if unknown unit. */
function toPixels(value) {
  const v = value.trim();
  const pxMatch = /^(-?\d+(?:\.\d+)?)px$/i.exec(v);
  if (pxMatch) return Math.round(parseFloat(pxMatch[1]));
  const remMatch = /^(-?\d+(?:\.\d+)?)rem$/i.exec(v);
  if (remMatch) return Math.round(parseFloat(remMatch[1]) * 16);
  if (/^(0|none)$/i.test(v)) return 0;
  return null;
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: '禁止使用不在白名单 [0,6,8,12] 内的圆角值',
      url: 'https://example.local/eslint-rules/no-arbitrary-radius',
    },
    schema: [],
    messages: {
      tailwindNamed:
        'Tailwind 圆角 class "{{cls}}" 不在允许列表内（仅允许 rounded-sm/md/lg/xl）。请改用 token 映射的 class。',
      tailwindFull:
        'rounded-full 仅允许用于明确的圆形元素（配合 aspect-square 或等宽高）。请确认该元素为圆形，否则改用 rounded-lg。',
      tailwindArbitrary:
        '任意圆角值 "{{cls}}"（={{px}}px）不在白名单 [0,6,8,12] 内。请改用 var(--radius-*) token 或 rounded-sm/md/lg/xl。',
      cssArbitrary:
        'border-radius: {{value}}（={{px}}px）不在白名单 [0,6,8,12] 内。请改用 var(--radius-*) token。',
    },
  },
  create(context) {
    const filename = context.filename;
    const source = context.sourceCode;
    const sourceText = source.text;
    const isCss = filename.endsWith('.css');
    const isVue = filename.endsWith('.vue');

    // Token files are exempt (they define the radius scale).
    if (isTokenFile(filename)) return {};

    // ── Tailwind class scanning (only .vue — CSS files don't use Tailwind classes) ──
    // Match rounded-* classes NOT followed by another word char or hyphen (so
    // rounded-2xl-hover or rounded-foo won't partially match).
    const TAILWIND_NAMED = /rounded-(?:2xl|3xl)(?![\w-])/g;
    const TAILWIND_FULL = /rounded-full(?![\w-])/g;
    const TAILWIND_ARBITRARY = /rounded-\[([^\]]+)\]/g;

    function scanTailwindClasses() {
      let m;
      TAILWIND_NAMED.lastIndex = 0;
      while ((m = TAILWIND_NAMED.exec(sourceText)) !== null) {
        const loc = source.getLocFromIndex(m.index);
        context.report({ loc, messageId: 'tailwindNamed', data: { cls: m[0] } });
      }
      TAILWIND_FULL.lastIndex = 0;
      while ((m = TAILWIND_FULL.exec(sourceText)) !== null) {
        const loc = source.getLocFromIndex(m.index);
        context.report({ loc, messageId: 'tailwindFull', data: { cls: m[0] } });
      }
      TAILWIND_ARBITRARY.lastIndex = 0;
      while ((m = TAILWIND_ARBITRARY.exec(sourceText)) !== null) {
        const inner = m[1].trim();
        const px = toPixels(inner);
        // Allow 50% (circular) and allowlist px values.
        if (/50%/.test(inner)) continue;
        if (px !== null && ALLOWED_PX.has(px)) continue;
        const loc = source.getLocFromIndex(m.index);
        context.report({
          loc,
          messageId: 'tailwindArbitrary',
          data: { cls: m[0], px: px === null ? '?' : String(px) },
        });
      }
    }

    // ── CSS border-radius scanning (<style> blocks + .css files) ──
    const BORDER_RADIUS_RE = /border-radius\s*:\s*([^;}\n]+)/gi;

    function scanBorderRadius() {
      const regions = collectStyleRegions(filename, sourceText);
      for (const region of regions) {
        BORDER_RADIUS_RE.lastIndex = 0;
        let m;
        while ((m = BORDER_RADIUS_RE.exec(region.text)) !== null) {
          const rawValue = m[1].trim();
          // var() references are always allowed.
          if (/var\s*\(/i.test(rawValue)) continue;
          // 50% is allowed (circular elements).
          if (/50%/.test(rawValue)) continue;
          // Check every <number>px / <number>rem token in the value.
          const nums = rawValue.match(/-?\d+(?:\.\d+)?(?:px|rem)/gi) || [];
          if (nums.length === 0) continue;
          let hasViolation = false;
          let firstBadPx = '?';
          for (const n of nums) {
            const px = toPixels(n);
            if (px !== null && !ALLOWED_PX.has(px)) {
              hasViolation = true;
              firstBadPx = String(px);
              break;
            }
          }
          if (!hasViolation) continue;
          const absIndex = region.startIndex + m.index;
          const loc = source.getLocFromIndex(absIndex);
          context.report({
            loc,
            messageId: 'cssArbitrary',
            data: { value: rawValue, px: firstBadPx },
          });
        }
      }
    }

    // Only run scanning for .vue / .css files; no-op on .ts/.tsx.
    if (!isVue && !isCss) return {};

    return {
      Program() {
        if (isVue) scanTailwindClasses();
        scanBorderRadius();
      },
    };
  },
};

export default rule;
