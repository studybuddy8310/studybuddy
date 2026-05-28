// StudyBuddy Service Worker
const CACHE_NAME = 'studybuddy-v1';

const CORE_ASSETS = [
  './index.html',
  './css/global.css',
  './css/auth.css',
  './css/student.css',
  './css/admin.css',
  './js/firebase-config.js',
  './js/utils/modal.js',
  './manifest.json',
  './logo.png'
];

// ── Install ──────────────────────────────────────────────────
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(CORE_ASSETS.map(url => cache.add(url).catch(() => {})))
    )
  );
});

// ── Activate: clean old caches ───────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: cache-first for assets, network for Firebase ──────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Always network for Firebase / Google APIs
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('identitytoolkit') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gstatic.com')
  ) return;

  // Cache-first for same-origin static assets
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
