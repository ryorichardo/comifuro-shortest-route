// service-worker.js
const CACHE_NAME = "comifuro-shortest-route";
const ASSETS = [
  "/",
  "/index.html",
  "/libs/html2canvas.js",
  "/libs/papaparse.js",
  "/map_weighted.csv",
  "/style.css",
  "/script.js",
  "/assets/favicon-16x16.png",
  "/assets/favicon-32x32.png",
  "/assets/favicon-180x180.png",
  "/assets/favicon-192x192.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

// Delete old caches on update
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Runtime caching for everything fetched after install
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cachedResp => {
      if (cachedResp) return cachedResp;
      return fetch(event.request)
        .then(response => {
          // clone & store dynamically fetched files (e.g. map.csv updates)
          const cloned = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned));
          return response;
        })
        .catch(() => cachedResp); // fallback to cache when offline
    })
  );
});