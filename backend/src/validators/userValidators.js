const { body, param } = require('express-validator');
const { DEPARTMENTS, PHONE_REGEX, SEMESTERS } = require('../constants/appConstants');

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
  body('department')
    .optional()
    .trim()
    .isIn(DEPARTMENTS)
    .withMessage(`Department must be one of: ${DEPARTMENTS.join(', ')}`),
  body('semester').optional().custom((value) => {
    const numericSemester = Number(value);
    if (!SEMESTERS.includes(numericSemester)) {
      throw new Error('Semester must be between 1 and 8');
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
