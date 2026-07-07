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

  const safeFullName   = escapeHtml(fullName || 'Student');
  const safeEnrollmentNo = escapeHtml(enrollmentNo || '');
  const safeCollegeName  = escapeHtml(collegeName || 'Your College');
  const loginUrl       = 'https://dwarpal-test.vercel.app';
  const safeLoginUrl   = escapeHtml(loginUrl);
  const year           = new Date().getFullYear();

  const html = `<!doctype html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DwarPal — Student Account Ready</title></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Helvetica,Arial,sans-serif;color:#1e293b;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:32px 16px;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">

      <!-- ═══ HEADER ═══ -->
      <tr><td style="background:linear-gradient(135deg,#1e3a5f 0%,#1e40af 100%);border-radius:16px 16px 0 0;padding:36px 40px;text-align:center;">
        <div style="display:inline-block;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.2);border-radius:10px;padding:8px 22px;margin-bottom:18px;">
          <span style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:0.06em;">&#127968; DwarPal</span>
        </div>
        <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#ffffff;line-height:1.3;">Welcome to Your Smart Campus Gateway</h1>
        <p style="margin:0;font-size:14px;color:#bfdbfe;">Your DwarPal student account is active and ready.</p>
      </td></tr>

      <!-- ═══ BODY ═══ -->
      <tr><td style="background:#ffffff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;padding:36px 40px;">

        <p style="margin:0 0 8px;font-size:17px;font-weight:600;color:#1e293b;">Hi ${safeFullName},</p>
        <p style="margin:0 0 28px;font-size:14px;line-height:1.75;color:#475569;">
          Your student credentials have been set up by the <strong>Campus Operations &amp; IT Desk</strong>
          to grant you secure access to the DwarPal gatepass network.
          Use the details below to sign in for the first time.
        </p>

        <!-- ── Credential Table ── -->
        <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:12px;padding:6px 0;margin:0 0 24px;overflow:hidden;">
          <p style="margin:0;padding:14px 22px 10px;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#64748b;font-weight:700;border-bottom:1px solid #e2e8f0;">Your Login Credentials</p>

          <!-- Enrollment Number -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:14px 22px 6px;font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;white-space:nowrap;">Enrollment Number</td>
            </tr>
            <tr>
              <td style="padding:0 22px 14px;font-size:18px;font-weight:800;color:#1e40af;font-family:monospace;letter-spacing:0.06em;word-break:break-word;overflow-wrap:break-word;">${safeEnrollmentNo}</td>
            </tr>
          </table>
          <div style="height:1px;background:#e2e8f0;"></div>

          <!-- Temporary Password -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:14px 22px 6px;font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;white-space:nowrap;">Temporary Password</td>
            </tr>
            <tr>
              <td style="padding:0 22px 14px;">
                <span style="display:inline-block;font-size:15px;font-weight:700;color:#16a34a;font-family:monospace;background:#f0fdf4;border:1px dashed #86efac;border-radius:7px;padding:5px 14px;word-break:break-word;overflow-wrap:break-word;">${escapeHtml(temporaryPassword)}</span>
              </td>
            </tr>
          </table>
          <div style="height:1px;background:#e2e8f0;"></div>

          <!-- Network Access Code -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:14px 22px 6px;font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;white-space:nowrap;">Student Access Code</td>
            </tr>
            <tr>
              <td style="padding:0 22px 14px;font-size:14px;font-weight:700;color:#1e40af;font-family:monospace;letter-spacing:0.04em;">STUDENT2026</td>
            </tr>
          </table>
          <div style="height:1px;background:#e2e8f0;"></div>

          <!-- Network Access Password -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:14px 22px 6px;font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;white-space:nowrap;">Access Password</td>
            </tr>
            <tr>
              <td style="padding:0 22px 14px;font-size:14px;font-weight:700;color:#1e40af;font-family:monospace;letter-spacing:0.04em;">dwarpal-student-access</td>
            </tr>
          </table>
          <div style="height:1px;background:#e2e8f0;"></div>

          <!-- Portal Link -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:14px 22px 6px;font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;white-space:nowrap;">Student Portal</td>
            </tr>
            <tr>
              <td style="padding:0 22px 14px;font-size:13px;word-break:break-word;overflow-wrap:break-word;">
                <a href="${safeLoginUrl}" style="color:#2563eb;text-decoration:underline;font-weight:600;">${safeLoginUrl}</a>
              </td>
            </tr>
          </table>
        </div>

        <!-- ── Warning Banner ── -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;margin:0 0 28px;">
          <tr><td style="padding:14px 20px;">
            <p style="margin:0;font-size:13px;color:#92400e;"><strong>&#9888; Important:</strong> You will be prompted to change your password on your first sign-in. Keep your credentials private and do not share them.</p>
          </td></tr>
        </table>

        <!-- ── CTA Button ── -->
        <div style="text-align:center;margin:0 0 32px;">
          <a href="${safeLoginUrl}" style="display:inline-block;background:linear-gradient(135deg,#1e40af,#1d4ed8);color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:14px 38px;border-radius:50px;letter-spacing:0.04em;">Sign In to DwarPal &rarr;</a>
        </div>

        <!-- ── Footer ── -->
        <div style="border-top:1px solid #e2e8f0;padding-top:20px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">If you did not expect this email, contact your institution's administration office.<br/>&copy; ${year} DwarPal &bull; ${safeCollegeName}</p>
        </div>

      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  const text = [
    `Welcome to DwarPal — Student Account Ready`,
    '',
    `Hi ${fullName},`,
    '',
    'Your student credentials have been set up by the Campus Operations & IT Desk.',
    '',
    `Enrollment Number : ${enrollmentNo}`,
    `Temporary Password: ${temporaryPassword}`,
    `Student Access Code: STUDENT2026`,
    `Access Password    : dwarpal-student-access`,
    `Student Portal     : ${loginUrl}`,
    '',
    'IMPORTANT: You must change your password on your first login.',
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

async function sendStaffWelcomeEmail({ email, fullName, role, collegeName }) {
  if (!isSmtpConfigured()) {
    console.info('[email] SMTP not configured — skipping staff welcome email.', { to: maskEmail(email) });
    return { skipped: true, reason: 'smtp_not_configured' };
  }

  const safeFullName    = escapeHtml(fullName || 'Team Member');
  const safeRole        = escapeHtml(role || 'Staff');
  const safeCollegeName = escapeHtml(collegeName || 'Your College');
  const loginUrl        = 'https://dwarpal-test.vercel.app';
  const safeLoginUrl    = escapeHtml(loginUrl);
  const year            = new Date().getFullYear();

  const html = `<!doctype html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DwarPal — Account Registration Received</title></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Helvetica,Arial,sans-serif;color:#1e293b;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:32px 16px;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">

      <!-- ═══ HEADER ═══ -->
      <tr><td style="background:linear-gradient(135deg,#1e3a5f 0%,#1e40af 100%);border-radius:16px 16px 0 0;padding:36px 40px;text-align:center;">
        <div style="display:inline-block;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.2);border-radius:10px;padding:8px 22px;margin-bottom:18px;">
          <span style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:0.06em;">&#127968; DwarPal</span>
        </div>
        <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#ffffff;line-height:1.3;">Welcome to Your Smart Campus Gateway</h1>
        <p style="margin:0;font-size:14px;color:#bfdbfe;">Your institutional account workspace is ready.</p>
      </td></tr>

      <!-- ═══ BODY ═══ -->
      <tr><td style="background:#ffffff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;padding:36px 40px;">

        <p style="margin:0 0 8px;font-size:17px;font-weight:600;color:#1e293b;">Hi ${safeFullName},</p>
        <p style="margin:0 0 28px;font-size:14px;line-height:1.75;color:#475569;">
          Your <strong>${safeRole}</strong> registration request has been received by the
          <strong>Campus Operations &amp; IT Desk</strong>. Your department management workspace
          on the DwarPal platform is now active and awaiting your first sign-in.
        </p>

        <!-- ── Info Card ── -->
        <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:12px;padding:6px 0;margin:0 0 24px;overflow:hidden;">
          <p style="margin:0;padding:14px 22px 10px;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#64748b;font-weight:700;border-bottom:1px solid #e2e8f0;">Account Details</p>

          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:14px 22px 6px;font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Registered Name</td>
            </tr>
            <tr>
              <td style="padding:0 22px 14px;font-size:16px;font-weight:700;color:#1e293b;word-break:break-word;overflow-wrap:break-word;">${safeFullName}</td>
            </tr>
          </table>
          <div style="height:1px;background:#e2e8f0;"></div>

          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:14px 22px 6px;font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Role</td>
            </tr>
            <tr>
              <td style="padding:0 22px 14px;font-size:15px;font-weight:700;color:#1e40af;font-family:monospace;letter-spacing:0.04em;">${safeRole}</td>
            </tr>
          </table>
          <div style="height:1px;background:#e2e8f0;"></div>

          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:14px 22px 6px;font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Admin Dashboard</td>
            </tr>
            <tr>
              <td style="padding:0 22px 14px;font-size:13px;word-break:break-word;overflow-wrap:break-word;">
                <a href="${safeLoginUrl}" style="color:#2563eb;text-decoration:underline;font-weight:600;">${safeLoginUrl}</a>
              </td>
            </tr>
          </table>
        </div>

        <!-- ── Info Banner ── -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;margin:0 0 28px;">
          <tr><td style="padding:14px 20px;">
            <p style="margin:0;font-size:13px;color:#1e40af;"><strong>&#8505; Next Steps:</strong> Sign in to your dashboard using the credentials you set during registration. You may be asked to complete an OTP verification on your first login.</p>
          </td></tr>
        </table>

        <!-- ── CTA Button ── -->
        <div style="text-align:center;margin:0 0 32px;">
          <a href="${safeLoginUrl}" style="display:inline-block;background:linear-gradient(135deg,#1e40af,#1d4ed8);color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:14px 38px;border-radius:50px;letter-spacing:0.04em;">Open Admin Dashboard &rarr;</a>
        </div>

        <!-- ── Footer ── -->
        <div style="border-top:1px solid #e2e8f0;padding-top:20px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">If you did not initiate this registration, please contact your IT administrator immediately.<br/>&copy; ${year} DwarPal &bull; ${safeCollegeName}</p>
        </div>

      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  const text = [
    `Welcome to DwarPal — Account Registration Received`,
    '',
    `Hi ${fullName},`,
    '',
    `Your ${role} registration has been received by the Campus Operations & IT Desk.`,
    'Your department management workspace on DwarPal is now active.',
    '',
    `Admin Dashboard: ${loginUrl}`,
    '',
    'Sign in using the credentials you set during registration.',
    '',
    'If you did not initiate this registration, contact your IT administrator.'
  ].join('\n');

  return sendMail({
    to: email,
    subject: `Welcome to DwarPal — Your ${role} Account is Ready`,
    html,
    text,
    context: 'staff-welcome'
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
  sendStaffWelcomeEmail,
  sendVerificationOtpEmail
};
