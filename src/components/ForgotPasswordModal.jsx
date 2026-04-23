import { useEffect, useState } from 'react'
import { KeyRound } from 'lucide-react'
import { ActionButton, ModalForm } from './ui'
import OtpCodeInput from './OtpCodeInput'
import PasswordInput from './PasswordInput'
import { getApiErrorMessage } from '../lib/dwarpalApi'

const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/

export default function ForgotPasswordModal({
  open,
  identifier,
  onClose,
  onResolveAccount,
  onStart,
  onVerifyOtp,
  onResetPassword,
  onComplete,
}) {
  const [step, setStep] = useState('request')
  const [email, setEmail] = useState('')
  const [maskedEmail, setMaskedEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [isResolving, setIsResolving] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  useEffect(() => {
    if (!open) {
      return
    }

    setStep('request')
    setEmail('')
    setMaskedEmail('')
    setOtp('')
    setNewPassword('')
    setConfirmPassword('')
    setError('')
    setSuccess('')
    setFieldErrors({})
    setSecondsLeft(0)
    setIsSending(false)
    setIsVerifying(false)
    setIsResetting(false)
  }, [identifier, open])

  useEffect(() => {
    if (!open || !identifier) {
      return
    }

    let ignore = false

    async function resolveAccount() {
      setIsResolving(true)
      setError('')
      setSuccess('')
      setFieldErrors({})

      try {
        const result = await onResolveAccount?.(identifier)

        if (!result?.ok) {
          if (!ignore) {
            setEmail('')
            setMaskedEmail('')
            setError(result?.error || 'Unable to find the registered email for this account.')
            if (result?.fieldErrors) {
              setFieldErrors(result.fieldErrors)
            }
          }
          return
        }

        if (!ignore) {
          setEmail(result.email || '')
          setMaskedEmail(result.maskedEmail || '')
          setSuccess(result.message || '')
        }
      } catch (error) {
        if (!ignore) {
          setError(getApiErrorMessage(error, 'Unable to find the registered email for this account.'))
        }
      } finally {
        if (!ignore) {
          setIsResolving(false)
        }
      }
    }

    resolveAccount()

    return () => {
      ignore = true
    }
  }, [identifier, onResolveAccount, open])

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

  function updatePasswordField(field, value) {
    clearMessages()

    if (field === 'newPassword') {
      setNewPassword(value)
      setFieldErrors((previousErrors) => {
        const nextErrors = { ...previousErrors }
        delete nextErrors.newPassword
        return nextErrors
      })
      return
    }

    setConfirmPassword(value)
    setFieldErrors((previousErrors) => {
      const nextErrors = { ...previousErrors }
      delete nextErrors.confirmPassword
      return nextErrors
    })
  }

  async function handleStart() {
    if (isResolving || isSending || !identifier) {
      return
    }

    clearMessages()
    setIsSending(true)

    try {
      const result = await onStart?.({ identifier, email })

      if (!result?.ok) {
        setError(result?.error || 'Unable to send the OTP right now.')
        if (result?.fieldErrors) {
          setFieldErrors(result.fieldErrors)
        }
        return
      }

      setEmail(result.email || email)
      setMaskedEmail(result.maskedEmail || maskedEmail)
      setStep('verify')
      setSecondsLeft(Number(result.cooldownSeconds || 45))
      setSuccess(result.message || 'Password reset OTP sent successfully.')
    } catch (error) {
      setError(getApiErrorMessage(error, 'Unable to send the OTP right now.'))
    } finally {
      setIsSending(false)
    }
  }

  async function handleVerifyOtp(event) {
    event.preventDefault()

    if (otp.length !== 6 || isVerifying) {
      return
    }

    clearMessages()
    setIsVerifying(true)

    try {
      const result = await onVerifyOtp?.({ email, otp })

      if (!result?.ok) {
        setError(result?.error || 'Unable to verify this OTP right now.')
        if (result?.fieldErrors) {
          setFieldErrors(result.fieldErrors)
        }
        return
      }

      setStep('reset')
      setSuccess(result.message || 'OTP verified successfully. Set your new password below.')
    } catch (error) {
      setError(getApiErrorMessage(error, 'Unable to verify this OTP right now.'))
    } finally {
      setIsVerifying(false)
    }
  }

  async function handleResendOtp() {
    if (secondsLeft > 0 || isSending) {
      return
    }

    await handleStart()
  }

  async function handleResetPassword(event) {
    event.preventDefault()

    if (isResetting) {
      return
    }

    const nextFieldErrors = {}

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

    clearMessages()
    setIsResetting(true)

    try {
      const result = await onResetPassword?.({
        email,
        otp,
        newPassword,
        confirmPassword,
      })

      if (!result?.ok) {
        setError(result?.error || 'Unable to reset your password right now.')
        if (result?.fieldErrors) {
          setFieldErrors(result.fieldErrors)
        }
        return
      }

      setSuccess(result.message || 'Password reset successful.')
      onComplete?.(result)
    } catch (error) {
      setError(getApiErrorMessage(error, 'Unable to reset your password right now.'))
    } finally {
      setIsResetting(false)
    }
  }

  const title =
    step === 'request' ? 'Forgot password' : step === 'verify' ? 'Verify reset OTP' : 'Create a new password'
  const subtitle =
    step === 'request'
      ? 'We will fetch the registered email for this enrollment number or employee ID and send a 6-digit OTP.'
      : step === 'verify'
        ? 'Enter the 6-digit OTP sent to your registered email.'
        : 'Choose a strong new password for your DwarPal account.'

  return (
    <ModalForm open={open} onClose={onClose} title={title} subtitle={subtitle} className="auth-modal-card">
      <div className="auth-otp-modal">
        <label className="auth-readonly-field">
          <span className="field-label-text">Enrollment Number / Employee ID</span>
          <input value={identifier} readOnly aria-readonly="true" />
        </label>

        {step === 'request' ? (
          <>
            <label>
              <span className="field-label-text">Registered Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value)
                  setFieldErrors((previousErrors) => {
                    const nextErrors = { ...previousErrors }
                    delete nextErrors.email
                    return nextErrors
                  })
                  setError('')
                  setSuccess('')
                }}
                autoComplete="email"
                className={fieldErrors.email ? 'field-invalid' : ''}
                aria-invalid={Boolean(fieldErrors.email)}
                disabled={isResolving || isSending}
                placeholder="Registered email will appear here"
                required
              />
              {fieldErrors.email ? <p className="field-error">{fieldErrors.email}</p> : null}
            </label>
            <p className="field-hint">
              {maskedEmail
                ? `We found this account email: ${maskedEmail}. You can edit it if you need to match the registered address exactly before sending the OTP.`
                : 'We will fetch the registered email automatically from this account before sending the OTP.'}
            </p>
            {error ? <p className="form-error">{error}</p> : null}
            {success ? <p className="form-success">{success}</p> : null}
            {isResolving ? <p className="field-hint">Looking up the registered email...</p> : null}
            <div className="auth-modal-actions">
              <ActionButton type="button" tone="secondary" onClick={onClose} disabled={isResolving || isSending}>
                Cancel
              </ActionButton>
              <ActionButton
                type="button"
                icon={KeyRound}
                onClick={handleStart}
                disabled={isResolving || isSending || !identifier || !email}
                aria-busy={isSending}
              >
                {isSending ? 'Sending OTP...' : 'Send OTP'}
              </ActionButton>
            </div>
          </>
        ) : null}

        {step === 'verify' ? (
          <form onSubmit={handleVerifyOtp} className="auth-otp-step-form">
            <label className="auth-readonly-field">
              <span className="field-label-text">OTP Email</span>
              <input value={email} readOnly aria-readonly="true" />
            </label>
            <p className="field-hint">The OTP expires in 5 minutes. Keep this tab open while you verify it.</p>
            <OtpCodeInput value={otp} onChange={setOtp} autoFocus disabled={isSending || isVerifying} />
            {fieldErrors.otp ? <p className="field-error">{fieldErrors.otp}</p> : null}
            {error ? <p className="form-error">{error}</p> : null}
            {success ? <p className="form-success">{success}</p> : null}
            <div className="auth-modal-inline-actions">
              <button
                type="button"
                className="text-button"
                onClick={handleResendOtp}
                disabled={secondsLeft > 0 || isSending || isVerifying}
              >
                {secondsLeft > 0 ? `Resend OTP in ${secondsLeft}s` : isSending ? 'Resending...' : 'Resend OTP'}
              </button>
            </div>
            <div className="auth-modal-actions">
              <ActionButton type="button" tone="secondary" onClick={onClose} disabled={isSending || isVerifying}>
                Cancel
              </ActionButton>
              <ActionButton
                type="submit"
                icon={KeyRound}
                disabled={otp.length !== 6 || isSending || isVerifying}
                aria-busy={isVerifying}
              >
                {isVerifying ? 'Verifying OTP...' : 'Verify OTP'}
              </ActionButton>
            </div>
          </form>
        ) : null}

        {step === 'reset' ? (
          <form onSubmit={handleResetPassword} className="auth-otp-step-form">
            <label>
              <span className="field-label-text">New Password</span>
              <PasswordInput
                value={newPassword}
                onChange={(value) => updatePasswordField('newPassword', value)}
                autoComplete="new-password"
                className={fieldErrors.newPassword ? 'field-invalid' : ''}
                ariaInvalid={Boolean(fieldErrors.newPassword)}
                disabled={isResetting}
                required
              />
              {fieldErrors.newPassword ? <p className="field-error">{fieldErrors.newPassword}</p> : null}
            </label>
            <label>
              <span className="field-label-text">Confirm Password</span>
              <PasswordInput
                value={confirmPassword}
                onChange={(value) => updatePasswordField('confirmPassword', value)}
                autoComplete="new-password"
                className={fieldErrors.confirmPassword ? 'field-invalid' : ''}
                ariaInvalid={Boolean(fieldErrors.confirmPassword)}
                disabled={isResetting}
                required
              />
              {fieldErrors.confirmPassword ? <p className="field-error">{fieldErrors.confirmPassword}</p> : null}
            </label>
            {error ? <p className="form-error">{error}</p> : null}
            {success ? <p className="form-success">{success}</p> : null}
            <div className="auth-modal-actions">
              <ActionButton type="button" tone="secondary" onClick={onClose} disabled={isResetting}>
                Cancel
              </ActionButton>
              <ActionButton type="submit" icon={KeyRound} disabled={isResetting} aria-busy={isResetting}>
                {isResetting ? 'Updating Password...' : 'Reset Password'}
              </ActionButton>
            </div>
          </form>
        ) : null}
      </div>
    </ModalForm>
  )
}
