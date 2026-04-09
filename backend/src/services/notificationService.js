const Notification = require('../models/Notification');
const User = require('../models/User');
const AppError = require('../utils/appError');
const { buildPaginationMeta, getPagination } = require('../utils/pagination');
const {
  emitAllNotificationsRead,
  emitNotificationCreated,
  emitNotificationsRead
} = require('./realtimeService');

function toId(value) {
  return value?._id?.toString?.() || value?.toString?.() || '';
}

function normalizeStatus(value) {
  const normalizedValue = String(value || '')
    .trim()
    .toLowerCase();

  const supportedStatuses = new Set([
    'submitted',
    'pending',
    'forwarded',
    'approved',
    'rejected',
    'out',
    'returned',
    'cancelled',
    'info'
  ]);

  return supportedStatuses.has(normalizedValue) ? normalizedValue : 'info';
}

function resolveReferenceId(notification = {}) {
  const explicitReference =
    notification.referenceId ||
    notification.metadata?.referenceId ||
    notification.metadata?.passNumber ||
    notification.metadata?.gatepassId ||
    notification.metadata?.requestNumber ||
    notification.metadata?.requestId;

  return String(explicitReference || '')
    .trim()
    .toUpperCase();
}

function resolveRecordType(notification = {}) {
  if (notification.recordType) {
    return notification.recordType;
  }

  if (notification.facultyLeaveRequest) {
    return 'faculty_leave';
  }

  if (notification.gatepass) {
    return 'gatepass';
  }

  return 'system';
}

function buildRelatedRoute(recordType, referenceId, explicitRoute = '') {
  if (explicitRoute) {
    return explicitRoute;
  }

  if (!referenceId || recordType === 'system') {
    return '/app/notifications';
  }

  const searchParams = new URLSearchParams({ focus: referenceId });
  return `/app/dashboard?${searchParams.toString()}`;
}

function buildDefaultDedupeKey(notification, recipientId, recordType, referenceId, status) {
  const relatedRecordId =
    toId(notification.gatepass) ||
    toId(notification.facultyLeaveRequest) ||
    String(notification.resourceId || '').trim() ||
    referenceId ||
    'system';
  const detailScope = [
    notification.metadata?.workflow,
    notification.metadata?.action,
    notification.metadata?.stage,
    notification.metadata?.approvalLevel
  ]
    .filter(Boolean)
    .join(':');

  return [
    notification.type,
    recipientId,
    recordType,
    relatedRecordId,
    status,
    detailScope
  ]
    .filter(Boolean)
    .join(':')
    .toLowerCase();
}

function buildNotificationDetail(notification = {}) {
  if (notification.detail) {
    return notification.detail;
  }

  const applicantName = String(notification.metadata?.applicantName || '').trim();
  const department = String(notification.metadata?.department || '').trim();

  if (applicantName && department) {
    return `${applicantName} • ${department}`;
  }

  if (applicantName) {
    return applicantName;
  }

  if (department) {
    return department;
  }

  if (notification.senderName) {
    return `From ${notification.senderName}`;
  }

  return notification.recordType === 'faculty_leave'
    ? 'Faculty leave workflow update'
    : notification.recordType === 'gatepass'
      ? 'Gatepass workflow update'
      : 'DwarPal notification';
}

function mapNotificationDocument(notification = {}, overrides = {}) {
  const sender = notification.sender || {};
  const metadata = notification.metadata || {};
  const referenceId = resolveReferenceId(notification);
  const recordType = resolveRecordType(notification);

  return {
    id: toId(notification._id || notification.id),
    recipientId: toId(notification.recipient),
    recipientRole: notification.recipientRole || overrides.recipientRole || '',
    senderId: toId(sender._id || sender.id || notification.sender),
    senderRole: notification.senderRole || sender.role || overrides.senderRole || '',
    senderName: sender.fullName || overrides.senderName || metadata.senderName || '',
    title: notification.title || '',
    message: notification.message || '',
    type: notification.type || 'system',
    status: normalizeStatus(notification.status || metadata.status),
    recordType,
    relatedRoute: buildRelatedRoute(recordType, referenceId, notification.relatedRoute),
    referenceId,
    detail: buildNotificationDetail({
      ...notification,
      ...overrides,
      recordType,
      metadata,
      senderName: sender.fullName || overrides.senderName || metadata.senderName || ''
    }),
    isRead: Boolean(notification.isRead),
    readAt: notification.readAt ? new Date(notification.readAt).toISOString() : null,
    createdAt: notification.createdAt ? new Date(notification.createdAt).toISOString() : null,
    updatedAt: notification.updatedAt ? new Date(notification.updatedAt).toISOString() : null,
    metadata
  };
}

async function buildUserSummaryMaps(notifications = []) {
  const recipientIds = new Set();
  const senderIds = new Set();

  notifications.forEach((notification) => {
    const recipientId = toId(notification.recipient);
    const senderId = toId(notification.sender);

    if (recipientId) {
      recipientIds.add(recipientId);
    }

    if (senderId) {
      senderIds.add(senderId);
    }
  });

  const userIds = Array.from(new Set([...recipientIds, ...senderIds]));

  if (!userIds.length) {
    return {
      recipients: new Map(),
      senders: new Map()
    };
  }

  const users = await User.find({ _id: { $in: userIds } })
    .select('_id fullName role')
    .lean();

  const userMap = new Map(
    users.map((user) => [
      user._id.toString(),
      {
        fullName: user.fullName,
        role: user.role
      }
    ])
  );

  return {
    recipients: userMap,
    senders: userMap
  };
}

