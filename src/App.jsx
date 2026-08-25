import React, { Component, Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
// import logo from "../assets/DwarPal_logo.png";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Fingerprint,
  KeyRound,
  QrCode,
  ScanLine,
  Send,
  Settings,
  ShieldCheck,
  UserPlus2,
  XCircle,
} from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import './App.css'
import AppBrand from './components/AppBrand'
import LandingPage from './components/LandingPage'
import LoadingPage from './components/LoadingPage'
import AuthPage from './components/auth/AuthPage'
import LoginForm from './components/auth/LoginForm'
import RegisterForm from './components/auth/RegisterForm'
import LandingPanel from './components/auth/LandingPanel'
import FeatureBoundary from './components/FeatureBoundary'
import NotificationCenterPanel from './components/NotificationCenterPanel'
import { NotificationProvider, useNotifications } from './components/NotificationProvider'
import ExpandableGatepassCard from './components/ExpandableGatepassCard'
import NotificationPermissionPrompt, {
  NotificationPermissionCard,
} from './components/NotificationPermissionPrompt'
import PushPromptBanner from './components/PushPromptBanner'
import PrivacyPreferencesBanner from './components/PrivacyPreferencesBanner'
import PasswordInput from './components/PasswordInput'
import { SkeletonNotificationList } from './components/ui/SkeletonLoader'
import OtpCodeInput from './components/OtpCodeInput'

const AccessPortal = lazy(() => import('./components/AccessPortal'))
const AdminPortal = lazy(() => import('./components/AdminPortal'))
const ChairmanPortal = lazy(() => import('./components/ChairmanPortal'))
const Register = lazy(() => import('./components/Register'))
const FacultyLeaveWizard = lazy(() => import('./components/FacultyLeaveWizard'))
const SecurityVerificationPanel = lazy(() => import('./components/SecurityVerificationPanel'))
const SupportModal = lazy(() => import('./components/SupportModal'))
const GatepassQrModal = lazy(() => import('./components/GatepassQrModal'))
const PreferencesPanel = lazy(() => import('./components/PreferencesPanel'))
const PasswordResetPanel = lazy(() => import('./components/PasswordResetPanel'))
const NewStudentWelcomeModal = lazy(() => import('./components/NewStudentWelcomeModal'))
const LegalDocs = lazy(() => import('./components/LegalDocs'))
const SupportPage = lazy(() => import('./components/SupportPage'))
const NotFoundPage = lazy(() => import('./components/NotFoundPage'))
const StudentRegisterPage = lazy(() => import('./components/auth/StudentRegisterPage'))
const Aurora = lazy(() => import('./components/ui/Aurora'))
import { useToast } from './components/ToastProvider'
import { usePushSubscription } from './hooks/usePushSubscription'
import { useStudentSessionTimeout } from './hooks/useStudentSessionTimeout'
import {
  DEPARTMENTS,
  PROGRAM_OPTIONS,
  ROLE_META,
  PUBLIC_ROLE_OPTIONS,
  ROUTING_DEPARTMENTS,
  normalizeDepartment,
  normalizeProgram,
  SEMESTER_OPTIONS,
  normalizeRole,
  normalizeVehicleNumber,
} from './mockData'
import {
  ActionButton,
  EmptyState,
  FilterTabs,
  IdentityField,
  ModalForm,
  ProfileCard,
  SearchBar,
  SelectField,
  Sidebar,
  StatusBadge,
  SummaryCard,
  Topbar,
  formatDateTime,
} from './components/ui'
import {
  ApiError,
  clearBiometricDeviceId,
  clearPortalAccessSession,
  getPortalAccessSession,
  clearStoredAuthToken,
  confirmPasswordChange,
  createBiometricAuthenticationOptions,
  createBiometricRegistrationOptions,
  buildApiUrl,
  DEFAULT_WORKSPACE_PAGE_SIZE,
  fetchWorkspace,
  getBiometricDevices,
  getApiErrorDetails,
  getApiErrorMessage,
  hasStoredAuthToken,
  loginUser,
  logoutUser,
  normalizePhoneNumberInput,
  registerUser,
  requestPasswordChange,
  requestPortalAccess,
  resolveForgotPasswordAccount,
  resetForgotPassword,
  resendRegistrationOtp,
  submitForgotPassword,
  submitVerifyOtp,
  submitResetPassword,
  readBiometricDeviceId,
  removeBiometricDevice,
  sendEmailVerificationOtp,
  startStudentLogin,
  startForgotPassword,
  submitRequest,
  updateEmailVerificationEmail,
  updateCurrentUserProfile,
  updateRequestStatus,
  verifyCurrentUserEmailOtp,
  verifyForgotPasswordOtp,
  verifyBiometricAuthentication,
  verifyBiometricRegistration,
  verifyGatepassQr,
  verifyGatepassById,
  verifyRegistrationOtp,
  verifyStudentLoginOtp,
  verifySession,
  assignCoordinator,
  resignCoordinator,
} from './lib/dwarpalApi'
import {
  beginBiometricAuthentication,
  beginBiometricRegistration,
  detectBiometricSupport,
  getBiometricErrorMessage,
} from './lib/biometricAuth'
import {
  getResolvedNotificationPermissionState,
  isBrowserNotificationSupported,
  readCookieConsent,
  writeCookieConsent,
  writeNotificationPermissionPreference,
} from './lib/preferences'
import {
  formatNotificationTimestamp,
  getNotificationDisplayStatus,
  getNotificationKicker,
  getNotificationSurfaceTone,
} from './lib/notificationPresentation'
import { SUPPORT_CONFIG } from './lib/supportConfig'

const DASHBOARD_REFRESH_MS = 10000
const REFRESH_ERROR_TOAST_COOLDOWN_MS = 30000
const AUTH_BOOTSTRAP_TIMEOUT_MS = 5000
const REMEMBERED_LOGIN_IDENTIFIER_STORAGE_KEY = 'dwarpal.remembered-login-identifier'
const VEHICLE_NUMBER_PATTERN = /^[A-Za-z0-9 -]+$/
const REQUIRED_FIELD_MESSAGE = 'Please fill this field'
const REASON_MIN_LENGTH = 5
const REASON_MAX_LENGTH = 500
const ROLE_DASHBOARD_PATHS = {
  student: '/student/dashboard',
  faculty: '/faculty/dashboard',
  principal: '/principal/dashboard',
  hod: '/hod/dashboard',
  security: '/security/dashboard',
  campus_security: '/security/dashboard',
  cao: '/cao/dashboard',
  admin: '/admin/dashboard',
  it: '/admin/dashboard',
  chairman: '/chairman',
}

const DEFAULT_WORKSPACE_REQUEST_OPTIONS = {
  page: 1,
  limit: DEFAULT_WORKSPACE_PAGE_SIZE,
  searchTerm: '',
  statusFilter: 'All',
}

function createEmptyGatepassMeta(overrides = {}) {
  return {
    page: 1,
    currentPage: 1,
    limit: DEFAULT_WORKSPACE_PAGE_SIZE,
    total: 0,
    totalRecords: 0,
    totalPages: 1,
    ...overrides,
  }
}

function maskAuthIdentifier(value) {
  const normalizedValue = String(value || '').trim()

  if (!normalizedValue) {
    return ''
  }

  if (normalizedValue.length <= 4) {
    return normalizedValue
  }

  return `${normalizedValue.slice(0, 2)}${'*'.repeat(Math.max(normalizedValue.length - 4, 1))}${normalizedValue.slice(-2)}`
}

function isEmailStyleIdentifier(value) {
  return String(value || '').includes('@')
}

function getDashboardPathForRole(role) {
  return ROLE_DASHBOARD_PATHS[normalizeRole(role)] || '/app/dashboard'
}

function hasAdminPortalAccess(user) {
  if (!user) return false

  const role = normalizeRole(user.role)
  const permissions = Array.isArray(user.permissions) ? user.permissions : []

  if (['principal', 'hod', 'cao', 'security', 'campus_security', 'admin', 'it'].includes(role)) {
    return true
  }

  return (
    Boolean(user.isCoordinator || user.coordinatorAssignment?.isCoordinator || user.coordinatorScope?.isCoordinator) ||
    permissions.includes('admin:access') ||
    permissions.includes('admin:*')
  )
}

function getLandingPathForUser(user) {
  if (!user) return '/login'

  const role = normalizeRole(user.role)

  if (role === 'chairman') {
    return '/chairman'
  }

  if (role === 'student' || role === 'faculty') {
    return '/user/dashboard'
  }

  const roleDashboard = getDashboardPathForRole(role)
  if (roleDashboard) {
    return roleDashboard
  }

  if (hasAdminPortalAccess(user)) {
    return '/admin/dashboard'
  }

  return '/user/dashboard'
}

function logBootstrapDebug(event, details) {
  if (!import.meta.env.DEV) {
    return
  }

  if (details === undefined) {
    console.info(`[DwarPal bootstrap] ${event}`)
    return
  }

  console.info(`[DwarPal bootstrap] ${event}`, details)
}

function useRouteGuardDebug(label, authReady, currentUser) {
  const location = useLocation()

  useEffect(() => {
    logBootstrapDebug(`route guard: ${label}`, {
      path: location.pathname,
      authReady,
      currentUserId: currentUser?.id || null,
      currentUserRole: currentUser?.role || null,
    })
  }, [authReady, currentUser?.id, currentUser?.role, label, location.pathname])
}
const APP_PAGES = new Set(['dashboard', 'notifications', 'profile', 'support', 'privacy'])
const USER_PAGE_ALIASES = {
  gatepasses: 'dashboard',
  'new-gatepass': 'dashboard',
  history: 'dashboard',
  'leave-adjustment': 'dashboard',
}

function getRequestLabel(request) {
  if (request?.requestKind === 'faculty_leave') {
    return 'Leave request'
  }

  return 'Gatepass'
}

function getActionToastMeta(request, action) {
  const requestLabel = getRequestLabel(request)

  if (action === 'approve') {
    return {
      tone: 'success',
      title: `${requestLabel} approved`,
      message: `${requestLabel} was approved successfully.`,
    }
  }

  if (action === 'reject') {
    return {
      tone: 'warning',
      title: `${requestLabel} rejected`,
      message: `${requestLabel} was rejected successfully.`,
    }
  }

  if (action === 'forward') {
    return {
      tone: 'info',
      title: `${requestLabel} forwarded`,
      message: `${requestLabel} was forwarded for the next review step.`,
    }
  }

  if (action === 'sendToCoordinator') {
    return {
      tone: 'info',
      title: `${requestLabel} sent to coordinator`,
      message: `${requestLabel} was sent to the class coordinator for semester review.`,
    }
  }

  if (action === 'campusClear') {
    return {
      tone: 'success',
      title: `${requestLabel} Campus Cleared`,
      message: `${requestLabel} received campus clearance from Security | Bouncer.`,
    }
  }

  if (action === 'markOut') {
    return {
      tone: 'success',
      title: `${requestLabel} marked OUT`,
      message: `${requestLabel} was marked OUT successfully at the security desk.`,
    }
  }

  if (action === 'markIn') {
    return {
      tone: 'success',
      title: `${requestLabel} marked returned`,
      message: `${requestLabel} was marked returned successfully at the security desk.`,
    }
  }

  return {
    tone: 'info',
    title: `${requestLabel} updated`,
    message: `${requestLabel} was updated successfully.`,
  }
}

function isBlankFieldValue(value) {
  return typeof value === 'string' ? value.trim() === '' : value === undefined || value === null || value === ''
}

function getRequiredFieldErrors(fields, customMessages = {}) {
  return Object.entries(fields).reduce((errors, [field, value]) => {
    if (isBlankFieldValue(value)) {
      errors[field] = customMessages[field] || REQUIRED_FIELD_MESSAGE
    }

    return errors
  }, {})
}

function clearFieldError(errors, field) {
  if (!errors[field]) return errors

  const nextErrors = { ...errors }
  delete nextErrors[field]
  return nextErrors
}

function validateLengthConstrainedField(
  value,
  {
    requiredMessage,
    minLength = REASON_MIN_LENGTH,
    maxLength = REASON_MAX_LENGTH,
    minMessage,
    maxMessage,
  },
) {
  const normalizedValue = String(value || '').trim()

  if (!normalizedValue) {
    return requiredMessage
  }

  if (normalizedValue.length < minLength) {
    return minMessage
  }

  if (normalizedValue.length > maxLength) {
    return maxMessage
  }

  return ''
}

function validateGatepassReason(value) {
  return validateLengthConstrainedField(value, {
    requiredMessage: 'Reason of leaving is required.',
    minMessage: 'Minimum length of reason is 5 characters.',
    maxMessage: 'Maximum length of reason is 500 characters.',
  })
}

function validateRejectReason(value) {
  return validateLengthConstrainedField(value, {
    requiredMessage: 'Reject reason is required.',
    minMessage: 'Minimum length of reject reason is 5 characters.',
    maxMessage: 'Maximum length of reject reason is 500 characters.',
  })
}

function mapGatepassFormFieldErrors(fieldErrors = {}) {
  if (!fieldErrors || typeof fieldErrors !== 'object') {
    return {}
  }

  const normalizedErrors = { ...fieldErrors }

  if (!normalizedErrors.outTime) {
    normalizedErrors.outTime = fieldErrors.outDate || fieldErrors.outTime
  }

  if (!normalizedErrors.expectedReturnTime) {
    normalizedErrors.expectedReturnTime = fieldErrors.expectedReturnDate || fieldErrors.expectedReturnTime
  }

  return Object.entries(normalizedErrors).reduce((errors, [field, message]) => {
    if (message) {
      errors[field] = message
    }

    return errors
  }, {})
}

function mapRegisterFieldErrors(fieldErrors = {}, role = '') {
  if (!fieldErrors || typeof fieldErrors !== 'object') {
    return {}
  }

  const normalizedRole = normalizeRole(role)
  const normalizedErrors = {
    name: fieldErrors.name || fieldErrors.fullName || '',
    email: fieldErrors.email || '',
    program: fieldErrors.program || '',
    department: fieldErrors.department || '',
    enrollment: fieldErrors.enrollment || fieldErrors.enrollmentNo || fieldErrors.employeeId || '',
    phone: fieldErrors.phone || '',
    role: fieldErrors.role || '',
    semester: fieldErrors.semester || '',
    password: fieldErrors.password || '',
    designation: fieldErrors.designation || '',
    securityZone: fieldErrors.securityZone || '',
    accessLevel: fieldErrors.accessLevel || '',
    authorityLevel: fieldErrors.authorityLevel || '',
  }

  if (normalizedRole !== 'student') {
    delete normalizedErrors.semester
  }

  if (!['principal', 'admin', 'cao'].includes(normalizedRole)) {
    delete normalizedErrors.program
  }

  if (!['faculty', 'hod'].includes(normalizedRole)) {
    delete normalizedErrors.department
  }

  if (normalizedRole !== 'faculty') {
    delete normalizedErrors.designation
  }

  if (normalizedRole !== 'security') {
    delete normalizedErrors.securityZone
  }

  if (normalizedRole !== 'admin') {
    delete normalizedErrors.accessLevel
  }

  if (normalizedRole !== 'cao') {
    delete normalizedErrors.authorityLevel
  }

  return Object.entries(normalizedErrors).reduce((errors, [field, message]) => {
    if (message) {
      errors[field] = message
    }

    return errors
  }, {})
}

function FieldLabel({ children, required = false }) {
  return (
    <span className="field-label">
      <span className="field-label-text">{children}</span>
      {required ? (
        <span className="required-indicator" aria-hidden="true">
          *
        </span>
      ) : null}
    </span>
  )
}

function roleUsesProgramRouting(role) {
  return ['principal', 'hod'].includes(role)
}

function getRegistrationDepartmentOptions(role, program) {
  if (roleUsesProgramRouting(role)) {
    return program ? ROUTING_DEPARTMENTS : []
  }

  return DEPARTMENTS
}

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#09090b',
          color: '#e4e4e7',
          padding: '24px',
          textAlign: 'center',
          fontFamily: 'sans-serif'
        }}>
          <div style={{
            maxWidth: '440px',
            backgroundColor: '#18181b',
            border: '1px solid #27272a',
            padding: '32px',
            borderRadius: '16px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#ffffff', marginBottom: '8px', textTransform: 'uppercase' }}>Document Load Failed</h2>
            <p style={{ fontSize: '0.75rem', color: '#a1a1aa', marginBottom: '24px', lineHeight: '1.5' }}>
              This content could not be loaded. This is often caused by ad-blockers, content filters, or Brave Shields blocking network requests for legal and privacy policies.
            </p>
            <button 
              onClick={() => {
                this.setState({ hasError: false, error: null })
                window.location.reload()
              }}
              style={{
                padding: '10px 24px',
                backgroundColor: '#9333ea',
                border: 'none',
                color: '#ffffff',
                fontSize: '0.75rem',
                fontWeight: 'bold',
                borderRadius: '9999px',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = '#a855f7'}
              onMouseOut={(e) => e.target.style.backgroundColor = '#9333ea'}
            >
              TRY RELOADING
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

function LoadingSpinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '240px', width: '100%', color: '#a855f7' }}>
      <div style={{
        animation: 'spin 1s linear infinite',
        borderRadius: '9999px',
        height: '32px',
        width: '32px',
        borderBottom: '2px solid currentColor',
        borderLeft: '2px solid transparent',
        borderRight: '2px solid transparent',
        borderTop: '2px solid transparent'
      }} />
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

