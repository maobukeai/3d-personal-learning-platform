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
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return;

            const normalizedId = id.replace(/\\/g, '/');
            if (normalizedId.includes('/node_modules/three/examples/jsm/loaders/')) {
              return 'three-loaders';
            }
            if (normalizedId.includes('/node_modules/three/examples/jsm/controls/')) {
              return 'three-controls';
            }
            if (normalizedId.includes('/node_modules/three/')) {
              return 'three-core';
            }

            const matchedChunk = vendorChunks.find(([, deps]) =>
              deps.some((dep) => normalizedId.includes(`/node_modules/${dep}/`)),
            );

            return matchedChunk?.[0];
          },
        },
      },
    },
  };
});
