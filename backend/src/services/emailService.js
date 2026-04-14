const nodemailer = require('nodemailer');
const env = require('../config/env');
const AppError = require('../utils/appError');

let transporter = null;

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isSmtpConfigured() {
  return Boolean(env.smtpHost && env.smtpPort && env.smtpUser && env.smtpPass && env.smtpFromEmail);
}

function formatFromAddress() {
  const name = String(env.smtpFromName || 'DwarPal').trim();
  return name ? `"${name}" <${env.smtpFromEmail}>` : env.smtpFromEmail;
}

function getTransporter() {
  if (!isSmtpConfigured()) {
    const error = new AppError(
      'Email delivery is not configured on the server. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and either SMTP_FROM_EMAIL/SMTP_FROM_NAME or EMAIL_FROM before using OTP flows.',
      503
    );
    error.code = 'SMTP_NOT_CONFIGURED';
    throw error;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpSecure || Number(env.smtpPort) === 465,
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

async function sendMail({ to, subject, html, text }) {
  const mailer = getTransporter();

  try {
    return await mailer.sendMail({
      from: formatFromAddress(),
      to,
      subject,
      html,
      text
    });
  } catch (error) {
    const smtpResponse = String(error?.response || '').trim();
    const smtpMessage = String(error?.message || '').trim();
    const appError = new AppError(
      smtpResponse
        ? `OTP email could not be sent. SMTP server response: ${smtpResponse}`
        : smtpMessage
          ? `OTP email could not be sent. ${smtpMessage}`
          : 'OTP email could not be sent. Please verify the SMTP settings and try again.',
      502
    );
    appError.code = 'SMTP_DELIVERY_FAILED';
    throw appError;
  }
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

module.exports = {
  isSmtpConfigured,
  sendPasswordResetOtpEmail,
  sendVerificationOtpEmail
};
