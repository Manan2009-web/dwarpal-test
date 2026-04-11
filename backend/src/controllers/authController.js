const { sendSuccess } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { clearAuthCookie, setAuthCookie } = require('../utils/token');
const { getRequestMeta } = require('../utils/request');
const {
  clearWebAuthnStateCookie,
  readWebAuthnState,
  setWebAuthnStateCookie
} = require('../utils/webauthnState');
const authService = require('../services/authService');

const register = asyncHandler(async (req, res) => {
  const result = await authService.registerUser(req.body, req, getRequestMeta(req));

  return sendSuccess(res, {
    statusCode: 201,
    message: 'Account created successfully',
    data: result
  });
});

const checkRegistrationAvailability = asyncHandler(async (req, res) => {
  const result = await authService.checkRegistrationAvailability(req.body);

  return sendSuccess(res, {
    message: 'Registration details are available.',
    data: result
  });
});

const sendRegistrationOtp = asyncHandler(async (req, res) => {
  const result = await authService.sendRegistrationOtp(req.body, getRequestMeta(req));

  return sendSuccess(res, {
    message: result.message,
    data: result
  });
});

const verifyRegistrationOtp = asyncHandler(async (req, res) => {
  const result = await authService.verifyRegistrationOtp(req.body, getRequestMeta(req));

  return sendSuccess(res, {
    message: result.message,
    data: result
  });
});

const login = asyncHandler(async (req, res) => {
  const result = await authService.loginUser(req.body, req, getRequestMeta(req));
  setAuthCookie(res, result.token);

  return sendSuccess(res, {
    message: 'Login successful',
    data: result
  });
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

const forgotPassword = asyncHandler(async (req, res) => {
  const result = await authService.forgotPassword(req.body, getRequestMeta(req));

  return sendSuccess(res, {
    message: result.message,
    data: null
  });
});

const resetPassword = asyncHandler(async (req, res) => {
  const result = await authService.resetPassword(req.body, getRequestMeta(req));

  return sendSuccess(res, {
    message: result.message,
    data: null
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
  forgotPassword,
  getMe,
  getWebAuthnAuthenticationOptions,
  getWebAuthnDevices,
  getWebAuthnRegistrationOptions,
  login,
  logout,
  removeWebAuthnDevice,
  register,
  resetPassword,
  sendRegistrationOtp,
  verify,
  verifyRegistrationOtp,
  verifyWebAuthnAuthentication,
  verifyWebAuthnRegistration
};
