'use strict';

const Class = require('../models/Class');
const AppError = require('../utils/appError');
const { ERROR_CODES } = require('../utils/appError');
const asyncHandler = require('../utils/asyncHandler');
const { normalizeProgram, normalizeDepartment } = require('../constants/appConstants');

/**
 * Helper to normalize class lookup criteria.
 */
function getClassCriteria(body) {
  const program = normalizeProgram(body.program);
  const department = normalizeDepartment(body.department);
  const semester = Number(body.semester);
  const division = String(body.division || '').trim();
  const academicYear = String(body.academicYear || '').trim();

  if (!program || !department || !semester) {
    throw new AppError(
      'Program, department, and semester are required.',
      400,
      null,
      ERROR_CODES.ERR_VALIDATION
    );
  }

  return { program, department, semester, division, academicYear };
}

/**
 * POST /api/coordinator/assign
 * Sets the coordinator_id of the specified class to the currently logged in user.
 */
const assignCoordinator = asyncHandler(async (req, res) => {
  const user = req.user;

  // Only allow faculty or hod roles to coordinate classes
  if (!['faculty', 'hod'].includes(user.role)) {
    throw new AppError(
      'Only faculty or HOD accounts can be class coordinators.',
      403,
      null,
      ERROR_CODES.ERR_FORBIDDEN
    );
  }

  const criteria = getClassCriteria(req.body);

  // Find class or upsert it
  let targetClass = await Class.findOne({
    program: criteria.program,
    department: criteria.department,
    semester: criteria.semester,
    division: criteria.division,
    academicYear: criteria.academicYear
  });

  if (!targetClass) {
    targetClass = new Class({
      ...criteria,
      coordinator_id: user._id
    });
  } else {
    // Overwrite the coordinator assignment
    targetClass.coordinator_id = user._id;
  }

  await targetClass.save();

  // Reload the user profile dynamically so the response returns the updated coordinator profile
  const User = require('../models/User');
  const updatedUser = await User.findById(user._id);

  res.status(200).json({
    success: true,
    message: `You are now the coordinator for ${criteria.program} ${criteria.department} Semester ${criteria.semester}.`,
    data: {
      class: targetClass,
      user: updatedUser.toPublicJSON()
    }
  });
});

/**
 * POST /api/coordinator/resign
 * Clears the coordinator_id of the specified class.
 */
const resignCoordinator = asyncHandler(async (req, res) => {
  const user = req.user;
  const criteria = getClassCriteria(req.body);

  const targetClass = await Class.findOne({
    program: criteria.program,
    department: criteria.department,
    semester: criteria.semester,
    division: criteria.division,
    academicYear: criteria.academicYear
  });

  if (!targetClass) {
    throw new AppError(
      'No active class coordinates match the specified details.',
      404,
      null,
      ERROR_CODES.ERR_NOT_FOUND
    );
  }

  // Ensure they are actually the coordinator of this class before clearing it
  if (String(targetClass.coordinator_id || '') !== String(user._id)) {
    throw new AppError(
      'You are not authorized to resign from a class you do not coordinate.',
      403,
      null,
      ERROR_CODES.ERR_FORBIDDEN
    );
  }

  targetClass.coordinator_id = null;
  await targetClass.save();

  // Reload the user profile dynamically
  const User = require('../models/User');
  const updatedUser = await User.findById(user._id);

  res.status(200).json({
    success: true,
    message: 'Resigned as coordinator successfully.',
    data: {
      class: targetClass,
      user: updatedUser.toPublicJSON()
    }
  });
});

module.exports = {
  assignCoordinator,
  resignCoordinator
};
