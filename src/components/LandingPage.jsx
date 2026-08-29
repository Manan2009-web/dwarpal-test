import React, { Suspense, lazy, useState } from 'react'
import { motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'

const DotField = lazy(() => import('./ui/DotField'))

export default function LandingPage() {
  const navigate = useNavigate()
  const [logoClicks, setLogoClicks] = useState(0)

  const handleLogoClick = () => {
    const next = logoClicks + 1
    if (next >= 5) {
      navigate('/master-control')
      return
    }
    setLogoClicks(next)
    setTimeout(() => setLogoClicks(0), 3000)
  }

  return (
    <div 
      className="tw:min-h-screen tw:w-full tw:flex tw:flex-col tw:items-center tw:justify-center tw:relative tw:overflow-hidden tw:select-none"
      style={{ background: 'var(--page-bg)' }}
    >
      
      {/* 1. Interactive Canvas Dot Field Background (Campus Theme) */}
      <div className="tw:absolute tw:inset-0 tw:z-0 tw:pointer-events-none tw:transform-gpu">
        <Suspense fallback={null}>
          <DotField
            dotRadius={2.3}
            dotSpacing={14}
            bulgeStrength={70}
            glowRadius={160}
            sparkle={false}
            waveAmplitude={0}
            gradientFrom="rgba(40, 114, 161, 0.4)"
            gradientTo="rgba(32, 111, 82, 0.15)"
            glowColor="rgba(40, 114, 161, 0.04)"
          />
        </Suspense>
      </div>

      {/* Subtle background ambient blue/green flare */}
      <div 
        className="tw:absolute tw:top-[-20%] tw:left-1/2 tw:-translate-x-1/2 tw:w-[80vw] tw:h-[60vh] tw:bg-[#2f6db5]/[0.03] tw:rounded-full tw:blur-[120px] tw:pointer-events-none tw:z-0" 
      />

      {/* 2. Instant Load Landing Page Layout */}
      <div className="tw:w-full tw:min-h-screen tw:flex tw:flex-col tw:justify-between tw:relative tw:z-20 tw:transform-gpu">
        
        {/* Header */}
        <header className="tw:w-full tw:max-w-7xl tw:mx-auto tw:px-8 tw:py-8 tw:flex tw:items-center tw:justify-between tw:z-30 tw:relative tw:transform-gpu">
          {/* Logo */}
          <div 
            onClick={handleLogoClick}
            className="tw:flex tw:items-center tw:gap-2.5 tw:cursor-pointer tw:select-none"
            title="DwarPal"
          >
            <span className="tw:text-[#163247] tw:font-mono tw:text-lg tw:font-black tw:tracking-[0.35em] tw:uppercase">
              Dwarpal
            </span>
            <span className="tw:h-1.5 tw:w-1.5 tw:rounded-full tw:bg-[#2f6db5] tw:animate-ping" />
          </div>


          {/* Liquid Glass Badge */}
          <div className="tw:flex tw:items-center tw:gap-3 tw:border tw:border-[rgba(105,143,176,0.16)] tw:bg-white/60 tw:backdrop-blur-xl tw:shadow-sm tw:px-4 tw:py-2 tw:rounded-full tw:transform-gpu tw:backface-hidden">
            <span className="tw:h-2 tw:w-2 tw:rounded-full tw:bg-[#2f6db5] tw:animate-pulse" />
            <span className="tw:text-[9px] tw:font-mono tw:tracking-[0.2em] tw:text-neutral-600">
              SYSTEM SECURED
            </span>
          </div>
        </header>

        {/* Hero Section */}
        <main className="tw:flex-grow tw:flex tw:flex-col tw:items-center tw:justify-center tw:px-6 tw:text-center tw:z-10 tw:relative">
          <div className="tw:max-w-3xl tw:mx-auto tw:space-y-9">
            
            {/* Liquid Glass Badge */}
            <div className="tw:inline-flex tw:items-center tw:transform-gpu">
              <span className="tw:px-4 tw:py-1.5 tw:text-[9.5px] tw:font-mono tw:tracking-[0.25em] tw:text-[#2f6db5] tw:border tw:border-[rgba(105,143,176,0.2)] tw:bg-white/60 tw:shadow-sm tw:rounded-md tw:uppercase tw:transform-gpu tw:backface-hidden">
                SECURE ACCESS CONTROL
              </span>
            </div>

            {/* Headline (Instant Paint for sub-1s Mobile LCP) */}
            <div className="tw:space-y-2">
              <div className="tw:overflow-hidden tw:relative tw:py-1 tw:min-h-[3rem] tw:sm:min-h-[4rem] tw:md:min-h-[5rem]">
                <h1 className="tw:text-[1.65rem] tw:sm:text-5xl tw:md:text-6xl tw:font-black tw:text-[#163247] tw:uppercase tw:leading-none tw:transform-gpu tw:tracking-wider">
                  The Intelligent
                </h1>
              </div>
              <div className="tw:overflow-hidden tw:relative tw:py-1 tw:min-h-[3rem] tw:sm:min-h-[4rem] tw:md:min-h-[5rem]">
                <h2 className="tw:text-[1.65rem] tw:sm:text-5xl tw:md:text-6xl tw:font-black tw:text-[#163247] tw:uppercase tw:leading-none tw:transform-gpu tw:tracking-wider">
                  Gatekeeper.
                </h2>
              </div>
            </div>

            {/* Subheadline */}
            <p className="tw:text-sm tw:md:text-base tw:text-neutral-600 tw:max-w-md tw:mx-auto tw:leading-relaxed tw:font-light">
              Simple, secure, and instant digital gatepass verification for your campus.
            </p>

            {/* Liquid Glass CTA Button */}
            <div className="tw:pt-6">
              <Link to="/access-portal" className="tw:inline-block">
                <motion.button
                  whileHover={{
                    scale: 1.015,
                    backgroundColor: '#1d5290',
                    borderColor: '#1d5290',
                    boxShadow: '0 8px 30px rgba(47, 109, 181, 0.3)',
                  }}
                  whileTap={{ scale: 0.985 }}
                  className="tw:px-12 tw:py-4.5 tw:bg-[#2f6db5] tw:text-white tw:border tw:border-[#2f6db5] tw:shadow-md tw:font-mono tw:text-xs tw:tracking-[0.3em] tw:uppercase tw:transition-all tw:duration-300 tw:cursor-pointer tw:transform-gpu tw:backface-hidden tw:rounded-xl"
                >
                  Access Workspace
                </motion.button>
              </Link>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="tw:w-full tw:max-w-7xl tw:mx-auto tw:px-8 tw:py-8 tw:flex tw:flex-col tw:sm:flex-row tw:items-center tw:justify-between tw:gap-4 tw:text-[8px] tw:font-mono tw:tracking-[0.25em] tw:text-neutral-500 tw:transform-gpu">
          <div>VERSION: 1.0.1</div>
          <div className="tw:flex tw:gap-6">
            <Link to="/privacy-policy" className="hover:tw:text-[#2f6db5] tw:transition-colors">PRIVACY POLICY</Link>
            <Link to="/support" className="hover:tw:text-[#2f6db5] tw:transition-colors">SUPPORT</Link>
          </div>
        </footer>
      </div>
    </div>
  )
}
