const bcrypt = require('bcryptjs');
const env = require('../config/env');
const User = require('../models/User');
const PendingRegistration = require('../models/PendingRegistration');
const AppError = require('../utils/appError');
const authService = require('./authService');
const { logAction } = require('./auditService');
const { sendVerificationOtpEmail, sendStaffWelcomeEmail } = require('./emailService');
const {
  compareOtpHash,
  generateOtp,
  getOtpExpiryDate,
  getRemainingSecondsUntil,
  hashOtp,
  isOtpExpired,
  normalizeEmail,
  normalizeOtp
} = require('./otpService');
const {
  PUBLIC_REGISTRATION_ROLES,
  normalizeDepartment,
  normalizeProgram,
  normalizeRole
} = require('../constants/appConstants');
const { normalizePhoneNumber } = require('../utils/phone');

function buildFieldError(field, message) {
  return [{ field, message }];
}

function createFieldError(message, field = 'field', statusCode = 422) {
  return new AppError(message, statusCode, buildFieldError(field, message));
}

function normalizeRegistrationPayload(payload = {}) {
  const normalizedRole = normalizeRole(payload.role);

  return {
    fullName: String(payload.fullName || payload.name || '').trim(),
    email: normalizeEmail(payload.email),
    password: String(payload.password || ''),
    role: normalizedRole,
    program: payload.program ? normalizeProgram(payload.program) : null,
    department: payload.department ? normalizeDepartment(payload.department) || String(payload.department).trim() : null,
    semester: normalizedRole === 'student' ? Number(payload.semester || 0) || null : null,
    enrollmentNo:
      normalizedRole === 'student'
        ? String(payload.enrollmentNo || payload.enrollment || '').trim()
        : null,
    employeeId:
      normalizedRole && normalizedRole !== 'student'
        ? String(payload.employeeId || '').trim().toUpperCase()
        : null,
    phone: normalizePhoneNumber(payload.phone, {
      defaultCountryCode: env.defaultPhoneCountryCode
    })
  };
}

function createRetryAfterError(message, field, retryAfterSeconds) {
  const error = new AppError(message, 429, buildFieldError(field, message));
  error.retryAfterSeconds = retryAfterSeconds;
  return error;
}

async function restorePendingRegistrationSnapshot(email, snapshot) {
  if (snapshot?._id) {
    await PendingRegistration.replaceOne({ _id: snapshot._id }, snapshot, { upsert: true });
    return;
  }

  await PendingRegistration.deleteOne({ email });
}

async function startRegistration(payload) {
  const normalizedPayload = normalizeRegistrationPayload(payload);

  if (!PUBLIC_REGISTRATION_ROLES.includes(normalizedPayload.role)) {
    throw new AppError('Only supported roles can register through this endpoint', 403);
  }

  if (!normalizedPayload.phone) {
    throw createFieldError('Please enter a valid phone number.', 'phone');
  }

  await authService.checkRegistrationAvailability(normalizedPayload);

  const otp = generateOtp();
  const otpExpiresAt = getOtpExpiryDate(env.registerOtpExpiryMinutes);
  const lastOtpSentAt = new Date();
  const passwordHash = await bcrypt.hash(normalizedPayload.password, env.bcryptSaltRounds);
  const previousPendingRegistration = await PendingRegistration.findOne({
    email: normalizedPayload.email
  }).lean();

  await PendingRegistration.findOneAndUpdate(
    {
      email: normalizedPayload.email
    },
    {
      $set: {
        ...normalizedPayload,
        passwordHash,
        otpHash: hashOtp(normalizedPayload.email, otp),
        otpExpiresAt,
        lastOtpSentAt,
        resendCount: 0,
        verifyAttempts: 0
      }
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }
  );

  try {
    await sendVerificationOtpEmail({
      email: normalizedPayload.email,
      name: normalizedPayload.fullName,
      otp,
      expiryMinutes: env.registerOtpExpiryMinutes
    });
  } catch (error) {
    await restorePendingRegistrationSnapshot(normalizedPayload.email, previousPendingRegistration);
    throw error;
  }

  return {
    email: normalizedPayload.email,
    expiresInSeconds: env.registerOtpExpiryMinutes * 60,
    cooldownSeconds: env.registerOtpResendCooldownSeconds,
    message: 'Verification OTP sent successfully. Enter the code to finish creating your account.'
  };
}

