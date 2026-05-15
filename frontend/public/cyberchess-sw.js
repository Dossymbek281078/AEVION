/* AEVION CyberChess Service Worker
 * Scope: /cyberchess
 * Strategy:
 *   - cache-first для статики (HTML, JS, CSS, шрифты, изображения, stockfish wasm)
 *   - network-first для /api/* (с fallback на cache)
 *   - offline fallback на /cyberchess/offline
 *   - push + notificationclick → focus/open /cyberchess/daily
 */

const CACHE_NAME = 'cyberchess-v1';
const OFFLINE_URL = '/cyberchess/offline';
const DEFAULT_NOTIFICATION_URL = '/cyberchess/daily';

// Критические ресурсы — пытаемся precache при install.
// Остальное добавляется лениво через cache-on-fetch.
const PRECACHE_URLS = [
  '/cyberchess',
  '/cyberchess/offline',
  '/cyberchess-manifest.webmanifest',
  '/manifest.webmanifest',
  '/icons/cyberchess.svg',
];

// Расширения, которые считаем "статикой" → cache-first.
const STATIC_EXT = /\.(?:js|css|woff2?|ttf|otf|png|jpg|jpeg|gif|svg|webp|ico|wasm|json)$/i;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // addAll фейлится если хоть один URL недоступен — добавляем по одному.
      await Promise.all(
        PRECACHE_URLS.map(async (url) => {
          try {
            await cache.add(new Request(url, { cache: 'reload' }));
          } catch (err) {
            // Не критично — кэшировать будем on-fetch.
            console.warn('[cyberchess-sw] precache miss', url, err);
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Чистим устаревшие версии кэша.
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith('cyberchess-') && k !== CACHE_NAME)
          .map((k) => caches.delete(k)),
      );
      // Navigation Preload (если поддерживается) ускоряет network-first.
      if ('navigationPreload' in self.registration) {
        try {
          await self.registration.navigationPreload.enable();
        } catch {}
      }
      await self.clients.claim();
    })(),
  );
});

/**
 * Является ли запрос навигацией (HTML-документом).
 */
function isNavigationRequest(req) {
  return req.mode === 'navigate' || (req.method === 'GET' && req.headers.get('accept')?.includes('text/html'));
}

/**
 * Network-first для API: сначала сеть, потом cache. Кэшируем только GET 200.
 */
async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const fresh = await fetch(request);
    if (request.method === 'GET' && fresh.ok) {
      cache.put(request, fresh.clone()).catch(() => {});
    }
    return fresh;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw err;
  }
}

/**
 * Cache-first для статики: cache → сеть → кэшировать.
 */
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const fresh = await fetch(request);
  if (fresh.ok && request.method === 'GET') {
    cache.put(request, fresh.clone()).catch(() => {});
  }
  return fresh;
}

/**
 * Navigation-стратегия: пробуем сеть (с navigation preload), при ошибке —
 * cached HTML, при отсутствии — offline-страница.
 */
async function navigationStrategy(event) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const preload = await event.preloadResponse;
    if (preload) {
      cache.put(event.request, preload.clone()).catch(() => {});
      return preload;
    }
    const fresh = await fetch(event.request);
    if (fresh.ok) {
      cache.put(event.request, fresh.clone()).catch(() => {});
    }
    return fresh;
  } catch (err) {
    const cached = await cache.match(event.request);
    if (cached) return cached;
    const offline = await cache.match(OFFLINE_URL);
    if (offline) return offline;
    return new Response(
      '<!doctype html><meta charset="utf-8"><title>Offline</title><h1>Offline</h1><p>Нет сети.</p>',
      { status: 503, headers: { 'content-type': 'text/html; charset=utf-8' } },
    );
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Игнорируем не-GET (кроме навигаций) и cross-origin.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Ограничиваем SW зоной /cyberchess + общие ассеты.
  const inScope =
    url.pathname.startsWith('/cyberchess') ||
    url.pathname.startsWith('/_next/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/fonts/') ||
    url.pathname.startsWith('/stockfish/') ||
    url.pathname === '/cyberchess-manifest.webmanifest' ||
    url.pathname === '/manifest.webmanifest' ||
    url.pathname === '/favicon.ico';

  // API всегда обрабатываем (network-first), даже если вне /cyberchess —
  // SW зарегистрирован только на /cyberchess scope, так что сюда долетают
  // только релевантные запросы.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (!inScope) return;

  if (isNavigationRequest(request)) {
    event.respondWith(navigationStrategy(event));
    return;
  }

  if (STATIC_EXT.test(url.pathname) || url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Дефолт — stale-while-revalidate.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      const networkPromise = fetch(request)
        .then((resp) => {
          if (resp.ok) cache.put(request, resp.clone()).catch(() => {});
          return resp;
        })
        .catch(() => cached);
      return cached || networkPromise;
    })(),
  );
});

// Сообщения от страницы: можно форсировать skipWaiting.
self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(caches.delete(CACHE_NAME));
  }
});

/**
 * Push handler — пока в проекте нет VAPID/бэкенда, но обрабатываем гипотетический
 * входящий push. Поддерживает payload `{ title, body, tag?, url? }`.
 */
self.addEventListener('push', (event) => {
  if (!event) return;
  let payload = { title: 'CyberChess', body: 'У тебя новое уведомление.', tag: 'cc-push', url: DEFAULT_NOTIFICATION_URL };
  try {
    if (event.data) {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    }
  } catch {
    try {
      const txt = event.data?.text?.();
      if (txt) payload.body = txt;
    } catch {}
  }

  const { title, body, tag, url } = payload;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      icon: '/icons/cyberchess.svg',
      badge: '/icons/cyberchess.svg',
      data: { url: url || DEFAULT_NOTIFICATION_URL },
    }),
  );
});

/**
 * Notification click — фокусим уже открытую вкладку CyberChess либо открываем новую.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const target =
    (event.notification.data && event.notification.data.url) || DEFAULT_NOTIFICATION_URL;

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      // Сначала ищем уже открытую вкладку CyberChess
      for (const client of allClients) {
        try {
          const cu = new URL(client.url);
          if (cu.pathname.startsWith('/cyberchess')) {
            await client.focus();
            // Подтолкнём к нужной странице если можем
            if ('navigate' in client && typeof client.navigate === 'function') {
              try {
                await client.navigate(target);
              } catch {}
            }
            return;
          }
        } catch {
          /* ignore */
        }
      }

      // Иначе открываем новую
      if (self.clients.openWindow) {
        await self.clients.openWindow(target);
      }
    })(),
  );
});

/**
 * Notification close — место для аналитики (no-op пока).
 */
self.addEventListener('notificationclose', () => {
  // intentional no-op
});
