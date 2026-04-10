const Gatepass = require('../models/Gatepass');
const User = require('../models/User');
const AppError = require('../utils/appError');
const { buildPaginationMeta, getPagination, getSortOptions } = require('../utils/pagination');
const {
  APPROVED_GATEPASS_STATUSES,
  ROUTING_DEPARTMENTS,
  SECURITY_VISIBLE_STATUSES,
  STUDENT_PROGRAMS,
  normalizeDepartment,
  normalizeProgram
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
  'caoAction.status',
  'caoAction.actedAt',
  'securityAction.verifiedAt',
  'securityAction.checkedOutAt',
  'securityAction.checkedInAt',
  'createdAt',
  'updatedAt'
].join(' ');

const SECURITY_BLOCKED_PENDING_STATUSES = new Set(['pending_principal', 'forwarded_to_hod', 'pending_cao']);
const SECURITY_BLOCKED_REJECTED_STATUSES = new Set(['rejected_by_principal', 'rejected_by_hod', 'rejected_by_cao']);

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
    if (gatepass.hodAction?.status === 'approved') {
      return gatepass.hodAction?.actionBy?.fullName || 'HOD';
    }

    if (gatepass.principalAction?.status === 'approved' || gatepass.principalAction?.status === 'forwarded') {
      return gatepass.principalAction?.actionBy?.fullName || 'Principal';
    }
  }

  if (gatepass.applicantType === 'faculty' && gatepass.caoAction?.status === 'approved') {
    return gatepass.caoAction?.actionBy?.fullName || 'CAO';
  }

  return 'Awaiting approval';
}

function mapGatepassListItem(gatepass) {
  const applicant = gatepass.applicantSnapshot || {};

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
      phone: applicant.phone || gatepass.createdBy?.phone || null
    },
    submittedBy: mapUserSummary(gatepass.createdBy, applicant),
    reason: gatepass.reason,
    destination: gatepass.destination || '',
    outDate: gatepass.outDate,
    outTime: gatepass.outTime,
    expectedReturnDate: gatepass.expectedReturnDate || null,
    expectedReturnTime: gatepass.expectedReturnTime || '',
    vehicleNumber: gatepass.vehicleNumber || '',
    status: gatepass.status,
    currentApprovalLevel: gatepass.currentApprovalLevel || null,
    forwardedTo: mapUserSummary(gatepass.forwardedTo),
    forwardedToRole: gatepass.forwardedToRole || null,
    approvedBy: resolveGatepassApprovedBy(gatepass),
    approvedAt:
      gatepass.hodAction?.actedAt || gatepass.principalAction?.actedAt || gatepass.caoAction?.actedAt || null,
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
    phone: user.phone
  };
}

function getStudentRoutingSnapshot(source = {}) {
  return {
    program: normalizeProgram(source.program),
    department: normalizeDepartment(source.department)
  };
}

function getStudentRoutingLabel(program, department) {
  return [program, department, 'HOD'].filter(Boolean).join(' ');
}

async function resolveStudentHodUser(gatepass, requestedUserId = null) {
  const { program, department } = getStudentRoutingSnapshot(gatepass?.applicantSnapshot || {});

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
    .select('_id fullName email role program department employeeId phone createdAt')
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
      caoAction: { status: 'not_required' }
    };
  }

  return {
    status: 'pending_cao',
    currentApprovalLevel: 'cao',
    principalAction: { status: 'not_required' },
    hodAction: { status: 'not_required' },
    caoAction: { status: 'pending' }
  };
}

