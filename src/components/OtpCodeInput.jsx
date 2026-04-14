import { useEffect, useRef } from 'react'

export default function OtpCodeInput({
  value = '',
  onChange,
  length = 6,
  disabled = false,
  autoFocus = false,
  name = 'otp',
}) {
  const inputRefs = useRef([])
  const sanitizedValue = String(value || '')
    .replace(/\D/g, '')
    .slice(0, length)
  const digits = Array.from({ length }, (_, index) => sanitizedValue[index] || '')

  useEffect(() => {
    if (autoFocus && !disabled) {
      inputRefs.current[0]?.focus()
    }
  }, [autoFocus, disabled])

  function commitDigits(nextDigits) {
    onChange?.(nextDigits.join('').replace(/\D/g, '').slice(0, length))
  }

  function handleChange(index, event) {
    const nextValue = String(event.target.value || '').replace(/\D/g, '')
    const nextDigits = [...digits]

    if (!nextValue) {
      nextDigits[index] = ''
      commitDigits(nextDigits)
      return
    }

    if (nextValue.length > 1) {
      nextValue
        .slice(0, length)
        .split('')
        .forEach((digit, offset) => {
          const targetIndex = index + offset

          if (targetIndex < length) {
            nextDigits[targetIndex] = digit
          }
        })
      commitDigits(nextDigits)
      inputRefs.current[Math.min(index + nextValue.length, length - 1)]?.focus()
      return
    }

    nextDigits[index] = nextValue
    commitDigits(nextDigits)

    if (index < length - 1) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  function handleKeyDown(index, event) {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
      return
    }

    if (event.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus()
      return
    }

    if (event.key === 'ArrowRight' && index < length - 1) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  function handlePaste(event) {
    event.preventDefault()
    const pastedDigits = String(event.clipboardData?.getData('text') || '')
      .replace(/\D/g, '')
      .slice(0, length)

    if (!pastedDigits) {
      return
    }

    const nextDigits = Array.from({ length }, (_, index) => pastedDigits[index] || '')
    commitDigits(nextDigits)
    inputRefs.current[Math.min(pastedDigits.length - 1, length - 1)]?.focus()
  }

  return (
    <div className="otp-code-input" onPaste={handlePaste}>
      {digits.map((digit, index) => (
        <input
          key={`${name}-${index}`}
          ref={(element) => {
            inputRefs.current[index] = element
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          aria-label={`OTP digit ${index + 1}`}
          className="otp-code-input-box"
          value={digit}
          maxLength={1}
          name={index === 0 ? name : undefined}
          onChange={(event) => handleChange(index, event)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          disabled={disabled}
        />
      ))}
    </div>
  )
}
