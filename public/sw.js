// Minimal service worker — network-first navigations with an explicit
// /offline fallback for pages and stale-while-revalidate for same-origin
// static assets. Bump CACHE when the shell list changes so old caches roll.

const CACHE = "horizon-shell-v5";
const OFFLINE_URL = "/offline";
const SHELL_URLS = [
  "/",
  "/budget",
  "/budgets",
  "/spending",
  "/accounts",
  "/reflect",
  "/planner",
  "/settings",
  OFFLINE_URL,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // Network-first for navigations, fall back to cached page or /offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() =>
          caches
            .match(req)
            .then((m) => m || caches.match(OFFLINE_URL) || caches.match("/")),
        ),
    );
    return;
  }

  // Stale-while-revalidate for same-origin static assets.
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetchPromise = fetch(req)
          .then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          })
          .catch(() => cached);
        return cached || fetchPromise;
      }),
    );
  }
});
