import { useEffect, useState } from 'react'
import { MailCheck, ShieldCheck } from 'lucide-react'
import { ActionButton, ModalForm } from './ui'
import OtpCodeInput from './OtpCodeInput'

export default function StudentLoginOtpModal({
  open,
  maskedEmail,
  cooldownSeconds = 45,
  onClose,
  onResend,
  onVerify,
}) {
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(cooldownSeconds)
  const [isResending, setIsResending] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)

  useEffect(() => {
    if (!open) {
      return
    }

    setOtp('')
    setError('')
    setSuccess('')
    setSecondsLeft(Number(cooldownSeconds || 45))
    setIsResending(false)
    setIsVerifying(false)
  }, [cooldownSeconds, open])

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

    setIsVerifying(true)
    setError('')
    setSuccess('')

    const result = await onVerify?.(otp)

    if (!result?.ok) {
      setError(result?.error || 'Unable to verify this OTP right now.')
      setIsVerifying(false)
      return
    }

    setSuccess(result.message || 'OTP verified successfully.')
    setIsVerifying(false)
  }

  async function handleResend() {
    if (secondsLeft > 0 || isResending) {
      return
    }

    setIsResending(true)
    setError('')
    setSuccess('')

    const result = await onResend?.()

    if (!result?.ok) {
      setError(result?.error || 'Unable to resend OTP right now.')
      setIsResending(false)
      return
    }

    setSecondsLeft(Number(result.cooldownSeconds || 45))
    setSuccess(result.message || 'A new OTP has been sent.')
    setIsResending(false)
  }

  return (
    <ModalForm
      open={open}
      onClose={onClose}
      title="Verify student login"
      subtitle="Enter the OTP sent to the registered email before opening the student dashboard."
      className="auth-modal-card"
    >
      <div className="auth-otp-modal">
        <div className="auth-modal-email-chip">
          <MailCheck size={16} />
          <span>{maskedEmail || 'Registered student email'}</span>
        </div>

        <p className="field-hint">
          DwarPal sent a one-time code to your registered email. Enter the latest OTP to complete student sign-in.
        </p>

        <form className="auth-otp-step-form" onSubmit={handleVerify}>
          <label>
            <span className="field-label-text">Email OTP</span>
            <OtpCodeInput value={otp} onChange={setOtp} autoFocus disabled={isResending || isVerifying} />
          </label>

          {error ? <p className="form-error">{error}</p> : null}
          {success ? <p className="form-success">{success}</p> : null}

          <div className="auth-modal-inline-actions">
            <button
              type="button"
              className="text-button"
              onClick={handleResend}
              disabled={secondsLeft > 0 || isResending || isVerifying}
            >
              {secondsLeft > 0 ? `Resend OTP in ${secondsLeft}s` : isResending ? 'Resending...' : 'Resend OTP'}
            </button>
          </div>

          <div className="auth-modal-actions">
            <ActionButton type="button" tone="secondary" onClick={onClose} disabled={isResending || isVerifying}>
              Cancel
            </ActionButton>
            <ActionButton
              type="submit"
              icon={ShieldCheck}
              disabled={otp.length !== 6 || isResending || isVerifying}
              aria-busy={isVerifying}
            >
              {isVerifying ? 'Verifying OTP...' : 'Verify OTP'}
            </ActionButton>
          </div>
        </form>
      </div>
    </ModalForm>
  )
}
