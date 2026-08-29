const mongoose = require('mongoose');
const { DEPARTMENTS, STUDENT_PROGRAMS, SEMESTERS } = require('../constants/appConstants');

const faqItemSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300
    },
    answer: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000
    },
    order: {
      type: Number,
      default: 0
    }
  },
  { _id: true }
);

const siteConfigSchema = new mongoose.Schema(
  {
    singletonKey: {
      type: String,
      required: true,
      unique: true,
      default: 'dwarpal_global_config'
    },
    cms: {
      hero: {
        headline: {
          type: String,
          default: 'Autonomous Campus Gatepass & Security Infrastructure',
          trim: true,
          maxlength: 200
        },
        subheadline: {
          type: String,
          default: 'Replace paper chits with cryptographic dynamic QR gatepasses, multi-tier automated approvals, and sub-second gate scanning.',
          trim: true,
          maxlength: 500
        },
        badgeText: {
          type: String,
          default: 'CAMPUS GATEPASS 2.0',
          trim: true,
          maxlength: 60
        },
        ctaPrimaryText: {
          type: String,
          default: 'Access Security Portal',
          trim: true,
          maxlength: 60
        },
        ctaPrimaryLink: {
          type: String,
          default: '/access-portal',
          trim: true
        },
        ctaSecondaryText: {
          type: String,
          default: 'Student Registration',
          trim: true,
          maxlength: 60
        },
        ctaSecondaryLink: {
          type: String,
          default: '/student/register',
          trim: true
        }
      },
      announcementBanner: {
        enabled: {
          type: Boolean,
          default: false
        },
        message: {
          type: String,
          default: '',
          trim: true,
          maxlength: 300
        },
        type: {
          type: String,
          enum: ['info', 'warning', 'alert', 'success'],
          default: 'info'
        },
        link: {
          type: String,
          default: '',
          trim: true
        }
      },
      support: {
        appName: {
          type: String,
          default: 'DwarPal',
          trim: true
        },
        supportEmail: {
          type: String,
          default: 'dwarpal@neotech.ac.in',
          trim: true
        },
        primaryPhone: {
          type: String,
          default: '+91 93285 63802',
          trim: true
        },
        secondaryPhone: {
          type: String,
          default: '+91 92657 93539',
          trim: true
        },
        operatingHours: {
          type: String,
          default: 'Monday – Saturday, 8:00 AM – 6:00 PM IST',
          trim: true
        },
        officeLocation: {
          type: String,
          default: 'Central Security Cabin / IT Helpdesk, Gate 1',
          trim: true
        }
      },
      faqs: {
        type: [faqItemSchema],
        default: [
          {
            question: 'How do I submit a campus gatepass request?',
            answer: 'From your dashboard, tap the "+ New Gatepass" button. Fill in the departure date, leaving time, expected return time, reason for leaving, and destination, then submit. Your request will appear immediately with a "Pending" status while it awaits coordinator review.',
            order: 1
          },
          {
            question: 'Who reviews and approves my gatepass?',
            answer: 'Student gatepasses are reviewed by your department Academic HOD or Principal, depending on your program. Once approved, the status badge turns green and an encrypted rolling QR code becomes available.',
            order: 2
          },
          {
            question: 'How does the security guard verify my gatepass at the gate?',
            answer: 'Open your approved gatepass on DwarPal and tap "View QR Code." Show the dynamic QR code to the guard. The guard scans it with the DwarPal Security console, which logs your campus exit timestamp automatically.',
            order: 3
          },
          {
            question: 'What happens if there is an emergency or network outage?',
            answer: 'DwarPal maintains an offline physical register protocol. Guards maintain emergency manual registers, which are reconciled by campus IT once connectivity is restored. In true emergencies, safety always comes first.',
            order: 4
          }
        ]
      },
      branding: {
        siteTitle: {
          type: String,
          default: 'DwarPal — Intelligent Campus Pass System',
          trim: true
        },
        footerText: {
          type: String,
          default: '© 2026 DwarPal. NeoTech Technical Campus. All rights reserved.',
          trim: true
        }
      }
    },
    rules: {
      departments: {
        type: [String],
        default: () => [...DEPARTMENTS]
      },
      programs: {
        type: [String],
        default: () => [...STUDENT_PROGRAMS]
      },
      semesters: {
        type: [Number],
        default: () => [...SEMESTERS]
      },
      gatepass: {
        minReasonLength: {
          type: Number,
          default: 5
        },
        maxReasonLength: {
          type: Number,
          default: 500
        },
        maxActivePassesPerStudent: {
          type: Number,
          default: 1
        },
        allowedCheckoutStartHour: {
          type: String,
          default: '06:00'
        },
        allowedCheckoutEndHour: {
          type: String,
          default: '21:00'
        },
        curfewReturnHour: {
          type: String,
          default: '22:00'
        },
        allowWeekendPasses: {
          type: Boolean,
          default: true
        }
      }
    },
    features: {
      maintenanceMode: {
        enabled: {
          type: Boolean,
          default: false
        },
        message: {
          type: String,
          default: 'DwarPal is currently undergoing scheduled maintenance. Normal gate operations are active manually at campus checkpoints.',
          trim: true
        },
        allowedRoles: {
          type: [String],
          default: ['admin', 'it', 'chairman']
        }
      },
      campusLockdown: {
        enabled: {
          type: Boolean,
          default: false
        },
        reason: {
          type: String,
          default: '',
          trim: true
        },
        initiatedAt: {
          type: Date,
          default: null
        },
        initiatedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          default: null
        }
      },
      studentSelfRegistration: {
        enabled: {
          type: Boolean,
          default: true
        },
        notice: {
          type: String,
          default: '',
          trim: true
        }
      },
      biometricAuth: {
        enabled: {
          type: Boolean,
          default: true
        }
      },
      emailNotifications: {
        enabled: {
          type: Boolean,
          default: true
        }
      },
      pushNotifications: {
        enabled: {
          type: Boolean,
          default: true
        }
      }
    },
    lastUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('SiteConfig', siteConfigSchema);
