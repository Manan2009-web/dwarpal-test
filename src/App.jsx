import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
// import logo from "../assets/DwarPal_logo.png";
import {
  Bell,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  QrCode,
  ScanLine,
  Send,
  ShieldCheck,
  UserPlus2,
  XCircle,
} from 'lucide-react'
import './App.css'
import AppBrand from './components/AppBrand'
import AdminPortal from './components/AdminPortal'
import SupportModal from './components/SupportModal'
import StudentLoginOtpModal from './components/StudentLoginOtpModal'
import StudentPasswordChangeModal from './components/StudentPasswordChangeModal'
import AuthPage from './components/auth/AuthPage'
import AccessPortalScreen from './components/auth/AccessPortalScreen'
import LoginForm from './components/auth/LoginForm'
import MascotPanel from './components/auth/MascotPanel'
import FacultyLeaveWizard from './components/FacultyLeaveWizard'
import FeatureBoundary from './components/FeatureBoundary'
import ForceEmailVerificationModal from './components/ForceEmailVerificationModal'
import ForgotPasswordModal from './components/ForgotPasswordModal'
import GatepassQrModal from './components/GatepassQrModal'
import NotificationCenterPanel from './components/NotificationCenterPanel'
import { NotificationProvider, useNotifications } from './components/NotificationProvider'
import ExpandableGatepassCard from './components/ExpandableGatepassCard'
import NotificationPermissionPrompt, {
  NotificationPermissionCard,
} from './components/NotificationPermissionPrompt'
import PreferencesPanel from './components/PreferencesPanel'
import PrivacyPreferencesBanner from './components/PrivacyPreferencesBanner'
import PasswordInput from './components/PasswordInput'
import RegisterOtpModal from './components/RegisterOtpModal'
import SecurityVerificationPanel from './components/SecurityVerificationPanel'
import { useToast } from './components/ToastProvider'
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
  clearStoredAuthToken,
  confirmPasswordChange,
  createBiometricAuthenticationOptions,
  createBiometricRegistrationOptions,
  DEFAULT_WORKSPACE_PAGE_SIZE,
  fetchWorkspace,
  getBiometricDevices,
  getApiErrorDetails,
  getApiErrorMessage,
  getPortalAccessSession,
  hasStoredAuthToken,
  loginUser,
  logoutUser,
  normalizePhoneNumberInput,
  requestPasswordChange,
  requestPortalAccess,
  resolveForgotPasswordAccount,
  resetForgotPassword,
  resendRegistrationOtp,
  readBiometricDeviceId,
  removeBiometricDevice,
  sendEmailVerificationOtp,
  startStudentLogin,
  startForgotPassword,
  startRegistration,
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
  cao: '/cao/dashboard',
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

  if (['principal', 'hod', 'cao', 'security'].includes(role)) {
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

  if (hasAdminPortalAccess(user)) {
    return '/admin/dashboard'
  }

  const role = normalizeRole(user.role)

  if (role === 'student' || role === 'faculty') {
    return '/user/dashboard'
  }

  return getDashboardPathForRole(role)
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
const APP_PAGES = new Set(['dashboard', 'notifications', 'profile'])
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
  }

  if (normalizedRole !== 'student') {
    delete normalizedErrors.semester
  }

  if (!['student', 'hod'].includes(normalizedRole)) {
    delete normalizedErrors.program
  }

  if (normalizedRole === 'security') {
    delete normalizedErrors.department
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
  return role === 'student' || role === 'hod'
}

function getRegistrationDepartmentOptions(role, program) {
  if (roleUsesProgramRouting(role)) {
    return program ? ROUTING_DEPARTMENTS : []
  }

  return DEPARTMENTS
}

