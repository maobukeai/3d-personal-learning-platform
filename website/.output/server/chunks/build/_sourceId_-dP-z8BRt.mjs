import {
  c as useRoute,
  u as usePlatformApi,
  a as useAsyncData,
  _ as __nuxt_component_0,
} from './server.mjs';
import {
  defineComponent,
  computed,
  ref,
  withAsyncContext,
  withCtx,
  createTextVNode,
  unref,
  useSSRContext,
} from 'vue';
import {
  ssrRenderComponent,
  ssrInterpolate,
  ssrRenderAttr,
  ssrRenderClass,
  ssrRenderList,
  ssrIncludeBooleanAttr,
  ssrRenderTeleport,
} from 'vue/server-renderer';
import { u as useSeoMeta } from './v3-EZZOES_4.mjs';
import { _ as _export_sfc } from './_plugin-vue_export-helper-1tPrXgE0.mjs';
import '../_/nitro.mjs';
import 'node:http';
import 'node:https';
import 'node:events';
import 'node:buffer';
import 'node:fs';
import 'node:path';
import 'node:crypto';
import 'node:url';
import '../routes/renderer.mjs';
import 'vue-bundle-renderer/runtime';
import 'unhead/server';
import 'devalue';
import 'unhead/plugins';
import 'unhead/utils';
import 'vue-router';

