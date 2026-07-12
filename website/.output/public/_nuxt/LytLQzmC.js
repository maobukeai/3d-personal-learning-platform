import {
  f as L,
  g as D,
  h as g,
  s as V,
  j as O,
  k as e,
  c as n,
  a as t,
  t as u,
  v as P,
  x as q,
  y as z,
  z as F,
  A as x,
  d as S,
  F as C,
  r as M,
  n as h,
  m as j,
  T as J,
  B as b,
  i as k,
  o,
  q as U,
  _ as G,
} from './DMhcGZvP.js';
const K = { key: 0 },
  Q = { class: 'mirror-hero section-wrap' },
  W = { class: 'mirror-browser section-wrap' },
  X = { class: 'browser-header' },
  Y = { class: 'category-rail' },
  Z = ['onClick'],
  ee = { class: 'resource-grid' },
  te = ['onClick'],
  se = ['src', 'alt'],
  le = { key: 1, class: 'resource-placeholder' },
  ae = { key: 0, class: 'empty-copy' },
  oe = { key: 1, class: 'pagination' },
  ne = ['disabled'],
  re = ['disabled'],
  ie = { class: 'detail-modal' },
  ue = { class: 'modal-cover' },
  de = ['src', 'alt'],
  ce = { key: 1 },
  ve = { class: 'modal-body' },
  pe = { class: 'eyebrow' },
  me = { class: 'description' },
  ye = { key: 0, class: 'tags' },
  _e = { key: 1, class: 'loading' },
  ge = ['innerHTML'],
  he = { key: 1, class: 'section-wrap mirror-empty-container' },
  be = L({
    __name: 'index',
    async setup(ke) {
      let a, d;
      const m = D(),
        { data: E } =
          (([a, d] = g(() => k('website-home', () => m.getHome()))), (a = await a), d(), a),
        { data: N } =
          (([a, d] = g(() => k('all-mirrors', () => m.getMirrors()))), (a = await a), d(), a),
        r = U(() => {
          const v = E.value?.featuredMirrorId;
          if (v && typeof v == 'string') return v;
          const s = N.value;
          return Array.isArray(s) && s.length > 0 ? s[0].id : '';
        }),
        y = b(),
        f = b(''),
        c = b(1),
        i = b(null),
        w = b(!1),
        { data: _ } =
          (([a, d] = g(() =>
            k(
              () => `mirror-${r.value}`,
              () => (r.value ? m.getMirror(r.value) : Promise.resolve(null)),
              { watch: [r] },
            ),
          )),
          (a = await a),
          d(),
          a),
        { data: T } =
          (([a, d] = g(() =>
            k(
              () => `mirror-categories-${r.value}`,
              () => (r.value ? m.getMirrorCategories(r.value) : Promise.resolve([])),
              { watch: [r] },
            ),
          )),
          (a = await a),
          d(),
          a),
        { data: p, refresh: A } =
          (([a, d] = g(() =>
            k(
              () => `mirror-resources-${r.value}`,
              () =>
                r.value
                  ? m.getMirrorResources(r.value, {
                      page: c.value,
                      pageSize: 20,
                      categoryId: y.value,
                      q: f.value,
                    })
                  : Promise.resolve(null),
              { watch: [r, y, c] },
            ),
          )),
          (a = await a),
          d(),
          a),
        R = U(() => {
          try {
            return JSON.parse(i.value?.tags || '[]');
          } catch {
            return [];
          }
        });
      V(r, () => {
        ((y.value = void 0), (c.value = 1));
      });
      const $ = (v) => {
          ((y.value = v), (c.value = 1));
        },
        I = () => {
          ((c.value = 1), A());
        },
        B = async (v) => {
          if (r.value) {
            ((w.value = !0),
              (i.value = {
                ...v,
                source: { id: r.value, displayName: _.value?.displayName || '' },
              }));
            try {
              i.value = await m.getMirrorResource(r.value, v.id);
            } finally {
              w.value = !1;
            }
          }
        };
      return (
        O({ title: () => `${_.value?.displayName || '镜像站'} — 3D Personal Learning Platform` }),
        (v, s) =>
          e(r)
            ? (o(),
              n('div', K, [
                t('section', Q, [
                  s[6] || (s[6] = t('p', { class: 'eyebrow' }, 'PUBLIC RESOURCE ARCHIVE', -1)),
                  t('h1', null, u(e(_)?.displayName), 1),
                  t(
                    'p',
                    null,
                    u(
                      e(_)?.description ||
                        '可公开浏览的资源归档。资源仅供预览与了解，不提供链接提取。',
                    ),
                    1,
                  ),
                ]),
                t('section', W, [
                  t('header', X, [
                    t('div', null, [
                      t('strong', null, u(e(p)?.total ?? e(_)?.totalResources ?? 0), 1),
                      s[7] || (s[7] = t('span', null, ' 项已归档内容', -1)),
                    ]),
                    t(
                      'form',
                      { class: 'resource-search', onSubmit: P(I, ['prevent']) },
                      [
                        q(
                          t(
                            'input',
                            {
                              'onUpdate:modelValue':
                                s[0] || (s[0] = (l) => (F(f) ? (f.value = l) : null)),
                              placeholder: '搜索资源',
                            },
                            null,
                            512,
                          ),
                          [[z, e(f)]],
                        ),
                        s[8] || (s[8] = t('button', { type: 'submit' }, '搜索', -1)),
                      ],
                      32,
                    ),
                  ]),
                  t('div', Y, [
                    t(
                      'button',
                      { class: x({ active: !e(y) }), onClick: s[1] || (s[1] = (l) => $()) },
                      [
                        s[9] || (s[9] = S(' 全部 ', -1)),
                        t('small', null, u(e(_)?.totalResources || 0), 1),
                      ],
                      2,
                    ),
                    (o(!0),
                    n(
                      C,
                      null,
                      M(
                        e(T),
                        (l) => (
                          o(),
                          n(
                            'button',
                            {
                              key: l.id,
                              class: x({ active: e(y) === l.id }),
                              onClick: (H) => $(l.id),
                            },
                            [S(u(l.name) + ' ', 1), t('small', null, u(l.resourceCount), 1)],
                            10,
                            Z,
                          )
                        ),
                      ),
                      128,
                    )),
                  ]),
                  t('div', ee, [
                    (o(!0),
                    n(
                      C,
                      null,
                      M(
                        e(p)?.resources,
                        (l) => (
                          o(),
                          n(
                            'button',
                            { key: l.id, class: 'resource-card', onClick: (H) => B(l) },
                            [
                              l.thumbnailUrl
                                ? (o(),
                                  n(
                                    'img',
                                    { key: 0, src: l.thumbnailUrl, alt: l.title },
                                    null,
                                    8,
                                    se,
                                  ))
                                : (o(), n('div', le, '✦')),
                              t('p', null, u(l.category?.name || l.resourceType || 'RESOURCE'), 1),
                              t('h2', null, u(l.title), 1),
                              t('span', null, u(l.description || '点击查看资源介绍与预览。'), 1),
                            ],
                            8,
                            te,
                          )
                        ),
                      ),
                      128,
                    )),
                  ]),
                  e(p)?.resources?.length ? h('', !0) : (o(), n('p', ae, '没有符合条件的资源。')),
                  e(p) && e(p).totalPages > 1
                    ? (o(),
                      n('div', oe, [
                        t(
                          'button',
                          { disabled: e(c) <= 1, onClick: s[2] || (s[2] = (l) => c.value--) },
                          '上一页',
                          8,
                          ne,
                        ),
                        t('span', null, u(e(c)) + ' / ' + u(e(p).totalPages), 1),
                        t(
                          'button',
                          {
                            disabled: e(c) >= e(p).totalPages,
                            onClick: s[3] || (s[3] = (l) => c.value++),
                          },
                          '下一页',
                          8,
                          re,
                        ),
                      ]))
                    : h('', !0),
                ]),
                (o(),
                j(J, { to: 'body' }, [
                  e(i)
                    ? (o(),
                      n(
                        'div',
                        {
                          key: 0,
                          class: 'modal-backdrop',
                          onClick: s[5] || (s[5] = P((l) => (i.value = null), ['self'])),
                        },
                        [
                          t('article', ie, [
                            t(
                              'button',
                              {
                                class: 'close',
                                'aria-label': '关闭详情',
                                onClick: s[4] || (s[4] = (l) => (i.value = null)),
                              },
                              '×',
                            ),
                            t('div', ue, [
                              e(i).thumbnailUrl
                                ? (o(),
                                  n(
                                    'img',
                                    { key: 0, src: e(i).thumbnailUrl, alt: e(i).title },
                                    null,
                                    8,
                                    de,
                                  ))
                                : (o(), n('span', ce, '✦')),
                            ]),
                            t('div', ve, [
                              t(
                                'p',
                                pe,
                                u(e(i).category?.name || e(i).resourceType || 'RESOURCE'),
                                1,
                              ),
                              t('h2', null, u(e(i).title), 1),
                              t('p', me, u(e(i).description || '暂无资源简介。'), 1),
                              e(R).length
                                ? (o(),
                                  n('div', ye, [
                                    (o(!0),
                                    n(
                                      C,
                                      null,
                                      M(e(R), (l) => (o(), n('span', { key: l }, u(l), 1))),
                                      128,
                                    )),
                                  ]))
                                : h('', !0),
                              s[10] ||
                                (s[10] = t(
                                  'p',
                                  { class: 'browse-only' },
                                  '公开详情仅提供介绍与预览，不包含资源链接或提取功能。',
                                  -1,
                                )),
                              e(w)
                                ? (o(), n('p', _e, '正在加载详情…'))
                                : e(i).contentHtml
                                  ? (o(),
                                    n(
                                      'div',
                                      {
                                        key: 2,
                                        class: 'article-content',
                                        innerHTML: e(i).contentHtml,
                                      },
                                      null,
                                      8,
                                      ge,
                                    ))
                                  : h('', !0),
                            ]),
                          ]),
                        ],
                      ))
                    : h('', !0),
                ])),
              ]))
            : (o(),
              n('div', he, [
                ...(s[11] ||
                  (s[11] = [t('p', { class: 'empty-copy' }, '镜像站正在准备中，敬请期待。', -1)])),
              ]))
      );
    },
  }),
  we = G(be, [['__scopeId', 'data-v-fb6ccbf5']]);
export { we as default };
