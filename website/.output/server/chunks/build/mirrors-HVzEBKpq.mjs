import { u as usePlatformApi, a as useAsyncData, _ as __nuxt_component_0 } from './server.mjs';
import {
  defineComponent,
  withAsyncContext,
  unref,
  withCtx,
  createVNode,
  toDisplayString,
  openBlock,
  createBlock,
  createTextVNode,
  useSSRContext,
} from 'vue';
import {
  ssrRenderList,
  ssrRenderComponent,
  ssrInterpolate,
  ssrRenderAttr,
} from 'vue/server-renderer';
import { u as useSeoMeta } from './v3-EZZOES_4.mjs';
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
  __name: 'mirrors',
  __ssrInlineRender: true,
  async setup(__props) {
    let __temp, __restore;
    const platform = usePlatformApi();
    const { data: mirrors } =
      (([__temp, __restore] = withAsyncContext(() =>
        useAsyncData('all-mirrors', () => platform.getMirrors()),
      )),
      (__temp = await __temp),
      __restore(),
      __temp);
    useSeoMeta({
      title: '\u955C\u50CF\u7AD9 \u2014 3D Personal Learning Platform',
      description:
        '\u6D4F\u89C8\u5DF2\u63A5\u5165\u7684\u5B66\u4E60\u8D44\u6E90\u955C\u50CF\u7AD9\u3002',
    });
    return (_ctx, _push, _parent, _attrs) => {
      var _a;
      const _component_NuxtLink = __nuxt_component_0;
      _push(
        `<!--[--><section class="page-heading section-wrap"><p class="eyebrow">MIRROR NETWORK</p><h1>\u8FDE\u63A5\u6BCF\u4E00\u5904\u6709\u4EF7\u503C\u7684\u77E5\u8BC6\u3002</h1><p>\u6240\u6709\u955C\u50CF\u7AD9\u7531\u540C\u4E00\u5957\u540E\u53F0\u7EDF\u4E00\u7EF4\u62A4\u3001\u540C\u6B65\u548C\u5C55\u793A\u3002</p></section><section class="section-wrap mirrors-list"><!--[-->`,
      );
      ssrRenderList(unref(mirrors), (mirror, index) => {
        _push(
          ssrRenderComponent(
            _component_NuxtLink,
            {
              id: mirror.id,
              key: mirror.id,
              class: 'mirror-row',
              to: `/mirrors/${mirror.id}`,
            },
            {
              default: withCtx((_, _push2, _parent2, _scopeId) => {
                if (_push2) {
                  _push2(`<span${_scopeId}>0${ssrInterpolate(index + 1)}</span>`);
                  if (mirror.iconUrl) {
                    _push2(
                      `<img${ssrRenderAttr('src', mirror.iconUrl)}${ssrRenderAttr('alt', mirror.displayName)}${_scopeId}>`,
                    );
                  } else {
                    _push2(`<i${_scopeId}>\u2726</i>`);
                  }
                  _push2(
                    `<div${_scopeId}><h2${_scopeId}>${ssrInterpolate(mirror.displayName)}</h2><p${_scopeId}>${ssrInterpolate(mirror.description || '\u6301\u7EED\u7EF4\u62A4\u7684\u8D44\u6E90\u955C\u50CF\u7AD9\u3002')}</p></div><strong${_scopeId}>${ssrInterpolate(mirror.totalResources.toLocaleString())}<small${_scopeId}>\u8D44\u6E90</small></strong>`,
                  );
                } else {
                  return [
                    createVNode('span', null, '0' + toDisplayString(index + 1), 1),
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
                      : (openBlock(), createBlock('i', { key: 1 }, '\u2726')),
                    createVNode('div', null, [
                      createVNode('h2', null, toDisplayString(mirror.displayName), 1),
                      createVNode(
                        'p',
                        null,
                        toDisplayString(
                          mirror.description ||
                            '\u6301\u7EED\u7EF4\u62A4\u7684\u8D44\u6E90\u955C\u50CF\u7AD9\u3002',
                        ),
                        1,
                      ),
                    ]),
                    createVNode('strong', null, [
                      createTextVNode(toDisplayString(mirror.totalResources.toLocaleString()), 1),
                      createVNode('small', null, '\u8D44\u6E90'),
                    ]),
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
      if (!((_a = unref(mirrors)) == null ? void 0 : _a.length)) {
        _push(`<p class="empty-copy">\u955C\u50CF\u7AD9\u6B63\u5728\u51C6\u5907\u4E2D\u3002</p>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</section><!--]-->`);
    };
  },
});
const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add('pages/mirrors.vue');
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};

export { _sfc_main as default };
//# sourceMappingURL=mirrors-HVzEBKpq.mjs.map
