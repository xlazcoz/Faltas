// v6 — app modular con modelo local-first.
// Network-first: intenta la red y usa la caché solo cuando no hay conexión.
const CACHE = 'mi-curso-v6';
const SHELL = [
    './',
    './index.html',
    './faltas.html',
    './horario.html',
    './examenes.html',
    './calendario.html',
    './ajustes.html',
    './style.css',
    './horario.css',
    './manifest.json',
    './favicon.svg',
    './js/core/model.js',
    './js/core/dates.js',
    './js/core/stats.js',
    './js/core/store.js',
    './js/core/db.js',
    './js/ui/ui.js',
    './js/ui/shell.js',
    './js/ui/forms.js',
    './js/vendor/chart.umd.min.js',
    './js/pages/dashboard.js',
    './js/pages/faltas.js',
    './js/pages/horario.js',
    './js/pages/examenes.js',
    './js/pages/calendario.js',
    './js/pages/ajustes.js'
];

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE).then(c =>
            Promise.all(SHELL.map(url => c.add(url).catch(() => null)))
        )
    );
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
    if (e.request.method !== 'GET') return;

    e.respondWith(
        fetch(e.request)
            .then(res => {
                if (res.ok) {
                    const clone = res.clone();
                    caches.open(CACHE).then(c => c.put(e.request, clone));
                }
                return res;
            })
            .catch(() =>
                caches.match(e.request).then(hit => hit || (e.request.mode === 'navigate' ? caches.match('./index.html') : undefined))
            )
    );
});
