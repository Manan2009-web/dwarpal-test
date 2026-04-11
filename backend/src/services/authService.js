const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse
} = require('@simplewebauthn/server');
const env = require('../config/env');
const PendingRegistration = require('../models/PendingRegistration');
const User = require('../models/User');
const AppError = require('../utils/appError');
const pickUser = require('../utils/pickUser');
const { createAccessToken } = require('../utils/token');
const { getClientFingerprint } = require('../utils/request');
const { sendPasswordResetEmail, sendRegistrationVerificationEmail } = require('./emailService');
const { logAction } = require('./auditService');
const {
  consumeRateLimit,
  createRateLimitError,
  getRateLimitState,
  resetRateLimits
} = require('./authRateLimitService');
const {
  PASSWORD_REGEX,
  PUBLIC_REGISTRATION_ROLES,
  normalizeRole
} = require('../constants/appConstants');
const { normalizePhoneNumber } = require('../utils/phone');
const {
  getExpectedOrigins,
  getExpectedRpIds,
  getWebAuthnRpId,
  mapWebAuthnDevice,
  normalizeDeviceName
} = require('../utils/webauthn');

const BCRYPT_HASH_REGEX = /^\$2[aby]\$\d{2}\$/;
const LOGIN_FAILURE_SOURCE_SCOPE = 'auth:login:failed:source';
const LOGIN_FAILURE_IDENTITY_SCOPE = 'auth:login:failed:identity';
const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_FAILURE_SOURCE_LIMIT = 5;
const LOGIN_FAILURE_IDENTITY_LIMIT = 20;
const LOGIN_FAILURE_BLOCK_MS = 15 * 60 * 1000;
const REGISTRATION_OTP_EXPIRES_MS = env.registrationOtpExpiresMinutes * 60 * 1000;
const REGISTRATION_OTP_RESEND_COOLDOWN_MS = env.registrationOtpResendCooldownSeconds * 1000;
const REGISTRATION_PENDING_EXPIRES_MS = env.registrationPendingExpiresMinutes * 60 * 1000;
const PASSWORD_RESET_TOKEN_TTL_MS = env.passwordResetTokenExpiresMinutes * 60 * 1000;

const DUPLICATE_REGISTRATION_MESSAGES = Object.freeze({
  email: 'This email is already registered.',
  phone: 'This phone number is already registered.',
  enrollmentNo: 'This enrollment ID already exists.',
  employeeId: 'This employee ID already exists.'
});

function buildSessionPayload(auth = {}) {
  const expiresAt = auth.expiresAt || (auth.exp ? new Date(auth.exp * 1000).toISOString() : null);
  const issuedAt = auth.issuedAt || (auth.iat ? new Date(auth.iat * 1000).toISOString() : null);
  const tokenExpiresInSeconds = auth.exp ? Math.max(auth.exp - Math.floor(Date.now() / 1000), 0) : null;

  return {
    authMethod: auth.authMethod || null,
    tokenSource: auth.tokenSource || null,
    issuedAt,
    expiresAt,
    tokenExpiresInSeconds
  };
}

