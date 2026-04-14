const DeviceToken = require('../models/DeviceToken');
const env = require('../config/env');
const { getFirebaseMessagingService } = require('./firebaseAdminService');

const INVALID_TOKEN_ERROR_CODES = new Set([
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered'
]);
const MAX_MULTICAST_TOKENS = 500;

function buildClientUrl(pathname = '/') {
  const baseUrl = env.clientUrl || env.serverUrl || 'http://localhost:5173';

  try {
    return new URL(pathname, baseUrl).toString();
  } catch {
    return pathname;
  }
}

function normalizeDeviceLabel(value) {
  const normalizedValue = String(value || '').trim();
  return normalizedValue ? normalizedValue.slice(0, 200) : 'Web browser';
}

function maskToken(token) {
  const normalizedToken = String(token || '').trim();

  if (normalizedToken.length <= 12) {
    return normalizedToken;
  }

  return `${normalizedToken.slice(0, 8)}...${normalizedToken.slice(-4)}`;
}

function serializeMessageData(title, message, data = {}) {
  return Object.entries({
    title,
    message,
    ...data
  }).reduce((payload, [key, value]) => {
    if (value === undefined || value === null) {
      return payload;
    }

    payload[key] = typeof value === 'string' ? value : JSON.stringify(value);
    return payload;
  }, {});
}

async function saveDeviceToken(userId, token, device) {
  const normalizedToken = String(token || '').trim();

  if (!normalizedToken) {
    return null;
  }

  const savedToken = await DeviceToken.findOneAndUpdate(
    {
      token: normalizedToken
    },
    {
      $set: {
        userId,
        token: normalizedToken,
        device: normalizeDeviceLabel(device)
      }
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }
  ).lean();

  return {
    id: savedToken?._id?.toString() || '',
    device: savedToken?.device || 'Web browser',
    tokenPreview: maskToken(savedToken?.token),
    updatedAt: savedToken?.updatedAt ? new Date(savedToken.updatedAt).toISOString() : null
  };
}

async function sendPushNotification(userId, title, message, data = {}) {
  if (!userId || !title || !message) {
    return {
      delivered: false,
      successCount: 0,
      failureCount: 0,
      reason: 'invalid_payload'
    };
  }

  const messaging = getFirebaseMessagingService();

  if (!messaging) {
    return {
      delivered: false,
      successCount: 0,
      failureCount: 0,
      reason: 'firebase_not_configured'
    };
  }

  const deviceTokens = await DeviceToken.find({
    userId
  })
    .select('token')
    .lean();
  const tokens = deviceTokens.map((item) => item.token).filter(Boolean);

  if (!tokens.length) {
    return {
      delivered: false,
      successCount: 0,
      failureCount: 0,
      reason: 'no_device_tokens'
    };
  }

  const relatedRoute = String(data.relatedRoute || '/app/notifications').trim() || '/app/notifications';
  const link = buildClientUrl(relatedRoute);
  const serializedData = serializeMessageData(title, message, {
    ...data,
    relatedRoute,
    link
  });
  const staleTokens = [];
  let successCount = 0;
  let failureCount = 0;

  for (let index = 0; index < tokens.length; index += MAX_MULTICAST_TOKENS) {
    const batchTokens = tokens.slice(index, index + MAX_MULTICAST_TOKENS);
    const response = await messaging.sendEachForMulticast({
      tokens: batchTokens,
      data: serializedData,
      webpush: {
        fcmOptions: {
          link
        }
      }
    });

    successCount += response.successCount;
    failureCount += response.failureCount;

    response.responses.forEach((result, batchIndex) => {
      if (!result.success && INVALID_TOKEN_ERROR_CODES.has(result.error?.code)) {
        staleTokens.push(batchTokens[batchIndex]);
      }
    });
  }

  if (staleTokens.length) {
    await DeviceToken.deleteMany({
      token: {
        $in: staleTokens
      }
    });
  }

  return {
    delivered: successCount > 0,
    successCount,
    failureCount
  };
}

module.exports = {
  saveDeviceToken,
  sendPushNotification
};
