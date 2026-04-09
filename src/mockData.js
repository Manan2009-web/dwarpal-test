export const ROLE_META = {
  student: {
    title: 'Student',
    shortTitle: 'Student',
    panelTitle: 'Student Dashboard',
    accent: 'var(--accent-student)',
    idLabel: 'Enrollment Number',
  },
  faculty: {
    title: 'Faculty',
    shortTitle: 'Faculty',
    panelTitle: 'Faculty Dashboard',
    accent: 'var(--accent-faculty)',
    idLabel: 'Employee ID',
  },
  principal: {
    title: 'Principal',
    shortTitle: 'Principal',
    panelTitle: 'Principal Dashboard',
    accent: 'var(--accent-principal)',
    idLabel: 'Employee ID',
  },
  hod: {
    title: 'HOD',
    shortTitle: 'HOD',
    panelTitle: 'HOD Dashboard',
    accent: 'var(--accent-hod)',
    idLabel: 'Employee ID',
  },
  cao: {
    title: 'CAO',
    shortTitle: 'CAO',
    panelTitle: 'CAO Dashboard',
    accent: 'var(--accent-cao)',
    idLabel: 'Employee ID',
  },
  security: {
    title: 'Security',
    shortTitle: 'Security',
    panelTitle: 'Security Dashboard',
    accent: 'var(--accent-security)',
    idLabel: 'Employee ID',
  },
}

export const STATUS_COLORS = {
  Pending: 'pending',
  Submitted: 'pending',
  Forwarded: 'out',
  Approved: 'approved',
  Rejected: 'rejected',
  Info: 'out',
  Out: 'out',
  Returned: 'returned',
  Cancelled: 'rejected',
}

export const ROLE_OPTIONS = ['student', 'faculty', 'hod', 'cao', 'principal', 'security']

export const PUBLIC_ROLE_OPTIONS = [...ROLE_OPTIONS]

export const SEMESTER_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8]

export const DEPARTMENTS = [
  'Computer Engineering',
  'Mechanical Engineering',
  'Civil Engineering',
  'Nursing',
  'Physiotherapy',
  'Electrical Engineering',
]

export function normalizeRole(role) {
  const normalizedRole = String(role || '')
    .trim()
    .toLowerCase()

  return ROLE_OPTIONS.includes(normalizedRole) ? normalizedRole : ''
}

const LEGACY_DEPARTMENT_MAP = {
  'Computer Science': 'Computer Engineering',
  'Information Technology': 'Computer Engineering',
  Administration: 'Computer Engineering',
  Security: 'Computer Engineering',
}

export function normalizeDepartment(department) {
  const mappedDepartment = LEGACY_DEPARTMENT_MAP[department] ?? department
  return DEPARTMENTS.includes(mappedDepartment) ? mappedDepartment : DEPARTMENTS[0]
}

export function normalizeSemester(semester) {
  const parsedSemester = Number(semester)
  return SEMESTER_OPTIONS.includes(parsedSemester) ? parsedSemester : SEMESTER_OPTIONS[0]
}

export function formatSemesterLabel(semester) {
  const parsedSemester = Number(semester)
  return SEMESTER_OPTIONS.includes(parsedSemester) ? `Semester ${parsedSemester}` : ''
}

export function normalizeVehicleNumber(vehicleNumber) {
  return String(vehicleNumber || '').replace(/\s+/g, ' ').trim()
}

export function normalizeUserRecord(user) {
  const normalizedRole = normalizeRole(user.role)
  const normalizedUser = {
    ...user,
    role: normalizedRole || user.role,
    department: normalizeDepartment(user.department),
  }

  if (normalizedUser.role === 'student') {
    return {
      ...normalizedUser,
      semester: normalizeSemester(normalizedUser.semester),
    }
  }

  const { semester, ...nonStudentUser } = normalizedUser
  return nonStudentUser
}

export function normalizeGatepassRecord(gatepass) {
  return {
    ...gatepass,
    department: normalizeDepartment(gatepass.department),
    vehicleNumber: normalizeVehicleNumber(gatepass.vehicleNumber),
  }
}

