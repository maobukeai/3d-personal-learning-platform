import { defineConfig, configDefaults } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import Components from 'unplugin-vue-components/vite';
import path from 'path';

export default defineConfig({
  plugins: [vue(), Components({ dirs: ['src/components', 'src/components/ui'] })],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // P9：测试环境关闭直接 AST 路径，保持现有 HTML 路径测试不变
  // 直接 AST 路径（tiptapAst.ts）由其自身的单元测试覆盖
  define: {
    'import.meta.env.VITE_USE_DIRECT_AST': JSON.stringify('false'),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    exclude: [...configDefaults.exclude, 'server/**', 'e2e/**'],
    // 铁律一·2 — 单元与 E2E 自动化双轨制：
    //   全局基线保持稳健（避免因阈值过高导致 CI 失败），
    //   逐文件检查（perFile）防止单个文件拉低整体质量。
    //   核心算法（3D 坐标转换、Markdown 语法树解析）的 100% 覆盖率
    //   由 vitest.core.config.ts 单独强制执行（npm run test:unit:core）。
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 70,
        functions: 65,
        branches: 60,
        perFile: true,
      },
    },
  },
});
