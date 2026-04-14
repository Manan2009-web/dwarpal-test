const http = require('http');
const app = require('./app');
const env = require('./config/env');
const connectDatabase = require('./config/db');
const Gatepass = require('./models/Gatepass');
const User = require('./models/User');
const { ensureRateLimitStorage } = require('./services/authRateLimitService');
const { seedDefaultAdmins } = require('./services/adminService');
const {
  startGatepassEscalationScheduler,
  stopGatepassEscalationScheduler
} = require('./services/gatepassService');
const { closeRealtimeServer, createRealtimeServer } = require('./services/realtimeService');

let shutdownPromise = null;
let processHandlersRegistered = false;

async function repairVerificationTokens() {
  const result = await Gatepass.updateMany(
    { verificationToken: null },
    { $unset: { verificationToken: 1 } }
  );

  if (result.modifiedCount > 0) {
    console.log(`[startup] Normalized ${result.modifiedCount} gatepass verification tokens.`);
  }
}

async function repairUserEmailVerificationState() {
  const [copiedLegacyFlags, copiedCurrentFlags, initializedMissingFlags] = await Promise.all([
    User.updateMany(
      {
        emailVerified: { $exists: false },
        isEmailVerified: { $exists: true }
      },
      [
        {
          $set: {
            emailVerified: '$isEmailVerified'
          }
        }
      ]
    ),
    User.updateMany(
      {
        emailVerified: { $exists: true },
        isEmailVerified: { $exists: false }
      },
      [
        {
          $set: {
            isEmailVerified: '$emailVerified'
          }
        }
      ]
    ),
    User.updateMany(
      {
        emailVerified: { $exists: false },
        isEmailVerified: { $exists: false }
      },
      {
        $set: {
          emailVerified: false,
          isEmailVerified: false
        }
      }
    )
  ]);

  const modifiedCount =
    Number(copiedLegacyFlags.modifiedCount || 0) +
    Number(copiedCurrentFlags.modifiedCount || 0) +
    Number(initializedMissingFlags.modifiedCount || 0);

  if (modifiedCount > 0) {
    console.log(`[startup] Normalized email verification state for ${modifiedCount} user records.`);
  }
}

function warnAboutBootstrapPassword() {
  if (env.isProduction && env.autoBootstrapSystemAccounts && env.seedAdminPassword === 'DwarPal@123') {
    console.warn(
      '[bootstrap] DEFAULT_ADMIN_PASSWORD is using the development fallback. Set a strong value before bootstrapping system accounts in production.'
    );
  }
}

async function ensureSystemAccounts() {
  if (!env.autoBootstrapSystemAccounts) {
    return null;
  }

  warnAboutBootstrapPassword();

  const result = await seedDefaultAdmins({
    onlyWhenDatabaseEmpty: true
  });
  const skippedReason = result.skipped?.[0]?.reason || null;

  if (skippedReason === 'database_not_empty') {
    console.log('[bootstrap] Existing users detected, so automatic system-account bootstrap was skipped.');
    return result;
  }

  console.log(
    `[bootstrap] System accounts ready (${result.created.length} created, ${result.updated.length} repaired, ${result.existing.length} already present).`
  );
  return result;
}

function validateStartupConfiguration() {
  const startupErrors = typeof env.validateStartupEnv === 'function' ? env.validateStartupEnv() : [];

  if (!startupErrors.length) {
    return;
  }

  const error = new Error(`Invalid startup configuration:\n- ${startupErrors.join('\n- ')}`);
  error.code = 'INVALID_STARTUP_CONFIGURATION';
  throw error;
}

async function runOptionalStartupTask(name, task) {
  try {
    await task();
  } catch (error) {
    console.warn(`[startup] ${name} skipped: ${error.message || error}`);
  }
}

function kickOffOptionalStartupTasks() {
  void (async () => {
    await runOptionalStartupTask('Auth rate-limit storage initialization', async () => {
    await ensureRateLimitStorage();
    console.log('[startup] Auth rate-limit storage ready.');
  });

    await runOptionalStartupTask('User email-verification repair', repairUserEmailVerificationState);
    await runOptionalStartupTask('Gatepass verification-token repair', repairVerificationTokens);
    await runOptionalStartupTask('System-account bootstrap', ensureSystemAccounts);
  })();
}

