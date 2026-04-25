const ExcelJS = require('exceljs');
const env = require('../config/env');
const User = require('../models/User');
const AppError = require('../utils/appError');
const { buildPaginationMeta, getPagination } = require('../utils/pagination');
const {
  PASSWORD_REGEX,
  ROUTING_DEPARTMENTS,
  SEMESTERS,
  STUDENT_PROGRAMS,
  normalizeDepartment,
  normalizeProgram
} = require('../constants/appConstants');
const { normalizePhoneNumber } = require('../utils/phone');
const { encryptTemporaryCredential, decryptTemporaryCredential } = require('../utils/temporaryCredential');
const { logAction } = require('./auditService');

const STUDENT_DUPLICATE_MESSAGE = 'Student already exists with this enrollment/email/phone.';

function buildFieldError(field, message) {
  return {
    field,
    message
  };
}

function createFieldError(message, field = 'field', statusCode = 422) {
  return new AppError(message, statusCode, [buildFieldError(field, message)]);
}

function normalizeStudentPayload(payload = {}) {
  const normalizedSemester =
    payload.semester === undefined || payload.semester === null || payload.semester === ''
      ? null
      : Number(payload.semester);

  return {
    fullName: String(payload.fullName || '').trim(),
    email: String(payload.email || '').trim().toLowerCase(),
    enrollmentNo: String(payload.enrollmentNo || payload.enrollment || '').trim(),
    phone: normalizePhoneNumber(payload.phone, {
      defaultCountryCode: env.defaultPhoneCountryCode
    }),
    program: normalizeProgram(payload.program),
    department: normalizeDepartment(payload.department) || '',
    semester: normalizedSemester,
    temporaryPassword: String(payload.temporaryPassword || '').trim()
  };
}

function sanitizeStudentRecord(user) {
  return {
    id: user._id?.toString?.() || user.id,
    fullName: user.fullName,
    email: user.email,
    enrollmentNo: user.enrollmentNo || user.enrollment || '',
    role: 'student',
    phone: user.phone,
    program: user.program || null,
    department: user.department || null,
    semester: user.semester || null,
    createdByCao: Boolean(user.createdByCao),
    mustChangePassword: Boolean(user.mustChangePassword),
    hasTemporaryCredential: Boolean(user.temporaryCredentialEncrypted),
    emailVerified: Boolean(user.emailVerified || user.isEmailVerified),
    createdAt: user.createdAt || null,
    updatedAt: user.updatedAt || null
  };
}

function buildStudentFilter(query = {}) {
  const filter = {
    role: 'student'
  };
  const searchValue = String(query.q || query.search || '').trim();
  const normalizedProgram = normalizeProgram(query.program);
  const normalizedDepartment = normalizeDepartment(query.department);
  const normalizedSemester = Number(query.semester);

  if (normalizedProgram) {
    filter.program = normalizedProgram;
  }

  if (normalizedDepartment) {
    filter.department = normalizedDepartment;
  }

  if (SEMESTERS.includes(normalizedSemester)) {
    filter.semester = normalizedSemester;
  }

  if (searchValue) {
    const regex = new RegExp(searchValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ fullName: regex }, { email: regex }, { enrollmentNo: regex }, { enrollment: regex }, { phone: regex }];
  }

  return filter;
}

async function assertStudentUniqueness(payload, ignoreUserId = '') {
  const duplicateLookup = [];

  if (payload.email) {
    duplicateLookup.push({ email: payload.email });
  }

  if (payload.phone) {
    duplicateLookup.push({ phone: payload.phone });
  }

  if (payload.enrollmentNo) {
    duplicateLookup.push({ enrollmentNo: payload.enrollmentNo }, { enrollment: payload.enrollmentNo });
  }

  if (!duplicateLookup.length) {
    return;
  }

  const conflictingUsers = await User.find({
    $or: duplicateLookup
  })
    .select('_id email phone enrollmentNo enrollment')
    .lean();
  const conflicts = [];
  const filteredUsers = conflictingUsers.filter((user) => String(user?._id || '') !== String(ignoreUserId || ''));

  if (payload.enrollmentNo && filteredUsers.some((user) => user.enrollmentNo === payload.enrollmentNo || user.enrollment === payload.enrollmentNo)) {
    conflicts.push(buildFieldError('enrollmentNo', STUDENT_DUPLICATE_MESSAGE));
  }

  if (payload.email && filteredUsers.some((user) => user.email === payload.email)) {
    conflicts.push(buildFieldError('email', STUDENT_DUPLICATE_MESSAGE));
  }

  if (payload.phone && filteredUsers.some((user) => user.phone === payload.phone)) {
    conflicts.push(buildFieldError('phone', STUDENT_DUPLICATE_MESSAGE));
  }

  if (conflicts.length) {
    throw new AppError(STUDENT_DUPLICATE_MESSAGE, 409, conflicts);
  }
}

