const __vite__mapDeps = (
  i,
  m = __vite__mapDeps,
  d = m.f ||
    (m.f = [
      './DL3tvOdn.js',
      './error-404.o50T1Yh0.css',
      './BKRDrXTh.js',
      './error-500.DdcU-NLM.css',
    ]),
) => i.map((i) => d[i]);
(function () {
  const t = document.createElement('link').relList;
  if (t && t.supports && t.supports('modulepreload')) return;
  for (const n of document.querySelectorAll('link[rel="modulepreload"]')) s(n);
  new MutationObserver((n) => {
    for (const o of n)
      if (o.type === 'childList')
        for (const i of o.addedNodes) i.tagName === 'LINK' && i.rel === 'modulepreload' && s(i);
  }).observe(document, { childList: !0, subtree: !0 });
  function r(n) {
    const o = {};
    return (
      n.integrity && (o.integrity = n.integrity),
      n.referrerPolicy && (o.referrerPolicy = n.referrerPolicy),
      n.crossOrigin === 'use-credentials'
        ? (o.credentials = 'include')
        : n.crossOrigin === 'anonymous'
          ? (o.credentials = 'omit')
          : (o.credentials = 'same-origin'),
      o
    );
  }
  function s(n) {
    if (n.ep) return;
    n.ep = !0;
    const o = r(n);
    fetch(n.href, o);
  }
})();
function W0(e) {
  const t = Object.create(null);
  for (const r of e.split(',')) t[r] = 1;
  return (r) => r in t;
}
const s2 = {},
  Ae = [],
  j2 = () => {},
  Es = () => !1,
  tt = (e) =>
    e.charCodeAt(0) === 111 &&
    e.charCodeAt(1) === 110 &&
    (e.charCodeAt(2) > 122 || e.charCodeAt(2) < 97),
  Tt = (e) => e.startsWith('onUpdate:'),
  g2 = Object.assign,
  Z0 = (e, t) => {
    const r = e.indexOf(t);
    r > -1 && e.splice(r, 1);
  },
  vo = Object.prototype.hasOwnProperty,
  J = (e, t) => vo.call(e, t),
  V = Array.isArray,
  ve = (e) => rt(e) === '[object Map]',
  bs = (e) => rt(e) === '[object Set]',
  Fr = (e) => rt(e) === '[object Date]',
  I = (e) => typeof e == 'function',
  i2 = (e) => typeof e == 'string',
  L2 = (e) => typeof e == 'symbol',
  X = (e) => e !== null && typeof e == 'object',
  ws = (e) => (X(e) || I(e)) && I(e.then) && I(e.catch),
  As = Object.prototype.toString,
  rt = (e) => As.call(e),
  xo = (e) => rt(e).slice(8, -1),
  vs = (e) => rt(e) === '[object Object]',
  Ht = (e) => i2(e) && e !== 'NaN' && e[0] !== '-' && '' + parseInt(e, 10) === e,
  le = W0(
    ',key,ref,ref_for,ref_key,onVnodeBeforeMount,onVnodeMounted,onVnodeBeforeUpdate,onVnodeUpdated,onVnodeBeforeUnmount,onVnodeUnmounted',
  ),
  Pt = (e) => {
    const t = Object.create(null);
    return (r) => t[r] || (t[r] = e(r));
  },
  Fo = /-\w/g,
  E2 = Pt((e) => e.replace(Fo, (t) => t.slice(1).toUpperCase())),
  ko = /\B([A-Z])/g,
  Ce = Pt((e) => e.replace(ko, '-$1').toLowerCase()),
  Rt = Pt((e) => e.charAt(0).toUpperCase() + e.slice(1)),
  Xt = Pt((e) => (e ? `on${Rt(e)}` : '')),
  V2 = (e, t) => !Object.is(e, t),
  Yt = (e, ...t) => {
    for (let r = 0; r < e.length; r++) e[r](...t);
  },
  xs = (e, t, r, s = !1) => {
    Object.defineProperty(e, t, { configurable: !0, enumerable: !1, writable: s, value: r });
  },
  Lo = (e) => {
    const t = parseFloat(e);
    return isNaN(t) ? e : t;
  },
  So = (e) => {
    const t = i2(e) ? Number(e) : NaN;
    return isNaN(t) ? e : t;
  };
let kr;
const Ot = () =>
  kr ||
  (kr =
    typeof globalThis < 'u'
      ? globalThis
      : typeof self < 'u'
        ? self
        : typeof window < 'u'
          ? window
          : typeof global < 'u'
            ? global
            : {});
function Ut(e) {
  if (V(e)) {
    const t = {};
    for (let r = 0; r < e.length; r++) {
      const s = e[r],
        n = i2(s) ? Po(s) : Ut(s);
      if (n) for (const o in n) t[o] = n[o];
    }
    return t;
  } else if (i2(e) || X(e)) return e;
}
const Mo = /;(?![^(]*\))/g,
  To = /:([^]+)/,
  Ho = /\/\*[^]*?\*\//g;
function Po(e) {
  const t = {};
  return (
    e
      .replace(Ho, '')
      .split(Mo)
      .forEach((r) => {
        if (r) {
          const s = r.split(To);
          s.length > 1 && (t[s[0].trim()] = s[1].trim());
        }
      }),
    t
  );
}
function It(e) {
  let t = '';
  if (i2(e)) t = e;
  else if (V(e))
    for (let r = 0; r < e.length; r++) {
      const s = It(e[r]);
      s && (t += s + ' ');
    }
  else if (X(e)) for (const r in e) e[r] && (t += r + ' ');
  return t.trim();
}
function Ro(e) {
  if (!e) return null;
  let { class: t, style: r } = e;
  return (t && !i2(t) && (e.class = It(t)), r && (e.style = Ut(r)), e);
}
const Oo = 'itemscope,allowfullscreen,formnovalidate,ismap,nomodule,novalidate,readonly',
  Uo = W0(Oo);
function Fs(e) {
  return !!e || e === '';
}
function Io(e, t) {
  if (e.length !== t.length) return !1;
  let r = !0;
  for (let s = 0; r && s < e.length; s++) r = q0(e[s], t[s]);
  return r;
}
function q0(e, t) {
  if (e === t) return !0;
  let r = Fr(e),
    s = Fr(t);
  if (r || s) return r && s ? e.getTime() === t.getTime() : !1;
  if (((r = L2(e)), (s = L2(t)), r || s)) return e === t;
  if (((r = V(e)), (s = V(t)), r || s)) return r && s ? Io(e, t) : !1;
  if (((r = X(e)), (s = X(t)), r || s)) {
    if (!r || !s) return !1;
    const n = Object.keys(e).length,
      o = Object.keys(t).length;
    if (n !== o) return !1;
    for (const i in e) {
      const a = e.hasOwnProperty(i),
        l = t.hasOwnProperty(i);
      if ((a && !l) || (!a && l) || !q0(e[i], t[i])) return !1;
    }
  }
  return String(e) === String(t);
}
const ks = (e) => !!(e && e.__v_isRef === !0),
  Ls = (e) =>
    i2(e)
      ? e
      : e == null
        ? ''
        : V(e) || (X(e) && (e.toString === As || !I(e.toString)))
          ? ks(e)
            ? Ls(e.value)
            : JSON.stringify(e, Ss, 2)
          : String(e),
  Ss = (e, t) =>
    ks(t)
      ? Ss(e, t.value)
      : ve(t)
        ? {
            [`Map(${t.size})`]: [...t.entries()].reduce(
              (r, [s, n], o) => ((r[Qt(s, o) + ' =>'] = n), r),
              {},
            ),
          }
        : bs(t)
          ? { [`Set(${t.size})`]: [...t.values()].map((r) => Qt(r)) }
          : L2(t)
            ? Qt(t)
            : X(t) && !V(t) && !vs(t)
              ? String(t)
              : t,
  Qt = (e, t = '') => {
    var r;
    return L2(e) ? `Symbol(${(r = e.description) != null ? r : t})` : e;
  };
let p2;
class Ms {
  constructor(t = !1) {
    ((this.detached = t),
      (this._active = !0),
      (this._on = 0),
      (this.effects = []),
      (this.cleanups = []),
      (this._isPaused = !1),
      (this._warnOnRun = !0),
      (this.__v_skip = !0),
      !t &&
        p2 &&
        (p2.active
          ? ((this.parent = p2), (this.index = (p2.scopes || (p2.scopes = [])).push(this) - 1))
          : ((this._active = !1), (this._warnOnRun = !1))));
  }
  get active() {
    return this._active;
  }
  pause() {
    if (this._active) {
      this._isPaused = !0;
      let t, r;
      if (this.scopes) for (t = 0, r = this.scopes.length; t < r; t++) this.scopes[t].pause();
      for (t = 0, r = this.effects.length; t < r; t++) this.effects[t].pause();
    }
  }
  resume() {
    if (this._active && this._isPaused) {
      this._isPaused = !1;
      let t, r;
      if (this.scopes) for (t = 0, r = this.scopes.length; t < r; t++) this.scopes[t].resume();
      for (t = 0, r = this.effects.length; t < r; t++) this.effects[t].resume();
    }
  }
  run(t) {
    if (this._active) {
      const r = p2;
      try {
        return ((p2 = this), t());
      } finally {
        p2 = r;
      }
    }
  }
  on() {
    ++this._on === 1 && ((this.prevScope = p2), (p2 = this));
  }
  off() {
    if (this._on > 0 && --this._on === 0) {
      if (p2 === this) p2 = this.prevScope;
      else {
        let t = p2;
        for (; t; ) {
          if (t.prevScope === this) {
            t.prevScope = this.prevScope;
            break;
          }
          t = t.prevScope;
        }
      }
      this.prevScope = void 0;
    }
  }
  stop(t) {
    if (this._active) {
      this._active = !1;
      let r, s;
      for (r = 0, s = this.effects.length; r < s; r++) this.effects[r].stop();
      for (this.effects.length = 0, r = 0, s = this.cleanups.length; r < s; r++) this.cleanups[r]();
      if (((this.cleanups.length = 0), this.scopes)) {
        for (r = 0, s = this.scopes.length; r < s; r++) this.scopes[r].stop(!0);
        this.scopes.length = 0;
      }
      if (!this.detached && this.parent && !t) {
        const n = this.parent.scopes.pop();
        n && n !== this && ((this.parent.scopes[this.index] = n), (n.index = this.index));
      }
      this.parent = void 0;
    }
  }
}
function No(e) {
  return new Ms(e);
}
function Ts() {
  return p2;
}
let r2;
const e0 = new WeakSet();
class Hs {
  constructor(t) {
    ((this.fn = t),
      (this.deps = void 0),
      (this.depsTail = void 0),
      (this.flags = 5),
      (this.next = void 0),
      (this.cleanup = void 0),
      (this.scheduler = void 0),
      p2 && (p2.active ? p2.effects.push(this) : (this.flags &= -2)));
  }
  pause() {
    this.flags |= 64;
  }
  resume() {
    this.flags & 64 && ((this.flags &= -65), e0.has(this) && (e0.delete(this), this.trigger()));
  }
  notify() {
    (this.flags & 2 && !(this.flags & 32)) || this.flags & 8 || Rs(this);
  }
  run() {
    if (!(this.flags & 1)) return this.fn();
    ((this.flags |= 2), Lr(this), Os(this));
    const t = r2,
      r = H2;
    ((r2 = this), (H2 = !0));
    try {
      return this.fn();
    } finally {
      (Us(this), (r2 = t), (H2 = r), (this.flags &= -3));
    }
  }
  stop() {
    if (this.flags & 1) {
      for (let t = this.deps; t; t = t.nextDep) z0(t);
      ((this.deps = this.depsTail = void 0),
        Lr(this),
        this.onStop && this.onStop(),
        (this.flags &= -2));
    }
  }
  trigger() {
    this.flags & 64 ? e0.add(this) : this.scheduler ? this.scheduler() : this.runIfDirty();
  }
  runIfDirty() {
    D0(this) && this.run();
  }
  get dirty() {
    return D0(this);
  }
}
let Ps = 0,
  je,
  Be;
function Rs(e, t = !1) {
  if (((e.flags |= 8), t)) {
    ((e.next = Be), (Be = e));
    return;
  }
  ((e.next = je), (je = e));
}
function K0() {
  Ps++;
}
function J0() {
  if (--Ps > 0) return;
  if (Be) {
    let t = Be;
    for (Be = void 0; t; ) {
      const r = t.next;
      ((t.next = void 0), (t.flags &= -9), (t = r));
    }
  }
  let e;
  for (; je; ) {
    let t = je;
    for (je = void 0; t; ) {
      const r = t.next;
      if (((t.next = void 0), (t.flags &= -9), t.flags & 1))
        try {
          t.trigger();
        } catch (s) {
          e || (e = s);
        }
      t = r;
    }
  }
  if (e) throw e;
}
function Os(e) {
  for (let t = e.deps; t; t = t.nextDep)
    ((t.version = -1), (t.prevActiveLink = t.dep.activeLink), (t.dep.activeLink = t));
}
function Us(e) {
  let t,
    r = e.depsTail,
    s = r;
  for (; s; ) {
    const n = s.prevDep;
    (s.version === -1 ? (s === r && (r = n), z0(s), Vo(s)) : (t = s),
      (s.dep.activeLink = s.prevActiveLink),
      (s.prevActiveLink = void 0),
      (s = n));
  }
  ((e.deps = t), (e.depsTail = r));
}
function D0(e) {
  for (let t = e.deps; t; t = t.nextDep)
    if (
      t.dep.version !== t.version ||
      (t.dep.computed && (Is(t.dep.computed) || t.dep.version !== t.version))
    )
      return !0;
  return !!e._dirty;
}
function Is(e) {
  if (
    (e.flags & 4 && !(e.flags & 16)) ||
    ((e.flags &= -17), e.globalVersion === qe) ||
    ((e.globalVersion = qe), !e.isSSR && e.flags & 128 && ((!e.deps && !e._dirty) || !D0(e)))
  )
    return;
  e.flags |= 2;
  const t = e.dep,
    r = r2,
    s = H2;
  ((r2 = e), (H2 = !0));
  try {
    Os(e);
    const n = e.fn(e._value);
    (t.version === 0 || V2(n, e._value)) && ((e.flags |= 128), (e._value = n), t.version++);
  } catch (n) {
    throw (t.version++, n);
  } finally {
    ((r2 = r), (H2 = s), Us(e), (e.flags &= -3));
  }
}
function z0(e, t = !1) {
  const { dep: r, prevSub: s, nextSub: n } = e;
  if (
    (s && ((s.nextSub = n), (e.prevSub = void 0)),
    n && ((n.prevSub = s), (e.nextSub = void 0)),
    r.subs === e && ((r.subs = s), !s && r.computed))
  ) {
    r.computed.flags &= -5;
    for (let o = r.computed.deps; o; o = o.nextDep) z0(o, !0);
  }
  !t && !--r.sc && r.map && r.map.delete(r.key);
}
function Vo(e) {
  const { prevDep: t, nextDep: r } = e;
  (t && ((t.nextDep = r), (e.prevDep = void 0)), r && ((r.prevDep = t), (e.nextDep = void 0)));
}
let H2 = !0;
const Ns = [];
function B2() {
  (Ns.push(H2), (H2 = !1));
}
function $2() {
  const e = Ns.pop();
  H2 = e === void 0 ? !0 : e;
}
function Lr(e) {
  const { cleanup: t } = e;
  if (((e.cleanup = void 0), t)) {
    const r = r2;
    r2 = void 0;
    try {
      t();
    } finally {
      r2 = r;
    }
  }
}
let qe = 0;
class jo {
  constructor(t, r) {
    ((this.sub = t),
      (this.dep = r),
      (this.version = r.version),
      (this.nextDep = this.prevDep = this.nextSub = this.prevSub = this.prevActiveLink = void 0));
  }
}
class X0 {
  constructor(t) {
    ((this.computed = t),
      (this.version = 0),
      (this.activeLink = void 0),
      (this.subs = void 0),
      (this.map = void 0),
      (this.key = void 0),
      (this.sc = 0),
      (this.__v_skip = !0));
  }
  track(t) {
    if (!r2 || !H2 || r2 === this.computed) return;
    let r = this.activeLink;
    if (r === void 0 || r.sub !== r2)
      ((r = this.activeLink = new jo(r2, this)),
        r2.deps
          ? ((r.prevDep = r2.depsTail), (r2.depsTail.nextDep = r), (r2.depsTail = r))
          : (r2.deps = r2.depsTail = r),
        Vs(r));
    else if (r.version === -1 && ((r.version = this.version), r.nextDep)) {
      const s = r.nextDep;
      ((s.prevDep = r.prevDep),
        r.prevDep && (r.prevDep.nextDep = s),
        (r.prevDep = r2.depsTail),
        (r.nextDep = void 0),
        (r2.depsTail.nextDep = r),
        (r2.depsTail = r),
        r2.deps === r && (r2.deps = s));
    }
    return r;
  }
  trigger(t) {
    (this.version++, qe++, this.notify(t));
  }
  notify(t) {
    K0();
    try {
      for (let r = this.subs; r; r = r.prevSub) r.sub.notify() && r.sub.dep.notify();
    } finally {
      J0();
    }
  }
}
function Vs(e) {
  if ((e.dep.sc++, e.sub.flags & 4)) {
    const t = e.dep.computed;
    if (t && !e.dep.subs) {
      t.flags |= 20;
      for (let s = t.deps; s; s = s.nextDep) Vs(s);
    }
    const r = e.dep.subs;
    (r !== e && ((e.prevSub = r), r && (r.nextSub = e)), (e.dep.subs = e));
  }
}
const Dt = new WeakMap(),
  ce = Symbol(''),
  y0 = Symbol(''),
  Ke = Symbol('');
function D2(e, t, r) {
  if (H2 && r2) {
    let s = Dt.get(e);
    s || Dt.set(e, (s = new Map()));
    let n = s.get(r);
    (n || (s.set(r, (n = new X0())), (n.map = s), (n.key = r)), n.track());
  }
}
function K2(e, t, r, s, n, o) {
  const i = Dt.get(e);
  if (!i) {
    qe++;
    return;
  }
  const a = (l) => {
    l && l.trigger();
  };
  if ((K0(), t === 'clear')) i.forEach(a);
  else {
    const l = V(e),
      d = l && Ht(r);
    if (l && r === 'length') {
      const c = Number(s);
      i.forEach((f, h) => {
        (h === 'length' || h === Ke || (!L2(h) && h >= c)) && a(f);
      });
    } else
      switch (((r !== void 0 || i.has(void 0)) && a(i.get(r)), d && a(i.get(Ke)), t)) {
        case 'add':
          l ? d && a(i.get('length')) : (a(i.get(ce)), ve(e) && a(i.get(y0)));
          break;
        case 'delete':
          l || (a(i.get(ce)), ve(e) && a(i.get(y0)));
          break;
        case 'set':
          ve(e) && a(i.get(ce));
          break;
      }
  }
  J0();
}
function Bo(e, t) {
  const r = Dt.get(e);
  return r && r.get(t);
}
function ye(e) {
  const t = K(e);
  return t === e ? t : (D2(t, 'iterate', Ke), k2(e) ? t : t.map(z2));
}
function Y0(e) {
  return (D2((e = K(e)), 'iterate', Ke), e);
}
function N2(e, t) {
  return J2(e) ? Je(fe(e) ? z2(t) : t) : z2(t);
}
const $o = {
  __proto__: null,
  [Symbol.iterator]() {
    return t0(this, Symbol.iterator, (e) => N2(this, e));
  },
  concat(...e) {
    return ye(this).concat(...e.map((t) => (V(t) ? ye(t) : t)));
  },
  entries() {
    return t0(this, 'entries', (e) => ((e[1] = N2(this, e[1])), e));
  },
  every(e, t) {
    return G2(this, 'every', e, t, void 0, arguments);
  },
  filter(e, t) {
    return G2(this, 'filter', e, t, (r) => r.map((s) => N2(this, s)), arguments);
  },
  find(e, t) {
    return G2(this, 'find', e, t, (r) => N2(this, r), arguments);
  },
  findIndex(e, t) {
    return G2(this, 'findIndex', e, t, void 0, arguments);
  },
  findLast(e, t) {
    return G2(this, 'findLast', e, t, (r) => N2(this, r), arguments);
  },
  findLastIndex(e, t) {
    return G2(this, 'findLastIndex', e, t, void 0, arguments);
  },
  forEach(e, t) {
    return G2(this, 'forEach', e, t, void 0, arguments);
  },
  includes(...e) {
    return r0(this, 'includes', e);
  },
  indexOf(...e) {
    return r0(this, 'indexOf', e);
  },
  join(e) {
    return ye(this).join(e);
  },
  lastIndexOf(...e) {
    return r0(this, 'lastIndexOf', e);
  },
  map(e, t) {
    return G2(this, 'map', e, t, void 0, arguments);
  },
  pop() {
    return Ue(this, 'pop');
  },
  push(...e) {
    return Ue(this, 'push', e);
  },
  reduce(e, ...t) {
    return Sr(this, 'reduce', e, t);
  },
  reduceRight(e, ...t) {
    return Sr(this, 'reduceRight', e, t);
  },
  shift() {
    return Ue(this, 'shift');
  },
  some(e, t) {
    return G2(this, 'some', e, t, void 0, arguments);
  },
  splice(...e) {
    return Ue(this, 'splice', e);
  },
  toReversed() {
    return ye(this).toReversed();
  },
  toSorted(e) {
    return ye(this).toSorted(e);
  },
  toSpliced(...e) {
    return ye(this).toSpliced(...e);
  },
  unshift(...e) {
    return Ue(this, 'unshift', e);
  },
  values() {
    return t0(this, 'values', (e) => N2(this, e));
  },
};
function t0(e, t, r) {
  const s = Y0(e),
    n = s[t]();
  return (
    s !== e &&
      !k2(e) &&
      ((n._next = n.next),
      (n.next = () => {
        const o = n._next();
        return (o.done || (o.value = r(o.value)), o);
      })),
    n
  );
}
const Go = Array.prototype;
function G2(e, t, r, s, n, o) {
  const i = Y0(e),
    a = i !== e && !k2(e),
    l = i[t];
  if (l !== Go[t]) {
    const f = l.apply(e, o);
    return a ? z2(f) : f;
  }
  let d = r;
  i !== e &&
    (a
      ? (d = function (f, h) {
          return r.call(this, N2(e, f), h, e);
        })
      : r.length > 2 &&
        (d = function (f, h) {
          return r.call(this, f, h, e);
        }));
  const c = l.call(i, d, s);
  return a && n ? n(c) : c;
}
function Sr(e, t, r, s) {
  const n = Y0(e),
    o = n !== e && !k2(e);
  let i = r,
    a = !1;
  n !== e &&
    (o
      ? ((a = s.length === 0),
        (i = function (d, c, f) {
          return (a && ((a = !1), (d = N2(e, d))), r.call(this, d, N2(e, c), f, e));
        }))
      : r.length > 3 &&
        (i = function (d, c, f) {
          return r.call(this, d, c, f, e);
        }));
  const l = n[t](i, ...s);
  return a ? N2(e, l) : l;
}
function r0(e, t, r) {
  const s = K(e);
  D2(s, 'iterate', Ke);
  const n = s[t](...r);
  return (n === -1 || n === !1) && Nt(r[0]) ? ((r[0] = K(r[0])), s[t](...r)) : n;
}
function Ue(e, t, r = []) {
  (B2(), K0());
  const s = K(e)[t].apply(e, r);
  return (J0(), $2(), s);
}
const Wo = W0('__proto__,__v_isRef,__isVue'),
  js = new Set(
    Object.getOwnPropertyNames(Symbol)
      .filter((e) => e !== 'arguments' && e !== 'caller')
      .map((e) => Symbol[e])
      .filter(L2),
  );
function Zo(e) {
  L2(e) || (e = String(e));
  const t = K(this);
  return (D2(t, 'has', e), t.hasOwnProperty(e));
}
class Bs {
  constructor(t = !1, r = !1) {
    ((this._isReadonly = t), (this._isShallow = r));
  }
  get(t, r, s) {
    if (r === '__v_skip') return t.__v_skip;
    const n = this._isReadonly,
      o = this._isShallow;
    if (r === '__v_isReactive') return !n;
    if (r === '__v_isReadonly') return n;
    if (r === '__v_isShallow') return o;
    if (r === '__v_raw')
      return s === (n ? (o ? ri : Zs) : o ? Ws : Gs).get(t) ||
        Object.getPrototypeOf(t) === Object.getPrototypeOf(s)
        ? t
        : void 0;
    const i = V(t);
    if (!n) {
      let l;
      if (i && (l = $o[r])) return l;
      if (r === 'hasOwnProperty') return Zo;
    }
    const a = Reflect.get(t, r, f2(t) ? t : s);
    if ((L2(r) ? js.has(r) : Wo(r)) || (n || D2(t, 'get', r), o)) return a;
    if (f2(a)) {
      const l = i && Ht(r) ? a : a.value;
      return n && X(l) ? m0(l) : l;
    }
    return X(a) ? (n ? m0(a) : re(a)) : a;
  }
}
class $s extends Bs {
  constructor(t = !1) {
    super(!1, t);
  }
  set(t, r, s, n) {
    let o = t[r];
    const i = V(t) && Ht(r);
    if (!this._isShallow) {
      const d = J2(o);
      if ((!k2(s) && !J2(s) && ((o = K(o)), (s = K(s))), !i && f2(o) && !f2(s)))
        return (d || (o.value = s), !0);
    }
    const a = i ? Number(r) < t.length : J(t, r),
      l = Reflect.set(t, r, s, f2(t) ? t : n);
    return (t === K(n) && l && (a ? V2(s, o) && K2(t, 'set', r, s) : K2(t, 'add', r, s)), l);
  }
  deleteProperty(t, r) {
    const s = J(t, r);
    t[r];
    const n = Reflect.deleteProperty(t, r);
    return (n && s && K2(t, 'delete', r, void 0), n);
  }
  has(t, r) {
    const s = Reflect.has(t, r);
    return ((!L2(r) || !js.has(r)) && D2(t, 'has', r), s);
  }
  ownKeys(t) {
    return (D2(t, 'iterate', V(t) ? 'length' : ce), Reflect.ownKeys(t));
  }
}
class qo extends Bs {
  constructor(t = !1) {
    super(!0, t);
  }
  set(t, r) {
    return !0;
  }
  deleteProperty(t, r) {
    return !0;
  }
}
const Ko = new $s(),
  Jo = new qo(),
  zo = new $s(!0);
const _0 = (e) => e,
  it = (e) => Reflect.getPrototypeOf(e);
function Xo(e, t, r) {
  return function (...s) {
    const n = this.__v_raw,
      o = K(n),
      i = ve(o),
      a = e === 'entries' || (e === Symbol.iterator && i),
      l = e === 'keys' && i,
      d = n[e](...s),
      c = r ? _0 : t ? Je : z2;
    return (
      !t && D2(o, 'iterate', l ? y0 : ce),
      g2(Object.create(d), {
        next() {
          const { value: f, done: h } = d.next();
          return h ? { value: f, done: h } : { value: a ? [c(f[0]), c(f[1])] : c(f), done: h };
        },
      })
    );
  };
}
function at(e) {
  return function (...t) {
    return e === 'delete' ? !1 : e === 'clear' ? void 0 : this;
  };
}
function Yo(e, t) {
  const r = {
    get(n) {
      const o = this.__v_raw,
        i = K(o),
        a = K(n);
      e || (V2(n, a) && D2(i, 'get', n), D2(i, 'get', a));
      const { has: l } = it(i),
        d = t ? _0 : e ? Je : z2;
      if (l.call(i, n)) return d(o.get(n));
      if (l.call(i, a)) return d(o.get(a));
      o !== i && o.get(n);
    },
    get size() {
      const n = this.__v_raw;
      return (!e && D2(K(n), 'iterate', ce), n.size);
    },
    has(n) {
      const o = this.__v_raw,
        i = K(o),
        a = K(n);
      return (
        e || (V2(n, a) && D2(i, 'has', n), D2(i, 'has', a)),
        n === a ? o.has(n) : o.has(n) || o.has(a)
      );
    },
    forEach(n, o) {
      const i = this,
        a = i.__v_raw,
        l = K(a),
        d = t ? _0 : e ? Je : z2;
      return (!e && D2(l, 'iterate', ce), a.forEach((c, f) => n.call(o, d(c), d(f), i)));
    },
  };
  return (
    g2(
      r,
      e
        ? { add: at('add'), set: at('set'), delete: at('delete'), clear: at('clear') }
        : {
            add(n) {
              const o = K(this),
                i = it(o),
                a = K(n),
                l = !t && !k2(n) && !J2(n) ? a : n;
              return (
                i.has.call(o, l) ||
                  (V2(n, l) && i.has.call(o, n)) ||
                  (V2(a, l) && i.has.call(o, a)) ||
                  (o.add(l), K2(o, 'add', l, l)),
                this
              );
            },
            set(n, o) {
              !t && !k2(o) && !J2(o) && (o = K(o));
              const i = K(this),
                { has: a, get: l } = it(i);
              let d = a.call(i, n);
              d || ((n = K(n)), (d = a.call(i, n)));
              const c = l.call(i, n);
              return (i.set(n, o), d ? V2(o, c) && K2(i, 'set', n, o) : K2(i, 'add', n, o), this);
            },
            delete(n) {
              const o = K(this),
                { has: i, get: a } = it(o);
              let l = i.call(o, n);
              (l || ((n = K(n)), (l = i.call(o, n))), a && a.call(o, n));
              const d = o.delete(n);
              return (l && K2(o, 'delete', n, void 0), d);
            },
            clear() {
              const n = K(this),
                o = n.size !== 0,
                i = n.clear();
              return (o && K2(n, 'clear', void 0, void 0), i);
            },
          },
    ),
    ['keys', 'values', 'entries', Symbol.iterator].forEach((n) => {
      r[n] = Xo(n, e, t);
    }),
    r
  );
}
function Q0(e, t) {
  const r = Yo(e, t);
  return (s, n, o) =>
    n === '__v_isReactive'
      ? !e
      : n === '__v_isReadonly'
        ? e
        : n === '__v_raw'
          ? s
          : Reflect.get(J(r, n) && n in s ? r : s, n, o);
}
const Qo = { get: Q0(!1, !1) },
  ei = { get: Q0(!1, !0) },
  ti = { get: Q0(!0, !1) };
const Gs = new WeakMap(),
  Ws = new WeakMap(),
  Zs = new WeakMap(),
  ri = new WeakMap();
function si(e) {
  switch (e) {
    case 'Object':
    case 'Array':
      return 1;
    case 'Map':
    case 'Set':
    case 'WeakMap':
    case 'WeakSet':
      return 2;
    default:
      return 0;
  }
}
function re(e) {
  return J2(e) ? e : er(e, !1, Ko, Qo, Gs);
}
function be(e) {
  return er(e, !1, zo, ei, Ws);
}
function m0(e) {
  return er(e, !0, Jo, ti, Zs);
}
function er(e, t, r, s, n) {
  if (!X(e) || (e.__v_raw && !(t && e.__v_isReactive)) || e.__v_skip || !Object.isExtensible(e))
    return e;
  const o = n.get(e);
  if (o) return o;
  const i = si(xo(e));
  if (i === 0) return e;
  const a = new Proxy(e, i === 2 ? s : r);
  return (n.set(e, a), a);
}
function fe(e) {
  return J2(e) ? fe(e.__v_raw) : !!(e && e.__v_isReactive);
}
function J2(e) {
  return !!(e && e.__v_isReadonly);
}
function k2(e) {
  return !!(e && e.__v_isShallow);
}
function Nt(e) {
  return e ? !!e.__v_raw : !1;
}
function K(e) {
  const t = e && e.__v_raw;
  return t ? K(t) : e;
}
function ni(e) {
  return (!J(e, '__v_skip') && Object.isExtensible(e) && xs(e, '__v_skip', !0), e);
}
const z2 = (e) => (X(e) ? re(e) : e),
  Je = (e) => (X(e) ? m0(e) : e);
function f2(e) {
  return e ? e.__v_isRef === !0 : !1;
}
function ue(e) {
  return qs(e, !1);
}
function Mr(e) {
  return qs(e, !0);
}
function qs(e, t) {
  return f2(e) ? e : new oi(e, t);
}
class oi {
  constructor(t, r) {
    ((this.dep = new X0()),
      (this.__v_isRef = !0),
      (this.__v_isShallow = !1),
      (this._rawValue = r ? t : K(t)),
      (this._value = r ? t : z2(t)),
      (this.__v_isShallow = r));
  }
  get value() {
    return (this.dep.track(), this._value);
  }
  set value(t) {
    const r = this._rawValue,
      s = this.__v_isShallow || k2(t) || J2(t);
    ((t = s ? t : K(t)),
      V2(t, r) && ((this._rawValue = t), (this._value = s ? t : z2(t)), this.dep.trigger()));
  }
}
function a2(e) {
  return f2(e) ? e.value : e;
}
function ii(e) {
  return I(e) ? e() : a2(e);
}
const ai = {
  get: (e, t, r) => (t === '__v_raw' ? e : a2(Reflect.get(e, t, r))),
  set: (e, t, r, s) => {
    const n = e[t];
    return f2(n) && !f2(r) ? ((n.value = r), !0) : Reflect.set(e, t, r, s);
  },
};
function Ks(e) {
  return fe(e) ? e : new Proxy(e, ai);
}
class li {
  constructor(t, r, s) {
    ((this._object = t),
      (this._defaultValue = s),
      (this.__v_isRef = !0),
      (this._value = void 0),
      (this._key = L2(r) ? r : String(r)),
      (this._raw = K(t)));
    let n = !0,
      o = t;
    if (!V(t) || L2(this._key) || !Ht(this._key))
      do n = !Nt(o) || k2(o);
      while (n && (o = o.__v_raw));
    this._shallow = n;
  }
  get value() {
    let t = this._object[this._key];
    return (this._shallow && (t = a2(t)), (this._value = t === void 0 ? this._defaultValue : t));
  }
  set value(t) {
    if (this._shallow && f2(this._raw[this._key])) {
      const r = this._object[this._key];
      if (f2(r)) {
        r.value = t;
        return;
      }
    }
    this._object[this._key] = t;
  }
  get dep() {
    return Bo(this._raw, this._key);
  }
}
class ci {
  constructor(t) {
    ((this._getter = t), (this.__v_isRef = !0), (this.__v_isReadonly = !0), (this._value = void 0));
  }
  get value() {
    return (this._value = this._getter());
  }
}
function fi(e, t, r) {
  return f2(e) ? e : I(e) ? new ci(e) : X(e) && arguments.length > 1 ? ui(e, t, r) : ue(e);
}
function ui(e, t, r) {
  return new li(e, t, r);
}
class di {
  constructor(t, r, s) {
    ((this.fn = t),
      (this.setter = r),
      (this._value = void 0),
      (this.dep = new X0(this)),
      (this.__v_isRef = !0),
      (this.deps = void 0),
      (this.depsTail = void 0),
      (this.flags = 16),
      (this.globalVersion = qe - 1),
      (this.next = void 0),
      (this.effect = this),
      (this.__v_isReadonly = !r),
      (this.isSSR = s));
  }
  notify() {
    if (((this.flags |= 16), !(this.flags & 8) && r2 !== this)) return (Rs(this, !0), !0);
  }
  get value() {
    const t = this.dep.track();
    return (Is(this), t && (t.version = this.dep.version), this._value);
  }
  set value(t) {
    this.setter && this.setter(t);
  }
}
function pi(e, t, r = !1) {
  let s, n;
  return (I(e) ? (s = e) : ((s = e.get), (n = e.set)), new di(s, n, r));
}
const lt = {},
  yt = new WeakMap();
let ie;
function hi(e, t = !1, r = ie) {
  if (r) {
    let s = yt.get(r);
    (s || yt.set(r, (s = [])), s.push(e));
  }
}
function gi(e, t, r = s2) {
  const { immediate: s, deep: n, once: o, scheduler: i, augmentJob: a, call: l } = r,
    d = (_) => (n ? _ : k2(_) || n === !1 || n === 0 ? ee(_, 1) : ee(_));
  let c,
    f,
    h,
    p,
    C = !1,
    D = !1;
  if (
    (f2(e)
      ? ((f = () => e.value), (C = k2(e)))
      : fe(e)
        ? ((f = () => d(e)), (C = !0))
        : V(e)
          ? ((D = !0),
            (C = e.some((_) => fe(_) || k2(_))),
            (f = () =>
              e.map((_) => {
                if (f2(_)) return _.value;
                if (fe(_)) return d(_);
                if (I(_)) return l ? l(_, 2) : _();
              })))
          : I(e)
            ? t
              ? (f = l ? () => l(e, 2) : e)
              : (f = () => {
                  if (h) {
                    B2();
                    try {
                      h();
                    } finally {
                      $2();
                    }
                  }
                  const _ = ie;
                  ie = c;
                  try {
                    return l ? l(e, 3, [p]) : e(p);
                  } finally {
                    ie = _;
                  }
                })
            : (f = j2),
    t && n)
  ) {
    const _ = f,
      E = n === !0 ? 1 / 0 : n;
    f = () => ee(_(), E);
  }
  const M = Ts(),
    x = () => {
      (c.stop(), M && M.active && Z0(M.effects, c));
    };
  if (o && t) {
    const _ = t;
    t = (...E) => {
      const H = _(...E);
      return (x(), H);
    };
  }
  let S = D ? new Array(e.length).fill(lt) : lt;
  const y = (_) => {
    if (!(!(c.flags & 1) || (!c.dirty && !_)))
      if (t) {
        const E = c.run();
        if (_ || n || C || (D ? E.some((H, U) => V2(H, S[U])) : V2(E, S))) {
          h && h();
          const H = ie;
          ie = c;
          try {
            const U = [E, S === lt ? void 0 : D && S[0] === lt ? [] : S, p];
            ((S = E), l ? l(t, 3, U) : t(...U));
          } finally {
            ie = H;
          }
        }
      } else c.run();
  };
  return (
    a && a(y),
    (c = new Hs(f)),
    (c.scheduler = i ? () => i(y, !1) : y),
    (p = (_) => hi(_, !1, c)),
    (h = c.onStop =
      () => {
        const _ = yt.get(c);
        if (_) {
          if (l) l(_, 4);
          else for (const E of _) E();
          yt.delete(c);
        }
      }),
    t ? (s ? y(!0) : (S = c.run())) : i ? i(y.bind(null, !0), !0) : c.run(),
    (x.pause = c.pause.bind(c)),
    (x.resume = c.resume.bind(c)),
    (x.stop = x),
    x
  );
}
function ee(e, t = 1 / 0, r) {
  if (t <= 0 || !X(e) || e.__v_skip || ((r = r || new Map()), (r.get(e) || 0) >= t)) return e;
  if ((r.set(e, t), t--, f2(e))) ee(e.value, t, r);
  else if (V(e)) for (let s = 0; s < e.length; s++) ee(e[s], t, r);
  else if (bs(e) || ve(e))
    e.forEach((s) => {
      ee(s, t, r);
    });
  else if (vs(e)) {
    for (const s in e) ee(e[s], t, r);
    for (const s of Object.getOwnPropertySymbols(e))
      Object.prototype.propertyIsEnumerable.call(e, s) && ee(e[s], t, r);
  }
  return e;
}
function st(e, t, r, s) {
  try {
    return s ? e(...s) : e();
  } catch (n) {
    He(n, t, r);
  }
}
function P2(e, t, r, s) {
  if (I(e)) {
    const n = st(e, t, r, s);
    return (
      n &&
        ws(n) &&
        n.catch((o) => {
          He(o, t, r);
        }),
      n
    );
  }
  if (V(e)) {
    const n = [];
    for (let o = 0; o < e.length; o++) n.push(P2(e[o], t, r, s));
    return n;
  }
}
function He(e, t, r, s = !0) {
  const n = t ? t.vnode : null,
    { errorHandler: o, throwUnhandledErrorInProduction: i } = (t && t.appContext.config) || s2;
  if (t) {
    let a = t.parent;
    const l = t.proxy,
      d = `https://vuejs.org/error-reference/#runtime-${r}`;
    for (; a; ) {
      const c = a.ec;
      if (c) {
        for (let f = 0; f < c.length; f++) if (c[f](e, l, d) === !1) return;
      }
      a = a.parent;
    }
    if (o) {
      (B2(), st(o, null, 10, [e, l, d]), $2());
      return;
    }
  }
  Ci(e, r, n, s, i);
}
function Ci(e, t, r, s = !0, n = !1) {
  if (n) throw e;
  console.error(e);
}
const m2 = [];
let U2 = -1;
const xe = [];
let Q2 = null,
  me = 0;
const Js = Promise.resolve();
let _t = null;
function zs(e) {
  const t = _t || Js;
  return e ? t.then(this ? e.bind(this) : e) : t;
}
function Di(e) {
  let t = U2 + 1,
    r = m2.length;
  for (; t < r; ) {
    const s = (t + r) >>> 1,
      n = m2[s],
      o = ze(n);
    o < e || (o === e && n.flags & 2) ? (t = s + 1) : (r = s);
  }
  return t;
}
function tr(e) {
  if (!(e.flags & 1)) {
    const t = ze(e),
      r = m2[m2.length - 1];
    (!r || (!(e.flags & 2) && t >= ze(r)) ? m2.push(e) : m2.splice(Di(t), 0, e),
      (e.flags |= 1),
      Xs());
  }
}
function Xs() {
  _t || (_t = Js.then(Ys));
}
function E0(e) {
  (V(e)
    ? xe.push(...e)
    : Q2 && e.id === -1
      ? Q2.splice(me + 1, 0, e)
      : e.flags & 1 || (xe.push(e), (e.flags |= 1)),
    Xs());
}
function Tr(e, t, r = U2 + 1) {
  for (; r < m2.length; r++) {
    const s = m2[r];
    if (s && s.flags & 2) {
      if (e && s.id !== e.uid) continue;
      (m2.splice(r, 1), r--, s.flags & 4 && (s.flags &= -2), s(), s.flags & 4 || (s.flags &= -2));
    }
  }
}
function mt(e) {
  if (xe.length) {
    const t = [...new Set(xe)].sort((r, s) => ze(r) - ze(s));
    if (((xe.length = 0), Q2)) {
      Q2.push(...t);
      return;
    }
    for (Q2 = t, me = 0; me < Q2.length; me++) {
      const r = Q2[me];
      (r.flags & 4 && (r.flags &= -2), r.flags & 8 || r(), (r.flags &= -2));
    }
    ((Q2 = null), (me = 0));
  }
}
const ze = (e) => (e.id == null ? (e.flags & 2 ? -1 : 1 / 0) : e.id);
function Ys(e) {
  try {
    for (U2 = 0; U2 < m2.length; U2++) {
      const t = m2[U2];
      t &&
        !(t.flags & 8) &&
        (t.flags & 4 && (t.flags &= -2), st(t, t.i, t.i ? 15 : 14), t.flags & 4 || (t.flags &= -2));
    }
  } finally {
    for (; U2 < m2.length; U2++) {
      const t = m2[U2];
      t && (t.flags &= -2);
    }
    ((U2 = -1), (m2.length = 0), mt(), (_t = null), (m2.length || xe.length) && Ys());
  }
}
let T2 = null,
  Qs = null;
function Et(e) {
  const t = T2;
  return ((T2 = e), (Qs = (e && e.type.__scopeId) || null), t);
}
function en(e, t = T2, r) {
  if (!t || e._n) return e;
  const s = (...n) => {
    s._d && vt(-1);
    const o = Et(t);
    let i;
    try {
      i = e(...n);
    } finally {
      (Et(o), s._d && vt(1));
    }
    return i;
  };
  return ((s._n = !0), (s._c = !0), (s._d = !0), s);
}
function I2(e, t, r, s) {
  const n = e.dirs,
    o = t && t.dirs;
  for (let i = 0; i < n.length; i++) {
    const a = n[i];
    o && (a.oldValue = o[i].value);
    let l = a.dir[s];
    l && (B2(), P2(l, r, 8, [e.el, a, e, t]), $2());
  }
}
function tn(e, t) {
  if (h2) {
    let r = h2.provides;
    const s = h2.parent && h2.parent.provides;
    (s === r && (r = h2.provides = Object.create(s)), (r[e] = t));
  }
}
function de(e, t, r = !1) {
  const s = Gt();
  if (s || pe) {
    let n = pe
      ? pe._context.provides
      : s
        ? s.parent == null || s.ce
          ? s.vnode.appContext && s.vnode.appContext.provides
          : s.parent.provides
        : void 0;
    if (n && e in n) return n[e];
    if (arguments.length > 1) return r && I(t) ? t.call(s && s.proxy) : t;
  }
}
function Vt() {
  return !!(Gt() || pe);
}
const yi = Symbol.for('v-scx'),
  _i = () => de(yi);
function mi(e, t) {
  return rr(e, null, t);
}
function s0(e, t, r) {
  return rr(e, t, r);
}
function rr(e, t, r = s2) {
  const { immediate: s, deep: n, flush: o, once: i } = r,
    a = g2({}, r),
    l = (t && s) || (!t && o !== 'post');
  let d;
  if (Te) {
    if (o === 'sync') {
      const p = _i();
      d = p.__watcherHandles || (p.__watcherHandles = []);
    } else if (!l) {
      const p = () => {};
      return ((p.stop = j2), (p.resume = j2), (p.pause = j2), p);
    }
  }
  const c = h2;
  a.call = (p, C, D) => P2(p, c, C, D);
  let f = !1;
  (o === 'post'
    ? (a.scheduler = (p) => {
        _2(p, c && c.suspense);
      })
    : o !== 'sync' &&
      ((f = !0),
      (a.scheduler = (p, C) => {
        C ? p() : tr(p);
      })),
    (a.augmentJob = (p) => {
      (t && (p.flags |= 4), f && ((p.flags |= 2), c && ((p.id = c.uid), (p.i = c))));
    }));
  const h = gi(e, t, a);
  return (Te && (d ? d.push(h) : l && h()), h);
}
function Ei(e, t, r) {
  const s = this.proxy,
    n = i2(e) ? (e.includes('.') ? rn(s, e) : () => s[e]) : e.bind(s, s);
  let o;
  I(t) ? (o = t) : ((o = t.handler), (r = t));
  const i = nt(this),
    a = rr(n, o.bind(s), r);
  return (i(), a);
}
function rn(e, t) {
  const r = t.split('.');
  return () => {
    let s = e;
    for (let n = 0; n < r.length && s; n++) s = s[r[n]];
    return s;
  };
}
const bi = Symbol('_vte'),
  wi = (e) => e.__isTeleport,
  n0 = Symbol('_leaveCb');
function sr(e, t) {
  e.shapeFlag & 6 && e.component
    ? ((e.transition = t), sr(e.component.subTree, t))
    : e.shapeFlag & 128
      ? ((e.ssContent.transition = t.clone(e.ssContent)),
        (e.ssFallback.transition = t.clone(e.ssFallback)))
      : (e.transition = t);
}
function sn(e, t) {
  return I(e) ? g2({ name: e.name }, t, { setup: e }) : e;
}
function nr(e) {
  e.ids = [e.ids[0] + e.ids[2]++ + '-', 0, 0];
}
function Hr(e, t) {
  let r;
  return !!((r = Object.getOwnPropertyDescriptor(e, t)) && !r.configurable);
}
const bt = new WeakMap();
function Fe(e, t, r, s, n = !1) {
  if (V(e)) {
    e.forEach((D, M) => Fe(D, t && (V(t) ? t[M] : t), r, s, n));
    return;
  }
  if (ke(s) && !n) {
    s.shapeFlag & 512 &&
      s.type.__asyncResolved &&
      s.component.subTree.component &&
      Fe(e, t, r, s.component.subTree);
    return;
  }
  const o = s.shapeFlag & 4 ? fr(s.component) : s.el,
    i = n ? null : o,
    { i: a, r: l } = e,
    d = t && t.r,
    c = a.refs === s2 ? (a.refs = {}) : a.refs,
    f = a.setupState,
    h = K(f),
    p = f === s2 ? Es : (D) => (Hr(c, D) ? !1 : J(h, D)),
    C = (D, M) => !(M && Hr(c, M));
  if (d != null && d !== l) {
    if ((Pr(t), i2(d))) ((c[d] = null), p(d) && (f[d] = null));
    else if (f2(d)) {
      const D = t;
      (C(d, D.k) && (d.value = null), D.k && (c[D.k] = null));
    }
  }
  if (I(l)) {
    B2();
    try {
      st(l, a, 12, [i, c]);
    } finally {
      $2();
    }
  } else {
    const D = i2(l),
      M = f2(l);
    if (D || M) {
      const x = () => {
        if (e.f) {
          const S = D ? (p(l) ? f[l] : c[l]) : C() || !e.k ? l.value : c[e.k];
          if (n) V(S) && Z0(S, o);
          else if (V(S)) S.includes(o) || S.push(o);
          else if (D) ((c[l] = [o]), p(l) && (f[l] = c[l]));
          else {
            const y = [o];
            (C(l, e.k) && (l.value = y), e.k && (c[e.k] = y));
          }
        } else
          D
            ? ((c[l] = i), p(l) && (f[l] = i))
            : M && (C(l, e.k) && (l.value = i), e.k && (c[e.k] = i));
      };
      if (i) {
        const S = () => {
          (x(), bt.delete(e));
        };
        ((S.id = -1), bt.set(e, S), _2(S, r));
      } else (Pr(e), x());
    }
  }
}
function Pr(e) {
  const t = bt.get(e);
  t && ((t.flags |= 8), bt.delete(e));
}
let Rr = !1;
const _e = () => {
    Rr || (console.error('Hydration completed but contains mismatches.'), (Rr = !0));
  },
  Ai = (e) => e.namespaceURI.includes('svg') && e.tagName !== 'foreignObject',
  vi = (e) => e.namespaceURI.includes('MathML'),
  ct = (e) => {
    if (e.nodeType === 1) {
      if (Ai(e)) return 'svg';
      if (vi(e)) return 'mathml';
    }
  },
  we = (e) => e.nodeType === 8;
function xi(e) {
  const {
      mt: t,
      p: r,
      o: {
        patchProp: s,
        createText: n,
        nextSibling: o,
        parentNode: i,
        remove: a,
        insert: l,
        createComment: d,
      },
    } = e,
    c = (y, _) => {
      if (!_.hasChildNodes()) {
        (r(null, y, _), mt(), (_._vnode = y));
        return;
      }
      (f(_.firstChild, y, null, null, null), mt(), (_._vnode = y));
    },
    f = (y, _, E, H, U, $ = !1) => {
      $ = $ || !!_.dynamicChildren;
      const W = we(y) && y.data === '[',
        j = () => D(y, _, E, H, U, W),
        { type: G, ref: z, shapeFlag: Y, patchFlag: n2 } = _;
      let l2 = y.nodeType;
      ((_.el = y), n2 === -2 && (($ = !1), (_.dynamicChildren = null)));
      let R = null;
      switch (G) {
        case he:
          l2 !== 3
            ? _.children === ''
              ? (l((_.el = n('')), i(y), y), (R = y))
              : (R = j())
            : (y.data !== _.children && (_e(), (y.data = _.children)), (R = o(y)));
          break;
        case X2:
          S(y)
            ? ((R = o(y)), x((_.el = y.content.firstChild), y, E))
            : l2 !== 8 || W
              ? (R = j())
              : (R = o(y));
          break;
        case Ge:
          if ((W && ((y = o(y)), (l2 = y.nodeType)), l2 === 1 || l2 === 3)) {
            R = y;
            const Z = !_.children.length;
            for (let B = 0; B < _.staticCount; B++)
              (Z && (_.children += R.nodeType === 1 ? R.outerHTML : R.data),
                B === _.staticCount - 1 && (_.anchor = R),
                (R = o(R)));
            return W ? o(R) : R;
          } else j();
          break;
        case M2:
          W ? (R = C(y, _, E, H, U, $)) : (R = j());
          break;
        default:
          if (Y & 1)
            (l2 !== 1 || _.type.toLowerCase() !== y.tagName.toLowerCase()) && !S(y)
              ? (R = j())
              : (R = h(y, _, E, H, U, $));
          else if (Y & 6) {
            _.slotScopeIds = U;
            const Z = i(y);
            if (
              (W
                ? (R = M(y))
                : we(y) && y.data === 'teleport start'
                  ? (R = M(y, y.data, 'teleport end'))
                  : (R = o(y)),
              t(_, Z, null, E, H, ct(Z), $),
              ke(_) && !_.type.__asyncResolved)
            ) {
              let B;
              (W
                ? ((B = d2(M2)), (B.anchor = R ? R.previousSibling : Z.lastChild))
                : (B = y.nodeType === 3 ? Nn('') : d2('div')),
                (B.el = y),
                (_.component.subTree = B));
            }
          } else
            Y & 64
              ? l2 !== 8
                ? (R = j())
                : (R = _.type.hydrate(y, _, E, H, U, $, e, p))
              : Y & 128 && (R = _.type.hydrate(y, _, E, H, ct(i(y)), U, $, e, f));
      }
      return (z != null && Fe(z, null, H, _), R);
    },
    h = (y, _, E, H, U, $) => {
      $ = $ || !!_.dynamicChildren;
      const {
          type: W,
          dynamicProps: j,
          props: G,
          patchFlag: z,
          shapeFlag: Y,
          dirs: n2,
          transition: l2,
        } = _,
        R = W === 'input' || W === 'option',
        Z = !!j;
      if (R || Z || z !== -1) {
        n2 && I2(_, null, E, 'created');
        let B = !1;
        if (S(y)) {
          B = Fn(null, l2) && E && E.vnode.props && E.vnode.props.appear;
          const t2 = y.content.firstChild;
          if (B) {
            const o2 = t2.getAttribute('class');
            (o2 && (t2.$cls = o2), l2.beforeEnter(t2));
          }
          (x(t2, y, E), (_.el = y = t2));
        }
        if (Y & 16 && !(G && (G.innerHTML || G.textContent))) {
          let t2 = p(y.firstChild, _, y, E, H, U, $);
          for (t2 && !ht(y, 1) && _e(); t2; ) {
            const o2 = t2;
            ((t2 = t2.nextSibling), a(o2));
          }
        } else if (Y & 8) {
          let t2 = _.children;
          t2[0] ===
            `
` &&
            (y.tagName === 'PRE' || y.tagName === 'TEXTAREA') &&
            (t2 = t2.slice(1));
          const { textContent: o2 } = y;
          o2 !== t2 &&
            o2 !==
              t2.replace(
                /\r\n|\r/g,
                `
`,
              ) &&
            (ht(y, 0) || _e(), (y.textContent = _.children));
        }
        if (G) {
          if (R || Z || !$ || z & 48) {
            const t2 = y.tagName.includes('-');
            for (const o2 in G)
              ((R && (o2.endsWith('value') || o2 === 'indeterminate')) ||
                (tt(o2) && !le(o2)) ||
                o2[0] === '.' ||
                (t2 && !le(o2)) ||
                (j && j.includes(o2))) &&
                s(y, o2, null, G[o2], void 0, E);
          } else if (G.onClick) s(y, 'onClick', null, G.onClick, void 0, E);
          else if (z & 4 && fe(G.style)) for (const t2 in G.style) G.style[t2];
        }
        let C2;
        ((C2 = G && G.onVnodeBeforeMount) && F2(C2, E, _),
          n2 && I2(_, null, E, 'beforeMount'),
          ((C2 = G && G.onVnodeMounted) || n2 || B) &&
            Hn(() => {
              (C2 && F2(C2, E, _), B && l2.enter(y), n2 && I2(_, null, E, 'mounted'));
            }, H));
      }
      return y.nextSibling;
    },
    p = (y, _, E, H, U, $, W) => {
      W = W || !!_.dynamicChildren;
      const j = _.children,
        G = j.length;
      let z = !1;
      for (let Y = 0; Y < G; Y++) {
        const n2 = W ? j[Y] : (j[Y] = x2(j[Y])),
          l2 = n2.type === he;
        y
          ? (l2 &&
              !W &&
              Y + 1 < G &&
              x2(j[Y + 1]).type === he &&
              (l(n(y.data.slice(n2.children.length)), E, o(y)), (y.data = n2.children)),
            (y = f(y, n2, H, U, $, W)))
          : l2 && !n2.children
            ? l((n2.el = n('')), E)
            : (z || ((z = !0), ht(E, 1) || _e()), r(null, n2, E, null, H, U, ct(E), $));
      }
      return y;
    },
    C = (y, _, E, H, U, $) => {
      const { slotScopeIds: W } = _;
      W && (U = U ? U.concat(W) : W);
      const j = i(y),
        G = p(o(y), _, j, E, H, U, $);
      return G && we(G) && G.data === ']'
        ? o((_.anchor = G))
        : (_e(), l((_.anchor = d(']')), j, G), G);
    },
    D = (y, _, E, H, U, $) => {
      if ((ki(y, _) || _e(), (_.el = null), $)) {
        const G = M(y);
        for (;;) {
          const z = o(y);
          if (z && z !== G) a(z);
          else break;
        }
      }
      const W = o(y),
        j = i(y);
      return (a(y), r(null, _, j, W, E, H, ct(j), U), E && ((E.vnode.el = _.el), $t(E, _.el)), W);
    },
    M = (y, _ = '[', E = ']') => {
      let H = 0;
      for (; y; )
        if (((y = o(y)), y && we(y) && (y.data === _ && H++, y.data === E))) {
          if (H === 0) return o(y);
          H--;
        }
      return y;
    },
    x = (y, _, E) => {
      const H = _.parentNode;
      H && H.replaceChild(y, _);
      let U = E;
      for (; U; ) (U.vnode.el === _ && (U.vnode.el = U.subTree.el = y), (U = U.parent));
    },
    S = (y) => y.nodeType === 1 && y.tagName === 'TEMPLATE';
  return [c, f];
}
const wt = 'data-allow-mismatch',
  Fi = { 0: 'text', 1: 'children', 2: 'class', 3: 'style', 4: 'attribute' };
function ht(e, t) {
  if (t === 0 || t === 1) for (; e && !e.hasAttribute(wt); ) e = e.parentElement;
  return or(e && e.getAttribute(wt), t);
}
function or(e, t) {
  if (e == null) return !1;
  if (e === '') return !0;
  {
    const r = e.split(',');
    return t === 0 && r.includes('children') ? !0 : r.includes(Fi[t]);
  }
}
function ki(e, t) {
  return ht(e.parentElement, 1) || Li(e) || Si(t);
}
function Li(e) {
  return e.nodeType === 1 && or(e.getAttribute(wt), 1);
}
function Si({ props: e }) {
  const t = e && e[wt];
  return typeof t == 'string' && or(t, 1);
}
Ot().requestIdleCallback;
Ot().cancelIdleCallback;
function Mi(e, t) {
  if (we(e) && e.data === '[') {
    let r = 1,
      s = e.nextSibling;
    for (; s; ) {
      if (s.nodeType === 1) {
        if (t(s) === !1) break;
      } else if (we(s))
        if (s.data === ']') {
          if (--r === 0) break;
        } else s.data === '[' && r++;
      s = s.nextSibling;
    }
  } else t(e);
}
const ke = (e) => !!e.type.__asyncLoader;
function Or(e) {
  I(e) && (e = { loader: e });
  const {
    loader: t,
    loadingComponent: r,
    errorComponent: s,
    delay: n = 200,
    hydrate: o,
    timeout: i,
    suspensible: a = !0,
    onError: l,
  } = e;
  let d = null,
    c,
    f = 0;
  const h = () => (f++, (d = null), p()),
    p = () => {
      let C;
      return (
        d ||
        (C = d =
          t()
            .catch((D) => {
              if (((D = D instanceof Error ? D : new Error(String(D))), l))
                return new Promise((M, x) => {
                  l(
                    D,
                    () => M(h()),
                    () => x(D),
                    f + 1,
                  );
                });
              throw D;
            })
            .then((D) =>
              C !== d && d
                ? d
                : (D && (D.__esModule || D[Symbol.toStringTag] === 'Module') && (D = D.default),
                  (c = D),
                  D),
            ))
      );
    };
  return sn({
    name: 'AsyncComponentWrapper',
    __asyncLoader: p,
    __asyncHydrate(C, D, M) {
      let x = !1;
      (D.bu || (D.bu = [])).push(() => (x = !0));
      const S = () => {
          x || M();
        },
        y = o
          ? () => {
              const _ = o(S, (E) => Mi(C, E));
              _ && (D.bum || (D.bum = [])).push(_);
            }
          : S;
      c ? y() : p().then(() => !D.isUnmounted && y());
    },
    get __asyncResolved() {
      return c;
    },
    setup() {
      const C = h2;
      if ((nr(C), c)) return () => ft(c, C);
      const D = (E) => {
        ((d = null), He(E, C, 13, !s));
      };
      if ((a && C.suspense) || Te)
        return p()
          .then((E) => () => ft(E, C))
          .catch((E) => (D(E), () => (s ? d2(s, { error: E }) : null)));
      const M = ue(!1),
        x = ue(),
        S = ue(!!n);
      let y, _;
      return (
        ar(() => {
          (y != null && clearTimeout(y), _ != null && clearTimeout(_));
        }),
        n &&
          (_ = setTimeout(() => {
            C.isUnmounted || (S.value = !1);
          }, n)),
        i != null &&
          (y = setTimeout(() => {
            if (!C.isUnmounted && !M.value && !x.value) {
              const E = new Error(`Async component timed out after ${i}ms.`);
              (D(E), (x.value = E));
            }
          }, i)),
        p()
          .then(() => {
            C.isUnmounted || ((M.value = !0), C.parent && ir(C.parent.vnode) && C.parent.update());
          })
          .catch((E) => {
            if (C.isUnmounted) {
              d = null;
              return;
            }
            (D(E), (x.value = E));
          }),
        () => {
          if (M.value && c) return ft(c, C);
          if (x.value && s) return d2(s, { error: x.value });
          if (r && !S.value) return ft(r, C);
        }
      );
    },
  });
}
function ft(e, t) {
  const { ref: r, props: s, children: n, ce: o } = t.vnode,
    i = d2(e, s, n);
  return ((i.ref = r), (i.ce = o), delete t.vnode.ce, i);
}
const ir = (e) => e.type.__isKeepAlive;
function nn(e, t) {
  an(e, 'a', t);
}
function on(e, t) {
  an(e, 'da', t);
}
function an(e, t, r = h2) {
  const s =
    e.__wdc ||
    (e.__wdc = () => {
      let n = r;
      for (; n; ) {
        if (n.isDeactivated) return;
        n = n.parent;
      }
      return e();
    });
  if ((jt(t, s, r), r)) {
    let n = r.parent;
    for (; n && n.parent; ) (ir(n.parent.vnode) && Ti(s, t, r, n), (n = n.parent));
  }
}
function Ti(e, t, r, s) {
  const n = jt(t, e, s, !0);
  ar(() => {
    Z0(s[t], n);
  }, r);
}
function jt(e, t, r = h2, s = !1) {
  if (r) {
    const n = r[e] || (r[e] = []),
      o =
        t.__weh ||
        (t.__weh = (...i) => {
          B2();
          const a = nt(r),
            l = P2(t, r, e, i);
          return (a(), $2(), l);
        });
    return (s ? n.unshift(o) : n.push(o), o);
  }
}
const Y2 =
    (e) =>
    (t, r = h2) => {
      (!Te || e === 'sp') && jt(e, (...s) => t(...s), r);
    },
  Hi = Y2('bm'),
  Pi = Y2('m'),
  Ri = Y2('bu'),
  Oi = Y2('u'),
  ln = Y2('bum'),
  ar = Y2('um'),
  Ui = Y2('sp'),
  Ii = Y2('rtg'),
  Ni = Y2('rtc');
function cn(e, t = h2) {
  jt('ec', e, t);
}
const fn = 'components';
function gc(e, t) {
  return dn(fn, e, !0, t) || e;
}
const un = Symbol.for('v-ndc');
function Vi(e) {
  return i2(e) ? dn(fn, e, !1) || e : e || un;
}
function dn(e, t, r = !0, s = !1) {
  const n = T2 || h2;
  if (n) {
    const o = n.type;
    {
      const a = F3(o, !1);
      if (a && (a === t || a === E2(t) || a === Rt(E2(t)))) return o;
    }
    const i = Ur(n[e] || o[e], t) || Ur(n.appContext[e], t);
    return !i && s ? o : i;
  }
}
function Ur(e, t) {
  return e && (e[t] || e[E2(t)] || e[Rt(E2(t))]);
}
const b0 = (e) => (e ? (Vn(e) ? fr(e) : b0(e.parent)) : null),
  $e = g2(Object.create(null), {
    $: (e) => e,
    $el: (e) => e.vnode.el,
    $data: (e) => e.data,
    $props: (e) => e.props,
    $attrs: (e) => e.attrs,
    $slots: (e) => e.slots,
    $refs: (e) => e.refs,
    $parent: (e) => b0(e.parent),
    $root: (e) => b0(e.root),
    $host: (e) => e.ce,
    $emit: (e) => e.emit,
    $options: (e) => hn(e),
    $forceUpdate: (e) =>
      e.f ||
      (e.f = () => {
        tr(e.update);
      }),
    $nextTick: (e) => e.n || (e.n = zs.bind(e.proxy)),
    $watch: (e) => Ei.bind(e),
  }),
  o0 = (e, t) => e !== s2 && !e.__isScriptSetup && J(e, t),
  ji = {
    get({ _: e }, t) {
      if (t === '__v_skip') return !0;
      const {
        ctx: r,
        setupState: s,
        data: n,
        props: o,
        accessCache: i,
        type: a,
        appContext: l,
      } = e;
      if (t[0] !== '$') {
        const h = i[t];
        if (h !== void 0)
          switch (h) {
            case 1:
              return s[t];
            case 2:
              return n[t];
            case 4:
              return r[t];
            case 3:
              return o[t];
          }
        else {
          if (o0(s, t)) return ((i[t] = 1), s[t]);
          if (n !== s2 && J(n, t)) return ((i[t] = 2), n[t]);
          if (J(o, t)) return ((i[t] = 3), o[t]);
          if (r !== s2 && J(r, t)) return ((i[t] = 4), r[t]);
          w0 && (i[t] = 0);
        }
      }
      const d = $e[t];
      let c, f;
      if (d) return (t === '$attrs' && D2(e.attrs, 'get', ''), d(e));
      if ((c = a.__cssModules) && (c = c[t])) return c;
      if (r !== s2 && J(r, t)) return ((i[t] = 4), r[t]);
      if (((f = l.config.globalProperties), J(f, t))) return f[t];
    },
    set({ _: e }, t, r) {
      const { data: s, setupState: n, ctx: o } = e;
      return o0(n, t)
        ? ((n[t] = r), !0)
        : s !== s2 && J(s, t)
          ? ((s[t] = r), !0)
          : J(e.props, t) || (t[0] === '$' && t.slice(1) in e)
            ? !1
            : ((o[t] = r), !0);
    },
    has(
      { _: { data: e, setupState: t, accessCache: r, ctx: s, appContext: n, props: o, type: i } },
      a,
    ) {
      let l;
      return !!(
        r[a] ||
        (e !== s2 && a[0] !== '$' && J(e, a)) ||
        o0(t, a) ||
        J(o, a) ||
        J(s, a) ||
        J($e, a) ||
        J(n.config.globalProperties, a) ||
        ((l = i.__cssModules) && l[a])
      );
    },
    defineProperty(e, t, r) {
      return (
        r.get != null ? (e._.accessCache[t] = 0) : J(r, 'value') && this.set(e, t, r.value, null),
        Reflect.defineProperty(e, t, r)
      );
    },
  };
function Ir(e) {
  return V(e) ? e.reduce((t, r) => ((t[r] = null), t), {}) : e;
}
let w0 = !0;
function Bi(e) {
  const t = hn(e),
    r = e.proxy,
    s = e.ctx;
  ((w0 = !1), t.beforeCreate && Nr(t.beforeCreate, e, 'bc'));
  const {
    data: n,
    computed: o,
    methods: i,
    watch: a,
    provide: l,
    inject: d,
    created: c,
    beforeMount: f,
    mounted: h,
    beforeUpdate: p,
    updated: C,
    activated: D,
    deactivated: M,
    beforeDestroy: x,
    beforeUnmount: S,
    destroyed: y,
    unmounted: _,
    render: E,
    renderTracked: H,
    renderTriggered: U,
    errorCaptured: $,
    serverPrefetch: W,
    expose: j,
    inheritAttrs: G,
    components: z,
    directives: Y,
    filters: n2,
  } = t;
  if ((d && $i(d, s, null), i))
    for (const Z in i) {
      const B = i[Z];
      I(B) && (s[Z] = B.bind(r));
    }
  if (n) {
    const Z = n.call(r, r);
    X(Z) && (e.data = re(Z));
  }
  if (((w0 = !0), o))
    for (const Z in o) {
      const B = o[Z],
        C2 = I(B) ? B.bind(r, r) : I(B.get) ? B.get.bind(r, r) : j2,
        t2 = !I(B) && I(B.set) ? B.set.bind(r) : j2,
        o2 = Bn({ get: C2, set: t2 });
      Object.defineProperty(s, Z, {
        enumerable: !0,
        configurable: !0,
        get: () => o2.value,
        set: (R2) => (o2.value = R2),
      });
    }
  if (a) for (const Z in a) pn(a[Z], s, r, Z);
  if (l) {
    const Z = I(l) ? l.call(r) : l;
    Reflect.ownKeys(Z).forEach((B) => {
      tn(B, Z[B]);
    });
  }
  c && Nr(c, e, 'c');
  function R(Z, B) {
    V(B) ? B.forEach((C2) => Z(C2.bind(r))) : B && Z(B.bind(r));
  }
  if (
    (R(Hi, f),
    R(Pi, h),
    R(Ri, p),
    R(Oi, C),
    R(nn, D),
    R(on, M),
    R(cn, $),
    R(Ni, H),
    R(Ii, U),
    R(ln, S),
    R(ar, _),
    R(Ui, W),
    V(j))
  )
    if (j.length) {
      const Z = e.exposed || (e.exposed = {});
      j.forEach((B) => {
        Object.defineProperty(Z, B, { get: () => r[B], set: (C2) => (r[B] = C2), enumerable: !0 });
      });
    } else e.exposed || (e.exposed = {});
  (E && e.render === j2 && (e.render = E),
    G != null && (e.inheritAttrs = G),
    z && (e.components = z),
    Y && (e.directives = Y),
    W && nr(e));
}
function $i(e, t, r = j2) {
  V(e) && (e = A0(e));
  for (const s in e) {
    const n = e[s];
    let o;
    (X(n)
      ? 'default' in n
        ? (o = de(n.from || s, n.default, !0))
        : (o = de(n.from || s))
      : (o = de(n)),
      f2(o)
        ? Object.defineProperty(t, s, {
            enumerable: !0,
            configurable: !0,
            get: () => o.value,
            set: (i) => (o.value = i),
          })
        : (t[s] = o));
  }
}
function Nr(e, t, r) {
  P2(V(e) ? e.map((s) => s.bind(t.proxy)) : e.bind(t.proxy), t, r);
}
function pn(e, t, r, s) {
  let n = s.includes('.') ? rn(r, s) : () => r[s];
  if (i2(e)) {
    const o = t[e];
    I(o) && s0(n, o);
  } else if (I(e)) s0(n, e.bind(r));
  else if (X(e))
    if (V(e)) e.forEach((o) => pn(o, t, r, s));
    else {
      const o = I(e.handler) ? e.handler.bind(r) : t[e.handler];
      I(o) && s0(n, o, e);
    }
}
function hn(e) {
  const t = e.type,
    { mixins: r, extends: s } = t,
    {
      mixins: n,
      optionsCache: o,
      config: { optionMergeStrategies: i },
    } = e.appContext,
    a = o.get(t);
  let l;
  return (
    a
      ? (l = a)
      : !n.length && !r && !s
        ? (l = t)
        : ((l = {}), n.length && n.forEach((d) => At(l, d, i, !0)), At(l, t, i)),
    X(t) && o.set(t, l),
    l
  );
}
function At(e, t, r, s = !1) {
  const { mixins: n, extends: o } = t;
  (o && At(e, o, r, !0), n && n.forEach((i) => At(e, i, r, !0)));
  for (const i in t)
    if (!(s && i === 'expose')) {
      const a = Gi[i] || (r && r[i]);
      e[i] = a ? a(e[i], t[i]) : t[i];
    }
  return e;
}
const Gi = {
  data: Vr,
  props: jr,
  emits: jr,
  methods: Ne,
  computed: Ne,
  beforeCreate: y2,
  created: y2,
  beforeMount: y2,
  mounted: y2,
  beforeUpdate: y2,
  updated: y2,
  beforeDestroy: y2,
  beforeUnmount: y2,
  destroyed: y2,
  unmounted: y2,
  activated: y2,
  deactivated: y2,
  errorCaptured: y2,
  serverPrefetch: y2,
  components: Ne,
  directives: Ne,
  watch: Zi,
  provide: Vr,
  inject: Wi,
};
function Vr(e, t) {
  return t
    ? e
      ? function () {
          return g2(I(e) ? e.call(this, this) : e, I(t) ? t.call(this, this) : t);
        }
      : t
    : e;
}
function Wi(e, t) {
  return Ne(A0(e), A0(t));
}
function A0(e) {
  if (V(e)) {
    const t = {};
    for (let r = 0; r < e.length; r++) t[e[r]] = e[r];
    return t;
  }
  return e;
}
function y2(e, t) {
  return e ? [...new Set([].concat(e, t))] : t;
}
function Ne(e, t) {
  return e ? g2(Object.create(null), e, t) : t;
}
function jr(e, t) {
  return e
    ? V(e) && V(t)
      ? [...new Set([...e, ...t])]
      : g2(Object.create(null), Ir(e), Ir(t ?? {}))
    : t;
}
function Zi(e, t) {
  if (!e) return t;
  if (!t) return e;
  const r = g2(Object.create(null), e);
  for (const s in t) r[s] = y2(e[s], t[s]);
  return r;
}
function gn() {
  return {
    app: null,
    config: {
      isNativeTag: Es,
      performance: !1,
      globalProperties: {},
      optionMergeStrategies: {},
      errorHandler: void 0,
      warnHandler: void 0,
      compilerOptions: {},
    },
    mixins: [],
    components: {},
    directives: {},
    provides: Object.create(null),
    optionsCache: new WeakMap(),
    propsCache: new WeakMap(),
    emitsCache: new WeakMap(),
  };
}
let qi = 0;
function Ki(e, t) {
  return function (s, n = null) {
    (I(s) || (s = g2({}, s)), n != null && !X(n) && (n = null));
    const o = gn(),
      i = new WeakSet(),
      a = [];
    let l = !1;
    const d = (o.app = {
      _uid: qi++,
      _component: s,
      _props: n,
      _container: null,
      _context: o,
      _instance: null,
      version: S3,
      get config() {
        return o.config;
      },
      set config(c) {},
      use(c, ...f) {
        return (
          i.has(c) ||
            (c && I(c.install) ? (i.add(c), c.install(d, ...f)) : I(c) && (i.add(c), c(d, ...f))),
          d
        );
      },
      mixin(c) {
        return (o.mixins.includes(c) || o.mixins.push(c), d);
      },
      component(c, f) {
        return f ? ((o.components[c] = f), d) : o.components[c];
      },
      directive(c, f) {
        return f ? ((o.directives[c] = f), d) : o.directives[c];
      },
      mount(c, f, h) {
        if (!l) {
          const p = d._ceVNode || d2(s, n);
          return (
            (p.appContext = o),
            h === !0 ? (h = 'svg') : h === !1 && (h = void 0),
            f && t ? t(p, c) : e(p, c, h),
            (l = !0),
            (d._container = c),
            (c.__vue_app__ = d),
            fr(p.component)
          );
        }
      },
      onUnmount(c) {
        a.push(c);
      },
      unmount() {
        l && (P2(a, d._instance, 16), e(null, d._container), delete d._container.__vue_app__);
      },
      provide(c, f) {
        return ((o.provides[c] = f), d);
      },
      runWithContext(c) {
        const f = pe;
        pe = d;
        try {
          return c();
        } finally {
          pe = f;
        }
      },
    });
    return d;
  };
}
let pe = null;
const Ji = (e, t) =>
  t === 'modelValue' || t === 'model-value'
    ? e.modelModifiers
    : e[`${t}Modifiers`] || e[`${E2(t)}Modifiers`] || e[`${Ce(t)}Modifiers`];
function zi(e, t, ...r) {
  if (e.isUnmounted) return;
  const s = e.vnode.props || s2;
  let n = r;
  const o = t.startsWith('update:'),
    i = o && Ji(s, t.slice(7));
  i && (i.trim && (n = r.map((c) => (i2(c) ? c.trim() : c))), i.number && (n = r.map(Lo)));
  let a,
    l = s[(a = Xt(t))] || s[(a = Xt(E2(t)))];
  (!l && o && (l = s[(a = Xt(Ce(t)))]), l && P2(l, e, 6, n));
  const d = s[a + 'Once'];
  if (d) {
    if (!e.emitted) e.emitted = {};
    else if (e.emitted[a]) return;
    ((e.emitted[a] = !0), P2(d, e, 6, n));
  }
}
const Xi = new WeakMap();
function Cn(e, t, r = !1) {
  const s = r ? Xi : t.emitsCache,
    n = s.get(e);
  if (n !== void 0) return n;
  const o = e.emits;
  let i = {},
    a = !1;
  if (!I(e)) {
    const l = (d) => {
      const c = Cn(d, t, !0);
      c && ((a = !0), g2(i, c));
    };
    (!r && t.mixins.length && t.mixins.forEach(l),
      e.extends && l(e.extends),
      e.mixins && e.mixins.forEach(l));
  }
  return !o && !a
    ? (X(e) && s.set(e, null), null)
    : (V(o) ? o.forEach((l) => (i[l] = null)) : g2(i, o), X(e) && s.set(e, i), i);
}
function Bt(e, t) {
  return !e || !tt(t)
    ? !1
    : ((t = t.slice(2)),
      (t = t === 'Once' ? t : t.replace(/Once$/, '')),
      J(e, t[0].toLowerCase() + t.slice(1)) || J(e, Ce(t)) || J(e, t));
}
function i0(e) {
  const {
      type: t,
      vnode: r,
      proxy: s,
      withProxy: n,
      propsOptions: [o],
      slots: i,
      attrs: a,
      emit: l,
      render: d,
      renderCache: c,
      props: f,
      data: h,
      setupState: p,
      ctx: C,
      inheritAttrs: D,
    } = e,
    M = Et(e);
  let x, S;
  try {
    if (r.shapeFlag & 4) {
      const _ = n || s,
        E = _;
      ((x = x2(d.call(E, _, c, f, p, h, C))), (S = a));
    } else {
      const _ = t;
      ((x = x2(_.length > 1 ? _(f, { attrs: a, slots: i, emit: l }) : _(f, null))),
        (S = t.props ? a : Qi(a)));
    }
  } catch (_) {
    ((We.length = 0), He(_, e, 1), (x = d2(X2)));
  }
  let y = x;
  if (S && D !== !1) {
    const _ = Object.keys(S),
      { shapeFlag: E } = y;
    _.length && E & 7 && (o && _.some(Tt) && (S = e3(S, o)), (y = Me(y, S, !1, !0)));
  }
  return (
    r.dirs && ((y = Me(y, null, !1, !0)), (y.dirs = y.dirs ? y.dirs.concat(r.dirs) : r.dirs)),
    r.transition && sr(y, r.transition),
    (x = y),
    Et(M),
    x
  );
}
function Yi(e, t = !0) {
  let r;
  for (let s = 0; s < e.length; s++) {
    const n = e[s];
    if (Ye(n)) {
      if (n.type !== X2 || n.children === 'v-if') {
        if (r) return;
        r = n;
      }
    } else return;
  }
  return r;
}
const Qi = (e) => {
    let t;
    for (const r in e) (r === 'class' || r === 'style' || tt(r)) && ((t || (t = {}))[r] = e[r]);
    return t;
  },
  e3 = (e, t) => {
    const r = {};
    for (const s in e) (!Tt(s) || !(s.slice(9) in t)) && (r[s] = e[s]);
    return r;
  };
function t3(e, t, r) {
  const { props: s, children: n, component: o } = e,
    { props: i, children: a, patchFlag: l } = t,
    d = o.emitsOptions;
  if (t.dirs || t.transition) return !0;
  if (r && l >= 0) {
    if (l & 1024) return !0;
    if (l & 16) return s ? Br(s, i, d) : !!i;
    if (l & 8) {
      const c = t.dynamicProps;
      for (let f = 0; f < c.length; f++) {
        const h = c[f];
        if (Dn(i, s, h) && !Bt(d, h)) return !0;
      }
    }
  } else
    return (n || a) && (!a || !a.$stable) ? !0 : s === i ? !1 : s ? (i ? Br(s, i, d) : !0) : !!i;
  return !1;
}
function Br(e, t, r) {
  const s = Object.keys(t);
  if (s.length !== Object.keys(e).length) return !0;
  for (let n = 0; n < s.length; n++) {
    const o = s[n];
    if (Dn(t, e, o) && !Bt(r, o)) return !0;
  }
  return !1;
}
function Dn(e, t, r) {
  const s = e[r],
    n = t[r];
  return r === 'style' && X(s) && X(n) ? !q0(s, n) : s !== n;
}
function $t({ vnode: e, parent: t, suspense: r }, s) {
  for (; t; ) {
    const n = t.subTree;
    if (
      (n.suspense && n.suspense.activeBranch === e && ((n.suspense.vnode.el = n.el = s), (e = n)),
      n === e)
    )
      (((e = t.vnode).el = s), (t = t.parent));
    else break;
  }
  r && r.activeBranch === e && (r.vnode.el = s);
}
const yn = {},
  _n = () => Object.create(yn),
  mn = (e) => Object.getPrototypeOf(e) === yn;
function r3(e, t, r, s = !1) {
  const n = {},
    o = _n();
  ((e.propsDefaults = Object.create(null)), En(e, t, n, o));
  for (const i in e.propsOptions[0]) i in n || (n[i] = void 0);
  (r ? (e.props = s ? n : be(n)) : e.type.props ? (e.props = n) : (e.props = o), (e.attrs = o));
}
function s3(e, t, r, s) {
  const {
      props: n,
      attrs: o,
      vnode: { patchFlag: i },
    } = e,
    a = K(n),
    [l] = e.propsOptions;
  let d = !1;
  if ((s || i > 0) && !(i & 16)) {
    if (i & 8) {
      const c = e.vnode.dynamicProps;
      for (let f = 0; f < c.length; f++) {
        let h = c[f];
        if (Bt(e.emitsOptions, h)) continue;
        const p = t[h];
        if (l)
          if (J(o, h)) p !== o[h] && ((o[h] = p), (d = !0));
          else {
            const C = E2(h);
            n[C] = v0(l, a, C, p, e, !1);
          }
        else p !== o[h] && ((o[h] = p), (d = !0));
      }
    }
  } else {
    En(e, t, n, o) && (d = !0);
    let c;
    for (const f in a)
      (!t || (!J(t, f) && ((c = Ce(f)) === f || !J(t, c)))) &&
        (l
          ? r && (r[f] !== void 0 || r[c] !== void 0) && (n[f] = v0(l, a, f, void 0, e, !0))
          : delete n[f]);
    if (o !== a) for (const f in o) (!t || !J(t, f)) && (delete o[f], (d = !0));
  }
  d && K2(e.attrs, 'set', '');
}
function En(e, t, r, s) {
  const [n, o] = e.propsOptions;
  let i = !1,
    a;
  if (t)
    for (let l in t) {
      if (le(l)) continue;
      const d = t[l];
      let c;
      n && J(n, (c = E2(l)))
        ? !o || !o.includes(c)
          ? (r[c] = d)
          : ((a || (a = {}))[c] = d)
        : Bt(e.emitsOptions, l) || ((!(l in s) || d !== s[l]) && ((s[l] = d), (i = !0)));
    }
  if (o) {
    const l = K(r),
      d = a || s2;
    for (let c = 0; c < o.length; c++) {
      const f = o[c];
      r[f] = v0(n, l, f, d[f], e, !J(d, f));
    }
  }
  return i;
}
function v0(e, t, r, s, n, o) {
  const i = e[r];
  if (i != null) {
    const a = J(i, 'default');
    if (a && s === void 0) {
      const l = i.default;
      if (i.type !== Function && !i.skipFactory && I(l)) {
        const { propsDefaults: d } = n;
        if (r in d) s = d[r];
        else {
          const c = nt(n);
          ((s = d[r] = l.call(null, t)), c());
        }
      } else s = l;
      n.ce && n.ce._setProp(r, s);
    }
    i[0] && (o && !a ? (s = !1) : i[1] && (s === '' || s === Ce(r)) && (s = !0));
  }
  return s;
}
const n3 = new WeakMap();
function bn(e, t, r = !1) {
  const s = r ? n3 : t.propsCache,
    n = s.get(e);
  if (n) return n;
  const o = e.props,
    i = {},
    a = [];
  let l = !1;
  if (!I(e)) {
    const c = (f) => {
      l = !0;
      const [h, p] = bn(f, t, !0);
      (g2(i, h), p && a.push(...p));
    };
    (!r && t.mixins.length && t.mixins.forEach(c),
      e.extends && c(e.extends),
      e.mixins && e.mixins.forEach(c));
  }
  if (!o && !l) return (X(e) && s.set(e, Ae), Ae);
  if (V(o))
    for (let c = 0; c < o.length; c++) {
      const f = E2(o[c]);
      $r(f) && (i[f] = s2);
    }
  else if (o)
    for (const c in o) {
      const f = E2(c);
      if ($r(f)) {
        const h = o[c],
          p = (i[f] = V(h) || I(h) ? { type: h } : g2({}, h)),
          C = p.type;
        let D = !1,
          M = !0;
        if (V(C))
          for (let x = 0; x < C.length; ++x) {
            const S = C[x],
              y = I(S) && S.name;
            if (y === 'Boolean') {
              D = !0;
              break;
            } else y === 'String' && (M = !1);
          }
        else D = I(C) && C.name === 'Boolean';
        ((p[0] = D), (p[1] = M), (D || J(p, 'default')) && a.push(f));
      }
    }
  const d = [i, a];
  return (X(e) && s.set(e, d), d);
}
function $r(e) {
  return e[0] !== '$' && !le(e);
}
const lr = (e) => e === '_' || e === '_ctx' || e === '$stable',
  cr = (e) => (V(e) ? e.map(x2) : [x2(e)]),
  o3 = (e, t, r) => {
    if (t._n) return t;
    const s = en((...n) => cr(t(...n)), r);
    return ((s._c = !1), s);
  },
  wn = (e, t, r) => {
    const s = e._ctx;
    for (const n in e) {
      if (lr(n)) continue;
      const o = e[n];
      if (I(o)) t[n] = o3(n, o, s);
      else if (o != null) {
        const i = cr(o);
        t[n] = () => i;
      }
    }
  },
  An = (e, t) => {
    const r = cr(t);
    e.slots.default = () => r;
  },
  vn = (e, t, r) => {
    for (const s in t) (r || !lr(s)) && (e[s] = t[s]);
  },
  i3 = (e, t, r) => {
    const s = (e.slots = _n());
    if (e.vnode.shapeFlag & 32) {
      const n = t._;
      n ? (vn(s, t, r), r && xs(s, '_', n, !0)) : wn(t, s);
    } else t && An(e, t);
  },
  a3 = (e, t, r) => {
    const { vnode: s, slots: n } = e;
    let o = !0,
      i = s2;
    if (s.shapeFlag & 32) {
      const a = t._;
      (a ? (r && a === 1 ? (o = !1) : vn(n, t, r)) : ((o = !t.$stable), wn(t, n)), (i = t));
    } else t && (An(e, t), (i = { default: 1 }));
    if (o) for (const a in n) !lr(a) && i[a] == null && delete n[a];
  },
  _2 = Hn;
function l3(e) {
  return xn(e);
}
function c3(e) {
  return xn(e, xi);
}
function xn(e, t) {
  const r = Ot();
  r.__VUE__ = !0;
  const {
      insert: s,
      remove: n,
      patchProp: o,
      createElement: i,
      createText: a,
      createComment: l,
      setText: d,
      setElementText: c,
      parentNode: f,
      nextSibling: h,
      setScopeId: p = j2,
      insertStaticContent: C,
    } = e,
    D = (u, g, m, v = null, w = null, b = null, L = void 0, k = null, F = !!g.dynamicChildren) => {
      if (u === g) return;
      (u && !te(u, g) && ((v = ot(u)), R2(u, w, b, !0), (u = null)),
        g.patchFlag === -2 && ((F = !1), (g.dynamicChildren = null)));
      const { type: A, ref: O, shapeFlag: T } = g;
      switch (A) {
        case he:
          M(u, g, m, v);
          break;
        case X2:
          x(u, g, m, v);
          break;
        case Ge:
          u == null && S(g, m, v, L);
          break;
        case M2:
          z(u, g, m, v, w, b, L, k, F);
          break;
        default:
          T & 1
            ? E(u, g, m, v, w, b, L, k, F)
            : T & 6
              ? Y(u, g, m, v, w, b, L, k, F)
              : (T & 64 || T & 128) && A.process(u, g, m, v, w, b, L, k, F, De);
      }
      O != null && w
        ? Fe(O, u && u.ref, b, g || u, !g)
        : O == null && u && u.ref != null && Fe(u.ref, null, b, u, !0);
    },
    M = (u, g, m, v) => {
      if (u == null) s((g.el = a(g.children)), m, v);
      else {
        const w = (g.el = u.el);
        g.children !== u.children && d(w, g.children);
      }
    },
    x = (u, g, m, v) => {
      u == null ? s((g.el = l(g.children || '')), m, v) : (g.el = u.el);
    },
    S = (u, g, m, v) => {
      [u.el, u.anchor] = C(u.children, g, m, v, u.el, u.anchor);
    },
    y = ({ el: u, anchor: g }, m, v) => {
      let w;
      for (; u && u !== g; ) ((w = h(u)), s(u, m, v), (u = w));
      s(g, m, v);
    },
    _ = ({ el: u, anchor: g }) => {
      let m;
      for (; u && u !== g; ) ((m = h(u)), n(u), (u = m));
      n(g);
    },
    E = (u, g, m, v, w, b, L, k, F) => {
      if ((g.type === 'svg' ? (L = 'svg') : g.type === 'math' && (L = 'mathml'), u == null))
        H(g, m, v, w, b, L, k, F);
      else {
        const A = u.el && u.el._isVueCE ? u.el : null;
        try {
          (A && A._beginPatch(), W(u, g, w, b, L, k, F));
        } finally {
          A && A._endPatch();
        }
      }
    },
    H = (u, g, m, v, w, b, L, k) => {
      let F, A;
      const { props: O, shapeFlag: T, transition: P, dirs: N } = u;
      if (
        ((F = u.el = i(u.type, b, O && O.is, O)),
        T & 8 ? c(F, u.children) : T & 16 && $(u.children, F, null, v, w, a0(u, b), L, k),
        N && I2(u, null, v, 'created'),
        U(F, u, u.scopeId, L, v),
        O)
      ) {
        for (const e2 in O) e2 !== 'value' && !le(e2) && o(F, e2, null, O[e2], b, v);
        ('value' in O && o(F, 'value', null, O.value, b),
          (A = O.onVnodeBeforeMount) && F2(A, v, u));
      }
      N && I2(u, null, v, 'beforeMount');
      const q = Fn(w, P);
      (q && P.beforeEnter(F),
        s(F, g, m),
        ((A = O && O.onVnodeMounted) || q || N) &&
          _2(() => {
            (A && F2(A, v, u), q && P.enter(F), N && I2(u, null, v, 'mounted'));
          }, w));
    },
    U = (u, g, m, v, w) => {
      if ((m && p(u, m), v)) for (let b = 0; b < v.length; b++) p(u, v[b]);
      if (w) {
        let b = w.subTree;
        if (g === b || (Mn(b.type) && (b.ssContent === g || b.ssFallback === g))) {
          const L = w.vnode;
          U(u, L, L.scopeId, L.slotScopeIds, w.parent);
        }
      }
    },
    $ = (u, g, m, v, w, b, L, k, F = 0) => {
      for (let A = F; A < u.length; A++) {
        const O = (u[A] = k ? q2(u[A]) : x2(u[A]));
        D(null, O, g, m, v, w, b, L, k);
      }
    },
    W = (u, g, m, v, w, b, L) => {
      const k = (g.el = u.el);
      let { patchFlag: F, dynamicChildren: A, dirs: O } = g;
      F |= u.patchFlag & 16;
      const T = u.props || s2,
        P = g.props || s2;
      let N;
      if (
        (m && ne(m, !1),
        (N = P.onVnodeBeforeUpdate) && F2(N, m, g, u),
        O && I2(g, u, m, 'beforeUpdate'),
        m && ne(m, !0),
        A &&
          (!u.dynamicChildren || u.dynamicChildren.length !== A.length) &&
          ((F = 0), (L = !1), (A = null)),
        ((T.innerHTML && P.innerHTML == null) || (T.textContent && P.textContent == null)) &&
          c(k, ''),
        A
          ? j(u.dynamicChildren, A, k, m, v, a0(g, w), b)
          : L || B(u, g, k, null, m, v, a0(g, w), b, !1),
        F > 0)
      ) {
        if (F & 16) G(k, T, P, m, w);
        else if (
          (F & 2 && T.class !== P.class && o(k, 'class', null, P.class, w),
          F & 4 && o(k, 'style', T.style, P.style, w),
          F & 8)
        ) {
          const q = g.dynamicProps;
          for (let e2 = 0; e2 < q.length; e2++) {
            const Q = q[e2],
              c2 = T[Q],
              u2 = P[Q];
            (u2 !== c2 || Q === 'value') && o(k, Q, c2, u2, w, m);
          }
        }
        F & 1 && u.children !== g.children && c(k, g.children);
      } else !L && A == null && G(k, T, P, m, w);
      ((N = P.onVnodeUpdated) || O) &&
        _2(() => {
          (N && F2(N, m, g, u), O && I2(g, u, m, 'updated'));
        }, v);
    },
    j = (u, g, m, v, w, b, L) => {
      for (let k = 0; k < g.length; k++) {
        const F = u[k],
          A = g[k],
          O = F.el && (F.type === M2 || !te(F, A) || F.shapeFlag & 198) ? f(F.el) : m;
        D(F, A, O, null, v, w, b, L, !0);
      }
    },
    G = (u, g, m, v, w) => {
      if (g !== m) {
        if (g !== s2) for (const b in g) !le(b) && !(b in m) && o(u, b, g[b], null, w, v);
        for (const b in m) {
          if (le(b)) continue;
          const L = m[b],
            k = g[b];
          L !== k && b !== 'value' && o(u, b, k, L, w, v);
        }
        'value' in m && o(u, 'value', g.value, m.value, w);
      }
    },
    z = (u, g, m, v, w, b, L, k, F) => {
      const A = (g.el = u ? u.el : a('')),
        O = (g.anchor = u ? u.anchor : a(''));
      let { patchFlag: T, dynamicChildren: P, slotScopeIds: N } = g;
      (N && (k = k ? k.concat(N) : N),
        u == null
          ? (s(A, m, v), s(O, m, v), $(g.children || [], m, O, w, b, L, k, F))
          : T > 0 && T & 64 && P && u.dynamicChildren && u.dynamicChildren.length === P.length
            ? (j(u.dynamicChildren, P, m, w, b, L, k),
              (g.key != null || (w && g === w.subTree)) && kn(u, g, !0))
            : B(u, g, m, O, w, b, L, k, F));
    },
    Y = (u, g, m, v, w, b, L, k, F) => {
      ((g.slotScopeIds = k),
        u == null
          ? g.shapeFlag & 512
            ? w.ctx.activate(g, m, v, L, F)
            : n2(g, m, v, w, b, L, F)
          : l2(u, g, F));
    },
    n2 = (u, g, m, v, w, b, L) => {
      const k = (u.component = b3(u, v, w));
      if ((ir(u) && (k.ctx.renderer = De), w3(k, !1, L), k.asyncDep)) {
        if ((w && w.registerDep(k, R, L), !u.el)) {
          const F = (k.subTree = d2(X2));
          (x(null, F, g, m), (u.placeholder = F.el));
        }
      } else R(k, u, g, m, w, b, L);
    },
    l2 = (u, g, m) => {
      const v = (g.component = u.component);
      if (t3(u, g, m))
        if (v.asyncDep && !v.asyncResolved) {
          Z(v, g, m);
          return;
        } else ((v.next = g), v.update());
      else ((g.el = u.el), (v.vnode = g));
    },
    R = (u, g, m, v, w, b, L) => {
      const k = () => {
        if (u.isMounted) {
          let { next: T, bu: P, u: N, parent: q, vnode: e2 } = u;
          {
            const A2 = Ln(u);
            if (A2) {
              (T && ((T.el = e2.el), Z(u, T, L)),
                A2.asyncDep.then(() => {
                  _2(() => {
                    u.isUnmounted || A();
                  }, w);
                }));
              return;
            }
          }
          let Q = T,
            c2;
          (ne(u, !1),
            T ? ((T.el = e2.el), Z(u, T, L)) : (T = e2),
            P && Yt(P),
            (c2 = T.props && T.props.onVnodeBeforeUpdate) && F2(c2, q, T, e2),
            ne(u, !0));
          const u2 = i0(u),
            S2 = u.subTree;
          ((u.subTree = u2),
            D(S2, u2, f(S2.el), ot(S2), u, w, b),
            (T.el = u2.el),
            Q === null && $t(u, u2.el),
            N && _2(N, w),
            (c2 = T.props && T.props.onVnodeUpdated) && _2(() => F2(c2, q, T, e2), w));
        } else {
          let T;
          const { el: P, props: N } = g,
            { bm: q, m: e2, parent: Q, root: c2, type: u2 } = u,
            S2 = ke(g);
          if (
            (ne(u, !1),
            q && Yt(q),
            !S2 && (T = N && N.onVnodeBeforeMount) && F2(T, Q, g),
            ne(u, !0),
            P && zt)
          ) {
            const A2 = () => {
              ((u.subTree = i0(u)), zt(P, u.subTree, u, w, null));
            };
            S2 && u2.__asyncHydrate ? u2.__asyncHydrate(P, u, A2) : A2();
          } else {
            c2.ce &&
              c2.ce._hasShadowRoot() &&
              c2.ce._injectChildStyle(u2, u.parent ? u.parent.type : void 0);
            const A2 = (u.subTree = i0(u));
            (D(null, A2, m, v, u, w, b), (g.el = A2.el));
          }
          if ((e2 && _2(e2, w), !S2 && (T = N && N.onVnodeMounted))) {
            const A2 = g;
            _2(() => F2(T, Q, A2), w);
          }
          ((g.shapeFlag & 256 || (Q && ke(Q.vnode) && Q.vnode.shapeFlag & 256)) &&
            u.a &&
            _2(u.a, w),
            (u.isMounted = !0),
            (g = m = v = null));
        }
      };
      u.scope.on();
      const F = (u.effect = new Hs(k));
      u.scope.off();
      const A = (u.update = F.run.bind(F)),
        O = (u.job = F.runIfDirty.bind(F));
      ((O.i = u), (O.id = u.uid), (F.scheduler = () => tr(O)), ne(u, !0), A());
    },
    Z = (u, g, m) => {
      g.component = u;
      const v = u.vnode.props;
      ((u.vnode = g),
        (u.next = null),
        s3(u, g.props, v, m),
        a3(u, g.children, m),
        B2(),
        Tr(u),
        $2());
    },
    B = (u, g, m, v, w, b, L, k, F = !1) => {
      const A = u && u.children,
        O = u ? u.shapeFlag : 0,
        T = g.children,
        { patchFlag: P, shapeFlag: N } = g;
      if (P > 0) {
        if (P & 128) {
          t2(A, T, m, v, w, b, L, k, F);
          return;
        } else if (P & 256) {
          C2(A, T, m, v, w, b, L, k, F);
          return;
        }
      }
      N & 8
        ? (O & 16 && Re(A, w, b), T !== A && c(m, T))
        : O & 16
          ? N & 16
            ? t2(A, T, m, v, w, b, L, k, F)
            : Re(A, w, b, !0)
          : (O & 8 && c(m, ''), N & 16 && $(T, m, v, w, b, L, k, F));
    },
    C2 = (u, g, m, v, w, b, L, k, F) => {
      ((u = u || Ae), (g = g || Ae));
      const A = u.length,
        O = g.length,
        T = Math.min(A, O);
      let P;
      for (P = 0; P < T; P++) {
        const N = (g[P] = F ? q2(g[P]) : x2(g[P]));
        D(u[P], N, m, null, w, b, L, k, F);
      }
      A > O ? Re(u, w, b, !0, !1, T) : $(g, m, v, w, b, L, k, F, T);
    },
    t2 = (u, g, m, v, w, b, L, k, F) => {
      let A = 0;
      const O = g.length;
      let T = u.length - 1,
        P = O - 1;
      for (; A <= T && A <= P; ) {
        const N = u[A],
          q = (g[A] = F ? q2(g[A]) : x2(g[A]));
        if (te(N, q)) D(N, q, m, null, w, b, L, k, F);
        else break;
        A++;
      }
      for (; A <= T && A <= P; ) {
        const N = u[T],
          q = (g[P] = F ? q2(g[P]) : x2(g[P]));
        if (te(N, q)) D(N, q, m, null, w, b, L, k, F);
        else break;
        (T--, P--);
      }
      if (A > T) {
        if (A <= P) {
          const N = P + 1,
            q = N < O ? g[N].el : v;
          for (; A <= P; ) (D(null, (g[A] = F ? q2(g[A]) : x2(g[A])), m, q, w, b, L, k, F), A++);
        }
      } else if (A > P) for (; A <= T; ) (R2(u[A], w, b, !0), A++);
      else {
        const N = A,
          q = A,
          e2 = new Map();
        for (A = q; A <= P; A++) {
          const v2 = (g[A] = F ? q2(g[A]) : x2(g[A]));
          v2.key != null && e2.set(v2.key, A);
        }
        let Q,
          c2 = 0;
        const u2 = P - q + 1;
        let S2 = !1,
          A2 = 0;
        const Oe = new Array(u2);
        for (A = 0; A < u2; A++) Oe[A] = 0;
        for (A = N; A <= T; A++) {
          const v2 = u[A];
          if (c2 >= u2) {
            R2(v2, w, b, !0);
            continue;
          }
          let O2;
          if (v2.key != null) O2 = e2.get(v2.key);
          else
            for (Q = q; Q <= P; Q++)
              if (Oe[Q - q] === 0 && te(v2, g[Q])) {
                O2 = Q;
                break;
              }
          O2 === void 0
            ? R2(v2, w, b, !0)
            : ((Oe[O2 - q] = A + 1),
              O2 >= A2 ? (A2 = O2) : (S2 = !0),
              D(v2, g[O2], m, null, w, b, L, k, F),
              c2++);
        }
        const Ar = S2 ? f3(Oe) : Ae;
        for (Q = Ar.length - 1, A = u2 - 1; A >= 0; A--) {
          const v2 = q + A,
            O2 = g[v2],
            vr = g[v2 + 1],
            xr = v2 + 1 < O ? vr.el || Sn(vr) : v;
          Oe[A] === 0
            ? D(null, O2, m, xr, w, b, L, k, F)
            : S2 && (Q < 0 || A !== Ar[Q] ? o2(O2, m, xr, 2) : Q--);
        }
      }
    },
    o2 = (u, g, m, v, w = null) => {
      const { el: b, type: L, transition: k, children: F, shapeFlag: A } = u;
      if (A & 6) {
        o2(u.component.subTree, g, m, v);
        return;
      }
      if (A & 128) {
        u.suspense.move(g, m, v);
        return;
      }
      if (A & 64) {
        L.move(u, g, m, De);
        return;
      }
      if (L === M2) {
        s(b, g, m);
        for (let T = 0; T < F.length; T++) o2(F[T], g, m, v);
        s(u.anchor, g, m);
        return;
      }
      if (L === Ge) {
        y(u, g, m);
        return;
      }
      if (v !== 2 && A & 1 && k)
        if (v === 0)
          k.persisted && !b[n0]
            ? s(b, g, m)
            : (k.beforeEnter(b), s(b, g, m), _2(() => k.enter(b), w));
        else {
          const { leave: T, delayLeave: P, afterLeave: N } = k,
            q = () => {
              u.ctx.isUnmounted ? n(b) : s(b, g, m);
            },
            e2 = () => {
              const Q = b._isLeaving || !!b[n0];
              (b._isLeaving && b[n0](!0),
                k.persisted && !Q
                  ? q()
                  : T(b, () => {
                      (q(), N && N());
                    }));
            };
          P ? P(b, q, e2) : e2();
        }
      else s(b, g, m);
    },
    R2 = (u, g, m, v = !1, w = !1) => {
      const {
        type: b,
        props: L,
        ref: k,
        children: F,
        dynamicChildren: A,
        shapeFlag: O,
        patchFlag: T,
        dirs: P,
        cacheIndex: N,
        memo: q,
      } = u;
      if (
        (T === -2 && (w = !1),
        k != null && (B2(), Fe(k, null, m, u, !0), $2()),
        N != null && (g.renderCache[N] = void 0),
        O & 256)
      ) {
        g.ctx.deactivate(u);
        return;
      }
      const e2 = O & 1 && P,
        Q = !ke(u);
      let c2;
      if ((Q && (c2 = L && L.onVnodeBeforeUnmount) && F2(c2, g, u), O & 6)) Ao(u.component, m, v);
      else {
        if (O & 128) {
          u.suspense.unmount(m, v);
          return;
        }
        (e2 && I2(u, null, g, 'beforeUnmount'),
          O & 64
            ? u.type.remove(u, g, m, De, v)
            : A && !A.hasOnce && (b !== M2 || (T > 0 && T & 64))
              ? Re(A, g, m, !1, !0)
              : ((b === M2 && T & 384) || (!w && O & 16)) && Re(F, g, m),
          v && br(u));
      }
      const u2 = q != null && N == null;
      ((Q && (c2 = L && L.onVnodeUnmounted)) || e2 || u2) &&
        _2(() => {
          (c2 && F2(c2, g, u), e2 && I2(u, null, g, 'unmounted'), u2 && (u.el = null));
        }, m);
    },
    br = (u) => {
      const { type: g, el: m, anchor: v, transition: w } = u;
      if (g === M2) {
        wo(m, v);
        return;
      }
      if (g === Ge) {
        _(u);
        return;
      }
      const b = () => {
        (n(m), w && !w.persisted && w.afterLeave && w.afterLeave());
      };
      if (u.shapeFlag & 1 && w && !w.persisted) {
        const { leave: L, delayLeave: k } = w,
          F = () => L(m, b);
        k ? k(u.el, b, F) : F();
      } else b();
    },
    wo = (u, g) => {
      let m;
      for (; u !== g; ) ((m = h(u)), n(u), (u = m));
      n(g);
    },
    Ao = (u, g, m) => {
      const { bum: v, scope: w, job: b, subTree: L, um: k, m: F, a: A } = u;
      (Gr(F),
        Gr(A),
        v && Yt(v),
        w.stop(),
        b && ((b.flags |= 8), R2(L, u, g, m)),
        k && _2(k, g),
        _2(() => {
          u.isUnmounted = !0;
        }, g));
    },
    Re = (u, g, m, v = !1, w = !1, b = 0) => {
      for (let L = b; L < u.length; L++) R2(u[L], g, m, v, w);
    },
    ot = (u) => {
      if (u.shapeFlag & 6) return ot(u.component.subTree);
      if (u.shapeFlag & 128) return u.suspense.next();
      const g = h(u.anchor || u.el),
        m = g && g[bi];
      return m ? h(m) : g;
    };
  let Kt = !1;
  const wr = (u, g, m) => {
      let v;
      (u == null
        ? g._vnode && (R2(g._vnode, null, null, !0), (v = g._vnode.component))
        : D(g._vnode || null, u, g, null, null, null, m),
        (g._vnode = u),
        Kt || ((Kt = !0), Tr(v), mt(), (Kt = !1)));
    },
    De = { p: D, um: R2, m: o2, r: br, mt: n2, mc: $, pc: B, pbc: j, n: ot, o: e };
  let Jt, zt;
  return (t && ([Jt, zt] = t(De)), { render: wr, hydrate: Jt, createApp: Ki(wr, Jt) });
}
function a0({ type: e, props: t }, r) {
  return (r === 'svg' && e === 'foreignObject') ||
    (r === 'mathml' && e === 'annotation-xml' && t && t.encoding && t.encoding.includes('html'))
    ? void 0
    : r;
}
function ne({ effect: e, job: t }, r) {
  r ? ((e.flags |= 32), (t.flags |= 4)) : ((e.flags &= -33), (t.flags &= -5));
}
function Fn(e, t) {
  return (!e || (e && !e.pendingBranch)) && t && !t.persisted;
}
function kn(e, t, r = !1) {
  const s = e.children,
    n = t.children;
  if (V(s) && V(n))
    for (let o = 0; o < s.length; o++) {
      const i = s[o];
      let a = n[o];
      (a.shapeFlag & 1 &&
        !a.dynamicChildren &&
        ((a.patchFlag <= 0 || a.patchFlag === 32) && ((a = n[o] = q2(n[o])), (a.el = i.el)),
        !r && a.patchFlag !== -2 && kn(i, a)),
        a.type === he && (a.patchFlag === -1 && (a = n[o] = q2(a)), (a.el = i.el)),
        a.type === X2 && !a.el && (a.el = i.el));
    }
}
function f3(e) {
  const t = e.slice(),
    r = [0];
  let s, n, o, i, a;
  const l = e.length;
  for (s = 0; s < l; s++) {
    const d = e[s];
    if (d !== 0) {
      if (((n = r[r.length - 1]), e[n] < d)) {
        ((t[s] = n), r.push(s));
        continue;
      }
      for (o = 0, i = r.length - 1; o < i; )
        ((a = (o + i) >> 1), e[r[a]] < d ? (o = a + 1) : (i = a));
      d < e[r[o]] && (o > 0 && (t[s] = r[o - 1]), (r[o] = s));
    }
  }
  for (o = r.length, i = r[o - 1]; o-- > 0; ) ((r[o] = i), (i = t[i]));
  return r;
}
function Ln(e) {
  const t = e.subTree.component;
  if (t) return t.asyncDep && !t.asyncResolved ? t : Ln(t);
}
function Gr(e) {
  if (e) for (let t = 0; t < e.length; t++) e[t].flags |= 8;
}
function Sn(e) {
  if (e.placeholder) return e.placeholder;
  const t = e.component;
  return t ? Sn(t.subTree) : null;
}
const Mn = (e) => e.__isSuspense;
let x0 = 0;
const u3 = {
    name: 'Suspense',
    __isSuspense: !0,
    process(e, t, r, s, n, o, i, a, l, d) {
      if (e == null) p3(t, r, s, n, o, i, a, l, d);
      else {
        if (o && o.deps > 0 && !e.suspense.isInFallback) {
          ((t.suspense = e.suspense), (t.suspense.vnode = t), (t.el = e.el));
          return;
        }
        h3(e, t, r, s, n, i, a, l, d);
      }
    },
    hydrate: g3,
    normalize: C3,
  },
  d3 = u3;
function Xe(e, t) {
  const r = e.props && e.props[t];
  I(r) && r();
}
function p3(e, t, r, s, n, o, i, a, l) {
  const {
      p: d,
      o: { createElement: c },
    } = l,
    f = c('div'),
    h = (e.suspense = Tn(e, n, s, t, f, r, o, i, a, l));
  (d(null, (h.pendingBranch = e.ssContent), f, null, s, h, o, i),
    h.deps > 0
      ? (Xe(e, 'onPending'),
        Xe(e, 'onFallback'),
        d(null, e.ssFallback, t, r, s, null, o, i),
        Le(h, e.ssFallback))
      : h.resolve(!1, !0));
}
function h3(e, t, r, s, n, o, i, a, { p: l, um: d, o: { createElement: c } }) {
  const f = (t.suspense = e.suspense);
  ((f.vnode = t), (t.el = e.el));
  const h = t.ssContent,
    p = t.ssFallback,
    { activeBranch: C, pendingBranch: D, isInFallback: M, isHydrating: x } = f;
  if (D)
    ((f.pendingBranch = h),
      te(D, h)
        ? (l(D, h, f.hiddenContainer, null, n, f, o, i, a),
          f.deps <= 0 ? f.resolve() : M && (x || (l(C, p, r, s, n, null, o, i, a), Le(f, p))))
        : ((f.pendingId = x0++),
          x ? ((f.isHydrating = !1), (f.activeBranch = D)) : d(D, n, f),
          (f.deps = 0),
          (f.effects.length = 0),
          (f.hiddenContainer = c('div')),
          M
            ? (l(null, h, f.hiddenContainer, null, n, f, o, i, a),
              f.deps <= 0 ? f.resolve() : (l(C, p, r, s, n, null, o, i, a), Le(f, p)))
            : C && te(C, h)
              ? (l(C, h, r, s, n, f, o, i, a), f.resolve(!0))
              : (l(null, h, f.hiddenContainer, null, n, f, o, i, a), f.deps <= 0 && f.resolve())));
  else if (C && te(C, h)) (l(C, h, r, s, n, f, o, i, a), Le(f, h));
  else if (
    (Xe(t, 'onPending'),
    (f.pendingBranch = h),
    h.shapeFlag & 512 ? (f.pendingId = h.component.suspenseId) : (f.pendingId = x0++),
    l(null, h, f.hiddenContainer, null, n, f, o, i, a),
    f.deps <= 0)
  )
    f.resolve();
  else {
    const { timeout: S, pendingId: y } = f;
    S > 0
      ? setTimeout(() => {
          f.pendingId === y && f.fallback(p);
        }, S)
      : S === 0 && f.fallback(p);
  }
}
function Tn(e, t, r, s, n, o, i, a, l, d, c = !1) {
  const {
    p: f,
    m: h,
    um: p,
    n: C,
    o: { parentNode: D, remove: M },
  } = d;
  let x;
  const S = D3(e);
  S && t && t.pendingBranch && ((x = t.pendingId), t.deps++);
  const y = e.props ? So(e.props.timeout) : void 0,
    _ = o,
    E = {
      vnode: e,
      parent: t,
      parentComponent: r,
      namespace: i,
      container: s,
      hiddenContainer: n,
      deps: 0,
      pendingId: x0++,
      timeout: typeof y == 'number' ? y : -1,
      activeBranch: null,
      isFallbackMountPending: !1,
      pendingBranch: null,
      isInFallback: !c,
      isHydrating: c,
      isUnmounted: !1,
      effects: [],
      resolve(H = !1, U = !1) {
        const {
          vnode: $,
          activeBranch: W,
          pendingBranch: j,
          pendingId: G,
          effects: z,
          parentComponent: Y,
          container: n2,
          isInFallback: l2,
        } = E;
        let R = !1;
        if (E.isHydrating) E.isHydrating = !1;
        else if (!H) {
          R = W && j.transition && j.transition.mode === 'out-in';
          let C2 = !1;
          (R &&
            (W.transition.afterLeave = () => {
              G === E.pendingId &&
                (h(j, n2, o === _ && !C2 ? C(W) : o, 0),
                E0(z),
                l2 && $.ssFallback && ($.ssFallback.el = null));
            }),
            W &&
              !E.isFallbackMountPending &&
              (D(W.el) === n2 && ((o = C(W)), (C2 = !0)),
              p(W, Y, E, !0),
              !R && l2 && $.ssFallback && _2(() => ($.ssFallback.el = null), E)),
            R || h(j, n2, o, 0));
        }
        ((E.isFallbackMountPending = !1),
          Le(E, j),
          (E.pendingBranch = null),
          (E.isInFallback = !1));
        let Z = E.parent,
          B = !1;
        for (; Z; ) {
          if (Z.pendingBranch) {
            (Z.effects.push(...z), (B = !0));
            break;
          }
          Z = Z.parent;
        }
        (!B && !R && E0(z),
          (E.effects = []),
          S &&
            t &&
            t.pendingBranch &&
            x === t.pendingId &&
            (t.deps--, t.deps === 0 && !U && t.resolve()),
          Xe($, 'onResolve'));
      },
      fallback(H) {
        if (!E.pendingBranch) return;
        const { vnode: U, activeBranch: $, parentComponent: W, container: j, namespace: G } = E;
        Xe(U, 'onFallback');
        const z = C($),
          Y = () => {
            ((E.isFallbackMountPending = !1),
              E.isInFallback && (f(null, H, j, z, W, null, G, a, l), Le(E, H)));
          },
          n2 = H.transition && H.transition.mode === 'out-in';
        (n2 && ((E.isFallbackMountPending = !0), ($.transition.afterLeave = Y)),
          (E.isInFallback = !0),
          p($, W, null, !0),
          n2 || Y());
      },
      move(H, U, $) {
        (E.activeBranch && h(E.activeBranch, H, U, $), (E.container = H));
      },
      next() {
        return E.activeBranch && C(E.activeBranch);
      },
      registerDep(H, U, $) {
        const W = !!E.pendingBranch;
        W && E.deps++;
        const j = H.vnode.el;
        H.asyncDep
          .catch((G) => {
            He(G, H, 0);
          })
          .then((G) => {
            if (H.isUnmounted || E.isUnmounted || E.pendingId !== H.suspenseId) return;
            (k0(), (H.asyncResolved = !0));
            const { vnode: z } = H;
            (L0(H, G), j && (z.el = j));
            const Y = !j && H.subTree.el;
            (U(H, z, D(j || H.subTree.el), j ? null : C(H.subTree), E, i, $),
              Y && ((z.placeholder = null), M(Y)),
              $t(H, z.el),
              W && --E.deps === 0 && E.resolve());
          });
      },
      unmount(H, U) {
        ((E.isUnmounted = !0),
          E.activeBranch && p(E.activeBranch, r, H, U),
          E.pendingBranch && p(E.pendingBranch, r, H, U));
      },
    };
  return E;
}
function g3(e, t, r, s, n, o, i, a, l) {
  const d = (t.suspense = Tn(
      t,
      s,
      r,
      e.parentNode,
      document.createElement('div'),
      null,
      n,
      o,
      i,
      a,
      !0,
    )),
    c = l(e, (d.pendingBranch = t.ssContent), r, d, o, i);
  return (d.deps === 0 && d.resolve(!1, !0), c);
}
function C3(e) {
  const { shapeFlag: t, children: r } = e,
    s = t & 32;
  ((e.ssContent = Wr(s ? r.default : r)), (e.ssFallback = s ? Wr(r.fallback) : d2(X2)));
}
function Wr(e) {
  let t;
  if (I(e)) {
    const r = Se && e._c;
    (r && ((e._d = !1), Z2()), (e = e()), r && ((e._d = !0), (t = w2), Pn()));
  }
  return (
    V(e) && (e = Yi(e)),
    (e = x2(e)),
    t && !e.dynamicChildren && (e.dynamicChildren = t.filter((r) => r !== e)),
    e
  );
}
function Hn(e, t) {
  t && t.pendingBranch ? (V(e) ? t.effects.push(...e) : t.effects.push(e)) : E0(e);
}
function Le(e, t) {
  e.activeBranch = t;
  const { vnode: r, parentComponent: s } = e;
  let n = t.el;
  for (; !n && t.component; ) ((t = t.component.subTree), (n = t.el));
  ((r.el = n), s && s.subTree === r && ((s.vnode.el = n), $t(s, n)));
}
function D3(e) {
  const t = e.props && e.props.suspensible;
  return t != null && t !== !1;
}
const M2 = Symbol.for('v-fgt'),
  he = Symbol.for('v-txt'),
  X2 = Symbol.for('v-cmt'),
  Ge = Symbol.for('v-stc'),
  We = [];
let w2 = null;
function Z2(e = !1) {
  We.push((w2 = e ? null : []));
}
function Pn() {
  (We.pop(), (w2 = We[We.length - 1] || null));
}
let Se = 1;
function vt(e, t = !1) {
  ((Se += e), e < 0 && w2 && t && (w2.hasOnce = !0));
}
function Rn(e) {
  return ((e.dynamicChildren = Se > 0 ? w2 || Ae : null), Pn(), Se > 0 && w2 && w2.push(e), e);
}
function On(e, t, r, s, n, o) {
  return Rn(ae(e, t, r, s, n, o, !0));
}
function Ee(e, t, r, s, n) {
  return Rn(d2(e, t, r, s, n, !0));
}
function Ye(e) {
  return e ? e.__v_isVNode === !0 : !1;
}
function te(e, t) {
  return e.type === t.type && e.key === t.key;
}
const Un = ({ key: e }) => e ?? null,
  gt = ({ ref: e, ref_key: t, ref_for: r }) => (
    typeof e == 'number' && (e = '' + e),
    e != null ? (i2(e) || f2(e) || I(e) ? { i: T2, r: e, k: t, f: !!r } : e) : null
  );
function ae(e, t = null, r = null, s = 0, n = null, o = e === M2 ? 0 : 1, i = !1, a = !1) {
  const l = {
    __v_isVNode: !0,
    __v_skip: !0,
    type: e,
    props: t,
    key: t && Un(t),
    ref: t && gt(t),
    scopeId: Qs,
    slotScopeIds: null,
    children: r,
    component: null,
    suspense: null,
    ssContent: null,
    ssFallback: null,
    dirs: null,
    transition: null,
    el: null,
    anchor: null,
    target: null,
    targetStart: null,
    targetAnchor: null,
    staticCount: 0,
    shapeFlag: o,
    patchFlag: s,
    dynamicProps: n,
    dynamicChildren: null,
    appContext: null,
    ctx: T2,
  };
  return (
    a ? (xt(l, r), o & 128 && e.normalize(l)) : r && (l.shapeFlag |= i2(r) ? 8 : 16),
    Se > 0 && !i && w2 && (l.patchFlag > 0 || o & 6) && l.patchFlag !== 32 && w2.push(l),
    l
  );
}
const d2 = y3;
function y3(e, t = null, r = null, s = 0, n = null, o = !1) {
  if (((!e || e === un) && (e = X2), Ye(e))) {
    const a = Me(e, t, !0);
    return (
      r && xt(a, r),
      Se > 0 && !o && w2 && (a.shapeFlag & 6 ? (w2[w2.indexOf(e)] = a) : w2.push(a)),
      (a.patchFlag = -2),
      a
    );
  }
  if ((k3(e) && (e = e.__vccOpts), t)) {
    t = In(t);
    let { class: a, style: l } = t;
    (a && !i2(a) && (t.class = It(a)),
      X(l) && (Nt(l) && !V(l) && (l = g2({}, l)), (t.style = Ut(l))));
  }
  const i = i2(e) ? 1 : Mn(e) ? 128 : wi(e) ? 64 : X(e) ? 4 : I(e) ? 2 : 0;
  return ae(e, t, r, s, n, i, o, !0);
}
function In(e) {
  return e ? (Nt(e) || mn(e) ? g2({}, e) : e) : null;
}
function Me(e, t, r = !1, s = !1) {
  const { props: n, ref: o, patchFlag: i, children: a, transition: l } = e,
    d = t ? _3(n || {}, t) : n,
    c = {
      __v_isVNode: !0,
      __v_skip: !0,
      type: e.type,
      props: d,
      key: d && Un(d),
      ref: t && t.ref ? (r && o ? (V(o) ? o.concat(gt(t)) : [o, gt(t)]) : gt(t)) : o,
      scopeId: e.scopeId,
      slotScopeIds: e.slotScopeIds,
      children: a,
      target: e.target,
      targetStart: e.targetStart,
      targetAnchor: e.targetAnchor,
      staticCount: e.staticCount,
      shapeFlag: e.shapeFlag,
      patchFlag: t && e.type !== M2 ? (i === -1 ? 16 : i | 16) : i,
      dynamicProps: e.dynamicProps,
      dynamicChildren: e.dynamicChildren,
      appContext: e.appContext,
      dirs: e.dirs,
      transition: l,
      component: e.component,
      suspense: e.suspense,
      ssContent: e.ssContent && Me(e.ssContent),
      ssFallback: e.ssFallback && Me(e.ssFallback),
      placeholder: e.placeholder,
      el: e.el,
      anchor: e.anchor,
      ctx: e.ctx,
      ce: e.ce,
    };
  return (l && s && sr(c, l.clone(c)), c);
}
function Nn(e = ' ', t = 0) {
  return d2(he, null, e, t);
}
function l0(e, t) {
  const r = d2(Ge, null, e);
  return ((r.staticCount = t), r);
}
function x2(e) {
  return e == null || typeof e == 'boolean'
    ? d2(X2)
    : V(e)
      ? d2(M2, null, e.slice())
      : Ye(e)
        ? q2(e)
        : d2(he, null, String(e));
}
function q2(e) {
  return (e.el === null && e.patchFlag !== -1) || e.memo ? e : Me(e);
}
function xt(e, t) {
  let r = 0;
  const { shapeFlag: s } = e;
  if (t == null) t = null;
  else if (V(t)) r = 16;
  else if (typeof t == 'object')
    if (s & 65) {
      const n = t.default;
      n && (n._c && (n._d = !1), xt(e, n()), n._c && (n._d = !0));
      return;
    } else {
      r = 32;
      const n = t._;
      !n && !mn(t)
        ? (t._ctx = T2)
        : n === 3 && T2 && (T2.slots._ === 1 ? (t._ = 1) : ((t._ = 2), (e.patchFlag |= 1024)));
    }
  else if (I(t)) {
    if (s & 65) {
      xt(e, { default: t });
      return;
    }
    ((t = { default: t, _ctx: T2 }), (r = 32));
  } else ((t = String(t)), s & 64 ? ((r = 16), (t = [Nn(t)])) : (r = 8));
  ((e.children = t), (e.shapeFlag |= r));
}
function _3(...e) {
  const t = {};
  for (let r = 0; r < e.length; r++) {
    const s = e[r];
    for (const n in s)
      if (n === 'class') t.class !== s.class && (t.class = It([t.class, s.class]));
      else if (n === 'style') t.style = Ut([t.style, s.style]);
      else if (tt(n)) {
        const o = t[n],
          i = s[n];
        i && o !== i && !(V(o) && o.includes(i))
          ? (t[n] = o ? [].concat(o, i) : i)
          : i == null && o == null && !Tt(n) && (t[n] = i);
      } else n !== '' && (t[n] = s[n]);
  }
  return t;
}
function F2(e, t, r, s = null) {
  P2(e, t, 7, [r, s]);
}
const m3 = gn();
let E3 = 0;
function b3(e, t, r) {
  const s = e.type,
    n = (t ? t.appContext : e.appContext) || m3,
    o = {
      uid: E3++,
      vnode: e,
      type: s,
      parent: t,
      appContext: n,
      root: null,
      next: null,
      subTree: null,
      effect: null,
      update: null,
      job: null,
      scope: new Ms(!0),
      render: null,
      proxy: null,
      exposed: null,
      exposeProxy: null,
      withProxy: null,
      provides: t ? t.provides : Object.create(n.provides),
      ids: t ? t.ids : ['', 0, 0],
      accessCache: null,
      renderCache: [],
      components: null,
      directives: null,
      propsOptions: bn(s, n),
      emitsOptions: Cn(s, n),
      emit: null,
      emitted: null,
      propsDefaults: s2,
      inheritAttrs: s.inheritAttrs,
      ctx: s2,
      data: s2,
      props: s2,
      attrs: s2,
      slots: s2,
      refs: s2,
      setupState: s2,
      setupContext: null,
      suspense: r,
      suspenseId: r ? r.pendingId : 0,
      asyncDep: null,
      asyncResolved: !1,
      isMounted: !1,
      isUnmounted: !1,
      isDeactivated: !1,
      bc: null,
      c: null,
      bm: null,
      m: null,
      bu: null,
      u: null,
      um: null,
      bum: null,
      da: null,
      a: null,
      rtg: null,
      rtc: null,
      ec: null,
      sp: null,
    };
  return (
    (o.ctx = { _: o }),
    (o.root = t ? t.root : o),
    (o.emit = zi.bind(null, o)),
    e.ce && e.ce(o),
    o
  );
}
let h2 = null;
const Gt = () => h2 || T2;
let Ft, F0;
{
  const e = Ot(),
    t = (r, s) => {
      let n;
      return (
        (n = e[r]) || (n = e[r] = []),
        n.push(s),
        (o) => {
          n.length > 1 ? n.forEach((i) => i(o)) : n[0](o);
        }
      );
    };
  ((Ft = t('__VUE_INSTANCE_SETTERS__', (r) => (h2 = r))),
    (F0 = t('__VUE_SSR_SETTERS__', (r) => (Te = r))));
}
const nt = (e) => {
    const t = h2;
    return (
      Ft(e),
      e.scope.on(),
      () => {
        (e.scope.off(), Ft(t));
      }
    );
  },
  k0 = () => {
    (h2 && h2.scope.off(), Ft(null));
  };
function Vn(e) {
  return e.vnode.shapeFlag & 4;
}
let Te = !1;
function w3(e, t = !1, r = !1) {
  t && F0(t);
  const { props: s, children: n } = e.vnode,
    o = Vn(e);
  (r3(e, s, o, t), i3(e, n, r || t));
  const i = o ? A3(e, t) : void 0;
  return (t && F0(!1), i);
}
function A3(e, t) {
  const r = e.type;
  ((e.accessCache = Object.create(null)), (e.proxy = new Proxy(e.ctx, ji)));
  const { setup: s } = r;
  if (s) {
    B2();
    const n = (e.setupContext = s.length > 1 ? x3(e) : null),
      o = nt(e),
      i = st(s, e, 0, [e.props, n]),
      a = ws(i);
    if (($2(), o(), (a || e.sp) && !ke(e) && nr(e), a)) {
      if ((i.then(k0, k0), t))
        return i
          .then((l) => {
            L0(e, l);
          })
          .catch((l) => {
            He(l, e, 0);
          });
      e.asyncDep = i;
    } else L0(e, i);
  } else jn(e);
}
function L0(e, t, r) {
  (I(t)
    ? e.type.__ssrInlineRender
      ? (e.ssrRender = t)
      : (e.render = t)
    : X(t) && (e.setupState = Ks(t)),
    jn(e));
}
function jn(e, t, r) {
  const s = e.type;
  e.render || (e.render = s.render || j2);
  {
    const n = nt(e);
    B2();
    try {
      Bi(e);
    } finally {
      ($2(), n());
    }
  }
}
const v3 = {
  get(e, t) {
    return (D2(e, 'get', ''), e[t]);
  },
};
function x3(e) {
  const t = (r) => {
    e.exposed = r || {};
  };
  return { attrs: new Proxy(e.attrs, v3), slots: e.slots, emit: e.emit, expose: t };
}
function fr(e) {
  return e.exposed
    ? e.exposeProxy ||
        (e.exposeProxy = new Proxy(Ks(ni(e.exposed)), {
          get(t, r) {
            if (r in t) return t[r];
            if (r in $e) return $e[r](e);
          },
          has(t, r) {
            return r in t || r in $e;
          },
        }))
    : e.proxy;
}
function F3(e, t = !0) {
  return I(e) ? e.displayName || e.name : e.name || (t && e.__name);
}
function k3(e) {
  return I(e) && '__vccOpts' in e;
}
const Bn = (e, t) => pi(e, t, Te);
function L3(e, t, r) {
  try {
    vt(-1);
    const s = arguments.length;
    return s === 2
      ? X(t) && !V(t)
        ? Ye(t)
          ? d2(e, null, [t])
          : d2(e, t)
        : d2(e, null, t)
      : (s > 3 ? (r = Array.prototype.slice.call(arguments, 2)) : s === 3 && Ye(r) && (r = [r]),
        d2(e, t, r));
  } finally {
    vt(1);
  }
}
const S3 = '3.5.39';
let S0;
const Zr = typeof window < 'u' && window.trustedTypes;
if (Zr)
  try {
    S0 = Zr.createPolicy('vue', { createHTML: (e) => e });
  } catch {}
const $n = S0 ? (e) => S0.createHTML(e) : (e) => e,
  M3 = 'http://www.w3.org/2000/svg',
  T3 = 'http://www.w3.org/1998/Math/MathML',
  W2 = typeof document < 'u' ? document : null,
  qr = W2 && W2.createElement('template'),
  H3 = {
    insert: (e, t, r) => {
      t.insertBefore(e, r || null);
    },
    remove: (e) => {
      const t = e.parentNode;
      t && t.removeChild(e);
    },
    createElement: (e, t, r, s) => {
      const n =
        t === 'svg'
          ? W2.createElementNS(M3, e)
          : t === 'mathml'
            ? W2.createElementNS(T3, e)
            : r
              ? W2.createElement(e, { is: r })
              : W2.createElement(e);
      return (
        e === 'select' && s && s.multiple != null && n.setAttribute('multiple', s.multiple),
        n
      );
    },
    createText: (e) => W2.createTextNode(e),
    createComment: (e) => W2.createComment(e),
    setText: (e, t) => {
      e.nodeValue = t;
    },
    setElementText: (e, t) => {
      e.textContent = t;
    },
    parentNode: (e) => e.parentNode,
    nextSibling: (e) => e.nextSibling,
    querySelector: (e) => W2.querySelector(e),
    setScopeId(e, t) {
      e.setAttribute(t, '');
    },
    insertStaticContent(e, t, r, s, n, o) {
      const i = r ? r.previousSibling : t.lastChild;
      if (n && (n === o || n.nextSibling))
        for (; t.insertBefore(n.cloneNode(!0), r), !(n === o || !(n = n.nextSibling)); );
      else {
        qr.innerHTML = $n(
          s === 'svg' ? `<svg>${e}</svg>` : s === 'mathml' ? `<math>${e}</math>` : e,
        );
        const a = qr.content;
        if (s === 'svg' || s === 'mathml') {
          const l = a.firstChild;
          for (; l.firstChild; ) a.appendChild(l.firstChild);
          a.removeChild(l);
        }
        t.insertBefore(a, r);
      }
      return [i ? i.nextSibling : t.firstChild, r ? r.previousSibling : t.lastChild];
    },
  },
  P3 = Symbol('_vtc');
function R3(e, t, r) {
  const s = e[P3];
  (s && (t = (t ? [t, ...s] : [...s]).join(' ')),
    t == null ? e.removeAttribute('class') : r ? e.setAttribute('class', t) : (e.className = t));
}
const Kr = Symbol('_vod'),
  O3 = Symbol('_vsh'),
  U3 = Symbol(''),
  I3 = /(?:^|;)\s*display\s*:/;
function N3(e, t, r) {
  const s = e.style,
    n = i2(r);
  let o = !1;
  if (r && !n) {
    if (t)
      if (i2(t))
        for (const i of t.split(';')) {
          const a = i.slice(0, i.indexOf(':')).trim();
          r[a] == null && Ve(s, a, '');
        }
      else for (const i in t) r[i] == null && Ve(s, i, '');
    for (const i in r) {
      i === 'display' && (o = !0);
      const a = r[i];
      a != null ? j3(e, i, !i2(t) && t ? t[i] : void 0, a) || Ve(s, i, a) : Ve(s, i, '');
    }
  } else if (n) {
    if (t !== r) {
      const i = s[U3];
      (i && (r += ';' + i), (s.cssText = r), (o = I3.test(r)));
    }
  } else t && e.removeAttribute('style');
  Kr in e && ((e[Kr] = o ? s.display : ''), e[O3] && (s.display = 'none'));
}
const Jr = /\s*!important$/;
function Ve(e, t, r) {
  if (V(r)) r.forEach((s) => Ve(e, t, s));
  else if ((r == null && (r = ''), t.startsWith('--'))) e.setProperty(t, r);
  else {
    const s = V3(e, t);
    Jr.test(r) ? e.setProperty(Ce(s), r.replace(Jr, ''), 'important') : (e[s] = r);
  }
}
const zr = ['Webkit', 'Moz', 'ms'],
  c0 = {};
function V3(e, t) {
  const r = c0[t];
  if (r) return r;
  let s = E2(t);
  if (s !== 'filter' && s in e) return (c0[t] = s);
  s = Rt(s);
  for (let n = 0; n < zr.length; n++) {
    const o = zr[n] + s;
    if (o in e) return (c0[t] = o);
  }
  return t;
}
function j3(e, t, r, s) {
  return e.tagName === 'TEXTAREA' && (t === 'width' || t === 'height') && i2(s) && r === s;
}
const Xr = 'http://www.w3.org/1999/xlink';
function Yr(e, t, r, s, n, o = Uo(t)) {
  s && t.startsWith('xlink:')
    ? r == null
      ? e.removeAttributeNS(Xr, t.slice(6, t.length))
      : e.setAttributeNS(Xr, t, r)
    : r == null || (o && !Fs(r))
      ? e.removeAttribute(t)
      : e.setAttribute(t, o ? '' : L2(r) ? String(r) : r);
}
function Qr(e, t, r, s, n) {
  if (t === 'innerHTML' || t === 'textContent') {
    r != null && (e[t] = t === 'innerHTML' ? $n(r) : r);
    return;
  }
  const o = e.tagName;
  if (t === 'value' && o !== 'PROGRESS' && !o.includes('-')) {
    const a = o === 'OPTION' ? e.getAttribute('value') || '' : e.value,
      l = r == null ? (e.type === 'checkbox' ? 'on' : '') : String(r);
    ((a !== l || !('_value' in e)) && (e.value = l),
      r == null && e.removeAttribute(t),
      (e._value = r));
    return;
  }
  let i = !1;
  if (r === '' || r == null) {
    const a = typeof e[t];
    a === 'boolean'
      ? (r = Fs(r))
      : r == null && a === 'string'
        ? ((r = ''), (i = !0))
        : a === 'number' && ((r = 0), (i = !0));
  }
  try {
    e[t] = r;
  } catch {}
  i && e.removeAttribute(n || t);
}
function B3(e, t, r, s) {
  e.addEventListener(t, r, s);
}
function $3(e, t, r, s) {
  e.removeEventListener(t, r, s);
}
const es = Symbol('_vei');
function G3(e, t, r, s, n = null) {
  const o = e[es] || (e[es] = {}),
    i = o[t];
  if (s && i) i.value = s;
  else {
    const [a, l] = q3(t);
    if (s) {
      const d = (o[t] = z3(s, n));
      B3(e, a, d, l);
    } else i && ($3(e, a, i, l), (o[t] = void 0));
  }
}
const W3 = /(Once|Passive|Capture)$/,
  Z3 = /^on:?(?:Once|Passive|Capture)$/;
function q3(e) {
  let t, r;
  for (; (r = e.match(W3)) && !Z3.test(e); )
    (t || (t = {}), (e = e.slice(0, e.length - r[1].length)), (t[r[1].toLowerCase()] = !0));
  return [e[2] === ':' ? e.slice(3) : Ce(e.slice(2)), t];
}
let f0 = 0;
const K3 = Promise.resolve(),
  J3 = () => f0 || (K3.then(() => (f0 = 0)), (f0 = Date.now()));
function z3(e, t) {
  const r = (s) => {
    if (!s._vts) s._vts = Date.now();
    else if (s._vts <= r.attached) return;
    const n = r.value;
    if (V(n)) {
      const o = s.stopImmediatePropagation;
      s.stopImmediatePropagation = () => {
        (o.call(s), (s._stopped = !0));
      };
      const i = n.slice(),
        a = [s];
      for (let l = 0; l < i.length && !s._stopped; l++) {
        const d = i[l];
        d && P2(d, t, 5, a);
      }
    } else P2(n, t, 5, [s]);
  };
  return ((r.value = e), (r.attached = J3()), r);
}
const ts = (e) =>
    e.charCodeAt(0) === 111 &&
    e.charCodeAt(1) === 110 &&
    e.charCodeAt(2) > 96 &&
    e.charCodeAt(2) < 123,
  X3 = (e, t, r, s, n, o) => {
    const i = n === 'svg';
    t === 'class'
      ? R3(e, s, i)
      : t === 'style'
        ? N3(e, r, s)
        : tt(t)
          ? Tt(t) || G3(e, t, r, s, o)
          : (
                t[0] === '.'
                  ? ((t = t.slice(1)), !0)
                  : t[0] === '^'
                    ? ((t = t.slice(1)), !1)
                    : Y3(e, t, s, i)
              )
            ? (Qr(e, t, s),
              !e.tagName.includes('-') &&
                (t === 'value' || t === 'checked' || t === 'selected') &&
                Yr(e, t, s, i, o, t !== 'value'))
            : e._isVueCE && (Q3(e, t) || (e._def.__asyncLoader && (/[A-Z]/.test(t) || !i2(s))))
              ? Qr(e, E2(t), s, o, t)
              : (t === 'true-value'
                  ? (e._trueValue = s)
                  : t === 'false-value' && (e._falseValue = s),
                Yr(e, t, s, i));
  };
function Y3(e, t, r, s) {
  if (s) return !!(t === 'innerHTML' || t === 'textContent' || (t in e && ts(t) && I(r)));
  if (
    t === 'spellcheck' ||
    t === 'draggable' ||
    t === 'translate' ||
    t === 'autocorrect' ||
    (t === 'sandbox' && e.tagName === 'IFRAME') ||
    t === 'form' ||
    (t === 'list' && e.tagName === 'INPUT') ||
    (t === 'type' && e.tagName === 'TEXTAREA')
  )
    return !1;
  if (t === 'width' || t === 'height') {
    const n = e.tagName;
    if (n === 'IMG' || n === 'VIDEO' || n === 'CANVAS' || n === 'SOURCE') return !1;
  }
  return ts(t) && i2(r) ? !1 : t in e;
}
function Q3(e, t) {
  const r = e._def.props;
  if (!r) return !1;
  const s = E2(t);
  return Array.isArray(r) ? r.some((n) => E2(n) === s) : Object.keys(r).some((n) => E2(n) === s);
}
const Gn = g2({ patchProp: X3 }, H3);
let Ze,
  rs = !1;
function e1() {
  return Ze || (Ze = l3(Gn));
}
function t1() {
  return ((Ze = rs ? Ze : c3(Gn)), (rs = !0), Ze);
}
const r1 = (...e) => {
    const t = e1().createApp(...e),
      { mount: r } = t;
    return (
      (t.mount = (s) => {
        const n = Zn(s);
        if (!n) return;
        const o = t._component;
        (!I(o) && !o.render && !o.template && (o.template = n.innerHTML),
          n.nodeType === 1 && (n.textContent = ''));
        const i = r(n, !1, Wn(n));
        return (
          n instanceof Element && (n.removeAttribute('v-cloak'), n.setAttribute('data-v-app', '')),
          i
        );
      }),
      t
    );
  },
  s1 = (...e) => {
    const t = t1().createApp(...e),
      { mount: r } = t;
    return (
      (t.mount = (s) => {
        const n = Zn(s);
        if (n) return r(n, !0, Wn(n));
      }),
      t
    );
  };
function Wn(e) {
  if (e instanceof SVGElement) return 'svg';
  if (typeof MathMLElement == 'function' && e instanceof MathMLElement) return 'mathml';
}
function Zn(e) {
  return i2(e) ? document.querySelector(e) : e;
}
const n1 =
    /"(?:_|\\u0{2}5[Ff]){2}(?:p|\\u0{2}70)(?:r|\\u0{2}72)(?:o|\\u0{2}6[Ff])(?:t|\\u0{2}74)(?:o|\\u0{2}6[Ff])(?:_|\\u0{2}5[Ff]){2}"\s*:/,
  o1 =
    /"(?:c|\\u0063)(?:o|\\u006[Ff])(?:n|\\u006[Ee])(?:s|\\u0073)(?:t|\\u0074)(?:r|\\u0072)(?:u|\\u0075)(?:c|\\u0063)(?:t|\\u0074)(?:o|\\u006[Ff])(?:r|\\u0072)"\s*:/,
  i1 = /^\s*["[{]|^\s*-?\d{1,16}(\.\d{1,17})?([Ee][+-]?\d+)?\s*$/;
function a1(e, t) {
  if (e === '__proto__' || (e === 'constructor' && t && typeof t == 'object' && 'prototype' in t)) {
    l1(e);
    return;
  }
  return t;
}
function l1(e) {
  console.warn(`[destr] Dropping "${e}" key to prevent prototype pollution.`);
}
function kt(e, t = {}) {
  if (typeof e != 'string') return e;
  if (e[0] === '"' && e[e.length - 1] === '"' && e.indexOf('\\') === -1) return e.slice(1, -1);
  const r = e.trim();
  if (r.length <= 9)
    switch (r.toLowerCase()) {
      case 'true':
        return !0;
      case 'false':
        return !1;
      case 'undefined':
        return;
      case 'null':
        return null;
      case 'nan':
        return Number.NaN;
      case 'infinity':
        return Number.POSITIVE_INFINITY;
      case '-infinity':
        return Number.NEGATIVE_INFINITY;
    }
  if (!i1.test(e)) {
    if (t.strict) throw new SyntaxError('[destr] Invalid JSON');
    return e;
  }
  try {
    if (n1.test(e) || o1.test(e)) {
      if (t.strict) throw new Error('[destr] Possible prototype pollution');
      return JSON.parse(e, a1);
    }
    return JSON.parse(e);
  } catch (s) {
    if (t.strict) throw s;
    return e;
  }
}
const qn = /#/g,
  Kn = /&/g,
  c1 = /\//g,
  f1 = /=/g,
  u1 = /\?/g,
  Wt = /\+/g,
  d1 = /%5e/gi,
  p1 = /%60/gi,
  h1 = /%7c/gi,
  g1 = /%20/gi,
  C1 = /%2f/gi,
  D1 = /%252f/gi;
function Jn(e) {
  return encodeURI('' + e).replace(h1, '|');
}
function M0(e) {
  return Jn(typeof e == 'string' ? e : JSON.stringify(e))
    .replace(Wt, '%2B')
    .replace(g1, '+')
    .replace(qn, '%23')
    .replace(Kn, '%26')
    .replace(p1, '`')
    .replace(d1, '^')
    .replace(c1, '%2F');
}
function u0(e) {
  return M0(e).replace(f1, '%3D');
}
function y1(e) {
  return Jn(e)
    .replace(qn, '%23')
    .replace(u1, '%3F')
    .replace(D1, '%2F')
    .replace(Kn, '%26')
    .replace(Wt, '%2B');
}
function Qe(e = '') {
  try {
    return decodeURIComponent('' + e);
  } catch {
    return '' + e;
  }
}
function _1(e) {
  return Qe(e.replace(C1, '%252F'));
}
function m1(e) {
  return Qe(e.replace(Wt, ' '));
}
function E1(e) {
  return Qe(e.replace(Wt, ' '));
}
function ur(e = '') {
  const t = Object.create(null);
  e[0] === '?' && (e = e.slice(1));
  for (const r of e.split('&')) {
    const s = r.match(/([^=]+)=?(.*)/) || [];
    if (s.length < 2) continue;
    const n = m1(s[1]);
    if (n === '__proto__' || n === 'constructor') continue;
    const o = E1(s[2] || '');
    t[n] === void 0 ? (t[n] = o) : Array.isArray(t[n]) ? t[n].push(o) : (t[n] = [t[n], o]);
  }
  return t;
}
function b1(e, t) {
  return (
    (typeof t == 'number' || typeof t == 'boolean') && (t = String(t)),
    t
      ? Array.isArray(t)
        ? t.map((r) => `${u0(e)}=${M0(r)}`).join('&')
        : `${u0(e)}=${M0(t)}`
      : u0(e)
  );
}
function zn(e) {
  return Object.keys(e)
    .filter((t) => e[t] !== void 0)
    .map((t) => b1(t, e[t]))
    .filter(Boolean)
    .join('&');
}
const w1 = /^[\s\w\0+.-]{2,}:([/\\]{1,2})/,
  A1 = /^[\s\w\0+.-]{2,}:([/\\]{2})?/,
  v1 = /^([/\\]\s*){2,}[^/\\]/,
  x1 = /^[\s\0]*(blob|data|javascript|vbscript):$/i,
  F1 = /\/$|\/\?|\/#/,
  k1 = /^\.?\//;
function Pe(e, t = {}) {
  return (
    typeof t == 'boolean' && (t = { acceptRelative: t }),
    t.strict ? w1.test(e) : A1.test(e) || (t.acceptRelative ? v1.test(e) : !1)
  );
}
function T0(e) {
  return !!e && x1.test(e);
}
function H0(e = '', t) {
  return t ? F1.test(e) : e.endsWith('/');
}
function Xn(e = '', t) {
  if (!t) return (H0(e) ? e.slice(0, -1) : e) || '/';
  if (!H0(e, !0)) return e || '/';
  let r = e,
    s = '';
  const n = e.indexOf('#');
  n !== -1 && ((r = e.slice(0, n)), (s = e.slice(n)));
  const [o, ...i] = r.split('?');
  return (
    ((o.endsWith('/') ? o.slice(0, -1) : o) || '/') + (i.length > 0 ? `?${i.join('?')}` : '') + s
  );
}
function P0(e = '', t) {
  if (!t) return e.endsWith('/') ? e : e + '/';
  if (H0(e, !0)) return e || '/';
  let r = e,
    s = '';
  const n = e.indexOf('#');
  if (n !== -1 && ((r = e.slice(0, n)), (s = e.slice(n)), !r)) return s;
  const [o, ...i] = r.split('?');
  return o + '/' + (i.length > 0 ? `?${i.join('?')}` : '') + s;
}
function L1(e = '') {
  return e.startsWith('/');
}
function ss(e = '') {
  return L1(e) ? e : '/' + e;
}
function S1(e, t) {
  if (Qn(t) || Pe(e)) return e;
  const r = Xn(t);
  if (e.startsWith(r)) {
    const s = e[r.length];
    if (!s || s === '/' || s === '?') return e;
  }
  return Zt(r, e);
}
function M1(e, t) {
  if (Qn(t)) return e;
  const r = Xn(t);
  if (!e.startsWith(r)) return e;
  const s = e[r.length];
  return s && s !== '/' && s !== '?' ? e : '/' + e.slice(r.length).replace(/^\/+/, '');
}
function Yn(e, t) {
  const r = dr(e),
    s = { ...ur(r.search), ...t };
  return ((r.search = zn(s)), ro(r));
}
function Qn(e) {
  return !e || e === '/';
}
function T1(e) {
  return e && e !== '/';
}
function Zt(e, ...t) {
  let r = e || '';
  for (const s of t.filter((n) => T1(n)))
    if (r) {
      const n = s.replace(k1, '');
      r = P0(r) + n;
    } else r = s;
  return r;
}
function eo(...e) {
  const t = /\/(?!\/)/,
    r = e.filter(Boolean),
    s = [];
  let n = 0;
  for (const i of r)
    if (!(!i || i === '/')) {
      for (const [a, l] of i.split(t).entries())
        if (!(!l || l === '.')) {
          if (l === '..') {
            if (s.length === 1 && Pe(s[0])) continue;
            (s.pop(), n--);
            continue;
          }
          if (a === 1 && s[s.length - 1]?.endsWith(':/')) {
            s[s.length - 1] += '/' + l;
            continue;
          }
          (s.push(l), n++);
        }
    }
  let o = s.join('/');
  return (
    n >= 0
      ? r[0]?.startsWith('/') && !o.startsWith('/')
        ? (o = '/' + o)
        : r[0]?.startsWith('./') && !o.startsWith('./') && (o = './' + o)
      : (o = '../'.repeat(-1 * n) + o),
    r[r.length - 1]?.endsWith('/') && !o.endsWith('/') && (o += '/'),
    o
  );
}
function H1(e, t, r = {}) {
  return (
    r.trailingSlash || ((e = P0(e)), (t = P0(t))),
    r.leadingSlash || ((e = ss(e)), (t = ss(t))),
    r.encoding || ((e = Qe(e)), (t = Qe(t))),
    e === t
  );
}
const to = Symbol.for('ufo:protocolRelative');
function dr(e = '', t) {
  const r = e.match(/^[\s\0]*(blob:|data:|javascript:|vbscript:)(.*)/i);
  if (r) {
    const [, f, h = ''] = r;
    return {
      protocol: f.toLowerCase(),
      pathname: h,
      href: f + h,
      auth: '',
      host: '',
      search: '',
      hash: '',
    };
  }
  if (!Pe(e, { acceptRelative: !0 })) return ns(e);
  const [, s = '', n, o = ''] =
    e.replace(/\\/g, '/').match(/^[\s\0]*([\w+.-]{2,}:)?\/\/([^/@]+@)?(.*)/) || [];
  let [, i = '', a = ''] = o.match(/([^#/?]*)(.*)?/) || [];
  s === 'file:' && (a = a.replace(/\/(?=[A-Za-z]:)/, ''));
  const { pathname: l, search: d, hash: c } = ns(a);
  return {
    protocol: s.toLowerCase(),
    auth: n ? n.slice(0, Math.max(0, n.length - 1)) : '',
    host: i,
    pathname: l,
    search: d,
    hash: c,
    [to]: !s,
  };
}
function ns(e = '') {
  const [t = '', r = '', s = ''] = (e.match(/([^#?]*)(\?[^#]*)?(#.*)?/) || []).splice(1);
  return { pathname: t, search: r, hash: s };
}
function ro(e) {
  const t = e.pathname || '',
    r = e.search ? (e.search.startsWith('?') ? '' : '?') + e.search : '',
    s = e.hash || '',
    n = e.auth ? e.auth + '@' : '',
    o = e.host || '';
  return (e.protocol || e[to] ? (e.protocol || '') + '//' : '') + n + o + t + r + s;
}
class P1 extends Error {
  constructor(t, r) {
    (super(t, r), (this.name = 'FetchError'), r?.cause && !this.cause && (this.cause = r.cause));
  }
}
function R1(e) {
  const t = e.error?.message || e.error?.toString() || '',
    r = e.request?.method || e.options?.method || 'GET',
    s = e.request?.url || String(e.request) || '/',
    n = `[${r}] ${JSON.stringify(s)}`,
    o = e.response ? `${e.response.status} ${e.response.statusText}` : '<no response>',
    i = `${n}: ${o}${t ? ` ${t}` : ''}`,
    a = new P1(i, e.error ? { cause: e.error } : void 0);
  for (const l of ['request', 'options', 'response'])
    Object.defineProperty(a, l, {
      get() {
        return e[l];
      },
    });
  for (const [l, d] of [
    ['data', '_data'],
    ['status', 'status'],
    ['statusCode', 'status'],
    ['statusText', 'statusText'],
    ['statusMessage', 'statusText'],
  ])
    Object.defineProperty(a, l, {
      get() {
        return e.response && e.response[d];
      },
    });
  return a;
}
const O1 = new Set(Object.freeze(['PATCH', 'POST', 'PUT', 'DELETE']));
function os(e = 'GET') {
  return O1.has(e.toUpperCase());
}
function U1(e) {
  if (e === void 0) return !1;
  const t = typeof e;
  return t === 'string' || t === 'number' || t === 'boolean' || t === null
    ? !0
    : t !== 'object'
      ? !1
      : Array.isArray(e)
        ? !0
        : e.buffer || e instanceof FormData || e instanceof URLSearchParams
          ? !1
          : (e.constructor && e.constructor.name === 'Object') || typeof e.toJSON == 'function';
}
const I1 = new Set(['image/svg', 'application/xml', 'application/xhtml', 'application/html']),
  N1 = /^application\/(?:[\w!#$%&*.^`~-]*\+)?json(;.+)?$/i;
function V1(e = '') {
  if (!e) return 'json';
  const t = e.split(';').shift() || '';
  return N1.test(t)
    ? 'json'
    : t === 'text/event-stream'
      ? 'stream'
      : I1.has(t) || t.startsWith('text/')
        ? 'text'
        : 'blob';
}
function j1(e, t, r, s) {
  const n = B1(t?.headers ?? e?.headers, r?.headers, s);
  let o;
  return (
    (r?.query || r?.params || t?.params || t?.query) &&
      (o = { ...r?.params, ...r?.query, ...t?.params, ...t?.query }),
    { ...r, ...t, query: o, params: o, headers: n }
  );
}
function B1(e, t, r) {
  if (!t) return new r(e);
  const s = new r(t);
  if (e) for (const [n, o] of Symbol.iterator in e || Array.isArray(e) ? e : new r(e)) s.set(n, o);
  return s;
}
async function ut(e, t) {
  if (t)
    if (Array.isArray(t)) for (const r of t) await r(e);
    else await t(e);
}
const $1 = new Set([408, 409, 425, 429, 500, 502, 503, 504]),
  G1 = new Set([101, 204, 205, 304]);
function so(e = {}) {
  const {
    fetch: t = globalThis.fetch,
    Headers: r = globalThis.Headers,
    AbortController: s = globalThis.AbortController,
  } = e;
  async function n(a) {
    const l = (a.error && a.error.name === 'AbortError' && !a.options.timeout) || !1;
    if (a.options.retry !== !1 && !l) {
      let c;
      typeof a.options.retry == 'number'
        ? (c = a.options.retry)
        : (c = os(a.options.method) ? 0 : 1);
      const f = (a.response && a.response.status) || 500;
      if (
        c > 0 &&
        (Array.isArray(a.options.retryStatusCodes)
          ? a.options.retryStatusCodes.includes(f)
          : $1.has(f))
      ) {
        const h =
          typeof a.options.retryDelay == 'function'
            ? a.options.retryDelay(a)
            : a.options.retryDelay || 0;
        return (
          h > 0 && (await new Promise((p) => setTimeout(p, h))),
          o(a.request, { ...a.options, retry: c - 1 })
        );
      }
    }
    const d = R1(a);
    throw (Error.captureStackTrace && Error.captureStackTrace(d, o), d);
  }
  const o = async function (l, d = {}) {
      const c = { request: l, options: j1(l, d, e.defaults, r), response: void 0, error: void 0 };
      if (
        (c.options.method && (c.options.method = c.options.method.toUpperCase()),
        c.options.onRequest &&
          (await ut(c, c.options.onRequest),
          c.options.headers instanceof r || (c.options.headers = new r(c.options.headers || {}))),
        typeof c.request == 'string' &&
          (c.options.baseURL && (c.request = S1(c.request, c.options.baseURL)),
          c.options.query && ((c.request = Yn(c.request, c.options.query)), delete c.options.query),
          'query' in c.options && delete c.options.query,
          'params' in c.options && delete c.options.params),
        c.options.body && os(c.options.method))
      )
        if (U1(c.options.body)) {
          const p = c.options.headers.get('content-type');
          (typeof c.options.body != 'string' &&
            (c.options.body =
              p === 'application/x-www-form-urlencoded'
                ? new URLSearchParams(c.options.body).toString()
                : JSON.stringify(c.options.body)),
            p || c.options.headers.set('content-type', 'application/json'),
            c.options.headers.has('accept') || c.options.headers.set('accept', 'application/json'));
        } else
          (('pipeTo' in c.options.body && typeof c.options.body.pipeTo == 'function') ||
            typeof c.options.body.pipe == 'function') &&
            ('duplex' in c.options || (c.options.duplex = 'half'));
      let f;
      if (!c.options.signal && c.options.timeout) {
        const p = new s();
        ((f = setTimeout(() => {
          const C = new Error('[TimeoutError]: The operation was aborted due to timeout');
          ((C.name = 'TimeoutError'), (C.code = 23), p.abort(C));
        }, c.options.timeout)),
          (c.options.signal = p.signal));
      }
      try {
        c.response = await t(c.request, c.options);
      } catch (p) {
        return (
          (c.error = p),
          c.options.onRequestError && (await ut(c, c.options.onRequestError)),
          await n(c)
        );
      } finally {
        f && clearTimeout(f);
      }
      if (
        (c.response.body || c.response._bodyInit) &&
        !G1.has(c.response.status) &&
        c.options.method !== 'HEAD'
      ) {
        const p =
          (c.options.parseResponse ? 'json' : c.options.responseType) ||
          V1(c.response.headers.get('content-type') || '');
        switch (p) {
          case 'json': {
            const C = await c.response.text(),
              D = c.options.parseResponse || kt;
            c.response._data = D(C);
            break;
          }
          case 'stream': {
            c.response._data = c.response.body || c.response._bodyInit;
            break;
          }
          default:
            c.response._data = await c.response[p]();
        }
      }
      return (
        c.options.onResponse && (await ut(c, c.options.onResponse)),
        !c.options.ignoreResponseError && c.response.status >= 400 && c.response.status < 600
          ? (c.options.onResponseError && (await ut(c, c.options.onResponseError)), await n(c))
          : c.response
      );
    },
    i = async function (l, d) {
      return (await o(l, d))._data;
    };
  return (
    (i.raw = o),
    (i.native = (...a) => t(...a)),
    (i.create = (a = {}, l = {}) =>
      so({ ...e, ...l, defaults: { ...e.defaults, ...l.defaults, ...a } })),
    i
  );
}
const Lt = (function () {
    if (typeof globalThis < 'u') return globalThis;
    if (typeof self < 'u') return self;
    if (typeof window < 'u') return window;
    if (typeof global < 'u') return global;
    throw new Error('unable to locate global object');
  })(),
  W1 = Lt.fetch
    ? (...e) => Lt.fetch(...e)
    : () => Promise.reject(new Error('[ofetch] global.fetch is not supported!')),
  Z1 = Lt.Headers,
  q1 = Lt.AbortController,
  K1 = so({ fetch: W1, Headers: Z1, AbortController: q1 }),
  J1 = K1,
  z1 = () => window?.__NUXT__?.config || {},
  pr = () => z1().app,
  X1 = () => pr().baseURL,
  Y1 = () => pr().buildAssetsDir,
  hr = (...e) => eo(no(), Y1(), ...e),
  no = (...e) => {
    const t = pr(),
      r = t.cdnURL || t.baseURL;
    return e.length ? eo(r, ...e) : r;
  };
((globalThis.__buildAssetsURL = hr), (globalThis.__publicAssetsURL = no));
globalThis.$fetch || (globalThis.$fetch = J1.create({ baseURL: X1() }));
'global' in globalThis || (globalThis.global = globalThis);
function R0(e, t = {}, r) {
  for (const s in e) {
    const n = e[s],
      o = r ? `${r}:${s}` : s;
    typeof n == 'object' && n !== null ? R0(n, t, o) : typeof n == 'function' && (t[o] = n);
  }
  return t;
}
const Q1 = { run: (e) => e() },
  ea = () => Q1,
  oo = typeof console.createTask < 'u' ? console.createTask : ea;
function ta(e, t) {
  const r = t.shift(),
    s = oo(r);
  return e.reduce((n, o) => n.then(() => s.run(() => o(...t))), Promise.resolve());
}
function ra(e, t) {
  const r = t.shift(),
    s = oo(r);
  return Promise.all(e.map((n) => s.run(() => n(...t))));
}
function d0(e, t) {
  for (const r of [...e]) r(t);
}
let sa = class {
  constructor() {
    ((this._hooks = {}),
      (this._before = void 0),
      (this._after = void 0),
      (this._deprecatedMessages = void 0),
      (this._deprecatedHooks = {}),
      (this.hook = this.hook.bind(this)),
      (this.callHook = this.callHook.bind(this)),
      (this.callHookWith = this.callHookWith.bind(this)));
  }
  hook(t, r, s = {}) {
    if (!t || typeof r != 'function') return () => {};
    const n = t;
    let o;
    for (; this._deprecatedHooks[t]; ) ((o = this._deprecatedHooks[t]), (t = o.to));
    if (o && !s.allowDeprecated) {
      let i = o.message;
      (i || (i = `${n} hook has been deprecated` + (o.to ? `, please use ${o.to}` : '')),
        this._deprecatedMessages || (this._deprecatedMessages = new Set()),
        this._deprecatedMessages.has(i) || (console.warn(i), this._deprecatedMessages.add(i)));
    }
    if (!r.name)
      try {
        Object.defineProperty(r, 'name', {
          get: () => '_' + t.replace(/\W+/g, '_') + '_hook_cb',
          configurable: !0,
        });
      } catch {}
    return (
      (this._hooks[t] = this._hooks[t] || []),
      this._hooks[t].push(r),
      () => {
        r && (this.removeHook(t, r), (r = void 0));
      }
    );
  }
  hookOnce(t, r) {
    let s,
      n = (...o) => (typeof s == 'function' && s(), (s = void 0), (n = void 0), r(...o));
    return ((s = this.hook(t, n)), s);
  }
  removeHook(t, r) {
    if (this._hooks[t]) {
      const s = this._hooks[t].indexOf(r);
      (s !== -1 && this._hooks[t].splice(s, 1),
        this._hooks[t].length === 0 && delete this._hooks[t]);
    }
  }
  deprecateHook(t, r) {
    this._deprecatedHooks[t] = typeof r == 'string' ? { to: r } : r;
    const s = this._hooks[t] || [];
    delete this._hooks[t];
    for (const n of s) this.hook(t, n);
  }
  deprecateHooks(t) {
    Object.assign(this._deprecatedHooks, t);
    for (const r in t) this.deprecateHook(r, t[r]);
  }
  addHooks(t) {
    const r = R0(t),
      s = Object.keys(r).map((n) => this.hook(n, r[n]));
    return () => {
      for (const n of s.splice(0, s.length)) n();
    };
  }
  removeHooks(t) {
    const r = R0(t);
    for (const s in r) this.removeHook(s, r[s]);
  }
  removeAllHooks() {
    for (const t in this._hooks) delete this._hooks[t];
  }
  callHook(t, ...r) {
    return (r.unshift(t), this.callHookWith(ta, t, ...r));
  }
  callHookParallel(t, ...r) {
    return (r.unshift(t), this.callHookWith(ra, t, ...r));
  }
  callHookWith(t, r, ...s) {
    const n = this._before || this._after ? { name: r, args: s, context: {} } : void 0;
    this._before && d0(this._before, n);
    const o = t(r in this._hooks ? [...this._hooks[r]] : [], s);
    return o instanceof Promise
      ? o.finally(() => {
          this._after && n && d0(this._after, n);
        })
      : (this._after && n && d0(this._after, n), o);
  }
  beforeEach(t) {
    return (
      (this._before = this._before || []),
      this._before.push(t),
      () => {
        if (this._before !== void 0) {
          const r = this._before.indexOf(t);
          r !== -1 && this._before.splice(r, 1);
        }
      }
    );
  }
  afterEach(t) {
    return (
      (this._after = this._after || []),
      this._after.push(t),
      () => {
        if (this._after !== void 0) {
          const r = this._after.indexOf(t);
          r !== -1 && this._after.splice(r, 1);
        }
      }
    );
  }
};
function na() {
  return new sa();
}
function oa(e = {}) {
  let t,
    r = !1;
  const s = (i) => {
    if (t && t !== i) throw new Error('Context conflict');
  };
  let n;
  if (e.asyncContext) {
    const i = e.AsyncLocalStorage || globalThis.AsyncLocalStorage;
    i ? (n = new i()) : console.warn('[unctx] `AsyncLocalStorage` is not provided.');
  }
  const o = () => {
    if (n) {
      const i = n.getStore();
      if (i !== void 0) return i;
    }
    return t;
  };
  return {
    use: () => {
      const i = o();
      if (i === void 0) throw new Error('Context is not available');
      return i;
    },
    tryUse: () => o(),
    set: (i, a) => {
      (a || s(i), (t = i), (r = !0));
    },
    unset: () => {
      ((t = void 0), (r = !1));
    },
    call: (i, a) => {
      (s(i), (t = i));
      try {
        return n ? n.run(i, a) : a();
      } finally {
        r || (t = void 0);
      }
    },
    async callAsync(i, a) {
      t = i;
      const l = () => {
          t = i;
        },
        d = () => (t === i ? l : void 0);
      O0.add(d);
      try {
        const c = n ? n.run(i, a) : a();
        return (r || (t = void 0), await c);
      } finally {
        O0.delete(d);
      }
    },
  };
}
function ia(e = {}) {
  const t = {};
  return {
    get(r, s = {}) {
      return (t[r] || (t[r] = oa({ ...e, ...s })), t[r]);
    },
  };
}
const St =
    typeof globalThis < 'u'
      ? globalThis
      : typeof self < 'u'
        ? self
        : typeof global < 'u'
          ? global
          : typeof window < 'u'
            ? window
            : {},
  is = '__unctx__',
  aa = St[is] || (St[is] = ia()),
  la = (e, t = {}) => aa.get(e, t),
  as = '__unctx_async_handlers__',
  O0 = St[as] || (St[as] = new Set());
function ca(e) {
  const t = [];
  for (const n of O0) {
    const o = n();
    o && t.push(o);
  }
  const r = () => {
    for (const n of t) n();
  };
  let s = e();
  return (
    s &&
      typeof s == 'object' &&
      'catch' in s &&
      (s = s.catch((n) => {
        throw (r(), n);
      })),
    [s, r]
  );
}
const fa = !0,
  Dc = { componentName: 'NuxtLink', prefetch: !0, prefetchOn: { visibility: !0 } },
  ua = null,
  da = '#__nuxt',
  io = 'nuxt-app',
  ls = 36e5,
  pa = 'vite:preloadError';
function ao(e = io) {
  return la(e, { asyncContext: !1 });
}
const ha = '__nuxt_plugin';
function ga(e) {
  let t = 0;
  const r = {
    _id: e.id || io || 'nuxt-app',
    _scope: No(),
    provide: void 0,
    globalName: 'nuxt',
    versions: {
      get nuxt() {
        return '3.21.8';
      },
      get vue() {
        return r.vueApp.version;
      },
    },
    payload: be({
      ...(e.ssrContext?.payload || {}),
      data: be({}),
      state: re({}),
      once: new Set(),
      _errors: be({}),
    }),
    static: { data: {} },
    runWithContext(n) {
      return r._scope.active && !Ts() ? r._scope.run(() => cs(r, n)) : cs(r, n);
    },
    isHydrating: !0,
    deferHydration() {
      if (!r.isHydrating) return () => {};
      t++;
      let n = !1;
      return () => {
        if (!n && ((n = !0), t--, t === 0))
          return ((r.isHydrating = !1), r.callHook('app:suspense:resolve'));
      };
    },
    _asyncDataPromises: {},
    _asyncData: be({}),
    _payloadRevivers: {},
    ...e,
  };
  {
    const n = window.__NUXT__;
    if (n)
      for (const o in n)
        switch (o) {
          case 'data':
          case 'state':
          case '_errors':
            Object.assign(r.payload[o], n[o]);
            break;
          default:
            r.payload[o] = n[o];
        }
  }
  ((r.hooks = na()),
    (r.hook = r.hooks.hook),
    (r.callHook = r.hooks.callHook),
    (r.provide = (n, o) => {
      const i = '$' + n;
      (dt(r, i, o), dt(r.vueApp.config.globalProperties, i, o));
    }),
    dt(r.vueApp, '$nuxt', r),
    dt(r.vueApp.config.globalProperties, '$nuxt', r));
  {
    (window.addEventListener(pa, (o) => {
      (r.callHook('app:chunkError', { error: o.payload }),
        o.payload?.message?.includes('Unable to preload CSS') && o.preventDefault());
    }),
      (window.useNuxtApp ||= b2));
    const n = r.hook('app:error', (...o) => {
      console.error('[nuxt] error caught during app initialization', ...o);
    });
    r.hook('app:mounted', n);
  }
  const s = r.payload.config;
  return (r.provide('config', s), r);
}
function Ca(e, t) {
  t.hooks && e.hooks.addHooks(t.hooks);
}
async function Da(e, t) {
  if (typeof t == 'function') {
    const { provide: r } = (await e.runWithContext(() => t(e))) || {};
    if (r && typeof r == 'object') for (const s in r) e.provide(s, r[s]);
  }
}
async function ya(e, t) {
  const r = new Set(),
    s = [],
    n = [];
  let o,
    i = 0;
  async function a(l) {
    const d = l.dependsOn?.filter((c) => t.some((f) => f._name === c) && !r.has(c)) ?? [];
    if (d.length > 0) s.push([new Set(d), l]);
    else {
      const c = Da(e, l)
        .then(async () => {
          l._name &&
            (r.add(l._name),
            await Promise.all(
              s.map(async ([f, h]) => {
                f.has(l._name) && (f.delete(l._name), f.size === 0 && (i++, await a(h)));
              }),
            ));
        })
        .catch((f) => {
          if (!l.parallel && !e.payload.error) throw f;
          o ||= f;
        });
      l.parallel ? n.push(c) : await c;
    }
  }
  for (const l of t) Ca(e, l);
  for (const l of t) await a(l);
  if ((await Promise.all(n), i)) for (let l = 0; l < i; l++) await Promise.all(n);
  if (o) throw e.payload.error || o;
}
function se(e) {
  if (typeof e == 'function') return e;
  const t = e._name || e.name;
  return (delete e.name, Object.assign(e.setup || (() => {}), e, { [ha]: !0, _name: t }));
}
function cs(e, t, r) {
  const s = () => t();
  return (ao(e._id).set(e), e.vueApp.runWithContext(s));
}
function lo(e) {
  let t;
  return (Vt() && (t = Gt()?.appContext.app.$nuxt), (t ||= ao(e).tryUse()), t || null);
}
function b2(e) {
  const t = lo(e);
  if (!t) throw new Error('[nuxt] instance unavailable');
  return t;
}
function et(e) {
  return b2().$config;
}
function dt(e, t, r) {
  Object.defineProperty(e, t, { get: () => r });
}
function p0(e) {
  if (e === null || typeof e != 'object') return !1;
  const t = Object.getPrototypeOf(e);
  return (t !== null && t !== Object.prototype && Object.getPrototypeOf(t) !== null) ||
    Symbol.iterator in e
    ? !1
    : Symbol.toStringTag in e
      ? Object.prototype.toString.call(e) === '[object Module]'
      : !0;
}
function U0(e, t, r = '.', s) {
  if (!p0(t)) return U0(e, {}, r, s);
  const n = { ...t };
  for (const o of Object.keys(e)) {
    if (o === '__proto__' || o === 'constructor') continue;
    const i = e[o];
    i != null &&
      ((s && s(n, o, i, r)) ||
        (Array.isArray(i) && Array.isArray(n[o])
          ? (n[o] = [...i, ...n[o]])
          : p0(i) && p0(n[o])
            ? (n[o] = U0(i, n[o], (r ? `${r}.` : '') + o.toString(), s))
            : (n[o] = i)));
  }
  return n;
}
function _a(e) {
  return (...t) => t.reduce((r, s) => U0(r, s, '', e), {});
}
const ma = _a();
function Ea(e, t) {
  try {
    return t in e;
  } catch {
    return !1;
  }
}
class fs extends Error {
  static __h3_error__ = !0;
  statusCode = 500;
  fatal = !1;
  unhandled = !1;
  statusMessage;
  data;
  cause;
  constructor(t, r = {}) {
    (super(t, r), r.cause && !this.cause && (this.cause = r.cause));
  }
  toJSON() {
    const t = { message: this.message, statusCode: I0(this.statusCode, 500) };
    return (
      this.statusMessage && (t.statusMessage = co(this.statusMessage)),
      this.data !== void 0 && (t.data = this.data),
      t
    );
  }
}
function ba(e) {
  if (typeof e == 'string') return new fs(e);
  if (wa(e)) return e;
  const t = new fs(e.message ?? e.statusMessage ?? '', { cause: e.cause || e });
  if (Ea(e, 'stack'))
    try {
      Object.defineProperty(t, 'stack', {
        get() {
          return e.stack;
        },
      });
    } catch {
      try {
        t.stack = e.stack;
      } catch {}
    }
  if (
    (e.data && (t.data = e.data),
    e.statusCode
      ? (t.statusCode = I0(e.statusCode, t.statusCode))
      : e.status && (t.statusCode = I0(e.status, t.statusCode)),
    e.statusMessage
      ? (t.statusMessage = e.statusMessage)
      : e.statusText && (t.statusMessage = e.statusText),
    t.statusMessage)
  ) {
    const r = t.statusMessage;
    co(t.statusMessage) !== r &&
      console.warn(
        '[h3] Please prefer using `message` for longer error messages instead of `statusMessage`. In the future, `statusMessage` will be sanitized by default.',
      );
  }
  return (
    e.fatal !== void 0 && (t.fatal = e.fatal),
    e.unhandled !== void 0 && (t.unhandled = e.unhandled),
    t
  );
}
function wa(e) {
  return e?.constructor?.__h3_error__ === !0;
}
const Aa = /[^\u0009\u0020-\u007E]/g;
function co(e = '') {
  return e.replace(Aa, '');
}
function I0(e, t = 200) {
  return !e || (typeof e == 'string' && (e = Number.parseInt(e, 10)), e < 100 || e > 999) ? t : e;
}
const fo = Symbol('route');
import.meta.url.replace(/\/app\/.*$/, '/');
const ge = () => b2()?.$router,
  gr = () => (Vt() ? de(fo, b2()._route) : b2()._route);
const va = () => {
    try {
      if (b2()._processingMiddleware) return !0;
    } catch {
      return !1;
    }
    return !1;
  },
  xa = (e, t) => {
    e ||= '/';
    const r = typeof e == 'string' ? e : 'path' in e ? Fa(e) : ge().resolve(e).href;
    if (t?.open) {
      const { protocol: d } = new URL(r, window.location.href);
      if (d && T0(d)) throw new Error(`Cannot navigate to a URL with '${d}' protocol.`);
      const { target: c = '_blank', windowFeatures: f = {} } = t.open,
        h = [];
      for (const [p, C] of Object.entries(f)) C !== void 0 && h.push(`${p.toLowerCase()}=${C}`);
      return (open(r, c, h.join(', ')), Promise.resolve());
    }
    const s = Pe(r, { acceptRelative: !0 }),
      n = t?.external || s;
    if (n) {
      if (!t?.external)
        throw new Error(
          'Navigating to an external URL is not allowed by default. Use `navigateTo(url, { external: true })`.',
        );
      const { protocol: d } = new URL(r, window.location.href);
      if (d && T0(d)) throw new Error(`Cannot navigate to a URL with '${d}' protocol.`);
    }
    const o = va();
    if (!n && o) {
      if (t?.replace) {
        if (typeof e == 'string') {
          const { pathname: d, search: c, hash: f } = dr(e);
          return { path: d, ...(c && { query: ur(c) }), ...(f && { hash: f }), replace: !0 };
        }
        return { ...e, replace: !0 };
      }
      return e;
    }
    const i = ge(),
      a = b2();
    if (n)
      return (
        a._scope.stop(),
        t?.replace ? location.replace(r) : (location.href = r),
        o ? (a.isHydrating ? new Promise(() => {}) : !1) : Promise.resolve()
      );
    const l = typeof e == 'string' ? ka(e) : e;
    return t?.replace ? i.replace(l) : i.push(l);
  };
function Fa(e) {
  return Yn(e.path || '', e.query || {}) + (e.hash || '');
}
function ka(e) {
  const t = dr(e);
  return y1(_1(t.pathname)) + t.search + t.hash;
}
const uo = '__nuxt_error',
  Cr = () => fi(b2().payload, 'error'),
  La = (e) => {
    const t = Dr(e);
    try {
      const r = Cr();
      (b2().hooks.callHook('app:error', t), (r.value ||= t));
    } catch {
      throw t;
    }
    return t;
  },
  Sa = async (e = {}) => {
    const t = b2(),
      r = Cr();
    (t.callHook('app:error:cleared', e),
      e.redirect && (await ge().replace(e.redirect)),
      (r.value = ua));
  },
  Ma = (e) => !!e && typeof e == 'object' && uo in e,
  Dr = (e) => {
    typeof e != 'string' && e.statusText && (e.message ??= e.statusText);
    const t = ba(e);
    return (
      Object.defineProperty(t, uo, { value: !0, configurable: !1, writable: !1 }),
      Object.defineProperty(t, 'status', { get: () => t.statusCode, configurable: !0 }),
      Object.defineProperty(t, 'statusText', { get: () => t.statusMessage, configurable: !0 }),
      t
    );
  },
  Ta = -1,
  Ha = -2,
  Pa = -3,
  Ra = -4,
  Oa = -5,
  Ua = -6,
  Ia = -7,
  po = 2 ** 32 - 1,
  N0 = po - 1;
function Na(e) {
  return !(!Number.isInteger(e) || e < 0 || e > N0);
}
function Va(e) {
  return !(!Number.isInteger(e) || e < 0 || e > po);
}
function ja(e) {
  return Uint8Array.fromBase64(e).buffer;
}
function Ba(e) {
  return Uint8Array.from(Buffer.from(e, 'base64')).buffer;
}
function $a(e) {
  const t = atob(e),
    r = t.length,
    s = new Uint8Array(r);
  for (let n = 0; n < r; n++) s[n] = t.charCodeAt(n);
  return s.buffer;
}
const Ga = typeof Uint8Array.fromBase64 == 'function',
  Wa = typeof process == 'object' && process.versions?.node !== void 0,
  Za = Ga ? ja : Wa ? Ba : $a;
function qa(e, t) {
  return Ka(JSON.parse(e), t);
}
function Ka(e, t) {
  if (typeof e == 'number') return o(e, !0);
  if (!Array.isArray(e) || e.length === 0) throw new Error('Invalid input');
  const r = e,
    s = Array(r.length);
  let n = null;
  function o(i, a = !1) {
    if (i === Ta) return;
    if (i === Pa) return NaN;
    if (i === Ra) return 1 / 0;
    if (i === Oa) return -1 / 0;
    if (i === Ua) return -0;
    if (a || typeof i != 'number') throw new Error('Invalid input');
    if (i in s) return s[i];
    const l = r[i];
    if (!l || typeof l != 'object') s[i] = l;
    else if (Array.isArray(l))
      if (typeof l[0] == 'string') {
        const d = l[0],
          c = t && Object.hasOwn(t, d) ? t[d] : void 0;
        if (c) {
          let f = l[1];
          if ((typeof f != 'number' && (f = r.push(l[1]) - 1), (n ??= new Set()), n.has(f)))
            throw new Error('Invalid circular reference');
          return (n.add(f), (s[i] = c(o(f))), n.delete(f), s[i]);
        }
        switch (d) {
          case 'Date':
            s[i] = new Date(l[1]);
            break;
          case 'Set':
            const f = new Set();
            s[i] = f;
            for (let C = 1; C < l.length; C += 1) f.add(o(l[C]));
            break;
          case 'Map':
            const h = new Map();
            s[i] = h;
            for (let C = 1; C < l.length; C += 2) h.set(o(l[C]), o(l[C + 1]));
            break;
          case 'RegExp':
            s[i] = new RegExp(l[1], l[2]);
            break;
          case 'Object': {
            const C = l[1];
            if (typeof r[C] == 'object' && r[C][0] !== 'BigInt') throw new Error('Invalid input');
            s[i] = Object(o(C));
            break;
          }
          case 'BigInt':
            s[i] = BigInt(l[1]);
            break;
          case 'null':
            const p = Object.create(null);
            s[i] = p;
            for (let C = 1; C < l.length; C += 2) {
              if (l[C] === '__proto__')
                throw new Error('Cannot parse an object with a `__proto__` property');
              p[l[C]] = o(l[C + 1]);
            }
            break;
          case 'Int8Array':
          case 'Uint8Array':
          case 'Uint8ClampedArray':
          case 'Int16Array':
          case 'Uint16Array':
          case 'Float16Array':
          case 'Int32Array':
          case 'Uint32Array':
          case 'Float32Array':
          case 'Float64Array':
          case 'BigInt64Array':
          case 'BigUint64Array':
          case 'DataView': {
            if (r[l[1]][0] !== 'ArrayBuffer') throw new Error('Invalid data');
            const C = globalThis[d],
              D = o(l[1]);
            s[i] = l[2] !== void 0 ? new C(D, l[2], l[3]) : new C(D);
            break;
          }
          case 'ArrayBuffer': {
            const C = l[1];
            if (typeof C != 'string') throw new Error('Invalid ArrayBuffer encoding');
            const D = Za(C);
            s[i] = D;
            break;
          }
          case 'Temporal.Duration':
          case 'Temporal.Instant':
          case 'Temporal.PlainDate':
          case 'Temporal.PlainTime':
          case 'Temporal.PlainDateTime':
          case 'Temporal.PlainMonthDay':
          case 'Temporal.PlainYearMonth':
          case 'Temporal.ZonedDateTime': {
            const C = d.slice(9);
            s[i] = Temporal[C].from(l[1]);
            break;
          }
          case 'URL': {
            const C = new URL(l[1]);
            s[i] = C;
            break;
          }
          case 'URLSearchParams': {
            const C = new URLSearchParams(l[1]);
            s[i] = C;
            break;
          }
          default:
            throw new Error(`Unknown type ${d}`);
        }
      } else if (l[0] === Ia) {
        const d = l[1];
        if (!Va(d)) throw new Error('Invalid input');
        const c = [];
        ((s[i] = c), (c[N0] = void 0), delete c[N0]);
        for (let f = 2; f < l.length; f += 2) {
          const h = l[f];
          if (!Na(h) || h >= d) throw new Error('Invalid input');
          c[h] = o(l[f + 1]);
        }
        c.length = d;
      } else {
        const d = new Array(l.length);
        s[i] = d;
        for (let c = 0; c < l.length; c += 1) {
          const f = l[c];
          f !== Ha && (d[c] = o(f));
        }
      }
    else {
      const d = {};
      s[i] = d;
      for (const c of Object.keys(l)) {
        if (c === '__proto__')
          throw new Error('Cannot parse an object with a `__proto__` property');
        const f = l[c];
        d[c] = o(f);
      }
    }
    return s[i];
  }
  return o(0);
}
const Ja = new Set(['link', 'style', 'script', 'noscript']),
  za = new Set(['title', 'titleTemplate', 'script', 'style', 'noscript']),
  V0 = new Set(['base', 'meta', 'link', 'style', 'script', 'noscript']),
  Xa = new Set([
    'title',
    'base',
    'htmlAttrs',
    'bodyAttrs',
    'meta',
    'link',
    'style',
    'script',
    'noscript',
  ]),
  Ya = new Set(['base', 'title', 'titleTemplate', 'bodyAttrs', 'htmlAttrs', 'templateParams']),
  Qa = new Set([
    'key',
    'tagPosition',
    'tagPriority',
    'tagDuplicateStrategy',
    'innerHTML',
    'textContent',
    'processTemplateParams',
  ]),
  el = new Set(['templateParams', 'htmlAttrs', 'bodyAttrs']),
  tl = new Set([
    'theme-color',
    'google-site-verification',
    'og',
    'article',
    'book',
    'profile',
    'twitter',
    'author',
  ]);
function j0(e, t = {}, r) {
  for (const s in e) {
    const n = e[s],
      o = r ? `${r}:${s}` : s;
    typeof n == 'object' && n !== null ? j0(n, t, o) : typeof n == 'function' && (t[o] = n);
  }
  return t;
}
const ho = (() => {
  if (console.createTask) return console.createTask;
  const e = { run: (t) => t() };
  return () => e;
})();
function go(e, t, r, s) {
  for (let n = r; n < e.length; n += 1)
    try {
      const o = s ? s.run(() => e[n](...t)) : e[n](...t);
      if (o && typeof o.then == 'function')
        return Promise.resolve(o).then(() => go(e, t, n + 1, s));
    } catch (o) {
      return Promise.reject(o);
    }
}
function rl(e, t, r) {
  if (e.length > 0) return go(e, t, 0, ho(r));
}
function sl(e, t, r) {
  if (e.length > 0) {
    const s = ho(r);
    return Promise.all(e.map((n) => s.run(() => n(...t))));
  }
}
function h0(e, t) {
  for (const r of [...e]) r(t);
}
var nl = class {
  _hooks;
  _before;
  _after;
  _deprecatedHooks;
  _deprecatedMessages;
  constructor() {
    ((this._hooks = {}),
      (this._before = void 0),
      (this._after = void 0),
      (this._deprecatedMessages = void 0),
      (this._deprecatedHooks = {}),
      (this.hook = this.hook.bind(this)),
      (this.callHook = this.callHook.bind(this)),
      (this.callHookWith = this.callHookWith.bind(this)));
  }
  hook(e, t, r = {}) {
    if (!e || typeof t != 'function') return () => {};
    const s = e;
    let n;
    for (; this._deprecatedHooks[e]; ) ((n = this._deprecatedHooks[e]), (e = n.to));
    if (n && !r.allowDeprecated) {
      let o = n.message;
      (o || (o = `${s} hook has been deprecated` + (n.to ? `, please use ${n.to}` : '')),
        this._deprecatedMessages || (this._deprecatedMessages = new Set()),
        this._deprecatedMessages.has(o) || (console.warn(o), this._deprecatedMessages.add(o)));
    }
    if (!t.name)
      try {
        Object.defineProperty(t, 'name', {
          get: () => '_' + e.replace(/\W+/g, '_') + '_hook_cb',
          configurable: !0,
        });
      } catch {}
    return (
      (this._hooks[e] = this._hooks[e] || []),
      this._hooks[e].push(t),
      () => {
        t && (this.removeHook(e, t), (t = void 0));
      }
    );
  }
  hookOnce(e, t) {
    let r,
      s = (...n) => (typeof r == 'function' && r(), (r = void 0), (s = void 0), t(...n));
    return ((r = this.hook(e, s)), r);
  }
  removeHook(e, t) {
    const r = this._hooks[e];
    if (r) {
      const s = r.indexOf(t);
      (s !== -1 && r.splice(s, 1), r.length === 0 && (this._hooks[e] = void 0));
    }
  }
  clearHook(e) {
    this._hooks[e] = void 0;
  }
  deprecateHook(e, t) {
    this._deprecatedHooks[e] = typeof t == 'string' ? { to: t } : t;
    const r = this._hooks[e] || [];
    this._hooks[e] = void 0;
    for (const s of r) this.hook(e, s);
  }
  deprecateHooks(e) {
    for (const t in e) this.deprecateHook(t, e[t]);
  }
  addHooks(e) {
    const t = j0(e),
      r = Object.keys(t).map((s) => this.hook(s, t[s]));
    return () => {
      for (const s of r) s();
      r.length = 0;
    };
  }
  removeHooks(e) {
    const t = j0(e);
    for (const r in t) this.removeHook(r, t[r]);
  }
  removeAllHooks() {
    this._hooks = {};
  }
  callHook(e, ...t) {
    return this.callHookWith(rl, e, t);
  }
  callHookParallel(e, ...t) {
    return this.callHookWith(sl, e, t);
  }
  callHookWith(e, t, r) {
    const s = this._before || this._after ? { name: t, args: r, context: {} } : void 0;
    this._before && h0(this._before, s);
    const n = e(this._hooks[t] ? [...this._hooks[t]] : [], r, t);
    return n instanceof Promise
      ? n.finally(() => {
          this._after && s && h0(this._after, s);
        })
      : (this._after && s && h0(this._after, s), n);
  }
  beforeEach(e) {
    return (
      (this._before = this._before || []),
      this._before.push(e),
      () => {
        if (this._before !== void 0) {
          const t = this._before.indexOf(e);
          t !== -1 && this._before.splice(t, 1);
        }
      }
    );
  }
  afterEach(e) {
    return (
      (this._after = this._after || []),
      this._after.push(e),
      () => {
        if (this._after !== void 0) {
          const t = this._after.indexOf(e);
          t !== -1 && this._after.splice(t, 1);
        }
      }
    );
  }
};
function ol() {
  return new nl();
}
const il = ['name', 'property', 'http-equiv'],
  al = new Set(['viewport', 'description', 'keywords', 'robots']);
function Co(e) {
  const t = e.split(':');
  return t.length ? tl.has(t[1]) : !1;
}
function B0(e) {
  const { props: t, tag: r } = e;
  if (Ya.has(r)) return r;
  if (r === 'link' && t.rel === 'canonical') return 'canonical';
  if (r === 'link' && t.rel === 'alternate') {
    if (t.hreflang) return `alternate:${t.hreflang}`;
    if (t.type) return `alternate:${t.type}:${t.href || ''}`;
  }
  if (t.charset) return 'charset';
  if (e.tag === 'meta') {
    for (const s of il)
      if (t[s] !== void 0) {
        const n = t[s],
          o = n && typeof n == 'string' && n.includes(':'),
          i = n && al.has(n),
          l = !(o || i) && e.key ? `:key:${e.key}` : '';
        return `${r}:${n}${l}`;
      }
  }
  if (e.key) return `${r}:key:${e.key}`;
  if (t.id) return `${r}:id:${t.id}`;
  if (r === 'link' && t.rel === 'alternate') return `alternate:${t.href || ''}`;
  if (za.has(r)) {
    const s = e.textContent || e.innerHTML;
    if (s) return `${r}:content:${s}`;
  }
}
function Do(e) {
  const t = e._h || e._d;
  if (t) return t;
  const r = e.textContent || e.innerHTML;
  return (
    r ||
    `${e.tag}:${Object.entries(e.props)
      .map(([s, n]) => `${s}:${String(n)}`)
      .join(',')}`
  );
}
function Mt(e, t, r) {
  typeof e === 'function' &&
    (!r || (r !== 'titleTemplate' && !(r[0] === 'o' && r[1] === 'n'))) &&
    (e = e());
  const n = t ? t(r, e) : e;
  if (Array.isArray(n)) return n.map((o) => Mt(o, t));
  if (n?.constructor === Object) {
    const o = {};
    for (const i of Object.keys(n)) o[i] = Mt(n[i], t, i);
    return o;
  }
  return n;
}
function ll(e, t) {
  const r = e === 'style' ? new Map() : new Set();
  function s(n) {
    if (n == null || n === void 0) return;
    const o = String(n).trim();
    if (o)
      if (e === 'style') {
        const [i, ...a] = o.split(':').map((l) => (l ? l.trim() : ''));
        i && a.length && r.set(i, a.join(':'));
      } else
        o.split(' ')
          .filter(Boolean)
          .forEach((i) => r.add(i));
  }
  return (
    typeof t == 'string'
      ? e === 'style'
        ? t.split(';').forEach(s)
        : s(t)
      : Array.isArray(t)
        ? t.forEach((n) => s(n))
        : t &&
          typeof t == 'object' &&
          Object.entries(t).forEach(([n, o]) => {
            o && o !== 'false' && (e === 'style' ? r.set(String(n).trim(), String(o)) : s(n));
          }),
    r
  );
}
function yo(e, t) {
  if (((e.props = e.props || {}), !t)) return e;
  if (e.tag === 'templateParams') return ((e.props = t), e);
  const r = V0.has(e.tag) || e.tag === 'htmlAttrs' || e.tag === 'bodyAttrs';
  return (
    Object.entries(t).forEach(([s, n]) => {
      if (s === '__proto__' || s === 'constructor' || s === 'prototype') return;
      if (n === null) {
        e.props[s] = null;
        return;
      }
      if (s === 'class' || s === 'style') {
        e.props[s] = ll(s, n);
        return;
      }
      if (Qa.has(s)) {
        if ((s === 'textContent' || s === 'innerHTML') && typeof n == 'object') {
          let d = t.type;
          if (
            (t.type || (d = 'application/json'), !d?.endsWith('json') && d !== 'speculationrules')
          )
            return;
          ((t.type = d), (e.props.type = d), (e[s] = JSON.stringify(n)));
        } else e[s] = n;
        return;
      }
      const o = s.startsWith('data-'),
        i = r && !o ? s.toLowerCase() : s,
        a = String(n),
        l = e.tag === 'meta' && i === 'content';
      a === 'true' || a === ''
        ? (e.props[i] = o || l ? a : !0)
        : !n && o && a === 'false'
          ? (e.props[i] = 'false')
          : n !== void 0 && (e.props[i] = n);
    }),
    e
  );
}
function cl(e, t) {
  const r =
      typeof t == 'object' && typeof t != 'function'
        ? t
        : {
            [e === 'script' || e === 'noscript' || e === 'style' ? 'innerHTML' : 'textContent']: t,
          },
    s = yo({ tag: e, props: {} }, r);
  return (
    s.key && Ja.has(s.tag) && (s.props['data-hid'] = s._h = s.key),
    s.tag === 'script' &&
      typeof s.innerHTML == 'object' &&
      ((s.innerHTML = JSON.stringify(s.innerHTML)),
      (s.props.type = s.props.type || 'application/json')),
    Array.isArray(s.props.content)
      ? s.props.content.map((n) => ({ ...s, props: { ...s.props, content: n } }))
      : s
  );
}
function fl(e, t) {
  if (!e) return [];
  typeof e == 'function' && (e = e());
  const r = (n, o) => {
    for (let i = 0; i < t.length; i++) o = t[i](n, o);
    return o;
  };
  e = r(void 0, e);
  const s = [];
  return (
    (e = Mt(e, r)),
    Object.entries(e || {}).forEach(([n, o]) => {
      if (o !== void 0) for (const i of Array.isArray(o) ? o : [o]) s.push(cl(n, i));
    }),
    s.flat()
  );
}
const $0 = (e, t) => (e._w === t._w ? e._p - t._p : e._w - t._w),
  us = { base: -10, title: 10 },
  ul = { critical: -8, high: -1, low: 2 },
  ds = {
    meta: { 'content-security-policy': -30, charset: -20, viewport: -15 },
    link: {
      preconnect: 20,
      stylesheet: 60,
      preload: 70,
      modulepreload: 70,
      prefetch: 90,
      'dns-prefetch': 90,
      prerender: 90,
    },
    script: { async: 30, defer: 80, sync: 50 },
    style: { imported: 40, sync: 60 },
  },
  dl = /@import/,
  Ie = (e) => e === '' || e === !0;
function pl(e, t) {
  if (typeof t.tagPriority == 'number') return t.tagPriority;
  let r = 100;
  const s = ul[t.tagPriority] || 0,
    n = e.resolvedOptions.disableCapoSorting ? { link: {}, script: {}, style: {} } : ds;
  if (t.tag in us) r = us[t.tag];
  else if (t.tag === 'meta') {
    const o =
      t.props['http-equiv'] === 'content-security-policy'
        ? 'content-security-policy'
        : t.props.charset
          ? 'charset'
          : t.props.name === 'viewport'
            ? 'viewport'
            : null;
    o && (r = ds.meta[o]);
  } else if (t.tag === 'link' && t.props.rel) r = n.link[t.props.rel];
  else if (t.tag === 'script') {
    const o = String(t.props.type);
    Ie(t.props.async)
      ? (r = n.script.async)
      : (t.props.src &&
            !Ie(t.props.defer) &&
            !Ie(t.props.async) &&
            o !== 'module' &&
            !o.endsWith('json')) ||
          (t.innerHTML && !o.endsWith('json'))
        ? (r = n.script.sync)
        : ((Ie(t.props.defer) && t.props.src && !Ie(t.props.async)) || o === 'module') &&
          (r = n.script.defer);
  } else
    t.tag === 'style' &&
      (r = t.innerHTML && dl.test(t.innerHTML) ? n.style.imported : n.style.sync);
  return (r || 100) + s;
}
function ps(e, t) {
  const r = typeof t == 'function' ? t(e) : t,
    s = r.key || String(e.plugins.size + 1);
  e.plugins.get(s) || (e.plugins.set(s, r), e.hooks.addHooks(r.hooks || {}));
}
function hl(e = {}) {
  const t = ol();
  t.addHooks(e.hooks || {});
  const r = !e.document,
    s = new Map(),
    n = new Map(),
    o = new Set(),
    i = {
      _entryCount: 1,
      plugins: n,
      dirty: !1,
      resolvedOptions: e,
      hooks: t,
      ssr: r,
      entries: s,
      headEntries() {
        return [...s.values()];
      },
      use: (a) => ps(i, a),
      push(a, l) {
        const d = { ...(l || {}) };
        delete d.head;
        const c = d._index ?? i._entryCount++,
          f = { _i: c, input: a, options: d },
          h = {
            _poll(p = !1) {
              ((i.dirty = !0), !p && o.add(c), t.callHook('entries:updated', i));
            },
            dispose() {
              s.delete(c) && i.invalidate();
            },
            patch(p) {
              (!d.mode || (d.mode === 'server' && r) || (d.mode === 'client' && !r)) &&
                ((f.input = p), s.set(c, f), h._poll());
            },
          };
        return (h.patch(a), h);
      },
      async resolveTags() {
        const a = { tagMap: new Map(), tags: [], entries: [...i.entries.values()] };
        for (await t.callHook('entries:resolve', a); o.size; ) {
          const h = o.values().next().value;
          o.delete(h);
          const p = s.get(h);
          if (p) {
            const C = {
              tags: fl(p.input, e.propResolvers || []).map((D) => Object.assign(D, p.options)),
              entry: p,
            };
            (await t.callHook('entries:normalize', C),
              (p._tags = C.tags.map(
                (D, M) => (
                  (D._w = pl(i, D)),
                  (D._p = (p._i << 10) + M),
                  (D._d = B0(D)),
                  D._d || (D._h = Do(D)),
                  D
                ),
              )));
          }
        }
        let l = !1;
        a.entries
          .flatMap((h) => (h._tags || []).map((p) => ({ ...p, props: { ...p.props } })))
          .sort($0)
          .reduce((h, p) => {
            const C = p._d || p._h;
            if (!h.has(C)) return h.set(C, p);
            const D = h.get(C);
            if (
              (p?.tagDuplicateStrategy ||
                (el.has(p.tag) ? 'merge' : null) ||
                (p.key && p.key === D.key ? 'merge' : null)) === 'merge'
            ) {
              const x = { ...D.props };
              (Object.entries(p.props).forEach(
                ([S, y]) =>
                  (x[S] =
                    S === 'style'
                      ? new Map([...(D.props.style || new Map()), ...y])
                      : S === 'class'
                        ? new Set([...(D.props.class || new Set()), ...y])
                        : y),
              ),
                h.set(C, { ...p, props: x }));
            } else
              p._p >> 10 === D._p >> 10 && p.tag === 'meta' && Co(C)
                ? (h.set(C, Object.assign([...(Array.isArray(D) ? D : [D]), p], p)), (l = !0))
                : (p._w === D._w ? p._p > D._p : p?._w < D?._w) && h.set(C, p);
            return h;
          }, a.tagMap);
        const d = a.tagMap.get('title'),
          c = a.tagMap.get('titleTemplate');
        if (((i._title = d?.textContent), c)) {
          const h = c?.textContent;
          if (((i._titleTemplate = h), h)) {
            let p = typeof h == 'function' ? h(d?.textContent) : h;
            (typeof p == 'string' &&
              !i.plugins.has('template-params') &&
              (p = p.replace('%s', d?.textContent || '')),
              d
                ? p === null
                  ? a.tagMap.delete('title')
                  : a.tagMap.set('title', { ...d, textContent: p })
                : ((c.tag = 'title'), (c.textContent = p)));
          }
        }
        ((a.tags = Array.from(a.tagMap.values())),
          l && (a.tags = a.tags.flat().sort($0)),
          await t.callHook('tags:beforeResolve', a),
          await t.callHook('tags:resolve', a),
          await t.callHook('tags:afterResolve', a));
        const f = [];
        for (const h of a.tags) {
          const { innerHTML: p, tag: C, props: D } = h;
          if (
            Xa.has(C) &&
            !(Object.keys(D).length === 0 && !h.innerHTML && !h.textContent) &&
            !(C === 'meta' && !D.content && !D['http-equiv'] && !D.charset)
          ) {
            if (C === 'script' && p) {
              if (String(D.type).endsWith('json')) {
                const M = typeof p == 'string' ? p : JSON.stringify(p);
                h.innerHTML = M.replace(/</g, '\\u003C');
              } else
                typeof p == 'string' &&
                  (h.innerHTML = p.replace(new RegExp(`</${C}`, 'g'), `<\\/${C}`));
              h._d = B0(h);
            }
            f.push(h);
          }
        }
        return f;
      },
      invalidate() {
        for (const a of s.values()) o.add(a._i);
        ((i.dirty = !0), t.callHook('entries:updated', i));
      },
    };
  return (
    (e?.plugins || []).forEach((a) => ps(i, a)),
    i.hooks.callHook('init', i),
    e.init?.forEach((a) => a && i.push(a)),
    i
  );
}
const g0 = '%separator';
function gl(e, t, r = !1) {
  let s;
  if (t === 's' || t === 'pageTitle') s = e.pageTitle;
  else if (t.includes('.')) {
    const n = t.indexOf('.');
    s = e[t.substring(0, n)]?.[t.substring(n + 1)];
  } else s = e[t];
  if (s !== void 0)
    return r
      ? (s || '').replace(/\\/g, '\\\\').replace(/</g, '\\u003C').replace(/"/g, '\\"')
      : s || '';
}
function pt(e, t, r, s = !1) {
  if (typeof e != 'string' || !e.includes('%')) return e;
  let n = e;
  try {
    n = decodeURI(e);
  } catch {}
  const o = n.match(/%\w+(?:\.\w+)?/g);
  if (!o) return e;
  const i = e.includes(g0);
  return (
    (e = e
      .replace(/%\w+(?:\.\w+)?/g, (a) => {
        if (a === g0 || !o.includes(a)) return a;
        const l = gl(t, a.slice(1), s);
        return l !== void 0 ? l : a;
      })
      .trim()),
    i &&
      (e = e
        .split(g0)
        .map((a) => a.trim())
        .filter((a) => a !== '')
        .join(r ? ` ${r} ` : ' ')),
    e
  );
}
const hs = (e) => (e.includes(':key') ? e : e.split(':').join(':key:')),
  Cl = {
    key: 'aliasSorting',
    hooks: {
      'tags:resolve': (e) => {
        let t = !1;
        for (const r of e.tags) {
          const s = r.tagPriority;
          if (!s) continue;
          const n = String(s);
          if (n.startsWith('before:')) {
            const o = hs(n.slice(7)),
              i = e.tagMap.get(o);
            i &&
              (typeof i.tagPriority == 'number' && (r.tagPriority = i.tagPriority),
              (r._p = i._p - 1),
              (t = !0));
          } else if (n.startsWith('after:')) {
            const o = hs(n.slice(6)),
              i = e.tagMap.get(o);
            i &&
              (typeof i.tagPriority == 'number' && (r.tagPriority = i.tagPriority),
              (r._p = i._p + 1),
              (t = !0));
          }
        }
        t && (e.tags = e.tags.sort($0));
      },
    },
  },
  Dl = {
    key: 'deprecations',
    hooks: {
      'entries:normalize': ({ tags: e }) => {
        for (const t of e)
          (t.props.children && ((t.innerHTML = t.props.children), delete t.props.children),
            t.props.hid && ((t.key = t.props.hid), delete t.props.hid),
            t.props.vmid && ((t.key = t.props.vmid), delete t.props.vmid),
            t.props.body && ((t.tagPosition = 'bodyClose'), delete t.props.body));
      },
    },
  };
async function G0(e) {
  if (typeof e === 'function') return e;
  if (e instanceof Promise) return await e;
  if (Array.isArray(e)) return await Promise.all(e.map((r) => G0(r)));
  if (e?.constructor === Object) {
    const r = {};
    for (const s of Object.keys(e)) r[s] = await G0(e[s]);
    return r;
  }
  return e;
}
const yl = {
    key: 'promises',
    hooks: {
      'entries:resolve': async (e) => {
        const t = [];
        for (const r in e.entries)
          e.entries[r]._promisesProcessed ||
            t.push(
              G0(e.entries[r].input).then((s) => {
                ((e.entries[r].input = s), (e.entries[r]._promisesProcessed = !0));
              }),
            );
        await Promise.all(t);
      },
    },
  },
  _l = { meta: 'content', link: 'href', htmlAttrs: 'lang' },
  ml = ['innerHTML', 'textContent'],
  El = (e) => ({
    key: 'template-params',
    hooks: {
      'entries:normalize': (t) => {
        const r =
          t.tags.filter((s) => s.tag === 'templateParams' && s.mode === 'server')?.[0]?.props || {};
        Object.keys(r).length &&
          (e._ssrPayload = { templateParams: { ...(e._ssrPayload?.templateParams || {}), ...r } });
      },
      'tags:resolve': ({ tagMap: t, tags: r }) => {
        const s = t.get('templateParams')?.props || {},
          n = s.separator || '|';
        (delete s.separator, (s.pageTitle = pt(s.pageTitle || e._title || '', s, n)));
        for (const o of r) {
          if (o.processTemplateParams === !1) continue;
          const i = _l[o.tag];
          if (i && typeof o.props[i] == 'string') o.props[i] = pt(o.props[i], s, n);
          else if (o.processTemplateParams || o.tag === 'titleTemplate' || o.tag === 'title')
            for (const a of ml)
              typeof o[a] == 'string' &&
                (o[a] = pt(o[a], s, n, o.tag === 'script' && o.props.type.endsWith('json')));
        }
        ((e._templateParams = s), (e._separator = n));
      },
      'tags:afterResolve': ({ tagMap: t }) => {
        const r = t.get('title');
        r?.textContent &&
          r.processTemplateParams !== !1 &&
          (r.textContent = pt(r.textContent, e._templateParams, e._separator));
      },
    },
  }),
  bl = (e, t) => (f2(t) ? ii(t) : t),
  yr = 'usehead';
function wl(e) {
  return {
    install(r) {
      ((r.config.globalProperties.$unhead = e),
        (r.config.globalProperties.$head = e),
        r.provide(yr, e));
    },
  }.install;
}
function Al() {
  if (Vt()) {
    const e = de(yr);
    if (e) return e;
  }
  throw new Error(
    'useHead() was called without provide context, ensure you call it through the setup() function.',
  );
}
function vl(e, t = {}) {
  const r = t.head || Al();
  return r.ssr ? r.push(e || {}, t) : xl(r, e, t);
}
function xl(e, t, r = {}) {
  const s = ue(!1);
  let n;
  return (
    mi(() => {
      const i = s.value ? {} : Mt(t, bl);
      n ? n.patch(i) : (n = e.push(i, r));
    }),
    Gt() &&
      (ln(() => {
        n.dispose();
      }),
      on(() => {
        s.value = !0;
      }),
      nn(() => {
        s.value = !1;
      })),
    n
  );
}
function Fl(e) {
  const t = e || lo();
  return (
    t?.ssrContext?.head ||
    t?.runWithContext(() => {
      if (Vt()) return de(yr);
    })
  );
}
function kl(e, t = {}) {
  const r = Fl(t.nuxt);
  if (r) return vl(e, { head: r, ...t });
}
const Ll = (e, t) => [],
  Sl = (e) =>
    ma(
      {},
      ...Ll('', typeof e == 'string' ? e.toLowerCase() : e)
        .map((t) => t.data)
        .reverse(),
    ),
  Ml = Sl;
let Ct;
function Tl() {
  let e;
  return (
    (e = $fetch(hr(`builds/meta/${et().app.buildId}.json`), { responseType: 'json' }).then((t) => {
      if (!t || typeof t != 'object' || !Array.isArray(t.prerendered))
        throw new Error(
          '[nuxt] Received malformed app manifest. Ensure that `builds/meta/*.json` is served as JSON by your hosting/proxy and not rewritten to an HTML fallback.',
        );
      return t;
    })),
    (Ct = e),
    e.catch((t) => {
      (Ct === e && (Ct = void 0), console.error('[nuxt] Error fetching app manifest.', t));
    }),
    e
  );
}
function _r() {
  return Ct || Tl();
}
function qt(e) {
  const t = typeof e == 'string' ? e : e.path;
  try {
    return Ml(t.toLowerCase());
  } catch (r) {
    return (console.error('[nuxt] Error matching route rules.', r), {});
  }
}
async function gs(e, t = {}) {
  if (await Rl(e)) {
    const r = await Pl(e, t);
    return (await _o(r)) || null;
  }
  return null;
}
const Hl = '_payload.json';
async function Pl(e, t = {}) {
  const r = new URL(e, 'http://localhost');
  if (r.host !== 'localhost' || Pe(r.pathname, { acceptRelative: !0 }))
    throw new Error('Payload URL must not include hostname: ' + e);
  const s = et(),
    n = t.hash || (t.fresh ? Date.now() : s.app.buildId),
    o = s.app.cdnURL,
    i = o && (await Ol(e)) ? o : s.app.baseURL;
  return Zt(i, r.pathname, Hl + (n ? `?${n}` : ''));
}
async function _o(e) {
  try {
    if (fa) {
      const t = await fetch(e, { cache: 'force-cache' });
      return t.ok ? await bo(await t.text()) : null;
    }
  } catch (t) {
    console.warn('[nuxt] Cannot load payload ', e, t);
  }
  return null;
}
function mo(e) {
  if (e.redirect) return !1;
  if (e.prerender) return !0;
}
async function Eo(e) {
  e = e === '/' ? e : e.replace(/\/$/, '');
  try {
    return (await _r()).prerendered.includes(e);
  } catch {
    return !1;
  }
}
async function Rl(e = gr().path) {
  const t = qt({ path: e });
  if (t.ssr === !1) return !1;
  const r = mo(t);
  return r !== void 0 ? r : t.payload ? !0 : await Eo(e);
}
async function Ol(e = gr().path) {
  const t = mo(qt({ path: e }));
  return t !== void 0 ? t : await Eo(e);
}
let oe = null;
async function Ul() {
  if (oe) return oe;
  const e = document.getElementById('__NUXT_DATA__');
  if (!e) return {};
  const t = await bo(e.textContent || ''),
    r = e.dataset.src ? await _o(e.dataset.src) : void 0;
  return (
    (oe = { ...t, ...r, ...window.__NUXT__ }),
    oe.config?.public && (oe.config.public = re(oe.config.public)),
    oe
  );
}
async function bo(e) {
  return await qa(e, b2()._payloadRevivers);
}
function Il(e, t) {
  b2()._payloadRevivers[e] = t;
}
const Nl = [
    ['NuxtError', (e) => Dr(e)],
    ['EmptyShallowRef', (e) => Mr(e === '_' ? void 0 : e === '0n' ? BigInt(0) : kt(e))],
    ['EmptyRef', (e) => ue(e === '_' ? void 0 : e === '0n' ? BigInt(0) : kt(e))],
    ['ShallowRef', (e) => Mr(e)],
    ['ShallowReactive', (e) => be(e)],
    ['Ref', (e) => ue(e)],
    ['Reactive', (e) => re(e)],
  ],
  Vl = se({
    name: 'nuxt:revive-payload:client',
    order: -30,
    async setup(e) {
      let t, r;
      for (const [s, n] of Nl) Il(s, n);
      (Object.assign(e.payload, (([t, r] = ca(() => e.runWithContext(Ul))), (t = await t), r(), t)),
        (window.__NUXT__ = e.payload));
    },
  });
async function mr(e, t = {}) {
  const r = t.document || e.resolvedOptions.document;
  if (!r || !e.dirty) return;
  const s = { shouldRender: !0, tags: [] };
  if ((await e.hooks.callHook('dom:beforeRender', s), !!s.shouldRender))
    return (
      e._domUpdatePromise ||
        (e._domUpdatePromise = new Promise(async (n) => {
          const o = new Map(),
            i = new Promise((p) => {
              e.resolveTags().then((C) => {
                p(
                  C.map((D) => {
                    const M = o.get(D._d) || 0,
                      x = { tag: D, id: (M ? `${D._d}:${M}` : D._d) || D._h, shouldRender: !0 };
                    return (D._d && Co(D._d) && o.set(D._d, M + 1), x);
                  }),
                );
              });
            });
          let a = e._dom;
          if (!a) {
            a = {
              title: r.title,
              elMap: new Map().set('htmlAttrs', r.documentElement).set('bodyAttrs', r.body),
            };
            for (const p of ['body', 'head']) {
              const C = r[p]?.children;
              for (const D of C) {
                const M = D.tagName.toLowerCase();
                if (!V0.has(M)) continue;
                const x = yo(
                  { tag: M, props: {} },
                  {
                    innerHTML: D.innerHTML,
                    ...(D.getAttributeNames().reduce(
                      (S, y) => ((S[y] = D.getAttribute(y)), S),
                      {},
                    ) || {}),
                  },
                );
                if (
                  ((x.key = D.getAttribute('data-hid') || void 0),
                  (x._d = B0(x) || Do(x)),
                  a.elMap.has(x._d))
                ) {
                  let S = 1,
                    y = x._d;
                  for (; a.elMap.has(y); ) y = `${x._d}:${S++}`;
                  a.elMap.set(y, D);
                } else a.elMap.set(x._d, D);
              }
            }
          }
          ((a.pendingSideEffects = { ...a.sideEffects }), (a.sideEffects = {}));
          function l(p, C, D) {
            const M = `${p}:${C}`;
            ((a.sideEffects[M] = D), delete a.pendingSideEffects[M]);
          }
          function d({ id: p, $el: C, tag: D }) {
            const M = D.tag.endsWith('Attrs');
            (a.elMap.set(p, C),
              M ||
                (D.textContent &&
                  D.textContent !== C.textContent &&
                  (C.textContent = D.textContent),
                D.innerHTML && D.innerHTML !== C.innerHTML && (C.innerHTML = D.innerHTML),
                l(p, 'el', () => {
                  (C?.remove(), a.elMap.delete(p));
                })));
            for (const x in D.props) {
              if (!Object.prototype.hasOwnProperty.call(D.props, x)) continue;
              const S = D.props[x];
              if (x.startsWith('on') && typeof S == 'function') {
                const _ = C?.dataset;
                if (_ && _[`${x}fired`]) {
                  const E = x.slice(0, -5);
                  S.call(C, new Event(E.substring(2)));
                }
                C.getAttribute(`data-${x}`) !== '' &&
                  ((D.tag === 'bodyAttrs' ? r.defaultView : C).addEventListener(
                    x.substring(2),
                    S.bind(C),
                  ),
                  C.setAttribute(`data-${x}`, ''));
                continue;
              }
              const y = `attr:${x}`;
              if (x === 'class') {
                if (!S) continue;
                for (const _ of S)
                  (M && l(p, `${y}:${_}`, () => C.classList.remove(_)),
                    !C.classList.contains(_) && C.classList.add(_));
              } else if (x === 'style') {
                if (!S) continue;
                for (const [_, E] of S)
                  (l(p, `${y}:${_}`, () => {
                    C.style.removeProperty(_);
                  }),
                    C.style.setProperty(_, E));
              } else
                S !== !1 &&
                  S !== null &&
                  (C.getAttribute(x) !== S && C.setAttribute(x, S === !0 ? '' : String(S)),
                  M && l(p, y, () => C.removeAttribute(x)));
            }
          }
          const c = [],
            f = { bodyClose: void 0, bodyOpen: void 0, head: void 0 },
            h = await i;
          for (const p of h) {
            const { tag: C, shouldRender: D, id: M } = p;
            if (D) {
              if (C.tag === 'title') {
                ((r.title = C.textContent), l('title', '', () => (r.title = a.title)));
                continue;
              }
              ((p.$el = p.$el || a.elMap.get(M)), p.$el ? d(p) : V0.has(C.tag) && c.push(p));
            }
          }
          for (const p of c) {
            const C = p.tag.tagPosition || 'head';
            ((p.$el = r.createElement(p.tag.tag)),
              d(p),
              (f[C] = f[C] || r.createDocumentFragment()),
              f[C].appendChild(p.$el));
          }
          for (const p of h) await e.hooks.callHook('dom:renderTag', p, r, l);
          (f.head && r.head.appendChild(f.head),
            f.bodyOpen && r.body.insertBefore(f.bodyOpen, r.body.firstChild),
            f.bodyClose && r.body.appendChild(f.bodyClose));
          for (const p in a.pendingSideEffects) a.pendingSideEffects[p]();
          ((e._dom = a), await e.hooks.callHook('dom:rendered', { renders: h }), n());
        }).finally(() => {
          ((e._domUpdatePromise = void 0), (e.dirty = !1));
        })),
      e._domUpdatePromise
    );
}
function jl(e = {}) {
  const t = e.domOptions?.render || mr;
  e.document = e.document || (typeof window < 'u' ? document : void 0);
  const r = e.document?.head.querySelector('script[id="unhead:payload"]')?.innerHTML || !1;
  return hl({
    ...e,
    plugins: [...(e.plugins || []), { key: 'client', hooks: { 'entries:updated': t } }],
    init: [r ? JSON.parse(r) : !1, ...(e.init || [])],
  });
}
function Bl(e, t) {
  let r = 0;
  return () => {
    const s = ++r;
    t(() => {
      r === s && e();
    });
  };
}
function $l(e = {}) {
  const t = jl({
    domOptions: {
      render: Bl(
        () => mr(t),
        (r) => setTimeout(r, 0),
      ),
    },
    ...e,
  });
  return ((t.install = wl(t)), t);
}
const Gl = { disableDefaults: !0, disableCapoSorting: !1, plugins: [Dl, yl, El, Cl] },
  Wl = se({
    name: 'nuxt:head',
    enforce: 'pre',
    setup(e) {
      const t = $l(Gl);
      e.vueApp.use(t);
      {
        let r = !0;
        const s = async () => {
          ((r = !1), await mr(t));
        };
        (t.hooks.hook('dom:beforeRender', (o) => {
          o.shouldRender = !r;
        }),
          e.hooks.hook('page:start', () => {
            r = !0;
          }),
          e.hooks.hook('page:finish', () => {
            e.isHydrating || s();
          }),
          e.hooks.hook('app:error', s),
          e.hooks.hook('app:suspense:resolve', s));
        const n = t.push.bind(t);
        t.push = (o, i) => {
          const a = n(o, i),
            l = a.dispose.bind(a);
          return (
            (a.dispose = () => {
              const d = e['~transitionPromise'];
              d ? d.then(l) : l();
            }),
            a
          );
        };
      }
    },
  }),
  Zl = (e) => {
    const t = qt({ path: e.path });
    if (t.redirect) {
      const r = t.redirect.includes('#') ? t.redirect : t.redirect + e.hash;
      return Pe(r, { acceptRelative: !0 }) ? ((window.location.href = r), !1) : r;
    }
  },
  ql = [Zl];
function C0(e) {
  const t = e && typeof e == 'object' ? e : {};
  typeof e == 'object' &&
    (e = ro({ pathname: e.path || '', search: zn(e.query || {}), hash: e.hash || '' }));
  const r = new URL(e.toString(), window.location.href);
  return {
    path: r.pathname,
    fullPath: e,
    query: ur(r.search),
    hash: r.hash,
    params: t.params || {},
    name: void 0,
    matched: t.matched || [],
    redirectedFrom: void 0,
    meta: t.meta || {},
    href: e,
  };
}
const Kl = se({
    name: 'nuxt:router',
    enforce: 'pre',
    setup(e) {
      const t =
          M1(window.location.pathname, et().app.baseURL) +
          window.location.search +
          window.location.hash,
        r = [],
        s = { 'navigate:before': [], 'resolve:before': [], 'navigate:after': [], error: [] },
        n = (h, p) => (s[h].push(p), () => s[h].splice(s[h].indexOf(p), 1)),
        o = et().app.baseURL,
        i = re(C0(t));
      async function a(h, p) {
        try {
          const C = C0(h);
          for (const D of s['navigate:before']) {
            const M = await D(C, i);
            if (M === !1 || M instanceof Error) return;
            if (typeof M == 'string' && M.length) return await a(M, !0);
          }
          for (const D of s['resolve:before']) await D(C, i);
          (Object.assign(i, C),
            window.history[p ? 'replaceState' : 'pushState']({}, '', Zt(o, C.fullPath)),
            e.isHydrating || (await e.runWithContext(Sa)));
          for (const D of s['navigate:after']) await D(C, i);
        } catch (C) {
          for (const D of s.error) await D(C);
        }
      }
      const d = {
        currentRoute: Bn(() => i),
        isReady: () => Promise.resolve(),
        options: {},
        install: () => Promise.resolve(),
        push: (h) => a(h, !1),
        replace: (h) => a(h, !0),
        back: () => window.history.go(-1),
        go: (h) => window.history.go(h),
        forward: () => window.history.go(1),
        beforeResolve: (h) => n('resolve:before', h),
        beforeEach: (h) => n('navigate:before', h),
        afterEach: (h) => n('navigate:after', h),
        onError: (h) => n('error', h),
        resolve: C0,
        addRoute: (h, p) => {
          r.push(p);
        },
        getRoutes: () => r,
        hasRoute: (h) => r.some((p) => p.name === h),
        removeRoute: (h) => {
          const p = r.findIndex((C) => C.name === h);
          p !== -1 && r.splice(p, 1);
        },
      };
      (e.vueApp.component(
        'RouterLink',
        sn({
          functional: !0,
          props: {
            to: { type: String, required: !0 },
            custom: Boolean,
            replace: Boolean,
            activeClass: String,
            exactActiveClass: String,
            ariaCurrentValue: String,
          },
          setup: (h, { slots: p }) => {
            const C = () => a(h.to, h.replace);
            return () => {
              const D = d.resolve(h.to);
              return h.custom
                ? p.default?.({ href: h.to, navigate: C, route: D })
                : L3('a', { href: h.to, onClick: (M) => (M.preventDefault(), C()) }, p);
            };
          },
        }),
      ),
        window.addEventListener('popstate', (h) => {
          const p = h.target.location;
          d.replace(p.href.replace(p.origin, ''));
        }),
        (e._route = i),
        (e._middleware ||= { global: [], named: {} }));
      const c = e.payload.state._layout,
        f = e.payload.state._layoutProps;
      return (
        e.hooks.hookOnce('app:created', async () => {
          (d.beforeEach(async (h, p) => {
            ((h.meta = re(h.meta || {})),
              e.isHydrating &&
                c &&
                !J2(h.meta.layout) &&
                ((h.meta.layout = c), (h.meta.layoutProps = f)),
              (e._processingMiddleware = !0));
            {
              const C = new Set([...ql, ...e._middleware.global]),
                D = qt({ path: h.path });
              if (D.appMiddleware)
                for (const M in D.appMiddleware) {
                  const x = e._middleware.named[M];
                  x && (D.appMiddleware[M] ? C.add(x) : C.delete(x));
                }
              for (const M of C) {
                const x = await e.runWithContext(() => M(h, p));
                if (x !== !0 && (x || x === !1)) return x;
              }
            }
          }),
            d.afterEach(() => {
              delete e._processingMiddleware;
            }),
            await d.replace(t),
            H1(i.fullPath, t) || (await e.runWithContext(() => xa(i.fullPath))));
        }),
        { provide: { route: i, router: d } }
      );
    },
  }),
  Cs =
    globalThis.requestIdleCallback ||
    ((e) => {
      const t = Date.now(),
        r = { didTimeout: !1, timeRemaining: () => Math.max(0, 50 - (Date.now() - t)) };
      return setTimeout(() => {
        e(r);
      }, 1);
    }),
  yc =
    globalThis.cancelIdleCallback ||
    ((e) => {
      clearTimeout(e);
    }),
  Er = (e) => {
    const t = b2();
    t.isHydrating
      ? t.hooks.hookOnce('app:suspense:resolve', () => {
          Cs(() => e());
        })
      : Cs(() => e());
  },
  Jl = se({
    name: 'nuxt:payload',
    setup(e) {
      const t = new Set();
      (ge().beforeResolve(async (r, s) => {
        if (r.path === s.path) return;
        const n = await gs(r.path);
        if (n) {
          for (const o of t) delete e.static.data[o];
          for (const o in n.data) (o in e.static.data || t.add(o), (e.static.data[o] = n.data[o]));
        }
      }),
        Er(() => {
          (e.hooks.hook('link:prefetch', async (r) => {
            const { hostname: s } = new URL(r, window.location.href);
            s === window.location.hostname &&
              (await gs(r).catch(() => {
                console.warn('[nuxt] Error preloading payload for', r);
              }));
          }),
            navigator.connection?.effectiveType !== 'slow-2g' && setTimeout(_r, 1e3));
        }));
    },
  }),
  zl = se(() => {
    const e = ge();
    Er(() => {
      e.beforeResolve(async () => {
        await new Promise((t) => {
          (setTimeout(t, 100),
            requestAnimationFrame(() => {
              setTimeout(t, 0);
            }));
        });
      });
    });
  }),
  Xl = se((e) => {
    let t;
    async function r() {
      let s;
      try {
        s = await _r();
      } catch (n) {
        const o = n;
        if (!('status' in o && (o.status === 404 || o.status === 403))) throw o;
      }
      (t && clearTimeout(t), (t = setTimeout(r, ls)));
      try {
        const n = await $fetch(hr('builds/latest.json') + `?${Date.now()}`);
        n.id !== s?.id && (e.hooks.callHook('app:manifest:update', n), t && clearTimeout(t));
      } catch {}
    }
    Er(() => {
      t = setTimeout(r, ls);
    });
  });
function Yl(e = {}) {
  const t = e.path || window.location.pathname,
    r = new URL(t, window.location.href);
  if (r.host !== window.location.host)
    throw new Error(`Cannot navigate to a URL with a different host: '${t}'.`);
  if (r.protocol && T0(r.protocol))
    throw new Error(`Cannot navigate to a URL with '${r.protocol}' protocol.`);
  let s = {};
  try {
    s = kt(sessionStorage.getItem('nuxt:reload') || '{}');
  } catch {}
  if (e.force || s?.path !== t || s?.expires < Date.now()) {
    try {
      sessionStorage.setItem(
        'nuxt:reload',
        JSON.stringify({ path: t, expires: Date.now() + (e.ttl ?? 1e4) }),
      );
    } catch {}
    if (e.persistState)
      try {
        sessionStorage.setItem('nuxt:reload:state', JSON.stringify({ state: b2().payload.state }));
      } catch {}
    window.location.pathname !== t ? (window.location.href = t) : window.location.reload();
  }
}
const Ql = se({
    name: 'nuxt:chunk-reload',
    setup(e) {
      const t = ge(),
        r = et(),
        s = new Set();
      (t.beforeEach(() => {
        s.clear();
      }),
        e.hook('app:chunkError', ({ error: o }) => {
          s.add(o);
        }));
      function n(o) {
        const i = Zt(r.app.baseURL, o.fullPath);
        Yl({ path: i, persistState: !0 });
      }
      (e.hook('app:manifest:update', () => {
        t.beforeResolve(n);
      }),
        t.onError((o, i) => {
          s.has(o) && n(i);
        }));
    },
  }),
  ec = se({ name: 'nuxt:global-components' }),
  tc = [Vl, Wl, Kl, Jl, zl, Xl, Ql, ec],
  rc = (e, t) => {
    const r = e.__vccOpts || e;
    for (const [s, n] of t) r[s] = n;
    return r;
  },
  sc = {
    class:
      'antialiased bg-white dark:bg-black dark:text-white flex flex-col items-center justify-center min-h-screen place-content-center sm:text-base text-black text-sm',
  },
  nc = {
    class:
      'bg-white border-gray-200 border-t dark:bg-black dark:border-gray-900 flex h-[70px] items-center relative w-full',
  },
  oc = { class: 'lg:px-8 mx-auto px-4 sm:px-6 w-full' },
  ic = { class: 'flex flex-col gap-3 items-center sm:flex-row sm:justify-between' },
  ac = { class: 'flex flex-col-reverse gap-3 items-center sm:flex-row' },
  lc = { class: 'dark:text-gray-300 text-gray-700 text-sm' },
  cc = {
    __name: 'welcome',
    props: {
      appName: { type: String, default: 'Nuxt' },
      version: { type: String, default: '' },
      title: { type: String, default: 'Welcome to Nuxt!' },
      readDocs: {
        type: String,
        default:
          'We highly recommend you take a look at the Nuxt documentation, whether you are new or have previous experience with the framework.',
      },
      followTwitter: {
        type: String,
        default:
          'Follow the Nuxt Twitter account to get latest news about releases, new modules, tutorials and tips.',
      },
      starGitHub: {
        type: String,
        default:
          'Nuxt is open source and the code is available on GitHub, feel free to star it, participate in discussions or dive into the source.',
      },
    },
    setup(e) {
      return (
        kl({
          title: `${e.title}`,
          script: [
            {
              innerHTML: `!function(){const e=document.createElement("link").relList;if(!(e&&e.supports&&e.supports("modulepreload"))){for(const e of document.querySelectorAll('link[rel="modulepreload"]'))r(e);new MutationObserver(e=>{for(const o of e)if("childList"===o.type)for(const e of o.addedNodes)"LINK"===e.tagName&&"modulepreload"===e.rel&&r(e)}).observe(document,{childList:!0,subtree:!0})}function r(e){if(e.ep)return;e.ep=!0;const r=function(e){const r={};return e.integrity&&(r.integrity=e.integrity),e.referrerPolicy&&(r.referrerPolicy=e.referrerPolicy),"use-credentials"===e.crossOrigin?r.credentials="include":"anonymous"===e.crossOrigin?r.credentials="omit":r.credentials="same-origin",r}(e);fetch(e.href,r)}}();`,
            },
          ],
          style: [
            {
              innerHTML:
                '@property --gradient-angle{syntax:"<angle>";inherits:false;initial-value:180deg}@keyframes gradient-rotate{0%{--gradient-angle:0deg}to{--gradient-angle:360deg}}*,:after,:before{border-color:var(--un-default-border-color,#e5e7eb);border-style:solid;border-width:0;box-sizing:border-box}:after,:before{--un-content:""}html{line-height:1.5;-webkit-text-size-adjust:100%;font-family:ui-sans-serif,system-ui,sans-serif,Apple Color Emoji,Segoe UI Emoji,Segoe UI Symbol,Noto Color Emoji;font-feature-settings:normal;font-variation-settings:normal;-moz-tab-size:4;tab-size:4;-webkit-tap-highlight-color:transparent}body{line-height:inherit;margin:0}h1,h2,h3{font-size:inherit;font-weight:inherit}a{color:inherit;text-decoration:inherit}h1,h2,h3,p,ul{margin:0}ul{list-style:none;padding:0}img,svg{display:block;vertical-align:middle}img{height:auto;max-width:100%}*,:after,:before{--un-rotate:0;--un-rotate-x:0;--un-rotate-y:0;--un-rotate-z:0;--un-scale-x:1;--un-scale-y:1;--un-scale-z:1;--un-skew-x:0;--un-skew-y:0;--un-translate-x:0;--un-translate-y:0;--un-translate-z:0;--un-pan-x: ;--un-pan-y: ;--un-pinch-zoom: ;--un-scroll-snap-strictness:proximity;--un-ordinal: ;--un-slashed-zero: ;--un-numeric-figure: ;--un-numeric-spacing: ;--un-numeric-fraction: ;--un-border-spacing-x:0;--un-border-spacing-y:0;--un-ring-offset-shadow:0 0 transparent;--un-ring-shadow:0 0 transparent;--un-shadow-inset: ;--un-shadow:0 0 transparent;--un-ring-inset: ;--un-ring-offset-width:0px;--un-ring-offset-color:#fff;--un-ring-width:0px;--un-ring-color:rgba(147,197,253,.5);--un-blur: ;--un-brightness: ;--un-contrast: ;--un-drop-shadow: ;--un-grayscale: ;--un-hue-rotate: ;--un-invert: ;--un-saturate: ;--un-sepia: ;--un-backdrop-blur: ;--un-backdrop-brightness: ;--un-backdrop-contrast: ;--un-backdrop-grayscale: ;--un-backdrop-hue-rotate: ;--un-backdrop-invert: ;--un-backdrop-opacity: ;--un-backdrop-saturate: ;--un-backdrop-sepia: }',
            },
          ],
        }),
        (r, s) => (
          Z2(),
          On('div', sc, [
            s[2] ||
              (s[2] = l0(
                '<div class="flex flex-1 flex-col gap-y-16 py-14" data-v-30b323c7><div class="flex flex-col gap-y-4 items-center justify-center" data-v-30b323c7><a href="https://nuxt.com" target="_blank" aria-label="Nuxt" data-v-30b323c7><svg xmlns="http://www.w3.org/2000/svg" width="61" height="42" fill="none" viewBox="0 0 61 42" data-v-30b323c7><path fill="#00dc82" d="M33.987 41.221h22.425a4.054 4.054 0 0 0 4.057-4.06 4.06 4.06 0 0 0-.545-2.03l-15.06-26.1a4.057 4.057 0 0 0-5.541-1.486 4.06 4.06 0 0 0-1.485 1.486l-3.851 6.678-7.529-13.058a4.06 4.06 0 0 0-7.028 0L.69 35.13a4.06 4.06 0 0 0 3.511 6.09h14.077c5.577 0 9.69-2.451 12.52-7.233L37.67 22.08l3.68-6.372 11.046 19.14H37.67zm-15.939-6.378-9.823-.003L22.95 9.322l7.348 12.76-4.92 8.527c-1.88 3.103-4.014 4.234-7.33 4.234" data-v-30b323c7></path></svg></a><h1 class="dark:text-white font-semibold sm:text-5xl text-4xl text-black text-center" data-v-30b323c7>Welcome to Nuxt!</h1></div><div class="gap-6 grid grid-cols-2 lg:grid-cols-10 max-w-[960px] px-4" data-v-30b323c7><div class="col-span-2 get-started-gradient-border lg:col-span-10 relative" data-v-30b323c7><div class="absolute bg-gradient-to-r duration-300 from-green-400 get-started-gradient-left inset-y-0 left-0 rounded-xl to-transparent transition-opacity w-[20%] z-1" data-v-30b323c7></div><div class="absolute bg-gradient-to-l duration-300 from-blue-400 get-started-gradient-right inset-y-0 right-0 rounded-xl to-transparent transition-opacity w-[20%] z-1" data-v-30b323c7></div><div class="-top-[58px] absolute flex inset-x-0 justify-center w-full" data-v-30b323c7><img alt src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22105%22%20height%3D%22116%22%20fill%3D%22none%22%3E%3Cg%20filter%3D%22url(%23a)%22%20shape-rendering%3D%22geometricPrecision%22%3E%3Cpath%20fill%3D%22%2318181B%22%20d%3D%22M17.203%2033.223%2046.9%2014.286a8.416%208.416%200%200%201%208.64-.18L87.38%2031.97c2.68%201.527%204.365%204.409%204.428%207.571l.191%2034.944c.063%203.151-1.491%206.104-4.091%207.776l-30.143%2019.383a8.417%208.417%200%200%201-8.75.251l-31.126-17.73C15.135%2082.595%2012.98%2079.6%2013%2076.35V40.828c.02-3.111%201.614-5.994%204.203-7.605Z%22%2F%3E%3Cpath%20stroke%3D%22url(%23b)%22%20stroke-width%3D%222%22%20d%3D%22M46.9%2014.286%2017.202%2033.223c-2.59%201.61-4.183%204.494-4.203%207.605V76.35m33.9-62.064a8.416%208.416%200%200%201%208.64-.18m-8.64.18a8.435%208.435%200%200%201%208.64-.18M13%2076.35c-.02%203.25%202.135%206.246%204.888%207.814M13%2076.35c-.02%203.233%202.136%206.247%204.888%207.814m0%200%2031.126%2017.731m0%200a8.417%208.417%200%200%200%208.75-.251m-8.75.251a8.438%208.438%200%200%200%208.75-.251m0%200%2030.143-19.383m0%200c2.598-1.67%204.154-4.627%204.091-7.776m-4.091%207.776c2.6-1.672%204.154-4.625%204.091-7.776m0%200-.19-34.944m0%200c-.064-3.162-1.75-6.044-4.43-7.571m4.43%207.571c-.063-3.147-1.75-6.045-4.43-7.571m0%200L55.54%2014.105%22%2F%3E%3C%2Fg%3E%3Cpath%20fill%3D%22url(%23c)%22%20d%3D%22M48.669%2067.696c-.886%202.69-3.02%204.659-6.153%205.709-1.41.465-2.88.72-4.364.755a1.313%201.313%200%200%201-1.312-1.313c.035-1.484.29-2.954.754-4.364%201.05-3.133%203.02-5.266%205.71-6.152a1.312%201.312%200%201%201%20.836%202.477c-3.232%201.083-4.232%204.577-4.544%206.595%202.018-.311%205.512-1.312%206.595-4.544a1.313%201.313%200%200%201%202.477.837Zm16.39-12.486-1.46%201.477v10.057a2.657%202.657%200%200%201-.772%201.854l-5.316%205.3a2.559%202.559%200%200%201-1.853.77%202.413%202.413%200%200%201-.755-.115%202.624%202.624%200%200%201-1.821-2.001l-1.296-6.48-6.858-6.858-6.48-1.297a2.625%202.625%200%200%201-2.002-1.82%202.609%202.609%200%200%201%20.656-2.61l5.3-5.315a2.658%202.658%200%200%201%201.853-.771h10.057l1.477-1.46c4.692-4.692%209.499-4.561%2011.353-4.282a2.576%202.576%200%200%201%202.198%202.198c.28%201.854.41%206.661-4.282%2011.353Zm-26.103.132%206.185%201.23%206.546-6.546h-7.432l-5.299%205.316Zm8.482%202.657L53%2063.561l10.205-10.205c1.28-1.28%204.2-4.724%203.543-9.105-4.38-.656-7.826%202.264-9.105%203.544L47.438%2057.999Zm13.535%201.313-6.546%206.546%201.23%206.185%205.316-5.299v-7.432Z%22%20shape-rendering%3D%22geometricPrecision%22%2F%3E%3Cdefs%3E%3ClinearGradient%20id%3D%22b%22%20x1%3D%2257.994%22%20x2%3D%2292%22%20y1%3D%2258%22%20y2%3D%2258%22%20gradientUnits%3D%22userSpaceOnUse%22%3E%3Cstop%20stop-color%3D%22%2300DC82%22%2F%3E%3Cstop%20offset%3D%22.5%22%20stop-color%3D%22%231DE0B1%22%2F%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%2336E4DA%22%2F%3E%3C%2FlinearGradient%3E%3ClinearGradient%20id%3D%22c%22%20x1%3D%2255.197%22%20x2%3D%2269.453%22%20y1%3D%2258.107%22%20y2%3D%2258.107%22%20gradientUnits%3D%22userSpaceOnUse%22%3E%3Cstop%20stop-color%3D%22%2300DC82%22%2F%3E%3Cstop%20offset%3D%22.5%22%20stop-color%3D%22%231DE0B1%22%2F%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%2336E4DA%22%2F%3E%3C%2FlinearGradient%3E%3Cfilter%20id%3D%22a%22%20width%3D%22104.897%22%20height%3D%22115.897%22%20x%3D%22.052%22%20y%3D%22.052%22%20color-interpolation-filters%3D%22sRGB%22%20filterUnits%3D%22userSpaceOnUse%22%3E%3CfeFlood%20flood-opacity%3D%220%22%20result%3D%22BackgroundImageFix%22%2F%3E%3CfeColorMatrix%20in%3D%22SourceAlpha%22%20result%3D%22hardAlpha%22%20values%3D%220%200%200%200%200%200%200%200%200%200%200%200%200%200%200%200%200%200%20127%200%22%2F%3E%3CfeOffset%2F%3E%3CfeGaussianBlur%20stdDeviation%3D%225.974%22%2F%3E%3CfeComposite%20in2%3D%22hardAlpha%22%20operator%3D%22out%22%2F%3E%3CfeColorMatrix%20values%3D%220%200%200%200%201%200%200%200%200%201%200%200%200%200%201%200%200%200%200.07%200%22%2F%3E%3CfeBlend%20in2%3D%22BackgroundImageFix%22%20result%3D%22effect1_dropShadow_2724_4091%22%2F%3E%3CfeBlend%20in%3D%22SourceGraphic%22%20in2%3D%22effect1_dropShadow_2724_4091%22%20result%3D%22shape%22%2F%3E%3C%2Ffilter%3E%3C%2Fdefs%3E%3C%2Fsvg%3E%0A" class="dark:block hidden" data-v-30b323c7> <img alt src="data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22105%22%20height%3D%22116%22%20fill%3D%22none%22%3E%3Cg%20filter%3D%22url(%23a)%22%3E%3Cpath%20fill%3D%22%23fff%22%20d%3D%22M17.203%2033.223%2046.9%2014.286a8.416%208.416%200%200%201%208.64-.18L87.38%2031.97c2.68%201.527%204.365%204.409%204.428%207.571l.191%2034.944c.063%203.151-1.491%206.104-4.091%207.776l-30.143%2019.383a8.417%208.417%200%200%201-8.75.251l-31.126-17.73C15.135%2082.595%2012.98%2079.6%2013%2076.35V40.828c.02-3.111%201.614-5.994%204.203-7.605Z%22%2F%3E%3Cpath%20stroke%3D%22url(%23b)%22%20stroke-width%3D%222%22%20d%3D%22M46.9%2014.286%2017.202%2033.223c-2.59%201.61-4.183%204.494-4.203%207.605V76.35m33.9-62.064a8.416%208.416%200%200%201%208.64-.18m-8.64.18a8.435%208.435%200%200%201%208.64-.18M13%2076.35c-.02%203.25%202.135%206.246%204.888%207.814M13%2076.35c-.02%203.233%202.136%206.247%204.888%207.814m0%200%2031.126%2017.731m0%200a8.417%208.417%200%200%200%208.75-.251m-8.75.251a8.438%208.438%200%200%200%208.75-.251m0%200%2030.143-19.383m0%200c2.598-1.67%204.154-4.627%204.091-7.776m-4.091%207.776c2.6-1.672%204.154-4.625%204.091-7.776m0%200-.19-34.944m0%200c-.064-3.162-1.75-6.044-4.43-7.571m4.43%207.571c-.063-3.147-1.75-6.045-4.43-7.571m0%200L55.54%2014.105%22%2F%3E%3C%2Fg%3E%3Cpath%20fill%3D%22%23fff%22%20d%3D%22M32%2037h42v42H32z%22%2F%3E%3Cpath%20fill%3D%22url(%23c)%22%20d%3D%22M48.669%2067.697c-.886%202.69-3.02%204.659-6.153%205.709-1.41.465-2.88.72-4.364.755a1.313%201.313%200%200%201-1.312-1.313c.035-1.484.29-2.954.754-4.364%201.05-3.134%203.02-5.266%205.71-6.152a1.314%201.314%200%201%201%20.836%202.477c-3.232%201.083-4.232%204.577-4.544%206.595%202.018-.311%205.512-1.312%206.595-4.544a1.313%201.313%200%200%201%202.477.837Zm16.39-12.486-1.46%201.477v10.057a2.657%202.657%200%200%201-.772%201.854l-5.316%205.3a2.559%202.559%200%200%201-1.853.77%202.413%202.413%200%200%201-.755-.115%202.626%202.626%200%200%201-1.821-2.001l-1.296-6.48-6.858-6.858-6.48-1.297a2.625%202.625%200%200%201-2.002-1.82%202.609%202.609%200%200%201%20.656-2.61l5.3-5.315a2.658%202.658%200%200%201%201.853-.771h10.057l1.477-1.46c4.692-4.692%209.499-4.561%2011.353-4.282a2.576%202.576%200%200%201%202.198%202.198c.28%201.854.41%206.661-4.282%2011.353Zm-26.103.132%206.185%201.23%206.546-6.546h-7.432l-5.299%205.316ZM47.438%2058%2053%2063.562l10.205-10.204c1.28-1.28%204.2-4.725%203.543-9.106-4.38-.656-7.826%202.264-9.105%203.544L47.438%2058Zm13.535%201.313-6.546%206.546%201.23%206.185%205.316-5.299v-7.432Z%22%2F%3E%3Cdefs%3E%3ClinearGradient%20id%3D%22b%22%20x1%3D%2257.994%22%20x2%3D%2292%22%20y1%3D%2258%22%20y2%3D%2258%22%20gradientUnits%3D%22userSpaceOnUse%22%3E%3Cstop%20stop-color%3D%22%2300DC82%22%2F%3E%3Cstop%20offset%3D%22.5%22%20stop-color%3D%22%231DE0B1%22%2F%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%2336E4DA%22%2F%3E%3C%2FlinearGradient%3E%3ClinearGradient%20id%3D%22c%22%20x1%3D%2255.197%22%20x2%3D%2269.453%22%20y1%3D%2258.108%22%20y2%3D%2258.108%22%20gradientUnits%3D%22userSpaceOnUse%22%3E%3Cstop%20stop-color%3D%22%2300DC82%22%2F%3E%3Cstop%20offset%3D%22.5%22%20stop-color%3D%22%231DE0B1%22%2F%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%2336E4DA%22%2F%3E%3C%2FlinearGradient%3E%3Cfilter%20id%3D%22a%22%20width%3D%22104.897%22%20height%3D%22115.897%22%20x%3D%22.052%22%20y%3D%22.052%22%20color-interpolation-filters%3D%22sRGB%22%20filterUnits%3D%22userSpaceOnUse%22%3E%3CfeFlood%20flood-opacity%3D%220%22%20result%3D%22BackgroundImageFix%22%2F%3E%3CfeColorMatrix%20in%3D%22SourceAlpha%22%20result%3D%22hardAlpha%22%20values%3D%220%200%200%200%200%200%200%200%200%200%200%200%200%200%200%200%200%200%20127%200%22%2F%3E%3CfeOffset%2F%3E%3CfeGaussianBlur%20stdDeviation%3D%225.974%22%2F%3E%3CfeComposite%20in2%3D%22hardAlpha%22%20operator%3D%22out%22%2F%3E%3CfeColorMatrix%20values%3D%220%200%200%200%201%200%200%200%200%201%200%200%200%200%201%200%200%200%200.07%200%22%2F%3E%3CfeBlend%20in2%3D%22BackgroundImageFix%22%20result%3D%22effect1_dropShadow_2726_4054%22%2F%3E%3CfeBlend%20in%3D%22SourceGraphic%22%20in2%3D%22effect1_dropShadow_2726_4054%22%20result%3D%22shape%22%2F%3E%3C%2Ffilter%3E%3C%2Fdefs%3E%3C%2Fsvg%3E%0A" class="dark:hidden" data-v-30b323c7></div><div class="flex flex-col gap-y-4 items-center pb-6 pt-[58px] px-4 rounded-xl sm:px-28 z-10" data-v-30b323c7><h2 class="dark:text-white font-semibold text-2xl text-black" data-v-30b323c7>Get started</h2><p class="mb-2 text-center" data-v-30b323c7>Remove this welcome page by replacing <a class="bg-gray-100 dark:bg-white/10 font-bold font-mono p-1 rounded" data-v-30b323c7>&lt;NuxtWelcome /&gt;</a> in <a href="https://nuxt.com/docs/guide/directory-structure/app" target="_blank" rel="noopener" class="bg-gray-100 dark:bg-white/10 font-bold font-mono p-1 rounded" data-v-30b323c7>app.vue</a> with your own code, or creating your own <span class="bg-gray-100 dark:bg-white/10 font-bold font-mono p-1 rounded" data-v-30b323c7>app.vue</span> if it doesn&#39;t exist.</p></div></div><div class="border border-gray-200 col-span-2 dark:border-transparent dark:text-white hover:border-transparent items-center justify-center lg:col-span-6 lg:min-h-min md:min-h-[180px] modules-container relative rounded-xl sm:col-span-1 sm:min-h-[220px] text-black" data-v-30b323c7><div class="gradient-border gradient-border-modules gradient-border-rect" data-v-30b323c7></div><div class="absolute bg-gradient-to-l duration-300 from-yellow-400 inset-y-0 modules-gradient-right right-0 rounded-xl to-transparent transition-opacity w-[20%] z-1" data-v-30b323c7></div><a href="https://nuxt.com/modules" target="_blank" class="bg-white dark:bg-gray-900 dark:border-none flex gap-x-4 items-center justify-center lg:min-h-min md:min-h-[180px] px-5 py-6 rounded-xl sm:min-h-[220px]" data-v-30b323c7><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20width%3D%2253%22%20height%3D%2258%22%20viewBox%3D%220%200%2053%2058%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%0A%3Cg%20clip-path%3D%22url(%23clip0_2613_3853)%22%3E%0A%3Cpath%20d%3D%22M51.1519%2039.8821C51.154%2039.9844%2051.1527%2040.0863%2051.148%2040.1877C51.0782%2041.7091%2050.2566%2043.1165%2048.9325%2043.9357L29.0918%2056.2117C27.6504%2057.1035%2025.8212%2057.1564%2024.3387%2056.3439L3.85107%2045.1148C2.27157%2044.2491%201.14238%2042.6366%201.15291%2041.0494L1.15293%2041.0427L1.153%2018.552C1.15301%2018.5509%201.15302%2018.5499%201.15302%2018.5488C1.16485%2016.9324%202.02611%2015.4289%203.43319%2014.5869L3.43322%2014.587L3.44269%2014.5812L22.9844%202.59084C24.4169%201.73583%2026.2139%201.69824%2027.6729%202.49791L27.6729%202.49792L27.6784%202.50094L48.6303%2013.8121C48.6313%2013.8126%2048.6322%2013.8131%2048.6331%2013.8136C50.0797%2014.6078%2050.9898%2016.1132%2051.026%2017.7438L51.1517%2039.8672L51.1517%2039.8746L51.1519%2039.8821Z%22%20fill%3D%22white%22%20stroke%3D%22url(%23paint0_linear_2613_3853)%22%20stroke-width%3D%222%22%2F%3E%0A%3Cpath%20d%3D%22M33.8193%2042.2552H17.8193C16.7585%2042.2552%2015.7411%2041.8337%2014.9909%2041.0836C14.2408%2040.3334%2013.8193%2039.316%2013.8193%2038.2552V24.9218C13.8193%2023.861%2014.2408%2022.8435%2014.9909%2022.0934C15.7411%2021.3433%2016.7585%2020.9218%2017.8193%2020.9218H19.1527C19.1751%2019.792%2019.5558%2018.6985%2020.2399%2017.7991C20.924%2016.8996%2021.8761%2016.2407%2022.9589%2015.9173C24.0416%2015.594%2025.1992%2015.6229%2026.2644%2016C27.3297%2016.377%2028.2477%2017.0827%2028.886%2018.0152C29.4839%2018.8674%2029.8094%2019.8808%2029.8193%2020.9218H33.8193C34.173%2020.9218%2034.5121%2021.0623%2034.7621%2021.3124C35.0122%2021.5624%2035.1527%2021.9015%2035.1527%2022.2552V26.2552C36.2825%2026.2776%2037.376%2026.6583%2038.2754%2027.3424C39.1749%2028.0265%2039.8338%2028.9786%2040.1572%2030.0613C40.4805%2031.1441%2040.4516%2032.3016%2040.0745%2033.3669C39.6975%2034.4322%2038.9918%2035.3502%2038.0593%2035.9885C37.2071%2036.5864%2036.1937%2036.9118%2035.1527%2036.9218V36.9218V40.9218C35.1527%2041.2755%2035.0122%2041.6146%2034.7621%2041.8646C34.5121%2042.1147%2034.173%2042.2552%2033.8193%2042.2552ZM17.8193%2023.5885C17.4657%2023.5885%2017.1266%2023.729%2016.8765%2023.979C16.6265%2024.2291%2016.486%2024.5682%2016.486%2024.9218V38.2552C16.486%2038.6088%2016.6265%2038.9479%2016.8765%2039.198C17.1266%2039.448%2017.4657%2039.5885%2017.8193%2039.5885H32.486V35.3485C32.4849%2035.1347%2032.5351%2034.9238%2032.6326%2034.7335C32.7301%2034.5432%2032.8718%2034.3792%2033.046%2034.2552C33.2196%2034.1313%2033.4204%2034.051%2033.6316%2034.0208C33.8427%2033.9907%2034.058%2034.0116%2034.2593%2034.0818C34.6393%2034.2368%2035.0532%2034.2901%2035.46%2034.2363C35.8669%2034.1825%2036.2527%2034.0236%2036.5793%2033.7752C36.9045%2033.5769%2037.1834%2033.3113%2037.3973%2032.9962C37.6111%2032.6811%2037.7551%2032.3239%2037.8193%2031.9485C37.8708%2031.5699%2037.8402%2031.1847%2037.7298%2030.8189C37.6194%2030.4532%2037.4317%2030.1154%2037.1793%2029.8285C36.8381%2029.414%2036.3734%2029.1193%2035.8529%2028.9874C35.3325%2028.8555%2034.7835%2028.8932%2034.286%2029.0952C34.0846%2029.1654%2033.8694%2029.1863%2033.6582%2029.1562C33.4471%2029.126%2033.2463%2029.0457%2033.0727%2028.9218C32.8985%2028.7978%2032.7567%2028.6338%2032.6593%2028.4435C32.5618%2028.2532%2032.5115%2028.0423%2032.5127%2027.8285V23.5885H28.246C28.0269%2023.6009%2027.8081%2023.559%2027.609%2023.4666C27.4099%2023.3742%2027.2368%2023.234%2027.1049%2023.0586C26.973%2022.8832%2026.8864%2022.6779%2026.8529%2022.461C26.8194%2022.2441%2026.8399%2022.0222%2026.9127%2021.8152C27.0677%2021.4352%2027.1209%2021.0213%2027.0671%2020.6145C27.0134%2020.2076%2026.8544%2019.8218%2026.606%2019.4952C26.4091%2019.1607%2026.1395%2018.8749%2025.8172%2018.6588C25.4948%2018.4427%2025.128%2018.3019%2024.7438%2018.2468C24.3597%2018.1917%2023.9681%2018.2238%2023.598%2018.3407C23.2279%2018.4575%2022.8889%2018.6561%2022.606%2018.9218C22.3433%2019.1824%2022.1377%2019.4948%2022.0023%2019.8391C21.8668%2020.1834%2021.8045%2020.5521%2021.8193%2020.9218C21.8224%2021.2277%2021.8812%2021.5304%2021.9927%2021.8152C22.0632%2022.0168%2022.0842%2022.2324%2022.054%2022.4438C22.0237%2022.6553%2021.9432%2022.8564%2021.819%2023.0302C21.6949%2023.204%2021.5308%2023.3454%2021.3406%2023.4426C21.1504%2023.5397%2020.9396%2023.5898%2020.726%2023.5885H17.8193Z%22%20fill%3D%22url(%23paint1_linear_2613_3853)%22%2F%3E%0A%3C%2Fg%3E%0A%3Cdefs%3E%0A%3ClinearGradient%20id%3D%22paint0_linear_2613_3853%22%20x1%3D%220.662695%22%20y1%3D%2218.4025%22%20x2%3D%2251.7209%22%20y2%3D%2244.2212%22%20gradientUnits%3D%22userSpaceOnUse%22%3E%0A%3Cstop%20stop-color%3D%22%23F7D14C%22%2F%3E%0A%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23A38108%22%2F%3E%0A%3C%2FlinearGradient%3E%0A%3ClinearGradient%20id%3D%22paint1_linear_2613_3853%22%20x1%3D%2213.7453%22%20y1%3D%2221.3705%22%20x2%3D%2240.3876%22%20y2%3D%2235.7024%22%20gradientUnits%3D%22userSpaceOnUse%22%3E%0A%3Cstop%20stop-color%3D%22%23F7D14C%22%2F%3E%0A%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23A38108%22%2F%3E%0A%3C%2FlinearGradient%3E%0A%3CclipPath%20id%3D%22clip0_2613_3853%22%3E%0A%3Crect%20width%3D%2252%22%20height%3D%2257%22%20fill%3D%22white%22%20transform%3D%22translate(0.152832%200.920898)%22%2F%3E%0A%3C%2FclipPath%3E%0A%3C%2Fdefs%3E%0A%3C%2Fsvg%3E%0A" alt="modules icon" class="modules-image-color-light" data-v-30b323c7> <img src="data:image/svg+xml;charset=utf-8,%3Csvg%20width%3D%2253%22%20height%3D%2258%22%20viewBox%3D%220%200%2053%2058%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%0A%3Cpath%20d%3D%22M3.43319%2014.5869L3.43322%2014.587L3.44269%2014.5812L22.9844%202.59084C24.4246%201.73116%2026.2124%201.69742%2027.6729%202.49791L27.6729%202.49792L27.6784%202.50094L48.6303%2013.8121C48.6313%2013.8126%2048.6322%2013.8131%2048.6331%2013.8137C50.0812%2014.6086%2050.9896%2016.1043%2051.026%2017.7437L51.1517%2039.8672L51.1517%2039.8746L51.1519%2039.8821C51.1856%2041.5204%2050.346%2043.0611%2048.9325%2043.9357L29.0918%2056.2117C27.6424%2057.1085%2025.8227%2057.1572%2024.3387%2056.3439L3.85107%2045.1148C2.26984%2044.2481%201.14232%2042.646%201.15293%2041.0494V41.0427L1.153%2018.552C1.15301%2018.5509%201.15302%2018.5499%201.15302%2018.5488C1.16485%2016.9324%202.02611%2015.4289%203.43319%2014.5869Z%22%20fill%3D%22%2318181B%22%20stroke%3D%22url(%23paint0_linear_2595_7337)%22%20stroke-width%3D%222%22%2F%3E%0A%3Cpath%20d%3D%22M33.8193%2042.2542H17.8193C16.7585%2042.2542%2015.7411%2041.8328%2014.9909%2041.0826C14.2408%2040.3325%2013.8193%2039.3151%2013.8193%2038.2542V24.9209C13.8193%2023.86%2014.2408%2022.8426%2014.9909%2022.0924C15.7411%2021.3423%2016.7585%2020.9209%2017.8193%2020.9209H19.1527C19.1751%2019.791%2019.5558%2018.6975%2020.2399%2017.7981C20.924%2016.8986%2021.8761%2016.2397%2022.9589%2015.9164C24.0416%2015.593%2025.1992%2015.6219%2026.2644%2015.999C27.3297%2016.376%2028.2477%2017.0817%2028.886%2018.0142C29.4839%2018.8664%2029.8094%2019.8799%2029.8193%2020.9209H33.8193C34.173%2020.9209%2034.5121%2021.0613%2034.7621%2021.3114C35.0122%2021.5614%2035.1527%2021.9006%2035.1527%2022.2542V26.2542C36.2825%2026.2766%2037.376%2026.6573%2038.2754%2027.3414C39.1749%2028.0255%2039.8338%2028.9776%2040.1572%2030.0604C40.4805%2031.1432%2040.4516%2032.3007%2040.0745%2033.366C39.6975%2034.4312%2038.9918%2035.3492%2038.0593%2035.9875C37.2071%2036.5854%2036.1937%2036.9109%2035.1527%2036.9209V40.9209C35.1527%2041.2745%2035.0122%2041.6136%2034.7621%2041.8637C34.5121%2042.1137%2034.173%2042.2542%2033.8193%2042.2542ZM17.8193%2023.5875C17.4657%2023.5875%2017.1266%2023.728%2016.8765%2023.978C16.6265%2024.2281%2016.486%2024.5672%2016.486%2024.9209V38.2542C16.486%2038.6078%2016.6265%2038.9469%2016.8765%2039.197C17.1266%2039.447%2017.4657%2039.5875%2017.8193%2039.5875H32.486V35.3475C32.4849%2035.1337%2032.5351%2034.9228%2032.6326%2034.7325C32.7301%2034.5422%2032.8718%2034.3782%2033.046%2034.2542C33.2196%2034.1304%2033.4205%2034.05%2033.6316%2034.0198C33.8427%2033.9897%2034.058%2034.0106%2034.2593%2034.0809C34.6393%2034.2359%2035.0532%2034.2891%2035.46%2034.2353C35.8669%2034.1816%2036.2527%2034.0226%2036.5793%2033.7742C36.9045%2033.5759%2037.1834%2033.3103%2037.3973%2032.9952C37.6111%2032.6801%2037.7551%2032.3229%2037.8193%2031.9475C37.8708%2031.5689%2037.8402%2031.1837%2037.7298%2030.8179C37.6194%2030.4522%2037.4317%2030.1144%2037.1793%2029.8275C36.8381%2029.413%2036.3734%2029.1183%2035.8529%2028.9864C35.3325%2028.8545%2034.7835%2028.8923%2034.286%2029.0942C34.0846%2029.1644%2033.8694%2029.1854%2033.6582%2029.1552C33.4471%2029.125%2033.2463%2029.0447%2033.0727%2028.9209C32.8985%2028.7969%2032.7567%2028.6328%2032.6593%2028.4425C32.5618%2028.2522%2032.5115%2028.0413%2032.5127%2027.8275V23.5875H28.246C28.0269%2023.5999%2027.8081%2023.5581%2027.609%2023.4656C27.4099%2023.3732%2027.2368%2023.233%2027.1049%2023.0576C26.973%2022.8822%2026.8864%2022.6769%2026.8529%2022.46C26.8194%2022.2431%2026.8399%2022.0213%2026.9127%2021.8142C27.0677%2021.4342%2027.1209%2021.0204%2027.0671%2020.6135C27.0134%2020.2066%2026.8544%2019.8208%2026.606%2019.4942C26.4091%2019.1597%2026.1395%2018.8739%2025.8172%2018.6578C25.4948%2018.4417%2025.128%2018.3009%2024.7438%2018.2458C24.3597%2018.1908%2023.9681%2018.2228%2023.598%2018.3397C23.2279%2018.4565%2022.8889%2018.6552%2022.606%2018.9209C22.3433%2019.1814%2022.1377%2019.4938%2022.0023%2019.8381C21.8668%2020.1824%2021.8045%2020.5512%2021.8193%2020.9209C21.8224%2021.2267%2021.8812%2021.5294%2021.9927%2021.8142C22.0632%2022.0158%2022.0842%2022.2314%2022.054%2022.4429C22.0237%2022.6543%2021.9432%2022.8554%2021.819%2023.0292C21.6949%2023.203%2021.5308%2023.3444%2021.3406%2023.4416C21.1504%2023.5388%2020.9396%2023.5888%2020.726%2023.5875H17.8193Z%22%20fill%3D%22url(%23paint1_linear_2595_7337)%22%2F%3E%0A%3Cdefs%3E%0A%3ClinearGradient%20id%3D%22paint0_linear_2595_7337%22%20x1%3D%220.662695%22%20y1%3D%2218.4025%22%20x2%3D%2251.7209%22%20y2%3D%2244.2212%22%20gradientUnits%3D%22userSpaceOnUse%22%3E%0A%3Cstop%20stop-color%3D%22%23F7D14C%22%2F%3E%0A%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23A38108%22%2F%3E%0A%3C%2FlinearGradient%3E%0A%3ClinearGradient%20id%3D%22paint1_linear_2595_7337%22%20x1%3D%2213.7453%22%20y1%3D%2221.3695%22%20x2%3D%2240.3876%22%20y2%3D%2235.7015%22%20gradientUnits%3D%22userSpaceOnUse%22%3E%0A%3Cstop%20stop-color%3D%22%23F7D14C%22%2F%3E%0A%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23A38108%22%2F%3E%0A%3C%2FlinearGradient%3E%0A%3C%2Fdefs%3E%0A%3C%2Fsvg%3E%0A" alt="modules icon" class="modules-image-color-dark" data-v-30b323c7> <img src="data:image/svg+xml;charset=utf-8,%3Csvg%20width%3D%2253%22%20height%3D%2258%22%20viewBox%3D%220%200%2053%2058%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%0A%3Cg%20clip-path%3D%22url(%23clip0_2691_4389)%22%3E%0A%3Cpath%20d%3D%22M51.1519%2039.8821C51.154%2039.9844%2051.1527%2040.0863%2051.148%2040.1877C51.0782%2041.7091%2050.2566%2043.1165%2048.9325%2043.9357L29.0918%2056.2117C27.6504%2057.1035%2025.8212%2057.1564%2024.3387%2056.3439L3.85107%2045.1148C2.27157%2044.2491%201.14238%2042.6366%201.15291%2041.0494L1.15293%2041.0427L1.153%2018.552C1.15301%2018.5509%201.15302%2018.5499%201.15302%2018.5488C1.16485%2016.9324%202.02611%2015.4289%203.43319%2014.5869L3.43322%2014.587L3.44269%2014.5812L22.9844%202.59084C24.4169%201.73583%2026.2139%201.69824%2027.6729%202.49791L27.6729%202.49792L27.6784%202.50094L48.6303%2013.8121C48.6313%2013.8126%2048.6322%2013.8131%2048.6331%2013.8136C50.0797%2014.6078%2050.9898%2016.1132%2051.026%2017.7438L51.1517%2039.8672L51.1517%2039.8746L51.1519%2039.8821Z%22%20fill%3D%22white%22%20stroke%3D%22url(%23paint0_linear_2691_4389)%22%20stroke-width%3D%222%22%2F%3E%0A%3Cpath%20d%3D%22M33.8193%2042.2542H17.8193C16.7585%2042.2542%2015.7411%2041.8328%2014.9909%2041.0826C14.2408%2040.3325%2013.8193%2039.3151%2013.8193%2038.2542V24.9209C13.8193%2023.86%2014.2408%2022.8426%2014.9909%2022.0924C15.7411%2021.3423%2016.7585%2020.9209%2017.8193%2020.9209H19.1527C19.1751%2019.791%2019.5558%2018.6975%2020.2399%2017.7981C20.924%2016.8986%2021.8761%2016.2397%2022.9589%2015.9164C24.0416%2015.593%2025.1992%2015.6219%2026.2644%2015.999C27.3297%2016.376%2028.2477%2017.0817%2028.886%2018.0142C29.4839%2018.8664%2029.8094%2019.8799%2029.8193%2020.9209H33.8193C34.173%2020.9209%2034.5121%2021.0613%2034.7621%2021.3114C35.0122%2021.5614%2035.1527%2021.9006%2035.1527%2022.2542V26.2542C36.2825%2026.2766%2037.376%2026.6573%2038.2754%2027.3414C39.1749%2028.0255%2039.8338%2028.9776%2040.1572%2030.0604C40.4805%2031.1432%2040.4516%2032.3007%2040.0745%2033.366C39.6975%2034.4312%2038.9918%2035.3492%2038.0593%2035.9875C37.2071%2036.5854%2036.1937%2036.9109%2035.1527%2036.9209V36.9209V40.9209C35.1527%2041.2745%2035.0122%2041.6136%2034.7621%2041.8637C34.5121%2042.1137%2034.173%2042.2542%2033.8193%2042.2542ZM17.8193%2023.5875C17.4657%2023.5875%2017.1266%2023.728%2016.8765%2023.978C16.6265%2024.2281%2016.486%2024.5672%2016.486%2024.9209V38.2542C16.486%2038.6078%2016.6265%2038.9469%2016.8765%2039.197C17.1266%2039.447%2017.4657%2039.5875%2017.8193%2039.5875H32.486V35.3475C32.4849%2035.1337%2032.5351%2034.9228%2032.6326%2034.7325C32.7301%2034.5422%2032.8718%2034.3782%2033.046%2034.2542C33.2196%2034.1304%2033.4204%2034.05%2033.6316%2034.0198C33.8427%2033.9897%2034.058%2034.0106%2034.2593%2034.0809C34.6393%2034.2359%2035.0532%2034.2891%2035.46%2034.2353C35.8669%2034.1816%2036.2527%2034.0226%2036.5793%2033.7742C36.9045%2033.5759%2037.1834%2033.3103%2037.3973%2032.9952C37.6111%2032.6801%2037.7551%2032.3229%2037.8193%2031.9475C37.8708%2031.5689%2037.8402%2031.1837%2037.7298%2030.8179C37.6194%2030.4522%2037.4317%2030.1144%2037.1793%2029.8275C36.8381%2029.413%2036.3734%2029.1183%2035.8529%2028.9864C35.3325%2028.8545%2034.7835%2028.8923%2034.286%2029.0942C34.0846%2029.1644%2033.8694%2029.1854%2033.6582%2029.1552C33.4471%2029.125%2033.2463%2029.0447%2033.0727%2028.9209C32.8985%2028.7969%2032.7567%2028.6328%2032.6593%2028.4425C32.5618%2028.2522%2032.5115%2028.0413%2032.5127%2027.8275V23.5875H28.246C28.0269%2023.5999%2027.8081%2023.5581%2027.609%2023.4656C27.4099%2023.3732%2027.2368%2023.233%2027.1049%2023.0576C26.973%2022.8822%2026.8864%2022.6769%2026.8529%2022.46C26.8194%2022.2431%2026.8399%2022.0213%2026.9127%2021.8142C27.0677%2021.4342%2027.1209%2021.0204%2027.0671%2020.6135C27.0134%2020.2066%2026.8544%2019.8208%2026.606%2019.4942C26.4091%2019.1597%2026.1395%2018.8739%2025.8172%2018.6578C25.4948%2018.4417%2025.128%2018.3009%2024.7438%2018.2458C24.3597%2018.1908%2023.9681%2018.2228%2023.598%2018.3397C23.2279%2018.4565%2022.8889%2018.6552%2022.606%2018.9209C22.3433%2019.1814%2022.1377%2019.4938%2022.0023%2019.8381C21.8668%2020.1824%2021.8045%2020.5512%2021.8193%2020.9209C21.8224%2021.2267%2021.8812%2021.5294%2021.9927%2021.8142C22.0632%2022.0158%2022.0842%2022.2314%2022.054%2022.4429C22.0237%2022.6543%2021.9432%2022.8554%2021.819%2023.0292C21.6949%2023.203%2021.5308%2023.3444%2021.3406%2023.4416C21.1504%2023.5388%2020.9396%2023.5888%2020.726%2023.5875H17.8193Z%22%20fill%3D%22url(%23paint1_linear_2691_4389)%22%2F%3E%0A%3C%2Fg%3E%0A%3Cdefs%3E%0A%3ClinearGradient%20id%3D%22paint0_linear_2691_4389%22%20x1%3D%220.662695%22%20y1%3D%2218.4025%22%20x2%3D%2251.7209%22%20y2%3D%2244.2212%22%20gradientUnits%3D%22userSpaceOnUse%22%3E%0A%3Cstop%20stop-color%3D%22%23D4D4D8%22%2F%3E%0A%3Cstop%20offset%3D%221%22%20stop-color%3D%22%2371717A%22%2F%3E%0A%3C%2FlinearGradient%3E%0A%3ClinearGradient%20id%3D%22paint1_linear_2691_4389%22%20x1%3D%2213.7453%22%20y1%3D%2221.3695%22%20x2%3D%2240.3876%22%20y2%3D%2235.7015%22%20gradientUnits%3D%22userSpaceOnUse%22%3E%0A%3Cstop%20stop-color%3D%22%23D4D4D8%22%2F%3E%0A%3Cstop%20offset%3D%221%22%20stop-color%3D%22%2371717A%22%2F%3E%0A%3C%2FlinearGradient%3E%0A%3CclipPath%20id%3D%22clip0_2691_4389%22%3E%0A%3Crect%20width%3D%2252%22%20height%3D%2257%22%20fill%3D%22white%22%20transform%3D%22translate(0.152832%200.920898)%22%2F%3E%0A%3C%2FclipPath%3E%0A%3C%2Fdefs%3E%0A%3C%2Fsvg%3E%0A" alt="modules icon" class="modules-image-light" data-v-30b323c7> <img src="data:image/svg+xml;charset=utf-8,%3Csvg%20width%3D%2253%22%20height%3D%2258%22%20viewBox%3D%220%200%2053%2058%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%0A%3Cpath%20d%3D%22M3.43319%2014.5869L3.43322%2014.587L3.44269%2014.5812L22.9844%202.59084C24.4246%201.73116%2026.2124%201.69742%2027.6729%202.49791L27.6729%202.49792L27.6784%202.50094L48.6303%2013.8121C48.6313%2013.8126%2048.6322%2013.8131%2048.6331%2013.8137C50.0812%2014.6086%2050.9896%2016.1043%2051.026%2017.7437L51.1517%2039.8672L51.1517%2039.8746L51.1519%2039.8821C51.1856%2041.5203%2050.346%2043.0611%2048.9325%2043.9357L29.0918%2056.2117C27.6424%2057.1085%2025.8227%2057.1572%2024.3387%2056.3439L3.85107%2045.1148C2.26984%2044.2481%201.14232%2042.646%201.15293%2041.0494V41.0427L1.153%2018.552C1.15301%2018.5509%201.15302%2018.5499%201.15302%2018.5488C1.16485%2016.9324%202.02611%2015.4289%203.43319%2014.5869Z%22%20fill%3D%22%2318181B%22%20stroke%3D%22url(%23paint0_linear_2595_7175)%22%20stroke-width%3D%222%22%2F%3E%0A%3Cpath%20d%3D%22M33.8193%2042.2542H17.8193C16.7585%2042.2542%2015.7411%2041.8328%2014.9909%2041.0826C14.2408%2040.3325%2013.8193%2039.3151%2013.8193%2038.2542V24.9209C13.8193%2023.86%2014.2408%2022.8426%2014.9909%2022.0924C15.7411%2021.3423%2016.7585%2020.9209%2017.8193%2020.9209H19.1527C19.1751%2019.791%2019.5558%2018.6975%2020.2399%2017.7981C20.924%2016.8986%2021.8761%2016.2397%2022.9589%2015.9164C24.0416%2015.593%2025.1992%2015.6219%2026.2644%2015.999C27.3297%2016.376%2028.2477%2017.0817%2028.886%2018.0142C29.4839%2018.8664%2029.8094%2019.8799%2029.8193%2020.9209H33.8193C34.173%2020.9209%2034.5121%2021.0613%2034.7621%2021.3114C35.0122%2021.5614%2035.1527%2021.9006%2035.1527%2022.2542V26.2542C36.2825%2026.2766%2037.376%2026.6573%2038.2754%2027.3414C39.1749%2028.0255%2039.8338%2028.9776%2040.1572%2030.0604C40.4805%2031.1432%2040.4516%2032.3007%2040.0745%2033.366C39.6975%2034.4312%2038.9918%2035.3492%2038.0593%2035.9875C37.2071%2036.5854%2036.1937%2036.9109%2035.1527%2036.9209V40.9209C35.1527%2041.2745%2035.0122%2041.6136%2034.7621%2041.8637C34.5121%2042.1137%2034.173%2042.2542%2033.8193%2042.2542ZM17.8193%2023.5875C17.4657%2023.5875%2017.1266%2023.728%2016.8765%2023.978C16.6265%2024.2281%2016.486%2024.5672%2016.486%2024.9209V38.2542C16.486%2038.6078%2016.6265%2038.9469%2016.8765%2039.197C17.1266%2039.447%2017.4657%2039.5875%2017.8193%2039.5875H32.486V35.3475C32.4849%2035.1337%2032.5351%2034.9228%2032.6326%2034.7325C32.7301%2034.5422%2032.8718%2034.3782%2033.046%2034.2542C33.2196%2034.1304%2033.4205%2034.05%2033.6316%2034.0198C33.8427%2033.9897%2034.058%2034.0106%2034.2593%2034.0809C34.6393%2034.2359%2035.0532%2034.2891%2035.46%2034.2353C35.8669%2034.1816%2036.2527%2034.0226%2036.5793%2033.7742C36.9045%2033.5759%2037.1834%2033.3103%2037.3973%2032.9952C37.6111%2032.6801%2037.7551%2032.3229%2037.8193%2031.9475C37.8708%2031.5689%2037.8402%2031.1837%2037.7298%2030.8179C37.6194%2030.4522%2037.4317%2030.1144%2037.1793%2029.8275C36.8381%2029.413%2036.3734%2029.1183%2035.8529%2028.9864C35.3325%2028.8545%2034.7835%2028.8923%2034.286%2029.0942C34.0846%2029.1644%2033.8694%2029.1854%2033.6582%2029.1552C33.4471%2029.125%2033.2463%2029.0447%2033.0727%2028.9209C32.8985%2028.7969%2032.7567%2028.6328%2032.6593%2028.4425C32.5618%2028.2522%2032.5115%2028.0413%2032.5127%2027.8275V23.5875H28.246C28.0269%2023.5999%2027.8081%2023.5581%2027.609%2023.4656C27.4099%2023.3732%2027.2368%2023.233%2027.1049%2023.0576C26.973%2022.8822%2026.8864%2022.6769%2026.8529%2022.46C26.8194%2022.2431%2026.8399%2022.0213%2026.9127%2021.8142C27.0677%2021.4342%2027.1209%2021.0204%2027.0671%2020.6135C27.0134%2020.2066%2026.8544%2019.8208%2026.606%2019.4942C26.4091%2019.1597%2026.1395%2018.8739%2025.8172%2018.6578C25.4948%2018.4417%2025.128%2018.3009%2024.7438%2018.2458C24.3597%2018.1908%2023.9681%2018.2228%2023.598%2018.3397C23.2279%2018.4565%2022.8889%2018.6552%2022.606%2018.9209C22.3433%2019.1814%2022.1377%2019.4938%2022.0023%2019.8381C21.8668%2020.1824%2021.8045%2020.5512%2021.8193%2020.9209C21.8224%2021.2267%2021.8812%2021.5294%2021.9927%2021.8142C22.0632%2022.0158%2022.0842%2022.2314%2022.054%2022.4429C22.0237%2022.6543%2021.9432%2022.8554%2021.819%2023.0292C21.6949%2023.203%2021.5308%2023.3444%2021.3406%2023.4416C21.1504%2023.5388%2020.9396%2023.5888%2020.726%2023.5875H17.8193Z%22%20fill%3D%22url(%23paint1_linear_2595_7175)%22%2F%3E%0A%3Cdefs%3E%0A%3ClinearGradient%20id%3D%22paint0_linear_2595_7175%22%20x1%3D%220.662695%22%20y1%3D%2218.4025%22%20x2%3D%2251.7209%22%20y2%3D%2244.2212%22%20gradientUnits%3D%22userSpaceOnUse%22%3E%0A%3Cstop%20stop-color%3D%22white%22%2F%3E%0A%3Cstop%20offset%3D%221%22%20stop-color%3D%22%2371717A%22%2F%3E%0A%3C%2FlinearGradient%3E%0A%3ClinearGradient%20id%3D%22paint1_linear_2595_7175%22%20x1%3D%2213.7453%22%20y1%3D%2221.3695%22%20x2%3D%2240.3876%22%20y2%3D%2235.7015%22%20gradientUnits%3D%22userSpaceOnUse%22%3E%0A%3Cstop%20stop-color%3D%22white%22%2F%3E%0A%3Cstop%20offset%3D%221%22%20stop-color%3D%22%2371717A%22%2F%3E%0A%3C%2FlinearGradient%3E%0A%3C%2Fdefs%3E%0A%3C%2Fsvg%3E%0A" alt="modules icon" class="modules-image-dark" data-v-30b323c7> <div class="dark:text-white flex flex-col space-y text-black" data-v-30b323c7><h3 class="font-semibold text-xl" data-v-30b323c7>Modules</h3><p class="dark:text-gray-300 text-gray-700" data-v-30b323c7>Discover our list of modules to supercharge your Nuxt project. Created by the Nuxt team and community.</p></div></a></div><div class="border border-gray-200 col-span-2 dark:border-transparent dark:text-white documentation-container hover:border-transparent items-center justify-center lg:col-span-4 lg:order-none order-last relative rounded-xl row-span-2 text-black" data-v-30b323c7><div class="gradient-border gradient-border-documentation gradient-border-square" data-v-30b323c7></div><a href="https://nuxt.com/docs" target="_blank" class="bg-white dark:bg-gray-900 flex gap-y-4 items-center justify-center lg:flex-col rounded-xl" data-v-30b323c7><div class="flex flex-col gap-y-2 items-center justify-center lg:flex-col lg:py-7 px-5 py-6 rounded-xl sm:flex-row" data-v-30b323c7><div class="dark:text-white flex flex-col space-y text-black" data-v-30b323c7><h3 class="font-semibold text-xl" data-v-30b323c7>Documentation</h3><p class="dark:text-gray-300 text-gray-700" data-v-30b323c7>We highly recommend you take a look at the Nuxt documentation to level up.</p></div><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20width%3D%22342%22%20height%3D%22165%22%20viewBox%3D%220%200%20342%20165%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%0A%3Cg%20clip-path%3D%22url(%23clip0_2687_3947)%22%3E%0A%3Cpath%20d%3D%22M0.152832%20131.851H154.28%22%20stroke%3D%22%23E4E4E7%22%2F%3E%0A%3Cpath%20d%3D%22M215.399%20107.359H349.153%22%20stroke%3D%22%23E4E4E7%22%2F%3E%0A%3Cpath%20d%3D%22M0.152832%2077.2178L116.191%2077.2178%22%20stroke%3D%22%23E4E4E7%22%2F%3E%0A%3Cpath%20d%3D%22M36.1528%20106.921L152.191%20106.921%22%20stroke%3D%22%23E4E4E7%22%2F%3E%0A%3Cpath%20d%3D%22M202.153%2042.9209L317.305%2042.9209%22%20stroke%3D%22%23E4E4E7%22%2F%3E%0A%3Cpath%20d%3D%22M218.153%2076.9209L345.305%2076.9209%22%20stroke%3D%22%23E4E4E7%22%2F%3E%0A%3Cpath%20d%3D%22M285.947%208.45605V166.979%22%20stroke%3D%22%23E4E4E7%22%2F%3E%0A%3Cpath%20d%3D%22M252.602%2016.8311V107.36%22%20stroke%3D%22%23E4E4E7%22%2F%3E%0A%3Cpath%20d%3D%22M171.153%2016.9209V107.45%22%20stroke%3D%22%23E4E4E7%22%2F%3E%0A%3Cpath%20d%3D%22M218.153%2016.9209V43.4501%22%20stroke%3D%22%23E4E4E7%22%2F%3E%0A%3Cpath%20d%3D%22M122.153%2016.9211L327.45%2016.9209%22%20stroke%3D%22%23E4E4E7%22%2F%3E%0A%3Cpath%20d%3D%22M1.92432%2043.3086H148.163%22%20stroke%3D%22%23E4E4E7%22%2F%3E%0A%3Cpath%20d%3D%22M122.392%2016.4209V55.3659%22%20stroke%3D%22%23E4E4E7%22%2F%3E%0A%3Cpath%20d%3D%22M36.084%200.920898L36.084%20176.921%22%20stroke%3D%22%23E4E4E7%22%2F%3E%0A%3Cpath%20d%3D%22M75.4448%2043.249V175.152%22%20stroke%3D%22%23E4E4E7%22%2F%3E%0A%3Ccircle%20opacity%3D%220.7%22%20cx%3D%2275.4448%22%20cy%3D%2277.2178%22%20r%3D%223.5%22%20fill%3D%22%2300DC82%22%2F%3E%0A%3Ccircle%20opacity%3D%220.7%22%20cx%3D%2236.1528%22%20cy%3D%22131.85%22%20r%3D%223.5%22%20fill%3D%22%2300DC82%22%2F%3E%0A%3Ccircle%20opacity%3D%220.7%22%20cx%3D%22285.947%22%20cy%3D%2242.9209%22%20r%3D%223.5%22%20fill%3D%22%2300DC82%22%2F%3E%0A%3Ccircle%20opacity%3D%220.7%22%20cx%3D%22252.602%22%20cy%3D%22107.359%22%20r%3D%223.5%22%20fill%3D%22%2300DC82%22%2F%3E%0A%3Cg%20filter%3D%22url(%23filter0_d_2687_3947)%22%3E%0A%3Cpath%20d%3D%22M122.846%2050.7109L163.067%2026.0929C166.656%2023.9507%20171.117%2023.8611%20174.77%2025.8579L217.894%2049.0819C221.524%2051.0665%20223.807%2054.8133%20223.892%2058.9246L224.15%20104.352C224.235%20108.448%20222.13%20112.287%20218.609%20114.46L177.783%20139.658C174.174%20141.886%20169.638%20142.011%20165.931%20139.984L123.774%20116.935C120.045%20114.896%20117.125%20111.001%20117.153%20106.776L117.153%2060.5974C117.18%2056.5529%20119.338%2052.8048%20122.846%2050.7109Z%22%20fill%3D%22white%22%2F%3E%0A%3Cpath%20d%3D%22M222.151%20104.393C222.22%20107.764%20220.487%20110.944%20217.571%20112.75C217.567%20112.753%20217.563%20112.755%20217.559%20112.758L176.733%20137.956C173.748%20139.798%20169.96%20139.907%20166.89%20138.229L124.733%20115.18C121.469%20113.395%20119.131%20110.069%20119.153%20106.79L119.153%20106.776L119.153%2060.6107C119.153%2060.6086%20119.153%2060.6065%20119.153%2060.6044C119.178%2057.2703%20120.958%2054.1669%20123.871%2052.4282L123.881%2052.4225L123.89%2052.4167L164.101%2027.8047C164.101%2027.8047%20164.101%2027.8047%20164.101%2027.8047C164.106%2027.8022%20164.11%2027.7997%20164.114%2027.7972C167.078%2026.0385%20170.793%2025.9632%20173.81%2027.6128L173.81%2027.6128L173.821%2027.6188L216.934%2050.8367C216.936%2050.8377%20216.938%2050.8387%20216.94%2050.8397C219.935%2052.4801%20221.817%2055.5878%20221.892%2058.9515L222.15%20104.363L222.15%20104.378L222.151%20104.393Z%22%20stroke%3D%22url(%23paint0_linear_2687_3947)%22%20stroke-width%3D%224%22%2F%3E%0A%3C%2Fg%3E%0A%3Cpath%20d%3D%22M192.349%2096.9158L190.63%2090.5186L183.778%2064.9088C183.55%2064.0605%20182.994%2063.3375%20182.233%2062.8988C181.472%2062.4601%20180.568%2062.3416%20179.72%2062.5693L173.323%2064.2877L173.116%2064.3498C172.807%2063.945%20172.409%2063.6168%20171.953%2063.3906C171.497%2063.1644%20170.995%2063.0463%20170.486%2063.0455H163.861C163.279%2063.0471%20162.707%2063.2043%20162.205%2063.501C161.703%2063.2043%20161.132%2063.0471%20160.549%2063.0455H153.924C153.045%2063.0455%20152.203%2063.3945%20151.582%2064.0157C150.96%2064.6369%20150.611%2065.4795%20150.611%2066.358V99.483C150.611%20100.362%20150.96%20101.204%20151.582%20101.825C152.203%20102.447%20153.045%20102.796%20153.924%20102.796H160.549C161.132%20102.794%20161.703%20102.637%20162.205%20102.34C162.707%20102.637%20163.279%20102.794%20163.861%20102.796H170.486C171.365%20102.796%20172.207%20102.447%20172.829%20101.825C173.45%20101.204%20173.799%20100.362%20173.799%2099.483V78.8627L177.836%2093.9346L179.554%20100.332C179.742%20101.039%20180.158%20101.665%20180.739%20102.11C181.32%20102.556%20182.031%20102.797%20182.763%20102.796C183.049%20102.791%20183.334%20102.756%20183.612%20102.692L190.009%20100.974C190.43%20100.861%20190.824%20100.665%20191.169%20100.399C191.514%20100.132%20191.802%2099.7997%20192.018%2099.4209C192.238%2099.047%20192.381%2098.6325%20192.438%2098.2021C192.495%2097.7717%20192.465%2097.3342%20192.349%2096.9158V96.9158ZM176.325%2075.4881L182.722%2073.7697L187.007%2089.7732L180.61%2091.4916L176.325%2075.4881ZM180.569%2065.7783L181.873%2070.5607L175.476%2072.2791L174.171%2067.4967L180.569%2065.7783ZM170.486%2066.358V91.2018H163.861V66.358H170.486ZM160.549%2066.358V71.3268H153.924V66.358H160.549ZM153.924%2099.483V74.6393H160.549V99.483H153.924ZM170.486%2099.483H163.861V94.5143H170.486V99.483ZM189.161%2097.7646L182.763%2099.483L181.459%2094.6799L187.877%2092.9615L189.161%2097.7646V97.7646Z%22%20fill%3D%22url(%23paint1_linear_2687_3947)%22%2F%3E%0A%3Crect%20x%3D%222.15283%22%20y%3D%22-3.0791%22%20width%3D%22327%22%20height%3D%2223%22%20fill%3D%22url(%23paint2_linear_2687_3947)%22%2F%3E%0A%3Crect%20width%3D%22327%22%20height%3D%2225%22%20transform%3D%22matrix(1%200%200%20-1%202.15283%20166.921)%22%20fill%3D%22url(%23paint3_linear_2687_3947)%22%2F%3E%0A%3Crect%20width%3D%22327%22%20height%3D%2225%22%20transform%3D%22matrix(0%201%201%200%200.152832%20-17.0791)%22%20fill%3D%22url(%23paint4_linear_2687_3947)%22%2F%3E%0A%3Crect%20x%3D%22342.153%22%20y%3D%22-17.0791%22%20width%3D%22327%22%20height%3D%2225%22%20transform%3D%22rotate(90%20342.153%20-17.0791)%22%20fill%3D%22url(%23paint5_linear_2687_3947)%22%2F%3E%0A%3C%2Fg%3E%0A%3Cdefs%3E%0A%3Cfilter%20id%3D%22filter0_d_2687_3947%22%20x%3D%2286.1528%22%20y%3D%22-6.5791%22%20width%3D%22169%22%20height%3D%22179%22%20filterUnits%3D%22userSpaceOnUse%22%20color-interpolation-filters%3D%22sRGB%22%3E%0A%3CfeFlood%20flood-opacity%3D%220%22%20result%3D%22BackgroundImageFix%22%2F%3E%0A%3CfeColorMatrix%20in%3D%22SourceAlpha%22%20type%3D%22matrix%22%20values%3D%220%200%200%200%200%200%200%200%200%200%200%200%200%200%200%200%200%200%20127%200%22%20result%3D%22hardAlpha%22%2F%3E%0A%3CfeOffset%2F%3E%0A%3CfeGaussianBlur%20stdDeviation%3D%2215.5%22%2F%3E%0A%3CfeComposite%20in2%3D%22hardAlpha%22%20operator%3D%22out%22%2F%3E%0A%3CfeColorMatrix%20type%3D%22matrix%22%20values%3D%220%200%200%200%201%200%200%200%200%201%200%200%200%200%201%200%200%200%200.07%200%22%2F%3E%0A%3CfeBlend%20mode%3D%22normal%22%20in2%3D%22BackgroundImageFix%22%20result%3D%22effect1_dropShadow_2687_3947%22%2F%3E%0A%3CfeBlend%20mode%3D%22normal%22%20in%3D%22SourceGraphic%22%20in2%3D%22effect1_dropShadow_2687_3947%22%20result%3D%22shape%22%2F%3E%0A%3C%2Ffilter%3E%0A%3ClinearGradient%20id%3D%22paint0_linear_2687_3947%22%20x1%3D%22118.202%22%20y1%3D%2260.3042%22%20x2%3D%22223.159%22%20y2%3D%22113.509%22%20gradientUnits%3D%22userSpaceOnUse%22%3E%0A%3Cstop%20stop-color%3D%22%2300DC82%22%2F%3E%0A%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23003F25%22%2F%3E%0A%3C%2FlinearGradient%3E%0A%3ClinearGradient%20id%3D%22paint1_linear_2687_3947%22%20x1%3D%22150.495%22%20y1%3D%2271.0767%22%20x2%3D%22191.769%22%20y2%3D%2294.1139%22%20gradientUnits%3D%22userSpaceOnUse%22%3E%0A%3Cstop%20stop-color%3D%22%2300DC82%22%2F%3E%0A%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23003F25%22%2F%3E%0A%3C%2FlinearGradient%3E%0A%3ClinearGradient%20id%3D%22paint2_linear_2687_3947%22%20x1%3D%22165.653%22%20y1%3D%22-3.0791%22%20x2%3D%22166.153%22%20y2%3D%2219.9209%22%20gradientUnits%3D%22userSpaceOnUse%22%3E%0A%3Cstop%20stop-color%3D%22white%22%2F%3E%0A%3Cstop%20offset%3D%221%22%20stop-color%3D%22white%22%20stop-opacity%3D%220%22%2F%3E%0A%3C%2FlinearGradient%3E%0A%3ClinearGradient%20id%3D%22paint3_linear_2687_3947%22%20x1%3D%22163.5%22%20y1%3D%22-2.30278e-07%22%20x2%3D%22164.091%22%20y2%3D%2224.9979%22%20gradientUnits%3D%22userSpaceOnUse%22%3E%0A%3Cstop%20stop-color%3D%22white%22%2F%3E%0A%3Cstop%20offset%3D%221%22%20stop-color%3D%22white%22%20stop-opacity%3D%220%22%2F%3E%0A%3C%2FlinearGradient%3E%0A%3ClinearGradient%20id%3D%22paint4_linear_2687_3947%22%20x1%3D%22163.5%22%20y1%3D%22-2.30278e-07%22%20x2%3D%22164.091%22%20y2%3D%2224.9979%22%20gradientUnits%3D%22userSpaceOnUse%22%3E%0A%3Cstop%20stop-color%3D%22white%22%2F%3E%0A%3Cstop%20offset%3D%221%22%20stop-color%3D%22white%22%20stop-opacity%3D%220%22%2F%3E%0A%3C%2FlinearGradient%3E%0A%3ClinearGradient%20id%3D%22paint5_linear_2687_3947%22%20x1%3D%22505.653%22%20y1%3D%22-17.0791%22%20x2%3D%22506.244%22%20y2%3D%227.91876%22%20gradientUnits%3D%22userSpaceOnUse%22%3E%0A%3Cstop%20stop-color%3D%22white%22%2F%3E%0A%3Cstop%20offset%3D%221%22%20stop-color%3D%22white%22%20stop-opacity%3D%220%22%2F%3E%0A%3C%2FlinearGradient%3E%0A%3CclipPath%20id%3D%22clip0_2687_3947%22%3E%0A%3Crect%20width%3D%22341%22%20height%3D%22164%22%20fill%3D%22white%22%20transform%3D%22translate(0.152832%200.920898)%22%2F%3E%0A%3C%2FclipPath%3E%0A%3C%2Fdefs%3E%0A%3C%2Fsvg%3E%0A" alt="documentation icon" class="documentation-image-color-light h-32 sm:h-34" data-v-30b323c7> <img src="data:image/svg+xml;charset=utf-8,%3Csvg%20width%3D%22342%22%20height%3D%22165%22%20viewBox%3D%220%200%20342%20165%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%0A%3Cg%20clip-path%3D%22url(%23clip0_2595_7273)%22%3E%0A%3Cpath%20d%3D%22M0.152832%20131.851H154.28%22%20stroke%3D%22%2327272A%22%2F%3E%0A%3Cpath%20d%3D%22M215.399%20107.359H349.153%22%20stroke%3D%22%2327272A%22%2F%3E%0A%3Cpath%20d%3D%22M0.152832%2077.2178L116.191%2077.2178%22%20stroke%3D%22%2327272A%22%2F%3E%0A%3Cpath%20d%3D%22M36.1528%20106.921L152.191%20106.921%22%20stroke%3D%22%2327272A%22%2F%3E%0A%3Cpath%20d%3D%22M202.153%2042.9209L317.305%2042.9209%22%20stroke%3D%22%2327272A%22%2F%3E%0A%3Cpath%20d%3D%22M218.153%2076.9209L345.305%2076.9209%22%20stroke%3D%22%2327272A%22%2F%3E%0A%3Cpath%20d%3D%22M285.947%208.45605V166.979%22%20stroke%3D%22%2327272A%22%2F%3E%0A%3Cpath%20d%3D%22M252.602%2016.8311V107.36%22%20stroke%3D%22%2327272A%22%2F%3E%0A%3Cpath%20d%3D%22M171.153%2016.9209V107.45%22%20stroke%3D%22%2327272A%22%2F%3E%0A%3Cpath%20d%3D%22M218.153%2016.9209V43.4501%22%20stroke%3D%22%2327272A%22%2F%3E%0A%3Cpath%20d%3D%22M122.153%2016.9211L327.45%2016.9209%22%20stroke%3D%22%2327272A%22%2F%3E%0A%3Cpath%20d%3D%22M1.92432%2043.3086H148.163%22%20stroke%3D%22%2327272A%22%2F%3E%0A%3Cpath%20d%3D%22M122.392%2016.4209V55.3659%22%20stroke%3D%22%2327272A%22%2F%3E%0A%3Cpath%20d%3D%22M36.084%200.920898L36.084%20176.921%22%20stroke%3D%22%2327272A%22%2F%3E%0A%3Cpath%20d%3D%22M75.4448%2043.249V175.152%22%20stroke%3D%22%2327272A%22%2F%3E%0A%3Ccircle%20opacity%3D%220.14%22%20cx%3D%2275.4448%22%20cy%3D%2277.2178%22%20r%3D%223.5%22%20fill%3D%22%2300DC82%22%2F%3E%0A%3Ccircle%20opacity%3D%220.14%22%20cx%3D%2236.1528%22%20cy%3D%22131.85%22%20r%3D%223.5%22%20fill%3D%22%2300DC82%22%2F%3E%0A%3Ccircle%20opacity%3D%220.14%22%20cx%3D%22285.947%22%20cy%3D%2242.9209%22%20r%3D%223.5%22%20fill%3D%22%2300DC82%22%2F%3E%0A%3Ccircle%20opacity%3D%220.14%22%20cx%3D%22252.602%22%20cy%3D%22107.359%22%20r%3D%223.5%22%20fill%3D%22%2300DC82%22%2F%3E%0A%3Cg%20filter%3D%22url(%23filter0_d_2595_7273)%22%3E%0A%3Cpath%20d%3D%22M122.846%2050.7109L163.067%2026.0929C166.656%2023.9507%20171.117%2023.8611%20174.77%2025.8579L217.894%2049.0819C221.524%2051.0665%20223.807%2054.8133%20223.892%2058.9246L224.15%20104.352C224.235%20108.448%20222.13%20112.287%20218.609%20114.46L177.783%20139.658C174.174%20141.886%20169.638%20142.011%20165.931%20139.984L123.774%20116.935C120.045%20114.896%20117.125%20111.001%20117.153%20106.776L117.153%2060.5974C117.18%2056.5529%20119.338%2052.8048%20122.846%2050.7109Z%22%20fill%3D%22%2318181B%22%2F%3E%0A%3Cpath%20d%3D%22M123.871%2052.4282L123.881%2052.4225L123.89%2052.4167L164.101%2027.8047C167.083%2026.0291%20170.786%2025.9592%20173.81%2027.6128L173.81%2027.6128L173.821%2027.6188L216.934%2050.8367C216.936%2050.8376%20216.938%2050.8386%20216.939%2050.8395C219.938%2052.4814%20221.817%2055.5694%20221.892%2058.9515L222.15%20104.363L222.15%20104.378L222.151%20104.393C222.221%20107.772%20220.485%20110.952%20217.559%20112.758L176.733%20137.956C173.732%20139.808%20169.963%20139.909%20166.89%20138.229L124.733%20115.18C121.465%20113.393%20119.131%20110.089%20119.153%20106.79L119.153%20106.776L119.153%2060.6107C119.153%2060.6086%20119.153%2060.6065%20119.153%2060.6044C119.178%2057.2703%20120.958%2054.1669%20123.871%2052.4282Z%22%20stroke%3D%22url(%23paint0_linear_2595_7273)%22%20stroke-width%3D%224%22%2F%3E%0A%3C%2Fg%3E%0A%3Cpath%20d%3D%22M192.349%2096.9158L190.63%2090.5186L183.778%2064.9088C183.55%2064.0605%20182.994%2063.3375%20182.233%2062.8988C181.472%2062.4601%20180.568%2062.3416%20179.72%2062.5693L173.323%2064.2877L173.116%2064.3498C172.807%2063.945%20172.409%2063.6168%20171.953%2063.3906C171.497%2063.1644%20170.995%2063.0463%20170.486%2063.0455H163.861C163.279%2063.0471%20162.707%2063.2043%20162.205%2063.501C161.703%2063.2043%20161.132%2063.0471%20160.549%2063.0455H153.924C153.045%2063.0455%20152.203%2063.3945%20151.582%2064.0157C150.96%2064.6369%20150.611%2065.4795%20150.611%2066.358V99.483C150.611%20100.362%20150.96%20101.204%20151.582%20101.825C152.203%20102.447%20153.045%20102.796%20153.924%20102.796H160.549C161.132%20102.794%20161.703%20102.637%20162.205%20102.34C162.707%20102.637%20163.279%20102.794%20163.861%20102.796H170.486C171.365%20102.796%20172.207%20102.447%20172.829%20101.825C173.45%20101.204%20173.799%20100.362%20173.799%2099.483V78.8627L177.836%2093.9346L179.554%20100.332C179.742%20101.039%20180.158%20101.665%20180.739%20102.11C181.32%20102.556%20182.031%20102.797%20182.763%20102.796C183.049%20102.791%20183.334%20102.756%20183.612%20102.692L190.009%20100.974C190.43%20100.861%20190.824%20100.665%20191.169%20100.399C191.514%20100.132%20191.802%2099.7998%20192.018%2099.4209C192.238%2099.047%20192.381%2098.6325%20192.438%2098.2021C192.495%2097.7717%20192.465%2097.3342%20192.349%2096.9158ZM176.325%2075.4881L182.722%2073.7697L187.007%2089.7732L180.61%2091.4916L176.325%2075.4881ZM180.569%2065.7783L181.873%2070.5607L175.476%2072.2791L174.171%2067.4967L180.569%2065.7783ZM170.486%2066.358V91.2018H163.861V66.358H170.486ZM160.549%2066.358V71.3268H153.924V66.358H160.549ZM153.924%2099.483V74.6393H160.549V99.483H153.924ZM170.486%2099.483H163.861V94.5143H170.486V99.483ZM189.161%2097.7646L182.763%2099.483L181.459%2094.6799L187.877%2092.9615L189.161%2097.7646Z%22%20fill%3D%22url(%23paint1_linear_2595_7273)%22%2F%3E%0A%3Crect%20x%3D%222.15283%22%20y%3D%22-3.0791%22%20width%3D%22327%22%20height%3D%2223%22%20fill%3D%22url(%23paint2_linear_2595_7273)%22%2F%3E%0A%3Crect%20width%3D%22327%22%20height%3D%2225%22%20transform%3D%22matrix(1%200%200%20-1%202.15283%20166.921)%22%20fill%3D%22url(%23paint3_linear_2595_7273)%22%2F%3E%0A%3Crect%20width%3D%22327%22%20height%3D%2225%22%20transform%3D%22matrix(0%201%201%200%200.152832%20-17.0791)%22%20fill%3D%22url(%23paint4_linear_2595_7273)%22%2F%3E%0A%3Crect%20x%3D%22342.153%22%20y%3D%22-17.0791%22%20width%3D%22327%22%20height%3D%2225%22%20transform%3D%22rotate(90%20342.153%20-17.0791)%22%20fill%3D%22url(%23paint5_linear_2595_7273)%22%2F%3E%0A%3C%2Fg%3E%0A%3Cdefs%3E%0A%3Cfilter%20id%3D%22filter0_d_2595_7273%22%20x%3D%2286.1528%22%20y%3D%22-6.5791%22%20width%3D%22169%22%20height%3D%22179%22%20filterUnits%3D%22userSpaceOnUse%22%20color-interpolation-filters%3D%22sRGB%22%3E%0A%3CfeFlood%20flood-opacity%3D%220%22%20result%3D%22BackgroundImageFix%22%2F%3E%0A%3CfeColorMatrix%20in%3D%22SourceAlpha%22%20type%3D%22matrix%22%20values%3D%220%200%200%200%200%200%200%200%200%200%200%200%200%200%200%200%200%200%20127%200%22%20result%3D%22hardAlpha%22%2F%3E%0A%3CfeOffset%2F%3E%0A%3CfeGaussianBlur%20stdDeviation%3D%2215.5%22%2F%3E%0A%3CfeComposite%20in2%3D%22hardAlpha%22%20operator%3D%22out%22%2F%3E%0A%3CfeColorMatrix%20type%3D%22matrix%22%20values%3D%220%200%200%200%201%200%200%200%200%201%200%200%200%200%201%200%200%200%200.07%200%22%2F%3E%0A%3CfeBlend%20mode%3D%22normal%22%20in2%3D%22BackgroundImageFix%22%20result%3D%22effect1_dropShadow_2595_7273%22%2F%3E%0A%3CfeBlend%20mode%3D%22normal%22%20in%3D%22SourceGraphic%22%20in2%3D%22effect1_dropShadow_2595_7273%22%20result%3D%22shape%22%2F%3E%0A%3C%2Ffilter%3E%0A%3ClinearGradient%20id%3D%22paint0_linear_2595_7273%22%20x1%3D%22118.202%22%20y1%3D%2260.3042%22%20x2%3D%22223.159%22%20y2%3D%22113.509%22%20gradientUnits%3D%22userSpaceOnUse%22%3E%0A%3Cstop%20stop-color%3D%22%2300DC82%22%2F%3E%0A%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23003F25%22%2F%3E%0A%3C%2FlinearGradient%3E%0A%3ClinearGradient%20id%3D%22paint1_linear_2595_7273%22%20x1%3D%22150.495%22%20y1%3D%2271.0767%22%20x2%3D%22191.769%22%20y2%3D%2294.1139%22%20gradientUnits%3D%22userSpaceOnUse%22%3E%0A%3Cstop%20stop-color%3D%22%2300DC82%22%2F%3E%0A%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23003F25%22%2F%3E%0A%3C%2FlinearGradient%3E%0A%3ClinearGradient%20id%3D%22paint2_linear_2595_7273%22%20x1%3D%22165.653%22%20y1%3D%22-3.0791%22%20x2%3D%22166.153%22%20y2%3D%2219.9209%22%20gradientUnits%3D%22userSpaceOnUse%22%3E%0A%3Cstop%20stop-color%3D%22%2318181B%22%2F%3E%0A%3Cstop%20offset%3D%221%22%20stop-color%3D%22%2318181B%22%20stop-opacity%3D%220%22%2F%3E%0A%3C%2FlinearGradient%3E%0A%3ClinearGradient%20id%3D%22paint3_linear_2595_7273%22%20x1%3D%22163.5%22%20y1%3D%22-2.30278e-07%22%20x2%3D%22164.091%22%20y2%3D%2224.9979%22%20gradientUnits%3D%22userSpaceOnUse%22%3E%0A%3Cstop%20stop-color%3D%22%2318181B%22%2F%3E%0A%3Cstop%20offset%3D%221%22%20stop-color%3D%22%2318181B%22%20stop-opacity%3D%220%22%2F%3E%0A%3C%2FlinearGradient%3E%0A%3ClinearGradient%20id%3D%22paint4_linear_2595_7273%22%20x1%3D%22163.5%22%20y1%3D%22-2.30278e-07%22%20x2%3D%22164.091%22%20y2%3D%2224.9979%22%20gradientUnits%3D%22userSpaceOnUse%22%3E%0A%3Cstop%20stop-color%3D%22%2318181B%22%2F%3E%0A%3Cstop%20offset%3D%221%22%20stop-color%3D%22%2318181B%22%20stop-opacity%3D%220%22%2F%3E%0A%3C%2FlinearGradient%3E%0A%3ClinearGradient%20id%3D%22paint5_linear_2595_7273%22%20x1%3D%22505.653%22%20y1%3D%22-17.0791%22%20x2%3D%22506.244%22%20y2%3D%227.91876%22%20gradientUnits%3D%22userSpaceOnUse%22%3E%0A%3Cstop%20stop-color%3D%22%2318181B%22%2F%3E%0A%3Cstop%20offset%3D%221%22%20stop-color%3D%22%2318181B%22%20stop-opacity%3D%220%22%2F%3E%0A%3C%2FlinearGradient%3E%0A%3CclipPath%20id%3D%22clip0_2595_7273%22%3E%0A%3Crect%20width%3D%22341%22%20height%3D%22164%22%20fill%3D%22white%22%20transform%3D%22translate(0.152832%200.920898)%22%2F%3E%0A%3C%2FclipPath%3E%0A%3C%2Fdefs%3E%0A%3C%2Fsvg%3E%0A" alt="documentation icon" class="documentation-image-color-dark h-32 sm:h-34" data-v-30b323c7> <img src="data:image/svg+xml;charset=utf-8,%3Csvg%20width%3D%22342%22%20height%3D%22165%22%20viewBox%3D%220%200%20342%20165%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%0A%3Cg%20clip-path%3D%22url(%23clip0_2687_3977)%22%3E%0A%3Cpath%20d%3D%22M0.152832%20131.851H154.28%22%20stroke%3D%22%23E4E4E7%22%2F%3E%0A%3Cpath%20d%3D%22M215.399%20107.359H349.153%22%20stroke%3D%22%23E4E4E7%22%2F%3E%0A%3Cpath%20d%3D%22M0.152832%2077.2178L116.191%2077.2178%22%20stroke%3D%22%23E4E4E7%22%2F%3E%0A%3Cpath%20d%3D%22M36.1528%20106.921L152.191%20106.921%22%20stroke%3D%22%23E4E4E7%22%2F%3E%0A%3Cpath%20d%3D%22M202.153%2042.9209L317.305%2042.9209%22%20stroke%3D%22%23E4E4E7%22%2F%3E%0A%3Cpath%20d%3D%22M218.153%2076.9209L345.305%2076.9209%22%20stroke%3D%22%23E4E4E7%22%2F%3E%0A%3Cpath%20d%3D%22M285.947%208.45605V166.979%22%20stroke%3D%22%23E4E4E7%22%2F%3E%0A%3Cpath%20d%3D%22M252.602%2016.8311V107.36%22%20stroke%3D%22%23E4E4E7%22%2F%3E%0A%3Cpath%20d%3D%22M171.153%2016.9209V107.45%22%20stroke%3D%22%23E4E4E7%22%2F%3E%0A%3Cpath%20d%3D%22M218.153%2016.9209V43.4501%22%20stroke%3D%22%23E4E4E7%22%2F%3E%0A%3Cpath%20d%3D%22M122.153%2016.9211L327.45%2016.9209%22%20stroke%3D%22%23E4E4E7%22%2F%3E%0A%3Cpath%20d%3D%22M1.92432%2043.3086H148.163%22%20stroke%3D%22%23E4E4E7%22%2F%3E%0A%3Cpath%20d%3D%22M122.392%2016.4209V55.3659%22%20stroke%3D%22%23E4E4E7%22%2F%3E%0A%3Cpath%20d%3D%22M36.084%200.920898L36.084%20176.921%22%20stroke%3D%22%23E4E4E7%22%2F%3E%0A%3Cpath%20d%3D%22M75.4448%2043.249V175.152%22%20stroke%3D%22%23E4E4E7%22%2F%3E%0A%3Ccircle%20opacity%3D%220.7%22%20cx%3D%2275.4448%22%20cy%3D%2277.2178%22%20r%3D%223.5%22%20fill%3D%22%23A1A1AA%22%2F%3E%0A%3Ccircle%20opacity%3D%220.7%22%20cx%3D%2236.1528%22%20cy%3D%22131.85%22%20r%3D%223.5%22%20fill%3D%22%23A1A1AA%22%2F%3E%0A%3Ccircle%20opacity%3D%220.7%22%20cx%3D%22285.947%22%20cy%3D%2242.9209%22%20r%3D%223.5%22%20fill%3D%22%23A1A1AA%22%2F%3E%0A%3Ccircle%20opacity%3D%220.7%22%20cx%3D%22252.602%22%20cy%3D%22107.359%22%20r%3D%223.5%22%20fill%3D%22%23A1A1AA%22%2F%3E%0A%3Cg%20filter%3D%22url(%23filter0_d_2687_3977)%22%3E%0A%3Cpath%20d%3D%22M122.846%2050.7109L163.067%2026.0929C166.656%2023.9507%20171.117%2023.8611%20174.77%2025.8579L217.894%2049.0819C221.524%2051.0665%20223.807%2054.8133%20223.892%2058.9246L224.15%20104.352C224.235%20108.448%20222.13%20112.287%20218.609%20114.46L177.783%20139.658C174.174%20141.886%20169.638%20142.011%20165.931%20139.984L123.774%20116.935C120.045%20114.896%20117.125%20111.001%20117.153%20106.776L117.153%2060.5974C117.18%2056.5529%20119.338%2052.8048%20122.846%2050.7109Z%22%20fill%3D%22white%22%2F%3E%0A%3Cpath%20d%3D%22M222.151%20104.393C222.22%20107.764%20220.487%20110.944%20217.571%20112.75C217.567%20112.753%20217.563%20112.755%20217.559%20112.758L176.733%20137.956C173.748%20139.798%20169.96%20139.907%20166.89%20138.229L124.733%20115.18C121.469%20113.395%20119.131%20110.069%20119.153%20106.79L119.153%20106.776L119.153%2060.6107C119.153%2060.6086%20119.153%2060.6065%20119.153%2060.6044C119.178%2057.2703%20120.958%2054.1669%20123.871%2052.4282L123.881%2052.4225L123.89%2052.4167L164.101%2027.8047C164.101%2027.8047%20164.101%2027.8047%20164.101%2027.8047C164.106%2027.8022%20164.11%2027.7997%20164.114%2027.7972C167.078%2026.0385%20170.793%2025.9632%20173.81%2027.6128L173.81%2027.6128L173.821%2027.6188L216.934%2050.8367C216.936%2050.8377%20216.938%2050.8387%20216.94%2050.8397C219.935%2052.4801%20221.817%2055.5878%20221.892%2058.9515L222.15%20104.363L222.15%20104.378L222.151%20104.393Z%22%20stroke%3D%22url(%23paint0_linear_2687_3977)%22%20stroke-width%3D%224%22%2F%3E%0A%3C%2Fg%3E%0A%3Cpath%20d%3D%22M192.349%2096.9158L190.63%2090.5186L183.778%2064.9088C183.55%2064.0605%20182.994%2063.3375%20182.233%2062.8988C181.472%2062.4601%20180.568%2062.3416%20179.72%2062.5693L173.323%2064.2877L173.116%2064.3498C172.807%2063.945%20172.409%2063.6168%20171.953%2063.3906C171.497%2063.1644%20170.995%2063.0463%20170.486%2063.0455H163.861C163.279%2063.0471%20162.707%2063.2043%20162.205%2063.501C161.703%2063.2043%20161.132%2063.0471%20160.549%2063.0455H153.924C153.045%2063.0455%20152.203%2063.3945%20151.582%2064.0157C150.96%2064.6369%20150.611%2065.4795%20150.611%2066.358V99.483C150.611%20100.362%20150.96%20101.204%20151.582%20101.825C152.203%20102.447%20153.045%20102.796%20153.924%20102.796H160.549C161.132%20102.794%20161.703%20102.637%20162.205%20102.34C162.707%20102.637%20163.279%20102.794%20163.861%20102.796H170.486C171.365%20102.796%20172.207%20102.447%20172.829%20101.825C173.45%20101.204%20173.799%20100.362%20173.799%2099.483V78.8627L177.836%2093.9346L179.554%20100.332C179.742%20101.039%20180.158%20101.665%20180.739%20102.11C181.32%20102.556%20182.031%20102.797%20182.763%20102.796C183.049%20102.791%20183.334%20102.756%20183.612%20102.692L190.009%20100.974C190.43%20100.861%20190.824%20100.665%20191.169%20100.399C191.514%20100.132%20191.802%2099.7997%20192.018%2099.4209C192.238%2099.047%20192.381%2098.6325%20192.438%2098.2021C192.495%2097.7717%20192.465%2097.3342%20192.349%2096.9158V96.9158ZM176.325%2075.4881L182.722%2073.7697L187.007%2089.7732L180.61%2091.4916L176.325%2075.4881ZM180.569%2065.7783L181.873%2070.5607L175.476%2072.2791L174.171%2067.4967L180.569%2065.7783ZM170.486%2066.358V91.2018H163.861V66.358H170.486ZM160.549%2066.358V71.3268H153.924V66.358H160.549ZM153.924%2099.483V74.6393H160.549V99.483H153.924ZM170.486%2099.483H163.861V94.5143H170.486V99.483ZM189.161%2097.7646L182.763%2099.483L181.459%2094.6799L187.877%2092.9615L189.161%2097.7646V97.7646Z%22%20fill%3D%22url(%23paint1_linear_2687_3977)%22%2F%3E%0A%3Crect%20x%3D%222.15283%22%20y%3D%22-3.0791%22%20width%3D%22327%22%20height%3D%2223%22%20fill%3D%22url(%23paint2_linear_2687_3977)%22%2F%3E%0A%3Crect%20width%3D%22327%22%20height%3D%2225%22%20transform%3D%22matrix(1%200%200%20-1%202.15283%20166.921)%22%20fill%3D%22url(%23paint3_linear_2687_3977)%22%2F%3E%0A%3Crect%20width%3D%22327%22%20height%3D%2225%22%20transform%3D%22matrix(0%201%201%200%200.152832%20-17.0791)%22%20fill%3D%22url(%23paint4_linear_2687_3977)%22%2F%3E%0A%3Crect%20x%3D%22342.153%22%20y%3D%22-17.0791%22%20width%3D%22327%22%20height%3D%2225%22%20transform%3D%22rotate(90%20342.153%20-17.0791)%22%20fill%3D%22url(%23paint5_linear_2687_3977)%22%2F%3E%0A%3C%2Fg%3E%0A%3Cdefs%3E%0A%3Cfilter%20id%3D%22filter0_d_2687_3977%22%20x%3D%2286.1528%22%20y%3D%22-6.5791%22%20width%3D%22169%22%20height%3D%22179%22%20filterUnits%3D%22userSpaceOnUse%22%20color-interpolation-filters%3D%22sRGB%22%3E%0A%3CfeFlood%20flood-opacity%3D%220%22%20result%3D%22BackgroundImageFix%22%2F%3E%0A%3CfeColorMatrix%20in%3D%22SourceAlpha%22%20type%3D%22matrix%22%20values%3D%220%200%200%200%200%200%200%200%200%200%200%200%200%200%200%200%200%200%20127%200%22%20result%3D%22hardAlpha%22%2F%3E%0A%3CfeOffset%2F%3E%0A%3CfeGaussianBlur%20stdDeviation%3D%2215.5%22%2F%3E%0A%3CfeComposite%20in2%3D%22hardAlpha%22%20operator%3D%22out%22%2F%3E%0A%3CfeColorMatrix%20type%3D%22matrix%22%20values%3D%220%200%200%200%200.831373%200%200%200%200%200.831373%200%200%200%200%200.847059%200%200%200%200.07%200%22%2F%3E%0A%3CfeBlend%20mode%3D%22normal%22%20in2%3D%22BackgroundImageFix%22%20result%3D%22effect1_dropShadow_2687_3977%22%2F%3E%0A%3CfeBlend%20mode%3D%22normal%22%20in%3D%22SourceGraphic%22%20in2%3D%22effect1_dropShadow_2687_3977%22%20result%3D%22shape%22%2F%3E%0A%3C%2Ffilter%3E%0A%3ClinearGradient%20id%3D%22paint0_linear_2687_3977%22%20x1%3D%22118.202%22%20y1%3D%2260.3042%22%20x2%3D%22223.159%22%20y2%3D%22113.509%22%20gradientUnits%3D%22userSpaceOnUse%22%3E%0A%3Cstop%20stop-color%3D%22%23D4D4D8%22%2F%3E%0A%3Cstop%20offset%3D%221%22%20stop-color%3D%22%233F3F46%22%2F%3E%0A%3C%2FlinearGradient%3E%0A%3ClinearGradient%20id%3D%22paint1_linear_2687_3977%22%20x1%3D%22150.495%22%20y1%3D%2271.0767%22%20x2%3D%22191.769%22%20y2%3D%2294.1139%22%20gradientUnits%3D%22userSpaceOnUse%22%3E%0A%3Cstop%20stop-color%3D%22%23D4D4D8%22%2F%3E%0A%3Cstop%20offset%3D%221%22%20stop-color%3D%22%233F3F46%22%2F%3E%0A%3C%2FlinearGradient%3E%0A%3ClinearGradient%20id%3D%22paint2_linear_2687_3977%22%20x1%3D%22165.653%22%20y1%3D%22-3.0791%22%20x2%3D%22166.153%22%20y2%3D%2219.9209%22%20gradientUnits%3D%22userSpaceOnUse%22%3E%0A%3Cstop%20stop-color%3D%22white%22%2F%3E%0A%3Cstop%20offset%3D%221%22%20stop-color%3D%22white%22%20stop-opacity%3D%220%22%2F%3E%0A%3C%2FlinearGradient%3E%0A%3ClinearGradient%20id%3D%22paint3_linear_2687_3977%22%20x1%3D%22163.5%22%20y1%3D%22-2.30278e-07%22%20x2%3D%22164.091%22%20y2%3D%2224.9979%22%20gradientUnits%3D%22userSpaceOnUse%22%3E%0A%3Cstop%20stop-color%3D%22white%22%2F%3E%0A%3Cstop%20offset%3D%221%22%20stop-color%3D%22white%22%20stop-opacity%3D%220%22%2F%3E%0A%3C%2FlinearGradient%3E%0A%3ClinearGradient%20id%3D%22paint4_linear_2687_3977%22%20x1%3D%22163.5%22%20y1%3D%22-2.30278e-07%22%20x2%3D%22164.091%22%20y2%3D%2224.9979%22%20gradientUnits%3D%22userSpaceOnUse%22%3E%0A%3Cstop%20stop-color%3D%22white%22%2F%3E%0A%3Cstop%20offset%3D%221%22%20stop-color%3D%22white%22%20stop-opacity%3D%220%22%2F%3E%0A%3C%2FlinearGradient%3E%0A%3ClinearGradient%20id%3D%22paint5_linear_2687_3977%22%20x1%3D%22505.653%22%20y1%3D%22-17.0791%22%20x2%3D%22506.244%22%20y2%3D%227.91876%22%20gradientUnits%3D%22userSpaceOnUse%22%3E%0A%3Cstop%20stop-color%3D%22white%22%2F%3E%0A%3Cstop%20offset%3D%221%22%20stop-color%3D%22white%22%20stop-opacity%3D%220%22%2F%3E%0A%3C%2FlinearGradient%3E%0A%3CclipPath%20id%3D%22clip0_2687_3977%22%3E%0A%3Crect%20width%3D%22341%22%20height%3D%22164%22%20fill%3D%22white%22%20transform%3D%22translate(0.152832%200.920898)%22%2F%3E%0A%3C%2FclipPath%3E%0A%3C%2Fdefs%3E%0A%3C%2Fsvg%3E%0A" alt="documentation icon" class="documentation-image-light h-32 sm:h-34" data-v-30b323c7> <img src="data:image/svg+xml;charset=utf-8,%3Csvg%20width%3D%22342%22%20height%3D%22165%22%20viewBox%3D%220%200%20342%20165%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%0A%3Cg%20clip-path%3D%22url(%23clip0_2595_7193)%22%3E%0A%3Cpath%20d%3D%22M0.152832%20131.851H154.28%22%20stroke%3D%22%2327272A%22%2F%3E%0A%3Cpath%20d%3D%22M215.399%20107.359H349.153%22%20stroke%3D%22%2327272A%22%2F%3E%0A%3Cpath%20d%3D%22M0.152832%2077.2178L116.191%2077.2178%22%20stroke%3D%22%2327272A%22%2F%3E%0A%3Cpath%20d%3D%22M36.1528%20106.921L152.191%20106.921%22%20stroke%3D%22%2327272A%22%2F%3E%0A%3Cpath%20d%3D%22M202.153%2042.9209L317.305%2042.9209%22%20stroke%3D%22%2327272A%22%2F%3E%0A%3Cpath%20d%3D%22M218.153%2076.9209L345.305%2076.9209%22%20stroke%3D%22%2327272A%22%2F%3E%0A%3Cpath%20d%3D%22M285.947%208.45605V166.979%22%20stroke%3D%22%2327272A%22%2F%3E%0A%3Cpath%20d%3D%22M252.602%2016.8311V107.36%22%20stroke%3D%22%2327272A%22%2F%3E%0A%3Cpath%20d%3D%22M171.153%2016.9209V107.45%22%20stroke%3D%22%2327272A%22%2F%3E%0A%3Cpath%20d%3D%22M218.153%2016.9209V43.4501%22%20stroke%3D%22%2327272A%22%2F%3E%0A%3Cpath%20d%3D%22M122.153%2016.9211L327.45%2016.9209%22%20stroke%3D%22%2327272A%22%2F%3E%0A%3Cpath%20d%3D%22M1.92432%2043.3086H148.163%22%20stroke%3D%22%2327272A%22%2F%3E%0A%3Cpath%20d%3D%22M122.392%2016.4209V55.3659%22%20stroke%3D%22%2327272A%22%2F%3E%0A%3Cpath%20d%3D%22M36.084%200.920898L36.084%20176.921%22%20stroke%3D%22%2327272A%22%2F%3E%0A%3Cpath%20d%3D%22M75.4448%2043.249V175.152%22%20stroke%3D%22%2327272A%22%2F%3E%0A%3Ccircle%20opacity%3D%220.14%22%20cx%3D%2275.4448%22%20cy%3D%2277.2178%22%20r%3D%223.5%22%20fill%3D%22white%22%2F%3E%0A%3Ccircle%20opacity%3D%220.14%22%20cx%3D%2236.1528%22%20cy%3D%22131.85%22%20r%3D%223.5%22%20fill%3D%22white%22%2F%3E%0A%3Ccircle%20opacity%3D%220.14%22%20cx%3D%22285.947%22%20cy%3D%2242.9209%22%20r%3D%223.5%22%20fill%3D%22white%22%2F%3E%0A%3Ccircle%20opacity%3D%220.14%22%20cx%3D%22252.602%22%20cy%3D%22107.359%22%20r%3D%223.5%22%20fill%3D%22white%22%2F%3E%0A%3Cg%20filter%3D%22url(%23filter0_d_2595_7193)%22%3E%0A%3Cpath%20d%3D%22M122.846%2050.7109L163.067%2026.0929C166.656%2023.9507%20171.117%2023.8611%20174.77%2025.8579L217.894%2049.0819C221.524%2051.0665%20223.807%2054.8133%20223.892%2058.9246L224.15%20104.352C224.235%20108.448%20222.13%20112.287%20218.609%20114.46L177.783%20139.658C174.174%20141.886%20169.638%20142.011%20165.931%20139.984L123.774%20116.935C120.045%20114.896%20117.125%20111.001%20117.153%20106.776L117.153%2060.5974C117.18%2056.5529%20119.338%2052.8048%20122.846%2050.7109Z%22%20fill%3D%22%2318181B%22%2F%3E%0A%3Cpath%20d%3D%22M123.871%2052.4282L123.881%2052.4225L123.89%2052.4167L164.101%2027.8047C167.083%2026.0291%20170.786%2025.9592%20173.81%2027.6128L173.81%2027.6128L173.821%2027.6188L216.934%2050.8367C216.936%2050.8376%20216.938%2050.8386%20216.939%2050.8395C219.938%2052.4814%20221.817%2055.5694%20221.892%2058.9515L222.15%20104.363L222.15%20104.378L222.151%20104.393C222.221%20107.772%20220.485%20110.952%20217.559%20112.758L176.733%20137.956C173.732%20139.808%20169.963%20139.909%20166.89%20138.229L124.733%20115.18C121.465%20113.393%20119.131%20110.089%20119.153%20106.79L119.153%20106.776L119.153%2060.6107C119.153%2060.6086%20119.153%2060.6065%20119.153%2060.6044C119.178%2057.2703%20120.958%2054.1669%20123.871%2052.4282Z%22%20stroke%3D%22url(%23paint0_linear_2595_7193)%22%20stroke-width%3D%224%22%2F%3E%0A%3C%2Fg%3E%0A%3Cpath%20d%3D%22M192.349%2096.9158L190.63%2090.5186L183.778%2064.9088C183.55%2064.0605%20182.994%2063.3375%20182.233%2062.8988C181.472%2062.4601%20180.568%2062.3416%20179.72%2062.5693L173.323%2064.2877L173.116%2064.3498C172.807%2063.945%20172.409%2063.6168%20171.953%2063.3906C171.497%2063.1644%20170.995%2063.0463%20170.486%2063.0455H163.861C163.279%2063.0471%20162.707%2063.2043%20162.205%2063.501C161.703%2063.2043%20161.132%2063.0471%20160.549%2063.0455H153.924C153.045%2063.0455%20152.203%2063.3945%20151.582%2064.0157C150.96%2064.6369%20150.611%2065.4795%20150.611%2066.358V99.483C150.611%20100.362%20150.96%20101.204%20151.582%20101.825C152.203%20102.447%20153.045%20102.796%20153.924%20102.796H160.549C161.132%20102.794%20161.703%20102.637%20162.205%20102.34C162.707%20102.637%20163.279%20102.794%20163.861%20102.796H170.486C171.365%20102.796%20172.207%20102.447%20172.829%20101.825C173.45%20101.204%20173.799%20100.362%20173.799%2099.483V78.8627L177.836%2093.9346L179.554%20100.332C179.742%20101.039%20180.158%20101.665%20180.739%20102.11C181.32%20102.556%20182.031%20102.797%20182.763%20102.796C183.049%20102.791%20183.334%20102.756%20183.612%20102.692L190.009%20100.974C190.43%20100.861%20190.824%20100.665%20191.169%20100.399C191.514%20100.132%20191.802%2099.7998%20192.018%2099.4209C192.238%2099.047%20192.381%2098.6325%20192.438%2098.2021C192.495%2097.7717%20192.465%2097.3342%20192.349%2096.9158ZM176.325%2075.4881L182.722%2073.7697L187.007%2089.7732L180.61%2091.4916L176.325%2075.4881ZM180.569%2065.7783L181.873%2070.5607L175.476%2072.2791L174.171%2067.4967L180.569%2065.7783ZM170.486%2066.358V91.2018H163.861V66.358H170.486ZM160.549%2066.358V71.3268H153.924V66.358H160.549ZM153.924%2099.483V74.6393H160.549V99.483H153.924ZM170.486%2099.483H163.861V94.5143H170.486V99.483ZM189.161%2097.7646L182.763%2099.483L181.459%2094.6799L187.877%2092.9615L189.161%2097.7646Z%22%20fill%3D%22url(%23paint1_linear_2595_7193)%22%2F%3E%0A%3Crect%20x%3D%222.15283%22%20y%3D%22-3.0791%22%20width%3D%22327%22%20height%3D%2223%22%20fill%3D%22url(%23paint2_linear_2595_7193)%22%2F%3E%0A%3Crect%20width%3D%22327%22%20height%3D%2225%22%20transform%3D%22matrix(1%200%200%20-1%202.15283%20166.921)%22%20fill%3D%22url(%23paint3_linear_2595_7193)%22%2F%3E%0A%3Crect%20width%3D%22327%22%20height%3D%2225%22%20transform%3D%22matrix(0%201%201%200%200.152832%20-17.0791)%22%20fill%3D%22url(%23paint4_linear_2595_7193)%22%2F%3E%0A%3Crect%20x%3D%22342.153%22%20y%3D%22-17.0791%22%20width%3D%22327%22%20height%3D%2225%22%20transform%3D%22rotate(90%20342.153%20-17.0791)%22%20fill%3D%22url(%23paint5_linear_2595_7193)%22%2F%3E%0A%3C%2Fg%3E%0A%3Cdefs%3E%0A%3Cfilter%20id%3D%22filter0_d_2595_7193%22%20x%3D%2286.1528%22%20y%3D%22-6.5791%22%20width%3D%22169%22%20height%3D%22179%22%20filterUnits%3D%22userSpaceOnUse%22%20color-interpolation-filters%3D%22sRGB%22%3E%0A%3CfeFlood%20flood-opacity%3D%220%22%20result%3D%22BackgroundImageFix%22%2F%3E%0A%3CfeColorMatrix%20in%3D%22SourceAlpha%22%20type%3D%22matrix%22%20values%3D%220%200%200%200%200%200%200%200%200%200%200%200%200%200%200%200%200%200%20127%200%22%20result%3D%22hardAlpha%22%2F%3E%0A%3CfeOffset%2F%3E%0A%3CfeGaussianBlur%20stdDeviation%3D%2215.5%22%2F%3E%0A%3CfeComposite%20in2%3D%22hardAlpha%22%20operator%3D%22out%22%2F%3E%0A%3CfeColorMatrix%20type%3D%22matrix%22%20values%3D%220%200%200%200%201%200%200%200%200%201%200%200%200%200%201%200%200%200%200.07%200%22%2F%3E%0A%3CfeBlend%20mode%3D%22normal%22%20in2%3D%22BackgroundImageFix%22%20result%3D%22effect1_dropShadow_2595_7193%22%2F%3E%0A%3CfeBlend%20mode%3D%22normal%22%20in%3D%22SourceGraphic%22%20in2%3D%22effect1_dropShadow_2595_7193%22%20result%3D%22shape%22%2F%3E%0A%3C%2Ffilter%3E%0A%3ClinearGradient%20id%3D%22paint0_linear_2595_7193%22%20x1%3D%22118.202%22%20y1%3D%2260.3042%22%20x2%3D%22223.159%22%20y2%3D%22113.509%22%20gradientUnits%3D%22userSpaceOnUse%22%3E%0A%3Cstop%20stop-color%3D%22white%22%2F%3E%0A%3Cstop%20offset%3D%221%22%20stop-color%3D%22%2371717A%22%2F%3E%0A%3C%2FlinearGradient%3E%0A%3ClinearGradient%20id%3D%22paint1_linear_2595_7193%22%20x1%3D%22150.495%22%20y1%3D%2271.0767%22%20x2%3D%22191.769%22%20y2%3D%2294.1139%22%20gradientUnits%3D%22userSpaceOnUse%22%3E%0A%3Cstop%20stop-color%3D%22white%22%2F%3E%0A%3Cstop%20offset%3D%221%22%20stop-color%3D%22%2371717A%22%2F%3E%0A%3C%2FlinearGradient%3E%0A%3ClinearGradient%20id%3D%22paint2_linear_2595_7193%22%20x1%3D%22165.653%22%20y1%3D%22-3.0791%22%20x2%3D%22166.153%22%20y2%3D%2219.9209%22%20gradientUnits%3D%22userSpaceOnUse%22%3E%0A%3Cstop%20stop-color%3D%22%2318181B%22%2F%3E%0A%3Cstop%20offset%3D%221%22%20stop-color%3D%22%2318181B%22%20stop-opacity%3D%220%22%2F%3E%0A%3C%2FlinearGradient%3E%0A%3ClinearGradient%20id%3D%22paint3_linear_2595_7193%22%20x1%3D%22163.5%22%20y1%3D%22-2.30278e-07%22%20x2%3D%22164.091%22%20y2%3D%2224.9979%22%20gradientUnits%3D%22userSpaceOnUse%22%3E%0A%3Cstop%20stop-color%3D%22%2318181B%22%2F%3E%0A%3Cstop%20offset%3D%221%22%20stop-color%3D%22%2318181B%22%20stop-opacity%3D%220%22%2F%3E%0A%3C%2FlinearGradient%3E%0A%3ClinearGradient%20id%3D%22paint4_linear_2595_7193%22%20x1%3D%22163.5%22%20y1%3D%22-2.30278e-07%22%20x2%3D%22164.091%22%20y2%3D%2224.9979%22%20gradientUnits%3D%22userSpaceOnUse%22%3E%0A%3Cstop%20stop-color%3D%22%2318181B%22%2F%3E%0A%3Cstop%20offset%3D%221%22%20stop-color%3D%22%2318181B%22%20stop-opacity%3D%220%22%2F%3E%0A%3C%2FlinearGradient%3E%0A%3ClinearGradient%20id%3D%22paint5_linear_2595_7193%22%20x1%3D%22505.653%22%20y1%3D%22-17.0791%22%20x2%3D%22506.244%22%20y2%3D%227.91876%22%20gradientUnits%3D%22userSpaceOnUse%22%3E%0A%3Cstop%20stop-color%3D%22%2318181B%22%2F%3E%0A%3Cstop%20offset%3D%221%22%20stop-color%3D%22%2318181B%22%20stop-opacity%3D%220%22%2F%3E%0A%3C%2FlinearGradient%3E%0A%3CclipPath%20id%3D%22clip0_2595_7193%22%3E%0A%3Crect%20width%3D%22341%22%20height%3D%22164%22%20fill%3D%22white%22%20transform%3D%22translate(0.152832%200.920898)%22%2F%3E%0A%3C%2FclipPath%3E%0A%3C%2Fdefs%3E%0A%3C%2Fsvg%3E%0A" alt="documentation icon" class="documentation-image-dark h-32 sm:h-34" data-v-30b323c7></div></a></div><div class="border border-gray-200 col-span-2 dark:border-transparent dark:text-white examples-container hover:border-transparent items-center justify-center lg:col-span-6 lg:min-h-min md:min-h-[180px] relative rounded-xl sm:col-span-1 sm:min-h-[220px] text-black" data-v-30b323c7><div class="gradient-border gradient-border-examples gradient-border-rect" data-v-30b323c7></div><div class="absolute bg-gradient-to-l duration-300 examples-gradient-right from-blue-400 inset-y-0 right-0 rounded-xl to-transparent transition-opacity w-[20%] z-1" data-v-30b323c7></div><a href="https://nuxt.com/docs/examples" target="_blank" class="bg-white dark:bg-gray-900 flex gap-x-4 items-center justify-center lg:min-h-min md:min-h-[180px] px-5 py-6 rounded-xl sm:min-h-[220px]" data-v-30b323c7><img src="data:image/svg+xml;charset=utf-8,%3Csvg%20width%3D%2253%22%20height%3D%2258%22%20viewBox%3D%220%200%2053%2058%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%0A%3Cpath%20d%3D%22M49.1971%2043.7595C49.1113%2043.8209%2049.0231%2043.8796%2048.9325%2043.9357L29.0918%2056.2117C27.6504%2057.1035%2025.8212%2057.1564%2024.3387%2056.3439L3.85107%2045.1148C2.27157%2044.2491%201.14238%2042.6366%201.15291%2041.0494L1.15293%2041.0427L1.153%2018.552C1.15301%2018.5509%201.15302%2018.5499%201.15302%2018.5488C1.16485%2016.9324%202.02611%2015.4289%203.43319%2014.5869L3.43322%2014.587L3.44269%2014.5812L22.9844%202.59084C24.4169%201.73583%2026.2139%201.69824%2027.6729%202.49791L27.6729%202.49792L27.6784%202.50094L48.6303%2013.8121C48.6313%2013.8126%2048.6322%2013.8131%2048.6331%2013.8136C50.0797%2014.6078%2050.9898%2016.1132%2051.026%2017.7438L51.1517%2039.8672L51.1517%2039.8746L51.1519%2039.8821C51.1834%2041.4138%2050.4491%2042.8635%2049.1971%2043.7595Z%22%20fill%3D%22white%22%20stroke%3D%22url(%23paint0_linear_2613_3941)%22%20stroke-width%3D%222%22%2F%3E%0A%3Cpath%20d%3D%22M37.1528%2017.9209H15.1528C14.6224%2017.9209%2014.1137%2018.1316%2013.7386%2018.5067C13.3635%2018.8818%2013.1528%2019.3905%2013.1528%2019.9209V37.9209C13.1528%2038.4513%2013.3635%2038.96%2013.7386%2039.3351C14.1137%2039.7102%2014.6224%2039.9209%2015.1528%2039.9209H37.1528C37.6833%2039.9209%2038.192%2039.7102%2038.567%2039.3351C38.9421%2038.96%2039.1528%2038.4513%2039.1528%2037.9209V19.9209C39.1528%2019.3905%2038.9421%2018.8818%2038.567%2018.5067C38.192%2018.1316%2037.6833%2017.9209%2037.1528%2017.9209V17.9209ZM15.1528%2019.9209H37.1528V24.9209H15.1528V19.9209ZM15.1528%2026.9209H22.1528V37.9209H15.1528V26.9209ZM37.1528%2037.9209H24.1528V26.9209H37.1528V37.9209Z%22%20fill%3D%22url(%23paint1_linear_2613_3941)%22%2F%3E%0A%3Cdefs%3E%0A%3ClinearGradient%20id%3D%22paint0_linear_2613_3941%22%20x1%3D%220.662695%22%20y1%3D%2218.4025%22%20x2%3D%2251.7209%22%20y2%3D%2244.2212%22%20gradientUnits%3D%22userSpaceOnUse%22%3E%0A%3Cstop%20stop-color%3D%22%238DEAFF%22%2F%3E%0A%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23008AA9%22%2F%3E%0A%3C%2FlinearGradient%3E%0A%3ClinearGradient%20id%3D%22paint1_linear_2613_3941%22%20x1%3D%2213.0804%22%20y1%3D%2222.6224%22%20x2%3D%2237.028%22%20y2%3D%2237.847%22%20gradientUnits%3D%22userSpaceOnUse%22%3E%0A%3Cstop%20stop-color%3D%22%238DEAFF%22%2F%3E%0A%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23008AA9%22%2F%3E%0A%3C%2FlinearGradient%3E%0A%3C%2Fdefs%3E%0A%3C%2Fsvg%3E%0A" alt="examples icon" class="examples-image-color-light" data-v-30b323c7> <img src="data:image/svg+xml;charset=utf-8,%3Csvg%20width%3D%2253%22%20height%3D%2258%22%20viewBox%3D%220%200%2053%2058%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%0A%3Cpath%20d%3D%22M3.43319%2014.5869L3.43322%2014.587L3.44269%2014.5812L22.9844%202.59084C24.4246%201.73116%2026.2124%201.69742%2027.6729%202.49791L27.6729%202.49792L27.6784%202.50094L48.6303%2013.8121C48.6313%2013.8126%2048.6322%2013.8131%2048.6331%2013.8137C50.0812%2014.6086%2050.9896%2016.1043%2051.026%2017.7437L51.1517%2039.8672L51.1517%2039.8746L51.1519%2039.8821C51.1856%2041.5203%2050.346%2043.0611%2048.9325%2043.9357L29.0918%2056.2117C27.6424%2057.1085%2025.8227%2057.1572%2024.3387%2056.3439L3.85107%2045.1148C2.26984%2044.2481%201.14232%2042.646%201.15293%2041.0494V41.0427L1.153%2018.552C1.15301%2018.5509%201.15302%2018.5499%201.15302%2018.5488C1.16485%2016.9324%202.02611%2015.4289%203.43319%2014.5869Z%22%20fill%3D%22%2318181B%22%20stroke%3D%22url(%23paint0_linear_2595_7426)%22%20stroke-width%3D%222%22%2F%3E%0A%3Cpath%20d%3D%22M37.1528%2017.9209H15.1528C14.6224%2017.9209%2014.1137%2018.1316%2013.7386%2018.5067C13.3635%2018.8818%2013.1528%2019.3905%2013.1528%2019.9209V37.9209C13.1528%2038.4513%2013.3635%2038.96%2013.7386%2039.3351C14.1137%2039.7102%2014.6224%2039.9209%2015.1528%2039.9209H37.1528C37.6833%2039.9209%2038.192%2039.7102%2038.567%2039.3351C38.9421%2038.96%2039.1528%2038.4513%2039.1528%2037.9209V19.9209C39.1528%2019.3905%2038.9421%2018.8818%2038.567%2018.5067C38.192%2018.1316%2037.6833%2017.9209%2037.1528%2017.9209ZM15.1528%2019.9209H37.1528V24.9209H15.1528V19.9209ZM15.1528%2026.9209H22.1528V37.9209H15.1528V26.9209ZM37.1528%2037.9209H24.1528V26.9209H37.1528V37.9209Z%22%20fill%3D%22url(%23paint1_linear_2595_7426)%22%2F%3E%0A%3Cdefs%3E%0A%3ClinearGradient%20id%3D%22paint0_linear_2595_7426%22%20x1%3D%220.662695%22%20y1%3D%2218.4025%22%20x2%3D%2251.7209%22%20y2%3D%2244.2212%22%20gradientUnits%3D%22userSpaceOnUse%22%3E%0A%3Cstop%20stop-color%3D%22%238DEAFF%22%2F%3E%0A%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23008AA9%22%2F%3E%0A%3C%2FlinearGradient%3E%0A%3ClinearGradient%20id%3D%22paint1_linear_2595_7426%22%20x1%3D%2213.0804%22%20y1%3D%2222.6224%22%20x2%3D%2237.028%22%20y2%3D%2237.847%22%20gradientUnits%3D%22userSpaceOnUse%22%3E%0A%3Cstop%20stop-color%3D%22%238DEAFF%22%2F%3E%0A%3Cstop%20offset%3D%221%22%20stop-color%3D%22%23008AA9%22%2F%3E%0A%3C%2FlinearGradient%3E%0A%3C%2Fdefs%3E%0A%3C%2Fsvg%3E%0A" alt="examples icon" class="examples-image-color-dark" data-v-30b323c7> <img src="data:image/svg+xml;charset=utf-8,%3Csvg%20width%3D%2253%22%20height%3D%2258%22%20viewBox%3D%220%200%2053%2058%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%0A%3Cpath%20d%3D%22M49.1971%2043.7595C49.1113%2043.8209%2049.0231%2043.8796%2048.9325%2043.9357L29.0918%2056.2117C27.6504%2057.1035%2025.8212%2057.1564%2024.3387%2056.3439L3.85107%2045.1148C2.27157%2044.2491%201.14238%2042.6366%201.15291%2041.0494L1.15293%2041.0427L1.153%2018.552C1.15301%2018.5509%201.15302%2018.5499%201.15302%2018.5488C1.16485%2016.9324%202.02611%2015.4289%203.43319%2014.5869L3.43322%2014.587L3.44269%2014.5812L22.9844%202.59084C24.4169%201.73583%2026.2139%201.69824%2027.6729%202.49791L27.6729%202.49792L27.6784%202.50094L48.6303%2013.8121C48.6313%2013.8126%2048.6322%2013.8131%2048.6331%2013.8136C50.0797%2014.6078%2050.9898%2016.1132%2051.026%2017.7438L51.1517%2039.8672L51.1517%2039.8746L51.1519%2039.8821C51.1834%2041.4138%2050.4491%2042.8635%2049.1971%2043.7595Z%22%20fill%3D%22white%22%20stroke%3D%22url(%23paint0_linear_2691_4397)%22%20stroke-width%3D%222%22%2F%3E%0A%3Cpath%20d%3D%22M37.1528%2017.9209H15.1528C14.6224%2017.9209%2014.1137%2018.1316%2013.7386%2018.5067C13.3635%2018.8818%2013.1528%2019.3905%2013.1528%2019.9209V37.9209C13.1528%2038.4513%2013.3635%2038.96%2013.7386%2039.3351C14.1137%2039.7102%2014.6224%2039.9209%2015.1528%2039.9209H37.1528C37.6833%2039.9209%2038.192%2039.7102%2038.567%2039.3351C38.9421%2038.96%2039.1528%2038.4513%2039.1528%2037.9209V19.9209C39.1528%2019.3905%2038.9421%2018.8818%2038.567%2018.5067C38.192%2018.1316%2037.6833%2017.9209%2037.1528%2017.9209V17.9209ZM15.1528%2019.9209H37.1528V24.9209H15.1528V19.9209ZM15.1528%2026.9209H22.1528V37.9209H15.1528V26.9209ZM37.1528%2037.9209H24.1528V26.9209H37.1528V37.9209Z%22%20fill%3D%22url(%23paint1_linear_2691_4397)%22%2F%3E%0A%3Cdefs%3E%0A%3ClinearGradient%20id%3D%22paint0_linear_2691_4397%22%20x1%3D%220.662695%22%20y1%3D%2218.4025%22%20x2%3D%2251.7209%22%20y2%3D%2244.2212%22%20gradientUnits%3D%22userSpaceOnUse%22%3E%0A%3Cstop%20stop-color%3D%22%23D4D4D8%22%2F%3E%0A%3Cstop%20offset%3D%221%22%20stop-color%3D%22%2371717A%22%2F%3E%0A%3C%2FlinearGradient%3E%0A%3ClinearGradient%20id%3D%22paint1_linear_2691_4397%22%20x1%3D%2213.0804%22%20y1%3D%2222.6224%22%20x2%3D%2237.028%22%20y2%3D%2237.847%22%20gradientUnits%3D%22userSpaceOnUse%22%3E%0A%3Cstop%20stop-color%3D%22%23D4D4D8%22%2F%3E%0A%3Cstop%20offset%3D%221%22%20stop-color%3D%22%2371717A%22%2F%3E%0A%3C%2FlinearGradient%3E%0A%3C%2Fdefs%3E%0A%3C%2Fsvg%3E%0A" alt="examples icon" class="examples-image-light" data-v-30b323c7> <img src="data:image/svg+xml;charset=utf-8,%3Csvg%20width%3D%2253%22%20height%3D%2258%22%20viewBox%3D%220%200%2053%2058%22%20fill%3D%22none%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%0A%3Cpath%20d%3D%22M3.43319%2014.5869L3.43322%2014.587L3.44269%2014.5812L22.9844%202.59084C24.4246%201.73116%2026.2124%201.69742%2027.6729%202.49791L27.6729%202.49792L27.6784%202.50094L48.6303%2013.8121C48.6313%2013.8126%2048.6322%2013.8131%2048.6331%2013.8137C50.0812%2014.6086%2050.9896%2016.1043%2051.026%2017.7437L51.1517%2039.8672L51.1517%2039.8746L51.1519%2039.8821C51.1856%2041.5203%2050.346%2043.0611%2048.9325%2043.9357L29.0918%2056.2117C27.6424%2057.1085%2025.8227%2057.1572%2024.3387%2056.3439L3.85107%2045.1148C2.26984%2044.2481%201.14232%2042.646%201.15293%2041.0494V41.0427L1.153%2018.552C1.15301%2018.5509%201.15302%2018.5499%201.15302%2018.5488C1.16485%2016.9324%202.02611%2015.4289%203.43319%2014.5869Z%22%20fill%3D%22%2318181B%22%20stroke%3D%22url(%23paint0_linear_2595_7182)%22%20stroke-width%3D%222%22%2F%3E%0A%3Cpath%20d%3D%22M37.1528%2017.9209H15.1528C14.6224%2017.9209%2014.1137%2018.1316%2013.7386%2018.5067C13.3635%2018.8818%2013.1528%2019.3905%2013.1528%2019.9209V37.9209C13.1528%2038.4513%2013.3635%2038.96%2013.7386%2039.3351C14.1137%2039.7102%2014.6224%2039.9209%2015.1528%2039.9209H37.1528C37.6833%2039.9209%2038.192%2039.7102%2038.567%2039.3351C38.9421%2038.96%2039.1528%2038.4513%2039.1528%2037.9209V19.9209C39.1528%2019.3905%2038.9421%2018.8818%2038.567%2018.5067C38.192%2018.1316%2037.6833%2017.9209%2037.1528%2017.9209ZM15.1528%2019.9209H37.1528V24.9209H15.1528V19.9209ZM15.1528%2026.9209H22.1528V37.9209H15.1528V26.9209ZM37.1528%2037.9209H24.1528V26.9209H37.1528V37.9209Z%22%20fill%3D%22url(%23paint1_linear_2595_7182)%22%2F%3E%0A%3Cdefs%3E%0A%3ClinearGradient%20id%3D%22paint0_linear_2595_7182%22%20x1%3D%220.662695%22%20y1%3D%2218.4025%22%20x2%3D%2251.7209%22%20y2%3D%2244.2212%22%20gradientUnits%3D%22userSpaceOnUse%22%3E%0A%3Cstop%20stop-color%3D%22white%22%2F%3E%0A%3Cstop%20offset%3D%221%22%20stop-color%3D%22%2371717A%22%2F%3E%0A%3C%2FlinearGradient%3E%0A%3ClinearGradient%20id%3D%22paint1_linear_2595_7182%22%20x1%3D%2213.0804%22%20y1%3D%2222.6224%22%20x2%3D%2237.028%22%20y2%3D%2237.847%22%20gradientUnits%3D%22userSpaceOnUse%22%3E%0A%3Cstop%20stop-color%3D%22white%22%2F%3E%0A%3Cstop%20offset%3D%221%22%20stop-color%3D%22%2371717A%22%2F%3E%0A%3C%2FlinearGradient%3E%0A%3C%2Fdefs%3E%0A%3C%2Fsvg%3E%0A" alt="examples icon" class="examples-image-dark" data-v-30b323c7> <div class="dark:text-white flex flex-col space-y text-black" data-v-30b323c7><h3 class="font-semibold text-xl" data-v-30b323c7>Examples</h3><p class="dark:text-gray-300 text-gray-700" data-v-30b323c7>Explore different way of using Nuxt features and get inspired with our list of examples.</p></div></a></div></div></div>',
                1,
              )),
            ae('footer', nc, [
              s[1] ||
                (s[1] = l0(
                  '<div class="-top-3 absolute flex inset-x-0 items-center justify-center" data-v-30b323c7><a href="https://nuxt.com" target="_blank" aria-label="Nuxt" data-v-30b323c7><svg xmlns="http://www.w3.org/2000/svg" width="70" height="20" fill="none" viewBox="0 0 70 20" data-v-30b323c7><ellipse cx="34.653" cy="10.421" fill="#fff" class="dark:hidden" rx="34.5" ry="9.5" data-v-30b323c7></ellipse><ellipse cx="34.653" cy="10.421" fill="#000" class="dark:block hidden" rx="34.5" ry="9.5" data-v-30b323c7></ellipse><path fill="#00dc82" d="M36.06 15.92h6.566a1.18 1.18 0 0 0 1.028-.6 1.21 1.21 0 0 0 0-1.2l-4.41-7.713a1.19 1.19 0 0 0-1.028-.6 1.18 1.18 0 0 0-1.028.6L36.06 8.38l-2.204-3.86a1.2 1.2 0 0 0-1.029-.6 1.18 1.18 0 0 0-1.028.6l-5.487 9.6a1.21 1.21 0 0 0 .434 1.64c.181.106.386.16.595.16h4.12c1.633 0 2.837-.724 3.666-2.137l2.011-3.52 1.078-1.883 3.234 5.658h-4.312zm-4.666-1.884-2.876-.001 4.311-7.542 2.151 3.77-1.44 2.521c-.55.917-1.175 1.252-2.146 1.252" data-v-30b323c7></path></svg></a></div>',
                  1,
                )),
              ae('div', oc, [
                ae('div', ic, [
                  ae('div', ac, [
                    ae(
                      'span',
                      lc,
                      '© 2016-' + Ls(new Date().getFullYear()) + ' Nuxt - MIT License',
                      1,
                    ),
                  ]),
                  s[0] ||
                    (s[0] = l0(
                      '<ul class="flex gap-3 items-center justify-end" data-v-30b323c7><li data-v-30b323c7><a href="https://chat.nuxt.dev" target="_blank" class="dark:hover:text-white dark:text-gray-300 focus-visible:ring-2 hover:text-black text-gray-700" data-v-30b323c7><span class="sr-only" data-v-30b323c7>Nuxt Discord Server</span> <svg xmlns="http://www.w3.org/2000/svg" width="16" height="12" fill="none" viewBox="0 0 16 12" data-v-30b323c7><path fill="currentColor" d="M13.37 1.073a.04.04 0 0 0-.019-.018 12.2 12.2 0 0 0-3.053-.966.05.05 0 0 0-.028.003.05.05 0 0 0-.021.02 9 9 0 0 0-.38.797 11.2 11.2 0 0 0-3.43 0 8 8 0 0 0-.386-.797.05.05 0 0 0-.05-.024c-1.053.186-2.08.511-3.052.967a.04.04 0 0 0-.02.018C.986 4.037.453 6.929.715 9.785a.05.05 0 0 0 .02.035 12.4 12.4 0 0 0 3.745 1.932.05.05 0 0 0 .053-.017q.434-.604.766-1.272a.05.05 0 0 0-.026-.067 8 8 0 0 1-1.17-.57.05.05 0 0 1-.024-.039.05.05 0 0 1 .019-.042q.119-.09.232-.186a.05.05 0 0 1 .049-.006c2.455 1.143 5.112 1.143 7.538 0a.05.05 0 0 1 .05.006q.112.095.232.186a.05.05 0 0 1-.004.081 7.6 7.6 0 0 1-1.17.569l-.018.011a.05.05 0 0 0-.008.057q.337.664.765 1.271a.05.05 0 0 0 .053.018A12.3 12.3 0 0 0 15.57 9.82a.05.05 0 0 0 .02-.035c.312-3.301-.525-6.17-2.219-8.712M5.666 8.046c-.739 0-1.348-.693-1.348-1.543S4.914 4.96 5.665 4.96c.757 0 1.36.699 1.348 1.543 0 .85-.597 1.543-1.348 1.543m4.985 0c-.74 0-1.348-.693-1.348-1.543S9.899 4.96 10.65 4.96c.756 0 1.36.699 1.348 1.543 0 .85-.592 1.543-1.348 1.543" data-v-30b323c7></path></svg></a></li><li data-v-30b323c7><a href="https://twitter.nuxt.dev" target="_blank" class="dark:hover:text-white dark:text-gray-300 focus-visible:ring-2 hover:text-black text-gray-700" data-v-30b323c7><span class="sr-only" data-v-30b323c7>Nuxt Twitter</span> <svg xmlns="http://www.w3.org/2000/svg" width="18" height="14" fill="none" viewBox="0 0 18 14" data-v-30b323c7><path fill="currentColor" d="M17.486 1.754a7 7 0 0 1-1.967.534A3.44 3.44 0 0 0 17.028.396c-.672.4-1.408.682-2.175.833a3.417 3.417 0 0 0-5.834 3.117A9.7 9.7 0 0 1 1.978.771a3.46 3.46 0 0 0-.459 1.725 3.41 3.41 0 0 0 1.517 2.842 3.4 3.4 0 0 1-1.55-.425v.041a3.42 3.42 0 0 0 2.75 3.334c-.297.09-.606.138-.917.141a4 4 0 0 1-.641-.058 3.425 3.425 0 0 0 3.191 2.367 6.85 6.85 0 0 1-5.05 1.416 9.64 9.64 0 0 0 5.242 1.542 9.66 9.66 0 0 0 9.758-9.733V3.52a7 7 0 0 0 1.667-1.767" data-v-30b323c7></path></svg></a></li><li data-v-30b323c7><a href="https://github.nuxt.dev" target="_blank" class="dark:hover:text-white dark:text-gray-300 focus-visible:ring-2 hover:text-black text-gray-700" data-v-30b323c7><span class="sr-only" data-v-30b323c7>Nuxt GitHub Repository</span> <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 18 18" data-v-30b323c7><path fill="currentColor" d="M9.153.793a8.334 8.334 0 0 0-2.636 16.24c.417.072.573-.178.573-.396 0-.198-.01-.854-.01-1.552-2.094.385-2.636-.51-2.802-.98a3 3 0 0 0-.854-1.177c-.292-.156-.709-.541-.01-.552a1.67 1.67 0 0 1 1.28.854 1.78 1.78 0 0 0 2.427.688c.036-.424.225-.82.532-1.115-1.854-.208-3.792-.927-3.792-4.114a3.24 3.24 0 0 1 .854-2.24A3 3 0 0 1 4.8 4.241s.697-.219 2.291.854a7.86 7.86 0 0 1 4.167 0c1.594-1.083 2.292-.854 2.292-.854.308.698.338 1.488.083 2.208.562.61.868 1.411.854 2.24 0 3.198-1.948 3.906-3.802 4.114a1.97 1.97 0 0 1 .562 1.542c0 1.115-.01 2.01-.01 2.292 0 .218.156.479.573.396A8.338 8.338 0 0 0 9.153.793" data-v-30b323c7></path></svg></a></li></ul>',
                      1,
                    )),
                ]),
              ]),
            ]),
          ])
        )
      );
    },
  },
  fc = rc(cc, [['__scopeId', 'data-v-30b323c7']]),
  uc = 'modulepreload',
  dc = function (e, t) {
    return new URL(e, t).href;
  },
  Ds = {},
  ys = function (t, r, s) {
    let n = Promise.resolve();
    if (r && r.length > 0) {
      let d = function (c) {
        return Promise.all(
          c.map((f) =>
            Promise.resolve(f).then(
              (h) => ({ status: 'fulfilled', value: h }),
              (h) => ({ status: 'rejected', reason: h }),
            ),
          ),
        );
      };
      const i = document.getElementsByTagName('link'),
        a = document.querySelector('meta[property=csp-nonce]'),
        l = a?.nonce || a?.getAttribute('nonce');
      n = d(
        r.map((c) => {
          if (((c = dc(c, s)), c in Ds)) return;
          Ds[c] = !0;
          const f = c.endsWith('.css'),
            h = f ? '[rel="stylesheet"]' : '';
          if (s)
            for (let C = i.length - 1; C >= 0; C--) {
              const D = i[C];
              if (D.href === c && (!f || D.rel === 'stylesheet')) return;
            }
          else if (document.querySelector(`link[href="${c}"]${h}`)) return;
          const p = document.createElement('link');
          if (
            ((p.rel = f ? 'stylesheet' : uc),
            f || (p.as = 'script'),
            (p.crossOrigin = ''),
            (p.href = c),
            l && p.setAttribute('nonce', l),
            document.head.appendChild(p),
            f)
          )
            return new Promise((C, D) => {
              (p.addEventListener('load', C),
                p.addEventListener('error', () => D(new Error(`Unable to preload CSS for ${c}`))));
            });
        }),
      );
    }
    function o(i) {
      const a = new Event('vite:preloadError', { cancelable: !0 });
      if (((a.payload = i), window.dispatchEvent(a), !a.defaultPrevented)) throw i;
    }
    return n.then((i) => {
      for (const a of i || []) a.status === 'rejected' && o(a.reason);
      return t().catch(o);
    });
  },
  pc = {
    __name: 'nuxt-error-page',
    props: { error: Object },
    setup(e) {
      const r = e.error,
        s = Number(r.statusCode || 500),
        n = s === 404,
        o = r.statusMessage ?? (n ? 'Page Not Found' : 'Internal Server Error'),
        i = r.message || r.toString(),
        a = void 0,
        c = n
          ? Or(() => ys(() => import('./DL3tvOdn.js'), __vite__mapDeps([0, 1]), import.meta.url))
          : Or(() => ys(() => import('./BKRDrXTh.js'), __vite__mapDeps([2, 3]), import.meta.url));
      return (f, h) => (
        Z2(),
        Ee(
          a2(c),
          Ro(
            In({
              status: a2(s),
              statusText: a2(o),
              statusCode: a2(s),
              statusMessage: a2(o),
              description: a2(i),
              stack: a2(a),
            }),
          ),
          null,
          16,
        )
      );
    },
  },
  hc = { key: 0 },
  _s = {
    __name: 'nuxt-root',
    setup(e) {
      const t = () => null,
        r = b2(),
        s = r.deferHydration();
      if (r.isHydrating) {
        const c = r.hooks.hookOnce('app:error', s),
          f = ge().beforeEach(() => {
            (c(), f());
          });
      }
      const n = !1;
      (tn(fo, gr()), r.hooks.callHookWith((c) => c.map((f) => f()), 'vue:setup', []));
      const o = Cr(),
        i = !1,
        a = /bot\b|chrome-lighthouse|facebookexternalhit|google\b/i;
      function l(c, f, h) {
        const p = r.vueApp.config.errorHandler;
        if (p && !p.__nuxt_default)
          try {
            p(c, f, h);
          } catch (C) {
            console.error('[nuxt] Error in `app.config.errorHandler`', C);
          }
      }
      cn((c, f, h) => {
        if (
          (r.hooks
            .callHook('vue:error', c, f, h)
            .catch((p) => console.error('[nuxt] Error in `vue:error` hook', p)),
          a.test(navigator.userAgent))
        )
          return (
            r.hooks.callHook('app:error', c),
            console.error(
              `[nuxt] Not rendering error page for bot with user agent \`${navigator.userAgent}\`:`,
              c,
            ),
            !1
          );
        if (Ma(c) && (c.fatal || c.unhandled))
          return (r.runWithContext(() => La(c)), l(c, f, h), !1);
      });
      const d = !1;
      return (c, f) => (
        Z2(),
        Ee(
          d3,
          { onResolve: a2(s) },
          {
            default: en(() => [
              a2(i)
                ? (Z2(), On('div', hc))
                : a2(o)
                  ? (Z2(), Ee(a2(pc), { key: 1, error: a2(o) }, null, 8, ['error']))
                  : a2(d)
                    ? (Z2(), Ee(a2(t), { key: 2, context: a2(d) }, null, 8, ['context']))
                    : a2(n)
                      ? (Z2(), Ee(Vi(a2(n)), { key: 3 }))
                      : (Z2(), Ee(a2(fc), { key: 4 })),
            ]),
            _: 1,
          },
          8,
          ['onResolve'],
        )
      );
    },
  };
let ms;
{
  let e;
  ((ms = async function () {
    if (e) return e;
    const s = !!(
        window.__NUXT__?.serverRendered ??
        document.getElementById('__NUXT_DATA__')?.dataset.ssr === 'true'
      )
        ? s1(_s)
        : r1(_s),
      n = ga({ vueApp: s });
    async function o(i) {
      (await n.callHook('app:error', i), (n.payload.error ||= Dr(i)));
    }
    ((o.__nuxt_default = !0),
      (s.config.errorHandler = o),
      n.hook('app:suspense:resolve', () => {
        s.config.errorHandler === o && (s.config.errorHandler = void 0);
      }));
    try {
      await ya(n, tc);
    } catch (i) {
      o(i);
    }
    try {
      (await n.hooks.callHook('app:created', s),
        await n.hooks.callHook('app:beforeMount', s),
        s.mount(da),
        await n.hooks.callHook('app:mounted', s),
        await zs());
    } catch (i) {
      o(i);
    }
    return s;
  }),
    (e = ms().catch((t) => {
      throw (console.error('Error while mounting app:', t), t);
    })));
}
export {
  Z2 as A,
  On as B,
  ae as C,
  Ls as D,
  d2 as E,
  en as F,
  Nn as G,
  rc as _,
  b2 as a,
  Er as b,
  ln as c,
  sn as d,
  yc as e,
  gc as f,
  ka as g,
  L3 as h,
  ue as i,
  Fa as j,
  a2 as k,
  Bn as l,
  Zt as m,
  xa as n,
  Pi as o,
  ur as p,
  Pe as q,
  Cs as r,
  Mr as s,
  T0 as t,
  ge as u,
  et as v,
  P0 as w,
  Xn as x,
  Dc as y,
  kl as z,
};
