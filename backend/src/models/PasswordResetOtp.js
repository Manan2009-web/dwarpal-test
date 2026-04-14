const mongoose = require('mongoose');

const passwordResetOtpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true
    },
    otpHash: {
      type: String,
      required: true,
      select: false
    },
    otpExpiresAt: {
      type: Date,
      required: true
    },
    lastSentAt: {
      type: Date,
      required: true
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0
    },
    used: {
      type: Boolean,
      default: false
    }
  },
  {
    collection: 'password_reset_otps',
    timestamps: true
  }
);

passwordResetOtpSchema.pre('validate', function normalizeEmailValue(next) {
  if (this.email) {
    this.email = this.email.trim().toLowerCase();
  }

  next();
});

passwordResetOtpSchema.index({ createdAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });

module.exports = mongoose.model('PasswordResetOtp', passwordResetOtpSchema);
