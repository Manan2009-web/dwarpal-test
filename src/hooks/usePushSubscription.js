import { useEffect, useRef } from 'react'

// ---------------------------------------------------------------------------
// urlBase64ToUint8Array — converts a Base64URL VAPID public key to a
// Uint8Array as required by PushManager.subscribe()
// ---------------------------------------------------------------------------
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
}

/**
 * usePushSubscription — subscribes the current user to Web Push notifications.
 *
 * Runs automatically when `currentUser` becomes non-null (i.e. after login).
 * Silently skips if:
 *  - The browser does not support Push / ServiceWorker
 *  - The user denies notification permission
 *  - No VAPID key is available from the backend
 *  - The user is already subscribed on this device
 *
 * @param {object|null} currentUser  — the authenticated user object from App state
 */
export function usePushSubscription(currentUser) {
  // Track whether we have already subscribed in this session to avoid re-running
  const subscribedRef = useRef(false)

  useEffect(() => {
    // Only run when user is authenticated and we have not subscribed yet
    if (!currentUser?.id || subscribedRef.current) return

    // Bail out gracefully if browser APIs are unavailable
    if (
      typeof window === 'undefined' ||
      !('Notification' in window) ||
      !('serviceWorker' in navigator) ||
      !('PushManager' in window)
    ) {
      return
    }

    let cancelled = false

    async function subscribe() {
      try {
        // ----------------------------------------------------------------
        // 1. Request notification permission
        // ----------------------------------------------------------------
        const existingPermission = Notification.permission
        let permission = existingPermission

        if (permission === 'default') {
          permission = await Notification.requestPermission()
        }

        if (permission !== 'granted' || cancelled) return

        // ----------------------------------------------------------------
        // 2. Get the VAPID public key from the backend
        // ----------------------------------------------------------------
        const configRes = await fetch('/api/public/frontend-config', { credentials: 'include' })
        if (!configRes.ok || cancelled) return

        const configData = await configRes.json()
        const vapidPublicKey = configData?.data?.vapidPublicKey || configData?.vapidPublicKey

        if (!vapidPublicKey) {
          // Web push not enabled on this server — silently skip
          return
        }

        // ----------------------------------------------------------------
        // 3. Get the active service worker registration
        // ----------------------------------------------------------------
        const registration = await navigator.serviceWorker.ready
        if (cancelled) return

        // ----------------------------------------------------------------
        // 4. Check if already subscribed on this device
        // ----------------------------------------------------------------
        const existingSubscription = await registration.pushManager.getSubscription()
        let subscription = existingSubscription

        if (!existingSubscription) {
          // ----------------------------------------------------------------
          // 5. Create a new push subscription
          // ----------------------------------------------------------------
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
          })
        }

        if (!subscription || cancelled) return

        // ----------------------------------------------------------------
        // 6. Save the subscription to the backend (upsert by endpoint)
        // ----------------------------------------------------------------
        const subJson = subscription.toJSON()

        const saveRes = await fetch('/api/notifications/subscribe', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: subJson.endpoint,
            keys: {
              p256dh: subJson.keys?.p256dh,
              auth: subJson.keys?.auth
            }
          })
        })

        if (saveRes.ok && !cancelled) {
          subscribedRef.current = true
          console.info('[push] Web push subscription saved successfully.')
        }
      } catch (err) {
        // Push subscription is a non-critical enhancement — never throw
        if (!cancelled) {
          console.warn('[push] Push subscription setup failed (non-critical):', err?.message || err)
        }
      }
    }

    subscribe()

    return () => {
      cancelled = true
    }
  }, [currentUser?.id])
}