const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: '[sourceId]',
  __ssrInlineRender: true,
  async setup(__props) {
    let __temp, __restore;
    const route = useRoute();
    const platform = usePlatformApi();
    const sourceId = computed(() => String(route.params.sourceId));
    const categoryId = ref();
    const query = ref('');
    const page = ref(1);
    const selected = ref(null);
    const detailLoading = ref(false);
    const { data: mirror } =
      (([__temp, __restore] = withAsyncContext(() =>
        useAsyncData(
          () => `mirror-${sourceId.value}`,
          () => platform.getMirror(sourceId.value),
          '$_z-4_FAYtX',
          /* nuxt-injected */
        ),
      )),
      (__temp = await __temp),
      __restore(),
      __temp);
    const { data: categories } =
      (([__temp, __restore] = withAsyncContext(() =>
        useAsyncData(
          () => `mirror-categories-${sourceId.value}`,
          () => platform.getMirrorCategories(sourceId.value),
          '$cJjUkpCTuj',
          /* nuxt-injected */
        ),
      )),
      (__temp = await __temp),
      __restore(),
      __temp);
    const { data: result, refresh } =
      (([__temp, __restore] = withAsyncContext(() =>
        useAsyncData(
          () =>
            `mirror-resources-${sourceId.value}-${categoryId.value || 'all'}-${page.value}-${query.value}`,
          () =>
            platform.getMirrorResources(sourceId.value, {
              page: page.value,
              pageSize: 20,
              categoryId: categoryId.value,
              q: query.value,
            }),
          '$jP_utUnMxN',
          /* nuxt-injected */
        ),
      )),
      (__temp = await __temp),
      __restore(),
      __temp);
    const tags = computed(() => {
      var _a;
      try {
        return JSON.parse(((_a = selected.value) == null ? void 0 : _a.tags) || '[]');
      } catch {
        return [];
      }
    });
    useSeoMeta({
      title: () => {
        var _a;
        return `${((_a = mirror.value) == null ? void 0 : _a.displayName) || '\u955C\u50CF\u7AD9'} \u2014 3D Personal Learning Platform`;
      },
    });
    return (_ctx, _push, _parent, _attrs) => {
      var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
      const _component_NuxtLink = __nuxt_component_0;
      _push(`<!--[--><section class="mirror-hero section-wrap" data-v-6e1dbf4a>`);
      _push(
        ssrRenderComponent(
          _component_NuxtLink,
          {
            class: 'back-link',
            to: '/mirrors',
          },
          {
            default: withCtx((_, _push2, _parent2, _scopeId) => {
              if (_push2) {
                _push2(`\u2190 \u8FD4\u56DE\u955C\u50CF\u7AD9`);
              } else {
                return [createTextVNode('\u2190 \u8FD4\u56DE\u955C\u50CF\u7AD9')];
              }
            }),
            _: 1,
          },
          _parent,
        ),
      );
      _push(
        `<p class="eyebrow" data-v-6e1dbf4a>PUBLIC RESOURCE ARCHIVE</p><h1 data-v-6e1dbf4a>${ssrInterpolate((_a = unref(mirror)) == null ? void 0 : _a.displayName)}</h1><p data-v-6e1dbf4a>${ssrInterpolate(((_b = unref(mirror)) == null ? void 0 : _b.description) || '\u53EF\u516C\u5F00\u6D4F\u89C8\u7684\u8D44\u6E90\u5F52\u6863\u3002\u8D44\u6E90\u4EC5\u4F9B\u9884\u89C8\u4E0E\u4E86\u89E3\uFF0C\u4E0D\u63D0\u4F9B\u94FE\u63A5\u63D0\u53D6\u3002')}</p></section><section class="mirror-browser section-wrap" data-v-6e1dbf4a><header class="browser-header" data-v-6e1dbf4a><div data-v-6e1dbf4a><strong data-v-6e1dbf4a>${ssrInterpolate((_f = (_e = (_c = unref(result)) == null ? void 0 : _c.total) != null ? _e : (_d = unref(mirror)) == null ? void 0 : _d.totalResources) != null ? _f : 0)}</strong><span data-v-6e1dbf4a> \u9879\u5DF2\u5F52\u6863\u5185\u5BB9</span></div><form class="resource-search" data-v-6e1dbf4a><input${ssrRenderAttr('value', unref(query))} placeholder="\u641C\u7D22\u8D44\u6E90" data-v-6e1dbf4a><button type="submit" data-v-6e1dbf4a>\u641C\u7D22</button></form></header><div class="category-rail" data-v-6e1dbf4a><button class="${ssrRenderClass({ active: !unref(categoryId) })}" data-v-6e1dbf4a>\u5168\u90E8 <small data-v-6e1dbf4a>${ssrInterpolate(((_g = unref(mirror)) == null ? void 0 : _g.totalResources) || 0)}</small></button><!--[-->`,
      );
      ssrRenderList(unref(categories), (category) => {
        _push(
          `<button class="${ssrRenderClass({ active: unref(categoryId) === category.id })}" data-v-6e1dbf4a>${ssrInterpolate(category.name)} <small data-v-6e1dbf4a>${ssrInterpolate(category.resourceCount)}</small></button>`,
        );
      });
      _push(`<!--]--></div><div class="resource-grid" data-v-6e1dbf4a><!--[-->`);
      ssrRenderList((_h = unref(result)) == null ? void 0 : _h.resources, (resource) => {
        var _a2;
        _push(`<button class="resource-card" data-v-6e1dbf4a>`);
        if (resource.thumbnailUrl) {
          _push(
            `<img${ssrRenderAttr('src', resource.thumbnailUrl)}${ssrRenderAttr('alt', resource.title)} data-v-6e1dbf4a>`,
          );
        } else {
          _push(`<div class="resource-placeholder" data-v-6e1dbf4a>\u2726</div>`);
        }
        _push(
          `<p data-v-6e1dbf4a>${ssrInterpolate(((_a2 = resource.category) == null ? void 0 : _a2.name) || resource.resourceType || 'RESOURCE')}</p><h2 data-v-6e1dbf4a>${ssrInterpolate(resource.title)}</h2><span data-v-6e1dbf4a>${ssrInterpolate(resource.description || '\u70B9\u51FB\u67E5\u770B\u8D44\u6E90\u4ECB\u7ECD\u4E0E\u9884\u89C8\u3002')}</span></button>`,
        );
      });
      _push(`<!--]--></div>`);
      if (
        !((_j = (_i = unref(result)) == null ? void 0 : _i.resources) == null ? void 0 : _j.length)
      ) {
        _push(
          `<p class="empty-copy" data-v-6e1dbf4a>\u6CA1\u6709\u7B26\u5408\u6761\u4EF6\u7684\u8D44\u6E90\u3002</p>`,
        );
      } else {
        _push(`<!---->`);
      }
      if (unref(result) && unref(result).totalPages > 1) {
        _push(
          `<div class="pagination" data-v-6e1dbf4a><button${ssrIncludeBooleanAttr(unref(page) <= 1) ? ' disabled' : ''} data-v-6e1dbf4a>\u4E0A\u4E00\u9875</button><span data-v-6e1dbf4a>${ssrInterpolate(unref(page))} / ${ssrInterpolate(unref(result).totalPages)}</span><button${ssrIncludeBooleanAttr(unref(page) >= unref(result).totalPages) ? ' disabled' : ''} data-v-6e1dbf4a>\u4E0B\u4E00\u9875</button></div>`,
        );
      } else {
        _push(`<!---->`);
      }
      _push(`</section>`);
      ssrRenderTeleport(
        _push,
        (_push2) => {
          var _a2, _b2;
          if (unref(selected)) {
            _push2(
              `<div class="modal-backdrop" data-v-6e1dbf4a><article class="detail-modal" data-v-6e1dbf4a><button class="close" aria-label="\u5173\u95ED\u8BE6\u60C5" data-v-6e1dbf4a>\xD7</button><div class="modal-cover" data-v-6e1dbf4a>`,
            );
            if (unref(selected).thumbnailUrl) {
              _push2(
                `<img${ssrRenderAttr('src', unref(selected).thumbnailUrl)}${ssrRenderAttr('alt', unref(selected).title)} data-v-6e1dbf4a>`,
              );
            } else {
              _push2(`<span data-v-6e1dbf4a>\u2726</span>`);
            }
            _push2(
              `</div><div class="modal-body" data-v-6e1dbf4a><p class="eyebrow" data-v-6e1dbf4a>${ssrInterpolate(((_a2 = unref(selected).category) == null ? void 0 : _a2.name) || unref(selected).resourceType || 'RESOURCE')}</p><h2 data-v-6e1dbf4a>${ssrInterpolate(unref(selected).title)}</h2><p class="description" data-v-6e1dbf4a>${ssrInterpolate(unref(selected).description || '\u6682\u65E0\u8D44\u6E90\u7B80\u4ECB\u3002')}</p>`,
            );
            if (unref(tags).length) {
              _push2(`<div class="tags" data-v-6e1dbf4a><!--[-->`);
              ssrRenderList(unref(tags), (tag) => {
                _push2(`<span data-v-6e1dbf4a>${ssrInterpolate(tag)}</span>`);
              });
              _push2(`<!--]--></div>`);
            } else {
              _push2(`<!---->`);
            }
            _push2(
              `<p class="browse-only" data-v-6e1dbf4a>\u516C\u5F00\u8BE6\u60C5\u4EC5\u63D0\u4F9B\u4ECB\u7ECD\u4E0E\u9884\u89C8\uFF0C\u4E0D\u5305\u542B\u8D44\u6E90\u94FE\u63A5\u6216\u63D0\u53D6\u529F\u80FD\u3002</p>`,
            );
            if (unref(detailLoading)) {
              _push2(
                `<p class="loading" data-v-6e1dbf4a>\u6B63\u5728\u52A0\u8F7D\u8BE6\u60C5\u2026</p>`,
              );
            } else if (unref(selected).contentHtml) {
              _push2(
                `<div class="article-content" data-v-6e1dbf4a>${(_b2 = unref(selected).contentHtml) != null ? _b2 : ''}</div>`,
              );
            } else {
              _push2(`<!---->`);
            }
            _push2(`</div></article></div>`);
          } else {
            _push2(`<!---->`);
          }
        },
        'body',
        false,
        _parent,
      );
      _push(`<!--]-->`);
    };
  },
});
const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add(
    'pages/mirrors/[sourceId].vue',
  );
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const _sourceId_ = /* @__PURE__ */ _export_sfc(_sfc_main, [['__scopeId', 'data-v-6e1dbf4a']]);

export { _sourceId_ as default };
//# sourceMappingURL=_sourceId_-dP-z8BRt.mjs.map
