const mongoose = require('mongoose');
const {
  DEPARTMENTS,
  ROLES,
  ROUTING_DEPARTMENTS,
  STUDENT_PROGRAMS,
  normalizeDepartment,
  normalizeProgram,
  normalizeRole
} = require('../constants/appConstants');
const { E164_PHONE_REGEX, normalizePhoneNumber } = require('../utils/phone');
const env = require('../config/env');

const pendingRegistrationSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true
    },
    passwordHash: {
      type: String,
      required: true,
      select: false
    },
    role: {
      type: String,
      required: true,
      enum: ROLES
    },
    program: {
      type: String,
      enum: STUDENT_PROGRAMS,
      default: null
    },
    department: {
      type: String,
      enum: DEPARTMENTS,
      default: null
    },
    semester: {
      type: Number,
      default: null
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
      required: true,
      trim: true,
      validate: {
        validator(value) {
          return E164_PHONE_REGEX.test(String(value || '').trim());
        },
        message: 'Please provide a valid phone number'
      }
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
    lastOtpSentAt: {
      type: Date,
      required: true
    },
    resendCount: {
      type: Number,
      default: 0,
      min: 0
    },
    verifyAttempts: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  {
    collection: 'pending_registrations',
    timestamps: true
  }
);

pendingRegistrationSchema.pre('validate', function normalizePendingRegistration(next) {
  if (this.fullName) {
    this.fullName = this.fullName.trim();
  }

  if (this.email) {
    this.email = this.email.trim().toLowerCase();
  }

  if (this.phone) {
    this.phone = normalizePhoneNumber(this.phone, {
      defaultCountryCode: env.defaultPhoneCountryCode
    });
  }

  this.role = normalizeRole(this.role);
  this.program = this.program ? normalizeProgram(this.program) || null : null;

  if (this.department) {
    const normalizedDepartment = normalizeDepartment(this.department);
    this.department = normalizedDepartment || this.department;
  }

  if (this.role === 'student') {
    this.employeeId = null;
    this.enrollmentNo = this.enrollmentNo ? String(this.enrollmentNo).trim() : null;
    this.program = this.program || null;

    if (this.department && !ROUTING_DEPARTMENTS.includes(this.department)) {
      this.department = normalizeDepartment(this.department) || null;
    }
  } else {
    this.enrollmentNo = null;
    this.semester = null;
    this.employeeId = this.employeeId ? String(this.employeeId).trim().toUpperCase() : null;

    if (this.role !== 'hod') {
      this.program = null;
    }
  }

  if (this.role === 'security') {
    this.department = null;
  }

  next();
});

pendingRegistrationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });

module.exports = mongoose.model('PendingRegistration', pendingRegistrationSchema);
