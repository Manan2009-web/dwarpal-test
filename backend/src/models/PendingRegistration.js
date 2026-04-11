const mongoose = require('mongoose');
const env = require('../config/env');
const {
  DEPARTMENTS,
  PUBLIC_REGISTRATION_ROLES,
  ROUTING_DEPARTMENTS,
  SEMESTERS,
  STUDENT_PROGRAMS,
  normalizeDepartment,
  normalizeProgram,
  normalizeRole
} = require('../constants/appConstants');
const { normalizePhoneNumber } = require('../utils/phone');

const pendingRegistrationSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      trim: true,
      minlength: 2,
      maxlength: 120,
      required: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      required: true,
      unique: true
    },
    passwordHash: {
      type: String,
      select: false,
      default: null
    },
    role: {
      type: String,
      trim: true,
      lowercase: true,
      enum: PUBLIC_REGISTRATION_ROLES,
      required: true
    },
    program: {
      type: String,
      trim: true,
      default: null,
      validate: {
        validator(value) {
          if (!value) {
            return !['student', 'hod'].includes(this.role);
          }

          return STUDENT_PROGRAMS.includes(value);
        },
        message: 'Please provide a valid program.'
      }
    },
    department: {
      type: String,
      trim: true,
      default: null,
      validate: {
        validator(value) {
          if (!value) {
            return this.role === 'security';
          }

          if (['student', 'hod'].includes(this.role)) {
            return ROUTING_DEPARTMENTS.includes(value);
          }

          return DEPARTMENTS.includes(value);
        },
        message: 'Please provide a valid department.'
      }
    },
    semester: {
      type: Number,
      default: null,
      validate: {
        validator(value) {
          if (value === null || value === undefined) {
            return this.role !== 'student';
          }

          return SEMESTERS.includes(value);
        },
        message: 'Please provide a valid semester between 1 and 8.'
      }
    },
    enrollmentNo: {
      type: String,
      trim: true,
      default: null
    },
    employeeId: {
      type: String,
      trim: true,
      uppercase: true,
      default: null
    },
    phone: {
      type: String,
      trim: true,
      required: true
    },
    verificationCodeHash: {
      type: String,
      select: false,
      default: null
    },
    verificationCodeExpiresAt: {
      type: Date,
      default: null
    },
    resendAvailableAt: {
      type: Date,
      default: null
    },
    verificationAttempts: {
      type: Number,
      default: 0,
      min: 0
    },
    sendCount: {
      type: Number,
      default: 0,
      min: 0
    },
    lastSentAt: {
      type: Date,
      default: null
    },
    completedAt: {
      type: Date,
      default: null
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    deleteAt: {
      type: Date,
      required: true
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

pendingRegistrationSchema.pre('validate', function normalizePendingRegistration(next) {
  if (this.fullName) {
    this.fullName = String(this.fullName).trim();
  }

  if (this.email) {
    this.email = String(this.email).trim().toLowerCase();
  }

  if (this.role) {
    this.role = normalizeRole(this.role) || this.role;
  }

  if (this.program) {
    this.program = normalizeProgram(this.program) || null;
  }

  if (this.department) {
    this.department = normalizeDepartment(this.department) || null;
  }

  if (this.phone) {
    this.phone = normalizePhoneNumber(this.phone, {
      defaultCountryCode: env.defaultPhoneCountryCode
    });
  }

  if (this.role === 'student') {
    this.enrollmentNo = String(this.enrollmentNo || '').trim() || null;
    this.employeeId = null;
  } else {
    this.enrollmentNo = null;
    this.employeeId = String(this.employeeId || '').trim().toUpperCase() || null;
    this.semester = null;
  }

  if (!['student', 'hod'].includes(this.role)) {
    this.program = null;
  }

  if (this.role === 'security') {
    this.department = null;
  }

  next();
});

pendingRegistrationSchema.index({ email: 1 }, { unique: true, name: 'pending_registration_email_unique' });
pendingRegistrationSchema.index({ deleteAt: 1 }, { expireAfterSeconds: 0, name: 'pending_registration_deleteAt_ttl' });
pendingRegistrationSchema.index({ completedAt: 1 }, { name: 'pending_registration_completedAt_lookup' });

module.exports =
  mongoose.models.PendingRegistration || mongoose.model('PendingRegistration', pendingRegistrationSchema);
