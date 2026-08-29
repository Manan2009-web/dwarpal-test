const CACHE_NAME = 'dwarpal-v2.1'
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/dwarpal-icon-192.png',
  '/dwarpal-icon-512.png',
  '/dwarpal-badge-96.png'
]

// Install event: skip waiting immediately to activate newest code
self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {}))
  )
})

// Activate event: immediately purge ALL old cache versions
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
  if (request.method !== 'GET') {
    return
  }

  const url = new URL(request.url)

  // 0. Only intercept same-origin requests (prevents adblockers/3rd-party fetch rejection errors like GTM)
  if (url.origin !== self.location.origin) {
    return
  }

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

  // 2. Navigation / Page layout (HTML): Network-First with Cache Fallback
  if (request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => {})
          }
          return response
        })
        .catch(() => caches.match(request))
    )
    return
  }

  // 3. Static assets: Network-First for dynamic Vite hashes with Cache fallback
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => {})
        }
        return networkResponse
      })
      .catch(() => {
        return caches.match(request).then((cached) => cached || Response.error())
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
        icon: parsed.icon || '/dwarpal-icon-192.png',
        badge: parsed.badge || '/dwarpal-badge-96.png',
        tag: parsed.tag || (parsed.data?.gatepassId ? `gatepass-${parsed.data.gatepassId}` : `dwarpal-${Date.now()}`),
        renotify: parsed.renotify !== false,
        requireInteraction: parsed.requireInteraction !== false,
        silent: parsed.silent === true ? true : false,
        vibrate: Array.isArray(parsed.vibrate) ? parsed.vibrate : [200, 100, 200, 100, 200],
        timestamp: parsed.timestamp || Date.now(),
        // actions: cap at 2 (Chrome limit on most platforms)
        actions: Array.isArray(parsed.actions) ? parsed.actions.slice(0, 3) : [],
        data: parsed.data || {}
      }
    } catch {
      payload = {
        title: 'DwarPal',
        body: event.data.text(),
        icon: '/dwarpal-icon-192.png',
        badge: '/dwarpal-badge-96.png',
        tag: `dwarpal-${Date.now()}`,
        renotify: true,
        requireInteraction: true,
        silent: false,
        vibrate: [200, 100, 200, 100, 200],
        timestamp: Date.now(),
        actions: [],
        data: {}
      }
    }
  }

  const options = {
    body: payload.body,
    icon: payload.icon || '/dwarpal-icon-192.png',
    badge: payload.badge || '/dwarpal-badge-96.png',
    tag: payload.tag || `dwarpal-${Date.now()}`,
    renotify: payload.renotify !== false,
    requireInteraction: payload.requireInteraction !== false,
    silent: payload.silent === true,
    vibrate: payload.vibrate || [200, 100, 200, 100, 200],
    timestamp: payload.timestamp || Date.now(),
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