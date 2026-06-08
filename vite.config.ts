import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import Components from 'unplugin-vue-components/vite';
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  const vendorChunks: Array<[string, string[]]> = [
    ['vue-core', ['vue', '@vue', 'vue-router', 'pinia', 'vue-i18n', '@intlify']],
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
      ],
    ],

    ['realtime', ['socket.io-client', 'engine.io-client', '@socket.io']],
    ['http', ['axios']],
    ['motion', ['gsap']],
    ['drag-drop', ['vuedraggable', 'sortablejs']],
    ['security', ['dompurify']],
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

  return {
    plugins: [
      vue(),
      tailwindcss(),
      Components({
        resolvers: [ElementPlusResolver()],
        dts: 'src/components.d.ts',
      }),
    ],
    server: {
      proxy: {
        // AI chat uses SSE streaming — must bypass Vite's response buffering
        // so chunks reach the browser immediately instead of being collected first.
        '/api/projects/ai-chat': {
          target: env.VITE_API_URL || 'http://localhost:3001',
          changeOrigin: true,
          timeout: 300000,
          proxyTimeout: 300000,
          configure: (proxy) => {
            proxy.on('proxyRes', (proxyRes) => {
              // Disable any internal buffering so SSE chunks flow through immediately
              proxyRes.headers['x-accel-buffering'] = 'no';
            });
          },
        },
        '/api/projects/co-plan-chat': {
          target: env.VITE_API_URL || 'http://localhost:3001',
          changeOrigin: true,
          timeout: 300000,
          proxyTimeout: 300000,
          configure: (proxy) => {
            proxy.on('proxyRes', (proxyRes) => {
              // Disable any internal buffering so SSE chunks flow through immediately
              proxyRes.headers['x-accel-buffering'] = 'no';
            });
          },
        },
        '/api/ai/write-assist': {
          target: env.VITE_API_URL || 'http://localhost:3001',
          changeOrigin: true,
          timeout: 300000,
          proxyTimeout: 300000,
          configure: (proxy) => {
            proxy.on('proxyRes', (proxyRes) => {
              proxyRes.headers['x-accel-buffering'] = 'no';
            });
          },
        },
        // Mirror export can be several GB — give it a very long timeout
        '/api/admin/mirror/sources': {
          target: env.VITE_API_URL || 'http://localhost:3001',
          changeOrigin: true,
          timeout: 1800000,      // 30 minutes
          proxyTimeout: 1800000, // 30 minutes
          configure: (proxy) => {
            proxy.on('proxyRes', (proxyRes) => {
              // Disable buffering so ZIP chunks flow through immediately
              proxyRes.headers['x-accel-buffering'] = 'no';
            });
          },
        },
        '/api': {
          target: env.VITE_API_URL || 'http://localhost:3001',
          changeOrigin: true,
          timeout: 120000,      // 2 minutes for regular API calls
          proxyTimeout: 120000,
        },
        '/uploads': {
          target: env.VITE_API_URL || 'http://localhost:3001',
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
      chunkSizeWarningLimit: 650,
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
