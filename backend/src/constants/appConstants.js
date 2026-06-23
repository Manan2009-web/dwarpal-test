const STUDENT_PROGRAMS = Object.freeze(
  process.env.STUDENT_PROGRAMS
    ? process.env.STUDENT_PROGRAMS.split(',').map((p) => p.trim())
    : [
        'Diploma Engineering',
        'Degree Engineering',
        'Management Studies',
        'Pharmacy',
        'Computer Applications',
        'Science',
        'Commerce',
        'Arts'
      ]
);
const DEPARTMENTS = Object.freeze(
  process.env.DEPARTMENTS
    ? process.env.DEPARTMENTS.split(',').map((d) => d.trim())
    : [
        'Computer Engineering',
        'Information Technology',
        'Mechanical Engineering',
        'Civil Engineering',
        'Electrical Engineering',
        'Electronics & Communication',
        'Artificial Intelligence',
        'Data Science'
      ]
);
const ROUTING_DEPARTMENTS = DEPARTMENTS;

const ROLES = Object.freeze([
  'student',
  'faculty',
  'hod',
  'cao',
  'principal',
  'security',
  'admin'
]);

const PUBLIC_REGISTRATION_ROLES = Object.freeze(ROLES.filter((role) => role !== 'student'));
const ADMIN_ROLES = Object.freeze(['principal', 'hod', 'cao', 'security', 'admin']);
const SEMESTERS = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8]);
const FACULTY_LEAVE_TYPES = Object.freeze(['CL', 'EL', 'SL', 'LWP', 'OD', 'Others']);
const FACULTY_WORKLOAD_STATUSES = Object.freeze([
  'pending_hod',
  'approved_by_hod',
  'rejected_by_hod'
]);
const FACULTY_SHORT_LEAVE_STATUSES = Object.freeze([
  'pending_principal',
  'approved_by_principal',
  'pending_cao',
  'approved',
  'rejected_by_principal',
  'rejected_by_cao'
]);
const FACULTY_LEAVE_OVERALL_STATUSES = Object.freeze(['pending', 'approved', 'rejected']);

function normalizeRole(value) {
  const normalizedRole = String(value || '')
    .trim()
    .toLowerCase();

  return ROLES.includes(normalizedRole) ? normalizedRole : '';
}

function normalizeProgram(value) {
  const normalizedValue = String(value || '').trim();

  if (!normalizedValue) {
    return '';
  }

  const normalizedKey = normalizedValue.toLowerCase();
  const match = STUDENT_PROGRAMS.find((p) => p.toLowerCase() === normalizedKey);
  if (match) {
    return match;
  }

  if (normalizedKey.includes('diploma')) {
    const defaultDiploma = STUDENT_PROGRAMS.find((p) => p.toLowerCase().includes('diploma')) || STUDENT_PROGRAMS[0];
    return defaultDiploma;
  }

  if (normalizedKey.includes('degree')) {
    const defaultDegree = STUDENT_PROGRAMS.find((p) => p.toLowerCase().includes('degree')) || STUDENT_PROGRAMS[1] || STUDENT_PROGRAMS[0];
    return defaultDegree;
  }

  return normalizedValue;
}

function normalizeDepartment(value) {
  const normalizedValue = String(value || '').trim();

  if (!normalizedValue) {
    return '';
  }

  const normalizedKey = normalizedValue.toLowerCase();
  const match = DEPARTMENTS.find((d) => d.toLowerCase() === normalizedKey);
  if (match) {
    return match;
  }

  const aliasMap = {
    computer: 'Computer Engineering',
    'computer engineering': 'Computer Engineering',
    'computer science': 'Computer Engineering',
    'information technology': 'Information Technology',
    cse: 'Computer Engineering',
    it: 'Information Technology',
    civil: 'Civil Engineering',
    'civil engineering': 'Civil Engineering',
    mechanical: 'Mechanical Engineering',
    'mechanical engineering': 'Mechanical Engineering',
    electrical: 'Electrical Engineering',
    'electrical engineering': 'Electrical Engineering',
    nursing: 'Nursing',
    physiotherapy: 'Physiotherapy',
    'electronics & communication': 'Electronics & Communication',
    'artificial intelligence': 'Artificial Intelligence',
    'data science': 'Data Science'
  };

  const aliasMatch = aliasMap[normalizedKey];
  if (aliasMatch && DEPARTMENTS.includes(aliasMatch)) {
    return aliasMatch;
  }

  return normalizedValue;
}