function App() {
  const toast = useToast()
  const [gatepasses, setGatepasses] = useState([])
  const [gatepassMeta, setGatepassMeta] = useState(() => createEmptyGatepassMeta())
  const [summary, setSummary] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)
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
  const requiresEmailVerification = currentUser?.emailVerified === false

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

  const savePortalAccess = useCallback((nextPortalAccess) => {
    if (!nextPortalAccess?.token || !nextPortalAccess?.accessType) {
      clearPortalAccessSession()
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
        if (
          ['SMTP_NOT_CONFIGURED', 'SMTP_DELIVERY_FAILED', 'OTP_EMAIL_DELIVERY_FAILED'].includes(errorDetails.code) ||
          /otp email could not be sent/i.test(errorDetails.message)
        ) {
          return {
            ...errorDetails,
            fieldErrors: {},
            message: 'OTP email could not be sent. Please check email configuration or try again.',
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
      if (!currentUser?.role || currentUser?.emailVerified === false) return

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
    [currentUser?.emailVerified, currentUser?.role, loadWorkspace, resolveApiError, toast],
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
    if (!currentUser?.role || currentUser?.emailVerified === false) {
      refreshRequestRef.current += 1
      workspaceRequestOptionsRef.current = DEFAULT_WORKSPACE_REQUEST_OPTIONS
      resetWorkspace()
      return undefined
    }

    const controller = new AbortController()
    refreshAppData(controller.signal)

    return () => controller.abort()
  }, [currentUser?.emailVerified, currentUser?.id, currentUser?.role, refreshAppData, resetWorkspace])

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

      if (['PORTAL_ACCESS_INVALID', 'PORTAL_ACCESS_DENIED', 'PORTAL_ACCESS_REQUIRED'].includes(errorDetails.code)) {
        savePortalAccess(null)
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

  async function login(identifier, password, accessType = portalAccess?.accessType || 'faculty') {
    const normalizedIdentifier = String(identifier || '').trim()

    if (accessType === 'student') {
      try {
        const result = await startStudentLogin({
          identifier: normalizedIdentifier,
          password,
        })

        return {
          ok: true,
          requiresOtp: true,
          ...result,
        }
      } catch (error) {
        const errorDetails = resolveApiError(error, {
          fallbackMessage: 'Unable to start student sign-in right now.',
          authMode: 'student-login',
        })

        if (['PORTAL_ACCESS_INVALID', 'PORTAL_ACCESS_REQUIRED'].includes(errorDetails.code)) {
          savePortalAccess(null)
        }

        toast.error({
          title: 'Student login failed',
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

    try {
      const user = await loginUser(normalizedIdentifier, password)
      const verificationRequired = user?.emailVerified === false
      setCurrentUser(user)
      toast[verificationRequired ? 'warning' : 'success']?.({
        title: verificationRequired ? 'Email verification required' : 'Login successful',
        message: verificationRequired
          ? 'Please verify your email to continue using DwarPal.'
          : `Welcome back to DwarPal, ${user.name}.`,
      })
      return { ok: true, user, dashboardPath: getLandingPathForUser(user) }
    } catch (error) {
      const errorDetails = resolveApiError(error, {
        fallbackMessage: 'Unable to complete DwarPal sign-in. Please try again.',
        authMode: 'login',
      })

      if (['PORTAL_ACCESS_INVALID', 'PORTAL_ACCESS_REQUIRED'].includes(errorDetails.code)) {
        savePortalAccess(null)
      }

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

      if (['PORTAL_ACCESS_INVALID', 'PORTAL_ACCESS_REQUIRED'].includes(errorDetails.code)) {
        savePortalAccess(null)
      }

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

      if (['PORTAL_ACCESS_INVALID', 'PORTAL_ACCESS_REQUIRED'].includes(errorDetails.code)) {
        savePortalAccess(null)
      }

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
      const verificationRequired = user?.emailVerified === false
      setCurrentUser(user)
      toast[verificationRequired ? 'warning' : 'success']?.({
        title: verificationRequired ? 'Email verification required' : 'Login successful',
        message: verificationRequired
          ? 'Please verify your email to continue using DwarPal.'
          : `Signed in with ${mode === 'face' ? 'face recognition' : 'fingerprint'} successfully.`,
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
    const requiresDepartment = normalizedRole !== 'security'
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
      const result = await startRegistration({
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
        message: result.message,
        email: result.email || normalizedEmail,
        cooldownSeconds: result.cooldownSeconds || 45,
        expiresInSeconds: result.expiresInSeconds || 300,
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
      const updatedUser = await updateCurrentUserProfile(profileUpdates)

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

  async function addGatepass(form) {
    if (!currentUser) {
      return { ok: false, error: 'Please sign in again to submit your request.' }
    }

    try {
      const requestPayload =
        currentUser.role === 'faculty'
          ? {
              ...form,
              requestKind: 'faculty_leave',
            }
          : {
              ...form,
              requestKind: 'student_gatepass',
              vehicleNumber: normalizeVehicleNumber(form.vehicleNumber),
            }

      const createdRequest = await submitRequest(requestPayload)
      setGatepasses((previousGatepasses) => [
        createdRequest,
        ...previousGatepasses.filter((item) => item.recordId !== createdRequest.recordId),
      ])
      await refreshAppData(undefined, { force: true })
      toast.success({
        title: currentUser.role === 'faculty' ? 'Leave request created' : 'Gatepass created',
        message:
          currentUser.role === 'faculty'
            ? 'Your leave request was submitted successfully.'
            : 'Your gatepass request was submitted successfully.',
      })
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
      await refreshAppData(undefined, { force: true })
      const toastMeta = getActionToastMeta(request, action)
      toast[toastMeta.tone]?.({
        title: toastMeta.title,
        message: toastMeta.message,
      })
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
        <div className={requiresEmailVerification ? 'app-shell-lock-surface' : ''} aria-hidden={requiresEmailVerification}>
          <AppShell
            currentUser={currentUser}
            summary={summary}
            gatepasses={gatepasses}
            gatepassMeta={gatepassMeta}
            onLogout={logout}
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
        <ForceEmailVerificationModal
          open={requiresEmailVerification}
          currentUser={currentUser}
          onSendOtp={sendCurrentUserVerificationOtp}
          onUpdateEmail={updateCurrentUserVerificationEmail}
          onVerifyOtp={verifyCurrentUserEmailOtpCode}
        />
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
        <div className={requiresEmailVerification ? 'app-shell-lock-surface' : ''} aria-hidden={requiresEmailVerification}>
          <AdminPortal currentUser={currentUser} onLogout={logout} onOpenSupport={() => setSupportModalOpen(true)} />
        </div>
        <ForceEmailVerificationModal
          open={requiresEmailVerification}
          currentUser={currentUser}
          onSendOtp={sendCurrentUserVerificationOtp}
          onUpdateEmail={updateCurrentUserVerificationEmail}
          onVerifyOtp={verifyCurrentUserEmailOtpCode}
        />
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

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={<DefaultRoute currentUser={currentUser} authReady={authReady} />}
        />
        <Route
          path="/login"
          element={
            <PublicAuthRoute currentUser={currentUser} authReady={authReady}>
              {['student', 'faculty'].includes(portalAccess?.accessType) ? (
                <LoginScreen
                  accessType={portalAccess?.accessType || 'faculty'}
                  onBiometricLogin={loginWithBiometric}
                  onForgotPasswordResolveAccount={resolveForgotPasswordAccountFlow}
                  onForgotPasswordReset={resetForgotPasswordFlow}
                  onForgotPasswordStart={startForgotPasswordFlow}
                  onForgotPasswordVerifyOtp={verifyForgotPasswordOtpCode}
                  onLogin={login}
                  onStudentLoginResendOtp={resendStudentLoginOtpCode}
                  onStudentLoginVerifyOtp={verifyStudentLoginOtpCode}
                />
              ) : (
                <AccessPortalScreen currentPortalAccess={portalAccess} onSubmitPortalAccess={submitPortalAccess} />
              )}
            </PublicAuthRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicAuthRoute currentUser={currentUser} authReady={authReady}>
              {portalAccess?.accessType === 'faculty' ? (
                <RegisterScreen
                  onRegister={registerAccount}
                  onResendOtp={resendRegistrationOtpCode}
                  onVerifyOtp={verifyRegistrationOtpCode}
                />
              ) : (
                <AccessPortalScreen currentPortalAccess={portalAccess} onSubmitPortalAccess={submitPortalAccess} />
              )}
            </PublicAuthRoute>
          }
        />
        <Route
          path="/app/:page"
          element={renderAppShellRoute()}
        />
        <Route path="/user/:page" element={renderUserRoute()} />
        <Route path="/admin/*" element={renderAdminRoute()} />
        <Route path="/student/dashboard" element={renderAppShellRoute('student')} />
        <Route path="/faculty/dashboard" element={renderAppShellRoute('faculty')} />
        <Route path="/principal/dashboard" element={renderAppShellRoute('principal')} />
        <Route path="/hod/dashboard" element={renderAppShellRoute('hod')} />
        <Route path="/security/dashboard" element={renderAppShellRoute('security')} />
        <Route path="/cao/dashboard" element={renderAppShellRoute('cao')} />
        <Route path="*" element={<DefaultRoute currentUser={currentUser} authReady={authReady} />} />
      </Routes>
      <FeatureBoundary label="Privacy preferences banner">
        <PrivacyPreferencesBanner
          open={!cookieConsent || cookieBannerForcedOpen}
          onAccept={() => handleCookiePreferenceChange('accepted')}
          onReject={() => handleCookiePreferenceChange('rejected')}
        />
      </FeatureBoundary>
      <SupportModal open={supportModalOpen} onClose={() => setSupportModalOpen(false)} support={SUPPORT_CONFIG} />
      <StudentPasswordChangeModal
        open={studentPasswordPromptOpen && currentUser?.role === 'student'}
        currentUser={currentUser}
        onClose={() => setStudentPasswordPromptOpen(false)}
        onRequestOtp={requestStudentPasswordChangeOtp}
        onConfirmPasswordChange={confirmStudentPasswordChange}
        onPasswordChanged={(updatedUser) => {
          if (updatedUser) {
            setCurrentUser(updatedUser)
          }
          setStudentPasswordPromptOpen(false)
        }}
      />
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

function RoleDashboardRoute({ currentUser, authReady, expectedRole, children }) {
  useRouteGuardDebug(`${expectedRole}-dashboard`, authReady, currentUser)

  if (!authReady) return <AuthBootstrapScreen />
  if (!currentUser) return <Navigate to="/login" replace />

  const normalizedCurrentRole = normalizeRole(currentUser.role)
  if (normalizedCurrentRole !== expectedRole) {
    return <Navigate to={getLandingPathForUser(currentUser)} replace />
  }

  return children
}

function PublicAuthRoute({ currentUser, authReady, children }) {
  useRouteGuardDebug('public-auth', authReady, currentUser)

  // Login redirect protection: authenticated users are pushed away from public auth screens with replace
  // so the browser back button cannot reopen login/register as an active page.
  if (!authReady) return <AuthBootstrapScreen />
  if (currentUser) return <Navigate to={getLandingPathForUser(currentUser)} replace />
  return children
}

function DefaultRoute({ currentUser, authReady }) {
  useRouteGuardDebug('default', authReady, currentUser)

  if (!authReady) return <AuthBootstrapScreen />
  return <Navigate to={currentUser ? getLandingPathForUser(currentUser) : '/login'} replace />
}

function AuthBootstrapScreen() {
  return (
    <div className="auth-shell">
      <div className="auth-panel">
        <div className="auth-copy">
          <div className="auth-brand-wrap">
            <AppBrand size="md" layout="stacked" centered />
          </div>
          <h2>Loading your workspace...</h2>
        </div>
      </div>
    </div>
  )
}

function LoginScreen({
  accessType = 'faculty',
  onLogin,
  onForgotPasswordResolveAccount,
  onForgotPasswordStart,
  onForgotPasswordVerifyOtp,
  onForgotPasswordReset,
  onStudentLoginResendOtp,
  onStudentLoginVerifyOtp,
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const isStudentAccess = accessType === 'student'
  const identifierLabel = isStudentAccess ? 'Enrollment Number' : 'Employee ID'
  const identifierPlaceholder = isStudentAccess ? 'Enter your registered enrollment number' : 'Enter your employee ID'
  const identifierUsageLabel = isStudentAccess ? 'enrollment number' : 'employee ID'
  const [form, setForm] = useState({ identifier: '', password: '' })
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false)
  const [studentLoginSession, setStudentLoginSession] = useState({
    open: false,
    loginToken: '',
    maskedEmail: '',
    cooldownSeconds: 45,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submitLockRef = useRef(false)

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
    setForgotPasswordOpen(false)
    setStudentLoginSession({
      open: false,
      loginToken: '',
      maskedEmail: '',
      cooldownSeconds: 45,
    })
    setForm((previousForm) => ({
      ...previousForm,
      password: '',
    }))
  }, [accessType])

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

  function handleForgotPasswordClick() {
    const normalizedIdentifier = String(form.identifier || '').trim()

    if (!normalizedIdentifier) {
      setFieldErrors((previousErrors) => ({
        ...previousErrors,
        identifier: `Enter your ${identifierUsageLabel} before using Forgot Password.`,
      }))
      setError(`Please enter your ${identifierUsageLabel} first.`)
      setSuccess('')
      return
    }

    if (isEmailStyleIdentifier(normalizedIdentifier)) {
      setFieldErrors((previousErrors) => ({
        ...previousErrors,
        identifier: `Forgot password works only with your ${identifierUsageLabel}.`,
      }))
      setError(`Email login is not allowed. Use your ${identifierUsageLabel}.`)
      setSuccess('')
      return
    }

    setError('')
    setSuccess('')
    setForgotPasswordOpen(true)
  }

  function handleForgotPasswordComplete(result) {
    setForgotPasswordOpen(false)
    setForm((previousForm) => ({
      ...previousForm,
      password: '',
    }))
    setFieldErrors({})
    setError('')
    setSuccess(result?.message || 'Password reset successful. Please sign in with your new password.')
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
      const result = await onLogin(normalizedIdentifier, form.password, accessType)
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

      if (result.requiresOtp) {
        setStudentLoginSession({
          open: true,
          loginToken: result.loginToken || '',
          maskedEmail: result.maskedEmail || '',
          cooldownSeconds: result.cooldownSeconds || 45,
        })
        setForm((previousForm) => ({
          ...previousForm,
          password: '',
        }))
        setSuccess(result.message || 'OTP sent to the registered student email.')
        return
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

  return (
    <>
      <AuthPage left={<MascotPanel />} right={
        <LoginForm
          identifier={form.identifier}
          password={form.password}
          rememberMe={rememberMe}
          onIdentifierChange={(value) => updateFormField('identifier', value)}
          onPasswordChange={(value) => updateFormField('password', value)}
          onRememberMeChange={handleRememberMeChange}
          onForgotPassword={handleForgotPasswordClick}
          onSubmit={handleLogin}
          error={error}
          success={success}
          fieldErrors={fieldErrors}
          isSubmitting={isSubmitting}
          identifierLabel={identifierLabel}
          identifierPlaceholder={identifierPlaceholder}
          title={isStudentAccess ? 'Student Access' : 'Faculty Access'}
          subtitle={
            isStudentAccess
              ? 'Sign in with your enrollment number, then verify the OTP sent to your registered email.'
              : 'Sign in with your employee ID to continue to DwarPal.'
          }
          submitLabel={isStudentAccess ? 'Continue with OTP' : 'Sign in'}
          showForgotPassword={!isStudentAccess}
          showRegisterLink={!isStudentAccess}
        />
      } />
      <ForgotPasswordModal
        open={!isStudentAccess && forgotPasswordOpen}
        identifier={String(form.identifier || '').trim()}
        onClose={() => setForgotPasswordOpen(false)}
        onResolveAccount={onForgotPasswordResolveAccount}
        onStart={onForgotPasswordStart}
        onVerifyOtp={onForgotPasswordVerifyOtp}
        onResetPassword={onForgotPasswordReset}
        onComplete={handleForgotPasswordComplete}
      />
      <StudentLoginOtpModal
        open={studentLoginSession.open}
        maskedEmail={studentLoginSession.maskedEmail}
        cooldownSeconds={studentLoginSession.cooldownSeconds}
        onClose={() =>
          setStudentLoginSession((previousSession) => ({
            ...previousSession,
            open: false,
          }))
        }
        onResend={async () => {
          const result = await onStudentLoginResendOtp?.(studentLoginSession.loginToken)

          if (result?.ok) {
            setStudentLoginSession((previousSession) => ({
              ...previousSession,
              loginToken: result.loginToken || previousSession.loginToken,
              maskedEmail: result.maskedEmail || previousSession.maskedEmail,
              cooldownSeconds: result.cooldownSeconds || previousSession.cooldownSeconds,
            }))
          }

          return result
        }}
        onVerify={async (otp) => {
          const result = await onStudentLoginVerifyOtp?.({
            loginToken: studentLoginSession.loginToken,
            otp,
          })

          if (result?.ok) {
            setStudentLoginSession({
              open: false,
              loginToken: '',
              maskedEmail: '',
              cooldownSeconds: 45,
            })
            navigate(result.dashboardPath || '/user/dashboard', { replace: true })
          }

          return result
        }}
      />
    </>
  )
}

function RegisterScreen({ onRegister, onVerifyOtp, onResendOtp }) {
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
  })
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [otpModalOpen, setOtpModalOpen] = useState(false)
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState('')
  const [otpCooldownSeconds, setOtpCooldownSeconds] = useState(45)
  const [isRegistering, setIsRegistering] = useState(false)
  const hasSelectedRole = Boolean(form.role)
  const isStudentRole = form.role === 'student'
  const isSecurityRole = form.role === 'security'
  const requiresProgram = roleUsesProgramRouting(form.role)
  const departmentOptions = getRegistrationDepartmentOptions(form.role, form.program)
  const showDepartmentField = hasSelectedRole && !isSecurityRole && (!requiresProgram || Boolean(form.program))
  const requiresDepartment = hasSelectedRole ? !isSecurityRole : true
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
      department: nextRole === 'security' ? '' : nextRoleUsesProgram ? '' : prev.department,
      enrollment: (prev.role === 'student') !== (nextRole === 'student') ? '' : prev.enrollment,
      semester: nextRole === 'student' ? prev.semester : '',
    }))
    setFieldErrors((prev) => {
      const nextErrors = { ...prev }
      delete nextErrors.role
      delete nextErrors.program
      delete nextErrors.department
      delete nextErrors.enrollment
      delete nextErrors.semester
      return nextErrors
    })
    setError('')
  }

  function handleProgramChange(event) {
    const nextProgram = normalizeProgram(event.target.value)

    setForm((prev) => ({
      ...prev,
      program: nextProgram,
      department: '',
    }))
    setFieldErrors((prev) => {
      const nextErrors = { ...prev }
      delete nextErrors.program
      delete nextErrors.department
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
      setPendingVerificationEmail(result.email || submissionPayload.email)
      setOtpCooldownSeconds(result.cooldownSeconds || 45)
      setOtpModalOpen(true)
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

  return (
    <AuthShell title="Register">
      <form className="auth-form register-grid" onSubmit={handleCreateAccount} noValidate>
        <label>
          <FieldLabel required>Full Name</FieldLabel>
          <input
            value={form.name}
            onChange={(event) => updateFormField('name', event.target.value)}
            placeholder="Enter your full name"
            autoComplete="name"
            className={fieldErrors.name ? 'field-invalid' : ''}
            aria-invalid={Boolean(fieldErrors.name)}
            disabled={isRegistering}
            required
          />
          {fieldErrors.name ? <p className="field-error">{fieldErrors.name}</p> : null}
        </label>
        <label>
          <FieldLabel required>Email</FieldLabel>
          <input
            type="email"
            value={form.email}
            onChange={(event) => updateFormField('email', event.target.value)}
            placeholder="Enter your email address"
            autoComplete="email"
            className={fieldErrors.email ? 'field-invalid' : ''}
            aria-invalid={Boolean(fieldErrors.email)}
            disabled={isRegistering}
            required
          />
          {fieldErrors.email ? <p className="field-error">{fieldErrors.email}</p> : null}
        </label>
        <label>
          <FieldLabel required>Role</FieldLabel>
          <SelectField
            value={form.role}
            onChange={handleRoleChange}
            className={fieldErrors.role ? 'field-invalid' : ''}
            aria-invalid={Boolean(fieldErrors.role)}
            disabled={isRegistering}
            required
          >
            <option value="" disabled>
              Select role
            </option>
            {PUBLIC_ROLE_OPTIONS.map((role) => (
              <option key={role} value={role}>
                {ROLE_META[role].title}
              </option>
            ))}
          </SelectField>
          {fieldErrors.role ? <p className="field-error">{fieldErrors.role}</p> : null}
        </label>
        {requiresProgram ? (
          <label>
            <FieldLabel required>Program</FieldLabel>
            <SelectField
              value={form.program}
              onChange={handleProgramChange}
              className={fieldErrors.program ? 'field-invalid' : ''}
              aria-invalid={Boolean(fieldErrors.program)}
              disabled={isRegistering}
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
            {fieldErrors.program ? <p className="field-error">{fieldErrors.program}</p> : null}
          </label>
        ) : null}
        {showDepartmentField ? (
          <label>
            <FieldLabel required={requiresDepartment}>Department</FieldLabel>
            <SelectField
              value={form.department}
              onChange={(event) => updateFormField('department', event.target.value)}
              className={fieldErrors.department ? 'field-invalid' : ''}
              aria-invalid={Boolean(fieldErrors.department)}
              disabled={isRegistering}
              required={requiresDepartment}
            >
              <option value="" disabled>
                Select department
              </option>
              {departmentOptions.map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </SelectField>
            {fieldErrors.department ? <p className="field-error">{fieldErrors.department}</p> : null}
          </label>
        ) : null}
        {hasSelectedRole && requiresProgram && !form.program ? (
          <p className="field-hint full-span">
            Select a program first to load the available departments.
          </p>
        ) : null}
        <label>
          <FieldLabel required>Phone Number</FieldLabel>
          <input
            type="tel"
            value={form.phone}
            onChange={(event) => updateFormField('phone', event.target.value)}
            placeholder="Enter your phone number"
            autoComplete="tel"
            className={fieldErrors.phone ? 'field-invalid' : ''}
            aria-invalid={Boolean(fieldErrors.phone)}
            disabled={isRegistering}
            required
          />
          {fieldErrors.phone ? <p className="field-error">{fieldErrors.phone}</p> : null}
        </label>
        <label>
          <FieldLabel required>{roleIdLabel}</FieldLabel>
          <input
            id={roleIdName}
            name={roleIdName}
            value={form.enrollment}
            onChange={(event) => updateFormField('enrollment', event.target.value)}
            placeholder={roleIdPlaceholder}
            autoComplete="off"
            className={fieldErrors.enrollment ? 'field-invalid' : ''}
            aria-invalid={Boolean(fieldErrors.enrollment)}
            disabled={isRegistering}
            required
          />
          {fieldErrors.enrollment ? <p className="field-error">{fieldErrors.enrollment}</p> : null}
        </label>
        {isStudentRole ? (
          <label>
            <FieldLabel required>Semester</FieldLabel>
            <SelectField
              value={form.semester}
              onChange={(event) => updateFormField('semester', event.target.value)}
              className={fieldErrors.semester ? 'field-invalid' : ''}
              aria-invalid={Boolean(fieldErrors.semester)}
              disabled={isRegistering}
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
            {fieldErrors.semester ? <p className="field-error">{fieldErrors.semester}</p> : null}
          </label>
        ) : null}
        <label className="full-span">
          <FieldLabel required>Password</FieldLabel>
          <PasswordInput
            value={form.password}
            onChange={(value) => updateFormField('password', value)}
            placeholder="Enter your password"
            autoComplete="new-password"
            className={fieldErrors.password ? 'field-invalid' : ''}
            ariaInvalid={Boolean(fieldErrors.password)}
            disabled={isRegistering}
            required
          />
          {fieldErrors.password ? <p className="field-error">{fieldErrors.password}</p> : null}
        </label>
        {error ? <p className="form-error full-span" aria-live="polite">{error}</p> : null}
        {isRegistering ? (
          <p className="field-hint full-span" aria-live="polite">Creating your account...</p>
        ) : null}
        <div className="full-span">
          <ActionButton
            icon={UserPlus2}
            type="submit"
            disabled={isRegistering}
            aria-busy={isRegistering}
          >
            {isRegistering ? 'Creating Account...' : 'Create Account'}
          </ActionButton>
        </div>
      </form>
      <p className="auth-nav">
        Already have an account?{' '}
        <Link to="/login" replace className="auth-link">
          Login
        </Link>
      </p>
      <RegisterOtpModal
        open={otpModalOpen}
        email={pendingVerificationEmail}
        initialCooldownSeconds={otpCooldownSeconds}
        onClose={() => setOtpModalOpen(false)}
        onVerify={onVerifyOtp}
        onResend={onResendOtp}
        onVerified={(result) => {
          resetForm()
          setOtpModalOpen(false)
          navigate('/login', {
            replace: true,
            state: {
              authNotice: result?.message || 'Email verified successfully. You can sign in now.',
            },
          })
        }}
      />
    </AuthShell>
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

      {isLoading ? <p className="field-hint">Loading biometric devices...</p> : null}
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

function GatepassAvailabilityPanel({
  currentUser,
  onUpdateCurrentUserProfile,
  locationLabel = 'profile',
  compact = false,
}) {
  const [isSaving, setIsSaving] = useState(false)
  const approvalEnabled = currentUser?.gatepassApprovalEnabled !== false
  const roleLabel = currentUser?.role === 'principal' ? 'Principal' : 'HOD'

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
      <div className="availability-card-actions">
        <button
          type="button"
          className={`availability-toggle ${approvalEnabled ? 'enabled' : 'disabled'}`}
          onClick={handleToggleAvailability}
          disabled={isSaving}
          aria-pressed={approvalEnabled}
          aria-label={`${roleLabel} availability switch`}
        >
          <span className="availability-toggle-track">
            <span className="availability-toggle-thumb" />
          </span>
          <span>{isSaving ? 'Updating...' : approvalEnabled ? 'Switch OFF' : 'Switch ON'}</span>
        </button>
        <p className="field-hint">
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

function AppShell({
  currentUser,
  summary,
  gatepasses,
  gatepassMeta,
  onCurrentUserPatch,
  onUpdateCurrentUserProfile,
  onLogout,
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
  const [rejectRequest, setRejectRequest] = useState(null)
  const [navOpen, setNavOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [qrPreviewGatepass, setQrPreviewGatepass] = useState(null)
  const notificationWrapperRef = useRef(null)
  const hasSyncedInitialWorkspaceQueryRef = useRef(false)
  const hasOpenModal =
    modalOpen || Boolean(rejectRequest) || Boolean(qrPreviewGatepass) || notificationPromptOpen

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
              />
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
              onOpenModal={() => setModalOpen(true)}
              onGatepassAction={handleDashboardGatepassAction}
              focusReference={focusReference}
              onOpenQrPreview={handleOpenQrPreview}
            />
          ) : null}

          {currentPage === 'profile' ? (
            <ProfileCard currentUser={currentUser} onLogout={handleLogout}>
              <>
                <FeatureBoundary label="Preferences panel">
                  <PreferencesPanel
                    cookieConsent={cookieConsent}
                    notificationPermissionState={notificationPermissionState}
                    notificationsSupported={notificationsSupported}
                    onManageCookies={onManageCookiePreferences}
                    onManageNotifications={onOpenNotificationPrompt}
                  />
                </FeatureBoundary>
                {currentUser.role === 'principal' || currentUser.role === 'hod' ? (
                  <GatepassAvailabilityPanel
                    currentUser={currentUser}
                    onUpdateCurrentUserProfile={onUpdateCurrentUserProfile}
                    locationLabel="profile"
                  />
                ) : null}
                {['faculty', 'hod'].includes(currentUser.role) ? (
                  <CoordinatorAssignmentPanel
                    currentUser={currentUser}
                    onUpdateCurrentUserProfile={onUpdateCurrentUserProfile}
                  />
                ) : null}
                <BiometricSettingsPanel currentUser={currentUser} onCurrentUserPatch={onCurrentUserPatch} />
              </>
            </ProfileCard>
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
            />
          ) : null}
        </div>
      </div>

      <CreateGatepassModal
        open={currentUser.role === 'student' ? modalOpen : false}
        currentUser={currentUser}
        onClose={() => setModalOpen(false)}
        onSubmit={onAddGatepass}
      />
      <FacultyLeaveWizard
        open={currentUser.role === 'faculty' ? modalOpen : false}
        currentUser={currentUser}
        onClose={() => setModalOpen(false)}
        onSubmit={onAddGatepass}
      />
      <RejectRequestModal
        open={Boolean(rejectRequest)}
        request={rejectRequest}
        onClose={() => setRejectRequest(null)}
        onSubmit={handleRejectSubmit}
      />
      <GatepassQrModal
        gatepass={qrPreviewGatepass}
        open={Boolean(qrPreviewGatepass)}
        onClose={() => setQrPreviewGatepass(null)}
      />
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
          <EmptyState
            title="Loading notifications"
            description="Fetching your latest gatepass workflow updates from DwarPal."
          />
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
  const gatepassCards = useMemo(
    () =>
      gatepasses.map((gatepass) => ({
        gatepass,
        highlighted: matchesGatepassReference(gatepass, focusReference),
        actions: getAvailableActions(currentUser.role, gatepass, onGatepassAction),
      })),
    [currentUser.role, focusReference, gatepasses, onGatepassAction],
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
          <ActionButton icon={Send} onClick={onOpenModal}>
            + New Gatepass
          </ActionButton>
        </section>
      ) : null}

      <section className="summary-grid">
        {summaryCards.map((card) => (
          <SummaryCard key={card.label} {...card} />
        ))}
      </section>

      {currentUser.role === 'principal' || currentUser.role === 'hod' ? (
        <GatepassAvailabilityPanel
          currentUser={currentUser}
          onUpdateCurrentUserProfile={onUpdateCurrentUserProfile}
          locationLabel="dashboard"
          compact
        />
      ) : null}

      {currentUser.role === 'security' ? (
        <SecurityVerificationPanel
          onVerifyById={verifyGatepassById}
          onVerifyQr={verifyGatepassQr}
          onGatepassAction={onGatepassAction}
          onOpenQrPreview={onOpenQrPreview}
        />
      ) : null}

      <section className="workspace-card">
        <div className="workspace-top">
          <SearchBar value={searchTerm} onChange={onSearchTermChange} />
          <FilterTabs
            value={statusFilter}
            onChange={onStatusFilterChange}
            options={['All', 'Pending', 'Approved', 'Rejected', 'Out', 'Returned', 'Cancelled']}
          />
        </div>

        <div className="section-heading">
          <div>
            <h3>{getListTitle(currentUser)}</h3>
          </div>
        </div>

        {gatepassCards.length ? (
          <div className="gatepass-grid">
            {gatepassCards.map(({ gatepass, actions, highlighted }) => (
              <ExpandableGatepassCard
                key={gatepass.id}
                gatepass={gatepass}
                currentUserRole={currentUser.role}
                actions={actions}
                expanded={expandedGatepassId === gatepass.id}
                highlighted={highlighted}
                onOpenQrPreview={isRequester ? onOpenQrPreview : undefined}
                onToggle={() => setExpandedGatepassId((previousId) => (previousId === gatepass.id ? '' : gatepass.id))}
              />
            ))}
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
      total: summaryStats.totalRequests ?? summaryStats.totalPasses ?? gatepasses.length,
      approved: summaryStats.approved ?? gatepasses.filter((item) => item.status === 'Approved').length,
      rejected: summaryStats.rejected ?? gatepasses.filter((item) => item.status === 'Rejected').length,
      pending: summaryStats.pending ?? gatepasses.filter((item) => item.status === 'Pending').length,
    }
  }

  if (currentUser.role === 'faculty') {
    const coordinatorEnabled =
      summaryStats.coordinatorEnabled === true ||
      Boolean(currentUser.coordinatorAssignment?.isCoordinator)
    const coordinatorPending =
      summaryStats.coordinatorPending ??
      gatepasses.filter((item) => item.stage === 'coordinator' && item.status === 'Pending').length
    const coordinatorApproved = summaryStats.coordinatorApproved ?? 0
    const coordinatorRejected = summaryStats.coordinatorRejected ?? 0

    return {
      total: summaryStats.totalRequests ?? summaryStats.totalPasses ?? gatepasses.length,
      approved: (summaryStats.approved ?? 0) + coordinatorApproved,
      rejected: (summaryStats.rejected ?? 0) + coordinatorRejected,
      pending: (summaryStats.pending ?? 0) + coordinatorPending,
      coordinatorEnabled,
      coordinatorPending,
    }
  }

  if (currentUser.role === 'principal') {
    return {
      pending: summaryStats.pendingRequests ?? gatepasses.filter((item) => item.status === 'Pending').length,
      forwarded: summaryStats.forwardedCount ?? 0,
      approved: summaryStats.approvedCount ?? summaryStats.finalApprovedCount ?? summaryStats.approvedDirectCount ?? 0,
      rejected: summaryStats.rejectedCount ?? 0,
    }
  }

  if (currentUser.role === 'hod') {
    return {
      pending: summaryStats.pendingReviews ?? summaryStats.pendingForwardedRequests ?? gatepasses.filter((item) => item.status === 'Pending').length,
      handled: summaryStats.totalHandled ?? 0,
      approved: summaryStats.approvedCount ?? summaryStats.approvedByHod ?? 0,
      rejected: summaryStats.rejectedCount ?? summaryStats.rejectedByHod ?? 0,
    }
  }

  if (currentUser.role === 'cao') {
    return {
      pending: summaryStats.pendingFacultyRequests ?? gatepasses.filter((item) => item.status === 'Pending').length,
      total:
        summary?.stats
          ? summaryStats.totalRequests ??
            (summaryStats.pendingFacultyRequests ?? 0) +
              (summaryStats.approvedByCao ?? 0) +
              (summaryStats.rejectedByCao ?? 0)
          : gatepasses.length,
      approved: summaryStats.approvedByCao ?? 0,
      rejected: summaryStats.rejectedByCao ?? 0,
    }
  }

  return {
    ready: summaryStats.readyForVerificationToday ?? gatepasses.filter((item) => item.status === 'Approved').length,
    out: summaryStats.checkedOutToday ?? gatepasses.filter((item) => item.status === 'Out').length,
    returned: summaryStats.completedToday ?? gatepasses.filter((item) => item.status === 'Returned').length,
  }
}

function getSummaryCards(role, stats) {
  if (role === 'faculty') {
    if (stats.coordinatorEnabled) {
      return [
        { label: 'Faculty Requests', value: stats.total, icon: QrCode },
        { label: 'Coordinator Queue', value: stats.coordinatorPending, icon: Clock3, tone: 'warning' },
        { label: 'Approved', value: stats.approved, icon: CheckCircle2, tone: 'success' },
        { label: 'Rejected', value: stats.rejected, icon: XCircle, tone: 'danger' },
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
    ]
  }

  if (role === 'hod') {
    return [
      { label: 'Pending Review', value: stats.pending, icon: Clock3, tone: 'warning' },
      { label: 'Handled', value: stats.handled, icon: QrCode },
      { label: 'Approved', value: stats.approved, icon: CheckCircle2, tone: 'success' },
      { label: 'Rejected', value: stats.rejected, icon: XCircle, tone: 'danger' },
    ]
  }

  if (role === 'cao') {
    return [
      { label: 'Total', value: stats.total, icon: QrCode },
      { label: 'Pending Faculty', value: stats.pending, icon: Clock3, tone: 'warning' },
      { label: 'Approved', value: stats.approved, icon: CheckCircle2, tone: 'success' },
      { label: 'Rejected', value: stats.rejected, icon: XCircle, tone: 'danger' },
    ]
  }

  if (role === 'security') {
    return [
      { label: 'Ready for OUT', value: stats.ready, icon: ScanLine, tone: 'info' },
      { label: 'OUT', value: stats.out, icon: QrCode },
      { label: 'Returned', value: stats.returned, icon: CheckCircle2, tone: 'success' },
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

function getAvailableActions(role, gatepass, onGatepassAction) {
  function handleAction(action) {
    return async () => {
      await onGatepassAction(gatepass, action)
    }
  }

  if (gatepass.requestKind === 'faculty_leave') {
    if (role === 'security') {
      if (gatepass.status === 'Approved') {
        return [{ label: 'Mark Out', tone: 'security-out', onClick: handleAction('markOut') }]
      }

      if (gatepass.status === 'Out' && canSecurityMarkIn(gatepass)) {
        return [{ label: 'Mark Return', tone: 'secondary', onClick: handleAction('markIn') }]
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

  if (role === 'principal' && gatepass.status === 'Pending' && gatepass.stage === 'principal') {
    return [
      { label: 'Approve', tone: 'success', onClick: handleAction('approve') },
      { label: 'Reject', tone: 'danger', onClick: handleAction('reject') },
      { label: 'Send to HOD', tone: 'secondary', onClick: handleAction('forward') },
    ]
  }

  if (role === 'hod' && gatepass.status === 'Pending' && gatepass.stage === 'hod') {
    return [
      { label: 'Approve', tone: 'success', onClick: handleAction('approve') },
      { label: 'Reject', tone: 'danger', onClick: handleAction('reject') },
      { label: 'Send to Coordinator', tone: 'secondary', onClick: handleAction('sendToCoordinator') },
    ]
  }

  if (role === 'faculty' && gatepass.status === 'Pending' && gatepass.stage === 'coordinator') {
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

  if (role === 'security') {
    if (gatepass.status === 'Approved') {
      return [{ label: 'Mark Out', tone: 'security-out', onClick: handleAction('markOut') }]
    }
    if (gatepass.status === 'Out' && canSecurityMarkIn(gatepass)) {
      return [{ label: 'Mark Return', tone: 'secondary', onClick: handleAction('markIn') }]
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
      ? 'Faculty and coordinator review queue'
      : 'Leave application history'
  }
  if (user?.role === 'principal') return 'Principal review queue'
  if (user?.role === 'hod') return 'HOD review queue'
  if (user?.role === 'cao') return 'CAO review queue'
  if (user?.role === 'security') return 'Security verification queue'
  return 'Gatepass history'
}

export default App
