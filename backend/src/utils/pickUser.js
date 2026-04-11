const { toPublicUrl } = require('./request');
const { normalizeRole } = require('../constants/appConstants');

function pickUser(user, req) {
  if (!user) {
    return null;
  }

  const source = typeof user.toObject === 'function' ? user.toObject() : user;
  const normalizedRole = normalizeRole(source.role) || source.role;

  return {
    id: source._id?.toString?.() || source.id,
    fullName: source.fullName,
    email: source.email,
    role: normalizedRole,
    program: source.program || null,
    department: source.department || null,
    semester: source.semester || null,
    enrollmentNo: source.enrollmentNo || source.enrollment || null,
    employeeId: source.employeeId || null,
    phone: source.phone,
    profileImage: source.profileImage || null,
    profileImageUrl: req ? toPublicUrl(source.profileImage, req) : source.profileImage || null,
    isActive: source.isActive,
    emailVerified: source.emailVerified !== false,
    emailVerifiedAt: source.emailVerifiedAt || null,
    hasBiometricCredentials:
      typeof source.hasBiometricCredentials === 'boolean'
        ? source.hasBiometricCredentials
        : Array.isArray(source.webAuthnCredentials) && source.webAuthnCredentials.length > 0,
    gatepassApprovalEnabled: source.gatepassApprovalEnabled !== false,
    coordinatorAssignment: {
      isCoordinator: Boolean(source.coordinatorAssignment?.isCoordinator),
      program: source.coordinatorAssignment?.program || null,
      department: source.coordinatorAssignment?.department || null,
      semester: source.coordinatorAssignment?.semester || null
    },
    lastLoginAt: source.lastLoginAt || null,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt
  };
}

module.exports = pickUser;
