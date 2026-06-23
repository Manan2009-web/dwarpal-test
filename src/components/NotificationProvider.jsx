import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { useToast } from './ToastProvider'
import {
  getNotifications,
  getRealtimeBaseUrl,
  getStoredAuthToken,
  markAllNotificationsRead as markAllNotificationsReadRequest,
  markNotificationRead as markNotificationReadRequest,
  saveNotificationDeviceToken,
} from '../lib/dwarpalApi'
import { subscribeUserToPush } from '../lib/webPush'
import {
  getFirebaseMessagingToken,
  isFirebaseMessagingConfigured,
  subscribeToForegroundMessages,
} from '../lib/firebase'
import {
  formatNotificationTimestamp,
  getNotificationIcon,
  getNotificationKicker,
  getNotificationToastTone,
} from '../lib/notificationPresentation'

const NotificationContext = createContext(null)
const MAX_NOTIFICATIONS = 200

function sortNotifications(notifications) {
  return [...notifications].sort((left, right) => {
    const leftTime = new Date(left.createdAt || left.updatedAt || 0).getTime()
    const rightTime = new Date(right.createdAt || right.updatedAt || 0).getTime()

    if (leftTime !== rightTime) {
      return rightTime - leftTime
    }

    return String(right.id || '').localeCompare(String(left.id || ''))
  })
}

function mergeNotificationLists(previousNotifications, nextNotification) {
  const existingIndex = previousNotifications.findIndex((item) => item.id === nextNotification.id)

  if (existingIndex === -1) {
    return sortNotifications([nextNotification, ...previousNotifications]).slice(0, MAX_NOTIFICATIONS)
  }

  const updatedNotifications = [...previousNotifications]
  updatedNotifications[existingIndex] = {
    ...updatedNotifications[existingIndex],
    ...nextNotification,
  }
  return sortNotifications(updatedNotifications).slice(0, MAX_NOTIFICATIONS)
}

function markNotificationsReadLocally(previousNotifications, notificationIds, readAt) {
  if (!notificationIds.length) {
    return previousNotifications
  }

  const idSet = new Set(notificationIds)

  return previousNotifications.map((notification) =>
    idSet.has(notification.id)
      ? {
          ...notification,
          isRead: true,
          readAt: notification.readAt || readAt || new Date().toISOString(),
        }
      : notification,
  )
}

function markAllNotificationsReadLocally(previousNotifications, readAt) {
  return previousNotifications.map((notification) =>
    notification.isRead
      ? notification
      : {
          ...notification,
          isRead: true,
          readAt: notification.readAt || readAt || new Date().toISOString(),
        },
  )
}

function normalizeBooleanValue(value, fallback = false) {
  if (typeof value === 'boolean') {
    return value
  }

  if (value === 'true') {
    return true
  }

  if (value === 'false') {
    return false
  }

  return fallback
}

function normalizeNotificationPayload(notification = {}) {
  const normalizedNotification = {
    id: String(notification.id || notification.notificationId || '').trim(),
    recipientId: String(notification.recipientId || '').trim(),
    senderId: String(notification.senderId || '').trim(),
    senderRole: String(notification.senderRole || '').trim(),
    title: String(notification.title || '').trim(),
    message: String(notification.message || '').trim(),
    type: String(notification.type || 'system').trim() || 'system',
    status: String(notification.status || 'info').trim() || 'info',
    recordType: String(notification.recordType || 'system').trim() || 'system',
    relatedId: String(notification.relatedId || '').trim(),
    relatedRoute: String(notification.relatedRoute || '/app/notifications').trim() || '/app/notifications',
    referenceId: String(notification.referenceId || '').trim(),
    detail: String(notification.detail || '').trim(),
    isRead: normalizeBooleanValue(notification.isRead, false),
    readAt: notification.readAt || null,
    createdAt: notification.createdAt || new Date().toISOString(),
    updatedAt: notification.updatedAt || notification.createdAt || new Date().toISOString(),
    metadata:
      notification.metadata && typeof notification.metadata === 'object' ? notification.metadata : {},
  }

  if (!normalizedNotification.id && !normalizedNotification.title && !normalizedNotification.message) {
    return null
  }

  return normalizedNotification
}

