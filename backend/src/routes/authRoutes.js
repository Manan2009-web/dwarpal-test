const express = require('express');
const { protect, requireVerifiedEmail } = require('../middleware/authMiddleware');
const authorize = require('../middleware/authorize');
const validateRequest = require('../middleware/validateRequest');
const authController = require('../controllers/authController');
const createRateLimiter = require('../middleware/rateLimit');
const { requirePortalAccess } = require('../middleware/portalAccess');
const { getClientFingerprint, getClientIp } = require('../utils/request');
const {
  biometricDeviceIdParamValidation,
  changePasswordValidation,
  confirmPasswordChangeValidation,
  emailVerificationSendOtpValidation,
  emailVerificationUpdateEmailValidation,
  emailVerificationVerifyOtpValidation,
  forgotPasswordAccountValidation,
  forgotPasswordResetValidation,
  forgotPasswordStartValidation,
  forgotPasswordVerifyOtpValidation,
  loginValidation,
  portalAccessValidation,
  requestPasswordChangeValidation,
  registrationAvailabilityValidation,
  registerResendOtpValidation,
  registerValidation,
  registerVerifyOtpValidation,
  studentLoginStartValidation,
  studentLoginVerifyOtpValidation,
  webAuthnAuthenticationOptionsValidation,
  webAuthnAuthenticationVerifyValidation,
  webAuthnRegistrationOptionsValidation,
  webAuthnRegistrationVerifyValidation
} = require('../validators/authValidators');

function normalizeLookupValue(value) {
  return String(value || '').trim().toLowerCase();
}

function formatRetryWindow(retryAfterSeconds) {
  const minutes = Math.max(1, Math.ceil(Number(retryAfterSeconds || 0) / 60));
  return minutes === 1 ? 'about 1 minute' : `about ${minutes} minutes`;
}

function getLoginIdentifierKey(req) {
  return normalizeLookupValue(req.body?.identifier || req.body?.enrollment || req.body?.employeeId);
}

function getForgotPasswordIdentifierKey(req) {
  return normalizeLookupValue(req.body?.identifier || req.body?.enrollment || req.body?.employeeId);
}

function getRegisterIdentityKey(req) {
  const normalizedRole = normalizeLookupValue(req.body?.role);
  const normalizedEmail = normalizeLookupValue(req.body?.email);
  const primaryIdentifier = String(req.body?.enrollmentNo || req.body?.employeeId || req.body?.enrollment || '')
    .trim()
    .toUpperCase();

  return [normalizedRole, normalizedEmail, primaryIdentifier].filter(Boolean).join('|');
}

function getEmailKey(req) {
  return normalizeLookupValue(req.body?.email);
}

function getAuthenticatedUserKey(req) {
  return normalizeLookupValue(req.user?._id);
}

