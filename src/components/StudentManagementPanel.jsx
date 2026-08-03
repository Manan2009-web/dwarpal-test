import { useEffect, useMemo, useState, useRef } from 'react'
import { Eye, FileDown, Download, GraduationCap, KeyRound, PencilLine, ShieldCheck, Trash2, UserPlus, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, RefreshCw, X, AlertOctagon } from 'lucide-react'
import * as XLSX from 'xlsx'
import {
  createAdminStudent,
  bulkCreateAdminStudents,
  deleteAdminStudent,
  downloadAdminStudentCredentials,
  fetchAdminStudents,
  getApiErrorMessage,
  updateAdminStudent,
} from '../lib/dwarpalApi'
import { DEPARTMENTS, PROGRAM_OPTIONS, ROUTING_DEPARTMENTS, SEMESTER_OPTIONS } from '../mockData'
import { useToast } from './ToastProvider'
import { ActionButton, EmptyState, ModalForm, SelectField } from './ui'

const STUDENT_PAGE_SIZE = 10

function createEmptyForm(options = {}) {
  const programOptions = Array.isArray(options.programs) && options.programs.length ? options.programs : PROGRAM_OPTIONS
  const departmentOptions =
    Array.isArray(options.departments) && options.departments.length ? options.departments : ROUTING_DEPARTMENTS
  const semesterOptions = Array.isArray(options.semesters) && options.semesters.length ? options.semesters : SEMESTER_OPTIONS

  return {
    fullName: '',
    email: '',
    enrollmentNo: '',
    phone: '',
    program: programOptions[0] || 'Diploma',
    department: departmentOptions[0] || DEPARTMENTS[0] || '',
    semester: String(semesterOptions[0] || 1),
    temporaryPassword: '',
  }
}

function downloadBlob({ blob, fileName }) {
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName || 'download'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.URL.revokeObjectURL(url)
}

function StudentFormFields({
  form,
  fieldErrors,
  onChange,
  isEditMode,
  programOptions = PROGRAM_OPTIONS,
  departmentOptions = ROUTING_DEPARTMENTS,
  semesterOptions = SEMESTER_OPTIONS,
}) {
  return (
    <div className="student-form-grid">
      <label className="admin-field">
        <span>Full Name</span>
        <input
          value={form.fullName}
          onChange={(event) => onChange('fullName', event.target.value)}
          className={fieldErrors.fullName ? 'field-invalid' : ''}
          placeholder="Enter student full name"
        />
        {fieldErrors.fullName ? <p className="field-error">{fieldErrors.fullName}</p> : null}
      </label>

      <label className="admin-field">
        <span>Email</span>
        <input
          type="email"
          value={form.email}
          onChange={(event) => onChange('email', event.target.value)}
          className={fieldErrors.email ? 'field-invalid' : ''}
          placeholder="Enter registered email"
        />
        {fieldErrors.email ? <p className="field-error">{fieldErrors.email}</p> : null}
      </label>

      <label className="admin-field">
        <span>Enrollment Number</span>
        <input
          value={form.enrollmentNo}
          onChange={(event) => onChange('enrollmentNo', event.target.value)}
          className={fieldErrors.enrollmentNo ? 'field-invalid' : ''}
          placeholder="Enter enrollment number"
          readOnly={isEditMode}
        />
        {isEditMode ? <p className="field-hint">Enrollment number stays locked after student creation.</p> : null}
        {fieldErrors.enrollmentNo ? <p className="field-error">{fieldErrors.enrollmentNo}</p> : null}
      </label>

      <label className="admin-field">
        <span>Phone Number</span>
        <input
          value={form.phone}
          onChange={(event) => onChange('phone', event.target.value)}
          className={fieldErrors.phone ? 'field-invalid' : ''}
          placeholder="Enter phone number"
        />
        {fieldErrors.phone ? <p className="field-error">{fieldErrors.phone}</p> : null}
      </label>

      <label className="admin-field">
        <span>Program</span>
        <SelectField value={form.program} onChange={(event) => onChange('program', event.target.value)}>
          {programOptions.map((program) => (
            <option key={program} value={program}>
              {program}
            </option>
          ))}
        </SelectField>
        {fieldErrors.program ? <p className="field-error">{fieldErrors.program}</p> : null}
      </label>

      <label className="admin-field">
        <span>Department</span>
        <SelectField value={form.department} onChange={(event) => onChange('department', event.target.value)}>
          {departmentOptions.map((department) => (
            <option key={department} value={department}>
              {department}
            </option>
          ))}
        </SelectField>
        {fieldErrors.department ? <p className="field-error">{fieldErrors.department}</p> : null}
      </label>

      <label className="admin-field">
        <span>Semester</span>
        <SelectField value={form.semester} onChange={(event) => onChange('semester', event.target.value)}>
          {semesterOptions.map((semester) => (
            <option key={semester} value={semester}>
              Semester {semester}
            </option>
          ))}
        </SelectField>
        {fieldErrors.semester ? <p className="field-error">{fieldErrors.semester}</p> : null}
      </label>

      <label className="admin-field">
        <span>{isEditMode ? 'Temporary Password Reset' : 'Temporary Password'}</span>
        <input
          type="password"
          value={form.temporaryPassword}
          onChange={(event) => onChange('temporaryPassword', event.target.value)}
          className={fieldErrors.temporaryPassword ? 'field-invalid' : ''}
          placeholder={isEditMode ? 'Leave blank to keep current password' : 'Enter temporary password'}
        />
        {fieldErrors.temporaryPassword ? <p className="field-error">{fieldErrors.temporaryPassword}</p> : null}
      </label>
    </div>
  )
}

