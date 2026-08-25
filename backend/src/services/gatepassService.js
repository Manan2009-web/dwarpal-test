const Gatepass = require('../models/Gatepass');
const User = require('../models/User');
const env = require('../config/env');
const AppError = require('../utils/appError');
const { buildPaginationMeta, getPagination, getSortOptions } = require('../utils/pagination');
const {
  APPROVED_GATEPASS_STATUSES,
  ROUTING_DEPARTMENTS,
  SECURITY_VISIBLE_STATUSES,
  STUDENT_PROGRAMS,
  normalizeDepartment,
  normalizeProgram,
  BOUNCER_VISIBLE_STATUSES
} = require('../constants/appConstants');
const {
  generateVerificationToken,
  normalizeVehicleNumber
} = require('../utils/gatepass');
const {
  buildGatepassQrFields,
  hasSignedGatepassQr,
  isGatepassQrExpired,
  resolveGatepassIdentifier,
  revokeGatepassQr
} = require('../utils/gatepassQr');
const { logAction } = require('./auditService');
const { createBulkNotifications } = require('./notificationService');
const { sendGatepassPushNotification, sendPushToRoles } = require('./pushNotificationService');

const detailPopulate = [
  {
    path: 'createdBy',
    select:
      'fullName email role program department semester enrollmentNo employeeId phone profileImage isActive'
  },
  {
    path: 'forwardedTo',
    select: 'fullName email role program department employeeId phone'
  },
  {
    path: 'principalAction.actionBy',
    select: 'fullName email role program employeeId'
  },
  {
    path: 'hodAction.actionBy',
    select: 'fullName email role program employeeId department'
  },
  {
    path: 'coordinatorAction.actionBy',
    select: 'fullName email role employeeId coordinatorAssignment'
  },
  {
    path: 'caoAction.actionBy',
    select: 'fullName email role program employeeId'
  },
  {
    path: 'securityAction.verifiedBy',
    select: 'fullName email role employeeId'
  },
  {
    path: 'securityAction.checkedOutBy',
    select: 'fullName email role employeeId'
  },
  {
    path: 'securityAction.checkedInBy',
    select: 'fullName email role employeeId'
  }
];

const listPopulate = [
  {
    path: 'createdBy',
    select: 'fullName email role program department semester enrollmentNo employeeId phone profileImage'
  },
  {
    path: 'forwardedTo',
    select: 'fullName email role program department employeeId phone'
  }
];

const listProjection = [
  '_id',
  'gatepassId',
  'passNumber',
  'createdBy',
  'applicantType',
  'applicantSnapshot',
  'reason',
  'destination',
  'outDate',
  'outTime',
  'expectedReturnDate',
  'expectedReturnTime',
  'returnTime',
  'vehicleNumber',
  'status',
  'currentApprovalLevel',
  'forwardedTo',
  'forwardedToRole',
  'rejectionReason',
  'isCancelled',
  'isCompleted',
  'verificationToken',
  'qrCodeDataUrl',
  'qrVerificationUrl',
  'qrPayload',
  'qrGeneratedAt',
  'qrExpiresAt',
  'qrRevokedAt',
  'principalAction.status',
  'principalAction.actedAt',
  'hodAction.status',
  'hodAction.actedAt',
  'coordinatorAction.status',
  'coordinatorAction.actedAt',
  'caoAction.status',
  'caoAction.actedAt',
  'securityAction.verifiedAt',
  'securityAction.checkedOutAt',
  'securityAction.checkedInAt',
  'createdAt',
  'updatedAt'
].join(' ');

const SECURITY_BLOCKED_PENDING_STATUSES = new Set([
  'pending_principal',
  'forwarded_to_hod',
  'forwarded_to_coordinator',
  'pending_cao'
]);
const SECURITY_BLOCKED_REJECTED_STATUSES = new Set([
  'rejected_by_principal',
  'rejected_by_hod',
  'rejected_by_coordinator',
  'rejected_by_cao'
]);

function resolveGatepassReturnTime(gatepass) {
  if (gatepass?.returnTime) {
    const directDate = new Date(gatepass.returnTime);

    if (!Number.isNaN(directDate.getTime())) {
      return directDate;
    }
  }

  if (!gatepass?.expectedReturnDate) {
    return null;
  }

  const derivedDate = new Date(gatepass.expectedReturnDate);

  if (Number.isNaN(derivedDate.getTime())) {
    return null;
  }

  if (gatepass.expectedReturnTime) {
    const [hours = '00', minutes = '00'] = String(gatepass.expectedReturnTime).split(':');
    derivedDate.setHours(Number(hours), Number(minutes), 0, 0);
  }

  return derivedDate;
}

function canGatepassBeMarkedIn(gatepass) {
  return Boolean(resolveGatepassReturnTime(gatepass));
}

const PRINCIPAL_TIMEOUT_MS = Math.max(1, Number(env.principalTimeoutMinutes || 2)) * 60 * 1000; // 2 minutes
const HOD_TIMEOUT_MS = Math.max(1, Number(env.hodTimeoutMinutes || 2)) * 60 * 1000; // 2 minutes
const COORDINATOR_TIMEOUT_MS = Math.max(1, Number(env.coordinatorTimeoutMinutes || 2)) * 60 * 1000; // 2 minutes
const BOUNCER_TIMEOUT_MS = Math.max(1, Number(env.bouncerTimeoutMinutes || 5)) * 60 * 1000; // 5 minutes
const CHAIRMAN_TIMEOUT_MS = Math.max(1, Number(env.chairmanTimeoutMinutes || 5)) * 60 * 1000; // 5 minutes

const AUTO_ESCALATION_TIMEOUT_MS = PRINCIPAL_TIMEOUT_MS;
const AUTO_ESCALATION_SWEEP_INTERVAL_MS = Math.max(1000, Number(env.gatepassEscalationSweepIntervalMs || 2000));
let escalationSweepRunning = false;
let escalationSweepInterval = null;

function applyPopulate(query, populateConfig) {
  populateConfig.forEach((item) => {
    query.populate(item);
  });

  return query;
}

function toId(value) {
  return value?._id?.toString?.() || value?.toString?.() || null;
}

function mapUserSummary(user, fallback = null) {
  if (!user && !fallback) {
    return null;
  }

  if (user) {
    return {
      id: toId(user._id || user.id),
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      program: normalizeProgram(user.program) || null,
      department: normalizeDepartment(user.department) || null,
      semester: user.semester || null,
      enrollmentNo: user.enrollmentNo || null,
      employeeId: user.employeeId || null,
      phone: user.phone || null,
      profileImage: user.profileImage || null
    };
  }

  return {
    id: null,
    fullName: fallback.fullName || null,
    email: fallback.email || null,
    role: null,
    program: normalizeProgram(fallback.program) || null,
    department: normalizeDepartment(fallback.department) || null,
    semester: fallback.semester || null,
    enrollmentNo: fallback.enrollmentNo || null,
    employeeId: fallback.employeeId || null,
    phone: fallback.phone || null,
    profileImage: null
  };
}

function resolveGatepassApprovedBy(gatepass) {
  if (gatepass.applicantType === 'student') {
    if (gatepass.coordinatorAction?.status === 'approved') {
      return gatepass.coordinatorAction?.actionBy?.fullName || 'Coordinator';
    }

    if (gatepass.hodAction?.status === 'approved') {
      return gatepass.hodAction?.actionBy?.fullName || 'HOD';
    }

    if (gatepass.principalAction?.status === 'approved' || gatepass.principalAction?.status === 'forwarded') {
      return gatepass.principalAction?.actionBy?.fullName || 'Principal';
    }
  }

  if (gatepass.applicantType === 'faculty') {
    if (gatepass.caoAction?.status === 'approved') {
      return gatepass.caoAction?.actionBy?.fullName || 'CAO';
    }
    if (gatepass.principalAction?.status === 'approved') {
      return gatepass.principalAction?.actionBy?.fullName || 'Principal';
    }
  }

  return 'Awaiting approval';
}

function mapGatepassListItem(gatepass) {
  const applicant = gatepass.applicantSnapshot || {};
  const resolvedReturnTime = resolveGatepassReturnTime(gatepass);

  return {
    id: toId(gatepass._id || gatepass.id),
    gatepassId: gatepass.gatepassId || gatepass.passNumber || null,
    passNumber: gatepass.passNumber || gatepass.gatepassId || null,
    applicantType: gatepass.applicantType,
    program: normalizeProgram(applicant.program || gatepass.createdBy?.program) || null,
    applicant: {
      fullName: applicant.fullName || gatepass.createdBy?.fullName || null,
      email: applicant.email || gatepass.createdBy?.email || null,
      program: normalizeProgram(applicant.program || gatepass.createdBy?.program) || null,
      department: normalizeDepartment(applicant.department || gatepass.createdBy?.department) || null,
      semester: applicant.semester || gatepass.createdBy?.semester || null,
      enrollmentNo: applicant.enrollmentNo || gatepass.createdBy?.enrollmentNo || null,
      employeeId: applicant.employeeId || gatepass.createdBy?.employeeId || null,
      phone: applicant.phone || gatepass.createdBy?.phone || null,
      isTemporaryEnrollment: Boolean(applicant.isTemporaryEnrollment || gatepass.createdBy?.isTemporaryEnrollment)
    },
    submittedBy: mapUserSummary(gatepass.createdBy, applicant),
    reason: gatepass.reason,
    destination: gatepass.destination || '',
    outDate: gatepass.outDate,
    outTime: gatepass.outTime,
    expectedReturnDate: gatepass.expectedReturnDate || null,
    expectedReturnTime: gatepass.expectedReturnTime || '',
    returnTime: resolvedReturnTime ? resolvedReturnTime.toISOString() : null,
    canMarkIn: canGatepassBeMarkedIn(gatepass),
    vehicleNumber: gatepass.vehicleNumber || '',
    status: gatepass.status,
    isOutdated: isGatepassOutdated(gatepass),
    currentApprovalLevel: gatepass.currentApprovalLevel || null,
    forwardedTo: mapUserSummary(gatepass.forwardedTo),
    forwardedToRole: gatepass.forwardedToRole || null,
    approvedBy: resolveGatepassApprovedBy(gatepass),
    approvedAt:
      gatepass.coordinatorAction?.actedAt ||
      gatepass.hodAction?.actedAt ||
      gatepass.principalAction?.actedAt ||
      gatepass.caoAction?.actedAt ||
      null,
    rejectionReason: gatepass.rejectionReason || '',
    isCancelled: Boolean(gatepass.isCancelled),
    isCompleted: Boolean(gatepass.isCompleted),
    verificationToken: gatepass.verificationToken || null,
    qr: {
      available: Boolean(gatepass.qrCodeDataUrl && gatepass.verificationToken && !gatepass.qrRevokedAt),
      imageDataUrl: gatepass.qrCodeDataUrl || null,
      verificationUrl: gatepass.qrVerificationUrl || null,
      verificationToken: gatepass.verificationToken || null,
      payload: gatepass.qrPayload || null,
      generatedAt: gatepass.qrGeneratedAt || null,
      expiresAt: gatepass.qrExpiresAt || null,
      revokedAt: gatepass.qrRevokedAt || null
    },
    actions: {
      principal: {
        status: gatepass.principalAction?.status || null,
        actedAt: gatepass.principalAction?.actedAt || null
      },
      hod: {
        status: gatepass.hodAction?.status || null,
        actedAt: gatepass.hodAction?.actedAt || null
      },
      coordinator: {
        status: gatepass.coordinatorAction?.status || null,
        actedAt: gatepass.coordinatorAction?.actedAt || null
      },
      cao: {
        status: gatepass.caoAction?.status || null,
        actedAt: gatepass.caoAction?.actedAt || null
      }
    },
    security: {
      verifiedAt: gatepass.securityAction?.verifiedAt || null,
      checkedOutAt: gatepass.securityAction?.checkedOutAt || null,
      checkedInAt: gatepass.securityAction?.checkedInAt || null
    },
    routingHistory: Array.isArray(gatepass.routingHistory) ? gatepass.routingHistory : [],
    createdAt: gatepass.createdAt,
    updatedAt: gatepass.updatedAt
  };
}

function normalizeGatepassIdentifier(value) {
  return String(value || '').trim().toUpperCase();
}

function createApplicantSnapshot(user) {
  return {
    fullName: user.fullName,
    email: user.email,
    program: normalizeProgram(user.program) || null,
    department: normalizeDepartment(user.department) || null,
    semester: user.semester || null,
    enrollmentNo: user.enrollmentNo || null,
    employeeId: user.employeeId || null,
    phone: user.phone,
    isTemporaryEnrollment: Boolean(user.isTemporaryEnrollment)
  };
}

function resolvePayloadReturnTime(payload = {}) {
  if (!payload?.expectedReturnDate) {
    return null;
  }

  const resolvedDate = new Date(payload.expectedReturnDate);

  if (Number.isNaN(resolvedDate.getTime())) {
    return null;
  }

  if (payload.expectedReturnTime) {
    const [hours = '00', minutes = '00'] = String(payload.expectedReturnTime).split(':');
    resolvedDate.setHours(Number(hours), Number(minutes), 0, 0);
  }

  return resolvedDate;
}

function getStudentRoutingSnapshot(source = {}) {
  const snapshotSource = source?.routingSnapshot || source?.applicantSnapshot || source;

  return {
    program: normalizeProgram(snapshotSource.program),
    department: normalizeDepartment(snapshotSource.department),
    semester: Number(snapshotSource.semester) || null
  };
}

function createStudentRoutingSnapshot(source = {}) {
  const snapshot = getStudentRoutingSnapshot(source);

  return {
    program: snapshot.program || null,
    department: snapshot.department || null,
    semester: snapshot.semester || null
  };
}

function syncStudentGatepassRoutingSnapshot(gatepass, fallbackSource = null) {
  if (!gatepass || gatepass.applicantType !== 'student') {
    return {
      changed: false,
      snapshot: null
    };
  }

  const currentSnapshot = getStudentRoutingSnapshot(gatepass);
  const fallbackSnapshot = getStudentRoutingSnapshot(fallbackSource || {});
  const nextSnapshot = {
    program: currentSnapshot.program || fallbackSnapshot.program || null,
    department: currentSnapshot.department || fallbackSnapshot.department || null,
    semester: currentSnapshot.semester || fallbackSnapshot.semester || null
  };

  let changed = false;
  const currentStoredSnapshot = gatepass.routingSnapshot || {};

  if (
    currentStoredSnapshot.program !== nextSnapshot.program ||
    currentStoredSnapshot.department !== nextSnapshot.department ||
    Number(currentStoredSnapshot.semester || 0) !== Number(nextSnapshot.semester || 0)
  ) {
    gatepass.routingSnapshot = nextSnapshot;
    changed = true;
  }

  if (!gatepass.applicantSnapshot) {
    gatepass.applicantSnapshot = {};
  }

  if (!gatepass.applicantSnapshot.program && nextSnapshot.program) {
    gatepass.applicantSnapshot.program = nextSnapshot.program;
    changed = true;
  }

  if (!gatepass.applicantSnapshot.department && nextSnapshot.department) {
    gatepass.applicantSnapshot.department = nextSnapshot.department;
    changed = true;
  }

  if (!gatepass.applicantSnapshot.semester && nextSnapshot.semester) {
    gatepass.applicantSnapshot.semester = nextSnapshot.semester;
    changed = true;
  }

  return {
    changed,
    snapshot: nextSnapshot
  };
}

function getStudentRoutingLabel(program, department) {
  return [program, department, 'HOD'].filter(Boolean).join(' ');
}

