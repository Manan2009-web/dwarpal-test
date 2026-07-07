const mongoose = require('mongoose');
const {
  APPROVED_GATEPASS_STATUSES,
  PENDING_GATEPASS_STATUSES,
  normalizeDepartment,
  normalizeProgram,
  normalizeRole,
  SECURITY_VISIBLE_STATUSES,
  SEMESTERS
} = require('../constants/appConstants');

const ADMIN_PORTAL_ROLES = new Set(['principal', 'hod', 'cao', 'security', 'admin', 'it']);
const FULL_ADMIN_ROLES = new Set(['cao', 'admin', 'it']);
const DEPARTMENT_ADMIN_ROLES = new Set(['hod']);
const SECURITY_EXPORT_REPORTS = new Set([
  'all_gatepasses',
  'out_returned_status',
  'daily_report',
  'custom_date_range',
  'pending_requests',
  'approval_report'
]);
const COORDINATOR_REPORTS = new Set([
  'all_gatepasses',
  'student_report',
  'department_wise_report',
  'monthly_report',
  'daily_report',
  'custom_date_range',
  'approval_report',
  'pending_requests',
  'rejected_requests',
  'out_returned_status',
  'coordinator_scope_report',
  'individual_student_history'
]);

function toObjectId(value) {
  if (!value || !mongoose.Types.ObjectId.isValid(value)) {
    return null;
  }

  return new mongoose.Types.ObjectId(String(value));
}

