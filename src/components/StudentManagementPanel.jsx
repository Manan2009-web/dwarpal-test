import { useEffect, useMemo, useState } from 'react'
import { Download, KeyRound, PencilLine, Plus, ShieldCheck, Trash2, UserRoundPlus } from 'lucide-react'
import {
  createAdminStudent,
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
        <section className="admin-wide-panel student-management-panel" style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div className="admin-panel-heading" style={{ marginBottom: '1.5rem' }}>
            <div>
              <p className="admin-eyebrow">IT Student Management</p>
              <h2>Register New Student</h2>
              <span>Input student details below to generate temporary credentials and create the account.</span>
            </div>
          </div>

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
              <Download size={16} />
              <span>{exporting ? 'Exporting...' : 'Export Student Credentials'}</span>
            </button>
            {!isItAdmin ? (
              <button type="button" className="admin-primary-button inline" onClick={openCreateModal}>
                <Plus size={16} />
                <span>Add New Student</span>
              </button>
            ) : null}
          </div>
        </div>

        <div className="admin-stat-grid compact">
          <article className="admin-stat-card">
            <div className="admin-stat-icon">
              <UserRoundPlus size={18} />
            </div>
            <div>
              <p>Total Students</p>
              <strong>{studentStats.total}</strong>
            </div>
          </article>
          <article className="admin-stat-card success">
            <div className="admin-stat-icon">
              <ShieldCheck size={18} />
            </div>
            <div>
              <p>Visible Rows</p>
              <strong>{studentStats.visible}</strong>
            </div>
          </article>
          <article className="admin-stat-card warning">
            <div className="admin-stat-icon">
              <KeyRound size={18} />
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
                          <PencilLine size={15} />
                          <span>Edit</span>
                        </button>
                        <button type="button" className="admin-text-button danger" onClick={() => setDeleteTarget(student)}>
                          <Trash2 size={15} />
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
            <ActionButton type="submit" icon={isEditMode ? PencilLine : Plus} disabled={submitting} aria-busy={submitting}>
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
