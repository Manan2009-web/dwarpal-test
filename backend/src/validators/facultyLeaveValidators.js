const { body, param } = require('express-validator');
const { FACULTY_LEAVE_TYPES, PHONE_REGEX, TIME_REGEX } = require('../constants/appConstants');

const facultyLeaveIdParamValidation = [
  param('id').isMongoId().withMessage('Valid faculty leave request id is required')
];

function requireTrueBoolean(field, message) {
  return body(field)
    .custom((value) => value === true)
    .withMessage(message);
}

function timeToMinutes(value) {
  const [hours = '0', minutes = '0'] = String(value || '').split(':');
  return Number(hours) * 60 + Number(minutes);
}

const facultyLeaveQueryValidation = [];

const createFacultyLeaveRequestValidation = [
  body('facultyDetails.name')
    .trim()
    .notEmpty()
    .withMessage('facultyDetails.name is required')
    .isLength({ min: 2, max: 120 })
    .withMessage('facultyDetails.name must be between 2 and 120 characters'),
  body('facultyDetails.employeeId')
    .trim()
    .notEmpty()
    .withMessage('facultyDetails.employeeId is required')
    .isLength({ min: 2, max: 40 })
    .withMessage('facultyDetails.employeeId must be between 2 and 40 characters'),
  body('facultyDetails.designation')
    .trim()
    .notEmpty()
    .withMessage('facultyDetails.designation is required')
    .isLength({ min: 2, max: 120 })
    .withMessage('facultyDetails.designation must be between 2 and 120 characters'),
  body('facultyDetails.department')
    .trim()
    .notEmpty()
    .withMessage('facultyDetails.department is required')
    .isLength({ min: 2, max: 120 })
    .withMessage('facultyDetails.department must be between 2 and 120 characters'),
  body('facultyDetails.contactNumber')
    .trim()
    .notEmpty()
    .withMessage('facultyDetails.contactNumber is required')
    .custom((value) => PHONE_REGEX.test(value))
    .withMessage('facultyDetails.contactNumber must be a valid phone number'),
  body('facultyDetails.emailId')
    .trim()
    .notEmpty()
    .withMessage('facultyDetails.emailId is required')
    .isEmail()
    .withMessage('facultyDetails.emailId must be a valid email')
    .normalizeEmail(),

  body('leaveDetails.leaveType')
    .trim()
    .isIn(FACULTY_LEAVE_TYPES)
    .withMessage(`leaveDetails.leaveType must be one of: ${FACULTY_LEAVE_TYPES.join(', ')}`),
  body('leaveDetails.leaveTypeOther')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 120 })
    .withMessage('leaveDetails.leaveTypeOther cannot exceed 120 characters'),
  body('leaveDetails.leaveTypeOther').custom((value, { req }) => {
    if (req.body?.leaveDetails?.leaveType === 'Others' && !String(value || '').trim()) {
      throw new Error('leaveDetails.leaveTypeOther is required when leave type is Others');
    }

    return true;
  }),
  body('leaveDetails.reason')
    .trim()
    .notEmpty()
    .withMessage('leaveDetails.reason is required')
    .isLength({ min: 5, max: 1200 })
    .withMessage('leaveDetails.reason must be between 5 and 1200 characters'),
  body('leaveDetails.leaveFrom')
    .isISO8601()
    .withMessage('leaveDetails.leaveFrom must be a valid date')
    .toDate(),
  body('leaveDetails.leaveTo')
    .isISO8601()
    .withMessage('leaveDetails.leaveTo must be a valid date')
    .toDate(),
  body('leaveDetails.totalDays')
    .isFloat({ min: 1, max: 365 })
    .withMessage('leaveDetails.totalDays must be between 1 and 365')
    .toFloat(),
  body('leaveDetails.leaveTo').custom((value, { req }) => {
    const leaveFrom = req.body?.leaveDetails?.leaveFrom;

    if (leaveFrom && new Date(value) < new Date(leaveFrom)) {
      throw new Error('leaveDetails.leaveTo cannot be before leaveDetails.leaveFrom');
    }

    return true;
  }),

  body('workloadAdjustments')
    .isArray({ min: 1 })
    .withMessage('At least one workload adjustment row is required'),
  body('workloadAdjustments.*.date')
    .isISO8601()
    .withMessage('Each workload adjustment date must be a valid date')
    .toDate(),
  body('workloadAdjustments.*.time')
    .trim()
    .notEmpty()
    .withMessage('Each workload adjustment time is required')
    .isLength({ max: 120 })
    .withMessage('Each workload adjustment time cannot exceed 120 characters'),
  body('workloadAdjustments.*.subjectOrCourseCode')
    .trim()
    .notEmpty()
    .withMessage('Each subject / course code is required')
    .isLength({ max: 200 })
    .withMessage('Each subject / course code cannot exceed 200 characters'),
  body('workloadAdjustments.*.classOrSemester')
    .trim()
    .notEmpty()
    .withMessage('Each class / semester value is required')
    .isLength({ max: 120 })
    .withMessage('Each class / semester value cannot exceed 120 characters'),
  body('workloadAdjustments.*.adjustedFacultyName')
    .trim()
    .notEmpty()
    .withMessage('Each adjusted faculty name is required')
    .isLength({ max: 120 })
    .withMessage('Each adjusted faculty name cannot exceed 120 characters'),
  body('workloadAdjustments.*.adjustedFacultySignature')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 160 })
    .withMessage('Each adjusted faculty signature cannot exceed 160 characters'),

  requireTrueBoolean(
    'workloadDeclarations.lecturesAdjustedConfirmed',
    'workloadDeclarations.lecturesAdjustedConfirmed must be confirmed'
  ),
  requireTrueBoolean(
    'workloadDeclarations.noAcademicLossConfirmed',
    'workloadDeclarations.noAcademicLossConfirmed must be confirmed'
  ),

  requireTrueBoolean('declaration.confirmed', 'declaration.confirmed must be confirmed'),
  body('declaration.declarationDate')
    .isISO8601()
    .withMessage('declaration.declarationDate must be a valid date')
    .toDate(),
  body('declaration.digitalAcknowledgmentName')
    .trim()
    .notEmpty()
    .withMessage('declaration.digitalAcknowledgmentName is required')
    .isLength({ min: 2, max: 120 })
    .withMessage('declaration.digitalAcknowledgmentName must be between 2 and 120 characters'),

  body('shortLeave.staffMemberName')
    .trim()
    .notEmpty()
    .withMessage('shortLeave.staffMemberName is required')
    .isLength({ min: 2, max: 120 })
    .withMessage('shortLeave.staffMemberName must be between 2 and 120 characters'),
  body('shortLeave.designation')
    .trim()
    .notEmpty()
    .withMessage('shortLeave.designation is required')
    .isLength({ min: 2, max: 120 })
    .withMessage('shortLeave.designation must be between 2 and 120 characters'),
  body('shortLeave.department')
    .trim()
    .notEmpty()
    .withMessage('shortLeave.department is required')
    .isLength({ min: 2, max: 120 })
    .withMessage('shortLeave.department must be between 2 and 120 characters'),
  body('shortLeave.instituteName')
    .trim()
    .notEmpty()
    .withMessage('shortLeave.instituteName is required')
    .isLength({ min: 2, max: 180 })
    .withMessage('shortLeave.instituteName must be between 2 and 180 characters'),
  body('shortLeave.employeeId')
    .trim()
    .notEmpty()
    .withMessage('shortLeave.employeeId is required')
    .isLength({ min: 2, max: 40 })
    .withMessage('shortLeave.employeeId must be between 2 and 40 characters'),
  body('shortLeave.leaveDate')
    .isISO8601()
    .withMessage('shortLeave.leaveDate must be a valid date')
    .toDate(),
  body('shortLeave.requestedFrom')
    .trim()
    .matches(TIME_REGEX)
    .withMessage('shortLeave.requestedFrom must be in HH:mm format'),
  body('shortLeave.requestedTo')
    .trim()
    .matches(TIME_REGEX)
    .withMessage('shortLeave.requestedTo must be in HH:mm format'),
  body('shortLeave.totalDurationMinutes')
    .isInt({ min: 1, max: 1440 })
    .withMessage('shortLeave.totalDurationMinutes must be between 1 and 1440')
    .toInt(),
  body('shortLeave.reason')
    .trim()
    .notEmpty()
    .withMessage('shortLeave.reason is required')
    .isLength({ min: 5, max: 1200 })
    .withMessage('shortLeave.reason must be between 5 and 1200 characters'),
  requireTrueBoolean('shortLeave.applicantConfirmed', 'shortLeave.applicantConfirmed must be confirmed'),
  body('shortLeave.applicationDate')
    .isISO8601()
    .withMessage('shortLeave.applicationDate must be a valid date')
    .toDate(),
  body('shortLeave.digitalSignatureName')
    .trim()
    .notEmpty()
    .withMessage('shortLeave.digitalSignatureName is required')
    .isLength({ min: 2, max: 120 })
    .withMessage('shortLeave.digitalSignatureName must be between 2 and 120 characters'),
  body('shortLeave.requestedTo').custom((value, { req }) => {
    const requestedFrom = req.body?.shortLeave?.requestedFrom;

    if (requestedFrom && timeToMinutes(value) <= timeToMinutes(requestedFrom)) {
      throw new Error('shortLeave.requestedTo must be after shortLeave.requestedFrom');
    }

    return true;
  })
];

const approveFacultyLeaveRequestValidation = [
  ...facultyLeaveIdParamValidation,
  body('comment')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 500 })
    .withMessage('Approval comment cannot exceed 500 characters')
];

const rejectFacultyLeaveRequestValidation = [
  ...facultyLeaveIdParamValidation,
  body('rejectionReason')
    .trim()
    .notEmpty()
    .withMessage('Reject reason is required.')
    .bail()
    .isLength({ min: 5 })
    .withMessage('Minimum length of reject reason is 5 characters.')
    .bail()
    .isLength({ max: 500 })
    .withMessage('Maximum length of reject reason is 500 characters.')
];

const facultyLeaveSecurityActionValidation = [
  ...facultyLeaveIdParamValidation,
  body('verificationToken')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ min: 10, max: 64 })
    .withMessage('Verification token must be between 10 and 64 characters.'),
  body('note')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 500 })
    .withMessage('Note cannot exceed 500 characters.')
];

module.exports = {
  approveFacultyLeaveRequestValidation,
  createFacultyLeaveRequestValidation,
  facultyLeaveSecurityActionValidation,
  facultyLeaveIdParamValidation,
  facultyLeaveQueryValidation,
  rejectFacultyLeaveRequestValidation
};