const STUDENT_GATEPASS_STATUSES = Object.freeze([
  'pending_principal',
  'forwarded_to_hod',
  'forwarded_to_coordinator',
  'approved_by_hod',
  'approved_by_coordinator',
  'rejected_by_principal',
  'rejected_by_hod',
  'rejected_by_coordinator',
  'approved_final',
  'checked_out_by_security',
  'completed'
]);

const FACULTY_GATEPASS_STATUSES = Object.freeze([
  'pending_cao',
  'approved_by_cao',
  'rejected_by_cao',
  'checked_out_by_security',
  'completed'
]);

const EXTRA_GATEPASS_STATUSES = Object.freeze(['cancelled']);

const GATEPASS_STATUSES = Object.freeze([
  ...new Set([
    ...STUDENT_GATEPASS_STATUSES,
    ...FACULTY_GATEPASS_STATUSES,
    ...EXTRA_GATEPASS_STATUSES
  ])
]);

const APPROVED_GATEPASS_STATUSES = Object.freeze([
  'approved_final',
  'approved_by_hod',
  'approved_by_coordinator',
  'approved_by_cao'
]);

const PENDING_GATEPASS_STATUSES = Object.freeze([
  'pending_principal',
  'forwarded_to_hod',
  'forwarded_to_coordinator',
  'pending_cao'
]);

const SECURITY_VISIBLE_STATUSES = Object.freeze([
  ...APPROVED_GATEPASS_STATUSES,
  'checked_out_by_security',
  'completed'
]);

const ACTION_STATUSES = Object.freeze([
  'pending',
  'approved',
  'rejected',
  'forwarded',
  'not_required'
]);

const APPROVAL_LEVELS = Object.freeze([
  'principal',
  'hod',
  'coordinator',
  'cao',
  'security',
  'completed',
  'cancelled'
]);

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;
const PHONE_REGEX = /^\+?[0-9]{10,15}$/;
const VEHICLE_NUMBER_REGEX = /^[A-Z0-9 -]{4,20}$/i;
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

const NOTIFICATION_TYPES = Object.freeze([
  'gatepass_submitted',
  'gatepass_forwarded',
  'gatepass_escalated',
  'gatepass_approved',
  'gatepass_cancelled',
  'gatepass_ready_for_security',
  'gatepass_out',
  'gatepass_returned',
  'qr_generated',
  'gatepass_rejected',
  'faculty_leave_submitted',
  'faculty_leave_forwarded',
  'faculty_leave_approved',
  'faculty_leave_rejected',
  'faculty_leave_ready_for_security',
  'faculty_leave_out',
  'faculty_leave_returned',
  'faculty_leave_status',
  'hod_action',
  'coordinator_action',
  'security_verified',
  'system'
]);

module.exports = {
  ACTION_STATUSES,
  ADMIN_ROLES,
  APPROVAL_LEVELS,
  APPROVED_GATEPASS_STATUSES,
  DEPARTMENTS,
  FACULTY_LEAVE_OVERALL_STATUSES,
  FACULTY_LEAVE_TYPES,
  FACULTY_GATEPASS_STATUSES,
  FACULTY_SHORT_LEAVE_STATUSES,
  FACULTY_WORKLOAD_STATUSES,
  GATEPASS_STATUSES,
  normalizeRole,
  NOTIFICATION_TYPES,
  PASSWORD_REGEX,
  PHONE_REGEX,
  PUBLIC_REGISTRATION_ROLES,
  PENDING_GATEPASS_STATUSES,
  ROUTING_DEPARTMENTS,
  ROLES,
  SECURITY_VISIBLE_STATUSES,
  SEMESTERS,
  STUDENT_PROGRAMS,
  STUDENT_GATEPASS_STATUSES,
  TIME_REGEX,
  VEHICLE_NUMBER_REGEX,
  normalizeDepartment,
  normalizeProgram
};
