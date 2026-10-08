const CACHE = 'drawanything-shell-__BUILD_REVISION__';
const SHELL = ['/app.html', '/brand.svg', '/manifest.webmanifest', /*__PRECACHE__*/];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
  // Wait until older tabs close before retiring the assets they still use.
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => (key.startsWith('nova-shell-') || key.startsWith('drawanything-shell-')) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  const url = new URL(event.request.url);
  if (event.request.mode === 'navigate') {
    // Keep public HTML under its own path; never cache private views or queries.
    const privateRoute = /^\/(projects|boards)(\/|$)/.test(url.pathname) || /^\/share\/?$/.test(url.pathname);
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const response = await fetch(event.request);
        if (!privateRoute && response.ok && response.headers.get('content-type')?.includes('text/html')) await cache.put(url.pathname, response.clone());
        return response;
      } catch {
        return (!privateRoute && await cache.match(url.pathname)) || await cache.match('/app.html');
      }
    })());
    return;
  }
  // Cache only application assets, never arbitrary same-origin requests.
  if (!/^\/(assets|icons|social)\//.test(url.pathname) && !['/brand.svg', '/manifest.webmanifest'].includes(url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(event.request);
    if (cached) return cached;
    const response = await fetch(event.request);
    if (response.ok) await cache.put(event.request, response.clone());
    return response;
  })());
});
