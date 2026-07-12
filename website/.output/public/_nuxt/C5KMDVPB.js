import { z as s, A as u, B as r, C as o, D as c, E as i } from './HnPWE_ys.js';
function a(t) {
  const e = t || u();
  return (
    e?.ssrContext?.head ||
    e?.runWithContext(() => {
      if (r()) return o(c);
    })
  );
}
function d(t, e = {}) {
  const n = a(e.nuxt);
  if (n) return i(t, { head: n, ...e });
}
function f(t, e = {}) {
  const n = a(e.nuxt);
  if (n) return s(t, { head: n, ...e });
}
export { f as a, d as u };
