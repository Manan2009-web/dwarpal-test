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

// Middleware: If in degraded mode, block DB-dependent API routes
app.use((req, res, next) => {
  if (app.locals.degradedMode && req.path.startsWith('/api') && req.path !== '/api/health') {
    return res.status(503).json({
      success: false,
      message: 'Service unavailable: database is not connected',
      degradedMode: true
    });
  }
  next();
});
const frontendDistDir = path.resolve(__dirname, '..', '..', 'dist');
const frontendIndexPath = path.join(frontendDistDir, 'index.html');
const hasFrontendBuild = fs.existsSync(frontendIndexPath);

// Trust proxy
app.set('trust proxy', env.trustProxy);

const allowedOrigins = Array.from(
  new Set((Array.isArray(env.allowedOrigins) ? env.allowedOrigins : []).map((origin) => normalizeOrigin(origin)).filter(Boolean))
);

function normalizeOrigin(origin) {
  return String(origin || '').trim().replace(/\/+$/, '');
}

// CORS config
const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }

    const normalizedOrigin = normalizeOrigin(origin);

    if (allowedOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }

    console.warn(`[cors] Blocked origin: ${origin}`);

    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 24 * 60 * 60,
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
  const databaseState = connectDatabase.getDatabaseState ? connectDatabase.getDatabaseState() : null;
  const databaseReady = ['external', 'in-memory'].includes(databaseState?.mode);

  return res.status(databaseReady ? 200 : 503).json({
    success: databaseReady,
    message: databaseReady
      ? 'DwarPal backend is healthy'
      : 'DwarPal backend is running without a ready database connection',
    timestamp: new Date().toISOString(),
    data: {
      apiBasePath: '/api',
      clientUrl: env.clientUrl || null,
      serverUrl: env.serverUrl || null,
      environment: env.nodeEnv,
      degradedMode: Boolean(app.locals.degradedMode),
      database: databaseState
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
