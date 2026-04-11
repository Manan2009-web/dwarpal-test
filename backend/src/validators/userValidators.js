const { body, param } = require('express-validator');
const {
  DEPARTMENTS,
  PHONE_REGEX,
  ROUTING_DEPARTMENTS,
  SEMESTERS,
  STUDENT_PROGRAMS,
  normalizeDepartment,
  normalizeProgram
} = require('../constants/appConstants');

const updateProfileValidation = [
  body('fullName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 120 })
    .withMessage('Full name must be between 2 and 120 characters'),
  body('email').optional().trim().isEmail().withMessage('Please provide a valid email').normalizeEmail(),
  body('phone')
    .optional()
    .trim()
    .matches(PHONE_REGEX)
    .withMessage('Phone number must contain 10 to 15 digits'),
  body('program')
    .optional({ values: 'falsy' })
    .customSanitizer(normalizeProgram)
    .custom((value, { req }) => {
      const role = req.user?.role;

      if (!['student', 'hod'].includes(role)) {
        return true;
      }

      if (!value || !STUDENT_PROGRAMS.includes(value)) {
        throw new Error(`Program must be one of: ${STUDENT_PROGRAMS.join(', ')}`);
      }

      return true;
    }),
  body('department')
    .optional()
    .customSanitizer((value) => normalizeDepartment(value) || String(value || '').trim())
    .custom((value, { req }) => {
      const role = req.user?.role;
      const normalizedDepartment = String(value || '').trim();

      if (!normalizedDepartment) {
        return true;
      }

      if (['student', 'hod'].includes(role) && !ROUTING_DEPARTMENTS.includes(normalizedDepartment)) {
        throw new Error(`Department must be one of: ${ROUTING_DEPARTMENTS.join(', ')}`);
      }

      if (!DEPARTMENTS.includes(normalizedDepartment)) {
        throw new Error(`Department must be one of: ${DEPARTMENTS.join(', ')}`);
      }

      return true;
    }),
  body('semester').optional().custom((value) => {
    const numericSemester = Number(value);
    if (!SEMESTERS.includes(numericSemester)) {
      throw new Error('Semester must be between 1 and 8');
    }
    return true;
  }),
  body('gatepassApprovalEnabled')
    .optional()
    .isBoolean()
    .withMessage('gatepassApprovalEnabled must be true or false'),
  body('coordinatorAssignment')
    .optional()
    .isObject()
    .withMessage('coordinatorAssignment must be an object'),
  body('coordinatorAssignment.isCoordinator')
    .optional()
    .isBoolean()
    .withMessage('coordinatorAssignment.isCoordinator must be true or false'),
  body('coordinatorAssignment.program')
    .optional({ values: 'falsy' })
    .customSanitizer(normalizeProgram)
    .custom((value, { req }) => {
      const isCoordinator = req.body?.coordinatorAssignment?.isCoordinator === true;

      if (!isCoordinator) {
        return true;
      }

      if (!value || !STUDENT_PROGRAMS.includes(value)) {
        throw new Error(`Coordinator program must be one of: ${STUDENT_PROGRAMS.join(', ')}`);
      }

      return true;
    }),
  body('coordinatorAssignment.department')
    .optional({ values: 'falsy' })
    .customSanitizer((value) => normalizeDepartment(value) || String(value || '').trim())
    .custom((value, { req }) => {
      const isCoordinator = req.body?.coordinatorAssignment?.isCoordinator === true;
      const normalizedDepartment = String(value || '').trim();

      if (!isCoordinator) {
        return true;
      }

      if (!normalizedDepartment || !ROUTING_DEPARTMENTS.includes(normalizedDepartment)) {
        throw new Error(`Coordinator department must be one of: ${ROUTING_DEPARTMENTS.join(', ')}`);
      }

      return true;
    }),
  body('coordinatorAssignment.semester')
    .optional()
    .custom((value, { req }) => {
      const isCoordinator = req.body?.coordinatorAssignment?.isCoordinator === true;
      const numericSemester = Number(value);

      if (!isCoordinator) {
        return true;
      }

      if (!SEMESTERS.includes(numericSemester)) {
        throw new Error('Coordinator semester must be between 1 and 8');
      }

      return true;
    })
];

const updateUserStatusValidation = [
  param('id').isMongoId().withMessage('Valid user id is required'),
  body('isActive').isBoolean().withMessage('isActive must be true or false')
];

module.exports = {
  updateProfileValidation,
  updateUserStatusValidation
};