function App() {
  const toast = useToast()
  const [introLoading, setIntroLoading] = useState(true)
  const [gatepasses, setGatepasses] = useState([])
  const [gatepassMeta, setGatepassMeta] = useState(() => createEmptyGatepassMeta())
  const [summary, setSummary] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)

  // Web Push Notifications — subscribe automatically when user logs in.
  // Non-critical: all errors are swallowed inside the hook.
  usePushSubscription(currentUser)
  const [portalAccess, setPortalAccess] = useState(() => getPortalAccessSession())
  const [supportModalOpen, setSupportModalOpen] = useState(false)
  const [studentPasswordPromptOpen, setStudentPasswordPromptOpen] = useState(false)
  const [cookieConsent, setCookieConsent] = useState(() => readCookieConsent())
  const [cookieBannerForcedOpen, setCookieBannerForcedOpen] = useState(false)
  const [notificationPermissionState, setNotificationPermissionState] = useState(() =>
    getResolvedNotificationPermissionState(),
  )
  const [notificationPromptOpen, setNotificationPromptOpen] = useState(false)
  const refreshRequestRef = useRef(0)
  const refreshInFlightRef = useRef(false)
  const lastRefreshErrorToastAtRef = useRef(0)
  const workspaceRequestOptionsRef = useRef(DEFAULT_WORKSPACE_REQUEST_OPTIONS)
  const requiresEmailVerification = false // TEMP_DISABLED_OTP

  const resetWorkspace = useCallback(() => {
    setGatepasses([])
    setGatepassMeta(createEmptyGatepassMeta())
    setSummary(null)
  }, [])

  const clearSession = useCallback(() => {
    clearStoredAuthToken()
    setStudentPasswordPromptOpen(false)
    setSupportModalOpen(false)
    setCurrentUser(null)
    refreshRequestRef.current += 1
    resetWorkspace()
  }, [resetWorkspace])

  const handleInactivityTimeout = useCallback(() => {
    clearSession()
    logoutUser().catch(() => {})
  }, [clearSession])

  const savePortalAccess = useCallback((nextPortalAccess, forceHardReset = false) => {
    if (!nextPortalAccess?.token || !nextPortalAccess?.accessType) {
      clearPortalAccessSession(forceHardReset)
      setPortalAccess(null)
      return
    }

    setPortalAccess(nextPortalAccess)
  }, [])

  const refreshNotificationPermissionState = useCallback(() => {
    setNotificationPermissionState(getResolvedNotificationPermissionState())
  }, [])

  const handleCookiePreferenceChange = useCallback(
    (nextConsent) => {
      writeCookieConsent(nextConsent)
      setCookieConsent(nextConsent)
      setCookieBannerForcedOpen(false)

      if (nextConsent === 'accepted') {
        toast.success({
          title: 'Cookie preferences saved',
          message: 'Cookies are now enabled for a smoother DwarPal experience on this device.',
        })
        return
      }

      toast.info({
        title: 'Cookie preferences saved',
        message: 'Your cookie preference was saved and can be updated later from your profile settings.',
      })
    },
    [toast],
  )


  useEffect(() => {
    if (!currentUser || currentUser.role !== 'student' || !currentUser.mustChangePassword) {
      setStudentPasswordPromptOpen(false)
    }
  }, [currentUser])

  const handleOpenCookiePreferences = useCallback(() => {
    setCookieBannerForcedOpen(true)
  }, [])

  const handleDeferNotificationPrompt = useCallback(() => {
    writeNotificationPermissionPreference('dismissed')
    setNotificationPermissionState('dismissed')
    setNotificationPromptOpen(false)
    toast.info({
      title: 'Notifications postponed',
      message: 'You can enable browser notifications later from your profile or notifications page.',
    })
  }, [toast])

  const handleOpenNotificationPrompt = useCallback(() => {
    const resolvedState = getResolvedNotificationPermissionState()
    setNotificationPermissionState(resolvedState)

    if (resolvedState === 'granted') {
      toast.success({
        title: 'Notifications already enabled',
        message: 'DwarPal is already ready for future browser notifications on this device.',
      })
      return
    }

    if (resolvedState === 'denied') {
      toast.warning({
        title: 'Notifications blocked in browser',
        message: 'Please update the browser site settings if you want to enable DwarPal notifications later.',
      })
      return
    }

    if (resolvedState === 'unsupported') {
      toast.warning({
        title: 'Notifications unavailable',
        message: 'This browser or connection does not support notifications, but in-app updates will still work normally.',
      })
      return
    }

    setNotificationPromptOpen(true)
  }, [toast])

  const handleAllowNotificationPrompt = useCallback(async () => {
    if (
      !isBrowserNotificationSupported() ||
      typeof window.Notification?.requestPermission !== 'function'
    ) {
      writeNotificationPermissionPreference('unsupported')
      setNotificationPermissionState('unsupported')
      setNotificationPromptOpen(false)
      toast.warning({
        title: 'Notifications unavailable',
        message: 'This browser or connection does not support notifications.',
      })
      return
    }

    try {
      const permission = await window.Notification.requestPermission()
      const nextState =
        permission === 'granted' ? 'granted' : permission === 'denied' ? 'denied' : 'dismissed'

      writeNotificationPermissionPreference(nextState)
      setNotificationPermissionState(nextState)
      setNotificationPromptOpen(false)

      if (nextState === 'granted') {
        toast.success({
          title: 'Notifications enabled',
          message: 'DwarPal can now use browser and push-style notifications for future workflow updates on this device.',
        })
        return
      }

      if (nextState === 'denied') {
        toast.warning({
          title: 'Notifications denied',
          message: 'Browser notifications were denied. You can enable them later from your browser site settings.',
        })
        return
      }

      toast.info({
        title: 'Notifications postponed',
        message: 'No notification permission was granted yet. You can try again later.',
      })
    } catch {
      setNotificationPromptOpen(false)
      toast.error({
        title: 'Notification permission failed',
        message: 'DwarPal could not request browser notification permission right now.',
      })
    }
  }, [toast])

  const resolveApiError = useCallback(
    (error, { fallbackMessage, authMode = 'session' } = {}) => {
      const errorDetails = getApiErrorDetails(error, fallbackMessage)
      const requestPath = String(errorDetails.payload?.path || errorDetails.payload?.authPath || '').trim()
      const isAuthRequest = requestPath.startsWith('/auth/')

      if (error instanceof ApiError) {
        if (errorDetails.code === 'SMTP_NOT_CONFIGURED') {
          return {
            ...errorDetails,
            fieldErrors: {},
            message: 'Email service is not configured.',
          }
        }

        if (errorDetails.code === 'SMTP_AUTH_FAILED') {
          return {
            ...errorDetails,
            fieldErrors: {},
            message: 'Email login failed. Check Gmail App Password.',
          }
        }

        if (
          ['SMTP_DELIVERY_FAILED', 'SMTP_TIMEOUT', 'SMTP_CONNECTION_FAILED', 'OTP_EMAIL_DELIVERY_FAILED'].includes(
            errorDetails.code,
          ) ||
          /otp email could not be sent/i.test(errorDetails.message)
        ) {
          return {
            ...errorDetails,
            fieldErrors: {},
            message: errorDetails.message || 'OTP email could not be sent. Please try again later.',
          }
        }

        if (errorDetails.code === 'INVALID_API_RESPONSE') {
          return {
            ...errorDetails,
            fieldErrors: {},
            message:
              'DwarPal received an invalid response from the backend. Check the API base URL and any Vite proxy settings.',
          }
        }

        if (error.status === 0) {
          if (isAuthRequest) {
            return {
              ...errorDetails,
              fieldErrors: {},
              message: 'Starting DwarPal secure server. Please try again in a few seconds.',
            }
          }

          const requestUrl = String(errorDetails.payload?.requestUrl || '').trim()
          let backendTarget = ''

          if (requestUrl) {
            try {
              backendTarget = new URL(requestUrl).origin
            } catch {
              backendTarget = ''
            }
          }

          return {
            ...errorDetails,
            fieldErrors: {},
            message: backendTarget
              ? `Network error. Unable to reach the DwarPal backend at ${backendTarget}. Make sure the backend server is running, the API base URL is correct, and CORS allows this origin.`
              : 'Network error. Unable to reach the DwarPal backend right now. Please check the backend server, API base URL, and your connection.',
          }
        }

        if (error.status === 408) {
          if (isAuthRequest) {
            return {
              ...errorDetails,
              fieldErrors: {},
              message: 'Starting DwarPal secure server. Please try again in a few seconds.',
            }
          }

          return {
            ...errorDetails,
            fieldErrors: {},
            message: 'The request timed out. Please try again.',
          }
        }

        if (error.status === 404 && /route not found:/i.test(errorDetails.message)) {
          const missingRoute = errorDetails.message.replace(/^.*route not found:\s*/i, '').trim()

          return {
            ...errorDetails,
            fieldErrors: {},
            message: missingRoute
              ? `The DwarPal backend is reachable, but this API route is not available: ${missingRoute}.`
              : 'The DwarPal backend is reachable, but this API route is not available.',
          }
        }

        if (error.status === 401) {
          if (
            [
              'PORTAL_ACCESS_INVALID',
              'PORTAL_ACCESS_REQUIRED',
              'ERR_PORTAL_INVALID',
              'ERR_PORTAL_REQUIRED',
            ].includes(errorDetails.code)
          ) {
            return errorDetails
          }

          if (authMode === 'student-login') {
            return {
              ...errorDetails,
              fieldErrors: {},
              message: 'Invalid enrollment number or password.',
            }
          }

          if (authMode === 'login') {
            return {
              ...errorDetails,
              fieldErrors: {},
              message: 'Invalid credentials. Please check your enrollment number or employee ID and password.',
            }
          }

          if (authMode === 'session') {
            clearSession()
            return {
              ...errorDetails,
              fieldErrors: {},
              message: 'Your session has expired. Please sign in again.',
            }
          }
        }

        if (error.status >= 500) {
          if (
            errorDetails.message &&
            errorDetails.message !== fallbackMessage &&
            errorDetails.message !== 'Request failed.'
          ) {
            return errorDetails
          }

          return {
            ...errorDetails,
            fieldErrors: {},
            message: 'Server error. Please check the backend logs and try again.',
          }
        }
      }

      return errorDetails
    },
    [clearSession],
  )

  useEffect(() => {
    refreshNotificationPermissionState()

    if (typeof window === 'undefined') {
      return undefined
    }

    function handlePermissionSync() {
      refreshNotificationPermissionState()
    }

    window.addEventListener('focus', handlePermissionSync)
    document.addEventListener('visibilitychange', handlePermissionSync)

    return () => {
      window.removeEventListener('focus', handlePermissionSync)
      document.removeEventListener('visibilitychange', handlePermissionSync)
    }
  }, [refreshNotificationPermissionState])

  const loadWorkspace = useCallback(
    async (role, signal, requestOptions = workspaceRequestOptionsRef.current) => {
      if (!role) return

      const requestId = ++refreshRequestRef.current
      const workspace = await fetchWorkspace(role, signal, requestOptions)

      if (signal?.aborted || requestId !== refreshRequestRef.current) {
        return
      }

      setSummary(workspace.summary)
      setGatepasses(workspace.gatepasses)
      setGatepassMeta(createEmptyGatepassMeta(workspace.gatepassesMeta))
    },
    [],
  )

  const refreshAppData = useCallback(
    async (signal, { force = false, requestOptions = null } = {}) => {
      if (!currentUser?.role) return

      if (!force && refreshInFlightRef.current) {
        return
      }

      const resolvedRequestOptions = {
        ...workspaceRequestOptionsRef.current,
        ...(requestOptions || {}),
      }
      workspaceRequestOptionsRef.current = resolvedRequestOptions

      refreshInFlightRef.current = true

      try {
        await loadWorkspace(currentUser.role, signal, resolvedRequestOptions)
      } catch (error) {
        if (signal?.aborted || error?.name === 'AbortError') {
          return
        }

        const errorDetails = resolveApiError(error, { fallbackMessage: 'Unable to refresh dashboard data right now.' })

        if (errorDetails.status === 0 || errorDetails.status >= 500) {
          const now = Date.now()

          if (now - lastRefreshErrorToastAtRef.current >= REFRESH_ERROR_TOAST_COOLDOWN_MS) {
            lastRefreshErrorToastAtRef.current = now
            toast.error({
              title: 'Dashboard refresh failed',
              message: errorDetails.message,
            })
          }
        }
      } finally {
        refreshInFlightRef.current = false
      }
    },
    [currentUser?.role, loadWorkspace, resolveApiError, toast],
  )

  useEffect(() => {
    let ignore = false
    const controller = new AbortController()

    async function restoreSession() {
      const hasStoredSession = hasStoredAuthToken()
      let restoredUser = null

      logBootstrapDebug('auth restore started', {
        hasStoredSession,
        timeoutMs: AUTH_BOOTSTRAP_TIMEOUT_MS,
      })

      if (!hasStoredSession) {
        logBootstrapDebug('auth restore skipped', { reason: 'no stored session token' })
        if (!ignore) {
          setAuthReady(true)
        }
        return
      }

      try {
        restoredUser = await verifySession({
          signal: controller.signal,
          timeoutMs: AUTH_BOOTSTRAP_TIMEOUT_MS,
        })

        if (controller.signal.aborted || ignore) {
          return
        }

        if (restoredUser) {
          logBootstrapDebug('auth restore succeeded', {
            userId: restoredUser.id,
            role: restoredUser.role,
          })
          setCurrentUser(restoredUser)
          return
        }

        logBootstrapDebug('auth restore completed without an active session')
      } catch (error) {
        if (controller.signal.aborted || error?.name === 'AbortError') {
          logBootstrapDebug('auth restore aborted')
          return
        }

        const errorDetails = resolveApiError(error, {
          fallbackMessage: 'Unable to restore your DwarPal session right now.',
        })

        console.error('DwarPal auth bootstrap failed', error)
        logBootstrapDebug('auth restore failed', {
          status: errorDetails.status,
          message: errorDetails.message,
        })
      } finally {
        if (!ignore) {
          logBootstrapDebug('auth bootstrap resolved', {
            restoredUserId: restoredUser?.id || null,
          })
          setAuthReady(true)
        }
      }
    }

    restoreSession()

    return () => {
      ignore = true
      controller.abort()
    }
  }, [resolveApiError])

  useEffect(() => {
    if (!currentUser?.role) {
      refreshRequestRef.current += 1
      workspaceRequestOptionsRef.current = DEFAULT_WORKSPACE_REQUEST_OPTIONS
      resetWorkspace()
      return undefined
    }

    const controller = new AbortController()
    refreshAppData(controller.signal)

    return () => controller.abort()
  }, [currentUser?.id, currentUser?.role, refreshAppData, resetWorkspace])

  async function submitPortalAccess({ accessType, accessId, accessPassword }) {
    try {
      const result = await requestPortalAccess(accessType, accessId, accessPassword)
      savePortalAccess({
        accessType: result.accessType,
        token: result.token,
      })
      toast.success({
        title: 'Access verified',
        message:
          accessType === 'student'
            ? 'Student access confirmed. Continue with enrollment login and email OTP.'
            : 'Faculty access confirmed. Continue with login or registration.',
      })

      return {
        ok: true,
        ...result,
      }
    } catch (error) {
      const errorDetails = resolveApiError(error, {
        fallbackMessage: 'Unable to verify portal access right now.',
      })
      const resolvedMessage =
        errorDetails.code === 'PORTAL_ACCESS_DENIED' ? 'Invalid access ID or password.' : errorDetails.message

      if (
        [
          'PORTAL_ACCESS_INVALID',
          'PORTAL_ACCESS_DENIED',
          'PORTAL_ACCESS_REQUIRED',
          'ERR_PORTAL_INVALID',
          'ERR_PORTAL_REQUIRED',
        ].includes(errorDetails.code)
      ) {
        savePortalAccess(null, true)
      }

      toast.error({
        title: 'Access denied',
        message: resolvedMessage,
      })

      return {
        ok: false,
        error: resolvedMessage,
      }
    }
  }

  async function login(identifier, password) {
    const normalizedIdentifier = String(identifier || '').trim()

    try {
      let user
      if (portalAccess?.accessType === 'student') {
        const result = await startStudentLogin({ identifier: normalizedIdentifier, password })
        user = result.user
        if (!user) {
          throw new Error('Student login did not return user session details.')
        }
      } else {
        user = await loginUser(normalizedIdentifier, password)
      }
      setCurrentUser(user)
      toast.success({
        title: 'Login successful',
        message: `Welcome back to DwarPal, ${user.name}.`,
      })
      return { ok: true, user, dashboardPath: getLandingPathForUser(user) }
    } catch (error) {
      const errorDetails = resolveApiError(error, {
        fallbackMessage: 'Unable to complete DwarPal sign-in. Please try again.',
        authMode: portalAccess?.accessType === 'student' ? 'student-login' : 'login',
      })

      toast.error({
        title: 'Login failed',
        message: errorDetails.message,
      })

      return {
        ok: false,
        error: errorDetails.message,
        code: errorDetails.code,
        status: errorDetails.status,
      }
    }
  }

  async function resendStudentLoginOtpCode(loginToken) {
    try {
      const result = await startStudentLogin({
        loginToken,
        resend: true,
      })

      return {
        ok: true,
        message: result.message,
        loginToken: result.loginToken || loginToken,
        maskedEmail: result.maskedEmail || '',
        cooldownSeconds: result.cooldownSeconds || 45,
      }
    } catch (error) {
      const errorDetails = resolveApiError(error, {
        fallbackMessage: 'Unable to resend the student login OTP right now.',
        authMode: 'student-login',
      })

      return {
        ok: false,
        error: errorDetails.message,
        fieldErrors: errorDetails.fieldErrors,
      }
    }
  }

  async function verifyStudentLoginOtpCode({ loginToken, otp }) {
    try {
      const result = await verifyStudentLoginOtp(loginToken, otp)
      const verifiedUser = result.user || null

      if (verifiedUser) {
        setCurrentUser(verifiedUser)
        if (verifiedUser.mustChangePassword) {
          setStudentPasswordPromptOpen(true)
        }
      }

      toast.success({
        title: 'Student login successful',
        message: result.message || `Welcome back to DwarPal, ${verifiedUser?.name || 'student'}.`,
      })

      return {
        ok: true,
        message: result.message,
        user: verifiedUser,
        dashboardPath: getLandingPathForUser(verifiedUser),
      }
    } catch (error) {
      const errorDetails = resolveApiError(error, {
        fallbackMessage: 'Unable to verify this student OTP right now.',
        authMode: 'student-login',
      })

      return {
        ok: false,
        error: errorDetails.message,
        fieldErrors: errorDetails.fieldErrors,
      }
    }
  }

  async function requestStudentPasswordChangeOtp() {
    try {
      const result = await requestPasswordChange()

      return {
        ok: true,
        message: result.message,
        maskedEmail: result.maskedEmail || '',
        cooldownSeconds: result.cooldownSeconds || 45,
      }
    } catch (error) {
      const errorDetails = resolveApiError(error, {
        fallbackMessage: 'Unable to send the password change OTP right now.',
      })

      return {
        ok: false,
        error: errorDetails.message,
        fieldErrors: errorDetails.fieldErrors,
      }
    }
  }

  async function confirmStudentPasswordChange({ otp, newPassword, confirmPassword: confirmNewPassword }) {
    try {
      const result = await confirmPasswordChange(otp, newPassword, confirmNewPassword)

      if (result.user) {
        setCurrentUser(result.user)
      }

      setStudentPasswordPromptOpen(false)
      toast.success({
        title: 'Password updated',
        message: result.message || 'Your password has been changed successfully.',
      })

      return {
        ok: true,
        message: result.message,
        user: result.user || currentUser,
      }
    } catch (error) {
      const errorDetails = resolveApiError(error, {
        fallbackMessage: 'Unable to update your password right now.',
      })

      return {
        ok: false,
        error: errorDetails.message,
        fieldErrors: errorDetails.fieldErrors,
      }
    }
  }

  async function loginWithBiometric(identifier, mode = 'fingerprint') {
    try {
      const options = await createBiometricAuthenticationOptions(identifier)
      const response = await beginBiometricAuthentication(options)
      const user = await verifyBiometricAuthentication(response)
      setCurrentUser(user)
      toast.success({
        title: 'Login successful',
        message: `Signed in with ${mode === 'face' ? 'face recognition' : 'fingerprint'} successfully.`,
      })
      return { ok: true, user, dashboardPath: getLandingPathForUser(user) }
    } catch (error) {
      if (error instanceof ApiError) {
        const errorDetails = resolveApiError(error, {
          fallbackMessage: 'Biometric verification failed. Please try again or use manual login.',
          authMode: 'login',
        })
        toast.error({
          title: 'Biometric login failed',
          message: errorDetails.message,
        })

        return {
          ok: false,
          error: errorDetails.message,
          code: errorDetails.code,
          status: errorDetails.status,
        }
      }

      return {
        ok: false,
        error: getBiometricErrorMessage(error, mode === 'setup' ? 'setup' : 'login'),
      }
    }
  }

  async function registerAccount(payload) {
    const normalizedRole = normalizeRole(payload.role)
    const normalizedProgram = normalizeProgram(payload.program)
    const normalizedDepartment = normalizeDepartment(payload.department)
    const normalizedPhone = normalizePhoneNumberInput(payload.phone)
    const normalizedEnrollment = String(payload.enrollment || '').trim()
    const normalizedEmail = String(payload.email || '').trim().toLowerCase()
    const semester = Number(payload.semester)
    const requiresDepartment = ['student', 'faculty', 'hod'].includes(normalizedRole)
    const requiresProgram = roleUsesProgramRouting(normalizedRole)

    if (!normalizedRole) {
      return { ok: false, error: 'Please select a role.' }
    }

    if (requiresProgram && !normalizedProgram) {
      return { ok: false, error: 'Please select a program.' }
    }

    if (requiresDepartment && !normalizedDepartment) {
      return { ok: false, error: 'Please select a department.' }
    }

    if (!String(payload.enrollment || '').trim()) {
      return {
        ok: false,
        error:
          normalizedRole === 'student'
            ? 'Please enter your enrollment number.'
            : 'Please enter your employee ID.',
      }
    }

    if (normalizedRole === 'student' && !SEMESTER_OPTIONS.includes(semester)) {
      return { ok: false, error: 'Please select a semester for student accounts.' }
    }

    if (!normalizedPhone) {
      return {
        ok: false,
        error: 'Please enter a valid phone number.',
        fieldErrors: {
          phone: 'Please enter a valid phone number.',
        },
      }
    }

    try {
      const result = await registerUser({
        ...payload,
        email: normalizedEmail,
        enrollment: normalizedEnrollment,
        role: normalizedRole,
        program: requiresProgram ? normalizedProgram : '',
        department: requiresDepartment ? normalizedDepartment : '',
        phone: normalizedPhone,
      })

      return {
        ok: true,
        message: result.message || 'Account created successfully. You can sign in now.',
        email: result.email || normalizedEmail,
      }
    } catch (error) {
      const { message, fieldErrors } = resolveApiError(error, {
        fallbackMessage: 'Unable to create your account right now.',
      })

      return {
        ok: false,
        error: message,
        fieldErrors,
      }
    }
  }

  async function verifyRegistrationOtpCode({ email, otp }) {
    try {
      const result = await verifyRegistrationOtp(email, otp)

      return {
        ok: true,
        message: result.message,
        email: result.email || email,
      }
    } catch (error) {
      const { message } = resolveApiError(error, {
        fallbackMessage: 'Unable to verify your email right now.',
      })

      return {
        ok: false,
        error: message,
      }
    }
  }

  async function resendRegistrationOtpCode(email) {
    try {
      const result = await resendRegistrationOtp(email)

      return {
        ok: true,
        message: result.message,
        email: result.email || email,
        cooldownSeconds: result.cooldownSeconds || 45,
      }
    } catch (error) {
      const { message } = resolveApiError(error, {
        fallbackMessage: 'Unable to resend the verification OTP right now.',
      })

      return {
        ok: false,
        error: message,
      }
    }
  }

  async function sendCurrentUserVerificationOtp() {
    if (!currentUser?.id) {
      return {
        ok: false,
        error: 'Please sign in again to verify your email.',
      }
    }

    try {
      const result = await sendEmailVerificationOtp()

      if (result.user) {
        setCurrentUser(result.user)
      }

      return {
        ok: true,
        message: result.message,
        email: result.email || currentUser.email,
        verificationEmail: result.verificationEmail || currentUser.verificationEmail || currentUser.email,
        cooldownSeconds: result.cooldownSeconds || 45,
      }
    } catch (error) {
      const { message, fieldErrors } = resolveApiError(error, {
        fallbackMessage: 'Unable to send the verification OTP right now.',
      })

      return {
        ok: false,
        error: message,
        fieldErrors,
      }
    }
  }

  async function updateCurrentUserVerificationEmail(nextEmail) {
    if (!currentUser?.id) {
      return {
        ok: false,
        error: 'Please sign in again to update your verification email.',
      }
    }

    try {
      const result = await updateEmailVerificationEmail(nextEmail)

      if (result.user) {
        setCurrentUser(result.user)
      }

      return {
        ok: true,
        message: result.message,
        email: result.email || currentUser.email,
        verificationEmail: result.verificationEmail || nextEmail,
        cooldownSeconds: result.cooldownSeconds || 45,
      }
    } catch (error) {
      const { message, fieldErrors } = resolveApiError(error, {
        fallbackMessage: 'Unable to update the verification email right now.',
      })

      return {
        ok: false,
        error: message,
        fieldErrors,
      }
    }
  }

  async function verifyCurrentUserEmailOtpCode(otp) {
    if (!currentUser?.id) {
      return {
        ok: false,
        error: 'Please sign in again to verify your email.',
      }
    }

    try {
      const result = await verifyCurrentUserEmailOtp(otp)

      if (result.user) {
        setCurrentUser(result.user)
      }

      toast.success({
        title: 'Email verified',
        message: result.message || 'Your email has been verified successfully.',
      })

      return {
        ok: true,
        message: result.message,
        user: result.user || currentUser,
      }
    } catch (error) {
      const { message, fieldErrors } = resolveApiError(error, {
        fallbackMessage: 'Unable to verify this OTP right now.',
      })

      return {
        ok: false,
        error: message,
        fieldErrors,
      }
    }
  }

  async function resolveForgotPasswordAccountFlow(identifier) {
    try {
      const result = await resolveForgotPasswordAccount(identifier)

      return {
        ok: true,
        message: result.message,
        email: result.email,
        maskedEmail: result.maskedEmail || '',
        identifier: result.identifier || identifier,
      }
    } catch (error) {
      const { message, fieldErrors } = resolveApiError(error, {
        fallbackMessage: 'Unable to find the registered email for this account right now.',
      })

      return {
        ok: false,
        error: message,
        fieldErrors,
      }
    }
  }

  async function startForgotPasswordFlow({ identifier, email }) {
    try {
      const result = await startForgotPassword({ identifier, email })

      return {
        ok: true,
        message: result.message,
        email: result.email || email,
        maskedEmail: result.maskedEmail || '',
        identifier: result.identifier || identifier,
        cooldownSeconds: result.cooldownSeconds || 45,
      }
    } catch (error) {
      const { message, fieldErrors } = resolveApiError(error, {
        fallbackMessage: 'Unable to start password reset right now.',
      })

      return {
        ok: false,
        error: message,
        fieldErrors,
      }
    }
  }

  async function verifyForgotPasswordOtpCode({ email, otp }) {
    try {
      const result = await verifyForgotPasswordOtp(email, otp)

      return {
        ok: true,
        message: result.message,
        email: result.email || email,
      }
    } catch (error) {
      const { message, fieldErrors } = resolveApiError(error, {
        fallbackMessage: 'Unable to verify this reset OTP right now.',
      })

      return {
        ok: false,
        error: message,
        fieldErrors,
      }
    }
  }

  async function resetForgotPasswordFlow({ email, otp, newPassword, confirmPassword }) {
    try {
      const result = await resetForgotPassword(email, otp, newPassword, confirmPassword)

      return {
        ok: true,
        message: result.message,
        email: result.email || email,
      }
    } catch (error) {
      const { message, fieldErrors } = resolveApiError(error, {
        fallbackMessage: 'Unable to reset your password right now.',
      })

      return {
        ok: false,
        error: message,
        fieldErrors,
      }
    }
  }

  async function logout() {
    try {
      await logoutUser()
    } catch (error) {
      const errorDetails = resolveApiError(error, { fallbackMessage: 'Unable to complete logout cleanly.' })
      toast.warning({
        title: 'Logout issue',
        message: errorDetails.message,
      })
    } finally {
      clearSession()
      toast.info({
        title: 'Signed out',
        message: 'You have been logged out of DwarPal.',
      })
    }
  }

  function patchCurrentUser(updates) {
    setCurrentUser((previousUser) => (previousUser ? { ...previousUser, ...updates } : previousUser))
  }

  async function saveCurrentUserProfile(
    profileUpdates,
    {
      successTitle = 'Profile updated',
      successMessage = 'Your profile changes were saved successfully.',
      errorTitle = 'Profile update failed',
      fallbackErrorMessage = 'Unable to save your profile changes right now.',
    } = {},
  ) {
    if (!currentUser?.id) {
      return {
        ok: false,
        error: 'Please sign in again to update your profile.',
      }
    }

    try {
      let updatedUser;
      if (profileUpdates?.coordinatorAssignment) {
        const { isCoordinator, program, department, semester } = profileUpdates.coordinatorAssignment;
        if (isCoordinator) {
          const apiResult = await assignCoordinator({ program, department, semester });
          updatedUser = apiResult?.data?.user;
        } else {
          const prevAssignment = currentUser?.coordinatorAssignment || {};
          const apiResult = await resignCoordinator({
            program: prevAssignment.program || program,
            department: prevAssignment.department || department,
            semester: prevAssignment.semester || semester
          });
          updatedUser = apiResult?.data?.user;
        }
      } else {
        updatedUser = await updateCurrentUserProfile(profileUpdates);
      }

      if (updatedUser) {
        setCurrentUser(updatedUser)
      }

      if (successTitle || successMessage) {
        toast.success({
          title: successTitle,
          message: successMessage,
        })
      }

      return {
        ok: true,
        user: updatedUser || currentUser,
      }
    } catch (error) {
      const errorDetails = resolveApiError(error, {
        fallbackMessage: fallbackErrorMessage,
      })

      toast.error({
        title: errorTitle,
        message: errorDetails.message,
      })

      return {
        ok: false,
        error: errorDetails.message,
        fieldErrors: errorDetails.fieldErrors,
      }
    }
  }

  async function handleResignCoordinator() {
    if (!currentUser?.id) {
      return { ok: false, error: 'Sign in again to resign.' }
    }

    const prevAssignment = currentUser?.coordinatorAssignment || {}
    try {
      const apiResult = await resignCoordinator({
        program: prevAssignment.program,
        department: prevAssignment.department,
        semester: prevAssignment.semester
      })

      const updatedUser = apiResult?.data?.user;
      if (updatedUser) {
        setCurrentUser(updatedUser)
      }

      toast.success({
        title: 'Resignation complete',
        message: 'You have resigned as coordinator successfully.',
      })

      navigate('/user/dashboard', { replace: true })
      return { ok: true }
    } catch (error) {
      const errorDetails = resolveApiError(error, {
        fallbackMessage: 'Unable to resign as coordinator right now.',
      })

      toast.error({
        title: 'Resignation failed',
        message: errorDetails.message,
      })

      return {
        ok: false,
        error: errorDetails.message,
      }
    }
  }

  async function addGatepass(form) {
    if (!currentUser) {
      return { ok: false, error: 'Please sign in again to submit your request.' }
    }

    try {
      const isLeave = form.requestKind === 'faculty_leave'
      const requestPayload = isLeave
        ? {
            ...form,
          }
        : {
            ...form,
            requestKind: currentUser.role === 'faculty' ? 'faculty_gatepass' : 'student_gatepass',
            vehicleNumber: normalizeVehicleNumber(form.vehicleNumber),
          }

      const createdRequest = await submitRequest(requestPayload)
      setGatepasses((previousGatepasses) => [
        createdRequest,
        ...previousGatepasses.filter((item) => item.recordId !== createdRequest.recordId),
      ])
      // Show success toast and signal OK immediately — before refreshAppData so the
      // background auto-refresh interval (which uses its own AbortController) cannot
      // abort this refresh and race into the catch block, preventing modal close.
      toast.success({
        title: isLeave ? 'Leave request created' : 'Gatepass created',
        message: isLeave
          ? 'Your leave request was submitted successfully.'
          : 'Your gatepass request was submitted successfully.',
      })
      // Fire the workspace refresh in the background — the local state update above
      // already ensures the new gatepass appears in the list immediately.
      refreshAppData(undefined, { force: true }).catch(() => {})
      return { ok: true, request: createdRequest }
    } catch (error) {
      const { message, fieldErrors } = resolveApiError(error, {
        fallbackMessage: 'Unable to submit the request right now.',
      })
      toast.error({
        title: 'Request submission failed',
        message,
      })

      return {
        ok: false,
        error: message,
        fieldErrors,
      }
    }
  }

  async function updateGatepass(request, action, requestBody = null) {
    try {
      const updatedRequest = await updateRequestStatus(request, action, requestBody)
      // Update local state immediately so card UI reflects the new status/actions
      // without waiting for the background refresh to complete.
      setGatepasses((prev) =>
        prev.map((item) => (item.recordId === updatedRequest.recordId ? updatedRequest : item)),
      )
      const toastMeta = getActionToastMeta(request, action)
      toast[toastMeta.tone]?.({
        title: toastMeta.title,
        message: toastMeta.message,
      })
      // Fire refresh in background — don't await so the auto-refresh AbortController
      // cannot race into the catch block and produce a false failure toast.
      refreshAppData(undefined, { force: true }).catch(() => {})
      return { ok: true, request: updatedRequest }
    } catch (error) {
      const { message, fieldErrors } = resolveApiError(error, {
        fallbackMessage: 'Unable to update this request right now.',
      })
      toast.error({
        title: 'Request update failed',
        message,
      })

      return {
        ok: false,
        error: message,
        fieldErrors,
      }
    }
  }

  function renderAppShellRoute(routeRole = '') {
    const shell = (
      <NotificationProvider
        currentUser={requiresEmailVerification ? null : currentUser}
        notificationPermissionState={notificationPermissionState}
      >
        {/* Layer 2 — persistent push permission banner.
            Only renders when browser permission is 'default' (not yet asked).
            Does NOT auto-request — user must click "Enable" explicitly. */}
        {notificationPermissionState === 'default' && (
          <PushPromptBanner onPermissionChange={refreshNotificationPermissionState} />
        )}
        <div className={requiresEmailVerification ? 'app-shell-lock-surface' : ''} aria-hidden={requiresEmailVerification}>
          <AppShell
            currentUser={currentUser}
            summary={summary}
            gatepasses={gatepasses}
            gatepassMeta={gatepassMeta}
            onLogout={logout}
            onInactivityTimeout={handleInactivityTimeout}
            onAddGatepass={addGatepass}
            onCurrentUserPatch={patchCurrentUser}
            onUpdateCurrentUserProfile={saveCurrentUserProfile}
            onGatepassAction={updateGatepass}
            onRefreshData={refreshAppData}
            cookieConsent={cookieConsent}
            notificationPermissionState={notificationPermissionState}
            notificationsSupported={notificationPermissionState !== 'unsupported'}
            notificationPromptOpen={notificationPromptOpen}
            onManageCookiePreferences={handleOpenCookiePreferences}
            onOpenNotificationPrompt={handleOpenNotificationPrompt}
            onAllowNotificationPermission={handleAllowNotificationPrompt}
            onDeferNotificationPermission={handleDeferNotificationPrompt}
            onOpenSupport={() => setSupportModalOpen(true)}
          />
        </div>
        {/* TEMP_DISABLED_OTP */}
      </NotificationProvider>
    )

    if (routeRole) {
      return (
        <RoleDashboardRoute currentUser={currentUser} authReady={authReady} expectedRole={routeRole}>
          {shell}
        </RoleDashboardRoute>
      )
    }

    return (
      <ProtectedRoute currentUser={currentUser} authReady={authReady}>
        {shell}
      </ProtectedRoute>
    )
  }

  function renderAdminRoute() {
    return (
      <AdminRoute currentUser={currentUser} authReady={authReady}>
        <NotificationProvider currentUser={currentUser}>
          <div className={requiresEmailVerification ? 'app-shell-lock-surface' : ''} aria-hidden={requiresEmailVerification}>
            <Suspense fallback={<LoadingSpinner />}>
              <AdminPortal currentUser={currentUser} onLogout={logout} onOpenSupport={() => setSupportModalOpen(true)} onResign={handleResignCoordinator} />
            </Suspense>
          </div>
        </NotificationProvider>
        {/* TEMP_DISABLED_OTP */}
      </AdminRoute>
    )
  }

  function renderUserRoute() {
    return (
      <UserRoute currentUser={currentUser} authReady={authReady}>
        {renderAppShellRoute()}
      </UserRoute>
    )
  }

  function renderChairmanRoute() {
    return (
      <ChairmanRoute currentUser={currentUser} authReady={authReady}>
        <NotificationProvider currentUser={currentUser}>
          <div className={requiresEmailVerification ? 'app-shell-lock-surface' : ''} aria-hidden={requiresEmailVerification}>
            <Suspense fallback={<LoadingSpinner />}>
              <ChairmanPortal currentUser={currentUser} onLogout={logout} onOpenSupport={() => setSupportModalOpen(true)} />
            </Suspense>
          </div>
        </NotificationProvider>
      </ChairmanRoute>
    )
  }

  if (introLoading) {
    return <LoadingPage onFinished={() => setIntroLoading(false)} />
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={<DefaultRoute currentUser={currentUser} authReady={authReady} portalAccess={portalAccess} />}
        />
        <Route
          path="/access-portal"
          element={
            currentUser ? (
              <Navigate to={getLandingPathForUser(currentUser)} replace />
            ) : (portalAccess || getPortalAccessSession()) ? (
              <Navigate to="/login" replace />
            ) : (
              <Suspense fallback={<LoadingSpinner />}>
                <AccessPortal onAccessGranted={savePortalAccess} />
              </Suspense>
            )
          }
        />
        <Route
          path="/login"
          element={
            <PublicAuthRoute currentUser={currentUser} authReady={authReady} portalAccess={portalAccess}>
              <LoginScreen onLogin={login} portalAccess={portalAccess} />
            </PublicAuthRoute>
          }
        />
        <Route
          path="/student/login"
          element={
            <PublicAuthRoute currentUser={currentUser} authReady={authReady} targetRole="student">
              <LoginScreen onLogin={login} portalAccess={{ accessType: 'student', token: 'STUDENT_DIRECT_PORTAL' }} />
            </PublicAuthRoute>
          }
        />
        <Route
          path="/security/login"
          element={
            <PublicAuthRoute currentUser={currentUser} authReady={authReady} targetRole="faculty">
              <LoginScreen onLogin={login} portalAccess={{ accessType: 'faculty', token: 'FACULTY_DIRECT_PORTAL' }} />
            </PublicAuthRoute>
          }
        />
        <Route
          path="/gatekeeper/login"
          element={
            <PublicAuthRoute currentUser={currentUser} authReady={authReady} targetRole="faculty">
              <LoginScreen onLogin={login} portalAccess={{ accessType: 'faculty', token: 'FACULTY_DIRECT_PORTAL' }} />
            </PublicAuthRoute>
          }
        />
        <Route
          path="/faculty/login"
          element={
            <PublicAuthRoute currentUser={currentUser} authReady={authReady} targetRole="faculty">
              <LoginScreen onLogin={login} portalAccess={{ accessType: 'faculty', token: 'FACULTY_DIRECT_PORTAL' }} />
            </PublicAuthRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicAuthRoute currentUser={currentUser} authReady={authReady} portalAccess={{ accessType: 'faculty', token: 'FACULTY_DIRECT_PORTAL' }} isRegisterRoute={true}>
              <Suspense fallback={<LoadingSpinner />}>
                <Register setCurrentUser={setCurrentUser} onRegister={registerAccount} />
              </Suspense>
            </PublicAuthRoute>
          }
        />
        <Route path="/privacy-policy" element={
          <ErrorBoundary>
            <Suspense fallback={<LoadingSpinner />}>
              <LegalDocs onManageCookies={() => setCookieBannerForcedOpen(true)} />
            </Suspense>
          </ErrorBoundary>
        } />
        <Route path="/support" element={
          <ErrorBoundary>
            <Suspense fallback={<LoadingSpinner />}>
              <SupportPage />
            </Suspense>
          </ErrorBoundary>
        } />
        <Route path="/student/register" element={
          <ErrorBoundary>
            <Suspense fallback={<LoadingSpinner />}>
              <StudentRegisterPage />
            </Suspense>
          </ErrorBoundary>
        } />
        <Route path="/register/student" element={
          <ErrorBoundary>
            <Suspense fallback={<LoadingSpinner />}>
              <StudentRegisterPage />
            </Suspense>
          </ErrorBoundary>
        } />
        <Route
          path="/app/:page"
          element={renderAppShellRoute()}
        />
        <Route path="/user/:page" element={renderUserRoute()} />
        <Route path="/admin/*" element={renderAdminRoute()} />
        <Route path="/chairman/*" element={renderChairmanRoute()} />
        <Route path="/chairman" element={renderChairmanRoute()} />
        <Route path="/student/dashboard" element={renderAppShellRoute('student')} />
        <Route path="/faculty/dashboard" element={renderAppShellRoute('faculty')} />
        <Route path="/principal/dashboard" element={renderAppShellRoute('principal')} />
        <Route path="/hod/dashboard" element={renderAppShellRoute('hod')} />
        <Route path="/security/dashboard" element={renderAppShellRoute('security')} />
        <Route path="/cao/dashboard" element={renderAppShellRoute('cao')} />
        <Route
          path="*"
          element={
            <ErrorBoundary>
              <Suspense fallback={<LoadingSpinner />}>
                <NotFoundPage currentUser={currentUser} />
              </Suspense>
            </ErrorBoundary>
          }
        />
      </Routes>
      <FeatureBoundary label="Privacy preferences banner">
        <PrivacyPreferencesBanner
          open={!cookieConsent || cookieBannerForcedOpen}
          onAccept={() => handleCookiePreferenceChange('accepted')}
          onReject={() => handleCookiePreferenceChange('rejected')}
        />
      </FeatureBoundary>
      <Suspense fallback={null}>
        <SupportModal open={supportModalOpen} onClose={() => setSupportModalOpen(false)} support={SUPPORT_CONFIG} />
      </Suspense>
      {/* TEMP_DISABLED_OTP */}
    </BrowserRouter>
  )
}

