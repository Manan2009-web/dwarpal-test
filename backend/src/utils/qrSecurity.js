const crypto = require('crypto');
const env = require('../config/env');

const QR_ISSUER = 'DWARPAL';
const QR_VERSION = '2.0';

function normalizeQrString(value) {
  return String(value || '').trim();
}

function compactQrPayload(payload = {}) {
  return Object.entries(payload).reduce((accumulator, [key, value]) => {
    if (value === undefined || value === null || value === '') {
      return accumulator;
    }

    accumulator[key] = value;
    return accumulator;
  }, {});
}

function normalizeForSignature(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeForSignature);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .filter((key) => key !== 'signature')
      .sort()
      .reduce((accumulator, key) => {
        accumulator[key] = normalizeForSignature(value[key]);
        return accumulator;
      }, {});
  }

  return value;
}

function buildSignatureInput(payload = {}) {
  return JSON.stringify(normalizeForSignature(payload));
}

function signQrPayload(payload = {}) {
  return crypto
    .createHmac('sha256', env.qrSignSecret)
    .update(buildSignatureInput(payload))
    .digest('hex')
    .toUpperCase();
}

function createSignedQrPayload(payload = {}) {
  const normalizedPayload = compactQrPayload({
    issuer: QR_ISSUER,
    version: QR_VERSION,
    ...payload
  });

  return {
    ...normalizedPayload,
    signature: signQrPayload(normalizedPayload)
  };
}

function safeCompareSignatures(left, right) {
  const leftBuffer = Buffer.from(String(left || '').toUpperCase(), 'utf8');
  const rightBuffer = Buffer.from(String(right || '').toUpperCase(), 'utf8');

  if (leftBuffer.length === 0 || leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function verifySignedQrPayload(payload = {}) {
  const signature = normalizeQrString(payload.signature).toUpperCase();

  if (!signature) {
    return false;
  }

  const expectedSignature = signQrPayload(payload);
  return safeCompareSignatures(signature, expectedSignature);
}

function readField(payload, paths = []) {
  return paths.reduce((match, path) => {
    if (match) {
      return match;
    }

    const parts = String(path || '')
      .split('.')
      .filter(Boolean);
    const value = parts.reduce((current, key) => (current && typeof current === 'object' ? current[key] : undefined), payload);

    if (typeof value === 'string') {
      return value.trim();
    }

    return match;
  }, '');
}

function extractQrScanData(rawValue) {
  const normalizedValue = normalizeQrString(rawValue);

  if (!normalizedValue) {
    return {
      rawValue: '',
      payload: null,
      gatepassId: '',
      verificationToken: '',
      signature: '',
      issuer: '',
      version: '',
      recordType: '',
      requestKind: '',
      verificationUrl: ''
    };
  }

  try {
    const parsedJson = JSON.parse(normalizedValue);

    if (parsedJson && typeof parsedJson === 'object' && !Array.isArray(parsedJson)) {
      return {
        rawValue: normalizedValue,
        payload: parsedJson,
        gatepassId: normalizeQrString(readField(parsedJson, ['gatepassId', 'passNumber', 'gatepass.gatepassId'])).toUpperCase(),
        verificationToken: normalizeQrString(
          readField(parsedJson, ['verificationToken', 'token', 'verification.token'])
        ).toUpperCase(),
        signature: normalizeQrString(readField(parsedJson, ['signature'])).toUpperCase(),
        issuer: normalizeQrString(readField(parsedJson, ['issuer'])).toUpperCase(),
        version: normalizeQrString(readField(parsedJson, ['version'])),
        recordType: normalizeQrString(readField(parsedJson, ['recordType'])).toLowerCase(),
        requestKind: normalizeQrString(readField(parsedJson, ['requestKind'])).toLowerCase(),
        verificationUrl: normalizeQrString(readField(parsedJson, ['verificationUrl']))
      };
    }
  } catch {
    // Non-JSON QR values are handled below.
  }

  try {
    const parsedUrl = new URL(normalizedValue);
    const tokenFromQuery =
      parsedUrl.searchParams.get('verificationToken') || parsedUrl.searchParams.get('token') || '';
    const gatepassIdFromQuery = parsedUrl.searchParams.get('gatepassId') || '';
    const signatureFromQuery = parsedUrl.searchParams.get('signature') || '';
    const recordTypeFromQuery = parsedUrl.searchParams.get('recordType') || '';
    const requestKindFromQuery = parsedUrl.searchParams.get('requestKind') || '';
    const tokenFromPath = parsedUrl.pathname.match(/\/security\/verify\/([A-Z0-9]{20,64})/i);
    const gatepassIdFromPath = parsedUrl.pathname.match(/\/security\/verify-id\/([A-Z0-9-]{3,64})/i);

    return {
      rawValue: normalizedValue,
      payload: null,
      gatepassId: normalizeQrString(gatepassIdFromQuery || gatepassIdFromPath?.[1] || '').toUpperCase(),
      verificationToken: normalizeQrString(tokenFromQuery || tokenFromPath?.[1] || '').toUpperCase(),
      signature: normalizeQrString(signatureFromQuery).toUpperCase(),
      issuer: '',
      version: '',
      recordType: normalizeQrString(recordTypeFromQuery).toLowerCase(),
      requestKind: normalizeQrString(requestKindFromQuery).toLowerCase(),
      verificationUrl: normalizedValue
    };
  } catch {
    const tokenMatch = normalizedValue.match(/\b([A-Z0-9]{20,64})\b/i);
    const gatepassIdMatch = normalizedValue.match(/\b([A-Z]{2,8}-[A-Z]{2,8}-\d{10})\b/i);

    return {
      rawValue: normalizedValue,
      payload: null,
      gatepassId: normalizeQrString(gatepassIdMatch?.[1] || normalizedValue).toUpperCase(),
      verificationToken: normalizeQrString(tokenMatch?.[1] || '').toUpperCase(),
      signature: '',
      issuer: '',
      version: '',
      recordType: '',
      requestKind: '',
      verificationUrl: ''
    };
  }
}

module.exports = {
  QR_ISSUER,
  QR_VERSION,
  compactQrPayload,
  createSignedQrPayload,
  extractQrScanData,
  normalizeQrString,
  signQrPayload,
  verifySignedQrPayload
};
