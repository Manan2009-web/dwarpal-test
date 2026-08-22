const QueuedEmail = require('../models/QueuedEmail');
const env = require('../config/env');

let workerIntervalId = null;
const QUEUE_WORKER_INTERVAL_MS = 8000; // 8 seconds delay
let isWorkerPaused = false;

function setWorkerPaused(paused) {
  isWorkerPaused = Boolean(paused);
  console.info(`[email-queue] Worker status changed: ${isWorkerPaused ? 'PAUSED' : 'ACTIVE'}`);
}

function getWorkerPaused() {
  return isWorkerPaused;
}

/**
 * Process the next pending email in the queue.
 */
async function processNextQueuedEmail() {
  if (isWorkerPaused) {
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

      console.info(`[email-queue] Email successfully delivered to ${recipientLog}`);
    } catch (sendError) {
      const errorMsg = sendError.message || String(sendError);
      console.warn(`[email-queue] Failed to deliver email to ${recipientLog}: ${errorMsg}`);

      email.attempts += 1;
      email.lastError = errorMsg;

      if (email.attempts >= 3) {
        email.status = 'failed';
        console.error(`[email-queue] Permanent delivery failure for email to ${recipientLog} after 3 attempts.`);
      } else {
        email.status = 'pending'; // Re-queue for next worker run
      }

      await email.save();
    }
  } catch (error) {
    console.error('[email-queue] Database error in queue processor:', error);
  }
}

/**
 * Queue a new email for deferred delivery.
 */
async function queueEmail({ to, subject, html, text, context = 'student-onboarding' }) {
  const email = new QueuedEmail({
    to,
    subject,
    html,
    text,
    context,
    status: 'pending'
  });

  await email.save();

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
  setWorkerPaused
};
