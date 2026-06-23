import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AppBrand from './AppBrand'
import { DEPARTMENTS } from '../mockData'
import { getApiErrorDetails, normalizePhoneNumberInput } from '../lib/dwarpalApi'
import { Eye, EyeOff } from 'lucide-react'

export default function Register({ onRegister }) {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '',
    email: '',
    program: '',
    department: '',
    enrollment: '',
    phone: '',
    role: '',
    semester: '', // kept in state for compatibility/reset
    password: '',
  })
  
  const [fieldErrors, setFieldErrors] = useState({})
  const [error, setError] = useState('')
  const [isRegistering, setIsRegistering] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Clear page errors on field input updates
  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setFieldErrors((prev) => {
      const next = { ...prev }
      delete next[field]
      return next
    })
    setError('')
  }

  // Handle input resetting & dependencies on role changes
  const handleRoleChange = (e) => {
    const nextRole = e.target.value
    setForm((prev) => ({
      ...prev,
      role: nextRole,
      program: '',
      department: '',
      enrollment: '',
      semester: '',
    }))
    setFieldErrors((prev) => {
      const nextErrors = { ...prev }
      delete nextErrors.role
      delete nextErrors.program
      delete nextErrors.department
      delete nextErrors.enrollment
      delete nextErrors.semester
      return nextErrors
    })
    setError('')
  }

  // Handle program dependency change
  const handleProgramChange = (e) => {
    const nextProgram = e.target.value
    setForm((prev) => ({
      ...prev,
      program: nextProgram,
      department: '',
    }))
    setFieldErrors((prev) => {
      const nextErrors = { ...prev }
      delete nextErrors.program
      delete nextErrors.department
      return nextErrors
    })
    setError('')
  }

  // Validate form inputs client-side
  const validateForm = () => {
    const errors = {}

    if (!form.name.trim()) {
      errors.name = 'Full Name is required'
    }

    if (!form.email.trim()) {
      errors.email = 'Email Address is required'
    } else if (!/\S+@\S+\.\S+/.test(form.email)) {
      errors.email = 'Please enter a valid email address'
    }

    if (!form.role) {
      errors.role = 'Please select a role'
    }

    // Program validation (required for HOD, Principal)
    const requiresProgram = form.role === 'hod' || form.role === 'principal'
    if (requiresProgram && !form.program) {
      errors.program = 'Program selection is required'
    }

    // Department validation (required for Faculty and HOD)
    const requiresDepartment = form.role === 'faculty' || form.role === 'hod'
    if (requiresDepartment) {
      if (form.role === 'hod' && !form.program) {
        errors.department = 'Please select a program first'
      } else if (!form.department) {
        errors.department = 'Department selection is required'
      }
    }

    if (!form.phone.trim()) {
      errors.phone = 'Phone Number is required'
    } else {
      const cleanPhone = normalizePhoneNumberInput(form.phone)
      if (!cleanPhone) {
        errors.phone = 'Please enter a valid phone number'
      }
    }

    if (!form.enrollment.trim()) {
      errors.enrollment = 'Employee ID is required'
    }

    if (!form.password) {
      errors.password = 'Password is required'
    } else if (form.password.length < 8) {
      errors.password = 'Password must be at least 8 characters'
    }

    return errors
  }

  // Handle registration form submit
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isRegistering) return

    const errors = validateForm()
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      setError('Please fix the errors below before submitting.')
      return
    }

    setIsRegistering(true)
    setError('')
    setFieldErrors({})

    const cleanPhone = normalizePhoneNumberInput(form.phone)
    const payload = {
      ...form,
      phone: cleanPhone,
    }

    try {
      // call the asynchronous onRegister prop
      const result = await onRegister(payload)

      if (result && result.ok === false) {
        setError(result.error || 'Unable to create your account right now.')
        if (result.fieldErrors) {
          setFieldErrors(result.fieldErrors)
        }
      } else {
        // Success
        setForm({
          name: '',
          email: '',
          program: '',
          department: '',
          enrollment: '',
          phone: '',
          role: '',
          semester: '',
          password: '',
        })
        navigate('/login', {
          replace: true,
          state: {
            authNotice: result?.message || 'Account created successfully. You can sign in now.',
          },
        })
      }
    } catch (err) {
      const errorDetails = getApiErrorDetails(err)
      setError(errorDetails.message || 'Unable to complete registration. Please try again.')
      if (errorDetails.fieldErrors) {
        setFieldErrors(errorDetails.fieldErrors)
      }
    } finally {
      setIsRegistering(false)
    }
  }

  // Helper variables for dynamic fields visibility
  const showProgram = form.role === 'hod' || form.role === 'principal'
  const showDepartment = form.role === 'faculty' || form.role === 'hod'
  const isProgramSelected = Boolean(form.program)
  const departmentDisabled = form.role === 'hod' && !isProgramSelected

  // Load appropriate department options based on role and program selection
  let departmentsToShow = []
  if (form.role === 'hod' && isProgramSelected) {
    departmentsToShow = DEPARTMENTS
  } else if (form.role === 'faculty') {
    departmentsToShow = DEPARTMENTS
  }

  return (
    <div className="auth-shell" style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>
      <div className="auth-background" aria-hidden="true">
        <div className="bg-orb bg-orb-left" />
        <div className="bg-orb bg-orb-right" />
        <div className="bg-grid" />
        
        <div className="floating-card building-card">
          <span className="floating-label">Campus Block</span>
          <div className="building-roof" />
          <div className="building-body">
            <span /><span /><span /><span /><span /><span />
          </div>
        </div>
        
        <div className="floating-card pass-card">
          <span className="floating-label">Gatepass</span>
          <div className="pass-lines">
            <span /><span /><span />
          </div>
          <div className="pass-badge" />
        </div>
        
        <div className="floating-card gate-card">
          <span className="floating-label">Security Gate</span>
          <div className="gate-frame">
            <span /><span /><span />
          </div>
        </div>
        
        <div className="floating-card path-card">
          <span className="floating-label">Campus Flow</span>
          <div className="path-lines">
            <span /><span />
          </div>
        </div>
      </div>

      <div className="auth-panel" style={{ zIndex: 10 }}>
        <div className="auth-copy">
          <div className="auth-brand-wrap">
            <AppBrand size="md" layout="stacked" centered />
          </div>
          <h2>Register</h2>
        </div>

        <form className="auth-form register-grid tw:grid" onSubmit={handleSubmit} noValidate>
          {/* Full Name */}
          <div className="full-span">
            <label htmlFor="name">
              <span className="field-label">
                Full Name
                <span style={{ color: 'var(--danger)' }}> *</span>
              </span>
            </label>
            <div className="tw:group tw:relative tw:mt-1.5">
              <div className="tw:absolute tw:inset-0 tw:rounded-xl tw:bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(227,239,251,0.72))]" />
              <input
                id="name"
                type="text"
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="Enter your full name"
                disabled={isRegistering}
                className={`tw:relative tw:w-full tw:h-12 tw:rounded-xl tw:border tw:bg-transparent tw:px-4 tw:py-3.5 tw:text-[0.98rem] tw:outline-none tw:transition tw:duration-200 ${
                  fieldErrors.name ? 'field-invalid' : ''
                }`}
              />
            </div>
            {fieldErrors.name && <p className="field-error">{fieldErrors.name}</p>}
          </div>

          {/* Email Address */}
          <div className="full-span">
            <label htmlFor="email">
              <span className="field-label">
                Email Address
                <span style={{ color: 'var(--danger)' }}> *</span>
              </span>
            </label>
            <div className="tw:group tw:relative tw:mt-1.5">
              <div className="tw:absolute tw:inset-0 tw:rounded-xl tw:bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(227,239,251,0.72))]" />
              <input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
                placeholder="Enter your email address"
                disabled={isRegistering}
                className={`tw:relative tw:w-full tw:h-12 tw:rounded-xl tw:border tw:bg-transparent tw:px-4 tw:py-3.5 tw:text-[0.98rem] tw:outline-none tw:transition tw:duration-200 ${
                  fieldErrors.email ? 'field-invalid' : ''
                }`}
              />
            </div>
            {fieldErrors.email && <p className="field-error">{fieldErrors.email}</p>}
          </div>

          {/* Role */}
          <div className={form.role ? 'tw:col-span-1' : 'full-span'}>
            <label htmlFor="role">
              <span className="field-label">
                Role
                <span style={{ color: 'var(--danger)' }}> *</span>
              </span>
            </label>
            <div className="tw:group tw:relative tw:mt-1.5">
              <div className="tw:absolute tw:inset-0 tw:rounded-xl tw:bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(227,239,251,0.72))]" />
              <select
                id="role"
                value={form.role}
                onChange={handleRoleChange}
                disabled={isRegistering}
                className={`tw:relative tw:w-full tw:h-12 tw:rounded-xl tw:border tw:bg-transparent tw:px-4 tw:py-3.5 tw:text-[0.98rem] tw:outline-none tw:transition tw:duration-200 ${
                  fieldErrors.role ? 'field-invalid' : ''
                }`}
              >
                <option value="" disabled>Select Role</option>
                <option value="faculty">Faculty</option>
                <option value="hod">HOD</option>
                <option value="cao">CAO</option>
                <option value="security">Security</option>
                <option value="principal">Principal</option>
              </select>
            </div>
            {fieldErrors.role && <p className="field-error">{fieldErrors.role}</p>}
          </div>

          {/* Phone Number */}
          <div className={form.role ? 'tw:col-span-1' : 'full-span'}>
            <label htmlFor="phone">
              <span className="field-label">
                Phone Number
                <span style={{ color: 'var(--danger)' }}> *</span>
              </span>
            </label>
            <div className="tw:group tw:relative tw:mt-1.5">
              <div className="tw:absolute tw:inset-0 tw:rounded-xl tw:bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(227,239,251,0.72))]" />
              <input
                id="phone"
                type="tel"
                value={form.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                placeholder="Enter phone number"
                disabled={isRegistering}
                className={`tw:relative tw:w-full tw:h-12 tw:rounded-xl tw:border tw:bg-transparent tw:px-4 tw:py-3.5 tw:text-[0.98rem] tw:outline-none tw:transition tw:duration-200 ${
                  fieldErrors.phone ? 'field-invalid' : ''
                }`}
              />
            </div>
            {fieldErrors.phone && <p className="field-error">{fieldErrors.phone}</p>}
          </div>

          {/* Program Select (Degree, Diploma) */}
          {showProgram && (
            <div className="full-span">
              <label htmlFor="program">
                <span className="field-label">
                  {form.role === 'principal' ? 'Program / Institution' : 'Program'}
                  <span style={{ color: 'var(--danger)' }}> *</span>
                </span>
              </label>
              <div className="tw:group tw:relative tw:mt-1.5">
                <div className="tw:absolute tw:inset-0 tw:rounded-xl tw:bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(227,239,251,0.72))]" />
                <select
                  id="program"
                  value={form.program}
                  onChange={handleProgramChange}
                  disabled={isRegistering}
                  className={`tw:relative tw:w-full tw:h-12 tw:rounded-xl tw:border tw:bg-transparent tw:px-4 tw:py-3.5 tw:text-[0.98rem] tw:outline-none tw:transition tw:duration-200 ${
                    fieldErrors.program ? 'field-invalid' : ''
                  }`}
                >
                  <option value="" disabled>Select Program</option>
                  <option value="Degree Engineering">Degree</option>
                  <option value="Diploma Engineering">Diploma</option>
                </select>
              </div>
              {fieldErrors.program && <p className="field-error">{fieldErrors.program}</p>}
            </div>
          )}

          {/* Department Select */}
          {showDepartment && (
            <div className="full-span">
              <label htmlFor="department">
                <span className="field-label">
                  Department
                  <span style={{ color: 'var(--danger)' }}> *</span>
                </span>
              </label>
              <div className="tw:group tw:relative tw:mt-1.5">
                <div className="tw:absolute tw:inset-0 tw:rounded-xl tw:bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(227,239,251,0.72))]" />
                <select
                  id="department"
                  value={form.department}
                  onChange={(e) => updateField('department', e.target.value)}
                  disabled={departmentDisabled || isRegistering}
                  className={`tw:relative tw:w-full tw:h-12 tw:rounded-xl tw:border tw:bg-transparent tw:px-4 tw:py-3.5 tw:text-[0.98rem] tw:outline-none tw:transition tw:duration-200 ${
                    fieldErrors.department ? 'field-invalid' : ''
                  }`}
                >
                  <option value="" disabled>
                    {departmentDisabled ? 'Select Program First' : 'Select Department'}
                  </option>
                  {departmentsToShow.map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
              {fieldErrors.department && <p className="field-error">{fieldErrors.department}</p>}
            </div>
          )}

          {/* Employee ID */}
          {form.role && (
            <div className="full-span">
              <label htmlFor="enrollment">
                <span className="field-label">
                  Employee ID
                  <span style={{ color: 'var(--danger)' }}> *</span>
                </span>
              </label>
              <div className="tw:group tw:relative tw:mt-1.5">
                <div className="tw:absolute tw:inset-0 tw:rounded-xl tw:bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(227,239,251,0.72))]" />
                <input
                  id="enrollment"
                  type="text"
                  value={form.enrollment}
                  onChange={(e) => updateField('enrollment', e.target.value)}
                  placeholder="Enter your employee ID"
                  disabled={isRegistering}
                  className={`tw:relative tw:w-full tw:h-12 tw:rounded-xl tw:border tw:bg-transparent tw:px-4 tw:py-3.5 tw:text-[0.98rem] tw:outline-none tw:transition tw:duration-200 ${
                    fieldErrors.enrollment ? 'field-invalid' : ''
                  }`}
                />
              </div>
              {fieldErrors.enrollment && <p className="field-error">{fieldErrors.enrollment}</p>}
            </div>
          )}

          {/* Password */}
          <div className="full-span">
            <label htmlFor="password">
              <span className="field-label">
                Password
                <span style={{ color: 'var(--danger)' }}> *</span>
              </span>
            </label>
            <div className="tw:group tw:relative tw:mt-1.5" style={{ position: 'relative' }}>
              <div className="tw:absolute tw:inset-0 tw:rounded-xl tw:bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(227,239,251,0.72))]" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => updateField('password', e.target.value)}
                placeholder="Create a strong password"
                disabled={isRegistering}
                className={`tw:relative tw:w-full tw:h-12 tw:rounded-xl tw:border tw:bg-transparent tw:px-4 tw:py-3.5 tw:pr-12 tw:text-[0.98rem] tw:outline-none tw:transition tw:duration-200 ${
                  fieldErrors.password ? 'field-invalid' : ''
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isRegistering}
                className="tw:absolute tw:right-3 tw:top-0 tw:bottom-0 tw:my-auto tw:grid tw:h-9 tw:w-9 tw:place-items-center tw:rounded-lg tw:border tw:border-[rgba(105,143,176,0.28)] tw:bg-[rgba(255,255,255,0.74)] tw:text-[#48637c] tw:transition tw:duration-200 hover:tw:bg-white hover:tw:text-[#2f6db5] focus-visible:tw:outline-none disabled:tw:cursor-not-allowed"
                style={{ zIndex: 10 }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {fieldErrors.password && <p className="field-error">{fieldErrors.password}</p>}
          </div>

          {/* Submission and Global Error */}
          <div className="full-span tw:mt-3">
            {error && (
              <p className="form-error tw:mb-3" role="alert" style={{ textAlign: 'center', fontWeight: 500 }}>
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={isRegistering}
              className="action-button primary"
            >
              {isRegistering ? 'Creating Account...' : 'Create Account'}
            </button>
          </div>
        </form>

        <p className="auth-nav">
          Already have an account?{' '}
          <Link to="/login" className="auth-link">
            Login
          </Link>
        </p>
      </div>
    </div>
  )
}