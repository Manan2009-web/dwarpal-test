const env = require('../config/env');

function readForwardedFor(req) {
  const forwardedFor = req?.headers?.['x-forwarded-for'];
  const forwardedValue = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
  return String(forwardedValue || '')
    .split(',')[0]
    .trim();
}

function getClientIp(req) {
  return String(req?.ip || readForwardedFor(req) || req?.socket?.remoteAddress || '').trim();
}

function getUserAgent(req) {
  return String(req?.get?.('user-agent') || req?.headers?.['user-agent'] || '').trim();
}

function getClientFingerprint(req) {
  const clientIp = getClientIp(req) || 'unknown-ip';
  const userAgent = getUserAgent(req).slice(0, 160).toLowerCase() || 'unknown-agent';
  return `${clientIp}|${userAgent}`;
}

function getRequestBaseUrl(req) {
  return `${req.protocol}://${req.get('host')}`.replace(/\/$/, '');
}

function getBaseUrl(req) {
  // In development we prefer the current request host so localhost and LAN access
  // can both work without rewriting SERVER_URL whenever the access pattern changes.
  if (!env.isProduction && req) {
    return getRequestBaseUrl(req);
  }

  if (env.serverUrl) {
    return env.serverUrl.replace(/\/$/, '');
  }

  return getRequestBaseUrl(req);
}

function toPublicUrl(pathname, req) {
  if (!pathname) {
    return null;
  }

  if (/^https?:\/\//i.test(pathname)) {
    return pathname;
  }

  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${getBaseUrl(req)}${normalizedPath}`;
}

function getRequestMeta(req) {
  return {
    ipAddress: getClientIp(req),
    userAgent: getUserAgent(req)
  };
}

module.exports = {
  getClientFingerprint,
  getBaseUrl,
  getClientIp,
  getRequestMeta,
  getUserAgent,
  toPublicUrl
};
