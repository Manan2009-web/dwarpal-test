import { useEffect, useMemo, useState } from 'react'
import { PencilLine, ShieldCheck } from 'lucide-react'
import { ActionButton, ModalForm } from './ui'
import OtpCodeInput from './OtpCodeInput'
import { getApiErrorMessage } from '../lib/dwarpalApi'

function maskEmailAddress(value) {
  const normalizedEmail = String(value || '').trim().toLowerCase()
  const [localPart = '', domain = ''] = normalizedEmail.split('@')

  if (!localPart || !domain) {
    return normalizedEmail
  }

  const visiblePart = localPart.slice(0, Math.min(2, localPart.length))
  return `${visiblePart}${'*'.repeat(Math.max(localPart.length - visiblePart.length, 1))}@${domain}`
}

export default function ForceEmailVerificationModal({
  open,
  currentUser,
  onSendOtp,
  onUpdateEmail,
  onVerifyOtp,
}) {
  const [otp, setOtp] = useState('')
  const [emailInput, setEmailInput] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [isEditingEmail, setIsEditingEmail] = useState(false)
  const [hasOtpRequest, setHasOtpRequest] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)

  const verificationEmail = currentUser?.verificationEmail || currentUser?.pendingEmail || currentUser?.email || ''
  const maskedEmail = useMemo(
    () => maskEmailAddress(verificationEmail || currentUser?.email || ''),
    [currentUser?.email, verificationEmail],
  )

  useEffect(() => {
    if (!open) {
      return
    }

    setOtp('')
    setEmailInput(verificationEmail)
    setError('')
    setSuccess('')
    setFieldErrors({})
    setIsEditingEmail(false)
    setIsSending(false)
    setIsUpdatingEmail(false)
    setIsVerifying(false)
  }, [open, verificationEmail])

  useEffect(() => {
    if (!open || secondsLeft <= 0) {
      return undefined
    }

    const timerId = window.setTimeout(() => {
      setSecondsLeft((previousValue) => Math.max(previousValue - 1, 0))
    }, 1000)

    return () => window.clearTimeout(timerId)
  }, [open, secondsLeft])

  function clearMessages() {
    setError('')
    setSuccess('')
    setFieldErrors({})
  }

  async function handleSendOtp() {
    if (secondsLeft > 0 || isSending || isUpdatingEmail || isVerifying) {
      return
    }

    clearMessages()
    setIsSending(true)

    try {
      const result = await onSendOtp?.()

      if (!result?.ok) {
        setError(result?.error || 'Unable to send the verification OTP right now.')
        if (result?.fieldErrors) {
          setFieldErrors(result.fieldErrors)
        }
        return
      }

      setHasOtpRequest(true)
      setSecondsLeft(Number(result.cooldownSeconds || 45))
      setSuccess(result.message || 'Verification OTP sent successfully.')
    } catch (error) {
      setError(getApiErrorMessage(error, 'Unable to send the verification OTP right now.'))
    } finally {
      setIsSending(false)
    }
  }

  async function handleUpdateEmail(event) {
    event.preventDefault()

    if (isUpdatingEmail || isSending || isVerifying) {
      return
    }

    clearMessages()
    setIsUpdatingEmail(true)

    try {
      const result = await onUpdateEmail?.(emailInput)

      if (!result?.ok) {
        setError(result?.error || 'Unable to update the verification email right now.')
        if (result?.fieldErrors) {
          setFieldErrors(result.fieldErrors)
        }
        return
      }

      setHasOtpRequest(true)
      setSecondsLeft(Number(result.cooldownSeconds || 45))
      setIsEditingEmail(false)
      setOtp('')
      setSuccess(result.message || 'Verification email updated successfully.')
    } catch (error) {
      setError(getApiErrorMessage(error, 'Unable to update the verification email right now.'))
    } finally {
      setIsUpdatingEmail(false)
    }
  }

  async function handleVerify(event) {
    event.preventDefault()

    if (otp.length !== 6 || isVerifying || isSending || isUpdatingEmail) {
      return
    }

    clearMessages()
    setIsVerifying(true)

    try {
      const result = await onVerifyOtp?.(otp)

      if (!result?.ok) {
        setError(result?.error || 'Unable to verify this OTP right now.')
        if (result?.fieldErrors) {
          setFieldErrors(result.fieldErrors)
        }
        return
      }

      setSuccess(result.message || 'Email verified successfully.')
    } catch (error) {
      setError(getApiErrorMessage(error, 'Unable to verify this OTP right now.'))
    } finally {
      setIsVerifying(false)
    }
  }

  return (
    <ModalForm
      open={open}
      onClose={undefined}
      title="Verify your email"
      subtitle="Your email is not verified. Please verify your email to continue."
      className="auth-modal-card verification-lock-modal"
      closeOnBackdrop={false}
      showCloseButton={false}
    >
      <div className="auth-otp-modal">
        <div className="auth-modal-email-chip">{maskedEmail || 'Add a verification email to continue.'}</div>
        <p className="field-hint">
          We will only unlock DwarPal after this email address is verified. Use the latest OTP sent to{' '}
          <strong>{maskedEmail || 'your account email'}</strong>.
        </p>

        {isEditingEmail ? (
          <form className="auth-otp-step-form" onSubmit={handleUpdateEmail}>
            <label>
              <span className="field-label-text">Verification Email</span>
              <input
                type="email"
                value={emailInput}
                onChange={(event) => {
                  setEmailInput(event.target.value)
                  setFieldErrors((previousErrors) => {
                    const nextErrors = { ...previousErrors }
                    delete nextErrors.email
                    return nextErrors
                  })
                  setError('')
                }}
                placeholder="Enter your email address"
                autoComplete="email"
                className={fieldErrors.email ? 'field-invalid' : ''}
                aria-invalid={Boolean(fieldErrors.email)}
                disabled={isUpdatingEmail || isSending || isVerifying}
                required
              />
              {fieldErrors.email ? <p className="field-error">{fieldErrors.email}</p> : null}
            </label>
            <div className="verification-modal-links">
              <button
                type="button"
                className="text-button"
                disabled={isUpdatingEmail || isSending || isVerifying}
                onClick={() => {
                  setIsEditingEmail(false)
                  setEmailInput(verificationEmail)
                  clearMessages()
                }}
              >
                Cancel edit
              </button>
              <ActionButton
                type="submit"
                icon={PencilLine}
                disabled={isUpdatingEmail || isSending || isVerifying}
                aria-busy={isUpdatingEmail}
              >
                {isUpdatingEmail ? 'Updating...' : 'Save Email'}
              </ActionButton>
            </div>
          </form>
        ) : (
          <div className="verification-modal-links">
            <button
              type="button"
              className="text-button"
              onClick={() => {
                clearMessages()
                setIsEditingEmail(true)
              }}
              disabled={isSending || isUpdatingEmail || isVerifying}
            >
              {verificationEmail ? 'Edit Email' : 'Add Email'}
            </button>
            <button
              type="button"
              className="text-button"
              onClick={handleSendOtp}
              disabled={secondsLeft > 0 || isSending || isUpdatingEmail || isVerifying}
            >
              {secondsLeft > 0
                ? `Resend OTP in ${secondsLeft}s`
                : isSending
                  ? 'Sending...'
                  : hasOtpRequest
                    ? 'Resend OTP'
                    : 'Send OTP'}
            </button>
          </div>
        )}

        <form className="auth-otp-step-form" onSubmit={handleVerify}>
          <label>
            <span className="field-label-text">Verification OTP</span>
            <OtpCodeInput value={otp} onChange={setOtp} autoFocus disabled={isSending || isUpdatingEmail || isVerifying} />
            {fieldErrors.otp ? <p className="field-error">{fieldErrors.otp}</p> : null}
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          {success ? <p className="form-success">{success}</p> : null}
          <div className="auth-modal-actions">
            <ActionButton
              type="submit"
              icon={ShieldCheck}
              disabled={otp.length !== 6 || isVerifying || isSending || isUpdatingEmail}
              aria-busy={isVerifying}
            >
              {isVerifying ? 'Verifying...' : 'Verify OTP'}
            </ActionButton>
          </div>
        </form>
      </div>
    </ModalForm>
  )
}
