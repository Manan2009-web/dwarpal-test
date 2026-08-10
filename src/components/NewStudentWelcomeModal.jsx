/**
 * NewStudentWelcomeModal — Fixed to use design system CSS variables instead of
 * Tailwind purple/indigo hardcoded colors. Now uses ModalForm's scale-from-center
 * pattern via AnimatePresence. All prop signatures unchanged.
 */
import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Sparkles, ShieldCheck, KeyRound, X } from 'lucide-react'
import { ActionButton } from './ui'

const SPRING = { type: 'spring', stiffness: 400, damping: 30 }

export default function NewStudentWelcomeModal({ currentUser, onNavigateToProfileReset, onClose }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setOpen(true), 150)
    return () => clearTimeout(timer)
  }, [])

  function handleResetNow() {
    setOpen(false)
    setTimeout(() => {
      onNavigateToProfileReset?.()
      onClose?.()
    }, 280)
  }

  function handleDismiss() {
    setOpen(false)
    setTimeout(() => {
      onClose?.()
    }, 280)
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={handleDismiss}
        >
          <motion.div
            className="modal-card"
            style={{ width: 'min(420px, 100%)', overflow: 'hidden', padding: 0 }}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={SPRING}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Accent top bar — using design system accent color */}
            <div
              style={{
                height: '3px',
                background: 'linear-gradient(90deg, var(--app-accent), var(--app-accent-strong))',
              }}
            />

            <button
              type="button"
              onClick={handleDismiss}
              className="icon-button"
              style={{ position: 'absolute', right: '0.85rem', top: '1rem' }}
              aria-label="Dismiss"
            >
              <X size={18} />
            </button>

            <div style={{ padding: '1.75rem', textAlign: 'center', display: 'grid', gap: '1rem' }}>
              {/* Icon badge — using design system accent soft bg */}
              <motion.div
                style={{
                  position: 'relative',
                  width: '4rem',
                  height: '4rem',
                  margin: '0 auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '18px',
                  background: 'var(--app-accent-soft-bg)',
                  color: 'var(--app-accent)',
                }}
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                aria-hidden="true"
              >
                <Sparkles size={28} />
                {/* Ping dot */}
                <span
                  style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
                    width: '14px',
                    height: '14px',
                    borderRadius: '999px',
                    background: 'var(--app-accent)',
                  }}
                />
              </motion.div>

              <div>
                <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.2rem' }}>
                  Welcome to DwarPal, {currentUser?.name || 'Student'}! 🎉
                </h3>
                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--muted)', lineHeight: 1.55 }}>
                  Your student account was created by the IT Department. Since you are using a temporary login, please update your password now to secure your account.
                </p>
              </div>

              {/* Callout box — using design system accent soft bg + accent border */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  padding: '0.9rem',
                  textAlign: 'left',
                  borderRadius: '14px',
                  background: 'var(--app-accent-soft-bg)',
                  border: '1px solid var(--app-accent-soft-border)',
                }}
              >
                <ShieldCheck
                  size={20}
                  style={{ color: 'var(--app-accent)', flexShrink: 0, marginTop: '1px' }}
                  aria-hidden="true"
                />
                <div style={{ fontSize: '0.84rem' }}>
                  <strong style={{ display: 'block', color: 'var(--text)', marginBottom: '0.2rem' }}>
                    Security Recommended
                  </strong>
                  <span style={{ color: 'var(--muted)' }}>
                    You can change your password anytime from your <strong>Profile &gt; Change Password</strong> section.
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <ActionButton
                  type="button"
                  tone="primary"
                  icon={KeyRound}
                  onClick={handleResetNow}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  Reset Password Now
                </ActionButton>
                <ActionButton
                  type="button"
                  tone="secondary"
                  onClick={handleDismiss}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  Explore Dashboard
                </ActionButton>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
