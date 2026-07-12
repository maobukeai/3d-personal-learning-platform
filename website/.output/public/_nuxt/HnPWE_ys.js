const __vite__mapDeps = (
  i,
  m = __vite__mapDeps,
  d = m.f ||
    (m.f = [
      './D8umNv_u.js',
      './C5KMDVPB.js',
      './BeaGL18k.js',
      './DTkrjjdI.js',
      './DlAUqK2U.js',
      './_sourceId_.BbeSdQPl.css',
      './x0G8KH4U.js',
      './resources.GGIJG5fO.css',
      './CF7s3eWB.js',
      './error-404.DL_4WIao.css',
      './BRVeqoV5.js',
      './error-500.I1Dtv2V5.css',
    ]),
) => i.map((i) => d[i]);
(function () {
  const t = document.createElement('link').relList;
  if (t && t.supports && t.supports('modulepreload')) return;
  for (const s of document.querySelectorAll('link[rel="modulepreload"]')) r(s);
  new MutationObserver((s) => {
    for (const o of s)
      if (o.type === 'childList')
        for (const i of o.addedNodes) i.tagName === 'LINK' && i.rel === 'modulepreload' && r(i);
  }).observe(document, { childList: !0, subtree: !0 });
  function n(s) {
    const o = {};
    return (
      s.integrity && (o.integrity = s.integrity),
      s.referrerPolicy && (o.referrerPolicy = s.referrerPolicy),
      s.crossOrigin === 'use-credentials'
        ? (o.credentials = 'include')
        : s.crossOrigin === 'anonymous'
          ? (o.credentials = 'omit')
          : (o.credentials = 'same-origin'),
      o
    );
  }
  function r(s) {
    if (s.ep) return;
    s.ep = !0;
    const o = n(s);
    fetch(s.href, o);
  }
})();
function Ro(e) {
  const t = Object.create(null);
  for (const n of e.split(',')) t[n] = 1;
  return (n) => n in t;
}
const de = {},
  gn = [],
  dt = () => {},
  Oa = () => !1,
  fr = (e) =>
    e.charCodeAt(0) === 111 &&
    e.charCodeAt(1) === 110 &&
    (e.charCodeAt(2) > 122 || e.charCodeAt(2) < 97),
  Qr = (e) => e.startsWith('onUpdate:'),
  Ae = Object.assign,
  Ao = (e, t) => {
    const n = e.indexOf(t);
    n > -1 && e.splice(n, 1);
  },
  nu = Object.prototype.hasOwnProperty,
  le = (e, t) => nu.call(e, t),
  G = Array.isArray,
  mn = (e) => xn(e) === '[object Map]',
  Ma = (e) => xn(e) === '[object Set]',
  si = (e) => xn(e) === '[object Date]',
  ru = (e) => xn(e) === '[object RegExp]',
  Y = (e) => typeof e == 'function',
  he = (e) => typeof e == 'string',
  Xe = (e) => typeof e == 'symbol',
  oe = (e) => e !== null && typeof e == 'object',
  Po = (e) => (oe(e) || Y(e)) && Y(e.then) && Y(e.catch),
  Na = Object.prototype.toString,
  xn = (e) => Na.call(e),
  su = (e) => xn(e).slice(8, -1),
  Ia = (e) => xn(e) === '[object Object]',
  Xr = (e) => he(e) && e !== 'NaN' && e[0] !== '-' && '' + parseInt(e, 10) === e,
  Xt = Ro(
    ',key,ref,ref_for,ref_key,onVnodeBeforeMount,onVnodeMounted,onVnodeBeforeUpdate,onVnodeUpdated,onVnodeBeforeUnmount,onVnodeUnmounted',
  ),
  Zr = (e) => {
    const t = Object.create(null);
    return (n) => t[n] || (t[n] = e(n));
  },
  ou = /-\w/g,
  Ie = Zr((e) => e.replace(ou, (t) => t.slice(1).toUpperCase())),
  iu = /\B([A-Z])/g,
  rn = Zr((e) => e.replace(iu, '-$1').toLowerCase()),
  es = Zr((e) => e.charAt(0).toUpperCase() + e.slice(1)),
  ys = Zr((e) => (e ? `on${es(e)}` : '')),
  ft = (e, t) => !Object.is(e, t),
  yn = (e, ...t) => {
    for (let n = 0; n < e.length; n++) e[n](...t);
  },
  Da = (e, t, n, r = !1) => {
    Object.defineProperty(e, t, { configurable: !0, enumerable: !1, writable: r, value: n });
  },
  ko = (e) => {
    const t = parseFloat(e);
    return isNaN(t) ? e : t;
  },
  La = (e) => {
    const t = he(e) ? Number(e) : NaN;
    return isNaN(t) ? e : t;
  };
let oi;
const ts = () =>
  oi ||
  (oi =
    typeof globalThis < 'u'
      ? globalThis
      : typeof self < 'u'
        ? self
        : typeof window < 'u'
          ? window
          : typeof global < 'u'
            ? global
            : {});
function ns(e) {
  if (G(e)) {
    const t = {};
    for (let n = 0; n < e.length; n++) {
      const r = e[n],
        s = he(r) ? uu(r) : ns(r);
      if (s) for (const o in s) t[o] = s[o];
    }
    return t;
  } else if (he(e) || oe(e)) return e;
}
const au = /;(?![^(]*\))/g,
  lu = /:([^]+)/,
  cu = /\/\*[^]*?\*\//g;
function uu(e) {
  const t = {};
  return (
    e
      .replace(cu, '')
      .split(au)
      .forEach((n) => {
        if (n) {
          const r = n.split(lu);
          r.length > 1 && (t[r[0].trim()] = r[1].trim());
        }
      }),
    t
  );
}
function rs(e) {
  let t = '';
  if (he(e)) t = e;
  else if (G(e))
    for (let n = 0; n < e.length; n++) {
      const r = rs(e[n]);
      r && (t += r + ' ');
    }
  else if (oe(e)) for (const n in e) e[n] && (t += n + ' ');
  return t.trim();
}
function fu(e) {
  if (!e) return null;
  let { class: t, style: n } = e;
  return (t && !he(t) && (e.class = rs(t)), n && (e.style = ns(n)), e);
}
const du = 'itemscope,allowfullscreen,formnovalidate,ismap,nomodule,novalidate,readonly',
  hu = Ro(du);
function Ha(e) {
  return !!e || e === '';
}
function pu(e, t) {
  if (e.length !== t.length) return !1;
  let n = !0;
  for (let r = 0; n && r < e.length; r++) n = xo(e[r], t[r]);
  return n;
}
function xo(e, t) {
  if (e === t) return !0;
  let n = si(e),
    r = si(t);
  if (n || r) return n && r ? e.getTime() === t.getTime() : !1;
  if (((n = Xe(e)), (r = Xe(t)), n || r)) return e === t;
  if (((n = G(e)), (r = G(t)), n || r)) return n && r ? pu(e, t) : !1;
  if (((n = oe(e)), (r = oe(t)), n || r)) {
    if (!n || !r) return !1;
    const s = Object.keys(e).length,
      o = Object.keys(t).length;
    if (s !== o) return !1;
    for (const i in e) {
      const a = e.hasOwnProperty(i),
        l = t.hasOwnProperty(i);
      if ((a && !l) || (!a && l) || !xo(e[i], t[i])) return !1;
    }
  }
  return String(e) === String(t);
}
const ja = (e) => !!(e && e.__v_isRef === !0),
  Un = (e) =>
    he(e)
      ? e
      : e == null
        ? ''
        : G(e) || (oe(e) && (e.toString === Na || !Y(e.toString)))
          ? ja(e)
            ? Un(e.value)
            : JSON.stringify(e, Fa, 2)
          : String(e),
  Fa = (e, t) =>
    ja(t)
      ? Fa(e, t.value)
      : mn(t)
        ? {
            [`Map(${t.size})`]: [...t.entries()].reduce(
              (n, [r, s], o) => ((n[_s(r, o) + ' =>'] = s), n),
              {},
            ),
          }
        : Ma(t)
          ? { [`Set(${t.size})`]: [...t.values()].map((n) => _s(n)) }
          : Xe(t)
            ? _s(t)
            : oe(t) && !G(t) && !Ia(t)
              ? String(t)
              : t,
  _s = (e, t = '') => {
    var n;
    return Xe(e) ? `Symbol(${(n = e.description) != null ? n : t})` : e;
  };
let Se;
class $a {
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
        Se &&
        (Se.active
          ? ((this.parent = Se), (this.index = (Se.scopes || (Se.scopes = [])).push(this) - 1))
          : ((this._active = !1), (this._warnOnRun = !1))));
  }
  get active() {
    return this._active;
  }
  pause() {
    if (this._active) {
      this._isPaused = !0;
      let t, n;
      if (this.scopes) for (t = 0, n = this.scopes.length; t < n; t++) this.scopes[t].pause();
      for (t = 0, n = this.effects.length; t < n; t++) this.effects[t].pause();
    }
  }
  resume() {
    if (this._active && this._isPaused) {
      this._isPaused = !1;
      let t, n;
      if (this.scopes) for (t = 0, n = this.scopes.length; t < n; t++) this.scopes[t].resume();
      for (t = 0, n = this.effects.length; t < n; t++) this.effects[t].resume();
    }
  }
  run(t) {
    if (this._active) {
      const n = Se;
      try {
        return ((Se = this), t());
      } finally {
        Se = n;
      }
    }
  }
  on() {
    ++this._on === 1 && ((this.prevScope = Se), (Se = this));
  }
  off() {
    if (this._on > 0 && --this._on === 0) {
      if (Se === this) Se = this.prevScope;
      else {
        let t = Se;
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
      let n, r;
      for (n = 0, r = this.effects.length; n < r; n++) this.effects[n].stop();
      for (this.effects.length = 0, n = 0, r = this.cleanups.length; n < r; n++) this.cleanups[n]();
      if (((this.cleanups.length = 0), this.scopes)) {
        for (n = 0, r = this.scopes.length; n < r; n++) this.scopes[n].stop(!0);
        this.scopes.length = 0;
      }
      if (!this.detached && this.parent && !t) {
        const s = this.parent.scopes.pop();
        s && s !== this && ((this.parent.scopes[this.index] = s), (s.index = this.index));
      }
      this.parent = void 0;
    }
  }
}
function gu(e) {
  return new $a(e);
}
function Oo() {
  return Se;
}
function mu(e, t = !1) {
  Se && Se.cleanups.push(e);
}
let pe;
const bs = new WeakSet();
class Ua {
  constructor(t) {
    ((this.fn = t),
      (this.deps = void 0),
      (this.depsTail = void 0),
      (this.flags = 5),
      (this.next = void 0),
      (this.cleanup = void 0),
      (this.scheduler = void 0),
      Se && (Se.active ? Se.effects.push(this) : (this.flags &= -2)));
  }
  pause() {
    this.flags |= 64;
  }
  resume() {
    this.flags & 64 && ((this.flags &= -65), bs.has(this) && (bs.delete(this), this.trigger()));
  }
  notify() {
    (this.flags & 2 && !(this.flags & 32)) || this.flags & 8 || Va(this);
  }
  run() {
    if (!(this.flags & 1)) return this.fn();
    ((this.flags |= 2), ii(this), Wa(this));
    const t = pe,
      n = rt;
    ((pe = this), (rt = !0));
    try {
      return this.fn();
    } finally {
      (Ka(this), (pe = t), (rt = n), (this.flags &= -3));
    }
  }
  stop() {
    if (this.flags & 1) {
      for (let t = this.deps; t; t = t.nextDep) Io(t);
      ((this.deps = this.depsTail = void 0),
        ii(this),
        this.onStop && this.onStop(),
        (this.flags &= -2));
    }
  }
  trigger() {
    this.flags & 64 ? bs.add(this) : this.scheduler ? this.scheduler() : this.runIfDirty();
  }
  runIfDirty() {
    Bs(this) && this.run();
  }
  get dirty() {
    return Bs(this);
  }
}
let Ba = 0,
  qn,
  Gn;
function Va(e, t = !1) {
  if (((e.flags |= 8), t)) {
    ((e.next = Gn), (Gn = e));
    return;
  }
  ((e.next = qn), (qn = e));
}
function Mo() {
  Ba++;
}
function No() {
  if (--Ba > 0) return;
  if (Gn) {
    let t = Gn;
    for (Gn = void 0; t; ) {
      const n = t.next;
      ((t.next = void 0), (t.flags &= -9), (t = n));
    }
  }
  let e;
  for (; qn; ) {
    let t = qn;
    for (qn = void 0; t; ) {
      const n = t.next;
      if (((t.next = void 0), (t.flags &= -9), t.flags & 1))
        try {
          t.trigger();
        } catch (r) {
          e || (e = r);
        }
      t = n;
    }
  }
  if (e) throw e;
}
function Wa(e) {
  for (let t = e.deps; t; t = t.nextDep)
    ((t.version = -1), (t.prevActiveLink = t.dep.activeLink), (t.dep.activeLink = t));
}
function Ka(e) {
  let t,
    n = e.depsTail,
    r = n;
  for (; r; ) {
    const s = r.prevDep;
    (r.version === -1 ? (r === n && (n = s), Io(r), yu(r)) : (t = r),
      (r.dep.activeLink = r.prevActiveLink),
      (r.prevActiveLink = void 0),
      (r = s));
  }
  ((e.deps = t), (e.depsTail = n));
}
function Bs(e) {
  for (let t = e.deps; t; t = t.nextDep)
    if (
      t.dep.version !== t.version ||
      (t.dep.computed && (qa(t.dep.computed) || t.dep.version !== t.version))
    )
      return !0;
  return !!e._dirty;
}
function qa(e) {
  if (
    (e.flags & 4 && !(e.flags & 16)) ||
    ((e.flags &= -17), e.globalVersion === er) ||
    ((e.globalVersion = er), !e.isSSR && e.flags & 128 && ((!e.deps && !e._dirty) || !Bs(e)))
  )
    return;
  e.flags |= 2;
  const t = e.dep,
    n = pe,
    r = rt;
  ((pe = e), (rt = !0));
  try {
    Wa(e);
    const s = e.fn(e._value);
    (t.version === 0 || ft(s, e._value)) && ((e.flags |= 128), (e._value = s), t.version++);
  } catch (s) {
    throw (t.version++, s);
  } finally {
    ((pe = n), (rt = r), Ka(e), (e.flags &= -3));
  }
}
function Io(e, t = !1) {
  const { dep: n, prevSub: r, nextSub: s } = e;
  if (
    (r && ((r.nextSub = s), (e.prevSub = void 0)),
    s && ((s.prevSub = r), (e.nextSub = void 0)),
    n.subs === e && ((n.subs = r), !r && n.computed))
  ) {
    n.computed.flags &= -5;
    for (let o = n.computed.deps; o; o = o.nextDep) Io(o, !0);
  }
  !t && !--n.sc && n.map && n.map.delete(n.key);
}
function yu(e) {
  const { prevDep: t, nextDep: n } = e;
  (t && ((t.nextDep = n), (e.prevDep = void 0)), n && ((n.prevDep = t), (e.nextDep = void 0)));
}
let rt = !0;
const Ga = [];
function ht() {
  (Ga.push(rt), (rt = !1));
}
function pt() {
  const e = Ga.pop();
  rt = e === void 0 ? !0 : e;
}
function ii(e) {
  const { cleanup: t } = e;
  if (((e.cleanup = void 0), t)) {
    const n = pe;
    pe = void 0;
    try {
      t();
    } finally {
      pe = n;
    }
  }
}
let er = 0;
class _u {
  constructor(t, n) {
    ((this.sub = t),
      (this.dep = n),
      (this.version = n.version),
      (this.nextDep = this.prevDep = this.nextSub = this.prevSub = this.prevActiveLink = void 0));
  }
}
class Do {
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
    if (!pe || !rt || pe === this.computed) return;
    let n = this.activeLink;
    if (n === void 0 || n.sub !== pe)
      ((n = this.activeLink = new _u(pe, this)),
        pe.deps
          ? ((n.prevDep = pe.depsTail), (pe.depsTail.nextDep = n), (pe.depsTail = n))
          : (pe.deps = pe.depsTail = n),
        Ja(n));
    else if (n.version === -1 && ((n.version = this.version), n.nextDep)) {
      const r = n.nextDep;
      ((r.prevDep = n.prevDep),
        n.prevDep && (n.prevDep.nextDep = r),
        (n.prevDep = pe.depsTail),
        (n.nextDep = void 0),
        (pe.depsTail.nextDep = n),
        (pe.depsTail = n),
        pe.deps === n && (pe.deps = r));
    }
    return n;
  }
  trigger(t) {
    (this.version++, er++, this.notify(t));
  }
  notify(t) {
    Mo();
    try {
      for (let n = this.subs; n; n = n.prevSub) n.sub.notify() && n.sub.dep.notify();
    } finally {
      No();
    }
  }
}
function Ja(e) {
  if ((e.dep.sc++, e.sub.flags & 4)) {
    const t = e.dep.computed;
    if (t && !e.dep.subs) {
      t.flags |= 20;
      for (let r = t.deps; r; r = r.nextDep) Ja(r);
    }
    const n = e.dep.subs;
    (n !== e && ((e.prevSub = n), n && (n.nextSub = e)), (e.dep.subs = e));
  }
}
const xr = new WeakMap(),
  Zt = Symbol(''),
  Vs = Symbol(''),
  tr = Symbol('');
function xe(e, t, n) {
  if (rt && pe) {
    let r = xr.get(e);
    r || xr.set(e, (r = new Map()));
    let s = r.get(n);
    (s || (r.set(n, (s = new Do())), (s.map = r), (s.key = n)), s.track());
  }
}
function wt(e, t, n, r, s, o) {
  const i = xr.get(e);
  if (!i) {
    er++;
    return;
  }
  const a = (l) => {
    l && l.trigger();
  };
  if ((Mo(), t === 'clear')) i.forEach(a);
  else {
    const l = G(e),
      f = l && Xr(n);
    if (l && n === 'length') {
      const c = Number(r);
      i.forEach((u, h) => {
        (h === 'length' || h === tr || (!Xe(h) && h >= c)) && a(u);
      });
    } else
      switch (((n !== void 0 || i.has(void 0)) && a(i.get(n)), f && a(i.get(tr)), t)) {
        case 'add':
          l ? f && a(i.get('length')) : (a(i.get(Zt)), mn(e) && a(i.get(Vs)));
          break;
        case 'delete':
          l || (a(i.get(Zt)), mn(e) && a(i.get(Vs)));
          break;
        case 'set':
          mn(e) && a(i.get(Zt));
          break;
      }
  }
  No();
}
function bu(e, t) {
  const n = xr.get(e);
  return n && n.get(t);
}
function ln(e) {
  const t = re(e);
  return t === e ? t : (xe(t, 'iterate', tr), qe(e) ? t : t.map(ot));
}
function ss(e) {
  return (xe((e = re(e)), 'iterate', tr), e);
}
function ut(e, t) {
  return gt(e) ? Tn(Lt(e) ? ot(t) : t) : ot(t);
}
const vu = {
  __proto__: null,
  [Symbol.iterator]() {
    return vs(this, Symbol.iterator, (e) => ut(this, e));
  },
  concat(...e) {
    return ln(this).concat(...e.map((t) => (G(t) ? ln(t) : t)));
  },
  entries() {
    return vs(this, 'entries', (e) => ((e[1] = ut(this, e[1])), e));
  },
  every(e, t) {
    return mt(this, 'every', e, t, void 0, arguments);
  },
  filter(e, t) {
    return mt(this, 'filter', e, t, (n) => n.map((r) => ut(this, r)), arguments);
  },
  find(e, t) {
    return mt(this, 'find', e, t, (n) => ut(this, n), arguments);
  },
  findIndex(e, t) {
    return mt(this, 'findIndex', e, t, void 0, arguments);
  },
  findLast(e, t) {
    return mt(this, 'findLast', e, t, (n) => ut(this, n), arguments);
  },
  findLastIndex(e, t) {
    return mt(this, 'findLastIndex', e, t, void 0, arguments);
  },
  forEach(e, t) {
    return mt(this, 'forEach', e, t, void 0, arguments);
  },
  includes(...e) {
    return ws(this, 'includes', e);
  },
  indexOf(...e) {
    return ws(this, 'indexOf', e);
  },
  join(e) {
    return ln(this).join(e);
  },
  lastIndexOf(...e) {
    return ws(this, 'lastIndexOf', e);
  },
  map(e, t) {
    return mt(this, 'map', e, t, void 0, arguments);
  },
  pop() {
    return Ln(this, 'pop');
  },
  push(...e) {
    return Ln(this, 'push', e);
  },
  reduce(e, ...t) {
    return ai(this, 'reduce', e, t);
  },
  reduceRight(e, ...t) {
    return ai(this, 'reduceRight', e, t);
  },
  shift() {
    return Ln(this, 'shift');
  },
  some(e, t) {
    return mt(this, 'some', e, t, void 0, arguments);
  },
  splice(...e) {
    return Ln(this, 'splice', e);
  },
  toReversed() {
    return ln(this).toReversed();
  },
  toSorted(e) {
    return ln(this).toSorted(e);
  },
  toSpliced(...e) {
    return ln(this).toSpliced(...e);
  },
  unshift(...e) {
    return Ln(this, 'unshift', e);
  },
  values() {
    return vs(this, 'values', (e) => ut(this, e));
  },
};
function vs(e, t, n) {
  const r = ss(e),
    s = r[t]();
  return (
    r !== e &&
      !qe(e) &&
      ((s._next = s.next),
      (s.next = () => {
        const o = s._next();
        return (o.done || (o.value = n(o.value)), o);
      })),
    s
  );
}
const wu = Array.prototype;
function mt(e, t, n, r, s, o) {
  const i = ss(e),
    a = i !== e && !qe(e),
    l = i[t];
  if (l !== wu[t]) {
    const u = l.apply(e, o);
    return a ? ot(u) : u;
  }
  let f = n;
  i !== e &&
    (a
      ? (f = function (u, h) {
          return n.call(this, ut(e, u), h, e);
        })
      : n.length > 2 &&
        (f = function (u, h) {
          return n.call(this, u, h, e);
        }));
  const c = l.call(i, f, r);
  return a && s ? s(c) : c;
}
function ai(e, t, n, r) {
  const s = ss(e),
    o = s !== e && !qe(e);
  let i = n,
    a = !1;
  s !== e &&
    (o
      ? ((a = r.length === 0),
        (i = function (f, c, u) {
          return (a && ((a = !1), (f = ut(e, f))), n.call(this, f, ut(e, c), u, e));
        }))
      : n.length > 3 &&
        (i = function (f, c, u) {
          return n.call(this, f, c, u, e);
        }));
  const l = s[t](i, ...r);
  return a ? ut(e, l) : l;
}
function ws(e, t, n) {
  const r = re(e);
  xe(r, 'iterate', tr);
  const s = r[t](...n);
  return (s === -1 || s === !1) && os(n[0]) ? ((n[0] = re(n[0])), r[t](...n)) : s;
}
function Ln(e, t, n = []) {
  (ht(), Mo());
  const r = re(e)[t].apply(e, n);
  return (No(), pt(), r);
}
const Eu = Ro('__proto__,__v_isRef,__isVue'),
  Ya = new Set(
    Object.getOwnPropertyNames(Symbol)
      .filter((e) => e !== 'arguments' && e !== 'caller')
      .map((e) => Symbol[e])
      .filter(Xe),
  );
function Tu(e) {
  Xe(e) || (e = String(e));
  const t = re(this);
  return (xe(t, 'has', e), t.hasOwnProperty(e));
}
class za {
  constructor(t = !1, n = !1) {
    ((this._isReadonly = t), (this._isShallow = n));
  }
  get(t, n, r) {
    if (n === '__v_skip') return t.__v_skip;
    const s = this._isReadonly,
      o = this._isShallow;
    if (n === '__v_isReactive') return !s;
    if (n === '__v_isReadonly') return s;
    if (n === '__v_isShallow') return o;
    if (n === '__v_raw')
      return r === (s ? (o ? Nu : el) : o ? Za : Xa).get(t) ||
        Object.getPrototypeOf(t) === Object.getPrototypeOf(r)
        ? t
        : void 0;
    const i = G(t);
    if (!s) {
      let l;
      if (i && (l = vu[n])) return l;
      if (n === 'hasOwnProperty') return Tu;
    }
    const a = Reflect.get(t, n, Ee(t) ? t : r);
    if ((Xe(n) ? Ya.has(n) : Eu(n)) || (s || xe(t, 'get', n), o)) return a;
    if (Ee(a)) {
      const l = i && Xr(n) ? a : a.value;
      return s && oe(l) ? Ks(l) : l;
    }
    return oe(a) ? (s ? Ks(a) : $t(a)) : a;
  }
}
class Qa extends za {
  constructor(t = !1) {
    super(!1, t);
  }
  set(t, n, r, s) {
    let o = t[n];
    const i = G(t) && Xr(n);
    if (!this._isShallow) {
      const f = gt(o);
      if ((!qe(r) && !gt(r) && ((o = re(o)), (r = re(r))), !i && Ee(o) && !Ee(r)))
        return (f || (o.value = r), !0);
    }
    const a = i ? Number(n) < t.length : le(t, n),
      l = Reflect.set(t, n, r, Ee(t) ? t : s);
    return (t === re(s) && l && (a ? ft(r, o) && wt(t, 'set', n, r) : wt(t, 'add', n, r)), l);
  }
  deleteProperty(t, n) {
    const r = le(t, n);
    t[n];
    const s = Reflect.deleteProperty(t, n);
    return (s && r && wt(t, 'delete', n, void 0), s);
  }
  has(t, n) {
    const r = Reflect.has(t, n);
    return ((!Xe(n) || !Ya.has(n)) && xe(t, 'has', n), r);
  }
  ownKeys(t) {
    return (xe(t, 'iterate', G(t) ? 'length' : Zt), Reflect.ownKeys(t));
  }
}
class Cu extends za {
  constructor(t = !1) {
    super(!0, t);
  }
  set(t, n) {
    return !0;
  }
  deleteProperty(t, n) {
    return !0;
  }
}
const Su = new Qa(),
  Ru = new Cu(),
  Au = new Qa(!0);
const Ws = (e) => e,
  pr = (e) => Reflect.getPrototypeOf(e);
function Pu(e, t, n) {
  return function (...r) {
    const s = this.__v_raw,
      o = re(s),
      i = mn(o),
      a = e === 'entries' || (e === Symbol.iterator && i),
      l = e === 'keys' && i,
      f = s[e](...r),
      c = n ? Ws : t ? Tn : ot;
    return (
      !t && xe(o, 'iterate', l ? Vs : Zt),
      Ae(Object.create(f), {
        next() {
          const { value: u, done: h } = f.next();
          return h ? { value: u, done: h } : { value: a ? [c(u[0]), c(u[1])] : c(u), done: h };
        },
      })
    );
  };
}
function gr(e) {
  return function (...t) {
    return e === 'delete' ? !1 : e === 'clear' ? void 0 : this;
  };
}
function ku(e, t) {
  const n = {
    get(s) {
      const o = this.__v_raw,
        i = re(o),
        a = re(s);
      e || (ft(s, a) && xe(i, 'get', s), xe(i, 'get', a));
      const { has: l } = pr(i),
        f = t ? Ws : e ? Tn : ot;
      if (l.call(i, s)) return f(o.get(s));
      if (l.call(i, a)) return f(o.get(a));
      o !== i && o.get(s);
    },
    get size() {
      const s = this.__v_raw;
      return (!e && xe(re(s), 'iterate', Zt), s.size);
    },
    has(s) {
      const o = this.__v_raw,
        i = re(o),
        a = re(s);
      return (
        e || (ft(s, a) && xe(i, 'has', s), xe(i, 'has', a)),
        s === a ? o.has(s) : o.has(s) || o.has(a)
      );
    },
    forEach(s, o) {
      const i = this,
        a = i.__v_raw,
        l = re(a),
        f = t ? Ws : e ? Tn : ot;
      return (!e && xe(l, 'iterate', Zt), a.forEach((c, u) => s.call(o, f(c), f(u), i)));
    },
  };
  return (
    Ae(
      n,
      e
        ? { add: gr('add'), set: gr('set'), delete: gr('delete'), clear: gr('clear') }
        : {
            add(s) {
              const o = re(this),
                i = pr(o),
                a = re(s),
                l = !t && !qe(s) && !gt(s) ? a : s;
              return (
                i.has.call(o, l) ||
                  (ft(s, l) && i.has.call(o, s)) ||
                  (ft(a, l) && i.has.call(o, a)) ||
                  (o.add(l), wt(o, 'add', l, l)),
                this
              );
            },
            set(s, o) {
              !t && !qe(o) && !gt(o) && (o = re(o));
              const i = re(this),
                { has: a, get: l } = pr(i);
              let f = a.call(i, s);
              f || ((s = re(s)), (f = a.call(i, s)));
              const c = l.call(i, s);
              return (i.set(s, o), f ? ft(o, c) && wt(i, 'set', s, o) : wt(i, 'add', s, o), this);
            },
            delete(s) {
              const o = re(this),
                { has: i, get: a } = pr(o);
              let l = i.call(o, s);
              (l || ((s = re(s)), (l = i.call(o, s))), a && a.call(o, s));
              const f = o.delete(s);
              return (l && wt(o, 'delete', s, void 0), f);
            },
            clear() {
              const s = re(this),
                o = s.size !== 0,
                i = s.clear();
              return (o && wt(s, 'clear', void 0, void 0), i);
            },
          },
    ),
    ['keys', 'values', 'entries', Symbol.iterator].forEach((s) => {
      n[s] = Pu(s, e, t);
    }),
    n
  );
}
function Lo(e, t) {
  const n = ku(e, t);
  return (r, s, o) =>
    s === '__v_isReactive'
      ? !e
      : s === '__v_isReadonly'
        ? e
        : s === '__v_raw'
          ? r
          : Reflect.get(le(n, s) && s in r ? n : r, s, o);
}
const xu = { get: Lo(!1, !1) },
  Ou = { get: Lo(!1, !0) },
  Mu = { get: Lo(!0, !1) };
const Xa = new WeakMap(),
  Za = new WeakMap(),
  el = new WeakMap(),
  Nu = new WeakMap();
function Iu(e) {
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
function $t(e) {
  return gt(e) ? e : Ho(e, !1, Su, xu, Xa);
}
function Tt(e) {
  return Ho(e, !1, Au, Ou, Za);
}
function Ks(e) {
  return Ho(e, !0, Ru, Mu, el);
}
function Ho(e, t, n, r, s) {
  if (!oe(e) || (e.__v_raw && !(t && e.__v_isReactive)) || e.__v_skip || !Object.isExtensible(e))
    return e;
  const o = s.get(e);
  if (o) return o;
  const i = Iu(su(e));
  if (i === 0) return e;
  const a = new Proxy(e, i === 2 ? r : n);
  return (s.set(e, a), a);
}
function Lt(e) {
  return gt(e) ? Lt(e.__v_raw) : !!(e && e.__v_isReactive);
}
function gt(e) {
  return !!(e && e.__v_isReadonly);
}
function qe(e) {
  return !!(e && e.__v_isShallow);
}
function os(e) {
  return e ? !!e.__v_raw : !1;
}
function re(e) {
  const t = e && e.__v_raw;
  return t ? re(t) : e;
}
function Du(e) {
  return (!le(e, '__v_skip') && Object.isExtensible(e) && Da(e, '__v_skip', !0), e);
}
const ot = (e) => (oe(e) ? $t(e) : e),
  Tn = (e) => (oe(e) ? Ks(e) : e);
function Ee(e) {
  return e ? e.__v_isRef === !0 : !1;
}
function st(e) {
  return tl(e, !1);
}
function Rt(e) {
  return tl(e, !0);
}
function tl(e, t) {
  return Ee(e) ? e : new Lu(e, t);
}
class Lu {
  constructor(t, n) {
    ((this.dep = new Do()),
      (this.__v_isRef = !0),
      (this.__v_isShallow = !1),
      (this._rawValue = n ? t : re(t)),
      (this._value = n ? t : ot(t)),
      (this.__v_isShallow = n));
  }
  get value() {
    return (this.dep.track(), this._value);
  }
  set value(t) {
    const n = this._rawValue,
      r = this.__v_isShallow || qe(t) || gt(t);
    ((t = r ? t : re(t)),
      ft(t, n) && ((this._rawValue = t), (this._value = r ? t : ot(t)), this.dep.trigger()));
  }
}
function ee(e) {
  return Ee(e) ? e.value : e;
}
function nl(e) {
  return Y(e) ? e() : ee(e);
}
const Hu = {
  get: (e, t, n) => (t === '__v_raw' ? e : ee(Reflect.get(e, t, n))),
  set: (e, t, n, r) => {
    const s = e[t];
    return Ee(s) && !Ee(n) ? ((s.value = n), !0) : Reflect.set(e, t, n, r);
  },
};
function rl(e) {
  return Lt(e) ? e : new Proxy(e, Hu);
}
class ju {
  constructor(t, n, r) {
    ((this._object = t),
      (this._defaultValue = r),
      (this.__v_isRef = !0),
      (this._value = void 0),
      (this._key = Xe(n) ? n : String(n)),
      (this._raw = re(t)));
    let s = !0,
      o = t;
    if (!G(t) || Xe(this._key) || !Xr(this._key))
      do s = !os(o) || qe(o);
      while (s && (o = o.__v_raw));
    this._shallow = s;
  }
  get value() {
    let t = this._object[this._key];
    return (this._shallow && (t = ee(t)), (this._value = t === void 0 ? this._defaultValue : t));
  }
  set value(t) {
    if (this._shallow && Ee(this._raw[this._key])) {
      const n = this._object[this._key];
      if (Ee(n)) {
        n.value = t;
        return;
      }
    }
    this._object[this._key] = t;
  }
  get dep() {
    return bu(this._raw, this._key);
  }
}
class Fu {
  constructor(t) {
    ((this._getter = t), (this.__v_isRef = !0), (this.__v_isReadonly = !0), (this._value = void 0));
  }
  get value() {
    return (this._value = this._getter());
  }
}
function sl(e, t, n) {
  return Ee(e) ? e : Y(e) ? new Fu(e) : oe(e) && arguments.length > 1 ? $u(e, t, n) : st(e);
}
function $u(e, t, n) {
  return new ju(e, t, n);
}
class Uu {
  constructor(t, n, r) {
    ((this.fn = t),
      (this.setter = n),
      (this._value = void 0),
      (this.dep = new Do(this)),
      (this.__v_isRef = !0),
      (this.deps = void 0),
      (this.depsTail = void 0),
      (this.flags = 16),
      (this.globalVersion = er - 1),
      (this.next = void 0),
      (this.effect = this),
      (this.__v_isReadonly = !n),
      (this.isSSR = r));
  }
  notify() {
    if (((this.flags |= 16), !(this.flags & 8) && pe !== this)) return (Va(this, !0), !0);
  }
  get value() {
    const t = this.dep.track();
    return (qa(this), t && (t.version = this.dep.version), this._value);
  }
  set value(t) {
    this.setter && this.setter(t);
  }
}
function Bu(e, t, n = !1) {
  let r, s;
  return (Y(e) ? (r = e) : ((r = e.get), (s = e.set)), new Uu(r, s, n));
}
const mr = {},
  Or = new WeakMap();
let Gt;
function Vu(e, t = !1, n = Gt) {
  if (n) {
    let r = Or.get(n);
    (r || Or.set(n, (r = [])), r.push(e));
  }
}
function Wu(e, t, n = de) {
  const { immediate: r, deep: s, once: o, scheduler: i, augmentJob: a, call: l } = n,
    f = (_) => (s ? _ : qe(_) || s === !1 || s === 0 ? Et(_, 1) : Et(_));
  let c,
    u,
    h,
    d,
    p = !1,
    m = !1;
  if (
    (Ee(e)
      ? ((u = () => e.value), (p = qe(e)))
      : Lt(e)
        ? ((u = () => f(e)), (p = !0))
        : G(e)
          ? ((m = !0),
            (p = e.some((_) => Lt(_) || qe(_))),
            (u = () =>
              e.map((_) => {
                if (Ee(_)) return _.value;
                if (Lt(_)) return f(_);
                if (Y(_)) return l ? l(_, 2) : _();
              })))
          : Y(e)
            ? t
              ? (u = l ? () => l(e, 2) : e)
              : (u = () => {
                  if (h) {
                    ht();
                    try {
                      h();
                    } finally {
                      pt();
                    }
                  }
                  const _ = Gt;
                  Gt = c;
                  try {
                    return l ? l(e, 3, [d]) : e(d);
                  } finally {
                    Gt = _;
                  }
                })
            : (u = dt),
    t && s)
  ) {
    const _ = u,
      v = s === !0 ? 1 / 0 : s;
    u = () => Et(_(), v);
  }
  const C = Oo(),
    E = () => {
      (c.stop(), C && C.active && Ao(C.effects, c));
    };
  if (o && t) {
    const _ = t;
    t = (...v) => {
      const R = _(...v);
      return (E(), R);
    };
  }
  let w = m ? new Array(e.length).fill(mr) : mr;
  const y = (_) => {
    if (!(!(c.flags & 1) || (!c.dirty && !_)))
      if (t) {
        const v = c.run();
        if (_ || s || p || (m ? v.some((R, S) => ft(R, w[S])) : ft(v, w))) {
          h && h();
          const R = Gt;
          Gt = c;
          try {
            const S = [v, w === mr ? void 0 : m && w[0] === mr ? [] : w, d];
            ((w = v), l ? l(t, 3, S) : t(...S));
          } finally {
            Gt = R;
          }
        }
      } else c.run();
  };
  return (
    a && a(y),
    (c = new Ua(u)),
    (c.scheduler = i ? () => i(y, !1) : y),
    (d = (_) => Vu(_, !1, c)),
    (h = c.onStop =
      () => {
        const _ = Or.get(c);
        if (_) {
          if (l) l(_, 4);
          else for (const v of _) v();
          Or.delete(c);
        }
      }),
    t ? (r ? y(!0) : (w = c.run())) : i ? i(y.bind(null, !0), !0) : c.run(),
    (E.pause = c.pause.bind(c)),
    (E.resume = c.resume.bind(c)),
    (E.stop = E),
    E
  );
}
function Et(e, t = 1 / 0, n) {
  if (t <= 0 || !oe(e) || e.__v_skip || ((n = n || new Map()), (n.get(e) || 0) >= t)) return e;
  if ((n.set(e, t), t--, Ee(e))) Et(e.value, t, n);
  else if (G(e)) for (let r = 0; r < e.length; r++) Et(e[r], t, n);
  else if (Ma(e) || mn(e))
    e.forEach((r) => {
      Et(r, t, n);
    });
  else if (Ia(e)) {
    for (const r in e) Et(e[r], t, n);
    for (const r of Object.getOwnPropertySymbols(e))
      Object.prototype.propertyIsEnumerable.call(e, r) && Et(e[r], t, n);
  }
  return e;
}
function dr(e, t, n, r) {
  try {
    return r ? e(...r) : e();
  } catch (s) {
    On(s, t, n);
  }
}
function Ze(e, t, n, r) {
  if (Y(e)) {
    const s = dr(e, t, n, r);
    return (
      s &&
        Po(s) &&
        s.catch((o) => {
          On(o, t, n);
        }),
      s
    );
  }
  if (G(e)) {
    const s = [];
    for (let o = 0; o < e.length; o++) s.push(Ze(e[o], t, n, r));
    return s;
  }
}
function On(e, t, n, r = !0) {
  const s = t ? t.vnode : null,
    { errorHandler: o, throwUnhandledErrorInProduction: i } = (t && t.appContext.config) || de;
  if (t) {
    let a = t.parent;
    const l = t.proxy,
      f = `https://vuejs.org/error-reference/#runtime-${n}`;
    for (; a; ) {
      const c = a.ec;
      if (c) {
        for (let u = 0; u < c.length; u++) if (c[u](e, l, f) === !1) return;
      }
      a = a.parent;
    }
    if (o) {
      (ht(), dr(o, null, 10, [e, l, f]), pt());
      return;
    }
  }
  Ku(e, n, s, r, i);
}
function Ku(e, t, n, r = !0, s = !1) {
  if (s) throw e;
  console.error(e);
}
const Ne = [];
let lt = -1;
const _n = [];
let It = null,
  un = 0;
const ol = Promise.resolve();
let Mr = null;
function Cn(e) {
  const t = Mr || ol;
  return e ? t.then(this ? e.bind(this) : e) : t;
}
function qu(e) {
  let t = lt + 1,
    n = Ne.length;
  for (; t < n; ) {
    const r = (t + n) >>> 1,
      s = Ne[r],
      o = rr(s);
    o < e || (o === e && s.flags & 2) ? (t = r + 1) : (n = r);
  }
  return t;
}
function jo(e) {
  if (!(e.flags & 1)) {
    const t = rr(e),
      n = Ne[Ne.length - 1];
    (!n || (!(e.flags & 2) && t >= rr(n)) ? Ne.push(e) : Ne.splice(qu(t), 0, e),
      (e.flags |= 1),
      il());
  }
}
function il() {
  Mr || (Mr = ol.then(al));
}
function nr(e) {
  (G(e)
    ? _n.push(...e)
    : It && e.id === -1
      ? It.splice(un + 1, 0, e)
      : e.flags & 1 || (_n.push(e), (e.flags |= 1)),
    il());
}
function li(e, t, n = lt + 1) {
  for (; n < Ne.length; n++) {
    const r = Ne[n];
    if (r && r.flags & 2) {
      if (e && r.id !== e.uid) continue;
      (Ne.splice(n, 1), n--, r.flags & 4 && (r.flags &= -2), r(), r.flags & 4 || (r.flags &= -2));
    }
  }
}
function Nr(e) {
  if (_n.length) {
    const t = [...new Set(_n)].sort((n, r) => rr(n) - rr(r));
    if (((_n.length = 0), It)) {
      It.push(...t);
      return;
    }
    for (It = t, un = 0; un < It.length; un++) {
      const n = It[un];
      (n.flags & 4 && (n.flags &= -2), n.flags & 8 || n(), (n.flags &= -2));
    }
    ((It = null), (un = 0));
  }
}
const rr = (e) => (e.id == null ? (e.flags & 2 ? -1 : 1 / 0) : e.id);
function al(e) {
  try {
    for (lt = 0; lt < Ne.length; lt++) {
      const t = Ne[lt];
      t &&
        !(t.flags & 8) &&
        (t.flags & 4 && (t.flags &= -2), dr(t, t.i, t.i ? 15 : 14), t.flags & 4 || (t.flags &= -2));
    }
  } finally {
    for (; lt < Ne.length; lt++) {
      const t = Ne[lt];
      t && (t.flags &= -2);
    }
    ((lt = -1), (Ne.length = 0), Nr(), (Mr = null), (Ne.length || _n.length) && al());
  }
}
let Ke = null,
  ll = null;
function Ir(e) {
  const t = Ke;
  return ((Ke = e), (ll = (e && e.type.__scopeId) || null), t);
}
function Dr(e, t = Ke, n) {
  if (!t || e._n) return e;
  const r = (...s) => {
    r._d && Ur(-1);
    const o = Ir(t);
    let i;
    try {
      i = e(...s);
    } finally {
      (Ir(o), r._d && Ur(1));
    }
    return i;
  };
  return ((r._n = !0), (r._c = !0), (r._d = !0), r);
}
function Fy(e, t) {
  if (Ke === null) return e;
  const n = fs(Ke),
    r = e.dirs || (e.dirs = []);
  for (let s = 0; s < t.length; s++) {
    let [o, i, a, l = de] = t[s];
    o &&
      (Y(o) && (o = { mounted: o, updated: o }),
      o.deep && Et(i),
      r.push({ dir: o, instance: n, value: i, oldValue: void 0, arg: a, modifiers: l }));
  }
  return e;
}
function ct(e, t, n, r) {
  const s = e.dirs,
    o = t && t.dirs;
  for (let i = 0; i < s.length; i++) {
    const a = s[i];
    o && (a.oldValue = o[i].value);
    let l = a.dir[r];
    l && (ht(), Ze(l, n, 8, [e.el, a, e, t]), pt());
  }
}
function bn(e, t) {
  if (ke) {
    let n = ke.provides;
    const r = ke.parent && ke.parent.provides;
    (r === n && (n = ke.provides = Object.create(r)), (n[e] = t));
  }
}
function $e(e, t, n = !1) {
  const r = Pt();
  if (r || en) {
    let s = en
      ? en._context.provides
      : r
        ? r.parent == null || r.ce
          ? r.vnode.appContext && r.vnode.appContext.provides
          : r.parent.provides
        : void 0;
    if (s && e in s) return s[e];
    if (arguments.length > 1) return n && Y(t) ? t.call(r && r.proxy) : t;
  }
}
function Fo() {
  return !!(Pt() || en);
}
const Gu = Symbol.for('v-scx'),
  Ju = () => $e(Gu);
function Yu(e, t) {
  return $o(e, null, t);
}
function Ht(e, t, n) {
  return $o(e, t, n);
}
function $o(e, t, n = de) {
  const { immediate: r, deep: s, flush: o, once: i } = n,
    a = Ae({}, n),
    l = (t && r) || (!t && o !== 'post');
  let f;
  if (nn) {
    if (o === 'sync') {
      const d = Ju();
      f = d.__watcherHandles || (d.__watcherHandles = []);
    } else if (!l) {
      const d = () => {};
      return ((d.stop = dt), (d.resume = dt), (d.pause = dt), d);
    }
  }
  const c = ke;
  a.call = (d, p, m) => Ze(d, c, p, m);
  let u = !1;
  (o === 'post'
    ? (a.scheduler = (d) => {
        we(d, c && c.suspense);
      })
    : o !== 'sync' &&
      ((u = !0),
      (a.scheduler = (d, p) => {
        p ? d() : jo(d);
      })),
    (a.augmentJob = (d) => {
      (t && (d.flags |= 4), u && ((d.flags |= 2), c && ((d.id = c.uid), (d.i = c))));
    }));
  const h = Wu(e, t, a);
  return (nn && (f ? f.push(h) : l && h()), h);
}
function zu(e, t, n) {
  const r = this.proxy,
    s = he(e) ? (e.includes('.') ? cl(r, e) : () => r[e]) : e.bind(r, r);
  let o;
  Y(t) ? (o = t) : ((o = t.handler), (n = t));
  const i = Nn(this),
    a = $o(s, o.bind(r), n);
  return (i(), a);
}
function cl(e, t) {
  const n = t.split('.');
  return () => {
    let r = e;
    for (let s = 0; s < n.length && r; s++) r = r[n[s]];
    return r;
  };
}
const Nt = new WeakMap(),
  ul = Symbol('_vte'),
  fl = (e) => e.__isTeleport,
  Yt = (e) => e && (e.disabled || e.disabled === ''),
  Qu = (e) => e && (e.defer || e.defer === ''),
  ci = (e) => typeof SVGElement < 'u' && e instanceof SVGElement,
  ui = (e) => typeof MathMLElement == 'function' && e instanceof MathMLElement,
  qs = (e, t) => {
    const n = e && e.to;
    return he(n) ? (t ? t(n) : null) : n;
  },
  Xu = {
    name: 'Teleport',
    __isTeleport: !0,
    process(e, t, n, r, s, o, i, a, l, f) {
      const {
          mc: c,
          pc: u,
          pbc: h,
          o: { insert: d, querySelector: p, createText: m, createComment: C, parentNode: E },
        } = f,
        w = Yt(t.props);
      let { dynamicChildren: y } = t;
      const _ = (S, I, k) => {
          S.shapeFlag & 16 && c(S.children, I, k, s, o, i, a, l);
        },
        v = (S = t) => {
          const I = Yt(S.props),
            k = (S.target = qs(S.props, p)),
            D = Gs(k, S, m, d);
          k &&
            (i !== 'svg' && ci(k) ? (i = 'svg') : i !== 'mathml' && ui(k) && (i = 'mathml'),
            s && s.isCE && (s.ce._teleportTargets || (s.ce._teleportTargets = new Set())).add(k),
            I || (_(S, k, D), Bn(S, !1)));
        },
        R = (S) => {
          const I = () => {
            if (Nt.get(S) === I) {
              if ((Nt.delete(S), Yt(S.props))) {
                const k = E(S.el) || n;
                (_(S, k, S.anchor), Bn(S, !0));
              }
              v(S);
            }
          };
          (Nt.set(S, I), we(I, o));
        };
      if (e == null) {
        const S = (t.el = m('')),
          I = (t.anchor = m(''));
        if ((d(S, n, r), d(I, n, r), Qu(t.props) || (o && o.pendingBranch))) {
          R(t);
          return;
        }
        (w && (_(t, n, I), Bn(t, !0)), v());
      } else {
        t.el = e.el;
        const S = (t.anchor = e.anchor),
          I = Nt.get(e);
        if (I) {
          ((I.flags |= 8), Nt.delete(e), R(t));
          return;
        }
        t.targetStart = e.targetStart;
        const k = (t.target = e.target),
          D = (t.targetAnchor = e.targetAnchor),
          F = Yt(e.props),
          N = F ? n : k,
          W = F ? S : D;
        if (
          (i === 'svg' || ci(k) ? (i = 'svg') : (i === 'mathml' || ui(k)) && (i = 'mathml'),
          y
            ? (h(e.dynamicChildren, y, N, s, o, i, a), Ko(e, t, !0))
            : l || u(e, t, N, W, s, o, i, a, !1),
          w)
        )
          F
            ? t.props && e.props && t.props.to !== e.props.to && (t.props.to = e.props.to)
            : yr(t, n, S, f, 1);
        else if ((t.props && t.props.to) !== (e.props && e.props.to)) {
          const X = qs(t.props, p);
          X && ((t.target = X), yr(t, X, null, f, 0));
        } else F && yr(t, k, D, f, 1);
        Bn(t, w);
      }
    },
    remove(e, t, n, { um: r, o: { remove: s } }, o) {
      const {
          shapeFlag: i,
          children: a,
          anchor: l,
          targetStart: f,
          targetAnchor: c,
          target: u,
          props: h,
        } = e,
        d = Yt(h),
        p = o || !d,
        m = Nt.get(e);
      if (
        (m && ((m.flags |= 8), Nt.delete(e)),
        u && (s(f), s(c)),
        o && s(l),
        !m && (d || u) && i & 16)
      )
        for (let C = 0; C < a.length; C++) {
          const E = a[C];
          r(E, t, n, p, !!E.dynamicChildren);
        }
    },
    move: yr,
    hydrate: Zu,
  };
function yr(e, t, n, { o: { insert: r }, m: s }, o = 2) {
  o === 0 && r(e.targetAnchor, t, n);
  const { el: i, anchor: a, shapeFlag: l, children: f, props: c } = e,
    u = o === 2;
  if ((u && r(i, t, n), !Nt.has(e) && (!u || Yt(c)) && l & 16))
    for (let h = 0; h < f.length; h++) s(f[h], t, n, 2);
  u && r(a, t, n);
}
function Zu(
  e,
  t,
  n,
  r,
  s,
  o,
  { o: { nextSibling: i, parentNode: a, querySelector: l, insert: f, createText: c } },
  u,
) {
  function h(C, E) {
    let w = E;
    for (; w; ) {
      if (w && w.nodeType === 8) {
        if (w.data === 'teleport start anchor') t.targetStart = w;
        else if (w.data === 'teleport anchor') {
          ((t.targetAnchor = w), (C._lpa = t.targetAnchor && i(t.targetAnchor)));
          break;
        }
      }
      w = i(w);
    }
  }
  function d(C, E) {
    E.anchor = u(i(C), E, a(C), n, r, s, o);
  }
  const p = (t.target = qs(t.props, l)),
    m = Yt(t.props);
  if (p) {
    const C = p._lpa || p.firstChild;
    (t.shapeFlag & 16 &&
      (m
        ? (d(e, t), h(p, C), t.targetAnchor || Gs(p, t, c, f, a(e) === p ? e : null))
        : ((t.anchor = i(e)),
          h(p, C),
          t.targetAnchor || Gs(p, t, c, f),
          u(C && i(C), t, p, n, r, s, o))),
      Bn(t, m));
  } else m && t.shapeFlag & 16 && (d(e, t), (t.targetStart = e), (t.targetAnchor = i(e)));
  return t.anchor && i(t.anchor);
}
const $y = Xu;
function Bn(e, t) {
  const n = e.ctx;
  if (n && n.ut) {
    let r, s;
    for (
      t ? ((r = e.el), (s = e.anchor)) : ((r = e.targetStart), (s = e.targetAnchor));
      r && r !== s;
    )
      (r.nodeType === 1 && r.setAttribute('data-v-owner', n.uid), (r = r.nextSibling));
    n.ut();
  }
}
function Gs(e, t, n, r, s = null) {
  const o = (t.targetStart = n('')),
    i = (t.targetAnchor = n(''));
  return ((o[ul] = i), e && (r(o, e, s), r(i, e, s)), i);
}
const Qe = Symbol('_leaveCb'),
  Hn = Symbol('_enterCb');
function ef() {
  const e = { isMounted: !1, isLeaving: !1, isUnmounting: !1, leavingVNodes: new Map() };
  return (
    as(() => {
      e.isMounted = !0;
    }),
    Mn(() => {
      e.isUnmounting = !0;
    }),
    e
  );
}
const Je = [Function, Array],
  dl = {
    mode: String,
    appear: Boolean,
    persisted: Boolean,
    onBeforeEnter: Je,
    onEnter: Je,
    onAfterEnter: Je,
    onEnterCancelled: Je,
    onBeforeLeave: Je,
    onLeave: Je,
    onAfterLeave: Je,
    onLeaveCancelled: Je,
    onBeforeAppear: Je,
    onAppear: Je,
    onAfterAppear: Je,
    onAppearCancelled: Je,
  },
  hl = (e) => {
    const t = e.subTree;
    return t.component ? hl(t.component) : t;
  },
  tf = {
    name: 'BaseTransition',
    props: dl,
    setup(e, { slots: t }) {
      const n = Pt(),
        r = ef();
      return () => {
        const s = t.default && ml(t.default(), !0),
          o = s && s.length ? pl(s) : n.subTree ? Zf() : void 0;
        if (!o) return;
        const i = re(e),
          { mode: a } = i;
        if (r.isLeaving) return Es(o);
        const l = fi(o);
        if (!l) return Es(o);
        let f = Js(l, i, r, n, (u) => (f = u));
        l.type !== Re && Sn(l, f);
        let c = n.subTree && fi(n.subTree);
        if (c && c.type !== Re && !nt(c, l) && hl(n).type !== Re) {
          let u = Js(c, i, r, n);
          if ((Sn(c, u), a === 'out-in' && l.type !== Re))
            return (
              (r.isLeaving = !0),
              (u.afterLeave = () => {
                ((r.isLeaving = !1),
                  n.job.flags & 8 || n.update(),
                  delete u.afterLeave,
                  (c = void 0));
              }),
              Es(o)
            );
          a === 'in-out' && l.type !== Re
            ? (u.delayLeave = (h, d, p) => {
                const m = gl(r, c);
                ((m[String(c.key)] = c),
                  (h[Qe] = () => {
                    (d(), (h[Qe] = void 0), delete f.delayedLeave, (c = void 0));
                  }),
                  (f.delayedLeave = () => {
                    (p(), delete f.delayedLeave, (c = void 0));
                  }));
              })
            : (c = void 0);
        } else c && (c = void 0);
        return o;
      };
    },
  };
function pl(e) {
  let t = e[0];
  if (e.length > 1) {
    for (const n of e)
      if (n.type !== Re) {
        t = n;
        break;
      }
  }
  return t;
}
const nf = tf;
function gl(e, t) {
  const { leavingVNodes: n } = e;
  let r = n.get(t.type);
  return (r || ((r = Object.create(null)), n.set(t.type, r)), r);
}
function Js(e, t, n, r, s) {
  const {
      appear: o,
      mode: i,
      persisted: a = !1,
      onBeforeEnter: l,
      onEnter: f,
      onAfterEnter: c,
      onEnterCancelled: u,
      onBeforeLeave: h,
      onLeave: d,
      onAfterLeave: p,
      onLeaveCancelled: m,
      onBeforeAppear: C,
      onAppear: E,
      onAfterAppear: w,
      onAppearCancelled: y,
    } = t,
    _ = String(e.key),
    v = gl(n, e),
    R = (k, D) => {
      k && Ze(k, r, 9, D);
    },
    S = (k, D) => {
      const F = D[1];
      (R(k, D), G(k) ? k.every((N) => N.length <= 1) && F() : k.length <= 1 && F());
    },
    I = {
      mode: i,
      persisted: a,
      beforeEnter(k) {
        let D = l;
        if (!n.isMounted)
          if (o) D = C || l;
          else return;
        k[Qe] && k[Qe](!0);
        const F = v[_];
        (F && nt(e, F) && F.el[Qe] && F.el[Qe](), R(D, [k]));
      },
      enter(k) {
        if (v[_] === e) return;
        let D = f,
          F = c,
          N = u;
        if (!n.isMounted)
          if (o) ((D = E || f), (F = w || c), (N = y || u));
          else return;
        let W = !1;
        k[Hn] = (se) => {
          W ||
            ((W = !0),
            se ? R(N, [k]) : R(F, [k]),
            I.delayedLeave && I.delayedLeave(),
            (k[Hn] = void 0));
        };
        const X = k[Hn].bind(null, !1);
        D ? S(D, [k, X]) : X();
      },
      leave(k, D) {
        const F = String(e.key);
        if ((k[Hn] && k[Hn](!0), n.isUnmounting)) return D();
        R(h, [k]);
        let N = !1;
        k[Qe] = (X) => {
          N ||
            ((N = !0), D(), X ? R(m, [k]) : R(p, [k]), (k[Qe] = void 0), v[F] === e && delete v[F]);
        };
        const W = k[Qe].bind(null, !1);
        ((v[F] = e), d ? S(d, [k, W]) : W());
      },
      clone(k) {
        const D = Js(k, t, n, r, s);
        return (s && s(D), D);
      },
    };
  return I;
}
function Es(e) {
  if (hr(e)) return ((e = At(e)), (e.children = null), e);
}
function fi(e) {
  if (!hr(e)) return fl(e.type) && e.children ? pl(e.children) : e;
  if (e.component) return e.component.subTree;
  const { shapeFlag: t, children: n } = e;
  if (n) {
    if (t & 16) return n[0];
    if (t & 32 && Y(n.default)) return n.default();
  }
}
function Sn(e, t) {
  e.shapeFlag & 6 && e.component
    ? ((e.transition = t), Sn(e.component.subTree, t))
    : e.shapeFlag & 128
      ? ((e.ssContent.transition = t.clone(e.ssContent)),
        (e.ssFallback.transition = t.clone(e.ssFallback)))
      : (e.transition = t);
}
function ml(e, t = !1, n) {
  let r = [],
    s = 0;
  for (let o = 0; o < e.length; o++) {
    let i = e[o];
    const a = n == null ? i.key : String(n) + String(i.key != null ? i.key : o);
    i.type === He
      ? (i.patchFlag & 128 && s++, (r = r.concat(ml(i.children, t, a))))
      : (t || i.type !== Re) && r.push(a != null ? At(i, { key: a }) : i);
  }
  if (s > 1) for (let o = 0; o < r.length; o++) r[o].patchFlag = -2;
  return r;
}
function sn(e, t) {
  return Y(e) ? Ae({ name: e.name }, t, { setup: e }) : e;
}
function Uo(e) {
  e.ids = [e.ids[0] + e.ids[2]++ + '-', 0, 0];
}
function di(e, t) {
  let n;
  return !!((n = Object.getOwnPropertyDescriptor(e, t)) && !n.configurable);
}
const Lr = new WeakMap();
function vn(e, t, n, r, s = !1) {
  if (G(e)) {
    e.forEach((m, C) => vn(m, t && (G(t) ? t[C] : t), n, r, s));
    return;
  }
  if (jt(r) && !s) {
    r.shapeFlag & 512 &&
      r.type.__asyncResolved &&
      r.component.subTree.component &&
      vn(e, t, n, r.component.subTree);
    return;
  }
  const o = r.shapeFlag & 4 ? fs(r.component) : r.el,
    i = s ? null : o,
    { i: a, r: l } = e,
    f = t && t.r,
    c = a.refs === de ? (a.refs = {}) : a.refs,
    u = a.setupState,
    h = re(u),
    d = u === de ? Oa : (m) => (di(c, m) ? !1 : le(h, m)),
    p = (m, C) => !(C && di(c, C));
  if (f != null && f !== l) {
    if ((hi(t), he(f))) ((c[f] = null), d(f) && (u[f] = null));
    else if (Ee(f)) {
      const m = t;
      (p(f, m.k) && (f.value = null), m.k && (c[m.k] = null));
    }
  }
  if (Y(l)) {
    ht();
    try {
      dr(l, a, 12, [i, c]);
    } finally {
      pt();
    }
  } else {
    const m = he(l),
      C = Ee(l);
    if (m || C) {
      const E = () => {
        if (e.f) {
          const w = m ? (d(l) ? u[l] : c[l]) : p() || !e.k ? l.value : c[e.k];
          if (s) G(w) && Ao(w, o);
          else if (G(w)) w.includes(o) || w.push(o);
          else if (m) ((c[l] = [o]), d(l) && (u[l] = c[l]));
          else {
            const y = [o];
            (p(l, e.k) && (l.value = y), e.k && (c[e.k] = y));
          }
        } else
          m
            ? ((c[l] = i), d(l) && (u[l] = i))
            : C && (p(l, e.k) && (l.value = i), e.k && (c[e.k] = i));
      };
      if (i) {
        const w = () => {
          (E(), Lr.delete(e));
        };
        ((w.id = -1), Lr.set(e, w), we(w, n));
      } else (hi(e), E());
    }
  }
}
function hi(e) {
  const t = Lr.get(e);
  t && ((t.flags |= 8), Lr.delete(e));
}
let pi = !1;
const cn = () => {
    pi || (console.error('Hydration completed but contains mismatches.'), (pi = !0));
  },
  rf = (e) => e.namespaceURI.includes('svg') && e.tagName !== 'foreignObject',
  sf = (e) => e.namespaceURI.includes('MathML'),
  _r = (e) => {
    if (e.nodeType === 1) {
      if (rf(e)) return 'svg';
      if (sf(e)) return 'mathml';
    }
  },
  hn = (e) => e.nodeType === 8;
function of(e) {
  const {
      mt: t,
      p: n,
      o: {
        patchProp: r,
        createText: s,
        nextSibling: o,
        parentNode: i,
        remove: a,
        insert: l,
        createComment: f,
      },
    } = e,
    c = (y, _) => {
      if (!_.hasChildNodes()) {
        (n(null, y, _), Nr(), (_._vnode = y));
        return;
      }
      (u(_.firstChild, y, null, null, null), Nr(), (_._vnode = y));
    },
    u = (y, _, v, R, S, I = !1) => {
      I = I || !!_.dynamicChildren;
      const k = hn(y) && y.data === '[',
        D = () => m(y, _, v, R, S, k),
        { type: F, ref: N, shapeFlag: W, patchFlag: X } = _;
      let se = y.nodeType;
      ((_.el = y), X === -2 && ((I = !1), (_.dynamicChildren = null)));
      let V = null;
      switch (F) {
        case tn:
          se !== 3
            ? _.children === ''
              ? (l((_.el = s('')), i(y), y), (V = y))
              : (V = D())
            : (y.data !== _.children && (cn(), (y.data = _.children)), (V = o(y)));
          break;
        case Re:
          w(y)
            ? ((V = o(y)), E((_.el = y.content.firstChild), y, v))
            : se !== 8 || k
              ? (V = D())
              : (V = o(y));
          break;
        case Yn:
          if ((k && ((y = o(y)), (se = y.nodeType)), se === 1 || se === 3)) {
            V = y;
            const Z = !_.children.length;
            for (let z = 0; z < _.staticCount; z++)
              (Z && (_.children += V.nodeType === 1 ? V.outerHTML : V.data),
                z === _.staticCount - 1 && (_.anchor = V),
                (V = o(V)));
            return k ? o(V) : V;
          } else D();
          break;
        case He:
          k ? (V = p(y, _, v, R, S, I)) : (V = D());
          break;
        default:
          if (W & 1)
            (se !== 1 || _.type.toLowerCase() !== y.tagName.toLowerCase()) && !w(y)
              ? (V = D())
              : (V = h(y, _, v, R, S, I));
          else if (W & 6) {
            _.slotScopeIds = S;
            const Z = i(y);
            if (
              (k
                ? (V = C(y))
                : hn(y) && y.data === 'teleport start'
                  ? (V = C(y, y.data, 'teleport end'))
                  : (V = o(y)),
              t(_, Z, null, v, R, _r(Z), I),
              jt(_) && !_.type.__asyncResolved)
            ) {
              let z;
              (k
                ? ((z = me(He)), (z.anchor = V ? V.previousSibling : Z.lastChild))
                : (z = y.nodeType === 3 ? Br('') : me('div')),
                (z.el = y),
                (_.component.subTree = z));
            }
          } else
            W & 64
              ? se !== 8
                ? (V = D())
                : (V = _.type.hydrate(y, _, v, R, S, I, e, d))
              : W & 128 && (V = _.type.hydrate(y, _, v, R, _r(i(y)), S, I, e, u));
      }
      return (N != null && vn(N, null, R, _), V);
    },
    h = (y, _, v, R, S, I) => {
      I = I || !!_.dynamicChildren;
      const {
          type: k,
          dynamicProps: D,
          props: F,
          patchFlag: N,
          shapeFlag: W,
          dirs: X,
          transition: se,
        } = _,
        V = k === 'input' || k === 'option',
        Z = !!D;
      if (V || Z || N !== -1) {
        X && ct(_, null, v, 'created');
        let z = !1;
        if (w(y)) {
          z = $l(null, se) && v && v.vnode.props && v.vnode.props.appear;
          const ie = y.content.firstChild;
          if (z) {
            const ce = ie.getAttribute('class');
            (ce && (ie.$cls = ce), se.beforeEnter(ie));
          }
          (E(ie, y, v), (_.el = y = ie));
        }
        if (W & 16 && !(F && (F.innerHTML || F.textContent))) {
          let ie = d(y.firstChild, _, y, v, R, S, I);
          for (ie && !Ar(y, 1) && cn(); ie; ) {
            const ce = ie;
            ((ie = ie.nextSibling), a(ce));
          }
        } else if (W & 8) {
          let ie = _.children;
          ie[0] ===
            `
` &&
            (y.tagName === 'PRE' || y.tagName === 'TEXTAREA') &&
            (ie = ie.slice(1));
          const { textContent: ce } = y;
          ce !== ie &&
            ce !==
              ie.replace(
                /\r\n|\r/g,
                `
`,
              ) &&
            (Ar(y, 0) || cn(), (y.textContent = _.children));
        }
        if (F) {
          if (V || Z || !I || N & 48) {
            const ie = y.tagName.includes('-');
            for (const ce in F)
              ((V && (ce.endsWith('value') || ce === 'indeterminate')) ||
                (fr(ce) && !Xt(ce)) ||
                ce[0] === '.' ||
                (ie && !Xt(ce)) ||
                (D && D.includes(ce))) &&
                r(y, ce, null, F[ce], void 0, v);
          } else if (F.onClick) r(y, 'onClick', null, F.onClick, void 0, v);
          else if (N & 4 && Lt(F.style)) for (const ie in F.style) F.style[ie];
        }
        let Pe;
        ((Pe = F && F.onVnodeBeforeMount) && Le(Pe, v, _),
          X && ct(_, null, v, 'beforeMount'),
          ((Pe = F && F.onVnodeMounted) || X || z) &&
            Kl(() => {
              (Pe && Le(Pe, v, _), z && se.enter(y), X && ct(_, null, v, 'mounted'));
            }, R));
      }
      return y.nextSibling;
    },
    d = (y, _, v, R, S, I, k) => {
      k = k || !!_.dynamicChildren;
      const D = _.children,
        F = D.length;
      let N = !1;
      for (let W = 0; W < F; W++) {
        const X = k ? D[W] : (D[W] = We(D[W])),
          se = X.type === tn;
        y
          ? (se &&
              !k &&
              W + 1 < F &&
              We(D[W + 1]).type === tn &&
              (l(s(y.data.slice(X.children.length)), v, o(y)), (y.data = X.children)),
            (y = u(y, X, R, S, I, k)))
          : se && !X.children
            ? l((X.el = s('')), v)
            : (N || ((N = !0), Ar(v, 1) || cn()), n(null, X, v, null, R, S, _r(v), I));
      }
      return y;
    },
    p = (y, _, v, R, S, I) => {
      const { slotScopeIds: k } = _;
      k && (S = S ? S.concat(k) : k);
      const D = i(y),
        F = d(o(y), _, D, v, R, S, I);
      return F && hn(F) && F.data === ']'
        ? o((_.anchor = F))
        : (cn(), l((_.anchor = f(']')), D, F), F);
    },
    m = (y, _, v, R, S, I) => {
      if ((lf(y, _) || cn(), (_.el = null), I)) {
        const F = C(y);
        for (;;) {
          const N = o(y);
          if (N && N !== F) a(N);
          else break;
        }
      }
      const k = o(y),
        D = i(y);
      return (a(y), n(null, _, D, k, v, R, _r(D), S), v && ((v.vnode.el = _.el), us(v, _.el)), k);
    },
    C = (y, _ = '[', v = ']') => {
      let R = 0;
      for (; y; )
        if (((y = o(y)), y && hn(y) && (y.data === _ && R++, y.data === v))) {
          if (R === 0) return o(y);
          R--;
        }
      return y;
    },
    E = (y, _, v) => {
      const R = _.parentNode;
      R && R.replaceChild(y, _);
      let S = v;
      for (; S; ) (S.vnode.el === _ && (S.vnode.el = S.subTree.el = y), (S = S.parent));
    },
    w = (y) => y.nodeType === 1 && y.tagName === 'TEMPLATE';
  return [c, u];
}
const Hr = 'data-allow-mismatch',
  af = { 0: 'text', 1: 'children', 2: 'class', 3: 'style', 4: 'attribute' };
function Ar(e, t) {
  if (t === 0 || t === 1) for (; e && !e.hasAttribute(Hr); ) e = e.parentElement;
  return Bo(e && e.getAttribute(Hr), t);
}
function Bo(e, t) {
  if (e == null) return !1;
  if (e === '') return !0;
  {
    const n = e.split(',');
    return t === 0 && n.includes('children') ? !0 : n.includes(af[t]);
  }
}
function lf(e, t) {
  return Ar(e.parentElement, 1) || cf(e) || uf(t);
}
function cf(e) {
  return e.nodeType === 1 && Bo(e.getAttribute(Hr), 1);
}
function uf({ props: e }) {
  const t = e && e[Hr];
  return typeof t == 'string' && Bo(t, 1);
}
ts().requestIdleCallback;
ts().cancelIdleCallback;
function ff(e, t) {
  if (hn(e) && e.data === '[') {
    let n = 1,
      r = e.nextSibling;
    for (; r; ) {
      if (r.nodeType === 1) {
        if (t(r) === !1) break;
      } else if (hn(r))
        if (r.data === ']') {
          if (--n === 0) break;
        } else r.data === '[' && n++;
      r = r.nextSibling;
    }
  } else t(e);
}
const jt = (e) => !!e.type.__asyncLoader;
function gi(e) {
  Y(e) && (e = { loader: e });
  const {
    loader: t,
    loadingComponent: n,
    errorComponent: r,
    delay: s = 200,
    hydrate: o,
    timeout: i,
    suspensible: a = !0,
    onError: l,
  } = e;
  let f = null,
    c,
    u = 0;
  const h = () => (u++, (f = null), d()),
    d = () => {
      let p;
      return (
        f ||
        (p = f =
          t()
            .catch((m) => {
              if (((m = m instanceof Error ? m : new Error(String(m))), l))
                return new Promise((C, E) => {
                  l(
                    m,
                    () => C(h()),
                    () => E(m),
                    u + 1,
                  );
                });
              throw m;
            })
            .then((m) =>
              p !== f && f
                ? f
                : (m && (m.__esModule || m[Symbol.toStringTag] === 'Module') && (m = m.default),
                  (c = m),
                  m),
            ))
      );
    };
  return sn({
    name: 'AsyncComponentWrapper',
    __asyncLoader: d,
    __asyncHydrate(p, m, C) {
      let E = !1;
      (m.bu || (m.bu = [])).push(() => (E = !0));
      const w = () => {
          E || C();
        },
        y = o
          ? () => {
              const _ = o(w, (v) => ff(p, v));
              _ && (m.bum || (m.bum = [])).push(_);
            }
          : w;
      c ? y() : d().then(() => !m.isUnmounted && y());
    },
    get __asyncResolved() {
      return c;
    },
    setup() {
      const p = ke;
      if ((Uo(p), c)) return () => br(c, p);
      const m = (v) => {
        ((f = null), On(v, p, 13, !r));
      };
      if ((a && p.suspense) || nn)
        return d()
          .then((v) => () => br(v, p))
          .catch((v) => (m(v), () => (r ? me(r, { error: v }) : null)));
      const C = st(!1),
        E = st(),
        w = st(!!s);
      let y, _;
      return (
        ls(() => {
          (y != null && clearTimeout(y), _ != null && clearTimeout(_));
        }),
        s &&
          (_ = setTimeout(() => {
            p.isUnmounted || (w.value = !1);
          }, s)),
        i != null &&
          (y = setTimeout(() => {
            if (!p.isUnmounted && !C.value && !E.value) {
              const v = new Error(`Async component timed out after ${i}ms.`);
              (m(v), (E.value = v));
            }
          }, i)),
        d()
          .then(() => {
            p.isUnmounted || ((C.value = !0), p.parent && hr(p.parent.vnode) && p.parent.update());
          })
          .catch((v) => {
            if (p.isUnmounted) {
              f = null;
              return;
            }
            (m(v), (E.value = v));
          }),
        () => {
          if (C.value && c) return br(c, p);
          if (E.value && r) return me(r, { error: E.value });
          if (n && !w.value) return br(n, p);
        }
      );
    },
  });
}
function br(e, t) {
  const { ref: n, props: r, children: s, ce: o } = t.vnode,
    i = me(e, r, s);
  return ((i.ref = n), (i.ce = o), delete t.vnode.ce, i);
}
const hr = (e) => e.type.__isKeepAlive,
  df = {
    name: 'KeepAlive',
    __isKeepAlive: !0,
    props: {
      include: [String, RegExp, Array],
      exclude: [String, RegExp, Array],
      max: [String, Number],
    },
    setup(e, { slots: t }) {
      const n = Pt(),
        r = n.ctx;
      if (!r.renderer)
        return () => {
          const w = t.default && t.default();
          return w && w.length === 1 ? w[0] : w;
        };
      const s = new Map(),
        o = new Set();
      let i = null;
      const a = n.suspense,
        {
          renderer: {
            p: l,
            m: f,
            um: c,
            o: { createElement: u },
          },
        } = r,
        h = u('div');
      ((r.activate = (w, y, _, v, R) => {
        const S = w.component;
        (f(w, y, _, 0, a),
          l(S.vnode, w, y, _, S, a, v, w.slotScopeIds, R),
          we(() => {
            ((S.isDeactivated = !1), S.a && yn(S.a));
            const I = w.props && w.props.onVnodeMounted;
            I && Le(I, S.parent, w);
          }, a));
      }),
        (r.deactivate = (w) => {
          const y = w.component;
          (Fr(y.m),
            Fr(y.a),
            f(w, h, null, 1, a),
            we(() => {
              y.da && yn(y.da);
              const _ = w.props && w.props.onVnodeUnmounted;
              (_ && Le(_, y.parent, w), (y.isDeactivated = !0));
            }, a));
        }));
      function d(w) {
        (Ts(w), c(w, n, a, !0));
      }
      function p(w) {
        s.forEach((y, _) => {
          const v = no(jt(y) ? y.type.__asyncResolved || {} : y.type);
          v && !w(v) && m(_);
        });
      }
      function m(w) {
        const y = s.get(w);
        (y && (!i || !nt(y, i)) ? d(y) : i && Ts(i), s.delete(w), o.delete(w));
      }
      Ht(
        () => [e.include, e.exclude],
        ([w, y]) => {
          (w && p((_) => Vn(w, _)), y && p((_) => !Vn(y, _)));
        },
        { flush: 'post', deep: !0 },
      );
      let C = null;
      const E = () => {
        C != null &&
          ($r(n.subTree.type)
            ? we(() => {
                s.set(C, vr(n.subTree));
              }, n.subTree.suspense)
            : s.set(C, vr(n.subTree)));
      };
      return (
        as(E),
        wl(E),
        Mn(() => {
          s.forEach((w) => {
            const { subTree: y, suspense: _ } = n,
              v = vr(y);
            if (w.type === v.type && w.key === v.key) {
              Ts(v);
              const R = v.component.da;
              R && we(R, _);
              return;
            }
            d(w);
          });
        }),
        () => {
          if (((C = null), !t.default)) return (i = null);
          const w = t.default(),
            y = w[0];
          if (w.length > 1) return ((i = null), w);
          if (!An(y) || (!(y.shapeFlag & 4) && !(y.shapeFlag & 128))) return ((i = null), y);
          let _ = vr(y);
          if (_.type === Re) return ((i = null), _);
          const v = _.type,
            R = no(jt(_) ? _.type.__asyncResolved || {} : v),
            { include: S, exclude: I, max: k } = e;
          if ((S && (!R || !Vn(S, R))) || (I && R && Vn(I, R)))
            return ((_.shapeFlag &= -257), (i = _), y);
          const D = _.key == null ? v : _.key,
            F = s.get(D);
          return (
            _.el && ((_ = At(_)), y.shapeFlag & 128 && (y.ssContent = _)),
            (C = D),
            F
              ? ((_.el = F.el),
                (_.component = F.component),
                _.transition && Sn(_, _.transition),
                (_.shapeFlag |= 512),
                o.delete(D),
                o.add(D))
              : (o.add(D), k && o.size > parseInt(k, 10) && m(o.values().next().value)),
            (_.shapeFlag |= 256),
            (i = _),
            $r(y.type) ? y : _
          );
        }
      );
    },
  },
  hf = df;
function Vn(e, t) {
  return G(e)
    ? e.some((n) => Vn(n, t))
    : he(e)
      ? e.split(',').includes(t)
      : ru(e)
        ? ((e.lastIndex = 0), e.test(t))
        : !1;
}
function yl(e, t) {
  bl(e, 'a', t);
}
function _l(e, t) {
  bl(e, 'da', t);
}
function bl(e, t, n = ke) {
  const r =
    e.__wdc ||
    (e.__wdc = () => {
      let s = n;
      for (; s; ) {
        if (s.isDeactivated) return;
        s = s.parent;
      }
      return e();
    });
  if ((is(t, r, n), n)) {
    let s = n.parent;
    for (; s && s.parent; ) (hr(s.parent.vnode) && pf(r, t, n, s), (s = s.parent));
  }
}
function pf(e, t, n, r) {
  const s = is(t, e, r, !0);
  ls(() => {
    Ao(r[t], s);
  }, n);
}
function Ts(e) {
  ((e.shapeFlag &= -257), (e.shapeFlag &= -513));
}
function vr(e) {
  return e.shapeFlag & 128 ? e.ssContent : e;
}
function is(e, t, n = ke, r = !1) {
  if (n) {
    const s = n[e] || (n[e] = []),
      o =
        t.__weh ||
        (t.__weh = (...i) => {
          ht();
          const a = Nn(n),
            l = Ze(t, n, e, i);
          return (a(), pt(), l);
        });
    return (r ? s.unshift(o) : s.push(o), o);
  }
}
const kt =
    (e) =>
    (t, n = ke) => {
      (!nn || e === 'sp') && is(e, (...r) => t(...r), n);
    },
  vl = kt('bm'),
  as = kt('m'),
  gf = kt('bu'),
  wl = kt('u'),
  Mn = kt('bum'),
  ls = kt('um'),
  mf = kt('sp'),
  yf = kt('rtg'),
  _f = kt('rtc');
function El(e, t = ke) {
  is('ec', e, t);
}
const Tl = 'components';
function mi(e, t) {
  return Sl(Tl, e, !0, t) || e;
}
const Cl = Symbol.for('v-ndc');
function bf(e) {
  return he(e) ? Sl(Tl, e, !1) || e : e || Cl;
}
function Sl(e, t, n = !0, r = !1) {
  const s = Ke || ke;
  if (s) {
    const o = s.type;
    {
      const a = no(o, !1);
      if (a && (a === t || a === Ie(t) || a === es(Ie(t)))) return o;
    }
    const i = yi(s[e] || o[e], t) || yi(s.appContext[e], t);
    return !i && r ? o : i;
  }
}
function yi(e, t) {
  return e && (e[t] || e[Ie(t)] || e[es(Ie(t))]);
}
function vf(e, t, n, r) {
  let s;
  const o = n,
    i = G(e);
  if (i || he(e)) {
    const a = i && Lt(e);
    let l = !1,
      f = !1;
    (a && ((l = !qe(e)), (f = gt(e)), (e = ss(e))), (s = new Array(e.length)));
    for (let c = 0, u = e.length; c < u; c++)
      s[c] = t(l ? (f ? Tn(ot(e[c])) : ot(e[c])) : e[c], c, void 0, o);
  } else if (typeof e == 'number') {
    s = new Array(e);
    for (let a = 0; a < e; a++) s[a] = t(a + 1, a, void 0, o);
  } else if (oe(e))
    if (e[Symbol.iterator]) s = Array.from(e, (a, l) => t(a, l, void 0, o));
    else {
      const a = Object.keys(e);
      s = new Array(a.length);
      for (let l = 0, f = a.length; l < f; l++) {
        const c = a[l];
        s[l] = t(e[c], c, l, o);
      }
    }
  else s = [];
  return s;
}
const Ys = (e) => (e ? (zl(e) ? fs(e) : Ys(e.parent)) : null),
  Jn = Ae(Object.create(null), {
    $: (e) => e,
    $el: (e) => e.vnode.el,
    $data: (e) => e.data,
    $props: (e) => e.props,
    $attrs: (e) => e.attrs,
    $slots: (e) => e.slots,
    $refs: (e) => e.refs,
    $parent: (e) => Ys(e.parent),
    $root: (e) => Ys(e.root),
    $host: (e) => e.ce,
    $emit: (e) => e.emit,
    $options: (e) => Al(e),
    $forceUpdate: (e) =>
      e.f ||
      (e.f = () => {
        jo(e.update);
      }),
    $nextTick: (e) => e.n || (e.n = Cn.bind(e.proxy)),
    $watch: (e) => zu.bind(e),
  }),
  Cs = (e, t) => e !== de && !e.__isScriptSetup && le(e, t),
  wf = {
    get({ _: e }, t) {
      if (t === '__v_skip') return !0;
      const {
        ctx: n,
        setupState: r,
        data: s,
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
              return r[t];
            case 2:
              return s[t];
            case 4:
              return n[t];
            case 3:
              return o[t];
          }
        else {
          if (Cs(r, t)) return ((i[t] = 1), r[t]);
          if (s !== de && le(s, t)) return ((i[t] = 2), s[t]);
          if (le(o, t)) return ((i[t] = 3), o[t]);
          if (n !== de && le(n, t)) return ((i[t] = 4), n[t]);
          zs && (i[t] = 0);
        }
      }
      const f = Jn[t];
      let c, u;
      if (f) return (t === '$attrs' && xe(e.attrs, 'get', ''), f(e));
      if ((c = a.__cssModules) && (c = c[t])) return c;
      if (n !== de && le(n, t)) return ((i[t] = 4), n[t]);
      if (((u = l.config.globalProperties), le(u, t))) return u[t];
    },
    set({ _: e }, t, n) {
      const { data: r, setupState: s, ctx: o } = e;
      return Cs(s, t)
        ? ((s[t] = n), !0)
        : r !== de && le(r, t)
          ? ((r[t] = n), !0)
          : le(e.props, t) || (t[0] === '$' && t.slice(1) in e)
            ? !1
            : ((o[t] = n), !0);
    },
    has(
      { _: { data: e, setupState: t, accessCache: n, ctx: r, appContext: s, props: o, type: i } },
      a,
    ) {
      let l;
      return !!(
        n[a] ||
        (e !== de && a[0] !== '$' && le(e, a)) ||
        Cs(t, a) ||
        le(o, a) ||
        le(r, a) ||
        le(Jn, a) ||
        le(s.config.globalProperties, a) ||
        ((l = i.__cssModules) && l[a])
      );
    },
    defineProperty(e, t, n) {
      return (
        n.get != null ? (e._.accessCache[t] = 0) : le(n, 'value') && this.set(e, t, n.value, null),
        Reflect.defineProperty(e, t, n)
      );
    },
  };
function _i(e) {
  return G(e) ? e.reduce((t, n) => ((t[n] = null), t), {}) : e;
}
function Ef(e) {
  const t = Pt(),
    n = nn;
  let r = e();
  (or(), n && En(!1));
  const s = () => {
      (Nn(t), n && En(!0));
    },
    o = () => {
      (Pt() !== t && t.scope.off(), or(), n && En(!1));
    };
  return (
    Po(r) &&
      (r = r.catch((i) => {
        throw (s(), Promise.resolve().then(() => Promise.resolve().then(o)), i);
      })),
    [
      r,
      () => {
        (s(), Promise.resolve().then(o));
      },
    ]
  );
}
let zs = !0;
function Tf(e) {
  const t = Al(e),
    n = e.proxy,
    r = e.ctx;
  ((zs = !1), t.beforeCreate && bi(t.beforeCreate, e, 'bc'));
  const {
    data: s,
    computed: o,
    methods: i,
    watch: a,
    provide: l,
    inject: f,
    created: c,
    beforeMount: u,
    mounted: h,
    beforeUpdate: d,
    updated: p,
    activated: m,
    deactivated: C,
    beforeDestroy: E,
    beforeUnmount: w,
    destroyed: y,
    unmounted: _,
    render: v,
    renderTracked: R,
    renderTriggered: S,
    errorCaptured: I,
    serverPrefetch: k,
    expose: D,
    inheritAttrs: F,
    components: N,
    directives: W,
    filters: X,
  } = t;
  if ((f && Cf(f, r, null), i))
    for (const Z in i) {
      const z = i[Z];
      Y(z) && (r[Z] = z.bind(n));
    }
  if (s) {
    const Z = s.call(n, n);
    oe(Z) && (e.data = $t(Z));
  }
  if (((zs = !0), o))
    for (const Z in o) {
      const z = o[Z],
        Pe = Y(z) ? z.bind(n, n) : Y(z.get) ? z.get.bind(n, n) : dt,
        ie = !Y(z) && Y(z.set) ? z.set.bind(n) : dt,
        ce = _e({ get: Pe, set: ie });
      Object.defineProperty(r, Z, {
        enumerable: !0,
        configurable: !0,
        get: () => ce.value,
        set: (De) => (ce.value = De),
      });
    }
  if (a) for (const Z in a) Rl(a[Z], r, n, Z);
  if (l) {
    const Z = Y(l) ? l.call(n) : l;
    Reflect.ownKeys(Z).forEach((z) => {
      bn(z, Z[z]);
    });
  }
  c && bi(c, e, 'c');
  function V(Z, z) {
    G(z) ? z.forEach((Pe) => Z(Pe.bind(n))) : z && Z(z.bind(n));
  }
  if (
    (V(vl, u),
    V(as, h),
    V(gf, d),
    V(wl, p),
    V(yl, m),
    V(_l, C),
    V(El, I),
    V(_f, R),
    V(yf, S),
    V(Mn, w),
    V(ls, _),
    V(mf, k),
    G(D))
  )
    if (D.length) {
      const Z = e.exposed || (e.exposed = {});
      D.forEach((z) => {
        Object.defineProperty(Z, z, { get: () => n[z], set: (Pe) => (n[z] = Pe), enumerable: !0 });
      });
    } else e.exposed || (e.exposed = {});
  (v && e.render === dt && (e.render = v),
    F != null && (e.inheritAttrs = F),
    N && (e.components = N),
    W && (e.directives = W),
    k && Uo(e));
}
function Cf(e, t, n = dt) {
  G(e) && (e = Qs(e));
  for (const r in e) {
    const s = e[r];
    let o;
    (oe(s)
      ? 'default' in s
        ? (o = $e(s.from || r, s.default, !0))
        : (o = $e(s.from || r))
      : (o = $e(s)),
      Ee(o)
        ? Object.defineProperty(t, r, {
            enumerable: !0,
            configurable: !0,
            get: () => o.value,
            set: (i) => (o.value = i),
          })
        : (t[r] = o));
  }
}
function bi(e, t, n) {
  Ze(G(e) ? e.map((r) => r.bind(t.proxy)) : e.bind(t.proxy), t, n);
}
function Rl(e, t, n, r) {
  let s = r.includes('.') ? cl(n, r) : () => n[r];
  if (he(e)) {
    const o = t[e];
    Y(o) && Ht(s, o);
  } else if (Y(e)) Ht(s, e.bind(n));
  else if (oe(e))
    if (G(e)) e.forEach((o) => Rl(o, t, n, r));
    else {
      const o = Y(e.handler) ? e.handler.bind(n) : t[e.handler];
      Y(o) && Ht(s, o, e);
    }
}
function Al(e) {
  const t = e.type,
    { mixins: n, extends: r } = t,
    {
      mixins: s,
      optionsCache: o,
      config: { optionMergeStrategies: i },
    } = e.appContext,
    a = o.get(t);
  let l;
  return (
    a
      ? (l = a)
      : !s.length && !n && !r
        ? (l = t)
        : ((l = {}), s.length && s.forEach((f) => jr(l, f, i, !0)), jr(l, t, i)),
    oe(t) && o.set(t, l),
    l
  );
}
function jr(e, t, n, r = !1) {
  const { mixins: s, extends: o } = t;
  (o && jr(e, o, n, !0), s && s.forEach((i) => jr(e, i, n, !0)));
  for (const i in t)
    if (!(r && i === 'expose')) {
      const a = Sf[i] || (n && n[i]);
      e[i] = a ? a(e[i], t[i]) : t[i];
    }
  return e;
}
const Sf = {
  data: vi,
  props: wi,
  emits: wi,
  methods: Wn,
  computed: Wn,
  beforeCreate: Oe,
  created: Oe,
  beforeMount: Oe,
  mounted: Oe,
  beforeUpdate: Oe,
  updated: Oe,
  beforeDestroy: Oe,
  beforeUnmount: Oe,
  destroyed: Oe,
  unmounted: Oe,
  activated: Oe,
  deactivated: Oe,
  errorCaptured: Oe,
  serverPrefetch: Oe,
  components: Wn,
  directives: Wn,
  watch: Af,
  provide: vi,
  inject: Rf,
};
function vi(e, t) {
  return t
    ? e
      ? function () {
          return Ae(Y(e) ? e.call(this, this) : e, Y(t) ? t.call(this, this) : t);
        }
      : t
    : e;
}
function Rf(e, t) {
  return Wn(Qs(e), Qs(t));
}
function Qs(e) {
  if (G(e)) {
    const t = {};
    for (let n = 0; n < e.length; n++) t[e[n]] = e[n];
    return t;
  }
  return e;
}
function Oe(e, t) {
  return e ? [...new Set([].concat(e, t))] : t;
}
function Wn(e, t) {
  return e ? Ae(Object.create(null), e, t) : t;
}
function wi(e, t) {
  return e
    ? G(e) && G(t)
      ? [...new Set([...e, ...t])]
      : Ae(Object.create(null), _i(e), _i(t ?? {}))
    : t;
}
function Af(e, t) {
  if (!e) return t;
  if (!t) return e;
  const n = Ae(Object.create(null), e);
  for (const r in t) n[r] = Oe(e[r], t[r]);
  return n;
}
function Pl() {
  return {
    app: null,
    config: {
      isNativeTag: Oa,
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
let Pf = 0;
function kf(e, t) {
  return function (r, s = null) {
    (Y(r) || (r = Ae({}, r)), s != null && !oe(s) && (s = null));
    const o = Pl(),
      i = new WeakSet(),
      a = [];
    let l = !1;
    const f = (o.app = {
      _uid: Pf++,
      _component: r,
      _props: s,
      _container: null,
      _context: o,
      _instance: null,
      version: cd,
      get config() {
        return o.config;
      },
      set config(c) {},
      use(c, ...u) {
        return (
          i.has(c) ||
            (c && Y(c.install) ? (i.add(c), c.install(f, ...u)) : Y(c) && (i.add(c), c(f, ...u))),
          f
        );
      },
      mixin(c) {
        return (o.mixins.includes(c) || o.mixins.push(c), f);
      },
      component(c, u) {
        return u ? ((o.components[c] = u), f) : o.components[c];
      },
      directive(c, u) {
        return u ? ((o.directives[c] = u), f) : o.directives[c];
      },
      mount(c, u, h) {
        if (!l) {
          const d = f._ceVNode || me(r, s);
          return (
            (d.appContext = o),
            h === !0 ? (h = 'svg') : h === !1 && (h = void 0),
            u && t ? t(d, c) : e(d, c, h),
            (l = !0),
            (f._container = c),
            (c.__vue_app__ = f),
            fs(d.component)
          );
        }
      },
      onUnmount(c) {
        a.push(c);
      },
      unmount() {
        l && (Ze(a, f._instance, 16), e(null, f._container), delete f._container.__vue_app__);
      },
      provide(c, u) {
        return ((o.provides[c] = u), f);
      },
      runWithContext(c) {
        const u = en;
        en = f;
        try {
          return c();
        } finally {
          en = u;
        }
      },
    });
    return f;
  };
}
let en = null;
const xf = (e, t) =>
  t === 'modelValue' || t === 'model-value'
    ? e.modelModifiers
    : e[`${t}Modifiers`] || e[`${Ie(t)}Modifiers`] || e[`${rn(t)}Modifiers`];
function Of(e, t, ...n) {
  if (e.isUnmounted) return;
  const r = e.vnode.props || de;
  let s = n;
  const o = t.startsWith('update:'),
    i = o && xf(r, t.slice(7));
  i && (i.trim && (s = n.map((c) => (he(c) ? c.trim() : c))), i.number && (s = n.map(ko)));
  let a,
    l = r[(a = ys(t))] || r[(a = ys(Ie(t)))];
  (!l && o && (l = r[(a = ys(rn(t)))]), l && Ze(l, e, 6, s));
  const f = r[a + 'Once'];
  if (f) {
    if (!e.emitted) e.emitted = {};
    else if (e.emitted[a]) return;
    ((e.emitted[a] = !0), Ze(f, e, 6, s));
  }
}
const Mf = new WeakMap();
function kl(e, t, n = !1) {
  const r = n ? Mf : t.emitsCache,
    s = r.get(e);
  if (s !== void 0) return s;
  const o = e.emits;
  let i = {},
    a = !1;
  if (!Y(e)) {
    const l = (f) => {
      const c = kl(f, t, !0);
      c && ((a = !0), Ae(i, c));
    };
    (!n && t.mixins.length && t.mixins.forEach(l),
      e.extends && l(e.extends),
      e.mixins && e.mixins.forEach(l));
  }
  return !o && !a
    ? (oe(e) && r.set(e, null), null)
    : (G(o) ? o.forEach((l) => (i[l] = null)) : Ae(i, o), oe(e) && r.set(e, i), i);
}
function cs(e, t) {
  return !e || !fr(t)
    ? !1
    : ((t = t.slice(2)),
      (t = t === 'Once' ? t : t.replace(/Once$/, '')),
      le(e, t[0].toLowerCase() + t.slice(1)) || le(e, rn(t)) || le(e, t));
}
function Ss(e) {
  const {
      type: t,
      vnode: n,
      proxy: r,
      withProxy: s,
      propsOptions: [o],
      slots: i,
      attrs: a,
      emit: l,
      render: f,
      renderCache: c,
      props: u,
      data: h,
      setupState: d,
      ctx: p,
      inheritAttrs: m,
    } = e,
    C = Ir(e);
  let E, w;
  try {
    if (n.shapeFlag & 4) {
      const _ = s || r,
        v = _;
      ((E = We(f.call(v, _, c, u, d, h, p))), (w = a));
    } else {
      const _ = t;
      ((E = We(_.length > 1 ? _(u, { attrs: a, slots: i, emit: l }) : _(u, null))),
        (w = t.props ? a : If(a)));
    }
  } catch (_) {
    ((zn.length = 0), On(_, e, 1), (E = me(Re)));
  }
  let y = E;
  if (w && m !== !1) {
    const _ = Object.keys(w),
      { shapeFlag: v } = y;
    _.length && v & 7 && (o && _.some(Qr) && (w = Df(w, o)), (y = At(y, w, !1, !0)));
  }
  return (
    n.dirs && ((y = At(y, null, !1, !0)), (y.dirs = y.dirs ? y.dirs.concat(n.dirs) : n.dirs)),
    n.transition && Sn(y, n.transition),
    (E = y),
    Ir(C),
    E
  );
}
function Nf(e, t = !0) {
  let n;
  for (let r = 0; r < e.length; r++) {
    const s = e[r];
    if (An(s)) {
      if (s.type !== Re || s.children === 'v-if') {
        if (n) return;
        n = s;
      }
    } else return;
  }
  return n;
}
const If = (e) => {
    let t;
    for (const n in e) (n === 'class' || n === 'style' || fr(n)) && ((t || (t = {}))[n] = e[n]);
    return t;
  },
  Df = (e, t) => {
    const n = {};
    for (const r in e) (!Qr(r) || !(r.slice(9) in t)) && (n[r] = e[r]);
    return n;
  };
function Lf(e, t, n) {
  const { props: r, children: s, component: o } = e,
    { props: i, children: a, patchFlag: l } = t,
    f = o.emitsOptions;
  if (t.dirs || t.transition) return !0;
  if (n && l >= 0) {
    if (l & 1024) return !0;
    if (l & 16) return r ? Ei(r, i, f) : !!i;
    if (l & 8) {
      const c = t.dynamicProps;
      for (let u = 0; u < c.length; u++) {
        const h = c[u];
        if (xl(i, r, h) && !cs(f, h)) return !0;
      }
    }
  } else
    return (s || a) && (!a || !a.$stable) ? !0 : r === i ? !1 : r ? (i ? Ei(r, i, f) : !0) : !!i;
  return !1;
}
function Ei(e, t, n) {
  const r = Object.keys(t);
  if (r.length !== Object.keys(e).length) return !0;
  for (let s = 0; s < r.length; s++) {
    const o = r[s];
    if (xl(t, e, o) && !cs(n, o)) return !0;
  }
  return !1;
}
function xl(e, t, n) {
  const r = e[n],
    s = t[n];
  return n === 'style' && oe(r) && oe(s) ? !xo(r, s) : r !== s;
}
function us({ vnode: e, parent: t, suspense: n }, r) {
  for (; t; ) {
    const s = t.subTree;
    if (
      (s.suspense && s.suspense.activeBranch === e && ((s.suspense.vnode.el = s.el = r), (e = s)),
      s === e)
    )
      (((e = t.vnode).el = r), (t = t.parent));
    else break;
  }
  n && n.activeBranch === e && (n.vnode.el = r);
}
const Ol = {},
  Ml = () => Object.create(Ol),
  Nl = (e) => Object.getPrototypeOf(e) === Ol;
function Hf(e, t, n, r = !1) {
  const s = {},
    o = Ml();
  ((e.propsDefaults = Object.create(null)), Il(e, t, s, o));
  for (const i in e.propsOptions[0]) i in s || (s[i] = void 0);
  (n ? (e.props = r ? s : Tt(s)) : e.type.props ? (e.props = s) : (e.props = o), (e.attrs = o));
}
function jf(e, t, n, r) {
  const {
      props: s,
      attrs: o,
      vnode: { patchFlag: i },
    } = e,
    a = re(s),
    [l] = e.propsOptions;
  let f = !1;
  if ((r || i > 0) && !(i & 16)) {
    if (i & 8) {
      const c = e.vnode.dynamicProps;
      for (let u = 0; u < c.length; u++) {
        let h = c[u];
        if (cs(e.emitsOptions, h)) continue;
        const d = t[h];
        if (l)
          if (le(o, h)) d !== o[h] && ((o[h] = d), (f = !0));
          else {
            const p = Ie(h);
            s[p] = Xs(l, a, p, d, e, !1);
          }
        else d !== o[h] && ((o[h] = d), (f = !0));
      }
    }
  } else {
    Il(e, t, s, o) && (f = !0);
    let c;
    for (const u in a)
      (!t || (!le(t, u) && ((c = rn(u)) === u || !le(t, c)))) &&
        (l
          ? n && (n[u] !== void 0 || n[c] !== void 0) && (s[u] = Xs(l, a, u, void 0, e, !0))
          : delete s[u]);
    if (o !== a) for (const u in o) (!t || !le(t, u)) && (delete o[u], (f = !0));
  }
  f && wt(e.attrs, 'set', '');
}
function Il(e, t, n, r) {
  const [s, o] = e.propsOptions;
  let i = !1,
    a;
  if (t)
    for (let l in t) {
      if (Xt(l)) continue;
      const f = t[l];
      let c;
      s && le(s, (c = Ie(l)))
        ? !o || !o.includes(c)
          ? (n[c] = f)
          : ((a || (a = {}))[c] = f)
        : cs(e.emitsOptions, l) || ((!(l in r) || f !== r[l]) && ((r[l] = f), (i = !0)));
    }
  if (o) {
    const l = re(n),
      f = a || de;
    for (let c = 0; c < o.length; c++) {
      const u = o[c];
      n[u] = Xs(s, l, u, f[u], e, !le(f, u));
    }
  }
  return i;
}
function Xs(e, t, n, r, s, o) {
  const i = e[n];
  if (i != null) {
    const a = le(i, 'default');
    if (a && r === void 0) {
      const l = i.default;
      if (i.type !== Function && !i.skipFactory && Y(l)) {
        const { propsDefaults: f } = s;
        if (n in f) r = f[n];
        else {
          const c = Nn(s);
          ((r = f[n] = l.call(null, t)), c());
        }
      } else r = l;
      s.ce && s.ce._setProp(n, r);
    }
    i[0] && (o && !a ? (r = !1) : i[1] && (r === '' || r === rn(n)) && (r = !0));
  }
  return r;
}
const Ff = new WeakMap();
function Dl(e, t, n = !1) {
  const r = n ? Ff : t.propsCache,
    s = r.get(e);
  if (s) return s;
  const o = e.props,
    i = {},
    a = [];
  let l = !1;
  if (!Y(e)) {
    const c = (u) => {
      l = !0;
      const [h, d] = Dl(u, t, !0);
      (Ae(i, h), d && a.push(...d));
    };
    (!n && t.mixins.length && t.mixins.forEach(c),
      e.extends && c(e.extends),
      e.mixins && e.mixins.forEach(c));
  }
  if (!o && !l) return (oe(e) && r.set(e, gn), gn);
  if (G(o))
    for (let c = 0; c < o.length; c++) {
      const u = Ie(o[c]);
      Ti(u) && (i[u] = de);
    }
  else if (o)
    for (const c in o) {
      const u = Ie(c);
      if (Ti(u)) {
        const h = o[c],
          d = (i[u] = G(h) || Y(h) ? { type: h } : Ae({}, h)),
          p = d.type;
        let m = !1,
          C = !0;
        if (G(p))
          for (let E = 0; E < p.length; ++E) {
            const w = p[E],
              y = Y(w) && w.name;
            if (y === 'Boolean') {
              m = !0;
              break;
            } else y === 'String' && (C = !1);
          }
        else m = Y(p) && p.name === 'Boolean';
        ((d[0] = m), (d[1] = C), (m || le(d, 'default')) && a.push(u));
      }
    }
  const f = [i, a];
  return (oe(e) && r.set(e, f), f);
}
function Ti(e) {
  return e[0] !== '$' && !Xt(e);
}
const Vo = (e) => e === '_' || e === '_ctx' || e === '$stable',
  Wo = (e) => (G(e) ? e.map(We) : [We(e)]),
  $f = (e, t, n) => {
    if (t._n) return t;
    const r = Dr((...s) => Wo(t(...s)), n);
    return ((r._c = !1), r);
  },
  Ll = (e, t, n) => {
    const r = e._ctx;
    for (const s in e) {
      if (Vo(s)) continue;
      const o = e[s];
      if (Y(o)) t[s] = $f(s, o, r);
      else if (o != null) {
        const i = Wo(o);
        t[s] = () => i;
      }
    }
  },
  Hl = (e, t) => {
    const n = Wo(t);
    e.slots.default = () => n;
  },
  jl = (e, t, n) => {
    for (const r in t) (n || !Vo(r)) && (e[r] = t[r]);
  },
  Uf = (e, t, n) => {
    const r = (e.slots = Ml());
    if (e.vnode.shapeFlag & 32) {
      const s = t._;
      s ? (jl(r, t, n), n && Da(r, '_', s, !0)) : Ll(t, r);
    } else t && Hl(e, t);
  },
  Bf = (e, t, n) => {
    const { vnode: r, slots: s } = e;
    let o = !0,
      i = de;
    if (r.shapeFlag & 32) {
      const a = t._;
      (a ? (n && a === 1 ? (o = !1) : jl(s, t, n)) : ((o = !t.$stable), Ll(t, s)), (i = t));
    } else t && (Hl(e, t), (i = { default: 1 }));
    if (o) for (const a in s) !Vo(a) && i[a] == null && delete s[a];
  },
  we = Kl;
function Vf(e) {
  return Fl(e);
}
function Wf(e) {
  return Fl(e, of);
}
function Fl(e, t) {
  const n = ts();
  n.__VUE__ = !0;
  const {
      insert: r,
      remove: s,
      patchProp: o,
      createElement: i,
      createText: a,
      createComment: l,
      setText: f,
      setElementText: c,
      parentNode: u,
      nextSibling: h,
      setScopeId: d = dt,
      insertStaticContent: p,
    } = e,
    m = (g, b, T, O = null, A = null, x = null, j = void 0, H = null, L = !!b.dynamicChildren) => {
      if (g === b) return;
      (g && !nt(g, b) && ((O = P(g)), De(g, A, x, !0), (g = null)),
        b.patchFlag === -2 && ((L = !1), (b.dynamicChildren = null)));
      const { type: M, ref: J, shapeFlag: U } = b;
      switch (M) {
        case tn:
          C(g, b, T, O);
          break;
        case Re:
          E(g, b, T, O);
          break;
        case Yn:
          g == null && w(b, T, O, j);
          break;
        case He:
          N(g, b, T, O, A, x, j, H, L);
          break;
        default:
          U & 1
            ? v(g, b, T, O, A, x, j, H, L)
            : U & 6
              ? W(g, b, T, O, A, x, j, H, L)
              : (U & 64 || U & 128) && M.process(g, b, T, O, A, x, j, H, L, q);
      }
      J != null && A
        ? vn(J, g && g.ref, x, b || g, !b)
        : J == null && g && g.ref != null && vn(g.ref, null, x, g, !0);
    },
    C = (g, b, T, O) => {
      if (g == null) r((b.el = a(b.children)), T, O);
      else {
        const A = (b.el = g.el);
        b.children !== g.children && f(A, b.children);
      }
    },
    E = (g, b, T, O) => {
      g == null ? r((b.el = l(b.children || '')), T, O) : (b.el = g.el);
    },
    w = (g, b, T, O) => {
      [g.el, g.anchor] = p(g.children, b, T, O, g.el, g.anchor);
    },
    y = ({ el: g, anchor: b }, T, O) => {
      let A;
      for (; g && g !== b; ) ((A = h(g)), r(g, T, O), (g = A));
      r(b, T, O);
    },
    _ = ({ el: g, anchor: b }) => {
      let T;
      for (; g && g !== b; ) ((T = h(g)), s(g), (g = T));
      s(b);
    },
    v = (g, b, T, O, A, x, j, H, L) => {
      if ((b.type === 'svg' ? (j = 'svg') : b.type === 'math' && (j = 'mathml'), g == null))
        R(b, T, O, A, x, j, H, L);
      else {
        const M = g.el && g.el._isVueCE ? g.el : null;
        try {
          (M && M._beginPatch(), k(g, b, A, x, j, H, L));
        } finally {
          M && M._endPatch();
        }
      }
    },
    R = (g, b, T, O, A, x, j, H) => {
      let L, M;
      const { props: J, shapeFlag: U, transition: K, dirs: Q } = g;
      if (
        ((L = g.el = i(g.type, x, J && J.is, J)),
        U & 8 ? c(L, g.children) : U & 16 && I(g.children, L, null, O, A, Rs(g, x), j, H),
        Q && ct(g, null, O, 'created'),
        S(L, g, g.scopeId, j, O),
        J)
      ) {
        for (const fe in J) fe !== 'value' && !Xt(fe) && o(L, fe, null, J[fe], x, O);
        ('value' in J && o(L, 'value', null, J.value, x),
          (M = J.onVnodeBeforeMount) && Le(M, O, g));
      }
      Q && ct(g, null, O, 'beforeMount');
      const ne = $l(A, K);
      (ne && K.beforeEnter(L),
        r(L, b, T),
        ((M = J && J.onVnodeMounted) || ne || Q) &&
          we(() => {
            (M && Le(M, O, g), ne && K.enter(L), Q && ct(g, null, O, 'mounted'));
          }, A));
    },
    S = (g, b, T, O, A) => {
      if ((T && d(g, T), O)) for (let x = 0; x < O.length; x++) d(g, O[x]);
      if (A) {
        let x = A.subTree;
        if (b === x || ($r(x.type) && (x.ssContent === b || x.ssFallback === b))) {
          const j = A.vnode;
          S(g, j, j.scopeId, j.slotScopeIds, A.parent);
        }
      }
    },
    I = (g, b, T, O, A, x, j, H, L = 0) => {
      for (let M = L; M < g.length; M++) {
        const J = (g[M] = H ? vt(g[M]) : We(g[M]));
        m(null, J, b, T, O, A, x, j, H);
      }
    },
    k = (g, b, T, O, A, x, j) => {
      const H = (b.el = g.el);
      let { patchFlag: L, dynamicChildren: M, dirs: J } = b;
      L |= g.patchFlag & 16;
      const U = g.props || de,
        K = b.props || de;
      let Q;
      if (
        (T && Vt(T, !1),
        (Q = K.onVnodeBeforeUpdate) && Le(Q, T, b, g),
        J && ct(b, g, T, 'beforeUpdate'),
        T && Vt(T, !0),
        M &&
          (!g.dynamicChildren || g.dynamicChildren.length !== M.length) &&
          ((L = 0), (j = !1), (M = null)),
        ((U.innerHTML && K.innerHTML == null) || (U.textContent && K.textContent == null)) &&
          c(H, ''),
        M
          ? D(g.dynamicChildren, M, H, T, O, Rs(b, A), x)
          : j || z(g, b, H, null, T, O, Rs(b, A), x, !1),
        L > 0)
      ) {
        if (L & 16) F(H, U, K, T, A);
        else if (
          (L & 2 && U.class !== K.class && o(H, 'class', null, K.class, A),
          L & 4 && o(H, 'style', U.style, K.style, A),
          L & 8)
        ) {
          const ne = b.dynamicProps;
          for (let fe = 0; fe < ne.length; fe++) {
            const ue = ne[fe],
              ve = U[ue],
              Te = K[ue];
            (Te !== ve || ue === 'value') && o(H, ue, ve, Te, A, T);
          }
        }
        L & 1 && g.children !== b.children && c(H, b.children);
      } else !j && M == null && F(H, U, K, T, A);
      ((Q = K.onVnodeUpdated) || J) &&
        we(() => {
          (Q && Le(Q, T, b, g), J && ct(b, g, T, 'updated'));
        }, O);
    },
    D = (g, b, T, O, A, x, j) => {
      for (let H = 0; H < b.length; H++) {
        const L = g[H],
          M = b[H],
          J = L.el && (L.type === He || !nt(L, M) || L.shapeFlag & 198) ? u(L.el) : T;
        m(L, M, J, null, O, A, x, j, !0);
      }
    },
    F = (g, b, T, O, A) => {
      if (b !== T) {
        if (b !== de) for (const x in b) !Xt(x) && !(x in T) && o(g, x, b[x], null, A, O);
        for (const x in T) {
          if (Xt(x)) continue;
          const j = T[x],
            H = b[x];
          j !== H && x !== 'value' && o(g, x, H, j, A, O);
        }
        'value' in T && o(g, 'value', b.value, T.value, A);
      }
    },
    N = (g, b, T, O, A, x, j, H, L) => {
      const M = (b.el = g ? g.el : a('')),
        J = (b.anchor = g ? g.anchor : a(''));
      let { patchFlag: U, dynamicChildren: K, slotScopeIds: Q } = b;
      (Q && (H = H ? H.concat(Q) : Q),
        g == null
          ? (r(M, T, O), r(J, T, O), I(b.children || [], T, J, A, x, j, H, L))
          : U > 0 && U & 64 && K && g.dynamicChildren && g.dynamicChildren.length === K.length
            ? (D(g.dynamicChildren, K, T, A, x, j, H),
              (b.key != null || (A && b === A.subTree)) && Ko(g, b, !0))
            : z(g, b, T, J, A, x, j, H, L));
    },
    W = (g, b, T, O, A, x, j, H, L) => {
      ((b.slotScopeIds = H),
        g == null
          ? b.shapeFlag & 512
            ? A.ctx.activate(b, T, O, j, L)
            : X(b, T, O, A, x, j, L)
          : se(g, b, L));
    },
    X = (g, b, T, O, A, x, j) => {
      const H = (g.component = rd(g, O, A));
      if ((hr(g) && (H.ctx.renderer = q), sd(H, !1, j), H.asyncDep)) {
        if ((A && A.registerDep(H, V, j), !g.el)) {
          const L = (H.subTree = me(Re));
          (E(null, L, b, T), (g.placeholder = L.el));
        }
      } else V(H, g, b, T, A, x, j);
    },
    se = (g, b, T) => {
      const O = (b.component = g.component);
      if (Lf(g, b, T))
        if (O.asyncDep && !O.asyncResolved) {
          Z(O, b, T);
          return;
        } else ((O.next = b), O.update());
      else ((b.el = g.el), (O.vnode = b));
    },
    V = (g, b, T, O, A, x, j) => {
      const H = () => {
        if (g.isMounted) {
          let { next: U, bu: K, u: Q, parent: ne, vnode: fe } = g;
          {
            const Be = Ul(g);
            if (Be) {
              (U && ((U.el = fe.el), Z(g, U, j)),
                Be.asyncDep.then(() => {
                  we(() => {
                    g.isUnmounted || M();
                  }, A);
                }));
              return;
            }
          }
          let ue = U,
            ve;
          (Vt(g, !1),
            U ? ((U.el = fe.el), Z(g, U, j)) : (U = fe),
            K && yn(K),
            (ve = U.props && U.props.onVnodeBeforeUpdate) && Le(ve, ne, U, fe),
            Vt(g, !0));
          const Te = Ss(g),
            et = g.subTree;
          ((g.subTree = Te),
            m(et, Te, u(et.el), P(et), g, A, x),
            (U.el = Te.el),
            ue === null && us(g, Te.el),
            Q && we(Q, A),
            (ve = U.props && U.props.onVnodeUpdated) && we(() => Le(ve, ne, U, fe), A));
        } else {
          let U;
          const { el: K, props: Q } = b,
            { bm: ne, m: fe, parent: ue, root: ve, type: Te } = g,
            et = jt(b);
          if (
            (Vt(g, !1),
            ne && yn(ne),
            !et && (U = Q && Q.onVnodeBeforeMount) && Le(U, ue, b),
            Vt(g, !0),
            K && ge)
          ) {
            const Be = () => {
              ((g.subTree = Ss(g)), ge(K, g.subTree, g, A, null));
            };
            et && Te.__asyncHydrate ? Te.__asyncHydrate(K, g, Be) : Be();
          } else {
            ve.ce &&
              ve.ce._hasShadowRoot() &&
              ve.ce._injectChildStyle(Te, g.parent ? g.parent.type : void 0);
            const Be = (g.subTree = Ss(g));
            (m(null, Be, T, O, g, A, x), (b.el = Be.el));
          }
          if ((fe && we(fe, A), !et && (U = Q && Q.onVnodeMounted))) {
            const Be = b;
            we(() => Le(U, ue, Be), A);
          }
          ((b.shapeFlag & 256 || (ue && jt(ue.vnode) && ue.vnode.shapeFlag & 256)) &&
            g.a &&
            we(g.a, A),
            (g.isMounted = !0),
            (b = T = O = null));
        }
      };
      g.scope.on();
      const L = (g.effect = new Ua(H));
      g.scope.off();
      const M = (g.update = L.run.bind(L)),
        J = (g.job = L.runIfDirty.bind(L));
      ((J.i = g), (J.id = g.uid), (L.scheduler = () => jo(J)), Vt(g, !0), M());
    },
    Z = (g, b, T) => {
      b.component = g;
      const O = g.vnode.props;
      ((g.vnode = b),
        (g.next = null),
        jf(g, b.props, O, T),
        Bf(g, b.children, T),
        ht(),
        li(g),
        pt());
    },
    z = (g, b, T, O, A, x, j, H, L = !1) => {
      const M = g && g.children,
        J = g ? g.shapeFlag : 0,
        U = b.children,
        { patchFlag: K, shapeFlag: Q } = b;
      if (K > 0) {
        if (K & 128) {
          ie(M, U, T, O, A, x, j, H, L);
          return;
        } else if (K & 256) {
          Pe(M, U, T, O, A, x, j, H, L);
          return;
        }
      }
      Q & 8
        ? (J & 16 && Ge(M, A, x), U !== M && c(T, U))
        : J & 16
          ? Q & 16
            ? ie(M, U, T, O, A, x, j, H, L)
            : Ge(M, A, x, !0)
          : (J & 8 && c(T, ''), Q & 16 && I(U, T, O, A, x, j, H, L));
    },
    Pe = (g, b, T, O, A, x, j, H, L) => {
      ((g = g || gn), (b = b || gn));
      const M = g.length,
        J = b.length,
        U = Math.min(M, J);
      let K;
      for (K = 0; K < U; K++) {
        const Q = (b[K] = L ? vt(b[K]) : We(b[K]));
        m(g[K], Q, T, null, A, x, j, H, L);
      }
      M > J ? Ge(g, A, x, !0, !1, U) : I(b, T, O, A, x, j, H, L, U);
    },
    ie = (g, b, T, O, A, x, j, H, L) => {
      let M = 0;
      const J = b.length;
      let U = g.length - 1,
        K = J - 1;
      for (; M <= U && M <= K; ) {
        const Q = g[M],
          ne = (b[M] = L ? vt(b[M]) : We(b[M]));
        if (nt(Q, ne)) m(Q, ne, T, null, A, x, j, H, L);
        else break;
        M++;
      }
      for (; M <= U && M <= K; ) {
        const Q = g[U],
          ne = (b[K] = L ? vt(b[K]) : We(b[K]));
        if (nt(Q, ne)) m(Q, ne, T, null, A, x, j, H, L);
        else break;
        (U--, K--);
      }
      if (M > U) {
        if (M <= K) {
          const Q = K + 1,
            ne = Q < J ? b[Q].el : O;
          for (; M <= K; ) (m(null, (b[M] = L ? vt(b[M]) : We(b[M])), T, ne, A, x, j, H, L), M++);
        }
      } else if (M > K) for (; M <= U; ) (De(g[M], A, x, !0), M++);
      else {
        const Q = M,
          ne = M,
          fe = new Map();
        for (M = ne; M <= K; M++) {
          const Ve = (b[M] = L ? vt(b[M]) : We(b[M]));
          Ve.key != null && fe.set(Ve.key, M);
        }
        let ue,
          ve = 0;
        const Te = K - ne + 1;
        let et = !1,
          Be = 0;
        const Dn = new Array(Te);
        for (M = 0; M < Te; M++) Dn[M] = 0;
        for (M = Q; M <= U; M++) {
          const Ve = g[M];
          if (ve >= Te) {
            De(Ve, A, x, !0);
            continue;
          }
          let at;
          if (Ve.key != null) at = fe.get(Ve.key);
          else
            for (ue = ne; ue <= K; ue++)
              if (Dn[ue - ne] === 0 && nt(Ve, b[ue])) {
                at = ue;
                break;
              }
          at === void 0
            ? De(Ve, A, x, !0)
            : ((Dn[at - ne] = M + 1),
              at >= Be ? (Be = at) : (et = !0),
              m(Ve, b[at], T, null, A, x, j, H, L),
              ve++);
        }
        const ti = et ? Kf(Dn) : gn;
        for (ue = ti.length - 1, M = Te - 1; M >= 0; M--) {
          const Ve = ne + M,
            at = b[Ve],
            ni = b[Ve + 1],
            ri = Ve + 1 < J ? ni.el || Bl(ni) : O;
          Dn[M] === 0
            ? m(null, at, T, ri, A, x, j, H, L)
            : et && (ue < 0 || M !== ti[ue] ? ce(at, T, ri, 2) : ue--);
        }
      }
    },
    ce = (g, b, T, O, A = null) => {
      const { el: x, type: j, transition: H, children: L, shapeFlag: M } = g;
      if (M & 6) {
        ce(g.component.subTree, b, T, O);
        return;
      }
      if (M & 128) {
        g.suspense.move(b, T, O);
        return;
      }
      if (M & 64) {
        j.move(g, b, T, q);
        return;
      }
      if (j === He) {
        r(x, b, T);
        for (let U = 0; U < L.length; U++) ce(L[U], b, T, O);
        r(g.anchor, b, T);
        return;
      }
      if (j === Yn) {
        y(g, b, T);
        return;
      }
      if (O !== 2 && M & 1 && H)
        if (O === 0)
          H.persisted && !x[Qe]
            ? r(x, b, T)
            : (H.beforeEnter(x), r(x, b, T), we(() => H.enter(x), A));
        else {
          const { leave: U, delayLeave: K, afterLeave: Q } = H,
            ne = () => {
              g.ctx.isUnmounted ? s(x) : r(x, b, T);
            },
            fe = () => {
              const ue = x._isLeaving || !!x[Qe];
              (x._isLeaving && x[Qe](!0),
                H.persisted && !ue
                  ? ne()
                  : U(x, () => {
                      (ne(), Q && Q());
                    }));
            };
          K ? K(x, ne, fe) : fe();
        }
      else r(x, b, T);
    },
    De = (g, b, T, O = !1, A = !1) => {
      const {
        type: x,
        props: j,
        ref: H,
        children: L,
        dynamicChildren: M,
        shapeFlag: J,
        patchFlag: U,
        dirs: K,
        cacheIndex: Q,
        memo: ne,
      } = g;
      if (
        (U === -2 && (A = !1),
        H != null && (ht(), vn(H, null, T, g, !0), pt()),
        Q != null && (b.renderCache[Q] = void 0),
        J & 256)
      ) {
        b.ctx.deactivate(g);
        return;
      }
      const fe = J & 1 && K,
        ue = !jt(g);
      let ve;
      if ((ue && (ve = j && j.onVnodeBeforeUnmount) && Le(ve, b, g), J & 6)) Bt(g.component, T, O);
      else {
        if (J & 128) {
          g.suspense.unmount(T, O);
          return;
        }
        (fe && ct(g, null, b, 'beforeUnmount'),
          J & 64
            ? g.type.remove(g, b, T, q, O)
            : M && !M.hasOnce && (x !== He || (U > 0 && U & 64))
              ? Ge(M, b, T, !1, !0)
              : ((x === He && U & 384) || (!A && J & 16)) && Ge(L, b, T),
          O && on(g));
      }
      const Te = ne != null && Q == null;
      ((ue && (ve = j && j.onVnodeUnmounted)) || fe || Te) &&
        we(() => {
          (ve && Le(ve, b, g), fe && ct(g, null, b, 'unmounted'), Te && (g.el = null));
        }, T);
    },
    on = (g) => {
      const { type: b, el: T, anchor: O, transition: A } = g;
      if (b === He) {
        an(T, O);
        return;
      }
      if (b === Yn) {
        _(g);
        return;
      }
      const x = () => {
        (s(T), A && !A.persisted && A.afterLeave && A.afterLeave());
      };
      if (g.shapeFlag & 1 && A && !A.persisted) {
        const { leave: j, delayLeave: H } = A,
          L = () => j(T, x);
        H ? H(g.el, x, L) : L();
      } else x();
    },
    an = (g, b) => {
      let T;
      for (; g !== b; ) ((T = h(g)), s(g), (g = T));
      s(b);
    },
    Bt = (g, b, T) => {
      const { bum: O, scope: A, job: x, subTree: j, um: H, m: L, a: M } = g;
      (Fr(L),
        Fr(M),
        O && yn(O),
        A.stop(),
        x && ((x.flags |= 8), De(j, g, b, T)),
        H && we(H, b),
        we(() => {
          g.isUnmounted = !0;
        }, b));
    },
    Ge = (g, b, T, O = !1, A = !1, x = 0) => {
      for (let j = x; j < g.length; j++) De(g[j], b, T, O, A);
    },
    P = (g) => {
      if (g.shapeFlag & 6) return P(g.component.subTree);
      if (g.shapeFlag & 128) return g.suspense.next();
      const b = h(g.anchor || g.el),
        T = b && b[ul];
      return T ? h(T) : b;
    };
  let B = !1;
  const $ = (g, b, T) => {
      let O;
      (g == null
        ? b._vnode && (De(b._vnode, null, null, !0), (O = b._vnode.component))
        : m(b._vnode || null, g, b, null, null, null, T),
        (b._vnode = g),
        B || ((B = !0), li(O), Nr(), (B = !1)));
    },
    q = { p: m, um: De, m: ce, r: on, mt: X, mc: I, pc: z, pbc: D, n: P, o: e };
  let te, ge;
  return (t && ([te, ge] = t(q)), { render: $, hydrate: te, createApp: kf($, te) });
}
function Rs({ type: e, props: t }, n) {
  return (n === 'svg' && e === 'foreignObject') ||
    (n === 'mathml' && e === 'annotation-xml' && t && t.encoding && t.encoding.includes('html'))
    ? void 0
    : n;
}
function Vt({ effect: e, job: t }, n) {
  n ? ((e.flags |= 32), (t.flags |= 4)) : ((e.flags &= -33), (t.flags &= -5));
}
function $l(e, t) {
  return (!e || (e && !e.pendingBranch)) && t && !t.persisted;
}
function Ko(e, t, n = !1) {
  const r = e.children,
    s = t.children;
  if (G(r) && G(s))
    for (let o = 0; o < r.length; o++) {
      const i = r[o];
      let a = s[o];
      (a.shapeFlag & 1 &&
        !a.dynamicChildren &&
        ((a.patchFlag <= 0 || a.patchFlag === 32) && ((a = s[o] = vt(s[o])), (a.el = i.el)),
        !n && a.patchFlag !== -2 && Ko(i, a)),
        a.type === tn && (a.patchFlag === -1 && (a = s[o] = vt(a)), (a.el = i.el)),
        a.type === Re && !a.el && (a.el = i.el));
    }
}
function Kf(e) {
  const t = e.slice(),
    n = [0];
  let r, s, o, i, a;
  const l = e.length;
  for (r = 0; r < l; r++) {
    const f = e[r];
    if (f !== 0) {
      if (((s = n[n.length - 1]), e[s] < f)) {
        ((t[r] = s), n.push(r));
        continue;
      }
      for (o = 0, i = n.length - 1; o < i; )
        ((a = (o + i) >> 1), e[n[a]] < f ? (o = a + 1) : (i = a));
      f < e[n[o]] && (o > 0 && (t[r] = n[o - 1]), (n[o] = r));
    }
  }
  for (o = n.length, i = n[o - 1]; o-- > 0; ) ((n[o] = i), (i = t[i]));
  return n;
}
function Ul(e) {
  const t = e.subTree.component;
  if (t) return t.asyncDep && !t.asyncResolved ? t : Ul(t);
}
function Fr(e) {
  if (e) for (let t = 0; t < e.length; t++) e[t].flags |= 8;
}
function Bl(e) {
  if (e.placeholder) return e.placeholder;
  const t = e.component;
  return t ? Bl(t.subTree) : null;
}
const $r = (e) => e.__isSuspense;
let Zs = 0;
const qf = {
    name: 'Suspense',
    __isSuspense: !0,
    process(e, t, n, r, s, o, i, a, l, f) {
      if (e == null) Gf(t, n, r, s, o, i, a, l, f);
      else {
        if (o && o.deps > 0 && !e.suspense.isInFallback) {
          ((t.suspense = e.suspense), (t.suspense.vnode = t), (t.el = e.el));
          return;
        }
        Jf(e, t, n, r, s, i, a, l, f);
      }
    },
    hydrate: Yf,
    normalize: zf,
  },
  Vl = qf;
function sr(e, t) {
  const n = e.props && e.props[t];
  Y(n) && n();
}
function Gf(e, t, n, r, s, o, i, a, l) {
  const {
      p: f,
      o: { createElement: c },
    } = l,
    u = c('div'),
    h = (e.suspense = Wl(e, s, r, t, u, n, o, i, a, l));
  (f(null, (h.pendingBranch = e.ssContent), u, null, r, h, o, i),
    h.deps > 0
      ? (sr(e, 'onPending'),
        sr(e, 'onFallback'),
        f(null, e.ssFallback, t, n, r, null, o, i),
        wn(h, e.ssFallback))
      : h.resolve(!1, !0));
}
function Jf(e, t, n, r, s, o, i, a, { p: l, um: f, o: { createElement: c } }) {
  const u = (t.suspense = e.suspense);
  ((u.vnode = t), (t.el = e.el));
  const h = t.ssContent,
    d = t.ssFallback,
    { activeBranch: p, pendingBranch: m, isInFallback: C, isHydrating: E } = u;
  if (m)
    ((u.pendingBranch = h),
      nt(m, h)
        ? (l(m, h, u.hiddenContainer, null, s, u, o, i, a),
          u.deps <= 0 ? u.resolve() : C && (E || (l(p, d, n, r, s, null, o, i, a), wn(u, d))))
        : ((u.pendingId = Zs++),
          E ? ((u.isHydrating = !1), (u.activeBranch = m)) : f(m, s, u),
          (u.deps = 0),
          (u.effects.length = 0),
          (u.hiddenContainer = c('div')),
          C
            ? (l(null, h, u.hiddenContainer, null, s, u, o, i, a),
              u.deps <= 0 ? u.resolve() : (l(p, d, n, r, s, null, o, i, a), wn(u, d)))
            : p && nt(p, h)
              ? (l(p, h, n, r, s, u, o, i, a), u.resolve(!0))
              : (l(null, h, u.hiddenContainer, null, s, u, o, i, a), u.deps <= 0 && u.resolve())));
  else if (p && nt(p, h)) (l(p, h, n, r, s, u, o, i, a), wn(u, h));
  else if (
    (sr(t, 'onPending'),
    (u.pendingBranch = h),
    h.shapeFlag & 512 ? (u.pendingId = h.component.suspenseId) : (u.pendingId = Zs++),
    l(null, h, u.hiddenContainer, null, s, u, o, i, a),
    u.deps <= 0)
  )
    u.resolve();
  else {
    const { timeout: w, pendingId: y } = u;
    w > 0
      ? setTimeout(() => {
          u.pendingId === y && u.fallback(d);
        }, w)
      : w === 0 && u.fallback(d);
  }
}
function Wl(e, t, n, r, s, o, i, a, l, f, c = !1) {
  const {
    p: u,
    m: h,
    um: d,
    n: p,
    o: { parentNode: m, remove: C },
  } = f;
  let E;
  const w = Qf(e);
  w && t && t.pendingBranch && ((E = t.pendingId), t.deps++);
  const y = e.props ? La(e.props.timeout) : void 0,
    _ = o,
    v = {
      vnode: e,
      parent: t,
      parentComponent: n,
      namespace: i,
      container: r,
      hiddenContainer: s,
      deps: 0,
      pendingId: Zs++,
      timeout: typeof y == 'number' ? y : -1,
      activeBranch: null,
      isFallbackMountPending: !1,
      pendingBranch: null,
      isInFallback: !c,
      isHydrating: c,
      isUnmounted: !1,
      effects: [],
      resolve(R = !1, S = !1) {
        const {
          vnode: I,
          activeBranch: k,
          pendingBranch: D,
          pendingId: F,
          effects: N,
          parentComponent: W,
          container: X,
          isInFallback: se,
        } = v;
        let V = !1;
        if (v.isHydrating) v.isHydrating = !1;
        else if (!R) {
          V = k && D.transition && D.transition.mode === 'out-in';
          let Pe = !1;
          (V &&
            (k.transition.afterLeave = () => {
              F === v.pendingId &&
                (h(D, X, o === _ && !Pe ? p(k) : o, 0),
                nr(N),
                se && I.ssFallback && (I.ssFallback.el = null));
            }),
            k &&
              !v.isFallbackMountPending &&
              (m(k.el) === X && ((o = p(k)), (Pe = !0)),
              d(k, W, v, !0),
              !V && se && I.ssFallback && we(() => (I.ssFallback.el = null), v)),
            V || h(D, X, o, 0));
        }
        ((v.isFallbackMountPending = !1),
          wn(v, D),
          (v.pendingBranch = null),
          (v.isInFallback = !1));
        let Z = v.parent,
          z = !1;
        for (; Z; ) {
          if (Z.pendingBranch) {
            (Z.effects.push(...N), (z = !0));
            break;
          }
          Z = Z.parent;
        }
        (!z && !V && nr(N),
          (v.effects = []),
          w &&
            t &&
            t.pendingBranch &&
            E === t.pendingId &&
            (t.deps--, t.deps === 0 && !S && t.resolve()),
          sr(I, 'onResolve'));
      },
      fallback(R) {
        if (!v.pendingBranch) return;
        const { vnode: S, activeBranch: I, parentComponent: k, container: D, namespace: F } = v;
        sr(S, 'onFallback');
        const N = p(I),
          W = () => {
            ((v.isFallbackMountPending = !1),
              v.isInFallback && (u(null, R, D, N, k, null, F, a, l), wn(v, R)));
          },
          X = R.transition && R.transition.mode === 'out-in';
        (X && ((v.isFallbackMountPending = !0), (I.transition.afterLeave = W)),
          (v.isInFallback = !0),
          d(I, k, null, !0),
          X || W());
      },
      move(R, S, I) {
        (v.activeBranch && h(v.activeBranch, R, S, I), (v.container = R));
      },
      next() {
        return v.activeBranch && p(v.activeBranch);
      },
      registerDep(R, S, I) {
        const k = !!v.pendingBranch;
        k && v.deps++;
        const D = R.vnode.el;
        R.asyncDep
          .catch((F) => {
            On(F, R, 0);
          })
          .then((F) => {
            if (R.isUnmounted || v.isUnmounted || v.pendingId !== R.suspenseId) return;
            (or(), (R.asyncResolved = !0));
            const { vnode: N } = R;
            (to(R, F), D && (N.el = D));
            const W = !D && R.subTree.el;
            (S(R, N, m(D || R.subTree.el), D ? null : p(R.subTree), v, i, I),
              W && ((N.placeholder = null), C(W)),
              us(R, N.el),
              k && --v.deps === 0 && v.resolve());
          });
      },
      unmount(R, S) {
        ((v.isUnmounted = !0),
          v.activeBranch && d(v.activeBranch, n, R, S),
          v.pendingBranch && d(v.pendingBranch, n, R, S));
      },
    };
  return v;
}
function Yf(e, t, n, r, s, o, i, a, l) {
  const f = (t.suspense = Wl(
      t,
      r,
      n,
      e.parentNode,
      document.createElement('div'),
      null,
      s,
      o,
      i,
      a,
      !0,
    )),
    c = l(e, (f.pendingBranch = t.ssContent), n, f, o, i);
  return (f.deps === 0 && f.resolve(!1, !0), c);
}
function zf(e) {
  const { shapeFlag: t, children: n } = e,
    r = t & 32;
  ((e.ssContent = Ci(r ? n.default : n)), (e.ssFallback = r ? Ci(n.fallback) : me(Re)));
}
function Ci(e) {
  let t;
  if (Y(e)) {
    const n = Rn && e._c;
    (n && ((e._d = !1), tt()), (e = e()), n && ((e._d = !0), (t = je), ql()));
  }
  return (
    G(e) && (e = Nf(e)),
    (e = We(e)),
    t && !e.dynamicChildren && (e.dynamicChildren = t.filter((n) => n !== e)),
    e
  );
}
function Kl(e, t) {
  t && t.pendingBranch ? (G(e) ? t.effects.push(...e) : t.effects.push(e)) : nr(e);
}
function wn(e, t) {
  e.activeBranch = t;
  const { vnode: n, parentComponent: r } = e;
  let s = t.el;
  for (; !s && t.component; ) ((t = t.component.subTree), (s = t.el));
  ((n.el = s), r && r.subTree === n && ((r.vnode.el = s), us(r, s)));
}
function Qf(e) {
  const t = e.props && e.props.suspensible;
  return t != null && t !== !1;
}
const He = Symbol.for('v-fgt'),
  tn = Symbol.for('v-txt'),
  Re = Symbol.for('v-cmt'),
  Yn = Symbol.for('v-stc'),
  zn = [];
let je = null;
function tt(e = !1) {
  zn.push((je = e ? null : []));
}
function ql() {
  (zn.pop(), (je = zn[zn.length - 1] || null));
}
let Rn = 1;
function Ur(e, t = !1) {
  ((Rn += e), e < 0 && je && t && (je.hasOnce = !0));
}
function Gl(e) {
  return ((e.dynamicChildren = Rn > 0 ? je || gn : null), ql(), Rn > 0 && je && je.push(e), e);
}
function eo(e, t, n, r, s, o) {
  return Gl(Ye(e, t, n, r, s, o, !0));
}
function zt(e, t, n, r, s) {
  return Gl(me(e, t, n, r, s, !0));
}
function An(e) {
  return e ? e.__v_isVNode === !0 : !1;
}
function nt(e, t) {
  return e.type === t.type && e.key === t.key;
}
const Jl = ({ key: e }) => e ?? null,
  Pr = ({ ref: e, ref_key: t, ref_for: n }) => (
    typeof e == 'number' && (e = '' + e),
    e != null ? (he(e) || Ee(e) || Y(e) ? { i: Ke, r: e, k: t, f: !!n } : e) : null
  );
function Ye(e, t = null, n = null, r = 0, s = null, o = e === He ? 0 : 1, i = !1, a = !1) {
  const l = {
    __v_isVNode: !0,
    __v_skip: !0,
    type: e,
    props: t,
    key: t && Jl(t),
    ref: t && Pr(t),
    scopeId: ll,
    slotScopeIds: null,
    children: n,
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
    patchFlag: r,
    dynamicProps: s,
    dynamicChildren: null,
    appContext: null,
    ctx: Ke,
  };
  return (
    a ? (Vr(l, n), o & 128 && e.normalize(l)) : n && (l.shapeFlag |= he(n) ? 8 : 16),
    Rn > 0 && !i && je && (l.patchFlag > 0 || o & 6) && l.patchFlag !== 32 && je.push(l),
    l
  );
}
const me = Xf;
function Xf(e, t = null, n = null, r = 0, s = null, o = !1) {
  if (((!e || e === Cl) && (e = Re), An(e))) {
    const a = At(e, t, !0);
    return (
      n && Vr(a, n),
      Rn > 0 && !o && je && (a.shapeFlag & 6 ? (je[je.indexOf(e)] = a) : je.push(a)),
      (a.patchFlag = -2),
      a
    );
  }
  if ((ld(e) && (e = e.__vccOpts), t)) {
    t = Yl(t);
    let { class: a, style: l } = t;
    (a && !he(a) && (t.class = rs(a)),
      oe(l) && (os(l) && !G(l) && (l = Ae({}, l)), (t.style = ns(l))));
  }
  const i = he(e) ? 1 : $r(e) ? 128 : fl(e) ? 64 : oe(e) ? 4 : Y(e) ? 2 : 0;
  return Ye(e, t, n, r, s, i, o, !0);
}
function Yl(e) {
  return e ? (os(e) || Nl(e) ? Ae({}, e) : e) : null;
}
function At(e, t, n = !1, r = !1) {
  const { props: s, ref: o, patchFlag: i, children: a, transition: l } = e,
    f = t ? ed(s || {}, t) : s,
    c = {
      __v_isVNode: !0,
      __v_skip: !0,
      type: e.type,
      props: f,
      key: f && Jl(f),
      ref: t && t.ref ? (n && o ? (G(o) ? o.concat(Pr(t)) : [o, Pr(t)]) : Pr(t)) : o,
      scopeId: e.scopeId,
      slotScopeIds: e.slotScopeIds,
      children: a,
      target: e.target,
      targetStart: e.targetStart,
      targetAnchor: e.targetAnchor,
      staticCount: e.staticCount,
      shapeFlag: e.shapeFlag,
      patchFlag: t && e.type !== He ? (i === -1 ? 16 : i | 16) : i,
      dynamicProps: e.dynamicProps,
      dynamicChildren: e.dynamicChildren,
      appContext: e.appContext,
      dirs: e.dirs,
      transition: l,
      component: e.component,
      suspense: e.suspense,
      ssContent: e.ssContent && At(e.ssContent),
      ssFallback: e.ssFallback && At(e.ssFallback),
      placeholder: e.placeholder,
      el: e.el,
      anchor: e.anchor,
      ctx: e.ctx,
      ce: e.ce,
    };
  return (l && r && Sn(c, l.clone(c)), c);
}
function Br(e = ' ', t = 0) {
  return me(tn, null, e, t);
}
function Uy(e, t) {
  const n = me(Yn, null, e);
  return ((n.staticCount = t), n);
}
function Zf(e = '', t = !1) {
  return t ? (tt(), zt(Re, null, e)) : me(Re, null, e);
}
function We(e) {
  return e == null || typeof e == 'boolean'
    ? me(Re)
    : G(e)
      ? me(He, null, e.slice())
      : An(e)
        ? vt(e)
        : me(tn, null, String(e));
}
function vt(e) {
  return (e.el === null && e.patchFlag !== -1) || e.memo ? e : At(e);
}
function Vr(e, t) {
  let n = 0;
  const { shapeFlag: r } = e;
  if (t == null) t = null;
  else if (G(t)) n = 16;
  else if (typeof t == 'object')
    if (r & 65) {
      const s = t.default;
      s && (s._c && (s._d = !1), Vr(e, s()), s._c && (s._d = !0));
      return;
    } else {
      n = 32;
      const s = t._;
      !s && !Nl(t)
        ? (t._ctx = Ke)
        : s === 3 && Ke && (Ke.slots._ === 1 ? (t._ = 1) : ((t._ = 2), (e.patchFlag |= 1024)));
    }
  else if (Y(t)) {
    if (r & 65) {
      Vr(e, { default: t });
      return;
    }
    ((t = { default: t, _ctx: Ke }), (n = 32));
  } else ((t = String(t)), r & 64 ? ((n = 16), (t = [Br(t)])) : (n = 8));
  ((e.children = t), (e.shapeFlag |= n));
}
function ed(...e) {
  const t = {};
  for (let n = 0; n < e.length; n++) {
    const r = e[n];
    for (const s in r)
      if (s === 'class') t.class !== r.class && (t.class = rs([t.class, r.class]));
      else if (s === 'style') t.style = ns([t.style, r.style]);
      else if (fr(s)) {
        const o = t[s],
          i = r[s];
        i && o !== i && !(G(o) && o.includes(i))
          ? (t[s] = o ? [].concat(o, i) : i)
          : i == null && o == null && !Qr(s) && (t[s] = i);
      } else s !== '' && (t[s] = r[s]);
  }
  return t;
}
function Le(e, t, n, r = null) {
  Ze(e, t, 7, [n, r]);
}
const td = Pl();
let nd = 0;
function rd(e, t, n) {
  const r = e.type,
    s = (t ? t.appContext : e.appContext) || td,
    o = {
      uid: nd++,
      vnode: e,
      type: r,
      parent: t,
      appContext: s,
      root: null,
      next: null,
      subTree: null,
      effect: null,
      update: null,
      job: null,
      scope: new $a(!0),
      render: null,
      proxy: null,
      exposed: null,
      exposeProxy: null,
      withProxy: null,
      provides: t ? t.provides : Object.create(s.provides),
      ids: t ? t.ids : ['', 0, 0],
      accessCache: null,
      renderCache: [],
      components: null,
      directives: null,
      propsOptions: Dl(r, s),
      emitsOptions: kl(r, s),
      emit: null,
      emitted: null,
      propsDefaults: de,
      inheritAttrs: r.inheritAttrs,
      ctx: de,
      data: de,
      props: de,
      attrs: de,
      slots: de,
      refs: de,
      setupState: de,
      setupContext: null,
      suspense: n,
      suspenseId: n ? n.pendingId : 0,
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
    (o.emit = Of.bind(null, o)),
    e.ce && e.ce(o),
    o
  );
}
let ke = null;
const Pt = () => ke || Ke;
let Wr, En;
{
  const e = ts(),
    t = (n, r) => {
      let s;
      return (
        (s = e[n]) || (s = e[n] = []),
        s.push(r),
        (o) => {
          s.length > 1 ? s.forEach((i) => i(o)) : s[0](o);
        }
      );
    };
  ((Wr = t('__VUE_INSTANCE_SETTERS__', (n) => (ke = n))),
    (En = t('__VUE_SSR_SETTERS__', (n) => (nn = n))));
}
const Nn = (e) => {
    const t = ke;
    return (
      Wr(e),
      e.scope.on(),
      () => {
        (e.scope.off(), Wr(t));
      }
    );
  },
  or = () => {
    (ke && ke.scope.off(), Wr(null));
  };
function zl(e) {
  return e.vnode.shapeFlag & 4;
}
let nn = !1;
function sd(e, t = !1, n = !1) {
  t && En(t);
  const { props: r, children: s } = e.vnode,
    o = zl(e);
  (Hf(e, r, o, t), Uf(e, s, n || t));
  const i = o ? od(e, t) : void 0;
  return (t && En(!1), i);
}
function od(e, t) {
  const n = e.type;
  ((e.accessCache = Object.create(null)), (e.proxy = new Proxy(e.ctx, wf)));
  const { setup: r } = n;
  if (r) {
    ht();
    const s = (e.setupContext = r.length > 1 ? ad(e) : null),
      o = Nn(e),
      i = dr(r, e, 0, [e.props, s]),
      a = Po(i);
    if ((pt(), o(), (a || e.sp) && !jt(e) && Uo(e), a)) {
      if ((i.then(or, or), t))
        return i
          .then((l) => {
            to(e, l);
          })
          .catch((l) => {
            On(l, e, 0);
          });
      e.asyncDep = i;
    } else to(e, i);
  } else Ql(e);
}
function to(e, t, n) {
  (Y(t)
    ? e.type.__ssrInlineRender
      ? (e.ssrRender = t)
      : (e.render = t)
    : oe(t) && (e.setupState = rl(t)),
    Ql(e));
}
function Ql(e, t, n) {
  const r = e.type;
  e.render || (e.render = r.render || dt);
  {
    const s = Nn(e);
    ht();
    try {
      Tf(e);
    } finally {
      (pt(), s());
    }
  }
}
const id = {
  get(e, t) {
    return (xe(e, 'get', ''), e[t]);
  },
};
function ad(e) {
  const t = (n) => {
    e.exposed = n || {};
  };
  return { attrs: new Proxy(e.attrs, id), slots: e.slots, emit: e.emit, expose: t };
}
function fs(e) {
  return e.exposed
    ? e.exposeProxy ||
        (e.exposeProxy = new Proxy(rl(Du(e.exposed)), {
          get(t, n) {
            if (n in t) return t[n];
            if (n in Jn) return Jn[n](e);
          },
          has(t, n) {
            return n in t || n in Jn;
          },
        }))
    : e.proxy;
}
function no(e, t = !0) {
  return Y(e) ? e.displayName || e.name : e.name || (t && e.__name);
}
function ld(e) {
  return Y(e) && '__vccOpts' in e;
}
const _e = (e, t) => Bu(e, t, nn);
function Fe(e, t, n) {
  try {
    Ur(-1);
    const r = arguments.length;
    return r === 2
      ? oe(t) && !G(t)
        ? An(t)
          ? me(e, null, [t])
          : me(e, t)
        : me(e, null, t)
      : (r > 3 ? (n = Array.prototype.slice.call(arguments, 2)) : r === 3 && An(n) && (n = [n]),
        me(e, t, n));
  } finally {
    Ur(1);
  }
}
const cd = '3.5.39';
let ro;
const Si = typeof window < 'u' && window.trustedTypes;
if (Si)
  try {
    ro = Si.createPolicy('vue', { createHTML: (e) => e });
  } catch {}
const Xl = ro ? (e) => ro.createHTML(e) : (e) => e,
  ud = 'http://www.w3.org/2000/svg',
  fd = 'http://www.w3.org/1998/Math/MathML',
  bt = typeof document < 'u' ? document : null,
  Ri = bt && bt.createElement('template'),
  dd = {
    insert: (e, t, n) => {
      t.insertBefore(e, n || null);
    },
    remove: (e) => {
      const t = e.parentNode;
      t && t.removeChild(e);
    },
    createElement: (e, t, n, r) => {
      const s =
        t === 'svg'
          ? bt.createElementNS(ud, e)
          : t === 'mathml'
            ? bt.createElementNS(fd, e)
            : n
              ? bt.createElement(e, { is: n })
              : bt.createElement(e);
      return (
        e === 'select' && r && r.multiple != null && s.setAttribute('multiple', r.multiple),
        s
      );
    },
    createText: (e) => bt.createTextNode(e),
    createComment: (e) => bt.createComment(e),
    setText: (e, t) => {
      e.nodeValue = t;
    },
    setElementText: (e, t) => {
      e.textContent = t;
    },
    parentNode: (e) => e.parentNode,
    nextSibling: (e) => e.nextSibling,
    querySelector: (e) => bt.querySelector(e),
    setScopeId(e, t) {
      e.setAttribute(t, '');
    },
    insertStaticContent(e, t, n, r, s, o) {
      const i = n ? n.previousSibling : t.lastChild;
      if (s && (s === o || s.nextSibling))
        for (; t.insertBefore(s.cloneNode(!0), n), !(s === o || !(s = s.nextSibling)); );
      else {
        Ri.innerHTML = Xl(
          r === 'svg' ? `<svg>${e}</svg>` : r === 'mathml' ? `<math>${e}</math>` : e,
        );
        const a = Ri.content;
        if (r === 'svg' || r === 'mathml') {
          const l = a.firstChild;
          for (; l.firstChild; ) a.appendChild(l.firstChild);
          a.removeChild(l);
        }
        t.insertBefore(a, n);
      }
      return [i ? i.nextSibling : t.firstChild, n ? n.previousSibling : t.lastChild];
    },
  },
  Ot = 'transition',
  jn = 'animation',
  ir = Symbol('_vtc'),
  Zl = {
    name: String,
    type: String,
    css: { type: Boolean, default: !0 },
    duration: [String, Number, Object],
    enterFromClass: String,
    enterActiveClass: String,
    enterToClass: String,
    appearFromClass: String,
    appearActiveClass: String,
    appearToClass: String,
    leaveFromClass: String,
    leaveActiveClass: String,
    leaveToClass: String,
  },
  hd = Ae({}, dl, Zl),
  pd = (e) => ((e.displayName = 'Transition'), (e.props = hd), e),
  gd = pd((e, { slots: t }) => Fe(nf, md(e), t)),
  Wt = (e, t = []) => {
    G(e) ? e.forEach((n) => n(...t)) : e && e(...t);
  },
  Ai = (e) => (e ? (G(e) ? e.some((t) => t.length > 1) : e.length > 1) : !1);
function md(e) {
  const t = {};
  for (const N in e) N in Zl || (t[N] = e[N]);
  if (e.css === !1) return t;
  const {
      name: n = 'v',
      type: r,
      duration: s,
      enterFromClass: o = `${n}-enter-from`,
      enterActiveClass: i = `${n}-enter-active`,
      enterToClass: a = `${n}-enter-to`,
      appearFromClass: l = o,
      appearActiveClass: f = i,
      appearToClass: c = a,
      leaveFromClass: u = `${n}-leave-from`,
      leaveActiveClass: h = `${n}-leave-active`,
      leaveToClass: d = `${n}-leave-to`,
    } = e,
    p = yd(s),
    m = p && p[0],
    C = p && p[1],
    {
      onBeforeEnter: E,
      onEnter: w,
      onEnterCancelled: y,
      onLeave: _,
      onLeaveCancelled: v,
      onBeforeAppear: R = E,
      onAppear: S = w,
      onAppearCancelled: I = y,
    } = t,
    k = (N, W, X, se) => {
      ((N._enterCancelled = se), Kt(N, W ? c : a), Kt(N, W ? f : i), X && X());
    },
    D = (N, W) => {
      ((N._isLeaving = !1), Kt(N, u), Kt(N, d), Kt(N, h), W && W());
    },
    F = (N) => (W, X) => {
      const se = N ? S : w,
        V = () => k(W, N, X);
      (Wt(se, [W, V]),
        Pi(() => {
          (Kt(W, N ? l : o), yt(W, N ? c : a), Ai(se) || ki(W, r, m, V));
        }));
    };
  return Ae(t, {
    onBeforeEnter(N) {
      (Wt(E, [N]), yt(N, o), yt(N, i));
    },
    onBeforeAppear(N) {
      (Wt(R, [N]), yt(N, l), yt(N, f));
    },
    onEnter: F(!1),
    onAppear: F(!0),
    onLeave(N, W) {
      N._isLeaving = !0;
      const X = () => D(N, W);
      (yt(N, u),
        N._enterCancelled ? (yt(N, h), Mi(N)) : (Mi(N), yt(N, h)),
        Pi(() => {
          N._isLeaving && (Kt(N, u), yt(N, d), Ai(_) || ki(N, r, C, X));
        }),
        Wt(_, [N, X]));
    },
    onEnterCancelled(N) {
      (k(N, !1, void 0, !0), Wt(y, [N]));
    },
    onAppearCancelled(N) {
      (k(N, !0, void 0, !0), Wt(I, [N]));
    },
    onLeaveCancelled(N) {
      (D(N), Wt(v, [N]));
    },
  });
}
function yd(e) {
  if (e == null) return null;
  if (oe(e)) return [As(e.enter), As(e.leave)];
  {
    const t = As(e);
    return [t, t];
  }
}
function As(e) {
  return La(e);
}
function yt(e, t) {
  (t.split(/\s+/).forEach((n) => n && e.classList.add(n)), (e[ir] || (e[ir] = new Set())).add(t));
}
function Kt(e, t) {
  t.split(/\s+/).forEach((r) => r && e.classList.remove(r));
  const n = e[ir];
  n && (n.delete(t), n.size || (e[ir] = void 0));
}
function Pi(e) {
  requestAnimationFrame(() => {
    requestAnimationFrame(e);
  });
}
let _d = 0;
function ki(e, t, n, r) {
  const s = (e._endId = ++_d),
    o = () => {
      s === e._endId && r();
    };
  if (n != null) return setTimeout(o, n);
  const { type: i, timeout: a, propCount: l } = bd(e, t);
  if (!i) return r();
  const f = i + 'end';
  let c = 0;
  const u = () => {
      (e.removeEventListener(f, h), o());
    },
    h = (d) => {
      d.target === e && ++c >= l && u();
    };
  (setTimeout(() => {
    c < l && u();
  }, a + 1),
    e.addEventListener(f, h));
}
function bd(e, t) {
  const n = window.getComputedStyle(e),
    r = (p) => (n[p] || '').split(', '),
    s = r(`${Ot}Delay`),
    o = r(`${Ot}Duration`),
    i = xi(s, o),
    a = r(`${jn}Delay`),
    l = r(`${jn}Duration`),
    f = xi(a, l);
  let c = null,
    u = 0,
    h = 0;
  t === Ot
    ? i > 0 && ((c = Ot), (u = i), (h = o.length))
    : t === jn
      ? f > 0 && ((c = jn), (u = f), (h = l.length))
      : ((u = Math.max(i, f)),
        (c = u > 0 ? (i > f ? Ot : jn) : null),
        (h = c ? (c === Ot ? o.length : l.length) : 0));
  const d = c === Ot && /\b(?:transform|all)(?:,|$)/.test(r(`${Ot}Property`).toString());
  return { type: c, timeout: u, propCount: h, hasTransform: d };
}
function xi(e, t) {
  for (; e.length < t.length; ) e = e.concat(e);
  return Math.max(...t.map((n, r) => Oi(n) + Oi(e[r])));
}
function Oi(e) {
  return e === 'auto' ? 0 : Number(e.slice(0, -1).replace(',', '.')) * 1e3;
}
function Mi(e) {
  return (e ? e.ownerDocument : document).body.offsetHeight;
}
function vd(e, t, n) {
  const r = e[ir];
  (r && (t = (t ? [t, ...r] : [...r]).join(' ')),
    t == null ? e.removeAttribute('class') : n ? e.setAttribute('class', t) : (e.className = t));
}
const Ni = Symbol('_vod'),
  wd = Symbol('_vsh'),
  Ed = Symbol(''),
  Td = /(?:^|;)\s*display\s*:/;
function Cd(e, t, n) {
  const r = e.style,
    s = he(n);
  let o = !1;
  if (n && !s) {
    if (t)
      if (he(t))
        for (const i of t.split(';')) {
          const a = i.slice(0, i.indexOf(':')).trim();
          n[a] == null && Kn(r, a, '');
        }
      else for (const i in t) n[i] == null && Kn(r, i, '');
    for (const i in n) {
      i === 'display' && (o = !0);
      const a = n[i];
      a != null ? Rd(e, i, !he(t) && t ? t[i] : void 0, a) || Kn(r, i, a) : Kn(r, i, '');
    }
  } else if (s) {
    if (t !== n) {
      const i = r[Ed];
      (i && (n += ';' + i), (r.cssText = n), (o = Td.test(n)));
    }
  } else t && e.removeAttribute('style');
  Ni in e && ((e[Ni] = o ? r.display : ''), e[wd] && (r.display = 'none'));
}
const Ii = /\s*!important$/;
function Kn(e, t, n) {
  if (G(n)) n.forEach((r) => Kn(e, t, r));
  else if ((n == null && (n = ''), t.startsWith('--'))) e.setProperty(t, n);
  else {
    const r = Sd(e, t);
    Ii.test(n) ? e.setProperty(rn(r), n.replace(Ii, ''), 'important') : (e[r] = n);
  }
}
const Di = ['Webkit', 'Moz', 'ms'],
  Ps = {};
function Sd(e, t) {
  const n = Ps[t];
  if (n) return n;
  let r = Ie(t);
  if (r !== 'filter' && r in e) return (Ps[t] = r);
  r = es(r);
  for (let s = 0; s < Di.length; s++) {
    const o = Di[s] + r;
    if (o in e) return (Ps[t] = o);
  }
  return t;
}
function Rd(e, t, n, r) {
  return e.tagName === 'TEXTAREA' && (t === 'width' || t === 'height') && he(r) && n === r;
}
const Li = 'http://www.w3.org/1999/xlink';
function Hi(e, t, n, r, s, o = hu(t)) {
  r && t.startsWith('xlink:')
    ? n == null
      ? e.removeAttributeNS(Li, t.slice(6, t.length))
      : e.setAttributeNS(Li, t, n)
    : n == null || (o && !Ha(n))
      ? e.removeAttribute(t)
      : e.setAttribute(t, o ? '' : Xe(n) ? String(n) : n);
}
function ji(e, t, n, r, s) {
  if (t === 'innerHTML' || t === 'textContent') {
    n != null && (e[t] = t === 'innerHTML' ? Xl(n) : n);
    return;
  }
  const o = e.tagName;
  if (t === 'value' && o !== 'PROGRESS' && !o.includes('-')) {
    const a = o === 'OPTION' ? e.getAttribute('value') || '' : e.value,
      l = n == null ? (e.type === 'checkbox' ? 'on' : '') : String(n);
    ((a !== l || !('_value' in e)) && (e.value = l),
      n == null && e.removeAttribute(t),
      (e._value = n));
    return;
  }
  let i = !1;
  if (n === '' || n == null) {
    const a = typeof e[t];
    a === 'boolean'
      ? (n = Ha(n))
      : n == null && a === 'string'
        ? ((n = ''), (i = !0))
        : a === 'number' && ((n = 0), (i = !0));
  }
  try {
    e[t] = n;
  } catch {}
  i && e.removeAttribute(s || t);
}
function fn(e, t, n, r) {
  e.addEventListener(t, n, r);
}
function Ad(e, t, n, r) {
  e.removeEventListener(t, n, r);
}
const Fi = Symbol('_vei');
function Pd(e, t, n, r, s = null) {
  const o = e[Fi] || (e[Fi] = {}),
    i = o[t];
  if (r && i) i.value = r;
  else {
    const [a, l] = Od(t);
    if (r) {
      const f = (o[t] = Id(r, s));
      fn(e, a, f, l);
    } else i && (Ad(e, a, i, l), (o[t] = void 0));
  }
}
const kd = /(Once|Passive|Capture)$/,
  xd = /^on:?(?:Once|Passive|Capture)$/;
function Od(e) {
  let t, n;
  for (; (n = e.match(kd)) && !xd.test(e); )
    (t || (t = {}), (e = e.slice(0, e.length - n[1].length)), (t[n[1].toLowerCase()] = !0));
  return [e[2] === ':' ? e.slice(3) : rn(e.slice(2)), t];
}
let ks = 0;
const Md = Promise.resolve(),
  Nd = () => ks || (Md.then(() => (ks = 0)), (ks = Date.now()));
function Id(e, t) {
  const n = (r) => {
    if (!r._vts) r._vts = Date.now();
    else if (r._vts <= n.attached) return;
    const s = n.value;
    if (G(s)) {
      const o = r.stopImmediatePropagation;
      r.stopImmediatePropagation = () => {
        (o.call(r), (r._stopped = !0));
      };
      const i = s.slice(),
        a = [r];
      for (let l = 0; l < i.length && !r._stopped; l++) {
        const f = i[l];
        f && Ze(f, t, 5, a);
      }
    } else Ze(s, t, 5, [r]);
  };
  return ((n.value = e), (n.attached = Nd()), n);
}
const $i = (e) =>
    e.charCodeAt(0) === 111 &&
    e.charCodeAt(1) === 110 &&
    e.charCodeAt(2) > 96 &&
    e.charCodeAt(2) < 123,
  Dd = (e, t, n, r, s, o) => {
    const i = s === 'svg';
    t === 'class'
      ? vd(e, r, i)
      : t === 'style'
        ? Cd(e, n, r)
        : fr(t)
          ? Qr(t) || Pd(e, t, n, r, o)
          : (
                t[0] === '.'
                  ? ((t = t.slice(1)), !0)
                  : t[0] === '^'
                    ? ((t = t.slice(1)), !1)
                    : Ld(e, t, r, i)
              )
            ? (ji(e, t, r),
              !e.tagName.includes('-') &&
                (t === 'value' || t === 'checked' || t === 'selected') &&
                Hi(e, t, r, i, o, t !== 'value'))
            : e._isVueCE && (Hd(e, t) || (e._def.__asyncLoader && (/[A-Z]/.test(t) || !he(r))))
              ? ji(e, Ie(t), r, o, t)
              : (t === 'true-value'
                  ? (e._trueValue = r)
                  : t === 'false-value' && (e._falseValue = r),
                Hi(e, t, r, i));
  };
function Ld(e, t, n, r) {
  if (r) return !!(t === 'innerHTML' || t === 'textContent' || (t in e && $i(t) && Y(n)));
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
    const s = e.tagName;
    if (s === 'IMG' || s === 'VIDEO' || s === 'CANVAS' || s === 'SOURCE') return !1;
  }
  return $i(t) && he(n) ? !1 : t in e;
}
function Hd(e, t) {
  const n = e._def.props;
  if (!n) return !1;
  const r = Ie(t);
  return Array.isArray(n) ? n.some((s) => Ie(s) === r) : Object.keys(n).some((s) => Ie(s) === r);
}
const Ui = (e) => {
  const t = e.props['onUpdate:modelValue'] || !1;
  return G(t) ? (n) => yn(t, n) : t;
};
function jd(e) {
  e.target.composing = !0;
}
function Bi(e) {
  const t = e.target;
  t.composing && ((t.composing = !1), t.dispatchEvent(new Event('input')));
}
const xs = Symbol('_assign');
function Vi(e, t, n) {
  return (t && (e = e.trim()), n && (e = ko(e)), e);
}
const By = {
    created(e, { modifiers: { lazy: t, trim: n, number: r } }, s) {
      e[xs] = Ui(s);
      const o = r || (s.props && s.props.type === 'number');
      (fn(e, t ? 'change' : 'input', (i) => {
        i.target.composing || e[xs](Vi(e.value, n, o));
      }),
        (n || o) &&
          fn(e, 'change', () => {
            e.value = Vi(e.value, n, o);
          }),
        t || (fn(e, 'compositionstart', jd), fn(e, 'compositionend', Bi), fn(e, 'change', Bi)));
    },
    mounted(e, { value: t }) {
      e.value = t ?? '';
    },
    beforeUpdate(e, { value: t, oldValue: n, modifiers: { lazy: r, trim: s, number: o } }, i) {
      if (((e[xs] = Ui(i)), e.composing)) return;
      const a = (o || e.type === 'number') && !/^0\d/.test(e.value) ? ko(e.value) : e.value,
        l = t ?? '';
      if (a === l) return;
      const f = e.getRootNode();
      ((f instanceof Document || f instanceof ShadowRoot) &&
        f.activeElement === e &&
        e.type !== 'range' &&
        ((r && t === n) || (s && e.value.trim() === l))) ||
        (e.value = l);
    },
  },
  Fd = ['ctrl', 'shift', 'alt', 'meta'],
  $d = {
    stop: (e) => e.stopPropagation(),
    prevent: (e) => e.preventDefault(),
    self: (e) => e.target !== e.currentTarget,
    ctrl: (e) => !e.ctrlKey,
    shift: (e) => !e.shiftKey,
    alt: (e) => !e.altKey,
    meta: (e) => !e.metaKey,
    left: (e) => 'button' in e && e.button !== 0,
    middle: (e) => 'button' in e && e.button !== 1,
    right: (e) => 'button' in e && e.button !== 2,
    exact: (e, t) => Fd.some((n) => e[`${n}Key`] && !t.includes(n)),
  },
  Vy = (e, t) => {
    if (!e) return e;
    const n = e._withMods || (e._withMods = {}),
      r = t.join('.');
    return (
      n[r] ||
      (n[r] = (s, ...o) => {
        for (let i = 0; i < t.length; i++) {
          const a = $d[t[i]];
          if (a && a(s, t)) return;
        }
        return e(s, ...o);
      })
    );
  },
  ec = Ae({ patchProp: Dd }, dd);
let Qn,
  Wi = !1;
function Ud() {
  return Qn || (Qn = Vf(ec));
}
function Bd() {
  return ((Qn = Wi ? Qn : Wf(ec)), (Wi = !0), Qn);
}
const Vd = (...e) => {
    const t = Ud().createApp(...e),
      { mount: n } = t;
    return (
      (t.mount = (r) => {
        const s = nc(r);
        if (!s) return;
        const o = t._component;
        (!Y(o) && !o.render && !o.template && (o.template = s.innerHTML),
          s.nodeType === 1 && (s.textContent = ''));
        const i = n(s, !1, tc(s));
        return (
          s instanceof Element && (s.removeAttribute('v-cloak'), s.setAttribute('data-v-app', '')),
          i
        );
      }),
      t
    );
  },
  Wd = (...e) => {
    const t = Bd().createApp(...e),
      { mount: n } = t;
    return (
      (t.mount = (r) => {
        const s = nc(r);
        if (s) return n(s, !0, tc(s));
      }),
      t
    );
  };
function tc(e) {
  if (e instanceof SVGElement) return 'svg';
  if (typeof MathMLElement == 'function' && e instanceof MathMLElement) return 'mathml';
}
function nc(e) {
  return he(e) ? document.querySelector(e) : e;
}
const Kd =
    /"(?:_|\\u0{2}5[Ff]){2}(?:p|\\u0{2}70)(?:r|\\u0{2}72)(?:o|\\u0{2}6[Ff])(?:t|\\u0{2}74)(?:o|\\u0{2}6[Ff])(?:_|\\u0{2}5[Ff]){2}"\s*:/,
  qd =
    /"(?:c|\\u0063)(?:o|\\u006[Ff])(?:n|\\u006[Ee])(?:s|\\u0073)(?:t|\\u0074)(?:r|\\u0072)(?:u|\\u0075)(?:c|\\u0063)(?:t|\\u0074)(?:o|\\u006[Ff])(?:r|\\u0072)"\s*:/,
  Gd = /^\s*["[{]|^\s*-?\d{1,16}(\.\d{1,17})?([Ee][+-]?\d+)?\s*$/;
function Jd(e, t) {
  if (e === '__proto__' || (e === 'constructor' && t && typeof t == 'object' && 'prototype' in t)) {
    Yd(e);
    return;
  }
  return t;
}
function Yd(e) {
  console.warn(`[destr] Dropping "${e}" key to prevent prototype pollution.`);
}
function Kr(e, t = {}) {
  if (typeof e != 'string') return e;
  if (e[0] === '"' && e[e.length - 1] === '"' && e.indexOf('\\') === -1) return e.slice(1, -1);
  const n = e.trim();
  if (n.length <= 9)
    switch (n.toLowerCase()) {
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
  if (!Gd.test(e)) {
    if (t.strict) throw new SyntaxError('[destr] Invalid JSON');
    return e;
  }
  try {
    if (Kd.test(e) || qd.test(e)) {
      if (t.strict) throw new Error('[destr] Possible prototype pollution');
      return JSON.parse(e, Jd);
    }
    return JSON.parse(e);
  } catch (r) {
    if (t.strict) throw r;
    return e;
  }
}
const rc = /#/g,
  sc = /&/g,
  zd = /\//g,
  Qd = /=/g,
  Xd = /\?/g,
  ds = /\+/g,
  Zd = /%5e/gi,
  eh = /%60/gi,
  th = /%7c/gi,
  nh = /%20/gi,
  rh = /%2f/gi,
  sh = /%252f/gi;
function oc(e) {
  return encodeURI('' + e).replace(th, '|');
}
function so(e) {
  return oc(typeof e == 'string' ? e : JSON.stringify(e))
    .replace(ds, '%2B')
    .replace(nh, '+')
    .replace(rc, '%23')
    .replace(sc, '%26')
    .replace(eh, '`')
    .replace(Zd, '^')
    .replace(zd, '%2F');
}
function Os(e) {
  return so(e).replace(Qd, '%3D');
}
function oh(e) {
  return oc(e)
    .replace(rc, '%23')
    .replace(Xd, '%3F')
    .replace(sh, '%2F')
    .replace(sc, '%26')
    .replace(ds, '%2B');
}
function ar(e = '') {
  try {
    return decodeURIComponent('' + e);
  } catch {
    return '' + e;
  }
}
function ih(e) {
  return ar(e.replace(rh, '%252F'));
}
function ah(e) {
  return ar(e.replace(ds, ' '));
}
function lh(e) {
  return ar(e.replace(ds, ' '));
}
function qo(e = '') {
  const t = Object.create(null);
  e[0] === '?' && (e = e.slice(1));
  for (const n of e.split('&')) {
    const r = n.match(/([^=]+)=?(.*)/) || [];
    if (r.length < 2) continue;
    const s = ah(r[1]);
    if (s === '__proto__' || s === 'constructor') continue;
    const o = lh(r[2] || '');
    t[s] === void 0 ? (t[s] = o) : Array.isArray(t[s]) ? t[s].push(o) : (t[s] = [t[s], o]);
  }
  return t;
}
function ch(e, t) {
  return (
    (typeof t == 'number' || typeof t == 'boolean') && (t = String(t)),
    t
      ? Array.isArray(t)
        ? t.map((n) => `${Os(e)}=${so(n)}`).join('&')
        : `${Os(e)}=${so(t)}`
      : Os(e)
  );
}
function uh(e) {
  return Object.keys(e)
    .filter((t) => e[t] !== void 0)
    .map((t) => ch(t, e[t]))
    .filter(Boolean)
    .join('&');
}
const fh = /^[\s\w\0+.-]{2,}:([/\\]{1,2})/,
  dh = /^[\s\w\0+.-]{2,}:([/\\]{2})?/,
  hh = /^([/\\]\s*){2,}[^/\\]/,
  ph = /^[\s\0]*(blob|data|javascript|vbscript):$/i,
  gh = /\/$|\/\?|\/#/,
  mh = /^\.?\//;
function Ut(e, t = {}) {
  return (
    typeof t == 'boolean' && (t = { acceptRelative: t }),
    t.strict ? fh.test(e) : dh.test(e) || (t.acceptRelative ? hh.test(e) : !1)
  );
}
function qr(e) {
  return !!e && ph.test(e);
}
function oo(e = '', t) {
  return t ? gh.test(e) : e.endsWith('/');
}
function lr(e = '', t) {
  if (!t) return (oo(e) ? e.slice(0, -1) : e) || '/';
  if (!oo(e, !0)) return e || '/';
  let n = e,
    r = '';
  const s = e.indexOf('#');
  s !== -1 && ((n = e.slice(0, s)), (r = e.slice(s)));
  const [o, ...i] = n.split('?');
  return (
    ((o.endsWith('/') ? o.slice(0, -1) : o) || '/') + (i.length > 0 ? `?${i.join('?')}` : '') + r
  );
}
function ic(e = '', t) {
  if (!t) return e.endsWith('/') ? e : e + '/';
  if (oo(e, !0)) return e || '/';
  let n = e,
    r = '';
  const s = e.indexOf('#');
  if (s !== -1 && ((n = e.slice(0, s)), (r = e.slice(s)), !n)) return r;
  const [o, ...i] = n.split('?');
  return o + '/' + (i.length > 0 ? `?${i.join('?')}` : '') + r;
}
function yh(e, t) {
  if (lc(t) || Ut(e)) return e;
  const n = lr(t);
  if (e.startsWith(n)) {
    const r = e[n.length];
    if (!r || r === '/' || r === '?') return e;
  }
  return Go(n, e);
}
function Ki(e, t) {
  if (lc(t)) return e;
  const n = lr(t);
  if (!e.startsWith(n)) return e;
  const r = e[n.length];
  return r && r !== '/' && r !== '?' ? e : '/' + e.slice(n.length).replace(/^\/+/, '');
}
function ac(e, t) {
  const n = Jo(e),
    r = { ...qo(n.search), ...t };
  return ((n.search = uh(r)), bh(n));
}
function lc(e) {
  return !e || e === '/';
}
function _h(e) {
  return e && e !== '/';
}
function Go(e, ...t) {
  let n = e || '';
  for (const r of t.filter((s) => _h(s)))
    if (n) {
      const s = r.replace(mh, '');
      n = ic(n) + s;
    } else n = r;
  return n;
}
function cc(...e) {
  const t = /\/(?!\/)/,
    n = e.filter(Boolean),
    r = [];
  let s = 0;
  for (const i of n)
    if (!(!i || i === '/')) {
      for (const [a, l] of i.split(t).entries())
        if (!(!l || l === '.')) {
          if (l === '..') {
            if (r.length === 1 && Ut(r[0])) continue;
            (r.pop(), s--);
            continue;
          }
          if (a === 1 && r[r.length - 1]?.endsWith(':/')) {
            r[r.length - 1] += '/' + l;
            continue;
          }
          (r.push(l), s++);
        }
    }
  let o = r.join('/');
  return (
    s >= 0
      ? n[0]?.startsWith('/') && !o.startsWith('/')
        ? (o = '/' + o)
        : n[0]?.startsWith('./') && !o.startsWith('./') && (o = './' + o)
      : (o = '../'.repeat(-1 * s) + o),
    n[n.length - 1]?.endsWith('/') && !o.endsWith('/') && (o += '/'),
    o
  );
}
function uc(e, t) {
  return ar(lr(e)) === ar(lr(t));
}
const fc = Symbol.for('ufo:protocolRelative');
function Jo(e = '', t) {
  const n = e.match(/^[\s\0]*(blob:|data:|javascript:|vbscript:)(.*)/i);
  if (n) {
    const [, u, h = ''] = n;
    return {
      protocol: u.toLowerCase(),
      pathname: h,
      href: u + h,
      auth: '',
      host: '',
      search: '',
      hash: '',
    };
  }
  if (!Ut(e, { acceptRelative: !0 })) return qi(e);
  const [, r = '', s, o = ''] =
    e.replace(/\\/g, '/').match(/^[\s\0]*([\w+.-]{2,}:)?\/\/([^/@]+@)?(.*)/) || [];
  let [, i = '', a = ''] = o.match(/([^#/?]*)(.*)?/) || [];
  r === 'file:' && (a = a.replace(/\/(?=[A-Za-z]:)/, ''));
  const { pathname: l, search: f, hash: c } = qi(a);
  return {
    protocol: r.toLowerCase(),
    auth: s ? s.slice(0, Math.max(0, s.length - 1)) : '',
    host: i,
    pathname: l,
    search: f,
    hash: c,
    [fc]: !r,
  };
}
function qi(e = '') {
  const [t = '', n = '', r = ''] = (e.match(/([^#?]*)(\?[^#]*)?(#.*)?/) || []).splice(1);
  return { pathname: t, search: n, hash: r };
}
function bh(e) {
  const t = e.pathname || '',
    n = e.search ? (e.search.startsWith('?') ? '' : '?') + e.search : '',
    r = e.hash || '',
    s = e.auth ? e.auth + '@' : '',
    o = e.host || '';
  return (e.protocol || e[fc] ? (e.protocol || '') + '//' : '') + s + o + t + n + r;
}
class vh extends Error {
  constructor(t, n) {
    (super(t, n), (this.name = 'FetchError'), n?.cause && !this.cause && (this.cause = n.cause));
  }
}
function wh(e) {
  const t = e.error?.message || e.error?.toString() || '',
    n = e.request?.method || e.options?.method || 'GET',
    r = e.request?.url || String(e.request) || '/',
    s = `[${n}] ${JSON.stringify(r)}`,
    o = e.response ? `${e.response.status} ${e.response.statusText}` : '<no response>',
    i = `${s}: ${o}${t ? ` ${t}` : ''}`,
    a = new vh(i, e.error ? { cause: e.error } : void 0);
  for (const l of ['request', 'options', 'response'])
    Object.defineProperty(a, l, {
      get() {
        return e[l];
      },
    });
  for (const [l, f] of [
    ['data', '_data'],
    ['status', 'status'],
    ['statusCode', 'status'],
    ['statusText', 'statusText'],
    ['statusMessage', 'statusText'],
  ])
    Object.defineProperty(a, l, {
      get() {
        return e.response && e.response[f];
      },
    });
  return a;
}
const Eh = new Set(Object.freeze(['PATCH', 'POST', 'PUT', 'DELETE']));
function Gi(e = 'GET') {
  return Eh.has(e.toUpperCase());
}
function Th(e) {
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
const Ch = new Set(['image/svg', 'application/xml', 'application/xhtml', 'application/html']),
  Sh = /^application\/(?:[\w!#$%&*.^`~-]*\+)?json(;.+)?$/i;
function Rh(e = '') {
  if (!e) return 'json';
  const t = e.split(';').shift() || '';
  return Sh.test(t)
    ? 'json'
    : t === 'text/event-stream'
      ? 'stream'
      : Ch.has(t) || t.startsWith('text/')
        ? 'text'
        : 'blob';
}
function Ah(e, t, n, r) {
  const s = Ph(t?.headers ?? e?.headers, n?.headers, r);
  let o;
  return (
    (n?.query || n?.params || t?.params || t?.query) &&
      (o = { ...n?.params, ...n?.query, ...t?.params, ...t?.query }),
    { ...n, ...t, query: o, params: o, headers: s }
  );
}
function Ph(e, t, n) {
  if (!t) return new n(e);
  const r = new n(t);
  if (e) for (const [s, o] of Symbol.iterator in e || Array.isArray(e) ? e : new n(e)) r.set(s, o);
  return r;
}
async function wr(e, t) {
  if (t)
    if (Array.isArray(t)) for (const n of t) await n(e);
    else await t(e);
}
const kh = new Set([408, 409, 425, 429, 500, 502, 503, 504]),
  xh = new Set([101, 204, 205, 304]);
function dc(e = {}) {
  const {
    fetch: t = globalThis.fetch,
    Headers: n = globalThis.Headers,
    AbortController: r = globalThis.AbortController,
  } = e;
  async function s(a) {
    const l = (a.error && a.error.name === 'AbortError' && !a.options.timeout) || !1;
    if (a.options.retry !== !1 && !l) {
      let c;
      typeof a.options.retry == 'number'
        ? (c = a.options.retry)
        : (c = Gi(a.options.method) ? 0 : 1);
      const u = (a.response && a.response.status) || 500;
      if (
        c > 0 &&
        (Array.isArray(a.options.retryStatusCodes)
          ? a.options.retryStatusCodes.includes(u)
          : kh.has(u))
      ) {
        const h =
          typeof a.options.retryDelay == 'function'
            ? a.options.retryDelay(a)
            : a.options.retryDelay || 0;
        return (
          h > 0 && (await new Promise((d) => setTimeout(d, h))),
          o(a.request, { ...a.options, retry: c - 1 })
        );
      }
    }
    const f = wh(a);
    throw (Error.captureStackTrace && Error.captureStackTrace(f, o), f);
  }
  const o = async function (l, f = {}) {
      const c = { request: l, options: Ah(l, f, e.defaults, n), response: void 0, error: void 0 };
      if (
        (c.options.method && (c.options.method = c.options.method.toUpperCase()),
        c.options.onRequest &&
          (await wr(c, c.options.onRequest),
          c.options.headers instanceof n || (c.options.headers = new n(c.options.headers || {}))),
        typeof c.request == 'string' &&
          (c.options.baseURL && (c.request = yh(c.request, c.options.baseURL)),
          c.options.query && ((c.request = ac(c.request, c.options.query)), delete c.options.query),
          'query' in c.options && delete c.options.query,
          'params' in c.options && delete c.options.params),
        c.options.body && Gi(c.options.method))
      )
        if (Th(c.options.body)) {
          const d = c.options.headers.get('content-type');
          (typeof c.options.body != 'string' &&
            (c.options.body =
              d === 'application/x-www-form-urlencoded'
                ? new URLSearchParams(c.options.body).toString()
                : JSON.stringify(c.options.body)),
            d || c.options.headers.set('content-type', 'application/json'),
            c.options.headers.has('accept') || c.options.headers.set('accept', 'application/json'));
        } else
          (('pipeTo' in c.options.body && typeof c.options.body.pipeTo == 'function') ||
            typeof c.options.body.pipe == 'function') &&
            ('duplex' in c.options || (c.options.duplex = 'half'));
      let u;
      if (!c.options.signal && c.options.timeout) {
        const d = new r();
        ((u = setTimeout(() => {
          const p = new Error('[TimeoutError]: The operation was aborted due to timeout');
          ((p.name = 'TimeoutError'), (p.code = 23), d.abort(p));
        }, c.options.timeout)),
          (c.options.signal = d.signal));
      }
      try {
        c.response = await t(c.request, c.options);
      } catch (d) {
        return (
          (c.error = d),
          c.options.onRequestError && (await wr(c, c.options.onRequestError)),
          await s(c)
        );
      } finally {
        u && clearTimeout(u);
      }
      if (
        (c.response.body || c.response._bodyInit) &&
        !xh.has(c.response.status) &&
        c.options.method !== 'HEAD'
      ) {
        const d =
          (c.options.parseResponse ? 'json' : c.options.responseType) ||
          Rh(c.response.headers.get('content-type') || '');
        switch (d) {
          case 'json': {
            const p = await c.response.text(),
              m = c.options.parseResponse || Kr;
            c.response._data = m(p);
            break;
          }
          case 'stream': {
            c.response._data = c.response.body || c.response._bodyInit;
            break;
          }
          default:
            c.response._data = await c.response[d]();
        }
      }
      return (
        c.options.onResponse && (await wr(c, c.options.onResponse)),
        !c.options.ignoreResponseError && c.response.status >= 400 && c.response.status < 600
          ? (c.options.onResponseError && (await wr(c, c.options.onResponseError)), await s(c))
          : c.response
      );
    },
    i = async function (l, f) {
      return (await o(l, f))._data;
    };
  return (
    (i.raw = o),
    (i.native = (...a) => t(...a)),
    (i.create = (a = {}, l = {}) =>
      dc({ ...e, ...l, defaults: { ...e.defaults, ...l.defaults, ...a } })),
    i
  );
}
const Gr = (function () {
    if (typeof globalThis < 'u') return globalThis;
    if (typeof self < 'u') return self;
    if (typeof window < 'u') return window;
    if (typeof global < 'u') return global;
    throw new Error('unable to locate global object');
  })(),
  Oh = Gr.fetch
    ? (...e) => Gr.fetch(...e)
    : () => Promise.reject(new Error('[ofetch] global.fetch is not supported!')),
  Mh = Gr.Headers,
  Nh = Gr.AbortController,
  Ih = dc({ fetch: Oh, Headers: Mh, AbortController: Nh }),
  Dh = Ih,
  Lh = () => window?.__NUXT__?.config || {},
  Yo = () => Lh().app,
  Hh = () => Yo().baseURL,
  jh = () => Yo().buildAssetsDir,
  zo = (...e) => cc(hc(), jh(), ...e),
  hc = (...e) => {
    const t = Yo(),
      n = t.cdnURL || t.baseURL;
    return e.length ? cc(n, ...e) : n;
  };
((globalThis.__buildAssetsURL = zo), (globalThis.__publicAssetsURL = hc));
globalThis.$fetch || (globalThis.$fetch = Dh.create({ baseURL: Hh() }));
'global' in globalThis || (globalThis.global = globalThis);
function io(e, t = {}, n) {
  for (const r in e) {
    const s = e[r],
      o = n ? `${n}:${r}` : r;
    typeof s == 'object' && s !== null ? io(s, t, o) : typeof s == 'function' && (t[o] = s);
  }
  return t;
}
const Fh = { run: (e) => e() },
  $h = () => Fh,
  pc = typeof console.createTask < 'u' ? console.createTask : $h;
function Uh(e, t) {
  const n = t.shift(),
    r = pc(n);
  return e.reduce((s, o) => s.then(() => r.run(() => o(...t))), Promise.resolve());
}
function Bh(e, t) {
  const n = t.shift(),
    r = pc(n);
  return Promise.all(e.map((s) => r.run(() => s(...t))));
}
function Ms(e, t) {
  for (const n of [...e]) n(t);
}
let Vh = class {
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
  hook(t, n, r = {}) {
    if (!t || typeof n != 'function') return () => {};
    const s = t;
    let o;
    for (; this._deprecatedHooks[t]; ) ((o = this._deprecatedHooks[t]), (t = o.to));
    if (o && !r.allowDeprecated) {
      let i = o.message;
      (i || (i = `${s} hook has been deprecated` + (o.to ? `, please use ${o.to}` : '')),
        this._deprecatedMessages || (this._deprecatedMessages = new Set()),
        this._deprecatedMessages.has(i) || (console.warn(i), this._deprecatedMessages.add(i)));
    }
    if (!n.name)
      try {
        Object.defineProperty(n, 'name', {
          get: () => '_' + t.replace(/\W+/g, '_') + '_hook_cb',
          configurable: !0,
        });
      } catch {}
    return (
      (this._hooks[t] = this._hooks[t] || []),
      this._hooks[t].push(n),
      () => {
        n && (this.removeHook(t, n), (n = void 0));
      }
    );
  }
  hookOnce(t, n) {
    let r,
      s = (...o) => (typeof r == 'function' && r(), (r = void 0), (s = void 0), n(...o));
    return ((r = this.hook(t, s)), r);
  }
  removeHook(t, n) {
    if (this._hooks[t]) {
      const r = this._hooks[t].indexOf(n);
      (r !== -1 && this._hooks[t].splice(r, 1),
        this._hooks[t].length === 0 && delete this._hooks[t]);
    }
  }
  deprecateHook(t, n) {
    this._deprecatedHooks[t] = typeof n == 'string' ? { to: n } : n;
    const r = this._hooks[t] || [];
    delete this._hooks[t];
    for (const s of r) this.hook(t, s);
  }
  deprecateHooks(t) {
    Object.assign(this._deprecatedHooks, t);
    for (const n in t) this.deprecateHook(n, t[n]);
  }
  addHooks(t) {
    const n = io(t),
      r = Object.keys(n).map((s) => this.hook(s, n[s]));
    return () => {
      for (const s of r.splice(0, r.length)) s();
    };
  }
  removeHooks(t) {
    const n = io(t);
    for (const r in n) this.removeHook(r, n[r]);
  }
  removeAllHooks() {
    for (const t in this._hooks) delete this._hooks[t];
  }
  callHook(t, ...n) {
    return (n.unshift(t), this.callHookWith(Uh, t, ...n));
  }
  callHookParallel(t, ...n) {
    return (n.unshift(t), this.callHookWith(Bh, t, ...n));
  }
  callHookWith(t, n, ...r) {
    const s = this._before || this._after ? { name: n, args: r, context: {} } : void 0;
    this._before && Ms(this._before, s);
    const o = t(n in this._hooks ? [...this._hooks[n]] : [], r);
    return o instanceof Promise
      ? o.finally(() => {
          this._after && s && Ms(this._after, s);
        })
      : (this._after && s && Ms(this._after, s), o);
  }
  beforeEach(t) {
    return (
      (this._before = this._before || []),
      this._before.push(t),
      () => {
        if (this._before !== void 0) {
          const n = this._before.indexOf(t);
          n !== -1 && this._before.splice(n, 1);
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
          const n = this._after.indexOf(t);
          n !== -1 && this._after.splice(n, 1);
        }
      }
    );
  }
};
function Wh() {
  return new Vh();
}
function Kh(e = {}) {
  let t,
    n = !1;
  const r = (i) => {
    if (t && t !== i) throw new Error('Context conflict');
  };
  let s;
  if (e.asyncContext) {
    const i = e.AsyncLocalStorage || globalThis.AsyncLocalStorage;
    i ? (s = new i()) : console.warn('[unctx] `AsyncLocalStorage` is not provided.');
  }
  const o = () => {
    if (s) {
      const i = s.getStore();
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
      (a || r(i), (t = i), (n = !0));
    },
    unset: () => {
      ((t = void 0), (n = !1));
    },
    call: (i, a) => {
      (r(i), (t = i));
      try {
        return s ? s.run(i, a) : a();
      } finally {
        n || (t = void 0);
      }
    },
    async callAsync(i, a) {
      t = i;
      const l = () => {
          t = i;
        },
        f = () => (t === i ? l : void 0);
      ao.add(f);
      try {
        const c = s ? s.run(i, a) : a();
        return (n || (t = void 0), await c);
      } finally {
        ao.delete(f);
      }
    },
  };
}
function qh(e = {}) {
  const t = {};
  return {
    get(n, r = {}) {
      return (t[n] || (t[n] = Kh({ ...e, ...r })), t[n]);
    },
  };
}
const Jr =
    typeof globalThis < 'u'
      ? globalThis
      : typeof self < 'u'
        ? self
        : typeof global < 'u'
          ? global
          : typeof window < 'u'
            ? window
            : {},
  Ji = '__unctx__',
  Gh = Jr[Ji] || (Jr[Ji] = qh()),
  Jh = (e, t = {}) => Gh.get(e, t),
  Yi = '__unctx_async_handlers__',
  ao = Jr[Yi] || (Jr[Yi] = new Set());
function Xn(e) {
  const t = [];
  for (const s of ao) {
    const o = s();
    o && t.push(o);
  }
  const n = () => {
    for (const s of t) s();
  };
  let r = e();
  return (
    r &&
      typeof r == 'object' &&
      'catch' in r &&
      (r = r.catch((s) => {
        throw (n(), s);
      })),
    [r, n]
  );
}
const zi = !1,
  Yh = !1,
  zh = { componentName: 'NuxtLink', prefetch: !0, prefetchOn: { visibility: !0 } },
  Ct = { value: null, errorValue: null, deep: !0 },
  Qh = null,
  Xh = '#__nuxt',
  gc = 'nuxt-app',
  Qi = 36e5,
  Zh = 'vite:preloadError';
function mc(e = gc) {
  return Jh(e, { asyncContext: !1 });
}
const ep = '__nuxt_plugin';
function tp(e) {
  let t = 0;
  const n = {
    _id: e.id || gc || 'nuxt-app',
    _scope: gu(),
    provide: void 0,
    globalName: 'nuxt',
    versions: {
      get nuxt() {
        return '3.21.8';
      },
      get vue() {
        return n.vueApp.version;
      },
    },
    payload: Tt({
      ...(e.ssrContext?.payload || {}),
      data: Tt({}),
      state: $t({}),
      once: new Set(),
      _errors: Tt({}),
    }),
    static: { data: {} },
    runWithContext(s) {
      return n._scope.active && !Oo() ? n._scope.run(() => Xi(n, s)) : Xi(n, s);
    },
    isHydrating: !0,
    deferHydration() {
      if (!n.isHydrating) return () => {};
      t++;
      let s = !1;
      return () => {
        if (!s && ((s = !0), t--, t === 0))
          return ((n.isHydrating = !1), n.callHook('app:suspense:resolve'));
      };
    },
    _asyncDataPromises: {},
    _asyncData: Tt({}),
    _payloadRevivers: {},
    ...e,
  };
  {
    const s = window.__NUXT__;
    if (s)
      for (const o in s)
        switch (o) {
          case 'data':
          case 'state':
          case '_errors':
            Object.assign(n.payload[o], s[o]);
            break;
          default:
            n.payload[o] = s[o];
        }
  }
  ((n.hooks = Wh()),
    (n.hook = n.hooks.hook),
    (n.callHook = n.hooks.callHook),
    (n.provide = (s, o) => {
      const i = '$' + s;
      (Er(n, i, o), Er(n.vueApp.config.globalProperties, i, o));
    }),
    Er(n.vueApp, '$nuxt', n),
    Er(n.vueApp.config.globalProperties, '$nuxt', n));
  {
    (window.addEventListener(Zh, (o) => {
      (n.callHook('app:chunkError', { error: o.payload }),
        o.payload?.message?.includes('Unable to preload CSS') && o.preventDefault());
    }),
      (window.useNuxtApp ||= be));
    const s = n.hook('app:error', (...o) => {
      console.error('[nuxt] error caught during app initialization', ...o);
    });
    n.hook('app:mounted', s);
  }
  const r = n.payload.config;
  return (n.provide('config', r), n);
}
function np(e, t) {
  t.hooks && e.hooks.addHooks(t.hooks);
}
async function rp(e, t) {
  if (typeof t == 'function') {
    const { provide: n } = (await e.runWithContext(() => t(e))) || {};
    if (n && typeof n == 'object') for (const r in n) e.provide(r, n[r]);
  }
}
async function sp(e, t) {
  const n = new Set(),
    r = [],
    s = [];
  let o,
    i = 0;
  async function a(l) {
    const f = l.dependsOn?.filter((c) => t.some((u) => u._name === c) && !n.has(c)) ?? [];
    if (f.length > 0) r.push([new Set(f), l]);
    else {
      const c = rp(e, l)
        .then(async () => {
          l._name &&
            (n.add(l._name),
            await Promise.all(
              r.map(async ([u, h]) => {
                u.has(l._name) && (u.delete(l._name), u.size === 0 && (i++, await a(h)));
              }),
            ));
        })
        .catch((u) => {
          if (!l.parallel && !e.payload.error) throw u;
          o ||= u;
        });
      l.parallel ? s.push(c) : await c;
    }
  }
  for (const l of t) np(e, l);
  for (const l of t) await a(l);
  if ((await Promise.all(s), i)) for (let l = 0; l < i; l++) await Promise.all(s);
  if (o) throw e.payload.error || o;
}
function xt(e) {
  if (typeof e == 'function') return e;
  const t = e._name || e.name;
  return (delete e.name, Object.assign(e.setup || (() => {}), e, { [ep]: !0, _name: t }));
}
function Xi(e, t, n) {
  const r = () => t();
  return (mc(e._id).set(e), e.vueApp.runWithContext(r));
}
function op(e) {
  let t;
  return (Fo() && (t = Pt()?.appContext.app.$nuxt), (t ||= mc(e).tryUse()), t || null);
}
function be(e) {
  const t = op(e);
  if (!t) throw new Error('[nuxt] instance unavailable');
  return t;
}
function In(e) {
  return be().$config;
}
function Er(e, t, n) {
  Object.defineProperty(e, t, { get: () => n });
}
function Ns(e) {
  if (e === null || typeof e != 'object') return !1;
  const t = Object.getPrototypeOf(e);
  return (t !== null && t !== Object.prototype && Object.getPrototypeOf(t) !== null) ||
    Symbol.iterator in e
    ? !1
    : Symbol.toStringTag in e
      ? Object.prototype.toString.call(e) === '[object Module]'
      : !0;
}
function lo(e, t, n = '.', r) {
  if (!Ns(t)) return lo(e, {}, n, r);
  const s = { ...t };
  for (const o of Object.keys(e)) {
    if (o === '__proto__' || o === 'constructor') continue;
    const i = e[o];
    i != null &&
      ((r && r(s, o, i, n)) ||
        (Array.isArray(i) && Array.isArray(s[o])
          ? (s[o] = [...i, ...s[o]])
          : Ns(i) && Ns(s[o])
            ? (s[o] = lo(i, s[o], (n ? `${n}.` : '') + o.toString(), r))
            : (s[o] = i)));
  }
  return s;
}
function ip(e) {
  return (...t) => t.reduce((n, r) => lo(n, r, '', e), {});
}
const yc = ip();
function ap(e, t) {
  try {
    return t in e;
  } catch {
    return !1;
  }
}
class Zi extends Error {
  static __h3_error__ = !0;
  statusCode = 500;
  fatal = !1;
  unhandled = !1;
  statusMessage;
  data;
  cause;
  constructor(t, n = {}) {
    (super(t, n), n.cause && !this.cause && (this.cause = n.cause));
  }
  toJSON() {
    const t = { message: this.message, statusCode: co(this.statusCode, 500) };
    return (
      this.statusMessage && (t.statusMessage = _c(this.statusMessage)),
      this.data !== void 0 && (t.data = this.data),
      t
    );
  }
}
function lp(e) {
  if (typeof e == 'string') return new Zi(e);
  if (cp(e)) return e;
  const t = new Zi(e.message ?? e.statusMessage ?? '', { cause: e.cause || e });
  if (ap(e, 'stack'))
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
      ? (t.statusCode = co(e.statusCode, t.statusCode))
      : e.status && (t.statusCode = co(e.status, t.statusCode)),
    e.statusMessage
      ? (t.statusMessage = e.statusMessage)
      : e.statusText && (t.statusMessage = e.statusText),
    t.statusMessage)
  ) {
    const n = t.statusMessage;
    _c(t.statusMessage) !== n &&
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
function cp(e) {
  return e?.constructor?.__h3_error__ === !0;
}
const up = /[^\u0009\u0020-\u007E]/g;
function _c(e = '') {
  return e.replace(up, '');
}
function co(e, t = 200) {
  return !e || (typeof e == 'string' && (e = Number.parseInt(e, 10)), e < 100 || e > 999) ? t : e;
}
const fp = Symbol('layout-meta'),
  hs = Symbol('route');
import.meta.url.replace(/\/app\/.*$/, '/');
const Ue = () => be()?.$router,
  dp = () => (Fo() ? $e(hs, be()._route) : be()._route);
const hp = () => {
    try {
      if (be()._processingMiddleware) return !0;
    } catch {
      return !1;
    }
    return !1;
  },
  pp = (e, t) => {
    e ||= '/';
    const n = typeof e == 'string' ? e : 'path' in e ? uo(e) : Ue().resolve(e).href;
    if (t?.open) {
      const { protocol: f } = new URL(n, window.location.href);
      if (f && qr(f)) throw new Error(`Cannot navigate to a URL with '${f}' protocol.`);
      const { target: c = '_blank', windowFeatures: u = {} } = t.open,
        h = [];
      for (const [d, p] of Object.entries(u)) p !== void 0 && h.push(`${d.toLowerCase()}=${p}`);
      return (open(n, c, h.join(', ')), Promise.resolve());
    }
    const r = Ut(n, { acceptRelative: !0 }),
      s = t?.external || r;
    if (s) {
      if (!t?.external)
        throw new Error(
          'Navigating to an external URL is not allowed by default. Use `navigateTo(url, { external: true })`.',
        );
      const { protocol: f } = new URL(n, window.location.href);
      if (f && qr(f)) throw new Error(`Cannot navigate to a URL with '${f}' protocol.`);
    }
    const o = hp();
    if (!s && o) {
      if (t?.replace) {
        if (typeof e == 'string') {
          const { pathname: f, search: c, hash: u } = Jo(e);
          return { path: f, ...(c && { query: qo(c) }), ...(u && { hash: u }), replace: !0 };
        }
        return { ...e, replace: !0 };
      }
      return e;
    }
    const i = Ue(),
      a = be();
    if (s)
      return (
        a._scope.stop(),
        t?.replace ? location.replace(n) : (location.href = n),
        o ? (a.isHydrating ? new Promise(() => {}) : !1) : Promise.resolve()
      );
    const l = typeof e == 'string' ? bc(e) : e;
    return t?.replace ? i.replace(l) : i.push(l);
  };
function uo(e) {
  return ac(e.path || '', e.query || {}) + (e.hash || '');
}
function bc(e) {
  const t = Jo(e);
  return oh(ih(t.pathname)) + t.search + t.hash;
}
const vc = '__nuxt_error',
  ps = () => sl(be().payload, 'error'),
  Jt = (e) => {
    const t = Ft(e);
    try {
      const n = ps();
      (be().hooks.callHook('app:error', t), (n.value ||= t));
    } catch {
      throw t;
    }
    return t;
  },
  gp = async (e = {}) => {
    const t = be(),
      n = ps();
    (t.callHook('app:error:cleared', e),
      e.redirect && (await Ue().replace(e.redirect)),
      (n.value = Qh));
  },
  wc = (e) => !!e && typeof e == 'object' && vc in e,
  Ft = (e) => {
    typeof e != 'string' && e.statusText && (e.message ??= e.statusText);
    const t = lp(e);
    return (
      Object.defineProperty(t, vc, { value: !0, configurable: !1, writable: !1 }),
      Object.defineProperty(t, 'status', { get: () => t.statusCode, configurable: !0 }),
      Object.defineProperty(t, 'statusText', { get: () => t.statusMessage, configurable: !0 }),
      t
    );
  },
  mp = -1,
  yp = -2,
  _p = -3,
  bp = -4,
  vp = -5,
  wp = -6,
  Ep = -7,
  Ec = 2 ** 32 - 1,
  fo = Ec - 1;
function Tp(e) {
  return !(!Number.isInteger(e) || e < 0 || e > fo);
}
function Cp(e) {
  return !(!Number.isInteger(e) || e < 0 || e > Ec);
}
function Sp(e) {
  return Uint8Array.fromBase64(e).buffer;
}
function Rp(e) {
  return Uint8Array.from(Buffer.from(e, 'base64')).buffer;
}
function Ap(e) {
  const t = atob(e),
    n = t.length,
    r = new Uint8Array(n);
  for (let s = 0; s < n; s++) r[s] = t.charCodeAt(s);
  return r.buffer;
}
const Pp = typeof Uint8Array.fromBase64 == 'function',
  kp = typeof process == 'object' && process.versions?.node !== void 0,
  xp = Pp ? Sp : kp ? Rp : Ap;
function Op(e, t) {
  return Mp(JSON.parse(e), t);
}
function Mp(e, t) {
  if (typeof e == 'number') return o(e, !0);
  if (!Array.isArray(e) || e.length === 0) throw new Error('Invalid input');
  const n = e,
    r = Array(n.length);
  let s = null;
  function o(i, a = !1) {
    if (i === mp) return;
    if (i === _p) return NaN;
    if (i === bp) return 1 / 0;
    if (i === vp) return -1 / 0;
    if (i === wp) return -0;
    if (a || typeof i != 'number') throw new Error('Invalid input');
    if (i in r) return r[i];
    const l = n[i];
    if (!l || typeof l != 'object') r[i] = l;
    else if (Array.isArray(l))
      if (typeof l[0] == 'string') {
        const f = l[0],
          c = t && Object.hasOwn(t, f) ? t[f] : void 0;
        if (c) {
          let u = l[1];
          if ((typeof u != 'number' && (u = n.push(l[1]) - 1), (s ??= new Set()), s.has(u)))
            throw new Error('Invalid circular reference');
          return (s.add(u), (r[i] = c(o(u))), s.delete(u), r[i]);
        }
        switch (f) {
          case 'Date':
            r[i] = new Date(l[1]);
            break;
          case 'Set':
            const u = new Set();
            r[i] = u;
            for (let p = 1; p < l.length; p += 1) u.add(o(l[p]));
            break;
          case 'Map':
            const h = new Map();
            r[i] = h;
            for (let p = 1; p < l.length; p += 2) h.set(o(l[p]), o(l[p + 1]));
            break;
          case 'RegExp':
            r[i] = new RegExp(l[1], l[2]);
            break;
          case 'Object': {
            const p = l[1];
            if (typeof n[p] == 'object' && n[p][0] !== 'BigInt') throw new Error('Invalid input');
            r[i] = Object(o(p));
            break;
          }
          case 'BigInt':
            r[i] = BigInt(l[1]);
            break;
          case 'null':
            const d = Object.create(null);
            r[i] = d;
            for (let p = 1; p < l.length; p += 2) {
              if (l[p] === '__proto__')
                throw new Error('Cannot parse an object with a `__proto__` property');
              d[l[p]] = o(l[p + 1]);
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
            if (n[l[1]][0] !== 'ArrayBuffer') throw new Error('Invalid data');
            const p = globalThis[f],
              m = o(l[1]);
            r[i] = l[2] !== void 0 ? new p(m, l[2], l[3]) : new p(m);
            break;
          }
          case 'ArrayBuffer': {
            const p = l[1];
            if (typeof p != 'string') throw new Error('Invalid ArrayBuffer encoding');
            const m = xp(p);
            r[i] = m;
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
            const p = f.slice(9);
            r[i] = Temporal[p].from(l[1]);
            break;
          }
          case 'URL': {
            const p = new URL(l[1]);
            r[i] = p;
            break;
          }
          case 'URLSearchParams': {
            const p = new URLSearchParams(l[1]);
            r[i] = p;
            break;
          }
          default:
            throw new Error(`Unknown type ${f}`);
        }
      } else if (l[0] === Ep) {
        const f = l[1];
        if (!Cp(f)) throw new Error('Invalid input');
        const c = [];
        ((r[i] = c), (c[fo] = void 0), delete c[fo]);
        for (let u = 2; u < l.length; u += 2) {
          const h = l[u];
          if (!Tp(h) || h >= f) throw new Error('Invalid input');
          c[h] = o(l[u + 1]);
        }
        c.length = f;
      } else {
        const f = new Array(l.length);
        r[i] = f;
        for (let c = 0; c < l.length; c += 1) {
          const u = l[c];
          u !== yp && (f[c] = o(u));
        }
      }
    else {
      const f = {};
      r[i] = f;
      for (const c of Object.keys(l)) {
        if (c === '__proto__')
          throw new Error('Cannot parse an object with a `__proto__` property');
        const u = l[c];
        f[c] = o(u);
      }
    }
    return r[i];
  }
  return o(0);
}
const Np = new Set(['link', 'style', 'script', 'noscript']),
  Ip = new Set(['title', 'titleTemplate', 'script', 'style', 'noscript']),
  ho = new Set(['base', 'meta', 'link', 'style', 'script', 'noscript']),
  Dp = new Set([
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
  Lp = new Set(['base', 'title', 'titleTemplate', 'bodyAttrs', 'htmlAttrs', 'templateParams']),
  Hp = new Set([
    'key',
    'tagPosition',
    'tagPriority',
    'tagDuplicateStrategy',
    'innerHTML',
    'textContent',
    'processTemplateParams',
  ]),
  jp = new Set(['templateParams', 'htmlAttrs', 'bodyAttrs']),
  Qo = new Set([
    'theme-color',
    'google-site-verification',
    'og',
    'article',
    'book',
    'profile',
    'twitter',
    'author',
  ]),
  cr = {
    META: new Set(['twitter']),
    OG: new Set(['og', 'book', 'article', 'profile', 'fb']),
    MEDIA: new Set(['ogImage', 'ogVideo', 'ogAudio', 'twitterImage']),
    HTTP_EQUIV: new Set(['contentType', 'defaultStyle', 'xUaCompatible']),
  },
  Fp = {
    articleExpirationTime: 'article:expiration_time',
    articleModifiedTime: 'article:modified_time',
    articlePublishedTime: 'article:published_time',
    bookReleaseDate: 'book:release_date',
    fbAppId: 'fb:app_id',
    ogAudioSecureUrl: 'og:audio:secure_url',
    ogAudioUrl: 'og:audio',
    ogImageSecureUrl: 'og:image:secure_url',
    ogImageUrl: 'og:image',
    ogSiteName: 'og:site_name',
    ogVideoSecureUrl: 'og:video:secure_url',
    ogVideoUrl: 'og:video',
    profileFirstName: 'profile:first_name',
    profileLastName: 'profile:last_name',
    profileUsername: 'profile:username',
    msapplicationConfig: 'msapplication-Config',
    msapplicationTileColor: 'msapplication-TileColor',
    msapplicationTileImage: 'msapplication-TileImage',
  },
  Tc = {
    appleItunesApp: {
      unpack: { entrySeparator: ', ', resolve: ({ key: e, value: t }) => `${St(e)}=${t}` },
    },
    refresh: {
      metaKey: 'http-equiv',
      unpack: {
        entrySeparator: ';',
        resolve: ({ key: e, value: t }) => (e === 'seconds' ? `${t}` : void 0),
      },
    },
    robots: {
      unpack: {
        entrySeparator: ', ',
        resolve: ({ key: e, value: t }) => (typeof t == 'boolean' ? St(e) : `${St(e)}:${t}`),
      },
    },
    contentSecurityPolicy: {
      metaKey: 'http-equiv',
      unpack: { entrySeparator: '; ', resolve: ({ key: e, value: t }) => `${St(e)} ${t}` },
    },
    charset: {},
  };
function St(e) {
  const t = e.replace(/([A-Z])/g, '-$1').toLowerCase(),
    n = t.indexOf('-');
  return n === -1
    ? t
    : cr.META.has(t.slice(0, n)) || cr.OG.has(t.slice(0, n))
      ? e.replace(/([A-Z])/g, ':$1').toLowerCase()
      : t;
}
function Cc(e) {
  return Object.fromEntries(Object.entries(e).filter(([t, n]) => String(n) !== 'false' && t));
}
function po(e) {
  return Array.isArray(e)
    ? e.map(po)
    : !e || typeof e != 'object'
      ? e
      : Object.fromEntries(Object.entries(e).map(([t, n]) => [St(t), po(n)]));
}
function Sc(e, t = {}) {
  const { entrySeparator: n = '', keyValueSeparator: r = '', wrapValue: s, resolve: o } = t;
  return Object.entries(e)
    .map(([i, a]) => {
      if (o) {
        const f = o({ key: i, value: a });
        if (f !== void 0) return f;
      }
      const l =
        typeof a == 'object'
          ? Sc(a, t)
          : typeof a == 'number'
            ? a.toString()
            : typeof a == 'string' && s
              ? `${s}${a.replace(new RegExp(s, 'g'), `\\${s}`)}${s}`
              : a;
      return `${i}${r}${l}`;
    })
    .join(n);
}
function ea(e, t) {
  const n = Cc(t),
    r = St(e),
    s = Rc(r);
  if (!Qo.has(r)) return [{ [s]: r, ...n }];
  const o = Object.fromEntries(
    Object.entries(n).map(([i, a]) => [
      `${e}${i === 'url' ? '' : `${i[0].toUpperCase()}${i.slice(1)}`}`,
      a,
    ]),
  );
  return Yr(o || {}).sort((i, a) => (i[s]?.length || 0) - (a[s]?.length || 0));
}
function Rc(e) {
  if (Tc[e]?.metaKey === 'http-equiv' || cr.HTTP_EQUIV.has(e)) return 'http-equiv';
  const t = St(e),
    n = t.indexOf(':');
  return n === -1 ? 'name' : cr.OG.has(t.slice(0, n)) ? 'property' : 'name';
}
function $p(e) {
  return Fp[e] || St(e);
}
function Up(e, t) {
  return t === 'refresh'
    ? `${e.seconds};url=${e.url}`
    : Sc(po(e), {
        keyValueSeparator: '=',
        entrySeparator: ', ',
        resolve: ({ value: n, key: r }) => (n === null ? '' : typeof n == 'boolean' ? r : void 0),
        ...Tc[t]?.unpack,
      });
}
function Yr(e) {
  const t = [],
    n = {};
  for (const [s, o] of Object.entries(e)) {
    if (Array.isArray(o)) {
      if (s === 'themeColor') {
        o.forEach((i) => {
          typeof i == 'object' && i !== null && t.push({ name: 'theme-color', ...i });
        });
        continue;
      }
      for (const i of o)
        if (typeof i == 'object' && i !== null) {
          const a = [],
            l = [];
          for (const [f, c] of Object.entries(i)) {
            const u = `${s}${f === 'url' ? '' : `:${f}`}`,
              h = Yr({ [u]: c });
            (f === 'url' ? a : l).push(...h);
          }
          t.push(...a, ...l);
        } else t.push(...(typeof i == 'string' ? Yr({ [s]: i }) : ea(s, i)));
      continue;
    }
    if (typeof o == 'object' && o)
      if (cr.MEDIA.has(s)) {
        const i = s.startsWith('twitter') ? 'twitter' : 'og',
          a = s.replace(/^(og|twitter)/, '').toLowerCase(),
          l = i === 'twitter' ? 'name' : 'property';
        (o.url && t.push({ [l]: `${i}:${a}`, content: o.url }),
          o.secureUrl && t.push({ [l]: `${i}:${a}:secure_url`, content: o.secureUrl }));
        for (const [f, c] of Object.entries(o))
          f !== 'url' && f !== 'secureUrl' && t.push({ [l]: `${i}:${a}:${f}`, content: c });
      } else Qo.has(St(s)) ? t.push(...ea(s, o)) : (n[s] = Cc(o));
    else n[s] = o;
  }
  const r = Object.entries(n).map(([s, o]) => {
    if (s === 'charset') return { charset: o === null ? '_null' : o };
    const i = Rc(s),
      a = $p(s),
      l =
        o === null
          ? '_null'
          : typeof o == 'object'
            ? Up(o, s)
            : typeof o == 'number'
              ? o.toString()
              : o;
    return i === 'http-equiv' ? { 'http-equiv': a, content: l } : { [i]: a, content: l };
  });
  return [...t, ...r].map((s) =>
    'content' in s && s.content === '_null' ? { ...s, content: null } : s,
  );
}
const Bp = {
  key: 'flatMeta',
  hooks: {
    'entries:normalize': (e) => {
      const t = [];
      e.tags = e.tags
        .map((n) =>
          n.tag !== '_flatMeta'
            ? n
            : (t.push(Yr(n.props).map((r) => ({ ...n, tag: 'meta', props: r }))), !1),
        )
        .filter(Boolean)
        .concat(...t);
    },
  },
};
function go(e, t = {}, n) {
  for (const r in e) {
    const s = e[r],
      o = n ? `${n}:${r}` : r;
    typeof s == 'object' && s !== null ? go(s, t, o) : typeof s == 'function' && (t[o] = s);
  }
  return t;
}
const Ac = (() => {
  if (console.createTask) return console.createTask;
  const e = { run: (t) => t() };
  return () => e;
})();
function Pc(e, t, n, r) {
  for (let s = n; s < e.length; s += 1)
    try {
      const o = r ? r.run(() => e[s](...t)) : e[s](...t);
      if (o && typeof o.then == 'function')
        return Promise.resolve(o).then(() => Pc(e, t, s + 1, r));
    } catch (o) {
      return Promise.reject(o);
    }
}
function Vp(e, t, n) {
  if (e.length > 0) return Pc(e, t, 0, Ac(n));
}
function Wp(e, t, n) {
  if (e.length > 0) {
    const r = Ac(n);
    return Promise.all(e.map((s) => r.run(() => s(...t))));
  }
}
function Is(e, t) {
  for (const n of [...e]) n(t);
}
var Kp = class {
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
  hook(e, t, n = {}) {
    if (!e || typeof t != 'function') return () => {};
    const r = e;
    let s;
    for (; this._deprecatedHooks[e]; ) ((s = this._deprecatedHooks[e]), (e = s.to));
    if (s && !n.allowDeprecated) {
      let o = s.message;
      (o || (o = `${r} hook has been deprecated` + (s.to ? `, please use ${s.to}` : '')),
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
    let n,
      r = (...s) => (typeof n == 'function' && n(), (n = void 0), (r = void 0), t(...s));
    return ((n = this.hook(e, r)), n);
  }
  removeHook(e, t) {
    const n = this._hooks[e];
    if (n) {
      const r = n.indexOf(t);
      (r !== -1 && n.splice(r, 1), n.length === 0 && (this._hooks[e] = void 0));
    }
  }
  clearHook(e) {
    this._hooks[e] = void 0;
  }
  deprecateHook(e, t) {
    this._deprecatedHooks[e] = typeof t == 'string' ? { to: t } : t;
    const n = this._hooks[e] || [];
    this._hooks[e] = void 0;
    for (const r of n) this.hook(e, r);
  }
  deprecateHooks(e) {
    for (const t in e) this.deprecateHook(t, e[t]);
  }
  addHooks(e) {
    const t = go(e),
      n = Object.keys(t).map((r) => this.hook(r, t[r]));
    return () => {
      for (const r of n) r();
      n.length = 0;
    };
  }
  removeHooks(e) {
    const t = go(e);
    for (const n in t) this.removeHook(n, t[n]);
  }
  removeAllHooks() {
    this._hooks = {};
  }
  callHook(e, ...t) {
    return this.callHookWith(Vp, e, t);
  }
  callHookParallel(e, ...t) {
    return this.callHookWith(Wp, e, t);
  }
  callHookWith(e, t, n) {
    const r = this._before || this._after ? { name: t, args: n, context: {} } : void 0;
    this._before && Is(this._before, r);
    const s = e(this._hooks[t] ? [...this._hooks[t]] : [], n, t);
    return s instanceof Promise
      ? s.finally(() => {
          this._after && r && Is(this._after, r);
        })
      : (this._after && r && Is(this._after, r), s);
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
function qp() {
  return new Kp();
}
const Gp = ['name', 'property', 'http-equiv'],
  Jp = new Set(['viewport', 'description', 'keywords', 'robots']);
function kc(e) {
  const t = e.split(':');
  return t.length ? Qo.has(t[1]) : !1;
}
function mo(e) {
  const { props: t, tag: n } = e;
  if (Lp.has(n)) return n;
  if (n === 'link' && t.rel === 'canonical') return 'canonical';
  if (n === 'link' && t.rel === 'alternate') {
    if (t.hreflang) return `alternate:${t.hreflang}`;
    if (t.type) return `alternate:${t.type}:${t.href || ''}`;
  }
  if (t.charset) return 'charset';
  if (e.tag === 'meta') {
    for (const r of Gp)
      if (t[r] !== void 0) {
        const s = t[r],
          o = s && typeof s == 'string' && s.includes(':'),
          i = s && Jp.has(s),
          l = !(o || i) && e.key ? `:key:${e.key}` : '';
        return `${n}:${s}${l}`;
      }
  }
  if (e.key) return `${n}:key:${e.key}`;
  if (t.id) return `${n}:id:${t.id}`;
  if (n === 'link' && t.rel === 'alternate') return `alternate:${t.href || ''}`;
  if (Ip.has(n)) {
    const r = e.textContent || e.innerHTML;
    if (r) return `${n}:content:${r}`;
  }
}
function xc(e) {
  const t = e._h || e._d;
  if (t) return t;
  const n = e.textContent || e.innerHTML;
  return (
    n ||
    `${e.tag}:${Object.entries(e.props)
      .map(([r, s]) => `${r}:${String(s)}`)
      .join(',')}`
  );
}
function zr(e, t, n) {
  typeof e === 'function' &&
    (!n || (n !== 'titleTemplate' && !(n[0] === 'o' && n[1] === 'n'))) &&
    (e = e());
  const s = t ? t(n, e) : e;
  if (Array.isArray(s)) return s.map((o) => zr(o, t));
  if (s?.constructor === Object) {
    const o = {};
    for (const i of Object.keys(s)) o[i] = zr(s[i], t, i);
    return o;
  }
  return s;
}
function Yp(e, t) {
  const n = e === 'style' ? new Map() : new Set();
  function r(s) {
    if (s == null || s === void 0) return;
    const o = String(s).trim();
    if (o)
      if (e === 'style') {
        const [i, ...a] = o.split(':').map((l) => (l ? l.trim() : ''));
        i && a.length && n.set(i, a.join(':'));
      } else
        o.split(' ')
          .filter(Boolean)
          .forEach((i) => n.add(i));
  }
  return (
    typeof t == 'string'
      ? e === 'style'
        ? t.split(';').forEach(r)
        : r(t)
      : Array.isArray(t)
        ? t.forEach((s) => r(s))
        : t &&
          typeof t == 'object' &&
          Object.entries(t).forEach(([s, o]) => {
            o && o !== 'false' && (e === 'style' ? n.set(String(s).trim(), String(o)) : r(s));
          }),
    n
  );
}
function Oc(e, t) {
  if (((e.props = e.props || {}), !t)) return e;
  if (e.tag === 'templateParams') return ((e.props = t), e);
  const n = ho.has(e.tag) || e.tag === 'htmlAttrs' || e.tag === 'bodyAttrs';
  return (
    Object.entries(t).forEach(([r, s]) => {
      if (r === '__proto__' || r === 'constructor' || r === 'prototype') return;
      if (s === null) {
        e.props[r] = null;
        return;
      }
      if (r === 'class' || r === 'style') {
        e.props[r] = Yp(r, s);
        return;
      }
      if (Hp.has(r)) {
        if ((r === 'textContent' || r === 'innerHTML') && typeof s == 'object') {
          let f = t.type;
          if (
            (t.type || (f = 'application/json'), !f?.endsWith('json') && f !== 'speculationrules')
          )
            return;
          ((t.type = f), (e.props.type = f), (e[r] = JSON.stringify(s)));
        } else e[r] = s;
        return;
      }
      const o = r.startsWith('data-'),
        i = n && !o ? r.toLowerCase() : r,
        a = String(s),
        l = e.tag === 'meta' && i === 'content';
      a === 'true' || a === ''
        ? (e.props[i] = o || l ? a : !0)
        : !s && o && a === 'false'
          ? (e.props[i] = 'false')
          : s !== void 0 && (e.props[i] = s);
    }),
    e
  );
}
function zp(e, t) {
  const n =
      typeof t == 'object' && typeof t != 'function'
        ? t
        : {
            [e === 'script' || e === 'noscript' || e === 'style' ? 'innerHTML' : 'textContent']: t,
          },
    r = Oc({ tag: e, props: {} }, n);
  return (
    r.key && Np.has(r.tag) && (r.props['data-hid'] = r._h = r.key),
    r.tag === 'script' &&
      typeof r.innerHTML == 'object' &&
      ((r.innerHTML = JSON.stringify(r.innerHTML)),
      (r.props.type = r.props.type || 'application/json')),
    Array.isArray(r.props.content)
      ? r.props.content.map((s) => ({ ...r, props: { ...r.props, content: s } }))
      : r
  );
}
function Qp(e, t) {
  if (!e) return [];
  typeof e == 'function' && (e = e());
  const n = (s, o) => {
    for (let i = 0; i < t.length; i++) o = t[i](s, o);
    return o;
  };
  e = n(void 0, e);
  const r = [];
  return (
    (e = zr(e, n)),
    Object.entries(e || {}).forEach(([s, o]) => {
      if (o !== void 0) for (const i of Array.isArray(o) ? o : [o]) r.push(zp(s, i));
    }),
    r.flat()
  );
}
const yo = (e, t) => (e._w === t._w ? e._p - t._p : e._w - t._w),
  ta = { base: -10, title: 10 },
  Xp = { critical: -8, high: -1, low: 2 },
  na = {
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
  Zp = /@import/,
  Fn = (e) => e === '' || e === !0;
function eg(e, t) {
  if (typeof t.tagPriority == 'number') return t.tagPriority;
  let n = 100;
  const r = Xp[t.tagPriority] || 0,
    s = e.resolvedOptions.disableCapoSorting ? { link: {}, script: {}, style: {} } : na;
  if (t.tag in ta) n = ta[t.tag];
  else if (t.tag === 'meta') {
    const o =
      t.props['http-equiv'] === 'content-security-policy'
        ? 'content-security-policy'
        : t.props.charset
          ? 'charset'
          : t.props.name === 'viewport'
            ? 'viewport'
            : null;
    o && (n = na.meta[o]);
  } else if (t.tag === 'link' && t.props.rel) n = s.link[t.props.rel];
  else if (t.tag === 'script') {
    const o = String(t.props.type);
    Fn(t.props.async)
      ? (n = s.script.async)
      : (t.props.src &&
            !Fn(t.props.defer) &&
            !Fn(t.props.async) &&
            o !== 'module' &&
            !o.endsWith('json')) ||
          (t.innerHTML && !o.endsWith('json'))
        ? (n = s.script.sync)
        : ((Fn(t.props.defer) && t.props.src && !Fn(t.props.async)) || o === 'module') &&
          (n = s.script.defer);
  } else
    t.tag === 'style' &&
      (n = t.innerHTML && Zp.test(t.innerHTML) ? s.style.imported : s.style.sync);
  return (n || 100) + r;
}
function ra(e, t) {
  const n = typeof t == 'function' ? t(e) : t,
    r = n.key || String(e.plugins.size + 1);
  e.plugins.get(r) || (e.plugins.set(r, n), e.hooks.addHooks(n.hooks || {}));
}
function tg(e = {}) {
  const t = qp();
  t.addHooks(e.hooks || {});
  const n = !e.document,
    r = new Map(),
    s = new Map(),
    o = new Set(),
    i = {
      _entryCount: 1,
      plugins: s,
      dirty: !1,
      resolvedOptions: e,
      hooks: t,
      ssr: n,
      entries: r,
      headEntries() {
        return [...r.values()];
      },
      use: (a) => ra(i, a),
      push(a, l) {
        const f = { ...(l || {}) };
        delete f.head;
        const c = f._index ?? i._entryCount++,
          u = { _i: c, input: a, options: f },
          h = {
            _poll(d = !1) {
              ((i.dirty = !0), !d && o.add(c), t.callHook('entries:updated', i));
            },
            dispose() {
              r.delete(c) && i.invalidate();
            },
            patch(d) {
              (!f.mode || (f.mode === 'server' && n) || (f.mode === 'client' && !n)) &&
                ((u.input = d), r.set(c, u), h._poll());
            },
          };
        return (h.patch(a), h);
      },
      async resolveTags() {
        const a = { tagMap: new Map(), tags: [], entries: [...i.entries.values()] };
        for (await t.callHook('entries:resolve', a); o.size; ) {
          const h = o.values().next().value;
          o.delete(h);
          const d = r.get(h);
          if (d) {
            const p = {
              tags: Qp(d.input, e.propResolvers || []).map((m) => Object.assign(m, d.options)),
              entry: d,
            };
            (await t.callHook('entries:normalize', p),
              (d._tags = p.tags.map(
                (m, C) => (
                  (m._w = eg(i, m)),
                  (m._p = (d._i << 10) + C),
                  (m._d = mo(m)),
                  m._d || (m._h = xc(m)),
                  m
                ),
              )));
          }
        }
        let l = !1;
        a.entries
          .flatMap((h) => (h._tags || []).map((d) => ({ ...d, props: { ...d.props } })))
          .sort(yo)
          .reduce((h, d) => {
            const p = d._d || d._h;
            if (!h.has(p)) return h.set(p, d);
            const m = h.get(p);
            if (
              (d?.tagDuplicateStrategy ||
                (jp.has(d.tag) ? 'merge' : null) ||
                (d.key && d.key === m.key ? 'merge' : null)) === 'merge'
            ) {
              const E = { ...m.props };
              (Object.entries(d.props).forEach(
                ([w, y]) =>
                  (E[w] =
                    w === 'style'
                      ? new Map([...(m.props.style || new Map()), ...y])
                      : w === 'class'
                        ? new Set([...(m.props.class || new Set()), ...y])
                        : y),
              ),
                h.set(p, { ...d, props: E }));
            } else
              d._p >> 10 === m._p >> 10 && d.tag === 'meta' && kc(p)
                ? (h.set(p, Object.assign([...(Array.isArray(m) ? m : [m]), d], d)), (l = !0))
                : (d._w === m._w ? d._p > m._p : d?._w < m?._w) && h.set(p, d);
            return h;
          }, a.tagMap);
        const f = a.tagMap.get('title'),
          c = a.tagMap.get('titleTemplate');
        if (((i._title = f?.textContent), c)) {
          const h = c?.textContent;
          if (((i._titleTemplate = h), h)) {
            let d = typeof h == 'function' ? h(f?.textContent) : h;
            (typeof d == 'string' &&
              !i.plugins.has('template-params') &&
              (d = d.replace('%s', f?.textContent || '')),
              f
                ? d === null
                  ? a.tagMap.delete('title')
                  : a.tagMap.set('title', { ...f, textContent: d })
                : ((c.tag = 'title'), (c.textContent = d)));
          }
        }
        ((a.tags = Array.from(a.tagMap.values())),
          l && (a.tags = a.tags.flat().sort(yo)),
          await t.callHook('tags:beforeResolve', a),
          await t.callHook('tags:resolve', a),
          await t.callHook('tags:afterResolve', a));
        const u = [];
        for (const h of a.tags) {
          const { innerHTML: d, tag: p, props: m } = h;
          if (
            Dp.has(p) &&
            !(Object.keys(m).length === 0 && !h.innerHTML && !h.textContent) &&
            !(p === 'meta' && !m.content && !m['http-equiv'] && !m.charset)
          ) {
            if (p === 'script' && d) {
              if (String(m.type).endsWith('json')) {
                const C = typeof d == 'string' ? d : JSON.stringify(d);
                h.innerHTML = C.replace(/</g, '\\u003C');
              } else
                typeof d == 'string' &&
                  (h.innerHTML = d.replace(new RegExp(`</${p}`, 'g'), `<\\/${p}`));
              h._d = mo(h);
            }
            u.push(h);
          }
        }
        return u;
      },
      invalidate() {
        for (const a of r.values()) o.add(a._i);
        ((i.dirty = !0), t.callHook('entries:updated', i));
      },
    };
  return (
    (e?.plugins || []).forEach((a) => ra(i, a)),
    i.hooks.callHook('init', i),
    e.init?.forEach((a) => a && i.push(a)),
    i
  );
}
const Ds = '%separator';
function ng(e, t, n = !1) {
  let r;
  if (t === 's' || t === 'pageTitle') r = e.pageTitle;
  else if (t.includes('.')) {
    const s = t.indexOf('.');
    r = e[t.substring(0, s)]?.[t.substring(s + 1)];
  } else r = e[t];
  if (r !== void 0)
    return n
      ? (r || '').replace(/\\/g, '\\\\').replace(/</g, '\\u003C').replace(/"/g, '\\"')
      : r || '';
}
function Tr(e, t, n, r = !1) {
  if (typeof e != 'string' || !e.includes('%')) return e;
  let s = e;
  try {
    s = decodeURI(e);
  } catch {}
  const o = s.match(/%\w+(?:\.\w+)?/g);
  if (!o) return e;
  const i = e.includes(Ds);
  return (
    (e = e
      .replace(/%\w+(?:\.\w+)?/g, (a) => {
        if (a === Ds || !o.includes(a)) return a;
        const l = ng(t, a.slice(1), r);
        return l !== void 0 ? l : a;
      })
      .trim()),
    i &&
      (e = e
        .split(Ds)
        .map((a) => a.trim())
        .filter((a) => a !== '')
        .join(n ? ` ${n} ` : ' ')),
    e
  );
}
const sa = (e) => (e.includes(':key') ? e : e.split(':').join(':key:')),
  rg = {
    key: 'aliasSorting',
    hooks: {
      'tags:resolve': (e) => {
        let t = !1;
        for (const n of e.tags) {
          const r = n.tagPriority;
          if (!r) continue;
          const s = String(r);
          if (s.startsWith('before:')) {
            const o = sa(s.slice(7)),
              i = e.tagMap.get(o);
            i &&
              (typeof i.tagPriority == 'number' && (n.tagPriority = i.tagPriority),
              (n._p = i._p - 1),
              (t = !0));
          } else if (s.startsWith('after:')) {
            const o = sa(s.slice(6)),
              i = e.tagMap.get(o);
            i &&
              (typeof i.tagPriority == 'number' && (n.tagPriority = i.tagPriority),
              (n._p = i._p + 1),
              (t = !0));
          }
        }
        t && (e.tags = e.tags.sort(yo));
      },
    },
  },
  sg = {
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
async function _o(e) {
  if (typeof e === 'function') return e;
  if (e instanceof Promise) return await e;
  if (Array.isArray(e)) return await Promise.all(e.map((n) => _o(n)));
  if (e?.constructor === Object) {
    const n = {};
    for (const r of Object.keys(e)) n[r] = await _o(e[r]);
    return n;
  }
  return e;
}
const og = {
    key: 'promises',
    hooks: {
      'entries:resolve': async (e) => {
        const t = [];
        for (const n in e.entries)
          e.entries[n]._promisesProcessed ||
            t.push(
              _o(e.entries[n].input).then((r) => {
                ((e.entries[n].input = r), (e.entries[n]._promisesProcessed = !0));
              }),
            );
        await Promise.all(t);
      },
    },
  },
  ig = { meta: 'content', link: 'href', htmlAttrs: 'lang' },
  ag = ['innerHTML', 'textContent'],
  lg = (e) => ({
    key: 'template-params',
    hooks: {
      'entries:normalize': (t) => {
        const n =
          t.tags.filter((r) => r.tag === 'templateParams' && r.mode === 'server')?.[0]?.props || {};
        Object.keys(n).length &&
          (e._ssrPayload = { templateParams: { ...(e._ssrPayload?.templateParams || {}), ...n } });
      },
      'tags:resolve': ({ tagMap: t, tags: n }) => {
        const r = t.get('templateParams')?.props || {},
          s = r.separator || '|';
        (delete r.separator, (r.pageTitle = Tr(r.pageTitle || e._title || '', r, s)));
        for (const o of n) {
          if (o.processTemplateParams === !1) continue;
          const i = ig[o.tag];
          if (i && typeof o.props[i] == 'string') o.props[i] = Tr(o.props[i], r, s);
          else if (o.processTemplateParams || o.tag === 'titleTemplate' || o.tag === 'title')
            for (const a of ag)
              typeof o[a] == 'string' &&
                (o[a] = Tr(o[a], r, s, o.tag === 'script' && o.props.type.endsWith('json')));
        }
        ((e._templateParams = r), (e._separator = s));
      },
      'tags:afterResolve': ({ tagMap: t }) => {
        const n = t.get('title');
        n?.textContent &&
          n.processTemplateParams !== !1 &&
          (n.textContent = Tr(n.textContent, e._templateParams, e._separator));
      },
    },
  }),
  cg = (e, t) => (Ee(t) ? nl(t) : t),
  Mc = 'usehead';
function ug(e) {
  return {
    install(n) {
      ((n.config.globalProperties.$unhead = e),
        (n.config.globalProperties.$head = e),
        n.provide(Mc, e));
    },
  }.install;
}
function Nc() {
  if (Fo()) {
    const e = $e(Mc);
    if (e) return e;
  }
  throw new Error(
    'useHead() was called without provide context, ensure you call it through the setup() function.',
  );
}
function fg(e, t = {}) {
  const n = t.head || Nc();
  return n.ssr ? n.push(e || {}, t) : dg(n, e, t);
}
function dg(e, t, n = {}) {
  const r = st(!1);
  let s;
  return (
    Yu(() => {
      const i = r.value ? {} : zr(t, cg);
      s ? s.patch(i) : (s = e.push(i, n));
    }),
    Pt() &&
      (Mn(() => {
        s.dispose();
      }),
      _l(() => {
        r.value = !0;
      }),
      yl(() => {
        r.value = !1;
      })),
    s
  );
}
function Ky(e = {}, t = {}) {
  (t.head || Nc()).use(Bp);
  const { title: r, titleTemplate: s, ...o } = e;
  return fg({ title: r, titleTemplate: s, _flatMeta: o }, t);
}
const hg = (() => {
    const e = {};
    return (t, n) => {
      let r = [];
      n.charCodeAt(n.length - 1) === 47 && (n = n.slice(0, -1) || '/');
      let s = n.split('/');
      return (
        s.length > 1 &&
          s[1] === 'api' &&
          r.unshift({ data: e, params: { _: s.slice(2).join('/') } }),
        r
      );
    };
  })(),
  pg = (e) =>
    yc(
      {},
      ...hg('', typeof e == 'string' ? e.toLowerCase() : e)
        .map((t) => t.data)
        .reverse(),
    ),
  gg = pg;
let kr;
function mg() {
  let e;
  return (
    (e = $fetch(zo(`builds/meta/${In().app.buildId}.json`), { responseType: 'json' }).then((t) => {
      if (!t || typeof t != 'object' || !Array.isArray(t.prerendered))
        throw new Error(
          '[nuxt] Received malformed app manifest. Ensure that `builds/meta/*.json` is served as JSON by your hosting/proxy and not rewritten to an HTML fallback.',
        );
      return t;
    })),
    (kr = e),
    e.catch((t) => {
      (kr === e && (kr = void 0), console.error('[nuxt] Error fetching app manifest.', t));
    }),
    e
  );
}
function Ic() {
  return kr || mg();
}
function Dc(e) {
  const t = typeof e == 'string' ? e : e.path;
  try {
    return gg(t.toLowerCase());
  } catch (n) {
    return (console.error('[nuxt] Error matching route rules.', n), {});
  }
}
async function oa(e, t = {}) {
  return null;
}
async function yg(e) {
  return null;
}
let qt = null;
async function _g() {
  if (qt) return qt;
  const e = document.getElementById('__NUXT_DATA__');
  if (!e) return {};
  const t = await bg(e.textContent || ''),
    n = e.dataset.src ? await yg(e.dataset.src) : void 0;
  return (
    (qt = { ...t, ...n, ...window.__NUXT__ }),
    qt.config?.public && (qt.config.public = $t(qt.config.public)),
    qt
  );
}
async function bg(e) {
  return await Op(e, be()._payloadRevivers);
}
function vg(e, t) {
  be()._payloadRevivers[e] = t;
}
const wg = [
    ['NuxtError', (e) => Ft(e)],
    ['EmptyShallowRef', (e) => Rt(e === '_' ? void 0 : e === '0n' ? BigInt(0) : Kr(e))],
    ['EmptyRef', (e) => st(e === '_' ? void 0 : e === '0n' ? BigInt(0) : Kr(e))],
    ['ShallowRef', (e) => Rt(e)],
    ['ShallowReactive', (e) => Tt(e)],
    ['Ref', (e) => st(e)],
    ['Reactive', (e) => $t(e)],
  ],
  Eg = xt({
    name: 'nuxt:revive-payload:client',
    order: -30,
    async setup(e) {
      let t, n;
      for (const [r, s] of wg) vg(r, s);
      (Object.assign(e.payload, (([t, n] = Xn(() => e.runWithContext(_g))), (t = await t), n(), t)),
        (window.__NUXT__ = e.payload));
    },
  });
async function Xo(e, t = {}) {
  const n = t.document || e.resolvedOptions.document;
  if (!n || !e.dirty) return;
  const r = { shouldRender: !0, tags: [] };
  if ((await e.hooks.callHook('dom:beforeRender', r), !!r.shouldRender))
    return (
      e._domUpdatePromise ||
        (e._domUpdatePromise = new Promise(async (s) => {
          const o = new Map(),
            i = new Promise((d) => {
              e.resolveTags().then((p) => {
                d(
                  p.map((m) => {
                    const C = o.get(m._d) || 0,
                      E = { tag: m, id: (C ? `${m._d}:${C}` : m._d) || m._h, shouldRender: !0 };
                    return (m._d && kc(m._d) && o.set(m._d, C + 1), E);
                  }),
                );
              });
            });
          let a = e._dom;
          if (!a) {
            a = {
              title: n.title,
              elMap: new Map().set('htmlAttrs', n.documentElement).set('bodyAttrs', n.body),
            };
            for (const d of ['body', 'head']) {
              const p = n[d]?.children;
              for (const m of p) {
                const C = m.tagName.toLowerCase();
                if (!ho.has(C)) continue;
                const E = Oc(
                  { tag: C, props: {} },
                  {
                    innerHTML: m.innerHTML,
                    ...(m
                      .getAttributeNames()
                      .reduce((w, y) => ((w[y] = m.getAttribute(y)), w), {}) || {}),
                  },
                );
                if (
                  ((E.key = m.getAttribute('data-hid') || void 0),
                  (E._d = mo(E) || xc(E)),
                  a.elMap.has(E._d))
                ) {
                  let w = 1,
                    y = E._d;
                  for (; a.elMap.has(y); ) y = `${E._d}:${w++}`;
                  a.elMap.set(y, m);
                } else a.elMap.set(E._d, m);
              }
            }
          }
          ((a.pendingSideEffects = { ...a.sideEffects }), (a.sideEffects = {}));
          function l(d, p, m) {
            const C = `${d}:${p}`;
            ((a.sideEffects[C] = m), delete a.pendingSideEffects[C]);
          }
          function f({ id: d, $el: p, tag: m }) {
            const C = m.tag.endsWith('Attrs');
            (a.elMap.set(d, p),
              C ||
                (m.textContent &&
                  m.textContent !== p.textContent &&
                  (p.textContent = m.textContent),
                m.innerHTML && m.innerHTML !== p.innerHTML && (p.innerHTML = m.innerHTML),
                l(d, 'el', () => {
                  (p?.remove(), a.elMap.delete(d));
                })));
            for (const E in m.props) {
              if (!Object.prototype.hasOwnProperty.call(m.props, E)) continue;
              const w = m.props[E];
              if (E.startsWith('on') && typeof w == 'function') {
                const _ = p?.dataset;
                if (_ && _[`${E}fired`]) {
                  const v = E.slice(0, -5);
                  w.call(p, new Event(v.substring(2)));
                }
                p.getAttribute(`data-${E}`) !== '' &&
                  ((m.tag === 'bodyAttrs' ? n.defaultView : p).addEventListener(
                    E.substring(2),
                    w.bind(p),
                  ),
                  p.setAttribute(`data-${E}`, ''));
                continue;
              }
              const y = `attr:${E}`;
              if (E === 'class') {
                if (!w) continue;
                for (const _ of w)
                  (C && l(d, `${y}:${_}`, () => p.classList.remove(_)),
                    !p.classList.contains(_) && p.classList.add(_));
              } else if (E === 'style') {
                if (!w) continue;
                for (const [_, v] of w)
                  (l(d, `${y}:${_}`, () => {
                    p.style.removeProperty(_);
                  }),
                    p.style.setProperty(_, v));
              } else
                w !== !1 &&
                  w !== null &&
                  (p.getAttribute(E) !== w && p.setAttribute(E, w === !0 ? '' : String(w)),
                  C && l(d, y, () => p.removeAttribute(E)));
            }
          }
          const c = [],
            u = { bodyClose: void 0, bodyOpen: void 0, head: void 0 },
            h = await i;
          for (const d of h) {
            const { tag: p, shouldRender: m, id: C } = d;
            if (m) {
              if (p.tag === 'title') {
                ((n.title = p.textContent), l('title', '', () => (n.title = a.title)));
                continue;
              }
              ((d.$el = d.$el || a.elMap.get(C)), d.$el ? f(d) : ho.has(p.tag) && c.push(d));
            }
          }
          for (const d of c) {
            const p = d.tag.tagPosition || 'head';
            ((d.$el = n.createElement(d.tag.tag)),
              f(d),
              (u[p] = u[p] || n.createDocumentFragment()),
              u[p].appendChild(d.$el));
          }
          for (const d of h) await e.hooks.callHook('dom:renderTag', d, n, l);
          (u.head && n.head.appendChild(u.head),
            u.bodyOpen && n.body.insertBefore(u.bodyOpen, n.body.firstChild),
            u.bodyClose && n.body.appendChild(u.bodyClose));
          for (const d in a.pendingSideEffects) a.pendingSideEffects[d]();
          ((e._dom = a), await e.hooks.callHook('dom:rendered', { renders: h }), s());
        }).finally(() => {
          ((e._domUpdatePromise = void 0), (e.dirty = !1));
        })),
      e._domUpdatePromise
    );
}
function Tg(e = {}) {
  const t = e.domOptions?.render || Xo;
  e.document = e.document || (typeof window < 'u' ? document : void 0);
  const n = e.document?.head.querySelector('script[id="unhead:payload"]')?.innerHTML || !1;
  return tg({
    ...e,
    plugins: [...(e.plugins || []), { key: 'client', hooks: { 'entries:updated': t } }],
    init: [n ? JSON.parse(n) : !1, ...(e.init || [])],
  });
}
function Cg(e, t) {
  let n = 0;
  return () => {
    const r = ++n;
    t(() => {
      n === r && e();
    });
  };
}
function Sg(e = {}) {
  const t = Tg({
    domOptions: {
      render: Cg(
        () => Xo(t),
        (n) => setTimeout(n, 0),
      ),
    },
    ...e,
  });
  return ((t.install = ug(t)), t);
}
const Rg = { disableDefaults: !0, disableCapoSorting: !1, plugins: [sg, og, lg, rg] },
  Ag = xt({
    name: 'nuxt:head',
    enforce: 'pre',
    setup(e) {
      const t = Sg(Rg);
      e.vueApp.use(t);
      {
        let n = !0;
        const r = async () => {
          ((n = !1), await Xo(t));
        };
        (t.hooks.hook('dom:beforeRender', (o) => {
          o.shouldRender = !n;
        }),
          e.hooks.hook('page:start', () => {
            n = !0;
          }),
          e.hooks.hook('page:finish', () => {
            e.isHydrating || r();
          }),
          e.hooks.hook('app:error', r),
          e.hooks.hook('app:suspense:resolve', r));
        const s = t.push.bind(t);
        t.push = (o, i) => {
          const a = s(o, i),
            l = a.dispose.bind(a);
          return (
            (a.dispose = () => {
              const f = e['~transitionPromise'];
              f ? f.then(l) : l();
            }),
            a
          );
        };
      }
    },
  });
const dn = typeof document < 'u';
function Lc(e) {
  return typeof e == 'object' || 'displayName' in e || 'props' in e || '__vccOpts' in e;
}
function Pg(e) {
  return e.__esModule || e[Symbol.toStringTag] === 'Module' || (e.default && Lc(e.default));
}
const ae = Object.assign;
function Ls(e, t) {
  const n = {};
  for (const r in t) {
    const s = t[r];
    n[r] = it(s) ? s.map(e) : e(s);
  }
  return n;
}
const Zn = () => {},
  it = Array.isArray;
function ia(e, t) {
  const n = {};
  for (const r in e) n[r] = r in t ? t[r] : e[r];
  return n;
}
const Hc = /#/g,
  kg = /&/g,
  xg = /\//g,
  Og = /=/g,
  Mg = /\?/g,
  jc = /\+/g,
  Ng = /%5B/g,
  Ig = /%5D/g,
  Fc = /%5E/g,
  Dg = /%60/g,
  $c = /%7B/g,
  Lg = /%7C/g,
  Uc = /%7D/g,
  Hg = /%20/g;
function Zo(e) {
  return e == null
    ? ''
    : encodeURI('' + e)
        .replace(Lg, '|')
        .replace(Ng, '[')
        .replace(Ig, ']');
}
function jg(e) {
  return Zo(e).replace($c, '{').replace(Uc, '}').replace(Fc, '^');
}
function bo(e) {
  return Zo(e)
    .replace(jc, '%2B')
    .replace(Hg, '+')
    .replace(Hc, '%23')
    .replace(kg, '%26')
    .replace(Dg, '`')
    .replace($c, '{')
    .replace(Uc, '}')
    .replace(Fc, '^');
}
function Fg(e) {
  return bo(e).replace(Og, '%3D');
}
function $g(e) {
  return Zo(e).replace(Hc, '%23').replace(Mg, '%3F');
}
function Ug(e) {
  return $g(e).replace(xg, '%2F');
}
function ur(e) {
  if (e == null) return null;
  try {
    return decodeURIComponent('' + e);
  } catch {}
  return '' + e;
}
const Bg = /\/$/,
  Vg = (e) => e.replace(Bg, '');
function Hs(e, t, n = '/') {
  let r,
    s = {},
    o = '',
    i = '';
  const a = t.indexOf('#');
  let l = t.indexOf('?');
  return (
    (l = a >= 0 && l > a ? -1 : l),
    l >= 0 && ((r = t.slice(0, l)), (o = t.slice(l, a > 0 ? a : t.length)), (s = e(o.slice(1)))),
    a >= 0 && ((r = r || t.slice(0, a)), (i = t.slice(a, t.length))),
    (r = Gg(r ?? t, n)),
    { fullPath: r + o + i, path: r, query: s, hash: ur(i) }
  );
}
function Wg(e, t) {
  const n = t.query ? e(t.query) : '';
  return t.path + (n && '?') + n + (t.hash || '');
}
function aa(e, t) {
  return !t || !e.toLowerCase().startsWith(t.toLowerCase()) ? e : e.slice(t.length) || '/';
}
function Kg(e, t, n) {
  const r = t.matched.length - 1,
    s = n.matched.length - 1;
  return (
    r > -1 &&
    r === s &&
    Pn(t.matched[r], n.matched[s]) &&
    Bc(t.params, n.params) &&
    e(t.query) === e(n.query) &&
    t.hash === n.hash
  );
}
function Pn(e, t) {
  return (e.aliasOf || e) === (t.aliasOf || t);
}
function Bc(e, t) {
  if (Object.keys(e).length !== Object.keys(t).length) return !1;
  for (var n in e) if (!qg(e[n], t[n])) return !1;
  return !0;
}
function qg(e, t) {
  return it(e) ? la(e, t) : it(t) ? la(t, e) : e?.valueOf() === t?.valueOf();
}
function la(e, t) {
  return it(t)
    ? e.length === t.length && e.every((n, r) => n === t[r])
    : e.length === 1 && e[0] === t;
}
function Gg(e, t) {
  if (e.startsWith('/')) return e;
  if (!e) return t;
  const n = t.split('/'),
    r = e.split('/'),
    s = r[r.length - 1];
  (s === '..' || s === '.') && r.push('');
  let o = n.length - 1,
    i,
    a;
  for (i = 0; i < r.length; i++)
    if (((a = r[i]), a !== '.'))
      if (a === '..') o > 1 && o--;
      else break;
  return n.slice(0, o).join('/') + '/' + r.slice(i).join('/');
}
const ze = {
  path: '/',
  name: void 0,
  params: {},
  query: {},
  hash: '',
  fullPath: '/',
  matched: [],
  meta: {},
  redirectedFrom: void 0,
};
let vo = (function (e) {
    return ((e.pop = 'pop'), (e.push = 'push'), e);
  })({}),
  js = (function (e) {
    return ((e.back = 'back'), (e.forward = 'forward'), (e.unknown = ''), e);
  })({});
function Jg(e) {
  if (!e)
    if (dn) {
      const t = document.querySelector('base');
      ((e = (t && t.getAttribute('href')) || '/'), (e = e.replace(/^\w+:\/\/[^\/]+/, '')));
    } else e = '/';
  return (e[0] !== '/' && e[0] !== '#' && (e = '/' + e), Vg(e));
}
const Yg = /^[^#]+#/;
function zg(e, t) {
  return e.replace(Yg, '#') + t;
}
function Qg(e, t) {
  const n = document.documentElement.getBoundingClientRect(),
    r = e.getBoundingClientRect();
  return {
    behavior: t.behavior,
    left: r.left - n.left - (t.left || 0),
    top: r.top - n.top - (t.top || 0),
  };
}
const gs = () => ({ left: window.scrollX, top: window.scrollY });
function Xg(e) {
  let t;
  if ('el' in e) {
    const n = e.el,
      r = typeof n == 'string' && n.startsWith('#'),
      s =
        typeof n == 'string'
          ? r
            ? document.getElementById(n.slice(1))
            : document.querySelector(n)
          : n;
    if (!s) return;
    t = Qg(s, e);
  } else t = e;
  'scrollBehavior' in document.documentElement.style
    ? window.scrollTo(t)
    : window.scrollTo(
        t.left != null ? t.left : window.scrollX,
        t.top != null ? t.top : window.scrollY,
      );
}
function ca(e, t) {
  return (history.state ? history.state.position - t : -1) + e;
}
const wo = new Map();
function Zg(e, t) {
  wo.set(e, t);
}
function em(e) {
  const t = wo.get(e);
  return (wo.delete(e), t);
}
function tm(e) {
  return typeof e == 'string' || (e && typeof e == 'object');
}
function Vc(e) {
  return typeof e == 'string' || typeof e == 'symbol';
}
let ye = (function (e) {
  return (
    (e[(e.MATCHER_NOT_FOUND = 1)] = 'MATCHER_NOT_FOUND'),
    (e[(e.NAVIGATION_GUARD_REDIRECT = 2)] = 'NAVIGATION_GUARD_REDIRECT'),
    (e[(e.NAVIGATION_ABORTED = 4)] = 'NAVIGATION_ABORTED'),
    (e[(e.NAVIGATION_CANCELLED = 8)] = 'NAVIGATION_CANCELLED'),
    (e[(e.NAVIGATION_DUPLICATED = 16)] = 'NAVIGATION_DUPLICATED'),
    e
  );
})({});
const Wc = Symbol('');
(ye.MATCHER_NOT_FOUND + '',
  ye.NAVIGATION_GUARD_REDIRECT + '',
  ye.NAVIGATION_ABORTED + '',
  ye.NAVIGATION_CANCELLED + '',
  ye.NAVIGATION_DUPLICATED + '');
function kn(e, t) {
  return ae(new Error(), { type: e, [Wc]: !0 }, t);
}
function _t(e, t) {
  return e instanceof Error && Wc in e && (t == null || !!(e.type & t));
}
const nm = ['params', 'query', 'hash'];
function rm(e) {
  if (typeof e == 'string') return e;
  if (e.path != null) return e.path;
  const t = {};
  for (const n of nm) n in e && (t[n] = e[n]);
  return JSON.stringify(t, null, 2);
}
function sm(e) {
  const t = {};
  if (e === '' || e === '?') return t;
  const n = (e[0] === '?' ? e.slice(1) : e).split('&');
  for (let r = 0; r < n.length; ++r) {
    const s = n[r].replace(jc, ' '),
      o = s.indexOf('='),
      i = ur(o < 0 ? s : s.slice(0, o)),
      a = o < 0 ? null : ur(s.slice(o + 1));
    if (i in t) {
      let l = t[i];
      (it(l) || (l = t[i] = [l]), l.push(a));
    } else t[i] = a;
  }
  return t;
}
function ua(e) {
  let t = '';
  for (let n in e) {
    const r = e[n];
    if (((n = Fg(n)), r == null)) {
      r !== void 0 && (t += (t.length ? '&' : '') + n);
      continue;
    }
    (it(r) ? r.map((s) => s && bo(s)) : [r && bo(r)]).forEach((s) => {
      s !== void 0 && ((t += (t.length ? '&' : '') + n), s != null && (t += '=' + s));
    });
  }
  return t;
}
function om(e) {
  const t = {};
  for (const n in e) {
    const r = e[n];
    r !== void 0 &&
      (t[n] = it(r) ? r.map((s) => (s == null ? null : '' + s)) : r == null ? r : '' + r);
  }
  return t;
}
const im = Symbol(''),
  fa = Symbol(''),
  ei = Symbol(''),
  Kc = Symbol(''),
  Eo = Symbol('');
function $n() {
  let e = [];
  function t(r) {
    return (
      e.push(r),
      () => {
        const s = e.indexOf(r);
        s > -1 && e.splice(s, 1);
      }
    );
  }
  function n() {
    e = [];
  }
  return { add: t, list: () => e.slice(), reset: n };
}
function Dt(e, t, n, r, s, o = (i) => i()) {
  const i = r && (r.enterCallbacks[s] = r.enterCallbacks[s] || []);
  return () =>
    new Promise((a, l) => {
      const f = (h) => {
          h === !1
            ? l(kn(ye.NAVIGATION_ABORTED, { from: n, to: t }))
            : h instanceof Error
              ? l(h)
              : tm(h)
                ? l(kn(ye.NAVIGATION_GUARD_REDIRECT, { from: t, to: h }))
                : (i && r.enterCallbacks[s] === i && typeof h == 'function' && i.push(h), a());
        },
        c = o(() => e.call(r && r.instances[s], t, n, f));
      let u = Promise.resolve(c);
      (e.length < 3 && (u = u.then(f)), u.catch((h) => l(h)));
    });
}
function Fs(e, t, n, r, s = (o) => o()) {
  const o = [];
  for (const i of e)
    for (const a in i.components) {
      let l = i.components[a];
      if (!(t !== 'beforeRouteEnter' && !i.instances[a]))
        if (Lc(l)) {
          const f = (l.__vccOpts || l)[t];
          f && o.push(Dt(f, n, r, i, a, s));
        } else {
          let f = l();
          o.push(() =>
            f.then((c) => {
              if (!c) throw new Error(`Couldn't resolve component "${a}" at "${i.path}"`);
              const u = Pg(c) ? c.default : c;
              ((i.mods[a] = c), (i.components[a] = u));
              const h = (u.__vccOpts || u)[t];
              return h && Dt(h, n, r, i, a, s)();
            }),
          );
        }
    }
  return o;
}
function am(e, t) {
  const n = [],
    r = [],
    s = [],
    o = Math.max(t.matched.length, e.matched.length);
  for (let i = 0; i < o; i++) {
    const a = t.matched[i];
    a && (e.matched.find((f) => Pn(f, a)) ? r.push(a) : n.push(a));
    const l = e.matched[i];
    l && (t.matched.find((f) => Pn(f, l)) || s.push(l));
  }
  return [n, r, s];
}
let lm = () => location.protocol + '//' + location.host;
function qc(e, t) {
  const { pathname: n, search: r, hash: s } = t,
    o = e.indexOf('#');
  if (o > -1) {
    let i = s.includes(e.slice(o)) ? e.slice(o).length : 1,
      a = s.slice(i);
    return (a[0] !== '/' && (a = '/' + a), aa(a, ''));
  }
  return aa(n, e) + r + s;
}
function cm(e, t, n, r) {
  let s = [],
    o = [],
    i = null;
  const a = ({ state: h }) => {
    const d = qc(e, location),
      p = n.value,
      m = t.value;
    let C = 0;
    if (h) {
      if (((n.value = d), (t.value = h), i && i === p)) {
        i = null;
        return;
      }
      C = m ? h.position - m.position : 0;
    } else r(d);
    s.forEach((E) => {
      E(n.value, p, {
        delta: C,
        type: vo.pop,
        direction: C ? (C > 0 ? js.forward : js.back) : js.unknown,
      });
    });
  };
  function l() {
    i = n.value;
  }
  function f(h) {
    s.push(h);
    const d = () => {
      const p = s.indexOf(h);
      p > -1 && s.splice(p, 1);
    };
    return (o.push(d), d);
  }
  function c() {
    if (document.visibilityState === 'hidden') {
      const { history: h } = window;
      if (!h.state) return;
      h.replaceState(ae({}, h.state, { scroll: gs() }), '');
    }
  }
  function u() {
    for (const h of o) h();
    ((o = []),
      window.removeEventListener('popstate', a),
      window.removeEventListener('pagehide', c),
      document.removeEventListener('visibilitychange', c));
  }
  return (
    window.addEventListener('popstate', a),
    window.addEventListener('pagehide', c),
    document.addEventListener('visibilitychange', c),
    { pauseListeners: l, listen: f, destroy: u }
  );
}
function da(e, t, n, r = !1, s = !1) {
  return {
    back: e,
    current: t,
    forward: n,
    replaced: r,
    position: window.history.length,
    scroll: s ? gs() : null,
  };
}
function um(e) {
  const { history: t, location: n } = window,
    r = { value: qc(e, n) },
    s = { value: t.state };
  s.value ||
    o(
      r.value,
      {
        back: null,
        current: r.value,
        forward: null,
        position: t.length - 1,
        replaced: !0,
        scroll: null,
      },
      !0,
    );
  function o(l, f, c) {
    const u = e.indexOf('#'),
      h = u > -1 ? (n.host && document.querySelector('base') ? e : e.slice(u)) + l : lm() + e + l;
    try {
      (t[c ? 'replaceState' : 'pushState'](f, '', h), (s.value = f));
    } catch (d) {
      (console.error(d), n[c ? 'replace' : 'assign'](h));
    }
  }
  function i(l, f) {
    (o(
      l,
      ae({}, t.state, da(s.value.back, l, s.value.forward, !0), f, { position: s.value.position }),
      !0,
    ),
      (r.value = l));
  }
  function a(l, f) {
    const c = ae({}, s.value, t.state, { forward: l, scroll: gs() });
    (o(c.current, c, !0),
      o(l, ae({}, da(r.value, l, null), { position: c.position + 1 }, f), !1),
      (r.value = l));
  }
  return { location: r, state: s, push: a, replace: i };
}
function fm(e) {
  e = Jg(e);
  const t = um(e),
    n = cm(e, t.state, t.location, t.replace);
  function r(o, i = !0) {
    (i || n.pauseListeners(), history.go(o));
  }
  const s = ae({ location: '', base: e, go: r, createHref: zg.bind(null, e) }, t, n);
  return (
    Object.defineProperty(s, 'location', { enumerable: !0, get: () => t.location.value }),
    Object.defineProperty(s, 'state', { enumerable: !0, get: () => t.state.value }),
    s
  );
}
let Qt = (function (e) {
  return (
    (e[(e.Static = 0)] = 'Static'),
    (e[(e.Param = 1)] = 'Param'),
    (e[(e.Group = 2)] = 'Group'),
    e
  );
})({});
var Ce = (function (e) {
  return (
    (e[(e.Static = 0)] = 'Static'),
    (e[(e.Param = 1)] = 'Param'),
    (e[(e.ParamRegExp = 2)] = 'ParamRegExp'),
    (e[(e.ParamRegExpEnd = 3)] = 'ParamRegExpEnd'),
    (e[(e.EscapeNext = 4)] = 'EscapeNext'),
    e
  );
})(Ce || {});
const dm = { type: Qt.Static, value: '' },
  hm = /[a-zA-Z0-9_]/;
function pm(e) {
  if (!e) return [[]];
  if (e === '/') return [[dm]];
  if (!e.startsWith('/')) throw new Error(`Invalid path "${e}"`);
  function t(d) {
    throw new Error(`ERR (${n})/"${f}": ${d}`);
  }
  let n = Ce.Static,
    r = n;
  const s = [];
  let o;
  function i() {
    (o && s.push(o), (o = []));
  }
  let a = 0,
    l,
    f = '',
    c = '';
  function u() {
    f &&
      (n === Ce.Static
        ? o.push({ type: Qt.Static, value: f })
        : n === Ce.Param || n === Ce.ParamRegExp || n === Ce.ParamRegExpEnd
          ? (o.length > 1 &&
              (l === '*' || l === '+') &&
              t(`A repeatable param (${f}) must be alone in its segment. eg: '/:ids+.`),
            o.push({
              type: Qt.Param,
              value: f,
              regexp: c,
              repeatable: l === '*' || l === '+',
              optional: l === '*' || l === '?',
            }))
          : t('Invalid state to consume buffer'),
      (f = ''));
  }
  function h() {
    f += l;
  }
  for (; a < e.length; ) {
    if (((l = e[a++]), l === '\\' && n !== Ce.ParamRegExp)) {
      ((r = n), (n = Ce.EscapeNext));
      continue;
    }
    switch (n) {
      case Ce.Static:
        l === '/' ? (f && u(), i()) : l === ':' ? (u(), (n = Ce.Param)) : h();
        break;
      case Ce.EscapeNext:
        (h(), (n = r));
        break;
      case Ce.Param:
        l === '('
          ? (n = Ce.ParamRegExp)
          : hm.test(l)
            ? h()
            : (u(), (n = Ce.Static), l !== '*' && l !== '?' && l !== '+' && a--);
        break;
      case Ce.ParamRegExp:
        l === ')'
          ? c[c.length - 1] == '\\'
            ? (c = c.slice(0, -1) + l)
            : (n = Ce.ParamRegExpEnd)
          : (c += l);
        break;
      case Ce.ParamRegExpEnd:
        (u(), (n = Ce.Static), l !== '*' && l !== '?' && l !== '+' && a--, (c = ''));
        break;
      default:
        t('Unknown state');
        break;
    }
  }
  return (n === Ce.ParamRegExp && t(`Unfinished custom RegExp for param "${f}"`), u(), i(), s);
}
const ha = '[^/]+?',
  gm = { sensitive: !1, strict: !1, start: !0, end: !0 };
var Me = (function (e) {
  return (
    (e[(e._multiplier = 10)] = '_multiplier'),
    (e[(e.Root = 90)] = 'Root'),
    (e[(e.Segment = 40)] = 'Segment'),
    (e[(e.SubSegment = 30)] = 'SubSegment'),
    (e[(e.Static = 40)] = 'Static'),
    (e[(e.Dynamic = 20)] = 'Dynamic'),
    (e[(e.BonusCustomRegExp = 10)] = 'BonusCustomRegExp'),
    (e[(e.BonusWildcard = -50)] = 'BonusWildcard'),
    (e[(e.BonusRepeatable = -20)] = 'BonusRepeatable'),
    (e[(e.BonusOptional = -8)] = 'BonusOptional'),
    (e[(e.BonusStrict = 0.7000000000000001)] = 'BonusStrict'),
    (e[(e.BonusCaseSensitive = 0.25)] = 'BonusCaseSensitive'),
    e
  );
})(Me || {});
const mm = /[.+*?^${}()[\]/\\]/g;
function ym(e, t) {
  const n = ae({}, gm, t),
    r = [];
  let s = n.start ? '^' : '';
  const o = [];
  for (const f of e) {
    const c = f.length ? [] : [Me.Root];
    n.strict && !f.length && (s += '/');
    for (let u = 0; u < f.length; u++) {
      const h = f[u];
      let d = Me.Segment + (n.sensitive ? Me.BonusCaseSensitive : 0);
      if (h.type === Qt.Static)
        (u || (s += '/'), (s += h.value.replace(mm, '\\$&')), (d += Me.Static));
      else if (h.type === Qt.Param) {
        const { value: p, repeatable: m, optional: C, regexp: E } = h;
        o.push({ name: p, repeatable: m, optional: C });
        const w = E || ha;
        if (w !== ha) {
          d += Me.BonusCustomRegExp;
          try {
            `${w}`;
          } catch (_) {
            throw new Error(`Invalid custom RegExp for param "${p}" (${w}): ` + _.message);
          }
        }
        let y = m ? `((?:${w})(?:/(?:${w}))*)` : `(${w})`;
        (u || (y = C && f.length < 2 ? `(?:/${y})` : '/' + y),
          C && (y += '?'),
          (s += y),
          (d += Me.Dynamic),
          C && (d += Me.BonusOptional),
          m && (d += Me.BonusRepeatable),
          w === '.*' && (d += Me.BonusWildcard));
      }
      c.push(d);
    }
    r.push(c);
  }
  if (n.strict && n.end) {
    const f = r.length - 1;
    r[f][r[f].length - 1] += Me.BonusStrict;
  }
  (n.strict || (s += '/?'), n.end ? (s += '$') : n.strict && !s.endsWith('/') && (s += '(?:/|$)'));
  const i = new RegExp(s, n.sensitive ? '' : 'i');
  function a(f) {
    const c = f.match(i),
      u = {};
    if (!c) return null;
    for (let h = 1; h < c.length; h++) {
      const d = c[h] || '',
        p = o[h - 1];
      u[p.name] = d && p.repeatable ? d.split('/') : d;
    }
    return u;
  }
  function l(f) {
    let c = '',
      u = !1;
    for (const h of e) {
      ((!u || !c.endsWith('/')) && (c += '/'), (u = !1));
      for (const d of h)
        if (d.type === Qt.Static) c += d.value;
        else if (d.type === Qt.Param) {
          const { value: p, repeatable: m, optional: C } = d,
            E = p in f ? f[p] : '';
          if (it(E) && !m)
            throw new Error(
              `Provided param "${p}" is an array but it is not repeatable (* or + modifiers)`,
            );
          const w = it(E) ? E.join('/') : E;
          if (!w)
            if (C) h.length < 2 && (c.endsWith('/') ? (c = c.slice(0, -1)) : (u = !0));
            else throw new Error(`Missing required param "${p}"`);
          c += w;
        }
    }
    return c || '/';
  }
  return { re: i, score: r, keys: o, parse: a, stringify: l };
}
function _m(e, t) {
  let n = 0;
  for (; n < e.length && n < t.length; ) {
    const r = t[n] - e[n];
    if (r) return r;
    n++;
  }
  return e.length < t.length
    ? e.length === 1 && e[0] === Me.Static + Me.Segment
      ? -1
      : 1
    : e.length > t.length
      ? t.length === 1 && t[0] === Me.Static + Me.Segment
        ? 1
        : -1
      : 0;
}
function Gc(e, t) {
  let n = 0;
  const r = e.score,
    s = t.score;
  for (; n < r.length && n < s.length; ) {
    const o = _m(r[n], s[n]);
    if (o) return o;
    n++;
  }
  if (Math.abs(s.length - r.length) === 1) {
    if (pa(r)) return 1;
    if (pa(s)) return -1;
  }
  return s.length - r.length;
}
function pa(e) {
  const t = e[e.length - 1];
  return e.length > 0 && t[t.length - 1] < 0;
}
const bm = { strict: !1, end: !0, sensitive: !1 };
function vm(e, t, n) {
  const r = ym(pm(e.path), n),
    s = ae(r, { record: e, parent: t, children: [], alias: [] });
  return (t && !s.record.aliasOf == !t.record.aliasOf && t.children.push(s), s);
}
function wm(e, t) {
  const n = [],
    r = new Map();
  t = ia(bm, t);
  function s(u) {
    return r.get(u);
  }
  function o(u, h, d) {
    const p = !d,
      m = ma(u);
    m.aliasOf = d && d.record;
    const C = ia(t, u),
      E = [m];
    if ('alias' in u) {
      const _ = typeof u.alias == 'string' ? [u.alias] : u.alias;
      for (const v of _)
        E.push(
          ma(
            ae({}, m, {
              components: d ? d.record.components : m.components,
              path: v,
              aliasOf: d ? d.record : m,
            }),
          ),
        );
    }
    let w, y;
    for (const _ of E) {
      const { path: v } = _;
      if (h && v[0] !== '/') {
        const R = h.record.path,
          S = R[R.length - 1] === '/' ? '' : '/';
        _.path = h.record.path + (v && S + v);
      }
      if (
        ((w = vm(_, h, C)),
        d
          ? d.alias.push(w)
          : ((y = y || w), y !== w && y.alias.push(w), p && u.name && !ya(w) && i(u.name)),
        Jc(w) && l(w),
        m.children)
      ) {
        const R = m.children;
        for (let S = 0; S < R.length; S++) o(R[S], w, d && d.children[S]);
      }
      d = d || w;
    }
    return y
      ? () => {
          i(y);
        }
      : Zn;
  }
  function i(u) {
    if (Vc(u)) {
      const h = r.get(u);
      h && (r.delete(u), n.splice(n.indexOf(h), 1), h.children.forEach(i), h.alias.forEach(i));
    } else {
      const h = n.indexOf(u);
      h > -1 &&
        (n.splice(h, 1),
        u.record.name && r.delete(u.record.name),
        u.children.forEach(i),
        u.alias.forEach(i));
    }
  }
  function a() {
    return n;
  }
  function l(u) {
    const h = Cm(u, n);
    (n.splice(h, 0, u), u.record.name && !ya(u) && r.set(u.record.name, u));
  }
  function f(u, h) {
    let d,
      p = {},
      m,
      C;
    if ('name' in u && u.name) {
      if (((d = r.get(u.name)), !d)) throw kn(ye.MATCHER_NOT_FOUND, { location: u });
      ((C = d.record.name),
        (p = ae(
          ga(
            h.params,
            d.keys
              .filter((y) => !y.optional)
              .concat(d.parent ? d.parent.keys.filter((y) => y.optional) : [])
              .map((y) => y.name),
          ),
          u.params &&
            ga(
              u.params,
              d.keys.map((y) => y.name),
            ),
        )),
        (m = d.stringify(p)));
    } else if (u.path != null)
      ((m = u.path),
        (d = n.find((y) => y.re.test(m))),
        d && ((p = d.parse(m)), (C = d.record.name)));
    else {
      if (((d = h.name ? r.get(h.name) : n.find((y) => y.re.test(h.path))), !d))
        throw kn(ye.MATCHER_NOT_FOUND, { location: u, currentLocation: h });
      ((C = d.record.name), (p = ae({}, h.params, u.params)), (m = d.stringify(p)));
    }
    const E = [];
    let w = d;
    for (; w; ) (E.unshift(w.record), (w = w.parent));
    return { name: C, path: m, params: p, matched: E, meta: Tm(E) };
  }
  e.forEach((u) => o(u));
  function c() {
    ((n.length = 0), r.clear());
  }
  return {
    addRoute: o,
    resolve: f,
    removeRoute: i,
    clearRoutes: c,
    getRoutes: a,
    getRecordMatcher: s,
  };
}
function ga(e, t) {
  const n = {};
  for (const r of t) r in e && (n[r] = e[r]);
  return n;
}
function ma(e) {
  const t = {
    path: e.path,
    redirect: e.redirect,
    name: e.name,
    meta: e.meta || {},
    aliasOf: e.aliasOf,
    beforeEnter: e.beforeEnter,
    props: Em(e),
    children: e.children || [],
    instances: {},
    leaveGuards: new Set(),
    updateGuards: new Set(),
    enterCallbacks: {},
    components: 'components' in e ? e.components || null : e.component && { default: e.component },
  };
  return (Object.defineProperty(t, 'mods', { value: {} }), t);
}
function Em(e) {
  const t = {},
    n = e.props || !1;
  if ('component' in e) t.default = n;
  else for (const r in e.components) t[r] = typeof n == 'object' ? n[r] : n;
  return t;
}
function ya(e) {
  for (; e; ) {
    if (e.record.aliasOf) return !0;
    e = e.parent;
  }
  return !1;
}
function Tm(e) {
  return e.reduce((t, n) => ae(t, n.meta), {});
}
function Cm(e, t) {
  let n = 0,
    r = t.length;
  for (; n !== r; ) {
    const o = (n + r) >> 1;
    Gc(e, t[o]) < 0 ? (r = o) : (n = o + 1);
  }
  const s = Sm(e);
  return (s && (r = t.lastIndexOf(s, r - 1)), r);
}
function Sm(e) {
  let t = e;
  for (; (t = t.parent); ) if (Jc(t) && Gc(e, t) === 0) return t;
}
function Jc({ record: e }) {
  return !!(e.name || (e.components && Object.keys(e.components).length) || e.redirect);
}
function _a(e) {
  const t = $e(ei),
    n = $e(Kc),
    r = _e(() => {
      const l = ee(e.to);
      return t.resolve(l);
    }),
    s = _e(() => {
      const { matched: l } = r.value,
        { length: f } = l,
        c = l[f - 1],
        u = n.matched;
      if (!c || !u.length) return -1;
      const h = u.findIndex(Pn.bind(null, c));
      if (h > -1) return h;
      const d = ba(l[f - 2]);
      return f > 1 && ba(c) === d && u[u.length - 1].path !== d
        ? u.findIndex(Pn.bind(null, l[f - 2]))
        : h;
    }),
    o = _e(() => s.value > -1 && xm(n.params, r.value.params)),
    i = _e(() => s.value > -1 && s.value === n.matched.length - 1 && Bc(n.params, r.value.params));
  function a(l = {}) {
    if (km(l)) {
      const f = t[ee(e.replace) ? 'replace' : 'push'](ee(e.to)).catch(Zn);
      return (
        e.viewTransition &&
          typeof document < 'u' &&
          'startViewTransition' in document &&
          document.startViewTransition(() => f),
        f
      );
    }
    return Promise.resolve();
  }
  return { route: r, href: _e(() => r.value.href), isActive: o, isExactActive: i, navigate: a };
}
function Rm(e) {
  return e.length === 1 ? e[0] : e;
}
const Am = sn({
    name: 'RouterLink',
    compatConfig: { MODE: 3 },
    props: {
      to: { type: [String, Object], required: !0 },
      replace: Boolean,
      activeClass: String,
      exactActiveClass: String,
      custom: Boolean,
      ariaCurrentValue: { type: String, default: 'page' },
      viewTransition: Boolean,
    },
    useLink: _a,
    setup(e, { slots: t }) {
      const n = $t(_a(e)),
        { options: r } = $e(ei),
        s = _e(() => ({
          [va(e.activeClass, r.linkActiveClass, 'router-link-active')]: n.isActive,
          [va(e.exactActiveClass, r.linkExactActiveClass, 'router-link-exact-active')]:
            n.isExactActive,
        }));
      return () => {
        const o = t.default && Rm(t.default(n));
        return e.custom
          ? o
          : Fe(
              'a',
              {
                'aria-current': n.isExactActive ? e.ariaCurrentValue : null,
                href: n.href,
                onClick: n.navigate,
                class: s.value,
              },
              o,
            );
      };
    },
  }),
  Pm = Am;
function km(e) {
  if (
    !(e.metaKey || e.altKey || e.ctrlKey || e.shiftKey) &&
    !e.defaultPrevented &&
    !(e.button !== void 0 && e.button !== 0)
  ) {
    if (e.currentTarget && e.currentTarget.getAttribute) {
      const t = e.currentTarget.getAttribute('target');
      if (/\b_blank\b/i.test(t)) return;
    }
    return (e.preventDefault && e.preventDefault(), !0);
  }
}
function xm(e, t) {
  for (const n in t) {
    const r = t[n],
      s = e[n];
    if (typeof r == 'string') {
      if (r !== s) return !1;
    } else if (!it(s) || s.length !== r.length || r.some((o, i) => o.valueOf() !== s[i].valueOf()))
      return !1;
  }
  return !0;
}
function ba(e) {
  return e ? (e.aliasOf ? e.aliasOf.path : e.path) : '';
}
const va = (e, t, n) => e ?? t ?? n,
  Om = sn({
    name: 'RouterView',
    inheritAttrs: !1,
    props: { name: { type: String, default: 'default' }, route: Object },
    compatConfig: { MODE: 3 },
    setup(e, { attrs: t, slots: n }) {
      const r = $e(Eo),
        s = _e(() => e.route || r.value),
        o = $e(fa, 0),
        i = _e(() => {
          let f = ee(o);
          const { matched: c } = s.value;
          let u;
          for (; (u = c[f]) && !u.components; ) f++;
          return f;
        }),
        a = _e(() => s.value.matched[i.value]);
      (bn(
        fa,
        _e(() => i.value + 1),
      ),
        bn(im, a),
        bn(Eo, s));
      const l = st();
      return (
        Ht(
          () => [l.value, a.value, e.name],
          ([f, c, u], [h, d, p]) => {
            (c &&
              ((c.instances[u] = f),
              d &&
                d !== c &&
                f &&
                f === h &&
                (c.leaveGuards.size || (c.leaveGuards = d.leaveGuards),
                c.updateGuards.size || (c.updateGuards = d.updateGuards))),
              f &&
                c &&
                (!d || !Pn(c, d) || !h) &&
                (c.enterCallbacks[u] || []).forEach((m) => m(f)));
          },
          { flush: 'post' },
        ),
        () => {
          const f = s.value,
            c = e.name,
            u = a.value,
            h = u && u.components[c];
          if (!h) return wa(n.default, { Component: h, route: f });
          const d = u.props[c],
            p = d ? (d === !0 ? f.params : typeof d == 'function' ? d(f) : d) : null,
            C = Fe(
              h,
              ae({}, p, t, {
                onVnodeUnmounted: (E) => {
                  E.component.isUnmounted && (u.instances[c] = null);
                },
                ref: l,
              }),
            );
          return wa(n.default, { Component: C, route: f }) || C;
        }
      );
    },
  });
function wa(e, t) {
  if (!e) return null;
  const n = e(t);
  return n.length === 1 ? n[0] : n;
}
const Yc = Om;
function Mm(e) {
  const t = wm(e.routes, e),
    n = e.parseQuery || sm,
    r = e.stringifyQuery || ua,
    s = e.history,
    o = $n(),
    i = $n(),
    a = $n(),
    l = Rt(ze);
  let f = ze;
  dn &&
    e.scrollBehavior &&
    'scrollRestoration' in history &&
    (history.scrollRestoration = 'manual');
  const c = Ls.bind(null, (P) => '' + P),
    u = Ls.bind(null, Ug),
    h = Ls.bind(null, ur);
  function d(P, B) {
    let $, q;
    return (Vc(P) ? (($ = t.getRecordMatcher(P)), (q = B)) : (q = P), t.addRoute(q, $));
  }
  function p(P) {
    const B = t.getRecordMatcher(P);
    B && t.removeRoute(B);
  }
  function m() {
    return t.getRoutes().map((P) => P.record);
  }
  function C(P) {
    return !!t.getRecordMatcher(P);
  }
  function E(P, B) {
    if (((B = ae({}, B || l.value)), typeof P == 'string')) {
      const b = Hs(n, P, B.path),
        T = t.resolve({ path: b.path }, B),
        O = s.createHref(b.fullPath);
      return ae(b, T, { params: h(T.params), hash: ur(b.hash), redirectedFrom: void 0, href: O });
    }
    let $;
    if (P.path != null) $ = ae({}, P, { path: Hs(n, P.path, B.path).path });
    else {
      const b = ae({}, P.params);
      for (const T in b) b[T] == null && delete b[T];
      (($ = ae({}, P, { params: u(b) })), (B.params = u(B.params)));
    }
    const q = t.resolve($, B),
      te = P.hash || '';
    q.params = c(h(q.params));
    const ge = Wg(r, ae({}, P, { hash: jg(te), path: q.path })),
      g = s.createHref(ge);
    return ae({ fullPath: ge, hash: te, query: r === ua ? om(P.query) : P.query || {} }, q, {
      redirectedFrom: void 0,
      href: g,
    });
  }
  function w(P) {
    return typeof P == 'string' ? Hs(n, P, l.value.path) : ae({}, P);
  }
  function y(P, B) {
    if (f !== P) return kn(ye.NAVIGATION_CANCELLED, { from: B, to: P });
  }
  function _(P) {
    return S(P);
  }
  function v(P) {
    return _(ae(w(P), { replace: !0 }));
  }
  function R(P, B) {
    const $ = P.matched[P.matched.length - 1];
    if ($ && $.redirect) {
      const { redirect: q } = $;
      let te = typeof q == 'function' ? q(P, B) : q;
      return (
        typeof te == 'string' &&
          ((te = te.includes('?') || te.includes('#') ? (te = w(te)) : { path: te }),
          (te.params = {})),
        ae({ query: P.query, hash: P.hash, params: te.path != null ? {} : P.params }, te)
      );
    }
  }
  function S(P, B) {
    const $ = (f = E(P)),
      q = l.value,
      te = P.state,
      ge = P.force,
      g = P.replace === !0,
      b = R($, q);
    if (b)
      return S(
        ae(w(b), { state: typeof b == 'object' ? ae({}, te, b.state) : te, force: ge, replace: g }),
        B || $,
      );
    const T = $;
    T.redirectedFrom = B;
    let O;
    return (
      !ge &&
        Kg(r, q, $) &&
        ((O = kn(ye.NAVIGATION_DUPLICATED, { to: T, from: q })), ce(q, q, !0, !1)),
      (O ? Promise.resolve(O) : D(T, q))
        .catch((A) => (_t(A) ? (_t(A, ye.NAVIGATION_GUARD_REDIRECT) ? A : ie(A)) : z(A, T, q)))
        .then((A) => {
          if (A) {
            if (_t(A, ye.NAVIGATION_GUARD_REDIRECT))
              return S(
                ae({ replace: g }, w(A.to), {
                  state: typeof A.to == 'object' ? ae({}, te, A.to.state) : te,
                  force: ge,
                }),
                B || T,
              );
          } else A = N(T, q, !0, g, te);
          return (F(T, q, A), A);
        })
    );
  }
  function I(P, B) {
    const $ = y(P, B);
    return $ ? Promise.reject($) : Promise.resolve();
  }
  function k(P) {
    const B = an.values().next().value;
    return B && typeof B.runWithContext == 'function' ? B.runWithContext(P) : P();
  }
  function D(P, B) {
    let $;
    const [q, te, ge] = am(P, B);
    $ = Fs(q.reverse(), 'beforeRouteLeave', P, B);
    for (const b of q)
      b.leaveGuards.forEach((T) => {
        $.push(Dt(T, P, B));
      });
    const g = I.bind(null, P, B);
    return (
      $.push(g),
      Ge($)
        .then(() => {
          $ = [];
          for (const b of o.list()) $.push(Dt(b, P, B));
          return ($.push(g), Ge($));
        })
        .then(() => {
          $ = Fs(te, 'beforeRouteUpdate', P, B);
          for (const b of te)
            b.updateGuards.forEach((T) => {
              $.push(Dt(T, P, B));
            });
          return ($.push(g), Ge($));
        })
        .then(() => {
          $ = [];
          for (const b of ge)
            if (b.beforeEnter)
              if (it(b.beforeEnter)) for (const T of b.beforeEnter) $.push(Dt(T, P, B));
              else $.push(Dt(b.beforeEnter, P, B));
          return ($.push(g), Ge($));
        })
        .then(
          () => (
            P.matched.forEach((b) => (b.enterCallbacks = {})),
            ($ = Fs(ge, 'beforeRouteEnter', P, B, k)),
            $.push(g),
            Ge($)
          ),
        )
        .then(() => {
          $ = [];
          for (const b of i.list()) $.push(Dt(b, P, B));
          return ($.push(g), Ge($));
        })
        .catch((b) => (_t(b, ye.NAVIGATION_CANCELLED) ? b : Promise.reject(b)))
    );
  }
  function F(P, B, $) {
    a.list().forEach((q) => k(() => q(P, B, $)));
  }
  function N(P, B, $, q, te) {
    const ge = y(P, B);
    if (ge) return ge;
    const g = B === ze,
      b = dn ? history.state : {};
    ($ &&
      (q || g
        ? s.replace(P.fullPath, ae({ scroll: g && b && b.scroll }, te))
        : s.push(P.fullPath, te)),
      (l.value = P),
      ce(P, B, $, g),
      ie());
  }
  let W;
  function X() {
    W ||
      (W = s.listen((P, B, $) => {
        if (!Bt.listening) return;
        const q = E(P),
          te = R(q, Bt.currentRoute.value);
        if (te) {
          S(ae(te, { replace: !0, force: !0 }), q).catch(Zn);
          return;
        }
        f = q;
        const ge = l.value;
        (dn && Zg(ca(ge.fullPath, $.delta), gs()),
          D(q, ge)
            .catch((g) =>
              _t(g, ye.NAVIGATION_ABORTED | ye.NAVIGATION_CANCELLED)
                ? g
                : _t(g, ye.NAVIGATION_GUARD_REDIRECT)
                  ? (S(ae(w(g.to), { force: !0 }), q)
                      .then((b) => {
                        _t(b, ye.NAVIGATION_ABORTED | ye.NAVIGATION_DUPLICATED) &&
                          !$.delta &&
                          $.type === vo.pop &&
                          s.go(-1, !1);
                      })
                      .catch(Zn),
                    Promise.reject())
                  : ($.delta && s.go(-$.delta, !1), z(g, q, ge)),
            )
            .then((g) => {
              ((g = g || N(q, ge, !1)),
                g &&
                  ($.delta && !_t(g, ye.NAVIGATION_CANCELLED)
                    ? s.go(-$.delta, !1)
                    : $.type === vo.pop &&
                      _t(g, ye.NAVIGATION_ABORTED | ye.NAVIGATION_DUPLICATED) &&
                      s.go(-1, !1)),
                F(q, ge, g));
            })
            .catch(Zn));
      }));
  }
  let se = $n(),
    V = $n(),
    Z;
  function z(P, B, $) {
    ie(P);
    const q = V.list();
    return (q.length ? q.forEach((te) => te(P, B, $)) : console.error(P), Promise.reject(P));
  }
  function Pe() {
    return Z && l.value !== ze
      ? Promise.resolve()
      : new Promise((P, B) => {
          se.add([P, B]);
        });
  }
  function ie(P) {
    return (Z || ((Z = !P), X(), se.list().forEach(([B, $]) => (P ? $(P) : B())), se.reset()), P);
  }
  function ce(P, B, $, q) {
    const { scrollBehavior: te } = e;
    if (!dn || !te) return Promise.resolve();
    const ge =
      (!$ && em(ca(P.fullPath, 0))) || ((q || !$) && history.state && history.state.scroll) || null;
    return Cn()
      .then(() => te(P, B, ge))
      .then((g) => g && Xg(g))
      .catch((g) => z(g, P, B));
  }
  const De = (P) => s.go(P);
  let on;
  const an = new Set(),
    Bt = {
      currentRoute: l,
      listening: !0,
      addRoute: d,
      removeRoute: p,
      clearRoutes: t.clearRoutes,
      hasRoute: C,
      getRoutes: m,
      resolve: E,
      options: e,
      push: _,
      replace: v,
      go: De,
      back: () => De(-1),
      forward: () => De(1),
      beforeEach: o.add,
      beforeResolve: i.add,
      afterEach: a.add,
      onError: V.add,
      isReady: Pe,
      install(P) {
        (P.component('RouterLink', Pm),
          P.component('RouterView', Yc),
          (P.config.globalProperties.$router = Bt),
          Object.defineProperty(P.config.globalProperties, '$route', {
            enumerable: !0,
            get: () => ee(l),
          }),
          dn && !on && l.value === ze && ((on = !0), _(s.location).catch((q) => {})));
        const B = {};
        for (const q in ze) Object.defineProperty(B, q, { get: () => l.value[q], enumerable: !0 });
        (P.provide(ei, Bt), P.provide(Kc, Tt(B)), P.provide(Eo, l));
        const $ = P.unmount;
        (an.add(P),
          (P.unmount = function () {
            (an.delete(P),
              an.size < 1 && ((f = ze), W && W(), (W = null), (l.value = ze), (on = !1), (Z = !1)),
              $());
          }));
      },
    };
  function Ge(P) {
    return P.reduce((B, $) => B.then(() => k($)), Promise.resolve());
  }
  return Bt;
}
const Nm = /(:\w+)\([^)]+\)/g,
  Im = /(:\w+)[?+*]/g,
  Dm = /:\w+/g,
  Lm = (e, t) =>
    t.path
      .replace(Nm, '$1')
      .replace(Im, '$1')
      .replace(Dm, (n) => e.params[n.slice(1)]?.toString() || ''),
  To = (e, t) => {
    const n = e.route.matched.find((s) => s.components?.default === e.Component.type),
      r = t ?? n?.meta.key ?? (n && Lm(e.route, n));
    return typeof r == 'function' ? r(e.route) : r;
  },
  Hm = (e, t) => ({ default: () => (e ? Fe(hf, e === !0 ? {} : e, t) : t) });
function zc(e) {
  return Array.isArray(e) ? e : [e];
}
const jm = 'modulepreload',
  Fm = function (e, t) {
    return new URL(e, t).href;
  },
  Ea = {},
  pn = function (t, n, r) {
    let s = Promise.resolve();
    if (n && n.length > 0) {
      let f = function (c) {
        return Promise.all(
          c.map((u) =>
            Promise.resolve(u).then(
              (h) => ({ status: 'fulfilled', value: h }),
              (h) => ({ status: 'rejected', reason: h }),
            ),
          ),
        );
      };
      const i = document.getElementsByTagName('link'),
        a = document.querySelector('meta[property=csp-nonce]'),
        l = a?.nonce || a?.getAttribute('nonce');
      s = f(
        n.map((c) => {
          if (((c = Fm(c, r)), c in Ea)) return;
          Ea[c] = !0;
          const u = c.endsWith('.css'),
            h = u ? '[rel="stylesheet"]' : '';
          if (r)
            for (let p = i.length - 1; p >= 0; p--) {
              const m = i[p];
              if (m.href === c && (!u || m.rel === 'stylesheet')) return;
            }
          else if (document.querySelector(`link[href="${c}"]${h}`)) return;
          const d = document.createElement('link');
          if (
            ((d.rel = u ? 'stylesheet' : jm),
            u || (d.as = 'script'),
            (d.crossOrigin = ''),
            (d.href = c),
            l && d.setAttribute('nonce', l),
            document.head.appendChild(d),
            u)
          )
            return new Promise((p, m) => {
              (d.addEventListener('load', p),
                d.addEventListener('error', () => m(new Error(`Unable to preload CSS for ${c}`))));
            });
        }),
      );
    }
    function o(i) {
      const a = new Event('vite:preloadError', { cancelable: !0 });
      if (((a.payload = i), window.dispatchEvent(a), !a.defaultPrevented)) throw i;
    }
    return s.then((i) => {
      for (const a of i || []) a.status === 'rejected' && o(a.reason);
      return t().catch(o);
    });
  },
  $s = [
    {
      name: 'index',
      path: '/',
      component: () => pn(() => import('./D8umNv_u.js'), __vite__mapDeps([0, 1]), import.meta.url),
    },
    {
      name: 'mirrors',
      path: '/mirrors',
      component: () => pn(() => import('./BeaGL18k.js'), __vite__mapDeps([2, 1]), import.meta.url),
      children: [
        {
          name: 'mirrors-sourceId',
          path: ':sourceId()',
          component: () =>
            pn(() => import('./DTkrjjdI.js'), __vite__mapDeps([3, 1, 4, 5]), import.meta.url),
        },
      ],
    },
    {
      name: 'resources',
      path: '/resources',
      component: () =>
        pn(() => import('./x0G8KH4U.js'), __vite__mapDeps([6, 1, 4, 7]), import.meta.url),
    },
  ],
  $m = (e, t) => ({ default: () => (e ? Fe(gd, e === !0 ? {} : e, t) : t.default?.()) }),
  Um = /(:\w+)\([^)]+\)/g,
  Bm = /(:\w+)[?+*]/g,
  Vm = /:\w+/g;
function Ta(e) {
  const t =
    e?.meta.key ??
    e.path
      .replace(Um, '$1')
      .replace(Bm, '$1')
      .replace(Vm, (n) => e.params[n.slice(1)]?.toString() || '');
  return typeof t == 'function' ? t(e) : t;
}
function Wm(e, t) {
  return e === t || t === ze
    ? !1
    : Ta(e) !== Ta(t)
      ? !0
      : !e.matched.every(
          (r, s) => r.components && r.components.default === t.matched[s]?.components?.default,
        );
}
function Ca(e) {
  return Array.isArray(e) ? e : [e];
}
function Km(e) {
  const t = [];
  for (const n of e)
    n &&
      t.push({
        ...n,
        onAfterLeave: n.onAfterLeave ? Ca(n.onAfterLeave) : void 0,
        onBeforeLeave: n.onBeforeLeave ? Ca(n.onBeforeLeave) : void 0,
      });
  return yc(...t);
}
const qm = {
  scrollBehavior(e, t, n) {
    const r = be(),
      s = Ue().options?.scrollBehaviorType ?? 'auto';
    return e.path.replace(/\/$/, '') === t.path.replace(/\/$/, '')
      ? t.hash && !e.hash
        ? { left: 0, top: 0 }
        : e.hash
          ? { el: e.hash, top: Qc(e.hash), behavior: s }
          : !1
      : (typeof e.meta.scrollToTop == 'function'
            ? e.meta.scrollToTop(e, t)
            : e.meta.scrollToTop) === !1
        ? !1
        : t === ze
          ? Sa(e, t, n, s)
          : new Promise((i) => {
              const a = () => {
                requestAnimationFrame(() => i(Sa(e, t, n, s)));
              };
              r.hooks.hookOnce('page:loading:end', () => {
                const l = r['~transitionPromise'];
                l ? l.then(a) : a();
              });
            });
  },
};
function Qc(e) {
  try {
    const t = document.querySelector(e);
    if (t)
      return (
        (Number.parseFloat(getComputedStyle(t).scrollMarginTop) || 0) +
        (Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0)
      );
  } catch {}
  return 0;
}
function Sa(e, t, n, r) {
  return (
    n ||
    (e.hash
      ? { el: e.hash, top: Qc(e.hash), behavior: Wm(e, t) ? r : 'instant' }
      : { left: 0, top: 0 })
  );
}
const Gm = { hashMode: !1, scrollBehaviorType: 'auto' },
  Mt = { ...Gm, ...qm },
  Jm = async (e, t) => {
    let n, r;
    if (!e.meta?.validate) return;
    const s = (([n, r] = Xn(() => Promise.resolve(e.meta.validate(e)))), (n = await n), r(), n);
    if (s === !0) return;
    const o = Ft({
      fatal: !0,
      status: (s && (s.status || s.statusCode)) || 404,
      statusText: (s && (s.statusText || s.statusMessage)) || `Page Not Found: ${e.fullPath}`,
      data: { path: e.fullPath },
    });
    return (typeof window < 'u' && window.history.pushState({}, '', t.fullPath), o);
  },
  Ym = (e) => {
    const t = Dc({ path: e.path });
    if (t.redirect) {
      const n = t.redirect.includes('#') ? t.redirect : t.redirect + e.hash;
      return Ut(n, { acceptRelative: !0 }) ? ((window.location.href = n), !1) : n;
    }
  },
  zm = [Jm, Ym],
  Co = {};
function Qm(e, t, n) {
  const { pathname: r, search: s, hash: o } = t,
    i = e.indexOf('#');
  if (i > -1) {
    const f = o.includes(e.slice(i)) ? e.slice(i).length : 1;
    let c = o.slice(f);
    return (c[0] !== '/' && (c = '/' + c), Ki(c, ''));
  }
  const a = Ki(r, e),
    l = !n || uc(a, n) ? a : n;
  return l + (l.includes('?') ? '' : s) + o;
}
const Xm = xt({
    name: 'nuxt:router',
    enforce: 'pre',
    async setup(e) {
      let t,
        n,
        r = In().app.baseURL;
      const s = Mt.history?.(r) ?? fm(r),
        o = Mt.routes ? (([t, n] = Xn(() => Mt.routes($s))), (t = await t), n(), t ?? $s) : $s;
      let i;
      const a = Mm({
        ...Mt,
        scrollBehavior: (E, w, y) => {
          if (w === ze) {
            i = y;
            return;
          }
          if (Mt.scrollBehavior) {
            if (
              ((a.options.scrollBehavior = Mt.scrollBehavior),
              'scrollRestoration' in window.history)
            ) {
              const _ = a.beforeEach(() => {
                (_(), (window.history.scrollRestoration = 'manual'));
              });
            }
            return Mt.scrollBehavior(E, ze, i || y);
          }
        },
        history: s,
        routes: o,
      });
      ('scrollRestoration' in window.history && (window.history.scrollRestoration = 'auto'),
        e.vueApp.use(a));
      const l = Rt(a.currentRoute.value);
      (a.afterEach((E, w) => {
        l.value = w;
      }),
        Object.defineProperty(e.vueApp.config.globalProperties, 'previousRoute', {
          get: () => l.value,
        }));
      const f = Qm(r, window.location, e.payload.path),
        c = Rt(a.currentRoute.value),
        u = () => {
          c.value = a.currentRoute.value;
        };
      a.afterEach((E, w) => {
        const y = E.matched.at(-1)?.components?.default,
          _ = w.matched.at(-1)?.components?.default;
        if (y === _) {
          u();
          return;
        }
        E.matched.length < w.matched.length &&
          E.matched.every((v, R) => v.components?.default === w.matched[R]?.components?.default) &&
          u();
      });
      const h = { sync: u };
      for (const E in c.value)
        Object.defineProperty(h, E, { get: () => c.value[E], enumerable: !0 });
      ((e._route = Tt(h)), (e._middleware ||= { global: [], named: {} }));
      const d = ps();
      a.afterEach(async (E, w, y) => {
        (delete e._processingMiddleware,
          !e.isHydrating && d.value && (await e.runWithContext(gp)),
          y && (await e.callHook('page:loading:end')));
      });
      try {
        (([t, n] = Xn(() => a.isReady())), await t, n());
      } catch (E) {
        (([t, n] = Xn(() => e.runWithContext(() => Jt(E)))), await t, n());
      }
      const p = f !== a.currentRoute.value.fullPath ? a.resolve(f) : a.currentRoute.value,
        m =
          e.isHydrating &&
          e.payload.prerenderedAt &&
          e.payload.path &&
          f !== e.payload.path &&
          uc(a.currentRoute.value.path, e.payload.path);
      u();
      const C = e.payload.state._layout;
      return (
        a.beforeEach(async (E, w) => {
          (await e.callHook('page:loading:start'),
            (E.meta = $t(E.meta)),
            e.isHydrating && C && !gt(E.meta.layout) && (E.meta.layout = C),
            (e._processingMiddleware = !0));
          {
            const y = new Set([...zm, ...e._middleware.global]);
            for (const v of E.matched) {
              const R = v.meta.middleware;
              if (R) for (const S of zc(R)) y.add(S);
            }
            const _ = Dc({ path: E.path });
            if (_.appMiddleware)
              for (const v in _.appMiddleware) _.appMiddleware[v] ? y.add(v) : y.delete(v);
            for (const v of y) {
              const R =
                typeof v == 'string'
                  ? e._middleware.named[v] || (await Co[v]?.().then((S) => S.default || S))
                  : v;
              if (!R) throw new Error(`Unknown route middleware: '${v}'.`);
              try {
                const S = await e.runWithContext(() => R(E, w));
                if (
                  !e.payload.serverRendered &&
                  e.isHydrating &&
                  (S === !1 || S instanceof Error)
                ) {
                  const I = S || Ft({ status: 404, statusText: `Page Not Found: ${f}` });
                  return (await e.runWithContext(() => Jt(I)), !1);
                }
                if (S === !0) continue;
                if (S === !1) return S;
                if (S) return (wc(S) && S.fatal && (await e.runWithContext(() => Jt(S))), S);
              } catch (S) {
                const I = Ft(S);
                return (I.fatal && (await e.runWithContext(() => Jt(I))), I);
              }
            }
          }
        }),
        a.onError(async () => {
          (delete e._processingMiddleware, await e.callHook('page:loading:end'));
        }),
        a.afterEach((E) => {
          if (E.matched.length === 0 && !d.value)
            return e.runWithContext(() =>
              Jt(
                Ft({
                  status: 404,
                  fatal: !1,
                  statusText: `Page not found: ${E.fullPath}`,
                  data: { path: E.fullPath },
                }),
              ),
            );
        }),
        e.hooks.hookOnce('app:created', async () => {
          try {
            if (('name' in p && (p.name = void 0), m)) {
              const E = a.resolve(e.payload.path);
              ('name' in E && (E.name = void 0),
                await a.replace({ ...E, force: !0 }),
                e.hooks.hookOnce('app:suspense:resolve', async () => {
                  await a.replace({ ...p, force: !0 });
                }));
            } else await a.replace({ ...p, force: !0 });
            a.options.scrollBehavior = Mt.scrollBehavior;
          } catch (E) {
            await e.runWithContext(() => Jt(E));
          }
        }),
        { provide: { router: a } }
      );
    },
  }),
  So =
    globalThis.requestIdleCallback ||
    ((e) => {
      const t = Date.now(),
        n = { didTimeout: !1, timeRemaining: () => Math.max(0, 50 - (Date.now() - t)) };
      return setTimeout(() => {
        e(n);
      }, 1);
    }),
  Zm =
    globalThis.cancelIdleCallback ||
    ((e) => {
      clearTimeout(e);
    }),
  ms = (e) => {
    const t = be();
    t.isHydrating
      ? t.hooks.hookOnce('app:suspense:resolve', () => {
          So(() => e());
        })
      : So(() => e());
  },
  ey = xt({
    name: 'nuxt:payload',
    setup(e) {
      const t = new Set();
      (Ue().beforeResolve(async (n, r) => {
        if (n.path === r.path) return;
        const s = await oa(n.path);
        if (s) {
          for (const o of t) delete e.static.data[o];
          for (const o in s.data) (o in e.static.data || t.add(o), (e.static.data[o] = s.data[o]));
        }
      }),
        ms(() => {
          (e.hooks.hook('link:prefetch', async (n) => {
            const { hostname: r } = new URL(n, window.location.href);
            r === window.location.hostname &&
              (await oa().catch(() => {
                console.warn('[nuxt] Error preloading payload for', n);
              }));
          }),
            navigator.connection?.effectiveType !== 'slow-2g' && setTimeout(Ic, 1e3));
        }));
    },
  }),
  ty = xt(() => {
    const e = Ue();
    ms(() => {
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
  ny = xt((e) => {
    let t;
    async function n() {
      let r;
      try {
        r = await Ic();
      } catch (s) {
        const o = s;
        if (!('status' in o && (o.status === 404 || o.status === 403))) throw o;
      }
      (t && clearTimeout(t), (t = setTimeout(n, Qi)));
      try {
        const s = await $fetch(zo('builds/latest.json') + `?${Date.now()}`);
        s.id !== r?.id && (e.hooks.callHook('app:manifest:update', s), t && clearTimeout(t));
      } catch {}
    }
    ms(() => {
      t = setTimeout(n, Qi);
    });
  });
function ry(e = {}) {
  const t = e.path || window.location.pathname,
    n = new URL(t, window.location.href);
  if (n.host !== window.location.host)
    throw new Error(`Cannot navigate to a URL with a different host: '${t}'.`);
  if (n.protocol && qr(n.protocol))
    throw new Error(`Cannot navigate to a URL with '${n.protocol}' protocol.`);
  let r = {};
  try {
    r = Kr(sessionStorage.getItem('nuxt:reload') || '{}');
  } catch {}
  if (e.force || r?.path !== t || r?.expires < Date.now()) {
    try {
      sessionStorage.setItem(
        'nuxt:reload',
        JSON.stringify({ path: t, expires: Date.now() + (e.ttl ?? 1e4) }),
      );
    } catch {}
    if (e.persistState)
      try {
        sessionStorage.setItem('nuxt:reload:state', JSON.stringify({ state: be().payload.state }));
      } catch {}
    window.location.pathname !== t ? (window.location.href = t) : window.location.reload();
  }
}
const sy = xt({
    name: 'nuxt:chunk-reload',
    setup(e) {
      const t = Ue(),
        n = In(),
        r = new Set();
      (t.beforeEach(() => {
        r.clear();
      }),
        e.hook('app:chunkError', ({ error: o }) => {
          r.add(o);
        }));
      function s(o) {
        const i = Go(n.app.baseURL, o.fullPath);
        ry({ path: i, persistState: !0 });
      }
      (e.hook('app:manifest:update', () => {
        t.beforeResolve(s);
      }),
        t.onError((o, i) => {
          r.has(o) && s(i);
        }));
    },
  }),
  oy = xt({ name: 'nuxt:global-components' }),
  Cr = {};
function iy(e) {
  if (e?.__asyncLoader && !e.__asyncResolved) return e.__asyncLoader();
}
async function Xc(e, t = Ue()) {
  const { path: n, matched: r } = t.resolve(e);
  if (!r.length || ((t._routePreloaded ||= new Set()), t._routePreloaded.has(n))) return;
  const s = (t._preloadPromises ||= []);
  if (s.length > 4) return Promise.all(s).then(() => Xc(e, t));
  t._routePreloaded.add(n);
  for (const o of r) {
    const i = o.components?.default;
    if (typeof i != 'function') continue;
    const a = Promise.resolve(i())
      .catch(() => {})
      .finally(() => s.splice(s.indexOf(a), 1));
    s.push(a);
  }
  await Promise.all(s);
}
const ay = xt({
    name: 'nuxt:prefetch',
    setup(e) {
      const t = Ue();
      (e.hooks.hook('app:mounted', () => {
        t.beforeEach(async (n) => {
          const r = n?.meta?.layout;
          r && typeof Cr[r] == 'function' && (await Cr[r]());
        });
      }),
        e.hooks.hook('link:prefetch', (n) => {
          if (Ut(n)) return;
          const r = t.resolve(n);
          if (!r) return;
          const s = r.meta.layout;
          let o = zc(r.meta.middleware);
          o = o.filter((i) => typeof i == 'string');
          for (const i of o) typeof Co[i] == 'function' && Co[i]();
          typeof s == 'string' && s in Cr && iy(Cr[s]);
        }));
    },
  }),
  ly = [Eg, Ag, Xm, ey, ty, ny, sy, oy, ay],
  cy = (...e) => e.find((t) => t !== void 0);
function Ra(e) {
  let t = e.replace(/[\u0000-\u001f\s]+/g, '');
  for (; t.toLowerCase().startsWith('view-source:'); ) t = t.slice(12);
  const n = t.indexOf(':');
  return n > 0 && qr(t.slice(0, n + 1)) ? null : e;
}
function uy(e) {
  const t = e.componentName || 'NuxtLink';
  function n(o) {
    return typeof o == 'string' && o.startsWith('#');
  }
  function r(o, i, a) {
    const l = a ?? e.trailingSlash;
    if (!o || (l !== 'append' && l !== 'remove')) return o;
    if (typeof o == 'string') return Sr(o, l);
    const f = 'path' in o && o.path !== void 0 ? o.path : i(o).path;
    return { ...o, name: void 0, path: Sr(f, l) };
  }
  function s(o) {
    const i = Ue(),
      a = In(),
      l = _e(() => !!ee(o.target) && ee(o.target) !== '_self'),
      f = _e(() => {
        const C = ee(o.to) || ee(o.href) || '';
        return typeof C == 'string' && Ut(C, { acceptRelative: !0 });
      }),
      c = mi('RouterLink'),
      u = c && typeof c != 'string' ? c.useLink : void 0,
      h = _e(() => {
        if (ee(o.external)) return !0;
        const C = ee(o.to) || ee(o.href) || '';
        return typeof C == 'object' ? !1 : C === '' || f.value;
      }),
      d = _e(() => {
        const C = ee(o.to) || ee(o.href) || '';
        return h.value ? C : r(C, i.resolve, ee(o.trailingSlash));
      }),
      p = h.value ? void 0 : u?.({ ...o, to: d, viewTransition: ee(o.viewTransition) }),
      m = _e(() => {
        const C = ee(o.trailingSlash) ?? e.trailingSlash;
        if (!d.value || f.value || n(d.value)) {
          const E = d.value;
          return typeof E == 'string' ? Ra(E) : E;
        }
        if (h.value) {
          const E = typeof d.value == 'object' && 'path' in d.value ? uo(d.value) : d.value,
            w = typeof E == 'object' ? i.resolve(E).href : E,
            y = typeof w == 'string' ? Ra(w) : w;
          return y === null ? null : Sr(y, C);
        }
        return typeof d.value == 'object'
          ? (i.resolve(d.value)?.href ?? null)
          : Sr(Go(a.app.baseURL, d.value), C);
      });
    return {
      to: d,
      hasTarget: l,
      isAbsoluteUrl: f,
      isExternal: h,
      href: m,
      isActive: p?.isActive ?? _e(() => d.value === i.currentRoute.value.path),
      isExactActive: p?.isExactActive ?? _e(() => d.value === i.currentRoute.value.path),
      route: p?.route ?? _e(() => i.resolve(d.value)),
      async navigate(C) {
        m.value !== null &&
          (await pp(m.value, { replace: ee(o.replace), external: h.value || l.value }));
      },
    };
  }
  return sn({
    name: t,
    props: {
      to: { type: [String, Object], default: void 0, required: !1 },
      href: { type: [String, Object], default: void 0, required: !1 },
      target: { type: String, default: void 0, required: !1 },
      rel: { type: String, default: void 0, required: !1 },
      noRel: { type: Boolean, default: void 0, required: !1 },
      prefetch: { type: Boolean, default: void 0, required: !1 },
      prefetchOn: { type: [String, Object], default: void 0, required: !1 },
      noPrefetch: { type: Boolean, default: void 0, required: !1 },
      activeClass: { type: String, default: void 0, required: !1 },
      exactActiveClass: { type: String, default: void 0, required: !1 },
      prefetchedClass: { type: String, default: void 0, required: !1 },
      replace: { type: Boolean, default: void 0, required: !1 },
      ariaCurrentValue: { type: String, default: void 0, required: !1 },
      external: { type: Boolean, default: void 0, required: !1 },
      custom: { type: Boolean, default: void 0, required: !1 },
      trailingSlash: { type: String, default: void 0, required: !1 },
    },
    useLink: s,
    setup(o, { slots: i }) {
      const a = Ue(),
        { to: l, href: f, navigate: c, isExternal: u, hasTarget: h, isAbsoluteUrl: d } = s(o),
        p = Rt(!1),
        m = st(null),
        C = (y) => {
          m.value = o.custom ? y?.$el?.nextElementSibling : y?.$el;
        };
      function E(y) {
        return (
          !p.value &&
          (typeof o.prefetchOn == 'string'
            ? o.prefetchOn === y
            : (o.prefetchOn?.[y] ?? e.prefetchOn?.[y])) &&
          (o.prefetch ?? e.prefetch) !== !1 &&
          o.noPrefetch !== !0 &&
          o.target !== '_blank' &&
          !py()
        );
      }
      async function w(y = be()) {
        if (p.value || f.value === null) return;
        p.value = !0;
        const _ =
            typeof l.value == 'string'
              ? l.value
              : u.value
                ? uo(l.value)
                : a.resolve(l.value).fullPath,
          v = u.value ? new URL(_, window.location.href).href : _;
        await Promise.all([
          y.hooks.callHook('link:prefetch', v).catch(() => {}),
          !u.value && !h.value && Xc(l.value, a).catch(() => {}),
        ]);
      }
      if (E('visibility')) {
        const y = be();
        let _,
          v = null;
        (as(() => {
          const R = dy();
          ms(() => {
            _ = So(() => {
              m?.value?.tagName &&
                (v = R.observe(m.value, async () => {
                  (v?.(), (v = null), await w(y));
                }));
            });
          });
        }),
          Mn(() => {
            (_ && Zm(_), v?.(), (v = null));
          }));
      }
      return () => {
        if (!u.value && !h.value && !n(l.value)) {
          const v = {
            ref: C,
            to: l.value,
            activeClass: o.activeClass || e.activeClass,
            exactActiveClass: o.exactActiveClass || e.exactActiveClass,
            replace: o.replace,
            ariaCurrentValue: o.ariaCurrentValue,
            custom: o.custom,
          };
          return (
            o.custom ||
              (E('interaction') &&
                ((v.onPointerenter = w.bind(null, void 0)), (v.onFocus = w.bind(null, void 0))),
              p.value && (v.class = o.prefetchedClass || e.prefetchedClass),
              (v.rel = o.rel || void 0)),
            Fe(mi('RouterLink'), v, i.default)
          );
        }
        const y = o.target || null,
          _ =
            cy(
              o.noRel ? '' : o.rel,
              e.externalRelAttribute,
              d.value || h.value ? 'noopener noreferrer' : '',
            ) || null;
        return o.custom
          ? i.default
            ? i.default({
                href: f.value,
                navigate: c,
                prefetch: w,
                get route() {
                  if (!f.value) return;
                  const v = new URL(f.value, window.location.href);
                  return {
                    path: v.pathname,
                    fullPath: v.pathname,
                    get query() {
                      return qo(v.search);
                    },
                    hash: v.hash,
                    params: {},
                    name: void 0,
                    matched: [],
                    redirectedFrom: void 0,
                    meta: {},
                    href: f.value,
                  };
                },
                rel: _,
                target: y,
                isExternal: u.value || h.value,
                isActive: !1,
                isExactActive: !1,
              })
            : null
          : Fe(
              'a',
              {
                ref: m,
                href: f.value || null,
                rel: _,
                target: y,
                onClick: async (v) => {
                  if (!(u.value || h.value)) {
                    v.preventDefault();
                    try {
                      const R = bc(f.value ?? '');
                      return await (o.replace ? a.replace(R) : a.push(R));
                    } finally {
                      if (n(l.value)) {
                        const R = l.value.slice(1);
                        let S = R;
                        try {
                          S = decodeURIComponent(R);
                        } catch {}
                        document.getElementById(S)?.focus();
                      }
                    }
                  }
                },
              },
              i.default?.(),
            );
      };
    },
  });
}
const fy = uy(zh);
function Sr(e, t) {
  const n = t === 'append' ? ic : lr;
  return Ut(e) && !e.startsWith('http') ? e : n(e, !0);
}
function dy() {
  const e = be();
  if (e._observer) return e._observer;
  let t = null;
  const n = new Map(),
    r = (o, i) => (
      (t ||= new IntersectionObserver((a) => {
        for (const l of a) {
          const f = n.get(l.target);
          (l.isIntersecting || l.intersectionRatio > 0) && f && f();
        }
      })),
      n.set(o, i),
      t.observe(o),
      () => {
        (n.delete(o), t?.unobserve(o), n.size === 0 && (t?.disconnect(), (t = null)));
      }
    );
  return (e._observer = { observe: r });
}
const hy = /2g/;
function py() {
  const e = navigator.connection;
  return !!(e && (e.saveData || hy.test(e.effectiveType)));
}
const Zc = (e = 'RouteProvider') =>
    sn({
      name: e,
      props: {
        route: { type: Object, required: !0 },
        vnode: Object,
        vnodeRef: Object,
        renderKey: String,
        trackRootNodes: Boolean,
      },
      setup(t) {
        const n = t.renderKey,
          r = t.route,
          s = {};
        for (const o in t.route)
          Object.defineProperty(s, o, {
            get: () => (n === t.renderKey ? t.route[o] : r[o]),
            enumerable: !0,
          });
        return (bn(hs, Tt(s)), () => (t.vnode ? Fe(t.vnode, { ref: t.vnodeRef }) : t.vnode));
      },
    }),
  gy = Zc(),
  Aa = new WeakMap(),
  my = sn({
    name: 'NuxtPage',
    inheritAttrs: !1,
    props: {
      name: { type: String },
      transition: { type: [Boolean, Object], default: void 0 },
      keepalive: { type: [Boolean, Object], default: void 0 },
      route: { type: Object },
      pageKey: { type: [Function, String], default: null },
    },
    setup(e, { attrs: t, slots: n, expose: r }) {
      const s = be(),
        o = st(),
        i = $e(hs, null);
      let a;
      r({ pageRef: o });
      const l = $e(fp, null);
      let f;
      const c = s.deferHydration();
      let u = !1,
        h = !1,
        d = 0;
      if (s.isHydrating) {
        const m = s.hooks.hookOnce('app:error', c),
          C = Ue().beforeEach(() => {
            (m(), C());
          });
      }
      e.pageKey &&
        Ht(
          () => e.pageKey,
          (m, C) => {
            m !== C && s.callHook('page:loading:start');
          },
        );
      let p = !1;
      {
        const m = Ue().beforeResolve(() => {
          p = !1;
        });
        Mn(() => {
          (m(), c());
        });
      }
      return () =>
        Fe(
          Yc,
          { name: e.name, route: e.route, ...t },
          {
            default: (m) => {
              const C = yy(i, m.route, m.Component),
                E = i && i.matched.length === m.route.matched.length;
              if (!m.Component) {
                if (f && !E && !Us(f)) return f;
                c();
                return;
              }
              if (f && l && !Us(f) && !l.isCurrent(m.route)) return f;
              if (C && i && (!l || l?.isCurrent(i))) return (E || f) && !Us(f) ? f : null;
              const w = To(m, e.pageKey),
                y = _y(i, m.route, m.Component);
              (!s.isHydrating &&
                a === w &&
                !y &&
                Cn(() => {
                  p || ((p = !0), s.callHook('page:loading:end'));
                }),
                u && a !== w && h && d++,
                (a = w));
              const _ = !!(e.transition ?? m.route.meta.pageTransition ?? zi),
                v =
                  _ &&
                  Km([
                    e.transition,
                    m.route.meta.pageTransition,
                    zi,
                    {
                      onAfterLeave() {
                        (s['~transitionFinish']?.(),
                          delete s['~transitionFinish'],
                          delete s['~transitionPromise'],
                          s.callHook('page:transition:finish', m.Component));
                      },
                    },
                  ]),
                R = e.keepalive ?? m.route.meta.keepalive ?? Yh;
              return (
                (f = $m(
                  _ && v,
                  Hm(
                    R,
                    Fe(
                      Vl,
                      {
                        key: d,
                        suspensible: !0,
                        onPending: () => {
                          ((u = !0),
                            _ &&
                              !s['~transitionPromise'] &&
                              (s['~transitionPromise'] = new Promise((S) => {
                                s['~transitionFinish'] = S;
                              })),
                            s.callHook('page:start', m.Component));
                        },
                        onResolve: async () => {
                          ((u = !1), (h = !0));
                          try {
                            (await Cn(),
                              s._route.sync?.(),
                              await s.callHook('page:finish', m.Component),
                              !p && !y && ((p = !0), await s.callHook('page:loading:end')));
                          } finally {
                            c();
                          }
                        },
                      },
                      {
                        default: () => {
                          const S = {
                            key: w || void 0,
                            vnode: n.default ? by(n.default, m) : m.Component,
                            route: m.route,
                            renderKey: w || void 0,
                            trackRootNodes: _,
                            vnodeRef: o,
                          };
                          if (!R) return Fe(gy, S);
                          const I = m.Component.type,
                            k = I;
                          let D = Aa.get(k);
                          return (D || ((D = Zc(I.name || I.__name)), Aa.set(k, D)), Fe(D, S));
                        },
                      },
                    ),
                  ),
                ).default()),
                f
              );
            },
          },
        );
    },
  });
function yy(e, t, n) {
  if (!e) return !1;
  const r = t.matched.findIndex((i) => i.components?.default === n?.type);
  if (r === -1) return !1;
  const s = t.matched.slice(0, r).filter((i) => i.components?.default);
  if (!s.length) return !1;
  const o = e.matched.filter((i) => i.components?.default);
  return (
    s.some((i, a) => i.components?.default !== o[a]?.components?.default) ||
    (n && To({ route: t, Component: n }) !== To({ route: e, Component: n }))
  );
}
function _y(e, t, n) {
  return e
    ? t.matched.findIndex((s) => s.components?.default === n?.type) < t.matched.length - 1
    : !1;
}
function by(e, t) {
  const n = e(t);
  return n.length === 1 ? Fe(n[0]) : Fe(He, void 0, n);
}
function Us(e) {
  return !!e && (!!e.suspense?.isUnmounted || !!e.component?.isUnmounted);
}
const vy = () => {
    const { public: e } = In(),
      t = (n) => $fetch(`${e.apiBase}${n}`);
    return {
      getHome: () => t('/website/home'),
      getSettings: () => t('/auth/settings'),
      getMirrors: () => t('/mirror/sources'),
      getMirror: (n) => t(`/website/mirrors/${n}`),
      getMirrorCategories: (n) => t(`/website/mirrors/${n}/categories`),
      getMirrorResources: (n, r = {}) => {
        const s = new URLSearchParams();
        return (
          Object.entries(r).forEach(([o, i]) => {
            i !== void 0 && i !== '' && s.set(o, String(i));
          }),
          t(`/website/mirrors/${n}/resources?${s.toString()}`)
        );
      },
      getMirrorResource: (n, r) => t(`/website/mirrors/${n}/resources/${r}`),
    };
  },
  wy = { trailing: !0 };
function Ey(e, t = 25, n = {}) {
  if (((n = { ...wy, ...n }), !Number.isFinite(t)))
    throw new TypeError('Expected `wait` to be a finite number');
  let r,
    s,
    o = [],
    i,
    a;
  const l = (u, h) => (
      (i = Ty(e, u, h)),
      i.finally(() => {
        if (((i = null), n.trailing && a && !s)) {
          const d = l(u, a);
          return ((a = null), d);
        }
      }),
      i
    ),
    f = function (...u) {
      return (
        n.trailing && (a = u),
        i ||
          new Promise((h) => {
            const d = !s && n.leading;
            (clearTimeout(s),
              (s = setTimeout(() => {
                s = null;
                const p = n.leading ? r : l(this, u);
                a = null;
                for (const m of o) m(p);
                o = [];
              }, t)),
              d ? ((r = l(this, u)), h(r)) : o.push(h));
          })
      );
    },
    c = (u) => {
      u && (clearTimeout(u), (s = null));
    };
  return (
    (f.isPending = () => !!s),
    (f.cancel = () => {
      (c(s), (o = []), (a = null));
    }),
    (f.flush = () => {
      if ((c(s), !a || i)) return;
      const u = a;
      return ((a = null), l(this, u));
    }),
    f
  );
}
async function Ty(e, t, n) {
  return await e.apply(t, n);
}
const Cy = Symbol.for('nuxt:client-only'),
  Sy = (e) => e === 'defer' || e === !1;
function Ry(...e) {
  const t = typeof e[e.length - 1] == 'string' ? e.pop() : void 0;
  Ay(e[0], e[1]) && e.unshift(t);
  let [n, r, s = {}] = e,
    o = !1;
  const i = _e(() => nl(n));
  if (typeof i.value != 'string')
    throw new TypeError('[nuxt] [useAsyncData] key must be a string.');
  if (typeof r != 'function')
    throw new TypeError('[nuxt] [useAsyncData] handler must be a function.');
  const a = be();
  ((s.server ??= !0),
    (s.default ??= ky),
    (s.getCachedData ??= tu),
    (s.lazy ??= !1),
    (s.immediate ??= !0),
    (s.deep ??= Ct.deep),
    (s.dedupe ??= 'cancel'),
    s._functionName,
    a._asyncData[i.value]);
  function l() {
    const p = { cause: 'initial', dedupe: s.dedupe };
    return (
      a._asyncData[i.value]?._init ||
        ((p.cachedData = s.getCachedData(i.value, a, { cause: 'initial' })),
        (a._asyncData[i.value] = Pa(a, i.value, r, s, p.cachedData))),
      () => a._asyncData[i.value].execute(p)
    );
  }
  const f = l(),
    c = a._asyncData[i.value];
  c._deps++;
  const u = s.server !== !1 && a.payload.serverRendered;
  {
    let p = function (_) {
      const v = a._asyncData[_];
      v?._deps && (v._deps--, v._deps === 0 && v?._off());
    };
    const m = Pt();
    if ((m && u && s.immediate && !m.sp && (m.sp = []), m && !m._nuxtOnBeforeMountCbs)) {
      m._nuxtOnBeforeMountCbs = [];
      const _ = m._nuxtOnBeforeMountCbs;
      (vl(() => {
        (_.forEach((v) => {
          v();
        }),
          _.splice(0, _.length));
      }),
        ls(() => _.splice(0, _.length)));
    }
    const C = m && (m._nuxtClientOnly || $e(Cy, !1));
    u && a.isHydrating && (c.error.value || c.data.value != null)
      ? ((c.pending.value = !1), (c.status.value = c.error.value ? 'error' : 'success'))
      : m && ((!C && a.payload.serverRendered && a.isHydrating) || s.lazy) && s.immediate
        ? m._nuxtOnBeforeMountCbs.push(f)
        : s.immediate && f();
    const E = Oo(),
      w = Ht(
        i,
        (_, v) => {
          if ((_ || v) && _ !== v) {
            o = !0;
            const R = a._asyncData[v]?.data.value !== Ct.value,
              S = a._asyncDataPromises[v] !== void 0,
              I = { cause: 'initial', dedupe: s.dedupe };
            if (!a._asyncData[_]?._init) {
              let k;
              (v && R
                ? (k = a._asyncData[v].data.value)
                : ((k = s.getCachedData(_, a, { cause: 'initial' })), (I.cachedData = k)),
                (a._asyncData[_] = Pa(a, _, r, s, k)));
            }
            (a._asyncData[_]._deps++,
              v && p(v),
              (s.immediate || R || S) && a._asyncData[_].execute(I),
              nr(() => {
                o = !1;
              }));
          }
        },
        { flush: 'sync' },
      ),
      y = s.watch
        ? Ht(s.watch, () => {
            o ||
              (a._asyncData[i.value]?._execute.isPending() &&
                nr(() => {
                  a._asyncData[i.value]?._execute.flush();
                }),
              a._asyncData[i.value]?._execute({ cause: 'watch', dedupe: s.dedupe }));
          })
        : () => {};
    E &&
      mu(() => {
        (w(), y(), p(i.value));
      });
  }
  const h = {
      data: Rr(() => a._asyncData[i.value]?.data),
      pending: Rr(() => a._asyncData[i.value]?.pending),
      status: Rr(() => a._asyncData[i.value]?.status),
      error: Rr(() => a._asyncData[i.value]?.error),
      refresh: (...p) =>
        a._asyncData[i.value]?._init ? a._asyncData[i.value].execute(...p) : l()(),
      execute: (...p) => h.refresh(...p),
      clear: () => {
        const p = a._asyncData[i.value];
        if (p?._abortController)
          try {
            p._abortController.abort(new DOMException('AsyncData aborted by user.', 'AbortError'));
          } finally {
            p._abortController = void 0;
          }
        eu(a, i.value);
      },
    },
    d = Promise.resolve(a._asyncDataPromises[i.value]).then(() => h);
  return (
    Object.assign(d, h),
    Object.defineProperties(d, {
      then: { enumerable: !0, value: d.then.bind(d) },
      catch: { enumerable: !0, value: d.catch.bind(d) },
      finally: { enumerable: !0, value: d.finally.bind(d) },
    }),
    d
  );
}
function Rr(e) {
  return _e({
    get() {
      return e()?.value;
    },
    set(t) {
      const n = e();
      n && (n.value = t);
    },
  });
}
function Ay(e, t) {
  return !(
    typeof e == 'string' ||
    (typeof e == 'object' && e !== null) ||
    (typeof e == 'function' && typeof t == 'function')
  );
}
function eu(e, t) {
  (t in e.payload.data && (e.payload.data[t] = void 0),
    t in e.payload._errors && (e.payload._errors[t] = Ct.errorValue),
    e._asyncData[t] &&
      ((e._asyncData[t].data.value = void 0),
      (e._asyncData[t].error.value = Ct.errorValue),
      (e._asyncData[t].pending.value = !1),
      (e._asyncData[t].status.value = 'idle')),
    t in e._asyncDataPromises && (e._asyncDataPromises[t] = void 0));
}
function Py(e, t) {
  const n = {};
  for (const r of t) n[r] = e[r];
  return n;
}
function Pa(e, t, n, r, s) {
  e.payload._errors[t] ??= Ct.errorValue;
  const o = r.getCachedData !== tu,
    i = n,
    a = r.deep ? st : Rt,
    l = s != null,
    f = e.hook('app:data:refresh', async (u) => {
      (!u || u.includes(t)) && (await c.execute({ cause: 'refresh:hook' }));
    }),
    c = {
      data: a(l ? s : r.default()),
      pending: Rt(!l),
      error: sl(e.payload._errors, t),
      status: Rt('idle'),
      execute: (...u) => {
        const [h, d = void 0] = u,
          p = h && d === void 0 && typeof h == 'object' ? h : {};
        if (e._asyncDataPromises[t] && Sy(p.dedupe ?? r.dedupe)) return e._asyncDataPromises[t];
        if (p.cause === 'initial' || e.isHydrating) {
          const E =
            'cachedData' in p
              ? p.cachedData
              : r.getCachedData(t, e, { cause: p.cause ?? 'refresh:manual' });
          if (E != null)
            return (
              (e.payload.data[t] = c.data.value = E),
              (c.error.value = Ct.errorValue),
              (c.status.value = 'success'),
              Promise.resolve(E)
            );
        }
        ((c.pending.value = !0),
          c._abortController &&
            c._abortController.abort(
              new DOMException('AsyncData request cancelled by deduplication', 'AbortError'),
            ),
          (c._abortController = new AbortController()),
          (c.status.value = 'pending'));
        const m = new AbortController(),
          C = new Promise((E, w) => {
            try {
              const y = p.timeout ?? r.timeout,
                _ = xy([c._abortController?.signal, p?.signal], m.signal, y);
              if (_.aborted) {
                const v = _.reason;
                w(v instanceof Error ? v : new DOMException(String(v ?? 'Aborted'), 'AbortError'));
                return;
              }
              return (
                _.addEventListener(
                  'abort',
                  () => {
                    const v = _.reason;
                    w(
                      v instanceof Error
                        ? v
                        : new DOMException(String(v ?? 'Aborted'), 'AbortError'),
                    );
                  },
                  { once: !0, signal: m.signal },
                ),
                Promise.resolve(i(e, { signal: _ })).then(E, w)
              );
            } catch (y) {
              w(y);
            }
          })
            .then(async (E) => {
              if (e._asyncDataPromises[t] !== C) return;
              let w = E;
              (r.transform && (w = await r.transform(E)),
                r.pick && (w = Py(w, r.pick)),
                (e.payload.data[t] = w),
                (c.data.value = w),
                (c.error.value = Ct.errorValue),
                (c.status.value = 'success'));
            })
            .catch((E) => {
              if (e._asyncDataPromises[t] !== C || c._abortController?.signal.aborted)
                return e._asyncDataPromises[t];
              if (typeof DOMException < 'u' && E instanceof DOMException && E.name === 'AbortError')
                return ((c.status.value = 'idle'), e._asyncDataPromises[t]);
              ((c.error.value = Ft(E)),
                (c.data.value = ee(r.default())),
                (c.status.value = 'error'));
            })
            .finally(() => {
              (m.abort(),
                e._asyncDataPromises[t] === C &&
                  ((c.pending.value = !1), delete e._asyncDataPromises[t]));
            });
        return ((e._asyncDataPromises[t] = C), e._asyncDataPromises[t]);
      },
      _execute: Ey((...u) => c.execute(...u), 0, { leading: !0 }),
      _default: r.default,
      _deps: 0,
      _init: !0,
      _hash: void 0,
      _off: () => {
        (f(),
          e._asyncData[t]?._init && (e._asyncData[t]._init = !1),
          o ||
            Cn(() => {
              e._asyncData[t]?._init ||
                (eu(e, t), (c.execute = () => Promise.resolve()), (c.data.value = Ct.value));
            }));
      },
    };
  return c;
}
const ky = () => Ct.value,
  tu = (e, t, n) => {
    if (t.isHydrating) return t.payload.data[e];
    if (n.cause !== 'refresh:manual' && n.cause !== 'refresh:hook') return t.static.data[e];
  };
function xy(e, t, n) {
  const r = e.filter((i) => !!i);
  if (typeof n == 'number' && n >= 0) {
    const i = AbortSignal.timeout?.(n);
    i && r.push(i);
  }
  if (AbortSignal.any) return AbortSignal.any(r);
  const s = new AbortController();
  for (const i of r)
    if (i.aborted) {
      const a = i.reason ?? new DOMException('Aborted', 'AbortError');
      try {
        s.abort(a);
      } catch {
        s.abort();
      }
      return s.signal;
    }
  const o = () => {
    const a = r.find((l) => l.aborted)?.reason ?? new DOMException('Aborted', 'AbortError');
    try {
      s.abort(a);
    } catch {
      s.abort();
    }
  };
  for (const i of r) i.addEventListener?.('abort', o, { once: !0, signal: t });
  return s.signal;
}
const Oy = { class: 'site-shell' },
  My = { class: 'site-header' },
  Ny = { 'aria-label': '主导航' },
  Iy = ['href'],
  Dy = { class: 'site-footer' },
  Ly = sn({
    __name: 'app',
    async setup(e) {
      let t, n;
      const r = In(),
        s = vy(),
        { data: o } =
          (([t, n] = Ef(() => Ry('platform-settings', () => s.getSettings()))),
          (t = await t),
          n(),
          t),
        i = _e(() => o.value?.PLATFORM_NAME || '3D Personal Learning Platform'),
        a = [
          { label: '首页', to: '/' },
          { label: '资源中心', to: '/resources' },
          { label: '镜像站', to: '/mirrors' },
        ];
      return (l, f) => {
        const c = fy,
          u = my;
        return (
          tt(),
          eo('div', Oy, [
            Ye('header', My, [
              me(
                c,
                { class: 'brand', to: '/', 'aria-label': '返回首页' },
                {
                  default: Dr(() => [
                    f[0] || (f[0] = Ye('span', { class: 'brand-mark' }, 'S', -1)),
                    Ye('span', null, Un(ee(i)), 1),
                  ]),
                  _: 1,
                },
              ),
              Ye('nav', Ny, [
                (tt(),
                eo(
                  He,
                  null,
                  vf(a, (h) =>
                    me(
                      c,
                      { key: h.to, to: h.to },
                      { default: Dr(() => [Br(Un(h.label), 1)]), _: 2 },
                      1032,
                      ['to'],
                    ),
                  ),
                  64,
                )),
              ]),
              Ye(
                'a',
                { class: 'header-action', href: ee(r).public.appBase },
                [...(f[1] || (f[1] = [Br('进入平台 ', -1), Ye('span', null, '↗', -1)]))],
                8,
                Iy,
              ),
            ]),
            Ye('main', null, [me(u)]),
            Ye('footer', Dy, [
              Ye('span', null, '© ' + Un(new Date().getFullYear()) + ' ' + Un(ee(i)), 1),
              f[2] || (f[2] = Ye('span', null, '为持续学习而设计', -1)),
            ]),
          ])
        );
      };
    },
  }),
  Hy = {
    __name: 'nuxt-error-page',
    props: { error: Object },
    setup(e) {
      const n = e.error,
        r = Number(n.statusCode || 500),
        s = r === 404,
        o = n.statusMessage ?? (s ? 'Page Not Found' : 'Internal Server Error'),
        i = n.message || n.toString(),
        a = void 0,
        c = s
          ? gi(() =>
              pn(() => import('./CF7s3eWB.js'), __vite__mapDeps([8, 4, 1, 9]), import.meta.url),
            )
          : gi(() =>
              pn(() => import('./BRVeqoV5.js'), __vite__mapDeps([10, 4, 1, 11]), import.meta.url),
            );
      return (u, h) => (
        tt(),
        zt(
          ee(c),
          fu(
            Yl({
              status: ee(r),
              statusText: ee(o),
              statusCode: ee(r),
              statusMessage: ee(o),
              description: ee(i),
              stack: ee(a),
            }),
          ),
          null,
          16,
        )
      );
    },
  },
  jy = { key: 0 },
  ka = {
    __name: 'nuxt-root',
    setup(e) {
      const t = () => null,
        n = be(),
        r = n.deferHydration();
      if (n.isHydrating) {
        const c = n.hooks.hookOnce('app:error', r),
          u = Ue().beforeEach(() => {
            (c(), u());
          });
      }
      const s = !1;
      (bn(hs, dp()), n.hooks.callHookWith((c) => c.map((u) => u()), 'vue:setup', []));
      const o = ps(),
        i = !1,
        a = /bot\b|chrome-lighthouse|facebookexternalhit|google\b/i;
      function l(c, u, h) {
        const d = n.vueApp.config.errorHandler;
        if (d && !d.__nuxt_default)
          try {
            d(c, u, h);
          } catch (p) {
            console.error('[nuxt] Error in `app.config.errorHandler`', p);
          }
      }
      El((c, u, h) => {
        if (
          (n.hooks
            .callHook('vue:error', c, u, h)
            .catch((d) => console.error('[nuxt] Error in `vue:error` hook', d)),
          a.test(navigator.userAgent))
        )
          return (
            n.hooks.callHook('app:error', c),
            console.error(
              `[nuxt] Not rendering error page for bot with user agent \`${navigator.userAgent}\`:`,
              c,
            ),
            !1
          );
        if (wc(c) && (c.fatal || c.unhandled))
          return (n.runWithContext(() => Jt(c)), l(c, u, h), !1);
      });
      const f = !1;
      return (c, u) => (
        tt(),
        zt(
          Vl,
          { onResolve: ee(r) },
          {
            default: Dr(() => [
              ee(i)
                ? (tt(), eo('div', jy))
                : ee(o)
                  ? (tt(), zt(ee(Hy), { key: 1, error: ee(o) }, null, 8, ['error']))
                  : ee(f)
                    ? (tt(), zt(ee(t), { key: 2, context: ee(f) }, null, 8, ['context']))
                    : ee(s)
                      ? (tt(), zt(bf(ee(s)), { key: 3 }))
                      : (tt(), zt(ee(Ly), { key: 4 })),
            ]),
            _: 1,
          },
          8,
          ['onResolve'],
        )
      );
    },
  };
let xa;
{
  let e;
  ((xa = async function () {
    if (e) return e;
    const r = !!(
        window.__NUXT__?.serverRendered ??
        document.getElementById('__NUXT_DATA__')?.dataset.ssr === 'true'
      )
        ? Wd(ka)
        : Vd(ka),
      s = tp({ vueApp: r });
    async function o(i) {
      (await s.callHook('app:error', i), (s.payload.error ||= Ft(i)));
    }
    ((o.__nuxt_default = !0),
      (r.config.errorHandler = o),
      s.hook('app:suspense:resolve', () => {
        r.config.errorHandler === o && (r.config.errorHandler = void 0);
      }));
    try {
      await sp(s, ly);
    } catch (i) {
      o(i);
    }
    try {
      (await s.hooks.callHook('app:created', r),
        await s.hooks.callHook('app:beforeMount', r),
        r.mount(Xh),
        await s.hooks.callHook('app:mounted', r),
        await Cn());
    } catch (i) {
      o(i);
    }
    return r;
  }),
    (e = xa().catch((t) => {
      throw (console.error('Error while mounting app:', t), t);
    })));
}
export {
  op as A,
  Fo as B,
  $e as C,
  Mc as D,
  fg as E,
  He as F,
  $y as T,
  fy as _,
  Ye as a,
  me as b,
  eo as c,
  Br as d,
  sn as e,
  Ef as f,
  Ry as g,
  ee as h,
  Uy as i,
  zt as j,
  Zf as k,
  In as l,
  _e as m,
  dp as n,
  tt as o,
  Vy as p,
  Fy as q,
  vf as r,
  Ee as s,
  Un as t,
  vy as u,
  By as v,
  Dr as w,
  rs as x,
  st as y,
  Ky as z,
};
