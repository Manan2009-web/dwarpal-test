import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { ToastProvider } from './components/ToastProvider.jsx'
import './index.css'

const rootElement = document.getElementById('root')
const STATUS_FONT_FAMILY = "'Segoe UI', 'Trebuchet MS', Helvetica, Arial, sans-serif"

function logBootstrapStatus(event, details) {
  if (!import.meta.env.DEV) {
    return
  }

  if (details === undefined) {
    console.info(`[DwarPal main] ${event}`)
    return
  }

  console.info(`[DwarPal main] ${event}`, details)
}

function getFatalErrorMessage(error, fallbackMessage) {
  if (!error) {
    return fallbackMessage
  }

  if (typeof error === 'string' && error.trim()) {
    return error
  }

  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message
  }

  if (typeof error?.reason?.message === 'string' && error.reason.message.trim()) {
    return error.reason.message
  }

  return fallbackMessage
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderStatusScreen({
  title,
  message,
  details = '',
  showReload = false,
}) {
  if (!rootElement) {
    return
  }

  const safeTitle = escapeHtml(title)
  const safeMessage = escapeHtml(message)
  const safeDetails = escapeHtml(details)

  rootElement.innerHTML = `
    <div style="min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at top left, rgba(47, 156, 98, 0.16), transparent 22rem), radial-gradient(circle at top right, rgba(53, 121, 214, 0.12), transparent 26rem), #f4f7f1;color:#163247;font-family:${STATUS_FONT_FAMILY};">
      <div style="width:min(560px, 100%);border-radius:28px;padding:24px;background:rgba(255, 255, 255, 0.92);border:1px solid rgba(23, 52, 73, 0.14);box-shadow:0 24px 70px rgba(20, 38, 27, 0.12);">
        <p style="margin:0;font-size:0.82rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#5d7183;">DwarPal</p>
        <h1 style="margin:0.45rem 0 0.75rem;font-size:1.6rem;">${safeTitle}</h1>
        <p style="margin:0;line-height:1.6;color:#5d7183;">${safeMessage}</p>
        ${
          details
            ? `<pre style="margin:1rem 0 0;padding:0.9rem 1rem;border-radius:16px;overflow:auto;background:rgba(22, 50, 71, 0.06);color:#163247;font:500 0.84rem/1.5 'Consolas','SFMono-Regular',monospace;white-space:pre-wrap;">${safeDetails}</pre>`
            : ''
        }
        ${
          showReload
            ? '<button id="dwarpal-reload-app" type="button" style="margin-top:1.25rem;border:0;border-radius:16px;padding:0.95rem 1.2rem;background:linear-gradient(135deg, #2872a1, #1f5a80);color:#ffffff;font-weight:700;">Reload App</button>'
            : ''
        }
      </div>
    </div>
  `

  if (showReload) {
    document.getElementById('dwarpal-reload-app')?.addEventListener('click', () => {
      window.location.reload()
    })
  }
}

function renderBootStatus() {
  renderStatusScreen({
    title: 'Loading DwarPal',
    message: 'Starting React and loading your workspace shell.',
  })
}

function getBootStatusController() {
  if (typeof window === 'undefined') {
    return null
  }

  return window.__DWARPAL_BOOT_STATUS__ || null
}

async function cleanupLegacyBrowserState() {
  if (typeof window === 'undefined') {
    return
  }

  const cachePrefixesToDelete = ['vite-', 'workbox-', 'dwarpal-legacy-']
  const cleanupTasks = []

  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    cleanupTasks.push(
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        if (!registrations.length) {
          return undefined
        }

        const staleRegistrations = registrations.filter((registration) => {
          const scriptUrl =
            registration.active?.scriptURL || registration.waiting?.scriptURL || registration.installing?.scriptURL || ''

          return !scriptUrl.includes('firebase-messaging-sw.js')
        })

        if (!staleRegistrations.length) {
          return undefined
        }

        return Promise.allSettled(staleRegistrations.map((registration) => registration.unregister()))
      }),
    )
  }

  if ('caches' in window) {
    cleanupTasks.push(
      window.caches.keys().then((cacheKeys) => {
        const staleCacheKeys = cacheKeys.filter((cacheKey) =>
          cachePrefixesToDelete.some((prefix) => cacheKey.startsWith(prefix)),
        )

        if (!staleCacheKeys.length) {
          return undefined
        }

        return Promise.allSettled(staleCacheKeys.map((cacheKey) => window.caches.delete(cacheKey)))
      }),
    )
  }

  try {
    await Promise.allSettled(cleanupTasks)
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('Unable to clean up stale browser state.', error)
    }
  }
}

