import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function LoadingPage({ onFinished }) {
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('Initializing secure node...')

  useEffect(() => {
    const statuses = [
      { max: 20, text: 'Connecting to DwarPal network...' },
      { max: 40, text: 'Verifying zero-trust credentials...' },
      { max: 65, text: 'Synchronizing cryptographic handshake...' },
      { max: 85, text: 'Establishing secure gateway tunnel...' },
      { max: 100, text: 'Finalizing session parameters...' },
    ]

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval)
          return 100
        }
        // Organic random step increment
        const step = Math.floor(Math.random() * 3) + 2 // 2 to 4 percent per tick
        const next = Math.min(prev + step, 100)
        
        // Update status text based on current percentage range
        const currentStatus = statuses.find((s) => next <= s.max)
        if (currentStatus) {
          setStatus(currentStatus.text)
        }
        
        return next
      })
    }, 45) // Adjust tick interval for a smooth loading rate

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (progress === 100) {
      setStatus('Access granted')
      const timeout = setTimeout(() => {
        if (typeof onFinished === 'function') {
          onFinished()
        }
      }, 400) // Small delay at 100% to let user see "Access granted" before fadeout
      return () => clearTimeout(timeout)
    }
  }, [progress, onFinished])

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="tw:fixed tw:inset-0 tw:z-[9999] tw:flex tw:flex-col tw:items-center tw:justify-center tw:bg-dwarpal-surface tw:select-none"
    >
      <div className="tw:w-full tw:max-w-xs tw:px-4 tw:flex tw:flex-col tw:items-center">
        {/* Modern, Bold Sans-Serif Title with subtle entrance animation */}
        <motion.h1
          initial={{ opacity: 0, y: 12, letterSpacing: '0.3em' }}
          animate={{ opacity: 1, y: 0, letterSpacing: '0.15em' }}
          transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
          className="tw:text-3xl tw:font-extrabold tw:text-dwarpal-ink tw:uppercase tw:mb-5 tw:text-center tw:w-full"
        >
          DwarPal
        </motion.h1>

        {/* Minimalist Progress Container */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="tw:w-full"
        >
          {/* Smooth Thin Progress Bar Track */}
          <div className="tw:h-[2px] tw:w-full tw:bg-dwarpal-ink/[0.08] tw:rounded-full tw:overflow-hidden tw:relative">
            {/* Dynamic Progress Active Fill */}
            <motion.div
              className="tw:absolute tw:left-0 tw:top-0 tw:bottom-0 tw:bg-dwarpal-ink tw:rounded-full"
              style={{ width: `${progress}%` }}
              transition={{ ease: 'easeOut', duration: 0.15 }}
            />
          </div>

          {/* Micro Details (Status message + Percentage counter) */}
          <div className="tw:flex tw:justify-between tw:items-center tw:mt-2.5 tw:font-mono tw:text-[9px] tw:tracking-widest tw:text-dwarpal-muted">
            <div className="tw:h-4 tw:flex tw:items-center tw:overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.span
                  key={status}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                  className="tw:uppercase tw:truncate tw:max-w-[200px]"
                >
                  {status}
                </motion.span>
              </AnimatePresence>
            </div>
            <span className="tw:tabular-nums tw:font-medium">{progress}%</span>
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}
