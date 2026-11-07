const CACHE = 'village-v4';
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

// Network-first with a 3-second limit: fresh files when the network is good,
// the saved copy when it is slow or offline. Firebase / LiveKit / Cloudflare are never cached.
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  const fromNet = fetch(r).then(res => {
    if (res.ok && res.status === 200) {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(r, copy));
    }
    return res;
  });
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), 3000));
  e.respondWith(
    Promise.race([fromNet, timeout])
      .catch(() => caches.match(r).then(m => m || fromNet.catch(() => caches.match('./index.html'))))
  );
});

// Push notifications (sent by the Cloudflare Worker through Firebase Cloud Messaging)
self.addEventListener('push', e => {
  let d = {};
  try {
    const p = e.data ? e.data.json() : {};
    d = p.data || p.notification || p || {};
  } catch (_) {}
  const isCmp = String(d.tag || '').startsWith('cmp-');
  const title = isCmp ? '📣 มีแจ้งจากลูกบ้าน' : (d.title || 'ประกาศหมู่บ้าน');
  e.waitUntil(self.registration.showNotification(title, {
    body: d.body || '',
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    tag: d.tag || 'village',
    renotify: true,
    requireInteraction: isCmp,
    vibrate: isCmp ? [400, 200, 400, 200, 800] : [200, 100, 200],
    data: { url: d.url || './' }
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
      for (const c of cs) {
        if (c.url.startsWith(self.registration.scope) && 'focus' in c) {
          return c.focus().then(w => (w && 'navigate' in w) ? w.navigate(url) : w);
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