export const initialUsers = [
  {
    id: 'student-demo',
    name: 'Student Demo',
    email: 'student1@dwarpal.edu',
    department: 'Computer Engineering',
    enrollment: 'student1',
    phone: '9999999999',
    role: 'student',
    semester: 6,
    password: '12345',
  },
  {
    id: 'faculty-demo',
    name: 'Faculty Demo',
    email: 'faculty1@dwarpal.edu',
    department: 'Computer Engineering',
    employeeId: 'faculty1',
    phone: '8888888888',
    role: 'faculty',
    password: '12345',
  },
  {
    id: 'principal-demo',
    name: 'Principal Demo',
    email: 'principal@dwarpal.edu',
    department: 'Computer Engineering',
    employeeId: 'principal',
    phone: '8877777777',
    role: 'principal',
    password: '12345',
  },
  {
    id: 'hod-demo',
    name: 'HOD Demo',
    email: 'hod@dwarpal.edu',
    department: 'Computer Engineering',
    employeeId: 'hod',
    phone: '8866666666',
    role: 'hod',
    password: '12345',
  },
  {
    id: 'cao-demo',
    name: 'CAO Demo',
    email: 'cao@dwarpal.edu',
    department: 'Computer Engineering',
    employeeId: 'cao',
    phone: '8855555555',
    role: 'cao',
    password: '12345',
  },
  {
    id: 'security-demo',
    name: 'Security Demo',
    email: 'security@dwarpal.edu',
    department: 'Computer Engineering',
    employeeId: 'security',
    phone: '8844444444',
    role: 'security',
    password: '12345',
  },
  {
    id: 'stu-001',
    name: 'Aarav Sharma',
    email: 'aarav@dwarpal.edu',
    department: 'Computer Engineering',
    enrollment: '23CS1021',
    phone: '9876543210',
    role: 'student',
    semester: 6,
    password: 'demo123',
  },
  {
    id: 'stu-002',
    name: 'Meera Kulkarni',
    email: 'meera@dwarpal.edu',
    department: 'Mechanical Engineering',
    enrollment: '23ME1014',
    phone: '9811122233',
    role: 'student',
    semester: 4,
    password: 'demo123',
  },
  {
    id: 'fac-001',
    name: 'Dr. Nisha Iyer',
    email: 'nisha.iyer@dwarpal.edu',
    department: 'Computer Engineering',
    employeeId: 'FAC-204',
    phone: '9898989898',
    role: 'faculty',
    password: 'demo123',
  },
  {
    id: 'pri-001',
    name: 'Prof. R. S. Menon',
    email: 'principal@dwarpal.edu',
    department: 'Computer Engineering',
    employeeId: 'PRI-001',
    phone: '9822012345',
    role: 'principal',
    password: 'demo123',
  },
  {
    id: 'hod-001',
    name: 'Dr. Kavita Deshmukh',
    email: 'hod.cse@dwarpal.edu',
    department: 'Computer Engineering',
    employeeId: 'HOD-113',
    phone: '9822034567',
    role: 'hod',
    password: 'demo123',
  },
  {
    id: 'cao-001',
    name: 'S. R. Patil',
    email: 'cao@dwarpal.edu',
    department: 'Computer Engineering',
    employeeId: 'CAO-019',
    phone: '9867001122',
    role: 'cao',
    password: 'demo123',
  },
  {
    id: 'sec-001',
    name: 'Gate Office',
    email: 'security@dwarpal.edu',
    department: 'Computer Engineering',
    employeeId: 'SEC-007',
    phone: '9890007766',
    role: 'security',
    password: 'demo123',
  },
]

