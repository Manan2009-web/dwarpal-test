const User = require('../models/User');
const Gatepass = require('../models/Gatepass');
const env = require('../config/env');
const AppError = require('../utils/appError');
const { buildPaginationMeta, getPagination } = require('../utils/pagination');
const { DEPARTMENTS, ROLES } = require('../constants/appConstants');
const { logAction } = require('./auditService');

function getDefaultHodDepartment() {
  if (DEPARTMENTS.includes(env.defaultHodDepartment)) {
    return env.defaultHodDepartment;
  }

  return DEPARTMENTS[0];
}

function getDefaultAdminSeedData() {
  const hodDepartment = getDefaultHodDepartment();
  const defaultDepartment = DEPARTMENTS[0];

  return [
    {
      role: 'student',
      fullName: 'Student Demo',
      email: 'student1@dwarpal.local',
      enrollmentNo: 'student1',
      phone: '9999999990',
      department: defaultDepartment,
      semester: 6
    },
    {
      role: 'faculty',
      fullName: 'Faculty Demo',
      email: 'faculty1@dwarpal.local',
      employeeId: 'FACULTY1',
      phone: '9999999995',
      department: defaultDepartment
    },
    {
      role: 'principal',
      fullName: 'Principal DwarPal',
      email: 'principal@dwarpal.local',
      employeeId: 'PRINCIPAL',
      phone: '9999999991',
      department: defaultDepartment
    },
    {
      role: 'hod',
      fullName: 'HOD DwarPal',
      email: 'hod@dwarpal.local',
      employeeId: 'HOD',
      phone: '9999999992',
      department: hodDepartment
    },
    {
      role: 'cao',
      fullName: 'CAO DwarPal',
      email: 'cao@dwarpal.local',
      employeeId: 'CAO',
      phone: '9999999993',
      department: defaultDepartment
    },
    {
      role: 'security',
      fullName: 'Security Guard DwarPal',
      email: 'security@dwarpal.local',
      employeeId: 'SECURITY',
      phone: '9999999994',
      department: defaultDepartment
    }
  ];
}

async function seedDefaultAdmins({ actorId = null, requestMeta = {} } = {}) {
  const seedData = getDefaultAdminSeedData();
  const created = [];
  const updated = [];
  const existing = [];

  for (const account of seedData) {
    const lookupConditions = [{ email: account.email }];

    if (account.employeeId) {
      lookupConditions.push({ employeeId: account.employeeId.toUpperCase() });
    }

    if (account.enrollmentNo) {
      lookupConditions.push({ enrollmentNo: account.enrollmentNo });
    }

    const foundUser = await User.findOne({
      $or: lookupConditions
    }).select('+password');

    if (foundUser) {
      foundUser.fullName = account.fullName;
      foundUser.email = account.email;
      foundUser.role = account.role;
      foundUser.department = account.department;
      foundUser.phone = account.phone;
      foundUser.semester = account.semester;
      foundUser.enrollmentNo = account.enrollmentNo;
      foundUser.employeeId = account.employeeId;
      foundUser.password = env.seedAdminPassword;
      foundUser.markModified('password');
      foundUser.isActive = true;
      await foundUser.save();

      updated.push({
        role: foundUser.role,
        email: foundUser.email,
        primaryId: foundUser.enrollmentNo || foundUser.employeeId
      });

      await logAction({
        actorId,
        resourceType: 'user',
        resourceId: foundUser._id,
        action: 'refresh_demo_account',
        message: `Default ${foundUser.role} demo account refreshed`,
        requestMeta
      });

      continue;
    }

    const createdUser = await User.create({
      ...account,
      password: env.seedAdminPassword
    });

    created.push({
      role: createdUser.role,
      email: createdUser.email,
      primaryId: createdUser.enrollmentNo || createdUser.employeeId
    });

    await logAction({
      actorId,
      resourceType: 'user',
      resourceId: createdUser._id,
      action: 'seed_admin_account',
      message: `Default ${createdUser.role} demo account created`,
      requestMeta
    });
  }

  return {
    created,
    updated,
    existing
  };
}

async function getAnalytics() {
  const [totalUsers, totalGatepasses, usersByRoleRaw, gatepassesByStatusRaw, departmentDistribution] =
    await Promise.all([
      User.countDocuments(),
      Gatepass.countDocuments(),
      User.aggregate([
        {
          $group: {
            _id: '$role',
            count: { $sum: 1 }
          }
        }
      ]),
      Gatepass.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),
      User.aggregate([
        {
          $match: {
            department: { $in: DEPARTMENTS }
          }
        },
        {
          $group: {
            _id: '$department',
            count: { $sum: 1 }
          }
        }
      ])
    ]);

  const usersByRole = ROLES.reduce((accumulator, role) => {
    const match = usersByRoleRaw.find((item) => item._id === role);
    accumulator[role] = match ? match.count : 0;
    return accumulator;
  }, {});

  const gatepassesByStatus = gatepassesByStatusRaw.reduce((accumulator, item) => {
    accumulator[item._id] = item.count;
    return accumulator;
  }, {});

  const departmentSummary = departmentDistribution.reduce((accumulator, item) => {
    accumulator[item._id] = item.count;
    return accumulator;
  }, {});

  return {
    totalUsers,
    totalGatepasses,
    usersByRole,
    gatepassesByStatus,
    departmentSummary
  };
}

async function listUsers(query = {}) {
  const filter = {};
  const { page, limit, skip } = getPagination(query, { defaultLimit: 12, maxLimit: 50 });

  if (query.role) {
    filter.role = query.role;
  }

  if (query.department) {
    filter.department = query.department;
  }

  if (query.isActive === 'true') {
    filter.isActive = true;
  } else if (query.isActive === 'false') {
    filter.isActive = false;
  }

  if (query.q) {
    const regex = new RegExp(query.q.trim(), 'i');
    filter.$or = [
      { fullName: regex },
      { email: regex },
      { enrollmentNo: regex },
      { employeeId: regex }
    ];
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .select('-password -passwordResetToken -passwordResetExpiresAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    User.countDocuments(filter)
  ]);

  return {
    users,
    meta: buildPaginationMeta(total, page, limit)
  };
}

async function updateUserStatus(targetUserId, actor, payload, requestMeta) {
  const targetUser = await User.findById(targetUserId);

  if (!targetUser) {
    throw new AppError('User not found', 404);
  }

  if (targetUser._id.toString() === actor._id.toString()) {
    throw new AppError('You cannot change your own account status from this endpoint', 400);
  }

  targetUser.isActive = Boolean(payload.isActive);
  await targetUser.save();

  await logAction({
    actorId: actor._id,
    resourceType: 'user',
    resourceId: targetUser._id,
    action: 'update_user_status',
    message: `${targetUser.role} account marked as ${targetUser.isActive ? 'active' : 'inactive'}`,
    metadata: {
      isActive: targetUser.isActive
    },
    requestMeta
  });

  return targetUser;
}

module.exports = {
  getAnalytics,
  listUsers,
  seedDefaultAdmins,
  updateUserStatus
};
