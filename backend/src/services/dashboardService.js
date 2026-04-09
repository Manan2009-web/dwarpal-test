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

async function getDashboardSummary(user) {
  if (user.role === 'student') {
    const baseFilter = { createdBy: user._id };
    const [totalPasses, pending, approved, rejected, cancelled, recentRequests] = await Promise.all([
      Gatepass.countDocuments(baseFilter),
      Gatepass.countDocuments({
        ...baseFilter,
        status: { $in: ['pending_principal', 'forwarded_to_hod', 'pending_cao'] }
      }),
      Gatepass.countDocuments({
        ...baseFilter,
        status: { $in: [...APPROVED_GATEPASS_STATUSES, 'checked_out_by_security', 'completed'] }
      }),
      Gatepass.countDocuments({
        ...baseFilter,
        status: { $in: ['rejected_by_principal', 'rejected_by_hod', 'rejected_by_cao'] }
      }),
      Gatepass.countDocuments({
        ...baseFilter,
        status: 'cancelled'
      }),
      getRecentGatepasses(baseFilter)
    ]);

    return {
      role: user.role,
      stats: {
        totalPasses,
        pending,
        approved,
        rejected,
        cancelled
      },
      recentRequests
    };
  }

  if (user.role === 'faculty') {
    const baseFilter = { createdBy: user._id };
    const [totalRequests, pending, approved, rejected, recentRequests] = await Promise.all([
      FacultyLeaveRequest.countDocuments(baseFilter),
      FacultyLeaveRequest.countDocuments({ ...baseFilter, overallStatus: 'pending' }),
      FacultyLeaveRequest.countDocuments({ ...baseFilter, overallStatus: 'approved' }),
      FacultyLeaveRequest.countDocuments({ ...baseFilter, overallStatus: 'rejected' }),
      getRecentFacultyLeaves(baseFilter)
    ]);

    return {
      role: user.role,
      stats: {
        totalRequests,
        totalPasses: totalRequests,
        pending,
        approved,
        rejected,
        cancelled: 0
      },
      recentRequests
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
      recentStudentActions,
      recentFacultyActions
    ] = await Promise.all([
      Gatepass.countDocuments({ applicantType: 'student', status: 'pending_principal' }),
      FacultyLeaveRequest.countDocuments({ shortLeaveStatus: 'pending_principal' }),
      Gatepass.countDocuments({ applicantType: 'student', status: 'forwarded_to_hod' }),
      Gatepass.countDocuments({ applicantType: 'student', status: 'approved_final' }),
      FacultyLeaveRequest.countDocuments({ 'principalAction.status': 'approved' }),
      Gatepass.countDocuments({ applicantType: 'student', status: 'rejected_by_principal' }),
      FacultyLeaveRequest.countDocuments({ shortLeaveStatus: 'rejected_by_principal' }),
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
        pendingStudentRequests,
        pendingFacultyRequests,
        forwardedCount,
        approvedCount,
        approvedDirectCount: approvedCount,
        finalApprovedCount: approvedCount,
        rejectedCount
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
      recentStudentActions,
      recentFacultyActions
    ] = await Promise.all([
      Gatepass.countDocuments({ ...studentBaseFilter, status: 'forwarded_to_hod' }),
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
        pendingForwardedRequests: pendingReviews,
        totalHandled,
        approvedCount,
        approvedByHod: approvedCount,
        rejectedCount,
        rejectedByHod: rejectedCount
      },
      recentActions: mergeRecentItems(recentStudentActions, recentFacultyActions)
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
        pendingFacultyRequests,
        approvedByCao,
        rejectedByCao
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
  const [readyStudentGatepasses, readyFacultyGatepasses, checkedOutStudentToday, checkedOutFacultyToday, completedStudentToday, completedFacultyToday, recentStudentVerifications, recentFacultyVerifications] =
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
      checkedOutToday,
      completedToday
    },
    recentVerifications
  };
}

module.exports = {
  getDashboardSummary
};
