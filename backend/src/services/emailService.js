const nodemailer = require('nodemailer');
const env = require('../config/env');
const AppError = require('../utils/appError');

let transporter = null;
let hasLoggedSmtpConfiguration = false;
const OTP_EMAIL_FAILURE_MESSAGE = 'OTP email could not be sent. Please try again later.';
const EMAIL_SERVICE_NOT_CONFIGURED_MESSAGE = 'Email service is not configured.';
const EMAIL_LOGIN_FAILED_MESSAGE = 'Email login failed. Check Gmail App Password.';

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isSmtpConfigured() {
  return Boolean(env.smtpHost && env.smtpPort && env.smtpUser && env.smtpPass && getEffectiveFromEmail());
}

function normalizeEmailAddress(value) {
  const normalizedValue = String(value || '').trim().toLowerCase();
  return normalizedValue.includes('@') ? normalizedValue : '';
}

function hasEnvValue(name) {
  return String(process.env[name] || '').trim() !== '';
}

function stripWhitespace(value) {
  return String(value || '').replace(/\s+/g, '').trim();
}

function maskEmail(email) {
  const normalizedEmail = normalizeEmailAddress(email);
  const [localPart = '', domain = ''] = normalizedEmail.split('@');

  if (!localPart || !domain) {
    return normalizedEmail;
  }

  const visiblePart = localPart.slice(0, Math.min(2, localPart.length));
  return `${visiblePart}${'*'.repeat(Math.max(localPart.length - visiblePart.length, 1))}@${domain}`;
}

function looksLikeGmailAddress(email) {
  return /@gmail\.com$/i.test(normalizeEmailAddress(email));
}

function looksLikeGmailAppPassword(password) {
  const normalizedValue = stripWhitespace(password);
  return Boolean(normalizedValue) && /^[a-z0-9]{16}$/i.test(normalizedValue);
}

function getEffectiveFromEmail() {
  return normalizeEmailAddress(env.smtpFromEmail || env.smtpUser);
}

function formatFromAddress() {
  const address = getEffectiveFromEmail();
  const name = String(env.smtpFromName || 'DwarPal').trim();

  if (!address) {
    return '';
  }

  return name ? { name, address } : address;
}

function getSmtpDiagnostics() {
  const resolvedFromEmail = getEffectiveFromEmail();
  const normalizedSmtpUser = normalizeEmailAddress(env.smtpUser);

  return {
    emailFromPresent: hasEnvValue('EMAIL_FROM'),
    smtpHostPresent: hasEnvValue('SMTP_HOST'),
    smtpPortPresent: hasEnvValue('SMTP_PORT'),
    smtpSecurePresent: hasEnvValue('SMTP_SECURE'),
    smtpUserPresent: hasEnvValue('SMTP_USER'),
    smtpPassPresent: hasEnvValue('SMTP_PASS'),
    smtpFromNamePresent: hasEnvValue('SMTP_FROM_NAME'),
    smtpFromEmailPresent: hasEnvValue('SMTP_FROM_EMAIL'),
    smtpHost: env.smtpHost || '',
    smtpPort: Number(env.smtpPort) || 0,
    smtpSecure: Boolean(env.smtpSecure),
    smtpUserMasked: maskEmail(normalizedSmtpUser),
    resolvedFromEmailMasked: maskEmail(resolvedFromEmail),
    smtpUserLooksLikeGmail: looksLikeGmailAddress(normalizedSmtpUser),
    smtpPassLooksLikeAppPassword: looksLikeGmailAppPassword(process.env.SMTP_PASS),
    fromMatchesSmtpUser: Boolean(resolvedFromEmail && normalizedSmtpUser && resolvedFromEmail === normalizedSmtpUser)
  };
}

