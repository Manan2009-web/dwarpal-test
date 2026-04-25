const crypto = require('crypto');
const env = require('../config/env');

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey() {
  return crypto
    .createHash('sha256')
    .update(String(env.temporaryCredentialSecret || env.jwtSecret || 'dwarpal-temporary-credential-secret'))
    .digest();
}

function encryptTemporaryCredential(value) {
  const normalizedValue = String(value || '');

  if (!normalizedValue) {
    return null;
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, getEncryptionKey(), iv);
  const encryptedValue = Buffer.concat([cipher.update(normalizedValue, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, encryptedValue]).toString('base64');
}

function decryptTemporaryCredential(value) {
  const normalizedValue = String(value || '').trim();

  if (!normalizedValue) {
    return '';
  }

  try {
    const payloadBuffer = Buffer.from(normalizedValue, 'base64');

    if (payloadBuffer.length <= IV_LENGTH + AUTH_TAG_LENGTH) {
      return '';
    }

    const iv = payloadBuffer.subarray(0, IV_LENGTH);
    const authTag = payloadBuffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encryptedValue = payloadBuffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, getEncryptionKey(), iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(encryptedValue), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}

module.exports = {
  decryptTemporaryCredential,
  encryptTemporaryCredential
};
