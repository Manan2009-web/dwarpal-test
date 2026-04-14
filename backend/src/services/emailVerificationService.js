const env = require('../config/env');
const User = require('../models/User');
const AppError = require('../utils/appError');
const pickUser = require('../utils/pickUser');
const { logAction } = require('./auditService');
const { sendVerificationOtpEmail } = require('./emailService');
const {
  clearEmailVerificationChallenge,
  getUserVerificationEmail,
  isUserEmailVerified
} = require('../utils/emailVerificationState');
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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function buildFieldError(field, message) {
  return [{ field, message }];
}

function createFieldError(message, field = 'field', statusCode = 422) {
  return new AppError(message, statusCode, buildFieldError(field, message));
}

function createRetryAfterError(message, field, retryAfterSeconds) {
  const error = new AppError(message, 429, buildFieldError(field, message));
  error.retryAfterSeconds = retryAfterSeconds;
  return error;
}

function maskEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  const [localPart = '', domain = ''] = normalizedEmail.split('@');

  if (!localPart || !domain) {
    return normalizedEmail;
  }

  const visiblePart = localPart.slice(0, Math.min(2, localPart.length));
  return `${visiblePart}${'*'.repeat(Math.max(localPart.length - visiblePart.length, 1))}@${domain}`;
}

async function getUserForVerification(userId) {
  const user = await User.findById(userId).select('+emailVerificationOtpHash');

  if (!user) {
    throw new AppError('User not found', 404);
  }

  return user;
}

async function assertVerificationEmailIsAvailable(email, ignoreUserId) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    throw createFieldError('Please enter a valid email address.', 'email', 400);
  }

  if (!EMAIL_REGEX.test(normalizedEmail)) {
    throw createFieldError('Please enter a valid email address.', 'email', 400);
  }

  const conflictingUser = await User.findOne({
    _id: { $ne: ignoreUserId },
    $or: [{ email: normalizedEmail }, { pendingEmail: normalizedEmail }]
  }).select('_id');

  if (conflictingUser) {
    throw new AppError('This email is already in use by another account.', 409, [
      {
        field: 'email',
        message: 'This email is already in use by another account.'
      }
    ]);
  }

  return normalizedEmail;
}

function buildVerificationResponse(user, req, overrides = {}) {
  const verificationEmail = getUserVerificationEmail(user);

  return {
    email: normalizeEmail(user.email),
    verificationEmail,
    maskedVerificationEmail: maskEmail(verificationEmail),
    cooldownSeconds: env.registerOtpResendCooldownSeconds,
    expiresInSeconds: env.registerOtpExpiryMinutes * 60,
    user: pickUser(user, req),
    ...overrides
  };
}

async function dispatchVerificationOtp(user, req, options = {}) {
  if (isUserEmailVerified(user)) {
    return buildVerificationResponse(user, req, {
      message: 'Your email is already verified.'
    });
  }

  const verificationEmail = await assertVerificationEmailIsAvailable(getUserVerificationEmail(user), user._id);
  const resetCooldownWindow = options.resetCooldownWindow === true;
  const hadPreviousOtp = Boolean(user.emailVerificationOtpSentAt && user.emailVerificationOtpHash);

  if (!resetCooldownWindow && user.emailVerificationOtpSentAt) {
    const retryAt = new Date(
      new Date(user.emailVerificationOtpSentAt).getTime() + env.registerOtpResendCooldownSeconds * 1000
    );
    const retryAfterSeconds = getRemainingSecondsUntil(retryAt);

    if (retryAfterSeconds > 0) {
      throw createRetryAfterError(
        `Please wait ${retryAfterSeconds} seconds before requesting a new verification OTP.`,
        'otp',
        retryAfterSeconds
      );
    }
  }

  if (!resetCooldownWindow && hadPreviousOtp && user.emailVerificationOtpResendCount >= env.registerOtpResendLimit) {
    throw createRetryAfterError(
      'You have reached the verification OTP resend limit. Please update your email or try again later.',
      'otp',
      env.registerOtpResendCooldownSeconds
    );
  }

  const otp = generateOtp();

  user.emailVerificationOtpHash = hashOtp(verificationEmail, otp);
  user.emailVerificationOtpExpiresAt = getOtpExpiryDate(env.registerOtpExpiryMinutes);
  user.emailVerificationOtpSentAt = new Date();
  user.emailVerificationOtpAttempts = 0;
  user.emailVerificationOtpResendCount =
    resetCooldownWindow || !hadPreviousOtp ? 0 : Number(user.emailVerificationOtpResendCount || 0) + 1;
  await user.save();

  await sendVerificationOtpEmail({
    email: verificationEmail,
    name: user.fullName,
    otp,
    expiryMinutes: env.registerOtpExpiryMinutes
  });

  return buildVerificationResponse(user, req, {
    message:
      options.message ||
      (hadPreviousOtp
        ? 'A new verification OTP has been sent to your email.'
        : 'Verification OTP sent successfully. Please check your email to continue.')
  });
}

