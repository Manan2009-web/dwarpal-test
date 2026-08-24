import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Compass, Home, ArrowLeft, HelpCircle, ShieldAlert } from 'lucide-react'

export default function NotFoundPage({ currentUser = null }) {
  const navigate = useNavigate()

  const destinationPath = currentUser
    ? (currentUser.role === 'principal' ? '/principal/dashboard' :
       currentUser.role === 'hod' ? '/hod/dashboard' :
       currentUser.role === 'chairman' ? '/chairman' :
       currentUser.role === 'student' ? '/student/dashboard' :
       currentUser.role === 'faculty' ? '/faculty/dashboard' :
       currentUser.role === 'security' || currentUser.role === 'campus_security' ? '/security/dashboard' :
       '/app/my-gatepasses')
    : '/'

  const destinationLabel = currentUser ? 'Return to Dashboard' : 'Return to Home'

  return (
    <div 
      className="tw:min-h-screen tw:w-full tw:flex tw:flex-col tw:items-center tw:justify-center tw:relative tw:overflow-hidden tw:select-none tw:px-6 tw:py-12"
      style={{ background: 'var(--page-bg, #f6fbff)' }}
    >
      {/* Background ambient decorative flares */}
      <div 
        className="tw:absolute tw:top-1/4 tw:left-1/2 tw:-translate-x-1/2 tw:-translate-y-1/2 tw:w-[70vw] tw:max-w-[500px] tw:h-[300px] tw:bg-[#2872a1]/[0.06] tw:rounded-full tw:blur-[90px] tw:pointer-events-none tw:z-0" 
      />

      {/* Main Glass Card Container */}
      <div className="tw:w-full tw:max-w-lg tw:bg-white/80 tw:backdrop-blur-xl tw:border tw:border-[rgba(23,52,73,0.12)] tw:shadow-[0_20px_50px_rgba(16,38,62,0.08)] tw:rounded-3xl tw:p-8 tw:sm:p-10 tw:text-center tw:relative tw:z-10 tw:space-y-6">
        
        {/* Badge & Icon */}
        <div className="tw:flex tw:flex-col tw:items-center tw:gap-3">
          <div className="tw:w-16 tw:h-16 tw:rounded-2xl tw:bg-[#2872a1]/10 tw:border tw:border-[#2872a1]/20 tw:flex tw:items-center tw:justify-center tw:text-[#2872a1] tw:shadow-inner">
            <Compass className="tw:w-8 tw:h-8 tw:animate-pulse" />
          </div>
          <span className="tw:px-3.5 tw:py-1 tw:rounded-full tw:bg-[#2872a1]/10 tw:text-[#2872a1] tw:text-[11px] tw:font-mono tw:font-bold tw:tracking-[0.2em] tw:uppercase">
            Error 404 • Lost in Campus
          </span>
        </div>

        {/* 404 Large Heading */}
        <div className="tw:space-y-2">
          <h1 className="tw:text-5xl tw:sm:text-6xl tw:font-black tw:tracking-tight tw:text-[#10263e] tw:font-sans">
            404
          </h1>
          <h2 className="tw:text-lg tw:sm:text-xl tw:font-bold tw:text-[#163247]">
            Page Not Found
          </h2>
          <p className="tw:text-xs tw:sm:text-sm tw:text-[#5d7183] tw:leading-relaxed tw:max-w-sm tw:mx-auto">
            The page or gatepass link you are looking for does not exist, has expired, or may have been relocated.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="tw:pt-2 tw:flex tw:flex-col tw:sm:flex-row tw:items-center tw:justify-center tw:gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="tw:w-full tw:sm:w-auto tw:px-5 tw:py-3 tw:rounded-xl tw:border tw:border-[rgba(23,52,73,0.16)] tw:bg-white tw:hover:bg-slate-50 tw:text-[#163247] tw:font-semibold tw:text-xs tw:tracking-wider tw:uppercase tw:flex tw:items-center tw:justify-center tw:gap-2 tw:transition-colors tw:shadow-sm"
          >
            <ArrowLeft className="tw:w-4 tw:h-4" />
            Go Back
          </button>

          <Link
            to={destinationPath}
            className="tw:w-full tw:sm:w-auto tw:px-6 tw:py-3 tw:rounded-xl tw:bg-[#2872a1] tw:hover:bg-[#1f5a80] tw:text-white tw:font-bold tw:text-xs tw:tracking-wider tw:uppercase tw:flex tw:items-center tw:justify-center tw:gap-2 tw:transition-all tw:shadow-md tw:shadow-[#2872a1]/25"
          >
            <Home className="tw:w-4 tw:h-4" />
            {destinationLabel}
          </Link>
        </div>

        {/* Help Link Footer */}
        <div className="tw:pt-4 tw:border-t tw:border-[rgba(23,52,73,0.08)] tw:flex tw:items-center tw:justify-center tw:gap-4 tw:text-[11px] tw:text-[#5d7183] tw:font-mono">
          <span>Need assistance?</span>
          <Link 
            to="/support" 
            className="tw:text-[#2872a1] tw:hover:underline tw:font-bold tw:flex tw:items-center tw:gap-1"
          >
            <HelpCircle className="tw:w-3.5 tw:h-3.5" />
            Help & FAQ
          </Link>
        </div>
      </div>
    </div>
  )
}
