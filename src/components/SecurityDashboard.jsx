import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { mockGatepasses } from '../mockData'
import { User, LogOut, LogOut as OutIcon, LogIn } from 'lucide-react'
import { DashboardHeaderBranding } from './ui'

const SecurityDashboard = ({ user }) => {
  const [gatepasses, setGatepasses] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    if (!user || user.role !== 'security') {
      navigate('/login')
      return
    }
    // Get approved gatepasses that haven't been marked out yet
    const approvedGatepasses = mockGatepasses.filter(
      gp => gp.status === 'approved' || gp.status === 'out' || gp.status === 'returned'
    )
    setGatepasses(approvedGatepasses)
  }, [user, navigate])

  const handleMarkOut = (id) => {
    setGatepasses(gatepasses.map(gp =>
      gp.id === id ? { ...gp, status: 'out', outMarkedBy: 'security', outTimeActual: new Date().toISOString() } : gp
    ))
  }

  const handleMarkIn = (id) => {
    setGatepasses(gatepasses.map(gp =>
      gp.id === id ? { ...gp, status: 'returned', inMarkedBy: 'security', inTimeActual: new Date().toISOString() } : gp
    ))
  }

  const filteredGatepasses = gatepasses.filter(gp =>
    (gp.studentName || gp.facultyName).toLowerCase().includes(searchTerm.toLowerCase()) ||
    (gp.enrollment || gp.employeeId).toLowerCase().includes(searchTerm.toLowerCase()) ||
    gp.department.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const stats = {
    readyForOut: filteredGatepasses.filter(gp => gp.status === 'approved').length,
    out: filteredGatepasses.filter(gp => gp.status === 'out').length,
    returned: filteredGatepasses.filter(gp => gp.status === 'returned').length
  }

  const getStatusBadge = (status) => {
    const classes = {
      approved: 'status-approved',
      out: 'status-out',
      returned: 'status-returned'
    }
    return `status-badge ${classes[status] || 'status-approved'}`
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Bar */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <DashboardHeaderBranding roleName="Security" dashboardTitle="Security Dashboard" />
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
          <p className="text-gray-600">Security Dashboard</p>
        </div>

        {/* Counters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="card text-center">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Ready for OUT</h3>
            <p className="text-3xl font-bold text-green-600">{stats.readyForOut}</p>
          </div>
          <div className="card text-center">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">OUT</h3>
            <p className="text-3xl font-bold text-blue-600">{stats.out}</p>
          </div>
          <div className="card text-center">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Returned</h3>
            <p className="text-3xl font-bold text-gray-600">{stats.returned}</p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search by name, ID, or department..."
            className="input w-full max-w-md"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Gatepass List */}
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-gray-900">Approved Gatepasses</h3>
          {filteredGatepasses.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-gray-500">No approved gatepasses</p>
            </div>
          ) : (
            filteredGatepasses.map(gatepass => (
              <div key={gatepass.id} className="card">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="font-semibold text-gray-900">
                      {gatepass.studentName || gatepass.facultyName}
                    </h4>
                    <p className="text-sm text-gray-600">
                      {gatepass.studentId ? `Enrollment: ${gatepass.enrollment}` : `Employee ID: ${gatepass.employeeId}`}
                    </p>
                    <p className="text-sm text-gray-600">Department: {gatepass.department}</p>
                    <p className="text-sm text-gray-600">Reason: {gatepass.reason}</p>
                    <p className="text-sm text-gray-600">
                      Out: {new Date(gatepass.outTime).toLocaleString()}
                    </p>
                    {gatepass.outTimeActual && (
                      <p className="text-sm text-gray-600">
                        Actual Out: {new Date(gatepass.outTimeActual).toLocaleString()}
                      </p>
                    )}
                    {gatepass.inTimeActual && (
                      <p className="text-sm text-gray-600">
                        Actual Return: {new Date(gatepass.inTimeActual).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={getStatusBadge(gatepass.status)}>
                      {gatepass.status}
                    </span>
                    {gatepass.status === 'approved' && (
                      <button
                        onClick={() => handleMarkOut(gatepass.id)}
                        className="btn btn-primary"
                      >
                        <OutIcon size={16} className="mr-1" />
                        Mark OUT
                      </button>
                    )}
                    {gatepass.status === 'out' && (
                      <button
                        onClick={() => handleMarkIn(gatepass.id)}
                        className="btn btn-success"
                      >
                        <LogIn size={16} className="mr-1" />
                        Mark IN
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default SecurityDashboard