function buildNotificationPayload(notification, userMaps) {
  const recipientId = toId(notification.recipient);
  const senderId = toId(notification.sender);
  const recipientSummary = userMaps.recipients.get(recipientId) || {};
  const senderSummary = userMaps.senders.get(senderId) || {};
  const recordType = resolveRecordType(notification);
  const referenceId = resolveReferenceId(notification);
  const status = normalizeStatus(notification.status || notification.metadata?.status);

  return {
    recipient: recipientId,
    recipientRole: notification.recipientRole || recipientSummary.role,
    sender: senderId || null,
    senderRole: notification.senderRole || senderSummary.role || null,
    senderName: senderSummary.fullName || '',
    gatepass: toId(notification.gatepass) || null,
    facultyLeaveRequest: toId(notification.facultyLeaveRequest) || null,
    recordType,
    referenceId,
    title: String(notification.title || '').trim(),
    message: String(notification.message || '').trim(),
    type: notification.type,
    status,
    relatedRoute: buildRelatedRoute(recordType, referenceId, notification.relatedRoute),
    metadata: {
      ...(notification.metadata || {}),
      status,
      senderName: senderSummary.fullName || notification.metadata?.senderName || ''
    },
    dedupeKey:
      notification.dedupeKey ||
      buildDefaultDedupeKey(notification, recipientId, recordType, referenceId, status)
  };
}

async function persistNotification(notification, userMaps) {
  const payload = buildNotificationPayload(notification, userMaps);

  if (!payload.recipient || !payload.recipientRole || !payload.title || !payload.message || !payload.type) {
    return null;
  }

  let isNewRecord = false;
  let document = null;

  if (payload.dedupeKey) {
    try {
      document = await Notification.create(payload);
      isNewRecord = true;
    } catch (error) {
      if (error?.code !== 11000) {
        throw error;
      }

      document = await Notification.findOne({ dedupeKey: payload.dedupeKey });
    }
  } else {
    document = await Notification.create(payload);
    isNewRecord = true;
  }

  if (!document) {
    return null;
  }

  const mappedNotification = mapNotificationDocument(document.toObject(), {
    senderName: payload.metadata.senderName,
    recipientRole: payload.recipientRole,
    senderRole: payload.senderRole
  });

  if (isNewRecord) {
    emitNotificationCreated(mappedNotification);
  }

  return mappedNotification;
}

async function createBulkNotifications(notifications = []) {
  const sanitizedNotifications = notifications.filter(
    (item) => item && item.recipient && item.title && item.message && item.type
  );

  if (!sanitizedNotifications.length) {
    return [];
  }

  const userMaps = await buildUserSummaryMaps(sanitizedNotifications);
  const createdNotifications = [];

  for (const notification of sanitizedNotifications) {
    const createdNotification = await persistNotification(notification, userMaps);

    if (createdNotification) {
      createdNotifications.push(createdNotification);
    }
  }

  return createdNotifications;
}

async function getNotificationsForUser(actor, query = {}) {
  const { page, limit, skip } = getPagination(query, {
    defaultLimit: 50,
    maxLimit: 200
  });

  const filter = {
    recipient: actor._id
  };

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .populate('sender', 'fullName role')
      .lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({
      recipient: actor._id,
      isRead: false
    })
  ]);

  return {
    notifications: notifications.map((notification) => mapNotificationDocument(notification)),
    meta: buildPaginationMeta(total, page, limit),
    unreadCount
  };
}

async function getUnreadNotificationCount(actor) {
  return Notification.countDocuments({
    recipient: actor._id,
    isRead: false
  });
}

async function markNotificationAsRead(notificationId, actor) {
  const notification = await Notification.findOne({
    _id: notificationId,
    recipient: actor._id
  }).populate('sender', 'fullName role');

  if (!notification) {
    throw new AppError('Notification not found', 404);
  }

  if (!notification.isRead) {
    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();

    emitNotificationsRead(actor._id.toString(), [notification._id.toString()], notification.readAt.toISOString());
  }

  return mapNotificationDocument(notification.toObject({ depopulate: false }));
}

async function markAllNotificationsAsRead(actor) {
  const unreadNotifications = await Notification.find({
    recipient: actor._id,
    isRead: false
  }).select('_id');

  if (!unreadNotifications.length) {
    return {
      updatedCount: 0,
      notificationIds: [],
      readAt: null
    };
  }

  const readAt = new Date();
  const notificationIds = unreadNotifications.map((notification) => notification._id.toString());

  await Notification.updateMany(
    {
      _id: {
        $in: unreadNotifications.map((notification) => notification._id)
      }
    },
    {
      $set: {
        isRead: true,
        readAt
      }
    }
  );

  emitAllNotificationsRead(actor._id.toString(), readAt.toISOString());

  return {
    updatedCount: notificationIds.length,
    notificationIds,
    readAt: readAt.toISOString()
  };
}

module.exports = {
  createBulkNotifications,
  getNotificationsForUser,
  getUnreadNotificationCount,
  mapNotificationDocument,
  markAllNotificationsAsRead,
  markNotificationAsRead
};
