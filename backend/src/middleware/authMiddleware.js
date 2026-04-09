const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/appError');
const { normalizeRole } = require('../constants/appConstants');
const { clearAuthCookie } = require('../utils/token');

function getTokenFromRequest(req) {
  const authorizationHeader = req.headers.authorization || '';

  if (authorizationHeader.startsWith('Bearer ')) {
    return {
      token: authorizationHeader.split(' ')[1],
      source: 'bearer'
    };
  }

  if (req.cookies && req.cookies[env.cookieName]) {
    return {
      token: req.cookies[env.cookieName],
      source: 'cookie'
    };
  }

  return {
    token: null,
    source: null
  };
}

const protect = asyncHandler(async (req, res, next) => {
  const { token, source } = getTokenFromRequest(req);

  if (!token) {
    throw new AppError('Authentication token is required', 401);
  }

  if (!env.jwtSecret) {
    throw new AppError('JWT_SECRET is not configured', 500);
  }

  let decoded;

  try {
    decoded = jwt.verify(token, env.jwtSecret);
  } catch (error) {
    if (source === 'cookie') {
      clearAuthCookie(res);
    }

    throw new AppError('Invalid or expired authentication token', 401);
  }

  const userId = decoded.sub || decoded.id;
  const user = await User.findById(userId);

  if (!user || !user.isActive) {
    if (source === 'cookie') {
      clearAuthCookie(res);
    }

    throw new AppError('User not found or inactive', 401);
  }

  const normalizedRole = normalizeRole(user.role);
  if (normalizedRole) {
    user.role = normalizedRole;
  }

  req.user = user;
  req.auth = {
    ...decoded,
    tokenSource: source,
    expiresAt: decoded.exp ? new Date(decoded.exp * 1000).toISOString() : null,
    issuedAt: decoded.iat ? new Date(decoded.iat * 1000).toISOString() : null
  };
  next();
});

module.exports = {
  protect
};
