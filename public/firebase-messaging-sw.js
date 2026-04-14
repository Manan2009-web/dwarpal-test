/* global firebase, importScripts */

(function initializeMessagingWorker() {
  const searchParams = new URL(self.location.href).searchParams
  const firebaseConfig = {
    apiKey: searchParams.get('apiKey') || '',
    authDomain: searchParams.get('authDomain') || '',
    projectId: searchParams.get('projectId') || '',
    storageBucket: searchParams.get('storageBucket') || '',
    messagingSenderId: searchParams.get('messagingSenderId') || '',
    appId: searchParams.get('appId') || '',
  }
  const hasRequiredConfig =
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.messagingSenderId &&
    firebaseConfig.appId

  if (!hasRequiredConfig) {
    return
  }

  try {
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
