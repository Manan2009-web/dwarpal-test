const env = require('../config/env');
const { sendSuccess } = require('../utils/apiResponse');

function buildPublicFirebaseConfig() {
  const webPushConfig = typeof env.getWebPushConfig === 'function' ? env.getWebPushConfig() : null;
  const messagingEnabled = Boolean(webPushConfig?.enabled && webPushConfig?.isComplete);

  return {
    firebase: messagingEnabled ? webPushConfig.firebase : null,
    messagingEnabled
  };
}

function getFrontendConfig(req, res) {
  const publicConfig = buildPublicFirebaseConfig();

  return sendSuccess(res, {
    message: 'Public frontend configuration fetched successfully.',
    data: {
      features: {
        firebaseMessagingEnabled: publicConfig.messagingEnabled
      },
      firebase: publicConfig.firebase,
      defaults: {
        phoneCountryCode: env.defaultPhoneCountryCode
      }
    }
  });
}

module.exports = {
  getFrontendConfig
};
