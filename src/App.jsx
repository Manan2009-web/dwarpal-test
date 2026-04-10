import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
// import logo from "../assets/DwarPal_logo.png";
import {
  Bell,
  CheckCircle2,
  Clock3,
  FingerprintPattern,
  QrCode,
  ScanFace,
  ScanLine,
  Send,
  ShieldCheck,
  UserPlus2,
  XCircle,
} from 'lucide-react'
import './App.css'
import AppBrand from './components/AppBrand'
import FacultyLeaveWizard from './components/FacultyLeaveWizard'
import FeatureBoundary from './components/FeatureBoundary'
import GatepassQrModal from './components/GatepassQrModal'
import NotificationCenterPanel from './components/NotificationCenterPanel'
import { NotificationProvider, useNotifications } from './components/NotificationProvider'
import NotificationPermissionPrompt, {
  NotificationPermissionCard,
} from './components/NotificationPermissionPrompt'
import PreferencesPanel from './components/PreferencesPanel'
import PrivacyPreferencesBanner from './components/PrivacyPreferencesBanner'
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
  GatepassCard,
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
  clearStoredAuthToken,
  createBiometricAuthenticationOptions,
  createBiometricRegistrationOptions,
  fetchWorkspace,
  getBiometricDevices,
  getApiErrorDetails,
  hasStoredAuthToken,
  loginUser,
  logoutUser,
  readBiometricDeviceId,
  registerUser,
  removeBiometricDevice,
  submitRequest,
  updateRequestStatus,
  verifyBiometricAuthentication,
  verifyBiometricRegistration,
  verifyGatepassQr,
  verifyGatepassById,
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

