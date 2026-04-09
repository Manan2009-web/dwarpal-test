const mongoose = require('mongoose');
const {
  ACTION_STATUSES,
  APPROVAL_LEVELS,
  GATEPASS_STATUSES,
  VEHICLE_NUMBER_REGEX
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

const applicantSnapshotSchema = new mongoose.Schema(
  {
    fullName: String,
    email: String,
    department: {
      type: String,
      default: null
    },
    semester: {
      type: Number,
      default: null
    },
    enrollmentNo: {
      type: String,
      default: null
    },
    employeeId: {
      type: String,
      default: null
    },
    phone: String
  },
  {
    _id: false
  }
);

const qrPayloadSchema = new mongoose.Schema(
  {
    version: {
      type: String,
      default: '1.0'
    },
    gatepassId: {
      type: String,
      trim: true,
      uppercase: true
    },
    applicantType: {
      type: String,
      enum: ['student', 'faculty']
    },
    studentName: {
      type: String,
      trim: true,
      default: undefined
    },
    facultyName: {
      type: String,
      trim: true,
      default: undefined
    },
    enrollmentNumber: {
      type: String,
      trim: true,
      default: undefined
    },
    employeeId: {
      type: String,
      trim: true,
      default: undefined
    },
    department: {
      type: String,
      trim: true,
      default: 'Not assigned'
    },
    vehicleNumber: {
      type: String,
      trim: true,
      uppercase: true,
      default: undefined
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
    },
    returnTime: {
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

const gatepassSchema = new mongoose.Schema(
  {
    passNumber: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    gatepassId: {
      type: String,
      trim: true,
      uppercase: true,
      default: undefined
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    applicantType: {
      type: String,
      enum: ['student', 'faculty'],
      required: true,
      index: true
    },
    applicantSnapshot: {
      type: applicantSnapshotSchema,
      required: true
    },
    reason: {
      type: String,
      required: [true, 'Reason of leaving is required.'],
      trim: true,
      minlength: [5, 'Minimum length of reason is 5 characters.'],
      maxlength: [500, 'Maximum length of reason is 500 characters.']
    },
    destination: {
      type: String,
      trim: true,
      maxlength: 200,
      default: ''
    },
    outDate: {
      type: Date,
      required: true,
      index: true
    },
    outTime: {
      type: String,
      required: true,
      trim: true
    },
    expectedReturnDate: {
      type: Date,
      default: null
    },
    expectedReturnTime: {
      type: String,
      trim: true,
      default: ''
    },
    vehicleNumber: {
      type: String,
      trim: true,
      uppercase: true,
      validate: {
        validator(value) {
          if (!value) {
            return true;
          }

          return VEHICLE_NUMBER_REGEX.test(value);
        },
        message: 'Please provide a valid vehicle number'
      },
      default: ''
    },
    status: {
      type: String,
      enum: GATEPASS_STATUSES,
      required: true,
      index: true
    },
    currentApprovalLevel: {
      type: String,
      enum: APPROVAL_LEVELS,
      default: undefined
    },
    forwardedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    principalAction: {
      type: approvalActionSchema,
      default: () => ({
        status: 'pending'
      })
    },
    hodAction: {
      type: approvalActionSchema,
      default: () => ({
        status: 'not_required'
      })
    },
    caoAction: {
      type: approvalActionSchema,
      default: () => ({
        status: 'not_required'
      })
    },
    securityAction: {
      type: securityActionSchema,
      default: () => ({})
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: '',
      validate: {
        validator(value) {
          const normalizedValue = String(value || '').trim();

          if (!normalizedValue) {
            return true;
          }

          return normalizedValue.length >= 5 && normalizedValue.length <= 500;
        },
        message(properties) {
          const normalizedValue = String(properties.value || '').trim();

          if (!normalizedValue) {
            return 'Reject reason is required.';
          }

          if (normalizedValue.length < 5) {
            return 'Minimum length of reject reason is 5 characters.';
          }

          return 'Maximum length of reject reason is 500 characters.';
        }
      }
    },
    isCancelled: {
      type: Boolean,
      default: false,
      index: true
    },
    isCompleted: {
      type: Boolean,
      default: false,
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
      type: qrPayloadSchema,
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
    }
  },
  {
    timestamps: true
  }
);

gatepassSchema.pre('validate', async function assignIdentifiers(next) {
  try {
    if (!this.isNew) {
      return next();
    }

    if (!this.gatepassId) {
      this.gatepassId = await generateGatepassId(this.applicantType, new Date());
    }

    if (!this.passNumber) {
      this.passNumber = this.gatepassId;
    }

    return next();
  } catch (error) {
    return next(error);
  }
});

gatepassSchema.index({ createdBy: 1, updatedAt: -1 });
gatepassSchema.index({ gatepassId: 1 }, { unique: true, sparse: true });
gatepassSchema.index({ applicantType: 1, status: 1, updatedAt: -1 });
gatepassSchema.index({ status: 1, updatedAt: -1 });
gatepassSchema.index({ forwardedTo: 1, status: 1, updatedAt: -1 });
gatepassSchema.index({ currentApprovalLevel: 1, updatedAt: -1 });
gatepassSchema.index({ outDate: 1, status: 1 });
gatepassSchema.index({ 'applicantSnapshot.department': 1, status: 1, updatedAt: -1 });
gatepassSchema.index({ 'hodAction.status': 1, updatedAt: -1 });
gatepassSchema.index({ 'caoAction.status': 1, updatedAt: -1 });
gatepassSchema.index({ 'principalAction.status': 1, updatedAt: -1 });

module.exports = mongoose.model('Gatepass', gatepassSchema);
