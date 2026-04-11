const CACHE_NAME = 'spendify-v2';
const OFFLINE_URL = 'offline.html';

const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './dashboard.html',
    './offline.html',
    './css/variables.css',
    './css/global.css',
    './css/auth.css',
    './css/dashboard.css',
    './js/config.js',
    './js/utils.js',
    './js/auth.js',
    './js/dashboard.js',
];

// Install Event - Precache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('SW: Precaching static assets');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

// Activate Event - Clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('SW: Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch Event - Network first with cache fallback
self.addEventListener('fetch', (event) => {
    // Skip cross-origin requests, except for fonts
    if (!event.request.url.startsWith(self.location.origin) &&
        !event.request.url.includes('fonts.googleapis.com') &&
        !event.request.url.includes('fonts.gstatic.com')) return;

    // For API requests, use Network First
    if (event.request.url.includes('/api/')) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    // Cache successful GET responses
                    if (response.ok && event.request.method === 'GET') {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    return caches.match(event.request).then((cachedResponse) => {
                        if (cachedResponse) return cachedResponse;
                        // Return failure message if offline and not in cache
                        return new Response(JSON.stringify({
                            success: false,
                            message: 'You are offline. This action will be synced when you return online.'
                        }), {
                            headers: { 'Content-Type': 'application/json' }
                        });
                    });
                })
        );
        return;
    }

    // For navigation requests and static assets, use Cache First with Network Fallback
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;

            return fetch(event.request).catch(() => {
                // If navigation fails (user is offline and page not in cache), show offline page
                if (event.request.mode === 'navigate') {
                    return caches.match(OFFLINE_URL);
                }
            });
        })
    );
});

// Background Sync - Re-trigger sync when back online
self.addEventListener('sync', (event) => {
    console.log('SW: Background Sync triggered', event.tag);
    // Re-sync is actually handled in the client's 'online' listener 
    // but we keep this for PWA standards support
});
