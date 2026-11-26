// Thay Fam: mở như app, hiện ngay bản đã lưu (không chờ mạng), tải bản mới ở nền.
// Dữ liệu (Apps Script / Supabase) KHÔNG cache ở đây — trang tự lưu bản chụp dữ liệu trong localStorage.
const C = 'thayfam-v1';
self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(C).then((c) => c.addAll(['/thayfam/', 'https://cdn.jsdelivr.net/npm/alpinejs@3.14.1/dist/cdn.min.js']).catch(() => {}))); });
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET') return;
  const page = r.mode === 'navigate' && (u.pathname === '/thayfam/' || u.pathname === '/thayfam/index.html');
  const asset = /cdn\.jsdelivr\.net\/npm\/alpinejs|\/thayfam\/(icon|img\/)|\/appnav\.js/.test(r.url);
  if (!page && !asset) return;
  const key = page ? '/thayfam/' : r;
  e.respondWith(caches.open(C).then(async (c) => {
    const old = await c.match(key);
    const fresh = fetch(r).then(async (res) => {
      if (res.ok) {
        if (page && old) {   // báo trang khi có bản mới
          const [a, b] = await Promise.all([old.clone().text(), res.clone().text()]);
          if (a !== b) (await self.clients.matchAll()).forEach((cl) => cl.postMessage('tf-update'));
        }
        await c.put(key, res.clone());
      }
      return res;
    }).catch(() => old);
    return old || fresh;
  }));
});
