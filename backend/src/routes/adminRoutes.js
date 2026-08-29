const express = require('express');
const { protect, requireVerifiedEmail } = require('../middleware/authMiddleware');
const authorize = require('../middleware/authorize');
const validateRequest = require('../middleware/validateRequest');
const adminController = require('../controllers/adminController');
const exportController = require('../controllers/exportController');
const { updateUserStatusValidation } = require('../validators/userValidators');
const {
  adminStudentCreateValidation,
  adminStudentDeleteValidation,
  adminStudentUpdateValidation
} = require('../validators/adminStudentValidators');
const {
  allowAdminAccess,
  allowExportAccess,
  requireAuth,
  scopeFilterMiddleware
} = require('../middleware/adminAccess');

const createRateLimiter = require('../middleware/rateLimit');
const env = require('../config/env');
const { ERROR_CODES } = require('../utils/appError');
const AppError = require('../utils/appError');

const router = express.Router();

// ── Seed endpoint rate limiter: max 3 attempts per hour per IP ──────────────
const seedRateLimit = createRateLimiter({
  scope: 'admin:seed',
  windowMs: 60 * 60 * 1000,
  blockDurationMs: 60 * 60 * 1000,
  max: 3,
  errorCode: ERROR_CODES.ERR_RATE_LIMITED
});

/**
 * Guard middleware for the seed endpoint.
 * Requires the x-seed-admin-key header to match SEED_ADMIN_KEY in .env.
 * If SEED_ADMIN_KEY is not set, the endpoint is disabled entirely.
 */
function requireSeedKey(req, res, next) {
  const configuredKey = env.seedAdminKey;

  if (!configuredKey) {
    return next(new AppError('Admin seeding is disabled on this server.', 403, null, ERROR_CODES.ERR_FORBIDDEN));
  }

  const providedKey = String(req.headers['x-seed-admin-key'] || '').trim();

  if (!providedKey || providedKey !== configuredKey) {
    return next(new AppError('Invalid or missing seed admin key.', 401, null, ERROR_CODES.ERR_AUTH_FAILED));
  }

  return next();
}

router.post('/seed-default-admins', seedRateLimit, requireSeedKey, adminController.seedDefaultAdmins);

router.get('/analytics', protect, requireVerifiedEmail, authorize('principal', 'hod', 'cao', 'admin'), adminController.getAnalytics);
router.get('/users', protect, requireVerifiedEmail, authorize('principal', 'cao', 'admin'), adminController.listUsers);
router.patch('/users/:id/status', protect, requireVerifiedEmail, authorize('principal', 'cao', 'admin'), updateUserStatusValidation, validateRequest, adminController.updateUserStatus);
router.get('/students/export-credentials', protect, requireVerifiedEmail, authorize('it', 'admin'), adminController.exportStudentCredentials);
router.get('/students', protect, requireVerifiedEmail, authorize('it', 'admin'), adminController.listStudents);
router.post('/students/bulk', protect, requireVerifiedEmail, authorize('it', 'admin'), adminController.bulkCreateStudents);
router.post('/students', protect, requireVerifiedEmail, authorize('it', 'admin'), adminStudentCreateValidation, validateRequest, adminController.createStudent);
router.put('/students/:id', protect, requireVerifiedEmail, authorize('it', 'admin'), adminStudentUpdateValidation, validateRequest, adminController.updateStudent);
router.delete('/students/:id', protect, requireVerifiedEmail, authorize('it', 'admin'), adminStudentDeleteValidation, validateRequest, adminController.deleteStudent);

// Email Queue & Management Controls
router.get('/email-queue/students', protect, requireVerifiedEmail, authorize('it', 'admin'), adminController.listQueueStudents);
router.get('/email-queue/stats', protect, requireVerifiedEmail, authorize('it', 'admin'), adminController.getQueueStats);
router.post('/email-queue/control', protect, requireVerifiedEmail, authorize('it', 'admin'), adminController.controlQueueWorker);
router.post('/email-queue/resend-all', protect, requireVerifiedEmail, authorize('it', 'admin'), adminController.queueAllStudents);
router.post('/email-queue/resend-selected', protect, requireVerifiedEmail, authorize('it', 'admin'), adminController.queueSelectedStudents);
router.post('/email-queue/retry-failed', protect, requireVerifiedEmail, authorize('it', 'admin'), adminController.retryFailedEmails);

