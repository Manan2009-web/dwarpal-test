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
import { Bell, HelpCircle, Share2, Smartphone, X } from 'lucide-react'
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

function isIosDevice() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

function isStandaloneMode() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  )
}

/**
 * @param {{ onPermissionChange?: (status: NotificationPermission) => void }} props
 */
export default function PushPromptBanner({ onPermissionChange }) {
  const [visible, setVisible] = useState(false)
  const [subscribing, setSubscribing] = useState(false)
  const [showIosGuide, setShowIosGuide] = useState(false)
  const isIos = isIosDevice()
  const isStandalone = isStandaloneMode()

  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISMISSED_KEY) === '1') return
    } catch {
      // sessionStorage unavailable — show the banner anyway
    }

    if (isPushSupported()) {
      if (window.Notification.permission === 'default') {
        setVisible(true)
      }
    } else if (isIos && !isStandalone) {
      // iOS Safari browser tab — needs to be added to Home Screen first for Web Push
      setVisible(true)
    }
  }, [isIos, isStandalone])

  const handleDismiss = useCallback(() => {
    setVisible(false)
    setShowIosGuide(false)
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

  // iOS Safari in-browser guidance
  if (isIos && !isStandalone) {
    return (
      <div
        className="push-prompt-banner"
        role="banner"
        aria-label="iPhone notifications guidance"
      >
        <div className="push-prompt-banner-inner">
          <span className="push-prompt-banner-icon" aria-hidden="true">
            <Smartphone size={16} />
          </span>
          <p className="push-prompt-banner-text">
            <strong>Phone Notifications:</strong> On iPhone, tap <strong>Share</strong> (<Share2 size={13} style={{ display: 'inline', verticalAlign: 'middle' }} />) then <strong>'Add to Home Screen'</strong> to enable instant lock-screen notifications.
          </p>
          <div className="push-prompt-banner-actions">
            <button
              type="button"
              className="push-prompt-banner-btn push-prompt-banner-btn-enable"
              onClick={() => setShowIosGuide((prev) => !prev)}
            >
              <HelpCircle size={14} style={{ marginRight: 4 }} />
              {showIosGuide ? 'Hide Steps' : 'View Steps'}
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

        {showIosGuide ? (
          <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.6rem 1rem', fontSize: '0.8rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <div><strong>Step 1:</strong> Tap the Safari <strong>Share button</strong> at the bottom of the screen.</div>
              <div><strong>Step 2:</strong> Scroll down and select <strong>'Add to Home Screen'</strong>.</div>
              <div><strong>Step 3:</strong> Open <strong>DwarPal</strong> from your Home Screen and tap <strong>'Enable Notifications'</strong>.</div>
            </div>
          </div>
        ) : null}
      </div>
    )
  }

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
          <strong>Stay notified on phone & desktop</strong> — enable push notifications to receive gatepass approvals,
          rejections, and campus updates even when DwarPal is closed.
        </p>
        <div className="push-prompt-banner-actions">
          <button
            type="button"
            className="push-prompt-banner-btn push-prompt-banner-btn-enable"
            onClick={handleEnable}
            disabled={subscribing}
            aria-busy={subscribing}
          >
            {subscribing ? 'Enabling…' : 'Enable Notifications'}
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
