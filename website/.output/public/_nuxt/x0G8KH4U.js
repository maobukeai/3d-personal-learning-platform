import {
  e as c,
  c as a,
  a as e,
  d as r,
  F as o,
  r as u,
  o as i,
  h as d,
  t as n,
  l as m,
} from './HnPWE_ys.js';
import { a as f } from './C5KMDVPB.js';
import { _ } from './DlAUqK2U.js';
const h = { class: 'section-wrap destination-grid' },
  b = ['href'],
  g = c({
    __name: 'resources',
    setup(k) {
      const l = m(),
        p = [
          {
            number: '01',
            title: '3D 资产',
            description: '沉淀模型、场景与可复用的创作资产。',
            path: '/assets',
            mark: '◇',
          },
          {
            number: '02',
            title: '学习素材',
            description: '收藏教程、参考与创作过程中需要的素材。',
            path: '/materials',
            mark: '○',
          },
          {
            number: '03',
            title: '插件工具',
            description: '管理工作流中真正好用的插件与软件。',
            path: '/plugins',
            mark: '＋',
          },
          {
            number: '04',
            title: '临时网盘',
            description: '安全地存放、整理和分享阶段性文件。',
            path: '/temporary-netdisk',
            mark: '□',
          },
        ];
      return (
        f({
          title: '资源中心 — 3D Personal Learning Platform',
          description: '进入个人学习平台，管理所有创作与学习资源。',
        }),
        (E, s) => (
          i(),
          a(
            o,
            null,
            [
              s[1] ||
                (s[1] = e(
                  'section',
                  { class: 'page-heading section-wrap' },
                  [
                    e('p', { class: 'eyebrow' }, 'RESOURCE CENTER'),
                    e('h1', null, [r('把每一份积累，'), e('br'), r('留在恰当的位置。')]),
                    e(
                      'p',
                      null,
                      '资源中心服务于你的个人学习和创作工作台。镜像站的公开资源则独立陈列在“镜像站”页面。',
                    ),
                  ],
                  -1,
                )),
              e('section', h, [
                (i(),
                a(
                  o,
                  null,
                  u(p, (t) =>
                    e(
                      'a',
                      {
                        key: t.path,
                        class: 'destination-card',
                        href: `${d(l).public.appBase}${t.path}`,
                      },
                      [
                        e('span', null, n(t.number), 1),
                        e('i', null, n(t.mark), 1),
                        e('h2', null, n(t.title), 1),
                        e('p', null, n(t.description), 1),
                        s[0] || (s[0] = e('b', null, '进入工作台 →', -1)),
                      ],
                      8,
                      b,
                    ),
                  ),
                  64,
                )),
              ]),
            ],
            64,
          )
        )
      );
    },
  }),
  C = _(g, [['__scopeId', 'data-v-b917e7fa']]);
export { C as default };
