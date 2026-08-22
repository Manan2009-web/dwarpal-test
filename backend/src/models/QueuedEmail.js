const mongoose = require('mongoose');

const queuedEmailSchema = new mongoose.Schema(
  {
    to: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    subject: {
      type: String,
      required: true,
      trim: true
    },
    html: {
      type: String,
      required: true
    },
    text: {
      type: String,
      required: true
    },
    context: {
      type: String,
      required: true,
      trim: true,
      default: 'student-onboarding'
    },
    status: {
      type: String,
      enum: ['pending', 'sending', 'sent', 'failed'],
      default: 'pending',
      required: true
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0
    },
    lastError: {
      type: String,
      trim: true
    },
    sentAt: {
      type: Date
    }
  },
  {
    collection: 'queued_emails',
    timestamps: true
  }
);

// Index to optimize queue scans and sorting
queuedEmailSchema.index({ status: 1, createdAt: 1 });

module.exports = mongoose.model('QueuedEmail', queuedEmailSchema);
