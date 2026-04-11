const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const validateRequest = require('../middleware/validateRequest');
const authController = require('../controllers/authController');
const createRateLimiter = require('../middleware/rateLimit');
const { getClientFingerprint, getClientIp } = require('../utils/request');
const {
  biometricDeviceIdParamValidation,
  changePasswordValidation,
  forgotPasswordValidation,
  loginValidation,
  registrationAvailabilityValidation,
  registerValidation,
  resetPasswordValidation,
  sendPhoneOtpValidation,
  verifyPhoneOtpValidation,
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
  return normalizeLookupValue(req.body?.identifier || req.body?.enrollment || req.body?.employeeId || req.body?.email);
}

function getRegisterIdentityKey(req) {
  const normalizedRole = normalizeLookupValue(req.body?.role);
  const normalizedEmail = normalizeLookupValue(req.body?.email);
  const primaryIdentifier = String(req.body?.enrollmentNo || req.body?.employeeId || req.body?.enrollment || '')
    .trim()
    .toUpperCase();

  return [normalizedRole, normalizedEmail, primaryIdentifier].filter(Boolean).join('|');
}

function getForgotPasswordKey(req) {
  return normalizeLookupValue(req.body?.email);
}

function getPhoneOtpKey(req) {
  return normalizeLookupValue(req.body?.phone);
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
const forgotPasswordNetworkRateLimit = createRateLimiter({
  scope: 'auth:forgot-password:network',
  windowMs: 15 * 60 * 1000,
  blockDurationMs: 15 * 60 * 1000,
  max: 60,
  keyGenerator: getClientIp,
  message: ({ result }) =>
    `Too many password reset requests from this network. Please wait ${formatRetryWindow(result.retryAfterSeconds)} and try again.`,
  errorCode: 'AUTH_FORGOT_PASSWORD_NETWORK_RATE_LIMITED'
});
const forgotPasswordIdentityRateLimit = createRateLimiter({
  scope: 'auth:forgot-password:email',
  windowMs: 30 * 60 * 1000,
  blockDurationMs: 30 * 60 * 1000,
  max: 5,
  keyGenerator: getForgotPasswordKey,
  skip: (req) => !getForgotPasswordKey(req),
  message: ({ result }) =>
    `Too many password reset requests for this email address. Please wait ${formatRetryWindow(result.retryAfterSeconds)} before requesting another reset link.`,
  errorCode: 'AUTH_FORGOT_PASSWORD_EMAIL_RATE_LIMITED',
  errors: ({ result }) => {
    const message = `Too many password reset requests for this email address. Please wait ${formatRetryWindow(result.retryAfterSeconds)} before requesting another reset link.`;
    return [{ field: 'email', message }];
  }
});
const phoneOtpSendNetworkRateLimit = createRateLimiter({
  scope: 'auth:phone-otp:send:network',
  windowMs: 15 * 60 * 1000,
  blockDurationMs: 15 * 60 * 1000,
  max: 80,
  keyGenerator: getClientIp,
  message: ({ result }) =>
    `Too many OTP requests from this network. Please wait ${formatRetryWindow(result.retryAfterSeconds)} and try again.`,
  errorCode: 'AUTH_PHONE_OTP_SEND_NETWORK_RATE_LIMITED'
});
const phoneOtpSendIdentityRateLimit = createRateLimiter({
  scope: 'auth:phone-otp:send:phone',
  windowMs: 30 * 60 * 1000,
  blockDurationMs: 30 * 60 * 1000,
  max: 6,
  keyGenerator: getPhoneOtpKey,
  skip: (req) => !getPhoneOtpKey(req),
  message: ({ result }) =>
    `Too many OTP requests for this phone number. Please wait ${formatRetryWindow(result.retryAfterSeconds)} before trying again.`,
  errorCode: 'AUTH_PHONE_OTP_SEND_PHONE_RATE_LIMITED',
  errors: ({ result }) => {
    const message = `Too many OTP requests for this phone number. Please wait ${formatRetryWindow(result.retryAfterSeconds)} before trying again.`;
    return [{ field: 'phone', message }];
  }
});
const phoneOtpVerifyNetworkRateLimit = createRateLimiter({
  scope: 'auth:phone-otp:verify:network',
  windowMs: 15 * 60 * 1000,
  blockDurationMs: 15 * 60 * 1000,
  max: 120,
  keyGenerator: getClientIp,
  message: ({ result }) =>
    `Too many OTP verification attempts from this network. Please wait ${formatRetryWindow(result.retryAfterSeconds)} and try again.`,
  errorCode: 'AUTH_PHONE_OTP_VERIFY_NETWORK_RATE_LIMITED'
});
const phoneOtpVerifyIdentityRateLimit = createRateLimiter({
  scope: 'auth:phone-otp:verify:phone',
  windowMs: 15 * 60 * 1000,
  blockDurationMs: 15 * 60 * 1000,
  max: 12,
  keyGenerator: getPhoneOtpKey,
  skip: (req) => !getPhoneOtpKey(req),
  message: ({ result }) =>
    `Too many OTP verification attempts for this phone number. Please wait ${formatRetryWindow(result.retryAfterSeconds)} before trying again.`,
  errorCode: 'AUTH_PHONE_OTP_VERIFY_PHONE_RATE_LIMITED',
  errors: ({ result }) => {
    const message = `Too many OTP verification attempts for this phone number. Please wait ${formatRetryWindow(result.retryAfterSeconds)} before trying again.`;
    return [{ field: 'otp', message }];
  }
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

router.post(
  '/register/check-availability',
  registerNetworkRateLimit,
  registrationAvailabilityValidation,
  validateRequest,
  authController.checkRegistrationAvailability
);
router.post(
  '/phone-otp/send',
  phoneOtpSendNetworkRateLimit,
  phoneOtpSendIdentityRateLimit,
  sendPhoneOtpValidation,
  validateRequest,
  authController.sendRegistrationOtp
);
router.post(
  '/phone-otp/verify',
  phoneOtpVerifyNetworkRateLimit,
  phoneOtpVerifyIdentityRateLimit,
  verifyPhoneOtpValidation,
  validateRequest,
  authController.verifyRegistrationOtp
);
router.post(
  '/register',
  registerNetworkRateLimit,
  registerIdentityRateLimit,
  registerValidation,
  validateRequest,
  authController.register
);
router.post('/login', loginNetworkRateLimit, loginAccountRateLimit, loginValidation, validateRequest, authController.login);
router.post('/logout', authController.logout);
router.get('/me', protect, authController.getMe);
router.get('/verify', protect, authController.verify);
router.patch('/change-password', protect, changePasswordValidation, validateRequest, authController.changePassword);
router.post(
  '/forgot-password',
  forgotPasswordNetworkRateLimit,
  forgotPasswordIdentityRateLimit,
  forgotPasswordValidation,
  validateRequest,
  authController.forgotPassword
);
router.post('/reset-password', resetPasswordValidation, validateRequest, authController.resetPassword);
router.get('/webauthn/devices', protect, authController.getWebAuthnDevices);
router.delete(
  '/webauthn/devices/:deviceId',
  protect,
  biometricDeviceIdParamValidation,
  validateRequest,
  authController.removeWebAuthnDevice
);
router.post(
  '/webauthn/register/options',
  protect,
  webAuthnRegistrationOptionsValidation,
  validateRequest,
  authController.getWebAuthnRegistrationOptions
);
router.post(
  '/webauthn/register/verify',
  protect,
  webAuthnRegistrationVerifyValidation,
  validateRequest,
  authController.verifyWebAuthnRegistration
);
router.post(
  '/webauthn/authentication/options',
  biometricRateLimit,
  webAuthnAuthenticationOptionsValidation,
  validateRequest,
  authController.getWebAuthnAuthenticationOptions
);
router.post(
  '/webauthn/authentication/verify',
  biometricRateLimit,
  webAuthnAuthenticationVerifyValidation,
  validateRequest,
  authController.verifyWebAuthnAuthentication
);

module.exports = router;
