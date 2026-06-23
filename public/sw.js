const CACHE_NAME = 'dwarpal-v1.1'
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/dwarpal-icon-192.svg',
  '/dwarpal-icon-512.svg',
  '/favicon.svg'
]

// Install event: cache initial shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  )
})

// Activate event: clean up stale cache versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    }).then(() => self.clients.claim())
  )
})

// Fetch event helper with strategy selection
self.addEventListener('fetch', (event) => {
  const { request } = event

  // Skip non-GET requests immediately
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // 1. API & WebSocket requests: Network-Only bypass
  if (url.pathname.startsWith('/api/') || url.pathname.includes('/socket.io/')) {
    event.respondWith(
      fetch(request).catch(() => new Response(JSON.stringify({ error: 'offline', message: 'You are currently offline.' }), { 
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }))
    )
    return
  }

  // 2. Navigation / Page layout (index.html, manifest.json): Network-First with Cache Fallback
  if (request.mode === 'navigate' || PRECACHE_URLS.includes(url.pathname)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return response
        })
        .catch(() => caches.match(request))
    )
    return
  }

  // 3. Static assets (JS, CSS, Fonts, Images): Cache-First with Network Fallback & update
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch fresh asset in background to update cache asynchronously (Stale-While-Revalidate pattern)
        fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse))
          }
        }).catch(() => { /* ignore background sync errors */ })
        return cachedResponse
      }

      return fetch(request).then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        }
        return response
      })
    })
  )
})

// Push event listener: handle background push notifications
self.addEventListener('push', (event) => {
  let payload = { title: 'DwarPal', body: 'New notification received' }
  
  if (event.data) {
    try {
      payload = event.data.json()
    } catch {
      payload = { title: 'DwarPal', body: event.data.text() }
    }
  }

  const options = {
    body: payload.body || payload.message,
    icon: '/dwarpal-icon-192.svg',
    badge: '/dwarpal-icon-192.svg',
    data: payload.data || {},
    vibrate: [100, 50, 100],
    actions: [
      { action: 'open', title: 'Open DwarPal' }
    ]
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, options)
  )
})

// Notification click event: route to target page
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const relatedRoute = event.notification.data?.relatedRoute || '/'
  const targetUrl = new URL(relatedRoute, self.location.origin).toString()

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Try to find an existing window and focus/navigate it
        for (const client of clientList) {
          if ('focus' in client) {
            // Check if this client is already on the target URL or if we can navigate it
            if (client.url === targetUrl) {
              return client.focus()
            }
            if ('navigate' in client) {
              client.navigate(targetUrl)
              return client.focus()
            }
          }
        }
        // Otherwise open a new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl)
        }
      })
  )
})