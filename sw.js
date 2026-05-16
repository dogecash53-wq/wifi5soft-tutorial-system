const CACHE_NAME = 'wifi5soft-v1.0.0';
const OFFLINE_URL = '/offline.html';

// Get the base path for GitHub Pages
const getBasePath = () => {
    const path = window.location.pathname;
    const basePath = path.substring(0, path.lastIndexOf('/'));
    return basePath || '';
};

const BASE_PATH = getBasePath();

// Assets to cache
const PRECACHE_ASSETS = [
  `${BASE_PATH}/`,
  `${BASE_PATH}/index.html`,
  `${BASE_PATH}/css/style.css`,
  `${BASE_PATH}/offline.html`,
  `${BASE_PATH}/images/logo.png`
];

// Install event
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching core assets');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .catch((error) => {
        console.error('[Service Worker] Cache failed:', error);
      })
  );
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(self.clients.claim());
});

// Fetch event
self.addEventListener('fetch', (event) => {
  // Skip Firebase and external APIs
  const url = event.request.url;
  if (url.includes('firebase') || url.includes('googleapis') || url.includes('cloudinary')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
      .catch(() => {
        if (event.request.headers.get('accept').includes('text/html')) {
          return caches.match(OFFLINE_URL);
        }
        return new Response('Offline', { status: 503 });
      })
  );
});