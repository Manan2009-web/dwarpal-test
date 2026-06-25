const connectDatabase = require('../config/db');

/**
 * Middleware to ensure database is connected before executing routes.
 * Specifically useful in serverless/Vercel environments.
 */
async function dbConnectMiddleware(req, res, next) {
  try {
    await connectDatabase();
    next();
  } catch (error) {
    console.error('[dbConnectMiddleware] Database connection failed:', error);
    
    // Pass the connection error to Express error handler
    next(error);
  }
}

module.exports = dbConnectMiddleware;
