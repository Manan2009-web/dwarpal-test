import { Check, ShieldCheck } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import logo from '../../assets/dwarpal_logo.png'
import PasswordInput from '../PasswordInput'

const formVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.08,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.42,
      ease: [0.22, 1, 0.36, 1],
    },
  },
}

function FormField({
  id,
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  autoComplete,
  error,
  disabled,
}) {
  const isPasswordField = type === 'password'

  return (
    <motion.div variants={itemVariants} className="tw:space-y-2">
      <label htmlFor={id} className="tw:block tw:text-[0.84rem] tw:font-semibold tw:text-[#425f78]">
        {label}
      </label>
      <div className="tw:group tw:relative">
        <div className="tw:absolute tw:inset-0 tw:rounded-xl tw:bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(227,239,251,0.72))]" />
        {isPasswordField ? (
          <PasswordInput
            id={id}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            autoComplete={autoComplete}
            disabled={disabled}
            ariaInvalid={Boolean(error)}
            wrapperClassName="tw:relative tw:z-[1]"
            className={[
              'tw:relative tw:w-full tw:h-12 tw:rounded-xl tw:border tw:bg-transparent tw:px-4 tw:py-3.5 tw:pr-12 tw:text-[0.98rem] tw:text-dwarpal-ink tw:shadow-[0_12px_30px_rgba(34,87,128,0.08)] tw:outline-none tw:transition tw:duration-200 tw:placeholder:text-[#7b90a3] tw:focus:border-[#2f6db5] tw:focus:shadow-[0_0_0_4px_rgba(47,109,181,0.14),0_18px_32px_rgba(34,87,128,0.12)] tw:disabled:cursor-not-allowed tw:disabled:opacity-65',
              error ? 'tw:border-[#d65763]' : 'tw:border-[rgba(105,143,176,0.22)]',
            ].join(' ')}
            toggleClassName="tw:absolute tw:right-3 tw:top-0 tw:bottom-0 tw:my-auto tw:grid tw:h-9 tw:w-9 tw:place-items-center tw:rounded-lg tw:border tw:border-[rgba(105,143,176,0.28)] tw:bg-[rgba(255,255,255,0.74)] tw:text-[#48637c] tw:transition tw:duration-200 hover:tw:bg-white hover:tw:text-[#2f6db5] focus-visible:tw:outline-none disabled:tw:cursor-not-allowed"
          />
        ) : (
          <input
            id={id}
            type={type}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            autoComplete={autoComplete}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            className={[
              'tw:relative tw:w-full tw:h-12 tw:rounded-xl tw:border tw:bg-transparent tw:px-4 tw:py-3.5 tw:text-[0.98rem] tw:text-dwarpal-ink tw:shadow-[0_12px_30px_rgba(34,87,128,0.08)] tw:outline-none tw:transition tw:duration-200 tw:placeholder:text-[#7b90a3] tw:focus:border-[#2f6db5] tw:focus:shadow-[0_0_0_4px_rgba(47,109,181,0.14),0_18px_32px_rgba(34,87,128,0.12)] tw:disabled:cursor-not-allowed tw:disabled:opacity-65',
              error ? 'tw:border-[#d65763]' : 'tw:border-[rgba(105,143,176,0.22)]',
            ].join(' ')}
          />
        )}
      </div>
      {error ? <p className="tw:text-[0.82rem] tw:font-medium tw:text-[#d65763]">{error}</p> : null}
    </motion.div>
  )
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="tw:h-5 tw:w-5">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5Z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7Z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.5-5.2l-6.2-5.2c-2.1 1.6-4.7 2.4-7.3 2.4-5.2 0-9.6-3.3-11.2-7.9l-6.5 5C9.6 39.6 16.3 44 24 44Z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6h.1l6.2 5.2C37 38.5 44 34 44 24c0-1.2-.1-2.4-.4-3.5Z" />
    </svg>
  )
}

