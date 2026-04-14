const express = require('express');
const { protect, requireVerifiedEmail } = require('../middleware/authMiddleware');
const validateRequest = require('../middleware/validateRequest');
const { profileUpload } = require('../middleware/uploadMiddleware');
const dashboardController = require('../controllers/dashboardController');
const userController = require('../controllers/userController');
const { updateProfileValidation } = require('../validators/userValidators');
const { dashboardQueryValidation } = require('../validators/queryValidators');

const router = express.Router();

router.use(protect, requireVerifiedEmail);
router.get('/dashboard-summary', dashboardQueryValidation, validateRequest, dashboardController.getSummary);
router.get('/profile', userController.getProfile);
router.put('/profile', updateProfileValidation, validateRequest, userController.updateProfile);
router.patch('/profile', updateProfileValidation, validateRequest, userController.updateProfile);
router.post('/profile/photo', profileUpload.single('profileImage'), userController.uploadProfileImage);

module.exports = router;
