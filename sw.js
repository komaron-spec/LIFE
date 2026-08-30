const CACHE = "life-system-v87";
const ASSETS = ["./", "./index.html", "./styles.css", "./core-overrides.css", "./app.js", "./atlas-data.js", "./skills-data.js", "./assets/world-core-glass-shell.png", "./assets/world-core-night-sky.png", "./assets/world-core-moon-texture.png", "./assets/audio/celebration-event.mp3", "./assets/audio/rain-field.mp3", "./assets/audio/meal-phase.mp3", "./assets/audio/campus-day.mp3", "./assets/audio/christmas-world.mp3", "./assets/audio/morning-field-entry.mp3", "./assets/audio/home-deep-night.mp3", "./assets/audio/home-morning.mp3", "./assets/audio/home-night.mp3", "./manifest.webmanifest", "./icons/icon.svg"];
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
self.addEventListener("message", (event) => { if (event.data?.type === "life-notify") self.registration.showNotification(event.data.title, event.data.options); });
self.addEventListener("notificationclick", (event) => { event.notification.close(); event.waitUntil(clients.matchAll({ type:"window", includeUncontrolled:true }).then((windows) => windows.length ? windows[0].focus() : clients.openWindow("./"))); });
