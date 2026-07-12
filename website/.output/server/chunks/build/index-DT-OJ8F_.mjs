import {
  b as usePlatformApi,
  c as useAsyncData,
  d as useSeoMeta,
  a as __nuxt_component_0,
  e as useRuntimeConfig,
} from './server.mjs';
import {
  defineComponent,
  withAsyncContext,
  computed,
  unref,
  withCtx,
  createTextVNode,
  createVNode,
  openBlock,
  createBlock,
  toDisplayString,
  useSSRContext,
} from 'vue';
import {
  ssrInterpolate,
  ssrRenderAttr,
  ssrRenderComponent,
  ssrRenderList,
} from 'vue/server-renderer';
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
    const config = useRuntimeConfig();
    const { data: home } =
      (([__temp, __restore] = withAsyncContext(() =>
        useAsyncData('website-home', () => platform.getHome()),
      )),
      (__temp = await __temp),
      __restore(),
      __temp);
    const { data: mirrors } =
      (([__temp, __restore] = withAsyncContext(() =>
        useAsyncData('website-mirrors', () => platform.getMirrors()),
      )),
      (__temp = await __temp),
      __restore(),
      __temp);
    const copy = computed(() => {
      var _a, _b, _c;
      return {
        eyebrow: String(
          ((_a = home.value) == null ? void 0 : _a.eyebrow) || 'PERSONAL LEARNING PLATFORM',
        ),
        title: String(
          ((_b = home.value) == null ? void 0 : _b.title) ||
            '\u628A\u6BCF\u4E00\u6B21\u5B66\u4E60\uFF0C\n\u53D8\u6210\u770B\u5F97\u89C1\u7684\u6210\u957F\u3002',
        ),
        subtitle: String(
          ((_c = home.value) == null ? void 0 : _c.subtitle) ||
            '\u4E00\u4E2A\u5C06\u8BFE\u7A0B\u3001\u8D44\u6E90\u30013D \u521B\u4F5C\u4E0E\u534F\u4F5C\u4E32\u8054\u8D77\u6765\u7684\u4E2A\u4EBA\u5B66\u4E60\u7A7A\u95F4\u3002\u66F4\u4E13\u6CE8\uFF0C\u4E5F\u66F4\u81EA\u7531\u3002',
        ),
      };
    });
    useSeoMeta({
      title: '3D Personal Learning Platform \u2014 \u8BA9\u6210\u957F\u88AB\u770B\u89C1',
      description:
        '\u805A\u5408\u5B66\u4E60\u30013D \u8D44\u6E90\u4E0E\u521B\u4F5C\u534F\u4F5C\u7684\u4E00\u4F53\u5316\u4E2A\u4EBA\u5B66\u4E60\u5E73\u53F0\u3002',
    });
    return (_ctx, _push, _parent, _attrs) => {
      var _a, _b;
      const _component_NuxtLink = __nuxt_component_0;
      _push(
        `<!--[--><section class="hero section-wrap"><div class="hero-copy"><p class="eyebrow">${ssrInterpolate(unref(copy).eyebrow)}</p><h1>${ssrInterpolate(unref(copy).title)}</h1><p class="hero-subtitle">${ssrInterpolate(unref(copy).subtitle)}</p><div class="hero-actions"><a class="button button-primary"${ssrRenderAttr('href', unref(config).public.appBase)}>\u5F00\u59CB\u5B66\u4E60 <span>\u2192</span></a>`,
      );
      _push(
        ssrRenderComponent(
          _component_NuxtLink,
          {
            class: 'button button-quiet',
            to: '/resources',
          },
          {
            default: withCtx((_, _push2, _parent2, _scopeId) => {
              if (_push2) {
                _push2(`\u63A2\u7D22\u8D44\u6E90`);
              } else {
                return [createTextVNode('\u63A2\u7D22\u8D44\u6E90')];
              }
            }),
            _: 1,
          },
          _parent,
        ),
      );
      _push(
        `</div></div><div class="hero-art" aria-label="\u5B66\u4E60\u5DE5\u4F5C\u53F0\u793A\u610F\u56FE"><div class="orb orb-a"></div><div class="orb orb-b"></div><div class="glass-device"><span class="device-dot"></span><div class="device-line wide"></div><div class="device-line"></div><div class="device-grid"><i></i><i></i><i></i></div></div><div class="floating-card card-one"><b>01</b><span>\u5B66\u4E60\u8DEF\u5F84</span></div><div class="floating-card card-two"><b>\u221E</b><span>\u6301\u7EED\u79EF\u7D2F</span></div></div></section><section class="section-wrap intro-grid"><p class="eyebrow">ONE QUIET PLACE</p><h2>\u4ECE\u7075\u611F\uFF0C\u5230\u638C\u63E1\u3002<br>\u4E0D\u5FC5\u5207\u6362\u573A\u666F\u3002</h2><p>\u6574\u7406\u8BFE\u7A0B\u3001\u6C89\u6DC0\u7B14\u8BB0\u3001\u7BA1\u7406 3D \u8D44\u6E90\uFF0C\u5728\u540C\u4E00\u4E2A\u7B80\u6D01\u3001\u8FDE\u8D2F\u7684\u5DE5\u4F5C\u7A7A\u95F4\u91CC\u6301\u7EED\u524D\u8FDB\u3002</p></section><section class="section-wrap feature-grid"><article><span>01</span><h3>\u5B66\u4E60\u8DEF\u5F84</h3><p>\u4EE5\u6E05\u6670\u8FDB\u5EA6\u8FDE\u63A5\u76EE\u6807\u3001\u8BFE\u7A0B\u4E0E\u7B14\u8BB0\uFF0C\u8BA9\u5B66\u4E60\u81EA\u7136\u5F62\u6210\u7CFB\u7EDF\u3002</p></article><article><span>02</span><h3>\u8D44\u6E90\u6C89\u6DC0</h3><p>\u96C6\u4E2D\u7BA1\u7406\u6A21\u578B\u3001\u7D20\u6750\u4E0E\u63D2\u4EF6\uFF0C\u8D44\u6E90\u4E0D\u518D\u6563\u843D\u5728\u4E0D\u540C\u89D2\u843D\u3002</p></article><article><span>03</span><h3>\u534F\u4F5C\u521B\u4F5C</h3><p>\u8BA9\u4E2A\u4EBA\u79EF\u7D2F\u5728\u9700\u8981\u65F6\u6210\u4E3A\u56E2\u961F\u53EF\u4EE5\u5171\u4EAB\u3001\u8BA8\u8BBA\u548C\u63A8\u8FDB\u7684\u6210\u679C\u3002</p></article></section><section class="section-wrap mirror-preview"><div class="section-heading"><div><p class="eyebrow">MIRROR NETWORK</p><h2>\u503C\u5F97\u53CD\u590D\u8BBF\u95EE\u7684\u8D44\u6E90\u3002</h2></div>`,
      );
      _push(
        ssrRenderComponent(
          _component_NuxtLink,
          { to: '/mirrors' },
          {
            default: withCtx((_, _push2, _parent2, _scopeId) => {
              if (_push2) {
                _push2(`\u67E5\u770B\u5168\u90E8 <span${_scopeId}>\u2192</span>`);
              } else {
                return [
                  createTextVNode('\u67E5\u770B\u5168\u90E8 '),
                  createVNode('span', null, '\u2192'),
                ];
              }
            }),
            _: 1,
          },
          _parent,
        ),
      );
      _push(`</div><div class="mirror-cards"><!--[-->`);
      ssrRenderList((_a = unref(mirrors)) == null ? void 0 : _a.slice(0, 3), (mirror) => {
        _push(
          ssrRenderComponent(
            _component_NuxtLink,
            {
              key: mirror.id,
              class: 'mirror-card',
              to: `/mirrors/${mirror.id}`,
            },
            {
              default: withCtx((_, _push2, _parent2, _scopeId) => {
                if (_push2) {
                  if (mirror.iconUrl) {
                    _push2(
                      `<img${ssrRenderAttr('src', mirror.iconUrl)}${ssrRenderAttr('alt', mirror.displayName)}${_scopeId}>`,
                    );
                  } else {
                    _push2(`<span class="card-icon"${_scopeId}>\u2726</span>`);
                  }
                  _push2(
                    `<h3${_scopeId}>${ssrInterpolate(mirror.displayName)}</h3><p${_scopeId}>${ssrInterpolate(mirror.description || '\u6301\u7EED\u540C\u6B65\u7684\u7CBE\u9009\u5B66\u4E60\u8D44\u6E90\u3002')}</p><small${_scopeId}>${ssrInterpolate(mirror.totalResources.toLocaleString())} \u9879\u8D44\u6E90</small>`,
                  );
                } else {
                  return [
                    mirror.iconUrl
                      ? (openBlock(),
                        createBlock(
                          'img',
                          {
                            key: 0,
                            src: mirror.iconUrl,
                            alt: mirror.displayName,
                          },
                          null,
                          8,
                          ['src', 'alt'],
                        ))
                      : (openBlock(),
                        createBlock(
                          'span',
                          {
                            key: 1,
                            class: 'card-icon',
                          },
                          '\u2726',
                        )),
                    createVNode('h3', null, toDisplayString(mirror.displayName), 1),
                    createVNode(
                      'p',
                      null,
                      toDisplayString(
                        mirror.description ||
                          '\u6301\u7EED\u540C\u6B65\u7684\u7CBE\u9009\u5B66\u4E60\u8D44\u6E90\u3002',
                      ),
                      1,
                    ),
                    createVNode(
                      'small',
                      null,
                      toDisplayString(mirror.totalResources.toLocaleString()) +
                        ' \u9879\u8D44\u6E90',
                      1,
                    ),
                  ];
                }
              }),
              _: 2,
            },
            _parent,
          ),
        );
      });
      _push(`<!--]-->`);
      if (!((_b = unref(mirrors)) == null ? void 0 : _b.length)) {
        _push(
          `<div class="mirror-empty">\u955C\u50CF\u7AD9\u6B63\u5728\u51C6\u5907\u4E2D\uFF0C\u656C\u8BF7\u671F\u5F85\u3002</div>`,
        );
      } else {
        _push(`<!---->`);
      }
      _push(`</div></section><!--]-->`);
    };
  },
});
const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add('pages/index.vue');
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};

export { _sfc_main as default };
//# sourceMappingURL=index-DT-OJ8F_.mjs.map
