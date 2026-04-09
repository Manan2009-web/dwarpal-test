import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'

const CreateGatepass = ({ user }) => {
  const [formData, setFormData] = useState({
    reason: '',
    outTime: '',
    expectedReturnTime: ''
  })
  const navigate = useNavigate()

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    // In a real app, this would be sent to backend
    // For demo, we'll just navigate back
    alert('Gatepass submitted successfully!')
    navigate(user.role === 'student' ? '/student-dashboard' : '/faculty-dashboard')
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full">
        <div className="card">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Create Gatepass</h2>
            <button
              onClick={() => navigate(user.role === 'student' ? '/student-dashboard' : '/faculty-dashboard')}
              className="p-2 hover:bg-gray-100 rounded-full"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                type="text"
                value={user.name}
                readOnly
                className="input bg-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {user.role === 'student' ? 'Enrollment' : 'Employee ID'}
              </label>
              <input
                type="text"
                value={user.role === 'student' ? user.enrollment : user.employeeId}
                readOnly
                className="input bg-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Department
              </label>
              <input
                type="text"
                value={user.department}
                readOnly
                className="input bg-gray-100"
              />
            </div>

            <div>
              <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1">
                Reason *
              </label>
              <textarea
                id="reason"
                name="reason"
                rows="3"
                required
                className="input"
                placeholder="Enter reason for gatepass"
                value={formData.reason}
                onChange={handleChange}
              />
            </div>

            <div>
              <label htmlFor="outTime" className="block text-sm font-medium text-gray-700 mb-1">
                Out Time *
              </label>
              <input
                id="outTime"
                name="outTime"
                type="datetime-local"
                required
                className="input"
                value={formData.outTime}
                onChange={handleChange}
              />
            </div>

            <div>
              <label htmlFor="expectedReturnTime" className="block text-sm font-medium text-gray-700 mb-1">
                Expected Return Time
              </label>
              <input
                id="expectedReturnTime"
                name="expectedReturnTime"
                type="datetime-local"
                className="input"
                value={formData.expectedReturnTime}
                onChange={handleChange}
              />
            </div>

            <div className="pt-4">
              <button type="submit" className="btn btn-primary w-full">
                Submit Gatepass
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default CreateGatepass