function buildStudentCredentialsWorkbook(rows, actor = {}) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Student Credentials');

  workbook.creator = 'DwarPal';
  workbook.lastModifiedBy = actor?.fullName || 'DwarPal';
  workbook.created = new Date();
  workbook.modified = new Date();

  sheet.columns = [
    { header: 'Student Name', key: 'studentName', width: 28 },
    { header: 'Enrollment Number', key: 'enrollmentNo', width: 24 },
    { header: 'Temporary Password', key: 'temporaryPassword', width: 26 }
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1F5A80' }
  };

  rows.forEach((row) => sheet.addRow(row));

  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE0E6EC' } },
        left: { style: 'thin', color: { argb: 'FFE0E6EC' } },
        bottom: { style: 'thin', color: { argb: 'FFE0E6EC' } },
        right: { style: 'thin', color: { argb: 'FFE0E6EC' } }
      };
      cell.alignment = { vertical: 'middle', wrapText: true };
    });
  });

  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: sheet.columnCount }
  };

  return workbook;
}

async function listStudents(query = {}) {
  const filter = buildStudentFilter(query);
  const { page, limit, skip } = getPagination(query, { defaultLimit: 10, maxLimit: 100 });

  const [students, total] = await Promise.all([
    User.find(filter)
      .select('+temporaryCredentialEncrypted')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    User.countDocuments(filter)
  ]);

  return {
    students: students.map(sanitizeStudentRecord),
    meta: buildPaginationMeta(total, page, limit),
    options: {
      programs: STUDENT_PROGRAMS,
      departments: ROUTING_DEPARTMENTS,
      semesters: SEMESTERS
    }
  };
}

async function createStudent(payload, actor, requestMeta = {}) {
  const normalizedPayload = normalizeStudentPayload(payload);

  if (!normalizedPayload.fullName) {
    throw createFieldError('Full name is required.', 'fullName', 400);
  }

  if (!normalizedPayload.email) {
    throw createFieldError('Email is required.', 'email', 400);
  }

  if (!normalizedPayload.enrollmentNo) {
    throw createFieldError('Enrollment number is required.', 'enrollmentNo', 400);
  }

  if (!normalizedPayload.phone) {
    throw createFieldError('Please enter a valid phone number.', 'phone', 400);
  }

  if (!STUDENT_PROGRAMS.includes(normalizedPayload.program)) {
    throw createFieldError(`Program must be one of: ${STUDENT_PROGRAMS.join(', ')}`, 'program', 400);
  }

  if (!ROUTING_DEPARTMENTS.includes(normalizedPayload.department)) {
    throw createFieldError(`Department must be one of: ${ROUTING_DEPARTMENTS.join(', ')}`, 'department', 400);
  }

  if (!SEMESTERS.includes(normalizedPayload.semester)) {
    throw createFieldError('Semester must be between 1 and 8.', 'semester', 400);
  }

  if (!PASSWORD_REGEX.test(normalizedPayload.temporaryPassword)) {
    throw createFieldError(
      'Temporary password must be at least 8 characters and include uppercase, lowercase, number, and special character.',
      'temporaryPassword',
      400
    );
  }

  await assertStudentUniqueness(normalizedPayload);

  const student = await User.create({
    fullName: normalizedPayload.fullName,
    email: normalizedPayload.email,
    role: 'student',
    enrollmentNo: normalizedPayload.enrollmentNo,
    enrollment: normalizedPayload.enrollmentNo,
    phone: normalizedPayload.phone,
    program: normalizedPayload.program,
    department: normalizedPayload.department,
    semester: normalizedPayload.semester,
    password: normalizedPayload.temporaryPassword,
    createdByCao: true,
    mustChangePassword: true,
    temporaryCredentialEncrypted: encryptTemporaryCredential(normalizedPayload.temporaryPassword),
    temporaryCredentialCreatedAt: new Date(),
    emailVerified: false,
    isEmailVerified: false,
    emailVerifiedAt: null
  });

  await logAction({
    actorId: actor?._id || null,
    resourceType: 'user',
    resourceId: student._id,
    action: 'create_student',
    message: 'Student account created by CAO',
    metadata: {
      enrollmentNo: student.enrollmentNo,
      email: student.email
    },
    requestMeta
  });

  return sanitizeStudentRecord(student);
}

