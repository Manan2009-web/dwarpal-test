const { body, param } = require('express-validator');
const {
  PASSWORD_REGEX,
  ROUTING_DEPARTMENTS,
  SEMESTERS,
  STUDENT_PROGRAMS,
  normalizeDepartment,
  normalizeProgram
} = require('../constants/appConstants');
const { isValidPhoneNumber, normalizePhoneNumber } = require('../utils/phone');

function validatePhoneValue(value, message = 'Please enter a valid phone number.') {
  if (!value || !isValidPhoneNumber(value)) {
    throw new Error(message);
  }

  return true;
}

function studentIdentityValidation(field = 'enrollmentNo', required = true) {
  const chain = body(field).trim();

  if (required) {
    return chain.notEmpty().withMessage('Enrollment number is required.');
  }

  return chain.optional({ values: 'falsy' });
}

const adminStudentCreateValidation = [
  body('fullName')
    .trim()
    .notEmpty()
    .withMessage('Full name is required.')
    .isLength({ min: 2, max: 120 })
    .withMessage('Full name must be between 2 and 120 characters.'),
  body('email')
    .trim()
    .isEmail()
    .withMessage('Valid email is required.')
    .normalizeEmail(),
  studentIdentityValidation('enrollmentNo', true),
  body('phone')
    .customSanitizer((value) => normalizePhoneNumber(value))
    .custom((value) => validatePhoneValue(value)),
  body('program')
    .customSanitizer(normalizeProgram)
    .custom((value) => {
      if (!STUDENT_PROGRAMS.includes(value)) {
        throw new Error(`Program must be one of: ${STUDENT_PROGRAMS.join(', ')}`);
      }

      return true;
    }),
  body('department')
    .customSanitizer((value) => normalizeDepartment(value) || String(value || '').trim())
    .custom((value) => {
      if (!ROUTING_DEPARTMENTS.includes(value)) {
        throw new Error(`Department must be one of: ${ROUTING_DEPARTMENTS.join(', ')}`);
      }

      return true;
    }),
  body('semester').custom((value) => {
    const numericSemester = Number(value);

    if (!SEMESTERS.includes(numericSemester)) {
      throw new Error('Semester must be between 1 and 8.');
    }

    return true;
  }),
  body('temporaryPassword')
    .isString()
    .withMessage('Temporary password is required.')
    .matches(PASSWORD_REGEX)
    .withMessage(
      'Temporary password must be at least 8 characters and include uppercase, lowercase, number, and special character.'
    )
];

const adminStudentUpdateValidation = [
  param('id').isMongoId().withMessage('Valid student id is required.'),
  body('fullName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 120 })
    .withMessage('Full name must be between 2 and 120 characters.'),
  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Valid email is required.')
    .normalizeEmail(),
  studentIdentityValidation('enrollmentNo', false),
  body('phone')
    .optional()
    .customSanitizer((value) => normalizePhoneNumber(value))
    .custom((value) => validatePhoneValue(value)),
  body('program')
    .optional({ values: 'falsy' })
    .customSanitizer(normalizeProgram)
    .custom((value) => {
      if (!STUDENT_PROGRAMS.includes(value)) {
        throw new Error(`Program must be one of: ${STUDENT_PROGRAMS.join(', ')}`);
      }

      return true;
    }),
  body('department')
    .optional({ values: 'falsy' })
    .customSanitizer((value) => normalizeDepartment(value) || String(value || '').trim())
    .custom((value) => {
      if (!ROUTING_DEPARTMENTS.includes(value)) {
        throw new Error(`Department must be one of: ${ROUTING_DEPARTMENTS.join(', ')}`);
      }

      return true;
    }),
  body('semester')
    .optional()
    .custom((value) => {
      const numericSemester = Number(value);

      if (!SEMESTERS.includes(numericSemester)) {
        throw new Error('Semester must be between 1 and 8.');
      }

      return true;
    }),
  body('temporaryPassword')
    .optional({ values: 'falsy' })
    .isString()
    .withMessage('Temporary password must be a string.')
    .matches(PASSWORD_REGEX)
    .withMessage(
      'Temporary password must be at least 8 characters and include uppercase, lowercase, number, and special character.'
    )
];

const adminStudentDeleteValidation = [param('id').isMongoId().withMessage('Valid student id is required.')];

module.exports = {
  adminStudentCreateValidation,
  adminStudentDeleteValidation,
  adminStudentUpdateValidation
};
