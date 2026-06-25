const { sendSuccess } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/appError');
const { clearAuthCookie, setAuthCookie } = require('../utils/token');
const { getRequestMeta } = require('../utils/request');
const {
  clearWebAuthnStateCookie,
  readWebAuthnState,
  setWebAuthnStateCookie
} = require('../utils/webauthnState');
const authService = require('../services/authService');
const emailVerificationService = require('../services/emailVerificationService');
const passwordResetService = require('../services/passwordResetService');
const registrationOtpService = require('../services/registrationOtpService');
const studentAuthService = require('../services/studentAuthService');
const pickUser = require('../utils/pickUser');
const {
  createPortalAccessToken,
  getPortalAccessCredentials,
  isPortalAccessConfigured,
  normalizePortalAccessType
} = require('../middleware/portalAccess');

function maskEmail(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const [localPart = '', domain = ''] = normalizedEmail.split('@');

  if (!localPart || !domain) {
    return normalizedEmail;
  }

  const visiblePart = localPart.slice(0, Math.min(2, localPart.length));
  return `${visiblePart}${'*'.repeat(Math.max(localPart.length - visiblePart.length, 1))}@${domain}`;
}

function maskIdentifier(identifier) {
  const normalizedIdentifier = String(identifier || '').trim();

  if (!normalizedIdentifier) {
    return '';
  }

  if (normalizedIdentifier.includes('@')) {
    return maskEmail(normalizedIdentifier);
  }

  if (normalizedIdentifier.length <= 4) {
    return normalizedIdentifier;
  }

  return `${normalizedIdentifier.slice(0, 2)}${'*'.repeat(Math.max(normalizedIdentifier.length - 4, 1))}${normalizedIdentifier.slice(-2)}`;
}

const register = asyncHandler(async (req, res) => {
  const startedAt = Date.now();
  console.info('[auth] POST /auth/register route entered', {
    email: maskEmail(req.body?.email),
    role: req.body?.role
  });

  try {
    const result = await authService.registerUser(req.body, req, getRequestMeta(req));

    console.info('[auth] POST /auth/register route completed', {
      email: maskEmail(result?.email),
      durationMs: Math.max(Date.now() - startedAt, 0)
    });

    return sendSuccess(res, {
      statusCode: result?.statusCode || 201,
      message: result.message,
      data: result
    });
  } catch (error) {
    console.error('[auth] POST /auth/register route failed', {
      email: maskEmail(req.body?.email),
      durationMs: Math.max(Date.now() - startedAt, 0),
      error: error?.stack || error?.message || error
    });
    throw error;
  }
});

const checkRegistrationAvailability = asyncHandler(async (req, res) => {
  const result = await authService.checkRegistrationAvailability(req.body);

  return sendSuccess(res, {
    message: 'Registration details are available.',
    data: result
  });
});

const registerStart = asyncHandler(async (req, res) => {
  // TEMP_DISABLED_OTP
  const result = await authService.registerUser(req.body, req, getRequestMeta(req));

  return sendSuccess(res, {
    statusCode: result?.statusCode || 201,
    message: result.message,
    data: result
  });
});

const verifyRegisterOtp = asyncHandler(async (req, res) => {
  return sendSuccess(res, {
    message: 'Registration OTP verification is temporarily disabled. You can sign in now.',
    data: {
      email: String(req.body?.email || '').trim().toLowerCase()
    }
  });
});

const resendRegisterOtp = asyncHandler(async (req, res) => {
  return sendSuccess(res, {
    message: 'Registration OTP delivery is temporarily disabled.',
    data: {
      email: String(req.body?.email || '').trim().toLowerCase()
    }
  });
});

