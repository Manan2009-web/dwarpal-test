const QueuedEmail = require('../models/QueuedEmail');
const env = require('../config/env');

let workerIntervalId = null;
const QUEUE_WORKER_INTERVAL_MS = 8000; // 8 seconds delay
let isWorkerPaused = false;
let batchLimit = 0; // 0 = unlimited
let batchSentCount = 0;

function setBatchLimit(limit) {
  batchLimit = Math.max(0, parseInt(limit, 10) || 0);
  batchSentCount = 0; // reset batch progress counter for new batch
  console.info(`[email-queue] Batch limit set to: ${batchLimit}`);
  if (batchLimit > 0 && isWorkerPaused) {
    setWorkerPaused(false);
  }
}

function getBatchLimit() {
  return { batchLimit, batchSentCount };
}

async function getQueueStatsData() {
  const [sentCount, pendingCount, failedCount] = await Promise.all([
    QueuedEmail.countDocuments({ status: 'sent' }),
    QueuedEmail.countDocuments({ status: { $in: ['pending', 'sending'] } }),
    QueuedEmail.countDocuments({ status: 'failed' })
  ]);
  let poolStatus = [];
  try {
    const { getBrevoPoolStatus } = require('./emailService');
    poolStatus = await getBrevoPoolStatus();
  } catch (err) {}

  return {
    sentCount,
    pendingCount,
    failedCount,
    isWorkerPaused,
    batchSentCount,
    batchLimit,
    poolStatus
  };
}

function emitEmailQueueEvent(type, payload = {}) {
  try {
    const { emitToRole } = require('./realtimeService');
    const eventData = { type, ...payload };
    emitToRole('it', 'email:queue:event', eventData);
    emitToRole('admin', 'email:queue:event', eventData);
  } catch (err) {
    // safe fallback
  }
}

function setWorkerPaused(paused) {
  isWorkerPaused = Boolean(paused);
  console.info(`[email-queue] Worker status changed: ${isWorkerPaused ? 'PAUSED' : 'ACTIVE'}`);
  getQueueStatsData().then((stats) => {
    emitEmailQueueEvent('worker_status', { isWorkerPaused, stats });
  }).catch(() => {});
}

function getWorkerPaused() {
  return isWorkerPaused;
}

async function recoverStuckSendingEmails() {
  try {
    const res = await QueuedEmail.updateMany(
      { status: 'sending' },
      { $set: { status: 'pending' } }
    );
    if (res.modifiedCount > 0) {
      console.info(`[email-queue] Recovered ${res.modifiedCount} stuck sending email(s) back to pending.`);
      const stats = await getQueueStatsData();
      emitEmailQueueEvent('recovered', { stats });
    }
  } catch (err) {
    console.warn('[email-queue] Failed to recover stuck sending emails:', err.message);
  }
}

async function retryAllFailedEmails() {
  const res = await QueuedEmail.updateMany(
    { status: 'failed' },
    { $set: { status: 'pending', attempts: 0, lastError: null } }
  );
  if (res.modifiedCount > 0) {
    setWorkerPaused(false);
    const stats = await getQueueStatsData();
    emitEmailQueueEvent('retried_all', { count: res.modifiedCount, stats });
  }
  return res.modifiedCount || 0;
}

/**
 * Process the next pending email in the queue.
 */
