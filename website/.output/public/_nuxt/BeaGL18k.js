import {
  e as m,
  u as y,
  f,
  c as a,
  a as t,
  F as c,
  r as g,
  h as p,
  k,
  g as h,
  o as e,
  j as w,
  w as x,
  t as l,
  d as N,
  _ as R,
} from './HnPWE_ys.js';
import { a as B } from './C5KMDVPB.js';
const C = { class: 'section-wrap mirrors-list' },
  L = ['src', 'alt'],
  A = { key: 1 },
  D = { key: 0, class: 'empty-copy' },
  E = m({
    __name: 'mirrors',
    async setup(M) {
      let n, r;
      const u = y(),
        { data: i } =
          (([n, r] = f(() => h('all-mirrors', () => u.getMirrors()))), (n = await n), r(), n);
      return (
        B({
          title: '镜像站 — 3D Personal Learning Platform',
          description: '浏览已接入的学习资源镜像站。',
        }),
        (P, o) => {
          const d = R;
          return (
            e(),
            a(
              c,
              null,
              [
                o[1] ||
                  (o[1] = t(
                    'section',
                    { class: 'page-heading section-wrap' },
                    [
                      t('p', { class: 'eyebrow' }, 'MIRROR NETWORK'),
                      t('h1', null, '连接每一处有价值的知识。'),
                      t('p', null, '所有镜像站由同一套后台统一维护、同步和展示。'),
                    ],
                    -1,
                  )),
                t('section', C, [
                  (e(!0),
                  a(
                    c,
                    null,
                    g(
                      p(i),
                      (s, _) => (
                        e(),
                        w(
                          d,
                          { id: s.id, key: s.id, class: 'mirror-row', to: `/mirrors/${s.id}` },
                          {
                            default: x(() => [
                              t('span', null, '0' + l(_ + 1), 1),
                              s.iconUrl
                                ? (e(),
                                  a(
                                    'img',
                                    { key: 0, src: s.iconUrl, alt: s.displayName },
                                    null,
                                    8,
                                    L,
                                  ))
                                : (e(), a('i', A, '✦')),
                              t('div', null, [
                                t('h2', null, l(s.displayName), 1),
                                t('p', null, l(s.description || '持续维护的资源镜像站。'), 1),
                              ]),
                              t('strong', null, [
                                N(l(s.totalResources.toLocaleString()), 1),
                                o[0] || (o[0] = t('small', null, '资源', -1)),
                              ]),
                            ]),
                            _: 2,
                          },
                          1032,
                          ['id', 'to'],
                        )
                      ),
                    ),
                    128,
                  )),
                  p(i)?.length ? k('', !0) : (e(), a('p', D, '镜像站正在准备中。')),
                ]),
              ],
              64,
            )
          );
        }
      );
    },
  });
export { E as default };
