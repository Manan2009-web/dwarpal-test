const {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse
} = require('@simplewebauthn/server');
const env = require('../config/env');
const User = require('../models/User');
const AppError = require('../utils/appError');
const pickUser = require('../utils/pickUser');
const { createAccessToken } = require('../utils/token');
const { getClientFingerprint } = require('../utils/request');
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
  return normalizeIdentifier(payload.identifier || payload.enrollment || payload.employeeId);
}

function normalizeRateLimitIdentifier(identifier) {
  return normalizeIdentifier(identifier).toLowerCase();
}

function isEmailStyleIdentifier(identifier) {
  return normalizeIdentifier(identifier).includes('@');
}

function isHashedPassword(value) {
  return BCRYPT_HASH_REGEX.test(String(value || ''));
}

function getElapsedMs(startAt) {
  return Math.max(Date.now() - Number(startAt || 0), 0);
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
  const ignoredUserId = payload?.ignoreUserId ? String(payload.ignoreUserId) : '';
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

  // --- DEBUG LOGS (requested) ---
  const mongoose = require('mongoose');
  console.log('[register-debug] Database:', mongoose.connection.name);
  console.log('[register-debug] Collection:', User.collection.name);
  console.log('[register-debug] Email Query:', normalizedPayload.email);
  console.log('[register-debug] Phone Query:', normalizedPayload.phone);
  console.log('[register-debug] Employee Query:', normalizedPayload.employeeId);
  // --- END DEBUG LOGS ---

  const existingUsers = await User.find({ $or: duplicateLookup }).select('_id email phone enrollmentNo enrollment employeeId').lean();
  const errors = [];
  const conflictingUsers = existingUsers.filter((user) => String(user?._id || '') !== ignoredUserId);

  console.log('[register-debug] Existing User(s) found:', JSON.stringify(conflictingUsers));

  if (normalizedPayload.email && conflictingUsers.some((user) => user.email === normalizedPayload.email)) {
    errors.push(buildFieldError('email', DUPLICATE_REGISTRATION_MESSAGES.email));
  }

  if (normalizedPayload.phone && conflictingUsers.some((user) => user.phone === normalizedPayload.phone)) {
    errors.push(buildFieldError('phone', DUPLICATE_REGISTRATION_MESSAGES.phone));
  }

  if (
    normalizedPayload.role === 'student' &&
    normalizedPayload.enrollmentNo &&
    conflictingUsers.some(
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
    conflictingUsers.some((user) => user.employeeId === normalizedPayload.employeeId)
  ) {
    errors.push(buildFieldError('employeeId', DUPLICATE_REGISTRATION_MESSAGES.employeeId));
  }

  return errors;
}

async function assertRegistrationAvailability(payload = {}, options = {}) {
  const conflictErrors = await collectRegistrationConflictErrors({
    ...payload,
    ignoreUserId: options.ignoreUserId || null
  });

  if (conflictErrors.length) {
    throw new AppError(conflictErrors[0].message, 409, conflictErrors);
  }
}

function applyRegistrationDetailsToUser(user, normalizedPayload) {
  user.fullName = normalizedPayload.fullName;
  user.email = normalizedPayload.email;
  user.password = normalizedPayload.password;
  user.role = normalizedPayload.role;

  // FIX: principal and admin also require a program — previously they were
  // incorrectly excluded here, which caused the Mongoose required-validator to
  // fire "Program is required" even when the user had selected one in the UI.
  const rolesWithProgram = ['student', 'hod', 'principal', 'admin'];
  user.program = rolesWithProgram.includes(normalizedPayload.role) ? normalizedPayload.program : undefined;

  user.department = normalizedPayload.role === 'security' ? undefined : normalizedPayload.department;
  user.semester = normalizedPayload.role === 'student' ? Number(normalizedPayload.semester) : undefined;
  user.enrollmentNo = normalizedPayload.role === 'student' ? normalizedPayload.enrollmentNo : undefined;
  user.enrollment = normalizedPayload.role === 'student' ? normalizedPayload.enrollmentNo : undefined;
  user.employeeId = normalizedPayload.role === 'student' ? undefined : normalizedPayload.employeeId;
  user.phone = normalizedPayload.phone;
  // TEMP_DISABLED_OTP
  user.emailVerified = true;
  user.isEmailVerified = true;
  user.emailVerifiedAt = user.emailVerifiedAt || new Date();
  user.pendingEmail = null;
  user.emailVerificationOtpHash = null;
  user.emailVerificationOtpExpiresAt = null;
  user.emailVerificationOtpSentAt = null;
  user.emailVerificationOtpAttempts = 0;
  user.emailVerificationOtpResendCount = 0;

  return user;
}

async function registerUser(payload, req, requestMeta) {
  const requestStartedAt = Date.now();
  const normalizedPayload = normalizeRegistrationPayload(payload);
  const normalizedRole = normalizedPayload.role;

  console.info('[auth-service] registerUser route entered', {
    email: normalizedPayload.email,
    role: normalizedRole
  });

  if (!PUBLIC_REGISTRATION_ROLES.includes(normalizedRole)) {
    throw new AppError('Only supported roles can register through this endpoint', 403);
  }

  if (!normalizedPayload.phone) {
    throw createFieldErrorResponse('phone', 'Please enter a valid phone number.');
  }

  await assertRegistrationAvailability(normalizedPayload);

  const user = applyRegistrationDetailsToUser(new User(), normalizedPayload);
  await user.save();

  await logAction({
    actorId: user._id,
    resourceType: 'auth',
    resourceId: user._id,
    action: 'register',
    message: 'Account created successfully',
    metadata: {
      email: user.email,
      role: user.role
    },
    requestMeta
  });

  console.info('[auth-service] registerUser route completed', {
    email: user.email,
    totalMs: getElapsedMs(requestStartedAt)
  });

  return {
    statusCode: 201,
    message: 'Account created successfully. You can sign in now.',
    email: user.email,
    user: pickUser(user, req)
  };
}

async function findUserByIdentifier(identifier, selection = '+password') {
  const normalizedIdentifier = String(identifier || '').trim();

  if (!normalizedIdentifier) {
    return null;
  }

  const cleanEmployeeId = normalizedIdentifier.toUpperCase();

  return User.findOne({
    $or: [
      { enrollmentNo: normalizedIdentifier },
      { enrollment: normalizedIdentifier },
      { employeeId: cleanEmployeeId }
    ]
  }).select(selection);
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
  const message = `Too many failed sign-in attempts for this account. Please wait ${formatRetryWindow(retryAfterSeconds)} before trying again.`;

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

async function loginUser(payload, req, requestMeta) {
  const identifier = extractLoginIdentifier(payload);

  if (isEmailStyleIdentifier(identifier)) {
    throw createFieldErrorResponse(
      'identifier',
      'Email login is not allowed. Use your enrollment number or employee ID.',
      400
    );
  }

  // Failed-login buckets are keyed to the account plus client fingerprint so one
  // noisy shared-Wi-Fi user does not block everyone else on the same network.
  await assertLoginFailureBucketsAreOpen(identifier, req);
  const user = await findUserByIdentifier(identifier);

  if (!user) {
    await recordFailedLoginAttempt(identifier, req);
    throw new AppError(
      'Invalid credentials. Please check your enrollment number or employee ID and password and try again.',
      401
    );
  }

  if (!user.isActive) {
    throw new AppError('Your account is inactive. Please contact administration.', 403);
  }

  const passwordMatches = await user.comparePassword(payload.password);

  if (!passwordMatches) {
    await recordFailedLoginAttempt(identifier, req);
    throw new AppError(
      'Invalid credentials. Please check your enrollment number or employee ID and password and try again.',
      401
    );
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

  if (isEmailStyleIdentifier(identifier)) {
    throw createFieldErrorResponse(
      'identifier',
      'Use your enrollment number or employee ID for biometric login.',
      400
    );
  }

  const user = await findUserByIdentifier(identifier);

  if (!user) {
    throw new AppError('No account was found for that enrollment number or employee ID.', 404);
  }

  if (!user.isActive) {
    throw new AppError('Your account is inactive. Please contact administration.', 403);
  }

  if (normalizeRole(user.role) === 'student') {
    throw new AppError(
      'Student biometric login is not available. Please use Student Access with email OTP.',
      403
    );
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

  if (normalizeRole(user.role) === 'student') {
    throw new AppError(
      'Student biometric login is not available. Please use Student Access with email OTP.',
      403
    );
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

module.exports = {
  buildSessionPayload,
  checkRegistrationAvailability,
  changePassword,
  findUserByIdentifier,
  getCurrentUser,
  getWebAuthnAuthenticationOptions,
  getWebAuthnDevices,
  getWebAuthnRegistrationOptions,
  loginUser,
  registerUser,
  removeWebAuthnDevice,
  verifyAuthState,
  verifyWebAuthnAuthentication,
  verifyWebAuthnRegistration
};