function getSmtpConfigurationWarnings() {
  const warnings = [];
  const resolvedFromEmail = getEffectiveFromEmail();
  const normalizedSmtpUser = normalizeEmailAddress(env.smtpUser);

  if (env.smtpHost && env.smtpHost !== 'smtp.gmail.com') {
    warnings.push('SMTP_HOST should be smtp.gmail.com for the current Gmail setup.');
  }

  if (Number(env.smtpPort) !== 587) {
    warnings.push('SMTP_PORT should be 587 for the current Gmail setup.');
  }

  if (env.smtpSecure !== false) {
    warnings.push('SMTP_SECURE should be false for STARTTLS on port 587.');
  }

  if (normalizedSmtpUser && !looksLikeGmailAddress(normalizedSmtpUser)) {
    warnings.push('SMTP_USER should be the Gmail address used for SMTP authentication.');
  }

  if (hasEnvValue('SMTP_PASS') && !looksLikeGmailAppPassword(process.env.SMTP_PASS)) {
    warnings.push('SMTP_PASS should be a Gmail App Password. Copy the 16-character app password without spaces.');
  }

  if (!resolvedFromEmail) {
    warnings.push('Set EMAIL_FROM or SMTP_FROM_EMAIL so DwarPal can send mail from the Gmail account.');
  } else if (normalizedSmtpUser && resolvedFromEmail !== normalizedSmtpUser) {
    warnings.push('EMAIL_FROM or SMTP_FROM_EMAIL should use the same Gmail address as SMTP_USER.');
  }

  return warnings;
}

function logSmtpConfigurationSummary(context = 'runtime') {
  console.info('[email] SMTP configuration summary', {
    context,
    diagnostics: getSmtpDiagnostics(),
    warnings: getSmtpConfigurationWarnings()
  });
}

function buildSmtpFailureDetails(error) {
  const responseCode = Number(error?.responseCode);

  return {
    command: String(error?.command || '').trim(),
    errorCode: String(error?.code || '').trim().toUpperCase(),
    errorMessage: String(error?.message || '').trim(),
    name: String(error?.name || '').trim(),
    responseCode: Number.isFinite(responseCode) ? responseCode : null
  };
}

function classifySmtpFailure(error) {
  const smtpFailure = buildSmtpFailureDetails(error);

  if (smtpFailure.errorCode === 'EAUTH' || smtpFailure.responseCode === 534 || smtpFailure.responseCode === 535) {
    return {
      code: 'SMTP_AUTH_FAILED',
      message: EMAIL_LOGIN_FAILED_MESSAGE,
      statusCode: 502
    };
  }

  if (smtpFailure.errorCode === 'ETIMEDOUT') {
    return {
      code: 'SMTP_TIMEOUT',
      message: OTP_EMAIL_FAILURE_MESSAGE,
      statusCode: 504
    };
  }

  if (['ECONNECTION', 'ESOCKET', 'EDNS'].includes(smtpFailure.errorCode)) {
    return {
      code: 'SMTP_CONNECTION_FAILED',
      message: OTP_EMAIL_FAILURE_MESSAGE,
      statusCode: 502
    };
  }

  return {
    code: 'SMTP_DELIVERY_FAILED',
    message: OTP_EMAIL_FAILURE_MESSAGE,
    statusCode: 502
  };
}

function createOtpEmailError(code, statusCode = 502, message = OTP_EMAIL_FAILURE_MESSAGE, extras = {}) {
  const error = new AppError(message, statusCode);
  error.code = code;
  Object.assign(error, extras);
  return error;
}

