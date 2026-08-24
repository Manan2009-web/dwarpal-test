import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { 
  UserPlus, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle, 
  QrCode, 
  Download, 
  KeyRound, 
  Sparkles, 
  Copy, 
  Check, 
  GraduationCap,
  X
} from 'lucide-react'
import PasswordInput from '../PasswordInput'
import { registerUser, apiRequest } from '../../lib/dwarpalApi'
import { PROGRAM_OPTIONS, DEPARTMENTS, SEMESTER_OPTIONS } from '../../mockData'

export default function StudentRegisterPage() {
  const navigate = useNavigate()

  // Form states
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [program, setProgram] = useState(PROGRAM_OPTIONS[0] || 'Diploma Engineering')
  const [department, setDepartment] = useState(DEPARTMENTS[0] || 'Computer Engineering')
  const [semester, setSemester] = useState(1)
  const [enrollmentNo, setEnrollmentNo] = useState('')
  const [isNewStudent, setIsNewStudent] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // UI status states
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [successData, setSuccessData] = useState(null)

  // Duplicate account modal state
  const [duplicateAccountModal, setDuplicateAccountModal] = useState(null)
  const [copiedEnrollment, setCopiedEnrollment] = useState(false)

  // Permanent QR code modal state
  const [qrModalOpen, setQrModalOpen] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [qrLoading, setQrLoading] = useState(false)

  // Registration URL
  const registrationUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/student/register`
    : 'https://dwarpal-test.vercel.app/student/register'

  // Fetch / generate permanent registration QR code
  useEffect(() => {
    let isMounted = true
    async function loadQr() {
      try {
        setQrLoading(true)
        const res = await apiRequest('/auth/student-register-qr')
        if (isMounted && res?.data?.qrDataUrl) {
          setQrDataUrl(res.data.qrDataUrl)
        }
      } catch (err) {
        if (isMounted) {
          setQrDataUrl(`https://quickchart.io/qr?text=${encodeURIComponent(registrationUrl)}&size=500&margin=2`)
        }
      } finally {
        if (isMounted) setQrLoading(false)
      }
    }
    loadQr()
    return () => { isMounted = false }
  }, [registrationUrl])

  // Copy helper
  const handleCopyEnrollment = (text) => {
    if (!text) return
    navigator.clipboard.writeText(text).then(() => {
      setCopiedEnrollment(true)
      setTimeout(() => setCopiedEnrollment(false), 2000)
    }).catch(() => {})
  }

  // Download QR helper
  const handleDownloadQr = () => {
    if (!qrDataUrl) return
    const a = document.createElement('a')
    a.href = qrDataUrl
    a.download = 'dwarpal-student-registration-qr.png'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMessage('')
    setFieldErrors({})

    const errors = {}
    if (!fullName.trim()) errors.fullName = 'Full name is required'
    if (!email.trim() || !email.includes('@')) errors.email = 'Valid email address is required'
    if (!phone.trim() || phone.replace(/\D/g, '').length < 10) errors.phone = 'Valid 10-digit phone number is required'
    if (!isNewStudent && !enrollmentNo.trim()) errors.enrollmentNo = 'Enrollment number is required, or click "I am a New Student"'
    if (!password || password.length < 8) errors.password = 'Password must be at least 8 characters'
    if (password !== confirmPassword) errors.confirmPassword = 'Passwords do not match'

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setLoading(true)

    try {
      const payload = {
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        program,
        department,
        semester: Number(semester),
        enrollmentNo: isNewStudent ? '' : enrollmentNo.trim(),
        isNewStudent: Boolean(isNewStudent),
        password,
        role: 'student'
      }

      const result = await registerUser(payload)
      const createdUser = result?.user
      setSuccessData({
        enrollmentNo: createdUser?.enrollmentNo || createdUser?.enrollment || enrollmentNo || 'GTU Auto-Generated',
        fullName: createdUser?.fullName || fullName,
        email: createdUser?.email || email,
        isTemporary: Boolean(isNewStudent || createdUser?.isTemporaryEnrollment)
      })
    } catch (err) {
      const conflictAccount = err?.response?.data?.existingAccount || err?.existingAccount

      if (conflictAccount || err?.status === 409 || err?.response?.status === 409) {
        setDuplicateAccountModal({
          enrollmentNo: conflictAccount?.enrollmentNo || enrollmentNo || 'Registered in College Records',
          email: conflictAccount?.email || email,
          fullName: conflictAccount?.fullName || fullName
        })
      } else {
        const errorMsg = err?.response?.data?.message || err?.message || 'Registration failed. Please check your details.'
        setErrorMessage(errorMsg)
        if (err?.response?.data?.errors) {
          const mapped = {}
          err.response.data.errors.forEach(errItem => {
            if (errItem.field) mapped[errItem.field] = errItem.message
          })
          setFieldErrors(mapped)
        }
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div 
      className="tw:min-h-screen tw:w-full tw:flex tw:flex-col tw:items-center tw:justify-center tw:relative tw:px-4 tw:py-10"
      style={{ background: 'var(--page-bg, #f6fbff)' }}
    >
      <div 
        className="tw:absolute tw:top-12 tw:left-1/2 tw:-translate-x-1/2 tw:w-[90vw] tw:max-w-2xl tw:h-[350px] tw:bg-[#2872a1]/[0.07] tw:rounded-full tw:blur-[110px] tw:pointer-events-none" 
      />

      <div className="tw:w-full tw:max-w-2xl tw:flex tw:items-center tw:justify-between tw:mb-6 tw:relative tw:z-10">
        <Link 
          to="/access-portal" 
          className="tw:inline-flex tw:items-center tw:gap-2 tw:text-xs tw:font-semibold tw:text-[#2872a1] tw:bg-white/80 tw:backdrop-blur-md tw:px-3.5 tw:py-2 tw:rounded-xl tw:border tw:border-[rgba(23,52,73,0.12)] tw:shadow-sm tw:hover:bg-slate-50 tw:transition-colors"
        >
          <ArrowLeft className="tw:w-4 tw:h-4" />
          Back to Portal
        </Link>

        <button
          type="button"
          onClick={() => setQrModalOpen(true)}
          className="tw:inline-flex tw:items-center tw:gap-2 tw:text-xs tw:font-bold tw:text-[#10263e] tw:bg-white/90 tw:backdrop-blur-md tw:px-3.5 tw:py-2 tw:rounded-xl tw:border tw:border-[rgba(23,52,73,0.14)] tw:shadow-sm tw:hover:border-[#2872a1]/40 tw:hover:text-[#2872a1] tw:transition-all"
        >
          <QrCode className="tw:w-4 tw:h-4 tw:text-[#2872a1]" />
          <span>Registration QR</span>
        </button>
      </div>

      <div className="tw:w-full tw:max-w-2xl tw:bg-white/85 tw:backdrop-blur-2xl tw:border tw:border-[rgba(23,52,73,0.12)] tw:shadow-[0_25px_60px_rgba(16,38,62,0.09)] tw:rounded-3xl tw:p-6 tw:sm:p-10 tw:relative tw:z-10">
        
        {successData ? (
          <div className="tw:text-center tw:py-6 tw:space-y-6">
            <div className="tw:w-16 tw:h-16 tw:bg-emerald-100 tw:border tw:border-emerald-300 tw:rounded-full tw:flex tw:items-center tw:justify-center tw:mx-auto tw:text-emerald-600 tw:shadow-sm">
              <CheckCircle2 className="tw:w-9 tw:h-9" />
            </div>

            <div className="tw:space-y-2">
              <span className="tw:px-3.5 tw:py-1 tw:rounded-full tw:bg-emerald-50 tw:text-emerald-700 tw:text-[11px] tw:font-mono tw:font-bold tw:tracking-widest tw:uppercase">
                Registration Complete
              </span>
              <h2 className="tw:text-2xl tw:sm:text-3xl tw:font-extrabold tw:text-[#10263e]">
                Welcome, {successData.fullName}!
              </h2>
              <p className="tw:text-xs tw:sm:text-sm tw:text-[#5d7183] tw:max-w-md tw:mx-auto">
                Your student account has been created successfully. You can now log in to request and manage your campus gatepasses.
              </p>
            </div>

            <div className="tw:bg-[#f6fbff] tw:border tw:border-[#2872a1]/25 tw:rounded-2xl tw:p-5 tw:max-w-md tw:mx-auto tw:space-y-2 tw:shadow-inner">
              <div className="tw:text-xs tw:text-[#5d7183] tw:font-semibold tw:uppercase tw:tracking-wider">
                {successData.isTemporary ? '⚡ Auto-Generated GTU Enrollment Number' : '🎓 Your GTU Enrollment Number'}
              </div>
              <div className="tw:flex tw:items-center tw:justify-center tw:gap-3">
                <span className="tw:font-mono tw:text-xl tw:sm:text-2xl tw:font-black tw:text-[#2872a1] tw:tracking-widest">
                  {successData.enrollmentNo}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyEnrollment(successData.enrollmentNo)}
                  className="tw:p-1.5 tw:rounded-lg tw:bg-white tw:border tw:border-[#2872a1]/20 tw:text-[#2872a1] tw:hover:bg-[#2872a1]/10 tw:transition"
                  title="Copy Enrollment Number"
                >
                  {copiedEnrollment ? <Check className="tw:w-4 tw:h-4 tw:text-emerald-600" /> : <Copy className="tw:w-4 tw:h-4" />}
                </button>
              </div>
              <p className="tw:text-[11px] tw:text-[#5d7183]">
                Use this Enrollment Number along with your password to log in.
              </p>
            </div>

            <div className="tw:pt-4 tw:flex tw:flex-col tw:sm:flex-row tw:items-center tw:justify-center tw:gap-3">
              <button
                type="button"
                onClick={() => navigate('/access-portal')}
                className="tw:w-full tw:sm:w-auto tw:px-8 tw:py-3.5 tw:rounded-xl tw:bg-[#2872a1] tw:hover:bg-[#1f5a80] tw:text-white tw:font-bold tw:text-xs tw:tracking-wider tw:uppercase tw:shadow-lg tw:shadow-[#2872a1]/25 tw:transition"
              >
                Proceed to Student Login
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="tw:space-y-6">
            
            <div className="tw:text-center tw:space-y-2 tw:pb-2">
              <div className="tw:inline-flex tw:items-center tw:gap-2 tw:px-3.5 tw:py-1.5 tw:rounded-full tw:bg-[#2872a1]/10 tw:text-[#2872a1] tw:text-[11px] tw:font-mono tw:font-bold tw:tracking-widest tw:uppercase">
                <GraduationCap className="tw:w-3.5 tw:h-3.5" />
                Student Direct Self-Registration
              </div>
              <h1 className="tw:text-2xl tw:sm:text-3xl tw:font-black tw:tracking-tight tw:text-[#10263e]">
                Create Your Student Account
              </h1>
              <p className="tw:text-xs tw:sm:text-sm tw:text-[#5d7183] tw:max-w-md tw:mx-auto">
                Fill in your details below to activate your gatepass access immediately without waiting for manual forms.
              </p>
            </div>

            {errorMessage && (
              <div className="tw:p-4 tw:rounded-2xl tw:bg-rose-50 tw:border tw:border-rose-200 tw:flex tw:items-start tw:gap-3 tw:text-rose-700 tw:text-xs">
                <AlertCircle className="tw:w-4 tw:h-4 tw:shrink-0 tw:mt-0.5" />
                <div className="tw:flex-1">{errorMessage}</div>
              </div>
            )}

            <div className="tw:grid tw:grid-cols-1 tw:sm:grid-cols-2 tw:gap-4 tw:sm:gap-5">
              
              <div className="tw:space-y-1.5">
                <label className="tw:block tw:text-xs tw:font-bold tw:text-[#163247] tw:uppercase tw:tracking-wider">
                  Full Name <span className="tw:text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Patel Aarav Ramesh"
                  required
                  className={`tw:w-full tw:h-11 tw:rounded-xl tw:border tw:bg-white tw:px-4 tw:text-xs tw:sm:text-sm tw:text-[#10263e] tw:shadow-sm tw:outline-none tw:transition ${
                    fieldErrors.fullName ? 'tw:border-rose-400' : 'tw:border-[rgba(23,52,73,0.15)] tw:focus:border-[#2872a1]'
                  }`}
                />
                {fieldErrors.fullName && <p className="tw:text-[11px] tw:text-rose-600">{fieldErrors.fullName}</p>}
              </div>

              <div className="tw:space-y-1.5">
                <label className="tw:block tw:text-xs tw:font-bold tw:text-[#163247] tw:uppercase tw:tracking-wider">
                  Email Address <span className="tw:text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. student@college.edu.in"
                  required
                  className={`tw:w-full tw:h-11 tw:rounded-xl tw:border tw:bg-white tw:px-4 tw:text-xs tw:sm:text-sm tw:text-[#10263e] tw:shadow-sm tw:outline-none tw:transition ${
                    fieldErrors.email ? 'tw:border-rose-400' : 'tw:border-[rgba(23,52,73,0.15)] tw:focus:border-[#2872a1]'
                  }`}
                />
                {fieldErrors.email && <p className="tw:text-[11px] tw:text-rose-600">{fieldErrors.email}</p>}
              </div>

              <div className="tw:space-y-1.5">
                <label className="tw:block tw:text-xs tw:font-bold tw:text-[#163247] tw:uppercase tw:tracking-wider">
                  Phone Number (10 Digits) <span className="tw:text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  required
                  className={`tw:w-full tw:h-11 tw:rounded-xl tw:border tw:bg-white tw:px-4 tw:text-xs tw:sm:text-sm tw:text-[#10263e] tw:shadow-sm tw:outline-none tw:transition ${
                    fieldErrors.phone ? 'tw:border-rose-400' : 'tw:border-[rgba(23,52,73,0.15)] tw:focus:border-[#2872a1]'
                  }`}
                />
                {fieldErrors.phone && <p className="tw:text-[11px] tw:text-rose-600">{fieldErrors.phone}</p>}
              </div>

              <div className="tw:space-y-1.5">
                <label className="tw:block tw:text-xs tw:font-bold tw:text-[#163247] tw:uppercase tw:tracking-wider">
                  Program <span className="tw:text-rose-500">*</span>
                </label>
                <select
                  value={program}
                  onChange={(e) => setProgram(e.target.value)}
                  className="tw:w-full tw:h-11 tw:rounded-xl tw:border tw:border-[rgba(23,52,73,0.15)] tw:bg-white tw:px-4 tw:text-xs tw:sm:text-sm tw:text-[#10263e] tw:shadow-sm tw:outline-none tw:focus:border-[#2872a1] tw:transition"
                >
                  {PROGRAM_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              <div className="tw:space-y-1.5">
                <label className="tw:block tw:text-xs tw:font-bold tw:text-[#163247] tw:uppercase tw:tracking-wider">
                  Department / Branch <span className="tw:text-rose-500">*</span>
                </label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="tw:w-full tw:h-11 tw:rounded-xl tw:border tw:border-[rgba(23,52,73,0.15)] tw:bg-white tw:px-4 tw:text-xs tw:sm:text-sm tw:text-[#10263e] tw:shadow-sm tw:outline-none tw:focus:border-[#2872a1] tw:transition"
                >
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              <div className="tw:space-y-1.5">
                <label className="tw:block tw:text-xs tw:font-bold tw:text-[#163247] tw:uppercase tw:tracking-wider">
                  Semester <span className="tw:text-rose-500">*</span>
                </label>
                <select
                  value={semester}
                  onChange={(e) => setSemester(Number(e.target.value))}
                  className="tw:w-full tw:h-11 tw:rounded-xl tw:border tw:border-[rgba(23,52,73,0.15)] tw:bg-white tw:px-4 tw:text-xs tw:sm:text-sm tw:text-[#10263e] tw:shadow-sm tw:outline-none tw:focus:border-[#2872a1] tw:transition"
                >
                  {SEMESTER_OPTIONS.map((sem) => (
                    <option key={sem} value={sem}>Semester {sem}</option>
                  ))}
                </select>
              </div>

            </div>

            <div className="tw:space-y-3 tw:p-4 tw:rounded-2xl tw:bg-[#f6fbff] tw:border tw:border-[rgba(40,114,161,0.18)]">
              <div className="tw:flex tw:flex-col tw:sm:flex-row tw:sm:items-center tw:justify-between tw:gap-2">
                <label className="tw:block tw:text-xs tw:font-bold tw:text-[#163247] tw:uppercase tw:tracking-wider">
                  GTU Enrollment Number <span className="tw:text-rose-500">*</span>
                </label>

                <button
                  type="button"
                  onClick={() => {
                    const nextState = !isNewStudent
                    setIsNewStudent(nextState)
                    if (nextState) setEnrollmentNo('')
                  }}
                  className={`tw:inline-flex tw:items-center tw:gap-1.5 tw:px-3 tw:py-1.5 tw:rounded-lg tw:text-xs tw:font-bold tw:transition-all ${
                    isNewStudent
                      ? 'tw:bg-[#2872a1] tw:text-white tw:shadow-sm'
                      : 'tw:bg-white tw:border tw:border-[#2872a1]/30 tw:text-[#2872a1] tw:hover:bg-[#2872a1]/10'
                  }`}
                >
                  <Sparkles className="tw:w-3.5 tw:h-3.5" />
                  <span>{isNewStudent ? '✓ New Student (Auto-Generate)' : 'I am a New Student (No Enrollment No.)'}</span>
                </button>
              </div>

              {isNewStudent ? (
                <div className="tw:p-3 tw:rounded-xl tw:bg-amber-50/80 tw:border tw:border-amber-200/70 tw:text-amber-800 tw:text-xs tw:flex tw:items-center tw:gap-2">
                  <Sparkles className="tw:w-4 tw:h-4 tw:shrink-0 tw:text-amber-600" />
                  <span>
                    ⚡ System will automatically generate your official GTU enrollment number upon submission.
                  </span>
                </div>
              ) : (
                <input
                  type="text"
                  value={enrollmentNo}
                  onChange={(e) => setEnrollmentNo(e.target.value.toUpperCase())}
                  placeholder="e.g. 231170107001"
                  required={!isNewStudent}
                  className={`tw:w-full tw:h-11 tw:rounded-xl tw:border tw:bg-white tw:px-4 tw:text-xs tw:sm:text-sm tw:font-mono tw:text-[#10263e] tw:shadow-sm tw:outline-none tw:transition ${
                    fieldErrors.enrollmentNo ? 'tw:border-rose-400' : 'tw:border-[rgba(23,52,73,0.15)] tw:focus:border-[#2872a1]'
                  }`}
                />
              )}
              {fieldErrors.enrollmentNo && <p className="tw:text-[11px] tw:text-rose-600">{fieldErrors.enrollmentNo}</p>}
            </div>

            <div className="tw:grid tw:grid-cols-1 tw:sm:grid-cols-2 tw:gap-4 tw:sm:gap-5">
              
              <div className="tw:space-y-1.5">
                <label className="tw:block tw:text-xs tw:font-bold tw:text-[#163247] tw:uppercase tw:tracking-wider">
                  Create Password <span className="tw:text-rose-500">*</span>
                </label>
                <PasswordInput
                  id="student-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  required
                  wrapperClassName="tw:relative"
                  className={`tw:w-full tw:h-11 tw:rounded-xl tw:border tw:bg-white tw:px-4 tw:pr-10 tw:text-xs tw:sm:text-sm tw:text-[#10263e] tw:shadow-sm tw:outline-none tw:transition ${
                    fieldErrors.password ? 'tw:border-rose-400' : 'tw:border-[rgba(23,52,73,0.15)] tw:focus:border-[#2872a1]'
                  }`}
                />
                {fieldErrors.password && <p className="tw:text-[11px] tw:text-rose-600">{fieldErrors.password}</p>}
              </div>

              <div className="tw:space-y-1.5">
                <label className="tw:block tw:text-xs tw:font-bold tw:text-[#163247] tw:uppercase tw:tracking-wider">
                  Confirm Password <span className="tw:text-rose-500">*</span>
                </label>
                <PasswordInput
                  id="student-confirm-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  required
                  wrapperClassName="tw:relative"
                  className={`tw:w-full tw:h-11 tw:rounded-xl tw:border tw:bg-white tw:px-4 tw:pr-10 tw:text-xs tw:sm:text-sm tw:text-[#10263e] tw:shadow-sm tw:outline-none tw:transition ${
                    fieldErrors.confirmPassword ? 'tw:border-rose-400' : 'tw:border-[rgba(23,52,73,0.15)] tw:focus:border-[#2872a1]'
                  }`}
                />
                {fieldErrors.confirmPassword && <p className="tw:text-[11px] tw:text-rose-600">{fieldErrors.confirmPassword}</p>}
              </div>

            </div>

            <div className="tw:pt-3">
              <button
                type="submit"
                disabled={loading}
                className="tw:w-full tw:h-12 tw:rounded-xl tw:bg-[#2872a1] tw:hover:bg-[#1f5a80] tw:text-white tw:font-bold tw:text-xs tw:sm:text-sm tw:tracking-wider tw:uppercase tw:shadow-lg tw:shadow-[#2872a1]/25 tw:transition-all tw:flex tw:items-center tw:justify-center tw:gap-2 tw:disabled:opacity-60"
              >
                {loading ? (
                  <span>Creating Student Account...</span>
                ) : (
                  <>
                    <UserPlus className="tw:w-4 tw:h-4" />
                    <span>Register Student Account</span>
                  </>
                )}
              </button>
            </div>

            <div className="tw:pt-3 tw:text-center tw:text-xs tw:text-[#5d7183] tw:space-y-2">
              <p>
                Already have an account?{' '}
                <Link to="/access-portal" className="tw:font-bold tw:text-[#2872a1] tw:hover:underline">
                  Sign in here
                </Link>
              </p>
            </div>

          </form>
        )}

      </div>

      {duplicateAccountModal && (
        <div className="tw:fixed tw:inset-0 tw:z-50 tw:flex tw:items-center tw:justify-center tw:bg-slate-900/60 tw:backdrop-blur-sm tw:p-4">
          <div className="tw:w-full tw:max-w-md tw:bg-white tw:rounded-3xl tw:p-6 tw:sm:p-8 tw:shadow-2xl tw:border tw:border-slate-100 tw:space-y-5 tw:animate-in tw:fade-in tw:zoom-in-95 tw:duration-200">
            
            <div className="tw:flex tw:items-start tw:justify-between">
              <div className="tw:w-12 tw:h-12 tw:rounded-2xl tw:bg-amber-100 tw:border tw:border-amber-300 tw:flex tw:items-center tw:justify-center tw:text-amber-700">
                <AlertCircle className="tw:w-6 tw:h-6" />
              </div>
              <button
                type="button"
                onClick={() => setDuplicateAccountModal(null)}
                className="tw:p-1.5 tw:rounded-full tw:hover:bg-slate-100 tw:text-slate-400 tw:hover:text-slate-600 tw:transition"
              >
                <X className="tw:w-5 tw:h-5" />
              </button>
            </div>

            <div className="tw:space-y-1.5">
              <h3 className="tw:text-xl tw:font-extrabold tw:text-[#10263e]">
                Account Already Exists
              </h3>
              <p className="tw:text-xs tw:sm:text-sm tw:text-[#5d7183] tw:leading-relaxed">
                A student account is already registered in the DwarPal database with your credentials.
              </p>
            </div>

            <div className="tw:p-4 tw:rounded-2xl tw:bg-[#f6fbff] tw:border tw:border-[#2872a1]/25 tw:space-y-1.5">
              <div className="tw:text-[11px] tw:font-bold tw:text-[#5d7183] tw:uppercase tw:tracking-wider">
                🎓 Your Registered Enrollment Number
              </div>
              <div className="tw:flex tw:items-center tw:justify-between">
                <span className="tw:font-mono tw:text-lg tw:sm:text-xl tw:font-extrabold tw:text-[#2872a1]">
                  {duplicateAccountModal.enrollmentNo}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyEnrollment(duplicateAccountModal.enrollmentNo)}
                  className="tw:inline-flex tw:items-center tw:gap-1 tw:px-2.5 tw:py-1 tw:rounded-lg tw:bg-white tw:border tw:border-[#2872a1]/20 tw:text-[#2872a1] tw:text-[11px] tw:font-bold tw:hover:bg-[#2872a1]/10 tw:transition"
                >
                  {copiedEnrollment ? <Check className="tw:w-3.5 tw:h-3.5 tw:text-emerald-600" /> : <Copy className="tw:w-3.5 tw:h-3.5" />}
                  <span>{copiedEnrollment ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <div className="tw:p-3.5 tw:rounded-xl tw:bg-amber-50 tw:border tw:border-amber-200/80 tw:text-xs tw:text-amber-900 tw:flex tw:items-start tw:gap-2.5">
              <KeyRound className="tw:w-4 tw:h-4 tw:shrink-0 tw:text-amber-700 tw:mt-0.5" />
              <p className="tw:leading-snug">
                <strong>Don't know your password?</strong> Use <strong>Forgot Password</strong> on the login page to reset it instantly via your registered email.
              </p>
            </div>

            <div className="tw:pt-2 tw:flex tw:flex-col tw:gap-2.5">
              <button
                type="button"
                onClick={() => navigate('/access-portal')}
                className="tw:w-full tw:h-11 tw:rounded-xl tw:bg-[#2872a1] tw:hover:bg-[#1f5a80] tw:text-white tw:font-bold tw:text-xs tw:uppercase tw:tracking-wider tw:shadow-md tw:transition tw:flex tw:items-center tw:justify-center tw:gap-2"
              >
                <span>Proceed to Student Login</span>
              </button>

              <button
                type="button"
                onClick={() => setDuplicateAccountModal(null)}
                className="tw:w-full tw:h-10 tw:rounded-xl tw:border tw:border-slate-200 tw:hover:bg-slate-50 tw:text-slate-600 tw:font-semibold tw:text-xs tw:transition"
              >
                Close & Review Form
              </button>
            </div>

          </div>
        </div>
      )}

      {qrModalOpen && (
        <div className="tw:fixed tw:inset-0 tw:z-50 tw:flex tw:items-center tw:justify-center tw:bg-slate-900/60 tw:backdrop-blur-sm tw:p-4">
          <div className="tw:w-full tw:max-w-md tw:bg-white tw:rounded-3xl tw:p-6 tw:sm:p-8 tw:shadow-2xl tw:border tw:border-slate-100 tw:text-center tw:space-y-5 tw:animate-in tw:fade-in tw:zoom-in-95 tw:duration-200">
            
            <div className="tw:flex tw:items-center tw:justify-between">
              <span className="tw:px-3 tw:py-1 tw:rounded-full tw:bg-[#2872a1]/10 tw:text-[#2872a1] tw:text-[10px] tw:font-mono tw:font-bold tw:tracking-widest tw:uppercase">
                Permanent • Lifetime Validity
              </span>
              <button
                type="button"
                onClick={() => setQrModalOpen(false)}
                className="tw:p-1.5 tw:rounded-full tw:hover:bg-slate-100 tw:text-slate-400 tw:hover:text-slate-600 tw:transition"
              >
                <X className="tw:w-5 tw:h-5" />
              </button>
            </div>

            <div className="tw:space-y-1">
              <h3 className="tw:text-xl tw:font-black tw:text-[#10263e]">
                Student Registration QR Code
              </h3>
              <p className="tw:text-xs tw:text-[#5d7183]">
                Share this QR code with students to let them self-register directly on their phones.
              </p>
            </div>

            <div className="tw:w-56 tw:h-56 tw:bg-white tw:p-3 tw:rounded-2xl tw:border-2 tw:border-[#2872a1]/20 tw:shadow-md tw:mx-auto tw:flex tw:items-center tw:justify-center">
              {qrLoading ? (
                <div className="tw:text-xs tw:text-[#5d7183] tw:font-mono">Generating QR...</div>
              ) : qrDataUrl ? (
                <img 
                  src={qrDataUrl} 
                  alt="Student Registration Permanent QR Code" 
                  className="tw:w-full tw:h-full tw:object-contain tw:rounded-lg"
                />
              ) : (
                <div className="tw:text-xs tw:text-rose-500">Failed to load QR</div>
              )}
            </div>

            <div className="tw:text-[11px] tw:text-[#5d7183] tw:font-mono tw:break-all tw:bg-slate-50 tw:p-2.5 tw:rounded-xl tw:border tw:border-slate-200">
              {registrationUrl}
            </div>

            <div className="tw:pt-2 tw:flex tw:flex-col tw:sm:flex-row tw:items-center tw:gap-2.5">
              <button
                type="button"
                onClick={handleDownloadQr}
                disabled={!qrDataUrl}
                className="tw:w-full tw:h-11 tw:rounded-xl tw:bg-[#2872a1] tw:hover:bg-[#1f5a80] tw:text-white tw:font-bold tw:text-xs tw:uppercase tw:tracking-wider tw:shadow-md tw:transition tw:flex tw:items-center tw:justify-center tw:gap-2 tw:disabled:opacity-50"
              >
                <Download className="tw:w-4 tw:h-4" />
                <span>Download QR Image</span>
              </button>

              <button
                type="button"
                onClick={() => setQrModalOpen(false)}
                className="tw:w-full tw:sm:w-auto tw:px-5 tw:h-11 tw:rounded-xl tw:border tw:border-slate-200 tw:hover:bg-slate-50 tw:text-slate-600 tw:font-semibold tw:text-xs tw:transition"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}