const express = require('express');
const { protect, requireVerifiedEmail } = require('../middleware/authMiddleware');
const authorize = require('../middleware/authorize');
const validateRequest = require('../middleware/validateRequest');
const adminController = require('../controllers/adminController');
const { updateUserStatusValidation } = require('../validators/userValidators');

const router = express.Router();

router.post('/seed-default-admins', adminController.seedDefaultAdmins);
router.get('/analytics', protect, requireVerifiedEmail, authorize('principal', 'hod', 'cao'), adminController.getAnalytics);
router.get('/users', protect, requireVerifiedEmail, authorize('principal', 'cao'), adminController.listUsers);
router.patch('/users/:id/status', protect, requireVerifiedEmail, authorize('principal', 'cao'), updateUserStatusValidation, validateRequest, adminController.updateUserStatus);

module.exports = router;
