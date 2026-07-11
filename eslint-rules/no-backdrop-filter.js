/**
 * ESLint custom rule: no-backdrop-filter
 * 计划 §3.3 —— 限制 backdrop-filter 的使用范围。
 *
 * backdrop-filter 只允许出现在：
 *   1. src/styles/tokens.css（--glass-blur token 定义处）
 *   2. 标注了 `immersive-surface` 标记注释的组件/文件（沉浸式/3D 表面）
 *
 * 其他位置禁止使用 backdrop-filter / -webkit-backdrop-filter。
 * 例外：`backdrop-filter: none`（显式关闭模糊）在任何位置都允许。
 */

import { collectStyleRegions, isTokenFile, hasImmersiveMarker } from './style-utils.js';

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: '禁止在沉浸式表面/token 文件之外使用 backdrop-filter',
      url: 'https://example.local/eslint-rules/no-backdrop-filter',
    },
    schema: [],
    messages: {
      forbidden:
        'backdrop-filter 仅允许在 tokens.css 或标注 `/* immersive-surface */` 的组件中使用。当前文件不满足豁免条件。',
    },
  },
  create(context) {
    const filename = context.filename;
    const source = context.sourceCode;
    const sourceText = source.text;

    // Token files define the --glass-blur token — always exempt.
    if (isTokenFile(filename)) return {};

    // Files explicitly marked as immersive/3D surfaces are exempt.
    if (hasImmersiveMarker(sourceText)) return {};

    const regions = collectStyleRegions(filename, sourceText);
    if (regions.length === 0) return {};

    // Match both `backdrop-filter` and `-webkit-backdrop-filter` property names.
    const BACKDROP_RE = /(-webkit-)?backdrop-filter\s*:\s*([^;}\n]+)/gi;

    return {
      Program() {
        for (const region of regions) {
          BACKDROP_RE.lastIndex = 0;
          let m;
          while ((m = BACKDROP_RE.exec(region.text)) !== null) {
            const value = m[2].trim();
            // `none` explicitly disables blur — allowed anywhere.
            if (/^none$/i.test(value)) continue;
            // var(--glass-blur) is the token form — but per spec it should
            // still only appear in immersive surfaces, which we already checked
            // via the marker. So any non-none value here is a violation.
            const absIndex = region.startIndex + m.index;
            const loc = source.getLocFromIndex(absIndex);
            context.report({ loc, messageId: 'forbidden' });
          }
        }
      },
    };
  },
};

export default rule;