function ProtectedRoute({ currentUser, authReady, children }) {
  useRouteGuardDebug('protected', authReady, currentUser)

  // Protected route logic: every authenticated screen verifies auth on render and replaces history on failure.
  if (!authReady) return <AuthBootstrapScreen />
  if (!currentUser) return <Navigate to="/login" replace />
  return children
}

function UserRoute({ currentUser, authReady, children }) {
  useRouteGuardDebug('user-panel', authReady, currentUser)

  if (!authReady) return <AuthBootstrapScreen />
  if (!currentUser) return <Navigate to="/login" replace />

  const role = normalizeRole(currentUser.role)
  if (!['student', 'faculty'].includes(role)) {
    return <Navigate to={getLandingPathForUser(currentUser)} replace />
  }

  return children
}

function AdminRoute({ currentUser, authReady, children }) {
  useRouteGuardDebug('admin-panel', authReady, currentUser)

  if (!authReady) return <AuthBootstrapScreen />
  if (!currentUser) return <Navigate to="/login" replace />

  if (!hasAdminPortalAccess(currentUser)) {
    return <Navigate to={getDashboardPathForRole(currentUser.role)} replace />
  }

  return children
}

function ChairmanRoute({ currentUser, authReady, children }) {
  useRouteGuardDebug('chairman-panel', authReady, currentUser)

  if (!authReady) return <AuthBootstrapScreen />
  if (!currentUser) return <Navigate to="/login" replace />

  const role = normalizeRole(currentUser.role)
  if (!['chairman', 'it', 'admin'].includes(role)) {
    return <Navigate to={getLandingPathForUser(currentUser)} replace />
  }

  return children
}

function RoleDashboardRoute({ currentUser, authReady, expectedRole, children }) {
  useRouteGuardDebug(`${expectedRole}-dashboard`, authReady, currentUser)

  if (!authReady) return <AuthBootstrapScreen />
  if (!currentUser) return <Navigate to="/login" replace />

  const normalizedCurrentRole = normalizeRole(currentUser.role)
  if (expectedRole === 'security' && (normalizedCurrentRole === 'security' || normalizedCurrentRole === 'campus_security')) {
    return children
  }
  if (normalizedCurrentRole !== expectedRole) {
    return <Navigate to={getLandingPathForUser(currentUser)} replace />
  }

  return children
}

function PublicAuthRoute({ currentUser, authReady, portalAccess, targetRole, isRegisterRoute = false, children }) {
  useRouteGuardDebug('public-auth', authReady, currentUser)

  if (!authReady) return <AuthBootstrapScreen />
  if (currentUser) return <Navigate to={getLandingPathForUser(currentUser)} replace />

  // If a target role is specified (e.g. /gatekeeper/login, /security/login, /student/login), sync session
  if (targetRole && typeof window !== 'undefined') {
    try {
      storePortalAccessSession({
        token: targetRole === 'student' ? 'STUDENT_DIRECT_PORTAL' : 'FACULTY_DIRECT_PORTAL',
        accessType: targetRole
      })
    } catch (e) {}
  }

  // If visiting /register, allow staff/gatekeeper registration directly
  if (isRegisterRoute) {
    if (typeof window !== 'undefined') {
      try {
        storePortalAccessSession({
          token: 'FACULTY_DIRECT_PORTAL',
          accessType: 'faculty'
        })
      } catch (e) {}
    }
    return children
  }

  const queryParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const isActivation = queryParams ? queryParams.get('action') === 'activate' : false

  const effectivePortalAccess = portalAccess || (targetRole ? { accessType: targetRole, token: targetRole === 'student' ? 'STUDENT_DIRECT_PORTAL' : 'FACULTY_DIRECT_PORTAL' } : getPortalAccessSession())
  if (!effectivePortalAccess && !isActivation) {
    return <Navigate to="/access-portal" replace />
  }

  return children
}

function DefaultRoute({ currentUser, authReady }) {
  useRouteGuardDebug('default', authReady, currentUser)

  if (authReady && currentUser) {
    return <Navigate to={getLandingPathForUser(currentUser)} replace />
  }

  return <LandingPage />
}

function AuthBootstrapScreen() {
  return <LoadingPage />
}

const formVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.08,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.42,
      ease: [0.22, 1, 0.36, 1],
    },
  },
}

