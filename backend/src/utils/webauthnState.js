const jwt = require('jsonwebtoken');
const env = require('../config/env');
const AppError = require('./appError');

const WEBAUTHN_STATE_COOKIE = `${env.cookieName}_webauthn`;

function signWebAuthnState(payload) {
  if (!env.jwtSessionSecret) {
    throw new Error('JWT_SESSION_SECRET is not configured. Add it to your backend .env file.');
  }

  return jwt.sign(payload, env.jwtSessionSecret, { expiresIn: '5m' });
}

function setWebAuthnStateCookie(res, payload) {
  const token = signWebAuthnState(payload);
  // Compliance Rationale:
  // - httpOnly: true prevents client-side scripting (XSS attacks) from reading the short-lived WebAuthn flow token.
  // - secure: env.isProduction ensures the session-linked verification token is only transmitted over HTTPS.
  // - sameSite: 'lax' safeguards biometric verification requests from CSRF.
  res.cookie(WEBAUTHN_STATE_COOKIE, token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    path: '/'
  });
}

function clearWebAuthnStateCookie(res) {
  res.clearCookie(WEBAUTHN_STATE_COOKIE, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    path: '/'
  });
}

function readWebAuthnState(req, expectedFlow) {
  const token = req?.cookies?.[WEBAUTHN_STATE_COOKIE];

  if (!token) {
    throw new AppError('Biometric verification session has expired. Please try again.', 401);
  }

  try {
    const state = jwt.verify(token, env.jwtSessionSecret, { algorithms: ['HS256'] });

    if (expectedFlow && state.flow !== expectedFlow) {
      throw new AppError('Biometric verification session is invalid. Please try again.', 401);
    }

    return state;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError('Biometric verification session has expired. Please try again.', 401);
  }
}

module.exports = {
  clearWebAuthnStateCookie,
  readWebAuthnState,
  setWebAuthnStateCookie,
  WEBAUTHN_STATE_COOKIE
};
