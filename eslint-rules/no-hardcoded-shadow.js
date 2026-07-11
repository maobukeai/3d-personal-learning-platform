/**
 * ESLint custom rule: no-hardcoded-shadow
 * 计划 §3.3 —— 禁止在 box-shadow 中使用硬编码值。
 *
 * box-shadow 必须引用 var(--shadow-*) token，例如：
 *   var(--shadow-card) / var(--shadow-card-hover)
 *   var(--shadow-rest) / var(--shadow-hover) / var(--shadow-overlay)
 *   var(--shadow-3d-glow)
 *
 * 禁止：box-shadow: 0 1px 2px rgba(...) 等任何字面量阴影值。
 * 例外：src/styles/tokens.css（token 定义文件）、box-shadow: none。
 */

import { collectStyleRegions, isTokenFile } from './style-utils.js';

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: '禁止 box-shadow 使用硬编码值，必须使用 var(--shadow-*) token',
      url: 'https://example.local/eslint-rules/no-hardcoded-shadow',
    },
    schema: [],
    messages: {
      hardcoded:
        'box-shadow 使用了硬编码值 "{{value}}"。请改用 var(--shadow-card) / var(--shadow-rest) 等 token。',
    },
  },
  create(context) {
    const filename = context.filename;
    const source = context.sourceCode;
    const sourceText = source.text;

    if (isTokenFile(filename)) return {};

    const regions = collectStyleRegions(filename, sourceText);
    if (regions.length === 0) return {};

    const BOX_SHADOW_RE = /box-shadow\s*:\s*([^;}\n]+)/gi;

    return {
      Program() {
        for (const region of regions) {
          BOX_SHADOW_RE.lastIndex = 0;
          let m;
          while ((m = BOX_SHADOW_RE.exec(region.text)) !== null) {
            const value = m[1].trim();
            // `none` is allowed (disables shadow).
            if (/^none$/i.test(value)) continue;
            // Any var(--shadow-*) reference is allowed (covers all token names).
            if (/var\(\s*--shadow-/i.test(value)) continue;
            const absIndex = region.startIndex + m.index;
            const loc = source.getLocFromIndex(absIndex);
            context.report({ loc, messageId: 'hardcoded', data: { value } });
          }
        }
      },
    };
  },
};

export default rule;
