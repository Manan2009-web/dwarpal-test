const express = require('express');
const { protect, requireVerifiedEmail } = require('../middleware/authMiddleware');
const authorize = require('../middleware/authorize');
const validateRequest = require('../middleware/validateRequest');
const adminController = require('../controllers/adminController');
const exportController = require('../controllers/exportController');
const { updateUserStatusValidation } = require('../validators/userValidators');
const {
  allowAdminAccess,
  allowExportAccess,
  requireAuth,
  scopeFilterMiddleware
} = require('../middleware/adminAccess');

const router = express.Router();

router.post('/seed-default-admins', adminController.seedDefaultAdmins);
router.get('/analytics', protect, requireVerifiedEmail, authorize('principal', 'hod', 'cao'), adminController.getAnalytics);
router.get('/users', protect, requireVerifiedEmail, authorize('principal', 'cao'), adminController.listUsers);
router.patch('/users/:id/status', protect, requireVerifiedEmail, authorize('principal', 'cao'), updateUserStatusValidation, validateRequest, adminController.updateUserStatus);
router.get('/export/options', requireAuth, requireVerifiedEmail, allowAdminAccess, scopeFilterMiddleware, exportController.getOptions);
router.get('/export/preview', requireAuth, requireVerifiedEmail, allowAdminAccess, scopeFilterMiddleware, exportController.getPreview);
router.post('/export/preview', requireAuth, requireVerifiedEmail, allowAdminAccess, scopeFilterMiddleware, exportController.getPreview);
router.post('/export/excel', requireAuth, requireVerifiedEmail, allowAdminAccess, allowExportAccess, scopeFilterMiddleware, exportController.exportExcel);
router.post('/export/pdf', requireAuth, requireVerifiedEmail, allowAdminAccess, allowExportAccess, scopeFilterMiddleware, exportController.exportPdf);
router.get('/export/history', requireAuth, requireVerifiedEmail, allowAdminAccess, scopeFilterMiddleware, exportController.getHistory);

module.exports = router;