const router = express.Router();
const loginNetworkRateLimit = createRateLimiter({
  scope: 'auth:login:network',
  windowMs: 10 * 60 * 1000,
  blockDurationMs: 10 * 60 * 1000,
  max: 300,
  keyGenerator: getClientIp,
  message: ({ result }) =>
    `Too many sign-in requests from this network. Please wait ${formatRetryWindow(result.retryAfterSeconds)} and try again.`,
  errorCode: 'AUTH_LOGIN_NETWORK_RATE_LIMITED'
});
const loginAccountRateLimit = createRateLimiter({
  scope: 'auth:login:account-flow',
  windowMs: 10 * 60 * 1000,
  blockDurationMs: 10 * 60 * 1000,
  max: 30,
  keyGenerator: getLoginIdentifierKey,
  skip: (req) => !getLoginIdentifierKey(req),
  message: ({ result }) =>
    `Too many sign-in requests for this account. Please wait ${formatRetryWindow(result.retryAfterSeconds)} and try again.`,
  errorCode: 'AUTH_LOGIN_ACCOUNT_RATE_LIMITED',
  errors: ({ result }) => {
    const message = `Too many sign-in requests for this account. Please wait ${formatRetryWindow(result.retryAfterSeconds)} and try again.`;
    return [{ field: 'identifier', message }];
  }
});
const registerNetworkRateLimit = createRateLimiter({
  scope: 'auth:register:network',
  windowMs: 10 * 60 * 1000,
  blockDurationMs: 10 * 60 * 1000,
  max: 120,
  keyGenerator: getClientIp,
  message: ({ result }) =>
    `Too many account creation requests from this network. Please wait ${formatRetryWindow(result.retryAfterSeconds)} and try again.`,
  errorCode: 'AUTH_REGISTER_NETWORK_RATE_LIMITED'
});
const registerIdentityRateLimit = createRateLimiter({
  scope: 'auth:register:identity',
  windowMs: 30 * 60 * 1000,
  blockDurationMs: 30 * 60 * 1000,
  max: 6,
  keyGenerator: getRegisterIdentityKey,
  skip: (req) => !getRegisterIdentityKey(req),
  message: ({ result }) =>
    `Too many account creation attempts for the same details. Please wait ${formatRetryWindow(result.retryAfterSeconds)} and try again.`,
  errorCode: 'AUTH_REGISTER_IDENTITY_RATE_LIMITED'
});
const registerOtpVerifyRateLimit = createRateLimiter({
  scope: 'auth:register:verify-otp',
  windowMs: 10 * 60 * 1000,
  blockDurationMs: 10 * 60 * 1000,
  max: 20,
  keyGenerator: getEmailKey,
  skip: (req) => !getEmailKey(req),
  message: ({ result }) =>
    `Too many verification attempts for this email. Please wait ${formatRetryWindow(result.retryAfterSeconds)} and try again.`,
  errorCode: 'AUTH_REGISTER_OTP_RATE_LIMITED'
});
const registerOtpResendRateLimit = createRateLimiter({
  scope: 'auth:register:resend-otp',
  windowMs: 15 * 60 * 1000,
  blockDurationMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: getEmailKey,
  skip: (req) => !getEmailKey(req),
  message: ({ result }) =>
    `Too many OTP resend requests for this email. Please wait ${formatRetryWindow(result.retryAfterSeconds)} and try again.`,
  errorCode: 'AUTH_REGISTER_RESEND_RATE_LIMITED'
});
const forgotPasswordStartRateLimit = createRateLimiter({
  scope: 'auth:forgot-password:start',
  windowMs: 15 * 60 * 1000,
  blockDurationMs: 15 * 60 * 1000,
  max: 8,
  keyGenerator: getForgotPasswordIdentifierKey,
  skip: (req) => !getForgotPasswordIdentifierKey(req),
  message: ({ result }) =>
    `Too many password reset requests for this account. Please wait ${formatRetryWindow(result.retryAfterSeconds)} and try again.`,
  errorCode: 'AUTH_FORGOT_PASSWORD_START_RATE_LIMITED'
});
const emailVerificationSendRateLimit = createRateLimiter({
  scope: 'auth:email-verification:send',
  windowMs: 15 * 60 * 1000,
  blockDurationMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: getAuthenticatedUserKey,
  skip: (req) => !getAuthenticatedUserKey(req),
  message: ({ result }) =>
    `Too many email verification requests were made. Please wait ${formatRetryWindow(result.retryAfterSeconds)} and try again.`,
  errorCode: 'AUTH_EMAIL_VERIFICATION_SEND_RATE_LIMITED'
});
const emailVerificationVerifyRateLimit = createRateLimiter({
  scope: 'auth:email-verification:verify',
  windowMs: 10 * 60 * 1000,
  blockDurationMs: 10 * 60 * 1000,
  max: 20,
  keyGenerator: getAuthenticatedUserKey,
  skip: (req) => !getAuthenticatedUserKey(req),
  message: ({ result }) =>
    `Too many email verification attempts were made. Please wait ${formatRetryWindow(result.retryAfterSeconds)} and try again.`,
  errorCode: 'AUTH_EMAIL_VERIFICATION_VERIFY_RATE_LIMITED'
});
const emailVerificationEmailChangeRateLimit = createRateLimiter({
  scope: 'auth:email-verification:update-email',
  windowMs: 15 * 60 * 1000,
  blockDurationMs: 15 * 60 * 1000,
  max: 6,
  keyGenerator: getAuthenticatedUserKey,
  skip: (req) => !getAuthenticatedUserKey(req),
  message: ({ result }) =>
    `Too many verification email updates were requested. Please wait ${formatRetryWindow(result.retryAfterSeconds)} and try again.`,
  errorCode: 'AUTH_EMAIL_VERIFICATION_UPDATE_RATE_LIMITED'
});
const forgotPasswordVerifyRateLimit = createRateLimiter({
  scope: 'auth:forgot-password:verify-otp',
  windowMs: 10 * 60 * 1000,
  blockDurationMs: 10 * 60 * 1000,
  max: 20,
  keyGenerator: getEmailKey,
  skip: (req) => !getEmailKey(req),
  message: ({ result }) =>
    `Too many password reset OTP attempts for this email. Please wait ${formatRetryWindow(result.retryAfterSeconds)} and try again.`,
  errorCode: 'AUTH_FORGOT_PASSWORD_VERIFY_RATE_LIMITED'
});
const forgotPasswordResetRateLimit = createRateLimiter({
  scope: 'auth:forgot-password:reset',
  windowMs: 10 * 60 * 1000,
  blockDurationMs: 10 * 60 * 1000,
  max: 10,
  keyGenerator: getEmailKey,
  skip: (req) => !getEmailKey(req),
  message: ({ result }) =>
    `Too many password reset submissions for this email. Please wait ${formatRetryWindow(result.retryAfterSeconds)} and try again.`,
  errorCode: 'AUTH_FORGOT_PASSWORD_RESET_RATE_LIMITED'
});
const biometricRateLimit = createRateLimiter({
  scope: 'auth:webauthn:client',
  windowMs: 10 * 60 * 1000,
  blockDurationMs: 10 * 60 * 1000,
  max: 40,
  keyGenerator: getClientFingerprint,
  message: ({ result }) =>
    `Too many biometric authentication attempts. Please wait ${formatRetryWindow(result.retryAfterSeconds)} and try again.`,
  errorCode: 'AUTH_WEBAUTHN_RATE_LIMITED'
});

