const express = require('express');
const { protect, requireVerifiedEmail } = require('../middleware/authMiddleware');
const authorize = require('../middleware/authorize');
const validateRequest = require('../middleware/validateRequest');
const gatepassController = require('../controllers/gatepassController');
const {
  approveGatepassValidation,
  caoRoleActionValidation,
  cancelGatepassValidation,
  createGatepassValidation,
  deleteGatepassValidation,
  forwardGatepassValidation,
  gatepassIdParamValidation,
  hodRoleActionValidation,
  principalRoleActionValidation,
  rejectGatepassValidation,
  scanQrValidation,
  securityActionValidation,
  updateGatepassValidation,
  verifyGatepassIdValidation,
  verifyTokenValidation
} = require('../validators/gatepassValidators');
const {
  basePaginationQueryValidation,
  securityPendingQueryValidation
} = require('../validators/queryValidators');

const router = express.Router();

router.use(protect, requireVerifiedEmail);
router.post('/', authorize('student', 'faculty'), createGatepassValidation, validateRequest, gatepassController.createGatepass);
router.get('/my', authorize('student', 'faculty'), basePaginationQueryValidation, validateRequest, gatepassController.getMyGatepasses);
router.get('/history', basePaginationQueryValidation, validateRequest, gatepassController.getGatepassHistory);
router.get('/pending/principal', authorize('principal'), basePaginationQueryValidation, validateRequest, gatepassController.getPendingForPrincipal);
router.get('/pending/hod', authorize('hod'), basePaginationQueryValidation, validateRequest, gatepassController.getPendingForHod);
router.get('/pending/coordinator', authorize('faculty'), basePaginationQueryValidation, validateRequest, gatepassController.getPendingForCoordinator);
router.get('/pending/cao', authorize('cao'), basePaginationQueryValidation, validateRequest, gatepassController.getPendingForCao);
router.get('/pending/security', authorize('security'), securityPendingQueryValidation, validateRequest, gatepassController.getPendingForSecurity);
router.get('/security/ready', authorize('security'), securityPendingQueryValidation, validateRequest, gatepassController.getSecurityReadyGatepasses);
router.post('/security/scan', authorize('security'), scanQrValidation, validateRequest, gatepassController.scanGatepassQr);
router.get('/security/verify-id/:gatepassId', authorize('security'), verifyGatepassIdValidation, validateRequest, gatepassController.verifyGatepassById);
router.get('/security/verify/:token', authorize('security'), verifyTokenValidation, validateRequest, gatepassController.verifyGatepassByToken);
router.patch('/security/checkout/:id', authorize('security'), securityActionValidation, validateRequest, gatepassController.checkOutGatepass);
router.patch('/security/checkin/:id', authorize('security'), securityActionValidation, validateRequest, gatepassController.checkInGatepass);
router.patch('/:id/check-out', authorize('security'), securityActionValidation, validateRequest, gatepassController.checkOutGatepass);
router.patch('/:id/check-in', authorize('security'), securityActionValidation, validateRequest, gatepassController.checkInGatepass);
router.patch('/:id/edit', authorize('student', 'faculty'), updateGatepassValidation, validateRequest, gatepassController.updateGatepass);
router.patch('/:id/principal-action', authorize('principal'), principalRoleActionValidation, validateRequest, gatepassController.handlePrincipalAction);
router.patch('/:id/hod-action', authorize('hod'), hodRoleActionValidation, validateRequest, gatepassController.handleHodAction);
router.patch('/:id/cao-action', authorize('cao'), caoRoleActionValidation, validateRequest, gatepassController.handleCaoAction);
router.patch('/:id/forward-to-hod', authorize('principal'), forwardGatepassValidation, validateRequest, gatepassController.forwardGatepass);
router.patch('/:id/forward-to-coordinator', authorize('hod'), forwardGatepassValidation, validateRequest, gatepassController.forwardGatepassToCoordinator);
router.patch('/:id/forward', authorize('principal'), forwardGatepassValidation, validateRequest, gatepassController.forwardGatepass);
router.patch('/:id/approve', authorize('principal', 'hod', 'cao', 'faculty'), approveGatepassValidation, validateRequest, gatepassController.approveGatepass);
router.patch('/:id/reject', authorize('principal', 'hod', 'cao', 'faculty'), rejectGatepassValidation, validateRequest, gatepassController.rejectGatepass);
router.post('/:id/forward', authorize('principal'), forwardGatepassValidation, validateRequest, gatepassController.forwardGatepass);
router.post('/:id/forward-to-coordinator', authorize('hod'), forwardGatepassValidation, validateRequest, gatepassController.forwardGatepassToCoordinator);
router.post('/:id/approve', authorize('principal', 'hod', 'cao', 'faculty'), approveGatepassValidation, validateRequest, gatepassController.approveGatepass);
router.post('/:id/reject', authorize('principal', 'hod', 'cao', 'faculty'), rejectGatepassValidation, validateRequest, gatepassController.rejectGatepass);
router.post('/:id/check-out', authorize('security'), securityActionValidation, validateRequest, gatepassController.checkOutGatepass);
router.post('/:id/check-in', authorize('security'), securityActionValidation, validateRequest, gatepassController.checkInGatepass);
router.patch('/:id/cancel', authorize('student', 'faculty'), cancelGatepassValidation, validateRequest, gatepassController.cancelGatepass);
router.put('/:id', authorize('student', 'faculty'), updateGatepassValidation, validateRequest, gatepassController.updateGatepass);
router.patch('/:id', authorize('student', 'faculty'), updateGatepassValidation, validateRequest, gatepassController.updateGatepass);
router.delete('/:id', authorize('student', 'faculty'), deleteGatepassValidation, validateRequest, gatepassController.deleteGatepass);
router.get('/:id', gatepassIdParamValidation, validateRequest, gatepassController.getGatepassById);

module.exports = router;
