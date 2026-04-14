const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const { saveDeviceToken } = require('../services/pushNotificationService');
const {
  getNotificationsForUser,
  getUnreadNotificationCount,
  markAllNotificationsAsRead,
  markNotificationAsRead
} = require('../services/notificationService');

const listNotifications = asyncHandler(async (req, res) => {
  const result = await getNotificationsForUser(req.user, req.query);

  return sendSuccess(res, {
    message: 'Notifications fetched successfully',
    data: result.notifications,
    meta: {
      ...result.meta,
      unreadCount: result.unreadCount
    }
  });
});

const getUnreadCount = asyncHandler(async (req, res) => {
  const unreadCount = await getUnreadNotificationCount(req.user);

  return sendSuccess(res, {
    message: 'Unread notification count fetched successfully',
    data: {
      unreadCount
    }
  });
});

const markRead = asyncHandler(async (req, res) => {
  const notification = await markNotificationAsRead(req.params.id, req.user);

  return sendSuccess(res, {
    message: 'Notification marked as read',
    data: notification
  });
});

const markAllRead = asyncHandler(async (req, res) => {
  const result = await markAllNotificationsAsRead(req.user);

  return sendSuccess(res, {
    message: result.updatedCount ? 'Notifications marked as read' : 'All notifications were already read',
    data: result
  });
});

const saveToken = asyncHandler(async (req, res) => {
  const result = await saveDeviceToken(req.user._id, req.body.token, req.body.device || req.get('user-agent'));

  return sendSuccess(res, {
    statusCode: result ? 201 : 200,
    message: 'Device token saved successfully',
    data: result
  });
});

module.exports = {
  getUnreadCount,
  listNotifications,
  markAllRead,
  markRead,
  saveToken
};
