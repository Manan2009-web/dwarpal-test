/**
 * authorize.js — Role-based access control (RBAC) middleware.
 *
 * SECURITY NOTE
 *   The 403 response intentionally does NOT list which roles are allowed.
 *   Revealing the allowed-role list in error messages is an information
 *   disclosure vulnerability (CWE-209). Attackers can use it to enumerate
 *   valid role names and craft targeted privilege-escalation attempts.
 *
 *   If you need to debug an access-denied issue, check the server log for the
 *   correlationId included in the client response — the log entry contains the
 *   full context including the user's role.
 */

'use strict';

const AppError = require('../utils/appError');
const { ERROR_CODES } = require('../utils/appError');

function authorize(...allowedRoles) {
  return function authorizeMiddleware(req, res, next) {
    if (!req.user) {
      return next(new AppError('Authentication required.', 401, null, ERROR_CODES.ERR_AUTH_REQUIRED));
    }

    if (!allowedRoles.includes(req.user.role)) {
      // ── Server-only detail (debug via correlationId in client response) ──
      // We intentionally do NOT echo req.user.role or allowedRoles to the client.
      console.warn(JSON.stringify({
        level: 'warn',
        event: 'RBAC_DENIED',
        userRole: req.user.role,
        userId: String(req.user._id || ''),
        allowedRoles,
        path: req.originalUrl,
        method: req.method,
        correlationId: req.id || 'unknown'
      }));

      return next(
        new AppError('You do not have permission to access this resource.', 403, null, ERROR_CODES.ERR_FORBIDDEN)
      );
    }

    return next();
  };
}

module.exports = authorize;
