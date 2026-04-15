const Gatepass = require('../models/Gatepass');
const FacultyLeaveRequest = require('../models/FacultyLeaveRequest');
const User = require('../models/User');
const {
  APPROVED_GATEPASS_STATUSES,
  DEPARTMENTS,
  PENDING_GATEPASS_STATUSES,
  ROUTING_DEPARTMENTS,
  SEMESTERS,
  STUDENT_PROGRAMS
} = require('../constants/appConstants');
const {
  buildFacultyLeaveScopeFilter,
  buildGatepassScopeFilter,
  buildUserScopeFilter,
  canExportReport,
  getAdminAccessProfile,
  getApprovedByUserIds,
  getStatusBucketFilter,
  impossibleFilter
} = require('../utils/adminScope');
const { dateMatch, parseReportFilters, publicFilterSummary } = require('../utils/reportFilters');
const AppError = require('../utils/appError');

const MAX_EXPORT_RECORDS = 10000;
const MAX_OPTION_PEOPLE = 200;
const REJECTED_STATUS_PATTERN = /^rejected_/;

function hasKeys(value) {
  return value && typeof value === 'object' && Object.keys(value).length > 0;
}

function andFilter(...filters) {
  const cleanFilters = filters.filter(hasKeys);

  if (!cleanFilters.length) {
    return {};
  }

  if (cleanFilters.length === 1) {
    return cleanFilters[0];
  }

  return {
    $and: cleanFilters
  };
}

function regex(value) {
  const escaped = String(value || '')
    .trim()
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  return escaped ? new RegExp(escaped, 'i') : null;
}

function includeGatepasses(reportType) {
  return !['leave_report', 'load_adjustment_report', 'individual_faculty_history'].includes(reportType);
}

function includeFacultyLeaves(reportType) {
  return ![
    'all_gatepasses',
    'student_report',
    'coordinator_scope_report',
    'individual_student_history',
    'out_returned_status'
  ].includes(reportType);
}

function buildGatepassFilter(filters, actor) {
  const filterParts = [buildGatepassScopeFilter(actor)];

  if (filters.reportType === 'student_report' || filters.reportType === 'individual_student_history') {
    filterParts.push({ applicantType: 'student' });
  }

  if (filters.reportType === 'faculty_report' || filters.reportType === 'individual_faculty_history') {
    filterParts.push({ applicantType: 'faculty' });
  }

  if (filters.reportType === 'pending_requests') {
    filterParts.push({ status: { $in: PENDING_GATEPASS_STATUSES } });
  }

  if (filters.reportType === 'rejected_requests') {
    filterParts.push({ status: REJECTED_STATUS_PATTERN });
  }

  if (filters.reportType === 'out_returned_status') {
    filterParts.push({ status: { $in: ['checked_out_by_security', 'completed'] } });
  }

  filterParts.push(dateMatch('outDate', filters));

  if (filters.department) {
    filterParts.push({
      $or: [
        { 'routingSnapshot.department': filters.department },
        { 'applicantSnapshot.department': filters.department }
      ]
    });
  }

  if (filters.program) {
    filterParts.push({
      $or: [{ 'routingSnapshot.program': filters.program }, { 'applicantSnapshot.program': filters.program }]
    });
  }

  if (filters.semester) {
    filterParts.push({
      $or: [{ 'routingSnapshot.semester': filters.semester }, { 'applicantSnapshot.semester': filters.semester }]
    });
  }

  if (filters.division) {
    filterParts.push({
      $or: [
        { 'applicantSnapshot.division': filters.division },
        { 'studentSnapshot.division': filters.division },
        { division: filters.division }
      ]
    });
  }

  if (filters.studentId) {
    filterParts.push({ applicantType: 'student', createdBy: filters.studentId });
  }

  if (filters.facultyId) {
    filterParts.push({ applicantType: 'faculty', createdBy: filters.facultyId });
  }

  if (filters.gatepassType) {
    const normalizedGatepassType = filters.gatepassType.toLowerCase();
    if (['student', 'faculty'].includes(normalizedGatepassType)) {
      filterParts.push({ applicantType: normalizedGatepassType });
    }
  }

  if (filters.roleType && ['student', 'faculty'].includes(filters.roleType)) {
    filterParts.push({ applicantType: filters.roleType });
  }

  if (filters.status) {
    filterParts.push(getStatusBucketFilter(filters.status, true));
  }

  if (filters.vehicleMode === 'vehicle') {
    filterParts.push({ vehicleNumber: { $nin: ['', null] } });
  } else if (filters.vehicleMode === 'no_vehicle') {
    filterParts.push({ $or: [{ vehicleNumber: '' }, { vehicleNumber: null }, { vehicleNumber: { $exists: false } }] });
  }

  const approvedByIds = getApprovedByUserIds(filters.approvedById || filters.approvedBy);
  if (approvedByIds.length) {
    filterParts.push({
      $or: [
        { 'principalAction.actionBy': { $in: approvedByIds } },
        { 'hodAction.actionBy': { $in: approvedByIds } },
        { 'coordinatorAction.actionBy': { $in: approvedByIds } },
        { 'caoAction.actionBy': { $in: approvedByIds } },
        { 'securityAction.checkedOutBy': { $in: approvedByIds } },
        { 'securityAction.checkedInBy': { $in: approvedByIds } }
      ]
    });
  }

  const searchRegex = regex(filters.personSearch);
  if (searchRegex) {
    filterParts.push({
      $or: [
        { 'applicantSnapshot.fullName': searchRegex },
        { 'applicantSnapshot.email': searchRegex },
        { 'applicantSnapshot.enrollmentNo': searchRegex },
        { 'applicantSnapshot.employeeId': searchRegex },
        { gatepassId: searchRegex },
        { passNumber: searchRegex },
        { reason: searchRegex }
      ]
    });
  }

  return andFilter(...filterParts);
}

