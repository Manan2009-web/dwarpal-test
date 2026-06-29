const QRCode = require('qrcode');
const FacultyLeaveRequest = require('../models/FacultyLeaveRequest');
const User = require('../models/User');
const AppError = require('../utils/appError');
const { buildPaginationMeta, getPagination, getSortOptions } = require('../utils/pagination');
const { generateVerificationToken } = require('../utils/gatepass');
const { createSignedQrPayload, QR_ISSUER, QR_VERSION } = require('../utils/qrSecurity');
const { createBulkNotifications } = require('./notificationService');
const { logAction } = require('./auditService');

const detailPopulate = [
  {
    path: 'createdBy',
    select: 'fullName email role department employeeId phone'
  },
  {
    path: 'hodReviewer',
    select: 'fullName email role department employeeId phone'
  },
  {
    path: 'principalReviewer',
    select: 'fullName email role department employeeId phone'
  },
  {
    path: 'caoReviewer',
    select: 'fullName email role department employeeId phone'
  },
  {
    path: 'hodAction.actionBy',
    select: 'fullName email role department employeeId phone'
  },
  {
    path: 'principalAction.actionBy',
    select: 'fullName email role department employeeId phone'
  },
  {
    path: 'caoAction.actionBy',
    select: 'fullName email role department employeeId phone'
  },
  {
    path: 'securityAction.verifiedBy',
    select: 'fullName email role department employeeId phone'
  },
  {
    path: 'securityAction.checkedOutBy',
    select: 'fullName email role department employeeId phone'
  },
  {
    path: 'securityAction.checkedInBy',
    select: 'fullName email role department employeeId phone'
  }
];

const listPopulate = [
  {
    path: 'createdBy',
    select: 'fullName email role department employeeId phone'
  },
  {
    path: 'hodReviewer',
    select: 'fullName email role department employeeId phone'
  },
  {
    path: 'principalReviewer',
    select: 'fullName email role department employeeId phone'
  },
  {
    path: 'caoReviewer',
    select: 'fullName email role department employeeId phone'
  }
];

const listProjection = [
  '_id',
  'requestNumber',
  'createdBy',
  'facultyDetails',
  'leaveDetails',
  'workloadAdjustments',
  'workloadDeclarations',
  'declaration',
  'shortLeave',
  'workloadStatus',
  'shortLeaveStatus',
  'overallStatus',
  'hodReviewer',
  'principalReviewer',
  'caoReviewer',
  'hodAction.status',
  'hodAction.actedAt',
  'principalAction.status',
  'principalAction.actedAt',
  'caoAction.status',
  'caoAction.actedAt',
  'verificationToken',
  'qrCodeDataUrl',
  'qrVerificationUrl',
  'qrPayload',
  'qrGeneratedAt',
  'qrExpiresAt',
  'qrRevokedAt',
  'securityAction.verifiedAt',
  'securityAction.checkedOutAt',
  'securityAction.checkedInAt',
  'rejectionReason',
  'latestComment',
  'createdAt',
  'updatedAt'
].join(' ');

function applyPopulate(query, populateConfig) {
  populateConfig.forEach((item) => {
    query.populate(item);
  });

  return query;
}

function toId(value) {
  return value?._id?.toString?.() || value?.toString?.() || null;
}

function mapUserSummary(user) {
  if (!user) {
    return null;
  }

  return {
    id: toId(user._id || user.id),
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    department: user.department || null,
    employeeId: user.employeeId || null,
    phone: user.phone || null
  };
}