function withOperationTimeout(promise, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`SMTP operation timed out after ${timeoutMs}ms.`));
    }, timeoutMs);

    Promise.resolve(promise)
      .then((value) => {
        clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

function getTransporter() {
  if (!isSmtpConfigured()) {
    const diagnostics = getSmtpDiagnostics();
    const warnings = getSmtpConfigurationWarnings();
    console.error('[email] OTP delivery attempted without complete SMTP configuration.', {
      diagnostics,
      warnings
    });
    throw createOtpEmailError('SMTP_NOT_CONFIGURED', 503, EMAIL_SERVICE_NOT_CONFIGURED_MESSAGE, {
      smtpDiagnostics: diagnostics,
      smtpWarnings: warnings
    });
  }

  if (!transporter) {
    if (!hasLoggedSmtpConfiguration) {
      logSmtpConfigurationSummary('create-transporter');
      hasLoggedSmtpConfiguration = true;
    }

    transporter = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpSecure || Number(env.smtpPort) === 465,
      connectionTimeout: env.smtpConnectionTimeoutMs,
      greetingTimeout: env.smtpGreetingTimeoutMs,
      socketTimeout: env.smtpSocketTimeoutMs,
      auth: {
        user: env.smtpUser,
        pass: env.smtpPass
      }
    });
  }

  return transporter;
}