function buildFacultyLeaveDateFilter(filters) {
  if (!filters.from && !filters.to) {
    return {};
  }

  const range = {};

  if (filters.from) {
    range.$gte = filters.from;
  }

  if (filters.to) {
    range.$lte = filters.to;
  }

  return {
    $or: [
      { 'leaveDetails.leaveFrom': range },
      { 'leaveDetails.leaveTo': range },
      { 'shortLeave.leaveDate': range },
      { createdAt: range }
    ]
  };
}

function buildFacultyLeaveFilter(filters, actor) {
  const filterParts = [buildFacultyLeaveScopeFilter(actor), buildFacultyLeaveDateFilter(filters)];

  if (filters.reportType === 'pending_requests') {
    filterParts.push({ overallStatus: 'pending' });
  }

  if (filters.reportType === 'rejected_requests') {
    filterParts.push({ overallStatus: 'rejected' });
  }

  if (filters.department) {
    filterParts.push({ 'facultyDetails.department': filters.department });
  }

  if (filters.facultyId) {
    filterParts.push({ createdBy: filters.facultyId });
  }

  if (filters.status) {
    filterParts.push(getStatusBucketFilter(filters.status, false));
  }

  if (filters.leaveType) {
    filterParts.push({ 'leaveDetails.leaveType': filters.leaveType });
  }

  const loadAdjustmentRegex = regex(filters.loadAdjustmentType);
  if (loadAdjustmentRegex) {
    filterParts.push({
      $or: [
        { 'workloadAdjustments.subjectOrCourseCode': loadAdjustmentRegex },
        { 'workloadAdjustments.classOrSemester': loadAdjustmentRegex },
        { 'workloadAdjustments.adjustedFacultyName': loadAdjustmentRegex }
      ]
    });
  }

  const approvedByIds = getApprovedByUserIds(filters.approvedById || filters.approvedBy);
  if (approvedByIds.length) {
    filterParts.push({
      $or: [
        { 'hodAction.actionBy': { $in: approvedByIds } },
        { 'principalAction.actionBy': { $in: approvedByIds } },
        { 'caoAction.actionBy': { $in: approvedByIds } }
      ]
    });
  }

  const searchRegex = regex(filters.personSearch);
  if (searchRegex) {
    filterParts.push({
      $or: [
        { 'facultyDetails.name': searchRegex },
        { 'facultyDetails.emailId': searchRegex },
        { 'facultyDetails.employeeId': searchRegex },
        { requestNumber: searchRegex },
        { 'leaveDetails.reason': searchRegex },
        { 'shortLeave.reason': searchRegex }
      ]
    });
  }

  return andFilter(...filterParts);
}

