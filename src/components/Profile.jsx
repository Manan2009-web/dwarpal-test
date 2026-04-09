import { useNavigate } from 'react-router-dom'
import { ArrowLeft, LogOut } from 'lucide-react'
import { logoutUser } from '../lib/dwarpalApi'

const Profile = ({ user, setCurrentUser }) => {
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      await logoutUser()
    } finally {
      setCurrentUser(null)
      navigate('/login', { replace: true })
    }
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center mb-8">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center text-blue-600 hover:text-blue-800 mr-4"
            >
              <ArrowLeft size={20} className="mr-2" />
              Back
            </button>
            <h1 className="text-3xl font-bold text-gray-900">Profile</h1>
          </div>

          <div className="card">
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <p className="text-lg text-gray-900">{user.name}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {user.role === 'student' ? 'Enrollment Number' : 'Employee ID'}
                </label>
                <p className="text-lg text-gray-900">
                  {user.role === 'student' ? user.enrollment : user.employeeId}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Department
                </label>
                <p className="text-lg text-gray-900">{user.department}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mobile Number
                </label>
                <p className="text-lg text-gray-900">{user.phone}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <p className="text-lg text-gray-900">{user.email}</p>
              </div>

              {user.role === 'student' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Semester
                  </label>
                  <p className="text-lg text-gray-900">{user.semester}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    * Semester auto-updates based on academic calendar
                  </p>
                </div>
              )}

              <div className="pt-6 border-t">
                <button
                  onClick={handleLogout}
                  className="btn btn-danger"
                >
                  <LogOut size={16} className="mr-2" />
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Profile
