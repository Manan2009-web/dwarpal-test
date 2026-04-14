import { useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { ActionButton, ModalForm } from './ui'
import OtpCodeInput from './OtpCodeInput'
import { getApiErrorMessage } from '../lib/dwarpalApi'

export default function RegisterOtpModal({
  open,
  email,
  initialCooldownSeconds = 45,
  onClose,
  onVerify,
  onResend,
  onVerified,
}) {
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(initialCooldownSeconds)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isResending, setIsResending] = useState(false)

  useEffect(() => {
    if (!open) {
      return
    }

    setOtp('')
    setError('')
    setSuccess('')
    setSecondsLeft(initialCooldownSeconds)
    setIsVerifying(false)
    setIsResending(false)
  }, [email, initialCooldownSeconds, open])

  useEffect(() => {
    if (!open || secondsLeft <= 0) {
      return undefined
    }

    const timerId = window.setTimeout(() => {
      setSecondsLeft((previousValue) => Math.max(previousValue - 1, 0))
    }, 1000)

    return () => window.clearTimeout(timerId)
  }, [open, secondsLeft])

  async function handleVerify(event) {
    event.preventDefault()

    if (otp.length !== 6 || isVerifying) {
      return
    }

    setError('')
    setSuccess('')
    setIsVerifying(true)

    try {
      const result = await onVerify?.({ email, otp })

      if (!result?.ok) {
        setError(result?.error || 'Unable to verify this OTP right now.')
        return
      }

      setSuccess(result.message || 'Email verified successfully.')
      onVerified?.(result)
    } catch (error) {
      setError(getApiErrorMessage(error, 'Unable to verify this OTP right now.'))
    } finally {
      setIsVerifying(false)
    }
  }

  async function handleResend() {
    if (secondsLeft > 0 || isResending) {
      return
    }

    setError('')
    setSuccess('')
    setIsResending(true)

    try {
      const result = await onResend?.(email)

      if (!result?.ok) {
        setError(result?.error || 'Unable to resend the OTP right now.')
        return
      }

      setSecondsLeft(Number(result.cooldownSeconds || initialCooldownSeconds))
      setOtp('')
      setSuccess(result.message || 'A new verification OTP has been sent.')
    } catch (error) {
      setError(getApiErrorMessage(error, 'Unable to resend the OTP right now.'))
    } finally {
      setIsResending(false)
    }
  }

  return (
    <ModalForm
      open={open}
      onClose={onClose}
      title="Verify your email"
      subtitle="Enter the 6-digit OTP we just sent to complete your account creation."
      className="auth-modal-card"
    >
      <form className="auth-otp-modal" onSubmit={handleVerify}>
        <div className="auth-modal-email-chip">{email}</div>
        <p className="field-hint">Your OTP expires in 5 minutes. Please do not share it with anyone.</p>
        <OtpCodeInput value={otp} onChange={setOtp} autoFocus disabled={isVerifying || isResending} />
        {error ? <p className="form-error">{error}</p> : null}
        {success ? <p className="form-success">{success}</p> : null}
        <div className="auth-modal-inline-actions">
          <button
            type="button"
            className="text-button"
            onClick={handleResend}
            disabled={secondsLeft > 0 || isResending}
          >
            {secondsLeft > 0 ? `Resend OTP in ${secondsLeft}s` : isResending ? 'Resending...' : 'Resend OTP'}
          </button>
          <span className="field-hint">Need to fix the email? Close this modal and update the form.</span>
        </div>
        <div className="auth-modal-actions">
          <ActionButton type="button" tone="secondary" onClick={onClose} disabled={isVerifying || isResending}>
            Cancel
          </ActionButton>
          <ActionButton
            type="submit"
            icon={ShieldCheck}
            disabled={otp.length !== 6 || isVerifying || isResending}
            aria-busy={isVerifying}
          >
            {isVerifying ? 'Verifying...' : 'Verify OTP'}
          </ActionButton>
        </div>
      </form>
    </ModalForm>
  )
}
