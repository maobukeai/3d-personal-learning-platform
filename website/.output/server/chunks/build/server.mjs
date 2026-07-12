import process from 'node:process';
globalThis._importMeta_ = globalThis._importMeta_ || { url: 'file:///_entry.js', env: process.env };
import {
  computed,
  toValue,
  getCurrentInstance,
  onServerPrefetch,
  hasInjectionContext,
  inject,
  defineComponent,
  shallowRef,
  h,
  resolveComponent,
  unref,
  ref,
  nextTick,
  toRef,
  Suspense,
  Fragment,
  createElementBlock,
  provide,
  cloneVNode,
  useSSRContext,
  createApp,
  shallowReactive,
  withAsyncContext,
  mergeProps,
  withCtx,
  createVNode,
  toDisplayString,
  createTextVNode,
  onErrorCaptured,
  resolveDynamicComponent,
  reactive,
  effectScope,
  defineAsyncComponent,
  getCurrentScope,
  isReadonly,
  isRef,
  isShallow,
  isReactive,
  toRaw,
} from 'vue';
import {
  p as parseQuery,
  l as getContext,
  m as hasProtocol,
  n as joinURL,
  o as parseURL,
  e as encodePath,
  q as decodePath,
  r as isScriptProtocol,
  w as withQuery,
  f as createError$1,
  v as withTrailingSlash,
  x as withoutTrailingSlash,
  y as sanitizeStatusCode,
  $ as $fetch$1,
  z as executeAsync,
  A as defu,
} from '../_/nitro.mjs';
import { b as baseURL } from '../routes/renderer.mjs';
import { RouterView, createMemoryHistory, createRouter, START_LOCATION } from 'vue-router';
import {
  ssrRenderAttrs,
  ssrRenderComponent,
  ssrInterpolate,
  ssrRenderList,
  ssrRenderAttr,
  ssrRenderSuspense,
  ssrRenderVNode,
} from 'vue/server-renderer';
import 'node:http';
import 'node:https';
import 'node:events';
import 'node:buffer';
import 'node:fs';
import 'node:path';
import 'node:crypto';
import 'node:url';
import 'vue-bundle-renderer/runtime';
import 'unhead/server';
import 'devalue';
import 'unhead/plugins';
import 'unhead/utils';

function flatHooks(configHooks, hooks = {}, parentName) {
  for (const key in configHooks) {
    const subHook = configHooks[key];
    const name = parentName ? `${parentName}:${key}` : key;
    if (typeof subHook === 'object' && subHook !== null) {
      flatHooks(subHook, hooks, name);
    } else if (typeof subHook === 'function') {
      hooks[name] = subHook;
    }
  }
  return hooks;
}
const defaultTask = { run: (function_) => function_() };
const _createTask = () => defaultTask;
const createTask = typeof console.createTask !== 'undefined' ? console.createTask : _createTask;
function serialTaskCaller(hooks, args) {
  const name = args.shift();
  const task = createTask(name);
  return hooks.reduce(
    (promise, hookFunction) => promise.then(() => task.run(() => hookFunction(...args))),
    Promise.resolve(),
  );
}
function parallelTaskCaller(hooks, args) {
  const name = args.shift();
  const task = createTask(name);
  return Promise.all(hooks.map((hook) => task.run(() => hook(...args))));
}
function callEachWith(callbacks, arg0) {
  for (const callback of [...callbacks]) {
    callback(arg0);
  }
}

class Hookable {
  constructor() {
    this._hooks = {};
    this._before = void 0;
    this._after = void 0;
    this._deprecatedMessages = void 0;
    this._deprecatedHooks = {};
    this.hook = this.hook.bind(this);
    this.callHook = this.callHook.bind(this);
    this.callHookWith = this.callHookWith.bind(this);
  }
  hook(name, function_, options = {}) {
    if (!name || typeof function_ !== 'function') {
      return () => {};
    }
    const originalName = name;
    let dep;
    while (this._deprecatedHooks[name]) {
      dep = this._deprecatedHooks[name];
      name = dep.to;
    }
    if (dep && !options.allowDeprecated) {
      let message = dep.message;
      if (!message) {
        message =
          `${originalName} hook has been deprecated` + (dep.to ? `, please use ${dep.to}` : '');
      }
      if (!this._deprecatedMessages) {
        this._deprecatedMessages = /* @__PURE__ */ new Set();
      }
      if (!this._deprecatedMessages.has(message)) {
        console.warn(message);
        this._deprecatedMessages.add(message);
      }
    }
    if (!function_.name) {
      try {
        Object.defineProperty(function_, 'name', {
          get: () => '_' + name.replace(/\W+/g, '_') + '_hook_cb',
          configurable: true,
        });
      } catch {}
    }
    this._hooks[name] = this._hooks[name] || [];
    this._hooks[name].push(function_);
    return () => {
      if (function_) {
        this.removeHook(name, function_);
        function_ = void 0;
      }
    };
  }
  hookOnce(name, function_) {
    let _unreg;
    let _function = (...arguments_) => {
      if (typeof _unreg === 'function') {
        _unreg();
      }
      _unreg = void 0;
      _function = void 0;
      return function_(...arguments_);
    };
    _unreg = this.hook(name, _function);
    return _unreg;
  }
  removeHook(name, function_) {
    if (this._hooks[name]) {
      const index = this._hooks[name].indexOf(function_);
      if (index !== -1) {
        this._hooks[name].splice(index, 1);
      }
      if (this._hooks[name].length === 0) {
        delete this._hooks[name];
      }
    }
  }
  deprecateHook(name, deprecated) {
    this._deprecatedHooks[name] = typeof deprecated === 'string' ? { to: deprecated } : deprecated;
    const _hooks = this._hooks[name] || [];
    delete this._hooks[name];
    for (const hook of _hooks) {
      this.hook(name, hook);
    }
  }
  deprecateHooks(deprecatedHooks) {
    Object.assign(this._deprecatedHooks, deprecatedHooks);
    for (const name in deprecatedHooks) {
      this.deprecateHook(name, deprecatedHooks[name]);
    }
  }
  addHooks(configHooks) {
    const hooks = flatHooks(configHooks);
    const removeFns = Object.keys(hooks).map((key) => this.hook(key, hooks[key]));
    return () => {
      for (const unreg of removeFns.splice(0, removeFns.length)) {
        unreg();
      }
    };
  }
  removeHooks(configHooks) {
    const hooks = flatHooks(configHooks);
    for (const key in hooks) {
      this.removeHook(key, hooks[key]);
    }
  }
  removeAllHooks() {
    for (const key in this._hooks) {
      delete this._hooks[key];
    }
  }
  callHook(name, ...arguments_) {
    arguments_.unshift(name);
    return this.callHookWith(serialTaskCaller, name, ...arguments_);
  }
  callHookParallel(name, ...arguments_) {
    arguments_.unshift(name);
    return this.callHookWith(parallelTaskCaller, name, ...arguments_);
  }
  callHookWith(caller, name, ...arguments_) {
    const event = this._before || this._after ? { name, args: arguments_, context: {} } : void 0;
    if (this._before) {
      callEachWith(this._before, event);
    }
    const result = caller(name in this._hooks ? [...this._hooks[name]] : [], arguments_);
    if (result instanceof Promise) {
      return result.finally(() => {
        if (this._after && event) {
          callEachWith(this._after, event);
        }
      });
    }
    if (this._after && event) {
      callEachWith(this._after, event);
    }
    return result;
  }
  beforeEach(function_) {
    this._before = this._before || [];
    this._before.push(function_);
    return () => {
      if (this._before !== void 0) {
        const index = this._before.indexOf(function_);
        if (index !== -1) {
          this._before.splice(index, 1);
        }
      }
    };
  }
  afterEach(function_) {
    this._after = this._after || [];
    this._after.push(function_);
    return () => {
      if (this._after !== void 0) {
        const index = this._after.indexOf(function_);
        if (index !== -1) {
          this._after.splice(index, 1);
        }
      }
    };
  }
}
function createHooks() {
  return new Hookable();
}

