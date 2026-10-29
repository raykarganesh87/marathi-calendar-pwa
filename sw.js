/* Offline support: everything is cached on first visit, so the app (and all calculations) work without internet. */
const CACHE = "mcal-v1";
const FILES = ["./", "index.html", "style.css", "app.js", "worker.js", "engine.js", "render.js", "data.js", "places.js",
  "astronomy.browser.min.js", "manifest.webmanifest", "fonts/NotoSansDevanagari-Regular.woff2", "fonts/NotoSansDevanagari-Bold.woff2",
  "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/apple-touch-icon.png", "icons/favicon-32.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).then((res) => {
    const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {}); return res;
  }).catch(() => caches.match("index.html"))));
});
