import { subscribeWebPushNotification, buildApiUrl } from './dwarpalApi'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let index = 0; index < rawData.length; ++index) {
    outputArray[index] = rawData.charCodeAt(index)
  }
  return outputArray
}

export async function getVapidPublicKey() {
  const url = buildApiUrl('/public/frontend-config')
  const response = await fetch(url, {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error('Failed to fetch public VAPID key')
  }

  const payload = await response.json()
  return payload?.data?.vapidPublicKey
}

export async function subscribeUserToPush() {
  if (
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window)
  ) {
    console.warn('Web push not supported on this browser')
    return null
  }

  try {
    const registration = await navigator.serviceWorker.ready

    const vapidPublicKey = await getVapidPublicKey()
    if (!vapidPublicKey) {
      console.warn('VAPID public key not configured on backend')
      return null
    }

    let subscription = await registration.pushManager.getSubscription()

    if (!subscription) {
      try {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        })
      } catch (subErr) {
        console.warn('Initial push subscription failed, attempting recovery:', subErr)
        // If an existing broken subscription is present, try unsubscribing first
        const existing = await registration.pushManager.getSubscription().catch(() => null)
        if (existing) {
          await existing.unsubscribe().catch(() => {})
        }
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        })
      }
    }

    if (subscription) {
      const subscriptionJson = subscription.toJSON()
      if (subscriptionJson?.endpoint && subscriptionJson?.keys) {
        await subscribeWebPushNotification({
          endpoint: subscriptionJson.endpoint,
          keys: {
            p256dh: subscriptionJson.keys.p256dh,
            auth: subscriptionJson.keys.auth,
          },
        }).catch((apiErr) => {
          console.warn('Push subscription sync to backend failed:', apiErr)
        })
      }
    }

    return subscription
  } catch (error) {
    console.warn('[webPush] Subscription error:', error)
    return null
  }
}
