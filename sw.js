// StudyBuddy Service Worker
const CACHE_NAME = 'studybuddy-v1';

// Files to cache for offline shell
const PRECACHE = [
  '/',
  '/index.html',
  '/css/global.css',
  '/css/auth.css',
  '/css/student.css',
  '/css/admin.css',
  '/js/firebase-config.js',
  '/js/utils/modal.js',
  '/js/utils/email.js',
  '/manifest.json',
  '/logo.png',
  '/assets/images/icons/home6.png',
  '/assets/images/icons/home9.png',
  '/assets/images/icons/home10.png',
  '/assets/images/icons/quick.png',
  '/assets/images/icons/revision.png',
  '/assets/images/icons/answer.png',
  '/assets/images/icons/cac.png'
];

// ── Install: precache shell ──────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

// ── Activate: clean old caches ───────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: network-first for Firebase, cache-first for assets ─
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Always go network for Firebase / auth / API calls
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('identitytoolkit') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gstatic.com')
  ) {
    return; // let browser handle normally
  }

  // Cache-first for same-origin static assets
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Cache successful GET responses for same origin
        if (
          response.ok &&
          event.request.method === 'GET' &&
          url.origin === self.location.origin
        ) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback for HTML pages
        if (event.request.headers.get('accept').includes('text/html')) {
          return caches.match('/index.html');
        }
      });
    })
  );
});
