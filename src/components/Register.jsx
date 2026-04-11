import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AppBrand from './AppBrand'
import { SelectField } from './ui'
import { DEPARTMENTS, SEMESTER_OPTIONS } from '../mockData'
import {
  ApiError,
  getApiErrorDetails,
  loginUser as loginWithApi,
  registerUser as registerWithApi,
} from '../lib/dwarpalApi'
import {
  clearPhoneOtpSession,
  createFirebaseUser,
  getFirebaseAuthErrorMessage,
  rollbackFirebaseUser,
  sendPhoneOtp,
  signOutFirebaseUser,
  verifyPhoneOtp,
} from '../firebase'

const Register = ({ setCurrentUser }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    department: '',
    enrollment: '',
    phone: '',
    role: 'student',
    semester: '',
    password: '',
  })
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [phoneVerified, setPhoneVerified] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [otpLoading, setOtpLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    return () => {
      clearPhoneOtpSession()
    }
  }, [])

  const getBackendErrorMessage = (error, fallbackMessage) => {
    const errorDetails = getApiErrorDetails(error, fallbackMessage)

    if (error instanceof ApiError && error.status === 0) {
      return 'Unable to reach the DwarPal backend. Please start the backend server and try again.'
    }

    if (
      error instanceof ApiError &&
      error.status >= 500 &&
      (!errorDetails.message || errorDetails.message === fallbackMessage || errorDetails.message === 'Request failed.')
    ) {
      return 'Server error. Please check the backend logs and try again.'
    }

    return errorDetails.message || fallbackMessage
  }

  const handleChange = (e) => {
    const { name, value } = e.target

    setFormData((previousFormData) => {
      const updatedFormData = {
        ...previousFormData,
        [name]: value,
        ...(name === 'role' && value !== 'student' ? { semester: '' } : {}),
      }

      if (name === 'phone' && value !== previousFormData.phone) {
        return updatedFormData
      }

      return updatedFormData
    })

    if (name === 'phone') {
      setOtp('')
      setOtpSent(false)
      setPhoneVerified(false)
      clearPhoneOtpSession()
    }

    setError('')
  }

  const handleSendOtp = async () => {
    try {
      const phoneValue = String(formData.phone || '').trim()

      if (!phoneValue) {
        setError('Please enter phone number first.')
        return
      }

      setOtpLoading(true)
      setError('')
      setOtp('')
      setPhoneVerified(false)
      clearPhoneOtpSession()

      await sendPhoneOtp(phoneValue)
      setOtpSent(true)
    } catch (firebaseError) {
      console.error('Phone OTP send failed', firebaseError)
      setError(
        getFirebaseAuthErrorMessage(
          firebaseError,
          'Unable to send OTP right now. Please try again.',
        ),
      )
    } finally {
      setOtpLoading(false)
    }
  }

  const handleVerifyOtp = async () => {
    try {
      if (!otp.trim()) {
        setError('Please enter the OTP.')
        return
      }

      setOtpLoading(true)
      setError('')

      await verifyPhoneOtp(otp)
      setPhoneVerified(true)
    } catch (firebaseError) {
      console.error('Phone OTP verification failed', firebaseError)
      setError(
        getFirebaseAuthErrorMessage(
          firebaseError,
          'Unable to verify OTP right now. Please try again.',
        ),
      )
    } finally {
      setOtpLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (formData.role === 'student' && !formData.semester) {
      setError('Please select a semester for student registration.')
      return
    }

    if (!phoneVerified) {
      setError('Please verify your phone number before registering.')
      return
    }

    setLoading(true)
    setError('')

    const normalizedEmail = formData.email.trim().toLowerCase()
    let firebaseCredential = null

    try {
      try {
        firebaseCredential = await createFirebaseUser(normalizedEmail, formData.password)
      } catch (firebaseError) {
        setError(
          getFirebaseAuthErrorMessage(
            firebaseError,
            'Unable to create your Firebase account right now. Please try again.',
          ),
        )
        return
      }

      try {
        await registerWithApi({
          ...formData,
          email: normalizedEmail,
          firebaseUid: firebaseCredential.user.uid,
          phoneVerified: true,
        })
      } catch (backendError) {
        console.error('DwarPal backend registration failed after Firebase account creation', backendError)

        try {
          const recoveredUser = await loginWithApi(normalizedEmail, formData.password)
          setCurrentUser(recoveredUser)
          navigate('/app/dashboard', { replace: true })
          return
        } catch (recoveryError) {
          console.error('Automatic recovery login failed after backend registration error', recoveryError)
        }

        const rollbackResult = await rollbackFirebaseUser(firebaseCredential.user)
        const backendMessage = getBackendErrorMessage(
          backendError,
          'Unable to create your DwarPal account right now.',
        )

        if (!rollbackResult.ok) {
          console.error('Firebase rollback failed after backend registration error', rollbackResult.error)
          setError(
            `${backendMessage} The Firebase account could not be rolled back automatically. Please try signing in or contact support.`,
          )
          return
        }

        setError(backendMessage)
        return
      }

      try {
        const user = await loginWithApi(normalizedEmail, formData.password)
        setCurrentUser(user)
      } catch (backendLoginError) {
        console.error('Automatic DwarPal login failed after successful registration', backendLoginError)

        try {
          await signOutFirebaseUser()
        } catch {
          // Ignore Firebase sign-out cleanup issues and show the backend login error instead.
        }

        const backendMessage = getBackendErrorMessage(
          backendLoginError,
          'Unable to complete sign-in after registration.',
        )

        setError(`Account created successfully, but sign-in could not be completed. ${backendMessage}`)
        return
      }

      clearPhoneOtpSession()
      navigate('/app/dashboard', { replace: true })
    } catch (unexpectedError) {
      console.error('Unexpected registration error', unexpectedError)
      setError(
        getBackendErrorMessage(
          unexpectedError,
          'Unable to complete registration right now. Please try again.',
        ),
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <AppBrand size="md" layout="stacked" centered />
          <h2 className="text-3xl font-bold text-gray-900">Create Account</h2>
          <p className="mt-2 text-gray-600">Join DwarPal Digital Gatepass System</p>
        </div>

        <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Full Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                className="input"
                value={formData.name}
                onChange={handleChange}
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="input"
                value={formData.email}
                onChange={handleChange}
              />
            </div>

            <div>
              <label htmlFor="department" className="block text-sm font-medium text-gray-700">
                Department
              </label>
              <SelectField
                id="department"
                name="department"
                required
                className="input"
                value={formData.department}
                onChange={handleChange}
              >
                <option value="" disabled>
                  Select Department
                </option>
                {DEPARTMENTS.map((department) => (
                  <option key={department} value={department}>
                    {department}
                  </option>
                ))}
              </SelectField>
            </div>

            <div>
              <label htmlFor="enrollment" className="block text-sm font-medium text-gray-700">
                {formData.role === 'student' ? 'Enrollment No' : 'Employee ID'}
              </label>
              <input
                id="enrollment"
                name="enrollment"
                type="text"
                required
                className="input"
                value={formData.enrollment}
                onChange={handleChange}
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                Phone No
              </label>
              <div className="flex gap-2">
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  required
                  className="input flex-1"
                  value={formData.phone}
                  onChange={handleChange}
                  maxLength={10}
                  placeholder="Enter 10-digit phone number"
                />
                <button
                  type="button"
                  className="btn btn-secondary whitespace-nowrap"
                  onClick={handleSendOtp}
                  disabled={otpLoading || phoneVerified}
                >
                  {phoneVerified ? 'Verified' : otpLoading ? 'Sending...' : 'Send OTP'}
                </button>
              </div>
            </div>

            {otpSent && !phoneVerified ? (
              <div>
                <label htmlFor="otp" className="block text-sm font-medium text-gray-700">
                  OTP
                </label>
                <div className="flex gap-2">
                  <input
                    id="otp"
                    name="otp"
                    type="text"
                    className="input flex-1"
                    value={otp}
                    onChange={(e) => {
                      setOtp(e.target.value)
                      setError('')
                    }}
                    maxLength={6}
                    placeholder="Enter OTP"
                  />
                  <button
                    type="button"
                    className="btn btn-primary whitespace-nowrap"
                    onClick={handleVerifyOtp}
                    disabled={otpLoading}
                  >
                    {otpLoading ? 'Verifying...' : 'Verify OTP'}
                  </button>
                </div>
              </div>
            ) : null}

            {phoneVerified ? (
              <div className="text-sm text-green-600 text-center font-medium">
                Phone number verified successfully.
              </div>
            ) : null}

            <div id="recaptcha-container" />

            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                Role
              </label>
              <SelectField
                id="role"
                name="role"
                className="input"
                value={formData.role}
                onChange={handleChange}
              >
                <option value="student">Student</option>
                <option value="faculty">Faculty</option>
              </SelectField>
            </div>

            {formData.role === 'student' && (
              <div>
                <label htmlFor="semester" className="block text-sm font-medium text-gray-700">
                  Semester
                </label>
                <SelectField
                  id="semester"
                  name="semester"
                  required
                  className="input"
                  value={formData.semester}
                  onChange={handleChange}
                >
                  <option value="" disabled>
                    Select Semester
                  </option>
                  {SEMESTER_OPTIONS.map((semester) => (
                    <option key={semester} value={semester}>
                      Semester {semester}
                    </option>
                  ))}
                </SelectField>
              </div>
            )}

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="input"
                value={formData.password}
                onChange={handleChange}
              />
            </div>
          </div>

          {error ? <div className="text-red-600 text-sm text-center">{error}</div> : null}

          <div>
            <button type="submit" className="btn btn-primary w-full" disabled={loading || otpLoading}>
              {loading ? 'Registering...' : 'Register'}
            </button>
          </div>

          <div className="text-center">
            <Link to="/login" className="text-blue-600 hover:text-blue-500">
              Already have an account? Sign in
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}

export default Register