function getCoordinatorRoutingLabel(program, department, semester) {
  return [program, department, `Semester ${semester}`, 'Coordinator'].filter(Boolean).join(' ');
}

function isGatepassApproverAvailable(user) {
  if (!user || user.isActive === false) {
    return false;
  }

  return user.gatepassApprovalEnabled !== false;
}

function appendRoutingHistoryEntry(gatepass, entry = {}) {
  const nextEntry = {
    fromLevel: entry.fromLevel || gatepass.currentApprovalLevel || 'system',
    toLevel: entry.toLevel || 'unknown',
    trigger: entry.trigger || 'manual',
    note: String(entry.note || '').trim().slice(0, 500),
    actedBy: entry.actedBy || null,
    actedByRole: entry.actedByRole || 'system',
    actedAt: entry.actedAt || new Date()
  };

  const history = Array.isArray(gatepass.routingHistory) ? gatepass.routingHistory : [];
  history.push(nextEntry);
  gatepass.routingHistory = history;
}

function resetAutoEscalationState(gatepass) {
  gatepass.autoEscalation = {
    state: 'ready',
    blockedStage: null,
    code: null,
    reason: '',
    blockedAt: null,
    lastAttemptAt: new Date()
  };
}

function getAutoEscalationStage(gatepass) {
  if (gatepass?.status === 'pending_principal') {
    return 'principal';
  }

  if (gatepass?.status === 'forwarded_to_hod') {
    return 'hod';
  }

  if (gatepass?.status === 'forwarded_to_coordinator') {
    return 'coordinator';
  }

  if (gatepass?.status === 'forwarded_to_campus_security') {
    return 'campus_security';
  }

  if (gatepass?.status === 'forwarded_to_chairman') {
    return 'chairman';
  }

  return gatepass?.currentApprovalLevel || 'principal';
}

function shouldBlockAutoEscalationError(error) {
  return error instanceof AppError && error.statusCode >= 400 && error.statusCode < 500;
}

async function markAutoEscalationBlocked(gatepass, stage, error) {
  const reason = String(error?.message || 'Routing is blocked for this gatepass.').trim().slice(0, 500);
  const code = `${stage}:${error?.statusCode || 'error'}:${reason}`;
  const currentState = gatepass.autoEscalation || {};
  const isSameBlock =
    currentState.state === 'blocked' &&
    currentState.blockedStage === stage &&
    currentState.code === code;

  gatepass.autoEscalation = {
    state: 'blocked',
    blockedStage: stage,
    code,
    reason,
    blockedAt: currentState.blockedAt || new Date(),
    lastAttemptAt: new Date()
  };

  if (!isSameBlock) {
    appendRoutingHistoryEntry(gatepass, {
      fromLevel: stage,
      toLevel: stage,
      trigger: 'auto_escalation_blocked',
      note: `Auto-escalation blocked: ${reason}`,
      actedBy: null,
      actedByRole: 'system'
    });

    console.warn('[gatepass-escalation] Auto-escalation blocked for gatepass', {
      gatepassId: gatepass?._id?.toString?.() || null,
      passNumber: gatepass?.passNumber || null,
      stage,
      reason
    });
  }

  await gatepass.save();
}

async function resolveStudentHodUser(gatepass, requestedUserId = null) {
  const { program, department } = getStudentRoutingSnapshot(gatepass);

  if (!program || !STUDENT_PROGRAMS.includes(program)) {
    throw new AppError('Student program is missing on this gatepass and routing cannot continue.', 422, [
      {
        field: 'program',
        message: 'Student program is required for HOD routing.'
      }
    ]);
  }

  if (!department || !ROUTING_DEPARTMENTS.includes(department)) {
    throw new AppError('Student department is missing on this gatepass and routing cannot continue.', 422, [
      {
        field: 'department',
        message: 'Student department is required for HOD routing.'
      }
    ]);
  }

  const hodCandidates = await User.find({
    role: 'hod',
    isActive: true,
    ...(requestedUserId ? { _id: requestedUserId } : {})
  })
    .select('_id fullName email role program department employeeId phone createdAt gatepassApprovalEnabled isActive')
    .sort({ createdAt: 1, _id: 1 });

  const matchedHod = hodCandidates.find((candidate) => {
    const candidateProgram = normalizeProgram(candidate.program);
    const candidateDepartment = normalizeDepartment(candidate.department);

    return candidateProgram === program && candidateDepartment === department;
  });

  if (!matchedHod) {
    throw new AppError(`No active ${getStudentRoutingLabel(program, department)} account is available for this student gatepass.`, 404, [
      {
        field: 'forwardToUserId',
        message: `No active ${getStudentRoutingLabel(program, department)} account is available.`
      }
    ]);
  }

  return matchedHod;
}

async function resolveStudentCoordinatorUser(gatepass, requestedUserId = null) {
  const { program, department, semester } = getStudentRoutingSnapshot(gatepass);

  if (!program || !STUDENT_PROGRAMS.includes(program)) {
    throw new AppError('Student program is missing on this gatepass and coordinator routing cannot continue.', 422, [
      {
        field: 'program',
        message: 'Student program is required for coordinator routing.'
      }
    ]);
  }

  if (!department || !ROUTING_DEPARTMENTS.includes(department)) {
    throw new AppError('Student department is missing on this gatepass and coordinator routing cannot continue.', 422, [
      {
        field: 'department',
        message: 'Student department is required for coordinator routing.'
      }
    ]);
  }

  if (!semester) {
    throw new AppError('Student semester is missing on this gatepass and coordinator routing cannot continue.', 422, [
      {
        field: 'semester',
        message: 'Student semester is required for coordinator routing.'
      }
    ]);
  }

  const Class = require('../models/Class');
  let matchedCoordinator = null;

  const targetClass = await Class.findOne({
    program,
    department,
    semester
  });

  if (targetClass && targetClass.coordinator_id) {
    matchedCoordinator = await User.findOne({
      _id: targetClass.coordinator_id,
      role: 'faculty',
      isActive: true,
      ...(requestedUserId ? { _id: requestedUserId } : {})
    }).select(
      '_id fullName email role employeeId phone isActive coordinatorAssignment coordinatorScope createdAt'
    );

    if (matchedCoordinator) {
      // Dynamic injection of coordinatorAssignment for compatibility with other logic
      matchedCoordinator.isCoordinator = true;
      matchedCoordinator.coordinatorAssignment = {
        isCoordinator: true,
        program: targetClass.program,
        department: targetClass.department,
        semester: targetClass.semester
      };
      matchedCoordinator.coordinatorScope = {
        isCoordinator: true,
        program: targetClass.program,
        department: targetClass.department,
        semester: targetClass.semester,
        division: targetClass.division || '',
        academicYear: targetClass.academicYear || '',
        assignedClasses: [{
          program: targetClass.program,
          department: targetClass.department,
          semester: targetClass.semester,
          division: targetClass.division || '',
          academicYear: targetClass.academicYear || ''
        }]
      };
    }
  }

  if (!matchedCoordinator) {
    throw new AppError(
      `No active ${getCoordinatorRoutingLabel(program, department, semester)} account is available for this student gatepass.`,
      404,
      [
        {
          field: 'forwardToUserId',
          message: `No active ${getCoordinatorRoutingLabel(program, department, semester)} account is available.`
        }
      ]
    );
  }

  return matchedCoordinator;
}

async function assignApprovedQr(gatepass) {
  gatepass.gatepassId = gatepass.gatepassId || gatepass.passNumber;
  gatepass.passNumber = gatepass.passNumber || gatepass.gatepassId;
  gatepass.verificationToken = gatepass.verificationToken || generateVerificationToken();
  Object.assign(gatepass, await buildGatepassQrFields(gatepass));
}

async function ensureApprovedGatepassQr(gatepass) {
  if (!gatepass || !APPROVED_GATEPASS_STATUSES.includes(gatepass.status)) {
    return gatepass;
  }

  if (hasSignedGatepassQr(gatepass)) {
    return gatepass;
  }

  await assignApprovedQr(gatepass);
  await gatepass.save();

  return gatepass;
}

function buildSecurityVerificationResult(gatepass, messages = {}) {
  const resolvedMessages = {
    notFoundMessage: 'Gatepass not found.',
    invalidQrMessage: 'Gatepass is invalid or expired.',
    readyToMarkOutMessage: 'Gatepass is valid and ready to be marked OUT by security.',
    readyToMarkInMessage: 'Gatepass already used for OUT marking and is ready to be marked IN.',
    noReturnMarkingMessage: 'This gatepass does not require return marking after being marked OUT.',
    ...messages
  };

  if (!gatepass) {
    return {
      valid: false,
      message: resolvedMessages.notFoundMessage,
      gatepass: null,
      nextAction: null
    };
  }

  if (gatepass.status === 'completed') {
    return {
      valid: false,
      message: 'Gatepass already used.',
      gatepass,
      nextAction: null
    };
  }

  if (gatepass.status === 'cancelled' || gatepass.isCancelled) {
    return {
      valid: false,
      message: 'Gatepass cancelled.',
      gatepass,
      nextAction: null
    };
  }

  if (
    SECURITY_BLOCKED_REJECTED_STATUSES.has(gatepass.status) ||
    SECURITY_BLOCKED_PENDING_STATUSES.has(gatepass.status)
  ) {
    return {
      valid: false,
      message: 'Gatepass not approved.',
      gatepass,
      nextAction: null
    };
  }

  if (APPROVED_GATEPASS_STATUSES.includes(gatepass.status) || gatepass.status === 'checked_out_by_security') {
    if (gatepass.qrRevokedAt || !gatepass.verificationToken || isGatepassQrExpired(gatepass)) {
      return {
        valid: false,
        message: resolvedMessages.invalidQrMessage,
        gatepass,
        nextAction: null
      };
    }

    if (APPROVED_GATEPASS_STATUSES.includes(gatepass.status)) {
      return {
        valid: true,
        message: resolvedMessages.readyToMarkOutMessage,
        gatepass,
        nextAction: 'markOut'
      };
    }

    if (!canGatepassBeMarkedIn(gatepass)) {
      return {
        valid: false,
        message: resolvedMessages.noReturnMarkingMessage,
        gatepass,
        nextAction: null
      };
    }

    return {
      valid: true,
      message: resolvedMessages.readyToMarkInMessage,
      gatepass,
      nextAction: 'markIn'
    };
  }

  return {
    valid: false,
    message: `Gatepass is in ${gatepass.status} state and cannot be verified right now.`,
    gatepass,
    nextAction: null
  };
}

function getInitialGatepassState(user) {
  if (user.role === 'student') {
    return {
      status: 'pending_principal',
      currentApprovalLevel: 'principal',
      principalAction: { status: 'pending' },
      hodAction: { status: 'not_required' },
      coordinatorAction: { status: 'not_required' },
      caoAction: { status: 'not_required' }
    };
  }

  if (user.role === 'faculty') {
    return {
      status: 'pending_principal',
      currentApprovalLevel: 'principal',
      principalAction: { status: 'pending' },
      hodAction: { status: 'not_required' },
      coordinatorAction: { status: 'not_required' },
      caoAction: { status: 'pending' }
    };
  }

  return {
    status: 'pending_cao',
    currentApprovalLevel: 'cao',
    principalAction: { status: 'not_required' },
    hodAction: { status: 'not_required' },
    coordinatorAction: { status: 'not_required' },
    caoAction: { status: 'pending' }
  };
}

async function getActiveUserByRole(role, requestedUserId = null) {
  const user = await findActiveUserByRole(role, requestedUserId);

  if (!user) {
    throw new AppError(`No active ${role.toUpperCase()} account is available`, 404);
  }

  return user;
}

async function findActiveUserByRole(role, requestedUserId = null) {
  const filter = {
    role,
    isActive: true
  };

  if (requestedUserId) {
    filter._id = requestedUserId;
  }

  return User.findOne(filter).sort({ createdAt: 1, _id: 1 });
}

function isCoordinatorActor(actor) {
  return (
    actor?.role === 'faculty' &&
    actor?.coordinatorAssignment &&
    actor.coordinatorAssignment.isCoordinator === true
  );
}

async function listActiveUsersByRole(role) {
  return User.find({
    role,
    isActive: true
  }).select('_id');
}

function buildGatepassNotificationMetadata(gatepass, extra = {}) {
  return {
    passNumber: gatepass.passNumber,
    gatepassId: gatepass.passNumber,
    applicantType: gatepass.applicantType,
    applicantName: gatepass.applicantSnapshot?.fullName || '',
    program: gatepass.applicantSnapshot?.program || '',
    department: gatepass.applicantSnapshot?.department || '',
    status: gatepass.status,
    approvalLevel: gatepass.currentApprovalLevel || '',
    forwardedToRole: gatepass.forwardedToRole || '',
    ...extra
  };
}

async function buildSecurityReadyGatepassNotifications(gatepass, actor) {
  const securityUsers = await listActiveUsersByRole('security');

  return securityUsers.map((securityUser) => ({
    recipient: securityUser._id,
    sender: actor._id,
    gatepass: gatepass._id,
    type: 'gatepass_ready_for_security',
    status: 'pending',
    title: 'Gatepass ready for security verification',
    message: `Gatepass ${gatepass.passNumber} is approved and ready for OUT verification.`,
    metadata: buildGatepassNotificationMetadata(gatepass, {
      workflow: 'security_verification'
    })
  }));
}

function buildRoutingForwardType(trigger) {
  return trigger.startsWith('auto_') ? 'gatepass_escalated' : 'gatepass_forwarded';
}

async function routeStudentGatepassToHod(gatepass, { actor = null, comment = '', trigger = 'manual_forward' } = {}) {
  syncStudentGatepassRoutingSnapshot(gatepass, gatepass.createdBy);
  let hodUser = null;
  try {
    hodUser = await resolveStudentHodUser(gatepass);
  } catch (error) {
    return routeStudentGatepassToCoordinator(gatepass, {
      actor,
      comment: comment || 'HOD is not registered. Auto-forwarded to coordinator.',
      trigger: trigger.startsWith('auto_') ? trigger : 'auto_unavailable_forward',
      fromLevel: 'principal'
    });
  }

  if (!isGatepassApproverAvailable(hodUser)) {
    return routeStudentGatepassToCoordinator(gatepass, {
      actor,
      comment: comment || 'HOD is unavailable. Auto-forwarded to coordinator.',
      trigger: trigger.startsWith('auto_') ? trigger : 'auto_unavailable_forward',
      fromLevel: 'principal'
    });
  }

  gatepass.status = 'forwarded_to_hod';
  gatepass.currentApprovalLevel = 'hod';
  gatepass.isCancelled = false;
  gatepass.isCompleted = false;
  gatepass.forwardedTo = hodUser._id;
  gatepass.forwardedToRole = 'hod';
  gatepass.principalAction = {
    status: 'forwarded',
    actionBy: actor?._id || null,
    actedAt: new Date(),
    comment: comment || ''
  };
  gatepass.hodAction = {
    status: 'pending',
    actionBy: null,
    actedAt: null,
    comment: ''
  };
  gatepass.coordinatorAction = {
    status: 'not_required',
    actionBy: null,
    actedAt: null,
    comment: ''
  };

  appendRoutingHistoryEntry(gatepass, {
    fromLevel: 'principal',
    toLevel: 'hod',
    trigger,
    note: comment || 'Forwarded to HOD for department review.',
    actedBy: actor?._id || null,
    actedByRole: actor?.role || 'system'
  });
  resetAutoEscalationState(gatepass);

  return {
    routedTo: 'hod',
    recipient: hodUser
  };
}

