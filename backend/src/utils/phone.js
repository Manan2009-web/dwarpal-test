const DEFAULT_PHONE_COUNTRY_CODE = '+91';
const E164_PHONE_REGEX = /^\+[1-9]\d{9,14}$/;

function sanitizePhoneInput(value) {
  return String(value || '')
    .trim()
    .replace(/[\s().-]/g, '');
}

function normalizeCountryCode(value) {
  const sanitizedValue = String(value || '')
    .trim()
    .replace(/[^\d+]/g, '');

  if (!sanitizedValue) {
    return DEFAULT_PHONE_COUNTRY_CODE;
  }

  if (sanitizedValue.startsWith('+')) {
    return `+${sanitizedValue.slice(1).replace(/\D/g, '')}`;
  }

  return `+${sanitizedValue.replace(/\D/g, '')}`;
}

function normalizePhoneNumber(value, { defaultCountryCode = DEFAULT_PHONE_COUNTRY_CODE } = {}) {
  let sanitizedValue = sanitizePhoneInput(value);

  if (!sanitizedValue) {
    return '';
  }

  if (sanitizedValue.startsWith('00')) {
    sanitizedValue = `+${sanitizedValue.slice(2)}`;
  }

  if (sanitizedValue.startsWith('+')) {
    const normalizedInternational = `+${sanitizedValue.slice(1).replace(/\D/g, '')}`;
    return E164_PHONE_REGEX.test(normalizedInternational) ? normalizedInternational : '';
  }

  const digitsOnly = sanitizedValue.replace(/\D/g, '');
  if (!digitsOnly) {
    return '';
  }

  const normalizedValue =
    digitsOnly.length === 10
      ? `${normalizeCountryCode(defaultCountryCode)}${digitsOnly}`
      : `+${digitsOnly}`;

  return E164_PHONE_REGEX.test(normalizedValue) ? normalizedValue : '';
}

function isValidPhoneNumber(value, options = {}) {
  return Boolean(normalizePhoneNumber(value, options));
}

module.exports = {
  DEFAULT_PHONE_COUNTRY_CODE,
  E164_PHONE_REGEX,
  isValidPhoneNumber,
  normalizePhoneNumber
};
