import { Check, UserPlus, ArrowLeft } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import logo from '../../assets/dwarpal_logo.png'
import PasswordInput from '../PasswordInput'

const formVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.05,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
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
  className = '',
}) {
  const isPasswordField = type === 'password'

  return (
    <motion.div variants={itemVariants} className={`tw:space-y-1.5 ${className}`}>
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
              'tw:relative tw:w-full tw:h-11 tw:rounded-xl tw:border tw:bg-transparent tw:px-4 tw:py-2.5 tw:pr-12 tw:text-[0.94rem] tw:text-dwarpal-ink tw:shadow-[0_10px_24px_rgba(34,87,128,0.06)] tw:outline-none tw:transition tw:duration-200 tw:placeholder:text-[#7b90a3] tw:focus:border-[#2f6db5] tw:focus:shadow-[0_0_0_4px_rgba(47,109,181,0.14),0_14px_28px_rgba(34,87,128,0.1)] tw:disabled:cursor-not-allowed tw:disabled:opacity-65',
              error ? 'tw:border-[#d65763]' : 'tw:border-[rgba(105,143,176,0.22)]',
            ].join(' ')}
            toggleClassName="tw:absolute tw:right-3 tw:top-0 tw:bottom-0 tw:my-auto tw:grid tw:h-8 tw:w-8 tw:place-items-center tw:rounded-lg tw:border tw:border-[rgba(105,143,176,0.28)] tw:bg-[rgba(255,255,255,0.74)] tw:text-[#48637c] tw:transition tw:duration-200 hover:tw:bg-white hover:tw:text-[#2f6db5] focus-visible:tw:outline-none disabled:tw:cursor-not-allowed"
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
              'tw:relative tw:w-full tw:h-11 tw:rounded-xl tw:border tw:bg-transparent tw:px-4 tw:py-2.5 tw:text-[0.94rem] tw:text-dwarpal-ink tw:shadow-[0_10px_24px_rgba(34,87,128,0.06)] tw:outline-none tw:transition tw:duration-200 tw:placeholder:text-[#7b90a3] tw:focus:border-[#2f6db5] tw:focus:shadow-[0_0_0_4px_rgba(47,109,181,0.14),0_14px_28px_rgba(34,87,128,0.1)] tw:disabled:cursor-not-allowed tw:disabled:opacity-65',
              error ? 'tw:border-[#d65763]' : 'tw:border-[rgba(105,143,176,0.22)]',
            ].join(' ')}
          />
        )}
      </div>
      {error ? <p className="tw:text-[0.8rem] tw:font-medium tw:text-[#d65763]">{error}</p> : null}
    </motion.div>
  )
}

function FormSelect({
  id,
  label,
  value,
  onChange,
  options,
  error,
  disabled,
  placeholder = 'Select option',
  className = '',
}) {
  return (
    <motion.div variants={itemVariants} className={`tw:space-y-1.5 ${className}`}>
      <label htmlFor={id} className="tw:block tw:text-[0.84rem] tw:font-semibold tw:text-[#425f78]">
        {label}
      </label>
      <div className="tw:group tw:relative">
        <div className="tw:absolute tw:inset-0 tw:rounded-xl tw:bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(227,239,251,0.72))]" />
        <select
          id={id}
          value={value}
          onChange={onChange}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          className={[
            'tw:relative tw:w-full tw:h-11 tw:rounded-xl tw:border tw:bg-transparent tw:px-4 tw:py-2.5 tw:text-[0.94rem] tw:text-dwarpal-ink tw:shadow-[0_10px_24px_rgba(34,87,128,0.06)] tw:outline-none tw:transition tw:duration-200 tw:focus:border-[#2f6db5] tw:focus:shadow-[0_0_0_4px_rgba(47,109,181,0.14),0_14px_28px_rgba(34,87,128,0.1)] tw:disabled:cursor-not-allowed tw:disabled:opacity-65',
            error ? 'tw:border-[#d65763]' : 'tw:border-[rgba(105,143,176,0.22)]',
          ].join(' ')}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      {error ? <p className="tw:text-[0.8rem] tw:font-medium tw:text-[#d65763]">{error}</p> : null}
    </motion.div>
  )
}

