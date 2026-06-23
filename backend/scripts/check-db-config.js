#!/usr/bin/env node

/**
 * DwarPal Database Diagnostic Script
 *
 * Run this script to check which database your backend is configured to use:
 *   node backend/scripts/check-db-config.js
 *
 * This script reads the same .env file your backend uses and reports:
 *   - Which .env file is loaded
 *   - Whether MONGO_URI is set
 *   - Which database the backend will connect to
 *   - Whether ENABLE_IN_MEMORY_DB is active
 */

const fs = require('fs');
const path = require('path');

// Replicate the same .env resolution logic from backend/src/config/env.js
const backendRoot = path.resolve(__dirname, '..');
const backendEnvPath = path.join(backendRoot, '.env');
const cwdEnvPath = path.resolve(process.cwd(), '.env');
const resolvedEnvPath = fs.existsSync(backendEnvPath) ? backendEnvPath : cwdEnvPath;

console.log('');
console.log('╔══════════════════════════════════════════════════════╗');
console.log('║     DwarPal Database Configuration Diagnostic       ║');
console.log('╚══════════════════════════════════════════════════════╝');
console.log('');

// 1. Check which .env files exist
console.log('── Step 1: .env File Resolution ──────────────────────');
console.log('');

const backendEnvExists = fs.existsSync(backendEnvPath);
const cwdEnvExists = fs.existsSync(cwdEnvPath);

console.log(`  backend/.env exists:   ${backendEnvExists ? '✅ YES' : '❌ NO'}`);
console.log(`  root .env exists:      ${cwdEnvExists ? '✅ YES' : '❌ NO'}`);
console.log(`  Loaded .env file:      ${resolvedEnvPath}`);
console.log('');

if (!backendEnvExists && !cwdEnvExists) {
  console.log('  ⚠️  No .env file found! The backend will fail to start.');
  console.log('  Copy backend/.env.example to backend/.env and fill in values.');
  process.exit(1);
}

// 2. Parse the .env file
function parseEnvFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const vars = {};
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      vars[key] = value;
    }
    return vars;
  } catch {
    return {};
  }
}

const envVars = parseEnvFile(resolvedEnvPath);

console.log('── Step 2: MongoDB Configuration ─────────────────────');
console.log('');

const mongoUri = envVars.MONGO_URI || '';
const legacyMongoUri = envVars.MONGODB_URI || '';
const enableInMemoryDb = (envVars.ENABLE_IN_MEMORY_DB || '').toLowerCase();
const nodeEnv = (envVars.NODE_ENV || 'development').toLowerCase();

console.log(`  NODE_ENV:               ${nodeEnv || '(not set, defaults to development)'}`);
console.log(`  MONGO_URI:              ${mongoUri ? '✅ SET' : '❌ NOT SET'}`);
console.log(`  MONGODB_URI (legacy):   ${legacyMongoUri ? '✅ SET' : '❌ NOT SET'}`);
console.log(`  ENABLE_IN_MEMORY_DB:    ${enableInMemoryDb || '(not set, defaults to false)'}`);
console.log('');

// 3. Determine which database will be used
console.log('── Step 3: Database Selection ────────────────────────');
console.log('');

const effectiveUri = mongoUri || legacyMongoUri;

if (effectiveUri) {
  // Parse the URI to show host and database name
  try {
    const match = effectiveUri.match(
      /^(mongodb(?:\+srv)?:\/\/)(?:[^@]+@)?([^/?]+)(?:\/([^/?]+))?/i
    );
    const protocol = effectiveUri.startsWith('mongodb+srv') ? 'mongodb+srv' : 'mongodb';
    const host = match?.[2] || 'unknown';
    const dbName = match?.[3] || '(not specified - will use default)';

    console.log(`  ✅ Will connect to EXTERNAL database`);
    console.log(`  Protocol:               ${protocol}`);
    console.log(`  Host:                   ${host}`);
    console.log(`  Database name:          ${dbName}`);
    console.log(`  URI source:             ${mongoUri ? 'MONGO_URI' : 'MONGODB_URI'}`);
  } catch {
    console.log(`  ⚠️  MONGO_URI is set but could not be parsed`);
    console.log(`  Raw value (first 30 chars): ${effectiveUri.slice(0, 30)}...`);
  }
} else if (enableInMemoryDb === 'true' && nodeEnv === 'development') {
  console.log('  ⚠️  Will use IN-MEMORY database (mongodb-memory-server)');
  console.log('  Data will NOT persist across restarts!');
  console.log('  Data will NOT appear in MongoDB Atlas!');
  console.log('');
  console.log('  🔴 THIS IS LIKELY YOUR ROOT CAUSE 🔴');
  console.log('');
  console.log('  To fix: Set MONGO_URI in backend/.env to your Atlas connection string:');
  console.log('  MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/dwarpal?retryWrites=true&w=majority');
} else {
  console.log('  ❌ No MONGO_URI or MONGODB_URI configured, and in-memory DB is not enabled.');
  console.log('  The backend will fail to start with:');
  console.log('  "MongoDB is not configured. Set MONGO_URI (preferred) or MONGODB_URI."');
}
console.log('');

// 4. Check for common issues
console.log('── Step 4: Common Issues Checklist ───────────────────');
console.log('');

if (mongoUri && legacyMongoUri && mongoUri !== legacyMongoUri) {
  console.log('  ⚠️  Both MONGO_URI and MONGODB_URI are set with DIFFERENT values!');
  console.log('     Remove one. MONGO_URI takes precedence.');
  console.log('');
}

if (mongoUri) {
  // Check if URI looks like localhost
  if (mongoUri.includes('localhost') || mongoUri.includes('127.0.0.1')) {
    console.log('  ⚠️  MONGO_URI points to localhost/127.0.0.1');
    console.log('     This is a LOCAL MongoDB, not Atlas!');
    console.log('     Data here will not appear in MongoDB Atlas.');
    console.log('');
  }

  // Check for default database name
  const dbNameMatch = mongoUri.match(/\/([^/?]+)(?:\?|$)/);
  const dbName = dbNameMatch?.[1];
  if (dbName && dbName !== 'dwarpal') {
    console.log(`  ⚠️  Database name in MONGO_URI is "${dbName}"`);
    console.log('     Expected: "dwarpal"');
    console.log('     You may be connected to the wrong database!');
    console.log('');
  }
}

if (!mongoUri && enableInMemoryDb !== 'true') {
  console.log('  ❌ No database configured. Set MONGO_URI in backend/.env');
  console.log('');
}

// 5. Recommendations
console.log('── Step 5: What to Check in MongoDB Atlas ────────────');
console.log('');
console.log('  1. Open MongoDB Atlas dashboard → Database → Browse Collections');
console.log('  2. Make sure you are looking at the SAME database name shown above');
console.log('  3. If you have multiple Atlas clusters, check each one');
console.log('  4. The collection name will be "users" (Mongoose pluralizes "User" model)');
console.log('');

console.log('═══════════════════════════════════════════════════════');
console.log('After fixing configuration, restart the backend and');
console.log('check the startup logs for the DATABASE DIAGNOSTIC INFO section.');
console.log('═══════════════════════════════════════════════════════');
console.log('');