function buildUserFilter(filters, actor, role) {
  const filterParts = [buildUserScopeFilter(actor, role)];

  if (filters.department) {
    filterParts.push({ department: filters.department });
  }

  if (filters.program && role === 'student') {
    filterParts.push({ program: filters.program });
  }

  if (filters.semester && role === 'student') {
    filterParts.push({ semester: filters.semester });
  }

  if (role === 'student' && filters.studentId) {
    filterParts.push({ _id: filters.studentId });
  }

  if (role !== 'student' && filters.facultyId) {
    filterParts.push({ _id: filters.facultyId });
  }

  const searchRegex = regex(filters.personSearch);
  if (searchRegex) {
    filterParts.push({
      $or: [{ fullName: searchRegex }, { email: searchRegex }, { enrollmentNo: searchRegex }, { employeeId: searchRegex }]
    });
  }

  return andFilter(...filterParts);
}

function getUserDisplayName(user) {
  return user?.fullName || user?.name || user?.email || 'Not assigned';
}

function normalizeUserMap(users) {
  return users.reduce((map, user) => {
    map.set(String(user._id), user);
    return map;
  }, new Map());
}

function getApproverName(action, userFallback = 'Not available') {
  const user = action?.actionBy;
  if (user && typeof user === 'object') {
    return getUserDisplayName(user);
  }

  return action?.status === 'approved' || action?.status === 'rejected' || action?.status === 'forwarded'
    ? userFallback
    : '';
}

function getLatestApprovedBy(gatepass) {
  const actions = [gatepass.caoAction, gatepass.coordinatorAction, gatepass.hodAction, gatepass.principalAction]
    .filter((action) => action?.actedAt)
    .sort((left, right) => new Date(right.actedAt).getTime() - new Date(left.actedAt).getTime());

  return getApproverName(actions[0]);
}

function getLatestFacultyApprover(leaveRequest) {
  const actions = [leaveRequest.caoAction, leaveRequest.principalAction, leaveRequest.hodAction]
    .filter((action) => action?.actedAt)
    .sort((left, right) => new Date(right.actedAt).getTime() - new Date(left.actedAt).getTime());

  return getApproverName(actions[0]);
}

function isApprovedGatepass(status) {
  return APPROVED_GATEPASS_STATUSES.includes(status);
}

function isRejectedGatepass(status) {
  return REJECTED_STATUS_PATTERN.test(String(status || ''));
}

function isPendingGatepass(status) {
  return PENDING_GATEPASS_STATUSES.includes(status);
}

function isOutGatepass(status) {
  return status === 'checked_out_by_security';
}

function isReturnedGatepass(status) {
  return status === 'completed';
}

function getExpectedReturnDate(gatepass) {
  if (!gatepass?.expectedReturnDate) {
    return null;
  }

  const date = new Date(gatepass.expectedReturnDate);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  if (gatepass.expectedReturnTime) {
    const [hours = '0', minutes = '0'] = String(gatepass.expectedReturnTime).split(':');
    date.setHours(Number(hours), Number(minutes), 0, 0);
  }

  return date;
}

function isLateReturn(gatepass) {
  const expectedReturn = getExpectedReturnDate(gatepass);
  const actualReturn = gatepass?.securityAction?.checkedInAt ? new Date(gatepass.securityAction.checkedInAt) : null;

  return Boolean(expectedReturn && actualReturn && actualReturn.getTime() > expectedReturn.getTime());
}

function getMostCommonReason(gatepasses) {
  const counts = new Map();

  gatepasses.forEach((gatepass) => {
    const reason = String(gatepass.reason || 'Not specified').trim() || 'Not specified';
    counts.set(reason, (counts.get(reason) || 0) + 1);
  });

  return Array.from(counts.entries()).sort((left, right) => right[1] - left[1])[0]?.[0] || '';
}

