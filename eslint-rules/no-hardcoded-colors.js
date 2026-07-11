/**
 * ESLint custom rule: no-hardcoded-colors
 * 计划 §3.3 —— 禁止在样式代码中硬编码颜色值。
 *
 * 触发条件：在 .vue 的 <style> 块或 .css 文件中出现以下硬编码颜色：
 *   - 十六进制颜色：#fff / #ffffff / #F07828 / #FFFFFFFF
 *   - rgb() / rgba() 函数
 *   - hsl() / hsla() 函数
 *
 * 豁免：
 *   - src/styles/tokens.css 与 src/styles/themes.css（token 定义文件）
 *   - var() 引用、color-mix()（包含其内部参数）、transparent、currentColor、inherit
 *
 * 仅扫描 <style> 块与 .css 文件，不扫描 <template>/<script>。
 * 每条违规报告文件、行号与硬编码值。
 */

import {
  collectStyleRegions,
  isTokenFile,
  findColorMixRanges,
  isInsideRanges,
} from './style-utils.js';

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: '禁止硬编码 hex/rgb/hsl 颜色，必须使用 var(--color-*) token',
      url: 'https://example.local/eslint-rules/no-hardcoded-colors',
    },
    schema: [],
    messages: {
      hardcoded:
        '禁止硬编码颜色 "{{value}}"。请使用 tokens.css 中定义的 var(--color-*) / var(--accent) 等 token。',
    },
  },
  create(context) {
    const filename = context.filename;
    if (isTokenFile(filename)) return {};

    const source = context.sourceCode;
    const sourceText = source.text;
    const regions = collectStyleRegions(filename, sourceText);
    if (regions.length === 0) return {};

    // hex colors: #rgb | #rgba | #rrggbb | #rrggbbaa
    const HEX_RE = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/g;
    // rgb()/rgba() — arguments contain no nested parens
    const RGB_RE = /\brgba?\(\s*[^)]*\)/gi;
    // hsl()/hsla()
    const HSL_RE = /\bhsla?\(\s*[^)]*\)/gi;

    function reportMatches(regex, region) {
      // Color-mix() is explicitly allowed per spec, so pre-compute its ranges
      // and skip any hardcoded-color match that falls inside one.
      const colorMixRanges = findColorMixRanges(region.rawText);
      regex.lastIndex = 0;
      let match;
      while ((match = regex.exec(region.text)) !== null) {
        const absIndex = region.startIndex + match.index;
        if (isInsideRanges(match.index, colorMixRanges)) continue;
        const loc = source.getLocFromIndex(absIndex);
        context.report({ loc, messageId: 'hardcoded', data: { value: match[0] } });
      }
    }

    return {
      Program() {
        for (const region of regions) {
          reportMatches(HEX_RE, region);
          reportMatches(RGB_RE, region);
          reportMatches(HSL_RE, region);
        }
      },
    };
  },
};

export default rule;
