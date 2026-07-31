import { useState } from 'react'
import { KeyRound, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react'
import { changeUserPassword } from '../lib/dwarpalApi'
import { useToast } from './ToastProvider'
import { ActionButton } from './ui'

export default function PasswordResetPanel({ currentUser, onCurrentUserPatch }) {
  const toast = useToast()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccessMsg('')

    if (!currentPassword) {
      setError('Please enter your current/temporary password.')
      return
    }

    if (!newPassword || newPassword.length < 6) {
      setError('New password must be at least 6 characters long.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation password do not match.')
      return
    }

    setLoading(true)

    try {
      await changeUserPassword(currentPassword, newPassword)
      setSuccessMsg('Your password has been updated successfully!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')

      if (onCurrentUserPatch) {
        await onCurrentUserPatch({
          isTemporaryPassword: false,
          isNewStudent: false,
          mustResetPassword: false,
        })
      }

      toast.success({
        title: 'Password Updated',
        message: 'Your account password has been changed successfully.',
      })
    } catch (err) {
      const message = err?.message || 'Failed to update password. Please check your current password.'
      setError(message)
      toast.error({
        title: 'Password Update Failed',
        message,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="password-reset-panel">
      <div className="password-reset-header">
        <KeyRound size={20} />
        <span>Change / Reset Password</span>
      </div>

      <p className="password-reset-desc">
        {currentUser?.isTemporaryPassword || currentUser?.isNewStudent
          ? '🔑 You are using a temporary password. Set your new secure password below.'
          : 'Update your account password below to keep your account safe.'}
      </p>

      {error ? (
        <div className="password-alert-banner error">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      ) : null}

      {successMsg ? (
        <div className="password-alert-banner success">
          <CheckCircle2 size={16} />
          <span>{successMsg}</span>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="password-reset-form">
        <div className="password-field-group">
          <label className="password-field-label">Current / Temporary Password</label>
          <div className="password-input-container">
            <input
              type={showCurrentPassword ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current or temporary password"
              className="password-input-control"
              required
            />
            <button
              type="button"
              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              className="password-eye-btn"
              title={showCurrentPassword ? 'Hide password' : 'Show password'}
            >
              {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div className="password-field-group">
          <label className="password-field-label">New Password</label>
          <div className="password-input-container">
            <input
              type={showNewPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter at least 6 characters"
              className="password-input-control"
              required
            />
            <button
              type="button"
              onClick={() => setShowNewPassword(!showNewPassword)}
              className="password-eye-btn"
              title={showNewPassword ? 'Hide password' : 'Show password'}
            >
              {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div className="password-field-group">
          <label className="password-field-label">Confirm New Password</label>
          <div className="password-input-container">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              className="password-input-control"
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="password-eye-btn"
              title={showConfirmPassword ? 'Hide password' : 'Show password'}
            >
              {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div style={{ paddingTop: '0.4rem' }}>
          <ActionButton type="submit" tone="primary" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
            {loading ? 'Updating Password...' : 'Update Password'}
          </ActionButton>
        </div>
      </form>
    </div>
  )
}
