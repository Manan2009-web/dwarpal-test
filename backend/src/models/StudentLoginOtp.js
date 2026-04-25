const mongoose = require('mongoose');

const studentLoginOtpSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
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
    collection: 'student_login_otps',
    timestamps: true
  }
);

studentLoginOtpSchema.pre('validate', function normalizeStudentLoginOtp(next) {
  if (this.email) {
    this.email = this.email.trim().toLowerCase();
  }

  next();
});

studentLoginOtpSchema.index({ createdAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });

module.exports = mongoose.model('StudentLoginOtp', studentLoginOtpSchema);
