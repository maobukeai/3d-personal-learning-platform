import { defineConfig, loadEnv, type ProxyOptions } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import fs from 'fs';
import zlib from 'zlib';
import Components from 'unplugin-vue-components/vite';
import AutoImport from 'unplugin-auto-import/vite';

// Custom high-performance compression plugin using Node.js native zlib.
// Generates both Gzip (.gz) and Brotli (.br) pre-compressed static assets.
function customCompressPlugin() {
  return {
    name: 'custom-compress-plugin',
    apply: 'build' as const,
    async closeBundle() {
      const distDir = path.resolve(__dirname, 'dist');

      const compressFile = async (filePath: string) => {
        const content = await fs.promises.readFile(filePath);
        await Promise.all([
          // 1. Generate Brotli (.br) with max compression quality (11)
          fs.promises
            .writeFile(
              filePath + '.br',
              zlib.brotliCompressSync(content, {
                params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 },
              }),
            )
            .catch((err) =>
              console.error(`[Compress] Brotli failed for ${path.basename(filePath)}:`, err),
            ),
          // 2. Generate Gzip (.gz) with max compression level (9)
          fs.promises
            .writeFile(filePath + '.gz', zlib.gzipSync(content, { level: 9 }))
            .catch((err) =>
              console.error(`[Compress] Gzip failed for ${path.basename(filePath)}:`, err),
            ),
        ]);
      };

      const collectFiles = async (dir: string): Promise<string[]> => {
        if (!fs.existsSync(dir)) return [];
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        const results: string[] = [];
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            results.push(...(await collectFiles(fullPath)));
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name);
            if (['.js', '.css', '.html', '.svg', '.json'].includes(ext)) {
              const stat = await fs.promises.stat(fullPath);
              // Compress JS, CSS, HTML, SVG, and JSON assets larger than 10KB
              if (stat.size > 10240) {
                results.push(fullPath);
              }
            }
          }
        }
        return results;
      };

      console.debug('⚡ Generating Gzip and Brotli pre-compressed static assets...');
      const files = await collectFiles(distDir);
      await Promise.all(files.map(compressFile));
      console.debug(`✓ Compression complete. Compressed ${files.length} file(s).`);
    },
  };
}

