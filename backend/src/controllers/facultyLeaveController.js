const { sendSuccess } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { getRequestMeta } = require('../utils/request');
const facultyLeaveService = require('../services/facultyLeaveService');

const createFacultyLeaveRequest = asyncHandler(async (req, res) => {
  const request = await facultyLeaveService.createFacultyLeaveRequest(
    req.user,
    req.body,
    getRequestMeta(req)
  );

  return sendSuccess(res, {
    statusCode: 201,
    message: 'Faculty leave request created successfully',
    data: request
  });
});

const getMyFacultyLeaveRequests = asyncHandler(async (req, res) => {
  const result = await facultyLeaveService.getMyFacultyLeaveRequests(req.user, req.query);

  return sendSuccess(res, {
    message: 'Your faculty leave requests fetched successfully',
    data: result.requests,
    meta: result.meta
  });
});

const getFacultyLeaveHistory = asyncHandler(async (req, res) => {
  const result = await facultyLeaveService.getFacultyLeaveHistory(req.user, req.query);

  return sendSuccess(res, {
    message: 'Faculty leave request history fetched successfully',
    data: result.requests,
    meta: result.meta
  });
});

const getFacultyLeaveById = asyncHandler(async (req, res) => {
  const request = await facultyLeaveService.getFacultyLeaveDetails(req.params.id, req.user);

  return sendSuccess(res, {
    message: 'Faculty leave request fetched successfully',
    data: request
  });
});

const getPendingForHod = asyncHandler(async (req, res) => {
  const result = await facultyLeaveService.getPendingFacultyLeaveRequestsForRole(req.user, req.query);

  return sendSuccess(res, {
    message: 'Pending faculty leave requests for HOD fetched successfully',
    data: result.requests,
    meta: result.meta
  });
});

const getPendingForPrincipal = asyncHandler(async (req, res) => {
  const result = await facultyLeaveService.getPendingFacultyLeaveRequestsForRole(req.user, req.query);

  return sendSuccess(res, {
    message: 'Pending faculty leave requests for Principal fetched successfully',
    data: result.requests,
    meta: result.meta
  });
});

const getPendingForCao = asyncHandler(async (req, res) => {
  const result = await facultyLeaveService.getPendingFacultyLeaveRequestsForRole(req.user, req.query);

  return sendSuccess(res, {
    message: 'Pending faculty leave requests for CAO fetched successfully',
    data: result.requests,
    meta: result.meta
  });
});

const approveFacultyLeaveRequest = asyncHandler(async (req, res) => {
  const request = await facultyLeaveService.approveFacultyLeaveRequest(
    req.params.id,
    req.user,
    req.body,
    getRequestMeta(req)
  );

  return sendSuccess(res, {
    message: 'Faculty leave request approved successfully',
    data: request
  });
});

const rejectFacultyLeaveRequest = asyncHandler(async (req, res) => {
  const request = await facultyLeaveService.rejectFacultyLeaveRequest(
    req.params.id,
    req.user,
    req.body,
    getRequestMeta(req)
  );

  return sendSuccess(res, {
    message: 'Faculty leave request rejected successfully',
    data: request
  });
});

const checkOutFacultyLeaveRequest = asyncHandler(async (req, res) => {
  const request = await facultyLeaveService.checkOutFacultyLeaveRequest(
    req.params.id,
    req.user,
    req.body,
    getRequestMeta(req)
  );

  return sendSuccess(res, {
    message: 'Faculty gatepass checked out successfully',
    data: request
  });
});

const checkInFacultyLeaveRequest = asyncHandler(async (req, res) => {
  const request = await facultyLeaveService.checkInFacultyLeaveRequest(
    req.params.id,
    req.user,
    req.body,
    getRequestMeta(req)
  );

  return sendSuccess(res, {
    message: 'Faculty gatepass marked as returned successfully',
    data: request
  });
});

module.exports = {
  approveFacultyLeaveRequest,
  checkInFacultyLeaveRequest,
  checkOutFacultyLeaveRequest,
  createFacultyLeaveRequest,
  getFacultyLeaveById,
  getFacultyLeaveHistory,
  getMyFacultyLeaveRequests,
  getPendingForCao,
  getPendingForHod,
  getPendingForPrincipal,
  rejectFacultyLeaveRequest
};
