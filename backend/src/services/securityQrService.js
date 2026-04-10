const Gatepass = require('../models/Gatepass');
const FacultyLeaveRequest = require('../models/FacultyLeaveRequest');
const AppError = require('../utils/appError');
const {
  APPROVED_GATEPASS_STATUSES
} = require('../constants/appConstants');
const {
  extractQrScanData,
  QR_ISSUER,
  verifySignedQrPayload
} = require('../utils/qrSecurity');
const {
  ensureApprovedGatepassQr,
  mapGatepassListItem
} = require('./gatepassService');
const {
  ensureApprovedFacultyLeaveQr,
  mapFacultyLeaveListItem
} = require('./facultyLeaveService');
const {
  isGatepassQrExpired,
  resolveGatepassIdentifier
} = require('../utils/gatepassQr');

const gatepassPopulate = [
  { path: 'createdBy', select: 'fullName email role program department semester enrollmentNo employeeId phone profileImage isActive' },
  { path: 'forwardedTo', select: 'fullName email role program department employeeId phone' },
  { path: 'principalAction.actionBy', select: 'fullName email role program employeeId' },
  { path: 'hodAction.actionBy', select: 'fullName email role program employeeId department' },
  { path: 'caoAction.actionBy', select: 'fullName email role program employeeId' },
  { path: 'securityAction.verifiedBy', select: 'fullName email role employeeId' },
  { path: 'securityAction.checkedOutBy', select: 'fullName email role employeeId' },
  { path: 'securityAction.checkedInBy', select: 'fullName email role employeeId' }
];

const facultyPopulate = [
  { path: 'createdBy', select: 'fullName email role department employeeId phone' },
  { path: 'hodReviewer', select: 'fullName email role department employeeId phone' },
  { path: 'principalReviewer', select: 'fullName email role department employeeId phone' },
  { path: 'caoReviewer', select: 'fullName email role department employeeId phone' },
  { path: 'hodAction.actionBy', select: 'fullName email role department employeeId phone' },
  { path: 'principalAction.actionBy', select: 'fullName email role department employeeId phone' },
  { path: 'caoAction.actionBy', select: 'fullName email role department employeeId phone' },
  { path: 'securityAction.verifiedBy', select: 'fullName email role department employeeId phone' },
  { path: 'securityAction.checkedOutBy', select: 'fullName email role department employeeId phone' },
  { path: 'securityAction.checkedInBy', select: 'fullName email role department employeeId phone' }
];

const SECURITY_BLOCKED_PENDING_STATUSES = new Set(['pending_principal', 'forwarded_to_hod', 'pending_cao']);
const SECURITY_BLOCKED_REJECTED_STATUSES = new Set(['rejected_by_principal', 'rejected_by_hod', 'rejected_by_cao']);

function applyPopulate(query, populateConfig) {
  populateConfig.forEach((item) => {
    query.populate(item);
  });

  return query;
}

function assertSecurityActor(actor) {
  if (actor.role !== 'security') {
    throw new AppError('Only security can verify QR codes', 403);
  }
}

function isFacultyLeaveQrExpired(request) {
  return Boolean(request?.qrExpiresAt && new Date(request.qrExpiresAt).getTime() < Date.now());
}

function buildGatepassSecurityVerificationResult(gatepass) {
  if (!gatepass) {
    return {
      valid: false,
      message: 'QR does not belong to a valid gatepass.',
      gatepass: null,
      nextAction: null
    };
  }

  if (gatepass.status === 'completed') {
    return {
      valid: false,
      message: 'Gatepass was already used and marked returned.',
      gatepass: mapGatepassListItem(gatepass),
      nextAction: null
    };
  }

  if (gatepass.status === 'cancelled' || gatepass.isCancelled) {
    return {
      valid: false,
      message: 'Gatepass cancelled.',
      gatepass: mapGatepassListItem(gatepass),
      nextAction: null
    };
  }

  if (
    SECURITY_BLOCKED_REJECTED_STATUSES.has(gatepass.status) ||
    SECURITY_BLOCKED_PENDING_STATUSES.has(gatepass.status)
  ) {
    return {
      valid: false,
      message: 'Only approved gatepasses can be verified at the security desk.',
      gatepass: mapGatepassListItem(gatepass),
      nextAction: null
    };
  }

  if (!APPROVED_GATEPASS_STATUSES.includes(gatepass.status) && gatepass.status !== 'checked_out_by_security') {
    return {
      valid: false,
      message: `Gatepass is in ${gatepass.status} state and cannot be verified right now.`,
      gatepass: mapGatepassListItem(gatepass),
      nextAction: null
    };
  }

  if (gatepass.qrRevokedAt || !gatepass.verificationToken || isGatepassQrExpired(gatepass)) {
    return {
      valid: false,
      message: 'This gatepass QR is invalid or expired.',
      gatepass: mapGatepassListItem(gatepass),
      nextAction: null
    };
  }

  if (APPROVED_GATEPASS_STATUSES.includes(gatepass.status)) {
    return {
      valid: true,
      message: 'Gatepass is valid and ready to be marked OUT by security.',
      gatepass: mapGatepassListItem(gatepass),
      nextAction: 'markOut'
    };
  }

  return {
    valid: true,
    message: 'Gatepass is already marked OUT and is ready to be marked IN.',
    gatepass: mapGatepassListItem(gatepass),
    nextAction: 'markIn'
  };
}