function buildOtpEmailTemplate({
  previewLabel,
  heading,
  intro,
  recipientName,
  otp,
  expiryMinutes
}) {
  const safeHeading = escapeHtml(heading);
  const safeIntro = escapeHtml(intro);
  const safeRecipientName = escapeHtml(recipientName || 'there');
  const safeOtp = escapeHtml(otp);
  const safePreviewLabel = escapeHtml(previewLabel);
  const safeExpiryMinutes = escapeHtml(expiryMinutes);

  const html = `
    <!doctype html>
    <html lang="en">
      <body style="margin:0;padding:24px;background:#eef4ef;font-family:'Segoe UI',Arial,sans-serif;color:#153247;">
        <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:28px;overflow:hidden;border:1px solid rgba(21,50,71,0.08);box-shadow:0 18px 60px rgba(21,50,71,0.12);">
          <div style="padding:28px 32px;background:linear-gradient(135deg,#1f5a80,#2f9c62);color:#ffffff;">
            <p style="margin:0;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;opacity:0.9;">${safePreviewLabel}</p>
            <h1 style="margin:10px 0 0;font-size:28px;line-height:1.2;">${safeHeading}</h1>
          </div>
          <div style="padding:28px 32px;">
            <p style="margin:0 0 12px;font-size:16px;line-height:1.6;">Hi ${safeRecipientName},</p>
            <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#516273;">${safeIntro}</p>
            <div style="margin:24px 0;padding:20px 16px;border-radius:22px;background:#f4f7fb;border:1px dashed rgba(31,90,128,0.28);text-align:center;">
              <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#5d7183;font-weight:700;">Your OTP</p>
              <p style="margin:0;font-size:40px;line-height:1;letter-spacing:0.28em;font-weight:800;color:#163247;">${safeOtp}</p>
            </div>
            <p style="margin:0 0 12px;font-size:14px;line-height:1.7;color:#516273;">
              This code expires in <strong>${safeExpiryMinutes} minutes</strong>. Do not share it with anyone.
            </p>
            <p style="margin:0;font-size:13px;line-height:1.7;color:#7c8b98;">
              If you did not request this code, you can safely ignore this email.
            </p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = [
    `${heading}`,
    '',
    `Hi ${recipientName || 'there'},`,
    intro,
    '',
    `OTP: ${otp}`,
    `This code expires in ${expiryMinutes} minutes.`,
    '',
    'If you did not request this code, you can ignore this email.'
  ].join('\n');

  return {
    html,
    text
  };
}

async function sendMail({ to, subject, html, text, context = 'otp' }) {
  const mailer = getTransporter();

  try {
    return await withOperationTimeout(
      mailer.sendMail({
        from: formatFromAddress(),
        to,
        subject,
        html,
        text
      }),
      env.smtpOperationTimeoutMs
    );
  } catch (error) {
    const smtpFailure = buildSmtpFailureDetails(error);
    const diagnostics = getSmtpDiagnostics();
    const warnings = getSmtpConfigurationWarnings();
    const classifiedFailure = classifySmtpFailure(error);

    console.error('[email] Email delivery failed.', {
      context,
      to: maskEmail(to),
      ...smtpFailure,
      diagnostics,
      warnings
    });

    throw createOtpEmailError(
      classifiedFailure.code,
      classifiedFailure.statusCode,
      classifiedFailure.message,
      {
        smtpFailure,
        smtpDiagnostics: diagnostics,
        smtpWarnings: warnings
      }
    );
  }
}

async function sendDebugEmail() {
  const to = normalizeEmailAddress(env.smtpUser);

  if (!to) {
    throw createOtpEmailError('SMTP_NOT_CONFIGURED', 503, EMAIL_SERVICE_NOT_CONFIGURED_MESSAGE, {
      smtpDiagnostics: getSmtpDiagnostics(),
      smtpWarnings: getSmtpConfigurationWarnings()
    });
  }

  const timestamp = new Date().toISOString();
  const subject = `DwarPal SMTP debug email ${timestamp}`;
  const text = [
    'This is a DwarPal SMTP debug email.',
    '',
    `Timestamp: ${timestamp}`,
    'If you received this message, the configured SMTP credentials are working.'
  ].join('\n');
  const html = `
    <p>This is a DwarPal SMTP debug email.</p>
    <p><strong>Timestamp:</strong> ${escapeHtml(timestamp)}</p>
    <p>If you received this message, the configured SMTP credentials are working.</p>
  `;
  const info = await sendMail({
    to,
    subject,
    html,
    text,
    context: 'debug-email'
  });

  return {
    accepted: Array.isArray(info?.accepted) ? info.accepted.map(maskEmail) : [],
    rejected: Array.isArray(info?.rejected) ? info.rejected.map(maskEmail) : [],
    pending: Array.isArray(info?.pending) ? info.pending.map(maskEmail) : [],
    envelope: {
      from: maskEmail(info?.envelope?.from || getEffectiveFromEmail()),
      to: Array.isArray(info?.envelope?.to) ? info.envelope.to.map(maskEmail) : [maskEmail(to)]
    },
    messageId: String(info?.messageId || '').trim(),
    response: String(info?.response || '').trim().slice(0, 200)
  };
}

async function sendVerificationOtpEmail({ email, name, otp, expiryMinutes = env.registerOtpExpiryMinutes }) {
  const template = buildOtpEmailTemplate({
    previewLabel: 'DwarPal verification OTP',
    heading: 'Verify your DwarPal account',
    intro: 'Use the code below to finish creating your DwarPal account and confirm your email address.',
    recipientName: name,
    otp,
    expiryMinutes
  });

  return sendMail({
    to: email,
    subject: 'DwarPal verification OTP',
    html: template.html,
    text: template.text
  });
}

async function sendPasswordResetOtpEmail({ email, name, otp, expiryMinutes = env.passwordResetOtpExpiryMinutes }) {
  const template = buildOtpEmailTemplate({
    previewLabel: 'DwarPal password reset OTP',
    heading: 'Reset your DwarPal password',
    intro: 'Use the code below to verify your identity and reset your DwarPal password securely.',
    recipientName: name,
    otp,
    expiryMinutes
  });

  return sendMail({
    to: email,
    subject: 'DwarPal password reset OTP',
    html: template.html,
    text: template.text
  });
}

async function sendStudentLoginOtpEmail({ email, name, otp, expiryMinutes = env.studentLoginOtpExpiryMinutes }) {
  const template = buildOtpEmailTemplate({
    previewLabel: 'DwarPal student login OTP',
    heading: 'Complete your DwarPal student sign-in',
    intro: 'Use the code below to verify your registered email and finish signing in to your student account.',
    recipientName: name,
    otp,
    expiryMinutes
  });

  return sendMail({
    to: email,
    subject: 'DwarPal student login OTP',
    html: template.html,
    text: template.text
  });
}

module.exports = {
  getSmtpConfigurationWarnings,
  getSmtpDiagnostics,
  isSmtpConfigured,
  sendDebugEmail,
  sendPasswordResetOtpEmail,
  sendStudentLoginOtpEmail,
  sendVerificationOtpEmail
};
