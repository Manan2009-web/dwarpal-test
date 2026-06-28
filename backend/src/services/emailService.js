const nodemailer = require('nodemailer');
const env = require('../config/env');
const AppError = require('../utils/appError');

let transporter = null;
let hasLoggedSmtpConfiguration = false;
const DEFAULT_SMTP_TIMEOUT_MS = 10000;
const OTP_EMAIL_FAILURE_MESSAGE = 'OTP email could not be sent. Please try again later.';
const OTP_EMAIL_FAILURE_CODE = 'EMAIL_SEND_FAILED';
const TEMP_DISABLE_AUTH_OTP_EMAIL = true;

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
  return {
    emailFromPresent: hasEnvValue('EMAIL_FROM'),
    smtpHost: env.smtpHost || '',
    smtpPort: Number(env.smtpPort) || 0,
    smtpSecure: Boolean(env.smtpSecure),
    smtpUserPresent: hasEnvValue('SMTP_USER'),
    smtpPassPresent: hasEnvValue('SMTP_PASS'),
    smtpFromNamePresent: hasEnvValue('SMTP_FROM_NAME'),
    smtpFromEmailPresent: hasEnvValue('SMTP_FROM_EMAIL'),
    smtpConnectionTimeoutMs: Number(env.smtpConnectionTimeoutMs) || DEFAULT_SMTP_TIMEOUT_MS,
    smtpGreetingTimeoutMs: Number(env.smtpGreetingTimeoutMs) || DEFAULT_SMTP_TIMEOUT_MS,
    smtpSocketTimeoutMs: Number(env.smtpSocketTimeoutMs) || DEFAULT_SMTP_TIMEOUT_MS,
    smtpOperationTimeoutMs: Number(env.smtpOperationTimeoutMs) || DEFAULT_SMTP_TIMEOUT_MS
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
    diagnostics: getSmtpDiagnostics()
  });
}

function buildSmtpFailureDetails(error) {
  return {
    command: String(error?.command || '').trim(),
    errorCode: String(error?.code || '').trim().toUpperCase(),
    errorMessage: String(error?.message || '').trim()
  };
}

function getSmtpFailureCode(error) {
  const smtpErrorCode = String(error?.code || '').trim().toUpperCase();
  const responseCode = Number(error?.responseCode);

  if (smtpErrorCode === 'EAUTH' || responseCode === 534 || responseCode === 535) {
    return 'SMTP_AUTH_FAILED';
  }

  if (smtpErrorCode === 'ETIMEDOUT') {
    return 'SMTP_TIMEOUT';
  }

  if (['ECONNECTION', 'ESOCKET', 'EDNS'].includes(smtpErrorCode)) {
    return 'SMTP_CONNECTION_FAILED';
  }

  return 'SMTP_DELIVERY_FAILED';
}

function createOtpEmailError(code, statusCode = 503, message = OTP_EMAIL_FAILURE_MESSAGE, extras = {}) {
  const error = new AppError(message, statusCode);
  error.code = code;
  error.publicErrorCode = OTP_EMAIL_FAILURE_CODE;
  Object.assign(error, extras);
  return error;
}

function createSmtpOperationTimeoutError(timeoutMs) {
  const error = new Error(`SMTP operation timed out after ${timeoutMs}ms.`);
  error.code = 'ETIMEDOUT';
  error.command = 'SENDMAIL';
  return error;
}

function withOperationTimeout(promise, timeoutMs) {
  let timeoutId = null;

  const timeoutPromise = new Promise((resolve, reject) => {
    timeoutId = setTimeout(() => {
      reject(createSmtpOperationTimeoutError(timeoutMs));
    }, timeoutMs);

    timeoutId.unref?.();
  });

  return Promise.race([Promise.resolve(promise), timeoutPromise]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });
}

