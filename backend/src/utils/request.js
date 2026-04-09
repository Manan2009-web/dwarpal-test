const env = require('../config/env');

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
  const forwardedFor = req.headers['x-forwarded-for'];

  return {
    ipAddress: Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor || req.ip || '',
    userAgent: req.get('user-agent') || ''
  };
}

module.exports = {
  getBaseUrl,
  getRequestMeta,
  toPublicUrl
};
