import { Check, ShieldCheck } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import logo from '../../assets/dwarpal_logo.png'
import PasswordInput from '../PasswordInput'
import AppBrand from '../AppBrand'

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
      <label htmlFor={id} className="tw:block tw:text-[0.84rem] tw:font-semibold tw:text-neutral-700 tw:tracking-wide">
        {label}
      </label>
      <div className="tw:group tw:relative tw:mt-1.5">
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
              'tw:relative tw:w-full tw:h-12 tw:rounded-xl tw:border tw:bg-transparent tw:px-4 tw:py-3.5 tw:pr-12 tw:text-[0.98rem] tw:outline-none tw:transition tw:duration-200',
              error ? 'field-invalid' : 'tw:border-[#173449]/10',
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
              'tw:relative tw:w-full tw:h-12 tw:rounded-xl tw:border tw:bg-transparent tw:px-4 tw:py-3.5 tw:text-[0.98rem] tw:outline-none tw:transition tw:duration-200',
              error ? 'field-invalid' : 'tw:border-[#173449]/10',
            ].join(' ')}
          />
        )}
      </div>
      {error ? <p className="tw:text-[0.82rem] tw:font-medium tw:text-red-500 tw:mt-1">{error}</p> : null}
    </motion.div>
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
  showStudentRegisterLink = false,
}) {
  const reduceMotion = useReducedMotion()

  return (
    <div className="tw:relative tw:flex tw:w-full tw:flex-col tw:bg-transparent tw:text-[#163247]">
      <motion.div
        variants={formVariants}
        initial={reduceMotion ? false : 'hidden'}
        animate="visible"
        className="tw:relative tw:z-10 tw:flex tw:w-full tw:flex-col tw:justify-center"
      >
        <motion.div
          variants={itemVariants}
          className="tw:w-full tw:text-[#163247]"
        >
          <div className="tw:space-y-6">
            <motion.div
              variants={itemVariants}
              className="tw:flex tw:flex-col tw:items-center tw:text-center"
            >
              <div className="auth-brand-wrap">
                <AppBrand size="md" layout="stacked" centered />
              </div>
              <div className="tw:space-y-2 tw:-mt-1">
                <h2 className="tw:text-[#163247] tw:font-bold">
                  {title === 'DwarPal' ? 'Sign In' : title}
                </h2>
                <p className="tw:text-sm tw:font-medium tw:text-neutral-500">{subtitle}</p>
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
                  className="tw:inline-flex tw:min-h-[48px] tw:cursor-pointer tw:items-center tw:gap-3 tw:text-[0.94rem] tw:font-medium tw:text-neutral-600"
                >
                  <input
                    id="remember-me"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) => onRememberMeChange(event.target.checked)}
                    className="tw:peer tw:sr-only"
                  />
                  <span className="tw:flex tw:h-5 tw:w-5 tw:items-center tw:justify-center tw:rounded-md tw:border tw:border-[rgba(105,143,176,0.28)] tw:bg-[rgba(255,255,255,0.74)] tw:shadow-sm tw:transition tw:duration-200 peer-checked:border-[#2f6db5] peer-checked:bg-[#2f6db5]/10">
                    <Check className={`tw:h-3.5 tw:w-3.5 tw:text-[#2f6db5] tw:transition tw:duration-150 ${rememberMe ? 'tw:scale-100' : 'tw:scale-0'}`} />
                  </span>
                  Remember me
                </label>

                {showForgotPassword ? (
                  <button
                    type="button"
                    onClick={onForgotPassword}
                    disabled={isSubmitting}
                    className="tw:border-none tw:bg-transparent tw:p-0 tw:text-[0.92rem] tw:font-semibold tw:text-neutral-500 tw:underline tw:underline-offset-4 tw:transition tw:duration-200 hover:tw:text-[#2f6db5] disabled:tw:opacity-55"
                  >
                    Forgot password?
                  </button>
                ) : null}
              </motion.div>

              {error ? (
                <motion.div
                  variants={itemVariants}
                  role="alert"
                  className="form-error tw:mb-3"
                  style={{ textAlign: 'center', fontWeight: 500 }}
                >
                  {error}
                </motion.div>
              ) : null}

              {success ? (
                <motion.div
                  variants={itemVariants}
                  className="tw:rounded-xl tw:border tw:border-emerald-500/[0.15] tw:bg-emerald-500/[0.05] tw:px-4 tw:py-3 tw:text-[0.92rem] tw:font-medium tw:text-emerald-600 tw:backdrop-blur-md"
                >
                  {success}
                </motion.div>
              ) : null}

              <motion.button
                variants={itemVariants}
                type="submit"
                disabled={isSubmitting}
                aria-busy={isSubmitting}
                whileHover={reduceMotion || isSubmitting ? undefined : { y: -1, scale: 1.01 }}
                whileTap={reduceMotion || isSubmitting ? undefined : { scale: 0.99 }}
                className="action-button primary tw:w-full tw:flex tw:items-center tw:justify-center tw:gap-3 tw:h-12 tw:rounded-xl tw:font-semibold tw:text-base tw:text-white"
              >
                <ShieldCheck className="tw:h-5 tw:w-5" />
                {isSubmitting ? 'Signing in...' : submitLabel}
              </motion.button>
            </motion.form>

            {showStudentRegisterLink ? (
              <motion.div variants={itemVariants} className="tw:mt-5 tw:text-center">
                <p className="tw:text-[0.92rem] tw:text-neutral-500">
                  New student without an account?{' '}
                  <Link to="/student/register" className="tw:font-semibold tw:text-[#2f6db5] tw:underline tw:underline-offset-4 hover:tw:text-[#1d5290]">
                    Register here
                  </Link>
                </p>
              </motion.div>
            ) : showRegisterLink ? (
              <motion.div variants={itemVariants} className="tw:mt-5 tw:text-center">
                <p className="tw:text-[0.92rem] tw:text-neutral-500">
                  Don't have an account?{' '}
                  <Link to="/register" replace className="tw:font-semibold tw:text-[#2f6db5] tw:underline tw:underline-offset-4 hover:tw:text-[#1d5290]">
                    Register here
                  </Link>
                </p>
              </motion.div>
            ) : null}

            <motion.div variants={itemVariants} className="tw:mt-6 tw:text-center tw:text-[0.78rem] tw:text-neutral-400 tw:border-t tw:border-neutral-200 tw:pt-4">
              By signing in, you agree to our{' '}
              <Link to="/privacy-policy" className="tw:font-medium tw:text-[#2f6db5] hover:tw:text-[#1d5290] tw:underline">
                Privacy Policy
              </Link>
              . Need help? Visit{' '}
              <Link to="/support" className="tw:font-medium tw:text-[#2f6db5] hover:tw:text-[#1d5290] tw:underline">
                Support
              </Link>
              .
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  )
}
