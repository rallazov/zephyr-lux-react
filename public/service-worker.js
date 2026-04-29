/* Zephyr Lux Admin PWA — network-only worker.
 *
 * Security boundary (AC 8.4): do not persist customer/order payloads in Cache Storage.
 * Static-shell caching strategies that store fetch responses are deliberately omitted here;
 * all requests go to the network. This avoids caching admin APIs, JWT-bearing requests,
 * Supabase order data, Stripe, tokenized order-status pages, etc.
 *
 * Story 8-6: minimal `push` + `notificationclick` for owner alerts. Inert when no payload;
 * disabled server-side when env feature gate is off (no subscriptions / no sends).
 */

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

self.addEventListener("push", (event) => {
  let title = "New paid order";
  let body = "Open admin to view orders.";
  let orderId = null;
  try {
    if (event.data) {
      const j = event.data.json();
      if (j && typeof j.title === "string") title = j.title.slice(0, 120);
      if (j && typeof j.body === "string") body = j.body.slice(0, 500);
      if (j && typeof j.orderId === "string" && UUID_RE.test(j.orderId)) orderId = j.orderId;
    }
  } catch (_) {
    /* keep defaults */
  }
  const data = orderId ? { orderId } : {};
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      data,
      icon: "/pwa-icon-192.png",
      badge: "/pwa-icon-192.png",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const raw = event.notification.data && event.notification.data.orderId;
  const orderId = typeof raw === "string" && UUID_RE.test(raw) ? raw : null;
  const path = orderId ? `/admin/orders/${orderId}` : "/admin/orders";
  const url = new URL(path, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.startsWith(self.location.origin)) {
          if ("navigate" in c && typeof c.navigate === "function") {
            c.navigate(url);
          }
          return c.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    }),
  );
});
