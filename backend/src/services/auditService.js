const AuditLog = require('../models/AuditLog');

async function logAction({
  actorId = null,
  resourceType,
  resourceId = null,
  action,
  message,
  metadata = {},
  requestMeta = {}
}) {
  return AuditLog.create({
    actor: actorId,
    resourceType,
    resourceId: resourceId ? resourceId.toString() : null,
    action,
    message,
    metadata,
    ipAddress: requestMeta.ipAddress || '',
    userAgent: requestMeta.userAgent || ''
  });
}

module.exports = {
  logAction
};
