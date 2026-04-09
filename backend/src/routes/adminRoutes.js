const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const authorize = require('../middleware/authorize');
const validateRequest = require('../middleware/validateRequest');
const adminController = require('../controllers/adminController');
const { updateUserStatusValidation } = require('../validators/userValidators');

const router = express.Router();

router.post('/seed-default-admins', adminController.seedDefaultAdmins);
router.get('/analytics', protect, authorize('principal', 'hod', 'cao'), adminController.getAnalytics);
router.get('/users', protect, authorize('principal', 'cao'), adminController.listUsers);
router.patch('/users/:id/status', protect, authorize('principal', 'cao'), updateUserStatusValidation, validateRequest, adminController.updateUserStatus);

module.exports = router;