function startOptionalRuntimeServices(server) {
  try {
    startGatepassEscalationScheduler();
  } catch (error) {
    console.warn(`[startup] Gatepass escalation scheduler did not start: ${error.message || error}`);
  }

  try {
    createRealtimeServer(server);
  } catch (error) {
    console.warn(`[startup] Realtime server did not start: ${error.message || error}`);
  }
}

async function stopOptionalRuntimeServices() {
  stopGatepassEscalationScheduler();
  await closeRealtimeServer();
}

async function shutdownServer(server, exitCode = 0) {
  if (shutdownPromise) {
    return shutdownPromise;
  }

  shutdownPromise = (async () => {
    try {
      await stopOptionalRuntimeServices();

      if (server?.listening) {
        await new Promise((resolve, reject) => {
          server.close((error) => {
            if (error && error.code !== 'ERR_SERVER_NOT_RUNNING') {
              reject(error);
              return;
            }

            resolve();
          });
        });
      }

      if (connectDatabase.disconnectDatabase) {
        await connectDatabase.disconnectDatabase();
      }
    } catch (error) {
      console.error('Error while shutting down the DwarPal backend:', error);
      process.exit(1);
      return;
    }

    process.exit(exitCode);
  })();

  return shutdownPromise;
}

function registerProcessHandlers(server) {
  if (processHandlersRegistered) {
    return;
  }

  processHandlersRegistered = true;

  process.once('unhandledRejection', (error) => {
    console.error('Unhandled rejection:', error);
    void shutdownServer(server, 1);
  });

  process.once('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
    void shutdownServer(server, 1);
  });

  process.once('SIGINT', () => {
    void shutdownServer(server, 0);
  });

  process.once('SIGTERM', () => {
    void shutdownServer(server, 0);
  });
}

function createHttpServer() {
  const server = http.createServer(app);
  server.requestTimeout = env.httpRequestTimeoutMs;
  server.headersTimeout = env.httpHeadersTimeoutMs;
  server.keepAliveTimeout = env.httpKeepAliveTimeoutMs;
  return server;
}

function attachServerErrorHandler(server) {
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Failed to start server: port ${env.port} is already in use. Stop the existing process or change PORT.`);
    } else {
      console.error('HTTP server error:', error);
    }

    void shutdownServer(server, 1);
  });
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    const handleError = (error) => {
      server.off('listening', handleListening);
      reject(error);
    };

    const handleListening = () => {
      server.off('error', handleError);
      resolve();
    };

    server.once('error', handleError);
    server.once('listening', handleListening);
    server.listen(env.port, '0.0.0.0');
  });
}

async function startServer() {
  validateStartupConfiguration();
  app.locals.degradedMode = false;

  const database = await connectDatabase();
  const server = createHttpServer();

  await listen(server);
  attachServerErrorHandler(server);
  registerProcessHandlers(server);

  console.log(`DwarPal backend running on http://0.0.0.0:${env.port}`);
  console.log(`[startup] CORS allowed origins: ${env.allowedOrigins.join(', ')}`);
  console.log(`Database mode: ${database.mode}`);
  if (database.uri) {
    console.log(`[startup] MongoDB host: ${database.uri}`);
  }
  console.log(
    `HTTP timeouts configured (request=${env.httpRequestTimeoutMs}ms, headers=${env.httpHeadersTimeoutMs}ms, keepAlive=${env.httpKeepAliveTimeoutMs}ms)`
  );

  kickOffOptionalStartupTasks();
  startOptionalRuntimeServices(server);

  return server;
}

startServer().catch((error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Failed to start server: port ${env.port} is already in use. Stop the existing process or change PORT.`);
  } else {
    console.error('Failed to start server:', error.message || error);
  }

  if (!env.isProduction && error?.stack) {
    console.error(error.stack);
  }

  process.exit(1);
});
