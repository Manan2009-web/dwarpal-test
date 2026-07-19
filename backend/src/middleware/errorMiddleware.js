/**
 * errorMiddleware.js — Centralised error handler for DwarPal.
 *
 * SECURITY CONTRACT
 *   - Full stack traces and internal details ONLY go to server logs.
 *   - The client always receives: message, publicErrorCode, correlationId.
 *   - The client NEVER receives: stack traces, MongoDB error internals,
 *     file paths, model names, or raw database error messages.
 *
 * DEBUGGING
 *   Every error log line contains a `correlationId` that matches the
 *   `X-Request-Id` header returned to the client. When a user reports an
 *   issue, ask for their Request-Id and grep logs for it instantly:
 *
 *     grep "a1b2c3d4" /var/log/dwarpal-backend.log
 */

'use strict';

const AppError = require('../utils/appError');
const { ERROR_CODES } = require('../utils/appError');
const { buildValidationAppError, getDuplicateFieldMessage } = require('../utils/validation');

function notFoundHandler(req, res, next) {
  next(new AppError(`Route not found: ${req.originalUrl}`, 404, null, ERROR_CODES.ERR_NOT_FOUND));
}

function errorHandler(err, req, res, next) {
  let error = err;

  // ── Normalise well-known non-AppError types ────────────────────────────────
  if (!(error instanceof AppError)) {
    if (error.name === 'CastError') {
      error = new AppError('Invalid resource ID.', 400, null, ERROR_CODES.ERR_VALIDATION);

    } else if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyValue || {})[0] || 'field';
      const duplicateMessage = getDuplicateFieldMessage(duplicateField);
      error = new AppError(duplicateMessage, 409, [{ field: duplicateField, message: duplicateMessage }], ERROR_CODES.ERR_CONFLICT);

    } else if (error.name === 'ValidationError') {
      error = buildValidationAppError(
        Object.values(error.errors).map((item) => ({ field: item.path, message: item.message }))
      );

    } else if (error.name === 'TokenExpiredError') {
      error = new AppError('Your session has expired. Please sign in again.', 401, null, ERROR_CODES.ERR_TOKEN_EXPIRED);

    } else if (error.name === 'JsonWebTokenError') {
      error = new AppError('Authentication token is invalid.', 401, null, ERROR_CODES.ERR_TOKEN_INVALID);

    } else if (error.message === 'Only image files are allowed') {
      error = new AppError(error.message, 400, null, ERROR_CODES.ERR_VALIDATION);

    } else if (
      error.name === 'MongooseError' ||
      error.name === 'MongoNetworkError' ||
      error.name === 'MongoServerSelectionError' ||
      String(error.message || '').toLowerCase().includes('timed out')
    ) {
      // Never leak raw Mongoose / MongoDB error details to the client.
      error = new AppError('A database error occurred. Please try again.', 503, null, ERROR_CODES.ERR_DB_TIMEOUT);

    } else {
      error = new AppError('An unexpected error occurred. Please try again.', error.statusCode || 500);
    }
  }

  // ── Structured server-side log (never sent to client) ─────────────────────
  const correlationId = req.id || 'unknown';
  const userId = req.user?._id ? String(req.user._id) : 'anonymous';
  const originalError = err instanceof AppError ? err : err; // keep ref to original for stack

  // Always log 5xx; log 4xx only at a lower level (they are expected).
  if ((error.statusCode || 500) >= 500) {
    console.error(JSON.stringify({
      level: 'error',
      timestamp: new Date().toISOString(),
      correlationId,
      method: req.method,
      path: req.originalUrl,
      statusCode: error.statusCode || 500,
      errorCode: error.publicErrorCode,
      userId,
      ip: req.ip,
      message: originalError.message || 'Internal server error',
      stack: originalError.stack || null
    }));
  } else {
    console.warn(JSON.stringify({
      level: 'warn',
      timestamp: new Date().toISOString(),
      correlationId,
      method: req.method,
      path: req.originalUrl,
      statusCode: error.statusCode,
      errorCode: error.publicErrorCode,
      userId,
      ip: req.ip,
      message: error.message
    }));
  }

  // ── Safe client response (zero internal details) ──────────────────────────
  const response = {
    success: false,
    message: error.message || 'An unexpected error occurred.',
    errorCode: error.publicErrorCode || ERROR_CODES.ERR_INTERNAL,
    correlationId,                         // lets users report a traceable ID
    timestamp: new Date().toISOString()
  };

  if (error.errors) {
    response.errors = error.errors;
  }

  if (error.retryAfterSeconds) {
    response.retryAfterSeconds = error.retryAfterSeconds;
    res.set('Retry-After', String(error.retryAfterSeconds));
  }

  if (error.rateLimit) {
    response.rateLimit = error.rateLimit;
  }

  res.status(error.statusCode || 500).json(response);
}

module.exports = {
  errorHandler,
  notFoundHandler
};
