import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Plus, Send, Trash2 } from 'lucide-react'
import { ActionButton, ModalForm, SelectField } from './ui'

const REQUIRED_FIELD_MESSAGE = 'Please fill this field'
const STEP_TITLES = ['Faculty & Leave Details', 'Applicant Declaration', 'Short Leave Application']

function getTodayInputValue() {
  return new Date().toISOString().slice(0, 10)
}

function createWorkloadRow() {
  return {
    date: '',
    time: '',
    subjectOrCourseCode: '',
    classOrSemester: '',
    adjustedFacultyName: '',
    adjustedFacultySignature: '',
  }
}

function buildInitialForm(currentUser) {
  const facultyName = currentUser?.name || ''
  const employeeId = currentUser?.employeeId || ''
  const department = currentUser?.department || ''
  const designation = 'Faculty'

  return {
    facultyDetails: {
      name: facultyName,
      employeeId,
      designation,
      department,
      contactNumber: currentUser?.phone || '',
      emailId: currentUser?.email || '',
    },
    leaveDetails: {
      leaveType: '',
      leaveTypeOther: '',
      reason: '',
      leaveFrom: '',
      leaveTo: '',
      totalDays: '',
    },
    workloadAdjustments: [createWorkloadRow()],
    workloadDeclarations: {
      lecturesAdjustedConfirmed: false,
      noAcademicLossConfirmed: false,
    },
    declaration: {
      confirmed: false,
      declarationDate: getTodayInputValue(),
      digitalAcknowledgmentName: facultyName,
    },
    shortLeave: {
      staffMemberName: facultyName,
      designation,
      department,
      instituteName: '',
      employeeId,
      leaveDate: '',
      requestedFrom: '',
      requestedTo: '',
      totalDurationMinutes: '',
      reason: '',
      applicantConfirmed: false,
      applicationDate: getTodayInputValue(),
      digitalSignatureName: facultyName,
    },
  }
}

function isBlank(value) {
  return typeof value === 'string' ? value.trim() === '' : value === undefined || value === null || value === ''
}

function isValidDateValue(value) {
  if (!value) return false
  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp)
}

function calculateTotalDays(leaveFrom, leaveTo) {
  if (!isValidDateValue(leaveFrom) || !isValidDateValue(leaveTo)) {
    return ''
  }

  const startDate = new Date(leaveFrom)
  const endDate = new Date(leaveTo)

  if (endDate < startDate) {
    return ''
  }

  const diffMs = endDate.setHours(0, 0, 0, 0) - startDate.setHours(0, 0, 0, 0)
  return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1
}

function calculateDurationMinutes(fromTime, toTime) {
  if (!fromTime || !toTime) {
    return ''
  }

  const [fromHours = '0', fromMinutes = '0'] = fromTime.split(':')
  const [toHours = '0', toMinutes = '0'] = toTime.split(':')
  const start = Number(fromHours) * 60 + Number(fromMinutes)
  const end = Number(toHours) * 60 + Number(toMinutes)

  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return ''
  }

  return end - start
}

function formatDurationLabel(totalMinutes) {
  const minutes = Number(totalMinutes)

  if (!Number.isFinite(minutes) || minutes <= 0) {
    return ''
  }

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  const parts = []

  if (hours) parts.push(`${hours} hour${hours === 1 ? '' : 's'}`)
  if (remainingMinutes) parts.push(`${remainingMinutes} minute${remainingMinutes === 1 ? '' : 's'}`)

  return parts.join(' ')
}

function FieldLabel({ children, required = false }) {
  return (
    <span className="field-label">
      <span className="field-label-text">{children}</span>
      {required ? (
        <span className="required-indicator" aria-hidden="true">
          *
        </span>
      ) : null}
    </span>
  )
}

