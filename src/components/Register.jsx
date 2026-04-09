import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AppBrand from './AppBrand'
import { SelectField } from './ui'
import { DEPARTMENTS, SEMESTER_OPTIONS } from '../mockData'
import { registerUser as registerWithApi } from '../lib/dwarpalApi'

const Register = ({ setCurrentUser }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    department: '',
    enrollment: '',
    phone: '',
    role: 'student',
    semester: '',
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
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (formData.role === 'student' && !formData.semester) {
      setError('Please select a semester for student registration.')
      return
    }

    setLoading(true)

    try {
      const newUser = await registerWithApi(formData)
      setCurrentUser(newUser)
      navigate('/app/dashboard', { replace: true })
    } catch (err) {
      setError(err.message || 'Registration failed')
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
              <input
                id="phone"
                name="phone"
                type="tel"
                required
                className="input"
                value={formData.phone}
                onChange={handleChange}
              />
            </div>
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
          {error && <div className="text-red-600 text-sm text-center">{error}</div>}
          <div>
            <button type="submit" className="btn btn-primary w-full" disabled={loading}>
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
