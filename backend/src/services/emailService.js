const nodemailer = require('nodemailer');
const env = require('../config/env');
const AppError = require('../utils/appError');

let smtpTransporter = null;
const EMAIL_FROM_FALLBACK = 'DwarPal <noreply@dwarpal.local>';

function toTrimmedString(value) {
  return String(value || '').trim();
}

function withTimeout(promise, timeoutMs, timeoutMessage) {
  const safeTimeoutMs = Number(timeoutMs) > 0 ? Number(timeoutMs) : 0;

  if (!safeTimeoutMs) {
    return promise;
  }

  let timeoutId = null;

  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new AppError(timeoutMessage, 504));
      }, safeTimeoutMs);
    })
  ]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });
}

function isEmailLike(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toTrimmedString(value));
}

function assertRecipientAddress(to) {
  const recipientAddress = toTrimmedString(to).toLowerCase();

  if (!isEmailLike(recipientAddress)) {
    throw new AppError('A valid recipient email address is required before sending mail.', 422, [
      {
        field: 'email',
        message: 'Please provide a valid email address.'
      }
    ]);
  }

  return recipientAddress;
}

function resolveEmailDeliveryMode() {
  const configuredMode = toTrimmedString(env.emailDeliveryMode || 'auto').toLowerCase();

  // Force console mode if explicitly configured
  if (configuredMode === 'console') {
    return 'console';
  }

  // Force Resend if explicitly configured
  if (configuredMode === 'resend') {
    if (!env.resendApiKey || !env.emailFrom) {
      throw new AppError(
        'Email delivery is configured for Resend, but RESEND_API_KEY or EMAIL_FROM is missing.',
        503
      );
    }
    return 'resend';
  }

  // Auto mode: try SMTP first, then Resend, then console for dev
  if (env.smtpHost && env.smtpUser && env.smtpPass) {
    if (!env.emailFrom) {
      throw new AppError(
        'SMTP email delivery requires EMAIL_FROM to be configured.',
        503
      );
    }
    return 'smtp';
  }

  if (env.resendApiKey && env.emailFrom) {
    return 'resend';
  }

  // Fallback to console only in development
  if (!env.isProduction) {
    return 'console';
  }

  throw new AppError(
    'Email delivery is not configured. Configure SMTP (recommended) or Resend API with EMAIL_FROM before using email verification or password reset.',
    503
  );
}

function getEmailFromAddress() {
  const configuredFrom = toTrimmedString(env.emailFrom || '');

  if (configuredFrom) {
    return configuredFrom;
  }

  if (env.isProduction) {
    throw new AppError('EMAIL_FROM is required for email delivery in production.', 503);
  }

  return EMAIL_FROM_FALLBACK;
}

function getSmtpTransporter() {
  if (smtpTransporter) {
    return smtpTransporter;
  }

  smtpTransporter = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    connectionTimeout: env.smtpConnectionTimeoutMs,
    greetingTimeout: env.smtpGreetingTimeoutMs,
    socketTimeout: env.smtpSocketTimeoutMs,
    auth: {
      user: env.smtpUser,
      pass: env.smtpPass
    }
  });

  return smtpTransporter;
}

