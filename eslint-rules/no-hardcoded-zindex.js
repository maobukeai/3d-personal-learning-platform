/**
 * ESLint custom rule: no-hardcoded-zindex
 * 计划 §3.3 —— 禁止 z-index 使用硬编码数字。
 *
 * z-index 必须引用 var(--z-*) token，例如：
 *   var(--z-base) / var(--z-dropdown) / var(--z-sticky)
 *   var(--z-overlay) / var(--z-modal) / var(--z-drawer) / var(--z-toast)
 *
 * 禁止：
 *   - CSS: z-index: 999 / z-index: 50 等字面量数字
 *   - Tailwind: z-50 / z-100 等 z-<number> class
 *   例外：z-index: auto、src/styles/tokens.css。
 */

import { collectStyleRegions, isTokenFile } from './style-utils.js';

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: '禁止 z-index 使用硬编码数字，必须使用 var(--z-*) token',
      url: 'https://example.local/eslint-rules/no-hardcoded-zindex',
    },
    schema: [],
    messages: {
      cssLiteral:
        'z-index: {{value}} 是硬编码数字。请改用 var(--z-base/dropdown/sticky/overlay/modal/drawer/toast) token。',
      tailwindClass:
        'Tailwind class "{{cls}}" 使用硬编码 z-index。请改用内联 style + var(--z-*) token。',
    },
  },
  create(context) {
    const filename = context.filename;
    const source = context.sourceCode;
    const sourceText = source.text;
    const isCss = filename.endsWith('.css');
    const isVue = filename.endsWith('.vue');

    if (isTokenFile(filename)) return {};
    if (!isVue && !isCss) return {};

    // ── CSS z-index scanning (<style> blocks + .css files) ──
    const Z_INDEX_RE = /z-index\s*:\s*([^;}\n]+)/gi;

    function scanZIndex() {
      const regions = collectStyleRegions(filename, sourceText);
      for (const region of regions) {
        Z_INDEX_RE.lastIndex = 0;
        let m;
        while ((m = Z_INDEX_RE.exec(region.text)) !== null) {
          const value = m[1].trim();
          // var(--z-*) references are allowed.
          if (/var\s*\(/i.test(value)) continue;
          // `auto` is allowed.
          if (/^auto$/i.test(value)) continue;
          // If the value contains a bare integer (positive or negative), flag it.
          if (/-?\d+/.test(value)) {
            const absIndex = region.startIndex + m.index;
            const loc = source.getLocFromIndex(absIndex);
            context.report({ loc, messageId: 'cssLiteral', data: { value } });
          }
        }
      }
    }

    // ── Tailwind z-<number> class scanning (only .vue) ──
    // Matches z-50, z-100, z-[999] etc. Does NOT match z-auto or z-index.
    const TAILWIND_Z_RE = /\bz-(\d+)(?![\w-])/g;

    function scanTailwindZ() {
      let m;
      TAILWIND_Z_RE.lastIndex = 0;
      while ((m = TAILWIND_Z_RE.exec(sourceText)) !== null) {
        const loc = source.getLocFromIndex(m.index);
        context.report({ loc, messageId: 'tailwindClass', data: { cls: m[0] } });
      }
    }

    return {
      Program() {
        scanZIndex();
        if (isVue) scanTailwindZ();
      },
    };
  },
};

export default rule;
