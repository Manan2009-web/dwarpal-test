const crypto = require('crypto');
const {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse
} = require('@simplewebauthn/server');
const User = require('../models/User');
const AppError = require('../utils/appError');
const pickUser = require('../utils/pickUser');
const { createAccessToken } = require('../utils/token');
const { logAction } = require('./auditService');
const {
  PASSWORD_REGEX,
  PUBLIC_REGISTRATION_ROLES,
  normalizeRole
} = require('../constants/appConstants');
const {
  getExpectedOrigins,
  getExpectedRpIds,
  getWebAuthnRpId,
  mapWebAuthnDevice,
  normalizeDeviceName
} = require('../utils/webauthn');

const BCRYPT_HASH_REGEX = /^\$2[aby]\$\d{2}\$/;

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

function isHashedPassword(value) {
  return BCRYPT_HASH_REGEX.test(String(value || ''));
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

async function registerUser(payload, req, requestMeta) {
  const normalizedRole = normalizeRole(payload.role);

  if (!PUBLIC_REGISTRATION_ROLES.includes(normalizedRole)) {
    throw new AppError('Only supported roles can register through this endpoint', 403);
  }

  const existingEmail = await User.findOne({ email: payload.email.toLowerCase() });

  if (existingEmail) {
    throw new AppError('Email is already registered', 409);
  }

  if (normalizedRole === 'student' && payload.enrollmentNo) {
    const normalizedEnrollment = payload.enrollmentNo.trim();
    const existingEnrollment = await User.findOne({
      $or: [{ enrollmentNo: normalizedEnrollment }, { enrollment: normalizedEnrollment }]
    });

    if (existingEnrollment) {
      throw new AppError('Enrollment number is already registered', 409);
    }
  }

  if (normalizedRole !== 'student' && payload.employeeId) {
    const existingEmployee = await User.findOne({ employeeId: payload.employeeId.trim().toUpperCase() });

    if (existingEmployee) {
      throw new AppError('Employee ID is already registered', 409);
    }
  }

  const user = await User.create({
    fullName: payload.fullName,
    email: payload.email.toLowerCase(),
    password: payload.password,
    role: normalizedRole,
    department: payload.department,
    semester: normalizedRole === 'student' ? Number(payload.semester) : undefined,
    enrollmentNo: normalizedRole === 'student' ? payload.enrollmentNo.trim() : undefined,
    employeeId: normalizedRole !== 'student' ? payload.employeeId.trim().toUpperCase() : undefined,
    phone: payload.phone
  });

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
  const user = await findUserByIdentifier(identifier);

  if (!user) {
    throw new AppError('Invalid credentials', 401);
  }

  if (!user.isActive) {
    throw new AppError('Your account is inactive. Please contact administration.', 403);
  }

  const passwordMatches = await user.comparePassword(payload.password);

  if (!passwordMatches) {
    throw new AppError('Invalid credentials', 401);
  }

  const normalizedRole = normalizeRole(user.role);
  if (normalizedRole) {
    user.role = normalizedRole;
  }

  if (!isHashedPassword(user.password)) {
    user.password = payload.password;
    user.markModified('password');
  }

  user.lastLoginAt = new Date();
  await user.save();

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
  const user = await User.findOne({ email: payload.email.toLowerCase() }).select(
    '+passwordResetToken +passwordResetExpiresAt'
  );

  if (!user) {
    return {
      message: 'If the email exists, a reset instruction has been prepared.',
      resetToken: null
    };
  }

  const resetToken = crypto.randomBytes(20).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

  user.passwordResetToken = hashedToken;
  user.passwordResetExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
  await user.save();

  await logAction({
    actorId: user._id,
    resourceType: 'auth',
    resourceId: user._id,
    action: 'forgot_password',
    message: 'Password reset token generated',
    requestMeta
  });

  return {
    message:
      process.env.NODE_ENV === 'production'
        ? 'Reset workflow placeholder created. Connect your email service to deliver this token.'
        : 'Reset workflow placeholder created. Use the returned token in Postman or local testing.',
    resetToken: process.env.NODE_ENV === 'production' ? null : resetToken
  };
}

async function resetPassword(payload, requestMeta) {
  const hashedToken = crypto.createHash('sha256').update(payload.token).digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpiresAt: { $gt: new Date() }
  }).select('+passwordResetToken +passwordResetExpiresAt');

  if (!user) {
    throw new AppError('Reset token is invalid or has expired', 400);
  }

  user.password = payload.newPassword;
  user.passwordResetToken = null;
  user.passwordResetExpiresAt = null;
  await user.save();

  await logAction({
    actorId: user._id,
    resourceType: 'auth',
    resourceId: user._id,
    action: 'reset_password',
    message: 'Password reset completed',
    requestMeta
  });

  return {
    message: 'Password reset successfully'
  };
}

module.exports = {
  buildSessionPayload,
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
  verifyAuthState,
  verifyWebAuthnAuthentication,
  verifyWebAuthnRegistration
};
