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
const { E164_PHONE_REGEX, normalizePhoneNumber } = require('../utils/phone');
const { syncEmailVerificationFields } = require('../utils/emailVerificationState');
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

const coordinatorAssignmentSchema = new mongoose.Schema(
  {
    isCoordinator: {
      type: Boolean,
      default: false
    },
    program: {
      type: String,
      enum: STUDENT_PROGRAMS,
      default: null
    },
    department: {
      type: String,
      enum: ROUTING_DEPARTMENTS,
      default: null
    },
    semester: {
      type: Number,
      enum: SEMESTERS,
      default: null
    }
  },
  {
    _id: false
  }
);

const coordinatorClassScopeSchema = new mongoose.Schema(
  {
    program: {
      type: String,
      trim: true,
      default: null
    },
    department: {
      type: String,
      trim: true,
      default: null
    },
    semester: {
      type: Number,
      default: null
    },
    division: {
      type: String,
      trim: true,
      maxlength: 40,
      default: ''
    },
    academicYear: {
      type: String,
      trim: true,
      maxlength: 40,
      default: ''
    }
  },
  {
    _id: false
  }
);

const coordinatorScopeSchema = new mongoose.Schema(
  {
    isCoordinator: {
      type: Boolean,
      default: false
    },
    program: {
      type: String,
      trim: true,
      default: null
    },
    department: {
      type: String,
      trim: true,
      default: null
    },
    semester: {
      type: Number,
      default: null
    },
    division: {
      type: String,
      trim: true,
      maxlength: 40,
      default: ''
    },
    academicYear: {
      type: String,
      trim: true,
      maxlength: 40,
      default: ''
    },
    assignedClasses: {
      type: [coordinatorClassScopeSchema],
      default: []
    }
  },
  {
    _id: false
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
      required: [true, 'Role is required']
    },
    program: {
      type: String,
      trim: true,
      default: null,
      required: [function() { return ['student', 'principal', 'admin', 'hod'].includes(this.role); }, 'Program is required'],
      validate: {
        validator(value) {
          if (!value) {
            return !['student', 'principal', 'admin', 'hod'].includes(this.role);
          }
          return STUDENT_PROGRAMS.includes(value);
        },
        message: 'Please provide a valid program'
      }
    },
    department: {
      type: String,
      trim: true,
      default: null,
      required: [function() { return ['student', 'faculty', 'hod'].includes(this.role); }, 'Department is required'],
      validate: {
        validator(value) {
          if (!value) {
            return !['student', 'faculty', 'hod'].includes(this.role);
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
    designation: {
      type: String,
      trim: true,
      default: null,
      validate: {
        validator(value) {
          if (this.role === 'faculty') {
            return Boolean(value);
          }
          return true;
        },
        message: 'Designation is required for faculty'
      }
    },
    securityZone: {
      type: String,
      trim: true,
      default: null,
      validate: {
        validator(value) {
          if (this.role === 'security') {
            return Boolean(value);
          }
          return true;
        },
        message: 'Security zone is required for security guards'
      }
    },
    accessLevel: {
      type: String,
      trim: true,
      default: null,
      validate: {
        validator(value) {
          if (this.role === 'admin') {
            return Boolean(value);
          }
          return true;
        },
        message: 'Access level is required for admins'
      }
    },
    authorityLevel: {
      type: String,
      trim: true,
      default: null,
      validate: {
        validator(value) {
          if (this.role === 'cao') {
            return Boolean(value);
          }
          return true;
        },
        message: 'Authority level is required for CAO'
      }
    },
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      validate: {
        validator(value) {
          return E164_PHONE_REGEX.test(String(value || '').trim());
        },
        message: 'Please provide a valid phone number'
      }
    },
    createdByCao: {
      type: Boolean,
      default: false
    },
    mustChangePassword: {
      type: Boolean,
      default: false
    },
    temporaryCredentialEncrypted: {
      type: String,
      select: false,
      default: null
    },
    temporaryCredentialCreatedAt: {
      type: Date,
      default: null
    },
    profileImage: {
      type: String,
      default: null
    },
    emailVerified: {
      type: Boolean,
      default: false
    },
    isEmailVerified: {
      type: Boolean,
      default: false
    },
    emailVerifiedAt: {
      type: Date,
      default: null
    },
    pendingEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: null
    },
    emailVerificationOtpHash: {
      type: String,
      select: false,
      default: null
    },
    emailVerificationOtpExpiresAt: {
      type: Date,
      default: null
    },
    emailVerificationOtpSentAt: {
      type: Date,
      default: null
    },
    emailVerificationOtpAttempts: {
      type: Number,
      default: 0,
      min: 0
    },
    emailVerificationOtpResendCount: {
      type: Number,
      default: 0,
      min: 0
    },
    isActive: {
      type: Boolean,
      default: true
    },
    lastLoginAt: {
      type: Date,
      default: null
    },
    hasBiometricCredentials: {
      type: Boolean,
      default: false
    },
    gatepassApprovalEnabled: {
      type: Boolean,
      default: true
    },
    isCoordinator: {
      type: Boolean,
      default: false
    },
    coordinatorAssignment: {
      type: coordinatorAssignmentSchema,
      default: () => ({})
    },
    coordinatorScope: {
      type: coordinatorScopeSchema,
      default: () => ({})
    },
    permissions: {
      type: [String],
      default: [],
      set(values) {
        if (!Array.isArray(values)) {
          return [];
        }

        return Array.from(
          new Set(
            values
              .map((value) =>
                String(value || '')
                  .trim()
                  .toLowerCase()
              )
              .filter(Boolean)
          )
        );
      }
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

  if (this.pendingEmail) {
    this.pendingEmail = this.pendingEmail.trim().toLowerCase();
  }

  if (this.phone) {
    this.phone = normalizePhoneNumber(this.phone, {
      defaultCountryCode: env.defaultPhoneCountryCode
    });
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
    this.designation = undefined;
    this.securityZone = undefined;
    this.accessLevel = undefined;
    this.authorityLevel = undefined;
  } else if (this.role === 'faculty') {
    this.enrollmentNo = undefined;
    this.enrollment = undefined;
    this.semester = undefined;
    this.employeeId = this.employeeId ? String(this.employeeId).trim().toUpperCase() : undefined;
    this.program = undefined;
    this.department = normalizeDepartment(this.department) || undefined;
    this.designation = this.designation ? String(this.designation).trim() : undefined;
    this.securityZone = undefined;
    this.accessLevel = undefined;
    this.authorityLevel = undefined;
  } else if (this.role === 'hod') {
    this.enrollmentNo = undefined;
    this.enrollment = undefined;
    this.semester = undefined;
    this.employeeId = this.employeeId ? String(this.employeeId).trim().toUpperCase() : undefined;
    this.program = normalizeProgram(this.program) || undefined;
    this.department = normalizeDepartment(this.department) || undefined;
    this.designation = 'HOD';
    this.securityZone = undefined;
    this.accessLevel = undefined;
    this.authorityLevel = undefined;
  } else if (this.role === 'principal') {
    this.enrollmentNo = undefined;
    this.enrollment = undefined;
    this.semester = undefined;
    this.employeeId = this.employeeId ? String(this.employeeId).trim().toUpperCase() : undefined;
    this.program = normalizeProgram(this.program) || undefined;
    this.department = undefined;
    this.designation = 'Principal';
    this.securityZone = undefined;
    this.accessLevel = undefined;
    this.authorityLevel = undefined;
  } else if (this.role === 'security') {
    this.enrollmentNo = undefined;
    this.enrollment = undefined;
    this.semester = undefined;
    this.employeeId = this.employeeId ? String(this.employeeId).trim().toUpperCase() : undefined;
    this.program = undefined;
    this.department = undefined;
    this.designation = undefined;
    this.securityZone = this.securityZone ? String(this.securityZone).trim() : undefined;
    this.accessLevel = undefined;
    this.authorityLevel = undefined;
  } else if (this.role === 'admin') {
    this.enrollmentNo = undefined;
    this.enrollment = undefined;
    this.semester = undefined;
    this.employeeId = this.employeeId ? String(this.employeeId).trim().toUpperCase() : undefined;
    this.program = normalizeProgram(this.program) || undefined;
    this.department = undefined;
    this.designation = undefined;
    this.securityZone = undefined;
    this.accessLevel = this.accessLevel ? String(this.accessLevel).trim() : undefined;
    this.authorityLevel = undefined;
  } else if (this.role === 'cao') {
    this.enrollmentNo = undefined;
    this.enrollment = undefined;
    this.semester = undefined;
    this.employeeId = this.employeeId ? String(this.employeeId).trim().toUpperCase() : undefined;
    this.program = undefined;
    this.department = undefined;
    this.designation = undefined;
    this.securityZone = undefined;
    this.accessLevel = undefined;
    this.authorityLevel = this.authorityLevel ? String(this.authorityLevel).trim() : undefined;
  }

  const permissionsMap = {
    student: ['student:dashboard'],
    faculty: ['faculty:dashboard'],
    hod: ['hod:dashboard'],
    principal: ['principal:dashboard'],
    security: ['security:dashboard'],
    cao: ['cao:dashboard'],
    admin: ['admin:dashboard', 'admin:access', 'admin:*', 'export:*']
  };

  if (!this.permissions || !this.permissions.length) {
    this.permissions = permissionsMap[this.role] || [];
  }

  if (Array.isArray(this.permissions)) {
    this.permissions = Array.from(
      new Set(
        this.permissions
          .map((permission) =>
            String(permission || '')
              .trim()
              .toLowerCase()
          )
          .filter(Boolean)
      )
    );
  }

  if (!['principal', 'hod'].includes(this.role)) {
    this.gatepassApprovalEnabled = true;
  }

  this.hasBiometricCredentials = Array.isArray(this.webAuthnCredentials) && this.webAuthnCredentials.length > 0;
  syncEmailVerificationFields(this);

  // ── Dynamic Coordinator Overhaul: Unset fields so they are never saved in users collection ──
  this.isCoordinator = undefined;
  this.coordinatorAssignment = undefined;
  this.coordinatorScope = undefined;

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
userSchema.index({ role: 1, isActive: 1, gatepassApprovalEnabled: 1 });
userSchema.index({ permissions: 1, isActive: 1 });
userSchema.index({ role: 1, createdAt: -1 });
userSchema.index({ updatedAt: -1 });
userSchema.index({ 'webAuthnCredentials.credentialId': 1 }, { unique: true, sparse: true });

// ── Dynamic Coordinator Overhaul Hook logic ──────────────────────────────────
function attachDynamicCoordinatorFields(doc, activeClasses) {
  if (!doc) return;

  if (activeClasses && activeClasses.length > 0) {
    doc.isCoordinator = true;
    const primaryClass = activeClasses[0];
    doc.coordinatorAssignment = {
      isCoordinator: true,
      program: primaryClass.program,
      department: primaryClass.department,
      semester: primaryClass.semester
    };
    doc.coordinatorScope = {
      isCoordinator: true,
      program: primaryClass.program,
      department: primaryClass.department,
      semester: primaryClass.semester,
      division: primaryClass.division || '',
      academicYear: primaryClass.academicYear || '',
      assignedClasses: activeClasses.map((c) => ({
        program: c.program,
        department: c.department,
        semester: c.semester,
        division: c.division || '',
        academicYear: c.academicYear || ''
      }))
    };
  } else {
    doc.isCoordinator = false;
    doc.coordinatorAssignment = {
      isCoordinator: false,
      program: null,
      department: null,
      semester: null
    };
    doc.coordinatorScope = {
      isCoordinator: false,
      program: null,
      department: null,
      semester: null,
      division: '',
      academicYear: '',
      assignedClasses: []
    };
  }
}

async function populateCoordinatorForSingle(doc) {
  if (!doc) return;
  try {
    const Class = mongoose.model('Class');
    const activeClasses = await Class.find({ coordinator_id: doc._id });
    attachDynamicCoordinatorFields(doc, activeClasses);
  } catch (err) {
    // Fallback if Class model is not loaded yet
    attachDynamicCoordinatorFields(doc, []);
  }
}

async function populateCoordinatorForMany(docs) {
  if (!docs || docs.length === 0) return;
  try {
    const userIds = docs.map((doc) => doc._id);
    const Class = mongoose.model('Class');
    const classes = await Class.find({ coordinator_id: { $in: userIds } });

    const classMap = {};
    classes.forEach((c) => {
      const uid = String(c.coordinator_id);
      if (!classMap[uid]) classMap[uid] = [];
      classMap[uid].push(c);
    });

    docs.forEach((doc) => {
      const activeClasses = classMap[String(doc._id)] || [];
      attachDynamicCoordinatorFields(doc, activeClasses);
    });
  } catch (err) {
    docs.forEach((doc) => attachDynamicCoordinatorFields(doc, []));
  }
}

// Register Mongoose hooks for dynamic query-time population
userSchema.post('find', async function (docs) {
  await populateCoordinatorForMany(docs);
});

userSchema.post('findOne', async function (doc) {
  await populateCoordinatorForSingle(doc);
});

userSchema.post('findOneAndUpdate', async function (doc) {
  await populateCoordinatorForSingle(doc);
});

userSchema.post('save', async function (doc) {
  await populateCoordinatorForSingle(doc);
});

module.exports = mongoose.model('User', userSchema);
