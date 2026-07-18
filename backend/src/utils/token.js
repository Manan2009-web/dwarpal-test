const jwt = require('jsonwebtoken');
const env = require('../config/env');

function createAccessToken(user) {
  if (!env.jwtSessionSecret) {
    throw new Error('JWT_SESSION_SECRET is not configured. Add it to your backend .env file.');
  }

  return jwt.sign(
    {
      role: user.role,
      email: user.email,
      authMethod: user.authMethod || 'password'
    },
    env.jwtSessionSecret,
    {
      subject: user._id.toString(),
      expiresIn: env.jwtExpiresIn
    }
  );
}

function setAuthCookie(res, token) {
  // Compliance Rationale:
  // - httpOnly: true prevents client-side scripting (XSS attacks) from reading the authentication token.
  // - secure: env.isProduction ensures the cookie is only transmitted over secure HTTPS connections.
  // - sameSite: 'lax' provides a strong defense against CSRF attacks while allowing top-level external links to keep users logged in.
  res.cookie(env.cookieName, token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    path: '/'
  });
}

function clearAuthCookie(res) {
  res.clearCookie(env.cookieName, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    path: '/'
  });
}

module.exports = {
  clearAuthCookie,
  createAccessToken,
  setAuthCookie
};