async function routeStudentGatepassToCoordinator(
  gatepass,
  { actor = null, comment = '', trigger = 'manual_forward', fromLevel = 'hod' } = {}
) {
  syncStudentGatepassRoutingSnapshot(gatepass, gatepass.createdBy);
  let coordinatorUser = null;
  try {
    coordinatorUser = await resolveStudentCoordinatorUser(gatepass);
  } catch (error) {
    return routeStudentGatepassToCampusSecurity(gatepass, {
      actor,
      comment: comment || 'Coordinator is not registered. Auto-forwarded to Campus Security.',
      trigger: trigger.startsWith('auto_') ? trigger : 'auto_unavailable_forward',
      fromLevel: 'coordinator'
    });
  }

  if (!isGatepassApproverAvailable(coordinatorUser)) {
    return routeStudentGatepassToCampusSecurity(gatepass, {
      actor,
      comment: comment || 'Coordinator is unavailable. Auto-forwarded to Campus Security.',
      trigger: trigger.startsWith('auto_') ? trigger : 'auto_unavailable_forward',
      fromLevel: 'coordinator'
    });
  }

  gatepass.status = 'forwarded_to_coordinator';
  gatepass.currentApprovalLevel = 'coordinator';
  gatepass.isCancelled = false;
  gatepass.isCompleted = false;
  gatepass.forwardedTo = coordinatorUser._id;
  gatepass.forwardedToRole = 'coordinator';

  if (fromLevel === 'principal') {
    gatepass.principalAction = {
      status: 'forwarded',
      actionBy: actor?._id || null,
      actedAt: new Date(),
      comment: comment || ''
    };

    gatepass.hodAction = {
      status: 'forwarded',
      actionBy: null,
      actedAt: new Date(),
      comment: 'Auto-forwarded to coordinator because HOD is unavailable or delayed.'
    };
  } else {
    gatepass.hodAction = {
      status: 'forwarded',
      actionBy: actor?._id || null,
      actedAt: new Date(),
      comment: comment || ''
    };
  }

  gatepass.coordinatorAction = {
    status: 'pending',
    actionBy: null,
    actedAt: null,
    comment: ''
  };

  appendRoutingHistoryEntry(gatepass, {
    fromLevel,
    toLevel: 'coordinator',
    trigger,
    note: comment || 'Forwarded to class coordinator for semester review.',
    actedBy: actor?._id || null,
    actedByRole: actor?.role || 'system'
  });
  resetAutoEscalationState(gatepass);

  return {
    routedTo: 'coordinator',
    recipient: coordinatorUser
  };
}

async function buildCampusSecurityReadyGatepassNotifications(gatepass, actor) {
  const bouncerUsers = await User.find({
    role: { $in: ['campus_security', 'security'] },
    isActive: true
  }).select('_id');

  return bouncerUsers.map((bouncerUser) => ({
    recipient: bouncerUser._id,
    sender: actor?._id || null,
    gatepass: gatepass._id,
    type: 'gatepass_ready_for_security',
    status: 'pending',
    title: 'Gatepass approved, awaiting bouncer review',
    message: `Gatepass ${gatepass.passNumber} was approved and is awaiting your bouncer verification review.`,
    metadata: buildGatepassNotificationMetadata(gatepass, {
      workflow: 'campus_security_review'
    })
  }));
}

async function routeStudentGatepassToCampusSecurity(
  gatepass,
  { actor = null, comment = '', trigger = 'manual_forward', fromLevel = 'coordinator' } = {}
) {
  syncStudentGatepassRoutingSnapshot(gatepass, gatepass.createdBy);

  gatepass.status = 'forwarded_to_campus_security';
  gatepass.currentApprovalLevel = 'campus_security';
  gatepass.isCancelled = false;
  gatepass.isCompleted = false;
  gatepass.forwardedTo = null;
  gatepass.forwardedToRole = 'campus_security';

  if (fromLevel === 'coordinator') {
    gatepass.coordinatorAction = {
      status: 'forwarded',
      actionBy: actor?._id || null,
      actedAt: new Date(),
      comment: comment || ''
    };
  }

  gatepass.campusSecurityAction = {
    status: 'pending',
    actionBy: null,
    actedAt: null,
    comment: ''
  };

  appendRoutingHistoryEntry(gatepass, {
    fromLevel,
    toLevel: 'campus_security',
    trigger,
    note: comment || 'Forwarded to Campus Security (Bouncer) for review.',
    actedBy: actor?._id || null,
    actedByRole: actor?.role || 'system'
  });
  resetAutoEscalationState(gatepass);

  return {
    routedTo: 'campus_security',
    recipient: null
  };
}

async function resolveStudentChairmanUser(gatepass, requestedUserId = null) {
  const chairman = await User.findOne({
    role: 'chairman',
    isActive: true,
    ...(requestedUserId ? { _id: requestedUserId } : {})
  }).select('_id fullName email role program department employeeId phone createdAt gatepassApprovalEnabled isActive');

  if (!chairman) {
    throw new AppError('No active Director account is available for final gatepass escalation.', 404);
  }
  return chairman;
}

async function routeStudentGatepassToChairman(
  gatepass,
  actor = null,
  trigger = 'escalation',
  comment = ''
) {
  const chairmanUser = await resolveStudentChairmanUser(gatepass);

  gatepass.status = 'forwarded_to_chairman';
  gatepass.currentApprovalLevel = 'chairman';
  const fromLevel = gatepass.forwardedToRole || 'principal';

  gatepass.forwardedTo = chairmanUser._id;
  gatepass.forwardedToRole = 'chairman';
  gatepass.autoForwardState = {
    ...(gatepass.autoForwardState?.toObject?.() || {}),
    coordinatorAssignedAt: null,
    coordinatorTimeoutAt: null,
    hodAssignedAt: null,
    hodTimeoutAt: null,
    principalAssignedAt: null,
    principalTimeoutAt: null
  };
  gatepass.chairmanAction = {
    status: 'pending',
    actionBy: null,
    actedAt: null,
    comment: ''
  };

  appendRoutingHistoryEntry(gatepass, {
    fromLevel,
    toLevel: 'chairman',
    trigger,
    note: comment || 'Forwarded to Director for final institutional review.',
    actedBy: actor?._id || null,
    actedByRole: actor?.role || 'system'
  });
  resetAutoEscalationState(gatepass);

  return {
    routedTo: 'chairman',
    recipient: chairmanUser
  };
}

function resolveRoleLabel(role) {
  switch (role) {
    case 'principal': return 'Principal';
    case 'hod': return 'Academic HOD';
    case 'coordinator': return 'Class Coordinator';
    case 'chairman': return 'Director';
    case 'campus_security': return 'Security | Bouncer';
    case 'security': return 'Security | Main Gate';
    default: return String(role || 'Approver').toUpperCase();
  }
}

function buildForwardNotificationsForStudentGatepass(gatepass, actor, routeResult, trigger) {
  const isEscalation = trigger.startsWith('auto_');
  const notificationType = buildRoutingForwardType(trigger);
  const recipientRoleLabel = resolveRoleLabel(routeResult.routedTo);
  const recipientWorkflowLabel = `${routeResult.routedTo}_review`;

  const notifications = [];

  if (routeResult.recipient?._id) {
    notifications.push({
      recipient: routeResult.recipient._id,
      sender: actor?._id || null,
      gatepass: gatepass._id,
      type: notificationType,
      status: 'forwarded',
      title: isEscalation
        ? `Gatepass auto-forwarded to ${recipientRoleLabel}`
        : `Gatepass forwarded for ${recipientRoleLabel} review`,
      message: isEscalation
        ? `Gatepass ${gatepass.passNumber} was auto-forwarded to you for review.`
        : `Gatepass ${gatepass.passNumber} was forwarded to you for review.`,
      metadata: buildGatepassNotificationMetadata(gatepass, {
        workflow: recipientWorkflowLabel,
        escalated: isEscalation
      })
    });
  }

  const studentId = gatepass.createdBy?._id || gatepass.createdBy;
  if (studentId) {
    notifications.push({
      recipient: studentId,
      sender: actor?._id || null,
      gatepass: gatepass._id,
      type: notificationType,
      status: 'forwarded',
      title: isEscalation
        ? `Gatepass auto-forwarded to ${recipientRoleLabel}`
        : `Gatepass forwarded to ${recipientRoleLabel}`,
      message: isEscalation
        ? `Your gatepass ${gatepass.passNumber} was auto-forwarded to ${recipientRoleLabel} for review.`
        : `Your gatepass ${gatepass.passNumber} was forwarded to ${recipientRoleLabel} for review.`,
      metadata: buildGatepassNotificationMetadata(gatepass, {
        workflow: 'requester_forwarded',
        escalated: isEscalation
      })
    });
  }

  return notifications;
}

function buildSearchFilter(searchTerm) {
  if (!searchTerm) {
    return null;
  }

  const regex = new RegExp(searchTerm.trim(), 'i');

  return {
    $or: [
      { gatepassId: regex },
      { passNumber: regex },
      { reason: regex },
      { destination: regex },
      { 'applicantSnapshot.fullName': regex },
      { 'applicantSnapshot.program': regex },
      { 'applicantSnapshot.department': regex },
      { 'applicantSnapshot.enrollmentNo': regex },
      { 'applicantSnapshot.employeeId': regex }
    ]
  };
}

const OUTDATED_GRACE_MS = 8 * 60 * 60 * 1000; // 8 hours grace period

function getNowFilterConditions(now = new Date()) {
  const cutoffTime = new Date(now.getTime() - OUTDATED_GRACE_MS);
  const cutoffDateStart = new Date(cutoffTime);
  cutoffDateStart.setHours(0, 0, 0, 0);

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const currentTimeString = `${hours}:${minutes}`;

  const cutoffHours = String(cutoffTime.getHours()).padStart(2, '0');
  const cutoffMinutes = String(cutoffTime.getMinutes()).padStart(2, '0');
  const cutoffTimeString = `${cutoffHours}:${cutoffMinutes}`;

  // Outdated: Scheduled departure was more than 8 hours ago
  const outdatedFilter = {
    $or: [
      { outDate: { $lt: cutoffDateStart } },
      { outDate: { $gte: cutoffDateStart, $lte: cutoffTime }, outTime: { $lt: cutoffTimeString } }
    ]
  };

  // Active: Scheduled departure was within the last 8 hours or in the future
  const activeTimeFilter = {
    $or: [
      { outDate: { $gt: cutoffTime } },
      { outDate: { $gte: cutoffDateStart, $lte: now }, outTime: { $gte: cutoffTimeString } }
    ]
  };

  return { now, startOfToday, endOfToday, currentTimeString, outdatedFilter, activeTimeFilter };
}

function isGatepassOutdated(gatepass, now = new Date()) {
  if (!gatepass) return false;
  const status = gatepass.status || gatepass.rawStatus;
  if ([
    'checked_out_by_security',
    'completed',
    'cancelled',
    'rejected_by_principal',
    'rejected_by_hod',
    'rejected_by_coordinator',
    'rejected_by_cao',
    'rejected_by_chairman',
    'rejected'
  ].includes(status)) {
    return false;
  }

  let departureTimestamp = null;
  if (gatepass.outDate) {
    const outDate = new Date(gatepass.outDate);
    if (!Number.isNaN(outDate.getTime())) {
      const [h = '23', m = '59'] = String(gatepass.outTime || '23:59').split(':');
      const outDateTime = new Date(outDate);
      outDateTime.setHours(Number(h), Number(m), 59, 999);
      departureTimestamp = outDateTime.getTime();
    }
  }

  if (!departureTimestamp && gatepass.createdAt) {
    const createdDate = new Date(gatepass.createdAt);
    if (!Number.isNaN(createdDate.getTime())) {
      departureTimestamp = createdDate.getTime();
    }
  }

  if (!departureTimestamp) {
    return false;
  }

  return (now.getTime() - departureTimestamp) > OUTDATED_GRACE_MS;
}

function applyStatusFilter(filter, queryStatus, allowedStatuses = null) {
  const { outdatedFilter, activeTimeFilter } = getNowFilterConditions();

  if (!queryStatus) {
    if (allowedStatuses) {
      filter.status = allowedStatuses.length === 1 ? allowedStatuses[0] : { $in: allowedStatuses };
    }

    return;
  }

  const requestedStatuses = String(queryStatus)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (requestedStatuses.includes('outdated')) {
    filter.status = {
      $in: [
        'pending_principal',
        'forwarded_to_hod',
        'forwarded_to_coordinator',
        'forwarded_to_campus_security',
        'forwarded_to_chairman',
        'pending_cao',
        ...APPROVED_GATEPASS_STATUSES
      ]
    };
    Object.assign(filter, outdatedFilter);
    return;
  }

  if (requestedStatuses.includes('forwarded')) {
    filter.status = {
      $in: ['forwarded_to_hod', 'forwarded_to_coordinator', 'forwarded_to_campus_security', 'forwarded_to_chairman']
    };
    Object.assign(filter, activeTimeFilter);
    return;
  }

  const safeStatuses = allowedStatuses
    ? requestedStatuses.filter((status) => allowedStatuses.includes(status))
    : requestedStatuses;

  if (safeStatuses.length === 0) {
    filter.status = { $in: [] };
    return;
  }

  filter.status = safeStatuses.length === 1 ? safeStatuses[0] : { $in: safeStatuses };

  if (safeStatuses.some((s) => s.startsWith('pending_') || s.startsWith('forwarded_'))) {
    Object.assign(filter, activeTimeFilter);
  }
}

function applySinceFilter(filter, since) {
  if (!since) {
    return;
  }

  filter.updatedAt = {
    ...(filter.updatedAt || {}),
    $gte: new Date(since)
  };
}

function applyListFilters(filter, query = {}, options = {}) {
  const { allowedStatuses = null } = options;

  applyStatusFilter(filter, query.status, allowedStatuses);

  if (query.department) {
    filter['applicantSnapshot.department'] = query.department;
  }

  if (query.applicantType && ['student', 'faculty'].includes(query.applicantType)) {
    filter.applicantType = query.applicantType;
  }

  if (query.fromDate || query.toDate) {
    filter.outDate = {};

    if (query.fromDate) {
      filter.outDate.$gte = new Date(query.fromDate);
    }

    if (query.toDate) {
      filter.outDate.$lte = new Date(query.toDate);
    }
  }

  applySinceFilter(filter, query.since);

  const searchFilter = buildSearchFilter(query.q);

  if (searchFilter) {
    if (filter.$or) {
      filter.$and = [{ $or: filter.$or }, searchFilter];
      delete filter.$or;
    } else {
      Object.assign(filter, searchFilter);
    }
  }
}

function getCoordinatorClasses(actor) {
  const classes = [];
  if (actor?.coordinatorScope?.assignedClasses && Array.isArray(actor.coordinatorScope.assignedClasses)) {
    for (const c of actor.coordinatorScope.assignedClasses) {
      if (c.program && c.department && c.semester) {
        classes.push({
          program: normalizeProgram(c.program),
          department: normalizeDepartment(c.department),
          semester: Number(c.semester)
        });
      }
    }
  }
  if (classes.length === 0 && actor?.coordinatorAssignment) {
    const c = actor.coordinatorAssignment;
    if (c.program && c.department && c.semester) {
      classes.push({
        program: normalizeProgram(c.program),
        department: normalizeDepartment(c.department),
        semester: Number(c.semester)
      });
    }
  }
  return classes;
}