// Service Worker version injection plugin.
// At build time, replaces the /* SW_VERSION_INJECT */ marker in dist/sw.js
// with a unique timestamp so each new deploy busts the browser SW cache.
function swVersionPlugin() {
  const version = `${Date.now()}-prod`;
  return {
    name: 'sw-version-inject',
    apply: 'build' as const,
    async closeBundle() {
      const swPath = path.resolve(__dirname, 'dist/sw.js');
      if (!fs.existsSync(swPath)) return;
      const content = await fs.promises.readFile(swPath, 'utf-8');
      // Replace: /* SW_VERSION_INJECT */ 'dev-' + Date.now()
      // With:    '1720000000000-prod'  (unique per build)
      const injected = content.replace(
        /\/\* SW_VERSION_INJECT \*\/ 'dev-' \+ Date\.now\(\)/,
        JSON.stringify(version),
      );
      await fs.promises.writeFile(swPath, injected, 'utf-8');
      console.debug(`✓ SW version injected: ${version}`);
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_API_URL || 'http://localhost:3001';

  const vendorChunks: Array<[string, string[]]> = [
    // P-6.2: Consolidate Vue ecosystem into a single vendor-vue chunk
    ['vendor-vue', ['vue', '@vue', '@intlify', 'vue-router', 'pinia', 'vue-i18n']],
    // P-6.2: UI component libraries in a single vendor-ui chunk
    ['vendor-ui', ['radix-vue', 'lucide-vue-next']],
    // P-6.2: Markdown parsers (md-editor-v3 stack + marked/turndown/katex)
    [
      'markdown-parser',
      [
        'markdown-it',
        'linkify-it',
        'mdurl',
        'uc.micro',
        'entities',
        'punycode.js',
        'xss',
        'md-editor-v3',
        'marked',
        'turndown',
        'katex',
      ],
    ],
    ['codemirror-core', ['@codemirror', 'codemirror']],
    ['lezer-parser', ['@lezer', 'lezer']],
    [
      'common-libs',
      ['axios', 'socket.io-client', 'engine.io-client', '@socket.io', 'dompurify', 'qrcode'],
    ],
    ['motion', ['gsap']],
    ['drag-drop', ['vuedraggable', 'sortablejs']],
  ];

  const normalizeModuleId = (id: string) => id.replace(/\\/g, '/');

  const getVendorChunkName = (id: string): string | undefined => {
    const normalizedId = normalizeModuleId(id);
    if (!normalizedId.includes('/node_modules/')) return;
    // three.js is handled by dedicated codeSplitting groups (below)
    if (normalizedId.includes('/node_modules/three/')) return;
    if (normalizedId.includes('/node_modules/three-mesh-bvh/')) return;

    const matchedChunk = vendorChunks.find(([, deps]) =>
      deps.some((dep) => normalizedId.includes(`/node_modules/${dep}/`)),
    );

    return matchedChunk?.[0] ?? 'vendor-others';
  };

  const createApiProxy = (timeout = 120000): ProxyOptions => ({
    target: apiTarget,
    changeOrigin: true,
    timeout,
    proxyTimeout: timeout,
  });

  const createStreamingProxy = (timeout: number): ProxyOptions => ({
    ...createApiProxy(timeout),
    configure: (proxy) => {
      proxy.on('proxyRes', (proxyRes) => {
        proxyRes.headers['x-accel-buffering'] = 'no';
      });
    },
  });

  return {
    plugins: [
      vue(),
      tailwindcss({
        optimize: false,
      }),
      AutoImport({
        imports: ['vue', 'vue-router', 'pinia'],
        dts: 'src/auto-imports.d.ts',
        eslintrc: { enabled: false },
      }),
      Components({
        dts: 'src/components.d.ts',
      }),
      customCompressPlugin(),
      swVersionPlugin(),
    ],
    optimizeDeps: {
      // Pre-bundle deps that are needed on the FIRST page load.
      // three, socket.io-client, qrcode, lucide-vue-next are intentionally
      // excluded: three is too large (~600KB) and its loaders are already
      // dynamically imported; the others are only needed after login or in
      // specific sub-routes, so Vite will discover them on-demand.
      include: ['vue', 'vue-router', 'pinia', 'vue-i18n', 'axios', 'dompurify'],
    },
    server: {
      // 监听 0.0.0.0 以便宿主/容器/局域网可访问，便于 E2E 视觉验证与团队预览
      host: true,
      proxy: {
        '/api/projects/ai-chat': createStreamingProxy(300000),
        '/api/projects/co-plan-chat': createStreamingProxy(300000),
        '/api/ai/write-assist': createStreamingProxy(300000),
        '/api/admin/mirror/sources': createStreamingProxy(1800000),
        '/api': createApiProxy(),
        '/uploads': {
          target: apiTarget,
          changeOrigin: true,
        },
        '/socket.io': {
          target: apiTarget,
          ws: true,
          changeOrigin: true,
        },
      },
    },
    resolve: {
      alias: [
        {
          find: '@',
          replacement: path.resolve(__dirname, './src'),
        },
      ],
    },
    build: {
      assetsDir: 'static-chunks',
      chunkSizeWarningLimit: 800,
      // Revert CSS minifier to esbuild to prevent LightningCSS from stripping standard backdrop-filter properties.
      cssMinify: 'esbuild',
      // 生成 manifest.json，供 scripts/assert-bundle-size.mjs 读取入口依赖树、
      // 计算每条路由 gzip/brotli 体积并检测 3D/编辑器 chunk 是否泄漏到首屏。
      manifest: 'manifest.json',
      // Split CSS per chunk so lazy-loaded routes only pull in their own styles.
      cssCodeSplit: true,
      // Inject a polyfill for <link rel="modulepreload"> so older Safari versions
      // correctly preload JS modules instead of fetching them on demand.
      modulePreload: { polyfill: true },
      rolldownOptions: {
        output: {
          // Route 3D / editor heavy deps into dedicated chunks so they never
          // leak into the entry or non-related route bundles.
          // Uses rolldown's native codeSplitting.groups API which correctly
          // preserves the static/dynamic import boundary — unlike
          // manualChunks (function form) which can create spurious static
          // import edges between shared vendor chunks and the entry.
          codeSplitting: {
            includeDependenciesRecursively: false,
            groups: [
              {
                name: 'three-examples',
                priority: 6,
                test(moduleId) {
                  return normalizeModuleId(moduleId).includes('/node_modules/three/examples/');
                },
              },
              {
                name: 'three-mesh-bvh',
                priority: 5,
                test(moduleId) {
                  return normalizeModuleId(moduleId).includes('/node_modules/three-mesh-bvh/');
                },
              },
              {
                name: 'three-core',
                priority: 4,
                test(moduleId) {
                  const normalizedId = normalizeModuleId(moduleId);
                  return (
                    normalizedId.includes('/node_modules/three/') &&
                    !normalizedId.includes('/node_modules/three/examples/') &&
                    !normalizedId.includes('/node_modules/three-mesh-bvh/')
                  );
                },
              },
              {
                name(moduleId) {
                  return getVendorChunkName(moduleId) ?? null;
                },
                priority: 1,
                test: /node_modules/,
              },
            ],
          },
        },
      },
    },
  };
});
