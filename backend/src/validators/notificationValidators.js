const { body, param } = require('express-validator');

const notificationIdParamValidation = [
  param('id').isMongoId().withMessage('Valid notification ID is required.')
];

const saveNotificationTokenValidation = [
  body('token')
    .trim()
    .isLength({ min: 32, max: 4096 })
    .withMessage('A valid device token is required.'),
  body('device')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 200 })
    .withMessage('Device label cannot exceed 200 characters.')
];

module.exports = {
  notificationIdParamValidation,
  saveNotificationTokenValidation
};
