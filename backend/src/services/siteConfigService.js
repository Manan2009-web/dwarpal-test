const SiteConfig = require('../models/SiteConfig');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const Gatepass = require('../models/Gatepass');
const QueuedEmail = require('../models/QueuedEmail');
const AppError = require('../utils/appError');
const { ERROR_CODES } = require('../utils/appError');
const pickUser = require('../utils/pickUser');
const bcrypt = require('bcryptjs');

let cachedPublicConfig = null;
let cachedConfigTimestamp = 0;
const CACHE_TTL_MS = 15000; // 15s in-memory cache for ultra-fast response

async function getOrCreateSiteConfig() {
  let config = await SiteConfig.findOne({ singletonKey: 'dwarpal_global_config' }).populate('lastUpdatedBy', 'name email role');

  if (!config) {
    config = await SiteConfig.create({
      singletonKey: 'dwarpal_global_config'
    });
  }

  return config;
}

function invalidateConfigCache() {
  cachedPublicConfig = null;
  cachedConfigTimestamp = 0;
}

async function getPublicSiteConfig() {
  const now = Date.now();
  if (cachedPublicConfig && now - cachedConfigTimestamp < CACHE_TTL_MS) {
    return cachedPublicConfig;
  }

  const config = await getOrCreateSiteConfig();

  const publicData = {
    cms: {
      hero: config.cms.hero,
      announcementBanner: config.cms.announcementBanner,
      support: config.cms.support,
      faqs: config.cms.faqs,
      branding: config.cms.branding
    },
    rules: {
      departments: config.rules.departments,
      programs: config.rules.programs,
      semesters: config.rules.semesters,
      gatepass: {
        minReasonLength: config.rules.gatepass.minReasonLength,
        maxReasonLength: config.rules.gatepass.maxReasonLength,
        allowedCheckoutStartHour: config.rules.gatepass.allowedCheckoutStartHour,
        allowedCheckoutEndHour: config.rules.gatepass.allowedCheckoutEndHour,
        curfewReturnHour: config.rules.gatepass.curfewReturnHour,
        allowWeekendPasses: config.rules.gatepass.allowWeekendPasses
      }
    },
    features: {
      maintenanceMode: {
        enabled: Boolean(config.features.maintenanceMode?.enabled),
        message: config.features.maintenanceMode?.message || ''
      },
      campusLockdown: {
        enabled: Boolean(config.features.campusLockdown?.enabled),
        reason: config.features.campusLockdown?.reason || ''
      },
      studentSelfRegistration: {
        enabled: Boolean(config.features.studentSelfRegistration?.enabled),
        notice: config.features.studentSelfRegistration?.notice || ''
      },
      biometricAuth: {
        enabled: Boolean(config.features.biometricAuth?.enabled)
      }
    }
  };

  cachedPublicConfig = publicData;
  cachedConfigTimestamp = now;

  return publicData;
}

async function getFullSiteConfig() {
  return getOrCreateSiteConfig();
}

async function updateCmsConfig(cmsData, actor, requestMeta = {}) {
  const config = await getOrCreateSiteConfig();

  if (cmsData.hero) {
    config.cms.hero = { ...config.cms.hero.toObject(), ...cmsData.hero };
  }
  if (cmsData.announcementBanner) {
    config.cms.announcementBanner = { ...config.cms.announcementBanner.toObject(), ...cmsData.announcementBanner };
  }
  if (cmsData.support) {
    config.cms.support = { ...config.cms.support.toObject(), ...cmsData.support };
  }
  if (Array.isArray(cmsData.faqs)) {
    config.cms.faqs = cmsData.faqs;
  }
  if (cmsData.branding) {
    config.cms.branding = { ...config.cms.branding.toObject(), ...cmsData.branding };
  }

  config.lastUpdatedBy = actor?._id || null;
  await config.save();
  invalidateConfigCache();

  await AuditLog.create({
    actor: actor?._id || null,
    resourceType: 'SiteConfig',
    resourceId: config._id.toString(),
    action: 'UPDATE_CMS',
    message: `CMS configuration updated by ${actor?.name || 'Admin'}`,
    metadata: { updatedSections: Object.keys(cmsData) },
    ipAddress: requestMeta.ipAddress || '',
    userAgent: requestMeta.userAgent || ''
  }).catch(() => {});

  return config;
}

