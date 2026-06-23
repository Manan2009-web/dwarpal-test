const DeviceToken = require('../models/DeviceToken');
const PushSubscription = require('../models/PushSubscription');
const env = require('../config/env');
const { getFirebaseMessagingService } = require('./firebaseAdminService');
const webpush = require('web-push');

if (env.enableWebPush && env.vapidPublicKey && env.vapidPrivateKey) {
  webpush.setVapidDetails(
    env.vapidEmail,
    env.vapidPublicKey,
    env.vapidPrivateKey
  );
}

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

  let successCount = 0;
  let failureCount = 0;
  let delivered = false;

  // 1. Firebase push notification (if configured)
  const messaging = getFirebaseMessagingService();
  if (messaging) {
    try {
      const deviceTokens = await DeviceToken.find({ userId }).select('token').lean();
      const tokens = deviceTokens.map((item) => item.token).filter(Boolean);

      if (tokens.length) {
        const relatedRoute = String(data.relatedRoute || '/app/notifications').trim() || '/app/notifications';
        const link = buildClientUrl(relatedRoute);
        const serializedData = serializeMessageData(title, message, {
          ...data,
          relatedRoute,
          link
        });
        const staleTokens = [];

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
            token: { $in: staleTokens }
          });
        }

        if (successCount > 0) {
          delivered = true;
        }
      }
    } catch (firebaseError) {
      console.error(`[notifications] Firebase push failed: ${firebaseError.message || firebaseError}`);
    }
  }

  // 2. Web Push (VAPID) notifications (if configured)
  if (env.enableWebPush && env.vapidPublicKey && env.vapidPrivateKey) {
    try {
      const subscriptions = await PushSubscription.find({ userId }).lean();
      if (subscriptions.length) {
        const relatedRoute = String(data.relatedRoute || '/app/notifications').trim() || '/app/notifications';
        const link = buildClientUrl(relatedRoute);
        
        const pushPayload = JSON.stringify({
          title,
          body: message,
          data: {
            ...data,
            relatedRoute,
            link
          }
        });

        const staleSubscriptions = [];

        const webPushPromises = subscriptions.map((sub) => {
          const pushSubscription = {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.keys.p256dh,
              auth: sub.keys.auth
            }
          };

          return webpush.sendNotification(pushSubscription, pushPayload)
            .then(() => {
              successCount++;
              delivered = true;
            })
            .catch(async (error) => {
              failureCount++;
              if (error.statusCode === 410 || error.statusCode === 404) {
                staleSubscriptions.push(sub._id);
              } else {
                console.error(`[notifications] Web push error for endpoint ${sub.endpoint}:`, error.message || error);
              }
            });
        });

        await Promise.all(webPushPromises);

        if (staleSubscriptions.length) {
          await PushSubscription.deleteMany({
            _id: { $in: staleSubscriptions }
          });
        }
      }
    } catch (webPushError) {
      console.error(`[notifications] Web push sending failed: ${webPushError.message || webPushError}`);
    }
  }

  return {
    delivered,
    successCount,
    failureCount
  };
}

module.exports = {
  saveDeviceToken,
  sendPushNotification
};
