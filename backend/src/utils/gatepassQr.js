const QRCode = require('qrcode');
const env = require('../config/env');
const { createSignedQrPayload, QR_ISSUER, QR_VERSION } = require('./qrSecurity');

function resolveGatepassIdentifier(gatepass) {
  return String(gatepass?.gatepassId || gatepass?.passNumber || '')
    .trim()
    .toUpperCase();
}

function getServerBaseUrl() {
  if (env.serverUrl) {
    return env.serverUrl;
  }

  return `http://localhost:${env.port}`;
}

function getGatepassQrExpiry(gatepass) {
  const sourceDate = gatepass.expectedReturnDate || gatepass.outDate;

  if (!sourceDate) {
    return null;
  }

  const expiryDate = new Date(sourceDate);
  expiryDate.setHours(23, 59, 59, 999);
  return expiryDate;
}

function buildGatepassQrVerificationUrl(gatepass) {
  const verificationUrl = new URL(`/api/gatepasses/security/verify/${gatepass.verificationToken}`, getServerBaseUrl());

  verificationUrl.searchParams.set('gatepassId', resolveGatepassIdentifier(gatepass));
  verificationUrl.searchParams.set('status', gatepass.status || '');
  verificationUrl.searchParams.set('requestKind', gatepass.applicantType === 'student' ? 'student_gatepass' : 'faculty_gatepass');

  return verificationUrl.toString();
}

function combineGatepassOutDateTime(gatepass) {
  if (!gatepass?.outDate) {
    return '';
  }

  const date = new Date(gatepass.outDate);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  if (gatepass.outTime) {
    const [hours = '00', minutes = '00'] = String(gatepass.outTime).split(':');
    date.setHours(Number(hours), Number(minutes), 0, 0);
  }

  return date.toISOString();
}

function compactPayload(payload) {
  return Object.entries(payload).reduce((accumulator, [key, value]) => {
    if (value === undefined || value === null || value === '') {
      return accumulator;
    }

    accumulator[key] = value;
    return accumulator;
  }, {});
}

function combineGatepassReturnDateTime(gatepass) {
  if (!gatepass?.expectedReturnDate) {
    return '';
  }

  const date = new Date(gatepass.expectedReturnDate);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  if (gatepass.expectedReturnTime) {
    const [hours = '00', minutes = '00'] = String(gatepass.expectedReturnTime).split(':');
    date.setHours(Number(hours), Number(minutes), 0, 0);
  }

  return date.toISOString();
}

function buildGatepassQrPayload(gatepass) {
  const gatepassId = resolveGatepassIdentifier(gatepass);

  if (!gatepassId) {
    throw new Error('Gatepass ID is required before generating a QR code.');
  }

  const applicant = gatepass?.applicantSnapshot || gatepass?.createdBy || {};
  const verificationUrl = buildGatepassQrVerificationUrl(gatepass);
  const qrExpiry = getGatepassQrExpiry(gatepass);
  const requestKind = gatepass.applicantType === 'student' ? 'student_gatepass' : 'faculty_gatepass';
  const basePayload = {
    issuer: QR_ISSUER,
    version: QR_VERSION,
    recordType: requestKind,
    requestKind,
    gatepassId,
    applicantType: gatepass.applicantType,
    department: applicant.department || 'Not assigned',
    reason: String(gatepass.reason || '').trim() || 'Not provided',
    outTime: combineGatepassOutDateTime(gatepass) || 'Not provided',
    returnTime: combineGatepassReturnDateTime(gatepass) || undefined,
    verificationToken: gatepass.verificationToken,
    verificationUrl,
    issuedAt: new Date().toISOString(),
    expiresAt: qrExpiry ? qrExpiry.toISOString() : undefined
  };

  if (gatepass.applicantType === 'student') {
    return createSignedQrPayload(compactPayload({
      ...basePayload,
      studentName: String(applicant.fullName || '').trim() || 'Not provided',
      enrollmentNumber: String(applicant.enrollmentNo || '').trim() || 'Not provided',
      vehicleNumber: String(gatepass.vehicleNumber || '').trim().toUpperCase() || undefined
    }));
  }

  return createSignedQrPayload(compactPayload({
    ...basePayload,
    facultyName: String(applicant.fullName || '').trim() || 'Not provided',
    employeeId: String(applicant.employeeId || '').trim() || 'Not provided'
  }));
}

async function buildGatepassQrFields(gatepass) {
  const qrVerificationUrl = buildGatepassQrVerificationUrl(gatepass);
  const qrPayload = buildGatepassQrPayload(gatepass);
  const qrCodeDataUrl = await QRCode.toDataURL(JSON.stringify(qrPayload), {
    errorCorrectionLevel: 'M',
    margin: 1,
    color: {
      dark: '#174132',
      light: '#FFFFFF'
    }
  });

  return {
    qrCodeDataUrl,
    qrGeneratedAt: new Date(),
    qrExpiresAt: getGatepassQrExpiry(gatepass),
    qrRevokedAt: null,
    qrPayload,
    qrVerificationUrl
  };
}

function revokeGatepassQr(gatepass) {
  gatepass.qrCodeDataUrl = null;
  gatepass.qrVerificationUrl = null;
  gatepass.qrPayload = null;
  gatepass.qrGeneratedAt = null;
  gatepass.qrExpiresAt = null;
  gatepass.qrRevokedAt = new Date();
  gatepass.verificationToken = undefined;
  gatepass.markModified('verificationToken');
}

function isGatepassQrExpired(gatepass) {
  return Boolean(gatepass?.qrExpiresAt && new Date(gatepass.qrExpiresAt).getTime() < Date.now());
}

function hasSignedGatepassQr(gatepass) {
  const payload = gatepass?.qrPayload || {};

  return Boolean(
    gatepass?.verificationToken &&
      gatepass?.qrCodeDataUrl &&
      gatepass?.qrGeneratedAt &&
      payload.signature &&
      payload.issuer === QR_ISSUER &&
      String(payload.version || '') === QR_VERSION
  );
}

module.exports = {
  buildGatepassQrFields,
  buildGatepassQrPayload,
  buildGatepassQrVerificationUrl,
  getGatepassQrExpiry,
  hasSignedGatepassQr,
  isGatepassQrExpired,
  resolveGatepassIdentifier,
  revokeGatepassQr
};
