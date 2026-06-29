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
    closeBundle() {
      const distDir = path.resolve(__dirname, 'dist');
      
      function compressDir(dir: string) {
        if (!fs.existsSync(dir)) return;
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          if (stat.isDirectory()) {
            compressDir(filePath);
          } else if (stat.isFile()) {
            const ext = path.extname(file);
            // Compress JS, CSS, HTML, SVG, and JSON assets larger than 10KB
            if (['.js', '.css', '.html', '.svg', '.json'].includes(ext) && stat.size > 10240) {
              const content = fs.readFileSync(filePath);
              
              // 1. Generate Brotli (.br) with max compression quality (11)
              try {
                const brContent = zlib.brotliCompressSync(content, {
                  params: {
                    [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
                  }
                });
                fs.writeFileSync(filePath + '.br', brContent);
              } catch (err) {
                console.error(`[Compress] Brotli compression failed for ${file}:`, err);
              }

              // 2. Generate Gzip (.gz) with max compression level (9)
              try {
                const gzContent = zlib.gzipSync(content, { level: 9 });
                fs.writeFileSync(filePath + '.gz', gzContent);
              } catch (err) {
                console.error(`[Compress] Gzip compression failed for ${file}:`, err);
              }
            }
          }
        }
      }
      
      console.log('⚡ Generating Gzip and Brotli pre-compressed static assets...');
      compressDir(distDir);
      console.log('✓ Compression complete.');
    }
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
      ['markdown-it', 'linkify-it', 'mdurl', 'uc.micro', 'entities', 'punycode.js', 'xss', 'md-editor-v3'],
    ],
    ['common-libs', ['axios', 'socket.io-client', 'engine.io-client', '@socket.io', 'dompurify']],
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

    return matchedChunk?.[0];
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
      // Pre-bundle heavy deps so the first dev visit doesn't stall on
      // on-demand discovery + esbuild transforms.
      include: [
        'vue',
        'vue-router',
        'pinia',
        'vue-i18n',
        'element-plus',
        'three',
        'md-editor-v3',
        'gsap',
        'axios',
        'socket.io-client',
        'lucide-vue-next',
        'dompurify',
        'vuedraggable',
        'qrcode',
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
      chunkSizeWarningLimit: 500,
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
      rollupOptions: {
        output: {
          manualChunks(id) {
            const normalizedId = id.replace(/\\/g, '/');
            if (normalizedId.includes('/node_modules/')) {
              if (normalizedId.includes('/node_modules/three/examples/')) {
                return 'three-examples';
              }
              if (normalizedId.includes('/node_modules/three/')) {
                return 'three-core';
              }
              const chunkName = getVendorChunkName(id);
              if (chunkName) {
                return chunkName;
              }
              return 'vendor';
            }
          },
        },
      },
    },
  };
});
