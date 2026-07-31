import { useState, useEffect } from 'react'
import { Sparkles, ShieldCheck, KeyRound, ArrowRight, X } from 'lucide-react'
import { ActionButton } from './ui'

export default function NewStudentWelcomeModal({ currentUser, onNavigateToProfileReset, onClose }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Smooth popup entrance
    const timer = setTimeout(() => setVisible(true), 150)
    return () => clearTimeout(timer)
  }, [])

  function handleResetNow() {
    setVisible(false)
    setTimeout(() => {
      onNavigateToProfileReset?.()
      onClose?.()
    }, 200)
  }

  function handleDismiss() {
    setVisible(false)
    setTimeout(() => {
      onClose?.()
    }, 200)
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div
        className={`relative w-full max-w-md bg-white dark:bg-slate-900 border border-purple-500/30 rounded-2xl shadow-2xl overflow-hidden transform transition-all duration-300 ${
          visible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'
        }`}
      >
        {/* Decorative Top Glowing Header */}
        <div className="h-2 bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500 animate-pulse" />
        
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute right-3 top-4 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full transition-colors"
        >
          <X size={18} />
        </button>

        <div className="p-6 text-center">
          {/* Animated Celebration Icon Badge */}
          <div className="relative mx-auto w-16 h-16 mb-4 flex items-center justify-center rounded-2xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 shadow-inner">
            <Sparkles size={32} className="animate-bounce" />
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-purple-500"></span>
            </span>
          </div>

          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            Welcome to DwarPal, {currentUser?.name || 'Student'}! 🎉
          </h3>

          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-5">
            Your student account was created by the IT Department. Since you are using a temporary login, please update your password now to secure your account.
          </p>

          {/* Callout Box */}
          <div className="flex items-start gap-3 p-3.5 mb-6 text-left rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60">
            <ShieldCheck size={20} className="text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
            <div className="text-xs">
              <strong className="block text-purple-900 dark:text-purple-200 font-semibold mb-0.5">
                Security Recommended
              </strong>
              <span className="text-purple-700 dark:text-purple-300">
                You can change your password anytime from your <strong>Profile &gt; Change Password</strong> section.
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <ActionButton
              type="button"
              tone="primary"
              icon={KeyRound}
              onClick={handleResetNow}
              className="w-full justify-center"
            >
              Reset Password Now
            </ActionButton>
            <ActionButton
              type="button"
              tone="secondary"
              onClick={handleDismiss}
              className="w-full justify-center"
            >
              Explore Dashboard
            </ActionButton>
          </div>
        </div>
      </div>
    </div>
  )
}