function buildFacultyLeaveSecurityVerificationResult(request) {
  if (!request) {
    return {
      valid: false,
      message: 'QR does not belong to a valid gatepass.',
      gatepass: null,
      nextAction: null
    };
  }

  if (request.overallStatus !== 'approved') {
    return {
      valid: false,
      message: 'QR does not belong to a valid gatepass.',
      gatepass: mapFacultyLeaveListItem(request),
      nextAction: null
    };
  }

  if (request.qrRevokedAt || !request.verificationToken || isFacultyLeaveQrExpired(request)) {
    return {
      valid: false,
      message: 'This gatepass QR is invalid or expired.',
      gatepass: mapFacultyLeaveListItem(request),
      nextAction: null
    };
  }

  if (request.securityAction?.checkedInAt) {
    return {
      valid: false,
      message: 'Gatepass was already used and marked returned.',
      gatepass: mapFacultyLeaveListItem(request),
      nextAction: null
    };
  }

  if (request.securityAction?.checkedOutAt) {
    return {
      valid: true,
      message: 'Gatepass is already marked OUT and is ready to be marked IN.',
      gatepass: mapFacultyLeaveListItem(request),
      nextAction: 'markIn'
    };
  }

  return {
    valid: true,
    message: 'Gatepass is valid and ready to be marked OUT by security.',
    gatepass: mapFacultyLeaveListItem(request),
    nextAction: 'markOut'
  };
}

async function findGatepassByToken(token) {
  if (!token) {
    return null;
  }

  return applyPopulate(Gatepass.findOne({ verificationToken: token }), gatepassPopulate);
}

async function findFacultyRequestByToken(token) {
  if (!token) {
    return null;
  }

  return applyPopulate(FacultyLeaveRequest.findOne({ verificationToken: token }), facultyPopulate);
}

async function findGatepassByIdentifier(gatepassId) {
  const normalizedIdentifier = resolveGatepassIdentifier({ gatepassId });

  if (!normalizedIdentifier) {
    return null;
  }

  return applyPopulate(
    Gatepass.findOne({
      $or: [{ gatepassId: normalizedIdentifier }, { passNumber: normalizedIdentifier }]
    }),
    gatepassPopulate
  );
}

async function findFacultyRequestByIdentifier(gatepassId) {
  const normalizedIdentifier = String(gatepassId || '').trim().toUpperCase();

  if (!normalizedIdentifier) {
    return null;
  }

  return applyPopulate(FacultyLeaveRequest.findOne({ requestNumber: normalizedIdentifier }), facultyPopulate);
}

function doesScannedPayloadMatchRecord(scanData, record, recordKind) {
  const storedPayload = record?.qrPayload || {};
  const resolvedIdentifier =
    recordKind === 'faculty_leave'
      ? String(record?.requestNumber || '').trim().toUpperCase()
      : resolveGatepassIdentifier(record);
  const resolvedToken = String(record?.verificationToken || '').trim().toUpperCase();
  const allowedRecordTypes =
    recordKind === 'faculty_leave' ? new Set(['faculty_leave']) : new Set(['student_gatepass', 'faculty_gatepass']);

  if (!scanData.payload || !storedPayload.signature) {
    return false;
  }

  if (!verifySignedQrPayload(scanData.payload)) {
    return false;
  }

  return (
    scanData.issuer === QR_ISSUER &&
    scanData.signature === String(storedPayload.signature || '').toUpperCase() &&
    scanData.gatepassId === resolvedIdentifier &&
    scanData.verificationToken === resolvedToken &&
    allowedRecordTypes.has(scanData.recordType)
  );
}