const DASHBOARD_REFRESH_MS = 10000
const REFRESH_ERROR_TOAST_COOLDOWN_MS = 30000
const VEHICLE_NUMBER_PATTERN = /^[A-Za-z0-9 -]+$/
const REQUIRED_FIELD_MESSAGE = 'Please fill this field'
const REASON_MIN_LENGTH = 5
const REASON_MAX_LENGTH = 500
const APP_PAGES = new Set(['dashboard', 'notifications', 'profile'])

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
  const [summary, setSummary] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [cookieConsent, setCookieConsent] = useState(() => readCookieConsent())
  const [cookieBannerForcedOpen, setCookieBannerForcedOpen] = useState(false)
  const [notificationPermissionState, setNotificationPermissionState] = useState(() =>
    getResolvedNotificationPermissionState(),
  )
  const [notificationPromptOpen, setNotificationPromptOpen] = useState(false)
  const refreshRequestRef = useRef(0)
  const lastRefreshErrorToastAtRef = useRef(0)

  const resetWorkspace = useCallback(() => {
    setGatepasses([])
    setSummary(null)
  }, [])

  const clearSession = useCallback(() => {
    clearStoredAuthToken()
    setCurrentUser(null)
    refreshRequestRef.current += 1
    resetWorkspace()
  }, [resetWorkspace])

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
          message: 'DwarPal can now use browser notifications for future workflow updates on this device.',
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
        message: 'No browser notification permission was granted yet. You can try again later.',
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

      if (error instanceof ApiError) {
        if (error.status === 0) {
          return {
            ...errorDetails,
            fieldErrors: {},
            message: 'Unable to reach the DwarPal backend. Please start the backend server and try again.',
          }
        }

        if (error.status === 401) {
          if (authMode === 'login') {
            return {
              ...errorDetails,
              fieldErrors: {},
              message: 'Invalid credentials. Please check your ID and password.',
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
    async (role, signal) => {
      if (!role) return

      const requestId = ++refreshRequestRef.current
      const workspace = await fetchWorkspace(role, signal)

      if (signal?.aborted || requestId !== refreshRequestRef.current) {
        return
      }

      setSummary(workspace.summary)
      setGatepasses(workspace.gatepasses)
    },
    [],
  )

  const refreshAppData = useCallback(
    async (signal) => {
      if (!currentUser?.role) return

      try {
        await loadWorkspace(currentUser.role, signal)
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
      }
    },
    [currentUser?.role, loadWorkspace, resolveApiError, toast],
  )

  useEffect(() => {
    let ignore = false
    const controller = new AbortController()

    async function restoreSession() {
      if (!hasStoredAuthToken()) {
        if (!ignore) {
          setAuthReady(true)
        }
        return
      }

      try {
        const restoredUser = await verifySession(controller.signal)

        if (!ignore && restoredUser) {
          setCurrentUser(restoredUser)
        }
      } catch (error) {
        if (!ignore && error instanceof ApiError && error.status === 401) {
          clearSession()
        }
      } finally {
        if (!ignore) {
          setAuthReady(true)
        }
      }
    }

    restoreSession()

    return () => {
      ignore = true
      controller.abort()
    }
  }, [clearSession])

  useEffect(() => {
    if (!currentUser?.role) {
      refreshRequestRef.current += 1
      resetWorkspace()
      return undefined
    }

    const controller = new AbortController()
    refreshAppData(controller.signal)

    return () => controller.abort()
  }, [currentUser?.id, currentUser?.role, refreshAppData, resetWorkspace])

  async function login(identifier, password) {
    try {
      const user = await loginUser(identifier, password)
      setCurrentUser(user)
      toast.success({
        title: 'Login successful',
        message: `Welcome back to DwarPal, ${user.name}.`,
      })
      return { ok: true, user }
    } catch (error) {
      const { message } = resolveApiError(error, {
        fallbackMessage: 'Unable to sign in. Please try again.',
        authMode: 'login',
      })
      toast.error({
        title: 'Login failed',
        message,
      })

      return {
        ok: false,
        error: message,
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
      return { ok: true, user }
    } catch (error) {
      if (error instanceof ApiError) {
        const { message } = resolveApiError(error, {
          fallbackMessage: 'Biometric verification failed. Please try again or use manual login.',
          authMode: 'login',
        })
        toast.error({
          title: 'Biometric login failed',
          message,
        })

        return {
          ok: false,
          error: message,
        }
      }

      return {
        ok: false,
        error: getBiometricErrorMessage(error, mode === 'setup' ? 'setup' : 'login'),
      }
    }
  }

  async function register(payload) {
    const normalizedRole = normalizeRole(payload.role)
    const normalizedProgram = normalizeProgram(payload.program)
    const normalizedDepartment = normalizeDepartment(payload.department)
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

    try {
      const result = await registerUser({
        ...payload,
        role: normalizedRole,
        program: requiresProgram ? normalizedProgram : '',
        department: requiresDepartment ? normalizedDepartment : '',
      })
      const successMessage = 'Account created successfully'

      toast.success({
        title: successMessage,
        message: 'Redirecting you to the login page.',
      })

      return {
        ok: true,
        message: successMessage,
      }
    } catch (error) {
      const { message, fieldErrors } = resolveApiError(error, {
        fallbackMessage: 'Unable to create your account right now.',
      })
      toast.error({
        title: 'Registration failed',
        message,
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

      await submitRequest(requestPayload)
      await refreshAppData()
      toast.success({
        title: currentUser.role === 'faculty' ? 'Leave request created' : 'Gatepass created',
        message:
          currentUser.role === 'faculty'
            ? 'Your leave request was submitted successfully.'
            : 'Your gatepass request was submitted successfully.',
      })
      return { ok: true }
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
      await updateRequestStatus(request, action, requestBody)
      await refreshAppData()
      const toastMeta = getActionToastMeta(request, action)
      toast[toastMeta.tone]?.({
        title: toastMeta.title,
        message: toastMeta.message,
      })
      return { ok: true }
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
              <LoginScreen onBiometricLogin={loginWithBiometric} onLogin={login} />
            </PublicAuthRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicAuthRoute currentUser={currentUser} authReady={authReady}>
              <RegisterScreen onRegister={register} />
            </PublicAuthRoute>
          }
        />
        <Route
          path="/app/:page"
          element={
            <ProtectedRoute currentUser={currentUser} authReady={authReady}>
              <NotificationProvider currentUser={currentUser}>
                <AppShell
                  currentUser={currentUser}
                  summary={summary}
                  gatepasses={gatepasses}
                  onLogout={logout}
                  onAddGatepass={addGatepass}
                  onCurrentUserPatch={patchCurrentUser}
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
                />
              </NotificationProvider>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<DefaultRoute currentUser={currentUser} authReady={authReady} />} />
      </Routes>
      <FeatureBoundary label="Privacy preferences banner">
        <PrivacyPreferencesBanner
          open={!cookieConsent || cookieBannerForcedOpen}
          onAccept={() => handleCookiePreferenceChange('accepted')}
          onReject={() => handleCookiePreferenceChange('rejected')}
        />
      </FeatureBoundary>
    </BrowserRouter>
  )
}

function ProtectedRoute({ currentUser, authReady, children }) {
  // Protected route logic: every authenticated screen verifies auth on render and replaces history on failure.
  if (!authReady) return <AuthBootstrapScreen />
  if (!currentUser) return <Navigate to="/login" replace />
  return children
}

function PublicAuthRoute({ currentUser, authReady, children }) {
  // Login redirect protection: authenticated users are pushed away from public auth screens with replace
  // so the browser back button cannot reopen login/register as an active page.
  if (!authReady) return <AuthBootstrapScreen />
  if (currentUser) return <Navigate to="/app/dashboard" replace />
  return children
}

function DefaultRoute({ currentUser, authReady }) {
  if (!authReady) return <AuthBootstrapScreen />
  return <Navigate to={currentUser ? '/app/dashboard' : '/login'} replace />
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

const BIOMETRIC_MODE_META = {
  fingerprint: {
    icon: FingerprintPattern,
    label: 'Fingerprint login',
  },
  face: {
    icon: ScanFace,
    label: 'Face recognition login',
  },
}

function BiometricSymbolButton({ mode, active, loading, onClick }) {
  const { icon: Icon, label } = BIOMETRIC_MODE_META[mode]

  return (
    <button
      type="button"
      className={`biometric-symbol-button${loading ? ' loading' : ''}`}
      onClick={onClick}
      disabled={!active || loading}
      aria-label={label}
      title={label}
      aria-busy={loading}
    >
      <Icon size={24} strokeWidth={1.85} />
      <span className="sr-only">{label}</span>
    </button>
  )
}

function LoginScreen({ onLogin, onBiometricLogin }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ identifier: '', password: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [biometricSupport, setBiometricSupport] = useState({
    supported: false,
    message: '',
    platformAuthenticatorAvailable: false,
    modes: {
      fingerprint: { supported: false },
      face: { supported: false },
    },
  })
  const [biometricLoadingMode, setBiometricLoadingMode] = useState('')

  useEffect(() => {
    let ignore = false

    async function loadBiometricSupport() {
      const supportState = await detectBiometricSupport()

      if (!ignore) {
        setBiometricSupport(supportState)
      }
    }

    loadBiometricSupport()

    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    const authNotice = location.state?.authNotice

    if (!authNotice) {
      return
    }

    setSuccess(authNotice)
    navigate(location.pathname, { replace: true, state: null })
  }, [location.pathname, location.state, navigate])

  function updateFormField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setFieldErrors((prev) => clearFieldError(prev, field))
    setError('')
    setSuccess('')
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (isSubmitting) {
      return
    }

    const nextFieldErrors = getRequiredFieldErrors({
      identifier: form.identifier,
      password: form.password,
    })

    if (Object.keys(nextFieldErrors).length) {
      setFieldErrors(nextFieldErrors)
      setError('')
      return
    }

    setError('')
    setSuccess('')
    setIsSubmitting(true)

    try {
      const result = await onLogin(form.identifier, form.password)
      if (!result?.ok) {
        setError(result?.error || 'Unable to sign in. Please try again.')
        return
      }

      setSuccess('Login successful. Redirecting to your dashboard...')
      // Use replace so the previous login entry is not left as a reachable back-navigation target.
      navigate('/app/dashboard', { replace: true })
    } catch {
      setError('Unable to sign in right now. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleBiometricLogin(mode) {
    if (isSubmitting) {
      return
    }

    if (!biometricSupport.modes?.[mode]?.supported) {
      setError(
        mode === 'face' ? 'Face recognition is not available on this device.' : 'Fingerprint login is not available on this device.',
      )
      return
    }

    if (!form.identifier.trim()) {
      setFieldErrors((prev) => ({
        ...prev,
        identifier: 'Enter your enrollment number, employee ID, or email before using biometric login.',
      }))
      setError('')
      return
    }

    setBiometricLoadingMode(mode)
    setSuccess('')

    try {
      const result = await onBiometricLogin(form.identifier.trim(), mode)

      if (!result?.ok) {
        setError(result?.error || 'Biometric verification failed. Please try again or use manual login.')
        return
      }

      setSuccess('Login successful. Redirecting to your dashboard...')
      navigate('/app/dashboard', { replace: true })
    } catch {
      setError('Biometric verification failed. Please try again or use manual login.')
    } finally {
      setBiometricLoadingMode('')
    }
  }

  const biometricUnsupportedMessage =
    biometricSupport.message || 'Biometric login is not available on this device.'
  const fingerprintSupported = Boolean(biometricSupport.modes?.fingerprint?.supported)
  const faceSupported = Boolean(biometricSupport.modes?.face?.supported)

  return (
    <AuthShell title="Login">
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <label>
          <FieldLabel required>Enrollment / ID</FieldLabel>
          <input
            value={form.identifier}
            onChange={(event) => updateFormField('identifier', event.target.value)}
            placeholder="Enter your enrollment number, employee ID, or email address"
            autoComplete="username"
            className={fieldErrors.identifier ? 'field-invalid' : ''}
            aria-invalid={Boolean(fieldErrors.identifier)}
            disabled={isSubmitting}
            required
          />
          {fieldErrors.identifier ? <p className="field-error">{fieldErrors.identifier}</p> : null}
        </label>
        <label>
          <FieldLabel required>Password</FieldLabel>
          <input
            type="password"
            value={form.password}
            onChange={(event) => updateFormField('password', event.target.value)}
            placeholder="Enter your password"
            autoComplete="current-password"
            className={fieldErrors.password ? 'field-invalid' : ''}
            aria-invalid={Boolean(fieldErrors.password)}
            disabled={isSubmitting}
            required
          />
          {fieldErrors.password ? <p className="field-error">{fieldErrors.password}</p> : null}
        </label>
        {error ? <p className="form-error" aria-live="polite">{error}</p> : null}
        {success ? <p className="form-success" aria-live="polite">{success}</p> : null}
        {isSubmitting ? <p className="field-hint" aria-live="polite">Signing in...</p> : null}
        <ActionButton icon={ShieldCheck} type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
          {isSubmitting ? 'Signing in...' : 'Sign In'}
        </ActionButton>
      </form>
      <div className="auth-divider" aria-hidden="true">
        <span>OR</span>
      </div>
      <section className="auth-biometric-panel" aria-label="Biometric login">
        <div className="auth-biometric-actions">
          <BiometricSymbolButton
            mode="fingerprint"
            active={fingerprintSupported && !biometricLoadingMode && !isSubmitting}
            loading={biometricLoadingMode === 'fingerprint'}
            onClick={() => handleBiometricLogin('fingerprint')}
          />
          <BiometricSymbolButton
            mode="face"
            active={faceSupported && !biometricLoadingMode && !isSubmitting}
            loading={biometricLoadingMode === 'face'}
            onClick={() => handleBiometricLogin('face')}
          />
        </div>
        {!fingerprintSupported || !faceSupported ? <p className="field-hint auth-biometric-status">{biometricUnsupportedMessage}</p> : null}
      </section>
      <p className="auth-nav">
        Don&apos;t have an account?{' '}
        <Link to="/register" replace className="auth-link">
          Register
        </Link>
      </p>
    </AuthShell>
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
  })
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
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

  async function handleSubmit(event) {
    event.preventDefault()

    if (isSubmitting) {
      return
    }

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

    if (Object.keys(nextFieldErrors).length) {
      setFieldErrors(nextFieldErrors)
      setError('')
      return
    }

    setError('')
    setIsSubmitting(true)

    try {
      const result = await onRegister(form)
      if (!result?.ok) {
        if (result?.fieldErrors) {
          setFieldErrors((prev) => ({
            ...prev,
            ...mapRegisterFieldErrors(result.fieldErrors, form.role),
          }))
        }

        setError(result?.error || 'Unable to create your account. Please review the form and try again.')
        return
      }

      navigate('/login', {
        replace: true,
        state: {
          authNotice: result?.message || 'Account created successfully',
        },
      })
    } catch {
      setError('Unable to create your account right now. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthShell title="Register">
      <form className="auth-form register-grid" onSubmit={handleSubmit} noValidate>
        <label>
          <FieldLabel required>Full Name</FieldLabel>
          <input
            value={form.name}
            onChange={(event) => updateFormField('name', event.target.value)}
            placeholder="Enter your full name"
            autoComplete="name"
            className={fieldErrors.name ? 'field-invalid' : ''}
            aria-invalid={Boolean(fieldErrors.name)}
            disabled={isSubmitting}
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
            disabled={isSubmitting}
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
            disabled={isSubmitting}
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
              disabled={isSubmitting}
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
              disabled={isSubmitting}
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
            disabled={isSubmitting}
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
            disabled={isSubmitting}
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
              disabled={isSubmitting}
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
          <input
            type="password"
            value={form.password}
            onChange={(event) => updateFormField('password', event.target.value)}
            placeholder="Enter your password"
            autoComplete="new-password"
            className={fieldErrors.password ? 'field-invalid' : ''}
            aria-invalid={Boolean(fieldErrors.password)}
            disabled={isSubmitting}
            required
          />
          {fieldErrors.password ? <p className="field-error">{fieldErrors.password}</p> : null}
        </label>
        {error ? <p className="form-error full-span" aria-live="polite">{error}</p> : null}
        {isSubmitting ? <p className="field-hint full-span" aria-live="polite">Creating account...</p> : null}
        <div className="full-span">
          <ActionButton icon={UserPlus2} type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
            {isSubmitting ? 'Creating account...' : 'Create Account'}
          </ActionButton>
        </div>
      </form>
      <p className="auth-nav">
        Already have an account?{' '}
        <Link to="/login" replace className="auth-link">
          Login
        </Link>
      </p>
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

function AppShell({
  currentUser,
  summary,
  gatepasses,
  onCurrentUserPatch,
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
  const currentPage = APP_PAGES.has(requestedPage) ? requestedPage : 'dashboard'
  const focusReference = useMemo(
    () => new URLSearchParams(location.search).get('focus')?.trim().toUpperCase() || '',
    [location.search],
  )
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [modalOpen, setModalOpen] = useState(false)
  const [rejectRequest, setRejectRequest] = useState(null)
  const [navOpen, setNavOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [qrPreviewGatepass, setQrPreviewGatepass] = useState(null)
  const notificationWrapperRef = useRef(null)
  const hasOpenModal =
    modalOpen || Boolean(rejectRequest) || Boolean(qrPreviewGatepass) || notificationPromptOpen

  useEffect(() => {
    if (hasOpenModal) return undefined

    // Dashboard auto-refresh: pull the latest backend queue every 10 seconds.
    const intervalId = window.setInterval(() => {
      onRefreshData()
    }, DASHBOARD_REFRESH_MS)

    return () => window.clearInterval(intervalId)
  }, [hasOpenModal, onRefreshData])

  useEffect(() => {
    if (requestedPage === currentPage) {
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

  const scopedGatepasses = useMemo(() => getRoleScopedGatepasses(currentUser, gatepasses), [currentUser, gatepasses])

  const filteredGatepasses = useMemo(
    () => {
      const matchingGatepasses = scopedGatepasses.filter((gatepass) => {
        const matchesStatus = statusFilter === 'All' || gatepass.status === statusFilter
        const haystack = [
          gatepass.id,
          gatepass.name,
          gatepass.enrollment,
          gatepass.program,
          gatepass.department,
          gatepass.status,
          gatepass.reason,
          gatepass.leaveType,
          gatepass.workloadStage,
          gatepass.shortLeaveStage,
          gatepass.instituteName,
          gatepass.vehicleNumber,
        ]
          .join(' ')
          .toLowerCase()
        const matchesSearch = haystack.includes(searchTerm.trim().toLowerCase())
        return matchesStatus && matchesSearch
      })

      if (!focusReference) {
        return matchingGatepasses
      }

      const focusedGatepass = scopedGatepasses.find((gatepass) => matchesGatepassReference(gatepass, focusReference))

      if (!focusedGatepass || matchingGatepasses.some((gatepass) => gatepass.id === focusedGatepass.id)) {
        return matchingGatepasses
      }

      return [focusedGatepass, ...matchingGatepasses]
    },
    [focusReference, scopedGatepasses, searchTerm, statusFilter],
  )

  const stats = getRoleStats(currentUser, summary, scopedGatepasses)

  function handleNavigate(page) {
    setNavOpen(false)
    setNotificationsOpen(false)
    setQrPreviewGatepass(null)
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
              searchTerm={searchTerm}
              onSearchTermChange={setSearchTerm}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
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
  searchTerm,
  onSearchTermChange,
  statusFilter,
  onStatusFilterChange,
  onOpenModal,
  onGatepassAction,
  focusReference,
  onOpenQrPreview,
}) {
  const isRequester = currentUser.role === 'student' || currentUser.role === 'faculty'
  const summaryCards = getSummaryCards(currentUser.role, stats)
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

  return (
    <div className="page-stack">
      <section className="hero-strip">
        <div>
          <h2>
            {currentUser.name} <span>{currentUser.enrollment || currentUser.employeeId}</span>
          </h2>
        </div>
        {isRequester ? (
          <ActionButton icon={Send} onClick={onOpenModal}>
            + New Gatepass
          </ActionButton>
        ) : null}
      </section>

      <section className="summary-grid">
        {summaryCards.map((card) => (
          <SummaryCard key={card.label} {...card} />
        ))}
      </section>

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
            <h3>{getListTitle(currentUser.role)}</h3>
          </div>
        </div>

        {gatepassCards.length ? (
          <div className="gatepass-grid">
            {gatepassCards.map(({ gatepass, actions, highlighted }) => (
              <GatepassCard
                key={gatepass.id}
                gatepass={gatepass}
                currentUserRole={currentUser.role}
                actions={actions}
                highlighted={highlighted}
                onOpenQrPreview={isRequester ? onOpenQrPreview : undefined}
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
      </section>
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
          <ReadOnlyField label={currentUser.enrollment ? 'Enrollment' : 'Employee ID'} value={currentUser.enrollment || currentUser.employeeId} />
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

function ReadOnlyField({ label, value }) {
  return <IdentityField className="read-only-field" label={label} value={value} />
}

function getRoleScopedGatepasses(currentUser, gatepasses) {
  if (!currentUser) return []
  return Array.isArray(gatepasses) ? gatepasses : []
}

function getRoleStats(currentUser, summary, gatepasses) {
  const summaryStats = summary?.stats || {}

  if (currentUser.role === 'student' || currentUser.role === 'faculty') {
    return {
      total: summaryStats.totalRequests ?? summaryStats.totalPasses ?? gatepasses.length,
      approved: summaryStats.approved ?? gatepasses.filter((item) => item.status === 'Approved').length,
      rejected: summaryStats.rejected ?? gatepasses.filter((item) => item.status === 'Rejected').length,
      pending: summaryStats.pending ?? gatepasses.filter((item) => item.status === 'Pending').length,
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

function getAvailableActions(role, gatepass, onGatepassAction) {
  function handleAction(action) {
    return async () => {
      await onGatepassAction(gatepass, action)
    }
  }

  if (gatepass.requestKind === 'faculty_leave') {
    if (role === 'security') {
      if (gatepass.status === 'Approved') {
        return [{ label: 'Mark OUT', tone: 'security-out', onClick: handleAction('markOut') }]
      }

      if (gatepass.status === 'Out') {
        return [{ label: 'Mark Returned', tone: 'secondary', onClick: handleAction('markIn') }]
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

  if ((role === 'hod' || role === 'cao') && gatepass.status === 'Pending') {
    return [
      { label: 'Approve', tone: 'success', onClick: handleAction('approve') },
      { label: 'Reject', tone: 'danger', onClick: handleAction('reject') },
    ]
  }

  if (role === 'security') {
    if (gatepass.status === 'Approved') {
      return [{ label: 'Mark OUT', tone: 'security-out', onClick: handleAction('markOut') }]
    }
    if (gatepass.status === 'Out') {
      return [{ label: 'Mark IN', tone: 'secondary', onClick: handleAction('markIn') }]
    }
  }

  return []
}

function getPageTitle(user, page) {
  if (page === 'profile') return 'Profile'
  if (page === 'notifications') return 'Notifications'
  return ROLE_META[user.role].panelTitle
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
  if (user.role === 'student') return 'Track your gatepasses.'
  if (user.role === 'faculty') return 'Track your leave applications.'
  return 'Review assigned requests.'
}

function getListTitle(role) {
  if (role === 'faculty') return 'Leave application history'
  if (role === 'principal') return 'Principal review queue'
  if (role === 'hod') return 'HOD review queue'
  if (role === 'cao') return 'CAO review queue'
  if (role === 'security') return 'Security verification queue'
  return 'Gatepass history'
}

export default App
