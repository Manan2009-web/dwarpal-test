const env = require('../config/env');
const AppError = require('../utils/appError');
const { sendSuccess } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { getRequestMeta } = require('../utils/request');
const adminService = require('../services/adminService');
const studentManagementService = require('../services/studentManagementService');

const seedDefaultAdmins = asyncHandler(async (req, res) => {
  const providedSeedKey = req.get('x-seed-key');

  if (!env.seedAdminKey || providedSeedKey !== env.seedAdminKey) {
    throw new AppError('Valid x-seed-key header is required to seed system accounts', 403);
  }

  const result = await adminService.seedDefaultAdmins({
    requestMeta: getRequestMeta(req)
  });

  return sendSuccess(res, {
    message: 'System account seeding completed',
    data: result
  });
});

const getAnalytics = asyncHandler(async (req, res) => {
  const analytics = await adminService.getAnalytics();
  return sendSuccess(res, {
    message: 'Analytics fetched successfully',
    data: analytics
  });
});

const listUsers = asyncHandler(async (req, res) => {
  const result = await adminService.listUsers(req.query);
  return sendSuccess(res, {
    message: 'Users fetched successfully',
    data: result.users,
    meta: result.meta
  });
});

const updateUserStatus = asyncHandler(async (req, res) => {
  const user = await adminService.updateUserStatus(
    req.params.id,
    req.user,
    req.body,
    getRequestMeta(req)
  );
  return sendSuccess(res, {
    message: 'User status updated successfully',
    data: user
  });
});

const createStudent = asyncHandler(async (req, res) => {
  const student = await studentManagementService.createStudent(req.body, req.user, getRequestMeta(req));

  return sendSuccess(res, {
    statusCode: 201,
    message: 'Student created successfully.',
    data: student
  });
});

const bulkCreateStudents = asyncHandler(async (req, res) => {
  const result = await studentManagementService.bulkCreateStudents(req.body, req.user, getRequestMeta(req));

  return sendSuccess(res, {
    statusCode: 200,
    message: 'Bulk student creation processed.',
    data: result
  });
});

const listStudents = asyncHandler(async (req, res) => {
  const result = await studentManagementService.listStudents(req.query);

  return sendSuccess(res, {
    message: 'Students fetched successfully.',
    data: {
      students: result.students,
      options: result.options
    },
    meta: result.meta
  });
});

const updateStudent = asyncHandler(async (req, res) => {
  const student = await studentManagementService.updateStudent(req.params.id, req.body, req.user, getRequestMeta(req));

  return sendSuccess(res, {
    message: 'Student updated successfully.',
    data: student
  });
});

const deleteStudent = asyncHandler(async (req, res) => {
  const result = await studentManagementService.deleteStudent(req.params.id, req.user, getRequestMeta(req));

  return sendSuccess(res, {
    message: 'Student deleted successfully.',
    data: result
  });
});

const exportStudentCredentials = asyncHandler(async (req, res) => {
  const result = await studentManagementService.exportStudentCredentials(req.query, req.user);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
  res.setHeader('Content-Length', result.buffer.length);
  return res.status(200).send(result.buffer);
});

