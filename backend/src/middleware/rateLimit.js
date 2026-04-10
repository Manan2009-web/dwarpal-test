const asyncHandler = require('../utils/asyncHandler');
const { consumeRateLimit, createRateLimitError } = require('../services/authRateLimitService');

function resolveOption(option, context) {
  return typeof option === 'function' ? option(context) : option;
}

function createRateLimiter({
  scope,
  windowMs = 15 * 60 * 1000,
  max = 10,
  blockDurationMs = windowMs,
  message = 'Too many requests. Please try again later.',
  keyGenerator = (req) => req.ip || '',
  errorCode = 'RATE_LIMITED',
  errors = null,
  skip = null
} = {}) {
  return asyncHandler(async (req, res, next) => {
    if (typeof skip === 'function' && skip(req)) {
      return next();
    }

    const key = resolveOption(keyGenerator, { req });
    if (!String(key || '').trim()) {
      return next();
    }

    const result = await consumeRateLimit({
      scope: String(scope || `${req.baseUrl || ''}:${req.path || ''}`).trim(),
      key,
      limit: max,
      windowMs,
      blockDurationMs
    });

    if (!result.allowed) {
      throw createRateLimitError({
        message: resolveOption(message, { req, result, max, windowMs, blockDurationMs }),
        retryAfterSeconds: result.retryAfterSeconds,
        code: resolveOption(errorCode, { req, result, max, windowMs, blockDurationMs }) || 'RATE_LIMITED',
        errors: resolveOption(errors, { req, result, max, windowMs, blockDurationMs }),
        rateLimit: {
          scope: String(scope || `${req.baseUrl || ''}:${req.path || ''}`).trim(),
          limit: max,
          resetAt: result.resetAt ? result.resetAt.toISOString() : null
        }
      });
    }

    return next();
  });
}

module.exports = createRateLimiter;
