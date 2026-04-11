const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const backendRoot = path.resolve(__dirname, '..', '..');
const backendEnvPath = path.join(backendRoot, '.env');
const cwdEnvPath = path.resolve(process.cwd(), '.env');
const resolvedEnvPath = fs.existsSync(backendEnvPath) ? backendEnvPath : cwdEnvPath;

dotenv.config({ path: resolvedEnvPath });

const DEFAULT_FRONTEND_PORTS = ['5173', '4173'];

function normalizeUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
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

function isPrivateIpv4Host(hostname) {
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    return true;
  }

  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    return true;
  }

  const match = hostname.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  if (!match) {
    return false;
  }

  const secondOctet = Number(match[1]);
  return secondOctet >= 16 && secondOctet <= 31;
}

function isDevelopmentLanOrigin(origin) {
  const parsedUrl = safeParseUrl(origin);

  if (!parsedUrl) {
    return false;
  }

  const { hostname, port, protocol } = parsedUrl;

  if (!['http:', 'https:'].includes(protocol)) {
    return false;
  }

  if (!DEFAULT_FRONTEND_PORTS.includes(port)) {
    return false;
  }

  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname.endsWith('.local') ||
    isPrivateIpv4Host(hostname)
  );
}

const configuredMongoUri = String(process.env.MONGODB_URI || process.env.MONGO_URI || '').trim();
const defaultClientUrl = normalizeUrl(process.env.CLIENT_URL || 'http://localhost:5173');
const defaultAllowedOrigins = Array.from(
  new Set([
    defaultClientUrl,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4173',
    'http://127.0.0.1:4173',
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
const isProduction = process.env.NODE_ENV === 'production';

function parseTrustProxy(value) {
  const normalizedValue = String(value || '').trim();

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

function isOriginAllowed(origin) {
  if (!origin) {
    return true;
  }

  const normalizedOrigin = normalizeUrl(origin);

  if (allowedOrigins.includes('*') || allowedOrigins.includes(normalizedOrigin)) {
    return true;
  }

  return !isProduction && isDevelopmentLanOrigin(normalizedOrigin);
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction,
  port: Number(process.env.PORT) || 5000,
  mongoUri: configuredMongoUri,
  enableInMemoryDb: process.env.ENABLE_IN_MEMORY_DB === 'true',
  autoSeedDemoAccounts: process.env.AUTO_SEED_DEMO_ACCOUNTS !== 'false',
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS) || 10,
  cookieName: process.env.COOKIE_NAME || 'dwarpal_token',
  cookieMaxAgeMs: Number(process.env.COOKIE_MAX_AGE_MS) || 7 * 24 * 60 * 60 * 1000,
  clientUrl: defaultClientUrl,
  serverUrl: normalizeUrl(process.env.SERVER_URL || ''),
  allowedOrigins,
  isOriginAllowed,
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
  uploadsDir: path.resolve(backendRoot, 'uploads'),
  seedAdminPassword: process.env.DEFAULT_ADMIN_PASSWORD || 'DwarPal@123',
  seedAdminKey: process.env.SEED_ADMIN_KEY || '',
  defaultHodProgram: process.env.DEFAULT_HOD_PROGRAM || 'Degree',
  defaultHodDepartment: process.env.DEFAULT_HOD_DEPARTMENT || 'Computer Engineering',
  qrSignSecret: process.env.QR_SIGN_SECRET || process.env.JWT_SECRET || 'dwarpal-dev-qr-signing-secret',
  envFilePath: resolvedEnvPath,
  defaultPhoneCountryCode: process.env.DEFAULT_PHONE_COUNTRY_CODE || '+91',
  registrationOtpExpiresMinutes: Number(process.env.REGISTRATION_OTP_EXPIRES_MINUTES) || 10,
  registrationOtpResendCooldownSeconds: Number(process.env.REGISTRATION_OTP_RESEND_COOLDOWN_SECONDS) || 60,
  registrationOtpMaxAttempts: Number(process.env.REGISTRATION_OTP_MAX_ATTEMPTS) || 5,
  registrationPendingExpiresMinutes: Number(process.env.REGISTRATION_PENDING_EXPIRES_MINUTES) || 30,
  passwordResetTokenExpiresMinutes: Number(process.env.PASSWORD_RESET_TOKEN_EXPIRES_MINUTES) || 15,
  passwordResetUrl: normalizeUrl(process.env.PASSWORD_RESET_URL || ''),
  emailDeliveryMode: String(process.env.EMAIL_DELIVERY_MODE || 'auto').trim().toLowerCase(),
  resendApiKey: String(process.env.RESEND_API_KEY || '').trim(),
  emailFrom: String(process.env.EMAIL_FROM || '').trim(),
  smtpHost: String(process.env.SMTP_HOST || '').trim(),
  smtpPort: Number(process.env.SMTP_PORT) || 587,
  smtpSecure: process.env.SMTP_SECURE === 'true',
  smtpUser: String(process.env.SMTP_USER || '').trim(),
  smtpPass: String(process.env.SMTP_PASS || '').trim(),
  smtpConnectionTimeoutMs: Number(process.env.SMTP_CONNECTION_TIMEOUT_MS) || 10000,
  smtpGreetingTimeoutMs: Number(process.env.SMTP_GREETING_TIMEOUT_MS) || 10000,
  smtpSocketTimeoutMs: Number(process.env.SMTP_SOCKET_TIMEOUT_MS) || 15000,
  emailSendTimeoutMs: Number(process.env.EMAIL_SEND_TIMEOUT_MS) || 20000,
  resendRequestTimeoutMs: Number(process.env.RESEND_REQUEST_TIMEOUT_MS) || 15000,
  httpRequestTimeoutMs: Number(process.env.HTTP_REQUEST_TIMEOUT_MS) || 30000,
  httpHeadersTimeoutMs: Number(process.env.HTTP_HEADERS_TIMEOUT_MS) || 35000,
  httpKeepAliveTimeoutMs: Number(process.env.HTTP_KEEP_ALIVE_TIMEOUT_MS) || 5000,
  gatepassEscalationTimeoutMinutes: Number(process.env.GATEPASS_ESCALATION_TIMEOUT_MINUTES) || 5,
  gatepassEscalationSweepIntervalMs: Number(process.env.GATEPASS_ESCALATION_SWEEP_INTERVAL_MS) || 60000
};
