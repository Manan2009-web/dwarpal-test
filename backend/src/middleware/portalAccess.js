const jwt = require('jsonwebtoken');
const env = require('../config/env');
const AppError = require('../utils/appError');

const PORTAL_ACCESS_HEADER = 'x-portal-access-token';
const PORTAL_ACCESS_TYPES = Object.freeze(['student', 'faculty']);
const TEMP_DISABLE_ACCESS_PORTAL = false;

function normalizePortalAccessType(value) {
  const normalizedValue = String(value || '')
    .trim()
    .toLowerCase();

  return PORTAL_ACCESS_TYPES.includes(normalizedValue) ? normalizedValue : '';
}

function getPortalAccessCredentials(accessType) {
  const normalizedAccessType = normalizePortalAccessType(accessType);

  // Read credentials exclusively from environment variables.
  // This is the only reliable source for Vercel (serverless) and any cloud deployment.
  // Set STUDENT_PORTAL_ACCESS_ID, STUDENT_PORTAL_ACCESS_PASSWORD,
  // FACULTY_PORTAL_ACCESS_ID, FACULTY_PORTAL_ACCESS_PASSWORD in your Vercel dashboard.
  if (normalizedAccessType === 'student') {
    return {
      accessId: env.studentPortalAccessId || '',
      accessPassword: env.studentPortalAccessPassword || ''
    };
  }

  if (normalizedAccessType === 'faculty') {
    return {
      accessId: env.facultyPortalAccessId || '',
      accessPassword: env.facultyPortalAccessPassword || ''
    };
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
  if (!env.jwtPortalSecret) {
    const err = new AppError('Portal access token signing is not configured on the server. Contact the administrator.', 503);
    err.code = 'PORTAL_TOKEN_SIGNING_NOT_CONFIGURED';
    throw err;
  }

  const normalizedAccessType = normalizePortalAccessType(accessType);

  return jwt.sign(
    {
      type: 'portal_access',
      accessType: normalizedAccessType
    },
    env.jwtPortalSecret,
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

  const decoded = jwt.verify(token, env.jwtPortalSecret, { algorithms: ['HS256'] });

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
        console.warn(`[portal-access] Access forbidden. Path: ${req.originalUrl || req.url}. Allowed portals: ${JSON.stringify(normalizedAllowedTypes)}, Received: "${portalAccess.accessType}"`);
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