router.post('/portal-access', portalAccessValidation, validateRequest, authController.portalAccess);
router.post(
  '/register/check-availability',
  requirePortalAccess('faculty'),
  registerNetworkRateLimit,
  registrationAvailabilityValidation,
  validateRequest,
  authController.checkRegistrationAvailability
);
router.post(
  '/register/start',
  requirePortalAccess('faculty'),
  registerNetworkRateLimit,
  registerIdentityRateLimit,
  registerValidation,
  validateRequest,
  authController.registerStart
);
router.post(
  '/register/verify-otp',
  requirePortalAccess('faculty'),
  registerOtpVerifyRateLimit,
  registerVerifyOtpValidation,
  validateRequest,
  authController.verifyRegisterOtp
);
router.post(
  '/register/resend-otp',
  requirePortalAccess('faculty'),
  registerOtpResendRateLimit,
  registerResendOtpValidation,
  validateRequest,
  authController.resendRegisterOtp
);
router.post(
  '/register',
  requirePortalAccess('faculty'),
  registerNetworkRateLimit,
  registerIdentityRateLimit,
  registerValidation,
  validateRequest,
  authController.register
);
router.post(
  '/login',
  requirePortalAccess('faculty'),
  loginNetworkRateLimit,
  loginAccountRateLimit,
  loginValidation,
  validateRequest,
  authController.login
);
router.post(
  '/student-login-start',
  requirePortalAccess('student'),
  studentLoginStartValidation,
  validateRequest,
  authController.studentLoginStart
);
router.post(
  '/student-login-verify-otp',
  requirePortalAccess('student'),
  studentLoginVerifyOtpValidation,
  validateRequest,
  authController.studentLoginVerifyOtp
);
router.post(
  '/forgot-password/account',
  requirePortalAccess('faculty'),
  forgotPasswordStartRateLimit,
  forgotPasswordAccountValidation,
  validateRequest,
  authController.resolveForgotPasswordAccount
);
router.post(
  '/forgot-password/start',
  requirePortalAccess('faculty'),
  forgotPasswordStartRateLimit,
  forgotPasswordStartValidation,
  validateRequest,
  authController.forgotPasswordStart
);
router.post(
  '/forgot-password/verify-otp',
  requirePortalAccess('faculty'),
  forgotPasswordVerifyRateLimit,
  forgotPasswordVerifyOtpValidation,
  validateRequest,
  authController.verifyForgotPasswordOtp
);
router.post(
  '/forgot-password/reset',
  requirePortalAccess('faculty'),
  forgotPasswordResetRateLimit,
  forgotPasswordResetValidation,
  validateRequest,
  authController.resetForgotPassword
);
router.post(
  '/request-password-change',
  protect,
  authorize('student'),
  requestPasswordChangeValidation,
  validateRequest,
  authController.requestPasswordChange
);
router.post(
  '/confirm-password-change',
  protect,
  authorize('student'),
  confirmPasswordChangeValidation,
  validateRequest,
  authController.confirmPasswordChange
);
router.post(
  '/email-verification/send-otp',
  protect,
  emailVerificationSendRateLimit,
  emailVerificationSendOtpValidation,
  validateRequest,
  authController.sendEmailVerificationOtp
);
router.patch(
  '/email-verification/email',
  protect,
  emailVerificationEmailChangeRateLimit,
  emailVerificationUpdateEmailValidation,
  validateRequest,
  authController.updateEmailVerificationEmail
);
router.post(
  '/email-verification/verify-otp',
  protect,
  emailVerificationVerifyRateLimit,
  emailVerificationVerifyOtpValidation,
  validateRequest,
  authController.verifyEmailVerificationOtp
);
router.post('/logout', authController.logout);
router.get('/me', protect, authController.getMe);
router.get('/verify', protect, authController.verify);
router.patch('/change-password', protect, requireVerifiedEmail, changePasswordValidation, validateRequest, authController.changePassword);
router.get('/webauthn/devices', protect, requireVerifiedEmail, authController.getWebAuthnDevices);
router.delete(
  '/webauthn/devices/:deviceId',
  protect,
  requireVerifiedEmail,
  biometricDeviceIdParamValidation,
  validateRequest,
  authController.removeWebAuthnDevice
);
router.post(
  '/webauthn/register/options',
  protect,
  requireVerifiedEmail,
  webAuthnRegistrationOptionsValidation,
  validateRequest,
  authController.getWebAuthnRegistrationOptions
);
router.post(
  '/webauthn/register/verify',
  protect,
  requireVerifiedEmail,
  webAuthnRegistrationVerifyValidation,
  validateRequest,
  authController.verifyWebAuthnRegistration
);
router.post(
  '/webauthn/authentication/options',
  requirePortalAccess('faculty'),
  biometricRateLimit,
  webAuthnAuthenticationOptionsValidation,
  validateRequest,
  authController.getWebAuthnAuthenticationOptions
);
router.post(
  '/webauthn/authentication/verify',
  requirePortalAccess('faculty'),
  biometricRateLimit,
  webAuthnAuthenticationVerifyValidation,
  validateRequest,
  authController.verifyWebAuthnAuthentication
);

module.exports = router;
