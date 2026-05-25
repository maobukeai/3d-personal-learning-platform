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
        '/uploads': {
          target: env.VITE_API_URL || 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
    resolve: {
      alias: [
        {
          find: /^three$/,
          replacement: path.resolve(__dirname, './node_modules/three/src/Three.js'),
        },
        {
          find: '@',
          replacement: path.resolve(__dirname, './src'),
        },
      ],
    },
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            includeDependenciesRecursively: false,
            groups: [
              {
                name: 'three-loaders',
                priority: 3,
                test(moduleId) {
                  return normalizeModuleId(moduleId).includes(
                    '/node_modules/three/examples/jsm/loaders/',
                  );
                },
              },
              {
                name: 'three-controls',
                priority: 3,
                test(moduleId) {
                  return normalizeModuleId(moduleId).includes(
                    '/node_modules/three/examples/jsm/controls/',
                  );
                },
              },
              {
                name: 'three-core',
                priority: 2,
                maxSize: 420 * 1024,
                test(moduleId) {
                  return normalizeModuleId(moduleId).includes('/node_modules/three/src/');
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
