const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const env = require('./config/env');
const connectDatabase = require('./config/db');
const AppError = require('./utils/appError');
const routes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middleware/errorMiddleware');
const responseSecurityMiddleware = require('./middleware/responseSecurityMiddleware');

const app = express();
const frontendDistDir = path.resolve(__dirname, '..', '..', 'dist');
const frontendIndexPath = path.join(frontendDistDir, 'index.html');
const hasFrontendBuild = fs.existsSync(frontendIndexPath);

const corsOptions = {
  origin(origin, callback) {
    if (env.isOriginAllowed(origin)) {
      return callback(null, true);
    }

    return callback(new AppError(`Origin ${origin} is not allowed by CORS`, 403));
  },
  credentials: true
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
if (hasFrontendBuild) {
  app.use(express.static(frontendDistDir));
}
app.use('/api', responseSecurityMiddleware);

app.get('/', (req, res) => {
  if (hasFrontendBuild && req.accepts('html')) {
    return res.sendFile(frontendIndexPath);
  }

  res.status(200).json({
    success: true,
    message: 'DwarPal backend is running',
    timestamp: new Date().toISOString(),
    data: {
      environment: env.nodeEnv,
      apiHealth: '/api/health'
    }
  });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'DwarPal backend is healthy',
    timestamp: new Date().toISOString(),
    data: {
      environment: env.nodeEnv,
      database: connectDatabase.getDatabaseState ? connectDatabase.getDatabaseState() : null
    }
  });
});

// Rate limiting can be inserted here later with express-rate-limit for auth and polling endpoints.
app.use('/api', routes);

if (hasFrontendBuild) {
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }

    if (!req.accepts('html')) {
      return next();
    }

    return res.sendFile(frontendIndexPath);
  });
}

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
