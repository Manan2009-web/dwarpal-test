const env = require('../config/env');

function safeParseUrl(value) {
  try {
    return new URL(String(value || '').trim());
  } catch {
    return null;
  }
}

function unique(values = []) {
  return Array.from(new Set(values.filter(Boolean)));
}

function getRequestOrigin(req) {
  const originHeader = req?.get?.('origin') || req?.headers?.origin || '';
  const parsedOrigin = safeParseUrl(originHeader);

  if (parsedOrigin) {
    return parsedOrigin.origin;
  }

  return '';
}

function getDefaultClientOrigin() {
  const parsedClientUrl = safeParseUrl(env.clientUrl);
  return parsedClientUrl?.origin || 'http://localhost:5173';
}

function getWebAuthnOrigin(req) {
  return getRequestOrigin(req) || getDefaultClientOrigin();
}

function getExpectedOrigins(req) {
  return unique([getRequestOrigin(req), getDefaultClientOrigin(), ...env.allowedOrigins]);
}

function getWebAuthnRpId(req) {
  const parsedOrigin = safeParseUrl(getWebAuthnOrigin(req));
  return parsedOrigin?.hostname || 'localhost';
}

function getExpectedRpIds(req) {
  const rpIds = getExpectedOrigins(req).map((origin) => safeParseUrl(origin)?.hostname || '').filter(Boolean);
  rpIds.unshift(getWebAuthnRpId(req));
  return unique(rpIds);
}

function normalizeDeviceName(deviceName, req) {
  const preferredName = String(deviceName || '').trim();
  if (preferredName) {
    return preferredName.slice(0, 120);
  }

  const userAgent = String(req?.get?.('user-agent') || req?.headers?.['user-agent'] || '').trim();
  if (!userAgent) {
    return 'Current device';
  }

  return userAgent.slice(0, 120);
}

function mapWebAuthnDevice(credential) {
  if (!credential) {
    return null;
  }

  return {
    id: credential._id?.toString?.() || credential.id,
    credentialId: credential.credentialId,
    deviceName: credential.deviceName || 'Current device',
    transports: Array.isArray(credential.transports) ? credential.transports : [],
    deviceType: credential.deviceType || 'singleDevice',
    backedUp: Boolean(credential.backedUp),
    lastUsedAt: credential.lastUsedAt || null,
    createdAt: credential.createdAt || null,
    updatedAt: credential.updatedAt || null
  };
}

module.exports = {
  getExpectedOrigins,
  getExpectedRpIds,
  getWebAuthnOrigin,
  getWebAuthnRpId,
  mapWebAuthnDevice,
  normalizeDeviceName
};
