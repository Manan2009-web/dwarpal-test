const { protect } = require('./authMiddleware');
const AppError = require('../utils/appError');
const {
  canAccessAdminPortal,
  canExportReport,
  getAdminAccessProfile,
  isCoordinator
} = require('../utils/adminScope');

function requireAuth(req, res, next) {
  return protect(req, res, next);
}

function allowRoles(...roles) {
  const allowedRoles = roles.map((role) => String(role || '').trim().toLowerCase()).filter(Boolean);

  return function allowRolesMiddleware(req, res, next) {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    const role = String(req.user.role || '').trim().toLowerCase();

    if (!allowedRoles.includes(role)) {
      return next(new AppError('You do not have permission to access this resource.', 403));
    }

    return next();
  };
}

function allowAdminAccess(req, res, next) {
  if (!req.user) {
    return next(new AppError('Authentication required', 401));
  }

  if (!canAccessAdminPortal(req.user)) {
    return next(new AppError('Admin portal access is not enabled for this account.', 403));
  }

  req.adminAccess = getAdminAccessProfile(req.user);
  return next();
}

function allowCoordinatorOrAdmin(req, res, next) {
  if (!req.user) {
    return next(new AppError('Authentication required', 401));
  }

  if (isCoordinator(req.user) || canAccessAdminPortal(req.user)) {
    req.adminAccess = getAdminAccessProfile(req.user);
    return next();
  }

  return next(new AppError('Coordinator or admin access is required.', 403));
}

function allowExportAccess(req, res, next) {
  const reportType = req.body?.reportType || req.query?.reportType;

  if (!canExportReport(req.user, reportType)) {
    return next(new AppError('You do not have permission to export this report.', 403));
  }

  return next();
}

function scopeFilterMiddleware(req, res, next) {
  req.adminAccess = req.adminAccess || getAdminAccessProfile(req.user);
  return next();
}

module.exports = {
  allowAdminAccess,
  allowCoordinatorOrAdmin,
  allowExportAccess,
  allowRoles,
  requireAuth,
  scopeFilterMiddleware
};