async function parseJsonResponse(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function buildEmailLayout({ eyebrow, title, intro, body, footer }) {
  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; color: #173449; line-height: 1.6; background: #f4f7f1; padding: 24px;">
      <div style="max-width: 580px; margin: 0 auto; background: rgba(255, 255, 255, 0.98); border-radius: 24px; padding: 28px; border: 1px solid rgba(23, 52, 73, 0.12); box-shadow: 0 20px 45px rgba(23, 52, 73, 0.08);">
        <p style="margin: 0; font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase; color: #5d7183; font-weight: 700;">${eyebrow}</p>
        <h1 style="margin: 10px 0 12px; font-size: 28px; line-height: 1.2; color: #173449;">${title}</h1>
        <p style="margin: 0 0 18px; color: #4f6373;">${intro}</p>
        ${body}
        <p style="margin: 20px 0 0; color: #5d7183; font-size: 14px;">${footer}</p>
      </div>
    </div>
  `;
}

function buildRegistrationVerificationEmail({ fullName, verificationCode, expiresInMinutes }) {
  const greetingName = String(fullName || '').trim() || 'there';
  const minutesLabel = Math.max(1, Number(expiresInMinutes) || 10);
  const code = String(verificationCode || '').trim();

  return {
    subject: 'Verify your DwarPal email',
    text: [
      `Hello ${greetingName},`,
      '',
      'Welcome to DwarPal.',
      `Use this verification code within ${minutesLabel} minutes to finish creating your account:`,
      '',
      code,
      '',
      'If you did not request this code, you can ignore this email.'
    ].join('\n'),
    html: buildEmailLayout({
      eyebrow: 'DwarPal Verification',
      title: 'Verify your email',
      intro: `Hello ${greetingName}, use the verification code below to finish creating your DwarPal account.`,
      body: `
        <div style="margin: 22px 0; padding: 18px; border-radius: 20px; background: linear-gradient(135deg, rgba(31, 79, 139, 0.1), rgba(47, 156, 98, 0.12)); border: 1px solid rgba(31, 79, 139, 0.14); text-align: center;">
          <p style="margin: 0 0 8px; font-size: 13px; letter-spacing: 0.12em; text-transform: uppercase; color: #5d7183; font-weight: 700;">Verification Code</p>
          <p style="margin: 0; font-size: 32px; letter-spacing: 0.28em; font-weight: 700; color: #173449;">${code}</p>
        </div>
        <p style="margin: 0; color: #4f6373;">This code expires in ${minutesLabel} minutes.</p>
      `,
      footer: 'If you did not request this code, no further action is required.'
    })
  };
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
    html: buildEmailLayout({
      eyebrow: 'DwarPal Security',
      title: 'Reset your password',
      intro: `Hello ${greetingName}, we received a request to reset your DwarPal password.`,
      body: `
        <p style="margin: 0 0 18px;">
          <a
            href="${safeResetUrl}"
            style="display: inline-block; padding: 12px 18px; border-radius: 14px; background: linear-gradient(135deg, #1f4f8b, #2f7f98); color: #ffffff; text-decoration: none; font-weight: 700;"
          >
            Reset Password
          </a>
        </p>
        <p style="margin: 0; color: #4f6373;">This link expires in ${minutesLabel} minutes.</p>
      `,
      footer: 'If you did not request this reset, you can safely ignore this email.'
    })
  };
}

async function sendViaSmtp({ to, subject, text, html }) {
  const recipientAddress = assertRecipientAddress(to);
  const transporter = getSmtpTransporter();

  try {
    console.info('[email] sendViaSmtp before sendMail', {
      to: recipientAddress,
      subject
    });

    const result = await withTimeout(
      transporter.sendMail({
        from: getEmailFromAddress(),
        to: recipientAddress,
        subject,
        text,
        html
      }),
      env.emailSendTimeoutMs,
      `Email delivery timed out after ${Math.ceil(env.emailSendTimeoutMs / 1000)} seconds. Please try again.`
    );

    console.info('[email] sendViaSmtp after sendMail', {
      to: recipientAddress,
      messageId: result?.messageId || null
    });

    return {
      mode: 'smtp',
      providerResponse: {
        messageId: result.messageId,
        response: result.response
      }
    };
  } catch (error) {
    console.error('[email] sendViaSmtp error', {
      to: recipientAddress,
      error: error?.stack || error?.message || error
    });

    throw new AppError(
      error.message || 'Unable to send the email right now. Please try again later.',
      error.statusCode || 502
    );
  }
}

async function sendViaResend({ to, subject, text, html }) {
  const recipientAddress = assertRecipientAddress(to);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new Error('Resend request timed out.'));
  }, env.resendRequestTimeoutMs);

  try {
    console.info('[email] sendViaResend before request', {
      to: recipientAddress,
      subject
    });

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: getEmailFromAddress(),
        to: [recipientAddress],
        subject,
        text,
        html
      }),
      signal: controller.signal
    });

    const payload = await parseJsonResponse(response);

    if (!response.ok) {
      throw new AppError(
        payload?.message || payload?.error || 'Unable to send the email right now. Please try again later.',
        502
      );
    }

    console.info('[email] sendViaResend after request', {
      to: recipientAddress,
      providerMessageId: payload?.id || null
    });

    return {
      mode: 'resend',
      providerResponse: payload
    };
  } catch (error) {
    console.error('[email] sendViaResend error', {
      to: recipientAddress,
      error: error?.stack || error?.message || error
    });

    if (error?.name === 'AbortError') {
      throw new AppError(
        `Email delivery timed out after ${Math.ceil(env.resendRequestTimeoutMs / 1000)} seconds. Please try again.`,
        504
      );
    }

    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(error?.message || 'Unable to send the email right now. Please try again later.', 502);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function sendViaConsole({ to, subject, text }) {
  const recipientAddress = assertRecipientAddress(to);

  const preview = {
    mode: 'console',
    to: recipientAddress,
    from: getEmailFromAddress(),
    subject,
    text
  };

  console.info('[DwarPal email preview]', preview);

  return {
    mode: 'console',
    providerResponse: {
      id: `console-${Date.now()}`
    }
  };
}

async function sendEmail({ to, subject, text, html }) {
  const mode = resolveEmailDeliveryMode();

  console.info('[email] sendEmail route entered', {
    mode,
    to: toTrimmedString(to).toLowerCase(),
    subject
  });

  if (mode === 'smtp') {
    return sendViaSmtp({ to, subject, text, html });
  }

  if (mode === 'resend') {
    return sendViaResend({ to, subject, text, html });
  }

  return sendViaConsole({ to, subject, text });
}

async function sendRegistrationVerificationEmail({ to, fullName, verificationCode, expiresInMinutes }) {
  const email = buildRegistrationVerificationEmail({
    fullName,
    verificationCode,
    expiresInMinutes
  });

  return sendEmail({
    to,
    subject: email.subject,
    text: email.text,
    html: email.html
  });
}

async function sendPasswordResetEmail({ to, fullName, resetUrl, expiresInMinutes }) {
  const email = buildPasswordResetEmail({
    fullName,
    resetUrl,
    expiresInMinutes
  });

  return sendEmail({
    to,
    subject: email.subject,
    text: email.text,
    html: email.html
  });
}

module.exports = {
  sendPasswordResetEmail,
  sendRegistrationVerificationEmail
};
