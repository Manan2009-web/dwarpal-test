const AppError = require('./appError');
const { normalizeDepartment, normalizeProgram, normalizeRole } = require('../constants/appConstants');
const { normalizeReportType, toObjectId } = require('./adminScope');

const REPORT_TYPES = Object.freeze([
  'all_gatepasses',
  'student_report',
  'faculty_report',
  'department_wise_report',
  'monthly_report',
  'daily_report',
  'custom_date_range',
  'approval_report',
  'pending_requests',
  'rejected_requests',
  'out_returned_status',
  'leave_report',
  'load_adjustment_report',
  'coordinator_scope_report',
  'individual_student_history',
  'individual_faculty_history'
]);

const EXCEL_MODES = Object.freeze(['summary', 'individual', 'per_student']);
const RECORD_PARTITIONS = Object.freeze(['students', 'faculty', 'mixed']);
const DETAIL_LEVELS = Object.freeze(['summary_only', 'detailed_only', 'summary_detailed']);
const EXPORT_SCOPES = Object.freeze(['filtered', 'selected', 'bulk']);

function trim(value) {
  return String(value || '').trim();
}

function normalizeScalar(value) {
  if (Array.isArray(value)) {
    return normalizeScalar(value[0]);
  }

  return trim(value);
}

function normalizeBoolean(value) {
  if (typeof value === 'boolean') {
    return value;
  }

  const normalizedValue = normalizeScalar(value).toLowerCase();
  return ['true', '1', 'yes', 'on'].includes(normalizedValue);
}

function normalizeDateInput(value) {
  const text = normalizeScalar(value);

  if (!text) {
    return null;
  }

  const date = new Date(text);

  if (Number.isNaN(date.getTime())) {
    throw new AppError(`Invalid date filter: ${text}`, 400);
  }

  return date;
}

function normalizeObjectIdList(value) {
  if (!value) {
    return [];
  }

  const values = Array.isArray(value) ? value : String(value).split(',');
  const unique = new Map();

  values.forEach((item) => {
    const objectId = toObjectId(item);
    if (!objectId) {
      return;
    }

    unique.set(objectId.toString(), objectId);
  });

  return Array.from(unique.values());
}

