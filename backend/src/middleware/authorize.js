const AppError = require('../utils/appError');

function authorize(...allowedRoles) {
  return function authorizeMiddleware(req, res, next) {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError(
          `Role ${req.user.role} is not allowed to access this resource. Allowed roles: ${allowedRoles.join(', ')}`,
          403
        )
      );
    }

    return next();
  };
}

module.exports = authorize;
