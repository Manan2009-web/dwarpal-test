const { validationResult } = require('express-validator');
const { buildValidationAppError } = require('../utils/validation');

function validateRequest(req, res, next) {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return next(buildValidationAppError(errors.array()));
  }

  return next();
}

module.exports = validateRequest;
