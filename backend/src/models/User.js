const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const env = require('../config/env');
const {
  DEPARTMENTS,
  ROLES,
  ROUTING_DEPARTMENTS,
  SEMESTERS,
  STUDENT_PROGRAMS,
  normalizeDepartment,
  normalizeProgram
} = require('../constants/appConstants');
const pickUser = require('../utils/pickUser');

const BCRYPT_HASH_REGEX = /^\$2[aby]\$\d{2}\$/;

const webAuthnCredentialSchema = new mongoose.Schema(
  {
    credentialId: {
      type: String,
      required: true,
      trim: true
    },
    publicKey: {
      type: Buffer,
      required: true
    },
    counter: {
      type: Number,
      default: 0
    },
    transports: {
      type: [String],
      default: []
    },
    deviceType: {
      type: String,
      trim: true,
      default: 'singleDevice'
    },
    backedUp: {
      type: Boolean,
      default: false
    },
    deviceName: {
      type: String,
      trim: true,
      maxlength: 120,
      default: 'Current device'
    },
    lastUsedAt: {
      type: Date,
      default: null
    }
  },
  {
    _id: true,
    timestamps: true
  }
);

const userSchema = new mongoose.Schema(
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
      unique: true,
      trim: true,
      lowercase: true
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false
    },
    role: {
      type: String,
      trim: true,
      lowercase: true,
      enum: ROLES,
      required: true
    },
    program: {
      type: String,
      trim: true,
      validate: {
        validator(value) {
          if (!value) {
            return !['student', 'hod'].includes(this.role);
          }

          return STUDENT_PROGRAMS.includes(value);
        },
        message: 'Please provide a valid program'
      }
    },
    department: {
      type: String,
      trim: true,
      validate: {
        validator(value) {
          if (!value) {
            return !['student', 'faculty', 'hod'].includes(this.role);
          }

          if (['student', 'hod'].includes(this.role)) {
            return ROUTING_DEPARTMENTS.includes(value);
          }

          return DEPARTMENTS.includes(value);
        },
        message: 'Please provide a valid department'
      }
    },
    semester: {
      type: Number,
      validate: {
        validator(value) {
          if (value === null || value === undefined) {
            return this.role !== 'student';
          }

          return SEMESTERS.includes(value);
        },
        message: 'Please provide a valid semester between 1 and 8'
      }
    },
    enrollmentNo: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
      validate: {
        validator(value) {
          if (!value) {
            return this.role !== 'student';
          }

          return true;
        },
        message: 'Enrollment number is required for students'
      }
    },
    // Legacy compatibility field for older records created before enrollmentNo was standardized.
    enrollment: {
      type: String,
      trim: true,
      select: false,
      default: undefined
    },
    employeeId: {
      type: String,
      trim: true,
      uppercase: true,
      unique: true,
      sparse: true,
      validate: {
        validator(value) {
          if (!value) {
            return this.role === 'student';
          }

          return true;
        },
        message: 'Employee ID is required for faculty and admin users'
      }
    },
    phone: {
      type: String,
      required: true,
      trim: true
    },
    profileImage: {
      type: String,
      default: null
    },
    isActive: {
      type: Boolean,
      default: true
    },
    lastLoginAt: {
      type: Date,
      default: null
    },
    passwordResetToken: {
      type: String,
      select: false,
      default: null
    },
    passwordResetExpiresAt: {
      type: Date,
      select: false,
      default: null
    },
    hasBiometricCredentials: {
      type: Boolean,
      default: false
    },
    webAuthnCredentials: {
      type: [webAuthnCredentialSchema],
      default: []
    }
  },
  {
    timestamps: true
  }
);

userSchema.pre('validate', function syncLegacyFields(next) {
  if (this.fullName) {
    this.fullName = this.fullName.trim();
  }

  if (this.email) {
    this.email = this.email.trim().toLowerCase();
  }

  if (this.phone) {
    this.phone = this.phone.trim();
  }

  if (this.program) {
    this.program = normalizeProgram(this.program) || undefined;
  }

  if (this.department) {
    this.department = normalizeDepartment(this.department) || undefined;
  }

  if (Array.isArray(this.webAuthnCredentials)) {
    this.webAuthnCredentials = this.webAuthnCredentials.map((credential) => ({
      ...credential,
      deviceName: String(credential.deviceName || 'Current device').trim().slice(0, 120)
    }));
  }

  if (this.role === 'student') {
    const normalizedEnrollment = String(this.enrollmentNo || this.enrollment || '').trim();

    this.enrollmentNo = normalizedEnrollment || undefined;
    this.enrollment = normalizedEnrollment || undefined;
    this.employeeId = undefined;
    this.program = normalizeProgram(this.program) || undefined;
    this.department = normalizeDepartment(this.department) || undefined;
  } else if (this.role === 'hod') {
    this.enrollmentNo = undefined;
    this.enrollment = undefined;
    this.semester = undefined;
    this.employeeId = this.employeeId ? String(this.employeeId).trim().toUpperCase() : undefined;
    this.program = normalizeProgram(this.program) || undefined;
    this.department = normalizeDepartment(this.department) || undefined;
  } else {
    this.enrollmentNo = undefined;
    this.enrollment = undefined;
    this.semester = undefined;
    this.employeeId = this.employeeId ? String(this.employeeId).trim().toUpperCase() : undefined;
    this.program = undefined;
    this.department = this.department ? normalizeDepartment(this.department) || undefined : this.department;
  }

  this.hasBiometricCredentials = Array.isArray(this.webAuthnCredentials) && this.webAuthnCredentials.length > 0;

  next();
});

userSchema.pre('save', async function hashPassword(next) {
  if (!this.password) {
    return next();
  }

  if (BCRYPT_HASH_REGEX.test(this.password)) {
    return next();
  }

  this.password = await bcrypt.hash(this.password, env.bcryptSaltRounds);
  return next();
});

userSchema.methods.comparePassword = async function comparePassword(candidatePassword) {
  if (!this.password) {
    return false;
  }

  if (!BCRYPT_HASH_REGEX.test(this.password)) {
    return this.password === candidatePassword;
  }

  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.toPublicJSON = function toPublicJSON(req) {
  return pickUser(this, req);
};

userSchema.index({ role: 1, isActive: 1, program: 1, department: 1 });
userSchema.index({ role: 1, createdAt: -1 });
userSchema.index({ updatedAt: -1 });
userSchema.index({ 'webAuthnCredentials.credentialId': 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('User', userSchema);
