const mongoose = require('mongoose');
const dns = require('dns');
const env = require('./env');

mongoose.set('strictQuery', true);

// Force reliable public DNS resolvers for mongodb+srv lookups
dns.setServers(['8.8.8.8', '1.1.1.1']);

const MAX_CONNECTION_ATTEMPTS = 3;
const CONNECTION_RETRY_DELAY_MS = 2000;
const READY_DATABASE_MODES = new Set(['external', 'in-memory']);
const MONGODB_CONNECT_OPTIONS = {
  autoIndex: !env.isProduction,
  serverSelectionTimeoutMS: 5000
};

let inMemoryServer = null;
let activeConnectionPromise = null;
let databaseState = {
  mode: 'disconnected',
  uri: null,
  uriSource: env.mongoUriSource,
  connected: false,
  lastError: null
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getMongoHost(uri) {
  const match = String(uri || '').match(/^mongodb(?:\+srv)?:\/\/(?:[^@]+@)?([^/?]+)/i);
  return match?.[1] || 'unknown-host';
}

function getSafeDatabaseUri(uri) {
  const host = getMongoHost(uri);
  return host === 'unknown-host' ? null : host;
}

function getMongoErrorMessage(error) {
  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message.trim();
  }

  return String(error || 'Unknown MongoDB connection error');
}

function classifyMongoConnectionError(error) {
  const message = getMongoErrorMessage(error);
  const normalizedMessage = message.toLowerCase();

  if (/querysrv|srv record|dns/.test(normalizedMessage)) {
    return {
      code: 'srv_dns',
      probableCause: 'SRV DNS resolution is failing. Use a standard mongodb:// seed-list URI or fix DNS access.'
    };
  }

  if (/whitelist|whitelisted|ip access list|network access/.test(normalizedMessage)) {
    return {
      code: 'atlas_network_access',
      probableCause: 'Atlas Network Access is likely blocking this machine.'
    };
  }

  if (/authentication failed|bad auth|auth error|sasl|scram/.test(normalizedMessage)) {
    return {
      code: 'atlas_auth',
      probableCause: 'Atlas Database Access credentials are likely invalid or mismatched.'
    };
  }

  if (/tls|ssl|certificate|self signed|hostname\/ip does not match|unable to verify the first certificate/.test(normalizedMessage)) {
    return {
      code: 'tls',
      probableCause: 'TLS validation or SSL interception is preventing the Atlas handshake.'
    };
  }

  if (/paused|deleted|provisioning|no primary|replicasetnoprimary/.test(normalizedMessage)) {
    return {
      code: 'cluster_state',
      probableCause: 'The Atlas cluster may be paused, provisioning, or otherwise unavailable.'
    };
  }

  if (/econnrefused|econnreset|enotfound|eai_again|timed out|server selection|socket hang up|network/.test(normalizedMessage)) {
    return {
      code: 'network',
      probableCause: 'Outbound network access to Atlas may be blocked or unstable.'
    };
  }

  return {
    code: 'unknown',
    probableCause: 'Atlas reachability, credentials, or URI configuration still need verification.'
  };
}

function logMongoTroubleshootingChecklist({ usingSrvUri = false } = {}) {
  console.error('[db] Verify in Atlas:');
  console.error('[db] - Cluster is active and not paused.');
  console.error("[db] - Network Access includes this machine's current public IP.");
  console.error('[db] - Database user exists under Database Access.');
  console.error('[db] - Password is correct and URL-encoded if it contains special characters.');

  if (usingSrvUri) {
    console.error('[db] - If SRV DNS is blocked on this network, switch to a standard mongodb:// seed-list URI.');
  }
}

function setDatabaseState(mode, uri, options = {}) {
  databaseState = {
    mode,
    uri: getSafeDatabaseUri(uri),
    uriSource: mode === 'external' ? env.mongoUriSource : mode === 'in-memory' ? 'in-memory' : env.mongoUriSource,
    connected: READY_DATABASE_MODES.has(mode),
    lastError: options.lastError || null
  };
}

function getDatabaseState() {
  const connected = mongoose.connection.readyState === 1 && READY_DATABASE_MODES.has(databaseState.mode);

  return {
    ...databaseState,
    mode: connected ? databaseState.mode : 'disconnected',
    connected,
    hasExternalMongoUri: Boolean(env.mongoUri)
  };
}

async function connectWithUri(uri, mode) {
  await mongoose.connect(uri, MONGODB_CONNECT_OPTIONS);
  setDatabaseState(mode, uri);
  return getDatabaseState();
}

