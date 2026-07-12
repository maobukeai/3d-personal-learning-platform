export default defineNuxtConfig({
  ssr: true,
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      htmlAttrs: { lang: 'zh-CN' },
      meta: [{ name: 'theme-color', content: '#f6f7fb' }],
    },
  },
  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || '/api',
      appBase: process.env.NUXT_PUBLIC_APP_BASE || 'https://app.example.com',
    },
  },
  nitro: {
    compressPublicAssets: true,
    routeRules: {
      '/api/**': { proxy: 'http://127.0.0.1:3001/api/**' },
    },
  },
  compatibilityDate: '2026-07-12',
});