function buildAccessFilter(actor) {
  switch (actor.role) {
    case 'student':
      return { createdBy: actor._id };
    case 'faculty':
      if (isCoordinatorActor(actor)) {
        const coordClasses = getCoordinatorClasses(actor);
        const classConditions = coordClasses.map(c => ({
          'routingSnapshot.program': c.program,
          'routingSnapshot.department': c.department,
          'routingSnapshot.semester': c.semester
        }));
        return {
          $or: [
            { createdBy: actor._id },
            {
              applicantType: 'student',
              $or: [
                { forwardedTo: actor._id },
                { 'coordinatorAction.actionBy': actor._id },
                ...(classConditions.length > 0 ? classConditions : [])
              ]
            }
          ]
        };
      }

      return { createdBy: actor._id };
    case 'principal':
      return { applicantType: { $in: ['student', 'faculty'] } };
    case 'hod': {
      const hodProgram = normalizeProgram(actor.program);
      const hodDepartment = normalizeDepartment(actor.department);

      // Build program+department conditions for primary + all additional scopes
      const hodScopePairs = [{ program: hodProgram, department: hodDepartment }];
      if (Array.isArray(actor.additionalScopes)) {
        for (const scope of actor.additionalScopes) {
          const sp = normalizeProgram(scope.program);
          const sd = normalizeDepartment(scope.department);
          if (sp && sd) {
            hodScopePairs.push({ program: sp, department: sd });
          }
        }
      }

      const programDeptConditions = hodScopePairs
        .filter((s) => s.program && s.department)
        .map((s) => ({ 'routingSnapshot.program': s.program, 'routingSnapshot.department': s.department }));

      return {
        applicantType: 'student',
        $or: [
          { forwardedTo: actor._id },
          { 'hodAction.actionBy': actor._id },
          ...programDeptConditions
        ]
      };
    }
    case 'cao':
      return { applicantType: 'faculty' };
    case 'security':
      return { status: { $in: SECURITY_VISIBLE_STATUSES } };
    case 'campus_security':
      return { applicantType: 'student' };
    case 'chairman':
      return {
        applicantType: 'student',
        $or: [
          { forwardedTo: actor._id },
          { forwardedToRole: 'chairman' },
          { 'chairmanAction.actionBy': actor._id }
        ]
      };
    default:
      throw new AppError('Unsupported role for gatepass access', 403);
  }
}

function buildHistoryFilter(actor, query = {}) {
  const filter = buildAccessFilter(actor);
  const allowedStatuses = actor.role === 'security' ? SECURITY_VISIBLE_STATUSES : null;
  applyListFilters(filter, query, { allowedStatuses });
  return filter;
}

function isEditableByRequester(actor, gatepass) {
  if (actor.role === 'student') {
    return gatepass.status === 'pending_principal';
  }

  if (actor.role === 'faculty') {
    return ['pending_principal', 'pending_cao'].includes(gatepass.status);
  }

  return false;
}

function canUserAccessGatepass(actor, gatepass) {
  const creatorId = toId(gatepass.createdBy);
  const actorId = actor._id.toString();

  if (actor.role === 'student') {
    return creatorId === actorId;
  }

  if (actor.role === 'faculty') {
    if (creatorId === actorId) {
      return true;
    }

    if (!isCoordinatorActor(actor)) {
      return false;
    }

    const forwardedTo = toId(gatepass.forwardedTo);
    const actedBy = toId(gatepass.coordinatorAction?.actionBy);
    return gatepass.applicantType === 'student' && (forwardedTo === actorId || actedBy === actorId);
  }

  if (actor.role === 'principal') {
    return ['student', 'faculty'].includes(gatepass.applicantType);
  }

  if (actor.role === 'hod') {
    const forwardedTo = toId(gatepass.forwardedTo);
    const actedBy = toId(gatepass.hodAction?.actionBy);
    return gatepass.applicantType === 'student' && (forwardedTo === actorId || actedBy === actorId);
  }

  if (actor.role === 'cao') {
    return gatepass.applicantType === 'faculty';
  }

  if (actor.role === 'security') {
    return SECURITY_VISIBLE_STATUSES.includes(gatepass.status);
  }

  if (actor.role === 'campus_security') {
    return gatepass.applicantType === 'student';
  }

  if (actor.role === 'chairman') {
    return gatepass.applicantType === 'student';
  }

  return false;
}

async function getGatepassByIdOrThrow(gatepassId) {
  const gatepass = await applyPopulate(Gatepass.findById(gatepassId), detailPopulate);

  if (!gatepass) {
    throw new AppError('Gatepass not found', 404);
  }

  if (gatepass.applicantType === 'student') {
    const { changed } = syncStudentGatepassRoutingSnapshot(gatepass, gatepass.createdBy);

    if (changed) {
      await gatepass.save();
    }
  }

  await ensureApprovedGatepassQr(gatepass);
  return gatepass;
}

async function getAccessibleGatepass(gatepassId, actor) {
  const gatepass = await getGatepassByIdOrThrow(gatepassId);

  if (!canUserAccessGatepass(actor, gatepass)) {
    throw new AppError('You do not have access to this gatepass', 403);
  }

  return gatepass;
}

async function listGatepasses(filter, query = {}, options = {}) {
  const { page, limit, skip } = getPagination(query, { defaultLimit: 10, maxLimit: 50 });
  const sort = getSortOptions(query, {
    allowedFields: ['updatedAt', 'createdAt', 'outDate'],
    defaultSortBy: options.defaultSortBy || 'updatedAt',
    defaultOrder: options.defaultOrder || 'desc'
  });

  const baseQuery = Gatepass.find(filter)
    .select(options.projection || listProjection)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .lean();

  const populatedQuery = applyPopulate(baseQuery, options.populate || listPopulate);

  const [gatepasses, total] = await Promise.all([
    populatedQuery,
    Gatepass.countDocuments(filter)
  ]);

  const hydratedGatepasses = await Promise.all(
    gatepasses.map(async (gatepass) => {
      if (!APPROVED_GATEPASS_STATUSES.includes(gatepass.status)) {
        return gatepass;
      }

      if (hasSignedGatepassQr(gatepass)) {
        return gatepass;
      }

      const persistedGatepass = await Gatepass.findById(gatepass._id);

      if (!persistedGatepass) {
        return gatepass;
      }

      await ensureApprovedGatepassQr(persistedGatepass);

        return {
          ...gatepass,
          verificationToken: persistedGatepass.verificationToken || null,
          qrCodeDataUrl: persistedGatepass.qrCodeDataUrl || null,
          qrVerificationUrl: persistedGatepass.qrVerificationUrl || null,
          qrPayload: persistedGatepass.qrPayload || null,
          qrGeneratedAt: persistedGatepass.qrGeneratedAt || null,
          qrExpiresAt: persistedGatepass.qrExpiresAt || null,
          qrRevokedAt: persistedGatepass.qrRevokedAt || null
      };
    })
  );

  return {
    gatepasses: hydratedGatepasses.map(mapGatepassListItem),
    meta: {
      ...buildPaginationMeta(total, page, limit),
      sortBy: query.sortBy || options.defaultSortBy || 'updatedAt',
      order: query.order || options.defaultOrder || 'desc',
      since: query.since || null
    }
  };
}

function buildSecurityDateRange(query = {}) {
  const targetDate = query.date ? new Date(query.date) : new Date();
  const startOfDay = new Date(targetDate);
  const endOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  endOfDay.setHours(23, 59, 59, 999);
  return { startOfDay, endOfDay };
}

async function createGatepass(actor, payload, requestMeta) {
  const initialState = getInitialGatepassState(actor);
  const applicantSnapshot = createApplicantSnapshot(actor);
  const routingSnapshot = actor.role === 'student' ? createStudentRoutingSnapshot(applicantSnapshot) : null;

  if (actor.role === 'student') {
    const { program, department, semester } = routingSnapshot;

    if (!program || !department || !semester) {
      throw new AppError('Student profile is missing routing fields required for gatepass approvals.', 422, [
        {
          field: !program ? 'program' : !department ? 'department' : 'semester',
          message: 'Student program, department, and semester are required before creating a gatepass.'
        }
      ]);
    }
  }

  const gatepass = new Gatepass({
    createdBy: actor._id,
    applicantType: actor.role,
    applicantSnapshot,
    routingSnapshot,
    reason: payload.reason,
    destination: payload.destination || '',
    outDate: payload.outDate,
    outTime: payload.outTime,
    expectedReturnDate: payload.expectedReturnDate || null,
    expectedReturnTime: payload.expectedReturnTime || '',
    returnTime: resolvePayloadReturnTime(payload),
    vehicleNumber: normalizeVehicleNumber(payload.vehicleNumber),
    status: initialState.status,
    currentApprovalLevel: initialState.currentApprovalLevel,
    isCancelled: false,
    isCompleted: false,
    forwardedTo: null,
    forwardedToRole: null,
    principalAction: initialState.principalAction,
    hodAction: initialState.hodAction,
    coordinatorAction: initialState.coordinatorAction,
    caoAction: initialState.caoAction
  });

  resetAutoEscalationState(gatepass);

  let reviewer = null;
  let reviewerRole = actor.role === 'student' ? 'principal' : 'cao';
  let isAutoEscalatedSubmission = false;

  if (actor.role === 'student') {
    const principalReviewer = await findActiveUserByRole('principal');

    if (principalReviewer && isGatepassApproverAvailable(principalReviewer)) {
      reviewer = principalReviewer;
      reviewerRole = 'principal';
      gatepass.status = 'pending_principal';
      gatepass.currentApprovalLevel = 'principal';
      gatepass.forwardedTo = principalReviewer._id;
      gatepass.forwardedToRole = 'principal';
      gatepass.principalAction = { status: 'pending' };
      gatepass.hodAction = { status: 'not_required' };
      gatepass.coordinatorAction = { status: 'not_required' };
      appendRoutingHistoryEntry(gatepass, {
        fromLevel: 'system',
        toLevel: 'principal',
        trigger: 'initial_assignment',
        note: 'Submitted to Principal for first-level review.',
        actedBy: actor._id,
        actedByRole: actor.role
      });
    } else {
      isAutoEscalatedSubmission = true;
      const routeResult = await routeStudentGatepassToHod(gatepass, {
        actor: null,
        comment: 'Principal is unavailable. Auto-forwarded for uninterrupted student flow.',
        trigger: 'auto_unavailable_forward'
      });

      reviewer = routeResult.recipient;
      reviewerRole = routeResult.routedTo;
    }
  } else {
    reviewer = await getActiveUserByRole('principal');
    reviewerRole = 'principal';
    gatepass.forwardedTo = reviewer._id;
    gatepass.forwardedToRole = 'principal';
    appendRoutingHistoryEntry(gatepass, {
      fromLevel: 'system',
      toLevel: 'principal',
      trigger: 'initial_assignment',
      note: 'Submitted to Principal for first-level review.',
      actedBy: actor._id,
      actedByRole: actor.role
    });
  }

  await gatepass.save();

  await createBulkNotifications([
    {
      recipient: reviewer._id,
      sender: actor._id,
      gatepass: gatepass._id,
      type: isAutoEscalatedSubmission ? 'gatepass_escalated' : 'gatepass_submitted',
      status: isAutoEscalatedSubmission ? 'forwarded' : 'submitted',
      title: isAutoEscalatedSubmission
        ? `New gatepass auto-routed to ${reviewerRole === 'coordinator' ? 'Coordinator' : 'HOD'}`
        : 'New gatepass request submitted',
      message: isAutoEscalatedSubmission
        ? `${actor.fullName} submitted gatepass ${gatepass.passNumber}. It was auto-routed to your queue because Principal is unavailable.`
        : `${actor.fullName} submitted gatepass ${gatepass.passNumber} for review.`,
      metadata: buildGatepassNotificationMetadata(gatepass, {
        workflow:
          reviewerRole === 'principal'
            ? 'principal_review'
            : reviewerRole === 'hod'
              ? 'hod_review'
              : reviewerRole === 'coordinator'
                ? 'coordinator_review'
                : 'cao_review',
        escalated: isAutoEscalatedSubmission
      })
    },
    {
      recipient: actor._id,
      sender: actor._id,
      gatepass: gatepass._id,
      type: isAutoEscalatedSubmission ? 'gatepass_escalated' : 'gatepass_submitted',
      status: isAutoEscalatedSubmission ? 'forwarded' : 'submitted',
      title: isAutoEscalatedSubmission ? 'Gatepass auto-routed' : 'Gatepass submitted',
      message: isAutoEscalatedSubmission
        ? `Your gatepass ${gatepass.passNumber} was auto-routed to ${reviewerRole === 'coordinator' ? 'Coordinator' : 'HOD'} because Principal is unavailable.`
        : `Your gatepass ${gatepass.passNumber} was submitted and is awaiting ${reviewerRole.toUpperCase()} review.`,
      metadata: buildGatepassNotificationMetadata(gatepass, {
        workflow: 'requester_submission',
        escalated: isAutoEscalatedSubmission
      })
    }
  ]);

  await logAction({
    actorId: actor._id,
    resourceType: 'gatepass',
    resourceId: gatepass._id,
    action: 'create_gatepass',
    message: `Gatepass ${gatepass.passNumber} created`,
    metadata: {
      applicantType: actor.role,
      status: gatepass.status
    },
    requestMeta
  });

  // Push notification — fire-and-forget (never blocks gatepass creation)
  if (reviewer) {
    const reviewerLabel = reviewerRole === 'hod' ? 'HOD' : reviewerRole === 'coordinator' ? 'Coordinator' : 'Principal';
    sendGatepassPushNotification(reviewer._id, {
      title: '📋 New Gatepass Request',
      body: `${actor.fullName} submitted ${gatepass.passNumber} for ${reviewerLabel} review.`,
      gatepassId: String(gatepass._id),
      passNumber: gatepass.passNumber,
      relatedRoute: '/app/pending-gatepasses',
      actions: reviewerRole === 'hod'
        ? [
            { action: 'approve', title: '✓ Approve' },
            { action: 'reject', title: '✗ Reject' },
            { action: 'forward_to_coordinator', title: '→ Send to Coordinator' }
          ]
        : reviewerRole === 'coordinator'
          ? [
              { action: 'approve', title: '✓ Approve' },
              { action: 'reject', title: '✗ Reject' }
            ]
          : [
              { action: 'approve', title: '✓ Approve' },
              { action: 'reject', title: '✗ Reject' },
              { action: 'forward_to_hod', title: '→ Send to HOD' }
            ]
    }).catch((err) => console.error('[gatepass-push] createGatepass push failed:', err.message || err));
  }

  return getGatepassByIdOrThrow(gatepass._id);
}

async function getMyGatepasses(actor, query = {}) {
  const filter = { createdBy: actor._id };
  applyListFilters(filter, query);
  return listGatepasses(filter, query);
}

async function getGatepassDetails(gatepassId, actor) {
  return getAccessibleGatepass(gatepassId, actor);
}

async function updateGatepass(gatepassId, actor, payload, requestMeta) {
  const gatepass = await getAccessibleGatepass(gatepassId, actor);

  if (!isEditableByRequester(actor, gatepass)) {
    throw new AppError('This gatepass can no longer be edited', 400);
  }

  gatepass.reason = payload.reason;
  gatepass.destination = payload.destination || '';
  gatepass.outDate = payload.outDate;
  gatepass.outTime = payload.outTime;
  gatepass.expectedReturnDate = payload.expectedReturnDate || null;
  gatepass.expectedReturnTime = payload.expectedReturnTime || '';
  gatepass.returnTime = resolvePayloadReturnTime(payload);
  gatepass.vehicleNumber = normalizeVehicleNumber(payload.vehicleNumber);
  await gatepass.save();

  await logAction({
    actorId: actor._id,
    resourceType: 'gatepass',
    resourceId: gatepass._id,
    action: 'update_gatepass',
    message: `Gatepass ${gatepass.passNumber} updated`,
    requestMeta
  });

  return getGatepassByIdOrThrow(gatepass._id);
}

