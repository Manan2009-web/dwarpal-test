const jwt = require('jsonwebtoken');
const env = require('../config/env');
const AppError = require('./appError');

const WEBAUTHN_STATE_COOKIE = `${env.cookieName}_webauthn`;

function signWebAuthnState(payload) {
  if (!env.jwtSecret) {
    throw new Error('JWT_SECRET is not configured. Add it to your backend .env file.');
  }

  return jwt.sign(payload, env.jwtSecret, { expiresIn: '5m' });
}

function setWebAuthnStateCookie(res, payload) {
  const token = signWebAuthnState(payload);
  res.cookie(WEBAUTHN_STATE_COOKIE, token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax'
  });
}

function clearWebAuthnStateCookie(res) {
  res.clearCookie(WEBAUTHN_STATE_COOKIE, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax'
  });
}

function readWebAuthnState(req, expectedFlow) {
  const token = req?.cookies?.[WEBAUTHN_STATE_COOKIE];

  if (!token) {
    throw new AppError('Biometric verification session has expired. Please try again.', 401);
  }

  try {
    const state = jwt.verify(token, env.jwtSecret);

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
