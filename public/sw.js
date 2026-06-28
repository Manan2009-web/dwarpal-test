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

// Push event listener: handle background push notifications with action buttons
self.addEventListener('push', (event) => {
  let payload = { title: 'DwarPal', body: 'New notification received', actions: [], data: {} }

  if (event.data) {
    try {
      const parsed = event.data.json()
      payload = {
        title: parsed.title || 'DwarPal',
        body: parsed.body || parsed.message || 'You have a new update.',
        icon: parsed.icon || '/dwarpal-icon-192.svg',
        badge: parsed.badge || '/dwarpal-icon-192.svg',
        tag: parsed.tag || 'dwarpal-notification',
        renotify: parsed.renotify !== false,
        requireInteraction: parsed.requireInteraction === true,
        // actions: cap at 2 (Chrome limit on most platforms)
        actions: Array.isArray(parsed.actions) ? parsed.actions.slice(0, 3) : [],
        data: parsed.data || {}
      }
    } catch {
      payload = { title: 'DwarPal', body: event.data.text(), actions: [], data: {} }
    }
  }

  const options = {
    body: payload.body,
    icon: payload.icon || '/dwarpal-icon-192.svg',
    badge: payload.badge || '/dwarpal-icon-192.svg',
    tag: payload.tag || 'dwarpal-notification',
    renotify: payload.renotify,
    requireInteraction: payload.requireInteraction,
    vibrate: [100, 50, 100, 50, 100],
    actions: payload.actions,
    data: {
      ...payload.data,
      // Ensure these keys are always present for notificationclick handler
      gatepassId: payload.data.gatepassId || null,
      passNumber: payload.data.passNumber || null,
      relatedRoute: payload.data.relatedRoute || '/app/notifications'
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, options)
  )
})

// ---------------------------------------------------------------------------
// Notification click handler
//
// Action routing:
//   approve              → background POST /api/gatepasses/:id/approve
//   reject               → background POST /api/gatepasses/:id/reject
//   forward_to_hod       → background POST /api/gatepasses/:id/forward-to-hod
//   forward_to_coordinator → background POST /api/gatepasses/:id/forward-to-coordinator
//   see_qr               → open browser window → relatedRoute
//   (default / body tap) → open/navigate browser window → relatedRoute
// ---------------------------------------------------------------------------

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const action = event.action || ''
  const data = event.notification.data || {}
  const gatepassId = data.gatepassId || null
  const relatedRoute = data.relatedRoute || '/app/notifications'
  const targetUrl = new URL(relatedRoute, self.location.origin).toString()

  // --- Background API actions (approve / reject / forward) ------------------
  const BACKGROUND_ACTIONS = {
    approve:               gatepassId ? `/api/gatepasses/${gatepassId}/approve`               : null,
    reject:                gatepassId ? `/api/gatepasses/${gatepassId}/reject`                : null,
    forward_to_hod:        gatepassId ? `/api/gatepasses/${gatepassId}/forward-to-hod`        : null,
    forward_to_coordinator: gatepassId ? `/api/gatepasses/${gatepassId}/forward-to-coordinator` : null
  }

  const apiPath = BACKGROUND_ACTIONS[action]

  if (apiPath) {
    // Fire background fetch and then open the app to the related route
    event.waitUntil(
      fetch(new URL(apiPath, self.location.origin).toString(), {
        method: 'PATCH',
        credentials: 'include',          // sends the session cookie automatically
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'push_notification_action' })
      })
        .then((res) => {
          if (!res.ok) {
            console.warn(`[sw] Notification action "${action}" returned ${res.status} — user may need to open the app`)
          }
        })
        .catch((err) => {
          console.error(`[sw] Notification action "${action}" fetch failed:`, err)
        })
        .finally(() => openOrFocusWindow(targetUrl))
    )
    return
  }

  // --- See QR / default tap: just open the app window ----------------------
  event.waitUntil(openOrFocusWindow(targetUrl))
})

// Helper: find an existing DwarPal window and navigate it, or open a new one.
function openOrFocusWindow(targetUrl) {
  return self.clients
    .matchAll({ type: 'window', includeUncontrolled: true })
    .then((clientList) => {
      // Try to find an existing window on the same origin
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin)) {
          if ('navigate' in client) {
            client.navigate(targetUrl)
          }
          return client.focus()
        }
      }
      // No existing window — open a new one
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl)
      }
    })
}