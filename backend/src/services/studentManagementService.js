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
const { sendStudentOnboardingEmail } = require('./emailService');
const { normalizeProgramField, normalizeDepartmentField } = require('../utils/fieldNormalizer');

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

let localSerialCache = {};

function getGtuBranchCode(department) {
  const dept = String(department || '').trim().toLowerCase();
  if (dept.includes('computer')) return '07';
  if (dept.includes('information') || dept.includes('it')) return '16';
  if (dept.includes('mechanical')) return '19';
  if (dept.includes('civil')) return '06';
  if (dept.includes('electrical')) return '09';
  if (dept.includes('electronics') || dept.includes('ec')) return '11';
  if (dept.includes('artificial') || dept.includes('ai') || dept.includes('data science')) return '31';
  return '07'; // Default
}

async function getNextSerialForPrefix(prefix) {
  if (localSerialCache[prefix] === undefined) {
    const regex = new RegExp(`^${prefix}\\d{3}$`);
    const matchingUsers = await User.find({ enrollmentNo: regex }).select('enrollmentNo').lean();
    let maxSerial = 0;
    for (const user of matchingUsers) {
      const serialStr = String(user.enrollmentNo || '').slice(-3);
      const serialNum = parseInt(serialStr, 10);
      if (!isNaN(serialNum) && serialNum > maxSerial) {
        maxSerial = serialNum;
      }
    }
    localSerialCache[prefix] = maxSerial;
  }
  localSerialCache[prefix] += 1;
  return String(localSerialCache[prefix]).padStart(3, '0');
}