async function updateRulesConfig(rulesData, actor, requestMeta = {}) {
  const config = await getOrCreateSiteConfig();

  if (Array.isArray(rulesData.departments)) {
    config.rules.departments = rulesData.departments.map((d) => String(d).trim()).filter(Boolean);
  }
  if (Array.isArray(rulesData.programs)) {
    config.rules.programs = rulesData.programs.map((p) => String(p).trim()).filter(Boolean);
  }
  if (Array.isArray(rulesData.semesters)) {
    config.rules.semesters = rulesData.semesters.map((s) => Number(s)).filter((s) => !Number.isNaN(s));
  }
  if (rulesData.gatepass) {
    config.rules.gatepass = { ...config.rules.gatepass.toObject(), ...rulesData.gatepass };
  }

  config.lastUpdatedBy = actor?._id || null;
  await config.save();
  invalidateConfigCache();

  await AuditLog.create({
    actor: actor?._id || null,
    resourceType: 'SiteConfig',
    resourceId: config._id.toString(),
    action: 'UPDATE_RULES',
    message: `Academic and gatepass rules updated by ${actor?.name || 'Admin'}`,
    metadata: { updatedRules: Object.keys(rulesData) },
    ipAddress: requestMeta.ipAddress || '',
    userAgent: requestMeta.userAgent || ''
  }).catch(() => {});

  return config;
}

async function updateFeatureFlags(featuresData, actor, requestMeta = {}) {
  const config = await getOrCreateSiteConfig();

  if (featuresData.maintenanceMode) {
    config.features.maintenanceMode = {
      ...config.features.maintenanceMode.toObject(),
      ...featuresData.maintenanceMode
    };
  }
  if (featuresData.studentSelfRegistration) {
    config.features.studentSelfRegistration = {
      ...config.features.studentSelfRegistration.toObject(),
      ...featuresData.studentSelfRegistration
    };
  }
  if (featuresData.biometricAuth) {
    config.features.biometricAuth = {
      ...config.features.biometricAuth.toObject(),
      ...featuresData.biometricAuth
    };
  }
  if (featuresData.emailNotifications) {
    config.features.emailNotifications = {
      ...config.features.emailNotifications.toObject(),
      ...featuresData.emailNotifications
    };
  }
  if (featuresData.pushNotifications) {
    config.features.pushNotifications = {
      ...config.features.pushNotifications.toObject(),
      ...featuresData.pushNotifications
    };
  }

  config.lastUpdatedBy = actor?._id || null;
  await config.save();
  invalidateConfigCache();

  await AuditLog.create({
    actor: actor?._id || null,
    resourceType: 'SiteConfig',
    resourceId: config._id.toString(),
    action: 'UPDATE_FEATURE_FLAGS',
    message: `Feature flags updated by ${actor?.name || 'Admin'}`,
    metadata: { features: featuresData },
    ipAddress: requestMeta.ipAddress || '',
    userAgent: requestMeta.userAgent || ''
  }).catch(() => {});

  return config;
}

async function setCampusLockdown(lockdownData, actor, requestMeta = {}) {
  const config = await getOrCreateSiteConfig();
  const enabled = Boolean(lockdownData.enabled);

  config.features.campusLockdown = {
    enabled,
    reason: String(lockdownData.reason || '').trim(),
    initiatedAt: enabled ? new Date() : null,
    initiatedBy: enabled ? actor?._id || null : null
  };

  config.lastUpdatedBy = actor?._id || null;
  await config.save();
  invalidateConfigCache();

  await AuditLog.create({
    actor: actor?._id || null,
    resourceType: 'SiteConfig',
    resourceId: config._id.toString(),
    action: enabled ? 'CAMPUS_LOCKDOWN_INITIATED' : 'CAMPUS_LOCKDOWN_LIFTED',
    message: enabled
      ? `EMERGENCY: Campus lockdown initiated by ${actor?.name || 'Admin'} (${lockdownData.reason || 'No reason specified'})`
      : `Campus lockdown lifted by ${actor?.name || 'Admin'}`,
    metadata: { reason: lockdownData.reason },
    ipAddress: requestMeta.ipAddress || '',
    userAgent: requestMeta.userAgent || ''
  }).catch(() => {});

  return config;
}

