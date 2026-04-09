const AppError = require('../utils/appError');

function createRateLimiter({
  windowMs = 15 * 60 * 1000,
  max = 10,
  message = 'Too many requests. Please try again later.'
} = {}) {
  const requests = new Map();

  return function rateLimitMiddleware(req, res, next) {
    const key = `${req.ip || 'unknown'}:${req.baseUrl || ''}:${req.path || ''}`;
    const now = Date.now();
    const entry = requests.get(key);

    if (!entry || entry.expiresAt <= now) {
      requests.set(key, {
        count: 1,
        expiresAt: now + windowMs
      });
      return next();
    }

    entry.count += 1;
    requests.set(key, entry);

    if (entry.count > max) {
      return next(new AppError(message, 429));
    }

    return next();
  };
}

module.exports = createRateLimiter;
