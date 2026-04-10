const http = require('http');
const app = require('./app');
const env = require('./config/env');
const connectDatabase = require('./config/db');
const Gatepass = require('./models/Gatepass');
const { ensureRateLimitStorage } = require('./services/authRateLimitService');
const { seedDefaultAdmins } = require('./services/adminService');
const { closeRealtimeServer, createRealtimeServer } = require('./services/realtimeService');

async function repairVerificationTokens() {
  const result = await Gatepass.updateMany(
    { verificationToken: null },
    { $unset: { verificationToken: 1 } }
  );

  if (result.modifiedCount > 0) {
    console.log(`Normalized ${result.modifiedCount} gatepass verification tokens.`);
  }
}

async function ensureDemoAccounts() {
  if (env.nodeEnv !== 'development' || !env.autoSeedDemoAccounts) {
    return null;
  }

  const result = await seedDefaultAdmins();
  console.log(
    `Demo accounts ready (${result.created.length} created, ${result.updated.length} refreshed).`
  );
  return result;
}

async function shutdownServer(server, exitCode = 0) {
  try {
    await closeRealtimeServer();

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
  }

  process.exit(exitCode);
}

async function startServer() {
  const database = await connectDatabase();
  await ensureRateLimitStorage();
  await repairVerificationTokens();
  await ensureDemoAccounts();

  const server = http.createServer(app);
  createRealtimeServer(server);

  server.on('error', async (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Failed to start server: port ${env.port} is already in use. Stop the existing process or change PORT.`);
    } else {
      console.error('Failed to start server:', error);
    }

    await shutdownServer(server, 1);
  });

  server.listen(env.port, "0.0.0.0", () => {
  console.log(`DwarPal backend running on port ${env.port}`);
  console.log(`Database mode: ${database.mode}`);
});

  process.on('unhandledRejection', (error) => {
    console.error('Unhandled rejection:', error);
    shutdownServer(server, 1);
  });

  process.on('SIGINT', () => shutdownServer(server, 0));
  process.on('SIGTERM', () => shutdownServer(server, 0));
}

startServer().catch((error) => {
  if (error?.name === 'MongooseServerSelectionError') {
    console.error(
      `Failed to start server: unable to connect to MongoDB at ${env.mongoUri}. Start MongoDB or set ENABLE_IN_MEMORY_DB=true to use the embedded dev database.`
    );
  } else {
    console.error('Failed to start server:', error);
  }
  process.exit(1);
});
