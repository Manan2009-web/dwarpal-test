const mongoose = require('mongoose');

const phoneVerificationSessionSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: true,
      trim: true
    },
    purpose: {
      type: String,
      required: true,
      enum: ['registration'],
      default: 'registration'
    },
    provider: {
      type: String,
      required: true,
      default: 'twilio-verify'
    },
    providerSid: {
      type: String,
      trim: true,
      default: ''
    },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'verified', 'consumed', 'expired'],
      default: 'pending'
    },
    resendCount: {
      type: Number,
      default: 0
    },
    lastSentAt: {
      type: Date,
      default: null
    },
    verifiedAt: {
      type: Date,
      default: null
    },
    consumedAt: {
      type: Date,
      default: null
    },
    expiresAt: {
      type: Date,
      required: true
    },
    verificationTokenHash: {
      type: String,
      select: false,
      default: null
    },
    verificationTokenExpiresAt: {
      type: Date,
      select: false,
      default: null
    }
  },
  {
    timestamps: true
  }
);

phoneVerificationSessionSchema.index({ phone: 1, purpose: 1 }, { unique: true });
phoneVerificationSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('PhoneVerificationSession', phoneVerificationSessionSchema);