async function processNextQueuedEmail() {
  if (isWorkerPaused) {
    return;
  }

  // Check if batch limit was set and reached
  if (batchLimit > 0 && batchSentCount >= batchLimit) {
    if (!isWorkerPaused) {
      setWorkerPaused(true);
      console.info(`[email-queue] Batch limit of ${batchLimit} reached. Worker paused automatically.`);
      const stats = await getQueueStatsData();
      emitEmailQueueEvent('limit_reached', { batchLimit, batchSentCount, stats });
    }
    return;
  }

  try {
    // Find the oldest pending email, lock it by setting status to 'sending'
    const email = await QueuedEmail.findOneAndUpdate(
      { status: 'pending' },
      { $set: { status: 'sending' } },
      { sort: { createdAt: 1 }, new: true }
    );

    if (!email) {
      await recoverStuckSendingEmails();
      if (!isWorkerPaused) {
        setWorkerPaused(true);
      }
      return; // No pending emails in the queue
    }

    const recipientLog = email.to.replace(/(.{2}).*(@.*)/, '$1***$2'); // simple mask for logs
    console.info(`[email-queue] Processing queued email ID ${email._id} to ${recipientLog} (Attempt ${email.attempts + 1})`);

    // Dynamically require emailService to prevent CommonJS circular dependencies
    const { sendMail } = require('./emailService');

    try {
      await sendMail({
        to: email.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
        context: email.context
      });

      // Update state to sent
      email.status = 'sent';
      email.sentAt = new Date();
      await email.save();

      batchSentCount += 1;
      console.info(`[email-queue] Email successfully delivered to ${recipientLog} (Batch progress: ${batchSentCount}/${batchLimit || 'unlimited'})`);

      if (batchLimit > 0 && batchSentCount >= batchLimit) {
        setWorkerPaused(true);
        console.info(`[email-queue] Batch limit of ${batchLimit} reached after delivery. Worker paused.`);
      }

      const stats = await getQueueStatsData();
      emitEmailQueueEvent('sent', { emailId: email._id, to: email.to, stats, batchSentCount, batchLimit });
    } catch (sendError) {
      const errorMsg = sendError.smtpFailure?.errorMessage || sendError.message || String(sendError);
      console.warn(`[email-queue] Failed to deliver email to ${recipientLog}: ${errorMsg}`);

      email.attempts += 1;
      email.lastError = errorMsg;

      if (email.attempts >= 3) {
        email.status = 'failed';
        console.error(`[email-queue] Permanent delivery failure for email to ${recipientLog} after 3 attempts.`);
        try {
          const { notifyItStaff } = require('./notificationService');
          notifyItStaff({
            title: 'Email Delivery Failure',
            message: `Permanent delivery failure for onboarding email to ${email.to} after 3 attempts: ${errorMsg}`,
            type: 'system',
            severity: 'error',
            category: 'email',
            referenceId: email._id.toString(),
            metadata: {
              to: email.to,
              context: email.context,
              lastError: errorMsg,
              attempts: email.attempts,
              subject: email.subject
            },
            relatedRoute: '/admin/emails'
          }).catch(() => {});
        } catch (alertErr) {
          // fail safe
        }
      } else {
        email.status = 'pending'; // Re-queue for next worker run
      }

      await email.save();

      const stats = await getQueueStatsData();
      emitEmailQueueEvent('failed', {
        emailId: email._id,
        to: email.to,
        error: errorMsg,
        attempts: email.attempts,
        stats
      });
    }
  } catch (error) {
    console.error('[email-queue] Database error in queue processor:', error);
  }
}

/**
 * Queue a new email for deferred delivery.
 */
async function queueEmail({ to, subject, html, text, context = 'student-onboarding' }) {
  let email = await QueuedEmail.findOne({ to, context, status: { $in: ['pending', 'failed', 'sending'] } });

  if (email) {
    email.subject = subject;
    email.html = html;
    email.text = text;
    email.status = 'pending';
    email.attempts = 0;
    email.lastError = null;
    await email.save();
  } else {
    email = new QueuedEmail({
      to,
      subject,
      html,
      text,
      context,
      status: 'pending',
      attempts: 0
    });
    await email.save();
  }

  if (isWorkerPaused) {
    setWorkerPaused(false);
  }

  const recipientLog = to.replace(/(.{2}).*(@.*)/, '$1***$2');
  console.info(`[email-queue] Email queued for ${recipientLog} [context: ${context}]`);
  return email;
}

/**
 * Start the background worker interval.
 */
function startEmailQueueWorker() {
  if (workerIntervalId) {
    return;
  }

  recoverStuckSendingEmails().catch(() => {});

  workerIntervalId = setInterval(() => {
    processNextQueuedEmail().catch((error) => {
      console.error('[email-queue] Background loop crash:', error);
    });
  }, QUEUE_WORKER_INTERVAL_MS);

  if (typeof workerIntervalId.unref === 'function') {
    workerIntervalId.unref();
  }

  console.info(`[email-queue] Throttled worker started (interval: ${QUEUE_WORKER_INTERVAL_MS}ms).`);
}

/**
 * Stop the background worker interval.
 */
function stopEmailQueueWorker() {
  if (!workerIntervalId) {
    return;
  }

  clearInterval(workerIntervalId);
  workerIntervalId = null;
  console.info('[email-queue] Worker stopped.');
}

module.exports = {
  queueEmail,
  startEmailQueueWorker,
  stopEmailQueueWorker,
  getWorkerPaused,
  setWorkerPaused,
  setBatchLimit,
  getBatchLimit,
  getQueueStatsData,
  retryAllFailedEmails,
  recoverStuckSendingEmails
};
