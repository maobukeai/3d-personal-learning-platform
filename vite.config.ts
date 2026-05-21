import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [vue(), tailwindcss()],
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
          if (id.includes('node_modules')) {
            if (id.includes('three')) {
              return 'three';
            }
            const elementPlusDeps = [
              'element-plus',
              '@vueuse',
              'lodash',
              'dayjs',
              'async-validator',
              '@ctrl/tinycolor',
              '@floating-ui',
              '@popperjs',
              'escape-html',
              'normalize-wheel-es'
            ];
            const matchedDep = elementPlusDeps.find(dep => id.includes(dep));
            if (matchedDep) {
              return 'element-plus';
            }
            if (id.includes('md-editor-v3')) {
              return 'md-editor';
            }
            if (id.includes('gsap')) {
              return 'gsap';
            }
            return 'vendor';
          }
        },
      },
    },
  },
};
});
