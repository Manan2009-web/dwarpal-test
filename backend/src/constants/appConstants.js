const STUDENT_PROGRAMS = Object.freeze(['Diploma', 'Degree']);
const ROUTING_DEPARTMENTS = Object.freeze(['Computer', 'Civil', 'Mechanical', 'Electrical']);
const DEPARTMENTS = Object.freeze([...ROUTING_DEPARTMENTS, 'Nursing', 'Physiotherapy']);

const ROLES = Object.freeze([
  'student',
  'faculty',
  'hod',
  'cao',
  'principal',
  'security'
]);

const PUBLIC_REGISTRATION_ROLES = Object.freeze(ROLES.filter((role) => role !== 'student'));
const ADMIN_ROLES = Object.freeze(['principal', 'hod', 'cao', 'security']);
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
  const normalizedProgram = String(value || '').trim().toLowerCase();

  if (normalizedProgram === 'diploma') {
    return 'Diploma';
  }

  if (normalizedProgram === 'degree') {
    return 'Degree';
  }

  return '';
}

function normalizeDepartment(value) {
  const normalizedValue = String(value || '').trim();

  if (!normalizedValue) {
    return '';
  }

  const normalizedKey = normalizedValue.toLowerCase();
  const aliasMap = {
    computer: 'Computer',
    'computer engineering': 'Computer',
    'computer science': 'Computer',
    'information technology': 'Computer',
    cse: 'Computer',
    it: 'Computer',
    civil: 'Civil',
    'civil engineering': 'Civil',
    mechanical: 'Mechanical',
    'mechanical engineering': 'Mechanical',
    electrical: 'Electrical',
    'electrical engineering': 'Electrical',
    nursing: 'Nursing',
    physiotherapy: 'Physiotherapy',
    administration: 'Computer',
    security: 'Computer'
  };

  return aliasMap[normalizedKey] || '';
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
