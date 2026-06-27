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
      <label htmlFor={id} className="tw:block tw:text-[0.84rem] tw:font-semibold tw:text-white/60 tw:tracking-wide">
        {label}
      </label>
      <div className="tw:group tw:relative">
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
              'tw:relative tw:w-full tw:h-12 tw:rounded-xl tw:border tw:bg-black/[0.25] tw:px-4 tw:py-3.5 tw:pr-12 tw:text-[0.98rem] tw:text-white tw:tracking-wide tw:shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)] tw:outline-none tw:transition tw:duration-200 tw:placeholder:text-white/30 tw:focus:border-white/[0.2] tw:focus:shadow-[inset_0_2px_4px_rgba(0,0,0,0.4),0_0_20px_rgba(255,255,255,0.04)] tw:disabled:cursor-not-allowed tw:disabled:opacity-65',
              error ? 'tw:border-red-500/40' : 'tw:border-white/[0.04]',
            ].join(' ')}
            toggleClassName="tw:absolute tw:right-3 tw:top-0 tw:bottom-0 tw:my-auto tw:grid tw:h-9 tw:w-9 tw:place-items-center tw:rounded-lg tw:text-white/40 tw:transition tw:duration-200 hover:tw:text-white/70 focus-visible:tw:outline-none disabled:tw:cursor-not-allowed"
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
              'tw:relative tw:w-full tw:h-12 tw:rounded-xl tw:border tw:bg-black/[0.25] tw:px-4 tw:py-3.5 tw:text-[0.98rem] tw:text-white tw:tracking-wide tw:shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)] tw:outline-none tw:transition tw:duration-200 tw:placeholder:text-white/30 tw:focus:border-white/[0.2] tw:focus:shadow-[inset_0_2px_4px_rgba(0,0,0,0.4),0_0_20px_rgba(255,255,255,0.04)] tw:disabled:cursor-not-allowed tw:disabled:opacity-65',
              error ? 'tw:border-red-500/40' : 'tw:border-white/[0.04]',
            ].join(' ')}
          />
        )}
      </div>
      {error ? <p className="tw:text-[0.82rem] tw:font-medium tw:text-red-400">{error}</p> : null}
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
}) {
  const reduceMotion = useReducedMotion()

  return (
    <div className="tw:relative tw:flex tw:w-full tw:flex-col tw:bg-transparent tw:text-white">
      <motion.div
        variants={formVariants}
        initial={reduceMotion ? false : 'hidden'}
        animate="visible"
        className="tw:relative tw:z-10 tw:flex tw:w-full tw:flex-col tw:justify-center"
      >
        <motion.div
          variants={itemVariants}
          className="tw:w-full tw:text-white"
        >
          <div className="tw:space-y-6">
            <motion.div
              variants={itemVariants}
              className="tw:flex tw:flex-col tw:items-center tw:text-center"
            >
              {/* CLEAN RAW LOGO LAYER (NO BACKGROUND BOX CONTAINER) */}
              <div className="tw:mb-1 tw:flex tw:items-center tw:justify-center tw:w-full">
                <img 
                  src={logo} 
                  alt="DwarPal Logo" 
                  className="tw:w-[96px] tw:h-[64px] tw:object-contain tw:block tw:filter tw:drop-shadow-[0_4px_10px_rgba(255,255,255,0.05)]"
                />
              </div>
              <div className="tw:space-y-2 tw:-mt-1">
                <h1 className="tw:font-display tw:text-3xl tw:font-bold tw:leading-none tw:tracking-[-0.05em] tw:text-white">
                  {title}
                </h1>
                <p className="tw:text-sm tw:font-medium tw:text-white/50">{subtitle}</p>
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
                  className="tw:inline-flex tw:min-h-[48px] tw:cursor-pointer tw:items-center tw:gap-3 tw:text-[0.94rem] tw:font-medium tw:text-white/60"
                >
                  <input
                    id="remember-me"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) => onRememberMeChange(event.target.checked)}
                    className="tw:peer tw:sr-only"
                  />
                  <span className="tw:flex tw:h-5 tw:w-5 tw:items-center tw:justify-center tw:rounded-md tw:border tw:border-white/[0.1] tw:bg-black/[0.25] tw:shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)] tw:transition tw:duration-200 tw:peer-checked:border-white/[0.3] tw:peer-checked:bg-white/[0.12]">
                    <Check className="tw:h-3.5 tw:w-3.5 tw:scale-0 tw:text-white tw:transition tw:duration-150 tw:peer-checked:scale-100" />
                  </span>
                  Remember me
                </label>

                {showForgotPassword ? (
                  <button
                    type="button"
                    onClick={onForgotPassword}
                    disabled={isSubmitting}
                    className="tw:border-none tw:bg-transparent tw:p-0 tw:text-[0.92rem] tw:font-semibold tw:text-white/40 tw:underline tw:underline-offset-4 tw:transition tw:duration-200 hover:tw:text-white/70 disabled:tw:opacity-55"
                  >
                    Forgot password?
                  </button>
                ) : null}
              </motion.div>

              {error ? (
                <motion.div
                  variants={itemVariants}
                  role="alert"
                  className="tw:rounded-xl tw:border tw:border-red-500/[0.15] tw:bg-red-500/[0.05] tw:px-4 tw:py-3 tw:text-[0.92rem] tw:font-medium tw:text-red-400 tw:backdrop-blur-md"
                >
                  {error}
                </motion.div>
              ) : null}

              {success ? (
                <motion.div
                  variants={itemVariants}
                  className="tw:rounded-xl tw:border tw:border-emerald-500/[0.15] tw:bg-emerald-500/[0.05] tw:px-4 tw:py-3 tw:text-[0.92rem] tw:font-medium tw:text-emerald-400 tw:backdrop-blur-md"
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
                className="tw:flex tw:h-12 tw:w-full tw:items-center tw:justify-center tw:gap-3 tw:rounded-xl tw:border tw:border-white/[0.18] tw:bg-white/[0.06] tw:backdrop-blur-xl tw:px-5 tw:py-3.5 tw:text-[1rem] tw:font-medium tw:text-white tw:transition-all tw:duration-300 tw:ease-out hover:tw:bg-white/[0.12] tw:disabled:cursor-not-allowed tw:disabled:opacity-70"
              >
                <ShieldCheck className="tw:h-5 tw:w-5" />
                {isSubmitting ? 'Signing in...' : submitLabel}
              </motion.button>
            </motion.form>

            {showRegisterLink ? (
              <motion.div variants={itemVariants} className="tw:mt-5 tw:text-center">
                <p className="tw:text-[0.92rem] tw:text-white/40">
                  Don't have an account?{' '}
                  <Link to="/register" replace className="tw:font-semibold tw:text-white/70 tw:underline tw:underline-offset-4 hover:tw:text-white">
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
