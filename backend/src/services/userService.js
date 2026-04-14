const User = require('../models/User');
const AppError = require('../utils/appError');
const pickUser = require('../utils/pickUser');
const { logAction } = require('./auditService');

async function getProfile(user, req) {
  return pickUser(user, req);
}

async function updateProfile(user, payload, req, requestMeta) {
  const currentUser = await User.findById(user._id);

  if (!currentUser) {
    throw new AppError('User not found', 404);
  }

  if (payload.email && payload.email.toLowerCase() !== currentUser.email) {
    throw new AppError('Use the email verification flow to update your email address safely.', 400, [
      {
        field: 'email',
        message: 'Use the email verification flow to update your email address safely.'
      }
    ]);
  }

  if (payload.fullName) {
    currentUser.fullName = payload.fullName;
  }

  if (payload.phone) {
    currentUser.phone = payload.phone;
  }

  if (payload.department) {
    currentUser.department = payload.department;
  }

  if (['student', 'hod'].includes(currentUser.role) && payload.program) {
    currentUser.program = payload.program;
  }

  if (currentUser.role === 'student' && payload.semester) {
    currentUser.semester = Number(payload.semester);
  }

  if (['principal', 'hod'].includes(currentUser.role) && typeof payload.gatepassApprovalEnabled === 'boolean') {
    currentUser.gatepassApprovalEnabled = payload.gatepassApprovalEnabled;
  }

  if (['faculty', 'hod'].includes(currentUser.role) && payload.coordinatorAssignment) {
    const assignment = payload.coordinatorAssignment || {};
    const isCoordinator = assignment.isCoordinator === true;

    currentUser.coordinatorAssignment = {
      isCoordinator,
      program: isCoordinator ? assignment.program || null : null,
      department: isCoordinator ? assignment.department || null : null,
      semester: isCoordinator ? Number(assignment.semester) || null : null
    };
  }

  await currentUser.save();

  await logAction({
    actorId: currentUser._id,
    resourceType: 'user',
    resourceId: currentUser._id,
    action: 'update_profile',
    message: 'Profile updated successfully',
    requestMeta
  });

  return pickUser(currentUser, req);
}

async function uploadProfileImage(user, file, req, requestMeta) {
  if (!file) {
    throw new AppError('Profile image file is required', 400);
  }

  const currentUser = await User.findById(user._id);

  if (!currentUser) {
    throw new AppError('User not found', 404);
  }

  currentUser.profileImage = `/uploads/profiles/${file.filename}`;
  await currentUser.save();

  await logAction({
    actorId: currentUser._id,
    resourceType: 'user',
    resourceId: currentUser._id,
    action: 'upload_profile_image',
    message: 'Profile image uploaded',
    requestMeta
  });

  return pickUser(currentUser, req);
}

module.exports = {
  getProfile,
  updateProfile,
  uploadProfileImage
};
