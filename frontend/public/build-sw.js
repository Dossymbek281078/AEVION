// QBuild push-notification service worker.
// Registered from /build/* pages via PushSubscribeButton.
//
// The push handler reads a JSON payload of shape:
//   { title: string, body: string, url?: string, tag?: string }
// and shows a native notification. Clicking it focuses the matching
// /build URL or opens a new tab.

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = { title: "AEVION QBuild", body: "Новое уведомление", url: "/build" };
  try {
    if (event.data) {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    }
  } catch (e) {
    try { data.body = event.data ? event.data.text() : data.body; } catch (_) { /**/ }
  }

  const opts = {
    body: data.body,
    icon: "/cyberchess-icon-192.svg",
    badge: "/cyberchess-icon-192.svg",
    tag: data.tag || "qbuild",
    data: { url: data.url || "/build" },
  };
  event.waitUntil(self.registration.showNotification(data.title, opts));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/build";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((all) => {
      for (const c of all) {
        if (c.url.includes(targetUrl) && "focus" in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    }),
  );
});
