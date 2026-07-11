/**
 * 本地自定义 ESLint 规则聚合入口。
 * 通过 flat config 的 plugins 字段内联挂载，无需发布 npm 包。
 */
import noFictionalApi from './no-fictional-api.js';
import noWindowGlobalState from './no-window-global-state.js';
import noHardcodedColors from './no-hardcoded-colors.js';
import noArbitraryRadius from './no-arbitrary-radius.js';
import noBackdropFilter from './no-backdrop-filter.js';
import noHardcodedShadow from './no-hardcoded-shadow.js';
import noHardcodedZindex from './no-hardcoded-zindex.js';
import textParser from './text-parser.js';

/** @type {Record<string, import('eslint').Rule.RuleModule>} */
export const localRules = {
  'no-fictional-api': noFictionalApi,
  'no-window-global-state': noWindowGlobalState,
  'no-hardcoded-colors': noHardcodedColors,
  'no-arbitrary-radius': noArbitraryRadius,
  'no-backdrop-filter': noBackdropFilter,
  'no-hardcoded-shadow': noHardcodedShadow,
  'no-hardcoded-zindex': noHardcodedZindex,
};

export const localRulesPlugin = {
  rules: localRules,
};

export { textParser };
