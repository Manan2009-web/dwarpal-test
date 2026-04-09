const mongoose = require('mongoose');
const connectDatabase = require('../config/db');
const Gatepass = require('../models/Gatepass');
const FacultyLeaveRequest = require('../models/FacultyLeaveRequest');
const GatepassCounter = require('../models/GatepassCounter');
const { formatGatepassPeriod, getGatepassIdPrefix } = require('../utils/gatepassId');
const { ensureApprovedGatepassQr } = require('../services/gatepassService');
const { ensureApprovedFacultyLeaveQr } = require('../services/facultyLeaveService');

function createIdForSequence(applicantType, period, sequence) {
  const prefix = getGatepassIdPrefix(applicantType);
  return `${prefix}-${period}${String(sequence).padStart(4, '0')}`;
}

function createBucketKey(applicantType, period) {
  return `${applicantType}:${period}`;
}

function getCreatedAtTimestamp(record) {
  return new Date(record.createdAt || record.updatedAt || Date.now()).getTime();
}

async function migrateStudentAndFacultyIdentifiers() {
  const [gatepasses, facultyRequests] = await Promise.all([
    Gatepass.find({}).sort({ createdAt: 1, _id: 1 }),
    FacultyLeaveRequest.find({}).sort({ createdAt: 1, _id: 1 })
  ]);

  const buckets = new Map();

  gatepasses.forEach((gatepass) => {
    const applicantType = gatepass.applicantType === 'faculty' ? 'faculty' : 'student';
    const period = formatGatepassPeriod(gatepass.createdAt || new Date());
    const bucketKey = createBucketKey(applicantType, period);
    const bucket = buckets.get(bucketKey) || [];
    bucket.push({
      recordType: 'gatepass',
      applicantType,
      period,
      record: gatepass
    });
    buckets.set(bucketKey, bucket);
  });

  facultyRequests.forEach((request) => {
    const applicantType = 'faculty';
    const period = formatGatepassPeriod(request.createdAt || new Date());
    const bucketKey = createBucketKey(applicantType, period);
    const bucket = buckets.get(bucketKey) || [];
    bucket.push({
      recordType: 'faculty_leave',
      applicantType,
      period,
      record: request
    });
    buckets.set(bucketKey, bucket);
  });

  const counterUpdates = [];

  for (const [bucketKey, bucketRecords] of buckets.entries()) {
    bucketRecords.sort((left, right) => {
      const timeDifference = getCreatedAtTimestamp(left.record) - getCreatedAtTimestamp(right.record);

      if (timeDifference !== 0) {
        return timeDifference;
      }

      return String(left.record._id).localeCompare(String(right.record._id));
    });

    const [applicantType, period] = bucketKey.split(':');

    for (const [index, entry] of bucketRecords.entries()) {
      const sequence = index + 1;
      const nextIdentifier = createIdForSequence(applicantType, period, sequence);

      if (entry.recordType === 'gatepass') {
        entry.record.gatepassId = nextIdentifier;
        entry.record.passNumber = nextIdentifier;

        if (entry.record.status && ['approved_final', 'approved_by_hod', 'approved_by_cao', 'checked_out_by_security', 'completed'].includes(entry.record.status)) {
          entry.record.qrCodeDataUrl = null;
          entry.record.qrVerificationUrl = null;
          entry.record.qrPayload = null;
          entry.record.qrGeneratedAt = null;
          entry.record.qrExpiresAt = null;
          entry.record.qrRevokedAt = null;
          await ensureApprovedGatepassQr(entry.record);
        }

        await entry.record.save();
      } else {
        entry.record.requestNumber = nextIdentifier;

        if (entry.record.overallStatus === 'approved') {
          entry.record.qrCodeDataUrl = null;
          entry.record.qrVerificationUrl = null;
          entry.record.qrPayload = null;
          entry.record.qrGeneratedAt = null;
          entry.record.qrExpiresAt = null;
          entry.record.qrRevokedAt = null;
          await ensureApprovedFacultyLeaveQr(entry.record);
        }

        await entry.record.save();
      }
    }

    counterUpdates.push({
      updateOne: {
        filter: { _id: `v2:${applicantType}:${period}` },
        update: {
          $set: {
            applicantType,
            period,
            sequence: bucketRecords.length
          }
        },
        upsert: true
      }
    });
  }

  await GatepassCounter.deleteMany({ _id: /^v2:/ });

  if (counterUpdates.length) {
    await GatepassCounter.bulkWrite(counterUpdates);
  }

  return {
    migratedGatepasses: gatepasses.length,
    migratedFacultyRequests: facultyRequests.length,
    updatedCounters: counterUpdates.length
  };
}

async function main() {
  await connectDatabase();
  const result = await migrateStudentAndFacultyIdentifiers();
  console.log(JSON.stringify(result, null, 2));
}

main()
  .then(async () => {
    await mongoose.disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await mongoose.disconnect();
    process.exit(1);
  });
