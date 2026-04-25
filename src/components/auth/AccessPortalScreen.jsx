import { useMemo, useState } from 'react'
import { KeyRound, ShieldCheck, University } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import AuthPage from './AuthPage'
import MascotPanel from './MascotPanel'
import AppBrand from '../AppBrand'
import PasswordInput from '../PasswordInput'

const ACCESS_OPTIONS = [
  {
    value: 'student',
    title: 'Student Access',
    description: 'Opens the secured student sign-in flow with enrollment number, password, and email OTP.',
  },
  {
    value: 'faculty',
    title: 'Faculty Access',
    description: 'Opens the faculty and staff login/register flow for employee-based access.',
  },
]

export default function AccessPortalScreen({ currentPortalAccess, onSubmitPortalAccess }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [accessType, setAccessType] = useState(currentPortalAccess?.accessType || 'student')
  const [accessId, setAccessId] = useState('')
  const [accessPassword, setAccessPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const returnTo = useMemo(() => {
    const nextRoute = location.state?.returnTo || location.pathname
    return nextRoute === '/register' || nextRoute === '/login' ? nextRoute : '/login'
  }, [location.pathname, location.state])

  async function handleSubmit(event) {
    event.preventDefault()

    if (isSubmitting) {
      return
    }

    if (!accessId.trim() || !accessPassword) {
      setError('Enter the admin-issued access ID and password to continue.')
      return
    }

    setIsSubmitting(true)
    setError('')

    const result = await onSubmitPortalAccess?.({
      accessType,
      accessId: accessId.trim(),
      accessPassword,
    })

    if (!result?.ok) {
      setError(result?.error || 'Unable to verify portal access right now.')
      setIsSubmitting(false)
      return
    }

    const nextRoute = accessType === 'faculty' && returnTo === '/register' ? '/register' : '/login'
    navigate(nextRoute, {
      replace: true,
      state: {
        authNotice:
          accessType === 'student'
            ? 'Student access verified. Sign in with your enrollment number and continue with email OTP.'
            : 'Faculty access verified. Continue to login or registration.',
      },
    })
  }

  return (
    <AuthPage
      left={<MascotPanel />}
      right={
        <section className="tw:relative tw:flex tw:h-full tw:flex-col tw:bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,251,255,0.94))] tw:p-4 tw:sm:p-6 tw:lg:p-8">
          <div className="tw:relative tw:z-10 tw:mx-auto tw:flex tw:h-full tw:w-full tw:max-w-[31rem] tw:flex-col tw:justify-center">
            <div className="tw:space-y-6 tw:rounded-[32px] tw:border tw:border-white/80 tw:bg-[rgba(255,255,255,0.86)] tw:p-5 tw:shadow-[0_24px_72px_rgba(34,87,128,0.12)] tw:backdrop-blur-[22px] tw:sm:p-7">
              <div className="tw:space-y-4">
                <div className="tw:flex tw:items-center tw:justify-between tw:gap-4">
                  <AppBrand size="md" align="start" />
                  <div className="tw:flex tw:h-11 tw:w-11 tw:items-center tw:justify-center tw:rounded-2xl tw:bg-[rgba(47,109,181,0.09)] tw:text-[#2f6db5]">
                    <University size={20} />
                  </div>
                </div>
                <div>
                  <p className="tw:text-[0.78rem] tw:font-semibold tw:uppercase tw:tracking-[0.22em] tw:text-[#6f88a0]">
                    Select Access Type
                  </p>
                  <h2 className="tw:mt-2 tw:text-[2rem] tw:font-semibold tw:tracking-[-0.05em] tw:text-dwarpal-ink">
                    Controlled entry portal
                  </h2>
                  <p className="tw:mt-2 tw:text-[0.96rem] tw:text-dwarpal-muted">
                    Verify the common access credentials provided by the admin before opening DwarPal auth screens.
                  </p>
                </div>
              </div>

              <div className="tw:grid tw:gap-3 sm:tw:grid-cols-2">
                {ACCESS_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setAccessType(option.value)}
                    className={[
                      'tw:rounded-[24px] tw:border tw:px-4 tw:py-4 tw:text-left tw:transition tw:duration-200',
                      accessType === option.value
                        ? 'tw:border-[#2f6db5] tw:bg-[rgba(47,109,181,0.08)] tw:shadow-[0_14px_26px_rgba(34,87,128,0.12)]'
                        : 'tw:border-[rgba(105,143,176,0.2)] tw:bg-white/70 hover:tw:border-[rgba(47,109,181,0.35)] hover:tw:bg-white',
                    ].join(' ')}
                  >
                    <div className="tw:flex tw:items-start tw:justify-between tw:gap-3">
                      <div>
                        <strong className="tw:block tw:text-[1rem] tw:text-dwarpal-ink">{option.title}</strong>
                        <p className="tw:mt-2 tw:text-[0.88rem] tw:leading-6 tw:text-dwarpal-muted">{option.description}</p>
                      </div>
                      <div
                        className={[
                          'tw:mt-1 tw:flex tw:h-5 tw:w-5 tw:flex-none tw:items-center tw:justify-center tw:rounded-full tw:border',
                          accessType === option.value
                            ? 'tw:border-[#2f6db5] tw:bg-[#2f6db5] tw:text-white'
                            : 'tw:border-[rgba(105,143,176,0.35)] tw:bg-white tw:text-transparent',
                        ].join(' ')}
                      >
                        <ShieldCheck size={12} />
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmit} className="tw:space-y-4" noValidate>
                <label className="tw:block tw:space-y-2">
                  <span className="tw:block tw:text-[0.84rem] tw:font-semibold tw:text-[#425f78]">Access ID</span>
                  <input
                    value={accessId}
                    onChange={(event) => {
                      setAccessId(event.target.value)
                      setError('')
                    }}
                    placeholder={`Enter ${accessType === 'student' ? 'student' : 'faculty'} access ID`}
                    autoComplete="username"
                    disabled={isSubmitting}
                    className="tw:w-full tw:rounded-[20px] tw:border tw:border-[rgba(105,143,176,0.22)] tw:bg-transparent tw:px-4 tw:py-4 tw:text-[0.98rem] tw:text-dwarpal-ink tw:shadow-[0_12px_30px_rgba(34,87,128,0.08)] tw:outline-none tw:transition tw:duration-200 tw:placeholder:text-[#7b90a3] tw:focus:border-[#2f6db5] tw:focus:shadow-[0_0_0_4px_rgba(47,109,181,0.14),0_18px_32px_rgba(34,87,128,0.12)]"
                  />
                </label>

                <label className="tw:block tw:space-y-2">
                  <span className="tw:block tw:text-[0.84rem] tw:font-semibold tw:text-[#425f78]">Access Password</span>
                  <PasswordInput
                    value={accessPassword}
                    onChange={(value) => {
                      setAccessPassword(value)
                      setError('')
                    }}
                    placeholder="Enter access password"
                    autoComplete="current-password"
                    disabled={isSubmitting}
                    className="tw:w-full tw:rounded-[20px] tw:border tw:border-[rgba(105,143,176,0.22)] tw:bg-transparent tw:px-4 tw:py-4 tw:pr-12 tw:text-[0.98rem] tw:text-dwarpal-ink tw:shadow-[0_12px_30px_rgba(34,87,128,0.08)] tw:outline-none tw:transition tw:duration-200 tw:placeholder:text-[#7b90a3] tw:focus:border-[#2f6db5] tw:focus:shadow-[0_0_0_4px_rgba(47,109,181,0.14),0_18px_32px_rgba(34,87,128,0.12)]"
                    wrapperClassName="tw:relative"
                    toggleClassName="tw:absolute tw:right-3 tw:top-0 tw:bottom-0 tw:my-auto tw:grid tw:h-9 tw:w-9 tw:place-items-center tw:rounded-full tw:border tw:border-[rgba(105,143,176,0.28)] tw:bg-[rgba(255,255,255,0.74)] tw:text-[#48637c] tw:transition tw:duration-200 hover:tw:bg-white hover:tw:text-[#2f6db5] focus-visible:tw:outline-none focus-visible:tw:ring-2 focus-visible:tw:ring-[#2f6db5]/35"
                  />
                </label>

                {error ? (
                  <div className="tw:rounded-[18px] tw:border tw:border-[rgba(214,87,99,0.28)] tw:bg-[rgba(255,240,242,0.9)] tw:px-4 tw:py-3 tw:text-[0.92rem] tw:font-medium tw:text-[#c24b58]">
                    {error}
                  </div>
                ) : null}

                {currentPortalAccess?.accessType ? (
                  <p className="tw:text-[0.86rem] tw:text-dwarpal-muted">
                    Current session access: <strong>{currentPortalAccess.accessType === 'student' ? 'Student' : 'Faculty'}</strong>
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="tw:flex tw:w-full tw:items-center tw:justify-center tw:gap-3 tw:rounded-[20px] tw:border-none tw:bg-[linear-gradient(135deg,#387dcc,#25578f)] tw:px-5 tw:py-4 tw:text-[1rem] tw:font-semibold tw:text-white tw:shadow-[0_20px_38px_rgba(37,87,143,0.28)] tw:transition tw:duration-200 tw:hover:shadow-[0_24px_44px_rgba(37,87,143,0.34)] tw:disabled:cursor-not-allowed tw:disabled:opacity-70"
                >
                  <KeyRound size={18} />
                  {isSubmitting ? 'Verifying access...' : 'Continue'}
                </button>
              </form>
            </div>
          </div>
        </section>
      }
    />
  )
}
