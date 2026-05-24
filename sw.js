// StudyBuddy Service Worker
// Version is auto-controlled via version.json — no manual bumping needed.
const CACHE_BASE = 'studybuddy';
const CACHE_NAME = 'studybuddy-v1';

async function getLocalVersion() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const res   = await cache.match('./version.json');
    if (!res) return null;
    const data  = await res.json();
    return data.version || null;
  } catch { return null; }
}

// ── Install ──────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      const core = [
        './index.html','./css/global.css','./css/auth.css',
        './css/student.css','./css/admin.css',
        './js/firebase-config.js','./js/utils/modal.js',
        './manifest.json','./logo.png','./version.json'
      ];
      return Promise.allSettled(core.map(url => cache.add(url).catch(() => {})));
    })
  );
});

// ── Activate ─────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k.startsWith(CACHE_BASE) && k !== CACHE_NAME)
            .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Message: skip waiting on demand ─────────────────────────
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// ── Fetch ────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Always network for Firebase
  if (url.hostname.includes('firestore.googleapis.com') ||
      url.hostname.includes('firebase') ||
      url.hostname.includes('identitytoolkit') ||
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('gstatic.com')) return;

  // version.json: always fresh, check for update
  if (url.pathname.endsWith('version.json')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then(async networkRes => {
          const clone = networkRes.clone();
          const data  = await networkRes.json();
          const local = await getLocalVersion();
          if (local && data.version && data.version !== local) {
            const clients = await self.clients.matchAll({ includeUncontrolled: true });
            clients.forEach(c => c.postMessage({ type: 'UPDATE_AVAILABLE', version: data.version }));
          }
          const cache = await caches.open(CACHE_NAME);
          cache.put(event.request, clone);
          return networkRes.clone();
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for all other assets
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok && event.request.method === 'GET' && url.origin === self.location.origin) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        if (event.request.headers.get('accept')?.includes('text/html'))
          return caches.match('./index.html');
      });
    })
  );
});