async function cancelGatepass(gatepassId, actor, payload, requestMeta) {
  const gatepass = await getAccessibleGatepass(gatepassId, actor);
  const currentReviewerId = gatepass.forwardedTo?._id || gatepass.forwardedTo || null;

  if (!isEditableByRequester(actor, gatepass)) {
    throw new AppError('This gatepass can no longer be cancelled', 400);
  }

  gatepass.status = 'cancelled';
  gatepass.currentApprovalLevel = 'cancelled';
  gatepass.rejectionReason = payload.reason || 'Cancelled by requester';
  gatepass.isCancelled = true;
  gatepass.isCompleted = false;
  gatepass.forwardedTo = null;
  gatepass.forwardedToRole = null;
  if (gatepass.verificationToken || gatepass.qrCodeDataUrl) {
    revokeGatepassQr(gatepass);
  }
  await gatepass.save();

  if (currentReviewerId) {
    await createBulkNotifications([
      {
        recipient: currentReviewerId,
        sender: actor._id,
        gatepass: gatepass._id,
        type: 'gatepass_cancelled',
        status: 'cancelled',
        title: 'Gatepass request cancelled',
        message: `${actor.fullName} cancelled gatepass ${gatepass.passNumber}.`,
        metadata: buildGatepassNotificationMetadata(gatepass, {
          workflow: 'review_queue'
        })
      },
      {
        recipient: actor._id,
        sender: actor._id,
        gatepass: gatepass._id,
        type: 'gatepass_cancelled',
        status: 'cancelled',
        title: 'Gatepass cancelled',
        message: `Your gatepass ${gatepass.passNumber} has been cancelled.`,
        metadata: buildGatepassNotificationMetadata(gatepass, {
          workflow: 'requester_cancelled'
        })
      }
    ]);
  }

  await logAction({
    actorId: actor._id,
    resourceType: 'gatepass',
    resourceId: gatepass._id,
    action: 'cancel_gatepass',
    message: `Gatepass ${gatepass.passNumber} cancelled`,
    metadata: {
      reason: gatepass.rejectionReason
    },
    requestMeta
  });

  return getGatepassByIdOrThrow(gatepass._id);
}

async function getPendingGatepassesForRole(actor, query = {}) {
  kickOffPendingStudentEscalations({
    maxPerSweep: 20
  });

  const filter = {};
  let allowedStatuses;

  if (actor.role === 'principal') {
    filter.applicantType = { $in: ['student', 'faculty'] };
    allowedStatuses = ['pending_principal'];
  } else if (actor.role === 'hod') {
    filter.applicantType = 'student';
    filter.forwardedTo = actor._id;
    allowedStatuses = ['forwarded_to_hod'];
  } else if (actor.role === 'faculty' && isCoordinatorActor(actor)) {
    filter.applicantType = 'student';
    filter.forwardedTo = actor._id;
    allowedStatuses = ['forwarded_to_coordinator'];
  } else if (actor.role === 'campus_security') {
    filter.applicantType = 'student';
    allowedStatuses = BOUNCER_VISIBLE_STATUSES;
  } else if (actor.role === 'chairman') {
    filter.applicantType = 'student';
    filter.forwardedTo = actor._id;
    allowedStatuses = ['forwarded_to_chairman'];
  } else if (actor.role === 'cao') {
    filter.applicantType = 'faculty';
    allowedStatuses = ['pending_cao'];
  } else if (actor.role === 'security') {
    const { startOfDay, endOfDay } = buildSecurityDateRange(query);
    filter.outDate = { $gte: startOfDay, $lte: endOfDay };
    allowedStatuses = APPROVED_GATEPASS_STATUSES;
  } else {
    throw new AppError('Unsupported approval role', 400);
  }

  applyListFilters(filter, query, { allowedStatuses });

  return listGatepasses(filter, query);
}

async function forwardGatepass(gatepassId, actor, payload, requestMeta) {
  const gatepass = await getAccessibleGatepass(gatepassId, actor);

  if (actor.role !== 'principal') {
    throw new AppError('Only principal can forward student gatepasses', 403);
  }

  if (gatepass.applicantType !== 'student' || gatepass.status !== 'pending_principal') {
    throw new AppError('Only pending student gatepasses can be forwarded to HOD', 400);
  }

  const routeResult = await routeStudentGatepassToHod(gatepass, {
    actor,
    comment: payload.comment || 'Forwarded by Principal.',
    trigger: 'manual_forward'
  });

  await gatepass.save();

  await createBulkNotifications(buildForwardNotificationsForStudentGatepass(gatepass, actor, routeResult, 'manual_forward'));

  await logAction({
    actorId: actor._id,
    resourceType: 'gatepass',
    resourceId: gatepass._id,
    action: routeResult.routedTo === 'coordinator' ? 'forward_gatepass_to_coordinator' : 'forward_gatepass',
    message:
      routeResult.routedTo === 'coordinator'
        ? `Gatepass ${gatepass.passNumber} forwarded to Coordinator`
        : `Gatepass ${gatepass.passNumber} forwarded to HOD`,
    metadata: {
      forwardedTo: routeResult.recipient._id.toString(),
      forwardedToRole: routeResult.routedTo
    },
    requestMeta
  });

  // Push notification — fire-and-forget
  if (routeResult.recipient) {
    const isToCoordinator = routeResult.routedTo === 'coordinator';
    sendGatepassPushNotification(routeResult.recipient._id, {
      title: '📋 Gatepass Forwarded to You',
      body: `Principal forwarded ${gatepass.passNumber} to your queue for review.`,
      gatepassId: String(gatepass._id),
      passNumber: gatepass.passNumber,
      relatedRoute: '/app/pending-gatepasses',
      actions: isToCoordinator
        ? [
            { action: 'approve', title: '✓ Approve' },
            { action: 'reject', title: '✗ Reject' }
          ]
        : [
            { action: 'approve', title: '✓ Approve' },
            { action: 'reject', title: '✗ Reject' },
            { action: 'forward_to_coordinator', title: '→ Send to Coordinator' }
          ]
    }).catch((err) => console.error('[gatepass-push] forwardGatepass push failed:', err.message || err));
  }

  return getGatepassByIdOrThrow(gatepass._id);
}

async function forwardGatepassToCoordinator(gatepassId, actor, payload, requestMeta) {
  const gatepass = await getAccessibleGatepass(gatepassId, actor);

  if (actor.role !== 'hod') {
    throw new AppError('Only HOD can forward student gatepasses to coordinator', 403);
  }

  if (gatepass.applicantType !== 'student' || gatepass.status !== 'forwarded_to_hod') {
    throw new AppError('Only HOD-pending student gatepasses can be sent to coordinator', 400);
  }

  const routeResult = await routeStudentGatepassToCoordinator(gatepass, {
    actor,
    comment: payload.comment || 'Forwarded by HOD to coordinator.',
    trigger: 'manual_forward',
    fromLevel: 'hod'
  });

  await gatepass.save();
  await createBulkNotifications(
    buildForwardNotificationsForStudentGatepass(gatepass, actor, routeResult, 'manual_forward')
  );

  await logAction({
    actorId: actor._id,
    resourceType: 'gatepass',
    resourceId: gatepass._id,
    action: 'forward_gatepass_to_coordinator',
    message: `Gatepass ${gatepass.passNumber} forwarded to Coordinator by HOD`,
    metadata: {
      forwardedTo: routeResult.recipient._id.toString(),
      forwardedToRole: routeResult.routedTo
    },
    requestMeta
  });

  // Push notification — fire-and-forget
  if (routeResult.recipient) {
    sendGatepassPushNotification(routeResult.recipient._id, {
      title: '📋 Gatepass Forwarded to You',
      body: `HOD forwarded ${gatepass.passNumber} to your queue for review.`,
      gatepassId: String(gatepass._id),
      passNumber: gatepass.passNumber,
      relatedRoute: '/app/pending-gatepasses',
      actions: [
        { action: 'approve', title: '✓ Approve' },
        { action: 'reject', title: '✗ Reject' }
      ]
    }).catch((err) => console.error('[gatepass-push] forwardToCoordinator push failed:', err.message || err));
  }

  return getGatepassByIdOrThrow(gatepass._id);
}

