const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');
const StudentLoginOtp = require('../models/StudentLoginOtp');
const AppError = require('../utils/appError');
const pickUser = require('../utils/pickUser');
const { createAccessToken } = require('../utils/token');
const { logAction } = require('./auditService');
const { sendStudentLoginOtpEmail } = require('./emailService');
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

function createInvalidStudentCredentialsError() {
  const message = 'Invalid enrollment number or password.';
  return new AppError(message, 401, buildFieldError('identifier', message));
}

function createRetryAfterError(message, field, retryAfterSeconds) {
  const error = new AppError(message, 429, buildFieldError(field, message));
  error.retryAfterSeconds = retryAfterSeconds;
  return error;
}

async function restoreStudentLoginOtpSnapshot(userId, snapshot) {
  if (snapshot?._id) {
    await StudentLoginOtp.replaceOne({ _id: snapshot._id }, snapshot, { upsert: true });
    return;
  }

  await StudentLoginOtp.deleteOne({ userId });
}

function normalizeEnrollmentNumber(value) {
  return String(value || '').trim();
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

function createStudentLoginChallengeToken(userId) {
  if (!env.jwtSecret) {
    throw new Error('JWT_SECRET is not configured. Add it to your backend .env file.');
  }

  return jwt.sign(
    {
      type: 'student_login_challenge'
    },
    env.jwtSecret,
    {
      subject: userId.toString(),
      expiresIn: `${env.studentLoginOtpExpiryMinutes}m`
    }
  );
}

function verifyStudentLoginChallengeToken(token) {
  if (!token) {
    throw createFieldError('Student login session is missing. Please sign in again.', 'loginToken', 401);
  }

  try {
    const decoded = jwt.verify(String(token || '').trim(), env.jwtSecret);

    if (decoded?.type !== 'student_login_challenge' || !decoded?.sub) {
      throw new Error('invalid');
    }

    return {
      userId: String(decoded.sub)
    };
  } catch {
    throw createFieldError('Student login session expired. Please sign in again.', 'loginToken', 401);
  }
}

async function getStudentByEnrollment(enrollmentNo, selection = '+password') {
  const normalizedEnrollmentNo = normalizeEnrollmentNumber(enrollmentNo);

  if (!normalizedEnrollmentNo) {
    throw createFieldError('Use your registered enrollment number.', 'identifier', 400);
  }

  if (normalizedEnrollmentNo.includes('@')) {
    throw createFieldError('Use your registered enrollment number.', 'identifier', 400);
  }

  const student = await User.findOne({
    role: 'student',
    $or: [
      { enrollmentNumber: normalizedEnrollmentNo },
      { enrollmentNo: normalizedEnrollmentNo },
      { enrollment: normalizedEnrollmentNo }
    ]
  }).select(selection);

  if (!student) {
    throw createInvalidStudentCredentialsError();
  }

  if (!student.isActive) {
    throw new AppError('This student account is inactive. Please contact the CAO office.', 403);
  }

  return student;
}

function getStudentLoginEmail(user) {
  const email = normalizeEmail(user?.email);

  if (!email || !EMAIL_REGEX.test(email)) {
    throw createFieldError(
      'A valid registered email is required for student login OTP. Please contact support.',
      'email',
      400
    );
  }

  return email;
}

async function sendStudentOtp(user, options = {}) {
  const email = getStudentLoginEmail(user);
  const existingOtpRecord = await StudentLoginOtp.findOne({ userId: user._id }).select('+otpHash');
  const previousSnapshot = existingOtpRecord ? existingOtpRecord.toObject() : null;

  if (existingOtpRecord?.lastSentAt) {
    const retryAt = new Date(
      new Date(existingOtpRecord.lastSentAt).getTime() + env.studentLoginOtpResendCooldownSeconds * 1000
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

  await StudentLoginOtp.findOneAndUpdate(
    {
      userId: user._id
    },
    {
      $set: {
        userId: user._id,
        email,
        otpHash: hashOtp(email, otp),
        otpExpiresAt: getOtpExpiryDate(env.studentLoginOtpExpiryMinutes),
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
    await sendStudentLoginOtpEmail({
      email,
      name: user.fullName,
      otp,
      expiryMinutes: env.studentLoginOtpExpiryMinutes
    });
  } catch (error) {
    await restoreStudentLoginOtpSnapshot(user._id, previousSnapshot);
    throw error;
  }

  return {
    loginToken: createStudentLoginChallengeToken(user._id),
    maskedEmail: maskEmail(email),
    cooldownSeconds: env.studentLoginOtpResendCooldownSeconds,
    expiresInSeconds: env.studentLoginOtpExpiryMinutes * 60,
    message:
      options.resend === true
        ? 'A new OTP has been sent to the registered student email.'
        : 'OTP sent to the registered student email.'
  };
}

async function startStudentLogin(payload, requestMeta = {}) {
  if (payload?.resend === true || payload?.loginToken) {
    const loginSession = verifyStudentLoginChallengeToken(payload.loginToken);
    const student = await User.findById(loginSession.userId);

    if (!student || student.role !== 'student') {
      throw createFieldError('Student login session expired. Please sign in again.', 'loginToken', 401);
    }

    return sendStudentOtp(student, { resend: true });
  }

  const student = await getStudentByEnrollment(payload.identifier || payload.enrollmentNo);
  const passwordMatches = await student.comparePassword(String(payload.password || ''));

  if (!passwordMatches) {
    throw createInvalidStudentCredentialsError();
  }

  const result = await sendStudentOtp(student);

  await logAction({
    actorId: student._id,
    resourceType: 'auth',
    resourceId: student._id,
    action: 'student_login_otp_sent',
    message: 'Student login OTP sent',
    metadata: {
      email: student.email
    },
    requestMeta
  });

  return result;
}

async function verifyStudentLoginOtp(payload, req, requestMeta = {}) {
  const loginSession = verifyStudentLoginChallengeToken(payload.loginToken);
  const otp = normalizeOtp(payload.otp);

  if (!otp) {
    throw createFieldError('OTP must be a 6-digit code.', 'otp', 400);
  }

  const [student, otpRecord] = await Promise.all([
    User.findById(loginSession.userId),
    StudentLoginOtp.findOne({ userId: loginSession.userId }).select('+otpHash')
  ]);

  if (!student || student.role !== 'student') {
    throw createFieldError('Student login session expired. Please sign in again.', 'loginToken', 401);
  }

  if (!otpRecord || otpRecord.used) {
    throw createFieldError('No active OTP request was found. Please sign in again.', 'otp', 404);
  }

  if (otpRecord.attempts >= env.studentLoginOtpVerifyAttemptLimit) {
    throw createRetryAfterError(
      'Too many incorrect OTP attempts. Please sign in again to receive a new OTP.',
      'otp',
      env.studentLoginOtpResendCooldownSeconds
    );
  }

  if (isOtpExpired(otpRecord.otpExpiresAt)) {
    throw createFieldError('OTP expired, resend OTP.', 'otp', 400);
  }

  const email = getStudentLoginEmail(student);

  if (!compareOtpHash(email, otp, otpRecord.otpHash)) {
    otpRecord.attempts += 1;
    await otpRecord.save();

    if (otpRecord.attempts >= env.studentLoginOtpVerifyAttemptLimit) {
      throw createRetryAfterError(
        'Too many incorrect OTP attempts. Please sign in again to receive a new OTP.',
        'otp',
        env.studentLoginOtpResendCooldownSeconds
      );
    }

    throw createFieldError('Invalid OTP. Please check the code and try again.', 'otp', 400);
  }

  otpRecord.used = true;
  await otpRecord.save();

  student.lastLoginAt = new Date();

  if (student.emailVerified !== true || student.isEmailVerified !== true) {
    student.emailVerified = true;
    student.isEmailVerified = true;
    student.emailVerifiedAt = student.emailVerifiedAt || new Date();
  }

  await student.save();

  const token = createAccessToken({
    _id: student._id,
    role: student.role,
    email: student.email,
    authMethod: 'student-email-otp'
  });

  await logAction({
    actorId: student._id,
    resourceType: 'auth',
    resourceId: student._id,
    action: 'student_login',
    message: 'Student logged in with enrollment number and email OTP',
    requestMeta
  });

  return {
    token,
    user: pickUser(student, req)
  };
}

module.exports = {
  startStudentLogin,
  verifyStudentLoginOtp
};
