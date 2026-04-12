const User = require('../models/User');
const Gatepass = require('../models/Gatepass');
const env = require('../config/env');
const AppError = require('../utils/appError');
const { buildPaginationMeta, getPagination } = require('../utils/pagination');
const {
  DEPARTMENTS,
  ROLES,
  SEMESTERS,
  normalizeDepartment,
  normalizeProgram
} = require('../constants/appConstants');
const { logAction } = require('./auditService');

function getDefaultHodDepartment() {
  const normalizedDepartment = normalizeDepartment(env.defaultHodDepartment);

  if (DEPARTMENTS.includes(normalizedDepartment)) {
    return normalizedDepartment;
  }

  return DEPARTMENTS[0];
}

function getDefaultHodProgram() {
  return normalizeProgram(env.defaultHodProgram) || 'Degree';
}

function getDefaultCoordinatorSemester() {
  const normalizedSemester = Number(env.defaultCoordinatorSemester) || 6;

  if (SEMESTERS.includes(normalizedSemester)) {
    return normalizedSemester;
  }

  return 6;
}

function getSystemAccountSeedData() {
  const hodDepartment = getDefaultHodDepartment();
  const hodProgram = getDefaultHodProgram();
  const coordinatorSemester = getDefaultCoordinatorSemester();
  const defaultDepartment = DEPARTMENTS[0];

  return [
    {
      role: 'principal',
      fullName: 'Principal DwarPal',
      email: 'principal@dwarpal.local',
      employeeId: 'PRINCIPAL',
      phone: '9999999991',
      department: defaultDepartment,
      gatepassApprovalEnabled: true
    },
    {
      role: 'hod',
      fullName: 'HOD DwarPal',
      email: 'hod@dwarpal.local',
      employeeId: 'HOD',
      phone: '9999999992',
      program: hodProgram,
      department: hodDepartment,
      gatepassApprovalEnabled: true
    },
    {
      role: 'faculty',
      fullName: 'Coordinator DwarPal',
      email: 'coordinator@dwarpal.local',
      employeeId: 'COORDINATOR',
      phone: '9999999995',
      department: hodDepartment,
      coordinatorAssignment: {
        isCoordinator: true,
        program: hodProgram,
        department: hodDepartment,
        semester: coordinatorSemester
      }
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

function buildAccountLookupConditions(account) {
  const lookupConditions = [{ email: account.email }];

  if (account.employeeId) {
    lookupConditions.push({ employeeId: account.employeeId.toUpperCase() });
  }

  if (account.enrollmentNo) {
    lookupConditions.push({ enrollmentNo: account.enrollmentNo });
  }

  return lookupConditions;
}

function assignIfMissing(document, field, value) {
  if (value === undefined) {
    return false;
  }

  const currentValue = document[field];
  const hasCurrentValue =
    currentValue !== undefined &&
    currentValue !== null &&
    !(typeof currentValue === 'string' && !currentValue.trim());

  if (hasCurrentValue) {
    return false;
  }

  document[field] = value;
  return true;
}

function applySafeSystemAccountDefaults(user, account) {
  let changed = false;

  if ((user.role || '') !== account.role) {
    user.role = account.role;
    changed = true;
  }

  changed = assignIfMissing(user, 'fullName', account.fullName) || changed;
  changed = assignIfMissing(user, 'email', account.email) || changed;
  changed = assignIfMissing(user, 'phone', account.phone) || changed;
  changed = assignIfMissing(user, 'department', account.department) || changed;

  if (['student', 'hod'].includes(account.role)) {
    changed = assignIfMissing(user, 'program', account.program) || changed;
  }

  if (account.role === 'student') {
    changed = assignIfMissing(user, 'semester', account.semester) || changed;
    changed = assignIfMissing(user, 'enrollmentNo', account.enrollmentNo) || changed;
  } else {
    changed = assignIfMissing(user, 'employeeId', account.employeeId) || changed;
  }

  if (['principal', 'hod'].includes(account.role) && typeof account.gatepassApprovalEnabled === 'boolean') {
    if (typeof user.gatepassApprovalEnabled !== 'boolean') {
      user.gatepassApprovalEnabled = account.gatepassApprovalEnabled;
      changed = true;
    }
  }

  if (account.coordinatorAssignment?.isCoordinator) {
    const existingAssignment = user.coordinatorAssignment || {};
    const nextAssignment = {
      isCoordinator: true,
      program: existingAssignment.program || account.coordinatorAssignment.program || null,
      department: existingAssignment.department || account.coordinatorAssignment.department || null,
      semester: existingAssignment.semester || account.coordinatorAssignment.semester || null
    };

    const assignmentChanged =
      existingAssignment.isCoordinator !== nextAssignment.isCoordinator ||
      existingAssignment.program !== nextAssignment.program ||
      existingAssignment.department !== nextAssignment.department ||
      Number(existingAssignment.semester || 0) !== Number(nextAssignment.semester || 0);

    if (assignmentChanged) {
      user.coordinatorAssignment = nextAssignment;
      changed = true;
    }
  }

  return changed;
}

async function seedDefaultAdmins({
  actorId = null,
  onlyWhenDatabaseEmpty = false,
  requestMeta = {}
} = {}) {
  const seedData = getSystemAccountSeedData();
  const created = [];
  const updated = [];
  const existing = [];
  const skipped = [];

  if (onlyWhenDatabaseEmpty) {
    const existingUserCount = await User.countDocuments();

    if (existingUserCount > 0) {
      return {
        created,
        updated,
        existing,
        skipped: [
          {
            reason: 'database_not_empty',
            userCount: existingUserCount
          }
        ]
      };
    }
  }

  for (const account of seedData) {
    const foundUser = await User.findOne({
      $or: buildAccountLookupConditions(account)
    }).select('+password');

    if (foundUser) {
      const changed = applySafeSystemAccountDefaults(foundUser, account);

      if (changed) {
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
          action: 'repair_system_account',
          message: `System ${foundUser.role} account repaired with missing defaults`,
          requestMeta
        });
      } else {
        existing.push({
          role: foundUser.role,
          email: foundUser.email,
          primaryId: foundUser.enrollmentNo || foundUser.employeeId
        });
      }

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
        message: `System ${createdUser.role} account created`,
        requestMeta
      });
  }

  return {
    created,
    updated,
    existing,
    skipped
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
      .select('-password')
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
