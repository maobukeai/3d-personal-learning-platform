import {
  f as A,
  C as D,
  g as H,
  h as f,
  j as O,
  c as a,
  a as e,
  b as q,
  w as z,
  t as r,
  k as t,
  v as I,
  x as F,
  y as j,
  z as J,
  A as M,
  d as w,
  F as h,
  r as R,
  n as y,
  m as G,
  T as K,
  B as g,
  e as Q,
  i as $,
  q as S,
  o,
  _ as W,
} from './DMhcGZvP.js';
const X = { class: 'mirror-hero section-wrap' },
  Y = { class: 'mirror-browser section-wrap' },
  Z = { class: 'browser-header' },
  ee = { class: 'category-rail' },
  te = ['onClick'],
  se = { class: 'resource-grid' },
  le = ['onClick'],
  oe = ['src', 'alt'],
  ae = { key: 1, class: 'resource-placeholder' },
  ne = { key: 0, class: 'empty-copy' },
  re = { key: 1, class: 'pagination' },
  ie = ['disabled'],
  ue = ['disabled'],
  ce = { class: 'detail-modal' },
  de = { class: 'modal-cover' },
  pe = ['src', 'alt'],
  me = { key: 1 },
  ve = { class: 'modal-body' },
  _e = { class: 'eyebrow' },
  ye = { class: 'description' },
  ge = { key: 0, class: 'tags' },
  ke = { key: 1, class: 'loading' },
  be = ['innerHTML'],
  he = A({
    __name: '[sourceId]',
    async setup(Ce) {
      let i, p;
      const U = D(),
        k = H(),
        c = S(() => String(U.params.sourceId)),
        v = g(),
        b = g(''),
        u = g(1),
        n = g(null),
        C = g(!1),
        { data: m } =
          (([i, p] = f(() => $(`mirror-${c.value}`, () => k.getMirror(c.value)))),
          (i = await i),
          p(),
          i),
        { data: E } =
          (([i, p] = f(() =>
            $(`mirror-categories-${c.value}`, () => k.getMirrorCategories(c.value)),
          )),
          (i = await i),
          p(),
          i),
        { data: d, refresh: T } =
          (([i, p] = f(() =>
            $(
              `mirror-resources-${c.value}`,
              () =>
                k.getMirrorResources(c.value, {
                  page: u.value,
                  pageSize: 20,
                  categoryId: v.value,
                  q: b.value,
                }),
              { watch: [v, u] },
            ),
          )),
          (i = await i),
          p(),
          i),
        x = S(() => {
          try {
            return JSON.parse(n.value?.tags || '[]');
          } catch {
            return [];
          }
        }),
        N = (_) => {
          ((v.value = _), (u.value = 1));
        },
        L = () => {
          ((u.value = 1), T());
        },
        P = async (_) => {
          ((C.value = !0),
            (n.value = { ..._, source: { id: c.value, displayName: m.value?.displayName || '' } }));
          try {
            n.value = await k.getMirrorResource(c.value, _.id);
          } finally {
            C.value = !1;
          }
        };
      return (
        O({ title: () => `${m.value?.displayName || '镜像站'} — 3D Personal Learning Platform` }),
        (_, l) => {
          const B = Q;
          return (
            o(),
            a(
              h,
              null,
              [
                e('section', X, [
                  q(
                    B,
                    { class: 'back-link', to: '/mirrors' },
                    { default: z(() => [...(l[6] || (l[6] = [w('← 返回镜像站', -1)]))]), _: 1 },
                  ),
                  l[7] || (l[7] = e('p', { class: 'eyebrow' }, 'PUBLIC RESOURCE ARCHIVE', -1)),
                  e('h1', null, r(t(m)?.displayName), 1),
                  e(
                    'p',
                    null,
                    r(
                      t(m)?.description ||
                        '可公开浏览的资源归档。资源仅供预览与了解，不提供链接提取。',
                    ),
                    1,
                  ),
                ]),
                e('section', Y, [
                  e('header', Z, [
                    e('div', null, [
                      e('strong', null, r(t(d)?.total ?? t(m)?.totalResources ?? 0), 1),
                      l[8] || (l[8] = e('span', null, ' 项已归档内容', -1)),
                    ]),
                    e(
                      'form',
                      { class: 'resource-search', onSubmit: I(L, ['prevent']) },
                      [
                        F(
                          e(
                            'input',
                            {
                              'onUpdate:modelValue':
                                l[0] || (l[0] = (s) => (J(b) ? (b.value = s) : null)),
                              placeholder: '搜索资源',
                            },
                            null,
                            512,
                          ),
                          [[j, t(b)]],
                        ),
                        l[9] || (l[9] = e('button', { type: 'submit' }, '搜索', -1)),
                      ],
                      32,
                    ),
                  ]),
                  e('div', ee, [
                    e(
                      'button',
                      { class: M({ active: !t(v) }), onClick: l[1] || (l[1] = (s) => N()) },
                      [
                        l[10] || (l[10] = w(' 全部 ', -1)),
                        e('small', null, r(t(m)?.totalResources || 0), 1),
                      ],
                      2,
                    ),
                    (o(!0),
                    a(
                      h,
                      null,
                      R(
                        t(E),
                        (s) => (
                          o(),
                          a(
                            'button',
                            {
                              key: s.id,
                              class: M({ active: t(v) === s.id }),
                              onClick: (V) => N(s.id),
                            },
                            [w(r(s.name) + ' ', 1), e('small', null, r(s.resourceCount), 1)],
                            10,
                            te,
                          )
                        ),
                      ),
                      128,
                    )),
                  ]),
                  e('div', se, [
                    (o(!0),
                    a(
                      h,
                      null,
                      R(
                        t(d)?.resources,
                        (s) => (
                          o(),
                          a(
                            'button',
                            { key: s.id, class: 'resource-card', onClick: (V) => P(s) },
                            [
                              s.thumbnailUrl
                                ? (o(),
                                  a(
                                    'img',
                                    { key: 0, src: s.thumbnailUrl, alt: s.title },
                                    null,
                                    8,
                                    oe,
                                  ))
                                : (o(), a('div', ae, '✦')),
                              e('p', null, r(s.category?.name || s.resourceType || 'RESOURCE'), 1),
                              e('h2', null, r(s.title), 1),
                              e('span', null, r(s.description || '点击查看资源介绍与预览。'), 1),
                            ],
                            8,
                            le,
                          )
                        ),
                      ),
                      128,
                    )),
                  ]),
                  t(d)?.resources?.length ? y('', !0) : (o(), a('p', ne, '没有符合条件的资源。')),
                  t(d) && t(d).totalPages > 1
                    ? (o(),
                      a('div', re, [
                        e(
                          'button',
                          { disabled: t(u) <= 1, onClick: l[2] || (l[2] = (s) => u.value--) },
                          '上一页',
                          8,
                          ie,
                        ),
                        e('span', null, r(t(u)) + ' / ' + r(t(d).totalPages), 1),
                        e(
                          'button',
                          {
                            disabled: t(u) >= t(d).totalPages,
                            onClick: l[3] || (l[3] = (s) => u.value++),
                          },
                          '下一页',
                          8,
                          ue,
                        ),
                      ]))
                    : y('', !0),
                ]),
                (o(),
                G(K, { to: 'body' }, [
                  t(n)
                    ? (o(),
                      a(
                        'div',
                        {
                          key: 0,
                          class: 'modal-backdrop',
                          onClick: l[5] || (l[5] = I((s) => (n.value = null), ['self'])),
                        },
                        [
                          e('article', ce, [
                            e(
                              'button',
                              {
                                class: 'close',
                                'aria-label': '关闭详情',
                                onClick: l[4] || (l[4] = (s) => (n.value = null)),
                              },
                              '×',
                            ),
                            e('div', de, [
                              t(n).thumbnailUrl
                                ? (o(),
                                  a(
                                    'img',
                                    { key: 0, src: t(n).thumbnailUrl, alt: t(n).title },
                                    null,
                                    8,
                                    pe,
                                  ))
                                : (o(), a('span', me, '✦')),
                            ]),
                            e('div', ve, [
                              e(
                                'p',
                                _e,
                                r(t(n).category?.name || t(n).resourceType || 'RESOURCE'),
                                1,
                              ),
                              e('h2', null, r(t(n).title), 1),
                              e('p', ye, r(t(n).description || '暂无资源简介。'), 1),
                              t(x).length
                                ? (o(),
                                  a('div', ge, [
                                    (o(!0),
                                    a(
                                      h,
                                      null,
                                      R(t(x), (s) => (o(), a('span', { key: s }, r(s), 1))),
                                      128,
                                    )),
                                  ]))
                                : y('', !0),
                              l[11] ||
                                (l[11] = e(
                                  'p',
                                  { class: 'browse-only' },
                                  '公开详情仅提供介绍与预览，不包含资源链接或提取功能。',
                                  -1,
                                )),
                              t(C)
                                ? (o(), a('p', ke, '正在加载详情…'))
                                : t(n).contentHtml
                                  ? (o(),
                                    a(
                                      'div',
                                      {
                                        key: 2,
                                        class: 'article-content',
                                        innerHTML: t(n).contentHtml,
                                      },
                                      null,
                                      8,
                                      be,
                                    ))
                                  : y('', !0),
                            ]),
                          ]),
                        ],
                      ))
                    : y('', !0),
                ])),
              ],
              64,
            )
          );
        }
      );
    },
  }),
  we = W(he, [['__scopeId', 'data-v-14975f2c']]);
export { we as default };