async function sendEmailVerificationOtp(userId, req, requestMeta = {}) {
  const user = await getUserForVerification(userId);
  const result = await dispatchVerificationOtp(user, req);

  await logAction({
    actorId: user._id,
    resourceType: 'auth',
    resourceId: user._id,
    action: 'send_email_verification_otp',
    message: 'Email verification OTP sent',
    metadata: {
      verificationEmail: result.verificationEmail
    },
    requestMeta
  });

  return result;
}

async function updateVerificationEmail(userId, payload, req, requestMeta = {}) {
  const user = await getUserForVerification(userId);

  if (isUserEmailVerified(user)) {
    throw new AppError('Your email is already verified.', 409);
  }

  const nextEmail = await assertVerificationEmailIsAvailable(payload.email, user._id);
  const previousVerificationEmail = getUserVerificationEmail(user);

  user.pendingEmail = nextEmail === normalizeEmail(user.email) ? null : nextEmail;
  clearEmailVerificationChallenge(user);
  await user.save();

  const result = await dispatchVerificationOtp(user, req, {
    resetCooldownWindow: true,
    message: 'Verification email updated. A new OTP has been sent to your email.'
  });

  await logAction({
    actorId: user._id,
    resourceType: 'auth',
    resourceId: user._id,
    action: 'update_verification_email',
    message: 'Verification email updated',
    metadata: {
      previousVerificationEmail,
      verificationEmail: result.verificationEmail
    },
    requestMeta
  });

  return result;
}

async function verifyEmailVerificationOtp(userId, payload, req, requestMeta = {}) {
  const user = await getUserForVerification(userId);

  if (isUserEmailVerified(user)) {
    return buildVerificationResponse(user, req, {
      message: 'Your email is already verified.'
    });
  }

  const verificationEmail = await assertVerificationEmailIsAvailable(getUserVerificationEmail(user), user._id);
  const otp = normalizeOtp(payload.otp);

  if (!user.emailVerificationOtpHash) {
    throw new AppError('No active email verification request was found. Please send a new OTP.', 404);
  }

  if (Number(user.emailVerificationOtpAttempts || 0) >= env.registerOtpVerifyAttemptLimit) {
    throw createRetryAfterError(
      'Too many incorrect OTP attempts. Please request a new verification code.',
      'otp',
      env.registerOtpResendCooldownSeconds
    );
  }

  if (isOtpExpired(user.emailVerificationOtpExpiresAt)) {
    throw createFieldError('This verification code has expired. Please request a new OTP.', 'otp', 400);
  }

  if (!compareOtpHash(verificationEmail, otp, user.emailVerificationOtpHash)) {
    user.emailVerificationOtpAttempts = Number(user.emailVerificationOtpAttempts || 0) + 1;
    await user.save();

    if (user.emailVerificationOtpAttempts >= env.registerOtpVerifyAttemptLimit) {
      throw createRetryAfterError(
        'Too many incorrect OTP attempts. Please request a new verification code.',
        'otp',
        env.registerOtpResendCooldownSeconds
      );
    }

    throw createFieldError('Invalid OTP. Please check the code and try again.', 'otp', 400);
  }

  user.email = verificationEmail;
  user.emailVerified = true;
  user.isEmailVerified = true;
  user.emailVerifiedAt = new Date();
  user.pendingEmail = null;
  clearEmailVerificationChallenge(user);
  await user.save();

  await logAction({
    actorId: user._id,
    resourceType: 'auth',
    resourceId: user._id,
    action: 'verify_email',
    message: 'Email verified successfully',
    metadata: {
      email: user.email
    },
    requestMeta
  });

  return buildVerificationResponse(user, req, {
    message: 'Email verified successfully. You now have full access.',
    verificationEmail: normalizeEmail(user.email),
    maskedVerificationEmail: maskEmail(user.email)
  });
}

module.exports = {
  sendEmailVerificationOtp,
  updateVerificationEmail,
  verifyEmailVerificationOtp
};
