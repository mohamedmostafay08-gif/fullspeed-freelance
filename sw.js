// Network-first so every deploy shows up immediately; the cache only serves when offline.
const CACHE = 'fsp-v2';
const SHELL = ['/', '/index.html', '/app.css', '/app.js', '/shared/common.css', '/shared/common.js', '/shared/config.js', '/brand/fs-mark.png', '/brand/fs-logo.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req).then((hit) => hit || (req.mode === 'navigate' ? caches.match('/index.html') : Response.error()))));
});

// Web push from the `push` edge function: { title, body, link, tag }
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Full Speed', {
    body: d.body || '', tag: d.tag, icon: '/brand/fs-icon-192.png', badge: '/brand/fs-icon-192.png',
    dir: 'rtl', lang: 'ar', data: { link: d.link || '' },
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = '/?go=' + encodeURIComponent(e.notification.data?.link || 'home');
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
    const c = cs.find((x) => new URL(x.url).origin === location.origin && !x.url.includes('/admin'));
    if (c) { c.navigate(url).catch(() => {}); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
