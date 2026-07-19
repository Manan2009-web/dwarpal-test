/**
 * requestId.js — Correlation ID middleware.
 *
 * Attaches a unique `req.id` to every incoming request and reflects it back in
 * the `X-Request-Id` response header. When a user reports an error, they can
 * share the Request-Id so you can find the exact log entry in seconds.
 *
 * Uses the native `crypto.randomUUID()` (Node 14.17+, no external dependency).
 */

'use strict';

function requestIdMiddleware(req, res, next) {
  // Re-use a trusted upstream ID (e.g. from a reverse proxy / Vercel) when
  // available, otherwise generate a fresh UUID for this request.
  const upstreamId = String(req.headers['x-request-id'] || '').trim();
  const id = upstreamId || crypto.randomUUID();

  req.id = id;
  res.set('X-Request-Id', id);
  next();
}

module.exports = requestIdMiddleware;