function validateMongoUri(uri) {
  if (!uri) {
    return;
  }

  if (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://')) {
    const error = new Error('MongoDB URI must start with mongodb:// or mongodb+srv://');
    error.code = 'MONGO_URI_INVALID_PROTOCOL';
    throw error;
  }
}

function canUseInMemoryDatabase() {
  return Boolean(env.isDevelopment && env.enableInMemoryDb);
}

async function disconnectDatabase() {
  activeConnectionPromise = null;

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  if (inMemoryServer) {
    await inMemoryServer.stop();
    inMemoryServer = null;
  }

  setDatabaseState('disconnected', null);
}

async function startInMemoryDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  if (!inMemoryServer) {
    const { MongoMemoryServer } = require('mongodb-memory-server');

    console.log(
      '[db] Starting embedded MongoDB for local development. The first run can take a few minutes while MongoDB downloads.'
    );
    inMemoryServer = await MongoMemoryServer.create({
      instance: {
        dbName: 'dwarpal',
        launchTimeout: 30000,
        storageEngine: 'wiredTiger'
      }
    });
  }

  const inMemoryUri = inMemoryServer.getUri();
  console.log('[db] Connecting to MongoDB... (in-memory development database)');
  await connectWithUri(inMemoryUri, 'in-memory');
  console.log('[db] MongoDB connected successfully');
  return getDatabaseState();
}

async function connectExternalDatabase(uri) {
  const mongoHost = getMongoHost(uri);

  for (let attempt = 1; attempt <= MAX_CONNECTION_ATTEMPTS; attempt += 1) {
    try {
      console.log(`[db] Connecting to MongoDB... (attempt ${attempt}/${MAX_CONNECTION_ATTEMPTS}, host: ${mongoHost})`);
      await connectWithUri(uri, 'external');
      console.log('[db] MongoDB connected successfully');
      return getDatabaseState();
    } catch (error) {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
      }

      const errorMessage = getMongoErrorMessage(error);
      setDatabaseState('disconnected', uri, { lastError: errorMessage });
      console.error(`[db] MongoDB connection failed (attempt ${attempt}/${MAX_CONNECTION_ATTEMPTS}): ${errorMessage}`);

      if (attempt === MAX_CONNECTION_ATTEMPTS) {
        const diagnostics = classifyMongoConnectionError(error);
        console.error(`[db] Possible cause: ${diagnostics.probableCause}`);
        logMongoTroubleshootingChecklist({ usingSrvUri: uri.startsWith('mongodb+srv://') });

        // In development, fall back to in-memory database so the server can still start
        // even when Atlas is unreachable (e.g. SRV DNS block on current network/ISP).
        if (env.isDevelopment) {
          console.warn('[db] ⚠️  Atlas unreachable — falling back to in-memory database for development.');
          console.warn('[db] Data will NOT persist between restarts. Fix your Atlas connection for production.');
          return startInMemoryDatabase();
        }

        throw error;
      }

      console.log(`[db] Retrying MongoDB connection in ${CONNECTION_RETRY_DELAY_MS}ms...`);
      await sleep(CONNECTION_RETRY_DELAY_MS);
    }
  }

  throw new Error('MongoDB connection attempts were exhausted.');
}

async function connectDatabase() {
  if (activeConnectionPromise) {
    return activeConnectionPromise;
  }

  const currentState = getDatabaseState();
  if (currentState.connected) {
    return currentState;
  }

  activeConnectionPromise = (async () => {
    if (env.mongoUri) {
      validateMongoUri(env.mongoUri);
      return connectExternalDatabase(env.mongoUri);
    }

    if (env.enableInMemoryDb && !env.isDevelopment) {
      throw new Error('ENABLE_IN_MEMORY_DB is supported only in local development. Configure MONGO_URI for this environment.');
    }

    if (!canUseInMemoryDatabase()) {
      throw new Error(
        'MongoDB is not configured. Set MONGO_URI (preferred) or MONGODB_URI. For local development only, you can set ENABLE_IN_MEMORY_DB=true.'
      );
    }

    return startInMemoryDatabase();
  })();

  try {
    return await activeConnectionPromise;
  } finally {
    activeConnectionPromise = null;
  }
}


connectDatabase.disconnectDatabase = disconnectDatabase;
connectDatabase.getDatabaseState = getDatabaseState;

module.exports = connectDatabase;