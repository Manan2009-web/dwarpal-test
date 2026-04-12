import { normalizeDepartment, normalizeProgram, normalizeRole } from '../mockData'

function normalizeApiBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '')
}

const API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL) || '/api'

export const AUTH_TOKEN_KEY = 'dwarpal-auth-token'
export const AUTH_USER_KEY = 'dwarpal-auth-user'
export const BIOMETRIC_DEVICE_KEY = 'dwarpal-biometric-device-id'
const DEFAULT_PHONE_COUNTRY_CODE = '+91'
const DEFAULT_API_TIMEOUT_MS = Number(import.meta.env.VITE_API_REQUEST_TIMEOUT_MS) || 15000
const DEFAULT_AUTH_TIMEOUT_MS = Number(import.meta.env.VITE_AUTH_REQUEST_TIMEOUT_MS) || 25000
const DEFAULT_REGISTER_SEND_TIMEOUT_MS =
  Number(import.meta.env.VITE_REGISTER_SEND_TIMEOUT_MS) || Math.max(DEFAULT_AUTH_TIMEOUT_MS, 35000)
const DEFAULT_BACKEND_WARMUP_TIMEOUT_MS = Number(import.meta.env.VITE_BACKEND_WARMUP_TIMEOUT_MS) || 8000
const BACKEND_WARMUP_CACHE_MS = 2 * 60 * 1000
let lastBackendWarmupAt = 0

const APPROVED_GATEPASS_STATUSES = new Set([
  'approved_final',
  'approved_by_hod',
  'approved_by_coordinator',
  'approved_by_cao',
])
const REJECTED_GATEPASS_STATUSES = new Set([
  'rejected_by_principal',
  'rejected_by_hod',
  'rejected_by_coordinator',
  'rejected_by_cao',
])
const PENDING_GATEPASS_STATUSES = new Set([
  'pending_principal',
  'forwarded_to_hod',
  'forwarded_to_coordinator',
  'pending_cao',
])
const GENERIC_API_MESSAGES = new Set(['Validation error', 'Please review the highlighted fields.', 'Request failed.'])
const DEFAULT_AUTH_SESSION_TIMEOUT_MS = 5000

class ApiError extends Error {
  constructor(message, status = 500, payload = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.payload = payload
  }
}

function shouldLogAuthRequest(path = '') {
  return path === '/auth/login' || path === '/auth/register'
}

function sanitizeAuthDebugBody(body) {
  if (!body || typeof body !== 'object' || body instanceof FormData) {
    return body ?? null
  }

  const sanitizedBody = { ...body }

  if ('password' in sanitizedBody) {
    sanitizedBody.password = '[redacted]'
  }

  return sanitizedBody
}

function logAuthDebug(message, details) {
  console.info(`[dwarpal-auth-api] ${message}`, details)
}

function createRequestSignal(signal, timeoutMs) {
  const hasTimeout = Number.isFinite(timeoutMs) && timeoutMs > 0

  if (!signal && !hasTimeout) {
    return {
      signal: undefined,
      cleanup() {},
      didTimeout() {
        return false
      },
    }
  }

  const controller = new AbortController()
  let timeoutId = null
  let timedOut = false

  const abortFromSignal = () => {
    if (!controller.signal.aborted) {
      controller.abort(signal?.reason)
    }
  }

  if (signal) {
    if (signal.aborted) {
      abortFromSignal()
    } else {
      signal.addEventListener('abort', abortFromSignal, { once: true })
    }
  }

  if (hasTimeout) {
    timeoutId = setTimeout(() => {
      timedOut = true

      if (!controller.signal.aborted) {
        controller.abort(new DOMException('The request timed out.', 'TimeoutError'))
      }
    }, timeoutMs)
  }

  return {
    signal: controller.signal,
    cleanup() {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }

      if (signal) {
        signal.removeEventListener('abort', abortFromSignal)
      }
    },
    didTimeout() {
      return timedOut
    },
  }
}

