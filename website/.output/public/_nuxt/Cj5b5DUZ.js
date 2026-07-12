import {
  f as N,
  g as k,
  h as m,
  i as h,
  j as R,
  o as i,
  c as l,
  a as s,
  t as o,
  k as n,
  d as u,
  b as g,
  w as v,
  e as x,
  l as w,
  F as y,
  r as L,
  m as S,
  n as A,
  p as E,
  q as C,
} from './DMhcGZvP.js';
const D = { class: 'hero section-wrap' },
  P = { class: 'hero-copy' },
  B = { class: 'eyebrow' },
  O = { class: 'hero-subtitle' },
  V = { class: 'hero-actions' },
  M = ['href'],
  T = { class: 'section-wrap mirror-preview' },
  F = { class: 'section-heading' },
  I = { class: 'mirror-cards' },
  U = ['src', 'alt'],
  q = { key: 1, class: 'card-icon' },
  j = { key: 0, class: 'mirror-empty' },
  Q = N({
    __name: 'index',
    async setup(G) {
      let t, r;
      const _ = k(),
        f = E(),
        { data: c } =
          (([t, r] = m(() => h('website-home', () => _.getHome()))), (t = await t), r(), t),
        { data: b } =
          (([t, r] = m(() => h('website-mirrors', () => _.getMirrors()))), (t = await t), r(), t),
        d = C(() => ({
          eyebrow: String(c.value?.eyebrow || 'PERSONAL LEARNING PLATFORM'),
          title: String(
            c.value?.title ||
              `把每一次学习，
变成看得见的成长。`,
          ),
          subtitle: String(
            c.value?.subtitle ||
              '一个将课程、资源、3D 创作与协作串联起来的个人学习空间。更专注，也更自由。',
          ),
        }));
      return (
        R({
          title: '3D Personal Learning Platform — 让成长被看见',
          description: '聚合学习、3D 资源与创作协作的一体化个人学习平台。',
        }),
        (H, e) => {
          const p = x;
          return (
            i(),
            l(
              y,
              null,
              [
                s('section', D, [
                  s('div', P, [
                    s('p', B, o(n(d).eyebrow), 1),
                    s('h1', null, o(n(d).title), 1),
                    s('p', O, o(n(d).subtitle), 1),
                    s('div', V, [
                      s(
                        'a',
                        { class: 'button button-primary', href: n(f).public.appBase },
                        [...(e[0] || (e[0] = [u('开始学习 ', -1), s('span', null, '→', -1)]))],
                        8,
                        M,
                      ),
                      g(
                        p,
                        { class: 'button button-quiet', to: '/resources' },
                        { default: v(() => [...(e[1] || (e[1] = [u('探索资源', -1)]))]), _: 1 },
                      ),
                    ]),
                  ]),
                  e[2] ||
                    (e[2] = w(
                      '<div class="hero-art" aria-label="学习工作台示意图"><div class="orb orb-a"></div><div class="orb orb-b"></div><div class="glass-device"><span class="device-dot"></span><div class="device-line wide"></div><div class="device-line"></div><div class="device-grid"><i></i><i></i><i></i></div></div><div class="floating-card card-one"><b>01</b><span>学习路径</span></div><div class="floating-card card-two"><b>∞</b><span>持续积累</span></div></div>',
                      1,
                    )),
                ]),
                e[5] ||
                  (e[5] = w(
                    '<section class="section-wrap intro-grid"><p class="eyebrow">ONE QUIET PLACE</p><h2>从灵感，到掌握。<br>不必切换场景。</h2><p>整理课程、沉淀笔记、管理 3D 资源，在同一个简洁、连贯的工作空间里持续前进。</p></section><section class="section-wrap feature-grid"><article><span>01</span><h3>学习路径</h3><p>以清晰进度连接目标、课程与笔记，让学习自然形成系统。</p></article><article><span>02</span><h3>资源沉淀</h3><p>集中管理模型、素材与插件，资源不再散落在不同角落。</p></article><article><span>03</span><h3>协作创作</h3><p>让个人积累在需要时成为团队可以共享、讨论和推进的成果。</p></article></section>',
                    2,
                  )),
                s('section', T, [
                  s('div', F, [
                    e[4] ||
                      (e[4] = s(
                        'div',
                        null,
                        [
                          s('p', { class: 'eyebrow' }, 'MIRROR NETWORK'),
                          s('h2', null, '值得反复访问的资源。'),
                        ],
                        -1,
                      )),
                    g(
                      p,
                      { to: '/mirrors' },
                      {
                        default: v(() => [
                          ...(e[3] || (e[3] = [u('查看全部 ', -1), s('span', null, '→', -1)])),
                        ]),
                        _: 1,
                      },
                    ),
                  ]),
                  s('div', I, [
                    (i(!0),
                    l(
                      y,
                      null,
                      L(
                        n(b)?.slice(0, 3),
                        (a) => (
                          i(),
                          S(
                            p,
                            { key: a.id, class: 'mirror-card', to: `/mirrors/${a.id}` },
                            {
                              default: v(() => [
                                a.iconUrl
                                  ? (i(),
                                    l(
                                      'img',
                                      { key: 0, src: a.iconUrl, alt: a.displayName },
                                      null,
                                      8,
                                      U,
                                    ))
                                  : (i(), l('span', q, '✦')),
                                s('h3', null, o(a.displayName), 1),
                                s('p', null, o(a.description || '持续同步的精选学习资源。'), 1),
                                s(
                                  'small',
                                  null,
                                  o(a.totalResources.toLocaleString()) + ' 项资源',
                                  1,
                                ),
                              ]),
                              _: 2,
                            },
                            1032,
                            ['to'],
                          )
                        ),
                      ),
                      128,
                    )),
                    n(b)?.length ? A('', !0) : (i(), l('div', j, '镜像站正在准备中，敬请期待。')),
                  ]),
                ]),
              ],
              64,
            )
          );
        }
      );
    },
  });
export { Q as default };