function LoginScreen({ onLogin, portalAccess }) {
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const reduceMotion = useReducedMotion()

  const identifierLabel = 'Enrollment Number / Employee ID'
  const identifierPlaceholder = 'Enter your enrollment number or employee ID'
  const identifierUsageLabel = 'enrollment number or employee ID'
  const [form, setForm] = useState({ identifier: '', password: '' })
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submitLockRef = useRef(false)

  // Forgot password flow state
  const [forgotPasswordStep, setForgotPasswordStep] = useState(null) // null, 'id', 'otp', 'reset'
  const [forgotPasswordIdentifier, setForgotPasswordIdentifier] = useState('')
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('')
  const [forgotPasswordMaskedEmail, setForgotPasswordMaskedEmail] = useState('')
  const [forgotPasswordOtp, setForgotPasswordOtp] = useState('')
  const [forgotPasswordSecondsLeft, setForgotPasswordSecondsLeft] = useState(0)
  const [forgotPasswordNewPassword, setForgotPasswordNewPassword] = useState('')
  const [forgotPasswordConfirmPassword, setForgotPasswordConfirmPassword] = useState('')
  const [forgotPasswordIsSubmitting, setForgotPasswordIsSubmitting] = useState(false)
  const [forgotPasswordError, setForgotPasswordError] = useState('')
  const [forgotPasswordFieldErrors, setForgotPasswordFieldErrors] = useState({})
  const [isActivationFlow, setIsActivationFlow] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('action') === 'activate') {
      setForgotPasswordStep('id')
      setIsActivationFlow(true)
    }
  }, [location.search])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const rememberedIdentifier = window.localStorage.getItem(REMEMBERED_LOGIN_IDENTIFIER_STORAGE_KEY)

    if (!rememberedIdentifier) {
      return
    }

    setForm((previousForm) => ({
      ...previousForm,
      identifier: previousForm.identifier || rememberedIdentifier,
    }))
    setRememberMe(true)
  }, [])

  useEffect(() => {
    const authNotice = location.state?.authNotice

    if (!authNotice) {
      return
    }

    setSuccess(authNotice)
    setError('')
    navigate(location.pathname, { replace: true, state: null })
  }, [location.pathname, location.state, navigate])

  useEffect(() => {
    setError('')
    setSuccess('')
    setFieldErrors({})
    setForm((previousForm) => ({
      ...previousForm,
      password: '',
    }))
  }, [])

  // Timer for OTP countdown (starts at 600s, counts down)
  useEffect(() => {
    if (forgotPasswordStep !== 'otp' || forgotPasswordSecondsLeft <= 0) {
      return
    }

    const timer = setInterval(() => {
      setForgotPasswordSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [forgotPasswordStep, forgotPasswordSecondsLeft])

  function updateFormField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setFieldErrors((prev) => clearFieldError(prev, field))
    setError('')
    setSuccess('')
  }

  function handleRememberMeChange(nextValue) {
    setRememberMe(nextValue)

    if (!nextValue && typeof window !== 'undefined') {
      window.localStorage.removeItem(REMEMBERED_LOGIN_IDENTIFIER_STORAGE_KEY)
    }
  }

  async function handleLogin(event) {
    event.preventDefault()

    if (isSubmitting || submitLockRef.current) {
      return
    }

    const nextFieldErrors = getRequiredFieldErrors({
      identifier: form.identifier,
      password: form.password,
    })

    if (Object.keys(nextFieldErrors).length) {
      setFieldErrors(nextFieldErrors)
      setError(`Please enter both your ${identifierUsageLabel} and password.`)
      return
    }

    if (isEmailStyleIdentifier(form.identifier)) {
      setFieldErrors({
        identifier: `Email login is not allowed. Use your ${identifierUsageLabel}.`,
      })
      setError(`Email login is not allowed. Use your ${identifierUsageLabel}.`)
      return
    }

    setError('')
    setSuccess('')
    setFieldErrors({})
    submitLockRef.current = true
    setIsSubmitting(true)

    try {
      const normalizedIdentifier = String(form.identifier || '').trim()
      const result = await onLogin(normalizedIdentifier, form.password)
      if (!result?.ok) {
        setError(result?.error || 'Unable to sign in. Please try again.')
        return
      }

      if (typeof window !== 'undefined') {
        if (rememberMe) {
          window.localStorage.setItem(REMEMBERED_LOGIN_IDENTIFIER_STORAGE_KEY, normalizedIdentifier)
        } else {
          window.localStorage.removeItem(REMEMBERED_LOGIN_IDENTIFIER_STORAGE_KEY)
        }
      }

      const dashboardPath = result.dashboardPath || getLandingPathForUser(result.user)
      setSuccess('Login successful. Redirecting to your dashboard...')
      // Use replace so the previous login entry is not left as a reachable back-navigation target.
      navigate(dashboardPath, { replace: true })
    } catch (error) {
      setError(getApiErrorMessage(error, 'Unable to sign in right now. Please try again.'))
    } finally {
      submitLockRef.current = false
      setIsSubmitting(false)
    }
  }

  // OTP Request handler
  async function handleForgotPasswordRequest(event) {
    if (event) {
      event.preventDefault()
    }
    const targetIdentifier = forgotPasswordIdentifier.trim()
    if (!targetIdentifier) {
      setForgotPasswordFieldErrors({ identifier: 'Please enter your enrollment number or employee ID.' })
      return
    }

    setForgotPasswordIsSubmitting(true)
    setForgotPasswordError('')
    setForgotPasswordFieldErrors({})

    try {
      const res = await submitForgotPassword(targetIdentifier)
      if (!res.success) {
        setForgotPasswordError(res.message || 'Failed to request OTP.')
        return
      }

      setForgotPasswordEmail(res.email || '')
      setForgotPasswordMaskedEmail(res.maskedEmail || '')
      setForgotPasswordSecondsLeft(res.expiresInSeconds || 600)
      setForgotPasswordStep('otp')
      toast.success({
        title: 'OTP Sent',
        message: res.message || 'A verification OTP has been sent to your registered email.'
      })
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Unable to send OTP. Please try again.')
      setForgotPasswordError(msg)
      toast.error({
        title: 'Request Failed',
        message: msg
      })
    } finally {
      setForgotPasswordIsSubmitting(false)
    }
  }

  // OTP Verification handler
  async function handleForgotPasswordVerify(event) {
    event.preventDefault()
    if (forgotPasswordOtp.length !== 6) {
      setForgotPasswordFieldErrors({ otp: 'Please enter a 6-digit OTP code.' })
      return
    }

    setForgotPasswordIsSubmitting(true)
    setForgotPasswordError('')
    setForgotPasswordFieldErrors({})

    try {
      const res = await submitVerifyOtp(forgotPasswordIdentifier.trim(), forgotPasswordOtp)
      if (!res.success) {
        setForgotPasswordError(res.message || 'OTP verification failed.')
        return
      }

      setForgotPasswordStep('reset')
      toast.success({
        title: 'OTP Verified',
        message: 'Your verification OTP is valid. Please choose a new password.'
      })
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Unable to verify OTP. Please try again.')
      setForgotPasswordError(msg)
      toast.error({
        title: 'Verification Failed',
        message: msg
      })
    } finally {
      setForgotPasswordIsSubmitting(false)
    }
  }

  // Password Reset handler
  async function handleForgotPasswordReset(event) {
    event.preventDefault()
    const nextFieldErrors = {}
    const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/

    if (!passwordPattern.test(forgotPasswordNewPassword)) {
      nextFieldErrors.newPassword = 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.'
    }

    if (forgotPasswordConfirmPassword !== forgotPasswordNewPassword) {
      nextFieldErrors.confirmPassword = 'Confirm password must match the new password.'
    }

    if (Object.keys(nextFieldErrors).length) {
      setForgotPasswordFieldErrors(nextFieldErrors)
      return
    }

    setForgotPasswordIsSubmitting(true)
    setForgotPasswordError('')
    setForgotPasswordFieldErrors({})

    try {
      const res = await submitResetPassword(
        forgotPasswordIdentifier.trim(),
        forgotPasswordOtp,
        forgotPasswordNewPassword
      )
      if (!res.success) {
        setForgotPasswordError(res.message || 'Password reset failed.')
        return
      }

      toast.success({
        title: 'Password Reset Successful',
        message: 'Your password has been updated successfully. You can now log in.'
      })

      // Reset states and return to login
      setForgotPasswordStep(null)
      setForgotPasswordIdentifier('')
      setForgotPasswordOtp('')
      setForgotPasswordNewPassword('')
      setForgotPasswordConfirmPassword('')
      setForm({ identifier: forgotPasswordIdentifier, password: '' })
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Unable to reset password. Please try again.')
      setForgotPasswordError(msg)
      toast.error({
        title: 'Reset Failed',
        message: msg
      })
    } finally {
      setForgotPasswordIsSubmitting(false)
    }
  }

  // Conditional rendering helper for right panel
  const renderRightPanel = () => {
    if (forgotPasswordStep === 'id') {
      return (
        <div className="tw:relative tw:flex tw:w-full tw:flex-col tw:bg-transparent tw:text-[#163247]">
          <motion.div
            variants={formVariants}
            initial={reduceMotion ? false : 'hidden'}
            animate="visible"
            className="tw:relative tw:z-10 tw:flex tw:w-full tw:flex-col tw:justify-center"
          >
            <motion.div
              variants={itemVariants}
              className="tw:w-full tw:text-[#163247]"
            >
              <div className="tw:space-y-6">
                <motion.div
                  variants={itemVariants}
                  className="tw:flex tw:flex-col tw:items-center tw:gap-4 tw:text-center"
                >
                  <div className="tw:flex tw:h-24 tw:w-24 tw:items-center tw:justify-center tw:rounded-3xl tw:border tw:border-[rgba(105,143,176,0.2)] tw:bg-white/60 tw:shadow-sm">
                    <KeyRound className="tw:h-14 tw:w-14 tw:text-[#2f6db5]" />
                  </div>
                  <div className="tw:space-y-2">
                    <h1 className="tw:font-display tw:text-3xl tw:font-bold tw:leading-none tw:tracking-[-0.05em] tw:text-[#163247]">
                      {isActivationFlow ? 'Activate Account' : 'Forgot Password'}
                    </h1>
                    <p className="tw:text-sm tw:font-medium tw:text-neutral-500">
                      {isActivationFlow
                        ? 'Enter your enrollment number or employee ID to activate your account. (If your account is already active, you can still use this page to reset your password.)'
                        : 'Enter your enrollment number or employee ID to reset your password'}
                    </p>
                  </div>
                </motion.div>

                <motion.form
                  variants={formVariants}
                  onSubmit={handleForgotPasswordRequest}
                  noValidate
                  className="tw:space-y-5"
                >
                  <motion.div variants={itemVariants} className="tw:space-y-2">
                    <label htmlFor="forgot-identifier" className="tw:block tw:text-[0.84rem] tw:font-semibold tw:text-neutral-700 tw:tracking-wide">
                      Enrollment Number / Employee ID
                    </label>
                    <div className="tw:group tw:relative tw:mt-1.5">
                      <div className="tw:absolute tw:inset-0 tw:rounded-xl tw:bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(227,239,251,0.72))]" />
                      <input
                        id="forgot-identifier"
                        type="text"
                        value={forgotPasswordIdentifier}
                        onChange={(e) => {
                          setForgotPasswordIdentifier(e.target.value)
                          setForgotPasswordFieldErrors({})
                          setForgotPasswordError('')
                        }}
                        placeholder="Enter your enrollment number or employee ID"
                        disabled={forgotPasswordIsSubmitting}
                        className={[
                          'tw:relative tw:w-full tw:h-12 tw:rounded-xl tw:border tw:bg-transparent tw:px-4 tw:py-3.5 tw:text-[0.98rem] tw:outline-none tw:transition tw:duration-200',
                          forgotPasswordFieldErrors.identifier ? 'field-invalid' : 'tw:border-[#173449]/10',
                        ].join(' ')}
                      />
                    </div>
                    {forgotPasswordFieldErrors.identifier ? (
                      <p className="tw:text-[0.82rem] tw:font-medium tw:text-red-500 tw:mt-1">{forgotPasswordFieldErrors.identifier}</p>
                    ) : null}
                  </motion.div>

                  {forgotPasswordError ? (
                    <motion.div
                      variants={itemVariants}
                      role="alert"
                      className="form-error tw:mb-3"
                      style={{ textAlign: 'center', fontWeight: 500 }}
                    >
                      {forgotPasswordError}
                    </motion.div>
                  ) : null}

                  <motion.div variants={itemVariants} className="tw:flex tw:gap-4">
                    <button
                      type="button"
                      onClick={() => {
                        setForgotPasswordStep(null)
                        setForgotPasswordIdentifier('')
                        setForgotPasswordError('')
                        setIsActivationFlow(false)
                      }}
                      disabled={forgotPasswordIsSubmitting}
                      className="tw:flex tw:h-12 tw:w-1/2 tw:items-center tw:justify-center tw:rounded-xl tw:border tw:border-[rgba(105,143,176,0.28)] tw:bg-[rgba(255,255,255,0.74)] tw:text-[#48637c] tw:transition tw:duration-200 hover:tw:bg-white hover:tw:text-[#2f6db5] focus-visible:tw:outline-none disabled:tw:cursor-not-allowed"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={forgotPasswordIsSubmitting || !forgotPasswordIdentifier.trim()}
                      className="action-button primary tw:flex tw:h-12 tw:w-1/2 tw:items-center tw:justify-center tw:rounded-xl tw:px-4 tw:py-3.5 tw:text-[0.98rem] tw:font-semibold tw:disabled:cursor-not-allowed"
                    >
                      {forgotPasswordIsSubmitting ? 'Requesting...' : 'Request OTP'}
                    </button>
                  </motion.div>
                </motion.form>
              </div>
            </motion.div>
          </motion.div>
        </div>
      )
    }

    if (forgotPasswordStep === 'otp') {
      return (
        <div className="tw:relative tw:flex tw:w-full tw:flex-col tw:bg-transparent tw:text-[#163247]">
          <motion.div
            variants={formVariants}
            initial={reduceMotion ? false : 'hidden'}
            animate="visible"
            className="tw:relative tw:z-10 tw:flex tw:w-full tw:flex-col tw:justify-center"
          >
            <motion.div
              variants={itemVariants}
              className="tw:w-full tw:text-[#163247]"
            >
              <div className="tw:space-y-6">
                <motion.div
                  variants={itemVariants}
                  className="tw:flex tw:flex-col tw:items-center tw:gap-4 tw:text-center"
                >
                  <div className="tw:flex tw:h-24 tw:w-24 tw:items-center tw:justify-center tw:rounded-3xl tw:border tw:border-[rgba(105,143,176,0.2)] tw:bg-white/60 tw:shadow-sm">
                    <Clock3 className="tw:h-14 tw:w-14 tw:text-[#2f6db5]" />
                  </div>
                  <div className="tw:space-y-2">
                    <h1 className="tw:font-display tw:text-3xl tw:font-bold tw:leading-none tw:tracking-[-0.05em] tw:text-[#163247]">
                      Verify OTP
                    </h1>
                    <p className="tw:text-sm tw:font-medium tw:text-neutral-500">
                      We've sent a 6-digit verification code to {forgotPasswordMaskedEmail || forgotPasswordEmail}
                    </p>
                  </div>
                </motion.div>

                <motion.form
                  variants={formVariants}
                  onSubmit={handleForgotPasswordVerify}
                  noValidate
                  className="tw:space-y-5"
                >
                  <motion.div variants={itemVariants} className="tw:space-y-2">
                    <label className="tw:block tw:text-[0.84rem] tw:font-semibold tw:text-neutral-700 tw:tracking-wide tw:text-center">
                      Enter 6-Digit OTP
                    </label>
                    <div className="tw:flex tw:justify-center">
                      <OtpCodeInput
                        value={forgotPasswordOtp}
                        onChange={(val) => {
                          setForgotPasswordOtp(val)
                          setForgotPasswordFieldErrors({})
                          setForgotPasswordError('')
                        }}
                        disabled={forgotPasswordIsSubmitting}
                        autoFocus
                      />
                    </div>
                    {forgotPasswordFieldErrors.otp ? (
                      <p className="tw:text-[0.82rem] tw:font-medium tw:text-red-500 tw:text-center tw:mt-1">{forgotPasswordFieldErrors.otp}</p>
                    ) : null}
                  </motion.div>

                  <motion.div variants={itemVariants} className="tw:text-center tw:text-sm tw:font-medium tw:text-neutral-500">
                    {forgotPasswordSecondsLeft > 0 ? (
                      <span>OTP expires in: <strong className="tw:text-[#2f6db5]">{Math.floor(forgotPasswordSecondsLeft / 60)}:{String(forgotPasswordSecondsLeft % 60).padStart(2, '0')}</strong></span>
                    ) : (
                      <span className="tw:text-red-500">OTP has expired. Please request a new code.</span>
                    )}
                  </motion.div>

                  <motion.div variants={itemVariants} className="tw:text-center">
                    <button
                      type="button"
                      onClick={handleForgotPasswordRequest}
                      disabled={forgotPasswordSecondsLeft > 0 || forgotPasswordIsSubmitting}
                      className="tw:border-none tw:bg-transparent tw:p-0 tw:text-[0.92rem] tw:font-semibold tw:text-neutral-500 tw:underline tw:underline-offset-4 tw:transition tw:duration-200 hover:tw:text-[#2f6db5] disabled:tw:opacity-55"
                    >
                      Resend OTP
                    </button>
                  </motion.div>

                  {forgotPasswordError ? (
                    <motion.div
                      variants={itemVariants}
                      role="alert"
                      className="form-error tw:mb-3"
                      style={{ textAlign: 'center', fontWeight: 500 }}
                    >
                      {forgotPasswordError}
                    </motion.div>
                  ) : null}

                  <motion.div variants={itemVariants} className="tw:flex tw:gap-4">
                    <button
                      type="button"
                      onClick={() => {
                        setForgotPasswordStep('id')
                        setForgotPasswordOtp('')
                        setForgotPasswordError('')
                      }}
                      disabled={forgotPasswordIsSubmitting}
                      className="tw:flex tw:h-12 tw:w-1/2 tw:items-center tw:justify-center tw:rounded-xl tw:border tw:border-[rgba(105,143,176,0.28)] tw:bg-[rgba(255,255,255,0.74)] tw:text-[#48637c] tw:transition tw:duration-200 hover:tw:bg-white hover:tw:text-[#2f6db5] focus-visible:tw:outline-none disabled:tw:cursor-not-allowed"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={forgotPasswordIsSubmitting || forgotPasswordOtp.length !== 6}
                      className="action-button primary tw:flex tw:h-12 tw:w-1/2 tw:items-center tw:justify-center tw:rounded-xl tw:px-4 tw:py-3.5 tw:text-[0.98rem] tw:font-semibold tw:disabled:cursor-not-allowed"
                    >
                      {forgotPasswordIsSubmitting ? 'Verifying...' : 'Verify OTP'}
                    </button>
                  </motion.div>
                </motion.form>
              </div>
            </motion.div>
          </motion.div>
        </div>
      )
    }

    if (forgotPasswordStep === 'reset') {
      return (
        <div className="tw:relative tw:flex tw:w-full tw:flex-col tw:bg-transparent tw:text-[#163247]">
          <motion.div
            variants={formVariants}
            initial={reduceMotion ? false : 'hidden'}
            animate="visible"
            className="tw:relative tw:z-10 tw:flex tw:w-full tw:flex-col tw:justify-center"
          >
            <motion.div
              variants={itemVariants}
              className="tw:w-full tw:text-[#163247]"
            >
              <div className="tw:space-y-6">
                <motion.div
                  variants={itemVariants}
                  className="tw:flex tw:flex-col tw:items-center tw:gap-4 tw:text-center"
                >
                  <div className="tw:flex tw:h-24 tw:w-24 tw:items-center tw:justify-center tw:rounded-3xl tw:border tw:border-[rgba(105,143,176,0.2)] tw:bg-white/60 tw:shadow-sm">
                    <KeyRound className="tw:h-14 tw:w-14 tw:text-[#2f6db5]" />
                  </div>
                  <div className="tw:space-y-2">
                    <h1 className="tw:font-display tw:text-3xl tw:font-bold tw:leading-none tw:tracking-[-0.05em] tw:text-[#163247]">
                      Reset Password
                    </h1>
                    <p className="tw:text-sm tw:font-medium tw:text-neutral-500">
                      Please choose a secure new password for your account
                    </p>
                  </div>
                </motion.div>

                <motion.form
                  variants={formVariants}
                  onSubmit={handleForgotPasswordReset}
                  noValidate
                  className="tw:space-y-5"
                >
                  <motion.div variants={itemVariants} className="tw:space-y-2">
                    <label htmlFor="new-password" className="tw:block tw:text-[0.84rem] tw:font-semibold tw:text-neutral-700 tw:tracking-wide">
                      New Password
                    </label>
                    <div className="tw:group tw:relative tw:mt-1.5">
                      <div className="tw:absolute tw:inset-0 tw:rounded-xl tw:bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(227,239,251,0.72))]" />
                      <PasswordInput
                        id="new-password"
                        value={forgotPasswordNewPassword}
                        onChange={(val) => {
                          setForgotPasswordNewPassword(val)
                          setForgotPasswordFieldErrors({})
                          setForgotPasswordError('')
                        }}
                        placeholder="Enter your new password"
                        autoComplete="new-password"
                        disabled={forgotPasswordIsSubmitting}
                        ariaInvalid={Boolean(forgotPasswordFieldErrors.newPassword)}
                        wrapperClassName="tw:relative tw:z-[1]"
                        className={[
                          'tw:relative tw:w-full tw:h-12 tw:rounded-xl tw:border tw:bg-transparent tw:px-4 tw:py-3.5 tw:pr-12 tw:text-[0.98rem] tw:outline-none tw:transition tw:duration-200',
                          forgotPasswordFieldErrors.newPassword ? 'field-invalid' : 'tw:border-[#173449]/10',
                        ].join(' ')}
                        toggleClassName="tw:absolute tw:right-3 tw:top-0 tw:bottom-0 tw:my-auto tw:grid tw:h-9 tw:w-9 tw:place-items-center tw:rounded-lg tw:border tw:border-[rgba(105,143,176,0.28)] tw:bg-[rgba(255,255,255,0.74)] tw:text-[#48637c] tw:transition tw:duration-200 hover:tw:bg-white hover:tw:text-[#2f6db5] focus-visible:tw:outline-none disabled:tw:cursor-not-allowed"
                      />
                    </div>
                    {forgotPasswordFieldErrors.newPassword ? (
                      <p className="tw:text-[0.82rem] tw:font-medium tw:text-red-500 tw:mt-1">{forgotPasswordFieldErrors.newPassword}</p>
                    ) : null}
                  </motion.div>

                  <motion.div variants={itemVariants} className="tw:space-y-2">
                    <label htmlFor="confirm-password" className="tw:block tw:text-[0.84rem] tw:font-semibold tw:text-neutral-700 tw:tracking-wide">
                      Confirm Password
                    </label>
                    <div className="tw:group tw:relative tw:mt-1.5">
                      <div className="tw:absolute tw:inset-0 tw:rounded-xl tw:bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(227,239,251,0.72))]" />
                      <PasswordInput
                        id="confirm-password"
                        value={forgotPasswordConfirmPassword}
                        onChange={(val) => {
                          setForgotPasswordConfirmPassword(val)
                          setForgotPasswordFieldErrors({})
                          setForgotPasswordError('')
                        }}
                        placeholder="Confirm your new password"
                        autoComplete="new-password"
                        disabled={forgotPasswordIsSubmitting}
                        ariaInvalid={Boolean(forgotPasswordFieldErrors.confirmPassword)}
                        wrapperClassName="tw:relative tw:z-[1]"
                        className={[
                          'tw:relative tw:w-full tw:h-12 tw:rounded-xl tw:border tw:bg-transparent tw:px-4 tw:py-3.5 tw:pr-12 tw:text-[0.98rem] tw:outline-none tw:transition tw:duration-200',
                          forgotPasswordFieldErrors.confirmPassword ? 'field-invalid' : 'tw:border-[#173449]/10',
                        ].join(' ')}
                        toggleClassName="tw:absolute tw:right-3 tw:top-0 tw:bottom-0 tw:my-auto tw:grid tw:h-9 tw:w-9 tw:place-items-center tw:rounded-lg tw:border tw:border-[rgba(105,143,176,0.28)] tw:bg-[rgba(255,255,255,0.74)] tw:text-[#48637c] tw:transition tw:duration-200 hover:tw:bg-white hover:tw:text-[#2f6db5] focus-visible:tw:outline-none disabled:tw:cursor-not-allowed"
                      />
                    </div>
                    {forgotPasswordFieldErrors.confirmPassword ? (
                      <p className="tw:text-[0.82rem] tw:font-medium tw:text-red-500 tw:mt-1">{forgotPasswordFieldErrors.confirmPassword}</p>
                    ) : null}
                  </motion.div>

                  {forgotPasswordError ? (
                    <motion.div
                      variants={itemVariants}
                      role="alert"
                      className="form-error tw:mb-3"
                      style={{ textAlign: 'center', fontWeight: 500 }}
                    >
                      {forgotPasswordError}
                    </motion.div>
                  ) : null}

                  <motion.div variants={itemVariants} className="tw:flex tw:gap-4">
                    <button
                      type="button"
                      onClick={() => {
                        setForgotPasswordStep(null)
                        setForgotPasswordNewPassword('')
                        setForgotPasswordConfirmPassword('')
                        setForgotPasswordError('')
                      }}
                      disabled={forgotPasswordIsSubmitting}
                      className="tw:flex tw:h-12 tw:w-1/2 tw:items-center tw:justify-center tw:rounded-xl tw:border tw:border-[rgba(105,143,176,0.28)] tw:bg-[rgba(255,255,255,0.74)] tw:text-[#48637c] tw:transition tw:duration-200 hover:tw:bg-white hover:tw:text-[#2f6db5] focus-visible:tw:outline-none disabled:tw:cursor-not-allowed"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={forgotPasswordIsSubmitting || !forgotPasswordNewPassword || !forgotPasswordConfirmPassword}
                      className="action-button primary tw:flex tw:h-12 tw:w-1/2 tw:items-center tw:justify-center tw:rounded-xl tw:px-4 tw:py-3.5 tw:text-[0.98rem] tw:font-semibold tw:disabled:cursor-not-allowed"
                    >
                      {forgotPasswordIsSubmitting ? 'Resetting...' : 'Reset Password'}
                    </button>
                  </motion.div>
                </motion.form>
              </div>
            </motion.div>
          </motion.div>
        </div>
      )
    }

    return (
      <LoginForm
        identifier={form.identifier}
        password={form.password}
        rememberMe={rememberMe}
        onIdentifierChange={(value) => updateFormField('identifier', value)}
        onPasswordChange={(value) => updateFormField('password', value)}
        onRememberMeChange={handleRememberMeChange}
        onForgotPassword={() => {
          setForgotPasswordStep('id')
          setForgotPasswordIdentifier(form.identifier || '')
        }}
        onSubmit={handleLogin}
        error={error}
        success={success}
        fieldErrors={fieldErrors}
        isSubmitting={isSubmitting}
        identifierLabel={identifierLabel}
        identifierPlaceholder={identifierPlaceholder}
        title="DwarPal"
        subtitle="Sign in to continue to your dashboard"
        submitLabel="Sign in"
        showForgotPassword={true}
        showStudentRegisterLink={portalAccess?.accessType === 'student'}
        showRegisterLink={portalAccess?.accessType !== 'student'}
      />
    )
  }

  return (
    <div className="auth-shell" style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>
      <div className="auth-background" aria-hidden="true">
        <div className="bg-orb bg-orb-left" />
        <div className="bg-orb bg-orb-right" />
        <div className="bg-grid" />
        
        <div className="floating-card building-card">
          <span className="floating-label">Campus Block</span>
          <div className="building-roof" />
          <div className="building-body">
            <span /><span /><span /><span /><span /><span />
          </div>
        </div>
        
        <div className="floating-card pass-card">
          <span className="floating-label">Gatepass</span>
          <div className="pass-lines">
            <span /><span /><span />
          </div>
          <div className="pass-badge" />
        </div>
        
        <div className="floating-card gate-card">
          <span className="floating-label">Security Gate</span>
          <div className="gate-frame">
            <span /><span /><span />
          </div>
        </div>
        
        <div className="floating-card path-card">
          <span className="floating-label">Campus Flow</span>
          <div className="path-lines">
            <span /><span />
          </div>
        </div>
      </div>

      <div className="auth-panel" style={{ zIndex: 10 }}>
        {renderRightPanel()}
      </div>
    </div>
  )
}

function RegisterScreen({ onRegister }) {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '',
    email: '',
    program: '',
    department: '',
    enrollment: '',
    phone: '',
    role: '',
    semester: '',
    password: '',
    designation: '',
    securityZone: '',
    accessLevel: '',
    authorityLevel: '',
  })
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [isRegistering, setIsRegistering] = useState(false)

  const [programsList, setProgramsList] = useState(PROGRAM_OPTIONS)
  const [departmentsList, setDepartmentsList] = useState(DEPARTMENTS)

  useEffect(() => {
    let ignore = false
    const controller = new AbortController()

    async function fetchConfig() {
      try {
        const response = await fetch(buildApiUrl('/public/frontend-config'), {
          signal: controller.signal,
          headers: { Accept: 'application/json' }
        })
        if (response.ok) {
          const result = await response.json()
          if (!ignore && result?.data) {
            if (Array.isArray(result.data.programs)) {
              setProgramsList(result.data.programs)
            }
            if (Array.isArray(result.data.departments)) {
              setDepartmentsList(result.data.departments)
            }
          }
        }
      } catch (err) {
        console.warn('Failed to load dynamic programs/departments from backend, using defaults', err)
      }
    }

    fetchConfig()
    return () => {
      ignore = true
      controller.abort()
    }
  }, [])

  const hasSelectedRole = Boolean(form.role)
  const isStudentRole = form.role === 'student'
  const isSecurityRole = form.role === 'security'
  const requiresProgram = roleUsesProgramRouting(form.role)
  const departmentOptions = departmentsList
  const showDepartmentField = hasSelectedRole && ['faculty', 'hod'].includes(form.role)
  const requiresDepartment = hasSelectedRole ? ['faculty', 'hod'].includes(form.role) : true
  const roleIdLabel = isStudentRole ? 'Enrollment Number' : hasSelectedRole ? 'Employee ID' : 'Enrollment Number / Employee ID'
  const roleIdName = isStudentRole ? 'enrollmentNo' : hasSelectedRole ? 'employeeId' : 'identifier'
  const roleIdPlaceholder = isStudentRole
    ? 'Enter your enrollment number'
    : hasSelectedRole
      ? 'Enter your employee ID'
      : 'Select a role to continue'

  function resetForm() {
    setForm({
      name: '',
      email: '',
      program: '',
      department: '',
      enrollment: '',
      phone: '',
      role: '',
      semester: '',
      password: '',
      designation: '',
      securityZone: '',
      accessLevel: '',
      authorityLevel: '',
    })
  }

  function buildSubmissionPayload() {
    const normalizedRole = normalizeRole(form.role)
    const normalizedProgram = normalizeProgram(form.program)
    const normalizedDepartment = normalizeDepartment(form.department)
    const normalizedPhone = normalizePhoneNumberInput(form.phone)
    const normalizedEmail = String(form.email || '').trim().toLowerCase()
    const normalizedEnrollment = String(form.enrollment || '').trim()
    const semester = Number(form.semester)

    const nextFieldErrors = getRequiredFieldErrors({
      name: form.name,
      email: form.email,
      ...(requiresProgram ? { program: form.program } : {}),
      ...(showDepartmentField ? { department: form.department } : {}),
      enrollment: form.enrollment,
      phone: form.phone,
      role: form.role,
      ...(isStudentRole ? { semester: form.semester } : {}),
      password: form.password,
      ...(form.role === 'faculty' ? { designation: form.designation } : {}),
      ...(form.role === 'security' ? { securityZone: form.securityZone } : {}),
      ...(form.role === 'admin' ? { accessLevel: form.accessLevel } : {}),
      ...(form.role === 'cao' ? { authorityLevel: form.authorityLevel } : {}),
    })

    if (!normalizedPhone) {
      nextFieldErrors.phone = 'Please enter a valid phone number.'
    }

    if (isStudentRole && !SEMESTER_OPTIONS.includes(semester)) {
      nextFieldErrors.semester = 'Please select a valid semester.'
    }

    if (Object.keys(nextFieldErrors).length) {
      return {
        ok: false,
        fieldErrors: nextFieldErrors,
      }
    }

    return {
      ok: true,
      payload: {
        ...form,
        email: normalizedEmail,
        enrollment: normalizedEnrollment,
        phone: normalizedPhone,
        role: normalizedRole,
        program: requiresProgram ? normalizedProgram : '',
        department: requiresDepartment ? normalizedDepartment : '',
        designation: ['faculty', 'hod', 'principal'].includes(form.role)
          ? (form.role === 'hod' ? 'Academic HOD' : form.role === 'principal' ? 'Principal' : String(form.designation).trim())
          : '',
        securityZone: form.role === 'security' ? String(form.securityZone).trim() : '',
        accessLevel: form.role === 'admin' ? String(form.accessLevel).trim() : '',
        authorityLevel: form.role === 'cao' ? String(form.authorityLevel).trim() : '',
      },
    }
  }

  function updateFormField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setFieldErrors((prev) => clearFieldError(prev, field))
    setError('')
  }

  function handleRoleChange(event) {
    const nextRole = normalizeRole(event.target.value)
    const nextRoleUsesProgram = roleUsesProgramRouting(nextRole)

    setForm((prev) => ({
      ...prev,
      role: nextRole,
      program: nextRoleUsesProgram ? prev.program : '',
      department: ['faculty', 'hod'].includes(nextRole) ? prev.department : '',
      enrollment: (prev.role === 'student') !== (nextRole === 'student') ? '' : prev.enrollment,
      semester: nextRole === 'student' ? prev.semester : '',
      designation: nextRole === 'faculty' ? prev.designation : nextRole === 'hod' ? 'Academic HOD' : nextRole === 'principal' ? 'Principal' : '',
      securityZone: nextRole === 'security' ? prev.securityZone : '',
      accessLevel: nextRole === 'admin' ? prev.accessLevel : '',
      authorityLevel: nextRole === 'cao' ? prev.authorityLevel : '',
    }))
    setFieldErrors((prev) => {
      const nextErrors = { ...prev }
      delete nextErrors.role
      delete nextErrors.program
      delete nextErrors.department
      delete nextErrors.enrollment
      delete nextErrors.semester
      delete nextErrors.designation
      delete nextErrors.securityZone
      delete nextErrors.accessLevel
      delete nextErrors.authorityLevel
      return nextErrors
    })
    setError('')
  }

  function handleProgramChange(event) {
    const nextProgram = normalizeProgram(event.target.value)

    setForm((prev) => ({
      ...prev,
      program: nextProgram,
    }))
    setFieldErrors((prev) => {
      const nextErrors = { ...prev }
      delete nextErrors.program
      return nextErrors
    })
    setError('')
  }

  async function handleCreateAccount(event) {
    event.preventDefault()

    if (isRegistering) {
      return
    }

    const preparedSubmission = buildSubmissionPayload()

    if (!preparedSubmission.ok) {
      setFieldErrors(preparedSubmission.fieldErrors)
      setError('')
      return
    }

    const submissionPayload = preparedSubmission.payload

    setIsRegistering(true)
    setError('')

    try {
      const result = await onRegister(submissionPayload)

      if (!result?.ok) {
        if (result?.fieldErrors) {
          setFieldErrors((prev) => ({
            ...prev,
            ...mapRegisterFieldErrors(result.fieldErrors, form.role),
          }))
        }

        setError(result?.error || 'Unable to create your account right now.')
        return
      }
      resetForm()
      navigate('/login', {
        replace: true,
        state: {
          authNotice: result?.message || 'Account created successfully. You can sign in now.',
        },
      })
    } catch (error) {
      const errorDetails = getApiErrorDetails(error, 'Unable to create your account right now.')

      if (errorDetails.fieldErrors) {
        setFieldErrors((prev) => ({
          ...prev,
          ...mapRegisterFieldErrors(errorDetails.fieldErrors, form.role),
        }))
      }

      setError(errorDetails.message)
    } finally {
      setIsRegistering(false)
    }
  }

  const roleOptions = [
    { value: 'student', label: 'Student' },
    { value: 'principal', label: 'Principal' },
    { value: 'hod', label: 'Academic HOD' },
    { value: 'faculty', label: 'Professor' },
    { value: 'campus_security', label: 'Security | Bouncer' },
    { value: 'security', label: 'Security | Main Gate' },
    { value: 'admin', label: 'Administrator' },
    { value: 'it', label: 'IT Department' },
    { value: 'cao', label: 'CAO' },
    { value: 'chairman', label: 'Director' }
  ]

  return (
    <div className="tw:relative tw:flex tw:min-h-screen tw:items-center tw:justify-center tw:bg-[#040406] tw:px-4 tw:py-12 tw:font-sans tw:antialiased tw:selection:bg-white/20 tw:overflow-hidden">
      {/* Refraction WebGL Aurora Background */}
      <div className="tw:absolute tw:inset-0 tw:z-0 tw:pointer-events-none tw:transform-gpu">
        <Suspense fallback={null}>
          <Aurora 
            colorStops={['#A855F7', '#6366F1', '#EC4899']}
            amplitude={1.2}
            blend={0.5}
            speed={0.5}
          />
        </Suspense>
      </div>

      {/* Apple Glass Container - max-w-2xl for form fields */}
      <div className="tw:relative tw:w-full tw:max-w-2xl tw:rounded-2xl tw:border tw:border-white/[0.08] tw:bg-white/[0.015] tw:p-8 tw:text-white tw:shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_25px_50px_-12px_rgba(0,0,0,0.7)] tw:backdrop-blur-2xl tw:overflow-hidden tw:z-10">
        {/* Specular Surface Gloss Overlay */}
        <div className="tw:absolute tw:inset-0 tw:bg-gradient-to-tr tw:from-white/[0.02] tw:via-transparent tw:to-white/[0.01] tw:pointer-events-none" />
        
        <RegisterForm
          form={form}
          updateFormField={updateFormField}
          handleRoleChange={handleRoleChange}
          handleProgramChange={handleProgramChange}
          onSubmit={handleCreateAccount}
          isSubmitting={isRegistering}
          error={error}
          fieldErrors={fieldErrors}
          requiresProgram={requiresProgram}
          showDepartmentField={showDepartmentField}
          requiresDepartment={requiresDepartment}
          roleIdLabel={roleIdLabel}
          roleIdName={roleIdName}
          roleIdPlaceholder={roleIdPlaceholder}
          departmentOptions={departmentOptions}
          isStudentRole={isStudentRole}
          roleOptions={roleOptions}
          programOptions={programsList}
          semesterOptions={SEMESTER_OPTIONS}
        />
      </div>
    </div>
  )
}

