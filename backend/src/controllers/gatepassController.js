const { sendSuccess } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { getRequestMeta } = require('../utils/request');
const AppError = require('../utils/appError');
const gatepassService = require('../services/gatepassService');
const securityQrService = require('../services/securityQrService');

function buildCancellationPayload(body = {}) {
  return {
    reason: body.reason || body.rejectionReason || 'Cancelled by requester'
  };
}

async function executeRoleAction(req) {
  const requestMeta = getRequestMeta(req);
  const { action, rejectionReason } = req.body;

  if (action === 'forward') {
    return gatepassService.forwardGatepass(req.params.id, req.user, req.body, requestMeta);
  }

  if (action === 'forward_to_coordinator') {
    return gatepassService.forwardGatepassToCoordinator(req.params.id, req.user, req.body, requestMeta);
  }

  if (action === 'approve') {
    return gatepassService.approveGatepass(req.params.id, req.user, req.body, requestMeta);
  }

  if (action === 'reject') {
    if (!rejectionReason?.trim()) {
      throw new AppError('Reject reason is required.', 422, [
        {
          field: 'rejectionReason',
          message: 'Reject reason is required.'
        }
      ]);
    }

    return gatepassService.rejectGatepass(req.params.id, req.user, req.body, requestMeta);
  }

  throw new AppError('Unsupported gatepass action', 400);
}

const createGatepass = asyncHandler(async (req, res) => {
  const gatepass = await gatepassService.createGatepass(req.user, req.body, getRequestMeta(req));
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Gatepass created successfully',
    data: gatepass
  });
});

const getMyGatepasses = asyncHandler(async (req, res) => {
  const result = await gatepassService.getMyGatepasses(req.user, req.query);
  return sendSuccess(res, {
    message: 'Your gatepasses fetched successfully',
    data: result.gatepasses,
    meta: result.meta
  });
});

const getGatepassHistory = asyncHandler(async (req, res) => {
  const result = await gatepassService.getGatepassHistory(req.user, req.query);
  return sendSuccess(res, {
    message: 'Gatepass history fetched successfully',
    data: result.gatepasses,
    meta: result.meta
  });
});

const getGatepassById = asyncHandler(async (req, res) => {
  const gatepass = await gatepassService.getGatepassDetails(req.params.id, req.user);
  return sendSuccess(res, {
    message: 'Gatepass fetched successfully',
    data: gatepass
  });
});

const updateGatepass = asyncHandler(async (req, res) => {
  const gatepass = await gatepassService.updateGatepass(
    req.params.id,
    req.user,
    req.body,
    getRequestMeta(req)
  );
  return sendSuccess(res, {
    message: 'Gatepass updated successfully',
    data: gatepass
  });
});

const cancelGatepass = asyncHandler(async (req, res) => {
  const gatepass = await gatepassService.cancelGatepass(
    req.params.id,
    req.user,
    req.body,
    getRequestMeta(req)
  );
  return sendSuccess(res, {
    message: 'Gatepass cancelled successfully',
    data: gatepass
  });
});

const deleteGatepass = asyncHandler(async (req, res) => {
  const gatepass = await gatepassService.cancelGatepass(
    req.params.id,
    req.user,
    buildCancellationPayload(req.body),
    getRequestMeta(req)
  );
  return sendSuccess(res, {
    message: 'Gatepass deleted successfully',
    data: gatepass
  });
});

const getPendingForPrincipal = asyncHandler(async (req, res) => {
  const result = await gatepassService.getPendingGatepassesForRole(req.user, req.query);
  return sendSuccess(res, {
    message: 'Pending student gatepasses fetched successfully',
    data: result.gatepasses,
    meta: result.meta
  });
});

const getPendingForHod = asyncHandler(async (req, res) => {
  const result = await gatepassService.getPendingGatepassesForRole(req.user, req.query);
  return sendSuccess(res, {
    message: 'Forwarded gatepasses fetched successfully',
    data: result.gatepasses,
    meta: result.meta
  });
});

const getPendingForCoordinator = asyncHandler(async (req, res) => {
  const result = await gatepassService.getPendingGatepassesForRole(req.user, req.query);
  return sendSuccess(res, {
    message: 'Coordinator pending gatepasses fetched successfully',
    data: result.gatepasses,
    meta: result.meta
  });
});

const getPendingForCao = asyncHandler(async (req, res) => {
  const result = await gatepassService.getPendingGatepassesForRole(req.user, req.query);
  return sendSuccess(res, {
    message: 'Pending faculty gatepasses fetched successfully',
    data: result.gatepasses,
    meta: result.meta
  });
});

const getPendingForSecurity = asyncHandler(async (req, res) => {
  const result = await gatepassService.getPendingGatepassesForRole(req.user, req.query);
  return sendSuccess(res, {
    message: 'Pending security gatepasses fetched successfully',
    data: result.gatepasses,
    meta: result.meta
  });
});

