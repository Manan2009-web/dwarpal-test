const crypto = require('crypto');
const {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse
} = require('@simplewebauthn/server');
const env = require('../config/env');
const User = require('../models/User');
const PhoneVerificationSession = require('../models/PhoneVerificationSession');
const AppError = require('../utils/appError');
const pickUser = require('../utils/pickUser');
const { createAccessToken } = require('../utils/token');
const { getClientFingerprint } = require('../utils/request');
const { getFirebaseAdminAuth, isFirebaseAdminConfigured } = require('../config/firebaseAdmin');
const { sendPasswordResetEmail } = require('./emailService');
const { sendPhoneVerificationOtp, verifyPhoneVerificationOtp } = require('./smsService');
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
const REGISTRATION_PHONE_VERIFICATION_PURPOSE = 'registration';
const PHONE_OTP_CODE_TTL_MS = env.phoneOtpCodeExpiresMinutes * 60 * 1000;
const PHONE_VERIFICATION_TOKEN_TTL_MS = env.phoneOtpVerificationTokenTtlMinutes * 60 * 1000;
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
    password: payload.password,
    firebaseUid: String(payload.firebaseUid || '').trim(),
    phoneVerificationToken: String(payload.phoneVerificationToken || '').trim()
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

async function syncFirebasePassword(user, newPassword) {
  const firebaseAdminAuth = getFirebaseAdminAuth();

  if (!firebaseAdminAuth) {
    throw new AppError(
      'Firebase Admin is not configured. Add service account credentials before using password reset.',
      503
    );
  }

  try {
    if (user.firebaseUid) {
      try {
        const firebaseUser = await firebaseAdminAuth.updateUser(user.firebaseUid, {
          password: newPassword
        });

        return {
          uid: firebaseUser.uid
        };
      } catch (error) {
        if (error?.code !== 'auth/user-not-found') {
          throw error;
        }
      }
    }

    try {
      const existingFirebaseUser = await firebaseAdminAuth.getUserByEmail(user.email);
      const updatedFirebaseUser = await firebaseAdminAuth.updateUser(existingFirebaseUser.uid, {
        password: newPassword
      });

      return {
        uid: updatedFirebaseUser.uid
      };
    } catch (error) {
      if (error?.code !== 'auth/user-not-found') {
        throw error;
      }
    }

    const createdFirebaseUser = await firebaseAdminAuth.createUser({
      email: user.email,
      password: newPassword,
      displayName: user.fullName || undefined
    });

    return {
      uid: createdFirebaseUser.uid
    };
  } catch (error) {
    throw new AppError(
      error?.message || 'Unable to synchronize the new password with Firebase. Please try the reset link again.',
      502
    );
  }
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

async function sendRegistrationOtp(payload, requestMeta) {
  const normalizedPayload = normalizeRegistrationPayload(payload);
  const now = Date.now();

  if (!normalizedPayload.phone) {
    throw createFieldErrorResponse('phone', 'Please enter a valid phone number.');
  }

  await assertRegistrationAvailability(normalizedPayload);

  const existingSession = await PhoneVerificationSession.findOne({
    phone: normalizedPayload.phone,
    purpose: REGISTRATION_PHONE_VERIFICATION_PURPOSE
  }).select('+verificationTokenHash +verificationTokenExpiresAt');

  const cooldownMs = env.phoneOtpResendCooldownSeconds * 1000;
  const retryAfterSeconds =
    existingSession?.lastSentAt instanceof Date
      ? Math.ceil((existingSession.lastSentAt.getTime() + cooldownMs - now) / 1000)
      : 0;

  if (retryAfterSeconds > 0) {
    const message = `Please wait ${retryAfterSeconds} seconds before requesting another OTP.`;
    throw createRateLimitError({
      message,
      retryAfterSeconds,
      code: 'AUTH_PHONE_OTP_COOLDOWN',
      errors: [buildFieldError('phone', message)],
      rateLimit: {
        scope: 'auth:phone-otp:cooldown',
        resetAt: new Date(now + retryAfterSeconds * 1000).toISOString()
      }
    });
  }

  const otpDelivery = await sendPhoneVerificationOtp(normalizedPayload.phone);
  const resendCount = existingSession?.resendCount ? existingSession.resendCount + 1 : 0;
  const lastSentAt = new Date(now);
  const expiresAt = new Date(now + PHONE_OTP_CODE_TTL_MS);

  await PhoneVerificationSession.findOneAndUpdate(
    {
      phone: normalizedPayload.phone,
      purpose: REGISTRATION_PHONE_VERIFICATION_PURPOSE
    },
    {
      $set: {
        phone: normalizedPayload.phone,
        purpose: REGISTRATION_PHONE_VERIFICATION_PURPOSE,
        provider: 'twilio-verify',
        providerSid: String(otpDelivery?.sid || existingSession?.providerSid || '').trim(),
        status: 'pending',
        resendCount,
        lastSentAt,
        verifiedAt: null,
        consumedAt: null,
        expiresAt,
        verificationTokenHash: null,
        verificationTokenExpiresAt: null
      }
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }
  );

  await logAction({
    resourceType: 'auth',
    action: 'send_registration_phone_otp',
    message: 'Registration phone OTP sent',
    metadata: {
      phone: normalizedPayload.phone
    },
    requestMeta
  });

  return {
    message: 'OTP sent successfully.',
    phone: normalizedPayload.phone,
    resendAvailableAt: new Date(now + cooldownMs).toISOString(),
    expiresAt: expiresAt.toISOString()
  };
}

async function verifyRegistrationOtp(payload, requestMeta) {
  const normalizedPhone = normalizePhoneNumber(payload.phone, {
    defaultCountryCode: env.defaultPhoneCountryCode
  });

  if (!normalizedPhone) {
    throw createFieldErrorResponse('phone', 'Please enter a valid phone number.');
  }

  await assertRegistrationAvailability({ phone: normalizedPhone });

  const session = await PhoneVerificationSession.findOne({
    phone: normalizedPhone,
    purpose: REGISTRATION_PHONE_VERIFICATION_PURPOSE
  }).select('+verificationTokenHash +verificationTokenExpiresAt');

  if (!session) {
    throw createFieldErrorResponse('otp', 'Please request a new OTP before verifying this phone number.');
  }

  if (session.expiresAt && session.expiresAt.getTime() <= Date.now()) {
    session.status = 'expired';
    await session.save();
    throw createFieldErrorResponse('otp', 'OTP has expired. Please request a new OTP.');
  }

  const verificationResult = await verifyPhoneVerificationOtp(normalizedPhone, payload.otp);
  const verificationStatus = String(verificationResult?.status || '').trim().toLowerCase();
  const isApproved = verificationResult?.valid === true || verificationStatus === 'approved';

  if (!isApproved) {
    if (verificationStatus === 'expired' || verificationStatus === 'canceled') {
      session.status = 'expired';
      await session.save();
      throw createFieldErrorResponse('otp', 'OTP has expired. Please request a new OTP.');
    }

    throw createFieldErrorResponse('otp', 'The OTP you entered is invalid. Please try again.');
  }

  const phoneVerificationToken = crypto.randomBytes(32).toString('hex');

  session.status = 'verified';
  session.providerSid = String(verificationResult?.sid || session.providerSid || '').trim();
  session.verifiedAt = new Date();
  session.consumedAt = null;
  session.verificationTokenHash = hashToken(phoneVerificationToken);
  session.verificationTokenExpiresAt = new Date(Date.now() + PHONE_VERIFICATION_TOKEN_TTL_MS);
  session.expiresAt = session.verificationTokenExpiresAt;
  await session.save();

  await logAction({
    resourceType: 'auth',
    action: 'verify_registration_phone_otp',
    message: 'Registration phone OTP verified',
    metadata: {
      phone: normalizedPhone
    },
    requestMeta
  });

  return {
    message: 'Phone number verified successfully.',
    phone: normalizedPhone,
    phoneVerificationToken,
    verifiedUntil: session.verificationTokenExpiresAt.toISOString()
  };
}

async function registerUser(payload, req, requestMeta) {
  const normalizedPayload = normalizeRegistrationPayload(payload);
  const normalizedRole = normalizedPayload.role;
  const normalizedEmail = normalizedPayload.email;
  const normalizedEnrollment = normalizedPayload.enrollmentNo;
  const normalizedEmployeeId = normalizedPayload.employeeId;
  const normalizedPhone = normalizedPayload.phone;

  if (!PUBLIC_REGISTRATION_ROLES.includes(normalizedRole)) {
    throw new AppError('Only supported roles can register through this endpoint', 403);
  }

  await assertRegistrationAvailability(normalizedPayload);

  if (!normalizedPhone) {
    throw createFieldErrorResponse('phone', 'Please enter a valid phone number.');
  }

  if (!normalizedPayload.phoneVerificationToken) {
    throw createFieldErrorResponse('phone', 'Please verify your phone number before creating your account.');
  }

  const verificationSession = await PhoneVerificationSession.findOne({
    phone: normalizedPhone,
    purpose: REGISTRATION_PHONE_VERIFICATION_PURPOSE,
    status: 'verified',
    verificationTokenHash: hashToken(normalizedPayload.phoneVerificationToken),
    verificationTokenExpiresAt: { $gt: new Date() },
    consumedAt: null
  }).select('+verificationTokenHash +verificationTokenExpiresAt');

  if (!verificationSession) {
    throw createFieldErrorResponse('phone', 'Phone verification is missing or expired. Please verify your number again.');
  }

  const user = await User.create({
    fullName: normalizedPayload.fullName,
    email: normalizedEmail,
    firebaseUid: normalizedPayload.firebaseUid || undefined,
    password: normalizedPayload.password,
    role: normalizedRole,
    program: ['student', 'hod'].includes(normalizedRole) ? normalizedPayload.program : undefined,
    department: normalizedPayload.department,
    semester: normalizedRole === 'student' ? Number(normalizedPayload.semester) : undefined,
    enrollmentNo: normalizedRole === 'student' ? normalizedEnrollment : undefined,
    employeeId: normalizedRole !== 'student' ? normalizedEmployeeId : undefined,
    phone: normalizedPhone
  });

  verificationSession.status = 'consumed';
  verificationSession.consumedAt = new Date();
  await verificationSession.save();

  await logAction({
    actorId: user._id,
    resourceType: 'auth',
    resourceId: user._id,
    action: 'register',
    message: `${user.role} account registered`,
    metadata: {
      role: user.role,
      email: user.email
    },
    requestMeta
  });

  return {
    user: pickUser(user, req)
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

  if (!isFirebaseAdminConfigured()) {
    throw new AppError(
      'Firebase Admin is not configured. Add service account credentials before using forgot password.',
      503
    );
  }

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

  let firebaseSyncResult = null;

  try {
    firebaseSyncResult = await syncFirebasePassword(user, payload.newPassword);
  } catch (error) {
    throw new AppError(
      `${error.message} Your reset link is still active, so please try the same link again after fixing the Firebase configuration.`,
      error.statusCode || 502
    );
  }

  if (firebaseSyncResult?.uid && user.firebaseUid !== firebaseSyncResult.uid) {
    user.firebaseUid = firebaseSyncResult.uid;
  }

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
  registerUser,
  resetPassword,
  sendRegistrationOtp,
  verifyAuthState,
  verifyRegistrationOtp,
  verifyWebAuthnAuthentication,
  verifyWebAuthnRegistration
};