export const initialGatepasses = [
  {
    id: 'GP-3019',
    requesterId: 'stu-001',
    requesterType: 'student',
    name: 'Aarav Sharma',
    enrollment: '23CS1021',
    department: 'Computer Engineering',
    reason: 'Medical appointment outside campus',
    vehicleNumber: 'GJ-01-AB-1234',
    outTime: '2026-03-19T15:30',
    expectedReturnTime: '2026-03-19T18:00',
    status: 'Pending',
    stage: 'principal',
    submittedAt: '2026-03-19T10:15',
    timeline: [
      { label: 'Submitted', note: 'Awaiting Principal review', at: '2026-03-19T10:15', tone: 'done' },
      { label: 'Principal Review', note: 'Pending approval', at: null, tone: 'current' },
      { label: 'Security Exit', note: 'Will unlock after approval', at: null, tone: 'upcoming' },
    ],
  },
  {
    id: 'GP-3018',
    requesterId: 'stu-002',
    requesterType: 'student',
    name: 'Meera Kulkarni',
    enrollment: '23ME1014',
    department: 'Mechanical Engineering',
    reason: 'Family function and travel',
    vehicleNumber: '',
    outTime: '2026-03-18T11:00',
    expectedReturnTime: '2026-03-18T18:30',
    status: 'Approved',
    stage: 'security',
    submittedAt: '2026-03-18T08:50',
    timeline: [
      { label: 'Submitted', note: 'Request created', at: '2026-03-18T08:50', tone: 'done' },
      { label: 'Principal Approved', note: 'Ready at main gate', at: '2026-03-18T09:20', tone: 'done' },
      { label: 'Security Exit', note: 'Ready for OUT scan', at: null, tone: 'current' },
    ],
  },
  {
    id: 'GP-3016',
    requesterId: 'stu-001',
    requesterType: 'student',
    name: 'Aarav Sharma',
    enrollment: '23CS1021',
    department: 'Computer Engineering',
    reason: 'Department competition preparation',
    vehicleNumber: 'GJ 01 CS 1021',
    outTime: '2026-03-17T13:00',
    expectedReturnTime: '2026-03-17T16:00',
    status: 'Rejected',
    stage: 'closed',
    submittedAt: '2026-03-17T09:40',
    timeline: [
      { label: 'Submitted', note: 'Request created', at: '2026-03-17T09:40', tone: 'done' },
      { label: 'Principal Review', note: 'Rejected by Principal', at: '2026-03-17T10:05', tone: 'danger' },
      { label: 'Closed', note: 'No further action', at: '2026-03-17T10:05', tone: 'done' },
    ],
  },
  {
    id: 'GP-3012',
    requesterId: 'stu-002',
    requesterType: 'student',
    name: 'Meera Kulkarni',
    enrollment: '23ME1014',
    department: 'Mechanical Engineering',
    reason: 'Hospital check-up',
    vehicleNumber: '',
    outTime: '2026-03-16T09:30',
    expectedReturnTime: '2026-03-16T13:00',
    status: 'Returned',
    stage: 'closed',
    submittedAt: '2026-03-16T07:45',
    timeline: [
      { label: 'Submitted', note: 'Request created', at: '2026-03-16T07:45', tone: 'done' },
      { label: 'Principal Approved', note: 'Cleared for gate exit', at: '2026-03-16T08:10', tone: 'done' },
      { label: 'Marked OUT', note: 'Exited campus', at: '2026-03-16T09:28', tone: 'done' },
      { label: 'Marked IN', note: 'Returned to campus', at: '2026-03-16T12:36', tone: 'done' },
    ],
  },
  {
    id: 'GP-3017',
    requesterId: 'fac-001',
    requesterType: 'faculty',
    name: 'Dr. Nisha Iyer',
    enrollment: 'FAC-204',
    department: 'Computer Engineering',
    reason: 'Industry visit with final-year students',
    vehicleNumber: 'MH-12-CD-4567',
    outTime: '2026-03-19T14:00',
    expectedReturnTime: '2026-03-19T19:30',
    status: 'Pending',
    stage: 'cao',
    submittedAt: '2026-03-19T09:00',
    timeline: [
      { label: 'Submitted', note: 'Awaiting CAO review', at: '2026-03-19T09:00', tone: 'done' },
      { label: 'CAO Review', note: 'Pending approval', at: null, tone: 'current' },
      { label: 'Security Exit', note: 'Will unlock after approval', at: null, tone: 'upcoming' },
    ],
  },
  {
    id: 'GP-3015',
    requesterId: 'stu-001',
    requesterType: 'student',
    name: 'Aarav Sharma',
    enrollment: '23CS1021',
    department: 'Computer Engineering',
    reason: 'Competition equipment pickup',
    vehicleNumber: '',
    outTime: '2026-03-18T16:00',
    expectedReturnTime: '2026-03-18T19:00',
    status: 'Pending',
    stage: 'hod',
    submittedAt: '2026-03-18T12:20',
    timeline: [
      { label: 'Submitted', note: 'Request created', at: '2026-03-18T12:20', tone: 'done' },
      { label: 'Forwarded by Principal', note: 'Sent to HOD for final decision', at: '2026-03-18T12:55', tone: 'done' },
      { label: 'HOD Review', note: 'Pending approval', at: null, tone: 'current' },
    ],
  },
  {
    id: 'GP-3014',
    requesterId: 'fac-001',
    requesterType: 'faculty',
    name: 'Dr. Nisha Iyer',
    enrollment: 'FAC-204',
    department: 'Computer Engineering',
    reason: 'Conference keynote session',
    vehicleNumber: 'MH 12 EF 2045',
    outTime: '2026-03-18T07:30',
    expectedReturnTime: '2026-03-18T17:00',
    status: 'Out',
    stage: 'security',
    submittedAt: '2026-03-17T18:00',
    timeline: [
      { label: 'Submitted', note: 'Request created', at: '2026-03-17T18:00', tone: 'done' },
      { label: 'CAO Approved', note: 'Approved for travel', at: '2026-03-17T18:35', tone: 'done' },
      { label: 'Marked OUT', note: 'Exited campus gate', at: '2026-03-18T07:22', tone: 'done' },
      { label: 'Marked IN', note: 'Pending return', at: null, tone: 'current' },
    ],
  },
]