const listQueueStudents = asyncHandler(async (req, res) => {
  const User = require('../models/User');
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.max(parseInt(req.query.limit, 10) || 10, 1);
  const skip = (page - 1) * limit;
  const search = String(req.query.search || '').trim();
  const statusFilter = String(req.query.status || '').trim(); // 'sent' | 'pending' | 'failed' | 'none'

  // Match stage for search
  const matchStage = { role: 'student' };
  if (search) {
    matchStage.$or = [
      { fullName: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { enrollmentNo: { $regex: search, $options: 'i' } }
    ];
  }

  // Build the aggregation pipeline
  const pipeline = [
    { $match: matchStage },
    {
      $lookup: {
        from: 'queued_emails',
        let: { studentEmail: '$email' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$to', '$$studentEmail'] },
                  { $eq: ['$context', 'student-onboarding'] }
                ]
              }
            }
          },
          { $sort: { createdAt: -1 } },
          { $limit: 1 }
        ],
        as: 'latestEmail'
      }
    },
    {
      $lookup: {
        from: 'queued_emails',
        let: { studentEmail: '$email' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$to', '$$studentEmail'] },
                  { $eq: ['$context', 'student-onboarding'] },
                  { $eq: ['$status', 'sent'] }
                ]
              }
            }
          },
          { $count: 'count' }
        ],
        as: 'sentEmailsCount'
      }
    },
    {
      $addFields: {
        emailStatus: { $ifNull: [{ $arrayElemAt: ['$latestEmail.status', 0] }, 'none'] },
        emailAttempts: { $ifNull: [{ $arrayElemAt: ['$latestEmail.attempts', 0] }, 0] },
        emailLastError: { $ifNull: [{ $arrayElemAt: ['$latestEmail.lastError', 0] }, ''] },
        emailUpdatedAt: { $ifNull: [{ $arrayElemAt: ['$latestEmail.updatedAt', 0] }, null] },
        emailSentCount: { $ifNull: [{ $arrayElemAt: ['$sentEmailsCount.count', 0] }, 0] }
      }
    }
  ];

  // Apply status filter if present
  if (statusFilter) {
    pipeline.push({
      $match: { emailStatus: statusFilter }
    });
  }

  // Get total count matching criteria
  const countPipeline = [...pipeline, { $count: 'total' }];
  const countResult = await User.aggregate(countPipeline);
  const totalCount = countResult[0]?.total || 0;
  const totalPages = Math.ceil(totalCount / limit);

  // Paginated results
  pipeline.push(
    { $sort: { fullName: 1 } },
    { $skip: skip },
    { $limit: limit },
    {
      $project: {
        _id: 1,
        fullName: 1,
        email: 1,
        enrollmentNo: 1,
        emailStatus: 1,
        emailAttempts: 1,
        emailLastError: 1,
        emailUpdatedAt: 1,
        emailSentCount: 1
      }
    }
  );

  const students = await User.aggregate(pipeline);

  return sendSuccess(res, {
    message: 'Queue students fetched successfully.',
    data: {
      students,
      page,
      totalPages,
      totalCount
    }
  });
});

const getQueueStats = asyncHandler(async (req, res) => {
  const User = require('../models/User');
  const QueuedEmail = require('../models/QueuedEmail');
  const emailQueueService = require('../services/emailQueueService');
  const emailService = require('../services/emailService');

  const totalStudents = await User.countDocuments({ role: 'student' });
  const isWorkerPaused = emailQueueService.getWorkerPaused();
  
  const diagnostics = emailService.getSmtpDiagnostics();
  const warnings = emailService.getSmtpConfigurationWarnings();

  // Aggregate stats from queued_emails
  const statusStats = await QueuedEmail.aggregate([
    { $match: { context: 'student-onboarding' } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  const statsMap = {
    sent: 0,
    pending: 0,
    failed: 0,
    sending: 0
  };

  statusStats.forEach(s => {
    if (statsMap[s._id] !== undefined) {
      statsMap[s._id] = s.count;
    }
  });

  // Calculate "never sent" count
  const distinctQueuedEmails = await QueuedEmail.distinct('to', { context: 'student-onboarding' });
  const neverSentCount = Math.max(totalStudents - distinctQueuedEmails.length, 0);

  return sendSuccess(res, {
    message: 'Email queue stats fetched successfully.',
    data: {
      totalStudents,
      sentCount: statsMap.sent,
      pendingCount: statsMap.pending + statsMap.sending,
      failedCount: statsMap.failed,
      neverSentCount,
      isWorkerPaused,
      diagnostics,
      warnings
    }
  });
});

const controlQueueWorker = asyncHandler(async (req, res) => {
  const { action } = req.body;
  const emailQueueService = require('../services/emailQueueService');

  if (action === 'pause') {
    emailQueueService.setWorkerPaused(true);
  } else if (action === 'resume') {
    emailQueueService.setWorkerPaused(false);
  } else {
    throw new AppError('Invalid control action. Use pause or resume.', 400);
  }

  return sendSuccess(res, {
    message: `Email queue worker ${action}d successfully.`,
    data: {
      isWorkerPaused: emailQueueService.getWorkerPaused()
    }
  });
});

const queueAllStudents = asyncHandler(async (req, res) => {
  const User = require('../models/User');
  const { decryptTemporaryCredential } = require('../utils/temporaryCredential');
  const { sendStudentOnboardingEmail } = require('../services/emailService');

  const limit = Math.max(parseInt(req.body.limit, 10) || 0, 0);
  const filterType = String(req.body.filterType || 'failed_only'); // 'all' | 'failed_only'

  // Get all students matching criteria
  const matchStage = { role: 'student' };

  const pipeline = [
    { $match: matchStage },
    {
      $lookup: {
        from: 'queued_emails',
        let: { studentEmail: '$email' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$to', '$$studentEmail'] },
                  { $eq: ['$context', 'student-onboarding'] }
                ]
              }
            }
          },
          { $sort: { createdAt: -1 } },
          { $limit: 1 }
        ],
        as: 'latestEmail'
      }
    },
    {
      $addFields: {
        emailStatus: { $ifNull: [{ $arrayElemAt: ['$latestEmail.status', 0] }, 'none'] }
      }
    }
  ];

  if (filterType === 'failed_only') {
    pipeline.push({
      $match: { emailStatus: { $in: ['failed', 'none'] } }
    });
  }

  pipeline.push({
    $sort: { fullName: 1 }
  });

  if (limit > 0) {
    pipeline.push({ $limit: limit });
  }

  pipeline.push({
    $project: {
      _id: 1,
      fullName: 1,
      email: 1,
      enrollmentNo: 1,
      temporaryCredentialEncrypted: 1
    }
  });

  const students = await User.aggregate(pipeline);

  let queuedCount = 0;
  for (const student of students) {
    let tempPassword = '';
    if (student.temporaryCredentialEncrypted) {
      try {
        tempPassword = decryptTemporaryCredential(student.temporaryCredentialEncrypted);
      } catch (err) {
        console.warn(`[email-queue] Failed to decrypt credentials for ${student.email}:`, err.message);
      }
    }

    await sendStudentOnboardingEmail({
      email: student.email,
      fullName: student.fullName,
      enrollmentNo: student.enrollmentNo,
      temporaryPassword: tempPassword,
      collegeName: env.collegeName
    });
    queuedCount++;
  }

  return sendSuccess(res, {
    message: `Successfully queued onboarding emails for ${queuedCount} students.`,
    data: {
      queuedCount
    }
  });
});