export default function LoginForm({
  id,
  identifier,
  password,
  rememberMe,
  onIdentifierChange,
  onPasswordChange,
  onRememberMeChange,
  onForgotPassword,
  onSubmit,
  error,
  success,
  fieldErrors,
  isSubmitting,
  identifierLabel = 'Enrollment number / Employee ID',
  identifierPlaceholder = 'Enter your enrollment number or employee ID',
  title = 'DwarPal',
  subtitle = 'Sign in to continue',
  submitLabel = 'Sign in',
  showForgotPassword = true,
  showRegisterLink = true,
}) {
  const reduceMotion = useReducedMotion()

  return (
    <div className="tw:relative tw:flex tw:w-full tw:max-w-[29rem] tw:flex-col tw:bg-transparent tw:text-dwarpal-ink">
      <motion.div
        variants={formVariants}
        initial={reduceMotion ? false : 'hidden'}
        animate="visible"
        className="tw:relative tw:z-10 tw:flex tw:w-full tw:flex-col tw:justify-center"
      >
        <motion.div
          variants={itemVariants}
          className="tw:w-full tw:rounded-[32px] tw:border tw:border-white/80 tw:bg-[rgba(255,255,255,0.82)] tw:p-6 tw:shadow-[0_24px_72px_rgba(34,87,128,0.12)] tw:backdrop-blur-[22px] tw:sm:p-8"
        >
          <div className="tw:space-y-6">
            <motion.div
              variants={itemVariants}
              className="tw:flex tw:flex-col tw:items-center tw:gap-4 tw:text-center"
            >
              <div className="tw:flex tw:h-28 tw:w-28 tw:items-center tw:justify-center tw:rounded-3xl tw:border tw:border-white/85 tw:bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(224,239,255,0.94))] tw:shadow-[0_20px_38px_rgba(34,87,128,0.12)]">
                <img src={logo} alt="DwarPal logo" className="tw:h-20 tw:w-20 tw:object-contain" />
              </div>
              <div className="tw:space-y-2">
                <h1 className="tw:font-display tw:text-3xl tw:font-bold tw:leading-none tw:tracking-[-0.05em] tw:text-dwarpal-ink">
                  {title}
                </h1>
                <p className="tw:text-sm tw:font-medium tw:text-dwarpal-muted">{subtitle}</p>
              </div>
            </motion.div>

            <motion.form variants={formVariants} onSubmit={onSubmit} noValidate className="tw:space-y-5">
              <FormField
                id="login-identifier"
                label={identifierLabel}
                value={identifier}
                onChange={onIdentifierChange}
                placeholder={identifierPlaceholder}
                autoComplete="username"
                error={fieldErrors.identifier}
                disabled={isSubmitting}
              />

              <FormField
                id="login-password"
                type="password"
                label="Password"
                value={password}
                onChange={onPasswordChange}
                placeholder="Enter your password"
                autoComplete="current-password"
                error={fieldErrors.password}
                disabled={isSubmitting}
              />

              <motion.div
                variants={itemVariants}
                className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-3"
              >
                <label
                  htmlFor="remember-me"
                  className="tw:inline-flex tw:min-h-[48px] tw:cursor-pointer tw:items-center tw:gap-3 tw:text-[0.94rem] tw:font-medium tw:text-[#46647f]"
                >
                  <input
                    id="remember-me"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) => onRememberMeChange(event.target.checked)}
                    className="tw:peer tw:sr-only"
                  />
                  <span className="tw:flex tw:h-5 tw:w-5 tw:items-center tw:justify-center tw:rounded-md tw:border tw:border-[rgba(93,132,167,0.3)] tw:bg-white tw:shadow-[0_8px_18px_rgba(34,87,128,0.08)] tw:transition tw:duration-200 tw:peer-checked:border-[#2f6db5] tw:peer-checked:bg-[#2f6db5]">
                    <Check className="tw:h-3.5 tw:w-3.5 tw:scale-0 tw:text-white tw:transition tw:duration-150 tw:peer-checked:scale-100" />
                  </span>
                  Remember me
                </label>

                {showForgotPassword ? (
                  <button
                    type="button"
                    onClick={onForgotPassword}
                    disabled={isSubmitting}
                    className="tw:border-none tw:bg-transparent tw:p-0 tw:text-[0.92rem] tw:font-semibold tw:text-[#2f6db5] tw:underline tw:underline-offset-4 tw:transition tw:duration-200 hover:tw:text-[#214f84] disabled:tw:opacity-55"
                  >
                    Forgot password?
                  </button>
                ) : null}
              </motion.div>

              {error ? (
                <motion.div
                  variants={itemVariants}
                  role="alert"
                  className="tw:rounded-[18px] tw:border tw:border-[rgba(214,87,99,0.28)] tw:bg-[rgba(255,240,242,0.9)] tw:px-4 tw:py-3 tw:text-[0.92rem] tw:font-medium tw:text-[#c24b58]"
                >
                  {error}
                </motion.div>
              ) : null}

              {success ? (
                <motion.div
                  variants={itemVariants}
                  className="tw:rounded-[18px] tw:border tw:border-[rgba(76,178,114,0.24)] tw:bg-[rgba(239,252,244,0.94)] tw:px-4 tw:py-3 tw:text-[0.92rem] tw:font-medium tw:text-[#2c8c52]"
                >
                  {success}
                </motion.div>
              ) : null}

              <motion.button
                variants={itemVariants}
                type="submit"
                disabled={isSubmitting}
                aria-busy={isSubmitting}
                whileHover={reduceMotion || isSubmitting ? undefined : { y: -2, scale: 1.01 }}
                whileTap={reduceMotion || isSubmitting ? undefined : { scale: 0.99 }}
                className="tw:flex tw:h-12 tw:w-full tw:items-center tw:justify-center tw:gap-3 tw:rounded-xl tw:border-none tw:bg-[linear-gradient(135deg,#387dcc,#25578f)] tw:px-5 tw:py-3.5 tw:text-[1rem] tw:font-semibold tw:text-white tw:shadow-[0_20px_38px_rgba(37,87,143,0.28)] tw:transition tw:duration-200 hover:tw:shadow-[0_24px_44px_rgba(37,87,143,0.34)] tw:disabled:cursor-not-allowed tw:disabled:opacity-70"
              >
                <ShieldCheck className="tw:h-5 tw:w-5" />
                {isSubmitting ? 'Signing in...' : submitLabel}
              </motion.button>
            </motion.form>

            {showRegisterLink ? (
              <motion.div variants={itemVariants} className="tw:mt-5 tw:text-center">
                <p className="tw:text-[0.92rem] tw:text-dwarpal-muted">
                  Don't have an account?{' '}
                  <Link to="/register" replace className="tw:font-semibold tw:text-[#2f6db5] tw:underline tw:underline-offset-4 hover:tw:text-[#214f84]">
                    Register here
                  </Link>
                </p>
              </motion.div>
            ) : null}
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}