const forwardGatepass = asyncHandler(async (req, res) => {
  const gatepass = await gatepassService.forwardGatepass(
    req.params.id,
    req.user,
    req.body,
    getRequestMeta(req)
  );
  return sendSuccess(res, {
    message: 'Gatepass forwarded successfully',
    data: gatepass
  });
});

const forwardGatepassToCoordinator = asyncHandler(async (req, res) => {
  const gatepass = await gatepassService.forwardGatepassToCoordinator(
    req.params.id,
    req.user,
    req.body,
    getRequestMeta(req)
  );
  return sendSuccess(res, {
    message: 'Gatepass forwarded to coordinator successfully',
    data: gatepass
  });
});

const approveGatepass = asyncHandler(async (req, res) => {
  const gatepass = await gatepassService.approveGatepass(
    req.params.id,
    req.user,
    req.body,
    getRequestMeta(req)
  );
  return sendSuccess(res, {
    message: 'Gatepass approved successfully',
    data: gatepass
  });
});

const rejectGatepass = asyncHandler(async (req, res) => {
  const gatepass = await gatepassService.rejectGatepass(
    req.params.id,
    req.user,
    req.body,
    getRequestMeta(req)
  );
  return sendSuccess(res, {
    message: 'Gatepass rejected successfully',
    data: gatepass
  });
});

const verifyGatepassByToken = asyncHandler(async (req, res) => {
  const result = await securityQrService.verifyGatepassByToken(req.params.token, req.user);
  return sendSuccess(res, {
    message: result.message,
    data: {
      valid: result.valid,
      gatepass: result.gatepass,
      nextAction: result.nextAction || null
    }
  });
});

const verifyGatepassById = asyncHandler(async (req, res) => {
  const result = await securityQrService.verifyGatepassById(req.params.gatepassId, req.user);
  return sendSuccess(res, {
    message: result.message,
    data: {
      valid: result.valid,
      gatepass: result.gatepass,
      nextAction: result.nextAction || null
    }
  });
});

const scanGatepassQr = asyncHandler(async (req, res) => {
  const result = await securityQrService.verifyScannedQrValue(req.body.rawValue, req.user);
  return sendSuccess(res, {
    message: result.message,
    data: {
      valid: result.valid,
      gatepass: result.gatepass,
      nextAction: result.nextAction || null
    }
  });
});

const checkOutGatepass = asyncHandler(async (req, res) => {
  const gatepass = await gatepassService.checkOutGatepass(
    req.params.id,
    req.user,
    req.body,
    getRequestMeta(req)
  );
  return sendSuccess(res, {
    message: 'Gatepass checked out successfully',
    data: gatepass
  });
});

const checkInGatepass = asyncHandler(async (req, res) => {
  const gatepass = await gatepassService.checkInGatepass(
    req.params.id,
    req.user,
    req.body,
    getRequestMeta(req)
  );
  return sendSuccess(res, {
    message: 'Gatepass marked as completed successfully',
    data: gatepass
  });
});

const getSecurityReadyGatepasses = asyncHandler(async (req, res) => {
  const result = await gatepassService.getSecurityReadyGatepasses(req.user, req.query);
  return sendSuccess(res, {
    message: 'Security-ready gatepasses fetched successfully',
    data: result.gatepasses,
    meta: result.meta
  });
});

const handlePrincipalAction = asyncHandler(async (req, res) => {
  const gatepass = await executeRoleAction(req);
  return sendSuccess(res, {
    message: `Principal action "${req.body.action}" completed successfully`,
    data: gatepass
  });
});

const handleHodAction = asyncHandler(async (req, res) => {
  const gatepass = await executeRoleAction(req);
  return sendSuccess(res, {
    message: `HOD action "${req.body.action}" completed successfully`,
    data: gatepass
  });
});

const handleCaoAction = asyncHandler(async (req, res) => {
  const gatepass = await executeRoleAction(req);
  return sendSuccess(res, {
    message: `CAO action "${req.body.action}" completed successfully`,
    data: gatepass
  });
});

module.exports = {
  approveGatepass,
  cancelGatepass,
  checkInGatepass,
  checkOutGatepass,
  createGatepass,
  deleteGatepass,
  forwardGatepass,
  getGatepassById,
  getGatepassHistory,
  getMyGatepasses,
  getPendingForCao,
  getPendingForHod,
  getPendingForCoordinator,
  getPendingForPrincipal,
  getPendingForSecurity,
  getSecurityReadyGatepasses,
  handleCaoAction,
  handleHodAction,
  handlePrincipalAction,
  forwardGatepassToCoordinator,
  rejectGatepass,
  scanGatepassQr,
  updateGatepass,
  verifyGatepassById,
  verifyGatepassByToken
};