async function ensureRecordQr(record, recordKind) {
  if (!record) {
    return null;
  }

  if (recordKind === 'faculty_leave') {
    await ensureApprovedFacultyLeaveQr(record);
    return record;
  }

  await ensureApprovedGatepassQr(record);
  return record;
}

function buildRecordVerificationResult(record, recordKind) {
  if (recordKind === 'faculty_leave') {
    return buildFacultyLeaveSecurityVerificationResult(record);
  }

  return buildGatepassSecurityVerificationResult(record);
}

async function verifyGatepassByToken(token, actor) {
  assertSecurityActor(actor);

  const normalizedToken = String(token || '').trim().toUpperCase();
  const [gatepass, facultyRequest] = await Promise.all([
    findGatepassByToken(normalizedToken),
    findFacultyRequestByToken(normalizedToken)
  ]);

  if (gatepass) {
    await ensureRecordQr(gatepass, 'gatepass');
    return buildRecordVerificationResult(gatepass, 'gatepass');
  }

  if (facultyRequest) {
    await ensureRecordQr(facultyRequest, 'faculty_leave');
    return buildRecordVerificationResult(facultyRequest, 'faculty_leave');
  }

  return {
    valid: false,
    message: 'QR does not belong to a valid gatepass.',
    gatepass: null,
    nextAction: null
  };
}

async function verifyGatepassById(gatepassId, actor) {
  assertSecurityActor(actor);

  const normalizedIdentifier = String(gatepassId || '').trim().toUpperCase();
  const [gatepass, facultyRequest] = await Promise.all([
    findGatepassByIdentifier(normalizedIdentifier),
    findFacultyRequestByIdentifier(normalizedIdentifier)
  ]);

  if (gatepass) {
    await ensureRecordQr(gatepass, 'gatepass');
    return buildRecordVerificationResult(gatepass, 'gatepass');
  }

  if (facultyRequest) {
    await ensureRecordQr(facultyRequest, 'faculty_leave');
    return buildRecordVerificationResult(facultyRequest, 'faculty_leave');
  }

  return {
    valid: false,
    message: 'Gatepass not found.',
    gatepass: null,
    nextAction: null
  };
}

async function verifyScannedQrValue(rawValue, actor) {
  assertSecurityActor(actor);

  const scanData = extractQrScanData(rawValue);

  if (!scanData.rawValue || !scanData.payload) {
    return {
      valid: false,
      message: 'Scanned QR is invalid or unreadable.',
      gatepass: null,
      nextAction: null
    };
  }

  if (scanData.issuer !== QR_ISSUER || !scanData.signature || !verifySignedQrPayload(scanData.payload)) {
    return {
      valid: false,
      message: 'Scanned QR is not a valid DwarPal gatepass.',
      gatepass: null,
      nextAction: null
    };
  }

  if (!['student_gatepass', 'faculty_gatepass', 'faculty_leave'].includes(scanData.recordType)) {
    return {
      valid: false,
      message: 'Scanned QR is not authorized for DwarPal verification.',
      gatepass: null,
      nextAction: null
    };
  }

  const [gatepass, facultyRequest] = await Promise.all([
    scanData.recordType === 'faculty_leave' ? Promise.resolve(null) : findGatepassByToken(scanData.verificationToken),
    findFacultyRequestByToken(scanData.verificationToken)
  ]);

  const matchedRecordKind = scanData.recordType === 'faculty_leave' ? 'faculty_leave' : 'gatepass';
  const matchedRecord = matchedRecordKind === 'faculty_leave' ? facultyRequest : gatepass;

  if (!matchedRecord) {
    return {
      valid: false,
      message: 'Scanned QR does not match any gatepass record.',
      gatepass: null,
      nextAction: null
    };
  }

  await ensureRecordQr(matchedRecord, matchedRecordKind);

  if (!doesScannedPayloadMatchRecord(scanData, matchedRecord, matchedRecordKind)) {
    return {
      valid: false,
      message: 'Scanned QR does not match the stored gatepass record.',
      gatepass: null,
      nextAction: null
    };
  }

  return buildRecordVerificationResult(matchedRecord, matchedRecordKind);
}

module.exports = {
  verifyGatepassById,
  verifyGatepassByToken,
  verifyScannedQrValue
};
