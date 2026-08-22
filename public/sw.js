const CACHE_NAME = 'kck-nedelje-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/kck-logo-rdec-sekundaren.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png'
];

// Install Event - Pre-cache static shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('PWA: Cache addAll partial fallback:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Bypass API/Firestore calls directly to network; cache static shell
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Strictly pass Firestore, Firebase WS, Google Auth, and non-GET requests directly to network
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('securetoken.googleapis.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('firebase') ||
    event.request.method !== 'GET'
  ) {
    return;
  }

  // Navigation requests: Network first with Cache fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/', responseClone));
          }
          return response;
        })
        .catch(() => {
          return caches.match('/') || caches.match('/index.html');
        })
    );
    return;
  }

  // Cache first for static resources with Network fallback & background cache refresh
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
            }
          })
          .catch(() => {/* ignore network failure offline */});
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
        return networkResponse;
      });
    })
  );
});
