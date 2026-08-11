import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { KeyRound } from 'lucide-react'
import SideRays from './ui/SideRays'
import logo from '../assets/dwarpal_logo.png'
import { requestPortalAccess } from '../lib/dwarpalApi'

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
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    const trimmedCode = code.trim()
    const trimmedPassword = password.trim()

    if (!trimmedCode || !trimmedPassword) {
      setError('Please enter both Access Code and Portal Password.')
      return
    }

    setIsVerifying(true)

    try {
      const normalizedCode = trimmedCode.toUpperCase()
      const accessType = normalizedCode === 'STUDENT2026' ? 'student' : 'faculty'

      const result = await requestPortalAccess(accessType, normalizedCode, trimmedPassword)
      if (typeof onAccessGranted === 'function') {
        onAccessGranted({
          token: result.token,
          accessType: result.accessType,
        })
      }
      navigate('/login', { replace: true })
    } catch (err) {
      setError(err?.message || 'Invalid credentials. Please verify your portal access keys.')
    } finally {
      setIsVerifying(false)
    }
  }

  return (
    <div className="auth-shell" style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>
      <div className="auth-background" aria-hidden="true">
        <div className="bg-orb bg-orb-left" />
        <div className="bg-orb bg-orb-right" />
        <div className="bg-grid" />
        
        <div className="floating-card building-card">
          <span className="floating-label">Campus Block</span>
          <div className="building-roof" />
          <div className="building-body">
            <span /><span /><span /><span /><span /><span />
          </div>
        </div>
        
        <div className="floating-card pass-card">
          <span className="floating-label">Gatepass</span>
          <div className="pass-lines">
            <span /><span /><span />
          </div>
          <div className="pass-badge" />
        </div>
        
        <div className="floating-card gate-card">
          <span className="floating-label">Security Gate</span>
          <div className="gate-frame">
            <span /><span /><span />
          </div>
        </div>
        
        <div className="floating-card path-card">
          <span className="floating-label">Campus Flow</span>
          <div className="path-lines">
            <span /><span />
          </div>
        </div>
      </div>

      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        className="auth-panel tw:relative tw:z-10 tw:w-full tw:max-w-md tw:p-6 tw:sm:p-8 tw:rounded-2xl"
      >
        <motion.div variants={itemVariants} className="tw:flex tw:flex-col tw:items-center tw:text-center tw:mb-6">
          <img 
            src={logo} 
            alt="DwarPal Logo" 
            className="tw:w-[144px] tw:h-[96px] tw:object-contain tw:block tw:mb-1"
          />
          <h1 className="tw:text-2xl tw:font-bold tw:tracking-widest tw:text-[#163247] tw:select-none tw:-mt-1">
            DwarPal
          </h1>
          <p className="tw:text-[10px] tw:font-semibold tw:text-neutral-500 tw:uppercase tw:tracking-[0.2em] tw:mt-1.5">
            Access Verification Gateway
          </p>
        </motion.div>

        <form onSubmit={handleSubmit} className="tw:space-y-5">
          <motion.div variants={itemVariants} className="tw:space-y-2">
            <label htmlFor="access-code" className="tw:block tw:text-[0.82rem] tw:font-semibold tw:text-neutral-700 tw:tracking-wide">
              Access Code
            </label>
            <div className="tw:group tw:relative tw:mt-1.5">
              <div className="tw:absolute tw:inset-0 tw:rounded-xl tw:bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(227,239,251,0.72))]" />
              <input
                id="access-code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Enter Access Code"
                disabled={isVerifying}
                autoComplete="off"
                className="tw:relative tw:w-full tw:h-12 tw:rounded-xl tw:border tw:bg-transparent tw:px-4 tw:py-3.5 tw:text-[0.98rem] tw:outline-none tw:transition tw:duration-200 tw:border-[#173449]/10"
              />
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="tw:space-y-2">
            <label htmlFor="portal-password" className="tw:block tw:text-[0.82rem] tw:font-semibold tw:text-neutral-700 tw:tracking-wide">
              Portal Password
            </label>
            <div className="tw:group tw:relative tw:mt-1.5">
              <div className="tw:absolute tw:inset-0 tw:rounded-xl tw:bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(227,239,251,0.72))]" />
              <input
                id="portal-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter Portal Password"
                disabled={isVerifying}
                autoComplete="off"
                className="tw:relative tw:w-full tw:h-12 tw:rounded-xl tw:border tw:bg-transparent tw:px-4 tw:py-3.5 tw:text-[0.98rem] tw:outline-none tw:transition tw:duration-200 tw:border-[#173449]/10"
              />
            </div>
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

          <motion.button
            variants={itemVariants}
            type="submit"
            disabled={isVerifying}
            className="action-button primary tw:w-full tw:h-12 tw:flex tw:items-center tw:justify-center tw:gap-2.5 tw:rounded-xl tw:font-bold tw:text-sm"
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
          <p className="tw:text-[9px] tw:text-neutral-400 tw:font-mono tw:tracking-widest tw:uppercase">
            DwarPal SecOps Infrastructure
          </p>
        </motion.div>
      </motion.div>
    </div>
  )
}
