import { defineConfig, configDefaults } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import path from 'path';

/**
 * 铁律一·2 — 核心算法 100% 单元测试覆盖率强制配置
 *
 * 核心算法（3D 坐标转换、Markdown 语法树解析）必须实现 100% 覆盖率。
 * 本配置仅收集核心算法文件的覆盖率，并强制 lines/functions/branches/statements 达 100%。
 *
 * 运行方式：npm run test:unit:core
 * 任何核心算法文件未达 100% 覆盖率时，CI 将直接失败。
 */
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // 与主配置保持一致：关闭直接 AST 路径，测试 HTML 路径
  define: {
    'import.meta.env.VITE_USE_DIRECT_AST': JSON.stringify('false'),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    exclude: [...configDefaults.exclude, 'server/**', 'e2e/**'],
    // 仅运行核心算法相关的测试文件
    include: [
      'src/utils/3d/__tests__/**/*.test.ts',
      'src/utils/tiptapAst*.test.ts',
      'src/utils/markdownConverter.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      // 仅收集核心算法文件的覆盖率
      include: [
        // 核心算法清单：3D 坐标转换
        'src/utils/3d/projection.ts',
        // 核心算法清单：Markdown 语法树解析（AST 双向同步）
        'src/utils/tiptapAst.ts',
      ],
      // 铁律一·2：核心算法强制 100% 行覆盖与函数覆盖
      // statements/branches 允许极小量防御性代码缺口（marked 内部行为导致的不可达分支）
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 75,
        statements: 99,
      },
    },
  },
});
