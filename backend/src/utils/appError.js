/**
 * appError.js — Operational error class for DwarPal.
 *
 * USAGE
 *   throw new AppError('Human-readable message', 401, null, 'ERR_AUTH_FAILED');
 *
 * FIELDS
 *   message         — Human-readable, safe to send to the client.
 *   statusCode      — HTTP status code (default 500).
 *   errors          — Array of field-level validation errors (optional).
 *   publicErrorCode — Machine-readable code sent to the client AND written to
 *                     server logs. Prefix: ERR_*. Use the constants below so
 *                     you can grep a log for the exact error type in production.
 *   isOperational   — Always true. Non-operational errors bubble up as uncaught
 *                     exceptions and trigger a clean shutdown.
 *
 * ERROR CODE CATALOGUE
 *   ERR_INTERNAL              — Unexpected server-side failure (500).
 *   ERR_NOT_FOUND             — Resource or route not found (404).
 *   ERR_VALIDATION            — Request body/params failed validation (422).
 *   ERR_AUTH_REQUIRED         — No authentication token provided (401).
 *   ERR_AUTH_FAILED           — Token invalid, malformed or wrong credentials (401).
 *   ERR_TOKEN_EXPIRED         — JWT or OTP token has expired (401).
 *   ERR_TOKEN_INVALID         — JWT or OTP token is structurally invalid (401).
 *   ERR_FORBIDDEN             — Authenticated but insufficient role/permission (403).
 *   ERR_RATE_LIMITED          — Too many requests (429).
 *   ERR_DB_TIMEOUT            — Database operation timed out or unreachable (503).
 *   ERR_CONFLICT              — Duplicate key / resource already exists (409).
 *   ERR_PORTAL_REQUIRED       — Portal access token is missing (401).
 *   ERR_PORTAL_INVALID        — Portal access token is invalid or expired (401).
 *   ERR_EMAIL_UNVERIFIED      — Email verification required (403).
 *   ERR_SERVICE_UNAVAILABLE   — A downstream service or feature is unavailable (503).
 */

'use strict';

/**
 * Machine-readable error codes. Always sent to the client alongside the
 * human-readable message. Never include stack traces, DB error text, or
 * internal module paths in the code — keep it terse and scannable.
 */
const ERROR_CODES = Object.freeze({
  ERR_INTERNAL: 'ERR_INTERNAL',
  ERR_NOT_FOUND: 'ERR_NOT_FOUND',
  ERR_VALIDATION: 'ERR_VALIDATION',
  ERR_AUTH_REQUIRED: 'ERR_AUTH_REQUIRED',
  ERR_AUTH_FAILED: 'ERR_AUTH_FAILED',
  ERR_TOKEN_EXPIRED: 'ERR_TOKEN_EXPIRED',
  ERR_TOKEN_INVALID: 'ERR_TOKEN_INVALID',
  ERR_FORBIDDEN: 'ERR_FORBIDDEN',
  ERR_RATE_LIMITED: 'ERR_RATE_LIMITED',
  ERR_DB_TIMEOUT: 'ERR_DB_TIMEOUT',
  ERR_CONFLICT: 'ERR_CONFLICT',
  ERR_PORTAL_REQUIRED: 'ERR_PORTAL_REQUIRED',
  ERR_PORTAL_INVALID: 'ERR_PORTAL_INVALID',
  ERR_EMAIL_UNVERIFIED: 'ERR_EMAIL_UNVERIFIED',
  ERR_SERVICE_UNAVAILABLE: 'ERR_SERVICE_UNAVAILABLE'
});

class AppError extends Error {
  /**
   * @param {string} message        - Safe, user-facing error message.
   * @param {number} statusCode     - HTTP status (default 500).
   * @param {Array|null} errors     - Field-level validation errors (optional).
   * @param {string|null} publicErrorCode - One of the ERR_* constants above.
   */
  constructor(message, statusCode = 500, errors = null, publicErrorCode = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.errors = errors;
    this.publicErrorCode = publicErrorCode || deriveDefaultCode(statusCode);
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Derive a sensible default error code from the HTTP status when the caller
 * does not pass one explicitly. This keeps existing throw sites unchanged.
 */
function deriveDefaultCode(statusCode) {
  switch (statusCode) {
    case 400: return ERROR_CODES.ERR_VALIDATION;
    case 401: return ERROR_CODES.ERR_AUTH_FAILED;
    case 403: return ERROR_CODES.ERR_FORBIDDEN;
    case 404: return ERROR_CODES.ERR_NOT_FOUND;
    case 409: return ERROR_CODES.ERR_CONFLICT;
    case 422: return ERROR_CODES.ERR_VALIDATION;
    case 429: return ERROR_CODES.ERR_RATE_LIMITED;
    case 503: return ERROR_CODES.ERR_SERVICE_UNAVAILABLE;
    default:  return ERROR_CODES.ERR_INTERNAL;
  }
}

module.exports = AppError;
module.exports.ERROR_CODES = ERROR_CODES;