function startOfDay(date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfDay(date) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

function startOfWeek(date) {
  const value = startOfDay(date);
  const day = value.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  value.setDate(value.getDate() + diff);
  return value;
}

function endOfWeek(date) {
  const value = startOfWeek(date);
  value.setDate(value.getDate() + 6);
  return endOfDay(value);
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function parseMonth(value) {
  const normalizedValue = normalizeScalar(value);

  if (!normalizedValue) {
    return null;
  }

  const match = normalizedValue.match(/^(\d{4})-(\d{1,2})$/);

  if (!match) {
    return normalizeDateInput(normalizedValue);
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;

  if (monthIndex < 0 || monthIndex > 11) {
    throw new AppError(`Invalid month filter: ${normalizedValue}`, 400);
  }

  return new Date(year, monthIndex, 1);
}

function resolveDateRange(rawFilters = {}) {
  const now = new Date();
  const preset = normalizeScalar(rawFilters.datePreset || rawFilters.preset || rawFilters.period).toLowerCase();
  const specificDay = normalizeDateInput(rawFilters.specificDay || rawFilters.day || rawFilters.date);
  const monthDate = parseMonth(rawFilters.month);
  let from = normalizeDateInput(rawFilters.from || rawFilters.dateFrom || rawFilters.startDate);
  let to = normalizeDateInput(rawFilters.to || rawFilters.dateTo || rawFilters.endDate);

  if (specificDay) {
    from = startOfDay(specificDay);
    to = endOfDay(specificDay);
  } else if (preset === 'today' || preset === 'daily') {
    from = startOfDay(now);
    to = endOfDay(now);
  } else if (preset === 'this_week' || preset === 'week' || preset === 'weekly') {
    from = startOfWeek(from || now);
    to = endOfWeek(from);
  } else if (preset === 'this_month' || preset === 'month' || preset === 'monthly') {
    from = startOfMonth(monthDate || now);
    to = endOfMonth(monthDate || now);
  } else if (preset === 'last_month') {
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    from = startOfMonth(lastMonth);
    to = endOfMonth(lastMonth);
  } else {
    from = from ? startOfDay(from) : null;
    to = to ? endOfDay(to) : null;
  }

  if (from && to && from.getTime() > to.getTime()) {
    throw new AppError('Date range is invalid. The start date must be before the end date.', 400);
  }

  return {
    from,
    to
  };
}

function resolveCreatedDateRange(rawFilters = {}) {
  const from = normalizeDateInput(rawFilters.createdFrom || rawFilters.createdDateFrom || rawFilters.createdStartDate);
  const to = normalizeDateInput(rawFilters.createdTo || rawFilters.createdDateTo || rawFilters.createdEndDate);

  if (!from && !to) {
    return {
      createdFrom: null,
      createdTo: null
    };
  }

  const createdFrom = from ? startOfDay(from) : null;
  const createdTo = to ? endOfDay(to) : null;

  if (createdFrom && createdTo && createdFrom.getTime() > createdTo.getTime()) {
    throw new AppError('Created date range is invalid. The start date must be before the end date.', 400);
  }

  return {
    createdFrom,
    createdTo
  };
}

function normalizeExportMode(value) {
  const mode = normalizeScalar(value || 'summary')
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  return EXCEL_MODES.includes(mode) ? mode : 'summary';
}

function normalizeRecordPartition(value) {
  const partition = normalizeScalar(value || 'mixed')
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  if (partition === 'students') return 'students';
  if (partition === 'faculty') return 'faculty';
  return 'mixed';
}

function normalizeDetailLevel(value) {
  const detailLevel = normalizeScalar(value || 'summary_detailed')
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  return DETAIL_LEVELS.includes(detailLevel) ? detailLevel : 'summary_detailed';
}

function normalizeExportScope(value) {
  const exportScope = normalizeScalar(value || 'filtered')
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  return EXPORT_SCOPES.includes(exportScope) ? exportScope : 'filtered';
}

function serializeValue(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeValue(item));
  }

  if (value && typeof value === 'object' && value.toString && value._bsontype === 'ObjectId') {
    return value.toString();
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((result, [key, item]) => {
      result[key] = serializeValue(item);
      return result;
    }, {});
  }

  return value;
}

function sanitizeFiltersForStorage(input = {}) {
  return Object.entries(input || {}).reduce((sanitized, [key, value]) => {
    if (value === undefined || typeof value === 'function') {
      return sanitized;
    }

    sanitized[key] = serializeValue(value);
    return sanitized;
  }, {});
}

function parseReportFilters(input = {}) {
  const reportType = normalizeReportType(input.reportType);
  const { from, to } = resolveDateRange(input);
  const { createdFrom, createdTo } = resolveCreatedDateRange(input);
  const department = normalizeDepartment(input.department) || normalizeScalar(input.department);
  const program = normalizeProgram(input.program) || normalizeScalar(input.program);
  const semester = Number(input.semester || input.classSemester) || null;
  const division = normalizeScalar(input.division || input.class || input.classDivision);
  const academicYear = normalizeScalar(input.academicYear);
  const studentId = toObjectId(input.studentId || input.student || input.personId);
  const facultyId = toObjectId(input.facultyId || input.faculty || input.personId);
  const approvedBy = normalizeScalar(input.approvedBy);
  const approvedById = toObjectId(input.approvedById || input.approvedBy);
  const selectedStudentIds = normalizeObjectIdList(input.selectedStudentIds || input.studentIds);
  const selectedFacultyIds = normalizeObjectIdList(input.selectedFacultyIds || input.facultyIds);

  if (!REPORT_TYPES.includes(reportType)) {
    throw new AppError(`Unsupported report type: ${reportType}`, 400);
  }

  return {
    reportType,
    exportMode: normalizeExportMode(input.exportMode || input.mode),
    exportScope: normalizeExportScope(input.exportScope),
    recordPartition: normalizeRecordPartition(input.recordPartition || input.partition || input.userType),
    detailLevel: normalizeDetailLevel(input.detailLevel),
    datePreset: normalizeScalar(input.datePreset || input.preset || input.period || 'custom'),
    from,
    to,
    createdFrom,
    createdTo,
    department,
    program,
    semester,
    division,
    academicYear,
    studentId,
    facultyId,
    selectedStudentIds,
    selectedFacultyIds,
    personSearch: normalizeScalar(input.personSearch || input.q),
    name: normalizeScalar(input.name),
    enrollmentNo: normalizeScalar(input.enrollmentNo || input.enrollment || input.enrollmentNumber),
    employeeId: normalizeScalar(input.employeeId || input.employee || input.employeeNumber),
    roleType: normalizeRole(input.roleType || input.role) || normalizeScalar(input.roleType || input.role),
    status: normalizeScalar(input.status),
    approvedBy,
    approvedById,
    gatepassType: normalizeScalar(input.gatepassType || input.applicantType),
    leaveType: normalizeScalar(input.leaveType),
    loadAdjustmentType: normalizeScalar(input.loadAdjustmentType),
    vehicleMode: normalizeScalar(input.vehicleMode || input.vehicle),
    includeSeparateStudentSheets: normalizeBoolean(input.includeSeparateStudentSheets),
    coordinatorOnly: normalizeBoolean(input.coordinatorOnly),
    notes: normalizeScalar(input.notes),
    raw: sanitizeFiltersForStorage(input)
  };
}

function dateMatch(field, filters) {
  if (!filters.from && !filters.to) {
    return {};
  }

  const range = {};

  if (filters.from) {
    range.$gte = filters.from;
  }

  if (filters.to) {
    range.$lte = filters.to;
  }

  return {
    [field]: range
  };
}

function createdDateMatch(field, filters) {
  if (!filters.createdFrom && !filters.createdTo) {
    return {};
  }

  const range = {};

  if (filters.createdFrom) {
    range.$gte = filters.createdFrom;
  }

  if (filters.createdTo) {
    range.$lte = filters.createdTo;
  }

  return {
    [field]: range
  };
}

function publicFilterSummary(filters) {
  return {
    reportType: filters.reportType,
    exportMode: filters.exportMode,
    exportScope: filters.exportScope,
    recordPartition: filters.recordPartition,
    detailLevel: filters.detailLevel,
    datePreset: filters.datePreset,
    from: filters.from ? filters.from.toISOString() : null,
    to: filters.to ? filters.to.toISOString() : null,
    createdFrom: filters.createdFrom ? filters.createdFrom.toISOString() : null,
    createdTo: filters.createdTo ? filters.createdTo.toISOString() : null,
    department: filters.department || null,
    program: filters.program || null,
    semester: filters.semester || null,
    division: filters.division || null,
    academicYear: filters.academicYear || null,
    studentId: filters.studentId ? filters.studentId.toString() : null,
    facultyId: filters.facultyId ? filters.facultyId.toString() : null,
    selectedStudentIds: filters.selectedStudentIds.map((item) => item.toString()),
    selectedFacultyIds: filters.selectedFacultyIds.map((item) => item.toString()),
    name: filters.name || null,
    enrollmentNo: filters.enrollmentNo || null,
    employeeId: filters.employeeId || null,
    roleType: filters.roleType || null,
    status: filters.status || null,
    approvedBy: filters.approvedBy || null,
    gatepassType: filters.gatepassType || null,
    leaveType: filters.leaveType || null,
    loadAdjustmentType: filters.loadAdjustmentType || null,
    vehicleMode: filters.vehicleMode || null,
    includeSeparateStudentSheets: filters.includeSeparateStudentSheets,
    coordinatorOnly: filters.coordinatorOnly
  };
}

function safeFilenamePart(value, fallback = 'report') {
  const normalized = String(value || fallback)
    .trim()
    .replace(/[^a-z0-9-_]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);

  return normalized || fallback;
}

function buildExportFileName({ reportType, format, filters, generatedAt = new Date() }) {
  const datePart = generatedAt.toISOString().slice(0, 10);
  const partitionPart =
    filters?.recordPartition && filters.recordPartition !== 'mixed'
      ? `-${safeFilenamePart(filters.recordPartition)}`
      : '';
  const scopePart =
    filters?.exportScope && filters.exportScope !== 'filtered'
      ? `-${safeFilenamePart(filters.exportScope)}`
      : '';
  const departmentPart = filters?.department ? `-${safeFilenamePart(filters.department)}` : '';
  return `dwarpal-${safeFilenamePart(reportType)}${partitionPart}${scopePart}${departmentPart}-${datePart}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
}

module.exports = {
  REPORT_TYPES,
  buildExportFileName,
  createdDateMatch,
  dateMatch,
  parseReportFilters,
  publicFilterSummary,
  safeFilenamePart
};
