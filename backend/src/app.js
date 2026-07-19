const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const env = require('./config/env');
const connectDatabase = require('./config/db');
const dbConnectMiddleware = require('./middleware/dbConnectMiddleware');
const requestId = require('./middleware/requestId');
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

// ── Security: Correlation ID (first so every log line can reference it) ──
app.use(requestId);

// ── Security: Helmet — HTTP security headers ──────────────────────────────
// Adds: Strict-Transport-Security, X-Content-Type-Options (already in
// responseSecurityMiddleware but helmet's version applies globally),
// X-DNS-Prefetch-Control, X-Download-Options, X-Frame-Options,
// X-Permitted-Cross-Domain-Policies, and removes X-Powered-By.
// CSP is NOT set here — it is served via <meta> in index.html (Phase 3)
// to keep the Vite dev proxy and production build in sync.
app.use(
  helmet({
    contentSecurityPolicy: false,   // managed via meta tag in index.html
    crossOriginEmbedderPolicy: false // relaxed — needed for QR image loading
  })
);

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

    if (env.isDevelopment) {
      console.info(`[cors] Allowing development origin: ${origin}`);
      return callback(null, true);
    }

    console.warn(`[cors] Blocked origin: ${origin}`);

    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-portal-access-token'],
  maxAge: 24 * 60 * 60,
  optionsSuccessStatus: 204
};

// Handle CORS before routes
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── /uploads — serve only image/video files, require a valid auth cookie ────
// This prevents unauthenticated enumeration of uploaded files and blocks
// serving of unexpected file types (e.g. HTML, JS) from the uploads dir.
const ALLOWED_UPLOAD_MIME_PREFIXES = ['image/', 'video/', 'application/pdf'];
const { protect } = require('./middleware/authMiddleware');

app.use('/uploads', protect, (req, res, next) => {
  // Only allow safe file extensions that map to the permitted MIME prefixes.
  const ext = path.extname(req.path).toLowerCase();
  const safeExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.pdf', '.mp4', '.webm'];

  if (!safeExtensions.includes(ext)) {
    return res.status(403).json({ success: false, message: 'File type not permitted.', errorCode: 'ERR_FORBIDDEN' });
  }

  next();
}, express.static(path.join(__dirname, '..', 'uploads'), {
  // Never allow directory listings
  index: false,
  // Strip dotfiles
  dotfiles: 'deny'
}));


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

app.get('/api/health', dbConnectMiddleware, (req, res) => {
  const databaseState = connectDatabase.getDatabaseState ? connectDatabase.getDatabaseState() : null;
  const databaseReady = ['external', 'in-memory'].includes(databaseState?.mode);

  return res.status(200).json({
    status: 'ok',
    success: true,
    message: 'DwarPal backend is reachable',
    timestamp: new Date().toISOString(),
    data: {
      apiBasePath: '/api',
      clientUrl: env.clientUrl || null,
      serverUrl: env.serverUrl || null,
      environment: env.nodeEnv,
      degradedMode: Boolean(app.locals.degradedMode),
      database: databaseState,
      databaseReady
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
