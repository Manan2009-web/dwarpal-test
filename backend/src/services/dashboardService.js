const Gatepass = require('../models/Gatepass');
const FacultyLeaveRequest = require('../models/FacultyLeaveRequest');
const { APPROVED_GATEPASS_STATUSES } = require('../constants/appConstants');

const gatepassRecentProjection =
  '_id passNumber applicantType applicantSnapshot.fullName applicantSnapshot.department status currentApprovalLevel outDate outTime createdAt updatedAt';
const facultyLeaveRecentProjection =
  '_id requestNumber facultyDetails.name facultyDetails.department overallStatus workloadStatus shortLeaveStatus securityAction.checkedOutAt securityAction.checkedInAt createdAt updatedAt';

function buildTodayRange() {
  const today = new Date();
  const start = new Date(today);
  const end = new Date(today);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function mapRecentGatepass(item) {
  return {
    id: item._id?.toString?.() || item.id,
    recordType: 'student_gatepass',
    referenceNumber: item.passNumber,
    applicantType: item.applicantType,
    applicantName: item.applicantSnapshot?.fullName || null,
    department: item.applicantSnapshot?.department || null,
    status: item.status,
    currentApprovalLevel: item.currentApprovalLevel || null,
    outDate: item.outDate,
    outTime: item.outTime,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
}

function mapRecentFacultyLeave(item) {
  return {
    id: item._id?.toString?.() || item.id,
    recordType: 'faculty_leave_request',
    referenceNumber: item.requestNumber,
    applicantType: 'faculty',
    applicantName: item.facultyDetails?.name || null,
    department: item.facultyDetails?.department || null,
    status: item.overallStatus,
    workloadStatus: item.workloadStatus,
    shortLeaveStatus: item.shortLeaveStatus,
    checkedOutAt: item.securityAction?.checkedOutAt || null,
    checkedInAt: item.securityAction?.checkedInAt || null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
}

async function getRecentGatepasses(filter, limit = 5) {
  const items = await Gatepass.find(filter)
    .select(gatepassRecentProjection)
    .sort({ updatedAt: -1, _id: -1 })
    .limit(limit)
    .lean();

  return items.map(mapRecentGatepass);
}

async function getRecentFacultyLeaves(filter, limit = 5) {
  const items = await FacultyLeaveRequest.find(filter)
    .select(facultyLeaveRecentProjection)
    .sort({ updatedAt: -1, _id: -1 })
    .limit(limit)
    .lean();

  return items.map(mapRecentFacultyLeave);
}

function mergeRecentItems(first = [], second = [], limit = 5) {
  return [...first, ...second]
    .sort((left, right) => new Date(right.updatedAt || right.createdAt) - new Date(left.updatedAt || left.createdAt))
    .slice(0, limit);
}

function getNowFilterConditions() {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const currentTimeString = `${hours}:${minutes}`;

  const outdatedFilter = {
    $or: [
      { outDate: { $lt: startOfToday } },
      { outDate: { $gte: startOfToday, $lte: endOfToday }, outTime: { $lt: currentTimeString } }
    ]
  };

  const activeTimeFilter = {
    $or: [
      { outDate: { $gt: endOfToday } },
      { outDate: { $gte: startOfToday, $lte: endOfToday }, outTime: { $gte: currentTimeString } }
    ]
  };

  return { now, startOfToday, endOfToday, currentTimeString, outdatedFilter, activeTimeFilter };
}

async function getDashboardSummary(user) {
  const { startOfToday, endOfToday, outdatedFilter, activeTimeFilter } = getNowFilterConditions();

  if (user.role === 'student') {
    const baseFilter = { createdBy: user._id };
    const [totalPasses, pending, forwarded, approved, rejected, outdated, recentRequests] = await Promise.all([
      Gatepass.countDocuments(baseFilter),
      Gatepass.countDocuments({
        ...baseFilter,
        status: 'pending_principal',
        ...activeTimeFilter
      }),
      Gatepass.countDocuments({
        ...baseFilter,
        status: { $in: ['forwarded_to_hod', 'forwarded_to_coordinator', 'forwarded_to_campus_security', 'forwarded_to_chairman', 'pending_cao'] },
        ...activeTimeFilter
      }),
      Gatepass.countDocuments({
        ...baseFilter,
        status: { $in: [...APPROVED_GATEPASS_STATUSES, 'checked_out_by_security', 'completed'] }
      }),
      Gatepass.countDocuments({
        ...baseFilter,
        status: { $in: ['rejected_by_principal', 'rejected_by_hod', 'rejected_by_coordinator', 'rejected_by_cao'] }
      }),
      Gatepass.countDocuments({
        ...baseFilter,
        status: { $in: ['pending_principal', 'forwarded_to_hod', 'forwarded_to_coordinator', 'forwarded_to_campus_security', 'forwarded_to_chairman', 'pending_cao', ...APPROVED_GATEPASS_STATUSES] },
        ...outdatedFilter
      }),
      getRecentGatepasses(baseFilter)
    ]);

    return {
      role: user.role,
      stats: {
        totalPasses,
        pending,
        forwarded,
        approved,
        rejected,
        outdated
      },
      recentRequests
    };
  }

  if (user.role === 'faculty') {
    const baseFilter = { createdBy: user._id };
    const isCoordinator = Boolean(user.coordinatorAssignment?.isCoordinator);
    const [totalRequests, pending, approved, rejected, recentRequests, coordinatorPending, coordinatorApproved, coordinatorRejected, coordinatorOutdated, coordinatorRecentActions] = await Promise.all([
      FacultyLeaveRequest.countDocuments(baseFilter),
      FacultyLeaveRequest.countDocuments({ ...baseFilter, overallStatus: 'pending' }),
      FacultyLeaveRequest.countDocuments({ ...baseFilter, overallStatus: 'approved' }),
      FacultyLeaveRequest.countDocuments({ ...baseFilter, overallStatus: 'rejected' }),
      getRecentFacultyLeaves(baseFilter),
      isCoordinator
        ? Gatepass.countDocuments({
            applicantType: 'student',
            status: 'forwarded_to_coordinator',
            forwardedTo: user._id,
            ...activeTimeFilter
          })
        : Promise.resolve(0),
      isCoordinator
        ? Gatepass.countDocuments({
            applicantType: 'student',
            status: 'approved_by_coordinator',
            'coordinatorAction.actionBy': user._id
          })
        : Promise.resolve(0),
      isCoordinator
        ? Gatepass.countDocuments({
            applicantType: 'student',
            status: 'rejected_by_coordinator',
            'coordinatorAction.actionBy': user._id
          })
        : Promise.resolve(0),
      isCoordinator
        ? Gatepass.countDocuments({
            applicantType: 'student',
            status: 'forwarded_to_coordinator',
            forwardedTo: user._id,
            ...outdatedFilter
          })
        : Promise.resolve(0),
      isCoordinator
        ? getRecentGatepasses({
            applicantType: 'student',
            $or: [{ forwardedTo: user._id }, { 'coordinatorAction.actionBy': user._id }]
          })
        : Promise.resolve([])
    ]);

    return {
      role: user.role,
      stats: {
        totalRequests,
        totalPasses: totalRequests,
        pending,
        approved,
        rejected,
        outdated: 0,
        coordinatorPending,
        coordinatorApproved,
        coordinatorRejected,
        coordinatorOutdated,
        coordinatorEnabled: isCoordinator
      },
      recentRequests: mergeRecentItems(recentRequests, coordinatorRecentActions)
    };
  }

  if (user.role === 'principal') {
    const [
      pendingStudentRequests,
      pendingFacultyRequests,
      forwardedCount,
      approvedStudentCount,
      approvedFacultyCount,
      rejectedStudentCount,
      rejectedFacultyCount,
      outdatedStudentCount,
      recentStudentActions,
      recentFacultyActions
    ] = await Promise.all([
      // Only direct pending requests that are NOT forwarded and NOT outdated
      Gatepass.countDocuments({
        applicantType: 'student',
        status: 'pending_principal',
        ...activeTimeFilter
      }),
      FacultyLeaveRequest.countDocuments({ shortLeaveStatus: 'pending_principal' }),
      // Forwarded requests that are NOT outdated
      Gatepass.countDocuments({
        applicantType: 'student',
        status: { $in: ['forwarded_to_hod', 'forwarded_to_coordinator', 'forwarded_to_campus_security', 'forwarded_to_chairman'] },
        ...activeTimeFilter
      }),
      Gatepass.countDocuments({
        applicantType: 'student',
        status: { $in: [...APPROVED_GATEPASS_STATUSES, 'checked_out_by_security', 'completed'] }
      }),
      FacultyLeaveRequest.countDocuments({ 'principalAction.status': 'approved' }),
      Gatepass.countDocuments({ applicantType: 'student', status: 'rejected_by_principal' }),
      FacultyLeaveRequest.countDocuments({ shortLeaveStatus: 'rejected_by_principal' }),
      // Outdated uncompleted student gatepasses
      Gatepass.countDocuments({
        applicantType: 'student',
        status: { $in: ['pending_principal', 'forwarded_to_hod', 'forwarded_to_coordinator', 'forwarded_to_campus_security', 'forwarded_to_chairman', ...APPROVED_GATEPASS_STATUSES] },
        ...outdatedFilter
      }),
      getRecentGatepasses({
        applicantType: 'student',
        'principalAction.actionBy': user._id
      }),
      getRecentFacultyLeaves({
        'principalAction.actionBy': user._id
      })
    ]);

    const pendingRequests = pendingStudentRequests + pendingFacultyRequests;
    const approvedCount = approvedStudentCount + approvedFacultyCount;
    const rejectedCount = rejectedStudentCount + rejectedFacultyCount;

    return {
      role: user.role,
      stats: {
        pendingRequests,
        pending: pendingRequests,
        pendingStudentRequests,
        pendingFacultyRequests,
        forwardedCount,
        forwarded: forwardedCount,
        approvedCount,
        approved: approvedCount,
        approvedDirectCount: approvedCount,
        finalApprovedCount: approvedCount,
        rejectedCount,
        rejected: rejectedCount,
        outdatedCount: outdatedStudentCount,
        outdated: outdatedStudentCount
      },
      recentActions: mergeRecentItems(recentStudentActions, recentFacultyActions)
    };
  }

  if (user.role === 'hod') {
    const studentBaseFilter = { applicantType: 'student', forwardedTo: user._id };
    const facultyBaseFilter = { hodReviewer: user._id };
    const [
      pendingStudentReviews,
      pendingFacultyReviews,
      handledStudentCount,
      handledFacultyCount,
      approvedStudentCount,
      approvedFacultyCount,
      rejectedStudentCount,
      rejectedFacultyCount,
      outdatedStudentCount,
      recentStudentActions,
      recentFacultyActions
    ] = await Promise.all([
      Gatepass.countDocuments({ ...studentBaseFilter, status: 'forwarded_to_hod', ...activeTimeFilter }),
      FacultyLeaveRequest.countDocuments({ ...facultyBaseFilter, workloadStatus: 'pending_hod' }),
      Gatepass.countDocuments({
        ...studentBaseFilter,
        'hodAction.status': { $in: ['approved', 'rejected'] }
      }),
      FacultyLeaveRequest.countDocuments({
        ...facultyBaseFilter,
        'hodAction.status': { $in: ['approved', 'rejected'] }
      }),
      Gatepass.countDocuments({ ...studentBaseFilter, status: 'approved_by_hod' }),
      FacultyLeaveRequest.countDocuments({ ...facultyBaseFilter, workloadStatus: 'approved_by_hod' }),
      Gatepass.countDocuments({ ...studentBaseFilter, status: 'rejected_by_hod' }),
      FacultyLeaveRequest.countDocuments({ ...facultyBaseFilter, workloadStatus: 'rejected_by_hod' }),
      Gatepass.countDocuments({ ...studentBaseFilter, status: 'forwarded_to_hod', ...outdatedFilter }),
      getRecentGatepasses({
        ...studentBaseFilter,
        'hodAction.status': { $ne: 'not_required' }
      }),
      getRecentFacultyLeaves({
        ...facultyBaseFilter,
        'hodAction.status': { $ne: 'pending' }
      })
    ]);

    const pendingReviews = pendingStudentReviews + pendingFacultyReviews;
    const totalHandled = handledStudentCount + handledFacultyCount;
    const approvedCount = approvedStudentCount + approvedFacultyCount;
    const rejectedCount = rejectedStudentCount + rejectedFacultyCount;

    return {
      role: user.role,
      stats: {
        pendingReviews,
        pending: pendingReviews,
        pendingForwardedRequests: pendingReviews,
        totalHandled,
        handled: totalHandled,
        approvedCount,
        approved: approvedCount,
        approvedByHod: approvedCount,
        rejectedCount,
        rejected: rejectedCount,
        rejectedByHod: rejectedCount,
        outdatedCount: outdatedStudentCount,
        outdated: outdatedStudentCount
      },
      recentActions: mergeRecentItems(recentStudentActions, recentFacultyActions)
    };
  }

  if (user.role === 'chairman') {
    const [pending, approved, rejected, outdated, recentActions] = await Promise.all([
      Gatepass.countDocuments({
        applicantType: 'student',
        status: 'forwarded_to_chairman',
        ...activeTimeFilter
      }),
      Gatepass.countDocuments({
        applicantType: 'student',
        status: 'approved_by_chairman',
        'chairmanAction.actionBy': user._id
      }),
      Gatepass.countDocuments({
        applicantType: 'student',
        status: 'rejected_by_chairman',
        'chairmanAction.actionBy': user._id
      }),
      Gatepass.countDocuments({
        applicantType: 'student',
        status: 'forwarded_to_chairman',
        ...outdatedFilter
      }),
      getRecentGatepasses({
        applicantType: 'student',
        $or: [{ forwardedTo: user._id }, { forwardedToRole: 'chairman' }, { 'chairmanAction.actionBy': user._id }]
      })
    ]);

    return {
      role: user.role,
      stats: {
        pending,
        approved,
        rejected,
        outdated,
        total: pending + approved + rejected + outdated
      },
      recentActions
    };
  }

  if (user.role === 'campus_security') {
    const [pending, cleared, outdated, recentActions] = await Promise.all([
      Gatepass.countDocuments({
        applicantType: 'student',
        status: 'forwarded_to_campus_security',
        ...activeTimeFilter
      }),
      Gatepass.countDocuments({
        applicantType: 'student',
        'securityAction.campusCleared': true
      }),
      Gatepass.countDocuments({
        applicantType: 'student',
        status: 'forwarded_to_campus_security',
        ...outdatedFilter
      }),
      getRecentGatepasses({
        applicantType: 'student',
        status: { $in: ['forwarded_to_campus_security', ...APPROVED_GATEPASS_STATUSES, 'checked_out_by_security', 'completed'] }
      })
    ]);

    return {
      role: user.role,
      stats: {
        pending,
        cleared,
        outdated,
        total: pending + cleared + outdated
      },
      recentActions
    };
  }

  if (user.role === 'cao') {
    const baseFilter = { caoReviewer: user._id };
    const [pendingFacultyRequests, approvedByCao, rejectedByCao, recentActions] = await Promise.all([
      FacultyLeaveRequest.countDocuments({ ...baseFilter, shortLeaveStatus: 'pending_cao' }),
      FacultyLeaveRequest.countDocuments({ ...baseFilter, shortLeaveStatus: 'approved' }),
      FacultyLeaveRequest.countDocuments({ ...baseFilter, shortLeaveStatus: 'rejected_by_cao' }),
      getRecentFacultyLeaves({
        ...baseFilter,
        shortLeaveStatus: { $in: ['pending_cao', 'approved', 'rejected_by_cao'] }
      })
    ]);

    return {
      role: user.role,
      stats: {
        totalRequests: pendingFacultyRequests + approvedByCao + rejectedByCao,
        total: pendingFacultyRequests + approvedByCao + rejectedByCao,
        pendingFacultyRequests,
        pending: pendingFacultyRequests,
        approvedByCao,
        approved: approvedByCao,
        rejectedByCao,
        rejected: rejectedByCao,
        outdated: 0
      },
      recentActions
    };
  }

  const { start, end } = buildTodayRange();
  const approvedFacultyDateFilter = {
    $or: [
      { 'shortLeave.leaveDate': { $gte: start, $lte: end } },
      { 'leaveDetails.leaveFrom': { $gte: start, $lte: end } }
    ]
  };
  const [readyStudentGatepasses, readyFacultyGatepasses, checkedOutStudentToday, checkedOutFacultyToday, completedStudentToday, completedFacultyToday, outdatedStudentToday, recentStudentVerifications, recentFacultyVerifications] =
    await Promise.all([
      Gatepass.countDocuments({
        status: { $in: APPROVED_GATEPASS_STATUSES },
        outDate: { $gte: start, $lte: end }
      }),
      FacultyLeaveRequest.countDocuments({
        overallStatus: 'approved',
        'securityAction.checkedOutAt': null,
        ...approvedFacultyDateFilter
      }),
      Gatepass.countDocuments({
        status: 'checked_out_by_security',
        'securityAction.checkedOutAt': { $gte: start, $lte: end }
      }),
      FacultyLeaveRequest.countDocuments({
        overallStatus: 'approved',
        'securityAction.checkedOutAt': { $gte: start, $lte: end }
      }),
      Gatepass.countDocuments({
        status: 'completed',
        'securityAction.checkedInAt': { $gte: start, $lte: end }
      }),
      FacultyLeaveRequest.countDocuments({
        overallStatus: 'approved',
        'securityAction.checkedInAt': { $gte: start, $lte: end }
      }),
      Gatepass.countDocuments({
        status: { $in: APPROVED_GATEPASS_STATUSES },
        outDate: { $lt: startOfToday }
      }),
      getRecentGatepasses({
        status: { $in: [...APPROVED_GATEPASS_STATUSES, 'checked_out_by_security', 'completed'] }
      }),
      getRecentFacultyLeaves({
        overallStatus: 'approved'
      })
    ]);

  const readyForVerificationToday = readyStudentGatepasses + readyFacultyGatepasses;
  const checkedOutToday = checkedOutStudentToday + checkedOutFacultyToday;
  const completedToday = completedStudentToday + completedFacultyToday;
  const recentVerifications = mergeRecentItems(recentStudentVerifications, recentFacultyVerifications);

  return {
    role: user.role,
    stats: {
      readyForVerificationToday,
      ready: readyForVerificationToday,
      checkedOutToday,
      out: checkedOutToday,
      completedToday,
      returned: completedToday,
      outdated: outdatedStudentToday
    },
    recentVerifications
  };
}

module.exports = {
  getDashboardSummary
};
