// Plotti Service Worker · v5.6 · network-first p/ HTML+JS (fim do cache preso)
const VERSION = 'plotti-v5.6';
const CORE = [
  './',
  './index.html',
  './extras.js',
  './cloud.js',
  './manifest.webmanifest',
  './icons/plotti/plotti-simbolo.svg',
  './icons/plotti/plotti-app-icon-claro.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/apple-touch-icon-167.png',
  './icons/apple-touch-icon-152.png',
  './icons/apple-touch-icon-120.png',
  './icons/favicon-32.png',
  './icons/favicon-16.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((c) =>
      c.addAll(CORE).catch(err => console.warn('[SW] partial precache:', err))
    )
  );
  // Não esperar — substituir imediatamente
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Limpa TODOS os caches antigos
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)));
    // Assume controle imediato de todas as abas abertas
    await self.clients.claim();
    // Avisa todas as abas que há versão nova
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    clients.forEach(c => c.postMessage({ type: 'SW_UPDATED', version: VERSION }));
  })());
});

self.addEventListener('message', (event) => {
  if(event.data && event.data.type === 'SKIP_WAITING'){
    self.skipWaiting();
  }
  if(event.data && event.data.type === 'PURGE_CACHE'){
    event.waitUntil(
      caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
    );
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if(req.method !== 'GET') return;

  const url = new URL(req.url);

  // Cross-origin (fontes, imagens Wikimedia, Google APIs): network preferencial, fallback cache
  if(url.origin !== location.origin){
    event.respondWith(
      fetch(req).then(res => {
        // Cache imagens/fontes pra offline
        const ct = res.headers.get('content-type') || '';
        if(res.ok && (ct.startsWith('image/') || ct.startsWith('font/') || url.pathname.includes('/css'))){
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put(req, copy)).catch(()=>{});
        }
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // HTML — SEMPRE network first; cache só como fallback offline
  if(req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')){
    event.respondWith(
      fetch(req, { cache: 'no-store' }).then(res => {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(req, copy)).catch(()=>{});
        return res;
      }).catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // JS / manifest: SEMPRE network first (atualização imediata a cada deploy);
  // cache só como fallback offline. Acaba com o "preso na versão antiga".
  if(/\.(js|webmanifest)$/i.test(url.pathname)){
    event.respondWith(
      fetch(req, { cache: 'no-store' }).then(res => {
        if(res.ok){ const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)).catch(()=>{}); }
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // Demais estáticos (imagens locais, CSS): cache first com revalidação
  event.respondWith(
    caches.match(req).then(cached => {
      const networkFetch = fetch(req).then(res => {
        if(res.ok){
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put(req, copy)).catch(()=>{});
        }
        return res;
      });
      return cached || networkFetch;
    })
  );
});
