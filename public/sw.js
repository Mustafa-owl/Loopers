/* © 2026 NorthPoint Tech. All rights reserved. */
/*
  Erbil Utilities: offline support and alerts.

  Offline: pages and files are kept on the phone, so the site still opens
  when the connection drops during a power cut. The server fills in {{v}}
  with a fingerprint of the files, so a new version replaces the old one by
  itself; nobody has to bump a number.

  Alerts: when the server sends a push message (a planned cut or a
  confirmed outage in a neighbourhood the person follows), we show it, and
  tapping it opens that neighbourhood.
*/
const VERSION = "eu-{{v}}";
const V = "?v={{v}}";
const FILES = [
  "/",
  "/map.html",
  "/areas.html",
  "/area.html",
  "/report.html",
  "/runaki.html",
  "/news.html",
  "/generators.html",
  "/about.html",
  "/privacy.html",
  "/404.html",
  "/assets/css/base.css" + V,
  "/assets/css/layout.css" + V,
  "/assets/css/components.css" + V,
  "/assets/css/home.css" + V,
  "/assets/css/area.css" + V,
  "/assets/css/report.css" + V,
  "/assets/css/runaki.css" + V,
  "/assets/css/news.css" + V,
  "/assets/css/summary.css" + V,
  "/assets/css/about.css" + V,
  "/assets/js/core/errors.js" + V,
  "/assets/js/core/theme.js" + V,
  "/assets/js/core/strings.js" + V,
  "/assets/js/core/i18n.js" + V,
  "/assets/js/core/data.js" + V,
  "/assets/js/core/store.js" + V,
  "/assets/js/core/ui.js" + V,
  "/assets/js/core/alerts.js" + V,
  "/assets/js/core/slides.js" + V,
  "/assets/js/assistant.js" + V,
  "/assets/js/pages/home.js" + V,
  "/assets/js/pages/map.js" + V,
  "/assets/js/pages/areas.js" + V,
  "/assets/js/pages/area.js" + V,
  "/assets/js/pages/report.js" + V,
  "/assets/js/pages/runaki.js" + V,
  "/assets/js/pages/news.js" + V,
  "/assets/js/pages/generators.js" + V,
  "/assets/js/pages/about.js" + V,
  "/assets/js/pages/privacy.js" + V,
  "/assets/fonts/noto-sans-arabic-400.woff2",
  "/assets/fonts/noto-sans-arabic-600.woff2",
  "/assets/fonts/barlow-latin-400-normal.woff2",
  "/assets/fonts/barlow-latin-500-normal.woff2",
  "/assets/fonts/barlow-latin-600-normal.woff2",
  "/assets/fonts/barlow-latin-ext-400-normal.woff2",
  "/assets/fonts/barlow-latin-ext-500-normal.woff2",
  "/assets/fonts/barlow-latin-ext-600-normal.woff2",
  "/assets/fonts/barlow-semi-condensed-latin-700-normal.woff2",
  "/assets/fonts/barlow-semi-condensed-latin-ext-700-normal.woff2",
  "/assets/img/scene-0-wide.webp",
  "/assets/img/scene-0-tall.webp",
  "/assets/img/logo-132.png",
  "/assets/img/favicon-64.png",
  "/manifest.webmanifest",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(VERSION)
      .then((c) => c.addAll(FILES))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return; // map tiles go straight to the network
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/team")) return; // live data and the team page: never kept
  if (url.pathname.startsWith("/assets/js/team/") || url.pathname.startsWith("/photos/")) return;

  // Pages: the network first so people see fresh content, the saved copy if that fails
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match("/"))),
    );
    return;
  }

  // Files: the saved copy first, the network if we don't have it
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && url.search.includes("v=")) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});

/* ---------------- alerts ---------------- */

self.addEventListener("push", (e) => {
  let data = {};
  try {
    data = e.data ? e.data.json() : {};
  } catch (err) {
    data = { title: e.data && e.data.text() };
  }
  e.waitUntil(
    self.registration.showNotification(data.title || "Erbil Utilities", {
      body: data.body || "",
      tag: data.tag,
      renotify: !!data.tag,
      requireInteraction: !!data.urgent, // an urgent message stays until it's seen
      icon: "/assets/img/icon-192.png",
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const target = new URL((e.notification.data && e.notification.data.url) || "/", location.origin);
  if (target.origin !== location.origin) return; // only ever open our own pages
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      const open = wins.find((w) => new URL(w.url).origin === location.origin);
      if (open) return open.navigate(target.href).then((w) => (w || open).focus());
      return self.clients.openWindow(target.href);
    }),
  );
});