export default function RegisterForm({
  form,
  updateFormField,
  handleRoleChange,
  handleProgramChange,
  onSubmit,
  isSubmitting,
  error,
  fieldErrors,
  requiresProgram,
  showDepartmentField,
  requiresDepartment,
  roleIdLabel,
  roleIdName,
  roleIdPlaceholder,
  departmentOptions,
  isStudentRole,
  roleOptions,
  programOptions,
  semesterOptions,
}) {
  const reduceMotion = useReducedMotion()

  return (
    <div className="tw:relative tw:flex tw:w-full tw:max-w-[34rem] tw:flex-col tw:bg-transparent tw:text-dwarpal-ink">
      <motion.div
        variants={formVariants}
        initial={reduceMotion ? false : 'hidden'}
        animate="visible"
        className="tw:relative tw:z-10 tw:flex tw:w-full tw:flex-col tw:justify-center"
      >
        {/* Main Logo Header */}
        <motion.div
          variants={itemVariants}
          className="tw:flex tw:flex-col tw:items-center tw:gap-3 tw:text-center tw:mb-6"
        >
          <div className="tw:flex tw:h-24 tw:w-24 tw:items-center tw:justify-center tw:rounded-3xl tw:border tw:border-white/85 tw:bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(224,239,255,0.94))] tw:shadow-[0_16px_32px_rgba(34,87,128,0.12)]">
            <img src={logo} alt="DwarPal logo" className="tw:h-16 tw:w-16 tw:object-contain" />
          </div>
          <div className="tw:space-y-1">
            <h1 className="tw:font-display tw:text-3xl tw:font-bold tw:leading-none tw:tracking-[-0.05em] tw:text-dwarpal-ink">
              Create Account
            </h1>
            <p className="tw:text-sm tw:font-medium tw:text-dwarpal-muted">
              Register to access the gatepass system
            </p>
          </div>
        </motion.div>

        {/* Form Card */}
        <motion.div
          variants={itemVariants}
          className="tw:w-full tw:rounded-[32px] tw:border tw:border-white/80 tw:bg-[rgba(255,255,255,0.82)] tw:p-6 tw:shadow-[0_24px_72px_rgba(34,87,128,0.12)] tw:backdrop-blur-[22px] tw:sm:p-8"
        >
          <motion.form variants={formVariants} onSubmit={onSubmit} noValidate className="tw:space-y-4">
            <div className="tw:grid tw:grid-cols-1 tw:gap-4 sm:tw:grid-cols-2">
              <FormField
                id="register-name"
                label="Full Name"
                value={form.name}
                onChange={(val) => updateFormField('name', val)}
                placeholder="Enter your full name"
                autoComplete="name"
                error={fieldErrors.name}
                disabled={isSubmitting}
              />

              <FormField
                id="register-email"
                type="email"
                label="Email Address"
                value={form.email}
                onChange={(val) => updateFormField('email', val)}
                placeholder="Enter your email address"
                autoComplete="email"
                error={fieldErrors.email}
                disabled={isSubmitting}
              />

              <FormSelect
                id="register-role"
                label="Role"
                value={form.role}
                onChange={handleRoleChange}
                placeholder="Select role"
                options={roleOptions.map((r) => ({ value: r.value, label: r.label }))}
                error={fieldErrors.role}
                disabled={isSubmitting}
              />

              {isStudentRole ? (
                <div className="tw:col-span-1 sm:tw:col-span-2 tw:rounded-[18px] tw:border tw:border-[rgba(214,87,99,0.28)] tw:bg-[rgba(255,240,242,0.9)] tw:px-4 tw:py-3 tw:text-[0.92rem] tw:font-medium tw:text-[#c24b58]">
                  Students cannot register directly. Student accounts are created by Admin or CAO.
                </div>
              ) : null}

              {!isStudentRole && form.role ? (
                <FormField
                  id={roleIdName}
                  label={roleIdLabel}
                  value={form.enrollment}
                  onChange={(val) => updateFormField('enrollment', val)}
                  placeholder={roleIdPlaceholder}
                  autoComplete="off"
                  error={fieldErrors.enrollment}
                  disabled={isSubmitting}
                />
              ) : null}

              {!isStudentRole ? (
                <FormField
                  id="register-phone"
                  type="tel"
                  label="Phone Number"
                  value={form.phone}
                  onChange={(val) => updateFormField('phone', val)}
                  placeholder="Enter phone number"
                  autoComplete="tel"
                  error={fieldErrors.phone}
                  disabled={isSubmitting}
                />
              ) : null}

              {requiresProgram ? (
                <FormSelect
                  id="register-program"
                  label={form.role === 'principal' ? 'Program / Institution' : 'Program'}
                  value={form.program}
                  onChange={handleProgramChange}
                  placeholder="Select program"
                  options={programOptions.map((p) => ({ value: p, label: p }))}
                  error={fieldErrors.program}
                  disabled={isSubmitting}
                />
              ) : null}

              {showDepartmentField ? (
                <FormSelect
                  id="register-department"
                  label="Department"
                  value={form.department}
                  onChange={(e) => updateFormField('department', e.target.value)}
                  placeholder="Select department"
                  options={departmentOptions.map((d) => ({ value: d, label: d }))}
                  error={fieldErrors.department}
                  disabled={isSubmitting}
                />
              ) : null}

              {['faculty', 'hod', 'principal'].includes(form.role) ? (
                <FormField
                  id="register-designation"
                  label={form.role === 'principal' ? 'Designation (Principal)' : form.role === 'hod' ? 'Designation (HOD)' : 'Designation'}
                  value={form.role === 'faculty' ? form.designation : form.role === 'hod' ? 'HOD' : 'Principal'}
                  onChange={(val) => updateFormField('designation', val)}
                  placeholder="Enter your designation"
                  error={fieldErrors.designation}
                  disabled={isSubmitting || form.role !== 'faculty'}
                />
              ) : null}

              {form.role === 'security' ? (
                <FormField
                  id="register-security-zone"
                  label="Security Zone / Gate Assignment"
                  value={form.securityZone}
                  onChange={(val) => updateFormField('securityZone', val)}
                  placeholder="Enter security zone or gate assignment"
                  error={fieldErrors.securityZone}
                  disabled={isSubmitting}
                />
              ) : null}

              {form.role === 'admin' ? (
                <FormField
                  id="register-access-level"
                  label="Access Level"
                  value={form.accessLevel}
                  onChange={(val) => updateFormField('accessLevel', val)}
                  placeholder="Enter access level"
                  error={fieldErrors.accessLevel}
                  disabled={isSubmitting}
                />
              ) : null}

              {form.role === 'cao' ? (
                <FormField
                  id="register-authority-level"
                  label="Administrative Authority Level"
                  value={form.authorityLevel}
                  onChange={(val) => updateFormField('authorityLevel', val)}
                  placeholder="Enter authority level"
                  error={fieldErrors.authorityLevel}
                  disabled={isSubmitting}
                />
              ) : null}
            </div>

            {!isStudentRole ? (
              <FormField
                id="register-password"
                type="password"
                label="Password"
                value={form.password}
                onChange={(val) => updateFormField('password', val)}
                placeholder="Create a strong password"
                autoComplete="new-password"
                error={fieldErrors.password}
                disabled={isSubmitting}
              />
            ) : null}

            {error ? (
              <motion.div
                variants={itemVariants}
                role="alert"
                className="tw:rounded-[18px] tw:border tw:border-[rgba(214,87,99,0.28)] tw:bg-[rgba(255,240,242,0.9)] tw:px-4 tw:py-3 tw:text-[0.92rem] tw:font-medium tw:text-[#c24b58]"
              >
                {error}
              </motion.div>
            ) : null}

            <motion.button
              variants={itemVariants}
              type="submit"
              disabled={isSubmitting || isStudentRole || !form.role}
              aria-busy={isSubmitting}
              whileHover={reduceMotion || isSubmitting || isStudentRole || !form.role ? undefined : { y: -2, scale: 1.01 }}
              whileTap={reduceMotion || isSubmitting || isStudentRole || !form.role ? undefined : { scale: 0.99 }}
              className="tw:flex tw:h-12 tw:w-full tw:items-center tw:justify-center tw:gap-3 tw:rounded-xl tw:border-none tw:bg-[linear-gradient(135deg,#387dcc,#25578f)] tw:px-5 tw:py-3.5 tw:text-[1rem] tw:font-semibold tw:text-white tw:shadow-[0_20px_38_rgba(37,87,143,0.28)] tw:transition tw:duration-200 hover:tw:shadow-[0_24px_44px_rgba(37,87,143,0.34)] tw:disabled:cursor-not-allowed tw:disabled:opacity-70"
            >
              <UserPlus className="tw:h-5 tw:w-5" />
              {isSubmitting ? 'Creating Account...' : 'Create Account'}
            </motion.button>
          </motion.form>

          {/* Login Navigation Link */}
          <motion.div variants={itemVariants} className="tw:mt-5 tw:text-center">
            <p className="tw:text-[0.92rem] tw:text-dwarpal-muted">
              Already have an account?{' '}
              <Link to="/login" replace className="tw:font-semibold tw:text-[#2f6db5] tw:underline tw:underline-offset-4 hover:tw:text-[#214f84]">
                Log In
              </Link>
            </p>
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  )
}
