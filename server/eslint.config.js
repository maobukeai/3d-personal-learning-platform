const js = require('@eslint/js');
const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const prettierConfig = require('eslint-config-prettier');
const prettierPlugin = require('eslint-plugin-prettier');
const globals = require('globals');

// 铁律一·1 AST 级别自动审计 —— 后端复用前端 eslint-rules 自定义规则。
// server 是 CommonJS 包，而 eslint-rules/index.js 是 ESM，使用动态 import 桥接。
// ESLint flat config 原生支持返回 Promise<FlatConfig[]>。
module.exports = (async () => {
  const { localRulesPlugin } = await import('../eslint-rules/index.js');

  return [
    {
      ignores: ['dist/**', 'node_modules/**'],
    },
    js.configs.recommended,
    {
      files: ['**/*.ts'],
      languageOptions: {
        parser: tsParser,
        sourceType: 'module',
        globals: {
          ...globals.node,
          ...globals.jest,
          ...globals.es2021,
        },
      },
      plugins: {
        '@typescript-eslint': tsPlugin,
        prettier: prettierPlugin,
        'local-rules': localRulesPlugin,
      },
      rules: {
        ...tsPlugin.configs.recommended.rules,
        ...prettierConfig.rules,
        'prettier/prettier': 'error',
        // 铁律一·1 AST 级别自动审计 —— 未定义明确 TypeScript 类型的代码直接拒绝提交
        // 策略：全局 warn 基线 + CI lint:strict（--max-warnings=0）强制零警告
        // 历史代码（210 处 any）通过渐进式重构清理，新代码由 CI 门禁拦截
        '@typescript-eslint/no-explicit-any': 'warn',
        '@typescript-eslint/no-unused-vars': [
          'warn',
          { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
        ],
        'no-console': ['warn', { allow: ['warn', 'error'] }],
        'no-useless-catch': 'off',
        'no-undef': 'off',
        'no-redeclare': 'off',
        'no-empty': 'warn',
        'no-case-declarations': 'warn',
        'no-useless-escape': 'off',
        '@typescript-eslint/no-require-imports': 'off',
        'preserve-caught-error': 'off',
        // 铁律一·1 AST 级别自动审计 —— 后端同样禁止虚构 API 与 window 全局状态
        'local-rules/no-fictional-api': 'error',
        'local-rules/no-window-global-state': 'error',
      },
    },
  ];
})();
