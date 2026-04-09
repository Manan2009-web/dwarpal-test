const mongoose = require('mongoose');
const { NOTIFICATION_TYPES, ROLES } = require('../constants/appConstants');

const NOTIFICATION_STATUSES = Object.freeze([
  'submitted',
  'pending',
  'forwarded',
  'approved',
  'rejected',
  'out',
  'returned',
  'cancelled',
  'info'
]);

const NOTIFICATION_RECORD_TYPES = Object.freeze(['gatepass', 'faculty_leave', 'system']);

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    recipientRole: {
      type: String,
      enum: ROLES,
      required: true,
      index: true
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    senderRole: {
      type: String,
      enum: ROLES,
      default: null
    },
    gatepass: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Gatepass',
      default: null
    },
    facultyLeaveRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FacultyLeaveRequest',
      default: null
    },
    recordType: {
      type: String,
      enum: NOTIFICATION_RECORD_TYPES,
      required: true,
      default: 'system',
      index: true
    },
    referenceId: {
      type: String,
      trim: true,
      uppercase: true,
      default: ''
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500
    },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: NOTIFICATION_STATUSES,
      default: 'info',
      index: true
    },
    relatedRoute: {
      type: String,
      trim: true,
      default: '/app/notifications'
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    dedupeKey: {
      type: String,
      trim: true,
      default: null,
      sparse: true,
      unique: true
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true
    },
    readAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