export default function FacultyLeaveWizard({ open, currentUser, onClose, onSubmit }) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState(() => buildInitialForm(currentUser))
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const wasOpenRef = useRef(false)
  const currentUserKey = currentUser?.id || currentUser?.employeeId || currentUser?.name || ''

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false
      return
    }

    if (wasOpenRef.current) {
      return
    }

    setStep(1)
    setForm(buildInitialForm(currentUser))
    setErrors({})
    setSubmitError('')
    setIsSubmitting(false)
    wasOpenRef.current = true
  }, [open, currentUser, currentUserKey])

  const computedTotalDays = useMemo(
    () => calculateTotalDays(form.leaveDetails.leaveFrom, form.leaveDetails.leaveTo),
    [form.leaveDetails.leaveFrom, form.leaveDetails.leaveTo],
  )

  const computedShortLeaveDuration = useMemo(
    () => calculateDurationMinutes(form.shortLeave.requestedFrom, form.shortLeave.requestedTo),
    [form.shortLeave.requestedFrom, form.shortLeave.requestedTo],
  )

  useEffect(() => {
    setForm((prev) => {
      const nextTotalDays = computedTotalDays || ''
      if (prev.leaveDetails.totalDays === nextTotalDays) {
        return prev
      }

      return {
        ...prev,
        leaveDetails: {
          ...prev.leaveDetails,
          totalDays: nextTotalDays,
        },
      }
    })
  }, [computedTotalDays])

  useEffect(() => {
    setForm((prev) => {
      const nextDuration = computedShortLeaveDuration || ''
      if (prev.shortLeave.totalDurationMinutes === nextDuration) {
        return prev
      }

      return {
        ...prev,
        shortLeave: {
          ...prev.shortLeave,
          totalDurationMinutes: nextDuration,
        },
      }
    })
  }, [computedShortLeaveDuration])

  function clearError(path) {
    setErrors((prev) => {
      if (!prev[path]) return prev

      const nextErrors = { ...prev }
      delete nextErrors[path]
      return nextErrors
    })
  }

  function getFieldClass(path) {
    return errors[path] ? 'field-invalid' : ''
  }

  function updateNestedSection(section, field, value) {
    setForm((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }))
    clearError(`${section}.${field}`)
    setSubmitError('')
  }

  function updateWorkloadRow(index, field, value) {
    setForm((prev) => ({
      ...prev,
      workloadAdjustments: prev.workloadAdjustments.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              [field]: value,
            }
          : row,
      ),
    }))
    clearError(`workloadAdjustments.${index}.${field}`)
    clearError('workloadAdjustments')
    setSubmitError('')
  }

  function addWorkloadRow() {
    setForm((prev) => ({
      ...prev,
      workloadAdjustments: [...prev.workloadAdjustments, createWorkloadRow()],
    }))
    clearError('workloadAdjustments')
  }

  function removeWorkloadRow(index) {
    setForm((prev) => ({
      ...prev,
      workloadAdjustments: prev.workloadAdjustments.filter((_, rowIndex) => rowIndex !== index),
    }))
    setErrors((prev) => {
      const nextErrors = {}

      Object.entries(prev).forEach(([path, message]) => {
        if (!path.startsWith('workloadAdjustments.')) {
          nextErrors[path] = message
          return
        }

        const [, errorIndex, ...rest] = path.split('.')
        const parsedIndex = Number(errorIndex)

        if (parsedIndex < index) {
          nextErrors[path] = message
        } else if (parsedIndex > index) {
          nextErrors[`workloadAdjustments.${parsedIndex - 1}.${rest.join('.')}`] = message
        }
      })

      return nextErrors
    })
  }

  function validateStep1() {
    const nextErrors = {}

    ;['name', 'employeeId', 'designation', 'department', 'contactNumber', 'emailId'].forEach((field) => {
      if (isBlank(form.facultyDetails[field])) {
        nextErrors[`facultyDetails.${field}`] = REQUIRED_FIELD_MESSAGE
      }
    })

    if (isBlank(form.leaveDetails.leaveType)) {
      nextErrors['leaveDetails.leaveType'] = 'Please select leave type'
    }

    if (form.leaveDetails.leaveType === 'Others' && isBlank(form.leaveDetails.leaveTypeOther)) {
      nextErrors['leaveDetails.leaveTypeOther'] = REQUIRED_FIELD_MESSAGE
    }

    if (isBlank(form.leaveDetails.reason)) {
      nextErrors['leaveDetails.reason'] = REQUIRED_FIELD_MESSAGE
    }

    if (!isValidDateValue(form.leaveDetails.leaveFrom)) {
      nextErrors['leaveDetails.leaveFrom'] = 'Please choose a valid date'
    }

    if (!isValidDateValue(form.leaveDetails.leaveTo)) {
      nextErrors['leaveDetails.leaveTo'] = 'Please choose a valid date'
    }

    if (
      isValidDateValue(form.leaveDetails.leaveFrom) &&
      isValidDateValue(form.leaveDetails.leaveTo) &&
      new Date(form.leaveDetails.leaveTo) < new Date(form.leaveDetails.leaveFrom)
    ) {
      nextErrors['leaveDetails.leaveTo'] = 'End date cannot be before start date'
    }

    if (!computedTotalDays) {
      nextErrors['leaveDetails.totalDays'] = 'Please choose a valid date'
    }

    if (!form.workloadAdjustments.length) {
      nextErrors.workloadAdjustments = 'Please add at least one workload adjustment row'
    }

    form.workloadAdjustments.forEach((row, index) => {
      ;['date', 'time', 'subjectOrCourseCode', 'classOrSemester', 'adjustedFacultyName'].forEach((field) => {
        if (isBlank(row[field])) {
          nextErrors[`workloadAdjustments.${index}.${field}`] = REQUIRED_FIELD_MESSAGE
        }
      })

      if (row.date && !isValidDateValue(row.date)) {
        nextErrors[`workloadAdjustments.${index}.date`] = 'Please choose a valid date'
      }
    })

    if (!form.workloadDeclarations.lecturesAdjustedConfirmed) {
      nextErrors['workloadDeclarations.lecturesAdjustedConfirmed'] = 'Please confirm this checkbox'
    }

    if (!form.workloadDeclarations.noAcademicLossConfirmed) {
      nextErrors['workloadDeclarations.noAcademicLossConfirmed'] = 'Please confirm this checkbox'
    }

    return nextErrors
  }

  function validateStep2() {
    const nextErrors = {}

    if (!form.declaration.confirmed) {
      nextErrors['declaration.confirmed'] = 'Please confirm the declaration'
    }

    if (!isValidDateValue(form.declaration.declarationDate)) {
      nextErrors['declaration.declarationDate'] = 'Please choose a valid date'
    }

    if (isBlank(form.declaration.digitalAcknowledgmentName)) {
      nextErrors['declaration.digitalAcknowledgmentName'] = REQUIRED_FIELD_MESSAGE
    } else if (
      form.declaration.digitalAcknowledgmentName.trim().toLowerCase() !==
      form.facultyDetails.name.trim().toLowerCase()
    ) {
      nextErrors['declaration.digitalAcknowledgmentName'] = 'Please type your full name to confirm'
    }

    return nextErrors
  }

  function validateStep3() {
    const nextErrors = {}

    ;['staffMemberName', 'designation', 'department', 'instituteName', 'employeeId'].forEach((field) => {
      if (isBlank(form.shortLeave[field])) {
        nextErrors[`shortLeave.${field}`] = REQUIRED_FIELD_MESSAGE
      }
    })

    if (!isValidDateValue(form.shortLeave.leaveDate)) {
      nextErrors['shortLeave.leaveDate'] = 'Please choose a valid date'
    }

    if (isBlank(form.shortLeave.requestedFrom)) {
      nextErrors['shortLeave.requestedFrom'] = REQUIRED_FIELD_MESSAGE
    }

    if (isBlank(form.shortLeave.requestedTo)) {
      nextErrors['shortLeave.requestedTo'] = REQUIRED_FIELD_MESSAGE
    }

    if (!computedShortLeaveDuration) {
      nextErrors['shortLeave.totalDurationMinutes'] = 'End time must be after start time'
    }

    if (isBlank(form.shortLeave.reason)) {
      nextErrors['shortLeave.reason'] = REQUIRED_FIELD_MESSAGE
    }

    if (!form.shortLeave.applicantConfirmed) {
      nextErrors['shortLeave.applicantConfirmed'] = 'Please confirm the acknowledgment'
    }

    if (!isValidDateValue(form.shortLeave.applicationDate)) {
      nextErrors['shortLeave.applicationDate'] = 'Please choose a valid date'
    }

    if (isBlank(form.shortLeave.digitalSignatureName)) {
      nextErrors['shortLeave.digitalSignatureName'] = REQUIRED_FIELD_MESSAGE
    } else if (
      form.shortLeave.digitalSignatureName.trim().toLowerCase() !==
      form.shortLeave.staffMemberName.trim().toLowerCase()
    ) {
      nextErrors['shortLeave.digitalSignatureName'] = 'Please type your full name to acknowledge'
    }

    return nextErrors
  }

  function validateCurrentStep(currentStep) {
    if (currentStep === 1) return validateStep1()
    if (currentStep === 2) return validateStep2()
    return validateStep3()
  }

  function handleNext() {
    const nextErrors = validateCurrentStep(step)

    if (Object.keys(nextErrors).length) {
      setErrors((prev) => ({ ...prev, ...nextErrors }))
      return
    }

    setStep((prev) => Math.min(prev + 1, 3))
  }

  function handleBack() {
    setStep((prev) => Math.max(prev - 1, 1))
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const step1Errors = validateStep1()
    const step2Errors = validateStep2()
    const step3Errors = validateStep3()
    const nextErrors = {
      ...step1Errors,
      ...step2Errors,
      ...step3Errors,
    }

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      setStep(Object.keys(step1Errors).length ? 1 : Object.keys(step2Errors).length ? 2 : 3)
      return
    }

    setIsSubmitting(true)
    setSubmitError('')

    const result = await onSubmit({
      requestKind: 'faculty_leave',
      ...form,
      leaveDetails: {
        ...form.leaveDetails,
        totalDays: computedTotalDays,
      },
      shortLeave: {
        ...form.shortLeave,
        totalDurationMinutes: computedShortLeaveDuration,
      },
    })

    setIsSubmitting(false)

    if (!result?.ok) {
      setSubmitError(result?.error || 'Unable to submit the leave request right now.')
      return
    }

    onClose()
  }

  if (!open) {
    return null
  }

  return (
    <ModalForm
      open={open}
      title="Faculty Leave Application"
      subtitle={`Step ${step} of 3 - ${STEP_TITLES[step - 1]}`}
      onClose={isSubmitting ? undefined : onClose}
      className="faculty-leave-modal"
    >
      <form className="modal-form faculty-leave-wizard" onSubmit={handleSubmit} noValidate>
        <div className="wizard-stepper" aria-label="Faculty leave request steps">
          {STEP_TITLES.map((title, index) => {
            const stepNumber = index + 1
            const stepState = step === stepNumber ? 'current' : step > stepNumber ? 'complete' : 'upcoming'

            return (
              <div key={title} className={`wizard-step ${stepState}`}>
                <span className="wizard-step-count">{stepNumber}</span>
                <div>
                  <strong>{`Step ${stepNumber}`}</strong>
                  <p>{title}</p>
                </div>
              </div>
            )
          })}
        </div>

        {step === 1 ? (
          <>
            <section className="wizard-section">
              <div className="wizard-section-header">
                <h4>Faculty Details</h4>
              </div>
              <div className="wizard-grid wizard-grid-two">
                <label>
                  <FieldLabel required>Name</FieldLabel>
                  <input
                    type="text"
                    value={form.facultyDetails.name}
                    onChange={(event) => updateNestedSection('facultyDetails', 'name', event.target.value)}
                    className={getFieldClass('facultyDetails.name')}
                  />
                  {errors['facultyDetails.name'] ? <p className="field-error">{errors['facultyDetails.name']}</p> : null}
                </label>
                <label>
                  <FieldLabel required>Employee ID</FieldLabel>
                  <input
                    type="text"
                    value={form.facultyDetails.employeeId}
                    onChange={(event) => updateNestedSection('facultyDetails', 'employeeId', event.target.value)}
                    className={getFieldClass('facultyDetails.employeeId')}
                  />
                  {errors['facultyDetails.employeeId'] ? (
                    <p className="field-error">{errors['facultyDetails.employeeId']}</p>
                  ) : null}
                </label>
                <label>
                  <FieldLabel required>Designation</FieldLabel>
                  <input
                    type="text"
                    value={form.facultyDetails.designation}
                    onChange={(event) => updateNestedSection('facultyDetails', 'designation', event.target.value)}
                    className={getFieldClass('facultyDetails.designation')}
                  />
                  {errors['facultyDetails.designation'] ? (
                    <p className="field-error">{errors['facultyDetails.designation']}</p>
                  ) : null}
                </label>
                <label>
                  <FieldLabel required>Department</FieldLabel>
                  <input
                    type="text"
                    value={form.facultyDetails.department}
                    onChange={(event) => updateNestedSection('facultyDetails', 'department', event.target.value)}
                    className={getFieldClass('facultyDetails.department')}
                  />
                  {errors['facultyDetails.department'] ? (
                    <p className="field-error">{errors['facultyDetails.department']}</p>
                  ) : null}
                </label>
                <label>
                  <FieldLabel required>Contact Number</FieldLabel>
                  <input
                    type="tel"
                    value={form.facultyDetails.contactNumber}
                    onChange={(event) => updateNestedSection('facultyDetails', 'contactNumber', event.target.value)}
                    className={getFieldClass('facultyDetails.contactNumber')}
                  />
                  {errors['facultyDetails.contactNumber'] ? (
                    <p className="field-error">{errors['facultyDetails.contactNumber']}</p>
                  ) : null}
                </label>
                <label>
                  <FieldLabel required>Email ID</FieldLabel>
                  <input
                    type="email"
                    value={form.facultyDetails.emailId}
                    onChange={(event) => updateNestedSection('facultyDetails', 'emailId', event.target.value)}
                    className={getFieldClass('facultyDetails.emailId')}
                  />
                  {errors['facultyDetails.emailId'] ? (
                    <p className="field-error">{errors['facultyDetails.emailId']}</p>
                  ) : null}
                </label>
              </div>
            </section>

            <section className="wizard-section">
              <div className="wizard-section-header">
                <h4>Leave Details</h4>
              </div>
              <div className="wizard-grid wizard-grid-two">
                <label>
                  <FieldLabel required>Type of Leave</FieldLabel>
                  <SelectField
                    value={form.leaveDetails.leaveType}
                    onChange={(event) => updateNestedSection('leaveDetails', 'leaveType', event.target.value)}
                    className={getFieldClass('leaveDetails.leaveType')}
                  >
                    <option value="">Select leave type</option>
                    <option value="CL">CL</option>
                    <option value="EL">EL</option>
                    <option value="SL">SL</option>
                    <option value="LWP">LWP</option>
                    <option value="OD">OD</option>
                    <option value="Others">Others</option>
                  </SelectField>
                  {errors['leaveDetails.leaveType'] ? (
                    <p className="field-error">{errors['leaveDetails.leaveType']}</p>
                  ) : null}
                </label>
                {form.leaveDetails.leaveType === 'Others' ? (
                  <label>
                    <FieldLabel required>Specify Leave Type</FieldLabel>
                    <input
                      type="text"
                      value={form.leaveDetails.leaveTypeOther}
                      onChange={(event) => updateNestedSection('leaveDetails', 'leaveTypeOther', event.target.value)}
                      className={getFieldClass('leaveDetails.leaveTypeOther')}
                    />
                    {errors['leaveDetails.leaveTypeOther'] ? (
                      <p className="field-error">{errors['leaveDetails.leaveTypeOther']}</p>
                    ) : null}
                  </label>
                ) : null}
                <label className="wizard-grid-span">
                  <FieldLabel required>Reason for Leave</FieldLabel>
                  <textarea
                    rows={4}
                    value={form.leaveDetails.reason}
                    onChange={(event) => updateNestedSection('leaveDetails', 'reason', event.target.value)}
                    className={getFieldClass('leaveDetails.reason')}
                    placeholder="Briefly explain the reason for your leave"
                  />
                  {errors['leaveDetails.reason'] ? (
                    <p className="field-error">{errors['leaveDetails.reason']}</p>
                  ) : null}
                </label>
                <label>
                  <FieldLabel required>Leave From</FieldLabel>
                  <input
                    type="date"
                    value={form.leaveDetails.leaveFrom}
                    onChange={(event) => updateNestedSection('leaveDetails', 'leaveFrom', event.target.value)}
                    className={getFieldClass('leaveDetails.leaveFrom')}
                  />
                  {errors['leaveDetails.leaveFrom'] ? (
                    <p className="field-error">{errors['leaveDetails.leaveFrom']}</p>
                  ) : null}
                </label>
                <label>
                  <FieldLabel required>Leave To</FieldLabel>
                  <input
                    type="date"
                    value={form.leaveDetails.leaveTo}
                    onChange={(event) => updateNestedSection('leaveDetails', 'leaveTo', event.target.value)}
                    className={getFieldClass('leaveDetails.leaveTo')}
                  />
                  {errors['leaveDetails.leaveTo'] ? (
                    <p className="field-error">{errors['leaveDetails.leaveTo']}</p>
                  ) : null}
                </label>
                <label>
                  <FieldLabel required>Total No. of Days</FieldLabel>
                  <input type="text" value={computedTotalDays || ''} readOnly className={getFieldClass('leaveDetails.totalDays')} />
                  {errors['leaveDetails.totalDays'] ? (
                    <p className="field-error">{errors['leaveDetails.totalDays']}</p>
                  ) : null}
                </label>
              </div>
            </section>

            <section className="wizard-section">
              <div className="wizard-section-header">
                <h4>Academic Workload Adjustment (Mandatory)</h4>
                <p className="wizard-helper-text">
                  To ensure uninterrupted academic activities, the faculty must arrange lectures/practicals during the
                  leave period.
                </p>
              </div>

              <div className="wizard-repeatable-list">
                {form.workloadAdjustments.map((row, index) => (
                  <div key={`workload-${index}`} className="wizard-repeatable-card">
                    <div className="wizard-repeatable-head">
                      <strong>{`Adjustment Row ${index + 1}`}</strong>
                      {form.workloadAdjustments.length > 1 ? (
                        <button type="button" className="wizard-inline-button danger" onClick={() => removeWorkloadRow(index)}>
                          <Trash2 size={15} />
                          <span>Remove</span>
                        </button>
                      ) : null}
                    </div>
                    <div className="wizard-grid wizard-grid-three">
                      <label>
                        <FieldLabel required>Date</FieldLabel>
                        <input
                          type="date"
                          value={row.date}
                          onChange={(event) => updateWorkloadRow(index, 'date', event.target.value)}
                          className={getFieldClass(`workloadAdjustments.${index}.date`)}
                        />
                        {errors[`workloadAdjustments.${index}.date`] ? (
                          <p className="field-error">{errors[`workloadAdjustments.${index}.date`]}</p>
                        ) : null}
                      </label>
                      <label>
                        <FieldLabel required>Time</FieldLabel>
                        <input
                          type="text"
                          value={row.time}
                          onChange={(event) => updateWorkloadRow(index, 'time', event.target.value)}
                          className={getFieldClass(`workloadAdjustments.${index}.time`)}
                          placeholder="e.g. 10:00 AM"
                        />
                        {errors[`workloadAdjustments.${index}.time`] ? (
                          <p className="field-error">{errors[`workloadAdjustments.${index}.time`]}</p>
                        ) : null}
                      </label>
                      <label>
                        <FieldLabel required>Subject / Course Code</FieldLabel>
                        <textarea
                          rows={2}
                          value={row.subjectOrCourseCode}
                          onChange={(event) => updateWorkloadRow(index, 'subjectOrCourseCode', event.target.value)}
                          className={getFieldClass(`workloadAdjustments.${index}.subjectOrCourseCode`)}
                        />
                        {errors[`workloadAdjustments.${index}.subjectOrCourseCode`] ? (
                          <p className="field-error">{errors[`workloadAdjustments.${index}.subjectOrCourseCode`]}</p>
                        ) : null}
                      </label>
                      <label>
                        <FieldLabel required>Class / Semester</FieldLabel>
                        <input
                          type="text"
                          value={row.classOrSemester}
                          onChange={(event) => updateWorkloadRow(index, 'classOrSemester', event.target.value)}
                          className={getFieldClass(`workloadAdjustments.${index}.classOrSemester`)}
                        />
                        {errors[`workloadAdjustments.${index}.classOrSemester`] ? (
                          <p className="field-error">{errors[`workloadAdjustments.${index}.classOrSemester`]}</p>
                        ) : null}
                      </label>
                      <label>
                        <FieldLabel required>Adjusted Faculty Name</FieldLabel>
                        <input
                          type="text"
                          value={row.adjustedFacultyName}
                          onChange={(event) => updateWorkloadRow(index, 'adjustedFacultyName', event.target.value)}
                          className={getFieldClass(`workloadAdjustments.${index}.adjustedFacultyName`)}
                        />
                        {errors[`workloadAdjustments.${index}.adjustedFacultyName`] ? (
                          <p className="field-error">{errors[`workloadAdjustments.${index}.adjustedFacultyName`]}</p>
                        ) : null}
                      </label>
                      <label>
                        <FieldLabel>Signature of Adjusted Faculty</FieldLabel>
                        <input
                          type="text"
                          value={row.adjustedFacultySignature}
                          onChange={(event) => updateWorkloadRow(index, 'adjustedFacultySignature', event.target.value)}
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              <button type="button" className="wizard-inline-button" onClick={addWorkloadRow}>
                <Plus size={15} />
                <span>Add Another Adjustment Row</span>
              </button>
              {errors.workloadAdjustments ? <p className="field-error">{errors.workloadAdjustments}</p> : null}

              <div className="wizard-checkbox-stack">
                <label className="wizard-checkbox">
                  <input
                    type="checkbox"
                    checked={form.workloadDeclarations.lecturesAdjustedConfirmed}
                    onChange={(event) =>
                      updateNestedSection('workloadDeclarations', 'lecturesAdjustedConfirmed', event.target.checked)
                    }
                  />
                  <span>All lectures / practical / tutorials have been duly adjusted</span>
                </label>
                {errors['workloadDeclarations.lecturesAdjustedConfirmed'] ? (
                  <p className="field-error">{errors['workloadDeclarations.lecturesAdjustedConfirmed']}</p>
                ) : null}
                <label className="wizard-checkbox">
                  <input
                    type="checkbox"
                    checked={form.workloadDeclarations.noAcademicLossConfirmed}
                    onChange={(event) =>
                      updateNestedSection('workloadDeclarations', 'noAcademicLossConfirmed', event.target.checked)
                    }
                  />
                  <span>No academic loss to students</span>
                </label>
                {errors['workloadDeclarations.noAcademicLossConfirmed'] ? (
                  <p className="field-error">{errors['workloadDeclarations.noAcademicLossConfirmed']}</p>
                ) : null}
              </div>
            </section>
          </>
        ) : null}

        {step === 2 ? (
          <section className="wizard-section">
            <div className="wizard-section-header">
              <h4>Applicant Declaration</h4>
              <p className="wizard-helper-text">
                I hereby declare that the above information is true and correct. I have ensured proper academic workload
                adjustment during my leave period as per institutional norms.
              </p>
            </div>

            <div className="wizard-checkbox-stack">
              <label className="wizard-checkbox">
                <input
                  type="checkbox"
                  checked={form.declaration.confirmed}
                  onChange={(event) => updateNestedSection('declaration', 'confirmed', event.target.checked)}
                />
                <span>I confirm that the above information is true and correct.</span>
              </label>
              {errors['declaration.confirmed'] ? (
                <p className="field-error">{errors['declaration.confirmed']}</p>
              ) : null}
            </div>

            <div className="wizard-grid wizard-grid-two">
              <label>
                <FieldLabel required>Date</FieldLabel>
                <input
                  type="date"
                  value={form.declaration.declarationDate}
                  onChange={(event) => updateNestedSection('declaration', 'declarationDate', event.target.value)}
                  className={getFieldClass('declaration.declarationDate')}
                />
                {errors['declaration.declarationDate'] ? (
                  <p className="field-error">{errors['declaration.declarationDate']}</p>
                ) : null}
              </label>
              <label>
                <FieldLabel required>Faculty Signature / Digital Acknowledgment</FieldLabel>
                <input
                  type="text"
                  value={form.declaration.digitalAcknowledgmentName}
                  onChange={(event) => updateNestedSection('declaration', 'digitalAcknowledgmentName', event.target.value)}
                  className={getFieldClass('declaration.digitalAcknowledgmentName')}
                  placeholder="Type your full name"
                />
                {errors['declaration.digitalAcknowledgmentName'] ? (
                  <p className="field-error">{errors['declaration.digitalAcknowledgmentName']}</p>
                ) : null}
              </label>
            </div>
          </section>
        ) : null}

        {step === 3 ? (
          <section className="wizard-section">
            <div className="wizard-section-header">
              <h4>Leave Application - Short Leave</h4>
            </div>

            <div className="wizard-subsection">
              <h5>Personal Details</h5>
              <div className="wizard-grid wizard-grid-two">
                <label>
                  <FieldLabel required>Name of Staff Member</FieldLabel>
                  <input
                    type="text"
                    value={form.shortLeave.staffMemberName}
                    onChange={(event) => updateNestedSection('shortLeave', 'staffMemberName', event.target.value)}
                    className={getFieldClass('shortLeave.staffMemberName')}
                  />
                  {errors['shortLeave.staffMemberName'] ? (
                    <p className="field-error">{errors['shortLeave.staffMemberName']}</p>
                  ) : null}
                </label>
                <label>
                  <FieldLabel required>Designation</FieldLabel>
                  <input
                    type="text"
                    value={form.shortLeave.designation}
                    onChange={(event) => updateNestedSection('shortLeave', 'designation', event.target.value)}
                    className={getFieldClass('shortLeave.designation')}
                  />
                  {errors['shortLeave.designation'] ? (
                    <p className="field-error">{errors['shortLeave.designation']}</p>
                  ) : null}
                </label>
                <label>
                  <FieldLabel required>Department</FieldLabel>
                  <input
                    type="text"
                    value={form.shortLeave.department}
                    onChange={(event) => updateNestedSection('shortLeave', 'department', event.target.value)}
                    className={getFieldClass('shortLeave.department')}
                  />
                  {errors['shortLeave.department'] ? (
                    <p className="field-error">{errors['shortLeave.department']}</p>
                  ) : null}
                </label>
                <label>
                  <FieldLabel required>Name of Institute</FieldLabel>
                  <input
                    type="text"
                    value={form.shortLeave.instituteName}
                    onChange={(event) => updateNestedSection('shortLeave', 'instituteName', event.target.value)}
                    className={getFieldClass('shortLeave.instituteName')}
                  />
                  {errors['shortLeave.instituteName'] ? (
                    <p className="field-error">{errors['shortLeave.instituteName']}</p>
                  ) : null}
                </label>
                <label>
                  <FieldLabel required>Employee ID</FieldLabel>
                  <input
                    type="text"
                    value={form.shortLeave.employeeId}
                    onChange={(event) => updateNestedSection('shortLeave', 'employeeId', event.target.value)}
                    className={getFieldClass('shortLeave.employeeId')}
                  />
                  {errors['shortLeave.employeeId'] ? (
                    <p className="field-error">{errors['shortLeave.employeeId']}</p>
                  ) : null}
                </label>
              </div>
            </div>

            <div className="wizard-subsection">
              <h5>Leave Details</h5>
              <div className="wizard-grid wizard-grid-two">
                <label>
                  <FieldLabel required>Date of Leave</FieldLabel>
                  <input
                    type="date"
                    value={form.shortLeave.leaveDate}
                    onChange={(event) => updateNestedSection('shortLeave', 'leaveDate', event.target.value)}
                    className={getFieldClass('shortLeave.leaveDate')}
                  />
                  {errors['shortLeave.leaveDate'] ? (
                    <p className="field-error">{errors['shortLeave.leaveDate']}</p>
                  ) : null}
                </label>
                <label>
                  <FieldLabel required>Time of Leave Requested From</FieldLabel>
                  <input
                    type="time"
                    value={form.shortLeave.requestedFrom}
                    onChange={(event) => updateNestedSection('shortLeave', 'requestedFrom', event.target.value)}
                    className={getFieldClass('shortLeave.requestedFrom')}
                  />
                  {errors['shortLeave.requestedFrom'] ? (
                    <p className="field-error">{errors['shortLeave.requestedFrom']}</p>
                  ) : null}
                </label>
                <label>
                  <FieldLabel required>Time of Leave Requested To</FieldLabel>
                  <input
                    type="time"
                    value={form.shortLeave.requestedTo}
                    onChange={(event) => updateNestedSection('shortLeave', 'requestedTo', event.target.value)}
                    className={getFieldClass('shortLeave.requestedTo')}
                  />
                  {errors['shortLeave.requestedTo'] ? (
                    <p className="field-error">{errors['shortLeave.requestedTo']}</p>
                  ) : null}
                </label>
                <label>
                  <FieldLabel required>Total Duration (in hours/minutes)</FieldLabel>
                  <input
                    type="text"
                    value={formatDurationLabel(computedShortLeaveDuration)}
                    readOnly
                    className={getFieldClass('shortLeave.totalDurationMinutes')}
                  />
                  {errors['shortLeave.totalDurationMinutes'] ? (
                    <p className="field-error">{errors['shortLeave.totalDurationMinutes']}</p>
                  ) : null}
                </label>
                <label className="wizard-grid-span">
                  <FieldLabel required>Reason for Short Leave</FieldLabel>
                  <textarea
                    rows={4}
                    value={form.shortLeave.reason}
                    onChange={(event) => updateNestedSection('shortLeave', 'reason', event.target.value)}
                    className={getFieldClass('shortLeave.reason')}
                  />
                  {errors['shortLeave.reason'] ? (
                    <p className="field-error">{errors['shortLeave.reason']}</p>
                  ) : null}
                </label>
              </div>
            </div>

            <div className="wizard-subsection">
              <h5>Acknowledgment</h5>
              <div className="wizard-checkbox-stack">
                <label className="wizard-checkbox">
                  <input
                    type="checkbox"
                    checked={form.shortLeave.applicantConfirmed}
                    onChange={(event) => updateNestedSection('shortLeave', 'applicantConfirmed', event.target.checked)}
                  />
                  <span>I confirm that the short leave information provided above is correct.</span>
                </label>
                {errors['shortLeave.applicantConfirmed'] ? (
                  <p className="field-error">{errors['shortLeave.applicantConfirmed']}</p>
                ) : null}
              </div>
              <div className="wizard-grid wizard-grid-two">
                <label>
                  <FieldLabel required>Date of Application</FieldLabel>
                  <input
                    type="date"
                    value={form.shortLeave.applicationDate}
                    onChange={(event) => updateNestedSection('shortLeave', 'applicationDate', event.target.value)}
                    className={getFieldClass('shortLeave.applicationDate')}
                  />
                  {errors['shortLeave.applicationDate'] ? (
                    <p className="field-error">{errors['shortLeave.applicationDate']}</p>
                  ) : null}
                </label>
                <label>
                  <FieldLabel required>Faculty Name / Digital Signature</FieldLabel>
                  <input
                    type="text"
                    value={form.shortLeave.digitalSignatureName}
                    onChange={(event) => updateNestedSection('shortLeave', 'digitalSignatureName', event.target.value)}
                    className={getFieldClass('shortLeave.digitalSignatureName')}
                    placeholder="Type your full name"
                  />
                  {errors['shortLeave.digitalSignatureName'] ? (
                    <p className="field-error">{errors['shortLeave.digitalSignatureName']}</p>
                  ) : null}
                </label>
              </div>
            </div>
          </section>
        ) : null}

        {submitError ? <p className="form-error">{submitError}</p> : null}

        <div className="modal-actions wizard-actions">
          <ActionButton tone="secondary" type="button" onClick={step === 1 ? onClose : handleBack} disabled={isSubmitting}>
            {step === 1 ? (
              'Cancel'
            ) : (
              <>
                <ArrowLeft size={16} />
                <span>Previous</span>
              </>
            )}
          </ActionButton>
          {step < 3 ? (
            <ActionButton type="button" onClick={handleNext} disabled={isSubmitting}>
              <span>Next</span>
              <ArrowRight size={16} />
            </ActionButton>
          ) : (
            <ActionButton type="submit" icon={Send} disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Submit Leave Request'}
            </ActionButton>
          )}
        </div>
      </form>
    </ModalForm>
  )
}
