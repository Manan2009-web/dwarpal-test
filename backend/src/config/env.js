const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const backendRoot = path.resolve(__dirname, '..', '..');
const backendEnvPath = path.join(backendRoot, '.env');
const cwdEnvPath = path.resolve(process.cwd(), '.env');
const resolvedEnvPath = fs.existsSync(backendEnvPath) ? backendEnvPath : cwdEnvPath;

dotenv.config({ path: resolvedEnvPath });

const DEFAULT_FRONTEND_PORTS = ['5173', '4173'];
const DEFAULT_AUTH_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://dwarpal-test.vercel.app',
  'http://localhost:4173',
  'http://127.0.0.1:4173'
];

function normalizeEnvString(value) {
  return String(value || '').trim();
}

function normalizeUrl(value) {
  return normalizeEnvString(value).replace(/\/+$/, '');
}

function safeParseUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function buildFrontendOriginsForUrl(value) {
  const parsedUrl = safeParseUrl(value);

  if (!parsedUrl) {
    return [];
  }

  return DEFAULT_FRONTEND_PORTS.map((port) => normalizeUrl(`${parsedUrl.protocol}//${parsedUrl.hostname}:${port}`));
}

function parseBooleanEnv(value, defaultValue = false) {
  const normalizedValue = normalizeEnvString(value).toLowerCase();

  if (!normalizedValue) {
    return defaultValue;
  }

  if (['true', '1', 'yes', 'on'].includes(normalizedValue)) {
    return true;
  }

  if (['false', '0', 'no', 'off'].includes(normalizedValue)) {
    return false;
  }

  return defaultValue;
}

function parsePositiveIntegerEnv(value, fallbackValue) {
  const numericValue = Number.parseInt(normalizeEnvString(value), 10);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : fallbackValue;
}

function parseEmailIdentity(value) {
  const normalizedValue = normalizeEnvString(value).replace(/^"+|"+$/g, '');

  if (!normalizedValue) {
    return {
      email: '',
      name: '',
    };
  }

  const angleBracketMatch = normalizedValue.match(/^(?:"?([^"]*?)"?\s*)?<([^>]+)>$/);

  if (angleBracketMatch) {
    return {
      name: normalizeEnvString(angleBracketMatch[1]),
      email: normalizeEnvString(angleBracketMatch[2]).toLowerCase(),
    };
  }

  return {
    name: '',
    email: normalizedValue.includes('@') ? normalizedValue.toLowerCase() : '',
  };
}

const nodeEnv = normalizeEnvString(process.env.NODE_ENV) || 'development';
const isProduction = nodeEnv === 'production';
const isDevelopment = nodeEnv === 'development';

const configuredMongoUri = normalizeEnvString(process.env.MONGO_URI);
const legacyMongoUri = normalizeEnvString(process.env.MONGODB_URI);
const mongoUri = configuredMongoUri || legacyMongoUri;
const mongoUriSource = configuredMongoUri ? 'MONGO_URI' : legacyMongoUri ? 'MONGODB_URI' : null;
const mongoUriConflict = Boolean(configuredMongoUri && legacyMongoUri && configuredMongoUri !== legacyMongoUri);
const legacyEmailFrom = parseEmailIdentity(process.env.EMAIL_FROM);

const defaultClientUrl = normalizeUrl(process.env.CLIENT_URL || 'http://localhost:5173');
const defaultAllowedOrigins = Array.from(
  new Set([
    defaultClientUrl,
    ...DEFAULT_AUTH_ALLOWED_ORIGINS,
    ...buildFrontendOriginsForUrl(process.env.CLIENT_URL),
    ...buildFrontendOriginsForUrl(process.env.SERVER_URL)
  ].filter(Boolean))
);

function parseAllowedOrigins(value) {
  const configuredOrigins = value
    ? value
        .split(',')
        .map((origin) => normalizeUrl(origin))
        .filter(Boolean)
    : [];

  return Array.from(new Set([...defaultAllowedOrigins, ...configuredOrigins]));
}

const allowedOrigins = parseAllowedOrigins(process.env.ALLOWED_ORIGINS);

