import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { mockGatepasses } from '../mockData'
import { User, LogOut, Check, X } from 'lucide-react'
import { DashboardHeaderBranding } from './ui'

const CaoDashboard = ({ user }) => {
  const [gatepasses, setGatepasses] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    if (!user || user.role !== 'cao') {
      navigate('/login')
      return
    }
    // Get faculty gatepasses that are pending
    const pendingFacultyGatepasses = mockGatepasses.filter(
      gp => gp.facultyId && gp.status === 'pending'
    )
    setGatepasses(pendingFacultyGatepasses)
  }, [user, navigate])

  const handleApprove = (id) => {
    setGatepasses(gatepasses.map(gp =>
      gp.id === id ? { ...gp, status: 'approved', approvedBy: 'cao' } : gp
    ))
  }

  const handleReject = (id) => {
    setGatepasses(gatepasses.map(gp =>
      gp.id === id ? { ...gp, status: 'rejected', rejectedBy: 'cao' } : gp
    ))
  }

  const filteredGatepasses = gatepasses.filter(gp =>
    gp.facultyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    gp.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    gp.department.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const stats = {
    total: filteredGatepasses.length,
    pending: filteredGatepasses.length
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Bar */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <DashboardHeaderBranding roleName="CAO" dashboardTitle="CAO Dashboard" />
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
          <p className="text-gray-600">Chief Academic Officer Dashboard</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="card text-center">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Faculty Requests</h3>
            <p className="text-3xl font-bold text-orange-600">{stats.total}</p>
          </div>
          <div className="card text-center">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Pending Review</h3>
            <p className="text-3xl font-bold text-blue-600">{stats.pending}</p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search by name, employee ID, or department..."
            className="input w-full max-w-md"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Gatepass Requests */}
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-gray-900">Faculty Gatepass Requests</h3>
          {filteredGatepasses.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-gray-500">No faculty requests</p>
            </div>
          ) : (
            filteredGatepasses.map(gatepass => (
              <div key={gatepass.id} className="card">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="font-semibold text-gray-900">{gatepass.facultyName}</h4>
                    <p className="text-sm text-gray-600">Employee ID: {gatepass.employeeId}</p>
                    <p className="text-sm text-gray-600">Department: {gatepass.department}</p>
                    <p className="text-sm text-gray-600">Reason: {gatepass.reason}</p>
                    <p className="text-sm text-gray-600">
                      Out: {new Date(gatepass.outTime).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleApprove(gatepass.id)}
                      className="btn btn-success"
                    >
                      <Check size={16} className="mr-1" />
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(gatepass.id)}
                      className="btn btn-danger"
                    >
                      <X size={16} className="mr-1" />
                      Reject
                    </button>
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

export default CaoDashboard
