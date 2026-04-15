const mongoose = require('mongoose');

const exportHistorySchema = new mongoose.Schema(
  {
    reportType: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true
    },
    exportFormat: {
      type: String,
      enum: ['excel', 'pdf'],
      required: true,
      index: true
    },
    filters: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    scope: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    generatedBySnapshot: {
      id: String,
      name: String,
      email: String,
      role: String,
      department: String,
      employeeId: String,
      enrollmentNo: String
    },
    fileName: {
      type: String,
      required: true,
      trim: true
    },
    status: {
      type: String,
      enum: ['generating', 'success', 'failed'],
      default: 'generating',
      index: true
    },
    recordCount: {
      type: Number,
      default: 0,
      min: 0
    },
    errorMessage: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: ''
    },
    generatedAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    completedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

exportHistorySchema.index({ generatedBy: 1, generatedAt: -1 });
exportHistorySchema.index({ reportType: 1, exportFormat: 1, generatedAt: -1 });

module.exports = mongoose.model('ExportHistory', exportHistorySchema);
