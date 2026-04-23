/* global firebase, importScripts */

(function initializeMessagingWorker() {
  const PUBLIC_FRONTEND_CONFIG_URL = '/api/public/frontend-config'

  function normalizeFirebaseConfig(payload) {
    const firebaseConfig = payload?.data?.firebase

    if (!firebaseConfig || typeof firebaseConfig !== 'object') {
      return null
    }

    const normalizedConfig = {
      apiKey: String(firebaseConfig.apiKey || '').trim(),
      authDomain: String(firebaseConfig.authDomain || '').trim(),
      projectId: String(firebaseConfig.projectId || '').trim(),
      storageBucket: String(firebaseConfig.storageBucket || '').trim(),
      messagingSenderId: String(firebaseConfig.messagingSenderId || '').trim(),
      appId: String(firebaseConfig.appId || '').trim(),
    }
    const hasRequiredConfig =
      normalizedConfig.apiKey &&
      normalizedConfig.authDomain &&
      normalizedConfig.projectId &&
      normalizedConfig.storageBucket &&
      normalizedConfig.messagingSenderId &&
      normalizedConfig.appId

    return hasRequiredConfig ? normalizedConfig : null
  }

  async function fetchFirebaseConfig() {
    const response = await fetch(PUBLIC_FRONTEND_CONFIG_URL, {
      method: 'GET',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      return null
    }

    let payload = null

    try {
      payload = await response.json()
    } catch {
      return null
    }

    return normalizeFirebaseConfig(payload)
  }

  ;(async () => {
    try {
      const firebaseConfig = await fetchFirebaseConfig()

      if (!firebaseConfig) {
        return
      }

      importScripts('https://www.gstatic.com/firebasejs/11.0.2/firebase-app-compat.js')
      importScripts('https://www.gstatic.com/firebasejs/11.0.2/firebase-messaging-compat.js')

      if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig)
      }

      const messaging = firebase.messaging()

      messaging.onBackgroundMessage((payload) => {
        const data = payload?.data || {}
        const title = data.title || 'DwarPal update'
        const body = data.message || 'You have a new DwarPal notification.'

        self.registration.showNotification(title, {
          body,
          icon: '/dwarpal-favicon.png',
          badge: '/dwarpal-favicon.png',
          tag: data.notificationId || data.referenceId || title,
          data,
        })
      })
    } catch (error) {
      console.error('[firebase-messaging-sw] Unable to initialize background messaging.', error)
    }
  })()
})()

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const notificationData = event.notification?.data || {}
  const targetUrl = notificationData.link || notificationData.relatedRoute || '/app/notifications'

  event.waitUntil(
    (async () => {
      const absoluteTargetUrl = new URL(targetUrl, self.location.origin).toString()
      const windowClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })

      for (const client of windowClients) {
        if (!client.url.startsWith(self.location.origin)) {
          continue
        }

        await client.focus()

        if ('navigate' in client) {
          await client.navigate(absoluteTargetUrl)
        }

        return
      }

      if (self.clients.openWindow) {
        await self.clients.openWindow(absoluteTargetUrl)
      }
    })(),
  )
})
