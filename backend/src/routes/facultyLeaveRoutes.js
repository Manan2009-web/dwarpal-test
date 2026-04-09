const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const authorize = require('../middleware/authorize');
const validateRequest = require('../middleware/validateRequest');
const facultyLeaveController = require('../controllers/facultyLeaveController');
const {
  approveFacultyLeaveRequestValidation,
  createFacultyLeaveRequestValidation,
  facultyLeaveSecurityActionValidation,
  facultyLeaveIdParamValidation,
  rejectFacultyLeaveRequestValidation
} = require('../validators/facultyLeaveValidators');
const { basePaginationQueryValidation } = require('../validators/queryValidators');

const router = express.Router();

router.use(protect);

router.post(
  '/',
  authorize('faculty'),
  createFacultyLeaveRequestValidation,
  validateRequest,
  facultyLeaveController.createFacultyLeaveRequest
);
router.get(
  '/my',
  authorize('faculty'),
  basePaginationQueryValidation,
  validateRequest,
  facultyLeaveController.getMyFacultyLeaveRequests
);
router.get(
  '/history',
  authorize('faculty', 'hod', 'principal', 'cao', 'security'),
  basePaginationQueryValidation,
  validateRequest,
  facultyLeaveController.getFacultyLeaveHistory
);
router.get(
  '/pending/hod',
  authorize('hod'),
  basePaginationQueryValidation,
  validateRequest,
  facultyLeaveController.getPendingForHod
);
router.get(
  '/pending/principal',
  authorize('principal'),
  basePaginationQueryValidation,
  validateRequest,
  facultyLeaveController.getPendingForPrincipal
);
router.get(
  '/pending/cao',
  authorize('cao'),
  basePaginationQueryValidation,
  validateRequest,
  facultyLeaveController.getPendingForCao
);
router.post(
  '/:id/check-out',
  authorize('security'),
  facultyLeaveSecurityActionValidation,
  validateRequest,
  facultyLeaveController.checkOutFacultyLeaveRequest
);
router.post(
  '/:id/check-in',
  authorize('security'),
  facultyLeaveSecurityActionValidation,
  validateRequest,
  facultyLeaveController.checkInFacultyLeaveRequest
);
router.post(
  '/:id/approve',
  authorize('hod', 'principal', 'cao'),
  approveFacultyLeaveRequestValidation,
  validateRequest,
  facultyLeaveController.approveFacultyLeaveRequest
);
router.post(
  '/:id/reject',
  authorize('hod', 'principal', 'cao'),
  rejectFacultyLeaveRequestValidation,
  validateRequest,
  facultyLeaveController.rejectFacultyLeaveRequest
);
router.get(
  '/:id',
  authorize('faculty', 'hod', 'principal', 'cao', 'security'),
  facultyLeaveIdParamValidation,
  validateRequest,
  facultyLeaveController.getFacultyLeaveById
);

module.exports = router;
