function normalizeEmailValue(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function isUserEmailVerified(user) {
  if (typeof user?.emailVerified === 'boolean') {
    return user.emailVerified;
  }

  if (typeof user?.isEmailVerified === 'boolean') {
    return user.isEmailVerified;
  }

  return false;
}

function getPendingVerificationEmail(user) {
  const pendingEmail = normalizeEmailValue(user?.pendingEmail);
  return pendingEmail || '';
}

function getUserVerificationEmail(user) {
  return getPendingVerificationEmail(user) || normalizeEmailValue(user?.email);
}

function clearEmailVerificationChallenge(user) {
  if (!user || typeof user !== 'object') {
    return user;
  }

  user.emailVerificationOtpHash = null;
  user.emailVerificationOtpExpiresAt = null;
  user.emailVerificationOtpSentAt = null;
  user.emailVerificationOtpAttempts = 0;
  user.emailVerificationOtpResendCount = 0;
  return user;
}

function syncEmailVerificationFields(user) {
  if (!user || typeof user !== 'object') {
    return user;
  }

  const resolvedVerifiedState = isUserEmailVerified(user);
  user.emailVerified = resolvedVerifiedState;
  user.isEmailVerified = resolvedVerifiedState;

  if (user.pendingEmail) {
    user.pendingEmail = normalizeEmailValue(user.pendingEmail) || null;
  }

  if (resolvedVerifiedState) {
    user.pendingEmail = null;
    clearEmailVerificationChallenge(user);
  } else if (user.emailVerifiedAt) {
    user.emailVerifiedAt = null;
  }

  return user;
}

module.exports = {
  clearEmailVerificationChallenge,
  getPendingVerificationEmail,
  getUserVerificationEmail,
  isUserEmailVerified,
  syncEmailVerificationFields
};