function AuthShell({ title, children }) {
  return (
    <div className="auth-shell">
      <div className="auth-background" aria-hidden="true">
        <div className="bg-orb bg-orb-left" />
        <div className="bg-orb bg-orb-right" />
        <div className="bg-grid" />
        <div className="floating-card building-card">
          <span className="floating-label">Campus Block</span>
          <div className="building-roof" />
          <div className="building-body">
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>
        <div className="floating-card pass-card">
          <span className="floating-label">Gatepass</span>
          <div className="pass-lines">
            <span />
            <span />
            <span />
          </div>
          <div className="pass-badge" />
        </div>
        <div className="floating-card gate-card">
          <span className="floating-label">Security Gate</span>
          <div className="gate-frame">
            <span />
            <span />
            <span />
          </div>
        </div>
        <div className="floating-card path-card">
          <span className="floating-label">Campus Flow</span>
          <div className="path-lines">
            <span />
            <span />
          </div>
        </div>
      </div>
      <div className="auth-panel">
        <div className="auth-copy">
          <div className="auth-brand-wrap">
            <AppBrand size="md" layout="stacked" centered />
          </div>
          <h2>{title}</h2>
        </div>
        {children}
      </div>
    </div>
  )
}

function getCurrentDeviceName() {
  if (typeof navigator === 'undefined') {
    return 'Current device'
  }

  const platform = navigator.userAgentData?.platform || navigator.platform || 'Current device'
  const brand = navigator.userAgentData?.brands?.[0]?.brand || ''
  return [brand, platform].filter(Boolean).join(' - ') || 'Current device'
}

