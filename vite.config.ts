import { defineConfig, loadEnv, type ProxyOptions } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import fs from 'fs';
import zlib from 'zlib';
import Components from 'unplugin-vue-components/vite';
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers';

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

      console.log('⚡ Generating Gzip and Brotli pre-compressed static assets...');
      const files = await collectFiles(distDir);
      await Promise.all(files.map(compressFile));
      console.log(`✓ Compression complete. Compressed ${files.length} file(s).`);
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_API_URL || 'http://localhost:3001';

  const vendorChunks: Array<[string, string[]]> = [
    ['vue-core', ['vue', '@vue', 'vue-router', 'pinia', 'vue-i18n', '@intlify']],
    ['element-plus', ['element-plus', '@element-plus']],
    ['icons', ['lucide-vue-next', '@element-plus/icons-vue']],
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
    if (normalizedId.includes('/node_modules/three/')) return;

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
      tailwindcss(),
      Components({
        resolvers: [ElementPlusResolver()],
        dts: 'src/components.d.ts',
      }),
      customCompressPlugin(),
    ],
    optimizeDeps: {
      // Pre-bundle deps that are needed on the FIRST page load.
      // three, socket.io-client, qrcode, lucide-vue-next are intentionally
      // excluded: three is too large (~600KB) and its loaders are already
      // dynamically imported; the others are only needed after login or in
      // specific sub-routes, so Vite will discover them on-demand.
      include: [
        'vue',
        'vue-router',
        'pinia',
        'vue-i18n',
        'element-plus',
        'axios',
        'dompurify',
      ],
    },
    server: {
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
      chunkSizeWarningLimit: 800,
      // Split CSS per chunk so lazy-loaded routes only pull in their own styles.
      cssCodeSplit: true,
      // Inject a polyfill for <link rel="modulepreload"> so older Safari versions
      // correctly preload JS modules instead of fetching them on demand.
      modulePreload: { polyfill: true },
      rolldownOptions: {
        output: {
          codeSplitting: {
            includeDependenciesRecursively: false,
            groups: [
              {
                name: 'three-examples',
                priority: 4,
                test(moduleId) {
                  return normalizeModuleId(moduleId).includes('/node_modules/three/examples/');
                },
              },
              {
                name: 'three-core',
                priority: 3,
                test(moduleId) {
                  const normalizedId = normalizeModuleId(moduleId);
                  return (
                    normalizedId.includes('/node_modules/three/') &&
                    !normalizedId.includes('/node_modules/three/examples/')
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
