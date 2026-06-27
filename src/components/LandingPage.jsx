import React from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import DotField from './ui/DotField'

export default function LandingPage() {
  return (
    <div className="tw:min-h-screen tw:w-full tw:flex tw:flex-col tw:items-center tw:justify-center tw:relative tw:overflow-hidden tw:bg-[#030305] tw:select-none">
      
      {/* 1. Interactive Canvas Dot Field Background (Purple Theme) */}
      <div className="tw:absolute tw:inset-0 tw:z-0 tw:pointer-events-none tw:transform-gpu">
        <DotField
          dotRadius={2.3}
          dotSpacing={14}
          bulgeStrength={70}
          glowRadius={160}
          sparkle={false}
          waveAmplitude={0}
          gradientFrom="#A855F7"
          gradientTo="#B497CF"
          glowColor="#120F17"
        />
      </div>

      {/* Subtle background ambient purple flare */}
      <div 
        className="tw:absolute tw:top-[-20%] tw:left-1/2 tw:-translate-x-1/2 tw:w-[80vw] tw:h-[60vh] tw:bg-[#A855F7]/[0.02] tw:rounded-full tw:blur-[120px] tw:pointer-events-none tw:z-0" 
      />

      {/* 2. Instant Load Landing Page Layout */}
      <div className="tw:w-full tw:min-h-screen tw:flex tw:flex-col tw:justify-between tw:relative tw:z-20 tw:transform-gpu">
        
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
          className="tw:w-full tw:max-w-7xl tw:mx-auto tw:px-8 tw:py-8 tw:flex tw:items-center tw:justify-between tw:z-30 tw:relative tw:transform-gpu"
        >
          {/* Logo */}
          <div className="tw:flex tw:items-center tw:gap-2">
            <span className="tw:text-white tw:font-mono tw:text-lg tw:font-black tw:tracking-[0.35em] tw:uppercase">
              Dwarpal
            </span>
            <span className="tw:h-1.5 tw:w-1.5 tw:rounded-full tw:bg-[#A855F7] tw:animate-ping" />
          </div>

          {/* Liquid Glass Badge */}
          <div className="tw:flex tw:items-center tw:gap-3 tw:border tw:border-white/[0.07] tw:bg-white/[0.02] tw:backdrop-blur-xl tw:shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] tw:px-4 tw:py-2 tw:rounded-full tw:transform-gpu tw:backface-hidden">
            <span className="tw:h-2 tw:w-2 tw:rounded-full tw:bg-[#A855F7] tw:animate-pulse" />
            <span className="tw:text-[9px] tw:font-mono tw:tracking-[0.2em] tw:text-neutral-300">
              SYSTEM SECURED
            </span>
          </div>
        </motion.header>

        {/* Hero Section */}
        <main className="tw:flex-grow tw:flex tw:flex-col tw:items-center tw:justify-center tw:px-6 tw:text-center tw:z-10 tw:relative">
          <div className="tw:max-w-3xl tw:mx-auto tw:space-y-9">
            
            {/* Liquid Glass Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
              className="tw:inline-flex tw:items-center tw:transform-gpu"
            >
              <span className="tw:px-4 tw:py-1.5 tw:text-[9.5px] tw:font-mono tw:tracking-[0.25em] tw:text-[#A855F7] tw:border tw:border-white/[0.07] tw:bg-white/[0.02] tw:backdrop-blur-xl tw:shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] tw:rounded-md tw:uppercase tw:transform-gpu tw:backface-hidden">
                SECURE ACCESS CONTROL
              </span>
            </motion.div>

            {/* Headline (Liquid Slide-Up / Clip-Path Text Reveal) */}
            <div className="tw:space-y-2">
              <div className="tw:overflow-hidden tw:relative tw:py-1 tw:h-12 tw:sm:h-16 tw:md:h-20">
                <motion.div
                  initial={{ y: 70, opacity: 0, letterSpacing: '0.25em' }}
                  animate={{ y: 0, opacity: 1, letterSpacing: '0.05em' }}
                  transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
                  className="tw:text-3xl tw:sm:text-5xl tw:md:text-6xl tw:font-black tw:text-white tw:uppercase tw:leading-none tw:transform-gpu"
                  style={{ willChange: 'transform, opacity' }}
                >
                  The Intelligent
                </motion.div>
              </div>
              <div className="tw:overflow-hidden tw:relative tw:py-1 tw:h-12 tw:sm:h-16 tw:md:h-20">
                <motion.div
                  initial={{ y: 70, opacity: 0, letterSpacing: '0.25em' }}
                  animate={{ y: 0, opacity: 1, letterSpacing: '0.05em' }}
                  transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.35 }}
                  className="tw:text-3xl tw:sm:text-5xl tw:md:text-6xl tw:font-black tw:text-white tw:uppercase tw:leading-none tw:transform-gpu"
                  style={{ willChange: 'transform, opacity' }}
                >
                  Gatekeeper.
                </motion.div>
              </div>
            </div>

            {/* Subheadline (Damped Spring Transition) */}
            <motion.p
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 70, damping: 15, delay: 0.55 }}
              className="tw:text-sm tw:md:text-base tw:text-neutral-400 tw:max-w-md tw:mx-auto tw:leading-relaxed tw:font-light"
            >
              Simple, secure, and instant digital gatepass verification for your campus.
            </motion.p>

            {/* Liquid Glass CTA Button (Damped Spring Transition) */}
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 70, damping: 15, delay: 0.7 }}
              className="tw:pt-6"
            >
              <Link to="/access-portal" className="tw:inline-block">
                <motion.button
                  whileHover={{
                    scale: 1.015,
                    borderColor: 'rgba(168, 85, 247, 0.5)',
                    boxShadow: '0 0 25px rgba(168, 85, 247, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                    backgroundColor: 'rgba(168, 85, 247, 0.05)',
                    color: '#ffffff',
                  }}
                  whileTap={{ scale: 0.985 }}
                  className="tw:px-12 tw:py-4.5 tw:bg-white/[0.02] tw:text-neutral-200 tw:border tw:border-white/[0.07] tw:backdrop-blur-xl tw:shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] tw:font-mono tw:text-xs tw:tracking-[0.3em] tw:uppercase tw:transition-all tw:duration-300 tw:cursor-pointer tw:transform-gpu tw:backface-hidden"
                >
                  Access Workspace
                </motion.button>
              </Link>
            </motion.div>
          </div>
        </main>

        {/* Footer */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          transition={{ duration: 1.2, delay: 0.9 }}
          className="tw:w-full tw:max-w-7xl tw:mx-auto tw:px-8 tw:py-8 tw:flex tw:flex-col tw:sm:flex-row tw:items-center tw:justify-between tw:gap-4 tw:text-[8px] tw:font-mono tw:tracking-[0.25em] tw:text-neutral-500 tw:transform-gpu"
        >
          <div>VERSION: 1.0.1</div>
        </motion.footer>
      </div>
    </div>
  )
}
