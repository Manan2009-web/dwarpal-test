const { body, param } = require('express-validator');
const {
  DEPARTMENTS,
  PASSWORD_REGEX,
  PUBLIC_REGISTRATION_ROLES,
  ROUTING_DEPARTMENTS,
  STUDENT_PROGRAMS,
  normalizeDepartment,
  normalizeProgram,
  normalizeRole,
  SEMESTERS
} = require('../constants/appConstants');
const { isValidPhoneNumber, normalizePhoneNumber } = require('../utils/phone');

function normalizePhoneValue(value) {
  return normalizePhoneNumber(value);
}

function validatePhoneValue(value, message = 'Please enter a valid phone number.') {
  if (!value || !isValidPhoneNumber(value)) {
    throw new Error(message);
  }

  return true;
}

const registerValidation = [
  body('fullName')
    .trim()
    .notEmpty()
    .withMessage('Full name is required')
    .isLength({ min: 2, max: 120 })
    .withMessage('Full name must be between 2 and 120 characters'),
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password')
    .isString()
    .withMessage('Password is required')
    .matches(PASSWORD_REGEX)
    .withMessage(
      'Password must be at least 8 characters and include uppercase, lowercase, number, and special character'
    ),
  body('role')
    .trim()
    .customSanitizer(normalizeRole)
    .isIn(PUBLIC_REGISTRATION_ROLES)
    .withMessage(`Role must be one of: ${PUBLIC_REGISTRATION_ROLES.join(', ')}`),
  body('program')
    .customSanitizer(normalizeProgram)
    .custom((value, { req }) => {
      if (!['student', 'hod'].includes(req.body.role)) {
        return true;
      }

      if (!value) {
        throw new Error('Program is required.');
      }

      if (!STUDENT_PROGRAMS.includes(value)) {
        throw new Error(`Program must be one of: ${STUDENT_PROGRAMS.join(', ')}`);
      }

      return true;
    }),
  body('department')
    .customSanitizer((value) => normalizeDepartment(value) || String(value || '').trim())
    .custom((value, { req }) => {
      const normalizedDepartment = String(value || '').trim();

      if (!normalizedDepartment) {
        if (req.body.role === 'security') {
          return true;
        }

        throw new Error('Department is required');
      }

      if (['student', 'hod'].includes(req.body.role) && !ROUTING_DEPARTMENTS.includes(normalizedDepartment)) {
        throw new Error(`Department must be one of: ${ROUTING_DEPARTMENTS.join(', ')}`);
      }

      if (!DEPARTMENTS.includes(normalizedDepartment)) {
        throw new Error(`Department must be one of: ${DEPARTMENTS.join(', ')}`);
      }

      return true;
    }),
  body('semester').custom((value, { req }) => {
    if (req.body.role === 'student') {
      const numericSemester = Number(value);
      if (!SEMESTERS.includes(numericSemester)) {
        throw new Error('Semester is required for students and must be between 1 and 8');
      }
    }
    return true;
  }),
  body('enrollmentNo').trim().custom((value, { req }) => {
    if (req.body.role === 'student' && !value) {
      throw new Error('Enrollment number is required for students');
    }
    return true;
  }),
  body('employeeId')
    .trim()
    .customSanitizer((value) => String(value || '').trim().toUpperCase())
    .custom((value, { req }) => {
      if (req.body.role !== 'student' && !value) {
        throw new Error('Employee ID is required for faculty and staff accounts');
      }
      return true;
    }),
  body('phone')
    .customSanitizer(normalizePhoneValue)
    .custom((value) => validatePhoneValue(value))
];

const verifyRegistrationEmailValidation = [
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('verificationCode')
    .trim()
    .matches(/^\d{4,8}$/)
    .withMessage('Please enter the verification code sent to your email.')
];

const loginValidation = [
  body('identifier')
    .customSanitizer((value, { req }) =>
      String(value || req.body.enrollment || req.body.employeeId || req.body.email || '').trim()
    )
    .notEmpty()
    .withMessage('Email, enrollment number, or employee ID is required'),
  body('password').notEmpty().withMessage('Password is required')
];

const changePasswordValidation = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .matches(PASSWORD_REGEX)
    .withMessage(
      'New password must be at least 8 characters and include uppercase, lowercase, number, and special character'
    )
];

const forgotPasswordValidation = [
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail()
];

const resetPasswordValidation = [
  body('token').trim().notEmpty().withMessage('Reset token is required'),
  body('newPassword')
    .matches(PASSWORD_REGEX)
    .withMessage(
      'New password must be at least 8 characters and include uppercase, lowercase, number, and special character'
    )
];

const registrationAvailabilityValidation = [
  body('role')
    .optional({ values: 'falsy' })
    .trim()
    .customSanitizer(normalizeRole)
    .custom((value) => {
      if (!value) {
        throw new Error(`Role must be one of: ${PUBLIC_REGISTRATION_ROLES.join(', ')}`);
      }

      return true;
    }),
  body('email').optional({ values: 'falsy' }).trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('phone')
    .optional({ values: 'falsy' })
    .customSanitizer(normalizePhoneValue)
    .custom((value) => validatePhoneValue(value)),
  body('enrollmentNo').optional({ values: 'falsy' }).trim(),
  body('employeeId')
    .optional({ values: 'falsy' })
    .trim()
    .customSanitizer((value) => String(value || '').trim().toUpperCase())
];

const webAuthnRegistrationOptionsValidation = [
  body('deviceName')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 120 })
    .withMessage('Device name cannot exceed 120 characters.')
];

const webAuthnRegistrationVerifyValidation = [
  body('response')
    .custom((value) => {
      if (!value || typeof value !== 'object') {
        throw new Error('Biometric registration response is required.');
      }

      return true;
    })
];

const webAuthnAuthenticationOptionsValidation = [
  body('identifier')
    .customSanitizer((value) => String(value || '').trim())
    .notEmpty()
    .withMessage('Enrollment number, employee ID, or email is required for biometric login.')
];

const webAuthnAuthenticationVerifyValidation = [
  body('response')
    .custom((value) => {
      if (!value || typeof value !== 'object') {
        throw new Error('Biometric authentication response is required.');
      }

      return true;
    })
];

const biometricDeviceIdParamValidation = [
  param('deviceId').isMongoId().withMessage('Valid biometric device ID is required.')
];

module.exports = {
  biometricDeviceIdParamValidation,
  changePasswordValidation,
  forgotPasswordValidation,
  loginValidation,
  registrationAvailabilityValidation,
  registerValidation,
  resetPasswordValidation,
  verifyRegistrationEmailValidation,
  webAuthnAuthenticationOptionsValidation,
  webAuthnAuthenticationVerifyValidation,
  webAuthnRegistrationOptionsValidation,
  webAuthnRegistrationVerifyValidation
};