function getTransporter() {
  if (!isSmtpConfigured()) {
    const diagnostics = getSmtpDiagnostics();
    const warnings = getSmtpConfigurationWarnings();
    console.error('[email] SMTP configuration is incomplete for OTP delivery.', {
      diagnostics
    });
    throw createOtpEmailError('SMTP_NOT_CONFIGURED', 503, OTP_EMAIL_FAILURE_MESSAGE, {
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

    console.error('[email] Email delivery failed.', {
      context,
      to: maskEmail(to),
      diagnostics,
      smtpFailure
    });

    throw createOtpEmailError(
      getSmtpFailureCode(error),
      503,
      OTP_EMAIL_FAILURE_MESSAGE,
      {
        smtpFailure,
        smtpDiagnostics: diagnostics
      }
    );
  }
}

async function sendDebugEmail() {
  const to = normalizeEmailAddress(env.smtpUser);

  if (!to) {
    throw createOtpEmailError('SMTP_NOT_CONFIGURED', 503, OTP_EMAIL_FAILURE_MESSAGE, {
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
  if (TEMP_DISABLE_AUTH_OTP_EMAIL) {
    // TEMP_DISABLED_OTP
    console.info('[email] Registration verification OTP email skipped temporarily.', {
      to: maskEmail(email)
    });
    return {
      skipped: true,
      email: maskEmail(email),
      context: 'registration-verification'
    };
  }

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
  if (TEMP_DISABLE_AUTH_OTP_EMAIL) {
    // TEMP_DISABLED_OTP
    console.info('[email] Student login OTP email skipped temporarily.', {
      to: maskEmail(email)
    });
    return {
      skipped: true,
      email: maskEmail(email),
      context: 'student-login'
    };
  }

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

async function sendStudentOnboardingEmail({ email, fullName, enrollmentNo, temporaryPassword, collegeName }) {
  if (!isSmtpConfigured()) {
    console.info('[email] SMTP not configured — skipping student onboarding email.', { to: maskEmail(email) });
    return { skipped: true, reason: 'smtp_not_configured' };
  }

  const safeFullName = escapeHtml(fullName || 'Student');
  const safeEnrollmentNo = escapeHtml(enrollmentNo || '');
  const safeCollegeName = escapeHtml(collegeName || 'Your College');
  const loginUrl = env.clientUrl || env.serverUrl || 'http://localhost:5173';
  const safeLoginUrl = escapeHtml(loginUrl);

  const html = `
    <!doctype html>
    <html lang="en">
      <body style="margin:0;padding:24px;background:#0d1117;font-family:'Segoe UI',Arial,sans-serif;color:#e6edf3;">
        <div style="max-width:600px;margin:0 auto;">

          <!-- Header -->
          <div style="background:linear-gradient(135deg,#1f2937 0%,#111827 100%);border-radius:20px 20px 0 0;padding:36px 40px;text-align:center;border:1px solid rgba(255,255,255,0.06);border-bottom:none;">
            <div style="display:inline-block;background:linear-gradient(135deg,#6d28d9,#4f46e5);border-radius:16px;padding:12px 20px;margin-bottom:20px;">
              <span style="font-size:20px;font-weight:800;color:#ffffff;letter-spacing:0.05em;">DwarPal</span>
            </div>
            <h1 style="margin:0;font-size:26px;font-weight:700;color:#f0f6fc;line-height:1.3;">Welcome to ${safeCollegeName}</h1>
            <p style="margin:10px 0 0;font-size:15px;color:#8b949e;">Your DwarPal student account is ready.</p>
          </div>

          <!-- Body -->
          <div style="background:#161b22;border:1px solid rgba(255,255,255,0.06);border-top:none;border-radius:0 0 20px 20px;padding:36px 40px;">
            <p style="margin:0 0 20px;font-size:16px;color:#c9d1d9;">Hi <strong style="color:#f0f6fc;">${safeFullName}</strong>,</p>
            <p style="margin:0 0 28px;font-size:15px;line-height:1.7;color:#8b949e;">
              Your student account has been created by the Cumulative Administration Office.
              Use the credentials below to sign in to the DwarPal Gatepass Portal.
            </p>

            <!-- Credentials Card -->
            <div style="background:#0d1117;border:1px solid #30363d;border-radius:14px;padding:24px;margin:0 0 28px;">
              <p style="margin:0 0 16px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#6e7681;font-weight:700;">Your Login Credentials</p>

              <div style="display:flex;align-items:center;margin-bottom:16px;">
                <div style="min-width:140px;font-size:12px;color:#6e7681;font-weight:600;">Enrollment No.</div>
                <div style="font-size:18px;font-weight:800;color:#58a6ff;letter-spacing:0.06em;font-family:monospace;">${safeEnrollmentNo}</div>
              </div>

              <div style="height:1px;background:#21262d;margin:0 0 16px;"></div>

              <div style="display:flex;align-items:center;">
                <div style="min-width:140px;font-size:12px;color:#6e7681;font-weight:600;">Temporary Password</div>
                <div style="font-size:16px;font-weight:700;color:#3fb950;letter-spacing:0.1em;font-family:monospace;background:#0d1117;border:1px dashed #3fb950;border-radius:8px;padding:6px 14px;">${escapeHtml(temporaryPassword)}</div>
              </div>
            </div>

            <!-- Warning -->
            <div style="background:rgba(210,153,34,0.1);border:1px solid rgba(210,153,34,0.3);border-radius:10px;padding:16px 20px;margin:0 0 28px;">
              <p style="margin:0;font-size:13px;color:#d29922;">&#9888; You will be required to change your password upon your first login. Keep your credentials safe and do not share them with anyone.</p>
            </div>

            <!-- CTA -->
            <div style="text-align:center;margin:0 0 32px;">
              <a href="${safeLoginUrl}" style="display:inline-block;background:linear-gradient(135deg,#6d28d9,#4f46e5);color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:14px 36px;border-radius:50px;letter-spacing:0.04em;">
                Sign In to DwarPal &rarr;
              </a>
            </div>

            <!-- Footer -->
            <p style="margin:0;font-size:12px;color:#484f58;text-align:center;line-height:1.6;">
              If you did not expect this email, contact your institution's administration office.<br/>
              &copy; ${new Date().getFullYear()} DwarPal &bull; ${safeCollegeName}
            </p>
          </div>

        </div>
      </body>
    </html>
  `;

  const text = [
    `Welcome to ${collegeName || 'Your College'} — DwarPal Student Account`,
    '',
    `Hi ${fullName},`,
    '',
    'Your student account has been created by the Cumulative Administration Office.',
    '',
    `Enrollment Number : ${enrollmentNo}`,
    `Temporary Password: ${temporaryPassword}`,
    '',
    'IMPORTANT: You must change your password on your first login.',
    '',
    `Login at: ${loginUrl}`,
    '',
    'If you did not expect this email, contact your institution admin.'
  ].join('\n');

  return sendMail({
    to: email,
    subject: `Welcome to DwarPal — Your Student Login Credentials`,
    html,
    text,
    context: 'student-onboarding'
  });
}


module.exports = {
  getSmtpConfigurationWarnings,
  getSmtpDiagnostics,
  isSmtpConfigured,
  sendDebugEmail,
  sendPasswordResetOtpEmail,
  sendStudentLoginOtpEmail,
  sendStudentOnboardingEmail,
  sendVerificationOtpEmail
};
