const CACHE_NAME = 'spendify-v4';
const OFFLINE_URL = 'offline.html';

const ASSETS_TO_CACHE = [
    './offline.html',
    './css/variables.css',
    './css/global.css',
    './css/auth.css',
    './css/dashboard.css',
    './css/budget.css',
    './js/config.js',
    './js/utils.js',
    './js/auth.js',
    './js/dashboard.js',
    './js/budget.js',
    './js/chart.min.js',
];

// Install Event - Precache static assets (NOT HTML pages - they use Network First)
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('SW: Precaching static assets');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

// Activate Event - Clean up ALL old caches
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

// Fetch Event
self.addEventListener('fetch', (event) => {
    const url = event.request.url;

    // Skip cross-origin requests (except fonts)
    if (!url.startsWith(self.location.origin) &&
        !url.includes('fonts.googleapis.com') &&
        !url.includes('fonts.gstatic.com')) return;

    // ── API requests: Network First, fallback to cached or offline JSON ──
    if (url.includes('/api/')) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
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

    // ── HTML navigation requests: ALWAYS Network First ──
    // This ensures updated HTML pages are always loaded fresh from server
    if (event.request.mode === 'navigate' ||
        url.endsWith('.html') ||
        url.endsWith('/') ||
        (!url.includes('.') && !url.includes('/api/'))) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    // Update cache with fresh version
                    if (response.ok) {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    // Offline fallback: try cache, then offline page
                    return caches.match(event.request).then((cachedResponse) => {
                        if (cachedResponse) return cachedResponse;
                        return caches.match(OFFLINE_URL);
                    });
                })
        );
        return;
    }

    // ── Static assets (CSS, JS, images): Cache First with Network Fallback ──
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;

            return fetch(event.request).then((response) => {
                if (response.ok) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            }).catch(() => {
                if (event.request.mode === 'navigate') {
                    return caches.match(OFFLINE_URL);
                }
            });
        })
    );
});

// Background Sync
self.addEventListener('sync', (event) => {
    console.log('SW: Background Sync triggered', event.tag);
});
