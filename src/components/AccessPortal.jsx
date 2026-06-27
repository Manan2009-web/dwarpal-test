import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { KeyRound } from 'lucide-react'
import SideRays from './ui/SideRays'
import logo from '../assets/dwarpal_logo.png'

const PORTAL_CREDENTIALS = {
  student: {
    code: 'STUDENT2026',
    password: 'dwarpal-student-access',
  },
  other: {
    code: 'GATEKEEPER2026',
    password: 'dwarpal-admin-access',
  },
}

const cardVariants = {
  hidden: { opacity: 0, scale: 0.96, y: 15 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.8,
      ease: [0.16, 1, 0.3, 1],
      staggerChildren: 0.08,
      delayChildren: 0.15,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.16, 1, 0.3, 1],
    },
  },
}

export default function AccessPortal({ onAccessGranted }) {
  const navigate = useNavigate()
  const reduceMotion = useReducedMotion()
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')

    if (!code.trim() || !password.trim()) {
      setError('Please enter both Access Code and Portal Password.')
      return
    }

    setIsVerifying(true)

    // Simulate validation check delay
    setTimeout(() => {
      const normalizedCode = code.trim().toUpperCase()
      const enteredPassword = password.trim()

      if (
        normalizedCode === PORTAL_CREDENTIALS.student.code &&
        enteredPassword === PORTAL_CREDENTIALS.student.password
      ) {
        if (typeof onAccessGranted === 'function') {
          onAccessGranted({
            token: 'simulated-student-token',
            accessType: 'student',
          })
        }
        setIsVerifying(false)
        navigate('/login', { replace: true })
      } else if (
        normalizedCode === PORTAL_CREDENTIALS.other.code &&
        enteredPassword === PORTAL_CREDENTIALS.other.password
      ) {
        if (typeof onAccessGranted === 'function') {
          onAccessGranted({
            token: 'simulated-other-token',
            accessType: 'other',
          })
        }
        setIsVerifying(false)
        navigate('/login', { replace: true })
      } else {
        setError('Invalid credentials. Please verify your portal access keys.')
        setIsVerifying(false)
      }
    }, 600)
  }

  return (
    <div className="tw:relative tw:isolate tw:min-h-screen tw:w-full tw:flex tw:items-center tw:justify-center tw:bg-[#03060d] tw:font-sans tw:overflow-hidden tw:px-4">
      {/* Full-Screen Animated Backdrop Effect */}
      <div className="tw:absolute tw:inset-0 tw:z-0 tw:pointer-events-none tw:w-full tw:h-full">
        <SideRays
          speed={2.5}
          rayColor1="#EAB308"
          rayColor2="#96c8ff"
          intensity={2}
          spread={2}
          origin="top-right"
          tilt={0}
          saturation={1.5}
          blend={0.75}
          falloff={1.6}
          opacity={1.0}
        />
      </div>

      {/* Center Card (Glass UI) */}
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        className="tw:relative tw:z-10 tw:w-full tw:max-w-md tw:bg-white/10 tw:backdrop-blur-xl tw:border tw:border-white/20 tw:shadow-2xl tw:rounded-2xl tw:p-8"
      >
        {/* Brand Logo & Header with clean spacing */}
        <motion.div variants={itemVariants} className="tw:flex tw:flex-col tw:items-center tw:text-center tw:mb-6">
          <img 
            src={logo} 
            alt="DwarPal Logo" 
            className="tw:w-[144px] tw:h-[96px] tw:object-contain tw:block tw:mb-1"
          />
          <h1 className="tw:text-2xl tw:font-bold tw:tracking-widest tw:text-white tw:drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)] tw:select-none tw:-mt-1">
            DwarPal
          </h1>
          <p className="tw:text-[10px] tw:font-semibold tw:text-white/50 tw:uppercase tw:tracking-[0.2em] tw:mt-1.5">
            Access Verification Gateway
          </p>
        </motion.div>

        <form onSubmit={handleSubmit} className="tw:space-y-5">
          <motion.div variants={itemVariants} className="tw:space-y-2">
            <label htmlFor="access-code" className="tw:block tw:text-[0.82rem] tw:font-semibold tw:text-white/70 tw:tracking-wide">
              Access Code
            </label>
            <input
              id="access-code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter Access Code"
              disabled={isVerifying}
              autoComplete="off"
              className="tw:w-full tw:h-12 tw:rounded-xl tw:border tw:border-white/10 tw:bg-white/5 tw:px-4 tw:py-3 tw:text-[0.96rem] tw:text-white tw:shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)] tw:outline-none tw:transition tw:duration-200 tw:placeholder:text-white/30 focus:tw:border-white/30 focus:tw:bg-white/10"
            />
          </motion.div>

          <motion.div variants={itemVariants} className="tw:space-y-2">
            <label htmlFor="portal-password" className="tw:block tw:text-[0.82rem] tw:font-semibold tw:text-white/70 tw:tracking-wide">
              Portal Password
            </label>
            <input
              id="portal-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter Portal Password"
              disabled={isVerifying}
              autoComplete="off"
              className="tw:w-full tw:h-12 tw:rounded-xl tw:border tw:border-white/10 tw:bg-white/5 tw:px-4 tw:py-3 tw:text-[0.96rem] tw:text-white tw:shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)] tw:outline-none tw:transition tw:duration-200 tw:placeholder:text-white/30 focus:tw:border-white/30 focus:tw:bg-white/10"
            />
          </motion.div>

          {error ? (
            <motion.div
              variants={itemVariants}
              role="alert"
              className="tw:rounded-xl tw:border tw:border-red-500/20 tw:bg-red-500/10 tw:px-4 tw:py-2.5 tw:text-xs tw:font-semibold tw:text-red-300"
            >
              {error}
            </motion.div>
          ) : null}

          <motion.button
            variants={itemVariants}
            type="submit"
            disabled={isVerifying}
            className="tw:w-full tw:h-12 tw:flex tw:items-center tw:justify-center tw:gap-2.5 tw:rounded-xl tw:bg-white tw:text-[#03060d] tw:text-sm tw:font-bold tw:shadow-lg tw:transition-all tw:duration-200 hover:tw:bg-white/90 active:tw:scale-[0.99] disabled:tw:opacity-60 disabled:tw:cursor-not-allowed"
          >
            {isVerifying ? (
              <span>Verifying Access...</span>
            ) : (
              <>
                <KeyRound size={16} />
                <span>Verify & Enter</span>
              </>
            )}
          </motion.button>
        </form>

        <motion.div variants={itemVariants} className="tw:mt-8 tw:text-center">
          <p className="tw:text-[9px] tw:text-white/40 tw:font-mono tw:tracking-widest tw:uppercase">
            DwarPal SecOps Infrastructure
          </p>
        </motion.div>
      </motion.div>
    </div>
  )
}