async function getActiveUserByRole(role, requestedUserId = null) {
  const filter = {
    role,
    isActive: true
  };

  if (requestedUserId) {
    filter._id = requestedUserId;
  }

  const user = await User.findOne(filter);

  if (!user) {
    throw new AppError(`No active ${role.toUpperCase()} account is available`, 404);
  }

  return user;
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

function applyStatusFilter(filter, queryStatus, allowedStatuses = null) {
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

  const safeStatuses = allowedStatuses
    ? requestedStatuses.filter((status) => allowedStatuses.includes(status))
    : requestedStatuses;

  if (safeStatuses.length === 0) {
    filter.status = { $in: [] };
    return;
  }

  filter.status = safeStatuses.length === 1 ? safeStatuses[0] : { $in: safeStatuses };
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

function buildAccessFilter(actor) {
  switch (actor.role) {
    case 'student':
    case 'faculty':
      return { createdBy: actor._id };
    case 'principal':
      return { applicantType: 'student' };
    case 'hod':
      return {
        applicantType: 'student',
        $or: [{ forwardedTo: actor._id }, { 'hodAction.actionBy': actor._id }]
      };
    case 'cao':
      return { applicantType: 'faculty' };
    case 'security':
      return { status: { $in: SECURITY_VISIBLE_STATUSES } };
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
    return gatepass.status === 'pending_cao';
  }

  return false;
}

function canUserAccessGatepass(actor, gatepass) {
  const creatorId = toId(gatepass.createdBy);
  const actorId = actor._id.toString();

  if (actor.role === 'student' || actor.role === 'faculty') {
    return creatorId === actorId;
  }

  if (actor.role === 'principal') {
    return gatepass.applicantType === 'student';
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

  return false;
}

async function getGatepassByIdOrThrow(gatepassId) {
  const gatepass = await applyPopulate(Gatepass.findById(gatepassId), detailPopulate);

  if (!gatepass) {
    throw new AppError('Gatepass not found', 404);
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
  const reviewerRole = actor.role === 'student' ? 'principal' : 'cao';
  const reviewer = await getActiveUserByRole(reviewerRole);
  const applicantSnapshot = createApplicantSnapshot(actor);

  if (actor.role === 'student') {
    const { program, department } = getStudentRoutingSnapshot(applicantSnapshot);

    if (!program || !department) {
      throw new AppError('Student profile is missing program or department required for routing.', 422, [
        {
          field: !program ? 'program' : 'department',
          message: 'Student program and department are required before creating a gatepass.'
        }
      ]);
    }
  }

  const gatepass = await Gatepass.create({
    createdBy: actor._id,
    applicantType: actor.role,
    applicantSnapshot,
    reason: payload.reason,
    destination: payload.destination || '',
    outDate: payload.outDate,
    outTime: payload.outTime,
    expectedReturnDate: payload.expectedReturnDate || null,
    expectedReturnTime: payload.expectedReturnTime || '',
    vehicleNumber: normalizeVehicleNumber(payload.vehicleNumber),
    status: initialState.status,
    currentApprovalLevel: initialState.currentApprovalLevel,
    isCancelled: false,
    isCompleted: false,
    forwardedTo: reviewer._id,
    forwardedToRole: reviewerRole,
    principalAction: initialState.principalAction,
    hodAction: initialState.hodAction,
    caoAction: initialState.caoAction
  });

  await createBulkNotifications([
    {
      recipient: reviewer._id,
      sender: actor._id,
      gatepass: gatepass._id,
      type: 'gatepass_submitted',
      status: 'submitted',
      title: 'New gatepass request submitted',
      message: `${actor.fullName} submitted gatepass ${gatepass.passNumber} for review.`,
      metadata: buildGatepassNotificationMetadata(gatepass, {
        workflow: reviewerRole === 'principal' ? 'principal_review' : 'cao_review'
      })
    },
    {
      recipient: actor._id,
      sender: actor._id,
      gatepass: gatepass._id,
      type: 'gatepass_submitted',
      status: 'submitted',
      title: 'Gatepass submitted',
      message: `Your gatepass ${gatepass.passNumber} was submitted and is awaiting ${reviewerRole.toUpperCase()} review.`,
      metadata: buildGatepassNotificationMetadata(gatepass, {
        workflow: 'requester_submission'
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
  const filter = {};
  let allowedStatuses;

  if (actor.role === 'principal') {
    filter.applicantType = 'student';
    allowedStatuses = ['pending_principal'];
  } else if (actor.role === 'hod') {
    filter.applicantType = 'student';
    filter.forwardedTo = actor._id;
    allowedStatuses = ['forwarded_to_hod'];
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

  const hodUser = await resolveStudentHodUser(gatepass, payload.forwardToUserId);

  gatepass.status = 'forwarded_to_hod';
  gatepass.currentApprovalLevel = 'hod';
  gatepass.isCancelled = false;
  gatepass.isCompleted = false;
  gatepass.forwardedTo = hodUser._id;
  gatepass.forwardedToRole = 'hod';
  gatepass.principalAction = {
    status: 'forwarded',
    actionBy: actor._id,
    actedAt: new Date(),
    comment: payload.comment || ''
  };
  gatepass.hodAction = {
    status: 'pending',
    actionBy: null,
    actedAt: null,
    comment: ''
  };
  await gatepass.save();

  await createBulkNotifications([
    {
      recipient: hodUser._id,
      sender: actor._id,
      gatepass: gatepass._id,
      type: 'gatepass_forwarded',
      status: 'forwarded',
      title: 'Gatepass forwarded for HOD review',
      message: `Gatepass ${gatepass.passNumber} has been forwarded to you by Principal for ${hodUser.program} ${hodUser.department} review.`,
      metadata: buildGatepassNotificationMetadata(gatepass, {
        workflow: 'hod_review'
      })
    },
    {
      recipient: gatepass.createdBy._id,
      sender: actor._id,
      gatepass: gatepass._id,
      type: 'gatepass_forwarded',
      status: 'forwarded',
      title: 'Gatepass forwarded to HOD',
      message: `Your gatepass ${gatepass.passNumber} was forwarded to the correct ${gatepass.applicantSnapshot?.program} ${gatepass.applicantSnapshot?.department} HOD for review.`,
      metadata: buildGatepassNotificationMetadata(gatepass, {
        workflow: 'requester_forwarded'
      })
    }
  ]);

  await logAction({
    actorId: actor._id,
    resourceType: 'gatepass',
    resourceId: gatepass._id,
    action: 'forward_gatepass',
    message: `Gatepass ${gatepass.passNumber} forwarded to HOD`,
    metadata: {
      forwardedTo: hodUser._id.toString()
    },
    requestMeta
  });

  return getGatepassByIdOrThrow(gatepass._id);
}

async function approveGatepass(gatepassId, actor, payload, requestMeta) {
  const gatepass = await getAccessibleGatepass(gatepassId, actor);
  const notifications = [];
  let auditMessage = '';

  if (actor.role === 'principal') {
    if (gatepass.applicantType !== 'student' || gatepass.status !== 'pending_principal') {
      throw new AppError('Principal can only approve pending student gatepasses', 400);
    }

    gatepass.status = 'approved_final';
    gatepass.currentApprovalLevel = 'security';
    gatepass.isCancelled = false;
    gatepass.isCompleted = false;
    gatepass.principalAction = {
      status: 'approved',
      actionBy: actor._id,
      actedAt: new Date(),
      comment: payload.comment || ''
    };
    gatepass.forwardedTo = null;
    gatepass.forwardedToRole = 'security';
    await assignApprovedQr(gatepass);
    auditMessage = `Gatepass ${gatepass.passNumber} approved by Principal`;

    notifications.push(
      {
        recipient: gatepass.createdBy._id,
        sender: actor._id,
        gatepass: gatepass._id,
        type: 'gatepass_approved',
        status: 'approved',
        title: 'Gatepass approved',
        message: `Your gatepass ${gatepass.passNumber} was approved by Principal and is ready for security verification.`,
        metadata: buildGatepassNotificationMetadata(gatepass, {
          verificationToken: gatepass.verificationToken,
          qrVerificationUrl: gatepass.qrVerificationUrl
        })
      }
    );

    notifications.push(...(await buildSecurityReadyGatepassNotifications(gatepass, actor)));
  } else if (actor.role === 'hod') {
    if (gatepass.applicantType !== 'student' || gatepass.status !== 'forwarded_to_hod') {
      throw new AppError('HOD can only approve forwarded student gatepasses', 400);
    }

    gatepass.status = 'approved_by_hod';
    gatepass.currentApprovalLevel = 'security';
    gatepass.isCancelled = false;
    gatepass.isCompleted = false;
    gatepass.hodAction = {
      status: 'approved',
      actionBy: actor._id,
      actedAt: new Date(),
      comment: payload.comment || ''
    };
    gatepass.forwardedTo = null;
    gatepass.forwardedToRole = 'security';
    await assignApprovedQr(gatepass);
    auditMessage = `Gatepass ${gatepass.passNumber} approved by HOD`;

    const principalUser = await getActiveUserByRole('principal');

    notifications.push(
      {
        recipient: gatepass.createdBy._id,
        sender: actor._id,
        gatepass: gatepass._id,
        type: 'gatepass_approved',
        status: 'approved',
        title: 'Gatepass approved by HOD',
        message: `Your gatepass ${gatepass.passNumber} was approved by HOD and is ready for security verification.`,
        metadata: buildGatepassNotificationMetadata(gatepass, {
          verificationToken: gatepass.verificationToken,
          qrVerificationUrl: gatepass.qrVerificationUrl
        })
      },
      {
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
      }
    );

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

  return getGatepassByIdOrThrow(gatepass._id);
}

async function rejectGatepass(gatepassId, actor, payload, requestMeta) {
  const gatepass = await getAccessibleGatepass(gatepassId, actor);
  const notifications = [];
  let auditMessage = '';

  if (actor.role === 'principal') {
    if (gatepass.applicantType !== 'student' || gatepass.status !== 'pending_principal') {
      throw new AppError('Principal can only reject pending student gatepasses', 400);
    }

    gatepass.status = 'rejected_by_principal';
    gatepass.principalAction = {
      status: 'rejected',
      actionBy: actor._id,
      actedAt: new Date(),
      comment: payload.rejectionReason
    };
    auditMessage = `Gatepass ${gatepass.passNumber} rejected by Principal`;
  } else if (actor.role === 'hod') {
    if (gatepass.applicantType !== 'student' || gatepass.status !== 'forwarded_to_hod') {
      throw new AppError('HOD can only reject forwarded student gatepasses', 400);
    }

    const principalUser = await getActiveUserByRole('principal');

    gatepass.status = 'rejected_by_hod';
    gatepass.hodAction = {
      status: 'rejected',
      actionBy: actor._id,
      actedAt: new Date(),
      comment: payload.rejectionReason
    };
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
    auditMessage = `Gatepass ${gatepass.passNumber} rejected by HOD`;
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

  notifications.unshift({
    recipient: gatepass.createdBy._id,
    sender: actor._id,
    gatepass: gatepass._id,
    type: 'gatepass_rejected',
    status: 'rejected',
    title: 'Gatepass rejected',
    message: `Your gatepass ${gatepass.passNumber} was rejected by ${actor.role.toUpperCase()}.`,
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

  return getGatepassByIdOrThrow(gatepass._id);
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

  return getGatepassByIdOrThrow(gatepass._id);
}

async function getGatepassHistory(actor, query = {}) {
  return listGatepasses(buildHistoryFilter(actor, query), query);
}

async function getSecurityReadyGatepasses(actor, query = {}) {
  if (actor.role !== 'security') {
    throw new AppError('Only security can access the security queue', 403);
  }

  return getPendingGatepassesForRole(actor, query);
}

module.exports = {
  approveGatepass,
  cancelGatepass,
  checkInGatepass,
  checkOutGatepass,
  createGatepass,
  ensureApprovedGatepassQr,
  forwardGatepass,
  getGatepassDetails,
  getGatepassHistory,
  getMyGatepasses,
  getPendingGatepassesForRole,
  getSecurityReadyGatepasses,
  mapGatepassListItem,
  rejectGatepass,
  updateGatepass,
  verifyGatepassById,
  verifyGatepassByToken
};