async function approveGatepass(gatepassId, actor, payload, requestMeta) {
  const gatepass = await getAccessibleGatepass(gatepassId, actor);
  const notifications = [];
  let auditMessage = '';

  if (actor.role === 'principal') {
    if (!['student', 'faculty'].includes(gatepass.applicantType) || gatepass.status !== 'pending_principal') {
      throw new AppError('Principal can only approve pending gatepasses', 400);
    }

    if (gatepass.applicantType === 'student') {
      gatepass.status = 'approved_by_principal';
      gatepass.currentApprovalLevel = 'campus_security';
      gatepass.isCancelled = false;
      gatepass.isCompleted = false;
      gatepass.principalAction = {
        status: 'approved',
        actionBy: actor._id,
        actedAt: new Date(),
        comment: payload.comment || ''
      };
      gatepass.forwardedTo = null;
      gatepass.forwardedToRole = 'campus_security';
      await assignApprovedQr(gatepass);
      auditMessage = `Gatepass ${gatepass.passNumber} approved by Principal (sent to Campus Security)`;

      notifications.push(
        {
          recipient: gatepass.createdBy._id,
          sender: actor._id,
          gatepass: gatepass._id,
          type: 'gatepass_approved',
          status: 'approved',
          title: 'Gatepass approved',
          message: `Your gatepass ${gatepass.passNumber} was approved by Principal and is ready for bouncer verification.`,
          metadata: buildGatepassNotificationMetadata(gatepass, {
            workflow: 'campus_security_review'
          })
        }
      );

      notifications.push(...(await buildCampusSecurityReadyGatepassNotifications(gatepass, actor)));
    } else {
      // applicantType === 'faculty' -> Route to CAO
      const caoUser = await getActiveUserByRole('cao');
      gatepass.status = 'pending_cao';
      gatepass.currentApprovalLevel = 'cao';
      gatepass.isCancelled = false;
      gatepass.isCompleted = false;
      gatepass.principalAction = {
        status: 'approved',
        actionBy: actor._id,
        actedAt: new Date(),
        comment: payload.comment || ''
      };
      gatepass.forwardedTo = caoUser._id;
      gatepass.forwardedToRole = 'cao';
      appendRoutingHistoryEntry(gatepass, {
        fromLevel: 'principal',
        toLevel: 'cao',
        trigger: 'approval',
        note: 'Approved by Principal and sent to CAO.',
        actedBy: actor._id,
        actedByRole: actor.role
      });
      auditMessage = `Faculty gatepass ${gatepass.passNumber} approved by Principal and sent to CAO`;

      notifications.push({
        recipient: gatepass.createdBy._id,
        sender: actor._id,
        gatepass: gatepass._id,
        type: 'gatepass_approved',
        status: 'approved',
        title: 'Gatepass approved by Principal',
        message: `Your gatepass ${gatepass.passNumber} was approved by Principal and forwarded to CAO.`,
        metadata: buildGatepassNotificationMetadata(gatepass, {
          workflow: 'cao_review'
        })
      });

      notifications.push({
        recipient: caoUser._id,
        sender: actor._id,
        gatepass: gatepass._id,
        type: 'gatepass_submitted',
        status: 'submitted',
        title: 'Gatepass awaiting CAO review',
        message: `Faculty gatepass ${gatepass.passNumber} approved by Principal is now awaiting your review.`,
        metadata: buildGatepassNotificationMetadata(gatepass, {
          workflow: 'cao_review'
        })
      });
    }
  } else if (actor.role === 'hod') {
    if (gatepass.applicantType !== 'student' || gatepass.status !== 'forwarded_to_hod') {
      throw new AppError('HOD can only approve forwarded student gatepasses', 400);
    }

    gatepass.status = 'approved_by_hod';
    gatepass.currentApprovalLevel = 'campus_security';
    gatepass.isCancelled = false;
    gatepass.isCompleted = false;
    gatepass.hodAction = {
      status: 'approved',
      actionBy: actor._id,
      actedAt: new Date(),
      comment: payload.comment || ''
    };
    gatepass.forwardedTo = null;
    gatepass.forwardedToRole = 'campus_security';
    await assignApprovedQr(gatepass);
    auditMessage = `Gatepass ${gatepass.passNumber} approved by HOD (sent to Campus Security)`;

    const principalUser = await findActiveUserByRole('principal');

    notifications.push({
      recipient: gatepass.createdBy._id,
      sender: actor._id,
      gatepass: gatepass._id,
      type: 'gatepass_approved',
      status: 'approved',
      title: 'Gatepass approved by HOD',
      message: `Your gatepass ${gatepass.passNumber} was approved by HOD and is ready for bouncer verification.`,
      metadata: buildGatepassNotificationMetadata(gatepass, {
        workflow: 'campus_security_review'
      })
    });

    if (principalUser) {
      notifications.push({
        recipient: principalUser._id,
        sender: actor._id,
        gatepass: gatepass._id,
        type: 'hod_action',
        status: 'approved',
        title: 'HOD completed gatepass review',
        message: `HOD approved gatepass ${gatepass.passNumber}.`,
        metadata: buildGatepassNotificationMetadata(gatepass, {
          action: 'approved',
          workflow: 'principal_visibility'
        })
      });
    }

    notifications.push(...(await buildCampusSecurityReadyGatepassNotifications(gatepass, actor)));
  } else if (actor.role === 'faculty' && isCoordinatorActor(actor)) {
    if (gatepass.applicantType !== 'student' || gatepass.status !== 'forwarded_to_coordinator') {
      throw new AppError('Coordinator can only approve forwarded student gatepasses', 400);
    }

    gatepass.status = 'approved_by_coordinator';
    gatepass.currentApprovalLevel = 'campus_security';
    gatepass.isCancelled = false;
    gatepass.isCompleted = false;
    gatepass.coordinatorAction = {
      status: 'approved',
      actionBy: actor._id,
      actedAt: new Date(),
      comment: payload.comment || ''
    };
    gatepass.forwardedTo = null;
    gatepass.forwardedToRole = 'campus_security';
    await assignApprovedQr(gatepass);
    appendRoutingHistoryEntry(gatepass, {
      fromLevel: 'coordinator',
      toLevel: 'campus_security',
      trigger: 'approval',
      note: 'Approved by coordinator and sent to Campus Security (Bouncer).',
      actedBy: actor._id,
      actedByRole: actor.role
    });
    auditMessage = `Gatepass ${gatepass.passNumber} approved by Coordinator (sent to Campus Security)`;

    const [principalUser, hodUser] = await Promise.all([
      findActiveUserByRole('principal'),
      resolveStudentHodUser(gatepass).catch(() => null)
    ]);

    notifications.push(
      {
        recipient: gatepass.createdBy._id,
        sender: actor._id,
        gatepass: gatepass._id,
        type: 'gatepass_approved',
        status: 'approved',
        title: 'Gatepass approved by Coordinator',
        message: `Your gatepass ${gatepass.passNumber} was approved by Coordinator and is ready for bouncer verification.`,
        metadata: buildGatepassNotificationMetadata(gatepass, {
          workflow: 'campus_security_review'
        })
      }
    );

    if (principalUser) {
      notifications.push({
        recipient: principalUser._id,
        sender: actor._id,
        gatepass: gatepass._id,
        type: 'coordinator_action',
        status: 'approved',
        title: 'Coordinator completed gatepass review',
        message: `Coordinator approved gatepass ${gatepass.passNumber}.`,
        metadata: buildGatepassNotificationMetadata(gatepass, {
          action: 'approved',
          workflow: 'principal_visibility'
        })
      });
    }

    if (hodUser) {
      notifications.push({
        recipient: hodUser._id,
        sender: actor._id,
        gatepass: gatepass._id,
        type: 'coordinator_action',
        status: 'approved',
        title: 'Coordinator completed gatepass review',
        message: `Coordinator approved gatepass ${gatepass.passNumber}.`,
        metadata: buildGatepassNotificationMetadata(gatepass, {
          action: 'approved',
          workflow: 'hod_visibility'
        })
      });
    }

    notifications.push(...(await buildCampusSecurityReadyGatepassNotifications(gatepass, actor)));
  } else if (actor.role === 'chairman') {
    if (gatepass.applicantType !== 'student' || gatepass.status !== 'forwarded_to_chairman') {
      throw new AppError('Director can only approve forwarded student gatepasses', 400);
    }

    gatepass.status = 'approved_by_chairman';
    gatepass.currentApprovalLevel = 'campus_security';
    gatepass.isCancelled = false;
    gatepass.isCompleted = false;
    gatepass.chairmanAction = {
      status: 'approved',
      actionBy: actor._id,
      actedAt: new Date(),
      comment: payload.comment || ''
    };
    gatepass.forwardedTo = null;
    gatepass.forwardedToRole = 'campus_security';
    await assignApprovedQr(gatepass);
    appendRoutingHistoryEntry(gatepass, {
      fromLevel: 'chairman',
      toLevel: 'campus_security',
      trigger: 'approval',
      note: 'Approved by Director and sent to Campus Security (Bouncer).',
      actedBy: actor._id,
      actedByRole: actor.role
    });
    auditMessage = `Gatepass ${gatepass.passNumber} approved by Director (sent to Campus Security)`;

    notifications.push({
      recipient: gatepass.createdBy._id,
      sender: actor._id,
      gatepass: gatepass._id,
      type: 'gatepass_approved',
      status: 'approved',
      title: 'Gatepass approved by Director',
      message: `Your gatepass ${gatepass.passNumber} was approved by Director and is ready for bouncer verification.`,
      metadata: buildGatepassNotificationMetadata(gatepass, {
        workflow: 'campus_security_review'
      })
    });

    notifications.push(...(await buildCampusSecurityReadyGatepassNotifications(gatepass, actor)));
  } else if (actor.role === 'campus_security') {
    const allowedBouncerStatuses = [
      'forwarded_to_campus_security',
      'approved_by_principal',
      'approved_by_hod',
      'approved_by_coordinator',
      'approved_by_chairman'
    ];
    if (gatepass.applicantType !== 'student' || !allowedBouncerStatuses.includes(gatepass.status)) {
      throw new AppError('Security | Bouncer can only verify/approve student gatepasses awaiting clearance.', 400);
    }

    const isEscalated = gatepass.status === 'forwarded_to_campus_security';
    gatepass.status = 'approved_final';
    gatepass.currentApprovalLevel = 'security';
    gatepass.isCancelled = false;
    gatepass.isCompleted = false;
    gatepass.campusSecurityAction = {
      status: 'approved',
      actionBy: actor._id,
      actedAt: new Date(),
      comment: payload.comment || ''
    };
    gatepass.forwardedTo = null;
    gatepass.forwardedToRole = 'security';
    await assignApprovedQr(gatepass);
    appendRoutingHistoryEntry(gatepass, {
      fromLevel: 'campus_security',
      toLevel: 'security',
      trigger: 'approval',
      note: 'Verified and ticked by Security | Bouncer. Ready for exit.',
      actedBy: actor._id,
      actedByRole: actor.role
    });
    auditMessage = `Gatepass ${gatepass.passNumber} verified and ticked by Security | Bouncer`;

    notifications.push({
      recipient: gatepass.createdBy._id,
      sender: actor._id,
      gatepass: gatepass._id,
      type: 'gatepass_approved',
      status: 'approved',
      title: 'Gatepass verified by Security | Bouncer',
      message: `Your gatepass ${gatepass.passNumber} was verified and ticked by Security | Bouncer. You may now scan your QR at the main gate.`,
      metadata: buildGatepassNotificationMetadata(gatepass, {
        verificationToken: gatepass.verificationToken,
        qrVerificationUrl: gatepass.qrVerificationUrl
      })
    });

    notifications.push(...(await buildSecurityReadyGatepassNotifications(gatepass, actor)));
  } else if (actor.role === 'cao') {
    if (gatepass.applicantType !== 'faculty' || gatepass.status !== 'pending_cao') {
      throw new AppError('CAO can only approve pending faculty gatepasses', 400);
    }

    gatepass.status = 'approved_by_cao';
    gatepass.currentApprovalLevel = 'security';
    gatepass.isCancelled = false;
    gatepass.isCompleted = false;
    gatepass.caoAction = {
      status: 'approved',
      actionBy: actor._id,
      actedAt: new Date(),
      comment: payload.comment || ''
    };
    gatepass.forwardedTo = null;
    gatepass.forwardedToRole = 'security';
    await assignApprovedQr(gatepass);
    auditMessage = `Gatepass ${gatepass.passNumber} approved by CAO`;

    notifications.push(
      {
        recipient: gatepass.createdBy._id,
        sender: actor._id,
        gatepass: gatepass._id,
        type: 'gatepass_approved',
        status: 'approved',
        title: 'Gatepass approved by CAO',
        message: `Your gatepass ${gatepass.passNumber} was approved by CAO and is ready for security verification.`,
        metadata: buildGatepassNotificationMetadata(gatepass, {
          verificationToken: gatepass.verificationToken,
          qrVerificationUrl: gatepass.qrVerificationUrl
        })
      }
    );

    notifications.push(...(await buildSecurityReadyGatepassNotifications(gatepass, actor)));
  } else if (actor.role === 'chairman') {
    if (gatepass.applicantType !== 'student' || gatepass.status !== 'forwarded_to_chairman') {
      throw new AppError('Chairman can only approve forwarded student gatepasses', 400);
    }

    gatepass.status = 'approved_by_chairman';
    gatepass.currentApprovalLevel = 'campus_security';
    gatepass.isCancelled = false;
    gatepass.isCompleted = false;
    gatepass.chairmanAction = {
      status: 'approved',
      actionBy: actor._id,
      actedAt: new Date(),
      comment: payload.comment || ''
    };
    gatepass.forwardedTo = null;
    gatepass.forwardedToRole = 'campus_security';
    await assignApprovedQr(gatepass);
    appendRoutingHistoryEntry(gatepass, {
      fromLevel: 'chairman',
      toLevel: 'campus_security',
      trigger: 'approval',
      note: payload.comment || 'Approved by Chairman and forwarded to Campus Security (Bouncer).',
      actedBy: actor._id,
      actedByRole: actor.role
    });
    auditMessage = `Gatepass ${gatepass.passNumber} approved by Chairman (sent to Campus Security)`;

    notifications.push({
      recipient: gatepass.createdBy._id,
      sender: actor._id,
      gatepass: gatepass._id,
      type: 'gatepass_approved',
      status: 'approved',
      title: 'Gatepass approved by Chairman',
      message: `Your gatepass ${gatepass.passNumber} was approved by Chairman and is ready for bouncer verification.`,
      metadata: buildGatepassNotificationMetadata(gatepass, {
        workflow: 'campus_security_review'
      })
    });

    notifications.push(...(await buildCampusSecurityReadyGatepassNotifications(gatepass, actor)));
  } else {
    throw new AppError('Your role is not allowed to approve gatepasses', 403);
  }

  await gatepass.save();
  await createBulkNotifications(notifications);

  await logAction({
    actorId: actor._id,
    resourceType: 'gatepass',
    resourceId: gatepass._id,
    action: 'approve_gatepass',
    message: auditMessage,
    metadata: {
      status: gatepass.status
    },
    requestMeta
  });

  // Push notification to student — fire-and-forget (See QR action opens their gatepass page)
  {
    const studentId = gatepass.createdBy?._id || gatepass.createdBy;
    const approverLabel = actor.role === 'faculty' && isCoordinatorActor(actor)
      ? 'Coordinator'
      : actor.role.charAt(0).toUpperCase() + actor.role.slice(1);
    sendGatepassPushNotification(studentId, {
      title: '✅ Gatepass Approved!',
      body: `Your gatepass ${gatepass.passNumber} was approved by ${approverLabel} and is ready.`,
      gatepassId: String(gatepass._id),
      passNumber: gatepass.passNumber,
      relatedRoute: '/app/my-gatepasses',
      tag: `gatepass-approved-${gatepass._id}`,
      actions: [
        { action: 'see_qr', title: '🔍 See QR' }
      ]
    }).catch((err) => console.error('[gatepass-push] approveGatepass push failed:', err.message || err));
  }

  return getGatepassByIdOrThrow(gatepass._id);
}

async function rejectGatepass(gatepassId, actor, payload, requestMeta) {
  const gatepass = await getAccessibleGatepass(gatepassId, actor);
  const notifications = [];
  let auditMessage = '';

  if (actor.role === 'principal') {
    if (!['student', 'faculty'].includes(gatepass.applicantType) || gatepass.status !== 'pending_principal') {
      throw new AppError('Principal can only reject pending student or faculty gatepasses', 400);
    }

    gatepass.status = 'rejected_by_principal';
    gatepass.principalAction = {
      status: 'rejected',
      actionBy: actor._id,
      actedAt: new Date(),
      comment: payload.rejectionReason
    };
    appendRoutingHistoryEntry(gatepass, {
      fromLevel: 'principal',
      toLevel: 'cancelled',
      trigger: 'rejection',
      note: payload.rejectionReason || 'Rejected by Principal.',
      actedBy: actor._id,
      actedByRole: actor.role
    });
    auditMessage = `Gatepass ${gatepass.passNumber} rejected by Principal`;
  } else if (actor.role === 'hod') {
    if (gatepass.applicantType !== 'student' || gatepass.status !== 'forwarded_to_hod') {
      throw new AppError('HOD can only reject forwarded student gatepasses', 400);
    }

    const principalUser = await findActiveUserByRole('principal');

    gatepass.status = 'rejected_by_hod';
    gatepass.hodAction = {
      status: 'rejected',
      actionBy: actor._id,
      actedAt: new Date(),
      comment: payload.rejectionReason
    };
    appendRoutingHistoryEntry(gatepass, {
      fromLevel: 'hod',
      toLevel: 'cancelled',
      trigger: 'rejection',
      note: payload.rejectionReason || 'Rejected by HOD.',
      actedBy: actor._id,
      actedByRole: actor.role
    });
    if (principalUser) {
      notifications.push({
        recipient: principalUser._id,
        sender: actor._id,
        gatepass: gatepass._id,
        type: 'hod_action',
        status: 'rejected',
        title: 'HOD completed gatepass review',
        message: `HOD rejected gatepass ${gatepass.passNumber}.`,
        metadata: buildGatepassNotificationMetadata(gatepass, {
          action: 'rejected',
          workflow: 'principal_visibility'
        })
      });
    }
    auditMessage = `Gatepass ${gatepass.passNumber} rejected by HOD`;
  } else if (actor.role === 'faculty' && isCoordinatorActor(actor)) {
    if (gatepass.applicantType !== 'student' || gatepass.status !== 'forwarded_to_coordinator') {
      throw new AppError('Coordinator can only reject forwarded student gatepasses', 400);
    }

    const [principalUser, hodUser] = await Promise.all([
      findActiveUserByRole('principal'),
      resolveStudentHodUser(gatepass).catch(() => null)
    ]);

    gatepass.status = 'rejected_by_coordinator';
    gatepass.coordinatorAction = {
      status: 'rejected',
      actionBy: actor._id,
      actedAt: new Date(),
      comment: payload.rejectionReason
    };
    appendRoutingHistoryEntry(gatepass, {
      fromLevel: 'coordinator',
      toLevel: 'cancelled',
      trigger: 'rejection',
      note: payload.rejectionReason || 'Rejected by Coordinator.',
      actedBy: actor._id,
      actedByRole: actor.role
    });

    if (principalUser) {
      notifications.push({
        recipient: principalUser._id,
        sender: actor._id,
        gatepass: gatepass._id,
        type: 'coordinator_action',
        status: 'rejected',
        title: 'Coordinator completed gatepass review',
        message: `Coordinator rejected gatepass ${gatepass.passNumber}.`,
        metadata: buildGatepassNotificationMetadata(gatepass, {
          action: 'rejected',
          workflow: 'principal_visibility'
        })
      });
    }

    if (hodUser) {
      notifications.push({
        recipient: hodUser._id,
        sender: actor._id,
        gatepass: gatepass._id,
        type: 'coordinator_action',
        status: 'rejected',
        title: 'Coordinator completed gatepass review',
        message: `Coordinator rejected gatepass ${gatepass.passNumber}.`,
        metadata: buildGatepassNotificationMetadata(gatepass, {
          action: 'rejected',
          workflow: 'hod_visibility'
        })
      });
    }

    auditMessage = `Gatepass ${gatepass.passNumber} rejected by Coordinator`;
  } else if (actor.role === 'cao') {
    if (gatepass.applicantType !== 'faculty' || gatepass.status !== 'pending_cao') {
      throw new AppError('CAO can only reject pending faculty gatepasses', 400);
    }

    gatepass.status = 'rejected_by_cao';
    gatepass.caoAction = {
      status: 'rejected',
      actionBy: actor._id,
      actedAt: new Date(),
      comment: payload.rejectionReason
    };
    auditMessage = `Gatepass ${gatepass.passNumber} rejected by CAO`;
  } else if (actor.role === 'campus_security') {
    const allowedBouncerStatuses = [
      'forwarded_to_campus_security',
      'approved_by_principal',
      'approved_by_hod',
      'approved_by_coordinator',
      'approved_by_chairman'
    ];
    if (gatepass.applicantType !== 'student' || !allowedBouncerStatuses.includes(gatepass.status)) {
      throw new AppError('Security | Bouncer can only reject student gatepasses awaiting clearance.', 400);
    }

    gatepass.status = 'rejected_by_campus_security';
    gatepass.campusSecurityAction = {
      status: 'rejected',
      actionBy: actor._id,
      actedAt: new Date(),
      comment: payload.rejectionReason
    };
    appendRoutingHistoryEntry(gatepass, {
      fromLevel: 'campus_security',
      toLevel: 'cancelled',
      trigger: 'rejection',
      note: payload.rejectionReason || 'Rejected by Security | Bouncer.',
      actedBy: actor._id,
      actedByRole: actor.role
    });
    auditMessage = `Gatepass ${gatepass.passNumber} rejected by Security | Bouncer`;
  } else if (actor.role === 'chairman') {
    if (gatepass.applicantType !== 'student' || gatepass.status !== 'forwarded_to_chairman') {
      throw new AppError('Director can only reject forwarded student gatepasses', 400);
    }

    gatepass.status = 'rejected_by_chairman';
    gatepass.chairmanAction = {
      status: 'rejected',
      actionBy: actor._id,
      actedAt: new Date(),
      comment: payload.rejectionReason
    };
    appendRoutingHistoryEntry(gatepass, {
      fromLevel: 'chairman',
      toLevel: 'cancelled',
      trigger: 'rejection',
      note: payload.rejectionReason || 'Rejected by Director.',
      actedBy: actor._id,
      actedByRole: actor.role
    });
    auditMessage = `Gatepass ${gatepass.passNumber} rejected by Director`;
  } else {
    throw new AppError('Your role is not allowed to reject gatepasses', 403);
  }

  gatepass.currentApprovalLevel = undefined;
  gatepass.rejectionReason = payload.rejectionReason;
  gatepass.isCancelled = false;
  gatepass.isCompleted = false;
  gatepass.forwardedTo = null;
  gatepass.forwardedToRole = null;
  if (gatepass.verificationToken || gatepass.qrCodeDataUrl) {
    revokeGatepassQr(gatepass);
  }
  await gatepass.save();
  const actorApprovalLabel = actor.role === 'faculty' && isCoordinatorActor(actor) ? 'COORDINATOR' : actor.role.toUpperCase();

  notifications.unshift({
    recipient: gatepass.createdBy._id,
    sender: actor._id,
    gatepass: gatepass._id,
    type: 'gatepass_rejected',
    status: 'rejected',
    title: 'Gatepass rejected',
    message: `Your gatepass ${gatepass.passNumber} was rejected by ${actorApprovalLabel}.`,
    metadata: buildGatepassNotificationMetadata(gatepass, {
      rejectionReason: payload.rejectionReason
    })
  });

  await createBulkNotifications(notifications);

  await logAction({
    actorId: actor._id,
    resourceType: 'gatepass',
    resourceId: gatepass._id,
    action: 'reject_gatepass',
    message: auditMessage,
    metadata: {
      status: gatepass.status,
      rejectionReason: payload.rejectionReason
    },
    requestMeta
  });

  // Push notification to student — fire-and-forget
  {
    const studentId = gatepass.createdBy?._id || gatepass.createdBy;
    const rejecterLabel = actor.role === 'faculty' && isCoordinatorActor(actor)
      ? 'Coordinator'
      : actor.role.charAt(0).toUpperCase() + actor.role.slice(1);
    sendGatepassPushNotification(studentId, {
      title: '❌ Gatepass Rejected',
      body: `Your gatepass ${gatepass.passNumber} was rejected by ${rejecterLabel}.${
        payload.rejectionReason ? ` Reason: ${payload.rejectionReason}` : ''
      }`,
      gatepassId: String(gatepass._id),
      passNumber: gatepass.passNumber,
      relatedRoute: '/app/my-gatepasses',
      tag: `gatepass-rejected-${gatepass._id}`,
      actions: []
    }).catch((err) => console.error('[gatepass-push] rejectGatepass push failed:', err.message || err));
  }

  return getGatepassByIdOrThrow(gatepass._id);
}