function BiometricSettingsPanel({ currentUser, onCurrentUserPatch }) {
  const toast = useToast()
  const [devices, setDevices] = useState([])
  const [support, setSupport] = useState({
    supported: false,
    message: '',
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSettingUp, setIsSettingUp] = useState(false)
  const [removingDeviceId, setRemovingDeviceId] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const currentDeviceId = readBiometricDeviceId()
  const currentDeviceEnabled = devices.some((device) => device.id === currentDeviceId)
  const currentDevice = devices.find((device) => device.id === currentDeviceId) || null
  const setupBlockedBySession = currentUser.sessionAuthMethod !== 'password'

  useEffect(() => {
    let ignore = false

    async function loadBiometricState() {
      setIsLoading(true)

      try {
        const [supportState, deviceState] = await Promise.all([detectBiometricSupport(), getBiometricDevices()])

        if (!ignore) {
          setSupport(supportState)
          setDevices(deviceState.devices)
        }
      } catch (loadError) {
        if (!ignore) {
          const errorDetails = getApiErrorDetails(loadError, 'Unable to load biometric devices right now.')
          setError(errorDetails.message)
          toast.error({
            title: 'Biometric setup unavailable',
            message: errorDetails.message,
          })
        }
      } finally {
        if (!ignore) {
          setIsLoading(false)
        }
      }
    }

    loadBiometricState()

    return () => {
      ignore = true
    }
  }, [currentUser.id, toast])

  async function handleSetup() {
    if (setupBlockedBySession) {
      setError('Please login manually once on this device before enabling biometric login.')
      setSuccess('')
      toast.warning({
        title: 'Manual login required',
        message: 'Please login manually once on this device before enabling biometric login.',
      })
      return
    }

    setIsSettingUp(true)
    setError('')
    setSuccess('')

    try {
      const deviceName = getCurrentDeviceName()
      const options = await createBiometricRegistrationOptions(deviceName)
      const response = await beginBiometricRegistration(options)
      const result = await verifyBiometricRegistration(response, deviceName)

      setDevices(result.devices)
      onCurrentUserPatch?.({
        hasBiometricCredentials: true,
      })
      setSuccess('Biometric login has been enabled on this device.')
      toast.success({
        title: 'Biometric login enabled',
        message: 'Fingerprint or face recognition can now be used on this device.',
      })
    } catch (setupError) {
      if (setupError instanceof ApiError) {
        const errorDetails = getApiErrorDetails(setupError, 'Biometric setup could not be completed.')
        setError(errorDetails.message)
        toast.error({
          title: 'Biometric setup failed',
          message: errorDetails.message,
        })
      } else {
        const biometricError = getBiometricErrorMessage(setupError, 'setup')
        setError(biometricError)
        toast.error({
          title: 'Biometric setup failed',
          message: biometricError,
        })
      }
    } finally {
      setIsSettingUp(false)
    }
  }

  async function handleRemove(deviceId) {
    setRemovingDeviceId(deviceId)
    setError('')
    setSuccess('')

    try {
      const result = await removeBiometricDevice(deviceId)
      setDevices(result.devices)

      if (!result.devices.length) {
        onCurrentUserPatch?.({
          hasBiometricCredentials: false,
        })
      }

      if (readBiometricDeviceId() === deviceId) {
        clearBiometricDeviceId()
      }

      setSuccess('Biometric login has been removed from the selected device.')
      toast.info({
        title: 'Biometric login removed',
        message: 'The selected biometric device has been removed from your DwarPal account.',
      })
    } catch (removeError) {
      const errorDetails = getApiErrorDetails(removeError, 'Unable to remove this biometric device right now.')
      setError(errorDetails.message)
      toast.error({
        title: 'Biometric removal failed',
        message: errorDetails.message,
      })
    } finally {
      setRemovingDeviceId('')
    }
  }

  return (
    <section className="profile-subcard biometric-card">
      <div className="biometric-card-header">
        <div>
          <h3>Biometric Login</h3>
          <p>Use your device&apos;s secure passkey prompt for fingerprint or face recognition login.</p>
        </div>
        <span className={`status-badge ${currentDeviceEnabled ? 'approved' : 'pending'}`}>
          {currentDeviceEnabled ? 'Enabled on this device' : 'Not enabled on this device'}
        </span>
      </div>

      {isLoading ? <div className="dp-skeleton dp-skeleton-text" style={{ width: '160px', height: '0.85rem' }} /> : null}
      {support.supported ? null : (
        <p className="field-hint">
          {`Fingerprint login is not supported on this device/browser. ${support.message || ''}`.trim()}
        </p>
      )}
      {setupBlockedBySession ? (
        <p className="field-hint">Login manually to add biometric login on a new device.</p>
      ) : null}
      {error ? <p className="form-error">{error}</p> : null}
      {success ? <p className="form-success">{success}</p> : null}

      <div className="biometric-actions-row">
        <ActionButton
          type="button"
          onClick={handleSetup}
          disabled={!support.supported || isSettingUp || setupBlockedBySession}
        >
          {isSettingUp ? 'Setting up biometric login...' : 'Set up biometric login on this device'}
        </ActionButton>
        {currentDevice ? (
          <ActionButton
            tone="danger"
            type="button"
            onClick={() => handleRemove(currentDevice.id)}
            disabled={removingDeviceId === currentDevice.id}
          >
            {removingDeviceId === currentDevice.id
              ? 'Removing biometric login...'
              : 'Remove biometric login from this device'}
          </ActionButton>
        ) : null}
      </div>

      <div className="biometric-device-list">
        {devices.length ? (
          devices.map((device) => (
            <article key={device.id} className="biometric-device-item">
              <div>
                <strong>{device.deviceName || 'Current device'}</strong>
                <p>
                  {device.id === currentDeviceId ? 'Current device' : 'Registered device'}
                  {device.lastUsedAt ? ` | Last used ${formatDateTime(device.lastUsedAt)}` : ''}
                </p>
              </div>
              <ActionButton
                tone="secondary"
                type="button"
                onClick={() => handleRemove(device.id)}
                disabled={removingDeviceId === device.id}
              >
                {removingDeviceId === device.id ? 'Removing...' : 'Remove'}
              </ActionButton>
            </article>
          ))
        ) : (
          <div className="biometric-empty-state">
            <p>No biometric device is enrolled on this account yet.</p>
          </div>
        )}
      </div>
    </section>
  )
}

function createCoordinatorAssignmentForm(currentUser) {
  const assignment = currentUser?.coordinatorAssignment || {}

  return {
    isCoordinator: Boolean(assignment.isCoordinator),
    program: normalizeProgram(assignment.program),
    department:
      normalizeDepartment(assignment.department) || assignment.department || '',
    semester: assignment.semester ? String(assignment.semester) : '',
  }
}

function HeaderAvailabilityToggle({ currentUser, onToggle }) {
  const [isSaving, setIsSaving] = useState(false)
  const approvalEnabled = currentUser?.gatepassApprovalEnabled !== false
  const roleLabel = currentUser?.role === 'principal' ? 'Principal' : 'Academic HOD'

  async function handleToggle() {
    if (isSaving) return
    setIsSaving(true)
    try {
      const nextValue = !approvalEnabled
      await onToggle(
        { gatepassApprovalEnabled: nextValue },
        {
          successTitle: nextValue ? 'Availability Enabled' : 'Availability Disabled',
          successMessage: nextValue
            ? `Student requests will route to you first.`
            : `Student requests will bypass you temporarily.`,
          errorTitle: 'Unable to update availability',
          fallbackErrorMessage: 'DwarPal could not update your availability right now.',
        }
      )
    } catch (err) {
      console.error(err)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={isSaving}
      className={`header-availability-btn ${approvalEnabled ? 'available' : 'busy'}`}
      title={
        approvalEnabled
          ? `You are Available. Student requests route to you first. Click to change.`
          : `You are Busy/On leave. Student requests bypass you. Click to change.`
      }
    >
      <span className="availability-dot" />
      <span className="availability-text">{isSaving ? '...' : approvalEnabled ? 'Available' : 'Busy'}</span>
    </button>
  )
}

function GatepassAvailabilityPanel({
  currentUser,
  onUpdateCurrentUserProfile,
  locationLabel = 'profile',
  compact = false,
}) {
  const [isSaving, setIsSaving] = useState(false)
  const approvalEnabled = currentUser?.gatepassApprovalEnabled !== false
  const roleLabel = currentUser?.role === 'principal' ? 'Principal' : 'Academic HOD'

  async function handleToggleAvailability() {
    if (!onUpdateCurrentUserProfile || isSaving) {
      return
    }

    const nextValue = !approvalEnabled
    setIsSaving(true)

    try {
      await onUpdateCurrentUserProfile(
        {
          gatepassApprovalEnabled: nextValue,
        },
        {
          successTitle: nextValue ? `${roleLabel} review enabled` : `${roleLabel} marked busy`,
          successMessage: nextValue
            ? `New student gatepasses will route to ${roleLabel} first.`
            : `New student gatepasses will bypass ${roleLabel} and route to the next reviewer.`,
          errorTitle: 'Unable to update reviewer availability',
          fallbackErrorMessage: 'DwarPal could not update reviewer availability right now.',
        },
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className={`profile-subcard availability-card${compact ? ' compact' : ''}`}>
      <div className="availability-card-header">
        <div>
          <h3>{`${roleLabel} Gatepass Availability`}</h3>
          <p>
            {approvalEnabled
              ? `Student gatepasses currently wait for ${roleLabel} review first.`
              : `Student gatepasses currently bypass ${roleLabel} and move to the next level.`}
          </p>
        </div>
        <span className={`status-badge ${approvalEnabled ? 'approved' : 'pending'}`}>
          {approvalEnabled ? 'Available' : 'Busy / On leave'}
        </span>
      </div>
      <div className="availability-card-actions" style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <label className="switch">
          <input
            type="checkbox"
            checked={approvalEnabled}
            onChange={handleToggleAvailability}
            disabled={isSaving}
            aria-label={`${roleLabel} availability switch`}
          />
          <span className="slider" />
        </label>
        <span style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text)' }}>
          {isSaving ? 'Updating...' : approvalEnabled ? 'Review Active' : 'Bypassed'}
        </span>
        <p className="field-hint" style={{ width: '100%', marginTop: '0.5rem' }}>
          {locationLabel === 'dashboard'
            ? 'Use this switch directly from the dashboard when you become unavailable.'
            : 'This setting controls automatic gatepass routing for student requests.'}
        </p>
      </div>
    </section>
  )
}

function CoordinatorAssignmentPanel({ currentUser, onUpdateCurrentUserProfile }) {
  const [form, setForm] = useState(() => createCoordinatorAssignmentForm(currentUser))
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setForm(createCoordinatorAssignmentForm(currentUser))
    setError('')
  }, [
    currentUser?.id,
    currentUser?.coordinatorAssignment?.isCoordinator,
    currentUser?.coordinatorAssignment?.program,
    currentUser?.coordinatorAssignment?.department,
    currentUser?.coordinatorAssignment?.semester,
  ])

  function updateForm(field, value) {
    setForm((previousForm) => ({ ...previousForm, [field]: value }))
    setError('')
  }

  async function handleSave(event) {
    event.preventDefault()

    if (!onUpdateCurrentUserProfile || isSaving) {
      return
    }

    const isCoordinator = Boolean(form.isCoordinator)
    const program = normalizeProgram(form.program)
    const department = normalizeDepartment(form.department)
    const semester = Number(form.semester)

    if (isCoordinator && !program) {
      setError('Select a program for coordinator assignment.')
      return
    }

    if (isCoordinator && !department) {
      setError('Select a department for coordinator assignment.')
      return
    }

    if (isCoordinator && !SEMESTER_OPTIONS.includes(semester)) {
      setError('Select a valid semester for coordinator assignment.')
      return
    }

    setIsSaving(true)
    setError('')

    try {
      const result = await onUpdateCurrentUserProfile(
        {
          coordinatorAssignment: {
            isCoordinator,
            program: isCoordinator ? program : null,
            department: isCoordinator ? department : null,
            semester: isCoordinator ? semester : null,
          },
        },
        {
          successTitle: isCoordinator ? 'Coordinator assignment saved' : 'Coordinator role removed',
          successMessage: isCoordinator
            ? `Coordinator routing is now set for ${program} ${department} Semester ${semester}.`
            : 'Coordinator assignment has been cleared for this account.',
          errorTitle: 'Unable to update coordinator assignment',
          fallbackErrorMessage: 'DwarPal could not save coordinator assignment right now.',
        },
      )

      if (!result?.ok) {
        setError(result?.error || 'Unable to save coordinator assignment.')
      }
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="profile-subcard coordinator-card">
      <div className="coordinator-card-header">
        <div>
          <h3>Coordinator Assignment</h3>
          <p>Assign semester-specific coordinator routing inside the faculty workflow.</p>
        </div>
        <span className={`status-badge ${form.isCoordinator ? 'approved' : 'pending'}`}>
          {form.isCoordinator ? 'Coordinator enabled' : 'Coordinator disabled'}
        </span>
      </div>
      <form className="coordinator-form" onSubmit={handleSave}>
        <label className="coordinator-checkbox">
          <input
            type="checkbox"
            checked={form.isCoordinator}
            onChange={(event) => updateForm('isCoordinator', event.target.checked)}
            disabled={isSaving}
          />
          <span>Enable coordinator role for this account</span>
        </label>

        {form.isCoordinator ? (
          <div className="coordinator-form-grid">
            <label>
              <FieldLabel required>Program</FieldLabel>
              <SelectField
                value={form.program}
                onChange={(event) => updateForm('program', event.target.value)}
                disabled={isSaving}
                required
              >
                <option value="" disabled>
                  Select program
                </option>
                {PROGRAM_OPTIONS.map((program) => (
                  <option key={program} value={program}>
                    {program}
                  </option>
                ))}
              </SelectField>
            </label>
            <label>
              <FieldLabel required>Department</FieldLabel>
              <SelectField
                value={form.department}
                onChange={(event) => updateForm('department', event.target.value)}
                disabled={isSaving}
                required
              >
                <option value="" disabled>
                  Select department
                </option>
                {ROUTING_DEPARTMENTS.map((department) => (
                  <option key={department} value={department}>
                    {department}
                  </option>
                ))}
              </SelectField>
            </label>
            <label>
              <FieldLabel required>Semester</FieldLabel>
              <SelectField
                value={form.semester}
                onChange={(event) => updateForm('semester', event.target.value)}
                disabled={isSaving}
                required
              >
                <option value="" disabled>
                  Select semester
                </option>
                {SEMESTER_OPTIONS.map((semester) => (
                  <option key={semester} value={semester}>
                    Semester {semester}
                  </option>
                ))}
              </SelectField>
            </label>
          </div>
        ) : null}

        {error ? <p className="form-error">{error}</p> : null}

        <div className="coordinator-form-actions">
          <ActionButton type="submit" tone="secondary" disabled={isSaving}>
            {isSaving ? 'Saving assignment...' : 'Save Coordinator Settings'}
          </ActionButton>
        </div>
      </form>
    </section>
  )
}

function EstablishEnrollmentPanel({ currentUser, onUpdateCurrentUserProfile }) {
  const [enrollmentNo, setEnrollmentNo] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess(false)
    if (!enrollmentNo.trim()) {
      setError('Enrollment number is required')
      return
    }
    const enrollRegex = /^[a-z0-9-]{3,20}$/i
    if (!enrollRegex.test(enrollmentNo.trim())) {
      setError('Enrollment number must be alphanumeric (3-20 characters)')
      return
    }

    setLoading(true)
    try {
      const result = await onUpdateCurrentUserProfile({ enrollmentNo: enrollmentNo.trim() })
      if (result && result.ok) {
        setSuccess(true)
      } else {
        setError(result?.error || 'Failed to update enrollment number')
      }
    } catch (err) {
      setError(err.message || 'Failed to update enrollment number')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="profile-subcard" style={{ marginTop: '1.5rem', padding: '1.5rem', border: '1px solid #10b981', background: '#ecfdf5', borderRadius: '8px' }}>
        <h3 style={{ color: '#065f46', margin: '0 0 0.5rem 0' }}>✓ Enrollment Number Saved</h3>
        <p style={{ color: '#047857', margin: 0 }}>Your enrollment number was updated successfully. You are now considered a regular student.</p>
      </div>
    )
  }

  return (
    <div className="profile-subcard" style={{ marginTop: '1.5rem', padding: '1.5rem', border: '1px solid #f59e0b', background: '#fffbeb', borderRadius: '8px' }}>
      <h3 style={{ color: '#b45309', margin: '0 0 0.5rem 0' }}>🆕 Establish Real Enrollment Number</h3>
      <p style={{ color: '#d97706', fontSize: '0.875rem', margin: '0 0 1rem 0' }}>
        You are currently using a temporary enrollment number. Once you receive your official GTU enrollment number, please enter it below. Note: This can only be done once.
      </p>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            placeholder="Enter official 12-digit enrollment no."
            value={enrollmentNo}
            onChange={(e) => setEnrollmentNo(e.target.value)}
            disabled={loading}
            style={{
              flex: 1,
              padding: '0.5rem 0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              outline: 'none',
              background: '#fff',
              color: '#000'
            }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '0.5rem 1rem',
              background: '#d97706',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            {loading ? 'Saving...' : 'Save'}
          </button>
        </div>
        {error && <p style={{ color: '#dc2626', fontSize: '0.8125rem', margin: '0.25rem 0 0 0' }}>⚠️ {error}</p>}
      </form>
    </div>
  )
}

// ── Multi-Program / Multi-Department Coverage Panel ─────────────────────────
// Shown in profile settings for principal and hod roles only.
// Lets one account govern multiple programs (principal) or multiple
// program+department pairs (hod) so they see all related gatepasses in one
// dashboard without needing separate accounts.
//
// "No" cooldown: if the user clicks "No I don't manage another program/dept",
// the prompt is hidden for 10 minutes, then re-appears automatically.
const MULTIPROGRAM_COOLDOWN_KEY = 'dwarpal.multiprogram.denied_at'
const MULTIPROGRAM_COOLDOWN_MS = 10 * 60 * 1000 // 10 minutes

function MultiProgramScopePanel({ currentUser, onUpdateCurrentUserProfile }) {
  const toast = useToast()

  // Compute whether we're inside the cooldown window
  function isCooldownActive() {
    const raw = localStorage.getItem(MULTIPROGRAM_COOLDOWN_KEY)
    if (!raw) return false
    return Date.now() - Number(raw) < MULTIPROGRAM_COOLDOWN_MS
  }

  const [cooldown, setCooldown] = useState(() => isCooldownActive())
  const [hasExtra, setHasExtra] = useState(
    () => Array.isArray(currentUser?.additionalScopes) && currentUser.additionalScopes.length > 0
  )
  // For principal: one extra program at a time (can save multiple via list)
  // We show existing scopes plus an "Add more" picker
  const [scopes, setScopes] = useState(
    () => Array.isArray(currentUser?.additionalScopes) ? currentUser.additionalScopes : []
  )
  const [newProgram, setNewProgram] = useState('')
  const [newDepartment, setNewDepartment] = useState('')
  const [saving, setSaving] = useState(false)

  const role = currentUser?.role
  const primaryProgram = currentUser?.program || ''
  const primaryDepartment = currentUser?.department || ''

  // Re-check cooldown every 30 s so the panel auto-shows after timeout
  useEffect(() => {
    if (!cooldown) return
    const id = window.setInterval(() => {
      if (!isCooldownActive()) {
        setCooldown(false)
      }
    }, 30_000)
    return () => window.clearInterval(id)
  }, [cooldown])

  function handleNo() {
    localStorage.setItem(MULTIPROGRAM_COOLDOWN_KEY, String(Date.now()))
    setCooldown(true)
    setHasExtra(false)
  }

  function handleYes() {
    localStorage.removeItem(MULTIPROGRAM_COOLDOWN_KEY)
    setCooldown(false)
    setHasExtra(true)
  }

  function removeScope(index) {
    const next = scopes.filter((_, i) => i !== index)
    setScopes(next)
    saveScopes(next)
  }

  async function addScope() {
    if (role === 'principal') {
      if (!newProgram) return
      if (newProgram === primaryProgram) {
        toast.warning({ title: 'Already your primary program', message: 'This is already your registered program.' })
        return
      }
      if (scopes.some((s) => s.program === newProgram)) {
        toast.warning({ title: 'Already added', message: 'This program is already in your list.' })
        return
      }
      const next = [...scopes, { program: newProgram, department: null }]
      setScopes(next)
      setNewProgram('')
      await saveScopes(next)
    } else if (role === 'hod') {
      if (!newProgram || !newDepartment) return
      const key = `${newProgram}::${newDepartment}`
      const primaryKey = `${primaryProgram}::${primaryDepartment}`
      if (key === primaryKey) {
        toast.warning({ title: 'Already your primary assignment', message: 'This program+department is already your main assignment.' })
        return
      }
      if (scopes.some((s) => `${s.program}::${s.department}` === key)) {
        toast.warning({ title: 'Already added', message: 'This program+department is already in your list.' })
        return
      }
      const next = [...scopes, { program: newProgram, department: newDepartment }]
      setScopes(next)
      setNewProgram('')
      setNewDepartment('')
      await saveScopes(next)
    }
  }

  async function saveScopes(nextScopes) {
    setSaving(true)
    try {
      await onUpdateCurrentUserProfile({ additionalScopes: nextScopes })
      toast.success({ title: 'Coverage updated', message: 'Your program coverage settings were saved.' })
    } catch {
      toast.error({ title: 'Save failed', message: 'Could not save program coverage. Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  const availablePrograms = PROGRAM_OPTIONS.filter((p) => p !== primaryProgram)

  if (!['principal', 'hod'].includes(role)) return null

  return (
    <section className="profile-subcard coordinator-card">
      <div className="coordinator-card-header">
        <div>
          <h3>Program Coverage</h3>
          <p>
            {role === 'principal'
              ? 'Manage other programs you are also principal of, so their gatepasses appear in your dashboard.'
              : 'Manage other program+department combinations you are Academic HOD of, so their gatepasses appear in your dashboard.'}
          </p>
        </div>
        {scopes.length > 0 ? (
          <span className="status-badge approved">{scopes.length} extra {scopes.length === 1 ? 'scope' : 'scopes'}</span>
        ) : null}
      </div>

      {/* Primary scope display */}
      <div style={{ marginBottom: '0.75rem', fontSize: '0.8125rem', color: 'var(--muted)' }}>
        <strong style={{ color: 'var(--text)' }}>Primary: </strong>
        {role === 'principal' ? primaryProgram || '—' : `${primaryProgram || '—'} / ${primaryDepartment || '—'}`}
      </div>

      {/* Existing additional scopes list */}
      {scopes.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1rem' }}>
          {scopes.map((scope, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'var(--card-bg, rgba(255,255,255,0.04))',
                border: '1px solid var(--border, rgba(255,255,255,0.08))',
                borderRadius: '0.5rem', padding: '0.5rem 0.75rem', fontSize: '0.8125rem'
              }}
            >
              <span>
                {role === 'principal'
                  ? scope.program
                  : `${scope.program} / ${scope.department}`}
              </span>
              <button
                type="button"
                onClick={() => removeScope(idx)}
                disabled={saving}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--danger, #ef4444)', fontSize: '0.75rem', padding: '0 0.25rem'
                }}
                aria-label="Remove scope"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {/* Cooldown message */}
      {cooldown && !hasExtra ? (
        <p style={{ fontSize: '0.8125rem', color: 'var(--muted)', fontStyle: 'italic' }}>
          Program coverage question hidden. It will reappear in about 10 minutes.
        </p>
      ) : !hasExtra ? (
        /* Yes / No prompt */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--text)' }}>
            {role === 'principal'
              ? 'Are you principal of any other program?'
              : 'Are you Academic HOD of any other program or department?'}
          </p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={handleYes}>
              Yes
            </button>
            <button type="button" className="btn" onClick={handleNo} style={{ opacity: 0.7 }}>
              No
            </button>
          </div>
        </div>
      ) : (
        /* Add additional scope form */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--text)', fontWeight: 500 }}>Add another program{role === 'hod' ? ' + department' : ''}:</p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <SelectField
              value={newProgram}
              onChange={(e) => setNewProgram(e.target.value)}
              disabled={saving}
              style={{ minWidth: '180px', flex: '1' }}
            >
              <option value="" disabled>Select program</option>
              {availablePrograms.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </SelectField>
            {role === 'hod' ? (
              <SelectField
                value={newDepartment}
                onChange={(e) => setNewDepartment(e.target.value)}
                disabled={saving}
                style={{ minWidth: '180px', flex: '1' }}
              >
                <option value="" disabled>Select department</option>
                {ROUTING_DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </SelectField>
            ) : null}
            <ActionButton
              tone="secondary"
              onClick={addScope}
              disabled={saving || !newProgram || (role === 'hod' && !newDepartment)}
            >
              {saving ? 'Saving…' : 'Add'}
            </ActionButton>
          </div>
          <button
            type="button"
            onClick={handleNo}
            style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'var(--muted)', fontSize: '0.8125rem', cursor: 'pointer', padding: 0 }}
          >
            No, I don't manage another {role === 'principal' ? 'program' : 'department'}
          </button>
        </div>
      )}
    </section>
  )
}

function ProfileSettingsTabs({
  currentUser,
  cookieConsent,
  notificationPermissionState,
  notificationsSupported,
  onManageCookiePreferences,
  onOpenNotificationPrompt,
  onCurrentUserPatch,
  onUpdateCurrentUserProfile,
  onTestNotification,
  testingNotification = false,
  initialActiveTab = null,
}) {
  const [activeTab, setActiveTab] = useState(
    initialActiveTab || (currentUser?.isTemporaryPassword || currentUser?.isNewStudent ? 'password' : null)
  )

  useEffect(() => {
    if (initialActiveTab) {
      setActiveTab(initialActiveTab)
    }
  }, [initialActiveTab])

  return (
    <div className="profile-settings-tabs-container">
      <div className="profile-tabs-bar">
        <button
          type="button"
          onClick={() => setActiveTab(activeTab === 'preferences' ? null : 'preferences')}
          className={`profile-tab-btn ${activeTab === 'preferences' ? 'active' : ''}`}
          title="Notification & App Preferences"
        >
          <Settings size={16} />
          <span>Preferences</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab(activeTab === 'biometrics' ? null : 'biometrics')}
          className={`profile-tab-btn ${activeTab === 'biometrics' ? 'active' : ''}`}
          title="Biometrics & Passkeys"
        >
          <Fingerprint size={16} />
          <span>Biometrics</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab(activeTab === 'password' ? null : 'password')}
          className={`profile-tab-btn ${activeTab === 'password' ? 'active' : ''}`}
          title="Change Account Password"
        >
          <KeyRound size={16} />
          <span>Change Password</span>
        </button>
      </div>

      {activeTab === 'preferences' ? (
        <FeatureBoundary label="Preferences panel">
          <Suspense fallback={<div className="tw:p-6 tw:text-sm tw:text-slate-400">Loading preferences...</div>}>
            <PreferencesPanel
              cookieConsent={cookieConsent}
              notificationPermissionState={notificationPermissionState}
              notificationsSupported={notificationsSupported}
              onManageCookies={onManageCookiePreferences}
              onManageNotifications={onOpenNotificationPrompt}
              onTestNotification={onTestNotification}
              testingNotification={testingNotification}
            />
          </Suspense>
        </FeatureBoundary>
      ) : null}

      {activeTab === 'biometrics' ? (
        <BiometricSettingsPanel currentUser={currentUser} onCurrentUserPatch={onCurrentUserPatch} />
      ) : null}

      {activeTab === 'password' ? (
        <Suspense fallback={<div className="tw:p-6 tw:text-sm tw:text-slate-400">Loading password settings...</div>}>
          <PasswordResetPanel currentUser={currentUser} onCurrentUserPatch={onCurrentUserPatch} />
        </Suspense>
      ) : null}

      {currentUser.role === 'principal' || currentUser.role === 'hod' ? (
        <GatepassAvailabilityPanel
          currentUser={currentUser}
          onUpdateCurrentUserProfile={onUpdateCurrentUserProfile}
          locationLabel="profile"
        />
      ) : null}

      {currentUser.role === 'principal' || currentUser.role === 'hod' ? (
        <MultiProgramScopePanel
          currentUser={currentUser}
          onUpdateCurrentUserProfile={onUpdateCurrentUserProfile}
        />
      ) : null}

      {['faculty', 'hod'].includes(currentUser.role) ? (
        <CoordinatorAssignmentPanel
          currentUser={currentUser}
          onUpdateCurrentUserProfile={onUpdateCurrentUserProfile}
        />
      ) : null}

      {currentUser.role === 'student' && currentUser.isTemporaryEnrollment ? (
        <EstablishEnrollmentPanel
          currentUser={currentUser}
          onUpdateCurrentUserProfile={onUpdateCurrentUserProfile}
        />
      ) : null}
    </div>
  )
}

function AppShell({
  currentUser,
  summary,
  gatepasses,
  gatepassMeta,
  onCurrentUserPatch,
  onUpdateCurrentUserProfile,
  onLogout,
  onInactivityTimeout,
  onAddGatepass,
  onGatepassAction,
  onRefreshData,
  cookieConsent,
  notificationPermissionState,
  notificationsSupported,
  notificationPromptOpen,
  onManageCookiePreferences,
  onOpenNotificationPrompt,
  onAllowNotificationPermission,
  onDeferNotificationPermission,
  onOpenSupport,
}) {
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const {
    notifications,
    unreadCount,
    loading: notificationsLoading,
    socketConnected,
    markNotificationRead,
    markAllRead,
    triggerTestNotification,
  } = useNotifications()
  const requestedPage = location.pathname.split('/').pop() || 'dashboard'
  const currentPage = APP_PAGES.has(requestedPage) ? requestedPage : USER_PAGE_ALIASES[requestedPage] || 'dashboard'
  const focusReference = useMemo(
    () => new URLSearchParams(location.search).get('focus')?.trim().toUpperCase() || '',
    [location.search],
  )
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [currentServerPage, setCurrentServerPage] = useState(1)
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [modalType, setModalType] = useState('gatepass')
  const [rejectRequest, setRejectRequest] = useState(null)
  const [navOpen, setNavOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [qrPreviewGatepass, setQrPreviewGatepass] = useState(null)
  const [testingNotification, setTestingNotification] = useState(false)
  const notificationWrapperRef = useRef(null)
  const hasSyncedInitialWorkspaceQueryRef = useRef(false)
  const [profileInitialTab, setProfileInitialTab] = useState(null)
  const [showNewStudentWelcome, setShowNewStudentWelcome] = useState(false)

  const handleTriggerTestNotification = useCallback(async () => {
    setTestingNotification(true)
    try {
      await triggerTestNotification()
    } finally {
      setTestingNotification(false)
    }
  }, [triggerTestNotification])

  // Student inactivity auto-logout — no-op for all other roles.
  useStudentSessionTimeout(currentUser, onInactivityTimeout, navigate)

  useEffect(() => {
    if (currentPage !== 'profile') {
      setProfileInitialTab(null)
    }
  }, [currentPage])

  useEffect(() => {
    if (
      currentUser?.role === 'student' &&
      (currentUser?.isNewStudent || currentUser?.isTemporaryPassword || currentUser?.mustResetPassword) &&
      !sessionStorage.getItem(`dwarpal_dismissed_welcome_${currentUser?.id || currentUser?.enrollment || 'student'}`)
    ) {
      setShowNewStudentWelcome(true)
    }
  }, [currentUser])

  function handleNavigateToProfileReset() {
    sessionStorage.setItem(`dwarpal_dismissed_welcome_${currentUser?.id || currentUser?.enrollment || 'student'}`, 'true')
    setShowNewStudentWelcome(false)
    setProfileInitialTab('password')
    navigate('/app/profile')
  }

  function handleDismissWelcomeModal() {
    sessionStorage.setItem(`dwarpal_dismissed_welcome_${currentUser?.id || currentUser?.enrollment || 'student'}`, 'true')
    setShowNewStudentWelcome(false)
  }

  const hasOpenModal =
    modalOpen || Boolean(rejectRequest) || Boolean(qrPreviewGatepass) || notificationPromptOpen || showNewStudentWelcome

  useEffect(() => {
    const debounceId = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.trim())
    }, 220)

    return () => window.clearTimeout(debounceId)
  }, [searchTerm])

  useEffect(() => {
    setSearchTerm('')
    setStatusFilter('All')
    setDebouncedSearchTerm('')
    setCurrentServerPage(1)
    hasSyncedInitialWorkspaceQueryRef.current = false
  }, [currentUser?.id])

  useEffect(() => {
    if (currentPage !== 'dashboard') {
      return undefined
    }

    if (!hasSyncedInitialWorkspaceQueryRef.current) {
      hasSyncedInitialWorkspaceQueryRef.current = true

      if (!focusReference) {
        return undefined
      }
    }

    const controller = new AbortController()
    const requestSearchTerm = debouncedSearchTerm || focusReference

    onRefreshData(controller.signal, {
      force: true,
      requestOptions: {
        page: currentServerPage,
        limit: DEFAULT_WORKSPACE_PAGE_SIZE,
        searchTerm: requestSearchTerm,
        statusFilter,
      },
    })

    return () => controller.abort()
  }, [currentPage, currentServerPage, debouncedSearchTerm, focusReference, statusFilter, onRefreshData])

  useEffect(() => {
    if (currentPage !== 'dashboard' || hasOpenModal) return undefined

    // Dashboard auto-refresh: pull the latest backend queue every 10 seconds.
    const intervalId = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return
      }

      const requestSearchTerm = debouncedSearchTerm || focusReference

      onRefreshData(undefined, {
        requestOptions: {
          page: currentServerPage,
          limit: DEFAULT_WORKSPACE_PAGE_SIZE,
          searchTerm: requestSearchTerm,
          statusFilter,
        },
      })
    }, DASHBOARD_REFRESH_MS)

    return () => window.clearInterval(intervalId)
  }, [currentPage, currentServerPage, debouncedSearchTerm, focusReference, hasOpenModal, onRefreshData, statusFilter])

  useEffect(() => {
    if (requestedPage === currentPage || USER_PAGE_ALIASES[requestedPage]) {
      return
    }

    navigate(`/app/${currentPage}`, { replace: true })
  }, [currentPage, navigate, requestedPage])

  useEffect(() => {
    if (!notificationsOpen) {
      return undefined
    }

    function handlePointerDown(event) {
      if (!notificationWrapperRef.current?.contains(event.target)) {
        setNotificationsOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [notificationsOpen])

  useEffect(() => {
    if (
      currentPage !== 'dashboard' ||
      hasOpenModal ||
      notificationPermissionState !== 'default' ||
      !notificationsSupported
    ) {
      return undefined
    }

    const promptTimer = window.setTimeout(() => {
      onOpenNotificationPrompt()
    }, 1600)

    return () => window.clearTimeout(promptTimer)
  }, [currentPage, hasOpenModal, notificationPermissionState, notificationsSupported, onOpenNotificationPrompt])

  useEffect(() => {
    const totalPages = Math.max(Number(gatepassMeta?.totalPages) || 1, 1)

    if (currentServerPage > totalPages) {
      setCurrentServerPage(totalPages)
    }
  }, [currentServerPage, gatepassMeta?.totalPages])

  const scopedGatepasses = useMemo(() => getRoleScopedGatepasses(currentUser, gatepasses), [currentUser, gatepasses])

  const filteredGatepasses = useMemo(
    () => {
      const matchingGatepasses = [...scopedGatepasses]

      if (!focusReference) {
        return matchingGatepasses
      }

      const focusedGatepass = scopedGatepasses.find((gatepass) => matchesGatepassReference(gatepass, focusReference))

      if (!focusedGatepass || matchingGatepasses.some((gatepass) => gatepass.id === focusedGatepass.id)) {
        return matchingGatepasses
      }

      return [focusedGatepass, ...matchingGatepasses]
    },
    [focusReference, scopedGatepasses],
  )

  const stats = getRoleStats(currentUser, summary, scopedGatepasses)

  function handleNavigate(page) {
    setNavOpen(false)
    setNotificationsOpen(false)
    setQrPreviewGatepass(null)

    if (page === 'admin-portal') {
      navigate('/admin/dashboard', { replace: true })
      return
    }

    navigate(`/app/${page}`, { replace: true })
  }

  async function handleLogout() {
    setNavOpen(false)
    setNotificationsOpen(false)
    setQrPreviewGatepass(null)
    await onLogout()
    // Use replace on logout so browser back cannot reopen the previously authenticated route.
    navigate('/login', { replace: true })
  }

  function handleOpenQrPreview(gatepass) {
    setQrPreviewGatepass(gatepass)
  }

  function clearDashboardFocus() {
    if (!focusReference) {
      return
    }

    const searchParams = new URLSearchParams(location.search)
    searchParams.delete('focus')
    const nextSearch = searchParams.toString()

    navigate(`${location.pathname}${nextSearch ? `?${nextSearch}` : ''}`, { replace: true })
  }

  function handleSearchTermChange(nextValue) {
    clearDashboardFocus()
    setCurrentServerPage(1)
    setSearchTerm(nextValue)
  }

  function handleStatusFilterChange(nextValue) {
    clearDashboardFocus()
    setCurrentServerPage(1)
    setStatusFilter(nextValue)
  }

  function handleServerPageChange(nextPage) {
    clearDashboardFocus()
    const totalPages = Math.max(Number(gatepassMeta?.totalPages) || 1, 1)
    const normalizedPage = Math.min(Math.max(Number(nextPage) || 1, 1), totalPages)

    setCurrentServerPage(normalizedPage)
  }

  async function handleDashboardGatepassAction(request, action) {
    if (action === 'reject') {
      setRejectRequest(request)
      return { ok: false, cancelled: true }
    }

    return onGatepassAction(request, action)
  }

  async function handleRejectSubmit(rejectionReason) {
    if (!rejectRequest) {
      return { ok: false, error: 'Unable to find the request you want to reject.' }
    }

    const result = await onGatepassAction(rejectRequest, 'reject', { rejectionReason })

    if (result?.ok) {
      setRejectRequest(null)
    }

    return result
  }

  async function handleMarkNotificationRead(notificationId) {
    try {
      await markNotificationRead(notificationId)
    } catch {
      toast.error({
        title: 'Unable to update notification',
        message: 'DwarPal could not mark this notification as read right now.',
      })
    }
  }

  async function handleMarkAllNotificationsRead() {
    try {
      await markAllRead()
    } catch {
      toast.error({
        title: 'Unable to update notifications',
        message: 'DwarPal could not mark all notifications as read right now.',
      })
    }
  }

  async function handleOpenNotification(notification) {
    if (!notification) {
      return
    }

    setNotificationsOpen(false)
    setCurrentServerPage(1)
    setSearchTerm('')
    setStatusFilter('All')

    if (!notification.isRead) {
      try {
        await markNotificationRead(notification.id)
      } catch {
        toast.warning({
          title: 'Notification opened',
          message: 'The item opened, but DwarPal could not sync its read state yet.',
        })
      }
    }

    navigate(notification.relatedRoute || '/app/notifications')
  }

  return (
    <div className="app-shell">
      <Sidebar
        currentUser={currentUser}
        currentPage={currentPage}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
        notificationCount={unreadCount}
        open={navOpen}
        onClose={() => setNavOpen(false)}
        onOpenSupport={onOpenSupport}
      />

      <div className="app-main">
        <Topbar
          currentUser={currentUser}
          title={getPageTitle(currentUser, currentPage)}
          subtitle={getPageSubtitle(currentUser, currentPage)}
          onToggleNav={() => setNavOpen((prev) => !prev)}
          navOpen={navOpen}
          actions={
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {['principal', 'hod'].includes(currentUser?.role) ? (
                <HeaderAvailabilityToggle
                  currentUser={currentUser}
                  onToggle={onUpdateCurrentUserProfile}
                />
              ) : null}
              <button
                type="button"
                className={`icon-button ${currentPage === 'profile' ? 'active' : ''}`}
                onClick={() => {
                  setProfileInitialTab('preferences')
                  navigate('/app/profile')
                }}
                aria-label="Settings"
                title="Settings"
              >
                <Settings size={18} />
              </button>
              <div className="notification-wrapper" ref={notificationWrapperRef}>
                <button
                  type="button"
                  className={`icon-button notification-toggle ${notificationsOpen ? 'active' : ''}`}
                  onClick={() => setNotificationsOpen((previous) => !previous)}
                  aria-label="Open notifications"
                  aria-expanded={notificationsOpen}
                >
                  <Bell size={18} />
                  {unreadCount ? <span className="notification-dot">{unreadCount > 99 ? '99+' : unreadCount}</span> : null}
                </button>
                <NotificationCenterPanel
                  open={notificationsOpen}
                  notifications={notifications}
                  unreadCount={unreadCount}
                  loading={notificationsLoading}
                  socketConnected={socketConnected}
                  onOpenNotification={handleOpenNotification}
                  onMarkNotificationRead={handleMarkNotificationRead}
                  onMarkAllRead={handleMarkAllNotificationsRead}
                  onTestNotification={handleTriggerTestNotification}
                  testingNotification={testingNotification}
                />
              </div>
            </div>
          }
        />

        <div className="app-scroll-region">
          {currentPage === 'dashboard' ? (
            <DashboardPage
              currentUser={currentUser}
              stats={stats}
              gatepasses={filteredGatepasses}
              gatepassMeta={gatepassMeta}
              currentServerPage={currentServerPage}
              onUpdateCurrentUserProfile={onUpdateCurrentUserProfile}
              searchTerm={searchTerm}
              onSearchTermChange={handleSearchTermChange}
              statusFilter={statusFilter}
              onStatusFilterChange={handleStatusFilterChange}
              onPageChange={handleServerPageChange}
              onOpenModal={(type) => {
                setModalType(type || 'gatepass')
                setModalOpen(true)
              }}
              onGatepassAction={handleDashboardGatepassAction}
              focusReference={focusReference}
              onOpenQrPreview={handleOpenQrPreview}
            />
          ) : null}

          {currentPage === 'profile' ? (
            <ProfileCard currentUser={currentUser} onLogout={handleLogout}>
              <ProfileSettingsTabs
                currentUser={currentUser}
                cookieConsent={cookieConsent}
                notificationPermissionState={notificationPermissionState}
                notificationsSupported={notificationsSupported}
                onManageCookiePreferences={onManageCookiePreferences}
                onOpenNotificationPrompt={onOpenNotificationPrompt}
                onCurrentUserPatch={onCurrentUserPatch}
                onUpdateCurrentUserProfile={onUpdateCurrentUserProfile}
                onTestNotification={handleTriggerTestNotification}
                testingNotification={testingNotification}
                initialActiveTab={profileInitialTab}
              />
            </ProfileCard>
          ) : null}

          {showNewStudentWelcome ? (
            <Suspense fallback={null}>
              <NewStudentWelcomeModal
                currentUser={currentUser}
                onNavigateToProfileReset={handleNavigateToProfileReset}
                onClose={handleDismissWelcomeModal}
              />
            </Suspense>
          ) : null}

          {currentPage === 'notifications' ? (
            <NotificationsPage
              currentUser={currentUser}
              notifications={notifications}
              unreadCount={unreadCount}
              loading={notificationsLoading}
              socketConnected={socketConnected}
              notificationPermissionState={notificationPermissionState}
              notificationsSupported={notificationsSupported}
              onManageNotifications={onOpenNotificationPrompt}
              onOpenNotification={handleOpenNotification}
              onMarkNotificationRead={handleMarkNotificationRead}
              onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
              onTestNotification={handleTriggerTestNotification}
              testingNotification={testingNotification}
            />
          ) : null}

          {currentPage === 'support' ? (
            <ErrorBoundary>
              <Suspense fallback={<LoadingSpinner />}>
                <SupportPage />
              </Suspense>
            </ErrorBoundary>
          ) : null}
          {currentPage === 'privacy' ? (
            <ErrorBoundary>
              <Suspense fallback={<LoadingSpinner />}>
                <LegalDocs onManageCookies={() => setCookieBannerForcedOpen(true)} />
              </Suspense>
            </ErrorBoundary>
          ) : null}
        </div>
      </div>

      <CreateGatepassModal
        open={(currentUser.role === 'student' || (currentUser.role === 'faculty' && modalType === 'gatepass')) ? modalOpen : false}
        currentUser={currentUser}
        onClose={() => setModalOpen(false)}
        onSubmit={onAddGatepass}
      />
      <Suspense fallback={null}>
        <FacultyLeaveWizard
          open={currentUser.role === 'faculty' && modalType === 'leave' ? modalOpen : false}
          currentUser={currentUser}
          onClose={() => setModalOpen(false)}
          onSubmit={onAddGatepass}
        />
      </Suspense>

      <RejectRequestModal
        open={Boolean(rejectRequest)}
        request={rejectRequest}
        onClose={() => setRejectRequest(null)}
        onSubmit={handleRejectSubmit}
      />
      <Suspense fallback={null}>
        <GatepassQrModal
          gatepass={qrPreviewGatepass}
          open={Boolean(qrPreviewGatepass)}
          onClose={() => setQrPreviewGatepass(null)}
        />
      </Suspense>
      <FeatureBoundary label="Notification permission prompt">
        <NotificationPermissionPrompt
          open={notificationPromptOpen}
          onAllow={onAllowNotificationPermission}
          onMaybeLater={onDeferNotificationPermission}
        />
      </FeatureBoundary>
    </div>
  )
}

function NotificationsPage({
  currentUser,
  notifications,
  unreadCount,
  loading,
  socketConnected,
  notificationPermissionState,
  notificationsSupported,
  onManageNotifications,
  onOpenNotification,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onTestNotification,
  testingNotification = false,
}) {
  const roleTitle = ROLE_META[currentUser.role].title

  return (
    <div className="page-stack">
      <section className="workspace-card">
        <div className="notification-page-permission-card">
          <div>
            <span className="eyebrow">Notifications</span>
            <h3>{roleTitle} workflow updates</h3>
            <p>
              Recent approvals, reviews, rejections, and gate activity now live inside the sidebar menu for quick access on desktop and mobile.
            </p>
          </div>
          <div className="notification-page-summary">
            <span className="notification-summary-chip">{`Total updates ${notifications.length}`}</span>
            <span className={`notification-summary-chip ${unreadCount ? 'attention' : 'calm'}`}>
              {unreadCount ? `Unread ${unreadCount}` : 'All caught up'}
            </span>
            <span className={`notification-summary-chip ${socketConnected ? 'calm' : ''}`}>
              {socketConnected ? 'Realtime connected' : 'History sync only'}
            </span>
          </div>
        </div>

        <FeatureBoundary label="Notification summary card">
          <NotificationPermissionCard
            status={notificationPermissionState}
            supported={notificationsSupported}
            onManage={onManageNotifications}
            onTestNotification={onTestNotification}
            testingNotification={testingNotification}
          />
        </FeatureBoundary>

        {unreadCount ? (
          <div className="notification-page-actions">
            <button type="button" className="action-button secondary" onClick={onMarkAllNotificationsRead}>
              Mark all as read
            </button>
          </div>
        ) : null}

        {loading && !notifications.length ? (
          <SkeletonNotificationList count={6} />
        ) : notifications.length ? (
          <div className="notification-page-list">
            {notifications.map((notification) => (
              <article
                key={notification.id}
                className={`notification-page-item notification-${getNotificationSurfaceTone(notification)}${
                  notification.isRead ? ' read' : ''
                }`}
              >
                <button type="button" className="notification-page-open" onClick={() => onOpenNotification(notification)}>
                  <div className="notification-page-item-main">
                    <div className="notification-page-item-head">
                      <div className="notification-page-item-copy">
                        <span className="eyebrow">{getNotificationKicker(notification)}</span>
                        <strong>{notification.title}</strong>
                      </div>
                      <StatusBadge status={getNotificationDisplayStatus(notification)} />
                    </div>
                    <p>{notification.message}</p>
                    <p className="notification-page-detail">{notification.detail}</p>
                  </div>
                  <div className="notification-page-item-meta">
                    <strong>{notification.referenceId}</strong>
                    <span>{formatNotificationTimestamp(notification.createdAt)}</span>
                  </div>
                </button>
                <div className="notification-page-item-actions">
                  {!notification.isRead ? (
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => onMarkNotificationRead(notification.id)}
                    >
                      Mark read
                    </button>
                  ) : (
                    <span className="notification-page-read-label">Read</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No notifications yet"
            description="New approvals, rejections, and gate updates will appear here automatically as your dashboard activity changes."
          />
        )}
      </section>
    </div>
  )
}

function DashboardPage({
  currentUser,
  stats,
  gatepasses,
  gatepassMeta,
  currentServerPage,
  onUpdateCurrentUserProfile,
  searchTerm,
  onSearchTermChange,
  statusFilter,
  onStatusFilterChange,
  onPageChange,
  onOpenModal,
  onGatepassAction,
  focusReference,
  onOpenQrPreview,
}) {
  const isRequester = currentUser.role === 'student' || currentUser.role === 'faculty'
  const summaryCards = getSummaryCards(currentUser.role, stats)
  const [expandedGatepassId, setExpandedGatepassId] = useState('')
  const [securityStation, setSecurityStation] = useState('campus')

  useEffect(() => {
    if (currentUser?.role === 'security') {
      setSecurityStation('gate')
    } else if (currentUser?.role === 'campus_security') {
      setSecurityStation('campus')
    }
  }, [currentUser?.role])

  const gatepassCards = useMemo(
    () =>
      gatepasses.map((gatepass) => ({
        gatepass,
        highlighted: matchesGatepassReference(gatepass, focusReference),
        actions: getAvailableActions(currentUser.role, gatepass, onGatepassAction, securityStation),
      })),
    [currentUser.role, focusReference, gatepasses, onGatepassAction, securityStation],
  )
  const emptyStateTitle = currentUser.role === 'student' ? 'No gatepasses found' : 'No requests found'
  const emptyStateDescription =
    currentUser.role === 'student'
      ? 'Try a different filter or create a gatepass.'
      : currentUser.role === 'faculty'
        ? 'Try a different filter or start a new leave application.'
        : 'Try a different filter or wait for new requests.'

  useEffect(() => {
    if (!focusReference) {
      return
    }

    const matchingCard = Array.from(document.querySelectorAll('[data-reference-id]')).find(
      (element) => element.getAttribute('data-reference-id') === focusReference,
    )

    if (matchingCard) {
      matchingCard.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }
  }, [focusReference, gatepassCards.length])

  useEffect(() => {
    if (!gatepassCards.length) {
      setExpandedGatepassId('')
      return
    }

    const focusedGatepass = focusReference
      ? gatepassCards.find(({ gatepass }) => matchesGatepassReference(gatepass, focusReference))
      : null

    if (focusedGatepass) {
      setExpandedGatepassId(focusedGatepass.gatepass.id)
      return
    }

    if (expandedGatepassId && !gatepassCards.some(({ gatepass }) => gatepass.id === expandedGatepassId)) {
      setExpandedGatepassId('')
    }
  }, [expandedGatepassId, focusReference, gatepassCards])

  return (
    <div className="page-stack">
      {isRequester ? (
        <section className="dashboard-toolbar">
          <div className="dashboard-toolbar-copy">
            <strong>{currentUser.name}</strong>
            <div className="dashboard-toolbar-meta">
              {currentUser.enrollment || currentUser.employeeId ? (
                <span className="dashboard-toolbar-pill">{currentUser.enrollment || currentUser.employeeId}</span>
              ) : null}
              <span className="dashboard-toolbar-pill muted">{ROLE_META[currentUser.role].title}</span>
            </div>
          </div>
          <div className="dashboard-toolbar-actions" style={{ display: 'flex', gap: '8px' }}>
            {currentUser.role === 'student' ? (
              <ActionButton icon={Send} onClick={() => onOpenModal('gatepass')}>
                + New Gatepass
              </ActionButton>
            ) : null}
            {currentUser.role === 'faculty' ? (
              <ActionButton icon={Send} onClick={() => onOpenModal('leave')}>
                + New Leave Request
              </ActionButton>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="summary-grid">
        {summaryCards.map((card) => (
          <SummaryCard key={card.label} {...card} />
        ))}
      </section>



      {currentUser.role === 'security' ? (
        <Suspense fallback={<LoadingSpinner />}>
          <SecurityVerificationPanel
            onVerifyById={verifyGatepassById}
            onVerifyQr={verifyGatepassQr}
            onGatepassAction={onGatepassAction}
            onOpenQrPreview={onOpenQrPreview}
            securityStation={securityStation}
          />
        </Suspense>
      ) : null}

      <section className="workspace-card">
        <div className="workspace-top">
          <SearchBar value={searchTerm} onChange={onSearchTermChange} />
          <FilterTabs
            value={statusFilter}
            onChange={onStatusFilterChange}
            options={['All', 'Pending', 'Forwarded', 'Approved', 'Rejected', 'Outdated', 'Out', 'Returned']}
          />
        </div>

        <div className="section-heading">
          <div>
            <h3>{getListTitle(currentUser)}</h3>
          </div>
        </div>

        {gatepassCards.length ? (
          <div className="gatepass-grid">
            <div className="gatepass-column">
              {gatepassCards
                .map((card, index) => ({ ...card, index }))
                .filter((_, i) => i % 2 === 0)
                .map(({ gatepass, actions, highlighted, index }) => (
                  <ExpandableGatepassCard
                    key={gatepass.id}
                    gatepass={gatepass}
                    currentUserRole={currentUser.role}
                    actions={actions}
                    expanded={expandedGatepassId === gatepass.id}
                    highlighted={highlighted}
                    onOpenQrPreview={isRequester ? onOpenQrPreview : undefined}
                    onToggle={() => setExpandedGatepassId((previousId) => (previousId === gatepass.id ? '' : gatepass.id))}
                    style={{ order: index }}
                  />
                ))}
            </div>
            <div className="gatepass-column">
              {gatepassCards
                .map((card, index) => ({ ...card, index }))
                .filter((_, i) => i % 2 !== 0)
                .map(({ gatepass, actions, highlighted, index }) => (
                  <ExpandableGatepassCard
                    key={gatepass.id}
                    gatepass={gatepass}
                    currentUserRole={currentUser.role}
                    actions={actions}
                    expanded={expandedGatepassId === gatepass.id}
                    highlighted={highlighted}
                    onOpenQrPreview={isRequester ? onOpenQrPreview : undefined}
                    onToggle={() => setExpandedGatepassId((previousId) => (previousId === gatepass.id ? '' : gatepass.id))}
                    style={{ order: index }}
                  />
                ))}
            </div>
          </div>
        ) : (
          <EmptyState
            title={emptyStateTitle}
            description={emptyStateDescription}
            action={isRequester ? <ActionButton onClick={onOpenModal}>New Gatepass</ActionButton> : null}
          />
        )}

        {Number(gatepassMeta?.totalRecords || 0) ? (
          <PaginationControls
            currentPage={currentServerPage}
            pageSize={gatepassMeta?.limit}
            totalPages={gatepassMeta?.totalPages}
            totalRecords={gatepassMeta?.totalRecords}
            onPageChange={onPageChange}
          />
        ) : null}
      </section>
    </div>
  )
}

function buildPaginationSequence(currentPage, totalPages) {
  const safeCurrentPage = Math.min(Math.max(Number(currentPage) || 1, 1), Math.max(Number(totalPages) || 1, 1))
  const safeTotalPages = Math.max(Number(totalPages) || 1, 1)

  if (safeTotalPages <= 5) {
    return Array.from({ length: safeTotalPages }, (_, index) => index + 1)
  }

  const anchorPages = new Set([1, safeTotalPages, safeCurrentPage - 1, safeCurrentPage, safeCurrentPage + 1])
  const pages = [...anchorPages].filter((page) => page >= 1 && page <= safeTotalPages).sort((left, right) => left - right)
  const sequence = []

  pages.forEach((page, index) => {
    const previousPage = pages[index - 1]

    if (index > 0 && previousPage !== page - 1) {
      sequence.push(`gap-${previousPage}-${page}`)
    }

    sequence.push(page)
  })

  return sequence
}

function PaginationControls({ currentPage, pageSize, totalPages, totalRecords, onPageChange }) {
  const safeTotalPages = Math.max(Number(totalPages) || 1, 1)
  const safeCurrentPage = Math.min(Math.max(Number(currentPage) || 1, 1), safeTotalPages)
  const safePageSize = Math.max(Number(pageSize) || DEFAULT_WORKSPACE_PAGE_SIZE, 1)
  const paginationSequence = buildPaginationSequence(safeCurrentPage, safeTotalPages)
  const firstRecordIndex = totalRecords ? (safeCurrentPage - 1) * safePageSize + 1 : 0
  const lastRecordIndex = totalRecords ? Math.min(safeCurrentPage * safePageSize, totalRecords) : 0

  return (
    <div className="workspace-pagination" aria-label="Gatepass history pagination">
      <div className="pagination-meta">
        <strong>
          Page {safeCurrentPage} of {safeTotalPages}
        </strong>
        <span>
          Showing {firstRecordIndex}-{lastRecordIndex} of {totalRecords}
        </span>
      </div>

      <div className="pagination-controls">
        <button
          type="button"
          className="pagination-button"
          onClick={() => onPageChange(safeCurrentPage - 1)}
          disabled={safeCurrentPage <= 1}
        >
          <ChevronLeft size={16} />
          <span>Previous</span>
        </button>

        <div className="pagination-pages">
          {paginationSequence.map((entry) =>
            typeof entry === 'number' ? (
              <button
                key={entry}
                type="button"
                className={`pagination-page ${entry === safeCurrentPage ? 'active' : ''}`}
                aria-current={entry === safeCurrentPage ? 'page' : undefined}
                onClick={() => onPageChange(entry)}
              >
                {entry}
              </button>
            ) : (
              <span key={entry} className="pagination-ellipsis" aria-hidden="true">
                ...
              </span>
            ),
          )}
        </div>

        <button
          type="button"
          className="pagination-button"
          onClick={() => onPageChange(safeCurrentPage + 1)}
          disabled={safeCurrentPage >= safeTotalPages}
        >
          <span>Next</span>
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}

function CreateGatepassModal({ open, currentUser, onClose, onSubmit }) {
  const [form, setForm] = useState({
    reason: '',
    vehicleNumber: '',
    outTime: '',
    expectedReturnTime: '',
  })
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  function updateFormField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setFieldErrors((prev) => clearFieldError(prev, field))
    setError('')
  }

  function keepFieldVisible(event) {
    const field = event.target
    window.setTimeout(() => {
      field.scrollIntoView({ block: 'center', inline: 'nearest' })
    }, 120)
  }

  useEffect(() => {
    if (open) {
      setForm({ reason: '', vehicleNumber: '', outTime: '', expectedReturnTime: '' })
      setFieldErrors({})
      setError('')
      setIsSubmitting(false)
    }
  }, [open])

  async function handleSubmit(event) {
    event.preventDefault()
    const reason = form.reason.trim()
    const vehicleNumber = normalizeVehicleNumber(form.vehicleNumber)
    const nextFieldErrors = getRequiredFieldErrors({
      vehicleNumber,
      outTime: form.outTime,
    }, {
      vehicleNumber: 'Vehicle number is required.',
      outTime: 'Out time is required.',
    })
    const reasonError = validateGatepassReason(reason)

    if (reasonError) {
      nextFieldErrors.reason = reasonError
    }

    if (Object.keys(nextFieldErrors).length) {
      setFieldErrors(nextFieldErrors)
      setError('')
      return
    }

    if (!VEHICLE_NUMBER_PATTERN.test(vehicleNumber)) {
      setFieldErrors((prev) => ({
        ...prev,
        vehicleNumber: 'Vehicle number can include letters, numbers, spaces, and hyphens only.',
      }))
      setError('')
      return
    }

    setIsSubmitting(true)

    try {
      const result = await onSubmit({
        ...form,
        reason,
        vehicleNumber,
      })

      if (!result?.ok) {
        if (!result?.cancelled) {
          const backendFieldErrors = mapGatepassFormFieldErrors(result?.fieldErrors)

          if (Object.keys(backendFieldErrors).length) {
            setFieldErrors((prev) => ({
              ...prev,
              ...backendFieldErrors,
            }))
          }

          setError(result?.error || 'Unable to submit the gatepass request right now.')
        }

        return
      }

      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <ModalForm
      open={open}
      title="Create a new gatepass"
      subtitle="Sent to Principal for review."
      onClose={onClose}
    >
      <form className="modal-form" onSubmit={handleSubmit} noValidate>
        <div className="read-only-grid">
          <ReadOnlyField label="Name" value={currentUser.name} />
          <ReadOnlyField value={currentUser.enrollment || currentUser.employeeId} valueOnly />
          {currentUser.program ? <ReadOnlyField label="Program" value={currentUser.program} /> : null}
          <ReadOnlyField label="Department" value={currentUser.department} />
        </div>
        <label>
          <FieldLabel required>Reason of Leaving</FieldLabel>
          <textarea
            value={form.reason}
            onChange={(event) => updateFormField('reason', event.target.value)}
            onFocus={keepFieldVisible}
            placeholder="Briefly explain why you need to leave campus"
            rows={4}
            className={fieldErrors.reason ? 'field-invalid' : ''}
            aria-invalid={Boolean(fieldErrors.reason)}
            required
          />
          {fieldErrors.reason ? <p className="field-error">{fieldErrors.reason}</p> : null}
        </label>
        <label>
          <FieldLabel required>Vehicle Number</FieldLabel>
          <input
            type="text"
            value={form.vehicleNumber}
            onChange={(event) => updateFormField('vehicleNumber', event.target.value)}
            onFocus={keepFieldVisible}
            placeholder="GJ-01-AB-1234"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className={fieldErrors.vehicleNumber ? 'field-invalid' : ''}
            aria-invalid={Boolean(fieldErrors.vehicleNumber)}
            required
          />
          {fieldErrors.vehicleNumber ? <p className="field-error">{fieldErrors.vehicleNumber}</p> : null}
        </label>
        <div className="read-only-grid">
          <label>
            <FieldLabel required>Out Time</FieldLabel>
            <input
              type="datetime-local"
              value={form.outTime}
              onChange={(event) => updateFormField('outTime', event.target.value)}
              onFocus={keepFieldVisible}
              className={fieldErrors.outTime ? 'field-invalid' : ''}
              aria-invalid={Boolean(fieldErrors.outTime)}
              required
            />
            {fieldErrors.outTime ? <p className="field-error">{fieldErrors.outTime}</p> : null}
          </label>
          <label>
            <FieldLabel>Expected Return Time</FieldLabel>
            <input
              type="datetime-local"
              value={form.expectedReturnTime}
              onChange={(event) => updateFormField('expectedReturnTime', event.target.value)}
              onFocus={keepFieldVisible}
              className={fieldErrors.expectedReturnTime ? 'field-invalid' : ''}
              aria-invalid={Boolean(fieldErrors.expectedReturnTime)}
            />
            {fieldErrors.expectedReturnTime ? <p className="field-error">{fieldErrors.expectedReturnTime}</p> : null}
          </label>
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        <div className="modal-actions">
          <ActionButton tone="secondary" type="button" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </ActionButton>
          <ActionButton type="submit" icon={Send} disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Submit Request'}
          </ActionButton>
        </div>
      </form>
    </ModalForm>
  )
}

function RejectRequestModal({ open, request, onClose, onSubmit }) {
  const [rejectionReason, setRejectionReason] = useState('')
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const textareaRef = useRef(null)
  const requestIdentifier = request?.gatepassId || request?.id || ''
  const requestIdentifierLabel = request?.requestKind === 'faculty_leave' ? 'Request ID' : 'Gatepass ID'
  const title = request?.requestKind === 'faculty_leave' ? 'Reject Leave Request' : 'Reject Gatepass'

  useEffect(() => {
    if (!open) return

    setRejectionReason('')
    setError('')
    setFieldErrors({})
    setIsSubmitting(false)

    const focusTimer = window.setTimeout(() => {
      textareaRef.current?.focus()
    }, 60)

    return () => window.clearTimeout(focusTimer)
  }, [open, request?.id])

  function updateReason(value) {
    setRejectionReason(value)
    setFieldErrors((prev) => clearFieldError(prev, 'rejectionReason'))
    setError('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const normalizedReason = rejectionReason.trim()
    const reasonError = validateRejectReason(normalizedReason)

    if (reasonError) {
      setFieldErrors({ rejectionReason: reasonError })
      setError('')
      return
    }

    setIsSubmitting(true)

    try {
      const result = await onSubmit(normalizedReason)

      if (!result?.ok) {
        if (!result?.cancelled) {
          if (result?.fieldErrors?.rejectionReason) {
            setFieldErrors({ rejectionReason: result.fieldErrors.rejectionReason })
          }

          setError(result?.error || 'Unable to reject this request right now.')
        }

        return
      }

      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <ModalForm
      open={open}
      title={title}
      subtitle={requestIdentifier ? `${requestIdentifierLabel}: ${requestIdentifier}` : ''}
      onClose={() => {
        if (!isSubmitting) {
          onClose()
        }
      }}
      className="reject-modal-card"
      backdropClassName="reject-modal-backdrop"
    >
      <form className="modal-form reject-modal-form" onSubmit={handleSubmit} noValidate>
        <div className="reject-modal-copy">
          <div className="reject-modal-request">
            <strong>{request?.name || 'Pending request'}</strong>
            {request?.enrollment ? <span>{request.enrollment}</span> : null}
            {request?.department ? <span>{request.department}</span> : null}
          </div>
        </div>
        <label>
          <FieldLabel required>Reject Reason</FieldLabel>
          <textarea
            ref={textareaRef}
            value={rejectionReason}
            onChange={(event) => updateReason(event.target.value)}
            placeholder="Explain clearly why this request is being rejected"
            rows={5}
            className={fieldErrors.rejectionReason ? 'field-invalid' : ''}
            aria-invalid={Boolean(fieldErrors.rejectionReason)}
            required
          />
          {fieldErrors.rejectionReason ? <p className="field-error">{fieldErrors.rejectionReason}</p> : null}
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        <div className="modal-actions reject-modal-actions">
          <ActionButton tone="secondary" type="button" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </ActionButton>
          <ActionButton tone="danger" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Rejecting...' : 'Confirm Reject'}
          </ActionButton>
        </div>
      </form>
    </ModalForm>
  )
}

function ReadOnlyField({ label = '', value, valueOnly = false }) {
  return <IdentityField className="read-only-field" label={label} value={value} valueOnly={valueOnly} />
}

function getRoleScopedGatepasses(currentUser, gatepasses) {
  if (!currentUser) return []
  return Array.isArray(gatepasses) ? gatepasses : []
}

function getRoleStats(currentUser, summary, gatepasses) {
  const summaryStats = summary?.stats || {}

  if (currentUser.role === 'student') {
    return {
      total: summaryStats.totalPasses ?? summaryStats.totalRequests ?? gatepasses.length,
      pending: summaryStats.pending ?? gatepasses.filter((item) => item.status === 'Pending').length,
      forwarded: summaryStats.forwarded ?? gatepasses.filter((item) => item.status === 'Forwarded').length,
      approved: summaryStats.approved ?? gatepasses.filter((item) => item.status === 'Approved').length,
      rejected: summaryStats.rejected ?? gatepasses.filter((item) => item.status === 'Rejected').length,
      outdated: summaryStats.outdated ?? gatepasses.filter((item) => item.status === 'Outdated' || item.isOutdated).length,
    }
  }

  if (currentUser.role === 'faculty') {
    const coordinatorEnabled =
      summaryStats.coordinatorEnabled === true ||
      Boolean(currentUser.coordinatorAssignment?.isCoordinator)
    const coordinatorPending =
      summaryStats.coordinatorPending ??
      gatepasses.filter((item) => ['coordinator', 'coordinator_review'].includes(item.stage) && (item.status === 'Pending' || item.status === 'Forwarded')).length
    const coordinatorApproved = summaryStats.coordinatorApproved ?? 0
    const coordinatorRejected = summaryStats.coordinatorRejected ?? 0
    const coordinatorOutdated = summaryStats.coordinatorOutdated ?? 0

    return {
      total: summaryStats.totalRequests ?? summaryStats.totalPasses ?? gatepasses.length,
      approved: (summaryStats.approved ?? 0) + coordinatorApproved,
      rejected: (summaryStats.rejected ?? 0) + coordinatorRejected,
      pending: (summaryStats.pending ?? 0) + coordinatorPending,
      outdated: (summaryStats.outdated ?? 0) + coordinatorOutdated,
      coordinatorEnabled,
      coordinatorPending,
      coordinatorApproved,
      coordinatorRejected,
      coordinatorOutdated,
    }
  }

  if (currentUser.role === 'principal') {
    const forwardedCount = typeof summaryStats.forwardedCount === 'number'
      ? summaryStats.forwardedCount
      : typeof summaryStats.forwarded === 'number'
        ? summaryStats.forwarded
        : gatepasses.filter((item) => item.status === 'Forwarded' || item.rawStatus?.startsWith('forwarded_')).length

    const pendingDirect = typeof summaryStats.pendingStudentRequests === 'number'
      ? summaryStats.pendingStudentRequests + (summaryStats.pendingFacultyRequests || 0)
      : typeof summaryStats.pending === 'number'
        ? summaryStats.pending
        : typeof summaryStats.pendingRequests === 'number'
          ? summaryStats.pendingRequests
          : gatepasses.filter((item) => item.status === 'Pending' && !item.rawStatus?.startsWith('forwarded_')).length

    return {
      pending: pendingDirect,
      forwarded: forwardedCount,
      approved: summaryStats.approvedCount ?? summaryStats.approved ?? summaryStats.finalApprovedCount ?? 0,
      rejected: summaryStats.rejectedCount ?? summaryStats.rejected ?? 0,
      outdated: summaryStats.outdatedCount ?? summaryStats.outdated ?? gatepasses.filter((item) => item.status === 'Outdated' || item.isOutdated).length,
    }
  }

  if (currentUser.role === 'admin') {
    return {
      total: summaryStats.total ?? summaryStats.totalRequests ?? gatepasses.length,
      pending: summaryStats.pending ?? gatepasses.filter((item) => item.status === 'Pending' || item.status === 'Forwarded').length,
      approved: summaryStats.approved ?? gatepasses.filter((item) => item.status === 'Approved').length,
      rejected: summaryStats.rejected ?? gatepasses.filter((item) => item.status === 'Rejected').length,
      checkedOut: summaryStats.checkedOut ?? gatepasses.filter((item) => item.status === 'Out').length,
      completed: summaryStats.completed ?? gatepasses.filter((item) => item.status === 'Returned' || item.status === 'Completed').length,
      outdated: summaryStats.outdated ?? gatepasses.filter((item) => item.status === 'Outdated' || item.isOutdated).length,
    }
  }

  if (currentUser.role === 'hod') {
    return {
      pending: summaryStats.pending ?? summaryStats.pendingReviews ?? gatepasses.filter((item) => item.status === 'Pending' || item.status === 'Forwarded').length,
      handled: summaryStats.handled ?? summaryStats.totalHandled ?? 0,
      approved: summaryStats.approved ?? summaryStats.approvedCount ?? summaryStats.approvedByHod ?? 0,
      rejected: summaryStats.rejected ?? summaryStats.rejectedCount ?? summaryStats.rejectedByHod ?? 0,
      outdated: summaryStats.outdated ?? summaryStats.outdatedCount ?? gatepasses.filter((item) => item.status === 'Outdated' || item.isOutdated).length,
    }
  }

  if (currentUser.role === 'chairman') {
    return {
      pending: summaryStats.pending ?? gatepasses.filter((item) => item.status === 'Pending' || item.status === 'Forwarded').length,
      approved: summaryStats.approved ?? 0,
      rejected: summaryStats.rejected ?? 0,
      outdated: summaryStats.outdated ?? gatepasses.filter((item) => item.status === 'Outdated' || item.isOutdated).length,
    }
  }

  if (currentUser.role === 'campus_security') {
    return {
      pending: summaryStats.pending ?? gatepasses.filter((item) => item.status === 'Pending' || item.status === 'Forwarded').length,
      cleared: summaryStats.cleared ?? 0,
      outdated: summaryStats.outdated ?? gatepasses.filter((item) => item.status === 'Outdated' || item.isOutdated).length,
    }
  }

  if (currentUser.role === 'cao') {
    return {
      pending: summaryStats.pendingFacultyRequests ?? summaryStats.pending ?? gatepasses.filter((item) => item.status === 'Pending').length,
      total:
        summary?.stats
          ? summaryStats.totalRequests ??
            (summaryStats.pendingFacultyRequests ?? 0) +
              (summaryStats.approvedByCao ?? 0) +
              (summaryStats.rejectedByCao ?? 0)
          : gatepasses.length,
      approved: summaryStats.approvedByCao ?? summaryStats.approved ?? 0,
      rejected: summaryStats.rejectedByCao ?? summaryStats.rejected ?? 0,
      outdated: summaryStats.outdated ?? 0,
    }
  }

  return {
    ready: summaryStats.ready ?? summaryStats.readyForVerificationToday ?? gatepasses.filter((item) => item.status === 'Approved').length,
    out: summaryStats.out ?? summaryStats.checkedOutToday ?? gatepasses.filter((item) => item.status === 'Out').length,
    returned: summaryStats.returned ?? summaryStats.completedToday ?? gatepasses.filter((item) => item.status === 'Returned').length,
    outdated: summaryStats.outdated ?? gatepasses.filter((item) => item.status === 'Outdated' || item.isOutdated).length,
  }
}

function getSummaryCards(role, stats) {
  if (role === 'admin') {
    return [
      { label: 'Total Requests', value: stats.total, icon: QrCode },
      { label: 'Pending Review', value: stats.pending, icon: Clock3, tone: 'warning' },
      { label: 'Approved', value: stats.approved, icon: CheckCircle2, tone: 'success' },
      { label: 'Rejected', value: stats.rejected, icon: XCircle, tone: 'danger' },
      { label: 'Checked Out', value: stats.checkedOut ?? stats.out ?? 0, icon: Send, tone: 'info' },
      { label: 'Completed', value: stats.completed ?? stats.returned ?? 0, icon: CheckCircle2, tone: 'success' },
    ]
  }

  if (role === 'student') {
    return [
      { label: 'Total Passes', value: stats.total, icon: QrCode },
      { label: 'Pending', value: stats.pending, icon: Clock3, tone: 'warning' },
      { label: 'Forwarded', value: stats.forwarded, icon: Send, tone: 'info' },
      { label: 'Approved', value: stats.approved, icon: CheckCircle2, tone: 'success' },
      { label: 'Rejected', value: stats.rejected, icon: XCircle, tone: 'danger' },
      { label: 'Outdated', value: stats.outdated, icon: AlertTriangle, tone: 'danger' },
    ]
  }

  if (role === 'faculty') {
    if (stats.coordinatorEnabled) {
      return [
        { label: 'Professor Requests', value: stats.total, icon: QrCode },
        { label: 'Coordinator Queue', value: stats.coordinatorPending, icon: Clock3, tone: 'warning' },
        { label: 'Approved', value: stats.approved, icon: CheckCircle2, tone: 'success' },
        { label: 'Rejected', value: stats.rejected, icon: XCircle, tone: 'danger' },
        { label: 'Outdated', value: stats.outdated, icon: AlertTriangle, tone: 'danger' },
      ]
    }

    return [
      { label: 'Total Requests', value: stats.total, icon: QrCode },
      { label: 'Approved', value: stats.approved, icon: CheckCircle2, tone: 'success' },
      { label: 'Rejected', value: stats.rejected, icon: XCircle, tone: 'danger' },
      { label: 'Pending', value: stats.pending, icon: Clock3, tone: 'warning' },
    ]
  }

  if (role === 'principal') {
    return [
      { label: 'Pending Review', value: stats.pending, icon: Clock3, tone: 'warning' },
      { label: 'Forwarded', value: stats.forwarded, icon: Send, tone: 'info' },
      { label: 'Approved', value: stats.approved, icon: CheckCircle2, tone: 'success' },
      { label: 'Rejected', value: stats.rejected, icon: XCircle, tone: 'danger' },
      { label: 'Outdated', value: stats.outdated, icon: AlertTriangle, tone: 'danger' },
    ]
  }

  if (role === 'hod') {
    return [
      { label: 'Pending Review', value: stats.pending, icon: Clock3, tone: 'warning' },
      { label: 'Handled', value: stats.handled, icon: QrCode },
      { label: 'Approved', value: stats.approved, icon: CheckCircle2, tone: 'success' },
      { label: 'Rejected', value: stats.rejected, icon: XCircle, tone: 'danger' },
      { label: 'Outdated', value: stats.outdated, icon: AlertTriangle, tone: 'danger' },
    ]
  }

  if (role === 'chairman') {
    return [
      { label: 'Pending Review', value: stats.pending, icon: Clock3, tone: 'warning' },
      { label: 'Approved', value: stats.approved, icon: CheckCircle2, tone: 'success' },
      { label: 'Rejected', value: stats.rejected, icon: XCircle, tone: 'danger' },
      { label: 'Outdated', value: stats.outdated, icon: AlertTriangle, tone: 'danger' },
    ]
  }

  if (role === 'campus_security') {
    return [
      { label: 'Pending Verification', value: stats.pending, icon: Clock3, tone: 'warning' },
      { label: 'Campus Cleared', value: stats.cleared, icon: CheckCircle2, tone: 'success' },
      { label: 'Outdated', value: stats.outdated, icon: AlertTriangle, tone: 'danger' },
    ]
  }

  if (role === 'cao') {
    return [
      { label: 'Total', value: stats.total, icon: QrCode },
      { label: 'Pending Professor', value: stats.pending, icon: Clock3, tone: 'warning' },
      { label: 'Approved', value: stats.approved, icon: CheckCircle2, tone: 'success' },
      { label: 'Rejected', value: stats.rejected, icon: XCircle, tone: 'danger' },
    ]
  }

  if (role === 'security') {
    return [
      { label: 'Ready for OUT', value: stats.ready, icon: ScanLine, tone: 'info' },
      { label: 'OUT', value: stats.out, icon: QrCode },
      { label: 'Returned', value: stats.returned, icon: CheckCircle2, tone: 'success' },
      { label: 'Outdated', value: stats.outdated, icon: AlertTriangle, tone: 'danger' },
    ]
  }

  return [
    { label: 'Total', value: stats.total, icon: QrCode },
    { label: 'Approved', value: stats.approved, icon: CheckCircle2, tone: 'success' },
    { label: 'Rejected', value: stats.rejected, icon: XCircle, tone: 'danger' },
    { label: 'Pending', value: stats.pending, icon: Clock3, tone: 'warning' },
  ]
}

function canSecurityMarkIn(gatepass) {
  if (!gatepass) {
    return false
  }

  return Boolean(gatepass.canMarkIn ?? gatepass.returnTime ?? gatepass.expectedReturnTime)
}

function getAvailableActions(role, gatepass, onGatepassAction, securityStation = 'campus') {
  function handleAction(action) {
    return async () => {
      await onGatepassAction(gatepass, action)
    }
  }

  if (gatepass.requestKind === 'faculty_leave') {
    if (role === 'security') {
      const isCampusCleared = Boolean(gatepass.campusCleared || gatepass.security?.campusCleared)
      if (securityStation === 'campus') {
        if (gatepass.status === 'Approved' && !isCampusCleared) {
          return [{ label: 'Campus Clear', tone: 'primary', onClick: handleAction('campusClear') }]
        }
      } else {
        if (gatepass.status === 'Approved') {
          return [{ label: 'Mark Out', tone: 'security-out', onClick: handleAction('markOut') }]
        }

        if (gatepass.status === 'Out' && canSecurityMarkIn(gatepass)) {
          return [{ label: 'Mark Return', tone: 'secondary', onClick: handleAction('markIn') }]
        }
      }
    }

    if (role === 'hod' && gatepass.rawWorkloadStatus === 'pending_hod') {
      return [
        { label: 'Approve', tone: 'success', onClick: handleAction('approve') },
        { label: 'Reject', tone: 'danger', onClick: handleAction('reject') },
      ]
    }

    if (role === 'principal' && gatepass.rawShortLeaveStatus === 'pending_principal') {
      return [
        { label: 'Approve', tone: 'success', onClick: handleAction('approve') },
        { label: 'Reject', tone: 'danger', onClick: handleAction('reject') },
      ]
    }

    if (role === 'cao' && gatepass.rawShortLeaveStatus === 'pending_cao') {
      return [
        { label: 'Approve', tone: 'success', onClick: handleAction('approve') },
        { label: 'Reject', tone: 'danger', onClick: handleAction('reject') },
      ]
    }

    return []
  }

  if (role === 'principal' && gatepass.status === 'Pending' && ['principal', 'principal_review'].includes(gatepass.stage)) {
    return [
      { label: 'Approve', tone: 'success', onClick: handleAction('approve') },
      { label: 'Reject', tone: 'danger', onClick: handleAction('reject') },
      { label: 'Send to Academic HOD', tone: 'secondary', onClick: handleAction('forward') },
    ]
  }

  if (role === 'hod' && gatepass.status === 'Pending' && ['hod', 'hod_review'].includes(gatepass.stage)) {
    return [
      { label: 'Approve', tone: 'success', onClick: handleAction('approve') },
      { label: 'Reject', tone: 'danger', onClick: handleAction('reject') },
      { label: 'Send to Coordinator', tone: 'secondary', onClick: handleAction('sendToCoordinator') },
    ]
  }

  if (role === 'faculty' && gatepass.status === 'Pending' && ['coordinator', 'coordinator_review'].includes(gatepass.stage)) {
    return [
      { label: 'Approve', tone: 'success', onClick: handleAction('approve') },
      { label: 'Reject', tone: 'danger', onClick: handleAction('reject') },
    ]
  }

  if (role === 'cao' && gatepass.status === 'Pending') {
    return [
      { label: 'Approve', tone: 'success', onClick: handleAction('approve') },
      { label: 'Reject', tone: 'danger', onClick: handleAction('reject') },
    ]
  }

  if (role === 'admin') {
    const isAdminStage = [
      'forwarded_to_admin',
      'forwarded_to_chairman',
      'forwarded_to_campus_security',
      'approved_by_principal',
      'approved_by_hod',
      'approved_by_coordinator'
    ].includes(gatepass.rawStatus || gatepass.status)
    if (isAdminStage) {
      return [
        { label: 'Approve', tone: 'success', onClick: handleAction('approve') },
        { label: 'Reject', tone: 'danger', onClick: handleAction('reject') },
      ]
    }
  }

  if (role === 'chairman') {
    const isChairmanStage = (gatepass.rawStatus || gatepass.status) === 'forwarded_to_chairman'
    if (isChairmanStage) {
      return [
        { label: 'Approve', tone: 'success', onClick: handleAction('approve') },
        { label: 'Reject', tone: 'danger', onClick: handleAction('reject') },
      ]
    }
  }

  if (role === 'campus_security') {
    const isBouncerStage = [
      'approved_by_principal',
      'approved_by_hod',
      'approved_by_coordinator',
      'approved_by_admin',
      'approved_by_chairman',
      'forwarded_to_campus_security'
    ].includes(gatepass.rawStatus || gatepass.status)

    if (isBouncerStage) {
      return [
        { label: 'Verify & Tick', tone: 'success', onClick: handleAction('approve') },
        { label: 'Reject', tone: 'danger', onClick: handleAction('reject') }
      ]
    }
  }

  if (role === 'security') {
    const isCampusCleared = Boolean(gatepass.campusCleared || gatepass.security?.campusCleared)
    if (securityStation === 'campus') {
      if (gatepass.status === 'Approved' && !isCampusCleared) {
        return [{ label: 'Campus Clear', tone: 'primary', onClick: handleAction('campusClear') }]
      }
    } else {
      if (gatepass.status === 'Approved') {
        return [{ label: 'Mark Out', tone: 'security-out', onClick: handleAction('markOut') }]
      }
      if (gatepass.status === 'Out' && canSecurityMarkIn(gatepass)) {
        return [{ label: 'Mark Return', tone: 'secondary', onClick: handleAction('markIn') }]
      }
    }
  }

  return []
}

function getPageTitle(user, page) {
  if (page === 'profile') return 'Profile'
  if (page === 'notifications') return 'Notifications'
  return ''
}

function matchesGatepassReference(gatepass, focusReference) {
  if (!focusReference || !gatepass) {
    return false
  }

  const normalizedReference = String(focusReference || '').trim().toUpperCase()
  const candidateReferences = [gatepass.gatepassId, gatepass.requestNumber, gatepass.id]
    .filter(Boolean)
    .map((value) => String(value).trim().toUpperCase())

  return candidateReferences.includes(normalizedReference)
}

function getPageSubtitle(user, page) {
  if (page === 'profile') return ''
  if (page === 'notifications') return 'Latest workflow updates from your dashboard queue.'
  return ''
}

function getListTitle(user) {
  if (user?.role === 'faculty') {
    return user?.coordinatorAssignment?.isCoordinator
      ? 'Professor and coordinator review queue'
      : 'Leave application history'
  }
  if (user?.role === 'principal') return 'Principal review queue'
  if (user?.role === 'hod') return 'Academic HOD review queue'
  if (user?.role === 'admin') return 'Administrator overview & review queue'
  if (user?.role === 'cao') return 'CAO review queue'
  if (user?.role === 'campus_security') return 'Security | Bouncer clearance queue'
  if (user?.role === 'chairman') return 'Director review queue'
  if (user?.role === 'security') return 'Security | Main Gate verification queue'
  return 'Gatepass history'
}

export default App
