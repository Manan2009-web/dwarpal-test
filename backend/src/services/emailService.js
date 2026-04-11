const env = require('../config/env');
const AppError = require('../utils/appError');

async function parseJsonResponse(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function ensureEmailServiceConfigured() {
  if (!env.resendApiKey || !env.emailFrom) {
    throw new AppError(
      'Password reset email delivery is not configured. Add RESEND_API_KEY and EMAIL_FROM before using forgot password.',
      503
    );
  }
}

function buildPasswordResetEmail({ fullName, resetUrl, expiresInMinutes }) {
  const greetingName = String(fullName || '').trim() || 'there';
  const safeResetUrl = String(resetUrl || '').trim();
  const minutesLabel = Math.max(1, Number(expiresInMinutes) || 15);

  return {
    subject: 'Reset your DwarPal password',
    text: [
      `Hello ${greetingName},`,
      '',
      'We received a request to reset your DwarPal password.',
      `Open this link within ${minutesLabel} minutes to choose a new password:`,
      safeResetUrl,
      '',
      'If you did not request this reset, you can ignore this email.'
    ].join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
        <p>Hello ${greetingName},</p>
        <p>We received a request to reset your DwarPal password.</p>
        <p>
          <a
            href="${safeResetUrl}"
            style="display: inline-block; padding: 12px 18px; border-radius: 12px; background: #1f4f8b; color: #ffffff; text-decoration: none; font-weight: 600;"
          >
            Reset Password
          </a>
        </p>
        <p>This link will expire in ${minutesLabel} minutes.</p>
        <p>If you did not request this reset, you can safely ignore this email.</p>
      </div>
    `
  };
}

async function sendPasswordResetEmail({ to, fullName, resetUrl, expiresInMinutes }) {
  ensureEmailServiceConfigured();

  const email = buildPasswordResetEmail({
    fullName,
    resetUrl,
    expiresInMinutes
  });

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.resendApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: env.emailFrom,
      to: [String(to || '').trim()],
      subject: email.subject,
      text: email.text,
      html: email.html
    })
  });

  const payload = await parseJsonResponse(response);

  if (!response.ok) {
    throw new AppError(
      payload?.message || payload?.error || 'Unable to send the password reset email right now. Please try again later.',
      502
    );
  }

  return payload;
}

module.exports = {
  sendPasswordResetEmail
};