async function verifyRegistrationOtp(payload, requestMeta = {}) {
  const email = normalizeEmail(payload.email);
  const otp = normalizeOtp(payload.otp);
  const pendingRegistration = await PendingRegistration.findOne({
    email
  }).select('+passwordHash +otpHash');

  if (!pendingRegistration) {
    throw new AppError('No pending registration was found for this email. Please start again.', 404);
  }

  if (pendingRegistration.verifyAttempts >= env.registerOtpVerifyAttemptLimit) {
    throw createRetryAfterError(
      'Too many incorrect OTP attempts. Please resend a new verification code.',
      'otp',
      env.registerOtpResendCooldownSeconds
    );
  }

  if (isOtpExpired(pendingRegistration.otpExpiresAt)) {
    throw createFieldError('This verification code has expired. Please resend a new OTP.', 'otp', 400);
  }

  if (!compareOtpHash(email, otp, pendingRegistration.otpHash)) {
    pendingRegistration.verifyAttempts += 1;
    await pendingRegistration.save();

    if (pendingRegistration.verifyAttempts >= env.registerOtpVerifyAttemptLimit) {
      throw createRetryAfterError(
        'Too many incorrect OTP attempts. Please resend a new verification code.',
        'otp',
        env.registerOtpResendCooldownSeconds
      );
    }

    throw createFieldError('Invalid OTP. Please check the code and try again.', 'otp', 400);
  }

  await authService.checkRegistrationAvailability({
    fullName: pendingRegistration.fullName,
    email: pendingRegistration.email,
    phone: pendingRegistration.phone,
    role: pendingRegistration.role,
    program: pendingRegistration.program,
    department: pendingRegistration.department,
    semester: pendingRegistration.semester,
    enrollmentNo: pendingRegistration.enrollmentNo,
    employeeId: pendingRegistration.employeeId
  });

  const user = new User({
    fullName: pendingRegistration.fullName,
    email: pendingRegistration.email,
    password: pendingRegistration.passwordHash,
    role: pendingRegistration.role,
    program: pendingRegistration.program,
    department: pendingRegistration.department,
    semester: pendingRegistration.semester,
    enrollmentNo: pendingRegistration.enrollmentNo,
    employeeId: pendingRegistration.employeeId,
    phone: pendingRegistration.phone,
    emailVerified: true,
    isEmailVerified: true,
    emailVerifiedAt: new Date()
  });

  await user.save();
  await pendingRegistration.deleteOne();

  // Fire-and-forget staff welcome email — must not block account creation
  sendStaffWelcomeEmail({
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    collegeName: require('../config/env').collegeName
  }).catch((err) => {
    console.warn('[staff-welcome] Failed to send staff welcome email:', err.message || err, {
      email: user.email,
      role: user.role
    });
  });

  await logAction({
    actorId: user._id,
    resourceType: 'auth',
    resourceId: user._id,
    action: 'register_verified',
    message: 'Account created after email verification',
    metadata: {
      email: user.email,
      role: user.role
    },
    requestMeta
  });

  return {
    email: user.email,
    message: 'Email verified successfully. Your account has been created.'
  };
}

async function resendRegistrationOtp(payload) {
  const email = normalizeEmail(payload.email);
  const pendingRegistration = await PendingRegistration.findOne({
    email
  }).select('+otpHash');

  if (!pendingRegistration) {
    throw new AppError('No pending registration was found for this email. Please start again.', 404);
  }

  const retryAt = new Date(
    new Date(pendingRegistration.lastOtpSentAt).getTime() + env.registerOtpResendCooldownSeconds * 1000
  );
  const retryAfterSeconds = getRemainingSecondsUntil(retryAt);

  if (retryAfterSeconds > 0) {
    throw createRetryAfterError(
      `Please wait ${retryAfterSeconds} seconds before requesting a new OTP.`,
      'otp',
      retryAfterSeconds
    );
  }

  if (pendingRegistration.resendCount >= env.registerOtpResendLimit) {
    throw createRetryAfterError(
      'You have reached the OTP resend limit. Please start registration again later.',
      'otp',
      env.registerOtpResendCooldownSeconds
    );
  }

  await authService.checkRegistrationAvailability({
    fullName: pendingRegistration.fullName,
    email: pendingRegistration.email,
    phone: pendingRegistration.phone,
    role: pendingRegistration.role,
    program: pendingRegistration.program,
    department: pendingRegistration.department,
    semester: pendingRegistration.semester,
    enrollmentNo: pendingRegistration.enrollmentNo,
    employeeId: pendingRegistration.employeeId
  });

  const otp = generateOtp();
  const previousPendingRegistration = pendingRegistration.toObject();

  pendingRegistration.otpHash = hashOtp(email, otp);
  pendingRegistration.otpExpiresAt = getOtpExpiryDate(env.registerOtpExpiryMinutes);
  pendingRegistration.lastOtpSentAt = new Date();
  pendingRegistration.resendCount += 1;
  pendingRegistration.verifyAttempts = 0;
  await pendingRegistration.save();

  try {
    await sendVerificationOtpEmail({
      email: pendingRegistration.email,
      name: pendingRegistration.fullName,
      otp,
      expiryMinutes: env.registerOtpExpiryMinutes
    });
  } catch (error) {
    await restorePendingRegistrationSnapshot(email, previousPendingRegistration);
    throw error;
  }

  return {
    email: pendingRegistration.email,
    expiresInSeconds: env.registerOtpExpiryMinutes * 60,
    cooldownSeconds: env.registerOtpResendCooldownSeconds,
    message: 'A new verification OTP has been sent to your email.'
  };
}

module.exports = {
  resendRegistrationOtp,
  startRegistration,
  verifyRegistrationOtp
};