//#region src/index.ts
const DEBOUNCE_DEFAULTS = { trailing: true };
/**
Debounce functions
@param fn - Promise-returning/async function to debounce.
@param wait - Milliseconds to wait before calling `fn`. Default value is 25ms
@returns A function that delays calling `fn` until after `wait` milliseconds have elapsed since the last time it was called.
@example
```
import { debounce } from 'perfect-debounce';
const expensiveCall = async input => input;
const debouncedFn = debounce(expensiveCall, 200);
for (const number of [1, 2, 3]) {
console.log(await debouncedFn(number));
}
//=> 1
//=> 2
//=> 3
```
*/
function debounce(fn, wait = 25, options = {}) {
  options = {
    ...DEBOUNCE_DEFAULTS,
    ...options,
  };
  if (!Number.isFinite(wait)) throw new TypeError('Expected `wait` to be a finite number');
  let leadingValue;
  let timeout;
  let resolveList = [];
  let currentPromise;
  let trailingArgs;
  const applyFn = (_this, args) => {
    currentPromise = _applyPromised(fn, _this, args);
    currentPromise.finally(() => {
      currentPromise = null;
      if (options.trailing && trailingArgs && !timeout) {
        const promise = applyFn(_this, trailingArgs);
        trailingArgs = null;
        return promise;
      }
    });
    return currentPromise;
  };
  const debounced = function (...args) {
    if (options.trailing) trailingArgs = args;
    if (currentPromise) return currentPromise;
    return new Promise((resolve) => {
      const shouldCallNow = !timeout && options.leading;
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        timeout = null;
        const promise = options.leading ? leadingValue : applyFn(this, args);
        trailingArgs = null;
        for (const _resolve of resolveList) _resolve(promise);
        resolveList = [];
      }, wait);
      if (shouldCallNow) {
        leadingValue = applyFn(this, args);
        resolve(leadingValue);
      } else resolveList.push(resolve);
    });
  };
  const _clearTimeout = (timer) => {
    if (timer) {
      clearTimeout(timer);
      timeout = null;
    }
  };
  debounced.isPending = () => !!timeout;
  debounced.cancel = () => {
    _clearTimeout(timeout);
    resolveList = [];
    trailingArgs = null;
  };
  debounced.flush = () => {
    _clearTimeout(timeout);
    if (!trailingArgs || currentPromise) return;
    const args = trailingArgs;
    trailingArgs = null;
    return applyFn(this, args);
  };
  return debounced;
}
async function _applyPromised(fn, _this, args) {
  return await fn.apply(_this, args);
}

