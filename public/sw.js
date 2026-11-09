// O push do OneSignal roda neste mesmo worker. Se a CDN falhar, o modo offline continua funcionando.
try { importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js'); } catch { /* sem push nesta instalação */ }

// Páginas: rede primeiro, para a edição nova aparecer. Arquivos do site: cache. Fotos externas: sempre rede.
const VERSION = 'sync-news-v1';
const BASE = new URL('./', self.location).pathname;
const SHELL = [BASE, `${BASE}offline/`, `${BASE}manifest.webmanifest`, `${BASE}icons/icon-192.png`];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Respostas redirecionadas não podem ser reusadas em navegações.
async function storable(res) {
  if (!res.redirected) return res.clone();
  return new Response(await res.clone().blob(), { status: res.status, headers: res.headers });
}

async function networkFirst(req) {
  const cache = await caches.open(VERSION);
  try {
    const res = await fetch(req);
    if (res.ok) await cache.put(req.url, await storable(res));
    return res;
  } catch {
    return (await cache.match(req.url)) ?? (await cache.match(`${BASE}offline/`)) ?? Response.error();
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req);
  const update = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; });
  if (hit) { update.catch(() => {}); return hit; }
  return update;
}

self.addEventListener('fetch', (e) => {
  const { request: req } = e;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (FONT_HOSTS.includes(url.hostname)) { e.respondWith(staleWhileRevalidate(req)); return; }
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;
  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) { e.respondWith(networkFirst(req)); return; }
  e.respondWith(staleWhileRevalidate(req));
});