function normalizeIdentifier(identifier) {
  return String(identifier || '').trim();
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractLoginIdentifier(payload = {}) {
  return normalizeIdentifier(payload.identifier || payload.enrollment || payload.employeeId || payload.email);
}

function normalizeRateLimitIdentifier(identifier) {
  return normalizeIdentifier(identifier).toLowerCase();
}

function isHashedPassword(value) {
  return BCRYPT_HASH_REGEX.test(String(value || ''));
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

function generateVerificationCode() {
  return crypto.randomInt(0, 1000000).toString().padStart(6, '0');
}

function maskEmailAddress(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const [localPart = '', domain = ''] = normalizedEmail.split('@');

  if (!localPart || !domain) {
    return normalizedEmail;
  }

  const visibleLocal = localPart.slice(0, Math.min(2, localPart.length));
  const maskedLocal = `${visibleLocal}${'*'.repeat(Math.max(localPart.length - visibleLocal.length, 1))}`;
  return `${maskedLocal}@${domain}`;
}

function buildFieldError(field, message) {
  return {
    field,
    message
  };
}

function createFieldErrorResponse(field, message, statusCode = 400) {
  return new AppError(message, statusCode, [buildFieldError(field, message)]);
}

function normalizeRegistrationPayload(payload = {}) {
  const normalizedRole = normalizeRole(payload.role);
  const normalizedEmail = String(payload.email || '').trim().toLowerCase();
  const normalizedEnrollment = String(payload.enrollmentNo || payload.enrollment || '').trim();
  const normalizedEmployeeId = String(payload.employeeId || '').trim().toUpperCase();
  const normalizedPhone = normalizePhoneNumber(payload.phone, {
    defaultCountryCode: env.defaultPhoneCountryCode
  });

  return {
    fullName: String(payload.fullName || payload.name || '').trim(),
    email: normalizedEmail,
    role: normalizedRole,
    program: payload.program,
    department: payload.department,
    semester: payload.semester,
    enrollmentNo: normalizedEnrollment,
    employeeId: normalizedEmployeeId,
    phone: normalizedPhone,
    password: payload.password
  };
}

async function collectRegistrationConflictErrors(payload = {}) {
  const normalizedPayload = normalizeRegistrationPayload(payload);
  const duplicateLookup = [];

  if (normalizedPayload.email) {
    duplicateLookup.push({ email: normalizedPayload.email });
  }

  if (normalizedPayload.phone) {
    duplicateLookup.push({ phone: normalizedPayload.phone });
  }

  if (normalizedPayload.role === 'student' && normalizedPayload.enrollmentNo) {
    duplicateLookup.push({ enrollmentNo: normalizedPayload.enrollmentNo }, { enrollment: normalizedPayload.enrollmentNo });
  }

  if (normalizedPayload.role && normalizedPayload.role !== 'student' && normalizedPayload.employeeId) {
    duplicateLookup.push({ employeeId: normalizedPayload.employeeId });
  }

  if (!duplicateLookup.length) {
    return [];
  }

  const existingUsers = await User.find({ $or: duplicateLookup }).select('email phone enrollmentNo enrollment employeeId').lean();
  const errors = [];

  if (normalizedPayload.email && existingUsers.some((user) => user.email === normalizedPayload.email)) {
    errors.push(buildFieldError('email', DUPLICATE_REGISTRATION_MESSAGES.email));
  }

  if (normalizedPayload.phone && existingUsers.some((user) => user.phone === normalizedPayload.phone)) {
    errors.push(buildFieldError('phone', DUPLICATE_REGISTRATION_MESSAGES.phone));
  }

  if (
    normalizedPayload.role === 'student' &&
    normalizedPayload.enrollmentNo &&
    existingUsers.some(
      (user) =>
        user.enrollmentNo === normalizedPayload.enrollmentNo || user.enrollment === normalizedPayload.enrollmentNo
    )
  ) {
    errors.push(buildFieldError('enrollmentNo', DUPLICATE_REGISTRATION_MESSAGES.enrollmentNo));
  }

  if (
    normalizedPayload.role &&
    normalizedPayload.role !== 'student' &&
    normalizedPayload.employeeId &&
    existingUsers.some((user) => user.employeeId === normalizedPayload.employeeId)
  ) {
    errors.push(buildFieldError('employeeId', DUPLICATE_REGISTRATION_MESSAGES.employeeId));
  }

  return errors;
}

async function assertRegistrationAvailability(payload = {}) {
  const conflictErrors = await collectRegistrationConflictErrors(payload);

  if (conflictErrors.length) {
    throw new AppError(conflictErrors[0].message, 409, conflictErrors);
  }
}

function getPasswordResetBaseUrl() {
  const configuredUrl = String(env.passwordResetUrl || '').trim();
  return configuredUrl || `${env.clientUrl}/reset-password`;
}

function buildPasswordResetUrl(resetToken, email) {
  const resetUrl = new URL(getPasswordResetBaseUrl(), env.clientUrl || 'http://localhost:5173');

  resetUrl.searchParams.set('token', String(resetToken || '').trim());
  resetUrl.searchParams.set('email', String(email || '').trim().toLowerCase());

  return resetUrl.toString();
}

async function hashPasswordValue(password) {
  return bcrypt.hash(String(password || ''), env.bcryptSaltRounds);
}

function buildPendingRegistrationDocument(normalizedPayload, passwordHash, verificationCodeHash, now = new Date()) {
  const normalizedRole = normalizedPayload.role;
  const isStudent = normalizedRole === 'student';
  const requiresProgram = ['student', 'hod'].includes(normalizedRole);
  const requiresDepartment = normalizedRole !== 'security';
  const verificationCodeExpiresAt = new Date(now.getTime() + REGISTRATION_OTP_EXPIRES_MS);
  const resendAvailableAt = new Date(now.getTime() + REGISTRATION_OTP_RESEND_COOLDOWN_MS);
  const deleteAt = new Date(now.getTime() + REGISTRATION_PENDING_EXPIRES_MS);

  return {
    fullName: normalizedPayload.fullName,
    email: normalizedPayload.email,
    passwordHash,
    role: normalizedRole,
    program: requiresProgram ? normalizedPayload.program : null,
    department: requiresDepartment ? normalizedPayload.department : null,
    semester: isStudent ? Number(normalizedPayload.semester) : null,
    enrollmentNo: isStudent ? normalizedPayload.enrollmentNo : null,
    employeeId: isStudent ? null : normalizedPayload.employeeId,
    phone: normalizedPayload.phone,
    verificationCodeHash,
    verificationCodeExpiresAt,
    resendAvailableAt,
    verificationAttempts: 0,
    lastSentAt: now,
    deleteAt
  };
}

function buildRegistrationVerificationRateLimitError(retryAfterSeconds) {
  const message =
    retryAfterSeconds > 0
      ? `Please wait ${Math.max(1, retryAfterSeconds)} seconds before requesting another verification code.`
      : 'Please wait before requesting another verification code.';

  const error = new AppError(message, 429, [
    {
      field: 'email',
      message
    }
  ]);

  error.retryAfterSeconds = retryAfterSeconds;
  error.code = 'AUTH_REGISTER_VERIFICATION_CODE_COOLDOWN';

  return error;
}

async function createOrRefreshPendingRegistration(payload, requestMeta) {
  const normalizedPayload = normalizeRegistrationPayload(payload);
  const normalizedRole = normalizedPayload.role;
  const normalizedPhone = normalizedPayload.phone;

  console.info('[auth-service] createOrRefreshPendingRegistration route entered', {
    email: normalizedPayload.email,
    role: normalizedRole
  });

  if (!PUBLIC_REGISTRATION_ROLES.includes(normalizedRole)) {
    throw new AppError('Only supported roles can register through this endpoint', 403);
  }

  if (!normalizedPhone) {
    throw createFieldErrorResponse('phone', 'Please enter a valid phone number.');
  }

  await assertRegistrationAvailability(normalizedPayload);

  const existingPendingRegistration = await PendingRegistration.findOne({
    email: normalizedPayload.email
  }).select('+passwordHash +verificationCodeHash');

  if (
    existingPendingRegistration?.resendAvailableAt instanceof Date &&
    existingPendingRegistration.resendAvailableAt.getTime() > Date.now() &&
    !existingPendingRegistration.completedAt
  ) {
    const retryAfterSeconds = Math.ceil(
      (existingPendingRegistration.resendAvailableAt.getTime() - Date.now()) / 1000
    );
    throw buildRegistrationVerificationRateLimitError(retryAfterSeconds);
  }

  const verificationCode = generateVerificationCode();
  const passwordHash = await hashPasswordValue(normalizedPayload.password);
  const now = new Date();
  const pendingRegistrationPayload = buildPendingRegistrationDocument(
    normalizedPayload,
    passwordHash,
    hashToken(verificationCode),
    now
  );

  let pendingRegistration = null;

  try {
    pendingRegistration = await PendingRegistration.findOneAndUpdate(
      { email: normalizedPayload.email },
      {
        $set: pendingRegistrationPayload,
        $inc: {
          sendCount: 1
        },
        $unset: {
          completedAt: 1,
          userId: 1
        }
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true
      }
    );

    console.info('[auth-service] sendRegistrationVerificationEmail before sendMail', {
      email: normalizedPayload.email,
      pendingRegistrationId: pendingRegistration?._id?.toString?.() || null
    });

    await sendRegistrationVerificationEmail({
      to: normalizedPayload.email,
      fullName: normalizedPayload.fullName,
      verificationCode,
      expiresInMinutes: env.registrationOtpExpiresMinutes
    });
    console.info('[auth-service] sendRegistrationVerificationEmail after sendMail', {
      email: normalizedPayload.email
    });
  } catch (error) {
    console.error('[auth-service] sendRegistrationVerificationEmail failed', {
      email: normalizedPayload.email,
      error: error?.stack || error?.message || error
    });
    await PendingRegistration.deleteOne({ email: normalizedPayload.email });
    throw error;
  }

  await logAction({
    actorId: null,
    resourceType: 'auth',
    resourceId: pendingRegistration._id,
    action: 'request_registration_verification_code',
    message: 'Registration verification code sent',
    metadata: {
      email: normalizedPayload.email,
      role: normalizedPayload.role
    },
    requestMeta
  });

  return {
    message: 'We sent a verification code to your email.',
    email: normalizedPayload.email,
    maskedEmail: maskEmailAddress(normalizedPayload.email),
    resendAvailableAt: pendingRegistration.resendAvailableAt?.toISOString?.() || null,
    retryAfterSeconds: Math.max(1, env.registrationOtpResendCooldownSeconds),
    expiresAt: pendingRegistration.verificationCodeExpiresAt?.toISOString?.() || null
  };
}

async function resolveCompletedRegistration(pendingRegistration, req) {
  if (!pendingRegistration?.userId) {
    throw new AppError('This registration session has expired. Please create your account again.', 400, [
      {
        field: 'verificationCode',
        message: 'This registration session has expired. Please create your account again.'
      }
    ]);
  }

  const user = await User.findById(pendingRegistration.userId).select('+password');

  if (!user) {
    throw new AppError('This registration session has expired. Please create your account again.', 400, [
      {
        field: 'verificationCode',
        message: 'This registration session has expired. Please create your account again.'
      }
    ]);
  }

  return {
    message: 'Account created successfully.',
    token: createSessionToken(user, 'password'),
    user: pickUser(user, req),
    verification: {
      email: user.email,
      verifiedAt: pendingRegistration.completedAt?.toISOString?.() || user.emailVerifiedAt?.toISOString?.() || null
    }
  };
}

async function findUserByIdentifier(identifier) {
  const normalizedIdentifier = normalizeIdentifier(identifier);

  if (!normalizedIdentifier) {
    return null;
  }

  if (normalizedIdentifier.includes('@')) {
    return User.findOne({ email: normalizedIdentifier.toLowerCase() }).select('+password');
  }

  const employeeIdMatcher = new RegExp(`^${escapeRegex(normalizedIdentifier)}$`, 'i');

  return User.findOne({
    $or: [
      { enrollmentNo: normalizedIdentifier },
      { enrollment: normalizedIdentifier },
      { employeeId: employeeIdMatcher }
    ]
  }).select('+password');
}

function createSessionToken(user, authMethod = 'password') {
  return createAccessToken({
    _id: user._id,
    role: user.role,
    email: user.email,
    authMethod
  });
}

function formatRetryWindow(retryAfterSeconds) {
  const minutes = Math.max(1, Math.ceil(Number(retryAfterSeconds || 0) / 60));
  return minutes === 1 ? 'about 1 minute' : `about ${minutes} minutes`;
}

function buildLoginFailureSourceKey(identifier, req) {
  const normalizedIdentifier = normalizeRateLimitIdentifier(identifier);
  if (!normalizedIdentifier) {
    return '';
  }

  return `${normalizedIdentifier}|${getClientFingerprint(req)}`;
}

function buildLoginFailureIdentityKey(identifier) {
  return normalizeRateLimitIdentifier(identifier);
}

function buildLoginLockedError(retryAfterSeconds) {
  const message = `Too many failed sign-in attempts for this account. Please wait ${formatRetryWindow(retryAfterSeconds)} before trying again or use Forgot Password.`;

  return createRateLimitError({
    message,
    retryAfterSeconds,
    code: 'AUTH_LOGIN_FAILED_ATTEMPTS_LOCKED',
    errors: [
      {
        field: 'identifier',
        message
      }
    ],
    rateLimit: {
      scope: 'auth:login:failed'
    }
  });
}

async function assertLoginFailureBucketsAreOpen(identifier, req) {
  const normalizedIdentifier = normalizeRateLimitIdentifier(identifier);
  if (!normalizedIdentifier) {
    return;
  }

  const [sourceState, identityState] = await Promise.all([
    getRateLimitState({
      scope: LOGIN_FAILURE_SOURCE_SCOPE,
      key: buildLoginFailureSourceKey(normalizedIdentifier, req)
    }),
    getRateLimitState({
      scope: LOGIN_FAILURE_IDENTITY_SCOPE,
      key: buildLoginFailureIdentityKey(normalizedIdentifier)
    })
  ]);

  const blockedState = [sourceState, identityState].find((state) => state.blocked);
  if (blockedState) {
    throw buildLoginLockedError(blockedState.retryAfterSeconds);
  }
}

async function recordFailedLoginAttempt(identifier, req) {
  const normalizedIdentifier = normalizeRateLimitIdentifier(identifier);
  if (!normalizedIdentifier) {
    return;
  }

  const [sourceResult, identityResult] = await Promise.all([
    consumeRateLimit({
      scope: LOGIN_FAILURE_SOURCE_SCOPE,
      key: buildLoginFailureSourceKey(normalizedIdentifier, req),
      limit: LOGIN_FAILURE_SOURCE_LIMIT,
      windowMs: LOGIN_FAILURE_WINDOW_MS,
      blockDurationMs: LOGIN_FAILURE_BLOCK_MS
    }),
    consumeRateLimit({
      scope: LOGIN_FAILURE_IDENTITY_SCOPE,
      key: buildLoginFailureIdentityKey(normalizedIdentifier),
      limit: LOGIN_FAILURE_IDENTITY_LIMIT,
      windowMs: LOGIN_FAILURE_WINDOW_MS,
      blockDurationMs: LOGIN_FAILURE_BLOCK_MS
    })
  ]);

  const blockedResult = [sourceResult, identityResult].find((result) => !result.allowed);
  if (blockedResult) {
    throw buildLoginLockedError(blockedResult.retryAfterSeconds);
  }
}

async function clearFailedLoginAttempts(identifier, req) {
  const normalizedIdentifier = normalizeRateLimitIdentifier(identifier);
  if (!normalizedIdentifier) {
    return;
  }

  await resetRateLimits([
    {
      scope: LOGIN_FAILURE_SOURCE_SCOPE,
      key: buildLoginFailureSourceKey(normalizedIdentifier, req)
    },
    {
      scope: LOGIN_FAILURE_IDENTITY_SCOPE,
      key: buildLoginFailureIdentityKey(normalizedIdentifier)
    }
  ]);
}

function ensureBiometricSetupAllowed(auth = {}) {
  if (auth.authMethod && auth.authMethod !== 'password') {
    throw new AppError(
      'Please login manually once on this device before enabling biometric login.',
      403,
      [
        {
          field: 'authMethod',
          message: 'Please login manually once on this device before enabling biometric login.'
        }
      ]
    );
  }
}

function getCredentialPublicKeyBuffer(publicKey) {
  if (Buffer.isBuffer(publicKey)) {
    return new Uint8Array(publicKey);
  }

  return new Uint8Array(Buffer.from(publicKey));
}

function mapUserDevices(user) {
  return Array.isArray(user?.webAuthnCredentials)
    ? user.webAuthnCredentials.map(mapWebAuthnDevice).filter(Boolean)
    : [];
}

async function checkRegistrationAvailability(payload) {
  const normalizedPayload = normalizeRegistrationPayload(payload);

  await assertRegistrationAvailability(normalizedPayload);

  return {
    available: true,
    phone: normalizedPayload.phone || null
  };
}

async function sendRegistrationVerificationCode(payload, requestMeta) {
  return createOrRefreshPendingRegistration(payload, requestMeta);
}

async function verifyRegistrationEmail(payload, req, requestMeta) {
  const normalizedEmail = String(payload.email || '').trim().toLowerCase();
  const verificationCode = String(payload.verificationCode || '').trim();

  const pendingRegistration = await PendingRegistration.findOne({
    email: normalizedEmail
  }).select('+passwordHash +verificationCodeHash');

  if (!pendingRegistration) {
    throw new AppError('Your verification session expired. Please create your account again.', 400, [
      {
        field: 'verificationCode',
        message: 'Your verification session expired. Please create your account again.'
      }
    ]);
  }

  if (!pendingRegistration.verificationCodeHash || !pendingRegistration.passwordHash) {
    if (pendingRegistration.completedAt) {
      const completedCodeHash = hashToken(verificationCode);

      if (completedCodeHash === pendingRegistration.verificationCodeHash) {
        return resolveCompletedRegistration(pendingRegistration, req);
      }
    }

    throw new AppError('Your verification session expired. Please request a new code.', 400, [
      {
        field: 'verificationCode',
        message: 'Your verification session expired. Please request a new code.'
      }
    ]);
  }

  if (
    !(pendingRegistration.verificationCodeExpiresAt instanceof Date) ||
    pendingRegistration.verificationCodeExpiresAt.getTime() <= Date.now()
  ) {
    throw new AppError('The verification code expired. Please request a new code.', 400, [
      {
        field: 'verificationCode',
        message: 'The verification code expired. Please request a new code.'
      }
    ]);
  }

  if (pendingRegistration.verificationAttempts >= env.registrationOtpMaxAttempts) {
    throw new AppError('Too many incorrect verification attempts. Please request a new code.', 429, [
      {
        field: 'verificationCode',
        message: 'Too many incorrect verification attempts. Please request a new code.'
      }
    ]);
  }

  const verificationCodeHash = hashToken(verificationCode);

  if (verificationCodeHash !== pendingRegistration.verificationCodeHash) {
    pendingRegistration.verificationAttempts += 1;
    await pendingRegistration.save({ validateModifiedOnly: true });

    throw new AppError('The verification code is incorrect. Please try again.', 400, [
      {
        field: 'verificationCode',
        message: 'The verification code is incorrect. Please try again.'
      }
    ]);
  }

  const userPayload = {
    fullName: pendingRegistration.fullName,
    email: pendingRegistration.email,
    password: pendingRegistration.passwordHash,
    role: pendingRegistration.role,
    program: pendingRegistration.program,
    department: pendingRegistration.department,
    semester: pendingRegistration.semester,
    enrollmentNo: pendingRegistration.enrollmentNo,
    employeeId: pendingRegistration.employeeId,
    phone: pendingRegistration.phone
  };

  await assertRegistrationAvailability(userPayload);

  let user = null;
  let createUserError = null;

  try {
    user = await User.create({
      fullName: pendingRegistration.fullName,
      email: pendingRegistration.email,
      password: pendingRegistration.passwordHash,
      role: pendingRegistration.role,
      program: pendingRegistration.program || undefined,
      department: pendingRegistration.department || undefined,
      semester: pendingRegistration.role === 'student' ? Number(pendingRegistration.semester) : undefined,
      enrollmentNo: pendingRegistration.role === 'student' ? pendingRegistration.enrollmentNo : undefined,
      employeeId: pendingRegistration.role === 'student' ? undefined : pendingRegistration.employeeId,
      phone: pendingRegistration.phone,
      emailVerified: true,
      emailVerifiedAt: new Date()
    });
  } catch (error) {
    createUserError = error;

    if (error?.code === 11000) {
      user = await User.findOne({ email: pendingRegistration.email }).select('+password');
    } else {
      throw error;
    }
  }

  if (!user) {
    if (createUserError) {
      throw createUserError;
    }

    throw new AppError('Unable to complete account creation right now. Please try again.', 500);
  }

  pendingRegistration.passwordHash = null;
  pendingRegistration.completedAt = new Date();
  pendingRegistration.userId = user._id;
  await pendingRegistration.save({ validateModifiedOnly: true });

  await logAction({
    actorId: user._id,
    resourceType: 'auth',
    resourceId: user._id,
    action: 'register',
    message: `${user.role} account registered`,
    metadata: {
      role: user.role,
      email: user.email,
      phone: user.phone,
      emailVerifiedAt: user.emailVerifiedAt?.toISOString?.() || null
    },
    requestMeta
  });

  return {
    message: 'Account created successfully.',
    token: createSessionToken(user, 'password'),
    user: pickUser(user, req),
    verification: {
      email: user.email,
      verifiedAt: user.emailVerifiedAt?.toISOString?.() || null
    }
  };
}

async function loginUser(payload, req, requestMeta) {
  const identifier = extractLoginIdentifier(payload);
  // Failed-login buckets are keyed to the account plus client fingerprint so one
  // noisy shared-Wi-Fi user does not block everyone else on the same network.
  await assertLoginFailureBucketsAreOpen(identifier, req);
  const user = await findUserByIdentifier(identifier);

  if (!user) {
    await recordFailedLoginAttempt(identifier, req);
    throw new AppError('Invalid credentials. Please check your ID and password and try again.', 401);
  }

  if (!user.isActive) {
    throw new AppError('Your account is inactive. Please contact administration.', 403);
  }

  if (user.emailVerified === false) {
    throw new AppError('Please verify your email before logging in.', 403, [
      {
        field: 'identifier',
        message: 'Please verify your email before logging in.'
      }
    ]);
  }

  const passwordMatches = await user.comparePassword(payload.password);

  if (!passwordMatches) {
    await recordFailedLoginAttempt(identifier, req);
    throw new AppError('Invalid credentials. Please check your ID and password and try again.', 401);
  }

  const normalizedRole = normalizeRole(user.role);
  if (normalizedRole) {
    user.role = normalizedRole;
  }

  const loginTimestamp = new Date();

  if (!isHashedPassword(user.password)) {
    user.password = payload.password;
    user.markModified('password');
    user.lastLoginAt = loginTimestamp;
    await user.save({ validateModifiedOnly: true });
  } else {
    user.lastLoginAt = loginTimestamp;
    await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: loginTimestamp } });
  }

  await clearFailedLoginAttempts(identifier, req);

  const token = createSessionToken(user, 'password');

  await logAction({
    actorId: user._id,
    resourceType: 'auth',
    resourceId: user._id,
    action: 'login',
    message: `${user.role} logged in`,
    requestMeta
  });

  return {
    token,
    user: pickUser(user, req)
  };
}

