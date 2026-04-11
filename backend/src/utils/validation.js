const AppError = require('./appError');

function toHumanFieldName(field) {
  return String(field || 'field')
    .replace(/\.(\d+)\./g, ' $1 ')
    .replace(/[._]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim()
    .replace(/^./, (value) => value.toUpperCase());
}

function normalizeValidationErrors(errors = []) {
  const normalizedErrors = [];
  const seenFields = new Set();

  (Array.isArray(errors) ? errors : []).forEach((item) => {
    const field = item?.field || item?.path || item?.param || 'field';
    const message = item?.message || item?.msg || 'Invalid value.';

    if (seenFields.has(field)) {
      return;
    }

    normalizedErrors.push({
      field,
      message
    });
    seenFields.add(field);
  });

  return normalizedErrors;
}

function getValidationSummary(errors = [], fallbackMessage = 'Please review the highlighted fields.') {
  return errors[0]?.message || fallbackMessage;
}

function buildValidationAppError(errors = [], fallbackMessage = 'Please review the highlighted fields.', statusCode = 422) {
  const normalizedErrors = normalizeValidationErrors(errors);
  return new AppError(getValidationSummary(normalizedErrors, fallbackMessage), statusCode, normalizedErrors);
}

function getDuplicateFieldMessage(field) {
  if (field === 'gatepassId' || field === 'passNumber') {
    return 'Gatepass ID already exists.';
  }

  if (field === 'email') {
    return 'This email is already registered.';
  }

  if (field === 'phone') {
    return 'This phone number is already registered.';
  }

  if (field === 'enrollmentNo' || field === 'enrollment') {
    return 'This enrollment ID already exists.';
  }

  if (field === 'employeeId') {
    return 'This employee ID already exists.';
  }

  return `${toHumanFieldName(field)} already exists.`;
}

module.exports = {
  buildValidationAppError,
  getDuplicateFieldMessage,
  normalizeValidationErrors,
  toHumanFieldName
};