const siteConfigController = require('../controllers/siteConfigController');

/**
 * Guard middleware for Master Control Hub.
 * Accepts either:
 *  1. x-master-key header (direct master terminal passcode authentication)
 *  2. Standard JWT session token for elevated admin roles (admin, it, chairman, principal, cao)
 */
function protectMasterOrAdmin(req, res, next) {
  const masterKey = String(req.headers['x-master-key'] || '').trim();
  const validMasterKeys = ['DwarPal@Root@2026', 'Master@2026', 'DwarPal@123', env.seedAdminKey].filter(Boolean);

  if (masterKey && validMasterKeys.includes(masterKey)) {
    req.user = {
      _id: 'master_root_admin',
      id: 'master_root_admin',
      fullName: 'Master Root Owner',
      role: 'admin',
      isMasterRoot: true,
      isActive: true,
      email: 'master@dwarpal.local'
    };
    return next();
  }

  // Fallback to standard JWT protect & authorize
  return protect(req, res, (err) => {
    if (err) return next(err);
    return authorize('it', 'admin', 'chairman', 'principal', 'cao')(req, res, next);
  });
}

// IT Notifications & System Errors
router.get('/it-notifications', protect, requireVerifiedEmail, authorize('it', 'admin'), adminController.listItNotifications);
router.get('/it-notifications/stats', protect, requireVerifiedEmail, authorize('it', 'admin'), adminController.getItNotificationStats);
router.post('/it-notifications/test', protect, requireVerifiedEmail, authorize('it', 'admin'), adminController.createTestItNotification);
router.post('/it-notifications/clear', protect, requireVerifiedEmail, authorize('it', 'admin'), adminController.clearItNotifications);

// Master Control & Global Site Configuration (Standalone Super Admin Terminal / IT / Chairman)
router.get('/site-config', protectMasterOrAdmin, siteConfigController.getFullConfig);
router.put('/site-config/cms', protectMasterOrAdmin, siteConfigController.updateCms);
router.put('/site-config/rules', protectMasterOrAdmin, siteConfigController.updateRules);
router.put('/site-config/features', protectMasterOrAdmin, siteConfigController.updateFeatures);
router.post('/site-config/lockdown', protectMasterOrAdmin, siteConfigController.setLockdown);
router.get('/site-config/master-users', protectMasterOrAdmin, siteConfigController.getMasterUsers);
router.patch('/site-config/master-users/:id', protectMasterOrAdmin, siteConfigController.updateMasterUser);
router.get('/site-config/system-health', protectMasterOrAdmin, siteConfigController.getSystemHealth);


router.get('/export/options', requireAuth, requireVerifiedEmail, allowAdminAccess, scopeFilterMiddleware, exportController.getOptions);
router.get('/export/preview', requireAuth, requireVerifiedEmail, allowAdminAccess, scopeFilterMiddleware, exportController.getPreview);
router.post('/export/preview', requireAuth, requireVerifiedEmail, allowAdminAccess, scopeFilterMiddleware, exportController.getPreview);
router.get('/export/records', requireAuth, requireVerifiedEmail, allowAdminAccess, scopeFilterMiddleware, exportController.getRecords);
router.post('/export/records', requireAuth, requireVerifiedEmail, allowAdminAccess, scopeFilterMiddleware, exportController.getRecords);
router.post('/export/excel', requireAuth, requireVerifiedEmail, allowAdminAccess, allowExportAccess, scopeFilterMiddleware, exportController.exportExcel);
router.post('/export/pdf', requireAuth, requireVerifiedEmail, allowAdminAccess, allowExportAccess, scopeFilterMiddleware, exportController.exportPdf);
router.get('/export/history', requireAuth, requireVerifiedEmail, allowAdminAccess, scopeFilterMiddleware, exportController.getHistory);

module.exports = router;