async function escalatePendingPrincipalGatepass(gatepass) {
  const routeResult = await routeStudentGatepassToHod(gatepass, {
    actor: null,
    comment: `Auto-forwarded after ${Math.max(1, Number(env.gatepassEscalationTimeoutMinutes || 2))} minutes without Principal action.`,
    trigger: 'auto_timeout_forward'
  });

  await gatepass.save();
  await createBulkNotifications(
    buildForwardNotificationsForStudentGatepass(gatepass, null, routeResult, 'auto_timeout_forward')
  );

  await logAction({
    actorId: null,
    resourceType: 'gatepass',
    resourceId: gatepass._id,
    action: routeResult.routedTo === 'coordinator' ? 'auto_forward_to_coordinator' : 'auto_forward_to_hod',
    message:
      routeResult.routedTo === 'coordinator'
        ? `Gatepass ${gatepass.passNumber} auto-forwarded to Coordinator`
        : `Gatepass ${gatepass.passNumber} auto-forwarded to HOD`,
    metadata: {
      forwardedTo: routeResult.recipient._id.toString(),
      forwardedToRole: routeResult.routedTo,
      reason: 'principal_timeout'
    },
    requestMeta: {}
  });

  return routeResult;
}

async function escalatePendingHodGatepass(gatepass, reason = 'hod_timeout') {
  const notificationTrigger = reason === 'hod_unavailable' ? 'auto_unavailable_forward' : 'auto_timeout_forward';
  const routeResult = await routeStudentGatepassToCoordinator(gatepass, {
    actor: null,
    comment:
      reason === 'hod_unavailable'
        ? 'Auto-forwarded because HOD is unavailable.'
        : `Auto-forwarded after ${Math.max(1, Number(env.gatepassEscalationTimeoutMinutes || 2))} minutes without HOD action.`,
    trigger: notificationTrigger,
    fromLevel: 'hod'
  });

  await gatepass.save();
  await createBulkNotifications(
    buildForwardNotificationsForStudentGatepass(gatepass, null, routeResult, notificationTrigger)
  );

  await logAction({
    actorId: null,
    resourceType: 'gatepass',
    resourceId: gatepass._id,
    action: 'auto_forward_to_coordinator',
    message: `Gatepass ${gatepass.passNumber} auto-forwarded to Coordinator`,
    metadata: {
      forwardedTo: routeResult.recipient._id.toString(),
      forwardedToRole: routeResult.routedTo,
      reason
    },
    requestMeta: {}
  });

  return routeResult;
}

async function escalatePendingCoordinatorGatepass(gatepass) {
  const routeResult = await routeStudentGatepassToCampusSecurity(gatepass, {
    actor: null,
    comment: `Auto-forwarded after ${Math.max(1, Number(env.gatepassEscalationTimeoutMinutes || 2))} minutes without Coordinator action.`,
    trigger: 'auto_timeout_forward'
  });

  await gatepass.save();
  
  await createBulkNotifications([
    {
      recipient: gatepass.createdBy._id,
      sender: null,
      gatepass: gatepass._id,
      type: 'gatepass_escalated',
      status: 'forwarded',
      title: 'Gatepass auto-routed to Bouncer',
      message: `Your gatepass ${gatepass.passNumber} was auto-forwarded to Campus Security (Bouncer) because Coordinator did not take action.`,
      metadata: buildGatepassNotificationMetadata(gatepass, {
        workflow: 'campus_security_review',
        escalated: true
      })
    }
  ]);

  await logAction({
    actorId: null,
    resourceType: 'gatepass',
    resourceId: gatepass._id,
    action: 'auto_forward_to_campus_security',
    message: `Gatepass ${gatepass.passNumber} auto-forwarded to Campus Security (Bouncer)`,
    metadata: {
      forwardedToRole: 'campus_security',
      reason: 'coordinator_timeout'
    },
    requestMeta: {}
  });

  return routeResult;
}

async function escalatePendingCampusSecurityGatepass(gatepass) {
  const routeResult = await routeStudentGatepassToChairman(gatepass, {
    actor: null,
    comment: `Auto-forwarded after ${Math.max(1, Number(env.gatepassEscalationTimeoutMinutes || 2))} minutes without Campus Security action.`,
    trigger: 'auto_timeout_forward'
  });

  await gatepass.save();
  
  await createBulkNotifications([
    {
      recipient: routeResult.recipient._id,
      sender: null,
      gatepass: gatepass._id,
      type: 'gatepass_escalated',
      status: 'forwarded',
      title: 'Gatepass escalated to you',
      message: `Student gatepass ${gatepass.passNumber} was escalated to your queue because Campus Security did not take action.`,
      metadata: buildGatepassNotificationMetadata(gatepass, {
        workflow: 'chairman_review',
        escalated: true
      })
    },
    {
      recipient: gatepass.createdBy._id,
      sender: null,
      gatepass: gatepass._id,
      type: 'gatepass_escalated',
      status: 'forwarded',
      title: 'Gatepass escalated to Chairman',
      message: `Your gatepass ${gatepass.passNumber} was escalated to the Chairman because Campus Security did not take action.`,
      metadata: buildGatepassNotificationMetadata(gatepass, {
        workflow: 'chairman_review',
        escalated: true
      })
    }
  ]);

  await logAction({
    actorId: null,
    resourceType: 'gatepass',
    resourceId: gatepass._id,
    action: 'auto_forward_to_chairman',
    message: `Gatepass ${gatepass.passNumber} auto-forwarded to Chairman`,
    metadata: {
      forwardedTo: routeResult.recipient._id.toString(),
      forwardedToRole: 'chairman',
      reason: 'campus_security_timeout'
    },
    requestMeta: {}
  });

  return routeResult;
}

async function processPendingStudentEscalations({ maxPerSweep = 50 } = {}) {
  if (escalationSweepRunning) {
    return {
      processed: 0,
      forwardedToHod: 0,
      forwardedToCoordinator: 0,
      blocked: 0
    };
  }

  escalationSweepRunning = true;

  const stats = {
    processed: 0,
    forwardedToHod: 0,
    forwardedToCoordinator: 0,
    blocked: 0
  };

  try {
    const nowMs = Date.now();
    const principalCutoff = new Date(nowMs - PRINCIPAL_TIMEOUT_MS);
    const hodCutoff = new Date(nowMs - HOD_TIMEOUT_MS);
    const coordinatorCutoff = new Date(nowMs - COORDINATOR_TIMEOUT_MS);
    const campusSecurityCutoff = new Date(nowMs - BOUNCER_TIMEOUT_MS);
    const safeLimit = Math.max(1, Number(maxPerSweep) || 50);

    const [principalPending, hodPending, coordinatorPending, campusSecurityPending] = await Promise.all([
      Gatepass.find({
        applicantType: 'student',
        status: 'pending_principal',
        updatedAt: { $lte: principalCutoff },
        'autoEscalation.state': { $ne: 'blocked' }
      })
        .sort({ updatedAt: 1, _id: 1 })
        .limit(safeLimit)
        .populate('createdBy', '_id fullName program department semester'),
      Gatepass.find({
        applicantType: 'student',
        status: 'forwarded_to_hod',
        'autoEscalation.state': { $ne: 'blocked' }
      })
        .sort({ updatedAt: 1, _id: 1 })
        .limit(safeLimit)
        .populate('createdBy', '_id fullName program department semester')
        .populate('forwardedTo', '_id isActive gatepassApprovalEnabled'),
      Gatepass.find({
        applicantType: 'student',
        status: 'forwarded_to_coordinator',
        'autoEscalation.state': { $ne: 'blocked' }
      })
        .sort({ updatedAt: 1, _id: 1 })
        .limit(safeLimit)
        .populate('createdBy', '_id fullName program department semester')
        .populate('forwardedTo', '_id isActive gatepassApprovalEnabled'),
      Gatepass.find({
        applicantType: 'student',
        status: 'forwarded_to_campus_security',
        'autoEscalation.state': { $ne: 'blocked' }
      })
        .sort({ updatedAt: 1, _id: 1 })
        .limit(safeLimit)
        .populate('createdBy', '_id fullName program department semester')
    ]);

    for (const gatepass of principalPending) {
      try {
        syncStudentGatepassRoutingSnapshot(gatepass, gatepass.createdBy);
        const routeResult = await escalatePendingPrincipalGatepass(gatepass);
        stats.processed += 1;
        if (routeResult.routedTo === 'hod') {
          stats.forwardedToHod += 1;
        } else {
          stats.forwardedToCoordinator += 1;
        }
      } catch (error) {
        if (shouldBlockAutoEscalationError(error)) {
          await markAutoEscalationBlocked(gatepass, getAutoEscalationStage(gatepass), error);
          stats.blocked += 1;
          continue;
        }

        console.error('[gatepass-escalation] Failed to auto-forward Principal pending gatepass', {
          gatepassId: gatepass?._id?.toString?.() || null,
          passNumber: gatepass?.passNumber || null,
          error: error?.stack || error?.message || error
        });
      }
    }

    for (const gatepass of hodPending) {
      if (stats.processed >= safeLimit) {
        break;
      }

      const isTimedOut = gatepass.updatedAt instanceof Date && gatepass.updatedAt.getTime() <= hodCutoff.getTime();
      const isHodUnavailable = !isGatepassApproverAvailable(gatepass.forwardedTo);

      if (!isTimedOut && !isHodUnavailable) {
        continue;
      }

      try {
        syncStudentGatepassRoutingSnapshot(gatepass, gatepass.createdBy);
        await escalatePendingHodGatepass(gatepass, isHodUnavailable ? 'hod_unavailable' : 'hod_timeout');
        stats.processed += 1;
        stats.forwardedToCoordinator += 1;
      } catch (error) {
        if (shouldBlockAutoEscalationError(error)) {
          await markAutoEscalationBlocked(gatepass, getAutoEscalationStage(gatepass), error);
          stats.blocked += 1;
          continue;
        }

        console.error('[gatepass-escalation] Failed to auto-forward HOD pending gatepass', {
          gatepassId: gatepass?._id?.toString?.() || null,
          passNumber: gatepass?.passNumber || null,
          reason: isHodUnavailable ? 'hod_unavailable' : 'hod_timeout',
          error: error?.stack || error?.message || error
        });
      }
    }

    for (const gatepass of coordinatorPending) {
      if (stats.processed >= safeLimit) {
        break;
      }

      const isTimedOut = gatepass.updatedAt instanceof Date && gatepass.updatedAt.getTime() <= coordinatorCutoff.getTime();
      const isCoordinatorUnavailable = !isGatepassApproverAvailable(gatepass.forwardedTo);

      if (!isTimedOut && !isCoordinatorUnavailable) {
        continue;
      }

      try {
        syncStudentGatepassRoutingSnapshot(gatepass, gatepass.createdBy);
        await escalatePendingCoordinatorGatepass(gatepass);
        stats.processed += 1;
      } catch (error) {
        if (shouldBlockAutoEscalationError(error)) {
          await markAutoEscalationBlocked(gatepass, getAutoEscalationStage(gatepass), error);
          stats.blocked += 1;
          continue;
        }

        console.error('[gatepass-escalation] Failed to auto-forward Coordinator pending gatepass', {
          gatepassId: gatepass?._id?.toString?.() || null,
          passNumber: gatepass?.passNumber || null,
          error: error?.stack || error?.message || error
        });
      }
    }

    for (const gatepass of campusSecurityPending) {
      if (stats.processed >= safeLimit) {
        break;
      }

      const isTimedOut = gatepass.updatedAt instanceof Date && gatepass.updatedAt.getTime() <= campusSecurityCutoff.getTime();

      if (!isTimedOut) {
        continue;
      }

      try {
        syncStudentGatepassRoutingSnapshot(gatepass, gatepass.createdBy);
        await escalatePendingCampusSecurityGatepass(gatepass);
        stats.processed += 1;
      } catch (error) {
        if (shouldBlockAutoEscalationError(error)) {
          await markAutoEscalationBlocked(gatepass, getAutoEscalationStage(gatepass), error);
          stats.blocked += 1;
          continue;
        }

        console.error('[gatepass-escalation] Failed to auto-forward Campus Security pending gatepass', {
          gatepassId: gatepass?._id?.toString?.() || null,
          passNumber: gatepass?.passNumber || null,
          error: error?.stack || error?.message || error
        });
      }
    }

    // --- Overdue-return sweep: push student + security for expired checked-out gatepasses ----
    // Find gatepasses that are checked_out and past their expected return time,
    // where we haven't already sent an overdue nudge.
    const now = new Date();
    const overdueGatepasses = await Gatepass.find({
      status: 'checked_out_by_security',
      isCompleted: false,
      isCancelled: false,
      returnTime: { $lte: now },
      expiryNudgeSentAt: { $exists: false }   // only nudge once per gatepass
    })
      .select('_id passNumber createdBy returnTime applicantSnapshot')
      .limit(safeLimit)
      .lean();

    for (const gatepass of overdueGatepasses) {
      try {
        // Mark nudge sent before firing push so a slow push never triggers a double-send
        await Gatepass.updateOne({ _id: gatepass._id }, { $set: { expiryNudgeSentAt: new Date() } });

        const studentId = gatepass.createdBy?._id || gatepass.createdBy;

        // Notify the student
        sendGatepassPushNotification(studentId, {
          title: '⚠️ Gatepass Overdue — Please Return',
          body: `Your gatepass ${gatepass.passNumber} has passed its expected return time. Please return to campus and check in at the gate.`,
          gatepassId: String(gatepass._id),
          passNumber: gatepass.passNumber,
          relatedRoute: '/app/my-gatepasses',
          tag: `gatepass-overdue-${gatepass._id}`,
          requireInteraction: true,
          actions: []
        }).catch((err) => console.error('[gatepass-expiry] Student push failed:', err.message || err));

        // Notify security + admin
        sendPushToRoles(['campus_security', 'security', 'admin'], {
          title: '⚠️ Overdue Return',
          body: `${gatepass.applicantSnapshot?.fullName || 'A student'} (${gatepass.passNumber}) has not returned within the expected time.`,
          gatepassId: String(gatepass._id),
          passNumber: gatepass.passNumber,
          relatedRoute: '/app/pending-gatepasses',
          tag: `gatepass-overdue-security-${gatepass._id}`,
          requireInteraction: true,
          actions: []
        }).catch((err) => console.error('[gatepass-expiry] Security push failed:', err.message || err));
      } catch (err) {
        console.error('[gatepass-expiry] Overdue nudge failed for', gatepass.passNumber, err.message || err);
      }
    }

    return stats;
  } finally {
    escalationSweepRunning = false;
  }
}

