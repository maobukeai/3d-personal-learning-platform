import { defineConfig, loadEnv, type ProxyOptions } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import Components from 'unplugin-vue-components/vite';
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers';
import viteCompression from 'vite-plugin-compression';

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
      ['markdown-it', 'linkify-it', 'mdurl', 'uc.micro', 'entities', 'punycode.js', 'xss'],
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
      viteCompression({
        verbose: true,
        disable: false,
        threshold: 10240,
        algorithm: 'gzip',
        ext: '.gz',
      }),
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
    },
  };
});
