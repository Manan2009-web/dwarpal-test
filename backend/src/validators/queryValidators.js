const { query } = require('express-validator');
const { DEPARTMENTS } = require('../constants/appConstants');

const basePaginationQueryValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer').toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('limit must be between 1 and 50')
    .toInt(),
  query('sortBy')
    .optional()
    .isIn(['updatedAt', 'createdAt', 'outDate'])
    .withMessage('sortBy must be updatedAt, createdAt, or outDate'),
  query('order').optional().isIn(['asc', 'desc']).withMessage('order must be asc or desc'),
  query('since').optional().isISO8601().withMessage('since must be a valid ISO date'),
  query('fromDate').optional().isISO8601().withMessage('fromDate must be a valid ISO date'),
  query('toDate').optional().isISO8601().withMessage('toDate must be a valid ISO date'),
  query('status')
    .optional()
    .matches(/^[a-z_,]+$/)
    .withMessage('status may contain lowercase letters, underscores, and commas only'),
  query('applicantType')
    .optional()
    .isIn(['student', 'faculty'])
    .withMessage('applicantType must be student or faculty'),
  query('department')
    .optional()
    .isIn(DEPARTMENTS)
    .withMessage(`department must be one of: ${DEPARTMENTS.join(', ')}`),
  query('q')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('q must be between 1 and 100 characters')
];

const dashboardQueryValidation = [
  query('since').optional().isISO8601().withMessage('since must be a valid ISO date')
];

const securityPendingQueryValidation = [
  ...basePaginationQueryValidation,
  query('date').optional().isISO8601().withMessage('date must be a valid ISO date')
];

module.exports = {
  basePaginationQueryValidation,
  dashboardQueryValidation,
  securityPendingQueryValidation
};
