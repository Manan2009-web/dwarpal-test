import { getApp, getApps, initializeApp } from 'firebase/app'
import { getAnalytics, isSupported } from 'firebase/analytics'
import {
  RecaptchaVerifier,
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signOut,
} from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyAjF_7ttuUMkzDU8_TgUgU3jZU4OLqJQf0',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'dwarpal-c4843.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'dwarpal-c4843',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'dwarpal-c4843.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '492616305801',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:492616305801:web:5736516f275b80d9bcca58',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-6L3SMHMLSQ',
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig)
const auth = getAuth(app)

export let analytics = null

if (typeof window !== 'undefined') {
  void isSupported()
    .then((supported) => {
      if (supported) {
        analytics = getAnalytics(app)
      }
    })
    .catch(() => {
      analytics = null
    })
}

const FIREBASE_AUTH_ERROR_MESSAGES = {
  'auth/email-already-in-use': 'This email address is already in use. Please sign in instead.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/weak-password': 'Password is too weak. Please use at least 6 characters.',
  'auth/user-not-found': 'No account was found for this email address.',
  'auth/wrong-password': 'Incorrect password. Please try again.',
  'auth/invalid-credential': 'Email or password is incorrect. Please try again.',
  'auth/user-disabled': 'This account has been disabled. Please contact support.',
  'auth/too-many-requests': 'Too many attempts were made. Please wait a moment and try again.',
  'auth/network-request-failed': 'Firebase could not be reached. Please check your internet connection and try again.',
  'auth/requires-recent-login': 'Please sign in again before retrying this action.',
  'auth/operation-not-allowed': 'This authentication method is not enabled in Firebase for this project.',
  'auth/invalid-verification-code': 'Invalid OTP. Please try again.',
  'auth/code-expired': 'OTP expired. Please request a new one.',
  'auth/missing-phone-number': 'Please enter a phone number.',
  'auth/invalid-phone-number': 'Please enter a valid phone number.',
  'auth/missing-verification-code': 'Please enter the OTP code.',
  'auth/captcha-check-failed': 'reCAPTCHA verification failed. Please try again.',
  'auth/argument-error': 'Invalid authentication request. Please try again.',
}

export function getFirebaseAuthErrorMessage(
  error,
  fallbackMessage = 'Authentication failed. Please try again.',
) {
  const errorCode = String(error?.code || '').trim()

  if (errorCode && FIREBASE_AUTH_ERROR_MESSAGES[errorCode]) {
    return FIREBASE_AUTH_ERROR_MESSAGES[errorCode]
  }

  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message
  }

  return fallbackMessage
}

export function createFirebaseUser(email, password) {
  return createUserWithEmailAndPassword(auth, String(email || '').trim(), password)
}

export function signInFirebaseUser(email, password) {
  return signInWithEmailAndPassword(auth, String(email || '').trim(), password)
}

export async function rollbackFirebaseUser(user) {
  if (!user) {
    return { ok: true }
  }

  try {
    await deleteUser(user)
    return { ok: true }
  } catch (error) {
    try {
      await signOut(auth)
    } catch {
      // ignore cleanup failure
    }

    return {
      ok: false,
      error,
    }
  }
}

export function signOutFirebaseUser() {
  return signOut(auth)
}

function normalizeIndianPhoneNumber(phone) {
  const raw = String(phone || '').replace(/\D/g, '')

  if (!raw) {
    throw new Error('Please enter a phone number.')
  }

  if (raw.length === 10) {
    return `+91${raw}`
  }

  if (raw.length === 12 && raw.startsWith('91')) {
    return `+${raw}`
  }

  if (raw.length === 13 && raw.startsWith('091')) {
    return `+${raw.slice(1)}`
  }

  throw new Error('Please enter a valid 10-digit Indian phone number.')
}

export function setupRecaptcha(containerId = 'recaptcha-container') {
  if (typeof window === 'undefined') {
    throw new Error('reCAPTCHA can only be used in the browser.')
  }

  const container = document.getElementById(containerId)
  if (!container) {
    throw new Error(`reCAPTCHA container not found: #${containerId}`)
  }

  if (window.recaptchaVerifier) {
    return window.recaptchaVerifier
  }

  window.recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
    size: 'normal',
    callback: () => {
      // reCAPTCHA solved
    },
    'expired-callback': () => {
      if (window.recaptchaVerifier) {
        try {
          window.recaptchaVerifier.clear()
        } catch {
          // ignore clear failure
        }
        window.recaptchaVerifier = null
      }
    },
  })

  return window.recaptchaVerifier
}

export async function sendPhoneOtp(phone, containerId = 'recaptcha-container') {
  const fullPhoneNumber = normalizeIndianPhoneNumber(phone)
  const appVerifier = setupRecaptcha(containerId)

  const confirmationResult = await signInWithPhoneNumber(auth, fullPhoneNumber, appVerifier)
  window.confirmationResult = confirmationResult

  return confirmationResult
}

export async function verifyPhoneOtp(code) {
  if (!window.confirmationResult) {
    throw new Error('OTP session not found. Please send OTP first.')
  }

  const otp = String(code || '').trim()
  if (!otp) {
    throw new Error('Please enter OTP.')
  }

  return window.confirmationResult.confirm(otp)
}

export function clearPhoneOtpSession() {
  if (typeof window !== 'undefined') {
    if (window.recaptchaVerifier) {
      try {
        window.recaptchaVerifier.clear()
      } catch {
        // ignore clear failure
      }
    }

    window.recaptchaVerifier = null
    window.confirmationResult = null
  }
}

export { app, auth }
