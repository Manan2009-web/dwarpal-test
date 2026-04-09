const { sendSuccess } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { getRequestMeta } = require('../utils/request');
const userService = require('../services/userService');

const getProfile = asyncHandler(async (req, res) => {
  const profile = await userService.getProfile(req.user, req);
  return sendSuccess(res, {
    message: 'Profile fetched successfully',
    data: profile
  });
});

const updateProfile = asyncHandler(async (req, res) => {
  const profile = await userService.updateProfile(req.user, req.body, req, getRequestMeta(req));
  return sendSuccess(res, {
    message: 'Profile updated successfully',
    data: profile
  });
});

const uploadProfileImage = asyncHandler(async (req, res) => {
  const profile = await userService.uploadProfileImage(req.user, req.file, req, getRequestMeta(req));
  return sendSuccess(res, {
    message: 'Profile image uploaded successfully',
    data: profile
  });
});

module.exports = {
  getProfile,
  updateProfile,
  uploadProfileImage
};
