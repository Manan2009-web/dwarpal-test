const crypto = require('crypto');
const env = require('../config/env');

const OTP_DIGITS = 6;

function normalizeEmail(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function normalizeOtp(value) {
  return String(value || '')
    .replace(/\D/g, '')
    .slice(0, OTP_DIGITS);
}

function generateOtp() {
  return crypto.randomInt(0, 10 ** OTP_DIGITS).toString().padStart(OTP_DIGITS, '0');
}

function hashOtp(email, otp) {
  return crypto
    .createHash('sha256')
    .update(`${normalizeEmail(email)}:${normalizeOtp(otp)}:${env.otpSecret}`)
    .digest('hex');
}

function compareOtpHash(email, otp, storedHash) {
  if (!storedHash) {
    return false;
  }

  try {
    const calculatedHash = hashOtp(email, otp);
    const calculatedBuffer = Buffer.from(calculatedHash, 'hex');
    const storedBuffer = Buffer.from(String(storedHash || ''), 'hex');

    if (!calculatedBuffer.length || calculatedBuffer.length !== storedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(calculatedBuffer, storedBuffer);
  } catch {
    return false;
  }
}

function getOtpExpiryDate(expiryMinutes = 5) {
  return new Date(Date.now() + Number(expiryMinutes || 5) * 60 * 1000);
}

function isOtpExpired(value) {
  return !value || new Date(value).getTime() <= Date.now();
}

function getRemainingSecondsUntil(value) {
  if (!value) {
    return 0;
  }

  const remainingMs = new Date(value).getTime() - Date.now();
  return Math.max(Math.ceil(remainingMs / 1000), 0);
}

module.exports = {
  compareOtpHash,
  generateOtp,
  getOtpExpiryDate,
  getRemainingSecondsUntil,
  hashOtp,
  isOtpExpired,
  normalizeEmail,
  normalizeOtp
};
