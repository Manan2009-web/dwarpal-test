/**
 * PushPromptBanner — persistent, dismissible slim banner that asks the user
 * to enable push notifications.
 *
 * Design rules:
 *  - Never auto-requests permission on mount (browsers silently deny those).
 *  - Permission is only requested when the user explicitly clicks "Enable".
 *  - On dismiss, the banner is hidden for the current session (sessionStorage),
 *    so it reappears on the next session but doesn't nag mid-session.
 *  - Only renders when Notification.permission === 'default' (not granted/denied).
 *  - Renders nothing if the browser does not support the Notifications API or
 *    the Service Worker + PushManager APIs required for Web Push.
 */

import { useCallback, useEffect, useState } from 'react'
import { Bell, X } from 'lucide-react'
import { subscribeUserToPush } from '../lib/webPush'

const DISMISSED_KEY = 'dwarpal:push-banner-dismissed'

function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  )
}

/**
 * @param {{ onPermissionChange?: (status: NotificationPermission) => void }} props
 */
export default function PushPromptBanner({ onPermissionChange }) {
  const [visible, setVisible] = useState(false)
  const [subscribing, setSubscribing] = useState(false)

  useEffect(() => {
    if (!isPushSupported()) return
    if (window.Notification.permission !== 'default') return

    try {
      if (sessionStorage.getItem(DISMISSED_KEY) === '1') return
    } catch {
      // sessionStorage unavailable — show the banner anyway
    }

    setVisible(true)
  }, [])

  const handleDismiss = useCallback(() => {
    setVisible(false)
    try {
      sessionStorage.setItem(DISMISSED_KEY, '1')
    } catch {
      // ignore
    }
  }, [])

  const handleEnable = useCallback(async () => {
    if (subscribing) return
    setSubscribing(true)

    try {
      const permission = await window.Notification.requestPermission()
      onPermissionChange?.(permission)

      if (permission === 'granted') {
        // Attempt VAPID subscription in background — failures are non-fatal
        subscribeUserToPush().catch((err) => {
          if (import.meta.env.DEV) {
            console.warn('[PushPromptBanner] VAPID subscribe failed:', err)
          }
        })
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn('[PushPromptBanner] requestPermission failed:', err)
      }
    } finally {
      // Hide the banner regardless of the outcome — the permission state
      // itself (granted/denied/default) is now the source of truth.
      setVisible(false)
      setSubscribing(false)
    }
  }, [onPermissionChange, subscribing])

  if (!visible) return null

  return (
    <div
      className="push-prompt-banner"
      role="banner"
      aria-label="Enable browser notifications"
    >
      <div className="push-prompt-banner-inner">
        <span className="push-prompt-banner-icon" aria-hidden="true">
          <Bell size={16} />
        </span>
        <p className="push-prompt-banner-text">
          <strong>Stay notified</strong> — enable push notifications to receive gatepass approvals,
          rejections, and gate activity even when the tab is closed.
        </p>
        <div className="push-prompt-banner-actions">
          <button
            type="button"
            className="push-prompt-banner-btn push-prompt-banner-btn-enable"
            onClick={handleEnable}
            disabled={subscribing}
            aria-busy={subscribing}
          >
            {subscribing ? 'Enabling…' : 'Enable'}
          </button>
          <button
            type="button"
            className="push-prompt-banner-btn push-prompt-banner-btn-dismiss"
            onClick={handleDismiss}
            aria-label="Dismiss notification banner"
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  )
}
