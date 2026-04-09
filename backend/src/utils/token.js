const jwt = require('jsonwebtoken');
const env = require('../config/env');

function createAccessToken(user) {
  if (!env.jwtSecret) {
    throw new Error('JWT_SECRET is not configured. Add it to your backend .env file.');
  }

  return jwt.sign(
    {
      role: user.role,
      email: user.email,
      authMethod: user.authMethod || 'password'
    },
    env.jwtSecret,
    {
      subject: user._id.toString(),
      expiresIn: env.jwtExpiresIn
    }
  );
}

function setAuthCookie(res, token) {
  res.cookie(env.cookieName, token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax'
  });
}

function clearAuthCookie(res) {
  res.clearCookie(env.cookieName, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax'
  });
}

module.exports = {
  clearAuthCookie,
  createAccessToken,
  setAuthCookie
};