const portalAccess = asyncHandler(async (req, res) => {
  const accessType = normalizePortalAccessType(req.body?.accessType);

  if (!accessType) {
    throw new AppError('Access type must be either student or faculty.', 400);
  }

  // TEMP_DISABLED_ACCESS_PORTAL
  return sendSuccess(res, {
    message: `${accessType === 'student' ? 'Student' : 'Faculty'} portal access is temporarily bypassed.`,
    data: {
      accessType,
      token: createPortalAccessToken(accessType)
    }
  });

  const credentials = getPortalAccessCredentials(accessType);

  if (!accessType) {
    throw new AppError('Access type must be either student or faculty.', 400);
  }

  if (!isPortalAccessConfigured(accessType)) {
    const error = new AppError(`Portal access is not configured for ${accessType} access yet.`, 503);
    error.code = 'PORTAL_ACCESS_NOT_CONFIGURED';
    throw error;
  }

  if (
    String(req.body?.accessId || '').trim() !== credentials.accessId ||
    String(req.body?.accessPassword || '') !== credentials.accessPassword
  ) {
    const error = new AppError('Invalid access ID or password.', 401, [
      {
        field: 'accessId',
        message: 'Invalid access ID or password.'
      }
    ]);
    error.code = 'PORTAL_ACCESS_DENIED';
    throw error;
  }

  return sendSuccess(res, {
    message: `${accessType === 'student' ? 'Student' : 'Faculty'} portal access granted successfully.`,
    data: {
      accessType,
      token: createPortalAccessToken(accessType)
    }
  });
});

const login = asyncHandler(async (req, res) => {
  const startedAt = Date.now();
  const identifier = req.body?.identifier || req.body?.enrollment || req.body?.employeeId;
  console.info('[auth] POST /auth/login route entered', {
    identifier: maskIdentifier(identifier)
  });

  try {
    const result = await authService.loginUser(req.body, req, getRequestMeta(req));
    setAuthCookie(res, result.token);

    console.info('[auth] POST /auth/login route completed', {
      durationMs: Math.max(Date.now() - startedAt, 0),
      identifier: maskIdentifier(identifier),
      role: result?.user?.role || ''
    });

    return sendSuccess(res, {
      message: 'Login successful',
      data: result
    });
  } catch (error) {
    console.error('[auth] POST /auth/login route failed', {
      durationMs: Math.max(Date.now() - startedAt, 0),
      error: error?.stack || error?.message || error,
      identifier: maskIdentifier(identifier)
    });
    throw error;
  }
});

const studentLoginStart = asyncHandler(async (req, res) => {
  if (String(req.body?.loginToken || '').trim() || req.body?.resend === true) {
    // TEMP_DISABLED_OTP
    throw new AppError('Student OTP login is temporarily disabled. Please sign in again with your password.', 400);
  }

  const startedAt = Date.now();
  const identifier = req.body?.identifier || req.body?.enrollmentNo || req.body?.loginToken || '';

  console.info('[auth] POST /auth/student-login-start route entered', {
    identifier: maskIdentifier(identifier),
    resend: req.body?.resend === true
  });

  try {
    // TEMP_DISABLED_OTP
    const result = await authService.loginUser(req.body, req, getRequestMeta(req));
    setAuthCookie(res, result.token);

    console.info('[auth] POST /auth/student-login-start route completed', {
      durationMs: Math.max(Date.now() - startedAt, 0),
      identifier: maskIdentifier(identifier)
    });

    return sendSuccess(res, {
      message: 'Login successful',
      data: result
    });
  } catch (error) {
    console.error('[auth] POST /auth/student-login-start route failed', {
      durationMs: Math.max(Date.now() - startedAt, 0),
      error: error?.stack || error?.message || error,
      identifier: maskIdentifier(identifier)
    });
    throw error;
  }
});

const studentLoginVerifyOtp = asyncHandler(async (req, res) => {
  // TEMP_DISABLED_OTP
  throw new AppError('Student OTP verification is temporarily disabled. Please sign in again with your password.', 400);
});

const logout = asyncHandler(async (req, res) => {
  clearAuthCookie(res);
  clearWebAuthnStateCookie(res);
  res.set('Clear-Site-Data', '"cache", "cookies", "storage"');

  return sendSuccess(res, {
    message: 'Logout successful',
    data: null
  });
});

const getMe = asyncHandler(async (req, res) => {
  const user = await authService.getCurrentUser(req.user, req, req.auth);

  return sendSuccess(res, {
    message: 'Current user fetched successfully',
    data: user
  });
});

