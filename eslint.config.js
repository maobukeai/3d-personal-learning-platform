import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import vuePlugin from 'eslint-plugin-vue';
import vueParser from 'vue-eslint-parser';
import prettierConfig from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';
import globals from 'globals';
import unusedImports from 'eslint-plugin-unused-imports';
import { localRulesPlugin, textParser } from './eslint-rules/index.js';

export default [
  {
    ignores: [
      'dist/**',
      'dist-tsbuildinfo/**',
      '.codex-chrome-*/**',
      '.release-staging/**',
      'node_modules/**',
      'public/**',
      'scratch/**',
      'server/**',
      'e2e/**',
      'playwright.config.ts',
      'ecosystem.config.cjs',
      'commitlint.config.cjs',
      'eslint-rules/**',
      'test-results/**',
      'website/**',
    ],
  },
  js.configs.recommended,
  ...vuePlugin.configs['flat/recommended'],
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tsParser,
        sourceType: 'module',
        extraFileExtensions: ['.vue'],
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      prettier: prettierPlugin,
      'unused-imports': unusedImports,
      'local-rules': localRulesPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...prettierConfig.rules,
      'prettier/prettier': 'warn',
      'vue/multi-word-component-names': 'off',
      // 铁律一·1 AST 级别自动审计 —— 未定义明确 TypeScript 类型的代码直接拒绝提交
      // 策略：全局 warn 基线 + lint:strict（--max-warnings=0）在 CI 阶段强制零警告
      // 历史代码（520 处 any）通过渐进式重构清理，新代码由 lint:strict 门禁拦截
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'warn',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
        },
      ],
      'no-console': ['warn', { allow: ['warn', 'error', 'debug'] }],
      'no-useless-catch': 'off',
      'no-empty': 'off',
      'vue/no-parsing-error': 'off',
      'no-undef': 'warn',
      'no-redeclare': 'off',
      // 铁律一·1 AST 级别自动审计 —— 自定义规则
      'local-rules/no-fictional-api': 'error',
      'local-rules/no-window-global-state': 'error',
      // 计划 §3.3 —— 禁止样式硬编码（初始 warn 基线，不阻断构建；
      // lint:strict --max-warnings=0 在 CI 阶段渐进式收敛）
      'local-rules/no-hardcoded-colors': 'warn',
      'local-rules/no-arbitrary-radius': 'warn',
      'local-rules/no-backdrop-filter': 'warn',
      'local-rules/no-hardcoded-shadow': 'warn',
      'local-rules/no-hardcoded-zindex': 'warn',
    },
  },
  // ── CSS 文件配置 ──
  // 使用 text-parser 产出空 AST，使文本扫描规则可以运行在 .css 文件上。
  // 仅扫描 src/ 下的 .css 文件，避免 lint 生成/测试产物。
  {
    files: ['src/**/*.css'],
    languageOptions: {
      parser: textParser,
    },
    plugins: {
      'local-rules': localRulesPlugin,
    },
    rules: {
      'local-rules/no-hardcoded-colors': 'warn',
      'local-rules/no-arbitrary-radius': 'warn',
      'local-rules/no-backdrop-filter': 'warn',
      'local-rules/no-hardcoded-shadow': 'warn',
      'local-rules/no-hardcoded-zindex': 'warn',
    },
  },
];
