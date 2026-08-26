const CACHE = "life-system-v21";
const ASSETS = ["./", "./index.html", "./styles.css", "./app.js", "./atlas-data.js", "./skills-data.js", "./manifest.webmanifest", "./icons/icon.svg"];
self.addEventListener("install", (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener("activate", (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const isAppFile = new URL(event.request.url).origin === location.origin;
  event.respondWith(fetch(event.request).then((response) => {
    if (isAppFile && response.ok) caches.open(CACHE).then((cache) => cache.put(event.request, response.clone()));
    return response;
  }).catch(() => caches.match(event.request)));
});
