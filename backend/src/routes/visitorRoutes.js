const express = require('express');
const { body } = require('express-validator');
const { protect, requireVerifiedEmail } = require('../middleware/authMiddleware');
const authorize = require('../middleware/authorize');
const validateRequest = require('../middleware/validateRequest');
const visitorController = require('../controllers/visitorController');

const router = express.Router();

// Apply auth middleware - only authorized security staff or CAO/Principal can verify visitors
router.use(protect, requireVerifiedEmail);

// Define POST validation schema
const verifyVisitorValidation = [
  body('visitorName')
    .trim()
    .notEmpty()
    .withMessage('Visitor name is required')
    .isLength({ max: 100 })
    .withMessage('Visitor name must be under 100 characters'),
  body('visitorType')
    .trim()
    .notEmpty()
    .withMessage('Visitor type is required'),
  body('purpose')
    .trim()
    .notEmpty()
    .withMessage('Purpose of visit is required')
    .isLength({ max: 250 })
    .withMessage('Purpose must be under 250 characters'),
  body('hostName')
    .trim()
    .notEmpty()
    .withMessage('Host name is required'),
  body('hostDept')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Host department must be a non-empty string'),
  body('checkInTime')
    .optional()
    .isISO8601()
    .withMessage('Check-in time must be a valid ISO 8601 date'),
  body('permittedHours')
    .optional()
    .trim()
    .matches(/^\d{2}:\d{2}-\d{2}:\d{2}$/)
    .withMessage('Permitted hours must be in HH:MM-HH:MM format'),
  body('hostApproved')
    .optional()
    .isBoolean()
    .withMessage('Host approval must be a boolean'),
  body('isBlacklisted')
    .optional()
    .isBoolean()
    .withMessage('Blacklist status must be a boolean')
];

/**
 * Endpoint for high-throughput visitor verification using compressed LLM instructions,
 * SSE streaming, Redis/In-memory caching, and Keep-Alive connection pooling.
 */
router.post(
  '/verify',
  authorize('security', 'principal', 'hod', 'cao'),
  verifyVisitorValidation,
  validateRequest,
  visitorController.verifyVisitor
);

module.exports = router;