async function getMasterUsers(query = {}) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);
  const skip = (page - 1) * limit;

  const filter = {};

  if (query.role && query.role !== 'all') {
    filter.role = query.role;
  }

  if (query.department && query.department !== 'all') {
    filter.department = query.department;
  }

  if (query.status && query.status !== 'all') {
    filter.status = query.status;
  }

  if (query.search) {
    const searchRegex = new RegExp(query.search.trim(), 'i');
    filter.$or = [
      { name: searchRegex },
      { email: searchRegex },
      { enrollment: searchRegex },
      { employeeId: searchRegex },
      { phone: searchRegex }
    ];
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(filter)
  ]);

  return {
    users: users.map((u) => pickUser(u)),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1
    }
  };
}

async function updateMasterUser(userId, payload, actor, requestMeta = {}) {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404, null, ERROR_CODES.ERR_NOT_FOUND);
  }

  const changes = {};

  if (payload.role && payload.role !== user.role) {
    changes.previousRole = user.role;
    changes.newRole = payload.role;
    user.role = payload.role;
  }

  if (payload.department !== undefined) {
    user.department = payload.department;
  }

  if (payload.program !== undefined) {
    user.program = payload.program;
  }

  if (payload.status && ['active', 'suspended', 'pending'].includes(payload.status)) {
    changes.previousStatus = user.status;
    changes.newStatus = payload.status;
    user.status = payload.status;
  }

  if (payload.newPassword && String(payload.newPassword).length >= 6) {
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(payload.newPassword, salt);
    changes.passwordReset = true;
  }

  await user.save();

  await AuditLog.create({
    actor: actor?._id || null,
    resourceType: 'User',
    resourceId: user._id.toString(),
    action: 'MASTER_USER_UPDATE',
    message: `Master User ${user.name} (${user.email}) updated by ${actor?.name || 'Admin'}`,
    metadata: changes,
    ipAddress: requestMeta.ipAddress || '',
    userAgent: requestMeta.userAgent || ''
  }).catch(() => {});

  return pickUser(user);
}

async function getSystemHealthOverview() {
  const [
    totalUsers,
    totalGatepasses,
    pendingGatepasses,
    totalLogs,
    usersByRole,
    recentAuditLogs,
    emailQueueCount
  ] = await Promise.all([
    User.countDocuments(),
    Gatepass.countDocuments(),
    Gatepass.countDocuments({ status: 'pending' }),
    AuditLog.countDocuments(),
    User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]),
    AuditLog.find()
      .sort({ createdAt: -1 })
      .limit(15)
      .populate('actor', 'name email role')
      .lean(),
    QueuedEmail.countDocuments({ status: 'pending' }).catch(() => 0)
  ]);

  const roleCounts = usersByRole.reduce((acc, item) => {
    acc[item._id || 'unknown'] = item.count;
    return acc;
  }, {});

  return {
    status: 'healthy',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date(),
    metrics: {
      totalUsers,
      totalGatepasses,
      pendingGatepasses,
      totalAuditLogs: totalLogs,
      pendingEmailQueue: emailQueueCount,
      roleDistribution: roleCounts
    },
    recentAuditLogs
  };
}

module.exports = {
  getOrCreateSiteConfig,
  getPublicSiteConfig,
  getFullSiteConfig,
  updateCmsConfig,
  updateRulesConfig,
  updateFeatureFlags,
  setCampusLockdown,
  getMasterUsers,
  updateMasterUser,
  getSystemHealthOverview
};
