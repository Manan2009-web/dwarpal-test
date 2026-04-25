const env = require('../config/env');
const AppError = require('../utils/appError');
const { sendSuccess } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { getRequestMeta } = require('../utils/request');
const adminService = require('../services/adminService');
const studentManagementService = require('../services/studentManagementService');

const seedDefaultAdmins = asyncHandler(async (req, res) => {
  const providedSeedKey = req.get('x-seed-key');

  if (!env.seedAdminKey || providedSeedKey !== env.seedAdminKey) {
    throw new AppError('Valid x-seed-key header is required to seed system accounts', 403);
  }

  const result = await adminService.seedDefaultAdmins({
    requestMeta: getRequestMeta(req)
  });

  return sendSuccess(res, {
    message: 'System account seeding completed',
    data: result
  });
});

const getAnalytics = asyncHandler(async (req, res) => {
  const analytics = await adminService.getAnalytics();
  return sendSuccess(res, {
    message: 'Analytics fetched successfully',
    data: analytics
  });
});

const listUsers = asyncHandler(async (req, res) => {
  const result = await adminService.listUsers(req.query);
  return sendSuccess(res, {
    message: 'Users fetched successfully',
    data: result.users,
    meta: result.meta
  });
});

const updateUserStatus = asyncHandler(async (req, res) => {
  const user = await adminService.updateUserStatus(
    req.params.id,
    req.user,
    req.body,
    getRequestMeta(req)
  );
  return sendSuccess(res, {
    message: 'User status updated successfully',
    data: user
  });
});

const createStudent = asyncHandler(async (req, res) => {
  const student = await studentManagementService.createStudent(req.body, req.user, getRequestMeta(req));

  return sendSuccess(res, {
    statusCode: 201,
    message: 'Student created successfully.',
    data: student
  });
});

const listStudents = asyncHandler(async (req, res) => {
  const result = await studentManagementService.listStudents(req.query);

  return sendSuccess(res, {
    message: 'Students fetched successfully.',
    data: {
      students: result.students,
      options: result.options
    },
    meta: result.meta
  });
});

const updateStudent = asyncHandler(async (req, res) => {
  const student = await studentManagementService.updateStudent(req.params.id, req.body, req.user, getRequestMeta(req));

  return sendSuccess(res, {
    message: 'Student updated successfully.',
    data: student
  });
});

const deleteStudent = asyncHandler(async (req, res) => {
  const result = await studentManagementService.deleteStudent(req.params.id, req.user, getRequestMeta(req));

  return sendSuccess(res, {
    message: 'Student deleted successfully.',
    data: result
  });
});

const exportStudentCredentials = asyncHandler(async (req, res) => {
  const result = await studentManagementService.exportStudentCredentials(req.query, req.user);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
  res.setHeader('Content-Length', result.buffer.length);
  return res.status(200).send(result.buffer);
});

module.exports = {
  createStudent,
  deleteStudent,
  exportStudentCredentials,
  getAnalytics,
  listStudents,
  listUsers,
  seedDefaultAdmins,
  updateStudent,
  updateUserStatus
};
