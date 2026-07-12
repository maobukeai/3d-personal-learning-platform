import {
  defineComponent,
  withAsyncContext,
  computed,
  ref,
  watch,
  unref,
  mergeProps,
  useSSRContext,
} from 'vue';
import {
  ssrRenderAttrs,
  ssrInterpolate,
  ssrRenderAttr,
  ssrRenderClass,
  ssrRenderList,
  ssrIncludeBooleanAttr,
  ssrRenderTeleport,
} from 'vue/server-renderer';
import {
  _ as _export_sfc,
  b as usePlatformApi,
  c as useAsyncData,
  d as useSeoMeta,
} from './server.mjs';
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
  __name: 'index',
  __ssrInlineRender: true,
  async setup(__props) {
    let __temp, __restore;
    const platform = usePlatformApi();
    const { data: homeSettings } =
      (([__temp, __restore] = withAsyncContext(() =>
        useAsyncData('website-home', () => platform.getHome()),
      )),
      (__temp = await __temp),
      __restore(),
      __temp);
    const { data: allMirrors } =
      (([__temp, __restore] = withAsyncContext(() =>
        useAsyncData('all-mirrors', () => platform.getMirrors()),
      )),
      (__temp = await __temp),
      __restore(),
      __temp);
    const sourceId = computed(() => {
      var _a;
      const configured = (_a = homeSettings.value) == null ? void 0 : _a.featuredMirrorId;
      if (configured && typeof configured === 'string') {
        return configured;
      }
      const list = allMirrors.value;
      return Array.isArray(list) && list.length > 0 ? list[0].id : '';
    });
    const categoryId = ref();
    const query = ref('');
    const page = ref(1);
    const selected = ref(null);
    const detailLoading = ref(false);
    const { data: mirror } =
      (([__temp, __restore] = withAsyncContext(() =>
        useAsyncData(
          () => `mirror-${sourceId.value}`,
          () => (sourceId.value ? platform.getMirror(sourceId.value) : Promise.resolve(null)),
          { watch: [sourceId] },
        ),
      )),
      (__temp = await __temp),
      __restore(),
      __temp);
    const { data: categories } =
      (([__temp, __restore] = withAsyncContext(() =>
        useAsyncData(
          () => `mirror-categories-${sourceId.value}`,
          () =>
            sourceId.value ? platform.getMirrorCategories(sourceId.value) : Promise.resolve([]),
          { watch: [sourceId] },
        ),
      )),
      (__temp = await __temp),
      __restore(),
      __temp);
    const { data: result, refresh } =
      (([__temp, __restore] = withAsyncContext(() =>
        useAsyncData(
          () => `mirror-resources-${sourceId.value}`,
          () =>
            sourceId.value
              ? platform.getMirrorResources(sourceId.value, {
                  page: page.value,
                  pageSize: 20,
                  categoryId: categoryId.value,
                  q: query.value,
                })
              : Promise.resolve(null),
          { watch: [sourceId, categoryId, page] },
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
    watch(sourceId, () => {
      categoryId.value = void 0;
      page.value = 1;
    });
    useSeoMeta({
      title: () => {
        var _a;
        return `${((_a = mirror.value) == null ? void 0 : _a.displayName) || '\u955C\u50CF\u7AD9'} \u2014 3D Personal Learning Platform`;
      },
    });
    return (_ctx, _push, _parent, _attrs) => {
      var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
      if (unref(sourceId)) {
        _push(
          `<div${ssrRenderAttrs(_attrs)} data-v-fb6ccbf5><section class="mirror-hero section-wrap" data-v-fb6ccbf5><p class="eyebrow" data-v-fb6ccbf5>PUBLIC RESOURCE ARCHIVE</p><h1 data-v-fb6ccbf5>${ssrInterpolate((_a = unref(mirror)) == null ? void 0 : _a.displayName)}</h1><p data-v-fb6ccbf5>${ssrInterpolate(((_b = unref(mirror)) == null ? void 0 : _b.description) || '\u53EF\u516C\u5F00\u6D4F\u89C8\u7684\u8D44\u6E90\u5F52\u6863\u3002\u8D44\u6E90\u4EC5\u4F9B\u9884\u89C8\u4E0E\u4E86\u89E3\uFF0C\u4E0D\u63D0\u4F9B\u94FE\u63A5\u63D0\u53D6\u3002')}</p></section><section class="mirror-browser section-wrap" data-v-fb6ccbf5><header class="browser-header" data-v-fb6ccbf5><div data-v-fb6ccbf5><strong data-v-fb6ccbf5>${ssrInterpolate((_f = (_e = (_c = unref(result)) == null ? void 0 : _c.total) != null ? _e : (_d = unref(mirror)) == null ? void 0 : _d.totalResources) != null ? _f : 0)}</strong><span data-v-fb6ccbf5> \u9879\u5DF2\u5F52\u6863\u5185\u5BB9</span></div><form class="resource-search" data-v-fb6ccbf5><input${ssrRenderAttr('value', unref(query))} placeholder="\u641C\u7D22\u8D44\u6E90" data-v-fb6ccbf5><button type="submit" data-v-fb6ccbf5>\u641C\u7D22</button></form></header><div class="category-rail" data-v-fb6ccbf5><button class="${ssrRenderClass({ active: !unref(categoryId) })}" data-v-fb6ccbf5> \u5168\u90E8 <small data-v-fb6ccbf5>${ssrInterpolate(((_g = unref(mirror)) == null ? void 0 : _g.totalResources) || 0)}</small></button><!--[-->`,
        );
        ssrRenderList(unref(categories), (category) => {
          _push(
            `<button class="${ssrRenderClass({ active: unref(categoryId) === category.id })}" data-v-fb6ccbf5>${ssrInterpolate(category.name)} <small data-v-fb6ccbf5>${ssrInterpolate(category.resourceCount)}</small></button>`,
          );
        });
        _push(`<!--]--></div><div class="resource-grid" data-v-fb6ccbf5><!--[-->`);
        ssrRenderList((_h = unref(result)) == null ? void 0 : _h.resources, (resource) => {
          var _a2;
          _push(`<button class="resource-card" data-v-fb6ccbf5>`);
          if (resource.thumbnailUrl) {
            _push(
              `<img${ssrRenderAttr('src', resource.thumbnailUrl)}${ssrRenderAttr('alt', resource.title)} data-v-fb6ccbf5>`,
            );
          } else {
            _push(`<div class="resource-placeholder" data-v-fb6ccbf5>\u2726</div>`);
          }
          _push(
            `<p data-v-fb6ccbf5>${ssrInterpolate(((_a2 = resource.category) == null ? void 0 : _a2.name) || resource.resourceType || 'RESOURCE')}</p><h2 data-v-fb6ccbf5>${ssrInterpolate(resource.title)}</h2><span data-v-fb6ccbf5>${ssrInterpolate(resource.description || '\u70B9\u51FB\u67E5\u770B\u8D44\u6E90\u4ECB\u7ECD\u4E0E\u9884\u89C8\u3002')}</span></button>`,
          );
        });
        _push(`<!--]--></div>`);
        if (
          !((_j = (_i = unref(result)) == null ? void 0 : _i.resources) == null
            ? void 0
            : _j.length)
        ) {
          _push(
            `<p class="empty-copy" data-v-fb6ccbf5>\u6CA1\u6709\u7B26\u5408\u6761\u4EF6\u7684\u8D44\u6E90\u3002</p>`,
          );
        } else {
          _push(`<!---->`);
        }
        if (unref(result) && unref(result).totalPages > 1) {
          _push(
            `<div class="pagination" data-v-fb6ccbf5><button${ssrIncludeBooleanAttr(unref(page) <= 1) ? ' disabled' : ''} data-v-fb6ccbf5>\u4E0A\u4E00\u9875</button><span data-v-fb6ccbf5>${ssrInterpolate(unref(page))} / ${ssrInterpolate(unref(result).totalPages)}</span><button${ssrIncludeBooleanAttr(unref(page) >= unref(result).totalPages) ? ' disabled' : ''} data-v-fb6ccbf5>\u4E0B\u4E00\u9875</button></div>`,
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
                `<div class="modal-backdrop" data-v-fb6ccbf5><article class="detail-modal" data-v-fb6ccbf5><button class="close" aria-label="\u5173\u95ED\u8BE6\u60C5" data-v-fb6ccbf5>\xD7</button><div class="modal-cover" data-v-fb6ccbf5>`,
              );
              if (unref(selected).thumbnailUrl) {
                _push2(
                  `<img${ssrRenderAttr('src', unref(selected).thumbnailUrl)}${ssrRenderAttr('alt', unref(selected).title)} data-v-fb6ccbf5>`,
                );
              } else {
                _push2(`<span data-v-fb6ccbf5>\u2726</span>`);
              }
              _push2(
                `</div><div class="modal-body" data-v-fb6ccbf5><p class="eyebrow" data-v-fb6ccbf5>${ssrInterpolate(((_a2 = unref(selected).category) == null ? void 0 : _a2.name) || unref(selected).resourceType || 'RESOURCE')}</p><h2 data-v-fb6ccbf5>${ssrInterpolate(unref(selected).title)}</h2><p class="description" data-v-fb6ccbf5>${ssrInterpolate(unref(selected).description || '\u6682\u65E0\u8D44\u6E90\u7B80\u4ECB\u3002')}</p>`,
              );
              if (unref(tags).length) {
                _push2(`<div class="tags" data-v-fb6ccbf5><!--[-->`);
                ssrRenderList(unref(tags), (tag) => {
                  _push2(`<span data-v-fb6ccbf5>${ssrInterpolate(tag)}</span>`);
                });
                _push2(`<!--]--></div>`);
              } else {
                _push2(`<!---->`);
              }
              _push2(
                `<p class="browse-only" data-v-fb6ccbf5>\u516C\u5F00\u8BE6\u60C5\u4EC5\u63D0\u4F9B\u4ECB\u7ECD\u4E0E\u9884\u89C8\uFF0C\u4E0D\u5305\u542B\u8D44\u6E90\u94FE\u63A5\u6216\u63D0\u53D6\u529F\u80FD\u3002</p>`,
              );
              if (unref(detailLoading)) {
                _push2(
                  `<p class="loading" data-v-fb6ccbf5>\u6B63\u5728\u52A0\u8F7D\u8BE6\u60C5\u2026</p>`,
                );
              } else if (unref(selected).contentHtml) {
                _push2(
                  `<div class="article-content" data-v-fb6ccbf5>${(_b2 = unref(selected).contentHtml) != null ? _b2 : ''}</div>`,
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
        _push(`</div>`);
      } else {
        _push(
          `<div${ssrRenderAttrs(mergeProps({ class: 'section-wrap mirror-empty-container' }, _attrs))} data-v-fb6ccbf5><p class="empty-copy" data-v-fb6ccbf5>\u955C\u50CF\u7AD9\u6B63\u5728\u51C6\u5907\u4E2D\uFF0C\u656C\u8BF7\u671F\u5F85\u3002</p></div>`,
        );
      }
    };
  },
});
const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add(
    'pages/mirrors/index.vue',
  );
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const index = /* @__PURE__ */ _export_sfc(_sfc_main, [['__scopeId', 'data-v-fb6ccbf5']]);

export { index as default };
//# sourceMappingURL=index-XKvEXVmQ.mjs.map
