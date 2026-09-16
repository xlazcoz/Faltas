// v2 — network-first: siempre intenta traer la versión más reciente del servidor.
// Solo usa la caché si no hay conexión. Así nunca se queda pillado en una versión vieja.
const CACHE = 'ca-usurbil-v2';
const SHELL = [
    './index.html',
    './faltas.html',
    './horario.html',
    './shared.js',
    './script.js',
    './horario.js',
    './style.css',
    './horario.css',
    './manifest.json'
];

self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
    self.skipWaiting();
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', e => {
    const url = new URL(e.request.url);
    if (url.origin !== self.location.origin) return;

    // Network-first: intenta red primero, cae a caché solo si falla (offline).
    e.respondWith(
        fetch(e.request)
            .then(res => {
                if (res.ok) {
                    const clone = res.clone();
                    caches.open(CACHE).then(c => c.put(e.request, clone));
                }
                return res;
            })
            .catch(() => caches.match(e.request))
    );
});
