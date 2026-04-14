const admin = require('firebase-admin');
const env = require('../config/env');

let firebaseApp = null;
let serviceAccountCache = null;
let serviceAccountResolved = false;

function parseServiceAccountJson(jsonValue) {
  if (!jsonValue) {
    return null;
  }

  try {
    return JSON.parse(jsonValue);
  } catch (error) {
    console.warn(`[firebase-admin] Unable to parse service account JSON: ${error.message || error}`);
    return null;
  }
}

function getServiceAccount() {
  if (serviceAccountResolved) {
    return serviceAccountCache;
  }

  serviceAccountResolved = true;

  if (env.firebaseServiceAccountBase64) {
    const decodedJson = Buffer.from(env.firebaseServiceAccountBase64, 'base64').toString('utf8');
    serviceAccountCache = parseServiceAccountJson(decodedJson);

    if (serviceAccountCache) {
      return serviceAccountCache;
    }
  }

  if (env.firebaseServiceAccountJson) {
    serviceAccountCache = parseServiceAccountJson(env.firebaseServiceAccountJson);

    if (serviceAccountCache) {
      return serviceAccountCache;
    }
  }

  if (env.firebaseProjectId && env.firebaseClientEmail && env.firebasePrivateKey) {
    serviceAccountCache = {
      projectId: env.firebaseProjectId,
      clientEmail: env.firebaseClientEmail,
      privateKey: env.firebasePrivateKey
    };
    return serviceAccountCache;
  }

  serviceAccountCache = null;
  return serviceAccountCache;
}

function isFirebaseAdminConfigured() {
  return Boolean(getServiceAccount());
}

function getFirebaseAdminApp() {
  const serviceAccount = getServiceAccount();

  if (!serviceAccount) {
    return null;
  }

  if (firebaseApp) {
    return firebaseApp;
  }

  firebaseApp =
    admin.apps.length > 0
      ? admin.app()
      : admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          ...(env.firebaseStorageBucket ? { storageBucket: env.firebaseStorageBucket } : {})
        });

  return firebaseApp;
}

function getFirebaseMessagingService() {
  const app = getFirebaseAdminApp();
  return app ? admin.messaging(app) : null;
}

module.exports = {
  getFirebaseMessagingService,
  isFirebaseAdminConfigured
};
