const express = require('express');
const { protect, requireVerifiedEmail } = require('../middleware/authMiddleware');
const validateRequest = require('../middleware/validateRequest');
const { basePaginationQueryValidation } = require('../validators/queryValidators');
const {
  notificationIdParamValidation,
  saveNotificationTokenValidation,
  subscribePushNotificationValidation
} = require('../validators/notificationValidators');
const notificationController = require('../controllers/notificationController');

const router = express.Router();

router.use(protect, requireVerifiedEmail);

router.post('/save-token', saveNotificationTokenValidation, validateRequest, notificationController.saveToken);
router.post('/subscribe', subscribePushNotificationValidation, validateRequest, notificationController.subscribePush);
router.get('/', basePaginationQueryValidation, validateRequest, notificationController.listNotifications);
router.get('/unread-count', notificationController.getUnreadCount);
router.patch('/read-all', notificationController.markAllRead);
router.patch('/:id/read', notificationIdParamValidation, validateRequest, notificationController.markRead);

module.exports = router;
