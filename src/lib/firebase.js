import { getApp, getApps, initializeApp } from 'firebase/app'
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging'
import { buildApiUrl } from './dwarpalApi'
import { isSecureBrowserContext } from './preferences'

const PUBLIC_FRONTEND_CONFIG_PATH = '/public/frontend-config'
let messagingSupportPromise = null
let publicFirebaseConfigPromise = null

function buildPublicFrontendConfigUrl() {
  return buildApiUrl(PUBLIC_FRONTEND_CONFIG_PATH)
}

function normalizePublicFirebaseConfig(payload = null) {
  const data = payload?.data
  const firebase = data?.firebase

  if (!firebase || typeof firebase !== 'object') {
    return null
  }

  const normalizedFirebaseConfig = {
    apiKey: String(firebase.apiKey || '').trim(),
    authDomain: String(firebase.authDomain || '').trim(),
    projectId: String(firebase.projectId || '').trim(),
    storageBucket: String(firebase.storageBucket || '').trim(),
    messagingSenderId: String(firebase.messagingSenderId || '').trim(),
    appId: String(firebase.appId || '').trim(),
  }
  const vapidKey = String(firebase.vapidKey || '').trim()

  if (
    !normalizedFirebaseConfig.apiKey ||
    !normalizedFirebaseConfig.authDomain ||
    !normalizedFirebaseConfig.projectId ||
    !normalizedFirebaseConfig.storageBucket ||
    !normalizedFirebaseConfig.messagingSenderId ||
    !normalizedFirebaseConfig.appId ||
    !vapidKey
  ) {
    return null
  }

  return {
    firebaseConfig: normalizedFirebaseConfig,
    vapidKey,
  }
}

async function fetchPublicFirebaseConfig() {
  const response = await fetch(buildPublicFrontendConfigUrl(), {
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

  return normalizePublicFirebaseConfig(payload)
}

async function getPublicFirebaseConfig() {
  if (!publicFirebaseConfigPromise) {
    publicFirebaseConfigPromise = fetchPublicFirebaseConfig().catch(() => null)
  }

  return publicFirebaseConfigPromise
}

function getFirebaseApp(firebaseConfig) {
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

export async function isFirebaseMessagingConfigured() {
  return Boolean(await getPublicFirebaseConfig())
}

export async function getFirebaseMessagingContext() {
  if (
    typeof window === 'undefined' ||
    typeof navigator === 'undefined' ||
    !isSecureBrowserContext() ||
    !('serviceWorker' in navigator)
  ) {
    return null
  }

  const publicConfig = await getPublicFirebaseConfig()

  if (!publicConfig) {
    return null
  }

  const supported = await isMessagingSupportedInBrowser()

  if (!supported) {
    return null
  }

  const app = getFirebaseApp(publicConfig.firebaseConfig)

  return {
    app,
    messaging: getMessaging(app),
    vapidKey: publicConfig.vapidKey,
  }
}

export async function registerFirebaseMessagingServiceWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return null
  }

  return navigator.serviceWorker.register('/firebase-messaging-sw.js', {
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
    vapidKey: context.vapidKey,
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
