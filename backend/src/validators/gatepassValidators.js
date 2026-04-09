const { body, param } = require('express-validator');
const { TIME_REGEX, VEHICLE_NUMBER_REGEX } = require('../constants/appConstants');

const gatepassIdParamValidation = [param('id').isMongoId().withMessage('Valid gatepass ID is required.')];

function buildRejectReasonValidation({ requiredWhenReject = false } = {}) {
  return body('rejectionReason')
    .customSanitizer((value) => (typeof value === 'string' ? value.trim() : value))
    .custom((value, { req }) => {
      const normalizedValue = typeof value === 'string' ? value : '';
      const shouldRequire = requiredWhenReject || req.body?.action === 'reject';

      if (!normalizedValue) {
        if (shouldRequire) {
          throw new Error('Reject reason is required.');
        }

        return true;
      }

      if (normalizedValue.length < 5) {
        throw new Error('Minimum length of reject reason is 5 characters.');
      }

      if (normalizedValue.length > 500) {
        throw new Error('Maximum length of reject reason is 500 characters.');
      }

      return true;
    });
}

const createOrUpdateGatepassValidation = [
  body('reason')
    .trim()
    .notEmpty()
    .withMessage('Reason of leaving is required.')
    .bail()
    .isLength({ min: 5 })
    .withMessage('Minimum length of reason is 5 characters.')
    .bail()
    .isLength({ max: 500 })
    .withMessage('Maximum length of reason is 500 characters.'),
  body('destination')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 200 })
    .withMessage('Destination cannot exceed 200 characters.'),
  body('outDate').isISO8601().withMessage('A valid out date is required.').toDate(),
  body('outTime').matches(TIME_REGEX).withMessage('Out time must be in HH:mm format.'),
  body('expectedReturnDate')
    .optional({ values: 'falsy' })
    .isISO8601()
    .withMessage('Expected return date must be a valid date.')
    .toDate(),
  body('expectedReturnTime')
    .optional({ values: 'falsy' })
    .matches(TIME_REGEX)
    .withMessage('Expected return time must be in HH:mm format.'),
  body('expectedReturnTime').custom((value, { req }) => {
    if (value && !req.body.expectedReturnDate) {
      throw new Error('Expected return date is required when expected return time is provided.');
    }
    return true;
  }),
  body('vehicleNumber')
    .optional({ values: 'falsy' })
    .trim()
    .matches(VEHICLE_NUMBER_REGEX)
    .withMessage('Vehicle number may contain only letters, numbers, spaces, and hyphens.'),
  body('expectedReturnDate').custom((value, { req }) => {
    if (value && req.body.outDate && new Date(value) < new Date(req.body.outDate)) {
      throw new Error('Expected return date cannot be before out date.');
    }
    return true;
  })
];

const createGatepassValidation = createOrUpdateGatepassValidation;
const updateGatepassValidation = [...gatepassIdParamValidation, ...createOrUpdateGatepassValidation];

const approveGatepassValidation = [
  ...gatepassIdParamValidation,
  body('comment')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 500 })
    .withMessage('Approval comment cannot exceed 500 characters.')
];

const rejectGatepassValidation = [
  ...gatepassIdParamValidation,
  buildRejectReasonValidation({ requiredWhenReject: true })
];

const forwardGatepassValidation = [
  ...gatepassIdParamValidation,
  body('forwardToUserId')
    .optional({ values: 'falsy' })
    .isMongoId()
    .withMessage('forwardToUserId must be a valid user ID.'),
  body('comment')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 500 })
    .withMessage('Forward comment cannot exceed 500 characters.')
];

const cancelGatepassValidation = [
  ...gatepassIdParamValidation,
  body('reason')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 500 })
    .withMessage('Cancellation reason cannot exceed 500 characters.')
];

const deleteGatepassValidation = [...cancelGatepassValidation];

function buildRoleActionValidation(allowedActions) {
  return [
    ...gatepassIdParamValidation,
    body('action')
      .trim()
      .isIn(allowedActions)
      .withMessage(`action must be one of: ${allowedActions.join(', ')}`),
    body('comment')
      .optional({ values: 'falsy' })
      .trim()
      .isLength({ max: 500 })
      .withMessage('Comment cannot exceed 500 characters.'),
    buildRejectReasonValidation(),
    body('forwardToUserId')
      .optional({ values: 'falsy' })
      .isMongoId()
      .withMessage('forwardToUserId must be a valid user ID.')
  ];
}

const principalRoleActionValidation = buildRoleActionValidation(['approve', 'reject', 'forward']);
const hodRoleActionValidation = buildRoleActionValidation(['approve', 'reject']);
const caoRoleActionValidation = buildRoleActionValidation(['approve', 'reject']);

const verifyTokenValidation = [
  param('token').trim().notEmpty().withMessage('Verification token is required.')
];

const verifyGatepassIdValidation = [
  param('gatepassId')
    .trim()
    .notEmpty()
    .withMessage('Gatepass ID is required.')
    .bail()
    .matches(/^[A-Z0-9-]{3,64}$/i)
    .withMessage('Gatepass ID must contain only letters, numbers, and hyphens.')
];

const scanQrValidation = [
  body('rawValue')
    .trim()
    .notEmpty()
    .withMessage('Scanned QR value is required.')
    .bail()
    .isLength({ max: 5000 })
    .withMessage('Scanned QR value is too large.')
];

const securityActionValidation = [
  ...gatepassIdParamValidation,
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
  approveGatepassValidation,
  cancelGatepassValidation,
  caoRoleActionValidation,
  createGatepassValidation,
  deleteGatepassValidation,
  forwardGatepassValidation,
  gatepassIdParamValidation,
  hodRoleActionValidation,
  principalRoleActionValidation,
  rejectGatepassValidation,
  securityActionValidation,
  scanQrValidation,
  updateGatepassValidation,
  verifyGatepassIdValidation,
  verifyTokenValidation
};
