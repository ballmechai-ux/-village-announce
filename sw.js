const CACHE = 'village-v1';
const SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network-first for this site's own files: always fresh when online,
// falls back to the saved copy when offline. Firebase / LiveKit / Cloudflare are never cached.
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  e.respondWith(
    fetch(r)
      .then(res => {
        if (res.ok && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(r, copy));
        }
        return res;
      })
      .catch(() => caches.match(r).then(m => m || caches.match('./index.html')))
  );
});
