const env = require('../config/env');
const AppError = require('../utils/appError');
const { sendSuccess } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { getRequestMeta } = require('../utils/request');
const adminService = require('../services/adminService');

const seedDefaultAdmins = asyncHandler(async (req, res) => {
  const providedSeedKey = req.get('x-seed-key');

  if (!env.seedAdminKey || providedSeedKey !== env.seedAdminKey) {
    throw new AppError('Valid x-seed-key header is required to seed system accounts', 403);
  }

  const result = await adminService.seedDefaultAdmins({
    requestMeta: getRequestMeta(req)
  });

  return sendSuccess(res, {
    message: 'System account seeding completed',
    data: result
  });
});

const getAnalytics = asyncHandler(async (req, res) => {
  const analytics = await adminService.getAnalytics();
  return sendSuccess(res, {
    message: 'Analytics fetched successfully',
    data: analytics
  });
});

const listUsers = asyncHandler(async (req, res) => {
  const result = await adminService.listUsers(req.query);
  return sendSuccess(res, {
    message: 'Users fetched successfully',
    data: result.users,
    meta: result.meta
  });
});

const updateUserStatus = asyncHandler(async (req, res) => {
  const user = await adminService.updateUserStatus(
    req.params.id,
    req.user,
    req.body,
    getRequestMeta(req)
  );
  return sendSuccess(res, {
    message: 'User status updated successfully',
    data: user
  });
});

module.exports = {
  getAnalytics,
  listUsers,
  seedDefaultAdmins,
  updateUserStatus
};