function normalizeDateOnly(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function resolveFacultyLeaveIdentifier(request) {
  return String(request?.requestNumber || request?.id || '')
    .trim()
    .toUpperCase();
}

function getServerBaseUrl() {
  const env = require('../config/env');

  if (env.serverUrl) {
    return env.serverUrl;
  }

  return `http://localhost:${env.port}`;
}

function combineFacultyLeaveOutDateTime(request) {
  const leaveDate = request?.shortLeave?.leaveDate || request?.leaveDetails?.leaveFrom;

  if (!leaveDate) {
    return '';
  }

  const date = new Date(leaveDate);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const requestedFrom = String(request?.shortLeave?.requestedFrom || '').trim();

  if (requestedFrom) {
    const [hours = '00', minutes = '00'] = requestedFrom.split(':');
    date.setHours(Number(hours), Number(minutes), 0, 0);
  }

  return date.toISOString();
}

function combineFacultyLeaveReturnDateTime(request) {
  const leaveDate = request?.shortLeave?.leaveDate || request?.leaveDetails?.leaveTo;

  if (!leaveDate) {
    return '';
  }

  const date = new Date(leaveDate);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const requestedTo = String(request?.shortLeave?.requestedTo || '').trim();

  if (requestedTo) {
    const [hours = '00', minutes = '00'] = requestedTo.split(':');
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

function getFacultyLeaveQrExpiry(request) {
  const sourceDate = request?.shortLeave?.leaveDate || request?.leaveDetails?.leaveTo || request?.leaveDetails?.leaveFrom;

  if (!sourceDate) {
    return null;
  }

  const expiryDate = new Date(sourceDate);
  expiryDate.setHours(23, 59, 59, 999);
  return expiryDate;
}

function isFacultyLeaveQrExpired(request) {
  return Boolean(request?.qrExpiresAt && new Date(request.qrExpiresAt).getTime() < Date.now());
}

function buildFacultyLeaveQrVerificationUrl(request) {
  const verificationUrl = new URL(
    `/api/gatepasses/security/verify/${request.verificationToken}`,
    getServerBaseUrl()
  );

  verificationUrl.searchParams.set('gatepassId', resolveFacultyLeaveIdentifier(request));
  verificationUrl.searchParams.set('recordType', 'faculty_leave');
  verificationUrl.searchParams.set('requestKind', 'faculty_leave');

  return verificationUrl.toString();
}

function buildFacultyLeaveQrPayload(request) {
  const gatepassId = resolveFacultyLeaveIdentifier(request);

  if (!gatepassId) {
    throw new Error('Faculty leave request number is required before generating a QR code.');
  }

  const facultyDetails = request?.facultyDetails || {};
  const verificationUrl = buildFacultyLeaveQrVerificationUrl(request);
  const qrExpiry = getFacultyLeaveQrExpiry(request);

  return createSignedQrPayload(compactPayload({
    issuer: QR_ISSUER,
    version: QR_VERSION,
    recordType: 'faculty_leave',
    requestKind: 'faculty_leave',
    gatepassId,
    applicantType: 'faculty',
    facultyName: String(facultyDetails.name || request?.createdBy?.fullName || '').trim() || 'Not provided',
    employeeId: String(facultyDetails.employeeId || request?.createdBy?.employeeId || '').trim() || 'Not provided',
    department: String(facultyDetails.department || request?.createdBy?.department || '').trim() || 'Not assigned',
    reason: String(request?.shortLeave?.reason || request?.leaveDetails?.reason || '').trim() || 'Not provided',
    outTime: combineFacultyLeaveOutDateTime(request) || 'Not provided',
    returnTime: combineFacultyLeaveReturnDateTime(request) || undefined,
    verificationToken: request.verificationToken,
    verificationUrl,
    issuedAt: new Date().toISOString(),
    expiresAt: qrExpiry ? qrExpiry.toISOString() : undefined
  }));
}

async function buildFacultyLeaveQrFields(request) {
  const qrPayload = buildFacultyLeaveQrPayload(request);
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
    qrVerificationUrl: buildFacultyLeaveQrVerificationUrl(request),
    qrPayload,
    qrGeneratedAt: new Date(),
    qrExpiresAt: getFacultyLeaveQrExpiry(request),
    qrRevokedAt: null
  };
}

function hasSignedFacultyLeaveQr(request) {
  const payload = request?.qrPayload || {};

  return Boolean(
    request?.verificationToken &&
      request?.qrCodeDataUrl &&
      request?.qrGeneratedAt &&
      payload.signature &&
      payload.issuer === QR_ISSUER &&
      String(payload.version || '') === QR_VERSION
  );
}

async function ensureApprovedFacultyLeaveQr(request) {
  if (!request || request.overallStatus !== 'approved') {
    return request;
  }

  if (hasSignedFacultyLeaveQr(request)) {
    return request;
  }

  request.verificationToken = request.verificationToken || generateVerificationToken();
  Object.assign(request, await buildFacultyLeaveQrFields(request));
  await request.save();

  return request;
}

function clearFacultyLeaveQr(request) {
  request.verificationToken = undefined;
  request.markModified('verificationToken');
  request.qrCodeDataUrl = null;
  request.qrVerificationUrl = null;
  request.qrPayload = null;
  request.qrGeneratedAt = null;
  request.qrExpiresAt = null;
  request.qrRevokedAt = new Date();
}

function computeOverallStatus(request) {
  if (
    request.workloadStatus === 'rejected_by_hod' ||
    ['rejected_by_principal', 'rejected_by_cao'].includes(request.shortLeaveStatus)
  ) {
    return 'rejected';
  }

  if (request.workloadStatus === 'approved_by_hod' && request.shortLeaveStatus === 'approved') {
    return 'approved';
  }

  return 'pending';
}

function getShortLeaveStage(request) {
  if (request.shortLeaveStatus === 'pending_principal') {
    return 'Pending Principal Approval';
  }

  if (request.shortLeaveStatus === 'pending_cao') {
    return 'Pending CAO Approval';
  }

  if (request.shortLeaveStatus === 'approved') {
    return 'Approved';
  }

  if (request.shortLeaveStatus === 'rejected_by_principal') {
    return 'Rejected by Principal';
  }

  if (request.shortLeaveStatus === 'rejected_by_cao') {
    return 'Rejected by CAO';
  }

  return 'Pending Principal Approval';
}

function getWorkloadStage(request) {
  if (request.workloadStatus === 'approved_by_hod') {
    return 'Approved by HOD';
  }

  if (request.workloadStatus === 'rejected_by_hod') {
    return 'Rejected by HOD';
  }

  return 'Pending HOD Approval';
}

function getFacultyLeaveSecurityStatus(request) {
  if (request?.securityAction?.checkedInAt) {
    return 'returned';
  }

  if (request?.securityAction?.checkedOutAt) {
    return 'out';
  }

  if (request?.overallStatus === 'approved') {
    return 'approved';
  }

  if (request?.overallStatus === 'rejected') {
    return 'rejected';
  }

  return 'pending';
}

function resolveFacultyApprovedBy(request) {
  if (request?.caoAction?.status === 'approved') {
    return request.caoAction?.actionBy?.fullName || 'CAO';
  }

  if (request?.principalAction?.status === 'approved') {
    return request.principalAction?.actionBy?.fullName || 'Principal';
  }

  if (request?.hodAction?.status === 'approved') {
    return request.hodAction?.actionBy?.fullName || 'HOD';
  }

  return 'Awaiting approval';
}

function mapFacultyLeaveListItem(request) {
  const securityStatus = getFacultyLeaveSecurityStatus(request);

  return {
    id: toId(request._id || request.id),
    requestNumber: request.requestNumber,
    facultyDetails: request.facultyDetails,
    leaveDetails: request.leaveDetails,
    workloadAdjustments: request.workloadAdjustments || [],
    workloadDeclarations: request.workloadDeclarations || {},
    declaration: request.declaration || {},
    shortLeave: request.shortLeave,
    workloadStatus: request.workloadStatus,
    shortLeaveStatus: request.shortLeaveStatus,
    overallStatus: request.overallStatus,
    workloadStage: getWorkloadStage(request),
    shortLeaveStage: getShortLeaveStage(request),
    createdBy: mapUserSummary(request.createdBy),
    hodReviewer: mapUserSummary(request.hodReviewer),
    principalReviewer: mapUserSummary(request.principalReviewer),
    caoReviewer: mapUserSummary(request.caoReviewer),
    approvedBy: resolveFacultyApprovedBy(request),
    approvedAt:
      request.caoAction?.actedAt || request.principalAction?.actedAt || request.hodAction?.actedAt || null,
    actions: {
      hod: {
        status: request.hodAction?.status || null,
        actedAt: request.hodAction?.actedAt || null
      },
      principal: {
        status: request.principalAction?.status || null,
        actedAt: request.principalAction?.actedAt || null
      },
      cao: {
        status: request.caoAction?.status || null,
        actedAt: request.caoAction?.actedAt || null
      }
    },
    security: {
      verifiedAt: request.securityAction?.verifiedAt || null,
      checkedOutAt: request.securityAction?.checkedOutAt || null,
      checkedInAt: request.securityAction?.checkedInAt || null
    },
    qr: {
      available: Boolean(request.qrCodeDataUrl && request.verificationToken && !request.qrRevokedAt),
      imageDataUrl: request.qrCodeDataUrl || null,
      verificationUrl: request.qrVerificationUrl || null,
      verificationToken: request.verificationToken || null,
      payload: request.qrPayload || null,
      generatedAt: request.qrGeneratedAt || null,
      expiresAt: request.qrExpiresAt || null,
      revokedAt: request.qrRevokedAt || null
    },
    qrCodeDataUrl: request.qrCodeDataUrl || null,
    qrVerificationUrl: request.qrVerificationUrl || null,
    verificationToken: request.verificationToken || null,
    qrPayload: request.qrPayload || null,
    qrGeneratedAt: request.qrGeneratedAt || null,
    qrExpiresAt: request.qrExpiresAt || null,
    qrRevokedAt: request.qrRevokedAt || null,
    latestComment: request.latestComment || '',
    rejectionReason: request.rejectionReason || '',
    securityStatus,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt
  };
}

async function getActiveUserByRole(role, options = {}) {
  const filter = {
    role,
    isActive: true
  };

  if (options.userId) {
    filter._id = options.userId;
  }

  if (options.department) {
    filter.department = options.department;
  }

  let user = await User.findOne(filter);

  if (!user && role === 'hod' && options.department) {
    user = await User.findOne({ role, isActive: true });
  }

  if (!user) {
    throw new AppError(`No active ${role.toUpperCase()} account is available`, 404);
  }

  return user;
}

async function listActiveUsersByRole(role, options = {}) {
  const filter = {
    role,
    isActive: true
  };

  if (options.userId) {
    filter._id = options.userId;
  }

  if (options.department) {
    filter.department = options.department;
  }

  let users = await User.find(filter).select('_id');

  if (!users.length && role === 'hod' && options.department) {
    users = await User.find({ role, isActive: true }).select('_id');
  }

  if (!users.length) {
    throw new AppError(`No active ${role.toUpperCase()} account is available`, 404);
  }

  return users;
}

function buildFacultyLeaveNotificationMetadata(request, extra = {}) {
  return {
    requestNumber: request.requestNumber,
    referenceId: request.requestNumber,
    applicantName:
      request.facultyDetails?.name || request.createdBy?.fullName || request.createdBy?.name || '',
    department:
      request.facultyDetails?.department || request.createdBy?.department || request.shortLeave?.department || '',
    leaveType: request.leaveDetails?.leaveType || '',
    workloadStatus: request.workloadStatus,
    shortLeaveStatus: request.shortLeaveStatus,
    overallStatus: request.overallStatus,
    ...extra
  };
}

async function buildSecurityReadyFacultyLeaveNotifications(request, actor) {
  const securityUsers = await listActiveUsersByRole('security');

  return securityUsers.map((securityUser) => ({
    recipient: securityUser._id,
    sender: actor._id,
    facultyLeaveRequest: request._id,
    type: 'faculty_leave_ready_for_security',
    status: 'pending',
    title: 'Faculty gatepass ready for security verification',
    message: `Faculty gatepass ${request.requestNumber} is approved and ready to be marked out by security.`,
    metadata: buildFacultyLeaveNotificationMetadata(request, {
      workflow: 'security_queue',
      verificationToken: request.verificationToken,
      qrVerificationUrl: request.qrVerificationUrl
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
      { requestNumber: regex },
      { 'facultyDetails.name': regex },
      { 'facultyDetails.employeeId': regex },
      { 'leaveDetails.reason': regex },
      { 'shortLeave.reason': regex },
      { 'shortLeave.instituteName': regex }
    ]
  };
}

function applyListFilters(filter, query = {}) {
  const requestedStatuses = String(query.status || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  if (requestedStatuses.length) {
    const lifecycleStatuses = requestedStatuses.filter((value) => ['pending', 'approved', 'rejected'].includes(value));
    const includesOut = requestedStatuses.includes('out');
    const includesReturned = requestedStatuses.includes('returned');

    if (lifecycleStatuses.length) {
      filter.overallStatus = lifecycleStatuses.length === 1 ? lifecycleStatuses[0] : { $in: lifecycleStatuses };
    }

    if (includesOut && includesReturned) {
      filter['securityAction.checkedOutAt'] = { $ne: null };
    } else if (includesReturned) {
      filter['securityAction.checkedInAt'] = { $ne: null };
    } else if (includesOut) {
      filter['securityAction.checkedOutAt'] = { $ne: null };
      filter['securityAction.checkedInAt'] = null;
    }
  }

  if (query.department) {
    filter['facultyDetails.department'] = query.department;
  }

  if (query.fromDate || query.toDate) {
    filter['leaveDetails.leaveFrom'] = {};

    if (query.fromDate) {
      filter['leaveDetails.leaveFrom'].$gte = new Date(query.fromDate);
    }

    if (query.toDate) {
      filter['leaveDetails.leaveFrom'].$lte = new Date(query.toDate);
    }
  }

  if (query.since) {
    filter.updatedAt = {
      ...(filter.updatedAt || {}),
      $gte: new Date(query.since)
    };
  }

  const searchFilter = buildSearchFilter(query.q);

  if (searchFilter) {
    Object.assign(filter, searchFilter);
  }
}

function buildAccessFilter(actor) {
  if (actor.role === 'faculty') {
    return { createdBy: actor._id };
  }

  if (actor.role === 'hod') {
    return {
      $or: [{ hodReviewer: actor._id }, { 'hodAction.actionBy': actor._id }]
    };
  }

  if (actor.role === 'principal') {
    return {};
  }

  if (actor.role === 'cao') {
    return {
      $or: [
        { shortLeaveStatus: { $in: ['pending_cao', 'approved', 'rejected_by_cao'] } },
        { 'caoAction.actionBy': actor._id }
      ]
    };
  }

  if (actor.role === 'security') {
    return {
      overallStatus: 'approved'
    };
  }

  throw new AppError('Unsupported role for faculty leave access', 403);
}

function canUserAccessRequest(actor, request) {
  const actorId = actor._id.toString();

  if (actor.role === 'faculty') {
    return toId(request.createdBy) === actorId;
  }

  if (actor.role === 'hod') {
    return toId(request.hodReviewer) === actorId || toId(request.hodAction?.actionBy) === actorId;
  }

  if (actor.role === 'principal') {
    return true;
  }

  if (actor.role === 'cao') {
    return (
      ['pending_cao', 'approved', 'rejected_by_cao'].includes(request.shortLeaveStatus) ||
      toId(request.caoAction?.actionBy) === actorId
    );
  }

  if (actor.role === 'security') {
    return request.overallStatus === 'approved';
  }

  return false;
}

async function listFacultyLeaveRequests(filter, query = {}, options = {}) {
  const { page, limit, skip } = getPagination(query, { defaultLimit: 10, maxLimit: 50 });
  const sort = getSortOptions(query, {
    allowedFields: ['updatedAt', 'createdAt'],
    defaultSortBy: options.defaultSortBy || 'updatedAt',
    defaultOrder: options.defaultOrder || 'desc'
  });

  const baseQuery = FacultyLeaveRequest.find(filter)
    .select(options.projection || listProjection)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .lean();

  const populatedQuery = applyPopulate(baseQuery, options.populate || listPopulate);

  const [requests, total] = await Promise.all([
    populatedQuery,
    FacultyLeaveRequest.countDocuments(filter)
  ]);
  const hydratedRequests = await Promise.all(
    requests.map(async (request) => {
      if (request.overallStatus !== 'approved' || hasSignedFacultyLeaveQr(request)) {
        return request;
      }

      const persistedRequest = await FacultyLeaveRequest.findById(request._id);

      if (!persistedRequest) {
        return request;
      }

      await ensureApprovedFacultyLeaveQr(persistedRequest);

      return {
        ...request,
        verificationToken: persistedRequest.verificationToken || null,
        qrCodeDataUrl: persistedRequest.qrCodeDataUrl || null,
        qrVerificationUrl: persistedRequest.qrVerificationUrl || null,
        qrPayload: persistedRequest.qrPayload || null,
        qrGeneratedAt: persistedRequest.qrGeneratedAt || null,
        qrExpiresAt: persistedRequest.qrExpiresAt || null,
        qrRevokedAt: persistedRequest.qrRevokedAt || null
      };
    })
  );

  return {
    requests: hydratedRequests.map(mapFacultyLeaveListItem),
    meta: {
      ...buildPaginationMeta(total, page, limit),
      sortBy: query.sortBy || options.defaultSortBy || 'updatedAt',
      order: query.order || options.defaultOrder || 'desc',
      since: query.since || null
    }
  };
}

async function getFacultyLeaveByIdOrThrow(requestId) {
  const request = await applyPopulate(FacultyLeaveRequest.findById(requestId), detailPopulate);

  if (!request) {
    throw new AppError('Faculty leave request not found', 404);
  }

  if (request.overallStatus === 'approved') {
    await ensureApprovedFacultyLeaveQr(request);
  }

  return request;
}

async function getAccessibleFacultyLeaveRequest(requestId, actor) {
  const request = await getFacultyLeaveByIdOrThrow(requestId);

  if (!canUserAccessRequest(actor, request)) {
    throw new AppError('You do not have access to this faculty leave request', 403);
  }

  return request;
}

async function createFacultyLeaveRequest(actor, payload, requestMeta) {
  if (actor.role !== 'faculty') {
    throw new AppError('Only faculty users can create faculty leave requests', 403);
  }

  const [principalReviewer, caoReviewer] = await Promise.all([
    getActiveUserByRole('principal'),
    getActiveUserByRole('cao')
  ]);

  const request = await FacultyLeaveRequest.create({
    createdBy: actor._id,
    facultyDetails: {
      name: payload.facultyDetails.name,
      employeeId: payload.facultyDetails.employeeId,
      designation: payload.facultyDetails.designation,
      department: payload.facultyDetails.department,
      contactNumber: payload.facultyDetails.contactNumber,
      emailId: payload.facultyDetails.emailId
    },
    leaveDetails: {
      leaveType: payload.leaveDetails.leaveType,
      leaveTypeOther: payload.leaveDetails.leaveTypeOther || '',
      reason: payload.leaveDetails.reason,
      leaveFrom: normalizeDateOnly(payload.leaveDetails.leaveFrom),
      leaveTo: normalizeDateOnly(payload.leaveDetails.leaveTo),
      totalDays: payload.leaveDetails.totalDays
    },
    workloadAdjustments: payload.workloadAdjustments.map((item) => ({
      date: normalizeDateOnly(item.date),
      time: item.time,
      subjectOrCourseCode: item.subjectOrCourseCode,
      classOrSemester: item.classOrSemester,
      adjustedFacultyName: item.adjustedFacultyName,
      adjustedFacultySignature: item.adjustedFacultySignature || ''
    })),
    workloadDeclarations: {
      lecturesAdjustedConfirmed: payload.workloadDeclarations.lecturesAdjustedConfirmed,
      noAcademicLossConfirmed: payload.workloadDeclarations.noAcademicLossConfirmed
    },
    declaration: {
      confirmed: payload.declaration.confirmed,
      declarationDate: normalizeDateOnly(payload.declaration.declarationDate),
      digitalAcknowledgmentName: payload.declaration.digitalAcknowledgmentName
    },
    shortLeave: payload.leaveDetails.leaveType === 'Short Leave'
      ? {
          staffMemberName: payload.shortLeave.staffMemberName,
          designation: payload.shortLeave.designation,
          department: payload.shortLeave.department,
          instituteName: payload.shortLeave.instituteName,
          employeeId: payload.shortLeave.employeeId,
          leaveDate: normalizeDateOnly(payload.shortLeave.leaveDate),
          requestedFrom: payload.shortLeave.requestedFrom,
          requestedTo: payload.shortLeave.requestedTo,
          totalDurationMinutes: payload.shortLeave.totalDurationMinutes,
          reason: payload.shortLeave.reason,
          applicantConfirmed: payload.shortLeave.applicantConfirmed,
          applicationDate: normalizeDateOnly(payload.shortLeave.applicationDate),
          digitalSignatureName: payload.shortLeave.digitalSignatureName
        }
      : null,
    hodReviewer: null,
    principalReviewer: principalReviewer._id,
    caoReviewer: caoReviewer._id,
    workloadStatus: 'approved_by_hod',
    shortLeaveStatus: 'pending_principal',
    overallStatus: 'pending',
    hodAction: {
      status: 'not_required'
    },
    principalAction: {
      status: 'pending'
    },
    caoAction: {
      status: 'not_required'
    }
  });

  await createBulkNotifications([
    {
      recipient: principalReviewer._id,
      sender: actor._id,
      facultyLeaveRequest: request._id,
      type: 'faculty_leave_submitted',
      status: 'submitted',
      title: 'Faculty leave request awaiting Principal review',
      message: `${payload.facultyDetails.name} submitted faculty leave request ${request.requestNumber} for Principal review.`,
      metadata: buildFacultyLeaveNotificationMetadata(request, {
        workflow: 'principal_review'
      })
    },
    {
      recipient: caoReviewer._id,
      sender: actor._id,
      facultyLeaveRequest: request._id,
      type: 'faculty_leave_submitted',
      status: 'submitted',
      title: 'Faculty leave request submitted',
      message: `Faculty leave request ${request.requestNumber} was submitted and will reach CAO approval after Principal review.`,
      metadata: buildFacultyLeaveNotificationMetadata(request, {
        workflow: 'cao_awareness'
      })
    },
    {
      recipient: actor._id,
      sender: actor._id,
      facultyLeaveRequest: request._id,
      type: 'faculty_leave_submitted',
      status: 'submitted',
      title: 'Faculty leave request submitted',
      message: `Faculty leave request ${request.requestNumber} has been submitted to Principal.`,
      metadata: buildFacultyLeaveNotificationMetadata(request, {
        workflow: 'requester_submission'
      })
    }
  ]);

  await logAction({
    actorId: actor._id,
    resourceType: 'faculty_leave_request',
    resourceId: request._id,
    action: 'create_faculty_leave_request',
    message: `Faculty leave request ${request.requestNumber} created`,
    metadata: {
      workloadStatus: request.workloadStatus,
      shortLeaveStatus: request.shortLeaveStatus
    },
    requestMeta
  });

  return getFacultyLeaveByIdOrThrow(request._id);
}

async function getMyFacultyLeaveRequests(actor, query = {}) {
  const filter = { createdBy: actor._id };
  applyListFilters(filter, query);
  return listFacultyLeaveRequests(filter, query);
}

async function getFacultyLeaveHistory(actor, query = {}) {
  const filter = buildAccessFilter(actor);
  applyListFilters(filter, query);
  return listFacultyLeaveRequests(filter, query);
}

async function getFacultyLeaveDetails(requestId, actor) {
  return getAccessibleFacultyLeaveRequest(requestId, actor);
}

async function getPendingFacultyLeaveRequestsForRole(actor, query = {}) {
  const filter = {};

  if (actor.role === 'hod') {
    filter.hodReviewer = actor._id;
    filter.workloadStatus = 'pending_hod';
  } else if (actor.role === 'principal') {
    filter.shortLeaveStatus = 'pending_principal';
  } else if (actor.role === 'cao') {
    filter.caoReviewer = actor._id;
    filter.shortLeaveStatus = 'pending_cao';
  } else {
    throw new AppError('Unsupported approval role for faculty leave requests', 400);
  }

  applyListFilters(filter, query);
  return listFacultyLeaveRequests(filter, query);
}

async function approveFacultyLeaveRequest(requestId, actor, payload, requestMeta) {
  const request = await getAccessibleFacultyLeaveRequest(requestId, actor);
  const notifications = [];
  let auditMessage = '';

  if (actor.role === 'hod') {
    if (toId(request.hodReviewer) !== actor._id.toString()) {
      throw new AppError('This faculty leave request is not assigned to you', 403);
    }

    if (request.workloadStatus !== 'pending_hod') {
      throw new AppError('Only pending workload adjustments can be approved by HOD', 400);
    }

    request.workloadStatus = 'approved_by_hod';
    request.hodAction = {
      status: 'approved',
      actionBy: actor._id,
      actedAt: new Date(),
      comment: payload.comment || ''
    };
    request.latestComment = payload.comment || '';
    request.overallStatus = computeOverallStatus(request);
    auditMessage = `Faculty leave request ${request.requestNumber} workload approved by HOD`;

    notifications.push({
      recipient: request.createdBy._id,
      sender: actor._id,
      facultyLeaveRequest: request._id,
      type: request.overallStatus === 'approved' ? 'faculty_leave_approved' : 'faculty_leave_status',
      status: 'approved',
      title:
        request.overallStatus === 'approved'
          ? 'Faculty leave request approved'
          : 'Workload adjustment approved by HOD',
      message:
        request.overallStatus === 'approved'
          ? `Faculty leave request ${request.requestNumber} is now fully approved.`
          : `Workload adjustment for faculty leave request ${request.requestNumber} was approved by HOD.`,
      metadata: buildFacultyLeaveNotificationMetadata(request, {
        workflow: 'workload_review',
        action: 'approved'
      })
    });
  } else if (actor.role === 'principal') {
    if (request.shortLeaveStatus !== 'pending_principal') {
      throw new AppError('Only pending faculty short leave requests can be approved by Principal', 400);
    }

    request.shortLeaveStatus = 'pending_cao';
    request.principalAction = {
      status: 'approved',
      actionBy: actor._id,
      actedAt: new Date(),
      comment: payload.comment || ''
    };
    request.caoAction = {
      status: 'pending',
      actionBy: null,
      actedAt: null,
      comment: ''
    };
    request.latestComment = payload.comment || '';
    request.overallStatus = computeOverallStatus(request);
    auditMessage = `Faculty leave request ${request.requestNumber} short leave approved by Principal`;

    notifications.push(
      {
        recipient: request.createdBy._id,
        sender: actor._id,
        facultyLeaveRequest: request._id,
        type: 'faculty_leave_forwarded',
        status: 'forwarded',
        title: 'Short leave approved by Principal',
        message: `Short leave for faculty leave request ${request.requestNumber} was approved by Principal and forwarded to CAO.`,
        metadata: buildFacultyLeaveNotificationMetadata(request, {
          workflow: 'requester_forwarded',
          action: 'approved'
        })
      },
      {
        recipient: request.caoReviewer._id || request.caoReviewer,
        sender: actor._id,
        facultyLeaveRequest: request._id,
        type: 'faculty_leave_forwarded',
        status: 'forwarded',
        title: 'Faculty short leave awaiting CAO review',
        message: `Faculty leave request ${request.requestNumber} is pending your CAO approval.`,
        metadata: buildFacultyLeaveNotificationMetadata(request, {
          workflow: 'cao_review',
          action: 'forwarded'
        })
      }
    );
  } else if (actor.role === 'cao') {
    if (request.shortLeaveStatus !== 'pending_cao') {
      throw new AppError('Only Principal-approved faculty short leave requests can be approved by CAO', 400);
    }

    request.shortLeaveStatus = 'approved';
    request.caoAction = {
      status: 'approved',
      actionBy: actor._id,
      actedAt: new Date(),
      comment: payload.comment || ''
    };
    request.latestComment = payload.comment || '';
    request.overallStatus = computeOverallStatus(request);
    auditMessage = `Faculty leave request ${request.requestNumber} approved by CAO`;

    notifications.push({
      recipient: request.createdBy._id,
      sender: actor._id,
      facultyLeaveRequest: request._id,
      type: request.overallStatus === 'approved' ? 'faculty_leave_approved' : 'faculty_leave_status',
      status: 'approved',
      title:
        request.overallStatus === 'approved'
          ? 'Faculty leave request approved'
          : 'Approved by CAO',
      message:
        request.overallStatus === 'approved'
          ? `Faculty leave request ${request.requestNumber} has been fully approved.`
          : `Short leave for faculty leave request ${request.requestNumber} was approved by CAO.`,
      metadata: buildFacultyLeaveNotificationMetadata(request, {
        workflow: 'cao_review',
        action: 'approved'
      })
    });
  } else {
    throw new AppError('Your role is not allowed to approve faculty leave requests', 403);
  }

  if (request.overallStatus === 'approved') {
    request.verificationToken = request.verificationToken || generateVerificationToken();
    Object.assign(request, await buildFacultyLeaveQrFields(request));
    notifications.push(...(await buildSecurityReadyFacultyLeaveNotifications(request, actor)));
  } else {
    clearFacultyLeaveQr(request);
  }

  await request.save();
  await createBulkNotifications(notifications);

  await logAction({
    actorId: actor._id,
    resourceType: 'faculty_leave_request',
    resourceId: request._id,
    action: 'approve_faculty_leave_request',
    message: auditMessage,
    metadata: {
      workloadStatus: request.workloadStatus,
      shortLeaveStatus: request.shortLeaveStatus,
      overallStatus: request.overallStatus
    },
    requestMeta
  });

  return getFacultyLeaveByIdOrThrow(request._id);
}

async function rejectFacultyLeaveRequest(requestId, actor, payload, requestMeta) {
  const request = await getAccessibleFacultyLeaveRequest(requestId, actor);
  let auditMessage = '';

  if (actor.role === 'hod') {
    if (toId(request.hodReviewer) !== actor._id.toString()) {
      throw new AppError('This faculty leave request is not assigned to you', 403);
    }

    if (request.workloadStatus !== 'pending_hod') {
      throw new AppError('Only pending workload adjustments can be rejected by HOD', 400);
    }

    request.workloadStatus = 'rejected_by_hod';
    request.hodAction = {
      status: 'rejected',
      actionBy: actor._id,
      actedAt: new Date(),
      comment: payload.rejectionReason
    };
    auditMessage = `Faculty leave request ${request.requestNumber} workload rejected by HOD`;
  } else if (actor.role === 'principal') {
    if (request.shortLeaveStatus !== 'pending_principal') {
      throw new AppError('Only pending faculty short leave requests can be rejected by Principal', 400);
    }

    request.shortLeaveStatus = 'rejected_by_principal';
    request.principalAction = {
      status: 'rejected',
      actionBy: actor._id,
      actedAt: new Date(),
      comment: payload.rejectionReason
    };
    auditMessage = `Faculty leave request ${request.requestNumber} short leave rejected by Principal`;
  } else if (actor.role === 'cao') {
    if (request.shortLeaveStatus !== 'pending_cao') {
      throw new AppError('Only pending faculty short leave requests can be rejected by CAO', 400);
    }

    request.shortLeaveStatus = 'rejected_by_cao';
    request.caoAction = {
      status: 'rejected',
      actionBy: actor._id,
      actedAt: new Date(),
      comment: payload.rejectionReason
    };
    auditMessage = `Faculty leave request ${request.requestNumber} rejected by CAO`;
  } else {
    throw new AppError('Your role is not allowed to reject faculty leave requests', 403);
  }

  request.latestComment = payload.rejectionReason;
  request.rejectionReason = payload.rejectionReason;
  request.overallStatus = computeOverallStatus(request);
  clearFacultyLeaveQr(request);
  await request.save();

  await createBulkNotifications([
    {
      recipient: request.createdBy._id,
      sender: actor._id,
      facultyLeaveRequest: request._id,
      type: 'faculty_leave_rejected',
      status: 'rejected',
      title: 'Faculty leave request rejected',
      message: `Faculty leave request ${request.requestNumber} was rejected by ${actor.role.toUpperCase()}.`,
      metadata: buildFacultyLeaveNotificationMetadata(request, {
        workflow: `${actor.role}_review`,
        action: 'rejected',
        rejectionReason: payload.rejectionReason
      })
    }
  ]);

  await logAction({
    actorId: actor._id,
    resourceType: 'faculty_leave_request',
    resourceId: request._id,
    action: 'reject_faculty_leave_request',
    message: auditMessage,
    metadata: {
      workloadStatus: request.workloadStatus,
      shortLeaveStatus: request.shortLeaveStatus,
      overallStatus: request.overallStatus,
      rejectionReason: payload.rejectionReason
    },
    requestMeta
  });

  return getFacultyLeaveByIdOrThrow(request._id);
}

function buildFacultyLeaveSecurityVerificationResult(request, messages = {}) {
  const resolvedMessages = {
    notFoundMessage: 'QR does not belong to a valid gatepass.',
    invalidQrMessage: 'Invalid QR Code',
    unauthorizedQrMessage: 'Unauthorized QR',
    readyToMarkOutMessage: 'Gatepass is valid and ready to be marked OUT by security.',
    readyToMarkInMessage: 'Gatepass is already marked OUT and is ready to be marked IN.',
    ...messages
  };

  if (!request) {
    return {
      valid: false,
      message: resolvedMessages.notFoundMessage,
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
      message: resolvedMessages.invalidQrMessage,
      gatepass: mapFacultyLeaveListItem(request),
      nextAction: null
    };
  }

  if (request.securityAction?.checkedInAt) {
    return {
      valid: false,
      message: 'Gatepass already used.',
      gatepass: mapFacultyLeaveListItem(request),
      nextAction: null
    };
  }

  if (request.securityAction?.checkedOutAt) {
    return {
      valid: true,
      message: resolvedMessages.readyToMarkInMessage,
      gatepass: mapFacultyLeaveListItem(request),
      nextAction: 'markIn'
    };
  }

  return {
    valid: true,
    message: resolvedMessages.readyToMarkOutMessage,
    gatepass: mapFacultyLeaveListItem(request),
    nextAction: 'markOut'
  };
}

async function verifyFacultyLeaveByToken(token, actor) {
  if (actor.role !== 'security') {
    throw new AppError('Only security can verify faculty gatepass QR tokens', 403);
  }

  const normalizedToken = String(token || '').trim().toUpperCase();
  const request = normalizedToken
    ? await applyPopulate(FacultyLeaveRequest.findOne({ verificationToken: normalizedToken }), detailPopulate)
    : null;

  if (request?.overallStatus === 'approved') {
    await ensureApprovedFacultyLeaveQr(request);
  }

  return buildFacultyLeaveSecurityVerificationResult(request);
}

async function verifyFacultyLeaveById(gatepassIdentifier, actor) {
  if (actor.role !== 'security') {
    throw new AppError('Only security can verify faculty gatepass identifiers', 403);
  }

  const normalizedIdentifier = resolveFacultyLeaveIdentifier({ requestNumber: gatepassIdentifier });
  const request = normalizedIdentifier
    ? await applyPopulate(FacultyLeaveRequest.findOne({ requestNumber: normalizedIdentifier }), detailPopulate)
    : null;

  if (request?.overallStatus === 'approved') {
    await ensureApprovedFacultyLeaveQr(request);
  }

  return buildFacultyLeaveSecurityVerificationResult(request, {
    notFoundMessage: 'Faculty gatepass not found.'
  });
}

async function checkOutFacultyLeaveRequest(requestId, actor, payload, requestMeta) {
  const request = await getAccessibleFacultyLeaveRequest(requestId, actor);

  if (actor.role !== 'security') {
    throw new AppError('Only security can check out faculty gatepasses', 403);
  }

  if (request.overallStatus !== 'approved') {
    throw new AppError('Only approved faculty gatepasses can be checked out', 400);
  }

  if (!request.verificationToken || request.qrRevokedAt || isFacultyLeaveQrExpired(request)) {
    throw new AppError('QR code is invalid or expired.', 400);
  }

  if (request.securityAction?.checkedOutAt) {
    throw new AppError('This faculty gatepass has already been marked OUT', 400);
  }

  if (payload.verificationToken && request.verificationToken !== payload.verificationToken) {
    throw new AppError('Verification token does not match this faculty gatepass', 400);
  }

  request.securityAction = {
    ...(request.securityAction ? request.securityAction.toObject() : {}),
    verifiedBy: actor._id,
    verifiedAt: new Date(),
    checkedOutBy: actor._id,
    checkedOutAt: new Date(),
    checkOutNote: payload.note || ''
  };
  await request.save();

  await createBulkNotifications([
    {
      recipient: request.createdBy._id,
      sender: actor._id,
      facultyLeaveRequest: request._id,
      type: 'faculty_leave_out',
      status: 'out',
      title: 'Faculty gatepass checked out by security',
      message: `Faculty gatepass ${request.requestNumber} has been verified and marked out by security.`,
      metadata: buildFacultyLeaveNotificationMetadata(request, {
        workflow: 'security_checkout'
      })
    }
  ]);

  await logAction({
    actorId: actor._id,
    resourceType: 'faculty_leave_request',
    resourceId: request._id,
    action: 'faculty_leave_security_checkout',
    message: `Faculty gatepass ${request.requestNumber} checked out by security`,
    requestMeta
  });

  return getFacultyLeaveByIdOrThrow(request._id);
}

async function checkInFacultyLeaveRequest(requestId, actor, payload, requestMeta) {
  const request = await getAccessibleFacultyLeaveRequest(requestId, actor);

  if (actor.role !== 'security') {
    throw new AppError('Only security can check in faculty gatepasses', 403);
  }

  if (request.overallStatus !== 'approved') {
    throw new AppError('Only approved faculty gatepasses can be checked in', 400);
  }

  if (!request.securityAction?.checkedOutAt) {
    throw new AppError('Only checked-out faculty gatepasses can be marked as returned', 400);
  }

  if (request.securityAction?.checkedInAt) {
    throw new AppError('This faculty gatepass has already been marked as returned', 400);
  }

  request.securityAction = {
    ...(request.securityAction ? request.securityAction.toObject() : {}),
    checkedInBy: actor._id,
    checkedInAt: new Date(),
    checkInNote: payload.note || ''
  };
  await request.save();

  await createBulkNotifications([
    {
      recipient: request.createdBy._id,
      sender: actor._id,
      facultyLeaveRequest: request._id,
      type: 'faculty_leave_returned',
      status: 'returned',
      title: 'Faculty gatepass marked as returned',
      message: `Faculty gatepass ${request.requestNumber} has been marked as returned by security.`,
      metadata: buildFacultyLeaveNotificationMetadata(request, {
        workflow: 'security_checkin'
      })
    }
  ]);

  await logAction({
    actorId: actor._id,
    resourceType: 'faculty_leave_request',
    resourceId: request._id,
    action: 'faculty_leave_security_checkin',
    message: `Faculty gatepass ${request.requestNumber} marked as returned by security`,
    requestMeta
  });

  return getFacultyLeaveByIdOrThrow(request._id);
}

module.exports = {
  approveFacultyLeaveRequest,
  checkInFacultyLeaveRequest,
  checkOutFacultyLeaveRequest,
  createFacultyLeaveRequest,
  ensureApprovedFacultyLeaveQr,
  getFacultyLeaveDetails,
  getFacultyLeaveHistory,
  getMyFacultyLeaveRequests,
  getPendingFacultyLeaveRequestsForRole,
  mapFacultyLeaveListItem,
  rejectFacultyLeaveRequest,
  verifyFacultyLeaveById,
  verifyFacultyLeaveByToken
};
