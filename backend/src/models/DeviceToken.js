const mongoose = require('mongoose');

const deviceTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    token: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    device: {
      type: String,
      trim: true,
      default: 'Web browser',
      maxlength: 200
    }
  },
  {
    collection: 'device_tokens',
    timestamps: true
  }
);

deviceTokenSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('DeviceToken', deviceTokenSchema);