function readAuthToken() {
  if (typeof window === 'undefined') return ''

  try {
    const sessionToken = window.sessionStorage.getItem(AUTH_TOKEN_KEY) || ''
    if (sessionToken) {
      return sessionToken
    }
  } catch {
    // Ignore storage read failures and fall back to localStorage.
  }

  try {
    return window.localStorage.getItem(AUTH_TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

export function getStoredAuthToken() {
  return readAuthToken()
}

export function getRealtimeBaseUrl() {
  if (typeof window === 'undefined') {
    return ''
  }

  try {
    const url = new URL(API_BASE_URL, window.location.origin)
    return url.origin
  } catch {
    return window.location.origin
  }
}

function buildHeaders(customHeaders = {}) {
  const headers = new Headers(customHeaders)
  const token = readAuthToken()

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  return headers
}

export function storeAuthToken(token) {
  if (typeof window === 'undefined' || !token) return

  try {
    window.localStorage.setItem(AUTH_TOKEN_KEY, token)
    window.sessionStorage.setItem(AUTH_TOKEN_KEY, token)
  } catch {
    // Ignore storage write failures so login errors remain recoverable in the UI.
  }
}

export function storeAuthUser(user) {
  if (typeof window === 'undefined') return

  if (!user) {
    clearStoredAuthUser()
    return
  }

  try {
    const serializedUser = JSON.stringify(user)
    window.localStorage.setItem(AUTH_USER_KEY, serializedUser)
    window.sessionStorage.setItem(AUTH_USER_KEY, serializedUser)
  } catch {
    // Ignore storage write failures so login errors remain recoverable in the UI.
  }
}

export function clearStoredAuthToken() {
  if (typeof window === 'undefined') return

  try {
    window.sessionStorage.removeItem(AUTH_TOKEN_KEY)
    window.localStorage.removeItem(AUTH_TOKEN_KEY)
  } catch {
    // Ignore storage cleanup failures.
  }

  clearStoredAuthUser()
}

export function clearStoredAuthUser() {
  if (typeof window === 'undefined') return

  try {
    window.sessionStorage.removeItem(AUTH_USER_KEY)
    window.localStorage.removeItem(AUTH_USER_KEY)
  } catch {
    // Ignore storage cleanup failures.
  }
}

export function hasStoredAuthToken() {
  if (typeof window === 'undefined') return false

  return Boolean(readAuthToken())
}

export function storeBiometricDeviceId(deviceId) {
  if (typeof window === 'undefined') return

  try {
    if (!deviceId) {
      window.localStorage.removeItem(BIOMETRIC_DEVICE_KEY)
      return
    }

    window.localStorage.setItem(BIOMETRIC_DEVICE_KEY, String(deviceId))
  } catch {
    // Ignore storage write failures so biometric flows still surface API errors cleanly.
  }
}

export function readBiometricDeviceId() {
  if (typeof window === 'undefined') return ''

  try {
    return window.localStorage.getItem(BIOMETRIC_DEVICE_KEY) || ''
  } catch {
    return ''
  }
}

export function clearBiometricDeviceId() {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.removeItem(BIOMETRIC_DEVICE_KEY)
  } catch {
    // Ignore storage cleanup failures.
  }
}

function getDefaultErrorMessage(status, path) {
  if (status === 401 && path === '/auth/login') {
    return 'Invalid credentials. Please check your email or ID and password.'
  }

  if (status === 404) {
    return 'The requested DwarPal API route was not found.'
  }

  if (status >= 500) {
    return 'Server error. Please check the backend logs and try again.'
  }

  if (status === 403) {
    return 'You do not have permission to perform this action.'
  }

  if (status === 429) {
    return 'Too many requests. Please wait a moment and try again.'
  }

  if (status === 408) {
    return 'The request timed out. The backend may still be waking up. Please try again.'
  }

  return 'Request failed.'
}

function buildApiErrorPayload(payload, extras = {}) {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return {
      ...payload,
      ...extras,
    }
  }

  return extras
}

async function parseApiResponse(response) {
  const contentType = String(response.headers.get('content-type') || '').toLowerCase()

  if (response.status === 204) {
    return {
      contentType,
      payload: null,
      rawText: '',
    }
  }

  const rawText = await response.text()

  if (!rawText) {
    return {
      contentType,
      payload: null,
      rawText: '',
    }
  }

  if (contentType.includes('application/json')) {
    try {
      return {
        contentType,
        payload: JSON.parse(rawText),
        rawText,
      }
    } catch {
      return {
        contentType,
        payload: null,
        rawText,
      }
    }
  }

  try {
    return {
      contentType,
      payload: JSON.parse(rawText),
      rawText,
    }
  } catch {
    return {
      contentType,
      payload: null,
      rawText,
    }
  }
}

export function getApiErrorDetails(error, fallbackMessage = 'Request failed.') {
  const normalizedErrors = Array.isArray(error?.payload?.errors)
    ? error.payload.errors.reduce((errors, item) => {
        const field = item?.field || item?.path || item?.param || ''
        const message = item?.message || item?.msg || ''

        if (field && message && !errors.some((entry) => entry.field === field)) {
          errors.push({ field, message })
        }

        return errors
      }, [])
    : []

  const fieldErrors = normalizedErrors.reduce((errors, item) => {
    if (!errors[item.field]) {
      errors[item.field] = item.message
    }

    return errors
  }, {})

  const resolvedMessage =
    error?.message && !GENERIC_API_MESSAGES.has(error.message)
      ? error.message
      : normalizedErrors[0]?.message || fallbackMessage

  return {
    code: error?.payload?.code || '',
    errors: normalizedErrors,
    fieldErrors,
    message: resolvedMessage || fallbackMessage,
    payload: error?.payload || null,
    status: typeof error?.status === 'number' ? error.status : 500,
  }
}

export function normalizePhoneNumberInput(value, defaultCountryCode = DEFAULT_PHONE_COUNTRY_CODE) {
  let sanitizedValue = String(value || '')
    .trim()
    .replace(/[\s().-]/g, '')

  if (!sanitizedValue) {
    return ''
  }

  if (sanitizedValue.startsWith('00')) {
    sanitizedValue = `+${sanitizedValue.slice(2)}`
  }

  if (sanitizedValue.startsWith('+')) {
    const normalizedInternational = `+${sanitizedValue.slice(1).replace(/\D/g, '')}`
    return /^\+[1-9]\d{9,14}$/.test(normalizedInternational) ? normalizedInternational : ''
  }

  const digitsOnly = sanitizedValue.replace(/\D/g, '')
  if (!digitsOnly) {
    return ''
  }

  const normalizedValue =
    digitsOnly.length === 10
      ? `${String(defaultCountryCode || DEFAULT_PHONE_COUNTRY_CODE).trim()}${digitsOnly}`
      : `+${digitsOnly}`

  return /^\+[1-9]\d{9,14}$/.test(normalizedValue) ? normalizedValue : ''
}

export function isValidPhoneNumberInput(value, defaultCountryCode = DEFAULT_PHONE_COUNTRY_CODE) {
  return Boolean(normalizePhoneNumberInput(value, defaultCountryCode))
}

function buildRegistrationIdentityPayload(payload = {}) {
  const normalizedRole = normalizeRole(payload.role)
  const isStudent = normalizedRole === 'student'
  const requiresProgram = isStudent || normalizedRole === 'hod'
  const cleanedId = String(payload.enrollment || payload.enrollmentNo || payload.employeeId || '')
    .trim()

  return {
    fullName: String(payload.name || payload.fullName || '').trim(),
    email: String(payload.email || '').trim().toLowerCase(),
    phone: normalizePhoneNumberInput(payload.phone),
    role: normalizedRole,
    ...(requiresProgram ? { program: payload.program } : {}),
    ...(normalizedRole && normalizedRole !== 'security' ? { department: payload.department } : {}),
    ...(isStudent
      ? {
          semester: Number(payload.semester),
          enrollmentNo: cleanedId,
        }
      : normalizedRole
        ? {
            employeeId: cleanedId.toUpperCase(),
          }
        : {}),
  }
}

export async function apiRequest(path, { method = 'GET', body, headers, signal, timeoutMs } = {}) {
  const requestHeaders = buildHeaders(headers)
  const requestUrl = `${API_BASE_URL}${path}`
  const resolvedTimeoutMs = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_API_TIMEOUT_MS
  const requestController = createRequestSignal(signal, resolvedTimeoutMs)
  const isAuthRequest = shouldLogAuthRequest(path)
  const requestInit = {
    method,
    headers: requestHeaders,
    credentials: 'include',
    signal: requestController.signal,
  }

  if (body !== undefined) {
    if (body instanceof FormData) {
      requestInit.body = body
    } else {
      requestHeaders.set('Content-Type', 'application/json')
      requestInit.body = JSON.stringify(body)
    }
  }

  if (isAuthRequest) {
    logAuthDebug('request start', {
      body: sanitizeAuthDebugBody(body),
      method,
      path,
      requestUrl,
    })
  }

  let response = null
  let payload = null
  let responsePreview = ''
  let contentType = ''

  try {
    response = await fetch(requestUrl, requestInit)
    const parsedResponse = await parseApiResponse(response)
    payload = parsedResponse.payload
    responsePreview = parsedResponse.rawText.slice(0, 240)
    contentType = parsedResponse.contentType
  } catch (error) {
    if (isAuthRequest) {
      console.error('[dwarpal-auth-api] request error', {
        error,
        method,
        path,
        requestUrl,
      })
    }

    if (requestController.didTimeout()) {
      const seconds = Math.ceil(resolvedTimeoutMs / 1000)
      throw new ApiError(
        `The DwarPal backend did not respond within ${seconds} seconds.`,
        408,
        { code: 'REQUEST_TIMEOUT', path, requestUrl },
      )
    }

    if (signal?.aborted || error?.name === 'AbortError') {
      throw error
    }

    if (!response) {
      if (import.meta.env.DEV) {
        console.error('DwarPal API network error', { requestUrl, method, error })
      }

      throw new ApiError(
        `Unable to reach the DwarPal backend at ${API_BASE_URL}. Please start the backend server and try again.`,
        0,
        {
          code: 'NETWORK_ERROR',
          cause: error?.message || String(error || ''),
          path,
          requestUrl,
        },
      )
    }

    payload = null
  } finally {
    requestController.cleanup()
  }

  if (!response.ok || payload?.success === false) {
    if (isAuthRequest) {
      console.error('[dwarpal-auth-api] response error', {
        message: payload?.message || getDefaultErrorMessage(response.status, path),
        method,
        path,
        payload,
        requestUrl,
        status: response.status,
      })
    }

    if (import.meta.env.DEV) {
      console.error('DwarPal API request failed', {
        requestUrl,
        method,
        status: response.status,
        payload,
      })
    }

    throw new ApiError(
      payload?.message || getDefaultErrorMessage(response.status, path),
      response.status,
      buildApiErrorPayload(payload, {
        contentType,
        path,
        requestUrl,
        responsePreview,
      }),
    )
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new ApiError('DwarPal backend returned an invalid response.', 502, {
      code: 'INVALID_API_RESPONSE',
      contentType,
      path,
      requestUrl,
      responsePreview,
    })
  }

  if (isAuthRequest) {
    logAuthDebug('response success', {
      message: payload?.message || '',
      method,
      path,
      requestUrl,
      status: response.status,
    })
  }

  return payload
}

export async function warmBackendForAuth({ signal, force = false, timeoutMs = DEFAULT_BACKEND_WARMUP_TIMEOUT_MS } = {}) {
  const now = Date.now()

  if (!force && now - lastBackendWarmupAt < BACKEND_WARMUP_CACHE_MS) {
    return true
  }

  try {
    await apiRequest('/health', { signal, timeoutMs })
    lastBackendWarmupAt = Date.now()
    return true
  } catch {
    return false
  }
}

function toUiUser(user, session = null) {
  if (!user) return null

  const normalizedRole = normalizeRole(user.role)

  return {
    id: user.id,
    name: user.fullName,
    email: user.email,
    program: normalizeProgram(user.program),
    department: normalizeDepartment(user.department) || user.department || 'Not assigned',
    enrollment: user.enrollmentNo || '',
    employeeId: user.employeeId || '',
    phone: user.phone || '',
    role: normalizedRole || 'student',
    semester: user.semester || null,
    profileImageUrl: user.profileImageUrl || user.profileImage || null,
    isActive: user.isActive ?? true,
    hasBiometricCredentials: Boolean(user.hasBiometricCredentials),
    gatepassApprovalEnabled: user.gatepassApprovalEnabled !== false,
    coordinatorAssignment: {
      isCoordinator: Boolean(user.coordinatorAssignment?.isCoordinator),
      program: normalizeProgram(user.coordinatorAssignment?.program),
      department: normalizeDepartment(user.coordinatorAssignment?.department) || user.coordinatorAssignment?.department || null,
      semester: user.coordinatorAssignment?.semester || null,
    },
    lastLoginAt: user.lastLoginAt || null,
    sessionAuthMethod: session?.authMethod || null,
    sessionExpiresAt: session?.expiresAt || null,
  }
}

function combineDateAndTime(dateValue, timeValue) {
  if (!dateValue) return ''

  const date = new Date(dateValue)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  if (!timeValue) {
    return date.toISOString()
  }

  const [hours = '00', minutes = '00'] = String(timeValue).split(':')
  date.setHours(Number(hours), Number(minutes), 0, 0)
  return date.toISOString()
}

function formatDurationLabel(totalMinutes) {
  const minutes = Number(totalMinutes)

  if (!Number.isFinite(minutes) || minutes <= 0) {
    return ''
  }

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  const hourLabel = hours ? `${hours}h` : ''
  const minuteLabel = remainingMinutes ? `${remainingMinutes}m` : ''

  return [hourLabel, minuteLabel].filter(Boolean).join(' ') || `${minutes}m`
}

function getDisplayStatus(status) {
  if (PENDING_GATEPASS_STATUSES.has(status)) return 'Pending'
  if (APPROVED_GATEPASS_STATUSES.has(status)) return 'Approved'
  if (REJECTED_GATEPASS_STATUSES.has(status)) return 'Rejected'
  if (status === 'checked_out_by_security') return 'Out'
  if (status === 'completed') return 'Returned'
  if (status === 'cancelled') return 'Cancelled'
  return 'Pending'
}

function getCurrentStage(gatepass) {
  if (gatepass.status === 'checked_out_by_security') return 'security'
  if (gatepass.status === 'completed' || gatepass.status === 'cancelled' || REJECTED_GATEPASS_STATUSES.has(gatepass.status)) {
    return 'closed'
  }
  if (APPROVED_GATEPASS_STATUSES.has(gatepass.status)) return 'security'
  return gatepass.currentApprovalLevel || 'closed'
}

function buildStudentTimeline(gatepass) {
  const timeline = [
    { label: 'Submitted', note: 'Awaiting Principal review', at: gatepass.createdAt, tone: 'done' },
  ]

  if (gatepass.status === 'pending_principal') {
    timeline.push(
      { label: 'Principal Review', note: 'Pending approval', at: null, tone: 'current' },
      { label: 'Security Exit', note: 'Will unlock after approval', at: null, tone: 'upcoming' },
    )
    return timeline
  }

  if (gatepass.status === 'forwarded_to_hod') {
    timeline.push(
      {
        label: 'Forwarded by Principal',
        note: 'Sent to HOD for final review',
        at: gatepass.actions?.principal?.actedAt || gatepass.updatedAt,
        tone: 'done',
      },
      { label: 'HOD Review', note: 'Pending approval', at: null, tone: 'current' },
      { label: 'Security Exit', note: 'Will unlock after approval', at: null, tone: 'upcoming' },
    )
    return timeline
  }

  if (gatepass.status === 'forwarded_to_coordinator') {
    timeline.push(
      {
        label: 'Forwarded by Principal/HOD',
        note: 'Escalated to Coordinator for semester review',
        at:
          gatepass.actions?.coordinator?.actedAt ||
          gatepass.actions?.hod?.actedAt ||
          gatepass.actions?.principal?.actedAt ||
          gatepass.updatedAt,
        tone: 'done',
      },
      { label: 'Coordinator Review', note: 'Pending approval', at: null, tone: 'current' },
      { label: 'Security Exit', note: 'Will unlock after approval', at: null, tone: 'upcoming' },
    )
    return timeline
  }

  if (gatepass.status === 'approved_final') {
    timeline.push(
      {
        label: 'Principal Approved',
        note: 'Request approved and sent to Security desk',
        at: gatepass.actions?.principal?.actedAt || gatepass.updatedAt,
        tone: 'done',
      },
      { label: 'Security Exit', note: 'Ready for OUT verification', at: null, tone: 'current' },
    )
    return timeline
  }

  if (gatepass.status === 'approved_by_hod') {
    timeline.push(
      {
        label: 'Forwarded by Principal',
        note: 'Sent to HOD for final review',
        at: gatepass.actions?.principal?.actedAt || gatepass.updatedAt,
        tone: 'done',
      },
      {
        label: 'HOD Approved',
        note: 'Request approved and sent to Security desk',
        at: gatepass.actions?.hod?.actedAt || gatepass.updatedAt,
        tone: 'done',
      },
      { label: 'Security Exit', note: 'Ready for OUT verification', at: null, tone: 'current' },
    )
    return timeline
  }

  if (gatepass.status === 'approved_by_coordinator') {
    timeline.push(
      {
        label: 'Escalated for Coordinator Review',
        note: 'Principal/HOD escalated this request',
        at: gatepass.actions?.principal?.actedAt || gatepass.actions?.hod?.actedAt || gatepass.updatedAt,
        tone: 'done',
      },
      {
        label: 'Coordinator Approved',
        note: 'Request approved and sent to Security desk',
        at: gatepass.actions?.coordinator?.actedAt || gatepass.updatedAt,
        tone: 'done',
      },
      { label: 'Security Exit', note: 'Ready for OUT verification', at: null, tone: 'current' },
    )
    return timeline
  }

  if (gatepass.status === 'rejected_by_principal') {
    timeline.push({
      label: 'Rejected by Principal',
      note: gatepass.rejectionReason || 'Request closed',
      at: gatepass.actions?.principal?.actedAt || gatepass.updatedAt,
      tone: 'danger',
    })
    return timeline
  }

  if (gatepass.status === 'rejected_by_hod') {
    timeline.push(
      {
        label: 'Forwarded by Principal',
        note: 'Sent to HOD for final review',
        at: gatepass.actions?.principal?.actedAt || gatepass.updatedAt,
        tone: 'done',
      },
      {
        label: 'Rejected by HOD',
        note: gatepass.rejectionReason || 'Request closed',
        at: gatepass.actions?.hod?.actedAt || gatepass.updatedAt,
        tone: 'danger',
      },
    )
    return timeline
  }

  if (gatepass.status === 'rejected_by_coordinator') {
    timeline.push(
      {
        label: 'Escalated for Coordinator Review',
        note: 'Principal/HOD escalated this request',
        at: gatepass.actions?.principal?.actedAt || gatepass.actions?.hod?.actedAt || gatepass.updatedAt,
        tone: 'done',
      },
      {
        label: 'Rejected by Coordinator',
        note: gatepass.rejectionReason || 'Request closed',
        at: gatepass.actions?.coordinator?.actedAt || gatepass.updatedAt,
        tone: 'danger',
      },
    )
    return timeline
  }

  if (gatepass.actions?.hod?.status === 'approved') {
    timeline.push(
      {
        label: 'Forwarded by Principal',
        note: 'Sent to HOD for final review',
        at: gatepass.actions?.principal?.actedAt || gatepass.updatedAt,
        tone: 'done',
      },
      {
        label: 'HOD Approved',
        note: 'Request approved and sent to Security desk',
        at: gatepass.actions?.hod?.actedAt || gatepass.updatedAt,
        tone: 'done',
      },
    )
  } else if (gatepass.actions?.coordinator?.status === 'approved') {
    timeline.push(
      {
        label: 'Coordinator Approved',
        note: 'Request approved and sent to Security desk',
        at: gatepass.actions?.coordinator?.actedAt || gatepass.updatedAt,
        tone: 'done',
      },
    )
  } else if (gatepass.actions?.principal?.status === 'approved') {
    timeline.push(
      {
        label: 'Principal Approved',
        note: 'Request approved and sent to Security desk',
        at: gatepass.actions?.principal?.actedAt || gatepass.updatedAt,
        tone: 'done',
      },
    )
  }

  return buildSecurityTimeline(timeline, gatepass)
}

function buildFacultyTimeline(gatepass) {
  const timeline = [
    { label: 'Submitted', note: 'Awaiting CAO review', at: gatepass.createdAt, tone: 'done' },
  ]

  if (gatepass.status === 'pending_cao') {
    timeline.push(
      { label: 'CAO Review', note: 'Pending approval', at: null, tone: 'current' },
      { label: 'Security Exit', note: 'Will unlock after approval', at: null, tone: 'upcoming' },
    )
    return timeline
  }

  if (gatepass.status === 'approved_by_cao') {
    timeline.push(
      {
        label: 'CAO Approved',
        note: 'Request approved and sent to Security desk',
        at: gatepass.actions?.cao?.actedAt || gatepass.updatedAt,
        tone: 'done',
      },
      { label: 'Security Exit', note: 'Ready for OUT verification', at: null, tone: 'current' },
    )
    return timeline
  }

  if (gatepass.status === 'rejected_by_cao') {
    timeline.push({
      label: 'Rejected by CAO',
      note: gatepass.rejectionReason || 'Request closed',
      at: gatepass.actions?.cao?.actedAt || gatepass.updatedAt,
      tone: 'danger',
    })
    return timeline
  }

  if (gatepass.actions?.cao?.status === 'approved') {
    timeline.push({
      label: 'CAO Approved',
      note: 'Request approved and sent to Security desk',
      at: gatepass.actions?.cao?.actedAt || gatepass.updatedAt,
      tone: 'done',
    })
  }

  return buildSecurityTimeline(timeline, gatepass)
}

function buildSecurityTimeline(baseTimeline, gatepass) {
  const timeline = [...baseTimeline]

  if (gatepass.status === 'checked_out_by_security') {
    timeline.push(
      {
        label: 'Marked OUT',
        note: 'Exited campus gate',
        at: gatepass.security?.checkedOutAt || gatepass.updatedAt,
        tone: 'done',
      },
      { label: 'Marked IN', note: 'Pending return entry', at: null, tone: 'current' },
    )
    return timeline
  }

  if (gatepass.status === 'completed') {
    timeline.push(
      {
        label: 'Marked OUT',
        note: 'Exited campus gate',
        at: gatepass.security?.checkedOutAt || gatepass.updatedAt,
        tone: 'done',
      },
      {
        label: 'Marked IN',
        note: 'Returned to campus',
        at: gatepass.security?.checkedInAt || gatepass.updatedAt,
        tone: 'done',
      },
    )
    return timeline
  }

  if (gatepass.status === 'cancelled') {
    timeline.push({
      label: 'Cancelled',
      note: gatepass.rejectionReason || 'Request cancelled',
      at: gatepass.updatedAt,
      tone: 'danger',
    })
    return timeline
  }

  return timeline
}

function buildTimeline(gatepass) {
  return gatepass.applicantType === 'student'
    ? buildStudentTimeline(gatepass)
    : buildFacultyTimeline(gatepass)
}

export function toUiGatepass(gatepass) {
  if (!gatepass) return null

  const applicant = gatepass.applicant || gatepass.applicantSnapshot || gatepass.createdBy || {}
  const submittedBy = gatepass.submittedBy || gatepass.createdBy || {}
  const applicantType = gatepass.applicantType || gatepass.requesterType || 'student'
  const enrollmentNumber =
    applicant.enrollmentNo || submittedBy.enrollmentNo || gatepass.enrollmentNumber || gatepass.enrollment || ''
  const employeeId = applicant.employeeId || submittedBy.employeeId || gatepass.employeeId || ''
  const applicantId = applicantType === 'student' ? enrollmentNumber || employeeId : employeeId || enrollmentNumber
  const gatepassId = gatepass.gatepassId || gatepass.passNumber || gatepass.id
  const recordId = gatepass.recordId || gatepass.id || gatepass._id || ''
  const outDateTime = combineDateAndTime(gatepass.outDate, gatepass.outTime)
  const expectedReturnTime = gatepass.expectedReturnDate
    ? combineDateAndTime(gatepass.expectedReturnDate, gatepass.expectedReturnTime)
    : ''
  const mapped = {
    id: gatepassId,
    recordId,
    gatepassId,
    requestKind: gatepass.requestKind || (applicantType === 'faculty' ? 'faculty_gatepass' : 'student_gatepass'),
    requesterId: submittedBy.id || submittedBy._id || gatepass.requesterId || '',
    requesterType: applicantType,
    name: applicant.fullName || submittedBy.fullName || gatepass.name || '',
    enrollment: applicantId,
    enrollmentNumber,
    employeeId,
    program: normalizeProgram(applicant.program || submittedBy.program || gatepass.program || ''),
    department:
      normalizeDepartment(applicant.department || submittedBy.department || gatepass.department || '') ||
      applicant.department ||
      submittedBy.department ||
      gatepass.department ||
      'Not assigned',
    reason: gatepass.reason,
    vehicleNumber: gatepass.vehicleNumber || '',
    outTime: outDateTime,
    expectedReturnTime,
    status: getDisplayStatus(gatepass.status),
    stage: getCurrentStage(gatepass),
    submittedAt: gatepass.createdAt,
    updatedAt: gatepass.updatedAt || gatepass.createdAt,
    approvedBy: gatepass.approvedBy || 'Awaiting approval',
    approvedAt: gatepass.approvedAt || '',
    rejectionReason: gatepass.rejectionReason || '',
    rawStatus: gatepass.status,
    rawApprovalLevel: gatepass.currentApprovalLevel || '',
    applicantType,
    qr: {
      available: Boolean(gatepass.qr?.available || gatepass.qrCodeDataUrl || gatepass.verificationToken),
      imageDataUrl: gatepass.qr?.imageDataUrl || gatepass.qrCodeDataUrl || null,
      verificationUrl: gatepass.qr?.verificationUrl || gatepass.qrVerificationUrl || null,
      verificationToken: gatepass.qr?.verificationToken || gatepass.verificationToken || null,
      payload: gatepass.qr?.payload || gatepass.qrPayload || null,
      generatedAt: gatepass.qr?.generatedAt || gatepass.qrGeneratedAt || null,
      expiresAt: gatepass.qr?.expiresAt || gatepass.qrExpiresAt || null,
      revokedAt: gatepass.qr?.revokedAt || gatepass.qrRevokedAt || null,
    },
    actions: gatepass.actions || {
      principal: {
        status: gatepass.principalAction?.status || null,
        actedAt: gatepass.principalAction?.actedAt || null,
      },
      hod: {
        status: gatepass.hodAction?.status || null,
        actedAt: gatepass.hodAction?.actedAt || null,
      },
      coordinator: {
        status: gatepass.coordinatorAction?.status || null,
        actedAt: gatepass.coordinatorAction?.actedAt || null,
      },
      cao: {
        status: gatepass.caoAction?.status || null,
        actedAt: gatepass.caoAction?.actedAt || null,
      },
    },
    security: gatepass.security || {
      verifiedAt: gatepass.securityAction?.verifiedAt || null,
      checkedOutAt: gatepass.securityAction?.checkedOutAt || null,
      checkedInAt: gatepass.securityAction?.checkedInAt || null,
    },
    routingHistory: Array.isArray(gatepass.routingHistory) ? gatepass.routingHistory : [],
    timeline: [],
  }

  mapped.timeline = buildTimeline({
    ...gatepass,
    applicantType: mapped.applicantType,
    actions: mapped.actions,
    security: mapped.security,
  })

  return mapped
}

function getFacultyLeaveDisplayStatus(request) {
  if (request.security?.checkedInAt || request.securityAction?.checkedInAt) return 'Returned'
  if (request.security?.checkedOutAt || request.securityAction?.checkedOutAt) return 'Out'
  if (request.overallStatus === 'approved') return 'Approved'
  if (request.overallStatus === 'rejected') return 'Rejected'
  return 'Pending'
}

function buildFacultyLeaveTimeline(request) {
  const timeline = [
    {
      label: 'Submitted',
      note: 'Workload adjustment sent to HOD and short leave sent to Principal',
      at: request.createdAt,
      tone: 'done',
    },
  ]

  if (request.workloadStatus === 'approved_by_hod') {
    timeline.push({
      label: 'Workload Adjustment',
      note: 'Approved by HOD',
      at: request.actions?.hod?.actedAt || request.updatedAt,
      tone: 'done',
    })
  } else if (request.workloadStatus === 'rejected_by_hod') {
    timeline.push({
      label: 'Workload Adjustment',
      note: request.rejectionReason || 'Rejected by HOD',
      at: request.actions?.hod?.actedAt || request.updatedAt,
      tone: 'danger',
    })
  } else {
    timeline.push({
      label: 'Workload Adjustment',
      note: 'Pending HOD approval',
      at: null,
      tone: 'current',
    })
  }

  if (request.shortLeaveStatus === 'pending_principal') {
    timeline.push(
      {
        label: 'Principal Review',
        note: 'Pending approval',
        at: null,
        tone: 'current',
      },
      {
        label: 'CAO Review',
        note: 'Will begin after Principal approval',
        at: null,
        tone: 'upcoming',
      },
    )

    return timeline
  }

  if (request.shortLeaveStatus === 'rejected_by_principal') {
    timeline.push({
      label: 'Principal Review',
      note: request.rejectionReason || 'Rejected by Principal',
      at: request.actions?.principal?.actedAt || request.updatedAt,
      tone: 'danger',
    })

    return timeline
  }

  timeline.push({
    label: 'Principal Review',
    note: 'Approved by Principal',
    at: request.actions?.principal?.actedAt || request.updatedAt,
    tone: 'done',
  })

  if (request.shortLeaveStatus === 'pending_cao') {
    timeline.push({
      label: 'CAO Review',
      note: 'Pending approval',
      at: null,
      tone: 'current',
    })

    return timeline
  }

  if (request.shortLeaveStatus === 'rejected_by_cao') {
    timeline.push({
      label: 'CAO Review',
      note: request.rejectionReason || 'Rejected by CAO',
      at: request.actions?.cao?.actedAt || request.updatedAt,
      tone: 'danger',
    })

    return timeline
  }

  timeline.push({
    label: 'CAO Review',
    note: 'Approved',
    at: request.actions?.cao?.actedAt || request.updatedAt,
    tone: 'done',
  })

  if (request.security?.checkedOutAt || request.securityAction?.checkedOutAt) {
    timeline.push({
      label: 'Marked OUT',
      note: 'Verified by security',
      at: request.security?.checkedOutAt || request.securityAction?.checkedOutAt,
      tone: 'done',
    })
  } else if (request.overallStatus === 'approved') {
    timeline.push({
      label: 'Security Exit',
      note: 'Ready for gate verification',
      at: null,
      tone: 'current',
    })
  }

  if (request.security?.checkedInAt || request.securityAction?.checkedInAt) {
    timeline.push({
      label: 'Marked IN',
      note: 'Returned and closed by security',
      at: request.security?.checkedInAt || request.securityAction?.checkedInAt,
      tone: 'done',
    })
  } else if (request.security?.checkedOutAt || request.securityAction?.checkedOutAt) {
    timeline.push({
      label: 'Marked IN',
      note: 'Pending return verification',
      at: null,
      tone: 'current',
    })
  }

  return timeline
}

export function toUiFacultyLeaveRequest(request) {
  if (!request) return null

  const leaveType =
    request.leaveDetails?.leaveType === 'Others'
      ? request.leaveDetails?.leaveTypeOther || 'Others'
      : request.leaveDetails?.leaveType || ''
  const gatepassId = request.requestNumber || request.id
  const outTime =
    request.outTime ||
    request.qr?.payload?.outTime ||
    request.qrPayload?.outTime ||
    combineDateAndTime(request.shortLeave?.leaveDate || request.leaveDetails?.leaveFrom, request.shortLeave?.requestedFrom)
  const expectedReturnTime =
    request.expectedReturnTime ||
    request.qr?.payload?.returnTime ||
    request.qrPayload?.returnTime ||
    combineDateAndTime(request.shortLeave?.leaveDate || request.leaveDetails?.leaveTo, request.shortLeave?.requestedTo)
  const security = request.security || {
    verifiedAt: request.securityAction?.verifiedAt || null,
    checkedOutAt: request.securityAction?.checkedOutAt || null,
    checkedInAt: request.securityAction?.checkedInAt || null,
  }

  return {
    id: gatepassId,
    recordId: request.recordId || request.id || request._id || '',
    gatepassId,
    requestNumber: gatepassId,
    requestKind: 'faculty_leave',
    requesterId: request.createdBy?.id || '',
    requesterType: 'faculty',
    name: request.facultyDetails?.name || '',
    enrollment: request.facultyDetails?.employeeId || '',
    department: request.facultyDetails?.department || 'Not assigned',
    designation: request.facultyDetails?.designation || 'Faculty',
    reason: request.leaveDetails?.reason || request.shortLeave?.reason || 'Faculty leave request',
    outTime,
    expectedReturnTime,
    leaveType,
    leaveFrom: request.leaveDetails?.leaveFrom || '',
    leaveTo: request.leaveDetails?.leaveTo || '',
    totalDays: request.leaveDetails?.totalDays || 0,
    shortLeaveDate: request.shortLeave?.leaveDate || '',
    shortLeaveStartTime: request.shortLeave?.requestedFrom || '',
    shortLeaveEndTime: request.shortLeave?.requestedTo || '',
    shortLeaveDurationMinutes: request.shortLeave?.totalDurationMinutes || 0,
    shortLeaveDurationLabel: formatDurationLabel(request.shortLeave?.totalDurationMinutes),
    instituteName: request.shortLeave?.instituteName || '',
    workloadStage: request.workloadStage || '',
    shortLeaveStage: request.shortLeaveStage || '',
    status: getFacultyLeaveDisplayStatus({ ...request, security }),
    rawStatus: request.overallStatus || 'pending',
    rawWorkloadStatus: request.workloadStatus || 'pending_hod',
    rawShortLeaveStatus: request.shortLeaveStatus || 'pending_principal',
    submittedAt: request.createdAt,
    updatedAt: request.updatedAt,
    approvedBy: request.approvedBy || 'Awaiting approval',
    approvedAt: request.approvedAt || '',
    rejectionReason: request.rejectionReason || '',
    latestComment: request.latestComment || '',
    qr: {
      available: Boolean(request.qr?.available || request.qrCodeDataUrl),
      imageDataUrl: request.qr?.imageDataUrl || request.qrCodeDataUrl || null,
      verificationUrl: request.qr?.verificationUrl || request.qrVerificationUrl || null,
      verificationToken: request.qr?.verificationToken || request.verificationToken || null,
      payload: request.qr?.payload || request.qrPayload || null,
      generatedAt: request.qr?.generatedAt || request.qrGeneratedAt || null,
      expiresAt: request.qr?.expiresAt || request.qrExpiresAt || null,
      revokedAt: request.qr?.revokedAt || request.qrRevokedAt || null,
    },
    actions: request.actions || {},
    security,
    timeline: buildFacultyLeaveTimeline({ ...request, security }),
  }
}

export async function verifySession({ signal, timeoutMs = DEFAULT_AUTH_SESSION_TIMEOUT_MS } = {}) {
  if (!hasStoredAuthToken()) {
    return null
  }

  const payload = await apiRequest('/auth/me', { signal, timeoutMs })
  const user = toUiUser(payload?.data?.user, payload?.data?.session)

  if (user) {
    storeAuthUser(user)
  }

  return user
}

export async function loginUser(identifier, password) {
  const payload = await apiRequest('/auth/login', {
    method: 'POST',
    timeoutMs: DEFAULT_AUTH_TIMEOUT_MS,
    body: {
      identifier,
      password,
    },
  })

  console.log('Login response', payload?.data || null)

  if (payload?.data?.token) {
    storeAuthToken(payload.data.token)
  }

  const user = toUiUser(payload?.data?.user, { authMethod: 'password' })

  if (user) {
    storeAuthUser(user)
  }

  return user
}

export async function checkRegistrationAvailability(payload) {
  const response = await apiRequest('/auth/register/check-availability', {
    method: 'POST',
    timeoutMs: DEFAULT_AUTH_TIMEOUT_MS,
    body: buildRegistrationIdentityPayload(payload),
  })

  return {
    available: Boolean(response?.data?.available),
    phone: response?.data?.phone || null,
  }
}

export async function registerUser(
  payload,
  { signal, timeoutMs = DEFAULT_REGISTER_SEND_TIMEOUT_MS } = {},
) {
  const response = await apiRequest('/auth/register', {
    method: 'POST',
    signal,
    timeoutMs,
    body: {
      ...buildRegistrationIdentityPayload(payload),
      password: payload.password,
    },
  })

  return {
    message: response?.message || 'Account created successfully. You can sign in now.',
    email: response?.data?.email || '',
    user: response?.data?.user || null,
  }
}

export async function logoutUser() {
  try {
    await apiRequest('/auth/logout', { method: 'POST' })
  } finally {
    clearStoredAuthToken()
  }
}

export async function updateCurrentUserProfile(profileUpdates = {}) {
  const response = await apiRequest('/users/profile', {
    method: 'PATCH',
    body: profileUpdates,
  })

  const user = toUiUser(response?.data)

  if (user) {
    storeAuthUser(user)
  }

  return user
}

export async function getBiometricDevices() {
  const payload = await apiRequest('/auth/webauthn/devices')
  return {
    devices: Array.isArray(payload?.data?.devices) ? payload.data.devices : [],
    hasBiometricCredentials: Boolean(payload?.data?.hasBiometricCredentials),
  }
}

export async function createBiometricRegistrationOptions(deviceName) {
  const payload = await apiRequest('/auth/webauthn/register/options', {
    method: 'POST',
    body: {
      deviceName: String(deviceName || '').trim(),
    },
  })

  return payload?.data?.options || null
}

export async function verifyBiometricRegistration(response, deviceName) {
  const payload = await apiRequest('/auth/webauthn/register/verify', {
    method: 'POST',
    body: {
      response,
      deviceName: String(deviceName || '').trim(),
    },
  })

  if (payload?.data?.deviceId) {
    storeBiometricDeviceId(payload.data.deviceId)
  }

  return {
    deviceId: payload?.data?.deviceId || '',
    devices: Array.isArray(payload?.data?.devices) ? payload.data.devices : [],
    user: toUiUser(payload?.data?.user),
  }
}

export async function createBiometricAuthenticationOptions(identifier) {
  const payload = await apiRequest('/auth/webauthn/authentication/options', {
    method: 'POST',
    body: {
      identifier,
    },
  })

  return payload?.data?.options || null
}

export async function verifyBiometricAuthentication(response) {
  const payload = await apiRequest('/auth/webauthn/authentication/verify', {
    method: 'POST',
    body: {
      response,
    },
  })

  if (payload?.data?.token) {
    storeAuthToken(payload.data.token)
  }

  if (payload?.data?.deviceId) {
    storeBiometricDeviceId(payload.data.deviceId)
  }

  const user = toUiUser(payload?.data?.user, { authMethod: 'webauthn' })

  if (user) {
    storeAuthUser(user)
  }

  return user
}

export async function removeBiometricDevice(deviceId) {
  const payload = await apiRequest(`/auth/webauthn/devices/${deviceId}`, {
    method: 'DELETE',
  })

  if (readBiometricDeviceId() === String(deviceId)) {
    clearBiometricDeviceId()
  }

  return {
    removedDeviceId: payload?.data?.removedDeviceId || '',
    devices: Array.isArray(payload?.data?.devices) ? payload.data.devices : [],
    hasBiometricCredentials: Boolean(payload?.data?.hasBiometricCredentials),
  }
}

function sortRequestsByLatestActivity(requests = []) {
  return [...requests].sort((left, right) => {
    const leftTime = new Date(left.updatedAt || left.submittedAt || 0).getTime()
    const rightTime = new Date(right.updatedAt || right.submittedAt || 0).getTime()
    return rightTime - leftTime
  })
}

async function fetchWorkspaceRequests(role, signal) {
  const normalizedRole = normalizeRole(role)

  if (normalizedRole === 'student') {
    const payload = await apiRequest('/gatepasses/my?sortBy=updatedAt&order=desc&page=1&limit=50', { signal })
    return Array.isArray(payload.data) ? payload.data.map(toUiGatepass) : []
  }

  if (normalizedRole === 'faculty') {
    const [facultyPayload, coordinatorPayload] = await Promise.all([
      apiRequest('/faculty-leaves/my?sortBy=updatedAt&order=desc&page=1&limit=50', { signal }),
      apiRequest('/gatepasses/pending/coordinator?sortBy=updatedAt&order=desc&page=1&limit=50', { signal }).catch(
        (error) => {
          if (error instanceof ApiError && (error.status === 400 || error.status === 403)) {
            return { data: [] }
          }
          throw error
        },
      ),
    ])

    return sortRequestsByLatestActivity([
      ...(Array.isArray(facultyPayload.data) ? facultyPayload.data.map(toUiFacultyLeaveRequest) : []),
      ...(Array.isArray(coordinatorPayload.data) ? coordinatorPayload.data.map(toUiGatepass) : []),
    ])
  }

  if (normalizedRole === 'principal') {
    const [studentPayload, facultyPayload] = await Promise.all([
      apiRequest('/gatepasses/history?applicantType=student&sortBy=updatedAt&order=desc&page=1&limit=50', { signal }),
      apiRequest('/faculty-leaves/history?sortBy=updatedAt&order=desc&page=1&limit=50', { signal }),
    ])

    return sortRequestsByLatestActivity([
      ...(Array.isArray(studentPayload.data) ? studentPayload.data.map(toUiGatepass) : []),
      ...(Array.isArray(facultyPayload.data) ? facultyPayload.data.map(toUiFacultyLeaveRequest) : []),
    ])
  }

  if (normalizedRole === 'hod') {
    const [studentPayload, facultyPayload] = await Promise.all([
      apiRequest('/gatepasses/history?applicantType=student&sortBy=updatedAt&order=desc&page=1&limit=50', { signal }),
      apiRequest('/faculty-leaves/history?sortBy=updatedAt&order=desc&page=1&limit=50', { signal }),
    ])

    return sortRequestsByLatestActivity([
      ...(Array.isArray(studentPayload.data) ? studentPayload.data.map(toUiGatepass) : []),
      ...(Array.isArray(facultyPayload.data) ? facultyPayload.data.map(toUiFacultyLeaveRequest) : []),
    ])
  }

  if (normalizedRole === 'cao') {
    const payload = await apiRequest('/faculty-leaves/history?sortBy=updatedAt&order=desc&page=1&limit=50', { signal })
    return Array.isArray(payload.data) ? payload.data.map(toUiFacultyLeaveRequest) : []
  }

  if (normalizedRole === 'security') {
    const [studentPayload, facultyPayload] = await Promise.all([
      apiRequest('/gatepasses/history?sortBy=updatedAt&order=desc&page=1&limit=50', { signal }),
      apiRequest('/faculty-leaves/history?sortBy=updatedAt&order=desc&page=1&limit=50', { signal }),
    ])

    return sortRequestsByLatestActivity([
      ...(Array.isArray(studentPayload.data) ? studentPayload.data.map(toUiGatepass).filter((item) => item.status !== 'Approved') : []),
      ...(Array.isArray(facultyPayload.data)
        ? facultyPayload.data.map(toUiFacultyLeaveRequest).filter((item) => item.status !== 'Approved')
        : []),
    ])
  }

  const payload = await apiRequest('/gatepasses/history?sortBy=updatedAt&order=desc&page=1&limit=50', { signal })
  return Array.isArray(payload.data) ? payload.data.map(toUiGatepass) : []
}

export async function fetchWorkspace(role, signal) {
  const [summaryPayload, requests] = await Promise.all([
    apiRequest('/dashboard/summary', { signal }),
    fetchWorkspaceRequests(role, signal),
  ])

  return {
    summary: summaryPayload.data,
    gatepasses: requests,
  }
}

export async function getNotifications({ page = 1, limit = 50, signal } = {}) {
  const searchParams = new URLSearchParams()

  if (Number(page) > 0) {
    searchParams.set('page', String(page))
  }

  if (Number(limit) > 0) {
    searchParams.set('limit', String(limit))
  }

  const queryString = searchParams.toString()
  const response = await apiRequest(`/notifications${queryString ? `?${queryString}` : ''}`, { signal })

  return {
    notifications: Array.isArray(response?.data) ? response.data : [],
    meta: response?.meta || {},
    unreadCount: Number(response?.meta?.unreadCount || 0),
  }
}

export async function getUnreadNotificationCount(signal) {
  const response = await apiRequest('/notifications/unread-count', { signal })
  return Number(response?.data?.unreadCount || 0)
}

export async function markNotificationRead(notificationId) {
  const response = await apiRequest(`/notifications/${notificationId}/read`, {
    method: 'PATCH',
  })

  return response?.data || null
}

export async function markAllNotificationsRead() {
  const response = await apiRequest('/notifications/read-all', {
    method: 'PATCH',
  })

  return response?.data || {
    updatedCount: 0,
    notificationIds: [],
    readAt: null,
  }
}

export function createGatepassPayload(form) {
  const [outDate = '', outTime = ''] = String(form.outTime || '').split('T')
  const [expectedReturnDate = '', expectedReturnTime = ''] = String(form.expectedReturnTime || '').split('T')

  return {
    reason: form.reason.trim(),
    destination: '',
    outDate,
    outTime,
    expectedReturnDate: expectedReturnDate || undefined,
    expectedReturnTime: expectedReturnTime || '',
    vehicleNumber: form.vehicleNumber.trim(),
  }
}

function createFacultyLeavePayload(form) {
  return {
    facultyDetails: {
      name: form.facultyDetails.name.trim(),
      employeeId: form.facultyDetails.employeeId.trim(),
      designation: form.facultyDetails.designation.trim(),
      department: form.facultyDetails.department.trim(),
      contactNumber: form.facultyDetails.contactNumber.trim(),
      emailId: form.facultyDetails.emailId.trim(),
    },
    leaveDetails: {
      leaveType: form.leaveDetails.leaveType,
      leaveTypeOther: form.leaveDetails.leaveTypeOther?.trim() || '',
      reason: form.leaveDetails.reason.trim(),
      leaveFrom: form.leaveDetails.leaveFrom,
      leaveTo: form.leaveDetails.leaveTo,
      totalDays: Number(form.leaveDetails.totalDays),
    },
    workloadAdjustments: form.workloadAdjustments.map((item) => ({
      date: item.date,
      time: item.time.trim(),
      subjectOrCourseCode: item.subjectOrCourseCode.trim(),
      classOrSemester: item.classOrSemester.trim(),
      adjustedFacultyName: item.adjustedFacultyName.trim(),
      adjustedFacultySignature: item.adjustedFacultySignature?.trim() || '',
    })),
    workloadDeclarations: {
      lecturesAdjustedConfirmed: Boolean(form.workloadDeclarations.lecturesAdjustedConfirmed),
      noAcademicLossConfirmed: Boolean(form.workloadDeclarations.noAcademicLossConfirmed),
    },
    declaration: {
      confirmed: Boolean(form.declaration.confirmed),
      declarationDate: form.declaration.declarationDate,
      digitalAcknowledgmentName: form.declaration.digitalAcknowledgmentName.trim(),
    },
    shortLeave: {
      staffMemberName: form.shortLeave.staffMemberName.trim(),
      designation: form.shortLeave.designation.trim(),
      department: form.shortLeave.department.trim(),
      instituteName: form.shortLeave.instituteName.trim(),
      employeeId: form.shortLeave.employeeId.trim(),
      leaveDate: form.shortLeave.leaveDate,
      requestedFrom: form.shortLeave.requestedFrom,
      requestedTo: form.shortLeave.requestedTo,
      totalDurationMinutes: Number(form.shortLeave.totalDurationMinutes),
      reason: form.shortLeave.reason.trim(),
      applicantConfirmed: Boolean(form.shortLeave.applicantConfirmed),
      applicationDate: form.shortLeave.applicationDate,
      digitalSignatureName: form.shortLeave.digitalSignatureName.trim(),
    },
  }
}

export async function submitRequest(form) {
  if (form.requestKind === 'faculty_leave') {
    const response = await apiRequest('/faculty-leaves', {
      method: 'POST',
      body: createFacultyLeavePayload(form),
    })

    return toUiFacultyLeaveRequest(response.data)
  }

  const response = await apiRequest('/gatepasses', {
    method: 'POST',
    body: createGatepassPayload(form),
  })

  return toUiGatepass(response.data)
}

function getDefaultActionBody(action) {
  if (action === 'approve') {
    return { comment: 'Approved from dashboard.' }
  }

  if (action === 'reject') {
    return { rejectionReason: 'Rejected from dashboard.' }
  }

  if (action === 'forward') {
    return { comment: 'Forwarded from dashboard.' }
  }

  if (action === 'sendToCoordinator') {
    return { comment: 'Forwarded to coordinator from dashboard.' }
  }

  return {}
}

export async function updateRequestStatus(request, action, body = null) {
  if (request?.requestKind === 'faculty_leave') {
    const requestBody = body ?? getDefaultActionBody(action)
    const endpointMap = {
      approve: `/faculty-leaves/${request.recordId}/approve`,
      reject: `/faculty-leaves/${request.recordId}/reject`,
      markOut: `/faculty-leaves/${request.recordId}/check-out`,
      markIn: `/faculty-leaves/${request.recordId}/check-in`,
    }

    const endpoint = endpointMap[action]

    if (!endpoint) {
      throw new ApiError('Unsupported faculty leave action', 400)
    }

    const response = await apiRequest(endpoint, {
      method: 'POST',
      body: requestBody,
    })

    return toUiFacultyLeaveRequest(response.data)
  }

  const requestBody = body ?? getDefaultActionBody(action)
  const endpointMap = {
    approve: `/gatepasses/${request.recordId}/approve`,
    reject: `/gatepasses/${request.recordId}/reject`,
    forward: `/gatepasses/${request.recordId}/forward`,
    sendToCoordinator: `/gatepasses/${request.recordId}/forward-to-coordinator`,
    markOut: `/gatepasses/${request.recordId}/check-out`,
    markIn: `/gatepasses/${request.recordId}/check-in`,
  }

  const endpoint = endpointMap[action]

  if (!endpoint) {
    throw new ApiError('Unsupported gatepass action', 400)
  }

  const response = await apiRequest(endpoint, {
    method: 'POST',
    body: requestBody,
  })

  return toUiGatepass(response.data)
}

function normalizeGatepassVerificationValue(value) {
  return String(value || '').trim().toUpperCase()
}

function readVerificationField(payload, keys) {
  return keys.reduce((match, key) => {
    if (match) return match

    const nextValue = payload?.[key]
    return typeof nextValue === 'string' ? nextValue.trim() : ''
  }, '')
}

export function extractGatepassVerificationData(rawValue) {
  const normalizedValue = String(rawValue || '').trim()

  if (!normalizedValue) {
    return {
      verificationToken: '',
      gatepassId: '',
    }
  }

  const directTokenMatch = normalizedValue.match(/^[A-Z0-9]{20,64}$/i)
  if (directTokenMatch) {
    return {
      verificationToken: directTokenMatch[0].toUpperCase(),
      gatepassId: '',
    }
  }

  try {
    const parsedJson = JSON.parse(normalizedValue)
    if (parsedJson && typeof parsedJson === 'object') {
      const verificationToken = normalizeGatepassVerificationValue(
        readVerificationField(parsedJson, ['verificationToken', 'token']) ||
          readVerificationField(parsedJson?.verification || {}, ['token']),
      )
      const gatepassId = normalizeGatepassVerificationValue(
        readVerificationField(parsedJson, ['gatepassId', 'passNumber']) ||
          readVerificationField(parsedJson?.gatepass || {}, ['gatepassId', 'passNumber']),
      )

      if (verificationToken || gatepassId) {
        return { verificationToken, gatepassId }
      }
    }
  } catch {
    // Ignore non-JSON payloads and continue with URL/text parsing.
  }

  try {
    const parsedUrl = new URL(normalizedValue)
    const tokenFromQuery = parsedUrl.searchParams.get('token') || parsedUrl.searchParams.get('verificationToken')
    const gatepassIdFromQuery = parsedUrl.searchParams.get('gatepassId')
    const tokenFromPath = parsedUrl.pathname.match(/\/security\/verify\/([A-Z0-9]{20,64})/i)
    const gatepassIdFromPath = parsedUrl.pathname.match(/\/security\/verify-id\/([A-Z0-9-]{3,64})/i)

    return {
      verificationToken: normalizeGatepassVerificationValue(tokenFromQuery || tokenFromPath?.[1] || ''),
      gatepassId: normalizeGatepassVerificationValue(gatepassIdFromQuery || gatepassIdFromPath?.[1] || ''),
    }
  } catch {
    const embeddedTokenMatch = normalizedValue.match(/token=([A-Z0-9]{20,64})/i)
    const embeddedGatepassIdMatch = normalizedValue.match(/gatepassId=([A-Z0-9-]{3,64})/i)
    const directGatepassIdMatch = normalizedValue.match(/^[A-Z0-9-]{3,64}$/i)

    return {
      verificationToken: normalizeGatepassVerificationValue(embeddedTokenMatch?.[1] || ''),
      gatepassId: normalizeGatepassVerificationValue(embeddedGatepassIdMatch?.[1] || directGatepassIdMatch?.[0] || ''),
    }
  }
}

export function extractGatepassVerificationToken(rawValue) {
  return extractGatepassVerificationData(rawValue).verificationToken
}

function mapGatepassVerificationResponse(payload, fallbackMessage) {
  const rawGatepass = payload?.data?.gatepass
  const gatepass =
    rawGatepass?.requestKind === 'faculty_leave' || rawGatepass?.requestNumber
      ? toUiFacultyLeaveRequest(rawGatepass)
      : toUiGatepass(rawGatepass)

  return {
    valid: Boolean(payload?.data?.valid),
    message: payload?.message || fallbackMessage,
    nextAction: payload?.data?.nextAction || null,
    gatepass,
  }
}

export async function verifyGatepassById(rawGatepassId) {
  const gatepassId = normalizeGatepassVerificationValue(rawGatepassId)

  if (!gatepassId) {
    throw new ApiError('Gatepass ID is required.', 400, null)
  }

  const payload = await apiRequest(`/gatepasses/security/verify-id/${encodeURIComponent(gatepassId)}`)
  return mapGatepassVerificationResponse(payload, 'Gatepass verification completed.')
}

export async function verifyGatepassQr(rawValue) {
  const normalizedValue = String(rawValue || '').trim()

  if (!normalizedValue) {
    throw new ApiError('QR code is invalid or unreadable. Please scan again.', 400, null)
  }

  const payload = await apiRequest('/gatepasses/security/scan', {
    method: 'POST',
    body: {
      rawValue: normalizedValue,
    },
  })

  return mapGatepassVerificationResponse(payload, 'QR verification completed.')
}

export { ApiError }
