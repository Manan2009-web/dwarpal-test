import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, BellRing, CheckCircle2, TriangleAlert, X } from 'lucide-react'

const ToastContext = createContext(null)

const TOAST_DISMISS_DELAY_MS = 4200
const TOAST_EXIT_DELAY_MS = 220

const TOAST_META = {
  success: {
    icon: CheckCircle2,
    title: 'Success',
  },
  error: {
    icon: AlertCircle,
    title: 'Error',
  },
  warning: {
    icon: TriangleAlert,
    title: 'Warning',
  },
  info: {
    icon: BellRing,
    title: 'Notice',
  },
}

function createToastId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function normalizeToastInput(input, fallbackTone = 'info') {
  if (typeof input === 'string') {
    return {
      tone: fallbackTone,
      message: input,
    }
  }

  return {
    tone: input?.tone || fallbackTone,
    title: input?.title || '',
    message: input?.message || '',
    duration: input?.duration,
    icon: input?.icon || null,
    kicker: input?.kicker || '',
    reference: input?.reference || '',
    timestamp: input?.timestamp || '',
    dedupeKey: input?.dedupeKey || '',
  }
}

function ToastItem({ toast, onDismiss }) {
  const meta = TOAST_META[toast.tone] || TOAST_META.info
  const Icon = toast.icon || meta.icon
  const title = toast.title || meta.title

  return (
    <article
      className={`notification-toast notification-toast-${toast.tone}${toast.visible ? ' visible' : ' leaving'}`}
      role={toast.tone === 'error' || toast.tone === 'warning' ? 'alert' : 'status'}
    >
      <div className="notification-toast-body">
        <div className="notification-toast-icon" aria-hidden="true">
          <Icon size={18} />
        </div>
        <div className="notification-toast-copy">
          {toast.kicker ? <span className="notification-toast-kicker">{toast.kicker}</span> : null}
          <strong>{title}</strong>
          <p>{toast.message}</p>
          {toast.reference || toast.timestamp ? (
            <div className="notification-toast-meta">
              {toast.reference ? <span>{toast.reference}</span> : null}
              {toast.timestamp ? <span>{toast.timestamp}</span> : null}
            </div>
          ) : null}
        </div>
      </div>
      <button
        type="button"
        className="notification-toast-dismiss"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
      >
        <X size={16} />
      </button>
    </article>
  )
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timeoutsRef = useRef(new Map())

  const clearToastTimeouts = useCallback((toastId) => {
    const activeTimeouts = timeoutsRef.current.get(toastId)

    if (activeTimeouts) {
      window.clearTimeout(activeTimeouts.dismissTimeoutId)
      window.clearTimeout(activeTimeouts.removeTimeoutId)
      timeoutsRef.current.delete(toastId)
    }
  }, [])

  const removeToast = useCallback(
    (toastId) => {
      clearToastTimeouts(toastId)
      setToasts((previousToasts) => previousToasts.filter((toast) => toast.id !== toastId))
    },
    [clearToastTimeouts],
  )

  const dismissToast = useCallback(
    (toastId) => {
      clearToastTimeouts(toastId)
      setToasts((previousToasts) =>
        previousToasts.map((toast) =>
          toast.id === toastId
            ? {
                ...toast,
                visible: false,
              }
            : toast,
        ),
      )

      const removeTimeoutId = window.setTimeout(() => {
        removeToast(toastId)
      }, TOAST_EXIT_DELAY_MS)

      timeoutsRef.current.set(toastId, {
        dismissTimeoutId: 0,
        removeTimeoutId,
      })
    },
    [clearToastTimeouts, removeToast],
  )

  const pushToast = useCallback(
    (input, fallbackTone = 'info') => {
      const normalizedToast = normalizeToastInput(input, fallbackTone)
      const toastId = createToastId()
      const duration = Number(normalizedToast.duration) > 0 ? Number(normalizedToast.duration) : TOAST_DISMISS_DELAY_MS

      setToasts((previousToasts) => [
        ...previousToasts,
        {
          id: toastId,
          tone: normalizedToast.tone,
          title: normalizedToast.title,
          message: normalizedToast.message,
          icon: normalizedToast.icon,
          kicker: normalizedToast.kicker,
          reference: normalizedToast.reference,
          timestamp: normalizedToast.timestamp,
          dedupeKey: normalizedToast.dedupeKey,
          visible: true,
        },
      ])

      const dismissTimeoutId = window.setTimeout(() => {
        dismissToast(toastId)
      }, duration)

      timeoutsRef.current.set(toastId, {
        dismissTimeoutId,
        removeTimeoutId: 0,
      })

      return toastId
    },
    [dismissToast],
  )

  useEffect(
    () => () => {
      timeoutsRef.current.forEach((timeouts) => {
        window.clearTimeout(timeouts.dismissTimeoutId)
        window.clearTimeout(timeouts.removeTimeoutId)
      })
      timeoutsRef.current.clear()
    },
    [],
  )

  const contextValue = useMemo(
    () => ({
      show: (input) => pushToast(input),
      success: (input) => pushToast(input, 'success'),
      error: (input) => pushToast(input, 'error'),
      warning: (input) => pushToast(input, 'warning'),
      info: (input) => pushToast(input, 'info'),
      dismiss: dismissToast,
    }),
    [dismissToast, pushToast],
  )

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div className="notification-toast-stack" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)

  if (!context) {
    throw new Error('useToast must be used within a ToastProvider.')
  }

  return context
}
