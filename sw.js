// StudyBuddy Service Worker
// ── Bump this version string every deploy to bust the cache ──
const SW_VERSION  = 'studybuddy-v2';
const CACHE_NAME  = SW_VERSION;

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

// ── Install: cache core assets, but do NOT skipWaiting yet ───
// We let the page decide when to activate (so we can show the
// "Update available" banner before taking over).
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(CORE_ASSETS.map(url => cache.add(url).catch(() => {})))
    )
  );
  // Do NOT call self.skipWaiting() here — controlled by SKIP_WAITING message
});

// ── Activate: delete old caches, claim all clients ───────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Message from page: skip waiting and take over immediately ─
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── Fetch: Network-first for HTML/JS/CSS; cache-first for images ─
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Always bypass SW for Firebase / Google APIs
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('identitytoolkit') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gstatic.com')
  ) return;

  // Only handle same-origin GET requests
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;

  const isImage = /\.(png|jpg|jpeg|gif|svg|ico|webp)(\?|$)/i.test(url.pathname);

  if (isImage) {
    // Cache-first for images (rarely change)
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          }
          return response;
        });
      })
    );
  } else {
    // Network-first for HTML, JS, CSS — always get freshest version
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then(cached => {
          if (cached) return cached;
          if (event.request.headers.get('accept')?.includes('text/html'))
            return caches.match('./index.html');
        }))
    );
  }
});
