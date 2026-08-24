/**
 * PasswordInput — Redesigned with AnimatePresence cross-fade eye icon.
 * All prop signatures unchanged.
 */
import { useId, useMemo, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'

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
        onChange={(event) => {
          if (typeof onChange === 'function') {
            onChange(event.target.value, event)
          }
        }}
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
        {/* AnimatePresence cross-fade between Eye and EyeOff */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={isVisible ? 'eye-off' : 'eye-on'}
            initial={{ opacity: 0, scale: 0.8, rotate: -15 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.8, rotate: 15 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            style={{ display: 'inline-flex' }}
          >
            {isVisible ? <EyeOff size={18} /> : <Eye size={18} />}
          </motion.span>
        </AnimatePresence>
      </button>
    </div>
  )
}
