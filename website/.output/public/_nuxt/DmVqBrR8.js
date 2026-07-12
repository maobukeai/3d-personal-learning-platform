import {
  f as c,
  j as u,
  c as a,
  a as e,
  d as r,
  F as o,
  r as d,
  o as i,
  k as m,
  t as n,
  p as f,
  _,
} from './DMhcGZvP.js';
const b = { class: 'section-wrap destination-grid' },
  h = ['href'],
  k = c({
    __name: 'resources',
    setup(g) {
      const l = f(),
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
        u({
          title: '资源中心 — 3D Personal Learning Platform',
          description: '进入个人学习平台，管理所有创作与学习资源。',
        }),
        (E, t) => (
          i(),
          a(
            o,
            null,
            [
              t[1] ||
                (t[1] = e(
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
              e('section', b, [
                (i(),
                a(
                  o,
                  null,
                  d(p, (s) =>
                    e(
                      'a',
                      {
                        key: s.path,
                        class: 'destination-card',
                        href: `${m(l).public.appBase}${s.path}`,
                      },
                      [
                        e('span', null, n(s.number), 1),
                        e('i', null, n(s.mark), 1),
                        e('h2', null, n(s.title), 1),
                        e('p', null, n(s.description), 1),
                        t[0] || (t[0] = e('b', null, '进入工作台 →', -1)),
                      ],
                      8,
                      h,
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
  y = _(k, [['__scopeId', 'data-v-abbe5dfd']]);
export { y as default };
