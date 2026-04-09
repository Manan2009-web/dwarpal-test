const mongoose = require('mongoose');

const gatepassCounterSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true
    },
    applicantType: {
      type: String,
      enum: ['student', 'faculty'],
      required: true
    },
    period: {
      type: String,
      required: true,
      match: /^\d{6}$/
    },
    sequence: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

gatepassCounterSchema.index({ applicantType: 1, period: 1 }, { unique: true });

module.exports = mongoose.model('GatepassCounter', gatepassCounterSchema);