const verify = asyncHandler(async (req, res) => {
  const authState = await authService.verifyAuthState(req.user, req, req.auth);

  return sendSuccess(res, {
    message: 'Authentication verified successfully',
    data: authState
  });
});

const changePassword = asyncHandler(async (req, res) => {
  const result = await authService.changePassword(req.user._id, req.body, getRequestMeta(req));

  return sendSuccess(res, {
    message: result.message,
    data: null
  });
});

const forgotPasswordStart = asyncHandler(async (req, res) => {
  const result = await passwordResetService.startPasswordReset(req.body);

  return sendSuccess(res, {
    message: result.message,
    data: result
  });
});

const resolveForgotPasswordAccount = asyncHandler(async (req, res) => {
  const result = await passwordResetService.resolvePasswordResetAccount(req.body);

  return sendSuccess(res, {
    message: result.message,
    data: result
  });
});

const verifyForgotPasswordOtp = asyncHandler(async (req, res) => {
  const result = await passwordResetService.verifyPasswordResetOtp(req.body);

  return sendSuccess(res, {
    message: result.message,
    data: result
  });
});

const resetForgotPassword = asyncHandler(async (req, res) => {
  const result = await passwordResetService.resetPassword(req.body, getRequestMeta(req));

  return sendSuccess(res, {
    message: result.message,
    data: result
  });
});

const requestPasswordChange = asyncHandler(async (req, res) => {
  const result = await passwordResetService.requestAuthenticatedPasswordChange(req.user._id);

  return sendSuccess(res, {
    message: result.message,
    data: result
  });
});

const confirmPasswordChange = asyncHandler(async (req, res) => {
  const result = await passwordResetService.confirmAuthenticatedPasswordChange(
    req.user._id,
    req.body,
    req,
    getRequestMeta(req)
  );

  return sendSuccess(res, {
    message: result.message,
    data: result
  });
});

const sendEmailVerificationOtp = asyncHandler(async (req, res) => {
  // TEMP_DISABLED_OTP
  const user = pickUser(req.user, req);

  return sendSuccess(res, {
    message: 'Email verification is temporarily disabled. Your account is already verified.',
    data: {
      email: user?.email || '',
      verificationEmail: user?.email || '',
      maskedVerificationEmail: user?.email || '',
      user
    }
  });

  const result = await emailVerificationService.sendEmailVerificationOtp(req.user._id, req, getRequestMeta(req));

  return sendSuccess(res, {
    message: result.message,
    data: result
  });
});

const updateEmailVerificationEmail = asyncHandler(async (req, res) => {
  // TEMP_DISABLED_OTP
  if (req.body?.email) {
    req.user.email = String(req.body.email || '').trim().toLowerCase();
    req.user.emailVerified = true;
    req.user.isEmailVerified = true;
    req.user.emailVerifiedAt = req.user.emailVerifiedAt || new Date();
    req.user.pendingEmail = null;
    await req.user.save();
  }

  return sendSuccess(res, {
    message: 'Email verification is temporarily disabled. Your email has been updated.',
    data: {
      email: req.user.email || '',
      verificationEmail: req.user.email || '',
      maskedVerificationEmail: req.user.email || '',
      user: pickUser(req.user, req)
    }
  });

  const result = await emailVerificationService.updateVerificationEmail(
    req.user._id,
    req.body,
    req,
    getRequestMeta(req)
  );

  return sendSuccess(res, {
    message: result.message,
    data: result
  });
});

const verifyEmailVerificationOtp = asyncHandler(async (req, res) => {
  // TEMP_DISABLED_OTP
  req.user.emailVerified = true;
  req.user.isEmailVerified = true;
  req.user.emailVerifiedAt = req.user.emailVerifiedAt || new Date();
  req.user.pendingEmail = null;
  await req.user.save();

  return sendSuccess(res, {
    message: 'Email verification is temporarily disabled. Your account is already verified.',
    data: {
      email: req.user.email || '',
      verificationEmail: req.user.email || '',
      maskedVerificationEmail: req.user.email || '',
      user: pickUser(req.user, req)
    }
  });

  const result = await emailVerificationService.verifyEmailVerificationOtp(
    req.user._id,
    req.body,
    req,
    getRequestMeta(req)
  );

  return sendSuccess(res, {
    message: result.message,
    data: result
  });
});

