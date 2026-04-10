const crypto = require('crypto');
const AuthRateLimitBucket = require('../models/AuthRateLimitBucket');
const AppError = require('../utils/appError');

const DEFAULT_WINDOW_MS = 15 * 60 * 1000;
const DUPLICATE_KEY_ERROR_CODE = 11000;
const MAX_WRITE_RETRIES = 3;

function normalizeBucketKey(key) {
  return String(key || '').trim();
}

function hashBucketKey(key) {
  return crypto.createHash('sha256').update(normalizeBucketKey(key)).digest('hex');
}

function toPositiveNumber(value, fallbackValue) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : fallbackValue;
}

function getCleanupDate(windowExpiresAt, blockedUntil) {
  if (blockedUntil instanceof Date && blockedUntil.getTime() > windowExpiresAt.getTime()) {
    return blockedUntil;
  }

  return windowExpiresAt;
}

function buildUnblockedFilter(nowDate) {
  return {
    $or: [
      { blockedUntil: { $exists: false } },
      { blockedUntil: null },
      { blockedUntil: { $lte: nowDate } }
    ]
  };
}

function buildRateLimitResult(bucket, limit, nowTimestamp) {
  const count = Number(bucket?.count || 0);
  const resetAt = bucket?.windowExpiresAt ? new Date(bucket.windowExpiresAt) : null;
  const blockedUntil = bucket?.blockedUntil ? new Date(bucket.blockedUntil) : null;
  const blocked = Boolean(blockedUntil && blockedUntil.getTime() > nowTimestamp);

  return {
    allowed: !blocked && count <= limit,
    blocked,
    count,
    remaining: Math.max(limit - count, 0),
    resetAt,
    blockedUntil,
    retryAfterSeconds: blocked ? Math.max(1, Math.ceil((blockedUntil.getTime() - nowTimestamp) / 1000)) : 0
  };
}

async function ensureRateLimitStorage() {
  await AuthRateLimitBucket.createCollection().catch((error) => {
    if (error?.codeName !== 'NamespaceExists') {
      throw error;
    }
  });

  await AuthRateLimitBucket.syncIndexes();
}

async function getRateLimitState({ scope, key }) {
  const normalizedScope = String(scope || '').trim();
  const normalizedKey = normalizeBucketKey(key);

  if (!normalizedScope || !normalizedKey) {
    return {
      allowed: true,
      blocked: false,
      count: 0,
      remaining: 0,
      resetAt: null,
      blockedUntil: null,
      retryAfterSeconds: 0
    };
  }

  const nowTimestamp = Date.now();
  const bucket = await AuthRateLimitBucket.findOne({
    scope: normalizedScope,
    keyHash: hashBucketKey(normalizedKey)
  })
    .select('count windowExpiresAt blockedUntil')
    .lean();

  if (!bucket) {
    return {
      allowed: true,
      blocked: false,
      count: 0,
      remaining: 0,
      resetAt: null,
      blockedUntil: null,
      retryAfterSeconds: 0
    };
  }

  const blockedUntil = bucket.blockedUntil ? new Date(bucket.blockedUntil) : null;
  if (blockedUntil && blockedUntil.getTime() > nowTimestamp) {
    return buildRateLimitResult(bucket, Number.MAX_SAFE_INTEGER, nowTimestamp);
  }

  const resetAt = bucket.windowExpiresAt ? new Date(bucket.windowExpiresAt) : null;
  if (resetAt && resetAt.getTime() <= nowTimestamp) {
    return {
      allowed: true,
      blocked: false,
      count: 0,
      remaining: 0,
      resetAt: null,
      blockedUntil: null,
      retryAfterSeconds: 0
    };
  }

  return buildRateLimitResult(bucket, Number.MAX_SAFE_INTEGER, nowTimestamp);
}

