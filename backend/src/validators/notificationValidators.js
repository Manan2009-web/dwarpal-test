const { param } = require('express-validator');

const notificationIdParamValidation = [
  param('id').isMongoId().withMessage('Valid notification ID is required.')
];

module.exports = {
  notificationIdParamValidation
};