const getWebAuthnRegistrationOptions = asyncHandler(async (req, res) => {
  const result = await authService.getWebAuthnRegistrationOptions(req.user._id, req.body, req, req.auth);

  setWebAuthnStateCookie(res, {
    challenge: result.options.challenge,
    flow: 'registration',
    userId: req.user._id.toString()
  });

  return sendSuccess(res, {
    message: 'Biometric setup challenge created successfully',
    data: result
  });
});

const verifyWebAuthnRegistration = asyncHandler(async (req, res) => {
  const flowState = readWebAuthnState(req, 'registration');
  const result = await authService.verifyWebAuthnRegistration(
    req.user._id,
    req.body,
    req,
    flowState,
    getRequestMeta(req)
  );

  clearWebAuthnStateCookie(res);

  return sendSuccess(res, {
    statusCode: 201,
    message: 'Biometric login has been enabled on this device.',
    data: result
  });
});

const getWebAuthnAuthenticationOptions = asyncHandler(async (req, res) => {
  const result = await authService.getWebAuthnAuthenticationOptions(req.body, req);

  setWebAuthnStateCookie(res, {
    challenge: result.options.challenge,
    flow: 'authentication',
    userId: result.userId
  });

  return sendSuccess(res, {
    message: 'Biometric login challenge created successfully',
    data: result
  });
});

const verifyWebAuthnAuthentication = asyncHandler(async (req, res) => {
  const flowState = readWebAuthnState(req, 'authentication');
  const result = await authService.verifyWebAuthnAuthentication(req.body, req, flowState, getRequestMeta(req));

  clearWebAuthnStateCookie(res);
  setAuthCookie(res, result.token);

  return sendSuccess(res, {
    message: 'Biometric login successful',
    data: result
  });
});

const getWebAuthnDevices = asyncHandler(async (req, res) => {
  const result = await authService.getWebAuthnDevices(req.user._id);

  return sendSuccess(res, {
    message: 'Biometric devices fetched successfully',
    data: result
  });
});

const forgotPassword = asyncHandler(async (req, res) => {
  const { identifier } = req.body;
  const result = await passwordResetService.startForgotPasswordWithOtp(identifier);
  return sendSuccess(res, {
    message: result.message,
    data: result
  });
});

const verifyOtp = asyncHandler(async (req, res) => {
  const { identifier, otp } = req.body;
  const result = await passwordResetService.verifyForgotPasswordOtpOnly(identifier, otp);
  return sendSuccess(res, {
    message: result.message,
    data: result
  });
});

const resetPassword = asyncHandler(async (req, res) => {
  const { identifier, otp, newPassword } = req.body;
  const result = await passwordResetService.resetPasswordWithOtp(identifier, otp, newPassword, getRequestMeta(req));
  return sendSuccess(res, {
    message: result.message,
    data: result
  });
});

const removeWebAuthnDevice = asyncHandler(async (req, res) => {
  const result = await authService.removeWebAuthnDevice(req.user._id, req.params.deviceId, getRequestMeta(req));

  return sendSuccess(res, {
    message: 'Biometric device removed successfully',
    data: result
  });
});

module.exports = {
  checkRegistrationAvailability,
  changePassword,
  confirmPasswordChange,
  forgotPasswordStart,
  resolveForgotPasswordAccount,
  getMe,
  portalAccess,
  requestPasswordChange,
  resetForgotPassword,
  sendEmailVerificationOtp,
  getWebAuthnAuthenticationOptions,
  getWebAuthnDevices,
  getWebAuthnRegistrationOptions,
  login,
  logout,
  register,
  registerStart,
  resendRegisterOtp,
  removeWebAuthnDevice,
  studentLoginStart,
  studentLoginVerifyOtp,
  updateEmailVerificationEmail,
  verifyEmailVerificationOtp,
  verifyForgotPasswordOtp,
  verify,
  verifyRegisterOtp,
  verifyWebAuthnAuthentication,
  verifyWebAuthnRegistration,
  forgotPassword,
  verifyOtp,
  resetPassword
};
