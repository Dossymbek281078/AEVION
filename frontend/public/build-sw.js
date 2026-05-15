// AEVION QBuild service worker — offline shell for /build/* routes.
// Strategy:
//   - Navigation requests: network-first, fall back to cached HTML, then to /build (shell).
//   - Public vacancy JSON (/api/build/public/v1/vacancies): stale-while-revalidate.
//   - Static assets (.js / .css / images under /_next/static): cache-first.
//   - Authenticated API calls and everything else: pass-through (no caching).
//
// We deliberately do NOT cache responses with Authorization or Cookie headers —
// recruiter dashboards must remain live. The SW is a progressive enhancement.

const CACHE_VERSION = "qbuild-v1";
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DATA_CACHE = `${CACHE_VERSION}-data`;
const SHELL_URLS = ["/build", "/build/vacancies"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      // Best-effort prefetch — failures are non-fatal because the SW is
      // optional. We retry on demand at fetch time.
      Promise.all(
        SHELL_URLS.map((u) =>
          fetch(u, { credentials: "same-origin" })
            .then((res) => (res.ok ? cache.put(u, res.clone()) : null))
            .catch(() => null),
        ),
      ),
    ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !k.startsWith(CACHE_VERSION))
          .map((k) => caches.delete(k)),
      ),
    ),
  );
  self.clients.claim();
});

function isQBuildShellRequest(req) {
  if (req.mode !== "navigate") return false;
  const url = new URL(req.url);
  return url.origin === self.location.origin && url.pathname.startsWith("/build");
}

function isPublicVacancyJson(req) {
  if (req.method !== "GET") return false;
  const url = new URL(req.url);
  return (
    url.origin === self.location.origin &&
    url.pathname.startsWith("/api/build/public/v1/vacancies")
  );
}

function isStaticAsset(req) {
  if (req.method !== "GET") return false;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return false;
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".webmanifest")
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // 1) Navigation: network-first → cached match → shell fallback.
  if (isQBuildShellRequest(req)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Stash 2xx responses for offline reuse.
          if (res.ok) {
            const copy = res.clone();
            caches.open(SHELL_CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() =>
          caches.match(req).then((hit) => hit || caches.match("/build")),
        ),
    );
    return;
  }

  // 2) Public vacancies JSON: stale-while-revalidate.
  if (isPublicVacancyJson(req)) {
    event.respondWith(
      caches.open(DATA_CACHE).then((cache) =>
        cache.match(req).then((cached) => {
          const network = fetch(req)
            .then((res) => {
              if (res.ok) cache.put(req, res.clone()).catch(() => {});
              return res;
            })
            .catch(() => cached);
          return cached || network;
        }),
      ),
    );
    return;
  }

  // 3) Static assets: cache-first.
  if (isStaticAsset(req)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) =>
        cache.match(req).then(
          (cached) =>
            cached ||
            fetch(req)
              .then((res) => {
                if (res.ok) cache.put(req, res.clone()).catch(() => {});
                return res;
              })
              .catch(() => cached),
        ),
      ),
    );
    return;
  }

  // 4) Everything else: pass through (especially auth-bearing API calls).
});
