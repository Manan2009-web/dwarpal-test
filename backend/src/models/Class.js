const mongoose = require('mongoose');

const classSchema = new mongoose.Schema(
  {
    program: {
      type: String,
      required: true,
      trim: true
    },
    department: {
      type: String,
      required: true,
      trim: true
    },
    semester: {
      type: Number,
      required: true
    },
    division: {
      type: String,
      trim: true,
      default: ''
    },
    academicYear: {
      type: String,
      trim: true,
      default: ''
    },
    coordinator_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Ensure unique combination of class properties
classSchema.index(
  { program: 1, department: 1, semester: 1, division: 1, academicYear: 1 },
  { unique: true }
);

// Index coordinator_id for quick lookups
classSchema.index({ coordinator_id: 1 });

module.exports = mongoose.model('Class', classSchema);
