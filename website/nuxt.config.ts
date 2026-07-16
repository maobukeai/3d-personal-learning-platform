export default defineNuxtConfig({
  ssr: true,
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      htmlAttrs: { lang: 'zh-CN' },
      meta: [
        { name: 'theme-color', content: '#f6f7fb' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
      ],
    },
  },
  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || '/api',
      appBase: process.env.NUXT_PUBLIC_APP_BASE || 'https://app.example.com',
    },
  },
  nitro: {
    output: {
      dir: process.env.NITRO_OUTPUT_DIR || '.output',
    },
    compressPublicAssets: true,
    routeRules: {
      '/api/**': { proxy: 'http://127.0.0.1:3001/api/**' },
      '/uploads/**': { proxy: 'http://127.0.0.1:3001/uploads/**' },
    },
  },
  compatibilityDate: '2026-07-12',
});