const queueSelectedStudents = asyncHandler(async (req, res) => {
  const User = require('../models/User');
  const { decryptTemporaryCredential } = require('../utils/temporaryCredential');
  const { sendStudentOnboardingEmail } = require('../services/emailService');
  const { studentIds } = req.body;

  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    throw new AppError('studentIds array is required.', 400);
  }

  const students = await User.find({
    _id: { $in: studentIds },
    role: 'student'
  }).select('+temporaryCredentialEncrypted');

  const sendDirectly = studentIds.length === 1;
  let queuedCount = 0;
  let sentDirectly = false;

  for (const student of students) {
    let tempPassword = '';
    if (student.temporaryCredentialEncrypted) {
      try {
        tempPassword = decryptTemporaryCredential(student.temporaryCredentialEncrypted);
      } catch (err) {
        console.warn(`[email-queue] Failed to decrypt credentials for ${student.email}:`, err.message);
      }
    }

    if (sendDirectly) {
      try {
        await sendStudentOnboardingEmail({
          email: student.email,
          fullName: student.fullName,
          enrollmentNo: student.enrollmentNo,
          temporaryPassword: tempPassword,
          collegeName: env.collegeName
        }, { sendDirectly: true });
        sentDirectly = true;
      } catch (err) {
        const detailedMsg = err.smtpFailure?.errorMessage || err.message || String(err);
        throw new AppError(`Direct email delivery failed: ${detailedMsg}`, 500);
      }
    } else {
      await sendStudentOnboardingEmail({
        email: student.email,
        fullName: student.fullName,
        enrollmentNo: student.enrollmentNo,
        temporaryPassword: tempPassword,
        collegeName: env.collegeName
      });
      queuedCount++;
    }
  }

  if (sendDirectly) {
    return sendSuccess(res, {
      message: `Successfully sent onboarding email directly.`,
      data: {
        sentDirectly: true,
        queuedCount: 0
      }
    });
  }

  return sendSuccess(res, {
    message: `Successfully queued onboarding emails for ${queuedCount} selected students.`,
    data: {
      sentDirectly: false,
      queuedCount
    }
  });
});

const retryFailedEmails = asyncHandler(async (req, res) => {
  const emailQueueService = require('../services/emailQueueService');
  const retriedCount = await emailQueueService.retryAllFailedEmails();

  return sendSuccess(res, {
    message: `Successfully re-queued ${retriedCount} failed email(s) for delivery.`,
    data: {
      retriedCount
    }
  });
});

module.exports = {
  createStudent,
  bulkCreateStudents,
  deleteStudent,
  exportStudentCredentials,
  getAnalytics,
  listStudents,
  listUsers,
  seedDefaultAdmins,
  updateStudent,
  updateUserStatus,
  listQueueStudents,
  getQueueStats,
  controlQueueWorker,
  queueAllStudents,
  queueSelectedStudents,
  retryFailedEmails
};
