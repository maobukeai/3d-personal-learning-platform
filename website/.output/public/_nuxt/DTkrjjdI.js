import {
  e as B,
  n as D,
  u as H,
  f as C,
  c as a,
  a as e,
  b as j,
  w as O,
  t as r,
  h as t,
  p as U,
  q,
  v as z,
  s as F,
  x as M,
  d as w,
  F as h,
  r as $,
  k as g,
  j as J,
  T as X,
  y as k,
  _ as Y,
  g as R,
  o,
  m as I,
} from './HnPWE_ys.js';
import { a as G } from './C5KMDVPB.js';
import { _ as K } from './DlAUqK2U.js';
const Q = { class: 'mirror-hero section-wrap' },
  W = { class: 'mirror-browser section-wrap' },
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
  de = { class: 'detail-modal' },
  ce = { class: 'modal-cover' },
  pe = ['src', 'alt'],
  me = { key: 1 },
  ve = { class: 'modal-body' },
  _e = { class: 'eyebrow' },
  ye = { class: 'description' },
  ge = { key: 0, class: 'tags' },
  ke = { key: 1, class: 'loading' },
  be = ['innerHTML'],
  he = B({
    __name: '[sourceId]',
    async setup(fe) {
      let i, p;
      const S = D(),
        b = H(),
        d = I(() => String(S.params.sourceId)),
        v = k(),
        _ = k(''),
        u = k(1),
        n = k(null),
        f = k(!1),
        { data: m } =
          (([i, p] = C(() =>
            R(
              () => `mirror-${d.value}`,
              () => b.getMirror(d.value),
              '$_z-4_FAYtX',
            ),
          )),
          (i = await i),
          p(),
          i),
        { data: T } =
          (([i, p] = C(() =>
            R(
              () => `mirror-categories-${d.value}`,
              () => b.getMirrorCategories(d.value),
              '$cJjUkpCTuj',
            ),
          )),
          (i = await i),
          p(),
          i),
        { data: c, refresh: E } =
          (([i, p] = C(() =>
            R(
              () => `mirror-resources-${d.value}-${v.value || 'all'}-${u.value}-${_.value}`,
              () =>
                b.getMirrorResources(d.value, {
                  page: u.value,
                  pageSize: 20,
                  categoryId: v.value,
                  q: _.value,
                }),
              '$jP_utUnMxN',
            ),
          )),
          (i = await i),
          p(),
          i),
        x = I(() => {
          try {
            return JSON.parse(n.value?.tags || '[]');
          } catch {
            return [];
          }
        }),
        N = (y) => {
          ((v.value = y), (u.value = 1));
        },
        P = () => {
          ((u.value = 1), E());
        },
        L = async (y) => {
          ((f.value = !0),
            (n.value = { ...y, source: { id: d.value, displayName: m.value?.displayName || '' } }));
          try {
            n.value = await b.getMirrorResource(d.value, y.id);
          } finally {
            f.value = !1;
          }
        };
      return (
        G({ title: () => `${m.value?.displayName || '镜像站'} — 3D Personal Learning Platform` }),
        (y, l) => {
          const V = Y;
          return (
            o(),
            a(
              h,
              null,
              [
                e('section', Q, [
                  j(
                    V,
                    { class: 'back-link', to: '/mirrors' },
                    { default: O(() => [...(l[6] || (l[6] = [w('← 返回镜像站', -1)]))]), _: 1 },
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
                e('section', W, [
                  e('header', Z, [
                    e('div', null, [
                      e('strong', null, r(t(c)?.total ?? t(m)?.totalResources ?? 0), 1),
                      l[8] || (l[8] = e('span', null, ' 项已归档内容', -1)),
                    ]),
                    e(
                      'form',
                      { class: 'resource-search', onSubmit: U(P, ['prevent']) },
                      [
                        q(
                          e(
                            'input',
                            {
                              'onUpdate:modelValue':
                                l[0] || (l[0] = (s) => (F(_) ? (_.value = s) : null)),
                              placeholder: '搜索资源',
                            },
                            null,
                            512,
                          ),
                          [[z, t(_)]],
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
                        l[10] || (l[10] = w('全部 ', -1)),
                        e('small', null, r(t(m)?.totalResources || 0), 1),
                      ],
                      2,
                    ),
                    (o(!0),
                    a(
                      h,
                      null,
                      $(
                        t(T),
                        (s) => (
                          o(),
                          a(
                            'button',
                            {
                              key: s.id,
                              class: M({ active: t(v) === s.id }),
                              onClick: (A) => N(s.id),
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
                      $(
                        t(c)?.resources,
                        (s) => (
                          o(),
                          a(
                            'button',
                            { key: s.id, class: 'resource-card', onClick: (A) => L(s) },
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
                  t(c)?.resources?.length ? g('', !0) : (o(), a('p', ne, '没有符合条件的资源。')),
                  t(c) && t(c).totalPages > 1
                    ? (o(),
                      a('div', re, [
                        e(
                          'button',
                          { disabled: t(u) <= 1, onClick: l[2] || (l[2] = (s) => u.value--) },
                          '上一页',
                          8,
                          ie,
                        ),
                        e('span', null, r(t(u)) + ' / ' + r(t(c).totalPages), 1),
                        e(
                          'button',
                          {
                            disabled: t(u) >= t(c).totalPages,
                            onClick: l[3] || (l[3] = (s) => u.value++),
                          },
                          '下一页',
                          8,
                          ue,
                        ),
                      ]))
                    : g('', !0),
                ]),
                (o(),
                J(X, { to: 'body' }, [
                  t(n)
                    ? (o(),
                      a(
                        'div',
                        {
                          key: 0,
                          class: 'modal-backdrop',
                          onClick: l[5] || (l[5] = U((s) => (n.value = null), ['self'])),
                        },
                        [
                          e('article', de, [
                            e(
                              'button',
                              {
                                class: 'close',
                                'aria-label': '关闭详情',
                                onClick: l[4] || (l[4] = (s) => (n.value = null)),
                              },
                              '×',
                            ),
                            e('div', ce, [
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
                                      $(t(x), (s) => (o(), a('span', { key: s }, r(s), 1))),
                                      128,
                                    )),
                                  ]))
                                : g('', !0),
                              l[11] ||
                                (l[11] = e(
                                  'p',
                                  { class: 'browse-only' },
                                  '公开详情仅提供介绍与预览，不包含资源链接或提取功能。',
                                  -1,
                                )),
                              t(f)
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
                                  : g('', !0),
                            ]),
                          ]),
                        ],
                      ))
                    : g('', !0),
                ])),
              ],
              64,
            )
          );
        }
      );
    },
  }),
  Re = K(he, [['__scopeId', 'data-v-6e1dbf4a']]);
export { Re as default };
