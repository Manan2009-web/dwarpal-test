const mongoose = require('mongoose');

const authRateLimitBucketSchema = new mongoose.Schema(
  {
    scope: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },
    keyHash: {
      type: String,
      required: true,
      trim: true,
      maxlength: 128
    },
    count: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    },
    // windowExpiresAt controls when the rolling auth bucket resets, while deleteAt keeps
    // the document around long enough for any temporary block to survive process restarts.
    windowExpiresAt: {
      type: Date,
      required: true
    },
    blockedUntil: {
      type: Date,
      default: null
    },
    deleteAt: {
      type: Date,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    versionKey: false
  }
);

authRateLimitBucketSchema.index({ scope: 1, keyHash: 1 }, { unique: true, name: 'scope_keyHash_unique' });
authRateLimitBucketSchema.index({ deleteAt: 1 }, { expireAfterSeconds: 0, name: 'deleteAt_ttl' });
authRateLimitBucketSchema.index({ blockedUntil: 1 }, { name: 'blockedUntil_lookup' });

module.exports =
  mongoose.models.AuthRateLimitBucket || mongoose.model('AuthRateLimitBucket', authRateLimitBucketSchema);
