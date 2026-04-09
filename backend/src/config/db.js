const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const env = require('./env');

mongoose.set('strictQuery', true);

let inMemoryServer = null;
let databaseState = {
  mode: 'disconnected',
  uri: null
};

function setDatabaseState(mode, uri) {
  databaseState = {
    mode,
    uri
  };
}

function getDatabaseState() {
  return {
    ...databaseState,
    hasExternalMongoUri: Boolean(env.mongoUri)
  };
}

async function connectWithUri(uri, mode) {
  await mongoose.connect(uri, {
    autoIndex: !env.isProduction,
    serverSelectionTimeoutMS: 5000
  });

  setDatabaseState(mode, uri);
}

function canUseInMemoryFallback(error) {
  return Boolean(
    !env.isProduction &&
      env.enableInMemoryDb &&
      (!env.mongoUri || error?.name === 'MongooseServerSelectionError')
  );
}

async function disconnectDatabase() {
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
    console.log(
      'Starting embedded MongoDB for local development. The first run can take a few minutes while MongoDB downloads.'
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
  await connectWithUri(inMemoryUri, 'in-memory');
  console.log(`MongoDB connected successfully (in-memory fallback at ${inMemoryUri})`);
  return getDatabaseState();
}

async function connectDatabase() {
  if (!env.mongoUri && !env.enableInMemoryDb) {
    throw new Error(
      'MONGO_URI is not configured and the in-memory dev database is disabled. Add it to your backend .env file.'
    );
  }

  if (env.mongoUri) {
    try {
      await connectWithUri(env.mongoUri, 'external');
      console.log(`MongoDB connected successfully (${env.mongoUri})`);
      return getDatabaseState();
    } catch (error) {
      if (!canUseInMemoryFallback(error)) {
        throw error;
      }

      console.warn(
        `MongoDB at ${env.mongoUri} is unavailable. Falling back to the embedded development database.`
      );
    }
  }

  if (!env.enableInMemoryDb) {
    throw new Error('Embedded development database is disabled. Start MongoDB or enable ENABLE_IN_MEMORY_DB.');
  }

  return startInMemoryDatabase();
}

connectDatabase.disconnectDatabase = disconnectDatabase;
connectDatabase.getDatabaseState = getDatabaseState;

module.exports = connectDatabase;