async function updateStudent(studentId, payload, actor, requestMeta = {}) {
  const student = await User.findOne({
    _id: studentId,
    role: 'student'
  }).select('+temporaryCredentialEncrypted');

  if (!student) {
    throw new AppError('Student not found.', 404);
  }

  const normalizedPayload = normalizeStudentPayload(payload);

  if (payload.enrollmentNo !== undefined || payload.enrollment !== undefined) {
    const requestedEnrollmentNo = normalizedPayload.enrollmentNo;

    if (requestedEnrollmentNo && requestedEnrollmentNo !== student.enrollmentNo) {
      throw createFieldError('Enrollment number cannot be changed after student creation.', 'enrollmentNo', 400);
    }
  }

  const uniquenessPayload = {
    email: payload.email !== undefined ? normalizedPayload.email : student.email,
    phone: payload.phone !== undefined ? normalizedPayload.phone : student.phone,
    enrollmentNo: student.enrollmentNo
  };

  await assertStudentUniqueness(uniquenessPayload, student._id);

  if (payload.fullName !== undefined) {
    student.fullName = normalizedPayload.fullName;
  }

  if (payload.email !== undefined) {
    student.email = normalizedPayload.email;
    student.emailVerified = false;
    student.isEmailVerified = false;
    student.emailVerifiedAt = null;
  }

  if (payload.phone !== undefined) {
    if (!normalizedPayload.phone) {
      throw createFieldError('Please enter a valid phone number.', 'phone', 400);
    }

    student.phone = normalizedPayload.phone;
  }

  if (payload.program !== undefined) {
    if (!STUDENT_PROGRAMS.includes(normalizedPayload.program)) {
      throw createFieldError(`Program must be one of: ${STUDENT_PROGRAMS.join(', ')}`, 'program', 400);
    }

    student.program = normalizedPayload.program;
  }

  if (payload.department !== undefined) {
    if (!ROUTING_DEPARTMENTS.includes(normalizedPayload.department)) {
      throw createFieldError(`Department must be one of: ${ROUTING_DEPARTMENTS.join(', ')}`, 'department', 400);
    }

    student.department = normalizedPayload.department;
  }

  if (payload.semester !== undefined) {
    if (!SEMESTERS.includes(normalizedPayload.semester)) {
      throw createFieldError('Semester must be between 1 and 8.', 'semester', 400);
    }

    student.semester = normalizedPayload.semester;
  }

  if (normalizedPayload.temporaryPassword) {
    if (!PASSWORD_REGEX.test(normalizedPayload.temporaryPassword)) {
      throw createFieldError(
        'Temporary password must be at least 8 characters and include uppercase, lowercase, number, and special character.',
        'temporaryPassword',
        400
      );
    }

    student.password = normalizedPayload.temporaryPassword;
    student.createdByCao = true;
    student.mustChangePassword = true;
    student.temporaryCredentialEncrypted = encryptTemporaryCredential(normalizedPayload.temporaryPassword);
    student.temporaryCredentialCreatedAt = new Date();
  }

  await student.save();

  await logAction({
    actorId: actor?._id || null,
    resourceType: 'user',
    resourceId: student._id,
    action: 'update_student',
    message: 'Student account updated by CAO',
    metadata: {
      enrollmentNo: student.enrollmentNo,
      email: student.email
    },
    requestMeta
  });

  return sanitizeStudentRecord(student);
}

async function deleteStudent(studentId, actor, requestMeta = {}) {
  const student = await User.findOne({
    _id: studentId,
    role: 'student'
  });

  if (!student) {
    throw new AppError('Student not found.', 404);
  }

  await student.deleteOne();

  await logAction({
    actorId: actor?._id || null,
    resourceType: 'user',
    resourceId: student._id,
    action: 'delete_student',
    message: 'Student account deleted by CAO',
    metadata: {
      enrollmentNo: student.enrollmentNo,
      email: student.email
    },
    requestMeta
  });

  return {
    id: student._id.toString(),
    enrollmentNo: student.enrollmentNo
  };
}

async function exportStudentCredentials(query = {}, actor = {}) {
  const filter = {
    ...buildStudentFilter(query),
    role: 'student',
    temporaryCredentialEncrypted: {
      $nin: [null, '']
    }
  };

  const students = await User.find(filter)
    .select('fullName enrollmentNo enrollment +temporaryCredentialEncrypted')
    .sort({ createdAt: -1 });
  const rows = students
    .map((student) => {
      const temporaryPassword = decryptTemporaryCredential(student.temporaryCredentialEncrypted);

      if (!temporaryPassword) {
        return null;
      }

      return {
        studentName: student.fullName,
        enrollmentNo: student.enrollmentNo || student.enrollment || '',
        temporaryPassword
      };
    })
    .filter(Boolean);

  if (!rows.length) {
    throw new AppError('No temporary student credentials are available to export right now.', 404);
  }

  const workbook = buildStudentCredentialsWorkbook(rows, actor);
  const buffer = await workbook.xlsx.writeBuffer();

  return {
    buffer: Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer),
    fileName: `dwarpal-student-credentials-${new Date().toISOString().slice(0, 10)}.xlsx`
  };
}

module.exports = {
  createStudent,
  deleteStudent,
  exportStudentCredentials,
  listStudents,
  updateStudent
};
