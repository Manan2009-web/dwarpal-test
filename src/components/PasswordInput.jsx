import { useId, useMemo, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

export default function PasswordInput({
  id,
  value,
  onChange,
  placeholder,
  autoComplete = 'current-password',
  disabled = false,
  required = false,
  className = '',
  wrapperClassName = '',
  toggleClassName = '',
  ariaInvalid = false,
  name,
  ...props
}) {
  const generatedId = useId()
  const resolvedId = id || `password-input-${generatedId}`
  const [isVisible, setIsVisible] = useState(false)
  const inputType = isVisible ? 'text' : 'password'
  const toggleLabel = useMemo(
    () => (isVisible ? 'Hide password' : 'Show password'),
    [isVisible],
  )

  return (
    <div className={['password-input-wrapper', wrapperClassName].filter(Boolean).join(' ')}>
      <input
        id={resolvedId}
        name={name}
        type={inputType}
        value={value}
        onChange={(event) => onChange?.(event.target.value, event)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        disabled={disabled}
        required={required}
        aria-invalid={Boolean(ariaInvalid)}
        className={['password-input-field', className].filter(Boolean).join(' ')}
        {...props}
      />
      <button
        type="button"
        className={['password-visibility-toggle', toggleClassName].filter(Boolean).join(' ')}
        onClick={() => setIsVisible((previousValue) => !previousValue)}
        aria-label={toggleLabel}
        aria-pressed={isVisible}
        aria-controls={resolvedId}
        disabled={disabled}
      >
        {isVisible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  )
}