function getMonthKey(value) {
  const date = value ? new Date(value) : null;

  if (!date || Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function summarizeStudent(user, gatepasses, facultyLeaves = []) {
  const approvedCount = gatepasses.filter((item) => isApprovedGatepass(item.status)).length;
  const rejectedCount = gatepasses.filter((item) => isRejectedGatepass(item.status)).length;
  const pendingCount = gatepasses.filter((item) => isPendingGatepass(item.status)).length;
  const outCount = gatepasses.filter((item) => isOutGatepass(item.status)).length;
  const returnedCount = gatepasses.filter((item) => isReturnedGatepass(item.status)).length;
  const lateReturnCount = gatepasses.filter(isLateReturn).length;
  const lastGatepass = [...gatepasses].sort(
    (left, right) => new Date(right.outDate || right.createdAt || 0).getTime() - new Date(left.outDate || left.createdAt || 0).getTime()
  )[0];

  return {
    user,
    name: getUserDisplayName(user) || gatepasses[0]?.applicantSnapshot?.fullName || 'Unknown student',
    enrollmentNo: user?.enrollmentNo || gatepasses[0]?.applicantSnapshot?.enrollmentNo || '',
    department: user?.department || gatepasses[0]?.applicantSnapshot?.department || '',
    program: user?.program || gatepasses[0]?.applicantSnapshot?.program || '',
    semester: user?.semester || gatepasses[0]?.applicantSnapshot?.semester || '',
    division: user?.division || gatepasses[0]?.applicantSnapshot?.division || '',
    phone: user?.phone || gatepasses[0]?.applicantSnapshot?.phone || '',
    totalGatepasses: gatepasses.length,
    approvedCount,
    rejectedCount,
    pendingCount,
    outCount,
    returnedCount,
    lateReturnCount,
    totalLeaveRequests: facultyLeaves.length,
    totalLoadAdjustments: 0,
    lastGatepassDate: lastGatepass?.outDate || lastGatepass?.createdAt || null,
    mostCommonReason: getMostCommonReason(gatepasses),
    coordinatorName: ''
  };
}

function summarizeFaculty(user, gatepasses, leaveRequests) {
  const approvedCount =
    gatepasses.filter((item) => isApprovedGatepass(item.status)).length +
    leaveRequests.filter((item) => item.overallStatus === 'approved').length;
  const rejectedCount =
    gatepasses.filter((item) => isRejectedGatepass(item.status)).length +
    leaveRequests.filter((item) => item.overallStatus === 'rejected').length;
  const pendingCount =
    gatepasses.filter((item) => isPendingGatepass(item.status)).length +
    leaveRequests.filter((item) => item.overallStatus === 'pending').length;
  const lastRequest = [...gatepasses, ...leaveRequests].sort(
    (left, right) => new Date(right.updatedAt || right.createdAt || 0).getTime() - new Date(left.updatedAt || left.createdAt || 0).getTime()
  )[0];
  const firstLeave = leaveRequests[0];

  return {
    user,
    name: getUserDisplayName(user) || firstLeave?.facultyDetails?.name || gatepasses[0]?.applicantSnapshot?.fullName || 'Unknown faculty',
    employeeId: user?.employeeId || firstLeave?.facultyDetails?.employeeId || gatepasses[0]?.applicantSnapshot?.employeeId || '',
    department: user?.department || firstLeave?.facultyDetails?.department || gatepasses[0]?.applicantSnapshot?.department || '',
    role: user?.role || 'faculty',
    isCoordinator: Boolean(user?.isCoordinator || user?.coordinatorAssignment?.isCoordinator || user?.coordinatorScope?.isCoordinator),
    assignedScope: user?.coordinatorScope || user?.coordinatorAssignment || null,
    totalGatepasses: gatepasses.length,
    approvedCount,
    rejectedCount,
    pendingCount,
    leaveRequestsCount: leaveRequests.length,
    loadAdjustmentCount: leaveRequests.reduce((count, item) => count + (Array.isArray(item.workloadAdjustments) ? item.workloadAdjustments.length : 0), 0),
    lastRequestDate: lastRequest?.updatedAt || lastRequest?.createdAt || null
  };
}

function buildStudentSummaries(students, gatepasses) {
  const usersById = normalizeUserMap(students);
  const gatepassesByUserId = new Map();

  gatepasses
    .filter((item) => item.applicantType === 'student')
    .forEach((gatepass) => {
      const key = String(gatepass.createdBy?._id || gatepass.createdBy || gatepass.applicantSnapshot?.enrollmentNo || gatepass._id);
      if (!gatepassesByUserId.has(key)) {
        gatepassesByUserId.set(key, []);
      }
      gatepassesByUserId.get(key).push(gatepass);
    });

  const keys = new Set([...students.map((item) => String(item._id)), ...gatepassesByUserId.keys()]);

  return Array.from(keys).map((key) => summarizeStudent(usersById.get(key), gatepassesByUserId.get(key) || []));
}

function buildFacultySummaries(faculty, gatepasses, facultyLeaves) {
  const usersById = normalizeUserMap(faculty);
  const gatepassesByUserId = new Map();
  const leavesByUserId = new Map();

  gatepasses
    .filter((item) => item.applicantType === 'faculty')
    .forEach((gatepass) => {
      const key = String(gatepass.createdBy?._id || gatepass.createdBy || gatepass.applicantSnapshot?.employeeId || gatepass._id);
      if (!gatepassesByUserId.has(key)) {
        gatepassesByUserId.set(key, []);
      }
      gatepassesByUserId.get(key).push(gatepass);
    });

  facultyLeaves.forEach((request) => {
    const key = String(request.createdBy?._id || request.createdBy || request.facultyDetails?.employeeId || request._id);
    if (!leavesByUserId.has(key)) {
      leavesByUserId.set(key, []);
    }
    leavesByUserId.get(key).push(request);
  });

  const keys = new Set([...faculty.map((item) => String(item._id)), ...gatepassesByUserId.keys(), ...leavesByUserId.keys()]);

  return Array.from(keys).map((key) =>
    summarizeFaculty(usersById.get(key), gatepassesByUserId.get(key) || [], leavesByUserId.get(key) || [])
  );
}

function buildDashboardSummary(gatepasses, facultyLeaves, filters, generatedBy) {
  return {
    totalGatepasses: gatepasses.length,
    totalApproved:
      gatepasses.filter((item) => isApprovedGatepass(item.status)).length +
      facultyLeaves.filter((item) => item.overallStatus === 'approved').length,
    totalRejected:
      gatepasses.filter((item) => isRejectedGatepass(item.status)).length +
      facultyLeaves.filter((item) => item.overallStatus === 'rejected').length,
    totalPending:
      gatepasses.filter((item) => isPendingGatepass(item.status)).length +
      facultyLeaves.filter((item) => item.overallStatus === 'pending').length,
    totalOut:
      gatepasses.filter((item) => isOutGatepass(item.status)).length +
      facultyLeaves.filter((item) => item.securityAction?.checkedOutAt && !item.securityAction?.checkedInAt).length,
    totalReturned:
      gatepasses.filter((item) => isReturnedGatepass(item.status)).length +
      facultyLeaves.filter((item) => item.securityAction?.checkedInAt).length,
    totalLateReturns: gatepasses.filter(isLateReturn).length,
    totalFacultyRequests: gatepasses.filter((item) => item.applicantType === 'faculty').length + facultyLeaves.length,
    totalStudentRequests: gatepasses.filter((item) => item.applicantType === 'student').length,
    totalLeaveRequests: facultyLeaves.length,
    totalLoadAdjustments: facultyLeaves.reduce((count, item) => count + (Array.isArray(item.workloadAdjustments) ? item.workloadAdjustments.length : 0), 0),
    dateRangeUsed: `${filters.from ? filters.from.toISOString().slice(0, 10) : 'Start'} to ${filters.to ? filters.to.toISOString().slice(0, 10) : 'Now'}`,
    generatedBy: getUserDisplayName(generatedBy),
    generatedAt: new Date()
  };
}

function buildDepartmentAnalytics(students, faculty, gatepasses) {
  return DEPARTMENTS.map((department) => {
    const departmentStudents = students.filter((item) => item.department === department);
    const departmentFaculty = faculty.filter((item) => item.department === department);
    const departmentGatepasses = gatepasses.filter(
      (item) => item.applicantSnapshot?.department === department || item.routingSnapshot?.department === department
    );
    const approved = departmentGatepasses.filter((item) => isApprovedGatepass(item.status)).length;
    const rejected = departmentGatepasses.filter((item) => isRejectedGatepass(item.status)).length;
    const pending = departmentGatepasses.filter((item) => isPendingGatepass(item.status)).length;
    const out = departmentGatepasses.filter((item) => isOutGatepass(item.status)).length;
    const returned = departmentGatepasses.filter((item) => isReturnedGatepass(item.status)).length;

    return {
      department,
      totalStudents: departmentStudents.length,
      totalFaculty: departmentFaculty.length,
      totalGatepasses: departmentGatepasses.length,
      totalApproved: approved,
      totalRejected: rejected,
      totalPending: pending,
      totalOut: out,
      totalReturned: returned,
      avgGatepassesPerStudent: departmentStudents.length
        ? departmentGatepasses.filter((item) => item.applicantType === 'student').length / departmentStudents.length
        : 0,
      avgGatepassesPerFaculty: departmentFaculty.length
        ? departmentGatepasses.filter((item) => item.applicantType === 'faculty').length / departmentFaculty.length
        : 0
    };
  });
}

function buildMonthlyTrend(gatepasses, facultyLeaves) {
  const trendMap = new Map();

  function ensureMonth(month) {
    if (!trendMap.has(month)) {
      trendMap.set(month, {
        month,
        studentGatepasses: 0,
        facultyGatepasses: 0,
        leaveRequests: 0,
        loadAdjustments: 0,
        approved: 0,
        rejected: 0,
        pending: 0
      });
    }

    return trendMap.get(month);
  }

  gatepasses.forEach((gatepass) => {
    const item = ensureMonth(getMonthKey(gatepass.outDate || gatepass.createdAt));
    if (gatepass.applicantType === 'student') {
      item.studentGatepasses += 1;
    } else {
      item.facultyGatepasses += 1;
    }

    if (isApprovedGatepass(gatepass.status)) item.approved += 1;
    if (isRejectedGatepass(gatepass.status)) item.rejected += 1;
    if (isPendingGatepass(gatepass.status)) item.pending += 1;
  });

  facultyLeaves.forEach((request) => {
    const item = ensureMonth(getMonthKey(request.leaveDetails?.leaveFrom || request.createdAt));
    item.leaveRequests += 1;
    item.loadAdjustments += Array.isArray(request.workloadAdjustments) ? request.workloadAdjustments.length : 0;
    if (request.overallStatus === 'approved') item.approved += 1;
    if (request.overallStatus === 'rejected') item.rejected += 1;
    if (request.overallStatus === 'pending') item.pending += 1;
  });

  return Array.from(trendMap.values()).sort((left, right) => left.month.localeCompare(right.month));
}

function buildInsights(studentSummaries, departmentAnalytics, gatepasses, facultySummaries) {
  const topGatepassUsers = [...studentSummaries]
    .filter((item) => item.totalGatepasses > 0)
    .sort((left, right) => right.totalGatepasses - left.totalGatepasses)
    .slice(0, 10);
  const busiestDepartment = [...departmentAnalytics].sort((left, right) => right.totalGatepasses - left.totalGatepasses)[0] || null;
  const mostActiveCoordinator =
    [...facultySummaries]
      .filter((item) => item.isCoordinator)
      .sort((left, right) => right.approvedCount + right.pendingCount - (left.approvedCount + left.pendingCount))[0] || null;
  const dayCounts = gatepasses.reduce((map, gatepass) => {
    const key = gatepass.outDate ? new Date(gatepass.outDate).toLocaleDateString('en-IN', { weekday: 'long' }) : 'Unknown';
    map.set(key, (map.get(key) || 0) + 1);
    return map;
  }, new Map());
  const peakDay = Array.from(dayCounts.entries()).sort((left, right) => right[1] - left[1])[0] || null;

  return {
    topGatepassUsers,
    busiestDepartment,
    mostActiveCoordinator,
    peakRequestDay: peakDay ? { day: peakDay[0], count: peakDay[1] } : null
  };
}

function toActorSnapshot(user) {
  return {
    id: String(user?._id || user?.id || ''),
    name: user?.fullName || user?.name || '',
    email: user?.email || '',
    role: user?.role || '',
    department: user?.department || '',
    employeeId: user?.employeeId || '',
    enrollmentNo: user?.enrollmentNo || ''
  };
}

function getFacultyRoleFilter() {
  return {
    $in: ['faculty', 'principal', 'hod', 'cao']
  };
}

async function fetchReportDataset(actor, inputFilters = {}) {
  const filters = parseReportFilters(inputFilters);

  if (!canExportReport(actor, filters.reportType)) {
    throw new AppError('You do not have permission to export this report.', 403);
  }

  const gatepassFilter = includeGatepasses(filters.reportType) ? buildGatepassFilter(filters, actor) : impossibleFilter();
  const facultyLeaveFilter = includeFacultyLeaves(filters.reportType) ? buildFacultyLeaveFilter(filters, actor) : impossibleFilter();
  const studentFilter = buildUserFilter(filters, actor, 'student');
  const facultyFilter = buildUserFilter(filters, actor, getFacultyRoleFilter());
  const gatepassPopulateFields = [
    {
      path: 'createdBy',
      select: 'fullName email role department program semester enrollmentNo employeeId phone isCoordinator coordinatorAssignment coordinatorScope permissions'
    },
    { path: 'principalAction.actionBy', select: 'fullName role employeeId' },
    { path: 'hodAction.actionBy', select: 'fullName role employeeId' },
    { path: 'coordinatorAction.actionBy', select: 'fullName role employeeId' },
    { path: 'caoAction.actionBy', select: 'fullName role employeeId' },
    { path: 'securityAction.checkedOutBy', select: 'fullName role employeeId' },
    { path: 'securityAction.checkedInBy', select: 'fullName role employeeId' }
  ];

  const [gatepasses, facultyLeaves, students, faculty] = await Promise.all([
    includeGatepasses(filters.reportType)
      ? Gatepass.find(gatepassFilter)
          .populate(gatepassPopulateFields)
          .sort({ outDate: -1, createdAt: -1 })
          .limit(MAX_EXPORT_RECORDS)
          .lean()
      : [],
    includeFacultyLeaves(filters.reportType)
      ? FacultyLeaveRequest.find(facultyLeaveFilter)
          .populate([
            {
              path: 'createdBy',
              select: 'fullName email role department employeeId phone isCoordinator coordinatorAssignment coordinatorScope permissions'
            },
            { path: 'hodAction.actionBy', select: 'fullName role employeeId' },
            { path: 'principalAction.actionBy', select: 'fullName role employeeId' },
            { path: 'caoAction.actionBy', select: 'fullName role employeeId' },
            { path: 'securityAction.checkedOutBy', select: 'fullName role employeeId' },
            { path: 'securityAction.checkedInBy', select: 'fullName role employeeId' }
          ])
          .sort({ createdAt: -1 })
          .limit(MAX_EXPORT_RECORDS)
          .lean()
      : [],
    User.find(studentFilter)
      .select('fullName email role program department semester enrollmentNo phone coordinatorAssignment coordinatorScope isCoordinator permissions')
      .sort({ fullName: 1 })
      .limit(MAX_EXPORT_RECORDS)
      .lean(),
    User.find(facultyFilter)
      .select('fullName email role department employeeId phone coordinatorAssignment coordinatorScope isCoordinator permissions')
      .sort({ fullName: 1 })
      .limit(MAX_EXPORT_RECORDS)
      .lean()
  ]);

  const studentSummaries = buildStudentSummaries(students, gatepasses);
  const facultySummaries = buildFacultySummaries(faculty, gatepasses, facultyLeaves);
  const departmentAnalytics = buildDepartmentAnalytics(students, faculty, gatepasses);
  const monthlyTrend = buildMonthlyTrend(gatepasses, facultyLeaves);
  const dashboardSummary = buildDashboardSummary(gatepasses, facultyLeaves, filters, actor);
  const insights = buildInsights(studentSummaries, departmentAnalytics, gatepasses, facultySummaries);
  const publicFilters = publicFilterSummary(filters);

  return {
    access: getAdminAccessProfile(actor),
    actor: toActorSnapshot(actor),
    filters,
    publicFilters,
    generatedAt: new Date(),
    gatepasses,
    facultyLeaves,
    students,
    faculty,
    studentSummaries,
    facultySummaries,
    dashboardSummary,
    departmentAnalytics,
    monthlyTrend,
    insights,
    recordCount: gatepasses.length + facultyLeaves.length
  };
}

async function getReportPreview(actor, inputFilters = {}) {
  const dataset = await fetchReportDataset(actor, inputFilters);

  return {
    access: dataset.access,
    filters: dataset.publicFilters,
    recordCount: dataset.recordCount,
    summary: dataset.dashboardSummary,
    topStudents: dataset.insights.topGatepassUsers.slice(0, 5),
    busiestDepartment: dataset.insights.busiestDepartment,
    monthlyTrend: dataset.monthlyTrend.slice(-6),
    empty: dataset.recordCount === 0
  };
}

async function getExportOptions(actor, query = {}) {
  const access = getAdminAccessProfile(actor);
  const q = String(query.q || '').trim();
  const filters = parseReportFilters({
    reportType: query.reportType || 'all_gatepasses',
    department: query.department,
    semester: query.semester,
    personSearch: q
  });
  const studentFilter = buildUserFilter(filters, actor, 'student');
  const facultyFilter = buildUserFilter(filters, actor, getFacultyRoleFilter());
  const [students, faculty] = await Promise.all([
    User.find(studentFilter)
      .select('fullName enrollmentNo department program semester')
      .sort({ fullName: 1 })
      .limit(MAX_OPTION_PEOPLE)
      .lean(),
    User.find(facultyFilter)
      .select('fullName employeeId department role isCoordinator coordinatorAssignment coordinatorScope')
      .sort({ fullName: 1 })
      .limit(MAX_OPTION_PEOPLE)
      .lean()
  ]);

  return {
    access,
    reportTypes: [
      { value: 'all_gatepasses', label: 'All Gatepasses Report', allowed: canExportReport(actor, 'all_gatepasses') },
      { value: 'student_report', label: 'Student Report', allowed: canExportReport(actor, 'student_report') },
      { value: 'faculty_report', label: 'Faculty Report', allowed: canExportReport(actor, 'faculty_report') },
      { value: 'department_wise_report', label: 'Department-wise Report', allowed: canExportReport(actor, 'department_wise_report') },
      { value: 'monthly_report', label: 'Monthly Report', allowed: canExportReport(actor, 'monthly_report') },
      { value: 'daily_report', label: 'Daily Report', allowed: canExportReport(actor, 'daily_report') },
      { value: 'custom_date_range', label: 'Custom Date Range Report', allowed: canExportReport(actor, 'custom_date_range') },
      { value: 'approval_report', label: 'Approval Report', allowed: canExportReport(actor, 'approval_report') },
      { value: 'pending_requests', label: 'Pending Requests Report', allowed: canExportReport(actor, 'pending_requests') },
      { value: 'rejected_requests', label: 'Rejected Requests Report', allowed: canExportReport(actor, 'rejected_requests') },
      { value: 'out_returned_status', label: 'Out/Returned Status Report', allowed: canExportReport(actor, 'out_returned_status') },
      { value: 'leave_report', label: 'Leave Report', allowed: canExportReport(actor, 'leave_report') },
      { value: 'load_adjustment_report', label: 'Load Adjustment Report', allowed: canExportReport(actor, 'load_adjustment_report') },
      { value: 'coordinator_scope_report', label: 'Coordinator Scope Report', allowed: canExportReport(actor, 'coordinator_scope_report') },
      { value: 'individual_student_history', label: 'Individual Student Full History', allowed: canExportReport(actor, 'individual_student_history') },
      { value: 'individual_faculty_history', label: 'Individual Faculty Full History', allowed: canExportReport(actor, 'individual_faculty_history') }
    ],
    filters: {
      departments: DEPARTMENTS,
      routingDepartments: ROUTING_DEPARTMENTS,
      semesters: SEMESTERS,
      programs: STUDENT_PROGRAMS,
      statuses: ['all', 'pending', 'approved', 'rejected', 'out', 'returned'],
      datePresets: ['today', 'this_week', 'this_month', 'last_month', 'custom'],
      exportModes: ['summary', 'individual', 'per_student'],
      vehicleModes: ['all', 'vehicle', 'no_vehicle']
    },
    people: {
      students: students.map((student) => ({
        id: String(student._id),
        label: `${student.fullName} (${student.enrollmentNo || 'No enrollment'})`,
        department: student.department,
        program: student.program,
        semester: student.semester
      })),
      faculty: faculty.map((item) => ({
        id: String(item._id),
        label: `${item.fullName} (${item.employeeId || item.role})`,
        department: item.department,
        role: item.role,
        isCoordinator: Boolean(item.isCoordinator || item.coordinatorAssignment?.isCoordinator || item.coordinatorScope?.isCoordinator)
      }))
    }
  };
}

module.exports = {
  fetchReportDataset,
  getExportOptions,
  getLatestApprovedBy,
  getLatestFacultyApprover,
  getReportPreview,
  isApprovedGatepass,
  isLateReturn,
  isOutGatepass,
  isPendingGatepass,
  isRejectedGatepass,
  isReturnedGatepass
};
