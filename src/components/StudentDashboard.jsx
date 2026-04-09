import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { mockGatepasses } from '../mockData'
import { Plus, User, LogOut } from 'lucide-react'
import { DashboardHeaderBranding } from './ui'

const StudentDashboard = ({ user }) => {
  const [gatepasses, setGatepasses] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    if (!user) {
      navigate('/login')
      return
    }
    // Filter gatepasses for this student
    const userGatepasses = mockGatepasses.filter(gp => gp.studentId === user.id)
    setGatepasses(userGatepasses)
  }, [user, navigate])

  const getStatusBadge = (status) => {
    const classes = {
      pending: 'status-pending',
      approved: 'status-approved',
      rejected: 'status-rejected',
      out: 'status-out',
      returned: 'status-returned'
    }
    return `status-badge ${classes[status] || 'status-pending'}`
  }

  const stats = {
    total: gatepasses.length,
    approved: gatepasses.filter(gp => gp.status === 'approved').length,
    rejected: gatepasses.filter(gp => gp.status === 'rejected').length,
    pending: gatepasses.filter(gp => gp.status === 'pending').length
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Bar */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <DashboardHeaderBranding roleName="Student" dashboardTitle="Student Dashboard" />
          <div className="flex items-center space-x-4">
            <button className="p-2 hover:bg-gray-100 rounded-full">
              <User size={20} />
            </button>
            <button
              onClick={() => navigate('/login')}
              className="btn btn-danger"
            >
              <LogOut size={16} className="mr-2" />
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome, {user.name}
          </h2>
          <p className="text-gray-600">Enrollment: {user.enrollment}</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="card text-center">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Total Gatepasses</h3>
            <p className="text-3xl font-bold text-blue-600">{stats.total}</p>
          </div>
          <div className="card text-center">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Approved</h3>
            <p className="text-3xl font-bold text-green-600">{stats.approved}</p>
          </div>
          <div className="card text-center">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Rejected</h3>
            <p className="text-3xl font-bold text-red-600">{stats.rejected}</p>
          </div>
          <div className="card text-center">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Pending</h3>
            <p className="text-3xl font-bold text-orange-600">{stats.pending}</p>
          </div>
        </div>

        {/* Create New Gatepass Button */}
        <div className="mb-8">
          <Link to="/create-gatepass" className="btn btn-primary">
            <Plus size={20} className="mr-2" />
            Create New Gatepass
          </Link>
        </div>

        {/* Gatepass List */}
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-gray-900">Your Gatepasses</h3>
          {gatepasses.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-gray-500">No gatepasses found</p>
            </div>
          ) : (
            gatepasses.map(gatepass => (
              <div key={gatepass.id} className="card">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-gray-900">{gatepass.reason}</h4>
                    <p className="text-sm text-gray-600">
                      Out: {new Date(gatepass.outTime).toLocaleString()}
                    </p>
                    {gatepass.expectedReturnTime && (
                      <p className="text-sm text-gray-600">
                        Expected Return: {new Date(gatepass.expectedReturnTime).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <span className={getStatusBadge(gatepass.status)}>
                    {gatepass.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default StudentDashboard
