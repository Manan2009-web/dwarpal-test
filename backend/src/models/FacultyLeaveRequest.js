const mongoose = require('mongoose');
const {
  ACTION_STATUSES,
  FACULTY_LEAVE_OVERALL_STATUSES,
  FACULTY_LEAVE_TYPES,
  FACULTY_SHORT_LEAVE_STATUSES,
  FACULTY_WORKLOAD_STATUSES,
  PHONE_REGEX,
  TIME_REGEX
} = require('../constants/appConstants');
const { generateGatepassId } = require('../utils/gatepassId');

const approvalActionSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ACTION_STATUSES,
      default: 'pending'
    },
    actionBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    actedAt: {
      type: Date,
      default: null
    },
    comment: {
      type: String,
      trim: true,
      maxlength: 500,
      default: ''
    }
  },
  {
    _id: false
  }
);

const securityActionSchema = new mongoose.Schema(
  {
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    verifiedAt: {
      type: Date,
      default: null
    },
    checkedOutBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    checkedOutAt: {
      type: Date,
      default: null
    },
    checkedInBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    checkedInAt: {
      type: Date,
      default: null
    },
    checkOutNote: {
      type: String,
      trim: true,
      maxlength: 500,
      default: ''
    },
    checkInNote: {
      type: String,
      trim: true,
      maxlength: 500,
      default: ''
    }
  },
  {
    _id: false
  }
);

const facultyDetailsSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },
    employeeId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 40
    },
    designation: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },
    department: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },
    contactNumber: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator(value) {
          return PHONE_REGEX.test(value);
        },
        message: 'Please provide a valid contact number'
      }
    },
    emailId: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 160
    }
  },
  {
    _id: false
  }
);

const leaveDetailsSchema = new mongoose.Schema(
  {
    leaveType: {
      type: String,
      enum: FACULTY_LEAVE_TYPES,
      required: true
    },
    leaveTypeOther: {
      type: String,
      trim: true,
      maxlength: 120,
      default: ''
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      minlength: 5,
      maxlength: 1200
    },
    leaveFrom: {
      type: Date,
      required: true
    },
    leaveTo: {
      type: Date,
      required: true
    },
    totalDays: {
      type: Number,
      required: true,
      min: 1,
      max: 365
    }
  },
  {
    _id: false
  }
);

const workloadAdjustmentSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true
    },
    time: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },
    subjectOrCourseCode: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },
    classOrSemester: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },
    adjustedFacultyName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },
    adjustedFacultySignature: {
      type: String,
      trim: true,
      maxlength: 160,
      default: ''
    }
  },
  {
    _id: false
  }
);

const declarationSchema = new mongoose.Schema(
  {
    confirmed: {
      type: Boolean,
      required: true
    },
    declarationDate: {
      type: Date,
      required: true
    },
    digitalAcknowledgmentName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    }
  },
  {
    _id: false
  }
);

const shortLeaveSchema = new mongoose.Schema(
  {
    staffMemberName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },
    designation: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },
    department: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },
    instituteName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180
    },
    employeeId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 40
    },
    leaveDate: {
      type: Date,
      required: true
    },
    requestedFrom: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator(value) {
          return TIME_REGEX.test(value);
        },
        message: 'requestedFrom must be in HH:mm format'
      }
    },
    requestedTo: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator(value) {
          return TIME_REGEX.test(value);
        },
        message: 'requestedTo must be in HH:mm format'
      }
    },
    totalDurationMinutes: {
      type: Number,
      required: true,
      min: 1,
      max: 1440
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      minlength: 5,
      maxlength: 1200
    },
    applicantConfirmed: {
      type: Boolean,
      required: true
    },
    applicationDate: {
      type: Date,
      required: true
    },
    digitalSignatureName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    }
  },
  {
    _id: false
  }
);

