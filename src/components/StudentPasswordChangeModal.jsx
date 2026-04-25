import { useEffect, useState } from 'react'
import { KeyRound, ShieldCheck } from 'lucide-react'
import { ActionButton, ModalForm } from './ui'
import OtpCodeInput from './OtpCodeInput'
import PasswordInput from './PasswordInput'

const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/

export default function StudentPasswordChangeModal({
  open,
  currentUser,
  onClose,
  onRequestOtp,
  onConfirmPasswordChange,
  onPasswordChanged,
}) {
  const [step, setStep] = useState('prompt')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [maskedEmail, setMaskedEmail] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [isSending, setIsSending] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!open) {
      return
    }

    setStep('prompt')
    setOtp('')
    setNewPassword('')
    setConfirmPassword('')
    setMaskedEmail('')
    setSecondsLeft(0)
    setError('')
    setSuccess('')
    setFieldErrors({})
    setIsSending(false)
    setIsSaving(false)
  }, [open, currentUser?.id])

  useEffect(() => {
    if (!open || secondsLeft <= 0) {
      return undefined
    }

    const timerId = window.setTimeout(() => {
      setSecondsLeft((previousValue) => Math.max(previousValue - 1, 0))
    }, 1000)

    return () => window.clearTimeout(timerId)
  }, [open, secondsLeft])

  async function handleRequestOtp() {
    if (isSending) {
      return
    }

    setIsSending(true)
    setError('')
    setSuccess('')
    setFieldErrors({})

    const result = await onRequestOtp?.()

    if (!result?.ok) {
      setError(result?.error || 'Unable to send the password change OTP right now.')
      setFieldErrors(result?.fieldErrors || {})
      setIsSending(false)
      return
    }

    setMaskedEmail(result.maskedEmail || '')
    setSecondsLeft(Number(result.cooldownSeconds || 45))
    setStep('reset')
    setSuccess(result.message || 'Password change OTP sent successfully.')
    setIsSending(false)
  }

  async function handleResend() {
    if (secondsLeft > 0 || isSending) {
      return
    }

    await handleRequestOtp()
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (isSaving) {
      return
    }

    const nextFieldErrors = {}

    if (otp.length !== 6) {
      nextFieldErrors.otp = 'Enter the 6-digit OTP sent to your email.'
    }

    if (!PASSWORD_PATTERN.test(newPassword)) {
      nextFieldErrors.newPassword =
        'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.'
    }

    if (confirmPassword !== newPassword) {
      nextFieldErrors.confirmPassword = 'Confirm password must match the new password.'
    }

    if (Object.keys(nextFieldErrors).length) {
      setFieldErrors(nextFieldErrors)
      setError('')
      setSuccess('')
      return
    }

    setIsSaving(true)
    setError('')
    setSuccess('')
    setFieldErrors({})

    const result = await onConfirmPasswordChange?.({
      otp,
      newPassword,
      confirmPassword,
    })

    if (!result?.ok) {
      setError(result?.error || 'Unable to change your password right now.')
      setFieldErrors(result?.fieldErrors || {})
      setIsSaving(false)
      return
    }

    setSuccess(result.message || 'Password changed successfully.')
    onPasswordChanged?.(result.user || null)
    setIsSaving(false)
  }

  return (
    <ModalForm
      open={open}
      onClose={onClose}
      title={step === 'prompt' ? 'Do you want to change your password?' : 'Change your student password'}
      subtitle={
        step === 'prompt'
          ? 'You are signed in with a CAO-issued temporary password. You can change it now or do it later.'
          : 'Verify your registered email with OTP and create a new password.'
      }
      className="auth-modal-card"
    >
      <div className="auth-otp-modal">
        {step === 'prompt' ? (
          <>
            <p className="field-hint">
              Your student account will stay available, but DwarPal recommends replacing the temporary password for better security.
            </p>
            <div className="auth-modal-actions">
              <ActionButton type="button" tone="secondary" onClick={onClose} disabled={isSending}>
                Maybe later
              </ActionButton>
              <ActionButton type="button" icon={KeyRound} onClick={handleRequestOtp} disabled={isSending} aria-busy={isSending}>
                {isSending ? 'Sending OTP...' : 'Change Password'}
              </ActionButton>
            </div>
            {error ? <p className="form-error">{error}</p> : null}
          </>
        ) : (
          <form className="auth-otp-step-form" onSubmit={handleSubmit}>
            <div className="auth-modal-email-chip">
              <ShieldCheck size={16} />
              <span>{maskedEmail || currentUser?.email || 'Registered student email'}</span>
            </div>

            <label>
              <span className="field-label-text">Email OTP</span>
              <OtpCodeInput value={otp} onChange={setOtp} autoFocus disabled={isSending || isSaving} />
              {fieldErrors.otp ? <p className="field-error">{fieldErrors.otp}</p> : null}
            </label>

            <label>
              <span className="field-label-text">New Password</span>
              <PasswordInput
                value={newPassword}
                onChange={setNewPassword}
                autoComplete="new-password"
                className={fieldErrors.newPassword ? 'field-invalid' : ''}
                ariaInvalid={Boolean(fieldErrors.newPassword)}
                disabled={isSaving}
              />
              {fieldErrors.newPassword ? <p className="field-error">{fieldErrors.newPassword}</p> : null}
            </label>

            <label>
              <span className="field-label-text">Confirm Password</span>
              <PasswordInput
                value={confirmPassword}
                onChange={setConfirmPassword}
                autoComplete="new-password"
                className={fieldErrors.confirmPassword ? 'field-invalid' : ''}
                ariaInvalid={Boolean(fieldErrors.confirmPassword)}
                disabled={isSaving}
              />
              {fieldErrors.confirmPassword ? <p className="field-error">{fieldErrors.confirmPassword}</p> : null}
            </label>

            <div className="auth-modal-inline-actions">
              <button
                type="button"
                className="text-button"
                onClick={handleResend}
                disabled={secondsLeft > 0 || isSending || isSaving}
              >
                {secondsLeft > 0 ? `Resend OTP in ${secondsLeft}s` : isSending ? 'Resending...' : 'Resend OTP'}
              </button>
            </div>

            {error ? <p className="form-error">{error}</p> : null}
            {success ? <p className="form-success">{success}</p> : null}

            <div className="auth-modal-actions">
              <ActionButton type="button" tone="secondary" onClick={onClose} disabled={isSending || isSaving}>
                Later
              </ActionButton>
              <ActionButton type="submit" icon={ShieldCheck} disabled={isSending || isSaving} aria-busy={isSaving}>
                {isSaving ? 'Updating Password...' : 'Save New Password'}
              </ActionButton>
            </div>
          </form>
        )}
      </div>
    </ModalForm>
  )
}
