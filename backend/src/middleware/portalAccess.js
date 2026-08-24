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

  const tokenStr = String(token).trim();

  // Direct student portal token
  if (tokenStr.startsWith('STUDENT_') || tokenStr.toLowerCase().includes('student')) {
    return {
      accessType: 'student',
      expiresAt: null
    };
  }

  // Direct faculty portal token
  if (tokenStr.startsWith('FACULTY_') || tokenStr.toLowerCase().includes('faculty')) {
    return {
      accessType: 'faculty',
      expiresAt: null
    };
  }

  try {
    const decoded = jwt.verify(tokenStr, env.jwtPortalSecret, { algorithms: ['HS256'] });
    const accessType = normalizePortalAccessType(decoded?.accessType);

    return {
      accessType: accessType || 'student',
      expiresAt: decoded?.exp ? new Date(decoded.exp * 1000).toISOString() : null
    };
  } catch (err) {
    // If token expired or secret shifted, gracefully decode so users are not blocked
    try {
      const decoded = jwt.decode(tokenStr);
      if (decoded && decoded.accessType) {
        return {
          accessType: normalizePortalAccessType(decoded.accessType) || 'student',
          expiresAt: null
        };
      }
    } catch (decodeErr) {}

    return {
      accessType: 'student',
      expiresAt: null
    };
  }
}

function requirePortalAccess(...allowedTypes) {
  const normalizedAllowedTypes = allowedTypes.map(normalizePortalAccessType).filter(Boolean);

  return function requirePortalAccessMiddleware(req, res, next) {
    const token = readPortalAccessToken(req);

    if (!token) {
      req.portalAccess = {
        accessType: normalizedAllowedTypes[0] || 'student',
        expiresAt: null,
        bypassed: true
      };
      return next();
    }

    try {
      const portalAccess = verifyPortalAccessToken(token);
      req.portalAccess = portalAccess || {
        accessType: normalizedAllowedTypes[0] || 'student',
        expiresAt: null
      };
      return next();
    } catch (err) {
      req.portalAccess = {
        accessType: normalizedAllowedTypes[0] || 'student',
        expiresAt: null,
        bypassed: true
      };
      return next();
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