function mapFirebaseMessageToNotification(payload = {}) {
  const data = payload?.data || {}

  return normalizeNotificationPayload({
    id: data.notificationId || payload?.messageId || payload?.fcmMessageId || '',
    recipientId: data.recipientId || '',
    senderId: data.senderId || '',
    senderRole: data.senderRole || '',
    title: data.title || payload?.notification?.title || '',
    message: data.message || payload?.notification?.body || '',
    type: data.type || 'system',
    status: data.status || 'info',
    recordType: data.recordType || 'system',
    relatedId: data.relatedId || '',
    relatedRoute: data.relatedRoute || '/app/notifications',
    referenceId: data.referenceId || '',
    detail: data.detail || '',
    isRead: false,
    createdAt: data.createdAt || new Date().toISOString(),
  })
}

export function NotificationProvider({ children, currentUser, notificationPermissionState = 'default' }) {
  const toast = useToast()
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [socketConnected, setSocketConnected] = useState(false)
  const [pushReady, setPushReady] = useState(false)
  const shownToastIdsRef = useRef(new Set())
  const notificationIdsRef = useRef(new Set())
  const notificationAudioContextRef = useRef(null)
  const lastSoundAtRef = useRef(0)

  const playNotificationSound = useCallback(() => {
    if (typeof window === 'undefined') {
      return
    }

    const now = Date.now()

    if (now - lastSoundAtRef.current < 1200) {
      return
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext

    if (!AudioContextClass) {
      return
    }

    try {
      if (!notificationAudioContextRef.current) {
        notificationAudioContextRef.current = new AudioContextClass()
      }

      const audioContext = notificationAudioContextRef.current

      if (!audioContext) {
        return
      }

      if (audioContext.state === 'suspended') {
        audioContext.resume().catch(() => {})
      }

      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      const startTime = audioContext.currentTime

      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(880, startTime)
      gainNode.gain.setValueAtTime(0.0001, startTime)
      gainNode.gain.exponentialRampToValueAtTime(0.03, startTime + 0.01)
      gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.18)

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      oscillator.start(startTime)
      oscillator.stop(startTime + 0.2)
      lastSoundAtRef.current = now
    } catch {
      // Ignore sound failures so visual notifications continue.
    }
  }, [])

  const showRealtimeToast = useCallback(
    (notification) => {
      if (!notification?.id || notification.isRead) {
        return
      }

      if (shownToastIdsRef.current.has(notification.id)) {
        return
      }

      shownToastIdsRef.current.add(notification.id)

      if (
        notification.senderId &&
        notification.senderId === currentUser?.id &&
        notification.recipientId === currentUser?.id
      ) {
        return
      }

      const tone = getNotificationToastTone(notification)
      const icon = getNotificationIcon(notification)

      toast[tone]?.({
        title: notification.title,
        message: notification.message,
        icon,
        kicker: getNotificationKicker(notification),
        reference: notification.referenceId,
        timestamp: formatNotificationTimestamp(notification.createdAt),
        dedupeKey: notification.id,
      })

      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        playNotificationSound()
      }

      if (
        typeof window !== 'undefined' &&
        typeof document !== 'undefined' &&
        document.visibilityState === 'hidden' &&
        typeof window.Notification !== 'undefined' &&
        window.Notification.permission === 'granted' &&
        !pushReady
      ) {
        const browserNotification = new window.Notification(notification.title, {
          body: [notification.message, notification.referenceId].filter(Boolean).join(' | '),
          tag: notification.id,
          icon: '/dwarpal-favicon.png',
        })

        browserNotification.onclick = () => {
          window.focus()

          if (notification.relatedRoute) {
            window.location.assign(notification.relatedRoute)
          }

          browserNotification.close()
        }
      }
    },
    [currentUser?.id, playNotificationSound, pushReady, toast],
  )

  useEffect(() => {
    return () => {
      if (notificationAudioContextRef.current?.close) {
        notificationAudioContextRef.current.close().catch(() => {})
      }

      notificationAudioContextRef.current = null
    }
  }, [])

  const refreshNotifications = useCallback(
    async ({ signal, silent = false } = {}) => {
      if (!currentUser?.id) {
        return []
      }

      if (!silent) {
        setLoading(true)
      }

      try {
        const result = await getNotifications({ limit: 100, signal })
        const fetchedNotifications = Array.isArray(result.notifications) ? result.notifications : []

        notificationIdsRef.current = new Set(fetchedNotifications.map((notification) => notification.id))
        setNotifications(sortNotifications(fetchedNotifications).slice(0, MAX_NOTIFICATIONS))
        setUnreadCount(Number(result.unreadCount || result.meta?.unreadCount || 0))

        return fetchedNotifications
      } catch (error) {
        if (signal?.aborted || error?.name === 'AbortError') {
          return []
        }

        toast.warning({
          title: 'Notifications unavailable',
          message: 'DwarPal could not refresh your notification inbox right now.',
        })

        return []
      } finally {
        if (!silent) {
          setLoading(false)
        }
      }
    },
    [currentUser?.id, toast],
  )

  const markNotificationRead = useCallback(
    async (notificationId) => {
      if (!notificationId) {
        return null
      }

      const targetNotification = notifications.find((notification) => notification.id === notificationId)

      if (!targetNotification) {
        return null
      }

      const wasUnread = !targetNotification.isRead
      const optimisticReadAt = new Date().toISOString()

      setNotifications((previousNotifications) =>
        previousNotifications.map((notification) => {
          if (notification.id !== notificationId) {
            return notification
          }

          return notification.isRead
            ? notification
            : {
                ...notification,
                isRead: true,
                readAt: optimisticReadAt,
              }
        }),
      )

      if (wasUnread) {
        setUnreadCount((previousCount) => Math.max(0, previousCount - 1))
      }

      try {
        const updatedNotification = await markNotificationReadRequest(notificationId)

        if (updatedNotification) {
          setNotifications((previousNotifications) =>
            previousNotifications.map((notification) =>
              notification.id === notificationId
                ? {
                    ...notification,
                    ...updatedNotification,
                    isRead: true,
                  }
                : notification,
            ),
          )
        }

        return updatedNotification
      } catch (error) {
        if (wasUnread) {
          await refreshNotifications({ silent: true })
        }

        throw error
      }
    },
    [notifications, refreshNotifications],
  )

  const markAllRead = useCallback(async () => {
    const optimisticReadAt = new Date().toISOString()
    const unreadIds = notifications.filter((notification) => !notification.isRead).map((notification) => notification.id)

    if (!unreadIds.length) {
      return {
        updatedCount: 0,
        notificationIds: [],
        readAt: null,
      }
    }

    setNotifications((previousNotifications) =>
      markAllNotificationsReadLocally(previousNotifications, optimisticReadAt),
    )
    setUnreadCount(0)

    try {
      return await markAllNotificationsReadRequest()
    } catch (error) {
      await refreshNotifications({ silent: true })
      throw error
    }
  }, [notifications, refreshNotifications])

  const handleIncomingNotification = useCallback(
    (rawNotification) => {
      const notification = normalizeNotificationPayload(rawNotification)

      if (!notification) {
        return
      }

      const isKnownNotification = notification.id ? notificationIdsRef.current.has(notification.id) : false

      if (notification.id) {
        notificationIdsRef.current.add(notification.id)
        setNotifications((previousNotifications) => mergeNotificationLists(previousNotifications, notification))
      } else {
        setNotifications((previousNotifications) =>
          sortNotifications([notification, ...previousNotifications]).slice(0, MAX_NOTIFICATIONS),
        )
      }

      if (!notification.isRead && (!notification.id || !isKnownNotification)) {
        setUnreadCount((previousCount) => previousCount + 1)
      }

      showRealtimeToast(notification)
    },
    [showRealtimeToast],
  )

  useEffect(() => {
    notificationIdsRef.current = new Set()
    shownToastIdsRef.current = new Set()

    if (!currentUser?.id) {
      setNotifications([])
      setUnreadCount(0)
      setLoading(false)
      setSocketConnected(false)
      setPushReady(false)
      return undefined
    }

    const controller = new AbortController()
    refreshNotifications({ signal: controller.signal })

    return () => controller.abort()
  }, [currentUser?.id, refreshNotifications])

  useEffect(() => {
    if (!currentUser?.id) {
      return undefined
    }

    const token = getStoredAuthToken()

    if (!token) {
      return undefined
    }

    const socket = io(getRealtimeBaseUrl(), {
      path: '/socket.io',
      auth: {
        token,
      },
      withCredentials: true,
      transports: ['websocket', 'polling'],
    })

    function handleConnect() {
      setSocketConnected(true)
    }

    function handleDisconnect() {
      setSocketConnected(false)
    }

    function handleNotificationCreated(notification) {
      if (!notification?.id) {
        return
      }

      handleIncomingNotification(notification)
    }

    function handleNotificationRead(event) {
      const notificationIds = Array.isArray(event?.notificationIds) ? event.notificationIds : []

      if (!notificationIds.length) {
        return
      }

      let newlyReadCount = 0

      setNotifications((previousNotifications) =>
        previousNotifications.map((notification) => {
          if (notificationIds.includes(notification.id) && !notification.isRead) {
            newlyReadCount += 1
          }

          return notificationIds.includes(notification.id)
            ? {
                ...notification,
                isRead: true,
                readAt: notification.readAt || event?.readAt || new Date().toISOString(),
              }
            : notification
        }),
      )

      if (newlyReadCount) {
        setUnreadCount((previousCount) => Math.max(0, previousCount - newlyReadCount))
      }
    }

    function handleNotificationReadAll(event) {
      setNotifications((previousNotifications) =>
        markAllNotificationsReadLocally(previousNotifications, event?.readAt || null),
      )
      setUnreadCount(0)
    }

    function handleConnectError(error) {
      setSocketConnected(false)

      if (import.meta.env.DEV) {
        console.warn('DwarPal realtime notifications connection failed.', error)
      }
    }

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on('connect_error', handleConnectError)
    socket.on('notification:created', handleNotificationCreated)
    socket.on('notification:read', handleNotificationRead)
    socket.on('notification:read-all', handleNotificationReadAll)

    return () => {
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off('connect_error', handleConnectError)
      socket.off('notification:created', handleNotificationCreated)
      socket.off('notification:read', handleNotificationRead)
      socket.off('notification:read-all', handleNotificationReadAll)
      socket.disconnect()
      setSocketConnected(false)
    }
  }, [currentUser?.id, handleIncomingNotification])

  useEffect(() => {
    let ignore = false
    let unsubscribe = () => {}

    async function setupPushNotifications() {
      if (!currentUser?.id || notificationPermissionState !== 'granted') {
        setPushReady(false)
        return
      }

      // 1. Subscribe to standard Web Push (VAPID)
      try {
        await subscribeUserToPush()
        setPushReady(true)
      } catch (vapidError) {
        console.warn('[notifications] VAPID Web Push subscription failed:', vapidError)
      }

      // 2. Subscribe to Firebase Messaging (if configured)
      const firebaseMessagingConfigured = await isFirebaseMessagingConfigured()
      if (!firebaseMessagingConfigured) {
        return
      }

      try {
        const token = await getFirebaseMessagingToken()

        if (!token || ignore) {
          return
        }

        await saveNotificationDeviceToken({
          token,
          device: navigator.userAgent || 'Web browser',
        })

        if (ignore) {
          return
        }

        unsubscribe = await subscribeToForegroundMessages((payload) => {
          const notification = mapFirebaseMessageToNotification(payload)

          if (notification) {
            handleIncomingNotification(notification)
          }
        })
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn('[notifications] Firebase setup failed:', error)
        }
      }
    }

    void setupPushNotifications()

    return () => {
      ignore = true
      unsubscribe?.()
    }
  }, [currentUser?.id, handleIncomingNotification, notificationPermissionState])

  const contextValue = useMemo(
    () => ({
      notifications,
      unreadCount,
      loading,
      pushReady,
      socketConnected,
      refreshNotifications,
      markNotificationRead,
      markAllRead,
    }),
    [
      loading,
      markAllRead,
      markNotificationRead,
      notifications,
      pushReady,
      refreshNotifications,
      socketConnected,
      unreadCount,
    ],
  )

  return <NotificationContext.Provider value={contextValue}>{children}</NotificationContext.Provider>
}

export function useNotifications() {
  const context = useContext(NotificationContext)

  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider.')
  }

  return context
}

