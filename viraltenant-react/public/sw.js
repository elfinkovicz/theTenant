// Service Worker für ViralTenant
const CACHE_NAME = 'viraltenant-v2';
const STATIC_CACHE = 'viraltenant-static-v2';
const API_CACHE = 'viraltenant-api-v2';

// Statische Assets die gecacht werden sollen
const STATIC_ASSETS = [
  '/',
  '/favicon.ico',
  '/favicon.svg',
  '/site.webmanifest'
];

// API Endpoints die gecacht werden sollen (mit Stale-While-Revalidate)
const API_PATTERNS = [
  /\/tenants\/[^/]+\/hero$/,
  /\/tenants\/[^/]+\/newsfeed$/
];

// Install Event - Cache statische Assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate Event - Alte Caches löschen
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== STATIC_CACHE && name !== API_CACHE)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Caching Strategien
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Nur GET Requests cachen
  if (request.method !== 'GET') return;

  // API Requests - Stale-While-Revalidate
  if (API_PATTERNS.some(pattern => pattern.test(url.pathname))) {
    event.respondWith(staleWhileRevalidate(request, API_CACHE));
    return;
  }

  // Statische Assets - Cache First
  if (url.origin === self.location.origin) {
    // JS/CSS Dateien - Cache First mit Network Fallback
    if (/\.(js|css|woff2?)$/.test(url.pathname)) {
      event.respondWith(cacheFirst(request, STATIC_CACHE));
      return;
    }

    // Bilder - Cache First
    if (/\.(png|jpg|jpeg|gif|svg|ico|webp)$/.test(url.pathname)) {
      event.respondWith(cacheFirst(request, STATIC_CACHE));
      return;
    }

    // HTML - Network First (für SPA Navigation)
    if (request.headers.get('accept')?.includes('text/html')) {
      event.respondWith(networkFirst(request, STATIC_CACHE));
      return;
    }
  }
});

// Cache First Strategie
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  
  if (cached) {
    return cached;
  }
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return new Response('Offline', { status: 503 });
  }
}

// Network First Strategie
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    // Fallback für SPA - return index.html
    const indexResponse = await cache.match('/');
    if (indexResponse) {
      return indexResponse;
    }
    return new Response('Offline', { status: 503 });
  }
}

// Stale-While-Revalidate Strategie
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  
  // Fetch im Hintergrund
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);
  
  // Sofort cached Response zurückgeben wenn vorhanden
  if (cached) {
    // Revalidate im Hintergrund
    fetchPromise;
    return cached;
  }
  
  // Warte auf Network wenn kein Cache
  const response = await fetchPromise;
  if (response) {
    return response;
  }
  
  return new Response(JSON.stringify({ error: 'Offline' }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' }
  });
}
