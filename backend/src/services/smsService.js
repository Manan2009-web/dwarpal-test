const env = require('../config/env');
const AppError = require('../utils/appError');

async function parseJsonResponse(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function ensurePhoneOtpConfigured() {
  if (!env.twilioAccountSid || !env.twilioAuthToken || !env.twilioVerifyServiceSid) {
    throw new AppError(
      'Phone verification is not configured. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_VERIFY_SERVICE_SID before using registration OTP.',
      503,
      [
        {
          field: 'phone',
          message: 'Phone verification is not configured right now. Please contact support.'
        }
      ]
    );
  }
}

async function callTwilioVerify(endpoint, formBody, fallbackMessage) {
  ensurePhoneOtpConfigured();

  const response = await fetch(
    `https://verify.twilio.com/v2/Services/${env.twilioVerifyServiceSid}${endpoint}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${env.twilioAccountSid}:${env.twilioAuthToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formBody.toString()
    }
  );

  const payload = await parseJsonResponse(response);

  if (!response.ok) {
    throw new AppError(payload?.message || fallbackMessage, 502, [
      {
        field: 'phone',
        message: fallbackMessage
      }
    ]);
  }

  return payload || {};
}

async function sendPhoneVerificationOtp(phone) {
  return callTwilioVerify(
    '/Verifications',
    new URLSearchParams({
      To: String(phone || '').trim(),
      Channel: env.phoneOtpChannel || 'sms'
    }),
    'Unable to send OTP right now. Please try again.'
  );
}

async function verifyPhoneVerificationOtp(phone, code) {
  return callTwilioVerify(
    '/VerificationCheck',
    new URLSearchParams({
      To: String(phone || '').trim(),
      Code: String(code || '').trim()
    }),
    'Unable to verify OTP right now. Please try again.'
  );
}

module.exports = {
  sendPhoneVerificationOtp,
  verifyPhoneVerificationOtp
};