if (!globalThis.$fetch) {
  globalThis.$fetch = $fetch$1.create({
    baseURL: baseURL(),
  });
}
if (!('global' in globalThis)) {
  globalThis.global = globalThis;
}
const nuxtLinkDefaults = { componentName: 'NuxtLink' };
const asyncDataDefaults = { value: null, errorValue: null, deep: true };
const appId = 'nuxt-app';
function getNuxtAppCtx(id = appId) {
  return getContext(id, {
    asyncContext: false,
  });
}
const NuxtPluginIndicator = '__nuxt_plugin';
function createNuxtApp(options) {
  let hydratingCount = 0;
  const nuxtApp = {
    _id: options.id || appId || 'nuxt-app',
    _scope: effectScope(),
    provide: void 0,
    globalName: 'nuxt',
    versions: {
      get nuxt() {
        return '3.21.8';
      },
      get vue() {
        return nuxtApp.vueApp.version;
      },
    },
    payload: shallowReactive({
      ...(options.ssrContext?.payload || {}),
      data: shallowReactive({}),
      state: reactive({}),
      once: /* @__PURE__ */ new Set(),
      _errors: shallowReactive({}),
    }),
    static: {
      data: {},
    },
    runWithContext(fn) {
      if (nuxtApp._scope.active && !getCurrentScope()) {
        return nuxtApp._scope.run(() => callWithNuxt(nuxtApp, fn));
      }
      return callWithNuxt(nuxtApp, fn);
    },
    isHydrating: false,
    deferHydration() {
      if (!nuxtApp.isHydrating) {
        return () => {};
      }
      hydratingCount++;
      let called = false;
      return () => {
        if (called) {
          return;
        }
        called = true;
        hydratingCount--;
        if (hydratingCount === 0) {
          nuxtApp.isHydrating = false;
          return nuxtApp.callHook('app:suspense:resolve');
        }
      };
    },
    _asyncDataPromises: {},
    _asyncData: shallowReactive({}),
    _payloadRevivers: {},
    ...options,
  };
  {
    nuxtApp.payload.serverRendered = true;
  }
  if (nuxtApp.ssrContext) {
    nuxtApp.payload.path = nuxtApp.ssrContext.url;
    nuxtApp.ssrContext.nuxt = nuxtApp;
    nuxtApp.ssrContext.payload = nuxtApp.payload;
    nuxtApp.ssrContext.config = {
      public: nuxtApp.ssrContext.runtimeConfig.public,
      app: nuxtApp.ssrContext.runtimeConfig.app,
    };
  }
  nuxtApp.hooks = createHooks();
  nuxtApp.hook = nuxtApp.hooks.hook;
  {
    const contextCaller = async function (hooks, args) {
      for (const hook of hooks) {
        await nuxtApp.runWithContext(() => hook(...args));
      }
    };
    nuxtApp.hooks.callHook = (name, ...args) =>
      nuxtApp.hooks.callHookWith(contextCaller, name, ...args);
  }
  nuxtApp.callHook = nuxtApp.hooks.callHook;
  nuxtApp.provide = (name, value) => {
    const $name = '$' + name;
    defineGetter(nuxtApp, $name, value);
    defineGetter(nuxtApp.vueApp.config.globalProperties, $name, value);
  };
  defineGetter(nuxtApp.vueApp, '$nuxt', nuxtApp);
  defineGetter(nuxtApp.vueApp.config.globalProperties, '$nuxt', nuxtApp);
  const runtimeConfig = options.ssrContext.runtimeConfig;
  nuxtApp.provide('config', runtimeConfig);
  return nuxtApp;
}
function registerPluginHooks(nuxtApp, plugin2) {
  if (plugin2.hooks) {
    nuxtApp.hooks.addHooks(plugin2.hooks);
  }
}
async function applyPlugin(nuxtApp, plugin2) {
  if (typeof plugin2 === 'function') {
    const { provide: provide2 } = (await nuxtApp.runWithContext(() => plugin2(nuxtApp))) || {};
    if (provide2 && typeof provide2 === 'object') {
      for (const key in provide2) {
        nuxtApp.provide(key, provide2[key]);
      }
    }
  }
}
async function applyPlugins(nuxtApp, plugins2) {
  const resolvedPlugins = /* @__PURE__ */ new Set();
  const unresolvedPlugins = [];
  const parallels = [];
  let error = void 0;
  let promiseDepth = 0;
  async function executePlugin(plugin2) {
    const unresolvedPluginsForThisPlugin =
      plugin2.dependsOn?.filter(
        (name) => plugins2.some((p) => p._name === name) && !resolvedPlugins.has(name),
      ) ?? [];
    if (unresolvedPluginsForThisPlugin.length > 0) {
      unresolvedPlugins.push([new Set(unresolvedPluginsForThisPlugin), plugin2]);
    } else {
      const promise = applyPlugin(nuxtApp, plugin2)
        .then(async () => {
          if (plugin2._name) {
            resolvedPlugins.add(plugin2._name);
            await Promise.all(
              unresolvedPlugins.map(async ([dependsOn, unexecutedPlugin]) => {
                if (dependsOn.has(plugin2._name)) {
                  dependsOn.delete(plugin2._name);
                  if (dependsOn.size === 0) {
                    promiseDepth++;
                    await executePlugin(unexecutedPlugin);
                  }
                }
              }),
            );
          }
        })
        .catch((e) => {
          if (!plugin2.parallel && !nuxtApp.payload.error) {
            throw e;
          }
          error ||= e;
        });
      if (plugin2.parallel) {
        parallels.push(promise);
      } else {
        await promise;
      }
    }
  }
  for (const plugin2 of plugins2) {
    if (nuxtApp.ssrContext?.islandContext && plugin2.env?.islands === false) {
      continue;
    }
    registerPluginHooks(nuxtApp, plugin2);
  }
  for (const plugin2 of plugins2) {
    if (nuxtApp.ssrContext?.islandContext && plugin2.env?.islands === false) {
      continue;
    }
    await executePlugin(plugin2);
  }
  await Promise.all(parallels);
  if (promiseDepth) {
    for (let i = 0; i < promiseDepth; i++) {
      await Promise.all(parallels);
    }
  }
  if (error) {
    throw nuxtApp.payload.error || error;
  }
}
// @__NO_SIDE_EFFECTS__
function defineNuxtPlugin(plugin2) {
  if (typeof plugin2 === 'function') {
    return plugin2;
  }
  const _name = plugin2._name || plugin2.name;
  delete plugin2.name;
  return Object.assign(plugin2.setup || (() => {}), plugin2, {
    [NuxtPluginIndicator]: true,
    _name,
  });
}
function callWithNuxt(nuxt, setup, args) {
  const fn = () => setup();
  const nuxtAppCtx = getNuxtAppCtx(nuxt._id);
  {
    return nuxt.vueApp.runWithContext(() => nuxtAppCtx.callAsync(nuxt, fn));
  }
}
function tryUseNuxtApp(id) {
  let nuxtAppInstance;
  if (hasInjectionContext()) {
    nuxtAppInstance = getCurrentInstance()?.appContext.app.$nuxt;
  }
  nuxtAppInstance ||= getNuxtAppCtx(id).tryUse();
  return nuxtAppInstance || null;
}
function useNuxtApp(id) {
  const nuxtAppInstance = tryUseNuxtApp(id);
  if (!nuxtAppInstance) {
    {
      throw new Error('[nuxt] instance unavailable');
    }
  }
  return nuxtAppInstance;
}
// @__NO_SIDE_EFFECTS__
function useRuntimeConfig(_event) {
  return useNuxtApp().$config;
}
function defineGetter(obj, key, val) {
  Object.defineProperty(obj, key, { get: () => val });
}
const LayoutMetaSymbol = /* @__PURE__ */ Symbol('layout-meta');
const PageRouteSymbol = /* @__PURE__ */ Symbol('route');
globalThis._importMeta_.url.replace(/\/app\/.*$/, '/');
const useRouter = () => {
  return useNuxtApp()?.$router;
};
const useRoute = () => {
  if (hasInjectionContext()) {
    return inject(PageRouteSymbol, useNuxtApp()._route);
  }
  return useNuxtApp()._route;
};
// @__NO_SIDE_EFFECTS__
function defineNuxtRouteMiddleware(middleware) {
  return middleware;
}
const isProcessingMiddleware = () => {
  try {
    if (useNuxtApp()._processingMiddleware) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
};
const HTML_ATTR_UNSAFE_RE = /[&"'<>]/g;
const HTML_ATTR_ENCODE_MAP = {
  '&': '%26',
  '"': '%22',
  "'": '%27',
  '<': '%3C',
  '>': '%3E',
};
function encodeForHtmlAttr(value) {
  return value.replace(HTML_ATTR_UNSAFE_RE, (c) => HTML_ATTR_ENCODE_MAP[c]);
}
const navigateTo = (to, options) => {
  to ||= '/';
  const toPath =
    typeof to === 'string'
      ? to
      : 'path' in to
        ? resolveRouteObject(to)
        : useRouter().resolve(to).href;
  const isExternalHost = hasProtocol(toPath, { acceptRelative: true });
  const isExternal = options?.external || isExternalHost;
  if (isExternal) {
    if (!options?.external) {
      throw new Error(
        'Navigating to an external URL is not allowed by default. Use `navigateTo(url, { external: true })`.',
      );
    }
    const { protocol } = new URL(toPath, 'http://localhost');
    if (protocol && isScriptProtocol(protocol)) {
      throw new Error(`Cannot navigate to a URL with '${protocol}' protocol.`);
    }
  }
  const inMiddleware = isProcessingMiddleware();
  const router = useRouter();
  const nuxtApp = useNuxtApp();
  {
    if (nuxtApp.ssrContext) {
      const fullPath =
        typeof to === 'string' || isExternal ? toPath : router.resolve(to).fullPath || '/';
      const location2 = isExternal
        ? toPath
        : joinURL(/* @__PURE__ */ useRuntimeConfig().app.baseURL, fullPath);
      const redirect = async function (response) {
        await nuxtApp.callHook('app:redirected');
        const encodedHeader = encodeURL(location2, isExternalHost);
        const encodedLoc = encodeForHtmlAttr(encodedHeader);
        nuxtApp.ssrContext['~renderResponse'] = {
          statusCode: sanitizeStatusCode(options?.redirectCode || 302, 302),
          body: `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=${encodedLoc}"></head></html>`,
          headers: { location: encodedHeader },
        };
        return response;
      };
      if (!isExternal && inMiddleware) {
        router.afterEach((final) => (final.fullPath === fullPath ? redirect(false) : void 0));
        return to;
      }
      return redirect(
        !inMiddleware
          ? void 0
          : /* abort route navigation */
            false,
      );
    }
  }
  if (isExternal) {
    nuxtApp._scope.stop();
    if (options?.replace) {
      (void 0).replace(toPath);
    } else {
      (void 0).href = toPath;
    }
    if (inMiddleware) {
      if (!nuxtApp.isHydrating) {
        return false;
      }
      return new Promise(() => {});
    }
    return Promise.resolve();
  }
  const encodedTo = typeof to === 'string' ? encodeRoutePath(to) : to;
  return options?.replace ? router.replace(encodedTo) : router.push(encodedTo);
};
function resolveRouteObject(to) {
  return withQuery(to.path || '', to.query || {}) + (to.hash || '');
}
function encodeURL(location2, isExternalHost = false) {
  const url = new URL(location2, 'http://localhost');
  if (!isExternalHost) {
    const pathname = url.pathname.replace(/^\/{2,}/, '/');
    return pathname + url.search + url.hash;
  }
  if (location2.startsWith('//')) {
    return url.toString().replace(url.protocol, '');
  }
  return url.toString();
}
function encodeRoutePath(url) {
  const parsed = parseURL(url);
  return encodePath(decodePath(parsed.pathname)) + parsed.search + parsed.hash;
}
const NUXT_ERROR_SIGNATURE = '__nuxt_error';
const useError = /* @__NO_SIDE_EFFECTS__ */ () => toRef(useNuxtApp().payload, 'error');
const showError = (error) => {
  const nuxtError = createError(error);
  try {
    const error2 = /* @__PURE__ */ useError();
    if (false);
    error2.value ||= nuxtError;
  } catch {
    throw nuxtError;
  }
  return nuxtError;
};
const isNuxtError = (error) =>
  !!error && typeof error === 'object' && NUXT_ERROR_SIGNATURE in error;
const createError = (error) => {
  if (typeof error !== 'string' && error.statusText) {
    error.message ??= error.statusText;
  }
  const nuxtError = createError$1(error);
  Object.defineProperty(nuxtError, NUXT_ERROR_SIGNATURE, {
    value: true,
    configurable: false,
    writable: false,
  });
  Object.defineProperty(nuxtError, 'status', {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    get: () => nuxtError.statusCode,
    configurable: true,
  });
  Object.defineProperty(nuxtError, 'statusText', {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    get: () => nuxtError.statusMessage,
    configurable: true,
  });
  return nuxtError;
};
function freezeHead(head) {
  const realPush = head.push;
  head.push = () => ({ dispose: () => {}, patch: () => {}, _poll: () => {} });
  return () => {
    head.push = realPush;
  };
}
const unhead_k2P3m_ZDyjlr2mMYnoDPwavjsDN8hBlk9cFai0bbopU = /* @__PURE__ */ defineNuxtPlugin({
  name: 'nuxt:head',
  enforce: 'pre',
  setup(nuxtApp) {
    const head = nuxtApp.ssrContext.head;
    if (nuxtApp.ssrContext.islandContext) {
      const unfreeze = freezeHead(head);
      nuxtApp.hooks.hookOnce('app:created', unfreeze);
    }
    nuxtApp.vueApp.use(head);
  },
});
function toArray(value) {
  return Array.isArray(value) ? value : [value];
}
const matcher = /* @__PURE__ */ (() => {
  const $0 = {};
  return (m, p) => {
    let r = [];
    if (p.charCodeAt(p.length - 1) === 47) p = p.slice(0, -1) || '/';
    let s = p.split('/'),
      l = s.length;
    if (l > 1) {
      if (s[1] === 'api') {
        r.unshift({ data: $0, params: { _: s.slice(2).join('/') } });
      }
    }
    return r;
  };
})();
const _routeRulesMatcher = (path) =>
  defu(
    {},
    ...matcher('', typeof path === 'string' ? path.toLowerCase() : path)
      .map((r) => r.data)
      .reverse(),
  );
const routeRulesMatcher = _routeRulesMatcher;
function getRouteRules(arg) {
  const path = typeof arg === 'string' ? arg : arg.path;
  try {
    return routeRulesMatcher(path.toLowerCase());
  } catch (e) {
    console.error('[nuxt] Error matching route rules.', e);
    return {};
  }
}
const _routes = [
  {
    name: 'index',
    path: '/',
    component: () => import('./index-CnpzYPoL.mjs'),
  },
  {
    name: 'mirrors',
    path: '/mirrors',
    component: () => import('./mirrors-HVzEBKpq.mjs'),
    children: [
      {
        name: 'mirrors-sourceId',
        path: ':sourceId()',
        component: () => import('./_sourceId_-dP-z8BRt.mjs'),
      },
    ],
  },
  {
    name: 'resources',
    path: '/resources',
    component: () => import('./resources-Bl7eTGg8.mjs'),
  },
];
const ROUTE_KEY_PARENTHESES_RE = /(:\w+)\([^)]+\)/g;
const ROUTE_KEY_SYMBOLS_RE = /(:\w+)[?+*]/g;
const ROUTE_KEY_NORMAL_RE = /:\w+/g;
function generateRouteKey(route) {
  const source =
    route?.meta.key ??
    route.path
      .replace(ROUTE_KEY_PARENTHESES_RE, '$1')
      .replace(ROUTE_KEY_SYMBOLS_RE, '$1')
      .replace(ROUTE_KEY_NORMAL_RE, (r) => route.params[r.slice(1)]?.toString() || '');
  return typeof source === 'function' ? source(route) : source;
}
function isChangingPage(to, from) {
  if (to === from || from === START_LOCATION) {
    return false;
  }
  if (generateRouteKey(to) !== generateRouteKey(from)) {
    return true;
  }
  const areComponentsSame = to.matched.every(
    (comp, index) =>
      comp.components && comp.components.default === from.matched[index]?.components?.default,
  );
  if (areComponentsSame) {
    return false;
  }
  return true;
}
const routerOptions0 = {
  scrollBehavior(to, from, savedPosition) {
    const nuxtApp = useNuxtApp();
    const hashScrollBehaviour = useRouter().options?.scrollBehaviorType ?? 'auto';
    if (to.path.replace(/\/$/, '') === from.path.replace(/\/$/, '')) {
      if (from.hash && !to.hash) {
        return { left: 0, top: 0 };
      }
      if (to.hash) {
        return {
          el: to.hash,
          top: _getHashElementScrollMarginTop(to.hash),
          behavior: hashScrollBehaviour,
        };
      }
      return false;
    }
    const routeAllowsScrollToTop =
      typeof to.meta.scrollToTop === 'function'
        ? to.meta.scrollToTop(to, from)
        : to.meta.scrollToTop;
    if (routeAllowsScrollToTop === false) {
      return false;
    }
    if (from === START_LOCATION) {
      return _calculatePosition(to, from, savedPosition, hashScrollBehaviour);
    }
    return new Promise((resolve) => {
      const doScroll = () => {
        requestAnimationFrame(() =>
          resolve(_calculatePosition(to, from, savedPosition, hashScrollBehaviour)),
        );
      };
      nuxtApp.hooks.hookOnce('page:loading:end', () => {
        const transitionPromise = nuxtApp['~transitionPromise'];
        if (transitionPromise) {
          transitionPromise.then(doScroll);
        } else {
          doScroll();
        }
      });
    });
  },
};
function _getHashElementScrollMarginTop(selector) {
  try {
    const elem = (void 0).querySelector(selector);
    if (elem) {
      return (
        (Number.parseFloat(getComputedStyle(elem).scrollMarginTop) || 0) +
        (Number.parseFloat(getComputedStyle((void 0).documentElement).scrollPaddingTop) || 0)
      );
    }
  } catch {}
  return 0;
}
function _calculatePosition(to, from, savedPosition, defaultHashScrollBehaviour) {
  if (savedPosition) {
    return savedPosition;
  }
  if (to.hash) {
    return {
      el: to.hash,
      top: _getHashElementScrollMarginTop(to.hash),
      behavior: isChangingPage(to, from) ? defaultHashScrollBehaviour : 'instant',
    };
  }
  return {
    left: 0,
    top: 0,
  };
}
const configRouterOptions = {
  hashMode: false,
  scrollBehaviorType: 'auto',
};
const routerOptions = {
  ...configRouterOptions,
  ...routerOptions0,
};
const validate = /* @__PURE__ */ defineNuxtRouteMiddleware(async (to, from) => {
  let __temp, __restore;
  if (!to.meta?.validate) {
    return;
  }
  const result =
    (([__temp, __restore] = executeAsync(() => Promise.resolve(to.meta.validate(to)))),
    (__temp = await __temp),
    __restore(),
    __temp);
  if (result === true) {
    return;
  }
  const error = createError({
    fatal: false,
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    status: (result && (result.status || result.statusCode)) || 404,
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    statusText:
      (result && (result.statusText || result.statusMessage)) || `Page Not Found: ${to.fullPath}`,
    data: {
      path: to.fullPath,
    },
  });
  return error;
});
const manifest_45route_45rule = /* @__PURE__ */ defineNuxtRouteMiddleware((to) => {
  {
    return;
  }
});
const globalMiddleware = [validate, manifest_45route_45rule];
const namedMiddleware = {};
Object.assign(/* @__PURE__ */ Object.create(null), {});
const pageIslandRoutes = Object.assign(/* @__PURE__ */ Object.create(null), {});
const plugin = /* @__PURE__ */ defineNuxtPlugin({
  name: 'nuxt:router',
  enforce: 'pre',
  async setup(nuxtApp) {
    let __temp, __restore;
    let routerBase = /* @__PURE__ */ useRuntimeConfig().app.baseURL;
    const history = routerOptions.history?.(routerBase) ?? createMemoryHistory(routerBase);
    const routes = routerOptions.routes
      ? ((([__temp, __restore] = executeAsync(() => routerOptions.routes(_routes))),
        (__temp = await __temp),
        __restore(),
        __temp) ?? _routes)
      : _routes;
    let startPosition;
    const router = createRouter({
      ...routerOptions,
      scrollBehavior: (to, from, savedPosition) => {
        if (from === START_LOCATION) {
          startPosition = savedPosition;
          return;
        }
        if (routerOptions.scrollBehavior) {
          router.options.scrollBehavior = routerOptions.scrollBehavior;
          if ('scrollRestoration' in (void 0).history) {
            const unsub = router.beforeEach(() => {
              unsub();
              (void 0).history.scrollRestoration = 'manual';
            });
          }
          return routerOptions.scrollBehavior(to, START_LOCATION, startPosition || savedPosition);
        }
      },
      history,
      routes,
    });
    nuxtApp.vueApp.use(router);
    const previousRoute = shallowRef(router.currentRoute.value);
    router.afterEach((_to, from) => {
      previousRoute.value = from;
    });
    Object.defineProperty(nuxtApp.vueApp.config.globalProperties, 'previousRoute', {
      get: () => previousRoute.value,
    });
    const initialURL = nuxtApp.ssrContext.url;
    const _route = shallowRef(router.currentRoute.value);
    const syncCurrentRoute = () => {
      _route.value = router.currentRoute.value;
    };
    router.afterEach((to, from) => {
      const lastTo = to.matched.at(-1)?.components?.default;
      const lastFrom = from.matched.at(-1)?.components?.default;
      if (lastTo === lastFrom) {
        syncCurrentRoute();
        return;
      }
      if (
        to.matched.length < from.matched.length &&
        to.matched.every((m, i) => m.components?.default === from.matched[i]?.components?.default)
      ) {
        syncCurrentRoute();
      }
    });
    const route = { sync: syncCurrentRoute };
    for (const key in _route.value) {
      Object.defineProperty(route, key, {
        get: () => _route.value[key],
        enumerable: true,
      });
    }
    nuxtApp._route = shallowReactive(route);
    nuxtApp._middleware ||= {
      global: [],
      named: {},
    };
    const error = /* @__PURE__ */ useError();
    const isServerPage = nuxtApp.ssrContext?.islandContext?.name?.startsWith('page_');
    if (!nuxtApp.ssrContext?.islandContext || isServerPage) {
      router.afterEach(async (to, _from, failure) => {
        delete nuxtApp._processingMiddleware;
        if (failure) {
          await nuxtApp.callHook('page:loading:end');
        }
        if (failure?.type === 4) {
          return;
        }
        if (to.redirectedFrom && to.fullPath !== initialURL) {
          await nuxtApp.runWithContext(() => navigateTo(to.fullPath || '/'));
        }
      });
    }
    try {
      if (true) {
        (([__temp, __restore] = executeAsync(() => router.push(initialURL))),
          await __temp,
          __restore());
      }
      (([__temp, __restore] = executeAsync(() => router.isReady())), await __temp, __restore());
    } catch (error2) {
      (([__temp, __restore] = executeAsync(() => nuxtApp.runWithContext(() => showError(error2)))),
        await __temp,
        __restore());
    }
    const resolvedInitialRoute = router.currentRoute.value;
    const hasDeferredRoute = false;
    syncCurrentRoute();
    if (nuxtApp.ssrContext?.islandContext && !isServerPage) {
      return { provide: { router } };
    }
    const initialLayout = nuxtApp.payload.state._layout;
    router.beforeEach(async (to, from) => {
      await nuxtApp.callHook('page:loading:start');
      to.meta = reactive(to.meta);
      if (nuxtApp.isHydrating && initialLayout && !isReadonly(to.meta.layout)) {
        to.meta.layout = initialLayout;
      }
      nuxtApp._processingMiddleware = true;
      if (!nuxtApp.ssrContext?.islandContext || isServerPage) {
        const middlewareEntries = /* @__PURE__ */ new Set([
          ...globalMiddleware,
          ...nuxtApp._middleware.global,
        ]);
        for (const component of to.matched) {
          const componentMiddleware = component.meta.middleware;
          if (!componentMiddleware) {
            continue;
          }
          for (const entry2 of toArray(componentMiddleware)) {
            middlewareEntries.add(entry2);
          }
        }
        const routeRules = getRouteRules({ path: to.path });
        if (routeRules.appMiddleware) {
          for (const key in routeRules.appMiddleware) {
            if (routeRules.appMiddleware[key]) {
              middlewareEntries.add(key);
            } else {
              middlewareEntries.delete(key);
            }
          }
        }
        for (const entry2 of middlewareEntries) {
          const middleware =
            typeof entry2 === 'string'
              ? nuxtApp._middleware.named[entry2] ||
                (await namedMiddleware[entry2]?.().then((r) => r.default || r))
              : entry2;
          if (!middleware) {
            throw new Error(`Unknown route middleware: '${entry2}'.`);
          }
          try {
            if (false);
            const result = await nuxtApp.runWithContext(() => middleware(to, from));
            if (true) {
              if (result === false || result instanceof Error) {
                const error2 =
                  result ||
                  createError({
                    status: 404,
                    statusText: `Page Not Found: ${initialURL}`,
                  });
                await nuxtApp.runWithContext(() => showError(error2));
                return false;
              }
            }
            if (result === true) {
              continue;
            }
            if (result === false) {
              return result;
            }
            if (result) {
              if (isNuxtError(result) && result.fatal) {
                await nuxtApp.runWithContext(() => showError(result));
              }
              return result;
            }
          } catch (err) {
            const error2 = createError(err);
            if (error2.fatal) {
              await nuxtApp.runWithContext(() => showError(error2));
            }
            return error2;
          }
        }
      }
    });
    if (isServerPage) {
      router.beforeResolve((to) => {
        const expected = pageIslandRoutes[nuxtApp.ssrContext.islandContext.name];
        const actual = to.matched.find((m) => m.components?.default?.__nuxt_island)?.components
          ?.default;
        if (!expected || expected !== actual?.__nuxt_island) {
          nuxtApp.ssrContext['~renderResponse'] = {
            statusCode: 400,
            statusMessage: 'Invalid island request path',
          };
          return false;
        }
      });
    }
    router.onError(async () => {
      delete nuxtApp._processingMiddleware;
      await nuxtApp.callHook('page:loading:end');
    });
    router.afterEach((to) => {
      if (to.matched.length === 0 && !error.value) {
        return nuxtApp.runWithContext(() =>
          showError(
            createError({
              status: 404,
              fatal: false,
              statusText: `Page not found: ${to.fullPath}`,
              data: {
                path: to.fullPath,
              },
            }),
          ),
        );
      }
    });
    nuxtApp.hooks.hookOnce('app:created', async () => {
      try {
        if ('name' in resolvedInitialRoute) {
          resolvedInitialRoute.name = void 0;
        }
        if (hasDeferredRoute);
        else {
          await router.replace({
            ...resolvedInitialRoute,
            force: true,
          });
        }
        router.options.scrollBehavior = routerOptions.scrollBehavior;
      } catch (error2) {
        await nuxtApp.runWithContext(() => showError(error2));
      }
    });
    return { provide: { router } };
  },
});
function definePayloadReducer(name, reduce) {
  {
    useNuxtApp().ssrContext['~payloadReducers'][name] = reduce;
  }
}
const reducers = [
  ['NuxtError', (data) => isNuxtError(data) && data.toJSON()],
  [
    'EmptyShallowRef',
    (data) =>
      isRef(data) &&
      isShallow(data) &&
      !data.value &&
      (typeof data.value === 'bigint' ? '0n' : JSON.stringify(data.value) || '_'),
  ],
  [
    'EmptyRef',
    (data) =>
      isRef(data) &&
      !data.value &&
      (typeof data.value === 'bigint' ? '0n' : JSON.stringify(data.value) || '_'),
  ],
  ['ShallowRef', (data) => isRef(data) && isShallow(data) && data.value],
  ['ShallowReactive', (data) => isReactive(data) && isShallow(data) && toRaw(data)],
  ['Ref', (data) => isRef(data) && data.value],
  ['Reactive', (data) => isReactive(data) && toRaw(data)],
];
const revive_payload_server_MVtmlZaQpj6ApFmshWfUWl5PehCebzaBf2NuRMiIbms =
  /* @__PURE__ */ defineNuxtPlugin({
    name: 'nuxt:revive-payload:server',
    setup() {
      for (const [reducer, fn] of reducers) {
        definePayloadReducer(reducer, fn);
      }
    },
  });
const components_plugin_z4hgvsiddfKkfXTP6M8M4zG5Cb7sGnDhcryKVM45Di4 =
  /* @__PURE__ */ defineNuxtPlugin({
    name: 'nuxt:global-components',
  });
const plugins = [
  unhead_k2P3m_ZDyjlr2mMYnoDPwavjsDN8hBlk9cFai0bbopU,
  plugin,
  revive_payload_server_MVtmlZaQpj6ApFmshWfUWl5PehCebzaBf2NuRMiIbms,
  components_plugin_z4hgvsiddfKkfXTP6M8M4zG5Cb7sGnDhcryKVM45Di4,
];
const firstNonUndefined = (...args) => args.find((arg) => arg !== void 0);
function sanitizeExternalHref(value) {
  let candidate = value.replace(/[\u0000-\u001f\s]+/g, '');
  while (candidate.toLowerCase().startsWith('view-source:')) {
    candidate = candidate.slice('view-source:'.length);
  }
  const colon = candidate.indexOf(':');
  if (colon > 0 && isScriptProtocol(candidate.slice(0, colon + 1))) {
    return null;
  }
  return value;
}
// @__NO_SIDE_EFFECTS__
function defineNuxtLink(options) {
  const componentName = options.componentName || 'NuxtLink';
  function isHashLinkWithoutHashMode(link) {
    return typeof link === 'string' && link.startsWith('#');
  }
  function resolveTrailingSlashBehavior(to, resolve, trailingSlash) {
    const effectiveTrailingSlash = trailingSlash ?? options.trailingSlash;
    if (!to || (effectiveTrailingSlash !== 'append' && effectiveTrailingSlash !== 'remove')) {
      return to;
    }
    if (typeof to === 'string') {
      return applyTrailingSlashBehavior(to, effectiveTrailingSlash);
    }
    const path = 'path' in to && to.path !== void 0 ? to.path : resolve(to).path;
    const resolvedPath = {
      ...to,
      name: void 0,
      // named routes would otherwise always override trailing slash behavior
      path: applyTrailingSlashBehavior(path, effectiveTrailingSlash),
    };
    return resolvedPath;
  }
  function useNuxtLink(props) {
    const router = useRouter();
    const config = /* @__PURE__ */ useRuntimeConfig();
    const hasTarget = computed(() => !!unref(props.target) && unref(props.target) !== '_self');
    const isAbsoluteUrl = computed(() => {
      const path = unref(props.to) || unref(props.href) || '';
      return typeof path === 'string' && hasProtocol(path, { acceptRelative: true });
    });
    const builtinRouterLink = resolveComponent('RouterLink');
    const useBuiltinLink =
      builtinRouterLink && typeof builtinRouterLink !== 'string'
        ? builtinRouterLink.useLink
        : void 0;
    const isExternal = computed(() => {
      if (unref(props.external)) {
        return true;
      }
      const path = unref(props.to) || unref(props.href) || '';
      if (typeof path === 'object') {
        return false;
      }
      return path === '' || isAbsoluteUrl.value;
    });
    const to = computed(() => {
      const path = unref(props.to) || unref(props.href) || '';
      if (isExternal.value) {
        return path;
      }
      return resolveTrailingSlashBehavior(path, router.resolve, unref(props.trailingSlash));
    });
    const link = isExternal.value
      ? void 0
      : useBuiltinLink?.({ ...props, to, viewTransition: unref(props.viewTransition) });
    const href = computed(() => {
      const effectiveTrailingSlash = unref(props.trailingSlash) ?? options.trailingSlash;
      if (!to.value || isAbsoluteUrl.value || isHashLinkWithoutHashMode(to.value)) {
        const raw = to.value;
        return typeof raw === 'string' ? sanitizeExternalHref(raw) : raw;
      }
      if (isExternal.value) {
        const path =
          typeof to.value === 'object' && 'path' in to.value
            ? resolveRouteObject(to.value)
            : to.value;
        const href2 = typeof path === 'object' ? router.resolve(path).href : path;
        const safe = typeof href2 === 'string' ? sanitizeExternalHref(href2) : href2;
        return safe === null ? null : applyTrailingSlashBehavior(safe, effectiveTrailingSlash);
      }
      if (typeof to.value === 'object') {
        return router.resolve(to.value)?.href ?? null;
      }
      return applyTrailingSlashBehavior(
        joinURL(config.app.baseURL, to.value),
        effectiveTrailingSlash,
      );
    });
    return {
      to,
      hasTarget,
      isAbsoluteUrl,
      isExternal,
      //
      href,
      isActive: link?.isActive ?? computed(() => to.value === router.currentRoute.value.path),
      isExactActive:
        link?.isExactActive ?? computed(() => to.value === router.currentRoute.value.path),
      route: link?.route ?? computed(() => router.resolve(to.value)),
      async navigate(_e) {
        if (href.value === null) {
          return;
        }
        await navigateTo(href.value, {
          replace: unref(props.replace),
          external: isExternal.value || hasTarget.value,
        });
      },
    };
  }
  return defineComponent({
    name: componentName,
    props: {
      // Routing
      to: {
        type: [String, Object],
        default: void 0,
        required: false,
      },
      href: {
        type: [String, Object],
        default: void 0,
        required: false,
      },
      // Attributes
      target: {
        type: String,
        default: void 0,
        required: false,
      },
      rel: {
        type: String,
        default: void 0,
        required: false,
      },
      noRel: {
        type: Boolean,
        default: void 0,
        required: false,
      },
      // Prefetching
      prefetch: {
        type: Boolean,
        default: void 0,
        required: false,
      },
      prefetchOn: {
        type: [String, Object],
        default: void 0,
        required: false,
      },
      noPrefetch: {
        type: Boolean,
        default: void 0,
        required: false,
      },
      // Styling
      activeClass: {
        type: String,
        default: void 0,
        required: false,
      },
      exactActiveClass: {
        type: String,
        default: void 0,
        required: false,
      },
      prefetchedClass: {
        type: String,
        default: void 0,
        required: false,
      },
      // Vue Router's `<RouterLink>` additional props
      replace: {
        type: Boolean,
        default: void 0,
        required: false,
      },
      ariaCurrentValue: {
        type: String,
        default: void 0,
        required: false,
      },
      // Edge cases handling
      external: {
        type: Boolean,
        default: void 0,
        required: false,
      },
      // Slot API
      custom: {
        type: Boolean,
        default: void 0,
        required: false,
      },
      // Behavior
      trailingSlash: {
        type: String,
        default: void 0,
        required: false,
      },
    },
    useLink: useNuxtLink,
    setup(props, { slots }) {
      const router = useRouter();
      const { to, href, navigate, isExternal, hasTarget, isAbsoluteUrl } = useNuxtLink(props);
      shallowRef(false);
      const el = void 0;
      const elRef = void 0;
      async function prefetch(nuxtApp = useNuxtApp()) {
        {
          return;
        }
      }
      return () => {
        if (!isExternal.value && !hasTarget.value && !isHashLinkWithoutHashMode(to.value)) {
          const routerLinkProps = {
            ref: elRef,
            to: to.value,
            activeClass: props.activeClass || options.activeClass,
            exactActiveClass: props.exactActiveClass || options.exactActiveClass,
            replace: props.replace,
            ariaCurrentValue: props.ariaCurrentValue,
            custom: props.custom,
          };
          if (!props.custom) {
            routerLinkProps.rel = props.rel || void 0;
          }
          return h(resolveComponent('RouterLink'), routerLinkProps, slots.default);
        }
        const target = props.target || null;
        const rel =
          firstNonUndefined(
            // converts `""` to `null` to prevent the attribute from being added as empty (`rel=""`)
            props.noRel ? '' : props.rel,
            options.externalRelAttribute,
            /*
             * A fallback rel of `noopener noreferrer` is applied for external links or links that open in a new tab.
             * This solves a reverse tabnapping security flaw in browsers pre-2021 as well as improving privacy.
             */
            isAbsoluteUrl.value || hasTarget.value ? 'noopener noreferrer' : '',
          ) || null;
        if (props.custom) {
          if (!slots.default) {
            return null;
          }
          return slots.default({
            href: href.value,
            navigate,
            prefetch,
            get route() {
              if (!href.value) {
                return void 0;
              }
              const url = new URL(href.value, 'http://localhost');
              return {
                path: url.pathname,
                fullPath: url.pathname,
                get query() {
                  return parseQuery(url.search);
                },
                hash: url.hash,
                params: {},
                name: void 0,
                matched: [],
                redirectedFrom: void 0,
                meta: {},
                href: href.value,
              };
            },
            rel,
            target,
            isExternal: isExternal.value || hasTarget.value,
            isActive: false,
            isExactActive: false,
          });
        }
        return h(
          'a',
          {
            ref: el,
            href: href.value || null,
            // converts `""` to `null` to prevent the attribute from being added as empty (`href=""`)
            rel,
            target,
            onClick: async (event) => {
              if (isExternal.value || hasTarget.value) {
                return;
              }
              event.preventDefault();
              try {
                const encodedHref = encodeRoutePath(href.value ?? '');
                return await (props.replace
                  ? router.replace(encodedHref)
                  : router.push(encodedHref));
              } finally {
              }
            },
          },
          slots.default?.(),
        );
      };
    },
  });
}
const __nuxt_component_0 = /* @__PURE__ */ defineNuxtLink(nuxtLinkDefaults);
function applyTrailingSlashBehavior(to, trailingSlash) {
  const normalizeFn = trailingSlash === 'append' ? withTrailingSlash : withoutTrailingSlash;
  const hasProtocolDifferentFromHttp = hasProtocol(to) && !to.startsWith('http');
  if (hasProtocolDifferentFromHttp) {
    return to;
  }
  return normalizeFn(to, true);
}
const defineRouteProvider = (name = 'RouteProvider') =>
  defineComponent({
    name,
    props: {
      route: {
        type: Object,
        required: true,
      },
      vnode: Object,
      vnodeRef: Object,
      renderKey: String,
      trackRootNodes: Boolean,
    },
    setup(props) {
      const previousKey = props.renderKey;
      const previousRoute = props.route;
      const route = {};
      for (const key in props.route) {
        Object.defineProperty(route, key, {
          get: () => (previousKey === props.renderKey ? props.route[key] : previousRoute[key]),
          enumerable: true,
        });
      }
      provide(PageRouteSymbol, shallowReactive(route));
      return () => {
        if (!props.vnode) {
          return props.vnode;
        }
        return h(props.vnode, { ref: props.vnodeRef });
      };
    },
  });
const RouteProvider = defineRouteProvider();
const __nuxt_component_1 = defineComponent({
  name: 'NuxtPage',
  inheritAttrs: false,
  props: {
    name: {
      type: String,
    },
    transition: {
      type: [Boolean, Object],
      default: void 0,
    },
    keepalive: {
      type: [Boolean, Object],
      default: void 0,
    },
    route: {
      type: Object,
    },
    pageKey: {
      type: [Function, String],
      default: null,
    },
  },
  setup(props, { attrs, slots, expose }) {
    const nuxtApp = useNuxtApp();
    const pageRef = ref();
    inject(PageRouteSymbol, null);
    expose({ pageRef });
    inject(LayoutMetaSymbol, null);
    nuxtApp.deferHydration();
    return () => {
      return h(
        RouterView,
        { name: props.name, route: props.route, ...attrs },
        {
          default: (routeProps) => {
            return h(
              Suspense,
              { suspensible: true },
              {
                default() {
                  return h(RouteProvider, {
                    vnode: slots.default
                      ? normalizeSlot(slots.default, routeProps)
                      : routeProps.Component,
                    route: routeProps.route,
                    vnodeRef: pageRef,
                  });
                },
              },
            );
          },
        },
      );
    };
  },
});
function normalizeSlot(slot, data) {
  const slotContent = slot(data);
  return slotContent.length === 1 ? h(slotContent[0]) : h(Fragment, void 0, slotContent);
}
const usePlatformApi = () => {
  const { public: publicConfig } = /* @__PURE__ */ useRuntimeConfig();
  const api = (path) => $fetch(`${publicConfig.apiBase}${path}`);
  return {
    getHome: () => api('/website/home'),
    getSettings: () => api('/auth/settings'),
    getMirrors: () => api('/mirror/sources'),
    getMirror: (sourceId) => api(`/website/mirrors/${sourceId}`),
    getMirrorCategories: (sourceId) => api(`/website/mirrors/${sourceId}/categories`),
    getMirrorResources: (sourceId, query = {}) => {
      const params = new URLSearchParams();
      Object.entries(query).forEach(([key, value]) => {
        if (value !== void 0 && value !== '') params.set(key, String(value));
      });
      return api(`/website/mirrors/${sourceId}/resources?${params.toString()}`);
    },
    getMirrorResource: (sourceId, resourceId) =>
      api(`/website/mirrors/${sourceId}/resources/${resourceId}`),
  };
};
defineComponent({
  name: 'ServerPlaceholder',
  render() {
    return createElementBlock('div');
  },
});
const clientOnlySymbol = /* @__PURE__ */ Symbol.for('nuxt:client-only');
defineComponent({
  name: 'ClientOnly',
  inheritAttrs: false,
  props: ['fallback', 'placeholder', 'placeholderTag', 'fallbackTag'],
  ...false,
  setup(props, { slots, attrs }) {
    const mounted = shallowRef(false);
    const vm = getCurrentInstance();
    if (vm) {
      vm._nuxtClientOnly = true;
    }
    provide(clientOnlySymbol, true);
    return () => {
      if (mounted.value) {
        const vnodes = slots.default?.();
        if (vnodes && vnodes.length === 1) {
          return [cloneVNode(vnodes[0], attrs)];
        }
        return vnodes;
      }
      const slot = slots.fallback || slots.placeholder;
      if (slot) {
        return h(slot);
      }
      const fallbackStr = props.fallback || props.placeholder || '';
      const fallbackTag = props.fallbackTag || props.placeholderTag || 'span';
      return createElementBlock(fallbackTag, attrs, fallbackStr);
    };
  },
});
const isDefer = (dedupe) => dedupe === 'defer' || dedupe === false;
function useAsyncData(...args) {
  const autoKey = typeof args[args.length - 1] === 'string' ? args.pop() : void 0;
  if (_isAutoKeyNeeded(args[0], args[1])) {
    args.unshift(autoKey);
  }
  let [_key, _handler, options = {}] = args;
  const key = computed(() => toValue(_key));
  if (typeof key.value !== 'string') {
    throw new TypeError('[nuxt] [useAsyncData] key must be a string.');
  }
  if (typeof _handler !== 'function') {
    throw new TypeError('[nuxt] [useAsyncData] handler must be a function.');
  }
  const nuxtApp = useNuxtApp();
  options.server ??= true;
  options.default ??= getDefault;
  options.getCachedData ??= getDefaultCachedData;
  options.lazy ??= false;
  options.immediate ??= true;
  options.deep ??= asyncDataDefaults.deep;
  options.dedupe ??= 'cancel';
  options._functionName || 'useAsyncData';
  nuxtApp._asyncData[key.value];
  function createInitialFetch() {
    const initialFetchOptions = { cause: 'initial', dedupe: options.dedupe };
    if (!nuxtApp._asyncData[key.value]?._init) {
      initialFetchOptions.cachedData = options.getCachedData(key.value, nuxtApp, {
        cause: 'initial',
      });
      nuxtApp._asyncData[key.value] = createAsyncData(
        nuxtApp,
        key.value,
        _handler,
        options,
        initialFetchOptions.cachedData,
      );
    }
    return () => nuxtApp._asyncData[key.value].execute(initialFetchOptions);
  }
  const initialFetch = createInitialFetch();
  const asyncData = nuxtApp._asyncData[key.value];
  asyncData._deps++;
  const fetchOnServer = options.server !== false && nuxtApp.payload.serverRendered;
  if (fetchOnServer && options.immediate) {
    const promise = initialFetch();
    if (getCurrentInstance()) {
      onServerPrefetch(() => promise);
    } else {
      nuxtApp.hook('app:created', async () => {
        await promise;
      });
    }
  }
  const asyncReturn = {
    data: writableComputedRef(() => nuxtApp._asyncData[key.value]?.data),
    pending: writableComputedRef(() => nuxtApp._asyncData[key.value]?.pending),
    status: writableComputedRef(() => nuxtApp._asyncData[key.value]?.status),
    error: writableComputedRef(() => nuxtApp._asyncData[key.value]?.error),
    refresh: (...args2) => {
      if (!nuxtApp._asyncData[key.value]?._init) {
        const initialFetch2 = createInitialFetch();
        return initialFetch2();
      }
      return nuxtApp._asyncData[key.value].execute(...args2);
    },
    execute: (...args2) => asyncReturn.refresh(...args2),
    clear: () => {
      const entry2 = nuxtApp._asyncData[key.value];
      if (entry2?._abortController) {
        try {
          entry2._abortController.abort(
            new DOMException('AsyncData aborted by user.', 'AbortError'),
          );
        } finally {
          entry2._abortController = void 0;
        }
      }
      clearNuxtDataByKey(nuxtApp, key.value);
    },
  };
  const asyncDataPromise = Promise.resolve(nuxtApp._asyncDataPromises[key.value]).then(
    () => asyncReturn,
  );
  Object.assign(asyncDataPromise, asyncReturn);
  Object.defineProperties(asyncDataPromise, {
    then: { enumerable: true, value: asyncDataPromise.then.bind(asyncDataPromise) },
    catch: { enumerable: true, value: asyncDataPromise.catch.bind(asyncDataPromise) },
    finally: { enumerable: true, value: asyncDataPromise.finally.bind(asyncDataPromise) },
  });
  return asyncDataPromise;
}
function writableComputedRef(getter) {
  return computed({
    get() {
      return getter()?.value;
    },
    set(value) {
      const ref2 = getter();
      if (ref2) {
        ref2.value = value;
      }
    },
  });
}
function _isAutoKeyNeeded(keyOrFetcher, fetcher) {
  if (typeof keyOrFetcher === 'string') {
    return false;
  }
  if (typeof keyOrFetcher === 'object' && keyOrFetcher !== null) {
    return false;
  }
  if (typeof keyOrFetcher === 'function' && typeof fetcher === 'function') {
    return false;
  }
  return true;
}
function clearNuxtDataByKey(nuxtApp, key) {
  if (key in nuxtApp.payload.data) {
    nuxtApp.payload.data[key] = void 0;
  }
  if (key in nuxtApp.payload._errors) {
    nuxtApp.payload._errors[key] = asyncDataDefaults.errorValue;
  }
  if (nuxtApp._asyncData[key]) {
    nuxtApp._asyncData[key].data.value = void 0;
    nuxtApp._asyncData[key].error.value = asyncDataDefaults.errorValue;
    {
      nuxtApp._asyncData[key].pending.value = false;
    }
    nuxtApp._asyncData[key].status.value = 'idle';
  }
  if (key in nuxtApp._asyncDataPromises) {
    nuxtApp._asyncDataPromises[key] = void 0;
  }
}
function pick(obj, keys) {
  const newObj = {};
  for (const key of keys) {
    newObj[key] = obj[key];
  }
  return newObj;
}
function createAsyncData(nuxtApp, key, _handler, options, initialCachedData) {
  nuxtApp.payload._errors[key] ??= asyncDataDefaults.errorValue;
  const hasCustomGetCachedData = options.getCachedData !== getDefaultCachedData;
  const handler = _handler;
  const _ref = options.deep ? ref : shallowRef;
  const hasCachedData = initialCachedData != null;
  const unsubRefreshAsyncData = nuxtApp.hook('app:data:refresh', async (keys) => {
    if (!keys || keys.includes(key)) {
      await asyncData.execute({ cause: 'refresh:hook' });
    }
  });
  const asyncData = {
    data: _ref(hasCachedData ? initialCachedData : options.default()),
    pending: shallowRef(!hasCachedData),
    error: toRef(nuxtApp.payload._errors, key),
    status: shallowRef('idle'),
    execute: (...args) => {
      const [_opts, newValue = void 0] = args;
      const opts = _opts && newValue === void 0 && typeof _opts === 'object' ? _opts : {};
      if (nuxtApp._asyncDataPromises[key]) {
        if (isDefer(opts.dedupe ?? options.dedupe)) {
          return nuxtApp._asyncDataPromises[key];
        }
      }
      if (opts.cause === 'initial' || nuxtApp.isHydrating) {
        const cachedData =
          'cachedData' in opts
            ? opts.cachedData
            : options.getCachedData(key, nuxtApp, { cause: opts.cause ?? 'refresh:manual' });
        if (cachedData != null) {
          nuxtApp.payload.data[key] = asyncData.data.value = cachedData;
          asyncData.error.value = asyncDataDefaults.errorValue;
          asyncData.status.value = 'success';
          return Promise.resolve(cachedData);
        }
      }
      {
        asyncData.pending.value = true;
      }
      if (asyncData._abortController) {
        asyncData._abortController.abort(
          new DOMException('AsyncData request cancelled by deduplication', 'AbortError'),
        );
      }
      asyncData._abortController = new AbortController();
      asyncData.status.value = 'pending';
      const cleanupController = new AbortController();
      const promise = new Promise((resolve, reject) => {
        try {
          const timeout = opts.timeout ?? options.timeout;
          const mergedSignal = mergeAbortSignals(
            [asyncData._abortController?.signal, opts?.signal],
            cleanupController.signal,
            timeout,
          );
          if (mergedSignal.aborted) {
            const reason = mergedSignal.reason;
            reject(
              reason instanceof Error
                ? reason
                : new DOMException(String(reason ?? 'Aborted'), 'AbortError'),
            );
            return;
          }
          mergedSignal.addEventListener(
            'abort',
            () => {
              const reason = mergedSignal.reason;
              reject(
                reason instanceof Error
                  ? reason
                  : new DOMException(String(reason ?? 'Aborted'), 'AbortError'),
              );
            },
            { once: true, signal: cleanupController.signal },
          );
          return Promise.resolve(handler(nuxtApp, { signal: mergedSignal })).then(resolve, reject);
        } catch (err) {
          reject(err);
        }
      })
        .then(async (_result) => {
          if (nuxtApp._asyncDataPromises[key] !== promise) {
            return;
          }
          let result = _result;
          if (options.transform) {
            result = await options.transform(_result);
          }
          if (options.pick) {
            result = pick(result, options.pick);
          }
          nuxtApp.payload.data[key] = result;
          asyncData.data.value = result;
          asyncData.error.value = asyncDataDefaults.errorValue;
          asyncData.status.value = 'success';
        })
        .catch((error) => {
          if (nuxtApp._asyncDataPromises[key] !== promise) {
            return nuxtApp._asyncDataPromises[key];
          }
          if (asyncData._abortController?.signal.aborted) {
            return nuxtApp._asyncDataPromises[key];
          }
          if (
            typeof DOMException !== 'undefined' &&
            error instanceof DOMException &&
            error.name === 'AbortError'
          ) {
            asyncData.status.value = 'idle';
            return nuxtApp._asyncDataPromises[key];
          }
          asyncData.error.value = createError(error);
          asyncData.data.value = unref(options.default());
          asyncData.status.value = 'error';
        })
        .finally(() => {
          cleanupController.abort();
          if (nuxtApp._asyncDataPromises[key] === promise) {
            {
              asyncData.pending.value = false;
            }
            delete nuxtApp._asyncDataPromises[key];
          }
        });
      nuxtApp._asyncDataPromises[key] = promise;
      return nuxtApp._asyncDataPromises[key];
    },
    _execute: debounce((...args) => asyncData.execute(...args), 0, { leading: true }),
    _default: options.default,
    _deps: 0,
    _init: true,
    _hash: void 0,
    _off: () => {
      unsubRefreshAsyncData();
      if (nuxtApp._asyncData[key]?._init) {
        nuxtApp._asyncData[key]._init = false;
      }
      if (!hasCustomGetCachedData) {
        nextTick(() => {
          if (!nuxtApp._asyncData[key]?._init) {
            clearNuxtDataByKey(nuxtApp, key);
            asyncData.execute = () => Promise.resolve();
            asyncData.data.value = asyncDataDefaults.value;
          }
        });
      }
    },
  };
  return asyncData;
}
const getDefault = () => asyncDataDefaults.value;
const getDefaultCachedData = (key, nuxtApp, ctx) => {
  if (nuxtApp.isHydrating) {
    return nuxtApp.payload.data[key];
  }
  if (ctx.cause !== 'refresh:manual' && ctx.cause !== 'refresh:hook') {
    return nuxtApp.static.data[key];
  }
};
function mergeAbortSignals(signals, cleanupSignal, timeout) {
  const list = signals.filter((s) => !!s);
  if (typeof timeout === 'number' && timeout >= 0) {
    const timeoutSignal = AbortSignal.timeout?.(timeout);
    if (timeoutSignal) {
      list.push(timeoutSignal);
    }
  }
  if (AbortSignal.any) {
    return AbortSignal.any(list);
  }
  const controller = new AbortController();
  for (const sig of list) {
    if (sig.aborted) {
      const reason = sig.reason ?? new DOMException('Aborted', 'AbortError');
      try {
        controller.abort(reason);
      } catch {
        controller.abort();
      }
      return controller.signal;
    }
  }
  const onAbort = () => {
    const abortedSignal = list.find((s) => s.aborted);
    const reason = abortedSignal?.reason ?? new DOMException('Aborted', 'AbortError');
    try {
      controller.abort(reason);
    } catch {
      controller.abort();
    }
  };
  for (const sig of list) {
    sig.addEventListener?.('abort', onAbort, { once: true, signal: cleanupSignal });
  }
  return controller.signal;
}
const _sfc_main$2 = /* @__PURE__ */ defineComponent({
  __name: 'app',
  __ssrInlineRender: true,
  async setup(__props) {
    let __temp, __restore;
    const config = /* @__PURE__ */ useRuntimeConfig();
    const platform = usePlatformApi();
    const { data: platformSettings } =
      (([__temp, __restore] = withAsyncContext(() =>
        useAsyncData('platform-settings', () => platform.getSettings()),
      )),
      (__temp = await __temp),
      __restore(),
      __temp);
    const siteName = computed(
      () => platformSettings.value?.PLATFORM_NAME || '3D Personal Learning Platform',
    );
    const nav = [
      { label: '首页', to: '/' },
      { label: '资源中心', to: '/resources' },
      { label: '镜像站', to: '/mirrors' },
    ];
    return (_ctx, _push, _parent, _attrs) => {
      const _component_NuxtLink = __nuxt_component_0;
      const _component_NuxtPage = __nuxt_component_1;
      _push(
        `<div${ssrRenderAttrs(mergeProps({ class: 'site-shell' }, _attrs))}><header class="site-header">`,
      );
      _push(
        ssrRenderComponent(
          _component_NuxtLink,
          {
            class: 'brand',
            to: '/',
            'aria-label': '返回首页',
          },
          {
            default: withCtx((_, _push2, _parent2, _scopeId) => {
              if (_push2) {
                _push2(
                  `<span class="brand-mark"${_scopeId}>S</span><span${_scopeId}>${ssrInterpolate(unref(siteName))}</span>`,
                );
              } else {
                return [
                  createVNode('span', { class: 'brand-mark' }, 'S'),
                  createVNode('span', null, toDisplayString(unref(siteName)), 1),
                ];
              }
            }),
            _: 1,
          },
          _parent,
        ),
      );
      _push(`<nav aria-label="主导航"><!--[-->`);
      ssrRenderList(nav, (item) => {
        _push(
          ssrRenderComponent(
            _component_NuxtLink,
            {
              key: item.to,
              to: item.to,
            },
            {
              default: withCtx((_, _push2, _parent2, _scopeId) => {
                if (_push2) {
                  _push2(`${ssrInterpolate(item.label)}`);
                } else {
                  return [createTextVNode(toDisplayString(item.label), 1)];
                }
              }),
              _: 2,
            },
            _parent,
          ),
        );
      });
      _push(
        `<!--]--></nav><a class="header-action"${ssrRenderAttr('href', unref(config).public.appBase)}>进入平台 <span>↗</span></a></header><main>`,
      );
      _push(ssrRenderComponent(_component_NuxtPage, null, null, _parent));
      _push(
        `</main><footer class="site-footer"><span>© ${ssrInterpolate(/* @__PURE__ */ new Date().getFullYear())} ${ssrInterpolate(unref(siteName))}</span><span>为持续学习而设计</span></footer></div>`,
      );
    };
  },
});
const _sfc_setup$2 = _sfc_main$2.setup;
_sfc_main$2.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add('app.vue');
  return _sfc_setup$2 ? _sfc_setup$2(props, ctx) : void 0;
};
const _sfc_main$1 = {
  __name: 'nuxt-error-page',
  __ssrInlineRender: true,
  props: {
    error: Object,
  },
  setup(__props) {
    const props = __props;
    const _error = props.error;
    const status = Number(_error.statusCode || 500);
    const is404 = status === 404;
    const statusText = _error.statusMessage ?? (is404 ? 'Page Not Found' : 'Internal Server Error');
    const description = _error.message || _error.toString();
    const stack = void 0;
    const _Error404 = defineAsyncComponent(() => import('./error-404-95G7280I.mjs'));
    const _Error = defineAsyncComponent(() => import('./error-500-BU40mTGc.mjs'));
    const ErrorTemplate = is404 ? _Error404 : _Error;
    return (_ctx, _push, _parent, _attrs) => {
      _push(
        ssrRenderComponent(
          unref(ErrorTemplate),
          mergeProps(
            {
              status: unref(status),
              statusText: unref(statusText),
              statusCode: unref(status),
              statusMessage: unref(statusText),
              description: unref(description),
              stack: unref(stack),
            },
            _attrs,
          ),
          null,
          _parent,
        ),
      );
    };
  },
};
const _sfc_setup$1 = _sfc_main$1.setup;
_sfc_main$1.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add(
    'node_modules/nuxt/dist/app/components/nuxt-error-page.vue',
  );
  return _sfc_setup$1 ? _sfc_setup$1(props, ctx) : void 0;
};
const _sfc_main = {
  __name: 'nuxt-root',
  __ssrInlineRender: true,
  setup(__props) {
    const IslandRenderer = () => null;
    const nuxtApp = useNuxtApp();
    nuxtApp.deferHydration();
    nuxtApp.ssrContext.url;
    const SingleRenderer = false;
    provide(PageRouteSymbol, useRoute());
    nuxtApp.hooks.callHookWith((hooks) => hooks.map((hook) => hook()), 'vue:setup', []);
    const error = /* @__PURE__ */ useError();
    const abortRender = error.value && !nuxtApp.ssrContext.error;
    function invokeAppErrorHandler(err, target, info) {
      const errorHandler = nuxtApp.vueApp.config.errorHandler;
      if (errorHandler && !errorHandler.__nuxt_default) {
        try {
          errorHandler(err, target, info);
        } catch (handlerError) {
          console.error('[nuxt] Error in `app.config.errorHandler`', handlerError);
        }
      }
    }
    onErrorCaptured((err, target, info) => {
      nuxtApp.hooks
        .callHook('vue:error', err, target, info)
        .catch((hookError) => console.error('[nuxt] Error in `vue:error` hook', hookError));
      {
        const p = nuxtApp.runWithContext(() => showError(err));
        onServerPrefetch(() => p);
        invokeAppErrorHandler(err, target, info);
        return false;
      }
    });
    const islandContext = nuxtApp.ssrContext.islandContext;
    return (_ctx, _push, _parent, _attrs) => {
      ssrRenderSuspense(_push, {
        default: () => {
          if (unref(abortRender)) {
            _push(`<div></div>`);
          } else if (unref(error)) {
            _push(ssrRenderComponent(unref(_sfc_main$1), { error: unref(error) }, null, _parent));
          } else if (unref(islandContext)) {
            _push(
              ssrRenderComponent(
                unref(IslandRenderer),
                { context: unref(islandContext) },
                null,
                _parent,
              ),
            );
          } else if (unref(SingleRenderer)) {
            ssrRenderVNode(
              _push,
              createVNode(resolveDynamicComponent(unref(SingleRenderer)), null, null),
              _parent,
            );
          } else {
            _push(ssrRenderComponent(unref(_sfc_main$2), null, null, _parent));
          }
        },
        _: 1,
      });
    };
  },
};
const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add(
    'node_modules/nuxt/dist/app/components/nuxt-root.vue',
  );
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
let entry;
{
  entry = async function createNuxtAppServer(ssrContext) {
    const vueApp = createApp(_sfc_main);
    const nuxt = createNuxtApp({ vueApp, ssrContext });
    try {
      await applyPlugins(nuxt, plugins);
      await nuxt.hooks.callHook('app:created', vueApp);
    } catch (error) {
      await nuxt.hooks.callHook('app:error', error);
      nuxt.payload.error ||= createError(error);
    }
    if (ssrContext && (ssrContext['~renderResponse'] || ssrContext._renderResponse)) {
      throw new Error('skipping render');
    }
    return vueApp;
  };
}
const entry_default = (ssrContext) => entry(ssrContext);

export {
  __nuxt_component_0 as _,
  useAsyncData as a,
  useRuntimeConfig as b,
  useRoute as c,
  entry_default as default,
  tryUseNuxtApp as t,
  usePlatformApi as u,
};
//# sourceMappingURL=server.mjs.map
