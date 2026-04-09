import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AppBrand from './AppBrand'
import { loginUser as loginWithApi } from '../lib/dwarpalApi'

const Login = ({ setCurrentUser }) => {
  const [formData, setFormData] = useState({
    enrollment: '',
    password: ''
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const user = await loginWithApi(formData.enrollment, formData.password)
      setCurrentUser(user)
      navigate('/app/dashboard', { replace: true })
    } catch (err) {
      setError(err.message || 'Login failed')
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
              <label htmlFor="enrollment" className="block text-sm font-medium text-gray-700">
                Enrollment/Employee ID
              </label>
              <input
                id="enrollment"
                name="enrollment"
                type="text"
                required
                className="input"
                value={formData.enrollment}
                onChange={handleChange}
                placeholder="Enter your Enrollment No or Employee ID"
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

          {error && (
            <div className="text-red-600 text-sm text-center">{error}</div>
          )}

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
