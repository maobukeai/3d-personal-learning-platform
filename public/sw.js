/**
 * 3D 学习平台 — Production Service Worker
 * ─────────────────────────────────────────────────────────────────────────────
 * Strategy overview:
 *   • /assets/** (hashed filenames) → Cache-First (immutable, 1-year TTL)
 *   • /libs/**                      → Cache-First (immutable)
 *   • /favicon.svg, /manifest.json  → Stale-While-Revalidate
 *   • Everything else (HTML routes) → Network-First with offline fallback
 *
 * On each deploy, the CACHE_VERSION string must change (handled by injecting
 * the build timestamp into sw.js from the Vite build or the deploy script).
 * Right now we embed a build-time constant that Vite will replace via
 * define: { __SW_VERSION__: ... } (see vite.config.ts).
 *
 * Updating: when the browser detects a new SW it enters "waiting" state.
 * We use self.skipWaiting() + clients.claim() so the update is seamless.
 */

// This constant is replaced at build time by the swVersionPlugin in vite.config.ts.
// The fallback Date.now() is used in dev mode so the SW always refreshes.
const CACHE_VERSION = /* SW_VERSION_INJECT */ 'dev-' + Date.now();

const STATIC_CACHE = `static-v${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-v${CACHE_VERSION}`;

// All caches managed by this SW — used to prune old caches on activate.
const MANAGED_CACHES = [STATIC_CACHE, DYNAMIC_CACHE];

// ── Message: handle SKIP_WAITING from the page registration script ──────────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── Install: pre-cache the app shell ────────────────────────────────────────
self.addEventListener('install', (event) => {
  // Skip waiting so the new SW activates immediately after install.
  self.skipWaiting();

  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      // Only pre-cache the HTML entry point; assets are cached on first fetch.
      cache.addAll(['/']).catch(() => {
        /* offline during install — that's fine */
      }),
    ),
  );
});

// ── Activate: delete stale caches from previous versions ───────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => !MANAGED_CACHES.includes(key)).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// ── Fetch: route requests through the appropriate strategy ──────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests; skip cross-origin (Google Fonts, APIs…)
  if (url.origin !== self.location.origin) return;

  // Skip non-GET requests (POST, PUT, DELETE…).
  if (request.method !== 'GET') return;

  // Skip API and WebSocket paths — they must always hit the network.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/')) return;

  // Skip upload paths.
  if (url.pathname.startsWith('/uploads/')) return;

  const isHashedAsset = url.pathname.startsWith('/assets/') || url.pathname.startsWith('/libs/');

  const isStaticFile =
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.ico') ||
    url.pathname === '/manifest.json';

  if (isHashedAsset) {
    // Cache-First: hashed assets never change — serve from cache immediately.
    event.respondWith(cacheFirst(request, STATIC_CACHE));
  } else if (isStaticFile) {
    // Stale-While-Revalidate: serve cached, then update in background.
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
  } else {
    // Network-First for HTML routes: fresh content when online, cached fallback when offline.
    event.respondWith(networkFirst(request, DYNAMIC_CACHE));
  }
});

// ── Strategy implementations ────────────────────────────────────────────────

/**
 * Cache-First: return cached response immediately; fetch & cache if missing.
 */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone()); // background write — don't await
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

/**
 * Stale-While-Revalidate: return cached immediately, refresh in background.
 */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  return cached || (await fetchPromise) || new Response('Offline', { status: 503 });
}

/**
 * Network-First: try network; fall back to cache if offline.
 * Used for HTML routes so users always see fresh content when online.
 */
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Network failed — serve from cache (SPA fallback: return cached index.html).
    const cached = (await cache.match(request)) || (await cache.match('/'));
    return (
      cached ||
      new Response('Offline — please check your connection.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    );
  }
}