function parseTrustProxy(value) {
  const normalizedValue = normalizeEnvString(value);

  if (!normalizedValue) {
    return isProduction ? 1 : false;
  }

  if (normalizedValue === 'true') {
    return true;
  }

  if (normalizedValue === 'false') {
    return false;
  }

  const numericValue = Number(normalizedValue);
  if (Number.isInteger(numericValue) && numericValue >= 0) {
    return numericValue;
  }

  return normalizedValue;
}

const legacyAutoSeedDemoAccounts = parseBooleanEnv(process.env.AUTO_SEED_DEMO_ACCOUNTS, !isProduction);
const autoBootstrapSystemAccounts = parseBooleanEnv(
  process.env.AUTO_BOOTSTRAP_SYSTEM_ACCOUNTS,
  legacyAutoSeedDemoAccounts
);

const env = {
  nodeEnv,
  isProduction,
  isDevelopment,
  port: parsePositiveIntegerEnv(process.env.PORT, 5000),
  mongoUri,
  mongoUriSource,
  mongoUriConflict,
  enableInMemoryDb: parseBooleanEnv(process.env.ENABLE_IN_MEMORY_DB, false),
  autoBootstrapSystemAccounts,
  jwtSecret: normalizeEnvString(process.env.JWT_SECRET),
  jwtExpiresIn: normalizeEnvString(process.env.JWT_EXPIRES_IN) || '7d',
  bcryptSaltRounds: parsePositiveIntegerEnv(process.env.BCRYPT_SALT_ROUNDS, 10),
  cookieName: normalizeEnvString(process.env.COOKIE_NAME) || 'dwarpal_token',
  cookieMaxAgeMs: parsePositiveIntegerEnv(process.env.COOKIE_MAX_AGE_MS, 7 * 24 * 60 * 60 * 1000),
  clientUrl: defaultClientUrl,
  serverUrl: normalizeUrl(process.env.SERVER_URL || ''),
  allowedOrigins,
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
  uploadsDir: path.resolve(backendRoot, 'uploads'),
  seedAdminPassword: normalizeEnvString(process.env.DEFAULT_ADMIN_PASSWORD) || 'DwarPal@123',
  seedAdminKey: normalizeEnvString(process.env.SEED_ADMIN_KEY),
  defaultHodProgram: normalizeEnvString(process.env.DEFAULT_HOD_PROGRAM) || 'Degree',
  defaultHodDepartment: normalizeEnvString(process.env.DEFAULT_HOD_DEPARTMENT) || 'Computer Engineering',
  defaultCoordinatorSemester: parsePositiveIntegerEnv(process.env.DEFAULT_COORDINATOR_SEMESTER, 6),
  studentPortalAccessId: normalizeEnvString(process.env.STUDENT_PORTAL_ACCESS_ID),
  studentPortalAccessPassword: normalizeEnvString(process.env.STUDENT_PORTAL_ACCESS_PASSWORD),
  facultyPortalAccessId: normalizeEnvString(process.env.FACULTY_PORTAL_ACCESS_ID),
  facultyPortalAccessPassword: normalizeEnvString(process.env.FACULTY_PORTAL_ACCESS_PASSWORD),
  portalAccessTokenExpiresIn: normalizeEnvString(process.env.PORTAL_ACCESS_TOKEN_EXPIRES_IN) || '12h',
  studentLoginOtpExpiryMinutes: parsePositiveIntegerEnv(process.env.STUDENT_LOGIN_OTP_EXPIRY_MINUTES, 5),
  studentLoginOtpResendCooldownSeconds: parsePositiveIntegerEnv(
    process.env.STUDENT_LOGIN_OTP_RESEND_COOLDOWN_SECONDS,
    45
  ),
  studentLoginOtpVerifyAttemptLimit: parsePositiveIntegerEnv(
    process.env.STUDENT_LOGIN_OTP_VERIFY_ATTEMPT_LIMIT,
    5
  ),
  temporaryCredentialSecret:
    normalizeEnvString(process.env.TEMPORARY_CREDENTIAL_SECRET) ||
    normalizeEnvString(process.env.JWT_SECRET) ||
    'dwarpal-dev-temporary-credential-secret',
  otpSecret:
    normalizeEnvString(process.env.OTP_SECRET) ||
    normalizeEnvString(process.env.JWT_SECRET) ||
    'dwarpal-dev-otp-secret',
  registerOtpExpiryMinutes: parsePositiveIntegerEnv(process.env.REGISTER_OTP_EXPIRY_MINUTES, 5),
  registerOtpResendCooldownSeconds: parsePositiveIntegerEnv(
    process.env.REGISTER_OTP_RESEND_COOLDOWN_SECONDS,
    45
  ),
  registerOtpResendLimit: parsePositiveIntegerEnv(process.env.REGISTER_OTP_RESEND_LIMIT, 5),
  registerOtpVerifyAttemptLimit: parsePositiveIntegerEnv(
    process.env.REGISTER_OTP_VERIFY_ATTEMPT_LIMIT,
    5
  ),
  passwordResetOtpExpiryMinutes: parsePositiveIntegerEnv(process.env.PASSWORD_RESET_OTP_EXPIRY_MINUTES, 5),
  passwordResetOtpResendCooldownSeconds: parsePositiveIntegerEnv(
    process.env.PASSWORD_RESET_OTP_RESEND_COOLDOWN_SECONDS,
    45
  ),
  passwordResetOtpVerifyAttemptLimit: parsePositiveIntegerEnv(
    process.env.PASSWORD_RESET_OTP_VERIFY_ATTEMPT_LIMIT,
    5
  ),
  smtpHost: normalizeEnvString(process.env.SMTP_HOST),
  smtpPort: parsePositiveIntegerEnv(process.env.SMTP_PORT, 587),
  smtpUser: normalizeEnvString(process.env.SMTP_USER),
  smtpPass: normalizeEnvString(process.env.SMTP_PASS),
  smtpSecure: parseBooleanEnv(process.env.SMTP_SECURE, false),
  smtpFromName: normalizeEnvString(process.env.SMTP_FROM_NAME) || legacyEmailFrom.name || 'DwarPal',
  smtpFromEmail: normalizeEnvString(process.env.SMTP_FROM_EMAIL) || legacyEmailFrom.email,
  firebaseProjectId: normalizeEnvString(process.env.FIREBASE_PROJECT_ID),
  firebaseClientEmail: normalizeEnvString(process.env.FIREBASE_CLIENT_EMAIL),
  firebasePrivateKey: normalizeEnvString(process.env.FIREBASE_PRIVATE_KEY).replace(/\\n/g, '\n'),
  firebaseStorageBucket: normalizeEnvString(process.env.FIREBASE_STORAGE_BUCKET),
  firebaseServiceAccountJson: normalizeEnvString(process.env.FIREBASE_SERVICE_ACCOUNT_JSON),
  firebaseServiceAccountBase64: normalizeEnvString(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64),
  firebaseWebApiKey:
    normalizeEnvString(process.env.FIREBASE_WEB_API_KEY) ||
    normalizeEnvString(process.env.VITE_FIREBASE_API_KEY),
  firebaseWebAuthDomain:
    normalizeEnvString(process.env.FIREBASE_WEB_AUTH_DOMAIN) ||
    normalizeEnvString(process.env.VITE_FIREBASE_AUTH_DOMAIN),
  firebaseWebProjectId:
    normalizeEnvString(process.env.FIREBASE_WEB_PROJECT_ID) ||
    normalizeEnvString(process.env.VITE_FIREBASE_PROJECT_ID),
  firebaseWebStorageBucket:
    normalizeEnvString(process.env.FIREBASE_WEB_STORAGE_BUCKET) ||
    normalizeEnvString(process.env.VITE_FIREBASE_STORAGE_BUCKET),
  firebaseWebMessagingSenderId:
    normalizeEnvString(process.env.FIREBASE_WEB_MESSAGING_SENDER_ID) ||
    normalizeEnvString(process.env.VITE_FIREBASE_MESSAGING_SENDER_ID),
  firebaseWebAppId:
    normalizeEnvString(process.env.FIREBASE_WEB_APP_ID) ||
    normalizeEnvString(process.env.VITE_FIREBASE_APP_ID),
  firebaseWebMeasurementId:
    normalizeEnvString(process.env.FIREBASE_WEB_MEASUREMENT_ID) ||
    normalizeEnvString(process.env.VITE_FIREBASE_MEASUREMENT_ID),
  firebaseWebVapidKey:
    normalizeEnvString(process.env.FIREBASE_WEB_VAPID_KEY) ||
    normalizeEnvString(process.env.VITE_FIREBASE_VAPID_KEY),
  enableWebPush: parseBooleanEnv(process.env.ENABLE_WEB_PUSH, false),
  qrSignSecret:
    normalizeEnvString(process.env.QR_SIGN_SECRET) ||
    normalizeEnvString(process.env.JWT_SECRET) ||
    'dwarpal-dev-qr-signing-secret',
  envFilePath: resolvedEnvPath,
  defaultPhoneCountryCode: normalizeEnvString(process.env.DEFAULT_PHONE_COUNTRY_CODE) || '+91',
  collegeName: normalizeEnvString(process.env.COLLEGE_NAME) || 'Your College Name',
  httpRequestTimeoutMs: parsePositiveIntegerEnv(process.env.HTTP_REQUEST_TIMEOUT_MS, 30000),
  httpHeadersTimeoutMs: parsePositiveIntegerEnv(process.env.HTTP_HEADERS_TIMEOUT_MS, 35000),
  httpKeepAliveTimeoutMs: parsePositiveIntegerEnv(process.env.HTTP_KEEP_ALIVE_TIMEOUT_MS, 5000),
  gatepassEscalationTimeoutMinutes: parsePositiveIntegerEnv(process.env.GATEPASS_ESCALATION_TIMEOUT_MINUTES, 5),
  gatepassEscalationSweepIntervalMs: parsePositiveIntegerEnv(process.env.GATEPASS_ESCALATION_SWEEP_INTERVAL_MS, 60000)
};

