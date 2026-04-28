// AEVION Service Worker — minimal offline-first cache.
// Strategy:
//  • Navigate (HTML): network-first, fallback to cached page or offline shell.
//  • Static (CSS/JS/image/font): cache-first с network-update в фоне.
//  • API: network-only (никогда не кешируем mutating endpoints).
// Cache version меняется при деплое — старый cache сбрасывается на activate.

const VERSION = "aevion-v1";
const STATIC_CACHE = `${VERSION}-static`;
const HTML_CACHE = `${VERSION}-html`;

const PRECACHE_URLS = [
  "/",
  "/manifest.json",
  "/manifest-aev.json",
  "/manifest-qtrade.json",
  "/aev-icon-192.svg",
  "/aev-icon-512.svg",
  "/qtrade-icon-192.svg",
  "/qtrade-icon-512.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      // Pre-cache бесшумно, не блокируем install при failed assets
      Promise.all(
        PRECACHE_URLS.map((url) =>
          cache.add(url).catch(() => {/* ignore individual failures */})
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      // Delete old caches с другими versions
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((k) => !k.startsWith(VERSION))
            .map((k) => caches.delete(k))
        )
      ),
      self.clients.claim(),
    ])
  );
});

function isStaticAsset(url) {
  return /\.(css|js|svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|eot)$/i.test(url.pathname)
    || url.pathname.startsWith("/_next/static/");
}

function isApi(url) {
  return url.pathname.startsWith("/api/")
    || url.pathname.startsWith("/api-backend/");
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Только same-origin
  if (url.origin !== self.location.origin) return;
  // API: network-only
  if (isApi(url)) return;

  // Static: cache-first + background revalidate
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        const networkPromise = fetch(req)
          .then((res) => {
            if (res && res.status === 200 && res.type === "basic") {
              cache.put(req, res.clone());
            }
            return res;
          })
          .catch(() => cached);
        return cached || networkPromise;
      })
    );
    return;
  }

  // Navigation (HTML): network-first, fall back to cached
  if (req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === "basic") {
            const copy = res.clone();
            caches.open(HTML_CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          if (cached) return cached;
          return caches.match("/");
        })
    );
    return;
  }
});

// Manual reload command (от UI Update banner если будет)
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
