/**
 * token.js — JWT creation and auth cookie helpers.
 *
 * SECURITY NOTES
 *   httpOnly : true  — Prevents client-side JS (XSS) from reading the token.
 *   secure   : true  — Cookie only transmitted over HTTPS (production only).
 *   sameSite : 'lax' — Blocks cross-site request forgery while allowing
 *                       top-level navigation to keep users logged in.
 *   maxAge          — Enforces server-side expiry in the browser. Without this
 *                     the cookie is a session cookie and never expires,
 *                     meaning a stolen cookie is valid indefinitely.
 */

'use strict';

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
  res.cookie(env.cookieName, token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    path: '/',
    // maxAge enforces browser-side expiry so a stolen cookie is not
    // permanently valid. Value comes from COOKIE_MAX_AGE_MS (default 7 days).
    maxAge: env.cookieMaxAgeMs || 7 * 24 * 60 * 60 * 1000
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