async function getCurrentUser(user, req, auth = {}) {
  const normalizedRole = normalizeRole(user.role) || user.role;
  return {
    authenticated: true,
    role: normalizedRole,
    user: pickUser(user, req),
    session: buildSessionPayload(auth)
  };
}

async function verifyAuthState(user, req, auth = {}) {
  const normalizedRole = normalizeRole(user.role) || user.role;
  return {
    authenticated: true,
    role: normalizedRole,
    user: pickUser(user, req),
    session: buildSessionPayload(auth)
  };
}

async function getWebAuthnRegistrationOptions(userId, payload, req, auth = {}) {
  ensureBiometricSetupAllowed(auth);

  const user = await User.findById(userId);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  const options = await generateRegistrationOptions({
    rpName: 'DwarPal',
    rpID: getWebAuthnRpId(req),
    userName: user.email,
    userDisplayName: user.fullName,
    userID: Buffer.from(user._id.toString(), 'utf8'),
    attestationType: 'none',
    excludeCredentials: mapUserDevices(user).map((device) => ({
      id: device.credentialId,
      transports: device.transports
    })),
    authenticatorSelection: {
      residentKey: 'required',
      userVerification: 'required',
      authenticatorAttachment: 'platform'
    },
    // Ed25519 is intentionally excluded for broader compatibility across current Node/browser stacks.
    supportedAlgorithmIDs: [-7, -257]
  });

  return {
    deviceName: normalizeDeviceName(payload?.deviceName, req),
    options
  };
}

