const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

let firebaseAdminApp = null;

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function resolveServiceAccount() {
  const inlineServiceAccount = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();

  if (inlineServiceAccount) {
    try {
      return JSON.parse(inlineServiceAccount);
    } catch (error) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.');
    }
  }

  const configuredPath = String(process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '').trim();
  const candidatePaths = [
    configuredPath ? path.resolve(configuredPath) : '',
    path.resolve(__dirname, 'firebase-key.json')
  ].filter(Boolean);

  for (const candidatePath of candidatePaths) {
    if (fs.existsSync(candidatePath)) {
      return readJsonFile(candidatePath);
    }
  }

  return null;
}

function getFirebaseAdminApp() {
  if (firebaseAdminApp) {
    return firebaseAdminApp;
  }

  const existingApp = admin.apps.find((app) => app.name === 'dwarpal-admin');
  if (existingApp) {
    firebaseAdminApp = existingApp;
    return firebaseAdminApp;
  }

  const serviceAccount = resolveServiceAccount();
  if (!serviceAccount) {
    return null;
  }

  firebaseAdminApp = admin.initializeApp(
    {
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id || process.env.FIREBASE_PROJECT_ID || undefined
    },
    'dwarpal-admin'
  );

  return firebaseAdminApp;
}

function getFirebaseAdminAuth() {
  const app = getFirebaseAdminApp();
  return app ? admin.auth(app) : null;
}

function isFirebaseAdminConfigured() {
  return Boolean(getFirebaseAdminApp());
}

module.exports = {
  getFirebaseAdminApp,
  getFirebaseAdminAuth,
  isFirebaseAdminConfigured
};
