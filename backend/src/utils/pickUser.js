const { toPublicUrl } = require('./request');
const { normalizeRole } = require('../constants/appConstants');
const {
  getPendingVerificationEmail,
  getUserVerificationEmail,
  isUserEmailVerified
} = require('./emailVerificationState');

function pickUser(user, req) {
  if (!user) {
    return null;
  }

  const source = typeof user.toObject === 'function' ? user.toObject() : user;
  const normalizedRole = normalizeRole(source.role) || source.role;
  const emailVerified = isUserEmailVerified(source);
  const pendingEmail = getPendingVerificationEmail(source) || null;
  const verificationEmail = getUserVerificationEmail(source) || source.email || null;

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
    emailVerified,
    isEmailVerified: emailVerified,
    emailVerifiedAt: source.emailVerifiedAt || null,
    pendingEmail,
    verificationEmail,
    isActive: source.isActive,
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