export default function StudentManagementPanel({ currentUser, activeSection = 'students' }) {
  const toast = useToast()
  const [students, setStudents] = useState([])
  const [meta, setMeta] = useState({})
  const [options, setOptions] = useState({
    programs: PROGRAM_OPTIONS,
    departments: ROUTING_DEPARTMENTS,
    semesters: SEMESTER_OPTIONS,
  })
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [program, setProgram] = useState('')
  const [department, setDepartment] = useState('')
  const [semester, setSemester] = useState('')
  const [page, setPage] = useState(1)
  const [reloadKey, setReloadKey] = useState(0)
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(() => createEmptyForm())
  const [fieldErrors, setFieldErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [editingStudent, setEditingStudent] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [exporting, setExporting] = useState(false)

  // Bulk upload states
  const [activeTab, setActiveTab] = useState('single') // 'single' | 'bulk'
  const [bulkStudents, setBulkStudents] = useState([])
  const [bulkFile, setBulkFile] = useState(null)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkResult, setBulkResult] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef(null)

  function generateRandomPassword() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    const uppers = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowers = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const specials = '!@#$%^&*';
    
    password += uppers[Math.floor(Math.random() * uppers.length)];
    password += lowers[Math.floor(Math.random() * lowers.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += specials[Math.floor(Math.random() * specials.length)];
    
    for (let i = 4; i < 10; i++) {
      password += chars[Math.floor(Math.random() * chars.length)];
    }
    
    return password.split('').sort(() => 0.5 - Math.random()).join('');
  }

  function downloadExcelTemplate() {
    try {
      const workbook = XLSX.utils.book_new();
      const headers = [
        {
          'Full Name': 'John Doe',
          'Email': 'johndoe@example.com',
          'Enrollment Number': 'EN12345678',
          'Phone Number': '9876543210',
          'Program': 'Diploma',
          'Department': 'Computer Engineering',
          'Semester': '6'
        }
      ];
      const sheet = XLSX.utils.json_to_sheet(headers);
      XLSX.utils.book_append_sheet(workbook, sheet, 'Student Template');
      XLSX.writeFile(workbook, 'dwarpal_student_template.xlsx');
      toast.success({
        title: 'Template Downloaded',
        message: 'Fill this sheet and upload it.'
      });
    } catch (err) {
      toast.error({
        title: 'Template Download Failed',
        message: err.message || 'Unable to generate template.'
      });
    }
  }

  function downloadRejectedRows() {
    if (!bulkResult || !bulkResult.rejected || !bulkResult.rejected.length) return;
    try {
      const workbook = XLSX.utils.book_new();
      const rowsToDownload = bulkResult.rejected.map(r => {
        const d = r.originalData || {};
        return {
          'Full Name': d.fullName || '',
          'Email': d.email || '',
          'Enrollment Number': d.enrollmentNo || '',
          'Phone Number': d.phone || '',
          'Program': d.program || '',
          'Department': d.department || '',
          'Semester': d.semester || '',
          'Issue': r.reasons ? r.reasons.join('; ') : ''
        };
      });
      const sheet = XLSX.utils.json_to_sheet(rowsToDownload);
      XLSX.utils.book_append_sheet(workbook, sheet, 'Rejected Students');
      const timestamp = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `Bulk_Upload_Errors_${timestamp}.xlsx`);
      toast.success({
        title: 'Export complete',
        message: 'Downloaded error report Excel sheet.'
      });
    } catch (err) {
      toast.error({
        title: 'Export failed',
        message: err.message || 'Unable to generate error report.'
      });
    }
  }

  // Clean string helper
  function cleanString(val) {
    return String(val || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9&]/g, '')
      .replace(/\s+/g, '');
  }

  // Maps of exact aliases to canonical values
  const PROGRAM_ALIASES = {
    'Diploma Engineering': ['diploma', 'dip', 'diplomaengg', 'diplomaeng', 'di'],
    'Degree Engineering': ['degree', 'btech', 'be', 'degreeengineering', 'degreeengg', 'degreeeng', 'b.tech', 'b.e', 'b tech', 'b e'],
    'Management Studies': ['mba', 'bba', 'management', 'managementstudies', 'businessadministration', 'bms', 'pgdm'],
    'Pharmacy': ['bpharm', 'bpharmacy', 'mpharm', 'mpharmacy', 'pharmacy', 'pharma', 'b.pharm', 'dpharm'],
    'Computer Applications': ['ca', 'mca', 'bca', 'computerapplications', 'computerapplication'],
    'Science': ['science', 'bsc', 'msc', 'b.sc', 'm.sc'],
    'Commerce': ['commerce', 'bcom', 'mcom', 'b.com', 'm.com'],
    'Arts': ['arts', 'ba', 'ma', 'b.a', 'm.a']
  };

  const DEPT_ALIASES = {
    'Computer Engineering': ['comp', 'computer', 'cs', 'cse', 'computerengg', 'computereng', 'computerengineering', 'computerscience', 'compeng', 'compengg', 'compsci'],
    'Information Technology': ['it', 'informationtechnology', 'infotech', 'informationtech'],
    'Mechanical Engineering': ['mech', 'mechanical', 'mechengg', 'mecheng', 'mechanicalengg', 'mechanicalengineering'],
    'Civil Engineering': ['civil', 'civilengg', 'civileng', 'civilengineering'],
    'Electrical Engineering': ['elec', 'electrical', 'ee', 'electricalengg', 'electricaleng', 'electricalengineering'],
    'Electronics & Communication': ['ec', 'electronics', 'electronicsandcommunication', 'electronicscommunication', 'ece', 'electronicscommunicationengineering', 'electronicscommunicationengg', 'electronics&communication', 'electronics&communicationengg'],
    'Artificial Intelligence': ['ai', 'artificialintelligence', 'artificialintelligenceengineering', 'aiengg', 'aieng'],
    'Data Science': ['ds', 'datascience', 'datascienceengineering']
  };

  // Levenshtein distance
  function getLevenshteinDistance(a, b) {
    const tmp = [];
    let i, j;
    for (i = 0; i <= a.length; i++) {
      tmp[i] = [i];
    }
    for (j = 0; j <= b.length; j++) {
      tmp[0][j] = j;
    }
    for (i = 1; i <= a.length; i++) {
      for (j = 1; j <= b.length; j++) {
        tmp[i][j] = Math.min(
          tmp[i - 1][j] + 1,
          tmp[i][j - 1] + 1,
          tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
        );
      }
    }
    return tmp[a.length][b.length];
  }

  function getSimilarity(a, b) {
    const maxLength = Math.max(a.length, b.length);
    if (maxLength === 0) return 1.0;
    return 1.0 - getLevenshteinDistance(a, b) / maxLength;
  }

  function resolveValue(rawValue, canonicalList, aliasMap) {
    const input = String(rawValue || '').trim();
    if (!input) return { canonical: '', original: '', isAutoCorrected: false, error: 'Value is required' };

    const cleanedInput = cleanString(input);

    // 1. Check exact match in canonical list
    for (const canonical of canonicalList) {
      if (cleanString(canonical) === cleanedInput) {
        return { canonical, original: input, isAutoCorrected: false };
      }
    }

    // 2. Check exact matches in aliases
    for (const canonical of canonicalList) {
      const aliases = aliasMap[canonical] || [];
      for (const alias of aliases) {
        if (cleanString(alias) === cleanedInput) {
          return { canonical, original: input, isAutoCorrected: true, correctedFrom: alias };
        }
      }
    }

    // 3. Substring match
    const substringCandidates = [];
    for (const canonical of canonicalList) {
      const cleanedCanonical = cleanString(canonical);
      if (cleanedInput.length >= 3 && (cleanedCanonical.includes(cleanedInput) || cleanedInput.includes(cleanedCanonical))) {
        substringCandidates.push({ canonical, score: Math.min(cleanedInput.length, cleanedCanonical.length) / Math.max(cleanedInput.length, cleanedCanonical.length) });
      }
      const aliases = aliasMap[canonical] || [];
      for (const alias of aliases) {
        const cleanedAlias = cleanString(alias);
        if (cleanedInput.length >= 3 && (cleanedAlias.includes(cleanedInput) || cleanedInput.includes(cleanedAlias))) {
          substringCandidates.push({ canonical, score: Math.min(cleanedInput.length, cleanedAlias.length) / Math.max(cleanedInput.length, cleanedAlias.length) });
        }
      }
    }

    substringCandidates.sort((a, b) => b.score - a.score);
    if (substringCandidates.length > 0 && substringCandidates[0].score >= 0.8) {
      if (substringCandidates.length === 1 || (substringCandidates[0].score - substringCandidates[1].score >= 0.15)) {
        return { canonical: substringCandidates[0].canonical, original: input, isAutoCorrected: true };
      }
    }

    // 4. Fuzzy match Levenshtein
    const fuzzyCandidates = [];
    for (const canonical of canonicalList) {
      const cleanedCanonical = cleanString(canonical);
      const score = getSimilarity(cleanedInput, cleanedCanonical);
      fuzzyCandidates.push({ canonical, score });

      const aliases = aliasMap[canonical] || [];
      for (const alias of aliases) {
        const cleanedAlias = cleanString(alias);
        const score = getSimilarity(cleanedInput, cleanedAlias);
        fuzzyCandidates.push({ canonical, score });
      }
    }

    fuzzyCandidates.sort((a, b) => b.score - a.score);

    if (fuzzyCandidates.length > 0 && fuzzyCandidates[0].score >= 0.8) {
      if (fuzzyCandidates.length === 1 || (fuzzyCandidates[0].score - fuzzyCandidates[1].score >= 0.15)) {
        return { canonical: fuzzyCandidates[0].canonical, original: input, isAutoCorrected: true };
      }
    }

    return { canonical: '', original: input, isAutoCorrected: false, error: `Value "${input}" could not be matched confidently.` };
  }

  function parseExcelFile(file) {
    if (!file) return;
    
    const name = file.name || '';
    const ext = name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      toast.error({
        title: 'Invalid file format',
        message: 'Please upload an Excel (.xlsx, .xls) or CSV (.csv) file.'
      });
      return;
    }
    
    setBulkFile(file);
    setBulkLoading(true);
    setBulkResult(null);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet);
        
        if (!rows.length) {
          throw new Error('The uploaded file is empty.');
        }
        
        const keys = Object.keys(rows[0]);
        const aliasesMap = {
          fullName: ['fullname', 'name', 'studentname', 'fullName', 'full name', 'student name'],
          email: ['email', 'emailaddress', 'mail', 'email address', 'email id', 'emailid'],
          enrollmentNo: ['enrollmentno', 'enrollmentnumber', 'enrollment', 'enrollment no', 'enrollment number', 'enroll no', 'enrollno'],
          phone: ['phone', 'phonenumber', 'contact', 'phone number', 'contact number', 'mobile', 'mobile number'],
          program: ['program', 'course', 'degree', 'stream'],
          department: ['department', 'branch', 'dept', 'specialization'],
          semester: ['semester', 'sem', 'current semester', 'current sem']
        };
        
        const mapHeaders = (rawRow) => {
          const rowKeys = Object.keys(rawRow);
          const getVal = (aliases) => {
            const match = rowKeys.find(k => aliases.includes(String(k).toLowerCase().trim()));
            return match ? String(rawRow[match]).trim() : '';
          };
          
          return {
            fullName: getVal(aliasesMap.fullName),
            email: getVal(aliasesMap.email),
            enrollmentNo: getVal(aliasesMap.enrollmentNo),
            phone: getVal(aliasesMap.phone),
            program: getVal(aliasesMap.program),
            department: getVal(aliasesMap.department),
            semester: getVal(aliasesMap.semester)
          };
        };
        
        const fileEmails = new Set();
        const filePhones = new Set();
        const fileEnrollments = new Set();
        
         const mapped = rows.map((row, idx) => {
          const rawStudent = mapHeaders(row);
          
          const resolvedProgram = resolveValue(rawStudent.program, PROGRAM_OPTIONS, PROGRAM_ALIASES);
          const resolvedDept = resolveValue(rawStudent.department, ROUTING_DEPARTMENTS, DEPT_ALIASES);

          const student = {
            ...rawStudent,
            program: resolvedProgram.canonical || rawStudent.program,
            department: resolvedDept.canonical || rawStudent.department,
            temporaryPassword: generateRandomPassword(),
            rowNumber: idx + 2,
            originalProgram: rawStudent.program,
            originalDepartment: rawStudent.department,
            programAutoCorrected: resolvedProgram.isAutoCorrected,
            deptAutoCorrected: resolvedDept.isAutoCorrected
          };
          
          const errors = [];
          if (!student.fullName) errors.push('Full Name is required');
          if (!student.email) errors.push('Email is required');
          if (!student.enrollmentNo) errors.push('Enrollment Number is required');
          if (!student.phone) errors.push('Phone Number is required');
          if (!student.semester) errors.push('Semester is required');
          
          if (!resolvedProgram.canonical) {
            errors.push(resolvedProgram.error || 'Program is required');
          }
          if (!resolvedDept.canonical) {
            errors.push(resolvedDept.error || 'Department is required');
          }
          if (student.semester && !SEMESTER_OPTIONS.map(String).includes(String(student.semester))) {
            errors.push('Semester must be 1 to 8');
          }
          
          const emailLower = student.email.toLowerCase();
          const enrollmentLower = student.enrollmentNo.toLowerCase();
          
          if (student.email) {
            if (fileEmails.has(emailLower)) {
              errors.push(`Duplicate email "${student.email}" in file`);
            } else {
              fileEmails.add(emailLower);
            }
          }
          if (student.phone) {
            if (filePhones.has(student.phone)) {
              errors.push(`Duplicate phone number "${student.phone}" in file`);
            } else {
              filePhones.add(student.phone);
            }
          }
          if (student.enrollmentNo) {
            if (fileEnrollments.has(enrollmentLower)) {
              errors.push(`Duplicate enrollment number "${student.enrollmentNo}" in file`);
            } else {
              fileEnrollments.add(enrollmentLower);
            }
          }
          
          student.validationErrors = errors;
          return student;
        });
        
        setBulkStudents(mapped);
        toast.success({
          title: 'File parsed',
          message: `Found ${mapped.length} student records in the file.`
        });
      } catch (err) {
        toast.error({
          title: 'File parsing failed',
          message: err.message || 'Make sure sheet contains headers and correct format.'
        });
        setBulkFile(null);
        setBulkStudents([]);
      } finally {
        setBulkLoading(false);
      }
    };
    reader.onerror = () => {
      toast.error({
        title: 'Error reading file',
        message: 'Could not load the file from disk.'
      });
      setBulkLoading(false);
    };
    reader.readAsArrayBuffer(file);
  }

  async function handleBulkSubmit(event) {
    if (event) event.preventDefault();
    if (bulkLoading || !bulkStudents.length) return;
    
    // Filter the parsed preview rows to only those with no validationErrors (status === 'Ready')
    const readyRows = bulkStudents.filter(s => !s.validationErrors || s.validationErrors.length === 0);
    const errorRows = bulkStudents.filter(s => s.validationErrors && s.validationErrors.length > 0);
    
    setBulkLoading(true);
    try {
      let result = { added: [], rejected: [], summary: { totalRows: 0, addedCount: 0, rejectedCount: 0 } };
      
      if (readyRows.length > 0) {
        result = await bulkCreateAdminStudents(readyRows);
      }
      
      // Map frontend pre-submission error rows to the same rejected format
      const skippedErrors = errorRows.map(s => ({
        rowNumber: s.rowNumber,
        originalData: {
          fullName: s.fullName,
          email: s.email,
          enrollmentNo: s.enrollmentNo,
          phone: s.phone,
          program: s.program,
          department: s.department,
          semester: s.semester
        },
        reasons: s.validationErrors
      }));
      
      const allRejected = [...skippedErrors, ...(result.rejected || [])];
      allRejected.sort((a, b) => a.rowNumber - b.rowNumber);

      const finalResult = {
        added: result.added || [],
        rejected: allRejected,
        summary: {
          totalRows: bulkStudents.length,
          addedCount: result.summary?.addedCount || (result.added?.length || 0),
          rejectedCount: allRejected.length
        }
      };

      setBulkResult(finalResult);
      setBulkStudents([]);
      setBulkFile(null);
      setReloadKey((prev) => prev + 1);
      
      const addedCount = finalResult.summary.addedCount;
      const rejectedCount = finalResult.summary.rejectedCount;
      
      if (addedCount > 0) {
        toast.success({
          title: 'Bulk registration complete',
          message: `Successfully registered ${addedCount} student(s).`
        });
      }
      
      if (rejectedCount > 0) {
        toast.warn({
          title: 'Some entries rejected',
          message: `${rejectedCount} row(s) had errors and were not registered.`
        });
      }
    } catch (err) {
      toast.error({
        title: 'Registration failed',
        message: getApiErrorMessage(err, 'Unable to register bulk students right now.')
      });
    } finally {
      setBulkLoading(false);
    }
  }

  function handleDragOver(e) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    setDragOver(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      parseExcelFile(e.dataTransfer.files[0]);
    }
  }

  useEffect(() => {
    const debounceId = window.setTimeout(() => {
      setDebouncedSearch(search.trim())
      setPage(1)
    }, 220)

    return () => window.clearTimeout(debounceId)
  }, [search])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)

    fetchAdminStudents(
      {
        q: debouncedSearch,
        program,
        department,
        semester,
        page,
        limit: STUDENT_PAGE_SIZE,
      },
      controller.signal,
    )
      .then((result) => {
        setStudents(result.students)
        setMeta(result.meta || {})
        setOptions({
          programs: Array.isArray(result.options?.programs) && result.options.programs.length ? result.options.programs : PROGRAM_OPTIONS,
          departments:
            Array.isArray(result.options?.departments) && result.options.departments.length
              ? result.options.departments
              : ROUTING_DEPARTMENTS,
          semesters:
            Array.isArray(result.options?.semesters) && result.options.semesters.length ? result.options.semesters : SEMESTER_OPTIONS,
        })
      })
      .catch((error) => {
        if (error?.name === 'AbortError') return
        toast.error({
          title: 'Student list failed',
          message: getApiErrorMessage(error, 'Unable to load students right now.'),
        })
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [debouncedSearch, department, page, program, reloadKey, semester, toast])

  const isEditMode = Boolean(editingStudent?.id)
  const totalPages = Math.max(Number(meta?.totalPages) || 1, 1)
  const programOptions = options.programs?.length ? options.programs : PROGRAM_OPTIONS
  const departmentOptions = options.departments?.length ? options.departments : ROUTING_DEPARTMENTS
  const semesterOptions = options.semesters?.length ? options.semesters : SEMESTER_OPTIONS
  const studentStats = useMemo(
    () => ({
      total: Number(meta?.total || students.length || 0),
      visible: students.length,
      tempReady: students.filter((student) => student.hasTemporaryCredential).length,
    }),
    [meta?.total, students],
  )

  function openCreateModal() {
    setEditingStudent(null)
    setForm(createEmptyForm(options))
    setFieldErrors({})
    setSubmitError('')
    setModalOpen(true)
  }

  function openEditModal(student) {
    setEditingStudent(student)
    setForm({
      fullName: student.fullName || '',
      email: student.email || '',
      enrollmentNo: student.enrollmentNo || '',
      phone: student.phone || '',
      program: student.program || programOptions[0] || '',
      department: student.department || departmentOptions[0] || '',
      semester: String(student.semester || semesterOptions[0] || 1),
      temporaryPassword: '',
    })
    setFieldErrors({})
    setSubmitError('')
    setModalOpen(true)
  }

  function updateFormField(field, value) {
    setForm((previous) => ({ ...previous, [field]: value }))
    setFieldErrors((previous) => {
      const next = { ...previous }
      delete next[field]
      return next
    })
    setSubmitError('')
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (submitting) {
      return
    }

    setSubmitting(true)
    setSubmitError('')
    setFieldErrors({})

    try {
      if (isEditMode) {
        await updateAdminStudent(editingStudent.id, form)
        toast.success({
          title: 'Student updated',
          message: 'Student details were updated successfully.',
        })
      } else {
        await createAdminStudent(form)
        toast.success({
          title: 'Student added',
          message: 'New student account created successfully.',
        })
      }

      setModalOpen(false)
      setReloadKey((previous) => previous + 1)
    } catch (error) {
      const message = getApiErrorMessage(error, 'Unable to save the student right now.')
      const apiFieldErrors = error?.payload?.errors || error?.errors || []
      setSubmitError(message)
      setFieldErrors(
        apiFieldErrors.reduce((result, item) => {
          if (item?.field) {
            result[item.field] = item.message
          }
          return result
        }, {}),
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteStudent() {
    if (!deleteTarget?.id || deleting) {
      return
    }

    setDeleting(true)

    try {
      await deleteAdminStudent(deleteTarget.id)
      toast.success({
        title: 'Student deleted',
        message: 'Student account removed successfully.',
      })
      setDeleteTarget(null)
      setReloadKey((previous) => previous + 1)
    } catch (error) {
      toast.error({
        title: 'Delete failed',
        message: getApiErrorMessage(error, 'Unable to delete the student right now.'),
      })
    } finally {
      setDeleting(false)
    }
  }

  async function handleExportCredentials() {
    if (exporting) {
      return
    }

    setExporting(true)

    try {
      const result = await downloadAdminStudentCredentials({
        q: debouncedSearch,
        program,
        department,
        semester,
      })
      downloadBlob(result)
      toast.success({
        title: 'Credentials exported',
        message: 'Student credentials Excel downloaded successfully.',
      })
    } catch (error) {
      toast.error({
        title: 'Export failed',
        message: getApiErrorMessage(error, 'Unable to export student credentials right now.'),
      })
    } finally {
      setExporting(false)
    }
  }

  if (currentUser?.role === 'it' && activeSection === 'students') {
    return (
      <>
        <section className="admin-wide-panel student-management-panel" style={{ maxWidth: activeTab === 'bulk' ? '1000px' : '800px', margin: '0 auto', transition: 'max-width 0.2s' }}>
          <div className="admin-panel-heading" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <p className="admin-eyebrow">IT Student Management</p>
              <h2>Register New Students</h2>
              <span>Choose between individual student registration or bulk Excel upload.</span>
            </div>
            
            {activeTab === 'bulk' && (
              <button
                type="button"
                className="admin-secondary-link"
                onClick={downloadExcelTemplate}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'var(--app-surface-accent-soft)', color: 'var(--app-text-accent)', border: '1px dashed var(--app-surface-border)', padding: '0.65rem 1.25rem', borderRadius: '10px', fontWeight: '500', cursor: 'pointer', transition: 'all 0.2s' }}
              >
                <FileSpreadsheet size={16} />
                <span>Download Template</span>
              </button>
            )}
          </div>

          {/* Tab Switcher */}
          <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--app-surface-border)', marginBottom: '1.5rem', paddingBottom: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setActiveTab('single')}
              style={{
                background: 'none',
                border: 'none',
                padding: '0.5rem 1rem',
                fontWeight: '600',
                color: activeTab === 'single' ? 'var(--app-text-accent)' : 'var(--app-text-muted)',
                borderBottom: activeTab === 'single' ? '2px solid var(--app-text-accent)' : 'none',
                cursor: 'pointer'
              }}
            >
              Single Student Form
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('bulk')}
              style={{
                background: 'none',
                border: 'none',
                padding: '0.5rem 1rem',
                fontWeight: '600',
                color: activeTab === 'bulk' ? 'var(--app-text-accent)' : 'var(--app-text-muted)',
                borderBottom: activeTab === 'bulk' ? '2px solid var(--app-text-accent)' : 'none',
                cursor: 'pointer'
              }}
            >
              Bulk Excel Upload
            </button>
          </div>

          {activeTab === 'single' ? (
            <>
              {submitError ? (
                <div className="admin-alert danger" style={{ padding: '0.85rem', marginBottom: '1.25rem', borderRadius: '8px', background: 'var(--danger-soft)', color: 'var(--danger)', fontSize: '0.85rem' }}>
                  {submitError}
                </div>
              ) : null}

              <form onSubmit={handleSubmit}>
                <StudentFormFields
                  form={form}
                  fieldErrors={fieldErrors}
                  onChange={updateFormField}
                  isEditMode={false}
                  programOptions={options.programs}
                  departmentOptions={options.departments}
                  semesterOptions={options.semesters}
                />
                
                <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button
                    type="button"
                    className="admin-secondary-link"
                    onClick={() => {
                      setForm(createEmptyForm(options))
                      setFieldErrors({})
                      setSubmitError('')
                    }}
                    style={{ border: '1px solid var(--app-surface-border)', padding: '0.6rem 1.2rem', borderRadius: '8px' }}
                  >
                    Clear Form
                  </button>
                  <button
                    type="submit"
                    className="admin-primary-button inline"
                    disabled={submitting}
                    style={{ padding: '0.6rem 1.5rem' }}
                  >
                    {submitting ? 'Creating...' : 'Register Student'}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <>
              {bulkResult && (
                <div style={{ marginBottom: '1.5rem', background: 'rgba(30, 64, 175, 0.05)', border: '1px solid var(--app-surface-border)', borderRadius: '16px', padding: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700', color: 'var(--app-text)' }}>Bulk Processing Summary</h3>
                    <button
                      type="button"
                      onClick={() => setBulkResult(null)}
                      style={{ background: 'none', border: 'none', color: 'var(--app-text-muted)', cursor: 'pointer', padding: '0.25rem' }}
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* Summary Banner */}
                  <div style={{
                    padding: '1rem 1.25rem',
                    background: (bulkResult.summary?.rejectedCount || 0) > 0 ? 'rgba(239, 68, 68, 0.08)' : 'rgba(34, 197, 94, 0.08)',
                    border: '1px solid ' + ((bulkResult.summary?.rejectedCount || 0) > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)'),
                    borderRadius: '12px',
                    marginBottom: '1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.95rem',
                    fontWeight: '600',
                    color: (bulkResult.summary?.rejectedCount || 0) > 0 ? 'var(--danger)' : 'var(--success)'
                  }}>
                    {(bulkResult.summary?.rejectedCount || 0) > 0 ? (
                      <>
                        <AlertTriangle size={18} />
                        <span>{bulkResult.summary?.addedCount || 0} of {bulkResult.summary?.totalRows || 0} students added successfully. {bulkResult.summary?.rejectedCount || 0} rows need fixing.</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={18} />
                        <span>All {bulkResult.summary?.totalRows || 0} students added successfully!</span>
                      </>
                    )}
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
                    <div style={{ padding: '1rem', background: 'rgba(34, 197, 94, 0.08)', borderRadius: '12px', border: '1px solid rgba(34, 197, 94, 0.15)', textAlign: 'center' }}>
                      <p style={{ margin: 0, fontSize: '1.8rem', fontWeight: '800', color: '#22c55e' }}>{bulkResult.summary?.addedCount || bulkResult.added?.length || 0}</p>
                      <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: '600', color: 'var(--app-text-muted)', textTransform: 'uppercase' }}>Registered</p>
                    </div>
                    <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.08)', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.15)', textAlign: 'center' }}>
                      <p style={{ margin: 0, fontSize: '1.8rem', fontWeight: '800', color: '#ef4444' }}>{bulkResult.summary?.rejectedCount || bulkResult.rejected?.length || 0}</p>
                      <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: '600', color: 'var(--app-text-muted)', textTransform: 'uppercase' }}>Rejected</p>
                    </div>
                  </div>

                  {/* Added (N) Section */}
                  {bulkResult.added?.length > 0 && (
                    <div style={{ marginBottom: '1.25rem' }}>
                      <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', fontWeight: '600', color: 'var(--success)' }}>
                        Added ({bulkResult.added.length})
                      </p>
                      <div style={{ maxHeight: '150px', overflowY: 'auto', fontSize: '0.8rem', background: 'var(--app-surface)', borderRadius: '8px', padding: '0.5rem 0.75rem', border: '1px solid var(--app-surface-border)' }}>
                        <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          {bulkResult.added.map((student, i) => (
                            <li key={i}>
                              <strong>{student.fullName}</strong> ({student.enrollmentNo}) - <span style={{ color: 'var(--app-text-muted)' }}>{student.email}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                  
                  {/* Rejected Rows Table */}
                  {bulkResult.rejected?.length > 0 && (
                    <div style={{ marginTop: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: '600', color: '#ef4444' }}>
                          Not uploaded — Error rows ({bulkResult.rejected.length}):
                        </p>
                        <button
                          type="button"
                          onClick={downloadRejectedRows}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            padding: '0.4rem 0.8rem',
                            background: 'var(--app-primary)',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '0.8rem',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                        >
                          <Download size={14} />
                          <span>Download Error Report</span>
                        </button>
                      </div>
                      
                      <div style={{ overflowX: 'auto', maxHeight: '300px', border: '1px solid var(--app-surface-border)', borderRadius: '12px', background: 'var(--app-surface)' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                          <thead style={{ background: 'rgba(239, 68, 68, 0.03)', position: 'sticky', top: 0, zIndex: 1, borderBottom: '1px solid var(--app-surface-border)' }}>
                            <tr>
                              <th style={{ padding: '0.75rem 1rem' }}>Row</th>
                              <th style={{ padding: '0.75rem 1rem' }}>Name</th>
                              <th style={{ padding: '0.75rem 1rem' }}>Enrollment</th>
                              <th style={{ padding: '0.75rem 1rem' }}>Email / Phone</th>
                              <th style={{ padding: '0.75rem 1rem' }}>Academic Scope</th>
                              <th style={{ padding: '0.75rem 1rem' }}>Rejected Issues / Reasons</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bulkResult.rejected.map((rej, idx) => {
                              const d = rej.originalData || {};
                              
                              const hasError = (field) => rej.reasons.some(r => r.toLowerCase().includes(field.toLowerCase()));

                              return (
                                <tr key={idx} style={{ borderBottom: '1px solid var(--app-surface-border)', background: 'rgba(239, 68, 68, 0.01)' }}>
                                  <td style={{ padding: '0.75rem 1rem', color: 'var(--app-text-muted)' }}>{rej.rowNumber}</td>
                                  <td style={{ padding: '0.75rem 1rem', fontWeight: '500', color: hasError('name') ? 'var(--danger)' : 'inherit' }}>
                                    {d.fullName || <span style={{ color: 'var(--danger)' }}>(missing)</span>}
                                  </td>
                                  <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', color: hasError('enrollment') ? 'var(--danger)' : 'inherit' }}>
                                    {d.enrollmentNo || <span style={{ color: 'var(--danger)' }}>(missing)</span>}
                                  </td>
                                  <td style={{ padding: '0.75rem 1rem' }}>
                                    <div style={{ fontWeight: '500', color: hasError('email') ? 'var(--danger)' : 'inherit' }}>
                                      {d.email || <span style={{ color: 'var(--danger)' }}>(missing)</span>}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: hasError('phone') ? 'var(--danger)' : 'var(--app-text-muted)' }}>
                                      {d.phone || <span style={{ color: 'var(--danger)' }}>(missing)</span>}
                                    </div>
                                  </td>
                                  <td style={{ padding: '0.75rem 1rem' }}>
                                    <div style={{ color: hasError('program') ? 'var(--danger)' : 'inherit' }}>{d.program || <span style={{ color: 'var(--danger)' }}>(missing)</span>}</div>
                                    <div style={{ color: hasError('department') ? 'var(--danger)' : 'inherit', fontSize: '0.8rem', marginTop: '0.15rem' }}>{d.department || <span style={{ color: 'var(--danger)' }}>(missing)</span>}</div>
                                    <div style={{ color: hasError('semester') ? 'var(--danger)' : 'var(--app-text-muted)', fontSize: '0.75rem', marginTop: '0.15rem' }}>Semester {d.semester || <span style={{ color: 'var(--danger)' }}>(missing)</span>}</div>
                                  </td>
                                  <td style={{ padding: '0.75rem 1rem' }}>
                                    <ul style={{ margin: 0, paddingLeft: '1rem', color: 'var(--danger)', fontSize: '0.8rem' }}>
                                      {rej.reasons.map((r, i) => (
                                        <li key={i} style={{ marginBottom: '0.15rem' }}>{r}</li>
                                      ))}
                                    </ul>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Drag and Drop Zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: dragOver ? '2px dashed var(--app-text-accent)' : '2px dashed var(--app-surface-border)',
                  background: dragOver ? 'rgba(30, 64, 175, 0.04)' : 'var(--app-surface)',
                  borderRadius: '16px',
                  padding: '2.5rem 1.5rem',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  marginBottom: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.75rem'
                }}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      parseExcelFile(e.target.files[0]);
                    }
                  }}
                  style={{ display: 'none' }}
                  accept=".xlsx,.xls,.csv"
                />
                
                {bulkLoading ? (
                  <>
                    <RefreshCw size={36} className="animate-spin" style={{ color: 'var(--app-text-accent)' }} />
                    <h4 style={{ margin: 0, fontWeight: '600' }}>Parsing your sheet...</h4>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--app-text-muted)' }}>Reading data and generating random passwords</p>
                  </>
                ) : bulkFile ? (
                  <>
                    <CheckCircle2 size={36} style={{ color: 'var(--success)' }} />
                    <h4 style={{ margin: 0, fontWeight: '600', color: 'var(--success)' }}>File Selected: {bulkFile.name}</h4>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--app-text-muted)' }}>{(bulkFile.size / 1024).toFixed(1)} KB — Click or drag to change file</p>
                  </>
                ) : (
                  <>
                    <Upload size={36} style={{ color: 'var(--app-text-muted)' }} />
                    <h4 style={{ margin: 0, fontWeight: '600' }}>Drag & Drop Excel or CSV File Here</h4>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--app-text-muted)' }}>Or click to select a file from your device</p>
                  </>
                )}
              </div>

              {/* Parsed Preview Table */}
              {bulkStudents.length > 0 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <h4 style={{ margin: 0, fontWeight: '600' }}>Parsed Records Preview ({bulkStudents.length} rows)</h4>
                    <span style={{ fontSize: '0.8rem', color: bulkStudents.some(s => s.validationErrors.length > 0) ? 'var(--danger)' : 'var(--success)', fontWeight: '600' }}>
                      {bulkStudents.some(s => s.validationErrors.length > 0) ? '⚠️ Please resolve validation errors' : '✅ Ready to submit'}
                    </span>
                  </div>
                  
                  <div style={{ overflowX: 'auto', maxHeight: '350px', border: '1px solid var(--app-surface-border)', borderRadius: '12px', marginBottom: '1.5rem', background: 'var(--app-surface)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                      <thead style={{ background: 'rgba(30, 64, 175, 0.03)', position: 'sticky', top: 0, zIndex: 1, borderBottom: '1px solid var(--app-surface-border)' }}>
                        <tr>
                          <th style={{ padding: '0.75rem 1rem' }}>Row</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Name</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Enrollment</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Email / Phone</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Academic Scope</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Generated Password</th>
                          <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bulkStudents.map((student, idx) => {
                          const hasErr = student.validationErrors.length > 0;
                          return (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--app-surface-border)', background: hasErr ? 'rgba(239, 68, 68, 0.02)' : 'inherit' }}>
                              <td style={{ padding: '0.75rem 1rem', color: 'var(--app-text-muted)' }}>{student.rowNumber}</td>
                              <td style={{ padding: '0.75rem 1rem', fontWeight: '500' }}>{student.fullName || <span style={{color:'var(--danger)'}}>(missing)</span>}</td>
                              <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace' }}>{student.enrollmentNo || <span style={{color:'var(--danger)'}}>(missing)</span>}</td>
                              <td style={{ padding: '0.75rem 1rem' }}>
                                <div style={{ fontWeight: '500' }}>{student.email || <span style={{color:'var(--danger)'}}>(missing)</span>}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--app-text-muted)' }}>{student.phone || <span style={{color:'var(--danger)'}}>(missing)</span>}</div>
                              </td>
                              <td style={{ padding: '0.75rem 1rem' }}>
                                <div style={{ fontWeight: '500' }}>
                                  {student.program}
                                  {student.programAutoCorrected && (
                                    <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--app-text-accent)', fontWeight: 'normal', fontStyle: 'italic' }}>
                                      (auto-corrected from "{student.originalProgram}")
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontWeight: '500', marginTop: '0.25rem' }}>
                                  {student.department}
                                  {student.deptAutoCorrected && (
                                    <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--app-text-accent)', fontWeight: 'normal', fontStyle: 'italic' }}>
                                      (auto-corrected from "{student.originalDepartment}")
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--app-text-muted)', marginTop: '0.25rem' }}>Semester {student.semester}</div>
                              </td>
                              <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', color: 'var(--app-text-accent)', fontWeight: '600' }}>
                                {student.temporaryPassword}
                              </td>
                              <td style={{ padding: '0.75rem 1rem' }}>
                                {hasErr ? (
                                  <div title={student.validationErrors.join(', ')} style={{ color: 'var(--danger)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem' }}>
                                    <AlertTriangle size={14} />
                                    <span>Error</span>
                                  </div>
                                ) : (
                                  <div style={{ color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem' }}>
                                    <CheckCircle2 size={14} />
                                    <span>Ready</span>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  
                  {bulkStudents.some(s => s.validationErrors.length > 0) && (
                    <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(239, 68, 68, 0.04)', border: '1px solid rgba(239, 68, 68, 0.08)', padding: '0.85rem 1rem', borderRadius: '10px', marginBottom: '1.5rem', color: 'var(--danger)', fontSize: '0.8rem', alignItems: 'flex-start' }}>
                      <AlertOctagon size={16} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
                      <div>
                        <p style={{ margin: '0 0 0.25rem', fontWeight: '600' }}>Please fix the errors below in your Excel sheet:</p>
                        <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                          {bulkStudents.filter(s => s.validationErrors.length > 0).map((s, idx) => (
                            <li key={idx} style={{ marginBottom: '0.15rem' }}>Row {s.rowNumber} ({s.fullName || 'Unnamed'}): {s.validationErrors.join(', ')}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                  
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                    <button
                      type="button"
                      className="admin-secondary-link"
                      onClick={() => {
                        setBulkStudents([]);
                        setBulkFile(null);
                        setBulkResult(null);
                      }}
                      style={{ border: '1px solid var(--app-surface-border)', padding: '0.6rem 1.2rem', borderRadius: '8px' }}
                    >
                      Clear List
                    </button>
                    <button
                      type="button"
                      className="admin-primary-button inline"
                      disabled={bulkLoading || bulkStudents.some(s => s.validationErrors.length > 0)}
                      onClick={handleBulkSubmit}
                      style={{ padding: '0.6rem 1.5rem' }}
                    >
                      {bulkLoading ? 'Creating Accounts...' : 'Register All Students'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </>
    )
  }

  const isItAdmin = currentUser?.role === 'it';

  return (
    <>
      <section className="admin-wide-panel student-management-panel">
        <div className="admin-panel-heading">
          <div>
            <p className="admin-eyebrow">{isItAdmin ? 'IT Student Management' : 'CAO Student Management'}</p>
            <h2>{isItAdmin ? 'Student Registration History' : 'Add, review, edit, delete, and export student access details'}</h2>
            <span>{isItAdmin ? 'Review, search, edit, delete, and export registered student records.' : 'Student access is now CAO-controlled with enrollment-based sign-in and temporary-password handling.'}</span>
          </div>
          <div className="admin-inline-actions">
            <button type="button" className="admin-secondary-link" onClick={handleExportCredentials} disabled={exporting}>
              <FileDown size={16} strokeWidth={1.5} />
              <span>{exporting ? 'Exporting...' : 'Export Student Credentials'}</span>
            </button>
            {!isItAdmin ? (
              <button type="button" className="admin-primary-button inline" onClick={openCreateModal}>
                <UserPlus size={16} strokeWidth={1.5} />
                <span>Add New Student</span>
              </button>
            ) : null}
          </div>
        </div>

        <div className="admin-stat-grid compact">
          <article className="admin-stat-card">
            <div className="admin-stat-icon">
              <GraduationCap size={22} strokeWidth={1.5} />
            </div>
            <div>
              <p>Total Students</p>
              <strong>{studentStats.total}</strong>
            </div>
          </article>
          <article className="admin-stat-card success">
            <div className="admin-stat-icon">
              <Eye size={22} strokeWidth={1.5} />
            </div>
            <div>
              <p>Visible Rows</p>
              <strong>{studentStats.visible}</strong>
            </div>
          </article>
          <article className="admin-stat-card warning">
            <div className="admin-stat-icon">
              <KeyRound size={22} strokeWidth={1.5} />
            </div>
            <div>
              <p>Temp Credentials Ready</p>
              <strong>{studentStats.tempReady}</strong>
            </div>
          </article>
        </div>

        <div className="student-filter-grid">
          <label className="admin-field">
            <span>Search</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name, enrollment, email, phone"
            />
          </label>

          <label className="admin-field">
            <span>Program</span>
            <SelectField
              value={program}
              onChange={(event) => {
                setProgram(event.target.value)
                setPage(1)
              }}
            >
              <option value="">All programs</option>
              {programOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </SelectField>
          </label>

          <label className="admin-field">
            <span>Department</span>
            <SelectField
              value={department}
              onChange={(event) => {
                setDepartment(event.target.value)
                setPage(1)
              }}
            >
              <option value="">All departments</option>
              {departmentOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </SelectField>
          </label>

          <label className="admin-field">
            <span>Semester</span>
            <SelectField
              value={semester}
              onChange={(event) => {
                setSemester(event.target.value)
                setPage(1)
              }}
            >
              <option value="">All semesters</option>
              {semesterOptions.map((item) => (
                <option key={item} value={item}>
                  Semester {item}
                </option>
              ))}
            </SelectField>
          </label>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table student-admin-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Enrollment</th>
                <th>Program</th>
                <th>Department</th>
                <th>Semester</th>
                <th>Contact</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8}>
                    <div className="admin-empty-state">Loading students...</div>
                  </td>
                </tr>
              ) : students.length ? (
                students.map((student) => (
                  <tr key={student.id}>
                    <td>
                      <div className="admin-record-primary">
                        <strong>{student.fullName}</strong>
                        <span>{student.email || 'No email assigned'}</span>
                      </div>
                    </td>
                    <td>{student.enrollmentNo}</td>
                    <td>{student.program || 'Not assigned'}</td>
                    <td>{student.department || 'Not assigned'}</td>
                    <td>{student.semester ? `Semester ${student.semester}` : 'Not assigned'}</td>
                    <td>{[student.phone, student.email].filter(Boolean).join(' | ') || 'Not available'}</td>
                    <td>
                      <div className="student-admin-status-list">
                        <span className={`admin-status ${student.mustChangePassword ? 'generating' : 'success'}`}>
                          {student.mustChangePassword ? 'Password change pending' : 'Ready'}
                        </span>
                        {student.hasTemporaryCredential ? <span className="admin-record-badge">Temp password ready</span> : null}
                      </div>
                    </td>
                    <td>
                      <div className="admin-inline-actions">
                        <button type="button" className="admin-text-button" onClick={() => openEditModal(student)}>
                          <PencilLine size={16} strokeWidth={1.5} />
                          <span>Edit</span>
                        </button>
                        <button type="button" className="admin-text-button danger" onClick={() => setDeleteTarget(student)}>
                          <Trash2 size={16} strokeWidth={1.5} />
                          <span>Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8}>
                    <EmptyState
                      title="No students found"
                      description="Adjust the filters or add a new CAO-managed student account."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="admin-pager">
          <button type="button" className="admin-secondary-link" onClick={() => setPage((previous) => Math.max(previous - 1, 1))} disabled={page <= 1}>
            Previous
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            className="admin-secondary-link"
            onClick={() => setPage((previous) => Math.min(previous + 1, totalPages))}
            disabled={page >= totalPages}
          >
            Next
          </button>
        </div>
      </section>

      <ModalForm
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={isEditMode ? 'Edit Student' : 'Add New Student'}
        subtitle={
          isEditMode
            ? 'Update student details safely without changing the enrollment identity.'
            : 'Create a CAO-managed student account with a temporary password.'
        }
        className="student-form-modal"
      >
        <form className="modal-form student-form-modal-body" onSubmit={handleSubmit}>
          <StudentFormFields
            form={form}
            fieldErrors={fieldErrors}
            onChange={updateFormField}
            isEditMode={isEditMode}
            programOptions={programOptions}
            departmentOptions={departmentOptions}
            semesterOptions={semesterOptions}
          />
          {submitError ? <p className="form-error">{submitError}</p> : null}
          <div className="modal-actions">
            <ActionButton type="button" tone="secondary" onClick={() => setModalOpen(false)} disabled={submitting}>
              Cancel
            </ActionButton>
            <ActionButton type="submit" icon={isEditMode ? PencilLine : UserPlus} disabled={submitting} aria-busy={submitting}>
              {submitting ? (isEditMode ? 'Saving changes...' : 'Creating student...') : isEditMode ? 'Save Changes' : 'Create Student'}
            </ActionButton>
          </div>
        </form>
      </ModalForm>

      <ModalForm
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete student"
        subtitle="This will remove the selected student account from DwarPal."
        className="student-delete-modal"
      >
        <div className="student-delete-modal-body">
          <p>
            Are you sure you want to delete <strong>{deleteTarget?.fullName || 'this student'}</strong>?
          </p>
          <p className="field-hint">This action requires confirmation to avoid removing the wrong enrollment record.</p>
          <div className="modal-actions">
            <ActionButton type="button" tone="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </ActionButton>
            <ActionButton type="button" tone="danger" icon={Trash2} onClick={handleDeleteStudent} disabled={deleting} aria-busy={deleting}>
              {deleting ? 'Deleting...' : 'Delete Student'}
            </ActionButton>
          </div>
        </div>
      </ModalForm>
    </>
  )
}
