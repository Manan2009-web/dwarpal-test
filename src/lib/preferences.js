export const COOKIE_CONSENT_STORAGE_KEY = 'dwarpal-cookie-consent'
export const NOTIFICATION_PERMISSION_STORAGE_KEY = 'dwarpal-notification-permission'

const COOKIE_CONSENT_VALUES = new Set(['accepted', 'rejected'])
const NOTIFICATION_PERMISSION_VALUES = new Set(['default', 'dismissed', 'granted', 'denied', 'unsupported'])

function isLocalhostHostname(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
}

export function isSecureBrowserContext() {
  if (typeof window === 'undefined') {
    return false
  }

  if (window.isSecureContext) {
    return true
  }

  return isLocalhostHostname(String(window.location?.hostname || '').trim())
}

function readStoredValue(key) {
  if (typeof window === 'undefined') {
    return ''
  }

  try {
    return window.localStorage.getItem(key) || ''
  } catch {
    return ''
  }
}

function writeStoredValue(key, value) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    if (!value) {
      window.localStorage.removeItem(key)
      return
    }

    window.localStorage.setItem(key, String(value))
  } catch {
    // Ignore storage write failures so preference helpers never crash the app shell.
  }
}

export function readCookieConsent() {
  const storedValue = readStoredValue(COOKIE_CONSENT_STORAGE_KEY)
  return COOKIE_CONSENT_VALUES.has(storedValue) ? storedValue : ''
}

export function writeCookieConsent(value) {
  writeStoredValue(COOKIE_CONSENT_STORAGE_KEY, COOKIE_CONSENT_VALUES.has(value) ? value : '')
}

export function isBrowserNotificationSupported() {
  return typeof window !== 'undefined' && 'Notification' in window && isSecureBrowserContext()
}

export function getBrowserNotificationPermission() {
  if (!isBrowserNotificationSupported()) {
    return 'unsupported'
  }

  try {
    return window.Notification.permission || 'default'
  } catch {
    return 'unsupported'
  }
}

export function readNotificationPermissionPreference() {
  const storedValue = readStoredValue(NOTIFICATION_PERMISSION_STORAGE_KEY)
  return NOTIFICATION_PERMISSION_VALUES.has(storedValue) ? storedValue : ''
}

export function writeNotificationPermissionPreference(value) {
  writeStoredValue(
    NOTIFICATION_PERMISSION_STORAGE_KEY,
    NOTIFICATION_PERMISSION_VALUES.has(value) ? value : '',
  )
}

export function getResolvedNotificationPermissionState() {
  const browserPermission = getBrowserNotificationPermission()

  if (browserPermission === 'granted' || browserPermission === 'denied' || browserPermission === 'unsupported') {
    return browserPermission
  }

  return readNotificationPermissionPreference() || 'default'
}
