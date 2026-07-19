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
router.post('/students', protect, requireVerifiedEmail, authorize('it', 'admin'), adminStudentCreateValidation, validateRequest, adminController.createStudent);
router.put('/students/:id', protect, requireVerifiedEmail, authorize('it', 'admin'), adminStudentUpdateValidation, validateRequest, adminController.updateStudent);
router.delete('/students/:id', protect, requireVerifiedEmail, authorize('it', 'admin'), adminStudentDeleteValidation, validateRequest, adminController.deleteStudent);
router.get('/export/options', requireAuth, requireVerifiedEmail, allowAdminAccess, scopeFilterMiddleware, exportController.getOptions);
router.get('/export/preview', requireAuth, requireVerifiedEmail, allowAdminAccess, scopeFilterMiddleware, exportController.getPreview);
router.post('/export/preview', requireAuth, requireVerifiedEmail, allowAdminAccess, scopeFilterMiddleware, exportController.getPreview);
router.get('/export/records', requireAuth, requireVerifiedEmail, allowAdminAccess, scopeFilterMiddleware, exportController.getRecords);
router.post('/export/records', requireAuth, requireVerifiedEmail, allowAdminAccess, scopeFilterMiddleware, exportController.getRecords);
router.post('/export/excel', requireAuth, requireVerifiedEmail, allowAdminAccess, allowExportAccess, scopeFilterMiddleware, exportController.exportExcel);
router.post('/export/pdf', requireAuth, requireVerifiedEmail, allowAdminAccess, allowExportAccess, scopeFilterMiddleware, exportController.exportPdf);
router.get('/export/history', requireAuth, requireVerifiedEmail, allowAdminAccess, scopeFilterMiddleware, exportController.getHistory);

module.exports = router;
