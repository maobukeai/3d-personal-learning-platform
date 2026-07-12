const client_precomputed = ((h, j) => ({
  dependencies: {
    '../node_modules/nuxt/dist/app/components/error-500.vue': {
      scripts: {},
      styles: {},
      preload: {
        '../node_modules/nuxt/dist/app/components/error-500.vue': (h = {
          resourceType: 'script',
          module: true,
          prefetch: true,
          preload: true,
          file: 'BKRDrXTh.js',
          name: 'error-500',
          src: '../node_modules/nuxt/dist/app/components/error-500.vue',
          isDynamicEntry: true,
          imports: ['../node_modules/nuxt/dist/app/entry.js'],
          css: [],
        }),
      },
      prefetch: {},
    },
    '../node_modules/nuxt/dist/app/entry.js': {
      scripts: {
        '../node_modules/nuxt/dist/app/entry.js': (j = {
          resourceType: 'script',
          module: true,
          prefetch: true,
          preload: true,
          file: 'DPTfibUZ.js',
          name: 'entry',
          src: '../node_modules/nuxt/dist/app/entry.js',
          isEntry: true,
          dynamicImports: [
            '../node_modules/nuxt/dist/app/components/error-404.vue',
            '../node_modules/nuxt/dist/app/components/error-500.vue',
          ],
          css: [],
        }),
      },
      styles: {},
      preload: { '../node_modules/nuxt/dist/app/entry.js': j },
      prefetch: { '../node_modules/nuxt/dist/app/components/error-500.vue': h },
    },
    '../node_modules/nuxt/dist/app/components/error-404.vue': {
      scripts: {},
      styles: {},
      preload: {
        '../node_modules/nuxt/dist/app/components/error-404.vue': {
          resourceType: 'script',
          module: true,
          prefetch: true,
          preload: true,
          file: 'DL3tvOdn.js',
          name: 'error-404',
          src: '../node_modules/nuxt/dist/app/components/error-404.vue',
          isDynamicEntry: true,
          imports: ['../node_modules/nuxt/dist/app/entry.js'],
          css: [],
        },
        '../node_modules/nuxt/dist/app/entry.js': j,
      },
      prefetch: { '../node_modules/nuxt/dist/app/components/error-500.vue': h },
    },
    'error-404.o50T1Yh0.css': {
      scripts: {},
      styles: {},
      preload: {
        'error-404.o50T1Yh0.css': {
          file: 'error-404.o50T1Yh0.css',
          resourceType: 'style',
          prefetch: true,
          preload: true,
        },
      },
      prefetch: {},
    },
    'error-500.DdcU-NLM.css': {
      scripts: {},
      styles: {},
      preload: {
        'error-500.DdcU-NLM.css': {
          file: 'error-500.DdcU-NLM.css',
          resourceType: 'style',
          prefetch: true,
          preload: true,
        },
      },
      prefetch: {},
    },
    'entry.-4Gn0zhX.css': {
      scripts: {},
      styles: {},
      preload: {
        'entry.-4Gn0zhX.css': {
          file: 'entry.-4Gn0zhX.css',
          resourceType: 'style',
          prefetch: true,
          preload: true,
        },
      },
      prefetch: {},
    },
  },
  entrypoints: ['../node_modules/nuxt/dist/app/entry.js'],
  modules: {
    '../node_modules/nuxt/dist/app/components/error-404.vue': {
      file: 'DL3tvOdn.js',
      resourceType: 'script',
      mimeType: void 0,
      module: true,
    },
    'error-404.o50T1Yh0.css': {
      file: 'error-404.o50T1Yh0.css',
      resourceType: 'style',
      mimeType: void 0,
      module: void 0,
    },
    '../node_modules/nuxt/dist/app/components/error-500.vue': {
      file: 'BKRDrXTh.js',
      resourceType: 'script',
      mimeType: void 0,
      module: true,
    },
    'error-500.DdcU-NLM.css': {
      file: 'error-500.DdcU-NLM.css',
      resourceType: 'style',
      mimeType: void 0,
      module: void 0,
    },
    '../node_modules/nuxt/dist/app/entry.js': {
      file: 'DPTfibUZ.js',
      resourceType: 'script',
      mimeType: void 0,
      module: true,
    },
    'entry.-4Gn0zhX.css': {
      file: 'entry.-4Gn0zhX.css',
      resourceType: 'style',
      mimeType: void 0,
      module: void 0,
    },
  },
}))();

export { client_precomputed as default };
//# sourceMappingURL=client.precomputed.mjs.map
