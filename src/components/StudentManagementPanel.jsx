import { useEffect, useMemo, useState, useRef } from 'react'
import { Eye, FileDown, Download, GraduationCap, KeyRound, PencilLine, ShieldCheck, Trash2, UserPlus, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, RefreshCw, X, AlertOctagon, History, Clock, FileWarning, Trash } from 'lucide-react'
import * as XLSX from 'xlsx'
import Papa from 'papaparse'
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

// ── Error History Hook ──────────────────────────────────────────────────────
// Persists upload error logs to localStorage per IT user.
// Key: dwarpal_upload_errors_<userId>
const ERROR_HISTORY_MAX = 50;

function useErrorHistory(userId) {
  const storageKey = userId ? `dwarpal_upload_errors_${userId}` : null;
  const unseenKey = userId ? `dwarpal_upload_errors_unseen_${userId}` : null;

  function readHistory() {
    if (!storageKey) return [];
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function writeHistory(entries) {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(entries));
    } catch {
      // Storage full or unavailable — fail silently
    }
  }

  function readUnseen() {
    if (!unseenKey) return 0;
    try {
      return Number(localStorage.getItem(unseenKey) || 0);
    } catch {
      return 0;
    }
  }

  function saveErrorEntry(entry) {
    const history = readHistory();
    const newEntry = {
      id: `err_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      ...entry,
    };
    const updated = [newEntry, ...history].slice(0, ERROR_HISTORY_MAX);
    writeHistory(updated);
    // Increment unseen count
    if (unseenKey) {
      try { localStorage.setItem(unseenKey, String(readUnseen() + 1)); } catch {}
    }
    return newEntry;
  }

  function removeEntry(id) {
    const updated = readHistory().filter(e => e.id !== id);
    writeHistory(updated);
  }

  function clearHistory() {
    writeHistory([]);
    if (unseenKey) {
      try { localStorage.removeItem(unseenKey); } catch {}
    }
  }

  function markSeen() {
    if (unseenKey) {
      try { localStorage.setItem(unseenKey, '0'); } catch {}
    }
  }

  return { readHistory, saveErrorEntry, removeEntry, clearHistory, readUnseen, markSeen };
}
// ─────────────────────────────────────────────────────────────────────────────

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
  autoGenerateEnrollment = false,
  setAutoGenerateEnrollment = () => {},
}) {
  const isSem1 = Number(form.semester) === 1;
  const progLower = String(form.program || '').toLowerCase();
  const isSem3DToD = Number(form.semester) === 3 && (progLower.includes('degree') || progLower.includes('d to d') || progLower.includes('dtd') || progLower.includes('d2d'));
  const isEligibleForTemp = isSem1 || isSem3DToD;

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Enrollment Number</span>
          {!isEditMode && isEligibleForTemp && (
            <button
              type="button"
              onClick={() => {
                const nextVal = !autoGenerateEnrollment;
                setAutoGenerateEnrollment(nextVal);
                if (nextVal) {
                  onChange('enrollmentNo', '');
                }
              }}
              style={{
                fontSize: '0.75rem',
                padding: '0.25rem 0.5rem',
                borderRadius: '4px',
                border: '1px solid #d97706',
                background: autoGenerateEnrollment ? '#fef3c7' : 'transparent',
                color: '#d97706',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              ✨ {autoGenerateEnrollment ? 'Using Temp Auto-Gen' : 'New Student'}
            </button>
          )}
        </div>
        {autoGenerateEnrollment ? (
          <div style={{
            padding: '0.5rem 0.75rem',
            background: '#f3f4f6',
            border: '1px dashed #d1d5db',
            borderRadius: '6px',
            color: '#6b7280',
            fontSize: '0.875rem'
          }}>
            ⚡ GTU Enrollment number will be auto-generated by the system on submit.
          </div>
        ) : (
          <input
            value={form.enrollmentNo}
            onChange={(event) => onChange('enrollmentNo', event.target.value)}
            className={fieldErrors.enrollmentNo ? 'field-invalid' : ''}
            placeholder="Enter enrollment number"
            readOnly={isEditMode}
          />
        )}
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
  const [activeTab, setActiveTab] = useState('single') // 'single' | 'bulk' | 'error_history'
  const [bulkStudents, setBulkStudents] = useState([])
  const [bulkFile, setBulkFile] = useState(null)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkResult, setBulkResult] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef(null)

  // Error history
  const errorHistoryHook = useErrorHistory(currentUser?.id)
  const [errorHistory, setErrorHistory] = useState(() => errorHistoryHook.readHistory())
  const [unseenCount, setUnseenCount] = useState(() => errorHistoryHook.readUnseen())
  const [bulkFileName, setBulkFileName] = useState('')

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

  // ── Error History helpers ─────────────────────────────────────────────────
  function refreshHistory() {
    setErrorHistory(errorHistoryHook.readHistory());
    setUnseenCount(errorHistoryHook.readUnseen());
  }

  function saveAndRefresh(entry) {
    errorHistoryHook.saveErrorEntry(entry);
    refreshHistory();
  }

  function removeHistoryEntry(id) {
    errorHistoryHook.removeEntry(id);
    refreshHistory();
  }

  function clearAllHistory() {
    errorHistoryHook.clearHistory();
    refreshHistory();
  }

  function handleTabChange(tab) {
    setActiveTab(tab);
    if (tab === 'error_history') {
      errorHistoryHook.markSeen();
      setUnseenCount(0);
      refreshHistory();
    }
  }

  /**
   * Re-run the Excel error report download for a stored history entry.
   */
  function downloadHistoryEntry(entry) {
    const errorRows = entry.rejectedRows || [];
    if (!errorRows.length) return;
    try {
      const timestampStr = entry.timestamp;
      const timestampDate = (timestampStr || '').slice(0, 10);
      const totalErrors = errorRows.length;

      const aoa = [
        [`Total Error Rows: ${totalErrors} — Generated: ${timestampStr}`, '', '', '', '', '', '', '', ''],
        ['Row #', 'Full Name', 'Email', 'Enrollment Number', 'Phone Number', 'Program', 'Department', 'Semester', 'Issues Found']
      ];

      errorRows.forEach(r => {
        const d = r.originalData || {};
        const fErrors = r.fieldErrors || {};
        const issuesList = [];
        if (fErrors.fullName) issuesList.push(`Full Name: ${fErrors.fullName}`);
        if (fErrors.email) issuesList.push(`Email: ${fErrors.email}`);
        if (fErrors.enrollmentNumber) issuesList.push(`Enrollment Number: ${fErrors.enrollmentNumber}`);
        if (fErrors.phoneNumber) issuesList.push(`Phone Number: ${fErrors.phoneNumber}`);
        if (fErrors.program) issuesList.push(`Program: ${fErrors.program}`);
        if (fErrors.department) issuesList.push(`Department: ${fErrors.department}`);
        if (fErrors.semester) issuesList.push(`Semester: ${fErrors.semester}`);
        if (!issuesList.length && r.reasons?.length) {
          r.reasons.forEach(reason => issuesList.push(reason));
        }
        aoa.push([
          r.rowNumber,
          d.fullName || '',
          d.email || '',
          d.enrollmentNo || '',
          d.phone || '',
          d.program || '',
          d.department || '',
          d.semester || '',
          issuesList.join('\n')
        ]);
      });

      const sheet = XLSX.utils.aoa_to_sheet(aoa);
      sheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 8 } }];
      const range = XLSX.utils.decode_range(sheet['!ref']);
      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellRef = XLSX.utils.encode_cell({ c: C, r: R });
          let cell = sheet[cellRef];
          if (!cell) continue;
          if (!cell.s) cell.s = {};
          if (R === 0) {
            cell.s = { font: { bold: true, size: 11, color: { rgb: '333333' } }, fill: { fgColor: { rgb: 'F3F4F6' } }, alignment: { horizontal: 'left', vertical: 'center' } };
          } else if (R === 1) {
            cell.s = { font: { bold: true, size: 10, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1E3A8A' } }, alignment: { horizontal: 'center', vertical: 'center' } };
          } else {
            const dataRowIndex = R - 2;
            const rData = errorRows[dataRowIndex];
            const fE = rData?.fieldErrors || {};
            let fieldHasError = false;
            if (C === 1 && fE.fullName) fieldHasError = true;
            if (C === 2 && fE.email) fieldHasError = true;
            if (C === 3 && fE.enrollmentNumber) fieldHasError = true;
            if (C === 4 && fE.phoneNumber) fieldHasError = true;
            if (C === 5 && fE.program) fieldHasError = true;
            if (C === 6 && fE.department) fieldHasError = true;
            if (C === 7 && fE.semester) fieldHasError = true;
            if (fieldHasError) {
              cell.s = { fill: { fgColor: { rgb: 'FFC7CE' } }, font: { color: { rgb: '9C0006' } }, alignment: { horizontal: 'left', vertical: 'center' } };
            } else if (C === 8) {
              cell.s = { alignment: { wrapText: true, vertical: 'top' }, font: { color: { rgb: '9C0006' } } };
            } else {
              cell.s = { alignment: { vertical: 'center' } };
            }
          }
        }
      }
      const colWidths = [];
      for (let C = 0; C <= range.e.c; ++C) {
        let maxLen = 10;
        for (let R = 1; R <= range.e.r; ++R) {
          const cellRef = XLSX.utils.encode_cell({ c: C, r: R });
          const cell = sheet[cellRef];
          if (cell && cell.v) {
            const lines = String(cell.v).split('\n');
            const longest = Math.max(...lines.map(l => l.length));
            if (longest > maxLen) maxLen = longest;
          }
        }
        colWidths.push({ wch: Math.min(maxLen + 4, 50) });
      }
      sheet['!cols'] = colWidths;
      sheet['!views'] = [{ state: 'frozen', ySplit: 2, activePane: 'bottomLeft', pane: { xSplit: 0, ySplit: 2, topLeftCell: 'A3', activePane: 'bottomLeft' } }];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, 'Error Report');
      XLSX.writeFile(workbook, `Upload_Error_Report_${timestampDate}.xlsx`);

      toast.success({ title: 'Downloaded', message: 'Error report Excel sheet downloaded.' });
    } catch (err) {
      console.error('Error re-downloading history entry:', err);
      toast.error({ title: 'Download failed', message: err.message || 'Unable to generate error report.' });
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  function downloadRejectedRows() {
    const errorRows = (bulkResult && bulkResult.rejected && bulkResult.rejected.length)
      ? bulkResult.rejected
      : bulkStudents.filter(s => s.validationErrors && s.validationErrors.length > 0).map(s => ({
          rowNumber: s.rowNumber,
          originalData: {
            fullName: s.fullName || '',
            email: s.email || '',
            enrollmentNo: s.enrollmentNo || '',
            phone: s.phone || '',
            program: s.originalProgram || s.program || '',
            department: s.originalDepartment || s.department || '',
            semester: s.semester || ''
          },
          reasons: s.validationErrors,
          fieldErrors: s.fieldErrors
        }));

    if (!errorRows || !errorRows.length) return;
    try {
      const timestampStr = new Date().toISOString();
      const timestampDate = new Date().toISOString().slice(0, 10);
      const totalErrors = errorRows.length;
      
      const aoa = [
        [`Total Error Rows: ${totalErrors} — Generated: ${timestampStr}`, '', '', '', '', '', '', '', ''],
        ['Row #', 'Full Name', 'Email', 'Enrollment Number', 'Phone Number', 'Program', 'Department', 'Semester', 'Issues Found']
      ];
      
      errorRows.forEach(r => {
        const d = r.originalData || {};
        
        const issuesList = [];
        const fErrors = r.fieldErrors || {};
        if (fErrors.fullName) issuesList.push(`Full Name: ${fErrors.fullName}`);
        if (fErrors.email) issuesList.push(`Email: ${fErrors.email}`);
        if (fErrors.enrollmentNumber) issuesList.push(`Enrollment Number: ${fErrors.enrollmentNumber}`);
        if (fErrors.phoneNumber) issuesList.push(`Phone Number: ${fErrors.phoneNumber}`);
        if (fErrors.program) issuesList.push(`Program: ${fErrors.program}`);
        if (fErrors.department) issuesList.push(`Department: ${fErrors.department}`);
        if (fErrors.semester) issuesList.push(`Semester: ${fErrors.semester}`);
        
        const issuesFound = issuesList.join('\n');
        
        aoa.push([
          r.rowNumber,
          d.fullName || '',
          d.email || '',
          d.enrollmentNo || '',
          d.phone || '',
          d.program || '',
          d.department || '',
          d.semester || '',
          issuesFound
        ]);
      });
      
      const sheet = XLSX.utils.aoa_to_sheet(aoa);
      
      sheet['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } }
      ];
      
      const range = XLSX.utils.decode_range(sheet['!ref']);
      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cell_ref = XLSX.utils.encode_cell({ c: C, r: R });
          let cell = sheet[cell_ref];
          if (!cell) continue;
          
          if (!cell.s) cell.s = {};
          
          if (R === 0) {
            cell.s = {
              font: { bold: true, size: 11, color: { rgb: "333333" } },
              fill: { fgColor: { rgb: "F3F4F6" } },
              alignment: { horizontal: "left", vertical: "center" }
            };
          } else if (R === 1) {
            cell.s = {
              font: { bold: true, size: 10, color: { rgb: "FFFFFF" } },
              fill: { fgColor: { rgb: "1E3A8A" } },
              alignment: { horizontal: "center", vertical: "center" }
            };
          } else {
            const dataRowIndex = R - 2;
            const rData = errorRows[dataRowIndex];
            const fErrors = rData.fieldErrors || {};
            
            let fieldHasError = false;
            if (C === 1 && fErrors.fullName) fieldHasError = true;
            if (C === 2 && fErrors.email) fieldHasError = true;
            if (C === 3 && fErrors.enrollmentNumber) fieldHasError = true;
            if (C === 4 && fErrors.phoneNumber) fieldHasError = true;
            if (C === 5 && fErrors.program) fieldHasError = true;
            if (C === 6 && fErrors.department) fieldHasError = true;
            if (C === 7 && fErrors.semester) fieldHasError = true;
            
            if (fieldHasError) {
              cell.s = {
                fill: { fgColor: { rgb: "FFC7CE" } },
                font: { color: { rgb: "9C0006" } },
                alignment: { horizontal: "left", vertical: "center" }
              };
            } else if (C === 8) {
              cell.s = {
                alignment: { wrapText: true, vertical: "top" },
                font: { color: { rgb: "9C0006" } }
              };
            } else {
              cell.s = {
                alignment: { vertical: "center" }
              };
            }
          }
        }
      }
      
      const colWidths = [];
      for (let C = 0; C <= range.e.c; ++C) {
        let maxLen = 10;
        for (let R = 1; R <= range.e.r; ++R) {
          const cell_ref = XLSX.utils.encode_cell({ c: C, r: R });
          const cell = sheet[cell_ref];
          if (cell && cell.v) {
            const valStr = String(cell.v);
            const lines = valStr.split('\n');
            const longestLine = Math.max(...lines.map(l => l.length));
            if (longestLine > maxLen) {
              maxLen = longestLine;
            }
          }
        }
        colWidths.push({ wch: Math.min(maxLen + 4, 50) });
      }
      sheet['!cols'] = colWidths;
      
      sheet['!views'] = [
        { state: 'frozen', ySplit: 2, activePane: 'bottomLeft', pane: { xSplit: 0, ySplit: 2, topLeftCell: 'A3', activePane: 'bottomLeft' } }
      ];
      
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, 'Error Report');
      
      XLSX.writeFile(workbook, `Bulk_Upload_Error_Report_${timestampDate}.xlsx`);
      
      toast.success({
        title: 'Export complete',
        message: 'Downloaded error report Excel sheet.'
      });
    } catch (err) {
      console.error('Error exporting report:', err);
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
  }  function processParsedRows(rows) {
    if (!rows.length) {
      throw new Error('The uploaded file is empty.');
    }
    
    const aliasesMap = {
      fullName: ['fullname', 'name', 'studentname', 'fullName', 'full name', 'student name'],
      email: ['email', 'emailaddress', 'mail', 'email address', 'email id', 'emailid', 'student email', 'studentemail'],
      enrollmentNo: ['enrollmentno', 'enrollmentnumber', 'enrollment', 'enrollment no', 'enrollment number', 'enroll no', 'enrollno', 'student enrollment number', 'student enrollment no', 'studentenrollmentno', 'studentenrollmentnumber'],
      phone: ['phone', 'phonenumber', 'contact', 'phone number', 'contact number', 'mobile', 'mobile number', 'student phone number', 'studentphonenumber', 'student phone', 'studentphone'],
      program: ['program', 'course', 'degree', 'stream', 'student program', 'studentprogram'],
      department: ['department', 'branch', 'dept', 'specialization', 'student department', 'studentdepartment'],
      semester: ['semester', 'sem', 'current semester', 'current sem', 'student semester', 'studentsemester']
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
      const fieldErrors = {
        fullName: null,
        email: null,
        enrollmentNumber: null,
        phoneNumber: null,
        program: null,
        department: null,
        semester: null
      };

      if (!student.fullName) {
        fieldErrors.fullName = 'Full Name is required';
        errors.push('Full Name is required');
      }
      if (!student.email) {
        fieldErrors.email = 'Email is required';
        errors.push('Email is required');
      }

      if (!student.phone) {
        fieldErrors.phoneNumber = 'Phone Number is required';
        errors.push('Phone Number is required');
      }
      if (!student.semester) {
        fieldErrors.semester = 'Semester is required';
        errors.push('Semester is required');
      }
      
      const checkMerge = (val) => String(val || '').includes(',');
      if (checkMerge(student.fullName)) {
        fieldErrors.fullName = 'Multiple students detected in one row — split into separate rows';
        errors.push('Full Name: Multiple students detected in one row — split into separate rows');
      }
      if (checkMerge(student.email)) {
        fieldErrors.email = 'Multiple students detected in one row — split into separate rows';
        errors.push('Email: Multiple students detected in one row — split into separate rows');
      }
      if (checkMerge(student.enrollmentNo)) {
        fieldErrors.enrollmentNumber = 'Multiple students detected in one row — split into separate rows';
        errors.push('Enrollment Number: Multiple students detected in one row — split into separate rows');
      }
      if (checkMerge(student.phone)) {
        fieldErrors.phoneNumber = 'Multiple students detected in one row — split into separate rows';
        errors.push('Phone Number: Multiple students detected in one row — split into separate rows');
      }

      if (student.email && !fieldErrors.email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(student.email)) {
          fieldErrors.email = 'Malformed email address';
          errors.push('Malformed email address');
        }
      }

      if (student.enrollmentNo && !fieldErrors.enrollmentNumber) {
        const enrollRegex = /^[a-z0-9-]{3,20}$/i;
        if (!enrollRegex.test(student.enrollmentNo)) {
          fieldErrors.enrollmentNumber = 'Enrollment number does not match expected format';
          errors.push('Enrollment number does not match expected format');
        }
      }

      if (student.phone && !fieldErrors.phoneNumber) {
        const cleanPhone = student.phone.replace(/[^0-9]/g, '');
        if (cleanPhone.length !== 10) {
          fieldErrors.phoneNumber = 'Phone number must be exactly 10 digits';
          errors.push('Phone number must be exactly 10 digits');
        }
      }

      if (!resolvedProgram.canonical && !fieldErrors.program) {
        fieldErrors.program = resolvedProgram.error || 'Program is required';
        errors.push(resolvedProgram.error || 'Program is required');
      }
      if (!resolvedDept.canonical && !fieldErrors.department) {
        fieldErrors.department = resolvedDept.error || 'Department is required';
        errors.push(resolvedDept.error || 'Department is required');
      }
      
      let semesterNumber = null;
      if (student.semester) {
        const semClean = String(student.semester).replace(/[^0-9]/g, '');
        semesterNumber = Number(semClean);
      }
      if (!semesterNumber || isNaN(semesterNumber) || semesterNumber < 1 || semesterNumber > 8) {
        if (!fieldErrors.semester) {
          fieldErrors.semester = 'Semester must be 1 to 8';
          errors.push('Semester must be 1 to 8');
        }
      } else {
        student.semester = semesterNumber;
      }

      if (!student.enrollmentNo) {
        const isSem1 = semesterNumber === 1;
        const progLower = String(resolvedProgram.canonical || '').toLowerCase();
        const isSem3DToD = semesterNumber === 3 && (progLower.includes('degree') || progLower.includes('d to d') || progLower.includes('dtd') || progLower.includes('d2d'));
        const isEligibleForTemp = isSem1 || isSem3DToD;

        if (!isEligibleForTemp) {
          fieldErrors.enrollmentNumber = 'Enrollment Number is required';
          errors.push('Enrollment Number is required');
        }
      }
      
      const emailLower = (student.email || '').toLowerCase();
      const enrollmentLower = (student.enrollmentNo || '').toLowerCase();
      
      if (student.email && !fieldErrors.email) {
        if (fileEmails.has(emailLower)) {
          fieldErrors.email = `Duplicate email "${student.email}" in file`;
          errors.push(`Duplicate email "${student.email}" in file`);
        } else {
          fileEmails.add(emailLower);
        }
      }
      if (student.phone && !fieldErrors.phoneNumber) {
        if (filePhones.has(student.phone)) {
          fieldErrors.phoneNumber = `Duplicate phone number "${student.phone}" in file`;
          errors.push(`Duplicate phone number "${student.phone}" in file`);
        } else {
          filePhones.add(student.phone);
        }
      }
      if (student.enrollmentNo && !fieldErrors.enrollmentNumber) {
        if (fileEnrollments.has(enrollmentLower)) {
          fieldErrors.enrollmentNumber = `Duplicate enrollment number "${student.enrollmentNo}" in file`;
          errors.push(`Duplicate enrollment number "${student.enrollmentNo}" in file`);
        } else {
          fileEnrollments.add(enrollmentLower);
        }
      }
      
      student.validationErrors = errors;
      student.fieldErrors = fieldErrors;
      return student;
    });
    
    setBulkStudents(mapped);
    toast.success({
      title: 'File parsed',
      message: `Found ${mapped.length} student records in the file.`
    });
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
    setBulkFileName(name);
    setBulkLoading(true);
    setBulkResult(null);
    
    const isCsv = ext === 'csv';
    
    if (isCsv) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const csvText = e.target.result;
          const papaResult = Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (header) => header.trim(),
            dynamicTyping: false
          });
          
          const rows = papaResult.data;
          
          // Temporary console.log as requested by the user
          console.log('[DwarPal CSV Parse] First parsed row (before validation):', rows[0]);
          
          processParsedRows(rows);
        } catch (err) {
          console.error(err);
          toast.error({
            title: 'CSV Parsing Failed',
            message: err.message || 'Check the file format.'
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
      reader.readAsText(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
          
          // Temporary console.log for XLSX
          console.log('[DwarPal Excel Parse] First parsed row (before validation):', rows[0]);
          
          processParsedRows(rows);
        } catch (err) {
          console.error(err);
          toast.error({
            title: 'Excel Parsing Failed',
            message: err.message || 'Check the file format.'
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
  }

  async function handleBulkSubmit(event) {
    if (event) event.preventDefault();
    if (bulkLoading || !bulkStudents.length) return;
    
    // Filter the parsed preview rows to only those with no validationErrors (status === 'Ready')
    const readyRows = bulkStudents.filter(s => !s.validationErrors || s.validationErrors.length === 0);
    if (readyRows.length === 0) return;
    
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
        toast.warning({
          title: 'Some entries rejected',
          message: `${rejectedCount} row(s) had errors and were not registered. Check Error History tab to download.`
        });
        // Persist the error log so it is available even after navigating away
        const currentFileName = bulkFileName || bulkFile?.name || 'Unknown file';
        const fileExt = currentFileName.split('.').pop().toLowerCase();
        saveAndRefresh({
          type: fileExt === 'csv' ? 'bulk_csv' : 'bulk_excel',
          fileName: currentFileName,
          errorCount: rejectedCount,
          addedCount,
          rejectedRows: finalResult.rejected,
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
  const [autoGenerateEnrollment, setAutoGenerateEnrollment] = useState(false)
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
    setAutoGenerateEnrollment(false)
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
    setAutoGenerateEnrollment(false)
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
      const payload = { ...form }
      if (!isEditMode && autoGenerateEnrollment) {
        payload.enrollmentNo = ''
      }

      if (isEditMode) {
        await updateAdminStudent(editingStudent.id, payload)
        toast.success({
          title: 'Student updated',
          message: 'Student details were updated successfully.',
        })
      } else {
        await createAdminStudent(payload)
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
      const reducedFieldErrors = apiFieldErrors.reduce((result, item) => {
        if (item?.field) {
          result[item.field] = item.message
        }
        return result
      }, {})
      setFieldErrors(reducedFieldErrors)

      // Persist the failed single-form submission to error history (IT role only)
      if (currentUser?.role === 'it' && !isEditMode) {
        const rejectedRow = {
          rowNumber: 1,
          originalData: {
            fullName: form.fullName || '',
            email: form.email || '',
            enrollmentNo: form.enrollmentNo || '',
            phone: form.phone || '',
            program: form.program || '',
            department: form.department || '',
            semester: form.semester || '',
          },
          reasons: [message],
          fieldErrors: reducedFieldErrors,
        };
        saveAndRefresh({
          type: 'single_form',
          fileName: 'Manual Form',
          errorCount: 1,
          addedCount: 0,
          rejectedRows: [rejectedRow],
        });
      }
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
          <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--app-surface-border)', marginBottom: '1.5rem', paddingBottom: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => handleTabChange('single')}
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
              onClick={() => handleTabChange('bulk')}
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
            <button
              type="button"
              onClick={() => handleTabChange('error_history')}
              style={{
                background: 'none',
                border: 'none',
                padding: '0.5rem 1rem',
                fontWeight: '600',
                color: activeTab === 'error_history' ? 'var(--app-text-accent)' : 'var(--app-text-muted)',
                borderBottom: activeTab === 'error_history' ? '2px solid var(--app-text-accent)' : 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                position: 'relative'
              }}
            >
              <History size={15} />
              Upload Error History
              {unseenCount > 0 && (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: '18px',
                  height: '18px',
                  padding: '0 4px',
                  background: '#ef4444',
                  color: '#fff',
                  borderRadius: '999px',
                  fontSize: '0.65rem',
                  fontWeight: '700',
                  lineHeight: 1,
                }}>
                  {unseenCount > 9 ? '9+' : unseenCount}
                </span>
              )}
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
                  autoGenerateEnrollment={autoGenerateEnrollment}
                  setAutoGenerateEnrollment={setAutoGenerateEnrollment}
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
          ) : activeTab === 'error_history' ? (
            /* ── Error History Panel ─────────────────────────────────────────── */
            <div style={{ paddingBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div>
                  <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: '600', color: 'var(--app-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Persistent Log</p>
                  <h3 style={{ margin: '0.2rem 0 0', fontSize: '1.1rem', fontWeight: '700', color: 'var(--app-text)' }}>Upload Error History</h3>
                  <p style={{ margin: '0.3rem 0 0', fontSize: '0.82rem', color: 'var(--app-text-muted)' }}>All past rejected rows from bulk uploads and single-form failures. Persisted across sessions.</p>
                </div>
                {errorHistory.length > 0 && (
                  <button
                    type="button"
                    onClick={clearAllHistory}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.9rem', background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', fontSize: '0.78rem', fontWeight: '600', cursor: 'pointer' }}
                  >
                    <Trash size={13} />
                    Clear All
                  </button>
                )}
              </div>

              {errorHistory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3.5rem 2rem', background: 'var(--app-surface)', border: '1px dashed var(--app-surface-border)', borderRadius: '16px', color: 'var(--app-text-muted)' }}>
                  <FileWarning size={40} strokeWidth={1.2} style={{ opacity: 0.35, marginBottom: '0.75rem' }} />
                  <p style={{ margin: 0, fontWeight: '600', fontSize: '0.95rem' }}>No error history yet</p>
                  <p style={{ margin: '0.4rem 0 0', fontSize: '0.82rem' }}>When bulk uploads or single-form submissions are rejected, error logs will appear here for download.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {errorHistory.map((entry) => {
                    const ts = new Date(entry.timestamp);
                    const dateStr = ts.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                    const timeStr = ts.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

                    const typeMeta = {
                      bulk_csv: { label: 'Bulk CSV', color: '#7c3aed', bg: 'rgba(124,58,237,0.08)', border: 'rgba(124,58,237,0.18)' },
                      bulk_excel: { label: 'Bulk Excel', color: '#0369a1', bg: 'rgba(3,105,161,0.08)', border: 'rgba(3,105,161,0.18)' },
                      single_form: { label: 'Single Form', color: '#b45309', bg: 'rgba(180,83,9,0.08)', border: 'rgba(180,83,9,0.18)' },
                    }[entry.type] || { label: entry.type, color: 'var(--app-text-muted)', bg: 'var(--app-surface)', border: 'var(--app-surface-border)' };

                    return (
                      <div
                        key={entry.id}
                        style={{
                          background: 'var(--app-surface)',
                          border: '1px solid var(--app-surface-border)',
                          borderRadius: '14px',
                          padding: '1rem 1.25rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '1rem',
                          flexWrap: 'wrap',
                        }}
                      >
                        {/* Type Badge */}
                        <span style={{ padding: '0.25rem 0.7rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: '700', background: typeMeta.bg, color: typeMeta.color, border: `1px solid ${typeMeta.border}`, whiteSpace: 'nowrap', flexShrink: 0 }}>
                          {typeMeta.label}
                        </span>

                        {/* Timestamp */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--app-text-muted)', fontSize: '0.8rem', flexShrink: 0 }}>
                          <Clock size={13} />
                          <span>{dateStr} · {timeStr}</span>
                        </div>

                        {/* File name */}
                        <div style={{ flex: 1, minWidth: '120px' }}>
                          <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: '600', color: 'var(--app-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {entry.fileName || 'Unknown source'}
                          </p>
                        </div>

                        {/* Counts */}
                        <div style={{ display: 'flex', gap: '0.75rem', flexShrink: 0 }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: '600', color: '#ef4444', background: 'rgba(239,68,68,0.07)', padding: '0.2rem 0.6rem', borderRadius: '6px' }}>
                            {entry.errorCount} error{entry.errorCount !== 1 ? 's' : ''}
                          </span>
                          {entry.addedCount > 0 && (
                            <span style={{ fontSize: '0.8rem', fontWeight: '600', color: '#16a34a', background: 'rgba(22,163,74,0.07)', padding: '0.2rem 0.6rem', borderRadius: '6px' }}>
                              {entry.addedCount} added
                            </span>
                          )}
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                          <button
                            type="button"
                            onClick={() => downloadHistoryEntry(entry)}
                            title="Download error report as Excel"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.85rem', background: 'var(--app-primary)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.78rem', fontWeight: '600', cursor: 'pointer' }}
                          >
                            <Download size={13} />
                            Download
                          </button>
                          <button
                            type="button"
                            onClick={() => removeHistoryEntry(entry.id)}
                            title="Remove this entry"
                            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', background: 'rgba(239,68,68,0.07)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '8px', cursor: 'pointer' }}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: 'rgba(239, 68, 68, 0.04)', border: '1px solid rgba(239, 68, 68, 0.08)', padding: '0.85rem 1rem', borderRadius: '10px', marginBottom: '1.5rem', color: 'var(--danger)', fontSize: '0.8rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
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
                      <button
                        type="button"
                        onClick={downloadRejectedRows}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          padding: '0.4rem 0.8rem',
                          background: 'var(--danger)',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          cursor: 'pointer',
                          marginLeft: '1rem',
                          flexShrink: 0
                        }}
                      >
                        <Download size={14} />
                        <span>Download Error Report</span>
                      </button>
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
                      disabled={bulkLoading || bulkStudents.filter(s => !s.validationErrors || s.validationErrors.length === 0).length === 0}
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
            autoGenerateEnrollment={autoGenerateEnrollment}
            setAutoGenerateEnrollment={setAutoGenerateEnrollment}
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
