const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');
const { saveDeviceToken } = require('../services/pushNotificationService');
const PushSubscription = require('../models/PushSubscription');
const {
  createBulkNotifications,
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

const subscribePush = asyncHandler(async (req, res) => {
  const { endpoint, keys } = req.body;

  const result = await PushSubscription.findOneAndUpdate(
    { endpoint },
    {
      $set: {
        userId: req.user._id,
        endpoint,
        keys: {
          p256dh: keys.p256dh,
          auth: keys.auth
        }
      }
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }
  ).lean();

  return sendSuccess(res, {
    statusCode: 201,
    message: 'Web push subscription saved successfully',
    data: {
      id: result._id.toString(),
      endpoint: result.endpoint
    }
  });
});

const sendTestNotification = asyncHandler(async (req, res) => {
  const testReference = `TEST-${Date.now().toString(36).toUpperCase()}`;

  const createdNotifications = await createBulkNotifications([
    {
      recipient: req.user._id,
      recipientRole: req.user.role,
      sender: req.user._id,
      senderRole: req.user.role,
      title: '🔔 DwarPal Notification Test',
      message: 'Great! Notifications are fully active on your device with sound, haptic vibration, and real-time sync.',
      type: 'system',
      status: 'info',
      recordType: 'system',
      referenceId: testReference,
      relatedRoute: '/app/notifications',
      detail: 'Mobile and desktop notification verification test',
      metadata: {
        isTest: true,
        source: 'test_notification_button',
        testedAt: new Date().toISOString()
      }
    }
  ]);

  const activeSubscriptions = await PushSubscription.countDocuments({ userId: req.user._id });

  return sendSuccess(res, {
    statusCode: 201,
    message:
      activeSubscriptions > 0
        ? `Test notification sent to ${activeSubscriptions} registered push device(s)`
        : 'Test notification created (no push devices registered yet)',
    data: {
      notification: createdNotifications[0] || null,
      activePushDevices: activeSubscriptions
    }
  });
});

module.exports = {
  getUnreadCount,
  listNotifications,
  markAllRead,
  markRead,
  saveToken,
  sendTestNotification,
  subscribePush
};
