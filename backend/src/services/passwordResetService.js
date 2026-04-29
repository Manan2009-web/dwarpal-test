const bcrypt = require('bcryptjs');
const env = require('../config/env');
const User = require('../models/User');
const PasswordResetOtp = require('../models/PasswordResetOtp');
const AppError = require('../utils/appError');
const pickUser = require('../utils/pickUser');
const { PASSWORD_REGEX } = require('../constants/appConstants');
const { logAction } = require('./auditService');
const authService = require('./authService');
const { sendPasswordResetOtpEmail } = require('./emailService');
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

const BCRYPT_HASH_REGEX = /^\$2[aby]\$\d{2}\$/;

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

async function restorePasswordResetSnapshot(email, snapshot) {
  if (snapshot?._id) {
    await PasswordResetOtp.replaceOne({ _id: snapshot._id }, snapshot, { upsert: true });
    return;
  }

  await PasswordResetOtp.deleteOne({ email });
}

function normalizeIdentifier(value) {
  return String(value || '').trim();
}

function isEmailStyleIdentifier(value) {
  return normalizeIdentifier(value).includes('@');
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

async function compareWithStoredPassword(candidatePassword, storedPassword) {
  if (!storedPassword) {
    return false;
  }

  const normalizedStoredPassword = String(storedPassword);
  const passwordHash = BCRYPT_HASH_REGEX.test(normalizedStoredPassword)
    ? normalizedStoredPassword
    : await bcrypt.hash(normalizedStoredPassword, env.bcryptSaltRounds);

  return bcrypt.compare(candidatePassword, passwordHash);
}

async function getPasswordResetUserByIdentifier(identifier, selection = '_id fullName email isActive') {
  const normalizedIdentifier = normalizeIdentifier(identifier);

  if (!normalizedIdentifier) {
    throw createFieldError('Enter enrollment number or employee ID.', 'identifier', 400);
  }

  if (isEmailStyleIdentifier(normalizedIdentifier)) {
    throw createFieldError('Forgot password works only with your enrollment number or employee ID.', 'identifier', 400);
  }

  const user = await authService.findUserByIdentifier(normalizedIdentifier, selection);

  if (!user) {
    throw new AppError(
      'No DwarPal account was found for that enrollment number or employee ID.',
      404,
      buildFieldError('identifier', 'No DwarPal account was found for that enrollment number or employee ID.')
    );
  }

  if (!user.isActive) {
    throw new AppError('This account is inactive. Please contact administration.', 403);
  }

  return user;
}

async function validateResetOtpRecord(record, email, otp) {
  if (!record || record.used) {
    throw new AppError('No active password reset request was found. Please request a new OTP.', 404);
  }

  if (record.attempts >= env.passwordResetOtpVerifyAttemptLimit) {
    throw createRetryAfterError(
      'Too many incorrect OTP attempts. Please request a new password reset code.',
      'otp',
      env.passwordResetOtpResendCooldownSeconds
    );
  }

  if (isOtpExpired(record.otpExpiresAt)) {
    throw createFieldError('This reset code has expired. Please request a new OTP.', 'otp', 400);
  }

  if (!compareOtpHash(email, otp, record.otpHash)) {
    record.attempts += 1;
    await record.save();

    if (record.attempts >= env.passwordResetOtpVerifyAttemptLimit) {
      throw createRetryAfterError(
        'Too many incorrect OTP attempts. Please request a new password reset code.',
        'otp',
        env.passwordResetOtpResendCooldownSeconds
      );
    }

    throw createFieldError('Invalid OTP. Please check the code and try again.', 'otp', 400);
  }

  return true;
}

async function resolvePasswordResetAccount(payload) {
  const identifier = normalizeIdentifier(payload.identifier || payload.enrollment || payload.employeeId);
  const user = await getPasswordResetUserByIdentifier(identifier);
  const email = normalizeEmail(user.email);

  return {
    identifier,
    email,
    maskedEmail: maskEmail(email),
    message: 'Registered email fetched successfully.'
  };
}

async function startPasswordReset(payload) {
  const identifier = normalizeIdentifier(payload.identifier || payload.enrollment || payload.employeeId);
  const user = await getPasswordResetUserByIdentifier(identifier);
  const registeredEmail = normalizeEmail(user.email);
  const email = payload.email ? normalizeEmail(payload.email) : registeredEmail;

  if (!registeredEmail) {
    throw createFieldError('No registered email was found for this account.', 'email', 400);
  }

  if (email !== registeredEmail) {
    throw createFieldError(
      `Use the email currently registered on this account (${maskEmail(registeredEmail)}).`,
      'email',
      400
    );
  }

  const existingRequest = await PasswordResetOtp.findOne({
    email
  }).select('+otpHash');
  const previousSnapshot = existingRequest ? existingRequest.toObject() : null;

  if (existingRequest?.lastSentAt) {
    const retryAt = new Date(
      new Date(existingRequest.lastSentAt).getTime() + env.passwordResetOtpResendCooldownSeconds * 1000
    );
    const retryAfterSeconds = getRemainingSecondsUntil(retryAt);

    if (retryAfterSeconds > 0) {
      throw createRetryAfterError(
        `Please wait ${retryAfterSeconds} seconds before requesting a new OTP.`,
        'otp',
        retryAfterSeconds
      );
    }
  }

  const otp = generateOtp();

  await PasswordResetOtp.findOneAndUpdate(
    {
      email
    },
    {
      $set: {
        email,
        otpHash: hashOtp(email, otp),
        otpExpiresAt: getOtpExpiryDate(env.passwordResetOtpExpiryMinutes),
        lastSentAt: new Date(),
        attempts: 0,
        used: false
      }
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }
  );

  try {
    await sendPasswordResetOtpEmail({
      email,
      name: user.fullName,
      otp,
      expiryMinutes: env.passwordResetOtpExpiryMinutes
    });
  } catch (error) {
    await restorePasswordResetSnapshot(email, previousSnapshot);
    throw error;
  }

  return {
    identifier,
    email,
    maskedEmail: maskEmail(email),
    cooldownSeconds: env.passwordResetOtpResendCooldownSeconds,
    expiresInSeconds: env.passwordResetOtpExpiryMinutes * 60,
    message: 'Password reset OTP sent successfully.'
  };
}

async function verifyPasswordResetOtp(payload) {
  const email = normalizeEmail(payload.email);
  const otp = normalizeOtp(payload.otp);
  const resetRequest = await PasswordResetOtp.findOne({
    email
  }).select('+otpHash');

  await validateResetOtpRecord(resetRequest, email, otp);

  return {
    email,
    maskedEmail: maskEmail(email),
    message: 'OTP verified successfully.'
  };
}

async function resetPassword(payload, requestMeta = {}) {
  const email = normalizeEmail(payload.email);
  const otp = normalizeOtp(payload.otp);
  const newPassword = String(payload.newPassword || '');

  if (!PASSWORD_REGEX.test(newPassword)) {
    throw createFieldError(
      'New password must be at least 8 characters and include uppercase, lowercase, number, and special character',
      'newPassword',
      400
    );
  }

  const [user, resetRequest] = await Promise.all([
    User.findOne({
      email
    }).select('+password +temporaryCredentialEncrypted'),
    PasswordResetOtp.findOne({
      email
    }).select('+otpHash')
  ]);

  if (!user) {
    throw new AppError('No DwarPal account was found with this email address.', 404);
  }

  await validateResetOtpRecord(resetRequest, email, otp);

  if (await compareWithStoredPassword(newPassword, user.password)) {
    throw createFieldError('New password cannot be the same as your old password.', 'newPassword', 400);
  }

  user.password = newPassword;
  user.mustChangePassword = false;
  user.temporaryCredentialEncrypted = null;
  user.temporaryCredentialCreatedAt = null;
  await user.save();

  resetRequest.used = true;
  await resetRequest.save();

  await logAction({
    actorId: user._id,
    resourceType: 'auth',
    resourceId: user._id,
    action: 'forgot_password_reset',
    message: 'Password reset completed successfully',
    metadata: {
      email: user.email
    },
    requestMeta
  });

  return {
    email,
    message: 'Password reset successful. You can now sign in with your new password.'
  };
}

async function requestAuthenticatedPasswordChange(userId) {
  const user = await User.findById(userId).select('_id fullName email isActive');

  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (!user.isActive) {
    throw new AppError('This account is inactive. Please contact administration.', 403);
  }

  const email = normalizeEmail(user.email);

  if (!email) {
    throw createFieldError('No registered email was found for this account.', 'email', 400);
  }

  const existingRequest = await PasswordResetOtp.findOne({
    email
  }).select('+otpHash');
  const previousSnapshot = existingRequest ? existingRequest.toObject() : null;

  if (existingRequest?.lastSentAt) {
    const retryAt = new Date(
      new Date(existingRequest.lastSentAt).getTime() + env.passwordResetOtpResendCooldownSeconds * 1000
    );
    const retryAfterSeconds = getRemainingSecondsUntil(retryAt);

    if (retryAfterSeconds > 0) {
      throw createRetryAfterError(
        `Please wait ${retryAfterSeconds} seconds before requesting a new OTP.`,
        'otp',
        retryAfterSeconds
      );
    }
  }

  const otp = generateOtp();

  await PasswordResetOtp.findOneAndUpdate(
    {
      email
    },
    {
      $set: {
        email,
        otpHash: hashOtp(email, otp),
        otpExpiresAt: getOtpExpiryDate(env.passwordResetOtpExpiryMinutes),
        lastSentAt: new Date(),
        attempts: 0,
        used: false
      }
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }
  );

  try {
    await sendPasswordResetOtpEmail({
      email,
      name: user.fullName,
      otp,
      expiryMinutes: env.passwordResetOtpExpiryMinutes
    });
  } catch (error) {
    await restorePasswordResetSnapshot(email, previousSnapshot);
    throw error;
  }

  return {
    email,
    maskedEmail: maskEmail(email),
    cooldownSeconds: env.passwordResetOtpResendCooldownSeconds,
    expiresInSeconds: env.passwordResetOtpExpiryMinutes * 60,
    message: 'Password change OTP sent successfully.'
  };
}

async function confirmAuthenticatedPasswordChange(userId, payload, req, requestMeta = {}) {
  const otp = normalizeOtp(payload.otp);
  const newPassword = String(payload.newPassword || '');

  if (!PASSWORD_REGEX.test(newPassword)) {
    throw createFieldError(
      'New password must be at least 8 characters and include uppercase, lowercase, number, and special character',
      'newPassword',
      400
    );
  }

  const user = await User.findById(userId).select('+password +temporaryCredentialEncrypted');

  if (!user) {
    throw new AppError('User not found', 404);
  }

  const email = normalizeEmail(user.email);

  if (!email) {
    throw createFieldError('No registered email was found for this account.', 'email', 400);
  }

  const resetRequest = await PasswordResetOtp.findOne({
    email
  }).select('+otpHash');

  await validateResetOtpRecord(resetRequest, email, otp);

  if (await compareWithStoredPassword(newPassword, user.password)) {
    throw createFieldError('New password cannot be the same as your old password.', 'newPassword', 400);
  }

  user.password = newPassword;
  user.mustChangePassword = false;
  user.temporaryCredentialEncrypted = null;
  user.temporaryCredentialCreatedAt = null;
  await user.save();

  resetRequest.used = true;
  await resetRequest.save();

  await logAction({
    actorId: user._id,
    resourceType: 'auth',
    resourceId: user._id,
    action: 'authenticated_password_change',
    message: 'Authenticated password change completed successfully',
    metadata: {
      email: user.email
    },
    requestMeta
  });

  return {
    message: 'Password changed successfully.',
    user: pickUser(user, req)
  };
}

module.exports = {
  confirmAuthenticatedPasswordChange,
  requestAuthenticatedPasswordChange,
  resolvePasswordResetAccount,
  resetPassword,
  startPasswordReset,
  verifyPasswordResetOtp
};
