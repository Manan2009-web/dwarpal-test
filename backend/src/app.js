const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const env = require('./config/env');
const connectDatabase = require('./config/db');
const routes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middleware/errorMiddleware');
const responseSecurityMiddleware = require('./middleware/responseSecurityMiddleware');

const app = express();
const frontendDistDir = path.resolve(__dirname, '..', '..', 'dist');
const frontendIndexPath = path.join(frontendDistDir, 'index.html');
const hasFrontendBuild = fs.existsSync(frontendIndexPath);

// Trust proxy
app.set('trust proxy', env.trustProxy);

// Safe allowed origins list
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://dwarpal-test.vercel.app',
  ...(Array.isArray(env.allowedOrigins) ? env.allowedOrigins : [])
].filter(Boolean);

// CORS config
const corsOptions = {
  origin(origin, callback) {
    // Allow server-to-server requests or tools with no origin
    if (!origin) {
      return callback(null, true);
    }

    // Allow exact configured origins
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Allow env helper if available
    if (typeof env.isOriginAllowed === 'function' && env.isOriginAllowed(origin)) {
      return callback(null, true);
    }

    // Return false instead of throwing AppError in CORS phase
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204
};

// Handle CORS before routes
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

  return res.status(200).json({
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
  return res.status(200).json({
    success: true,
    message: 'DwarPal backend is healthy',
    timestamp: new Date().toISOString(),
    data: {
      environment: env.nodeEnv,
      database: connectDatabase.getDatabaseState ? connectDatabase.getDatabaseState() : null
    }
  });
});

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