const AppError = require('../utils/appError');
const { buildValidationAppError, getDuplicateFieldMessage } = require('../utils/validation');

function notFoundHandler(req, res, next) {
  next(new AppError(`Route not found: ${req.originalUrl}`, 404));
}

function errorHandler(err, req, res, next) {
  let error = err;

  if (!(error instanceof AppError)) {
    if (error.name === 'CastError') {
      error = new AppError('Invalid resource id', 400);
    } else if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyValue || {})[0] || 'field';
      const duplicateMessage = getDuplicateFieldMessage(duplicateField);
      error = new AppError(duplicateMessage, 409, [
        {
          field: duplicateField,
          message: duplicateMessage
        }
      ]);
    } else if (error.name === 'ValidationError') {
      error = buildValidationAppError(
        Object.values(error.errors).map((item) => ({
          field: item.path,
          message: item.message
        }))
      );
    } else if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      error = new AppError('Invalid or expired authentication token', 401);
    } else if (error.message === 'Only image files are allowed') {
      error = new AppError(error.message, 400);
    } else {
      error = new AppError(error.message || 'Internal server error', error.statusCode || 500);
    }
  }

  const response = {
    success: false,
    message: error.message || 'Internal server error',
    timestamp: new Date().toISOString()
  };

  if (error.errors) {
    response.errors = error.errors;
  }

  if (process.env.NODE_ENV !== 'production' && err && err.stack) {
    response.stack = err.stack;
    console.error(`[${req.method}] ${req.originalUrl}`, err);
  }

  res.status(error.statusCode || 500).json(response);
}

module.exports = {
  errorHandler,
  notFoundHandler
};
