const GatepassCounter = require('../models/GatepassCounter');
const AppError = require('./appError');

const GATEPASS_ID_PREFIXES = Object.freeze({
  student: 'DP-STU',
  faculty: 'DP-FAC'
});
const GATEPASS_COUNTER_VERSION = 'v2';

function formatGatepassPeriod(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}${month}`;
}

function getGatepassIdPrefix(applicantType) {
  const prefix = GATEPASS_ID_PREFIXES[applicantType];

  if (!prefix) {
    throw new AppError('Unable to generate gatepass ID for this applicant type', 400);
  }

  return prefix;
}

async function generateGatepassId(applicantType, date = new Date()) {
  const period = formatGatepassPeriod(date);
  const prefix = getGatepassIdPrefix(applicantType);
  const counterKey = `${GATEPASS_COUNTER_VERSION}:${applicantType}:${period}`;
  const counter = await GatepassCounter.findOneAndUpdate(
    // Match by the real unique key so legacy counters created before the
    // versioned _id rollout are reused instead of triggering duplicate inserts.
    { applicantType, period },
    {
      $setOnInsert: {
        _id: counterKey,
        applicantType,
        period
      },
      $inc: {
        sequence: 1
      }
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
      lean: true
    }
  );

  return `${prefix}-${period}${String(counter.sequence).padStart(4, '0')}`;
}

module.exports = {
  formatGatepassPeriod,
  generateGatepassId,
  getGatepassIdPrefix
};
