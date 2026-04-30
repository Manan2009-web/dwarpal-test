const fs = require('fs');
const path = require('path');
const vm = require('vm');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const AppError = require('../utils/appError');

const PORTAL_ACCESS_HEADER = 'x-portal-access-token';
const PORTAL_ACCESS_TYPES = Object.freeze(['student', 'faculty']);
const PORTAL_CREDENTIALS_CONFIG_PATH = path.resolve(__dirname, '../../../src/config/portalCredentials.js');
const TEMP_DISABLE_ACCESS_PORTAL = true;

function normalizePortalAccessType(value) {
  const normalizedValue = String(value || '')
    .trim()
    .toLowerCase();

  return PORTAL_ACCESS_TYPES.includes(normalizedValue) ? normalizedValue : '';
}

function normalizePortalCredentialEntry(entry = {}) {
  return {
    accessId: String(entry?.id || '').trim(),
    accessPassword: String(entry?.password || '')
  };
}

function readPortalCredentialsMap() {
  try {
    const source = fs.readFileSync(PORTAL_CREDENTIALS_CONFIG_PATH, 'utf8');
    const executableSource = `${source
      .replace(/export\s+const\s+PORTAL_CREDENTIALS\s*=\s*/, 'const PORTAL_CREDENTIALS = ')
      .replace(/export\s+default\s+PORTAL_CREDENTIALS\s*;?/g, '')}
module.exports = { PORTAL_CREDENTIALS };`;
    const context = {
      module: { exports: {} },
      exports: {}
    };

    vm.runInNewContext(executableSource, context, {
      filename: PORTAL_CREDENTIALS_CONFIG_PATH
    });

    const portalCredentials = context.module.exports?.PORTAL_CREDENTIALS;

    return portalCredentials && typeof portalCredentials === 'object' ? portalCredentials : {};
  } catch (error) {
    console.error('[portal-access] Unable to read shared portal credentials config.', {
      configPath: PORTAL_CREDENTIALS_CONFIG_PATH,
      error: error?.message || error
    });

    return {};
  }
}

function getPortalAccessCredentials(accessType) {
  const normalizedAccessType = normalizePortalAccessType(accessType);
  const portalCredentials = readPortalCredentialsMap();

  if (normalizedAccessType) {
    return normalizePortalCredentialEntry(portalCredentials[normalizedAccessType]);
  }

  return {
    accessId: '',
    accessPassword: ''
  };
}

function isPortalAccessConfigured(accessType) {
  const credentials = getPortalAccessCredentials(accessType);
  return Boolean(credentials.accessId && credentials.accessPassword);
}

function createPortalAccessToken(accessType) {
  if (!env.jwtSecret) {
    throw new Error('JWT_SECRET is not configured. Add it to your backend .env file.');
  }

  const normalizedAccessType = normalizePortalAccessType(accessType);

  return jwt.sign(
    {
      type: 'portal_access',
      accessType: normalizedAccessType
    },
    env.jwtSecret,
    {
      subject: `portal:${normalizedAccessType}`,
      expiresIn: env.portalAccessTokenExpiresIn
    }
  );
}

function readPortalAccessToken(req) {
  return String(req.get(PORTAL_ACCESS_HEADER) || '').trim();
}

function verifyPortalAccessToken(token) {
  if (!token) {
    return null;
  }

  const decoded = jwt.verify(token, env.jwtSecret);

  if (decoded?.type !== 'portal_access') {
    throw new AppError('Portal access token is invalid. Please authenticate again.', 401);
  }

  const accessType = normalizePortalAccessType(decoded.accessType);

  if (!accessType) {
    throw new AppError('Portal access token is invalid. Please authenticate again.', 401);
  }

  return {
    accessType,
    expiresAt: decoded.exp ? new Date(decoded.exp * 1000).toISOString() : null
  };
}

function requirePortalAccess(...allowedTypes) {
  const normalizedAllowedTypes = allowedTypes.map(normalizePortalAccessType).filter(Boolean);

  return function requirePortalAccessMiddleware(req, res, next) {
    if (TEMP_DISABLE_ACCESS_PORTAL) {
      // TEMP_DISABLED_ACCESS_PORTAL
      req.portalAccess = {
        accessType: normalizedAllowedTypes[0] || 'faculty',
        expiresAt: null,
        bypassed: true
      };
      return next();
    }

    const token = readPortalAccessToken(req);

    if (!token) {
      const error = new AppError('Portal access is required before continuing.', 401);
      error.code = 'PORTAL_ACCESS_REQUIRED';
      return next(error);
    }

    try {
      const portalAccess = verifyPortalAccessToken(token);

      if (normalizedAllowedTypes.length && !normalizedAllowedTypes.includes(portalAccess.accessType)) {
        const error = new AppError('This portal does not allow access to the requested action.', 403);
        error.code = 'PORTAL_ACCESS_FORBIDDEN';
        return next(error);
      }

      req.portalAccess = portalAccess;
      return next();
    } catch (error) {
      const portalError =
        error instanceof AppError
          ? error
          : new AppError('Portal access token is invalid or expired. Please authenticate again.', 401);
      portalError.code = portalError.code || 'PORTAL_ACCESS_INVALID';
      return next(portalError);
    }
  };
}

module.exports = {
  PORTAL_ACCESS_HEADER,
  PORTAL_ACCESS_TYPES,
  createPortalAccessToken,
  getPortalAccessCredentials,
  isPortalAccessConfigured,
  normalizePortalAccessType,
  requirePortalAccess,
  verifyPortalAccessToken
};
