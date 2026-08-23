const CACHE_NAME = 'neural-link-v1';

// Assets to cache immediately on installation
const STATIC_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './assets/icons/icon-192.png',
    './assets/icons/icon-512.png'
];

// 1. Install Event - Caches essential core assets
self.addEventListener('install', (event) => {
    console.log('⚡ [Service Worker] Installing Neural Link Service Worker...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('📦 [Service Worker] Pre-caching core app shell');
            return cache.addAll(STATIC_ASSETS);
        }).then(() => self.skipWaiting())
    );
});

// 2. Activate Event - Cleans up old caches if version changes
self.addEventListener('activate', (event) => {
    console.log('🛡️ [Service Worker] Activating Service Worker...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('🧹 [Service Worker] Purging stale cache matrix:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// 3. Fetch Event - Network first with cache fallback
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests or external API calls (e.g., Supabase/FastAPI)
    if (event.request.method !== 'GET') return;
    
    event.respondWith(
        fetch(event.request).catch(() => {
            return caches.match(event.request);
        })
    );
});