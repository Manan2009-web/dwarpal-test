const siteConfigService = require('../services/siteConfigService');
const { sendSuccess } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { getRequestMeta } = require('../utils/request');

const getPublicConfig = asyncHandler(async (req, res) => {
  const config = await siteConfigService.getPublicSiteConfig();
  return sendSuccess(res, {
    message: 'Public site configuration fetched successfully',
    data: config
  });
});

const getFullConfig = asyncHandler(async (req, res) => {
  const config = await siteConfigService.getFullSiteConfig();
  return sendSuccess(res, {
    message: 'Full site configuration fetched successfully',
    data: config
  });
});

const updateCms = asyncHandler(async (req, res) => {
  const updated = await siteConfigService.updateCmsConfig(
    req.body,
    req.user,
    getRequestMeta(req)
  );
  return sendSuccess(res, {
    message: 'CMS configuration updated successfully',
    data: updated
  });
});

const updateRules = asyncHandler(async (req, res) => {
  const updated = await siteConfigService.updateRulesConfig(
    req.body,
    req.user,
    getRequestMeta(req)
  );
  return sendSuccess(res, {
    message: 'Academic and gatepass rules updated successfully',
    data: updated
  });
});

const updateFeatures = asyncHandler(async (req, res) => {
  const updated = await siteConfigService.updateFeatureFlags(
    req.body,
    req.user,
    getRequestMeta(req)
  );
  return sendSuccess(res, {
    message: 'Feature flags updated successfully',
    data: updated
  });
});

const setLockdown = asyncHandler(async (req, res) => {
  const updated = await siteConfigService.setCampusLockdown(
    req.body,
    req.user,
    getRequestMeta(req)
  );
  return sendSuccess(res, {
    message: req.body.enabled ? 'Emergency Campus Lockdown Initiated' : 'Campus Lockdown Lifted',
    data: updated
  });
});

const getMasterUsers = asyncHandler(async (req, res) => {
  const result = await siteConfigService.getMasterUsers(req.query);
  return sendSuccess(res, {
    message: 'Master users fetched successfully',
    data: result.users,
    meta: result.meta
  });
});

const updateMasterUser = asyncHandler(async (req, res) => {
  const updated = await siteConfigService.updateMasterUser(
    req.params.id,
    req.body,
    req.user,
    getRequestMeta(req)
  );
  return sendSuccess(res, {
    message: 'User account updated successfully',
    data: updated
  });
});

const getSystemHealth = asyncHandler(async (req, res) => {
  const health = await siteConfigService.getSystemHealthOverview();
  return sendSuccess(res, {
    message: 'System health overview fetched successfully',
    data: health
  });
});

module.exports = {
  getPublicConfig,
  getFullConfig,
  updateCms,
  updateRules,
  updateFeatures,
  setLockdown,
  getMasterUsers,
  updateMasterUser,
  getSystemHealth
};