function normalizeReportType(value) {
  return String(value || 'all_gatepasses')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function getUserPermissions(user) {
  return Array.isArray(user?.permissions)
    ? user.permissions
        .map((permission) =>
          String(permission || '')
            .trim()
            .toLowerCase()
        )
        .filter(Boolean)
    : [];
}

function hasPermission(user, permission) {
  const permissions = getUserPermissions(user);
  const normalizedPermission = String(permission || '').trim().toLowerCase();

  return (
    permissions.includes('admin:*') ||
    permissions.includes('export:*') ||
    permissions.includes(normalizedPermission)
  );
}

function isCoordinator(user) {
  const role = normalizeRole(user?.role);

  return (
    ['faculty', 'hod'].includes(role) &&
    Boolean(user?.isCoordinator || user?.coordinatorAssignment?.isCoordinator || user?.coordinatorScope?.isCoordinator)
  );
}

function getCoordinatorScope(user) {
  const assignment = user?.coordinatorAssignment || {};
  const scope = user?.coordinatorScope || {};
  const program = normalizeProgram(scope.program || assignment.program) || null;
  const department = normalizeDepartment(scope.department || assignment.department) || null;
  const semester = Number(scope.semester || assignment.semester) || null;
  const division = String(scope.division || '').trim();
  const academicYear = String(scope.academicYear || '').trim();
  const assignedClasses = Array.isArray(scope.assignedClasses)
    ? scope.assignedClasses
        .map((item) => ({
          program: normalizeProgram(item.program || program) || program,
          department: normalizeDepartment(item.department || department) || department,
          semester: Number(item.semester || semester) || semester,
          division: String(item.division || division || '').trim(),
          academicYear: String(item.academicYear || academicYear || '').trim()
        }))
        .filter((item) => item.department && SEMESTERS.includes(item.semester))
    : [];

  if (department && SEMESTERS.includes(semester)) {
    assignedClasses.unshift({
      program,
      department,
      semester,
      division,
      academicYear
    });
  }

  const uniqueClasses = [];
  const seen = new Set();

  assignedClasses.forEach((item) => {
    const key = [item.program, item.department, item.semester, item.division, item.academicYear].join('|');
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    uniqueClasses.push(item);
  });

  return {
    isCoordinator: isCoordinator(user),
    program,
    department,
    semester,
    division,
    academicYear,
    assignedClasses: uniqueClasses
  };
}

function canAccessAdminPortal(user) {
  const role = normalizeRole(user?.role);

  if (!role || role === 'student') {
    return false;
  }

  if (ADMIN_PORTAL_ROLES.has(role)) {
    return true;
  }

  return isCoordinator(user) || hasPermission(user, 'admin:access');
}

function canExportReport(user, reportType) {
  const role = normalizeRole(user?.role);
  const normalizedReportType = normalizeReportType(reportType);

  if (!canAccessAdminPortal(user)) {
    return false;
  }

  if (
    hasPermission(user, 'export:all') ||
    hasPermission(user, `export:${normalizedReportType}`) ||
    hasPermission(user, `report:${normalizedReportType}`)
  ) {
    return true;
  }

  if (FULL_ADMIN_ROLES.has(role) || DEPARTMENT_ADMIN_ROLES.has(role) || role === 'principal') {
    return true;
  }

  if (isCoordinator(user)) {
    return COORDINATOR_REPORTS.has(normalizedReportType);
  }

  if (role === 'security') {
    return (
      hasPermission(user, 'export:security') ||
      hasPermission(user, 'security:export') ||
      (hasPermission(user, 'export:gatepasses') && SECURITY_EXPORT_REPORTS.has(normalizedReportType))
    );
  }

  return false;
}

function impossibleFilter() {
  return {
    _id: null
  };
}

function getDepartmentScope(user) {
  return normalizeDepartment(user?.department) || user?.department || null;
}

function buildCoordinatorGatepassOr(scope) {
  const classes = scope.assignedClasses.length
    ? scope.assignedClasses
    : [
        {
          program: scope.program,
          department: scope.department,
          semester: scope.semester,
          division: scope.division,
          academicYear: scope.academicYear
        }
      ];

  return classes
    .filter((item) => item.department && SEMESTERS.includes(Number(item.semester)))
    .map((item) => {
      const classAnd = [
        {
          $or: [
            { 'routingSnapshot.department': item.department },
            { 'applicantSnapshot.department': item.department }
          ]
        },
        {
          $or: [
            { 'routingSnapshot.semester': Number(item.semester) },
            { 'applicantSnapshot.semester': Number(item.semester) }
          ]
        }
      ];

      if (item.program) {
        classAnd.push({
          $or: [
            { 'routingSnapshot.program': item.program },
            { 'applicantSnapshot.program': item.program }
          ]
        });
      }

      if (item.division) {
        classAnd.push({
          $or: [
            { 'applicantSnapshot.division': item.division },
            { 'studentSnapshot.division': item.division },
            { division: item.division }
          ]
        });
      }

      return { $and: classAnd };
    });
}

function buildGatepassScopeFilter(user) {
  const role = normalizeRole(user?.role);

  if (FULL_ADMIN_ROLES.has(role)) {
    return {};
  }

  if (role === 'principal') {
    const program = normalizeProgram(user?.program) || user?.program || null;
    if (!program) {
      return impossibleFilter();
    }
    return {
      $or: [
        { 'routingSnapshot.program': program },
        { 'applicantSnapshot.program': program }
      ]
    };
  }

  if (DEPARTMENT_ADMIN_ROLES.has(role)) {
    const department = getDepartmentScope(user);
    if (!department) {
      return impossibleFilter();
    }

    const departmentScope = [
      { 'applicantSnapshot.department': department },
      { 'routingSnapshot.department': department }
    ];

    if (user?.program) {
      const program = normalizeProgram(user.program);
      if (program) {
        return {
          $and: [
            { $or: departmentScope },
            {
              $or: [{ 'routingSnapshot.program': program }, { 'applicantSnapshot.program': program }]
            }
          ]
        };
      }
    }

    return {
      $or: departmentScope
    };
  }

  if (isCoordinator(user)) {
    const scope = getCoordinatorScope(user);
    const classFilters = buildCoordinatorGatepassOr(scope);

    if (!classFilters.length) {
      return impossibleFilter();
    }

    return {
      applicantType: 'student',
      $or: classFilters
    };
  }

  if (role === 'security') {
    return {
      status: { $in: SECURITY_VISIBLE_STATUSES }
    };
  }

  return impossibleFilter();
}

function buildFacultyLeaveScopeFilter(user) {
  const role = normalizeRole(user?.role);

  if (FULL_ADMIN_ROLES.has(role)) {
    return {};
  }

  if (role === 'principal') {
    const program = normalizeProgram(user?.program) || user?.program || null;
    if (!program) {
      return impossibleFilter();
    }
    return {};
  }

  if (DEPARTMENT_ADMIN_ROLES.has(role)) {
    const department = getDepartmentScope(user);
    return department ? { 'facultyDetails.department': department } : impossibleFilter();
  }

  if (hasPermission(user, 'export:faculty') || hasPermission(user, 'export:leave')) {
    const department = getDepartmentScope(user);
    return department ? { 'facultyDetails.department': department } : {};
  }

  return impossibleFilter();
}

function buildUserScopeFilter(user, roleFilter = null) {
  const role = normalizeRole(user?.role);
  const filter = {};

  if (roleFilter) {
    filter.role = roleFilter;
  }

  if (FULL_ADMIN_ROLES.has(role)) {
    return filter;
  }

  if (role === 'principal') {
    const program = normalizeProgram(user?.program) || user?.program || null;
    if (!program) {
      return impossibleFilter();
    }
    if (roleFilter === 'student' || roleFilter === 'hod') {
      return { ...filter, program };
    }
    return filter;
  }

  if (DEPARTMENT_ADMIN_ROLES.has(role)) {
    const department = getDepartmentScope(user);
    return department ? { ...filter, department } : impossibleFilter();
  }

  if (isCoordinator(user)) {
    const scope = getCoordinatorScope(user);
    const classes = scope.assignedClasses.length
      ? scope.assignedClasses
      : [
          {
            department: scope.department,
            semester: scope.semester
          }
        ];
    const classFilters = classes
      .filter((item) => item.department && SEMESTERS.includes(Number(item.semester)))
      .map((item) => ({
        $and: [{ department: item.department }, { semester: Number(item.semester) }]
      }));

    return {
      ...filter,
      role: roleFilter || 'student',
      ...(classFilters.length ? { $or: classFilters } : impossibleFilter())
    };
  }

  if (role === 'security') {
    return impossibleFilter();
  }

  return impossibleFilter();
}

function getAdminAccessProfile(user) {
  const role = normalizeRole(user?.role);
  const coordinatorScope = getCoordinatorScope(user);
  const scopeType = FULL_ADMIN_ROLES.has(role)
    ? 'full'
    : role === 'principal'
      ? 'program'
      : DEPARTMENT_ADMIN_ROLES.has(role)
        ? 'department'
        : role === 'cao'
          ? 'faculty'
          : coordinatorScope.isCoordinator
            ? 'coordinator'
            : role === 'security'
              ? 'security'
              : 'none';

  return {
    role,
    canAccessAdminPortal: canAccessAdminPortal(user),
    canExport: canExportReport(user, 'all_gatepasses') || hasPermission(user, 'export:all'),
    permissions: getUserPermissions(user),
    scopeType,
    department: getDepartmentScope(user),
    program: normalizeProgram(user?.program) || user?.program || null,
    coordinatorScope
  };
}

function getApprovedByUserIds(value) {
  if (!value) {
    return [];
  }

  const values = Array.isArray(value) ? value : [value];
  return values.map(toObjectId).filter(Boolean);
}

function getStatusBucketFilter(value, gatepass = true) {
  const normalizedValue = String(value || '').trim().toLowerCase();

  if (!normalizedValue || normalizedValue === 'all') {
    return {};
  }

  if (!gatepass) {
    if (normalizedValue === 'pending') {
      return { overallStatus: 'pending' };
    }

    if (normalizedValue === 'approved' || normalizedValue === 'returned') {
      return { overallStatus: 'approved' };
    }

    if (normalizedValue === 'rejected') {
      return { overallStatus: 'rejected' };
    }

    if (normalizedValue === 'out') {
      return { 'securityAction.checkedOutAt': { $ne: null }, 'securityAction.checkedInAt': null };
    }

    return {
      $or: [
        { overallStatus: normalizedValue },
        { workloadStatus: normalizedValue },
        { shortLeaveStatus: normalizedValue }
      ]
    };
  }

  if (normalizedValue === 'pending') {
    return { status: { $in: PENDING_GATEPASS_STATUSES } };
  }

  if (normalizedValue === 'approved') {
    return { status: { $in: APPROVED_GATEPASS_STATUSES } };
  }

  if (normalizedValue === 'rejected') {
    return { status: /^rejected_/ };
  }

  if (normalizedValue === 'out') {
    return { status: 'checked_out_by_security' };
  }

  if (normalizedValue === 'returned' || normalizedValue === 'completed') {
    return { status: 'completed' };
  }

  return {
    status: normalizedValue
  };
}

module.exports = {
  buildFacultyLeaveScopeFilter,
  buildGatepassScopeFilter,
  buildUserScopeFilter,
  canAccessAdminPortal,
  canExportReport,
  getAdminAccessProfile,
  getApprovedByUserIds,
  getCoordinatorScope,
  getStatusBucketFilter,
  getUserPermissions,
  hasPermission,
  impossibleFilter,
  isCoordinator,
  normalizeReportType,
  toObjectId
};
