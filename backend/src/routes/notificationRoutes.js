const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const validateRequest = require('../middleware/validateRequest');
const { basePaginationQueryValidation } = require('../validators/queryValidators');
const {
  notificationIdParamValidation
} = require('../validators/notificationValidators');
const notificationController = require('../controllers/notificationController');

const router = express.Router();

router.use(protect);

router.get('/', basePaginationQueryValidation, validateRequest, notificationController.listNotifications);
router.get('/unread-count', notificationController.getUnreadCount);
router.patch('/read-all', notificationController.markAllRead);
router.patch('/:id/read', notificationIdParamValidation, validateRequest, notificationController.markRead);

module.exports = router;
