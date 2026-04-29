const {
  getSmtpConfigurationWarnings,
  getSmtpDiagnostics,
  sendDebugEmail
} = require('../services/emailService');
const { sendSuccess } = require('../utils/apiResponse');

async function sendEmailDebugTest(req, res) {
  const diagnostics = getSmtpDiagnostics();
  const warnings = getSmtpConfigurationWarnings();

  try {
    const result = await sendDebugEmail();

    return sendSuccess(res, {
      message: 'SMTP debug email sent successfully.',
      data: {
        diagnostics,
        warnings,
        result
      }
    });
  } catch (error) {
    return res.status(error.statusCode || 502).json({
      success: false,
      message: error.message || 'SMTP debug email failed.',
      code: error.code || 'SMTP_DEBUG_FAILED',
      data: {
        diagnostics,
        warnings,
        smtpFailure: error.smtpFailure || null
      },
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = {
  sendEmailDebugTest
};
