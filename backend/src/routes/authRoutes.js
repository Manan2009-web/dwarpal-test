const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const validateRequest = require('../middleware/validateRequest');
const authController = require('../controllers/authController');
const createRateLimiter = require('../middleware/rateLimit');
const {
  biometricDeviceIdParamValidation,
  changePasswordValidation,
  forgotPasswordValidation,
  loginValidation,
  registerValidation,
  resetPasswordValidation,
  webAuthnAuthenticationOptionsValidation,
  webAuthnAuthenticationVerifyValidation,
  webAuthnRegistrationOptionsValidation,
  webAuthnRegistrationVerifyValidation
} = require('../validators/authValidators');

const router = express.Router();
const loginRateLimit = createRateLimiter({
  max: 10,
  message: 'Too many login attempts. Please wait a few minutes and try again.'
});
const biometricRateLimit = createRateLimiter({
  max: 20,
  message: 'Too many biometric authentication attempts. Please wait a few minutes and try again.'
});

router.post('/register', loginRateLimit, registerValidation, validateRequest, authController.register);
router.post('/login', loginRateLimit, loginValidation, validateRequest, authController.login);
router.post('/logout', authController.logout);
router.get('/me', protect, authController.getMe);
router.get('/verify', protect, authController.verify);
router.patch('/change-password', protect, changePasswordValidation, validateRequest, authController.changePassword);
router.post('/forgot-password', forgotPasswordValidation, validateRequest, authController.forgotPassword);
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
