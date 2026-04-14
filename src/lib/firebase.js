import { getApp, getApps, initializeApp } from 'firebase/app'
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging'
import { isSecureBrowserContext } from './preferences'

const firebaseConfig = {
  apiKey: String(import.meta.env.VITE_FIREBASE_API_KEY || '').trim(),
  authDomain: String(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '').trim(),
  projectId: String(import.meta.env.VITE_FIREBASE_PROJECT_ID || '').trim(),
  storageBucket: String(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '').trim(),
  messagingSenderId: String(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '').trim(),
  appId: String(import.meta.env.VITE_FIREBASE_APP_ID || '').trim(),
}
const vapidKey = String(import.meta.env.VITE_FIREBASE_VAPID_KEY || '').trim()
let messagingSupportPromise = null

export function isFirebaseMessagingConfigured() {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.projectId &&
      firebaseConfig.messagingSenderId &&
      firebaseConfig.appId &&
      vapidKey,
  )
}

function buildMessagingServiceWorkerUrl() {
  const searchParams = new URLSearchParams()

  Object.entries(firebaseConfig).forEach(([key, value]) => {
    if (value) {
      searchParams.set(key, value)
    }
  })

  return `/firebase-messaging-sw.js?${searchParams.toString()}`
}

function getFirebaseApp() {
  if (getApps().length) {
    return getApp()
  }

  return initializeApp(firebaseConfig)
}

async function isMessagingSupportedInBrowser() {
  if (!messagingSupportPromise) {
    messagingSupportPromise = isSupported().catch(() => false)
  }

  return messagingSupportPromise
}

export async function getFirebaseMessagingContext() {
  if (
    typeof window === 'undefined' ||
    typeof navigator === 'undefined' ||
    !isSecureBrowserContext() ||
    !isFirebaseMessagingConfigured() ||
    !('serviceWorker' in navigator)
  ) {
    return null
  }

  const supported = await isMessagingSupportedInBrowser()

  if (!supported) {
    return null
  }

  const app = getFirebaseApp()

  return {
    app,
    messaging: getMessaging(app),
  }
}

export async function registerFirebaseMessagingServiceWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return null
  }

  return navigator.serviceWorker.register(buildMessagingServiceWorkerUrl(), {
    scope: '/',
  })
}

export async function getFirebaseMessagingToken() {
  const context = await getFirebaseMessagingContext()

  if (!context || typeof window === 'undefined' || window.Notification?.permission !== 'granted') {
    return ''
  }

  const serviceWorkerRegistration = await registerFirebaseMessagingServiceWorker()

  if (!serviceWorkerRegistration) {
    return ''
  }

  return getToken(context.messaging, {
    vapidKey,
    serviceWorkerRegistration,
  })
}

export async function subscribeToForegroundMessages(listener) {
  const context = await getFirebaseMessagingContext()

  if (!context || typeof listener !== 'function') {
    return () => {}
  }

  return onMessage(context.messaging, listener)
}