const facultyLeaveQrPayloadSchema = new mongoose.Schema(
  {
    version: {
      type: String,
      default: '1.0'
    },
    gatepassId: {
      type: String,
      trim: true,
      required: true
    },
    applicantType: {
      type: String,
      trim: true,
      default: 'faculty'
    },
    facultyName: {
      type: String,
      trim: true,
      default: ''
    },
    employeeId: {
      type: String,
      trim: true,
      default: ''
    },
    department: {
      type: String,
      trim: true,
      default: ''
    },
    reason: {
      type: String,
      trim: true,
      default: ''
    },
    outTime: {
      type: String,
      trim: true,
      default: ''
    },
    returnTime: {
      type: String,
      trim: true,
      default: ''
    },
    verificationToken: {
      type: String,
      trim: true,
      default: ''
    },
    verificationUrl: {
      type: String,
      trim: true,
      default: ''
    },
    recordType: {
      type: String,
      trim: true,
      default: undefined
    },
    requestKind: {
      type: String,
      trim: true,
      default: undefined
    },
    issuer: {
      type: String,
      trim: true,
      default: undefined
    },
    signature: {
      type: String,
      trim: true,
      default: undefined
    },
    issuedAt: {
      type: String,
      trim: true,
      default: undefined
    },
    expiresAt: {
      type: String,
      trim: true,
      default: undefined
    }
  },
  {
    _id: false,
    strict: false
  }
);

const facultyLeaveRequestSchema = new mongoose.Schema(
  {
    requestNumber: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    facultyDetails: {
      type: facultyDetailsSchema,
      required: true
    },
    leaveDetails: {
      type: leaveDetailsSchema,
      required: true
    },
    workloadAdjustments: {
      type: [workloadAdjustmentSchema],
      required: true,
      validate: {
        validator(value) {
          return Array.isArray(value) && value.length > 0;
        },
        message: 'At least one workload adjustment row is required'
      }
    },
    workloadDeclarations: {
      lecturesAdjustedConfirmed: {
        type: Boolean,
        required: true
      },
      noAcademicLossConfirmed: {
        type: Boolean,
        required: true
      }
    },
    declaration: {
      type: declarationSchema,
      required: true
    },
    shortLeave: {
      type: shortLeaveSchema,
      required: true
    },
    hodReviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    principalReviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    caoReviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    workloadStatus: {
      type: String,
      enum: FACULTY_WORKLOAD_STATUSES,
      default: 'pending_hod',
      index: true
    },
    shortLeaveStatus: {
      type: String,
      enum: FACULTY_SHORT_LEAVE_STATUSES,
      default: 'pending_principal',
      index: true
    },
    overallStatus: {
      type: String,
      enum: FACULTY_LEAVE_OVERALL_STATUSES,
      default: 'pending',
      index: true
    },
    verificationToken: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
      default: undefined
    },
    qrCodeDataUrl: {
      type: String,
      default: null
    },
    qrVerificationUrl: {
      type: String,
      default: null
    },
    qrPayload: {
      type: facultyLeaveQrPayloadSchema,
      default: null
    },
    qrGeneratedAt: {
      type: Date,
      default: null
    },
    qrExpiresAt: {
      type: Date,
      default: null
    },
    qrRevokedAt: {
      type: Date,
      default: null
    },
    securityAction: {
      type: securityActionSchema,
      default: () => ({})
    },
    hodAction: {
      type: approvalActionSchema,
      default: () => ({
        status: 'pending'
      })
    },
    principalAction: {
      type: approvalActionSchema,
      default: () => ({
        status: 'pending'
      })
    },
    caoAction: {
      type: approvalActionSchema,
      default: () => ({
        status: 'not_required'
      })
    },
    latestComment: {
      type: String,
      trim: true,
      maxlength: 500,
      default: ''
    },
    rejectionReason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

facultyLeaveRequestSchema.pre('validate', async function assignRequestNumber(next) {
  try {
    if (!this.isNew || this.requestNumber) {
      return next();
    }

    this.requestNumber = await generateGatepassId('faculty', new Date());
    return next();
  } catch (error) {
    return next(error);
  }
});

facultyLeaveRequestSchema.index({ createdBy: 1, updatedAt: -1 });
facultyLeaveRequestSchema.index({ overallStatus: 1, updatedAt: -1 });
facultyLeaveRequestSchema.index({ workloadStatus: 1, hodReviewer: 1, updatedAt: -1 });
facultyLeaveRequestSchema.index({ shortLeaveStatus: 1, principalReviewer: 1, updatedAt: -1 });
facultyLeaveRequestSchema.index({ shortLeaveStatus: 1, caoReviewer: 1, updatedAt: -1 });
facultyLeaveRequestSchema.index({ 'facultyDetails.department': 1, updatedAt: -1 });
facultyLeaveRequestSchema.index({ 'leaveDetails.leaveFrom': 1, updatedAt: -1 });
facultyLeaveRequestSchema.index({ 'shortLeave.leaveDate': 1, updatedAt: -1 });

module.exports = mongoose.model('FacultyLeaveRequest', facultyLeaveRequestSchema);