async function consumeRateLimit({ scope, key, limit, windowMs, blockDurationMs = windowMs }) {
  const normalizedScope = String(scope || '').trim();
  const normalizedKey = normalizeBucketKey(key);

  if (!normalizedScope || !normalizedKey) {
    return {
      allowed: true,
      blocked: false,
      count: 0,
      remaining: Math.max(toPositiveNumber(limit, 1), 0),
      resetAt: null,
      blockedUntil: null,
      retryAfterSeconds: 0
    };
  }

  const safeLimit = toPositiveNumber(limit, 1);
  const safeWindowMs = toPositiveNumber(windowMs, DEFAULT_WINDOW_MS);
  const safeBlockDurationMs = toPositiveNumber(blockDurationMs, safeWindowMs);
  const keyHash = hashBucketKey(normalizedKey);

  for (let attempt = 0; attempt < MAX_WRITE_RETRIES; attempt += 1) {
    const nowTimestamp = Date.now();
    const nowDate = new Date(nowTimestamp);

    const existingBucket = await AuthRateLimitBucket.findOne({
      scope: normalizedScope,
      keyHash
    }).select('count windowExpiresAt blockedUntil');

    if (existingBucket?.blockedUntil && existingBucket.blockedUntil.getTime() > nowTimestamp) {
      return buildRateLimitResult(existingBucket, safeLimit, nowTimestamp);
    }

    if (!existingBucket || !existingBucket.windowExpiresAt || existingBucket.windowExpiresAt.getTime() <= nowTimestamp) {
      const windowExpiresAt = new Date(nowTimestamp + safeWindowMs);

      try {
        const freshBucket = await AuthRateLimitBucket.findOneAndUpdate(
          {
            scope: normalizedScope,
            keyHash,
            $or: [
              { windowExpiresAt: { $exists: false } },
              { windowExpiresAt: null },
              { windowExpiresAt: { $lte: nowDate } }
            ]
          },
          {
            $set: {
              scope: normalizedScope,
              keyHash,
              count: 1,
              windowExpiresAt,
              blockedUntil: null,
              deleteAt: windowExpiresAt,
              updatedAt: nowDate
            },
            $setOnInsert: {
              createdAt: nowDate
            }
          },
          {
            upsert: true,
            new: true
          }
        );

        if (freshBucket) {
          return buildRateLimitResult(freshBucket, safeLimit, nowTimestamp);
        }
      } catch (error) {
        if (error?.code === DUPLICATE_KEY_ERROR_CODE) {
          continue;
        }

        throw error;
      }
    }

    const activeBucket = await AuthRateLimitBucket.findOneAndUpdate(
      {
        scope: normalizedScope,
        keyHash,
        windowExpiresAt: { $gt: nowDate },
        ...buildUnblockedFilter(nowDate)
      },
      {
        $inc: { count: 1 },
        $set: {
          updatedAt: nowDate
        }
      },
      {
        new: true
      }
    );

    if (!activeBucket) {
      continue;
    }

    if (activeBucket.count > safeLimit) {
      const blockedUntil = new Date(nowTimestamp + safeBlockDurationMs);
      const deleteAt = getCleanupDate(new Date(activeBucket.windowExpiresAt), blockedUntil);

      await AuthRateLimitBucket.updateOne(
        {
          _id: activeBucket._id,
          ...buildUnblockedFilter(nowDate)
        },
        {
          $set: {
            blockedUntil,
            deleteAt,
            updatedAt: nowDate
          }
        }
      );

      activeBucket.blockedUntil = blockedUntil;
      activeBucket.deleteAt = deleteAt;
    }

    return buildRateLimitResult(activeBucket, safeLimit, nowTimestamp);
  }

  throw new Error(`Unable to update auth rate-limit bucket for scope "${normalizedScope}".`);
}

async function resetRateLimit({ scope, key }) {
  const normalizedScope = String(scope || '').trim();
  const normalizedKey = normalizeBucketKey(key);

  if (!normalizedScope || !normalizedKey) {
    return;
  }

  await AuthRateLimitBucket.deleteOne({
    scope: normalizedScope,
    keyHash: hashBucketKey(normalizedKey)
  });
}

async function resetRateLimits(entries = []) {
  const filters = entries
    .map((entry) => {
      const normalizedScope = String(entry?.scope || '').trim();
      const normalizedKey = normalizeBucketKey(entry?.key);

      if (!normalizedScope || !normalizedKey) {
        return null;
      }

      return {
        scope: normalizedScope,
        keyHash: hashBucketKey(normalizedKey)
      };
    })
    .filter(Boolean);

  if (!filters.length) {
    return;
  }

  await AuthRateLimitBucket.deleteMany({
    $or: filters
  });
}

function createRateLimitError({
  message,
  retryAfterSeconds = 0,
  code = 'RATE_LIMITED',
  errors = null,
  rateLimit = null
}) {
  const error = new AppError(message, 429, errors);

  error.code = code;
  error.retryAfterSeconds = Math.max(1, Math.ceil(Number(retryAfterSeconds) || 0));
  error.rateLimit = {
    ...(rateLimit || {}),
    retryAfterSeconds: error.retryAfterSeconds
  };

  return error;
}

module.exports = {
  consumeRateLimit,
  createRateLimitError,
  ensureRateLimitStorage,
  getRateLimitState,
  resetRateLimit,
  resetRateLimits
};