function kickOffPendingStudentEscalations(options = {}) {
  processPendingStudentEscalations(options).catch((error) => {
    console.error('[gatepass-escalation] Deferred sweep failed', error);
  });
}

function startGatepassEscalationScheduler() {
  if (escalationSweepInterval) {
    return;
  }

  escalationSweepInterval = setInterval(() => {
    processPendingStudentEscalations().catch((error) => {
      console.error('[gatepass-escalation] Scheduler run failed', error);
    });
  }, AUTO_ESCALATION_SWEEP_INTERVAL_MS);

  if (typeof escalationSweepInterval.unref === 'function') {
    escalationSweepInterval.unref();
  }

  console.info(
    `[gatepass-escalation] Scheduler started (interval=${AUTO_ESCALATION_SWEEP_INTERVAL_MS}ms, timeout=${AUTO_ESCALATION_TIMEOUT_MS}ms)`
  );
}

function stopGatepassEscalationScheduler() {
  if (!escalationSweepInterval) {
    return;
  }

  clearInterval(escalationSweepInterval);
  escalationSweepInterval = null;
}

async function repairStudentGatepassRoutingRecords({ limit = 500 } = {}) {
  const repairableStatuses = ['pending_principal', 'forwarded_to_hod', 'forwarded_to_coordinator'];
  const safeLimit = Math.max(1, Number(limit) || 500);
  const gatepasses = await Gatepass.find({
    applicantType: 'student',
    status: { $in: repairableStatuses }
  })
    .sort({ updatedAt: -1, _id: 1 })
    .limit(safeLimit)
    .populate('createdBy', '_id fullName program department semester enrollmentNo phone email');

  const result = {
    scanned: gatepasses.length,
    snapshotsBackfilled: 0,
    blocked: 0,
    unchanged: 0
  };

  for (const gatepass of gatepasses) {
    const previousBlockCode = gatepass.autoEscalation?.code || null;
    const { changed, snapshot } = syncStudentGatepassRoutingSnapshot(gatepass, gatepass.createdBy);
    const stage = getAutoEscalationStage(gatepass);
    const needsSemesterForRouting = stage === 'hod';
    const missingField = !snapshot?.program
      ? 'program'
      : !snapshot?.department
        ? 'department'
        : needsSemesterForRouting && !snapshot?.semester
          ? 'semester'
          : null;

    if (stage !== 'coordinator' && missingField) {
      const message =
        missingField === 'semester'
          ? 'Student semester is missing on this gatepass and coordinator routing cannot continue.'
          : missingField === 'department'
            ? 'Student department is missing on this gatepass and routing cannot continue.'
            : 'Student program is missing on this gatepass and routing cannot continue.';

      await markAutoEscalationBlocked(
        gatepass,
        stage,
        new AppError(message, 422, [
          {
            field: missingField,
            message: `Student ${missingField} is required for routing.`
          }
        ])
      );

      if (changed) {
        result.snapshotsBackfilled += 1;
      }

      if (gatepass.autoEscalation?.code !== previousBlockCode) {
        result.blocked += 1;
      } else {
        result.unchanged += 1;
      }

      continue;
    }

    if (gatepass.autoEscalation?.state === 'blocked') {
      resetAutoEscalationState(gatepass);
    }

    if (changed || gatepass.isModified('autoEscalation')) {
      await gatepass.save();
      result.snapshotsBackfilled += 1;
    } else {
      result.unchanged += 1;
    }
  }

  return result;
}

async function verifyGatepassByToken(token, actor) {
  if (actor.role !== 'security') {
    throw new AppError('Only security can verify gatepass tokens', 403);
  }

  const normalizedToken = normalizeGatepassIdentifier(token);
  const gatepass = await applyPopulate(Gatepass.findOne({ verificationToken: normalizedToken }), detailPopulate);

  if (gatepass && APPROVED_GATEPASS_STATUSES.includes(gatepass.status)) {
    await ensureApprovedGatepassQr(gatepass);
  }

  return buildSecurityVerificationResult(gatepass, {
    notFoundMessage: 'QR code is invalid or expired.',
    invalidQrMessage: 'QR code is invalid or expired.',
    readyToMarkInMessage: 'Gatepass is already marked OUT and is ready to be marked IN.'
  });
}

async function verifyGatepassById(gatepassIdentifier, actor) {
  if (actor.role !== 'security') {
    throw new AppError('Only security can verify gatepass identifiers', 403);
  }

  const normalizedIdentifier = resolveGatepassIdentifier({ gatepassId: normalizeGatepassIdentifier(gatepassIdentifier) });
  const gatepass = normalizedIdentifier
    ? await applyPopulate(
        Gatepass.findOne({
          $or: [{ gatepassId: normalizedIdentifier }, { passNumber: normalizedIdentifier }]
        }),
        detailPopulate
      )
    : null;

  if (gatepass && APPROVED_GATEPASS_STATUSES.includes(gatepass.status)) {
    await ensureApprovedGatepassQr(gatepass);
  }

  return buildSecurityVerificationResult(gatepass);
}

async function checkOutGatepass(gatepassId, actor, payload, requestMeta) {
  const gatepass = await getAccessibleGatepass(gatepassId, actor);

  if (actor.role !== 'security') {
    throw new AppError('Only security can check out approved gatepasses', 403);
  }

  if (!APPROVED_GATEPASS_STATUSES.includes(gatepass.status)) {
    throw new AppError('Only approved gatepasses can be checked out', 400);
  }

  if (!gatepass.verificationToken || gatepass.qrRevokedAt || isGatepassQrExpired(gatepass)) {
    throw new AppError('QR code is invalid or expired.', 400);
  }

  if (payload.verificationToken && gatepass.verificationToken !== payload.verificationToken) {
    throw new AppError('Verification token does not match this gatepass', 400);
  }

  if (!gatepass.returnTime) {
    gatepass.returnTime = resolveGatepassReturnTime(gatepass);
  }

  gatepass.status = 'checked_out_by_security';
  gatepass.currentApprovalLevel = 'security';
  gatepass.isCancelled = false;
  gatepass.isCompleted = false;
  gatepass.forwardedTo = null;
  gatepass.forwardedToRole = 'security';
  gatepass.securityAction = {
    ...(gatepass.securityAction ? gatepass.securityAction.toObject() : {}),
    verifiedBy: actor._id,
    verifiedAt: new Date(),
    checkedOutBy: actor._id,
    checkedOutAt: new Date(),
    checkOutNote: payload.note || ''
  };
  await gatepass.save();

  await createBulkNotifications([
    {
      recipient: gatepass.createdBy._id,
      sender: actor._id,
      gatepass: gatepass._id,
      type: 'gatepass_out',
      status: 'out',
      title: 'Gatepass checked out by security',
      message: `Gatepass ${gatepass.passNumber} has been verified and marked out by security.`,
      metadata: buildGatepassNotificationMetadata(gatepass, {
        workflow: 'security_checkout'
      })
    }
  ]);

  await logAction({
    actorId: actor._id,
    resourceType: 'gatepass',
    resourceId: gatepass._id,
    action: 'security_checkout',
    message: `Gatepass ${gatepass.passNumber} checked out by security`,
    requestMeta
  });

  // Push to security desk + admin — they need to know the student is now off-campus.
  // Fire-and-forget; never blocks the API response.
  sendPushToRoles(['campus_security', 'admin'], {
    title: '🚪 Student Checked Out',
    body: `${gatepass.applicantSnapshot?.fullName || 'Student'} checked out on ${gatepass.passNumber}. Student is now off-campus.`,
    gatepassId: String(gatepass._id),
    passNumber: gatepass.passNumber,
    relatedRoute: '/app/pending-gatepasses',
    tag: `gatepass-checkout-${gatepass._id}`,
    actions: []
  }).catch((err) => console.error('[gatepass-push] checkOutGatepass role push failed:', err.message || err));

  return getGatepassByIdOrThrow(gatepass._id);
}

async function checkInGatepass(gatepassId, actor, payload, requestMeta) {
  const gatepass = await getAccessibleGatepass(gatepassId, actor);

  if (actor.role !== 'security') {
    throw new AppError('Only security can check in gatepasses', 403);
  }

  if (gatepass.status !== 'checked_out_by_security') {
    throw new AppError('Only checked-out gatepasses can be marked as completed', 400);
  }

  if (!canGatepassBeMarkedIn(gatepass)) {
    throw new AppError('This gatepass does not require return marking.', 400);
  }

  gatepass.status = 'completed';
  gatepass.currentApprovalLevel = 'completed';
  gatepass.isCancelled = false;
  gatepass.isCompleted = true;
  gatepass.forwardedTo = null;
  gatepass.forwardedToRole = null;
  gatepass.securityAction = {
    ...(gatepass.securityAction ? gatepass.securityAction.toObject() : {}),
    checkedInBy: actor._id,
    checkedInAt: new Date(),
    checkInNote: payload.note || ''
  };
  await gatepass.save();

  await createBulkNotifications([
    {
      recipient: gatepass.createdBy._id,
      sender: actor._id,
      gatepass: gatepass._id,
      type: 'gatepass_returned',
      status: 'returned',
      title: 'Gatepass marked as returned',
      message: `Gatepass ${gatepass.passNumber} has been marked as returned by security.`,
      metadata: buildGatepassNotificationMetadata(gatepass, {
        workflow: 'security_checkin'
      })
    }
  ]);

  await logAction({
    actorId: actor._id,
    resourceType: 'gatepass',
    resourceId: gatepass._id,
    action: 'security_checkin',
    message: `Gatepass ${gatepass.passNumber} marked as completed by security`,
    requestMeta
  });

  // Push to security desk + admin — student has returned, trip is complete.
  // Fire-and-forget; never blocks the API response.
  sendPushToRoles(['campus_security', 'admin'], {
    title: '✅ Student Returned',
    body: `${gatepass.applicantSnapshot?.fullName || 'Student'} returned on ${gatepass.passNumber}. Gatepass completed.`,
    gatepassId: String(gatepass._id),
    passNumber: gatepass.passNumber,
    relatedRoute: '/app/pending-gatepasses',
    tag: `gatepass-checkin-${gatepass._id}`,
    actions: []
  }).catch((err) => console.error('[gatepass-push] checkInGatepass role push failed:', err.message || err));

  // Push to the student — confirmation their trip is logged.
  {
    const studentId = gatepass.createdBy?._id || gatepass.createdBy;
    sendGatepassPushNotification(studentId, {
      title: '🏠 Welcome Back!',
      body: `Your gatepass ${gatepass.passNumber} has been marked as completed. Safe return confirmed.`,
      gatepassId: String(gatepass._id),
      passNumber: gatepass.passNumber,
      relatedRoute: '/app/my-gatepasses',
      tag: `gatepass-completed-${gatepass._id}`,
      actions: []
    }).catch((err) => console.error('[gatepass-push] checkInGatepass student push failed:', err.message || err));
  }

  return getGatepassByIdOrThrow(gatepass._id);
}

async function getGatepassHistory(actor, query = {}) {
  if (['principal', 'hod', 'chairman', 'campus_security'].includes(actor.role) || isCoordinatorActor(actor)) {
    kickOffPendingStudentEscalations({ maxPerSweep: 20 });
  }

  return listGatepasses(buildHistoryFilter(actor, query), query);
}

async function getSecurityReadyGatepasses(actor, query = {}) {
  if (actor.role !== 'security' && actor.role !== 'campus_security') {
    throw new AppError('Only security can access the security queue', 403);
  }

  return getPendingGatepassesForRole(actor, query);
}

async function campusClearGatepass(gatepassId, actor, payload, requestMeta) {
  const gatepass = await getAccessibleGatepass(gatepassId, actor);

  if (actor.role !== 'security' && actor.role !== 'campus_security') {
    throw new AppError('Only security can give campus clearance to approved gatepasses', 403);
  }

  if (!APPROVED_GATEPASS_STATUSES.includes(gatepass.status)) {
    throw new AppError('Only approved gatepasses can receive campus clearance', 400);
  }

  gatepass.securityAction = {
    ...(gatepass.securityAction ? (typeof gatepass.securityAction.toObject === 'function' ? gatepass.securityAction.toObject() : gatepass.securityAction) : {}),
    campusCleared: true,
    campusClearedAt: new Date(),
    campusClearedBy: actor._id,
  };
  await gatepass.save();

  // Push to the student — they're cleared to leave.
  // Fire-and-forget; never blocks the API response.
  {
    const studentId = gatepass.createdBy?._id || gatepass.createdBy;
    sendGatepassPushNotification(studentId, {
      title: '✅ Campus Clearance Granted',
      body: `Your gatepass ${gatepass.passNumber} has been cleared by campus security. You may proceed.`,
      gatepassId: String(gatepass._id),
      passNumber: gatepass.passNumber,
      relatedRoute: '/app/my-gatepasses',
      tag: `gatepass-campus-cleared-${gatepass._id}`,
      actions: [{ action: 'see_qr', title: '🔍 See QR' }]
    }).catch((err) => console.error('[gatepass-push] campusClearGatepass student push failed:', err.message || err));
  }

  // Push to security desk + admin — awareness of clearance.
  sendPushToRoles(['admin'], {
    title: '🔓 Campus Clearance Issued',
    body: `${gatepass.applicantSnapshot?.fullName || 'Student'} (${gatepass.passNumber}) was cleared by campus security.`,
    gatepassId: String(gatepass._id),
    passNumber: gatepass.passNumber,
    relatedRoute: '/app/pending-gatepasses',
    tag: `gatepass-campus-cleared-admin-${gatepass._id}`,
    actions: []
  }).catch((err) => console.error('[gatepass-push] campusClearGatepass admin push failed:', err.message || err));

  return formatGatepassForUser(gatepass, actor);
}

module.exports = {
  approveGatepass,
  canGatepassBeMarkedIn,
  cancelGatepass,
  campusClearGatepass,
  checkInGatepass,
  checkOutGatepass,
  createGatepass,
  ensureApprovedGatepassQr,
  forwardGatepass,
  forwardGatepassToCoordinator,
  getGatepassDetails,
  getGatepassHistory,
  getMyGatepasses,
  getPendingGatepassesForRole,
  getSecurityReadyGatepasses,
  mapGatepassListItem,
  processPendingStudentEscalations,
  repairStudentGatepassRoutingRecords,
  rejectGatepass,
  resolveGatepassReturnTime,
  startGatepassEscalationScheduler,
  stopGatepassEscalationScheduler,
  updateGatepass,
  verifyGatepassById,
  verifyGatepassByToken
};