async function generateTemporaryEnrollmentNo(program, department, semester) {
  const currentYear = new Date().getFullYear();
  const yy = String(currentYear).slice(-2);

  let ccc = '117';
  const progLower = String(program || '').toLowerCase();
  if (progLower.includes('diploma')) {
    ccc = '959';
  }

  const sem = Number(semester);
  let ss = '01';
  if (progLower.includes('degree')) {
    ss = sem === 3 ? '31' : '01';
  } else if (progLower.includes('diploma')) {
    ss = '03';
  } else if (progLower.includes('pharmacy')) {
    ss = '02';
  } else if (progLower.includes('management') || progLower.includes('mba')) {
    ss = '05';
  } else if (progLower.includes('computer applications') || progLower.includes('mca')) {
    ss = '06';
  }

  const bb = getGtuBranchCode(department);
  const prefix = `${yy}${ccc}${ss}${bb}`;

  const nnn = await getNextSerialForPrefix(prefix);
  return `${prefix}${nnn}`;
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

  let enrollmentNo = normalizedPayload.enrollmentNo;
  let isTemporaryEnrollment = false;

  const isSem1 = Number(normalizedPayload.semester) === 1;
  const progLower = String(normalizedPayload.program || '').toLowerCase();
  const isSem3DToD = Number(normalizedPayload.semester) === 3 && (progLower.includes('degree') || progLower.includes('d to d') || progLower.includes('dtd') || progLower.includes('d2d'));
  const isEligibleForTemp = isSem1 || isSem3DToD;

  if (!enrollmentNo) {
    if (!isEligibleForTemp) {
      throw createFieldError('Enrollment number is required.', 'enrollmentNo', 400);
    }
    isTemporaryEnrollment = true;
    localSerialCache = {}; // Reset for single generation
    enrollmentNo = await generateTemporaryEnrollmentNo(
      normalizedPayload.program,
      normalizedPayload.department,
      normalizedPayload.semester
    );
    normalizedPayload.enrollmentNo = enrollmentNo;
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

  if (!normalizedPayload.temporaryPassword || normalizedPayload.temporaryPassword.length < 8) {
    throw createFieldError(
      'Temporary password must be at least 8 characters long.',
      'temporaryPassword',
      400
    );
  }

  await assertStudentUniqueness(normalizedPayload);

  const student = await User.create({
    fullName: normalizedPayload.fullName,
    email: normalizedPayload.email,
    role: 'student',
    enrollmentNo: enrollmentNo,
    enrollment: enrollmentNo,
    isTemporaryEnrollment: isTemporaryEnrollment,
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

  // Send onboarding email — fire-and-forget (email failure must never block student creation)
  sendStudentOnboardingEmail({
    email: normalizedPayload.email,
    fullName: normalizedPayload.fullName,
    enrollmentNo: normalizedPayload.enrollmentNo,
    temporaryPassword: normalizedPayload.temporaryPassword,
    collegeName: require('../config/env').collegeName
  }).catch((err) => {
    console.warn('[student-onboarding] Failed to send onboarding email:', err.message || err, {
      enrollmentNo: normalizedPayload.enrollmentNo,
      to: normalizedPayload.email
    });
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
    if (normalizedPayload.temporaryPassword.length < 8) {
      throw createFieldError(
        'Temporary password must be at least 8 characters long.',
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

function generateRandomPassword() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  password += 'A';
  password += 'a';
  password += '1';
  password += '!';
  for (let i = 0; i < 6; i++) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }
  return password;
}

async function bulkCreateStudents(rows, actor, requestMeta = {}) {
  if (!Array.isArray(rows)) {
    throw new AppError('Invalid payload: expected an array of students.', 400);
  }

  localSerialCache = {};
  const added = [];
  const rejected = [];
  const candidates = [];

  const fileEmails = new Set();
  const filePhones = new Set();
  const fileEnrollments = new Set();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const index = i + 1;
    const reasons = [];
    const fieldErrors = {
      fullName: null,
      email: null,
      enrollmentNumber: null,
      phoneNumber: null,
      program: null,
      department: null,
      semester: null
    };

    const rawFullName = String(row.fullName || row.name || '').trim();
    const rawEmail = String(row.email || '').trim();
    const rawEnrollmentNo = String(row.enrollmentNo || row.enrollment || '').trim();
    const rawPhone = String(row.phone || '').trim();
    const rawProgram = String(row.program || '').trim();
    const rawDepartment = String(row.department || '').trim();
    const rawSemester = row.semester;

    const originalData = {
      fullName: rawFullName,
      email: rawEmail,
      enrollmentNo: rawEnrollmentNo,
      phone: rawPhone,
      program: rawProgram,
      department: rawDepartment,
      semester: rawSemester
    };

    // 1. Merge detection
    const checkMerge = (val) => String(val || '').includes(',');
    if (checkMerge(rawFullName)) {
      fieldErrors.fullName = "Multiple students detected in one row — split into separate rows";
      reasons.push("Full Name: Multiple students detected in one row — split into separate rows");
    }
    if (checkMerge(rawEmail)) {
      fieldErrors.email = "Multiple students detected in one row — split into separate rows";
      reasons.push("Email: Multiple students detected in one row — split into separate rows");
    }
    if (checkMerge(rawEnrollmentNo)) {
      fieldErrors.enrollmentNumber = "Multiple students detected in one row — split into separate rows";
      reasons.push("Enrollment Number: Multiple students detected in one row — split into separate rows");
    }
    if (checkMerge(rawPhone)) {
      fieldErrors.phoneNumber = "Multiple students detected in one row — split into separate rows";
      reasons.push("Phone Number: Multiple students detected in one row — split into separate rows");
    }

    // 2. Full Name
    if (!rawFullName) {
      fieldErrors.fullName = "Missing — required field";
      reasons.push("Full Name: missing");
    }

    // 3. Email
    let emailLower = '';
    if (!rawEmail) {
      fieldErrors.email = "Missing — required field";
      reasons.push("Email: missing");
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(rawEmail)) {
        fieldErrors.email = "Malformed email address";
        reasons.push("Email: malformed");
      } else {
        emailLower = rawEmail.toLowerCase();
      }
    }

    // 4. Enrollment Number (Validation will be deferred until after semester/program are resolved)
    let enrollmentLower = '';
    let finalEnrollmentNo = rawEnrollmentNo;
    let isTemporaryEnrollment = false;

    // 5. Phone
    let cleanPhone = '';
    if (!rawPhone) {
      fieldErrors.phoneNumber = "Missing — required field";
      reasons.push("Phone Number: missing");
    } else {
      cleanPhone = rawPhone.replace(/[^0-9]/g, '');
      if (cleanPhone.length !== 10) {
        fieldErrors.phoneNumber = "Phone number must be exactly 10 digits";
        reasons.push("Phone Number: must be exactly 10 digits");
      }
    }

    // 6. Program
    let resolvedProgramCanonical = '';
    if (!rawProgram) {
      fieldErrors.program = "Missing — required field";
      reasons.push("Program: missing");
    } else {
      try {
        const resolved = normalizeProgramField(rawProgram);
        resolvedProgramCanonical = resolved.canonical;
      } catch (err) {
        fieldErrors.program = `Value '${rawProgram}' could not be matched to a known program`;
        reasons.push(`Program: ${err.message}`);
      }
    }

    // 7. Department
    let resolvedDeptCanonical = '';
    if (!rawDepartment) {
      fieldErrors.department = "Missing — required field";
      reasons.push("Department: missing");
    } else {
      try {
        const resolved = normalizeDepartmentField(rawDepartment);
        resolvedDeptCanonical = resolved.canonical;
      } catch (err) {
        fieldErrors.department = `Value '${rawDepartment}' could not be matched to a known department`;
        reasons.push(`Department: ${err.message}`);
      }
    }

    // 8. Semester
    let normalizedSemester = null;
    if (rawSemester === undefined || rawSemester === null || rawSemester === '') {
      fieldErrors.semester = "Missing — required field";
      reasons.push("Semester: missing");
    } else {
      normalizedSemester = Number(rawSemester);
      if (isNaN(normalizedSemester) || normalizedSemester < 1 || normalizedSemester > 8) {
        fieldErrors.semester = "Semester must be between 1 and 8";
        reasons.push("Semester: must be between 1 and 8");
      }
    }

    // Defer check: validate enrollment number now that we have Semester, Program, and Department
    const hasBasicErrors = fieldErrors.program || fieldErrors.department || fieldErrors.semester;

    if (!hasBasicErrors) {
      if (!rawEnrollmentNo) {
        const isSem1 = normalizedSemester === 1;
        const progCleanLower = String(resolvedProgramCanonical || '').toLowerCase();
        const isSem3DToD = normalizedSemester === 3 && (progCleanLower.includes('degree') || progCleanLower.includes('d to d') || progCleanLower.includes('dtd') || progCleanLower.includes('d2d'));
        const isEligibleForTemp = isSem1 || isSem3DToD;

        if (isEligibleForTemp) {
          isTemporaryEnrollment = true;
          finalEnrollmentNo = await generateTemporaryEnrollmentNo(
            resolvedProgramCanonical,
            resolvedDeptCanonical,
            normalizedSemester
          );
          enrollmentLower = finalEnrollmentNo.toLowerCase();
        } else {
          fieldErrors.enrollmentNumber = "Missing — required field";
          reasons.push("Enrollment Number: missing");
        }
      } else {
        const enrollRegex = /^[a-z0-9-]{3,20}$/i;
        if (!enrollRegex.test(rawEnrollmentNo)) {
          fieldErrors.enrollmentNumber = "Enrollment number does not match expected format";
          reasons.push("Enrollment Number: does not match expected format");
        } else {
          enrollmentLower = rawEnrollmentNo.toLowerCase();
        }
      }
    } else {
      if (!rawEnrollmentNo) {
        fieldErrors.enrollmentNumber = "Missing — required field";
        reasons.push("Enrollment Number: missing");
      }
    }

    // 9. Sheet duplicate checks
    if (emailLower) {
      if (fileEmails.has(emailLower)) {
        fieldErrors.email = `Duplicate email "${rawEmail}" in the uploaded file`;
        reasons.push(`Email: duplicate email "${rawEmail}" in the uploaded file`);
      } else if (!reasons.some(r => r.startsWith("Email:"))) {
        fileEmails.add(emailLower);
      }
    }
    if (cleanPhone && cleanPhone.length === 10) {
      if (filePhones.has(cleanPhone)) {
        fieldErrors.phoneNumber = `Duplicate phone number "${rawPhone}" in the uploaded file`;
        reasons.push(`Phone Number: duplicate phone number "${rawPhone}" in the uploaded file`);
      } else {
        filePhones.add(cleanPhone);
      }
    }
    if (enrollmentLower) {
      if (fileEnrollments.has(enrollmentLower)) {
        fieldErrors.enrollmentNumber = `Duplicate enrollment number "${finalEnrollmentNo}" in the uploaded file`;
        reasons.push(`Enrollment Number: duplicate enrollment number "${finalEnrollmentNo}" in the uploaded file`);
      } else if (!reasons.some(r => r.startsWith("Enrollment Number:"))) {
        fileEnrollments.add(enrollmentLower);
      }
    }

    if (reasons.length > 0) {
      rejected.push({
        rowNumber: index,
        originalData,
        reasons,
        fieldErrors
      });
    } else {
      const tempPass = String(row.temporaryPassword || '').trim() || generateRandomPassword();
      candidates.push({
        index,
        originalRow: originalData,
        data: {
          fullName: rawFullName,
          email: emailLower,
          enrollmentNo: finalEnrollmentNo,
          isTemporaryEnrollment,
          phone: cleanPhone,
          program: resolvedProgramCanonical,
          department: resolvedDeptCanonical,
          semester: normalizedSemester,
          temporaryPassword: tempPass
        }
      });
    }
  }

  if (candidates.length > 0) {
    const candidateEmails = candidates.map(c => c.data.email);
    const candidatePhones = candidates.map(c => c.data.phone);
    const candidateEnrollments = candidates.map(c => c.data.enrollmentNo);

    const existingUsers = await User.find({
      $or: [
        { email: { $in: candidateEmails } },
        { phone: { $in: candidatePhones } },
        { enrollmentNo: { $in: candidateEnrollments } },
        { enrollment: { $in: candidateEnrollments } }
      ]
    }).select('email phone enrollmentNo enrollment').lean();

    const dbEmails = new Set(existingUsers.map(u => String(u.email || '').toLowerCase()));
    const dbPhones = new Set(existingUsers.map(u => String(u.phone || '')));
    const dbEnrollments = new Set(existingUsers.flatMap(u => [String(u.enrollmentNo || '').toLowerCase(), String(u.enrollment || '').toLowerCase()]).filter(Boolean));

    const validToInsert = [];

    for (const candidate of candidates) {
      const { index, originalRow, data } = candidate;
      const emailLower = data.email.toLowerCase();
      const enrollmentLower = data.enrollmentNo.toLowerCase();
      const dbReasons = [];

      if (dbEmails.has(emailLower)) {
        dbReasons.push(`Email: a user with email "${data.email}" already exists in the database`);
      }
      if (dbPhones.has(data.phone)) {
        dbReasons.push(`Phone Number: a user with phone number "${data.phone}" already exists in the database`);
      }
      if (dbEnrollments.has(enrollmentLower)) {
        dbReasons.push(`Enrollment Number: a user with enrollment number "${data.enrollmentNo}" already exists in the database`);
      }

      if (dbReasons.length > 0) {
        const dbErrors = {
          fullName: null,
          email: null,
          enrollmentNumber: null,
          phoneNumber: null,
          program: null,
          department: null,
          semester: null
        };
        if (dbEmails.has(emailLower)) {
          dbErrors.email = `Email "${data.email}" already exists in the database`;
        }
        if (dbPhones.has(data.phone)) {
          dbErrors.phoneNumber = `Phone number "${data.phone}" already exists in the database`;
        }
        if (dbEnrollments.has(enrollmentLower)) {
          dbErrors.enrollmentNumber = `Enrollment number "${data.enrollmentNo}" already exists in the database`;
        }

        rejected.push({
          rowNumber: index,
          originalData: originalRow,
          reasons: dbReasons,
          fieldErrors: dbErrors
        });
      } else {
        validToInsert.push(data);
      }
    }

    const batchSize = 25;
    for (let i = 0; i < validToInsert.length; i += batchSize) {
      const batch = validToInsert.slice(i, i + batchSize);

      const docs = batch.map(s => ({
        fullName: s.fullName,
        email: s.email,
        role: 'student',
        enrollmentNo: s.enrollmentNo,
        enrollment: s.enrollmentNo,
        isTemporaryEnrollment: s.isTemporaryEnrollment,
        phone: s.phone,
        program: s.program,
        department: s.department,
        semester: s.semester,
        password: s.temporaryPassword,
        createdByCao: true,
        mustChangePassword: true,
        temporaryCredentialEncrypted: encryptTemporaryCredential(s.temporaryPassword),
        temporaryCredentialCreatedAt: new Date(),
        emailVerified: false,
        isEmailVerified: false,
        emailVerifiedAt: null
      }));

      const createdDocs = await User.create(docs);

      for (let k = 0; k < createdDocs.length; k++) {
        const student = createdDocs[k];
        const origPayload = batch[k];

        added.push({
          id: student._id.toString(),
          fullName: student.fullName,
          enrollmentNo: student.enrollmentNo,
          email: student.email
        });

        sendStudentOnboardingEmail({
          email: student.email,
          fullName: student.fullName,
          enrollmentNo: student.enrollmentNo,
          temporaryPassword: origPayload.temporaryPassword,
          collegeName: env.collegeName
        }).catch((err) => {
          console.warn('[student-onboarding] Failed to send bulk onboarding email:', err.message || err);
        });
      }
    }
  }

  // Audit Log once for the entire batch
  const crypto = require('crypto');
  const batchId = `batch-${crypto.randomUUID()}`;
  await logAction({
    actorId: actor?._id || null,
    resourceType: 'user',
    resourceId: actor?._id || null,
    action: 'bulk_create_students',
    message: `Bulk student creation batch processed: ${added.length} created, ${rejected.length} rejected`,
    metadata: {
      batchId,
      addedCount: added.length,
      rejectedCount: rejected.length,
      totalRows: rows.length
    },
    requestMeta
  });

  if (rejected.length > 0 || added.length > 0) {
    try {
      const { notifyItStaff } = require('./notificationService');
      notifyItStaff({
        title: rejected.length > 0
          ? `Bulk Upload: ${rejected.length} Row(s) Rejected`
          : `Bulk Upload: ${added.length} Students Registered`,
        message: `Processed ${rows.length} rows: ${added.length} added, ${rejected.length} rejected with validation errors.`,
        type: 'system',
        severity: rejected.length > 0 ? (added.length === 0 ? 'critical' : 'warning') : 'info',
        category: 'upload',
        referenceId: batchId,
        metadata: {
          batchId,
          totalRows: rows.length,
          addedCount: added.length,
          rejectedCount: rejected.length,
          actor: actor?.fullName || actor?.email,
          rejectedPreview: rejected.slice(0, 5)
        },
        relatedRoute: '/admin/students'
      }).catch(() => {});
    } catch (notifyErr) {
      // safe fallback
    }
  }

  return {
    added,
    rejected,
    summary: {
      totalRows: rows.length,
      addedCount: added.length,
      rejectedCount: rejected.length
    }
  };
}

module.exports = {
  createStudent,
  deleteStudent,
  exportStudentCredentials,
  listStudents,
  updateStudent,
  bulkCreateStudents
};
