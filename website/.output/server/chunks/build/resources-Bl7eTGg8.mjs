import { defineComponent, unref, useSSRContext } from 'vue';
import { ssrRenderList, ssrRenderAttr, ssrInterpolate } from 'vue/server-renderer';
import { b as useRuntimeConfig } from './server.mjs';
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
  __name: 'resources',
  __ssrInlineRender: true,
  setup(__props) {
    const config = useRuntimeConfig();
    const destinations = [
      {
        number: '01',
        title: '3D \u8D44\u4EA7',
        description:
          '\u6C89\u6DC0\u6A21\u578B\u3001\u573A\u666F\u4E0E\u53EF\u590D\u7528\u7684\u521B\u4F5C\u8D44\u4EA7\u3002',
        path: '/assets',
        mark: '\u25C7',
      },
      {
        number: '02',
        title: '\u5B66\u4E60\u7D20\u6750',
        description:
          '\u6536\u85CF\u6559\u7A0B\u3001\u53C2\u8003\u4E0E\u521B\u4F5C\u8FC7\u7A0B\u4E2D\u9700\u8981\u7684\u7D20\u6750\u3002',
        path: '/materials',
        mark: '\u25CB',
      },
      {
        number: '03',
        title: '\u63D2\u4EF6\u5DE5\u5177',
        description:
          '\u7BA1\u7406\u5DE5\u4F5C\u6D41\u4E2D\u771F\u6B63\u597D\u7528\u7684\u63D2\u4EF6\u4E0E\u8F6F\u4EF6\u3002',
        path: '/plugins',
        mark: '\uFF0B',
      },
      {
        number: '04',
        title: '\u4E34\u65F6\u7F51\u76D8',
        description:
          '\u5B89\u5168\u5730\u5B58\u653E\u3001\u6574\u7406\u548C\u5206\u4EAB\u9636\u6BB5\u6027\u6587\u4EF6\u3002',
        path: '/temporary-netdisk',
        mark: '\u25A1',
      },
    ];
    useSeoMeta({
      title: '\u8D44\u6E90\u4E2D\u5FC3 \u2014 3D Personal Learning Platform',
      description:
        '\u8FDB\u5165\u4E2A\u4EBA\u5B66\u4E60\u5E73\u53F0\uFF0C\u7BA1\u7406\u6240\u6709\u521B\u4F5C\u4E0E\u5B66\u4E60\u8D44\u6E90\u3002',
    });
    return (_ctx, _push, _parent, _attrs) => {
      _push(
        `<!--[--><section class="page-heading section-wrap" data-v-b917e7fa><p class="eyebrow" data-v-b917e7fa>RESOURCE CENTER</p><h1 data-v-b917e7fa>\u628A\u6BCF\u4E00\u4EFD\u79EF\u7D2F\uFF0C<br data-v-b917e7fa>\u7559\u5728\u6070\u5F53\u7684\u4F4D\u7F6E\u3002</h1><p data-v-b917e7fa>\u8D44\u6E90\u4E2D\u5FC3\u670D\u52A1\u4E8E\u4F60\u7684\u4E2A\u4EBA\u5B66\u4E60\u548C\u521B\u4F5C\u5DE5\u4F5C\u53F0\u3002\u955C\u50CF\u7AD9\u7684\u516C\u5F00\u8D44\u6E90\u5219\u72EC\u7ACB\u9648\u5217\u5728\u201C\u955C\u50CF\u7AD9\u201D\u9875\u9762\u3002</p></section><section class="section-wrap destination-grid" data-v-b917e7fa><!--[-->`,
      );
      ssrRenderList(destinations, (item) => {
        _push(
          `<a class="destination-card"${ssrRenderAttr('href', `${unref(config).public.appBase}${item.path}`)} data-v-b917e7fa><span data-v-b917e7fa>${ssrInterpolate(item.number)}</span><i data-v-b917e7fa>${ssrInterpolate(item.mark)}</i><h2 data-v-b917e7fa>${ssrInterpolate(item.title)}</h2><p data-v-b917e7fa>${ssrInterpolate(item.description)}</p><b data-v-b917e7fa>\u8FDB\u5165\u5DE5\u4F5C\u53F0 \u2192</b></a>`,
        );
      });
      _push(`<!--]--></section><!--]-->`);
    };
  },
});
const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add(
    'pages/resources.vue',
  );
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
const resources = /* @__PURE__ */ _export_sfc(_sfc_main, [['__scopeId', 'data-v-b917e7fa']]);

export { resources as default };
//# sourceMappingURL=resources-Bl7eTGg8.mjs.map
