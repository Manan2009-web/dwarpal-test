const crypto = require('crypto');
const { APPROVED_GATEPASS_STATUSES } = require('../constants/appConstants');

function generatePassNumber() {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `DP-${datePart}-${randomPart}`;
}

function generateVerificationToken() {
  return crypto.randomBytes(16).toString('hex').toUpperCase();
}

function normalizeVehicleNumber(vehicleNumber) {
  if (!vehicleNumber) {
    return '';
  }

  return vehicleNumber.trim().replace(/\s+/g, ' ').toUpperCase();
}

function isApprovedGatepassStatus(status) {
  return APPROVED_GATEPASS_STATUSES.includes(status);
}

module.exports = {
  generatePassNumber,
  generateVerificationToken,
  isApprovedGatepassStatus,
  normalizeVehicleNumber
};
