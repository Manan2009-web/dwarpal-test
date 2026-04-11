import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AppBrand from './AppBrand'
import { ApiError, getApiErrorDetails, loginUser as loginWithApi } from '../lib/dwarpalApi'
import {
  getFirebaseAuthErrorMessage,
  signInFirebaseUser,
  signOutFirebaseUser,
} from '../firebase'

const Login = ({ setCurrentUser }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

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
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const normalizedEmail = formData.email.trim().toLowerCase()

      try {
        await signInFirebaseUser(normalizedEmail, formData.password)
      } catch (firebaseError) {
        setError(
          getFirebaseAuthErrorMessage(
            firebaseError,
            'Unable to sign in with Firebase right now. Please try again.',
          ),
        )
        return
      }

      let user = null

      try {
        user = await loginWithApi(normalizedEmail, formData.password)
      } catch (backendError) {
        console.error('DwarPal backend login failed after Firebase sign-in', backendError)

        try {
          await signOutFirebaseUser()
        } catch {
          // Ignore Firebase sign-out cleanup issues and show the backend login error instead.
        }

        setError(
          getBackendErrorMessage(
            backendError,
            'Unable to complete DwarPal sign-in right now. Please try again.',
          ),
        )
        return
      }

      setCurrentUser(user)
      navigate('/app/dashboard', { replace: true })
    } catch (unexpectedError) {
      console.error('Unexpected login error', unexpectedError)
      setError(
        getBackendErrorMessage(
          unexpectedError,
          'Unable to complete sign-in right now. Please try again.',
        ),
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <AppBrand size="md" layout="stacked" centered />
          <h2 className="text-3xl font-bold text-gray-900">Sign in to DwarPal</h2>
          <p className="mt-2 text-gray-600">Enter your credentials to access the system</p>
        </div>

        <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
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
                placeholder="Enter your registered email address"
              />
            </div>

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
                placeholder="Enter your password"
              />
            </div>
          </div>

          {error ? <div className="text-red-600 text-sm text-center">{error}</div> : null}

          <div>
            <button type="submit" className="btn btn-primary w-full" disabled={loading}>
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </div>

          <div className="text-center">
            <Link to="/register" className="text-blue-600 hover:text-blue-500">
              Don't have an account? Register
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}

export default Login