function getWebPushConfig() {
  const firebase = {
    apiKey: env.firebaseWebApiKey,
    authDomain: env.firebaseWebAuthDomain,
    projectId: env.firebaseWebProjectId,
    storageBucket: env.firebaseWebStorageBucket,
    messagingSenderId: env.firebaseWebMessagingSenderId,
    appId: env.firebaseWebAppId,
    measurementId: env.firebaseWebMeasurementId,
    vapidKey: env.firebaseWebVapidKey
  };

  const requiredFields = [
    firebase.apiKey,
    firebase.authDomain,
    firebase.projectId,
    firebase.storageBucket,
    firebase.messagingSenderId,
    firebase.appId,
    firebase.vapidKey
  ];
  const hasAnyRequiredField = requiredFields.some(Boolean);
  const hasAllRequiredFields = requiredFields.every(Boolean);

  return {
    enabled: env.enableWebPush,
    hasAnyRequiredField,
    isComplete: hasAllRequiredFields,
    firebase: hasAllRequiredFields ? firebase : null
  };
}

function validateOptionalWebPushConfig() {
  const webPush = getWebPushConfig();

  if (!webPush.enabled) {
    return [];
  }

  if (webPush.isComplete) {
    return [];
  }

  return [
    'ENABLE_WEB_PUSH is true but Firebase web push config is incomplete. Set FIREBASE_WEB_API_KEY, FIREBASE_WEB_AUTH_DOMAIN, FIREBASE_WEB_PROJECT_ID, FIREBASE_WEB_STORAGE_BUCKET, FIREBASE_WEB_MESSAGING_SENDER_ID, FIREBASE_WEB_APP_ID, and FIREBASE_WEB_VAPID_KEY.'
  ];
}

function validateStartupEnv() {
  const errors = [];

  if (env.mongoUriConflict) {
    errors.push('MONGO_URI and MONGODB_URI are both set with different values. Keep only one, preferably MONGO_URI.');
  }

  if (!env.jwtSecret) {
    errors.push('JWT_SECRET is required.');
  }

  if (env.isProduction && !env.mongoUri) {
    errors.push('MONGO_URI is required in production. Legacy MONGODB_URI is also supported for compatibility.');
  }

  if (env.isProduction && env.enableInMemoryDb) {
    errors.push('ENABLE_IN_MEMORY_DB must be false in production.');
  }

  errors.push(...validateOptionalWebPushConfig());

  return errors;
}

env.validateStartupEnv = validateStartupEnv;
env.getWebPushConfig = getWebPushConfig;
env.validateOptionalWebPushConfig = validateOptionalWebPushConfig;

module.exports = env;