async function verifyWebAuthnRegistration(userId, payload, req, flowState, requestMeta) {
  if (!flowState?.challenge || flowState?.userId !== userId.toString()) {
    throw new AppError('Biometric setup session is invalid. Please try again.', 401);
  }

  const user = await User.findById(userId);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  const verification = await verifyRegistrationResponse({
    response: payload.response,
    expectedChallenge: flowState.challenge,
    expectedOrigin: getExpectedOrigins(req),
    expectedRPID: getExpectedRpIds(req),
    requireUserVerification: true,
    supportedAlgorithmIDs: [-7, -257]
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new AppError('Biometric setup could not be verified. Please try again.', 400);
  }

  const { credential, credentialBackedUp, credentialDeviceType } = verification.registrationInfo;
  const credentialId = credential.id;

  if (user.webAuthnCredentials.some((item) => item.credentialId === credentialId)) {
    throw new AppError('This biometric credential is already registered on your account.', 409);
  }

  user.webAuthnCredentials.push({
    credentialId,
    publicKey: Buffer.from(credential.publicKey),
    counter: credential.counter,
    transports: credential.transports || [],
    deviceType: credentialDeviceType,
    backedUp: credentialBackedUp,
    deviceName: normalizeDeviceName(payload?.deviceName, req),
    lastUsedAt: new Date()
  });
  await user.save();

  const createdCredential = user.webAuthnCredentials[user.webAuthnCredentials.length - 1];

  await logAction({
    actorId: user._id,
    resourceType: 'auth',
    resourceId: user._id,
    action: 'register_biometric_device',
    message: `Biometric login enabled on ${createdCredential.deviceName}`,
    metadata: {
      deviceId: createdCredential._id.toString(),
      credentialId
    },
    requestMeta
  });

  return {
    deviceId: createdCredential._id.toString(),
    devices: mapUserDevices(user),
    user: pickUser(user, req)
  };
}

async function getWebAuthnAuthenticationOptions(payload, req) {
  const identifier = extractLoginIdentifier(payload);
  const user = await findUserByIdentifier(identifier);

  if (!user) {
    throw new AppError('No account was found for that enrollment number, employee ID, or email.', 404);
  }

  if (!user.isActive) {
    throw new AppError('Your account is inactive. Please contact administration.', 403);
  }

  if (!Array.isArray(user.webAuthnCredentials) || user.webAuthnCredentials.length === 0) {
    throw new AppError(
      'No biometric credential found for this account on this device. Please login manually and enable it first.',
      404
    );
  }

  const options = await generateAuthenticationOptions({
    rpID: getWebAuthnRpId(req),
    allowCredentials: mapUserDevices(user).map((device) => ({
      id: device.credentialId,
      transports: device.transports
    })),
    userVerification: 'required'
  });

  return {
    options,
    userId: user._id.toString()
  };
}

async function verifyWebAuthnAuthentication(payload, req, flowState, requestMeta) {
  if (!flowState?.challenge || !flowState?.userId) {
    throw new AppError('Biometric login session is invalid. Please try again.', 401);
  }

  const user = await User.findById(flowState.userId);

  if (!user) {
    throw new AppError('Account not found for this biometric login attempt.', 404);
  }

  if (!user.isActive) {
    throw new AppError('Your account is inactive. Please contact administration.', 403);
  }

  const responseCredentialId = String(payload?.response?.id || '').trim();
  const credential = user.webAuthnCredentials.find((item) => item.credentialId === responseCredentialId);

  if (!credential) {
    throw new AppError(
      'No biometric credential found for this account on this device. Please use manual login instead.',
      404
    );
  }

  const verification = await verifyAuthenticationResponse({
    response: payload.response,
    expectedChallenge: flowState.challenge,
    expectedOrigin: getExpectedOrigins(req),
    expectedRPID: getExpectedRpIds(req),
    credential: {
      id: credential.credentialId,
      publicKey: getCredentialPublicKeyBuffer(credential.publicKey),
      counter: credential.counter,
      transports: credential.transports || []
    },
    requireUserVerification: true
  });

  if (!verification.verified) {
    throw new AppError('Biometric verification failed. Please try again or use manual login.', 401);
  }

  credential.counter = verification.authenticationInfo.newCounter;
  credential.lastUsedAt = new Date();
  credential.deviceType = verification.authenticationInfo.credentialDeviceType || credential.deviceType;
  credential.backedUp = verification.authenticationInfo.credentialBackedUp;
  user.lastLoginAt = new Date();
  await user.save();

  const token = createSessionToken(user, 'webauthn');

  await logAction({
    actorId: user._id,
    resourceType: 'auth',
    resourceId: user._id,
    action: 'login_biometric',
    message: `${user.role} logged in with biometrics`,
    metadata: {
      deviceId: credential._id.toString(),
      credentialId: credential.credentialId
    },
    requestMeta
  });

  return {
    deviceId: credential._id.toString(),
    devices: mapUserDevices(user),
    token,
    user: pickUser(user, req)
  };
}

async function getWebAuthnDevices(userId) {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  return {
    devices: mapUserDevices(user),
    hasBiometricCredentials: Boolean(user.hasBiometricCredentials)
  };
}

async function removeWebAuthnDevice(userId, deviceId, requestMeta) {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  const device = user.webAuthnCredentials.id(deviceId);

  if (!device) {
    throw new AppError('Biometric device not found for this account.', 404);
  }

  const removedDeviceName = device.deviceName || 'Current device';
  device.deleteOne();
  await user.save();

  await logAction({
    actorId: user._id,
    resourceType: 'auth',
    resourceId: user._id,
    action: 'remove_biometric_device',
    message: `Biometric login removed from ${removedDeviceName}`,
    metadata: {
      deviceId
    },
    requestMeta
  });

  return {
    devices: mapUserDevices(user),
    hasBiometricCredentials: Boolean(user.hasBiometricCredentials),
    removedDeviceId: deviceId
  };
}

async function changePassword(userId, payload, requestMeta) {
  const user = await User.findById(userId).select('+password');

  if (!user) {
    throw new AppError('User not found', 404);
  }

  const currentPasswordMatches = await user.comparePassword(payload.currentPassword);

  if (!currentPasswordMatches) {
    throw new AppError('Current password is incorrect', 400);
  }

  if (!PASSWORD_REGEX.test(payload.newPassword)) {
    throw new AppError(
      'New password must be at least 8 characters and include uppercase, lowercase, number, and special character',
      400
    );
  }

  user.password = payload.newPassword;
  await user.save();

  await logAction({
    actorId: user._id,
    resourceType: 'auth',
    resourceId: user._id,
    action: 'change_password',
    message: 'Password changed successfully',
    requestMeta
  });

  return {
    message: 'Password changed successfully'
  };
}

async function forgotPassword(payload, requestMeta) {
  const normalizedEmail = String(payload.email || '').trim().toLowerCase();

  const user = await User.findOne({ email: normalizedEmail }).select(
    '+passwordResetToken +passwordResetExpiresAt'
  );

  if (!user) {
    throw new AppError('No account was found for this email address.', 404, [
      {
        field: 'email',
        message: 'No account was found for this email address.'
      }
    ]);
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = hashToken(resetToken);
  const passwordResetExpiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS);
  const resetUrl = buildPasswordResetUrl(resetToken, user.email);

  user.passwordResetToken = hashedToken;
  user.passwordResetExpiresAt = passwordResetExpiresAt;
  await user.save({ validateModifiedOnly: true });

  try {
    await sendPasswordResetEmail({
      to: user.email,
      fullName: user.fullName,
      resetUrl,
      expiresInMinutes: env.passwordResetTokenExpiresMinutes
    });
  } catch (error) {
    user.passwordResetToken = null;
    user.passwordResetExpiresAt = null;
    await user.save({ validateModifiedOnly: true });
    throw error;
  }

  await logAction({
    actorId: user._id,
    resourceType: 'auth',
    resourceId: user._id,
    action: 'forgot_password',
    message: 'Password reset token generated',
    requestMeta
  });

  return {
    message: 'We sent you a password reset email.'
  };
}

async function resetPassword(payload, requestMeta) {
  const hashedToken = hashToken(payload.token);

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpiresAt: { $gt: new Date() }
  }).select('+passwordResetToken +passwordResetExpiresAt');

  if (!user) {
    throw new AppError('Reset link is invalid or has expired.', 400, [
      {
        field: 'token',
        message: 'Reset link is invalid or has expired.'
      }
    ]);
  }

  user.password = payload.newPassword;
  await user.save();

  user.passwordResetToken = null;
  user.passwordResetExpiresAt = null;
  await user.save({ validateModifiedOnly: true });

  await logAction({
    actorId: user._id,
    resourceType: 'auth',
    resourceId: user._id,
    action: 'reset_password',
    message: 'Password reset completed',
    requestMeta
  });

  return {
    message: 'Password reset successfully. You can now log in with your new password.'
  };
}

module.exports = {
  buildSessionPayload,
  checkRegistrationAvailability,
  changePassword,
  forgotPassword,
  getCurrentUser,
  getWebAuthnAuthenticationOptions,
  getWebAuthnDevices,
  getWebAuthnRegistrationOptions,
  loginUser,
  removeWebAuthnDevice,
  resetPassword,
  sendRegistrationVerificationCode,
  verifyAuthState,
  verifyRegistrationEmail,
  verifyWebAuthnAuthentication,
  verifyWebAuthnRegistration
};
