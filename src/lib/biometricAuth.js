import {
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
  startAuthentication,
  startRegistration,
} from '@simplewebauthn/browser'

function isLocalhostLike() {
  if (typeof window === 'undefined') return false

  const host = window.location.hostname
  return host === 'localhost' || host === '127.0.0.1' || host === '::1'
}

function getBiometricModeAvailability() {
  if (typeof window === 'undefined') {
    return {
      fingerprint: false,
      face: false,
    }
  }

  const userAgent = String(window.navigator?.userAgent || '').toLowerCase()
  const isIPhone = /iphone/.test(userAgent)
  const isMacDesktop = /macintosh|mac os x/.test(userAgent) && !/iphone|ipad/.test(userAgent)

  // WebAuthn triggers a shared platform prompt, so these mode flags are best-effort UI hints.
  if (isIPhone) {
    return {
      fingerprint: false,
      face: true,
    }
  }

  if (isMacDesktop) {
    return {
      fingerprint: true,
      face: false,
    }
  }

  return {
    fingerprint: true,
    face: true,
  }
}

export async function detectBiometricSupport() {
  if (typeof window === 'undefined') {
    return {
      supported: false,
      message: 'Biometric login is not available outside the browser.',
      platformAuthenticatorAvailable: false,
      modes: {
        fingerprint: { supported: false },
        face: { supported: false },
      },
    }
  }

  if (!window.isSecureContext && !isLocalhostLike()) {
    return {
      supported: false,
      message: 'Biometric login requires HTTPS or localhost.',
      platformAuthenticatorAvailable: false,
      modes: {
        fingerprint: { supported: false },
        face: { supported: false },
      },
    }
  }

  if (!browserSupportsWebAuthn()) {
    return {
      supported: false,
      message: 'This device/browser does not support biometric login.',
      platformAuthenticatorAvailable: false,
      modes: {
        fingerprint: { supported: false },
        face: { supported: false },
      },
    }
  }

  try {
    const platformAuthenticatorAvailable = await platformAuthenticatorIsAvailable()

    if (!platformAuthenticatorAvailable) {
      return {
        supported: false,
        message: 'This device/browser does not have a platform biometric authenticator available.',
        platformAuthenticatorAvailable,
        modes: {
          fingerprint: { supported: false },
          face: { supported: false },
        },
      }
    }

    const modeAvailability = getBiometricModeAvailability()
    const modes = {
      fingerprint: { supported: Boolean(modeAvailability.fingerprint) },
      face: { supported: Boolean(modeAvailability.face) },
    }
    const unavailableModes = Object.entries(modes)
      .filter(([, value]) => !value.supported)
      .map(([key]) => (key === 'fingerprint' ? 'Fingerprint login' : 'Face recognition'))
    const message =
      unavailableModes.length === 0
        ? ''
        : unavailableModes.length === 2
          ? 'Biometric login is not available on this device.'
          : `${unavailableModes[0]} is not available on this device.`

    return {
      supported: Object.values(modes).some((mode) => mode.supported),
      message,
      platformAuthenticatorAvailable,
      modes,
    }
  } catch {
    return {
      supported: false,
      message: 'Unable to confirm biometric support on this device/browser.',
      platformAuthenticatorAvailable: false,
      modes: {
        fingerprint: { supported: false },
        face: { supported: false },
      },
    }
  }
}

export async function beginBiometricRegistration(optionsJSON) {
  return startRegistration({ optionsJSON })
}

export async function beginBiometricAuthentication(optionsJSON) {
  return startAuthentication({ optionsJSON })
}

export function getBiometricErrorMessage(error, mode = 'login') {
  const fallbackMessage =
    mode === 'setup'
      ? 'Biometric setup could not be completed. Please try again.'
      : 'Biometric verification failed. Please try again or use manual login.'

  const errorName = String(error?.name || '')
  const errorMessage = String(error?.message || '').trim()

  if (errorName === 'NotAllowedError') {
    return mode === 'setup'
      ? 'Biometric setup was cancelled before completion.'
      : 'Biometric verification was cancelled or timed out.'
  }

  if (errorName === 'InvalidStateError') {
    return mode === 'setup'
      ? 'This biometric credential is already registered on this device.'
      : 'No biometric credential was available for this login attempt.'
  }

  if (/secure context|https|localhost/i.test(errorMessage)) {
    return 'Biometric login requires HTTPS or localhost.'
  }

  if (/passkey|credential|authenticator/i.test(errorMessage)) {
    return errorMessage
  }

  return fallbackMessage
}