function showBootstrapFailure(message) {
  const controller = getBootStatusController()

  if (typeof controller?.showError === 'function') {
    controller.showError(message)
    return
  }

  renderStatusScreen({
    title: 'The app hit a startup error.',
    message: 'A fallback screen is showing so the app does not fail silently. Open the browser console for the full stack trace, then reload after the issue is fixed.',
    details: message,
    showReload: true,
  })
}

function StatusScreen({ title, message, details = '', showReload = false }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '24px',
        background:
          'radial-gradient(circle at top left, rgba(47, 156, 98, 0.16), transparent 22rem), radial-gradient(circle at top right, rgba(53, 121, 214, 0.12), transparent 26rem), #f4f7f1',
        color: '#163247',
        fontFamily: STATUS_FONT_FAMILY,
      }}
    >
      <div
        style={{
          width: 'min(560px, 100%)',
          borderRadius: '28px',
          padding: '24px',
          background: 'rgba(255, 255, 255, 0.92)',
          border: '1px solid rgba(23, 52, 73, 0.14)',
          boxShadow: '0 24px 70px rgba(20, 38, 27, 0.12)',
        }}
      >
        <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#5d7183' }}>
          DwarPal
        </p>
        <h1 style={{ margin: '0.45rem 0 0.75rem', fontSize: '1.6rem' }}>{title}</h1>
        <p style={{ margin: 0, lineHeight: 1.6, color: '#5d7183' }}>{message}</p>
        {details ? (
          <pre
            style={{
              margin: '1rem 0 0',
              padding: '0.9rem 1rem',
              borderRadius: '16px',
              overflow: 'auto',
              background: 'rgba(22, 50, 71, 0.06)',
              color: '#163247',
              font: "500 0.84rem/1.5 'Consolas', 'SFMono-Regular', monospace",
              whiteSpace: 'pre-wrap',
            }}
          >
            {details}
          </pre>
        ) : null}
        {showReload ? (
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: '1.25rem',
              border: 0,
              borderRadius: '16px',
              padding: '0.95rem 1.2rem',
              background: 'linear-gradient(135deg, #2872a1, #1f5a80)',
              color: '#ffffff',
              fontWeight: 700,
            }}
          >
            Reload App
          </button>
        ) : null}
      </div>
    </div>
  )
}

class RootErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('DwarPal root render failed', error, errorInfo)
  }

  render() {
    if (!this.state.error) {
      return this.props.children
    }

    return (
      <StatusScreen
        title="The app hit a render error."
        message="A fallback screen is showing so the app does not fail silently. Open the browser console for the full stack trace, then reload after the issue is fixed."
        details={getFatalErrorMessage(this.state.error, '')}
        showReload
      />
    )
  }
}

function AppMountProbe() {
  React.useEffect(() => {
    logBootstrapStatus('React root mounted')
    getBootStatusController()?.markStarted?.()
    void cleanupLegacyBrowserState()
  }, [])

  return null
}

function handleBootstrapFailure(error) {
  const message = getFatalErrorMessage(
    error,
    'A browser/runtime error stopped DwarPal before it could finish rendering.',
  )

  console.error('DwarPal bootstrap failed', error)
  showBootstrapFailure(message)
}

if (!rootElement) {
  throw new Error('DwarPal could not find the #root element in index.html.')
}

function bootstrap() {
  logBootstrapStatus('Bootstrapping React root')
  renderBootStatus()

  try {
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <RootErrorBoundary>
          <ToastProvider>
            <AppMountProbe />
            <App />
          </ToastProvider>
        </RootErrorBoundary>
      </React.StrictMode>,
    )
  } catch (error) {
    handleBootstrapFailure(error)
  }
}

bootstrap()
