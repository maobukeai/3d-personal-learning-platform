import { hasInjectionContext, inject } from 'vue';
import { t as tryUseNuxtApp } from './server.mjs';
import { u as useHead$1, h as headSymbol, a as useSeoMeta$1 } from '../routes/renderer.mjs';

function injectHead(nuxtApp) {
  var _a;
  const nuxt = nuxtApp || tryUseNuxtApp();
  return (
    ((_a = nuxt == null ? void 0 : nuxt.ssrContext) == null ? void 0 : _a.head) ||
    (nuxt == null
      ? void 0
      : nuxt.runWithContext(() => {
          if (hasInjectionContext()) {
            return inject(headSymbol);
          }
        }))
  );
}
function useHead(input, options = {}) {
  const head = injectHead(options.nuxt);
  if (head) {
    return useHead$1(input, { head, ...options });
  }
}
function useSeoMeta(input, options = {}) {
  const head = injectHead(options.nuxt);
  if (head) {
    return useSeoMeta$1(input, { head, ...options });
  }
}

export { useHead as a, useSeoMeta as u };
//# sourceMappingURL=v3-EZZOES_4.mjs.map
